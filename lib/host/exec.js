/**
 * The one place that talks to `gh`.
 *
 * Every GitHub call this plugin makes goes through here, for three reasons:
 *
 * 1. **No shell.** Arguments travel as an array with `shell: false`, so a PR
 *    title, branch name or label can never become a command. Content from GitHub
 *    is data; it is never executed.
 * 2. **No credentials in our hands.** The plugin never reads, stores or forwards
 *    a token. `gh` owns the credential and this process only gets its stdout.
 * 3. **One error vocabulary.** `gh` fails in several distinct ways — not
 *    installed, not logged in, missing scope, rate limited, 404, network — and
 *    each needs a different message in the UI. Mapping that here keeps the
 *    routes and the client free of `gh` trivia.
 *
 * Errors are never logged with their payload: a failed call may carry a private
 * repository name or a PR title in `stderr`, so the message written to the log
 * is the classification only.
 *
 * @module dsh-pr-release-workspace/lib/host/exec
 */

import { execFile } from 'node:child_process'

/** Hard cap on one `gh` invocation; the UI shows a timeout rather than hanging. */
const DEFAULT_TIMEOUT_MS = 20_000

/** Hard cap on captured stdout. A PR diff can be large; nothing here should be unbounded. */
const DEFAULT_MAX_BUFFER = 24 * 1024 * 1024

/**
 * Classify a `gh` failure into the vocabulary the UI switches on.
 *
 * The order matters: "not installed" outranks everything (no point reporting an
 * auth problem when there is no binary), and a rate-limit hint outranks a plain
 * 403 because GitHub returns both for the same underlying condition.
 *
 * @param {unknown} error - the `execFile` error.
 * @param {string} stderr - captured stderr, already known not to contain secrets.
 * @returns {{ code: string, message: string, retryAfterSeconds: number | null }}
 */
export function classifyGhFailure(error, stderr) {
  // `execFile` puts the OS errno string here for a spawn failure ('ENOENT') and
  // the exit status number for a non-zero exit, so both shapes are legal.
  const raw = error?.code
  const errno = typeof raw === 'string' ? raw : null
  const text = typeof stderr === 'string' ? stderr : ''

  if (errno === 'ENOENT' || /not recognized as an internal|command not found/i.test(text)) {
    return {
      code: 'gh-missing',
      message: 'The GitHub CLI (gh) is not installed or not on PATH.',
      retryAfterSeconds: null,
    }
  }

  // `gh` reports an expired or revoked token as `HTTP 401: Bad credentials` with
  // no "not logged in" wording anywhere, so the status phrase is load-bearing.
  if (/gh auth login|not logged in|authentication required|Bad credentials|HTTP 401|GITHUB_TOKEN|GH_TOKEN/i.test(text)) {
    return {
      code: 'not-authenticated',
      message: 'The GitHub CLI is not signed in. Run `gh auth login` once, then refresh.',
      retryAfterSeconds: null,
    }
  }

  const rate = matchRateLimit(text)
  if (rate !== null) return rate

  if (/Resource not accessible by integration|must have .* access|insufficient.*scope/i.test(text)) {
    return {
      code: 'forbidden',
      message: 'The GitHub account does not have permission for this resource.',
      retryAfterSeconds: null,
    }
  }

  // GraphQL answers a missing repository or pull request with this sentence and
  // no status code at all, so the text pattern is the only signal available.
  if (/Could not resolve to a (Repository|PullRequest|Issue|User|Organization)\b/i.test(text)) {
    return {
      code: 'not-found',
      message: 'GitHub could not find that repository or pull request — check the link, or whether this account can see it.',
      retryAfterSeconds: null,
    }
  }

  if (/\b404\b|Not Found/i.test(text)) {
    return {
      code: 'not-found',
      message: 'GitHub returned 404 — the repository or pull request is not visible to this account.',
      retryAfterSeconds: null,
    }
  }

  // Node's own network failures arrive as an errno string, not as stderr prose.
  if (
    errno === 'ENOTFOUND' ||
    errno === 'ECONNREFUSED' ||
    errno === 'ECONNRESET' ||
    errno === 'ETIMEDOUT' ||
    errno === 'EAI_AGAIN' ||
    /Could not resolve host|dial tcp|no such host|network is unreachable|ETIMEDOUT|EAI_AGAIN|ECONNRESET|socket hang up/i.test(text)
  ) {
    return {
      code: 'network',
      message: 'GitHub could not be reached. Check the network and retry.',
      retryAfterSeconds: null,
    }
  }

  if (typeof error?.killed === 'boolean' && error.killed) {
    return { code: 'timeout', message: 'The GitHub request timed out.', retryAfterSeconds: null }
  }

  return {
    code: 'unknown',
    // Deliberately generic: `text` may quote a private title, so it never reaches
    // the message. The route layer decides what (if anything) to surface.
    message: 'The GitHub request failed.',
    retryAfterSeconds: null,
  }
}

/**
 * Read a GitHub rate-limit message out of stderr.
 *
 * GitHub states the reset either as an epoch second or as a human sentence; both
 * appear in `gh` output depending on the endpoint.
 *
 * @param {string} text
 * @returns {{ code: 'rate-limited', message: string, retryAfterSeconds: number | null } | null}
 */
function matchRateLimit(text) {
  if (!/rate limit|API rate limit exceeded|secondary rate limit/i.test(text)) return null
  let retryAfterSeconds = null

  const epoch = /reset(?:\s+at)?\s+(\d{9,11})/i.exec(text)
  if (epoch !== null) {
    const seconds = Number(epoch[1]) - Math.floor(Date.now() / 1000)
    if (Number.isFinite(seconds)) retryAfterSeconds = Math.max(0, seconds)
  }

  const relative = /(?:try again|retry)\s+in\s+(\d+)\s*(second|minute|hour)/i.exec(text)
  if (retryAfterSeconds === null && relative !== null) {
    const amount = Number(relative[1])
    const unit = relative[2].toLowerCase()
    const factor = unit === 'hour' ? 3600 : unit === 'minute' ? 60 : 1
    if (Number.isFinite(amount)) retryAfterSeconds = amount * factor
  }

  return {
    code: 'rate-limited',
    message: 'GitHub rate limit reached.',
    retryAfterSeconds,
  }
}

/**
 * A structured failure the routes can serialise without leaking content.
 *
 * Callers catch this by `instanceof` and map it onto an HTTP status plus the
 * `code`, never onto a raw `gh` transcript.
 */
export class GhError extends Error {
  /**
   * @param {string} code - one of the {@link classifyGhFailure} codes.
   * @param {string} message - safe, user-facing, no repository content.
   * @param {{ retryAfterSeconds?: number | null }} [extra]
   */
  constructor(code, message, extra = {}) {
    super(message)
    this.name = 'GhError'
    this.code = code
    this.retryAfterSeconds = extra.retryAfterSeconds ?? null
  }
}

/**
 * Run `gh` with an argument array.
 *
 * @param {string[]} args - arguments after the binary, e.g. `['pr','view','1','--json','title']`.
 * @param {object} [options]
 * @param {number} [options.timeoutMs]
 * @param {AbortSignal} [options.signal]
 * @param {number} [options.maxBuffer]
 * @returns {Promise<string>} stdout.
 * @throws {GhError} classified, content-free.
 */
export function runGh(args, options = {}) {
  if (!Array.isArray(args) || args.length === 0) {
    return Promise.reject(new GhError('bad-request', 'No GitHub command was given.'))
  }
  if (args.some((a) => typeof a !== 'string')) {
    return Promise.reject(new GhError('bad-request', 'GitHub command arguments must be strings.'))
  }

  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    maxBuffer = DEFAULT_MAX_BUFFER,
  } = options

  return new Promise((resolve, reject) => {
    // `shell: false` is the whole point of this module; `windowsHide` keeps a
    // console from flashing on Windows for every refresh.
    execFile(
      'gh',
      args,
      {
        timeout: timeoutMs,
        maxBuffer,
        windowsHide: true,
        shell: false,
        signal,
        encoding: 'utf8',
        env: { ...process.env, GH_PROMPT_DISABLED: '1', NO_COLOR: '1' },
      },
      (error, stdout, stderr) => {
        if (error === null || error === undefined) {
          resolve(typeof stdout === 'string' ? stdout : '')
          return
        }
        const info = classifyGhFailure(error, typeof stderr === 'string' ? stderr : '')
        reject(new GhError(info.code, info.message, info))
      },
    )
  })
}

/**
 * Run `gh api` against a REST path and parse JSON.
 *
 * @template T
 * @param {string} path - a path beginning with `/`, e.g. `/repos/o/r/pulls/1`.
 * @param {object} [options]
 * @param {Record<string,string|null|undefined>} [options.query] - added as `-f k=v`.
 * @param {string[]} [options.headers] - `-H name: value` pairs.
 * @param {number} [options.timeoutMs]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<T>}
 */
export async function ghApiJson(path, options = {}) {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new GhError('bad-request', 'A GitHub API path must start with a slash.')
  }
  // Refuse traversal and absolute URLs: this helper only ever calls the
  // configured host through `gh`, and a caller-supplied `https://…` must not be
  // able to redirect the credential to another origin.
  if (path.includes('..') || /^\/\//.test(path)) {
    throw new GhError('bad-request', 'Invalid GitHub API path.')
  }

  const args = ['api', path, '--method', 'GET']
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value === null || value === undefined) continue
    args.push('-f', `${key}=${value}`)
  }
  for (const header of options.headers ?? []) args.push('-H', header)

  const stdout = await runGh(args, { timeoutMs: options.timeoutMs, signal: options.signal })
  try {
    return /** @type {T} */ (JSON.parse(stdout))
  } catch {
    throw new GhError('bad-response', 'GitHub returned a response that was not valid JSON.')
  }
}

/** The comment every write-capable path must carry, so no call site forgets it. */
export const WRITE_GUARD_NOTE =
  'This plugin never writes to GitHub: no comment, review, approval, request-changes or merge is sent on the user\'s behalf.'

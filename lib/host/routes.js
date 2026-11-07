/**
 * The HTTP surface between the host half and the web client.
 *
 * Two rules shape this file.
 *
 * **Every response is an envelope.** `{ok: true, value}` or
 * `{ok: false, error: {code, message}}`, and the handler never throws — a thrown
 * error would surface as an HTML error page the client cannot parse, turning a
 * recoverable "not signed in" into a blank panel.
 *
 * **Nothing about GitHub is trusted to the socket.** The route layer validates
 * the shape of every parameter before it reaches a `gh` call: a PR number must
 * be an integer, an owner must match GitHub's own character set, and a draft body
 * must be a string under the cap. The validation lives here rather than in the
 * handlers because these are the entry points an attacker with a browser has.
 *
 * Routes are namespaced under `/dsh-pr-release-workspace/` so they cannot collide
 * with another plugin's. The connection service authenticates every caller;
 * loopback and same-origin checks provide an additional boundary, never a
 * replacement when that authentication service is unavailable.
 *
 * @module dsh-pr-release-workspace/lib/host/routes
 */

import { GhError } from './exec.js'
import { parsePullReference, readPullDiff, readPullRequest, readReviewComments } from './pull.js'
import { collectReleaseFacts } from './release.js'
import { searchAllGroups, searchPullRequests, buildSearchQuery } from './search.js'

/** The route namespace. One prefix, so a single registration covers every endpoint. */
export const ROUTE_PREFIX = '/dsh-pr-release-workspace'

/** Request bodies are small JSON payloads; 1 MiB is already generous. */
const MAX_BODY_BYTES = 1_048_576

/**
 * Build the endpoint table.
 *
 * Each endpoint receives an already-parsed payload and a `{signal}` context, and
 * returns a plain JSON-serialisable value. Throwing a `GhError` produces a typed
 * envelope; throwing anything else is logged and reported as `internal` with no
 * message, because an arbitrary error's text may quote repository content.
 *
 * @param {{ drafts: object, log: object }} deps
 * @returns {Record<string, (payload: object, context: object) => Promise<unknown>>}
 */
export function createEndpoints({ drafts, log }) {
  return {
    /**
     * Which account is signed in, and whether `gh` is usable at all.
     *
     * Deliberately first-class: almost every other failure is downstream of this
     * one, so the panel asks it before rendering anything that needs GitHub.
     */
    async identity(_payload, context) {
      const { readViewer, readTeams } = await import('./search.js')
      const [viewer, teams] = await Promise.all([readViewer(context.signal), readTeams(context.signal)])
      return { viewer, teams, writeGuard: WRITE_GUARD }
    },

    /** The three grouped lists. */
    async groups(payload, context) {
      const pageSize = clampInt(payload?.pageSize, 1, 100, 30)
      return searchAllGroups({ pageSize, signal: context.signal })
    },

    /** One free-text search, for the search box. */
    async search(payload, context) {
      const text = requireString(payload?.query, 'query', 300)
      const pageSize = clampInt(payload?.pageSize, 1, 100, 30)
      const qualifier = /[:@]/.test(text) ? text : `${text} in:title`
      const query = buildSearchQuery(qualifier, { openOnly: payload?.openOnly !== false })
      return searchPullRequests(query, { first: pageSize, signal: context.signal })
    },

    /** Resolve a pasted URL or shorthand into a PR target without fetching it. */
    async resolve(payload) {
      const text = requireString(payload?.text, 'text', 500)
      const target = parsePullReference(text, {
        owner: typeof payload?.owner === 'string' ? payload.owner : undefined,
        repo: typeof payload?.repo === 'string' ? payload.repo : undefined,
      })
      if (target === null) {
        throw new GhError('bad-request', 'That is not a pull request link. Paste a github.com/owner/repo/pull/123 URL.')
      }
      return { target }
    },

    /** PR detail: core facts, files, comments, reviews, CI rollup. */
    async pull(payload, context) {
      const target = requireTarget(payload)
      const [detail, inline] = await Promise.all([
        readPullRequest(target, { signal: context.signal }),
        // Inline comments can fail on their own (permissions on a fork, an API
        // hiccup) without the rest of the panel becoming useless.
        readReviewComments(target, { signal: context.signal }).catch((error) => {
          log.warn('[pr-release-workspace] inline comments unavailable', error?.code ?? 'unknown')
          return []
        }),
      ])
      return { ...detail, inlineComments: inline }
    },

    /** The unified diff, as per-file old/new text ready for `DiffBlock`. */
    async diff(payload, context) {
      const target = requireTarget(payload)
      return readPullDiff(target, { signal: context.signal })
    },

    /** Drafts for one PR, annotated current/stale against its head SHA. */
    async drafts(payload) {
      const key = requireString(payload?.key, 'key', 200)
      const headSha = typeof payload?.headSha === 'string' ? payload.headSha : null
      return { drafts: await drafts.list({ key, headSha }) }
    },

    /** Create or update one draft. Never leaves this machine. */
    async saveDraft(payload) {
      const draft = await drafts.save({
        key: requireString(payload?.key, 'key', 200),
        sha: requireString(payload?.sha, 'sha', 64),
        path: payload?.path === null || payload?.path === undefined ? null : requireString(payload.path, 'path', 512),
        line: typeof payload?.line === 'number' ? payload.line : null,
        body: requireString(payload?.body, 'body', 20_000),
        kind: typeof payload?.kind === 'string' ? payload.kind : undefined,
      })
      return { draft }
    },

    /** Delete one draft. */
    async removeDraft(payload) {
      const id = requireString(payload?.id, 'id', 400)
      return { removed: await drafts.remove(id) }
    },

    /** Drop every draft for one PR. */
    async clearDrafts(payload) {
      const key = requireString(payload?.key, 'key', 200)
      return { removed: await drafts.clearKey(key) }
    },

    /**
     * The six release facts for one version.
     *
     * The whole point is that this returns them separately; a caller that
     * collapses them has thrown away the information.
     */
    async release(payload, context) {
      const target = {
        owner: requireSlug(payload?.owner, 'owner'),
        repo: requireSlug(payload?.repo, 'repo'),
        tag: requireString(payload?.tag, 'tag', 120),
        sha: requireString(payload?.sha, 'sha', 64),
        npmName: requireString(payload?.npmName, 'npmName', 214),
        version: requireString(payload?.version, 'version', 64),
        market: {
          marketRepo: typeof payload?.market?.repo === 'string' ? payload.market.repo : undefined,
          marketNumber:
            typeof payload?.market?.number === 'number' && Number.isInteger(payload.market.number)
              ? payload.market.number
              : null,
          marketIndexUrl: typeof payload?.market?.indexUrl === 'string' ? payload.market.indexUrl : undefined,
          marketBranch: typeof payload?.market?.branch === 'string' ? payload.market.branch : undefined,
        },
      }
      return collectReleaseFacts(target, { signal: context.signal })
    },
  }
}

/**
 * The text the panel shows wherever a write action *would* live.
 *
 * Kept as a constant so the client and the host cannot drift: the same sentence
 * explains the boundary in the UI and in the API response.
 */
export const WRITE_GUARD =
  'This panel is read-only. It never posts comments or reviews, never approves or requests changes, and never merges — those stay your decision on GitHub.'

/**
 * Validate a PR target out of a payload.
 *
 * @param {any} payload
 * @returns {{ owner: string, repo: string, number: number }}
 */
function requireTarget(payload) {
  return {
    owner: requireSlug(payload?.owner, 'owner'),
    repo: requireSlug(payload?.repo, 'repo'),
    number: clampInt(payload?.number, 1, Number.MAX_SAFE_INTEGER, null),
  }
}

/**
 * A GitHub owner or repository name.
 *
 * The character class is GitHub's own; anything else is rejected rather than
 * escaped, because these values end up in a `--repo` argument and in a URL path
 * and a `.` or `..` there would retarget the request.
 *
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireSlug(value, field) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(value) || value === '.' || value === '..') {
    throw new GhError('bad-request', `${field} is not a valid GitHub name.`)
  }
  return value
}

/**
 * A required string under a length cap.
 *
 * @param {unknown} value
 * @param {string} field
 * @param {number} max
 * @returns {string}
 */
function requireString(value, field, max) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new GhError('bad-request', `${field} is required.`)
  }
  if (value.length > max) throw new GhError('bad-request', `${field} is too long.`)
  return value
}

/**
 * An integer inside a range, or a fallback.
 *
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {number | null} fallback
 * @returns {number}
 */
function clampInt(value, min, max, fallback) {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : NaN
  if (!Number.isFinite(n)) {
    if (fallback === null) throw new GhError('bad-request', 'A number is required.')
    return fallback
  }
  if (n < min || n > max) throw new GhError('bad-request', 'A number is out of range.')
  return n
}

/**
 * Failure codes that are safe and useful to hand to the UI verbatim.
 *
 * `GhError` carries these from the `gh` classifier; `bad-request` is ours. Any
 * other code means something unexpected happened, and those are reported as
 * `internal` with a fixed message instead.
 *
 * @type {ReadonlySet<string>}
 */
const PASS_THROUGH_CODES = new Set([
  'bad-request',
  'not-found',
  'forbidden',
  'rate-limited',
  'not-authenticated',
  'gh-missing',
  'network',
  'timeout',
])

/**
 * Wrap one endpoint into the `{ok, value|error}` envelope.
 *
 * @param {(payload: object, context: object) => Promise<unknown>} run
 * @param {object} log
 * @returns {(payload: object, context: object) => Promise<object>}
 */
export function envelope(run, log) {
  // Reporting a failure must never become a second failure: a host logger can be
  // a callable service whose methods need their receiver, and a detached call
  // throws. Keep the reporting path total.
  const warn = (...args) => {
    try {
      log?.warn?.(...args)
    } catch {
      // Ignored on purpose: the envelope already carries the real outcome.
    }
  }
  return async (payload, context) => {
    try {
      const value = await run(payload ?? {}, context ?? {})
      return { ok: true, value: value ?? {} }
    } catch (error) {
      const code = typeof error?.code === 'string' ? error.code : 'internal'
      // Codes the client can explain to a person. Everything else is collapsed
      // below, because an unexpected error may quote private content.
      if (PASS_THROUGH_CODES.has(code)) {
        return {
          ok: false,
          error: {
            code,
            message: String(error?.message ?? 'The request failed.'),
            retryAfterSeconds: typeof error?.retryAfterSeconds === 'number' ? error.retryAfterSeconds : null,
          },
        }
      }
      // Anything unrecognised is logged once, without its message, and reported
      // generically: an unexpected error can quote a private title or path.
      warn('[pr-release-workspace] endpoint failed', code)
      return { ok: false, error: { code: 'internal', message: 'The request failed.', retryAfterSeconds: null } }
    }
  }
}

/**
 * Dispatch one request to an endpoint.
 *
 * Shared by both carriers so the fallback route and the Connection channel
 * cannot diverge in behaviour.
 *
 * @param {Record<string, Function>} endpoints - already enveloped.
 * @param {string} name
 * @param {object} payload
 * @param {{ signal?: AbortSignal, peer?: object }} [context]
 * @returns {Promise<object>}
 */
export async function dispatch(endpoints, name, payload, context) {
  const run = Object.prototype.hasOwnProperty.call(endpoints, name) ? endpoints[name] : undefined
  if (typeof run !== 'function') {
    return { ok: false, error: { code: 'bad-request', message: 'Unknown endpoint.', retryAfterSeconds: null } }
  }
  return run(payload, context ?? {})
}

/**
 * Is this request from the local machine's own page?
 *
 * Mirrors the check `dsh-client-connection` documents: the Host header must be
 * loopback (or the server's own bind address), a present Origin must match the
 * Host, and cross-site fetch metadata is refused outright. Without this the
 * fallback route would let any web page in the browser read the user's pull
 * requests through a same-machine request.
 *
 * @param {import('node:http').IncomingMessage} request
 * @param {{ host?: string }} webServer
 * @returns {boolean}
 */
export function isTrustedLocalRequest(request, webServer) {
  const headers = request?.headers ?? {}
  const rawHost = String(headers.host ?? '')
  if (rawHost.length === 0) return false

  const hostname = stripPort(rawHost)
  if (!isLoopbackName(hostname)) {
    let bindHost
    try {
      bindHost = webServer?.host
    } catch {
      bindHost = undefined
    }
    if (typeof bindHost !== 'string' || normalizeHost(bindHost) !== normalizeHost(hostname)) return false
  }

  const site = String(headers['sec-fetch-site'] ?? '').toLowerCase()
  if (site === 'cross-site') return false

  const origin = headers.origin
  if (typeof origin === 'string' && origin.length > 0) {
    try {
      const parsed = new URL(origin)
      if (normalizeHost(parsed.host) !== normalizeHost(rawHost)) return false
    } catch {
      return false
    }
  }
  return true
}

/**
 * Decide whether this request may reach an endpoint.
 *
 * Two fences, in order of authority. The composition's connection service
 * answers first: it applies the Host/Origin rules that defeat DNS rebinding and
 * then requires the browser session cookie the launch token established, so its
 * 401/403 is the authoritative answer and is passed through verbatim. The local
 * check afterwards is this plugin's additional boundary. A composition without
 * the connection service or its admission method must refuse every request.
 *
 * A connection service that THROWS is not permission. An unknown answer about
 * trust fails closed — the alternative is that a broken fence silently becomes
 * an open route.
 *
 * Method and content-type are checked after admission so that a rejected caller
 * cannot use them to probe which endpoints exist.
 *
 * @param {object} deps
 * @param {import('node:http').IncomingMessage} deps.request
 * @param {{ host?: string }} [deps.webServer]
 * @param {{ requestRejection?: (request: import('node:http').IncomingMessage) => (401 | 403 | undefined) }} [deps.connection]
 * @param {(message: string) => void} [deps.warn]
 * @returns {{ status: number, text: string } | undefined} Refusal, or undefined to admit.
 */
export function admitRequest({ request, webServer, connection, warn }) {
  if (connection === null || connection === undefined || typeof connection.requestRejection !== 'function') {
    return { status: 403, text: 'forbidden' }
  }
  let rejection
  try {
    rejection = connection.requestRejection(request)
  } catch (error) {
    warn?.(`connection check threw (${String(error?.code ?? 'unknown')}); refusing`)
    return { status: 403, text: 'forbidden' }
  }
  if (rejection === 401) return { status: 401, text: 'authentication required' }
  if (rejection !== undefined) return { status: 403, text: 'forbidden' }

  if (request?.method !== 'POST') return { status: 405, text: 'method not allowed' }
  if (!isTrustedLocalRequest(request, webServer)) return { status: 403, text: 'forbidden' }

  const contentType = String(request?.headers?.['content-type'] ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase()
  if (contentType !== 'application/json') {
    return { status: 415, text: 'content type must be application/json' }
  }
  return undefined
}

/**
 * Read and parse a JSON body under a size cap.
 *
 * The cap is enforced while reading, not after: a caller that sends 500 MB must
 * not be buffered in full and then rejected.
 *
 * @param {AsyncIterable<Buffer>} stream
 * @param {number} [limitBytes]
 * @returns {Promise<any>}
 */
export function readJsonBody(stream, limitBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = []
    let size = 0
    let settled = false

    const fail = (code, message) => {
      if (settled) return
      settled = true
      const error = new Error(message)
      error.code = code
      reject(error)
      // Draining is the caller's job; destroying here would drop the socket
      // before the 413 response is written.
    }

    stream.on('data', (chunk) => {
      if (settled) return
      size += chunk.length
      if (size > limitBytes) {
        fail('payload-too-large', 'Request body is too large.')
        return
      }
      chunks.push(chunk)
    })
    stream.on('end', () => {
      if (settled) return
      settled = true
      const text = Buffer.concat(chunks).toString('utf8')
      if (text.trim().length === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(text))
      } catch {
        const error = new Error('Request body is not valid JSON.')
        error.code = 'bad-request'
        reject(error)
      }
    })
    stream.on('error', (error) => {
      if (settled) return
      settled = true
      reject(error)
    })
  })
}

/** Strip a port from a Host header, handling IPv6 literals. */
function stripPort(host) {
  if (host.startsWith('[')) {
    const end = host.indexOf(']')
    return end === -1 ? host : host.slice(0, end + 1)
  }
  const colon = host.indexOf(':')
  return colon === -1 ? host : host.slice(0, colon)
}

/** Canonicalise a host for comparison. */
function normalizeHost(value) {
  return String(value).trim().toLowerCase().replace(/^\[(.*)\]$/, '$1').replace(/\.$/, '')
}

/** Is this a loopback name or address? */
function isLoopbackName(hostname) {
  const name = normalizeHost(hostname)
  if (name === 'localhost' || name === '::1' || name === '0:0:0:0:0:0:0:1') return true
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(name)) return true
  return /^::ffff:127\./.test(name)
}

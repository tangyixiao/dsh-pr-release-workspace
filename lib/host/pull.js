/**
 * One pull request, in the detail the panel actually shows.
 *
 * Three separate questions live here and they must stay separate:
 *
 * - **Does the code still match?** — `headSha` is the version anchor. A diff, a
 *   check run and a review draft are all only meaningful for one SHA; when the
 *   branch moves they are stale, not wrong.
 * - **Is it mergeable?** — `mergeable`/`mergeStateStatus` from GitHub, which
 *   answers a different question than "do the checks pass".
 * - **What did CI say?** — normalised into four buckets. A skipped or neutral
 *   check is not a pass; a cancelled one is not a failure of the code.
 *
 * @module dsh-pr-release-workspace/lib/host/pull
 */

import { GhError, ghApiJson, runGh } from './exec.js'

/**
 * The verdict vocabulary for a check rollup.
 *
 * `not_configured` and `unknown` are distinct on purpose: "this repository has no
 * CI" and "I could not read the result" look the same in a naive `all(passed)`
 * and mean completely different things to the person deciding whether to merge.
 */
export const CI_VERDICT = Object.freeze({
  SUCCESS: 'success',
  FAILURE: 'failure',
  PENDING: 'pending',
  CANCELLED: 'cancelled',
  SKIPPED: 'skipped',
  NOT_CONFIGURED: 'not_configured',
  UNKNOWN: 'unknown',
})

/** The GitHub check-run conclusion values we accept, mapped to our verdicts. */
const CONCLUSION_VERDICT = {
  success: CI_VERDICT.SUCCESS,
  failure: CI_VERDICT.FAILURE,
  timed_out: CI_VERDICT.FAILURE,
  action_required: CI_VERDICT.FAILURE,
  startup_failure: CI_VERDICT.FAILURE,
  cancelled: CI_VERDICT.CANCELLED,
  skipped: CI_VERDICT.SKIPPED,
  neutral: CI_VERDICT.SKIPPED,
  stale: CI_VERDICT.UNKNOWN,
}

/** `statusCheckRollup` state values (the older commit-status API). */
const STATE_VERDICT = {
  success: CI_VERDICT.SUCCESS,
  failure: CI_VERDICT.FAILURE,
  error: CI_VERDICT.FAILURE,
  pending: CI_VERDICT.PENDING,
  expected: CI_VERDICT.PENDING,
}

/**
 * Fields requested for one pull request.
 *
 * `headRefOid` is the version anchor and is not optional: without it a cached
 * diff cannot be proven current.
 */
const PR_FIELDS = [
  'number',
  'title',
  'body',
  'state',
  'isDraft',
  'mergedAt',
  'closedAt',
  'createdAt',
  'updatedAt',
  'url',
  'additions',
  'deletions',
  'changedFiles',
  'mergeable',
  'mergeStateStatus',
  'reviewDecision',
  'baseRefName',
  'headRefName',
  'headRefOid',
  'author',
  'comments',
  'reviews',
  'reviewRequests',
  'files',
  'statusCheckRollup',
  'labels',
  'assignees',
  'milestone',
]

/**
 * Read one pull request.
 *
 * `gh pr view --json` is used rather than a hand-built GraphQL query: the field
 * names above are the CLI's own contract, so a GitHub API addition does not
 * require a new query here.
 *
 * @param {{ owner: string, repo: string, number: number }} target
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>} normalised pull request DTO.
 */
export async function readPullRequest(target, options = {}) {
  assertTarget(target)
  const args = [
    'pr',
    'view',
    String(target.number),
    '--repo',
    `${target.owner}/${target.repo}`,
    '--json',
    PR_FIELDS.join(','),
  ]
  const stdout = await runGh(args, { signal: options.signal, timeoutMs: 25_000 })
  let raw
  try {
    raw = JSON.parse(stdout)
  } catch {
    throw new GhError('bad-response', 'GitHub returned a pull request that was not valid JSON.')
  }
  return normalisePullRequest(raw, target)
}

/**
 * Flatten `gh pr view --json` into the DTO the client renders.
 *
 * @param {any} raw
 * @param {{ owner: string, repo: string, number: number }} target
 * @returns {object}
 */
export function normalisePullRequest(raw, target) {
  const author = typeof raw?.author?.login === 'string' ? raw.author.login : null
  const headSha = typeof raw?.headRefOid === 'string' ? raw.headRefOid : null
  const numbers = {
    additions: integerOr(raw?.additions),
    deletions: integerOr(raw?.deletions),
    changedFiles: integerOr(raw?.changedFiles),
  }
  const files = normaliseFiles(raw?.files)

  return {
    key: `github.com/${target.owner}/${target.repo}#${target.number}`,
    host: 'github.com',
    owner: target.owner,
    repo: target.repo,
    repository: `${target.owner}/${target.repo}`,
    number: target.number,
    title: typeof raw?.title === 'string' ? raw.title : '',
    body: typeof raw?.body === 'string' ? raw.body : '',
    state: typeof raw?.state === 'string' ? raw.state.toLowerCase() : 'unknown',
    draft: raw?.isDraft === true,
    // Merge facts are kept as raw timestamps plus one derived boolean: a merged
    // PR and a closed PR are different outcomes and the UI must not fold them.
    mergedAt: raw?.mergedAt ?? null,
    merged: typeof raw?.mergedAt === 'string' && raw.mergedAt.length > 0,
    closedAt: raw?.closedAt ?? null,
    createdAt: raw?.createdAt ?? null,
    updatedAt: raw?.updatedAt ?? null,
    url: typeof raw?.url === 'string' ? raw.url : '',
    author,
    baseRefName: typeof raw?.baseRefName === 'string' ? raw.baseRefName : null,
    headRefName: typeof raw?.headRefName === 'string' ? raw.headRefName : null,
    // The version anchor. Everything version-bound (diff, checks, drafts) reads
    // this and nothing else.
    headSha,
    mergeable: typeof raw?.mergeable === 'string' ? raw.mergeable : 'unknown',
    mergeStateStatus: typeof raw?.mergeStateStatus === 'string' ? raw.mergeStateStatus : 'unknown',
    reviewDecision: typeof raw?.reviewDecision === 'string' ? raw.reviewDecision : null,
    labels: Array.isArray(raw?.labels)
      ? raw.labels
          .map((label) => (typeof label?.name === 'string' ? { name: label.name, color: label.color ?? null } : null))
          .filter((label) => label !== null)
      : [],
    assignees: Array.isArray(raw?.assignees)
      ? raw.assignees.map((a) => a?.login).filter((login) => typeof login === 'string')
      : [],
    milestone: typeof raw?.milestone?.title === 'string' ? raw.milestone.title : null,
    counts: numbers,
    files: files,
    // `gh pr view --json files` returns at most 100 entries and says nothing
    // when it truncates. Comparing against the PR's own changed-file count is
    // the only way to know the list is incomplete — without this the panel would
    // show "100 files" for a 472-file pull request with no indication of loss.
    filesCapped: numbers.changedFiles > 0 && files.length < numbers.changedFiles,
    comments: normaliseComments(raw?.comments),
    reviews: normaliseReviews(raw?.reviews),
    reviewRequests: normaliseReviewRequests(raw?.reviewRequests),
    ci: summariseChecks(raw?.statusCheckRollup, headSha),
  }
}

/**
 * Normalise the changed-file list.
 *
 * `gh pr view --json files` returns path/additions/deletions/changeType but not
 * the patch text; the diff itself comes from `gh pr diff`. Keeping the two
 * separate means the file list can render before the (potentially large) diff
 * arrives.
 *
 * @param {unknown} files
 * @returns {object[]}
 */
export function normaliseFiles(files) {
  if (!Array.isArray(files)) return []
  const rows = []
  for (const file of files) {
    if (typeof file?.path !== 'string') continue
    rows.push({
      path: file.path,
      additions: integerOr(file.additions),
      deletions: integerOr(file.deletions),
      // GitHub calls a rename "renamed" and a binary change "changed"; both are
      // passed through rather than guessed.
      changeType: typeof file.changeType === 'string' ? file.changeType : 'modified',
    })
  }
  return rows
}

/**
 * Normalise top-level PR comments.
 *
 * Review comments attached to a diff line are a different collection with a
 * different endpoint and are fetched separately; folding them in here would
 * make a conversation comment and a line comment indistinguishable.
 *
 * @param {unknown} comments
 * @returns {object[]}
 */
export function normaliseComments(comments) {
  if (!Array.isArray(comments)) return []
  const rows = []
  for (const comment of comments) {
    if (typeof comment?.body !== 'string') continue
    rows.push({
      id: typeof comment.id === 'string' ? comment.id : null,
      author: comment.author?.login ?? null,
      authorAvatar: comment.author?.avatarUrl ?? null,
      body: comment.body,
      createdAt: comment.createdAt ?? null,
      url: typeof comment.url === 'string' ? comment.url : null,
    })
  }
  return rows
}

/**
 * Normalise submitted reviews.
 *
 * @param {unknown} reviews
 * @returns {object[]}
 */
export function normaliseReviews(reviews) {
  if (!Array.isArray(reviews)) return []
  const rows = []
  for (const review of reviews) {
    const state = typeof review?.state === 'string' ? review.state.toUpperCase() : 'COMMENTED'
    rows.push({
      id: typeof review.id === 'string' ? review.id : null,
      author: review.author?.login ?? null,
      state,
      // Only a substantive decision is worth a badge; a drive-by comment is not
      // an approval and must not read like one.
      decisive: state === 'APPROVED' || state === 'CHANGES_REQUESTED',
      body: typeof review.body === 'string' ? review.body : '',
      submittedAt: review.submittedAt ?? null,
      commitSha: typeof review.commit?.oid === 'string' ? review.commit.oid : null,
    })
  }
  return rows
}

/**
 * Normalise pending review requests.
 *
 * @param {unknown} requests
 * @returns {object[]}
 */
export function normaliseReviewRequests(requests) {
  if (!Array.isArray(requests)) return []
  return requests
    .map((request) => {
      if (typeof request?.login === 'string') return { type: 'user', name: request.login }
      if (typeof request?.slug === 'string') return { type: 'team', name: request.slug }
      if (typeof request?.name === 'string') return { type: 'team', name: request.name }
      return null
    })
    .filter((request) => request !== null)
}

/**
 * Summarise a check rollup into one verdict plus per-check rows.
 *
 * The rule the plan insists on: a passing rollup requires at least one check and
 * zero failures, zero pending and zero cancelled. Skipped checks are reported
 * separately because "the only check was skipped" is not evidence of anything,
 * and an empty rollup is `not_configured`, never `success`.
 *
 * About commit identity: `gh pr view --json statusCheckRollup` returns GitHub's
 * own per-PR rollup, and its rows carry `name`/`status`/`conclusion`/`detailsUrl`
 * but NO `headSha` — verified against a live PR. So the rollup is trusted as
 * GitHub's answer for this PR (which is what the UI claims it is), and the only
 * thing checked here is that a row we cannot even name does not count: an
 * unnamed row cannot be shown to the reader, so it cannot support a green
 * verdict either.
 *
 * @param {unknown} rollup
 * @param {string | null} headSha
 * @returns {object}
 */
export function summariseChecks(rollup, headSha) {
  if (!Array.isArray(rollup)) {
    return {
      verdict: rollup === null || rollup === undefined ? CI_VERDICT.NOT_CONFIGURED : CI_VERDICT.UNKNOWN,
      counts: emptyCounts(),
      checks: [],
      headSha,
      total: 0,
    }
  }

  const checks = []
  for (const item of rollup) {
    const check = normaliseCheck(item)
    if (check !== null) checks.push(check)
  }

  if (checks.length === 0) {
    return {
      verdict: CI_VERDICT.NOT_CONFIGURED,
      counts: emptyCounts(),
      checks: [],
      headSha,
      total: 0,
    }
  }

  const counts = emptyCounts()
  for (const check of checks) {
    if (counts[check.verdict] === undefined) counts[check.verdict] = 0
    counts[check.verdict] += 1
  }

  // Order matters. A failure outranks everything, then a cancellation (someone
  // stopped it — not a verdict on the code), then pending, then unknown, and
  // only a rollup with at least one real success and nothing else is green.
  let verdict
  if (counts.failure > 0) verdict = CI_VERDICT.FAILURE
  else if (counts.cancelled > 0) verdict = CI_VERDICT.CANCELLED
  else if (counts.pending > 0) verdict = CI_VERDICT.PENDING
  else if (counts.unknown > 0) verdict = CI_VERDICT.UNKNOWN
  else if (counts.success > 0) verdict = CI_VERDICT.SUCCESS
  else verdict = CI_VERDICT.SKIPPED

  return { verdict, counts, checks, headSha, total: checks.length }
}

/**
 * One check run or commit status.
 *
 * GitHub mixes two shapes in `statusCheckRollup`: check runs carry
 * `name`/`status`/`conclusion`, legacy commit statuses carry `context`/`state`.
 * Both are normalised to the same row.
 *
 * @param {any} item
 * @returns {object | null}
 */
function normaliseCheck(item) {
  if (item === null || typeof item !== 'object') return null

  const name =
    typeof item.name === 'string'
      ? item.name
      : typeof item.context === 'string'
        ? item.context
        : null
  if (name === null) return null

  let verdict
  if (typeof item.conclusion === 'string' && item.conclusion.length > 0) {
    verdict = CONCLUSION_VERDICT[item.conclusion.toLowerCase()] ?? CI_VERDICT.UNKNOWN
  } else if (typeof item.state === 'string' && item.state.length > 0) {
    verdict = STATE_VERDICT[item.state.toLowerCase()] ?? CI_VERDICT.UNKNOWN
  } else {
    // A check that exists but has no conclusion yet is running, which is
    // pending rather than unknown — GitHub reports `status: IN_PROGRESS`.
    verdict = CI_VERDICT.PENDING
  }

  return {
    name,
    // The workflow name disambiguates two jobs called "test" in different
    // workflows, which is common and otherwise unreadable.
    workflow: typeof item.workflowName === 'string' ? item.workflowName : null,
    verdict,
    raw:
      typeof item.conclusion === 'string' && item.conclusion.length > 0
        ? item.conclusion.toLowerCase()
        : typeof item.state === 'string'
          ? item.state.toLowerCase()
          : null,
    startedAt: item.startedAt ?? null,
    completedAt: item.completedAt ?? null,
    url: typeof item.detailsUrl === 'string' ? item.detailsUrl : typeof item.targetUrl === 'string' ? item.targetUrl : null,
  }
}

/**
 * A fresh counters object.
 *
 * @returns {Record<string, number>}
 */
function emptyCounts() {
  return {
    [CI_VERDICT.SUCCESS]: 0,
    [CI_VERDICT.FAILURE]: 0,
    [CI_VERDICT.PENDING]: 0,
    [CI_VERDICT.CANCELLED]: 0,
    [CI_VERDICT.SKIPPED]: 0,
    [CI_VERDICT.UNKNOWN]: 0,
  }
}

/**
 * Read the unified diff text for one PR.
 *
 * The output is parsed into per-file hunks rather than passed through raw: the
 * client renders `DiffBlock`, which wants `{path, oldText, newText}` per file, and
 * a raw patch string would be re-parsed there anyway.
 *
 * @param {{ owner: string, repo: string, number: number }} target
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ files: { path: string, oldText: string | null, newText: string }[], truncated: boolean, bytes: number }>}
 */
export async function readPullDiff(target, options = {}) {
  assertTarget(target)
  try {
    const stdout = await runGh(
      ['pr', 'diff', String(target.number), '--repo', `${target.owner}/${target.repo}`],
      { signal: options.signal, timeoutMs: 45_000, maxBuffer: 32 * 1024 * 1024 },
    )
    return { ...parseUnifiedDiff(stdout), bytes: Buffer.byteLength(stdout, 'utf8'), source: 'gh-pr-diff' }
  } catch (error) {
    // `gh pr diff` refuses any PR with more than 300 changed files (HTTP 406
    // "too_large"), and the same limit applies to the diff media type. For those
    // the only route is the per-file endpoint, which returns each file's patch
    // hunks. Falling back keeps a big PR readable instead of turning the detail
    // view into an error page.
    if (!isDiffTooLarge(error)) throw error
    const { files, complete } = await readFilePatches(target, options)
    return {
      files,
      // `truncated` means "GitHub would not render this as one diff", which is
      // exactly the condition that got us here.
      truncated: true,
      complete,
      bytes: 0,
      source: 'rest-file-patches',
      note: complete
        ? 'This pull request has more changed files than GitHub will render as one diff; it was reassembled from per-file patches.'
        : 'This pull request has more changed files than GitHub will render as one diff, and more than this panel will page through; the list below is incomplete.',
    }
  }
}

/**
 * Was this failure the "too many files" refusal rather than a real error?
 *
 * `runGh` classifies a failure and hands back a content-free message, so the
 * original stderr — the only place `HTTP 406` and `too_large` appear — is gone
 * by the time we get here. The classifier therefore assigns its own code, and
 * this checks that code. The message pattern stays as a second line of defence
 * for errors that did not come from `runGh`.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
function isDiffTooLarge(error) {
  if (error?.code === 'diff-too-large') return true
  const message = String(error?.message ?? '')
  return /406|too_large|exceeded the maximum number of files|too large/i.test(message)
}

/**
 * Reassemble a diff from the per-file endpoint.
 *
 * Each item carries `patch`: a few `@@` hunks with `+`/`-`/context lines. Those
 * are turned back into "old text" and "new text" — removals plus context on one
 * side, additions plus context on the other — and `DiffBlock` re-derives the
 * same hunks from them. Context lines appear on both sides, which is why the
 * comparison lands on the right answer instead of a whole-file replacement.
 *
 * @param {{ owner: string, repo: string, number: number }} target
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<{ files: { path: string, oldText: string | null, newText: string | null }[], complete: boolean }>}
 */
async function readFilePatches(target, options) {
  /** @type {{ path: string, oldText: string | null, newText: string | null }[]} */
  const out = []
  // `per_page` is capped at 100 by the API regardless of what is asked for.
  // Twenty pages is 2000 files: past that the read is not a diff any more, and
  // the caller is told the list is incomplete rather than being handed a slice
  // that looks whole.
  const maxPages = 20
  let complete = false
  for (let page = 1; page <= maxPages; page += 1) {
    const items = await ghApiJson(
      `/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/pulls/${target.number}/files`,
      { query: { per_page: '100', page: String(page) }, signal: options.signal, timeoutMs: 30_000 },
    )
    if (!Array.isArray(items) || items.length === 0) {
      complete = true
      break
    }
    for (const item of items) {
      if (typeof item?.filename !== 'string') continue
      const status = typeof item?.status === 'string' ? item.status : 'modified'
      if (typeof item?.patch !== 'string') {
        // A binary file or one GitHub will not patch: name it, claim no content.
        out.push({ path: item.filename, oldText: null, newText: null })
        continue
      }
      const { oldText, newText } = patchToSides(item.patch)
      out.push({
        path: item.filename,
        oldText: status === 'added' ? null : oldText,
        newText: status === 'removed' ? null : newText,
      })
    }
    if (items.length < 100) {
      complete = true
      break
    }
  }
  return { files: out, complete }
}

/**
 * Turn `@@` patch hunks back into the two sides of a comparison.
 *
 * @param {string} patch
 * @returns {{ oldText: string, newText: string }}
 */
function patchToSides(patch) {
  const oldLines = []
  const newLines = []
  for (const line of patch.split('\n')) {
    if (line.startsWith('@@')) continue
    if (line.startsWith('\\')) continue
    if (line.startsWith('+')) newLines.push(line.slice(1))
    else if (line.startsWith('-')) oldLines.push(line.slice(1))
    else if (line.startsWith(' ')) {
      oldLines.push(line.slice(1))
      newLines.push(line.slice(1))
    }
  }
  return { oldText: oldLines.join('\n'), newText: newLines.join('\n') }
}

/**
 * Split a unified diff into one entry per file.
 *
 * `DiffBlock` reconstructs its own hunks from old/new text, so this returns the
 * *whole* old and new text per file with the patch markers stripped, plus the
 * context lines kept in order. It deliberately does not try to be a pixel-exact
 * patch reader: the goal is "show me what changed in this file", and the
 * primitive does the line-level comparison itself.
 *
 * A file that only appears on one side (added, deleted, renamed) gets `null` on
 * the missing side, which is what `DiffHunk` uses to distinguish "no prior
 * content" from "empty prior content".
 *
 * @param {string} patch
 * @returns {{ files: { path: string, oldText: string | null, newText: string }[], truncated: boolean }}
 */
export function parseUnifiedDiff(patch) {
  const files = []
  if (typeof patch !== 'string' || patch.length === 0) return { files, truncated: false }

  /** @type {{ path: string, oldLines: string[], newLines: string[], binary: boolean, added: boolean, deleted: boolean } | null} */
  let current = null
  // `--- a/x` and `+++ b/x` are file headers ONLY before the first hunk. Inside a
  // hunk the same text is ordinary content: a line added with `+++ increment`
  // means the new file contains `++ increment`. Treating every `+++ ` as a
  // header silently dropped such added lines from the diff.
  let inHunk = false

  const flush = () => {
    if (current === null) return
    files.push({
      path: current.path,
      // A binary file has no line content at all; `null` on both sides is more
      // honest than two empty strings, which would render as "no changes".
      oldText: current.binary || current.added ? null : current.oldLines.join('\n'),
      newText: current.binary || current.deleted ? null : current.newLines.join('\n'),
    })
    current = null
  }

  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git ')) {
      flush()
      const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line)
      current = {
        path: match === null ? line.slice('diff --git '.length).trim() : match[2],
        oldLines: [],
        newLines: [],
        binary: false,
        added: false,
        deleted: false,
      }
      inHunk = false
      continue
    }
    if (current === null) continue

    if (line.startsWith('new file mode')) {
      current.added = true
      continue
    }
    if (line.startsWith('deleted file mode')) {
      current.deleted = true
      continue
    }
    if (line.startsWith('Binary files ') || line.startsWith('GIT binary patch')) {
      current.binary = true
      continue
    }
    // Hunk headers, index lines and mode lines carry no content.
    if (
      line.startsWith('index ') ||
      (inHunk === false &&
        (line.startsWith('--- ') ||
          line.startsWith('+++ ') ||
          line.startsWith('old mode') ||
          line.startsWith('new mode') ||
          line.startsWith('similarity index') ||
          line.startsWith('rename from') ||
          line.startsWith('rename to'))) ||
      line.startsWith('\\ No newline')
    ) {
      continue
    }
    if (line.startsWith('@@')) {
      inHunk = true
      continue
    }

    if (line.startsWith('+')) current.newLines.push(line.slice(1))
    else if (line.startsWith('-')) current.oldLines.push(line.slice(1))
    else if (line.startsWith(' ')) {
      current.oldLines.push(line.slice(1))
      current.newLines.push(line.slice(1))
    }
  }
  flush()

  // GitHub truncates very large diffs; the marker is a plain sentence in the
  // body, and reporting it is better than showing a partial diff as complete.
  const truncated =
    /diff truncated|truncated the diff|use the API to fetch the diff/i.test(patch) ||
    patch.length > 1_500_000

  return { files, truncated }
}

/**
 * Inline review comments (the ones anchored to a diff line).
 *
 * These live at `pulls/{n}/comments`, not in `gh pr view --json comments`, so
 * they need their own call. Fetched with the REST API and paginated to a cap —
 * a very long review thread is not worth an unbounded number of requests.
 *
 * @param {{ owner: string, repo: string, number: number }} target
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object[]>}
 */
export async function readReviewComments(target, options = {}) {
  assertTarget(target)
  const items = await ghApiJson(
    `/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/pulls/${target.number}/comments`,
    { query: { per_page: '100' }, signal: options.signal },
  )
  if (!Array.isArray(items)) return []
  return items.map((item) => ({
    id: typeof item?.id === 'number' ? String(item.id) : null,
    author: item?.user?.login ?? null,
    authorAvatar: item?.user?.avatar_url ?? null,
    body: typeof item?.body === 'string' ? item.body : '',
    path: typeof item?.path === 'string' ? item.path : null,
    // `line` is the line in the new file; `original_line` is where it was before
    // a force-push. Preferring `line` keeps the comment attached to what the
    // reader can currently see.
    line: typeof item?.line === 'number' ? item.line : typeof item?.original_line === 'number' ? item.original_line : null,
    side: typeof item?.side === 'string' ? item.side : null,
    createdAt: item?.created_at ?? null,
    url: typeof item?.html_url === 'string' ? item.html_url : null,
  }))
}

/**
 * Guard the shape every call in this module needs.
 *
 * @param {unknown} target
 * @returns {asserts target is { owner: string, repo: string, number: number }}
 */
function assertTarget(target) {
  const t = /** @type {any} */ (target)
  if (t === null || typeof t !== 'object') throw new GhError('bad-request', 'No pull request was given.')
  if (typeof t.owner !== 'string' || t.owner.length === 0) throw new GhError('bad-request', 'Missing repository owner.')
  if (typeof t.repo !== 'string' || t.repo.length === 0) throw new GhError('bad-request', 'Missing repository name.')
  if (typeof t.number !== 'number' || !Number.isInteger(t.number) || t.number < 1) {
    throw new GhError('bad-request', 'The pull request number must be a positive integer.')
  }
  // Owner and repo become part of a `--repo` argument and a URL path. An owner
  // containing a slash would silently retarget the call at another repository,
  // so the shape is enforced rather than trusted.
  if (!/^[A-Za-z0-9_.-]+$/.test(t.owner) || !/^[A-Za-z0-9_.-]+$/.test(t.repo)) {
    throw new GhError('bad-request', 'Invalid repository owner or name.')
  }
}

/**
 * Coerce a count that GitHub may send as a number or omit.
 *
 * @param {unknown} value
 * @returns {number}
 */
function integerOr(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value))
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  return 0
}

/**
 * Parse a PR reference out of a pasted URL or shorthand.
 *
 * Accepts `https://github.com/owner/repo/pull/123`, the same with a `#discussion`
 * or `?query` tail, `owner/repo#123`, and a bare `#123` when a repository is
 * supplied separately. Returns `null` rather than throwing: a paste box that
 * rejects everything with an exception cannot show a useful inline error.
 *
 * @param {string} text
 * @param {{ owner?: string, repo?: string }} [fallback]
 * @returns {{ owner: string, repo: string, number: number } | null}
 */
export function parsePullReference(text, fallback = {}) {
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  if (trimmed.length === 0) return null

  // Full GitHub URL, with or without protocol, ignoring any tail after the number.
  //
  // Anchored on BOTH ends on purpose. An unanchored search accepts any string
  // that merely CONTAINS the path, so `javascript:github.com/o/r/pull/1`,
  // `https://github.com@evil.example/o/r/pull/1` and
  // `https://evil.example/github.com/o/r/pull/1` all resolved as if they were
  // GitHub links. The host has to be the whole authority, and the only thing
  // allowed after the number is a trailing path, query or fragment.
  const url = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/(\d+)(?:[/?#].*)?$/i.exec(
    trimmed,
  )
  if (url !== null) return { owner: url[1], repo: url[2], number: Number(url[3]) }

  // A path with no scheme and no host: `owner/repo/pull/123`.
  //
  // Kept as its own anchored branch rather than folded into the URL pattern,
  // because "no host at all" and "some other host" are different questions.
  // Pasting a GitHub URL with the scheme and host stripped is a common copy
  // accident and is safe to read as github.com; `javascript:github.com/…` and
  // `https://github.com@evil.example/…` both contain characters this anchor
  // refuses, so they stay rejected above.
  const path = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/(\d+)(?:[/?#].*)?$/.exec(trimmed)
  if (path !== null) return { owner: path[1], repo: path[2], number: Number(path[3]) }

  // `owner/repo#123`
  const shorthand = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)#(\d+)$/.exec(trimmed)
  if (shorthand !== null) return { owner: shorthand[1], repo: shorthand[2], number: Number(shorthand[3]) }

  // Bare `#123` or `123`, resolved against the repository already in view.
  const bare = /^#?(\d+)$/.exec(trimmed)
  if (bare !== null && typeof fallback.owner === 'string' && typeof fallback.repo === 'string') {
    return { owner: fallback.owner, repo: fallback.repo, number: Number(bare[1]) }
  }

  return null
}

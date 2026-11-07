/**
 * Which pull requests belong to me, in three separate senses.
 *
 * The three groups are not three views of one query. Authoring a PR, being asked
 * personally to review it, and being asked as a member of a team are three
 * different GitHub fields:
 *
 * - authored            → `author:@me`
 * - reviewRequested     → `review-requested:@me`
 * - teamReviewRequested → `team-review-requested:<org>/<team>` once per team
 *
 * A pull request can legitimately appear in more than one group, so the same PR
 * arriving twice is normal and is deduplicated by identity, not by title. When
 * team membership cannot be proven the group reports `unconfirmed` — which is a
 * third state, not an empty list. "I could not ask" must never render as
 * "there is nothing".
 *
 * Everything here is read-only.
 *
 * @module dsh-pr-release-workspace/lib/host/search
 */

import { ghApiJson, GhError, runGh } from './exec.js'

/**
 * GitHub's search API refuses to page past this many results. We surface the
 * limit rather than silently truncating, because a capped list presented as
 * complete is a lie the user would act on.
 */
export const SEARCH_RESULT_CAP = 1000

/**
 * How many teams get their own search in one refresh. An account can belong to
 * many teams; without a cap one refresh becomes dozens of API calls and burns
 * the rate limit that the rest of the panel needs.
 */
const MAX_TEAM_QUERIES = 6

/** The three groups the panel renders, in display order. */
export const GROUPS = Object.freeze([
  { key: 'authored', kind: 'author' },
  { key: 'reviewRequested', kind: 'personal' },
  { key: 'teamReviewRequested', kind: 'team' },
])

/**
 * The selection set for one search hit.
 *
 * Written out in full rather than assembled from a field list: a GraphQL query
 * built by string replacement is one rename away from being malformed, and a
 * malformed query fails at runtime with a message that says nothing useful.
 */
const SEARCH_SELECTION = `
  number
  title
  state
  isDraft
  url
  updatedAt
  createdAt
  reviewDecision
  author { login avatarUrl }
  repository { nameWithOwner url }
  comments { totalCount }
`

/**
 * Build one search query string.
 *
 * `sort:updated-desc` is included because GitHub's default is relevance, which
 * makes "most recently updated first" false for any query that matches a lot.
 *
 * @param {string} qualifier - e.g. `author:@me`.
 * @param {{ openOnly?: boolean }} [options]
 * @returns {string}
 */
export function buildSearchQuery(qualifier, options = {}) {
  const parts = ['is:pr', qualifier]
  if (options.openOnly !== false) parts.push('is:open')
  parts.push('sort:updated-desc')
  return parts.join(' ')
}

/**
 * Run one search and normalise the rows into the DTO the client consumes.
 *
 * @param {string} query
 * @param {object} [options]
 * @param {number} [options.first] - page size, clamped to 1..100.
 * @param {string} [options.after]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ items: object[], pageInfo: { hasNextPage: boolean, endCursor: string | null }, totalCount: number, capped: boolean }>}
 */
export async function searchPullRequests(query, options = {}) {
  const first = clampPageSize(options.first)
  const gql = `query($q: String!, $first: Int!, $after: String) {
    search(query: $q, type: ISSUE, first: $first, after: $after) {
      issueCount
      pageInfo { hasNextPage endCursor }
      nodes {
        ... on PullRequest { ${SEARCH_SELECTION} }
      }
    }
  }`

  const response = await graphql(gql, { q: query, first, after: options.after ?? null }, options.signal)
  const search = response?.data?.search
  if (search === null || search === undefined) {
    // GraphQL reports partial failures in `errors` while still returning data;
    // no `search` at all means the query itself was rejected.
    const first = Array.isArray(response?.errors) ? response.errors[0]?.message : null
    throw new GhError(
      'bad-response',
      typeof first === 'string' ? `GitHub rejected the search: ${first}` : 'GitHub returned no search payload.',
    )
  }

  const items = []
  for (const node of search.nodes ?? []) {
    const row = normaliseSearchNode(node)
    if (row !== null) items.push(row)
  }

  const totalCount = typeof search.issueCount === 'number' ? search.issueCount : 0
  return {
    items,
    pageInfo: {
      hasNextPage: Boolean(search.pageInfo?.hasNextPage),
      endCursor: search.pageInfo?.endCursor ?? null,
    },
    totalCount,
    capped: totalCount > SEARCH_RESULT_CAP,
  }
}

/**
 * Flatten one GraphQL search node.
 *
 * Returns `null` when a row is not a pull request with a resolvable repository.
 * With `is:pr` this should not happen; returning null keeps one odd row from
 * taking down the whole list.
 *
 * @param {any} node
 * @returns {object | null}
 */
function normaliseSearchNode(node) {
  if (node === null || typeof node !== 'object') return null
  const repo = node.repository?.nameWithOwner
  if (typeof repo !== 'string' || typeof node.number !== 'number') return null
  const slash = repo.indexOf('/')
  if (slash <= 0 || slash === repo.length - 1) return null
  const owner = repo.slice(0, slash)
  const name = repo.slice(slash + 1)

  return {
    host: 'github.com',
    owner,
    repo: name,
    repository: repo,
    number: node.number,
    // The identity key: host + owner + repo + number. Titles and SHAs are never
    // part of it — a force-push changes the SHA, not the pull request.
    key: `github.com/${owner}/${name}#${node.number}`,
    title: typeof node.title === 'string' ? node.title : '',
    state: typeof node.state === 'string' ? node.state.toLowerCase() : 'unknown',
    draft: node.isDraft === true,
    url: typeof node.url === 'string' ? node.url : '',
    updatedAt: node.updatedAt ?? null,
    createdAt: node.createdAt ?? null,
    author: node.author?.login ?? null,
    authorAvatar: node.author?.avatarUrl ?? null,
    reviewDecision: node.reviewDecision ?? null,
    commentCount: typeof node.comments?.totalCount === 'number' ? node.comments.totalCount : null,
  }
}

/**
 * Query all three groups in one refresh.
 *
 * Failures are per group: one team's query failing does not empty the others.
 *
 * @param {object} [options]
 * @param {number} [options.pageSize]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>}
 */
export async function searchAllGroups(options = {}) {
  const { pageSize, signal } = options

  const [viewer, teams] = await Promise.all([readViewer(signal), readTeams(signal)])

  /** @type {{ key: string, query: string }[]} */
  const jobs = [
    { key: 'authored', query: buildSearchQuery('author:@me') },
    { key: 'reviewRequested', query: buildSearchQuery('review-requested:@me') },
  ]
  for (const team of teams.confirmed.slice(0, MAX_TEAM_QUERIES)) {
    jobs.push({ key: 'teamReviewRequested', query: buildSearchQuery(`team-review-requested:${team}`) })
  }

  const settled = await Promise.allSettled(
    jobs.map((job) => searchPullRequests(job.query, { first: pageSize, signal })),
  )

  const groups = {}
  /** @type {object[]} */
  let teamItems = []
  let teamError = null
  let teamPage = null

  settled.forEach((result, index) => {
    const job = jobs[index]

    if (result.status === 'rejected') {
      const reason = result.reason
      const code = reason instanceof GhError ? reason.code : 'unknown'
      if (job.key === 'teamReviewRequested') {
        teamError = code
        return
      }
      groups[job.key] = failedGroup(job.key, code, reason)
      return
    }

    if (job.key === 'teamReviewRequested') {
      teamItems = teamItems.concat(result.value.items)
      if (teamPage === null) teamPage = result.value
      return
    }

    groups[job.key] = {
      key: job.key,
      status: 'ok',
      items: result.value.items,
      pageInfo: result.value.pageInfo,
      totalCount: result.value.totalCount,
      capped: result.value.capped,
      reason: null,
      message: null,
      teams: null,
    }
  })

  const deduped = dedupeByKey(teamItems)
  const teamCount = teams.confirmed.length
  groups.teamReviewRequested = {
    key: 'teamReviewRequested',
    // Three outcomes, three states: never asked (unconfirmed), asked and worked
    // (ok), asked and every ask failed (error).
    status: teamCount === 0 ? 'unconfirmed' : teamError !== null ? 'error' : 'ok',
    items: deduped,
    pageInfo: teamPage?.pageInfo ?? { hasNextPage: false, endCursor: null },
    totalCount: teamPage?.totalCount ?? deduped.length,
    capped: teamPage?.capped ?? false,
    reason:
      teamCount === 0 ? teams.reason : teamError !== null ? teamError : null,
    message:
      teamCount === 0
        ? 'Team membership could not be read, so team review requests cannot be queried.'
        : teamError !== null
          ? 'Every team review query failed.'
          : null,
    teams: teams.confirmed,
  }

  return {
    viewer,
    teams: { confirmed: teams.confirmed, reason: teams.reason },
    groups,
    // The same PR can match more than one group. Reporting the overlap lets the
    // panel label a row "in 2 lists" instead of silently showing it twice.
    overlaps: collectOverlaps(groups),
    observedAt: new Date().toISOString(),
  }
}

/**
 * The shape a group uses when its own query failed.
 *
 * @param {string} key
 * @param {string} code
 * @param {unknown} reason
 * @returns {object}
 */
function failedGroup(key, code, reason) {
  return {
    key,
    status: 'error',
    items: [],
    pageInfo: { hasNextPage: false, endCursor: null },
    totalCount: 0,
    capped: false,
    reason: code,
    message: reason instanceof GhError ? reason.message : 'The search failed.',
    teams: null,
  }
}

/**
 * Which identity keys appear in more than one group.
 *
 * @param {Record<string, { items?: object[] }>} groups
 * @returns {Record<string, string[]>}
 */
function collectOverlaps(groups) {
  /** @type {Map<string, string[]>} */
  const seen = new Map()
  for (const [groupKey, group] of Object.entries(groups)) {
    for (const item of group.items ?? []) {
      const list = seen.get(item.key)
      if (list === undefined) seen.set(item.key, [groupKey])
      else if (!list.includes(groupKey)) list.push(groupKey)
    }
  }
  /** @type {Record<string, string[]>} */
  const overlaps = {}
  for (const [key, list] of seen) {
    if (list.length > 1) overlaps[key] = list
  }
  return overlaps
}

/**
 * Deduplicate by identity key, keeping the most recently updated row.
 *
 * One search per team means a PR requested from two teams arrives twice; the
 * list must show it once, with the freshest title and timestamp.
 *
 * @param {object[]} items
 * @returns {object[]}
 */
function dedupeByKey(items) {
  /** @type {Map<string, object>} */
  const byKey = new Map()
  for (const item of items) {
    const existing = byKey.get(item.key)
    if (existing === undefined) {
      byKey.set(item.key, item)
      continue
    }
    const a = Date.parse(existing.updatedAt ?? '') || 0
    const b = Date.parse(item.updatedAt ?? '') || 0
    if (b > a) byKey.set(item.key, item)
  }
  return [...byKey.values()]
}

/**
 * The signed-in account, or why there is none.
 *
 * Returning a reason instead of throwing is deliberate: an unauthenticated host
 * is a normal, recoverable state that the panel shows with an instruction, not
 * an exception that blanks the whole view.
 *
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ login: string | null, name?: string | null, avatarUrl?: string | null, host: string, reason?: string }>}
 */
export async function readViewer(signal) {
  try {
    const data = await graphql('query { viewer { login name avatarUrl } }', {}, signal)
    const viewer = data?.data?.viewer
    if (viewer === null || viewer === undefined || typeof viewer.login !== 'string') {
      return { login: null, host: 'github.com', reason: 'bad-response' }
    }
    return {
      login: viewer.login,
      name: typeof viewer.name === 'string' ? viewer.name : null,
      avatarUrl: typeof viewer.avatarUrl === 'string' ? viewer.avatarUrl : null,
      host: 'github.com',
    }
  } catch (error) {
    return {
      login: null,
      host: 'github.com',
      reason: error instanceof GhError ? error.code : 'unknown',
    }
  }
}

/**
 * The teams the viewer belongs to, as `org/slug` strings.
 *
 * This uses the REST `/user/teams` endpoint rather than a GraphQL slice of
 * `viewer.organizations`: the REST endpoint is exactly "teams I am a member of",
 * which is the question `team-review-requested:` needs answered. Nested
 * `teams(first:, userLogins: [])` under a viewer does not mean that.
 *
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ confirmed: string[], reason: string | null }>}
 */
export async function readTeams(signal) {
  try {
    const teams = await ghApiJson('/user/teams', {
      query: { per_page: '100' },
      signal,
      timeoutMs: 20_000,
    })
    if (!Array.isArray(teams)) {
      return { confirmed: [], reason: 'bad-response' }
    }
    /** @type {string[]} */
    const confirmed = []
    for (const team of teams) {
      const org = team?.organization?.login
      const slug = team?.slug
      if (typeof org === 'string' && typeof slug === 'string') confirmed.push(`${org}/${slug}`)
    }
    if (confirmed.length === 0) return { confirmed: [], reason: 'no-team-membership' }
    return { confirmed, reason: null }
  } catch (error) {
    return { confirmed: [], reason: error instanceof GhError ? error.code : 'unknown' }
  }
}

/**
 * Run a GraphQL query through `gh`.
 *
 * Query text is assembled from constants in this module only; the values that
 * vary (search string, page size, cursor) travel as separate variables. That
 * separation is what makes injection impossible, so no caller may interpolate.
 *
 * @param {string} query
 * @param {Record<string, unknown>} [variables]
 * @param {AbortSignal} [signal]
 * @returns {Promise<any>}
 */
export async function graphql(query, variables = {}, signal) {
  const args = ['api', 'graphql', '--method', 'POST', '-f', `query=${query}`]
  for (const [key, value] of Object.entries(variables)) {
    if (value === null || value === undefined) continue
    // `gh` has two flags and they are not interchangeable: `-f` sends the value
    // as a JSON *string*, `-F` sends it typed. A GraphQL `Int!` variable passed
    // with `-f` fails with "Could not coerce value \"5\" to Int", so the flag has
    // to follow the value's own type.
    const typed = typeof value === 'number' || typeof value === 'boolean'
    args.push(typed ? '-F' : '-f', `${key}=${typed ? String(value) : String(value)}`)
  }
  const stdout = await runGh(args, { signal, timeoutMs: 30_000 })
  let payload
  try {
    payload = JSON.parse(stdout)
  } catch {
    throw new GhError('bad-response', 'GitHub returned a response that was not valid JSON.')
  }
  // GraphQL reports failure inside a 200 body. `gh` exits 0 for these, so a
  // successful process exit is not evidence the query worked.
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    const message = payload.errors[0]?.message
    throw new GhError(
      'bad-response',
      typeof message === 'string' ? `GitHub rejected the query: ${message}` : 'GitHub rejected the query.',
    )
  }
  return payload
}

/**
 * Clamp a page size to the range GitHub accepts.
 *
 * @param {unknown} value
 * @returns {number}
 */
function clampPageSize(value) {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 30
  if (n < 1) return 1
  return Math.min(n, 100)
}

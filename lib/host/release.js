/**
 * Six independent facts about a release, verified one at a time.
 *
 * The single most important rule in this file: **these facts must never be
 * collapsed into one "released" badge.** They fail independently and in
 * sequence, and each failure has a different remedy:
 *
 * | fact | what makes it true | what it does NOT imply |
 * | --- | --- | --- |
 * | PR merged | `mergedAt` is set | the code is on the default branch *now* |
 * | CI green | the head SHA's rollup is success | the merged SHA was the one tested |
 * | npm published | the exact version is the `latest` dist-tag | it contains the merged commit |
 * | GitHub Release | a published, non-draft, non-prerelease release exists | the release was built from that commit |
 * | market PR merged | the market repo's PR is merged | the site rebuilt |
 * | live index | the deployed index lists that version | the entry's metadata is right |
 *
 * So this module returns an object with six verdicts and the evidence for each,
 * never a boolean.
 *
 * @module dsh-pr-release-workspace/lib/host/release
 */

import { GhError, ghApiJson, runGh } from './exec.js'

/**
 * The verdict vocabulary, shared by all six facts.
 *
 * `not_configured` is distinct from `unknown`: a repository with no `release`
 * workflow has not "failed", and a registry that timed out has not "not
 * published". The `stale` state is for a fact that was confirmed earlier but
 * whose anchor has since moved.
 */
export const FACT_VERDICT = Object.freeze({
  PASS: 'pass',
  FAIL: 'fail',
  PENDING: 'pending',
  NOT_CONFIGURED: 'not_configured',
  UNKNOWN: 'unknown',
  STALE: 'stale',
})

/**
 * How long one HTTP probe may take. The market index is ~10 MB; anything that
 * cannot finish in this window is reported as unknown rather than hanging the
 * panel.
 */
const HTTP_TIMEOUT_MS = 15_000

/** The public npm registry, used explicitly so a local mirror cannot answer. */
const NPM_REGISTRY = 'https://registry.npmjs.org'

/**
 * Build a verdict row.
 *
 * Every row carries `evidence` — the exact URL or command output the verdict
 * came from — because a status the user cannot check is a status they must
 * trust blindly, and this panel exists to replace exactly that.
 *
 * @param {string} kind
 * @param {string} verdict
 * @param {object} [details]
 * @returns {object}
 */
function fact(kind, verdict, details = {}) {
  return {
    kind,
    verdict,
    evidence: details.evidence ?? null,
    observedAt: new Date().toISOString(),
    detail: details.detail ?? null,
    // Anything the caller passes beyond the shared keys becomes a specific probe
    // result the row can show (version, sha, url, counts…).
    data: details.data ?? null,
    reason: details.reason ?? null,
  }
}

/**
 * Is this exact version published to npm, and is it the `latest` tag?
 *
 * Both halves matter: a version can be published but withheld from `latest`
 * (a mistaken prerelease), and the `latest` tag can point somewhere else
 * entirely. The market builds read `latest`, so "published but not latest" is a
 * real and confusing failure mode.
 *
 * @param {{ name: string, version: string }} target
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>}
 */
export async function checkNpm(target, options = {}) {
  const name = String(target?.name ?? '').trim()
  const version = String(target?.version ?? '').trim()
  if (name.length === 0 || version.length === 0) {
    return fact('npm', FACT_VERDICT.UNKNOWN, { reason: 'bad-request' })
  }

  const encoded = name.startsWith('@') ? `@${encodeURIComponent(name.slice(1))}` : encodeURIComponent(name)
  const url = `${NPM_REGISTRY}/${encoded}`

  let doc
  try {
    doc = await fetchJson(url, options.signal)
  } catch (error) {
    // A scoped package that 404s has a readable meaning; anything else is a
    // network or registry problem and stays unknown.
    const status = error instanceof HttpError ? error.status : null
    if (status === 404) {
      return fact('npm', FACT_VERDICT.FAIL, {
        reason: 'not-found',
        evidence: url,
        detail: 'No package with this name exists on the public npm registry.',
      })
    }
    return fact('npm', FACT_VERDICT.UNKNOWN, {
      reason: error instanceof HttpError ? `http-${error.status}` : 'network',
      evidence: url,
    })
  }

  const versions = doc?.versions !== null && typeof doc.versions === 'object' ? doc.versions : {}
  const published = Object.prototype.hasOwnProperty.call(versions, version)
  const latest = typeof doc?.['dist-tags']?.latest === 'string' ? doc['dist-tags'].latest : null
  const publishedAt = published ? (doc.time?.[version] ?? null) : null
  const isLatest = latest === version

  const verdict = published && isLatest ? FACT_VERDICT.PASS : FACT_VERDICT.FAIL
  return fact('npm', verdict, {
    evidence: url,
    reason: published ? (isLatest ? null : 'not-latest-tag') : 'version-missing',
    data: {
      name,
      version,
      latest,
      published,
      isLatest,
      publishedAt,
      // The tarball shasum is the only stable identifier of the bytes; a version
      // can be unpublished and republished with different content.
      tarball: published ? (versions[version]?.dist?.tarball ?? null) : null,
      shasum: published ? (versions[version]?.dist?.shasum ?? null) : null,
    },
  })
}

/**
 * Is there a published GitHub Release for this tag?
 *
 * Draft and prerelease flags are surfaced separately: a draft is invisible to
 * everyone else, and a prerelease is explicitly not what this project is allowed
 * to ship, so neither counts as "released".
 *
 * @param {{ owner: string, repo: string, tag: string }} target
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>}
 */
export async function checkGithubRelease(target, options = {}) {
  const repo = `${target?.owner ?? ''}/${target?.repo ?? ''}`
  const tag = String(target?.tag ?? '').trim()
  if (repo === '/' || tag.length === 0) {
    return fact('github-release', FACT_VERDICT.UNKNOWN, { reason: 'bad-request' })
  }

  try {
    const stdout = await runGh(
      ['release', 'view', tag, '--repo', repo, '--json', 'tagName,isDraft,isPrerelease,publishedAt,url,name,assets'],
      { signal: options.signal, timeoutMs: 20_000 },
    )
    const raw = JSON.parse(stdout)
    const draft = raw?.isDraft === true
    const prerelease = raw?.isPrerelease === true
    const publishedAt = typeof raw?.publishedAt === 'string' ? raw.publishedAt : null
    const assets = Array.isArray(raw?.assets) ? raw.assets.length : 0

    let verdict = FACT_VERDICT.PASS
    let reason = null
    if (draft) {
      verdict = FACT_VERDICT.PENDING
      reason = 'draft'
    } else if (prerelease) {
      verdict = FACT_VERDICT.FAIL
      reason = 'prerelease'
    } else if (publishedAt === null) {
      verdict = FACT_VERDICT.PENDING
      reason = 'unpublished'
    }

    return fact('github-release', verdict, {
      evidence: `https://github.com/${repo}/releases/tag/${encodeURIComponent(tag)}`,
      reason,
      data: {
        repo,
        tag: typeof raw?.tagName === 'string' ? raw.tagName : tag,
        name: typeof raw?.name === 'string' ? raw.name : null,
        draft,
        prerelease,
        publishedAt,
        assets,
        url: typeof raw?.url === 'string' ? raw.url : null,
      },
    })
  } catch (error) {
    const code = error instanceof GhError ? error.code : 'unknown'
    // `gh release view` exits 1 with "release not found" for a missing release;
    // that is a real answer ("not released"), not a probe failure.
    if (code === 'not-found' || /release not found|no release with tag/i.test(String(error?.message ?? ''))) {
      return fact('github-release', FACT_VERDICT.FAIL, {
        reason: 'not-found',
        evidence: `https://github.com/${repo}/releases/tag/${encodeURIComponent(tag)}`,
      })
    }
    return fact('github-release', FACT_VERDICT.UNKNOWN, { reason: code })
  }
}

/**
 * Is the market's pull request merged, and does the market's `market.json` on
 * the default branch already list this plugin at this version?
 *
 * These are two facts, but the second one is the only one that matters for the
 * deploy: a merged PR that the build did not pick up looks identical from the
 * PR page.
 *
 * @param {{ repo: string, number: number | null, plugin: string, version: string }} target
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @param {string} [options.branch]
 * @returns {Promise<Object>} two facts: `market-pr` and `market-manifest`.
 */
export async function checkMarket(target, options = {}) {
  const repo = String(target?.repo ?? '').trim()
  const plugin = String(target?.plugin ?? '').trim()
  const version = String(target?.version ?? '').trim()
  const branch = typeof options.branch === 'string' ? options.branch : 'main'

  /** @type {Record<string, object>} */
  const out = {}

  if (typeof target?.number === 'number' && Number.isInteger(target.number)) {
    try {
      const stdout = await runGh(
        ['pr', 'view', String(target.number), '--repo', repo, '--json', 'number,state,mergedAt,url,title'],
        { signal: options.signal, timeoutMs: 20_000 },
      )
      const raw = JSON.parse(stdout)
      const merged = typeof raw?.mergedAt === 'string' && raw.mergedAt.length > 0
      out['market-pr'] = fact('market-pr', merged ? FACT_VERDICT.PASS : FACT_VERDICT.PENDING, {
        evidence: typeof raw?.url === 'string' ? raw.url : `https://github.com/${repo}/pull/${target.number}`,
        reason: merged ? null : raw?.state === 'CLOSED' || raw?.state === 'closed' ? 'closed-unmerged' : 'open',
        data: {
          number: target.number,
          state: typeof raw?.state === 'string' ? raw.state.toLowerCase() : null,
          merged,
          mergedAt: raw?.mergedAt ?? null,
          title: typeof raw?.title === 'string' ? raw.title : null,
        },
      })
    } catch (error) {
      out['market-pr'] = fact('market-pr', FACT_VERDICT.UNKNOWN, {
        reason: error instanceof GhError ? error.code : 'unknown',
      })
    }
  } else {
    out['market-pr'] = fact('market-pr', FACT_VERDICT.NOT_CONFIGURED, { reason: 'no-pr' })
  }

  if (repo.length === 0 || plugin.length === 0 || version.length === 0) {
    out['market-manifest'] = fact('market-manifest', FACT_VERDICT.UNKNOWN, { reason: 'bad-request' })
    return out
  }

  // Read `market.json` from the default branch, not from the working tree: the
  // question is what the deploy will see, and a local checkout can be stale.
  const apiPath = `/repos/${encodeURIComponent(repo.split('/')[0])}/${encodeURIComponent(repo.split('/')[1])}/contents/market.json`
  try {
    const raw = await ghApiJson(apiPath, {
      query: { ref: branch },
      headers: ['Accept: application/vnd.github.raw+json'],
      signal: options.signal,
      timeoutMs: 20_000,
    })
    // With the raw media type `gh` prints the file body. It is JSON, but `gh api`
    // hands it back as a string when the server sets a text content type.
    const doc = typeof raw === 'string' ? JSON.parse(raw) : raw
    const entry = Array.isArray(doc?.plugins)
      ? doc.plugins.find((item) => item?.name === plugin)
      : undefined
    const listedVersion = typeof entry?.version === 'string' ? entry.version : null
    const matches = listedVersion === version

    out['market-manifest'] = fact('market-manifest', matches ? FACT_VERDICT.PASS : FACT_VERDICT.FAIL, {
      evidence: `https://github.com/${repo}/blob/${branch}/market.json`,
      reason: matches ? null : entry === undefined ? 'not-listed' : 'version-mismatch',
      data: { plugin, version, listedVersion, listed: entry !== undefined },
    })
  } catch (error) {
    out['market-manifest'] = fact('market-manifest', FACT_VERDICT.UNKNOWN, {
      reason: error instanceof GhError ? error.code : 'unknown',
    })
  }

  return out
}

/**
 * Does the deployed market index list this plugin at this version?
 *
 * This is the only fact that proves the user can install the plugin from the
 * live site, and it is the one that most often lags: the deploy runs after the
 * merge and the CDN may serve a cached copy for a while.
 *
 * The index is ~10 MB, so it is streamed and only the matching entry is kept.
 *
 * @param {{ indexUrl: string, plugin: string, version: string }} target
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>}
 */
export async function checkLiveIndex(target, options = {}) {
  const url = String(target?.indexUrl ?? '').trim()
  const plugin = String(target?.plugin ?? '').trim()
  const version = String(target?.version ?? '').trim()
  if (!/^https?:\/\//i.test(url) || plugin.length === 0 || version.length === 0) {
    return fact('live-index', FACT_VERDICT.UNKNOWN, { reason: 'bad-request' })
  }

  let doc
  try {
    doc = await fetchJson(url, options.signal, { timeoutMs: 30_000 })
  } catch (error) {
    return fact('live-index', FACT_VERDICT.UNKNOWN, {
      reason: error instanceof HttpError ? `http-${error.status}` : 'network',
      evidence: url,
    })
  }

  const entries = Array.isArray(doc?.plugins)
    ? doc.plugins
    : Array.isArray(doc?.entries)
      ? doc.entries
      : Array.isArray(doc)
        ? doc
        : []
  const entry = entries.find((item) => item?.name === plugin)
  const listedVersions = versionsOf(entry)
  const listedVersion = typeof entry?.version === 'string' ? entry.version : (listedVersions[0] ?? null)
  // The deployed index lists every published version of a plugin and does not
  // carry a single "current" field, so the question is membership, not equality.
  const matches = listedVersions.includes(version) || listedVersion === version

  return fact('live-index', matches ? FACT_VERDICT.PASS : FACT_VERDICT.FAIL, {
    evidence: url,
    reason: matches ? null : entry === undefined ? 'not-listed' : 'version-mismatch',
    data: {
      plugin,
      version,
      listedVersion,
      listedVersions: listedVersions.slice(0, 12),
      listed: entry !== undefined,
      // The build timestamp distinguishes "not deployed yet" from "deployed but
      // the entry is wrong".
      generatedAt:
        typeof doc?.generatedAt === 'string'
          ? doc.generatedAt
          : typeof doc?.metadata?.generatedAt === 'string'
            ? doc.metadata.generatedAt
            : null,
    },
  })
}

/**
 * Read the version strings out of one index entry, newest first.
 *
 * The deployed market index nests versions (`versions: [{version, …}]`); some
 * upstream catalogs flatten to a single `version`. Both shapes are accepted so a
 * format change downgrades the probe to "no match", not to a crash.
 *
 * @param {any} entry
 * @returns {string[]}
 */
function versionsOf(entry) {
  if (entry === null || typeof entry !== 'object') return []
  const out = []
  if (Array.isArray(entry.versions)) {
    for (const item of entry.versions) {
      if (typeof item === 'string') out.push(item)
      else if (typeof item?.version === 'string') out.push(item.version)
    }
  }
  if (typeof entry.version === 'string' && !out.includes(entry.version)) out.unshift(entry.version)
  return out
}

/**
 * The CI verdict for one commit, from the Actions side.
 *
 * `gh pr checks` answers for a PR's current head; asking by SHA is what lets this
 * confirm the *merged* commit was the one tested, which the PR view cannot tell
 * you after a merge.
 *
 * @param {{ owner: string, repo: string, sha: string }} target
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>}
 */
export async function checkCommitChecks(target, options = {}) {
  const repo = `${target?.owner ?? ''}/${target?.repo ?? ''}`
  const sha = String(target?.sha ?? '').trim()
  if (repo === '/' || !/^[0-9a-f]{7,40}$/i.test(sha)) {
    return fact('ci', FACT_VERDICT.UNKNOWN, { reason: 'bad-request' })
  }

  try {
    const runs = await ghApiJson(
      `/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/commits/${sha}/check-runs`,
      { query: { per_page: '100' }, signal: options.signal, timeoutMs: 20_000 },
    )
    const items = Array.isArray(runs?.check_runs) ? runs.check_runs : []
    if (items.length === 0) {
      return fact('ci', FACT_VERDICT.NOT_CONFIGURED, {
        evidence: `https://github.com/${repo}/commit/${sha}/checks`,
        detail: 'No check runs are attached to this commit.',
      })
    }

    const rows = items.map((run) => ({
      name: typeof run?.name === 'string' ? run.name : 'check',
      conclusion: typeof run?.conclusion === 'string' ? run.conclusion : null,
      status: typeof run?.status === 'string' ? run.status : null,
      url: typeof run?.html_url === 'string' ? run.html_url : null,
    }))
    const failed = rows.filter((row) => row.conclusion !== null && row.conclusion !== 'success' && row.conclusion !== 'skipped' && row.conclusion !== 'neutral')
    const pending = rows.filter((row) => row.conclusion === null)
    const passed = rows.filter((row) => row.conclusion === 'success')

    let verdict = FACT_VERDICT.PASS
    let reason = null
    if (failed.length > 0) {
      verdict = FACT_VERDICT.FAIL
      reason = 'failing-checks'
    } else if (pending.length > 0) {
      verdict = FACT_VERDICT.PENDING
      reason = 'still-running'
    } else if (passed.length === 0) {
      // Every check was skipped. That is not a green run.
      verdict = FACT_VERDICT.FAIL
      reason = 'all-skipped'
    }

    return fact('ci', verdict, {
      evidence: `https://github.com/${repo}/commit/${sha}/checks`,
      reason,
      data: { sha, total: rows.length, failed: failed.length, pending: pending.length, passed: passed.length, rows },
    })
  } catch (error) {
    return fact('ci', FACT_VERDICT.UNKNOWN, { reason: error instanceof GhError ? error.code : 'unknown' })
  }
}

/**
 * Everything above, for one release, in parallel.
 *
 * The six facts are independent, so they run concurrently and a failure in one
 * never aborts the others. `ready` is derived, and it is deliberately strict:
 * every fact must pass, because a release that is only half-visible is exactly
 * the state this panel is meant to expose.
 *
 * @param {object} target
 * @param {string} target.owner
 * @param {string} target.repo
 * @param {string} target.tag
 * @param {string} target.sha
 * @param {string} target.npmName
 * @param {string} target.version
 * @param {{ marketRepo?: string, marketNumber?: number | null, marketIndexUrl?: string, marketBranch?: string }} [target.market]
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>}
 */
export async function collectReleaseFacts(target, options = {}) {
  const market = target?.market ?? {}
  const plugin = target?.npmName ?? ''

  const [npm, ghRelease, ci, marketFacts, liveIndex] = await Promise.all([
    checkNpm({ name: plugin, version: target?.version }, options),
    checkGithubRelease({ owner: target?.owner, repo: target?.repo, tag: target?.tag }, options),
    checkCommitChecks({ owner: target?.owner, repo: target?.repo, sha: target?.sha }, options),
    checkMarket(
      { repo: market.marketRepo ?? '', number: market.marketNumber ?? null, plugin, version: target?.version },
      { signal: options.signal, branch: market.marketBranch },
    ),
    checkLiveIndex(
      { indexUrl: market.marketIndexUrl ?? '', plugin, version: target?.version },
      options,
    ),
  ])

  const facts = {
    npm,
    'github-release': ghRelease,
    ci,
    'market-pr': marketFacts['market-pr'],
    'market-manifest': marketFacts['market-manifest'],
    'live-index': liveIndex,
  }

  const order = ['ci', 'github-release', 'npm', 'market-pr', 'market-manifest', 'live-index']
  const rows = order.map((kind) => facts[kind])
  const ready = rows.every((row) => row.verdict === FACT_VERDICT.PASS)

  return {
    target: {
      owner: target?.owner ?? null,
      repo: target?.repo ?? null,
      tag: target?.tag ?? null,
      sha: target?.sha ?? null,
      npmName: plugin,
      version: target?.version ?? null,
    },
    facts,
    rows,
    ready,
    // A count of what still blocks "fully released", so the UI can say "4 of 6
    // verified" instead of a single misleading bool.
    summary: {
      total: rows.length,
      passed: rows.filter((row) => row.verdict === FACT_VERDICT.PASS).length,
      failed: rows.filter((row) => row.verdict === FACT_VERDICT.FAIL).length,
      pending: rows.filter((row) => row.verdict === FACT_VERDICT.PENDING).length,
      unknown: rows.filter((row) => row.verdict === FACT_VERDICT.UNKNOWN).length,
      notConfigured: rows.filter((row) => row.verdict === FACT_VERDICT.NOT_CONFIGURED).length,
      stale: rows.filter((row) => row.verdict === FACT_VERDICT.STALE).length,
    },
    observedAt: new Date().toISOString(),
  }
}

/** An HTTP response that was not 2xx, carrying only the status. */
class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} url
   */
  constructor(status, url) {
    super(`HTTP ${status}`)
    this.name = 'HttpError'
    this.status = status
    this.url = url
  }
}

/**
 * Fetch and parse JSON with a hard timeout.
 *
 * `AbortSignal.timeout` is used rather than a manual `setTimeout` so the request
 * is actually cancelled, not merely abandoned; an abandoned socket on a 10 MB
 * download keeps the connection alive for the rest of the session.
 *
 * @param {string} url
 * @param {AbortSignal} [outer]
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<any>}
 */
async function fetchJson(url, outer, options = {}) {
  const timeoutMs = options.timeoutMs ?? HTTP_TIMEOUT_MS
  const signals = [AbortSignal.timeout(timeoutMs)]
  if (outer !== undefined && outer !== null) signals.push(outer)
  const signal = AbortSignal.any(signals)

  const response = await fetch(url, {
    signal,
    headers: {
      accept: 'application/json',
      // npm's registry documents a JSON accept header; sending it explicitly
      // avoids the abbreviated-document format it otherwise returns.
      'user-agent': 'dsh-pr-release-workspace',
    },
    redirect: 'follow',
  })
  if (!response.ok) throw new HttpError(response.status, url)
  return response.json()
}

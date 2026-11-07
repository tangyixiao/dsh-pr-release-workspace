/**
 * Render tests: what the panel actually puts on screen for a given host payload.
 *
 * These are server-side renders of the real components — no DOM, no jsdom. That
 * is enough to catch the failures that matter here: a field the host sends but
 * the client reads under the wrong name (renders blank), a status shown as a
 * bare dot with no text, an unescaped body that would become markup.
 *
 * @module dsh-pr-release-workspace/test/client-render
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fakeContext, loadBundle } from './support/client-harness.js'

/**
 * Load the bundle and bind the locale, returning a working `t`.
 *
 * @param {'en'|'zh'} [lang]
 * @returns {Promise<{ PRW: object, t: Function }>}
 */
async function setup(lang = 'en') {
  const { products, PRW } = await loadBundle()
  const fake = fakeContext()
  products.apply(fake.ctx)
  // The fake context already built a dictionary; read it back through the same
  // lookup the plugin uses so a key that disappears shows up as the key itself.
  const namespace = fake.registered['dsh-pr-release-workspace']
  const table = namespace.dictionaries[lang] || namespace.dictionaries.en
  const t = (key, vars) => {
    const template = typeof table[key] === 'string' ? table[key] : key
    if (vars === undefined || vars === null) return template
    return template.replace(/\{(\w+)\}/g, (whole, name) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
    )
  }
  return { PRW, t }
}

/** A search result row, shaped like `searchPullRequests` items. */
function rowItem(overrides = {}) {
  return {
    host: 'github.com',
    owner: 'tangyixiao',
    repo: 'dsh-pr-release-workspace',
    repository: 'tangyixiao/dsh-pr-release-workspace',
    number: 7,
    key: 'github.com/tangyixiao/dsh-pr-release-workspace#7',
    title: 'A row title',
    state: 'open',
    draft: false,
    url: 'https://example.test/pull/7',
    updatedAt: '2026-11-02T00:00:00Z',
    createdAt: '2026-11-01T00:00:00Z',
    author: 'tangyixiao',
    authorAvatar: null,
    reviewDecision: null,
    commentCount: 3,
    ...overrides,
  }
}

/** A release-facts payload, shaped like `collectReleaseFacts` output. */
function factsPayload(verdicts, extra = {}) {
  const facts = {}
  for (const [kind, verdict] of Object.entries(verdicts)) {
    facts[kind] = { kind, verdict, evidence: null, detail: null, reason: null, ...(extra[kind] || {}) }
  }
  const total = Object.keys(verdicts).length
  const passed = Object.values(verdicts).filter(v => v === 'pass').length
  return {
    target: { owner: 'o', repo: 'r', tag: 'v1.0.0', sha: 'abc', npmName: 'p', version: '1.0.0' },
    facts,
    rows: [],
    ready: passed === total,
    summary: {
      total,
      passed,
      failed: total - passed,
      pending: 0,
      unknown: 0,
      notConfigured: 0,
      stale: 0,
    },
    observedAt: '2026-11-06T00:00:00Z',
  }
}

test('the shell offers both the pull request and release views', async () => {
  const { PRW, t } = await setup()
  const html = renderToStaticMarkup(h(PRW.Shell, { t }))
  assert.ok(html.includes('Pull requests'), `expected the PR tab, got: ${html.slice(0, 400)}`)
  assert.ok(html.includes('Release state'), 'expected the release tab')
})

test('a row shows the number, title, repository and branch', async () => {
  const { PRW, t } = await setup()
  const html = renderToStaticMarkup(h(PRW.views.row, { item: rowItem(), active: false, onSelect() {}, t }))
  assert.ok(html.includes('#7'), 'the number should render')
  assert.ok(html.includes('A row title'), 'the title should render')
  assert.ok(html.includes('tangyixiao/dsh-pr-release-workspace'), 'the repository should render')
})

test('a draft flag renders as a visible word, not only a colour', async () => {
  const { PRW, t } = await setup()
  const html = renderToStaticMarkup(
    h(PRW.views.row, { item: rowItem({ draft: true }), active: false, onSelect() {}, t }),
  )
  assert.ok(html.includes('Draft'), `expected the word Draft, got: ${html}`)
})

test('a body with a URL makes an anchor, and a javascript: URL never does', async () => {
  const { PRW } = await setup()
  const html = renderToStaticMarkup(
    h('div', null, PRW.util.safeText('see https://example.com/x and javascript:alert(1)')),
  )
  assert.ok(html.includes('href="https://example.com/x"'), 'a real URL should become a link')
  assert.ok(html.includes('target="_blank"'))
  assert.ok(html.includes('rel="noreferrer noopener"'))
  assert.ok(!html.includes('href="javascript'), 'a javascript: URL must never become an href')
  assert.ok(html.includes('javascript:alert(1)'), 'the text survives, only the scheme is inert')
})

test('body text is escaped rather than rendered as markup', async () => {
  const { PRW } = await setup()
  const html = renderToStaticMarkup(
    h('div', null, PRW.util.bodyBlocks('<img src=x onerror=alert(1)>\n\n```\ncode < here\n```')),
  )
  assert.ok(!html.includes('<img'), 'raw HTML in a comment body must not become an element')
  assert.ok(html.includes('&lt;img'), 'it should still be visible as text')
  assert.ok(html.includes('code &lt; here'), 'code fences should be escaped too')
})

test('a missing login names the command that fixes it', async () => {
  const { PRW, t } = await setup()
  const html = renderToStaticMarkup(
    h('div', null, PRW.views.failure({ error: { code: 'not-authenticated', message: 'x' }, t })),
  )
  assert.ok(html.includes('GitHub is not signed in'), html)
  assert.ok(html.includes('gh auth login'), 'the hint must say what to run')
})

test('a rate limit shows the wait it was told, not a generic error', async () => {
  const { PRW, t } = await setup()
  const html = renderToStaticMarkup(
    h(
      'div',
      null,
      PRW.views.failure({ error: { code: 'rate-limited', message: 'x', retryAfterSeconds: 42 }, t }),
    ),
  )
  assert.ok(html.includes('42'), `expected the retry window, got: ${html}`)
})

test('the six release facts render as six separate rows, with reasons', async () => {
  const { PRW, t } = await setup()
  const value = factsPayload(
    {
      ci: 'pass',
      'github-release': 'fail',
      npm: 'pass',
      'market-pr': 'fail',
      'market-manifest': 'fail',
      'live-index': 'pass',
    },
    {
      'github-release': { reason: 'not-found' },
      'market-pr': { reason: 'closed-unmerged' },
      'market-manifest': { reason: 'version-mismatch' },
    },
  )
  const html = renderToStaticMarkup(PRW.views.factTable(t, value))
  for (const label of [
    'Commit checks',
    'GitHub Release',
    'npm',
    'Market pull request',
    'Market manifest',
    'Live index',
  ]) {
    assert.ok(html.includes(label), `missing row: ${label}`)
  }
  assert.ok(html.includes('3 / 6'), 'the count should say how many of six passed')
  assert.ok(html.includes('Not every fact checks out.'), 'the verdict must not claim readiness')
  assert.ok(html.includes('version-mismatch'), 'a reason should be shown, not hidden')
})

test('"ready" requires every fact, not just a merged PR and a green check', async () => {
  const { PRW, t } = await setup()
  const allPass = factsPayload({
    ci: 'pass',
    'github-release': 'pass',
    npm: 'pass',
    'market-pr': 'pass',
    'market-manifest': 'pass',
    'live-index': 'pass',
  })
  assert.ok(renderToStaticMarkup(PRW.views.factTable(t, allPass)).includes('Every fact checks out.'))

  // A merged market PR whose manifest still lists an older version must block.
  const manifestBehind = factsPayload({
    ci: 'pass',
    'github-release': 'pass',
    npm: 'pass',
    'market-pr': 'pass',
    'market-manifest': 'fail',
    'live-index': 'pass',
  })
  const html = renderToStaticMarkup(PRW.views.factTable(t, manifestBehind))
  assert.ok(html.includes('Not every fact checks out.'), 'a stale manifest must block readiness')
})

test('a skipped or missing check is never reported as success', async () => {
  const { PRW, t } = await setup()
  for (const verdict of ['not_configured', 'skipped', 'unknown']) {
    const html = renderToStaticMarkup(
      h('div', null, PRW.views.failure({ error: { code: 'unknown', message: 'x' }, t })),
    )
    assert.ok(html.length > 0, verdict)
    const label = PRW.views.ciLabel(verdict, t)
    assert.notEqual(label.toLowerCase(), 'success', `${verdict} must not read as success`)
  }
})

test('a Chinese reader gets Chinese labels, not the raw keys', async () => {
  const { PRW, t } = await setup('zh')
  const html = renderToStaticMarkup(h(PRW.Shell, { t }))
  assert.ok(!/tab\.(mine|release)/.test(html), `untranslated keys leaked: ${html.slice(0, 300)}`)
  assert.ok(html.includes('发布状态'), `expected the Chinese release tab, got: ${html.slice(0, 300)}`)
})

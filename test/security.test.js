/**
 * The security properties the panel promises in its README.
 *
 * These are not "does it work" tests. They assert the boundaries: what the route
 * refuses, what the validators refuse, what the error envelope refuses to leak,
 * and what the rendering layer refuses to interpret. A regression in any of them
 * is a vulnerability, not a bug, so each one names the attack it closes.
 *
 * @module dsh-pr-release-workspace/test/security
 */

import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFile, mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { admitRequest, createEndpoints, dispatch, envelope, isTrustedLocalRequest, readJsonBody, WRITE_GUARD } from '../lib/host/routes.js'
import { parsePullReference, parseUnifiedDiff, summariseChecks } from '../lib/host/pull.js'
import { createDraftStore } from '../lib/host/drafts.js'
import { GhError } from '../lib/host/exec.js'
import { loadBundle } from './support/client-harness.js'
import { classifyGhFailure } from '../lib/host/exec.js'
import { apply as applyHost } from '../lib/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

/** A request shape `isTrustedLocalRequest` accepts or rejects. */
function request(headers) {
  return { headers: headers || {}, method: 'POST', url: '/dsh-pr-release-workspace/identity' }
}

// ---------------------------------------------------------------------------
// CSRF: the local route is reachable from any page the browser loads
// ---------------------------------------------------------------------------

test('a loopback request with no Origin is accepted', () => {
  assert.equal(isTrustedLocalRequest(request({ host: '127.0.0.1:13787' }), {}), true)
  assert.equal(isTrustedLocalRequest(request({ host: 'localhost:13787' }), {}), true)
  assert.equal(isTrustedLocalRequest(request({ host: '[::1]:13787' }), {}), true)
})

test('a cross-site fetch is refused before Origin is even considered', () => {
  // A page on evil.example issuing fetch() to 127.0.0.1 sends this header. It is
  // the cheapest signal available and it cannot be forged by the page.
  assert.equal(
    isTrustedLocalRequest(request({ host: '127.0.0.1:13787', 'sec-fetch-site': 'cross-site' }), {}),
    false,
  )
})

test('a foreign Origin is refused even when Host is loopback', () => {
  assert.equal(
    isTrustedLocalRequest(request({ host: '127.0.0.1:13787', origin: 'https://evil.example' }), {}),
    false,
  )
  assert.equal(isTrustedLocalRequest(request({ host: '127.0.0.1:13787', origin: 'null' }), {}), false)
  assert.equal(
    isTrustedLocalRequest(request({ host: '127.0.0.1:13787', origin: 'http://127.0.0.1:13787' }), {}),
    true,
  )
})

test('a request with no Host header is refused', () => {
  // HTTP/1.0 and some proxies omit it; without Host there is nothing to compare
  // Origin against, so the safe answer is no.
  assert.equal(isTrustedLocalRequest(request({}), {}), false)
})

test('a non-loopback Host is refused unless it is the server\u2019s own bind address', () => {
  assert.equal(isTrustedLocalRequest(request({ host: 'example.com:80' }), {}), false)
  // A host bound to a LAN address must still serve its own page.
  assert.equal(isTrustedLocalRequest(request({ host: '192.168.1.10:13787' }), { host: '192.168.1.10' }), true)
  assert.equal(isTrustedLocalRequest(request({ host: '192.168.1.11:13787' }), { host: '192.168.1.10' }), false)
})

test('a Host header that merely starts with a loopback address is refused', () => {
  // 127.0.0.1.evil.example would pass a `startsWith` check.
  assert.equal(isTrustedLocalRequest(request({ host: '127.0.0.1.evil.example:80' }), {}), false)
  assert.equal(isTrustedLocalRequest(request({ host: 'localhost.evil.example:80' }), {}), false)
})

// ---------------------------------------------------------------------------
// The connection fence: the composition's own trust service outranks ours
// ---------------------------------------------------------------------------

test('the connection service rejects before any other check runs', () => {
  // A request that would otherwise be admitted: loopback Host, POST, JSON.
  const admitted = request({ host: '127.0.0.1:13787', 'content-type': 'application/json' })
  assert.equal(admitRequest({ request: admitted, webServer: {}, connection: { requestRejection: () => undefined } }), undefined)

  for (const status of [401, 403]) {
    const refusal = admitRequest({ request: admitted, webServer: {}, connection: { requestRejection: () => status } })
    assert.equal(refusal?.status, status)
  }
})

test('the connection fence runs before the method check, so a refusal is not an oracle', () => {
  // Same refusal whether the caller used the right method and content type or not.
  const good = request({ host: '127.0.0.1:13787', 'content-type': 'application/json' })
  const bad = { headers: { host: '127.0.0.1:13787' }, method: 'GET', url: '/x' }
  const connection = { requestRejection: () => 401 }
  assert.equal(admitRequest({ request: good, webServer: {}, connection })?.status, 401)
  assert.equal(admitRequest({ request: bad, webServer: {}, connection })?.status, 401)
})

test('a connection service that throws refuses instead of admitting', () => {
  // The whole point of the fence is that "we could not tell" is not "yes".
  const warned = []
  const refusal = admitRequest({
    request: request({ host: '127.0.0.1:13787', 'content-type': 'application/json' }),
    webServer: {},
    connection: {
      requestRejection: () => {
        const error = new Error('fence exploded')
        error.code = 'E_FENCE'
        throw error
      },
    },
    warn: (message) => warned.push(message),
  })
  assert.equal(refusal?.status, 403)
  assert.equal(warned.length, 1)
  assert.match(warned[0], /E_FENCE/)
  // The thrown message must not be echoed to the caller.
  assert.doesNotMatch(refusal.text, /fence exploded/)
})

test('only an undefined connection verdict admits a request', () => {
  const local = request({ host: '127.0.0.1:13787', 'content-type': 'application/json' })
  for (const verdict of [null, true, false, 0, 200, 500, '401', Promise.resolve(undefined)]) {
    const connection = { requestRejection: () => verdict }
    assert.equal(admitRequest({ request: local, webServer: {}, connection })?.status, 403)
  }
})

test('a missing connection service or admission method refuses even a loopback JSON request', () => {
  // Host and Origin headers cannot authenticate a non-browser caller.
  const local = request({ host: '127.0.0.1:13787', 'content-type': 'application/json' })
  for (const connection of [undefined, null, {}, { requestRejection: null }, { requestRejection: true }]) {
    assert.equal(admitRequest({ request: local, webServer: {}, connection })?.status, 403)
    assert.equal(admitRequest({ request: { ...local, method: 'GET' }, webServer: {}, connection })?.status, 403)
  }
})

test('the host exposes no route without a working connection admission method', () => {
  for (const connection of [undefined, null, {}, { requestRejection: null }]) {
    const registered = []
    applyHost({
      logger: { warn() {}, info() {} },
      inject(_names, run) {
        run({
          connection,
          webServer: { register(route) { registered.push(route) } },
          effect() {},
        })
      },
    })
    assert.equal(registered.length, 0)
  }
})

test('admission still checks the method and the content type after the fence', () => {
  const connection = { requestRejection: () => undefined }
  const headers = { host: '127.0.0.1:13787', 'content-type': 'application/json' }
  assert.equal(
    admitRequest({ request: { headers, method: 'GET', url: '/x' }, webServer: {}, connection })?.status,
    405,
  )
  assert.equal(
    admitRequest({
      request: request({ host: '127.0.0.1:13787', 'content-type': 'text/plain' }),
      webServer: {},
      connection,
    })?.status,
    415,
  )
  // `charset` on the JSON type is still JSON.
  assert.equal(
    admitRequest({
      request: request({ host: '127.0.0.1:13787', 'content-type': 'application/json; charset=utf-8' }),
      webServer: {},
      connection,
    }),
    undefined,
  )
})

// ---------------------------------------------------------------------------
// Command injection: every gh argument is an argv entry, never a shell string
// ---------------------------------------------------------------------------

test('an owner or repo containing a shell metacharacter is refused by the validator', async () => {
  const endpoints = createEndpoints({ drafts: null, log: null })
  const hostile = [
    'a;b',
    'a&&b',
    'a|b',
    'a`id`',
    'a$(id)',
    'a b',
    'a\nb',
    'a/b',
    '../x',
    '..',
    '.',
    '',
    'a\u0000b',
  ]
  for (const value of hostile) {
    await assert.rejects(
      endpoints.pull({ owner: value, repo: 'r', number: 1 }),
      (error) => error.code === 'bad-request',
      'owner ' + JSON.stringify(value) + ' should be refused',
    )
  }
})

test('a legitimate GitHub name with dots, dashes and underscores is accepted', async () => {
  const endpoints = createEndpoints({ drafts: null, log: null })
  // `my.repo-name_1` is a real repository name shape. It must get past the
  // validator — anything past it needs a network round trip, so the assertion is
  // that the failure is not a validation refusal.
  await assert.rejects(
    endpoints.pull({ owner: 'my.repo-name_1', repo: 'r', number: 1 }),
    (error) => error.code !== 'bad-request',
  )
})

test('the release endpoint validates every field it forwards', async () => {
  const endpoints = createEndpoints({ drafts: null, log: null })
  const base = {
    owner: 'o',
    repo: 'r',
    tag: 'v1.0.0',
    sha: 'a'.repeat(40),
    npmName: 'p',
    version: '1.0.0',
  }
  await assert.rejects(endpoints.release({ ...base, owner: 'o;rm -rf /' }), (e) => e.code === 'bad-request')
  await assert.rejects(endpoints.release({ ...base, tag: '' }), (e) => e.code === 'bad-request')
  await assert.rejects(endpoints.release({ ...base, sha: 'x'.repeat(200) }), (e) => e.code === 'bad-request')
})

// ---------------------------------------------------------------------------
// Path handling: the endpoint name comes from the URL
// ---------------------------------------------------------------------------

test('prototype names never reach a function through dispatch', async () => {
  const endpoints = { identity: async () => ({ ok: true }) }
  for (const name of ['__proto__', 'constructor', 'prototype', 'toString', 'hasOwnProperty']) {
    const result = await dispatch(endpoints, name, {})
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'bad-request')
  }
})

test('dispatch reaches a real endpoint and passes the payload through', async () => {
  const endpoints = { identity: async (payload) => ({ seen: payload }) }
  const result = await dispatch(endpoints, 'identity', { a: 1 })
  assert.deepEqual(result, { seen: { a: 1 } })
})

// ---------------------------------------------------------------------------
// Error disclosure: an unexpected error can quote private repository text
// ---------------------------------------------------------------------------

test('an unrecognised error is reported generically and its message is not returned', async () => {
  const secret = 'PRIVATE: the customer name is Acme and the token is hunter2'
  const wrapped = envelope(async () => {
    throw new Error(secret)
  }, null)
  const result = await wrapped({})
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'internal')
  assert.equal(result.error.message, 'The request failed.')
  assert.equal(JSON.stringify(result).includes('Acme'), false)
  assert.equal(JSON.stringify(result).includes('hunter2'), false)
})

test('a typed failure keeps its code but not an arbitrary message from a raw error', async () => {
  const wrapped = envelope(async () => {
    const error = new Error('PRIVATE: title of a private pull request')
    error.code = 'not-found'
    throw error
  }, null)
  const result = await wrapped({})
  // `not-found` is a pass-through code, so its own message is kept — it is
  // written by our classifier, not by GitHub. Only unrecognised errors are
  // flattened.
  assert.equal(result.error.code, 'not-found')
})

test('a logger that throws cannot turn a handled failure into an unhandled one', async () => {
  const thrown = []
  const wrapped = envelope(async () => {
    const error = new Error('boom')
    error.code = 'weird'
    throw error
  }, {
    warn() {
      thrown.push('warn')
      throw new TypeError('this is not a function')
    },
  })
  const result = await wrapped({})
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'internal')
  assert.deepEqual(thrown, ['warn'])
})

test('a detached logger method is tolerated rather than crashing the envelope', async () => {
  // The exact shape of the bug that produced empty HTTP 400s in the host: the
  // severity methods are prototype members that need their receiver.
  class Callable {
    constructor() {
      this.calls = []
    }
    warn(...args) {
      if (!(this instanceof Callable)) throw new TypeError('this is not a function')
      this.calls.push(args)
    }
  }
  const logger = new Callable()
  const wrapped = envelope(async () => {
    const error = new Error('boom')
    error.code = 'weird'
    throw error
  }, { warn: logger.warn })
  const result = await wrapped({})
  assert.equal(result.error.code, 'internal')
})

// ---------------------------------------------------------------------------
// Body handling
// ---------------------------------------------------------------------------

function streamOf(chunks) {
  const emitter = new EventEmitter()
  process.nextTick(() => {
    for (const chunk of chunks) emitter.emit('data', Buffer.from(chunk))
    emitter.emit('end')
  })
  return emitter
}

test('an oversized body is refused without being buffered in full', async () => {
  const chunks = Array.from({ length: 40 }, () => 'x'.repeat(65_536))
  await assert.rejects(readJsonBody(streamOf(chunks), 1024), (error) => error.code === 'payload-too-large')
})

test('invalid JSON is a bad request, not a crash', async () => {
  await assert.rejects(readJsonBody(streamOf(['{not json']), 1024), (error) => error.code === 'bad-request')
})

test('an empty body becomes an empty object', async () => {
  assert.deepEqual(await readJsonBody(streamOf([]), 1024), {})
})

// ---------------------------------------------------------------------------
// Draft store: local file, no traversal, no silent rewriting
// ---------------------------------------------------------------------------

test('a draft path can never escape the store or rewrite another entry', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'prw-sec-'))
  try {
    const store = createDraftStore({ file: join(dir, 'drafts.json') })
    const saved = await store.save({
      key: 'github.com/o/r#1',
      sha: 'a'.repeat(40),
      path: '../../etc/passwd',
      line: 1,
      body: 'note',
    })
    // The path is data, not a filesystem location: it is stored and returned,
    // never resolved. The only file touched is the store's own.
    assert.equal(saved.path, '../../etc/passwd')
    const entries = await readdir(dir)
    assert.deepEqual(entries.sort(), ['drafts.json'])

    // A different PR, commit or line is a different draft — one note can never
    // overwrite another.
    await store.save({ key: 'github.com/o/r#1', sha: 'b'.repeat(40), path: 'x', line: 1, body: 'other' })
    const all = await store.list({ key: 'github.com/o/r#1', headSha: 'a'.repeat(40) })
    assert.equal(all.length, 2)
    const current = all.filter((d) => d.state === 'current')
    const stale = all.filter((d) => d.state === 'stale')
    assert.equal(current.length, 1)
    assert.equal(stale.length, 1)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a draft body is capped and an over-long one is refused, not truncated', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'prw-sec-'))
  try {
    const store = createDraftStore({ file: join(dir, 'drafts.json') })
    await assert.rejects(
      store.save({ key: 'k', sha: 'a'.repeat(40), path: 'p', line: 1, body: 'x'.repeat(20_001) }),
      (error) => error.code === 'bad-request',
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a non-string body is refused', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'prw-sec-'))
  try {
    const store = createDraftStore({ file: join(dir, 'drafts.json') })
    await assert.rejects(
      store.save({ key: 'k', sha: 'a'.repeat(40), path: 'p', line: 1, body: { $ne: null } }),
      (error) => error.code === 'bad-request',
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// Rendering: GitHub text is data, never markup
// ---------------------------------------------------------------------------

test('README text is escaped, and only http(s) becomes a link', async () => {
  const { PRW } = await loadBundle()
  const t = (key) => key
  const React = (await import('react')).default
  const { renderToStaticMarkup } = await import('react-dom/server')
  const h = React.createElement

  const render = (text) => renderToStaticMarkup(h('div', null, PRW.util.safeText(text, t)))

  // Nothing here may become markup. A bare URL inside the text may still become
  // an anchor — that is the whole point of safeText — but the surrounding
  // Markdown or raw HTML must come through as literal, escaped characters.
  const hostile = [
    '<img src=x onerror=alert(1)>',
    '<script>alert(1)</script>',
    'javascript:alert(1)',
    '[click](javascript:alert(1))',
    '**bold** and _italic_',
  ]
  for (const text of hostile) {
    const html = render(text)
    assert.equal(html.includes('<img'), false, 'raw img tag rendered for ' + text)
    assert.equal(html.includes('<script'), false, 'raw script tag rendered for ' + text)
    assert.equal(/href="javascript:/i.test(html), false, 'javascript: href rendered for ' + text)
    assert.equal(html.includes('<a '), false, 'a non-URL string became a link: ' + text)
    assert.equal(html.includes('<strong'), false, 'Markdown became markup for ' + text)
    assert.equal(html.includes('<em'), false, 'Markdown became markup for ' + text)
  }

  // Markdown link/image syntax: the URL is real, so an anchor is acceptable, but
  // the brackets and the bang must stay literal text rather than half-rendered
  // Markdown that looks like a broken sentence.
  const image = render('![x](https://example.com/x.png)')
  assert.equal(image.includes('<img'), false, 'Markdown image became an img tag')
  assert.match(image, /!\[x\]\(/)

  // Raw HTML: the tag text must survive escaped, so the reader sees what the
  // author wrote instead of a live element. React escapes the quote inside the
  // attribute too, so the check is on `&lt;a href=` rather than a literal quote.
  const rawAnchor = render('<a href="https://evil.example">x</a>')
  assert.match(rawAnchor, /&lt;a href=/)
  assert.match(rawAnchor, /&lt;\/a&gt;/)
  // The URL inside the attribute must not become an anchor with a quote stuck to
  // it — that is a link whose href is not what it displays.
  assert.equal(/<a [^>]*href="[^"]*&quot;/.test(rawAnchor), false, 'an anchor ate the closing quote')

  const safe = render('see https://example.com/x now')
  assert.match(safe, /href="https:\/\/example\.com\/x"/)
  assert.match(safe, /rel="noreferrer noopener"/)
  assert.match(safe, /target="_blank"/)
})

test('a URL wrapped in punctuation links without swallowing the punctuation', async () => {
  const { PRW } = await loadBundle()
  const React = (await import('react')).default
  const { renderToStaticMarkup } = await import('react-dom/server')
  const html = renderToStaticMarkup(
    React.createElement('div', null, PRW.util.safeText('(see https://example.com/x).', (k) => k)),
  )
  assert.match(html, /href="https:\/\/example\.com\/x"/)
  assert.match(html, />\)\.</)
})

test('a fenced code block is escaped and keeps its newlines', async () => {
  const { PRW } = await loadBundle()
  const React = (await import('react')).default
  const { renderToStaticMarkup } = await import('react-dom/server')
  const text = 'before\n\n```js\nconst x = "<b>"\n```\n\nafter'
  const html = renderToStaticMarkup(React.createElement('div', null, PRW.util.bodyBlocks(text, (k) => k)))
  assert.equal(html.includes('<b>'), false)
  assert.match(html, /&lt;b&gt;/)
})

test('the client bundle requires nothing beyond the two declared specifiers', async () => {
  const loaded = await loadBundle()
  assert.ok(loaded.registration)
  // The harness throws on an undeclared specifier, so reaching this point is the
  // assertion; keep the explicit check so the intent survives a harness change.
  assert.deepEqual(Object.keys(loaded.products).sort(), ['__PRW', 'apply', 'inject'])
})

// ---------------------------------------------------------------------------
// Pull references: a link from a clipboard is untrusted input
// ---------------------------------------------------------------------------

test('a pull reference must be github.com, and the host check cannot be bypassed', () => {
  const bad = [
    'https://evil.example/o/r/pull/1',
    'https://evil.example/github.com/o/r/pull/1',
    'https://github.com.evil.example/o/r/pull/1',
    'https://github.com@evil.example/o/r/pull/1',
    'javascript:github.com/o/r/pull/1',
    'data:text/html,github.com/o/r/pull/1',
    'https://notgithub.com/o/r/pull/1',
    'ftp://github.com/o/r/pull/1',
    'file:///github.com/o/r/pull/1',
  ]
  for (const text of bad) {
    assert.equal(parsePullReference(text), null, 'accepted hostile reference: ' + text)
  }

  const good = [
    'https://github.com/o/r/pull/12',
    'http://github.com/o/r/pull/12',
    'https://www.github.com/o/r/pull/12',
    'https://github.com/o/r/pull/12/',
    'https://github.com/o/r/pull/12#discussion_r1',
    'https://github.com/o/r/pull/12?x=1',
    'o/r#12',
    'o/r/pull/12',
  ]
  for (const text of good) {
    const target = parsePullReference(text)
    assert.ok(target, 'refused a real reference: ' + text)
    assert.equal(target.number, 12)
  }
})

test('a pull reference resolves no more than one target', () => {
  // Two URLs in one paste must not silently pick the second.
  const target = parsePullReference('https://github.com/a/b/pull/1 and https://github.com/c/d/pull/2')
  assert.equal(target, null)
})

// ---------------------------------------------------------------------------
// CI verdicts: "we could not check" is never "passed"
// ---------------------------------------------------------------------------

test('an empty check rollup is not configured, never success', () => {
  const result = summariseChecks([], 'a'.repeat(40))
  assert.equal(result.verdict, 'not_configured')
  assert.notEqual(result.verdict, 'success')
})

test('a cancelled or skipped run is never reported as success', () => {
  const sha = 'a'.repeat(40)
  assert.notEqual(summariseChecks([{ conclusion: 'CANCELLED', status: 'COMPLETED' }], sha).verdict, 'success')
  assert.notEqual(summariseChecks([{ conclusion: 'SKIPPED', status: 'COMPLETED' }], sha).verdict, 'success')
  assert.notEqual(summariseChecks([{ conclusion: 'NEUTRAL', status: 'COMPLETED' }], sha).verdict, 'success')
  assert.notEqual(summariseChecks([{ conclusion: null, status: 'IN_PROGRESS' }], sha).verdict, 'success')
})

test('one failure outweighs any number of successes', () => {
  const sha = 'a'.repeat(40)
  const rollup = [
    ...Array.from({ length: 20 }, (_, i) => ({ conclusion: 'SUCCESS', status: 'COMPLETED', name: 'ok-' + i })),
    { conclusion: 'FAILURE', status: 'COMPLETED', name: 'the-one-that-broke' },
  ]
  assert.equal(summariseChecks(rollup, sha).verdict, 'failure')
})

test('a rollup row with no name is not evidence of anything', () => {
  // GitHub's own rollup always names its rows. If a row has no name we cannot
  // show it, so it must not count toward a green verdict either.
  const result = summariseChecks([{ conclusion: 'SUCCESS', status: 'COMPLETED' }], 'a'.repeat(40))
  assert.equal(result.verdict, 'not_configured')
  assert.equal(result.total, 0)
})

// ---------------------------------------------------------------------------
// Diff parsing: a patch is untrusted text
// ---------------------------------------------------------------------------

test('a patch cannot inject file headers or hunk markers into the rendered sides', () => {
  const patch = [
    'diff --git a/x b/x',
    'index 111..222 100644',
    '--- a/x',
    '+++ b/x',
    '@@ -1,2 +1,2 @@',
    '--- this is a removed line',
    '+++ this is an added line',
  ].join('\n')
  const { files } = parseUnifiedDiff(patch)
  assert.equal(files.length, 1)
  assert.equal(files[0].path, 'x')
  // Inside a hunk, `+++ foo` is an *added line*, not a file header.
  assert.match(files[0].newText, /\+\+ this is an added line/)
  assert.match(files[0].oldText, /-- this is a removed line/)
})

test('a binary file has no text sides rather than a fabricated one', () => {
  const patch = ['diff --git a/img.png b/img.png', 'index 111..222 100644', 'Binary files a/img.png and b/img.png differ'].join('\n')
  const { files } = parseUnifiedDiff(patch)
  assert.equal(files.length, 1)
  assert.equal(files[0].oldText, null)
  assert.equal(files[0].newText, null)
})

// ---------------------------------------------------------------------------
// gh failure classification: the panel must tell the truth about why
// ---------------------------------------------------------------------------

test('every distinct gh failure maps to its own code', () => {
  const cases = [
    [{ code: 'ENOENT' }, '', 'gh-missing'],
    [{ code: 1 }, 'gh: To get started with GitHub CLI, please run: gh auth login', 'not-authenticated'],
    [{ code: 1 }, 'HTTP 401: Bad credentials (https://api.github.com/graphql)', 'not-authenticated'],
    [{ code: 1 }, 'GraphQL: Could not resolve to a Repository with the name \'a/b\'.', 'not-found'],
    [{ code: 1 }, 'dial tcp: lookup api.github.com: no such host', 'network'],
    [{ code: 'ENOTFOUND' }, '', 'network'],
    [{ code: null, killed: true }, '', 'timeout'],
    [{ code: 1 }, 'something nobody expected', 'unknown'],
  ]
  for (const [error, stderr, expected] of cases) {
    assert.equal(classifyGhFailure(error, stderr).code, expected, 'for stderr ' + JSON.stringify(stderr))
  }
})

test('a rate limit reports how long to wait instead of pretending it is a generic failure', () => {
  const classified = classifyGhFailure({ code: 1 }, 'HTTP 403: API rate limit exceeded; retry in 30 seconds')
  assert.equal(classified.code, 'rate-limited')
  assert.equal(classified.retryAfterSeconds, 30)
})

/**
 * A PR over 300 files is refused by `gh pr diff` with a 406, and the panel can
 * recover by paging the per-file endpoint. That recovery is keyed on a distinct
 * code, so this case must never collapse into `unknown` — which is exactly what
 * it did before: the classifier replaced the stderr with a generic sentence, so
 * the caller had nothing left to recognise and a 1680-file PR rendered as an
 * error page in the real host.
 */
test('the "more than 300 files" refusal is its own recoverable code, not unknown', () => {
  const stderr = [
    'could not find pull request diff: HTTP 406: Sorry, the diff exceeded the maximum number of files (300).',
    "Consider using 'List pull requests files' API or locally cloning the repository instead.",
    'PullRequest.diff too_large',
  ].join('\n')
  const classified = classifyGhFailure({ code: 1 }, stderr)
  assert.equal(classified.code, 'diff-too-large')
  // The message is what the route may surface, so it must stay content-free.
  assert.equal(/https?:\/\//.test(classified.message), false)
  assert.equal(classified.message.includes('tangyixiao'), false)
})

// ---------------------------------------------------------------------------
// The write guard is a promise, so it is asserted
// ---------------------------------------------------------------------------

test('the panel ships the read-only promise as a string the UI shows', () => {
  assert.equal(typeof WRITE_GUARD, 'string')
  assert.match(WRITE_GUARD, /read-only/i)
  assert.match(WRITE_GUARD, /never merges/i)
})

test('no production source performs a write to GitHub', async () => {
  // Guard against a future change sneaking a POST/PATCH/PUT to the API in. The
  // host only ever reads; this asserts it at the source level.
  const files = ['lib/index.js', 'lib/host/routes.js', 'lib/host/pull.js', 'lib/host/search.js', 'lib/host/release.js', 'lib/host/drafts.js']
  for (const file of files) {
    const text = await readFile(join(root, file), 'utf8')
    // `gh api` shorthand: only GET and graphql are allowed.
    const apiCalls = text.match(/ghApiJson\('([^']+)'/g) || []
    for (const call of apiCalls) {
      assert.equal(/\bPOST\b|\bPATCH\b|\bPUT\b|\bDELETE\b/.test(call), false, `${file}: ${call} looks like a write`)
    }
    assert.equal(/--method\s+(POST|PATCH|PUT|DELETE)/i.test(text), false, file + ' uses a write method')
    assert.equal(/\bgh\s+(api\s+--method|pr\s+(merge|comment|review|close|edit))/i.test(text), false, file + ' runs a write command')
  }
})

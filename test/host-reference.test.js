/**
 * The pull-request reference parser.
 *
 * `parsePullReference` is fed whatever the user pastes into the box, and its two
 * jobs pull in opposite directions: accept every shape a person actually copies
 * out of GitHub, and refuse everything else. It deliberately returns `null`
 * instead of throwing, so "that is not a pull request link" is asserted twice
 * here: once on the parser (null) and once through the route (`bad-request`),
 * because the error code is what the client switches on.
 *
 * @module dsh-pr-release-workspace/test/host-reference
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createEndpoints } from '../lib/host/routes.js'
import { parsePullReference } from '../lib/host/pull.js'

/** A quiet logger: these tests must not print, and nothing here reads the log. */
const log = { debug() {}, info() {}, warn() {}, error() {} }

/** The resolve endpoint, wrapped in its envelope exactly as the route serves it. */
async function resolve(text, extra = {}) {
  const { resolve: endpoint } = createEndpoints({ drafts: {}, log })
  const { envelope } = await import('../lib/host/routes.js')
  return envelope(endpoint, log)({ text, ...extra }, {})
}

const TARGET = { owner: 'owner', repo: 'repo', number: 123 }

test('a full github.com pull URL resolves to its owner, repo and number', async () => {
  assert.deepEqual(parsePullReference('https://github.com/owner/repo/pull/123'), TARGET)

  const response = await resolve('https://github.com/owner/repo/pull/123')
  assert.equal(response.ok, true)
  assert.deepEqual(response.value.target, TARGET)
})

test('a pull URL with a trailing slash, query or fragment still resolves', () => {
  for (const text of [
    'https://github.com/owner/repo/pull/123/',
    'https://github.com/owner/repo/pull/123?diff=split',
    'https://github.com/owner/repo/pull/123#discussion_r123456',
    'https://github.com/owner/repo/pull/123/files#diff-abc',
    '  https://github.com/owner/repo/pull/123  ',
    'http://github.com/owner/repo/pull/123',
    'https://www.github.com/owner/repo/pull/123',
  ]) {
    assert.deepEqual(parsePullReference(text), TARGET, `should resolve: ${text}`)
  }
})

test('the owner/repo#123 shorthand resolves', () => {
  assert.deepEqual(parsePullReference('owner/repo#123'), TARGET)
  assert.deepEqual(parsePullReference('my-org/my_repo.v2#7'), {
    owner: 'my-org',
    repo: 'my_repo.v2',
    number: 7,
  })
})

test('a bare #123 resolves against the repository already in view', () => {
  assert.deepEqual(parsePullReference('#123', { owner: 'owner', repo: 'repo' }), TARGET)
  assert.deepEqual(parsePullReference('123', { owner: 'owner', repo: 'repo' }), TARGET)
})

test('a bare number without a repository to fall back on is refused', async () => {
  assert.equal(parsePullReference('123'), null)
  assert.equal(parsePullReference('#123'), null)

  const response = await resolve('123')
  assert.equal(response.ok, false)
  assert.equal(response.error.code, 'bad-request')
})

test('the owner/repo/pull/123 form resolves', () => {
  // Required by the panel's contract: pasting a link stripped of its scheme and
  // host is a common copy/paste accident, and the resolve endpoint is where it
  // should be recovered.
  assert.deepEqual(parsePullReference('owner/repo/pull/123'), TARGET)
})

test('free text that is not a pull reference is refused with a bad-request code', async () => {
  for (const text of ['hello world', 'see the PR please', '../..', '#', 'pull/123', 'https://github.com/owner/repo/issues/123']) {
    assert.equal(parsePullReference(text), null, `parser should refuse: ${text}`)

    const response = await resolve(text)
    assert.equal(response.ok, false, `route should refuse: ${text}`)
    assert.equal(response.error.code, 'bad-request', `route should report bad-request for: ${text}`)
  }
})

test('a script URL is refused rather than parsed', async () => {
  assert.equal(parsePullReference('javascript:alert(1)'), null)

  const response = await resolve('javascript:alert(1)')
  assert.equal(response.ok, false)
  assert.equal(response.error.code, 'bad-request')
})

test('an issue URL is not mistaken for a pull request', () => {
  assert.equal(parsePullReference('https://github.com/owner/repo/issues/123'), null)
})

// ---------------------------------------------------------------------------
// BUG (lib/host/pull.js:719-721): the URL regex is applied to the whole trimmed
// string with no `^` anchor and no host boundary, so any string *containing*
// `github.com/<owner>/<repo>/pull/<n>` is accepted — including one whose real
// host is a different site. The route then reports `ok: true` for a link that
// does not point at GitHub. The tests below pin the safe behaviour.
// ---------------------------------------------------------------------------

test('a URL whose real host is not github.com is not accepted as a pull reference', () => {
  for (const text of [
    'https://notgithub.com/owner/repo/pull/123',
    'https://github.com.evil.example/owner/repo/pull/123',
    'https://evil.example/github.com/owner/repo/pull/123',
    'https://github.com@evil.example/owner/repo/pull/123',
  ]) {
    assert.equal(parsePullReference(text), null, `must not resolve a foreign host: ${text}`)
  }
})

test('a script URL that embeds a pull path is refused', () => {
  assert.equal(parsePullReference('javascript:github.com/owner/repo/pull/123'), null)
})

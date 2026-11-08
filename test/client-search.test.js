/**
 * The search box takes two different kinds of input.
 *
 * A pasted pull request reference and a search phrase are not the same request:
 * the search API returns nothing for a URL, so a paste has to go through the
 * host's `resolve` endpoint first. These tests pin the client-side half of that
 * decision — which request gets made for which input — because the failure mode
 * found on a real host was a paste that searched and reported "no matches"
 * while the code below it could resolve perfectly well.
 *
 * `looksLikeReference` is only a routing hint. The host owns the real parsing
 * and still refuses anything that is not a reference, so a wrong guess here
 * costs one round trip and then falls back to search. It never lets a
 * non-reference through as a target.
 *
 * @module dsh-pr-release-workspace/test/client-search
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadBundle } from './support/client-harness.js'

/** Load the bundle and return its `looksLikeReference`. */
async function predicate() {
  const { PRW } = await loadBundle()
  return PRW.util.looksLikeReference
}

test('every shape the host accepts as a reference is sent to resolve', async () => {
  const looksLikeReference = await predicate()
  for (const text of [
    'https://github.com/owner/repo/pull/123',
    'http://github.com/owner/repo/pull/123',
    'https://www.github.com/owner/repo/pull/123',
    'https://github.com/owner/repo/pull/123/',
    'https://github.com/owner/repo/pull/123?diff=split',
    'https://github.com/owner/repo/pull/123#discussion_r1',
    '  https://github.com/owner/repo/pull/123  ',
    'owner/repo/pull/123',
    'owner/repo#123',
    'my-org/my_repo.v2#7',
  ]) {
    assert.equal(looksLikeReference(text), true, `should resolve rather than search: ${text}`)
  }
})

test('bare numbers are offered to resolve so a repository in view can claim them', async () => {
  const looksLikeReference = await predicate()
  // The client cannot know whether a repository is in view, so it asks. With
  // none, the host answers bad-request and the caller falls back to search.
  assert.equal(looksLikeReference('123'), true)
  assert.equal(looksLikeReference('#123'), true)
})

test('free text is searched, never resolved', async () => {
  const looksLikeReference = await predicate()
  for (const text of [
    'fix login',
    'author:@me',
    'review-requested:me is:open',
    'owner/repo',
    '#',
    'pull/123',
    'https://github.com/owner/repo/issues/123',
    'https://example.test/owner/repo/pull/123',
    'notgithub.com/owner/repo/pull/123',
  ]) {
    assert.equal(looksLikeReference(text), false, `should search rather than resolve: ${text}`)
  }
})

test('an empty or non-string query is not a reference', async () => {
  const looksLikeReference = await predicate()
  for (const value of ['', '   ', null, undefined, 123, {}]) {
    assert.equal(looksLikeReference(value), false, `must not treat as reference: ${String(value)}`)
  }
})

test('a URL whose real host is not github.com is never routed to resolve', async () => {
  const looksLikeReference = await predicate()
  // The host refuses these too; the point is that the client does not even ask
  // about them, so a control-character or userinfo trick cannot reach parsing.
  for (const text of [
    'https://github.com.evil.example/owner/repo/pull/123',
    'https://github.com@evil.example/owner/repo/pull/123',
    'https://evil.example/github.com/owner/repo/pull/123',
    'javascript:github.com/owner/repo/pull/123',
    'javascript:alert(1)',
  ]) {
    assert.equal(looksLikeReference(text), false, `must not resolve: ${text}`)
  }
})

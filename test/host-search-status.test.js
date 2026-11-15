import assert from 'node:assert/strict'
import test from 'node:test'
import { normaliseSearchNode } from '../lib/host/search.js'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadBundle } from './support/client-harness.js'

const base = { number: 7, title: 'PR', state: 'OPEN', repository: { nameWithOwner: 'o/r' } }
const commit = (nodes, extra = {}) => ({ commits: { nodes: [{ commit: { oid: 'sha', statusCheckRollup: {
  contexts: { nodes, totalCount: nodes.length, ...extra },
} } }] } })

test('list CI reads both check runs and legacy contexts at the current commit', () => {
  const item = normaliseSearchNode({ ...base, ...commit([
    { name: 'test', conclusion: 'SUCCESS' }, { context: 'deploy', state: 'PENDING' },
  ]) })
  assert.equal(item.ci.verdict, 'pending')
  assert.equal(item.ci.counts.success, 1)
  assert.equal(item.ci.headSha, 'sha')
})

test('missing commit and truncated context pages cannot claim passing CI', () => {
  assert.equal(normaliseSearchNode(base).ci.verdict, 'unknown')
  const node = { ...base, ...commit([{ name: 'test', conclusion: 'SUCCESS' }], { pageInfo: { hasNextPage: true } }) }
  assert.equal(normaliseSearchNode(node).ci.verdict, 'unknown')
  node.commits.nodes[0].commit.statusCheckRollup.contexts.nodes[0].conclusion = 'FAILURE'
  assert.equal(normaliseSearchNode(node).ci.verdict, 'failure')
})

test('known empty checks are unconfigured; merged state is preserved without a timestamp', () => {
  assert.equal(normaliseSearchNode({ ...base, ...commit([]) }).ci.verdict, 'not_configured')
  const item = normaliseSearchNode({ ...base, state: 'MERGED' })
  assert.equal(item.merged, true)
  assert.equal(item.state, 'merged')
})

test('old hosts show readable PR, CI and review states instead of invisible dots or symbols', async () => {
  const { PRW } = await loadBundle({ primitives: {} })
  const t = key => PRW.dicts.zh[key]
  const item = normaliseSearchNode({ ...base, state: 'MERGED', reviewDecision: 'APPROVED',
    ...commit([{ name: 'test', conclusion: 'SUCCESS' }]) })
  const html = renderToStaticMarkup(h(PRW.views.row, { item, t, onSelect() {} }))
  assert.match(html, /prw-prIcon/)
  assert.match(html, /<svg/)
  for (const text of ['已合并', '检查通过', '审查已通过']) assert.ok(html.includes(text), text)
  const unknown = renderToStaticMarkup(PRW.views.stateBadge({ pr: { state: 'unknown' }, t }))
  assert.ok(unknown.includes('PR 状态未读取'))
  assert.ok(!unknown.includes('进行中'))
})

test('closed draft PRs use the closed lifecycle icon, while merged PRs override the draft flag', async () => {
  const { PRW } = await loadBundle({ primitives: {} })
  const t = key => PRW.dicts.zh[key]
  const closed = normaliseSearchNode({ ...base, state: 'CLOSED', isDraft: true })
  const merged = normaliseSearchNode({ ...base, state: 'MERGED', isDraft: true })
  const render = item => renderToStaticMarkup(h(PRW.views.row, { item, t, onSelect() {} }))
  assert.match(render(closed), /class="prw-prIcon" data-state="closed"/)
  assert.match(render(merged), /class="prw-prIcon" data-state="merged"/)
})

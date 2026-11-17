import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadBundle } from './support/client-harness.js'

test('the state selector names every lifecycle and forwards the selected value', async () => {
  const { PRW } = await loadBundle()
  let selected = null
  const control = PRW.views.stateFilter({ t: key => PRW.dicts.zh[key], value: 'all', onChange: value => { selected = value } })
  const html = renderToStaticMarkup(control)
  for (const label of ['PR 状态', '全部状态', '开放中', '已合并', '已关闭（未合并）']) assert.ok(html.includes(label))
  assert.match(html, /value="all" selected=""/)
  control.props.children[1].props.onChange({ target: { value: 'merged' } })
  assert.equal(selected, 'merged')
})

test('the default list includes history and a filter change reaches both groups and text search', async () => {
  const { registration } = await loadBundle()
  const states = [], callbacks = [], calls = []
  let cursor = 0
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++
      if (!(index in states)) states[index] = initial
      return [states[index], value => { states[index] = value }]
    },
    useCallback: fn => fn,
    useEffect() {},
  }
  const { __PRW: PRW } = registration.factory(name => name === 'react' ? hooks : {})
  PRW.useIdentity = () => ({ state: { status: 'ready', value: { viewer: { login: 'test' } } } })
  PRW.useRequest = run => { callbacks.push(run); return { state: { status: 'ready', value: { groups: {}, items: [] } }, reload() {} } }
  PRW.usePolling = () => {}
  PRW.util.call = async (route, payload) => { calls.push({ route, payload }); return {} }
  const t = key => PRW.dicts.zh[key]
  function render() { cursor = 0; callbacks.length = 0; return PRW.Workspace({ t }) }
  const tree = render()
  await callbacks[1]()
  assert.equal(calls.at(-1).payload.state, 'all')
  const controls = tree.props.children[1]
  const selector = controls.props.children[1].props.children[1]
  selector.props.onChange({ target: { value: 'merged' } })
  render()
  await callbacks[1]()
  assert.equal(calls.at(-1).route, 'groups')
  assert.equal(calls.at(-1).payload.state, 'merged')
  states[3] = 'fix rendering'
  render()
  await callbacks[0]()
  assert.equal(calls.at(-1).route, 'search')
  assert.equal(calls.at(-1).payload.state, 'merged')
  assert.equal(calls.at(-1).payload.query, 'fix rendering')
})

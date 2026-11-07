/**
 * The bundle's own contract: it loads, it declares what the host needs, and the
 * two registrations land in the right slots with the same id.
 *
 * @module dsh-pr-release-workspace/test/client-bundle
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fakeContext, loadBundle } from './support/client-harness.js'

test('the bundle registers one factory under the plugin id', async () => {
  const { registration } = await loadBundle()
  assert.equal(registration.id, 'dsh-pr-release-workspace')
  assert.equal(typeof registration.factory, 'function')
})

test('the factory requires only declared modules', async () => {
  const { registration } = await loadBundle()
  const seen = []
  registration.factory((specifier) => {
    seen.push(specifier)
    if (specifier === 'react') return { createElement() {}, useState() {}, useEffect() {}, useRef() {}, useCallback() {} }
    return {}
  })
  assert.deepEqual(seen.sort(), ['@deepseek-ai/dsh-client-ui-primitives', 'react'])
})

test('apply injects exactly the two services it needs', async () => {
  const { products } = await loadBundle()
  // Copied out of the VM context: an array built there has a different `Array`
  // prototype, so a strict deep-equal would fail on identical contents.
  assert.deepEqual(Array.from(products.inject), ['slots', 'locale'])
  assert.equal(typeof products.apply, 'function')
})

test('apply registers a sidebar icon and a main panel under the same id', async () => {
  const { products, PRW } = await loadBundle()
  const fake = fakeContext()
  products.apply(fake.ctx)

  const sidebar = fake.slots.filter((entry) => entry.meta.name === 'sidebar.panellist')
  const main = fake.slots.filter((entry) => entry.meta.name === 'main')
  assert.equal(sidebar.length, 1, 'exactly one sidebar entry')
  assert.equal(main.length, 1, 'exactly one main panel')
  assert.equal(typeof sidebar[0].meta.id, 'string')
  assert.equal(main[0].meta.key, sidebar[0].meta.id, 'the sidebar id and the main key must match')
  assert.equal(typeof sidebar[0].meta.label, 'function')
  assert.equal(PRW.apply !== undefined, true)
})

test('the sidebar entry renders an svg and tolerates a missing size', async () => {
  const { products } = await loadBundle()
  const fake = fakeContext()
  products.apply(fake.ctx)
  const entry = fake.slots.find((slot) => slot.meta.name === 'sidebar.panellist')

  const withSize = entry.component({ size: 18, active: true })
  assert.equal(withSize.type, 'svg')
  assert.equal(withSize.props.width, 18)
  assert.equal(withSize.props['aria-hidden'], 'true')

  const withoutSize = entry.component(undefined)
  assert.equal(withoutSize.type, 'svg')
  assert.equal(withoutSize.props.width, 17)
})

test('applying twice does not throw and still registers one of each', async () => {
  const { products } = await loadBundle()
  const first = fakeContext()
  const second = fakeContext()
  products.apply(first.ctx)
  products.apply(second.ctx)
  assert.equal(first.slots.length, 2)
  assert.equal(second.slots.length, 2)
})

test('the locale namespace carries both dictionaries', async () => {
  const { products } = await loadBundle()
  const fake = fakeContext()
  products.apply(fake.ctx)
  const namespace = fake.registered['dsh-pr-release-workspace']
  assert.ok(namespace, 'the namespace must be registered')
  const en = namespace.dictionaries.en
  const zh = namespace.dictionaries.zh
  assert.ok(Object.keys(en).length > 50, 'the English table looks truncated')
  // A missing Chinese key silently falls back to English in the running app, so
  // an incomplete translation would never be noticed by using it.
  const missing = Object.keys(en).filter((key) => typeof zh[key] !== 'string')
  assert.deepEqual(missing, [], `Chinese is missing: ${missing.join(', ')}`)
  const extra = Object.keys(zh).filter((key) => typeof en[key] !== 'string')
  assert.deepEqual(extra, [], `Chinese has keys English lacks: ${extra.join(', ')}`)
})

test('every locale value is a non-empty string', async () => {
  const { PRW } = await loadBundle()
  for (const lang of ['en', 'zh']) {
    for (const [key, value] of Object.entries(PRW.dicts[lang])) {
      assert.equal(typeof value, 'string', `${lang}.${key} is not a string`)
      assert.ok(value.length > 0, `${lang}.${key} is empty`)
    }
  }
})

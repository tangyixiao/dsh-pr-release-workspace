/**
 * Compatibility tests: the panel must survive a host that provides less than
 * the one it was written against.
 *
 * The three surfaces that can differ between DSH releases are the shared
 * primitives object, the slot service and the locale service. Each is probed at
 * runtime here, so a host that is missing one gets a degraded panel rather than
 * a blank one — and, just as important, rather than a thrown error that takes
 * the whole shell down with it.
 *
 * @module dsh-pr-release-workspace/test/client-compat
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadBundle } from './support/client-harness.js'

test('a full host reports no missing primitives', async () => {
  const { PRW } = await loadBundle()
  assert.equal(PRW.compat.degraded, false)
  // The array is built inside the bundle's own realm, so compare by content.
  assert.equal(JSON.stringify(PRW.compat.missingPrimitives), '[]')
})

test('a host with an empty primitives object reports every one it lacks', async () => {
  const { PRW } = await loadBundle({ primitives: {} })
  assert.equal(PRW.compat.degraded, true)
  assert.ok(
    PRW.compat.missingPrimitives.includes('DiffBlock'),
    `expected DiffBlock to be reported missing, got ${JSON.stringify(PRW.compat.missingPrimitives)}`,
  )
  assert.ok(PRW.compat.missingPrimitives.includes('Pill'))
  // The fallbacks must still be usable, not just reported.
  assert.equal(PRW.ui.DiffBlock, null)
  assert.equal(PRW.ui.hasDiff, false)
})

test('a host that does not publish its version is not an error', async () => {
  const { PRW } = await loadBundle()
  assert.equal(PRW.compat.hostVersion, null)
})

test('a missing locale service still yields a working translator', async () => {
  const { PRW } = await loadBundle()
  const ctx = { slots: { inject(_name, make) { return make() } }, slotsIface: null }
  const t = PRW.bindLocale(ctx, 'dsh-pr-release-workspace')
  assert.equal(t('page.title'), 'Pull requests')
  assert.equal(t('state.retryIn', { seconds: 30 }), 'Try again in 30s.')
  assert.equal(t('not.a.key'), 'not.a.key', 'an unknown key must fall back to the key itself')
})

test('a slot service without inject still receives both registrations', async () => {
  const { PRW } = await loadBundle()
  const registered = []
  const ctx = {
    slots: {
      register(meta, component) {
        registered.push({ meta, component })
        return function () {}
      },
    },
  }
  PRW.registerSlot(ctx, 'sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'x' }, () => null))
  PRW.registerSlot(ctx, 'main', () => ctx.slots.register({ name: 'main', key: 'x' }, () => null))
  assert.equal(registered.length, 2)
  assert.equal(registered[1].meta.key, 'x')
})

test('a missing slot service is reported and swallowed, not thrown', async () => {
  const { PRW } = await loadBundle()
  const warnings = []
  const original = console.warn
  console.warn = (message) => warnings.push(String(message))
  try {
    assert.equal(PRW.registerSlot({}, 'main', () => 'unused'), undefined)
    assert.equal(PRW.registerSlot({ slots: { inject() { throw new Error('no slot') } } }, 'main', () => 1), undefined)
  } finally {
    console.warn = original
  }
  assert.equal(warnings.length, 1, 'only the throwing arm warns')
  assert.ok(warnings[0].includes('main'))
})

test('apply works on a host with neither a locale nor a slot service', async () => {
  const { PRW } = await loadBundle()
  const effects = []
  const ctx = {
    effect(fn, label) {
      effects.push(label)
      return fn()
    },
  }
  PRW.apply(ctx)
  assert.deepEqual(effects, ['pr-release-workspace: styles'])
  assert.equal(typeof PRW.t, 'function')
  assert.equal(PRW.t('page.title'), 'Pull requests')
})

test('a degraded host is told it is degraded, on screen', async () => {
  const { PRW } = await loadBundle({ primitives: {} })
  const t = (key) => key
  const html = renderToStaticMarkup(h(PRW.Shell, { t }))
  assert.ok(
    html.includes('compat.degraded'),
    `a host with no primitives must show the notice, got: ${html.slice(0, 400)}`,
  )
})

test('a full host shows no degradation notice', async () => {
  const { PRW } = await loadBundle()
  const html = renderToStaticMarkup(h(PRW.Shell, { t: (key) => key }))
  assert.ok(!html.includes('compat.degraded'), 'a healthy host must not nag')
})

/**
 * Host compatibility tests: how the plugin finds its services on a host it has
 * never seen.
 *
 * Two lookup shapes exist across DSH releases — a plain property on the
 * injected context, and the reflective `ctx.get(name, false)`. The plugin tries
 * both, in that order, and neither is assumed. These tests pin the order and the
 * failure behaviour, because a wrong guess here is invisible: the route simply
 * never registers and the panel sits empty.
 *
 * @module dsh-pr-release-workspace/test/host-compat
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply as applyHost } from '../lib/index.js'

/** A minimal web server that records what it was asked to publish. */
function webServer(registered) {
  return {
    register(route) {
      registered.push(route)
      return function () {}
    },
  }
}

/** Run `apply` against one injected context shape and report what happened. */
function run(inner, log = { warn() {}, info() {} }) {
  const registered = []
  applyHost({ logger: log, inject: (_names, callback) => callback(inner) })
  return registered
}

test('services are read as properties when the context exposes them that way', () => {
  const registered = []
  run({
    webServer: webServer(registered),
    connection: { requestRejection: () => undefined },
    effect() {},
  })
  assert.equal(registered.length, 1)
  assert.equal(registered[0].kind, 'prefix')
})

test('services are found through the reflective get when there are no properties', () => {
  const registered = []
  const services = {
    webServer: webServer(registered),
    connection: { requestRejection: () => undefined },
  }
  run({
    get(name) {
      return services[name]
    },
    effect() {},
  })
  assert.equal(registered.length, 1)
})

test('a context that throws on an undeclared property still registers the route', () => {
  const registered = []
  const services = {
    webServer: webServer(registered),
    connection: { requestRejection: () => undefined },
  }
  const inner = {
    get(name) {
      return services[name]
    },
    effect() {},
  }
  // This is what a Cordis proxy does for a name the fiber did not declare.
  Object.defineProperty(inner, 'webServer', {
    get() {
      throw new Error('cannot get property "webServer" without inject')
    },
  })
  run(inner)
  assert.equal(registered.length, 1)
})

test('a host with no admission method still exposes nothing', () => {
  const registered = []
  const services = { webServer: webServer(registered), connection: {} }
  run({ get: (name) => services[name], effect() {} })
  assert.equal(registered.length, 0, 'a connection without requestRejection is not a fence')
})

test('the reported host version comes from the live clientModules service', () => {
  const messages = []
  const registered = []
  run(
    {
      webServer: webServer(registered),
      connection: { requestRejection: () => undefined },
      clientModules: { release: { version: '0.2.2-rc.1' } },
      effect() {},
    },
    { warn() {}, info: (message) => messages.push(String(message)) },
  )
  assert.ok(
    messages.some((message) => message.includes('host 0.2.2-rc.1')),
    `expected the live version in the log, got ${JSON.stringify(messages)}`,
  )
})

test('a host that does not report a version says so instead of guessing', () => {
  const messages = []
  run(
    {
      webServer: webServer([]),
      connection: { requestRejection: () => undefined },
      effect() {},
    },
    { warn() {}, info: (message) => messages.push(String(message)) },
  )
  assert.ok(
    messages.some((message) => message.includes('version not reported')),
    `expected an honest gap, got ${JSON.stringify(messages)}`,
  )
  assert.ok(
    !messages.some((message) => /\d+\.\d+\.\d+/.test(message)),
    'no version number may be invented',
  )
})

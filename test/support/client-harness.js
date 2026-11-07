/**
 * Load the built client bundle the way the Harness does.
 *
 * The bundle is a classic script that calls `window.__ModuleLoader__.load` with
 * a factory. There is no module system in `node --test`, so this harness stands
 * one up: a fake `window`, a `require` that resolves only the two specifiers the
 * manifest declares, and a captured registration.
 *
 * Testing the *built* file rather than the fragments matters: a fragment that is
 * syntactically fine but glued wrong is exactly the failure a bundler would have
 * prevented and concatenation does not.
 *
 * @module dsh-pr-release-workspace/test/support/client-harness
 */

import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import * as primitivesStub from './primitives-stub.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')

const nodeRequire = createRequire(join(root, 'package.json'))

/**
 * Load `lib/client.js` into a fresh VM context.
 *
 * @param {{ primitives?: object, document?: object }} [options]
 * @returns {Promise<{ registration: object, products: object, PRW: object, document: object }>}
 */
export async function loadBundle(options = {}) {
  const source = await readFile(join(root, 'lib', 'client.js'), 'utf8')

  const styles = []
  const document = options.document || {
    hidden: false,
    head: {
      appendChild(node) {
        styles.push(node)
        node.parentNode = { removeChild() {} }
        return node
      },
    },
    querySelector() {
      return null
    },
    createElement(tag) {
      const attributes = {}
      return {
        tagName: tag,
        attributes,
        textContent: '',
        parentNode: null,
        setAttribute(name, value) {
          attributes[name] = value
        },
        getAttribute(name) {
          return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null
        },
      }
    },
  }

  let registration = null
  const window = {
    __ModuleLoader__: {
      load(value) {
        registration = value
      },
    },
  }

  // The real package cannot be imported by Node (its modules import `.module.css`),
  // so the stub is the default and a caller must pass a replacement explicitly.
  const primitives = options.primitives === undefined ? primitivesStub : options.primitives

  const sandbox = {
    window,
    document,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    fetch: async () => {
      throw new Error('the client must not fetch during a render test')
    },
    AbortController,
    AbortSignal,
    JSON,
    Object,
    Array,
    Math,
    Date,
    String,
    Number,
    Boolean,
    Error,
    RegExp,
    Map,
    Set,
    Promise,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
  }
  sandbox.globalThis = sandbox

  const context = vm.createContext(sandbox)
  vm.runInContext(source, context, { filename: 'lib/client.js' })

  if (registration === null) throw new Error('the bundle did not call window.__ModuleLoader__.load')

  const factoryRequire = (specifier) => {
    if (specifier === 'react') return nodeRequire('react')
    if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return primitives
    throw new Error(`the bundle required an undeclared module: ${specifier}`)
  }

  const products = registration.factory(factoryRequire)
  return { registration, products, PRW: products.__PRW, document, styles }
}

/**
 * A fake slot/locale context, recording every registration.
 *
 * Deliberately shaped like the real one — `ctx.effect` returns a disposer,
 * `ctx.locale.bind` returns a lookup, `ctx.slots.inject(name, fn)` calls `fn`
 * inside the mode it is given — so an `apply()` that works here has the right
 * shape for the host.
 *
 * @param {{ dictionary?: 'en' | 'zh' }} [options]
 * @returns {{ ctx: object, slots: object[], effects: string[] }}
 */
export function fakeContext(options = {}) {
  const lang = options.dictionary === 'zh' ? 'zh' : 'en'
  const registered = {}
  const effects = []
  const slots = []
  let bound = null

  const ctx = {
    effect(fn, label) {
      effects.push(label === undefined ? '(unlabelled)' : label)
      const disposer = fn()
      return typeof disposer === 'function' ? disposer : function () {}
    },
    locale: {
      register(namespace, dictionaries) {
        registered[namespace] = { namespace, dictionaries }
        return function () {}
      },
      bind(namespace) {
        bound = { namespace, dictionaries: registered[namespace] ? registered[namespace].dictionaries : { en: {}, zh: {} } }
        return function (key, vars) {
          const table = bound.dictionaries[lang] || bound.dictionaries.en || {}
          const template = typeof table[key] === 'string' ? table[key] : key
          if (vars === undefined || vars === null) return template
          return template.replace(/\{(\w+)\}/g, (whole, name) =>
            Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
          )
        }
      },
    },
    slots: {
      inject(name, fn) {
        return fn({ name })
      },
      register(meta, component) {
        slots.push({ meta, component })
        return function () {}
      },
      entriesOfSlot() {
        return []
      },
      subscribe() {
        return function () {}
      },
    },
  }

  return { ctx, slots, effects, registered }
}

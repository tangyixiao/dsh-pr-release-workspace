/**
 * The shipped `locale/*.json` files must be the same dictionaries the bundle
 * registers at runtime.
 *
 * They exist for consumers that read the JSON directly — the market build, and
 * anyone translating the panel without loading it. Two copies of the same table
 * drift the moment one is edited, and a drifted file is invisible: the panel
 * works, so nothing fails. This test is the only thing that notices.
 *
 * @module dsh-pr-release-workspace/test/locale-files
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { loadBundle } from './support/client-harness.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

async function shipped(lang) {
  const text = await readFile(join(root, 'locale', lang + '.json'), 'utf8')
  return JSON.parse(text)
}

test('locale/en.json matches the dictionary the bundle registers', async () => {
  const { PRW } = await loadBundle()
  const file = await shipped('en')
  const live = {}
  for (const key of Object.keys(PRW.dicts.en)) live[key] = PRW.dicts.en[key]

  assert.deepEqual(Object.keys(file).sort(), Object.keys(live).sort())
  for (const key of Object.keys(live)) {
    assert.equal(file[key], live[key], 'locale/en.json drifted for ' + key)
  }
})

test('locale/zh.json matches the dictionary the bundle registers', async () => {
  const { PRW } = await loadBundle()
  const file = await shipped('zh')
  const live = {}
  for (const key of Object.keys(PRW.dicts.zh)) live[key] = PRW.dicts.zh[key]

  assert.deepEqual(Object.keys(file).sort(), Object.keys(live).sort())
  for (const key of Object.keys(live)) {
    assert.equal(file[key], live[key], 'locale/zh.json drifted for ' + key)
  }
})

test('the two shipped locales carry the same keys and the same placeholders', async () => {
  const en = await shipped('en')
  const zh = await shipped('zh')
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort())

  const placeholders = (text) => (String(text).match(/\{[a-zA-Z]+\}/g) || []).sort().join(',')
  for (const key of Object.keys(en)) {
    assert.equal(
      placeholders(en[key]),
      placeholders(zh[key]),
      'placeholder mismatch between en and zh for ' + key,
    )
    assert.ok(String(en[key]).trim().length > 0, 'empty english value for ' + key)
    assert.ok(String(zh[key]).trim().length > 0, 'empty chinese value for ' + key)
  }
})

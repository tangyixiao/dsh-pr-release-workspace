/**
 * The local draft store.
 *
 * Drafts are notes the user writes for themselves and nothing here reaches
 * GitHub, so the behaviour that matters is durability and honesty about
 * staleness: a note written against one commit must never be presented as if it
 * belongs to the next one, and a corrupted file must not take the panel down with
 * it. Every test drives a real temp file, because the interesting failures are
 * in persistence, not in the in-memory map.
 *
 * @module dsh-pr-release-workspace/test/host-drafts
 */

import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DRAFT_STATE, createDraftStore, draftFile } from '../lib/host/drafts.js'

/** Every temp directory this file created, so `after` can remove them all. */
const tempDirs = []

/** A fresh store over a fresh directory, plus a helper for the file next to it. */
function freshStore() {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-pr-release-drafts-'))
  tempDirs.push(dir)
  const file = join(dir, 'drafts.json')
  return { dir, file, store: createDraftStore({ file }) }
}

after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
})

test('a draft saved against the current head is reported as current with no hint', async () => {
  const { store } = freshStore()

  const saved = await store.save({ key: 'o/r#1', sha: 'sha1', path: 'src/a.js', line: 3, body: 'rename this' })
  const rows = await store.list({ key: 'o/r#1', headSha: 'sha1' })

  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, saved.id)
  assert.equal(rows[0].body, 'rename this')
  assert.equal(rows[0].state, DRAFT_STATE.CURRENT)
  assert.equal(rows[0].hint, null)
})

test('a draft written against an earlier commit is stale and carries the hint that says so', async () => {
  const { store } = freshStore()

  await store.save({ key: 'o/r#1', sha: 'old-sha', path: 'src/a.js', line: 3, body: 'rename this' })
  const rows = await store.list({ key: 'o/r#1', headSha: 'new-sha' })

  assert.equal(rows.length, 1)
  assert.equal(rows[0].state, DRAFT_STATE.STALE)
  assert.equal(rows[0].hint, 'Written against an earlier commit; the lines may have moved.')
})

test('a draft is stale when no head SHA is supplied rather than silently current', async () => {
  const { store } = freshStore()

  await store.save({ key: 'k', sha: 'sha1', body: 'note' })

  assert.equal((await store.list({ key: 'k' }))[0].state, DRAFT_STATE.STALE)
  assert.equal((await store.list({ key: 'k', headSha: null }))[0].state, DRAFT_STATE.STALE)
})

test('saving the same anchor twice updates one draft instead of adding a second', async () => {
  const { store, file } = freshStore()
  const anchor = { key: 'k', sha: 'sha1', path: 'src/a.js', line: 3 }

  const first = await store.save({ ...anchor, body: 'first draft' })
  const second = await store.save({ ...anchor, body: 'second draft' })
  const rows = await store.list({ key: 'k', headSha: 'sha1' })

  assert.equal(first.id, second.id)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].body, 'second draft')
  assert.equal(first.createdAt, second.createdAt, 'an edit keeps the original creation time')
  assert.notEqual(first.updatedAt, second.updatedAt, 'an edit moves the update time')

  const onDisk = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(onDisk.drafts.length, 1)
})

test('the same line saved under a different SHA is a separate draft', async () => {
  const { store } = freshStore()

  await store.save({ key: 'k', sha: 'sha1', path: 'src/a.js', line: 3, body: 'old note' })
  await store.save({ key: 'k', sha: 'sha2', path: 'src/a.js', line: 3, body: 'new note' })

  const rows = await store.list({ key: 'k', headSha: 'sha2' })

  assert.equal(rows.length, 2)
  assert.deepEqual(
    rows.map((row) => [row.body, row.state]),
    [
      ['new note', DRAFT_STATE.CURRENT],
      ['old note', DRAFT_STATE.STALE],
    ],
  )
  assert.deepEqual(
    (await store.listBySha('sha2')).map((row) => row.body),
    ['new note'],
  )
})

test('two saves in the same millisecond still come back in write order', async () => {
  // This is the regression that made CI red while every local run was green:
  // both saves landed inside one Date.now() tick, so both drafts carried the
  // same updatedAt, "newest first" had no order to sort by, and the stale note
  // surfaced above the current one. Ten saves make the collision near-certain.
  const { store } = freshStore()

  for (let index = 0; index < 10; index += 1) {
    await store.save({ key: 'k', sha: 'sha1', path: `src/${index}.js`, line: 1, body: `note ${index}` })
  }

  const rows = await store.list({ key: 'k', headSha: 'sha1' })
  assert.deepEqual(
    rows.map((row) => row.body),
    ['note 9', 'note 8', 'note 7', 'note 6', 'note 5', 'note 4', 'note 3', 'note 2', 'note 1', 'note 0'],
  )

  // Strictly decreasing: equal timestamps are what allowed the wrong order.
  for (let index = 1; index < rows.length; index += 1) {
    assert.ok(
      rows[index - 1].updatedAt > rows[index].updatedAt,
      `updatedAt must strictly decrease, got ${rows[index - 1].updatedAt} then ${rows[index].updatedAt}`,
    )
  }
})

test('the write-order guarantee survives a restart', async () => {
  const { file, store } = freshStore()

  await store.save({ key: 'k', sha: 'sha1', path: 'a.js', line: 1, body: 'first' })
  await store.save({ key: 'k', sha: 'sha1', path: 'a.js', line: 2, body: 'second' })

  // A second store reads the file from scratch, with no in-memory history.
  const reopened = createDraftStore({ file })
  await reopened.save({ key: 'k', sha: 'sha1', path: 'a.js', line: 3, body: 'third' })

  const rows = await reopened.list({ key: 'k', headSha: 'sha1' })
  assert.deepEqual(
    rows.map((row) => row.body),
    ['third', 'second', 'first'],
  )
})

test('a draft with no path or line is a general note on the PR', async () => {
  const { store } = freshStore()

  const saved = await store.save({ key: 'k', sha: 's', body: 'overall this is fine' })

  assert.equal(saved.path, null)
  assert.equal(saved.line, null)
  assert.equal(saved.kind, 'general')
  assert.equal(saved.id, 'k@s#:0')
})

test('an inline draft keeps its path, line and inline kind', async () => {
  const { store } = freshStore()

  const saved = await store.save({ key: 'k', sha: 's', path: 'src/a.js', line: 12, body: 'why?' })

  assert.equal(saved.kind, 'inline')
  assert.equal(saved.line, 12)
  assert.equal(saved.id, 'k@s#src/a.js:12')
})

test('a line that is not a positive integer degrades to a general note instead of throwing', async () => {
  const { store } = freshStore()

  for (const line of [0, -3, 2.5, '7', null, undefined]) {
    const saved = await store.save({ key: 'k', sha: 's', path: 'src/a.js', line, body: 'note' })
    assert.equal(saved.line, null, `line ${String(line)} should not be stored`)
    assert.equal(saved.kind, 'general')
  }
})

test('remove deletes only the draft with that id', async () => {
  const { store } = freshStore()

  const keep = await store.save({ key: 'k', sha: 's', path: 'a.js', line: 1, body: 'keep' })
  const drop = await store.save({ key: 'k', sha: 's', path: 'b.js', line: 2, body: 'drop' })

  assert.equal(await store.remove(drop.id), true)

  const rows = await store.list({ key: 'k', headSha: 's' })
  assert.deepEqual(
    rows.map((row) => row.id),
    [keep.id],
  )
  assert.equal(await store.remove(drop.id), false, 'removing a missing id reports false')
})

test('clearKey removes every draft for one PR and nothing for another', async () => {
  const { store } = freshStore()

  await store.save({ key: 'pr-1', sha: 's', body: 'one' })
  await store.save({ key: 'pr-1', sha: 's', path: 'a.js', line: 1, body: 'two' })
  await store.save({ key: 'pr-2', sha: 's', body: 'other pr' })

  assert.equal(await store.clearKey('pr-1'), 2)
  assert.deepEqual(await store.list({ key: 'pr-1', headSha: 's' }), [])
  assert.equal((await store.list({ key: 'pr-2', headSha: 's' })).length, 1)
  assert.equal(await store.clearKey('pr-1'), 0, 'clearing again removes nothing')
})

test('the file is valid JSON with a format marker after a write', async () => {
  const { store, file } = freshStore()

  await store.save({ key: 'k', sha: 's', body: 'note' })

  const text = readFileSync(file, 'utf8')
  const doc = JSON.parse(text)

  assert.equal(doc.format, 1)
  assert.equal(typeof doc.updatedAt, 'string')
  assert.ok(Array.isArray(doc.drafts))
  assert.equal(doc.drafts.length, 1)
  assert.equal(text.endsWith('\n'), true, 'the file ends with a newline so it diffs cleanly')
})

test('a truncated draft file is treated as empty and the next save repairs it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-pr-release-corrupt-'))
  tempDirs.push(dir)
  const file = join(dir, 'drafts.json')
  writeFileSync(file, '{"format":1,"drafts":[{"key":"a"', 'utf8')

  const store = createDraftStore({ file })

  await assert.doesNotReject(() => store.list({ key: 'anything', headSha: 's' }), 'a corrupt file must not throw')
  assert.deepEqual(await store.list({ key: 'anything', headSha: 's' }), [])

  await store.save({ key: 'k', sha: 's', body: 'written after corruption' })

  const doc = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(doc.drafts.length, 1)
  assert.equal(doc.drafts[0].body, 'written after corruption')
})

test('a draft file containing the wrong JSON shape is treated as empty', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-pr-release-shape-'))
  tempDirs.push(dir)
  const file = join(dir, 'drafts.json')

  for (const body of ['null', '[]', '"text"', '{"drafts":{}}', '{}']) {
    writeFileSync(file, body, 'utf8')
    const store = createDraftStore({ file })
    await assert.doesNotReject(() => store.list({ key: 'k', headSha: 's' }), `${body} must not throw`)
    assert.deepEqual(await store.list({ key: 'k', headSha: 's' }), [], `${body} should read as no drafts`)
  }
})

test('a missing file reads as no drafts and is not created by reading', async () => {
  const { store, file } = freshStore()

  assert.deepEqual(await store.list({ key: 'k', headSha: 's' }), [])
  assert.deepEqual(await store.listBySha('s'), [])
  assert.equal(
    (() => {
      try {
        readFileSync(file)
        return true
      } catch {
        return false
      }
    })(),
    false,
    'reading must not materialise an empty file',
  )
})

test('a save creates the directory chain it needs', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-pr-release-mkdir-'))
  tempDirs.push(dir)
  const file = join(dir, 'nested', 'deeper', 'drafts.json')
  const store = createDraftStore({ file })

  await store.save({ key: 'k', sha: 's', body: 'deep' })

  assert.equal(JSON.parse(readFileSync(file, 'utf8')).drafts[0].body, 'deep')
})

// ---------------------------------------------------------------------------
// Caps. `requireString` in lib/host/drafts.js refuses over-long input rather than
// slicing it: slicing a note body silently loses the end of what someone typed,
// and slicing a path would move the note to a different file. A visible error is
// the better outcome for both.
// ---------------------------------------------------------------------------

test('an over-long body is refused, not silently shortened', async () => {
  const { store } = freshStore()

  await assert.rejects(
    () => store.save({ key: 'k', sha: 's', body: 'x'.repeat(20_001) }),
    (error) => error.code === 'bad-request' && /longer than 20000/.test(error.message),
  )

  const atCap = await store.save({ key: 'k2', sha: 's', body: 'y'.repeat(20_000) })
  assert.equal(atCap.body.length, 20_000, 'a body exactly at the cap is kept whole')
})

test('an over-long path is refused, not silently shortened', async () => {
  const { store } = freshStore()

  await assert.rejects(
    () => store.save({ key: 'k', sha: 's', path: 'p'.repeat(513), body: 'note' }),
    (error) => error.code === 'bad-request' && /longer than 512/.test(error.message),
  )
})

test('a non-string body or an empty key is refused', async () => {
  const { store } = freshStore()

  await assert.rejects(() => store.save({ key: 'k', sha: 's' }), /body must be a string/)
  await assert.rejects(() => store.save({ key: 'k', sha: 's', body: 42 }), /body must be a string/)
  await assert.rejects(() => store.save({ key: '', sha: 's', body: 'note' }), /key must not be empty/)
  await assert.rejects(() => store.save({ key: 'k', sha: '', body: 'note' }), /sha must not be empty/)
})

test('the number of drafts held in the file is capped at 500', async () => {
  const { store, file } = freshStore()

  for (let index = 0; index < 505; index += 1) {
    await store.save({ key: 'bulk', sha: 's', path: `file-${index}.js`, line: 1, body: `note ${index}` })
  }

  const doc = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(doc.drafts.length, 500)

  // The cap is applied when the file is written, not to the in-memory map, so a
  // long-lived store still answers for all 505 rows it was given. Reading the
  // file back (a fresh store) is what a restart sees.
  const reloaded = createDraftStore({ file })
  assert.equal((await reloaded.list({ key: 'bulk', headSha: 's' })).length, 500)
  assert.equal((await store.list({ key: 'bulk', headSha: 's' })).length, 505)
})

test('_reset makes the next read come from disk, so a second store sees the same draft', async () => {
  const { store, file } = freshStore()

  const saved = await store.save({ key: 'k', sha: 's', path: 'a.js', line: 1, body: 'shared' })
  store._reset()

  const rows = await store.list({ key: 'k', headSha: 's' })
  assert.deepEqual(
    rows.map((row) => row.id),
    [saved.id],
  )

  const other = createDraftStore({ file })
  assert.equal((await other.list({ key: 'k', headSha: 's' }))[0].body, 'shared')
})

test('the default draft file lives under the Harness home', () => {
  assert.equal(
    draftFile('/home/user'),
    join('/home/user', 'storages', 'dsh-pr-release-workspace', 'drafts.json'),
  )
})

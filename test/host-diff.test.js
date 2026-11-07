/**
 * The unified-diff reader.
 *
 * `parseUnifiedDiff` is the only thing standing between a raw `gh pr diff`
 * transcript and the two texts `DiffBlock` compares, so every assertion here is
 * about content: what ends up on the old side, what ends up on the new side, and
 * what must never leak into either. A parser that quietly drops a line produces a
 * diff that reads plausibly and is wrong, which is worse than one that refuses.
 *
 * @module dsh-pr-release-workspace/test/host-diff
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseUnifiedDiff } from '../lib/host/pull.js'

/** Build a patch from lines without depending on the editor's line endings. */
const patchOf = (...lines) => lines.join('\n')

test('a modified file reconstructs the old side without additions and the new side without removals', () => {
  const patch = patchOf(
    'diff --git a/src/app.js b/src/app.js',
    'index 3f2a1b0..9c8d7e6 100644',
    '--- a/src/app.js',
    '+++ b/src/app.js',
    '@@ -1,3 +1,4 @@',
    ' const a = 1',
    '-const b = 2',
    '+const b = 3',
    '+const c = 4',
    ' const d = 5',
    '',
  )

  const { files, truncated } = parseUnifiedDiff(patch)

  assert.equal(files.length, 1)
  assert.equal(files[0].path, 'src/app.js')
  assert.equal(files[0].oldText, 'const a = 1\nconst b = 2\nconst d = 5')
  assert.equal(files[0].newText, 'const a = 1\nconst b = 3\nconst c = 4\nconst d = 5')
  assert.equal(truncated, false)
})

test('a removed line appears only on the old side and an added line only on the new side', () => {
  const { files } = parseUnifiedDiff(
    patchOf(
      'diff --git a/one.txt b/one.txt',
      '--- a/one.txt',
      '+++ b/one.txt',
      '@@ -1,1 +1,1 @@',
      '-only-in-old',
      '+only-in-new',
      '',
    ),
  )

  assert.equal(files[0].oldText, 'only-in-old')
  assert.equal(files[0].newText, 'only-in-new')
})

test('a context line appears on both sides', () => {
  const { files } = parseUnifiedDiff(
    patchOf(
      'diff --git a/ctx.txt b/ctx.txt',
      '--- a/ctx.txt',
      '+++ b/ctx.txt',
      '@@ -1,3 +1,3 @@',
      ' shared top',
      '-old middle',
      '+new middle',
      ' shared bottom',
      '',
    ),
  )

  assert.equal(files[0].oldText, 'shared top\nold middle\nshared bottom')
  assert.equal(files[0].newText, 'shared top\nnew middle\nshared bottom')
})

test('an added file has no old side at all', () => {
  const { files } = parseUnifiedDiff(
    patchOf(
      'diff --git a/new.txt b/new.txt',
      'new file mode 100644',
      'index 0000000..3b18e51',
      '--- /dev/null',
      '+++ b/new.txt',
      '@@ -0,0 +1,2 @@',
      '+hello',
      '+world',
      '',
    ),
  )

  assert.equal(files.length, 1)
  assert.equal(files[0].path, 'new.txt')
  assert.equal(files[0].oldText, null)
  assert.equal(files[0].newText, 'hello\nworld')
})

test('a removed file has no new side at all', () => {
  const { files } = parseUnifiedDiff(
    patchOf(
      'diff --git a/gone.txt b/gone.txt',
      'deleted file mode 100644',
      'index 3b18e51..0000000',
      '--- a/gone.txt',
      '+++ /dev/null',
      '@@ -1,1 +0,0 @@',
      '-bye',
      '',
    ),
  )

  assert.equal(files.length, 1)
  assert.equal(files[0].path, 'gone.txt')
  assert.equal(files[0].oldText, 'bye')
  assert.equal(files[0].newText, null)
})

test('a patch that names /dev/null without a mode line leaves the missing side empty rather than null', () => {
  // Encodes the parser's ACTUAL behaviour: the added/deleted flag is set only by
  // the `new file mode` / `deleted file mode` lines, not by the `/dev/null`
  // header. `gh pr diff` always emits the mode line, so this only matters for a
  // hand-built patch — but the module's own doc comment promises `null` here.
  const added = parseUnifiedDiff(
    patchOf(
      'diff --git a/n.txt b/n.txt',
      '--- /dev/null',
      '+++ b/n.txt',
      '@@ -0,0 +1,1 @@',
      '+hello',
      '',
    ),
  )
  const removed = parseUnifiedDiff(
    patchOf(
      'diff --git a/m.txt b/m.txt',
      '--- a/m.txt',
      '+++ /dev/null',
      '@@ -1,1 +0,0 @@',
      '-bye',
      '',
    ),
  )

  assert.equal(added.files[0].oldText, '')
  assert.equal(added.files[0].newText, 'hello')
  assert.equal(removed.files[0].oldText, 'bye')
  assert.equal(removed.files[0].newText, '')
})

test('diff headers, index lines, hunk headers and mode lines never reach either side', () => {
  const { files } = parseUnifiedDiff(
    patchOf(
      'diff --git a/run.sh b/run.sh',
      'old mode 100755',
      'new mode 100644',
      'index 1111111..2222222',
      '--- a/run.sh',
      '+++ b/run.sh',
      '@@ -1,2 +1,2 @@',
      ' #!/bin/sh',
      '-echo old',
      '+echo new',
      '',
    ),
  )

  assert.equal(files[0].oldText, '#!/bin/sh\necho old')
  assert.equal(files[0].newText, '#!/bin/sh\necho new')

  for (const side of [files[0].oldText, files[0].newText]) {
    assert.equal(side.includes('diff --git'), false)
    assert.equal(side.includes('index '), false)
    assert.equal(side.includes('@@'), false)
    assert.equal(side.includes('old mode'), false)
    assert.equal(side.includes('new mode'), false)
    assert.equal(side.startsWith('---'), false)
    assert.equal(side.startsWith('+++'), false)
  }
})

test('the no-newline marker is not part of either side', () => {
  const { files } = parseUnifiedDiff(
    patchOf(
      'diff --git a/eol.txt b/eol.txt',
      '--- a/eol.txt',
      '+++ b/eol.txt',
      '@@ -1,1 +1,1 @@',
      '-old',
      '\\ No newline at end of file',
      '+new',
      '\\ No newline at end of file',
      '',
    ),
  )

  assert.equal(files[0].oldText, 'old')
  assert.equal(files[0].newText, 'new')
  assert.equal(files[0].oldText.includes('No newline'), false)
  assert.equal(files[0].newText.includes('No newline'), false)
  assert.equal(files[0].oldText.includes('\\'), false)
})

test('a rename-only patch keeps the new path and carries no line content', () => {
  const { files } = parseUnifiedDiff(
    patchOf(
      'diff --git a/old.js b/new.js',
      'similarity index 100%',
      'rename from old.js',
      'rename to new.js',
      '',
    ),
  )

  assert.equal(files.length, 1)
  assert.equal(files[0].path, 'new.js')
  assert.equal(files[0].oldText, '')
  assert.equal(files[0].newText, '')
})

test('a binary file has no text on either side', () => {
  const { files } = parseUnifiedDiff(
    patchOf(
      'diff --git a/logo.png b/logo.png',
      'index 1111111..2222222 100644',
      'Binary files a/logo.png and b/logo.png differ',
      '',
    ),
  )

  assert.equal(files.length, 1)
  assert.equal(files[0].path, 'logo.png')
  assert.equal(files[0].oldText, null)
  assert.equal(files[0].newText, null)
})

test('a GIT binary patch is binary too, so neither side gets a text body', () => {
  const { files } = parseUnifiedDiff(
    patchOf(
      'diff --git a/blob.bin b/blob.bin',
      'index 1111111..2222222 100644',
      'GIT binary patch',
      'literal 12',
      'TcmZ?wbhEHb=',
      '',
    ),
  )

  assert.equal(files[0].oldText, null)
  assert.equal(files[0].newText, null)
})

test('multiple files become one entry each, in patch order', () => {
  const { files } = parseUnifiedDiff(
    patchOf(
      'diff --git a/first.txt b/first.txt',
      '--- a/first.txt',
      '+++ b/first.txt',
      '@@ -1,1 +1,1 @@',
      '-a',
      '+A',
      'diff --git a/second.txt b/second.txt',
      '--- a/second.txt',
      '+++ b/second.txt',
      '@@ -1,1 +1,1 @@',
      '-b',
      '+B',
      'diff --git a/third.txt b/third.txt',
      '--- a/third.txt',
      '+++ b/third.txt',
      '@@ -1,1 +1,1 @@',
      '-c',
      '+C',
      '',
    ),
  )

  assert.deepEqual(
    files.map((file) => file.path),
    ['first.txt', 'second.txt', 'third.txt'],
  )
  assert.deepEqual(
    files.map((file) => file.newText),
    ['A', 'B', 'C'],
  )
})

test("GitHub's truncation sentence sets truncated and still returns what was parsed", () => {
  const patch = patchOf(
    'diff --git a/big.txt b/big.txt',
    '--- a/big.txt',
    '+++ b/big.txt',
    '@@ -1,1 +1,1 @@',
    '-a',
    '+A',
    'diff truncated, use the API to fetch the diff',
    '',
  )

  const result = parseUnifiedDiff(patch)

  assert.equal(result.truncated, true)
  assert.equal(result.files.length, 1)
  assert.equal(result.files[0].newText, 'A')
})

test('a patch carrying no truncation marker is reported as complete', () => {
  const result = parseUnifiedDiff(
    patchOf('diff --git a/a.txt b/a.txt', '--- a/a.txt', '+++ b/a.txt', '@@ -1,1 +1,1 @@', '-x', '+y', ''),
  )

  assert.equal(result.truncated, false)
})

test('a patch over the size guard is reported as truncated even without the sentence', () => {
  const result = parseUnifiedDiff('x'.repeat(1_500_001))

  assert.equal(result.truncated, true)
})

test('a patch at exactly the size guard is not reported as truncated', () => {
  const result = parseUnifiedDiff('x'.repeat(1_500_000))

  assert.equal(result.truncated, false)
})

test('an empty or non-string patch parses to no files and no truncation', () => {
  for (const input of ['', null, undefined, 42, {}]) {
    const result = parseUnifiedDiff(input)
    assert.deepEqual(result, { files: [], truncated: false })
  }
})

// ---------------------------------------------------------------------------
// BUG (lib/host/pull.js:599-612): the marker-skip list is consulted BEFORE the
// `+`/`-`/` ` content branches, and it tests `line.startsWith('--- ')` and
// `line.startsWith('+++ ')`. A diff line is `prefix + content`, so a removed
// line whose CONTENT begins with `-- ` (any SQL or Lua comment) arrives as
// `--- ...` and is discarded as if it were a file header; a context line whose
// content begins with `-- ` is fine because it is prefixed with a space.
// The two tests below pin the correct behaviour and fail until the parser
// tracks hunk state instead of guessing from the line prefix.
// ---------------------------------------------------------------------------

test('a removed line whose content starts with -- is kept on the old side', () => {
  const { files } = parseUnifiedDiff(
    patchOf(
      'diff --git a/q.sql b/q.sql',
      '--- a/q.sql',
      '+++ b/q.sql',
      '@@ -1,2 +1,2 @@',
      ' SELECT 1;',
      '--- rollback note',
      '+-- new rollback note',
      '',
    ),
  )

  assert.equal(files[0].oldText, 'SELECT 1;\n-- rollback note')
  assert.equal(files[0].newText, 'SELECT 1;\n-- new rollback note')
})

test('an added line whose content starts with ++ is kept on the new side', () => {
  const { files } = parseUnifiedDiff(
    patchOf(
      'diff --git a/m.js b/m.js',
      '--- a/m.js',
      '+++ b/m.js',
      '@@ -1,1 +1,2 @@',
      ' keep()',
      '+++ increment',
      '',
    ),
  )

  assert.equal(files[0].oldText, 'keep()')
  assert.equal(files[0].newText, 'keep()\n++ increment')
})

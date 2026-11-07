/**
 * Local review drafts, bound to one head SHA.
 *
 * A draft is a note the user is writing for themselves — nothing here ever
 * reaches GitHub. That is a deliberate product decision, not an unfinished
 * feature: posting a review comment or approving a pull request is an
 * irreversible public act on someone else's work, so this plugin stops at
 * "prepared" and hands the text to the user. See `WRITE_GUARD_NOTE` in
 * `exec.js`.
 *
 * The hard part is staleness. A draft written against `abc123` is not merely old
 * when the branch moves to `def456` — the lines it refers to may no longer
 * exist, so showing it as a live comment on the new code would be a lie. Every
 * draft therefore stores the SHA it was written against and is reported as
 * `stale` whenever the current head differs.
 *
 * Storage is one JSON file under `$DSH_HOME/storages/dsh-pr-release-workspace/`,
 * written through a temp file plus rename so a crash mid-write cannot truncate
 * the user's notes.
 *
 * @module dsh-pr-release-workspace/lib/host/drafts
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/** The verdict vocabulary for one draft, mirroring the release facts. */
export const DRAFT_STATE = Object.freeze({
  CURRENT: 'current',
  STALE: 'stale',
})

/** Refuse to grow the draft file without bound; a note is not a database. */
const MAX_DRAFTS = 500
/** One note's body cap. Long enough for a thorough review, short enough to render. */
const MAX_BODY_CHARS = 20_000
/** Cap on a file path inside a draft, so a hostile path cannot be a megabyte. */
const MAX_PATH_CHARS = 512

/**
 * A store over one JSON file.
 *
 * Reads are lazy and the in-memory copy is authoritative between writes, so a
 * keystroke does not re-read the disk. Every write is debounced by the caller
 * (the route layer), not here — this module always writes what it is given.
 *
 * @param {{ file: string }} options
 * @returns {object} the draft store.
 */
export function createDraftStore(options) {
  const file = options.file
  /** @type {Map<string, object> | null} */
  let cache = null

  /**
   * Load the file, tolerating a missing or corrupt one.
   *
   * A corrupt file must not brick the panel: drafts are a convenience, and
   * losing them is better than showing a review workspace that cannot open.
   *
   * @returns {Promise<Map<string, object>>}
   */
  async function load() {
    if (cache !== null) return cache
    /** @type {Map<string, object>} */
    const map = new Map()
    try {
      const text = await readFile(file, 'utf8')
      const doc = JSON.parse(text)
      if (Array.isArray(doc?.drafts)) {
        for (const draft of doc.drafts) {
          if (typeof draft?.id === 'string') map.set(draft.id, draft)
        }
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        // Not throwing: see above. The caller logs this once.
        cache = map
        return cache
      }
    }
    cache = map
    return cache
  }

  /**
   * Persist the in-memory map.
   *
   * `rename` is atomic on both NTFS and POSIX for the same volume, which is what
   * makes a half-written draft file impossible.
   *
   * @param {Map<string, object>} map
   */
  async function persist(map) {
    const drafts = [...map.values()]
      .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
      .slice(0, MAX_DRAFTS)
    const doc = { format: 1, updatedAt: new Date().toISOString(), drafts }
    await mkdir(dirname(file), { recursive: true })
    const temp = `${file}.${process.pid}.${Date.now()}.tmp`
    await writeFile(temp, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
    await rename(temp, file)
  }

  /**
   * The draft id for one anchor.
   *
   * Scoped by PR *and* SHA: a note about a line in the old version is a
   * different object from a note about the same path in the new one, so it must
   * not silently overwrite it.
   *
   * @param {string} key
   * @param {string} sha
   * @returns {string}
   */
  function idFor(key, sha) {
    return `${key}@${sha}`
  }

  return {
    file,

    /**
     * All drafts, newest first, annotated with whether they are stale.
     *
     * @param {{ key: string, headSha: string | null }} anchor
     * @returns {Promise<object[]>}
     */
    async list(anchor) {
      const map = await load()
      const rows = []
      for (const draft of map.values()) {
        if (draft.key !== anchor.key) continue
        rows.push(decorate(draft, anchor.headSha))
      }
      rows.sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
      return rows
    },

    /**
     * Every draft for every PR written against one head SHA — used to warn
     * before a refresh that would strand them.
     *
     * @param {string} headSha
     * @returns {Promise<object[]>}
     */
    async listBySha(headSha) {
      const map = await load()
      return [...map.values()].filter((draft) => draft.sha === headSha)
    },

    /**
     * Create or replace a draft.
     *
     * Replaces by `(key, sha, path, line)` so typing the same note twice updates
     * it instead of collecting duplicates.
     *
     * @param {{ key: string, sha: string, path: string | null, line: number | null, body: string, kind?: string }} input
     * @returns {Promise<object>}
     */
    async save(input) {
      const key = requireString(input?.key, 'key', 200)
      const sha = requireString(input?.sha, 'sha', 64)
      const body = requireString(input?.body, 'body', MAX_BODY_CHARS)
      const path = input?.path === null || input?.path === undefined ? null : requireString(input.path, 'path', MAX_PATH_CHARS)
      const line =
        typeof input?.line === 'number' && Number.isInteger(input.line) && input.line > 0 ? input.line : null
      const kind = input?.kind === 'general' ? 'general' : input?.kind === 'inline' ? 'inline' : line === null ? 'general' : 'inline'

      const map = await load()
      // One draft per (PR, sha, path, line): that is the anchor a reviewer thinks
      // in. Two notes on the same line of the same version are one note being
      // edited.
      const id = `${idFor(key, sha)}#${path ?? ''}:${line ?? 0}`
      const existing = map.get(id)
      const now = new Date().toISOString()
      const draft = {
        id,
        key,
        sha,
        path,
        line,
        kind,
        body,
        createdAt: typeof existing?.createdAt === 'string' ? existing.createdAt : now,
        updatedAt: now,
      }
      map.set(id, draft)
      await persist(map)
      return draft
    },

    /**
     * Delete one draft by id.
     *
     * @param {string} id
     * @returns {Promise<boolean>} whether anything was removed.
     */
    async remove(id) {
      const map = await load()
      const removed = map.delete(String(id))
      if (removed) await persist(map)
      return removed
    },

    /** Drop every draft for one PR. Used when the user explicitly resets a review. */
    async clearKey(key) {
      const map = await load()
      let removed = 0
      for (const [id, draft] of map) {
        if (draft.key === key) {
          map.delete(id)
          removed += 1
        }
      }
      if (removed > 0) await persist(map)
      return removed
    },

    /** Test hook: forget the in-memory copy so the next read hits disk. */
    _reset() {
      cache = null
    },
  }
}

/**
 * Annotate a stored draft with its liveness against the current head.
 *
 * @param {object} draft
 * @param {string | null} headSha
 * @returns {object}
 */
function decorate(draft, headSha) {
  const current = typeof headSha === 'string' && headSha.length > 0 && draft.sha === headSha
  return {
    ...draft,
    state: current ? DRAFT_STATE.CURRENT : DRAFT_STATE.STALE,
    // Spelled out because "stale" alone does not say what to do about it.
    hint: current ? null : 'Written against an earlier commit; the lines may have moved.',
  }
}

/**
 * Validate one string field.
 *
 * Over-long input is REFUSED rather than sliced. Slicing a note body silently
 * loses the end of what someone typed, and slicing a path would move the note to
 * a different file — both are worse than an error the UI can show.
 *
 * @param {unknown} value
 * @param {string} field
 * @param {number} max
 * @returns {string}
 */
function requireString(value, field, max) {
  if (typeof value !== 'string') {
    const error = new Error(`${field} must be a string`)
    error.code = 'bad-request'
    throw error
  }
  if (value.length > max) {
    const error = new Error(`${field} is longer than ${max} characters`)
    error.code = 'bad-request'
    throw error
  }
  if (value.trim().length === 0 && field !== 'path') {
    const error = new Error(`${field} must not be empty`)
    error.code = 'bad-request'
    throw error
  }
  return value
}

/**
 * Resolve the draft file path from the Harness home.
 *
 * `storages/` is where the other plugins keep durable per-plugin state, and
 * keeping our file there means a profile reset or a backup already covers it.
 *
 * @param {string} home - the resolved DSH home.
 * @returns {string}
 */
export function draftFile(home) {
  return join(home, 'storages', 'dsh-pr-release-workspace', 'drafts.json')
}

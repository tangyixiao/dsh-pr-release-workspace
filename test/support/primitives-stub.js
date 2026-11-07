/**
 * A stand-in for `@deepseek-ai/dsh-client-ui-primitives` under `node --test`.
 *
 * The real package imports `.module.css` from every component module, which Node
 * cannot parse — so it cannot be `import`ed in a test at all. That is a property
 * of the packaging, not of the components, and stubbing it is the only way to
 * exercise our render code outside the browser.
 *
 * The stub keeps the parts that matter to us honest:
 *
 * - `DiffBlock` really computes a line diff, using the same npm `diff` package the
 *   real one uses, so `diffTotals` and the rendered rows are not faked.
 * - `StateDot` is `aria-hidden`, exactly like the real one, so a test that checks
 *   accessibility has to notice a status rendered as a bare dot.
 * - `Pill` renders a `<span>` when it has no `onClick` and a `<button>` when it
 *   does, matching the real component's shape decision.
 *
 * @module dsh-pr-release-workspace/test/support/primitives-stub
 */

import { createElement as h, Fragment } from 'react'
import { structuredPatch } from 'diff'

/**
 * @param {object} props
 * @returns {object}
 */
export function Button({ variant = 'ghost', size = 'md', icon, className, children, ...rest }) {
  return h('button', { type: 'button', className: ['stub-button', `stub-${variant}`, `stub-${size}`, className].filter(Boolean).join(' '), ...rest },
    icon === undefined || icon === null ? null : h('span', { className: 'stub-icon' }, icon),
    children,
  )
}

/**
 * @param {object} props
 * @returns {object}
 */
export function Input({ icon, className, ...rest }) {
  return h('span', { className: ['stub-input', className].filter(Boolean).join(' ') },
    icon === undefined || icon === null ? null : h('span', { className: 'stub-icon' }, icon),
    h('input', rest),
  )
}

/**
 * @param {object} props
 * @returns {object}
 */
export function Pill({ active = false, className, children, onClick, ...rest }) {
  if (onClick === undefined) {
    return h('span', { className: ['stub-pill', active ? 'stub-active' : null, className].filter(Boolean).join(' ') }, children)
  }
  return h('button', { type: 'button', className: ['stub-pill', 'stub-interactive', active ? 'stub-active' : null, className].filter(Boolean).join(' '), onClick, ...rest }, children)
}

/**
 * @param {object} props
 * @returns {object}
 */
export function Tag({ tone = 'outline', className, children }) {
  return h('span', { className: ['stub-tag', className].filter(Boolean).join(' '), 'data-tone': tone }, children)
}

/**
 * @param {object} props
 * @returns {object}
 */
export function StateDot({ state, size = 10, className }) {
  return h('span', {
    className: ['stub-dot', className].filter(Boolean).join(' '),
    'data-state': state,
    style: { width: size, height: size },
    'aria-hidden': 'true',
  })
}

const MAX_DIFF_EDIT_LENGTH = 256

/** Content lines, with a single trailing newline treated as a terminator. */
function contentLines(text) {
  if (typeof text !== 'string' || text.length === 0) return []
  const trimmed = text.endsWith('\n') ? text.slice(0, -1) : text
  return trimmed.split('\n')
}

function localHunks(diff) {
  const oldLines = contentLines(diff.oldText === null || diff.oldText === undefined ? '' : diff.oldText)
  const newLines = contentLines(diff.newText)
  const normalize = (lines) => lines.map((line) => `${line}\n`).join('')
  const patch = structuredPatch('', '', normalize(oldLines), normalize(newLines), undefined, undefined, {
    context: 3,
    maxEditLength: MAX_DIFF_EDIT_LENGTH,
  })
  return (
    patch?.hunks ?? [{ lines: [...oldLines.map((line) => `-${line}`), ...newLines.map((line) => `+${line}`)] }]
  )
}

/**
 * @param {object[]} diffs
 * @returns {{ added: number, removed: number }}
 */
export function diffTotals(diffs) {
  let added = 0
  let removed = 0
  for (const diff of diffs) {
    for (const hunk of localHunks(diff)) {
      for (const line of hunk.lines) {
        if (line.startsWith('+')) added += 1
        if (line.startsWith('-')) removed += 1
      }
    }
  }
  return { added, removed }
}

export const DEFAULT_DIFF_MAX_LINES = 16

/**
 * @param {object} props
 * @returns {object}
 */
export function DiffBlock({ diffs, labels, maxLines = DEFAULT_DIFF_MAX_LINES }) {
  const rows = []
  let key = 0
  for (const diff of diffs) {
    rows.push(h('div', { key: `p-${key++}`, className: 'stub-path' }, diff.path))
    for (const hunk of localHunks(diff)) {
      for (const line of hunk.lines) {
        const kind = line.startsWith('-') ? 'del' : line.startsWith('+') ? 'add' : 'context'
        rows.push(h('div', { key: `l-${key++}`, className: `stub-${kind}` }, line.slice(1)))
      }
    }
  }
  return h('div', { className: 'stub-diff', 'data-labels': Object.keys(labels || {}).sort().join(',') }, rows.slice(0, maxLines === 0 ? rows.length : 10_000))
}

/**
 * The real primitive buckets, it does not format: `relativeTime(at, now)` takes
 * two epoch-millisecond NUMBERS and returns `{ unit, n }` for the caller to
 * localize. An earlier stub here returned a string, which is exactly why the
 * panel's `{unit, n}`-as-React-child crash shipped past a green suite — a stub
 * that is kinder than the real API hides the bug it should catch.
 *
 * @param {number} at - epoch ms of the dated moment.
 * @param {number} now - current epoch ms.
 * @returns {{ unit: string, n: number }}
 */
export function relativeTime(at, now) {
  const MIN = 60_000
  const HOUR = 3_600_000
  const DAY = 86_400_000
  const diff = Math.max(0, now - at)
  if (diff < MIN) return { unit: 'now', n: 0 }
  if (diff < HOUR) return { unit: 'minutes', n: Math.floor(diff / MIN) }
  if (diff < DAY) return { unit: 'hours', n: Math.floor(diff / HOUR) }
  if (diff < 30 * DAY) return { unit: 'days', n: Math.floor(diff / DAY) }
  if (diff < 365 * DAY) return { unit: 'months', n: Math.floor(diff / (30 * DAY)) }
  return { unit: 'years', n: Math.floor(diff / (365 * DAY)) }
}

export function Tooltip({ children }) {
  return children === undefined ? null : h(Fragment, null, children)
}

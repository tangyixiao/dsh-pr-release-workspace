import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadBundle } from './support/client-harness.js'

async function render(text) {
  const { PRW } = await loadBundle({ primitives: {} })
  return renderToStaticMarkup(h('div', null, PRW.util.bodyBlocks(text)))
}

test('PR bodies render headings, nested lists, emphasis, quotes, tables and task lists', async () => {
  const html = await render('## Summary\n\n**修复**与 _说明_，~~旧版~~。\n\n- Evidence\n  - Nested\n- [x] Built\n- [ ] Reviewed\n\n> Quote\n\n| 列 | 状态 |\n| --- | --- |\n| CI | 通过 |')
  for (const tag of ['h2', 'strong', 'em', 's', 'ul', 'li', 'blockquote', 'table', 'th', 'td']) {
    assert.ok(html.includes('<' + tag), 'missing Markdown structure: ' + tag)
  }
  assert.match(html, /type="checkbox" disabled="" readonly="" checked=""/)
  assert.match(html, /prw-tableScroll/)
  assert.ok(!html.includes('<p class="prw-body"'), 'paragraphs must not inherit page padding or scrolling')
})

test('fences preserve blank lines and diff language without printing it as code', async () => {
  const html = await render('```diff\n- old\n\n+ new\n```')
  assert.match(html, /data-language="diff"/)
  assert.match(html, /<code>- old\n\n\+ new\n<\/code>/)
})

test('links, entities and code render while raw HTML and hostile URLs remain inert', async () => {
  const html = await render('[Release](https://github.com/o/r/releases) &amp; `x < y`\n\n<img src=x onerror=alert(1)>\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1)) [x](jav&#x61;script:alert(1)) [x](data:text/html,test)\n\n![chart](https://example.com/tracker.png)')
  assert.match(html, /href="https:\/\/github.com\/o\/r\/releases"/)
  assert.match(html, /<code>x &lt; y<\/code>/)
  assert.ok(!/<(?:img|script|iframe)\b/i.test(html))
  assert.ok(!/href="(?:javascript:|data:)/i.test(html))
  assert.match(html, /rel="noreferrer noopener"/)
})

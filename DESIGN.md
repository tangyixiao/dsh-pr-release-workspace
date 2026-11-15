---
name: PR & Release Workspace
description: A compact workspace for pull requests, diffs, local notes and release evidence inside DSH.
colors:
  accent: "#86a9ff"
  surface: "#15171b"
  surface-raised: "#1c2027"
  surface-active: "#292f39"
  surface-hover: "#222833"
  selection: "#28354b"
  text: "#edf0f4"
  text-secondary: "#c4cbd6"
  text-muted: "#9fa9b8"
  border-subtle: "#303641"
  border: "#3c4451"
  border-strong: "#566071"
  success: "#82d5a2"
  danger: "#ff9a9a"
  warning: "#e8be72"
  merged: "#c7abff"
typography:
  title:
    fontFamily: 'Inter, "Segoe UI", "Microsoft YaHei", sans-serif'
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: 'Inter, "Segoe UI", "Microsoft YaHei", sans-serif'
    fontSize: "13px"
    lineHeight: 1.5
  metadata:
    fontSize: "12px"
  badge:
    fontSize: "11px"
    lineHeight: 1.3
  markdown:
    fontSize: "13px"
    lineHeight: 1.75
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "12px"
rounded:
  inline-code: "4px"
  badge: "5px"
  control: "7px"
  list: "9px"
  card: "10px"
spacing:
  control-gap: "8px"
  compact-inset: "14px"
  body-top: "16px"
  desktop-inset: "24px"
components:
  button-outline:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
  search:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
    height: "36px"
  status-badge:
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.badge}"
    padding: "3px 7px"
  detail-card:
    rounded: "{rounded.card}"
    padding: "12px 14px"
---

# Design System: PR & Release Workspace

## Overview

**Creative North Star: "Operate"**

Retain the host's compact, dark operational workspace: a clear search row, understated tabs, aligned pull request rows and readable detail content. This is a repair of the existing identity. The approved composition establishes the desktop list and narrow arrangement; the current implementation adds explicit lifecycle, CI and review labels and rendered Markdown.

The normative values below come from `src/client/20-styles.js` and `src/client/50-parts.js`, including the stylesheet's later overrides. The frontmatter records dark fallback values; host `--dsw-alias-*` properties take precedence. These values are source declarations, not measured browser styles. The reference composition is a visual direction, not a runtime screenshot or product capability claim.

**Key Characteristics:**

- Compact Chinese and English typography with a consistent control height.
- Flat surfaces, thin separators and restrained blue emphasis.
- Separate, readable labels for PR lifecycle, CI and review.
- Scoped Markdown that fits both desktop and narrow panels.

## Colors

Use host aliases at every supported theme boundary. Dark defaults make native controls and status text legible when older hosts lack shared components.

| Frontmatter token | Host property | Use |
| --- | --- | --- |
| `accent` | `--dsw-alias-brand-primary-new-colorprimary-new-color` | Links, active tab underline, focus outline |
| `surface` | `--dsw-alias-bg-layer-1` | Root surface and editable text area |
| `surface-raised` | `--dsw-alias-bg-layer-2` | Search, native buttons, list header, code and comments |
| `surface-active` | `--dsw-alias-bg-layer-3` | Active pill |
| `surface-hover` | `--dsw-alias-interactive-bg-hover` | Interactive hover |
| `selection` | `--dsw-alias-button-ghost-active-fill` | Selected row and text selection |
| `text` | `--dsw-alias-label-primary` | Primary text |
| `text-secondary` | `--dsw-alias-label-secondary` | Secondary text and neutral badges |
| `text-muted` | `--dsw-alias-label-tertiary` | Metadata, helper copy and placeholders |
| `border-subtle` | `--dsw-alias-border-l1` | Row separators; also the skeleton fallback via `--dsw-alias-bg-skeleton` |
| `border` | `--dsw-alias-border-l2` | List, card, badge and control borders |
| `border-strong` | `--dsw-alias-border-l3` | Search/editor border and quote rule |
| `success` | `--dsw-alias-state-success-primary` | Open, passing or approved status |
| `danger` | `--dsw-alias-state-error-primary` | Closed, failing or changes requested status |
| `warning` | `--dsw-alias-state-warn-label` | Draft or pending status; stale draft border uses `--dsw-alias-state-warn-primary` |
| `merged` | None in current source | Merged PR badge |

Selected-row border uses `--dsw-alias-button-ghost-active-border` with the accent fallback. Status color supplements visible text; it does not replace it.

## Typography

The root stack is `Inter, "Segoe UI", "Microsoft YaHei", sans-serif`. Use 13px body text at 1.5 line height, an 18px/600 title at 1.4, 12px metadata and 11px status badges. PR titles use weight 600 and 1.5 line height. Time and PR numbers use tabular numerals. Native buttons, inputs and selects inherit the root font.

Markdown is 13px at 1.75 line height. Its headings use 22/18/16/14px, weight 600 and 1.4 line height, scoped under `.prw-markdown`. Code uses 12px monospace; inline Markdown code uses `ui-monospace, Consolas, monospace`. Preserve real Chinese text when checking wrapping and hierarchy.

## Layout

The root fills its host panel, uses a column flex layout, and establishes an inline-size container. The body scrolls independently with `min-height:0`. Desktop header inset is `20px 24px 0`; body inset is `16px 24px 24px`. Search grows into available width beside the refresh action, with an 8px gap.

The list is one bordered surface. Header and rows share `minmax(0,1fr) 300px 76px` columns and a 16px gap: title/repository, three status labels, then update time. Rows have a 72px minimum height and `13px 14px` padding. Long desktop titles truncate; repository metadata sits below the title.

At a container width of 1000px or less, status/time columns become 240px/70px with a 10px gap. At 680px or less, the header uses `16px 14px 0`, the body uses 14px, and the list header disappears. The title and repository span the row; badges and update time occupy the next line. Titles and repositories wrap, cards use 12px padding and key/value content can wrap. These are container queries, not viewport breakpoints.

## Elevation & Depth

The panel uses tonal layering and 1px borders without component shadows. Code, comment blocks and list headers use the raised surface; selected rows use the selection surface. Skeletons pulse between .55 and 1 opacity over 1.4s with ease-in-out timing; `prefers-reduced-motion: reduce` disables this animation.

## Shapes

Use 7px control corners, a 9px list enclosure, 10px detail/comment/editor corners and 5px outlined badges. List rows have square corners inside the enclosure. Shell tabs use square corners and a 2px active underline. Inline code uses 4px corners. Focus outlines are 2px; preserve the source's outside control outline and inset row outline.

## Components

- **Search and actions:** search height is 36px; native buttons and pills have a 34px minimum height. Retain visible borders, readable placeholders, hover, disabled opacity .5 and keyboard focus when shared host components are unavailable. Prefer the shared host Button when present and the styled native fallback otherwise.
- **Navigation:** distinguish the shell's underline tabs from local pills. Keep current/selected state exposed through the source's ARIA attributes. Tabs may wrap with the panel width.
- **PR row:** preserve title/repository hierarchy and the separate lifecycle, CI and review badges. Lifecycle precedence is merged, closed, draft, open, then unknown. CI labels distinguish success, failure, pending, cancelled, skipped, not configured and unknown. Review labels distinguish approved, changes requested, required and no decision. A missing fact must remain unknown or unconfigured as appropriate.
- **Markdown:** scope all formatting to `.prw-markdown`. Use real paragraph/list/heading/quote structure, inline and fenced code, task checkboxes, links and a horizontally scrollable table wrapper. Paragraphs have a 12px bottom margin; lists use 24px indentation. Fenced code scrolls locally and retains its language label. Avoid global prose rules that alter host UI.
- **Detail and comments:** use bordered cards, compact metadata and a raised comment surface. Local notes remain distinct from GitHub comments. Release facts stay individually readable: merge alone does not establish package or market publication.
- **States:** loading skeletons are hidden from assistive reading while their list is busy. Keep empty results distinct from failures. Explain authentication, missing GitHub CLI, rate limiting and offline errors with the available actionable text and retry control.

## Do's and Don'ts

### Do:

- Do preserve host alias overrides with explicit dark fallbacks.
- Do show lifecycle, CI and review as separate text labels.
- Do check real Chinese and English content in desktop and narrow panels.
- Do keep Markdown styling scoped and wide code or tables locally scrollable.

### Don't:

- Don't collapse unavailable status into success or an unexplained dash.
- Don't let native fallback controls lose typography, borders or focus state.
- Don't infer registry or market publication from a merged PR.
- Don't present concept images, local captures or source tokens as live host verification.

<!-- Documentation provenance: current CSS/parts and README inspected 2026-11-15.
Approved composition: C:/Users/tangy/.codex/generated_images/01a1df84-fdbe-7612-b6b4-021389d8fccc/exec-99340c87-50c5-4314-9795-1ef1249d52c6.png
Local implementation evidence: work/pr-state-markdown/desktop.jpg and detail-mobile.jpg.
Formal context engine, seed and detector unavailable after download failure; no generated IDs, computed-style measurements or synthetic tonal ramps are claimed. -->

    /* =================================================================== */
    /* primitives + icons                                                  */
    /* =================================================================== */

    /**
     * Pull just the primitives this panel uses.
     *
     * Named rather than spread so a future version that removes one is a visible
     * `undefined` at the call site instead of a silently missing button.
     */
    PRW.ui = (function () {
      function pick(name) {
        var value = P === null || P === undefined ? undefined : P[name]
        return typeof value === 'function' ? value : null
      }
      return {
        Button: pick('Button'),
        Input: pick('Input'),
        Pill: pick('Pill'),
        Tag: pick('Tag'),
        StateDot: pick('StateDot'),
        DiffBlock: pick('DiffBlock'),
        diffTotals: pick('diffTotals'),
        Tooltip: pick('Tooltip'),
        // A missing primitive must degrade to a plain element, not crash the
        // panel: an older host without `Tag` should still show the PR list.
        hasTag: pick('Tag') !== null,
        hasDiff: pick('DiffBlock') !== null,
      }
    })()

    /**
     * Render a tag, falling back to a plain span when the primitive is absent.
     *
     * @param {object} props
     * @returns {object}
     */
    function tag(props) {
      var Tag = PRW.ui.Tag
      if (Tag !== null) return h(Tag, { tone: props.tone }, props.children)
      return h('span', { className: 'prw-badge', 'data-tone': props.tone }, props.children)
    }

    /**
     * A state dot plus its text label.
     *
     * `StateDot` is `aria-hidden`, so the dot is decoration only; this wrapper is
     * the shape every status in the panel uses so the pairing cannot be forgotten.
     *
     * @param {{ state: string, label: string, title?: string }} props
     * @returns {object}
     */
    function status(props) {
      var Dot = PRW.ui.StateDot
      return h(
        'span',
        { className: 'prw-row prw-secondary', title: props.title || undefined },
        Dot === null ? null : h(Dot, { state: props.state, size: 8 }),
        h('span', null, props.label),
      )
    }

    /**
     * Small inline icon set.
     *
     * Hand-drawn here on purpose: the sidebar contract hands the entry a
     * `{size, active}` and expects the entry to draw its own glyph, and pulling
     * an icon package in would add a client dependency for six paths. Each icon is
     * a stroke-only path on a 16-unit grid, `currentColor` throughout, so it
     * inherits the sidebar's active/inactive colour without any prop wiring.
     */
    PRW.icons = (function () {
      function wrap(size, children, extra) {
        var dimension = typeof size === 'number' && size > 0 ? size : 16
        var props = {
          width: dimension,
          height: dimension,
          viewBox: '0 0 16 16',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
        }
        var key
        if (extra) {
          for (key in extra) props[key] = extra[key]
        }
        return h('svg', props, children)
      }

      /**
       * The sidebar glyph: a pull-request node pair — one branch curving into
       * another with a review tick. Reads as "review" at 16px without text.
       */
      function pullRequest(size, active) {
        return wrap(size, [
          h('circle', { key: 'a', cx: 4.2, cy: 3.4, r: 1.7 }),
          h('circle', { key: 'b', cx: 4.2, cy: 12.6, r: 1.7 }),
          h('circle', { key: 'c', cx: 11.8, cy: 6.2, r: 1.7 }),
          h('path', { key: 'd', d: 'M4.2 5.1v5.8' }),
          h('path', { key: 'e', d: 'M11.8 7.9v5.4' }),
          h('path', { key: 'f', d: 'M4.2 9.6c0-1.9 1.6-3.4 3.5-3.4h2.3' }),
        ], active ? { strokeWidth: 1.7 } : null)
      }

      /** A chevron for disclosure rows. */
      function chevron(size, open) {
        return wrap(size, h('path', { d: open ? 'M4 6.5l4 4 4-4' : 'M6.5 4l4 4-4 4' }))
      }

      /** A branch, for the base/head line. */
      function branch(size) {
        return wrap(size, [
          h('circle', { key: 'a', cx: 4.5, cy: 3.5, r: 1.6 }),
          h('circle', { key: 'b', cx: 4.5, cy: 12.5, r: 1.6 }),
          h('circle', { key: 'c', cx: 11.5, cy: 5.5, r: 1.6 }),
          h('path', { key: 'd', d: 'M4.5 5.1v5.8' }),
          h('path', { key: 'e', d: 'M11.5 7.1v2.4a3 3 0 0 1-3 3H8' }),
        ])
      }

      /** A check inside a circle, for a passing check. */
      function check(size) {
        return wrap(size, [
          h('circle', { key: 'a', cx: 8, cy: 8, r: 6 }),
          h('path', { key: 'b', d: 'M5.4 8.2l1.8 1.8 3.5-3.6' }),
        ])
      }

      /** A cross inside a circle, for a failing check. */
      function cross(size) {
        return wrap(size, [
          h('circle', { key: 'a', cx: 8, cy: 8, r: 6 }),
          h('path', { key: 'b', d: 'M6 6l4 4M10 6l-4 4' }),
        ])
      }

      /** A dot cluster, for "checks pending". */
      function dots(size) {
        return wrap(size, [
          h('circle', { key: 'a', cx: 4, cy: 8, r: 1 }),
          h('circle', { key: 'b', cx: 8, cy: 8, r: 1 }),
          h('circle', { key: 'c', cx: 12, cy: 8, r: 1 }),
        ], { fill: 'currentColor' })
      }

      /** An external-link arrow. */
      function external(size) {
        return wrap(size, [
          h('path', { key: 'a', d: 'M9 3h4v4' }),
          h('path', { key: 'b', d: 'M13 3L7.5 8.5' }),
          h('path', { key: 'c', d: 'M12 10v2.5A1.5 1.5 0 0 1 10.5 14h-6A1.5 1.5 0 0 1 3 12.5v-6A1.5 1.5 0 0 1 4.5 5H7' }),
        ])
      }

      /** A comment bubble. */
      function comment(size) {
        return wrap(size, h('path', { d: 'M3 4.5A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5v4A1.5 1.5 0 0 1 11.5 10H7l-3 3v-3H4.5A1.5 1.5 0 0 1 3 8.5z' }))
      }

      /** A file outline. */
      function file(size) {
        return wrap(size, [
          h('path', { key: 'a', d: 'M9 2H4.5A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V6z' }),
          h('path', { key: 'b', d: 'M9 2v4h4' }),
        ])
      }

      /** A pen, for a local note. */
      function pen(size) {
        return wrap(size, [
          h('path', { key: 'a', d: 'M11.2 2.8l2 2L6 12H4v-2z' }),
          h('path', { key: 'b', d: 'M9.8 4.2l2 2' }),
        ])
      }

      return {
        pullRequest: pullRequest,
        chevron: chevron,
        branch: branch,
        check: check,
        cross: cross,
        dots: dots,
        external: external,
        comment: comment,
        file: file,
        pen: pen,
      }
    })()

    /* =================================================================== */
    /* shared presentational pieces                                        */
    /* =================================================================== */

    /**
     * The skeleton rows shown while a list loads.
     *
     * @param {{ rows: number }} props
     * @returns {object}
     */
    function skeletons(props) {
      var rows = typeof props.rows === 'number' ? props.rows : 5
      var out = []
      var i
      for (i = 0; i < rows; i += 1) {
        out.push(
          h('div', { key: 'sk-' + i, className: 'prw-item', 'aria-hidden': 'true' },
            h('div', { className: 'prw-itemMain' },
              h('div', { className: 'prw-skel', style: { width: (52 + ((i * 13) % 34)) + '%' } }),
              h('div', { className: 'prw-skel', style: { width: (28 + ((i * 7) % 20)) + '%; height: 9px' } }),
            ),
          ),
        )
      }
      return h('div', { className: 'prw-list', 'aria-busy': 'true' }, out)
    }

    /**
     * One failure, explained in terms the reader can act on.
     *
     * GitHub failures are not interchangeable: "not signed in" means run a
     * command, "rate limited" means wait, and "the request failed" means try
     * again later. Collapsing them into one message is the thing that makes a
     * panel feel broken rather than honest.
     *
     * @param {{ error: object, t: Function, onRetry?: Function }} props
     * @returns {object}
     */
    function failure(props) {
      var t = props.t
      var error = props.error || {}
      var code = typeof error.code === 'string' ? error.code : 'internal'
      var title = t('state.refused')
      var hint = null

      if (code === 'not-authenticated') {
        title = t('state.notSignedIn')
        hint = t('state.notSignedInHint')
      } else if (code === 'gh-missing') {
        title = t('state.ghMissing')
        hint = t('state.ghMissingHint')
      } else if (code === 'rate-limited') {
        title = t('state.rateLimited')
        hint = typeof error.retryAfterSeconds === 'number' ? fill(t('state.retryIn'), { seconds: error.retryAfterSeconds }) : null
      } else if (code === 'offline') {
        title = t('state.offline')
      }

      return h(
        'div',
        { className: 'prw-state', role: 'alert' },
        h('div', { className: 'prw-stateTitle' }, title),
        hint === null ? null : h('div', { className: 'prw-note' }, hint),
        props.onRetry === undefined
          ? null
          : h(
              PRW.ui.Button || 'button',
              { size: 'sm', variant: 'outline', onClick: props.onRetry },
              t('action.refresh'),
            ),
      )
    }

    /**
     * An empty list, with an honest distinction between "nothing" and
     * "could not check".
     *
     * @param {{ text: string }} props
     * @returns {object}
     */
    function empty(props) {
      return h('p', { className: 'prw-note', style: { padding: '12px 4px', margin: 0 } }, props.text)
    }

    /**
     * The verdict label for a check rollup.
     *
     * @param {string} verdict
     * @param {Function} t
     * @returns {string}
     */
    function ciLabel(verdict, t) {
      if (verdict === 'success') return t('ci.success')
      if (verdict === 'failure') return t('ci.failure')
      if (verdict === 'pending') return t('ci.pending')
      if (verdict === 'cancelled') return t('ci.cancelled')
      if (verdict === 'skipped') return t('ci.skipped')
      if (verdict === 'not_configured') return t('ci.notConfigured')
      return t('ci.unknown')
    }

    /**
     * The open/closed/draft/merged badge for a pull request.
     *
     * @param {{ pr: object, t: Function }} props
     * @returns {object|null}
     */
    function prStateBadge(props) {
      var pr = props.pr
      var t = props.t
      if (pr === null || pr === undefined) return null
      if (pr.merged === true) return tag({ tone: 'success', children: t('pr.merged') })
      if (pr.state === 'closed') return tag({ tone: 'danger', children: t('pr.closed') })
      if (pr.draft === true) return tag({ tone: 'warning', children: t('pr.draft') })
      return tag({ tone: 'neutral', children: t('pr.open') })
    }

    /**
     * One row in a grouped list.
     *
     * Rendered as a div with button semantics rather than a `<button>`: the row
     * contains its own link to GitHub, and nesting an anchor inside a button is
     * invalid HTML that browsers resolve unpredictably.
     *
     * @param {{ item: object, active: boolean, onSelect: Function, t: Function }} props
     * @returns {object}
     */
    function prRow(props) {
      var item = props.item
      var t = props.t
      var repo = item.owner + '/' + item.repo
      return h(
        'div',
        Object.assign(
          {
            className: 'prw-item',
            'aria-current': props.active === true ? 'true' : 'false',
            title: item.title,
          },
          PRW.util.activate(function () {
            props.onSelect(item)
          }),
        ),
        h(
          'div',
          { className: 'prw-itemMain' },
          h(
            'div',
            { className: 'prw-itemTitle' },
            h('span', { className: 'prw-itemNum' }, '#' + item.number),
            h('span', { className: 'prw-itemName' }, item.title || '(untitled)'),
          ),
          h(
            'div',
            { className: 'prw-itemMeta' },
            h('span', { className: 'prw-itemRepo', title: repo }, repo),
            h('span', { className: 'prw-mono' }, item.headRefName || ''),
            PRW.util.when(item.updatedAt, t) === ''
              ? null
              : h('span', null, PRW.util.when(item.updatedAt, t)),
          ),
        ),
        h(
          'div',
          { className: 'prw-itemTags' },
          item.ci && item.ci.verdict !== 'not_configured' && item.ci.verdict !== 'unknown'
            ? h(
                'span',
                { className: 'prw-row', title: ciLabel(item.ci.verdict, t) },
                h(
                  PRW.ui.StateDot || 'span',
                  { state: PRW.util.dotFor(item.ci.verdict), size: 8 },
                ),
              )
            : null,
          item.draft === true ? tag({ tone: 'warning', children: t('pr.draft') }) : null,
          item.reviewDecision === 'APPROVED'
            ? tag({ tone: 'success', children: '✓' })
            : item.reviewDecision === 'CHANGES_REQUESTED'
              ? tag({ tone: 'danger', children: '!' })
              : null,
        ),
      )
    }

    /**
     * A `<Button>` when the primitive exists, a native button otherwise.
     *
     * @param {object} props
     * @returns {object}
     */
    function button(props) {
      var Button = PRW.ui.Button
      var pass = { onClick: props.onClick, disabled: props.disabled, title: props.title }
      if (Button !== null) {
        return h(Button, Object.assign({}, pass, { size: props.size || 'sm', variant: props.variant || 'ghost' }), props.children)
      }
      return h('button', Object.assign({ type: 'button', className: 'prw-badge' }, pass), props.children)
    }

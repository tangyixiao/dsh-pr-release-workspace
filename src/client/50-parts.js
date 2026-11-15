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
      var key = pr.merged === true || pr.state === 'merged' ? 'merged'
        : pr.state === 'closed' ? 'closed' : pr.draft === true ? 'draft'
        : pr.state === 'open' ? 'open' : 'unknown'
      var tone = key === 'merged' ? 'merged' : key === 'closed' ? 'danger'
        : key === 'open' ? 'success' : 'neutral'
      return h('span', { className: 'prw-badge prw-stateBadge', 'data-tone': tone },
        PRW.icons.lifecycle(pr, 13), h('span', null, t('pr.' + key)))
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
            h('span', { className: 'prw-prIcon', 'data-state': item.merged || item.state === 'merged' ? 'merged' : item.state === 'closed' ? 'closed' : item.draft ? 'draft' : item.state },
              PRW.icons.lifecycle(item, 16)),
            h('span', { className: 'prw-itemNum' }, '#' + item.number),
            h('span', { className: 'prw-itemName' }, item.title || '(untitled)'),
          ),
          h(
            'div',
            { className: 'prw-itemMeta' },
            h('span', { className: 'prw-itemRepo', title: repo }, repo),
            h('span', { className: 'prw-mono' }, item.headRefName || ''),
          ),
        ),
        h(
          'div',
          { className: 'prw-itemTags' },
          prStateBadge({ pr: item, t: t }),
          tag({ tone: PRW.util.toneFor(item.ci ? item.ci.verdict : 'unknown'),
            children: ciLabel(item.ci ? item.ci.verdict : 'unknown', t) }),
          reviewBadge(item, t),
        ),
        h('time', { className: 'prw-itemTime', dateTime: item.updatedAt || undefined,
          title: item.updatedAt || '' }, PRW.util.when(item.updatedAt, t)),
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
      return h('button', Object.assign({ type: 'button', className: 'prw-button' }, pass), props.children)
    }

    function reviewBadge(pr, t) {
      var decision = pr.reviewDecision
      var key = decision === 'APPROVED' ? 'review.approved'
        : decision === 'CHANGES_REQUESTED' ? 'review.changes'
        : decision === 'REVIEW_REQUIRED' ? 'review.required' : 'review.none'
      return tag({ tone: decision === 'APPROVED' ? 'success'
        : decision === 'CHANGES_REQUESTED' ? 'danger' : 'neutral', children: t(key) })
    }

    PRW.Pill = function Pill(props) {
      return h('button', { type: 'button', className: 'prw-tab',
        role: props.role, 'aria-selected': props.role === 'tab' ? props.active === true : undefined,
        'aria-pressed': props.role === 'tab' ? undefined : props.active === true,
        'data-active': props.active === true ? 'true' : 'false', onClick: props.onClick }, props.children)
    }

    /* =================================================================== */
    /* pull request detail                                                 */
    /* =================================================================== */

    /**
     * The detail view for one pull request.
     *
     * Four loads with different lifetimes: the PR itself, its diff, its review
     * comments, and its local drafts. The PR loads first because every other view
     * keys off its head SHA — the diff and the drafts are both version-anchored,
     * and showing a diff under a newer title would be a lie about which commit
     * the lines belong to.
     *
     * @param {{ t: Function, target: object, onBack: Function, identity: object }} props
     * @returns {object}
     */
    PRW.Detail = function Detail(props) {
      var t = props.t
      var target = props.target
      var tabPair = React.useState('overview')
      var tab = tabPair[0]
      var setTab = tabPair[1]

      var pullRun = React.useCallback(
        function (signal) {
          return PRW.util.call('pull', toTargetPayload(target), { signal: signal })
        },
        [target.key],
      )
      var pull = PRW.useRequest(pullRun)
      var pr = pull.state.value

      var diffRun = React.useCallback(
        function (signal) {
          return PRW.util.call('diff', toTargetPayload(target), { signal: signal })
        },
        [target.key],
      )
      var diff = PRW.useRequest(diffRun)

      var draftsRun = React.useCallback(
        function (signal) {
          return PRW.util.call('drafts', { key: target.key, headSha: pr === null ? null : pr.headSha }, { signal: signal })
        },
        [target.key, pr === null ? null : pr.headSha],
      )
      var drafts = PRW.useRequest(draftsRun)

      if (pull.state.status === 'error') {
        return h(
          'div',
          { className: 'prw-root' },
          detailHeader(t, target, null, props.onBack, null),
          h('div', { className: 'prw-body' }, failure({ error: pull.state.error, t: t, onRetry: pull.reload })),
        )
      }

      return h(
        'div',
        { className: 'prw-root' },
        detailHeader(t, target, pr, props.onBack, pull.reload),
        pr === null
          ? h('div', { className: 'prw-body' }, skeletons({ rows: 4 }))
          : h(
              'div',
              { className: 'prw-tabs', role: 'tablist' },
              [
                { key: 'overview', label: 'detail.overview' },
                { key: 'files', label: 'detail.files' },
                { key: 'comments', label: 'detail.comments' },
                { key: 'drafts', label: 'detail.drafts' },
              ].map(function (entry) {
                return h(
                  (PRW.ui.Pill || 'button'),
                  {
                    key: entry.key,
                    active: tab === entry.key,
                    onClick: function () {
                      setTab(entry.key)
                    },
                  },
                  t(entry.label),
                )
              }),
            ),
        h(
          'div',
          { className: 'prw-body' },
          pr === null
            ? skeletons({ rows: 4 })
            : h(
                'div',
                { className: 'prw-detail' },
                tab === 'overview' ? overview({ t: t, pr: pr, target: target }) : null,
                tab === 'files' ? filesView({ t: t, state: diff.state, target: target, pr: pr, drafts: drafts, onRetry: diff.reload }) : null,
                tab === 'comments'
                  ? commentsView({ t: t, pr: pr })
                  : null,
                tab === 'drafts'
                  ? draftsView({ t: t, state: drafts.state, pr: pr, target: target, onChanged: drafts.reload })
                  : null,
              ),
        ),
      )
    }

    /**
     * The target payload every endpoint takes.
     *
     * @param {object} target
     * @returns {{ host: string, owner: string, repo: string, number: number }}
     */
    function toTargetPayload(target) {
      return { host: target.host || 'github.com', owner: target.owner, repo: target.repo, number: target.number }
    }

    /**
     * The detail header: back, title, number, state and the GitHub link.
     *
     * @param {Function} t
     * @param {object} target
     * @param {object|null} pr
     * @param {Function} onBack
     * @param {Function|null} onRefresh
     * @returns {object}
     */
    function detailHeader(t, target, pr, onBack, onRefresh) {
      var title = pr === null ? target.owner + '/' + target.repo + ' #' + target.number : pr.title
      var url = pr !== null && pr.url ? pr.url : 'https://github.com/' + target.owner + '/' + target.repo + '/pull/' + target.number
      return h(
        'div',
        { className: 'prw-head' },
        h(
          'div',
          { className: 'prw-row', style: { gap: '6px' } },
          button({ onClick: onBack, children: '← ' + t('action.back') }),
          h('span', { className: 'prw-grow' }),
          onRefresh === null ? null : button({ onClick: onRefresh, children: t('action.refresh') }),
          h(
            'a',
            { className: 'prw-link prw-row', href: url, target: '_blank', rel: 'noreferrer noopener' },
            PRW.icons.external(13),
            h('span', null, t('action.openOnGithub')),
          ),
        ),
        h('h2', { className: 'prw-title prw-wrap' }, title),
        h(
          'div',
          { className: 'prw-row', style: { gap: '8px', flexWrap: 'wrap' } },
          h('span', { className: 'prw-mono prw-muted' }, target.owner + '/' + target.repo + ' #' + target.number),
          pr === null ? null : prStateBadge({ pr: pr, t: t }),
          pr === null
            ? null
            : h('span', { className: 'prw-note' },
                PRW.icons.branch(12),
                ' ' + (pr.headRefName || '?') + ' → ' + (pr.baseRefName || '?')),
          pr === null ? null : h('span', { className: 'prw-mono prw-muted', title: pr.headSha || '' }, (pr.headSha || '').slice(0, 7)),
        ),
      )
    }

    /**
     * The overview tab: description, metadata, and the check rollup.
     *
     * @param {{ t: Function, pr: object, target: object }} props
     * @returns {object}
     */
    function overview(props) {
      var t = props.t
      var pr = props.pr
      var body = PRW.util.bodyBlocks(pr.body)
      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
        h(
          'div',
          { className: 'prw-card' },
          h(
            'div',
            { className: 'prw-cardHead' },
            h('h3', { className: 'prw-cardTitle' }, pr.author === null ? '' : '@' + pr.author),
            h('span', { className: 'prw-note' }, PRW.util.when(pr.createdAt, t)),
          ),
          body.length === 0 ? h('p', { className: 'prw-note', style: { margin: 0 } }, t('detail.noBody')) : body,
        ),
        h(
          'div',
          { className: 'prw-card' },
          h('div', { className: 'prw-kv' },
            h('span', { className: 'prw-kvKey' }, t('detail.base')),
            h('span', { className: 'prw-mono' }, pr.baseRefName || '—'),
            h('span', { className: 'prw-kvKey' }, t('detail.head')),
            h('span', { className: 'prw-mono' }, pr.headRefName || '—'),
            h('span', { className: 'prw-kvKey' }, t('pr.files', { count: PRW.util.count(pr.counts.changedFiles) })),
            h('span', { className: 'prw-stat' },
              h('span', { className: 'prw-add' }, '+' + PRW.util.count(pr.counts.additions)),
              ' ',
              h('span', { className: 'prw-del' }, '−' + PRW.util.count(pr.counts.deletions))),
            h('span', { className: 'prw-kvKey' }, t('detail.mergeable')),
            h('span', null, mergeableText(pr, t)),
          ),
        ),
        h(
          'div',
          { className: 'prw-card' },
          h(
            'div',
            { className: 'prw-cardHead' },
            h('h3', { className: 'prw-cardTitle' }, t('detail.checks')),
            status({ state: PRW.util.dotFor(pr.ci.verdict), label: ciLabel(pr.ci.verdict, t) }),
          ),
          pr.ci.verdict === 'not_configured'
            ? h('p', { className: 'prw-note', style: { margin: 0 } }, t('ci.notConfigured'))
            : h(
                'p',
                { className: 'prw-note', style: { margin: 0 } },
                fill(t('ci.count'), {
                  passed: pr.ci.counts.success,
                  failed: pr.ci.counts.failure,
                  pending: pr.ci.counts.pending,
                }),
              ),
          Array.isArray(pr.ci.checks) && pr.ci.checks.length > 0
            ? h(
                'div',
                { className: 'prw-facts' },
                pr.ci.checks.slice(0, 40).map(function (check, index) {
                  return h(
                    'div',
                    { className: 'prw-fact', key: 'check-' + index },
                    h(PRW.ui.StateDot || 'span', { state: PRW.util.dotFor(check.verdict), size: 8 }),
                    h('span', { className: 'prw-factName', title: check.name }, check.name),
                    h('span', { className: 'prw-factVal prw-muted' }, check.verdict),
                  )
                }),
              )
            : null,
        ),
        h(
          'p',
          { className: 'prw-note', style: { margin: 0 } },
          // Labelled, not a bare "0 · 0 · 0": three unlabelled numbers say
          // nothing about which count is which.
          fill(t('pr.comments'), { count: PRW.util.count(pr.comments.length) }) +
            ' · ' +
            fill(t('pr.reviews'), { count: PRW.util.count(pr.reviews.length) }) +
            (pr.reviewRequests.length === 0
              ? ''
              : ' · ' + fill(t('pr.reviewRequests'), { count: PRW.util.count(pr.reviewRequests.length) })),
        ),
      )
    }

    /**
     * The merge-state line, honest about not knowing.
     *
     * @param {object} pr
     * @param {Function} t
     * @returns {string}
     */
    function mergeableText(pr, t) {
      if (pr.merged === true) return t('pr.merged')
      if (pr.state !== 'open') return t('pr.closed')
      if (pr.mergeable === 'MERGEABLE') return t('detail.mergeable')
      if (pr.mergeable === 'CONFLICTING') return t('detail.conflicts')
      return t('detail.mergeUnknown')
    }

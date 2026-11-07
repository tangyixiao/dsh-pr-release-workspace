    /* =================================================================== */
    /* the workspace panel                                                 */
    /* =================================================================== */

    /**
     * The three PR groups, in display order.
     *
     * Kept as data rather than three copies of the same JSX so the "which group
     * is unconfirmed" case has exactly one place to be handled.
     */
    var GROUP_TABS = [
      { key: 'authored', label: 'tab.mine', empty: 'group.empty' },
      { key: 'reviewRequested', label: 'tab.review', empty: 'group.empty' },
      { key: 'teamReviewRequested', label: 'tab.team', empty: 'group.emptyTeam' },
    ]

    /**
     * The panel behind the sidebar entry.
     *
     * Owns three pieces of state: which tab is open, which PR (if any) is
     * selected, and the current search. The list and the detail view are separate
     * components so a detail reload cannot clear the list, and going back keeps
     * the list's scroll position because it was never unmounted from its data
     * hook's point of view — only hidden.
     *
     * @param {{ t: Function }} props
     * @returns {object}
     */
    PRW.Workspace = function Workspace(props) {
      var t = props.t
      var tabPair = React.useState('authored')
      var tab = tabPair[0]
      var setTab = tabPair[1]
      var selectedPair = React.useState(null)
      var selected = selectedPair[0]
      var setSelected = selectedPair[1]
      var queryPair = React.useState('')
      var query = queryPair[0]
      var setQuery = queryPair[1]
      var submittedPair = React.useState('')
      var submitted = submittedPair[0]
      var setSubmitted = submittedPair[1]

      var identity = PRW.useIdentity(true)

      // Search is its own load: typing must not refetch the three groups, and a
      // submitted search outranks the tab until it is cleared.
      var searchRun = React.useCallback(
        function (signal) {
          if (submitted.length === 0) return Promise.resolve(null)
          return PRW.util.call('search', { query: submitted, pageSize: 40 }, { signal: signal })
        },
        [submitted],
      )
      var search = PRW.useRequest(searchRun)

      var groupsRun = React.useCallback(
        function (signal) {
          if (identity.state.status !== 'ready') return Promise.resolve(null)
          return PRW.util.call('groups', { pageSize: 30 }, { signal: signal })
        },
        [identity.state.status],
      )
      var groups = PRW.useRequest(groupsRun)

      // A failed identity probe is the one error worth showing instead of the
      // tabs: nothing below it can work.
      if (identity.state.status === 'error') {
        return h(
          'div',
          { className: 'prw-root' },
          header(t, identity, null),
          h('div', { className: 'prw-body' }, failure({ error: identity.state.error, t: t, onRetry: identity.reload })),
        )
      }

      if (selected !== null) {
        return h(PRW.Detail, {
          t: t,
          target: selected,
          onBack: function () {
            setSelected(null)
          },
          identity: identity,
        })
      }

      return h(
        'div',
        { className: 'prw-root' },
        header(t, identity, groups.reload, query, setQuery, function () {
          setSubmitted(query.trim())
        }, function () {
          setQuery('')
          setSubmitted('')
        }),
        submitted.length === 0
          ? h(
              'div',
              { className: 'prw-tabs', role: 'tablist' },
              GROUP_TABS.map(function (entry) {
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
            )
          : h(
              'div',
              { className: 'prw-tabs' },
              h((PRW.ui.Pill || 'button'), { active: true }, '“' + submitted + '”'),
              h(
                (PRW.ui.Pill || 'button'),
                {
                  onClick: function () {
                    setSubmitted('')
                    setQuery('')
                  },
                },
                '×',
              ),
            ),
        h(
          'div',
          { className: 'prw-body' },
          submitted.length > 0
            ? listSection({
                t: t,
                state: search.state,
                items: search.state.value === null ? [] : search.state.value.items,
                onSelect: setSelected,
                emptyText: t('search.empty'),
                onRetry: search.reload,
              })
            : groupSection({ t: t, tab: tab, state: groups.state, onSelect: setSelected, onRetry: groups.reload }),
        ),
      )
    }

    /**
     * The header row: title, identity, search, refresh.
     *
     * @param {Function} t
     * @param {object} identity
     * @param {Function} onRefresh
     * @param {string} [query]
     * @param {Function} [setQuery]
     * @param {Function} [onSubmit]
     * @param {Function} [onClear]
     * @returns {object}
     */
    function header(t, identity, onRefresh, query, setQuery, onSubmit, onClear) {
      var viewer = identity.state.value === null ? null : identity.state.value.viewer
      var searchable = typeof setQuery === 'function'
      return h(
        'div',
        { className: 'prw-head' },
        h(
          'div',
          { className: 'prw-titleRow' },
          h('h2', { className: 'prw-title' }, t('page.title')),
          viewer === null
            ? null
            : h('span', { className: 'prw-note prw-truncate' }, '@' + viewer.login),
        ),
        searchable
          ? h(
              'div',
              { className: 'prw-toolbar' },
              h(
                'span',
                { className: 'prw-grow' },
                PRW.ui.Input === null
                  ? h('input', {
                      type: 'search',
                      value: query,
                      placeholder: t('search.placeholder'),
                      onChange: function (event) {
                        setQuery(event.target.value)
                      },
                      onKeyDown: function (event) {
                        if (event.key === 'Enter') onSubmit()
                      },
                    })
                  : h(PRW.ui.Input, {
                      type: 'search',
                      value: query,
                      placeholder: t('search.placeholder'),
                      'aria-label': t('search.placeholder'),
                      onChange: function (event) {
                        setQuery(event.target.value)
                      },
                      onKeyDown: function (event) {
                        if (event.key === 'Enter') onSubmit()
                      },
                    }),
              ),
              query.length > 0 ? button({ onClick: onClear, children: '×', title: t('action.back') }) : null,
              onRefresh === undefined || onRefresh === null
                ? null
                : button({ onClick: onRefresh, children: t('action.refresh') }),
            )
          : null,
        searchable ? h('p', { className: 'prw-sub', style: { margin: 0 } }, t('search.hint')) : null,
      )
    }

    /**
     * The list for one group, with its own honest empty/error states.
     *
     * @param {{ t: Function, tab: string, state: object, onSelect: Function, onRetry: Function }} props
     * @returns {object}
     */
    function groupSection(props) {
      var t = props.t
      var state = props.state
      if (state.status === 'loading' || state.status === 'idle') return skeletons({ rows: 6 })
      if (state.status === 'error') return failure({ error: state.error, t: t, onRetry: props.onRetry })
      if (state.value === null) return empty({ text: t('group.empty') })

      var group = state.value.groups === undefined ? null : state.value.groups[props.tab]
      if (group === null || group === undefined) return empty({ text: t('group.empty') })

      if (group.status === 'error') {
        return h(
          'div',
          null,
          failure({ error: { code: group.error === undefined ? 'internal' : group.error }, t: t, onRetry: props.onRetry }),
        )
      }

      var items = Array.isArray(group.items) ? group.items : []
      var warnings = []
      if (group.status === 'unconfirmed') {
        warnings.push(h('p', { key: 'w-unconfirmed', className: 'prw-note', style: { margin: '0 0 8px' } }, t('group.unconfirmed')))
      }
      // `capped` means GitHub reported more matches than the search API will
      // return in one page — a silently shortened list is the failure mode this
      // line exists to prevent.
      if (group.capped === true) {
        warnings.push(
          h('p', { key: 'w-truncated', className: 'prw-note', style: { margin: '0 0 8px' } },
            PRW.util.count(group.totalCount) + ' total',
          ),
        )
      }

      if (items.length === 0) {
        return h('div', null, warnings, empty({ text: t(props.tab === 'teamReviewRequested' ? 'group.emptyTeam' : 'group.empty') }))
      }

      return h(
        'div',
        null,
        warnings,
        h(
          'div',
          { className: 'prw-list', role: 'list' },
          items.map(function (item) {
            return h(prRow, {
              key: item.key,
              item: item,
              active: false,
              onSelect: props.onSelect,
              t: t,
            })
          }),
        ),
      )
    }

    /**
     * A search result list.
     *
     * Same row component as the groups, so a result looks exactly like the list
     * item that would have led to it.
     *
     * @param {{ t: Function, state: object, items: Array, onSelect: Function, emptyText: string, onRetry: Function }} props
     * @returns {object}
     */
    function listSection(props) {
      var t = props.t
      if (props.state.status === 'loading' || props.state.status === 'idle') return skeletons({ rows: 6 })
      if (props.state.status === 'error') return failure({ error: props.state.error, t: t, onRetry: props.onRetry })
      if (props.items.length === 0) return empty({ text: props.emptyText })
      return h(
        'div',
        { className: 'prw-list', role: 'list' },
        props.items.map(function (item) {
          return h(prRow, { key: item.key, item: item, active: false, onSelect: props.onSelect, t: t })
        }),
      )
    }

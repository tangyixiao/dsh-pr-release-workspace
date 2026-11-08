    /* =================================================================== */
    /* registration                                                        */
    /* =================================================================== */

    /**
     * Segment after the panel's own route, used as the sidebar id and the `main`
     * key. One string, because the two registrations are matched by it and a typo
     * would leave a sidebar row that throws when clicked.
     */
    var PANEL_ID = 'pull-requests'

    /**
     * Wire the panel into the host.
     *
     * Two registrations, both root-scoped: an icon in the left sidebar list, and
     * the keyed `main` entry that the layout renders when that icon is selected.
     * The sidebar owns the row, its label and its active state; the icon component
     * only draws its own glyph and is handed `{size, active}`.
     *
     * @param {object} ctx
     * @returns {void}
     */
    PRW.apply = function apply(ctx) {
      PRW.ctx = ctx
      var NS = 'dsh-pr-release-workspace'

      // Both of these probe the host instead of assuming it: a composition
      // without a locale service still renders English, and a slot service that
      // is missing one method still gets its registration.
      var t = PRW.bindLocale(ctx, NS)

      ctx.effect(function () {
        return PRW.installStyles(PRW.CSS, 'prw-panel')
      }, 'pr-release-workspace: styles')

      PRW.registerSlot(ctx, 'sidebar.panellist', function () {
        return ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 30,
            label: function () {
              return t('sidebar.label')
            },
          },
          function SidebarRequestsIcon(props) {
            var size = props !== null && props !== undefined && typeof props.size === 'number' ? props.size : 17
            var active = props !== null && props !== undefined && props.active === true
            return PRW.icons.pullRequest(size, active)
          },
        )
      })

      PRW.registerSlot(ctx, 'main', function () {
        return ctx.slots.register({ name: 'main', key: PANEL_ID }, function PullRequestsPanel() {
          return h(PRW.Shell, { t: t })
        })
      })

      PRW.t = t
    }

    /**
     * The panel root: a small mode switch between the PR workspace and the release
     * state, so both live behind the one sidebar entry.
     *
     * The release view is a sibling rather than a tab inside `Workspace` because
     * the two have nothing in common: one is a GitHub reader keyed on a PR, the
     * other needs a version and a commit SHA and touches npm and the market index.
     *
     * @param {{ t: Function }} props
     * @returns {object}
     */
    PRW.Shell = function Shell(props) {
      var t = props.t
      var pair = React.useState('workspace')
      var mode = pair[0]
      var setMode = pair[1]

      // Say it once, at the top, when the host gave us less than a full component
      // set. Silent degradation is the failure mode that looks like a bug in this
      // panel, so the panel names it instead — a reader who sees plain markup
      // should be able to tell that it is the host, not the data.
      var notice =
        PRW.compat.degraded === true
          ? h('div', { className: 'prw-note prw-secondary', role: 'note' }, t('compat.degraded'))
          : null

      return h(
        'div',
        { className: 'prw-root' },
        notice,
        h(
          'div',
          { className: 'prw-tabs', style: { paddingTop: '12px' } },
          h(
            (PRW.ui.Pill || 'button'),
            { active: mode === 'workspace', onClick: function () { setMode('workspace') } },
            t('page.title'),
          ),
          h(
            (PRW.ui.Pill || 'button'),
            { active: mode === 'release', onClick: function () { setMode('release') } },
            t('release.title'),
          ),
        ),
        h(
          'div',
          { style: { flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' } },
          mode === 'release' ? h(PRW.Release, { t: t }) : h(PRW.Workspace, { t: t }),
        ),
      )
    }

    /* =================================================================== */
    /* release state                                                       */
    /* =================================================================== */

    /**
     * The order the fact rows are shown in, and the label for each.
     *
     * Deliberately the same order the host returns them: the pipeline runs from a
     * commit's checks to a live index entry, and reading them out of order is how
     * someone concludes "published" from a green check.
     */
    var FACT_ROWS = [
      { key: 'ci', label: 'release.ci' },
      { key: 'github-release', label: 'release.githubRelease' },
      { key: 'npm', label: 'release.npm' },
      { key: 'market-pr', label: 'release.marketPr' },
      { key: 'market-manifest', label: 'release.marketManifest' },
      { key: 'live-index', label: 'release.liveIndex' },
    ]

    /**
     * The fields a release check needs.
     *
     * @returns {object}
     */
    function releaseDefaults() {
      return {
        owner: 'tangyixiao',
        repo: 'dsh-pr-release-workspace',
        npmName: 'dsh-pr-release-workspace',
        version: '',
        tag: '',
        sha: '',
        marketRepo: 'tangyixiao/dsh-plugin-market',
        marketNumber: '',
        indexUrl: 'https://tangyixiao.github.io/dsh-plugin-market/index.json',
      }
    }

    /**
     * The release panel.
     *
     * The whole reason this exists: "merged", "CI green", "on npm", "released on
     * GitHub", "market PR merged", and "live index lists this version" are six
     * different facts, and every one of them has been true while another was not.
     * The panel refuses to collapse them into one green dot.
     *
     * @param {{ t: Function }} props
     * @returns {object}
     */
    PRW.Release = function Release(props) {
      var t = props.t
      var formPair = React.useState(releaseDefaults)
      var form = formPair[0]
      var setForm = formPair[1]
      var requestedPair = React.useState(null)
      var requested = requestedPair[0]
      var setRequested = requestedPair[1]

      var set = function (field, value) {
        var next = Object.assign({}, form)
        next[field] = value
        setForm(next)
      }

      var run = PRW.useRequest(
        React.useCallback(
          function (signal) {
            if (requested === null) return Promise.resolve(null)
            return PRW.util.call('release', requested, { signal: signal })
          },
          [requested],
        ),
      )

      var submit = function () {
        if (form.version.trim().length === 0 || form.sha.trim().length === 0) return
        setRequested({
          owner: form.owner.trim(),
          repo: form.repo.trim(),
          npmName: form.npmName.trim(),
          version: form.version.trim(),
          tag: form.tag.trim().length > 0 ? form.tag.trim() : 'v' + form.version.trim(),
          sha: form.sha.trim(),
          market: {
            repo: form.marketRepo.trim(),
            number: form.marketNumber.trim().length === 0 ? null : Number(form.marketNumber.trim()),
            indexUrl: form.indexUrl.trim(),
          },
        })
      }

      var value = run.state.status === 'ready' ? run.state.value : null

      return h(
        'div',
        { className: 'prw-root' },
        h(
          'div',
          { className: 'prw-head' },
          h('h2', { className: 'prw-title' }, t('release.title')),
          h('p', { className: 'prw-sub', style: { margin: 0 } }, t('release.subtitle')),
          h('div', { className: 'prw-toolbar' },
            field(t, 'release.owner', form.owner, function (v) { set('owner', v) }),
            field(t, 'release.repo', form.repo, function (v) { set('repo', v) }),
          ),
          h('div', { className: 'prw-toolbar' }, field(t, 'release.version', form.version, function (v) { set('version', v) }), field(t, 'release.tag', form.tag, function (v) { set('tag', v) })),
          h('div', { className: 'prw-toolbar' },
            field(t, 'release.ci', form.sha, function (v) { set('sha', v) }),
            field(t, 'release.npm', form.npmName, function (v) { set('npmName', v) }),
          ),
          h('div', { className: 'prw-toolbar' },
            field(t, 'release.marketPr', form.marketNumber, function (v) { set('marketNumber', v) }),
            field(t, 'release.liveIndex', form.indexUrl, function (v) { set('indexUrl', v) }),
          ),
          h(
            'div',
            { className: 'prw-toolbar' },
            button({
              onClick: submit,
              variant: 'primary',
              disabled: form.version.trim().length === 0 || form.sha.trim().length === 0,
              children: t('release.check'),
            }),
            h('span', { className: 'prw-note prw-truncate' }, form.owner + '/' + form.repo),
          ),
        ),
        h(
          'div',
          { className: 'prw-body' },
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
            run.state.status === 'loading'
              ? h('p', { className: 'prw-note' }, t('release.loading'))
              : null,
            run.state.status === 'error' ? failure({ error: run.state.error, t: t, onRetry: run.reload }) : null,
            value === null
              ? requested === null
                ? empty({ text: t('release.hint') })
                : null
              : factTable(t, value),
          ),
        ),
      )
    }

    /**
     * One labelled text field.
     *
     * @param {Function} t
     * @param {string} labelKey
     * @param {string} value
     * @param {Function} onChange
     * @returns {object}
     */
    function field(t, labelKey, value, onChange) {
      var props = {
        value: value,
        'aria-label': t(labelKey),
        placeholder: t(labelKey),
        onChange: function (event) {
          onChange(event.target.value)
        },
      }
      return h(
        'span',
        { className: 'prw-grow', style: { display: 'inline-flex', minWidth: '120px' } },
        PRW.ui.Input === null ? h('input', props) : h(PRW.ui.Input, props),
      )
    }

    /**
     * The six rows plus the verdict.
     *
     * @param {Function} t
     * @param {object} value - `collectReleaseFacts` output
     * @returns {object}
     */
    function factTable(t, value) {
      var summary = value.summary || { total: 6, passed: 0 }
      var allPass = value.ready === true
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'prw-card', style: { marginBottom: '12px' } },
          h(
            'div',
            { className: 'prw-cardHead' },
            h(
              'span',
              { className: 'prw-row' },
              h(PRW.ui.StateDot || 'span', { state: allPass ? 'done' : 'warning', size: 8 }),
              h('strong', null, allPass ? t('release.ready') : t('release.notReady')),
            ),
            h('span', { className: 'prw-mono prw-muted' }, summary.passed + ' / ' + summary.total),
          ),
          h(
            'div',
            { className: 'prw-facts' },
            FACT_ROWS.map(function (entry) {
              var fact = value.facts === undefined ? null : value.facts[entry.key]
              var verdict = fact === null || fact === undefined ? 'unknown' : fact.verdict
              return h(
                'div',
                { className: 'prw-fact', key: entry.key },
                h(PRW.ui.StateDot || 'span', { state: PRW.util.dotFor(verdict), size: 8 }),
                h(
                  'span',
                  { className: 'prw-factName' },
                  t(entry.label),
                  fact !== null && fact !== undefined && typeof fact.detail === 'string'
                    ? h('span', { className: 'prw-note' }, ' — ' + fact.detail)
                    : null,
                ),
                h(
                  'span',
                  { className: 'prw-factVal' },
                  tag({ tone: PRW.util.toneFor(verdict), children: verdictLabel(t, verdict) }),
                  fact !== null && fact !== undefined && typeof fact.reason === 'string' && fact.reason.length > 0
                    ? h('span', { className: 'prw-note prw-mono' }, fact.reason)
                    : null,
                  fact !== null && fact !== undefined && typeof fact.evidence === 'string' && PRW.util.isSafeUrl(fact.evidence)
                    ? h(
                        'a',
                        { className: 'prw-link', href: fact.evidence, target: '_blank', rel: 'noreferrer noopener' },
                        t('action.openOnGithub'),
                      )
                    : null,
                ),
              )
            }),
          ),
        ),
        h('p', { className: 'prw-note', style: { margin: 0 } }, value.observedAt || ''),
      )
    }

    /**
     * The word for one verdict.
     *
     * @param {Function} t
     * @param {string} verdict
     * @returns {string}
     */
    function verdictLabel(t, verdict) {
      if (verdict === 'pass') return t('release.pass')
      if (verdict === 'fail') return t('release.fail')
      if (verdict === 'pending') return t('release.pending')
      if (verdict === 'not_configured') return t('release.notConfigured')
      if (verdict === 'stale') return t('release.stale')
      return t('release.unknown')
    }

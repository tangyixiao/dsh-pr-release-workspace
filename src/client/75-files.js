    /* =================================================================== */
    /* files, comments, drafts                                             */
    /* =================================================================== */

    /**
     * The files tab: one disclosure per changed file, each with its own note
     * editor.
     *
     * The diff is fetched separately from the PR because it is much larger and can
     * fail on its own (a 500-file PR, a rate limit). A failed diff must not blank
     * the whole detail view — the description and checks are still worth reading.
     *
     * @param {{ t: Function, state: object, target: object, pr: object, drafts: object, onRetry: Function }} props
     * @returns {object}
     */
    function filesView(props) {
      var t = props.t
      var state = props.state
      if (state.status === 'loading' || state.status === 'idle') return skeletons({ rows: 6 })
      if (state.status === 'error') {
        return h(
          'div',
          null,
          h('p', { className: 'prw-note' }, t('detail.diffFailed')),
          failure({ error: state.error, t: t, onRetry: props.onRetry }),
        )
      }
      var value = state.value
      if (value === null || Array.isArray(value.files) === false || value.files.length === 0) {
        return empty({ text: t('detail.noDiff') })
      }

      var draftsById = indexDrafts(props.drafts.state)
      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
        value.truncated === true
          ? h(
              'p',
              { className: 'prw-note', style: { margin: '0 0 8px' } },
              // `truncated` says GitHub would not render one diff; `complete`
              // says whether the per-file read reached the end. They are
              // different claims and a partial list must not look whole.
              value.complete === false ? t('detail.diffIncomplete') : t('detail.diffCapped'),
            )
          : null,
        value.files.map(function (file, index) {
          return h(FileRow, {
            key: file.path + ':' + index,
            t: t,
            file: file,
            target: props.target,
            pr: props.pr,
            draftState: props.drafts.state,
            draftsFor: draftsById.get(file.path) || [],
            onChanged: props.drafts.reload,
          })
        }),
      )
    }

    /**
     * Group drafts by file path.
     *
     * @param {object} state
     * @returns {Map<string, object[]>}
     */
    function indexDrafts(state) {
      var out = new Map()
      if (state === null || state === undefined || state.value === null) return out
      var rows = state.value.drafts
      if (Array.isArray(rows) === false) return out
      var i
      for (i = 0; i < rows.length; i += 1) {
        var draft = rows[i]
        var key = typeof draft.path === 'string' ? draft.path : ''
        if (out.has(key) === false) out.set(key, [])
        out.get(key).push(draft)
      }
      return out
    }

    /**
     * One changed file: a header row, the diff body when open, and its notes.
     *
     * @param {object} props
     * @returns {object}
     */
    function FileRow(props) {
      var t = props.t
      var file = props.file
      var pair = React.useState(false)
      var open = pair[0]
      var setOpen = pair[1]
      var editingPair = React.useState(false)
      var editing = editingPair[0]
      var setEditing = editingPair[1]

      var binary = file.oldText === null && file.newText === null
      var totals = PRW.ui.diffTotals !== null && binary === false ? safeTotals([file]) : null

      return h(
        'div',
        null,
        h(
          'div',
          Object.assign(
            { className: 'prw-file', 'aria-expanded': open === true ? 'true' : 'false' },
            PRW.util.activate(function () {
              setOpen(!open)
            }),
          ),
          h('span', { className: 'prw-muted' }, PRW.icons.chevron(12, open)),
          PRW.icons.file(13),
          h('span', { className: 'prw-mono prw-truncate prw-grow', title: file.path }, file.path),
          totals === null
            ? null
            : h(
                'span',
                { className: 'prw-stat' },
                h('span', { className: 'prw-add' }, '+' + totals.added),
                ' ',
                h('span', { className: 'prw-del' }, '−' + totals.removed),
              ),
        ),
        open === false
          ? null
          : h(
              'div',
              { className: 'prw-diffWrap' },
              binary
                ? h('p', { className: 'prw-note', style: { margin: '4px 0' } }, t('detail.binary'))
                : h(DiffBody, { file: file, labels: diffLabels(t) }),
              h(
                'div',
                { className: 'prw-row', style: { margin: '4px 0 8px' } },
                button({
                  onClick: function () {
                    setEditing(true)
                  },
                  children: '＋ ' + t('drafts.add'),
                }),
              ),
              editing === true
                ? h(DraftEditor, {
                    t: t,
                    target: props.target,
                    pr: props.pr,
                    path: file.path,
                    line: null,
                    onDone: function (saved) {
                      setEditing(false)
                      if (saved === true) props.onChanged()
                    },
                  })
                : null,
              props.draftsFor.length === 0
                ? null
                : h(
                    'div',
                    { style: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' } },
                    props.draftsFor.map(function (draft) {
                      return h(DraftCard, {
                        key: draft.id,
                        t: t,
                        draft: draft,
                        onRemove: function () {
                          PRW.util.call('removeDraft', { id: draft.id }).then(function () {
                            props.onChanged()
                          }, function () {})
                        },
                      })
                    }),
                  ),
            ),
      )
    }

    /**
     * Diff totals that cannot throw.
     *
     * `diffTotals` walks every hunk; a huge file with an unusual shape should cost
     * a missing number, not a crashed tab.
     *
     * @param {object[]} files
     * @returns {{ added: number, removed: number } | null}
     */
    function safeTotals(files) {
      try {
        return PRW.ui.diffTotals(files)
      } catch {
        return null
      }
    }

    /**
     * The `DiffBlock` labels, in the panel's current language.
     *
     * @param {Function} t
     * @returns {object}
     */
    function diffLabels(t) {
      return {
        copy: t('action.copyLink'),
        copied: t('action.copied'),
        collapseAria: t('action.back'),
        expandAria: function (hidden) {
          return t('detail.files') + ' (' + hidden + ')'
        },
        collapse: t('action.back'),
        expand: function (hidden) {
          return '+' + hidden
        },
        files: function (count) {
          return fill(t('pr.files'), { count: count })
        },
      }
    }

    /**
     * The diff itself.
     *
     * `DiffBlock` wants `{path, oldText, newText}`; the host already produced
     * exactly that per file, so the patch string never reaches the client. When
     * the primitive is missing the file is shown as plain text rather than an
     * empty box, because a diff nobody can read is worse than a raw one.
     *
     * @param {{ file: object, labels: object }} props
     * @returns {object}
     */
    function DiffBody(props) {
      var DiffBlock = PRW.ui.DiffBlock
      var file = props.file
      if (DiffBlock === null) {
        return h(
          'div',
          { className: 'prw-hunk prw-mono' },
          (file.oldText === null ? '' : file.oldText) + '\n' + (file.newText === null ? '' : file.newText),
        )
      }
      return h(DiffBlock, {
        diffs: [{ path: file.path, oldText: file.oldText, newText: file.newText }],
        labels: props.labels,
        maxLines: 24,
      })
    }

    /**
     * One saved local note.
     *
     * @param {{ t: Function, draft: object, onRemove: Function }} props
     * @returns {object}
     */
    function DraftCard(props) {
      var draft = props.draft
      var stale = draft.state === 'stale'
      return h(
        'div',
        { className: 'prw-draft' + (stale ? ' prw-draftStale' : '') },
        h(
          'div',
          { className: 'prw-commentHead' },
          PRW.icons.pen(12),
          h('span', { className: 'prw-mono' }, typeof draft.path === 'string' ? draft.path : ''),
          typeof draft.line === 'number' ? h('span', null, ':' + draft.line) : null,
          h('span', { className: 'prw-grow' }),
          h('span', null, PRW.util.when(draft.updatedAt, props.t)),
          button({ onClick: props.onRemove, children: props.t('drafts.remove') }),
        ),
        stale
          ? h('p', { className: 'prw-note', style: { margin: 0 } }, props.t('drafts.stale') + ' ' + props.t('drafts.staleHint'))
          : null,
        h('div', { className: 'prw-body' }, PRW.util.bodyBlocks(draft.body)),
      )
    }

    /**
     * The note editor.
     *
     * Saves against the PR's current head SHA, which is what makes a note go
     * "stale" later rather than silently drifting to a new commit's line numbers.
     *
     * @param {{ t: Function, target: object, pr: object, path: string|null, line: number|null, onDone: Function }} props
     * @returns {object}
     */
    function DraftEditor(props) {
      var t = props.t
      var textPair = React.useState('')
      var text = textPair[0]
      var setText = textPair[1]
      var busyPair = React.useState(false)
      var busy = busyPair[0]
      var setBusy = busyPair[1]
      var errorPair = React.useState(null)
      var error = errorPair[0]
      var setError = errorPair[1]

      var save = function () {
        if (busy === true) return
        var body = text.trim()
        if (body.length === 0) return
        setBusy(true)
        setError(null)
        PRW.util
          .call('saveDraft', {
            key: props.target.key,
            sha: props.pr.headSha,
            path: props.path,
            line: props.line,
            body: body,
            kind: props.line === null ? 'file' : 'line',
          })
          .then(
            function () {
              setBusy(false)
              props.onDone(true)
            },
            function (failure) {
              setBusy(false)
              setError(failure)
            },
          )
      }

      return h(
        'div',
        { className: 'prw-editor' },
        h('textarea', {
          className: 'prw-textarea',
          value: text,
          placeholder: t('drafts.placeholder'),
          'aria-label': t('drafts.placeholder'),
          onChange: function (event) {
            setText(event.target.value)
          },
          onKeyDown: function (event) {
            if (event.key === 'Enter' && (event.metaKey === true || event.ctrlKey === true)) save()
            if (event.key === 'Escape') props.onDone(false)
          },
        }),
        error === null ? null : h('p', { className: 'prw-note', style: { margin: 0 } }, String(error.message || '')),
        h(
          'div',
          { className: 'prw-row' },
          button({ onClick: save, disabled: busy === true || text.trim().length === 0, variant: 'primary', children: t('drafts.save') }),
          button({
            onClick: function () {
              props.onDone(false)
            },
            children: t('drafts.cancel'),
          }),
          h('span', { className: 'prw-grow' }),
          h('span', { className: 'prw-note' }, t('drafts.writeGuard')),
        ),
      )
    }

    /**
     * The comments tab: conversation comments, submitted reviews with a decisive
     * verdict, and inline review comments grouped by file.
     *
     * All three come from the one `pull` payload: inline comments arrive with it
     * so a second round trip (and a second failure mode) is not needed.
     *
     * @param {{ t: Function, pr: object }} props
     * @returns {object}
     */
    function commentsView(props) {
      var t = props.t
      var pr = props.pr
      var inline = Array.isArray(pr.inlineComments) ? pr.inlineComments : []
      var conversation = Array.isArray(pr.comments) ? pr.comments : []
      var reviews = Array.isArray(pr.reviews) ? pr.reviews : []

      var sections = []
      if (conversation.length === 0 && reviews.length === 0 && inline.length === 0) {
        return empty({ text: t('detail.noComments') })
      }

      if (reviews.length > 0) {
        sections.push(
          h(
            'div',
            { key: 'reviews', className: 'prw-card' },
            h('h3', { className: 'prw-cardTitle' }, t('pr.reviews', { count: reviews.length })),
            reviews.map(function (review, index) {
              return h(
                'div',
                { key: 'review-' + index, className: 'prw-comment' },
                h(
                  'div',
                  { className: 'prw-commentHead' },
                  h('span', { className: 'prw-commentBy' }, review.author === null ? '—' : '@' + review.author),
                  // Only a decisive review gets a tone: a COMMENTED review is not
                  // an approval and must not borrow the green.
                  review.decisive === true
                    ? tag({
                        tone: review.state === 'APPROVED' ? 'success' : 'danger',
                        children: review.state === 'APPROVED' ? '✓ approved' : '! changes requested',
                      })
                    : tag({ tone: 'quiet', children: 'commented' }),
                  h('span', { className: 'prw-grow' }),
                  h('span', null, PRW.util.when(review.submittedAt, t)),
                ),
                review.body.length === 0 ? null : h('div', { className: 'prw-body' }, PRW.util.bodyBlocks(review.body)),
              )
            }),
          ),
        )
      }

      if (conversation.length > 0) {
        sections.push(
          h(
            'div',
            { key: 'conversation', className: 'prw-card' },
            h('h3', { className: 'prw-cardTitle' }, t('pr.comments', { count: conversation.length })),
            conversation.map(function (comment, index) {
              return h(
                'div',
                { key: 'c-' + index, className: 'prw-comment' },
                h(
                  'div',
                  { className: 'prw-commentHead' },
                  PRW.icons.comment(12),
                  h('span', { className: 'prw-commentBy' }, comment.author === null ? '—' : '@' + comment.author),
                  h('span', { className: 'prw-grow' }),
                  h('span', null, PRW.util.when(comment.createdAt, t)),
                ),
                h('div', { className: 'prw-body' }, PRW.util.bodyBlocks(comment.body)),
              )
            }),
          ),
        )
      }

      if (inline.length > 0) {
        sections.push(
          h(
            'div',
            { key: 'inline', className: 'prw-card' },
            h('h3', { className: 'prw-cardTitle' }, t('detail.files') + ' · ' + inline.length),
            inline.map(function (comment, index) {
              return h(
                'div',
                { key: 'i-' + index, className: 'prw-comment' },
                h(
                  'div',
                  { className: 'prw-commentHead' },
                  h('span', { className: 'prw-commentBy' }, comment.author === null ? '—' : '@' + comment.author),
                  h('span', { className: 'prw-mono prw-truncate' }, String(comment.path || '')),
                  typeof comment.line === 'number' ? h('span', null, fill(t('detail.reviewComment'), { line: comment.line })) : null,
                  h('span', { className: 'prw-grow' }),
                  h('span', null, PRW.util.when(comment.createdAt, t)),
                ),
                h('div', { className: 'prw-body' }, PRW.util.bodyBlocks(comment.body)),
              )
            }),
          ),
        )
      }

      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, sections)
    }

    /**
     * The notes tab: every local draft for this PR, with stale ones called out.
     *
     * @param {{ t: Function, state: object, pr: object, target: object, onChanged: Function }} props
     * @returns {object}
     */
    function draftsView(props) {
      var t = props.t
      var state = props.state
      if (state.status === 'loading' || state.status === 'idle') return skeletons({ rows: 3 })
      if (state.status === 'error') return failure({ error: state.error, t: t })
      var rows = state.value === null ? [] : state.value.drafts
      var warning = h('p', { className: 'prw-note', style: { margin: '0 0 8px' } }, t('drafts.subtitle'))
      var guard = h('p', { className: 'prw-note', style: { margin: '0 0 12px' } }, t('drafts.writeGuard'))
      if (Array.isArray(rows) === false || rows.length === 0) {
        return h('div', null, warning, guard, empty({ text: t('drafts.empty') }))
      }
      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
        warning,
        guard,
        rows.map(function (draft) {
          return h(DraftCard, {
            key: draft.id,
            t: t,
            draft: draft,
            onRemove: function () {
              PRW.util.call('removeDraft', { id: draft.id }).then(function () {
                props.onChanged()
              }, function () {})
            },
          })
        }),
      )
    }

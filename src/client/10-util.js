    /* =================================================================== */
    /* utilities                                                           */
    /* =================================================================== */

    /**
     * Everything the UI needs to say, in both languages.
     *
     * Dotted keys, flat maps — the locale service stores them verbatim, so a
     * nested object would need flattening and would make a missing key harder to
     * spot. `en` is the fallback for any key absent from `zh`.
     */
    PRW.dicts = {
      en: {
        'nav.label': 'Pull requests',
        'page.title': 'Pull requests',
        'page.subtitle': 'Review, diff and release state for the repositories you own.',
        'tab.mine': 'Created by me',
        'tab.review': 'Awaiting my review',
        'tab.team': 'Awaiting my team',
        'tab.release': 'Release state',
        'search.placeholder': 'Search pull requests, or paste a PR link',
        'search.hint': 'owner/repo#123 or a github.com pull request URL',
        'search.empty': 'Nothing matches that search.',
        'group.empty': 'Nothing here right now.',
        'group.emptyTeam': 'No team reviews are waiting — or team membership could not be confirmed.',
        'group.unconfirmed': 'Team membership could not be confirmed, so this list may be incomplete.',
        'group.error': 'This list could not be loaded.',
        'state.loading': 'Loading…',
        'state.refused': 'GitHub refused the request.',
        'state.notSignedIn': 'GitHub is not signed in.',
        'state.notSignedInHint': 'Run `gh auth login` in a terminal, then reload this panel.',
        'state.ghMissing': 'The `gh` command is not available.',
        'state.ghMissingHint': 'Install the GitHub CLI, then reload this panel.',
        'state.rateLimited': 'GitHub asked us to slow down.',
        'state.retryIn': 'Try again in {seconds}s.',
        'state.offline': 'The Harness could not be reached.',
        'compat.degraded':
          'This Harness provides an older component set, so some controls fall back to plain markup.',
        'pr.draft': 'Draft',
        'pr.merged': 'Merged',
        'pr.closed': 'Closed',
        'pr.open': 'Open',
        'pr.by': 'by',
        'pr.files': '{count} files',
        'pr.filesCapped': 'showing {shown} of {total}',
        'pr.comments': '{count} comments',
        'pr.reviews': '{count} reviews',
        'pr.reviewRequests': '{count} awaiting review',
        'detail.overview': 'Overview',
        'detail.files': 'Files',
        'detail.comments': 'Comments',
        'detail.checks': 'Checks',
        'detail.drafts': 'My notes',
        'detail.base': 'into',
        'detail.head': 'from',
        'detail.mergeable': 'Mergeable',
        'detail.conflicts': 'Conflicts',
        'detail.mergeUnknown': 'Merge state unknown',
        'detail.noBody': 'No description.',
        'detail.noDiff': 'No changed files were returned.',
        'detail.binary': 'Binary file — no text diff.',
        'detail.diffCapped': 'This pull request is larger than one diff; files were read individually.',
        'detail.diffIncomplete': 'This pull request changes more files than this panel will page through; the list below is incomplete.',
        'detail.diffFailed': 'The diff could not be loaded.',
        'detail.noComments': 'No review comments yet.',
        'detail.reviewComment': 'on line {line}',
        'detail.outdated': 'outdated',
        'ci.notConfigured': 'No checks configured',
        'ci.success': 'Checks passed',
        'ci.failure': 'Checks failed',
        'ci.pending': 'Checks running',
        'ci.cancelled': 'Checks cancelled',
        'ci.skipped': 'Only skipped checks',
        'ci.unknown': 'Check state unknown',
        'ci.count': '{passed} passed, {failed} failed, {pending} pending',
        'release.title': 'Release state',
        'release.subtitle': 'Six separate facts. A merged pull request is not a published package.',
        'release.version': 'Version',
        'release.tag': 'Tag',
        'release.owner': 'Owner',
        'release.repo': 'Repository',
        'release.sha': 'Commit SHA',
        'release.npm': 'npm',
        'release.githubRelease': 'GitHub Release',
        'release.marketPr': 'Market pull request',
        'release.marketManifest': 'Market manifest',
        'release.liveIndex': 'Live index',
        'release.ci': 'Commit checks',
        'release.pass': 'Yes',
        'release.fail': 'No',
        'release.pending': 'Pending',
        'release.unknown': 'Unverified',
        'release.notConfigured': 'Not configured',
        'release.stale': 'Stale',
        'release.ready': 'Every fact checks out.',
        'release.notReady': 'Not every fact checks out.',
        'release.loading': 'Checking…',
        'release.hint': 'Fill in the version and the commit SHA, then check. Every fact is read fresh; nothing is cached.',
        'release.check': 'Check the six facts',
        'drafts.title': 'Local review notes',
        'drafts.subtitle': 'Kept on this machine. Nothing here is posted to GitHub.',
        'drafts.empty': 'No notes yet. Open a file in the diff and add one.',
        'drafts.add': 'Add a note',
        'drafts.save': 'Save note',
        'drafts.cancel': 'Cancel',
        'drafts.remove': 'Delete',
        'drafts.placeholder': 'What needs to change here?',
        'drafts.stale': 'Written against an earlier commit.',
        'drafts.staleHint': 'The lines may have moved since the pull request changed.',
        'drafts.saved': 'Saved on this machine.',
        'drafts.writeGuard': 'This panel is read-only: it never posts to GitHub.',
        'action.openOnGithub': 'Open on GitHub',
        'action.copyLink': 'Copy link',
        'action.copied': 'Copied',
        'action.refresh': 'Refresh',
        'action.back': 'Back',
        'sidebar.label': 'Pull requests',
        'time.now': 'now',
        'time.minutes': '{n} min ago',
        'time.hours': '{n} h ago',
        'time.days': '{n} d ago',
        'time.months': '{n} mo ago',
        'time.years': '{n} y ago',
      },
      zh: {
        'nav.label': '拉取请求',
        'page.title': '拉取请求',
        'page.subtitle': '查看你名下仓库的评审、改动与发布状态。',
        'tab.mine': '我创建的',
        'tab.review': '待我审查',
        'tab.team': '需要我的团队审查',
        'tab.release': '发布状态',
        'search.placeholder': '搜索拉取请求，或粘贴 PR 链接',
        'search.hint': 'owner/repo#123 或 github.com 的 PR 链接',
        'search.empty': '没有匹配的结果。',
        'group.empty': '目前没有内容。',
        'group.emptyTeam': '目前没有待你团队审查的 PR，或团队归属无法确认。',
        'group.unconfirmed': '团队归属无法确认，这份列表可能不完整。',
        'group.error': '这份列表加载失败。',
        'state.loading': '加载中…',
        'state.refused': 'GitHub 拒绝了这次请求。',
        'state.notSignedIn': 'GitHub 尚未登录。',
        'state.notSignedInHint': '在终端执行 `gh auth login`，然后重新打开这个面板。',
        'state.ghMissing': '找不到 `gh` 命令。',
        'state.ghMissingHint': '安装 GitHub CLI 后重新打开这个面板。',
        'state.rateLimited': 'GitHub 要求我们降低频率。',
        'state.retryIn': '{seconds} 秒后重试。',
        'state.offline': '无法连接到 Harness。',
        'compat.degraded': '这个 Harness 的组件集较旧，部分控件已回退为普通元素。',
        'pr.draft': '草稿',
        'pr.merged': '已合并',
        'pr.closed': '已关闭',
        'pr.open': '进行中',
        'pr.by': '作者',
        'pr.files': '{count} 个文件',
        'pr.filesCapped': '显示 {shown} / 共 {total}',
        'pr.comments': '{count} 条评论',
        'pr.reviews': '{count} 条评审',
        'pr.reviewRequests': '{count} 人待审',
        'detail.overview': '概览',
        'detail.files': '文件',
        'detail.comments': '评论',
        'detail.checks': '检查',
        'detail.drafts': '我的批注',
        'detail.base': '合入',
        'detail.head': '来自',
        'detail.mergeable': '可合并',
        'detail.conflicts': '有冲突',
        'detail.mergeUnknown': '合并状态未知',
        'detail.noBody': '没有描述。',
        'detail.noDiff': '没有返回变更文件。',
        'detail.binary': '二进制文件，无文本差异。',
        'detail.diffCapped': '这个 PR 的改动超过单份 diff 的限额，已按文件逐个读取。',
        'detail.diffIncomplete': '这个 PR 的改动文件数超过本面板的分页上限，下面的列表并不完整。',
        'detail.diffFailed': 'diff 加载失败。',
        'detail.noComments': '还没有评审评论。',
        'detail.reviewComment': '第 {line} 行',
        'detail.outdated': '已过时',
        'ci.notConfigured': '未配置检查',
        'ci.success': '检查通过',
        'ci.failure': '检查失败',
        'ci.pending': '检查进行中',
        'ci.cancelled': '检查已取消',
        'ci.skipped': '仅有跳过的检查',
        'ci.unknown': '检查状态未知',
        'ci.count': '{passed} 通过，{failed} 失败，{pending} 进行中',
        'release.title': '发布状态',
        'release.subtitle': '六个独立的事实。合并了 PR 不等于发布了包。',
        'release.version': '版本',
        'release.tag': '标签',
        'release.owner': '所有者',
        'release.repo': '仓库',
        'release.sha': '提交 SHA',
        'release.npm': 'npm',
        'release.githubRelease': 'GitHub Release',
        'release.marketPr': '市场 PR',
        'release.marketManifest': '市场清单',
        'release.liveIndex': '线上索引',
        'release.ci': '提交检查',
        'release.pass': '是',
        'release.fail': '否',
        'release.pending': '等待中',
        'release.unknown': '未核实',
        'release.notConfigured': '未配置',
        'release.stale': '已过期',
        'release.ready': '每一项都已核实。',
        'release.notReady': '并非每一项都已核实。',
        'release.loading': '核验中…',
        'release.hint': '填版本号和提交 SHA 后开始核验。每一项都是实时读取，不做缓存。',
        'release.check': '核验这六项',
        'drafts.title': '本地评审批注',
        'drafts.subtitle': '只保存在这台机器上，不会发到 GitHub。',
        'drafts.empty': '还没有批注。在 diff 里打开一个文件再添加。',
        'drafts.add': '添加批注',
        'drafts.save': '保存批注',
        'drafts.cancel': '取消',
        'drafts.remove': '删除',
        'drafts.placeholder': '这里需要改什么？',
        'drafts.stale': '写于更早的提交。',
        'drafts.staleHint': 'PR 更新后行号可能已经移位。',
        'drafts.saved': '已保存在这台机器上。',
        'drafts.writeGuard': '这个面板是只读的：不会向 GitHub 写入任何内容。',
        'action.openOnGithub': '在 GitHub 打开',
        'action.copyLink': '复制链接',
        'action.copied': '已复制',
        'action.refresh': '刷新',
        'action.back': '返回',
        'sidebar.label': '拉取请求',
        'time.now': '刚刚',
        'time.minutes': '{n} 分钟前',
        'time.hours': '{n} 小时前',
        'time.days': '{n} 天前',
        'time.months': '{n} 个月前',
        'time.years': '{n} 年前',
      },
    }

    /**
     * Flatten the dictionaries into what the locale service takes.
     *
     * @returns {{ en: Record<string, string>, zh: Record<string, string> }}
     */
    function buildDictionaries() {
      var out = { en: {}, zh: {} }
      var lang
      var key
      for (lang in PRW.dicts) {
        for (key in PRW.dicts[lang]) out[lang][key] = PRW.dicts[lang][key]
      }
      return out
    }

    /**
     * Fill `{name}` holes in one dictionary entry.
     *
     * The locale service returns the template, not a formatter, so substitution
     * happens here. A missing variable leaves the placeholder visible rather than
     * printing `undefined`, which is the more obviously broken of the two.
     *
     * @param {string} template
     * @param {object} [vars]
     * @returns {string}
     */
    function fill(template, vars) {
      if (vars === undefined || vars === null) return template
      return String(template).replace(/\{(\w+)\}/g, function (whole, name) {
        return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole
      })
    }

    PRW.util = (function () {
      var ROUTE = '/dsh-pr-release-workspace'

      /**
       * Fallback suffixes for the relative-time buckets, used only when no
       * translator is passed. These mirror the primitive's own English vocabulary
       * so a missing `t` degrades to English instead of to an empty string.
       */
      var UNIT_SUFFIX = { minutes: 'min', hours: 'h', days: 'd', months: 'mo', years: 'y' }

      /**
       * One request to the host half.
       *
       * Resolves to the endpoint's value or throws an `Error` carrying a `code`,
       * so callers can switch on `not-authenticated` versus a transient failure.
       * The body is always JSON and always POST: the route only accepts that, on
       * purpose, so a link or an <img> cannot trigger a GitHub read.
       *
       * @param {string} endpoint
       * @param {object} [payload]
       * @param {{ signal?: AbortSignal }} [options]
       * @returns {Promise<any>}
       */
      async function call(endpoint, payload, options) {
        var response
        try {
          response = await fetch(ROUTE + '/' + endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload || {}),
            credentials: 'same-origin',
            cache: 'no-store',
            signal: options && options.signal,
          })
        } catch (error) {
          if (error && error.name === 'AbortError') throw error
          throw problem('offline', 'The Harness could not be reached.')
        }

        var text = await response.text()
        var parsed = null
        try {
          parsed = text.length > 0 ? JSON.parse(text) : null
        } catch {
          parsed = null
        }

        if (parsed === null || typeof parsed !== 'object') {
          throw problem('offline', 'The Harness returned an unreadable answer.')
        }
        if (parsed.ok === true) return parsed.value
        var error = parsed.error || {}
        throw problem(error.code || 'internal', error.message || 'The request failed.', error.retryAfterSeconds)
      }

      /**
       * Build the error callers switch on.
       *
       * @param {string} code
       * @param {string} message
       * @param {number|null} [retryAfterSeconds]
       * @returns {Error}
       */
      function problem(code, message, retryAfterSeconds) {
        var error = new Error(message)
        error.code = code
        error.retryAfterSeconds = typeof retryAfterSeconds === 'number' ? retryAfterSeconds : null
        return error
      }

      /**
       * A cheap stable hash, used only for React keys of anonymous content.
       *
       * @param {string} text
       * @returns {string}
       */
      function hash(text) {
        var value = 5381
        var i
        var str = String(text)
        for (i = 0; i < str.length; i += 1) value = ((value << 5) + value + str.charCodeAt(i)) | 0
        return (value >>> 0).toString(36)
      }

      /** One number with thousands separators. */
      function count(value) {
        var n = typeof value === 'number' && isFinite(value) ? Math.round(value) : 0
        return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      }

      /**
       * Render text as inert React nodes.
       *
       * GitHub bodies are Markdown, and a Markdown renderer is a large attack
       * surface: an `img` with a tracking URL, a `javascript:` link, or raw HTML
       * that survives sanitising all leak something. The compromise here is
       * deliberately narrow — links become real links, everything else is plain
       * text. No HTML, no images, no Markdown emphasis. Nothing a comment can do
       * is worth the risk of rendering attacker-chosen markup inside the Harness
       * window, which has access to the local route.
       *
       * @param {string} text
       * @returns {Array}
       */
      function safeText(text) {
        var source = typeof text === 'string' ? text : ''
        if (source.length === 0) return []
        var out = []
        var pattern = /(https?:\/\/[^\s<>()]+)/g
        var last = 0
        var match
        var index = 0
        while ((match = pattern.exec(source)) !== null) {
          if (match.index > last) out.push(source.slice(last, match.index))
          var url = match[0]
          var trimmed = url
          var trailing = ''
          // Sentence punctuation and closing quotes/brackets are not part of a
          // URL even when they abut one. Without the quote handling, the raw HTML
          // `<a href="https://x">` in a PR body produced an anchor whose href
          // literally contained `"` (rendered as `&quot;`), i.e. a broken link
          // that looked like it pointed somewhere it did not.
          var tail = /[.,;:!?)\]}'"]+$/.exec(trimmed)
          if (tail !== null) {
            trailing = tail[0]
            trimmed = trimmed.slice(0, trimmed.length - trailing.length)
          }
          // A URL that is the target of Markdown syntax (`![x](url)`, `[x](url)`)
          // stays literal text. Linkifying it would render half a Markdown
          // construct as a link, which reads as a broken sentence and hides the
          // fact that this panel does not render Markdown at all.
          var before = source.slice(Math.max(0, match.index - 2), match.index)
          if ((before === '](' || before === ']:') && isSafeUrl(trimmed)) {
            out.push(url)
            last = match.index + url.length
            index += 1
            continue
          }
          if (isSafeUrl(trimmed)) {
            out.push(
              h(
                'a',
                {
                  key: 'link-' + index,
                  href: trimmed,
                  target: '_blank',
                  rel: 'noreferrer noopener',
                  className: 'prw-link',
                },
                trimmed,
              ),
            )
          } else {
            out.push(trimmed)
          }
          if (trailing.length > 0) out.push(trailing)
          last = match.index + url.length
          index += 1
        }
        if (last < source.length) out.push(source.slice(last))
        return out
      }

      /**
       * Is this URL safe to put in an anchor?
       *
       * Only http(s). A `javascript:` or `data:` URL reaching an anchor would be
       * a script injection point in the Harness origin, which is why the scheme is
       * checked here rather than trusted from the source text.
       *
       * @param {string} url
       * @returns {boolean}
       */
      function isSafeUrl(url) {
        return /^https?:\/\/[^\s]+$/i.test(url)
      }

      /**
       * Multi-line body text as paragraphs.
       *
       * Blank lines separate paragraphs; single newlines stay line breaks. Code
       * fences are shown as their own block, unstyled but monospaced, because a
       * review comment is often the only place a snippet appears.
       *
       * @param {string} text
       * @returns {Array}
       */
      function bodyBlocks(text) {
        var source = typeof text === 'string' ? text.replace(/\r\n/g, '\n') : ''
        if (source.trim().length === 0) return []
        var chunks = source.split(/\n{2,}/)
        var out = []
        var i
        for (i = 0; i < chunks.length; i += 1) {
          var chunk = chunks[i]
          var fence = /^```([\s\S]*?)```$/.exec(chunk.trim())
          if (fence !== null) {
            out.push(h('pre', { key: 'code-' + i, className: 'prw-code' }, fence[1].replace(/^\n+|\n+$/g, '')))
            continue
          }
          out.push(h('p', { key: 'p-' + i, className: 'prw-body' }, safeText(chunk)))
        }
        return out
      }

      /**
       * A relative timestamp, tolerating a missing or unparsable value.
       *
       * The primitive's `relativeTime(at, now)` is a BUCKETING function, not a
       * formatter: it takes two epoch-millisecond numbers and returns
       * `{ unit, n }` for the caller to localize. Returning that object straight
       * into a React child throws `Objects are not valid as a React child`, which
       * blanks the whole panel — so the bucket is always resolved to text here,
       * and the dictionary owns the words.
       *
       * @param {string|null} iso
       * @param {Function} [t] - the bound translator.
       * @returns {string}
       */
      function when(iso, t) {
        if (typeof iso !== 'string' || iso.length === 0) return ''
        var date = new Date(iso)
        var at = date.getTime()
        if (isNaN(at)) return ''
        var bucket = null
        try {
          if (typeof P.relativeTime === 'function') bucket = P.relativeTime(at, Date.now())
        } catch {
          bucket = null
        }
        if (bucket === null || typeof bucket !== 'object' || typeof bucket.unit !== 'string') {
          return date.toISOString().slice(0, 10)
        }
        if (typeof t === 'function') {
          var text = t('time.' + bucket.unit)
          if (typeof text === 'string' && text.length > 0 && text.indexOf('time.') !== 0) {
            return bucket.unit === 'now' ? text : fill(text, { n: bucket.n })
          }
        }
        return bucket.unit === 'now' ? 'now' : bucket.n + UNIT_SUFFIX[bucket.unit]
      }

      /**
       * Which of the primitive's dot states a verdict maps to.
       *
       * `StateDot` is aria-hidden, so every caller pairs it with the text label;
       * the dot never carries information alone.
       *
       * @param {string} verdict
       * @returns {'done'|'warning'|'ongoing'|'error'|'idle'}
       */
      function dotFor(verdict) {
        if (verdict === 'success' || verdict === 'pass') return 'done'
        if (verdict === 'pending') return 'ongoing'
        if (verdict === 'failure' || verdict === 'fail') return 'error'
        if (verdict === 'cancelled' || verdict === 'skipped' || verdict === 'stale' || verdict === 'not_configured') return 'warning'
        return 'idle'
      }

      /**
       * The colour tone for a status tag.
       *
       * @param {string} verdict
       * @returns {string}
       */
      function toneFor(verdict) {
        if (verdict === 'success' || verdict === 'pass' || verdict === 'merged') return 'success'
        if (verdict === 'failure' || verdict === 'fail') return 'danger'
        if (verdict === 'pending') return 'warning'
        return 'neutral'
      }

      /**
       * Run `fn` when the pointer/keyboard activates a clickable non-button.
       *
       * @param {Function} fn
       * @returns {object}
       */
      function activate(fn) {
        return {
          role: 'button',
          tabIndex: 0,
          onClick: fn,
          onKeyDown: function (event) {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              fn(event)
            }
          },
        }
      }

      /**
       * Whether the search box text is a pull request reference rather than a
       * search phrase.
       *
       * This only decides WHICH request to make. The host owns the real parsing
       * (`parsePullReference` in lib/host/pull.js) and rejects anything that is
       * not a reference, so a wrong guess here costs one extra round trip and
       * then falls back to search — it never lets a non-reference through as a
       * target.
       *
       * Kept in step with the host on purpose: an anchored github.com URL,
       * a scheme-less `owner/repo/pull/123`, `owner/repo#123`, and the bare
       * `#123` / `123` form. Bare numbers need a repository to attach to, so
       * reporting them as references is only right when one is in view.
       *
       * @param {string} text
       * @returns {boolean}
       */
      function looksLikeReference(text) {
        if (typeof text !== 'string') return false
        var trimmed = text.trim()
        if (trimmed.length === 0) return false
        if (/^(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+(?:[/?#].*)?$/i.test(trimmed)) return true
        if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+(?:[/?#].*)?$/.test(trimmed)) return true
        if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#\d+$/.test(trimmed)) return true
        if (/^#?\d+$/.test(trimmed)) return true
        return false
      }

      return {
        ROUTE: ROUTE,
        call: call,
        problem: problem,
        hash: hash,
        count: count,
        safeText: safeText,
        isSafeUrl: isSafeUrl,
        bodyBlocks: bodyBlocks,
        when: when,
        dotFor: dotFor,
        toneFor: toneFor,
        activate: activate,
        looksLikeReference: looksLikeReference,
      }
    })()

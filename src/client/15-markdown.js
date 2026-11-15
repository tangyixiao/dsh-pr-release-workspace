    /* Markdown tokens become React elements, never untrusted HTML. */
    PRW.renderMarkdown = (function () {
      var parser = new PRWMarkdown({ html: false, linkify: true })
      var allowed = /^(?:p|h[1-6]|blockquote|ul|ol|li|table|thead|tbody|tr|th|td|em|strong|s|a)$/

      function render(tokens, listItem) {
        var root = { children: [], listItem: listItem === true }
        var stack = [root]
        tokens.forEach(function (token, index) {
          var frame = stack[stack.length - 1]
          var props = { key: index }
          if (token.nesting === 1) {
            var tag = allowed.test(token.tag) ? token.tag : 'span'
            if (tag === 'a') {
              var href = token.attrGet('href') || ''
              if (PRW.util.isSafeUrl(href)) {
                props.href = href
                props.target = '_blank'
                props.rel = 'noreferrer noopener'
                props.className = 'prw-link'
              } else tag = 'span'
            }
            if (tag === 'ol' && token.attrGet('start')) props.start = Number(token.attrGet('start'))
            var align = token.attrGet('style')
            if ((tag === 'td' || tag === 'th') && /^text-align:(left|right|center)$/.test(align || '')) {
              props.style = { textAlign: align.split(':')[1] }
            }
            stack.push({ tag: tag, props: props, children: [], hidden: token.hidden,
              listItem: frame.listItem || tag === 'li' })
          } else if (token.nesting === -1) {
            var done = stack.pop()
            var parent = stack[stack.length - 1]
            var element = done.hidden ? done.children : h(done.tag, done.props, done.children)
            parent.children.push(done.tag === 'table'
              ? h('div', { key: index, className: 'prw-tableScroll' }, element) : element)
          } else if (token.type === 'inline') {
            frame.children.push(render(token.children || [], frame.listItem))
          } else if (token.type === 'text') {
            var task = frame.listItem && index === 0 ? /^\[([ xX])\]\s+/.exec(token.content) : null
            if (task) frame.children.push(h('input', { key: 'task-' + index, type: 'checkbox',
              disabled: true, checked: task[1] !== ' ', readOnly: true }))
            frame.children.push(task ? token.content.slice(task[0].length) : token.content)
          } else if (token.type === 'code_inline') {
            frame.children.push(h('code', props, token.content))
          } else if (token.type === 'fence' || token.type === 'code_block') {
            var language = (token.info || '').trim().split(/\s+/)[0]
            props.className = 'prw-code'
            if (language) props['data-language'] = language
            frame.children.push(h('pre', props, h('code', null, token.content)))
          } else if (token.type === 'softbreak') frame.children.push('\n')
          else if (token.type === 'hardbreak') frame.children.push(h('br', props))
          else if (token.type === 'hr') frame.children.push(h('hr', props))
          else if (token.type === 'image') {
            // External images stay explicit links rather than loading trackers
            // inside the authenticated local host origin.
            var src = token.attrGet('src') || ''
            var label = token.content || src
            frame.children.push(PRW.util.isSafeUrl(src)
              ? h('a', { key: index, href: src, target: '_blank', rel: 'noreferrer noopener', className: 'prw-link' }, label)
              : label)
          } else frame.children.push(token.content || '')
        })
        return root.children
      }
      return function (text) {
        if (typeof text !== 'string' || text.trim().length === 0) return []
        return [h('div', { key: 'markdown', className: 'prw-markdown' }, render(parser.parse(text, {}), false))]
      }
    })()

    /* =================================================================== */
    /* styles                                                              */
    /* =================================================================== */

    /**
     * Every rule the panel needs, in one sheet.
     *
     * Colours come from the theme's own alias tokens rather than literal values,
     * so the panel follows the app's light/dark switch and any theme a user
     * installs. The few sizes and radii here match the primitives package's
     * geometry (24px chips, 12px pill radius) so a tag beside a `Pill` looks like
     * it belongs to the same design system.
     */
    PRW.CSS = [
      /* ---- layout ---- */
      '.prw-root{display:flex;flex-direction:column;height:100%;min-height:0;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary);}',
      '.prw-head{display:flex;flex-direction:column;gap:10px;padding:16px 20px 0;flex:none;}',
      '.prw-titleRow{display:flex;align-items:baseline;gap:10px;justify-content:space-between;}',
      '.prw-title{font-size:16px;font-weight:600;margin:0;}',
      '.prw-sub{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;}',
      '.prw-toolbar{display:flex;align-items:center;gap:8px;}',
      '.prw-toolbar .prw-grow{flex:1 1 auto;min-width:120px;}',
      '.prw-tabs{display:flex;gap:6px;padding:12px 20px 0;flex-wrap:wrap;flex:none;}',
      '.prw-body{flex:1 1 auto;min-height:0;overflow:auto;padding:12px 20px 24px;}',

      /* ---- generic ---- */
      '.prw-link{color:var(--dsw-alias-brand-primary-new-colorprimary-new-color);text-decoration:none;}',
      '.prw-link:hover{text-decoration:underline;}',
      '.prw-row{display:flex;align-items:center;gap:8px;min-width:0;}',
      '.prw-col{display:flex;flex-direction:column;gap:2px;min-width:0;}',
      '.prw-grow{flex:1 1 auto;min-width:0;}',
      '.prw-muted{color:var(--dsw-alias-label-tertiary);}',
      '.prw-secondary{color:var(--dsw-alias-label-secondary);}',
      '.prw-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;}',
      '.prw-truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.prw-wrap{overflow-wrap:anywhere;}',
      '.prw-clamp2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
      '.prw-note{font-size:12px;color:var(--dsw-alias-label-tertiary);}',
      '.prw-body p{margin:0 0 8px;}',
      '.prw-body p:last-child{margin-bottom:0;}',
      '.prw-code{margin:8px 0;padding:8px 10px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;overflow:auto;white-space:pre;}',

      /* ---- list ---- */
      '.prw-list{display:flex;flex-direction:column;gap:2px;}',
      '.prw-item{display:flex;gap:10px;align-items:flex-start;padding:9px 10px;border-radius:8px;cursor:pointer;border:1px solid transparent;}',
      '.prw-item:hover{background:var(--dsw-alias-interactive-bg-hover);}',
      '.prw-item:focus-visible{outline:2px solid var(--dsw-alias-brand-primary-new-colorprimary-new-color);outline-offset:-2px;}',
      '.prw-item[aria-current="true"]{background:var(--dsw-alias-button-ghost-active-fill);border-color:var(--dsw-alias-button-ghost-active-border);}',
      '.prw-itemMain{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 auto;}',
      '.prw-itemTitle{display:flex;align-items:baseline;gap:6px;min-width:0;}',
      '.prw-itemNum{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;flex:none;}',
      '.prw-itemName{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.prw-itemMeta{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-tertiary);font-size:12px;min-width:0;}',
      '.prw-itemRepo{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:45%;}',
      '.prw-itemTags{display:flex;align-items:center;gap:4px;flex:none;flex-wrap:wrap;justify-content:flex-end;max-width:45%;}',

      /* ---- detail ---- */
      '.prw-detail{display:flex;flex-direction:column;gap:14px;}',
      '.prw-card{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:10px;}',
      '.prw-cardHead{display:flex;align-items:center;gap:8px;justify-content:space-between;flex-wrap:wrap;}',
      '.prw-cardTitle{font-weight:600;margin:0;font-size:13px;}',
      '.prw-kv{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:12px;}',
      '.prw-kvKey{color:var(--dsw-alias-label-tertiary);}',
      '.prw-facts{display:flex;flex-direction:column;gap:1px;}',
      '.prw-fact{display:grid;grid-template-columns:18px 1fr auto;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--dsw-alias-border-l1);}',
      '.prw-fact:last-child{border-bottom:none;}',
      '.prw-factName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.prw-factVal{display:flex;align-items:center;gap:6px;justify-content:flex-end;flex-wrap:wrap;font-size:12px;}',

      /* ---- diff ---- */
      '.prw-file{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;cursor:pointer;}',
      '.prw-file:hover{background:var(--dsw-alias-interactive-bg-hover);}',
      '.prw-file[aria-expanded="true"]{background:var(--dsw-alias-bg-layer-2);}',
      '.prw-diffWrap{margin:2px 0 8px;padding-left:8px;border-left:2px solid var(--dsw-alias-border-l2);}',
      '.prw-stat{font-variant-numeric:tabular-nums;font-size:12px;white-space:nowrap;}',
      '.prw-add{color:var(--dsw-alias-state-success-primary);}',
      '.prw-del{color:var(--dsw-alias-state-error-primary);}',

      /* ---- comments ---- */
      '.prw-comment{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:10px;background:var(--dsw-alias-bg-layer-2);}',
      '.prw-commentHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-tertiary);}',
      '.prw-commentBy{color:var(--dsw-alias-label-primary);font-weight:600;}',
      '.prw-thread{border-left:2px solid var(--dsw-alias-border-l2);padding-left:10px;margin-left:2px;}',
      '.prw-hunk{max-height:120px;overflow:auto;border-radius:6px;background:var(--dsw-alias-bg-layer-1);padding:6px 8px;}',

      /* ---- drafts ---- */
      '.prw-draft{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);}',
      '.prw-draftStale{border-color:var(--dsw-alias-state-warn-primary);}',
      '.prw-editor{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l3);}',
      '.prw-textarea{width:100%;min-height:76px;resize:vertical;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;}',
      '.prw-textarea:focus{outline:2px solid var(--dsw-alias-brand-primary-new-colorprimary-new-color);outline-offset:-1px;}',

      /* ---- states ---- */
      '.prw-state{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:20px 4px;max-width:520px;}',
      '.prw-stateTitle{font-weight:600;}',
      '.prw-badge{display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 7px;border-radius:10px;font-size:11px;line-height:1;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);white-space:nowrap;}',
      '.prw-badge[data-tone="success"]{color:var(--dsw-alias-state-success-primary);}',
      '.prw-badge[data-tone="danger"]{color:var(--dsw-alias-state-error-primary);}',
      '.prw-badge[data-tone="warning"]{color:var(--dsw-alias-state-warn-label);}',
      '.prw-skel{height:13px;border-radius:6px;background:var(--dsw-alias-bg-skeleton);animation:prwPulse 1.4s ease-in-out infinite;}',
      '@keyframes prwPulse{0%,100%{opacity:.55}50%{opacity:1}}',
      '@media (prefers-reduced-motion: reduce){.prw-skel{animation:none}}',
    ].join('\n')

    /**
     * Insert the panel's stylesheet, returning a disposer.
     *
     * Keyed explicitly: a second `installStyles` call with the same content must
     * not append a duplicate sheet, and the module system claims untagged `<style>`
     * tags on materialization, so the sheet carries its own marker too.
     *
     * @param {string} css
     * @param {string} key
     * @returns {Function}
     */
    PRW.installStyles = function installStyles(css, key) {
      if (typeof document === 'undefined' || document.head === null || document.head === undefined) {
        return function () {}
      }
      var attr = 'data-dsh-pr-release-workspace'
      var existing = document.querySelector('style[' + attr + '="' + key + '"]')
      if (existing !== null && existing !== undefined) return function () {}
      var tag = document.createElement('style')
      tag.setAttribute(attr, key)
      tag.textContent = css
      document.head.appendChild(tag)
      return function () {
        if (tag.parentNode !== null) tag.parentNode.removeChild(tag)
      }
    }

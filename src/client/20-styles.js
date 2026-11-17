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
      '.prw-root{display:flex;flex-direction:column;height:100%;min-height:0;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary,#edf0f4);}',
      '.prw-compatNote{flex:none;padding:7px 24px;border-top:1px solid var(--dsw-alias-border-l1,#303641);font-size:11px;}',
      '.prw-brandTitle{display:flex;align-items:center;gap:9px;}.prw-brandTitle>svg{flex:none;}',
      '.prw-prIcon{display:inline-flex;flex:none;align-self:center;color:var(--dsw-alias-label-tertiary,#9fa9b8);}.prw-prIcon[data-state="open"]{color:var(--dsw-alias-state-success-primary,#82d5a2);}.prw-prIcon[data-state="closed"]{color:var(--dsw-alias-state-error-primary,#ff9a9a);}.prw-prIcon[data-state="merged"]{color:#c7abff;}.prw-stateBadge{gap:5px;}.prw-stateBadge>svg{flex:none;}',
      '.prw-head{display:flex;flex-direction:column;gap:10px;padding:16px 20px 0;flex:none;}',
      '.prw-titleRow{display:flex;align-items:baseline;gap:10px;justify-content:space-between;}',
      '.prw-title{font-size:16px;font-weight:600;margin:0;}',
      '.prw-sub{margin:0;color:var(--dsw-alias-label-tertiary,#9fa9b8);font-size:12px;}',
      '.prw-toolbar{display:flex;align-items:center;gap:8px;}',
      '.prw-toolbar .prw-grow{flex:1 1 auto;min-width:120px;}',
      '.prw-tabs{display:flex;gap:6px;padding:12px 20px 0;flex-wrap:wrap;flex:none;}',
      '.prw-body{flex:1 1 auto;min-height:0;overflow:auto;padding:12px 20px 24px;}',

      /* ---- generic ---- */
      '.prw-link{color:var(--dsw-alias-brand-primary-new-colorprimary-new-color,#86a9ff);text-decoration:none;}',
      '.prw-link:hover{text-decoration:underline;}',
      '.prw-row{display:flex;align-items:center;gap:8px;min-width:0;}',
      '.prw-col{display:flex;flex-direction:column;gap:2px;min-width:0;}',
      '.prw-grow{flex:1 1 auto;min-width:0;}',
      '.prw-muted{color:var(--dsw-alias-label-tertiary,#9fa9b8);}',
      '.prw-secondary{color:var(--dsw-alias-label-secondary,#c4cbd6);}',
      '.prw-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;}',
      '.prw-truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.prw-wrap{overflow-wrap:anywhere;}',
      '.prw-clamp2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
      '.prw-note{font-size:12px;color:var(--dsw-alias-label-tertiary,#9fa9b8);}',
      '.prw-body p{margin:0 0 8px;}',
      '.prw-body p:last-child{margin-bottom:0;}',
      '.prw-code{margin:8px 0;padding:8px 10px;border-radius:8px;background:var(--dsw-alias-bg-layer-2,#1c2027);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;overflow:auto;white-space:pre;}',

      /* ---- list ---- */
      '.prw-list{display:flex;flex-direction:column;gap:2px;}',
      '.prw-item{display:flex;gap:10px;align-items:flex-start;padding:9px 10px;border-radius:8px;cursor:pointer;border:1px solid transparent;}',
      '.prw-item:hover{background:var(--dsw-alias-interactive-bg-hover,#222833);}',
      '.prw-item:focus-visible{outline:2px solid var(--dsw-alias-brand-primary-new-colorprimary-new-color,#86a9ff);outline-offset:-2px;}',
      '.prw-item[aria-current="true"]{background:var(--dsw-alias-button-ghost-active-fill,#28354b);border-color:var(--dsw-alias-button-ghost-active-border,#86a9ff);}',
      '.prw-itemMain{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 auto;}',
      '.prw-itemTitle{display:flex;align-items:baseline;gap:6px;min-width:0;}',
      '.prw-itemNum{color:var(--dsw-alias-label-tertiary,#9fa9b8);font-variant-numeric:tabular-nums;flex:none;}',
      '.prw-itemName{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.prw-itemMeta{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-tertiary,#9fa9b8);font-size:12px;min-width:0;}',
      '.prw-itemRepo{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:45%;}',
      '.prw-itemTags{display:flex;align-items:center;gap:4px;flex:none;flex-wrap:wrap;justify-content:flex-end;max-width:45%;}',

      /* ---- detail ---- */
      '.prw-detail{display:flex;flex-direction:column;gap:14px;}',
      '.prw-card{border:1px solid var(--dsw-alias-border-l2,#3c4451);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:10px;}',
      '.prw-cardHead{display:flex;align-items:center;gap:8px;justify-content:space-between;flex-wrap:wrap;}',
      '.prw-cardTitle{font-weight:600;margin:0;font-size:13px;}',
      '.prw-kv{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:12px;}',
      '.prw-kvKey{color:var(--dsw-alias-label-tertiary,#9fa9b8);}',
      '.prw-facts{display:flex;flex-direction:column;gap:1px;}',
      '.prw-fact{display:grid;grid-template-columns:18px 1fr auto;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--dsw-alias-border-l1,#303641);}',
      '.prw-fact:last-child{border-bottom:none;}',
      '.prw-factName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.prw-factVal{display:flex;align-items:center;gap:6px;justify-content:flex-end;flex-wrap:wrap;font-size:12px;}',

      /* ---- diff ---- */
      '.prw-file{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;cursor:pointer;}',
      '.prw-file:hover{background:var(--dsw-alias-interactive-bg-hover,#222833);}',
      '.prw-file[aria-expanded="true"]{background:var(--dsw-alias-bg-layer-2,#1c2027);}',
      '.prw-diffWrap{margin:2px 0 8px;padding-left:8px;border-left:2px solid var(--dsw-alias-border-l2,#3c4451);}',
      '.prw-stat{font-variant-numeric:tabular-nums;font-size:12px;white-space:nowrap;}',
      '.prw-add{color:var(--dsw-alias-state-success-primary,#82d5a2);}',
      '.prw-del{color:var(--dsw-alias-state-error-primary,#ff9a9a);}',

      /* ---- comments ---- */
      '.prw-comment{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:10px;background:var(--dsw-alias-bg-layer-2,#1c2027);}',
      '.prw-commentHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-tertiary,#9fa9b8);}',
      '.prw-commentBy{color:var(--dsw-alias-label-primary,#edf0f4);font-weight:600;}',
      '.prw-thread{border-left:2px solid var(--dsw-alias-border-l2,#3c4451);padding-left:10px;margin-left:2px;}',
      '.prw-hunk{max-height:120px;overflow:auto;border-radius:6px;background:var(--dsw-alias-bg-layer-1,#15171b);padding:6px 8px;}',

      /* ---- drafts ---- */
      '.prw-draft{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2,#3c4451);}',
      '.prw-draftStale{border-color:var(--dsw-alias-state-warn-primary,#e8be72);}',
      '.prw-editor{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l3,#566071);}',
      '.prw-textarea{width:100%;min-height:76px;resize:vertical;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l3,#566071);background:var(--dsw-alias-bg-layer-1,#15171b);color:var(--dsw-alias-label-primary,#edf0f4);font:inherit;font-size:13px;}',
      '.prw-textarea:focus{outline:2px solid var(--dsw-alias-brand-primary-new-colorprimary-new-color,#86a9ff);outline-offset:-1px;}',

      /* ---- states ---- */
      '.prw-state{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:20px 4px;max-width:520px;}',
      '.prw-stateTitle{font-weight:600;}',
      '.prw-badge{display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 7px;border-radius:10px;font-size:11px;line-height:1;background:var(--dsw-alias-bg-layer-3,#292f39);color:var(--dsw-alias-label-secondary,#c4cbd6);white-space:nowrap;}',
      '.prw-badge[data-tone="success"]{color:var(--dsw-alias-state-success-primary,#82d5a2);}',
      '.prw-badge[data-tone="danger"]{color:var(--dsw-alias-state-error-primary,#ff9a9a);}',
      '.prw-badge[data-tone="warning"]{color:var(--dsw-alias-state-warn-label,#e8be72);}',
      '.prw-skel{height:13px;border-radius:6px;background:var(--dsw-alias-bg-skeleton,#303641);animation:prwPulse 1.4s ease-in-out infinite;}',
      '@keyframes prwPulse{0%,100%{opacity:.55}50%{opacity:1}}',
      '@media (prefers-reduced-motion: reduce){.prw-skel{animation:none}}',
      ".prw-root{font-family:Inter,\"Segoe UI\",\"Microsoft YaHei\",sans-serif;background:var(--dsw-alias-bg-layer-1,#15171b);font-size:13px;container-type:inline-size;isolation:isolate;}",
      ".prw-root *{box-sizing:border-box;}",
      ".prw-shell{width:100%;min-width:0;overflow:hidden;max-height:100dvh;}",
      ".prw-shellContent{display:flex;flex-direction:column;flex:1 1 0;min-height:0;min-width:0;overflow:hidden;}",
      ".prw-shellContent>.prw-root{height:auto;flex:1 1 0;min-height:0;min-width:0;}",
      ".prw-body{overscroll-behavior:contain;scrollbar-gutter:stable;}",
      ".prw-root button,.prw-root input,.prw-root select{font:inherit;}",
      ".prw-head{padding:20px 24px 0;gap:12px;}",
      ".prw-title{font-size:18px;line-height:1.4;font-weight:600;}",
      ".prw-body{padding:16px 24px 24px;}",
      ".prw-tabs{padding:12px 24px 0;gap:6px;}",
      ".prw-stateFilter{display:flex;align-items:center;gap:8px;margin-left:auto;min-width:0;color:var(--dsw-alias-label-secondary,#c4cbd6);font-size:12px;}",
      ".prw-groupTabs{display:flex;flex-wrap:wrap;gap:6px;min-width:0;}.prw-listTools{align-items:center;}",
      ".prw-stateFilter select{max-width:100%;min-height:34px;padding:6px 28px 6px 10px;border:1px solid var(--dsw-alias-border-l2,#3c4451);border-radius:7px;background:var(--dsw-alias-bg-layer-2,#1c2027);color:var(--dsw-alias-label-primary,#edf0f4);color-scheme:dark light;}",
      ".prw-stateFilter select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary-new-colorprimary-new-color,#86a9ff);outline-offset:2px;}",
      "@container (max-width:680px){.prw-stateFilter{width:100%;justify-content:space-between;margin-left:0;}.prw-stateFilter select{flex:1;min-width:0;}}",
      ".prw-shell>.prw-tabs{padding-top:12px;padding-bottom:0;border-bottom:1px solid var(--dsw-alias-border-l1,#303641);}",
      ".prw-shell>.prw-tabs .prw-tab{border-radius:0;border:0;border-bottom:2px solid transparent;background:transparent;padding:10px 12px;}",
      ".prw-shell>.prw-tabs .prw-tab[data-active=\"true\"]{color:var(--dsw-alias-brand-primary-new-colorprimary-new-color,#86a9ff);border-bottom-color:currentColor;}",
      ".prw-root button,.prw-button,.prw-tab{color:inherit;cursor:pointer;}",
      ".prw-button,.prw-tab,.prw-toolbar button{min-height:34px;padding:6px 12px;border:1px solid var(--dsw-alias-border-l2,#3c4451);border-radius:7px;background:var(--dsw-alias-bg-layer-2,#1c2027);line-height:1.4;white-space:nowrap;}",
      ".prw-tab{border-color:transparent;background:transparent;}",
      ".prw-tab[data-active=\"true\"]{background:var(--dsw-alias-bg-layer-3,#292f39);border-color:var(--dsw-alias-border-l2,#3c4451);}",
      ".prw-root button:hover{background:var(--dsw-alias-interactive-bg-hover,#222833);}",
      ".prw-root button:disabled{opacity:.5;cursor:default;}",
      ".prw-root button:focus-visible,.prw-root input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary-new-colorprimary-new-color,#86a9ff);outline-offset:2px;}",
      ".prw-toolbar .prw-grow{display:block;}",
      ".prw-toolbar .prw-grow>span{display:flex;width:100%;height:auto;padding:0;border:0;background:transparent;}",
      ".prw-toolbar input{display:block;width:100%;min-width:0;height:36px;padding:8px 12px;border:1px solid var(--dsw-alias-border-l3,#566071);border-radius:7px;background:var(--dsw-alias-bg-layer-2,#1c2027);color:inherit;}",
      ".prw-root input::placeholder{color:var(--dsw-alias-label-tertiary,#9fa9b8);opacity:1;}",
      ".prw-list{gap:0;border:1px solid var(--dsw-alias-border-l2,#3c4451);border-radius:9px;overflow:hidden;}",
      ".prw-item,.prw-listHead{display:grid;grid-template-columns:minmax(0,1fr) 300px 76px;gap:16px;align-items:center;}",
      ".prw-listHead{padding:10px 14px;background:var(--dsw-alias-bg-layer-2,#1c2027);font-size:12px;color:var(--dsw-alias-label-secondary,#c4cbd6);border-bottom:1px solid var(--dsw-alias-border-l1,#303641);}",
      ".prw-item{padding:13px 14px;border:0;border-bottom:1px solid var(--dsw-alias-border-l1,#303641);border-radius:0;min-height:72px;}",
      ".prw-item:last-child{border-bottom:0;}",
      ".prw-itemMain{gap:5px;}",
      ".prw-itemName{font-weight:600;line-height:1.5;}",
      ".prw-itemRepo{max-width:100%;}",
      ".prw-itemTags{max-width:none;justify-content:flex-start;gap:5px;}",
      ".prw-itemTime{color:var(--dsw-alias-label-tertiary,#9fa9b8);font-size:12px;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;}",
      ".prw-badge{height:auto;min-height:22px;padding:3px 7px;border:1px solid var(--dsw-alias-border-l2,#3c4451);border-radius:5px;font-size:11px;background:transparent;line-height:1.3;}",
      ".prw-badge[data-tone=\"merged\"]{color:#c7abff;}",
      ".prw-markdown{line-height:1.75;font-size:13px;min-width:0;overflow-wrap:anywhere;}",
      ".prw-markdown>:first-child{margin-top:0;}.prw-markdown>:last-child{margin-bottom:0;}",
      ".prw-markdown p{padding:0;margin:0 0 12px;white-space:normal;}",
      ".prw-markdown h1,.prw-markdown h2,.prw-markdown h3,.prw-markdown h4,.prw-markdown h5,.prw-markdown h6{font-weight:600;line-height:1.4;margin:22px 0 10px;}",
      ".prw-markdown h1{font-size:22px;}.prw-markdown h2{font-size:18px;}.prw-markdown h3{font-size:16px;}.prw-markdown h4,.prw-markdown h5,.prw-markdown h6{font-size:14px;}",
      ".prw-markdown ul,.prw-markdown ol{margin:8px 0 14px;padding-left:24px;}.prw-markdown li{margin:4px 0;}",
      ".prw-markdown blockquote{margin:12px 0;padding:4px 14px;border-left:2px solid var(--dsw-alias-border-l3,#566071);color:var(--dsw-alias-label-secondary,#c4cbd6);}",
      ".prw-markdown code{font-family:ui-monospace,Consolas,monospace;font-size:12px;background:var(--dsw-alias-bg-layer-2,#1c2027);border-radius:4px;padding:2px 5px;}",
      ".prw-markdown .prw-code{padding:12px 14px;margin:12px 0;max-width:100%;line-height:1.6;}.prw-markdown pre code{padding:0;border-radius:0;background:transparent;}",
      ".prw-markdown pre[data-language]:before{content:attr(data-language);display:block;font:11px \"Segoe UI\",sans-serif;color:var(--dsw-alias-label-tertiary,#9fa9b8);margin-bottom:8px;}",
      ".prw-tableScroll{overflow:auto;max-width:100%;margin:12px 0;}.prw-markdown table{border-collapse:collapse;min-width:60%;font-size:12px;}.prw-markdown th,.prw-markdown td{border:1px solid var(--dsw-alias-border-l2,#3c4451);padding:7px 10px;}.prw-markdown th{background:var(--dsw-alias-bg-layer-2,#1c2027);text-align:left;}",
      ".prw-markdown input[type=\"checkbox\"]{accent-color:var(--dsw-alias-brand-primary-new-colorprimary-new-color,#86a9ff);margin:0 6px 0 0;}",
      ".prw-markdown hr{border:0;border-top:1px solid var(--dsw-alias-border-l2,#3c4451);margin:18px 0;}",
      ".prw-root ::selection{background:var(--dsw-alias-button-ghost-active-fill,#28354b);color:inherit;}",
      ".prw-root{scrollbar-color:var(--dsw-alias-border-l3,#566071) transparent;scrollbar-width:thin;}",
      "@container (max-width:1000px){.prw-item,.prw-listHead{grid-template-columns:minmax(0,1fr) 240px 70px;gap:10px;}.prw-itemTags{flex-wrap:wrap;}}",
      "@container (max-width:680px){.prw-head{padding:16px 14px 0;}.prw-tabs{padding-left:14px;padding-right:14px;gap:2px;}.prw-body{padding:14px;}.prw-listHead{display:none;}.prw-item{grid-template-columns:minmax(0,1fr) auto;gap:8px 10px;}.prw-itemMain{grid-column:1/-1;}.prw-itemTags{grid-column:1;grid-row:2;}.prw-itemTime{grid-column:2;grid-row:2;}.prw-itemName{white-space:normal;overflow-wrap:anywhere;}.prw-itemTitle{align-items:flex-start;}.prw-itemRepo{white-space:normal;overflow-wrap:anywhere;}.prw-card{padding:12px;}.prw-tab{padding:6px 9px;}.prw-toolbar .prw-grow{min-width:0;}.prw-kv{grid-template-columns:minmax(55px,auto) minmax(0,1fr);}.prw-kv>span{overflow-wrap:anywhere;}}",
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

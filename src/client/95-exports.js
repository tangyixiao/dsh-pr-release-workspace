    /* =================================================================== */
    /* presentational surface                                              */
    /* =================================================================== */

    /**
     * The pure presentational pieces, exposed on the namespace.
     *
     * They are already plain functions in this factory's scope; naming them on
     * `PRW` is what lets a test render one view against a real host payload
     * without standing up a DOM and driving React effects. Nothing here reads a
     * hook, so calling it outside React is safe — and that is exactly the property
     * worth pinning down in a test.
     *
     * The stateful views (`Workspace`, `Detail`, `Release`) stay hook-driven and
     * are exercised through the host's own render path instead.
     */
    PRW.views = {
      row: prRow,
      stateBadge: prStateBadge,
      failure: failure,
      empty: empty,
      skeletons: skeletons,
      ciLabel: ciLabel,
      button: button,
      tag: tag,
      status: status,
      header: header,
      groupSection: groupSection,
      listSection: listSection,
      detailHeader: detailHeader,
      overview: overview,
      mergeableText: mergeableText,
      filesView: filesView,
      commentsView: commentsView,
      draftsView: draftsView,
      draftCard: DraftCard,
      draftEditor: DraftEditor,
      diffLabels: diffLabels,
      diffBody: DiffBody,
      factTable: factTable,
      field: field,
      verdictLabel: verdictLabel,
    }

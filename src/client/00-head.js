window.__ModuleLoader__.load({
  id: 'dsh-pr-release-workspace',
  factory(require) {
    var React = require('react')
    var h = React.createElement
    var P = require('@deepseek-ai/dsh-client-ui-primitives')
    var PRW = {}

    /**
     * Namespace for the client half.
     *
     * Everything lives on one object because the bundle is a single classic
     * script: there is no module scope to hide things in, and two plugins
     * defining a top-level `format` would collide on `window`.
     */

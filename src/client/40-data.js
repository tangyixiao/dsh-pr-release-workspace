    /* =================================================================== */
    /* data loading                                                        */
    /* =================================================================== */

    /**
     * A request-tick hook.
     *
     * Every load gets a ticket; only the newest ticket may write state. Without
     * this, switching PRs twice quickly lets a slow first answer overwrite the
     * second one's result — the classic out-of-order write that makes a detail
     * view show one PR's diff under another PR's title.
     *
     * `run` is an identity, not just a callback: it is expected to be wrapped in
     * `useCallback` by the caller, and a new identity means the inputs changed and
     * the request must be re-issued. That is what lets a request wait for a
     * precondition (identity before groups, a PR before its diff) without the
     * caller having to sequence the calls by hand — the alternative, loading
     * exactly once on mount, silently drops the second load when the
     * precondition only becomes true later.
     *
     * @param {Function} run - receives a signal and returns a promise.
     * @returns {{ state: object, reload: Function }}
     */
    PRW.useRequest = function useRequest(run) {
      var initial = { status: 'idle', value: null, error: null }
      var pair = React.useState(initial)
      var state = pair[0]
      var setState = pair[1]
      var seq = React.useRef(0)
      var abortRef = React.useRef(null)
      var aliveRef = React.useRef(true)
      var runRef = React.useRef(run)
      runRef.current = run

      React.useEffect(function () {
        aliveRef.current = true
        return function () {
          aliveRef.current = false
          if (abortRef.current !== null) abortRef.current.abort()
        }
      }, [])

      var load = React.useCallback(function () {
        if (abortRef.current !== null) abortRef.current.abort()
        var controller = typeof AbortController === 'function' ? new AbortController() : null
        abortRef.current = controller
        seq.current += 1
        var ticket = seq.current
        setState({ status: 'loading', value: null, error: null })
        var promise
        try {
          promise = runRef.current(controller === null ? undefined : controller.signal)
        } catch (error) {
          promise = Promise.reject(error)
        }
        return promise.then(
          function (value) {
            if (ticket !== seq.current || !aliveRef.current) return
            setState({ status: 'ready', value: value, error: null })
          },
          function (error) {
            if (ticket !== seq.current || !aliveRef.current) return
            if (error && error.name === 'AbortError') return
            setState({ status: 'error', value: null, error: error })
          },
        )
      }, [])

      React.useEffect(function () {
        load()
      }, [load, run])

      return { state: state, reload: load }
    }

    /**
     * The connection/identity probe, shared by every screen.
     *
     * Identity is asked once per panel mount rather than per PR, because a
     * missing login makes every other request fail the same way and asking
     * repeatedly would burn the search quota for nothing.
     *
     * @param {boolean} enabled
     * @returns {{ state: object, reload: Function }}
     */
    PRW.useIdentity = function useIdentity(enabled) {
      return PRW.useRequest(
        React.useCallback(
          function (signal) {
            if (enabled === false) return Promise.resolve(null)
            return PRW.util.call('identity', {}, { signal: signal })
          },
          [enabled],
        ),
      )
    }

    /**
     * Poll while mounted, pausing on a hidden document.
     *
     * A release check is a handful of HTTP calls to npm, GitHub and the market
     * index; doing it every 15 seconds in a background window is pure waste, and
     * GitHub's search quota is only 30 requests a minute.
     *
     * @param {Function} fn
     * @param {number} intervalMs
     * @param {boolean} [enabled]
     * @returns {void}
     */
    PRW.usePolling = function usePolling(fn, intervalMs, enabled) {
      var ref = React.useRef(fn)
      ref.current = fn
      React.useEffect(
        function () {
          if (enabled === false) return undefined
          var stopped = false
          var timer = null
          var run = function () {
            if (stopped) return
            if (typeof document !== 'undefined' && document.hidden === true) return
            ref.current()
          }
          timer = setInterval(run, intervalMs)
          return function () {
            stopped = true
            if (timer !== null) clearInterval(timer)
          }
        },
        [intervalMs, enabled],
      )
    }

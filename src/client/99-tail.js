    PRW.inject = ['slots', 'locale']

    // The render harness and the loader both read these; the namespace handle is
    // inert at runtime and exists so the built bundle can be smoke-tested in Node
    // without a DOM.
    return { inject: PRW.inject, apply: PRW.apply, __PRW: PRW }
  },
})

/**
 * Host half of the `dsh-pr-release-workspace` bundle.
 *
 * Three jobs, in wiring order:
 *
 * 1. resolve where durable state lives and construct the draft store;
 * 2. register the `/dsh-pr-release-workspace/*` route with the web server, so the
 *    web client can ask about pull requests;
 * 3. expose exactly one read-only surface over `gh` — there is no write path in
 *    this file, by design.
 *
 * The plugin intentionally does **not** register any tool, model provider,
 * prompt fragment or agent hook. It adds a panel, and a panel is all it adds.
 *
 * @module dsh-pr-release-workspace
 */

import { homedir } from 'node:os'
import { join } from 'node:path'

import { createDraftStore, draftFile } from './host/drafts.js'
import {
  ROUTE_PREFIX,
  createEndpoints,
  dispatch,
  envelope,
  isTrustedLocalRequest,
  readJsonBody,
} from './host/routes.js'

/** Loader entry id. Also the `main` slot key the client uses. */
export const name = 'pr-release-workspace'

/** Inert defaults: every tunable is optional, so the patch row can stay empty. */
export const Config = undefined

/** No required services; the plugin degrades to "no data" without a web server. */
export const inject = []

/**
 * Resolve the Harness home the way every other DSH component does: the
 * `DSH_HOME` environment variable, else `~/.dsh`.
 *
 * @param {{ home?: string }} config
 * @returns {string}
 */
function resolveHome(config) {
  if (typeof config?.home === 'string' && config.home.length > 0) return config.home
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv
  return join(homedir(), '.dsh')
}

/**
 * A logger that never lets a missing `ctx.logger` break the plugin.
 *
 * @param {any} ctx
 * @returns {object}
 */
function makeLogger(ctx) {
  const logger = ctx?.logger
  // Cordis loggers are callable services whose severity methods are prototype
  // members reading `this`. Detaching one into a bare function (`const warn =
  // logger.warn`) drops that receiver and throws `this is not a function` — and
  // because the only call sites are error paths, the symptom is that a failing
  // endpoint dies instead of reporting its own failure. Always call through the
  // receiver, and never let logging itself raise.
  const through = (level, fallback) => (...args) => {
    try {
      const fn = logger?.[level]
      if (typeof fn === 'function') return fn.apply(logger, args)
    } catch {
      // A logger that throws must not become the failure it was reporting.
    }
    try {
      fallback(...args)
    } catch {
      // Console can be gone in a packaged host; there is nothing left to do.
    }
  }
  return {
    debug: through('debug', () => {}),
    info: through('info', () => {}),
    warn: through('warn', (...args) => console.warn(...args)),
    error: through('error', (...args) => console.error(...args)),
  }
}

/**
 * Install the bundle.
 *
 * @param {any} ctx Cordis context of this plugin entry.
 * @param {any} config Optional row configuration.
 */
export function apply(ctx, config) {
  const log = makeLogger(ctx)
  const home = resolveHome(config ?? {})

  const drafts = createDraftStore({ file: draftFile(home) })
  const raw = createEndpoints({ drafts, log })

  /** @type {Record<string, Function>} */
  const endpoints = {}
  for (const [key, run] of Object.entries(raw)) endpoints[key] = envelope(run, log)

  // The web server may not exist in every composition (a headless host, a test
  // harness). Registering is the only thing this plugin needs from it, so a
  // missing one is a warning, not a failure.
  ctx.inject(['webServer'], (inner) => {
    const webServer = inner.webServer
    if (webServer === null || webServer === undefined || typeof webServer.register !== 'function') {
      log.warn('[pr-release-workspace] no web server available; the panel will have no data')
      return
    }

    let disposer
    try {
      disposer = webServer.register({
        kind: 'prefix',
        path: ROUTE_PREFIX,
        handler: (request, response) => handleRequest({ request, response, endpoints, webServer, log }),
      })
    } catch (error) {
      log.warn('[pr-release-workspace] route registration failed', error)
      return
    }
    inner.effect(
      () => () => {
        try {
          if (typeof disposer === 'function') disposer()
        } catch (error) {
          log.warn('[pr-release-workspace] route dispose failed', error)
        }
      },
      'pr-release-workspace: route',
    )
  })

  log.info?.(`[pr-release-workspace] ready (home=${home})`)
}

/**
 * Handle one HTTP request.
 *
 * POST only, JSON only, trusted-local only, one endpoint per path. Every refusal
 * is a short status with no body detail, so a probing page learns nothing about
 * what exists behind the route.
 *
 * @param {object} deps
 * @param {import('node:http').IncomingMessage} deps.request
 * @param {import('node:http').ServerResponse} deps.response
 * @param {Record<string, Function>} deps.endpoints
 * @param {{ host?: string }} deps.webServer
 * @param {object} deps.log
 */
async function handleRequest({ request, response, endpoints, webServer, log }) {
  const send = (status, payload) => {
    if (response.headersSent || response.writableEnded) return
    const body = JSON.stringify(payload)
    response.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(body),
      // This route is a local IPC channel; it must never be framed or sniffed by
      // anything else.
      'x-content-type-options': 'nosniff',
    })
    response.end(body)
  }

  const sendText = (status, text) => {
    if (response.headersSent || response.writableEnded) return
    response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
    response.end(text)
  }

  try {
    if (request.method !== 'POST') {
      sendText(405, 'method not allowed')
      return
    }
    if (!isTrustedLocalRequest(request, webServer)) {
      sendText(403, 'forbidden')
      return
    }
    const contentType = String(request.headers?.['content-type'] ?? '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase()
    if (contentType !== 'application/json') {
      sendText(415, 'content type must be application/json')
      return
    }

    const pathname = String(request.url ?? '').split('?', 1)[0]
    const prefix = `${ROUTE_PREFIX}/`
    if (!pathname.startsWith(prefix)) {
      sendText(404, 'not found')
      return
    }
    let endpoint
    try {
      endpoint = decodeURIComponent(pathname.slice(prefix.length))
    } catch {
      sendText(400, 'bad endpoint')
      return
    }
    if (endpoint.length === 0 || endpoint.includes('/') || endpoint === '.' || endpoint === '..') {
      sendText(404, 'not found')
      return
    }

    let payload
    try {
      payload = await readJsonBody(request)
    } catch (error) {
      send(413, {
        ok: false,
        error: {
          code: error?.code === 'payload-too-large' ? 'payload-too-large' : 'bad-request',
          message: 'The request body could not be read.',
          retryAfterSeconds: null,
        },
      })
      return
    }

    // An aborted request must cancel the in-flight `gh` call rather than leave it
    // running against a client that is already gone.
    const controller = new AbortController()
    const onClose = () => {
      if (!response.writableEnded) controller.abort()
    }
    request.once('close', onClose)

    try {
      const result = await dispatch(endpoints, endpoint, payload, { signal: controller.signal })
      send(200, result)
    } finally {
      request.off('close', onClose)
    }
  } catch (error) {
    log.warn('[pr-release-workspace] request failed', error?.code ?? 'unknown')
    send(500, {
      ok: false,
      error: { code: 'internal', message: 'The request failed.', retryAfterSeconds: null },
    })
  }
}

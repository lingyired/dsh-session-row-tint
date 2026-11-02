/**
 * dsh-session-row-tint, Host half.
 *
 * Owns the durable store for per-workspace and per-Session decorations (a
 * background colour and a custom icon/emoji) plus the HTTP routes the browser
 * half talks to. It never touches Session or workspace identity, history,
 * membership or ordering — a decoration is only `id -> { color?, icon? }`.
 *
 * Session colours also exist in `@idoall/dsh-session-colors`; this half only
 * stores the extras that plugin does not model (workspace decorations, and
 * per-Session icons / a colour override).
 *
 * Everything is defensive: a Host half that throws can take Host boot down with
 * it, so every step degrades to "no durable store" instead of failing.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'

/** Mount name, kept in sync with package.json and the profile patch. */
export const name = 'dsh-session-row-tint'

/** Host services are acquired inside `apply`; nothing must exist beforehand. */
export const inject = []

/** Route prefix owned by this plugin; the browser half uses the same constant. */
export const ROUTE_PREFIX = '/plugins/dsh-session-row-tint'

/** Request bodies are tiny: an id, a colour, and a short icon string. */
const BODY_CAP = 64 * 1024

/** A colour as `#rrggbb`. */
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

/** One decoration cleaned to the fields the browser understands. */
function cleanDecoration(input) {
  const out = {}
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return out
  if (typeof input.color === 'string' && HEX_COLOR.test(input.color)) out.color = input.color
  if (typeof input.icon === 'string') {
    const icon = Array.from(input.icon.trim()).slice(0, 4).join('')
    if (icon !== '') out.icon = icon
  }
  return out
}

/** Keep only well-formed records so one bad entry cannot break the layer. */
function cleanMap(input) {
  const out = {}
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return out
  for (const id of Object.keys(input)) {
    if (typeof id !== 'string' || id === '') continue
    const cleaned = cleanDecoration(input[id])
    if (cleaned.color !== undefined || cleaned.icon !== undefined) out[id] = cleaned
  }
  return out
}

/** The durable decorations store, written atomically under `dataDir`. */
export function createStore(dataDir) {
  const file = typeof dataDir === 'string' && isAbsolute(dataDir) ? join(dataDir, 'decorations.json') : null
  const get = () => {
    if (file === null) return { workspaces: {}, sessions: {} }
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8'))
      const doc = raw === null || typeof raw !== 'object' ? {} : raw
      return { workspaces: cleanMap(doc.workspaces), sessions: cleanMap(doc.sessions) }
    } catch {
      return { workspaces: {}, sessions: {} }
    }
  }
  const set = (doc) => {
    if (file === null) return
    try {
      mkdirSync(dirname(file), { recursive: true })
      const tmp = `${file}.tmp-${process.pid}`
      writeFileSync(tmp, JSON.stringify({ version: 1, workspaces: doc.workspaces || {}, sessions: doc.sessions || {} }, null, 2))
      renameSync(tmp, file)
    } catch {
      // Degrade to serving the in-memory value for this process.
    }
  }
  return { get, set, status: { persistence: file === null ? 'session' : 'file' } }
}

/** Read a JSON object body, refusing anything oversized or mislabelled. */
async function readJson(req, limit = BODY_CAP) {
  const contentType = String(req.headers?.['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase()
  if (contentType !== 'application/json') throw Object.assign(new Error('content-type must be application/json'), { status: 415 })
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.byteLength
    if (size > limit) throw Object.assign(new Error('request body too large'), { status: 413 })
    chunks.push(chunk)
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks, size).toString('utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('body must be an object')
    return value
  } catch (error) {
    throw Object.assign(error, { status: 400 })
  }
}

/** Register the durable store and its routes when the web server is composed. */
export function apply(ctx, config = {}) {
  try {
    if (ctx === undefined || ctx === null || typeof ctx.inject !== 'function') return
    const store = createStore(config === null || config === undefined ? undefined : config.dataDir)
    ctx.inject(['webServer', 'connection'], (hostCtx) => {
      try {
        const webServer = hostCtx === undefined || hostCtx === null ? undefined : hostCtx.webServer
        const connection = hostCtx === undefined || hostCtx === null ? undefined : hostCtx.connection
        if (webServer === undefined || webServer === null || typeof webServer.register !== 'function') return

        const route = (path, handler) => {
          const register = () => webServer.register({
            kind: 'exact',
            path: `${ROUTE_PREFIX}${path}`,
            handler: async (req, res) => {
              try {
                const rejection = connection === undefined || connection === null ? undefined : connection.requestRejection(req)
                if (rejection !== undefined) {
                  res.statusCode = rejection
                  res.end(rejection === 401 ? 'unauthorized' : 'forbidden')
                  return
                }
              } catch {
                res.statusCode = 403
                res.end('forbidden')
                return
              }
              try {
                await handler(req, res)
              } catch (error) {
                sendJson(res, error?.status ?? 500, { error: error?.status ? error.message : 'internal error' })
              }
            },
          })
          return typeof ctx.effect === 'function' ? ctx.effect(register, `dsh-session-row-tint: route ${path}`) : register()
        }

        const write = async (req, res, bucket, idField) => {
          // A write must come from the page that owns this app.
          const site = String(req.headers?.['sec-fetch-site'] ?? '').toLowerCase()
          if (site && site !== 'same-origin' && site !== 'same-site' && site !== 'none') {
            sendJson(res, 403, { error: 'cross-site write refused' })
            return
          }
          const body = await readJson(req)
          const id = typeof body[idField] === 'string' ? body[idField] : ''
          if (id === '') {
            sendJson(res, 400, { error: `${idField} is required` })
            return
          }
          const doc = store.get()
          const current = { ...(doc[bucket][id] ?? {}) }
          if (body.color === null || body.color === '') delete current.color
          else if (typeof body.color === 'string' && HEX_COLOR.test(body.color)) current.color = body.color
          if (body.icon === null || body.icon === '') delete current.icon
          else if (typeof body.icon === 'string') {
            const icon = Array.from(body.icon.trim()).slice(0, 4).join('')
            if (icon !== '') current.icon = icon
            else delete current.icon
          }
          if (current.color === undefined && current.icon === undefined) delete doc[bucket][id]
          else doc[bucket][id] = current
          store.set(doc)
          sendJson(res, 200, { workspaces: doc.workspaces, sessions: doc.sessions, storage: store.status })
        }

        route('/decorations', async (req, res) => {
          if (req.method !== 'GET') {
            sendJson(res, 405, { error: 'method not allowed' })
            return
          }
          const doc = store.get()
          sendJson(res, 200, { workspaces: doc.workspaces, sessions: doc.sessions, storage: store.status })
        })
        route('/workspaces', async (req, res) => {
          if (req.method !== 'POST') {
            sendJson(res, 405, { error: 'method not allowed' })
            return
          }
          await write(req, res, 'workspaces', 'workspaceId')
        })
        route('/sessions', async (req, res) => {
          if (req.method !== 'POST') {
            sendJson(res, 405, { error: 'method not allowed' })
            return
          }
          await write(req, res, 'sessions', 'sessionId')
        })
      } catch {
        // A broken registration must not take the Host boot down.
      }
    })
  } catch {
    // Degrade to no durable store.
  }
}

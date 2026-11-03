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

/** Static icon catalog (Lucide + Simple Icons brands) served to the browser half. */
const ICONS_FILE = new URL('./icons.json', import.meta.url)
let iconsBody
function readIconsBody() {
  if (iconsBody === undefined) {
    try {
      iconsBody = readFileSync(ICONS_FILE, 'utf8')
    } catch {
      iconsBody = '{"icons":{},"keywords":{},"popular":[]}'
    }
  }
  return iconsBody
}

/** Request bodies are tiny: an id, a colour, and a short icon string. */
const BODY_CAP = 2 * 1024 * 1024

/** A colour as `#rrggbb`. */
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

/** A valid stored icon: `lucide:<name>`, or up to four emoji / characters. */
function cleanIcon(value) {
  if (typeof value !== 'string') return undefined
  const raw = value.trim()
  if (raw.startsWith('lucide:')) {
    const name = raw.slice('lucide:'.length)
    return /^[a-z0-9-]{1,48}$/.test(name) ? `lucide:${name}` : undefined
  }
  if (raw.startsWith('brand:')) {
    const name = raw.slice('brand:'.length)
    return /^[a-z0-9-]{1,64}$/.test(name) ? `brand:${name}` : undefined
  }
  // A user-uploaded image as a data URL (capped; 300 KB file ≈ 400 KB base64).
  if (raw.startsWith('data:image/')) {
    if (raw.length > 460000) return undefined
    return /^data:image\/(?:svg\+xml|png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(raw) ? raw : undefined
  }
  const text = Array.from(raw).slice(0, 4).join('')
  return text === '' ? undefined : text
}

/** One decoration cleaned to the fields the browser understands. */
function cleanDecoration(input) {
  const out = {}
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return out
  if (typeof input.color === 'string' && HEX_COLOR.test(input.color)) out.color = input.color
  const icon = cleanIcon(input.icon)
  if (icon !== undefined) out.icon = icon
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

/** A valid favourite: a catalogue icon value like `lucide:rocket` / `brand:openai`. */
const FAVORITE_PATTERN = /^(?:lucide|brand):[a-z0-9-]{1,64}$/

/** Keep well-formed, de-duplicated favourites. */
function cleanFavorites(input) {
  const out = []
  const seen = new Set()
  if (!Array.isArray(input)) return out
  for (const value of input) {
    if (typeof value === 'string' && FAVORITE_PATTERN.test(value) && !seen.has(value)) {
      seen.add(value)
      out.push(value)
    }
  }
  return out.slice(0, 16)
}

/** The durable decorations store, written atomically under `dataDir`. */
export function createStore(dataDir) {
  const file = typeof dataDir === 'string' && isAbsolute(dataDir) ? join(dataDir, 'decorations.json') : null
  const get = () => {
    if (file === null) return { workspaces: {}, sessions: {}, favorites: null }
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8'))
      const doc = raw === null || typeof raw !== 'object' ? {} : raw
      return {
        workspaces: cleanMap(doc.workspaces),
        sessions: cleanMap(doc.sessions),
        favorites: Array.isArray(doc.favorites) ? cleanFavorites(doc.favorites) : null,
        settings: cleanSettings(doc.settings),
      }
    } catch {
      return { workspaces: {}, sessions: {}, favorites: null, settings: undefined }
    }
  }
  const set = (doc) => {
    if (file === null) return
    try {
      mkdirSync(dirname(file), { recursive: true })
      const payload = { version: 1, workspaces: doc.workspaces || {}, sessions: doc.sessions || {} }
      if (Array.isArray(doc.favorites)) payload.favorites = doc.favorites
      if (doc.settings !== undefined && doc.settings !== null) payload.settings = doc.settings
      const tmp = `${file}.tmp-${process.pid}`
      writeFileSync(tmp, JSON.stringify(payload, null, 2))
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

/** Read a numeric option with a default and bounds. */
function numberSetting(value, fallback, min, max) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

/** Sizes the browser half uses, changeable from the profile config. */
function resolveSettings(config) {
  const c = config === null || config === undefined || typeof config !== 'object' ? {} : config
  return {
    workspaceIconSize: numberSetting(c.workspaceIconSize, 22, 10, 48),
    sessionIconSize: numberSetting(c.sessionIconSize, 14, 8, 40),
    workspaceFontSize: numberSetting(c.workspaceFontSize, 15, 9, 28),
  }
}

/** Bounds for the graphical settings, shared with the client. */
const SETTINGS_BOUNDS = {
  workspaceIconSize: [10, 48],
  sessionIconSize: [8, 40],
  workspaceFontSize: [9, 28],
}

/** Keep only known numeric size settings, clamped to their bounds. */
function cleanSettings(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return undefined
  const out = {}
  for (const [key, range] of Object.entries(SETTINGS_BOUNDS)) {
    const value = Number(input[key])
    if (Number.isFinite(value)) out[key] = Math.min(range[1], Math.max(range[0], Math.round(value)))
  }
  return Object.keys(out).length === 0 ? undefined : out
}

/** Register the durable store and its routes when the web server is composed. */
export function apply(ctx, config = {}) {
  try {
    if (ctx === undefined || ctx === null || typeof ctx.inject !== 'function') return
    const store = createStore(config === null || config === undefined ? undefined : config.dataDir)
    const settings = resolveSettings(config)
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
          const has = (key) => Object.prototype.hasOwnProperty.call(body, key)
          // Only touch a field the request actually carries, so a colour-only
          // update never drops the icon (and vice versa).
          if (has('color')) {
            if (body.color === null || body.color === '') delete current.color
            else if (typeof body.color === 'string' && HEX_COLOR.test(body.color)) current.color = body.color
          }
          if (has('icon')) {
            if (body.icon === null || body.icon === '') delete current.icon
            else {
              const icon = cleanIcon(body.icon)
              if (icon !== undefined) current.icon = icon
              else delete current.icon
            }
          }
          if (current.color === undefined && current.icon === undefined) delete doc[bucket][id]
          else doc[bucket][id] = current
          store.set(doc)
          sendJson(res, 200, { workspaces: doc.workspaces, sessions: doc.sessions, favorites: doc.favorites, settings: doc.settings, storage: store.status })
        }

        route('/decorations', async (req, res) => {
          if (req.method !== 'GET') {
            sendJson(res, 405, { error: 'method not allowed' })
            return
          }
          const doc = store.get()
          sendJson(res, 200, { workspaces: doc.workspaces, sessions: doc.sessions, favorites: doc.favorites, settings: doc.settings, storage: store.status })
        })
        route('/favorites', async (req, res) => {
          if (req.method !== 'POST') {
            sendJson(res, 405, { error: 'method not allowed' })
            return
          }
          const site = String(req.headers?.['sec-fetch-site'] ?? '').toLowerCase()
          if (site && site !== 'same-origin' && site !== 'same-site' && site !== 'none') {
            sendJson(res, 403, { error: 'cross-site write refused' })
            return
          }
          const body = await readJson(req)
          if (!Array.isArray(body.icons)) {
            sendJson(res, 400, { error: 'icons must be an array' })
            return
          }
          const doc = store.get()
          doc.favorites = cleanFavorites(body.icons)
          store.set(doc)
          sendJson(res, 200, { workspaces: doc.workspaces, sessions: doc.sessions, favorites: doc.favorites, settings: doc.settings, storage: store.status })
        })
        route('/settings', async (req, res) => {
          if (req.method !== 'POST') {
            sendJson(res, 405, { error: 'method not allowed' })
            return
          }
          const site = String(req.headers?.['sec-fetch-site'] ?? '').toLowerCase()
          if (site && site !== 'same-origin' && site !== 'same-site' && site !== 'none') {
            sendJson(res, 403, { error: 'cross-site write refused' })
            return
          }
          const body = await readJson(req)
          const patched = cleanSettings(body)
          if (patched === undefined) {
            sendJson(res, 400, { error: 'no valid settings' })
            return
          }
          const doc = store.get()
          doc.settings = { ...(doc.settings || {}), ...patched }
          store.set(doc)
          sendJson(res, 200, { workspaces: doc.workspaces, sessions: doc.sessions, favorites: doc.favorites, settings: doc.settings, storage: store.status })
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
        route('/config', async (req, res) => {
          if (req.method !== 'GET') {
            sendJson(res, 405, { error: 'method not allowed' })
            return
          }
          sendJson(res, 200, { ...settings, ...(store.get().settings || {}) })
        })
        route('/icons', async (req, res) => {
          if (req.method !== 'GET') {
            sendJson(res, 405, { error: 'method not allowed' })
            return
          }
          const body = readIconsBody()
          res.statusCode = 200
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.setHeader('cache-control', 'public, max-age=3600')
          res.end(body)
        })
      } catch {
        // A broken registration must not take the Host boot down.
      }
    })
  } catch {
    // Degrade to no durable store.
  }
}

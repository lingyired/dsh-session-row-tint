/**
 * Browser half of `dsh-session-row-tint`.
 *
 * - Session rows: a full-row tint. Colour comes from this plugin's own
 *   per-Session decoration when set, otherwise from the marks owned by
 *   `@idoall/dsh-session-colors` (`GET /plugins/dsh-session-colors/marks`).
 *   A per-Session custom icon/emoji replaces the left status slot's glyph.
 * - Workspace rows: their whole block (header row plus the session list below
 *   it) is washed with the workspace colour, and the folder icon is replaced by
 *   the chosen emoji/icon.
 * - Entry point: a "颜色 / 图标" item appended to the row's own "..." menu (a body
 *   portal), so it does not fight any other plugin for the right-click gesture.
 * - The picker has a preset colour palette and a searchable icon set. The icon
 *   catalog is served by the Host half (`GET /plugins/dsh-session-row-tint/icons`)
 *   and combines Lucide (MIT) with Simple Icons (CC0) brand logos, so it stays
 *   out of this bundle and can grow without a client rebuild.
 *
 * Everything is drawn on a click-through `shell.overlay` layer so it never
 * intercepts pointer events; the picker is a separate portal.
 *
 * Written as a hand-authored `__ModuleLoader__` bundle so it needs no build.
 */
window.__ModuleLoader__.load({
  id: 'dsh-session-row-tint',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    let React
    try {
      React = require('react')
    } catch (error) {
      try { console.warn('[dsh-session-row-tint] react unavailable:', error) } catch {}
      exports.inject = []
      exports.apply = function apply() {}
      return module.exports
    }
    let createPortal
    try {
      createPortal = require('react-dom').createPortal
    } catch {
      createPortal = undefined
    }

    // DSH primitives (menu item) may or may not be exposed; use it when available.
    let MenuItemButton
    try {
      const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
      MenuItemButton = primitives && primitives.MenuItemButton
    } catch {
      MenuItemButton = undefined
    }

    // One shared decorations store, so the overlay layer and the slot components
    // (session row menu / leading icon) all read the same state.
    const DECOR_STORE = { value: { workspaces: {}, sessions: {}, favorites: null }, listeners: new Set() }
    function decorGet() {
      return DECOR_STORE.value
    }
    function decorSet(next) {
      DECOR_STORE.value = next
      for (const listener of DECOR_STORE.listeners) {
        try { listener() } catch {}
      }
    }
    function decorSubscribe(listener) {
      DECOR_STORE.listeners.add(listener)
      return () => DECOR_STORE.listeners.delete(listener)
    }
    function useDecorations() {
      return React.useSyncExternalStore(decorSubscribe, decorGet, decorGet)
    }
    /** Set by the overlay layer: opens the picker for a kind/id from a slot click. */
    const PICKER_REQUEST = { current: null }
    function requestPicker(kind, id) {
      try {
        if (PICKER_REQUEST.current !== null) PICKER_REQUEST.current(kind, id)
      } catch {}
    }

    const h = React.createElement
    const MARKS_ROUTE = '/plugins/dsh-session-colors/marks'
    const DECORATIONS_ROUTE = '/plugins/dsh-session-row-tint/decorations'
    const WORKSPACES_ROUTE = '/plugins/dsh-session-row-tint/workspaces'
    const SESSIONS_ROUTE = '/plugins/dsh-session-row-tint/sessions'
    const ICONS_ROUTE = '/plugins/dsh-session-row-tint/icons'
    const FAVORITES_ROUTE = '/plugins/dsh-session-row-tint/favorites'
    const FAVORITES_STORAGE_KEY = 'dsh-session-row-tint:favorites'
    const IMAGES_STORAGE_KEY = 'dsh-session-row-tint:images'
    const CONFIG_ROUTE = '/plugins/dsh-session-row-tint/config'
    /** Live sizes from the Host config; overwritten once /config answers. */
    const SETTINGS = { workspaceIconSize: 22, sessionIconSize: 14, workspaceFontSize: 15 }
    const SESSION_ROW_KEY = 'session:'
    const WORKSPACE_ROW_KEY = 'workspace:'
    const LUCIDE_PREFIX = 'lucide:'
    const BRAND_PREFIX = 'brand:'
    const POLL_MS = 1200
    const SETTLE_FRAMES = 40
    const SESSION_TINT_ALPHA = 0.18
    const WORKSPACE_TINT_ALPHA = 0.09
    const STYLE_ID = 'dsh-session-row-tint-style'
    const PANEL_WIDTH = 300
    const PANEL_HEIGHT = 440
    // Icon grid is virtualised: fixed 8-column rows of a known height, so only
    // the visible rows (plus a little overscan) are in the DOM.
    const GRID_COLUMNS = 8
    const GRID_CELL = 30
    const GRID_GAP = 4
    const GRID_ROW = GRID_CELL + GRID_GAP
    const GRID_VIEW = 196
    const GRID_OVERSCAN = 3

    /** Preset colours offered as one-click swatches. */
    const PRESET_COLORS = [
      '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
      '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
      '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#64748b', '#0f172a',
    ]

    /** Icon catalog fetched from the Host: value ("lucide:x" / "brand:y") -> SVG body. */
    const CATALOG = { icons: {}, keywords: {}, popular: [], ready: false }

    /** Shown in the "常用" row until the user customises their favourites. */
    const DEFAULT_FAVORITES = [
      'lucide:star', 'lucide:heart', 'lucide:rocket', 'lucide:folder', 'lucide:file-text', 'lucide:user',
      'lucide:settings', 'lucide:search', 'lucide:bell', 'lucide:flag', 'lucide:bookmark', 'lucide:pin',
      'lucide:lightbulb', 'lucide:target',
    ]

    function clamp(value, min, max) {
      return value < min ? min : value > max ? max : value
    }

    function hsvToRgb(hue, s, v) {
      const h6 = (((hue % 360) + 360) % 360) / 60
      const c = v * s
      const x = c * (1 - Math.abs((h6 % 2) - 1))
      let r = 0
      let g = 0
      let b = 0
      if (h6 < 1) { r = c; g = x; b = 0 }
      else if (h6 < 2) { r = x; g = c; b = 0 }
      else if (h6 < 3) { r = 0; g = c; b = x }
      else if (h6 < 4) { r = 0; g = x; b = c }
      else if (h6 < 5) { r = x; g = 0; b = c }
      else { r = c; g = 0; b = x }
      const m = v - c
      return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
    }

    /** Session HSVA mark as an opaque `rgb()` for text. */
    function rgbOf(color) {
      const [r, g, b] = hsvToRgb(color.h, color.s, color.v)
      return `rgb(${r}, ${g}, ${b})`
    }

    /** `#rrggbb` as `rgba()` with the given alpha. */
    function hexToRgba(hex, alpha) {
      const m = /^#([0-9a-fA-F]{6})$/.exec(typeof hex === 'string' ? hex : '')
      if (m === null) return `rgba(128, 128, 128, ${alpha})`
      const n = Number.parseInt(m[1], 16)
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
    }

    function isColor(value) {
      return value !== null
        && typeof value === 'object'
        && typeof value.h === 'number'
        && typeof value.s === 'number'
        && typeof value.v === 'number'
    }

    /** A stored value is one of our catalogue icons (vs an emoji/text glyph). */
    function isCatalogValue(value) {
      return typeof value === 'string' && CATALOG.icons[value] !== undefined
    }

    /** A value that is meant to be an icon but may not have loaded yet. */
    function looksLikeIcon(value) {
      return typeof value === 'string' && (value.startsWith(LUCIDE_PREFIX) || value.startsWith(BRAND_PREFIX))
    }

    /** Human name of a catalogue icon value (strip the prefix). */
    function iconName(value) {
      const at = value.indexOf(':')
      return at === -1 ? value : value.slice(at + 1)
    }

    /** Local fallback favourites, used until the Host route is available. */
    function readLocalFavorites() {
      try {
        const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY)
        if (raw === null) return null
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : null
      } catch {
        return null
      }
    }

    function writeLocalFavorites(icons) {
      try {
        window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(icons))
      } catch {
        // A blocked localStorage must not break favouriting.
      }
    }

    /** Local image icons (kind -> id -> data URL), a fallback until the Host stores them. */
    function readLocalImages() {
      try {
        const raw = window.localStorage.getItem(IMAGES_STORAGE_KEY)
        if (raw === null) return { workspaces: {}, sessions: {} }
        const parsed = JSON.parse(raw)
        const pick = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {})
        return { workspaces: pick(parsed.workspaces), sessions: pick(parsed.sessions) }
      } catch {
        return { workspaces: {}, sessions: {} }
      }
    }

    function writeLocalImages(images) {
      try {
        window.localStorage.setItem(IMAGES_STORAGE_KEY, JSON.stringify(images))
      } catch {
        // A blocked localStorage must not break image icons.
      }
    }

    /** Overlay locally-stored image icons onto decorations from the Host. */
    function withLocalImages(decor) {
      const images = readLocalImages()
      const next = {
        workspaces: { ...(decor.workspaces || {}) },
        sessions: { ...(decor.sessions || {}) },
        favorites: decor.favorites === undefined ? null : decor.favorites,
      }
      for (const kind of ['workspaces', 'sessions']) {
        const bucket = images[kind] || {}
        for (const id of Object.keys(bucket)) {
          next[kind][id] = { ...(next[kind][id] || {}), icon: bucket[id] }
        }
      }
      return next
    }

    /** Standalone SVG markup for one catalogue icon. */
    function svgMarkup(value, size) {
      const body = CATALOG.icons[value]
      if (body === undefined) return ''
      const px = Math.round(size)
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd">${body}</svg>`
    }

    /** Filter the catalogue by icon name or by a Chinese/English keyword. */
    function searchIcons(query) {
      if (!CATALOG.ready) return []
      const q = String(query || '').trim().toLowerCase()
      if (q === '') {
        // No query: show every icon, popular ones first, then the rest A–Z.
        const seen = new Set()
        const ordered = []
        for (const value of CATALOG.popular) {
          if (CATALOG.icons[value] !== undefined && !seen.has(value)) {
            seen.add(value)
            ordered.push(value)
          }
        }
        const rest = Object.keys(CATALOG.icons)
          .filter((value) => !seen.has(value))
          .sort((a, b) => iconName(a).localeCompare(iconName(b)))
        return ordered.concat(rest)
      }
      const found = new Set()
      for (const term of Object.keys(CATALOG.keywords)) {
        if (q.includes(term.toLowerCase()) || term.toLowerCase().includes(q)) {
          for (const value of CATALOG.keywords[term]) if (CATALOG.icons[value] !== undefined) found.add(value)
        }
      }
      for (const value of Object.keys(CATALOG.icons)) {
        if (iconName(value).toLowerCase().includes(q)) found.add(value)
      }
      return [...found]
    }

    function sessionRows() {
      try {
        return [...document.querySelectorAll('[role="treeitem"][aria-selected]')]
      } catch {
        return []
      }
    }

    function workspaceRows() {
      try {
        return [...document.querySelectorAll('[data-row-key^="workspace:"]')]
      } catch {
        return []
      }
    }

    function idFromKey(node, prefix) {
      try {
        const key = typeof node.getAttribute === 'function' ? node.getAttribute('data-row-key') : undefined
        if (typeof key === 'string' && key.startsWith(prefix)) return key.slice(prefix.length)
      } catch {
        // Unreadable attribute: treat as no id.
      }
      return undefined
    }

    function sessionIdOf(node) { return idFromKey(node, SESSION_ROW_KEY) }
    function workspaceIdOf(node) { return idFromKey(node, WORKSPACE_ROW_KEY) }

    /** True when the row's leading slot currently renders a status glyph. */
    function slotHasStatus(slot) {
      if (slot === null) return false
      if ((slot.textContent || '').trim() !== '') return true
      for (const el of slot.querySelectorAll('*')) {
        if (el.getAttribute('data-slot') === null) return true
      }
      return false
    }

    function scrollContainerOf(node) {
      try {
        let current = node === null || node === undefined ? null : node.parentElement
        for (let depth = 0; current !== null && current !== undefined && depth < 12; depth += 1) {
          const style = getComputedStyle(current)
          if (/auto|scroll|hidden/.test(`${style.overflowY} ${style.overflow}`) && current.clientHeight > 0) return current
          current = current.parentElement
        }
      } catch {
        // Fall back to clipping at the viewport.
      }
      return null
    }

    function clipFor(container) {
      if (container === null || container === undefined) return 'none'
      try {
        const box = container.getBoundingClientRect()
        const top = Math.max(0, box.top)
        const left = Math.max(0, box.left)
        const right = Math.max(0, window.innerWidth - Math.min(window.innerWidth, box.right))
        const bottom = Math.max(0, window.innerHeight - Math.min(window.innerHeight, box.bottom))
        return `inset(${top}px ${right}px ${bottom}px ${left}px)`
      } catch {
        return 'none'
      }
    }

    function layerZIndexOf(row) {
      let level = 0
      try {
        let node = row === null || row === undefined ? null : row.parentElement
        for (let depth = 0; node !== null && node !== undefined && node !== document.documentElement && depth < 40; depth += 1) {
          const style = getComputedStyle(node)
          if (style.position !== 'static') {
            const value = Number.parseInt(style.zIndex, 10)
            if (Number.isFinite(value)) level = value
          }
          node = node.parentElement
        }
      } catch {
        // No readable chain.
      }
      return level + 1
    }

    function requestFrame(run) {
      return typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame(run) : window.setTimeout(run, 16)
    }

    function cancelFrame(id) {
      if (id === undefined) return
      if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(id)
      else window.clearTimeout(id)
    }

    function installStyle() {
      if (document.getElementById(STYLE_ID) !== null) return () => {}
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = [
        '.dsh-srt-layer{position:fixed;inset:0;overflow:hidden;pointer-events:none}',
        '.dsh-srt-row{position:fixed;box-sizing:border-box;pointer-events:none}',
        '.dsh-srt-icon{position:fixed;display:flex;align-items:center;justify-content:center;pointer-events:none;line-height:1;font-size:13px}',
        '.dsh-srt-icon svg{display:block}',
        // Replace the source plugin's 4px bar with the full-row tint.
        '.dsh-sc-chip{display:none!important}',
        '.dsh-srt-menuitem{display:flex;align-items:center;gap:8px;width:100%;padding:6px 10px;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}',
        '.dsh-srt-panel{position:fixed;z-index:2147483001;box-sizing:border-box;width:300px;max-height:calc(100vh - 16px);overflow:auto;padding:14px;border:1px solid rgba(120,120,130,.25);border-radius:16px;background:#f7f7f9;color:#1d1d1f;box-shadow:0 20px 56px rgba(0,0,0,.38),0 0 0 1px rgba(0,0,0,.04);font:400 13px Inter,ui-sans-serif,system-ui,-apple-system,"PingFang SC",sans-serif}',
        '.dsh-srt-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}',
        '.dsh-srt-head b{font-size:14px;font-weight:600}',
        '.dsh-srt-close{width:26px;height:26px;padding:0;border:none;border-radius:8px;background:transparent;color:#666;font-size:16px;line-height:1;cursor:pointer}',
        '.dsh-srt-close:hover{background:rgba(0,0,0,.06)}',
        '.dsh-srt-label{display:block;margin:0 0 8px;color:#6b7280;font-size:12px;font-weight:500}',
        '.dsh-srt-swatches{display:grid;grid-template-columns:repeat(9,1fr);gap:6px;margin-bottom:10px}',
        '.dsh-srt-swatch{position:relative;aspect-ratio:1/1;padding:0;border:1px solid rgba(0,0,0,.12);border-radius:7px;cursor:pointer;transition:transform .08s ease}',
        '.dsh-srt-swatch:hover{transform:scale(1.08)}',
        '.dsh-srt-swatch.is-sel{box-shadow:0 0 0 2px #f7f7f9,0 0 0 4px #2563eb}',
        '.dsh-srt-inline{display:flex;align-items:center;gap:8px;margin-bottom:14px}',
        '.dsh-srt-color{width:42px;height:30px;padding:0;border:1px solid rgba(0,0,0,.18);border-radius:8px;background:none;cursor:pointer;flex:none}',
        '.dsh-srt-mini{height:30px;padding:0 10px;border:1px solid rgba(0,0,0,.15);border-radius:8px;background:#fff;color:#374151;font:inherit;cursor:pointer;flex:none}',
        '.dsh-srt-mini:hover{background:#eef1f6}',
        '.dsh-srt-search{box-sizing:border-box;width:100%;height:32px;margin-bottom:10px;padding:0 10px;border:1px solid rgba(0,0,0,.15);border-radius:9px;background:#fff;color:#1d1d1f;font:inherit}',
        '.dsh-srt-sublabel{display:block;margin:-2px 0 8px;color:#9ca3af;font-size:11px}',
        '.dsh-srt-fav{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;max-height:64px;overflow:hidden}',
        '.dsh-srt-favbtn{width:30px;height:30px;flex:none}',
        '.dsh-srt-favempty{color:#9ca3af;font-size:12px;line-height:30px}',
        '.dsh-srt-icongrid{position:relative;height:196px;overflow:auto;padding:2px;margin-bottom:12px;border-radius:10px;background:rgba(0,0,0,.02)}',
        '.dsh-srt-vrow{position:absolute;left:0;right:0;display:grid;grid-template-columns:repeat(8,1fr);gap:4px}',
        '.dsh-srt-iconbtn{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:30px;padding:0;border:1px solid transparent;border-radius:8px;background:#fff;color:#374151;cursor:pointer}',
        '.dsh-srt-fav .dsh-srt-iconbtn{width:30px;height:30px;flex:none}',
        '.dsh-srt-iconbtn.is-fav::after{content:"";position:absolute;top:3px;right:3px;width:6px;height:6px;border-radius:50%;background:#f59e0b}',
        '.dsh-srt-iconbtn:hover{background:#eef3fb;border-color:rgba(37,99,235,.35)}',
        '.dsh-srt-iconbtn.is-sel{background:#e8f0fe;border-color:#2563eb;color:#1d4ed8}',
        '.dsh-srt-empty{grid-column:1/-1;padding:14px;color:#9ca3af;text-align:center;font-size:12px}',
        '.dsh-srt-foot{display:flex;justify-content:space-between;gap:8px;margin-top:4px}',
        '.dsh-srt-btn{height:32px;padding:0 14px;border:1px solid rgba(0,0,0,.15);border-radius:9px;background:#fff;color:#1d1d1f;font:inherit;cursor:pointer}',
        '.dsh-srt-btn:hover{background:#eef1f6}',
        '.dsh-srt-danger{color:#dc2626;border-color:rgba(220,38,38,.35)}',
        '.dsh-srt-primary{background:#2563eb;border-color:#2563eb;color:#fff}',
        '.dsh-srt-primary:hover{background:#1d4ed8}',
        '.dsh-srt-panel button:focus-visible,.dsh-srt-panel input:focus-visible{outline:2px solid #2563eb;outline-offset:2px}',
      ].join('\n')
      document.head.appendChild(style)
      return () => style.remove()
    }

    async function getJson(url) {
      const response = await fetch(url, { credentials: 'same-origin', headers: { accept: 'application/json' } })
      if (!response.ok) return undefined
      return response.json()
    }

    /** One icon value rendered at `size`: catalogue SVG, uploaded image, or an emoji/text glyph. */
    function iconElement(value, size, color) {
      if (typeof value === 'string' && value.startsWith('data:image/')) {
        return h('img', {
          src: value,
          alt: '',
          style: { width: `${size}px`, height: `${size}px`, objectFit: 'contain', display: 'block' },
        })
      }
      if (isCatalogValue(value)) {
        return h('span', {
          className: 'dsh-srt-svg',
          style: { display: 'inline-flex', color: color || 'currentColor' },
          dangerouslySetInnerHTML: { __html: svgMarkup(value, size) },
        })
      }
      if (looksLikeIcon(value)) return null
      return h('span', { className: 'dsh-srt-glyph', style: { fontSize: `${size}px`, lineHeight: 1 } }, value)
    }

    function RowTintLayer() {
      const decorations = useDecorations()
      const setDecorations = (next) => {
        const prev = decorGet()
        decorSet(typeof next === 'function' ? next(prev) : next)
      }
      const [picker, setPicker] = React.useState(null)
      const [layer, setLayer] = React.useState({ items: [], icons: [], clip: 'none', zIndex: 1 })
      const [catalogReady, setCatalogReady] = React.useState(false)
      const [settingsVersion, setSettingsVersion] = React.useState(0)
      const [gridScroll, setGridScroll] = React.useState(0)
      const gridRef = React.useRef(null)
      const decorationsRef = React.useRef(decorations)
      decorationsRef.current = decorations
      const followRef = React.useRef(() => {})
      const openPickerRef = React.useRef(() => {})
      const panelRef = React.useRef(null)
      const fileRef = React.useRef(null)
      const itemRefs = React.useRef(new Map())
      const iconRefs = React.useRef(new Map())
      const syncRef = React.useRef(() => {})

      // Load the icon catalogue once (retry on failure).
      React.useEffect(() => {
        let cancelled = false
        let timer
        const load = async () => {
          try {
            const response = await fetch(ICONS_ROUTE, { credentials: 'same-origin', headers: { accept: 'application/json' } })
            if (!response.ok) throw new Error(`icons route ${response.status}`)
            const body = await response.json()
            if (cancelled || body === null || typeof body !== 'object') return
            CATALOG.icons = body.icons && typeof body.icons === 'object' ? body.icons : {}
            CATALOG.keywords = body.keywords && typeof body.keywords === 'object' ? body.keywords : {}
            CATALOG.popular = Array.isArray(body.popular) ? body.popular : []
            CATALOG.ready = true
            setCatalogReady(true)
            followRef.current && followRef.current()
          } catch {
            if (!cancelled) timer = setTimeout(load, 3000)
          }
        }
        load()
        return () => {
          cancelled = true
          if (timer !== undefined) clearTimeout(timer)
        }
      }, [])

      // Load size options from the Host config once (retry on failure).
      React.useEffect(() => {
        let cancelled = false
        let timer
        const load = async () => {
          try {
            const response = await fetch(CONFIG_ROUTE, { credentials: 'same-origin', headers: { accept: 'application/json' } })
            if (!response.ok) throw new Error(`config route ${response.status}`)
            const body = await response.json()
            if (cancelled || body === null || typeof body !== 'object') return
            for (const key of Object.keys(SETTINGS)) {
              if (typeof body[key] === 'number' && Number.isFinite(body[key])) SETTINGS[key] = body[key]
            }
            setSettingsVersion((value) => value + 1)
            // Slot components read SETTINGS directly; nudge them to re-render.
            decorSet({ ...decorGet() })
          } catch {
            if (!cancelled) timer = setTimeout(load, 3000)
          }
        }
        load()
        return () => {
          cancelled = true
          if (timer !== undefined) clearTimeout(timer)
        }
      }, [])

      // Measuring + polling.
      React.useEffect(() => {
        let disposed = false
        let frame
        let settle = 0
        let moveTimer
        const marks = { current: {} }
        const hiddenSvgs = new Set()
        const coloredTitles = new Set()
        const sizedWorkspaceTitles = new Set()

        const compute = () => {
          const sessions = sessionRows()
          const workspaces = workspaceRows()
          const anchor = sessions[0] || workspaces[0]
          const container = anchor ? scrollContainerOf(anchor) : null
          const clip = clipFor(container)
          const bounds = container === null ? null : container.getBoundingClientRect()
          const decor = decorationsRef.current || {}
          const wdecor = decor.workspaces || {}
          const sdecor = decor.sessions || {}
          const items = []
          const icons = []
          const seen = new Set()
          const seenTitles = new Set()
          const seenWsTitles = new Set()

          for (let i = 0; i < workspaces.length; i += 1) {
            const row = workspaces[i]
            const wid = workspaceIdOf(row)
            const wsTitle = row.querySelector('span[class*="_projectText"]')
            if (wsTitle !== null) {
              wsTitle.style.fontSize = `${SETTINGS.workspaceFontSize}px`
              sizedWorkspaceTitles.add(wsTitle)
              seenWsTitles.add(wsTitle)
            }
            const decoration = wid === undefined ? undefined : wdecor[wid]
            if (decoration !== undefined && decoration.icon !== undefined) {
              const svg = row.querySelector('span[class*="_folder"] svg') || row.querySelector('svg')
              if (svg !== null) {
                svg.style.visibility = 'hidden'
                hiddenSvgs.add(svg)
                seen.add(svg)
                try {
                  const iconBox = (row.querySelector('span[class*="_folder"]') || svg).getBoundingClientRect()
                  if (iconBox.width > 0 && iconBox.height > 0) {
                    icons.push({ key: `wi:${wid}`, kind: 'workspace', left: iconBox.left, top: iconBox.top, width: iconBox.width, height: iconBox.height, value: decoration.icon, color: decoration.color })
                  }
                } catch {
                  // No icon geometry this frame.
                }
              }
            }
            if (decoration === undefined || decoration.color === undefined) continue
            let box
            try { box = row.getBoundingClientRect() } catch { continue }
            if (box.width === 0) continue
            let bottom = box.bottom
            try {
              if (i + 1 < workspaces.length) bottom = workspaces[i + 1].getBoundingClientRect().top - 2
              else if (bounds !== null) bottom = Math.min(bounds.bottom, window.innerHeight) - 2
            } catch {
              bottom = box.bottom
            }
            if (!(bottom > box.top)) bottom = box.bottom
            // Clip the block to the visible part of the sidebar instead of
            // skipping it: when the workspace header row scrolls out of view its
            // session rows (and their tint) must still keep the colour.
            const top = bounds === null ? box.top : Math.max(box.top, bounds.top)
            const limit = bounds === null ? bottom : Math.min(bottom, bounds.bottom)
            if (!(limit > top)) continue
            items.push({
              key: `w:${wid}`,
              left: box.left + 2,
              top: top + 1,
              width: Math.max(0, box.width - 4),
              height: Math.max(1, limit - top - 1),
              background: hexToRgba(decoration.color, WORKSPACE_TINT_ALPHA),
              accent: hexToRgba(decoration.color, 0.55),
              radius: 10,
            })
          }

          for (const row of sessions) {
            const id = sessionIdOf(row)
            if (id === undefined) continue
            const rowTitle = row.querySelector('span[class*="_title"]')
            if (rowTitle !== null && rowTitle.style.marginLeft !== '') rowTitle.style.marginLeft = ''
            const sdec = sdecor[id]
            let textColor
            if (sdec !== undefined && sdec.color !== undefined) textColor = sdec.color
            else if (isColor(marks.current[id])) textColor = rgbOf(marks.current[id])
            if (textColor !== undefined) {
              const titleEl = row.querySelector('span[class*="_title"]')
              if (titleEl !== null) {
                titleEl.style.color = textColor
                coloredTitles.add(titleEl)
                seenTitles.add(titleEl)
              }
            }
            // Session icons are rendered by the `sidebar.session.row.leading`
            // slot component now (see SessionLeadingIcon), not the overlay.
            void sdec
          }

          for (const svg of Array.from(hiddenSvgs)) {
            if (seen.has(svg)) continue
            try { svg.style.visibility = '' } catch {}
            hiddenSvgs.delete(svg)
          }
          for (const el of Array.from(coloredTitles)) {
            if (seenTitles.has(el)) continue
            try { el.style.color = '' } catch {}
            coloredTitles.delete(el)
          }
          for (const el of Array.from(sizedWorkspaceTitles)) {
            if (seenWsTitles.has(el)) continue
            try { el.style.fontSize = '' } catch {}
            sizedWorkspaceTitles.delete(el)
          }

          if (disposed) return
          setLayer({ items, icons, clip, zIndex: anchor ? layerZIndexOf(anchor) : 1 })
        }

        const step = () => {
          frame = undefined
          compute()
          if (settle > 0) {
            settle -= 1
            frame = requestFrame(step)
          }
        }
        const follow = () => {
          settle = SETTLE_FRAMES
          if (frame === undefined) frame = requestFrame(step)
        }
        followRef.current = follow

        const load = async () => {
          try {
            const [marksBody, decorBody] = await Promise.all([
              getJson(MARKS_ROUTE).catch(() => undefined),
              getJson(DECORATIONS_ROUTE).catch(() => undefined),
            ])
            if (marksBody && marksBody.marks && typeof marksBody.marks === 'object' && !Array.isArray(marksBody.marks)) {
              marks.current = marksBody.marks
            }
            if (decorBody && typeof decorBody === 'object' && !disposed) {
              setDecorations(withLocalImages({
                workspaces: decorBody.workspaces && typeof decorBody.workspaces === 'object' ? decorBody.workspaces : {},
                sessions: decorBody.sessions && typeof decorBody.sessions === 'object' ? decorBody.sessions : {},
                favorites: Array.isArray(decorBody.favorites) ? decorBody.favorites : readLocalFavorites(),
              }))
            }
            follow()
          } catch {
            // Leave the current drawing in place when routes are momentarily down.
          }
        }

        const onMove = () => {
          // Reposition the overlay synchronously during the scroll gesture so
          // the fixed layer keeps up with the scrolling rows (no one-frame lag
          // that reads as jitter). Do not re-render mid-gesture: a React pass
          // with an older measurement would fight this and reintroduce jitter,
          // so only settle once the gesture goes quiet.
          syncRef.current()
          if (moveTimer !== undefined) clearTimeout(moveTimer)
          moveTimer = setTimeout(follow, 140)
        }
        const interval = setInterval(load, POLL_MS)
        document.addEventListener('scroll', onMove, true)
        window.addEventListener('resize', onMove, true)
        window.addEventListener('focus', load)
        document.addEventListener('visibilitychange', load)
        let observer
        try {
          observer = new MutationObserver(onMove)
          observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-row-key', 'aria-selected', 'style', 'hidden'] })
        } catch {
          observer = undefined
        }

        load()
        follow()

        return () => {
          disposed = true
          clearInterval(interval)
          document.removeEventListener('scroll', onMove, true)
          window.removeEventListener('resize', onMove, true)
          window.removeEventListener('focus', load)
          document.removeEventListener('visibilitychange', load)
          if (observer) observer.disconnect()
          if (moveTimer !== undefined) clearTimeout(moveTimer)
          cancelFrame(frame)
          for (const svg of hiddenSvgs) {
            try { svg.style.visibility = '' } catch {}
          }
          hiddenSvgs.clear()
          for (const el of coloredTitles) {
            try { el.style.color = '' } catch {}
          }
          coloredTitles.clear()
          for (const el of sizedWorkspaceTitles) {
            try { el.style.fontSize = '' } catch {}
          }
          sizedWorkspaceTitles.clear()
          followRef.current = () => {}
        }
      }, [])

      // Add a "颜色 / 图标" item to a row's own "..." menu while it is open.
      React.useEffect(() => {
        const decorateMenus = () => {
          try {
            // Session row menus get their item from the official
            // `sidebar.workspaces.session.menu.item` slot; only workspace row
            // menus (no slot for them) are augmented here.
            const openRows = [...document.querySelectorAll('[class*="menuOpen"][data-row-key]')]
            const row = openRows.find((candidate) => workspaceIdOf(candidate) !== undefined)
            if (row === undefined) return
            const items = [...document.querySelectorAll('[role="menuitem"]')].filter((el) => {
              const rect = el.getBoundingClientRect()
              return rect.width > 0 && rect.height > 0
            })
            if (items.length === 0) return
            const sample = items[0]
            const wrapper = sample.parentElement
            const container = wrapper === null || wrapper === undefined ? null : wrapper.parentElement
            if (container === null || container === undefined) return
            if (container.querySelector('[data-dsh-srt-item]') !== null) return
            const wid = workspaceIdOf(row)
            if (wid === undefined) return
            const id = wid
            const kind = 'workspace'
            // Clone the sample item so the row matches DSH's menu styling, then
            // swap its icon for a palette and its label for ours.
            const clone = sample.cloneNode(true)
            clone.setAttribute('data-dsh-srt-item', '')
            clone.setAttribute('data-srt-kind', kind)
            clone.setAttribute('data-srt-id', id)
            const svg = clone.querySelector('svg')
            const paletteBody = CATALOG.icons[LUCIDE_PREFIX + 'palette']
            if (svg !== null && paletteBody !== undefined) {
              svg.setAttribute('viewBox', '0 0 24 24')
              svg.innerHTML = paletteBody
            }
            const leaves = [...clone.querySelectorAll('*')].filter((el) => el.children.length === 0 && el.textContent.trim() !== '')
            if (leaves[0] !== undefined) leaves[0].textContent = '颜色 / 图标'
            for (const leaf of leaves.slice(1)) { if (/[⌥⌘⇧⌃]/.test(leaf.textContent)) leaf.remove() }
            const box = document.createElement(wrapper.tagName)
            box.className = wrapper.className
            box.appendChild(clone)
            container.appendChild(box)
          } catch {
            // Menu decoration is best effort; never break the menu.
          }
        }
        // Capture-phase press handling, registered before DSH's menu listeners.
        const onPress = (event) => {
          const target = event.target
          if (target === null || target === undefined || typeof target.closest !== 'function') return
          const ours = target.closest('[data-dsh-srt-item]')
          if (ours === null) return
          const kind = ours.getAttribute('data-srt-kind')
          const id = ours.getAttribute('data-srt-id')
          if (kind === null || id === null) return
          event.preventDefault()
          event.stopPropagation()
          const prefix = kind === 'workspace' ? WORKSPACE_ROW_KEY : SESSION_ROW_KEY
          const row = document.querySelector(`[data-row-key="${prefix}${id}"]`)
          openPickerRef.current(row || document.body, kind, id)
          try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) } catch {}
        }
        document.addEventListener('pointerdown', onPress, true)
        const observer = new MutationObserver(decorateMenus)
        observer.observe(document.body, { childList: true, subtree: true })
        decorateMenus()
        return () => {
          observer.disconnect()
          document.removeEventListener('pointerdown', onPress, true)
        }
      }, [])

      // Open the picker anchored to a row.
      openPickerRef.current = (row, kind, id) => {
        const bucket = kind === 'workspace' ? (decorationsRef.current.workspaces || {}) : (decorationsRef.current.sessions || {})
        const current = bucket[id] || {}
        let rect = { right: window.innerWidth / 2, top: 120 }
        try { rect = row.getBoundingClientRect() } catch {}
        setPicker({
          kind,
          id,
          x: clamp(Math.round(rect.right) + 8, 8, window.innerWidth - PANEL_WIDTH - 12),
          y: clamp(Math.round(rect.top), 8, window.innerHeight - PANEL_HEIGHT),
          color: current.color || '#3b82f6',
          icon: current.icon || '',
          query: '',
          text: '',
          uploadError: '',
        })
      }
      PICKER_REQUEST.current = (kind, id) => {
        const prefix = kind === 'workspace' ? WORKSPACE_ROW_KEY : SESSION_ROW_KEY
        const target = document.querySelector(`[data-row-key="${prefix}${id}"]`)
        openPickerRef.current(target || document.body, kind, id)
      }

      // Close on outside click or Escape.
      React.useEffect(() => {
        if (picker === null) return undefined
        const onDown = (event) => {
          const target = event.target
          if (target !== null && target !== undefined && typeof target.closest === 'function' && target.closest('.dsh-srt-panel') !== null) return
          setPicker(null)
        }
        const onKey = (event) => { if (event.key === 'Escape') setPicker(null) }
        document.addEventListener('pointerdown', onDown, true)
        document.addEventListener('keydown', onKey, true)
        return () => {
          document.removeEventListener('pointerdown', onDown, true)
          document.removeEventListener('keydown', onKey, true)
        }
      }, [picker])

      // Keep the whole panel inside the viewport: after it mounts, measure its
      // real height and, if it would overflow the bottom (e.g. opened from a row
      // near the bottom), slide it up so its bottom edge stays on screen.
      React.useLayoutEffect(() => {
        const el = panelRef.current
        if (picker === null || el === null) return
        const margin = 8
        const rect = el.getBoundingClientRect()
        const maxX = Math.max(margin, window.innerWidth - rect.width - margin)
        const maxY = Math.max(margin, window.innerHeight - rect.height - margin)
        const nx = Math.min(Math.max(margin, picker.x), maxX)
        const ny = Math.min(Math.max(margin, picker.y), maxY)
        if (nx !== picker.x || ny !== picker.y) {
          setPicker((prev) => (prev === null ? prev : { ...prev, x: nx, y: ny }))
        }
      }, [picker])

      React.useEffect(() => { followRef.current() }, [decorations, catalogReady, settingsVersion])

      // Reset the icon grid scroll to the top when the target or query changes.
      const gridResetKey = picker === null ? '' : `${picker.kind}:${picker.id}:${picker.query}`
      React.useEffect(() => {
        if (gridRef.current !== null) gridRef.current.scrollTop = 0
        setGridScroll(0)
      }, [gridResetKey])

      const save = async (kind, id, patch) => {
        const route = kind === 'workspace' ? WORKSPACES_ROUTE : SESSIONS_ROUTE
        const body = kind === 'workspace' ? { workspaceId: id, ...patch } : { sessionId: id, ...patch }
        try {
          const response = await fetch(route, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify(body),
          })
          if (!response.ok) return false
          const payload = await response.json()
          if (payload && typeof payload === 'object') {
            setDecorations((prev) => {
              const workspaces = payload.workspaces && typeof payload.workspaces === 'object' ? { ...payload.workspaces } : {}
              const sessions = payload.sessions && typeof payload.sessions === 'object' ? { ...payload.sessions } : {}
              const bucketName = kind === 'workspace' ? 'workspaces' : 'sessions'
              const bucket = bucketName === 'workspaces' ? workspaces : sessions
              const before = prev[bucketName] && prev[bucketName][id]
              // Older Hosts delete a field that the request omits; keep it here.
              if (before && typeof before === 'object') {
                if (!Object.prototype.hasOwnProperty.call(patch, 'icon') && before.icon !== undefined) {
                  bucket[id] = { ...(bucket[id] || {}), icon: before.icon }
                }
                if (!Object.prototype.hasOwnProperty.call(patch, 'color') && before.color !== undefined) {
                  bucket[id] = { ...(bucket[id] || {}), color: before.color }
                }
              }
              return withLocalImages({
                workspaces,
                sessions,
                // Keep the current favourites when the Host response has no
                // favourites field (e.g. an older Host), so applying a decoration
                // never makes the 常用 row jump back to the defaults.
                favorites: Array.isArray(payload.favorites) ? payload.favorites : prev.favorites,
              })
            })
          }
          return true
        } catch {
          return false
        }
      }

      const effectiveFavorites = Array.isArray(decorations.favorites) ? decorations.favorites : DEFAULT_FAVORITES
      const saveFavorites = async (icons) => {
        // Optimistic + local fallback: works even before the Host half that
        // owns /favorites has been (re)started; the Host overwrites it later.
        writeLocalFavorites(icons)
        setDecorations((prev) => ({ workspaces: prev.workspaces, sessions: prev.sessions, favorites: icons }))
        try {
          const response = await fetch(FAVORITES_ROUTE, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ icons }),
          })
          if (!response.ok) return false
          const payload = await response.json()
          if (payload && typeof payload === 'object') {
            const favorites = Array.isArray(payload.favorites) ? payload.favorites : icons
            writeLocalFavorites(favorites)
            setDecorations({
              workspaces: payload.workspaces && typeof payload.workspaces === 'object' ? payload.workspaces : {},
              sessions: payload.sessions && typeof payload.sessions === 'object' ? payload.sessions : {},
              favorites,
            })
          }
          return true
        } catch {
          return false
        }
      }
      const toggleFavorite = (value) => {
        const set = new Set(Array.isArray(decorations.favorites) ? decorations.favorites : DEFAULT_FAVORITES)
        if (set.has(value)) set.delete(value)
        else set.add(value)
        const next = [...set]
        // The 常用 row is at most two rows of 8; keep the newest 16.
        if (next.length > 16) next.splice(0, next.length - 16)
        saveFavorites(next)
      }

      const applyColor = (hex) => {
        if (picker === null) return
        setPicker({ ...picker, color: hex })
        save(picker.kind, picker.id, { color: hex === '' ? null : hex })
      }
      const applyIcon = (value) => {
        if (picker === null) return
        setPicker({ ...picker, icon: value })
        const kindBucket = picker.kind === 'workspace' ? 'workspaces' : 'sessions'
        const images = readLocalImages()
        if (typeof value === 'string' && value.startsWith('data:image/')) {
          images[kindBucket][picker.id] = value
          writeLocalImages(images)
          setDecorations((prev) => {
            const bucket = { ...(prev[kindBucket] || {}) }
            bucket[picker.id] = { ...(bucket[picker.id] || {}), icon: value }
            return { ...prev, [kindBucket]: bucket }
          })
        } else if (images[kindBucket][picker.id] !== undefined) {
          delete images[kindBucket][picker.id]
          writeLocalImages(images)
        }
        save(picker.kind, picker.id, { icon: value })
      }
      const handleFile = (event) => {
        const file = event.target.files && event.target.files[0]
        try { event.target.value = '' } catch {}
        if (!file) return
        const typeOk = /^image\/(?:svg\+xml|png|jpeg|webp)$/.test(file.type)
        const nameOk = /\.(?:svg|png|jpe?g|webp)$/i.test(file.name)
        if (!typeOk && !nameOk) {
          setPicker((prev) => (prev === null ? prev : { ...prev, uploadError: '仅支持 SVG / PNG / JPG / WebP' }))
          return
        }
        if (file.size > 300 * 1024) {
          setPicker((prev) => (prev === null ? prev : { ...prev, uploadError: '图片需小于 300KB' }))
          return
        }
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            applyIcon(reader.result)
            setPicker((prev) => (prev === null ? prev : { ...prev, uploadError: '' }))
          }
        }
        reader.onerror = () => setPicker((prev) => (prev === null ? prev : { ...prev, uploadError: '读取图片失败' }))
        reader.readAsDataURL(file)
      }
      const clearAll = () => {
        if (picker === null) return
        const kindBucket = picker.kind === 'workspace' ? 'workspaces' : 'sessions'
        const images = readLocalImages()
        if (images[kindBucket][picker.id] !== undefined) {
          delete images[kindBucket][picker.id]
          writeLocalImages(images)
        }
        setPicker({ ...picker, color: '', icon: '' })
        save(picker.kind, picker.id, { color: null, icon: null })
      }

      // Direct DOM position sync, driven from the scroll handler.
      syncRef.current = () => {
        const workspaces = workspaceRows()
        const container = workspaces.length > 0 ? scrollContainerOf(workspaces[0]) : null
        const containerBox = container === null ? null : container.getBoundingClientRect()
        const boundsTop = containerBox === null ? 0 : containerBox.top
        const boundsBottom = containerBox === null ? window.innerHeight : Math.min(containerBox.bottom, window.innerHeight)
        for (const [key, node] of itemRefs.current) {
          if (!key.startsWith('w:')) continue
          const row = document.querySelector(`[data-row-key="${WORKSPACE_ROW_KEY}${key.slice(2)}"]`)
          if (row === null) continue
          const box = row.getBoundingClientRect()
          let bottom = box.bottom
          const index = workspaces.indexOf(row)
          if (index >= 0 && index + 1 < workspaces.length) bottom = workspaces[index + 1].getBoundingClientRect().top - 2
          else bottom = boundsBottom - 2
          if (!(bottom > box.top)) bottom = box.bottom
          const top = Math.max(box.top, boundsTop)
          const limit = Math.min(bottom, boundsBottom)
          node.style.left = `${box.left + 2}px`
          node.style.top = `${top + 1}px`
          node.style.width = `${Math.max(0, box.width - 4)}px`
          node.style.height = `${Math.max(0, limit - top - 1)}px`
        }
        for (const [key, node] of iconRefs.current) {
          const kind = key.startsWith('wi:') ? 'workspace' : 'session'
          const id = key.slice(3)
          const prefix = kind === 'workspace' ? WORKSPACE_ROW_KEY : SESSION_ROW_KEY
          const row = document.querySelector(`[data-row-key="${prefix}${id}"]`)
          if (row === null) continue
          let box = null
          if (kind === 'workspace') {
            const folder = row.querySelector('span[class*="_folder"]')
            if (folder !== null) box = folder.getBoundingClientRect()
          } else {
            const slot = row.querySelector('span[class*="_slot"]')
            if (slot !== null) box = slot.getBoundingClientRect()
          }
          if (box === null || box.height === 0) continue
          const size = kind === 'workspace' ? SETTINGS.workspaceIconSize : SETTINGS.sessionIconSize
          node.style.left = `${box.left + (box.width - size) / 2}px`
          node.style.top = `${box.top + (box.height - size) / 2}px`
        }
      }

      const rows = layer.items.map((item) => h('div', {
        key: item.key,
        ref: (node) => {
          if (node === null) itemRefs.current.delete(item.key)
          else itemRefs.current.set(item.key, node)
        },
        className: 'dsh-srt-row',
        style: {
          left: `${item.left}px`,
          top: `${item.top}px`,
          width: `${item.width}px`,
          height: `${item.height}px`,
          background: item.background,
          borderRadius: `${item.radius}px`,
          boxShadow: `inset 3px 0 0 0 ${item.accent}`,
        },
      }))
      const iconEls = layer.icons.map((icon) => {
        const size = icon.kind === 'workspace' ? SETTINGS.workspaceIconSize : SETTINGS.sessionIconSize
        const node = iconElement(icon.value, size, icon.color)
        if (node === null) return null
        const left = icon.left + (icon.width - size) / 2
        const top = icon.top + (icon.height - size) / 2
        return h('span', {
          key: icon.key,
          ref: (node) => {
            if (node === null) iconRefs.current.delete(icon.key)
            else iconRefs.current.set(icon.key, node)
          },
          className: 'dsh-srt-icon',
          style: { left: `${left}px`, top: `${top}px`, width: `${size}px`, height: `${size}px` },
        }, node)
      })

      const layerNode = h('div', {
        className: 'dsh-srt-layer',
        'data-dsh-srt-count': String(layer.items.length),
        style: { zIndex: layer.zIndex, clipPath: layer.clip },
      }, [...rows, ...iconEls])

      const iconResults = picker === null ? [] : searchIcons(picker.query)
      const favoriteSet = new Set(effectiveFavorites)
      const totalRows = Math.ceil(iconResults.length / GRID_COLUMNS)
      const scrollTop = Math.min(gridScroll, Math.max(0, (totalRows - 1) * GRID_ROW))
      const startRow = Math.max(0, Math.min(totalRows, Math.floor(scrollTop / GRID_ROW) - GRID_OVERSCAN))
      const endRow = Math.max(startRow, Math.min(totalRows, Math.ceil((scrollTop + GRID_VIEW) / GRID_ROW) + GRID_OVERSCAN))
      const panel = picker === null ? null : h('div', {
        className: 'dsh-srt-panel',
        ref: panelRef,
        role: 'dialog',
        'aria-label': picker.kind === 'workspace' ? '工作区颜色 / 图标' : '会话颜色 / 图标',
        style: { left: `${picker.x}px`, top: `${picker.y}px` },
        onPointerDown: (event) => event.stopPropagation(),
        onContextMenu: (event) => event.preventDefault(),
      },
        h('div', { className: 'dsh-srt-head' },
          h('b', null, picker.kind === 'workspace' ? '工作区颜色 / 图标' : '会话颜色 / 图标'),
          h('button', { className: 'dsh-srt-close', type: 'button', 'aria-label': '关闭', onClick: () => setPicker(null) }, '×'),
        ),
        h('span', { className: 'dsh-srt-label' }, '颜色'),
        h('div', { className: 'dsh-srt-swatches' },
          PRESET_COLORS.map((hex) => h('button', {
            key: hex,
            type: 'button',
            className: `dsh-srt-swatch${(picker.color || '').toLowerCase() === hex.toLowerCase() ? ' is-sel' : ''}`,
            'aria-label': `使用颜色 ${hex}`,
            title: hex,
            style: { background: hex },
            onClick: () => applyColor(hex),
          })),
        ),
        h('div', { className: 'dsh-srt-inline' },
          h('input', {
            className: 'dsh-srt-color', type: 'color', value: picker.color || '#3b82f6',
            'aria-label': '自定义颜色',
            onChange: (event) => setPicker({ ...picker, color: event.target.value }),
            onBlur: (event) => applyColor(event.target.value),
          }),
          h('button', { className: 'dsh-srt-mini', type: 'button', onClick: () => applyColor('') }, '清除颜色'),
        ),
        h('span', { className: 'dsh-srt-label' }, '图标'),
        h('span', { className: 'dsh-srt-sublabel' }, '右键图标可收藏，再次右键取消'),
        h('div', { className: 'dsh-srt-fav' },
          effectiveFavorites.length === 0
            ? h('span', { className: 'dsh-srt-favempty' }, '右键下方图标可收藏到常用')
            : effectiveFavorites.map((value) => h('button', {
              key: `fav:${value}`,
              type: 'button',
              className: `dsh-srt-iconbtn dsh-srt-favbtn${picker.icon === value ? ' is-sel' : ''}`,
              title: `${iconName(value)}（右键取消收藏）`,
              'aria-label': `使用常用图标 ${iconName(value)}`,
              onClick: () => applyIcon(value),
              onContextMenu: (event) => { event.preventDefault(); event.stopPropagation(); toggleFavorite(value) },
              dangerouslySetInnerHTML: { __html: svgMarkup(value, 18) },
            })),
        ),
        h('div', { className: 'dsh-srt-inline', style: { marginBottom: '8px' } },
          h('button', {
            className: 'dsh-srt-mini', type: 'button',
            onClick: () => { if (fileRef.current !== null) fileRef.current.click() },
          }, '选择图片…'),
          typeof picker.icon === 'string' && picker.icon.startsWith('data:image/')
            ? h('img', {
              src: picker.icon,
              alt: '',
              style: { width: '24px', height: '24px', objectFit: 'contain', borderRadius: '4px', background: '#fff', border: '1px solid rgba(0,0,0,.1)' },
            })
            : null,
          h('input', {
            ref: fileRef, type: 'file', accept: '.svg,.png,.jpg,.jpeg,.webp',
            style: { display: 'none' }, onChange: handleFile,
          }),
        ),
        picker.uploadError
          ? h('div', { className: 'dsh-srt-favempty', style: { color: '#dc2626', marginBottom: '8px' } }, picker.uploadError)
          : null,
        h('input', {
          className: 'dsh-srt-search', type: 'search', placeholder: '搜索图标（如 rocket / 用户 / 微信 / openai）',
          value: picker.query,
          onChange: (event) => setPicker({ ...picker, query: event.target.value }),
        }),
        h('div', {
          className: 'dsh-srt-icongrid',
          ref: gridRef,
          onScroll: (event) => setGridScroll(event.currentTarget.scrollTop),
        },
          !CATALOG.ready
            ? h('div', { className: 'dsh-srt-empty' }, '图标加载中…')
            : iconResults.length === 0
              ? h('div', { className: 'dsh-srt-empty' }, '没有匹配的图标')
              : h('div', { style: { position: 'relative', height: `${totalRows * GRID_ROW}px` } },
                Array.from({ length: Math.max(0, endRow - startRow) }, (_, offset) => {
                  const row = startRow + offset
                  const buttons = []
                  for (let col = 0; col < GRID_COLUMNS; col += 1) {
                    const index = row * GRID_COLUMNS + col
                    if (index >= iconResults.length) break
                    const value = iconResults[index]
                    buttons.push(h('button', {
                      key: value,
                      type: 'button',
                      className: `dsh-srt-iconbtn${picker.icon === value ? ' is-sel' : ''}${favoriteSet.has(value) ? ' is-fav' : ''}`,
                      title: `${iconName(value)}（右键收藏 / 取消）`,
                      'aria-label': `使用图标 ${iconName(value)}`,
                      onClick: () => applyIcon(value),
                      onContextMenu: (event) => { event.preventDefault(); event.stopPropagation(); toggleFavorite(value) },
                      dangerouslySetInnerHTML: { __html: svgMarkup(value, 18) },
                    }))
                  }
                  return h('div', { key: row, className: 'dsh-srt-vrow', style: { top: `${row * GRID_ROW}px` } }, buttons)
                }),
              ),
        ),
        h('div', { className: 'dsh-srt-inline', style: { marginBottom: '12px' } },
          h('input', {
            className: 'dsh-srt-search', type: 'text', maxLength: 8, placeholder: '或输入 emoji / 文字',
            style: { marginBottom: 0 },
            value: picker.text,
            onChange: (event) => setPicker({ ...picker, text: event.target.value }),
            onKeyDown: (event) => { if (event.key === 'Enter') { const t = (picker.text || '').trim(); if (t !== '') applyIcon(t) } },
          }),
          h('button', {
            className: 'dsh-srt-mini', type: 'button',
            onClick: () => { const t = (picker.text || '').trim(); if (t !== '') applyIcon(t) },
          }, '应用'),
        ),
        h('div', { className: 'dsh-srt-foot' },
          h('button', { className: 'dsh-srt-btn dsh-srt-danger', type: 'button', onClick: clearAll }, '清除全部'),
          h('button', { className: 'dsh-srt-btn dsh-srt-primary', type: 'button', onClick: () => setPicker(null) }, '完成'),
        ),
      )

      const portal = (node) => (typeof createPortal === 'function' && document.body !== undefined && document.body !== null ? createPortal(node, document.body) : node)
      return h(React.Fragment, null, portal(layerNode), panel === null ? null : portal(panel))
    }

    /** Official slot: a "颜色 / 图标" item in a Session row's own "..." menu. */
    function SessionMenuItem(props) {
      const sessionId = props === null || props === undefined ? undefined : props.sessionId
      if (typeof sessionId !== 'string' || sessionId === '') return null
      const palette = svgMarkup(LUCIDE_PREFIX + 'palette', 16)
      const icon = h('span', { style: { display: 'inline-flex', color: 'currentColor' }, dangerouslySetInnerHTML: { __html: palette } })
      const onSelect = () => requestPicker('session', sessionId)
      if (typeof MenuItemButton === 'function') {
        return h(MenuItemButton, { icon, onSelect }, '颜色 / 图标')
      }
      return h('button', { type: 'button', className: 'dsh-srt-menuitem', onClick: onSelect }, '颜色 / 图标')
    }

    /**
     * Official slot: the custom icon in a Session row's leading area. DSH renders
     * the running spinner itself; when that (or a status text) is present we hide
     * our icon so the status wins — otherwise the custom icon shows.
     */
    function SessionLeadingIcon(props) {
      const sessionId = props === null || props === undefined ? undefined : props.sessionId
      const decorations = useDecorations()
      const sdec = typeof sessionId === 'string' ? ((decorations.sessions || {})[sessionId]) : undefined
      const hasIcon = sdec !== undefined && sdec.icon !== undefined
      const ref = React.useRef(null)
      const [blocked, setBlocked] = React.useState(false)
      React.useLayoutEffect(() => {
        const node = ref.current
        if (node === null) return undefined
        let slot = node.parentElement
        while (slot !== null && slot !== undefined && !(typeof slot.className === 'string' && slot.className.includes('_slot'))) slot = slot.parentElement
        if (slot === null || slot === undefined) return undefined
        const check = () => {
          const spinner = slot.querySelector('svg[data-state]') !== null
          const running = /running|加载/i.test((slot.textContent || '').trim())
          setBlocked(spinner || running)
        }
        check()
        let observer
        try {
          observer = new MutationObserver(check)
          observer.observe(slot, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state', 'class'] })
        } catch {
          observer = undefined
        }
        return () => { if (observer) observer.disconnect() }
      }, [sessionId, hasIcon])
      if (!hasIcon) return h('span', { ref, style: { display: 'none' } })
      const size = SETTINGS.sessionIconSize
      const content = blocked ? null : iconElement(sdec.icon, size, sdec.color)
      return h('span', {
        ref,
        className: 'dsh-srt-leading-icon',
        style: blocked
          ? { display: 'none' }
          : { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: `${size}px`, height: `${size}px`, flex: 'none', marginRight: '4px' },
      }, content)
    }

    /** Required service: the `shell.overlay` slot. */
    exports.inject = ['slots']

    /**
     * Register the tint layer into `shell.overlay`. A build without that slot
     * simply gets no tint instead of failing the plugin.
     * @param ctx - client root context.
     */
    exports.apply = function apply(ctx) {
      try {
        ctx.effect(installStyle, 'dsh-session-row-tint: stylesheet')
      } catch (error) {
        try { console.warn('[dsh-session-row-tint] stylesheet install failed:', error) } catch {}
      }
      try {
        ctx.slots.inject('shell.overlay', () => ctx.slots.register(
          { name: 'shell.overlay', id: 'dsh-session-row-tint', order: 50, label: 'Session row tint' },
          () => h(RowTintLayer),
        ))
      } catch {
        // No shell.overlay in this build; nothing to draw on.
      }
      try {
        ctx.slots.inject('sidebar.workspaces.session.menu.item', () => ctx.slots.register(
          { name: 'sidebar.workspaces.session.menu.item', id: 'dsh-session-row-tint-menu', order: 50, label: '颜色 / 图标' },
          (props) => h(SessionMenuItem, props || {}),
        ))
      } catch {
        // No session menu slot in this build; nothing to add.
      }
      try {
        ctx.slots.inject('sidebar.session.row.leading', () => ctx.slots.register(
          { name: 'sidebar.session.row.leading', id: 'dsh-session-row-tint-leading', order: 40 },
          (props) => h(SessionLeadingIcon, props || {}),
        ))
      } catch {
        // No leading slot in this build; nothing to add.
      }
    }

    return module.exports
  },
})

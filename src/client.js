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

    const h = React.createElement
    const MARKS_ROUTE = '/plugins/dsh-session-colors/marks'
    const DECORATIONS_ROUTE = '/plugins/dsh-session-row-tint/decorations'
    const WORKSPACES_ROUTE = '/plugins/dsh-session-row-tint/workspaces'
    const SESSIONS_ROUTE = '/plugins/dsh-session-row-tint/sessions'
    const ICONS_ROUTE = '/plugins/dsh-session-row-tint/icons'
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

    /** Preset colours offered as one-click swatches. */
    const PRESET_COLORS = [
      '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
      '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
      '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#64748b', '#0f172a',
    ]

    /** Icon catalog fetched from the Host: value ("lucide:x" / "brand:y") -> SVG body. */
    const CATALOG = { icons: {}, keywords: {}, popular: [], ready: false }

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

    /** Standalone SVG markup for one catalogue icon. */
    function svgMarkup(value, size) {
      const body = CATALOG.icons[value]
      if (body === undefined) return ''
      const px = Math.round(size)
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24" fill="none">${body}</svg>`
    }

    /** Filter the catalogue by icon name or by a Chinese/English keyword. */
    function searchIcons(query) {
      if (!CATALOG.ready) return []
      const q = String(query || '').trim().toLowerCase()
      if (q === '') return CATALOG.popular.slice(0, 64)
      const found = new Set()
      for (const term of Object.keys(CATALOG.keywords)) {
        if (q.includes(term.toLowerCase()) || term.toLowerCase().includes(q)) {
          for (const value of CATALOG.keywords[term]) if (CATALOG.icons[value] !== undefined) found.add(value)
        }
      }
      for (const value of Object.keys(CATALOG.icons)) {
        if (iconName(value).toLowerCase().includes(q)) found.add(value)
      }
      return [...found].slice(0, 96)
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
        '.dsh-srt-icongrid{display:grid;grid-template-columns:repeat(8,1fr);gap:4px;max-height:196px;overflow:auto;padding:2px;margin-bottom:12px;border-radius:10px;background:rgba(0,0,0,.02)}',
        '.dsh-srt-iconbtn{display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:1/1;padding:0;border:1px solid transparent;border-radius:8px;background:#fff;color:#374151;cursor:pointer}',
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

    /** One icon value rendered at `size`: catalogue SVG, or an emoji/text glyph. */
    function iconElement(value, size, color) {
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
      const [decorations, setDecorations] = React.useState({ workspaces: {}, sessions: {} })
      const [picker, setPicker] = React.useState(null)
      const [layer, setLayer] = React.useState({ items: [], icons: [], clip: 'none', zIndex: 1 })
      const [catalogReady, setCatalogReady] = React.useState(false)
      const decorationsRef = React.useRef(decorations)
      decorationsRef.current = decorations
      const followRef = React.useRef(() => {})
      const openPickerRef = React.useRef(() => {})

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

      // Measuring + polling.
      React.useEffect(() => {
        let disposed = false
        let frame
        let settle = 0
        const marks = { current: {} }
        const hiddenSvgs = new Set()
        const coloredTitles = new Set()

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

          for (let i = 0; i < workspaces.length; i += 1) {
            const row = workspaces[i]
            const wid = workspaceIdOf(row)
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
                    icons.push({ key: `wi:${wid}`, left: iconBox.left, top: iconBox.top, width: iconBox.width, height: iconBox.height, value: decoration.icon, color: decoration.color })
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
            if (bounds !== null && (box.bottom <= bounds.top || box.top >= bounds.bottom)) continue
            items.push({
              key: `w:${wid}`,
              left: box.left + 2,
              top: box.top + 1,
              width: Math.max(0, box.width - 4),
              height: Math.max(20, bottom - box.top - 1),
              background: hexToRgba(decoration.color, WORKSPACE_TINT_ALPHA),
              accent: hexToRgba(decoration.color, 0.55),
              radius: 10,
            })
          }

          for (const row of sessions) {
            const id = sessionIdOf(row)
            if (id === undefined) continue
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
            if (sdec !== undefined && sdec.icon !== undefined) {
              const slot = row.querySelector('span[class*="_slot"]')
              if (slot !== null) {
                const svg = slot.querySelector('svg')
                if (svg !== null) {
                  svg.style.visibility = 'hidden'
                  hiddenSvgs.add(svg)
                  seen.add(svg)
                }
                try {
                  const iconBox = slot.getBoundingClientRect()
                  if (iconBox.width > 0 && iconBox.height > 0) {
                    icons.push({ key: `si:${id}`, left: iconBox.left, top: iconBox.top, width: iconBox.width, height: iconBox.height, value: sdec.icon, color: sdec.color })
                  }
                } catch {
                  // No icon geometry this frame.
                }
              }
            }
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
              setDecorations({
                workspaces: decorBody.workspaces && typeof decorBody.workspaces === 'object' ? decorBody.workspaces : {},
                sessions: decorBody.sessions && typeof decorBody.sessions === 'object' ? decorBody.sessions : {},
              })
            }
            follow()
          } catch {
            // Leave the current drawing in place when routes are momentarily down.
          }
        }

        const onMove = () => follow()
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
          cancelFrame(frame)
          for (const svg of hiddenSvgs) {
            try { svg.style.visibility = '' } catch {}
          }
          hiddenSvgs.clear()
          for (const el of coloredTitles) {
            try { el.style.color = '' } catch {}
          }
          coloredTitles.clear()
          followRef.current = () => {}
        }
      }, [])

      // Add a "颜色 / 图标" item to a row's own "..." menu while it is open.
      React.useEffect(() => {
        const decorateMenus = () => {
          try {
            // DSH renders a row's menu in a body portal, not inside the row; the
            // row only gains a `*menuOpen` class while its menu is open.
            const openRows = document.querySelectorAll('[class*="menuOpen"][data-row-key]')
            if (openRows.length === 0) return
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
            const row = openRows[0]
            const wid = workspaceIdOf(row)
            const id = wid !== undefined ? wid : sessionIdOf(row)
            if (id === undefined) return
            const kind = wid !== undefined ? 'workspace' : 'session'
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
        })
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

      React.useEffect(() => { followRef.current() }, [decorations, catalogReady])

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
            setDecorations({
              workspaces: payload.workspaces && typeof payload.workspaces === 'object' ? payload.workspaces : {},
              sessions: payload.sessions && typeof payload.sessions === 'object' ? payload.sessions : {},
            })
          }
          return true
        } catch {
          return false
        }
      }

      const applyColor = (hex) => {
        if (picker === null) return
        setPicker({ ...picker, color: hex })
        save(picker.kind, picker.id, { color: hex === '' ? null : hex })
      }
      const applyIcon = (value) => {
        if (picker === null) return
        setPicker({ ...picker, icon: value })
        save(picker.kind, picker.id, { icon: value })
      }
      const clearAll = () => {
        if (picker === null) return
        setPicker({ ...picker, color: '', icon: '' })
        save(picker.kind, picker.id, { color: null, icon: null })
      }

      const rows = layer.items.map((item) => h('div', {
        key: item.key,
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
        const node = iconElement(icon.value, Math.min(18, Math.max(12, Math.round(icon.height) || 16)), icon.color)
        if (node === null) return null
        return h('span', {
          key: icon.key,
          className: 'dsh-srt-icon',
          style: { left: `${icon.left}px`, top: `${icon.top}px`, width: `${icon.width}px`, height: `${icon.height}px` },
        }, node)
      })

      const layerNode = h('div', {
        className: 'dsh-srt-layer',
        'data-dsh-srt-count': String(layer.items.length),
        style: { zIndex: layer.zIndex, clipPath: layer.clip },
      }, [...rows, ...iconEls])

      const iconResults = picker === null ? [] : searchIcons(picker.query)
      const panel = picker === null ? null : h('div', {
        className: 'dsh-srt-panel',
        role: 'dialog',
        'aria-label': picker.kind === 'workspace' ? '工作区颜色 / 图标' : '会话颜色 / 图标',
        style: { left: `${picker.x}px`, top: `${picker.y}px` },
        onPointerDown: (event) => event.stopPropagation(),
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
        h('input', {
          className: 'dsh-srt-search', type: 'search', placeholder: '搜索图标（如 rocket / 用户 / 微信 / openai）',
          value: picker.query,
          onChange: (event) => setPicker({ ...picker, query: event.target.value }),
        }),
        h('div', { className: 'dsh-srt-icongrid' },
          !CATALOG.ready
            ? h('div', { className: 'dsh-srt-empty' }, '图标加载中…')
            : iconResults.length === 0
              ? h('div', { className: 'dsh-srt-empty' }, '没有匹配的图标')
              : iconResults.map((value) => h('button', {
                key: value,
                type: 'button',
                className: `dsh-srt-iconbtn${picker.icon === value ? ' is-sel' : ''}`,
                title: iconName(value),
                'aria-label': `使用图标 ${iconName(value)}`,
                onClick: () => applyIcon(value),
                dangerouslySetInnerHTML: { __html: svgMarkup(value, 18) },
              })),
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
    }

    return module.exports
  },
})

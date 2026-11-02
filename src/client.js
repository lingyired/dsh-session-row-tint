/**
 * Browser half of `dsh-session-row-tint`.
 *
 * - Session rows: a full-row tint. Colour comes from this plugin's own
 *   per-Session decoration when set, otherwise from the marks owned by
 *   `@idoall/dsh-session-colors` (`GET /plugins/dsh-session-colors/marks`).
 *   A per-Session custom icon/emoji replaces the left status slot's glyph.
 * - Workspace rows: their whole block (header row plus the session list below
 *   it) is washed with the workspace colour, and the folder icon is replaced by
 *   the chosen emoji.
 * - Right-clicking a Session or workspace row opens a small picker for that
 *   row's colour and icon. Decorations are stored by this plugin's own routes
 *   (`/plugins/dsh-session-row-tint/...`) so they survive restarts and devices.
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
    const SESSION_ROW_KEY = 'session:'
    const WORKSPACE_ROW_KEY = 'workspace:'
    const POLL_MS = 1200
    const SETTLE_FRAMES = 40
    const SESSION_TINT_ALPHA = 0.18
    const WORKSPACE_TINT_ALPHA = 0.09
    const STYLE_ID = 'dsh-session-row-tint-style'
    const QUICK_EMOJIS = ['📁', '🚀', '⭐', '🔥', '🧪', '🎯', '💡', '🛠️', '📦', '🧠', '📝', '🌈']

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

    /** Session HSVA mark as `rgba()`. */
    function rgbaOf(color, alphaMul) {
      const [r, g, b] = hsvToRgb(color.h, color.s, color.v)
      const alpha = clamp((typeof color.a === 'number' ? color.a : 1) * alphaMul, 0.02, 1)
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
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
        // Replace the source plugin's 4px bar with the full-row tint.
        '.dsh-sc-chip{display:none!important}',
        '.dsh-srt-panel{position:fixed;z-index:2147483001;box-sizing:border-box;width:264px;padding:12px;border:1px solid #d8d8dc;border-radius:14px;background:#f6f6f8;color:#1d1d1f;box-shadow:0 18px 48px rgba(0,0,0,.34),0 0 0 1px rgba(0,0,0,.05);font:400 13px Inter,ui-sans-serif,system-ui,-apple-system,"PingFang SC",sans-serif}',
        '.dsh-srt-panel-title{font-weight:600;margin-bottom:10px}',
        '.dsh-srt-panel-row{display:flex;align-items:center;gap:8px;margin-bottom:10px}',
        '.dsh-srt-panel-row>span{width:32px;flex:none;color:#666}',
        '.dsh-srt-color{width:40px;height:28px;padding:0;border:1px solid #c9c9cf;border-radius:8px;background:none;cursor:pointer}',
        '.dsh-srt-text{flex:1;min-width:0;height:28px;padding:0 8px;border:1px solid #c9c9cf;border-radius:8px;background:#fff;color:#1d1d1f;font:inherit}',
        '.dsh-srt-emojis{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-bottom:10px}',
        '.dsh-srt-emoji{height:30px;padding:0;border:1px solid #e0e0e5;border-radius:8px;background:#fff;cursor:pointer;font-size:16px;line-height:1}',
        '.dsh-srt-emoji:hover{background:#eef3fb}',
        '.dsh-srt-panel-actions{display:flex;justify-content:flex-end;gap:8px}',
        '.dsh-srt-btn{height:28px;padding:0 12px;border:1px solid #c9c9cf;border-radius:9px;background:#fff;color:#1d1d1f;font:inherit;cursor:pointer}',
        '.dsh-srt-mini{height:26px;padding:0 8px;border:1px solid #d8d8dc;border-radius:8px;background:#fff;color:#666;font:inherit;cursor:pointer;flex:none}',
        '.dsh-srt-primary{background:#1d1d1f;color:#fff;border-color:#1d1d1f}',
        '.dsh-srt-danger{color:#c0392b}',
      ].join('\n')
      document.head.appendChild(style)
      return () => style.remove()
    }

    async function getJson(url) {
      const response = await fetch(url, { credentials: 'same-origin', headers: { accept: 'application/json' } })
      if (!response.ok) return undefined
      return response.json()
    }

    function RowTintLayer() {
      const [decorations, setDecorations] = React.useState({ workspaces: {}, sessions: {} })
      const [picker, setPicker] = React.useState(null)
      const [layer, setLayer] = React.useState({ items: [], icons: [], clip: 'none', zIndex: 1 })
      const decorationsRef = React.useRef(decorations)
      decorationsRef.current = decorations
      const followRef = React.useRef(() => {})

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

          // Whole workspace blocks + their folder icons.
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
                    icons.push({ key: `wi:${wid}`, left: iconBox.left, top: iconBox.top, width: iconBox.width, height: iconBox.height, text: decoration.icon })
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

          // Individual Session rows: colour the title text (no row background,
          // so it never stacks under a workspace wash), plus any custom icon.
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
                    icons.push({ key: `si:${id}`, left: iconBox.left, top: iconBox.top, width: iconBox.width, height: iconBox.height, text: sdec.icon })
                  }
                } catch {
                  // No icon geometry this frame.
                }
              }
            }
          }

          // Restore any glyph we hid that is no longer decorated.
          for (const svg of Array.from(hiddenSvgs)) {
            if (seen.has(svg)) continue
            try { svg.style.visibility = '' } catch {}
            hiddenSvgs.delete(svg)
          }
          // Restore any title colour that is no longer decorated.
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

      // Right-click on a Session or workspace row opens the picker.
      React.useEffect(() => {
        const onContextMenu = (event) => {
          try {
            const target = event.target
            if (target === null || target === undefined || typeof target.closest !== 'function') return
            const wsRow = target.closest('[data-row-key^="workspace:"]')
            const sessRow = wsRow === null ? target.closest('[data-row-key^="session:"]') : null
            const row = wsRow || sessRow
            if (row === null) return
            const kind = wsRow !== null ? 'workspace' : 'session'
            const id = kind === 'workspace' ? workspaceIdOf(row) : sessionIdOf(row)
            if (id === undefined) return
            event.preventDefault()
            event.stopPropagation()
            const bucket = kind === 'workspace' ? (decorationsRef.current.workspaces || {}) : (decorationsRef.current.sessions || {})
            const current = bucket[id] || {}
            setPicker({
              kind,
              id,
              x: Math.max(8, Math.min(event.clientX, window.innerWidth - 276)),
              y: Math.max(8, Math.min(event.clientY, window.innerHeight - 320)),
              color: current.color || '#4a90d9',
              icon: current.icon || '',
            })
          } catch {
            // A failed handler must not break the page's own context menu.
          }
        }
        document.addEventListener('contextmenu', onContextMenu, true)
        return () => document.removeEventListener('contextmenu', onContextMenu, true)
      }, [])

      // Close the picker on outside click or Escape.
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

      // Redraw when decorations change.
      React.useEffect(() => { followRef.current() }, [decorations])

      const saveDecorations = async (kind, id, patch) => {
        const route = kind === 'workspace' ? WORKSPACES_ROUTE : SESSIONS_ROUTE
        const body = kind === 'workspace' ? { workspaceId: id, ...patch } : { sessionId: id, ...patch }
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
      }

      const savePicker = async () => {
        if (picker === null) return
        await saveDecorations(picker.kind, picker.id, { color: picker.color || null, icon: picker.icon || null })
        setPicker(null)
      }
      const clearPicker = async () => {
        if (picker === null) return
        await saveDecorations(picker.kind, picker.id, { color: null, icon: null })
        setPicker(null)
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
      const iconEls = layer.icons.map((icon) => h('span', {
        key: icon.key,
        className: 'dsh-srt-icon',
        style: { left: `${icon.left}px`, top: `${icon.top}px`, width: `${icon.width}px`, height: `${icon.height}px` },
      }, icon.text))

      const layerNode = h('div', {
        className: 'dsh-srt-layer',
        'data-dsh-srt-count': String(layer.items.length),
        style: { zIndex: layer.zIndex, clipPath: layer.clip },
      }, [...rows, ...iconEls])

      const panel = picker === null ? null : h('div', {
        className: 'dsh-srt-panel',
        style: { left: `${picker.x}px`, top: `${picker.y}px` },
        onPointerDown: (event) => event.stopPropagation(),
        onContextMenu: (event) => event.preventDefault(),
      },
        h('div', { className: 'dsh-srt-panel-title' }, picker.kind === 'workspace' ? '工作区颜色 / 图标' : '会话颜色 / 图标'),
        h('div', { className: 'dsh-srt-panel-row' },
          h('span', null, '颜色'),
          h('input', {
            className: 'dsh-srt-color', type: 'color', value: picker.color || '#4a90d9',
            onChange: (event) => setPicker({ ...picker, color: event.target.value }),
          }),
          h('button', {
            className: 'dsh-srt-mini', type: 'button',
            onClick: () => setPicker({ ...picker, color: '' }),
          }, '清除颜色'),
        ),
        h('div', { className: 'dsh-srt-panel-row' },
          h('span', null, '图标'),
          h('input', {
            className: 'dsh-srt-text', type: 'text', maxLength: 4, placeholder: '输入 emoji 或文字',
            value: picker.icon || '',
            onChange: (event) => setPicker({ ...picker, icon: event.target.value }),
          }),
        ),
        h('div', { className: 'dsh-srt-emojis' },
          QUICK_EMOJIS.map((emoji) => h('button', {
            key: emoji, className: 'dsh-srt-emoji', type: 'button',
            onClick: () => setPicker({ ...picker, icon: emoji }),
          }, emoji)),
        ),
        h('div', { className: 'dsh-srt-panel-actions' },
          h('button', { className: 'dsh-srt-btn', type: 'button', onClick: () => setPicker(null) }, '取消'),
          h('button', { className: 'dsh-srt-btn dsh-srt-danger', type: 'button', onClick: clearPicker }, '清除全部'),
          h('button', { className: 'dsh-srt-btn dsh-srt-primary', type: 'button', onClick: savePicker }, '保存'),
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

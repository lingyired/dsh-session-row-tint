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
 * - Entry point: a "颜色 / 图标" item appended to the row's own "..." menu, so it
 *   does not fight any other plugin for the right-click gesture. The item opens
 *   a picker with a preset colour palette, a searchable open-source icon set
 *   (Lucide), and quick emoji. Decorations are stored by this plugin's own
 *   routes so they survive restarts and devices.
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
    const ICON_PREFIX = 'lucide:'
    const PANEL_WIDTH = 300
    const PANEL_HEIGHT = 430

    /** Preset colours offered as one-click swatches. */
    const PRESET_COLORS = [
      '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
      '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
      '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#64748b', '#0f172a',
    ]

    /** Curated Lucide (MIT) icon bodies: name -> inner SVG markup. */
    const ICON_SET = {"rocket":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09\"/><path d=\"M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z\"/><path d=\"M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05\"/></g>","user":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\"/><circle cx=\"12\" cy=\"7\" r=\"4\"/></g>","users":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3.128a4 4 0 0 1 0 7.744M22 21v-2a4 4 0 0 0-3-3.87\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/></g>","user-plus":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M19 8v6m3-3h-6\"/></g>","user-check":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m16 11l2 2l4-4m-6 12v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/></g>","user-x":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"m17 8l5 5m0-5l-5 5\"/></g>","settings":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0a2.34 2.34 0 0 0 3.319 1.915a2.34 2.34 0 0 1 2.33 4.033a2.34 2.34 0 0 0 0 3.831a2.34 2.34 0 0 1-2.33 4.033a2.34 2.34 0 0 0-3.319 1.915a2.34 2.34 0 0 1-4.659 0a2.34 2.34 0 0 0-3.32-1.915a2.34 2.34 0 0 1-2.33-4.033a2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></g>","cog":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M11 10.27L7 3.34m4 10.39l-4 6.93M12 22v-2m0-18v2m2 8h8m-5 8.66l-1-1.73m1-15.59l-1 1.73M2 12h2m16.66 5l-1.73-1m1.73-9l-1.73 1M3.34 17l1.73-1M3.34 7l1.73 1\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"8\"/></g>","sliders-horizontal":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M10 5H3m9 14H3M14 3v4m2 10v4m5-9h-9m9 7h-5m5-14h-7m-6 5v4m0-2H3\"/>","search":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m21 21l-4.34-4.34\"/><circle cx=\"11\" cy=\"11\" r=\"8\"/></g>","house":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\"/><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/></g>","file":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\"/><path d=\"M14 2v5a1 1 0 0 0 1 1h5\"/></g>","file-text":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\"/><path d=\"M14 2v5a1 1 0 0 0 1 1h5M10 9H8m8 4H8m8 4H8\"/></g>","file-plus":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\"/><path d=\"M14 2v5a1 1 0 0 0 1 1h5M9 15h6m-3 3v-6\"/></g>","file-minus":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\"/><path d=\"M14 2v5a1 1 0 0 0 1 1h5M9 15h6\"/></g>","folder":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\"/>","folder-open":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m6 14l1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2\"/>","folder-plus":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 10v6m-3-3h6m5 7a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\"/>","folder-minus":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M9 13h6m5 7a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\"/>","star":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.12 2.12 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.12 2.12 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.12 2.12 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16z\"/>","heart":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M2 9.5a5.5 5.5 0 0 1 9.591-3.676a.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5\"/>","bookmark":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z\"/>","pin":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4a1 1 0 0 1 1 1z\"/>","flag":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528\"/>","tag":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z\"/><circle cx=\"7.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\"/></g>","tags":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M13.172 2a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408l-4.592 4.592a2.4 2.4 0 0 1-3.408 0l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1zM2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193\"/><circle cx=\"10.5\" cy=\"6.5\" r=\".5\" fill=\"currentColor\"/></g>","palette":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12 22a1 1 0 0 1 0-20a10 9 0 0 1 10 9a5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z\"/><circle cx=\"13.5\" cy=\"6.5\" r=\".5\" fill=\"currentColor\"/><circle cx=\"17.5\" cy=\"10.5\" r=\".5\" fill=\"currentColor\"/><circle cx=\"6.5\" cy=\"12.5\" r=\".5\" fill=\"currentColor\"/><circle cx=\"8.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\"/></g>","brush":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m11 10l3 3m-7.5 8A3.5 3.5 0 1 0 3 17.5a2.62 2.62 0 0 1-.708 1.792A1 1 0 0 0 3 21z\"/><path d=\"M9.969 17.031L21.378 5.624a1 1 0 0 0-3.002-3.002L6.967 14.031\"/></g>","paintbrush":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m14.622 17.897l-10.68-2.913M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0zM9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15\"/>","image":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" ry=\"2\"/><circle cx=\"9\" cy=\"9\" r=\"2\"/><path d=\"m21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21\"/></g>","images":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m22 11l-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16\"/><path d=\"M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2\"/><circle cx=\"13\" cy=\"7\" r=\"1\" fill=\"currentColor\"/><rect width=\"14\" height=\"14\" x=\"8\" y=\"2\" rx=\"2\"/></g>","video":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m16 13l5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5\"/><rect width=\"14\" height=\"12\" x=\"2\" y=\"6\" rx=\"2\"/></g>","music":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M9 18V5l12-2v13\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/><circle cx=\"18\" cy=\"16\" r=\"3\"/></g>","mic":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12 19v3m7-12v2a7 7 0 0 1-14 0v-2\"/><rect width=\"6\" height=\"13\" x=\"9\" y=\"2\" rx=\"3\"/></g>","camera":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z\"/><circle cx=\"12\" cy=\"13\" r=\"3\"/></g>","smartphone":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><rect width=\"14\" height=\"20\" x=\"5\" y=\"2\" rx=\"2\" ry=\"2\"/><path d=\"M12 18h.01\"/></g>","tablet":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><rect width=\"16\" height=\"20\" x=\"4\" y=\"2\" rx=\"2\" ry=\"2\"/><path d=\"M12 18h.01\"/></g>","laptop":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2zm2.054 10.987H3.946\"/>","monitor":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><rect width=\"20\" height=\"14\" x=\"2\" y=\"3\" rx=\"2\"/><path d=\"M8 21h8m-4-4v4\"/></g>","tv":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m17 2l-5 5l-5-5\"/><rect width=\"20\" height=\"15\" x=\"2\" y=\"7\" rx=\"2\"/></g>","headphones":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3\"/>","speaker":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><rect width=\"16\" height=\"20\" x=\"4\" y=\"2\" rx=\"2\"/><path d=\"M12 6h.01\"/><circle cx=\"12\" cy=\"14\" r=\"4\"/><path d=\"M12 14h.01\"/></g>","wifi":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 20h.01M2 8.82a15 15 0 0 1 20 0M5 12.859a10 10 0 0 1 14 0m-10.5 3.57a5 5 0 0 1 7 0\"/>","bluetooth":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m7 7l10 10l-5 5V2l5 5L7 17\"/>","battery":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M22 14v-4\"/><rect width=\"16\" height=\"12\" x=\"2\" y=\"6\" rx=\"2\"/></g>","plug":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 22v-5m3-9V2m2 6a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1zM9 8V2\"/>","power":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 2v10m6.4-5.4a9 9 0 1 1-12.77.04\"/>","zap":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M15.914 4a1.5 1.5 0 0 0-2.474-1.561l-9 9A1.5 1.5 0 0 0 5.5 14h4.002a.5.5 0 0 1 .471.666L8.086 20a1.5 1.5 0 0 0 2.475 1.56l9-9A1.5 1.5 0 0 0 18.5 10h-3.997a.5.5 0 0 1-.472-.667z\"/>","activity":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2\"/>","signal":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M2 20h.01M7 20v-4m5 4v-8m5 8V8m5-4v16\"/>","bell":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M10.268 21a2 2 0 0 0 3.464 0m-10.47-5.674A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326\"/>","bell-off":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M10.268 21a2 2 0 0 0 3.464 0M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742M2 2l20 20M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05\"/>","mail":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m22 7l-8.991 5.727a2 2 0 0 1-2.009 0L2 7\"/><rect width=\"20\" height=\"16\" x=\"2\" y=\"4\" rx=\"2\"/></g>","inbox":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M22 12h-6l-2 3h-4l-2-3H2\"/><path d=\"M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11\"/></g>","send":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11zm7.318-19.539l-10.94 10.939\"/>","share":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 2v13m4-9l-4-4l-4 4m-4 6v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8\"/>","share-2":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"18\" cy=\"5\" r=\"3\"/><circle cx=\"6\" cy=\"12\" r=\"3\"/><circle cx=\"18\" cy=\"19\" r=\"3\"/><path d=\"m8.59 13.51l6.83 3.98m-.01-10.98l-6.82 3.98\"/></g>","link":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\"/><path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\"/></g>","link-2":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M9 17H7A5 5 0 0 1 7 7h2m6 0h2a5 5 0 1 1 0 10h-2m-7-5h8\"/>","unlink":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m18.84 12.25l1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07a5.006 5.006 0 0 0-6.95 0l-1.72 1.71m-6.58 6.57l-1.71 1.71a5.004 5.004 0 0 0 .12 7.07a5.006 5.006 0 0 0 6.95 0l1.71-1.71M8 2v3M2 8h3m11 11v3m3-6h3\"/>","external-link":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M15 3h6v6m-11 5L21 3m-3 10v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\"/>","copy":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\"/><path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\"/></g>","clipboard":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\"/><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"/></g>","clipboard-check":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\"/><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"/><path d=\"m9 14l2 2l4-4\"/></g>","clipboard-list":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\"/><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2m4 7h4m-4 5h4m-8-5h.01M8 16h.01\"/></g>","save":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z\"/><path d=\"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7M7 3v4a1 1 0 0 0 1 1h7\"/></g>","download":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12 15V3m9 12v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><path d=\"m7 10l5 5l5-5\"/></g>","upload":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 3v12m5-7l-5-5l-5 5m14 7v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/>","cloud":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9\"/>","cloud-upload":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12 13v8m-8-6.101A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242\"/><path d=\"m8 17l4-4l4 4\"/></g>","cloud-download":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12 13v8l-4-4m4 4l4-4\"/><path d=\"M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284\"/></g>","database":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><ellipse cx=\"12\" cy=\"5\" rx=\"9\" ry=\"3\"/><path d=\"M3 5v14a9 3 0 0 0 18 0V5\"/><path d=\"M3 12a9 3 0 0 0 18 0\"/></g>","server":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><rect width=\"20\" height=\"8\" x=\"2\" y=\"2\" rx=\"2\" ry=\"2\"/><rect width=\"20\" height=\"8\" x=\"2\" y=\"14\" rx=\"2\" ry=\"2\"/><path d=\"M6 6h.01M6 18h.01\"/></g>","hard-drive":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M10 16h.01m-7.798-4.423a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11zm19.734.436H2.054M6 16h.01\"/>","cpu":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12 20v2m0-20v2m5 16v2m0-20v2M2 12h2m-2 5h2M2 7h2m16 5h2m-2 5h2M20 7h2M7 20v2M7 2v2\"/><rect width=\"16\" height=\"16\" x=\"4\" y=\"4\" rx=\"2\"/><rect width=\"8\" height=\"8\" x=\"8\" y=\"8\" rx=\"1\"/></g>","memory-stick":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12 12v-2m0 8v-2m4-4v-2m0 8v-2M2 11h1.5M20 18v-2m.5-5H22M4 18v-2m4-4v-2m0 8v-2\"/><rect width=\"20\" height=\"10\" x=\"2\" y=\"6\" rx=\"2\"/></g>","network":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><rect width=\"6\" height=\"6\" x=\"16\" y=\"16\" rx=\"1\"/><rect width=\"6\" height=\"6\" x=\"2\" y=\"16\" rx=\"1\"/><rect width=\"6\" height=\"6\" x=\"9\" y=\"2\" rx=\"1\"/><path d=\"M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3m-7-4V8\"/></g>","router":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><rect width=\"20\" height=\"8\" x=\"2\" y=\"14\" rx=\"2\"/><path d=\"M6.01 18H6m4.01 0H10m5-8v4m2.84-6.83a4 4 0 0 0-5.66 0m8.48-2.83a8 8 0 0 0-11.31 0\"/></g>","code":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m16 18l6-6l-6-6M8 6l-6 6l6 6\"/>","terminal":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 19h8M4 17l6-6l-6-6\"/>","git-branch":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M15 6a9 9 0 0 0-9 9V3\"/><circle cx=\"18\" cy=\"6\" r=\"3\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/></g>","git-merge":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"18\" cy=\"18\" r=\"3\"/><circle cx=\"6\" cy=\"6\" r=\"3\"/><path d=\"M6 21V9a9 9 0 0 0 9 9\"/></g>","git-pull-request":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"18\" cy=\"18\" r=\"3\"/><circle cx=\"6\" cy=\"6\" r=\"3\"/><path d=\"M13 6h3a2 2 0 0 1 2 2v7M6 9v12\"/></g>","github":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5c.08-1.25-.27-2.48-1-3.5c.28-1.15.28-2.35 0-3.5c0 0-1 0-3 1.5c-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5c-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4\"/><path d=\"M9 18c-4.51 2-5-2-7-2\"/></g>","git-commit-horizontal":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M3 12h6m6 0h6\"/></g>","bug":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12 20v-9m2-4a4 4 0 0 1 4 4v3a6 6 0 0 1-12 0v-3a4 4 0 0 1 4-4zm.12-3.12L16 2\"/><path d=\"M21 21a4 4 0 0 0-3.81-4M21 5a4 4 0 0 1-3.55 3.97M22 13h-4M3 21a4 4 0 0 1 3.81-4M3 5a4 4 0 0 0 3.55 3.97M6 13H2M8 2l1.88 1.88M9 7.13V6a3 3 0 1 1 6 0v1.13\"/></g>","test-tube":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5V2m-1 0h7m-1 14h-5\"/>","flask-conical":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2M6.453 15h11.094M8.5 2h7\"/>","microscope":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M6 18h8M3 22h18m-7 0a7 7 0 1 0 0-14h-1m-4 6h2m-2-2a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Zm3-6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3\"/>","book":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20\"/>","book-open":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 5v16m8.001-2A2 2 0 0 0 22 17V5a2 2 0 0 0-1.999-2L16 3.002A5 5 0 0 0 12 5a5 5 0 0 0-4-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 1.999 2H8a5 5 0 0 1 4 2a5 5 0 0 1 4-2z\"/>","library":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m16 6l4 14M12 6v14M8 8v12M4 4v16\"/>","notebook":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M2 6h4m-4 4h4m-4 4h4m-4 4h4\"/><rect width=\"16\" height=\"20\" x=\"4\" y=\"2\" rx=\"2\"/><path d=\"M16 2v20\"/></g>","notebook-pen":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4M2 6h4m-4 4h4m-4 4h4m-4 4h4\"/><path d=\"M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z\"/></g>","newspaper":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M15 18h-5m8-4h-8m-6 8h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2\"/><rect width=\"8\" height=\"4\" x=\"10\" y=\"6\" rx=\"1\"/></g>","graduation-cap":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0zM22 10v6\"/><path d=\"M6 12.5V16a6 3 0 0 0 12 0v-3.5\"/></g>","brain":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12 18V5m3 8a4.17 4.17 0 0 1-3-4a4.17 4.17 0 0 1-3 4m8.707-6.706A3 3 0 1 0 12 5a3 3 0 1 0-5.707 1.294\"/><path d=\"M17.996 5.125a4 4 0 0 1 2.526 5.77\"/><path d=\"M18 18a4 4 0 0 0 2-7.465\"/><path d=\"M19.967 17.482a4 4 0 1 1-7.967.517a4 4 0 1 1-7.967-.517\"/><path d=\"M6 18a4 4 0 0 1-2-7.465\"/><path d=\"M6.004 5.125a4 4 0 0 0-2.526 5.77\"/></g>","lightbulb":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M15 14c.2-1 .7-1.7 1.5-2.5c1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5c.7.7 1.3 1.5 1.5 2.5m0 4h6m-5 4h4\"/>","sparkles":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594zM20 2v4m2-2h-4\"/><circle cx=\"4\" cy=\"20\" r=\"2\"/></g>","award":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m15.477 12.89l1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526\"/><circle cx=\"12\" cy=\"8\" r=\"6\"/></g>","trophy":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M10 14.66V17a1 1 0 0 1-1 1a2 2 0 0 0-2 2v2m7-7.34V17a1 1 0 0 0 1 1a2 2 0 0 1 2 2v2m.916-12H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3M4 22h16\"/><path d=\"M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z\"/><path d=\"M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3\"/></g>","target":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><circle cx=\"12\" cy=\"12\" r=\"6\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/></g>","crosshair":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M22 12h-4M6 12H2m10-6V2m0 20v-4\"/></g>","compass":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m16.24 7.76l-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z\"/></g>","map":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0zm.894.211v15M9 3.236v15\"/>","map-pin":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/></g>","globe":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 2a14.5 14.5 0 0 0 0 20a14.5 14.5 0 0 0 0-20M2 12h20\"/></g>","plane":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8L4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1l3 2l2 3l1-1v-3l3-2l3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2\"/>","car":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2\"/><circle cx=\"7\" cy=\"17\" r=\"2\"/><path d=\"M9 17h6\"/><circle cx=\"17\" cy=\"17\" r=\"2\"/></g>","bike":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"18.5\" cy=\"17.5\" r=\"3.5\"/><circle cx=\"5.5\" cy=\"17.5\" r=\"3.5\"/><circle cx=\"15\" cy=\"5\" r=\"1\"/><path d=\"M12 17.5V14l-3-3l4-3l2 3h2\"/></g>","train-front":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M8 3.1V7a4 4 0 0 0 8 0V3.1M9 15l-1-1m7 1l1-1\"/><path d=\"M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Zm-1 0l-2 3m10-3l2 3\"/></g>","bus":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M8 6v6m7-6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2s-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3\"/><circle cx=\"7\" cy=\"18\" r=\"2\"/><path d=\"M9 18h5\"/><circle cx=\"16\" cy=\"18\" r=\"2\"/></g>","ship":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12 2v2m0 5.189V13m7-1V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6\"/><path d=\"M19.38 19A11.6 11.6 0 0 0 21 13l-8.188-3.639a2 2 0 0 0-1.624 0L3 13.001a11.6 11.6 0 0 0 2.81 7.76\"/><path d=\"M2 20c.6.5 1.2 1 2.5 1c2.5 0 2.5-2 5-2c1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2c1.3 0 1.9.5 2.5 1\"/></g>","package":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73zm1 .27V12\"/><path d=\"M3.29 7L12 12l8.71-5M7.5 4.27l9 5.15\"/></g>","box":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z\"/><path d=\"m3.3 7l8.7 5l8.7-5M12 22V12\"/></g>","boxes":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3zM7 16.5l-4.74-2.85M7 16.5l5-3m-5 3v5.17m5-8.17V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5zm5 3l-5-3m5 3l4.74-2.85M17 16.5v5.17\"/><path d=\"M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3l5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0zM12 8L7.26 5.15M12 8l4.74-2.85M12 13.5V8\"/></g>","archive":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><rect width=\"20\" height=\"5\" x=\"2\" y=\"3\" rx=\"1\"/><path d=\"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8m-10 4h4\"/></g>","layers":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z\"/><path d=\"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12\"/><path d=\"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17\"/></g>","layout-grid":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><rect width=\"7\" height=\"7\" x=\"3\" y=\"3\" rx=\"1\"/><rect width=\"7\" height=\"7\" x=\"14\" y=\"3\" rx=\"1\"/><rect width=\"7\" height=\"7\" x=\"14\" y=\"14\" rx=\"1\"/><rect width=\"7\" height=\"7\" x=\"3\" y=\"14\" rx=\"1\"/></g>","layout-list":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><rect width=\"7\" height=\"7\" x=\"3\" y=\"3\" rx=\"1\"/><rect width=\"7\" height=\"7\" x=\"3\" y=\"14\" rx=\"1\"/><path d=\"M14 4h7m-7 5h7m-7 6h7m-7 5h7\"/></g>","list":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M3 5h.01M3 12h.01M3 19h.01M8 5h13M8 12h13M8 19h13\"/>","list-checks":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M13 5h8m-8 7h8m-8 7h8M3 17l2 2l4-4M3 7l2 2l4-4\"/>","grid-2x2":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12 3v18m-9-9h18\"/><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/></g>","kanban":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M5 3v14m7-14v8m7-8v18\"/>","table":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12 3v18\"/><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M3 9h18M3 15h18\"/></g>","chart-bar":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M3 3v16a2 2 0 0 0 2 2h16M7 16h8m-8-5h12M7 6h3\"/>","chart-line":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M3 3v16a2 2 0 0 0 2 2h16\"/><path d=\"m19 9l-5 5l-4-4l-3 3\"/></g>","chart-pie":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z\"/><path d=\"M21.21 15.89A10 10 0 1 1 8 2.83\"/></g>","trending-up":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M16 7h6v6\"/><path d=\"m22 7l-8.5 8.5l-5-5L2 17\"/></g>","trending-down":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M16 17h6v-6\"/><path d=\"m22 17l-8.5-8.5l-5 5L2 7\"/></g>","dollar-sign":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 3v18m5-16H9.5a1 1 0 0 0 0 7h5a1 1 0 0 1 0 7H6\"/>","credit-card":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><rect width=\"20\" height=\"14\" x=\"2\" y=\"5\" rx=\"2\"/><path d=\"M2 10h20M6 14h2\"/></g>","wallet":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1\"/><path d=\"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4\"/></g>","receipt":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12 17V7m4 1h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8\"/><path d=\"M4 3a1 1 0 0 1 1-1a1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1a1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2a1 1 0 0 1-1-1z\"/></g>","shopping-cart":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m2.05 2.05l1.099-.028a1 1 0 0 1 1.008.815l2.69 14.347A1 1 0 0 0 7.83 18H18\"/><path d=\"M4.563 5h16.435a1 1 0 0 1 .981 1.204l-1.026 6.226A2 2 0 0 1 18.962 14H6.25\"/><circle cx=\"18\" cy=\"20\" r=\"2\"/><circle cx=\"8\" cy=\"20\" r=\"2\"/></g>","shopping-bag":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M16 10a4 4 0 0 1-8 0M3.103 6.034h17.794\"/><path d=\"M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z\"/></g>","store":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5m8.774-10.69a1.12 1.12 0 0 0-1.549 0a2.5 2.5 0 0 1-3.451 0a1.12 1.12 0 0 0-1.548 0a2.5 2.5 0 0 1-3.452 0a1.12 1.12 0 0 0-1.549 0a2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244\"/><path d=\"M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05\"/></g>","gift":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12 7v14m8-10v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8m3.5-4a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5a1 1 0 0 1 0 5\"/><rect width=\"18\" height=\"4\" x=\"3\" y=\"7\" rx=\"1\"/></g>","coffee":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M10 2v2m4-2v2m2 4a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1M6 2v2\"/>","pizza":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m12 14l-1 1m2.75 3.25l-1.25 1.42m5.275-14.016a15.68 15.68 0 0 0-12.121 12.12M18.8 9.3a1 1 0 0 0 2.1 7.7\"/><path d=\"M21.964 20.732a1 1 0 0 1-1.232 1.232l-18-5a1 1 0 0 1-.695-1.232A19.68 19.68 0 0 1 15.732 2.037a1 1 0 0 1 1.232.695z\"/></g>","apple":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12 6.528V3a1 1 0 0 1 1-1\"/><path d=\"M18.237 21A15 15 0 0 0 22 11a6 6 0 0 0-10-4.472A6 6 0 0 0 2 11a15.1 15.1 0 0 0 3.763 10a3 3 0 0 0 3.648.648a5.5 5.5 0 0 1 5.178 0A3 3 0 0 0 18.237 21\"/></g>","cherry":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M2 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3c-2.5-2-5 .24-5 3m10 0a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3c-2.5-2-5 .24-5 3\"/><path d=\"M7 14c3.22-2.91 4.29-8.75 5-12c1.66 2.38 4.94 9 5 12\"/><path d=\"M22 9c-4.29 0-7.14-2.33-10-7c5.71 0 10 4.67 10 7\"/></g>","cake":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8\"/><path d=\"M4 16s.5-1 2-1s2.5 2 4 2s2.5-2 4-2s2.5 2 4 2s2-1 2-1M2 21h20M7 8v3m5-3v3m5-3v3M7 4h.01M12 4h.01M17 4h.01\"/></g>","sun":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41\"/></g>","sunrise":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 2v8m-7.07.93l1.41 1.41M2 18h2m16 0h2m-2.93-7.07l-1.41 1.41M22 22H2M8 6l4-4l4 4m0 12a4 4 0 0 0-8 0\"/>","sunset":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 10V2m-7.07 8.93l1.41 1.41M2 18h2m16 0h2m-2.93-7.07l-1.41 1.41M22 22H2M16 6l-4 4l-4-4m8 12a4 4 0 0 0-8 0\"/>","moon":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401\"/>","cloud-sun":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 2v2m-7.07.93l1.41 1.41M20 12h2m-2.93-7.07l-1.41 1.41m-1.713 6.31a4 4 0 0 0-5.925-4.128M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6\"/>","cloud-moon":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M13 16a3 3 0 0 1 0 6H7a5 5 0 1 1 4.9-6zm5.376-1.488a6 6 0 0 0 3.461-4.127c.148-.625-.659-.97-1.248-.714a4 4 0 0 1-5.259-5.26c.255-.589-.09-1.395-.716-1.248a6 6 0 0 0-4.594 5.36\"/>","droplet":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7\"/>","flame":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0a5 5 0 0 1 1-3a1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4\"/>","leaf":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M11 20a10 10 0 0 0 10-10a25.9 25.9 0 0 0-1.04-7.281a1 1 0 0 0-1.755-.325C15.833 5.5 13 5.5 9.8 6.1A7 7 0 0 0 11 20\"/><path d=\"M2 21a5 5 0 0 1 2.911-4.544C7.613 15.212 8.351 15.24 11 13\"/></g>","tree-pine":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m17 14l3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7zm-5 8v-3\"/>","flower-2":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1\"/><circle cx=\"12\" cy=\"8\" r=\"2\"/><path d=\"M12 10v12m0 0c4.2 0 7-1.667 7-5c-4.2 0-7 1.667-7 5m0 0c-4.2 0-7-1.667-7-5c4.2 0 7 1.667 7 5\"/></g>","sprout":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4a4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3M4 9a5 5 0 0 1 8 4a5 5 0 0 1-8-4m1 12h14\"/>","mountain":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m8 3l4 8l5-5l5 15H2z\"/>","waves":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2c2.5 0 2.5-2 5-2c1.3 0 1.9.5 2.5 1M2 12c.6.5 1.2 1 2.5 1c2.5 0 2.5-2 5-2c2.6 0 2.4 2 5 2c2.5 0 2.5-2 5-2c1.3 0 1.9.5 2.5 1M2 18c.6.5 1.2 1 2.5 1c2.5 0 2.5-2 5-2c2.6 0 2.4 2 5 2c2.5 0 2.5-2 5-2c1.3 0 1.9.5 2.5 1\"/>","earth":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M21.54 15H17a2 2 0 0 0-2 2v4.54M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05\"/><circle cx=\"12\" cy=\"12\" r=\"10\"/></g>","lock":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\"/><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"/></g>","key":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m2 21l9.6-9.6m-4.1 4.1l2.3 2.3a1 1 0 0 1 0 1.4l-2.1 2.1a1 1 0 0 1-1.4 0L4 19\"/><circle cx=\"15.5\" cy=\"7.5\" r=\"5.5\"/></g>","shield":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\"/>","shield-check":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\"/><path d=\"m9 12l2 2l4-4\"/></g>","triangle-alert":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m21.73 18l-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4m0 4h.01\"/>","circle-alert":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 8v4m0 4h.01\"/></g>","circle-check":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m16 9l-5.5 5.5L8 12\"/></g>","circle-x":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m15 9l-6 6m0-6l6 6\"/></g>","info":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4m0-4h.01\"/></g>","check":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M20 6L9 17l-5-5\"/>","check-check":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M18 6L7 17l-5-5m20-2l-7.5 7.5L13 16\"/>","x":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M18 6L6 18M6 6l12 12\"/>","plus":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M5 12h14m-7-7v14\"/>","minus":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M5 12h14\"/>","trash":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M10 11v6m4-6v6m5-11v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/>","pencil":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497zM15 5l4 4\"/>","pen":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\"/>","pen-tool":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m18 13l-.654-4.736a4 4 0 0 0-2.756-3.266l-9.163-2.9a2 2 0 0 0-2.017.493l-.82.819a2 2 0 0 0-.492 2.017l2.9 9.163a4 4 0 0 0 3.266 2.756L13 18\"/><path d=\"M18.648 12.352a1.205 1.205 0 0 1 1.704 0l1.296 1.296a1.205 1.205 0 0 1 0 1.704l-6.296 6.296a1.205 1.205 0 0 1-1.704 0l-1.296-1.296a1.205 1.205 0 0 1 0-1.704zM3 3l6.586 6.586\"/><circle cx=\"11\" cy=\"11\" r=\"2\"/></g>","eraser":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21m-7.752-9.91l8.828 8.828\"/>","ruler":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Zm-6.8-2.8l2-2m-5-1l2-2m-5-1l2-2m7 11l2-2\"/>","scissors":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"6\" cy=\"6\" r=\"3\"/><path d=\"M8.12 8.12L12 12m8-8L8.12 15.88\"/><circle cx=\"6\" cy=\"18\" r=\"3\"/><path d=\"M14.8 14.8L20 20\"/></g>","wrench":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z\"/>","hammer":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m15 12l-9.373 9.373a1 1 0 0 1-3.001-3L12 9m6 6l4-4\"/><path d=\"m21.5 11.5l-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5\"/></g>","printer":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6\"/><rect width=\"12\" height=\"8\" x=\"6\" y=\"14\" rx=\"1\"/></g>","scan":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M3 7V5a2 2 0 0 1 2-2h2m10 0h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2\"/>","qr-code":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><rect width=\"5\" height=\"5\" x=\"3\" y=\"3\" rx=\"1\"/><rect width=\"5\" height=\"5\" x=\"16\" y=\"3\" rx=\"1\"/><rect width=\"5\" height=\"5\" x=\"3\" y=\"16\" rx=\"1\"/><path d=\"M21 16h-3a2 2 0 0 0-2 2v3m5 0v.01M12 7v3a2 2 0 0 1-2 2H7m-4 0h.01M12 3h.01M12 16v.01M16 12h1m4 0v.01M12 21v-1\"/></g>","calculator":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><rect width=\"16\" height=\"20\" x=\"4\" y=\"2\" rx=\"2\"/><path d=\"M8 6h8m0 8v4m0-8h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01\"/></g>","type":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 4v16M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2M9 20h6\"/>","italic":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M19 4h-9m4 16H5M15 4L9 20\"/>","underline":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M6 4v6a6 6 0 0 0 12 0V4M4 20h16\"/>","quote":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2a1 1 0 0 1 1 1v1a2 2 0 0 1-2 2a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1a6 6 0 0 0 6-6V5a2 2 0 0 0-2-2zM5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2a1 1 0 0 1 1 1v1a2 2 0 0 1-2 2a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1a6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z\"/>","smile":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M8 14s1.5 2 4 2s4-2 4-2M9 9h.01M15 9h.01\"/></g>","smile-plus":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M22 11v1a10 10 0 1 1-9-10\"/><path d=\"M8 14s1.5 2 4 2s4-2 4-2M9 9h.01M15 9h.01M16 5h6m-3-3v6\"/></g>","frown":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M16 16s-1.5-2-4-2s-4 2-4 2m1-7h.01M15 9h.01\"/></g>","laugh":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M18 13a6 6 0 0 1-6 5a6 6 0 0 1-6-5zM9 9h.01M15 9h.01\"/></g>","ghost":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M15 10v1m-7.472 9.472a1.6 1.6 0 0 1 2.277 0l1.057 1.056a1.6 1.6 0 0 0 2.276 0l1.057-1.056a1.6 1.6 0 0 1 2.277 0l1.114 1.114a1.4 1.4 0 0 0 2.414-1V10a8 8 0 0 0-16 0v10.586a1.4 1.4 0 0 0 2.414 1zM9 10v1\"/>","eye":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M2.062 12.348a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 19.876 0a1 1 0 0 1 0 .696a10.75 10.75 0 0 1-19.876 0\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></g>","eye-off":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575a1 1 0 0 1 0 .696a10.8 10.8 0 0 1-1.444 2.49m-6.41-.679a3 3 0 0 1-4.242-4.242\"/><path d=\"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 4.446-5.143M2 2l20 20\"/></g>","glasses":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"6\" cy=\"15\" r=\"4\"/><circle cx=\"18\" cy=\"15\" r=\"4\"/><path d=\"M14 15a2 2 0 0 0-2-2a2 2 0 0 0-2 2m-7.5-2L5 7c.7-1.3 1.4-2 3-2m13.5 8L19 7c-.7-1.3-1.5-2-3-2\"/></g>","hand":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2m0 4V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2m0 4.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8\"/><path d=\"M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15\"/></g>","hand-heart":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M11 14h2a2 2 0 0 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16\"/><path d=\"m14.45 13.39l5.05-4.694C20.196 8 21 6.85 21 5.75a2.75 2.75 0 0 0-4.797-1.837a.276.276 0 0 1-.406 0A2.75 2.75 0 0 0 11 5.75c0 1.2.802 2.248 1.5 2.946L16 11.95M2 15l6 6\"/><path d=\"m7 20l1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a1 1 0 0 0-2.75-2.91\"/></g>","heart-handshake":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676a.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052a2.12 2.12 0 0 0-.004-3a2.124 2.124 0 1 0 3-3a2.124 2.124 0 0 0 3.004 0a2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0a2 2 0 0 1 0-2.828l2.823-2.762\"/>","thumbs-up":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88M7 10v12\"/>","thumbs-down":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88M17 14V2\"/>","move":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 2v20m3-3l-3 3l-3-3M19 9l3 3l-3 3M2 12h20M5 9l-3 3l3 3M9 5l3-3l3 3\"/>","mouse-pointer":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12.586 12.586L19 19M3.688 3.037a.497.497 0 0 0-.651.651l6.5 15.999a.501.501 0 0 0 .947-.062l1.569-6.083a2 2 0 0 1 1.448-1.479l6.124-1.579a.5.5 0 0 0 .063-.947z\"/>","keyboard":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M10 8h.01M12 12h.01M14 8h.01M16 12h.01M18 8h.01M6 8h.01M7 16h10m-9-4h.01\"/><rect width=\"20\" height=\"16\" x=\"2\" y=\"4\" rx=\"2\"/></g>","command":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3\"/>","chevron-down":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m6 9l6 6l6-6\"/>","chevron-up":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m18 15l-6-6l-6 6\"/>","chevron-left":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m15 18l-6-6l6-6\"/>","chevron-right":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m9 18l6-6l-6-6\"/>","arrow-up":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m5 12l7-7l7 7m-7 7V5\"/>","arrow-down":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 5v14m7-7l-7 7l-7-7\"/>","arrow-left":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m12 19l-7-7l7-7m7 7H5\"/>","arrow-right":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M5 12h14m-7-7l7 7l-7 7\"/>","arrow-up-right":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M7 7h10v10M7 17L17 7\"/>","arrow-down-left":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M17 7L7 17m10 0H7V7\"/>","chevrons-up-down":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m7 15l5 5l5-5M7 9l5-5l5 5\"/>","ellipsis":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"1\"/><circle cx=\"19\" cy=\"12\" r=\"1\"/><circle cx=\"5\" cy=\"12\" r=\"1\"/></g>","ellipsis-vertical":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"1\"/><circle cx=\"12\" cy=\"5\" r=\"1\"/><circle cx=\"12\" cy=\"19\" r=\"1\"/></g>","filter":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M22 3H2l8 9.46V19l4 2v-8.54z\"/>","funnel":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z\"/>","zoom-in":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21l-4.35-4.35M11 8v6m-3-3h6\"/></g>","zoom-out":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21l-4.35-4.35M8 11h6\"/></g>","maximize":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3\"/>","minimize":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3m8 0v-3a2 2 0 0 1 2-2h3\"/>","expand":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m15 15l6 6M15 9l6-6m0 13v5h-5m5-13V3h-5M3 16v5h5m-5 0l6-6M3 8V3h5m1 6L3 3\"/>","shrink":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m15 15l6 6m-6-6v4.8m0-4.8h4.8M9 19.8V15m0 0H4.2M9 15l-6 6M15 4.2V9m0 0h4.8M15 9l6-6M9 4.2V9m0 0H4.2M9 9L3 3\"/>","rotate-cw":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8\"/><path d=\"M21 3v5h-5\"/></g>","rotate-ccw":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M3 12a9 9 0 1 0 9-9a9.75 9.75 0 0 0-6.74 2.74L3 8\"/><path d=\"M3 3v5h5\"/></g>","refresh-cw":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M3 12a9 9 0 0 1 9-9a9.75 9.75 0 0 1 6.74 2.74L21 8\"/><path d=\"M21 3v5h-5m5 4a9 9 0 0 1-9 9a9.75 9.75 0 0 1-6.74-2.74L3 16\"/><path d=\"M8 16H3v5\"/></g>","refresh-ccw":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M21 12a9 9 0 0 0-9-9a9.75 9.75 0 0 0-6.74 2.74L3 8\"/><path d=\"M3 3v5h5m-5 4a9 9 0 0 0 9 9a9.75 9.75 0 0 0 6.74-2.74L21 16\"/><path d=\"M16 16h5v5\"/></g>","timer":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M10 2h4m-2 12l3-3\"/><circle cx=\"12\" cy=\"14\" r=\"8\"/></g>","alarm-clock":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"13\" r=\"8\"/><path d=\"M12 9v4l2 2M5 3L2 6m20 0l-3-3M6.38 18.7L4 21m13.64-2.33L20 21\"/></g>","calendar":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M8 2v3m8-3v3\"/><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M3 9h18\"/></g>","calendar-days":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M8 2v3m8-3v3\"/><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01\"/></g>","clock":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 6v6l4 2\"/></g>","wind":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12.8 19.6A2 2 0 1 0 14 16H2m15.5-8a2.5 2.5 0 1 1 2 4H2m7.8-7.6A2 2 0 1 1 11 8H2\"/>","thermometer":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0\"/>","snowflake":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m10 20l-1.25-2.5L6 18m4-14L8.75 6.5L6 6m8 14l1.25-2.5L18 18M14 4l1.25 2.5L18 6\"/><path d=\"m17 21l-3-6h-4m7-12l-3 6l1.5 3M2 12h6.5L10 9m10 1l-1.5 2l1.5 2\"/><path d=\"M22 12h-6.5L14 15M4 10l1.5 2L4 14m3 7l3-6l-1.5-3M7 3l3 6h4\"/></g>","umbrella":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12 13v7a2 2 0 0 0 4 0M12 2v2\"/><path d=\"M20.992 13a1 1 0 0 0 .97-1.274a10.284 10.284 0 0 0-19.923 0A1 1 0 0 0 3 13z\"/></g>","rainbow":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M22 17a10 10 0 0 0-20 0\"/><path d=\"M6 17a6 6 0 0 1 12 0\"/><path d=\"M10 17a2 2 0 0 1 4 0\"/></g>","atom":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"1\"/><path d=\"M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9c-4.54-4.52-9.87-6.54-11.9-4.5c-2.04 2.03-.02 7.36 4.5 11.9c4.54 4.52 9.87 6.54 11.9 4.5\"/><path d=\"M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9c-2.03-2.04-7.36-.02-11.9 4.5c-4.52 4.54-6.54 9.87-4.5 11.9c2.03 2.04 7.36.02 11.9-4.5\"/></g>","orbit":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M20.341 6.484A10 10 0 0 1 10.266 21.85m-6.607-4.334A10 10 0 0 1 13.74 2.152\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/><circle cx=\"19\" cy=\"5\" r=\"2\"/><circle cx=\"5\" cy=\"19\" r=\"2\"/></g>","satellite":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m13.5 6.5l-3.148-3.148a1.205 1.205 0 0 0-1.704 0L6.352 5.648a1.205 1.205 0 0 0 0 1.704L9.5 10.5m7-3L19 5m-1.5 5.5l3.148 3.148a1.205 1.205 0 0 1 0 1.704l-2.296 2.296a1.205 1.205 0 0 1-1.704 0L13.5 14.5M9 21a6 6 0 0 0-6-6\"/><path d=\"M9.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l4.296-4.296a1.205 1.205 0 0 0 0-1.704l-2.296-2.296a1.205 1.205 0 0 0-1.704 0z\"/></g>","telescope":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m10.065 12.493l-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44m-2.875 6.493l4.332-.924M16 21l-3.105-6.21\"/><path d=\"M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455zM6.158 8.633l1.114 4.456M8 21l3.105-6.21\"/><circle cx=\"12\" cy=\"13\" r=\"2\"/></g>","magnet":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m12 15l4 4M2.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.029-6.029a1 1 0 1 1 3 3l-6.029 6.029a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.365-6.367A1 1 0 0 0 8.716 4.282zM5 8l4 4\"/>","fuel":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5m-4 16V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16m-1 0h13M3 9h11\"/>","gauge":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m12 14l4-4M3.34 19a10 10 0 1 1 17.32 0\"/>","circle-dot":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"1\"/><circle cx=\"12\" cy=\"12\" r=\"10\"/></g>","focus":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M3 7V5a2 2 0 0 1 2-2h2m10 0h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2\"/></g>","bot":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12 8V4H8\"/><rect width=\"16\" height=\"12\" x=\"4\" y=\"8\" rx=\"2\"/><path d=\"M2 14h2m16 0h2m-7-1v2m-6-2v2\"/></g>","sparkle":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\"/>","wand-sparkles":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m21.64 3.64l-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72M14 7l3 3M5 6v4m14 4v4M10 2v2M7 8H3m18 8h-4M11 3H9\"/>","message-circle":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092a10 10 0 1 0-4.777-4.719\"/>","message-square":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z\"/>","mail-open":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0z\"/><path d=\"m22 10l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10\"/></g>","folder-git-2":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M18 19a5 5 0 0 1-5-5v8\"/><path d=\"M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v5\"/><circle cx=\"13\" cy=\"12\" r=\"2\"/><circle cx=\"20\" cy=\"19\" r=\"2\"/></g>","git-fork":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><circle cx=\"12\" cy=\"18\" r=\"3\"/><circle cx=\"6\" cy=\"6\" r=\"3\"/><circle cx=\"18\" cy=\"6\" r=\"3\"/><path d=\"M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9m6 3v3\"/></g>","git-merge-conflict":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M12 6h4a2 2 0 0 1 2 2v7M6 12v9M8.5 3.5l-5 5m5 0l-5-5\"/><circle cx=\"18\" cy=\"18\" r=\"3\"/></g>","file-code":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\"/><path d=\"M14 2v5a1 1 0 0 0 1 1h5m-10 4.5L8 15l2 2.5m4-5l2 2.5l-2 2.5\"/></g>","file-json":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\"/><path d=\"M14 2v4a2 2 0 0 0 2 2h4m-10 4a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1a1 1 0 0 1 1 1v1a1 1 0 0 0 1 1m4 0a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1a1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1\"/></g>","file-lock":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M4 9.8V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2h-3\"/><path d=\"M14 2v5a1 1 0 0 0 1 1h5M9 17v-2a2 2 0 0 0-4 0v2\"/><rect width=\"8\" height=\"5\" x=\"3\" y=\"17\" rx=\"1\"/></g>","folder-lock":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><rect width=\"8\" height=\"5\" x=\"14\" y=\"17\" rx=\"1\"/><path d=\"M10 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v2.5\"/><path d=\"M20 17v-2a2 2 0 1 0-4 0v2\"/></g>","braces":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2a2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1m8 0h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1\"/>","square-code":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m10 9l-3 3l3 3m4 0l3-3l-3-3\"/><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/></g>","code-xml":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"m18 16l4-4l-4-4M6 8l-4 4l4 4m8.5-12l-5 16\"/>"}
    /** Chinese/English search terms -> icon names for {@link ICON_SET}. */
    const ICON_KEYWORDS = {"用户":["user","users","user-plus"],"文件":["file","file-text","file-plus","file-code","file-json"],"文件夹":["folder","folder-open","folder-plus","folder-git-2"],"星":["star"],"心":["heart"],"设置":["settings","cog","sliders-horizontal"],"搜索":["search"],"首页":["house"],"房子":["house"],"邮件":["mail","mail-open","inbox"],"日历":["calendar","calendar-days"],"时钟":["clock","timer","alarm-clock"],"时间":["clock"],"完成":["check","check-check","circle-check"],"对勾":["check","check-check"],"关闭":["x","circle-x"],"加":["plus"],"新增":["plus"],"减":["minus"],"删除":["trash"],"编辑":["pencil","pen","pen-tool"],"下载":["download"],"上传":["upload"],"云":["cloud","cloud-upload","cloud-download"],"数据库":["database","hard-drive"],"服务器":["server"],"代码":["code","square-code","code-xml","braces"],"终端":["terminal"],"调试":["bug"],"测试":["test-tube","flask-conical","microscope"],"书":["book","book-open","library"],"想法":["lightbulb","sparkles"],"灯泡":["lightbulb"],"目标":["target","crosshair","focus"],"旗":["flag"],"标签":["tag","tags"],"颜色":["palette","brush","paintbrush"],"调色板":["palette"],"图片":["image","images"],"视频":["video"],"音乐":["music"],"相机":["camera"],"手机":["smartphone"],"电脑":["monitor","laptop"],"网络":["wifi","network","signal","router"],"锁":["lock"],"钥匙":["key"],"安全":["shield","shield-check"],"警告":["triangle-alert","circle-alert"],"信息":["info"],"刷新":["refresh-cw","refresh-ccw","rotate-cw"],"包裹":["package","box","boxes"],"图层":["layers"],"网格":["layout-grid","grid-2x2"],"列表":["list","list-checks","layout-list"],"图表":["chart-bar","chart-line","chart-pie","trending-up"],"钱":["dollar-sign","credit-card","wallet","receipt"],"购物":["shopping-cart","shopping-bag","store"],"礼物":["gift"],"咖啡":["coffee"],"太阳":["sun","sunrise","sunset"],"月亮":["moon"],"水滴":["droplet"],"火":["flame"],"叶子":["leaf","sprout","flower-2"],"地球":["globe","earth"],"地图":["map","map-pin"],"飞机":["plane"],"汽车":["car"],"剪贴板":["clipboard","clipboard-check","clipboard-list"],"存档":["archive"],"发送":["send"],"分享":["share","share-2"],"链接":["link","link-2","external-link"],"复制":["copy"],"保存":["save"],"打印机":["printer"],"剪刀":["scissors"],"扳手":["wrench"],"锤子":["hammer"],"硬盘":["hard-drive"],"电池":["battery"],"电源":["power"],"闪电":["zap"],"眼睛":["eye","eye-off"],"微笑":["smile","smile-plus"],"大脑":["brain"],"火箭":["rocket"],"奖杯":["trophy","award"],"通知":["bell","bell-off"],"机器人":["bot"],"魔法":["wand-sparkles","sparkles"],"扫描":["scan","qr-code"],"消息":["message-circle","message-square"]}

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

    /** Whether a stored icon value is one of our Lucide icons. */
    function isLucideValue(value) {
      return typeof value === 'string'
        && value.startsWith(ICON_PREFIX)
        && ICON_SET[value.slice(ICON_PREFIX.length)] !== undefined
    }

    /** Standalone SVG markup for one Lucide icon. */
    function svgMarkup(name, size) {
      const body = ICON_SET[name]
      if (body === undefined) return ''
      const px = Math.round(size)
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24" fill="none">${body}</svg>`
    }

    /** Filter the icon set by name or by a Chinese/English keyword. */
    function searchIcons(query) {
      const all = Object.keys(ICON_SET)
      const q = String(query || '').trim().toLowerCase()
      if (q === '') return all.slice(0, 64)
      const found = new Set()
      for (const term of Object.keys(ICON_KEYWORDS)) {
        if (q.includes(term) || term.includes(q)) {
          for (const name of ICON_KEYWORDS[term]) if (ICON_SET[name] !== undefined) found.add(name)
        }
      }
      for (const name of all) if (name.includes(q)) found.add(name)
      return [...found].slice(0, 80)
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
        '.dsh-srt-icongrid{display:grid;grid-template-columns:repeat(8,1fr);gap:4px;max-height:172px;overflow:auto;padding:2px;margin-bottom:12px;border-radius:10px;background:rgba(0,0,0,.02)}',
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

    /** One icon value rendered at `size`: Lucide SVG or an emoji/text glyph. */
    function iconElement(value, size, color) {
      if (isLucideValue(value)) {
        return h('span', {
          className: 'dsh-srt-svg',
          style: { display: 'inline-flex', color: color || 'currentColor' },
          dangerouslySetInnerHTML: { __html: svgMarkup(value.slice(ICON_PREFIX.length), size) },
        })
      }
      return h('span', { className: 'dsh-srt-glyph', style: { fontSize: `${size}px`, lineHeight: 1 } }, value)
    }

    function RowTintLayer() {
      const [decorations, setDecorations] = React.useState({ workspaces: {}, sessions: {} })
      const [picker, setPicker] = React.useState(null)
      const [layer, setLayer] = React.useState({ items: [], icons: [], clip: 'none', zIndex: 1 })
      const decorationsRef = React.useRef(decorations)
      decorationsRef.current = decorations
      const followRef = React.useRef(() => {})
      const openPickerRef = React.useRef(() => {})

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

          // Individual Session rows: title colour + optional icon.
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
            // row only gains a `*menuOpen` class while its menu is open. So find
            // the open row for the target id, and append into the portal's list.
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
            if (svg !== null && ICON_SET.palette !== undefined) {
              svg.setAttribute('viewBox', '0 0 24 24')
              svg.innerHTML = ICON_SET.palette
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
        // Registered before DSH's own menu listeners, and in the capture phase,
        // so our item is handled before the menu unmounts on pointerdown.
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

      React.useEffect(() => { followRef.current() }, [decorations])

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
      const iconEls = layer.icons.map((icon) => h('span', {
        key: icon.key,
        className: 'dsh-srt-icon',
        style: { left: `${icon.left}px`, top: `${icon.top}px`, width: `${icon.width}px`, height: `${icon.height}px` },
      }, iconElement(icon.value, Math.min(18, Math.max(12, Math.round(icon.height) || 16)), icon.color)))

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
          className: 'dsh-srt-search', type: 'search', placeholder: '搜索图标（如 rocket / 用户 / 文件）',
          value: picker.query,
          onChange: (event) => setPicker({ ...picker, query: event.target.value }),
        }),
        h('div', { className: 'dsh-srt-icongrid' },
          iconResults.length === 0
            ? h('div', { className: 'dsh-srt-empty' }, '没有匹配的图标')
            : iconResults.map((name) => h('button', {
              key: name,
              type: 'button',
              className: `dsh-srt-iconbtn${picker.icon === ICON_PREFIX + name ? ' is-sel' : ''}`,
              title: name,
              'aria-label': `使用图标 ${name}`,
              onClick: () => applyIcon(ICON_PREFIX + name),
              dangerouslySetInnerHTML: { __html: svgMarkup(name, 18) },
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

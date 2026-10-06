// Geometry as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units, the long side grows).
// Drawing (view.js), hit-testing (game.js) and the text screens (screens.js) all read the same rectangles from here, so what you
// see is exactly what you tap. `setView(w, h)` is called by the game every frame and on every resize; every function below is a pure
// function of (view size, host insets, text zoom) and is cached by that key.
//
// Shapes:
//   portrait  (taller than wide): the approved phone look. Shorter portrait screens (tablets, 4:3) switch to a single row of tools.
//   landscape, compact  (usable width < 1180 units, e.g. iPad 4:3): one control column on the left, the board takes the rest.
//   landscape, wide  (phones turned sideways, 16:9 and wider): a left column (back, pause, name, live picture, status), the board in
//                     the middle, a right column (clue readout and the eight tools).
import { tw } from './ui.js';
import { SZ } from './art.js';

export const SCREEN = { width: 720, height: 1560 };   // the reference phone size (tests and shots use it as the default view)
export const inRect = (x, y, r) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R = (x, y, w, h) => ({ x, y, w, h });

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit, so text and tap targets can be kept above a minimum real size.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

let VW = SCREEN.width, VH = SCREEN.height;
export function setView(w, h) {
  w = Math.round(w); h = Math.round(h);
  if (!(w > 0 && h > 0)) return;
  VW = w; VH = h; SZ.w = w; SZ.h = h;
}
export const viewSize = () => ({ w: VW, h: VH });

const memo = new Map();
const key = (tag, ...more) => `${tag}|${VW}x${VH}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${host.px.toFixed(2)}|${more.join(',')}`;
function cached(tag, more, build) {
  const k = key(tag, ...more);
  let v = memo.get(k);
  if (!v) { v = build(); memo.set(k, v); if (memo.size > 120) memo.delete(memo.keys().next().value); }
  return v;
}

// The usable frame: margins that clear the notch, home indicator and cutouts.
function frame() {
  const land = VW > VH;
  const side = land ? 16 : 24;
  const xl = Math.max(side, host.l + 12), xr = VW - Math.max(side, host.r + 12);
  const top = Math.max(land ? 16 : 22, host.t + 8), bot = VH - Math.max(land ? 16 : 24, host.b + 10);
  const backBox = host.back ? Math.max(host.back, 56) + 8 : 0;   // the host's floating back button, top-left, when the shell draws one
  return { land, xl, xr, top, bot, iw: xr - xl, backBox, wide: land && xr - xl >= 1180 };
}
export const isLandscape = () => VW > VH;

// ---------------------------------------------------------------------------------------------- play
export const TOOL_IDS = ['fill', 'cross', 'move', 'zoom', 'undo', 'redo', 'think', 'check'];

const twoCols = (x, y, w, rowH, gap = 8) => TOOL_IDS.map((id, i) => ({ id, x: x + (i % 2) * ((w - gap) / 2 + gap), y: y + Math.floor(i / 2) * (rowH + gap), w: (w - gap) / 2, h: rowH }));

export function playLayout(scale) {
  return cached('play', [scale], () => {
    const F = frame(), k = clamp((scale - 1) / 2, 0, 1);
    const hudH = Math.max(Math.round(78 + 36 * k), Math.round(42 / Math.max(0.3, host.px))), bw = Math.round(84 + 20 * k);
    const ah = Math.round(62 + 20 * k), aw = Math.round(176 + 40 * k);
    let L;
    if (!F.land) {
      const rows = VH < 1200 ? 1 : 2;
      const hx0 = Math.max(16, host.l + 8) + F.backBox, hx1 = VW - Math.max(16, host.r + 8);
      const hud = { h: hudH, k, back: R(hx0, F.top, bw, hudH), pause: R(hx1 - bw, F.top, bw, hudH) };
      hud.name = R(hx0 + bw + 12, F.top, hx1 - bw - 12 - (hx0 + bw + 12), hudH);
      let focusH = rows === 1 ? Math.round(84 + 110 * k) : Math.round(104 + 150 * k);
      let statusH = rows === 1 ? Math.round(120 + 100 * k) : Math.round(150 + 110 * k);
      const toolH = rows === 1 ? Math.round(80 + 28 * k) : Math.round(104 + 44 * k);
      const fy = F.top + hudH + 12;
      const toolsTop = rows === 1 ? F.bot - toolH : F.bot - 2 * toolH - 10;
      const areaH = () => toolsTop - 14 - statusH - 10 - (fy + focusH + 10);
      for (let i = 0; i < 10 && areaH() < Math.max(300, VH * 0.36); i++) { focusH = Math.max(72, Math.round(focusH * 0.9)); statusH = Math.max(96, Math.round(statusH * 0.9)); }
      const focus = R(F.xl, fy, F.iw, focusH), status = R(F.xl, toolsTop - 14 - statusH, F.iw, statusH);
      const ay = fy + focusH + 10;
      const area = R(F.xl, ay, F.iw, status.y - 10 - ay);
      const n = rows === 1 ? 8 : 4, tg = rows === 1 ? 8 : 12, tbw = (F.iw - (n - 1) * tg) / n;
      const tools = TOOL_IDS.map((id, i) => ({ id, x: F.xl + (i % n) * (tbw + tg), y: rows === 1 ? toolsTop : toolsTop + Math.floor(i / 4) * (toolH + 10), w: tbw, h: toolH }));
      L = { mode: 'port', focus, status, area, tools, toolH, hud, preview: null, applyBelow: false, apply: R(status.x + status.w - aw - 12, status.y + (statusH - ah) / 2, aw, ah) };
    } else {
      const colW = F.wide ? 262 : 312;
      const T = F.backBox ? Math.max(F.top, host.t + F.backBox) : F.top, B = F.bot, avail = B - T;
      if (F.wide) {
        const hw = (colW - 10) / 2;
        const hud = { h: hudH, k, back: R(F.xl, T, hw, hudH), pause: R(F.xl + hw + 10, T, hw, hudH) };
        const nameH = Math.round(64 + 24 * k);
        hud.name = R(F.xl, T + hudH + 10, colW, nameH);
        const y1 = hud.name.y + nameH + 10;
        const statusMin = 170;
        const pv = clamp(B - y1 - 10 - 250, 110, 200);
        const preview = R(F.xl + (colW - pv) / 2, y1, pv, pv);
        const sy = y1 + pv + 10, status = R(F.xl, sy, colW, Math.max(80, B - sy));
        const rx = F.xr - colW;
        const focusH = Math.max(96, Math.round(avail * 0.27));
        const focus = R(rx, T, colW, focusH);
        const ty = T + focusH + 10, rowH = clamp(Math.floor((B - ty - 24) / 4), 44, 112);
        const tools = twoCols(rx, ty, colW, rowH);
        const area = R(F.xl + colW + 12, F.top, rx - 12 - (F.xl + colW + 12), B - F.top);
        L = { mode: 'wide', focus, status, area, tools, toolH: rowH, hud, preview, applyBelow: true, apply: R(status.x + 12, status.y + status.h - ah - 12, status.w - 24, ah), col: colW };
      } else {
        const hud = { h: hudH, k, back: R(F.xl, T, bw, hudH), pause: R(F.xl + bw + 10, T, bw, hudH) };
        const pvS = Math.min(hudH, colW - (2 * bw + 20) - 10);
        const preview = pvS >= 56 ? R(F.xl + colW - pvS, T + (hudH - pvS) / 2, pvS, pvS) : null;
        const nameH = B - T < 600 ? 0 : Math.round(56 + 26 * k);   // very short screens: the picture name gives its room to the tools
        hud.name = R(F.xl, T + hudH + 10, colW, nameH);
        let rowH = Math.min(76, Math.max(Math.round(52 + 14 * k), Math.round(34 / Math.max(0.3, host.px)))), toolsH = 4 * rowH + 24;
        const y1 = hud.name.y + (nameH ? nameH + 10 : 0);
        if (B - toolsH - 10 - y1 < 150) { rowH = Math.max(40, Math.floor((B - y1 - 10 - 150 - 24) / 4)); toolsH = 4 * rowH + 24; }
        const toolsTop = B - toolsH, room = Math.max(0, toolsTop - 10 - y1);
        const focusH = room >= 150 ? Math.round((room - 10) * 0.36) : 0, statusH = focusH ? room - 10 - focusH : room;
        const focus = R(F.xl, y1, colW, focusH), status = R(F.xl, y1 + (focusH ? focusH + 10 : 0), colW, statusH);
        const tools = twoCols(F.xl, toolsTop, colW, rowH);
        const ax = F.xl + colW + 12;
        L = { mode: 'compact', focus, status, area: R(ax, F.top, F.xr - ax, B - F.top), tools, toolH: rowH, hud, preview, applyBelow: true, apply: R(status.x + 12, status.y + status.h - ah - 10, status.w - 24, ah), col: colW };
      }
    }
    L.hintShort = L.status.h < 140 || (L.applyBelow && L.status.h < 215);
    L.applyBtn = L.apply; L.k = k; L.land = F.land; L.name = L.hud.name;
    return L;
  });
}
// true when the reason for a hint opens in the big "Why?" card instead of inline (large text, or a status panel too small to hold it)
export const hintWhy = (scale) => scale >= 2 || playLayout(scale).hintShort;
export const hudOf = (scale) => playLayout(scale).hud;

// ---------------------------------------------------------------------------------------------- Watch & Learn
export function autoLayout(scale) {
  return cached('auto', [scale], () => {
    const F = frame(), k = clamp((scale - 1) / 2, 0, 1);
    const hudH = Math.max(Math.round(78 + 36 * k), Math.round(42 / Math.max(0.3, host.px))), bw = Math.round(84 + 20 * k);
    if (!F.land) {
      const compact = VH < 1200;
      const hx0 = Math.max(16, host.l + 8) + F.backBox, hx1 = VW - Math.max(16, host.r + 8);
      const hud = { h: hudH, k, back: R(hx0, F.top, bw, hudH), pause: R(hx1 - bw, F.top, bw, hudH) };
      hud.name = R(hx0 + bw + 12, F.top, hx1 - bw - 12 - (hx0 + bw + 12), hudH);
      const h = Math.round((compact ? 92 : 112) + (compact ? 50 : 74) * k), y = F.bot - h;
      let statusH = compact ? Math.round(130 + 120 * k) : Math.round(190 + 170 * k);
      let fh = compact ? Math.round(70 + 50 * k) : Math.round(84 + 60 * k);
      const fy = F.top + hudH + 12;
      const areaH = () => (y - 52 - statusH) - 10 - (fy + fh + 10);
      for (let i = 0; i < 10 && areaH() < Math.max(300, VH * 0.34); i++) { statusH = Math.max(96, Math.round(statusH * 0.9)); fh = Math.max(60, Math.round(fh * 0.9)); }
      const status = R(F.xl, y - 52 - statusH, F.iw, statusH), focus = R(F.xl, fy, F.iw, fh);
      const ay = focus.y + focus.h + 10;
      const midW = F.iw - 2 * 160 - 32;
      return { mode: 'port', hud, name: hud.name, slower: R(F.xl, y, 160, h), pause: R(F.xl + 176, y, midW, h), faster: R(F.xr - 160, y, 160, h), labelY: y - 18, status, focus, area: R(F.xl, ay, F.iw, status.y - 10 - ay), preview: null, k, land: false };
    }
    const colW = F.wide ? 262 : 312;
    const T = F.backBox ? Math.max(F.top, host.t + F.backBox) : F.top, B = F.bot;
    const hud = { h: hudH, k, back: R(F.xl, T, bw, hudH), pause: R(-999, -999, 0, 0) };
    hud.name = R(F.xl + bw + 10, T, colW - bw - 10, hudH);
    const y1 = T + hudH + 10;
    if (F.wide) {
      const rx = F.xr - colW, ch = Math.round(110 + 20 * k);
      const room = B - y1 - 10, fh = Math.max(70, Math.round(room * 0.3));
      const focus = R(F.xl, y1, colW, fh), status = R(F.xl, y1 + fh + 10, colW, Math.max(90, B - (y1 + fh + 10)));
      const cy = (T + B) / 2;
      const labelY = cy - ch / 2 - 40;
      const pause = R(rx, cy - ch / 2 - 4, colW, ch), sh = Math.round(80 + 14 * k);
      const slower = R(rx, pause.y + ch + 12, (colW - 10) / 2, sh), faster = R(rx + (colW - 10) / 2 + 10, pause.y + ch + 12, (colW - 10) / 2, sh);
      return { mode: 'wide', hud, name: hud.name, slower, pause, faster, labelY, status, focus, area: R(F.xl + colW + 12, F.top, rx - 12 - (F.xl + colW + 12), B - F.top), preview: null, k, land: true };
    }
    const ch = Math.round(84 + 20 * k);
    const cy = B - ch;
    const gap = 8, sw = Math.round((colW - 2 * gap) * 0.3), pw = colW - 2 * gap - 2 * sw;
    const room = cy - 34 - y1, fh = Math.max(64, Math.round((room - 10) * 0.3));
    const focus = R(F.xl, y1, colW, fh), status = R(F.xl, y1 + fh + 10, colW, Math.max(80, room - 10 - fh));
    const ax = F.xl + colW + 12;
    return { mode: 'compact', hud, name: hud.name, slower: R(F.xl, cy, sw, ch), pause: R(F.xl + sw + gap, cy, pw, ch), faster: R(F.xl + sw + pw + 2 * gap, cy, sw, ch), labelY: cy - 10, status, focus, area: R(ax, F.top, F.xr - ax, B - F.top), preview: null, k, land: true };
  });
}

// ---------------------------------------------------------------------------------------------- the board: clue panels, the grid, zoom and pan
const clueFont = (s, scale) => Math.max(15, Math.min(s * 0.5 * Math.min(scale, 1.5), 48));
const cache = new Map();

function extents(puz, s, scale) {
  const f = clueFont(s, scale), gap = f * 0.44, pad = Math.max(8, f * 0.32), lh = f * 1.16;
  let rw = 0;
  for (const c of puz.rows) {
    let w = 0;
    (c.length ? c : [0]).forEach((n, i) => { w += tw(String(n), f) + (i ? gap : 0); });
    rw = Math.max(rw, w);
  }
  const cmax = Math.max(...puz.cols.map((c) => Math.max(1, c.length)));
  return { f, gap, pad, lh, rowW: rw + pad * 2, colH: cmax * lh + pad * 2 };
}

// The size (units) a square needs to be a comfortable fingertip target on this screen: about 32 css px.
export const closeTarget = () => clamp(Math.round(32 / Math.max(0.3, host.px)), 36, 64);
// A fit view with squares smaller than this opens zoomed in: about 24 css px is the smallest tappable square.
export const fitMin = () => clamp(Math.round(24 / Math.max(0.3, host.px)), 34, 56);

// zoom: 'fit' shows the whole board when it can; 'close' makes the squares big enough for a fingertip and scrolls.
export function boardGeo(puz, area, scale, zoom = 'fit', ox = 0, oy = 0) {
  area = { x: area.x + 12, y: area.y + 12, w: area.w - 24, h: area.h - 24 };   // the paper card reaches 12 units beyond the squares
  const ct = closeTarget();
  const key2 = `${puz.id}|${area.w}x${area.h}|${scale}|${ct}`;
  let base = cache.get(key2);
  if (!base) {
    let fitS = 12;
    for (let s = Math.min(112, Math.floor(area.w / (puz.w + 1))); s >= 12; s--) {
      const e = extents(puz, s, scale);
      if (e.rowW + puz.w * s <= area.w && e.colH + puz.h * s <= area.h) { fitS = s; break; }
    }
    const closeS = fitS >= ct - 4 ? fitS : ct;
    base = { fitS, closeS, fit: extents(puz, fitS, scale), close: extents(puz, closeS, scale) };
    if (cache.size > 80) cache.clear();
    cache.set(key2, base);
  }
  const canZoom = base.closeS > base.fitS;
  const mode = canZoom && zoom === 'close' ? 'close' : 'fit';
  const s = mode === 'close' ? base.closeS : base.fitS;
  const e = mode === 'close' ? base.close : base.fit;
  const gridW = puz.w * s, gridH = puz.h * s;
  const viewW = Math.max(40, Math.min(gridW, area.w - e.rowW)), viewH = Math.max(40, Math.min(gridH, area.h - e.colH));
  const bx = area.x + (area.w - (e.rowW + viewW)) / 2, by = area.y + (area.h - (e.colH + viewH)) / 2;
  const maxX = Math.max(0, gridW - viewW), maxY = Math.max(0, gridH - viewH);
  const px = clamp(ox, 0, maxX), py = clamp(oy, 0, maxY);
  const view = { x: bx + e.rowW, y: by + e.colH, w: viewW, h: viewH };
  return {
    s, f: e.f, gap: e.gap, pad: e.pad, lh: e.lh, rowW: e.rowW, colH: e.colH, mode, canZoom, fitS: base.fitS, gridW, gridH, view, maxX, maxY, ox: px, oy: py,
    card: { x: bx - 12, y: by - 12, w: e.rowW + viewW + 24, h: e.colH + viewH + 24 },
    rowPanel: { x: bx, y: view.y, w: e.rowW, h: viewH }, colPanel: { x: view.x, y: by, w: viewW, h: e.colH },
  };
}

// The cell under (x, y); clamped=true pulls points outside the grid onto the nearest edge cell.
export function cellAt(puz, g, x, y, clamped = false) {
  const cx = (x - g.view.x + g.ox) / g.s, cy = (y - g.view.y + g.oy) / g.s;
  if (!clamped && (x < g.view.x || x > g.view.x + g.view.w || y < g.view.y || y > g.view.y + g.view.h)) return null;
  return { c: clamp(Math.floor(cx), 0, puz.w - 1), r: clamp(Math.floor(cy), 0, puz.h - 1) };
}
// Pans so that cell (c, r) sits inside the view (used by Think and Watch & Learn).
export function panTo(puz, g, c, r) {
  let { ox, oy } = g;
  const x0 = c * g.s, y0 = r * g.s;
  if (x0 < ox) ox = x0 - g.s; else if (x0 + g.s > ox + g.view.w) ox = x0 + 2 * g.s - g.view.w;
  if (y0 < oy) oy = y0 - g.s; else if (y0 + g.s > oy + g.view.h) oy = y0 + 2 * g.s - g.view.h;
  return { ox: clamp(ox, 0, g.maxX), oy: clamp(oy, 0, g.maxY) };
}

// ---------------------------------------------------------------------------------------------- document screens
export function docRects() {
  return cached('doc', [], () => {
    const F = frame();
    const pw = F.land ? Math.min(F.iw, 920) : F.iw;
    const px0 = Math.round((VW - pw) / 2);
    const barY = Math.max(20, host.t + 8), barH = 76;
    const right = px0 + pw + 8;
    const back = R(Math.max(px0 - 8, host.back ? host.l + F.backBox : 0), barY, 140, barH);
    const inc = R(right - 84, barY, 84, barH), pct = R(right - 84 - 140, barY, 140, barH), dec = R(right - 84 - 140 - 84, barY, 84, barH);
    const navH = 84, navY = F.land ? F.bot - navH : VH - Math.max(26, host.b + 10) - navH;
    const py = barY + barH + 16;
    const panelBottom = F.land ? navY - 12 : navY - 16;
    const panel = R(px0, py, pw, panelBottom - py);
    const panelFull = F.land ? R(px0, py, pw, F.bot - py) : panel;
    const inner = (p) => R(p.x + 24, p.y + 24, p.w - 48, p.h - 48);
    return {
      land: F.land, back, dec, inc, pct, panel, panelFull, body: inner(panelFull), bodyNav: inner(panel),
      navPrev: R(px0, navY, 210, navH), navNext: R(px0 + pw - 210, navY, 210, navH), navLabelY: navY + navH / 2 + 9, navMid: px0 + pw / 2, navWide: R(px0, navY, pw, navH),
    };
  });
}

// ---------------------------------------------------------------------------------------------- title screen
// The tap zone of the title lockup: the lockup padded to at least 44 x 44 css px.
export function lockupHit(T) {
  const m = 44 / Math.max(0.3, host.px), pw = Math.max(T.lockup.w, m), ph = Math.max(T.lockup.h, m);
  return R(T.lockup.x - pw / 2, T.lockup.y + T.lockup.h / 2 - ph / 2, pw, ph);
}
export function titleRects() {
  return cached('title', [], () => {
    const F = frame();
    if (!F.land) {
      const base = Math.max(172, host.t + 150) - (VH < 1200 ? 30 : 0);
      const artH = VH < 1050 ? 0 : Math.round(clamp(VH * 0.231, 190, 360));   // very short portrait screens (4:3 tablets): no attract board, the menu needs the room
      const lw = 250, lh = Math.round(lw * 327 / 1200);
      const art = R(Math.round((VW - 440) / 2), base + 90, 440, artH);
      if (!artH) art.y = base + 70;
      const lockup = { x: VW / 2, y: F.bot - lh - 4, w: lw, h: lh };
      const ry = art.y + art.h + (artH ? 18 : 0);
      const lim = host.l + F.backBox + 14, hit = F.backBox && base - 90 < host.t + F.backBox;   // the title clears the host back button
      return { land: false, cx: VW / 2, tcx: VW / 2, base, tagY: base + 60, titleW: hit ? Math.min(F.iw, 2 * (VW / 2 - lim) + 40) : F.iw, art, lockup, region: R(F.xl, ry, F.iw, lockup.y - 10 - ry) };
    }
    const leftW = clamp(Math.round(F.iw * 0.44), 380, 700), cx = F.xl + leftW / 2;
    const base = F.top + 96, lw = 250, lh = Math.round(lw * 327 / 1200);
    const mx0 = F.xl + leftW + 24, mw = Math.min(640, F.xr - mx0), mx = mx0 + (F.xr - mx0 - mw) / 2;
    const lockup = { x: mx + mw / 2, y: F.bot - lh - 4, w: lw, h: lh };   // under the menu column, pinned outside its scroll region
    const ay = base + 76, art = R(cx - Math.min(leftW - 10, 560) / 2, ay, Math.min(leftW - 10, 560), Math.max(150, F.bot - 14 - ay));
    const lim = host.l + F.backBox + 14, hit = F.backBox && base - 90 < host.t + F.backBox && cx - leftW / 2 < lim, tx1 = F.xl + leftW;
    return { land: true, cx, tcx: hit ? (lim + tx1) / 2 : cx, base, tagY: base + 48, titleW: hit ? tx1 - lim + 40 : leftW, art, lockup, region: R(mx, F.top, mw, lockup.y - 10 - F.top) };
  });
}

// ---------------------------------------------------------------------------------------------- overlays and cards
// kind: 'card' (centred), 'end' (result: the bottom of a portrait screen, the left side of a landscape one).
export function cardFrame(kind = 'card') {
  const F = frame();
  if (!F.land) return { land: false, x: Math.round((VW - 620) / 2), w: 620, y0: F.top, y1: F.bot, bottom: kind === 'end', side: false };
  if (kind === 'end') return { land: true, x: F.xl, w: 380, y0: F.top, y1: F.bot, bottom: false, side: true };
  const w = Math.min(760, F.iw);
  return { land: true, x: Math.round((VW - w) / 2), w, y0: F.top, y1: F.bot, bottom: false, side: false };
}
// The rectangle the finished picture settles into during the reveal (it stays visible beside / above the result card).
export function revealRect(area) {
  if (VW <= VH) {
    const side = Math.min(area.w - 60, 540);
    return { side, fx: area.x + area.w / 2 - side / 2, fy: Math.max(area.y, 140) + 6, nameY: Math.max(area.y, 140) + 6 + side + 64 };
  }
  const card = cardFrame('end');
  const x0 = Math.max(area.x, card.x + card.w + 12), x1 = area.x + area.w;
  const side = Math.max(120, Math.min(x1 - x0 - 20, area.h - 110, 620));
  const fy = area.y + (area.h - side - 76) / 2;
  return { side, fx: (x0 + x1) / 2 - side / 2, fy, nameY: fy + side + 60 };
}

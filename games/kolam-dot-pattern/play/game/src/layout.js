// Screen geometry as a function of the LIVE size (kit 1.7.x fluid viewport: the short side is always 720 units, the long side follows the
// screen). Pure data: drawing (view.js) and hit-testing (game.js) read the same rectangles. `setScreen(w, h)` is called every frame with
// meta.width/height; every function below reads that size plus the host insets, and results are cached by size key.
//   portrait  tall phone (h >= ~1500): the approved phone look, unchanged. Shorter portrait screens (tablets, SE) squeeze the bars so the
//             board keeps its room.
//   wide      landscape (and squarish windows): the board takes the left, as large as the height allows; a side panel on the right holds
//             the buttons, the pattern name, the progress and the hint text.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const inRect = (x, y, r) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const R = (x, y, w, h) => ({ x, y, w, h });
const lerp = (a, b, t) => a + (b - a) * t;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // px: css pixels per virtual unit (text never shrinks below ~11 css px)
export const screen = { w: 720, h: 1560 };
export function setScreen(w, h) { if (w > 0 && h > 0) { screen.w = w; screen.h = h; } }
// controls stay about 44 css px tall where the screen allows (narrow phones scale the 720-unit width down)
export const tapMin = (v) => Math.max(v, Math.min(Math.ceil(44 / (host.px || 0.6)), v + 24));
export const minText = () => Math.max(12, 11 / (host.px || 0.6));   // smallest type (units) that is still ~11 css px

export const TOOL_IDS = ['undo', 'clear', 'think', 'guide'];
export const SB_TOOLS = ['sbDraw', 'sbMirror', 'sbGrid', 'sbWeave', 'sbUndo', 'sbClear'];

let cache = null, cacheKey = '';
function G() {
  const { w, h } = screen;
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  if (cache && key === cacheKey) return cache;
  const wide = h <= w * 1.1;
  const U = { x0: host.l, y0: host.t, x1: w - host.r, y1: h - host.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const bs = host.back ? Math.max(host.back, 56) : 0;
  const backBox = host.back ? R(host.l, host.t, bs + 8, bs + 8) : R(0, 0, 0, 0);
  const tall = clamp((h - 900) / (1560 - 900), 0, 1);
  let side = null;                                    // wide: the side panel (x from sx, width sw) next to the board
  if (wide) {
    const strip = host.back ? Math.round(bs + 16) : 0;
    const sw = clamp(U.w - (U.h - 24) - 36 - strip, 270, 520);
    side = { x: U.x1 - 12 - sw, w: sw, strip, y0: U.y0 + 12, y1: U.y1 - 12 };
  }
  cache = { w, h, wide, U, bs, backBox, tall, side };
  cacheKey = key;
  return cache;
}
export const isWide = () => G().wide;
export const frame = () => G();

// ---------------------------------------------------------------------------------------------------------------- play HUD
export function hudOf(scale) {
  const g = G(), k = clamp((scale - 1) / 2, 0, 1);
  if (g.wide) {
    const s = g.side, hh = Math.round(80 + 6 * k), hw = Math.round((s.w - 12) / 2);
    const name = R(s.x, s.y0 + hh + 8, s.w, Math.round(78 + 6 * k));
    return { h: hh, k, back: R(s.x, s.y0, hw, hh), pause: R(s.x + s.w - hw, s.y0, hw, hh), name, bottom: name.y + name.h };
  }
  const h = Math.max(tapMin(78), Math.round(78 + 36 * k)), bw = Math.round(84 + 20 * k), y = Math.max(22, host.t + 10);
  const bx = g.backBox.w ? Math.max(g.U.x0 + 16, g.backBox.x + g.backBox.w + 8) : g.U.x0 + 16;
  const px = g.U.x1 - 16 - bw;
  const bottom = Math.max(y + h, g.backBox.w ? g.backBox.y + g.backBox.h + 4 : 0);                   // the host's floating back button keeps its corner clear
  return { h, k, back: R(bx, y, bw, h), pause: R(px, y, bw, h), name: R(bx + bw + 12, y, px - 12 - (bx + bw + 12), h), bottom };
}

function toolGrid(ids, cols, x, bottom, w, toolH, gap = 12) {
  const bw = (w - (cols - 1) * gap) / cols, rows = Math.ceil(ids.length / cols);
  const top = bottom - rows * toolH - (rows - 1) * 10;
  return { top, tools: ids.map((id, i) => ({ id, x: x + (i % cols) * (bw + gap), y: top + Math.floor(i / cols) * (toolH + 10), w: bw, h: toolH })) };
}

function areaWide(g) {
  const s = g.side, x = g.U.x0 + 12 + s.strip, y = g.U.y0 + 12;
  return R(x, y, s.x - 12 - x, g.U.h - 24);
}

export function playLayout(scale) {
  const g = G(), k = clamp((scale - 1) / 2, 0, 1), hud = hudOf(scale);
  if (g.wide) {
    const s = g.side, toolH = Math.round(84 + 8 * k);
    const { top, tools } = toolGrid(TOOL_IDS, 2, s.x, s.y1, s.w, toolH);
    const focus = R(s.x, hud.bottom + 8, s.w, Math.round(84 + 8 * k));
    const sy = focus.y + focus.h + 8, status = R(s.x, sy, s.w, Math.max(110, top - 10 - sy));
    const ah = Math.round(62 + 6 * k);
    return { focus, status, area: areaWide(g), tools, toolH, applyBtn: R(status.x + 12, status.y + status.h - ah - 12, status.w - 24, ah), applyBottom: true, k, hud };
  }
  const tl = g.tall, kz = k * tl, x = g.U.x0 + 24, W = g.U.w - 48;
  const toolH = Math.round(lerp(86, 100, tl) + 40 * kz), focusH = Math.round(lerp(56, 96, tl) + 150 * kz), statusH = Math.round(lerp(104, 150, tl) + 120 * kz);
  const { top, tools } = toolGrid(TOOL_IDS, 4, x, g.U.y1 - 24, W, toolH);
  const focus = R(x, hud.bottom + 12, W, focusH);
  const status = R(x, top - 14 - statusH, W, statusH);
  const areaY = focus.y + focus.h + 10;
  const ah = Math.min(Math.round(62 + 20 * k), statusH - 20), aw = Math.round(190 + 40 * k);
  return { focus, status, area: R(x, areaY, W, status.y - 10 - areaY), tools, toolH, applyBtn: R(status.x + status.w - aw - 12, status.y + (statusH - ah) / 2, aw, ah), applyBottom: false, k, hud };
}

export function sandboxLayout(scale) {
  const g = G(), k = clamp((scale - 1) / 2, 0, 1), hud = hudOf(scale);
  if (g.wide) {
    const s = g.side, toolH = Math.round(84 + 8 * k);
    const { top, tools } = toolGrid(SB_TOOLS, 3, s.x, s.y1, s.w, toolH, 10);
    const sy = hud.bottom + 8;
    return { hud, tools, toolH, status: R(s.x, sy, s.w, Math.max(120, top - 10 - sy)), area: areaWide(g), k };
  }
  const tl = g.tall, kz = k * tl, x = g.U.x0 + 24, W = g.U.w - 48;
  const toolH = Math.round(lerp(86, 100, tl) + 40 * kz), statusH = Math.round(lerp(84, 96, tl) + 90 * kz);
  const { top, tools } = toolGrid(SB_TOOLS, 3, x, g.U.y1 - 24, W, toolH);
  const status = R(x, top - 14 - statusH, W, statusH);
  const areaY = hud.bottom + 8;
  return { hud, tools, toolH, status, area: R(x, areaY, W, status.y - 10 - areaY), k };
}

export function autoLayout(scale) {
  const g = G(), k = clamp((scale - 1) / 2, 0, 1), hud = hudOf(scale);
  if (g.wide) {
    const s = g.side, bh = tapMin(Math.round(80 + 8 * k)), rh = tapMin(Math.round(76 + 6 * k));
    const pauseY = s.y1 - bh, rowY = pauseY - 10 - rh, labelY = rowY - 12, hw = (s.w - 12) / 2;
    const focus = R(s.x, hud.bottom + 8, s.w, Math.round(84 + 8 * k));
    const sy = focus.y + focus.h + 8;
    return { slower: R(s.x, rowY, hw, rh), faster: R(s.x + hw + 12, rowY, hw, rh), pause: R(s.x, pauseY, s.w, bh), labelY, labelX: s.x + s.w / 2, status: R(s.x, sy, s.w, Math.max(120, labelY - 26 - sy)), focus, area: areaWide(g) };
  }
  const tl = g.tall, kz = k * tl, x = g.U.x0 + 24, W = g.U.w - 48;
  const h = Math.round(lerp(84, 112, tl) + 74 * kz), y = g.U.y1 - 28 - h;
  const statusH = Math.round(lerp(160, 230, tl) + 170 * kz);
  const status = R(x, y - 52 - statusH, W, statusH);
  const focus = R(x, hud.bottom + 12, W, Math.round(lerp(56, 70, tl) + 50 * kz));
  const areaY = focus.y + focus.h + 10, sw = Math.round(W * 0.238), pw = W - 2 * sw - 32;
  return { slower: R(x, y, sw, h), pause: R(x + sw + 16, y, pw, h), faster: R(x + W - sw, y, sw, h), labelY: y - 18, labelX: g.w / 2, status, focus, area: R(x, areaY, W, status.y - 10 - areaY) };
}

// ---------------------------------------------------------------------------------------------------------------- documents
// One framed panel with a header row (Back, text-size stepper) above it and, for paged screens, Prev / Next below it.
export function docRects(withNav = false) {
  const g = G(), U = g.U;
  if (g.wide) {
    // landscape: the controls stand in a column on the left (the width is plentiful, the height is not), the reading panel takes the rest
    const cw = 168, x = U.x0 + 12, top = Math.max(U.y0 + 12, g.backBox.w ? g.backBox.y + g.backBox.h + 4 : 0), hh = tapMin(76);
    const half = (cw - 10) / 2, bottom = U.y1 - 12;
    const back = R(x, top, cw, hh), zoomDec = R(x, top + hh + 10, half, hh), zoomInc = R(x + half + 10, top + hh + 10, half, hh), pct = R(x, top + 2 * hh + 14, cw, 40);
    const nextR = R(x, bottom - hh, cw, hh), prevR = R(x, bottom - 2 * hh - 10, cw, hh);
    const px0 = x + cw + 14, avail = U.x1 - 12 - px0, pw = Math.min(avail, 920), px = px0 + (avail - pw) / 2;
    const panel = R(px, U.y0 + 12, pw, U.h - 24);
    return { back, zoomDec, zoomInc, pct, panel, body: R(panel.x + 24, panel.y + 24, panel.w - 48, Math.max(60, panel.h - 48)), prev: prevR, next: nextR, counter: { x: x + cw / 2, y: prevR.y - 22 }, column: true };
  }
  const hdrH = tapMin(76), hdrY = Math.max(20, host.t + 8), navH = tapMin(84);
  const pw = U.w - 48, px = U.x0 + (U.w - pw) / 2;
  const backX = g.backBox.w ? Math.max(px - 8, g.backBox.x + g.backBox.w + 8) : px - 8;
  const inc = R(px + pw - 84, hdrY, 84, hdrH), pct = R(inc.x - 140, hdrY, 140, hdrH), dec = R(pct.x - 84, hdrY, 84, hdrH);
  const py = hdrY + hdrH + 16, navY = U.y1 - 26 - navH;
  const bottom = withNav ? navY - 16 : U.y1 - 24;
  const panel = R(px, py, pw, Math.max(120, bottom - py));
  const nw = Math.min(210, (pw - 16) / 2);
  return {
    back: R(backX, hdrY, 140, hdrH), zoomDec: dec, zoomInc: inc, pct, panel, body: R(panel.x + 24, panel.y + 24, panel.w - 48, Math.max(60, panel.h - 48)),
    prev: R(px, navY, nw, navH), next: R(px + pw - nw, navY, nw, navH), counter: { x: px + pw / 2, y: navY + navH / 2 }, column: false,
  };
}

// The Arcforge lockup under the title menu: 250 x 68 units, with a little air above it.
export const LOCK_W = 250, LOCK_H = Math.round(250 * 327 / 1200), LOCK_RES = LOCK_H + 14;
// Its tap zone: the lockup padded to at least 44 x 44 css px.
export function lockupRect(brand) {
  const m = Math.ceil(44 / (host.px || 0.6)), pw = Math.max(LOCK_W, m), ph = Math.max(LOCK_H, m);
  return R(brand.x - pw / 2, brand.y - LOCK_H / 2 - ph / 2, pw, ph);
}

// Title screen frame: where the menu column goes and the zone for the title art.
export function menuFrame() {
  const g = G(), U = g.U;
  if (g.wide) {
    const mw = clamp(U.w * 0.42, 430, 600), x = U.x1 - mw - 20, zx = U.x0 + 16 + (g.backBox.w ? g.backBox.w : 0);
    return { land: true, x, w: mw, top: U.y0 + 12, bottom: U.y1 - 12 - LOCK_RES, zone: R(zx, U.y0 + 6, x - 24 - zx, U.h - 52), brand: { x: x + mw / 2, y: U.y1 - 14 } };
  }
  return { land: false, x: U.x0 + 24, w: U.w - 48, top: U.y0, bottom: U.y1 - 22 - LOCK_RES, zone: null, brand: { x: g.w / 2, y: U.y1 - 14 } };
}

// The card for overlays (pause, result, hint reason, Watch & Learn summary) and card screens.
export function cardFrame(kind, scale = 1) {
  const g = G(), U = g.U;
  let w = Math.min(g.wide ? 600 : 620, U.w - 40), x = U.x0 + (U.w - w) / 2;
  if (g.wide && kind === 'end' && scale < 2) { w = Math.min(w, Math.max(340, g.side.w + 12)); x = U.x1 - 12 - w; }
  return { x, w, maxH: g.wide ? U.h - 24 : Math.min(1180, U.h - 60), wide: g.wide, cy: U.y0 + U.h / 2, bottomY: U.y1 - 28 };
}

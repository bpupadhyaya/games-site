// Screen rectangles and the board geometry shared by drawing (view.js) and hit-testing (game.js). Pure data.
import { tw } from './ui.js';

export const SCREEN = { width: 720, height: 1560 };
export const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- play screen: every size follows the text-zoom step s (1 to 3), so the HUD grows with the text ----
export const BACK_BTN = { x: 16, y: 22, w: 84, h: 78 };
export const PAUSE_BTN = { x: 620, y: 22, w: 84, h: 78 };
export const NAME_CHIP = { x: 112, y: 22, w: 496, h: 78 };
// HUD buttons and the title chip grow with the text size.
export function hudOf(scale) {
  const k = clamp((scale - 1) / 2, 0, 1);
  const h = Math.round(78 + 36 * k), bw = Math.round(84 + 20 * k);
  return { h, k, back: { x: 16, y: 22, w: bw, h }, pause: { x: SCREEN.width - 16 - bw, y: 22, w: bw, h }, name: { x: 16 + bw + 12, y: 22, w: SCREEN.width - 32 - 2 * bw - 24, h } };
}
export const TOOL_IDS = ['fill', 'cross', 'move', 'zoom', 'undo', 'redo', 'think', 'check'];

export function playLayout(scale) {
  const k = clamp((scale - 1) / 2, 0, 1);
  const focusH = Math.round(104 + 150 * k);
  const statusH = Math.round(150 + 110 * k);
  const toolH = Math.round(104 + 44 * k);
  const toolY2 = SCREEN.height - 24 - toolH;
  const toolY1 = toolY2 - toolH - 10;
  const hud = hudOf(scale);
  const focus = { x: 24, y: 34 + hud.h, w: 672, h: focusH };
  const status = { x: 24, y: toolY1 - 14 - statusH, w: 672, h: statusH };
  const areaY = focus.y + focus.h + 10;
  const area = { x: 24, y: areaY, w: 672, h: status.y - 10 - areaY };
  const bw = (672 - 3 * 12) / 4;
  const tools = TOOL_IDS.map((id, i) => ({ id, x: 24 + (i % 4) * (bw + 12), y: i < 4 ? toolY1 : toolY2, w: bw, h: toolH }));
  const ah = Math.round(62 + 20 * k), aw = Math.round(176 + 40 * k);
  const applyBtn = { x: status.x + status.w - aw - 12, y: status.y + (statusH - ah) / 2, w: aw, h: ah };
  return { focus, status, area, tools, apply: applyBtn, applyBtn, toolH, k, hud };
}

// ---- Watch & Learn ----
export function autoLayout(scale) {
  const k = clamp((scale - 1) / 2, 0, 1);
  const h = Math.round(112 + 74 * k), y = SCREEN.height - 28 - h;
  const statusH = Math.round(190 + 170 * k);
  const status = { x: 24, y: y - 52 - statusH, w: 672, h: statusH };
  const focus = { x: 24, y: 34 + hudOf(scale).h, w: 672, h: Math.round(84 + 60 * k) };
  const areaY = focus.y + focus.h + 10;
  return {
    slower: { x: 24, y, w: 160, h }, pause: { x: 200, y, w: 320, h }, faster: { x: 536, y, w: 160, h }, labelY: y - 18,
    status, focus, area: { x: 24, y: areaY, w: 672, h: status.y - 10 - areaY },
  };
}

// ---- the board: clue panels, the grid, zoom and pan ----
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

// zoom: 'fit' shows the whole board when it can; 'close' makes the squares big enough for a fingertip and scrolls.
export function boardGeo(puz, area, scale, zoom = 'fit', ox = 0, oy = 0) {
  const key = `${puz.id}|${area.w}x${area.h}|${scale}`;
  let base = cache.get(key);
  if (!base) {
    let fitS = 12;
    for (let s = Math.min(112, Math.floor(area.w / (puz.w + 1))); s >= 12; s--) {
      const e = extents(puz, s, scale);
      if (e.rowW + puz.w * s <= area.w && e.colH + puz.h * s <= area.h) { fitS = s; break; }
    }
    const closeS = fitS >= 48 ? fitS : 56;
    base = { fitS, closeS, fit: extents(puz, fitS, scale), close: extents(puz, closeS, scale) };
    if (cache.size > 60) cache.clear();
    cache.set(key, base);
  }
  const canZoom = base.closeS > base.fitS;
  const mode = canZoom && zoom === 'close' ? 'close' : 'fit';
  const s = mode === 'close' ? base.closeS : base.fitS;
  const e = mode === 'close' ? base.close : base.fit;
  const gridW = puz.w * s, gridH = puz.h * s;
  const viewW = Math.min(gridW, area.w - e.rowW), viewH = Math.min(gridH, area.h - e.colH);
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

// ---- document screens ----
export const DOC_BACK = { x: 16, y: 20, w: 140, h: 76 };
export const ZOOM_DEC = { x: 396, y: 20, w: 84, h: 76 };
export const ZOOM_INC = { x: 620, y: 20, w: 84, h: 76 };
export const DOC_PANEL = { x: 24, y: 112, w: 672, h: 1322 };
export const DOC_BODY = { x: 48, y: 136, w: 624, h: 1274 };
export const NAV_PREV = { x: 24, y: 1450, w: 210, h: 84 };
export const NAV_NEXT = { x: 486, y: 1450, w: 210, h: 84 };
export const DOC_BODY_NAV = { x: 48, y: 136, w: 624, h: 1190 };
export const START_BTN = { x: 24, y: 1440, w: 672, h: 96 };
export const DOC_BODY_START = { x: 48, y: 136, w: 624, h: 1180 };

// ---- title screen ----
export const MENU_REGION = { x: 24, y: 640, w: 672, h: 890 };

// ---- overlays ----
export const OVERLAY = { x: 50, y: 250, w: 620, h: 1060 };

// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// FLUID (kit 1.7.x): the SHORT side of the screen is always 720 virtual units; the long side follows the device (phone, iPad, 7in and
// 10in tablets, portrait and landscape). setSize(w, h) runs at the top of every update and render and refreshes W, H (ES live
// bindings) and every pinned rectangle below.
//   portrait   a header + scoreboard box on top, the hole in the middle, the control bar at the bottom.
//   landscape  the hole fills the left, a panel on the right holds the scoreboard and the controls.
// The play screen follows the player's text size (100-300%): panels grow and the hole shrinks to make room; on short screens the
// in-play text size steps down to what fits. Nothing important is painted in the outer 24 px.
import { setFloor } from './ui.js';
export let W = 720, H = 1280;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Safe areas and the host's floating back button, in virtual units (main.js keeps this current; browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: 580, y: 18, w: 120, h: 60 };
export const SETUP_PINS = { start: { x: 30, y: 1156, w: 440, h: 96 }, back: { x: 486, y: 1156, w: 204, h: 96 } };
export const PANEL = { x: 34, y: 100, w: 652, h: 1030 };
export const SAFE = { x0: 0, y0: 0, x1: 720, y1: 1280 };
export let LAND = false;

export const minTap = () => Math.round(44 / Math.max(0.3, host.px));
const set = (o, x, y, w, h) => { o.x = x; o.y = y; o.w = w; o.h = h; };
export function setSize(w, h) {
  w = Math.round(w); h = Math.round(h);
  if (!(w > 0 && h > 0)) return;
  W = w; H = h; LAND = w >= h;
  setFloor(Math.ceil(11 / Math.max(0.3, host.px)));
  const mt = minTap();
  const sx0 = host.l, sx1 = W - host.r, sy0 = host.t, sy1 = H - host.b;
  Object.assign(SAFE, { x0: sx0, y0: sy0, x1: sx1, y1: sy1 });
  const cx = (sx0 + sx1) / 2;
  const tw = LAND ? 100 : 120, th = Math.max(LAND ? 52 : 60, mt), ty = sy0 + (LAND ? 12 : 18);
  set(TEXT_INC, sx1 - 16 - tw, ty, tw, th); set(TEXT_DEC, TEXT_INC.x - 10 - tw, ty, tw, th);
  const bh = Math.max(LAND ? 72 : 100, mt), bw = LAND ? Math.min(300, (Math.min(980, sx1 - sx0 - 32) - 16) / 2) : (sx1 - sx0 - 40 - 16) / 2;
  const by = sy1 - bh - (LAND ? 12 : 16);
  const pw = LAND ? Math.min(980, sx1 - sx0 - 32) : sx1 - sx0 - 68, py = Math.max(sy0 + (LAND ? 74 : 100), ty + th + 10);
  set(PANEL, cx - pw / 2, py, pw, Math.max(200, by - 14 - py));
  set(REF_BACK, cx - bw - 8, by, bw, bh); set(REF_NEXT, cx + 8, by, bw, bh);
  const colW = LAND ? Math.min(640, sx1 - sx0 - 48) : sx1 - sx0 - 60, sh = Math.max(LAND ? 76 : 96, mt), sy = sy1 - 28 - sh, sbw = Math.round(colW * 0.31);
  set(SETUP_PINS.start, cx - colW / 2, sy, colW - sbw - 16, sh); set(SETUP_PINS.back, cx + colW / 2 - sbw, sy, sbw, sh);
}
setSize(W, H);

const rc = (x, y, w, h) => ({ x, y, w, h });

// ---- the play screen -------------------------------------------------------------------------------------------------------
export function panelWidth(sc) {
  const s = Math.min(sc, 3);
  return s < 1.5 ? clamp(Math.round(W * 0.32), 330, 420) : clamp(Math.round(W * 0.44), 420, 600);
}
// The controls: ids in display order. Returns { rects:{id:rect}, h } laid out in a box (one row when it fits, else two columns).
function placeControls(ids, bx, bw, yBottom, s, land) {
  const fs = Math.round(26 * s), mt = minTap();
  const bh = Math.max(land ? 64 : 76, mt, Math.round(fs * 1.7));
  const m = 14, g = 8, iw = bw - 2 * m;
  const rects = {};
  const cols = land || s >= 1.5 || ids.length > 4 ? 2 : ids.length;
  const rows = Math.ceil(ids.length / cols);
  const total = rows * bh + (rows - 1) * g;
  const y0 = yBottom - m - total;
  const cw = (iw - g * (cols - 1)) / cols;
  ids.forEach((id, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const inRow = r === rows - 1 && ids.length % cols ? ids.length % cols : cols;
    const w2 = inRow === cols ? cw : (iw - g * (inRow - 1)) / inRow;
    rects[id] = rc(bx + m + c * (w2 + g), y0 + r * (bh + g), w2, bh);
  });
  return { rects, top: y0 - 8, h: total + m + 8, bh };
}

// Estimated height of the scoreboard (header lines + player chips).
function hudHeight(s, bw, nPlayers) {
  const fs = Math.round(24 * s);
  const perRow = Math.max(1, Math.floor((bw - 24) / (fs * 9.2)));
  const rows = Math.ceil(Math.max(1, nPlayers) / perRow);
  return Math.round(14 + fs * 2.7 + 8 + rows * (fs * 1.75 + 6) + 6);
}

function playLayoutAt(s, ids, land, nPlayers) {
  const sx0 = host.l, sx1 = W - host.r;
  let bx, bw, y0, y1;
  if (land) { bw = panelWidth(s); bx = sx1 - bw; y0 = host.t + 10; y1 = H - host.b; }
  else { bx = sx0; bw = sx1 - sx0; y0 = host.t + (host.back ? host.back + 6 : 10); y1 = H - host.b; }
  const fs = Math.round(24 * s);
  const hudH = hudHeight(s, bw, nPlayers);
  const hud = { x: bx, y: y0, w: bw, h: hudH, fs, bottom: y0 + hudH };
  const ctl = placeControls(ids, bx, bw, y1, s, land);
  const regionTop = hud.bottom + 4, regionBottom = ctl.top - 4;
  const lay = { s, land, hud, ctrl: ctl.rects, ctrlTop: ctl.top, bh: ctl.bh, fs, box: { x: bx, y: y0, w: bw, h: y1 - y0 }, regionTop, regionBottom };
  if (land) {
    lay.sheet = rc(sx0, host.t, bx - 8 - sx0, H - host.t - host.b);
    lay.zone = rc(bx, regionTop, bw, Math.max(0, regionBottom - regionTop));
  } else {
    lay.sheet = rc(sx0, regionTop, sx1 - sx0, Math.max(0, regionBottom - regionTop));
    lay.zone = lay.sheet;
  }
  return lay;
}

// ids: the control buttons in order. When the screen is too short for the text size, the in-play text size steps down until it fits.
export function playLayout(sc, ids, nPlayers) {
  const land = LAND;
  const steps = TEXT_SCALES.filter((v) => v <= Math.min(sc, 3) + 1e-6).reverse();
  let lay = null;
  for (const s of steps) {
    lay = playLayoutAt(s, ids, land, nPlayers);
    const room = land ? lay.zone.h >= 40 && lay.sheet.w >= Math.min(620, W * 0.5) : lay.sheet.h >= Math.min(560, H * 0.42);
    if (room) break;
  }
  return lay;
}

export function modalGeom() {
  const w = Math.min(660, SAFE.x1 - SAFE.x0 - 24);
  return { x: (SAFE.x0 + SAFE.x1) / 2 - w / 2, w, top: SAFE.y0 + (LAND ? 18 : 60), bottom: SAFE.y1 - (LAND ? 18 : 60) };
}
// The Arcforge lockup under the title menu: >= ~125 css px wide (aspect 700:190).
export function lockSize(maxW) { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), maxW); const h = w * 190 / 700; return { w, h, strip: Math.round(h + 26) }; }
export function flowGeom(key) {
  const wide = LAND;
  const sw = SAFE.x1 - SAFE.x0;
  if (key === 'title' && wide && sw >= 760) { const x = SAFE.x0 + sw * 0.53, w = Math.min(SAFE.x1 - x - 24, 520); return { x, w, top: SAFE.y0, bottom: SAFE.y1 - 8 - lockSize(w).strip, split: true }; }
  const w = wide ? Math.min(sw - 48, 760) : sw - 80;
  const bottom = key === 'setup' ? SETUP_PINS.start.y - 26 : key === 'title' ? SAFE.y1 - lockSize(w).strip - 6 : SAFE.y1;
  return { x: (SAFE.x0 + SAFE.x1) / 2 - w / 2, w, top: SAFE.y0, bottom, split: false };
}

// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// FLUID (kit 1.7.x): the SHORT side of the screen is always 720 virtual units; the long side follows the device (phone, iPad, 7in and
// 10in tablets, portrait and landscape). setSize(w, h) runs at the top of every update and render and refreshes W, H (ES live
// bindings) and every pinned rectangle below.
//   portrait   the scoreboard on top, the bout picture, then the meters, the buttons and the pull pad at the bottom.
//   landscape  the bout picture fills the left; a panel on the right holds the scoreboard, meters, buttons and the pull pad.
// The play screen follows the player's text size (100-300%): panels grow and the picture shrinks to make room; on short screens the
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
  return s < 1.5 ? clamp(Math.round(W * 0.42), 380, 560) : clamp(Math.round(W * 0.5), 480, 700);
}
// A row of buttons that share the width: ids -> rects.
function rowOf(ids, bx, bw, y, bh, weights) {
  const g = 8, m = 12, rects = {};
  const tw = weights ? weights.reduce((a, b) => a + b, 0) : ids.length;
  const room = bw - 2 * m - g * (ids.length - 1);
  let x = bx + m;
  ids.forEach((id, k) => { const w = room * (weights ? weights[k] : 1) / tw; rects[id] = { x, y, w, h: bh }; x += w + g; });
  return rects;
}
const FLOOR_LAB = () => Math.ceil(11 / Math.max(0.3, host.px));
function playLayoutAt(s, land, watch) {
  const sx0 = host.l, sx1 = W - host.r, sy0 = host.t, sy1 = H - host.b;
  const fs = Math.round(24 * s), lab = Math.max(FLOOR_LAB(), Math.round(fs * 0.72)), mt = minTap();
  const lay = { s, land, fs, lab, watch };
  let bx, bw, y;
  if (land) { bw = panelWidth(s); bx = sx1 - bw; y = sy0 + 8; lay.stage = { x: sx0, y: sy0, w: bx - 8 - sx0, h: sy1 - sy0 }; }
  else { bx = sx0; bw = sx1 - sx0; y = sy0 + (host.back ? host.back + 6 : 10); }
  const hdrH = Math.round(fs * 2.7 + 10);
  lay.hud = { x: bx, y, w: bw, h: hdrH };
  y += hdrH + 4;
  const bh = Math.max(land ? 54 : 62, mt, Math.round(fs * 1.7));
  const ctrlH = watch ? bh * 2 + 8 : bh * 3 + 16;
  const labH = Math.round(lab * 1.5), gripH = Math.round(lab * 1.9);
  const discPad = 16;
  const roomW = (bw - 24) / 2;
  let r = clamp(Math.floor((roomW - 18) / 2 / 1.06), 50, 190);
  const fixedBelow = ctrlH + 12;
  const avail = sy1 - 8 - y;
  let stageH = 0;
  const need = (rr) => labH + rr * 2 + discPad + gripH + fixedBelow;
  if (land) {
    r = clamp(Math.min(r, Math.floor((avail - need(0)) / 2)), 40, 190);
  } else {
    // tall screens (iPad, 10in): the picture gets at least ~45 % of the height, the discs shrink to make room
    r = clamp(Math.min(r, Math.floor((avail * 0.55 - need(0)) / 2)), 50, r);
    stageH = avail - need(r);
    if (stageH < 230) { r = clamp(Math.floor((avail - 230 - need(0)) / 2), 50, r); stageH = avail - need(r); }
    stageH = clamp(stageH, 120, Math.round(bw * 1.45));
    lay.stage = { x: bx, y, w: bw, h: stageH };
    y += stageH + 4;
  }
  lay.free = land ? lay.stage.w : stageH;
  lay.r = r;
  const dcy = y + labH + r + 10;
  lay.discs = { me: { cx: bx + bw * 0.25, cy: dcy, r }, th: { cx: bx + bw * 0.75, cy: dcy, r } };
  lay.discLabY = y + labH * 0.8;
  lay.gripY = dcy + r + discPad;
  lay.gripH = gripH;
  y = lay.gripY + gripH + 6;
  const ctop = Math.max(y, sy1 - 8 - ctrlH);
  if (watch) {
    lay.btn = { ...rowOf(['pause', 'fast', 'exit'], bx, bw, ctop, bh), ...rowOf(['dec', 'inc'], bx, bw, ctop + bh + 8, bh) };
  } else {
    lay.kinds = rowOf(['pull', 'hook', 'brace'], bx, bw, ctop, bh);
    lay.pows = rowOf(['p1', 'p2', 'p3'], bx, bw, ctop + bh + 8, bh);
    lay.btn = rowOf(['lock', 'think', 'menu'], bx, bw, ctop + (bh + 8) * 2, bh, [2.1, 1, 1]);
  }
  lay.bh = bh; lay.ctrlTop = ctop; lay.col = { x: bx, w: bw };
  lay.fits = ctop >= y - 1 && (land ? r >= 52 : lay.free >= 200);
  return lay;
}

// watch: Watch & Learn controls. When the screen is too short for the text size the in-play text size steps down until it fits.
export function playLayout(sc, watch = false) {
  const land = LAND;
  const steps = TEXT_SCALES.filter((v) => v <= Math.min(sc, 3) + 1e-6).reverse();
  let lay = null;
  for (const s of steps) { lay = playLayoutAt(s, land, watch); if (lay.fits) break; }
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

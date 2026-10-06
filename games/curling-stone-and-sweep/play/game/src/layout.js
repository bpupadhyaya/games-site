// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// FLUID (kit 1.7.x): the SHORT side of the screen is always 720 virtual units; the long side follows the device (phone, iPad, 7in and 10in
// tablets, portrait and landscape). `setSize(w, h)` is called at the top of every update and render with the live size and refreshes W, H
// (ES live bindings: importers always read the current value) and every pinned rectangle below.
//   portrait  scoreboard on top, the sheet in the middle (runs top to bottom, house at the top), the control bar at the bottom.
//   landscape the sheet runs left to right across the width (house on the right) and a panel on the right holds the scoreboard and controls.
// Nothing important is painted in the outer 24 px. The play screen follows the player's text size (100-300%): the panel / bars grow and the
// sheet shrinks to make room, so text is never clipped (on very short screens the in-play text size is capped to what fits).
import { setFloor } from './ui.js';
export let W = 720, H = 1280;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero). `back` is non-zero only
// when a host back button exists (the standalone build has none), and then the top-left corner is kept clear.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
// Pinned rectangles (mutated in place by setSize so every importer keeps seeing the current ones)
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: 580, y: 18, w: 120, h: 60 };
export const SETUP_PINS = { start: { x: 30, y: 1156, w: 440, h: 96 }, back: { x: 486, y: 1156, w: 204, h: 96 } };
export const PANEL = { x: 34, y: 100, w: 652, h: 1030 };      // the reference pages (About / How to Play / Rules)
export const SAFE = { x0: 0, y0: 0, x1: 720, y1: 1280 };       // the area clear of notches and the home indicator
export let LAND = false;

// Tap targets are about 44 css px tall where the screen allows (host.px = css px per virtual unit); text never under ~11 css px.
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
  // text-size buttons of the reference pages: top right (the top-left corner stays clear for a host back button)
  const tw = LAND ? 100 : 120, th = Math.max(LAND ? 52 : 60, mt), ty = sy0 + (LAND ? 12 : 18);
  set(TEXT_INC, sx1 - 16 - tw, ty, tw, th); set(TEXT_DEC, TEXT_INC.x - 10 - tw, ty, tw, th);
  // reference pages: a panel with Back / Next under it
  const bh = Math.max(LAND ? 72 : 100, mt), bw = LAND ? Math.min(300, (Math.min(980, sx1 - sx0 - 32) - 16) / 2) : (sx1 - sx0 - 40 - 16) / 2;
  const by = sy1 - bh - (LAND ? 12 : 16);
  const pw = LAND ? Math.min(980, sx1 - sx0 - 32) : sx1 - sx0 - 68, py = Math.max(sy0 + (LAND ? 74 : 100), ty + th + 10);
  set(PANEL, cx - pw / 2, py, pw, Math.max(200, by - 14 - py));
  set(REF_BACK, cx - bw - 8, by, bw, bh); set(REF_NEXT, cx + 8, by, bw, bh);
  // setup: Start / Back pinned at the bottom
  const colW = LAND ? Math.min(640, sx1 - sx0 - 48) : sx1 - sx0 - 60, sh = Math.max(LAND ? 76 : 96, mt), sy = sy1 - 28 - sh, sbw = Math.round(colW * 0.31);
  set(SETUP_PINS.start, cx - colW / 2, sy, colW - sbw - 16, sh); set(SETUP_PINS.back, cx + colW / 2 - sbw, sy, sbw, sh);
}
setSize(W, H);

const rc = (x, y, w, h) => ({ x, y, w, h });

// ---- the play screen -----------------------------------------------------------------------------------------------------------
// The scoreboard + control bar live in a "box": the whole screen width in portrait, a panel on the right in landscape.
export function panelWidth(sc) {
  const s = Math.min(sc, 3);
  return s < 1.5 ? clamp(Math.round(W * 0.34), 330, 420) : clamp(Math.round(W * 0.44), 420, 600);
}
function hudBoxIn(sc, bx, bw, y, stackedNeeded) {
  const s = Math.min(sc, 3);
  if (!stackedNeeded && s <= 1.25) {
    const h = Math.round(98 * s);
    return { stacked: false, x: bx, w: bw, y, h, bottom: y + h, fs: Math.round(24 * s) };
  }
  const fs = Math.round(24 * s), row = Math.round(fs * 1.38);
  const h = 12 + row * 3 + 8;
  return { stacked: true, x: bx, w: bw, y, h, bottom: y + h, fs, row };
}
export function hudBox(sc) { return hudBoxIn(sc, 0, 720, 10, false); }

function playLayoutAt(s, kind, land) {
  const sx0 = host.l, sx1 = W - host.r;
  let bx, bw, y0, y1;
  if (land) { bw = panelWidth(s); bx = sx1 - bw; y0 = host.t + 10; y1 = H - host.b; }
  else { bx = sx0; bw = sx1 - sx0; y0 = host.t + (host.back ? host.back + 6 : 10); y1 = H - host.b; }
  const hud = hudBoxIn(s, bx, bw, y0, land);
  const mt = minTap();
  const fs = Math.round(26 * s), bh = Math.max(64, mt, Math.round(fs * 1.6));
  const g = 8, m = 14, iw = bw - 2 * m;
  const compact = land || s >= 1.5;      // the stacked control bar (a caption, then two columns of buttons)
  let c;
  if (kind === 'aim') {
    if (!compact) {
      const ch = Math.max(60, mt, Math.round(fs * 1.55));
      const cw = (iw - 3 * g) / 4;
      const chips = [0, 1, 2, 3].map((i) => rc(bx + m + i * (cw + g), 0, cw, ch));
      const th = Math.max(56, mt, Math.round(fs * 1.5));
      const half = (iw - g) / 2;
      const turn = [rc(bx + m, 0, half, th), rc(bx + m + half + g, 0, half, th)];
      const ah = Math.max(76, mt, Math.round(fs * 1.7));
      const w1 = Math.round(iw * 0.264), w2 = Math.round(iw * 0.417), w3 = iw - w1 - w2 - 2 * g;
      const think = rc(bx + m, 0, w1, ah), thr = rc(bx + m + w1 + g, 0, w2, ah), menu = rc(bx + m + w1 + g + w2 + g, 0, w3, ah);
      const total = 10 + ch + g + th + g + ah + m;
      const top = y1 - total;
      chips.forEach((r) => { r.y = top + 10; });
      turn.forEach((r) => { r.y = top + 10 + ch + g; });
      [think, thr, menu].forEach((r) => { r.y = top + 10 + ch + g + th + g; });
      c = { top, inline: true, chips, turn, think, throw: thr, menu };
    } else {
      const capH = Math.round(fs * 1.05);
      const half = (iw - g) / 2;
      const total = 8 + capH + g + bh + g + bh + m;
      const top = y1 - total;
      const ya = top + 8 + capH + g, yb = ya + bh + g;
      c = { top, inline: false, capH, capY: top + 8, shot: rc(bx + m, ya, half, bh), think: rc(bx + m + half + g, ya, half, bh), throw: rc(bx + m, yb, half, bh), menu: rc(bx + m + half + g, yb, half, bh) };
    }
  } else if (kind === 'fly') {
    const lab = Math.round(fs * 1.15), mh = Math.max(40, Math.round(fs * 0.9)), ph = Math.max(64, mt, Math.round(fs * 1.5));
    const half = (iw - g) / 2;
    const total = 8 + lab + mh + g + ph + m;
    const top = y1 - total;
    c = { top, labelY: top + 8, labelH: lab, meter: rc(bx + 20, top + 8 + lab, bw - 40, mh), pause: rc(bx + m, top + 8 + lab + mh + g, half, ph), fast: rc(bx + m + half + g, top + 8 + lab + mh + g, half, ph) };
  } else if (kind === 'score') {
    const th = Math.round(fs * 1.4), sh = Math.round(fs * 1.1), ah = Math.max(76, mt, Math.round(fs * 1.7));
    const lines = land || bw < 560 ? 2 : 1;       // narrow boxes wrap the verdict onto two lines
    const total = 10 + th * lines + sh * lines + g + ah + m;
    const top = y1 - total;
    c = { top, titleY: top + 10, titleH: th, subY: top + 10 + th * lines, subH: sh, lines, go: rc(bx + m, top + 10 + (th + sh) * lines + g, iw, ah) };
  } else {   // watch
    const lab = Math.round(fs * 1.1);
    const ah = Math.max(76, mt, Math.round(fs * 1.6));
    if (!compact) {
      const total = 8 + lab + ah + g + Math.max(mt, Math.round(ah * 0.8)) + m;
      const top = y1 - total;
      const yy = top + 8 + lab, sw = Math.round(iw * 0.208);
      c = { top, labelY: top + 8, labelH: lab, dec: rc(bx + m, yy, sw, ah), pause: rc(bx + m + sw + g, yy, iw - 2 * sw - 2 * g, ah), inc: rc(bx + bw - m - sw, yy, sw, ah), exit: rc(bx + m, yy + ah + g, iw, Math.max(mt, Math.round(ah * 0.8))) };
    } else {
      const half = (iw - g) / 2;
      const total = 8 + lab + ah + g + ah + g + ah + m;
      const top = y1 - total;
      const ya = top + 8 + lab, yb = ya + ah + g, yc = yb + ah + g;
      c = { top, labelY: top + 8, labelH: lab, pause: rc(bx + m, ya, iw, ah), dec: rc(bx + m, yb, half, ah), inc: rc(bx + m + half + g, yb, half, ah), exit: rc(bx + m, yc, iw, ah) };
    }
  }
  const regionTop = hud.bottom + 4, regionBottom = c.top - 4;
  const lay = { s, land, hud, ctrl: c, regionTop, regionBottom, fs, bh, box: { x: bx, y: y0, w: bw, h: y1 - y0 } };
  if (land) {
    lay.sheet = rc(sx0, host.t, bx - 8 - sx0, H - host.t - host.b);
    lay.zone = rc(bx, regionTop, bw, Math.max(0, regionBottom - regionTop));
  } else {
    lay.sheet = rc(sx0, regionTop, sx1 - sx0, Math.max(0, regionBottom - regionTop));
    lay.zone = lay.sheet;
  }
  return lay;
}

// kind: 'aim' | 'fly' | 'score' | 'watch'. When the screen is too short for the chosen text size, the in-play text size steps down until it fits.
export function playLayout(sc, kind) {
  const land = LAND;
  const steps = TEXT_SCALES.filter((v) => v <= Math.min(sc, 3) + 1e-6).reverse();
  let lay = null;
  for (const s of steps) {
    lay = playLayoutAt(s, kind, land);
    const room = land ? lay.zone.h >= 40 && lay.sheet.w >= Math.min(560, W * 0.5) : lay.sheet.h >= Math.min(340, H * 0.36);
    if (room) break;
  }
  return lay;
}

// The popup panel used by Shot options and the pause menu (centred, up to 660 wide).
export function modalGeom() {
  const w = Math.min(660, SAFE.x1 - SAFE.x0 - 24);
  return { x: (SAFE.x0 + SAFE.x1) / 2 - w / 2, w, top: SAFE.y0 + (LAND ? 18 : 60), bottom: SAFE.y1 - (LAND ? 18 : 60) };
}
// The column of a flow screen (title, setup, settings, Learn, quiz, result).
// The Arcforge lockup under the title menu: >= ~125 css px wide (aspect 700:190); `strip` is the room kept for it under the buttons.
export function lockSize(maxW) { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), maxW); const h = w * 190 / 700; return { w, h, strip: Math.round(h + 26) }; }
export function flowGeom(key) {
  const wide = LAND;
  const sw = SAFE.x1 - SAFE.x0;
  if (key === 'title' && wide && sw >= 760) { const x = SAFE.x0 + sw * 0.53, w = Math.min(SAFE.x1 - x - 24, 520); return { x, w, top: SAFE.y0, bottom: SAFE.y1 - 8 - lockSize(w).strip, split: true }; }
  const w = wide ? Math.min(sw - 48, 760) : sw - 80;
  const bottom = key === 'setup' ? SETUP_PINS.start.y - 26 : key === 'title' ? SAFE.y1 - lockSize(w).strip - 6 : SAFE.y1;
  return { x: (SAFE.x0 + SAFE.x1) / 2 - w / 2, w, top: SAFE.y0, bottom, split: false };
}

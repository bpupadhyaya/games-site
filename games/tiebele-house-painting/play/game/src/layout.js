// Screen geometry in one place so game.js (hit tests) and view.js / menus.js (drawing) never disagree.
// FLUID LAYOUT (kit 1.7.1): the short side of the screen is always 720 units, the long side follows the real aspect ratio. Everything is laid
// out from the live meta.width / meta.height every frame and is a pure function of that size (plus the host's safe-area insets), so a rotation
// or a window resize simply re-lays out the same game state.
import { v3 } from './v3.js';
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_SECS = 2;
export const FR = { w: 720, h: 1280, land: false, t: 0, r: 0, b: 0, l: 0, back: 0, key: '' };
// Host safe areas and the floating back button, in screen units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const R = (x, y, w, h) => ({ x, y, w, h });

export function setFrame(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  if (key === FR.key) return FR;
  Object.assign(FR, { w, h, land: w > h, t: host.t, r: host.r, b: host.b, l: host.l, back: host.back, key });
  return FR;
}
export const topSafe = () => Math.max(16, FR.t + 10);
export const botSafe = () => Math.max(16, FR.b + 10);
// The centred column every flow screen (menus, settings, results) uses.
export const colW = () => Math.max(300, Math.min(660, FR.w - FR.l - FR.r - 40));
export const colX = () => FR.l + (FR.w - FR.l - FR.r - colW()) / 2;

// The reader (About / How to Play / Rules): a panel with the page, text-size buttons on top and Back / Next at the bottom.
export function readerLayout() {
  const land = FR.land, top = topSafe(), bot = botSafe();
  const pw = Math.min(land ? 1000 : 680, FR.w - FR.l - FR.r - 28), px = FR.l + (FR.w - FR.l - FR.r - pw) / 2;
  const hdr = 78, foot = land ? 84 : 104;
  const py = top + hdr, ph = FR.h - py - bot - foot - 8;
  const backR = FR.back ? FR.l + FR.back + 16 : 0;      // keep the floating back button clear
  const bw = land ? 104 : 120, bh = 68;
  const inc = R(px + pw - bw, top, bw, bh), dec = R(inc.x - bw - 12, top, bw, bh);
  return {
    land, panel: R(px, py, pw, ph), inc, dec, pct: { x: dec.x - 52, y: top + bh / 2 },
    title: { x: (Math.max(px, backR) + dec.x - 78) / 2, y: top + bh / 2 },
    back: R(px, FR.h - bot - foot + 8, (pw - 16) / 2, foot - 16), next: R(px + (pw + 16) / 2, FR.h - bot - foot + 8, (pw - 16) / 2, foot - 16),
    counter: { x: px + pw / 2, y: py + ph - 22 }, text: R(px + 22, py + 16, pw - 44, ph - 66),
  };
}

// The play screen. The wall is a W x H grid of square cells as large as the room allows.
// Portrait: header on top, wall, a row of pots (+ cloth, undo), then the three buttons. Landscape: info and buttons left, wall middle, pots right.
let GRID = { W: 8, H: 6 };
export const setGrid = (W, H) => { GRID = { W, H }; };
export function playLayout(npots = 3) {
  const land = FR.land, top = topSafe(), bot = botSafe();
  const L = { land, w: FR.w, h: FR.h, npots };
  const fit = (x, y, w, h, pad) => {
    const cs = Math.max(20, Math.floor(Math.min((w - pad * 2) / GRID.W, (h - pad * 2) / GRID.H)));
    const gw = cs * GRID.W, gh = cs * GRID.H;
    return { frame: R(x + (w - gw) / 2 - pad, y + (h - gh) / 2 - pad, gw + pad * 2, gh + pad * 2), cs, ox: x + (w - gw) / 2, oy: y + (h - gh) / 2, gw, gh };
  };
  if (!land) {
    const hx = FR.l + 16 + (FR.back ? FR.back : 0), hw = FR.w - FR.r - 16 - hx;
    const bh = Math.round(Math.max(78, Math.min(92, FR.h * 0.088))), by = FR.h - bot - bh;
    const bw = (FR.w - FR.l - FR.r - 32 - 28) / 3, bx = FR.l + 16;
    const think = R(bx, by, bw, bh), pause = R(bx + bw + 14, by, bw, bh), done = R(bx + (bw + 14) * 2, by, bw, bh);
    const potH = Math.round(Math.max(124, Math.min(160, FR.h * 0.125))), py = by - potH - 12;
    const slots = 5, sw = (FR.w - FR.l - FR.r - 32 - 10 * (slots - 1)) / slots;
    const slot = (k) => R(FR.l + 16 + k * (sw + 10), py, sw, potH);
    // the wall is as wide as the screen allows; whatever height is left over goes to the header card, which carries the brief and the hints
    const pad = 18, csW = Math.floor((FR.w - FR.l - FR.r - pad * 2) / GRID.W), wallNeed = csW * GRID.H + pad * 2 + 42;
    const room = py - 10 - top - 8;
    const hcap = v3.on ? 176 : Math.max(250, Math.min(360, FR.h * 0.24));
    const hh = Math.max(124, Math.min(hcap, room - wallNeed));
    const hud = R(hx, top, hw, hh);
    const top0 = hud.y + hud.h + 30;
    Object.assign(L, { hud, think, pause, done, pots: [slot(0), slot(1), slot(2)], cloth: slot(3), undo: slot(4), wall: fit(FR.l, top0, FR.w - FR.l - FR.r, py - 10 - top0, pad) });
  } else {
    const side = Math.max(210, Math.min(300, (FR.w - FR.l - FR.r) * 0.2));
    const lx = FR.l + 16 + (FR.back ? 0 : 0);
    const hud = R(lx, top + (FR.back ? FR.back + 4 : 0), side, FR.h - top - bot - (FR.back ? FR.back + 4 : 0) - 190);
    const rx = FR.w - FR.r - 16 - side;
    const bh = 72;
    const think = R(lx, FR.h - bot - bh * 2 - 12, side, bh), pause = R(lx, FR.h - bot - bh, side, bh);
    const done = R(rx, FR.h - bot - bh, side, bh);
    const avail = FR.h - top - bot - bh - 16, n = 5, gap = 8, ph = Math.min(112, (avail - gap * (n - 1)) / n);
    const slot = (k) => R(rx, top + k * (ph + gap), side, ph);
    Object.assign(L, { hud, think, pause, done, pots: [slot(0), slot(1), slot(2)], cloth: slot(3), undo: slot(4), wall: fit(lx + side + 12, top, rx - 12 - (lx + side + 12), FR.h - top - bot, 18) });
  }
  L.msg = { x: L.wall.frame.x + L.wall.frame.w / 2, y: L.wall.frame.y - 4 };
  return L;
}

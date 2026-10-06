// Screen geometry in one place so game.js (hit-testing) and view.js (drawing) never disagree.
// Virtual resolution 720 x 1280, portrait. Nothing important within 40 px of the top or bottom edge,
// and the top-centre strip (y < 44) is left free for the preview badge.
// Fluid (kit 1.7): the short side of the screen is always 720 units, the long side follows the aspect ratio. Every text screen is a
// 720-wide column whose height H follows the live screen (setStage); the play screen is a phone stage (tall / short portrait) or a wide
// three-part layout (landscape): see frameFor / wideLayout below.
export const W = 720;
export let H = 1280;
// Safe areas and the host's floating back button, in virtual units (main.js keeps this current; browsers: all zero).
// px = css pixels per virtual unit, so text never needs to drop below ~11 css px.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };
// What the update/render loop last saw of the screen (screen units), so pure drawing helpers can place full-screen backdrops.
export const screen = { w: 720, h: 1280, ox: 0, oy: 0, k: 1, land: false, sceneCx: 360 };
export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_SECS = 2;
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const SETUP_PINS = { start: { x: 30, y: 1156, w: 440, h: 96 }, back: { x: 486, y: 1156, w: 204, h: 96 } };
// The reader panel (Rules / How to Play / About) and every bottom-pinned button follow the stage height. A stage under 900 units tall
// (landscape) uses a tighter reader: the panel runs from just under the text-size buttons to just above the Close / More buttons.
export const PANEL = { x: 34, y: 100, w: 652, h: 1030 };
export const stageIsShort = () => H < 900;
export function setStage(h, wideLandscape = false) {
  H = Math.round(h);
  const bi = Math.round(host.b), ti = Math.round(host.t), back = host.back ? Math.round(host.back) + 8 : 0;
  const short = H < 900;
  // text-size buttons: top row, never under the host back button (top-left) or a notch
  const ty = Math.max(short ? 8 : 18, ti + (short ? 4 : 10));
  TEXT_DEC.x = 20 + back; TEXT_DEC.y = ty; TEXT_DEC.h = short ? 52 : 60; TEXT_INC.y = ty; TEXT_INC.h = TEXT_DEC.h;
  const bh = short ? 66 : 100, by = H - bh - Math.max(short ? 10 : 16, bi + 6);
  REF_BACK.y = by; REF_BACK.h = bh; REF_NEXT.y = by; REF_NEXT.h = bh;
  const ph = short ? 90 : 96, py = H - ph - Math.max(short ? 10 : 28, bi + 8);
  SETUP_PINS.start.y = py; SETUP_PINS.start.h = ph; SETUP_PINS.back.y = py; SETUP_PINS.back.h = ph;
  PANEL.y = ty + TEXT_DEC.h + (short ? 6 : 22); PANEL.h = by - (short ? 10 : 34) - PANEL.y;
}

// The table scene is designed on y = 180 .. 1040. At 100 to 150 percent text it fills the screen under the scoreboard (the controls sit
// over its bottom edge); at larger text sizes the scene shrinks into the space that is left between the scoreboard and the controls.
export const SCENE_Y0 = 180, SCENE_H = 860;
export const COMPACT = 1.5;   // largest text scale that keeps the inline controls

// Compact (inline) controls.
export const TRAY = {
  mode: { y: 1034, h: 66, x: 16, bw: 98, gap: 6 },
  act: { y: 1108, h: 100 },
};
export const PULL = { y0: 420, y1: 1030, max: 300, min: 30 };   // where a touch starts a pull, how far a full pull is, the smallest pull that throws

// Play frame for a screen of w x h units. 'tall' (portrait, h >= 1280): the approved phone stage, with the extra height spread over
// the top and bottom bands. 'short' (portrait, h < 1280): the whole 1280 stage scaled down to fit, centred. 'wide': landscape.
export function frameFor(w, h) {
  if (w > h) return { mode: 'wide', k: 1, ox: 0, oy: 0, sw: w, sh: h };
  if (h >= 1280) return { mode: 'tall', k: 1, ox: 0, oy: 0, sw: w, sh: h };
  const k = Math.min(h / 1280, w / 720);
  return { mode: 'short', k, ox: (w - 720 * k) / 2, oy: (h - 1280 * k) / 2, sw: 720, sh: 1280 };
}

export function playLayout(z, hudH, trayH, fr) {
  const E = fr && fr.mode === 'tall' ? fr.sh - 1280 : 0;
  if (z <= COMPACT) {
    // extra height E: the scoreboard keeps the top (below a notch), the controls keep the bottom (above the home bar), the scene sits between
    const hy = Math.max(0, Math.round(host.t) - 30), ty = Math.max(0, E - Math.max(0, Math.round(host.b) - 40)), sy = Math.round((hy + ty) / 2);
    return { compact: true, s: 1, vx: 0, vy: SCENE_Y0 + sy, sy, hy, ty, clip: null, hudH: hudH + hy, trayTop: 1030 + ty, E };
  }
  const hy = Math.max(0, Math.round(host.t) - 20), hudH2 = hudH + hy;
  const top = Math.min(hudH2 + 40, 560), bottom = H - Math.max(0, Math.round(host.b) - 20) - Math.min(trayH + 36, 600);
  const h = Math.max(260, bottom - top), s = Math.min(1, h / SCENE_H);
  return { compact: false, s, vx: (W - W * s) / 2, vy: top + (h - SCENE_H * s) / 2, sy: 0, hy, ty: 0, clip: { x: 0, y: top, w: W, h }, hudH: hudH2, trayTop: bottom, E };
}

// ---- landscape: the table in the middle, the score board on the left, the controls on the right ---------------------------------
// Pure function of the live size and insets (cached by key). Everything is in screen units (the short side is 720).
const wideCache = new Map();
export function wideLayout(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = wideCache.get(key);
  if (L) return L;
  const U = { x0: host.l, x1: w - host.r, y0: host.t, y1: h - host.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const top = U.y0 + 40;                                              // the top-centre strip stays free for the preview badge
  const panelMin = 232, gap = 8;
  const s = Math.max(0.5, Math.min(1, (U.y1 - 6 - top) / SCENE_H, (U.w - 2 * panelMin - 2 * gap) / W));
  const sw = W * s, sh = SCENE_H * s;
  const sx = U.x0 + (U.w - sw) / 2, sy = top + Math.max(0, (U.y1 - 6 - top - sh) / 2);
  const lw = sx - gap - U.x0 - 8, rw = U.x1 - (sx + sw) - gap - 8;
  const backClear = host.back ? Math.round(host.back) + 12 : 0;
  L = {
    wide: true, w, h, U, s, vx: sx, vy: sy, scene: { x: sx, y: sy, w: sw, h: sh }, clip: { x: sx, y: sy, w: sw, h: sh },
    left: { x: U.x0 + 8, y: Math.max(U.y0 + 8, backClear ? backClear : 0), w: lw, h: 0 }, right: { x: sx + sw + gap, y: U.y0 + 8, w: rw, h: U.h - 16 },
    key,
  };
  L.left.h = U.y1 - 8 - L.left.y;
  // The pull gesture starts at the paddle (just under the table's near edge) and runs down; the floor strip under the table is all the
  // room there is, so the pull is amplified to fit it: `gain` scene units of pull per screen unit of finger travel (1 on a phone portrait).
  L.paddleY = 860;
  const padScreen = sy + (L.paddleY - SCENE_Y0) * s, room = Math.max(60, U.y1 - 4 - padScreen);
  L.gain = Math.max(1, Math.min(2.4, (PULL.max * s) / (0.9 * room)));
  wideCache.set(key, L); if (wideCache.size > 40) wideCache.delete(wideCache.keys().next().value);
  return L;
}

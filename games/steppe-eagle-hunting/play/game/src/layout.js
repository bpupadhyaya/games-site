// Screen geometry in one place so game.js (hit tests) and view.js / menus.js (drawing) never disagree.
// FLUID LAYOUT (kit 1.7.1): the short side of the screen is always 720 units, the long side follows the real aspect ratio. Everything is laid out
// from the live meta.width / meta.height every frame and is a pure function of that size (plus the host's safe-area insets), so a rotation or a
// window resize simply re-lays out the same game state.
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_SECS = 2;
export const FR = { w: 720, h: 1280, land: false, t: 0, r: 0, b: 0, l: 0, back: 0, key: '' };
// Host safe areas and the floating back button, in screen units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
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
  // keep the floating back button clear: text-size buttons go to the right of it
  const backR = FR.back ? FR.l + FR.back + 16 : 0;
  const bw = land ? 104 : 120, bh = 68;
  const inc = R(px + pw - bw, top, bw, bh), dec = R(inc.x - bw - 12, top, bw, bh);
    return {
    land, panel: R(px, py, pw, ph), inc, dec, pct: { x: dec.x - 52, y: top + bh / 2 },
    title: { x: (Math.max(px, backR) + dec.x - 78) / 2, y: top + bh / 2 },
    back: R(px, FR.h - bot - foot + 8, (pw - 16) / 2, foot - 16), next: R(px + (pw + 16) / 2, FR.h - bot - foot + 8, (pw - 16) / 2, foot - 16),
    counter: { x: px + pw / 2, y: py + ph - 22 }, text: R(px + 22, py + 16, pw - 44, ph - 66),
  };
}

// The play screen. The whole screen is the steppe; the controls float over it.
// Portrait: scoreboard on top, status line below it, then (from the bottom) Think + Pause and the big action button.
// Landscape: scoreboard left, the action button, Think and Pause stacked on the right.
export function playLayout() {
  const land = FR.land, top = topSafe(), bot = botSafe();
  const L = { land, w: FR.w, h: FR.h };
  if (!land) {
    const hud = R(FR.l + 14, top, FR.w - FR.l - FR.r - 28, 100);
    const bw = (hud.w - 14) / 2, by = FR.h - bot - 78;
    const think = R(hud.x, by, bw, 78), pause = R(hud.x + bw + 14, by, bw, 78);
    const action = R(hud.x, by - 18 - 112, hud.w, 112);
    Object.assign(L, { hud, think, pause, action, msg: { x: FR.w / 2, y: hud.y + hud.h + 26 }, sheet: R(hud.x, hud.y + hud.h + 52, hud.w, clamp(action.y - (hud.y + hud.h + 52) - 12, 170, 250)) });
  } else {
    const side = Math.max(230, Math.min(300, (FR.w - FR.l - FR.r) * 0.21));
    const hud = R(FR.l + 14, top, side, 210), ctl = R(FR.w - FR.r - 14 - side, top, side, FR.h - top - bot);
    const pause = R(ctl.x, ctl.y + ctl.h - 80, ctl.w, 76), think = R(ctl.x, pause.y - 14 - 76, ctl.w, 76);
    const action = R(ctl.x, think.y - 16 - 124, ctl.w, 124);
    Object.assign(L, { hud, ctl, think, pause, action, msg: { x: FR.w / 2, y: top + 24 }, sheet: R(ctl.x, ctl.y, ctl.w, clamp(action.y - ctl.y - 12, 150, 420)) });
  }
  return L;
}

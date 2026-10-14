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
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const R = (x, y, w, h) => ({ x, y, w, h });

export function setFrame(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  if (key === FR.key) return FR;
  Object.assign(FR, { w, h, land: w > h, t: host.t, r: host.r, b: host.b, l: host.l, back: host.back, key });
  return FR;
}
export const PILL_BAND = 44;
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

// The play screen. Portrait: score panel on top, the clay box, the throw area and the buttons at the bottom. Landscape: scores left,
// controls right, the box in the middle with the lane in front of it.
export function playLayout() {
  // Portrait keeps a thin band at the top for the kit's "Preview 1:30" pill so it never sits on the score panel.
  const land = FR.land, top = topSafe() + (FR.land ? 0 : PILL_BAND), bot = botSafe();
  const L = { land, w: FR.w, h: FR.h };
  if (!land) {
    const hud = R(FR.l + 16, top, FR.w - FR.l - FR.r - 32, 112);
    const bw = (hud.w - 14) / 2, by = FR.h - bot - 86;
    const think = R(hud.x, by, bw, 86), pause = R(hud.x + bw + 14, by, bw, 86);
    const restY = by - 74;
    const aTop = hud.y + hud.h + 44, aBot = restY - 112, avail = Math.max(240, aBot - aTop);
    const frame = 22, size = Math.max(220, Math.min(FR.w - FR.l - FR.r - 32 - frame * 2, avail - frame * 2));
    const s = size / 100, bx = FR.l + (FR.w - FR.l - FR.r - size) / 2, byy = aTop + frame + (avail - frame * 2 - size) * 0.35;
    Object.assign(L, { hud, think, pause, board: { x: bx, y: byy, s }, rest: { x: FR.l + (FR.w - FR.l - FR.r) / 2, y: restY }, msg: { x: FR.w / 2, y: hud.y + hud.h + 24 }, sheet: null });
    L.sheet = R(hud.x, byy + size + 30, hud.w, Math.max(110, by - (byy + size + 30) - 10));
  } else {
    const side = Math.max(210, Math.min(280, (FR.w - FR.l - FR.r) * 0.19));
    const hud = R(FR.l + 16, top, side, 220), ctl = R(FR.w - FR.r - 16 - side, top, side, FR.h - top - bot);
    const restY = FR.h - bot - 46;
    const aTop = top + 36, aBot = restY - 44, frame = 20;
    const size = Math.max(200, Math.min(aBot - aTop - frame * 2, FR.w - FR.l - FR.r - 2 * (side + 16 + frame + 14)));
    const s = size / 100, cx = FR.w / 2;
    const think = R(ctl.x, ctl.y + ctl.h - 190, ctl.w, 84), pause = R(ctl.x, ctl.y + ctl.h - 94, ctl.w, 84);
    Object.assign(L, { hud, think, pause, ctl, board: { x: cx - size / 2, y: aTop + frame, s }, rest: { x: cx, y: restY }, msg: { x: cx, y: top + 12 }, sheet: R(ctl.x, ctl.y + 4, ctl.w, ctl.h - 214) });
  }
  const bs = L.board;
  // backdrop geometry: horizon behind the box, ground at the foot of the box frame, lane width follows the box
  L.court = { horizon: bs.y + bs.s * 55, ground: bs.y + bs.s * 100 + Math.max(8, bs.s * 2.6) + 6, laneHalf: bs.s * 55, cx: bs.x + bs.s * 50, line: L.rest.y + 52 };
  return L;
}

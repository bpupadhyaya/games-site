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

// The play screen. The whole screen is the village green; the controls sit under (portrait) or beside (landscape) it.
// Portrait: scoreboard on top, the green, then a row Dodge-left | big action button | Dodge-right and Think | Pause under it.
// Landscape: the green on the left; scoreboard, action button, dodge pair, Think and Pause stacked on the right.
export function playLayout() {
  const land = FR.land, top = topSafe(), bot = botSafe();
  const L = { land, w: FR.w, h: FR.h };
  if (!land) {
    const hud = R(FR.l + 14, top, FR.w - FR.l - FR.r - 28, 92);
    const bw = (hud.w - 14) / 2, by = FR.h - bot - 70;
    const think = R(hud.x, by, bw, 70), pause = R(hud.x + bw + 14, by, bw, 70);
    const ay = by - 12 - 104, dw = Math.max(96, hud.w * 0.24);
    const action = R(hud.x + dw + 12, ay, hud.w - 2 * dw - 24, 104);
    const dodgeL = R(hud.x, ay, dw, 104), dodgeR = R(hud.x + hud.w - dw, ay, dw, 104);
    const fy = hud.y + hud.h + 6;
    Object.assign(L, { hud, think, pause, action, dodgeL, dodgeR, field: R(FR.l, fy, FR.w - FR.l - FR.r, ay - 8 - fy), msg: { x: FR.w / 2, y: fy + 30 }, sheet: R(hud.x, fy + 8, hud.w, clamp(ay - fy - 24, 150, 260)) });
  } else {
    const side = Math.max(236, Math.min(300, (FR.w - FR.l - FR.r) * 0.22));
    const ctl = R(FR.w - FR.r - 14 - side, top, side, FR.h - top - bot);
    const pause = R(ctl.x, ctl.y + ctl.h - 66, ctl.w, 62), think = R(ctl.x, pause.y - 10 - 62, ctl.w, 62);
    const dw = (ctl.w - 12) / 2, dodgeY = think.y - 10 - 84;
    const dodgeL = R(ctl.x, dodgeY, dw, 84), dodgeR = R(ctl.x + dw + 12, dodgeY, dw, 84);
    const action = R(ctl.x, dodgeY - 12 - 112, ctl.w, 112);
    const hud = R(ctl.x, ctl.y, ctl.w, Math.min(210, action.y - ctl.y - 10));
    const fx = FR.l + 6, fw = ctl.x - 10 - fx;
    Object.assign(L, { hud, ctl, think, pause, action, dodgeL, dodgeR, field: R(fx, top, fw, FR.h - top - bot), msg: { x: fx + fw / 2, y: top + 30 }, sheet: R(fx + 10, top + 8, Math.min(fw - 20, 560), 190) });
  }
  return L;
}

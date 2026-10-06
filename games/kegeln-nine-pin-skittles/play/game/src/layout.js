// Screen geometry in one place so game.js (hit-testing) and view.js (drawing) never disagree.
// Fluid viewport (kit 1.7): the SHORT side of the screen is always 720 units; the long side follows the aspect ratio. `meta.width` and
// `meta.height` are kept current by the kit; SW / SH below mirror them (ES live bindings), so `import { SH }` is always the real height.
// W stays 720: it is the width of the portrait column the menus were designed in (menus centre that column on wider screens).
//   tall     portrait phone (height >= 1280): the approved phone look; the controls hug the bottom, spare height goes round the lane.
//   compact  portrait, shorter than a phone (tablets, split windows): tighter controls, the lane picture scales down to fit.
//   wide     landscape: scoreboard + status on the left, the lane in the middle, every control on the right.
export const W = 720;
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
export let SW = 720, SH = 1280;
export function syncSize() {
  const w = Math.round(meta.width) || 720, h = Math.round(meta.height) || 1280;
  SW = w; SH = h;
}
export const isWide = () => SW >= SH * 1.15;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (text never shrinks below ~11 css px). back > 0 only when a host back button floats at the top-left.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };
export const minUnits = (cssPx = 11) => Math.max(12, cssPx / (host.px || 0.6));   // smallest type (units) that is still ~cssPx css px
export const tapUnits = (cssPx = 44, lo = 56, hi = 96) => Math.max(lo, Math.min(hi, cssPx / (host.px || 0.6)));
// The box the host's back button occupies (top-left), or null when there is none.
export const backBox = () => (host.back > 0 ? { x: host.l, y: host.t, w: Math.max(host.back, 56) + 10, h: Math.max(host.back, 56) + 10 } : null);

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_SECS = 2;
export const COMPACT = 1.5;   // largest text scale that keeps the inline controls
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- the reference pages (About / How to Play / Rules) ----------------------------------------------------------------------
// One function of the live size: the text panel, the text-size buttons and the Back / Next buttons.
export function refGeom() {
  const top = Math.max(18, host.t + 8);
  if (!isWide()) {
    const bw = 120, bh = 60, rx = SW - host.r - 20;
    const bottom = SH - Math.max(116, host.b + 100), py = top + 62;
    const cw = SW - 56, bk = cw * 0.46;
    return {
      wide: false, panel: { x: 34, y: py, w: SW - 68, h: bottom - 10 - py },
      dec: { x: rx - bw * 2 - 12, y: top, w: bw, h: bh }, inc: { x: rx - bw, y: top, w: bw, h: bh },
      pct: { x: rx - bw * 2 - 12 - 60, y: top + bh / 2 },
      back: { x: 28, y: bottom, w: bk, h: 100 }, next: { x: 28 + bk + 16, y: bottom, w: cw - bk - 16, h: 100 },
    };
  }
  // landscape: the text panel on the left, a rail of buttons on the right
  const railW = Math.min(260, Math.max(190, SW * 0.2)), x1 = SW - host.r - 14, rx = x1 - railW, y0 = Math.max(12, host.t + 8);
  const px = host.l + 14, pw = Math.min(980, rx - 16 - px);
  const bh = tapUnits(44, 64, 90), half = (railW - 12) / 2;
  return {
    wide: true, panel: { x: px + Math.max(0, (rx - 16 - px - pw) / 2), y: y0, w: pw, h: SH - y0 - 12 },
    dec: { x: rx, y: y0, w: half, h: bh }, inc: { x: rx + half + 12, y: y0, w: half, h: bh }, pct: { x: rx + railW / 2, y: y0 + bh + 30 },
    back: { x: rx, y: SH - 12 - 2 * bh - 14, w: railW, h: bh }, next: { x: rx, y: SH - 12 - bh, w: railW, h: bh },
  };
}

// ---- the set-up buttons at the foot of the New Match screen ------------------------------------------------------------------
export function setupGeom() {
  const bottom = SH - Math.max(24, host.b + 8);
  if (!isWide()) { const h = 96, y = bottom - h; return { start: { x: 30, y, w: 440, h }, back: { x: 486, y, w: 204, h }, listBottom: y - 28 }; }
  const cw = Math.min(640, SW - 40), x0 = (SW - cw) / 2, hh = tapUnits(44, 64, 84), y = SH - hh - 10;
  return { start: { x: x0, y, w: cw * 0.64, h: hh }, back: { x: x0 + cw * 0.64 + 14, y, w: cw * 0.36 - 14, h: hh }, listBottom: y - 10 };
}

// ---- the lane scene -----------------------------------------------------------------------------------------------------------
// The lane picture is designed on y = 180 .. 960 of a 720 wide canvas (SCENE_Y0 is where its natural window starts). It is a pure drawing
// transform: design point (x, y) lands on screen (vx + x * s, vy + (y - SCENE_Y0) * s).
export const SCENE_Y0 = 180, SCENE_H = 780;
export const SY0 = 320, SY1 = 975;   // the design rows that must stay visible: the pin deck at the top, the ball at the bottom
export const BALLZONE = { y0: 700, y1: 960 };   // where a touch grabs the ball (scene coordinates)

// Compact (inline) controls of the portrait layouts, anchored to the bottom edge. `tight` = a short screen (tablet portrait).
export function trayGeom(tight) {
  // more room (a tall phone) -> bigger tap targets; about 44 css px where the screen allows
  const roomy = SH >= 1480, hook = tight ? 58 : roomy ? 78 : 68, pow = tight ? 52 : roomy ? 74 : 60, act = tight ? 84 : roomy ? 108 : 104, gap = tight ? 6 : 8;
  const bottom = SH - Math.max(70, host.b + 28);
  const actY = bottom - act, powY = actY - gap - pow, hookY = powY - gap - hook;
  return { hook: { y: hookY, h: hook, x: 16, bw: 92, gap: 5 }, power: { y: powY, h: pow }, act: { y: actY, h: act }, top: hookY - 6, bottom };
}

// Where the lane picture goes: depends on the mode, the text scale and the measured heights of the HUD and the controls.
export function sceneLayout(z, hudH, trayH, wideBox) {
  if (wideBox) { const s = Math.min(wideBox.sMax ?? 1, clamp((SH - 6) / 720, 0.6, 1)), y0 = 275; return { s, vx: wideBox.cx - 360 * s, vy: -(y0 - SCENE_Y0) * s + (SH - 720 * s) / 2, clip: null }; }
  if (z <= COMPACT && SH >= 1280) return { s: 1, vx: 0, vy: SCENE_Y0 + (SH - 1280) / 2, clip: null };
  const top = z <= COMPACT ? hudH - 30 : Math.min(hudH + 20, 560), bottom = z <= COMPACT ? SH - trayH + 12 : SH - Math.min(trayH + 36, 600);
  const avail = Math.max(150, bottom - top), s = clamp(avail / (SY1 - SY0), 0.3, 1);
  return { s, vx: (SW - W * s) / 2, vy: top + (avail - (SY1 - SY0) * s) / 2 - (SY0 - SCENE_Y0) * s, clip: null };
}
export const toScene = (lay, x, y) => ({ x: (x - lay.vx) / lay.s, y: (y - lay.vy) / lay.s + SCENE_Y0 });

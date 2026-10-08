// Screen geometry in one place so game.js (hit-testing) and view.js / menus.js (drawing) never disagree. (Same fluid-frame scheme as the other
// Arcforge fluid games: see docs/GAME-CONTRACT.md 'Per-game orientation'.)
//
// FLUID LAYOUT (kit 1.7.1): the kit gives a virtual screen whose SHORT side is 720 units and whose long side follows the real aspect ratio.
// The game draws in a DESIGN frame derived from it by setFrame():
//   portrait   the design is the original 720 x 1280 composition. If the screen is taller (phones, 2:1 and beyond) the design simply gets
//              more height (the scene grows, the controls stay at the bottom); if it is shorter (tablets, 4:3) the whole design is scaled
//              down by s = height / 1280 and centred (the backdrop fills the sides).
//   landscape  the design is the real 720-high screen at full width: the play screen fills the whole screen (cards on top, tray at the bottom); flow screens (menus, rules) use a centred column, the title a two-column layout.
// `W` (720) is the width of the centred COLUMN every flow screen is laid out in; `H` is the live design height; `FR.sw` the live design width.
// Pointer coordinates arrive in screen units: design = screen / FR.s, then minus the origin of the screen's column (see flowOrigin).
export const W = 720;
export let H = 1280;
export const FR = { w: 720, h: 1280, s: 1, sw: 720, H: 1280, land: false, fox: 0, ins: { t: 0, r: 0, b: 0, l: 0, back: 0 }, key: '' };
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_SECS = 2;

// Safe areas and the host's floating back button in screen units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

// Geometry that changes with the frame. The objects are shared and mutated in place, so every importer always sees the live values.
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const SETUP_PINS = { start: { x: 30, y: 1156, w: 440, h: 96 }, back: { x: 486, y: 1156, w: 204, h: 96 } };
// The reader (About / How to Play / Rules): panel, header, the window on the text and the page counter, in COLUMN coordinates.
export const RG = { panel: { x: 34, y: 100, w: 652, h: 1030 }, pct: { x: 360, y: 56 }, hdr: { x: 360, y: 158, line: 178 }, vt: 200, vb: 1078, pageH: 840, y0: 220, counter: { x: 360, y: 1108 }, land: false };

const R = (x, y, w, h) => ({ x, y, w, h });
const ass = (o, r) => { o.x = r.x; o.y = r.y; o.w = r.w; o.h = r.h; };
let frameKey = '';
// Called every update and render with the live virtual size. Cheap when nothing changed.
export function setFrame(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  if (key === frameKey) return FR;
  frameKey = key;
  const land = w > h;
  const s = land ? 1 : Math.min(1, h / 1280);
  FR.w = w; FR.h = h; FR.s = s; FR.land = land; FR.sw = w / s; FR.H = h / s; H = FR.H;
  FR.fox = (FR.sw - W) / 2;
  FR.ins = { t: host.t / s, r: host.r / s, b: host.b / s, l: host.l / s, back: host.back / s };
  FR.key = key;
  const ins = FR.ins;
  const topY = Math.max(18, ins.t + 8), bot = Math.max(0, ins.b - 14);
  // ---- the reader ---------------------------------------------------------------------------------------------
  if (!land) {
    const py = topY + 92, byBtn = H - 116 - bot, ph = byBtn - 16 - py;
    RG.land = false;
    ass(RG.panel, R(34, py, 652, ph));
    // the host's back button floats at the top left: then the text-size buttons sit at the right
    const backR = ins.back ? ins.l + ins.back + 20 - FR.fox : 0;
    if (backR > 20) { ass(TEXT_DEC, R(W - 272, topY, 120, 74)); ass(TEXT_INC, R(W - 140, topY, 120, 74)); RG.pct = { x: W - 272 - 62, y: topY + 46 }; }
    else { ass(TEXT_DEC, R(20, topY, 120, 74)); ass(TEXT_INC, R(W - 140, topY, 120, 74)); RG.pct = { x: 360, y: topY + 46 }; }
    ass(REF_BACK, R(20, byBtn, 332, 100)); ass(REF_NEXT, R(368, byBtn, 332, 100));
    RG.hdr = { x: 360, y: py + 58, line: py + 78 };
    RG.vt = py + 100; RG.vb = py + ph - 52; RG.pageH = RG.vb - RG.vt - 38; RG.y0 = RG.vt + 20;
    RG.counter = { x: 360, y: py + ph - 22 };
  } else {
    const pw = Math.min(FR.sw - 40 - ins.l - ins.r, 1000), px = (W - pw) / 2 + (ins.l - ins.r) / 2, py = Math.max(10, ins.t + 6), ph = H - py - Math.max(10, ins.b + 6);
    RG.land = true;
    ass(RG.panel, R(px, py, pw, ph));
    ass(TEXT_INC, R(px + pw - 24 - 100, py + 6, 100, 70)); ass(TEXT_DEC, R(TEXT_INC.x - 12 - 100, py + 6, 100, 70));
    RG.pct = { x: TEXT_DEC.x - 44, y: py + 48 };
    const by = py + ph - 14 - 76;
    ass(REF_BACK, R(px + 24, by, 220, 76)); ass(REF_NEXT, R(px + pw - 24 - 220, by, 220, 76));
    RG.hdr = { x: px + pw / 2, y: py + 50, line: py + 82 };
    RG.vt = py + 92; RG.vb = by - 10; RG.pageH = RG.vb - RG.vt - 38; RG.y0 = RG.vt + 20;
    RG.counter = { x: px + pw / 2, y: by + 46 };
  }
  // ---- the set-up pins -------------------------------------------------------------------------------------------
  if (!land) { const y = H - 124 - bot; ass(SETUP_PINS.start, R(30, y, 440, 96)); ass(SETUP_PINS.back, R(486, y, 204, 96)); }
  else { const y = H - 84 - Math.max(8, ins.b); ass(SETUP_PINS.start, R(30, y, 440, 72)); ass(SETUP_PINS.back, R(486, y, 204, 72)); }
  return FR;
}
// Where a scrolling flow screen ends above the pinned buttons (set-up screen).
export const setupBottom = () => SETUP_PINS.start.y - (FR.land ? 10 : 26);

// The landscape title: hero art on the left, the buttons in a column on the right.
export function titleCol() {
  const colW = Math.max(330, Math.min(470, FR.sw * 0.34));
  return { colW, colX: FR.sw - colW - Math.max(28, FR.sw * 0.05) - FR.ins.r };
}
// The x origin (design units) of the column a flow screen is laid out in.
export const flowOrigin = (scene) => (FR.land && scene === 'title' ? titleCol().colX : FR.fox);


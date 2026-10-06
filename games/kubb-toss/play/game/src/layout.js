// Screen geometry in one place so game.js (hit-testing) and view.js / menus.js (drawing) never disagree.
// Fluid viewport (kit 1.7): the SHORT side of the screen is always 720 virtual units and the long side grows with the aspect ratio. So in portrait
// W = 720 and H = 1280 on a phone (the approved look), taller on tall phones, shorter on tablets; in landscape H = 720 and W grows. `setSize(w, h)` is
// called at the start of every update and render and only recomputes when the size or the host insets change. W and H are LIVE bindings.
//
// Shapes of the play screen (see view.js): tall / compact portrait (scoreboard on top, the lawn, controls below) and wide landscape (a left panel with the
// scoreboard and the status, the lawn in the middle, a right panel with the controls). The lawn itself is one fixed camera picture that is only ever scaled.
export let W = 720;
export let H = 1280;
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_SECS = 2;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (text never shrinks below ~11 css px, buttons stay about 44 css px tall).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

const rect = () => ({ x: 0, y: 0, w: 0, h: 0 });
const put = (r, x, y, w, h) => { r.x = x; r.y = y; r.w = w; r.h = h; return r; };
export const TEXT_DEC = rect(), TEXT_INC = rect(), REF_BACK = rect(), REF_NEXT = rect();
export const SETUP_PINS = { start: rect(), back: rect() };
export const PANEL = rect();
export const READER = { x: 0, y: 0, w: 0, h: 0, max: 0 };
export const readerMeta = () => READER;
// G: the rest of the live geometry (see build()).
export const G = { key: '', w: 720, h: 1280, land: false, mode: 'tall', tap: 58, U: { x0: 0, y0: 0, x1: 720, y1: 1280, w: 720, h: 1280 }, backBox: rect(), zoomLabel: { x: 360, y: 56 }, flow: {} };

// The pitch is designed in the window y = 230 .. 1130 of the 720 x 1280 scene (far stakes to the thrower's stand).
export const SCENE_Y0 = 230, SCENE_H = 900;
export const COMPACT = 1.5;   // the largest text scale that keeps the inline controls
// The baked picture of the lawn covers scene x -260 .. 980 and y -330 .. 1470 (more than the 720 x 1280 design, so tall and wide screens have grass too).
export const BAKE = { x: -260, y: -330, w: 1240, h: 1800 };

function build(w, h) {
  const ins = host, land = w > h;
  G.w = w; G.h = h; G.land = land;
  G.mode = land ? 'wide' : h >= 1480 ? 'tall' : 'compact';
  G.tap = Math.round(clamp(44 / Math.max(0.3, ins.px), 58, 84));
  const U = G.U; U.x0 = ins.l; U.y0 = ins.t; U.x1 = w - ins.r; U.y1 = h - ins.b; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  if (ins.back) put(G.backBox, ins.l, ins.t, backSz + 8, backSz + 8); else put(G.backBox, 0, 0, 0, 0);

  // ---- flow screens (title, settings, learn, result, ...): a centred column; two columns in a wide window -------------------------------------------------
  const fl = G.flow;
  fl.top = ins.t + (land ? 6 : G.backBox.h); fl.bottom = h - ins.b - (land ? 6 : 0);
  fl.top0 = fl.top;
  fl.bk = clamp(44 / (Math.max(0.3, ins.px) * 76), land ? 0.8 : 1, 1.16);
  fl.cx = (U.x0 + U.x1) / 2;
  if (!land) { fl.x1 = 40; fl.w1 = w - 80; fl.cols = 1; fl.x2 = 40; fl.w2 = w - 80; fl.gut = 0; }
  else {
    fl.w1 = clamp(U.w * 0.5, 440, 620); fl.x1 = fl.cx - fl.w1 / 2;
    fl.w2 = Math.min(U.w - 60, 1160); fl.x2 = fl.cx - fl.w2 / 2; fl.gut = 28; fl.cols = fl.w2 >= 900 ? 2 : 1;
    if (fl.cols === 1) { fl.x2 = fl.x1; fl.w2 = fl.w1; }
    if (ins.back && Math.min(fl.x1, fl.x2) < G.backBox.x + G.backBox.w + 8) fl.top += G.backBox.h;   // a narrow window: the column would run under the back button
  }
  // set-up screen: the two buttons are pinned under the list
  if (!land) {
    const ph = 96, py = h - Math.max(28, ins.b + 12) - ph, sw = Math.round((w - 60) * 0.62);
    put(SETUP_PINS.start, 30, py, sw, ph); put(SETUP_PINS.back, 30 + sw + 16, py, w - 60 - sw - 16, ph);
    fl.setupBottom = py - 26;
  } else {
    const ph = 76, py = h - Math.max(14, ins.b + 8) - ph, tw = fl.w2, sw = Math.round(tw * 0.62);
    put(SETUP_PINS.start, fl.x2, py, sw, ph); put(SETUP_PINS.back, fl.x2 + sw + 16, py, tw - sw - 16, ph);
    fl.setupBottom = py - 10;
  }

  // ---- the reference reader (About / How to Play / Rules): one scrolling document in a panel ---------------------------------------------------------------
  if (!land) {
    const topY = Math.max(18, ins.t + 8), decX = ins.back ? Math.max(20, G.backBox.x + G.backBox.w + 10) : Math.max(20, ins.l + 14), incX = w - Math.max(20, ins.r + 14) - 120;
    const th = Math.max(60, G.tap);
    put(TEXT_DEC, decX, topY, 120, th); put(TEXT_INC, incX, topY, 120, th);
    G.zoomLabel.x = (decX + 120 + incX) / 2; G.zoomLabel.y = topY + th / 2 + 8;
    const bh = 96, bY = h - Math.max(16, ins.b + 8) - bh, bw = Math.round((w - 56) / 2);
    put(REF_BACK, 20, bY, bw, bh); put(REF_NEXT, 20 + bw + 16, bY, w - 56 - bw, bh);
    put(PANEL, 16, topY + th + 22, w - 32, bY - 34 - (topY + th + 22));
  } else {
    const side = 190, pw = clamp(U.w - 2 * (side + 12), 480, 900), top = Math.max(10, ins.t + 6), bot = Math.max(10, ins.b + 6);
    put(PANEL, fl.cx - pw / 2, top, pw, h - top - bot);
    const lx = U.x0 + 14, lw = PANEL.x - 14 - lx, rx = PANEL.x + PANEL.w + 14, rw = U.x1 - 14 - rx, by = h - bot - 88;
    const y0 = ins.back ? G.backBox.y + G.backBox.h + 8 : top + 4, bw2 = (lw - 10) / 2;
    const th = Math.max(64, G.tap);
    put(TEXT_DEC, lx, y0, bw2, th); put(TEXT_INC, lx + bw2 + 10, y0, bw2, th);
    G.zoomLabel.x = lx + lw / 2; G.zoomLabel.y = y0 + th + 36;
    put(REF_BACK, lx, by, lw, 88); put(REF_NEXT, rx, by, rw, 88);
  }
  put(READER, PANEL.x, PANEL.y + 92, PANEL.w, PANEL.h - 108);
}
let curKey = '';
export function setSize(w, h) {
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${host.px.toFixed(2)}`;
  if (key === curKey) return false;
  curKey = key; W = w; H = h; G.key = key;
  build(w, h);
  return true;
}

// The scene-to-screen map of the background lawn behind menus, the title and the reader (screen = scene * s + (tx, ty)): portrait shows the 720-wide picture
// bottom aligned; landscape fits the height and centres it at x (default the middle).
export function menuView(cx = null) {
  if (!G.land) return { s: 1, tx: (W - 720) / 2, ty: H - 1280 };
  const s = Math.max(0.5, (H - 8) / 905), x = cx == null ? W / 2 : cx;
  return { s, tx: x - 360 * s, ty: 4 - 240 * s };
}
export const toScene = (lay, x, y) => ({ x: (x - lay.vx) / lay.s, y: (y - lay.vy) / lay.s + SCENE_Y0 });

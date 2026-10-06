// Screen geometry: one place for every rectangle so game.js (hit-testing) and the drawing code never disagree.
// Fluid viewport (kit 1.7): the SHORT side of the screen is always 720 virtual units and the long side grows with the aspect ratio, so portrait is
// 720 x 1280 on a phone (the approved look), taller on tall phones and shorter on tablets, and landscape is 720 high and wider. `setSize(w, h)` is called at
// the start of every update and render and only recomputes when the size or the host insets change. W and H are LIVE bindings.
//
// Shapes of the play screen: portrait / compact (scoreboard on top, the 3D court, controls in a bar below) and landscape (scoreboard on top in the middle,
// the court between two side panels: choices and the action button on the right edge, Think and Pause on the left edge).
import { setVirtual } from './camera.js';

export let W = 720;
export let H = 1280;
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

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
export const G = { key: '', w: 720, h: 1280, land: false, mode: 'tall', tap: 58, side: 1, rightW: 0, U: { x0: 0, y0: 0, x1: 720, y1: 1280, w: 720, h: 1280 }, backBox: rect(), zoomLabel: { x: 360, y: 56 }, flow: {} };

// The in-play HUD follows the text-size setting (100-300%) through a gentler multiplier so the court stays visible.
export const PLAY_M = [1, 1.25, 1.5, 1.75, 2];

function build(w, h) {
  const ins = host, land = w > h;
  G.w = w; G.h = h; G.land = land;
  G.mode = land ? 'wide' : h >= 1480 ? 'tall' : 'compact';
  G.tap = Math.round(clampN(46 / Math.max(0.3, ins.px), 58, 96));
  const U = G.U; U.x0 = ins.l; U.y0 = ins.t; U.x1 = w - ins.r; U.y1 = h - ins.b; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  if (ins.back) put(G.backBox, ins.l, ins.t, backSz + 8, backSz + 8); else put(G.backBox, 0, 0, 0, 0);
  G.rightW = land ? clampN(Math.round(w * 0.27), 250, 350) : 0;
  G.side = land ? clampN((w - 2 * (G.rightW + 16)) / w, 0.3, 1) : 1;
  setVirtual(w, h, G.side);

  // ---- flow screens (title, setup, settings, learn, result, ...): a centred column --------------------------------------------------------
  const fl = G.flow;
  fl.top = ins.t + (land ? 6 : G.backBox.h); fl.bottom = h - ins.b - (land ? 6 : 0);
  fl.top0 = fl.top;
  fl.bk = clampN(46 / (Math.max(0.3, ins.px) * 76), land ? 0.8 : 1, 1.3);
  fl.cx = (U.x0 + U.x1) / 2;
  if (!land) { fl.w1 = Math.min(640, U.w - 56); fl.x1 = fl.cx - fl.w1 / 2; fl.w2 = fl.w1; fl.x2 = fl.x1; }
  else {
    fl.w1 = clampN(U.w * 0.46, 440, 640); fl.x1 = fl.cx - fl.w1 / 2;
    fl.w2 = clampN(U.w - 120, 440, 800); fl.x2 = fl.cx - fl.w2 / 2;
    if (ins.back && fl.x2 < G.backBox.x + G.backBox.w + 8) fl.top += G.backBox.h;
  }
  // set-up screen: the two buttons are pinned under the list
  if (!land) {
    const ph = Math.round(clampN(46 / Math.max(0.3, ins.px), 96, 110)), py = h - Math.max(28, ins.b + 12) - ph, tw = fl.w2, sw = Math.round((tw - 16) * 0.68);
    put(SETUP_PINS.start, fl.x2, py, sw, ph); put(SETUP_PINS.back, fl.x2 + sw + 16, py, tw - sw - 16, ph);
    fl.setupBottom = py - 26;
  } else {
    const ph = Math.round(clampN(46 / Math.max(0.3, ins.px), 76, 96)), py = h - Math.max(14, ins.b + 8) - ph, tw = fl.w2, sw = Math.round((tw - 16) * 0.62);
    put(SETUP_PINS.start, fl.x2, py, sw, ph); put(SETUP_PINS.back, fl.x2 + sw + 16, py, tw - sw - 16, ph);
    fl.setupBottom = py - 10;
  }

  // ---- the reference reader (About / How to Play / Rules): one scrolling document in a panel -----------------------------------------------
  if (!land) {
    const topY = Math.max(18, ins.t + 8), decX = ins.back ? Math.max(20, G.backBox.x + G.backBox.w + 10) : Math.max(20, ins.l + 14), incX = w - Math.max(20, ins.r + 14) - 120;
    const th = Math.max(60, G.tap);
    put(TEXT_DEC, decX, topY, 120, th); put(TEXT_INC, incX, topY, 120, th);
    G.zoomLabel.x = (decX + 120 + incX) / 2; G.zoomLabel.y = topY + th / 2 + 8;
    const bh = 96, bY = h - Math.max(16, ins.b + 8) - bh, bw = Math.round((w - 56) / 2);
    put(REF_BACK, 20, bY, bw, bh); put(REF_NEXT, 20 + bw + 16, bY, w - 56 - bw, bh);
    put(PANEL, 16, topY + th + 22, w - 32, bY - 34 - (topY + th + 22));
  } else {
    const side = 190, pw = clampN(U.w - 2 * (side + 12), 480, 900), top = Math.max(10, ins.t + 6), bot = Math.max(10, ins.b + 6);
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
setSize(720, 1280);

// ---- the play HUD ----------------------------------------------------------------------------------------------------------------------
// n = number of choice buttons, hasAction = SMASH/SERVE button present. When the chosen text size would squeeze the court too much on this screen, the
// HUD steps down to the next smaller size (the text size setting itself is untouched and still applies everywhere else).
export function hudLayout(idx, n, hasAction, perRowFixed = 0) {
  let i = clampN(idx | 0, 0, PLAY_M.length - 1);
  for (;;) { const r = G.land ? buildLand(i, n, hasAction) : buildPortrait(i, n, hasAction, perRowFixed); if (r.fits || i === 0) return r; i--; }
}

function buildPortrait(i, n, hasAction, perRowFixed) {
  const m = PLAY_M[i], ins = host;
  const topH = Math.round(ins.t + 30 + 90 * m);
  const rowH = Math.max(Math.round(84 + 16 * (m - 1)), Math.min(100, Math.round(46 / Math.max(0.3, ins.px))));
  const gap = 10;
  const small = Math.max(Math.round(70 + 18 * (m - 1)), Math.min(100, Math.round(46 / Math.max(0.3, ins.px))));
  const mx0 = Math.max(14, ins.l + 8), mx1 = Math.max(14, ins.r + 8), iw = W - mx0 - mx1;
  const bottom = H - Math.max(14, ins.b + 6);
  const util = { think: null, pause: null };
  const uy = bottom - small;
  const uw = (iw - gap) / 2;
  util.think = { x: mx0, y: uy, w: uw, h: small };
  util.pause = { x: mx0 + uw + gap, y: uy, w: uw, h: small };
  let y = uy - gap;
  let action = null;
  if (hasAction) { const ah = Math.round(116 + 30 * (m - 1)); y -= ah; action = { x: mx0, y, w: iw, h: ah }; y -= gap; }
  const choices = [];
  if (n > 0) {
    const perRow = perRowFixed || (m >= 1.5 && n > 3 ? Math.ceil(n / 2) : n);
    const rows = Math.ceil(n / perRow);
    for (let r = rows - 1; r >= 0; r--) {
      const cnt = Math.min(perRow, n - r * perRow);
      const cw = (iw - gap * (cnt - 1)) / cnt;
      y -= rowH;
      for (let k = 0; k < cnt; k++) choices.push({ idx: r * perRow + k, rect: { x: mx0 + k * (cw + gap), y, w: cw, h: rowH } });
      y -= gap;
    }
    choices.sort((a, b) => a.idx - b.idx);
  }
  const barTop = y + gap;
  const courtBottom = barTop - 6;
  const region = courtBottom - topH;
  const px30 = Math.max(30, ins.l + 10), pw30 = W - px30 - Math.max(30, ins.r + 10);
  const prompt = { x: px30, y: topH + 6, w: pw30, cx: px30 + pw30 / 2, m: Math.min(m, 1.6) };
  const banner = { cx: W / 2, y: Math.round(topH + region * 0.3), w: W - 80 };
  // Watch & Learn: the info panel above the buttons, and Pause / - think / + think / Exit (two rows when text is large)
  const big = m >= 1.5, bh = util.think.h, y1 = util.think.y;
  const watchRects = [];
  if (big) { const hw = (iw - gap) / 2; [[mx0, y1 - bh - gap], [mx0 + hw + gap, y1 - bh - gap], [mx0, y1], [mx0 + hw + gap, y1]].forEach(([x, yy]) => watchRects.push({ x, y: yy, w: hw, h: bh })); }
  else { const qw = (iw - 3 * gap) / 4; for (let k = 0; k < 4; k++) watchRects.push({ x: mx0 + k * (qw + gap), y: y1, w: qw, h: bh }); }
  const winfo = { x: 20, w: W - 40, bottom: watchRects[0].y - 12, cx: W / 2, top: topH + 10 };
  return { idx: i, m, land: false, topH, rowH, util, action, choices, barTop, courtBottom, prompt, banner, watchRects, winfo, fits: region >= H * 0.34 };
}

function buildLand(i, n, hasAction) {
  const m = PLAY_M[i], ins = host, px = Math.max(0.3, ins.px);
  const bh = Math.round(clampN(46 / px, 58, 96) * (1 + 0.18 * (m - 1)));
  const gap = 8;
  const mL = Math.max(14, ins.l + 8), mR = W - Math.max(14, ins.r + 8), mB = H - Math.max(10, ins.b + 6);
  const topH = Math.round(ins.t + 20 + 76 * m);
  const rw = G.rightW, px0 = mR - rw;
  const lw = clampN(Math.round(W * 0.17), 170, 230);
  // right edge: the action button at the bottom, the choices stacked above it (in two columns, filled column by column, when one column is too tall)
  let y = mB;
  let action = null;
  if (hasAction) { const ah = Math.round(clampN(bh * 1.4, 92, 170)); y -= ah; action = { x: px0, y, w: rw, h: ah }; y -= gap; }
  const yBase = y;
  const stack = (cols) => {
    const rows = Math.ceil(n / cols), cw = (rw - gap * (cols - 1)) / cols, list = [];
    for (let k = 0; k < n; k++) { const col = cols === 1 ? 0 : Math.floor(k / rows), row = cols === 1 ? k : k % rows; list[k] = { idx: k, rect: { x: px0 + col * (cw + gap), y: yBase - (rows - row) * (bh + gap) + gap - gap, w: cw, h: bh } }; }
    return { list, top: yBase - rows * (bh + gap) + gap };
  };
  let st = stack(1);
  if (st.top < topH + 8 && n > 1) st = stack(2);
  const choices = st.list, stackTop = st.top;
  // left edge: Think above Pause
  const util = { pause: { x: mL, y: mB - bh, w: lw, h: bh }, think: { x: mL, y: mB - 2 * bh - gap, w: lw, h: bh } };
  const cw = clampN(Math.min(2 * (px0 - 20 - W / 2), 2 * (W / 2 - lw - mL - 20)), 300, 640);
  const prompt = { x: W / 2 - cw / 2, y: topH + 6, w: cw, cx: W / 2, m: Math.min(m, 1.4) };
  const banner = { cx: W / 2, y: Math.round(topH + (H - topH) * 0.26), w: Math.min(cw + 120, 760) };
  // Watch & Learn: four stacked buttons on the right, the info panel on the left
  const wh = bh, watchRects = [];
  for (let k = 3; k >= 0; k--) watchRects[k] = { x: px0, y: mB - (4 - k) * wh - (3 - k) * gap, w: rw, h: wh };
  const iwid = clampN(Math.round(W * 0.3), 270, 440);
  const winfo = { x: mL, w: iwid, bottom: mB, cx: mL + iwid / 2, top: topH + 10 };
  return { idx: i, m, land: true, topH, rowH: bh, util, action, choices, barTop: H, courtBottom: H, prompt, banner, watchRects, winfo, panelX: px0, fits: stackTop >= topH + 8 };
}

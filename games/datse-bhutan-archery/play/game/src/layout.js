// Screen geometry in one place so game.js (hit-testing), menus.js and view.js (drawing) never disagree.
// Kit fluid viewport: the SHORT side is always 720 virtual units, the long side follows the screen. W and H are LIVE bindings; syncLayout() recomputes every
// rectangle IN PLACE (the exported objects keep their identity).
//   portrait  scoreboard on top, the 3D view, the sight lens, the controls in a row at the bottom with the big DRAW button on the right.
//   landscape the 3D view on the left with the scoreboard, a column on the right with the sight lens on top and the controls below it.
// Safe areas and the host's floating back button come from `host` (kept current by main.js). Browsers: zeros.
export let W = 720;
export let H = 1280;
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.54 };
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const inCircle = (c, x, y) => !!c && Math.hypot(x - c.cx, y - c.cy) <= c.r;
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_SECS = 2;
const R = (x, y, w, h) => ({ x, y, w, h });
const set = (o, x, y, w, h) => { o.x = x; o.y = y; o.w = w; o.h = h; return o; };
export const REF_BACK = R(20, 1164, 332, 100);
export const REF_NEXT = R(368, 1164, 332, 100);
export const TEXT_DEC = R(20, 18, 120, 60);
export const TEXT_INC = R(580, 18, 120, 60);
export const SETUP_PINS = { start: R(30, 1156, 440, 96), back: R(486, 1156, 204, 96) };
export const READ = { panel: R(10, 100, 700, 1030), view: R(10, 196, 700, 914), label: { x: 360, y: 48 }, bar: R(0, 0, 0, 0) };
export const estWidth = (text, px) => String(text).length * px * 0.54;
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

export const LY = {
  key: '', w: 720, h: 1280, land: false, mode: 'tall', U: { x: 0, y: 0, w: 720, h: 1280, x0: 0, y0: 0, x1: 720, y1: 1280 }, tap: 60, minText: 22, backSz: 0,
  col: { x: 40, w: 640 }, flowTop: 0, flowBottom: 1280, title: { hero: null, col: { x: 40, w: 640 }, heroH: 560 }, setupBottom: 1130,
  card: { x: 60, w: 600, top: 70, bottom: 1210, panelX: 30, panelW: 660 }, watchPause: R(480, 1196, 220, 64), toast: R(60, 1090, 600, 52), hintPane: null,
};

// the play screen: every rectangle the HUD and the touch handling use
export const PLAY = {
  key: '', hs: 1, fonts: {}, land: false,
  sb: R(0, 0, 720, 100), wind: R(0, 0, 150, 150), msg: R(0, 0, 400, 60),
  lens: { x: 0, y: 0, w: 480, h: 480, cx: 0, cy: 0, r: 240 },
  draw: { cx: 0, cy: 0, r: 70 }, zoom: R(0, 0, 120, 80), think: R(0, 0, 120, 80), menu: R(0, 0, 120, 80), zoomIn: R(0, 0, 60, 60),
  aimArea: R(0, 0, 720, 600), view: R(0, 0, 720, 600), ctlRow: R(0, 0, 720, 150),
};

export function syncLayout(w, h) {
  w = Math.round(w) || 720; h = Math.round(h) || 1280;
  const hk = `${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${host.px.toFixed(3)}`;
  const key = `${w}x${h}|${hk}`;
  if (key === LY.key) return false;
  W = w; H = h;
  const land = w > h;
  const vpc = 1 / Math.max(0.2, host.px);
  const U = { x: host.l, y: host.t, w: w - host.l - host.r, h: h - host.t - host.b }; U.x0 = U.x; U.y0 = U.y; U.x1 = U.x + U.w; U.y1 = U.y + U.h;
  const tap = clampN(Math.round(44 * vpc), 56, 84);
  const backSz = host.back ? Math.max(host.back, 56) + 12 : 0;
  Object.assign(LY, { key, w, h, land, U, tap, backSz, minText: Math.max(16, Math.round(11 * vpc)), mode: land ? 'wide' : h >= 1500 ? 'tall' : 'compact' });
  const cx = (U.x0 + U.x1) / 2;
  const colW = land ? clampN(U.w - 2 * 120, 520, 700) : Math.min(640, U.w - 2 * 40);
  LY.col = { x: Math.round(cx - colW / 2), w: colW };
  LY.flowTop = U.y0 + (!land && backSz ? backSz : 0);
  LY.flowBottom = U.y1;
  const pinH = land ? Math.max(tap, 72) : 96;
  const pinY = U.y1 - (land ? 12 : 20) - pinH;
  const pinX = LY.col.x - 10, pinW = LY.col.w + 20, sw = Math.round(pinW * 0.68);
  set(SETUP_PINS.start, pinX, pinY, sw, pinH); set(SETUP_PINS.back, pinX + sw + 16, pinY, pinW - sw - 16, pinH);
  LY.setupBottom = pinY - 22;
  if (land) {
    const colX = Math.round(U.x0 + U.w * 0.5 + 10), cw = clampN(Math.min(560, U.x1 - 20 - colX), 320, 560);
    LY.title = { hero: R(U.x0 + 24, U.y0 + 12, Math.round(U.w * 0.5) - 30, U.h - 24), col: { x: colX, w: cw }, heroH: 0 };
  } else LY.title = { hero: null, col: LY.col, heroH: clampN(Math.round(h * (h < 1100 ? 0.3 : 0.34)), 260, 520) };
  { const cw = land ? Math.min(660, U.w - 80) : Math.min(600, U.w - 120); LY.card = { x: Math.round(cx - cw / 2), w: cw, top: U.y0 + (land ? 18 : 70), bottom: U.y1 - (land ? 18 : 70), panelX: Math.round(cx - cw / 2) - 30, panelW: cw + 60 }; }
  set(LY.watchPause, U.x1 - 14 - 220, U.y1 - 12 - Math.max(64, tap), 220, Math.max(64, tap));
  { const tw = Math.min(600, U.w - 60); set(LY.toast, Math.round(cx - tw / 2), land ? U.y0 + 150 : U.y1 - 170, tw, 52); }
  {
    const ph = Math.max(58, Math.min(tap, 70)), bh = land ? 76 : 92, pw = 100;
    const topY = U.y0 + 10;
    set(TEXT_INC, U.x1 - 14 - pw, topY, pw, ph); set(TEXT_DEC, TEXT_INC.x - 10 - 96 - 10 - pw, topY, pw, ph);
    READ.label = { x: TEXT_DEC.x + pw + 10 + 48, y: topY + ph / 2 };
    const btnY = U.y1 - 14 - bh;
    const pwid = land ? clampN(U.w - 2 * 110, 520, 920) : U.w - 20;
    const py = topY + ph + 10;
    set(READ.panel, Math.round(cx - pwid / 2), py, pwid, btnY - 10 - py);
    const bw = Math.min(340, Math.round((pwid - 16) / 2));
    set(REF_BACK, Math.round(cx - bw - 8), btnY, bw, bh); set(REF_NEXT, Math.round(cx + 8), btnY, bw, bh);
    set(READ.view, READ.panel.x, READ.panel.y + 96, READ.panel.w, READ.panel.h - 96 - 16);
    set(READ.bar, READ.panel.x + READ.panel.w - 30, READ.view.y, 26, READ.view.h);
  }
  PLAY.key = '';
  return true;
}

// Build the play layout for the live size and the text size.
export function setPlayLayout(textIdx) {
  const idx = clampN(textIdx | 0, 0, TEXT_SCALES.length - 1);
  const key = `${idx}:${LY.key}`;
  if (key === PLAY.key) return false;
  PLAY.key = key;
  const U = LY.U, land = LY.land, tap = LY.tap, hs = TEXT_SCALES[idx], hf = Math.min(hs, land ? 1.4 : 1.6);
  PLAY.hs = hs; PLAY.land = land;
  const fn = Math.round(24 * hf), fs = Math.round(54 * Math.min(hf, 1.4)), fi = Math.round(22 * Math.min(hf, 1.8)), fb = Math.round(26 * Math.min(hs, land ? 1.6 : 2.0));
  PLAY.fonts = { name: fn, score: fs, info: fi, btn: fb };
  const sbH = Math.round(Math.max(96, fs * 0.9 + fn * 1.25 + 30));
  const sbX = U.x0 + 8 + LY.backSz, sbY = U.y0 + 8;
  const cb = Math.max(tap, Math.round(fb * 1.1 + 34), 76);                     // small control button height
  const dr = Math.round(clampN(U.w * (land ? 0.075 : 0.105), 58, 86));          // DRAW button radius
  if (!land) {
    set(PLAY.sb, sbX, sbY, U.x1 - 8 - sbX, sbH);
    const rowH = Math.max(dr * 2 + 12, cb + 12), rowY = U.y1 - 10 - rowH;
    set(PLAY.ctlRow, U.x0 + 8, rowY, U.w - 16, rowH);
    PLAY.draw.r = dr; PLAY.draw.cx = U.x1 - 14 - dr; PLAY.draw.cy = rowY + rowH / 2;
    const bw = Math.floor((PLAY.draw.cx - dr - 14 - (U.x0 + 12) - 2 * 10) / 3);
    const by = rowY + rowH / 2 - cb / 2;
    set(PLAY.menu, U.x0 + 12, by, bw, cb); set(PLAY.think, U.x0 + 12 + bw + 10, by, bw, cb); set(PLAY.zoom, U.x0 + 12 + 2 * (bw + 10), by, bw, cb);
    const free = rowY - (sbY + sbH) - 10;
    const side = Math.round(clampN(Math.min(U.w * 0.8, free * 0.47), 280, 640));
    const lx = Math.round((U.x0 + U.x1) / 2 - side / 2), ly = rowY - 10 - side;
    set(PLAY.lens, lx, ly, side, side); PLAY.lens.cx = lx + side / 2; PLAY.lens.cy = ly + side / 2; PLAY.lens.r = side / 2;
    set(PLAY.view, 0, sbY + sbH + 6, w0(), Math.max(200, ly - 8 - (sbY + sbH + 6)));
    set(PLAY.wind, U.x0 + 10, PLAY.view.y + 6, 150, 150);
    set(PLAY.msg, U.x0 + 20, PLAY.view.y + PLAY.view.h - 70, U.w - 40, 62);
  } else {
    const side = Math.round(clampN(Math.min(U.h - cb - 64, U.w * 0.38), 260, 540)), colW = side + 24;
    const colX = U.x1 - 8 - colW;
    set(PLAY.sb, sbX, sbY, clampN(colX - sbX - 10, 470, 700), sbH);
    const lx = colX + 12, ly = U.y0 + 8;
    set(PLAY.lens, lx, ly, side, side); PLAY.lens.cx = lx + side / 2; PLAY.lens.cy = ly + side / 2; PLAY.lens.r = side / 2;
    const rowH = U.y1 - 8 - (ly + side + 8), rowY = ly + side + 8;
    set(PLAY.ctlRow, colX, rowY, colW, rowH);
    const dr2 = Math.min(dr, Math.floor(rowH / 2) - 2);
    PLAY.draw.r = dr2; PLAY.draw.cx = U.x1 - 16 - dr2; PLAY.draw.cy = rowY + rowH / 2;
    const bw = Math.floor((colW - 2 * dr2 - 16 - 2 * 8) / 3), bh = Math.min(rowH, Math.max(cb, 64)), by = rowY + rowH / 2 - bh / 2;
    set(PLAY.menu, colX + 8, by, bw, bh); set(PLAY.think, colX + 8 + bw + 8, by, bw, bh); set(PLAY.zoom, colX + 8 + 2 * (bw + 8), by, bw, bh);
    set(PLAY.view, 0, 0, colX - 6, H);
    set(PLAY.wind, sbX, sbY + sbH + 10, 150, 150);
    set(PLAY.msg, U.x0 + 20, U.y1 - 80, colX - U.x0 - 40, 62);
  }
  // the aiming area: the lens plus the free picture above the controls (a relative drag anywhere in it moves the reticle)
  set(PLAY.aimArea, PLAY.view.x, PLAY.view.y, PLAY.view.w, PLAY.view.h);
  return true;
}
function w0() { return LY.w; }
export function resetPlayLayout() { PLAY.key = ''; }

// the region the 3D camera composes the shooter and the valley in (virtual units): the free picture, never under the lens or the buttons
export function viewRegion() {
  const U = LY.U;
  if (LY.land) return { x: U.x0, y: U.y0, w: PLAY.view.w - U.x0, h: U.h };
  const y = PLAY.sb.y + PLAY.sb.h; return { x: 0, y, w: LY.w, h: Math.max(160, PLAY.lens.y - 6 - y) };
}

// A pure check over named rectangles: inside the safe area, no two overlapping, tap targets tall enough. Returns a list of problem strings.
export function rectProblems(named, U = LY.U) {
  const out = [], keys = Object.keys(named).filter((k) => named[k]), tapMin = Math.min(56, 44 / Math.max(0.2, host.px) * 0.9);
  for (const k of keys) {
    const r = named[k];
    if (r.x < U.x0 - 0.5 || r.y < U.y0 - 0.5 || r.x + r.w > U.x1 + 0.5 || r.y + r.h > U.y1 + 0.5) out.push(`${k} outside the safe area`);
    if (r.btn && r.h < tapMin) out.push(`${k} too short (${Math.round(r.h)})`);
  }
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const a = named[keys[i]], b = named[keys[j]];
    if (a.nox || b.nox) continue;
    if (a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5) out.push(`${keys[i]} overlaps ${keys[j]}`);
  }
  return out;
}

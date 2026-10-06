// Screen geometry in one place so game.js (hit-testing), menus.js and view.js (drawing) never disagree.
// Kit 1.7 fluid viewport: the SHORT side is always 720 virtual units, the long side follows the screen. `W` and `H` are LIVE bindings
// (ES module live exports): every module that imports them sees the current size. `syncLayout(w, h)` (called at the top of update and
// render) recomputes every rectangle below IN PLACE, so the exported objects (PLAY, REF_BACK, SETUP_PINS, ...) keep their identity.
//   tall     portrait phone (the approved look): scoreboard on top, the 3D field, controls and Think / Menu at the bottom.
//   compact  portrait tablet / short window: same pieces, the field region is a little smaller.
//   wide     landscape: the 3D field fills the screen, scoreboard top-left, Think / Menu top-right, the thumb buttons in a column on the right edge.
// Safe areas and the host's floating back button come from `host` (kept current by main.js). Browsers: zeros.
export let W = 720;
export let H = 1280;
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.54 };
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_SECS = 2;
const R = (x, y, w, h) => ({ x, y, w, h });
const set = (o, x, y, w, h) => { o.x = x; o.y = y; o.w = w; o.h = h; return o; };
export const REF_BACK = R(20, 1164, 332, 100);
export const REF_NEXT = R(368, 1164, 332, 100);
export const TEXT_DEC = R(20, 18, 120, 60);
export const TEXT_INC = R(580, 18, 120, 60);
export const SETUP_PINS = { start: R(30, 1156, 440, 96), back: R(486, 1156, 204, 96) };
// the reader (Rules / How to Play / About): panel, scrolling view, percent label, scroll bar track
export const READ = { panel: R(10, 100, 700, 1030), view: R(10, 196, 700, 914), label: { x: 360, y: 48 }, bar: R(0, 0, 0, 0) };
export const estWidth = (text, px) => String(text).length * px * 0.54;
export function estLines(text, px, maxW) {
  const words = String(text).split(' '), lines = [];
  let line = '';
  for (const w of words) { const next = line ? `${line} ${w}` : w; if (line && estWidth(next, px) > maxW) { lines.push(line); line = w; } else line = next; }
  if (line) lines.push(line);
  return lines;
}
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

// The current layout facts (mutated in place): mode, safe area U, tap size, flow column, title pieces, card box, watch buttons, toast.
export const LY = {
  key: '', w: 720, h: 1280, land: false, mode: 'tall', U: { x: 0, y: 0, w: 720, h: 1280, x0: 0, y0: 0, x1: 720, y1: 1280 }, tap: 60, minText: 22, backSz: 0,
  col: { x: 40, w: 640 }, flowTop: 0, flowBottom: 1280, title: { hero: null, col: { x: 40, w: 640 }, heroH: 560 }, setupBottom: 1130,
  card: { x: 60, w: 600, top: 70, bottom: 1210, panelX: 30, panelW: 660 }, watchPause: R(480, 1196, 220, 64), toast: R(60, 1090, 600, 52), callPane: null,
};

// The play screen follows the text size: the scoreboard and the buttons grow, the 3D view takes what is left (never below VIEW_MIN in portrait).
// `view` = where a touch starts the move stick; `cam` = the region the 3D camera fits the whole field into (the canvas itself fills the screen).
export const PLAY = { key: '', hs: 1, fonts: {}, sb: R(0, 44, 720, 84), info: R(14, 130, 692, 40), view: R(0, 176, 720, 880), cam: R(0, 176, 720, 880), ctl: R(14, 1066, 692, 100), bar: R(14, 1196, 692, 68), think: R(14, 1196, 336, 68), menu: R(370, 1196, 336, 68), cols: 4, btnH: 100, scroll: { x: 14, y: 1066, w: 692, h: 100, contentH: 100 }, land: false, panelX: 720, gap: 10 };
export const VIEW_MIN = 300;

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
  // ---- the flow column (title, setup, settings, learn, result, call) ------------------------------------------------------------------------------
  const colW = land ? clampN(U.w - 2 * 120, 520, 700) : Math.min(640, U.w - 2 * 40);
  LY.col = { x: Math.round(cx - colW / 2), w: colW };
  LY.flowTop = U.y0 + (!land && backSz ? backSz : 0);
  LY.flowBottom = U.y1;
  const pinH = land ? Math.max(tap, 72) : 96;
  const pinY = U.y1 - (land ? 12 : 20) - pinH;
  const pinX = LY.col.x - 10, pinW = LY.col.w + 20, sw = Math.round(pinW * 0.68);
  set(SETUP_PINS.start, pinX, pinY, sw, pinH); set(SETUP_PINS.back, pinX + sw + 16, pinY, pinW - sw - 16, pinH);
  LY.setupBottom = pinY - 22;
  // title: hero art left + buttons right (landscape), hero above (portrait)
  if (land) {
    const colX = Math.round(U.x0 + U.w * 0.5 + 10), cw = clampN(Math.min(560, U.x1 - 20 - colX), 320, 560);
    LY.title = { hero: R(U.x0 + 24, U.y0 + 12, Math.round(U.w * 0.5) - 30, U.h - 24), col: { x: colX, w: cw }, heroH: 0 };
  } else LY.title = { hero: null, col: LY.col, heroH: clampN(Math.round(h * (h < 1100 ? 0.4 : 0.44)), 330, 560) };
  // call screen, landscape: the diagram + advice at the left, the play buttons at the right
  if (land) {
    const gap = 24, rw = clampN(Math.round(U.w * 0.38), 360, 520), lw = clampN(U.w - 2 * 24 - gap - rw, 380, 620);
    const x0 = Math.round(cx - (lw + gap + rw) / 2);
    LY.callPane = { left: { x: x0, w: lw }, right: { x: x0 + lw + gap, w: rw } };
  } else LY.callPane = null;
  // cards (pause, Think, lesson, position): centred, as tall as they need
  { const cw = land ? Math.min(660, U.w - 80) : Math.min(600, U.w - 120); LY.card = { x: Math.round(cx - cw / 2), w: cw, top: U.y0 + (land ? 18 : 70), bottom: U.y1 - (land ? 18 : 70), panelX: Math.round(cx - cw / 2) - 30, panelW: cw + 60 }; }
  // Watch & Learn call screen: pause button bottom-right; toast above the controls
  set(LY.watchPause, U.x1 - 14 - 220, U.y1 - 12 - Math.max(64, tap), 220, Math.max(64, tap));
  { const tw = Math.min(600, U.w - 60); set(LY.toast, Math.round(cx - tw / 2), land ? U.y0 + 150 : U.y1 - 170, tw, 52); }

  // ---- the reader --------------------------------------------------------------------------------------------------------------------------------------------
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

// Build the play layout for the live size, the text size, the number of buttons and the number of situation lines.
export function setPlayLayout(textIdx, nButtons = 4, infoLines = 1) {
  const idx = clampN(textIdx | 0, 0, TEXT_SCALES.length - 1);
  const key = `${idx}:${nButtons}:${infoLines}:${LY.key}`;
  if (key === PLAY.key) return false;
  PLAY.key = key;
  const U = LY.U, land = LY.land, tap = LY.tap;
  const hs = TEXT_SCALES[idx];
  const hf = land ? Math.min(hs, 1.5) : hs;                               // landscape keeps the HUD compact: the field needs the room
  PLAY.hs = hs; PLAY.land = land;
  const fn = Math.round(22 * Math.min(hf, 1.6)), fs = Math.round(56 * Math.min(hf, 1.5)), fi = Math.round(21 * Math.min(hf, 2.4)), fb = Math.round(24 * hf);
  PLAY.fonts = { name: fn, score: fs, info: fi, btn: fb, clock: Math.round(34 * Math.min(hf, 1.6)) };
  const sbH = Math.round(Math.max(84, fs * 0.95 + fn * 1.2 + 22));
  const sbX = U.x0 + 8 + LY.backSz, sbY = U.y0 + (land ? 8 : 10);
  const ih = Math.round(fi * 1.35 * infoLines + 8);
  const bh = Math.round(Math.max(tap, fb * 1.1 + 30, land ? 60 : 68));
  const gap = 10; PLAY.gap = gap;
  const btnH0 = Math.round(Math.max(land ? 72 : 96, fb * 1.15 + (land ? 28 : 36)));
  if (!land) {
    set(PLAY.sb, sbX, sbY, U.x1 - 8 - sbX, sbH);
    set(PLAY.info, U.x0 + 14, sbY + sbH + 4, U.w - 28, ih);
    const top = PLAY.info.y + ih + 4;
    const by = U.y1 - 16 - bh;
    set(PLAY.bar, U.x0 + 14, by, U.w - 28, bh);
    const hw = Math.round((U.w - 28 - 20) / 2);
    set(PLAY.think, U.x0 + 14, by, hw, bh); set(PLAY.menu, U.x0 + 14 + hw + 20, by, hw, bh);
    const maxCtl = by - gap - (top + VIEW_MIN);
    // every button stays reachable: more columns first, then shorter buttons (the label shrinks to fit)
    let cols = hs <= 1.25 ? Math.max(1, Math.min(5, nButtons)) : hs <= 2 ? 2 : 1, btnH = btnH0;
    const need = (c, bH) => Math.ceil(nButtons / c) * bH + (Math.ceil(nButtons / c) - 1) * gap;
    while (need(cols, btnH) > maxCtl && cols < Math.min(5, nButtons)) cols++;
    if (need(cols, btnH) > maxCtl) { const rr = Math.ceil(nButtons / cols); btnH = Math.max(tap, Math.floor((maxCtl - (rr - 1) * gap) / rr)); }
    PLAY.cols = cols; PLAY.btnH = btnH;
    const rows = Math.ceil(nButtons / cols), ch = rows * btnH + (rows - 1) * gap;
    const visH = Math.min(ch, Math.max(btnH, maxCtl)), cy = by - gap - visH;
    set(PLAY.ctl, U.x0 + 14, cy, U.w - 28, visH);
    Object.assign(PLAY.scroll, { x: U.x0 + 14, y: cy, w: U.w - 28, h: visH, contentH: ch });
    set(PLAY.view, 0, top, LY.w, Math.max(VIEW_MIN, cy - 6 - top));
    set(PLAY.cam, 0, top, LY.w, PLAY.view.h);
    PLAY.panelX = LY.w;
  } else {
    // landscape: scoreboard top-left, Think / Menu top-right, the thumb buttons in a column on the right edge, the whole screen is the field
    const pw = clampN(Math.round(U.w * 0.2), 220, 290), px = U.x1 - 12 - pw;
    PLAY.panelX = px;
    set(PLAY.sb, sbX, sbY, clampN(Math.round(U.w * 0.46), 440, 620), sbH);
    set(PLAY.info, sbX, sbY + sbH + 2, PLAY.sb.w, ih);
    const hw = Math.round((pw - 10) / 2);
    set(PLAY.think, px, U.y0 + 10, hw, bh); set(PLAY.menu, px + hw + 10, U.y0 + 10, hw, bh); set(PLAY.bar, px, U.y0 + 10, pw, bh);
    PLAY.cols = 1;
    const top = U.y0 + 10 + bh + 12, bottom = U.y1 - 12, avail = bottom - top;
    const rows = Math.max(1, nButtons), btnH = Math.max(52, Math.min(btnH0, Math.floor((avail - (rows - 1) * 8) / rows)));
    PLAY.btnH = btnH; PLAY.gap = 8;
    const ch = rows * btnH + (rows - 1) * 8, cy = bottom - ch;
    set(PLAY.ctl, px, cy, pw, ch);
    Object.assign(PLAY.scroll, { x: px, y: cy, w: pw, h: ch, contentH: ch });
    set(PLAY.view, 0, 0, px - 6, LY.h);
    // the camera fits the whole field into the area left of the buttons, below the very top
    const ct = Math.round(Math.min(sbY + sbH * 0.55, LY.h * 0.14));
    set(PLAY.cam, 0, ct, px - 6, LY.h - ct);
  }
  return true;
}
export function resetPlayLayout() { PLAY.key = ''; }

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

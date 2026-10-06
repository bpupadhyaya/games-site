// Geometry for every screen, as a pure function of the LIVE virtual size (kit 1.7 fluid viewport: the short side is always 720 units, the long
// side follows the screen). `layoutFor(w, h)` returns every rectangle and anchor for that size, cached by size + safe-area key; `syncLayout(w, h)`
// makes it current: it writes the live size (core.js W / H), the two fixed cameras (camera.js CAMS / VIEW) and the shared rect objects R,
// PAUSE_BTNS, THINK_OK, Z (so hud.js / game.js / screens.js keep reading `R.run` etc. and always see the current rectangles).
// Shapes:
//   portrait  w < h: the approved phone look. Top HUD fixed to the top, controls anchored to the bottom, extra height goes to the picture.
//   wide      w > h: landscape. Score top-left, pause/think top-right, radar right, thumb controls in the bottom corners, over strip bottom-left,
//             the field camera scaled to the height so the whole rope still fits.
// Nothing outside this file places things by absolute 720x1280 numbers any more (the fixed text sizes aside).
import { clamp, setSize } from './core.js';
import { CAMS, CAMS0, VIEW } from './camera.js';
import { DELIVERY_KEYS } from './ball.js';

// Safe areas (CSS px converted to virtual units) and the host's floating back button; main.js keeps this current. Browsers: zeros.
// px = css pixels per virtual unit (taps stay ~44 css px, text never shrinks below ~11 css px).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.54 };

const rect = (x, y, w, h) => ({ x, y, w, h });
// The shared, live rectangle sets (replaced in place by syncLayout)
export const R = {
  pause: rect(640, 38, 62, 58), think: rect(572, 38, 62, 58), run: rect(110, 1112, 500, 128), ready: rect(110, 1112, 500, 128),
  throwA: rect(18, 1112, 338, 128), throwB: rect(364, 1112, 338, 128), speed: rect(18, 1160, 190, 72), skip: rect(222, 1160, 190, 72),
  chips: [0, 1, 2].map((i) => ({ k: DELIVERY_KEYS[i], rect: rect(18 + i * 232, 1156, 224, 76) })),
  radar: rect(556, 168, 148, 196),
  autoPause: rect(238, 1160, 244, 72), autoDec: rect(492, 1160, 66, 72), autoInc: rect(566, 1160, 66, 72), exit: rect(18, 1160, 140, 72), autoSpeed: rect(640, 1160, 66, 72),
  catchBtn: rect(448, 1112, 254, 128),
};
export const PAUSE_BTNS = { resume: rect(0, 0, 1, 1), sound: rect(0, 0, 1, 1), textDec: rect(0, 0, 1, 1), textInc: rect(0, 0, 1, 1), rules: rect(0, 0, 1, 1), quit: rect(0, 0, 1, 1) };
export const THINK_OK = rect(200, 1040, 320, 70);
export const Z = { zoomDec: rect(16, 14, 100, 58), zoomInc: rect(604, 14, 100, 58) };

const cache = new Map();
export let LY = null;

export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${host.px.toFixed(3)}`;
  let L = cache.get(key);
  if (!L) {
    L = build(w, h, { ...host }); L.key = key; cache.set(key, L);
    if (cache.size > 40) cache.delete(cache.keys().next().value);
  }
  return L;
}

/** Make `w x h` the current layout (call at the top of update and render; cheap when nothing changed). */
export function syncLayout(w, h) {
  const L = layoutFor(w || 720, h || 1280);
  if (LY !== L) {
    LY = L;
    setSize(L.w, L.h);
    VIEW.w = L.w; VIEW.h = L.h;
    Object.assign(CAMS.bat, L.cams.bat); Object.assign(CAMS.field, L.cams.field);
    for (const k of Object.keys(L.R)) { if (k === 'chips') R.chips = L.R.chips; else R[k] = L.R[k]; }
    Object.assign(PAUSE_BTNS, L.pauseMenu.btn);
    Object.assign(THINK_OK, L.thinkCard.btn);
    Object.assign(Z, L.zoom.z);
  }
  return L;
}

// a similarity transform of a design camera: focal x k, the design point (ax, ay) lands on (bx, by)
const simil = (c, k, ax, ay, bx, by) => ({ f: c.f * k, cx: bx + (c.cx - ax) * k, cy: by + (c.cy - ay) * k });

function build(w, h, ins) {
  const land = w > h;
  const vpc = 1 / Math.max(0.2, ins.px);                          // virtual units per css px
  const minText = Math.max(16, Math.round(11 * vpc));             // smallest readable text, in virtual units (about 11 css px)
  const tap = clamp(Math.round(44 * vpc), 56, 84);                // a tap target about 44 css px
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const backSz = ins.back ? Math.max(ins.back, 56) + 12 : 0;      // the host's floating back button (top-left), only when it exists
  const cx = (U.x0 + U.x1) / 2;
  const L = { w, h, land, U, vpc, minText, tap, backSz, ins, cx, mode: land ? 'wide' : 'portrait' };
  const Rr = L.R = {};

  // ---- the two fixed cameras ------------------------------------------------------------------------------------------------------
  const b0 = CAMS0.bat, f0 = CAMS0.field;
  if (!land) {
    // portrait: the field fills the width at the design scale (the rope oval is 700 x 420 units at design size); it is centred a little above the middle
    const field = simil(f0, 1, 360, 600, w / 2, 600 + (h - 1280) * 0.45);
    if (h >= 1280) L.cams = { bat: simil(b0, 1, 360, 640, w / 2, 640 + (h - 1280) * 0.4), field };
    else L.cams = { bat: simil(b0, h / 1280, 360, 640, w / 2, h / 2), field };
  } else {
    // landscape: a wider batter's-eye lens (the whole composition scaled by 1.15 h / 1280); the field oval is scaled to fill about 66% of the height
    const kb = 1.15 * h / 1280, kf = clamp((h * 0.66) / 420, 0.6, 1.5);
    L.cams = { bat: simil(b0, kb, 360, 640, w / 2, h / 2), field: simil(f0, kf, 360, 600, w / 2, h / 2 + 36) };
  }

  // ---- scoreboard, pause, think ---------------------------------------------------------------------------------------------------
  const hx = U.x0 + 12 + backSz, hy = U.y0 + 14;
  const pause = rect(U.x1 - 12 - tap, hy, tap, tap), think = rect(pause.x - 8 - tap, hy, tap, tap);
  L.hud = { x: hx, y: hy, w: land ? Math.min(568, Math.max(420, U.w * 0.5 - backSz)) : think.x - 6 - hx };
  Rr.pause = pause; Rr.think = think;
  L.hud.textMaxW = L.hud.w - 44;

  // ---- bottom furniture -----------------------------------------------------------------------------------------------------------
  L.over = land ? { cx: U.x0 + 14 + 144, y: U.y1 - 24, r: 14, step: 36 } : { cx, y: U.y1 - 18, r: 15, step: 40 };
  const bot = land ? U.y1 - 14 : U.y1 - 40;                      // bottom edge of the big controls
  const bigH = land ? 112 : 128;
  const runY = bot - bigH;
  if (!land) {
    Rr.run = rect(cx - 250, runY, 500, bigH); Rr.ready = rect(cx - 250, runY, 500, bigH);
    const bw = Math.min(400, Math.floor((U.w - 44) / 2));
    Rr.throwA = rect(cx - 4 - bw, runY, bw, bigH); Rr.throwB = rect(cx + 4, runY, bw, bigH);
    Rr.catchBtn = rect(U.x1 - 18 - 254, runY, 254, bigH);
  } else {
    Rr.run = rect(U.x1 - 14 - 300, runY, 300, bigH); Rr.ready = rect(U.x1 - 14 - 340, runY, 340, bigH);
    const th = Math.max(tap, 88);
    Rr.throwB = rect(U.x1 - 14 - 340, bot - th, 340, th); Rr.throwA = rect(U.x1 - 14 - 340, bot - th - 10 - th, 340, th);
    Rr.catchBtn = rect(U.x1 - 14 - 280, runY, 280, bigH);
  }
  // left / row controls: chips, idle speed, Auto Play row
  const rowH = Math.max(tap, 72);
  const rowY = land ? L.over.y - L.over.r - 10 - rowH : U.y1 - 40 - rowH;
  L.rowY = rowY; L.rowH = rowH;
  {
    const x0 = U.x0 + 14, gap = 8;
    const cw = land ? 170 : Math.floor((U.w - 36 - gap * 2) / 3);
    Rr.chips = [0, 1, 2].map((i) => ({ k: DELIVERY_KEYS[i], rect: rect((land ? x0 : U.x0 + 18) + i * (cw + gap), rowY, cw, rowH) }));
    Rr.speed = rect(U.x0 + 18, rowY, 190, rowH); Rr.skip = rect(U.x0 + 18 + 200, rowY, 190, rowH);
    if (land) { Rr.speed.x = x0; Rr.skip.x = x0 + 200; }
  }
  {
    const g = 10, aw = { exit: 120, pause: 200 };
    const rowW = aw.exit + aw.pause + tap * 3 + g * 4;
    const ay = land ? U.y1 - 14 - rowH : rowY;
    const ax = land ? U.x1 - 14 - rowW : cx - rowW / 2;
    let x = ax;
    Rr.exit = rect(x, ay, aw.exit, rowH); x += aw.exit + g;
    Rr.autoPause = rect(x, ay, aw.pause, rowH); x += aw.pause + g;
    Rr.autoDec = rect(x, ay, tap, rowH); x += tap + g;
    Rr.autoInc = rect(x, ay, tap, rowH); x += tap + g;
    Rr.autoSpeed = rect(x, ay, tap, rowH);
    const a = L.auto = { row: rect(ax, ay, rowW, rowH), thinkY: ay - 8 };
    a.thinkX = (Rr.autoDec.x + Rr.autoInc.x + tap) / 2;
    const beside = land && ax - 14 - (U.x0 + 14) >= 440;
    a.card = beside ? { x: U.x0 + 14, w: Math.min(620, ax - 14 - (U.x0 + 14)), bottom: L.over.y - L.over.r - 10 } : { x: land ? U.x0 + 14 : cx - Math.min(342, (U.w - 36) / 2), w: Math.min(684, U.w - 28), bottom: ay - (land ? 14 : 20) - 20 };
    a.pausedY = land ? h * 0.45 : a.card.bottom - 150;
  }
  // radar (batting / bowling overview): right edge under pause / think (landscape) or under the scoreboard (portrait)
  Rr.radar = rect(U.x1 - 16 - 6 - 148, land ? hy + tap + 26 : 168, 148, 196);
  L.radarDyn = !land;     // portrait: pushed below the scoreboard text; landscape: fixed

  // ---- text lines and banners -----------------------------------------------------------------------------------------------------
  L.hint = land
    ? { cx, bat: U.y1 - 52, bowl: rowY - 14, ready: runY - 14, field: runY - 14, w: Math.min(690, U.w - 40) }
    : { cx, bat: runY - 6, bowl: rowY - 20, ready: runY - 22, field: runY - 32, w: Math.min(690, U.w - 24) };
  L.coach = land ? { x0: cx - 40, y0: h * 0.8, x1: cx + 110, y1: h * 0.42 } : { x0: cx - 60, y0: U.y1 - 320, x1: cx + 110, y1: U.y1 - 540 };
  L.call = land ? { x: cx, field: h * 0.34, bat: h * 0.34 } : { x: cx, field: U.y1 - 320, bat: 0 /* max(330, hudBottom + 130) computed in hud */ };
  L.chip = land ? { x: cx, bat: h * 0.56, field: h * 0.3 } : { x: cx, bat: h * 0.594, field: 300 };
  L.paused = { x: cx };

  // ---- think card -----------------------------------------------------------------------------------------------------------------
  {
    const bh = Math.max(70, tap);
    const cw = land ? Math.min(760, U.w - 48) : Math.min(672, U.w - 48);
    const by = land ? U.y1 - 14 - bh : U.y1 - 240;
    L.thinkCard = { x: Math.round(cx - cw / 2), w: cw, btn: rect(cx - 160, by, 320, bh), bottom: by - 10, cardBottom: by + bh + 20 };
  }

  // ---- pause menu -----------------------------------------------------------------------------------------------------------------
  {
    const bh = 92, step = 106;
    const m = { btn: {}, title: { x: cx, y: 0 }, label: { x: cx, y: 0 } };
    if (!land) {
      const fit = Math.min(1, (U.h - 30) / 694), s2 = step * fit, bh2 = Math.round(bh * fit);
      const top = U.y0 + (U.h - 694 * fit) / 2;                      // block top (title cap line)
      const y0 = top + 134 * fit;                                    // first button (orig 380 with the block starting at 246)
      m.title.y = top + 64 * fit;
      const bw = Math.min(400, U.w - 80);
      m.btn.resume = rect(cx - bw / 2, y0, bw, bh2); m.btn.sound = rect(cx - bw / 2, y0 + s2, bw, bh2);
      m.btn.textDec = rect(cx - bw / 2, y0 + 2 * s2, (bw - 20) / 2, bh2); m.btn.textInc = rect(cx + 10, y0 + 2 * s2, (bw - 20) / 2, bh2);
      m.btn.rules = rect(cx - bw / 2, y0 + 3 * s2, bw, bh2); m.btn.quit = rect(cx - bw / 2, y0 + 4 * s2, bw, bh2);
      m.label.y = y0 + 4 * s2 + bh2 + 34;
    } else {
      const bw = Math.min(360, (U.w - 80) / 2), top = U.y0 + (U.h - 410) / 2, y0 = top + 96;
      const lx = cx - bw - 12, rx = cx + 12;
      m.title.y = top + 56;
      m.btn.resume = rect(lx, y0, bw, bh); m.btn.sound = rect(lx, y0 + step, bw, bh);
      m.btn.textDec = rect(lx, y0 + 2 * step, (bw - 20) / 2, bh); m.btn.textInc = rect(lx + (bw + 20) / 2, y0 + 2 * step, (bw - 20) / 2, bh);
      m.btn.rules = rect(rx, y0, bw, bh); m.btn.quit = rect(rx, y0 + step, bw, bh);
      m.label.x = rx + bw / 2; m.label.y = y0 + 2 * step + bh / 2 + 8;
    }
    L.pauseMenu = m;
  }

  // ---- menus (scrolling column screens) -------------------------------------------------------------------------------------------
  {
    const pw = 100, ph = Math.max(58, Math.min(tap, 70));
    const z = L.zoom = { z: {} };
    if (!land) {
      z.z.zoomInc = rect(U.x1 - 16 - pw, U.y0 + 14, pw, ph); z.z.zoomDec = rect(z.z.zoomInc.x - 8 - 96 - 8 - pw, z.z.zoomInc.y, pw, ph);
      z.label = { x: z.z.zoomInc.x - 8 - 48, y: z.z.zoomInc.y + ph / 2 };
    } else {
      z.z.zoomInc = rect(U.x1 - 8 - pw, U.y0 + 14, pw, ph); z.label = { x: z.z.zoomInc.x + pw / 2, y: z.z.zoomInc.y + ph + 20 }; z.z.zoomDec = rect(z.z.zoomInc.x, z.z.zoomInc.y + ph + 40, pw, ph);
    }
    const cw = land ? clamp(U.w - 2 * 124, 520, 780) : U.w - 68;
    L.col = land ? { x: Math.round(U.x0 + (U.w - cw) / 2), w: cw, top: U.y0 + 14, bottom: U.y1 - 24 } : { x: U.x0 + 34, w: cw, top: U.y0 + 14 + ph + 16, bottom: U.y1 - 24 };
    if (land) {
      const colX = Math.round(U.x0 + U.w * 0.45 + 4), colW = clamp(Math.min(780, (U.x1 - 124) - colX), 340, 780);
      L.title = { hero: rect(U.x0 + 20, U.y0 + 16, Math.round(U.w * 0.45) - 28, U.h - 40), col: { x: colX, w: colW, top: U.y0 + 14, bottom: U.y1 - 24 }, half: true };
    } else L.title = { hero: null, col: L.col, half: false };
  }
  return L;
}

// ---- a programmatic overlap check (used by the resize test and the screenshot matrix) ----------------------------------------------------
const hits = (a, b) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
/** The rectangles that are on screen together in each play state / menu state, at the standard text size. */
export function layoutSets(L) {
  const { U, over, R: Q } = L;
  const hudAll = rect(L.hud.x, L.hud.y, L.hud.w, 150);
  const strip = rect(over.cx - 4 * over.step, over.y - over.r, 8 * over.step, over.r * 2);
  const hint = (y) => rect(L.hint.cx - L.hint.w / 2, y - 26, L.hint.w, 34);
  const A = L.auto;
  const ry = L.radarDyn ? Math.max(Q.radar.y, L.hud.y + 205 + 44) : Q.radar.y;   // portrait: hud.js pushes the radar below the scoreboard text (up to 205 tall at 200% text)
  const radar = rect(Q.radar.x - 6, ry - 6, Q.radar.w + 12, Q.radar.h + 12);
  const sets = {
    'bat-ready': [['hud', hudAll], ['pause', Q.pause], ['think', Q.think], ['radar', radar], ['over', strip], ['hint', hint(L.hint.bat)]],
    'bat-live': [['hud', hudAll], ['pause', Q.pause], ['think', Q.think], ['run', Q.run], ['over', strip]],
    'bowl-aim': [['hud', hudAll], ['pause', Q.pause], ['think', Q.think], ['radar', radar], ...Q.chips.map((c, i) => [`chip${i}`, c.rect]), ['over', strip], ['hint', hint(L.hint.bowl)]],
    'field-ready': [['hud', hudAll], ['pause', Q.pause], ['think', Q.think], ['ready', Q.ready], ['over', strip], ['hint', hint(L.hint.ready)]],
    'field-live': [['hud', hudAll], ['pause', Q.pause], ['think', Q.think], ['catch', Q.catchBtn], ['over', strip], ['hint', hint(L.hint.field)]],
    'field-held': [['hud', hudAll], ['pause', Q.pause], ['think', Q.think], ['throwA', Q.throwA], ['throwB', Q.throwB], ['over', strip]],
    'idle': [['hud', hudAll], ['pause', Q.pause], ['think', Q.think], ['speed', Q.speed], ['skip', Q.skip], ['over', strip]],
    'auto': [['hud', hudAll], ['pause', Q.pause], ['exit', Q.exit], ['apause', Q.autoPause], ['dec', Q.autoDec], ['inc', Q.autoInc], ['aspeed', Q.autoSpeed], ['over', strip], ['card', rect(A.card.x, A.card.bottom - 120, A.card.w, 120)]],
    'pause-menu': Object.entries(L.pauseMenu.btn),
    'think-card': [['btn', L.thinkCard.btn]],
    'menu': [['zoomDec', L.zoom.z.zoomDec], ['zoomInc', L.zoom.z.zoomInc], ['col', rect(L.col.x, L.col.top, L.col.w, Math.max(60, L.col.bottom - L.col.top - 100))]],
  };
  return sets;
}
export function layoutProblems(L) {
  const out = [], { U } = L;
  const contains = (a, b) => b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h;
  const taps = new Set(['pause', 'think', 'exit', 'speed', 'skip', 'apause', 'dec', 'inc', 'aspeed', 'run', 'ready', 'catch', 'throwA', 'throwB', 'btn', 'resume', 'sound', 'rules', 'quit', 'textDec', 'textInc', 'zoomDec', 'zoomInc', 'chip0', 'chip1', 'chip2']);
  for (const [set, items] of Object.entries(layoutSets(L))) {
    for (const [n, r] of items) {
      if (!(r.w > 0 && r.h > 0)) out.push(`${set}/${n}: empty ${JSON.stringify(r)}`);
      else if (r.x < U.x0 - 0.5 || r.y < U.y0 - 0.5 || r.x + r.w > U.x1 + 0.5 || r.y + r.h > U.y1 + 0.5) out.push(`${set}/${n}: outside the safe area ${JSON.stringify(r)}`);
      if (taps.has(n) && r.h < Math.min(L.tap, 56) - 0.5) out.push(`${set}/${n}: tap target too short (${r.h})`);
      if (L.backSz && r.x < U.x0 + L.backSz && r.y < U.y0 + 70 && n !== 'col') out.push(`${set}/${n}: under the host back button`);
    }
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const [na, a] = items[i], [nb, b] = items[j];
      if (!hits(a, b)) continue;
      if (na === 'hud' && (nb === 'pause' || nb === 'think') && contains(a, b)) continue;
      out.push(`${set}: ${na} overlaps ${nb}`);
    }
  }
  return out;
}

// A default layout exists from the start (the 720x1280 portrait frame), so code that runs before the first render (tests) always has one.
syncLayout(720, 1280);

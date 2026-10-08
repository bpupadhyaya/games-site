// Screen geometry as a function of the LIVE screen size (kit 1.7 fluid viewport: the SHORT side is always 720 units, the long side grows).
// One place for every rectangle, so game.js (hit-testing), hud.js / menus.js (drawing) and the 3D camera framing never disagree.
//
//   portrait   vw = 720, vh = 720 x aspect (960 on a 4:3 tablet, 1560 on a tall phone). HUD: player pills + Pause / Think on top, the courtyard in the
//              band between, PICK UP and the LEFT FOOT | TWO FEET | RIGHT FOOT row (or one big TOSS button) along the bottom. Menus fill the width.
//   landscape  vw = 720 x aspect, vh = 720. HUD: pills top left / right, Pause / Think top centre, LEFT FOOT and RIGHT FOOT as tall thumb buttons on the
//              left and right edges, TWO FEET and PICK UP stacked in the bottom centre. Menu screens use a column (title / result: on the right,
//              the 3D scene on the left); the readers use side columns for their buttons.
//
// Screens draw in "column space": game.js translates the canvas by `scr.colX` and the live column width is `W`.
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };
// the smallest comfortable touch target (44 CSS px) in virtual units, so buttons never shrink below it on a small phone
export const tapMin = () => Math.ceil(44 / Math.max(0.3, host.px)) + 2;

export let W = 720;          // width of the column the current screen draws in (live binding)
export let H = 1280;         // live screen height (virtual units)
export const scr = { vw: 720, vh: 1280, land: false, colX: 0 };
export function setScreen(vw, vh) {
  vw = Math.round(vw) || 720; vh = Math.round(vh) || 1280;
  scr.vw = vw; scr.vh = vh; scr.land = vw > vh; H = vh;
  if (!scr.land) { W = vw; scr.colX = 0; }
}

const READERS = new Set(['howto', 'about', 'rules']);
// The column a screen draws in: { x, w } in screen units.
export function colFor(scene, pauseMenu = false) {
  const { vw } = scr;
  if (!scr.land) return { x: 0, w: vw };
  const mL = Math.max(16, host.l), mR = Math.max(16, host.r);
  if (READERS.has(scene) || scene === 'play') return { x: 0, w: vw };
  if ((scene === 'title' || scene === 'result') && vw >= 1100) return { x: vw - mR - 720 - 16, w: 720 };
  const w = Math.min(vw - mL - mR - 24, pauseMenu ? 720 : 860);
  return { x: (vw - w) / 2, w };
}
export function useColumn(scene, pauseMenu = false) { const c = colFor(scene, pauseMenu); W = c.w; scr.colX = c.x; return c; }

// ---- reference pages (Rules, About, How to Play) ---------------------------------------------------------------------------------------
const R = (x, y, w, h) => ({ x, y, w, h });
export function readerGeom() {
  const { vw, vh, land } = scr, I = host;
  const tm = tapMin(), key = `r${vw}x${vh}|${I.t},${I.r},${I.b},${I.l},${I.back}|${tm}`;
  if (readerGeom.k === key) return readerGeom.v;
  const backW = I.back ? Math.max(I.back, 56) + 12 : 0;
  let g;
  if (!land || vw - 2 * 190 < 560) {
    const bot = Math.max(16, I.b + 6), btnH = Math.max(land ? 76 : 100, tm), bY = vh - bot - btnH, topRow = land ? 10 : 18;
    const side = Math.max(20, I.l + 14, I.r + 14), bw = (vw - 2 * side - 16) / 2;
    const decX = I.back ? I.l + backW + 8 : side;
    const backB = I.back ? I.t + Math.max(I.back, 56) + 8 : 0;
    const pY = Math.max(I.t + topRow + Math.max(68, tm - 12) + (land ? 12 : 22), backB), pX = Math.max(34, I.l + 14, I.r + 14);
    g = {
      side: false, dec: R(decX, I.t + topRow - 4, 120, Math.max(80, tm)), inc: R(vw - side - 120, I.t + topRow - 4, 120, Math.max(80, tm)), label: { x: vw / 2, y: I.t + topRow + 44 },
      back: R(side, bY, bw, btnH), next: R(side + bw + 16, bY, bw, btnH), panel: R(pX, pY, vw - 2 * pX, bY - 34 + (land ? 14 : 0) - pY),
    };
  } else {
    const colW = 148, c0 = Math.max(14, I.l + 6), c1 = Math.max(14, I.r + 6);
    const pad = Math.max(c0, c1) + colW + 14, pw = Math.min(vw - 2 * pad, 1000), px = (vw - pw) / 2;
    const top = I.t + (I.back ? backW + 16 : 14), bot = Math.max(14, I.b + 6);
    g = {
      side: true, dec: R(c0, top, colW, Math.max(80, tm)), inc: R(c0, top + Math.max(80, tm) + 12 + 40, colW, Math.max(80, tm)), label: { x: c0 + colW / 2, y: top + Math.max(80, tm) + 12 + 28 },
      back: R(c0, vh - bot - Math.max(84, tm), colW, Math.max(84, tm)), next: R(vw - c1 - colW, vh - bot - Math.max(84, tm), colW, Math.max(84, tm)), panel: R(px, I.t + 10, pw, vh - I.t - I.b - 20),
    };
  }
  readerGeom.k = key; readerGeom.v = g;
  return g;
}

// ---- setup screen pins (Start / Back), in column space ----------------------------------------------------------------------------------
export function setupPins() {
  const land = scr.land, h = Math.max(land ? 84 : 96, tapMin()), y = H - Math.max(land ? 14 : 28, host.b + 10) - h;
  const sw = Math.round((W - 60 - 16) * 0.68);
  return { start: R(30, y, sw, h), back: R(30 + sw + 16, y, W - 60 - sw - 16, h), y, h };
}

// ---- the in-play HUD ----------------------------------------------------------------------------------------------------------------------
// The in-play HUD follows the text-size setting (100-300%) through a gentler multiplier so the scene stays visible.
export const PLAY_M = [1, 1.2, 1.4, 1.6, 1.8];
const hudCache = new Map();
export function hudFor(idx, watch = false) {
  const { vw, vh } = scr, I = host;
  const key = `${vw}x${vh}|${idx | 0}|${watch ? 1 : 0}|${I.t},${I.r},${I.b},${I.l},${I.back}|${tapMin()}`;
  let L = hudCache.get(key);
  if (!L) { L = buildHud(vw, vh, clamp(idx | 0, 0, PLAY_M.length - 1), watch, I); L.key = key; hudCache.set(key, L); if (hudCache.size > 60) hudCache.delete(hudCache.keys().next().value); }
  return L;
}

function buildHud(vw, vh, idx, watch, I) {
  const land = vw > vh, mRaw = PLAY_M[idx];
  const vEff = vh - I.t - I.b - (I.back && !land ? Math.max(I.back, 56) : 0);
  const m = land ? Math.min(mRaw, 1.35) : Math.min(mRaw, clamp(1 + ((vEff - 960) / 380) * 0.8, 1, 1.8));
  const L = { vw, vh, land, m, mRaw, watch };
  const backW = I.back ? Math.max(I.back, 56) + 12 : 0;
  const bot = Math.max(12, I.b + 4), x0 = Math.max(14, I.l + 6), x1 = vw - Math.max(14, I.r + 6);
  const barH = Math.round(66 * m), utilH = Math.max(Math.round(54 * Math.min(m, 1.4)), tapMin());
  if (!land) {
    const ty = I.t + (I.back ? backW + 6 : 12), pw = Math.min(280 * Math.min(1.1, m), (x1 - x0 - 16) / 2);
    L.pillL = R(x0, ty, pw, barH); L.pillR = R(x1 - pw, ty, pw, barH);
    L.barY = ty; L.barH = barH;
    const uy = ty + barH + 10;
    const uw = Math.min(190 * Math.min(m, 1.3), (x1 - x0 - 16) / 2.4);
    L.util = { pause: R(x0, uy, uw, utilH), think: R(x1 - uw, uy, uw, utilH) };
    L.status = R(x0 + uw + 10, uy, x1 - x0 - 2 * uw - 20, utilH);
    L.topH = uy + utilH + 10;
    if (!watch) {
      const gap = 10, rowH = Math.round(clamp(vh * 0.118, 96, 150) * (0.88 + 0.12 * m)), pickH = Math.max(Math.round(clamp(vh * 0.062, 62, 86) * Math.min(m, 1.3)), tapMin());
      const bw = (x1 - x0 - 2 * gap) / 3, bottom = vh - bot;
      const ry = bottom - rowH, py = ry - gap - pickH;
      L.left = R(x0, ry, bw, rowH); L.both = R(x0 + bw + gap, ry, bw, rowH); L.right = R(x0 + 2 * (bw + gap), ry, bw, rowH);
      L.pick = R(x0, py, x1 - x0, pickH);
      L.toss = R(x0, py, x1 - x0, bottom - py);
      L.ctlTop = py;
      L.band = R(x0, L.topH, x1 - x0, Math.max(120, py - 10 - L.topH));
      L.ring = { x: vw / 2, y: py - 10 - 64, r0: 54, rt: 24 };
      L.camBand = R(x0, L.topH, x1 - x0, Math.max(100, L.ring.y - L.ring.r0 - 12 - L.topH));
      L.pop = { cx: vw / 2, y: L.topH + 70 * Math.min(m, 1.3) };
    } else {
      const bh = Math.max(74, tapMin()), bottom = vh - bot, rowY = bottom - bh, sc = [1, 1.2, 1.4, 1.6, 1.8][idx];
      const bw = (x1 - x0 - 3 * 12) / 4;
      L.wbtn = { pause: R(x0, rowY, bw * 1.3, bh), shorter: R(x0 + bw * 1.3 + 12, rowY, bw * 0.9, bh), longer: R(x0 + bw * 2.2 + 24, rowY, bw * 0.9, bh), quit: R(x0 + bw * 3.1 + 36, rowY, x1 - (x0 + bw * 3.1 + 36), bh) };
      const ph = Math.min(Math.round(300 + (sc - 1) * 100), Math.max(150, rowY - 12 - (L.topH + 250)));
      L.panel = R(x0, rowY - 12 - ph, x1 - x0, ph);
      L.pausedY = L.panel.y - 22;
      L.band = R(x0, L.topH, x1 - x0, Math.max(120, L.panel.y - 16 - L.topH));
      L.camBand = L.band;
      L.pop = { cx: vw / 2, y: L.topH + 70 };
    }
  } else {
    const ty = I.t + 10;
    if (!watch) {
      const sideW = clamp(vw * 0.2, 150, 270), btnH = Math.round(clamp(vh * 0.5, 200, 330) * (0.9 + 0.1 * m));
      L.left = R(x0, vh - bot - btnH, sideW, btnH); L.right = R(x1 - sideW, vh - bot - btnH, sideW, btnH);
      const cx0 = L.left.x + sideW + 12, cx1 = L.right.x - 12, cw = cx1 - cx0;
      const pw = Math.min(250 * Math.min(1.1, m), sideW + 110), lx = x0 + backW;
      L.pillL = R(lx, ty, pw, barH); L.pillR = R(x1 - pw, ty, pw, barH);
      L.barY = ty; L.barH = barH;
      const uw = Math.min(170 * Math.min(m, 1.3), (cw - 20) / 2 - 20), cxm = (cx0 + cx1) / 2;
      L.util = { pause: R(cxm - uw - 8, ty + 4, uw, utilH), think: R(cxm + 8, ty + 4, uw, utilH) };
      L.status = R(L.pillL.x + pw + 10, ty + utilH + 10, L.pillR.x - (L.pillL.x + pw) - 20, Math.round(40 * m));
      L.topH = ty + utilH + 14;
      const bh = Math.round(clamp(vh * 0.2, 90, 140) * (0.9 + 0.1 * m)), pickH = Math.max(Math.round(Math.min(72, vh * 0.1) * Math.min(m, 1.3)), tapMin());
      const bottom = vh - bot;
      L.both = R(cx0, bottom - bh, cw, bh);
      L.pick = R(cx0, bottom - bh - 10 - pickH, cw, pickH);
      L.toss = R(cx0, bottom - bh - 10 - pickH, cw, bh + 10 + pickH);
      L.ctlTop = L.pick.y;
      L.band = R(cx0, L.topH, cw, Math.max(110, L.pick.y - 10 - L.topH));
      L.ring = { x: cx1 - 58, y: L.topH + 62, r0: 50, rt: 22 };
      L.camBand = L.band;
      L.pop = { cx: cxm, y: L.topH + 92 };
    } else {
      const pw = clamp(vw * 0.4, 420, 560), px = x1 - pw, bh = Math.max(74, tapMin()), gap = 10;
      const btop = vh - bot - 2 * bh - gap, bw = (pw - gap) / 2;
      L.wbtn = { pause: R(px, btop, bw, bh), shorter: R(px + bw + gap, btop, bw, bh), longer: R(px, btop + bh + gap, bw, bh), quit: R(px + bw + gap, btop + bh + gap, bw, bh) };
      L.panel = R(px, ty, pw, btop - 12 - ty);
      const xl1 = px - 14, pillW = Math.min(240 * Math.min(1.1, m), (xl1 - x0 - backW) / 2 - 10);
      L.pillL = R(x0 + backW, ty, pillW, barH); L.pillR = R(xl1 - pillW, ty, pillW, barH);
      L.barY = ty; L.barH = barH;
      L.status = R(x0 + backW, ty + barH + 8, xl1 - x0 - backW, Math.round(40 * m));
      L.topH = L.status.y + L.status.h + 8;
      L.pausedY = vh - bot - 8;
      L.band = R(x0, L.topH, xl1 - x0, Math.max(120, vh - bot - 40 - L.topH));
      L.camBand = L.band;
      L.pop = { cx: (x0 + xl1) / 2, y: L.topH + 56 };
    }
  }
  return L;
}

// Screen geometry as a function of the LIVE screen size (kit 1.7 fluid viewport: the SHORT side is always 720 units, the long side grows).
// One place for every rectangle, so game.js (hit-testing), hud.js / menus.js (drawing) and the 3D camera framing never disagree.
//
//   portrait   vw = 720, vh = 720 x aspect (960 on a 4:3 tablet, 1560 on a tall phone). HUD: score bar + role banner on top, LEFT / RIGHT and Think / Pause
//              along the bottom, the players in the band between. Menus fill the width.
//   landscape  vw = 720 x aspect, vh = 720. HUD: scores top left / right, role + tempo in the middle, the big LEFT / RIGHT thumb buttons on the left
//              and right edges, the timing ring bottom centre with Think / Pause beside it. Menu screens use a column (title / result: on the right,
//              the 3D scene on the left); the readers use side columns for their buttons.
//
// Screens draw in "column space": game.js translates the canvas by `scr.colX` and the live column width is `W`.
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

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
  const key = `r${vw}x${vh}|${I.t},${I.r},${I.b},${I.l},${I.back}`;
  if (readerGeom.k === key) return readerGeom.v;
  const backW = I.back ? Math.max(I.back, 56) + 12 : 0;
  let g;
  if (!land || vw - 2 * 190 < 560) {
    const bot = Math.max(16, I.b + 6), btnH = land ? 76 : 100, bY = vh - bot - btnH, topRow = land ? 10 : 18;
    const side = Math.max(20, I.l + 14, I.r + 14), bw = (vw - 2 * side - 16) / 2;
    const decX = I.back ? I.l + backW + 8 : side;
    const backB = I.back ? I.t + Math.max(I.back, 56) + 8 : 0;
    const pY = Math.max(I.t + topRow + 68 + (land ? 12 : 22), backB), pX = Math.max(34, I.l + 14, I.r + 14);
    g = {
      side: false, dec: R(decX, I.t + topRow - 4, 120, 80), inc: R(vw - side - 120, I.t + topRow - 4, 120, 80), label: { x: vw / 2, y: I.t + topRow + 44 },
      back: R(side, bY, bw, btnH), next: R(side + bw + 16, bY, bw, btnH), panel: R(pX, pY, vw - 2 * pX, bY - 34 + (land ? 14 : 0) - pY),
    };
  } else {
    const colW = 148, c0 = Math.max(14, I.l + 6), c1 = Math.max(14, I.r + 6);
    const pad = Math.max(c0, c1) + colW + 14, pw = Math.min(vw - 2 * pad, 1000), px = (vw - pw) / 2;
    const top = I.t + (I.back ? backW + 16 : 14), bot = Math.max(14, I.b + 6);
    g = {
      side: true, dec: R(c0, top, colW, 80), inc: R(c0, top + 80 + 12 + 40, colW, 80), label: { x: c0 + colW / 2, y: top + 80 + 12 + 28 },
      back: R(c0, vh - bot - 84, colW, 84), next: R(vw - c1 - colW, vh - bot - 84, colW, 84), panel: R(px, I.t + 10, pw, vh - I.t - I.b - 20),
    };
  }
  readerGeom.k = key; readerGeom.v = g;
  return g;
}

// ---- setup screen pins (Start / Back), in column space ----------------------------------------------------------------------------------
export function setupPins() {
  const land = scr.land, h = land ? 84 : 96, y = H - Math.max(land ? 14 : 28, host.b + 10) - h;
  const sw = Math.round((W - 60 - 16) * 0.68);
  return { start: R(30, y, sw, h), back: R(30 + sw + 16, y, W - 60 - sw - 16, h), y, h };
}

// ---- the in-play HUD ----------------------------------------------------------------------------------------------------------------------
// The in-play HUD follows the text-size setting (100-300%) through a gentler multiplier so the scene stays visible.
export const PLAY_M = [1, 1.2, 1.4, 1.6, 1.8];
const hudCache = new Map();
export function hudFor(idx, watch = false) {
  const { vw, vh } = scr, I = host;
  const key = `${vw}x${vh}|${idx | 0}|${watch ? 1 : 0}|${I.t},${I.r},${I.b},${I.l},${I.back}`;
  let L = hudCache.get(key);
  if (!L) { L = buildHud(vw, vh, clamp(idx | 0, 0, PLAY_M.length - 1), watch, I); L.key = key; hudCache.set(key, L); if (hudCache.size > 60) hudCache.delete(hudCache.keys().next().value); }
  return L;
}

function buildHud(vw, vh, idx, watch, I) {
  const land = vw > vh, mRaw = PLAY_M[idx];
  // tall screens keep the full multiplier; shorter / wider ones cap it so the players keep a real band to be seen in
  const vEff = vh - I.t - I.b - (I.back && !land ? Math.max(I.back, 56) : 0);
  const m = land ? Math.min(mRaw, 1.35) : Math.min(mRaw, clamp(1 + ((vEff - 960) / 380) * 0.8, 1, 1.8));
  const L = { vw, vh, land, m, mRaw, watch };
  const backW = I.back ? Math.max(I.back, 56) + 12 : 0;
  const bot = Math.max(12, I.b + 4), x0 = Math.max(14, I.l + 6), x1 = vw - Math.max(14, I.r + 6);
  const barH = Math.round(64 * m), bannerH = Math.round(52 * m);
  const util = Math.round(74 * Math.min(m, 1.5));
  if (!land) {
    const ty = I.t + (I.back ? backW + 6 : 12), pw = Math.min(250 * Math.min(1.1, m), (x1 - x0 - 120) / 2);
    L.pillL = R(x0, ty, pw, barH); L.pillR = R(x1 - pw, ty, pw, barH);
    L.centerX = vw / 2; L.centerW = x1 - x0 - 2 * (pw + 16); L.barY = ty; L.barH = barH;
    L.banner = R(x0, ty + barH + 10, x1 - x0, bannerH);
    L.topH = ty + barH + 10 + bannerH + 12;
    L.metro = { cx: vw / 2, y: L.topH + 30, w: Math.min(420, vw - 120) };
    L.reveal = { cx: vw / 2, y: L.topH + 130 + 6 * m };
    L.bandTop = L.topH + 54;
    if (!watch) {
      const gap = 10, bw = (x1 - x0 - gap) / 2, bottom = vh - bot;
      const uh = util, ty2 = bottom - uh;
      L.util = { think: R(x0, ty2, bw, uh), pause: R(x0 + bw + gap, ty2, bw, uh) };
      const btnH = Math.round(clamp(vh * 0.133, 120, 170) * (0.85 + 0.15 * m));
      const by = ty2 - gap - btnH;
      L.left = R(x0, by, bw, btnH); L.right = R(x0 + bw + gap, by, bw, btnH);
      const r0 = Math.round(clamp(vh * 0.072, 64, 92)), rt = Math.round(r0 * 0.43);
      L.ring = { x: vw / 2, y: by - r0 - 20 - Math.round(20 * (m - 1)) + (vh < 1100 ? 8 : 0), r0, rt };
      L.fbY = L.ring.y - r0 - 14;
      L.band = R(x0, L.bandTop, x1 - x0, Math.max(120, L.ring.y - r0 - 56 - L.bandTop));
    } else {
      const bh = 74, bottom = vh - bot, rowY = bottom - bh, sc = [1, 1.2, 1.4, 1.6, 1.8][idx];
      const bw = (x1 - x0 - 3 * 12) / 4;
      L.wbtn = { pause: R(x0, rowY, bw * 1.3, bh), shorter: R(x0 + bw * 1.3 + 12, rowY, bw * 0.9, bh), longer: R(x0 + bw * 2.2 + 24, rowY, bw * 0.9, bh), quit: R(x0 + bw * 3.1 + 36, rowY, x1 - (x0 + bw * 3.1 + 36), bh) };
      const ph = Math.min(Math.round(289 + (sc - 1) * 100), Math.max(150, rowY - 12 - (L.bandTop + 240)));
      L.panel = R(x0, rowY - 12 - ph, x1 - x0, ph);
      L.pausedY = L.panel.y - 22;
      L.band = R(x0, L.bandTop, x1 - x0, Math.max(120, L.panel.y - 66 - L.bandTop));
    }
  } else {
    const ty = I.t + 12;
    if (!watch) {
      const sideW = clamp(vw * 0.19, 150, 260), btnH = Math.round(clamp(vh * 0.44, 190, 300) * (0.9 + 0.1 * m));
      L.left = R(x0, vh - bot - btnH, sideW, btnH); L.right = R(x1 - sideW, vh - bot - btnH, sideW, btnH);
      const cx0 = L.left.x + sideW + 12, cx1 = L.right.x - 12, pw = Math.min(236 * Math.min(1.1, m), sideW + 90);
      const lx = x0 + backW;
      L.pillL = R(lx, ty, pw, barH); L.pillR = R(x1 - pw, ty, pw, barH);
      L.centerX = (L.pillL.x + pw + L.pillR.x) / 2; L.centerW = L.pillR.x - (L.pillL.x + pw) - 24; L.barY = ty; L.barH = barH;
      L.banner = null;                                  // landscape: the role line is part of the centre of the top bar
      L.topH = ty + barH;
      const cx = (cx0 + cx1) / 2;
      L.metro = { cx, y: L.topH + 22, w: Math.min(420, cx1 - cx0 - 40) };
      L.reveal = { cx, y: L.topH + 96 + 6 * m };
      const r0 = 70, rt = 31, ringY = vh - bot - r0 - 6, uw = clamp((cx1 - cx0 - 2 * r0 - 56) / 2, 110, 170), uh = Math.round(72 * Math.min(m, 1.3));
      L.ring = { x: cx, y: ringY, r0, rt };
      L.fbY = ringY - r0 - 14;
      L.util = { think: R(cx - r0 - 18 - uw, ringY - uh / 2, uw, uh), pause: R(cx + r0 + 18, ringY - uh / 2, uw, uh) };
      L.bandTop = L.topH + 46;
      L.band = R(cx0, L.bandTop - 12, cx1 - cx0, Math.max(120, ringY - 14 - (L.bandTop - 12)));
    } else {
      const pw = clamp(vw * 0.4, 420, 560), px = x1 - pw, bh = 74, gap = 10;
      const btop = vh - bot - 2 * bh - gap, bw = (pw - gap) / 2;
      L.wbtn = { pause: R(px, btop, bw, bh), shorter: R(px + bw + gap, btop, bw, bh), longer: R(px, btop + bh + gap, bw, bh), quit: R(px + bw + gap, btop + bh + gap, bw, bh) };
      L.panel = R(px, ty, pw, btop - 12 - ty);
      const xl1 = px - 14, pillW = Math.min(220 * Math.min(1.1, m), (xl1 - x0 - backW) / 2 - 10);
      L.pillL = R(x0 + backW, ty, pillW, barH); L.pillR = R(xl1 - pillW, ty, pillW, barH);
      L.centerX = (L.pillL.x + pillW + L.pillR.x) / 2; L.centerW = L.pillR.x - (L.pillL.x + pillW) - 20; L.barY = ty; L.barH = barH;
      L.banner = R(x0 + backW, ty + barH + 10, xl1 - x0 - backW, Math.round(46 * m));
      L.topH = L.banner.y + L.banner.h + 10;
      const cx = (x0 + xl1) / 2;
      L.metro = { cx, y: L.topH + 20, w: Math.min(420, xl1 - x0 - 40) };
      L.reveal = { cx, y: L.topH + 100 };
      L.pausedY = vh - bot - 8;
      L.bandTop = L.topH + 44;
      L.band = R(x0, L.bandTop, xl1 - x0, Math.max(120, vh - bot - 40 - L.bandTop));
    }
  }
  return L;
}

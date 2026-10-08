// Screen geometry for every screen as a pure function of the LIVE screen size (kit fluid viewport: the short side is 720 units).
// layoutFor(w, h) returns every rectangle; cached by size + safe insets + host back button.
//   portrait  goal card on top, the stage (3D scene fitted to it) in the middle, a bar of big buttons below.
//   wide      landscape >= 900 units: left card (goal, spin, trick progress), the stage in the middle, a column of buttons on the right.
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button in screen units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export let W = 720, H = 1280, LAY = null;
export let ACT_BTN, HINT_BTN, MENU_BTN, WATCH_BAR, REF_BACK, REF_NEXT, TEXT_DEC, TEXT_INC;

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}
export function relayout(w, h) {
  const L = layoutFor(w, h);
  if (L !== LAY) {
    LAY = L; W = L.W; H = L.H;
    ACT_BTN = L.act; HINT_BTN = L.hint; MENU_BTN = L.menu; WATCH_BAR = L.watch;
    REF_BACK = L.pages.back; REF_NEXT = L.pages.next; TEXT_DEC = L.pages.dec; TEXT_INC = L.pages.inc;
  }
  return L;
}
export const lockupH = (h) => clamp(Math.round(h * 0.075), 56, 84);

function build(w, h, I) {
  const land = w >= 900 && w > h;
  const L = { w, h, land, W: w, H: h, ins: { t: I.t, r: I.r, b: I.b, l: I.l } };
  const bs = I.back ? Math.max(I.back, 56) : 0;
  L.backBox = bs ? R(I.l, I.t, bs + 8, bs + 8) : R(0, 0, 0, 0);
  const U = L.U = { x0: I.l, y0: I.t, x1: w - I.r, y1: h - I.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const cx = (U.x0 + U.x1) / 2;
  const cpu = Math.max(0.2, host.px || 0.6), lw0 = Math.max(250, Math.round(125 / cpu)), lh = Math.round(lw0 * 327 / 1200);
  L.lock = { h: lh, w: lw0, strip: lh + 26, cpu };

  // ---- play screen ---------------------------------------------------------------------------
  if (!land) {
    const pad = 14, bw = (U.w - 2 * pad - 24) / 3, barH = 96, barY = U.y1 - barH - 12;
    const hudY = U.y0 + 46, hx = bs && hudY < L.backBox.y + L.backBox.h ? Math.max(U.x0 + pad, L.backBox.x + L.backBox.w + 6) : U.x0 + pad;
    L.hud = R(hx, hudY, U.x1 - pad - hx, 196);
    L.act = R(U.x0 + pad, barY, bw, barH); L.hint = R(U.x0 + pad + bw + 12, barY, bw, barH); L.menu = R(U.x0 + pad + 2 * (bw + 12), barY, bw, barH);
    const wb = (U.w - 2 * pad - 36) / 4;
    L.watch = { dec: R(U.x0 + pad, barY, wb, barH), pause: R(U.x0 + pad + wb + 12, barY, wb, barH), inc: R(U.x0 + pad + 2 * (wb + 12), barY, wb, barH), exit: R(U.x0 + pad + 3 * (wb + 12), barY, wb, barH), label: { x: cx, y: barY - 14 } };
    const sy = L.hud.y + L.hud.h + 6;
    L.stage = R(U.x0, sy, U.w, barY - 8 - sy);
    L.spin = R(L.hud.x + 14, L.hud.y + 164, L.hud.w - 28, 22);
    L.toastY = barY - 26; L.thinkText = { x: cx, y: sy + 30 };
    L.panelRight = null;
  } else {
    const pad = 14, side = clamp(U.w * 0.24, 250, 340);
    const ly = Math.max(U.y0 + 8, bs ? L.backBox.y + L.backBox.h + 6 : 0);
    L.hud = R(U.x0 + pad, Math.max(ly, U.y0 + 46), side, 300);
    const rx = U.x1 - pad - side, ry = U.y0 + 8, rh = U.h - 16, g = 14;
    const aH = clamp(rh * 0.34, 110, 200), oH = clamp((rh - aH - 2 * g) / 2, 84, 130), tot = aH + 2 * oH + 2 * g, y0 = ry + (rh - tot) / 2;
    L.act = R(rx, y0, side, aH); L.hint = R(rx, y0 + aH + g, side, oH); L.menu = R(rx, y0 + aH + oH + 2 * g, side, oH);
    const half = (side - g) / 2, wOth = clamp((rh - aH - 2 * g - 40) / 2, 80, 130), wTot = aH + g + 40 + wOth + g + wOth, wy = ry + (rh - wTot) / 2;
    L.watch = { pause: R(rx, wy, side, aH), label: { x: rx + side / 2, y: wy + aH + g + 18 }, dec: R(rx, wy + aH + g + 36, half, wOth), inc: R(rx + half + g, wy + aH + g + 36, half, wOth), exit: R(rx, wy + aH + g + 36 + wOth + g, side, wOth) };
    const sx0 = L.hud.x + L.hud.w + 12, sx1 = rx - 12;
    L.stage = R(sx0, U.y0 + 8, sx1 - sx0, U.h - 16);
    L.spin = R(L.hud.x + 14, L.hud.y + L.hud.h - 44, L.hud.w - 28, 22);
    L.hud.h = 300;
    L.toastY = U.y1 - 40; L.thinkText = { x: (sx0 + sx1) / 2, y: U.y0 + 44 };
  }

  const heroH = U.h < 1100 ? 170 : 200, toyH = clamp(Math.round(U.h - heroH - 560 - L.lock.strip), 100, 460);
  L.heroH = heroH; L.toyH = toyH;
  L.sceneRect = land ? R(U.x0, U.y0, Math.max(300, (U.x1 - 40 - Math.min(560, U.w * 0.42)) - U.x0 - 20), U.h) : R(U.x0, U.y0 + heroH, U.w, toyH);
  // ---- flow columns (menus) -------------------------------------------------------------------
  const colW = Math.min(640, w - 80);
  const ft = !land && bs ? U.y0 + bs + 12 : U.y0;
  L.flow = { x: cx - colW / 2, w: colW, top: ft, bottom: U.y1 };
  const tw = Math.min(560, U.w * 0.42);
  L.titleFlow = !land ? { x: cx - colW / 2, w: colW, top: U.y0 + heroH + toyH, bottom: U.y1 - L.lock.strip } : { x: U.x1 - 40 - tw, w: tw, top: U.y0, bottom: U.y1 - L.lock.strip };
  L.titleArt = land ? R(U.x0 + 20, U.y0, L.titleFlow.x - 40 - U.x0, U.h - 24) : R(U.x0, U.y0, U.w, heroH);
  if (!land) {
    L.book = { flow: { x: cx - colW / 2, w: colW, top: ft, bottom: U.y1 - 130 }, back: R(cx - 340, U.y1 - 116, 680, 100), msg: { x: cx, y: U.y1 - 128 }, fade: R(0, U.y1 - 140, w, 140 + I.b), side: null };
  } else {
    const lw = Math.min(380, U.w * 0.3), x1 = U.x1 - 24, fw = Math.min(640, x1 - (U.x0 + lw + 80));
    L.book = { flow: { x: x1 - fw, w: fw, top: U.y0, bottom: U.y1 }, back: R(U.x0 + 24, U.y1 - 96, lw - 20, 80), msg: { x: U.x0 + 24 + (lw - 20) / 2, y: U.y1 - 112 }, fade: null, side: R(U.x0 + 24, Math.max(U.y0 + 20, bs ? L.backBox.y + L.backBox.h + 6 : 0), lw - 20, 300) };
  }

  // ---- reference pages ------------------------------------------------------------------------
  if (!land) {
    const colP = cx - Math.min(652, U.w - 24) / 2, pw = Math.min(652, U.w - 24), rowY = U.y0 + 12 + (bs ? bs * 0.0 : 0), panelY = rowY + 70, bY = U.y1 - 112;
    const inc = R(colP + pw - 120, rowY - 6, 120, 80), dec = R(inc.x - 12 - 120, rowY - 6, 120, 80);
    L.pages = { panel: R(colP, panelY, pw, bY - 14 - panelY), dec, inc, pct: { x: dec.x - 14, y: rowY + 34 }, back: R(cx - 348, bY, 332, 100), next: R(cx + 16, bY, 332, 100), land: false, hdrH: 80, ftH: 70 };
  } else {
    const bh = 80, bY = U.y1 - 8 - bh, x0 = Math.max(U.x0 + 20, bs ? L.backBox.x + L.backBox.w + 8 : 0), x1 = U.x1 - 20;
    const pw = Math.min(1100, x1 - x0), px = cx - pw / 2 < x0 ? x0 : cx - pw / 2;
    const panel = R(px, U.y0 + 8, pw, bY - 12 - (U.y0 + 8));
    const inc = R(panel.x + panel.w - 20 - 110, panel.y + 6, 110, 72), dec = R(inc.x - 12 - 110, panel.y + 6, 110, 72);
    L.pages = { panel, dec, inc, pct: { x: dec.x - 14, y: panel.y + 42 }, back: R(cx - 250, bY, 240, bh), next: R(cx + 10, bY, 240, bh), land: true, hdrH: 80, ftH: 52 };
  }
  const pw2 = Math.min(660, w - 60);
  L.pause = { x: cx - pw2 / 2, w: pw2, top: U.y0 + 20, bottom: U.y1 - 20 };
  return L;
}

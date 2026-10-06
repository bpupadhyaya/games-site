// Screen geometry for every screen, as a pure function of the LIVE screen size (kit 1.7.1 fluid viewport: the short side is
// always 720 units). `layoutFor(w, h)` returns every rectangle; it is cached by size key + safe insets + host back button.
//
// Two coordinate systems:
//   WORLD   the toy itself (ken, string, ball, physics): fixed 720 x 1280 units, never changes with the screen.
//   DESIGN  everything else (HUD, buttons, menus, text): the screen divided by `s` (s = 1 except on short portrait screens,
//           where the whole UI is scaled down to fit). Pointer input is divided by `s` by game.js.
// The stage maps a window of the world onto the screen: screen = st.x + wx * st.s, st.y + (wy - st.wy0) * st.s.
//
//   portrait  goal card on top, the tall stage (scale 1), button bar below.      (the approved phone look)
//   wide      landscape >= 900 units: left card (goal, caption), centred stage (scale ~0.7), right column of buttons.
//   The wide layout also serves 4:3 tablets in landscape. Narrow landscape windows fall back to the portrait layout.
export const W0 = 720;      // world width = default design width
export const H0 = 1280;     // world height = default design height

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button in screen units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- live bindings (updated by relayout) --------------------------------------------------------
export let W = W0;
export let H = H0;
export let LAY = null;
export let HUD, PLAY_ZONE, POP_BTN, FLIP_BTN, HINT_BTN, MENU_BTN, WATCH_BAR, REF_BACK, REF_NEXT, TEXT_DEC, TEXT_INC;

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}

// Makes layout (w, h) the current one: the exported rectangles above always describe it.
export function relayout(w, h) {
  const L = layoutFor(w, h);
  if (L !== LAY) {
    LAY = L; W = L.W; H = L.H;
    HUD = L.hud; PLAY_ZONE = L.zone; POP_BTN = L.pop; FLIP_BTN = L.flip; HINT_BTN = L.hint; MENU_BTN = L.menu; WATCH_BAR = L.watch;
    REF_BACK = L.pages.back; REF_NEXT = L.pages.next; TEXT_DEC = L.pages.dec; TEXT_INC = L.pages.inc;
  }
  return L;
}

// Screen point -> world point (the stage transform), and back.
export const toWorld = (L, x, y) => ({ x: (x - L.st.x) / L.st.s, y: (y - L.st.y) / L.st.s + L.st.wy0 });
export const fromWorld = (L, x, y) => ({ x: L.st.x + x * L.st.s, y: L.st.y + (y - L.st.wy0) * L.st.s });

// Brand lockup box: about 5 % of the screen height, never tiny, never loud (the PNG is 1200 x 327).
export const lockupH = (h) => clamp(Math.round(h * 0.075), 56, 84);

// The goal card of the wide layout is a column; its height depends on the mode (trick / run / practice / watch).
export function hudBoxWide(L, mode, nSteps) {
  const b = L.left;
  const h = mode === 'run' ? 360 : mode === 'practice' ? 262 : 112 + nSteps * 58;
  return R(b.x, b.y, b.w, h);
}

function build(w, h, insS) {
  const land = w >= 900 && w > h;
  const s = land ? 1 : Math.min(1, Math.max(0.3, (h - insS.t - insS.b) / H0));
  const Wd = w / s, Hd = h / s;
  const I = { t: insS.t / s, r: insS.r / s, b: insS.b / s, l: insS.l / s };
  const bs = insS.back ? Math.max(insS.back, 56) / s : 0;
  const L = { w, h, s, land, W: Wd, H: Hd, ins: I };
  L.backBox = bs ? R(I.l, I.t, bs + 8, bs + 8) : R(0, 0, 0, 0);
  const U = L.U = { x0: I.l, y0: I.t, x1: Wd - I.r, y1: Hd - I.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const cx = (U.x0 + U.x1) / 2;
  // Arcforge lockup under the title menu: >= ~125 css px wide (css px per design unit = host.px * s)
  const cpu = Math.max(0.2, (host.px || 0.6) * s), lw0 = Math.max(250, Math.round(125 / cpu)), lh = Math.round(lw0 * 327 / 1200);
  L.lock = { h: lh, w: lw0, strip: lh + 26, cpu };

  // ---- stage and play-screen rectangles --------------------------------------------------------
  if (!land) {
    const colX = (Wd - 720) / 2, A = U.h, extra = Math.max(0, A - 290 - 1280);
    const SH = clamp(A - 290, 968, 1280);
    const hudY = U.y0 + 10 + extra * 0.3, stageY = hudY + 134;
    const barY = stageY + SH + 10 + extra * 0.4;
    const wy0 = clamp(634 - SH / 2, 0, H0 - SH);
    L.st = { x: colX, y: stageY, w: 720, h: SH, s: 1, wy0, round: 0 };
    let hx = colX + 20, hw = 680;
    if (bs && hudY < L.backBox.y + L.backBox.h) { hx = Math.max(hx, L.backBox.x + L.backBox.w + 6); hw = colX + 700 - hx; }
    L.hud = R(hx, hudY, hw, 128);
    const bw = (680 - 30) / 4;
    [L.pop, L.flip, L.hint, L.menu] = [0, 1, 2, 3].map((i) => R(colX + 20 + i * (bw + 10), barY, bw, 100));
    L.watch = { dec: R(colX + 20, barY, 132, 100), pause: R(colX + 162, barY, 256, 100), inc: R(colX + 428, barY, 132, 100), exit: R(colX + 570, barY, 130, 100), label: { x: colX + 360, y: barY + 100 + 22 } };
    L.bar = R(0, barY - 8, Wd, Hd - barY + 8);
    L.zone = R(colX, stageY, 720, SH);
    L.cap = R(colX + 40, stageY + 12, 640, 0);
    L.toastY = stageY + (1010 - wy0);
    L.toastW = 580;
    L.thinkText = { x: colX + 360, y: stageY + 40 };
    L.practiceChip = R(L.hud.x + 24, L.hud.y + 82, 250, 44);
    L.practiceHit = R(L.hud.x, L.hud.y + 62, L.hud.w, 66);
  } else {
    const pad = 8, stageH = U.h - 2 * pad;
    const ss = Math.min(stageH / 990, (U.w - 2 * (216 + 24)) / 720);
    const wyH = Math.min(H0, stageH / ss), stH = wyH * ss;
    const wy0 = clamp(634 - wyH / 2, 0, H0 - wyH);
    L.st = { x: cx - 360 * ss, y: U.y0 + pad + (stageH - stH) / 2, w: 720 * ss, h: stH, s: ss, wy0, round: 22 };
    const lw = clamp(L.st.x - 12 - (U.x0 + 12), 200, 340), rw = clamp((U.x1 - 12) - (L.st.x + L.st.w + 12), 200, 330);
    const ly = Math.max(U.y0 + pad, bs ? L.backBox.y + L.backBox.h + 6 : 0);
    L.left = R(L.st.x - 12 - lw, ly, lw, U.y1 - pad - ly);
    L.right = R(L.st.x + L.st.w + 12, U.y0 + pad, rw, U.h - 2 * pad);
    const g = 14, avail = L.right.h, popH = clamp(avail * 0.3, 96, 190), oth = clamp((avail - popH - 3 * g) / 3, 80, 130);
    const total = popH + 3 * oth + 3 * g, y0 = L.right.y + (avail - total) / 2, rx = L.right.x, rww = L.right.w;
    L.pop = R(rx, y0, rww, popH);
    L.flip = R(rx, y0 + popH + g, rww, oth);
    L.hint = R(rx, y0 + popH + oth + 2 * g, rww, oth);
    L.menu = R(rx, y0 + popH + 2 * oth + 3 * g, rww, oth);
    const half = (rww - g) / 2, wOth = clamp((avail - popH - 2 * g - 40) / 2, 80, 130), wTot = popH + g + 40 + wOth + g + wOth, wy = L.right.y + (avail - wTot) / 2;
    L.watch = { pause: R(rx, wy, rww, popH), label: { x: rx + rww / 2, y: wy + popH + g + 18 }, dec: R(rx, wy + popH + g + 36, half, wOth), inc: R(rx + half + g, wy + popH + g + 36, half, wOth), exit: R(rx, wy + popH + g + 36 + wOth + g, rww, wOth) };
    L.bar = null;
    L.zone = R(L.left.x + L.left.w, U.y0, L.right.x - (L.left.x + L.left.w), U.h);
    L.cap = R(L.left.x, 0, L.left.w, 0);
    L.toastY = L.st.y + L.st.h - 120 * ss;
    L.toastW = Math.min(580, L.st.w - 16);
    L.thinkText = { x: L.st.x + L.st.w / 2, y: L.st.y + 40 };
    L.hud = R(L.left.x, L.left.y, L.left.w, 0);
    L.practiceChip = R(L.left.x + 12, L.left.y + 148, L.left.w - 24, 64);
    L.practiceHit = R(L.left.x, L.left.y + 140, L.left.w, 80);
  }

  // ---- flow columns (menus) --------------------------------------------------------------------
  const colW = Math.min(640, Wd - 80);
  const ft = !land && bs ? U.y0 + bs + 12 : U.y0;            // scrolling lists start below the host back button (portrait)
  L.flow = { x: cx - colW / 2, w: colW, top: ft, bottom: U.y1 };
  const tw = Math.min(560, U.w * 0.42);
  L.titleFlow = !land ? { x: cx - colW / 2, w: colW, top: U.y0, bottom: U.y1 - L.lock.strip } : { x: U.x1 - 40 - tw, w: tw, top: U.y0, bottom: U.y1 - L.lock.strip };
  L.titleArt = land ? R(U.x0 + 20, U.y0, L.titleFlow.x - 40 - U.x0, U.h - 24) : R(cx - 360, U.y0, 720, 600);
  if (!land) {
    L.ladder = { flow: { x: cx - colW / 2, w: colW, top: ft, bottom: U.y1 - 130 }, back: R(cx - 340, U.y1 - 116, 680, 100), msg: { x: cx, y: U.y1 - 128 }, fade: R(0, U.y1 - 140, Wd, 140 + I.b), side: null };
  } else {
    const lw = Math.min(380, U.w * 0.3), x1 = U.x1 - 24, fw = Math.min(640, x1 - (U.x0 + lw + 80));
    L.ladder = { flow: { x: x1 - fw, w: fw, top: U.y0, bottom: U.y1 }, back: R(U.x0 + 24, U.y1 - 96, lw - 20, 80), msg: { x: U.x0 + 24 + (lw - 20) / 2, y: U.y1 - 112 }, fade: null, side: R(U.x0 + 24, Math.max(U.y0 + 20, bs ? L.backBox.y + L.backBox.h + 6 : 0), lw - 20, 300) };
  }

  // ---- reference pages (About / How to Play / Rules) -------------------------------------------
  if (!land) {
    const colP = (Wd - 652) / 2, rowY = U.y0 + 12, panelY = rowY + 70, bY = U.y1 - 112;
    const inc = R(colP + 652 - 120, rowY - 6, 120, 80), dec = R(inc.x - 12 - 120, rowY - 6, 120, 80);
    L.pages = { panel: R(colP, panelY, 652, bY - 14 - panelY), dec, inc, pct: { x: dec.x - 14, y: rowY + 34 }, back: R(cx - 348, bY, 332, 100), next: R(cx + 16, bY, 332, 100), land: false, hdrH: 80, ftH: 70 };
  } else {
    const bh = 80, bY = U.y1 - 8 - bh, x0 = Math.max(U.x0 + 20, bs ? L.backBox.x + L.backBox.w + 8 : 0), x1 = U.x1 - 20;
    const pw = Math.min(1100, x1 - x0), px = cx - pw / 2 < x0 ? x0 : cx - pw / 2;
    const panel = R(px, U.y0 + 8, pw, bY - 12 - (U.y0 + 8));
    const inc = R(panel.x + panel.w - 20 - 110, panel.y + 6, 110, 72), dec = R(inc.x - 12 - 110, panel.y + 6, 110, 72);
    L.pages = { panel, dec, inc, pct: { x: dec.x - 14, y: panel.y + 42 }, back: R(cx - 250, bY, 240, bh), next: R(cx + 10, bY, 240, bh), land: true, hdrH: 80, ftH: 52 };
  }
  // ---- pause card ------------------------------------------------------------------------------
  const pw = Math.min(660, Wd - 60);
  L.pause = { x: cx - pw / 2, w: pw, top: U.y0 + 20, bottom: U.y1 - 20 };
  return L;
}

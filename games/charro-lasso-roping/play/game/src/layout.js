// Geometry. FLUID LAYOUT (kit 1.7): the short side of the screen is always 720 virtual units and the long side grows with the aspect
// ratio. `layoutFor(w, h)` returns every rectangle of every screen for the live size (cached per size + safe insets), and
// `cameraFor` places the meadow's perspective camera inside the scene rectangle. Menu-like screens use `stackFrame`.

export const W = 720;
export const H = 1280;

export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // safe areas + host back button, virtual units (px = css px per unit)
export const live = { w: W, h: H };                                 // the current virtual screen size (set every frame by game.js)

// 44 css px expressed in virtual units (tap targets are never smaller than this)
export const minTap = () => Math.ceil(44 / Math.max(host.px, 0.25));
export const R = (x, y, w, h) => ({ x, y, w, h });
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.px * 100)}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 40) cache.delete(cache.keys().next().value); }
  return L;
}
export const curLayout = () => layoutFor(live.w, live.h);

function build(w, h, ins) {
  const U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b }; U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const back = ins.back ? Math.max(ins.back, 56) + 12 : 0;      // room the host's floating back button needs at the top-left
  const land = w >= h, mode = land ? 'wide' : U.h / U.w > 1.55 ? 'tall' : 'compact';
  const L = { w, h, ins, U, back, mode, land };
  L.play = buildPlay(L);
  L.title = buildTitle(L);
  L.panel = buildPanel(L);
  L.reader = buildReader(L);
  return L;
}

// ---- the play screens ------------------------------------------------------------------------------------------------------
// Top to bottom: score board, message plaque, the arena (scene), the rhythm track / loop meter (info) and the button row.
function buildPlay(L) {
  const { U, back, land } = L, P = {};
  const sbH = land ? 58 : 80, btnH = Math.max(land ? 56 : 78, minTap()), infoH = land ? 96 : 156;
  const sbX = U.x0 + (back ? back : 10), sbW = Math.min(U.x1 - 10 - sbX, land ? 980 : 700);
  P.board = R(sbX + (U.x1 - 10 - sbX - sbW) / 2, U.y0 + 8, sbW, sbH);
  const plW = Math.min(U.w - 20, 700), plH = land ? 40 : 50;
  P.plaque = R(U.x0 + (U.w - plW) / 2, P.board.y + sbH + 8, plW, plH);
  const rowW = Math.min(U.w - 20, land ? 760 : 700);
  P.row = R(U.x0 + (U.w - rowW) / 2, U.y1 - btnH - 10, rowW, btnH);
  const trW = Math.min(U.w - 20, land ? 980 : 700);
  P.info = R(U.x0 + (U.w - trW) / 2, P.row.y - infoH - 8, trW, infoH);
  const top = P.plaque.y + plH + 6, bottom = P.info.y - 6;
  P.scene = R(U.x0, top, U.w, Math.max(120, bottom - top));
  const slots = (n) => { const gap = 10, bw = (rowW - gap * (n - 1)) / n; return Array.from({ length: n }, (_, i) => R(P.row.x + i * (bw + gap), P.row.y, bw, btnH)); };
  P.btn = { play: slots(3), ap: slots(4), fs: land ? 0.9 : 1 };
  return P;
}

// ---- the title screen -------------------------------------------------------------------------------------------------------
function buildTitle(L) {
  const { U, back, land } = L, T = {};
  const lockW = 252, lockH = 69;
  if (land) {
    const pw = clamp(U.w * 0.36, 400, 540), ph = Math.min(U.h - 28 - lockH - 14, Math.max(400, 4 * minTap() + 3 * 12 + 36 + 20));
    const px = U.x1 - pw - Math.max(24, U.w * 0.04), py = U.y0 + Math.max(10, (U.h - ph - lockH - 14) / 2);
    T.plate = R(px, py, pw, ph);
    T.lock = R(px + (pw - lockW) / 2, py + ph + 12, lockW, lockH);
    const cw = px - U.x0 - 20;
    T.tblk = R(U.x0 + 20, U.y0 + Math.max(back, 24) + 8, cw, Math.min(U.h * 0.5, 330));
  } else {
    const pw = Math.min(U.w - 36, 600), ph = Math.min(U.h * 0.47, Math.max(400, 4 * minTap() + 3 * 12 + 36 + 20));
    const px = U.x0 + (U.w - pw) / 2, py = U.y1 - lockH - 26 - ph;
    T.plate = R(px, py, pw, ph);
    T.lock = R(px + (pw - lockW) / 2, py + ph + 12, lockW, lockH);
    T.tblk = R(U.x0 + 10, U.y0 + Math.max(back, 40) + 6, U.w - 20, Math.min(py - U.y0 - 20, 360));
  }
  T.region = R(T.plate.x + 22, T.plate.y + 18, T.plate.w - 44, T.plate.h - 36);
  T.u = 1;
  return T;
}

// ---- panels (setup, settings, How to Play, About, Rules, free-demo end) ------------------------------------------------------
function buildPanel(L) {
  const { U, ins, back, land } = L;
  const mx = Math.max(24, (U.w - 860) / 2), px = U.x0 + mx, pw = U.w - 2 * mx;
  const py = land ? U.y0 + 12 : U.y0 + 40, ph = L.h - py - Math.max(16, ins.b + 10);
  const head = land ? 130 : 160;
  return { x: px, y: py, w: pw, h: ph, head, titleY: py + (land ? 88 : 104), titleSize: land ? 46 : 62, titleMaxW: pw - 2 * (back ? back + 16 : 60), land };
}

function buildReader(L) {
  const P = L.panel, one = L.land || P.w >= 700;
  const bw = Math.min(P.w - 108, 720), bx = P.x + (P.w - bw) / 2;
  const out = { P, one };
  if (!one) {
    const rowY = P.y + P.h - 124;
    out.body = R(bx, P.y + P.head, bw, P.h - P.head - 300);
    out.captionY = P.y + P.h - 224; out.textY = P.y + P.h - 163; out.textX = P.x + P.w / 2;
    const nw = (P.w - 108 - 16) / 2;
    out.btn = {
      textDec: R(P.x + 54, P.y + P.h - 198 - (Math.max(52, minTap()) - 52), 110, Math.max(52, minTap())), textInc: R(P.x + P.w - 54 - 110, P.y + P.h - 198 - (Math.max(52, minTap()) - 52), 110, Math.max(52, minTap())),
      back: R(P.x + 54, rowY, nw, 78), page: R(P.x + 54 + nw + 16, rowY, nw, 78),
    };
  } else {
    const rh = Math.max(68, minTap()), rowY = P.y + P.h - 26 - rh, gap = 12, wB = 150, wN = 176, wS = 84, wT = 120, tot = wB + wN + 2 * wS + wT + 4 * gap, x0 = P.x + (P.w - tot) / 2;
    out.body = R(bx, P.y + P.head, bw, rowY - 40 - P.y - P.head);
    out.captionY = rowY - 16; out.textY = rowY + rh / 2 + 10; out.textX = x0 + wB + gap + wS + gap + wT / 2;
    out.btn = {
      back: R(x0, rowY, wB, rh), textDec: R(x0 + wB + gap, rowY, wS, rh), textInc: R(x0 + wB + gap + wS + gap + wT + gap, rowY, wS, rh), page: R(x0 + tot - wN, rowY, wN, rh),
    };
  }
  return out;
}

// ---- stack frames: where each menu-like screen's list lives ------------------------------------------------------------------
// Returns { region, footer: {x, w, bottom, row}, card?, u }. `u` scales the whole stack (cards shrink on small screens).
export function stackFrame(L, key) {
  const { U } = L;
  if (key === 'title') return { region: L.title.region, footer: null, u: L.title.u };
  if (key === 'over' || key === 'menu') {
    const cw0 = key === 'over' ? 620 : 560, ch0 = key === 'over' ? 700 : 620;
    const u = Math.min(1, (U.h - 16) / ch0, (U.w - 16) / cw0), cw = cw0 * u, ch = ch0 * u;
    const card = R(U.x0 + (U.w - cw) / 2, U.y0 + (U.h - ch) / 2, cw, ch);
    const top = key === 'over' ? 40 : 118;
    return { card, u, region: R(card.x + 44 * u, card.y + top * u, cw - 88 * u, (key === 'over' ? 490 : 450) * u), footer: { x: card.x + 40 * u, w: cw - 80 * u, bottom: card.y + ch - 40 * u, row: false } };
  }
  const P = L.panel, rw = Math.min(P.w - 108, 600), rx = P.x + (P.w - rw) / 2;
  return { region: R(rx, P.y + P.head - 8, rw, 0), footer: { x: rx, w: rw, bottom: P.y + P.h - (P.land ? 22 : 56), row: P.land }, u: 1, panel: P };
}

// Tap zone of the Arcforge lockup (title screen): at least 44 x 44 css px, grown sideways/downwards only.
export const creditHit = (r) => { const m = 44 / Math.max(host.px, 1e-6), w = Math.max(r.w, m), h = Math.max(r.h, m); return { x: Math.round(r.x + r.w / 2 - w / 2), y: Math.round(r.y), w: Math.round(w), h: Math.round(h) }; };

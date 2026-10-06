// Screen geometry as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units).
// `layoutFor(w, h)` returns every rectangle for that size, cached by size + safe-area key, so game.js (hit-testing) and
// view.js / menus.js (drawing) never disagree and a frame never recomputes it. Never read module-level W/H.
//
// Two shapes:
//   portrait  (narrower than 1.25:1): the approved phone look. The pitch "stage" is anchored to the bottom; taller phones
//             get a taller stage (more sky) and a taller control bar, shorter screens (tablets, small windows) scale the
//             whole stage down and widen it (gravel at both sides) so the whole lane is always visible.
//   wide      (landscape): the stage fills the screen; a score card sits over the left bank, a control card over the right
//             bank and the lane stays clear between them.
// The pitch is drawn through a "stage" transform: stage units -> screen = translate(tx, ty) scale(f) translate(ox, 0).
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const PULL = { min: 26, max: 230, draw: 0.62 };   // in STAGE units (a finger drag is divided by the stage scale)
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button in virtual units; main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // px: css pixels per virtual unit

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const BAR = 168;

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 30) cache.delete(cache.keys().next().value); }
  return L;
}

// screen point -> stage point, and back
export const toStage = (L, x, y) => ({ x: (x - L.stage.tx) / L.stage.f - L.stage.ox, y: (y - L.stage.ty) / L.stage.f });
export function applyStage(ctx, L) {
  const s = L.stage;
  ctx.translate(s.tx, s.ty); ctx.scale(s.f, s.f); ctx.translate(s.ox, 0);
}

function build(w, h, ins) {
  const wide = w >= h * 1.25;
  const L = { w, h, wide, mode: wide ? 'wide' : 'portrait', ins };
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  const liftB = Math.max(0, ins.b - 6);          // keep controls clear of the home indicator
  const sb = L.sb = h - liftB;                    // bottom of the stage / content area

  // ---- the stage ----------------------------------------------------------------------------------------------------
  let f, Hq, cy, ty, barExtra = 0;
  if (wide) { f = h / 1000; Hq = 1000; cy = 880; ty = 0; }
  else {
    f = clamp(sb / 1280, 0.6, 1);
    const Href = sb / f;
    Hq = Math.abs(Href - 1280) < 0.5 ? 1280 : Math.ceil(Href / 32 - 1e-6) * 32;
    barExtra = Math.round(Math.max(0, Href - 1280) * 0.4);
    cy = Hq - 330 - barExtra;
    ty = sb - f * Hq;
  }
  const Wref = w / f;
  const Wq = Math.abs(Wref - 720) < 0.5 ? 720 : Math.ceil(Wref / 64 - 1e-6) * 64;
  L.stage = { f, tx: 0, ty, ox: (Wref - Wq) / 2, w: Wq, h: Hq, cy };
  L.cam = { w: Wq, h: Hq, cy };

  // ---- play-screen furniture ----------------------------------------------------------------------------------------
  const P = L.play = {};
  if (!wide) {
    const bar = sb - BAR - barExtra;
    const e1 = Math.round(barExtra * 0.35), h1 = 80 + e1, h2 = 62 + e1;
    const y1 = bar + 10 + Math.round(barExtra * 0.3), y2 = y1 + h1 + 10;
    const lw = (w - 40 - 24) / 4, u = (w - 68) / 652;
    P.loft = [0, 1, 2, 3].map((i) => R(20 + i * (lw + 8), y1, lw, h1));
    P.spin = R(20, y2, Math.round(268 * u), h2); P.hint = R(P.spin.x + P.spin.w + 14, y2, Math.round(196 * u), h2);
    P.menu = R(P.hint.x + P.hint.w + 14, y2, w - 20 - (P.hint.x + P.hint.w + 14), h2);
    const dec = R(20, y1, Math.round(150 * u), h1), pause = R(dec.x + dec.w + 14, y1, Math.round(352 * u), h1);
    P.demo = { dec, pause, inc: R(pause.x + pause.w + 14, y1, w - 20 - (pause.x + pause.w + 14), h1), exit: R(20, y2, w - 40, h2) };
    P.barTop = bar;
    // HUD: two score cards and the end counter between them; the left card clears the host's back button
    const hy = ins.t + 14, lx = ins.back ? Math.max(20 + ins.l, L.backBox.x + L.backBox.w + 6) : 20 + ins.l;
    const rxm = 20 + ins.r, cw = Math.min(300, Math.floor((w - lx - rxm - 80) / 2));
    P.cards = [R(lx, hy, cw, 94), R(w - rxm - cw, hy, cw, 94)];
    P.endPos = { x: w / 2, y: hy + 50, y2: hy + 72, jy: hy + 92 };
    P.dotsPos = { x: w - 70 - ins.r, y: hy + 104 };
    P.ffPos = { x: w / 2, y: hy + 286 };
    P.pill = { x: w / 2, y: hy + 224, w: 0 };
    P.toast = { x: w / 2, y: hy + 128, maxW: Math.min(600, w - 60) };
    P.zone = R(0, hy + 172, w, bar - 6 - (hy + 172));
    const ph = Math.min(570, sb - 30 - (hy + 60)), pw = Math.min(660, w - 60);
    P.score = R((w - pw) / 2, sb - 590 + (570 - ph), pw, ph);   // the end-of-end close-up, bottom anchored
  } else {
    const gap = 12, side = Math.max(ins.l, ins.r);
    const cw = clamp(Math.floor(w / 2 - 262 - gap - side), 188, 330);
    const top = Math.max(ins.t + 10, ins.back ? L.backBox.y + L.backBox.h + 4 : 0), bot = h - Math.max(ins.b, 0) - 10;
    const rx = w - ins.r - gap - cw, lx = ins.l + gap;
    // right card: controls stacked. rows: loft 2x2, spin, hint | menu (watch bar: pause, think - | think +, exit)
    const rtop = ins.t + 10, g2 = 8, pad = 8, availH = bot - rtop - 2 * pad;
    const rowH = clamp(Math.floor((availH - 3 * g2) / 4), 56, 92);
    const colW = (cw - 2 * pad - g2) / 2, y0 = rtop + pad + Math.max(0, (availH - (4 * rowH + 3 * g2)) / 2);
    const rowY = (i) => y0 + i * (rowH + g2);
    P.rightCard = R(rx, rtop, cw, bot - rtop); P.leftCard = R(lx, top, cw, bot - top);
    P.loft = [0, 1, 2, 3].map((i) => R(rx + pad + (i % 2) * (colW + g2), rowY(Math.floor(i / 2)), colW, rowH));
    P.spin = R(rx + pad, rowY(2), cw - 2 * pad, rowH);
    P.hint = R(rx + pad, rowY(3), colW, rowH); P.menu = R(rx + pad + colW + g2, rowY(3), colW, rowH);
    P.demo = {
      pause: R(rx + pad, rowY(0), cw - 2 * pad, rowH), dec: R(rx + pad, rowY(1), colW, rowH), inc: R(rx + pad + colW + g2, rowY(1), colW, rowH),
      exit: R(rx + pad, rowY(2), cw - 2 * pad, rowH),
    };
    // left card: the two score cards stacked, then the end counter, the think dots and the phase pill
    P.cards = [R(lx, top, cw, 94), R(lx, top + 104, cw, 94)];
    P.endPos = { x: lx + cw / 2, y: top + 226, y2: top + 250, jy: top + 272 };
    P.dotsPos = { x: lx + cw - 22, y: top + 226 };
    P.pill = { x: lx + cw / 2, y: top + 292, w: cw };
    P.ffPos = { x: w / 2, y: 80 };
    P.toast = { x: w / 2, y: Math.max(ins.t + 12, 14), maxW: Math.max(300, Math.min(520, w - 2 * (cw + gap + 24 + side))) };
    const zx0 = lx + cw + 6, zx1 = rx - 6;
    P.zone = R(zx0, 0, zx1 - zx0, h);
    const pw = clamp(zx1 - zx0 + 120, 460, 640), ph = Math.min(h - 24, 640);
    P.score = R(w / 2 - pw / 2, (h - ph) / 2, pw, ph);
  }

  // ---- setup pins / reference pages -----------------------------------------------------------------------------------
  // setup screen: one column + pinned Start / Back (portrait); two columns with Start / Back at the foot of the right one (wide)
  const su = L.setup = {};
  if (!wide) {
    const k = (w - 76) / 644, sw = Math.round(440 * k), cw = Math.min(640, w - 80);
    L.pins = { start: R(30, sb - 124, sw, 96), back: R(30 + sw + 16, sb - 124, w - 30 - (30 + sw + 16), 96) };
    su.cols = [{ x: (w - cw) / 2, w: cw, top: ins.t, bottom: L.pins.start.y - 26 }];
  } else {
    const tw = Math.min(1100, w - 2 * (Math.max(ins.l, ins.r) + 16)), cw = (tw - 24) / 2, x0 = (w - tw) / 2, top = Math.max(ins.t, 0) + 8, bot = sb - 8;
    const sw = Math.round((cw - 14) * 0.68);
    L.pins = { start: R(x0 + cw + 24, bot - 80, sw, 80), back: R(x0 + cw + 24 + sw + 14, bot - 80, cw - sw - 14, 80) };
    su.cols = [{ x: x0, w: cw, top, bottom: bot }, { x: x0 + cw + 24, w: cw, top, bottom: L.pins.start.y - 12 }];
  }
  const ref = L.ref = {};
  if (!wide) {
    const py = Math.max(100, ins.t + (ins.back ? backSz + 12 : 24)), navY = sb - 116, mx = 34 + Math.max(0, ins.l - 14, ins.r - 14);
    ref.panel = R(mx, py, w - 2 * mx, navY - 34 - py);
    const bw = (w - 56) / 2;
    ref.back = R(20, navY, bw, 100); ref.next = R(20 + bw + 16, navY, bw, 100);
  } else {
    const mx = Math.max(ins.l, ins.r, 0) + (ins.back ? backSz + 14 : 18), py = Math.max(ins.t, 0) + 14, nh = 72, navY = sb - 14 - nh;
    ref.panel = R(mx, py, w - 2 * mx, navY - 12 - py);
    const bw = Math.min(300, (ref.panel.w - 16) / 2);
    ref.back = R(ref.panel.x, navY, bw, nh); ref.next = R(ref.panel.x + ref.panel.w - bw, navY, bw, nh);
  }
  ref.dec = R(ref.panel.x + 12, ref.panel.y + 6, 96, 68); ref.inc = R(ref.panel.x + ref.panel.w - 108, ref.panel.y + 6, 96, 68);
  return L;
}

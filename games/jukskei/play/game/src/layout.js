// Screen geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// `layoutFor(w, h)` returns every rectangle for that size, cached by size + safe-area key, so game.js (hit-testing) and
// view.js / menus.js (drawing) never disagree. Two shapes: portrait (two control rows under a wide view) and wide (one row).
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button in virtual units; main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // px: css pixels per virtual unit

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const cache = new Map();
export function layoutFor(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, { ...host }); L.key = key; cache.set(key, L); if (cache.size > 30) cache.delete(cache.keys().next().value); }
  return L;
}

function build(w, h, ins) {
  const wide = w >= h * 1.25;
  const L = { w, h, wide, mode: wide ? 'wide' : 'portrait', ins };
  const backSz = ins.back ? Math.max(ins.back, 56) : 0;
  L.backBox = ins.back ? R(ins.l, ins.t, backSz + 8, backSz + 8) : R(0, 0, 0, 0);
  L.U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  const liftB = Math.max(0, ins.b - 6);
  const sb = L.sb = h - liftB;
  const minH = Math.ceil(46 / Math.max(0.2, ins.px || 0.6));

  const P = L.play = {};
  if (!wide) {
    const pad = 14, g = 10, rowH = clamp(Math.round(sb * 0.07), Math.max(74, minH), 90);
    const barH = 2 * rowH + 3 * g, bar = sb - barH, iw = w - 2 * pad;
    const r1 = bar + g, r2 = r1 + rowH + g;
    const ww = (iw - 2 * g) / 3;
    P.styles = [0, 1, 2].map((i) => R(pad + i * (ww + g), r1, ww, rowH));
    const hw = Math.round((iw - 2 * g) * 0.26), mw = Math.round((iw - 2 * g) * 0.24);
    P.hint = R(pad, r2, hw, rowH); P.throwB = R(pad + hw + g, r2, iw - hw - mw - 2 * g, rowH); P.menu = R(w - pad - mw, r2, mw, rowH);
    const dw = Math.round((iw - 2 * g) * 0.3), tw = (iw - 2 * g) / 3;
    P.demo = { dec: R(pad, r1, dw, rowH), pause: R(pad + dw + g, r1, iw - 2 * dw - 2 * g, rowH), inc: R(w - pad - dw, r1, dw, rowH),
      rules: R(pad, r2, tw, rowH), howto: R(pad + tw + g, r2, tw, rowH), exit: R(pad + 2 * (tw + g), r2, tw, rowH) };
    P.barTop = bar;
    const hy = ins.t + 10, lx = ins.back ? Math.max(14 + ins.l, L.backBox.x + L.backBox.w + 4) : 14 + ins.l, rxm = 14 + ins.r;
    const gapC = Math.max(150, Math.round(90 / Math.max(0.2, ins.px || 0.6))), cwL = Math.min(330, Math.floor(w / 2 - gapC / 2 - lx)), cwR = Math.min(330, Math.floor(w / 2 - gapC / 2 - rxm)), ch = 92;
    P.cards = [R(lx, hy, cwL, ch), R(w - rxm - cwR, hy, cwR, ch)];
    P.info = { x: w / 2, y: hy + 58, y2: hy + 82, maxW: gapC + 20 };
    P.toast = { x: w / 2, y: hy + ch + 8 + 10 + 74 + 26, maxW: Math.min(620, w - 40) };   // under the wind box
    const top = hy + ch + 8;
    P.view = { ...R(0, top, w, bar - 4 - top), gyF: 0.78 };
    P.pill = { x: w / 2, y: P.view.y + P.view.h - 26, w: Math.min(w - 40, 560) };
    // portrait: while aiming the view splits into the whole lane (top) and a large close-up of the stake (bottom)
    P.split = true;
    P.strip = { ...R(P.view.x, P.view.y, P.view.w, Math.round(P.view.h * (P.view.h > 560 ? 0.33 : 0.4))), gyF: 0.8 };   // tall views: less empty sky above the lane, a bigger stake close-up
    P.loupe = { ...R(P.view.x, P.strip.y + P.strip.h + 6, P.view.w, P.view.h - P.strip.h - 6), gyF: 0.62 };
    P.windBox = R(P.view.x + 10 + ins.l, P.view.y + 10, 280, 74);
    P.meter = R(Math.round(w / 2 - Math.min(w - 40, 560) / 2), P.view.y + P.view.h - 112, Math.min(w - 40, 560), 54);
    P.ffPos = { x: w / 2, y: bar - 22 };
    const pw = Math.min(660, w - 40), ph = Math.min(300, P.view.h - 20);
    P.score = R((w - pw) / 2, P.view.y + P.view.h - ph - 10, pw, ph);
  } else {
    const g = 10, lx = (ins.back ? Math.max(14 + ins.l, L.backBox.x + L.backBox.w + 4) : 14 + ins.l), rxm = 14 + ins.r;
    const rowH = Math.max(minH, 84), barH = rowH + 2 * g + 2, bar = sb - barH;
    const y1 = bar + g, inner = w - lx - rxm;
    const share = [1, 1, 1, 0.9, 1.6, 0.8], tot = share.reduce((a, c) => a + c, 0);
    const unitW = (inner - 5 * g) / tot;
    let x = lx; const xs = share.map((sh) => { const r = { x, w: sh * unitW }; x += r.w + g; return r; });
    P.styles = [0, 1, 2].map((i) => R(xs[i].x, y1, xs[i].w, rowH));
    P.hint = R(xs[3].x, y1, xs[3].w, rowH); P.throwB = R(xs[4].x, y1, xs[4].w, rowH); P.menu = R(xs[5].x, y1, xs[5].w, rowH);
    const q = (inner - 4 * g) / 5;
    P.demo = { dec: R(lx, y1, q, rowH), pause: R(lx + q + g, y1, q, rowH), inc: R(lx + 2 * (q + g), y1, q, rowH), rules: R(lx + 3 * (q + g), y1, q, rowH), exit: R(lx + 4 * (q + g), y1, q, rowH) };
    P.barTop = bar;
    const hy = ins.t + 8, ch = 80, gapC = Math.max(260, Math.round(150 / Math.max(0.2, ins.px || 0.6)));
    const cap = clamp(Math.floor((w - lx - rxm - 380) / 2), 220, 330);
    const cwL = Math.min(cap, Math.floor(w / 2 - gapC / 2 - lx)), cwR = Math.min(cap, Math.floor(w / 2 - gapC / 2 - rxm));
    P.cards = [R(lx, hy, cwL, ch), R(w - rxm - cwR, hy, cwR, ch)];
    P.info = { x: w / 2, y: hy + 64, y2: hy + 85, maxW: w - lx - rxm - cwL - cwR - 24 };
    P.toast = { x: w / 2, y: hy + ch + 40, maxW: Math.min(640, w - 40) };
    P.explain = R(P.cards[0].x + cwL + 12, hy, Math.max(0, P.cards[1].x - 12 - (P.cards[0].x + cwL + 12)), ch);
    const top = hy + ch + 6;
    P.view = { ...R(ins.l + 6, top, w - ins.l - ins.r - 12, bar - 4 - top), gyF: 0.78 };
    P.pill = { x: w / 2, y: P.view.y + P.view.h - 26, w: Math.min(w - 40, 640) };
    P.split = false;
    P.strip = P.view;
    const lw = Math.min(320, Math.round(P.view.w * 0.28)), lh = Math.min(180, Math.round(P.view.h * 0.42));
    P.loupe = { ...R(P.view.x + P.view.w - lw - 10, P.view.y + 10, lw, lh), gyF: 0.7 };
    P.windBox = R(P.view.x + 10, P.view.y + 10, 280, 74);
    P.meter = R(Math.round(w / 2 - 300), P.view.y + P.view.h - 100, 600, 50);
    P.ffPos = { x: w - rxm - 70, y: bar - 20 };
    const pw = clamp(P.view.w * 0.5, 460, 640), ph = Math.min(P.view.h - 20, 280);
    P.score = R(w / 2 - pw / 2, P.view.y + P.view.h - ph - 8, pw, ph);
  }

  const su = L.setup = {};
  if (!wide) {
    const k = (w - 76) / 644, sw = Math.round(440 * k), cw = Math.min(640, w - 80);
    L.pins = { start: R(30, sb - 124, sw, 96), back: R(30 + sw + 16, sb - 124, w - 30 - (30 + sw + 16), 96) };
    su.cols = [{ x: (w - cw) / 2, w: cw, top: ins.t, bottom: L.pins.start.y - 26 }];
  } else {
    const tw = Math.min(1320, w - 2 * (Math.max(ins.l, ins.r) + 16)), cw = (tw - 48) / 3, x0 = (w - tw) / 2, top = Math.max(ins.t, 0) + 18, bot = sb - 8;
    const x3 = x0 + 2 * (cw + 24), ph = 84;
    L.pins = { start: R(x3, bot - 2 * ph - 12, cw, ph), back: R(x3, bot - ph, cw, ph) };
    su.cols = [{ x: x0, w: cw, top, bottom: bot }, { x: x0 + cw + 24, w: cw, top, bottom: bot }, { x: x3, w: cw, top, bottom: L.pins.start.y - 12 }];
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

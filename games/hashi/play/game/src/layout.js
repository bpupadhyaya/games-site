// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// Every screen has a builder here; render and hit-testing both read the same rects, so what is drawn is what is tapped.
//   play   portrait phone  : header, square sea, then a progress card and a row of four tools
//          landscape       : sea | one panel with info, progress and a 2x2 tool grid
//   The hand setting mirrors the tool side. A hint card takes over the controls area (or the board shrinks to make room).
import { v3 } from './v3.js';
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.55 };   // safe areas + host back button (main.js keeps it current)

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const grid = (r, cols, rows, gx, gy = gx) => {
  const w = (r.w - gx * (cols - 1)) / cols, h = (r.h - gy * (rows - 1)) / rows, out = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) out.push(R(r.x + i * (w + gx), r.y + j * (h + gy), w, h));
  return out;
};

const cache = new Map();
function memo(key, f) {
  let v = cache.get(key);
  if (!v) { v = f(); cache.set(key, v); if (cache.size > 120) cache.delete(cache.keys().next().value); }
  return v;
}
const insKey = () => `${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
export function frame(w, h) {
  w = Math.round(w); h = Math.round(h);
  const ins = { ...host }, U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const back = ins.back ? R(ins.l, ins.t, Math.max(ins.back, 56) + 10, Math.max(ins.back, 56) + 10) : R(0, 0, 0, 0);
  return { w, h, ins, U, back, land: w >= h };
}

// ---- the board ---------------------------------------------------------------------------------------------------------------
// The sea is a square box B x B. The archipelago (pw x ph lattice points) is centred inside it with the largest cell that fits.
export function boardGeo(x, y, B, pw = 9, ph = 9) {
  const p = B * 0.035, s = Math.min((B - 2 * p) / pw, (B - 2 * p) / ph);
  const gx = x + (B - s * pw) / 2, gy = y + (B - s * ph) / 2;
  const cx = (ix) => gx + (ix + 0.5) * s, cy = (iy) => gy + (iy + 0.5) * s;
  return { x, y, size: B, s, pw, ph, gx, gy, cx, cy, rect: R(x, y, B, B) };
}

// ---- play --------------------------------------------------------------------------------------------------------------------
export function playLayout(w, h, { coach = false, hand = 'right', pw = 9, ph = 9 } = {}) {
  return memo(`play|${Math.round(w)}x${Math.round(h)}|${insKey()}|${coach ? 1 : 0}|${hand}|${pw}x${ph}`, () => buildPlay(frame(w, h), coach, hand === 'left', pw, ph));
}

function toolRects(tr, cols, rows, gap, order) {
  const cells = grid(tr, cols, rows, gap), t = {};
  order.forEach((k, i) => { t[k] = cells[i]; });
  return t;
}
const TOOLS = ['undo', 'redo', 'clear', 'hint'];

function buildPlay(F, coach, lefty, pw, ph) {
  const { U, back } = F, w = F.w, h = F.h;
  const m = clamp(U.w * 0.02, 12, 26);
  // candidates: portrait (board over controls) or landscape (board beside one panel)
  const hudH = 88, hudTop = U.y0 + 6, bTop = hudTop + hudH + 6;
  const minCtl = coach ? 330 : 190;
  const Bp = clamp(Math.min(U.w - 2 * m, U.y1 - bTop - minCtl - 8), 160, 1200);
  const Hmax = U.h - 2 * m;
  const RwB = clamp(U.w * 0.3, 300, 470), Bb = Math.min(Hmax, U.w - RwB - 3 * m);
  let mode = 'portrait', B = Bp;
  if (F.land && Bb >= Bp * 1.05) { mode = 'B'; B = Bb; }
  const L = { F, w, h, U, mode, m, lefty, coach, back };
  const gap = 12;
  if (mode === 'portrait') {
    const bx = U.x0 + (U.w - B) / 2, by = bTop;
    L.board = boardGeo(bx, by, B, pw, ph);
    const cw = Math.min(U.w - 2 * m, Math.max(B, 560)), cx = U.x0 + (U.w - cw) / 2;
    const ctlTop = by + B + 12, ctlH = Math.max(100, U.y1 - ctlTop - 8);
    const hb = U.x0 + (back.w ? back.w + 4 : 0);
    L.hud = { diff: R(Math.max(U.x0 + m, hb), hudTop, cw * 0.4, hudH), timer: { x: U.x0 + U.w / 2 + (back.w ? 20 : 0), y: hudTop + 62 }, pause: R(U.x1 - m - 66, hudTop + 10, 66, 66), mist: { x: U.x1 - m - 66 - 18, y: hudTop + 62 } };
    L.pause = L.hud.pause;
    L.ctl = R(cx, ctlTop, cw, ctlH);
    const toolH = clamp(ctlH * 0.34, 62, 110), progH = ctlH - toolH - gap * 2 >= 70 ? clamp(ctlH * 0.3, 70, 130) : 0;
    const groupH = (progH ? progH + gap : 0) + toolH, gy0 = ctlTop + Math.max(0, (ctlH - groupH) * 0.45);
    L.prog = progH ? R(cx, gy0, cw, progH) : null;
    L.tools = toolRects(R(cx, gy0 + (progH ? progH + gap : 0), cw, toolH), 4, 1, gap, lefty ? TOOLS.slice().reverse() : TOOLS);
    L.toolStyle = 'row';
    L.coachR = coach ? R(cx, by + B + 12, cw, Math.max(120, U.y1 - (by + B + 12) - 8)) : null;
    if (coach) L.ctl = L.coachR;
  } else {
    const Rw = clamp(U.w - B - 3 * m, RwB, 560), groupW = Rw + B + 3 * m, gx0 = U.x0 + Math.max(0, (U.w - groupW) / 2);
    const by = U.y0 + (U.h - B) / 2;
    const pr = R(lefty ? gx0 + m : gx0 + groupW - m - Rw, U.y0 + m, Rw, U.h - 2 * m), bx = lefty ? pr.x + pr.w + m : gx0 + m;
    L.board = boardGeo(bx, by, B, pw, ph);
    L.info = pr;
    const edgeLeft = pr.x <= U.x0 + 60, topPad = back.w && edgeLeft ? Math.max(14, back.y + back.h - pr.y + 4) : 14;
    L.infoTop = pr.y + topPad;
    L.pause = R(pr.x + pr.w - 14 - 62, L.infoTop + 40, 62, 62);
    L.infoTop += 44;
    L.hud = { diff: R(pr.x + 16, L.infoTop, pr.w - 32, 54), timer: { x: pr.x + pr.w / 2, y: L.infoTop + (coach ? 104 : 118) } };
    const pad = 14, toolH = clamp(pr.h * 0.12, 64, 96), cr = R(pr.x + pad, pr.y + pr.h - pad - 2 * toolH - gap - (pr.h > 640 ? 40 : 0), pr.w - 2 * pad, 2 * toolH + gap);
    L.tools = toolRects(cr, 2, 2, gap, TOOLS);
    L.toolStyle = 'grid';
    L.ctl = R(pr.x + pad, L.infoTop + 150, pr.w - 2 * pad, pr.y + pr.h - pad - (L.infoTop + 150));
    L.prog = R(pr.x + pad, L.infoTop + 150, pr.w - 2 * pad, Math.max(0, cr.y - gap - (L.infoTop + 150)));
    if (L.prog.h < 70) L.prog = null;
    L.coachR = R(pr.x + pad, L.infoTop + 138, pr.w - 2 * pad, pr.y + pr.h - pad - (L.infoTop + 138));
    if (coach) L.ctl = L.coachR;
  }
  // hint card and Watch & Learn rail inside the controls area
  const C = L.coachR ?? L.ctl, bh = 66, ip = 12;
  L.coachBtns = { close: R(C.x + ip, C.y + C.h - bh - ip, C.w / 2 - ip - 6, bh), go: R(C.x + C.w / 2 + 6, C.y + C.h - bh - ip, C.w / 2 - ip - 6, bh) };
  const wide = C.w >= 560, rh = wide ? bh : bh * 2 + 10;
  const rail = grid(R(C.x + ip, C.y + C.h - rh - ip, C.w - 2 * ip, rh), wide ? 4 : 2, wide ? 1 : 2, 10);
  L.rail = { exit: rail[0], pause: rail[1], dec: rail[2], inc: rail[3] };
  L.coachText = R(C.x, C.y, C.w, C.h - Math.max(bh, rh) - 12 - ip);
  return L;
}

// ---- title -----------------------------------------------------------------------------------------------------------------------
export function titleLayout(w, h, hasSave) {
  return memo(`title|${Math.round(w)}x${Math.round(h)}|${insKey()}|${hasSave ? 1 : 0}`, () => {
    const F = frame(w, h), { U } = F, m = 18;
    const T = { F, buttons: {} };
    const prim = (hasSave ? ['continue'] : []).concat(['new', 'daily']), sec = ['learn', 'howto', 'rules', 'stats', 'settings', 'about'];
    let col;
    if (F.land && U.w > 760) {
      const cw = clamp(U.w * 0.42, 420, 640), cx = U.x1 - cw - m * 1.5;
      T.hero = R(U.x0 + m, U.y0 + m, cx - U.x0 - 2 * m, U.h - 2 * m - 70);
      col = R(cx, U.y0 + m, cw, U.h - 2 * m - 60);
      T.brand = { x: U.x0 + (cx - U.x0) / 2, y: U.y1 - 26 }; T.landscape = true;
    } else {
      const cw = Math.min(U.w - 2 * m, 640), top = U.y0 + 6;
      const need = prim.length * 96 + 16 + 3 * 74 + 10 + 80;
      const heroH = clamp(U.h - need - 70, 200, 640);
      T.hero = R(U.x0 + m, top + (F.ins.back ? 40 : 0), U.w - 2 * m, heroH - (F.ins.back ? 40 : 0));
      col = R(U.x0 + (U.w - cw) / 2, top + heroH, cw, U.h - heroH - 70);
      T.brand = { x: U.x0 + U.w / 2, y: U.y1 - 26 };
    }
    const pH = clamp((col.h - 16 - 3 * 12) / (prim.length + 3) * 1.18, 70, 132), sH = clamp(pH * 0.74, 54, 100);
    let y = col.y + Math.max(0, (col.h - (prim.length * (pH + 12) + 16 + 3 * (sH + 10))) / 2);
    prim.forEach((id) => { T.buttons[id] = R(col.x, y, col.w, pH); y += pH + 12; });
    y += 4;
    const g = grid(R(col.x, y, col.w, 3 * sH + 20), 2, 3, 10);
    sec.forEach((id, i) => { T.buttons[id] = g[i]; });
    return T;
  });
}

// ---- generic header + scrolling body used by the text/list screens ------------------------------------------------------------------
export function pageLayout(w, h, { footer = 0 } = {}) {
  return memo(`page|${Math.round(w)}x${Math.round(h)}|${insKey()}|${footer}`, () => {
    const F = frame(w, h), { U, back } = F, m = clamp(U.w * 0.025, 14, 36);
    const hdrTop = U.y0 + 8, hdrH = 70, maxW = Math.min(U.w - 2 * m, 1500);
    const x0 = U.x0 + (U.w - maxW) / 2;
    const P = { F, m, maxW, x0 };
    P.titleX = Math.max(x0, back.w ? U.x0 + back.w + 4 : x0);
    P.header = R(x0, hdrTop, maxW, hdrH);
    P.textDec = R(U.x1 - m - 2 * 74 - 8, hdrTop + 4, 74, 62); P.textInc = R(U.x1 - m - 74, hdrTop + 4, 74, 62);
    const fh = footer ? 78 : 0;
    P.footer = R(x0, U.y1 - fh - 8, maxW, fh);
    P.body = R(x0, hdrTop + hdrH + 8, maxW, U.y1 - 8 - fh - (hdrTop + hdrH + 8) - (footer ? 8 : 0));
    return P;
  });
}
export function docLayout(w, h) {
  return memo(`doc|${Math.round(w)}x${Math.round(h)}|${insKey()}`, () => {
    const P = { ...pageLayout(w, h, { footer: 1 }) };
    const f = P.footer, bw = Math.min(190, f.w * 0.22);
    P.menu = R(f.x, f.y, bw, f.h); P.prev = R(f.x + f.w - 2 * bw - 14 - Math.min(150, f.w * 0.16), f.y, bw, f.h);
    P.count = R(P.prev.x + bw + 7, f.y, Math.min(150, f.w * 0.16), f.h); P.next = R(f.x + f.w - bw, f.y, bw, f.h);
    P.split = P.F.land && P.F.U.w >= 880;
    if (P.split) { const lw = clamp(P.body.w * 0.44, 380, 760); P.fig = R(P.body.x, P.body.y, lw, P.body.h); P.text = R(P.body.x + lw + 20, P.body.y, P.body.w - lw - 20, P.body.h); }
    else { P.fig = null; P.text = P.body; }
    return P;
  });
}
export function settingsLayout(w, h, scale, nRows) {
  return memo(`set|${Math.round(w)}x${Math.round(h)}|${insKey()}|${scale}|${nRows}`, () => {
    const P = { ...pageLayout(w, h, { footer: 1 }) };
    const f = P.footer; P.back = R(f.x + f.w / 2 - 160, f.y, 320, f.h);
    const cols = P.body.w >= 1250 ? 2 : 1, gap = 12, rowH = Math.round(98 * (1 + (scale - 1) * 0.5)), cw = (P.body.w - gap * (cols - 1)) / cols;
    P.rows = []; P.cols = cols;
    for (let i = 0; i < nRows; i++) {
      const c = i % cols, r = Math.floor(i / cols), rect = R(P.body.x + c * (cw + gap), P.body.y + r * (rowH + gap), cw, rowH);
      const frac = cw < 800 ? ({ 0: 0.8, 2: 0.68 }[i] ?? 0.54) : 0.5, ctrlW = Math.min(cw * (scale > 1.6 ? Math.max(frac, 0.6) : frac), 560), ctrl = R(rect.x + rect.w - 14 - ctrlW, rect.y + 14, ctrlW, rect.h - 28);
      P.rows.push({ rect, ctrl });
    }
    P.contentH = Math.ceil(nRows / cols) * (rowH + gap);
    return P;
  });
}
export function newLayout(w, h, nCards) {
  return memo(`new|${Math.round(w)}x${Math.round(h)}|${insKey()}|${nCards}`, () => {
    const P = { ...pageLayout(w, h, { footer: 1 }) };
    const f = P.footer; P.back = R(f.x + f.w / 2 - 160, f.y, 320, f.h);
    const cols = P.body.w >= 1500 ? 3 : P.body.w >= 780 ? 2 : 1, gap = 12, cw = (P.body.w - gap * (cols - 1)) / cols, rows = Math.ceil(nCards / cols), ch = clamp((P.body.h - gap * (rows - 1)) / rows, cols === 1 ? 128 : 140, 200);
    P.cards = []; P.cols = cols;
    for (let i = 0; i < nCards; i++) P.cards.push(R(P.body.x + (i % cols) * (cw + gap), P.body.y + Math.floor(i / cols) * (ch + gap), cw, ch));
    P.contentH = Math.ceil(nCards / cols) * (ch + gap);
    return P;
  });
}
export function statsLayout(w, h) {
  return memo(`stats|${Math.round(w)}x${Math.round(h)}|${insKey()}`, () => {
    const P = { ...pageLayout(w, h, { footer: 1 }) };
    const f = P.footer; P.back = R(f.x + f.w / 2 - 160, f.y, 320, f.h);
    return P;
  });
}

// ---- result ----------------------------------------------------------------------------------------------------------------------
export function overLayout(w, h, scale = 1, pw = 9, ph = 9) {
  return memo(`over|${Math.round(w)}x${Math.round(h)}|${insKey()}|${scale}|${pw}x${ph}|${v3.on ? 3 : 2}`, () => {
    const F = frame(w, h), { U } = F, m = 18, O = { F };
    const bh = F.land && U.w > U.h * 1.05 ? 66 : 76, wide = F.land && U.w > U.h * 1.05;
    O.wide = wide;
    if (wide) {
      const bs = Math.min(U.h - 2 * m - 20, U.w * 0.42) * (scale > 2 ? 0.8 : 1);
      O.board = boardGeo(U.x0 + m + 6, U.y0 + (U.h - bs) / 2, bs, pw, ph);
      const cx = O.board.x + bs + 36, cw = U.x1 - m - cx;
      O.body = R(cx, U.y0 + m, cw, U.h - 2 * m - 3 * (bh + 12) - 40);
      O.btns = { next: R(cx, U.y1 - m - 3 * (bh + 12) - 24, cw, bh), share: R(cx, U.y1 - m - 2 * (bh + 12) - 24, cw / 2 - 6, bh), menu: R(cx + cw / 2 + 6, U.y1 - m - 2 * (bh + 12) - 24, cw / 2 - 6, bh) };
      O.btns.share = R(cx, O.btns.next.y + bh + 12, cw / 2 - 6, bh); O.btns.menu = R(cx + cw / 2 + 6, O.btns.next.y + bh + 12, cw / 2 - 6, bh);
      O.more = { x: cx + cw / 2, y: U.y1 - m - 8 };
      O.body = R(cx, U.y0 + m, cw, O.btns.next.y - 14 - U.y0 - m);
    } else {
      const cw = Math.min(U.w - 2 * m, 700), cx = U.x0 + (U.w - cw) / 2;
      const bs = clamp(Math.min(cw * 0.8, U.h * (v3.on ? 0.4 : 0.28)) * (scale <= 1 ? 1 : scale <= 1.5 ? 0.8 : scale <= 2 ? 0.6 : 0.42), 100, 520);
      O.board = boardGeo(U.x0 + (U.w - bs) / 2, U.y0 + 14 + (F.ins.back ? 44 : 0), bs, pw, ph);
      const by = U.y1 - m - 2 * (bh + 12) - 36;
      O.btns = { next: R(cx, by, cw, bh), share: R(cx, by + bh + 12, cw / 2 - 6, bh), menu: R(cx + cw / 2 + 6, by + bh + 12, cw / 2 - 6, bh) };
      O.body = R(cx, O.board.y + bs + 10, cw, by - 12 - (O.board.y + bs + 10));
      O.more = { x: U.x0 + U.w / 2, y: U.y1 - 8 };
    }
    return O;
  });
}

// ---- small overlays -----------------------------------------------------------------------------------------------------------------
export function pauseLayout(w, h, board) {
  const b = board, cw = Math.min(b.size - 40, 520), n = 4, bh = Math.max(46, Math.min(78, (b.size - 24 - 80) / n - 12)), ch = n * (bh + 12) + 80;
  const card = R(b.x + (b.size - cw) / 2, b.y + (b.size - ch) / 2, cw, ch);
  const P = { card, resume: R(card.x + 16, card.y + 70, cw - 32, bh), restart: R(card.x + 16, card.y + 70 + bh + 12, cw - 32, bh), settings: R(card.x + 16, card.y + 70 + 2 * (bh + 12), cw - 32, bh), menu: R(card.x + 16, card.y + 70 + 3 * (bh + 12), cw - 32, bh) };
  return P;
}
export function centerCard(w, h, cw, ch) { const F = frame(w, h), { U } = F; return R(U.x0 + (U.w - Math.min(cw, U.w - 32)) / 2, U.y0 + (U.h - Math.min(ch, U.h - 32)) / 2, Math.min(cw, U.w - 32), Math.min(ch, U.h - 32)); }
export { R, clamp, grid };

// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// Every screen has a builder here; render and hit-testing both read the same rects, so what is drawn is what is tapped.
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.55 };   // safe areas + host back button (main.js keeps it current)

// Smallest comfortable touch target (about 46 CSS px) in layout units, so buttons never shrink below a finger on a 360 px phone.
export const tapU = () => clamp(46 / Math.max(0.3, host.px || 0.55), 0, 120);
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

// ---- play ----------------------------------------------------------------------------------------------------------------------
//   portrait : header (tale name, beat beads, pause), the painted scene, then the cloth panel with the tool row at its bottom
//   landscape: scene on the left (full height), header + cloth panel on the right; hand = 'right' puts the scene on the right
export function playLayout(w, h, { hand = 'right', rail = false } = {}) {
  return memo(`play|${Math.round(w)}x${Math.round(h)}|${insKey()}|${hand}|${rail ? 1 : 0}`, () => buildPlay(frame(w, h), hand === 'right', rail));
}
function buildPlay(F, lefty, rail) {
  const { U, back } = F, w = F.w, h = F.h, m = clamp(U.w * 0.02, 12, 26), L = { F, w, h, U, m, back, lefty };
  const tu = tapU(), hdrH = Math.max(104, tu + 14), toolsH = Math.max(84, tu), gap = 12, pb = Math.max(66, tu);
  const land = F.land && U.w >= U.h * 1.05 && U.w >= 700;
  L.mode = land ? 'land' : 'portrait';
  let sceneR, colR;
  if (!land) {
    const sh = clamp(U.h * 0.33, 190, 560), cw = Math.min(U.w - 2 * m, 900), cx = U.x0 + (U.w - cw) / 2;
    const hb = U.x0 + (back.w ? back.w + 4 : 0);
    L.hdr = R(Math.max(U.x0 + m, hb), U.y0 + 6, cx + cw - Math.max(U.x0 + m, hb) - pb - 8, hdrH - 8);
    L.pause = R(cx + cw - pb, U.y0 + 10, pb, pb);
    sceneR = R(cx, U.y0 + hdrH, cw, sh);
    colR = R(cx, sceneR.y + sh + gap, cw, U.y1 - m - (sceneR.y + sh + gap));
  } else {
    const sw = clamp(U.w * 0.46, 360, 900), pw = U.w - sw - 3 * m, gx = U.x0 + m;
    const sx = lefty ? U.x1 - m - sw : gx, px = lefty ? gx : gx + sw + m;
    sceneR = R(sx, U.y0 + m, sw, U.h - 2 * m);
    const edgeLeft = px <= U.x0 + 60, top = back.w && edgeLeft ? Math.max(0, back.y + back.h - (U.y0 + m)) : 0;
    L.hdr = R(px, U.y0 + m + top, pw - pb - 8, hdrH - 18);
    L.pause = R(px + pw - pb, U.y0 + m + top + 2, pb, pb);
    colR = R(px, U.y0 + m + top + hdrH - 8, pw, U.y1 - m - (U.y0 + m + top + hdrH - 8));
  }
  L.scene = sceneR; L.col = colR;
  const pad = 14, tH = Math.min(toolsH, Math.max(colR.h * 0.2, tu));
  L.tools = R(colR.x + pad, colR.y + colR.h - tH - pad, colR.w - 2 * pad, tH);
  L.body = R(colR.x + pad, colR.y + pad, colR.w - 2 * pad, Math.max(40, colR.h - tH - 3 * pad));
  const tb = grid(L.tools, 2, 1, 12);
  L.btnHint = tb[0]; L.btnMain = tb[1];
  if (rail) {   // Watch and Learn controls replace the tool row: exit, pause, think -/+
    const wide = L.tools.w >= 560, rr = grid(L.tools, wide ? 4 : 2, wide ? 1 : 2, 10);
    L.rail = { exit: rr[0], pause: rr[1], dec: rr[2], inc: rr[3] };
    if (!wide) { const th = Math.max(Math.min(toolsH * 0.9, colR.h * 0.17), tu); L.tools = R(colR.x + pad, colR.y + colR.h - 2 * th - 10 - pad, colR.w - 2 * pad, 2 * th + 10); const r2 = grid(L.tools, 2, 2, 10); L.rail = { exit: r2[0], pause: r2[1], dec: r2[2], inc: r2[3] }; L.body = R(colR.x + pad, colR.y + pad, colR.w - 2 * pad, Math.max(40, L.tools.y - 2 * pad - colR.y)); }
  }
  return L;
}

// ---- title -----------------------------------------------------------------------------------------------------------------------
export function titleLayout(w, h, hasSave) {
  return memo(`title|${Math.round(w)}x${Math.round(h)}|${insKey()}|${hasSave ? 1 : 0}`, () => {
    const F = frame(w, h), { U } = F, m = 18;
    const T = { F, buttons: {} };
    const prim = (hasSave ? ['continue'] : []).concat(['tales']), sec = ['gallery', 'learn', 'howto', 'rules', 'settings', 'about'];
    let col;
    if (F.land && U.w > 760) {
      const cw = clamp(U.w * 0.42, 420, 640), cx = U.x1 - cw - m * 1.5;
      T.hero = R(U.x0 + m, U.y0 + m, cx - U.x0 - 2 * m, U.h - 2 * m - 54);
      col = R(cx, U.y0 + m, cw, U.h - 2 * m - 50);
      T.brand = { x: U.x0 + (cx - U.x0) / 2, y: U.y1 - 26 }; T.landscape = true;
    } else {
      const cw = Math.min(U.w - 2 * m, 640), top = U.y0 + 6;
      const tu = tapU(), need = prim.length * Math.max(100, tu + 14) + 16 + 3 * Math.max(74, tu + 10) + 10 + 80;
      const heroH = clamp(U.h - need - 70, 240, 760);
      T.hero = R(U.x0 + m, top + (F.ins.back ? 40 : 0), U.w - 2 * m, heroH - (F.ins.back ? 40 : 0));
      col = R(U.x0 + (U.w - cw) / 2, top + heroH, cw, U.h - heroH - 70);
      T.brand = { x: U.x0 + U.w / 2, y: U.y1 - 26 };
    }
    const tu2 = tapU(), pH = clamp((col.h - 16 - 3 * 12) / (prim.length + 3) * 1.18, Math.max(70, tu2), 132), sH = clamp(pH * 0.74, Math.max(54, tu2), 100);
    let y = col.y + Math.max(0, (col.h - (prim.length * (pH + 12) + 16 + 3 * (sH + 10))) / 2);
    prim.forEach((id) => { T.buttons[id] = R(col.x, y, col.w, pH); y += pH + 12; });
    y += 4;
    const g = grid(R(col.x, y, col.w, 3 * sH + 20), 2, 3, 10);
    sec.forEach((id, i) => { T.buttons[id] = g[i]; });
    return T;
  });
}

// ---- generic header + scrolling body used by the text/list screens -------------------------------------------------------------------
export function pageLayout(w, h, { footer = 0 } = {}) {
  return memo(`page|${Math.round(w)}x${Math.round(h)}|${insKey()}|${footer}`, () => {
    const F = frame(w, h), { U, back } = F, m = clamp(U.w * 0.025, 14, 36);
    const tu = tapU(), hdrTop = U.y0 + 8, hdrH = Math.max(70, tu + 8), maxW = Math.min(U.w - 2 * m, 1500);
    const x0 = U.x0 + (U.w - maxW) / 2;
    const P = { F, m, maxW, x0 };
    P.titleX = Math.max(x0, back.w ? U.x0 + back.w + 4 : x0);
    P.header = R(x0, hdrTop, maxW, hdrH);
    const tw = Math.max(74, tu), th = Math.max(62, tu);
    P.textDec = R(U.x1 - m - 2 * tw - 8, hdrTop + 4, tw, th); P.textInc = R(U.x1 - m - tw, hdrTop + 4, tw, th);
    const fh = footer ? Math.max(78, tu + 4) : 0;
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
    const cols = P.body.w >= 1250 ? 2 : 1, gap = 12, rowH = Math.round(Math.max(98, tapU() + 30) * (1 + (scale - 1) * 0.5)), cw = (P.body.w - gap * (cols - 1)) / cols;
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
export function talesLayout(w, h, nCards, scale = 1) {
  return memo(`tales|${Math.round(w)}x${Math.round(h)}|${insKey()}|${nCards}|${scale}`, () => {
    const P = { ...pageLayout(w, h, { footer: 1 }) };
    const f = P.footer; P.back = R(f.x + f.w / 2 - 160, f.y, 320, f.h);
    const cols = P.body.w >= 1500 ? 3 : P.body.w >= 780 ? 2 : 1, gap = 12, cw = (P.body.w - gap * (cols - 1)) / cols, rows = Math.ceil(nCards / cols);
    const ch = clamp((P.body.h - gap * (rows - 1)) / rows, (cols === 1 ? 150 : 170) * Math.min(scale, 1.6), 260 * Math.min(scale, 1.6));
    P.cards = []; P.cols = cols;
    for (let i = 0; i < nCards; i++) P.cards.push(R(P.body.x + (i % cols) * (cw + gap), P.body.y + Math.floor(i / cols) * (ch + gap), cw, ch));
    P.contentH = Math.ceil(nCards / cols) * (ch + gap);
    return P;
  });
}
export function galleryLayout(w, h, n) {
  return memo(`gal|${Math.round(w)}x${Math.round(h)}|${insKey()}|${n}`, () => {
    const P = { ...pageLayout(w, h, { footer: 1 }) };
    const f = P.footer; P.back = R(f.x + f.w / 2 - 160, f.y, 320, f.h);
    const gap = 14, cols = clamp(Math.floor((P.body.w + gap) / 280), 2, 5), cw = (P.body.w - gap * (cols - 1)) / cols, ch = cw * 1.12 + 56;
    P.cards = []; P.cols = cols;
    for (let i = 0; i < n; i++) P.cards.push(R(P.body.x + (i % cols) * (cw + gap), P.body.y + Math.floor(i / cols) * (ch + gap), cw, ch));
    P.contentH = Math.ceil(n / cols) * (ch + gap) + 140;
    return P;
  });
}

// ---- result ----------------------------------------------------------------------------------------------------------------------
export function overLayout(w, h, scale = 1) {
  return memo(`over|${Math.round(w)}x${Math.round(h)}|${insKey()}|${scale}`, () => {
    const F = frame(w, h), { U } = F, m = 18, O = { F };
    const wide = F.land && U.w > U.h * 1.05, bh = Math.max(wide ? 66 : 76, tapU());
    O.wide = wide;
    if (wide) {
      const bs = Math.min(U.h - 2 * m - 20, U.w * 0.42) * (scale > 2 ? 0.8 : 1);
      O.cloth = R(U.x0 + m + 6, U.y0 + (U.h - bs) / 2, bs, bs);
      const cx = O.cloth.x + bs + 36, cw = U.x1 - m - cx;
      O.btns = { next: R(cx, U.y1 - m - 3 * (bh + 12) - 24, cw, bh) };
      O.btns.share = R(cx, O.btns.next.y + bh + 12, cw / 2 - 6, bh); O.btns.menu = R(cx + cw / 2 + 6, O.btns.next.y + bh + 12, cw / 2 - 6, bh);
      O.more = { x: cx + cw / 2, y: U.y1 - m - 8 };
      O.body = R(cx, U.y0 + m, cw, O.btns.next.y - 14 - U.y0 - m);
    } else {
      const cw = Math.min(U.w - 2 * m, 700), cx = U.x0 + (U.w - cw) / 2;
      const bs = clamp(Math.min(cw * 0.86, U.h * 0.36) * (scale <= 1 ? 1 : scale <= 1.5 ? 0.8 : scale <= 2 ? 0.6 : 0.42), 100, 520);
      O.cloth = R(U.x0 + (U.w - bs) / 2, U.y0 + 14 + (F.ins.back ? 44 : 0), bs, bs);
      const by = U.y1 - m - 2 * (bh + 12) - 36;
      O.btns = { next: R(cx, by, cw, bh), share: R(cx, by + bh + 12, cw / 2 - 6, bh), menu: R(cx + cw / 2 + 6, by + bh + 12, cw / 2 - 6, bh) };
      O.body = R(cx, O.cloth.y + bs + 10, cw, by - 12 - (O.cloth.y + bs + 10));
      O.more = { x: U.x0 + U.w / 2, y: U.y1 - 8 };
    }
    return O;
  });
}

// ---- small overlays ----------------------------------------------------------------------------------------------------------------------
export function pauseLayout(col) {
  const cw = Math.min(Math.max(col.w - 40, 260), 520), n = 4, bh = Math.max(tapU(), 44, Math.min(74, (col.h - 24 - 80) / n - 12)), ch = n * (bh + 12) + 80;
  const card = R(col.x + (col.w - cw) / 2, col.y + Math.max(8, (col.h - ch) / 2), cw, ch);
  return { card, resume: R(card.x + 16, card.y + 70, cw - 32, bh), restart: R(card.x + 16, card.y + 70 + bh + 12, cw - 32, bh), settings: R(card.x + 16, card.y + 70 + 2 * (bh + 12), cw - 32, bh), menu: R(card.x + 16, card.y + 70 + 3 * (bh + 12), cw - 32, bh) };
}
export function centerCard(w, h, cw, ch) { const F = frame(w, h), { U } = F; return R(U.x0 + (U.w - Math.min(cw, U.w - 32)) / 2, U.y0 + (U.h - Math.min(ch, U.h - 32)) / 2, Math.min(cw, U.w - 32), Math.min(ch, U.h - 32)); }
export { R, clamp, grid };

// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the short side is 720 units).
// Render and hit-testing read the same rects, so what is drawn is what is tapped.
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.55 };   // safe areas + host back button (main.js keeps it current)

export const R = (x, y, w, h) => ({ x, y, w, h });
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const grid = (r, cols, rows, gx, gy = gx) => {
  const w = (r.w - gx * (cols - 1)) / cols, h = (r.h - gy * (rows - 1)) / rows, out = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) out.push(R(r.x + i * (w + gx), r.y + j * (h + gy), w, h));
  return out;
};
const cache = new Map();
function memo(key, f) {
  let v = cache.get(key);
  if (!v) { v = f(); cache.set(key, v); if (cache.size > 160) cache.delete(cache.keys().next().value); }
  return v;
}
const insKey = () => `${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
export function frame(w, h) {
  w = Math.round(w); h = Math.round(h);
  const ins = { ...host }, U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const bs = Math.max(ins.back, 56) + 10, back = ins.back ? R(ins.l, ins.t, bs, bs) : R(0, 0, 0, 0);
  return { w, h, ins, U, back, land: w >= h };
}

// ---- play: header, board, brief card, paint pots, tools -------------------------------------------------------------------------------
// o: { nPots, tools, coach, hand }
export const PANEL_STRETCH = 1.4;   // portrait wide panels are drawn this much taller than wide (3D camera stretch, up to this) so they fill the play band
export function playLayout(w, h, o = {}) {
  const key = `play|${Math.round(w)}x${Math.round(h)}|${insKey()}|${o.nPots}|${o.tools}|${o.coach ? 1 : 0}|${o.hand}|${o.asp ? o.asp.toFixed(3) : 1}`;
  return memo(key, () => buildPlay(frame(w, h), o));
}
function buildPlay(F, o) {
  const { U, back } = F, m = clamp(U.w * 0.022, 12, 26), g = 10, n = Math.max(1, o.nPots || 4), nT = o.nTools || 4, L = { F, U, m, back };
  const hudH = 78, toolsH = 76;
  const side = F.land || U.h < U.w * 1.12;
  L.mode = side ? 'side' : 'stacked';
  const hb = U.x0 + (back.w ? back.w + 4 : 0);
  if (!side) {
    const hudTop = U.y0 + 6, potH = clamp(((U.w - 2 * m) / n) * 1.3, 96, 156), toolsY = U.y1 - toolsH - 8, potsY = toolsY - g - potH;
    L.hud = R(Math.max(U.x0 + m, hb), hudTop, U.w - 2 * m - 80 - Math.max(0, hb - U.x0 - m), hudH);
    L.pause = R(U.x1 - m - 66, hudTop + 6, 66, 66);
    const top = hudTop + hudH + g, avail = potsY - g - top;
    const briefH = clamp(avail * (o.coach ? 0.42 : 0.27), o.coach ? 210 : 112, o.coach ? 340 : 250);
    // The board uses nearly the full width (slim side margin); a wide, short panel gives its spare height to the brief card instead of empty wood.
    const mb = m * 0.35, bw = U.w - 2 * mb, asp = o.asp || 1, boardNeed = bw / asp * (asp === 1 ? 1.06 : PANEL_STRETCH) + 14;
    const boardH0 = Math.max(120, avail - briefH - g), boardH = Math.min(boardH0, boardNeed), spare = Math.max(0, boardH0 - boardH);
    const rem = Math.max(0, spare), padTop = rem * 0.4, briefH2 = briefH + rem * 0.6;
    L.board = R(U.x0 + mb, top + padTop, bw, boardH);
    L.brief = R(U.x0 + m, L.board.y + L.board.h + g, U.w - 2 * m, briefH2 - 0);
    L.potsR = R(U.x0 + m, potsY, U.w - 2 * m, potH);
    L.tools = R(U.x0 + m, toolsY, U.w - 2 * m, toolsH);
    L.potRects = grid(L.potsR, n, 1, 8);
  } else {
    const pw = clamp(U.w * 0.4, 320, 560), lefty = o.hand === 'left', gx = 2 * m;
    const px = lefty ? U.x0 + m : U.x1 - m - pw, bx = lefty ? px + pw + gx : U.x0 + m, bw = U.w - 2 * m - pw - gx;
    const top = U.y0 + m * 0.6, pTop = back.w && px <= U.x0 + 60 ? Math.max(top, back.y + back.h - 2) : top;
    L.board = R(bx, U.y0 + m, bw, U.h - 2 * m);
    L.hud = R(px, pTop, pw - 76, hudH - 12); L.pause = R(px + pw - 66, pTop + 2, 66, 66);
    const toolsY = U.y1 - m * 0.6 - toolsH, cols = n <= 3 ? n : n <= 4 ? 4 : 3, rows = Math.ceil(n / cols);
    const potH = clamp(((pw - 8 * (cols - 1)) / cols) * 1.2, 88, 140), potsH = rows * potH + (rows - 1) * 8, potsY = toolsY - g - potsH;
    const briefY = pTop + hudH, briefH = potsY - g - briefY;
    L.brief = R(px, briefY, pw, Math.max(110, briefH));
    L.potsR = R(px, potsY, pw, potsH); L.tools = R(px, toolsY, pw, toolsH);
    L.potRects = grid(L.potsR, cols, rows, 8).slice(0, n);
  }
  L.toolRects = grid(L.tools, nT, 1, 8);
  // hint / Watch and Learn card takes the brief area
  const C = L.brief, bh = 58, ip = 12;
  L.coachR = C;
  L.coachBtns = { close: R(C.x + ip, C.y + C.h - bh - ip, C.w / 2 - ip - 6, bh), go: R(C.x + C.w / 2 + 6, C.y + C.h - bh - ip, C.w / 2 - ip - 6, bh) };
  const wide = C.w >= 560, rh = wide ? bh : bh * 2 + 8, rail = grid(R(C.x + ip, C.y + C.h - rh - ip, C.w - 2 * ip, rh), wide ? 4 : 2, wide ? 1 : 2, 8);
  L.rail = { exit: rail[0], pause: rail[1], dec: rail[2], inc: rail[3] };
  L.coachText = R(C.x, C.y, C.w, C.h - Math.max(bh, rh) - 8 - ip);
  return L;
}

// ---- title -----------------------------------------------------------------------------------------------------------------------
export function titleLayout(w, h, hasSave) {
  return memo(`title|${Math.round(w)}x${Math.round(h)}|${insKey()}|${hasSave ? 1 : 0}`, () => {
    const F = frame(w, h), { U } = F, m = 18, T = { F, buttons: {} };
    const prim = (hasSave ? ['continue'] : []).concat(['play', 'daily']), sec = ['free', 'gallery', 'learn', 'stats', 'howto', 'rules', 'settings', 'about'];
    let col;
    if (F.land && U.w > 760) {
      const cw = clamp(U.w * 0.42, 420, 640), cx = U.x1 - cw - m * 1.5;
      T.hero = R(U.x0 + m, U.y0 + m, cx - U.x0 - 2 * m, U.h - 2 * m - 70);
      col = R(cx, U.y0 + m, cw, U.h - 2 * m - 60);
      T.brand = { x: U.x0 + (cx - U.x0) / 2, y: U.y1 - 26 };
    } else {
      const cw = Math.min(U.w - 2 * m, 640), top = U.y0 + 6, need = prim.length * 92 + 16 + 4 * 66 + 10 + 80;
      const heroH = clamp(U.h - need - 70, 200, 640);
      T.hero = R(U.x0 + m, top + (F.ins.back ? 40 : 0), U.w - 2 * m, heroH - (F.ins.back ? 40 : 0));
      col = R(U.x0 + (U.w - cw) / 2, top + heroH, cw, U.h - heroH - 70);
      T.brand = { x: U.x0 + U.w / 2, y: U.y1 - 26 };
    }
    const pH = clamp((col.h - 16 - 3 * 12) / (prim.length + 4) * 1.15, 60, 124), sH = clamp(pH * 0.72, 46, 92);
    let y = col.y + Math.max(0, (col.h - (prim.length * (pH + 12) + 16 + 4 * (sH + 10))) / 2);
    prim.forEach((id) => { T.buttons[id] = R(col.x, y, col.w, pH); y += pH + 12; });
    y += 4;
    const gr = grid(R(col.x, y, col.w, 4 * sH + 30), 2, 4, 10);
    sec.forEach((id, i) => { T.buttons[id] = gr[i]; });
    return T;
  });
}

// ---- header + scrolling body for text and list screens ---------------------------------------------------------------------------------
export function pageLayout(w, h, { footer = 0 } = {}) {
  return memo(`page|${Math.round(w)}x${Math.round(h)}|${insKey()}|${footer}`, () => {
    const F = frame(w, h), { U, back } = F, m = clamp(U.w * 0.025, 14, 36), hdrTop = U.y0 + 8, hdrH = 70, maxW = Math.min(U.w - 2 * m, 1500), x0 = U.x0 + (U.w - maxW) / 2;
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
    const P = { ...pageLayout(w, h, { footer: 1 }) }, f = P.footer, bw = Math.min(190, f.w * 0.22), cw = Math.min(150, f.w * 0.16);
    P.menu = R(f.x, f.y, bw, f.h); P.prev = R(f.x + f.w - 2 * bw - 14 - cw, f.y, bw, f.h);
    P.count = R(P.prev.x + bw + 7, f.y, cw, f.h); P.next = R(f.x + f.w - bw, f.y, bw, f.h);
    P.split = P.F.land && P.F.U.w >= 880;
    if (P.split) { const lw = clamp(P.body.w * 0.42, 380, 720); P.fig = R(P.body.x, P.body.y, lw, P.body.h); P.text = R(P.body.x + lw + 20, P.body.y, P.body.w - lw - 20, P.body.h); }
    else { P.fig = null; P.text = P.body; }
    return P;
  });
}
export function backFooter(w, h) {
  return memo(`bf|${Math.round(w)}x${Math.round(h)}|${insKey()}`, () => { const P = { ...pageLayout(w, h, { footer: 1 }) }; const f = P.footer; P.back = R(f.x + f.w / 2 - 160, f.y, 320, f.h); return P; });
}
export function settingsLayout(w, h, scale, nRows) {
  return memo(`set|${Math.round(w)}x${Math.round(h)}|${insKey()}|${scale}|${nRows}`, () => {
    const P = { ...backFooter(w, h) }, cols = P.body.w >= 1250 ? 2 : 1, gap = 12, rowH = Math.round(98 * (1 + (scale - 1) * 0.5)), cw = (P.body.w - gap * (cols - 1)) / cols;
    P.rows = []; P.cols = cols;
    for (let i = 0; i < nRows; i++) {
      const c = i % cols, r = Math.floor(i / cols), rect = R(P.body.x + c * (cw + gap), P.body.y + r * (rowH + gap), cw, rowH);
      const frac = cw < 800 ? 0.6 : 0.5, ctrlW = Math.min(cw * (scale > 1.6 ? Math.max(frac, 0.66) : frac), 560), ctrl = R(rect.x + rect.w - 14 - ctrlW, rect.y + 14, ctrlW, rect.h - 28);
      P.rows.push({ rect, ctrl });
    }
    P.contentH = Math.ceil(nRows / cols) * (rowH + gap);
    return P;
  });
}
// commission list: group headings and cards, scrolling
export function pickLayout(w, h, items, scale = 1) {
  return memo(`pick|${Math.round(w)}x${Math.round(h)}|${insKey()}|${items.map((i) => i.t).join('')}|${scale}`, () => {
    const P = { ...backFooter(w, h) }, cols = P.body.w >= 1500 ? 3 : P.body.w >= 760 ? 2 : 1, gap = 12, cw = (P.body.w - gap * (cols - 1)) / cols;
    const ch = clamp(118 * (1 + (scale - 1) * 0.45), 110, 250), hh = 72 * (1 + (scale - 1) * 0.3);
    P.rects = []; let y = 0, col = 0;
    for (const it of items) {
      if (it.t === 'h') { if (col) { y += ch + gap; col = 0; } P.rects.push(R(P.body.x, P.body.y + y, P.body.w, hh)); y += hh + 4; }
      else { P.rects.push(R(P.body.x + col * (cw + gap), P.body.y + y, cw, ch)); col += 1; if (col >= cols) { col = 0; y += ch + gap; } }
    }
    if (col) y += ch + gap;
    P.contentH = y;
    return P;
  });
}
export function galleryLayout(w, h, n) {
  return memo(`gal|${Math.round(w)}x${Math.round(h)}|${insKey()}|${n}`, () => {
    const P = { ...backFooter(w, h) }, cols = clamp(Math.floor((P.body.w + 14) / 250), 2, 5), gap = 14, cw = (P.body.w - gap * (cols - 1)) / cols, ch = cw + 54;
    P.cards = []; for (let i = 0; i < n; i++) P.cards.push(R(P.body.x + (i % cols) * (cw + gap), P.body.y + Math.floor(i / cols) * (ch + gap), cw, ch));
    P.contentH = Math.ceil(n / cols) * (ch + gap);
    return P;
  });
}
// free painting: pick a shape
export function shapeLayout(w, h, n, scale = 1) {
  return memo(`shape|${Math.round(w)}x${Math.round(h)}|${insKey()}|${n}|${scale}`, () => {
    const P = { ...backFooter(w, h) }, cols = P.body.w >= 900 ? 3 : 2, gap = 14, cw = (P.body.w - gap * (cols - 1)) / cols, ch = clamp(cw * 0.95 + 20 * scale, 180, 420);
    P.cards = []; for (let i = 0; i < n; i++) P.cards.push(R(P.body.x + (i % cols) * (cw + gap), P.body.y + Math.floor(i / cols) * (ch + gap), cw, ch));
    P.contentH = Math.ceil(n / cols) * (ch + gap);
    return P;
  });
}
// result screen: the rolling cart on top, text and buttons below (or beside)
export function showLayout(w, h, nBtn = 3) {
  return memo(`show|${Math.round(w)}x${Math.round(h)}|${insKey()}|${nBtn}`, () => {
    const F = frame(w, h), { U } = F, m = 18, O = { F }, bh = 66;
    if (F.land && U.w > U.h * 1.25) {
      const sw = Math.min(U.w * 0.58, 1100), px = U.x0 + m;
      const ph = Math.min(U.h - 2 * m, sw * 0.9);
      O.pic = R(px, U.y0 + (U.h - ph) / 2, sw, ph);
      const cx = px + sw + 24, cw = U.x1 - m - cx;
      O.btns = Array.from({ length: nBtn }, (_, i) => R(cx, U.y1 - m - (nBtn - i) * (bh + 12) + 12, cw, bh));
      O.body = R(cx, U.y0 + m + (F.ins.back ? 20 : 0), cw, O.btns[0].y - 12 - U.y0 - m);
    } else {
      const cw = Math.min(U.w - 2 * m, 680), cx = U.x0 + (U.w - cw) / 2, by = U.y1 - m - nBtn * (bh + 12) + 12;
      const ph = clamp(by - 12 - (U.y0 + 8) - 160, 200, Math.min(U.h * 0.58, (U.w - 2 * m) * 1.05));
      O.pic = R(U.x0 + m, U.y0 + 8, U.w - 2 * m, ph);
      O.btns = Array.from({ length: nBtn }, (_, i) => R(cx, by + i * (bh + 12), cw, bh));
      O.body = R(cx, O.pic.y + ph + 10, cw, by - 12 - (O.pic.y + ph + 10));
    }
    return O;
  });
}
export function pauseLayout(w, h, area) {
  const cw = Math.min(area.w - 30, 520), n = 4, bh = Math.max(46, Math.min(70, (area.h - 24 - 80) / n - 12)), ch = n * (bh + 12) + 80;
  const card = R(area.x + (area.w - cw) / 2, area.y + (area.h - ch) / 2, cw, ch);
  return { card, resume: R(card.x + 16, card.y + 70, cw - 32, bh), restart: R(card.x + 16, card.y + 70 + bh + 12, cw - 32, bh), settings: R(card.x + 16, card.y + 70 + 2 * (bh + 12), cw - 32, bh), menu: R(card.x + 16, card.y + 70 + 3 * (bh + 12), cw - 32, bh) };
}
export function centerCard(w, h, cw, ch) { const F = frame(w, h), { U } = F; return R(U.x0 + (U.w - Math.min(cw, U.w - 32)) / 2, U.y0 + (U.h - Math.min(ch, U.h - 32)) / 2, Math.min(cw, U.w - 32), Math.min(ch, U.h - 32)); }

export const toolsFor = (ch) => (ch.mode === 'free' ? ['undo', 'redo', 'erase', 'clear', 'save'] : ['undo', 'redo', 'erase', 'hint']);
export const playOpts = (s) => ({ nPots: s.ch.colors.length, tools: toolsFor(s.ch).join(), nTools: toolsFor(s.ch).length, coach: !!(s.hint || s.auto.on), hand: s.prefs.hand, asp: s.ch.piece.kind === 'wheel' ? 1 : (s.ch.piece.geom.cols + 0.68) / (s.ch.piece.geom.rows + 0.68) });

// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// Render and hit-testing both read the same rects, so what is drawn is what is tapped.
//   play  portrait : header, code board (rows), then the controls (two rows of digit pegs + tools)
//         wide     : board | side panel (info + controls)
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
  if (!v) { v = f(); cache.set(key, v); if (cache.size > 160) cache.delete(cache.keys().next().value); }
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

// ---- the code board ---------------------------------------------------------------------------------------------------------------
// rect: the board area. tries: number of rows. len: digits per code. cur: index of the row being played (for the sliding window).
export function boardGeo(rect, tries, len, cur) {
  const pad = 14, topH = 0.0, minRow = 52, maxRow = 112;
  const avail = rect.h - 2 * pad;
  let rowH = Math.min(maxRow, avail / (tries + 1.15)), first = 0, count = tries;
  if (rowH < minRow) {
    rowH = minRow;
    count = Math.max(2, Math.floor(avail / rowH - 1.15));
    first = clamp(cur - count + 2, 0, Math.max(0, tries - count));
  }
  const secretH = rowH * 1.15, rowW = Math.min(rect.w - 2 * pad, 880), x0 = rect.x + (rect.w - rowW) / 2;
  const usedH = secretH + count * rowH, y0 = rect.y + pad + Math.max(0, (avail - usedH) / 2);
  const idxW = clamp(rowW * 0.085, 48, 60), fbW = clamp(rowW * 0.3, 128, 270);
  const area = rowW - idxW - fbW - 20, d = Math.min(rowH * 0.8, (area / len) * 0.88), gap = len > 1 ? (area - d * len) / (len - 1) : 0, gapC = Math.min(gap, d * 0.5);
  const pegsW = d * len + gapC * (len - 1), px0 = x0 + idxW + 8 + (area - pegsW) / 2;
  const slot = (k) => px0 + k * (d + gapC) + d / 2;
  const rowY = (i) => y0 + secretH + (i - first) * rowH;
  return {
    rect, rowH, d, first, count, tries, len, rowW, x0, idxW, fbW, secretH, secretY: y0, slot,
    rowY, rowRect: (i) => R(x0, rowY(i), rowW, rowH), visible: (i) => i >= first && i < first + count,
    fb: (i) => R(x0 + rowW - fbW, rowY(i), fbW, rowH), secretFb: R(x0 + rowW - fbW, y0, fbW, secretH),
    slotAt: (i, px, py) => { if (i < first || i >= first + count) return -1; const cy = rowY(i) + rowH / 2; if (Math.abs(py - cy) > rowH * 0.6) return -1; for (let k = 0; k < len; k++) if (Math.abs(px - slot(k)) <= (d + gapC) / 2) return k; return -1; },
    secretMid: y0 + secretH / 2,
    secretSlotAt: (px, py) => { if (Math.abs(py - (y0 + secretH / 2)) > secretH * 0.6) return -1; for (let k = 0; k < len; k++) if (Math.abs(px - slot(k)) <= (d + gapC) / 2) return k; return -1; },
  };
}

// ---- play --------------------------------------------------------------------------------------------------------------------------
// o: { tries, len, cur, mode: 'break'|'secret'|'score'|'wait'|'coach'|'auto', hand }
export function playLayout(w, h, o) {
  return memo(`play|${Math.round(w)}x${Math.round(h)}|${insKey()}|${o.tries}|${o.len}|${o.cur}|${o.mode}|${o.hand}|${o.scale || 1}`, () => buildPlay(frame(w, h), o));
}
const TOOLS = ['del', 'marks', 'hint', 'guess'];
function buildPlay(F, o) {
  const { U, back } = F, m = clamp(U.w * 0.022, 12, 24), gap = 10, mode = o.mode;
  const L = { F, U, m, back, mode };
  const ctlH = (cw) => {
    const keyH = clamp(cw / 5.6, 62, 100), extra = cw < 470 ? 84 : 0;
    if (mode === 'secret' || mode === 'wait' || mode === 'break') return 2 * keyH + 74 + 3 * gap + 12 + extra;
    if (mode === 'score') return 3 * 74 + 3 * gap + 20;
    if (mode === 'coach' || mode === 'auto') return 290;
    if (mode === 'secret') return 2 * keyH + 74 + 3 * gap + 12;
    if (mode === 'wait') return 2 * keyH + 74 + 3 * gap + 12;
    return 2 * keyH + 74 + 3 * gap + 12;
  };
  // portrait candidate
  const hudH = 78, hudTop = U.y0 + 6;
  const cwP = Math.min(U.w - 2 * m, 700), ctlP = ctlH(cwP);
  const boardP = R(U.x0 + m, hudTop + hudH + 2, U.w - 2 * m, Math.max(120, U.y1 - ctlP - 14 - (hudTop + hudH + 2)));
  // wide candidate
  const Rw = clamp(U.w * 0.33, 380, 560), boardW = R(U.x0 + m, U.y0 + m, U.w - Rw - 3 * m, U.h - 2 * m);
  const eff = (r) => { const g = boardGeo(r, o.tries, o.len, o.cur); return Math.min(g.d, g.rowH * 0.8) * (g.count >= o.tries ? 1.08 : 0.9); };
  const wide = F.land && U.w > 760 && eff(boardW) > eff(boardP) * 0.98;
  L.wide = wide;
  const B = wide ? boardW : boardP;
  L.board = boardGeo(B, o.tries, o.len, o.cur);
  let C;
  if (wide) {
    const px = U.x0 + U.w - m - Rw; L.side = R(px, U.y0 + m, Rw, U.h - 2 * m);
    if (o.hand === 'left') { L.side = R(U.x0 + m, U.y0 + m, Rw, U.h - 2 * m); L.board = boardGeo(R(U.x0 + Rw + 2 * m, U.y0 + m, U.w - Rw - 3 * m, U.h - 2 * m), o.tries, o.len, o.cur); }
    const ch = Math.min(L.side.h - 120, ctlH(Rw - 28) + 4);
    C = R(L.side.x + 14, L.side.y + L.side.h - ch - 14, Rw - 28, ch);
    L.info = R(L.side.x, L.side.y, Rw, L.side.h - ch - 14);
    const bt = back.w && L.side.x <= U.x0 + 40 ? back.y + back.h - L.side.y : 0;
    L.hud = { title: { x: L.side.x + 18 + (bt ? 0 : 0), y: L.side.y + 24 + bt }, pause: R(L.side.x + Rw - 18 - 62, L.side.y + 16 + bt, 62, 62) };
    L.infoTop = L.side.y + 134 + bt;
  } else {
    C = R(U.x0 + (U.w - cwP) / 2, U.y1 - ctlP - 8, cwP, ctlP);
    const hb = back.w ? U.x0 + back.w + 2 : U.x0 + m;
    L.hud = { title: { x: Math.max(U.x0 + m, hb), y: hudTop + 30 }, pause: R(U.x1 - m - 62, hudTop + 8, 62, 62), tries: { x: U.x1 - m - 62 - 16, y: hudTop + 30 } };
    L.infoTop = hudTop;
  }
  L.ctl = C;
  const keyCols = 5, keyW = (C.w - gap * 4) / keyCols, keyH = clamp(keyW * 1.02, 56, 100);
  L.keys = []; L.tools = {};
  if (mode === 'break' || mode === 'secret' || mode === 'wait') {
    const g = grid(R(C.x, C.y, C.w, keyH * 2 + gap), keyCols, 2, gap);
    L.keys = g;
    const narrow = C.w < 470, th = 74, ty = C.y + keyH * 2 + 2 * gap;
    if (narrow) {
      const tw = (C.w - 2 * gap) / 3;
      L.tools = { del: R(C.x, ty, tw * 0.7, th), marks: R(C.x + tw * 0.7 + gap, ty, tw * 1.15, th), hint: R(C.x + tw * 1.85 + 2 * gap, ty, C.w - tw * 1.85 - 2 * gap, th), guess: R(C.x, ty + th + gap, C.w, th) };
    } else {
      const tw = (C.w - 3 * gap) / 4;
      const tr = [R(C.x, ty, tw * 0.9, th), R(C.x + tw * 0.9 + gap, ty, tw * 0.9, th), R(C.x + 2 * (tw * 0.9 + gap), ty, tw * 0.9, th)];
      const gw = C.w - 3 * (tw * 0.9 + gap);
      L.tools = { del: tr[0], marks: tr[1], hint: tr[2], guess: R(C.x + C.w - gw, ty, gw, th) };
    }
  }
  const bh = 66, ip = 12;
  if (mode === 'score') {
    const rowH = 74, bw = clamp(C.w * 0.17, 56, 76), vw = clamp(C.w * 0.2, 60, 100), lw = C.w - 2 * bw - vw - 2 * gap;
    const mk = (y) => ({ y, label: R(C.x, y, lw, rowH), dec: R(C.x + lw + gap, y, bw, rowH), val: R(C.x + lw + gap + bw, y, vw, rowH), inc: R(C.x + C.w - bw, y, bw, rowH) });
    L.score = { bulls: mk(C.y), cows: mk(C.y + rowH + gap), go: R(C.x + C.w * 0.34 + gap / 2, C.y + 2 * (rowH + gap), C.w * 0.66 - gap / 2, rowH), show: R(C.x, C.y + 2 * (rowH + gap), C.w * 0.34 - gap / 2, rowH) };
  }
  L.coachBtns = { close: R(C.x + ip, C.y + C.h - bh - ip, C.w / 2 - ip - 6, bh), go: R(C.x + C.w / 2 + 6, C.y + C.h - bh - ip, C.w / 2 - ip - 6, bh) };
  const wideRail = C.w >= 560, rh = wideRail ? bh : bh * 2 + 10;
  const rail = grid(R(C.x + ip, C.y + C.h - rh - ip, C.w - 2 * ip, rh), wideRail ? 4 : 2, wideRail ? 1 : 2, 10);
  L.rail = { exit: rail[0], pause: rail[1], dec: rail[2], inc: rail[3] };
  L.coachText = R(C.x + 4, C.y, C.w - 8, C.h - Math.max(bh, rh) - 12 - ip);
  return L;
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------
export function titleLayout(w, h, hasSave) {
  return memo(`title|${Math.round(w)}x${Math.round(h)}|${insKey()}|${hasSave ? 1 : 0}`, () => {
    const F = frame(w, h), { U } = F, m = 18, T = { F, buttons: {} };
    const prim = (hasSave ? ['continue'] : []).concat(['break', 'set', 'daily']), sec = ['learn', 'howto', 'rules', 'stats', 'settings', 'about'];
    let col;
    if (F.land && U.w > 760) {
      const cw = clamp(U.w * 0.42, 420, 640), cx = U.x1 - cw - m * 1.5;
      T.hero = R(U.x0 + m, U.y0 + m, cx - U.x0 - 2 * m, U.h - 2 * m - 70);
      col = R(cx, U.y0 + m, cw, U.h - 2 * m - 54);
      T.brand = { x: U.x0 + (cx - U.x0) / 2, y: U.y1 - 26 }; T.landscape = true;
    } else {
      const cw = Math.min(U.w - 2 * m, 640), top = U.y0 + 6;
      const need = prim.length * 92 + 16 + 3 * 72 + 10 + 80;
      const heroH = clamp(U.h - need - 70, 190, 600);
      T.hero = R(U.x0 + m, top + (F.ins.back ? 40 : 0), U.w - 2 * m, heroH - (F.ins.back ? 40 : 0));
      col = R(U.x0 + (U.w - cw) / 2, top + heroH, cw, U.h - heroH - 70);
      T.brand = { x: U.x0 + U.w / 2, y: U.y1 - 26 };
    }
    const units = prim.length + 3 * 0.74, gaps = prim.length * 12 + 20 + 3 * 10;
    const pH = clamp((col.h - gaps) / units, 50, 118), sH = clamp(pH * 0.74, 40, 90);
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
    const hdrTop = U.y0 + 8, hdrH = 70, maxW = Math.min(U.w - 2 * m, 1500), x0 = U.x0 + (U.w - maxW) / 2;
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
    if (P.split) { const lw = clamp(P.body.w * 0.42, 380, 760); P.fig = R(P.body.x, P.body.y, lw, P.body.h); P.text = R(P.body.x + lw + 20, P.body.y, P.body.w - lw - 20, P.body.h); }
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
    const cols = P.body.w >= 1500 ? 3 : P.body.w >= 780 ? 2 : 1, gap = 12, cw = (P.body.w - gap * (cols - 1)) / cols, rows = Math.ceil(nCards / cols), ch = clamp((P.body.h - gap * (rows - 1)) / rows, cols === 1 ? 118 : 130, 190);
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

// ---- result ----------------------------------------------------------------------------------------------------------------------------
export function overLayout(w, h, scale = 1) {
  return memo(`over|${Math.round(w)}x${Math.round(h)}|${insKey()}|${scale}`, () => {
    const F = frame(w, h), { U } = F, m = 18, O = { F };
    const wide = F.land && U.w > U.h * 1.15, bh = wide ? 66 : 76;
    O.wide = wide;
    if (wide) {
      const lw = clamp(U.w * 0.44, 380, 760);
      O.codeR = R(U.x0 + m, U.y0 + m, lw, U.h - 2 * m);
      const cx = O.codeR.x + lw + 24, cw = U.x1 - m - cx, by = U.y1 - m - 2 * (bh + 12) - 24;
      O.btns = { next: R(cx, by, cw, bh), share: R(cx, by + bh + 12, cw / 2 - 6, bh), menu: R(cx + cw / 2 + 6, by + bh + 12, cw / 2 - 6, bh) };
      O.body = R(cx, U.y0 + m, cw, by - 14 - U.y0 - m);
      O.more = { x: cx + cw / 2, y: U.y1 - m + 4 };
    } else {
      const cw = Math.min(U.w - 2 * m, 700), cx = U.x0 + (U.w - cw) / 2;
      const ch = clamp(U.h * 0.2 * (scale <= 1 ? 1 : scale <= 1.5 ? 0.8 : scale <= 2 ? 0.6 : 0.45), 80, 260);
      O.codeR = R(cx, U.y0 + 14 + (F.ins.back ? 44 : 0), cw, ch);
      const by = U.y1 - m - 2 * (bh + 12) - 30;
      O.btns = { next: R(cx, by, cw, bh), share: R(cx, by + bh + 12, cw / 2 - 6, bh), menu: R(cx + cw / 2 + 6, by + bh + 12, cw / 2 - 6, bh) };
      O.body = R(cx, O.codeR.y + ch + 10, cw, by - 12 - (O.codeR.y + ch + 10));
      O.more = { x: U.x0 + U.w / 2, y: U.y1 - 8 };
    }
    return O;
  });
}

// ---- small overlays -------------------------------------------------------------------------------------------------------------------
export function pauseLayout(w, h, board) {
  const b = board.rect, cw = Math.min(b.w - 30, 520), n = 4, bh = Math.max(46, Math.min(78, (b.h - 24 - 80) / n - 12)), ch = n * (bh + 12) + 80;
  const card = R(b.x + (b.w - cw) / 2, b.y + Math.max(0, (b.h - ch) / 2), cw, ch);
  return { card, resume: R(card.x + 16, card.y + 70, cw - 32, bh), restart: R(card.x + 16, card.y + 70 + bh + 12, cw - 32, bh), settings: R(card.x + 16, card.y + 70 + 2 * (bh + 12), cw - 32, bh), menu: R(card.x + 16, card.y + 70 + 3 * (bh + 12), cw - 32, bh) };
}
export function centerCard(w, h, cw, ch) { const F = frame(w, h), { U } = F; return R(U.x0 + (U.w - Math.min(cw, U.w - 32)) / 2, U.y0 + (U.h - Math.min(ch, U.h - 32)) / 2, Math.min(cw, U.w - 32), Math.min(ch, U.h - 32)); }
export { R, clamp, grid };

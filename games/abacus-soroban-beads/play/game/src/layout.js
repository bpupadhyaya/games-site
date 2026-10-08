// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// Render and hit-testing both read the same rects, so what is drawn is what is tapped.
//   play, portrait  : header, task card, abacus (as big as it fits), coach card, three buttons
//   play, landscape : left panel (header, task, coach, buttons) | abacus filling the rest
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

// ---- the abacus -----------------------------------------------------------------------------------------------------------
// A soroban of `rods` rods inside `rect`. Rod index r = 0 is the ones rod (rightmost). All sizes derive from `slot`, one bead's height.
export function abacusGeo(rect, rods, labels = true) {
  const label = labels ? 0.95 : 0.1;
  const slot = clamp(Math.min(rect.w / (rods * 1.56 + 1.1), rect.h / (8.65 + label)), 14, 104);
  const fr = slot * 0.55, sp = Math.max(slot * 1.56, Math.min(slot * 2.05, (rect.w - 2 * fr) / rods)), W = rods * sp + 2 * fr, H = slot * 8.65;
  const x = rect.x + (rect.w - W) / 2, y = rect.y + (rect.h - H - slot * label) / 2;
  const top = y + fr, beamTop = top + 2 * slot, beamH = slot * 0.55, beamBot = beamTop + beamH;
  const g = { x, y, w: W, h: H, slot, sp, fr, bw: slot * 1.5, bh: slot * 1.0, top, beamTop, beamH, beamBot, bottom: beamBot + 5 * slot, labelY: y + H + slot * 0.5, rods, rect };
  g.rodX = (r) => x + fr + sp * (rods - 1 - r + 0.5);
  g.heavenY = (pos) => top + slot * (0.5 + pos);              // pos 0 = away (up), 1 = at the beam
  g.earthY = (i, pos) => beamBot + slot * (0.5 + i + 1 - pos);  // pos 0 = away (down), 1 = at the beam
  g.colAt = (px) => { const c = Math.floor((px - x - fr) / sp); return c >= 0 && c < rods ? rods - 1 - c : -1; };
  return g;
}

// ---- play -----------------------------------------------------------------------------------------------------------------
export function playLayout(w, h, { rods = 5, choices = 0 } = {}) {
  return memo(`play|${Math.round(w)}x${Math.round(h)}|${insKey()}|${rods}|${choices}`, () => buildPlay(frame(w, h), rods, choices));
}
function buildPlay(F, rods, choices) {
  const { U, back } = F, m = clamp(U.w * 0.022, 12, 26), L = { F, rods, m, back };
  const panel = F.land && U.w >= U.h * 1.12;
  L.panel = panel;
  const hb = back.w ? back.w + 4 : 0;
  if (!panel) {
    const x = U.x0 + m, W = Math.min(U.w - 2 * m, 1100), cx = U.x0 + (U.w - W) / 2, hudTop = U.y0 + 6;
    L.hud = R(cx, hudTop, W, 90);
    L.menu = R(Math.max(cx, U.x0 + hb), hudTop + 2, 140, 86); L.pause = R(cx + W - 88, hudTop + 2, 88, 86);
    L.title = { x: L.menu.x + L.menu.w + 12, w: L.pause.x - L.menu.x - L.menu.w - 24, y: hudTop + 45 };
    const taskH = clamp(U.h * 0.12, 112, 176), coachH = clamp(U.h * (choices ? 0.15 : 0.17), choices ? 150 : 110, choices ? 200 : 270), btnH = 90;
    L.task = R(cx, hudTop + 90 + 22, W, taskH);
    L.pill = { x: cx + W / 2, y: hudTop + 90 };
    L.btns = R(cx, U.y1 - m - btnH, W, btnH);
    L.coach = R(cx, L.btns.y - 10 - coachH, W, coachH);
    L.avail = R(cx, L.task.y + L.task.h + 8, W, L.coach.y - 8 - (L.task.y + L.task.h + 8));
  } else {
    const pw = clamp(U.w * 0.42, 330, 600), x = U.x0 + m, btnH = 88;
    L.hud = R(x, U.y0 + 6, pw, 90);
    L.menu = R(Math.max(x, U.x0 + hb), U.y0 + 8, 130, 86); L.pause = R(x + pw - 88, U.y0 + 8, 88, 86);
    L.title = { x: L.menu.x + L.menu.w + 10, w: L.pause.x - L.menu.x - L.menu.w - 20, y: U.y0 + 51 };
    L.btns = R(x, U.y1 - m - btnH, pw, btnH);
    const free = L.btns.y - 10 - (U.y0 + 128) - 10, taskH = clamp(free * 0.38, 118, 200);
    L.task = R(x, U.y0 + 128, pw, taskH);
    L.pill = { x: x + pw / 2, y: U.y0 + 98 };
    L.coach = R(x, L.task.y + taskH + 10, pw, L.btns.y - 10 - (L.task.y + taskH + 10));
    L.avail = R(x + pw + m, U.y0 + m, U.x1 - m - (x + pw + m), U.h - 2 * m);
  }
  L.geo = abacusGeo(L.avail, rods, true);
  const bw = (L.btns.w - 2 * 10) / 3;
  L.b = [R(L.btns.x, L.btns.y, bw, L.btns.h), R(L.btns.x + bw + 10, L.btns.y, bw, L.btns.h), R(L.btns.x + 2 * (bw + 10), L.btns.y, bw, L.btns.h)];
  if (choices) L.choices = grid(R(L.coach.x + 10, L.coach.y + 10, L.coach.w - 20, L.coach.h - 20), 2, Math.ceil(choices / 2), 10);
  return L;
}

// ---- title -----------------------------------------------------------------------------------------------------------------
export function titleLayout(w, h) {
  return memo(`title|${Math.round(w)}x${Math.round(h)}|${insKey()}`, () => {
    const F = frame(w, h), { U } = F, m = 18, T = { F, buttons: {} };
    const prim = ['lessons', 'flash', 'sprint'], sec = ['learn', 'howto', 'rules', 'stats', 'settings', 'about'];
    let col;
    if (F.land && U.w > 760) {
      const cw = clamp(U.w * 0.42, 420, 640), cx = U.x1 - cw - m * 1.5;
      T.hero = R(U.x0 + m, U.y0 + m, cx - U.x0 - 2 * m, U.h - 2 * m - 70);
      col = R(cx, U.y0 + m, cw, U.h - 2 * m - 60);
      T.brand = { x: U.x0 + (cx - U.x0) / 2, y: U.y1 - 26 }; T.landscape = true;
    } else {
      const cw = Math.min(U.w - 2 * m, 640), top = U.y0 + 6;
      const need = prim.length * 96 + 16 + 3 * 84 + 10 + 80;
      const heroH = clamp(U.h - need - 70, 200, 640);
      T.hero = R(U.x0 + m, top + (F.ins.back ? 40 : 0), U.w - 2 * m, heroH - (F.ins.back ? 40 : 0));
      col = R(U.x0 + (U.w - cw) / 2, top + heroH, cw, U.h - heroH - 70);
      T.brand = { x: U.x0 + U.w / 2, y: U.y1 - 26 };
    }
    let pH = clamp((col.h - 16 - 3 * 12) / (prim.length + 3) * 1.18, 70, 132), sH = clamp(pH * 0.74, 78, 100);
    const total = prim.length * (pH + 12) + 4 + 3 * (sH + 10);
    if (total > col.h) { const k = col.h / total; pH = Math.max(66, pH * k); sH = Math.max(72, sH * k); }
    let y = col.y + Math.max(0, (col.h - (prim.length * (pH + 12) + 16 + 3 * (sH + 10))) / 2);
    prim.forEach((id) => { T.buttons[id] = R(col.x, y, col.w, pH); y += pH + 12; });
    y += 4;
    const g = grid(R(col.x, y, col.w, 3 * sH + 20), 2, 3, 10);
    sec.forEach((id, i) => { T.buttons[id] = g[i]; });
    return T;
  });
}

// ---- generic header + scrolling body used by the text/list screens -----------------------------------------------------------------
export function pageLayout(w, h, { footer = 0 } = {}) {
  return memo(`page|${Math.round(w)}x${Math.round(h)}|${insKey()}|${footer}`, () => {
    const F = frame(w, h), { U, back } = F, m = clamp(U.w * 0.025, 14, 36);
    const hdrTop = U.y0 + 8, hdrH = 90, maxW = Math.min(U.w - 2 * m, 1500);
    const x0 = U.x0 + (U.w - maxW) / 2;
    const P = { F, m, maxW, x0 };
    P.titleX = Math.max(x0, back.w ? U.x0 + back.w + 4 : x0);
    P.header = R(x0, hdrTop, maxW, hdrH);
    P.textDec = R(U.x1 - m - 2 * 88 - 8, hdrTop + 2, 88, 86); P.textInc = R(U.x1 - m - 88, hdrTop + 2, 88, 86);
    const fh = footer ? 92 : 0;
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
    const cols = P.body.w >= 1250 ? 2 : 1, gap = 12, rowH = Math.round(114 * (1 + (scale - 1) * 0.5)), cw = (P.body.w - gap * (cols - 1)) / cols;
    P.rows = []; P.cols = cols;
    for (let i = 0; i < nRows; i++) {
      const c = i % cols, r = Math.floor(i / cols), rect = R(P.body.x + c * (cw + gap), P.body.y + r * (rowH + gap), cw, rowH);
      const frac = cw < 800 ? ({ 0: 0.8, 2: 0.68 }[i] ?? 0.54) : 0.5, ctrlW = Math.min(cw * (scale > 1.6 ? Math.max(frac, 0.6) : frac), 560), ctrl = R(rect.x + rect.w - 14 - ctrlW, rect.y + 8, ctrlW, rect.h - 16);
      P.rows.push({ rect, ctrl });
    }
    P.contentH = Math.ceil(nRows / cols) * (rowH + gap);
    return P;
  });
}
export const lessonCardH = (sc) => Math.round(150 * Math.min(1 + (sc - 1) * 0.7, 2.6));
export const levelCardH = (sc) => Math.round(120 * Math.min(1 + (sc - 1) * 0.6, 2.2));
// A scrolling list of cards (lessons, levels).
export function listLayout(w, h, nCards, minH = 128) {
  return memo(`list|${Math.round(w)}x${Math.round(h)}|${insKey()}|${nCards}|${minH}`, () => {
    const P = { ...pageLayout(w, h, { footer: 1 }) };
    const f = P.footer; P.back = R(f.x + f.w / 2 - 160, f.y, 320, f.h);
    const bw2 = Math.min(320, (f.w - 14) / 2); P.back2 = R(f.x + f.w / 2 - bw2 - 7, f.y, bw2, f.h); P.watch = R(f.x + f.w / 2 + 7, f.y, bw2, f.h);
    const cols = P.body.w >= 1500 ? 3 : P.body.w >= 780 ? 2 : 1, gap = 12, cw = (P.body.w - gap * (cols - 1)) / cols, ch = minH;
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
export function overLayout(w, h) {
  return memo(`over|${Math.round(w)}x${Math.round(h)}|${insKey()}`, () => {
    const F = frame(w, h), { U } = F, m = 18, O = { F };
    const bh = 88, wide = F.land && U.w > U.h * 1.1, cw = wide ? Math.min(U.w - 2 * m, 900) : Math.min(U.w - 2 * m, 680), cx = U.x0 + (U.w - cw) / 2;
    O.wide = wide; const top0 = U.y0 + m + (F.ins.back ? 40 : 0), availH = U.h - 2 * m - 2 * bh - 58 - (F.ins.back ? 40 : 0), cardH = Math.min(availH, 540);
    O.card = R(cx, top0 + (availH - cardH) / 2, cw, cardH);
    const by = U.y1 - m - 2 * bh - 12 - 18;
    O.btns = { next: R(cx, by, cw, bh), share: R(cx, by + bh + 12, cw / 2 - 6, bh), menu: R(cx + cw / 2 + 6, by + bh + 12, cw / 2 - 6, bh) };
    O.more = { x: U.x0 + U.w / 2, y: U.y1 - 12 };
    return O;
  });
}
export function centerCard(w, h, cw, ch) { const F = frame(w, h), { U } = F; return R(U.x0 + (U.w - Math.min(cw, U.w - 32)) / 2, U.y0 + (U.h - Math.min(ch, U.h - 32)) / 2, Math.min(cw, U.w - 32), Math.min(ch, U.h - 32)); }
export { R, clamp, grid };

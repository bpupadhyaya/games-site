// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// Render and hit-testing both read these rects, so what is drawn is what is tapped.
//   arrange: header, a grid of cards, then a control zone (tools, or the hint card, or the Watch and Learn rail)
//   perform: the wooden stage with the front card, the narrator caption, audience lanterns and the Pull button
//   landscape: the picture side by side with one panel that holds info, caption and controls
import { GL } from './gl.js';
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

// ---- title -----------------------------------------------------------------------------------------------------------------------
export function titleLayout(w, h, hasSave) {
  return memo(`title|${Math.round(w)}x${Math.round(h)}|${insKey()}|${hasSave ? 1 : 0}`, () => {
    const F = frame(w, h), { U } = F, m = 18;
    const T = { F, buttons: {} };
    const prim = (hasSave ? ['continue'] : []).concat(['journey', 'free', 'daily']), sec = ['learn', 'howto', 'rules', 'stats', 'settings', 'about'];
    let col;
    if (F.land && U.w > 760) {
      const cw = clamp(U.w * 0.42, 420, 640), cx = U.x1 - cw - m * 1.5;
      T.hero = R(U.x0 + m, U.y0 + m, cx - U.x0 - 2 * m, U.h - 2 * m - 70);
      col = R(cx, U.y0 + m, cw, U.h - 2 * m - 60);
      T.brand = { x: U.x0 + (cx - U.x0) / 2, y: U.y1 - 26 }; T.landscape = true;
    } else {
      const cw = Math.min(U.w - 2 * m, 640), top = U.y0 + 6;
      const need = prim.length * 92 + 16 + 3 * 70 + 10 + 80;
      const heroH = clamp(U.h - need - 70, 200, 640);
      T.hero = R(U.x0 + m, top + (F.ins.back ? 40 : 0), U.w - 2 * m, heroH - (F.ins.back ? 40 : 0));
      col = R(U.x0 + (U.w - cw) / 2, top + heroH, cw, U.h - heroH - 70);
      T.brand = { x: U.x0 + U.w / 2, y: U.y1 - 26 };
    }
    const pH = clamp((col.h - 16 - 3 * 12) / (prim.length + 3) * 1.15, 66, 128), sH = clamp(pH * 0.72, 52, 96);
    let y = col.y + Math.max(0, (col.h - (prim.length * (pH + 12) + 16 + 3 * (sH + 10))) / 2);
    prim.forEach((id) => { T.buttons[id] = R(col.x, y, col.w, pH); y += pH + 12; });
    y += 4;
    const g = grid(R(col.x, y, col.w, 3 * sH + 20), 2, 3, 10);
    sec.forEach((id, i) => { T.buttons[id] = g[i]; });
    return T;
  });
}

// ---- generic header + scrolling body used by the text and list screens ------------------------------------------------------------------
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
    if (P.split) { const lw = clamp(P.body.w * 0.42, 360, 700); P.fig = R(P.body.x, P.body.y, lw, P.body.h); P.text = R(P.body.x + lw + 20, P.body.y, P.body.w - lw - 20, P.body.h); }
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
      const frac = cw < 800 ? 0.66 : 0.5, ctrlW = Math.min(cw * (scale > 1.6 ? Math.max(frac, 0.7) : frac), 560), ctrl = R(rect.x + rect.w - 14 - ctrlW, rect.y + 14, ctrlW, rect.h - 28);
      P.rows.push({ rect, ctrl });
    }
    P.contentH = Math.ceil(nRows / cols) * (rowH + gap);
    return P;
  });
}
export function listLayout(w, h) {
  return memo(`list|${Math.round(w)}x${Math.round(h)}|${insKey()}`, () => {
    const P = { ...pageLayout(w, h, { footer: 1 }) };
    const f = P.footer; P.back = R(f.x + f.w / 2 - 160, f.y, 320, f.h);
    return P;
  });
}
export function statsLayout(w, h) { return listLayout(w, h); }

// ---- pick screens (content-space rects; hit-testing adds the scroll offset) ---------------------------------------------------------------
export function journeyRects(body, counts, scale = 1) {
  const sc = Math.min(scale, 1.6), items = []; let y = body.y;
  const cols = body.w >= 900 ? 2 : 1, gap = 12, cw = (body.w - gap * (cols - 1)) / cols, rh = 118 * sc;
  counts.forEach((cnt, ci) => {
    const head = R(body.x, y, body.w, 76 * sc); y += head.h + 6;
    const rows = [];
    for (let i = 0; i < cnt; i++) rows.push(R(body.x + (i % cols) * (cw + gap), y + Math.floor(i / cols) * (rh + gap), cw, rh));
    y += Math.ceil(cnt / cols) * (rh + gap) + 14;
    items.push({ head, rows, ci });
  });
  return { items, contentH: y - body.y };
}
export function freeRects(body, count, scale = 1) {
  const sc = Math.min(scale, 1.5), cols = body.w >= 980 ? 2 : 1, gap = 14, cw = (body.w - gap * (cols - 1)) / cols, ch = 214 * sc, cards = [];
  for (let i = 0; i < count; i++) {
    const r = R(body.x + (i % cols) * (cw + gap), body.y + Math.floor(i / cols) * (ch + gap), cw, ch);
    const bh = 62 * Math.min(sc, 1.3), by = r.y + r.h - bh - 14, bw = (r.w - 28 - 20) / 3;
    cards.push({ r, tiers: [0, 1, 2].map((k) => R(r.x + 14 + k * (bw + 10), by, bw, bh)) });
  }
  return { cards, contentH: Math.ceil(count / cols) * (ch + gap) };
}

// ---- play ------------------------------------------------------------------------------------------------------------------------------
// Best grid for n cards (4:3 each) inside `area`.
function cardGrid(area, n, gap) {
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols), cw = Math.min((area.w - gap * (cols - 1)) / cols, ((area.h - gap * (rows - 1)) / rows) * (4 / 3));
    if (cw > 0 && (!best || cw > best.cw + 0.5)) best = { cols, rows, cw };
  }
  if (!best) best = { cols: Math.min(n, 2), rows: Math.ceil(n / 2), cw: 40 };
  const ch = best.cw * 0.75, tw = best.cols * best.cw + (best.cols - 1) * gap, th = best.rows * ch + (best.rows - 1) * gap;
  const x0 = area.x + (area.w - tw) / 2, y0 = area.y + Math.max(0, (area.h - th) / 2);
  const rects = Array.from({ length: n }, (_, i) => R(x0 + (i % best.cols) * (best.cw + gap), y0 + Math.floor(i / best.cols) * (ch + gap), best.cw, ch));
  return { rects, cols: best.cols, rows: best.rows, cw: best.cw };
}
const TOOLS = ['hang', 'hint', 'undo', 'flip'];

export function playLayout(w, h, { n = 4, mode = 'arrange', coach = false } = {}) {
  return memo(`play|${Math.round(w)}x${Math.round(h)}|${insKey()}|${n}|${mode}|${coach ? 1 : 0}|${GL.active ? 1 : 0}`, () => buildPlay(frame(w, h), n, mode, coach));
}
function buildPlay(F, n, mode, coach) {
  const { U, back } = F, m = clamp(U.w * 0.02, 12, 26), gap = 12, L = { F, w: F.w, h: F.h, U, m, n, back, pmode: mode, coach };
  const hudH = 78, hudTop = U.y0 + 6, hb = U.x0 + (back.w ? back.w + 4 : 0);
  const landscape = F.land && U.w >= U.h * 1.15;
  L.land = landscape;
  const ctlH = coach ? 250 : 74 + 14;
  if (!landscape) {
    const cw = Math.min(U.w - 2 * m, 760), cx = U.x0 + (U.w - cw) / 2;
    L.hud = { title: R(Math.max(U.x0 + m, hb), hudTop, cw * 0.62, hudH), info: { x: U.x1 - m - 66 - 16, y: hudTop + 56 } };
    L.pause = R(U.x1 - m - 66, hudTop + 6, 66, 66);
    const top = hudTop + hudH + 4;
    if (mode === 'arrange') {
      const ctl = R(cx, U.y1 - 8 - ctlH, cw, ctlH);
      L.ctl = ctl; L.gridArea = R(cx, top, cw, ctl.y - top - 8);
    } else {
      const pullH = 92, lanH = 62, avail = U.y1 - 10 - pullH - 10 - top, capH = clamp(avail * 0.2, 100, 190);
      const stageH = Math.max(120, avail - lanH - capH - 30), pad0 = Math.max(10, Math.min(cw, stageH) * 0.045);
      const scw = Math.max(60, Math.min(cw - 2 * pad0, ((stageH - 2 * pad0 - 36) * 4) / 3)), fh = scw * 0.75 + 2 * pad0 + 36;
      const groupH = lanH + 6 + fh + 12 + capH, y0 = top + Math.max(0, (avail - groupH) / 2);
      L.lanterns = R(cx, y0, cw, lanH);
      L.stageArea = R(cx, y0 + lanH + 6, cw, fh);
      L.caption = R(cx, y0 + lanH + 6 + fh + 12, cw, capH);
      L.pull = R(cx, U.y1 - 10 - pullH, cw, pullH);
    }
  } else {
    // arranging with no coach card: the panel only needs the title, the info line and the four tools, so it is slimmer and shorter and the
    // cards get the rest of the screen (a full-height panel left a big empty dark block)
    const slim = mode === 'arrange' && !coach;
    const panelW = slim ? clamp(U.w * 0.31, 390, 480) : clamp(U.w * 0.34, 340, 560);
    const panelH = slim ? Math.min(U.h - 2 * m, hudH + 14 + 2 * 64 + gap + 36) : U.h - 2 * m;
    const panel = R(U.x1 - m - panelW, U.y0 + (slim ? (U.h - panelH) / 2 : m), panelW, panelH);
    L.panel = panel;
    const leftX = U.x0 + m, leftW = panel.x - m - leftX;
    L.hud = { title: R(panel.x + 16, panel.y + 8, panel.w - 100, hudH - 10), info: { x: panel.x + panel.w / 2, y: panel.y + hudH + 10 } };
    L.pause = R(panel.x + panel.w - 16 - 62, panel.y + 8, 62, 62);
    const hbOff = back.w && leftX < U.x0 + back.w + 10 ? back.h + 6 : 0;
    const area = R(leftX, U.y0 + m + hbOff, leftW, U.h - 2 * m - hbOff);
    const bottom = panel.y + panel.h - 12;
    if (mode === 'arrange') {
      L.gridArea = area;
      L.ctl = slim ? R(panel.x + 12, bottom - (2 * 64 + gap), panel.w - 24, 2 * 64 + gap) : R(panel.x + 12, bottom - Math.max(ctlH, 170) - (coach ? 0 : 60), panel.w - 24, Math.max(ctlH, 170) + (coach ? 0 : 60));
    } else {
      L.stageArea = area;
      const pullH = 88;
      L.pull = R(panel.x + 12, bottom - pullH, panel.w - 24, pullH);
      L.lanterns = R(panel.x + 12, panel.y + hudH + 40, panel.w - 24, 60);
      const cy = L.lanterns.y + L.lanterns.h + 12;
      L.caption = R(panel.x + 12, cy, panel.w - 24, L.pull.y - 10 - cy);
    }
  }
  if (mode === 'arrange') {
    L.grid = cardGrid(L.gridArea, n, gap + 4);
    const C = L.ctl, bh = 66, ip = 12;
    if (coach) {
      L.coachBtns = { close: R(C.x + ip, C.y + C.h - bh - ip, C.w / 2 - ip - 6, bh), go: R(C.x + C.w / 2 + 6, C.y + C.h - bh - ip, C.w / 2 - ip - 6, bh) };
      const wide = C.w >= 560, rh = wide ? bh : bh * 2 + 10;
      const rail = grid(R(C.x + ip, C.y + C.h - rh - ip, C.w - 2 * ip, rh), wide ? 4 : 2, wide ? 1 : 2, 10);
      L.rail = { exit: rail[0], pause: rail[1], dec: rail[2], inc: rail[3] };
      L.coachText = R(C.x, C.y, C.w, C.h - Math.max(bh, rh) - 12 - ip);
    } else {
      const twoRows = F.land && landscape;
      L.tools = {};
      if (twoRows) { const tr = grid(R(C.x, C.y + C.h - 2 * 64 - gap, C.w, 2 * 64 + gap), 2, 2, gap); TOOLS.forEach((k, i) => { L.tools[k] = tr[i]; }); }
      else {
        const y = C.y + C.h - 74, hw = Math.min(C.w * 0.4, C.w - 3 * 70 - 3 * gap), ow = (C.w - hw - 3 * gap) / 3;
        L.tools.hang = R(C.x, y, hw, 74); ['hint', 'undo', 'flip'].forEach((k, i) => { L.tools[k] = R(C.x + hw + gap + i * (ow + gap), y, ow, 74); });
      }
    }
  } else {
    const sa = L.stageArea, pad = Math.max(10, Math.min(sa.w, sa.h) * 0.045);
    // with the 3D scene the storyteller stands behind the box: the card is a little smaller so his head fits above it
    const kS = GL.active ? (sa.w > sa.h ? 0.42 : 0.7) : 1;
    let cw = Math.min(sa.w * (GL.active ? (sa.w > sa.h ? 0.6 : 0.7) : 1) - 2 * pad, (((sa.h * kS) - 2 * pad - 36) * 4) / 3); cw = Math.max(60, cw);
    const ch = cw * 0.75, fw = cw + 2 * pad, fh = ch + 2 * pad + 36, fx = GL.active && sa.w > sa.h ? sa.x + sa.w * 0.04 : sa.x + (sa.w - fw) / 2, fy = GL.active && sa.w > sa.h ? sa.y + sa.h - fh - 4 : sa.y + Math.max(0, (sa.h - fh) / 2);
    L.stage = { frame: R(fx, fy, fw, fh), card: R(fx + pad, fy + pad + 6, cw, ch), pad, floor: R(fx, fy + fh - 36, fw, 36) };
    L.coachBtns = null;
    const wide = L.pull.w >= 560, rh = wide ? 60 : 60 * 2 + 10;
    const railR = R(L.pull.x, L.pull.y - rh - 10, L.pull.w, rh);
    const rail = grid(railR, wide ? 4 : 2, wide ? 1 : 2, 10);
    L.rail = { exit: rail[0], pause: rail[1], dec: rail[2], inc: rail[3], rect: railR };
  }
  return L;
}

// ---- result ----------------------------------------------------------------------------------------------------------------------
export function overLayout(w, h, scale = 1) {
  return memo(`over|${Math.round(w)}x${Math.round(h)}|${insKey()}|${scale}`, () => {
    const F = frame(w, h), { U } = F, m = 18, O = { F };
    const wide = F.land && U.w > U.h * 1.05, bh = wide ? 66 : 74;
    O.wide = wide;
    if (wide) {
      const bs = Math.min(U.h - 2 * m - 20, U.w * 0.48);
      O.pic = R(U.x0 + m + 6, U.y0 + m + (F.ins.back ? 40 : 0), bs, bs * 0.75);
      const cx = O.pic.x + O.pic.w + 36, cw = U.x1 - m - cx, by = U.y1 - m - 2 * (bh + 12) - 24;
      O.btns = { next: R(cx, by, cw, bh), share: R(cx, by + bh + 12, cw / 2 - 6, bh), menu: R(cx + cw / 2 + 6, by + bh + 12, cw / 2 - 6, bh) };
      O.more = { x: cx + cw / 2, y: U.y1 - m - 8 };
      O.body = R(cx, U.y0 + m, cw, by - 14 - U.y0 - m);
    } else {
      const cw = Math.min(U.w - 2 * m, 700), cx = U.x0 + (U.w - cw) / 2;
      const pw = clamp(Math.min(cw * 0.86, U.h * 0.3) * (scale <= 1 ? 1 : scale <= 1.5 ? 0.8 : 0.6), 120, 560);
      O.pic = R(U.x0 + (U.w - pw) / 2, U.y0 + 14 + (F.ins.back ? 44 : 0), pw, pw * 0.75);
      const by = U.y1 - m - 2 * (bh + 12) - 36;
      O.btns = { next: R(cx, by, cw, bh), share: R(cx, by + bh + 12, cw / 2 - 6, bh), menu: R(cx + cw / 2 + 6, by + bh + 12, cw / 2 - 6, bh) };
      O.body = R(cx, O.pic.y + O.pic.h + 12, cw, by - 12 - (O.pic.y + O.pic.h + 12));
      O.more = { x: U.x0 + U.w / 2, y: U.y1 - 8 };
    }
    return O;
  });
}

// ---- small overlays ----------------------------------------------------------------------------------------------------------------
export function pauseLayout(w, h) {
  const F = frame(w, h), { U } = F, cw = Math.min(U.w - 30, 520), nb = 4, bh = Math.max(44, Math.min(78, (U.h - 24 - 80) / nb / 1.6 - 12)), ch = nb * (bh + 12) + 80;
  const card = R(U.x0 + (U.w - cw) / 2, U.y0 + (U.h - ch) / 2, cw, ch);
  return { card, resume: R(card.x + 16, card.y + 70, cw - 32, bh), restart: R(card.x + 16, card.y + 70 + bh + 12, cw - 32, bh), settings: R(card.x + 16, card.y + 70 + 2 * (bh + 12), cw - 32, bh), menu: R(card.x + 16, card.y + 70 + 3 * (bh + 12), cw - 32, bh) };
}
export function centerCard(w, h, cw, ch) { const F = frame(w, h), { U } = F; return R(U.x0 + (U.w - Math.min(cw, U.w - 32)) / 2, U.y0 + (U.h - Math.min(ch, U.h - 32)) / 2, Math.min(cw, U.w - 32), Math.min(ch, U.h - 32)); }
export { R, clamp, grid };
// The little page-turn button in the corner of a card (arrange screen).
export function flipRect(r) { const s = clamp(r.w * 0.2, 34, 52); return R(r.x + r.w - s - 6, r.y + r.h - s - 6, s, s); }
// The pull tab of the front card on stage, and the swipe area.
export function tabCenter(card) { const r0 = clamp(card.w * 0.055, 15, 30); return { x: card.x + card.w - r0 * 1.9, y: card.y + card.h - r0 * 1.9, r: r0 }; }

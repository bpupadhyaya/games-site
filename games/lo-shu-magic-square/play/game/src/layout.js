// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// Render and hit-testing both read these rects, so what is drawn is what is tapped.
//   play   portrait : header, square board (with its sum gauges), then the stone tray and a tool row
//          landscape: board on one side, one panel with info, tray and tools on the other (side follows the hand setting)
//   A hint card or the Watch and Learn rail takes over the tray and tools area.
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

// ---- the board: a frame with a band for the sum gauges, and n x n sockets inside --------------------------------------------------------
// Standard squares carry gauges on the right (rows), below (columns) and in two corners (diagonals); the band along the top holds
// the magic-number banner. Pandiagonal squares add bands on the left and top for the broken diagonals.
export function boardGeo(bx, by, bw, bh, n, pan, { top = false } = {}) {
  const pad = 8, bands = pan ? 2 : 1;
  let bd = 56, G = 100;
  for (let it = 0; it < 3; it++) {
    G = Math.max(60, Math.min(bw - 2 * pad - bands * bd, bh - 2 * pad - 2 * bd));
    bd = clamp((G / n) * 0.42, 38, 64);
  }
  G = Math.max(60, Math.min(bw - 2 * pad - bands * bd, bh - 2 * pad - 2 * bd));
  const s = G / n, gap = Math.max(2, s * 0.06), w = G + 2 * pad + bands * bd, h = G + 2 * pad + 2 * bd;
  const x = bx + (bw - w) / 2, y = top ? by : by + (bh - h) / 2;
  const gx = x + pad + (pan ? bd : 0), gy = y + pad + bd;
  const cells = Array.from({ length: n * n }, (_, i) => R(gx + (i % n) * s + gap / 2, gy + Math.floor(i / n) * s + gap / 2, s - gap, s - gap));
  const at = (px, py) => {
    if (px < gx || py < gy || px >= gx + G || py >= gy + G) return -1;
    return Math.floor((py - gy) / s) * n + Math.floor((px - gx) / s);
  };
  const rx = gx + G + pad / 2 + bd / 2, by2 = gy + G + pad / 2 + bd / 2;
  const rows = Array.from({ length: n }, (_, k) => ({ x: rx, y: gy + (k + 0.5) * s }));
  const cols = Array.from({ length: n }, (_, k) => ({ x: gx + (k + 0.5) * s, y: by2 }));
  const tops = Array.from({ length: n }, (_, k) => ({ x: gx + (k + 0.5) * s, y: y + pad / 2 + bd / 2 }));
  const lefts = Array.from({ length: n }, (_, k) => ({ x: x + pad / 2 + bd / 2, y: gy + (k + 0.5) * s }));
  const diagStd = { x: rx, y: by2 }, antiStd = { x: rx, y: y + pad / 2 + bd / 2 };
  const banner = R(gx, y + pad / 2, Math.max(40, G - bd * 0.3), bd);
  return { x, y, w, h, size: Math.max(w, h), n, pan, s, G, bd, cells, at, rect: R(x, y, w, h), gx, gy, gauges: { rows, cols, tops, lefts, diagStd, antiStd, r: bd * 0.46 }, banner };
}

// ---- play --------------------------------------------------------------------------------------------------------------------
// Tray slots: choose the column count that makes the biggest stones fit the space.
function trayGrid(area, N, gap) {
  let best = null;
  for (let cols = Math.min(N, 3); cols <= Math.min(N, 10); cols++) {
    const rows = Math.ceil(N / cols), s = Math.min((area.w - gap * (cols - 1)) / cols, (area.h - gap * (rows - 1)) / rows, N <= 9 ? 150 : 120);
    if (s > 0 && (!best || s > best.s + 0.5)) best = { cols, rows, s };
  }
  if (!best) best = { cols: Math.min(N, 5), rows: Math.ceil(N / 5), s: 30 };
  const w = best.cols * best.s + (best.cols - 1) * gap, h = best.rows * best.s + (best.rows - 1) * gap;
  const x0 = area.x + (area.w - w) / 2, y0 = area.y + Math.min(36, Math.max(0, (area.h - h) / 2));
  const slots = Array.from({ length: N }, (_, i) => R(x0 + (i % best.cols) * (best.s + gap), y0 + Math.floor(i / best.cols) * (best.s + gap), best.s, best.s));
  return { slots, rect: R(x0, y0, w, h), s: best.s };
}

export function playLayout(w, h, { n = 3, pan = false, coach = false, lefty = false } = {}) {
  return memo(`play|${Math.round(w)}x${Math.round(h)}|${insKey()}|${n}|${pan ? 1 : 0}|${coach ? 1 : 0}|${lefty ? 1 : 0}`, () => buildPlay(frame(w, h), n, pan, coach, lefty));
}
const TOOLS = ['undo', 'redo', 'hint', 'reset'];

function buildPlay(F, n, pan, coach, lefty) {
  const { U, back } = F, N = n * n, m = clamp(U.w * 0.02, 12, 26), gap = 10;
  const hudH = 84, hudTop = U.y0 + 6, bTop = hudTop + hudH + 2;
  const toolH = 70, minTray = coach ? 250 : N <= 9 ? 120 : N <= 16 ? 200 : 260;
  const portraitBox = { x: U.x0 + m, y: bTop, w: U.w - 2 * m, h: Math.max(200, U.y1 - bTop - minTray - (coach ? 0 : toolH + 12) - 10) };
  const gp = boardGeo(portraitBox.x, portraitBox.y, portraitBox.w, portraitBox.h, n, pan, { top: true });
  const panelW = clamp(U.w * 0.34, 360, 600);
  const landBox = { x: U.x0 + m, y: U.y0 + m, w: U.w - panelW - 3 * m, h: U.h - 2 * m };
  const gl = F.land ? boardGeo(landBox.x, landBox.y, landBox.w, landBox.h, n, pan) : null;
  const land = !!gl && gl.G >= gp.G * 1.04;
  const L = { F, w: F.w, h: F.h, U, mode: land ? 'land' : 'portrait', m, coach, lefty, n, back };
  if (!land) {
    L.board = gp;
    const cw = Math.min(U.w - 2 * m, 640), cx = U.x0 + (U.w - cw) / 2, hb = U.x0 + (back.w ? back.w + 4 : 0);
    L.hud = { title: R(Math.max(U.x0 + m, hb), hudTop, cw * 0.55, hudH), timer: { x: U.x1 - m - 66 - 14, y: hudTop + 56 } };
    L.pause = R(U.x1 - m - 66, hudTop + 10, 66, 66);
    const top = gp.y + gp.h + 10, ctlH = Math.max(100, U.y1 - top - 8);
    L.ctl = R(cx, top, cw, ctlH);
    if (coach) L.coachR = L.ctl; else {
      L.tools = {}; const tr = grid(R(cx, U.y1 - 8 - toolH, cw, toolH), 4, 1, gap);
      TOOLS.forEach((k, i) => { L.tools[k] = tr[i]; });
      L.tray = trayGrid(R(cx, top, cw, ctlH - toolH - 14), N, gap);
    }
  } else {
    const Rw = clamp(U.w - gl.w - 3 * m, 340, 640), total = gl.w + Rw + 3 * m, gx0 = U.x0 + Math.max(0, (U.w - total) / 2);
    const bx = lefty ? gx0 + Rw + 2 * m : gx0 + m, px = lefty ? gx0 + m : gx0 + m + gl.w + m;
    L.board = boardGeo(bx, landBox.y, gl.w, landBox.h, n, pan);
    const panel = R(px, U.y0 + m, Rw, U.h - 2 * m);
    L.info = panel;
    const edgeLeft = panel.x <= U.x0 + 60, topPad = back.w && edgeLeft ? Math.max(14, back.y + back.h - panel.y + 4) : 14;
    const iy = panel.y + topPad;
    L.hud = { title: R(panel.x + 18, iy, panel.w - 110, 70), timer: { x: panel.x + panel.w / 2, y: iy + 118 } };
    L.pause = R(panel.x + panel.w - 18 - 62, iy + 4, 62, 62);
    L.badge = { x: panel.x + panel.w / 2, y: iy + 198 };
    const bottom = panel.y + panel.h - 14, tH = 64;
    if (coach) { L.coachR = R(panel.x + 12, iy + 226, panel.w - 24, bottom - iy - 226); L.ctl = L.coachR; } else {
      L.tools = {}; const tr = grid(R(panel.x + 12, bottom - 2 * tH - gap, panel.w - 24, 2 * tH + gap), 2, 2, gap);
      TOOLS.forEach((k, i) => { L.tools[k] = tr[i]; });
      const ty = iy + 226; L.tray = trayGrid(R(panel.x + 12, ty, panel.w - 24, bottom - 2 * tH - gap - 14 - ty), N, gap);
      L.ctl = R(panel.x, ty, panel.w, bottom - ty);
    }
  }
  const C = L.coachR ?? L.ctl, bh = 66, ip = 12;
  if (C) {
    L.coachBtns = { close: R(C.x + ip, C.y + C.h - bh - ip, C.w / 2 - ip - 6, bh), go: R(C.x + C.w / 2 + 6, C.y + C.h - bh - ip, C.w / 2 - ip - 6, bh) };
    const wide = C.w >= 560, rh = wide ? bh : bh * 2 + 10;
    const rail = grid(R(C.x + ip, C.y + C.h - rh - ip, C.w - 2 * ip, rh), wide ? 4 : 2, wide ? 1 : 2, 10);
    L.rail = { exit: rail[0], pause: rail[1], dec: rail[2], inc: rail[3] };
    L.coachText = R(C.x, C.y, C.w, C.h - Math.max(bh, rh) - 12 - ip);
  }
  return L;
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
      const need = (hasSave ? 3 : 2) * 100 + 16 + 2 * 62 + 10 + 80;
      const heroH = clamp(U.h - need - 70, 200, 640);
      T.hero = R(U.x0 + m, top + (F.ins.back ? 40 : 0), U.w - 2 * m, heroH - (F.ins.back ? 40 : 0));
      col = R(U.x0 + (U.w - cw) / 2, top + heroH, cw, U.h - heroH - 70);
      T.brand = { x: U.x0 + U.w / 2, y: U.y1 - 26 };
    }
    // One dominant Play button (Continue or The Journey), Free Play + Daily as a pair, six small tools in 3 x 2.
    const lead = hasSave ? ['continue', 'journey'] : ['journey'];
    const units = lead.length * 1.5 + 1 + 2 * 0.72;      // button heights in units of pH
    const pH = clamp((col.h - 12 * (lead.length + 3) - 16) / units, 60, 130), sH = clamp(pH * 0.62, 50, 84);
    let y = col.y + Math.max(0, (col.h - (lead.length * (pH * 1.5 + 12) + pH + 12 + 16 + 2 * (sH + 10))) / 2);
    lead.forEach((id, i) => { const hh = pH * (i === 0 && lead.length > 1 ? 1.3 : 1.5); T.buttons[id] = R(col.x, y, col.w, hh); y += hh + 12; });
    const pr = grid(R(col.x, y, col.w, pH), 2, 1, 12); T.buttons.free = pr[0]; T.buttons.daily = pr[1]; y += pH + 12 + 4;
    const g = grid(R(col.x, y, col.w, 2 * sH + 10), 3, 2, 10);
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
// Journey map: chapters, each with a row of level buttons. Free play: one card per square with three tier buttons.
export function listLayout(w, h) {
  return memo(`list|${Math.round(w)}x${Math.round(h)}|${insKey()}`, () => {
    const P = { ...pageLayout(w, h, { footer: 1 }) };
    const f = P.footer; P.back = R(f.x + f.w / 2 - 160, f.y, 320, f.h);
    return P;
  });
}
export function statsLayout(w, h) { return listLayout(w, h); }

// Content-space rectangles for the two scrolling pick screens (hit-testing adds the scroll offset).
export function journeyRects(body, counts, scale = 1, blurbs = []) {
  const sc = Math.min(scale, 1.6), per = Math.max(3, Math.floor((body.w + 10) / (86 * sc + 10))), ls = Math.min(120, (body.w - 10 * (per - 1)) / per);
  const items = []; let y = body.y;
  counts.forEach((cnt, ci) => {
    // the blurb under the chapter name may wrap on narrow screens or at large text: reserve a line for each estimated row
    const sz = Math.max(21, 12 / (host.px || 0.55)) * sc, rows = Math.max(1, Math.ceil(((blurbs[ci] ?? '').length * 0.5 * sz) / Math.max(40, body.w - 8)));
    const head = R(body.x, y, body.w, 78 * sc + (rows - 1) * sz * 1.15); y += head.h + 6;
    const lv = [];
    for (let i = 0; i < cnt; i++) { const r = R(body.x + (i % per) * (ls + 10), y + Math.floor(i / per) * (ls * 0.86 + 10), ls, ls * 0.86); lv.push(r); }
    y += Math.ceil(cnt / per) * (ls * 0.86 + 10) + 16;
    items.push({ head, lv, ci });
  });
  return { items, contentH: y - body.y };
}
export function freeRects(body, count, scale = 1) {
  const sc = Math.min(scale, 1.5), cols = body.w >= 980 ? 2 : 1, gap = 14, cw = (body.w - gap * (cols - 1)) / cols, ch = 218 * sc, cards = [];
  for (let i = 0; i < count; i++) {
    const r = R(body.x + (i % cols) * (cw + gap), body.y + Math.floor(i / cols) * (ch + gap), cw, ch);
    const bh = 62 * Math.min(sc, 1.3), by = r.y + r.h - bh - 14, bw = (r.w - 28 - 20) / 3;
    cards.push({ r, tiers: [0, 1, 2].map((k) => R(r.x + 14 + k * (bw + 10), by, bw, bh)) });
  }
  return { cards, contentH: Math.ceil(count / cols) * (ch + gap) };
}


// ---- result ----------------------------------------------------------------------------------------------------------------------
export function overLayout(w, h, scale = 1, n = 3, pan = false) {
  return memo(`over|${Math.round(w)}x${Math.round(h)}|${insKey()}|${scale}|${n}|${pan ? 1 : 0}`, () => {
    const F = frame(w, h), { U } = F, m = 18, O = { F };
    const wide = F.land && U.w > U.h * 1.05, bh = wide ? 66 : 74;
    O.wide = wide;
    if (wide) {
      const bs = Math.min(U.h - 2 * m - 20, U.w * 0.44) * (scale > 2 ? 0.8 : 1);
      O.board = boardGeo(U.x0 + m + 6, U.y0 + m, bs, U.h - 2 * m, n, pan);
      const cx = O.board.x + O.board.w + 36, cw = U.x1 - m - cx, by = U.y1 - m - 2 * (bh + 12) - 24;
      O.btns = { next: R(cx, by, cw, bh), share: R(cx, by + bh + 12, cw / 2 - 6, bh), menu: R(cx + cw / 2 + 6, by + bh + 12, cw / 2 - 6, bh) };
      O.more = { x: cx + cw / 2, y: U.y1 - m - 8 };
      O.body = R(cx, U.y0 + m, cw, by - 14 - U.y0 - m);
    } else {
      const cw = Math.min(U.w - 2 * m, 700), cx = U.x0 + (U.w - cw) / 2;
      const bs = clamp(Math.min(cw * 0.9, U.h * 0.46) * (scale <= 1 ? 1 : scale <= 1.5 ? 0.8 : scale <= 2 ? 0.6 : 0.42), 120, 640);
      O.board = boardGeo(U.x0 + (U.w - bs) / 2, U.y0 + 14 + (F.ins.back ? 44 : 0), bs, bs, n, pan, { top: true });
      const by = U.y1 - m - 2 * (bh + 12) - 36;
      O.btns = { next: R(cx, by, cw, bh), share: R(cx, by + bh + 12, cw / 2 - 6, bh), menu: R(cx + cw / 2 + 6, by + bh + 12, cw / 2 - 6, bh) };
      O.body = R(cx, O.board.y + O.board.h + 10, cw, by - 12 - (O.board.y + O.board.h + 10));
      O.more = { x: U.x0 + U.w / 2, y: U.y1 - 8 };
    }
    return O;
  });
}

// ---- small overlays -----------------------------------------------------------------------------------------------------------------
export function pauseLayout(w, h, board) {
  const b = board, cw = Math.min(b.w - 30, 520), nb = 4, bh = Math.max(44, Math.min(78, (b.h - 24 - 80) / nb - 12)), ch = nb * (bh + 12) + 80;
  const card = R(b.x + (b.w - cw) / 2, b.y + (b.h - ch) / 2, cw, ch);
  return { card, resume: R(card.x + 16, card.y + 70, cw - 32, bh), restart: R(card.x + 16, card.y + 70 + bh + 12, cw - 32, bh), settings: R(card.x + 16, card.y + 70 + 2 * (bh + 12), cw - 32, bh), menu: R(card.x + 16, card.y + 70 + 3 * (bh + 12), cw - 32, bh) };
}
export function centerCard(w, h, cw, ch) { const F = frame(w, h), { U } = F; return R(U.x0 + (U.w - Math.min(cw, U.w - 32)) / 2, U.y0 + (U.h - Math.min(ch, U.h - 32)) / 2, Math.min(cw, U.w - 32), Math.min(ch, U.h - 32)); }
export { R, clamp, grid };

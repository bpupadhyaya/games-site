// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// Every screen has a builder here; render and hit-testing both read the same rects, so what is drawn is what is tapped.
//   play   portrait : header, the field, a coach card when a hint is open, one row of four buttons
//          landscape: field on the left, one panel (status, coach card, 2x2 buttons) on the right
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


// ---- play ---------------------------------------------------------------------------------------------------------------------
// The control block: two groups of 3 rows (Slide x/y/z and Turn x/y/z, a minus and a plus each) and one row of five buttons.
// Slide order = wire.js SLIDES (+x -x +y -y +z -z); turn order = TURN_NAMES (+x -x +y -y +z -z).
function controlBlock(x, y, w) {
  const cellH = 62, gap = 8, grp = 18, cap = 24, cw = (w - grp - 2 * gap) / 4, out = { slide: [], turn: [], cap };
  const cx = (g, i) => x + (g ? 2 * (cw + gap) + grp : 0) + i * (cw + gap);
  for (let r = 0; r < 3; r++) {
    const ry = y + cap + r * (cellH + gap);
    out.slide[2 * r] = R(cx(0, 1), ry, cw, cellH);       // + on the right
    out.slide[2 * r + 1] = R(cx(0, 0), ry, cw, cellH);   // - on the left
    out.turn[2 * r] = R(cx(1, 1), ry, cw, cellH);
    out.turn[2 * r + 1] = R(cx(1, 0), ry, cw, cellH);
  }
  out.capSlide = R(x, y, 2 * cw + gap, cap); out.capTurn = R(cx(1, 0), y, 2 * cw + gap, cap);
  const ry = y + cap + 3 * (cellH + gap) + 4, rh = 66, c5 = (w - 4 * gap) / 5, ids = ['undo', 'reset', 'think', 'piece', 'menu'];
  ids.forEach((id, i) => { out[id] = R(x + i * (c5 + gap), ry, c5, rh); });
  out.h = cap + 3 * (cellH + gap) + 4 + rh;
  return out;
}
export const CONTROL_H = 24 + 3 * 70 + 4 + 66;
export function playLayout(w, h, coach = false) {
  return memo(`play|${Math.round(w)}x${Math.round(h)}|${insKey()}|${coach ? 1 : 0}`, () => {
    const F = frame(w, h), { U, back } = F, m = clamp(U.w * 0.025, 12, 26), L = { F };
    const land = F.land && U.w >= U.h * 1.15;
    L.land = land;
    if (!land) {
      const hudX = U.x0 + m + (back.w ? back.w : 0), top = U.y0 + 6, cw = Math.min(U.w - 2 * m, 700), cx = U.x0 + (U.w - cw) / 2;
      L.hud = R(hudX, top, U.x1 - m - hudX, 92);
      const fsMin = Math.max(14, 12 / (host.px || 0.55)), coachH = coach ? clamp(Math.max(U.h * 0.15, 4 * fsMin * 1.25 + 104), 120, 260) : 0;   // small phones: the 12 css px floor makes the hint text taller
      const cb = controlBlock(cx, 0, cw), cy = U.y1 - m - cb.h;
      L.ctl = controlBlock(cx, cy, cw);
      L.coachR = coach ? R(cx, cy - 10 - coachH, cw, coachH) : null;
      const aTop = L.hud.y + L.hud.h + 4, aBot = (L.coachR ? L.coachR.y : cy) - 8;
      L.area = R(U.x0 + m, aTop, U.w - 2 * m, Math.max(120, aBot - aTop));
    } else {
      const pw = clamp(U.w * 0.4, 380, 620), px = U.x1 - m - pw;
      L.area = R(U.x0 + m, U.y0 + m, px - 2 * m - U.x0, U.h - 2 * m);
      const topPad = back.w && px < U.x0 + 120 ? back.h : 0;
      L.hud = R(px, U.y0 + m + topPad, pw, 100);
      const cb = controlBlock(px, 0, pw), cy = U.y1 - m - cb.h;
      L.ctl = controlBlock(px, cy, pw);
      const cyc = L.hud.y + L.hud.h + 40;   // the kit's preview pill sits in the gap above
      L.coachR = R(px, cyc, pw, Math.max(50, cy - 10 - cyc));
      L.panel = R(px - 10, U.y0 + m - 8, pw + 20, U.h - 2 * m + 16);
    }
    return L;
  });
}

// ---- title -----------------------------------------------------------------------------------------------------------------------
export function titleLayout(w, h) {
  return memo(`title|${Math.round(w)}x${Math.round(h)}|${insKey()}`, () => {
    const F = frame(w, h), { U } = F, m = 18, T = { F, buttons: {} };
    const prim = ['play', 'levels', 'daily', 'learn'], sec = ['howto', 'rules', 'settings', 'about'];
    let col;
    if (F.land && U.w > 760) {
      const cw = clamp(U.w * 0.42, 420, 640), cx = U.x1 - cw - m * 1.5;
      T.hero = R(U.x0 + m, U.y0 + m, cx - U.x0 - 2 * m, U.h - 2 * m - 70);
      col = R(cx, U.y0 + m, cw, U.h - 2 * m - 60);
      T.brand = { x: U.x0 + (cx - U.x0) / 2, y: U.y1 - 26 }; T.landscape = true;
    } else {
      const cw = Math.min(U.w - 2 * m, 640), top = U.y0 + 6;
      const need = prim.length * 92 + 16 + 2 * 70 + 10 + 80;
      const heroH = clamp(U.h - need - 70, 190, 640);
      T.hero = R(U.x0 + m, top + (F.ins.back ? 40 : 0), U.w - 2 * m, heroH - (F.ins.back ? 40 : 0));
      col = R(U.x0 + (U.w - cw) / 2, top + heroH, cw, U.h - heroH - 70);
      T.brand = { x: U.x0 + U.w / 2, y: U.y1 - 26 };
    }
    const pH = clamp(Math.min((col.h - 16 - 2 * 12) / (prim.length + 2) * 1.16, (col.h - 74) / 5.44), 48, 120), sH = clamp(pH * 0.72, 40, 92);   // always fits the column, even on 320x568
    let y = col.y + Math.max(0, (col.h - (prim.length * (pH + 10) + 14 + 2 * (sH + 10))) / 2);
    prim.forEach((id) => { T.buttons[id] = R(col.x, y, col.w, pH); y += pH + 10; });
    y += 4;
    const g = grid(R(col.x, y, col.w, 2 * sH + 10), 2, 2, 10);
    sec.forEach((id, i) => { T.buttons[id] = g[i]; });
    return T;
  });
}

// ---- level list ---------------------------------------------------------------------------------------------------------------------
export function levelsLayout(w, h, n) {
  return memo(`lv|${Math.round(w)}x${Math.round(h)}|${insKey()}|${n}`, () => {
    const P = { ...pageLayout(w, h, { footer: 1 }) };
    const f = P.footer; P.back = R(f.x + f.w / 2 - 160, f.y, 320, f.h);
    const gap = 12, cols = clamp(Math.floor((P.body.w + gap) / 150), 3, 10), cw = (P.body.w - gap * (cols - 1)) / cols, ch = Math.round(cw * 1.02);
    P.tiles = []; P.cols = cols;
    for (let i = 0; i < n; i++) P.tiles.push(R(P.body.x + (i % cols) * (cw + gap), P.body.y + Math.floor(i / cols) * (ch + gap), cw, ch));
    P.contentH = Math.ceil(n / cols) * (ch + gap);
    return P;
  });
}

// ---- result card ----------------------------------------------------------------------------------------------------------------------
export function overLayout(w, h) {
  return memo(`over|${Math.round(w)}x${Math.round(h)}|${insKey()}`, () => {
    const F = frame(w, h), { U } = F, m = 18, bh = 70, pad = 20, land = F.land && U.w >= U.h * 1.15;
    let c, field;
    if (land) {
      const cw = clamp(U.w * 0.4, 380, 560), ch = Math.min(U.h - 2 * m, 480);
      c = R(U.x1 - m - cw, U.y0 + (U.h - ch) / 2, cw, ch);
      field = R(U.x0 + m, U.y0 + m, c.x - 2 * m - U.x0, U.h - 2 * m);
    } else {
      const cw = Math.min(U.w - 2 * m, 620), ch = clamp(U.h * 0.4, 400, 480);
      c = R(U.x0 + (U.w - cw) / 2, U.y1 - m - ch - 22, cw, ch);
      field = R(U.x0 + m, U.y0 + m + (F.ins.back ? 44 : 0), U.w - 2 * m, c.y - 2 * m - U.y0 - (F.ins.back ? 44 : 0));
    }
    return { F, card: c, field, next: R(c.x + pad, c.y + c.h - pad - 2 * bh - 12, c.w - 2 * pad, bh), again: R(c.x + pad, c.y + c.h - pad - bh, c.w / 2 - pad - 6, bh), menu: R(c.x + c.w / 2 + 6, c.y + c.h - pad - bh, c.w / 2 - pad - 6, bh) };
  });
}
// ---- pause / simple card -------------------------------------------------------------------------------------------------------------------
export function pauseLayout(w, h) {
  const c = centerCard(w, h, 520, 430), bh = 70;
  return { card: c, resume: R(c.x + 20, c.y + 80, c.w - 40, bh), restart: R(c.x + 20, c.y + 80 + bh + 12, c.w - 40, bh), menu: R(c.x + 20, c.y + 80 + 2 * (bh + 12), c.w - 40, bh) };
}

export function centerCard(w, h, cw, ch) { const F = frame(w, h), { U } = F; return R(U.x0 + (U.w - Math.min(cw, U.w - 32)) / 2, U.y0 + (U.h - Math.min(ch, U.h - 32)) / 2, Math.min(cw, U.w - 32), Math.min(ch, U.h - 32)); }
export { R, clamp, grid };

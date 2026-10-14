// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// Every screen has a builder here; render and hit-testing both read the same rects, so what is drawn is what is tapped.
//   play   portrait : header, the face, face tabs, a coach card when a hint is open, one row of four buttons
//          landscape: face on the left, one panel (status, face tabs, coach card, 2x2 buttons) on the right
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
    const hdrTop = U.y0 + 8, hdrH = 84, maxW = Math.min(U.w - 2 * m, 1500);
    const x0 = U.x0 + (U.w - maxW) / 2;
    const P = { F, m, maxW, x0 };
    P.titleX = Math.max(x0, back.w ? U.x0 + back.w + 4 : x0);
    P.header = R(x0, hdrTop, maxW, hdrH);
    P.textDec = R(U.x1 - m - 2 * 86 - 8, hdrTop + 3, 86, 78); P.textInc = R(U.x1 - m - 86, hdrTop + 3, 86, 78);
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
    const cols = P.body.w >= 1250 ? 2 : 1, gap = 12, rowH = Math.round(98 * (1 + (scale - 1) * 0.5)), cw = (P.body.w - gap * (cols - 1)) / cols;
    P.rows = []; P.cols = cols;
    for (let i = 0; i < nRows; i++) {
      const c = i % cols, r = Math.floor(i / cols), rect = R(P.body.x + c * (cw + gap), P.body.y + r * (rowH + gap), cw, rowH);
      const frac = cw < 800 ? ({ 0: 0.8, 2: 0.68, 4: 0.64 }[i] ?? 0.54) : 0.5, ctrlW = Math.min(cw * (scale > 1.6 ? Math.max(frac, 0.6) : frac), 560), ctrl = R(rect.x + rect.w - 14 - ctrlW, rect.y + 14, ctrlW, rect.h - 28);
      P.rows.push({ rect, ctrl });
    }
    P.contentH = Math.ceil(nRows / cols) * (rowH + gap);
    return P;
  });
}


// ---- the face -----------------------------------------------------------------------------------------------------------
// A face of the box: `lanes` grooves side by side, each holding one panel that slides `T` cells along it. Horizontal faces stack the
// grooves top to bottom and slide left-right; vertical faces put the grooves side by side and slide up-down. S is one cell (one step).
export const LANE_H = 1.08, LANE_GAP = 0.2, FACE_PAD = 0.62, PANEL_W = 2;
export function faceGeo(area, lanes, T, vertical, cap = 132) {
  const along = T + 2 * FACE_PAD, across = lanes * LANE_H + (lanes - 1) * LANE_GAP + 2 * FACE_PAD;
  const cw = vertical ? across : along, ch = vertical ? along : across;
  const S = Math.max(18, Math.min(area.w / cw, area.h / ch, cap));
  const bw = S * cw, bh = S * ch, bx = area.x + (area.w - bw) / 2, by = area.y + (area.h - bh) / 2;
  const ox = bx + FACE_PAD * S, oy = by + FACE_PAD * S;
  // groove rectangle of lane l for a panel with `steps` steps of travel; panel rectangle at (float) place p. T = longest groove on the face, in cells.
  const groove = (l, steps) => (vertical
    ? R(ox + l * (LANE_H + LANE_GAP) * S, oy, LANE_H * S, (steps + PANEL_W) * S)
    : R(ox, oy + l * (LANE_H + LANE_GAP) * S, (steps + PANEL_W) * S, LANE_H * S));
  const panel = (l, p, inset = 0.07) => (vertical
    ? R(ox + (l * (LANE_H + LANE_GAP) + inset) * S, oy + p * S, (LANE_H - 2 * inset) * S, PANEL_W * S)
    : R(ox + p * S, oy + (l * (LANE_H + LANE_GAP) + inset) * S, PANEL_W * S, (LANE_H - 2 * inset) * S));
  return { S, lanes, T, vertical, box: R(bx, by, bw, bh), ox, oy, groove, panel };
}

// ---- play ---------------------------------------------------------------------------------------------------------------------
// nFaces tabs; coach = a card is open (Think or Watch and Learn).
export function playLayout(w, h, lanes, T, vertical, nFaces, coach = false) {
  return memo(`play|${Math.round(w)}x${Math.round(h)}|${insKey()}|${lanes}x${T}${vertical ? 'v' : 'h'}|${nFaces}|${coach ? 1 : 0}`, () => {
    const F = frame(w, h), { U, back } = F, m = clamp(U.w * 0.025, 12, 26), L = { F, lanes, T, vertical, nFaces };
    const land = F.land && U.w >= U.h * 1.15;
    L.land = land;
    const tabH = 80;
    if (!land) {
      const hudX = U.x0 + m + (back.w ? back.w : 0), top = U.y0 + 6, cw = Math.min(U.w - 2 * m, 640), cx = U.x0 + (U.w - cw) / 2;
      L.hud = R(hudX, top, U.x1 - m - hudX, 92);
      const ctlH = 92, coachH = coach ? clamp(U.h * 0.2, 205, 250) : 0;
      const ctl = R(cx, U.y1 - m - ctlH, cw, ctlH);
      L.coachR = coach ? R(cx, ctl.y - 10 - coachH, cw, coachH) : null;
      const tabsY = (L.coachR ? L.coachR.y : ctl.y) - 8 - (nFaces > 1 ? tabH : 0);
      L.tabs = nFaces > 1 ? R(cx, tabsY, cw, tabH) : null;
      const aTop = L.hud.y + L.hud.h + 6, aBot = (L.tabs ? L.tabs.y : L.coachR ? L.coachR.y : ctl.y) - 10;
      L.area = R(U.x0 + m, aTop, U.w - 2 * m, Math.max(80, aBot - aTop));
      const cells = grid(ctl, 4, 1, 10);
      L.btns = { a: cells[0], b: cells[1], c: cells[2], d: cells[3] };
    } else {
      const pw = clamp(U.w * 0.34, 300, 540), px = U.x1 - m - pw;
      L.area = R(U.x0 + m, U.y0 + m, px - 2 * m - U.x0, U.h - 2 * m);
      const topPad = back.w && px < U.x0 + 120 ? back.h : 0;
      L.hud = R(px, U.y0 + m + topPad, pw, 128);
      const bh2 = 86, ctl = R(px, U.y1 - m - 2 * bh2 - 10, pw, 2 * bh2 + 10);
      const cells = grid(ctl, 2, 2, 10);
      L.btns = { a: cells[0], b: cells[1], c: cells[2], d: cells[3] };
      const cy = L.hud.y + L.hud.h + 46;   // the kit's preview pill sits in the gap above
      L.tabs = nFaces > 1 ? R(px, cy, pw, tabH) : null;
      const cy2 = cy + (L.tabs ? tabH + 10 : 0);
      L.coachR = R(px, cy2, pw, Math.max(60, ctl.y - 12 - cy2));
      L.panel = R(px - 10, U.y0 + m - 8, pw + 20, U.h - 2 * m + 16);
    }
    if (L.coachR) { const c = L.coachR, pad = 14, bh = 76, bw = (c.w - pad * 2 - 10) / 2, y = c.y + c.h - pad - bh; L.coachBtns = { close: R(c.x + pad, y, bw, bh), go: R(c.x + pad + bw + 10, y, bw, bh) }; }
    L.face = faceGeo(L.area, lanes, T, vertical);
    L.tabRects = [];
    if (L.tabs) { const g = 8, tw = (L.tabs.w - g * (nFaces - 1)) / nFaces; for (let i = 0; i < nFaces; i++) L.tabRects.push(R(L.tabs.x + i * (tw + g), L.tabs.y, tw, L.tabs.h)); }
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
    const pH = clamp(Math.min((col.h - 16 - 2 * 12) / (prim.length + 2) * 1.16, (col.h - 80) / 5.44), 54, 120), sH = clamp(pH * 0.72, 40, 92);
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

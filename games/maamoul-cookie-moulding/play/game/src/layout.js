// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// Render and hit-testing both read these rects, so what is drawn is what is tapped.
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.55 };   // safe areas + host back button (main.js keeps it current)

const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
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
  return { w, h, ins, U, back, land: w >= h * 1.0 };
}

// ---- play ---------------------------------------------------------------------------------------------------------------------------
// types: the mould buttons in order (+ 'hint' is always added). auto = Watch and Learn rail instead of the rack.
export function playLayout(w, h, { cols = 3, rows = 2, types = ['date', 'walnut'], auto = false } = {}) {
  return memo(`play|${Math.round(w)}x${Math.round(h)}|${insKey()}|${cols}x${rows}|${types.join('.')}|${auto ? 1 : 0}`, () => build(frame(w, h), cols, rows, types, auto));
}
function fitTray(box, cols, rows) {
  const pad = 20, c = Math.min((box.w - pad) / cols, (box.h - pad) / rows, 190);
  const tw = c * cols + pad, th = c * rows + pad;
  return R(box.x + (box.w - tw) / 2, box.y + (box.h - th) / 2, tw, th);
}
function build(F, cols, rows, types, auto) {
  const { U, back } = F, m = clamp(U.w * 0.022, 12, 24), gap = 10;
  const L = { F, w: F.w, h: F.h, U, m, types, back, rack: {} };
  const land = F.land && U.w >= U.h * 1.12;
  L.mode = land ? 'land' : 'portrait';
  const ids = [...types, 'hint'];
  const hudTop = U.y0 + 28, hudH = 72;
  const hb = U.x0 + (back.w ? back.w + 4 : 0);
  let rackR, benchR, bannerR, trayBox, ovenR;
  if (!land) {
    const cw = Math.min(U.w - 2 * m, 780), cx = U.x0 + (U.w - cw) / 2;
    L.pause = R(cx + cw - 66, hudTop + 2, 66, 66);
    const tx = Math.max(cx, hb);
    L.hud = R(tx, hudTop, L.pause.x - 12 - tx, hudH);
    L.badge = { x: L.pause.x - 10, y: L.pause.y + 8, align: 'right' };
    const rackH = clamp(U.h * 0.105, 92, 130), ovenH = clamp(U.h * 0.125, 108, 160);
    const trayLabelH = 30, trayH = clamp(U.h * 0.25, 170, 330);
    let y = hudTop + hudH + 2;
    L.trayLabel = R(cx, y, cw, trayLabelH); y += trayLabelH;
    trayBox = R(cx, y, cw, trayH); y += trayH + gap;
    ovenR = R(cx, y, cw, ovenH); y += ovenH + gap;
    rackR = R(cx, U.y1 - m - rackH, cw, rackH);
    bannerR = R(cx, y, cw, 64); y += 64 + 6;
    benchR = R(cx, y, cw, Math.max(150, rackR.y - gap - y));
  } else {
    const lw = clamp(U.w * 0.4, 360, 660), lx = U.x0 + m, rx = lx + lw + 16, rw = U.x1 - m - rx;
    L.pause = R(U.x1 - m - 66, hudTop + 2, 66, 66);
    L.hud = R(Math.max(lx, hb), hudTop, lx + lw - Math.max(lx, hb), hudH);
    L.badge = { x: L.pause.x - 10, y: L.pause.y + 8, align: 'right' };
    const ovenH = clamp(U.h * 0.2, 104, 170), trayLabelH = 30;
    const top = hudTop + hudH + 2;
    L.trayLabel = R(lx, top, lw, trayLabelH);
    ovenR = R(lx, U.y1 - m - ovenH, lw, ovenH);
    trayBox = R(lx, top + trayLabelH, lw, Math.max(100, ovenR.y - gap - top - trayLabelH));
    const rackH = clamp(U.h * 0.17, 88, 124);
    bannerR = R(rx, top - 4, rw - 0, 64);
    rackR = R(rx, U.y1 - m - rackH, rw - 76 + 76, rackH);
    L.pause = R(U.x1 - m - 66, hudTop + 2, 66, 66);
    benchR = R(rx, top + 64 + 2, rw, Math.max(120, rackR.y - gap - top - 66));
    bannerR.w = rw;
  }
  L.tray = fitTray(trayBox, cols, rows);
  L.trayBox = trayBox;
  L.banner = bannerR; L.bench = benchR; L.rackRect = rackR;
  // oven strip: window on the left, gauge + one big button on the right
  const ow = clamp(ovenR.h * 1.55, 130, ovenR.w * 0.46);
  L.oven = R(ovenR.x, ovenR.y, ow, ovenR.h);
  const rx0 = ovenR.x + ow + 12, rw0 = ovenR.x + ovenR.w - rx0, gaugeH = clamp(ovenR.h * 0.2, 20, 30);
  L.gauge = R(rx0, ovenR.y + 24 + (ovenR.h > 120 ? 6 : 0), rw0, gaugeH);
  L.ovenLabel = R(rx0, ovenR.y, rw0, 24);
  const btnY = L.gauge.y + gaugeH + 10;
  L.ovenBtn = R(rx0, btnY, rw0, Math.max(44, ovenR.y + ovenR.h - btnY));
  // bench geometry
  const bx = benchR.x + benchR.w / 2, by = benchR.y + benchR.h * 0.5, Rr = Math.max(40, Math.min(benchR.w * 0.31, benchR.h * 0.36));
  L.dough = { cx: bx, cy: by, R: Rr };
  // rack buttons (mould choice + Think)
  const n = ids.length, bw = (rackR.w - gap * (n - 1)) / n;
  ids.forEach((id, i) => { L.rack[id] = R(rackR.x + i * (bw + gap), rackR.y, bw, rackR.h); });
  L.ids = ids;
  // Watch and Learn rail (replaces the rack): exit, pause, think -, think +
  const g = 8, bw4 = (rackR.w - 3 * g) / 4;
  L.rail = { exit: R(rackR.x, rackR.y, bw4, rackR.h), pause: R(rackR.x + bw4 + g, rackR.y, bw4, rackR.h), dec: R(rackR.x + 2 * (bw4 + g), rackR.y, bw4, rackR.h), inc: R(rackR.x + 3 * (bw4 + g), rackR.y, bw4, rackR.h) };
  void auto;
  return L;
}

// ---- title --------------------------------------------------------------------------------------------------------------------------
export function titleLayout(w, h) {
  return memo(`title|${Math.round(w)}x${Math.round(h)}|${insKey()}`, () => {
    const F = frame(w, h), { U } = F, m = 18;
    const T = { F, buttons: {} };
    const prim = ['journey', 'rush', 'daily', 'learn'], sec = ['howto', 'rules', 'book', 'about', 'settings', 'share'];
    let col;
    if (F.land && U.w > 760) {
      const cw = clamp(U.w * 0.42, 420, 640), cx = U.x1 - cw - m * 1.5;
      T.hero = R(U.x0 + m, U.y0 + m, cx - U.x0 - 2 * m, U.h - 2 * m - 50);
      col = R(cx, U.y0 + m, cw, U.h - 2 * m - 50);
      T.brand = { x: U.x0 + (cx - U.x0) / 2, y: U.y1 - 22 };
    } else {
      const cw = Math.min(U.w - 2 * m, 640), top = U.y0 + 6;
      const need = prim.length * 90 + 16 + 3 * 60 + 20 + 60;
      const heroH = clamp(U.h - need - 60, 220, 640);
      T.hero = R(U.x0 + m, top + (F.ins.back ? 40 : 0), U.w - 2 * m, heroH - (F.ins.back ? 40 : 0));
      col = R(U.x0 + (U.w - cw) / 2, top + heroH, cw, U.h - heroH - 60);
      T.brand = { x: U.x0 + U.w / 2, y: U.y1 - 22 };
    }
    const sH = clamp(col.h * 0.065, 42, 76), avail = col.h - 16 - 3 * (sH + 10);
    const pH = clamp(avail / prim.length - 12, 54, 118);
    let y = col.y + Math.max(0, (col.h - (prim.length * (pH + 12) + 16 + 3 * (sH + 10))) / 2);
    prim.forEach((id) => { T.buttons[id] = R(col.x, y, col.w, pH); y += pH + 12; });
    y += 4;
    const cw2 = (col.w - 10) / 2;
    sec.forEach((id, i) => { T.buttons[id] = R(col.x + (i % 2) * (cw2 + 10), y + Math.floor(i / 2) * (sH + 10), cw2, sH); });
    T.subs = pH >= 70;
    return T;
  });
}

// ---- generic header + scrolling body used by the text and list screens --------------------------------------------------------------
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
    if (P.split) { const lw = clamp(P.body.w * 0.4, 340, 640); P.fig = R(P.body.x, P.body.y, lw, P.body.h); P.text = R(P.body.x + lw + 20, P.body.y, P.body.w - lw - 20, P.body.h); }
    else { P.fig = null; P.text = P.body; }
    return P;
  });
}
export function settingsLayout(w, h, scale, nRows) {
  return memo(`set|${Math.round(w)}x${Math.round(h)}|${insKey()}|${scale}|${nRows}`, () => {
    const P = { ...pageLayout(w, h, { footer: 1 }) };
    const f = P.footer; P.back = R(f.x + f.w / 2 - 160, f.y, 320, f.h);
    const stacked = scale > 1.25 || P.body.w < 800, cols = P.body.w >= 1250 && !stacked ? 2 : 1, gap = 12, rowH = stacked ? Math.round(166 + 44 * scale) : 116, cw = (P.body.w - gap * (cols - 1)) / cols;
    P.rows = []; P.cols = cols; P.stacked = stacked;
    for (let i = 0; i < nRows; i++) {
      const c = i % cols, r = Math.floor(i / cols), rect = R(P.body.x + c * (cw + gap), P.body.y + r * (rowH + gap), cw, rowH);
      let ctrl;
      if (stacked) ctrl = R(rect.x + 14, rect.y + rect.h - 82, rect.w - 28, 68);
      else { const frac = cw < 800 ? 0.62 : 0.5, ctrlW = Math.min(cw * frac, 560); ctrl = R(rect.x + rect.w - 14 - ctrlW, rect.y + 14, ctrlW, rect.h - 28); }
      P.rows.push({ rect, ctrl, stacked });
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
// Shift map: content-space rects for the bakeries and their shifts (hit-testing adds the scroll offset).
export function shiftRects(body, scale = 1) {
  const sc = Math.min(scale, 1.6), per = Math.max(3, Math.floor((body.w + 10) / (122 * sc + 10))), ls = Math.min(168, (body.w - 10 * (per - 1)) / per);
  const items = []; let y = body.y;
  for (let ci = 0; ci < 3; ci++) {
    const head = R(body.x, y, body.w, 96 * sc); y += head.h + 6;
    const lv = [];
    for (let i = 0; i < 6; i++) lv.push(R(body.x + (i % per) * (ls + 10), y + Math.floor(i / per) * (ls * 0.9 + 10), ls, ls * 0.9));
    y += Math.ceil(6 / per) * (ls * 0.9 + 10) + 16;
    items.push({ head, lv, ci });
  }
  return { items, contentH: y - body.y };
}

// ---- result / overlays -----------------------------------------------------------------------------------------------------------------
export function overLayout(w, h) {
  return memo(`over|${Math.round(w)}x${Math.round(h)}|${insKey()}`, () => {
    const F = frame(w, h), { U } = F, m = 18, O = { F };
    const wide = F.land && U.w > U.h * 1.05, bh = wide ? 66 : 74;
    O.wide = wide;
    if (wide) {
      const half = Math.min(U.w * 0.44, 640);
      O.art = R(U.x0 + m, U.y0 + m, half, U.h - 2 * m);
      const cx = O.art.x + O.art.w + 30, cw = U.x1 - m - cx, by = U.y1 - m - 2 * (bh + 12) - 24;
      O.btns = { next: R(cx, by, cw, bh), share: R(cx, by + bh + 12, cw / 2 - 6, bh), menu: R(cx + cw / 2 + 6, by + bh + 12, cw / 2 - 6, bh) };
      O.body = R(cx, U.y0 + m, cw, by - 14 - U.y0 - m);
    } else {
      const cw = Math.min(U.w - 2 * m, 700), cx = U.x0 + (U.w - cw) / 2;
      const by = U.y1 - m - 2 * (bh + 12) - 12;
      const artH = clamp((by - U.y0) * 0.36, 170, 460);
      O.art = R(U.x0 + m, U.y0 + 14 + (F.ins.back ? 44 : 0), U.w - 2 * m, artH);
      O.btns = { next: R(cx, by, cw, bh), share: R(cx, by + bh + 12, cw / 2 - 6, bh), menu: R(cx + cw / 2 + 6, by + bh + 12, cw / 2 - 6, bh) };
      O.body = R(cx, O.art.y + O.art.h + 10, cw, by - 12 - (O.art.y + O.art.h + 10));
    }
    return O;
  });
}
export function pauseLayout(w, h, area) {
  const b = area, cw = Math.min(b.w - 30, 520), nb = 4, bh = Math.max(44, Math.min(78, (b.h - 24 - 80) / nb - 12)), ch = nb * (bh + 12) + 80;
  const card = R(b.x + (b.w - cw) / 2, b.y + Math.max(0, (b.h - ch) / 2), cw, ch);
  return { card, resume: R(card.x + 16, card.y + 70, cw - 32, bh), restart: R(card.x + 16, card.y + 70 + bh + 12, cw - 32, bh), settings: R(card.x + 16, card.y + 70 + 2 * (bh + 12), cw - 32, bh), menu: R(card.x + 16, card.y + 70 + 3 * (bh + 12), cw - 32, bh) };
}
export function centerCard(w, h, cw, ch) { const F = frame(w, h), { U } = F; return R(U.x0 + (U.w - Math.min(cw, U.w - 32)) / 2, U.y0 + (U.h - Math.min(ch, U.h - 32)) / 2, Math.min(cw, U.w - 32), Math.min(ch, U.h - 32)); }
export { R, clamp };

// Pattern Book: content-space rects. Three groups (one per cookie type), three tiles each.
export function bookRects(body, scale = 1) {
  const sc = Math.min(scale, 1.6), per = body.w >= 520 * Math.min(1, 1 / Math.max(1, sc * 0.7)) ? 3 : body.w >= 340 ? 2 : 1;
  const ts = Math.min(260 * Math.max(1, sc * 0.8), (body.w - 12 * (per - 1)) / per);
  const items = []; let y = body.y;
  for (let ti = 0; ti < 3; ti++) {
    const head = R(body.x, y, body.w, 64 * sc); y += head.h + 6;
    const tiles = [];
    for (let i = 0; i < 3; i++) tiles.push(R(body.x + (i % per) * (ts + 12), y + Math.floor(i / per) * (ts * 1.18 + 12), ts, ts * 1.18));
    y += Math.ceil(3 / per) * (ts * 1.18 + 12) + 14;
    items.push({ head, tiles, ti });
  }
  return { items, contentH: y - body.y };
}

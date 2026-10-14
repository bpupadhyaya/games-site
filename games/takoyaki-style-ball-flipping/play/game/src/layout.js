// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// Render and hit-testing both read these rects, so what is drawn is what is tapped.
import { v3 } from './v3.js';
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

// ---- the plate ---------------------------------------------------------------------------------------------------------------------
export function plateGeo(area, cols, rows, live = false) {
  if (live && v3.on && v3.scene === 'play' && v3.cells && v3.cellsFor === `${cols}x${rows}`) {
    // 3D pan: the moulds sit where the perspective camera projects them; hit-testing uses the same centres
    const cells = v3.cells, c = cells[0].c, rect = R(area.x, area.y, area.w, area.h);
    const cell = (i) => cells[i];
    const at = (x, y) => {
      let best = -1, bd = 1e12;
      for (let i = 0; i < cells.length; i++) {
        const k = cells[i], dx = (x - k.cx) / (k.c * 0.52), dy = (y - k.cy) / (k.c * 0.5 * k.ky), d = dx * dx + dy * dy;
        if (d <= 1 && d < bd) { bd = d; best = i; }
      }
      return best;
    };
    return { rect, c, cell, at, cols, rows };
  }
  const pad = 14, c = Math.max(40, Math.min((area.w - 2 * pad) / cols, (area.h - 2 * pad) / rows, 230));
  const w = cols * c + 2 * pad, h = rows * c + 2 * pad;
  const rect = R(area.x + (area.w - w) / 2, area.y + (area.h - h) / 2, w, h);
  const cell = (i) => { const col = i % cols, row = Math.floor(i / cols); return { cx: rect.x + pad + (col + 0.5) * c, cy: rect.y + pad + (row + 0.5) * c, r: c * 0.4, c }; };
  const at = (x, y) => {
    const col = Math.floor((x - rect.x - pad) / c), row = Math.floor((y - rect.y - pad) / c);
    return col < 0 || row < 0 || col >= cols || row >= rows ? -1 : row * cols + col;
  };
  return { rect, c, cell, at, cols, rows };
}

// ---- play ---------------------------------------------------------------------------------------------------------------------------
// ids: the tool buttons in order. auto = Watch and Learn rail instead of the tools.
export function playLayout(w, h, { ids = ['ladle', 'picks', 'flame', 'hint'], auto = false } = {}) {
  return memo(`play|${Math.round(w)}x${Math.round(h)}|${insKey()}|${ids.join('.')}|${auto ? 1 : 0}`, () => build(frame(w, h), ids, auto));
}
function build(F, ids, auto) {
  const { U, back } = F, m = clamp(U.w * 0.022, 12, 24), gap = 10;
  const L = { F, w: F.w, h: F.h, U, m, ids, back, tools: {}, tickets: [] };
  const land = F.land && U.w >= U.h * 1.12;
  L.mode = land ? 'land' : 'portrait';
  if (!land) {
    const cw = Math.min(U.w - 2 * m, 760), cx = U.x0 + (U.w - cw) / 2, hudTop = U.y0 + 30, hudH = 74;
    const hb = U.x0 + (back.w ? back.w + 4 : 0);
    L.pause = R(cx + cw - 66, hudTop + 4, 66, 66);
    const tx = Math.max(cx, hb);
    L.hud = { title: R(tx, hudTop, L.pause.x - 12 - tx, hudH) };
    L.badge = { x: L.pause.x - 10, y: L.pause.y + 8, align: 'right' };
    // tall screens: the plate is width-limited, so hand the spare height to the tickets, the tray and the tools instead of empty bands
    const slack = Math.max(0, U.h - 1300), up = (k, cap) => Math.min(cap, slack * k);
    const tH = clamp(U.h * 0.125, 118, 170) + up(0.28, 70), ty = hudTop + hudH + 2;
    const tw = (cw - 2 * gap) / 3;
    for (let i = 0; i < 3; i++) L.tickets.push(R(cx + i * (tw + gap), ty, tw, tH));
    L.ticketMode = 'card';
    const bannerH = 70, toolsH = (auto ? clamp(U.h * 0.11, 96, 128) : ids.length > 5 ? 192 : 104) + up(0.2, 50), trayH = 76 + up(0.14, 34);
    const toolsY = U.y1 - m - toolsH;
    L.tray = R(cx, toolsY - gap - trayH, cw, trayH);
    L.banner = R(cx, ty + tH + 8, cw, bannerH);
    const ay = L.banner.y + bannerH + 6;
    L.area = R(U.x0 + m, ay, U.w - 2 * m, Math.max(120, L.tray.y - 8 - ay));
    L.toolsRect = R(cx, toolsY, cw, toolsH);
    L.coach = auto ? R(cx, L.banner.y, cw, bannerH) : null;
    layoutTools(L, ids, L.toolsRect, false, gap);
  } else {
    const pw = clamp(U.w * 0.37, 340, 540), px = U.x1 - m - pw, top = U.y0 + 28;
    L.area = R(U.x0 + m, top, px - U.x0 - 2 * m, U.h - 6 - m);
    const hb = U.x0 + (back.w ? back.w + 4 : 0);
    void hb;
    L.pause = R(px + pw - 66, top + 2, 66, 66);
    L.hud = { title: R(px, top, pw - 76, 70) };
    L.badge = { x: px + pw - 76, y: top + 8, align: 'right' };
    const tH = clamp((U.h - 70 - 76 - 3 * 66 - 70 - 56) / 3, 78, 120);
    let y = top + 72;
    for (let i = 0; i < 3; i++) { L.tickets.push(R(px, y, pw, tH)); y += tH + 8; }
    L.ticketMode = 'row';
    L.tray = R(px, y, pw, 70); y += 78;
    const toolsH = U.y1 - m - y;
    L.toolsRect = R(px, y, pw, toolsH);
    L.banner = R(L.area.x, L.area.y + L.area.h - 64, L.area.w, 64);
    L.area = R(L.area.x, L.area.y, L.area.w, L.area.h - 70);
    L.coach = auto ? R(px, y, pw, toolsH) : null;
    layoutTools(L, ids, L.toolsRect, true, gap);
  }
  // Watch and Learn rail (replaces the tools): exit, pause, think -, think +
  const t = L.toolsRect, g = 8;
  if (land) {
    const bh = Math.min(64, (t.h - 3 * g) / 4), by = t.y + t.h - 4 * bh - 3 * g;
    L.rail = { exit: R(t.x, by, t.w, bh), pause: R(t.x, by + bh + g, t.w, bh), dec: R(t.x, by + 2 * (bh + g), t.w / 2 - 4, bh), inc: R(t.x + t.w / 2 + 4, by + 2 * (bh + g), t.w / 2 - 4, bh) };
    L.railInfo = R(t.x, t.y, t.w, Math.max(10, by - t.y - g));
  } else {
    const bw = (t.w - 3 * g) / 4;
    L.rail = { exit: R(t.x, t.y, bw, t.h), pause: R(t.x + bw + g, t.y, bw, t.h), dec: R(t.x + 2 * (bw + g), t.y, bw, t.h), inc: R(t.x + 3 * (bw + g), t.y, bw, t.h) };
    L.railInfo = null;
  }
  return L;
}
function layoutTools(L, ids, r, stacked, gap) {
  const n = ids.length;
  if (!stacked) {
    // more than five tools: two rows, so every button stays wide enough for a thumb (44+ css px) on a small phone
    const rows = n > 5 ? 2 : 1, per = Math.ceil(n / rows), bh = (r.h - gap * (rows - 1)) / rows;
    ids.forEach((id, i) => {
      const row = Math.floor(i / per), inRow = Math.min(per, n - row * per), k = i - row * per, bw = (r.w - gap * (inRow - 1)) / inRow;
      L.tools[id] = R(r.x + k * (bw + gap), r.y + row * (bh + gap), bw, bh);
    });
  } else {
    const cols = 3, rows = Math.ceil(n / cols), bh = Math.min(88, (r.h - gap * (rows - 1)) / rows), bw = (r.w - gap * (cols - 1)) / cols;
    ids.forEach((id, i) => { L.tools[id] = R(r.x + (i % cols) * (bw + gap), r.y + Math.floor(i / cols) * (bh + gap), bw, bh); });
  }
}

// ---- title --------------------------------------------------------------------------------------------------------------------------
export function titleLayout(w, h) {
  return memo(`title|${Math.round(w)}x${Math.round(h)}|${insKey()}`, () => {
    const F = frame(w, h), { U } = F, m = 18;
    const T = { F, buttons: {} };
    const prim = ['journey', 'rush', 'daily', 'learn'], sec = ['howto', 'rules', 'about', 'settings'];
    let col;
    if (F.land && U.w > 760) {
      const cw = clamp(U.w * 0.42, 420, 640), cx = U.x1 - cw - m * 1.5;
      T.hero = R(U.x0 + m, U.y0 + m, cx - U.x0 - 2 * m, U.h - 2 * m - 50);
      col = R(cx, U.y0 + m, cw, U.h - 2 * m - 50);
      T.brand = { x: U.x0 + (cx - U.x0) / 2, y: U.y1 - 22 };
    } else {
      const cw = Math.min(U.w - 2 * m, 640), top = U.y0 + 6;
      const need = prim.length * 90 + 16 + 2 * 66 + 10 + 60;
      const heroH = clamp(Math.max(U.h - need - 60, U.h * 0.45), 220, 640);
      T.hero = R(U.x0 + m, top + (F.ins.back ? 40 : 0), U.w - 2 * m, heroH - (F.ins.back ? 40 : 0));
      col = R(U.x0 + (U.w - cw) / 2, top + heroH, cw, U.h - heroH - 60);
      T.brand = { x: U.x0 + U.w / 2, y: U.y1 - 22 };
    }
    const sH = clamp(col.h * 0.08, 46, 84), avail = col.h - 16 - 2 * (sH + 10);
    const pH = clamp(avail / prim.length - 12, 54, 118);
    let y = col.y + Math.max(0, (col.h - (prim.length * (pH + 12) + 16 + 2 * (sH + 10))) / 2);
    prim.forEach((id) => { T.buttons[id] = R(col.x, y, col.w, pH); y += pH + 12; });
    y += 4;
    const cw2 = (col.w - 10) / 2;
    sec.forEach((id, i) => { T.buttons[id] = R(col.x + (i % 2) * (cw2 + 10), y + Math.floor(i / 2) * (sH + 10), cw2, sH); });
    T.subs = pH >= 70;
    return T;
  });
}

// Title art geometry (shared by the 2D lettering and the 3D hero camera): lettering baseline, hero rect for the pan, sign-board rect.
export function titleArt(w, h) {
  return memo(`tart|${Math.round(w)}x${Math.round(h)}|${insKey()}`, () => {
    const T0 = titleLayout(w, h), H = T0.hero, cx = H.x + H.w / 2, big = clamp(Math.min(H.w * 0.2, H.h * 0.26), 56, 150);
    const ty = H.y + big * 0.62 + (host.back ? 6 : 0) + 22, plateTop = ty + big * 0.62 + big * 0.36;
    const hero = R(H.x, plateTop, H.w, Math.max(80, H.y + H.h - plateTop));
    const sw = Math.min(H.w, big * 8.4);
    const sign = R(cx - sw / 2, ty - big * 0.62, sw, big * 1.74);
    return { H, cx, big, ty, plateTop, hero, sign };
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
    const cols = P.body.w >= 1250 && scale <= 1.25 ? 2 : 1, gap = 12, cw = (P.body.w - gap * (cols - 1)) / cols;
    const stacked = scale > 1.25 || cw < 760, rowH = stacked ? Math.round(150 + 44 * scale) : 98;   // narrow rows stack the description above the controls: nothing overlaps
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
// Shift map: content-space rects for the stalls and their shifts (hit-testing adds the scroll offset).
export function shiftRects(body, scale = 1, heads = null) {
  const sc = Math.min(scale, 1.6), per = Math.max(3, Math.floor((body.w + 10) / (122 * sc + 10))), ls = Math.min(168, (body.w - 10 * (per - 1)) / per);
  const items = []; let y = body.y;
  for (let ci = 0; ci < 3; ci++) {
    const head = R(body.x, y, body.w, Math.max(96 * sc, heads ? heads[ci] || 0 : 0)); y += head.h + 6;
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
      const artH = clamp((by - U.y0) * 0.36 + Math.max(0, (by - U.y0 - 900) * 0.2), 170, 600);
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

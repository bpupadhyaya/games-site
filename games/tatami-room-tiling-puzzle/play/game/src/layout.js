import { v3, live } from './v3.js';
// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// Every screen has a builder here; render and hit-testing both read the same rects, so what is drawn is what is tapped.
//   play   portrait : header, the room (as large as fits), then one tray row (mats, turn, undo, redo, hint)
//          landscape: the room on the left, one side panel (info, tray; the hint card takes over the tray)
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

// ---- the room ------------------------------------------------------------------------------------------------------------------
// Cells are squares of side s; walls sit just outside the cells, so the area the room needs is (cols + 2k) x (rows + 2k) cells.
export function roomGeo(area, cols, rows) {
  const k = 0.34;
  const s = Math.max(10, Math.min((area.w) / (cols + 2 * k), (area.h) / (rows + 2 * k), 170));
  const w = cols * s, h = rows * s, x = area.x + (area.w - w) / 2, y = area.y + (area.h - h) / 2;
  const geo = { x, y, w, h, s, cols, rows, area, rect: R(x, y, w, h), cell: (i) => R(x + (i % cols) * s, y + Math.floor(i / cols) * s, s, s) };
  // Screen point -> cell index. While the 3D room is on screen the point is unprojected onto the mat plane (the room is in perspective).
  geo.at = (px, py) => {
    let c, r;
    if (live(geo) && v3.unproj) {
      const g = v3.unproj(px, py);
      if (!g) return -1;
      c = Math.floor(g.gx); r = Math.floor(g.gy);
    } else { c = Math.floor((px - x) / s); r = Math.floor((py - y) / s); }
    return c >= 0 && r >= 0 && c < cols && r < rows ? r * cols + c : -1;
  };
  return geo;
}

// ---- play --------------------------------------------------------------------------------------------------------------------
export function playLayout(w, h, { coach = false, cols = 6, rows = 5 } = {}) {
  return memo(`play|${Math.round(w)}x${Math.round(h)}|${insKey()}|${coach ? 1 : 0}|${cols}x${rows}`, () => buildPlay(frame(w, h), coach, cols, rows));
}
function buildPlay(F, coach, cols, rows) {
  const { U, back } = F, m = clamp(U.w * 0.02, 12, 26), gap = 10;
  const L = { F, w: F.w, h: F.h, U, m, back };
  const portrait = !(F.land && U.w >= U.h * 1.08);
  L.mode = portrait ? 'portrait' : 'land';
  let coachR, trayR;
  if (portrait) {
    const hudH = 88, hudTop = U.y0 + 6, hb = U.x0 + (back.w ? back.w + 4 : 0);
    const cw = Math.min(U.w - 2 * m, 760), cx = U.x0 + (U.w - cw) / 2;
    const trayH = clamp(U.h * 0.17, 150, 214), coachH = clamp(U.h * 0.34, 300, 520);
    const ctlH = coach ? coachH : trayH, ctlTop = U.y1 - m - ctlH;
    L.hud = { title: R(Math.max(U.x0 + m, hb), hudTop, cw * 0.46, hudH), timer: { x: U.x0 + U.w / 2 - 30, y: hudTop + 62 }, pause: R(U.x1 - m - 66, hudTop + 10, 66, 66), supply: { x: U.x1 - m - 66 - 18, y: hudTop + 62 } };
    L.pause = L.hud.pause;
    L.board = roomGeo(R(U.x0 + m, hudTop + hudH + 4, U.w - 2 * m, ctlTop - 8 - (hudTop + hudH + 4)), cols, rows);
    coachR = R(cx, ctlTop, cw, ctlH); trayR = coachR;
  } else {
    const pw = clamp(U.w * 0.36, 340, 600);
    const panel = R(U.x1 - m - pw, U.y0 + m, pw, U.h - 2 * m);
    L.info = panel;
    L.board = roomGeo(R(U.x0 + m, U.y0 + m, U.w - pw - 3 * m, U.h - 2 * m), cols, rows);
    const edgeLeft = panel.x <= U.x0 + 60, topPad = back.w && edgeLeft ? Math.max(14, back.y + back.h - panel.y + 4) : 14;
    const top = panel.y + topPad;
    L.pause = R(panel.x + panel.w - 14 - 62, top, 62, 62);
    L.hud = { title: R(panel.x + 18, top, panel.w - 110, 80), timer: { x: panel.x + panel.w / 2, y: top + 162 }, supply: { x: panel.x + panel.w / 2, y: top + 214 } };   // the preview pill sits on the row between the title and the timer
    const ctlTop = top + 240;
    trayR = R(panel.x + 12, ctlTop, panel.w - 24, panel.y + panel.h - 12 - ctlTop);
    coachR = trayR;
  }
  L.tray = trayR;
  // tray: two mat tiles, then four tools
  const t = trayR;
  if (portrait) {
    const units = [1.7, 1.25, 1, 1, 1, 1], tot = units.reduce((a, b) => a + b, 0), uw = (t.w - gap * 5) / tot, hgt = Math.min(t.h, 150);
    let x = t.x;
    const rs = units.map((u) => { const r = R(x, t.y + (t.h - hgt) / 2, u * uw, hgt); x += u * uw + gap; return r; });
    L.tools = { full: rs[0], half: rs[1], turn: rs[2], undo: rs[3], redo: rs[4], hint: rs[5] };
  } else {
    const mh = clamp(t.h * 0.26, 110, 170), th = clamp((t.h - mh - 3 * gap) / 2, 70, 110);
    const hw = (t.w - gap) / 2, tw = (t.w - gap) / 2;
    L.tools = {
      full: R(t.x, t.y, hw, mh), half: R(t.x + hw + gap, t.y, hw, mh),
      turn: R(t.x, t.y + mh + gap, tw, th), hint: R(t.x + tw + gap, t.y + mh + gap, tw, th),
      undo: R(t.x, t.y + mh + th + 2 * gap, tw, th), redo: R(t.x + tw + gap, t.y + mh + th + 2 * gap, tw, th),
    };
  }
  // hint card / Watch and Learn rail inside the same area
  const C = coachR, bh = 64, ip = 12;
  L.coachR = C;
  L.coachBtns = { close: R(C.x + ip, C.y + C.h - bh - ip, C.w / 2 - ip - 6, bh), go: R(C.x + C.w / 2 + 6, C.y + C.h - bh - ip, C.w / 2 - ip - 6, bh) };
  const wide = C.w >= 560, rh = wide ? bh : bh * 2 + 10;
  const rail = grid(R(C.x + ip, C.y + C.h - rh - ip, C.w - 2 * ip, rh), wide ? 4 : 2, wide ? 1 : 2, 10);
  L.rail = { exit: rail[0], pause: rail[1], dec: rail[2], inc: rail[3] };
  L.coachText = R(C.x, C.y, C.w, C.h - Math.max(bh, rh) - 12 - ip);
  return L;
}

// ---- title -----------------------------------------------------------------------------------------------------------------------
export function titleLayout(w, h, hasSave) {
  return memo(`title|${Math.round(w)}x${Math.round(h)}|${insKey()}|${hasSave ? 1 : 0}`, () => {
    const F = frame(w, h), { U } = F, m = 18;
    const T = { F, buttons: {} };
    const prim = (hasSave ? ['continue'] : []).concat(['new', 'daily']), sec = ['learn', 'howto', 'rules', 'stats', 'settings', 'about'];
    let col;
    if (F.land && U.w > 760) {
      const cw = clamp(U.w * 0.42, 420, 640), cx = U.x1 - cw - m * 1.5;
      T.hero = R(U.x0 + m, U.y0 + m, cx - U.x0 - 2 * m, U.h - 2 * m - 70);
      col = R(cx, U.y0 + m, cw, U.h - 2 * m - 60);
      T.brand = { x: U.x0 + (cx - U.x0) / 2, y: U.y1 - 26 }; T.landscape = true;
    } else {
      const cw = Math.min(U.w - 2 * m, 640), top = U.y0 + 18;
      const need = prim.length * 96 + 16 + 3 * 74 + 10 + 80;
      const heroH = clamp(U.h - need - 70, 200, 640);
      T.hero = R(U.x0 + m, top + (F.ins.back ? 40 : 0), U.w - 2 * m, heroH - (F.ins.back ? 40 : 0));
      col = R(U.x0 + (U.w - cw) / 2, top + heroH, cw, U.h - heroH - 70);
      T.brand = { x: U.x0 + U.w / 2, y: U.y1 - 26 };
    }
    const pH = clamp((col.h - 16 - 3 * 12) / (prim.length + 3) * 1.18, 70, 132), sH = clamp(pH * 0.74, 54, 100);
    let y = col.y + Math.max(0, (col.h - (prim.length * (pH + 12) + 16 + 3 * (sH + 10))) / 2);
    prim.forEach((id) => { T.buttons[id] = R(col.x, y, col.w, pH); y += pH + 12; });
    y += 4;
    const g = grid(R(col.x, y, col.w, 3 * sH + 20), 2, 3, 10);
    sec.forEach((id, i) => { T.buttons[id] = g[i]; });
    return T;
  });
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
export function newLayout(w, h, nCards) {
  return memo(`new|${Math.round(w)}x${Math.round(h)}|${insKey()}|${nCards}`, () => {
    const P = { ...pageLayout(w, h, { footer: 1 }) };
    const f = P.footer; P.back = R(f.x + f.w / 2 - 160, f.y, 320, f.h);
    const cols = P.body.w >= 1500 ? 3 : P.body.w >= 780 ? 2 : 1, gap = 12, cw = (P.body.w - gap * (cols - 1)) / cols, rows = Math.ceil(nCards / cols), ch = clamp((P.body.h - gap * (rows - 1)) / rows, cols === 1 ? 128 : 140, 200);
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
export function overLayout(w, h, scale = 1, cols = 6, rows = 5) {
  return memo(`over|${Math.round(w)}x${Math.round(h)}|${insKey()}|${scale}|${cols}x${rows}`, () => {
    const F = frame(w, h), { U } = F, m = 18, O = { F };
    const wide = F.land && U.w > U.h * 1.05, bh = wide ? 66 : 76;
    O.wide = wide;
    if (wide) {
      const aw = Math.min(U.w * 0.5, U.w - 460), area = R(U.x0 + m, U.y0 + m, aw - m, U.h - 2 * m);
      O.room = roomGeo(area, cols, rows);
      const cx = U.x0 + aw + m, cw = U.x1 - m - cx, by = U.y1 - m - 2 * (bh + 12) - 24;
      O.btns = { next: R(cx, by, cw, bh), share: R(cx, by + bh + 12, cw / 2 - 6, bh), menu: R(cx + cw / 2 + 6, by + bh + 12, cw / 2 - 6, bh) };
      O.body = R(cx, U.y0 + m, cw, by - 14 - U.y0 - m);
      O.more = { x: cx + cw / 2, y: U.y1 - 8 };
    } else {
      const cw = Math.min(U.w - 2 * m, 700), cx = U.x0 + (U.w - cw) / 2;
      const rh = clamp(U.h * 0.34 * (scale <= 1 ? 1 : scale <= 1.5 ? 0.82 : scale <= 2 ? 0.62 : 0.44), 110, 560);
      O.room = roomGeo(R(U.x0 + m, U.y0 + 14 + (F.ins.back ? 44 : 0), U.w - 2 * m, rh), cols, rows);
      const by = U.y1 - m - 2 * (bh + 12) - 36;
      O.btns = { next: R(cx, by, cw, bh), share: R(cx, by + bh + 12, cw / 2 - 6, bh), menu: R(cx + cw / 2 + 6, by + bh + 12, cw / 2 - 6, bh) };
      const top = O.room.area.y + O.room.area.h + 10;
      O.body = R(cx, top, cw, by - 12 - top);
      O.more = { x: U.x0 + U.w / 2, y: U.y1 - 8 };
    }
    return O;
  });
}

// ---- small overlays -----------------------------------------------------------------------------------------------------------------
export function pauseLayout(w, h, b) {
  const cw = Math.min(Math.max(b.w, 300) - 20, 520), n = 4, bh = Math.max(46, Math.min(74, (Math.max(b.h, 340) - 24 - 80) / n - 12)), ch = n * (bh + 12) + 80;
  const cx = b.area.x + b.area.w / 2, cy = b.area.y + b.area.h / 2;
  const card = R(cx - cw / 2, cy - ch / 2, cw, ch);
  return { card, resume: R(card.x + 16, card.y + 70, cw - 32, bh), restart: R(card.x + 16, card.y + 70 + bh + 12, cw - 32, bh), settings: R(card.x + 16, card.y + 70 + 2 * (bh + 12), cw - 32, bh), menu: R(card.x + 16, card.y + 70 + 3 * (bh + 12), cw - 32, bh) };
}
export function centerCard(w, h, cw, ch) { const F = frame(w, h), { U } = F; return R(U.x0 + (U.w - Math.min(cw, U.w - 32)) / 2, U.y0 + (U.h - Math.min(ch, U.h - 32)) / 2, Math.min(cw, U.w - 32), Math.min(ch, U.h - 32)); }
export { R, clamp, grid };

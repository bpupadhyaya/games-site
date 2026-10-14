// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// Render and hit-testing both read these rects, so what is drawn is what is tapped.
//   play   portrait : header, order slip, the balance scene, the weight tray, then Pour and a tool row
//          landscape: balance scene on one side, one panel with the order, the tray and the tools on the other (side follows the hand setting)
//   A hint card or the Watch and Learn rail takes over the tools area (the tray stays visible so hints can point at the weights).
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

// ---- play --------------------------------------------------------------------------------------------------------------------
// Tray slots for N items (weights, then the bag): the column count that makes the biggest slots fit.
export function trayGrid(area, N, gap) {
  let best = null;
  for (let cols = Math.min(N, 2); cols <= Math.min(N, 8); cols++) {
    const rows = Math.ceil(N / cols), s = Math.min((area.w - gap * (cols - 1)) / cols, ((area.h - gap * (rows - 1)) / rows) / 1.18, 130);
    if (s > 0 && (!best || s > best.s + 0.5)) best = { cols, rows, s };
  }
  if (!best) best = { cols: Math.min(N, 4), rows: Math.ceil(N / 4), s: 40 };
  const sh = best.s * 1.18, w = best.cols * best.s + (best.cols - 1) * gap, h = best.rows * sh + (best.rows - 1) * gap;
  const x0 = area.x + (area.w - w) / 2, y0 = area.y + Math.max(0, (area.h - h) / 2);
  const slots = Array.from({ length: N }, (_, i) => R(x0 + (i % best.cols) * (best.s + gap), y0 + Math.floor(i / best.cols) * (sh + gap), best.s, sh));
  return { slots, rect: R(x0, y0, w, h), s: best.s };
}

const deflate = (a) => R(a.x + 16, a.y + 14, Math.max(10, a.w - 32), Math.max(10, a.h - 28));
export function playLayout(w, h, { n = 3, coach = false, lefty = false } = {}) {
  return memo(`play|${Math.round(w)}x${Math.round(h)}|${insKey()}|${n}|${coach ? 1 : 0}|${lefty ? 1 : 0}`, () => buildPlay(frame(w, h), n, coach, lefty));
}
const TOOLS = ['undo', 'clear', 'hint'];

function buildPlay(F, n, coach, lefty) {
  const { U, back } = F, m = clamp(U.w * 0.022, 12, 26), gap = 10;
  const land = F.land && U.w > U.h * 1.12;
  const L = { F, w: F.w, h: F.h, U, mode: land ? 'land' : 'portrait', m, coach, lefty, n, back };
  const bh = 66, ip = 12;
  if (!land) {
    const cw = Math.min(U.w - 2 * m, 700), cx = U.x0 + (U.w - cw) / 2, hb = U.x0 + (back.w ? back.w + 4 : 0);
    const hudTop = U.y0 + 6, hudH = 84;
    L.hud = { title: R(Math.max(U.x0 + m, hb), hudTop, cw * 0.6, hudH) };
    L.pause = R(U.x1 - m - 66, hudTop + 10, 66, 66);
    L.strip = R(cx, hudTop + hudH + 2, cw, 76);
    const top = L.strip.y + L.strip.h + 8;
    const toolsH = coach ? Math.max(210, Math.min(300, (U.y1 - top) * 0.3)) : 84 + gap + 62;
    const trayH = clamp(cw / Math.min(n, 4.2) * 1.2 + 12, 130, 280);
    const bottom = U.y1 - 8;
    let sceneH = Math.min(bottom - top - toolsH - trayH - 2 * gap, cw * 0.96);
    sceneH = Math.max(sceneH, 220);
    const used = sceneH + toolsH + trayH + 2 * gap, extra = Math.max(0, bottom - top - used);
    L.scene = R(cx, top + extra * 0.2, cw, sceneH);
    L.trayArea = R(cx, L.scene.y + sceneH + gap + extra * 0.35, cw, trayH);
    const ty = L.trayArea.y + trayH + gap + extra * 0.25;
    L.ctl = R(cx, ty, cw, Math.max(100, bottom - ty));
    L.tray = trayGrid(deflate(L.trayArea), n, gap);
    if (coach) L.coachR = L.ctl; else {
      L.pour = R(cx, bottom - 62 - gap - 84, cw, 84);
      L.tools = {}; const tr = grid(R(cx, bottom - 62, cw, 62), 3, 1, gap);
      TOOLS.forEach((k, i) => { L.tools[k] = tr[i]; });
    }
  } else {
    const panelW = clamp(U.w * 0.36, 380, 620), total = U.w - 2 * m, sceneW = total - panelW - m;
    const sx = lefty ? U.x0 + m + panelW + m : U.x0 + m, px = lefty ? U.x0 + m : U.x0 + m + sceneW + m;
    L.scene = R(sx, U.y0 + m, sceneW, U.h - 2 * m);
    const panel = R(px, U.y0 + m, panelW, U.h - 2 * m);
    L.info = panel;
    const edgeLeft = panel.x <= U.x0 + 60, topPad = back.w && edgeLeft ? Math.max(14, back.y + back.h - panel.y + 4) : 14;
    const iy = panel.y + topPad, x = panel.x + 12, ww = panel.w - 24;
    L.hud = { title: R(panel.x + 18, iy, panel.w - 110, 70) };
    L.pause = R(panel.x + panel.w - 18 - 62, iy + 4, 62, 62);
    // Short landscape phone with a hint or Watch and Learn card: the tray moves under the scene and the whole side panel is the card.
    const shortCoach = coach && U.w / U.h > 1.9;
    L.shortCoach = shortCoach;
    L.strip = R(x, iy + 76, ww, shortCoach ? 0 : ww < 600 ? 132 : 84);
    const bottom = panel.y + panel.h - 12;
    if (shortCoach) {
      const trayH = 150;
      L.scene = R(sx, U.y0 + m, sceneW, U.h - 2 * m - trayH - gap);
      L.trayArea = R(sx, L.scene.y + L.scene.h + gap, sceneW, trayH);
      L.tray = trayGrid(deflate(L.trayArea), n, gap);
      const ty0 = iy + 80;
      L.ctl = R(x, ty0, ww, bottom - ty0);
      L.coachR = L.ctl;
    } else {
      const toolsH = coach ? Math.max(200, Math.min(300, panel.h * 0.36)) : 70 + gap + 58;
      const ty = L.strip.y + L.strip.h + 8;
      L.trayArea = R(x, ty, ww, Math.max(80, bottom - toolsH - gap - ty));
      L.tray = trayGrid(deflate(L.trayArea), n, gap);
      L.ctl = R(x, bottom - toolsH, ww, toolsH);
      if (coach) L.coachR = L.ctl; else {
        L.pour = R(x, bottom - 58 - gap - 70, ww, 70);
        L.tools = {}; const tr = grid(R(x, bottom - 58, ww, 58), 3, 1, gap);
        TOOLS.forEach((k, i) => { L.tools[k] = tr[i]; });
      }
    }
  }
  const C = L.coachR;
  if (C) {
    L.coachBtns = { close: R(C.x + ip, C.y + C.h - bh - ip, C.w / 2 - ip - 6, bh), go: R(C.x + C.w / 2 + 6, C.y + C.h - bh - ip, C.w / 2 - ip - 6, bh) };
    const wide = C.w >= 440, rh = wide ? bh : bh * 2 + 10;
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
// Journey map: market days, each with a row of order buttons. Free play: one card per kind of weighing with three tier buttons.
export function listLayout(w, h) {
  return memo(`list|${Math.round(w)}x${Math.round(h)}|${insKey()}`, () => {
    const P = { ...pageLayout(w, h, { footer: 1 }) };
    const f = P.footer; P.back = R(f.x + f.w / 2 - 160, f.y, 320, f.h);
    return P;
  });
}
export function statsLayout(w, h) { return listLayout(w, h); }

// Content-space rectangles for the two scrolling pick screens (hit-testing adds the scroll offset).
export function journeyRects(body, counts, scale = 1) {
  const sc = Math.min(scale, 1.6), per = Math.max(3, Math.floor((body.w + 10) / (86 * sc + 10))), ls = Math.min(120, (body.w - 10 * (per - 1)) / per);
  const items = []; let y = body.y;
  counts.forEach((cnt, ci) => {
    const head = R(body.x, y, body.w, 78 * sc + 150 * (sc - 1)); y += head.h + 6;
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
export function overLayout(w, h, scale = 1) {
  return memo(`over|${Math.round(w)}x${Math.round(h)}|${insKey()}|${scale}`, () => {
    const F = frame(w, h), { U } = F, m = 18, O = { F };
    const wide = F.land && U.w > U.h * 1.1, bh = wide ? 66 : 74;
    O.wide = wide;
    if (wide) {
      const sw = Math.min(U.w * 0.5, U.h * 1.15), cx = U.x0 + m + sw + 30, cw = U.x1 - m - cx, by = U.y1 - m - 2 * (bh + 12) - 24;
      O.scene = R(U.x0 + m, U.y0 + m, sw, U.h - 2 * m);
      O.btns = { next: R(cx, by, cw, bh), share: R(cx, by + bh + 12, cw / 2 - 6, bh), menu: R(cx + cw / 2 + 6, by + bh + 12, cw / 2 - 6, bh) };
      O.more = { x: cx + cw / 2, y: U.y1 - m - 8 };
      O.body = R(cx, U.y0 + m, cw, by - 14 - U.y0 - m);
    } else {
      const cw = Math.min(U.w - 2 * m, 700), cx = U.x0 + (U.w - cw) / 2;
      const sh = clamp(Math.min(cw * 0.8, U.h * 0.4) * (scale <= 1 ? 1 : scale <= 1.5 ? 0.8 : scale <= 2 ? 0.6 : 0.42), 120, 600);
      O.scene = R(cx, U.y0 + 14 + (F.ins.back ? 44 : 0), cw, sh);
      const by = U.y1 - m - 2 * (bh + 12) - 36;
      O.btns = { next: R(cx, by, cw, bh), share: R(cx, by + bh + 12, cw / 2 - 6, bh), menu: R(cx + cw / 2 + 6, by + bh + 12, cw / 2 - 6, bh) };
      O.body = R(cx, O.scene.y + O.scene.h + 10, cw, by - 12 - (O.scene.y + O.scene.h + 10));
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

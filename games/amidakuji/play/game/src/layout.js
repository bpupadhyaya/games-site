// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// Render and hit-testing both read these rects, so what is drawn is what is tapped.
//   play    portrait : header, the ladder (lanterns on top, bowls below), a row of tool buttons
//           landscape: ladder on the left, one panel on the right with info and the tool buttons
//   A hint card or the Watch and Learn rail takes over the button area.
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

// ---- the ladder ----------------------------------------------------------------------------------------------------------------------------
// Lines run from yTop to yBot; row r sits at ys[r]. Lanterns hang above the lines, bowls sit under them.
export function ladderGeo(area, n, rows, { maxSp = 190, maxRow = 130, tokens = true } = {}) {
  let sp = Math.min(maxSp, (area.w - 20) / Math.max(1, n - 1 + 0.82));
  sp = Math.max(24, sp);
  const tr = clamp(sp * 0.4, 14, 52);
  const topZone = tokens ? tr * 3.2 : 18, botZone = tr * 2.5;
  const avail = Math.max(60, area.h - topZone - botZone - 10);
  const rowGap = Math.max(16, Math.min(maxRow, avail / (rows + 0.4)));
  const lh = rowGap * (rows + 0.4), total = topZone + lh + botZone;
  const y0 = area.y + Math.max(0, (area.h - total) / 2);
  const wTot = sp * (n - 1), x0 = area.x + (area.w - wTot) / 2;
  const xs = Array.from({ length: n }, (_, i) => x0 + i * sp);
  const yTop = y0 + topZone, yBot = yTop + lh;
  const ys = Array.from({ length: rows }, (_, r) => yTop + (r + 0.7) * rowGap);
  const slotAt = (px, py) => {
    const gx = (px - xs[0]) / sp;
    if (gx < 0 || gx > n - 1 || py < yTop - 4 || py > yBot + 4) return null;
    const g = clamp(Math.floor(gx), 0, n - 2), r = clamp(Math.round((py - ys[0]) / rowGap), 0, rows - 1);
    if (Math.abs(py - ys[r]) > rowGap * 0.52) return null;
    return { r, g };
  };
  const tokenAt = (px, py) => { for (let i = 0; i < n; i++) if (Math.abs(px - xs[i]) <= Math.max(tr * 1.15, sp * 0.4) && Math.abs(py - (yTop - tr * 1.35)) <= tr * 1.6) return i; return -1; };
  const bowlAt = (px, py) => { for (let i = 0; i < n; i++) if (Math.abs(px - xs[i]) <= Math.max(tr * 1.15, sp * 0.45) && py >= yBot - 4 && py <= yBot + botZone + 16) return i; return -1; };
  return { n, rows, sp, tr, xs, ys, yTop, yBot, rowGap, topZone, botZone, area, tokenY: yTop - tr * 1.35, bowlY: yBot + tr * 1.35, slotAt, tokenAt, bowlAt };
}

// ---- play --------------------------------------------------------------------------------------------------------------------------------------
export function playLayout(w, h, { coach = false, buttons = ['release', 'undo', 'hint', 'clear'], band = 0 } = {}) {
  return memo(`play|${Math.round(w)}x${Math.round(h)}|${insKey()}|${coach ? 1 : 0}|${buttons.join('.')}|${band}`, () => build(frame(w, h), coach, buttons, band));
}
function build(F, coach, buttons, band) {
  const { U, back } = F, m = clamp(U.w * 0.02, 12, 26), gap = 10;
  const hudH = 84, hudTop = U.y0 + 6;
  const L = { F, w: F.w, h: F.h, U, m, coach, back, buttons };
  const land = F.land && U.w >= U.h * 1.08;
  const toolH = 72, nb = buttons.length;
  if (!land) {
    L.mode = 'portrait';
    const cw = Math.min(U.w - 2 * m, 700), cx = U.x0 + (U.w - cw) / 2, hb = U.x0 + (back.w ? back.w + 4 : 0);
    L.pause = R(U.x1 - m - 66, hudTop + 8, 66, 66);
    const tx = Math.max(U.x0 + m, hb);
    L.hud = { title: R(tx, hudTop, Math.max(200, L.pause.x - 190 - tx), hudH) };
    L.badge = { x: L.pause.x - 12, y: L.pause.y + 10, align: 'right' };
    const bottomH = coach ? clamp(U.h * 0.3, 250, 360) : nb ? toolH + 14 : 70;
    const ctl = R(cx, U.y1 - 8 - bottomH, cw, bottomH);
    L.ctl = ctl;
    const aTop = hudTop + hudH + 2;
    L.promptR = band ? R(cx, aTop, cw, band - 8) : null;
    L.area = R(U.x0 + m, aTop + band, U.w - 2 * m, Math.max(160, ctl.y - 6 - aTop - band));
    if (!coach && nb) L.tools = toolRects(R(ctl.x, ctl.y + 6, ctl.w, toolH), buttons, false, gap);
    L.info = null;
  } else {
    L.mode = 'land';
    const pw = clamp(U.w * 0.34, 330, 560);
    const panel = R(U.x1 - m - pw, U.y0 + m, pw, U.h - 2 * m);
    L.info = panel;
    L.area = R(U.x0 + m, U.y0 + m, panel.x - U.x0 - 2 * m, U.h - 2 * m);
    const hb = U.x0 + (back.w ? back.w + 4 : 0);
    L.hud = { title: R(Math.max(panel.x + 18, 0), panel.y + 8, panel.w - 110, 70) };
    L.pause = R(panel.x + panel.w - 18 - 62, panel.y + 12, 62, 62);
    L.badge = { x: panel.x + 18, y: panel.y + 88, align: 'left' };
    void hb;
    const bottom = panel.y + panel.h - 14, rowsN = nb ? Math.ceil((nb - (buttons.includes('release') ? 1 : 0)) / 2) + (buttons.includes('release') ? 1 : 0) : 0;
    const tH = 64;
    if (coach) { L.ctl = R(panel.x + 12, panel.y + 130, panel.w - 24, bottom - panel.y - 130); }
    else {
      const th = rowsN * tH + Math.max(0, rowsN - 1) * gap;
      if (nb) L.tools = toolRects(R(panel.x + 12, bottom - th, panel.w - 24, th), buttons, true, gap);
      L.ctl = R(panel.x + 12, panel.y + 130, panel.w - 24, bottom - th - 12 - panel.y - 130);
    }
  }
  if (L.mode === 'land' && band) L.promptR = L.ctl;
  const C = L.ctl, bh = 66, ip = 12;
  L.coachR = coach ? C : null;
  L.coachBtns = { close: R(C.x + ip, C.y + C.h - bh - ip, C.w / 2 - ip - 6, bh), go: R(C.x + C.w / 2 + 6, C.y + C.h - bh - ip, C.w / 2 - ip - 6, bh) };
  const wide = C.w >= 560, rh = wide ? bh : bh * 2 + 10;
  const rail = grid(R(C.x + ip, C.y + C.h - rh - ip, C.w - 2 * ip, rh), wide ? 4 : 2, wide ? 1 : 2, 10);
  L.rail = { exit: rail[0], pause: rail[1], dec: rail[2], inc: rail[3] };
  L.coachText = R(C.x, C.y, C.w, C.h - Math.max(bh, rh) - 12 - ip);
  return L;
}
function toolRects(r, ids, stacked, gap) {
  const out = {};
  if (!stacked) {
    const wts = ids.map((id) => (id === 'release' ? 1.7 : 1)), sum = wts.reduce((a, b) => a + b, 0), avail = r.w - gap * (ids.length - 1);
    let x = r.x;
    ids.forEach((id, i) => { const ww = (avail * wts[i]) / sum; out[id] = R(x, r.y, ww, r.h); x += ww + gap; });
    return out;
  }
  const rel = ids.includes('release'), rest = ids.filter((i) => i !== 'release'), tH = 64;
  let y = r.y;
  if (rel) { out.release = R(r.x, y, r.w, tH); y += tH + gap; }
  rest.forEach((id, i) => {
    const row = Math.floor(i / 2), col = i % 2, alone = i === rest.length - 1 && rest.length % 2 === 1, rw = alone ? r.w : (r.w - gap) / 2;
    out[id] = R(r.x + (alone ? 0 : col * (rw + gap)), y + row * (tH + gap), rw, tH);
  });
  return out;
}

// ---- title -------------------------------------------------------------------------------------------------------------------------------------
export function titleLayout(w, h, hasSave) {
  return memo(`title|${Math.round(w)}x${Math.round(h)}|${insKey()}|${hasSave ? 1 : 0}`, () => {
    const F = frame(w, h), { U } = F, m = 18;
    const T = { F, buttons: {} };
    const prim = (hasSave ? ['continue'] : []).concat(['journey', 'follow', 'lots', 'daily']), sec = ['learn', 'howto', 'rules', 'stats', 'settings', 'about'];
    let col;
    if (F.land && U.w > 760) {
      const cw = clamp(U.w * 0.42, 420, 640), cx = U.x1 - cw - m * 1.5;
      T.hero = R(U.x0 + m, U.y0 + m, cx - U.x0 - 2 * m, U.h - 2 * m - 50);
      col = R(cx, U.y0 + m, cw, U.h - 2 * m - 50);
      T.brand = { x: U.x0 + (cx - U.x0) / 2, y: U.y1 - 22 };
    } else {
      const cw = Math.min(U.w - 2 * m, 640), top = U.y0 + 6;
      const compact = U.h < 1250;   // tablets / short portrait: smaller buttons so the title art keeps a proper height
      const need = prim.length * (compact ? 72 : 86) + 16 + 3 * (compact ? 56 : 66) + 10 + 60;
      const heroH = clamp(U.h - need - 60, 190, 620);
      T.hero = R(U.x0 + m, top + (F.ins.back ? 40 : 0), U.w - 2 * m, heroH - (F.ins.back ? 40 : 0));
      col = R(U.x0 + (U.w - cw) / 2, top + heroH, cw, U.h - heroH - 60);
      T.brand = { x: U.x0 + U.w / 2, y: U.y1 - 22 };
    }
    const small = !(F.land && U.w > 760) && U.h < 1250;
    const sH = clamp(col.h * 0.075, 44, small ? 56 : 84), avail = col.h - 16 - 3 * (sH + 10);
    const pH = clamp(avail / prim.length - 12, 50, small ? 78 : 120);
    let y = col.y + Math.max(0, (col.h - (prim.length * (pH + 12) + 16 + 3 * (sH + 10))) / 2);
    prim.forEach((id) => { T.buttons[id] = R(col.x, y, col.w, pH); y += pH + 12; });
    y += 4;
    const g = grid(R(col.x, y, col.w, 3 * sH + 20), 2, 3, 10);
    sec.forEach((id, i) => { T.buttons[id] = g[i]; });
    T.subs = pH >= 66;
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

// Content-space rectangles for the scrolling pick screens (hit-testing adds the scroll offset).
export function journeyRects(body, counts, scale = 1) {
  const sc = Math.min(scale, 1.6), per = Math.max(3, Math.floor((body.w + 10) / (86 * sc + 10))), ls = Math.min(120, (body.w - 10 * (per - 1)) / per);
  const items = []; let y = body.y;
  counts.forEach((cnt, ci) => {
    const head = R(body.x, y, body.w, 78 * sc); y += head.h + 6;
    const lv = [];
    for (let i = 0; i < cnt; i++) lv.push(R(body.x + (i % per) * (ls + 10), y + Math.floor(i / per) * (ls * 0.86 + 10), ls, ls * 0.86));
    y += Math.ceil(cnt / per) * (ls * 0.86 + 10) + 16;
    items.push({ head, lv, ci });
  });
  return { items, contentH: y - body.y };
}
// One tappable card per tier (Follow the Line).
export function tierRects(body, count, scale = 1) {
  const sc = Math.min(scale, 1.5), cols = body.w >= 980 ? 2 : 1, gap = 14, cw = (body.w - gap * (cols - 1)) / cols, ch = 170 * sc, cards = [];
  for (let i = 0; i < count; i++) cards.push(R(body.x + (i % cols) * (cw + gap), body.y + Math.floor(i / cols) * (ch + gap), cw, ch));
  return { cards, contentH: Math.ceil(count / cols) * (ch + gap) };
}
// Draw Lots set-up: a player stepper, one card per slip set, then the start button.
export function lotsRects(body, nSets, scale = 1) {
  const sc = Math.min(scale, 1.5), gap = 12;
  const stepper = R(body.x, body.y, body.w, 150 * sc);
  const bw = Math.min(110 * sc, stepper.w * 0.2);
  const minus = R(stepper.x + stepper.w - 2 * bw - 40, stepper.y + stepper.h - bw - 14 * sc, bw, bw), plus = R(stepper.x + stepper.w - bw - 20, minus.y, bw, bw);
  const cols = body.w >= 760 ? 2 : 1, cw = (body.w - gap * (cols - 1)) / cols, ch = 112 * sc, cards = [];
  const y0 = stepper.y + stepper.h + 20 * sc + 40;
  for (let i = 0; i < nSets; i++) cards.push(R(body.x + (i % cols) * (cw + gap), y0 + Math.floor(i / cols) * (ch + gap), cw, ch));
  const yEnd = y0 + Math.ceil(nSets / cols) * (ch + gap);
  const start = R(body.x, yEnd + 10, body.w, 92 * Math.min(sc, 1.3));
  return { stepper, minus, plus, cards, start, setsTop: y0 - 40, contentH: start.y + start.h - body.y + 10 };
}

// ---- result ---------------------------------------------------------------------------------------------------------------------------------
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
      O.more = { x: cx + cw / 2, y: U.y1 - m - 8 };
      O.body = R(cx, U.y0 + m, cw, by - 14 - U.y0 - m);
    } else {
      const cw = Math.min(U.w - 2 * m, 700), cx = U.x0 + (U.w - cw) / 2;
      const by = U.y1 - m - 2 * (bh + 12) - 36;
      const artH = clamp((by - U.y0) * 0.42, 170, 520);
      O.art = R(U.x0 + m, U.y0 + 14 + (F.ins.back ? 44 : 0), U.w - 2 * m, artH);
      O.btns = { next: R(cx, by, cw, bh), share: R(cx, by + bh + 12, cw / 2 - 6, bh), menu: R(cx + cw / 2 + 6, by + bh + 12, cw / 2 - 6, bh) };
      O.body = R(cx, O.art.y + O.art.h + 10, cw, by - 12 - (O.art.y + O.art.h + 10));
      O.more = { x: U.x0 + U.w / 2, y: U.y1 - 8 };
    }
    return O;
  });
}

// ---- small overlays -------------------------------------------------------------------------------------------------------------------------
export function pauseLayout(w, h, area) {
  const b = area, cw = Math.min(b.w - 30, 520), nb = 4, bh = Math.max(44, Math.min(78, (b.h - 24 - 98) / nb - 12)), ch = nb * (bh + 12) + 98;
  const card = R(b.x + (b.w - cw) / 2, b.y + Math.max(0, (b.h - ch) / 2), cw, ch);
  return { card, resume: R(card.x + 16, card.y + 86, cw - 32, bh), restart: R(card.x + 16, card.y + 86 + bh + 12, cw - 32, bh), settings: R(card.x + 16, card.y + 86 + 2 * (bh + 12), cw - 32, bh), menu: R(card.x + 16, card.y + 86 + 3 * (bh + 12), cw - 32, bh) };
}
export function centerCard(w, h, cw, ch) { const F = frame(w, h), { U } = F; return R(U.x0 + (U.w - Math.min(cw, U.w - 32)) / 2, U.y0 + (U.h - Math.min(ch, U.h - 32)) / 2, Math.min(cw, U.w - 32), Math.min(ch, U.h - 32)); }
export { R, clamp, grid };

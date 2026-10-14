// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// Render and hit-testing both read these rects, so what is drawn is what is tapped.
//   play    portrait : header, thread gauge, the cloth patch, a row of tool buttons (or the hint / Watch and Learn card)
//           landscape: the cloth on the left, one panel on the right with info, gauge and the tool buttons
import { v3, clothCamera, clothToScreen, screenToCloth } from './v3.js';
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
const insKey = () => `${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${Math.round(host.px * 50)}`;
// Layout units that come to at least `css` CSS pixels on the live screen (tap targets stay >= 44 css px on small phones).
const mh = (css) => Math.ceil(css / clamp(host.px, 0.3, 1.5));
export function frame(w, h) {
  w = Math.round(w); h = Math.round(h);
  const ins = { ...host }, U = { x0: ins.l, y0: ins.t, x1: w - ins.r, y1: h - ins.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const back = ins.back ? R(ins.l, ins.t, Math.max(ins.back, 56) + 10, Math.max(ins.back, 56) + 10) : R(0, 0, 0, 0);
  return { w, h, ins, U, back, land: w >= h };
}

// ---- the cloth ----------------------------------------------------------------------------------------------------------------------------
// Maps cloth units (0..size) to screen units. The patch is a square centred in `area`; `pad` leaves room for the layers under it.
export function patchGeo(area, size = 10, pad = 0.045, opt = {}) {
  const side = Math.max(120, Math.min(area.w, area.h) * (1 - 2 * pad)), s = side / size;
  const x0 = area.x + (area.w - side) / 2, y0 = area.y + (area.h - side) / 2;
  const rect = R(x0, y0, side, side);
  const g = { x0, y0, s, side, size, X: (x) => x0 + x * s, Y: (y) => y0 + y * s, rect };
  // P: cloth units (+ height in metres above the cloth) -> layout units. With the 3D scene it goes through the cloth camera (the same
  // one the presenter renders with); flat, it is the plain mapping. pick is the inverse on the cloth plane. k: layout units per cloth unit.
  g.cam = () => clothCamera(rect, size, v3.W, v3.H, opt);
  g.P = (x, y, h = 0) => (v3.on ? clothToScreen(g.cam(), x, y, h) : { x: g.X(x), y: g.Y(y) });
  g.pick = (sx, sy) => (v3.on ? screenToCloth(g.cam(), sx, sy) : { x: (sx - x0) / s, y: (sy - y0) / s });
  g.k = (x, y) => { if (!v3.on) return s; const a = g.P(x, y), b = g.P(x + 1, y), c = g.P(x, y + 1); return (Math.hypot(b.x - a.x, b.y - a.y) + Math.hypot(c.x - a.x, c.y - a.y)) / 2; };
  return g;
}

// ---- play --------------------------------------------------------------------------------------------------------------------------------------
export function playLayout(w, h, { coach = false, buttons = ['sew', 'undo', 'hint', 'clear'], slim = false } = {}) {
  return memo(`play|${Math.round(w)}x${Math.round(h)}|${insKey()}|${coach ? 1 : 0}|${buttons.join('.')}|${slim ? 1 : 0}`, () => build(frame(w, h), coach, buttons, slim));
}
function build(F, coach, buttons, slim) {
  const { U, back } = F, m = clamp(U.w * 0.02, 12, 26), gap = 10;
  const hudH = 84, hudTop = U.y0 + 6;
  const L = { F, w: F.w, h: F.h, U, m, coach, back, buttons };
  const land = F.land && U.w >= U.h * 1.08;
  const toolH = Math.max(72, mh(46)), nb = buttons.length, gaugeH = 62, pz = Math.max(66, mh(44));
  if (!land) {
    L.mode = 'portrait';
    const cw = Math.min(U.w - 2 * m, 700), cx = U.x0 + (U.w - cw) / 2, hb = U.x0 + (back.w ? back.w + 4 : 0);
    L.pause = R(U.x1 - m - pz, hudTop + 8, pz, pz);
    const tx = Math.max(U.x0 + m, hb);
    L.hud = { title: R(tx, hudTop, Math.max(200, L.pause.x - 190 - tx), hudH) };
    L.badge = { x: L.pause.x - 12, y: L.pause.y + 10, align: 'right' };
    // gauge, cloth and the control region form one cluster, centred in the space under the header; the cloth never moves
    // when the hint card replaces the tool row (the region always has the hint card's height).
    const regionH = slim ? 190 : clamp(U.h * 0.3, 250, 360), top = hudTop + hudH + 4, availH = U.y1 - 8 - top;
    const wideSide = U.w - 2 * m;
    const side = Math.max(160, Math.min(wideSide, availH - gaugeH - regionH - 8));
    const clusterH = gaugeH + 4 + side + 8 + regionH, spare = availH - clusterH;
    if (!slim && side >= wideSide - 1 && spare > 100) {
      // a tall phone: the cloth is as wide as the screen, so the spare height goes to the controls instead of an empty bottom quarter.
      // The cluster hugs the header; the region below the cloth runs to the bottom edge: legend and the order strip at its top, a
      // taller tool row docked at its bottom (where the thumb is), and the hint card / Watch and Learn rail fill the same region.
      const y0 = top + Math.min(24, spare * 0.08);
      L.gauge = R(cx, y0, cw, gaugeH);
      L.area = R(U.x0 + (U.w - side) / 2, y0 + gaugeH + 4, side, side);
      const cy = L.area.y + side + 8, ch = U.y1 - 8 - cy;
      L.ctl = R(cx, cy, cw, ch);
      const th = clamp(Math.round(ch * 0.3), toolH, 170);
      if (!coach && nb) L.tools = toolRects(R(cx, cy + ch - th - 4, cw, th), buttons, false, gap);
      L.legend = coach ? null : R(cx, cy + 6, cw, 100);
      const py = cy + 6 + 100 + 6, ph = (L.tools ? Object.values(L.tools)[0].y : cy + ch) - 12 - py;
      const pcH = Math.min(ph, 250);
      L.plan = !coach && ph >= 64 ? R(cx, py + (ph - pcH) / 2, cw, pcH) : null;
      L.info = null;
      return finish(L, F);
    }
    const clusterTop = top + Math.max(0, spare / 2);
    const y0 = clusterTop;
    L.gauge = R(cx, y0, cw, gaugeH);
    L.area = R(U.x0 + (U.w - side) / 2, y0 + gaugeH + 4, side, side);
    const ctl = R(cx, L.area.y + side + 8, cw, regionH);
    L.ctl = ctl;
    if (!coach && nb) L.tools = toolRects(R(ctl.x, ctl.y + 4, ctl.w, toolH), buttons, false, gap);
    L.legend = coach ? null : R(ctl.x, ctl.y + 4 + (nb ? toolH + 14 : 0), ctl.w, 120);
    L.info = null;
  } else {
    L.mode = 'land';
    const pw = clamp(U.w * 0.34, 330, 560);
    const panel = R(U.x1 - m - pw, U.y0 + m, pw, U.h - 2 * m);
    L.info = panel;
    L.area = R(U.x0 + m, U.y0 + m, panel.x - U.x0 - 2 * m, U.h - 2 * m);
    L.hud = { title: R(Math.max(panel.x + 18, 0), panel.y + 8, panel.w - 110, 70) };
    L.pause = R(panel.x + panel.w - 18 - pz, panel.y + 12, pz, pz);
    L.badge = { x: panel.x + 18, y: panel.y + 88, align: 'left' };
    L.gauge = R(panel.x + 12, panel.y + 130, panel.w - 24, gaugeH);
    const top = L.gauge.y + gaugeH + 8, bottom = panel.y + panel.h - 14;
    const rowsN = nb ? Math.ceil((nb - (buttons.includes('sew') ? 1 : 0)) / 2) + (buttons.includes('sew') ? 1 : 0) : 0;
    const tH = Math.max(64, mh(46));
    if (coach) { L.ctl = R(panel.x + 12, top, panel.w - 24, bottom - top); }
    else {
      const th = rowsN * tH + Math.max(0, rowsN - 1) * gap;
      if (nb) L.tools = toolRects(R(panel.x + 12, bottom - th, panel.w - 24, th), buttons, true, gap);
      L.ctl = R(panel.x + 12, top, panel.w - 24, bottom - th - 12 - top);
      L.legend = R(L.ctl.x, L.ctl.y + 6, L.ctl.w, Math.max(60, L.ctl.h - 12));
    }
  }
  return finish(L, F);
}
// the hint card, Watch and Learn rail and text areas, all inside L.ctl
function finish(L, F) {
  const coach = L.coach;
  const C = L.ctl, bh = Math.max(66, mh(46)), ip = 12;
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
    const wts = ids.map((id) => (id === 'sew' ? 1.7 : 1)), sum = wts.reduce((a, b) => a + b, 0), avail = r.w - gap * (ids.length - 1);
    let x = r.x;
    ids.forEach((id, i) => { const ww = (avail * wts[i]) / sum; out[id] = R(x, r.y, ww, r.h); x += ww + gap; });
    return out;
  }
  const rel = ids.includes('sew'), rest = ids.filter((i) => i !== 'sew'), tH = Math.max(64, mh(46));
  let y = r.y;
  if (rel) { out.sew = R(r.x, y, r.w, tH); y += tH + gap; }
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
    const prim = (hasSave ? ['continue'] : []).concat(['quilt', 'steady', 'daily']), sec = ['learn', 'howto', 'rules', 'stats', 'settings', 'about'];
    let col;
    if (F.land && U.w > 760) {
      const cw = clamp(U.w * 0.42, 420, 640), cx = U.x1 - cw - m * 1.5;
      T.hero = R(U.x0 + m, U.y0 + m, cx - U.x0 - 2 * m, U.h - 2 * m - 50);
      col = R(cx, U.y0 + m, cw, U.h - 2 * m - 50);
      T.brand = { x: U.x0 + (cx - U.x0) / 2, y: U.y1 - 22 };
    } else {
      const cw = Math.min(U.w - 2 * m, 640), top = U.y0 + 6;
      const need = prim.length * Math.max(86, mh(46) + 12) + 16 + 3 * Math.max(66, mh(44) + 10) + 10 + 60;
      const heroH = clamp(U.h - need - 60, 190, 620);
      T.hero = R(U.x0 + m, top + (F.ins.back ? 40 : 0), U.w - 2 * m, heroH - (F.ins.back ? 40 : 0));
      col = R(U.x0 + (U.w - cw) / 2, top + heroH, cw, U.h - heroH - 60);
      T.brand = { x: U.x0 + U.w / 2, y: U.y1 - 22 };
    }
    const sH = clamp(col.h * 0.075, Math.max(44, mh(44)), Math.max(84, mh(44))), avail = col.h - 16 - 3 * (sH + 10);
    const pH = clamp(avail / prim.length - 12, Math.max(50, mh(46)), Math.max(120, mh(46)));
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
    const th = Math.max(62, mh(44)), hdrTop = U.y0 + 8, hdrH = th + 8, maxW = Math.min(U.w - 2 * m, 1500);
    const x0 = U.x0 + (U.w - maxW) / 2;
    const P = { F, m, maxW, x0 };
    P.titleX = Math.max(x0, back.w ? U.x0 + back.w + 4 : x0);
    P.header = R(x0, hdrTop, maxW, hdrH);
    const tw = Math.max(74, mh(44)); P.textDec = R(U.x1 - m - 2 * tw - 8, hdrTop + 4, tw, th); P.textInc = R(U.x1 - m - tw, hdrTop + 4, tw, th);
    const fh = footer ? Math.max(78, mh(48)) : 0;
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
    const cols = P.body.w >= 1250 ? 2 : 1, gap = 12, rowH = Math.round(Math.max(98, mh(44) + 28) * (1 + (scale - 1) * 0.5)), cw = (P.body.w - gap * (cols - 1)) / cols;
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
// The quilt: chapters as rows of patch tiles (square).
export function quiltRects(body, counts, scale = 1) {
  const sc = Math.min(scale, 1.6), per = body.w >= 6 * 128 + 5 * 12 && sc <= 1.25 ? 6 : 3, ls = Math.min(210, (body.w - 12 * (per - 1)) / per);
  const items = []; let y = body.y;
  counts.forEach((cnt, ci) => {
    const head = R(body.x, y, body.w, 78 * sc); y += head.h + 6;
    const lv = [];
    for (let i = 0; i < cnt; i++) lv.push(R(body.x + (i % per) * (ls + 12), y + Math.floor(i / per) * (ls + 12), ls, ls));
    y += Math.ceil(cnt / per) * (ls + 12) + 14;
    items.push({ head, lv, ci });
  });
  return { items, contentH: y - body.y };
}
// One tappable card per tier (Steady Hand).
export function tierRects(body, count, scale = 1) {
  const sc = Math.min(scale, 1.5), cols = body.w >= 980 ? 2 : 1, gap = 14, cw = (body.w - gap * (cols - 1)) / cols, ch = 196 * sc, cards = [];
  for (let i = 0; i < count; i++) cards.push(R(body.x + (i % cols) * (cw + gap), body.y + Math.floor(i / cols) * (ch + gap), cw, ch));
  return { cards, contentH: Math.ceil(count / cols) * (ch + gap) };
}

// ---- result ---------------------------------------------------------------------------------------------------------------------------------
export function overLayout(w, h) {
  return memo(`over|${Math.round(w)}x${Math.round(h)}|${insKey()}`, () => {
    const F = frame(w, h), { U } = F, m = 18, O = { F };
    const wide = F.land && U.w > U.h * 1.05, bh = Math.max(wide ? 66 : 74, mh(46));
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
      const artH = clamp((by - U.y0) * 0.42, 170, 560);
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
  const b = area, cw = Math.min(b.w - 30, 520), nb = 4, bh = Math.max(mh(44), Math.min(Math.max(78, mh(46)), (b.h - 24 - 80) / nb - 12)), ch = nb * (bh + 12) + 80;
  const card = R(b.x + (b.w - cw) / 2, b.y + Math.max(0, (b.h - ch) / 2), cw, ch);
  return { card, resume: R(card.x + 16, card.y + 70, cw - 32, bh), restart: R(card.x + 16, card.y + 70 + bh + 12, cw - 32, bh), settings: R(card.x + 16, card.y + 70 + 2 * (bh + 12), cw - 32, bh), menu: R(card.x + 16, card.y + 70 + 3 * (bh + 12), cw - 32, bh) };
}
export function centerCard(w, h, cw, ch) { const F = frame(w, h), { U } = F; return R(U.x0 + (U.w - Math.min(cw, U.w - 32)) / 2, U.y0 + (U.h - Math.min(ch, U.h - 32)) / 2, Math.min(cw, U.w - 32), Math.min(ch, U.h - 32)); }
export { R, clamp, grid };

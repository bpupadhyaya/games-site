// Geometry for every screen as a pure function of the LIVE screen size (kit fluid viewport: the short side is always 720 virtual
// units, the long side follows the aspect). `layoutFor(w, h)` is cached by size + insets.
//
// DESIGN screens (menu, setup, settings, reference pages, pause, result, demo limit) are authored once as a 720 x 1280 portrait
// design and once as a 1280 x 720 landscape design, scaled down (never up) into the safe area and centred; view.js draws inside
// `L.d`, game.js maps taps back with `L.d.to(x, y)`.
// PLAY screens (solo, Watch & Learn, face to face) are laid out natively: tall phone, compact portrait, and wide landscape.
import { cardGeom } from './art.js';

export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECS = 2;
export const AUTO_ACT_SECS = 0.9;
export const SETUP_KEYS = ['goal', 'pace', 'cards', 'opps', 'skill', 'look'];
export const DUO_SETUP_KEYS = ['goal', 'pace', 'cards', 'look'];

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

// The Arcforge lockup: >= ~125 css px wide on screen (kd = design scale), aspect 1200:327.
const lockSize = (kd, lo, hi) => { const w = Math.max(lo, Math.min(hi, 125 / (Math.max(0.2, host.px || 0.6) * Math.max(0.2, kd)))); return { w, h: Math.round(w * 327 / 1200) }; };

// ---- cards on a screen ------------------------------------------------------------------------------------------------------
// Lay `n` cards into rect `rect`: choose the column count that gives the biggest cells (tap targets), centre the grid.
export function fitCards(rect, n, gapMax = 16) {
  let best = null;
  for (let c = 1; c <= n; c++) {
    const rows = Math.ceil(n / c), gap = clamp(Math.min(rect.w, rect.h) * 0.025, 8, gapMax);
    let cardW = (rect.w - (c - 1) * gap) / c, cardH = (rect.h - (rows - 1) * gap) / rows;
    if (cardW < 60 || cardH < 40) continue;
    const ns = n >= 3;
    let g = cardGeom({ ...R(0, 0, cardW, cardH), nostrip: ns });
    if (g.ch > g.cw * 1.35) cardH -= 3 * (g.ch - g.cw * 1.35);
    if (g.cw > g.ch * 1.7) cardW -= 9 * (g.cw - g.ch * 1.7);
    g = cardGeom({ ...R(0, 0, cardW, cardH), nostrip: ns });
    const score = Math.min(g.cw, g.ch);
    if (!best || score > best.score * 1.03) best = { c, rows, cardW, cardH, gap, score, cw: g.cw, ch: g.ch };
  }
  if (!best) best = { c: 1, rows: n, cardW: rect.w, cardH: rect.h / n, gap: 6, score: 1, cw: rect.w / 9, ch: rect.h / (3 * n) };
  const totW = best.c * best.cardW + (best.c - 1) * best.gap, totH = best.rows * best.cardH + (best.rows - 1) * best.gap;
  const x0 = rect.x + (rect.w - totW) / 2, y0 = rect.y + (rect.h - totH) / 2, rects = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / best.c), c = i % best.c, inRow = Math.min(best.c, n - r * best.c);
    const rowShift = ((best.c - inRow) * (best.cardW + best.gap)) / 2;
    rects.push({ ...R(x0 + rowShift + c * (best.cardW + best.gap), y0 + r * (best.cardH + best.gap), best.cardW, best.cardH), nostrip: n >= 3 });
  }
  return { rects, cols: best.c, rows: best.rows, cw: best.cw, ch: best.ch, h: totH, w: totW };
}

// ---- design screens ----------------------------------------------------------------------------------------------------------
// The design is authored at 720 x 1280 (portrait) or 1280 x 720 (landscape). On screens longer than that (tall phones, ultra-wide) the
// long side grows (Hd / Wd) and the content is spread into the extra room, so every screen fills the whole visible area.
function designPortrait(hx, kd = 1, Hd = 1280) {
  const W = 720, H = Hd, ex = Hd - 1280;
  const menuRows = (scale = 1) => {
    const big = scale > 1.2, bw = big ? 640 : 580, x = (W - bw) / 2, h = (big ? 118 : 84) + (big ? 0 : Math.min(40, ex * 0.12)), gap = (big ? 12 : 14) + (big ? 0 : Math.min(8, ex * 0.015)), small = (big ? 96 : 76) + (big ? 0 : Math.min(14, ex * 0.04)), sett = (big ? 90 : 70) + (big ? 0 : Math.min(14, ex * 0.04));
    let y = (big ? 190 : 520) + ex * (big ? 0.2 : 0.42);
    const row = (hh = h) => { const r = R(x, y, bw, hh); y += hh + gap; return r; };
    const m = { big, art: !big, artY: 150 + ex * 0.2, artSize: 230 + Math.min(44, ex * 0.15), titleY: (big ? 96 : 392) + (big ? ex * 0.1 : ex * 0.36), subY: (big ? 156 : 454) + (big ? ex * 0.1 : ex * 0.36) };
    m.play = row(); m.duo = row(); m.daily = row(); m.watch = row();
    const third = (bw - gap * 2) / 3;
    m.howto = R(x, y, third, small); m.rules = R(x + third + gap, y, third, small); m.about = R(x + (third + gap) * 2, y, third, small);
    y += small + gap; m.settings = R(x, y, bw, sett);
    const lk = lockSize(kd, 210, 256); m.lockup = R(W / 2 - lk.w / 2, y + sett + 10, lk.w, lk.h);
    return m;
  };
  const setupRows = (keys) => {
    const x = 40, w = W - 80, out = {}, top = 104 + ex * 0.04, pitch = Math.min(176, (H - top - 150) / keys.length);
    let y = top;
    for (const k of keys) { out[k] = R(x, y, w, pitch - 14); y += pitch; }
    out.start = R(60, y + 6, W - 120, 100);
    return out;
  };
  const settings = {}; { const pitch = Math.min(180, (H - 260) / 6); let y = 130 + ex * 0.04; for (const k of ['sound', 'text', 'look', 'think', 'stats', 'reset']) { settings[k] = R(40, y, W - 80, pitch - 12); y += pitch; } }
  const h2 = ex / 2;
  return {
    W, H, land: false, menuRows, setupRows, settings,
    back: R(hx, 14, 110, 60), sound: R(W - 124, 14, 110, 60), textDec: R(hx, 18, 120, 60), textInc: R(W - 140, 18, 120, 60),
    refBack: R(20, 1164 + ex, 332, 100), refNext: R(368, 1164 + ex, 332, 100), panel: { x: 34, y: 90, w: W - 68, maxH: 1050 + ex }, pctY: 48, titleY: 62,
    pause: { titleY: 380 + h2, resume: R(130, 480 + h2, 460, 96), rules: R(130, 590 + h2, 460, 84), menu: R(130, 688 + h2, 460, 84) },
    result: { again: R(60, 1030 + ex, 290, 96), menu: R(370, 1030 + ex, 290, 96), rules: R(60, 1138 + ex, 600, 72), more: { x: W / 2, y: 1244 + ex }, titleY: 150, cx: W / 2, top: 200, bottom: 990 + ex, x0: 90, x1: W - 90 },
    demo: { panel: R(70, 380 + h2, W - 140, 460), back: R(130, 900 + h2, 460, 96), titleY: 470 + h2, msgY: 560 + h2 },
  };
}
function designLandscape(hx, kd = 1, Wd = 1280) {
  const W = Wd, H = 720, ex = Wd - 1280, h2 = ex / 2;
  const menuRows = (scale = 1) => {
    const big = scale > 1.2, bw = 560, x = W - 40 - bw - ex * 0.08, h = big ? 92 : 88, gap = big ? 8 : 12, small = big ? 68 : 72, sett = 62;
    let y = big ? 20 : 30;
    const row = (hh = h) => { const r = R(x, y, bw, hh); y += hh + gap; return r; };
    const cxArt = 340 + ex * 0.3;
    const m = { big, art: true, artY: 150, titleY: 420, subY: 484, cxArt };
    m.play = row(); m.duo = row(); m.daily = row(); m.watch = row();
    const third = (bw - gap * 2) / 3;
    m.howto = R(x, y, third, small); m.rules = R(x + third + gap, y, third, small); m.about = R(x + (third + gap) * 2, y, third, small);
    y += small + gap; m.settings = R(x, y, bw, sett);
    const lk = lockSize(kd, 190, 256); m.lockup = R(x + bw / 2 - lk.w / 2, y + sett + 8, lk.w, lk.h);
    return m;
  };
  const setupRows = (keys) => {
    const out = {}, colW = 580 + ex * 0.1, xs = [50 + ex * 0.12, W - 50 - colW - ex * 0.12], half = Math.ceil(keys.length / 2), ys = [100, 100];
    keys.forEach((k, i) => { const c = i < half ? 0 : 1; out[k] = R(xs[c], ys[c], colW, 118); ys[c] += 132; });
    out.start = R(W / 2 - 300, 586, 600, 100);
    return out;
  };
  const settings = {}; {
    const xs = [40 + ex * 0.12, W / 2 + 20], ys = [130, 130], cw = 580 + ex * 0.1;
    ['sound', 'text', 'look', 'think', 'stats', 'reset'].forEach((k, i) => { const c = i < 3 ? 0 : 1; settings[k] = R(c === 0 ? xs[0] : W - 40 - cw - ex * 0.12, ys[c], cw, 112); ys[c] += 124; });
  }
  return {
    W, H, land: true, menuRows, setupRows, settings,
    back: R(hx, 14, 110, 60), sound: R(W / 2 - 100, 14, 110, 60), textDec: R(hx, 14, 120, 60), textInc: R(W - 140, 14, 120, 60),
    refBack: R(80, 628, 420, 78), refNext: R(W - 80 - 420, 628, 420, 78), panel: { x: (W - Math.min(W - 160, 1040)) / 2, y: 78, w: Math.min(W - 160, 1040), maxH: 536 }, pctY: 44, titleY: 50,
    pause: { titleY: 150, resume: R(W / 2 - 230, 230, 460, 96), rules: R(W / 2 - 230, 342, 460, 84), menu: R(W / 2 - 230, 440, 460, 84) },
    result: { again: R(W / 2 - 330, 538, 320, 84), menu: R(W / 2 + 10, 538, 320, 84), rules: R(W / 2 - 330, 632, 660, 56), more: { x: W / 2, y: 706 }, titleY: 78, cx: W / 2, top: 150, bottom: 490, x0: W / 2 - 320, x1: W / 2 + 320 },
    demo: { panel: R(W / 2 - 320, 120, 640, 470), back: R(W / 2 - 230, 480, 460, 96), titleY: 215, msgY: 300 },
  };
}
function makeFrame(U, D) {
  const k = Math.min(1, U.w / D.W, U.h / D.H);
  return { k, dx: U.x0 + (U.w - D.W * k) / 2, dy: U.y0 + (U.h - D.H * k) / 2 };
}

// ---- play screens ----------------------------------------------------------------------------------------------------------------
function barRects(x, y, w, h, auto, wide) {
  if (!auto) return { hint: R(x, y, Math.min(190, w * 0.3), h), claim: R(x + Math.min(190, w * 0.3) + 12, y, w - Math.min(190, w * 0.3) - 12, h) };
  if (wide) {
    const g = 8, h1 = (h - g) / 2, hw = (w - g) / 2;
    return { pause: R(x, y, w * 0.46, h1), speed: R(x + w * 0.46 + g, y, w * 0.27 - g, h1), exit: R(x + w * 0.73 + g, y, w * 0.27 - g, h1), dec: R(x, y + h1 + g, hw, h1), inc: R(x + hw + g, y + h1 + g, hw, h1) };
  }
  const g = 10, wts = [1, 1, 1.05, 1, 1], unit = (w - g * 4) / wts.reduce((s, v) => s + v, 0);
  let cx = x; const rs = wts.map((wt) => { const r = R(cx, y, unit * wt, h); cx += unit * wt + g; return r; });
  return { exit: rs[0], dec: rs[1], pause: rs[2], inc: rs[3], speed: rs[4] };
}
// The stage: linen bag, tray with the current keg, call text and the rack of recent kegs.
function stageParts(S, auto) {
  const P = { rect: S };
  if (S.w / S.h >= 1.5) {      // a wide strip (portrait phone top)
    P.mode = 'row';
    const rackH = clamp(S.h * 0.27, 50, 80), top = S.h - rackH - 6;
    P.rack = R(S.x + 8, S.y + top + 6, S.w - 16, rackH); P.kegS = rackH * 0.86;
    const bagS = Math.min(top, 230);
    P.bag = { cx: S.x + 12 + bagS * 0.45, cy: S.y + top * 0.5, size: bagS * 0.92 };
    const trayW = Math.min(top * 1.45, S.w * 0.34), trayH = top * 0.84;
    P.tray = R(S.x + 12 + bagS * 0.9 + 6, S.y + (top - trayH) / 2, trayW, trayH);
    P.kegBig = Math.min(trayW * 0.74, trayH * 1.05);
    const tx = P.tray.x + P.tray.w + 16; P.text = R(tx, S.y + 4, S.x + S.w - tx - 8, top - 4);
  } else {                      // a tall column (landscape left side)
    P.mode = 'col';
    const bagS = Math.min(S.w * 0.38, S.h * 0.22);
    P.bag = { cx: S.x + S.w * 0.26, cy: S.y + bagS * 0.55, size: bagS };
    const trayW = S.w * 0.84, trayH = Math.min(trayW * 0.5, S.h * 0.22);
    P.tray = R(S.x + (S.w - trayW) / 2, S.y + bagS * 1.1 + 6, trayW, trayH);
    P.kegBig = Math.min(trayW * 0.6, trayH * 1.05);
    P.text = R(S.x + 8, P.tray.y + trayH + 16, S.w - 16, auto ? 118 : 84);
    const ry = P.text.y + P.text.h + 6;
    P.rack = R(S.x + 8, ry, S.w - 16, Math.max(60, S.y + S.h - ry - 56)); P.kegS = clamp(S.w * 0.13, 40, 64);
  }
  return P;
}
function playLayout(L, auto) {
  const { U } = L, m = 14, hudH = 58, barH = auto ? (L.land ? 128 : 76) : 80;
  const P = { auto, land: L.land };
  P.hud = { y: U.y0 + (L.land ? 8 : 46), h: hudH };
  const hudY = P.hud.y;
  if (!L.land) {
    const x0 = U.x0 + m, x1 = U.x1 - m, w = x1 - x0, bottom = U.y1 - m;
    P.bar = barRects(x0, bottom - barH, w, barH, auto, false); P.barTop = bottom - barH;
    P.opps = L.opps ? R(x0, hudY + hudH + 6, w, 52) : null;
    const top = hudY + hudH + 8 + (P.opps ? 58 : 0), avail = P.barTop - 10 - top;
    P.score = R(L.hx, hudY, 190, hudH); P.pause = auto ? null : R(x1 - 84, hudY, 84, hudH);
    P.ladder = R(L.hx + 200, hudY, Math.max(120, (auto ? x1 : x1 - 94) - (L.hx + 200)), hudH);
    const n = L.n;
    let stageH = n >= 3 ? 176 : Math.min(260, Math.max(190, avail * 0.2));
    let cards = fitCards(R(x0, top + stageH + 8, w, avail - stageH - 8), n);
    // give the stage whatever the cards cannot use (but keep the cards big)
    const free = avail - stageH - 8 - cards.h; stageH += clamp(free, 0, 480 - stageH);
    cards = fitCards(R(x0, top + stageH + 8, w, avail - stageH - 8), n);
    const S = R(x0, top, w, stageH); P.stage = stageParts(S, auto); P.cards = cards;
    P.toastY = top + stageH + 2;
  } else {
    const x0 = U.x0 + m, x1 = U.x1 - m, bottom = U.y1 - m, top = hudY + hudH + 8;
    const sw = clamp((x1 - x0) * (L.n >= 3 ? 0.235 : 0.3), L.n >= 3 ? 290 : 330, 520), gap = 14;
    P.score = R(L.hx, hudY, 200, hudH); P.pause = auto ? null : R(x1 - 84, hudY, 84, hudH);
    const lx = L.hx + 212; P.ladder = R(lx, hudY, Math.max(120, (auto ? x1 : x1 - 94) - lx), hudH);
    const cx0 = x0 + sw + gap, cw = x1 - cx0;
    P.bar = barRects(cx0, bottom - barH, cw, barH, auto, true); P.barTop = bottom - barH;
    P.opps = L.opps ? R(cx0, top, cw, 52) : null;
    const ct = top + (P.opps ? 58 : 0);
    P.cards = fitCards(R(cx0, ct, cw, P.barTop - 10 - ct), L.n);
    P.stage = stageParts(R(x0, top, sw, bottom - top), auto);
    P.toastY = P.barTop - 18;
  }
  return P;
}

// Face to face. Everything is laid out for the BOTTOM player; the top player's view is the same layout turned 180 degrees about the
// screen centre (game.js maps their taps with rot(x, y) = (w - x, h - y)).
function duoLayout(L) {
  const { U, w, h } = L, sym = Math.max(host.t, host.b), cy = h / 2, wide = L.land;
  const bandH = wide ? 132 : h >= 1270 ? 230 : 196, band = R(0, cy - bandH / 2, w, bandH);
  const top = band.y + band.h + 6, bot = h - sym - 8, claimH = wide ? 60 : 68;
  const D = { band, cx: w / 2, cy, bandH, pause: R(U.x0 + 8, cy - 40, 80, 80), claim: null };
  const areaH = bot - top - claimH - 10, area = R(U.x0 + 14, top, U.w - 28, areaH);
  D.area = area; D.cards = fitCards(area, L.nDuo);
  D.claim = R(w / 2 - 190, bot - claimH, 380, claimH);
  D.keg = Math.min(bandH * 0.78, 130); D.kegC = { x: w / 2, y: cy };
  D.rot = (x, y) => ({ x: w - x, y: h - y });
  return D;
}

// ---- builder -----------------------------------------------------------------------------------------------------------------------
const cache = new Map();
export function layoutFor(w, h, n = 3, nDuo = 1, opps = 1) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${n}|${nDuo}|${opps}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}|${Math.round(host.px * 100)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, n, nDuo, opps); cache.set(key, L); if (cache.size > 60) cache.delete(cache.keys().next().value); }
  return L;
}
function build(w, h, n, nDuo, opps) {
  const U = { x0: host.l, y0: host.t, x1: w - host.r, y1: h - host.b };
  U.w = U.x1 - U.x0; U.h = U.y1 - U.y0;
  const land = w >= h, L = { w, h, land, U, n, nDuo, opps };
  const UD = { x0: U.x0, y0: U.y0, w: U.w, h: U.h };
  const Hd = clamp(Math.round(720 * UD.h / UD.w), 1280, 1730), Wd = clamp(Math.round(720 * UD.w / UD.h), 1280, 1730);
  const kP = Math.min(1, UD.w / 720, UD.h / Math.max(1280, Hd)), kL = Math.min(1, UD.w / Math.max(1280, Wd), UD.h / 720);
  const useLand = kL > kP + 1e-6 || (Math.abs(kL - kP) < 1e-6 && land);
  const dim = useLand ? { W: Wd, H: 720 } : { W: 720, H: Hd }, fr = makeFrame(UD, dim);
  L.hx = host.back ? U.x0 + host.back + 12 : U.x0 + 14;
  const hxd = host.back ? Math.max(14, (L.hx - fr.dx) / fr.k) : 14;
  const D = useLand ? designLandscape(hxd, fr.k, Wd) : designPortrait(hxd, fr.k, Hd);
  L.d = Object.assign(D, fr, {
    to: (x, y) => ({ x: (x - fr.dx) / fr.k, y: (y - fr.dy) / fr.k }),
    scr: (r) => R(fr.dx + r.x * fr.k, fr.dy + r.y * fr.k, r.w * fr.k, r.h * fr.k),
  });
  const memo = new Map();
  L.menuRows = (scale = 1) => { const k = scale > 1.2 ? 'b' : 's'; if (!memo.has(k)) memo.set(k, D.menuRows(scale)); return memo.get(k); };
  L.setupRows = (keys) => D.setupRows(keys);
  L.lockTap = (m) => { const q = L.d.scr(m.lockup), st = L.d.scr(m.settings), mm = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(q.w + 24, mm), th = Math.max(q.h + 12, mm), y0 = Math.max(q.y - 4, st.y + st.h + 2);
    return R(q.x + q.w / 2 - tw / 2, y0, tw, Math.max(q.y + q.h + 6 - y0, Math.min(th, L.h - y0))); };
  L.play = playLayout(L, false); L.auto = playLayout(L, true); L.duo = duoLayout(L);
  return L;
}

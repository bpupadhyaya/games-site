// Screen geometry as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units, the long side
// follows the aspect ratio). One place for every rectangle, so game.js (hit-testing) and the drawing code never disagree.
//   portrait  W = 720, H = 960 .. 1728. The approved phone look (score bar on top, buttons at the bottom), anchored to the real edges.
//   wide      landscape (W >= 1.15 H, H = 720): score card + rotation map + hint on the LEFT, the action buttons on the RIGHT, the whole
//             court in the middle. The thumbs of both hands rest on the edges; nothing covers the court.
// `W` and `H` are live bindings: game.js calls setSize() every frame, every importer sees the new value.
import { frameFor } from './camera.js';

export let W = 720, H = 1280;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Host safe areas and the floating back button, in virtual units. main.js keeps this current (browsers: all zero). px = css px per unit.
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };
export function setSize(w, h) { if (w > 0 && h > 0) { W = Math.round(w); H = Math.round(h); } }
export const isWide = () => W >= H * 1.15;
export const safe = () => ({ x0: host.l, y0: host.t, x1: W - host.r, y1: H - host.b });
const R = (x, y, w, h) => ({ x, y, w, h });
// A tap target about 44 css px tall where the screen has the room: never below the designed height, at most 1.3 times it.
const tap = (base) => Math.round(Math.max(base, Math.min(44 / Math.max(0.3, host.px), base * 1.3)));

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
// The in-play HUD follows the text-size setting (100-300%) through a gentler multiplier so the court stays visible.
export const PLAY_M = [1, 1.18, 1.36, 1.52, 1.66];

const cache = new Map();
function memo(name, extra, fn) {
  const key = `${name}|${W}x${H}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${host.px.toFixed(2)}|${extra}`;
  let v = cache.get(key);
  if (!v) { v = fn(); cache.set(key, v); if (cache.size > 160) cache.delete(cache.keys().next().value); }
  return v;
}

// ---- menus (flow screens): a centred column; the title is two panes in landscape --------------------------------------------------
export function flowFrame(kind) {
  return memo('flow', kind, () => {
    const wide = isWide(), s = safe();
    const top = host.t + (host.back && kind !== 'title' ? host.back + 6 : 0);
    let bottom = H - host.b, colW, x0, hero = null;
    if (kind === 'title' && wide) {
      const half = (s.x1 - s.x0) / 2;
      colW = Math.min(520, half - 40);
      x0 = s.x0 + half + (half - colW) / 2;
      hero = R(s.x0, host.t, half, H - host.t - host.b);
    } else {
      colW = wide ? Math.min(760, s.x1 - s.x0 - 48) : Math.min(640, W - 80);
      x0 = (W - colW) / 2;
    }
    if (kind === 'setup') bottom = pinRects().top;
    if (kind === 'title') bottom -= 116;                         // room for the Arcforge lockup under the buttons
    return { x0, colW, top, bottom, hero, wide };
  });
}
export function pinRects() {
  return memo('pins', '', () => {
    const wide = isWide(), h = wide ? 76 : 96, y = H - Math.max(host.b, 0) - (wide ? 88 : 124), sw = wide ? 480 : 440, bw = wide ? 220 : 204, gap = 16;
    const left = (W - (sw + gap + bw)) / 2;
    return { start: R(left, y, sw, h), back: R(left + sw + gap, y, bw, h), top: y - (wide ? 10 : 26), msgY: y - 14 };
  });
}
export function pauseFrame() {
  return memo('pause', '', () => {
    const pw = Math.min(isWide() ? 760 : 660, W - 60);
    const top = Math.max(70, host.t + 12), bottom = H - Math.max(70, host.b + 12);
    return { px: (W - pw) / 2, pw, top, bottom };
  });
}

// ---- reference pages (Rules, How to Play, About): a scrolling reader ---------------------------------------------------------------
export function readerLayout() {
  return memo('reader', '', () => {
    const s = safe();
    if (!isWide()) {
      const pw = Math.min(W - 68, 900), top = host.t;
      const th = tap(60), inc = R(s.x1 - 140, top + 18, 120, th), dec = R(s.x0 + 20, top + 18, 120, th);
      let pct = { cx: W / 2, y: top + 56 };
      if (host.back) { dec.x = inc.x - 120 - 90; pct = { cx: (dec.x + dec.w + inc.x) / 2, y: top + 56 }; }
      const bw = Math.min(332, (W - 56) / 2), by = H - Math.max(host.b, 0) - 116;
      const panel = R((W - pw) / 2, top + 100, pw, by - 34 - (top + 100));
      return { wide: false, panel, dec, inc, pct, back: R(W / 2 - 8 - bw, by, bw, 100), next: R(W / 2 + 8, by, bw, 100), head: { title: 58, rule: 78, view: 96 }, view: { y0: panel.y + 96, y1: panel.y + panel.h - 14 } };
    }
    const colW = 220, gap = 16, pad = 24;
    const left = Math.max(s.x0 + pad, host.back ? s.x0 + host.back + 12 : 0), right = s.x1 - pad;
    const pw = Math.min(900, right - left - colW - gap), total = pw + gap + colW, px = left + (right - left - total) / 2, cx0 = px + pw + gap;
    const py = host.t + 12, ph = H - host.t - Math.max(host.b, 0) - 24;
    const panel = R(px, py, pw, ph);
    const bh = 72;
    return {
      wide: true, panel,
      pct: { cx: cx0 + colW / 2, y: py + 30 },
      dec: R(cx0, py + 44, (colW - 12) / 2, tap(64)), inc: R(cx0 + (colW - 12) / 2 + 12, py + 44, (colW - 12) / 2, tap(64)),
      next: R(cx0, py + ph - bh, colW, bh), back: R(cx0, py + ph - 2 * bh - 12, colW, bh),
      head: { title: 46, rule: 62, view: 74 }, view: { y0: py + 74, y1: py + ph - 14 },
    };
  });
}

// ---- in play ------------------------------------------------------------------------------------------------------------------------
// n = number of context buttons. Returns every HUD rectangle for the text-size index idx.
export function hudLayout(idx, n, wantHint = true) {
  const i = clamp(idx | 0, 0, PLAY_M.length - 1), m = PLAY_M[i];
  return memo('hud', `${i}|${n}|${wantHint}`, () => (isWide() ? wideHud(i, m, n) : tallHud(i, m, n, wantHint)));
}
function tallHud(i, m, n, wantHint) {
  const gap = 8, x0 = Math.max(12, host.l + 8), x1 = W - Math.max(12, host.r + 8), ww = x1 - x0;
  const topH = Math.round(104 * m) + host.t;
  const bottom = H - Math.max(12, host.b + 4);
  const utilH = tap(Math.round(62 * m));
  const util = [];
  const uw = (ww - gap * 2) / 3;
  for (let k = 0; k < 3; k++) util.push(R(x0 + k * (uw + gap), bottom - utilH, uw, utilH));
  let y = bottom - utilH - gap;
  const choices = [];
  if (n > 0) {
    const rowH = tap(Math.round(70 * m));
    const perRow = m >= 1.35 && n > 3 ? Math.ceil(n / 2) : n;
    const rows = Math.ceil(n / perRow);
    for (let r = rows - 1; r >= 0; r--) {
      const cnt = Math.min(perRow, n - r * perRow);
      const cw = (ww - gap * (cnt - 1)) / cnt;
      y -= rowH;
      for (let k = 0; k < cnt; k++) choices.push({ idx: r * perRow + k, rect: R(x0 + k * (cw + gap), y, cw, rowH) });
      y -= gap;
    }
    choices.sort((a, b) => a.idx - b.idx);
  }
  const hintH = wantHint && m < 1.5 ? Math.round(54 * m) : 0;
  let hint = null;
  if (hintH) { y -= hintH; hint = R(x0, y, ww, hintH); y -= 4; }
  const barTop = y;
  const mm = Math.min(m, 1.3);
  const mini = R(x0, topH + 8, Math.round(150 * mm), Math.round(112 * mm));
  return { wide: false, idx: i, m, topH, top0: host.t, util, choices, hint, barTop, mini, score: R(0, 0, W, topH), cx: W / 2, bannerY: topH + 150 * mm, noteY: topH + 24,
    court: courtRectTall(), blocked: (x, yy) => yy > barTop - 4 };
}
function wideHud(i, m, n) {
  const mm = Math.min(m, 1.25);
  const pw = clamp(Math.round(W * 0.19), 190, 280), pad = Math.max(12, host.l + 8), padR = Math.max(12, host.r + 8);
  const lx = pad, rx = W - padR - pw, topY = host.t + (host.back ? host.back + 6 : 10), botY = H - Math.max(host.b, 0) - 12;
  // left column: score card, rotation map, hint
  const score = R(lx, topY, pw, Math.round(176 * mm));
  const miniH = Math.round(Math.min(150 * mm, (pw - 8) * 0.72));
  const mini = R(lx, score.y + score.h + 10, pw, miniH);
  const hintY = mini.y + mini.h + 10;
  const hint = R(lx, hintY, pw, Math.max(0, botY - hintY));
  // right column: the action buttons, anchored to the bottom (thumb reach)
  const count = 3 + n, gap = 8, grp = 12;
  const avail = botY - (host.t + 10);
  const bh = Math.round(Math.min(tap(Math.round(66 * mm)), (avail - gap * (count - 1) - grp) / count));
  const util = [];
  let y = botY;
  for (let k = 2; k >= 0; k--) { y -= bh; util[k] = R(rx, y, pw, bh); y -= gap; }
  y -= grp - gap;
  const choices = [];
  for (let k = n - 1; k >= 0; k--) { y -= bh; choices[k] = { idx: k, rect: R(rx, y, pw, bh) }; y -= gap; }
  const barTop = y;
  const side = Math.max(lx + pw, W - rx) + 6;
  const court = { x0: side, y0: host.t + 12, x1: W - side, y1: H - Math.max(host.b, 0) - 12 };
  return { wide: true, idx: i, m, mm, topH: 0, top0: host.t, util, choices, hint, barTop, mini, score, panelW: pw, left: R(lx, topY, pw, botY - topY), right: R(rx, barTop, pw, botY - barTop), cx: (court.x0 + court.x1) / 2,
    bannerY: court.y0 + 18, noteY: court.y1 - 14, court, blocked: (x) => x < lx + pw + 4 || x > rx - 4 };
}
// Where the court may be drawn (virtual units). Independent of the text size and of the number of buttons, so the camera never jumps.
function courtRectTall() {
  const topH = 104 + host.t, bottom = H - Math.max(12, host.b + 4);
  const barTop = bottom - tap(62) - 8 - tap(70) - 8 - 54 - 4;
  return { x0: 0, y0: topH - 8, x1: W, y1: barTop + 30 };
}
export function courtRect() {
  return memo('court', '', () => (isWide() ? wideHud(0, 1, 5).court : courtRectTall()));
}
// The match camera for this screen size. Pure function of (W, H, insets); cached.
export function playFrame() {
  return memo('frame', '', () => {
    if (isWide()) return { ...frameFor(W, H, courtRect(), 'wide'), mode: 'wide' };
    if (H >= W * 1.7778 - 1) return { ...frameFor(W, H, courtRect(), 'tall'), mode: 'tall' };
    return { ...frameFor(W, H, courtRect(), 'fit'), mode: 'fit' };
  });
}

// Watch & Learn: Pause / Think- / Think+ / Quit and the phase label.
export function watchLayout(m) {
  m = Math.min(1.3, m);
  return memo('watch', String(m), () => {
    if (!isWide()) {
      const h = tap(Math.round(64 * m)), y = H - Math.max(12, host.b + 4) - h, gap = 8, x0 = Math.max(12, host.l + 8), ww = W - x0 - Math.max(12, host.r + 8);
      const ws = [0.34, 0.22, 0.22, 0.22]; let x = x0;
      const rects = ws.map((f) => { const w = (ww - gap * 3) * f; const r = R(x, y, w, h); x += w + gap; return r; });
      return { rects, label: { cx: W / 2, y: y - 14 }, shade: y - 56, wide: false };
    }
    const lay = hudLayout(0, 0, false);
    const bh = Math.round(Math.min(tap(Math.round(70 * Math.min(m, 1.25))), 84)), gap = 10, rx = lay.right.x;
    const botY = H - Math.max(host.b, 0) - 12, rects = [];
    for (let k = 3; k >= 0; k--) rects[k] = R(rx, botY - (4 - k) * bh - (3 - k) * gap, lay.panelW, bh);
    const lab = R(lay.left.x, lay.mini.y, lay.panelW, 90);
    return { rects, label: { cx: lab.x + lab.w / 2, y: lab.y + lab.h / 2 }, labelRect: lab, shade: 0, wide: true };
  });
}

// Think / Watch card and the rotation overlay.
export function thinkCard(lineCount, lh, sc) {
  const wide = isWide(), cw = Math.min(wide ? 760 : 660, W - (wide ? 80 : 60));
  const bh = Math.round(72 * Math.min(sc, 1.4));
  const maxH = wide ? H - host.t - host.b - 24 : H - 300;
  const h = Math.min(maxH, Math.max(300, 160 + lineCount * lh + 120));
  const y = wide ? Math.max(host.t + 12, (H - h) / 2) : Math.max(host.t + 130, (H - h) / 2 - 60);
  return { x: (W - cw) / 2, y, w: cw, h, bh };
}
export function rotLayout() {
  return memo('rot', '', () => {
    if (!isWide()) {
      const y = Math.max(host.t + 10, Math.round((H - 760) / 2) - 20), x = (W - 640) / 2;
      return { wide: false, panel: R(x, y, 640, 760), title: { x: W / 2, y: y + 58 }, grid: { x: W / 2 - 285, y: y + 112, cw: 190, ch: 150, gapY: 18 }, text: { x: W / 2, y: y + 486, w: 580 }, close: R(W / 2 - 160, y + 666, 320, tap(70)) };
    }
    const pw = Math.min(W - 80, 1000), ph = H - host.t - Math.max(host.b, 0) - 24, x = (W - pw) / 2, y = host.t + 12;
    const gw = 3 * 168;
    return { wide: true, panel: R(x, y, pw, ph), title: { x: x + pw / 2, y: y + 54 }, grid: { x: x + 36, y: y + 122, cw: 168, ch: 132, gapY: 14 }, text: { x: x + 36 + gw + 36 + (pw - gw - 108) / 2, y: y + 118, w: pw - gw - 108 }, close: R(x + pw - 36 - 280, y + ph - 16 - tap(70), 280, tap(70)) };
  });
}

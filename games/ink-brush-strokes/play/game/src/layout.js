// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// Three shapes: tall (portrait phone, h >= 1.5 w), compact (tablets / 4:3), wide (landscape, w >= 1.2 h: side panels).
import { PAGE } from './lessons.js';

export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Safe areas and the host's floating back button in virtual units; main.js keeps this current (browsers: zeros).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };      // px = css pixels per virtual unit
export const minBtn = () => Math.max(60, 46 / Math.max(0.2, host.px));

const cache = new Map();
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const fit = (area, aspect, pad = 0) => {                         // largest rect of the given w/h aspect inside area
  let w = area.w - pad * 2, h = w / aspect;
  if (h > area.h - pad * 2) { h = area.h - pad * 2; w = h * aspect; }
  return R(area.x + (area.w - w) / 2, area.y + (area.h - h) / 2, w, h);
};

export function layoutFor(w, h, nTools = 8, extra = 0) {
  const key = `${Math.round(w)}x${Math.round(h)}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${host.px.toFixed(2)}|${nTools}|${extra}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, nTools, extra); if (cache.size > 12) cache.clear(); cache.set(key, L); }
  return L;
}

// Tools: n square-ish buttons packed into `area` with `cols` columns.
function grid(area, n, cols, gap, hMax) {
  const rows = Math.ceil(n / cols), cw = (area.w - gap * (cols - 1)) / cols, ch = Math.min(hMax, (area.h - gap * (rows - 1)) / rows), out = [];
  for (let i = 0; i < n; i++) { const c = i % cols, r = Math.floor(i / cols); out.push(R(area.x + c * (cw + gap), area.y + r * (ch + gap), cw, ch)); }
  return out;
}

function build(w, h, nTools, extra) {
  const mode = w >= h * 1.2 ? 'wide' : h >= w * 1.5 ? 'tall' : 'compact';
  const S = R(host.l, host.t, w - host.l - host.r, h - host.t - host.b);
  const mb = minBtn();
  const backPad = host.back > 0 ? host.back + 8 : 0;
  const L = { w, h, mode, S, mb, backPad };

  // ---- PRACTICE / FREE ---------------------------------------------------------------------------------------------------------------
  {
    const P = {};
    const tb = Math.max(72, mb), g = 10;
    if (mode === 'wide') {
      const pw = clamp(S.w * 0.25, 250, 390);
      P.panelL = R(S.x + 14, S.y + 14 + (backPad ? backPad + 6 : 0), pw, S.h - 28 - (backPad ? backPad + 6 : 0));
      P.panelR = R(S.x + S.w - 14 - pw, S.y + 14, pw, S.h - 28);
      P.menu = R(P.panelR.x + 12, P.panelR.y + 12, P.panelR.w - 24, tb);
      const toolArea = R(P.panelR.x + 12, P.menu.y + tb + 16, P.panelR.w - 24, P.panelR.h - tb - 40);
      const cols = 2, rows = Math.ceil(nTools / cols), th = clamp((toolArea.h - g * (rows - 1)) / rows, 70, 110);
      P.tools = grid(R(toolArea.x, toolArea.y, toolArea.w, th * rows + g * (rows - 1)), nTools, cols, g, th);
      P.paper = fit(R(P.panelL.x + pw + 10, S.y + 46, P.panelR.x - 10 - (P.panelL.x + pw + 10), S.h - 56), PAGE.w / PAGE.h, 4);   // top 46: the kit's preview pill sits above the paper
      P.title = { x: P.panelL.x + 18, y: P.panelL.y + 44, w: pw - 36 };
      P.model = R(P.panelL.x + 18, P.panelL.y + 78, pw - 36, Math.min(pw - 36, Math.max(120, S.h * 0.2)));
      P.chips = R(P.panelL.x + 14, P.model.y + P.model.h + 12, pw - 28, 110);
      P.coach = R(P.panelL.x + 12, P.chips.y + P.chips.h + 8, pw - 24, P.panelL.y + P.panelL.h - 12 - (P.chips.y + P.chips.h + 8));
    } else {
      const toolRows = mode === 'tall' && nTools > 3 ? 2 : 1, th = mode === 'tall' ? Math.max(86, mb + 18) : Math.max(84, mb + 14);
      const cols = Math.ceil(nTools / toolRows);
      const toolH = th * toolRows + g * (toolRows - 1);
      P.menu = R(S.x + S.w - 12 - tb, S.y + 8, tb, tb);
      P.title = { x: S.x + 14 + backPad, y: S.y + 8 + tb / 2, w: P.menu.x - 14 - (S.x + 14 + backPad) };
      P.chips = R(S.x + 12, S.y + 8 + tb + 6, S.w - 24, 56);
      P.tools = grid(R(S.x + 12, S.y + S.h - 12 - toolH, S.w - 24, toolH), nTools, cols, g, th);
      const coachH = mode === 'tall' ? 112 : 88;
      P.coach = R(S.x + 14, P.tools[0].y - 8 - coachH, S.w - 28, coachH);
      const top = P.chips.y + P.chips.h + 6;
      P.paper = fit(R(S.x, top, S.w, P.coach.y - 6 - top), PAGE.w / PAGE.h, 6);
      P.model = null;
    }
    L.play = P;
    // overlays that share the geometry: seal row (free + result), scroll arrows
    const sr = P.paper;
    const sw = Math.min(88, (sr.w - 40) / 6);
    P.seals = Array.from({ length: 6 }, (_, i) => R(sr.x + (sr.w - sw * 6 - 8 * 5) / 2 + i * (sw + 8), sr.y + sr.h - sw - 14, sw, sw));
  }

  // ---- TITLE -------------------------------------------------------------------------------------------------------------------------
  {
    const T = {};
    const bh = mode === 'tall' ? Math.max(S.h < 1300 ? 74 : 84, mb) : Math.max(70, mb), sh = Math.max(64, mb), gp = 12;
    const rowsFor = mode === 'compact' ? [['play'], ['free', 'gallery'], ['auto', 'how'], ['rules', 'about', 'settings']] : [['play'], ['free'], ['gallery'], ['auto'], ['how', 'rules'], ['about', 'settings']];
    const rowH = (r) => (r.length === 1 && r[0] === 'play' ? bh + 14 : r.length === 1 ? bh : sh);
    const total = rowsFor.reduce((s, r) => s + rowH(r) + gp, -gp);
    let bw, bx, y0;
    if (mode === 'wide') {
      bw = clamp(S.w * 0.3, 300, 460); bx = S.x + S.w - 40 - bw; y0 = S.y + Math.max(20, (S.h - 70 - total) / 2);
      T.titleX = S.x + (bx - S.x) / 2;
      const hw = clamp((bx - S.x) - 120, 260, 560);
      T.hero = fit(R(S.x + 30, S.y + S.h * 0.27, bx - S.x - 60, S.h * 0.73 - 108), 0.75, 0);
      T.hero = R(T.titleX - Math.min(T.hero.w, hw) / 2, T.hero.y, Math.min(T.hero.w, hw), Math.min(T.hero.w, hw) / 0.75);
      T.titleY = S.y + Math.max(64, S.h * 0.1); T.size = Math.min(120, (bx - S.x - 80) / 5);
    } else {
      bw = Math.min(S.w - 48, 600); bx = S.x + (S.w - bw) / 2;
      const credit = 98; y0 = S.y + S.h - credit - total;
      T.titleX = S.x + S.w / 2; T.size = Math.min(124, (S.w - 80) / 5);
      T.titleY = S.y + Math.max(70, (y0 - S.y) * 0.075) + T.size * 0.3;
      const hy = T.titleY + T.size * 1.15 + 22, hh = y0 - 14 - hy;
      T.hero = fit(R(S.x + 20, hy, S.w - 40, hh), 0.75, 0);
    }
    let y = y0;
    for (const r of rowsFor) {
      const hgt = rowH(r), cw = (bw - gp * (r.length - 1)) / r.length;
      r.forEach((id, i) => { T[id] = R(bx + i * (cw + gp), y, cw, hgt); });
      y += hgt + gp;
    }
    T.col = R(bx, y0, bw, total);
    T.credit = { x: S.x + S.w / 2, y: S.y + S.h - 14 };
    L.title = T;
  }

  // ---- LESSON LIST (scrolling) ---------------------------------------------------------------------------------------------------------
  {
    const G = {};
    const hb = Math.max(64, mb);
    G.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), hb);
    G.titleY = S.y + 12 + hb / 2;
    G.view = R(S.x + 8, S.y + hb + 28, S.w - 16, S.h - hb - 36);
    G.cols = mode === 'wide' ? (S.w > 1100 ? 4 : 3) : mode === 'compact' ? 2 : 1;
    L.lessons = G;
  }

  // ---- RESULT / GRIND / PAUSE / GALLERY ---------------------------------------------------------------------------------------------------
  {
    const bh = Math.max(76, mb);
    const pw = Math.min(S.w - 28, mode === 'wide' ? 900 : 640), ph = Math.min(S.h - 28, mode === 'wide' ? 620 : 1000);
    const panel = R(S.x + (S.w - pw) / 2, S.y + (S.h - ph) / 2, pw, ph);
    const Rr = { panel };
    if (mode === 'wide') {
      const bwid = (pw - 64 - 24) / 3;
      Rr.retry = R(panel.x + 32, panel.y + panel.h - 32 - bh, bwid, bh); Rr.keep = R(Rr.retry.x + bwid + 12, Rr.retry.y, bwid, bh); Rr.next = R(Rr.keep.x + bwid + 12, Rr.retry.y, bwid, bh);
      Rr.menu = R(panel.x + panel.w - 32 - 150, panel.y + 18, 150, 60);
      Rr.seals = Array.from({ length: 6 }, (_, i) => R(panel.x + 32 + i * ((pw - 64) / 6), Rr.retry.y - 20 - 78, (pw - 64) / 6 - 8, 78));
    } else {
      const bwid = pw - 64;
      Rr.next = R(panel.x + 32, panel.y + panel.h - 24 - bh, bwid, bh); Rr.keep = R(panel.x + 32, Rr.next.y - 12 - bh, bwid, bh); Rr.retry = R(panel.x + 32, Rr.keep.y - 12 - bh, bwid, bh);
      Rr.menu = R(panel.x + panel.w - 32 - 150, panel.y + 16, 150, 60);
      Rr.seals = Array.from({ length: 6 }, (_, i) => R(panel.x + 24 + i * ((pw - 48) / 6), Rr.retry.y - 18 - 80, (pw - 48) / 6 - 8, 80));
    }
    L.result = Rr;
    const gw = Math.min(S.w - 28, mode === 'wide' ? 760 : 620), gh = Math.min(S.h - 28, mode === 'wide' ? 560 : 780);
    const gp = R(S.x + (S.w - gw) / 2, S.y + (S.h - gh) / 2, gw, gh);
    L.grind = { panel: gp, stone: { x: gp.x + gp.w / 2, y: gp.y + gp.h * 0.5, rx: Math.min(gw * 0.36, gh * 0.4), ry: Math.min(gw * 0.36, gh * 0.4) * 0.62 }, done: R(gp.x + 32, gp.y + gp.h - 24 - bh, gp.w - 64, bh) };
    // gallery
    const G = {}; const hb = Math.max(64, mb);
    G.back = R(S.x + 12 + backPad, S.y + 12, Math.max(120, mb * 1.7), hb); G.titleY = S.y + 12 + hb / 2;
    const cols = mode === 'wide' ? 4 : mode === 'compact' ? 3 : 2, gap = 14, top = S.y + hb + 34, aw = S.w - 28;
    const cw = (aw - gap * (cols - 1)) / cols, chh = cw / 0.75 + 44;
    G.cols = cols; G.cell = { w: cw, h: chh, gap, x: S.x + 14, top }; G.view = R(S.x + 8, top, S.w - 16, S.h - (top - S.y) - 8);
    const wr = fit(R(S.x, S.y + hb + 28, S.w, S.h - hb - 28 - Math.max(84, mb) - 24), 0.75, 8);
    G.work = wr; G.del = R(S.x + S.w / 2 - 150 - 8, S.y + S.h - 16 - Math.max(80, mb), 150, Math.max(70, mb)); G.share = R(S.x + S.w / 2 + 8, G.del.y, 150, G.del.h);
    L.gallery = G;
  }

  // ---- DOCUMENT screens (Rules, About, How to Play, Settings) -----------------------------------------------------------------------------
  {
    const Dc = {};
    const bh = Math.max(64, mb), margin = mode === 'wide' ? Math.max(24, S.w * 0.06) : 16;
    const contentW = Math.min(S.w - margin * 2, mode === 'wide' ? 1100 : 820);
    const cx = S.x + (S.w - contentW) / 2;
    Dc.back = R(S.x + 12 + backPad, S.y + 12, Math.max(110, mb * 1.6), bh);
    const decW = Math.max(64, mb);
    Dc.textInc = R(S.x + S.w - 12 - decW, S.y + 12, decW, bh);
    Dc.textDec = R(Dc.textInc.x - 10 - decW, S.y + 12, decW, bh);
    Dc.headerH = bh + 24;
    const navH = bh;
    Dc.nav = { back: R(cx, S.y + S.h - 14 - navH, (contentW - 12) / 2, navH), next: R(cx + (contentW - 12) / 2 + 12, S.y + S.h - 14 - navH, (contentW - 12) / 2, navH) };
    Dc.viewport = R(cx, S.y + Dc.headerH + 56, contentW, S.y + S.h - 14 - navH - 12 - (S.y + Dc.headerH + 56));
    Dc.titleY = S.y + 12 + bh / 2; Dc.contentW = contentW;
    L.doc = Dc;
  }
  return L;
}

// A small centred menu of n buttons (pause menu, end-of-demo): { panel, btns[] }.
export function menuRects(L, n, extraTop = 120) {
  const S = L.S, bh = Math.max(76, L.mb), gap = 12, pw = Math.min(S.w - 40, 560), ph = extraTop + n * bh + (n - 1) * gap + 36;
  const panel = R(S.x + (S.w - pw) / 2, S.y + (S.h - ph) / 2, pw, ph), btns = [];
  for (let i = 0; i < n; i++) btns.push(R(panel.x + 28, panel.y + extraTop + i * (bh + gap), pw - 56, bh));
  return { panel, btns };
}

// Lesson-list content layout (scroll space), cached by width.
const listCache = new Map();
export function lessonItems(L, lessons, groups) {
  const G = L.lessons, key = `${Math.round(G.view.w)}|${G.cols}|${lessons.length}`;
  let o = listCache.get(key);
  if (o) return o;
  const gap = 14, cols = G.cols, cw = (G.view.w - 16 - gap * (cols - 1)) / cols, chh = clamp(cw * (cols === 1 ? 0.3 : 0.52), 150, 190);
  const items = [], heads = []; let y = 6;
  for (const [gid, gname] of groups) {
    heads.push({ y, text: gname }); y += 56;
    const list = lessons.filter((l) => l.group === gid);
    list.forEach((l, i) => { const c = i % cols, r = Math.floor(i / cols); items.push({ id: l.id, r: R(8 + c * (cw + gap), y + r * (chh + gap), cw, chh) }); });
    y += Math.ceil(list.length / cols) * (chh + gap) + 14;
  }
  o = { items, heads, total: y }; if (listCache.size > 6) listCache.clear(); listCache.set(key, o);
  return o;
}

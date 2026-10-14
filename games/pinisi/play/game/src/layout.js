// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
// layoutFor(w, h) returns every rect for that size, cached by size + insets. Shapes:
//   tall     portrait phone: HUD on top, the chart, the panel below.
//   compact  portrait tablet / 4:3: the same order with a shorter chart.
//   wide     landscape: chart on the left, the panel on the right.
import { v3 } from './v3.js';
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Safe areas and the host's floating back button in virtual units; main.js keeps this current (browsers: zeros).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };      // px = css pixels per virtual unit
export const minBtn = () => Math.max(60, 46 / Math.max(0.2, host.px));

const cache = new Map();
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function layoutFor(w, h) {
  const key = `${Math.round(w)}x${Math.round(h)}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${host.px.toFixed(2)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h); if (cache.size > 8) cache.clear(); cache.set(key, L); }
  return L;
}

function build(w, h) {
  const S = R(host.l, host.t, w - host.l - host.r, h - host.t - host.b);
  const mode = w >= h * 1.15 ? 'wide' : h >= w * 1.5 ? 'tall' : 'compact';
  const m = minBtn(), gap = 14, pad = 20;
  const backW = 170, hdr = Math.max(64, m);
  const top = S.y + 12;
  const hx = S.x + 16 + host.back;                       // headers start right of the host's floating back button
  const L = { w, h, S, mode, m };

  // ---- text screens -------------------------------------------------------------------------------------------------------------
  const navH = Math.max(72, m + 8);
  L.doc = {
    back: R(hx, top, backW, hdr),
    textDec: R(S.x + S.w - 16 - 2 * 104 - 10, top, 104, hdr),
    textInc: R(S.x + S.w - 16 - 104, top, 104, hdr),
    viewport: R(S.x + 16, top + hdr + 62, S.w - 32, S.h - hdr - 62 - 12 - 12),
  };
  L.doc.nav = { back: R(S.x + 16, S.y + S.h - navH - 12, (S.w - 32 - gap) / 2, navH), next: R(S.x + 16 + (S.w - 32 - gap) / 2 + gap, S.y + S.h - navH - 12, (S.w - 32 - gap) / 2, navH) };
  L.doc.viewportNav = R(L.doc.viewport.x, L.doc.viewport.y, L.doc.viewport.w, L.doc.nav.back.y - gap - L.doc.viewport.y);

  // ---- title ----------------------------------------------------------------------------------------------------------------------
  const bh = Math.max(m, 76), small = Math.max(m, 62);
  if (mode === 'wide') {
    const colW = Math.min(500, S.w * 0.42), cx = S.x + S.w - colW - 28;
    const t = { hero: R(S.x + 20, S.y + 30, cx - S.x - 40, S.h - 110) };
    t.size = clamp((cx - S.x) * 0.16, 56, 120); t.titleY = S.y + S.h * 0.18;
    let y = S.y + Math.max(26, S.h * 0.06);
    t.play = R(cx, y, colW, bh + 12); y += bh + 12 + gap;
    t.cont = R(cx, y, colW, small); y += small + gap;
    t.auto = R(cx, y, colW, small); y += small + gap;
    const cw = (colW - gap) / 2;
    t.how = R(cx, y, cw, small); t.rules = R(cx + cw + gap, y, cw, small); y += small + gap;
    t.about = R(cx, y, cw, small); t.settings = R(cx + cw + gap, y, cw, small);
    t.credit = { x: cx + colW / 2, y: S.y + S.h - 16 }; { const w2 = Math.min(250, colW * 0.8); t.lock = { w: w2, h: w2 * 354 / 1296 }; }
    t.col = R(cx, S.y, colW, S.h);
    L.title = t;
  } else {
    const t = {}; const cw = (Math.min(S.w - 48, 620) - gap) / 2, bw = cw * 2 + gap, bx = S.x + (S.w - bw) / 2;
    const lkw = Math.min(250, S.w * 0.5), lkh = lkw * 354 / 1296;
    const bottom = S.y + S.h - lkh - 28;
    const nBtn = 3, stackH = (bh + 12) + small * 2 + gap * 3 + small * 2 + gap;
    let y = bottom - stackH;
    t.hero = R(S.x + 12, S.y + 20, S.w - 24, Math.max(220, y - S.y - 40));
    t.size = clamp(S.w * 0.17, 60, 130); t.titleY = S.y + clamp(S.h * 0.1, 80, 180);
    void nBtn;
    t.play = R(bx, y, bw, bh + 12); y += bh + 12 + gap;
    t.cont = R(bx, y, bw, small); y += small + gap;
    t.auto = R(bx, y, bw, small); y += small + gap;
    t.how = R(bx, y, cw, small); t.rules = R(bx + cw + gap, y, cw, small); y += small + gap;
    t.about = R(bx, y, cw, small); t.settings = R(bx + cw + gap, y, cw, small);
    t.credit = { x: S.x + S.w / 2, y: S.y + S.h - 16 }; t.lock = { w: lkw, h: lkh };
    L.title = t;
  }

  // ---- voyage setup (choose the mode and the monsoon) --------------------------------------------------------------------------
  {
    const bw = Math.min(S.w - 40, 760), x = S.x + (S.w - bw) / 2;
    const back = R(hx, top, backW, hdr);
    const panelY = top + hdr + 70, ph = Math.min(S.h - hdr - 70 - 24 - bh - 24, 640);
    const panel = R(x, panelY, bw, ph);
    const half = (bw - 40 - gap) / 2, wideRow = mode === 'wide';
    const cardH = wideRow ? 230 : 190;
    const q = wideRow ? R(x + 20, panelY + 20, half, cardH) : R(x + 20, panelY + 20, bw - 40, cardH);
    const mo = wideRow ? R(x + 20 + half + gap, panelY + 20, half, cardH) : R(x + 20, panelY + 20 + cardH + gap, bw - 40, cardH);
    const tgY = (wideRow ? q.y + cardH : mo.y + cardH) + 22;
    const tw = (bw - 40 - gap) / 2;
    L.setup = { hero: { x: S.x, y: panelY + ph + 20 + bh + 14, w: S.w, h: Math.max(0, S.y + S.h - (panelY + ph + 20 + bh + 14) - 10) }, back, panel, quick: q, monsoon: mo, west: R(x + 20, tgY + 36, tw, Math.max(m, 66)), east: R(x + 20 + tw + gap, tgY + 36, tw, Math.max(m, 66)), togLabel: { x: x + 20, y: tgY + 8 }, next: R(x, panelY + ph + 20, bw, bh) };
  }

  // ---- shipyard ---------------------------------------------------------------------------------------------------------------------
  {
    const back = R(hx, top, backW, hdr);
    const Y = { back };
    if (mode === 'wide') {
      const lw = Math.min(S.w * 0.5, 700);
      Y.preview = R(S.x + 16, top + hdr + 12, lw - 16, S.h - hdr - 24 - 230);
      Y.stats = R(S.x + 16, Y.preview.y + Y.preview.h + 10, lw - 16, 200);
      const rx = S.x + lw + 16, rw = S.w - lw - 32;
      Y.right = R(rx, top + hdr + 8, rw, S.h - hdr - 20);
    } else {
      const ph = clamp(S.h * 0.31, 230, 560);
      Y.preview = R(S.x + 16, top + hdr + 8, S.w - 32, ph);
      Y.stats = R(S.x + 16, Y.preview.y + ph + 8, S.w - 32, 94);
      const y0 = Y.stats.y + Y.stats.h + 8;
      Y.right = R(S.x + 16, y0, S.w - 32, S.y + S.h - y0 - 12);
    }
    const cr = Y.right, btnH = Math.max(m + 4, 72);
    Y.go = R(cr.x, cr.y + cr.h - btnH, cr.w, btnH);
    // three option groups share the space above the button
    const gh = (cr.h - btnH - gap - 24) / 3, lab = 34, cardH2 = Math.max(60, gh - lab - 6);
    Y.groups = [0, 1, 2].map((i) => {
      const y = cr.y + i * (gh + 12), cw3 = (cr.w - gap * 2) / 3;
      return { label: { x: cr.x + 4, y: y + lab / 2 }, cards: [0, 1, 2].map((j) => R(cr.x + j * (cw3 + gap), y + lab, cw3, cardH2)) };
    });
    // fitting task (replaces the groups)
    Y.task = { bar: R(cr.x, cr.y + 110, cr.w, 96), tap: R(cr.x, cr.y + 236, cr.w, Math.max(110, Math.min(520, cr.h - 236 - 20))), dots: { x: cr.x, y: cr.y + 8, w: cr.w } };
    L.yard = Y;
  }

  // ---- voyage (chart + panel) --------------------------------------------------------------------------------------------------------
  {
    const V = {};
    const hudH = 72;
    V.hudY = top;
    if (mode === 'wide') {
      V.hud = R(S.x + 12 + host.back, top, S.w - 24 - host.back, hudH);
      const my = top + hudH + 8, mh = S.y + S.h - my - 8, mw = Math.min(mh * 1.04, S.w * 0.56);
      V.map = R(S.x + 8, my, mw, mh);
      V.panel = R(S.x + 8 + mw + 10, my, S.w - mw - 26, mh);
    } else {
      V.hud = R(S.x + 12 + host.back, top, S.w - 24 - host.back, hudH);
      const my = top + hudH + 8, minPanel = 640;
      const mh = clamp(S.y + S.h - my - minPanel - 8, 290, S.w * 0.98);
      V.map = R(S.x + 6, my, S.w - 12, mh);
      V.panel = R(S.x + 8, my + mh + 8, S.w - 16, S.y + S.h - (my + mh + 8) - 8);
    }
    L.voy = V;
  }

  // ---- result + pause menu --------------------------------------------------------------------------------------------------------
  {
    const pw = Math.min(S.w - 32, 820), ph = Math.min(S.h - 40, mode === 'wide' ? S.h - 40 : 900);
    const px = S.x + (S.w - pw) / 2, py = S.y + (S.h - ph) / 2;
    const bh2 = Math.max(m + 4, 76);
    L.result = {
      panel: R(px, py, pw, ph - bh2 - 24),
      again: R(px, py + ph - bh2, (pw - gap) / 2, bh2), menu: R(px + (pw + gap) / 2, py + ph - bh2, (pw - gap) / 2, bh2),
      more: { x: px + pw / 2, y: py + ph + 14 > S.y + S.h - 6 ? S.y + S.h - 6 : py + ph + 14 },
    };
  }
  L.pad = pad;
  return L;
}

export function menuRects(L, n) {
  const m = L.m, bw = Math.min(L.S.w - 60, 520), bh = Math.max(m + 6, 84), gap = 16;
  const total = n * bh + (n - 1) * gap + 120, y0 = L.S.y + (L.S.h - total) / 2;
  const x = L.S.x + (L.S.w - bw) / 2;
  return { title: { x: L.S.x + L.S.w / 2, y: y0 + 34 }, btns: Array.from({ length: n }, (_, i) => R(x, y0 + 100 + i * (bh + gap), bw, bh)) };
}

// Port panel inner rects (shared by the drawing and by the hit tests).
export function portPanel(P, auto) {
  const g = 10, pad = 14, m = minBtn();
  let y = P.y + pad;
  const out = { P };
  if (auto) { out.coach = R(P.x + pad, y, P.w - pad * 2, Math.min(210, P.h * 0.4)); y += out.coach.h + g; }
  const thinkW = Math.max(m + 40, 130);
  out.head = R(P.x + pad, y, P.w - pad * 2 - thinkW - g, 66);
  out.think = R(P.x + P.w - pad - thinkW, y + 4, thinkW, Math.max(m, 58));
  y += 66 + g;
  const bw = (P.w - pad * 2 - g * 2) / 3;
  out.lots = [0, 1, 2].map((i) => R(P.x + pad + i * (bw * 0.5 + 6), y, bw * 0.5, 54));
  out.yard = R(P.x + pad + bw * 1.5 + 12, y, (P.w - pad * 2 - (bw * 1.5 + 12) - g) / 2, 54);
  out.wait = R(out.yard.x + out.yard.w + g, y, out.yard.w, 54);
  y += 54 + g;
  const stripH = Math.max(m + 18, 104);
  out.strip = R(P.x + pad, P.y + P.h - pad - stripH, P.w - pad * 2, stripH);
  out.list = R(P.x + pad, y, P.w - pad * 2, Math.max(60, out.strip.y - g - y));
  out.rowH = Math.max(m, 66);
  const gw = Math.min(250, out.strip.w * 0.4);
  out.go = R(out.strip.x + out.strip.w - gw - 8, out.strip.y + (stripH - Math.max(m + 4, 70)) / 2, gw, Math.max(m + 4, 70));
  return out;
}

export function seaPanel(P, auto) {
  const g = 10, pad = 14, m = minBtn();
  let y = P.y + pad; const out = { P };
  if (auto) { out.coach = R(P.x + pad, y, P.w - pad * 2, Math.min(210, P.h * 0.38)); y += out.coach.h + g; }
  out.leg = R(P.x + pad, y, P.w - pad * 2, 62); y += 62 + g;
  const remain = P.y + P.h - pad - y;
  const winH = clamp(remain * 0.32, 100, 210);
  out.wind = R(P.x + pad, y, P.w - pad * 2, winH); y += winH + g;
  const bottomH = Math.max(m, 62);
  const setH = clamp(P.y + P.h - pad - bottomH - g - y, 96, 300);
  const bw = (P.w - pad * 2 - g * 2) / 3;
  out.set = [0, 1, 2].map((i) => R(P.x + pad + i * (bw + g), y, bw, setH));
  y += setH + g;
  out.hold = R(P.x + pad, y, (P.w - pad * 2) * 0.58, bottomH);
  out.think = R(out.hold.x + out.hold.w + g, y, P.w - pad * 2 - out.hold.w - g, bottomH);
  return out;
}

export function mapXform(map, pad = 0.05) {
  const s = Math.min(map.w, map.h) * (1 - pad * 2), ox = map.x + (map.w - s) / 2, oy = map.y + (map.h - s) / 2;
  if (v3.on && v3.proj && v3.scene === 'voyage') return { s, to: (cx, cy) => v3.proj(cx, cy), ox, oy };
  return { s, to: (cx, cy) => ({ x: ox + cx * s, y: oy + cy * s }), ox, oy };
}

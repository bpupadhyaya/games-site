// Geometry as a function of the LIVE screen size (kit fluid viewport: the short side is always 720 units).
//   tall     portrait phone (h >= 1.5 w): painting on top, panel below.
//   compact  portrait tablet / 4:3 either way: the same, with a shorter painting.
//   wide     landscape (w >= 1.2 h): painting on the left, panel on the right.
export const TEXT_SCALES = [1, 1.25, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
// Safe areas and the host's floating back button in virtual units; main.js keeps this current (browsers: zeros).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };      // px = css pixels per virtual unit
export const minBtn = () => Math.max(64, 46 / Math.max(0.2, host.px));

const cache = new Map();
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function layoutFor(w, h, n = 8) {
  const key = `${Math.round(w)}x${Math.round(h)}|${n}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)},${host.px.toFixed(2)}`;
  let L = cache.get(key);
  if (!L) { L = build(w, h, n); if (cache.size > 12) cache.clear(); cache.set(key, L); }
  return L;
}

function build(w, h, nMenu) {
  const mode = w >= h * 1.2 ? 'wide' : h >= w * 1.5 ? 'tall' : 'compact';
  const S = R(host.l, host.t, w - host.l - host.r, h - host.t - host.b);
  const mb = minBtn(), gap = 14;
  const backPad = host.back > 0 ? host.back + 8 : 0;
  const L = { w, h, mode, S, mb, backPad, gap };

  // ---- game screens: a painting and a panel -----------------------------------------------------------------------------------
  L.split = (kind) => {
    const frac = { city: 0.34, travel: 0.5, event: 0.4, map: 0.3 }[kind] ?? 0.4;
    if (mode === 'wide') {
      const aw = Math.round(clamp(w * { city: 0.45, travel: 0.58, event: 0.5, map: 0.4 }[kind], 360, w * 0.66));
      const art = R(0, 0, aw, h);
      const panel = R(aw + gap + 0, S.y + gap, w - aw - gap - gap - host.r, S.h - gap * 2);
      return { art, panel, hudY: S.y + 12, hudX0: S.x + 14 + backPad, hudX1: aw - 14 };
    }
    const ah = Math.round(clamp(h * frac, 300, mode === 'tall' ? 760 : 520));
    const art = R(0, 0, w, ah);
    const panel = R(S.x + gap, ah + gap * 0.5, S.w - gap * 2, S.y + S.h - (ah + gap * 0.5) - gap);
    return { art, panel, hudY: S.y + 12, hudX0: S.x + 14 + backPad, hudX1: S.x + S.w - 14 };
  };

  // ---- title -------------------------------------------------------------------------------------------------------------------
  {
    const bh = Math.max(72, mb), T = {};
    if (mode === 'wide') {
      const colW = clamp(w * 0.25, 260, 380), gx = 18, rows = Math.ceil(nMenu / 2), bx = S.x + S.w - 40 - colW * 2 - gx;
      T.title = R(S.x + 30, S.y + S.h * 0.16, bx - S.x - 70, S.h * 0.5);
      T.buttons = []; const y0 = S.y + Math.max(30, (S.h - rows * (bh + 14) + 14 - 80) / 2);
      for (let i = 0; i < nMenu; i++) T.buttons.push(R(bx + (i % 2) * (colW + gx), y0 + Math.floor(i / 2) * (bh + 14), colW, bh));
      { const cw = Math.min(colW * 1.6, 360); T.credit = R(bx + colW + gx / 2 - cw / 2, S.y + S.h - cw * 0.272 - 14, cw, cw * 0.272); }
    } else {
      const gapB = 12, n = nMenu, total1 = n * bh + (n - 1) * gapB, cols = total1 <= S.h * 0.5 ? 1 : 2, rows = Math.ceil(n / cols);
      const bw = cols === 1 ? Math.min(S.w - 56, 560) : Math.min((S.w - 56 - gapB) / 2, 340), totalW = bw * cols + gapB * (cols - 1);
      const total = rows * bh + (rows - 1) * gapB, creditH = Math.min(120, S.h * 0.08), bottom = S.y + S.h - creditH - 26;
      const top = Math.max(S.y + S.h * (mode === 'tall' ? 0.34 : 0.3), bottom - total);
      T.title = R(S.x + 24, S.y + (mode === 'tall' ? S.h * 0.08 : S.h * 0.05), S.w - 48, top - S.y - (mode === 'tall' ? S.h * 0.08 : S.h * 0.05) - 10);
      T.buttons = []; for (let i = 0; i < n; i++) T.buttons.push(R(S.x + (S.w - totalW) / 2 + (i % cols) * (bw + gapB), top + Math.floor(i / cols) * (bh + gapB), bw, bh));
      const cw = Math.min(380, S.w * 0.6); T.credit = R(S.x + (S.w - cw) / 2, S.y + S.h - creditH - 10, cw, cw * 0.272);
    }
    L.title = T;
  }

  // ---- text documents (Rules, About, How to Play, Settings, Journal) --------------------------------------------------------------
  {
    const D = {}, bh = Math.max(60, mb * 0.95), vw = Math.min(S.w - 24, 880), vx = S.x + (S.w - vw) / 2;
    D.back = R(S.x + 12 + backPad, S.y + 10, Math.max(150, mb * 2.2), bh);
    D.textInc = R(S.x + S.w - 12 - bh * 1.3, S.y + 10, bh * 1.3, bh);
    D.textDec = R(D.textInc.x - 10 - bh * 1.3, S.y + 10, bh * 1.3, bh);
    D.titleY = S.y + 10 + bh + 44;
    const top = S.y + 10 + bh + 78;
    const navH = Math.max(60, mb);
    D.nav = { back: R(vx, S.y + S.h - 12 - navH, Math.min(220, vw * 0.32), navH), next: R(vx + vw - Math.min(220, vw * 0.32), S.y + S.h - 12 - navH, Math.min(220, vw * 0.32), navH) };
    D.viewport = R(vx, top, vw, S.y + S.h - 12 - navH - 12 - top);
    D.viewportFull = R(vx, top, vw, S.y + S.h - 14 - top);
    D.tabsY = top;
    L.doc = D;
  }
  return L;
}

// Which text-scale step suits a doc: clamps to the table.
export const scaleAt = (idx) => TEXT_SCALES[clamp(idx, 0, TEXT_SCALES.length - 1)];
export const hitTest = (hits, x, y) => {
  for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (inRect(h.r, x, y) && (!h.clip || inRect(h.clip, x, y))) return h; }
  return null;
};

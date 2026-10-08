// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the SHORT side is always 720 virtual units, the long side
// grows with the aspect ratio). Drawing (view.js), hit-testing (game.js) and the text-document engine (screens.js) all read the same
// layout, so what is drawn is exactly what is tapped, in portrait, landscape and on every phone and tablet shape.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };

export const inRect = (x, y, r) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (text never shrinks below ~11 css px, tap targets stay about 44 css px).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

const tapH = () => Math.max(84, Math.min(112, 46 / Math.max(0.3, host.px)));

const cache = new Map();
export function layoutFor(w = meta.width, h = meta.height) {
  const key = `${w.toFixed(2)}|${h.toFixed(2)}|${host.t.toFixed(1)}|${host.r.toFixed(1)}|${host.b.toFixed(1)}|${host.l.toFixed(1)}|${host.back.toFixed(1)}|${host.px.toFixed(3)}`;
  let L = cache.get(key);
  if (L) return L;
  L = build(w, h, key);
  if (cache.size > 24) cache.clear();
  cache.set(key, L);
  return L;
}
export const layout = () => layoutFor(meta.width, meta.height);

function build(w, h, key) {
  const land = w > h;
  const t = host.t, b = host.b, l = host.l, r = host.r;
  const mx = 16, xl = l + mx, xr = w - r - mx;
  const xlHead = xl + (host.back ? host.back + 8 : 0);
  const L = { key, w, h, land, t, b, l, r, xl, xr, xlHead };

  // ---- play header (clear of the kit's preview badge: top centre, below the safe inset)
  const kc = Math.max(0.3, host.px), badgeBottom = t + 6 / kc + 1.7 * Math.max(16, 11.5 / kc);
  const y0 = Math.max(t + (land ? 8 : 22), badgeBottom - 16), hh = Math.max(80, Math.round(46 / kc)), bw0 = Math.max(84, hh);
  L.back = { x: xlHead, y: y0, w: bw0, h: hh };
  L.pause = { x: xr - bw0, y: y0, w: bw0, h: hh };
  L.titleC = { x: w / 2, y: y0 + 40, ySub: y0 + 76 };
  L.headBottom = y0 + hh;
  L.tap = tapH();

  // ---- document screens (models, rules, how to play, about, settings)
  const dy = t + 20, dh = Math.max(80, Math.round(46 / kc)), dbw = Math.max(84, dh);
  const pw = Math.min(xr - xl, 1000), px0 = (w - pw) / 2;
  L.doc = {
    back: { x: xlHead, y: dy, w: 140, h: dh },
    zoomInc: { x: xr - dbw, y: dy, w: dbw, h: dh },
    pct: { x: xr - dbw - 148, y: dy, w: 140, h: dh },
    zoomDec: { x: xr - dbw - 148 - dbw - 8, y: dy, w: dbw, h: dh },
    panel: { x: px0, y: dy + dh + 16, w: pw, h: h - b - 24 - (dy + dh + 16) },
  };
  L.doc.body = { x: L.doc.panel.x + 24, y: L.doc.panel.y + 24, w: L.doc.panel.w - 48, h: L.doc.panel.h - 48 };

  // ---- overlay card
  const ow = Math.min(620, xr - xl);
  L.overlay = { x: (w - ow) / 2, w: ow, maxH: Math.max(380, h - t - b - 40), cy: t + (h - t - b) / 2 };

  L.title = titleLayout(L, w, h, t, b, xl, xr);
  return L;
}

// The play screen. `cardH` is the height the caption card needs (the text decides, so the game passes it in).
export function playRects(L, cardH) {
  const { w, h, xl, xr, b } = L, gap = 10, th = L.tap + 14;
  if (!L.land) {
    const card = { x: xl, y: L.headBottom + 8, w: xr - xl, h: cardH };
    const toolY = h - b - 14 - th;
    const board = { x: xl, y: card.y + card.h + 6, w: xr - xl, h: Math.max(120, toolY - 10 - (card.y + card.h + 6)) };
    const bw = Math.min(170, (xr - xl - 3 * gap) / 4), total = bw * 4 + gap * 3, x0 = xl + (xr - xl - total) / 2;
    const tools = [0, 1, 2, 3].map((i) => ({ x: x0 + i * (bw + gap), y: toolY, w: bw, h: th }));
    return { card, board, tools, panel: null };
  }
  const pw = Math.max(340, Math.min(560, (xr - xl) * 0.36));
  const panel = { x: xr - pw, y: L.headBottom + 8, w: pw, h: h - b - 14 - (L.headBottom + 8) };
  const board = { x: xl, y: L.headBottom + 4, w: xr - xl - pw - 14, h: h - b - 14 - (L.headBottom + 4) };
  const bw = (pw - gap) / 2, toolsY = panel.y + panel.h - (th * 2 + gap);
  const tools = [0, 1, 2, 3].map((i) => ({ x: panel.x + (i % 2) * (bw + gap), y: toolsY + Math.floor(i / 2) * (th + gap), w: bw, h: th }));
  const card = { x: panel.x, y: panel.y, w: pw, h: Math.min(cardH, toolsY - panel.y - 12) };
  return { card, board, tools, panel };
}

// Watch & Learn controls: slower / pause / faster under the paper (portrait) or in the panel (landscape).
export function autoRects(L, R) {
  const ah = Math.min(L.tap, 100);
  const base = R.panel ? { x: R.panel.x, w: R.panel.w, y: R.panel.y + R.panel.h - ah } : { x: L.xl, w: L.xr - L.xl, y: R.tools[0].y + R.tools[0].h - ah };
  const g = 10, side = (base.w - 2 * g) * 0.28;
  return {
    slower: { x: base.x, y: base.y, w: side, h: ah },
    pause: { x: base.x + side + g, y: base.y, w: base.w - 2 * side - 2 * g, h: ah },
    faster: { x: base.x + base.w - side, y: base.y, w: side, h: ah },
  };
}

function titleLayout(L, w, h, t, b, xl, xr) {
  const room = h - t - b;
  if (!L.land && room >= 1500) {
    const menuTop = h - b - 760, mw = Math.min(672, xr - xl);
    const kt = Math.max(1, Math.min(1.3, (xr - xl) / 720, (menuTop - t - 20) / 830));
    return { mode: 'tall', compact: false, k: kt, tx: (w - 720 * kt) / 2, ty: Math.max(t, (menuTop - 830 * kt) / 2), menu: { x: (w - mw) / 2, y: menuTop, w: mw, h: 740 } };
  }
  if (!L.land) {
    const mh = Math.max(530, Math.min(700, Math.round(room * 0.5)));
    const menuTop = h - b - 20 - mh, mw = Math.min(672, xr - xl);
    const ra = { y: t + 8, h: menuTop - (t + 8) - 4 };
    const k = Math.max(0.3, Math.min(1, ra.h / 830, (xr - xl) / 720));
    return { mode: 'compact', compact: true, k, tx: (w - 720 * k) / 2, ty: ra.y + Math.max(0, (ra.h - 830 * k) / 2), menu: { x: (w - mw) / 2, y: menuTop, w: mw, h: mh } };
  }
  const colW = (xr - xl) * 0.5;
  const ra = { x: xl, y: t + 8, w: colW - 10, h: room - 16 };
  const k = Math.max(0.3, Math.min(1, ra.h / 830, ra.w / 720));
  const free = xr - (xl + colW + 10), mw = Math.min(600, free), my = t + 24;
  return {
    mode: 'wide', compact: true, k, tx: ra.x + (ra.w - 720 * k) / 2, ty: ra.y + Math.max(0, (ra.h - 830 * k) / 2),
    menu: { x: xr - free + (free - mw) / 2, y: my, w: mw, h: h - b - 16 - my },
  };
}

// Geometry as a pure function of the LIVE screen size (kit fluid viewport: the SHORT side is always 720 virtual units, the long side
// grows with the aspect ratio). Drawing (view.js), hit-testing (game.js) and the text-document engine (screens.js) all read the same
// layout, so what is drawn is exactly what is tapped, in portrait, landscape and on every phone and tablet shape.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };

export const inRect = (x, y, r) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Safe areas and the host's floating back button, in virtual units. main.js keeps this current (browsers: all zero).
// px = css pixels per virtual unit (text never shrinks below ~11 css px, tap targets stay about 44 css px).
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };

const tapH = () => Math.max(58, Math.min(96, 46 / Math.max(0.3, host.px)));

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
  const y0 = Math.max(t + (land ? 8 : 22), badgeBottom - 16), tp = Math.min(100, Math.max(80, Math.ceil(46 / kc))), hh = tp;
  L.back = { x: xlHead, y: y0, w: tp + 4, h: hh };
  L.pause = { x: xr - tp - 4, y: y0, w: tp + 4, h: hh };
  L.titleC = { x: w / 2, y: y0 + 40, ySub: y0 + 76 };
  L.headBottom = y0 + hh;
  L.tap = tapH();

  // ---- document screens (models, rules, how to play, about, settings)
  const dy = t + 20, dh = tp;
  const pw = Math.min(xr - xl, 1000), px0 = (w - pw) / 2;
  L.doc = {
    back: { x: xlHead, y: dy, w: 140, h: dh },
    zoomInc: { x: xr - tp - 4, y: dy, w: tp + 4, h: dh },
    pct: { x: xr - tp - 4 - 148, y: dy, w: 140, h: dh },
    zoomDec: { x: xr - tp - 4 - 148 - tp - 8, y: dy, w: tp + 4, h: dh },
    panel: { x: px0, y: dy + dh + 16, w: pw, h: h - b - 24 - (dy + dh + 16) },
  };
  L.doc.body = { x: L.doc.panel.x + 24, y: L.doc.panel.y + 24, w: L.doc.panel.w - 48, h: L.doc.panel.h - 48 };

  // ---- overlay card
  const ow = Math.min(620, xr - xl);
  L.overlay = { x: (w - ow) / 2, w: ow, maxH: Math.max(380, h - t - b - 40), cy: t + (h - t - b) / 2 };

  L.title = titleLayout(L, w, h, t, b, xl, xr);
  return L;
}

// ---- the play screen ---------------------------------------------------------------------------------------------------------------------
// Tool groups wrap independently into rows of equal buttons: groups = [[{ id, minW?, h? }]] -> rows of rects.
export function flowGroups(groups, x, y, W, rowH, gap = 8) {
  const out = [];
  let yy = y;
  for (const g of groups) {
    if (!g.length) continue;
    const minW = Math.max(...g.map((q) => q.minW ?? 100));
    const cap = Math.max(1, Math.floor((W + gap) / (minW + gap)));
    const rows = Math.ceil(g.length / cap), per = Math.ceil(g.length / rows);
    for (let r = 0; r < rows; r++) {
      const slice = g.slice(r * per, (r + 1) * per), n = slice.length, w = (W - gap * (n - 1)) / n;
      const h = Math.max(...slice.map((q) => (q.h ? Math.min(q.h, rowH + 8) : rowH)));
      slice.forEach((q, i) => out.push({ ...q, x: x + i * (w + gap), y: yy, w, h }));
      yy += h + gap;
    }
  }
  return { rects: out, h: Math.max(0, yy - y - gap) };
}

// `cardH` is the height the caption card needs (the text decides, so the game passes it in); `groups` are the tool groups for the phase.
export function playRects(L, cardH, groups, opts = {}) {
  const { w, h, xl, xr, b } = L, gap = 8;
  const rowH = L.tap;
  if (!L.land) {
    const card = { x: xl, y: L.headBottom + 8, w: xr - xl, h: cardH };
    const bottom = h - b - 12;
    let rh = rowH, f = flowGroups(groups, xl, 0, xr - xl, rh, gap);
    const minBoard = Math.max(260, (bottom - card.y) * 0.4);
    while (rh > 54 && bottom - card.y - cardH - f.h - 14 < minBoard) { rh -= 4; f = flowGroups(groups, xl, 0, xr - xl, rh, gap); }
    const toolsY = bottom - f.h;
    const rects = f.rects.map((q) => ({ ...q, y: q.y + toolsY }));
    const board = { x: xl, y: card.y + card.h + 6, w: xr - xl, h: Math.max(120, toolsY - 8 - (card.y + card.h + 6)) };
    const tools = { x: xl, y: toolsY, w: xr - xl, h: f.h };
    return { card, board, rects, tools, panel: null, result: { x: xl, y: toolsY, w: xr - xl, h: bottom - toolsY, ...( bottom - toolsY < 250 ? { y: bottom - 250, h: 250 } : {}) } };
  }
  const pw = Math.max(460, Math.min(640, (xr - xl) * 0.5));
  const panel = { x: xr - pw, y: L.headBottom + 8, w: pw, h: h - b - 14 - (L.headBottom + 8) };
  const board = { x: xl, y: L.headBottom + 4, w: xr - xl - pw - 14, h: h - b - 14 - (L.headBottom + 4) };
  let rh = rowH, f = flowGroups(groups, panel.x, 0, pw, rh, gap), ch = cardH;
  while (rh > 44 && ch + 10 + f.h > panel.h) { rh -= 4; f = flowGroups(groups, panel.x, 0, pw, rh, gap); }
  ch = Math.min(ch, Math.max(120, panel.h - f.h - 10));
  const toolsY = panel.y + panel.h - f.h;
  const rects = f.rects.map((q) => ({ ...q, y: q.y + toolsY }));
  const card = { x: panel.x, y: panel.y, w: pw, h: ch };
  return { card, board, rects, tools: { x: panel.x, y: toolsY, w: pw, h: f.h }, panel, result: { x: panel.x, y: panel.y + ch + 8, w: pw, h: panel.h - ch - 8 } };
}

// Watch & Learn controls: slower / pause / faster under the paper (portrait) or in the panel (landscape).
export function autoRects(L, R) {
  const ah = Math.min(L.tap, 96);
  const base = R.panel ? { x: R.panel.x, w: R.panel.w, y: R.panel.y + R.panel.h - ah } : { x: L.xl, w: L.xr - L.xl, y: R.tools.y + R.tools.h - ah };
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
    return { mode: 'tall', compact: false, k: 1, tx: (w - 720) / 2, ty: Math.max(0, (menuTop - 830) / 2), menu: { x: (w - mw) / 2, y: menuTop, w: mw, h: 740 } };
  }
  if (!L.land) {
    const mh = Math.min(Math.round(room * 0.64), Math.round(5 * Math.max(64, Math.min(92, L.tap)) + 214));
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

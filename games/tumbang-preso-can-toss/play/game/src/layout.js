// Screen geometry as a function of the LIVE screen size (kit 1.7 fluid viewport: the short side is always 720 units, the long side
// follows the aspect ratio). `W` and `H` are live bindings: setSize(w, h) is called by game.js every frame, so every importer sees
// the current size. Three shapes of play screen:
//   tall     portrait phone (h >= 1.5 w): scoreboard on top, the yard, the control bar below (the approved phone look).
//   compact  portrait tablets and squarish windows: the control bar is folded into two rows.
//   wide     landscape: a scoreboard card on the left, the yard in the middle at full height, the control buttons stacked in a card
//            on the right. Throw / steer gestures work on the yard only; the cards are UI.
// The play screen has three parts that all follow the player's text size (100-300%): scoreboard, yard and controls. The yard shrinks
// to make room, so text is never clipped.
export let W = 720, H = 1280;
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // safe insets + floating back button, in virtual units; px = css px per unit
export function setSize(w, h) { w = Math.round(w); h = Math.round(h); if (w > 0 && h > 0) { W = w; H = h; } }
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rc = (x, y, w, h) => ({ x, y, w, h });
export const sizeKey = () => `${W}x${H}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
// The yard seen by the camera is this much wider than tall (measured from the camera model in view.js; the resize test checks it).
export const YARD_ASPECT = 0.867;

export const safe = () => ({ x0: host.l, y0: host.t, x1: W - host.r, y1: H - host.b, w: W - host.l - host.r, h: H - host.t - host.b });
export const shape = () => (W > H && W / H >= 1.25 ? 'wide' : H / W >= 1.5 ? 'tall' : 'compact');
// Smallest tap height in units: about 44 css px where the screen allows, never below 60 or above 92 units.
export const tapH = () => clamp(Math.round(44 / Math.max(0.3, host.px)), 60, 92);
// Smallest text size in units: about 11 css px.
export const minFont = () => Math.max(16, Math.round(11 / Math.max(0.3, host.px)));
// the centred content column used by phone-shaped screens (never wider than 760 units)
export function column() { const u = safe(), w = Math.min(u.w, 760); return { x: u.x0 + (u.w - w) / 2, w }; }
// space the floating host back button needs at the top-left (0 when the host draws none, e.g. standalone builds)
export const backClear = () => (host.back ? host.back + 10 : 0);

const dyn = (fn) => new Proxy({}, { get: (_, k) => fn()[k], ownKeys: () => ['x', 'y', 'w', 'h'], getOwnPropertyDescriptor: (_, k) => ({ enumerable: true, configurable: true, value: fn()[k] }) });

// ---- the reference reader (About / How to Play / Rules) -------------------------------------------------------------------------
// Portrait: A- / A+ in a header row, the panel, a Close bar. Wide: the panel on the left at full height and a rail on the right
// with A- / A+ and Close, so the text column is as tall as the screen.
export function readerGeo() {
  const u = safe(), s = shape(), th = tapH();
  if (s === 'wide') {
    const rail = clamp(Math.round(u.w * 0.2), 200, 300), x0 = u.x0 + 12 + backClear(), y0 = u.y0 + 12;
    const panelW = Math.min(960, u.w - (x0 - u.x0) - rail - 36);
    const panel = rc(x0, y0, panelW, u.h - 24), rx = panel.x + panel.w + 16, rw = u.x1 - 12 - rx, bh = Math.max(th, 72);
    return {
      wide: true, panel,
      textDec: rc(rx, y0 + 40, (rw - 12) / 2, bh), textInc: rc(rx + (rw + 12) / 2, y0 + 40, (rw - 12) / 2, bh),
      pct: { x: rx + rw / 2, y: y0 + 24 },
      close: rc(rx, u.y1 - 12 - bh - 16, rw, bh + 16),
    };
  }
  const c = column(), back = backClear();
  const closeH = Math.max(th, 84) + 10, closeY = u.y1 - closeH - 16;
  const hy = u.y0 + 14, hh = Math.max(60, th - 6);
  const decX = Math.max(c.x + 14, u.x0 + back), incX = c.x + c.w - 14 - 120;
  const py = hy + hh + 22;
  return {
    wide: false,
    textDec: rc(decX, hy, 120, hh), textInc: rc(incX, hy, 120, hh), pct: { x: (decX + 120 + incX) / 2, y: hy + hh / 2 + 8 },
    panel: rc(c.x + 14, py, c.w - 28, closeY - 18 - py),
    close: rc(c.x + 14, closeY, c.w - 28, closeH),
  };
}
export const REF_CLOSE = dyn(() => readerGeo().close);
export const TEXT_DEC = dyn(() => readerGeo().textDec);
export const TEXT_INC = dyn(() => readerGeo().textInc);

// ---- the match setup screen: its Start / Back buttons are pinned to the bottom ----------------------------------------------
export function setupPinsGeo() {
  const u = safe(), c = column(), h = Math.max(tapH(), 96), y = u.y1 - h - 28;
  const w = Math.min(c.w - 60, 640), x = c.x + (c.w - w) / 2, bw = Math.round(w * 0.3);
  return { start: rc(x, y, w - bw - 16, h), back: rc(x + w - bw, y, bw, h), top: y };
}
export const SETUP_PINS = { get start() { return setupPinsGeo().start; }, get back() { return setupPinsGeo().back; } };

// ---- the scoreboard and the control bar ------------------------------------------------------------------------------------------
// hudBox: tall / compact. The pause button sits left of the text, or on the right when the host's back button owns the left corner.
export function hudBox(sc) {
  const s = Math.min(sc, 3), u = safe(), c = column();
  const bw = Math.max(64, Math.round(26 * s * 1.6)), y = u.y0 + 10, back = backClear();
  const leftX = Math.max(c.x + 14, u.x0 + back);
  const stacked = s > 1.25;
  const fs = Math.round(24 * s), row = Math.round(fs * 1.38);
  const ph = stacked ? Math.max(76, bw) : 76, pw = ph;
  const h = stacked ? 12 + Math.max(bw, row) + row * 2 + 8 : Math.round(104 * s);
  const pauseRight = back > 0;
  const pause = pauseRight ? rc(c.x + c.w - 14 - pw, y + 8, pw, ph) : rc(c.x + 14, y + 8, pw, ph);
  const textX = pauseRight ? leftX : c.x + 14 + pw + 14;
  const textW = pauseRight ? pause.x - 14 - textX : c.x + c.w - 14 - textX;
  const rowX = pauseRight ? leftX : c.x + 14;
  // park the kit's preview clock on the free right end of the first text row (never over the scoreboard text)
  if (typeof globalThis === 'object') globalThis.__previewBadge = { x: pauseRight ? pause.x - 10 : c.x + c.w - 14, y: y + 8, align: 'right' };
  return { kind: 'bar', stacked, x: 0, y, w: W, h, bottom: y + h, fs, row, pause, textX, textW, rowX, rowW: c.x + c.w - 14 - rowX };
}

// spec: array of rows, each an array of button ids. At 150% and above every row falls apart into one or two buttons per row.
export function barLayout(sc, spec, compact) {
  const s = Math.min(sc, 3), g = 8, c = column();
  const fs = Math.round(26 * s), bh = Math.max(tapH() - 8, 64, Math.round(fs * 1.65));
  const cols = s < 1.5 ? 4 : 2;
  const rows = [];
  if (compact && s < 1.5) { const flat = spec.flat(), per = flat.length <= 4 ? flat.length : 3; for (let i = 0; i < flat.length; i += per) rows.push(flat.slice(i, i + per)); }
  else for (const row of spec) for (let i = 0; i < row.length; i += cols) rows.push(row.slice(i, i + cols));
  const total = 8 + rows.length * (bh + g) + 8;
  const top = H - total - Math.max(0, host.b - 6);
  const rects = {};
  rows.forEach((row, ri) => {
    const cw = (c.w - 28 - g * (row.length - 1)) / row.length;
    row.forEach((id, ci) => { rects[id] = rc(c.x + 14 + ci * (cw + g), top + 8 + ri * (bh + g), cw, bh); });
  });
  return { top, rects, fs, bh, bottom: H };
}

// wide: the scoreboard card on the left, the yard, the stacked control card on the right.
function wideLayout(sc, spec) {
  const s = Math.min(sc, 3), u = safe(), g = 10;
  const cardMin = s <= 1.25 ? 210 : s <= 1.5 ? 250 : 290;
  const Hy = u.h - 16;
  const yardW = clamp(Math.min(Hy * YARD_ASPECT * 1.3, u.w - 2 * cardMin - 24), 300, u.w);
  const cardW = (u.w - yardW - 24) / 2;
  const left = rc(u.x0 + 8, u.y0 + 8, cardW, Hy), region = rc(u.x0 + 8 + cardW + 4, u.y0 + 8, yardW + 8, Hy), right = rc(region.x + region.w + 4, u.y0 + 8, cardW, Hy);
  // scoreboard card: pause button top-right (the top-left corner belongs to the host's back button), text below it
  const ph = Math.max(72, Math.round(tapH() * 0.95)), pause = rc(left.x + left.w - 12 - ph, left.y + 10, ph, ph);
  const textTop = Math.max(pause.y + pause.h + 10, host.back ? u.y0 + backClear() + 6 : 0);
  const hud = { kind: 'card', card: left, pause, textX: left.x + 14, textW: left.w - 28, textTop, textBottom: left.y + left.h - 14, fs: Math.round(24 * Math.min(s, 1.9)), bottom: left.y + left.h };
  // control card: one column of buttons
  const ids = spec.flat(), n = ids.length, fs = Math.round(26 * s), bw = Math.min(right.w - 24, 360);
  let bh = Math.max(tapH() - 8, 64, Math.round(fs * 1.65));
  const avail = right.h - 28;
  if (n * bh + (n - 1) * g > avail) bh = Math.max(48, Math.floor((avail - (n - 1) * g) / n));
  const total = n * bh + (n - 1) * g, y0 = right.y + 14 + (avail - total) / 2, bx = right.x + (right.w - bw) / 2;
  const rects = {};
  ids.forEach((id, i) => { rects[id] = rc(bx, y0 + i * (bh + g), bw, bh); });
  return { mode: 'wide', hud, bar: { top: right.y, rects, fs, bh, card: right, bottom: right.y + right.h }, region, regionTop: region.y, regionBottom: region.y + region.h, fs, cards: { left, right } };
}

export function playLayout(sc, spec) {
  const sh = shape();
  if (sh === 'wide') return wideLayout(sc, spec);
  const u = safe(), hud = hudBox(sc), bar = barLayout(sc, spec, sh === 'compact');
  const top = hud.bottom + 4, bottom = bar.top - 4;
  return { mode: sh, hud, bar, region: rc(u.x0 + 12, top, u.w - 24, bottom - top), regionTop: top, regionBottom: bottom, fs: bar.fs };
}

// The bar is always built from the tallest row set of the role, so the yard never changes size when the buttons change.
export const BAR_SPECS = {
  thrower: [['lob', 'skim'], ['think', 'throw'], ['fetch', 'home']],
  taya: [['think', 'fix', 'chase']],
  // at 200% text and above the thrower's bar is ONE row (so the yard stays big); what the two buttons do depends on the moment
  big: [['ba', 'bb']],
  watch: [['wpause', 'wdec', 'winc'], ['wexit']],
};
export const BAR_LABELS = {
  lob: 'Lob', skim: 'Skim', think: 'Think', throw: 'Throw', fetch: 'Fetch slipper', home: 'Run home', fix: 'Fix can', chase: 'Chase',
  wpause: 'Pause', wdec: 'Shorter', winc: 'Longer', wexit: 'Stop watching',
};

// shorter words for the biggest text sizes, so two buttons still fit side by side
export const BAR_SHORT = { fetch: 'Fetch', home: 'Home', wexit: 'Stop', wdec: 'Less', winc: 'More' };
export const barLabel = (id, sc) => (sc >= 2 && BAR_SHORT[id] ? BAR_SHORT[id] : BAR_LABELS[id]);

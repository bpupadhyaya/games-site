// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// Virtual resolution 720 x 1280 portrait; nothing important is painted in the outer 24 px (tall phones letterbox).
// The play screen has three parts that all follow the player's text size (100-300%): a scoreboard bar at the top, the yard in the
// middle and a control bar at the bottom. The yard region shrinks to make room, so text is never clipped.
export const W = 720, H = 1280;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const SETUP_PINS = {
  start: { x: 30, y: 1156, w: 440, h: 96 },
  back: { x: 486, y: 1156, w: 204, h: 96 },
};
export const PANEL_X = 30, PANEL_W = 660;
const rc = (x, y, w, h) => ({ x, y, w, h });

export function hudBox(sc) {
  const s = Math.min(sc, 3);
  const bw = Math.max(64, Math.round(26 * s * 1.6));
  if (s <= 1.25) {
    const h = Math.round(104 * s);
    return { stacked: false, x: 0, y: 10, w: W, h, bottom: 10 + h, fs: Math.round(24 * s), pause: rc(14, 18, 76, 76), textX: 104, textW: W - 104 - 14 };
  }
  const fs = Math.round(24 * s), row = Math.round(fs * 1.38);
  const h = 12 + Math.max(bw, row) + row * 2 + 8;
  return { stacked: true, x: 0, y: 10, w: W, h, bottom: 10 + h, fs, row, pause: rc(14, 18, Math.max(76, bw), Math.max(76, bw)), textX: 14, textW: W - 28 };
}

// spec: array of rows, each an array of button ids. At 150% and above every row falls apart into one or two buttons per row.
export function barLayout(sc, spec) {
  const s = Math.min(sc, 3), g = 8;
  const fs = Math.round(26 * s), bh = Math.max(64, Math.round(fs * 1.65));
  const cols = s < 1.5 ? 4 : 2;
  const rows = [];
  for (const row of spec) for (let i = 0; i < row.length; i += cols) rows.push(row.slice(i, i + cols));
  const total = 8 + rows.length * (bh + g) + 8;
  const top = H - total;
  const rects = {};
  rows.forEach((row, ri) => {
    const cw = (W - 28 - g * (row.length - 1)) / row.length;
    row.forEach((id, ci) => { rects[id] = rc(14 + ci * (cw + g), top + 8 + ri * (bh + g), cw, bh); });
  });
  return { top, rects, fs, bh };
}

export function playLayout(sc, spec) {
  const hud = hudBox(sc);
  const bar = barLayout(sc, spec);
  return { hud, bar, regionTop: hud.bottom + 4, regionBottom: bar.top - 4, fs: bar.fs };
}

// The bar is always built from the tallest row set of the role, so the yard never changes size when the buttons change.
export const BAR_SPECS = {
  thrower: [['lob', 'skim'], ['think', 'throw'], ['fetch', 'home']],
  taya: [['think', 'fix', 'chase']],
  watch: [['wpause', 'wdec', 'winc'], ['wexit']],
};
export const BAR_LABELS = {
  lob: 'Lob', skim: 'Skim', think: 'Think', throw: 'Throw', fetch: 'Fetch slipper', home: 'Run home', fix: 'Fix can', chase: 'Chase',
  wpause: 'Pause', wdec: 'Shorter', winc: 'Longer', wexit: 'Stop watching',
};

// shorter words for the biggest text sizes, so two buttons still fit side by side
export const BAR_SHORT = { fetch: 'Fetch', home: 'Home', wexit: 'Stop', wdec: 'Less', winc: 'More' };
export const barLabel = (id, sc) => (sc >= 2 && BAR_SHORT[id] ? BAR_SHORT[id] : BAR_LABELS[id]);

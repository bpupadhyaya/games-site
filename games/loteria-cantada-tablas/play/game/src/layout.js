// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing)
// never disagree. Virtual resolution 720 x 1280 portrait.
export const W = 720, H = 1280;
export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const R = (x, y, w, h) => ({ x, y, w, h });

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECS = 2;
export const AUTO_ACT_SECS = 0.9;

// Shared small buttons.
export const BACK = R(14, 14, 110, 60);
export const SOUND = R(W - 124, 14, 110, 60);
export const TEXT_DEC = R(20, 18, 120, 60);
export const TEXT_INC = R(W - 140, 18, 120, 60);
export const REF_BACK = R(20, 1164, 332, 100);
export const REF_NEXT = R(368, 1164, 332, 100);

// ---- menu -------------------------------------------------------------------------------------------------
// At large text sizes the title art shrinks away and the buttons grow so every label stays big and readable.
export function menuRows(scale = 1) {
  const big = scale > 1.2;
  const bw = big ? 640 : 580, x = (W - bw) / 2;
  const h = big ? 122 : 84, gap = big ? 12 : 14, small = big ? 96 : 76, settings = big ? 90 : 70;
  let y = big ? 250 : 560;
  const row = (hh = h) => { const r = R(x, y, bw, hh); y += hh + gap; return r; };
  const m = {};
  m.play = row(); m.duo = row(); m.caller = row(); m.watch = row();
  const third = (bw - gap * 2) / 3;
  m.howto = R(x, y, third, small); m.rules = R(x + third + gap, y, third, small); m.about = R(x + (third + gap) * 2, y, third, small);
  y += small + gap;
  const half = (bw - gap) / 2;
  m.es = R(x, y, half, small); m.en = R(x + half + gap, y, half, small);
  y += small + gap;
  m.settings = R(x, y, bw, settings);
  return m;
}

// ---- setup ------------------------------------------------------------------------------------------------
export const SETUP_KEYS = ['pattern', 'pace', 'opps', 'skill', 'style', 'theme'];
export const DUO_SETUP_KEYS = ['pattern', 'pace', 'style', 'theme'];
export function setupRows(keys = SETUP_KEYS) {
  const x = 40, w = W - 80, out = {};
  let y = 104;
  for (const k of keys) { const h = k === 'pattern' ? 190 : 118; out[k] = R(x, y, w, h); y += h + 14; }
  out.start = R(60, y + 14, W - 120, 100);
  return out;
}

// ---- tabla geometry ------------------------------------------------------------------------------------------
// A tabla is a frame (FR) around a 4x4 grid of tiles. cellRect works for any placed tabla.
export const tablaGeom = (x, y, tile, fr) => ({ x, y, tile, fr, w: tile * 4 + fr * 2, h: tile * 4 + fr * 2 });
export function cellRect(g, i) {
  const r = Math.floor(i / 4), c = i % 4;
  return R(g.x + g.fr + c * g.tile, g.y + g.fr + r * g.tile, g.tile, g.tile);
}
export function cellAt(g, px, py) {
  const gx = px - g.x - g.fr, gy = py - g.y - g.fr;
  if (gx < 0 || gy < 0 || gx >= g.tile * 4 || gy >= g.tile * 4) return -1;
  return Math.floor(gy / g.tile) * 4 + Math.floor(gx / g.tile);
}

// ---- solo play -------------------------------------------------------------------------------------------------
export const SOLO = {
  head: R(0, 0, W, 90),
  pause: R(W - 130, 6, 116, 80),
  card: R(30, 96, 214, 300),
  textX: 262, textW: 430,
  timer: R(262, 340, 430, 12),
  history: R(30, 404, 660, 64),
  tabla: tablaGeom(52, 472, 154, 16),
  minis: R(30, 1110, 660, 76),
  hint: R(30, 1190, 150, 84),
  claim: R(196, 1190, 494, 84),
};
export const CARD_RATIO = 214 / 300;

// ---- face-to-face two players ------------------------------------------------------------------------------------
// Everything is laid out for the BOTTOM player; the top player's view is the same layout rotated 180
// degrees about the canvas center (game.js maps their taps with (W - x, H - y)).
export const DUO = {
  tabla: tablaGeom(160, 790, 90, 18),
  claim: R(150, 1204, 420, 66),
  band: R(0, 500, W, 280),
  card: R(299, 570, 122, 140),
  textBottom: R(20, 724, 680, 54),
  textTop: R(20, 502, 680, 54),   // drawn rotated for the top player
  pause: R(8, 628, 82, 82),
};
export const rot180 = (x, y) => ({ x: W - x, y: H - y });

// ---- caller mode ----------------------------------------------------------------------------------------------------
export const CALLER = {
  menu: R(14, 14, 110, 60),
  card: R(120, 92, 480, 672),
  riddle: R(30, 790, 660, 130),
  history: R(30, 932, 660, 100),
  prev: R(30, 1060, 150, 100),
  next: R(196, 1060, 328, 100),
  auto: R(540, 1060, 150, 100),
  reshuffle: R(30, 1176, 330, 80),
  speed: R(380, 1176, 310, 80),
};

// ---- tabla pick ------------------------------------------------------------------------------------------------------
export const PICK = {
  slots: [0, 1, 2].map((i) => tablaGeom(34 + (i % 2) * 340, 190 + Math.floor(i / 2) * 372, 74, 16)),
  deal: R(34 + 340, 190 + 372, 312, 312),
  play: R(60, 960, W - 120, 100),
};

// ---- pause / result overlays --------------------------------------------------------------------------------------------
export const PAUSE = { resume: R(130, 480, 460, 96), rules: R(130, 590, 460, 84), menu: R(130, 688, 460, 84) };
export const RESULT = { again: R(60, 1030, 290, 96), menu: R(370, 1030, 290, 96), rules: R(60, 1138, 600, 72) };

// ---- watch & learn -------------------------------------------------------------------------------------------------
export const AUTO = {
  exit: R(14, 1196, 130, 72),
  dec: R(156, 1196, 130, 72),
  pause: R(298, 1196, 124, 72),
  inc: R(434, 1196, 130, 72),
  speed: R(576, 1196, 130, 72),
};

export const SETTINGS_ROWS = (() => {
  const x = 40, w = W - 80, out = {}; let y = 130;
  for (const k of ['lang', 'sound', 'text', 'theme', 'reset']) { out[k] = R(x, y, w, 112); y += 124; }
  return out;
})();
export const DEMO_LIMIT = { back: R(130, 900, 460, 96) };

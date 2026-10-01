// Screen geometry: one place for every rectangle so game.js (hit-testing) and view.js (drawing) never disagree.
// Virtual resolution 720 x 1280 portrait (docs/GAME-CONTRACT.md).
export const W = 720, H = 1280;
export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// ---- the rack: 2 rows x 10 slots ---------------------------------------------------------------------------
export const COLS = 10;
export const RACK = { x0: 30, pitch: 66, tw: 62, th: 90, rowY: [826, 928], frame: { x: 12, y: 792, w: 696, h: 244 } };
export const slotRect = (s) => {
  const r = Math.floor(s / COLS), c = s % COLS;
  return { x: RACK.x0 + c * RACK.pitch, y: RACK.rowY[r], w: RACK.tw, h: RACK.th };
};
export const slotCenter = (s) => { const q = slotRect(s); return { x: q.x + q.w / 2, y: q.y + q.h / 2 }; };
// Nearest slot to a point (for dropping a dragged tile); -1 outside the rack frame.
export function slotAt(x, y) {
  const f = RACK.frame;
  if (x < f.x - 6 || x > f.x + f.w + 6 || y < f.y - 10 || y > f.y + f.h + 6) return -1;
  const row = y < (RACK.rowY[0] + RACK.th + RACK.rowY[1]) / 2 ? 0 : 1;
  const col = Math.max(0, Math.min(COLS - 1, Math.floor((x - RACK.x0 + (RACK.pitch - RACK.tw) / 2) / RACK.pitch)));
  return row * COLS + col;
}

// ---- table --------------------------------------------------------------------------------------------------
export const TILE_S = { w: 54, h: 76 };        // tiles on the table
export const STACK_C = { x: 316, y: 470 };
export const INDICATOR_C = { x: 408, y: 470 };
// discard pile centres by seat: 0 = you (bottom), 1 = right, 2 = top, 3 = left
export const PILE_C = [{ x: 360, y: 652 }, { x: 566, y: 470 }, { x: 360, y: 288 }, { x: 154, y: 470 }];
export const pileRect = (seat) => { const c = PILE_C[seat]; return { x: c.x - 38, y: c.y - 52, w: 76, h: 104 }; };
export const stackRect = () => ({ x: STACK_C.x - 38, y: STACK_C.y - 52, w: 76, h: 104 });
// seat plates (name + score) and the face-down racks
export const PLATE = [
  { x: 20, y: 706, w: 188, h: 54 },
  { x: 560, y: 190, w: 150, h: 62 },
  { x: 238, y: 72, w: 244, h: 50 },
  { x: 10, y: 190, w: 150, h: 62 },
];
export const BACKS = { top: { x: 360, y: 132 }, left: { x: 38, y: 268 }, right: { x: 682, y: 268 } };

// ---- play controls ------------------------------------------------------------------------------------------
export const HUD_MENU = { x: 14, y: 12, w: 96, h: 50 };
export const HUD_OKEY = { x: 454, y: 8, w: 256, h: 58 };
const bw = (W - 40 - 36) / 4;
export const BTN = {
  runs: { x: 20, y: 1060, w: bw, h: 64 },
  sets: { x: 20 + (bw + 12), y: 1060, w: bw, h: 64 },
  smart: { x: 20 + (bw + 12) * 2, y: 1060, w: bw, h: 64 },
  hint: { x: 20 + (bw + 12) * 3, y: 1060, w: bw, h: 64 },
};
export const DISCARD_BTN = { x: 480, y: 704, w: 220, h: 56 };
export const STATUS = { x: 20, y: 1140, w: 680, h: 70 };
export const MELDS_BAR = { x: 220, y: 704, w: 250, h: 56 };

// Pause overlay
export const PAUSE = {
  panel: { x: 90, y: 360, w: 540, h: 560 },
  resume: { x: 130, y: 470, w: 460, h: 84 },
  sound: { x: 130, y: 574, w: 460, h: 84 },
  rules: { x: 130, y: 678, w: 460, h: 84 },
  quit: { x: 130, y: 782, w: 460, h: 84 },
};

// Result overlay (deal + match)
export const RESULT = {
  panel: { x: 40, y: 190, w: 640, h: 820 },
  primary: { x: 80, y: 880, w: 560, h: 90 },
  secondary: { x: 80, y: 780, w: 560, h: 80 },
};

// Watch & Learn controls
export const DEMO = {
  dec: { x: 20, y: 1060, w: 120, h: 64 },
  pause: { x: 152, y: 1060, w: 416, h: 64 },
  inc: { x: 580, y: 1060, w: 120, h: 64 },
  speed: { x: 540, y: 1140, w: 160, h: 56 },
};
export const THINK_STEPS = [2, 5, 8, 10];

// ---- title / settings / reference pages -----------------------------------------------------------------------
export function titleRows(hasSave = false) {
  const x = 90, w = 540, gap = 14;
  const half = (w - gap) / 2;
  const cont = hasSave ? { x, y: 560, w: half, h: 96 } : null;
  const play = hasSave ? { x: x + half + gap, y: 560, w: half, h: 96 } : { x, y: 560, w, h: 96 };
  const watch = { x, y: 560 + 96 + gap, w, h: 80 };
  const ry = watch.y + watch.h + gap, third = (w - gap * 2) / 3;
  const howto = { x, y: ry, w: third, h: 76 };
  const rules = { x: x + third + gap, y: ry, w: third, h: 76 };
  const about = { x: x + (third + gap) * 2, y: ry, w: third, h: 76 };
  const settings = { x, y: ry + 76 + gap, w: (w - gap) * 0.62, h: 76 };
  const sound = { x: x + (w - gap) * 0.62 + gap, y: ry + 76 + gap, w: (w - gap) * 0.38, h: 76 };
  return { cont, play, watch, howto, rules, about, settings, sound };
}

export const SET_ROWS = Array.from({ length: 8 }, (_, i) => ({ x: 40, y: 150 + i * 98, w: 640, h: 84 }));
export const SET_BACK = { x: 160, y: 1176, w: 400, h: 84 };

export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const REF_PANEL = { x: 30, y: 90, w: W - 60, h: 1050 };

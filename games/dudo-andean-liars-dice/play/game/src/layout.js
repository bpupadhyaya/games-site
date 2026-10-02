// Screen rectangles shared by drawing (view.js) and hit-testing (game.js). Pure data. The play HUD follows the text-zoom step (1 to 3).
export const SCREEN = { width: 720, height: 1560 };
export const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export const BACK_BTN = { x: 16, y: 22, w: 84, h: 78 };
export const PAUSE_BTN = { x: 620, y: 22, w: 84, h: 78 };

// nSeats = how many seat cards are shown around the table (everyone but the player at the bottom).
export function playLayout(scale, nSeats = 3) {
  const k = Math.max(0, Math.min(1, (scale - 1) / 2));
  const seatH = Math.round(124 + 52 * k);
  const cols = Math.max(1, Math.min(3, nSeats)), rows = Math.max(1, Math.ceil(nSeats / 3));
  const seatW = cols === 3 ? 216 : cols === 2 ? 330 : 420;
  const seatsY = 112, gap = 10;
  const seatsH = rows * seatH + (rows - 1) * gap;
  const seats = [];
  for (let i = 0; i < nSeats; i++) {
    const r = Math.floor(i / 3), c = i % 3;
    const inRow = Math.min(3, nSeats - r * 3);
    const rowW = (inRow === 3 ? 216 : inRow === 2 ? 330 : 420) * inRow + 12 * (inRow - 1);
    const w = inRow === 3 ? 216 : inRow === 2 ? 330 : 420;
    seats.push({ x: Math.round((SCREEN.width - rowW) / 2 + c * (w + 12)), y: seatsY + r * (seatH + gap), w, h: seatH });
  }
  void seatW;
  const faceH = Math.round(88 + 30 * k), stepH = Math.round(96 + 34 * k), actH = Math.round(104 + 50 * k), cg = 10;
  const ctrlTop = SCREEN.height - 26 - (faceH + stepH + actH + cg * 2);
  const diceH = Math.round(146 + 34 * k);
  const diceY = ctrlTop - 12 - diceH;
  const tableY = seatsY + seatsH + 12;
  const table = { x: 24, y: tableY, w: 672, h: diceY - 10 - tableY };
  const face = [0, 1, 2, 3, 4, 5].map((i) => ({ x: 24 + i * (672 / 6), y: ctrlTop, w: 672 / 6 - 8, h: faceH }));
  const sy = ctrlTop + faceH + cg;
  const minus = { x: 24, y: sy, w: 112, h: stepH }, qty = { x: 144, y: sy, w: 124, h: stepH }, plus = { x: 276, y: sy, w: 112, h: stepH };
  const bid = { x: 396, y: sy, w: 300, h: stepH };
  const ay = sy + stepH + cg, aw = (672 - 24) / 3;
  const dudo = { x: 24, y: ay, w: aw, h: actH }, calzo = { x: 24 + aw + 12, y: ay, w: aw, h: actH }, think = { x: 24 + 2 * (aw + 12), y: ay, w: aw, h: actH };
  const wide = { x: 24, y: sy, w: 672, h: stepH + cg + actH };
  return { seats, seatsH, table, dice: { x: 24, y: diceY, w: 672, h: diceH }, face, minus, qty, plus, bid, dudo, calzo, think, wide, k, next: { x: 48, y: 1400, w: 624, h: 120 }, handoff: { x: 96, y: table.y + table.h - 130, w: 528, h: 104 } };
}

export function autoLayout(scale, nSeats) {
  const L = playLayout(scale, nSeats);
  const k = L.k, h = Math.round(112 + 74 * k), y = SCREEN.height - 28 - h;
  return { slower: { x: 24, y, w: 160, h }, pause: { x: 200, y, w: 320, h }, faster: { x: 536, y, w: 160, h }, labelY: y - 22, L };
}

// ---- document screens ----
export const DOC_BACK = { x: 16, y: 20, w: 140, h: 76 };
export const ZOOM_DEC = { x: 396, y: 20, w: 84, h: 76 };
export const ZOOM_INC = { x: 620, y: 20, w: 84, h: 76 };
export const DOC_PANEL = { x: 24, y: 112, w: 672, h: 1322 };
export const DOC_BODY = { x: 48, y: 136, w: 624, h: 1274 };
export const NAV_PREV = { x: 24, y: 1450, w: 210, h: 84 };
export const NAV_NEXT = { x: 486, y: 1450, w: 210, h: 84 };
export const DOC_BODY_NAV = { x: 48, y: 136, w: 624, h: 1190 };
export const START_BTN = { x: 24, y: 1440, w: 672, h: 96 };
export const DOC_BODY_START = { x: 48, y: 136, w: 624, h: 1180 };
export const MENU_REGION = { x: 24, y: 700, w: 672, h: 830 };
export const OVERLAY = { x: 50, y: 250, w: 620, h: 1060 };

// Shared screen-space layout (virtual 720x1560 portrait canvas). One source of truth for both
// rendering and pointer hit-testing, so they never drift apart. Pure math only — no DOM/canvas.

export const SCREEN = { width: 720, height: 1560 };

export const BOARD_MARGIN = 36;
export const BOARD_TOP = 320;
export const BOARD_SIZE = SCREEN.width - BOARD_MARGIN * 2; // 648

export function cellSize(size) {
  return BOARD_SIZE / size;
}

export function cellCenter(size, row, col) {
  const cs = cellSize(size);
  return { x: BOARD_MARGIN + col * cs + cs / 2, y: BOARD_TOP + row * cs + cs / 2 };
}

// Returns the flat cell index (row*size+col) under (x, y), or -1 if outside the board.
export function hitTestCell(x, y, size) {
  const cs = cellSize(size);
  const col = Math.floor((x - BOARD_MARGIN) / cs);
  const row = Math.floor((y - BOARD_TOP) / cs);
  if (row < 0 || row >= size || col < 0 || col >= size) return -1;
  return row * size + col;
}

// In play, below the board.
export const HINT_BUTTON = { x: 40, y: 1140, w: 310, h: 120 };
export const UNDO_BUTTON = { x: 370, y: 1140, w: 310, h: 120 };

// Title screen.
export const PLAY7_BUTTON = { x: 90, y: 896, w: 540, h: 124 };
export const PLAY10_BUTTON = { x: 90, y: 1044, w: 540, h: 100 };
export const DAILY_BUTTON = { x: 90, y: 1166, w: 540, h: 100 };

// Cycles the colour scheme (same place on the title screen and in play).
export const COLOR_BUTTON = { x: 90, y: 1300, w: 540, h: 96 };

// Title screen only: Colours + Rules share the row the single full-width Colours button used to
// occupy — same left/right edges (90..630) as COLOR_BUTTON above, split into two even columns
// with a gap between. The in-play Colours button (COLOR_BUTTON, above) is unchanged.
export const TITLE_COLOR_BUTTON = { x: 90, y: 1300, w: 262, h: 96 };
export const TITLE_RULES_BUTTON = { x: 368, y: 1300, w: 262, h: 96 };

// Rules reference page (title screen only — this game has no other Controls/About screen to
// mirror). Same two-column bottom-row shape the play scene's Hint/Undo row uses.
export const RULES_BACK_BUTTON = { x: 40, y: 1340, w: 310, h: 120 };
export const RULES_NEXT_BUTTON = { x: 370, y: 1340, w: 310, h: 120 };

export function inRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

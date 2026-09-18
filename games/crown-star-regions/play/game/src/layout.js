// Shared screen-space layout (virtual 720x1280 portrait canvas). One source of truth for both
// rendering and pointer hit-testing, so they never drift apart. Pure math only — no DOM/canvas.

export const SCREEN = { width: 720, height: 1280 };

export const BOARD_MARGIN = 40;
export const BOARD_TOP = 220;
export const BOARD_SIZE = SCREEN.width - BOARD_MARGIN * 2; // 640

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

export const HINT_BUTTON = { x: 50, y: 1120, w: 280, h: 110 };
export const UNDO_BUTTON = { x: 390, y: 1120, w: 280, h: 110 };

export const PLAY7_BUTTON = { x: 160, y: 480, w: 400, h: 110 };
export const PLAY10_BUTTON = { x: 160, y: 620, w: 400, h: 110 };
export const DAILY_BUTTON = { x: 160, y: 760, w: 400, h: 110 };

export function inRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

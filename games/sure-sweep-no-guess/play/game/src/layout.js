// Geometry for every scene. One tall portrait canvas so the game fills modern phones.
// The app draws its own Menu button (top-left) and preview pill (top-centre), so nothing
// important sits in the top ~110 units.
export const W = 720;
export const H = 1560;

export const COLS = 9;
export const ROWS = 9;
export const CELL = 74;
export const FRAME = 13;
export const BOARD_W = COLS * CELL;
export const BOARD_H = ROWS * CELL;
export const BOARD_X = (W - BOARD_W) / 2;
export const BOARD_Y = 353;

export const HUD = { x: 27, y: 196, w: 666, h: 124 };

// Play scene controls.
export const MODE_SWITCH = { x: 27, y: 1118, w: 666, h: 116 };
export const HINT_BTN = { x: 27, y: 1262, w: 210, h: 116 };
export const COLOR_BTN = { x: 255, y: 1262, w: 210, h: 116 };
export const NEW_BTN = { x: 483, y: 1262, w: 210, h: 116 };

// Result card (won / lost) takes the place of the controls so the board stays visible.
export const RESULT_CARD = { x: 27, y: 1062, w: 666, h: 380 };
export const SHIELD_BTN = { x: 51, y: 1296, w: 300, h: 112 };
export const AGAIN_BTN = { x: 369, y: 1296, w: 300, h: 112 };
export const AGAIN_BTN_WIDE = { x: 135, y: 1296, w: 450, h: 112 };

// Title scene.
export const PLAY_BTN = { x: 110, y: 1060, w: 500, h: 132 };
// Colours + Rules share one row, two even columns (was one full-width Colours button; Rules is
// the addition - same left/right edges as before, just split in half with a gap between).
export const TITLE_COLOR_BTN = { x: 110, y: 1222, w: 242, h: 96 };
export const TITLE_RULES_BTN = { x: 368, y: 1222, w: 242, h: 96 };
export const HERO = { x: 360, y: 700, cell: 100, n: 5 };

// Rules reference page (title screen only - this game has no other Controls/About screen to
// mirror). Same bottom-row grid the play scene's Hint/Colours/New board row uses (x 27..693).
export const RULES_BACK_BTN = { x: 27, y: 1262, w: 324, h: 116 };
export const RULES_NEXT_BTN = { x: 369, y: 1262, w: 324, h: 116 };

export const cellRect = (index) => ({
  x: BOARD_X + (index % COLS) * CELL,
  y: BOARD_Y + Math.floor(index / COLS) * CELL,
});
export const cellCenter = (index) => {
  const r = cellRect(index);
  return { x: r.x + CELL / 2, y: r.y + CELL / 2 };
};
export const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

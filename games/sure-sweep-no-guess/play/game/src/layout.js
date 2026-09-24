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

// Result card (won / lost) takes the place of the controls so the board stays visible. Grew
// downward into the empty strip below it (bottom was 1442, canvas is 1560 tall) to fit the
// "More from Arcforge" chip row between the result text/stats and the button row, which moved
// down to match (was y:1296) - same 34px bottom padding as before, just lower. See chipRect below.
export const RESULT_CARD = { x: 27, y: 1062, w: 666, h: 470 };
export const SHIELD_BTN = { x: 51, y: 1386, w: 300, h: 112 };
export const AGAIN_BTN = { x: 369, y: 1386, w: 300, h: 112 };
export const AGAIN_BTN_WIDE = { x: 135, y: 1386, w: 450, h: 112 };

// The other Arcforge games, for the won/lost screen's "More from Arcforge" cross-promo chips.
// This is a free game's one natural advertising moment (a player has just finished a session and
// is deciding what to do next) - deliberately paid games only, never another free game: a player
// can already find the free ones for themselves (they're labelled), so this moment is spent
// showing the ones they might not otherwise discover and might buy (2026-09-23, owner decision).
export const SIBLINGS = [
  { slug: 'tiger-and-goat', title: 'Tiger and Goat' },
  { slug: 'go-stones-and-territory', title: 'Go' },
  { slug: 'carrom-striker-and-queen', title: 'Carrom' },
  { slug: 'word-game', title: 'Word Game' },
];
// A single row of 4 compact chips (this card is the tightest fit of the games that got this
// feature - no room for harvest-sling's 2x2 grid), same x-margins as SHIELD_BTN/AGAIN_BTN above.
// CHIP_LABEL_Y sits below the won screen's "New best time!"/best-time line (which stayed put) with
// enough clearance that the two never overlap - verified with a real headless-Chrome render.
export const CHIP_LABEL_Y = 1300;
export const CHIP_ROW_Y = 1314;
export const CHIP_ROW_H = 56;
export const chipRect = (i) => ({ x: 51 + i * 158, y: CHIP_ROW_Y, w: 144, h: CHIP_ROW_H });

// Title scene.
export const PLAY_BTN = { x: 110, y: 1060, w: 500, h: 132 };
// Colours + Rules + Auto Play share one row, three even columns (was two; Auto Play is the
// addition - same left/right edges as before (110..610), just split into thirds with two gaps).
export const TITLE_COLOR_BTN = { x: 110, y: 1222, w: 156, h: 96 };
export const TITLE_RULES_BTN = { x: 282, y: 1222, w: 156, h: 96 };
export const TITLE_AUTO_BTN = { x: 454, y: 1222, w: 156, h: 96 };
export const HERO = { x: 360, y: 700, cell: 100, n: 5 };

// Auto Play ("Watch & Learn") think-time steps, in seconds. Index into this, same pattern as
// TEXT_SCALES below - never a raw float, so the +/- stepper can cleanly disable at either end.
// Hard-capped at 10s per the owner's explicit instruction. Default index 1 (5s).
export const THINK_STEPS = [2, 5, 8, 10];

// Rules reference page (title screen only - this game has no other Controls/About screen to
// mirror). Same bottom-row grid the play scene's Hint/Colours/New board row uses (x 27..693).
export const RULES_BACK_BTN = { x: 27, y: 1262, w: 324, h: 116 };
export const RULES_NEXT_BTN = { x: 369, y: 1262, w: 324, h: 116 };
// The framed reader-card panel behind the Rules body text (drawn with the game's own glassPanel()),
// and the text-size stepper above it - a header row in the otherwise-empty top strip this page
// never used before. An index into TEXT_SCALES, never a raw float, so the stepper can cleanly
// disable at either end.
export const RULES_PANEL = { x: 24, y: 118, w: W - 48, h: 1134 };
export const TEXT_DEC_BTN = { x: 36, y: 24, w: 116, h: 64 };
export const TEXT_INC_BTN = { x: W - 152, y: 24, w: 116, h: 64 };
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];

export const cellRect = (index) => ({
  x: BOARD_X + (index % COLS) * CELL,
  y: BOARD_Y + Math.floor(index / COLS) * CELL,
});
export const cellCenter = (index) => {
  const r = cellRect(index);
  return { x: r.x + CELL / 2, y: r.y + CELL / 2 };
};
export const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

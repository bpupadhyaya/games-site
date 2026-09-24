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

// Text-size stepper on the Rules reference page — top corners, clear of the centred title/
// flourish below them and of the Back/Next row at the bottom. An index into TEXT_SCALES, never a
// raw float, so "min"/"max" are exact and the stepper can cleanly disable at either end.
export const RULES_TEXT_DEC_BUTTON = { x: 24, y: 26, w: 116, h: 68 };
export const RULES_TEXT_INC_BUTTON = { x: SCREEN.width - 140, y: 26, w: 116, h: 68 };
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];

export function inRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

// ---- Auto Play ("Watch & Learn") ------------------------------------------------------------
// Title screen: a full-width row below Colours/Rules (90..630, matching that row's edges). The
// hint line and (when shown) the stats pill below it shift down to make room (see drawTitle).
export const TITLE_AUTO_BUTTON = { x: 90, y: 1406, w: 540, h: 64 };
// In play: Hint/Undo (y:1140..1260) and Colours (y:1300..1396) leave y:1396..1560 empty during a
// normal game — Auto Play's own Exit/Pause/Skip row lives there instead of adding a new area.
export const AUTO_EXIT_BUTTON = { x: 30, y: 1412, w: 210, h: 110 };
export const AUTO_PAUSE_BUTTON = { x: 255, y: 1412, w: 210, h: 110 };
export const AUTO_SKIP_BUTTON = { x: 480, y: 1412, w: 210, h: 110 };
// Once solved, the same strip becomes two stacked full-width buttons (no Skip/Pause to offer).
export const AUTO_AGAIN_BUTTON = { x: 90, y: 1412, w: 540, h: 62 };
export const AUTO_EXIT2_BUTTON = { x: 90, y: 1484, w: 540, h: 62 };
// Configurable THINK pause: index-based steps (never a raw float), hard-capped at 10s. Status
// strip + stepper live in the header row's own top corners (RULES_TEXT_DEC/INC_BUTTON's spot is
// only used on the Rules page, so it's free here).
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECS = 2;
export const AUTO_DEC_BUTTON = { x: 24, y: 26, w: 116, h: 68 };
export const AUTO_INC_BUTTON = { x: SCREEN.width - 140, y: 26, w: 116, h: 68 };

// ---- Cross-promotion (solved screen — both real play and Auto Play) -------------------------
// The other Arcforge games, for the solved screen's "More from Arcforge" chips — this free game's
// one natural advertising moment (a player, or a viewer who just watched Auto Play solve the
// puzzle, is deciding what to do next anyway). Deliberately paid games only, never another free
// game: a player can already find the free ones for themselves (they're labelled), so this moment
// is spent on ones they might not otherwise discover and might buy (2026-09-23, owner decision;
// same pattern as harvest-sling's own SIBLINGS on its tally screen). Originally real-play only;
// extended to Auto Play's own "over" sub-state the same day per owner follow-up — see STATUS.md.
export const SIBLINGS = [
  { slug: 'tiger-and-goat', title: 'Tiger and Goat' },
  { slug: 'go-stones-and-territory', title: 'Go' },
  { slug: 'carrom-striker-and-queen', title: 'Carrom' },
  { slug: 'word-game', title: 'Word Game' },
];
// A 2x2 grid below the (shrunk) solved panel, same left/right edges as the panel (50..670).
export function chipRect(i) {
  const w = 298, h = 58, gapX = 24, gapY = 10;
  return { x: 50 + (i % 2) * (w + gapX), y: 1380 + Math.floor(i / 2) * (h + gapY), w, h };
}
// Auto Play's own "over" sub-state has far less free space: AUTO_AGAIN_BUTTON/AUTO_EXIT2_BUTTON
// (above) already occupy y:1412..1546, so chipRect()'s 2x2 grid (y:1380..1448) would overlap
// AUTO_AGAIN_BUTTON. This is a single row of 4, sized to sit entirely between the solved panel's
// bottom edge (y:1330) and AUTO_AGAIN_BUTTON's top (y:1412), same left/right edges as the panel
// (50..670). Verified against a real render — see STATUS.md.
export function chipRectAuto(i) {
  const w = 146, h = 44, gap = 12;
  return { x: 50 + i * (w + gap), y: 1352, w, h };
}

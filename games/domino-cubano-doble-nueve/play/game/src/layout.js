// Shared screen-space layout (virtual 720x1560 portrait canvas — the same convention every other
// 4-seat table game in this portfolio uses, e.g. mahjong-four-winds). Pure math only, no canvas
// calls — one source of truth for rendering (view.js) and pointer hit-testing (game.js).

export const SCREEN = { width: 720, height: 1560 };

export function inRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

// ---- Seats: 0 = player (bottom), 1 = left opponent, 2 = partner (top), 3 = right opponent -----
// Rack tiles are 50% bigger (cap 83x124, up from 55x82) — but only once the hand has thinned to
// ~7 tiles or fewer; a full 10-tile opening hand physically cannot fit ten 83px-wide tiles across
// a 720px screen (that alone would need ~870px), so it dynamically fits the widest row the frame
// safely allows and reaches the full +50% within the first couple of plays, same shrink-to-fit
// approach `lineTileSize` below already uses.
export const RACK = { y: 1358, gap: 4 };
function rackTileSize(count) {
  const n = Math.max(count, 1);
  const target = 600; // total row width when not cap-limited — safely inside the table frame
  const w = Math.min(83, Math.max(32, (target - RACK.gap * (n - 1)) / n));
  return { w, h: w * (82 / 55) };
}
export function rackTileRect(index, count) {
  const size = rackTileSize(count);
  const totalW = count * size.w + (count - 1) * RACK.gap;
  const x = SCREEN.width / 2 - totalW / 2 + index * (size.w + RACK.gap);
  return { x, y: RACK.y, w: size.w, h: size.h };
}

export const SEAT_POS = {
  1: { x: 84, y: 620 },  // left opponent, vertical fan
  2: { x: 360, y: 236 }, // partner, horizontal fan — pushed down from 210 to clear the bigger
  //                        "first to 100" subtitle above it now that its own label is also bigger
  3: { x: 636, y: 620 }, // right opponent, vertical fan
};

// ---- The line ---------------------------------------------------------------------------------
// Cuban dominoes has no spinner: the line only ever grows at its two ends, always one continuous
// sequence (design/GDD.md's Scope). That's a rule about which end a tile may join, not about it
// having to render as a single unbroken row — a long real-table line is routinely turned/snaked
// to keep it readable, and this game did the equivalent by shrinking every tile instead, which
// past ~15 tiles made the pips uncountable and ran the row past the table rail. It now wraps onto
// more rows instead, the same way wrapped text would (reading left-to-right/top-to-bottom in play
// order), and — since the table has real empty space below the line, all the way down to the
// Hint/Pass/Undo row — picks whichever row count makes the tiles biggest, not just legible: every
// row-count from 1 up is tried, and the one whose tiles come out largest (bound by the table's
// real width and by the real vertical room down to that button row) wins, capped only so a
// near-empty line doesn't render one comically huge tile.
// Width kept clear of the opponent seats' own face-down piles at x 84/636 (each a 26px-wide fan,
// so their inner edges sit at 97/623) — a wide row centered on screen must never reach out that
// far, or it renders on top of tiles that need to stay visible (a real signal: how many tiles
// each opponent has left). 496 keeps even the widest row within 112..608, a clear 15px either side.
export const LINE_BOUNDS = { x: 112, y: 470, w: 496, h: 710 };
const LINE_MIN_W = 20, LINE_MAX_W = 112, LINE_GAP = 4, LINE_ROW_GAP = 10, LINE_MAX_ROWS = 6;
export function layoutLineRows(count) {
  const n = Math.max(count, 1);
  let best = null;
  for (let rows = 1; rows <= LINE_MAX_ROWS; rows++) {
    const perRow = Math.ceil(n / rows);
    const byWidth = (LINE_BOUNDS.w - (perRow - 1) * LINE_GAP) / perRow;
    const byHeight = (LINE_BOUNDS.h - (rows - 1) * LINE_ROW_GAP) / (rows * 1.5);
    const w = Math.min(LINE_MAX_W, byWidth, byHeight);
    if (!best || w > best.w) best = { rows, perRow, w };
    if (perRow === 1) break; // one tile per row already — more rows can only shrink it further
  }
  const w = Math.max(LINE_MIN_W, best.w);
  return { rows: best.rows, perRow: best.perRow, w, h: w * 1.5, gap: LINE_GAP, rowGap: LINE_ROW_GAP };
}

// ---- HUD + buttons ------------------------------------------------------------------------------
// Sized up to match the title screen's scale (see TITLE_* below); the 3-across Hint/Pass/Undo row
// is already width-maxed for the frame, so it grows in height only, not width.
export const BACK_BUTTON = { x: 16, y: 16, w: 112, h: 58 };
export const MEMORY_TOGGLE = { x: 520, y: 16, w: 184, h: 58 };
export const HINT_BUTTON = { x: 66, y: 1224, w: 160, h: 96 };
export const PASS_BUTTON = { x: 245, y: 1224, w: 230, h: 96 };
export const UNDO_BUTTON = { x: 494, y: 1224, w: 160, h: 96 };

// ---- Lobby ----------------------------------------------------------------------------------
// x/w kept inside the table frame's inner border (66..654) with a clean 14px margin either side —
// the old 40..680 span visibly crossed it on both edges.
export function difficultyCardRect(i) {
  return { x: 80, y: 340 + i * 300, w: 560, h: 270 };
}
// "Deal In" is this screen's primary CTA (equivalent to Play on the title screen) — same treatment.
export const START_BUTTON = { x: 135, y: 1250, w: 450, h: 130 };

// ---- Title -----------------------------------------------------------------------------------
// Play's label is 30pt -> 45pt (+50%), so its button scales by the same 1.5x (300x90 -> 450x135).
// The three menu labels below it double (22/20/18pt -> 44/40/36pt), so they share one wider,
// taller button footprint sized for the longest label ("Auto Play — Watch & Learn" at 36pt).
export const TITLE_PLAY_BUTTON = { x: 135, y: 760, w: 450, h: 135 };
export const TITLE_HOWTO_BUTTON = { x: 80, y: 915, w: 560, h: 130 };
export const TITLE_RULES_BUTTON = { x: 80, y: 1065, w: 560, h: 120 };
export const TITLE_AUTO_BUTTON = { x: 80, y: 1205, w: 560, h: 120 };

// Auto Play ("Watch & Learn"): a full hand plays itself, every seat AI-controlled including the
// player's own seat — the same pattern every other game in this portfolio uses. Think-time steps
// in seconds (same values as tiger-and-goat/mahjong-four-winds), an index into this array — never
// a raw float — so the +/- stepper can cleanly disable at either end.
export const AUTO_THINK_STEPS = [2, 5, 8, 10];

// ---- Hand-end / match-end overlay --------------------------------------------------------------
// Extra height vs. before gives the now-larger body copy room for a worst-case extra wrapped line
// without the record line or Continue button ever overlapping it (both position dynamically off
// the real measured line count — see drawHandResult/drawMatchResult).
export const OVERLAY_PANEL = { x: 60, y: 420, w: 600, h: 600 };
export const OVERLAY_CONTINUE_BUTTON = { x: 170, y: 850, w: 380, h: 100 };

// ---- Rules reference page (docs/GAME-CATEGORIES.md, required from production onward) ----------
export const RULES_BACK_BUTTON = { x: 16, y: 16, w: 112, h: 58 };
export const RULES_PREV_BUTTON = { x: 100, y: 1390, w: 240, h: 76 };
export const RULES_NEXT_BUTTON = { x: 380, y: 1390, w: 240, h: 76 };
// Shared by How to Play and Rules Reference — the big panel itself, and the drag-to-scroll hit
// region within it (see game.js's scrollDrag) when a step/page's body runs longer than one screen.
export const HOWTO_RULES_PANEL = { x: 40, y: 108, w: 640, h: 1372 };
// Text-size stepper (same pattern as tiger-and-goat/mahjong-four-winds): index into TEXT_SCALES,
// never a raw float, so the +/- buttons can cleanly disable at either end. Shared by both
// reference screens (How to Play and Rules Reference) — same top row on both.
export const TEXT_DEC = { x: 140, y: 16, w: 96, h: 58 };
export const TEXT_INC = { x: 506, y: 16, w: 96, h: 58 };
export const TEXT_SCALES = [1, 1.25, 1.5, 1.75, 2];

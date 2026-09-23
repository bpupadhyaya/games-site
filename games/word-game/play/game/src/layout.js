// Screen geometry shared by the rules (hit-testing) and the renderer. Virtual units.
// The app draws its own "Menu" button top-left and a small pill top-centre, so nothing
// important sits in the top-left corner or the top 50 units.
export const W = 720, H = 1560;

// Vertical band the three candidate words drift within, split into three independent slices
// so the words come in at varied heights.
export const BAND_TOP = 520;
export const BAND_BOTTOM = 1340;
export const SLICE_H = (BAND_BOTTOM - BAND_TOP) / 3;
export const SLICE_MARGIN = 56;

// Word slips: width is estimated from the text length so the rules never need a canvas.
export const CHAR_W = 30;
export const CHIP_PAD_X = 20;
export const CHIP_H = 96;
export const slipWidth = (text) => text.length * CHAR_W + CHIP_PAD_X * 2;

// Title screen
export const MODE_SYN_BTN = { x: 56, y: 856, w: 296, h: 116 };
export const MODE_ANT_BTN = { x: 368, y: 856, w: 296, h: 116 };
export const PLAY_BTN = { x: 110, y: 1072, w: 500, h: 136 };
// The Colours button used to span the full row (x150 w420); it now shares that same row, same
// y/height/overall span, with the new Rules button (Rules reference page, additive-only change).
export const TITLE_COLOR_BTN = { x: 150, y: 1266, w: 202, h: 92 };
export const TITLE_RULES_BTN = { x: 368, y: 1266, w: 202, h: 92 };
// Auto Play ("Watch & Learn") entry point: a free, full-width row added below the Colours/Rules
// row (additive-only, same span as that row: x150..570). The two text lines beneath it (free
// preview count + tagline) were nudged down to make room; see render.js.
export const TITLE_AUTOPLAY_BTN = { x: 150, y: 1370, w: 420, h: 80 };

// Rules reference: paginated, reached from the title screen only (this game has no other
// Controls/About screen to also wire into). Back/Next sit as an equal-width pill pair anchored
// near the bottom, clear of the reader-card panel — same geometry as the good reference pattern
// (big-card-solitaire-large-print). Back steps to the previous page (dimmed/disabled on page 1,
// same convention as the session-review Prev button); Next steps forward and turns into a "Done"
// exit affordance on the last page, instead of wrapping around forever.
export const RULES_BACK_BTN = { x: 20, y: 1416, w: 330, h: 116 };
export const RULES_NEXT_BTN = { x: 370, y: 1416, w: 330, h: 116 };

// Text-size stepper for the Rules reference: an *index* into TEXT_SCALES, never a raw float, so
// a stale saved index from a build with a different-length array can always be clamped safely.
// Two small pills in the top corners only, well clear of the centred "Rules" title below them
// (the app's own Menu button owns the very top-left ~50 units, same convention every other
// screen in this game follows).
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const RULES_TEXT_DEC = { x: 20, y: 20, w: 130, h: 68 };
export const RULES_TEXT_INC = { x: W - 150, y: 20, w: 130, h: 68 };
// The framed reader-card panel behind the Rules illustration + body text. The centred "Rules"
// title sits above it (see render.js); the page indicator sits just below it, above the nav row.
export const RULES_PANEL = { x: 30, y: 205, w: W - 60, h: 1165 };

// Play screen
export const PLAQUE = { x: 50, y: 222, w: 620, h: 236 };
export const TIME_BAR = { x: 40, y: 170, w: 640, h: 16 };
export const STOP_BTN = { x: 70, y: 1408, w: 270, h: 96 };
export const COLOR_BTN = { x: 380, y: 1408, w: 270, h: 96 };

// Session review: every answer from the session, mistakes first, paged.
export const REVIEW_TOP = 392;
export const REVIEW_ROW_H = 142;
export const REVIEW_PER_PAGE = 6;
export const PREV_BTN = { x: 40, y: 1262, w: 200, h: 84 };
export const NEXT_BTN = { x: 480, y: 1262, w: 200, h: 84 };
export const PLAY_AGAIN_BTN = { x: 40, y: 1384, w: 312, h: 112 };
export const CHANGE_MODE_BTN = { x: 368, y: 1384, w: 312, h: 112 };

export const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Auto Play ("Watch & Learn"): THINK -> REVEAL -> ACT per round. THINK_STEPS is an *index-based*
// configurable pause (never a raw float), default index 1 (5s), hard-capped at 10s per the owner's
// explicit instruction. REVEAL is fixed: long enough to compare the highlighted answer against your
// own guess, short enough to keep a whole session watchable. The Exit/Colours row reuses STOP_BTN/
// COLOR_BTN's exact geometry (never rendered at the same time as 'playing'), keeping the same
// button style without new layout surface. The think-time stepper sits in the gap between the
// plaque and the drift band (PLAQUE.y+PLAQUE.h=458 .. BAND_TOP=520) rather than the top corners,
// since the top corners there are already the clock/score HUD.
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_SECONDS = 2;
export const AUTO_THINK_DEC = { x: 160, y: 466, w: 90, h: 46 };
export const AUTO_THINK_INC = { x: 470, y: 466, w: 90, h: 46 };

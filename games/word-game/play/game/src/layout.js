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

// Rules reference: paginated, reached from the title screen only (this game has no other
// Controls/About screen to also wire into). Same two-large-buttons-at-bottom geometry the
// session-review screen already uses for its own Prev/Next-equivalent row.
export const RULES_BACK_BTN = { x: 40, y: 1384, w: 312, h: 112 };
export const RULES_NEXT_BTN = { x: 368, y: 1384, w: 312, h: 112 };

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

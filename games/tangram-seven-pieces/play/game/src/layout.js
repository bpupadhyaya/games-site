// Screen rectangles shared by drawing (view.js) and hit-testing (game.js). Pure data.
export const SCREEN = { width: 720, height: 1560 };

export const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// ---- play screen ----
export const BACK_BTN = { x: 16, y: 22, w: 84, h: 78 };
export const PAUSE_BTN = { x: 620, y: 22, w: 84, h: 78 };
export const BOARD = { x: 20, y: 148, w: 680, h: 744 };
export const TRAY_PANEL = { x: 20, y: 902, w: 680, h: 494 };
export const TOOLBAR_IDS = ['rotL', 'flip', 'rotR', 'undo', 'hint', 'reset'];
export const toolRect = (i) => ({ x: 14 + i * 118, y: 1410, w: 110, h: 110 });

// ---- auto play ----
export const AUTO_BTNS = {
  slower: { x: 24, y: 1410, w: 160, h: 110 },
  pause: { x: 200, y: 1410, w: 320, h: 110 },
  faster: { x: 536, y: 1410, w: 160, h: 110 },
};

// ---- document screens ----
export const DOC_BACK = { x: 16, y: 20, w: 140, h: 76 };
export const ZOOM_DEC = { x: 396, y: 20, w: 84, h: 76 };
export const ZOOM_INC = { x: 620, y: 20, w: 84, h: 76 };
export const DOC_PANEL = { x: 24, y: 112, w: 672, h: 1322 };
export const DOC_BODY = { x: 48, y: 136, w: 624, h: 1274 };
export const NAV_PREV = { x: 24, y: 1450, w: 210, h: 84 };
export const NAV_NEXT = { x: 486, y: 1450, w: 210, h: 84 };
// paginated screens give up the bottom strip to the nav buttons
export const DOC_BODY_NAV = { x: 48, y: 136, w: 624, h: 1190 };
export const DOC_PANEL_NAV = { x: 24, y: 112, w: 672, h: 1322 - 0 };

// ---- title screen ----
export const LANG_EN = { x: 440, y: 24, w: 120, h: 64 };
export const LANG_ZH = { x: 576, y: 24, w: 120, h: 64 };
export const MENU_REGION = { x: 24, y: 830, w: 672, h: 680 };

// ---- overlays ----
export const OVERLAY = { x: 50, y: 250, w: 620, h: 1060 };

export const TRAY_SLOT_HINT_Y = 1396;

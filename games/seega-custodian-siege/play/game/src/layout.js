// Screen rectangles shared by drawing (view.js) and hit-testing (game.js). Pure data.
export const SCREEN = { width: 720, height: 1560 };
export const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// ---- play screen: every size follows the text-zoom step s (1 to 3), so the HUD grows with the text ----
export const BACK_BTN = { x: 16, y: 22, w: 84, h: 78 };
export const PAUSE_BTN = { x: 620, y: 22, w: 84, h: 78 };
export const TOOLBAR_IDS = ['undo', 'think', 'restart'];

export function playLayout(scale, chain = false) {
  const k = Math.max(0, Math.min(1, (scale - 1) / 2));
  const chipH = Math.round(104 + 70 * k);
  let statusH = Math.round(150 + 150 * k);
  const toolH = Math.round(112 + 74 * k);
  const toolY = SCREEN.height - 28 - toolH;
  const top = 116, bottom = toolY - 18;
  const gap = 18;
  const side = Math.max(300, Math.min(672, bottom - top - chipH - statusH - gap * 2 - 24));
  // spare height goes to the status panel (Think reasons are long) and to breathing room
  statusH += Math.min(120, Math.max(0, Math.round((bottom - top - (chipH + side + statusH + gap * 2) - 24) * 0.6)));
  const total = chipH + gap + side + gap + statusH;
  const y0 = Math.round(top + (bottom - top - total) * 0.45);
  const boardY = y0 + chipH + gap;
  const sy = boardY + side + gap;
  // while a capture chain is open, the status panel shares its row with an End turn button
  const endW = chain ? Math.round(232 + 60 * k) : 0;
  return {
    chips: [{ x: 24, y: y0, w: 330, h: chipH }, { x: 366, y: y0, w: 330, h: chipH }],
    board: { x: Math.round((SCREEN.width - side) / 2), y: boardY, side },
    status: { x: 24, y: sy, w: 672 - (chain ? endW + 12 : 0), h: statusH },
    endBtn: chain ? { x: 696 - endW, y: sy, w: endW, h: statusH } : null,
    tool: [0, 1, 2].map((i) => ({ x: 24 + i * 232, y: toolY, w: 216, h: toolH })),
  };
}

// ---- Watch & Learn ----
export function autoLayout(scale) {
  const k = Math.max(0, Math.min(1, (scale - 1) / 2));
  const h = Math.round(112 + 74 * k), y = SCREEN.height - 28 - h;
  return { slower: { x: 24, y, w: 160, h }, pause: { x: 200, y, w: 320, h }, faster: { x: 536, y, w: 160, h }, labelY: y - 22 };
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

// ---- title screen ----
export const LANG_EN = { x: 24, y: 20, w: 324, h: 64 };
export const LANG_AR = { x: 372, y: 20, w: 324, h: 64 };
export const MENU_REGION = { x: 24, y: 760, w: 672, h: 760 };

// ---- overlays ----
export const OVERLAY = { x: 50, y: 250, w: 620, h: 1060 };

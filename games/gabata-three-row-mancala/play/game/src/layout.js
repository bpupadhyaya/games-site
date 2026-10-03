// Screen rectangles shared by drawing (view.js) and hit-testing (game.js). Pure data.
import { BW, BH } from './art.js';
export const SCREEN = { width: 720, height: 1560 };
export const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// ---- play screen: every size follows the text-zoom step s (1 to 3), so the HUD grows with the text ----
export const BACK_BTN = { x: 16, y: 22, w: 84, h: 78 };
export const PAUSE_BTN = { x: 620, y: 22, w: 84, h: 78 };
export const TOOLBAR_IDS = ['undo', 'think', 'restart'];

export function playLayout(scale) {
  const k = Math.max(0, Math.min(1, (scale - 1) / 2));
  const chipH = Math.round(140 + 50 * k);
  const statusH = Math.round(270 + 70 * k);
  const toolH = Math.round(112 + 74 * k);
  const toolY = SCREEN.height - 28 - toolH;
  const top = 116, bottom = toolY - 18;
  const gap = 24;
  const bw = Math.max(420, Math.min(696, Math.floor(((bottom - top - chipH * 2 - statusH - gap * 4 - 20) / BH) * BW)));
  const bh = bw * BH / BW;
  const total = chipH * 2 + gap * 3 + bh + statusH;
  const y0 = Math.round(top + (bottom - top - total) * 0.5);
  const boardY = y0 + chipH + gap;
  return {
    chips: [{ x: 24, y: y0, w: 672, h: chipH }, { x: 24, y: boardY + bh + gap, w: 672, h: chipH }],
    board: { x: Math.round((SCREEN.width - bw) / 2), y: boardY, w: bw },
    status: { x: 24, y: boardY + bh + gap + chipH + gap, w: 672, h: statusH },
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
export const MENU_REGION = { x: 24, y: 700, w: 672, h: 820 };

// ---- overlays ----
export const OVERLAY = { x: 50, y: 250, w: 620, h: 1060 };

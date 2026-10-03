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
  const chipH = Math.round(112 + 70 * k);
  const trayH = scale <= 1.5 ? 96 : 0; // the capture trays need room: they are hidden at large text
  const statusH = Math.round(290 + 80 * k);
  const toolH = Math.round(112 + 74 * k);
  const toolY = SCREEN.height - 28 - toolH;
  const top = 116, bottom = toolY - 18;
  const gap = trayH ? 14 : 18;
  const fixed = chipH * 2 + trayH * 2 + statusH + gap * 4;
  const bw = Math.max(420, Math.min(696, Math.floor(((bottom - top - fixed - 20) / BH) * BW)));
  const bh = bw * BH / BW;
  const total = fixed + bh;
  const y0 = Math.round(top + (bottom - top - total) * 0.45);
  let y = y0;
  const chip2 = { x: 24, y, w: 672, h: chipH }; y += chipH + (trayH ? 6 : 0);
  const tray2 = trayH ? { x: 24, y, w: 672, h: trayH } : null; y += trayH + gap;
  const boardY = y; y += bh + gap;
  const tray1 = trayH ? { x: 24, y, w: 672, h: trayH } : null; y += trayH + (trayH ? 6 : 0);
  const chip1 = { x: 24, y, w: 672, h: chipH }; y += chipH + gap;
  return {
    chips: [chip2, chip1], trays: [tray2, tray1],
    board: { x: Math.round((SCREEN.width - bw) / 2), y: boardY, w: bw },
    status: { x: 24, y, w: 672, h: statusH },
    tool: [0, 1, 2].map((i) => ({ x: 24 + i * 232, y: toolY, w: 216, h: toolH })),
  };
}

// Where the k-th captured stone lies in a capture tray (screen units): a loose heap, stable as stones are added.
// The first 120 px at the left are for captured mandarins.
export function trayStone(r, k) {
  const fr = (v) => v - Math.floor(v);
  const x0 = r.x + 150, w = r.w - 150 - 26;
  const row = k % 2;
  return [x0 + fr(k * 0.6180339 + 0.13) * w, r.y + r.h * (row ? 0.64 : 0.36) + (fr(k * 0.7548776) - 0.5) * 14];
}
export const trayQuan = (r, k) => [r.x + 44 + k * 52, r.y + r.h / 2];

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

// The two direction buttons shown in place of the status text while a square is selected.
export function dirLayout(status, scale) {
  const k = Math.max(0, Math.min(1, (scale - 1) / 2));
  const bh = Math.round(104 + 40 * k), gap = 12;
  const textH = Math.max(70, status.h - bh - gap - 14);
  const y = status.y + status.h - bh - 8;
  return { textH, left: { x: status.x + 8, y, w: status.w / 2 - 14, h: bh }, right: { x: status.x + status.w / 2 + 6, y, w: status.w / 2 - 14, h: bh } };
}

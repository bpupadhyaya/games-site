// Screen rectangles shared by drawing (view.js) and hit-testing (game.js). Pure data.
export const SCREEN = { width: 720, height: 1560 };
export const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function hudOf(scale) {
  const k = clamp((scale - 1) / 2, 0, 1);
  const h = Math.round(78 + 36 * k), bw = Math.round(84 + 20 * k);
  return { h, k, back: { x: 16, y: 22, w: bw, h }, pause: { x: SCREEN.width - 16 - bw, y: 22, w: bw, h }, name: { x: 16 + bw + 12, y: 22, w: SCREEN.width - 32 - 2 * bw - 24, h } };
}
export const TOOL_IDS = ['undo', 'clear', 'think', 'guide'];
export const SB_TOOLS = ['sbDraw', 'sbMirror', 'sbGrid', 'sbWeave', 'sbUndo', 'sbClear'];

function toolRects(ids, cols, rows, scale) {
  const k = clamp((scale - 1) / 2, 0, 1);
  const toolH = Math.round(100 + 40 * k);
  const bw = (672 - (cols - 1) * 12) / cols;
  const bottom = SCREEN.height - 24;
  const top = bottom - rows * toolH - (rows - 1) * 10;
  return { toolH, top, tools: ids.map((id, i) => ({ id, x: 24 + (i % cols) * (bw + 12), y: top + Math.floor(i / cols) * (toolH + 10), w: bw, h: toolH })) };
}

export function playLayout(scale) {
  const k = clamp((scale - 1) / 2, 0, 1);
  const hud = hudOf(scale);
  const focusH = Math.round(96 + 150 * k);
  const statusH = Math.round(150 + 120 * k);
  const { toolH, top, tools } = toolRects(TOOL_IDS, 4, 1, scale);
  const focus = { x: 24, y: 34 + hud.h, w: 672, h: focusH };
  const status = { x: 24, y: top - 14 - statusH, w: 672, h: statusH };
  const areaY = focus.y + focus.h + 10;
  const area = { x: 24, y: areaY, w: 672, h: status.y - 10 - areaY };
  const ah = Math.round(62 + 20 * k), aw = Math.round(190 + 40 * k);
  const applyBtn = { x: status.x + status.w - aw - 12, y: status.y + (statusH - ah) / 2, w: aw, h: ah };
  return { focus, status, area, tools, toolH, applyBtn, k, hud };
}

export function sandboxLayout(scale) {
  const k = clamp((scale - 1) / 2, 0, 1);
  const hud = hudOf(scale);
  const { toolH, top, tools } = toolRects(SB_TOOLS, 3, 2, scale);
  const statusH = Math.round(96 + 90 * k);
  const status = { x: 24, y: top - 14 - statusH, w: 672, h: statusH };
  const areaY = 34 + hud.h + 8;
  return { hud, tools, toolH, status, area: { x: 24, y: areaY, w: 672, h: status.y - 10 - areaY }, k };
}

export function autoLayout(scale) {
  const k = clamp((scale - 1) / 2, 0, 1);
  const h = Math.round(112 + 74 * k), y = SCREEN.height - 28 - h;
  const statusH = Math.round(230 + 170 * k);
  const status = { x: 24, y: y - 52 - statusH, w: 672, h: statusH };
  const focus = { x: 24, y: 34 + hudOf(scale).h, w: 672, h: Math.round(70 + 50 * k) };
  const areaY = focus.y + focus.h + 10;
  return { slower: { x: 24, y, w: 160, h }, pause: { x: 200, y, w: 320, h }, faster: { x: 536, y, w: 160, h }, labelY: y - 18, status, focus, area: { x: 24, y: areaY, w: 672, h: status.y - 10 - areaY } };
}

export const DOC_BACK = { x: 16, y: 20, w: 140, h: 76 };
export const ZOOM_DEC = { x: 396, y: 20, w: 84, h: 76 };
export const ZOOM_INC = { x: 620, y: 20, w: 84, h: 76 };
export const DOC_PANEL = { x: 24, y: 112, w: 672, h: 1322 };
export const DOC_BODY = { x: 48, y: 136, w: 624, h: 1274 };
export const NAV_PREV = { x: 24, y: 1450, w: 210, h: 84 };
export const NAV_NEXT = { x: 486, y: 1450, w: 210, h: 84 };
export const DOC_BODY_NAV = { x: 48, y: 136, w: 624, h: 1190 };
export const MENU_REGION = { x: 24, y: 640, w: 672, h: 890 };
export const OVERLAY = { x: 50, y: 250, w: 620, h: 1060 };

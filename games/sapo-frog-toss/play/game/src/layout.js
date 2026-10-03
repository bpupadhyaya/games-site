// Screen geometry in one place so game.js (hit-testing) and view.js (drawing) never disagree.
// Virtual resolution 720 x 1280, portrait. Nothing important within 40 px of the top or bottom edge,
// and the top-centre strip (y < 44) is left free for the preview badge.
export const W = 720;
export const H = 1280;
export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_SECS = 2;
export const TEXT_DEC = { x: 20, y: 18, w: 120, h: 60 };
export const TEXT_INC = { x: W - 140, y: 18, w: 120, h: 60 };
export const REF_BACK = { x: 20, y: 1164, w: 332, h: 100 };
export const REF_NEXT = { x: 368, y: 1164, w: 332, h: 100 };
export const SETUP_PINS = { start: { x: 30, y: 1156, w: 440, h: 96 }, back: { x: 486, y: 1156, w: 204, h: 96 } };

// The table scene is designed on y = 180 .. 1040. At 100 to 150 percent text it fills the screen under the scoreboard (the controls sit
// over its bottom edge); at larger text sizes the scene shrinks into the space that is left between the scoreboard and the controls.
export const SCENE_Y0 = 180, SCENE_H = 860;
export const COMPACT = 1.5;   // largest text scale that keeps the inline controls

// Compact (inline) controls.
export const TRAY = {
  mode: { y: 1034, h: 66, x: 16, bw: 98, gap: 6 },
  act: { y: 1108, h: 100 },
};
export const PULL = { y0: 420, y1: 1030, max: 300, min: 30 };   // where a touch starts a pull, how far a full pull is, the smallest pull that throws

export function playLayout(z, hudH, trayH) {
  if (z <= COMPACT) return { compact: true, s: 1, vx: 0, vy: SCENE_Y0, clip: null, hudH, trayTop: 1030 };
  const top = Math.min(hudH + 40, 560), bottom = H - Math.min(trayH + 36, 600);
  const h = Math.max(260, bottom - top), s = Math.min(1, h / SCENE_H);
  return { compact: false, s, vx: (W - W * s) / 2, vy: top + (h - SCENE_H * s) / 2, clip: { x: 0, y: top, w: W, h }, hudH, trayTop: bottom };
}

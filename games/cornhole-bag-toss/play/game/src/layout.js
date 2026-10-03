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

// The scene is designed on y = 170 .. 960 (its natural window). At 100 to 150 percent text it fills the screen under the scoreboard and
// above the controls; at larger text sizes the scene shrinks into the space that is left.
export const SCENE_Y0 = 170, SCENE_H = 790;
export const COMPACT = 1.5;   // largest text scale that keeps the inline controls
export const TRAY = {
  loft: { y: 964, h: 66 },
  spin: { y: 1038, h: 62 },
  act: { y: 1108, h: 102 },
};
// The mini board: a fixed top-down picture of the far board that never moves (scene coordinates).
export const MINI = { x: 16, y: 252, w: 128, h: 256 };
export const PULL_ZONE_Y0 = 250;   // a drag that starts below this line (scene coordinates) is a throw

export function playLayout(z, hudH, trayH) {
  if (z <= COMPACT) return { compact: true, s: 1, vx: 0, vy: SCENE_Y0, clip: null, hudH, trayTop: 956 };
  const top = Math.min(hudH + 6, 560), bottom = H - Math.min(trayH + 8, 600);
  const h = Math.max(260, bottom - top), s = Math.min(1, h / SCENE_H);
  return { compact: false, s, vx: (W - W * s) / 2, vy: top + (h - SCENE_H * s) / 2, clip: { x: 0, y: top, w: W, h }, hudH, trayTop: bottom };
}
export const toScene = (lay, x, y) => ({ x: (x - lay.vx) / lay.s, y: (y - lay.vy) / lay.s + SCENE_Y0 });

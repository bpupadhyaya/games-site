// Chrome (not the world itself) for the Auto Play ("Watch & Learn") scene: the Exit/Skip labels,
// the THINK/REVEAL caption, and the think-time stepper. Drawing only, reads nothing it doesn't
// need, mutates nothing - same contract as render.js/rulesView.js. The world itself (trees,
// hunters, bird, stones, HUD) is drawn by render.js's own drawScene(), exactly as in normal play;
// this file only adds the auto-play-specific overlay on top of it, plus the REVEAL ring highlight
// via render.js's own autoReveal() (the same ring art the manual-play safe-hint uses).
import { W, drawText, autoReveal } from './render.js';
import { AUTO_THINK_STEPS } from './tuning.js';

// Perch has no pause/menu button during normal play at all (a deliberate design choice: it is a
// continuous reflex run with no mid-run escape hatch). Auto Play needs one - these two boxes are
// new, scoped to scene === 'auto' only; normal play is untouched. Positioned to mirror the title
// screen's own "Rules" entry box (top corners, same size), matching this game's established style.
export const AUTO_EXIT_BOX = { x0: 16, y0: 26, x1: 176, y1: 96 };
export const AUTO_SKIP_BOX = { x0: W - 176, y0: 26, x1: W - 16, y1: 96 };

// Think-time stepper: mirrors the Rules page's own Back/Next nav row position and size exactly.
export const AUTO_DEC_BOX = { x0: 20, y0: 1148, x1: 260, y1: 1270 };
export const AUTO_INC_BOX = { x0: W - 260, y0: 1148, x1: W - 20, y1: 1270 };

// End-of-session buttons (game.js draws the result text itself, matching the real over/won
// screens; this file only owns the two tap targets beneath it).
export const AUTO_AGAIN_BOX = { x0: 60, y0: 954, x1: 350, y1: 1040 };
export const AUTO_EXIT2_BOX = { x0: 370, y0: 954, x1: 660, y1: 1040 };

export function renderAutoChrome(ctx, s, auto, thinkIdx, t) {
  drawText(ctx, 'Exit', 96, 66, 30, '#fff8e0', 800);
  drawText(ctx, 'Skip', W - 96, 66, 30, '#fff8e0', 800);
  if (auto.sub === 'think') {
    drawText(ctx, 'Auto Play — thinking… ' + Math.max(0, Math.ceil(auto.timer)) + 's', W / 2, 270, 28, '#cbb9e0', 700);
  } else if (auto.sub === 'reveal') {
    drawText(ctx, 'Auto Play — here it flits…', W / 2, 270, 28, '#ffd97a', 700);
    autoReveal(ctx, s, t, auto.target);
  } else {
    drawText(ctx, 'AUTO PLAY · WATCH & LEARN', W / 2, 270, 22, 'rgba(255,255,255,0.55)', 700);
  }
  const decOn = thinkIdx > 0, incOn = thinkIdx < AUTO_THINK_STEPS.length - 1;
  drawText(ctx, 'Think −', 140, 1209, 30, decOn ? '#fff8e0' : 'rgba(255,255,255,0.3)', 800);
  drawText(ctx, 'Think: ' + AUTO_THINK_STEPS[thinkIdx] + 's', W / 2, 1209, 26, '#ffe27a', 700);
  drawText(ctx, 'Think +', W - 140, 1209, 30, incOn ? '#fff8e0' : 'rgba(255,255,255,0.3)', 800);
}

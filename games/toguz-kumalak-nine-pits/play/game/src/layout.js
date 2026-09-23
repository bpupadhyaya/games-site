// Geometry of the virtual 720 x 1560 canvas. Bottom row (pits 0-8) is the player; top row (9-17) the opponent.
export const W = 720, H = 1560;
export const RX = 30, RY = 42, PITCH = 68, X0 = 88;
export const ROW_Y = { top: 612, bottom: 888 };
export const FRAME = { x: 10, y: 350, w: 700, h: 800 };
export const TRAY = { top: { x: 60, y: 386, w: 600, h: 126 }, bottom: { x: 60, y: 988, w: 600, h: 126 } };
export const MID_Y = 750;

// pit i: 0-8 along the bottom, left to right; 9-17 along the top, right to left (counter-clockwise)
export const pitPos = (i) => (i < 9 ? { x: X0 + PITCH * i, y: ROW_Y.bottom } : { x: X0 + PITCH * (17 - i), y: ROW_Y.top });
export const trayPos = (p) => ({ x: 360, y: p === 0 ? TRAY.bottom.y + 63 : TRAY.top.y + 63 });
// nearest pit to a tap (generous: the whole pit band counts), or -1
export function pitNear(x, y) {
  let best = -1, bd = 1e9;
  for (let i = 0; i < 18; i++) {
    const p = pitPos(i), dx = Math.abs(x - p.x), dy = Math.abs(y - p.y);
    if (dx > 34 || dy > 76) continue;
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export const BTN = {
  menu: { x: 40, y: 1340, w: 190, h: 82 }, undo: { x: 265, y: 1340, w: 190, h: 82 }, hint: { x: 490, y: 1340, w: 190, h: 82 },
  next: { x: 200, y: 1340, w: 320, h: 82 }, share: { x: 200, y: 1340, w: 320, h: 82 },
  again: { x: 130, y: 1000, w: 460, h: 96 }, back: { x: 130, y: 1120, w: 460, h: 96 },
};
// Auto Play's own bottom rail: 4 even slots (Exit, Pause/Resume, think-time -/+) in the same row
// BTN.menu/undo/hint occupy for a normal game - a dedicated rect set (not a 4th BTN slot crammed
// into the 3 above) because Pause must be reachable by itself, distinct from Exit, at any instant.
export const AUTO_BTN = (() => {
  const y = 1340, h = 82, gap = 16, x0 = 40, total = 640, w = (total - 3 * gap) / 4;
  const at = (i) => ({ x: x0 + i * (w + gap), y, w, h });
  return { exit: at(0), pause: at(1), dec: at(2), inc: at(3) };
})();
// About is now paginated (one heritage fact per page), same Back/Next split as Rules below.
export const ABOUT_BTN = { back: { x: 70, y: 1400, w: 280, h: 90 }, next: { x: 370, y: 1400, w: 280, h: 90 } };
const row = (y, h = 78) => ({ x: 70, y, w: 580, h });
export function titleRows(hasSave) {
  let y = 880;
  const R = {};
  if (hasSave) { R.resume = row(y); y += 84; }
  R.learn = row(y); y += 84;
  R.play = row(y); y += 84;
  R.two = row(y); y += 84;
  R.daily = row(y); y += 84;
  // About / Rules / Settings share this row, three even columns (was About / Settings — Rules is the addition).
  // Same outer span (x 70 to 650) and same y/h as before, so nothing below this row moves.
  const third = (580 - 20 * 2) / 3;
  R.about = { x: 70, y, w: third, h: 78 };
  R.rules = { x: 70 + third + 20, y, w: third, h: 78 };
  R.settings = { x: 70 + (third + 20) * 2, y, w: third, h: 78 };
  y += 78 + 26;
  // Free, silent, whole-game teaching demo - one more full-width row below everything else, with
  // room to spare below it regardless of which shape the list above is (with/without "Resume").
  R.auto = row(y);
  return R;
}
// Rules-page navigation: Back returns to the title, Next advances a page (wraps round). Same x/w/y
// this game's About and Settings back buttons already use, just split into two side-by-side halves.
export const RULES_BTN = { back: { x: 70, y: 1400, w: 280, h: 90 }, next: { x: 370, y: 1400, w: 280, h: 90 } };
// Text-size stepper for the About/Rules reference pages: a header row above the panel (panel starts
// at y=120), centred, mirroring the games this pattern is shared with. An index into TEXT_SCALES,
// never a raw float, so the stepper can cleanly disable at either end.
export const HEADER = { textDec: { x: 70, y: 26, w: 130, h: 66 }, textInc: { x: W - 200, y: 26, w: 130, h: 66 } };
export const TEXT_SCALES = [1, 1.3, 1.6, 2, 2.5, 3];
// Auto Play ("Watch & Learn") think-time steps, in seconds. Index into this, same pattern as
// TEXT_SCALES above - never a raw float, so the +/- stepper can cleanly disable at either end.
// Hard-capped at 10s per the owner's explicit instruction. Default index 1 (5s).
export const THINK_STEPS = [2, 5, 8, 10];
// settings rows (label left, value button)
export const SET = {
  level: { x: 70, y: 330, w: 580, h: 84 }, sound: { x: 70, y: 430, w: 580, h: 84 }, calm: { x: 70, y: 530, w: 580, h: 84 },
  big: { x: 70, y: 630, w: 580, h: 84 }, seeds: { x: 70, y: 730, w: 580, h: 84 }, wood: { x: 70, y: 830, w: 580, h: 84 },
  back: { x: 130, y: 1400, w: 460, h: 90 },
};

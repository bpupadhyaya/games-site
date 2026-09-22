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
  aboutBack: { x: 130, y: 1400, w: 460, h: 90 },
};
const row = (y, h = 78) => ({ x: 70, y, w: 580, h });
export function titleRows(hasSave) {
  let y = 880;
  const R = {};
  if (hasSave) { R.resume = row(y); y += 84; }
  R.learn = row(y); y += 84;
  R.play = row(y); y += 84;
  R.two = row(y); y += 84;
  R.daily = row(y); y += 84;
  R.about = { x: 70, y, w: 280, h: 78 }; R.settings = { x: 370, y, w: 280, h: 78 };
  return R;
}
// settings rows (label left, value button)
export const SET = {
  level: { x: 70, y: 330, w: 580, h: 84 }, sound: { x: 70, y: 430, w: 580, h: 84 }, calm: { x: 70, y: 530, w: 580, h: 84 },
  big: { x: 70, y: 630, w: 580, h: 84 }, seeds: { x: 70, y: 730, w: 580, h: 84 }, wood: { x: 70, y: 830, w: 580, h: 84 },
  back: { x: 130, y: 1400, w: 460, h: 90 },
};

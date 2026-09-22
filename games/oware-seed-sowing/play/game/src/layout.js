// Geometry of the virtual 720 x 1560 canvas. Bottom row (pits 0-5) is the player; top row (6-11) the opponent.
export const W = 720, H = 1560;
export const PIT_R = 46, PITCH = 100, X0 = 110;
export const ROW_Y = { top: 625, bottom: 825 };
export const FRAME = { x: 30, y: 392, w: 660, h: 666 };
export const TRAY = { top: { x: 60, y: 425, w: 600, h: 90 }, bottom: { x: 60, y: 935, w: 600, h: 90 } };
export const MID_Y = 725;

export const pitPos = (i) => (i < 6 ? { x: X0 + PITCH * i, y: ROW_Y.bottom } : { x: X0 + PITCH * (11 - i), y: ROW_Y.top });
export const trayPos = (p) => ({ x: 360, y: p === 0 ? TRAY.bottom.y + 45 : TRAY.top.y + 45 });
// nearest pit to a tap (generous: the whole row band counts), or -1
export function pitNear(x, y) {
  let best = -1, bd = 1e9;
  for (let i = 0; i < 12; i++) {
    const p = pitPos(i), dx = Math.abs(x - p.x), dy = Math.abs(y - p.y);
    if (dx > 54 || dy > 92) continue;
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
const row = (y, h = 84) => ({ x: 70, y, w: 580, h });
export function titleRows(hasSave) {
  let y = 735;
  const R = {};
  if (hasSave) { R.resume = row(y); y += 98; }
  R.learn = row(y); y += 98;
  R.play = row(y); y += 98;
  R.two = row(y); y += 98;
  R.daily = row(y); y += 98;
  R.about = { x: 70, y, w: 280, h: 84 }; R.settings = { x: 370, y, w: 280, h: 84 };
  return R;
}
// settings rows (label left, value button)
export const SET = {
  level: { x: 70, y: 330, w: 580, h: 84 }, sound: { x: 70, y: 430, w: 580, h: 84 }, calm: { x: 70, y: 530, w: 580, h: 84 },
  big: { x: 70, y: 630, w: 580, h: 84 }, seeds: { x: 70, y: 730, w: 580, h: 84 }, wood: { x: 70, y: 830, w: 580, h: 84 },
  back: { x: 130, y: 1400, w: 460, h: 90 },
};

// Geometry of the virtual 720 x 1560 canvas. The boat-shaped board stands upright: the player's seven houses are the RIGHT-hand
// column (place 0 at the bottom, 6 at the top) with their storehouse at the bottom; the opponent's are the LEFT column (place 8 at
// the top down to 14) with the storehouse at the top. Shells travel up the right column, across the top, down the left, along the bottom.
export const W = 720, H = 1560;
export const PIT_R = 44, PITCH = 86, COL_X = [478, 242], Y_BOT = 1056;
export const STORE_BOX = [{ x: 255, y: 1110, w: 210, h: 86 }, { x: 255, y: 400, w: 210, h: 86 }];   // [own (bottom), opponent's (top)]
export const HULL = { top: 308, bot: 1288, cx: 360, cy: 798, A: 280 };

export function posXY(pos) {
  if (pos < 7) return { x: COL_X[0], y: Y_BOT - PITCH * pos };
  if (pos === 7) return { x: 360, y: STORE_BOX[1].y + 43 };
  if (pos < 15) return { x: COL_X[1], y: Y_BOT - PITCH * 6 + PITCH * (pos - 8) };
  return { x: 360, y: STORE_BOX[0].y + 43 };
}
// the house nearest a tap, or -1 (generous: the whole column band counts)
export function houseNear(x, y) {
  let best = -1, bd = 1e9;
  for (let i = 0; i < 16; i++) {
    if (i === 7 || i === 15) continue;
    const p = posXY(i), dx = Math.abs(x - p.x), dy = Math.abs(y - p.y);
    if (dx > 70 || dy > 44) continue;
    const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; }
  }
  return best;
}
export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export const BTN = {
  menu: { x: 40, y: 1424, w: 190, h: 74 }, undo: { x: 265, y: 1424, w: 190, h: 74 }, hint: { x: 490, y: 1424, w: 190, h: 74 },
  next: { x: 250, y: 1424, w: 430, h: 74 }, share: { x: 250, y: 1424, w: 430, h: 74 },
  again: { x: 130, y: 1010, w: 460, h: 96 }, back: { x: 130, y: 1126, w: 460, h: 96 },
  cont: { x: 130, y: 1126, w: 460, h: 96 },
  aboutBack: { x: 130, y: 1400, w: 460, h: 90 },
  rulesBack: { x: 130, y: 1400, w: 220, h: 90 }, rulesNext: { x: 370, y: 1400, w: 220, h: 90 },
};
const row = (y, h = 84) => ({ x: 70, y, w: 580, h });
export function titleRows(hasSave) {
  let y = 745; const R = {};
  if (hasSave) { R.resume = row(y); y += 96; }
  R.learn = row(y); y += 96;
  R.play = row(y); y += 96;
  R.two = row(y); y += 96;
  R.daily = row(y); y += 96;
  // About / Controls / Settings share one row; Rules is the addition (was three even columns, now four).
  const gap = 12, qw = (580 - gap * 3) / 4;
  R.about = { x: 70, y, w: qw, h: 84 }; R.how = { x: 70 + (qw + gap), y, w: qw, h: 84 };
  R.rules = { x: 70 + (qw + gap) * 2, y, w: qw, h: 84 }; R.settings = { x: 70 + (qw + gap) * 3, y, w: qw, h: 84 };
  return R;
}
export const SET = {
  level: { x: 70, y: 300, w: 580, h: 84 }, match: { x: 70, y: 400, w: 580, h: 84 }, sound: { x: 70, y: 500, w: 580, h: 84 }, calm: { x: 70, y: 600, w: 580, h: 84 },
  big: { x: 70, y: 700, w: 580, h: 84 }, seeds: { x: 70, y: 800, w: 580, h: 84 }, wood: { x: 70, y: 900, w: 580, h: 84 },
  back: { x: 130, y: 1400, w: 460, h: 90 },
};

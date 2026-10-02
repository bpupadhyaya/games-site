// Geometry. Virtual canvas 720 x 1560. The trail is a winding path of six straight rows joined by U-turns; station i sits
// i * STEP pixels along it. Everything that is drawn and everything that can be tapped takes its numbers from here.
import { FINISH } from './rules.js';

export const W = 720;
export const H = 1560;
export const ROWS = 6, ROW_Y0 = 330, ROW_DY = 104, X0 = 96, X1 = 624, UR = ROW_DY / 2;
const LS = X1 - X0, LA = Math.PI * UR;
export const PATH_LEN = ROWS * LS + (ROWS - 1) * LA;
export const STEP = PATH_LEN / FINISH;

export const TRAY = { x: 36, y: 1016, w: 648, h: 282 };
export const BONE_SPOTS = [117, 279, 441, 603].map((x) => ({ x, y: 1182 }));
export const HUD_Y = 1402;
export const ACT_Y = 1308;
export const CHIP_Y = 912;

export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// the point (and heading) at arc length s along the trail; s may run a little outside [0, PATH_LEN]
export function pathPoint(s) {
  s = Math.max(-STEP * 2, Math.min(PATH_LEN + STEP * 2, s));
  let r = 0, rem = s;
  for (;;) {
    const y = ROW_Y0 + r * ROW_DY, dir = r % 2 === 0 ? 1 : -1;
    if (rem <= LS || r === ROWS - 1) {
      const t = rem; // may be negative before the start or past the finish
      return { x: dir > 0 ? X0 + t : X1 - t, y, ang: dir > 0 ? 0 : Math.PI };
    }
    rem -= LS;
    if (rem <= LA) {
      const cx = dir > 0 ? X1 : X0, cy = y + UR, th = dir > 0 ? -Math.PI / 2 + rem / UR : -Math.PI / 2 - rem / UR;
      return { x: cx + UR * Math.cos(th), y: cy + UR * Math.sin(th), ang: dir > 0 ? th + Math.PI / 2 : th - Math.PI / 2 };
    }
    rem -= LA; r++;
  }
}
// station position (index may be fractional while a rider is moving)
export const stationXY = (i) => pathPoint(i * STEP);

// small offsets so riders sharing a station do not sit exactly on top of each other
export function slotOffset(k, n) {
  if (n <= 1) return { dx: 0, dy: 0 };
  const sp = n === 2 ? [[-8, -9], [8, 9]] : n === 3 ? [[-14, -10], [0, 10], [14, -10]] : [[-16, -11], [-6, 11], [8, -11], [18, 11]];
  const [dx, dy] = sp[k % sp.length];
  return { dx, dy };
}

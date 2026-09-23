// Geometry. The board is a plane seen in perspective: board coordinates (u, v) with u in -1..1 (the three lanes) and
// v in 0..4 (0 = the far end, where the hare starts; 4 = the near end, where the hounds start). A true projective map,
// so straight lines stay straight. The board is turned so its long axis runs up the tall screen.
import { AX, LAT } from './rules.js';
export const W = 720, H = 1560;
// D: lane spacing at the near edge. K and HGT set the tilt: the far row sits at y = 520, the near row at y = 1300.
const CX = 360, D = 215, K = 0.05, HGT = 4680, Y_NEAR = 1300, Y_H = Y_NEAR - HGT;
// Everything drawn on the board (paths, rings, pieces) scales with UNIT.
export const UNIT = D / 126;

export function project(u, v) {
  const z = 1 + K * (4 - v);
  return { x: CX + (u * D) / z, y: Y_H + HGT / z, s: 1 / z };
}
// point index 0..10 -> screen
export const pointAt = (i) => project(LAT[i] - 1, 4 - AX[i]);
export const PIECE_R = 45 * UNIT;
export const SIZE = { H: 1.2, D: 1.14 };

const row = (i) => ({ x: 90, y: 770 + i * 78, w: 540, h: 68 });
// The title's buttons depend on whether an unfinished game is saved:
// { resume?, learn, campaign, hare, hound, two, daily, level, sound, marks, calm, look }
export function titleRows(hasSave) {
  const full = (hasSave ? ['resume'] : []).concat(['learn', 'campaign']), out = {};
  full.forEach((n, i) => { out[n] = row(i); });
  let y = 770 + full.length * 78;
  out.hare = { x: 90, y, w: 262, h: 68 }; out.hound = { x: 368, y, w: 262, h: 68 };
  out.two = row(full.length + 1); out.daily = row(full.length + 2);
  y = 770 + (full.length + 3) * 78 + 4;
  out.level = { x: 90, y, w: 262, h: 62 }; out.sound = { x: 368, y, w: 262, h: 62 };
  out.marks = { x: 90, y: y + 70, w: 262, h: 62 }; out.calm = { x: 368, y: y + 70, w: 262, h: 62 };
  // 'Board and pieces' used to span the full row alone, then shared it with Rules (2 columns); now
  // 3 columns at the same y and overall span (90..630) for the Auto Play addition - nothing else
  // on the title screen moves.
  out.look = { x: 90, y: y + 140, w: 169, h: 62 };
  out.rules = { x: 275, y: y + 140, w: 169, h: 62 };
  out.auto = { x: 460, y: y + 140, w: 170, h: 62 };
  return out;
}
// The 'Board and pieces' screen: three boards, two piece sets, message size, back.
export const LOOK = {
  boards: [0, 1, 2].map((i) => ({ x: 90 + i * 184, y: 800, w: 172, h: 76 })),
  sets: [0, 1].map((i) => ({ x: 90 + i * 278, y: 960, w: 262, h: 76 })),
  text: [0, 1].map((i) => ({ x: 90 + i * 278, y: 1120, w: 262, h: 76 })),
  back: { x: 140, y: 1290, w: 440, h: 84 },
};
// The campaign: twelve levels in a grid of tiles.
export const TILE = (i) => ({ x: 60 + (i % 3) * 210, y: 300 + Math.floor(i / 3) * 226, w: 200, h: 208 });
export const BTN = {
  menu: { x: 60, y: 1462, w: 190, h: 72 }, undo: { x: 265, y: 1462, w: 190, h: 72 }, hint: { x: 470, y: 1462, w: 190, h: 72 },
  again: { x: 140, y: 900, w: 440, h: 96 }, back: { x: 140, y: 1016, w: 440, h: 84 }, share: { x: 140, y: 1120, w: 440, h: 84 },
  next: { x: 140, y: 1462, w: 440, h: 72 },
};
// Rules reference: paginated, reached from the title screen only. Back/Next share the bottom-bar
// row/height the play screen's own button bar already uses.
export const RULES_NAV = { back: { x: 90, y: 1462, w: 262, h: 72 }, next: { x: 368, y: 1462, w: 262, h: 72 } };
// The text-size stepper lives in its own row at the very top of the Rules screen - well clear of
// the Back/Next page-turn buttons at the bottom - so it never fights either for space or attention.
export const RULES_HEADER = { textDec: { x: 30, y: 34, w: 130, h: 66 }, textInc: { x: W - 160, y: 34, w: 130, h: 66 } };
// The reader-card panel that frames the Rules body text, between the header row and the bottom nav.
export const RULES_PANEL = { x: 24, y: 118, w: W - 48, h: 1320 };
// Text-size steps for the Rules reference page. An *index* into this, never a raw float, so the
// stepper can cleanly disable at either end. Every page's content is paced (content.js) to fit
// comfortably even at the top step (2026-09-23: raised from 1.3 to 2.0, then to 3.0, at the
// owner's request).
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Auto Play (assisted-learning THINK -> REVEAL -> ACT loop, watches the real engine.js chooseMove
// play both the hare and the hounds). Think-time steps: an *index* array like TEXT_SCALES above,
// never a raw float, default index 1 (5s), hard-capped at the last step (10s - owner instruction:
// "max wait should not be more than 10s"). REVEAL is fixed, the same at every think-time step.
export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_TIME = 2;
// The corner think-time stepper matches the Rules page's own A-/A+ spot; the bottom row matches
// the play screen's own three-button bar (BTN.menu/undo/hint) in spot and size.
export const AUTOPLAY = {
  dec: { x: 30, y: 34, w: 130, h: 66 }, inc: { x: W - 160, y: 34, w: 130, h: 66 },
  exit: { x: 60, y: 1462, w: 190, h: 72 }, pause: { x: 265, y: 1462, w: 190, h: 72 }, skip: { x: 470, y: 1462, w: 190, h: 72 },
};
// The hunt clock: one small token per hound move the hounds have, in one centred row.
export const CLOCK_Y = 312;
export const clockPos = (k, n) => { const step = Math.min(30, 640 / n); return { x: 360 - ((n - 1) * step) / 2 + k * step, y: CLOCK_Y }; };
// Which board point a tap means: the nearest point or the head standing on it.
export function pointNear(x, y) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < 11; i++) { const p = pointAt(i), d = Math.min(Math.hypot(p.x - x, p.y - y), Math.hypot(p.x - x, p.y - 34 * p.s - y)); if (d < bd) { bd = d; best = i; } }
  return bd < 80 ? best : -1;
}

// The buttons on the result screen. A campaign level offers the next level after a win; every result offers a retry and the menu.
export function overButtons(camp, won, hasNext) {
  if (camp >= 0) {
    const out = [];
    if (won && hasNext) out.push({ id: 'next', label: 'Next level', primary: true });
    out.push({ id: 'again', label: 'Try again', primary: !(won && hasNext) });
    out.push({ id: 'levels', label: 'Levels' });
    return out.map((b, i) => ({ ...b, rect: { x: 140, y: 900 + i * 116, w: 440, h: 96 } }));
  }
  return [{ id: 'again', label: 'Play again', primary: true, rect: BTN.again }, { id: 'menu', label: 'Menu', rect: BTN.back }];
}

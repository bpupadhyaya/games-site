// Geometry. Virtual canvas 720 x 1560. The board is always 616 wide, so 11x11 squares are 56 and 7x7 squares 88.
export const W = 720, H = 1560;
export const BX = 52, BY = 500, BS = 616;
export const cell = (n) => BS / n;
export const centerOf = (n, i) => ({ x: BX + ((i % n) + 0.5) * cell(n), y: BY + (((i / n) | 0) + 0.5) * cell(n) });
export function squareAt(n, px, py) {
  const cs = cell(n), x = Math.floor((px - BX) / cs), y = Math.floor((py - BY) / cs);
  return x < 0 || y < 0 || x >= n || y >= n ? -1 : x + n * y;
}
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const R = (x, y, w, h) => ({ x, y, w, h });
export const BTN = {
  menu: R(60, 1462, 190, 72), undo: R(265, 1462, 190, 72), hint: R(470, 1462, 190, 72),
  again: R(140, 980, 440, 96), back: R(140, 1096, 440, 84), share: R(140, 1160, 440, 84),
  next: R(265, 1462, 395, 72), skip: R(470, 1462, 190, 72),
};
// About/Controls/Rules reference pages: a plain two-button pill row (professional-polish pass,
// 2026-09-23) - previously Menu/Back/Next all had to share this one row (three buttons, cramped),
// with Back only appearing from page 2 on. Menu is gone: Back now does double duty exactly like the
// good pattern elsewhere in this repo (fox-and-geese, hare-and-hounds, go-stones-and-territory) -
// it is ALWAYS present, and reads as dimmed (never disabled outright - it still exits, so it is
// never a dead end) once there is no earlier page to go back to (`state.page === 0`). Equal widths,
// same geometry the sibling games use for their own Rules nav.
export const PAGE_NAV = { back: R(90, 1462, 262, 72), next: R(368, 1462, 262, 72) };
// Text-size stepper for the reference pages, in the empty margin above their panel. Moved down from
// y=48 (professional-polish pass, 2026-09-23): the persistent roof-beam braid `drawScene()` paints
// behind every scene sits at roughly y 38-80, and the stepper's old position sat right on top of
// it, cutting the woven pattern in half behind the buttons - fine on the title screen (nothing else
// is drawn there) but cluttered wherever a button actually overlapped it. Now clears the beam with
// real margin on both sides (before it, and before the panel at y=140). An *index* into
// TEXT_SCALES, never a raw float, so "min"/"max" are exact and the stepper cleanly disables at
// either end. Every reference page's content is paced (pages.js) to fit comfortably at the top step.
export const TEXT_DEC = R(185, 90, 155, 44);
export const TEXT_INC = R(380, 90, 155, 44);
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
// Auto Play (assisted-learning THINK -> REVEAL -> ACT loop, same pattern as the other Arcforge
// games): a bottom control row (reuses the board scenes' own BTN row geometry, since Auto Play's
// board is not otherwise interactive) plus a think-time stepper in the header gap between the
// piece trays and the board (y 424-500). An index into AP_THINK_STEPS, never a raw float.
// The board's own carved frame (art.js FR = 34) extends 34px above BY (500), so anything in the
// header must clear y=466, not y=500 - found by actually rendering this (the first version of this
// stepper sat at y 440-490 and visibly collided with the frame's top braid and corner bosses).
export const AP = {
  exit: R(60, 1462, 190, 72), pause: R(265, 1462, 190, 72), skip: R(470, 1462, 190, 72),
  dec: R(150, 352, 130, 50), inc: R(440, 352, 130, 50),
};
export const AP_THINK_STEPS = [2, 5, 8, 10];
export const AP_REVEAL_TIME = 2;

// Title screen: rows of crafted buttons.
export function titleRows(hasSave) {
  const names = (hasSave ? ['resume'] : []).concat(['learn', 'big', 'small', 'daily', 'two', 'auto']), out = {};
  names.forEach((nm, i) => { out[nm] = R(90, 700 + i * 76, 540, 66); });
  const y = 700 + names.length * 76 + 6;
  out.side = R(90, y, 262, 60); out.level = R(368, y, 262, 60);
  out.sound = R(90, y + 68, 262, 60); out.calm = R(368, y + 68, 262, 60);
  out.text = R(90, y + 136, 262, 60); out.about = R(368, y + 136, 262, 60);
  // Controls and the new Rules reference share the row Controls used to have alone, same two-column
  // pattern as side/level, sound/calm, text/about above - nothing else on the title screen moves.
  out.help = R(90, y + 204, 262, 60); out.rules = R(368, y + 204, 262, 60);
  return out;
}

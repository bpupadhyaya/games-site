// All screen-space geometry lives here. The canvas is tall (720x1560) so it fills modern phones.
// Foundations sit in a row at the top, the seven tableau columns take the long middle of the
// screen, and the stock, the waste and the buttons sit at the bottom, under the thumb.
// The app draws its own "Menu" button top-left and a preview pill top-centre, so the first
// ~100 units are left empty.

export const W = 720;
export const H = 1560;
export const CARD_W = 136;
export const CARD_H = 192;
const MARGIN = 4;
const TABLEAU_COLS = 7;

// Vertical step between stacked cards. The face-up step shows the whole rank + suit strip.
export const STEP_UP = 62;
export const STEP_DOWN = 40;

const FOUNDATION_GAP = 20;
const TOP_Y = 104;
const TABLEAU_TOP = TOP_Y + CARD_H + 30;
const BOTTOM_Y = 1340; // stock, waste and buttons
const TABLEAU_BOTTOM = BOTTOM_Y - 22;

export const BTN = {
  hint: { x: 20, y: BOTTOM_Y, w: 388, h: 104 },
  options: { x: 20, y: BOTTOM_Y + 118, w: 388, h: 74 },
  deal: { x: 110, y: 860, w: 500, h: 132 },
  // Options/Rules/Auto share one row, same outer edges (140..580) and the same y/height as
  // before Auto Play was added, so nothing else on the title screen moved.
  titleOptions: { x: 140, y: 1176, w: 136, h: 96 },
  titleRules: { x: 292, y: 1176, w: 136, h: 96 },
  titleAuto: { x: 444, y: 1176, w: 136, h: 96 },
  dealAgain: { x: 130, y: 900, w: 460, h: 116 },
  // The Rules reference page's own nav row (Back exits to the title; Next cycles pages).
  rulesBack: { x: 20, y: 1416, w: 330, h: 116 },
  rulesNext: { x: 370, y: 1416, w: 330, h: 116 },
  // Text-size stepper on the Rules reference page: a header row above the "Rules" title.
  textDec: { x: 20, y: 20, w: 130, h: 68 },
  textInc: { x: W - 150, y: 20, w: 130, h: 68 },
  // Auto Play ("Watch & Learn"): the top ~100px is otherwise empty in this game (the native app
  // chrome lives outside the canvas — see the file header comment), so its status bar + think-time
  // stepper live there. The bottom two buttons are repurposed (Skip/Pause replace Hint/Options,
  // which have no meaning in a spectator demo) rather than adding a third row.
  autoBar: { x: 20, y: 18, w: W - 40, h: 72 },
  autoDec: { x: W - 216, y: 30, w: 56, h: 48 },
  autoInc: { x: W - 96, y: 30, w: 56, h: 48 },
  autoSkip: { x: 20, y: BOTTOM_Y, w: 388, h: 104 },
  autoPause: { x: 20, y: BOTTOM_Y + 118, w: 190, h: 74 },
  autoExit: { x: 218, y: BOTTOM_Y + 118, w: 190, h: 74 },
};
// Configurable Auto Play think-time: index-based steps (never a raw float), hard-capped at 10s.
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECS = 2;
// Text-size steps for the Rules reference page. Index into this, never a raw float, so the
// stepper can cleanly disable at either end. Content is paced (content.js) to fit even at the top.
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];

// The title's hero fan: tapping it also deals.
export const HERO = { x: 20, y: 340, w: 680, h: 460 };

// Options sheet: every control is a large, direct target.
const tableRect = (i) => ({ x: 44 + (i % 5) * 128, y: 262 + Math.floor(i / 5) * 100, w: 120, h: 88 });
const themeRect = (i) => ({ x: 44 + (i % 4) * 161, y: 540 + Math.floor(i / 4) * 196, w: 149, h: 148 });
export const OPT = {
  tableRect,
  themeRect,
  suits2: { x: 44, y: 1000, w: 308, h: 92 },
  suits4: { x: 368, y: 1000, w: 308, h: 92 },
  motionOn: { x: 44, y: 1180, w: 308, h: 92 },
  motionOff: { x: 368, y: 1180, w: 308, h: 92 },
  done: { x: 140, y: 1340, w: 440, h: 110 },
  // Opening Options mid-hand (the only way back to the title once a hand has started — there was
  // no other exit at all, see STATUS.md) splits the bottom row: a secondary "New deal" alongside
  // the primary "Done", instead of the single full-width Done shown from the title.
  newDeal: { x: 20, y: 1340, w: 320, h: 110 },
  doneAfterHand: { x: 380, y: 1340, w: 320, h: 110 },
};

export const contains = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export function computeLayout(meta) {
  const usableW = meta.width - MARGIN * 2;
  const tabSpacing = (usableW - CARD_W) / (TABLEAU_COLS - 1);
  const foundationX0 = (meta.width - (4 * CARD_W + 3 * FOUNDATION_GAP)) / 2;
  const availableH = TABLEAU_BOTTOM - TABLEAU_TOP - CARD_H;
  const tableauX = (col) => MARGIN + col * tabSpacing;

  return {
    topY: TOP_Y,
    tableauTopY: TABLEAU_TOP,
    stockPos: { x: meta.width - MARGIN - CARD_W - 4, y: BOTTOM_Y },
    wastePos: { x: meta.width - MARGIN - CARD_W * 2 - 24, y: BOTTOM_Y },
    foundationPos: (i) => ({ x: foundationX0 + i * (CARD_W + FOUNDATION_GAP), y: TOP_Y }),
    tableauX,
    // The y of every card in a column. Face-down cards step less than face-up ones; a very long
    // column is squeezed evenly so it never runs into the bottom row.
    columnYs(column) {
      let total = 0;
      for (let i = 0; i < column.length - 1; i++) total += column[i].faceUp ? STEP_UP : STEP_DOWN;
      const k = total > availableH ? availableH / total : 1;
      const ys = [];
      let y = TABLEAU_TOP;
      for (let i = 0; i < column.length; i++) {
        ys.push(y);
        y += (column[i].faceUp ? STEP_UP : STEP_DOWN) * k;
      }
      return ys;
    },
    hitTestCard(x, y, cardX, cardY) {
      return x >= cardX && x <= cardX + CARD_W && y >= cardY && y <= cardY + CARD_H;
    },
  };
}

// Resolve a tap (virtual x/y) into a semantic target the game understands. Returns null when
// the tap didn't land on anything actionable.
export function hitTest(meta, layout, board, x, y) {
  if (layout.hitTestCard(x, y, layout.stockPos.x, layout.stockPos.y)) return { pile: 'stock' };
  if (board.waste.length > 0 && layout.hitTestCard(x, y, layout.wastePos.x, layout.wastePos.y)) {
    return { pile: 'waste' };
  }
  for (let i = 0; i < 4; i++) {
    const pos = layout.foundationPos(i);
    if (layout.hitTestCard(x, y, pos.x, pos.y)) return { pile: 'foundation', index: i };
  }
  if (y < layout.tableauTopY || y > TABLEAU_BOTTOM + 10) return null;
  // Columns overlap sideways and the right-hand one is drawn on top, so look right-to-left.
  // First pass: the tap must be on a card. Second pass: forgiving — anywhere under a column.
  for (const strict of [true, false]) {
    for (let col = TABLEAU_COLS - 1; col >= 0; col--) {
      const column = board.tableau[col];
      const cx = layout.tableauX(col);
      if (x < cx || x > cx + CARD_W) continue;
      if (column.length === 0) {
        if (!strict || y <= layout.tableauTopY + CARD_H) return { pile: 'tableau', col, index: -1 };
        continue;
      }
      const ys = layout.columnYs(column);
      if (strict && y > ys[ys.length - 1] + CARD_H) continue;
      let hitIndex = -1;
      for (let i = 0; i < ys.length; i++) if (y >= ys[i]) hitIndex = i;
      if (hitIndex >= 0) return { pile: 'tableau', col, index: hitIndex };
    }
  }
  return null;
}

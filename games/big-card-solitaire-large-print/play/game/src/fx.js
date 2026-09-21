// Visual-only motion. Each card remembers where it is drawn; when the board says it belongs
// somewhere else, it slides there with an ease instead of jumping. Driven only by the fixed dt,
// and it never feeds back into the rules — the board is always already in its final state.

const SUITS = ['S', 'H', 'D', 'C'];
const SLIDE = 0.26;
const FLIP = 0.22;
export const cardId = (card) => `${card.suit}${card.rank}`;
const easeOut = (f) => 1 - (1 - f) * (1 - f) * (1 - f);

// Where every card of the board belongs on screen right now.
export function placeCards(board, layout, visit) {
  for (const card of board.stock) visit(card, layout.stockPos.x, layout.stockPos.y);
  for (const card of board.waste) visit(card, layout.wastePos.x, layout.wastePos.y);
  SUITS.forEach((suit, i) => {
    const pos = layout.foundationPos(i);
    for (const card of board.foundations[suit]) visit(card, pos.x, pos.y);
  });
  board.tableau.forEach((column, col) => {
    const ys = layout.columnYs(column);
    column.forEach((card, i) => visit(card, layout.tableauX(col), ys[i]));
  });
}

export function createFx(layout) {
  const cards = new Map(); // id -> { x0, y0, tx, ty, t, dur, delay, faceUp, flip }
  let time = 0;
  let wonAt = -1;
  let optionsT = 0;

  return {
    // A fresh hand: every tableau card starts on the stock and is dealt out row by row.
    deal(board, reduced) {
      cards.clear();
      wonAt = -1;
      if (reduced) return;
      let n = 0;
      const rows = board.tableau.length;
      for (let row = 0; row < rows; row++) {
        for (let col = row; col < rows; col++) {
          const card = board.tableau[col][row];
          if (!card) continue;
          cards.set(cardId(card), { x0: layout.stockPos.x, y0: layout.stockPos.y, tx: layout.stockPos.x, ty: layout.stockPos.y, t: 0, dur: 0.34, delay: n * 0.022, faceUp: false, flip: 1 });
          n++;
        }
      }
    },
    won() { wonAt = time; },
    sinceWon: () => (wonAt < 0 ? 0 : time - wonAt),
    time: () => time,
    optionsT: () => optionsT,

    update(dt, state) {
      time += dt;
      optionsT = state.options ? Math.min(1, optionsT + dt / 0.2) : 0;
      if (!state.board) return;
      const reduced = state.reducedMotion;
      placeCards(state.board, layout, (card, x, y) => {
        const id = cardId(card);
        let e = cards.get(id);
        if (!e) {
          e = { x0: x, y0: y, tx: x, ty: y, t: 1, dur: SLIDE, delay: 0, faceUp: card.faceUp, flip: 1 };
          cards.set(id, e);
        }
        if (e.tx !== x || e.ty !== y) {
          const now = position(e);
          e.x0 = now.x; e.y0 = now.y; e.tx = x; e.ty = y;
          e.t = reduced ? e.dur : 0;
          if (e.delay <= 0) e.dur = SLIDE;
        }
        if (e.faceUp !== card.faceUp) {
          e.faceUp = card.faceUp;
          e.flip = reduced ? 1 : 0;
        }
        if (e.delay > 0) e.delay -= dt;
        else {
          if (e.t < e.dur) e.t = Math.min(e.dur, e.t + dt);
          if (e.flip < 1) e.flip = Math.min(1, e.flip + dt / FLIP);
        }
      });
    },

    // { x, y, moving (0..1, 1 = mid-flight), flip (0..1) } for a card; falls back to its resting place.
    look(card, x, y) {
      const e = cards.get(cardId(card));
      if (!e) return { x, y, moving: 0, flip: 1 };
      const p = position(e);
      const f = e.dur > 0 ? e.t / e.dur : 1;
      return { x: p.x, y: p.y, moving: f >= 1 ? 0 : Math.sin(Math.PI * f), waiting: e.delay > 0, flip: e.flip };
    },
  };
}

function position(e) {
  const f = e.dur > 0 ? Math.min(1, e.t / e.dur) : 1;
  const k = easeOut(f);
  return { x: e.x0 + (e.tx - e.x0) * k, y: e.y0 + (e.ty - e.y0) * k };
}

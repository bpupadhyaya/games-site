// Klondike rules engine. Operates on a plain "board" object:
//   { tableau: Card[][7], foundations: { S,H,D,C: Card[] }, stock: Card[], waste: Card[] }
// Pure functions only — no randomness, no DOM, no dates — so the same engine is used by the
// interactive game (game.js) and by the winnable-deal search (solver.js).
//
// Known, deliberate simplification (documented in STATUS.md): a card already placed on a
// foundation can never be moved back to the tableau. Most mobile Klondike implementations
// disable this too; it keeps both the UI and the solver's search space much smaller.

import { SUITS, suitColor } from './deck.js';

export const TABLEAU_COLS = 7;

export function dealKlondike(shuffledDeck) {
  const deck = shuffledDeck.map((c) => ({ suit: c.suit, rank: c.rank, faceUp: false }));
  const tableau = [];
  let idx = 0;
  for (let col = 0; col < TABLEAU_COLS; col++) {
    const pile = [];
    for (let k = 0; k <= col; k++) {
      const card = deck[idx++];
      card.faceUp = k === col;
      pile.push(card);
    }
    tableau.push(pile);
  }
  const stock = deck.slice(idx);
  return {
    tableau,
    foundations: { S: [], H: [], D: [], C: [] },
    stock,
    waste: [],
  };
}

export function cloneBoard(board) {
  return {
    tableau: board.tableau.map((col) => col.map((c) => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))),
    foundations: {
      S: board.foundations.S.map((c) => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      H: board.foundations.H.map((c) => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      D: board.foundations.D.map((c) => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      C: board.foundations.C.map((c) => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
    },
    stock: board.stock.map((c) => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
    waste: board.waste.map((c) => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
  };
}

export function canPlaceOnFoundation(card, foundations) {
  const pile = foundations[card.suit];
  if (pile.length === 0) return card.rank === 1;
  return pile[pile.length - 1].rank === card.rank - 1;
}

export function canPlaceOnTableau(card, column) {
  if (column.length === 0) return card.rank === 13;
  const top = column[column.length - 1];
  return top.faceUp && suitColor(top.suit) !== suitColor(card.suit) && top.rank === card.rank + 1;
}

export function isWon(board) {
  return SUITS.every((s) => board.foundations[s].length === 13);
}

export function cardCount(board) {
  const tableau = board.tableau.reduce((n, col) => n + col.length, 0);
  const foundations = SUITS.reduce((n, s) => n + board.foundations[s].length, 0);
  return tableau + foundations + board.stock.length + board.waste.length;
}

function flipTopIfNeeded(column) {
  if (column.length > 0) column[column.length - 1].faceUp = true;
}

export function drawFromStock(board) {
  if (board.stock.length > 0) {
    const card = board.stock.pop();
    card.faceUp = true;
    board.waste.push(card);
    return true;
  }
  if (board.waste.length > 0) {
    board.stock = board.waste
      .slice()
      .reverse()
      .map((c) => ({ suit: c.suit, rank: c.rank, faceUp: false }));
    board.waste = [];
    return true;
  }
  return false;
}

export function moveWasteToFoundation(board) {
  const card = board.waste[board.waste.length - 1];
  if (!card || !canPlaceOnFoundation(card, board.foundations)) return false;
  board.waste.pop();
  board.foundations[card.suit].push(card);
  return true;
}

export function moveWasteToTableau(board, col) {
  const card = board.waste[board.waste.length - 1];
  if (!card || !canPlaceOnTableau(card, board.tableau[col])) return false;
  board.waste.pop();
  board.tableau[col].push(card);
  return true;
}

// The "run" starting at `index` is the tapped card plus every card above it. Because cards only
// ever become face up in a legal alternating-colour, descending sequence, any face-up run is
// already a valid movable stack — no extra validation is needed here.
export function tableauRun(board, col, index) {
  const column = board.tableau[col];
  if (index < 0 || index >= column.length || !column[index].faceUp) return null;
  return column.slice(index);
}

export function moveTableauToFoundation(board, col, index) {
  const run = tableauRun(board, col, index);
  if (!run || run.length !== 1) return false;
  const card = run[0];
  if (!canPlaceOnFoundation(card, board.foundations)) return false;
  board.tableau[col].pop();
  board.foundations[card.suit].push(card);
  flipTopIfNeeded(board.tableau[col]);
  return true;
}

export function moveTableauToTableau(board, fromCol, index, toCol) {
  if (fromCol === toCol) return false;
  const run = tableauRun(board, fromCol, index);
  if (!run) return false;
  const bottom = run[0];
  if (!canPlaceOnTableau(bottom, board.tableau[toCol])) return false;
  board.tableau[fromCol].length = index;
  board.tableau[toCol].push(...run);
  flipTopIfNeeded(board.tableau[fromCol]);
  return true;
}

export function legalMovesFromWaste(board) {
  const card = board.waste[board.waste.length - 1];
  if (!card) return [];
  const moves = [];
  if (canPlaceOnFoundation(card, board.foundations)) moves.push({ kind: 'waste-foundation' });
  for (let col = 0; col < TABLEAU_COLS; col++) {
    if (canPlaceOnTableau(card, board.tableau[col])) moves.push({ kind: 'waste-tableau', col });
  }
  return moves;
}

export function legalMovesFromTableau(board, col, index) {
  const run = tableauRun(board, col, index);
  if (!run) return [];
  const moves = [];
  const bottom = run[0];
  if (run.length === 1 && canPlaceOnFoundation(bottom, board.foundations)) {
    moves.push({ kind: 'tableau-foundation', col, index });
  }
  for (let to = 0; to < TABLEAU_COLS; to++) {
    if (to === col) continue;
    if (canPlaceOnTableau(bottom, board.tableau[to])) moves.push({ kind: 'tableau-tableau', col, index, to });
  }
  return moves;
}

// Every legal move currently available, from every source. Used both by the "what can I do?"
// hint overlay and by the solver's move enumeration.
export function allLegalMoves(board) {
  const moves = [];
  for (const m of legalMovesFromWaste(board)) moves.push({ ...m, source: 'waste' });
  for (let col = 0; col < TABLEAU_COLS; col++) {
    const column = board.tableau[col];
    for (let i = 0; i < column.length; i++) {
      if (!column[i].faceUp) continue;
      for (const m of legalMovesFromTableau(board, col, i)) moves.push({ ...m, source: 'tableau' });
    }
  }
  if (board.stock.length > 0 || board.waste.length > 0) moves.push({ kind: 'draw', source: 'stock' });
  return moves;
}

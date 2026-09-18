// All screen-space geometry lives here, computed from `meta` so it stays correct if the
// virtual resolution ever changes. Card size follows the GDD's large-print minimum
// (132x180 virtual px) rather than shrinking to fit more columns — columns overlap
// horizontally instead, which is normal for a tableau fan.

export const CARD_W = 132;
export const CARD_H = 180;
const MARGIN = 6;
const TABLEAU_COLS = 7;
const TOP_SLOTS = 6; // stock, waste, foundation x4

export function computeLayout(meta) {
  const usableW = meta.width - MARGIN * 2;
  const topSpacing = (usableW - CARD_W) / (TOP_SLOTS - 1);
  const tabSpacing = (usableW - CARD_W) / (TABLEAU_COLS - 1);
  const topY = 40;
  const tableauTopY = topY + CARD_H + 40;
  const availableH = meta.height - tableauTopY - CARD_H - 20;

  const topX = (i) => MARGIN + i * topSpacing;
  const tableauX = (col) => MARGIN + col * tabSpacing;

  return {
    topY,
    tableauTopY,
    stockPos: { x: topX(0), y: topY },
    wastePos: { x: topX(1), y: topY },
    foundationPos: (i) => ({ x: topX(2 + i), y: topY }),
    tableauX,
    // Vertical offset between stacked cards in a column, shrunk if a very long column would
    // otherwise overflow the screen.
    columnOffset(count, faceUp) {
      const base = faceUp ? 48 : 34;
      if (count <= 1) return base;
      return Math.min(base, Math.max(18, availableH / count));
    },
    hitTestCard(x, y, cardX, cardY) {
      return x >= cardX && x <= cardX + CARD_W && y >= cardY && y <= cardY + CARD_H;
    },
  };
}

// Resolve a tap (virtual x/y) into a semantic target the game understands. Returns null when
// the tap didn't land on anything actionable.
export function hitTest(meta, layout, board, x, y) {
  // Stock
  if (layout.hitTestCard(x, y, layout.stockPos.x, layout.stockPos.y)) return { pile: 'stock' };
  // Waste
  if (board.waste.length > 0 && layout.hitTestCard(x, y, layout.wastePos.x, layout.wastePos.y)) {
    return { pile: 'waste' };
  }
  // Foundations
  for (let i = 0; i < 4; i++) {
    const pos = layout.foundationPos(i);
    if (layout.hitTestCard(x, y, pos.x, pos.y)) return { pile: 'foundation', index: i };
  }
  // Tableau — walk columns right-to-left visually isn't needed since columns don't overlap
  // vertically; within a column, prefer the topmost (last-drawn) card under the tap.
  for (let col = TABLEAU_COLS - 1; col >= 0; col--) {
    const column = board.tableau[col];
    const cx = layout.tableauX(col);
    if (x < cx || x > cx + CARD_W) continue;
    if (column.length === 0) {
      if (y >= layout.tableauTopY && y <= layout.tableauTopY + CARD_H) return { pile: 'tableau', col, index: -1 };
      continue;
    }
    const offset = layout.columnOffset(column.length, true);
    // Find the deepest card whose top edge is above the tap point (cards drawn top-to-bottom).
    let hitIndex = -1;
    for (let i = 0; i < column.length; i++) {
      const cardY = layout.tableauTopY + i * offset;
      if (y >= cardY) hitIndex = i;
    }
    if (hitIndex >= 0) return { pile: 'tableau', col, index: hitIndex };
  }
  return null;
}

// Card model shared by the deal generator, the rules engine and rendering.
// A card is a plain, JSON-serializable object: { suit, rank, faceUp }.
//   suit: 'S' | 'H' | 'D' | 'C'
//   rank: 1 (Ace) .. 13 (King)

export const SUITS = ['S', 'H', 'D', 'C'];

const RANK_NAMES = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

export function rankLabel(rank) {
  return RANK_NAMES[rank] || String(rank);
}

// Standard red/black. The four-colour deck option (GDD > Art direction) is applied only in
// rendering (see game.js THEME_PALETTES) — game rules always use this two-colour grouping,
// since "alternating colour" in Klondike is a two-way distinction regardless of palette.
export function suitColor(suit) {
  return suit === 'H' || suit === 'D' ? 'red' : 'black';
}

export function suitGlyph(suit) {
  return { S: '♠', H: '♥', D: '♦', C: '♣' }[suit];
}

export function freshDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ suit, rank, faceUp: false });
    }
  }
  return deck;
}

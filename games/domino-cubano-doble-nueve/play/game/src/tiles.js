// The double-nine domino set (55 tiles: every pair a<=b, 0..9) and dealing.
// Cuban partnership rules are block-style — no boneyard draw — so the 15 "asleep" tiles never
// re-enter play; they exist only so the deal is authentic (40 dealt + 15 asleep = 55).

export function buildDeck() {
  const deck = [];
  for (let a = 0; a <= 9; a++) {
    for (let b = a; b <= 9; b++) deck.push({ a, b });
  }
  return deck;
}

export function pipValue(tile) {
  return tile.a + tile.b;
}

export function isDouble(tile) {
  return tile.a === tile.b;
}

export function handPips(hand) {
  return hand.reduce((sum, t) => sum + pipValue(t), 0);
}

// Deals 10 tiles to each of 4 seats (0..3) and returns the 15 that stay asleep.
export function dealHands(rng) {
  const shuffled = rng.shuffle(buildDeck());
  const hands = [[], [], [], []];
  for (let seat = 0; seat < 4; seat++) {
    hands[seat] = shuffled.slice(seat * 10, seat * 10 + 10);
  }
  const asleep = shuffled.slice(40);
  return { hands, asleep };
}

// The opening seat holds the highest double (9-9 down to 0-0); if nobody was dealt a double
// (rare but possible with 15 tiles asleep), the highest-pip tile in any hand opens instead.
export function findOpener(hands) {
  let best = null;
  for (let seat = 0; seat < 4; seat++) {
    for (let i = 0; i < hands[seat].length; i++) {
      const tile = hands[seat][i];
      if (!isDouble(tile)) continue;
      if (!best || tile.a > best.tile.a) best = { seat, index: i, tile };
    }
  }
  if (best) return best;
  for (let seat = 0; seat < 4; seat++) {
    for (let i = 0; i < hands[seat].length; i++) {
      const tile = hands[seat][i];
      if (!best || pipValue(tile) > pipValue(best.tile)) best = { seat, index: i, tile };
    }
  }
  return best;
}

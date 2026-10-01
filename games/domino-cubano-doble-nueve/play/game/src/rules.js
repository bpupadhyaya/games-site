// Cuban block-partnership rules: match an open end or pass, no draw. See design/GDD.md.
import { pipValue, handPips } from './tiles.js';

export const TEAM = (seat) => (seat % 2 === 0 ? 'A' : 'B'); // seats 0+2 vs 1+3
export const PARTNER_OF = (seat) => (seat + 2) % 4;
export const OPPONENTS_OF = (seat) => [(seat + 1) % 4, (seat + 3) % 4];

// Every (tile, side) a hand may legally play against the current open ends. `ends` is
// { left, right } (a number each) or null before the opening tile is placed.
export function legalPlays(hand, ends) {
  if (!ends) return [];
  const plays = [];
  for (let i = 0; i < hand.length; i++) {
    const tile = hand[i];
    if (tile.a === ends.left || tile.b === ends.left) plays.push({ index: i, tile, side: 'left' });
    if (tile.a === ends.right || tile.b === ends.right) plays.push({ index: i, tile, side: 'right' });
  }
  return plays;
}

// Appends `tile` to `line` on `side`, returns the new { left, right } ends. The tile's face
// touching its neighbor and the face left exposed are recorded on the line entry for rendering.
export function placeTile(line, ends, tile, side, seat) {
  if (!ends) {
    const entry = { a: tile.a, b: tile.b, seat, leftFace: tile.a, rightFace: tile.b };
    line.push(entry);
    return { left: entry.leftFace, right: entry.rightFace };
  }
  if (side === 'left') {
    const outward = tile.a === ends.left ? tile.b : tile.a;
    line.unshift({ a: tile.a, b: tile.b, seat, leftFace: outward, rightFace: ends.left });
    return { left: outward, right: ends.right };
  }
  const outward = tile.a === ends.right ? tile.b : tile.a;
  line.push({ a: tile.a, b: tile.b, seat, leftFace: ends.right, rightFace: outward });
  return { left: ends.left, right: outward };
}

// Resolves a hand that just ended (either a seat emptied their hand, or every seat passed in a
// row). Returns { winningTeam, points } or { winningTeam: null, points: 0 } for a blocked push.
export function scoreHand({ hands, dominoSeat }) {
  if (dominoSeat != null) {
    const winners = TEAM(dominoSeat);
    const opponents = OPPONENTS_OF(dominoSeat);
    const points = opponents.reduce((sum, seat) => sum + handPips(hands[seat]), 0);
    return { winningTeam: winners, points, reason: 'domino' };
  }
  const pipsA = handPips(hands[0]) + handPips(hands[2]);
  const pipsB = handPips(hands[1]) + handPips(hands[3]);
  if (pipsA === pipsB) return { winningTeam: null, points: 0, reason: 'push' };
  return pipsA < pipsB
    ? { winningTeam: 'A', points: pipsB, reason: 'block' }
    : { winningTeam: 'B', points: pipsA, reason: 'block' };
}

export { pipValue, handPips };

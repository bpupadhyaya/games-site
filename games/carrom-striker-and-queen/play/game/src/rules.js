// The rule book ("home standard", documented in design/GDD.md). Pure functions over a JSON game `g`.
//   g.world   bodies (physics.js)      g.turn 'W'|'B'      g.queen: { state: 'board'|'pending'|'W'|'B', by }
//   g.owed    { W, B }  coins owed after a foul with none to give back
// A stroke is played by putting the striker in the world, stepping physics until still, then calling resolve().
import { S, R_COIN, POCKETS, BASE_Y, BASE_X0, BASE_X1, openingCoins, cloneWorld, settle, shotVelocity, blocked, striker } from './physics.js';

export const SIDE_NAME = { W: 'White', B: 'Black' };
export const other = (s) => (s === 'W' ? 'B' : 'W');
export const MAX_STROKES = 90;

export function newBoard(first = 'W') {
  return { world: openingCoins(), turn: first, queen: { state: 'board', by: null }, owed: { W: 0, B: 0 }, strokes: { W: 0, B: 0 }, over: null, note: '', out: [] };
}
export const cloneGame = (g) => ({ ...g, world: cloneWorld(g.world), queen: { ...g.queen }, owed: { ...g.owed }, strokes: { ...g.strokes }, over: g.over ? { ...g.over } : null });
export const onBoard = (g, k) => g.world.filter((b) => b.on && b.k === k).length;
export const down = (g, k) => g.world.filter((b) => !b.on && b.k === k).length;

// Put the striker on `side`'s baseline at x. Returns the striker body.
export function placeStriker(g, side, x) {
  g.world = g.world.filter((b) => b.k !== 'S');
  const b = { id: 99, k: 'S', x: Math.max(BASE_X0, Math.min(BASE_X1, x)), y: BASE_Y[side], vx: 0, vy: 0, on: true };
  g.world.push(b); return b;
}
// The nearest x on the baseline where the striker does not touch a coin (or the wanted x if none is free).
export function clearX(g, side, x) {
  const ok = (v) => !blocked(g.world, v, BASE_Y[side]);
  x = Math.max(BASE_X0, Math.min(BASE_X1, x)); if (ok(x)) return x;
  for (let d = 4; d < 560; d += 4) { if (x + d <= BASE_X1 && ok(x + d)) return x + d; if (x - d >= BASE_X0 && ok(x - d)) return x - d; }
  return x;
}

// Strike: give the striker a velocity.
export function flick(g, angle, power) {
  const s = striker(g.world), v = shotVelocity(angle, power); s.vx = v.vx; s.vy = v.vy;
}

// Where a returned coin goes: the centre, or the nearest free spot spiralling out from it.
function returnCoin(g, b) {
  const free = (x, y) => !g.world.some((o) => o !== b && o.on && Math.hypot(o.x - x, o.y - y) < 2 * R_COIN + 1);
  b.on = true; b.vx = b.vy = 0; delete b.pk;
  for (let r = 0; r < 320; r += 8) for (let a = 0; a < 12; a++) { const x = S / 2 + Math.cos(a * 0.5236) * r, y = S / 2 + Math.sin(a * 0.5236) * r; if (free(x, y)) { b.x = x; b.y = y; return; } }
  b.x = S / 2; b.y = S / 2;
}

// After the striker has come to rest: apply the rules. `events` are the physics events of this stroke.
// Returns a summary { own, opp, queen, foul, again, notes[] } and updates g (turn, queen, coins returned, over).
export function resolve(g, events) {
  const me = g.turn, opp = other(me), notes = [], sum = { own: 0, opp: 0, queen: false, foul: false, again: false, notes };
  const pk = events.filter((e) => e.t === 'pocket');
  const foul = pk.some((e) => e.k === 'S'); sum.foul = foul;
  const coins = pk.filter((e) => e.k !== 'S').map((e) => g.world.find((b) => b.id === e.id));
  g.strokes[me] += 1;
  g.out = pk.map((e) => ({ k: e.k, p: e.p, x: e.x, y: e.y }));
  const ownC = coins.filter((c) => c.k === me), oppC = coins.filter((c) => c.k === opp), qC = coins.find((c) => c.k === 'Q');
  sum.opp = oppC.length; sum.queen = !!qC;
  const wasPending = g.queen.state === 'pending' && g.queen.by === me;

  if (foul) {
    notes.push('Foul: the striker was pocketed.');
    if (qC) { returnCoin(g, qC); notes.push('The queen goes back to the centre.'); }
    const mineDown = g.world.filter((b) => !b.on && b.k === me);
    if (mineDown.length) { returnCoin(g, mineDown[mineDown.length - 1]); notes.push(`${SIDE_NAME[me]} gets one coin put back in the centre.`); }
    else { g.owed[me] += 1; notes.push(`${SIDE_NAME[me]} owes a coin: the next one pocketed goes back.`); }
    if (wasPending) { const q = g.world.find((b) => b.k === 'Q'); if (!q.on) returnCoin(g, q); g.queen = { state: 'board', by: null }; notes.push('The queen was not covered and goes back to the centre.'); }
    sum.again = false;
  } else {
    let kept = 0;
    for (const c of ownC) { if (g.owed[me] > 0) { g.owed[me] -= 1; returnCoin(g, c); notes.push('That coin pays a foul and goes back to the centre.'); } else kept += 1; }
    sum.own = kept;
    if (qC) {
      if (kept > 0) { g.queen = { state: me, by: me }; notes.push('Queen pocketed and covered.'); }
      else { g.queen = { state: 'pending', by: me }; notes.push('Queen pocketed. Cover it: pocket one of your coins with your next stroke.'); }
    } else if (wasPending) {
      if (kept > 0) { g.queen = { state: me, by: me }; notes.push('Queen covered.'); }
      else { const q = g.world.find((b) => b.k === 'Q'); returnCoin(g, q); g.queen = { state: 'board', by: null }; notes.push('The queen was not covered and goes back to the centre.'); }
    }
    if (oppC.length) notes.push(`${oppC.length === 1 ? 'An opponent coin was' : oppC.length + ' opponent coins were'} pocketed: it counts for ${SIDE_NAME[opp]}.`);
    sum.again = kept > 0 || (g.queen.state === 'pending' && g.queen.by === me);
  }
  // A side may not clear its last coin while the queen is still on the board.
  if (!g.free) for (const side of ['W', 'B']) {
    if (onBoard(g, side) === 0 && g.queen.state === 'board') {
      const last = g.world.filter((b) => !b.on && b.k === side).pop();
      if (last) { returnCoin(g, last); notes.push('The last coin cannot go before the queen: it returns to the centre.'); if (side === me && !foul) { sum.own = Math.max(0, sum.own - 1); sum.again = sum.own > 0; } }
    }
  }
  g.world = g.world.filter((b) => b.k !== 'S');
  // Board finished?
  let winner = null, reason = 'cleared';
  if (!g.free) for (const side of [me, opp]) if (!winner && onBoard(g, side) === 0 && g.queen.state !== 'board' && g.queen.state !== 'pending') winner = side;
  if (!g.free && !winner && g.strokes.W >= MAX_STROKES && g.strokes.B >= MAX_STROKES) { const w = down(g, 'W'), b = down(g, 'B'); winner = w === b ? 'draw' : w > b ? 'W' : 'B'; reason = 'stalled'; }
  if (winner) {
    const pts = winner === 'draw' ? 0 : onBoard(g, other(winner)) + (g.queen.state === winner ? 3 : 0);
    g.over = { winner, points: pts, reason }; sum.again = false;
  }
  g.turn = sum.again ? me : opp;
  g.note = notes.join(' ');
  sum.notes = notes;
  return sum;
}

// Play a stroke completely (no animation): used by the computer's look-ahead and by tests. Mutates g.
export function playStroke(g, x, angle, power) {
  placeStriker(g, g.turn, x); flick(g, angle, power);
  const ev = []; const ticks = settle(g.world, ev);
  return { ...resolve(g, ev), ticks, events: ev };
}

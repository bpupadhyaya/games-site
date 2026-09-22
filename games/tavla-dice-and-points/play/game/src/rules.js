// THE RULE BOOK for Tavla (backgammon). Pure and deterministic; nothing here draws or rolls dice.
//
// Points are indexed 0..23 (index = point number - 1). Side 0 is the player at the bottom: it starts with
// 2 checkers on point 24, 5 on 13, 3 on 8, 5 on 6, and moves DOWN toward point 1; its home is points 1-6.
// Side 1 (the opponent) is the mirror image: it moves UP toward point 24; its home is points 19-24.
// board[i] > 0 = that many side-0 checkers, < 0 = side-1 checkers. bar[side] = checkers waiting to enter.
// off[side] = checkers borne off. A step is { from, to, die, hit } with from = BAR when entering and
// to = OFF when bearing off.
//
// A "turn" is the set of steps made with one roll. The rules that make it tricky are all in legalSteps():
// you must play as many dice as you can, and when only one die can be played you must play the larger.
export const BAR = 24, OFF = 25;
export const RULESETS = { standard: { name: 'Standard', blurb: 'Standard rules' } };

export function newGame() {
  const board = new Array(24).fill(0);
  const put = (pt, n, side) => { board[pt - 1] += side === 0 ? n : -n; };
  put(24, 2, 0); put(13, 5, 0); put(8, 3, 0); put(6, 5, 0);
  put(1, 2, 1); put(12, 5, 1); put(17, 3, 1); put(19, 5, 1);
  return { board, bar: [0, 0], off: [0, 0], turn: 0, moves: 0 };
}
export const clone = (s) => ({ ...s, board: s.board.slice(), bar: s.bar.slice(), off: s.off.slice() });
export const key = (s) => s.board.join(',') + '|' + s.bar.join(',') + '|' + s.off.join(',');
export const dirOf = (side) => (side === 0 ? -1 : 1);
export const own = (s, side, i) => (side === 0 ? s.board[i] : -s.board[i]);       // my checkers on i (negative = opponent's)
// distance from off (1 = on the last point before bearing off)
export const distOf = (side, i) => (side === 0 ? i + 1 : 24 - i);
export const entryIdx = (side, die) => (side === 0 ? 24 - die : die - 1);
export const pips = (s, side) => { let p = s.bar[side] * 25; for (let i = 0; i < 24; i++) { const n = own(s, side, i); if (n > 0) p += n * distOf(side, i); } return p; };
export const allHome = (s, side) => {
  if (s.bar[side] > 0) return false;
  for (let i = 0; i < 24; i++) if (own(s, side, i) > 0 && distOf(side, i) > 6) return false;
  return true;
};
export const isOver = (s) => s.off[0] === 15 || s.off[1] === 15;
export function winner(s) { return s.off[0] === 15 ? 0 : s.off[1] === 15 ? 1 : -1; }
// 1 = single game, 2 = gammon (loser has borne off nothing), 3 = backgammon (and still has a checker on the bar or in the winner's home)
export function resultValue(s, w, gammons = true) {
  if (!gammons) return 1;
  const l = 1 - w;
  if (s.off[l] > 0) return 1;
  let back = s.bar[l] > 0;
  for (let i = 0; i < 24 && !back; i++) if (own(s, l, i) > 0 && distOf(w, i) >= 19) back = true;
  return back ? 3 : 2;
}

// every single-die step available right now (ignoring the "use both dice" rule)
export function stepsFor(s, side, die) {
  const out = [], dir = dirOf(side);
  if (s.bar[side] > 0) {
    const to = entryIdx(side, die), n = own(s, side, to);
    if (n >= -1) out.push({ from: BAR, to, die, hit: n === -1 });
    return out;
  }
  const home = allHome(s, side);
  for (let i = 0; i < 24; i++) {
    if (own(s, side, i) <= 0) continue;
    const t = i + dir * die;
    if (t >= 0 && t <= 23) { const n = own(s, side, t); if (n >= -1) out.push({ from: i, to: t, die, hit: n === -1 }); }
    else if (home) {
      const d = distOf(side, i);
      if (d === die) out.push({ from: i, to: OFF, die, hit: false });
      else if (die > d) {                                   // a bigger die may bear off from the highest point only
        let higher = false;
        for (let j = 0; j < 24 && !higher; j++) if (own(s, side, j) > 0 && distOf(side, j) > d) higher = true;
        if (!higher) out.push({ from: i, to: OFF, die, hit: false });
      }
    }
  }
  return out;
}
export function applyStep(s, side, st) {
  if (st.from === BAR) s.bar[side] -= 1; else s.board[st.from] -= side === 0 ? 1 : -1;
  if (st.to === OFF) s.off[side] += 1;
  else {
    if (st.hit) { s.board[st.to] = 0; s.bar[1 - side] += 1; }
    s.board[st.to] += side === 0 ? 1 : -1;
  }
  return s;
}
const without = (dice, d) => { const k = dice.indexOf(d); return dice.slice(0, k).concat(dice.slice(k + 1)); };

// the most dice that can be played from here (the "use as many dice as you can" rule)
export function maxPlay(s, side, dice, memo = new Map()) {
  if (!dice.length) return 0;
  const k = key(s) + '#' + side + dice.join('');
  const c = memo.get(k); if (c !== undefined) return c;
  let best = 0;
  for (const d of new Set(dice)) {
    const rest = without(dice, d);
    for (const st of stepsFor(s, side, d)) {
      const n = 1 + maxPlay(applyStep(clone(s), side, st), side, rest, memo);
      if (n > best) best = n;
      if (best === dice.length) { memo.set(k, best); return best; }
    }
  }
  memo.set(k, best); return best;
}

// A roll made into a turn: { dice (remaining), total (most dice playable), used, mustHigh }.
export const expandRoll = (r) => (r[0] === r[1] ? [r[0], r[0], r[0], r[0]] : r.slice());
export function beginTurn(s, side, dice) {                     // `dice` is the literal list of dice still to play (see expandRoll)
  dice = dice.slice();
  const roll = dice;
  const memo = new Map(), total = maxPlay(s, side, dice, memo);
  let mustHigh = 0;
  if (total === 1 && roll.length === 2 && roll[0] !== roll[1]) { const hi = Math.max(...roll); if (stepsFor(s, side, hi).length) mustHigh = hi; }
  return { dice, total, used: 0, mustHigh, memo };
}
// The steps that keep the turn legal (may start a full-length sequence).
export function legalSteps(s, side, turn) {
  const out = [];
  if (!turn.dice.length) return out;
  for (const d of new Set(turn.dice)) {
    if (turn.mustHigh && d !== turn.mustHigh) continue;
    const rest = without(turn.dice, d);
    for (const st of stepsFor(s, side, d)) {
      if (turn.used + 1 + maxPlay(applyStep(clone(s), side, st), side, rest, turn.memo) === turn.total) out.push(st);
    }
  }
  return out;
}
export function playStep(s, side, turn, st) {
  applyStep(s, side, st);
  turn.dice = without(turn.dice, st.die); turn.used += 1;
  s.moves += 1;
}
export const turnCopy = (t) => ({ dice: t.dice.slice(), total: t.total, used: t.used, mustHigh: t.mustHigh, memo: t.memo });

// Every distinct way to finish the turn (for the computer and for puzzles): [{ steps, after }]
export function allTurns(s, side, dice, limit = 4000) {
  const t0 = beginTurn(s, side, dice), seen = new Set(), out = [], done = new Set();
  const go = (st, turn, steps) => {
    if (out.length >= limit) return;
    const ls = legalSteps(st, side, turn);
    if (!ls.length) { const k = key(st); if (!done.has(k)) { done.add(k); out.push({ steps, after: st }); } return; }
    const vk = key(st) + '#' + turn.dice.join('');
    if (seen.has(vk)) return; seen.add(vk);
    for (const step of ls) { const n = clone(st), tt = turnCopy(turn); playStep(n, side, tt, step); go(n, tt, steps.concat([step])); }
  };
  go(clone(s), t0, []);
  return out;
}

// Plain-language reason a player's attempted move (from -> to) is not allowed.
export function whyNot(s, side, turn, from, to) {
  const pt = (i) => i + 1;
  if (!turn.dice.length) return 'You have no dice left to play.';
  if (s.bar[side] > 0 && from !== BAR) return 'A checker of yours is on the bar. It must enter the board before anything else moves.';
  if (from === BAR && to === OFF) return 'Bar checkers must enter the board first.';
  const dir = dirOf(side);
  if (to === OFF) {
    if (!allHome(s, side)) return 'You can bear off only when all 15 of your checkers are in your home board (points 1 to 6).';
    const d = distOf(side, from);
    if (!turn.dice.some((x) => x >= d)) return `Bearing off from point ${pt(from)} needs a ${d} or more. Your dice: ${turn.dice.join(' and ')}.`;
    return 'A bigger die may bear off only from your highest point. Play the checker on the highest point first.';
  }
  if (from !== BAR && own(s, side, from) <= 0) return 'There is no checker of yours on that point.';
  const dist = from === BAR ? (side === 0 ? 25 - (to + 1) : to + 1) : (to - from) * dir;
  if (from !== BAR && dist <= 0) return 'Checkers only move forward, toward your home board. Move the other way.';
  const legalMax = legalSteps(s, side, turn);
  if (turn.dice.includes(dist) || turn.dice.length) {
    const blocked = own(s, side, to) <= -2;
    if (blocked && (turn.dice.includes(dist) || dist <= Math.max(...turn.dice) * turn.dice.length)) return `Point ${pt(to)} is held by two or more opposing checkers. A held point is blocked: you cannot land there.`;
  }
  if (!turn.dice.includes(dist)) {
    const sum = turn.dice.length > 1 ? `Your dice are ${turn.dice.join(' and ')}. ` : `Your die is ${turn.dice[0]}. `;
    return `That point is ${dist} away. ${sum}A checker moves exactly the number on a die.`;
  }
  if (legalMax.length && !legalMax.some((x) => x.die === dist)) {
    if (turn.mustHigh) return `You may play only one die this turn and it must be the larger: the ${turn.mustHigh}.`;
    return 'You must play as many dice as you can. That move would leave the other die with no legal play.';
  }
  return 'That move is not allowed.';
}

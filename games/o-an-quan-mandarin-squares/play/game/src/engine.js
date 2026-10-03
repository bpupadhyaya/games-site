// Pure rules of O An Quan (Vietnamese mancala). Twelve squares in a ring: 0 and 6 are the two mandarin squares,
// 1..5 are player 1's small squares (bottom row, left to right), 7..11 are player 2's (top row, right to left).
// Sowing steps +1 or -1 around the ring. No randomness, no clock: same input, same result.
export const N = 12;
export const MAND = [0, 6];
export const SIDE = { 1: [1, 2, 3, 4, 5], 2: [7, 8, 9, 10, 11] };
export const START_DAN = 5;
export const MAX_PLIES = 240;
const MAX_LAPS = 120;

export const isMand = (i) => i === 0 || i === 6;
export const mandIdx = (i) => (i === 0 ? 0 : 1);
export const ownerOf = (i) => (i >= 1 && i <= 5 ? 1 : i >= 7 && i <= 11 ? 2 : 0);
export const other = (p) => 3 - p;

export const YOUNG_MIN = 5;
export function startState(qv = 10, young = true) {
  const cells = Array(N).fill(START_DAN);
  cells[0] = 0; cells[6] = 0;
  return { cells, q: [1, 1], pd: [0, 0], pq: [0, 0], mc: [0, 0], turn: 1, qv, young, plies: 0, over: null };
}
export const cloneState = (s) => ({ cells: s.cells.slice(), q: s.q.slice(), pd: s.pd.slice(), pq: s.pq.slice(), mc: s.mc.slice(), turn: s.turn, qv: s.qv, young: s.young, plies: s.plies, over: s.over });

export const scoreOf = (s, p) => s.pd[p - 1] + s.qv * s.pq[p - 1];
export const sideCount = (s, p) => SIDE[p].reduce((a, i) => a + s.cells[i], 0);

export function legalMoves(s) {
  if (s.over) return [];
  const out = [];
  for (const i of SIDE[s.turn]) if (s.cells[i] > 0) { out.push({ cell: i, dir: 1 }); out.push({ cell: i, dir: -1 }); }
  return out;
}
export const sameMove = (a, b) => a && b && a.cell === b.cell && a.dir === b.dir;

// Plays one whole turn. Returns { st, ev }. ev (when `log` is true) is the ordered list of things that happen, for the animation:
//   pick {cell,n}  drop {cell,left}  capture {cell,dan,quan,who}  borrow {who,dan}  end {...}
export function play(st, mv, log = false) {
  const s = cloneState(st);
  const ev = log ? [] : null;
  const p = s.turn;
  let pos = mv.cell, n = s.cells[pos];
  const dir = mv.dir;
  s.cells[pos] = 0;
  if (ev) ev.push({ t: 'pick', cell: pos, n, who: p });
  let laps = 0, ended = false;
  outer: for (;;) {
    while (n > 0) {
      pos = (pos + dir + N) % N; s.cells[pos]++; n--;
      if (ev) ev.push({ t: 'drop', cell: pos, left: n });
    }
    let next = (pos + dir + N) % N;
    if (isMand(next)) break;
    if (s.cells[next] > 0) {
      if (++laps > MAX_LAPS) break;
      pos = next; n = s.cells[pos]; s.cells[pos] = 0;
      if (ev) ev.push({ t: 'pick', cell: pos, n, who: p });
      continue;
    }
    for (;;) {
      const tgt = (next + dir + N) % N;
      const hasQ = isMand(tgt) && s.q[mandIdx(tgt)] === 1;
      if (s.cells[tgt] === 0 && !hasQ) break outer;
      if (hasQ && s.young && s.cells[tgt] < YOUNG_MIN) break outer; // a young mandarin is protected
      const dan = s.cells[tgt];
      s.cells[tgt] = 0; s.pd[p - 1] += dan;
      if (hasQ) { s.q[mandIdx(tgt)] = 0; s.pq[p - 1] += 1; s.mc[mandIdx(tgt)] = p; }
      if (ev) ev.push({ t: 'capture', cell: tgt, dan, quan: hasQ ? 1 : 0, who: p });
      if (s.q[0] === 0 && s.q[1] === 0) { ended = true; break outer; }
      pos = tgt; next = (pos + dir + N) % N;
      if (isMand(next) || s.cells[next] > 0) break outer;
    }
  }
  s.plies += 1;
  if (!ended && s.plies >= MAX_PLIES) ended = true;
  if (ended) finish(s, ev);
  else {
    s.turn = other(p);
    refill(s, ev);
  }
  return { st: s, ev };
}

// A player with no stones on their side pays five dan from their winnings to put one back in each square.
// Winnings below five are borrowed from the opponent (the pile goes negative: the debt is repaid in the final count).
function refill(s, ev) {
  const p = s.turn;
  if (sideCount(s, p) > 0) return;
  s.pd[p - 1] -= 5;
  for (const i of SIDE[p]) s.cells[i] = 1;
  if (ev) ev.push({ t: 'borrow', who: p, debt: s.pd[p - 1] < 0 ? -s.pd[p - 1] : 0 });
}

// The end: stones on a side go to that side's owner; stones in a captured mandarin square go to whoever took its mandarin.
function finish(s, ev) {
  const gain = [0, 0];
  for (const p of [1, 2]) for (const i of SIDE[p]) { gain[p - 1] += s.cells[i]; s.cells[i] = 0; }
  for (const i of MAND) {
    const m = s.mc[mandIdx(i)];
    if (m && s.q[mandIdx(i)] === 0) { gain[m - 1] += s.cells[i]; s.cells[i] = 0; }
  }
  s.pd[0] += gain[0]; s.pd[1] += gain[1];
  const a = scoreOf(s, 1), b = scoreOf(s, 2);
  s.over = { winner: a > b ? 1 : b > a ? 2 : 0, a, b, capped: !(s.q[0] === 0 && s.q[1] === 0) };
  if (ev) ev.push({ t: 'end', over: s.over, gain });
}

export const keyOf = (s) => `${s.cells.join(',')}|${s.q.join('')}|${s.turn}|${s.pd.join(',')}|${s.pq.join('')}`;

// Plain facts about what one move does (used by the hint and by the lessons): score gained, mandarins taken, stones sown.
export function outcome(st, mv) {
  const me = st.turn, { st: after, ev } = play(st, mv, true);
  let dan = 0, quan = 0, sown = 0, caps = 0;
  for (const e of ev) { if (e.t === 'capture') { dan += e.dan; quan += e.quan; caps++; } else if (e.t === 'drop') sown++; }
  const gain = scoreOf(after, me) - scoreOf(st, me);
  return { after, ev, gain, dan, quan, caps, sown, borrowed: ev.some((e) => e.t === 'borrow') };
}

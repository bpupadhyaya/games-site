// Bao la Kiswahili: the rule book. Pure and deterministic (no clock, no randomness, no DOM).
//
// Each player owns a ring of 16 pits. Ring index 0..7 is the FRONT (inner) row from the owner's left to right;
// ring index 8..15 is the BACK (outer) row run right to left, so ring step +1 is one continuous loop:
//   front left -> front right -> back right -> back left -> front left ...
// A front pit r faces the opponent's front pit 7 - r. The nyumba (house) is front pit 4 (the 5th from the left).
// The kichwa are front pits 0 and 7; the kimbi are front pits 0, 1, 6, 7.
//
// A move descriptor is { r, d, ch }:
//   r  = ring index of the pit the player picks (namua: the front pit that receives the seed from the store)
//   d  = sowing direction, +1 or -1 (unused for a namua capture: the end the captured seeds start from is a choice)
//   ch = answers to choices raised part-way through the move, in order: 'kichwa' -> +1 (left end) / -1 (right end),
//        'safari' -> true (keep sowing from the nyumba) / false (stop).
// `simulate` plays a move; when it needs an answer that `ch` does not yet hold it returns `pending` so a human can be asked.
export const N = 16, FRONT = 8, NYUMBA = 4, STOCK0 = 22, MOVE_LIMIT = 400;
const GUARD = 800;

export const colOf = (r) => (r < FRONT ? r : 15 - r);   // screen column (0..7, owner's left to right) of ring index r
export const rowIsFront = (r) => r < FRONT;
export const facing = (r) => 7 - r;

export function newGame() {
  const mk = () => { const a = new Array(N).fill(0); a[NYUMBA] = 6; a[NYUMBA + 1] = 2; a[NYUMBA + 2] = 2; return a; };
  return { pits: [mk(), mk()], stock: [STOCK0, STOCK0], house: [true, true], turn: 0, winner: null, reason: '', moves: 0, kut: null };
}
export const clone = (g) => ({
  pits: [g.pits[0].slice(), g.pits[1].slice()], stock: g.stock.slice(), house: g.house.slice(), turn: g.turn,
  winner: g.winner, reason: g.reason, moves: g.moves, kut: g.kut ? { p: g.kut.p, ring: g.kut.ring } : null,
});
export const sum = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
export const frontSum = (a) => a[0] + a[1] + a[2] + a[3] + a[4] + a[5] + a[6] + a[7];
export const inNamua = (g, p = g.turn) => g.stock[p] > 0;
export const isHouse = (g, p, r = NYUMBA) => r === NYUMBA && g.house[p];
export const isMarker = (g, p, r) => r < FRONT && g.pits[p][r] > 0 && g.pits[1 - p][7 - r] > 0;

// Does a mtaji start (pit r, direction d) begin a capturing turn? The last seed of the first sowing must land in an
// occupied front pit whose opposite pit is occupied. A pit of 16 or more seeds laps the ring and never captures.
function startCaptures(g, p, r, d) {
  const me = g.pits[p], n = me[r];
  if (n > 15) return false;
  const last = (((r + d * n) % N) + N) % N;
  return last < FRONT && me[last] > 0 && g.pits[1 - p][7 - last] > 0;
}

// Kutakatia: after a non-capturing move that leaves the mover with exactly one capture threat, the opponent's threatened
// pit may not be emptied on the reply (unless it is their house, their only front pit, or their only front pit of 2+).
export function kutActive(g) {
  const k = g.kut, p = g.turn;
  if (!k || k.p !== p || g.stock[p] > 0 || g.stock[1 - p] > 0) return false;
  const me = g.pits[p];
  if (isHouse(g, p, k.ring)) return false;
  let occ = 0, two = 0;
  for (let r = 0; r < FRONT; r++) { if (me[r] > 0) occ++; if (me[r] >= 2) two++; }
  if (occ <= 1) return false;
  if (two === 1 && me[k.ring] >= 2) return false;
  return true;
}

// Base descriptors for the player to move (no `ch` yet). Empty means the player cannot move and loses.
export function legalMoves(g) {
  const p = g.turn, me = g.pits[p], out = [];
  if (g.stock[p] > 0) {
    const marks = [];
    for (let r = 0; r < FRONT; r++) if (isMarker(g, p, r)) marks.push(r);
    if (marks.length) return marks.map((r) => ({ r, d: 0 }));
    let occ = 0; for (let r = 0; r < FRONT; r++) if (me[r] > 0) occ++;
    for (let r = 0; r < FRONT; r++) {
      if (me[r] === 0) continue;
      if (isHouse(g, p, r) && occ > 1) continue;
      out.push({ r, d: 1 }, { r, d: -1 });
    }
    return out;
  }
  const lock = kutActive(g) ? g.kut.ring : -1;
  let cand = [];
  for (let r = 0; r < N; r++) {
    if (me[r] < 2) continue;
    for (const d of [1, -1]) cand.push({ r, d, cap: startCaptures(g, p, r, d) });
  }
  if (lock >= 0) { const f = cand.filter((c) => c.r !== lock); if (f.length) cand = f; }
  const caps = cand.filter((c) => c.cap);
  if (caps.length) return caps.map((c) => ({ r: c.r, d: c.d }));
  let tk = cand.filter((c) => c.r < FRONT && !isHouse(g, p, c.r));
  if (!tk.length) tk = cand.filter((c) => c.r >= FRONT);
  if (!tk.length) tk = cand.filter((c) => isHouse(g, p, c.r));
  return tk.map((c) => ({ r: c.r, d: c.d }));
}

const evt = (a, e) => { if (a) a.push(e); };

// Play one move on a copy. Returns { g, events, pending, gain, kind, caps }.
//  events: place / lift / cap / drop / note, enough for the view to replay the move seed by seed
//  pending: { type, options } when `mv.ch` runs out; g is then partial and must not be used
export function simulate(g0, mv, wantEvents = true) {
  const g = clone(g0), p = g.turn, o = 1 - p, me = g.pits[p], op = g.pits[o], ev = wantEvents ? [] : null;
  const ch = mv.ch || [];
  let ci = 0, gain = 0, caps = 0, first = true, steps = 0, kind = 'takata', capturing = false;
  const lock = kutActive(g0) ? g0.kut.ring : -1;
  let hand = 0, pos = 0, dir = mv.d;
  const need = (type, options) => {
    if (ci < ch.length) return ch[ci++];
    return undefined;
  };
  const pend = (type, options) => ({ g, events: ev, pending: { type, options }, gain, kind, caps });

  const takeCapture = (r) => {                 // r = my front pit that made the capture; returns false when an answer is missing
    const rr = 7 - r, n = op[rr];
    op[rr] = 0; if (rr === NYUMBA) g.house[o] = false;
    gain += n; caps++;
    evt(ev, { k: 'cap', p: o, r: rr, n, by: p });
    let d;
    if (r <= 1) d = 1; else if (r >= 6) d = -1;
    else if (first) { d = need('kichwa'); if (d === undefined) return false; }
    else d = dir;
    first = false;
    hand = n; dir = d; pos = (d > 0 ? 0 : 7) - d;
    return true;
  };

  if (g.stock[p] > 0) {
    const r = mv.r, occupied = me[r] > 0;
    g.stock[p]--; me[r]++; evt(ev, { k: 'place', p, r });
    if (occupied && op[7 - r] > 0) {
      kind = 'namua-capture'; capturing = true;
      if (!takeCapture(r)) return pend('kichwa', [1, -1]);
    } else {
      let n = me[r];
      if (r === NYUMBA && g.house[p]) { n = 2; me[r] -= 2; } else { me[r] = 0; if (r === NYUMBA) g.house[p] = false; }
      evt(ev, { k: 'lift', p, r, n });
      hand = n; pos = r; dir = mv.d;
    }
  } else {
    const r = mv.r;
    capturing = startCaptures(g, p, r, mv.d); kind = capturing ? 'capture' : 'takata';
    hand = me[r]; me[r] = 0; if (r === NYUMBA) g.house[p] = false;
    evt(ev, { k: 'lift', p, r, n: hand });
    pos = r; dir = mv.d;
  }

  for (;;) {
    if (++steps > GUARD) break;
    let before = 0;
    for (let i = 0; i < hand; i++) { pos = (pos + dir + N) % N; before = me[pos]; me[pos]++; evt(ev, { k: 'drop', p, r: pos }); }
    hand = 0;
    if (before === 0) break;
    if (capturing && pos < FRONT && op[7 - pos] > 0) { if (!takeCapture(pos)) return pend('kichwa', [1, -1]); continue; }
    if (pos === lock) { evt(ev, { k: 'note', t: 'kut', p, r: pos }); break; }
    if (pos === NYUMBA && g.house[p]) {
      if (!capturing) { evt(ev, { k: 'note', t: 'house-stop', p, r: pos }); break; }
      const c = need('safari');
      if (c === undefined) return pend('safari', [true, false]);
      if (!c) { evt(ev, { k: 'note', t: 'house-stay', p, r: pos }); break; }
      g.house[p] = false; evt(ev, { k: 'note', t: 'safari', p, r: pos });
    }
    hand = me[pos]; me[pos] = 0; evt(ev, { k: 'lift', p, r: pos, n: hand });
  }

  g.moves++;
  g.kut = null;
  if (kind === 'takata' && g.stock[p] === 0 && g.stock[o] === 0) {
    let n = 0, at = -1;
    for (let r = 0; r < FRONT; r++) if (me[r] > 0 && op[7 - r] > 0) { n++; at = r; }
    if (n === 1) g.kut = { p: o, ring: 7 - at };
  }
  g.turn = o;
  if (frontSum(me) === 0) { g.winner = o; g.reason = 'Their front row was left empty.'; }
  else if (frontSum(op) === 0) { g.winner = p; g.reason = 'The opponent’s front row is empty.'; }
  else if (g.moves >= MOVE_LIMIT) {
    const a = sum(g.pits[0]) + g.stock[0], b = sum(g.pits[1]) + g.stock[1];
    g.winner = a === b ? 'draw' : a > b ? 0 : 1; g.reason = 'Move limit reached: the side with more seeds wins.';
  }
  else if (legalMoves(g).length === 0) { g.winner = p; g.reason = 'The opponent cannot move: no pit holds two or more seeds.'; }
  return { g, events: ev, pending: null, gain, kind, caps };
}

// Every complete move (all choices resolved) with its resulting position. Used by the computer and the hint.
export function fullMoves(g, wantEvents = false) {
  const out = [];
  const walk = (mv) => {
    const r = simulate(g, mv, wantEvents);
    if (r.pending) { for (const o of r.pending.options) walk({ r: mv.r, d: mv.d, ch: [...(mv.ch || []), o] }); }
    else out.push({ mv, g: r.g, gain: r.gain, kind: r.kind, caps: r.caps, events: r.events });
  };
  for (const m of legalMoves(g)) walk({ r: m.r, d: m.d, ch: [] });
  return out;
}

// Apply a complete move to g in place (the game scene commits a finished animation this way).
export function commit(g, mv) {
  const r = simulate(g, mv, false);
  if (r.pending) throw new Error('commit: move has unanswered choices');
  Object.assign(g, r.g);
  return r;
}

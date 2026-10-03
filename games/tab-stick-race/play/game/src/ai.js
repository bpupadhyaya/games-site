// The computer opponents and the analysis behind Think. Everything here is deterministic given the rng it is handed.
//
// The position value is a plain expected-value estimate: how far each side has got, minus the chance (computed exactly from the
// throw odds in rules.js) that the opponent can land on each of my pieces on its next turn, times what that piece would lose.
import { N, HOME, WAIT, other, sqOf, isSafe, legalMoves, applyMove, applyThrow, hitChance, keyOf, homeCount } from './rules.js';

export const LEVELS = [
  { id: 'beginner', name: 'Beginner', ar: 'مبتدئ', blurb: 'Plays any legal move. Easy to beat, and a good way to learn.' },
  { id: 'casual', name: 'Casual', ar: 'عادي', blurb: 'Likes captures and getting pieces on, but ignores danger and sometimes slips.' },
  { id: 'skilled', name: 'Skilled', ar: 'ماهر', blurb: 'Weighs the chance of being hit before every move.' },
  { id: 'expert', name: 'Expert', ar: 'خبير', blurb: 'Plans the order of all the throws of a turn, and avoids exposed squares.' },
  { id: 'master', name: 'Master', ar: 'أستاذ', blurb: 'Plays every turn the best way it can find, and prizes star squares and getting stones on.' },
];
export const levelById = (id) => LEVELS.find((l) => l.id === id) ?? LEVELS[2];

// Worth of a piece: waiting is nothing; entering is worth a little extra (it costs a one), then one point per square; home is the most.
export const P = { enter: 3, home: 2, mine: 1, theirs: 0.2, theirsMid: 0.5, mineMid: 0.55, safe: 3, curve: 0, leadK: 0, waitPen: 6 };
// per-level tuning found by self-play (see STATUS.md): the weaker levels do not value star squares or getting stones onto the board;
// Master does (a star bonus of 3 and a waiting-stone penalty of 6 won 60 percent of 800 games against the same search without them)
const LEVEL_P = { skilled: { safe: 0, waitPen: 0 }, expert: { safe: 0, waitPen: 0 }, master: { safe: 3, waitPen: 6 } };
const withLevel = (id, fn) => {
  if (P.fixed || !(id in LEVEL_P)) return fn();
  const keep = { safe: P.safe, waitPen: P.waitPen };
  Object.assign(P, LEVEL_P[id]);
  try { return fn(); } finally { Object.assign(P, keep); }
};
export const worth = (pos) => (pos === WAIT ? 0 : pos === HOME ? P.enter + N + P.home : P.enter + pos + P.curve * pos * pos / N);

// Chance side q can land on square sq next turn (cached per position).
function risk(st, q, sq, cache) {
  const k = q * 32 + sq;
  let v = cache[k];
  if (v === undefined) { v = hitChance(st, q, sq); cache[k] = v; }
  return v;
}

// Value of a position for side p. `risky` pieces are the ones the other side could hit; mine count in full, theirs at a discount
// (they will move first).
export function evaluate(st, p, o = {}) {
  const e = other(p), cache = {};
  let v = 0;
  for (const x of st.pos[p]) v += worth(x) - (x === WAIT ? P.waitPen : 0);
  for (const x of st.pos[e]) v -= worth(x) - (x === WAIT ? P.waitPen : 0);
  const lead = P.leadK ? Math.max(-1, Math.min(1, v / 60)) : 0;     // positive when ahead in the race
  const mine = (st.turn === e ? P.mine : P.mineMid) * (1 + P.leadK * lead);           // when the other side is about to throw, danger to my pieces is immediate
  const theirs = st.turn === e ? P.theirs : P.theirsMid;
  for (const x of st.pos[p]) {
    if (x < 0 || x >= N) continue;
    const sq = sqOf(p, x);
    if (isSafe(sq)) { v += P.safe; continue; }
    v -= mine * risk(st, e, sq, cache) * worth(x) * (o.cautious ?? 1);
  }
  for (const x of st.pos[e]) {
    if (x < 0 || x >= N) continue;
    const sq = sqOf(e, x);
    if (isSafe(sq)) continue;
    v += theirs * risk(st, p, sq, cache) * worth(x);
  }
  return v;
}

// ---- Casual: simple appetites -----------------------------------------------------------------------------------------
function casualScore(m) {
  return (m.cap ? 100 : 0) + (m.off ? 70 : 0) + (m.from === WAIT ? 40 : 0) + (m.off ? 0 : m.to) * 0.5 + m.v * 0.1;
}

// ---- searches ---------------------------------------------------------------------------------------------------------
// Best leaf value reachable by spending the rest of this turn's values in the best order. It is a generator so a search can be cut
// into slices: every `ctr.slice` positions it hands control back (a frame is never held for the whole search).
function* bestSeq(st, p, memo, ctr) {
  if (st.turn !== p || st.winner >= 0 || st.phase === 'throw') { ctr.n += 4; return evaluate(st, p); }    // evaluating a finished line is the dearest step
  const k = keyOf(st);
  const hit = memo.get(k);
  ctr.n += 1;
  if (hit !== undefined) return hit;
  let best = -Infinity;
  for (const m of legalMoves(st)) {
    if (ctr.n >= ctr.slice) { ctr.n = 0; yield; }
    const s = yield* bestSeq(applyMove(st, m), p, memo, ctr);
    if (s > best) best = s;
  }
  memo.set(k, best);
  return best;
}
function* scoreAll(st, ctr) {
  const p = st.turn, memo = new Map(), rows = [];
  if (st.pending.length > MAX_FULL) { for (const mv of legalMoves(st)) rows.push({ mv, score: evaluate(applyMove(st, mv), p) }); return rows; }
  for (const mv of legalMoves(st)) rows.push({ mv, score: yield* bestSeq(applyMove(st, mv), p, memo, ctr) });
  return rows;
}

// A search that runs in slices: `job.step(n)` evaluates about n positions and returns true once `job.rows` (every legal first move
// with the score of its best continuation) is ready. The level's tuning is applied only while a slice runs.
// A turn can hold many counts (a run of ones, fours and sixes): trying every order of 6 or more counts takes seconds, so a turn
// with more than MAX_FULL counts is scored one move ahead only (the same value, without the order search). That is rare (well under
// one turn in a hundred) and a long turn is mostly forced anyway.
export const MAX_FULL = 5;
export const SLICE = 400;     // work units per slice (a leaf evaluation counts 4, any other node 1)
export function searchJob(st, levelId) {
  const ctr = { n: 0, slice: SLICE }, gen = scoreAll(st, ctr);
  const job = {
    done: false, rows: null,
    step(n = SLICE) {
      if (job.done) return true;
      ctr.slice = n; ctr.n = 0;
      withLevel(levelId, () => { const r = gen.next(); if (r.done) { job.done = true; job.rows = r.value; } });
      return job.done;
    },
    finish() { while (!job.step(1e9)); return job.rows; },
  };
  return job;
}
export const scoreMoves = (st) => searchJob(st, 'master').finish();

// Rows best first (Think). `analyse` runs the whole search at once; Think itself uses `searchJob` and sorts the finished rows.
export const sortRows = (rows) => rows.slice().sort((a, b) => b.score - a.score);
export function analyse(st) { return sortRows(searchJob(st, 'master').finish()); }

// Picking a move for the computer. Expert and Master search in slices: `startPick` returns { move } at once for the cheap levels and
// for a forced move, otherwise { job, st, levelId }; once the job is done `finishPick` gives the move.
export function startPick(st, levelId, rng) {
  const moves = legalMoves(st);
  if (!moves.length) return { move: null };
  if (levelId !== 'expert' && levelId !== 'master') return { move: pickMove(st, levelId, rng) };
  if (moves.length === 1) return { move: moves[0] };
  return { job: searchJob(st, levelId), st, levelId };
}
export function finishPick(pk, rng) {
  if (pk.move !== undefined) return pk.move;
  const rows = pk.job.finish();
  if (pk.levelId === 'master') return sortRows(rows)[0].mv;
  let best = rows[0], bs = -Infinity;
  for (const r of rows) { const s = r.score + rng.next() * 0.01; if (s > bs) { bs = s; best = r; } }
  return best.mv;
}

export function pickMove(st, levelId, rng) { return withLevel(levelId, () => pickMoveIn(st, levelId, rng)); }
function pickMoveIn(st, levelId, rng) {
  const moves = legalMoves(st);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];
  const noise = { beginner: 1, casual: 0.22, skilled: 0.06, expert: 0.0, master: 0 }[levelId] ?? 0;
  if (noise > 0 && rng.chance(noise)) return rng.pick(moves);
  if (levelId === 'beginner') return rng.pick(moves);
  if (levelId === 'casual') {
    let best = moves[0], bs = -Infinity;
    for (const m of moves) { const s = casualScore(m) + rng.next() * 4; if (s > bs) { bs = s; best = m; } }
    return best;
  }
  const p = st.turn;
  if (levelId === 'skilled') {
    let best = moves[0], bs = -Infinity;
    for (const m of moves) { const s = evaluate(applyMove(st, m), p) + rng.next() * 0.01; if (s > bs) { bs = s; best = m; } }
    return best;
  }
  return finishPick({ job: searchJob(st, levelId), st, levelId }, rng);
}

// ---- Think: a verified reason ------------------------------------------------------------------------------------------
// Every sentence is composed only from facts the engine has just computed (captures, squares, exact odds), in English or Arabic.
const pct = (x) => `${Math.round(x * 100)}%`;
const TXT = {
  en: {
    off: ['Bear a piece off', 'This stone goes home for good, one step closer to winning the race.'],
    heads: { cap: 'Capture', enter: 'Enter a stone', safe: 'Take the safe square', best: 'Best move' },
    use: (v, facts) => { const t = `Using the ${v} on this stone ${facts.join(', and ')}.`; return t.charAt(0).toUpperCase() + t.slice(1); },
    cap: (n) => `captures a stone that had walked ${n} squares and sends it back to start`,
    enter: 'brings a new stone onto the board (it needs a one, which is not easy to get)',
    safe: 'lands on a safe square, where it cannot be captured',
    escape: (a, b) => `moves a stone out of danger: the chance it can be hit next turn falls from at most ${a} to at most ${b}`,
    low: (a) => `lands where the other side can hit it with a chance of at most ${a}`,
    risky: (a) => `is the best of a risky set of moves: the landing square can be hit with at most ${a}`,
    plain: 'makes the most progress for the least risk',
  },
  ar: {
    off: ['أخرج حجراً إلى البيت', 'هذا الحجر يذهب إلى البيت نهائياً، وهو خطوة أقرب إلى الفوز بالسباق.'],
    heads: { cap: 'أسر', enter: 'أدخل حجراً', safe: 'خذ المربع الآمن', best: 'أفضل نقلة' },
    use: (v, facts) => `استعمال العدد ${v} على هذا الحجر ${facts.join('، و')}.`,
    cap: (n) => `يأسر حجراً كان قد قطع ${n} مربعاً ويعيده إلى البداية`,
    enter: 'يُدخل حجراً جديداً إلى اللوح (وهو يحتاج إلى العدد واحد، وليس من السهل الحصول عليه)',
    safe: 'ينزل على مربع آمن لا يمكن أسره فيه',
    escape: (a, b) => `ينقل حجراً من الخطر: احتمال إصابته في الدور القادم ينخفض من ${a} على الأكثر إلى ${b} على الأكثر`,
    low: (a) => `ينزل حيث لا يتجاوز احتمال إصابته من الخصم ${a}`,
    risky: (a) => `هو أفضل نقلة بين نقلات محفوفة بالخطر: يمكن إصابة مربع النزول باحتمال ${a} على الأكثر`,
    plain: 'يحقق أكبر تقدّم بأقل خطر',
  },
};
export function explain(st, mv, lang = 'en') {
  const X = TXT[lang] ?? TXT.en;
  const p = st.turn, e = other(p), after = applyMove(st, mv);
  const facts = [];
  const sq = mv.sq;
  const hitBefore = mv.from >= 0 ? hitChance(st, e, sqOf(p, mv.from)) : 0;
  const wasSafe = mv.from >= 0 && isSafe(sqOf(p, mv.from));
  const hitAfter = !mv.off && sq >= 0 && !isSafe(sq) ? hitChance(after, e, sq) : 0;
  if (mv.off) return { head: X.off[0], why: X.off[1], kind: 'off' };
  if (mv.cap) { const lost = st.pos[e].find((x) => sqOf(e, x) === sq) ?? 0; facts.push(X.cap(lost + 1)); }
  if (mv.from === WAIT) facts.push(X.enter);
  if (isSafe(sq)) facts.push(X.safe);
  else if (!mv.cap && mv.from >= 0 && hitBefore >= 0.12 && !wasSafe && hitAfter < hitBefore - 0.08) facts.push(X.escape(pct(hitBefore), pct(hitAfter)));
  else if (!mv.cap && hitAfter <= 0.08) facts.push(X.low(pct(hitAfter)));
  else if (hitAfter >= 0.3) facts.push(X.risky(pct(hitAfter)));
  if (!facts.length) facts.push(X.plain);
  const head = mv.cap ? X.heads.cap : mv.from === WAIT ? X.heads.enter : isSafe(sq) ? X.heads.safe : X.heads.best;
  return { head, why: X.use(mv.v, facts), kind: mv.cap ? 'cap' : 'move', hitBefore, hitAfter };
}

export { applyThrow, homeCount };

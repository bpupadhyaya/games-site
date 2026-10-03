// Cornhole match rules (pure, no drawing). A round ("inning") is four bags each, thrown alternately. Bags that stay on the board score
// 1, bags in the hole score 3. Cancellation scoring: the two totals are set against each other and only the difference counts, for the
// side that is ahead. The side that scored throws first in the next round (if nobody scored, the same side throws first again).
export const LENGTHS = [
  { id: 0, name: 'Short', pts: 11, exact: false, note: 'First to 11 points' },
  { id: 1, name: 'Standard', pts: 21, exact: false, note: 'First to 21 points' },
  { id: 2, name: 'Exact 21', pts: 21, exact: true, note: 'House rule: you must land on exactly 21; going over drops you back to 15' },
];
export const BAGS_EACH = 4;
export const BOARD_PT = 1, HOLE_PT = 3;

export function newMatch(cfg) {
  const len = LENGTHS[cfg.len ?? 1];
  return {
    cfg: { mode: 'ai', opp: 0, len: 1, first: 0, ...cfg },
    target: len.pts, exact: len.exact, score: [0, 0], round: 1, first: cfg.first ?? 0, made: [0, 0], bags: [], rounds: [],
    stats: [{ holes: 0, boards: 0, outs: 0 }, { holes: 0, boards: 0, outs: 0 }], over: null, lastRound: null,
  };
}
export const turnOf = (m) => ((m.made[0] + m.made[1]) % 2 === 0 ? m.first : 1 - m.first);
export const throwsLeft = (m, side) => BAGS_EACH - m.made[side];
export const bagIndex = (m) => m.made[0] + m.made[1] + 1;      // 1..8
export const pointsOf = (bags, side) => bags.reduce((n, b) => (b.side !== side ? n : b.st === 'hole' ? n + HOLE_PT : b.st === 'board' ? n + BOARD_PT : n), 0);
export const netOf = (bags, side) => pointsOf(bags, side) - pointsOf(bags, 1 - side);
export const bagResult = (b) => (b.st === 'hole' ? 'hole' : b.st === 'board' ? 'board' : 'out');

// Record a finished throw. `bags` is every bag of this round after the throw settled; `id` the bag that was just thrown.
export function applyThrow(m, bags, id) {
  const side = turnOf(m);
  const b = bags.find((x) => x.id === id);
  const res = b ? bagResult(b) : 'out';
  m.bags = bags.map((x) => ({ ...x, vu: 0, vv: 0, vx: 0, vz: 0, sq: 0 }));
  m.made[side]++;
  const stt = m.stats[side];
  if (res === 'hole') stt.holes++; else if (res === 'board') stt.boards++; else stt.outs++;
  const rec = { side, res, round: null };
  if (m.made[0] + m.made[1] >= 2 * BAGS_EACH) rec.round = finishRound(m);
  return rec;
}
export function finishRound(m) {
  const pa = pointsOf(m.bags, 0), pb = pointsOf(m.bags, 1);
  const net = pa - pb, scorer = net > 0 ? 0 : net < 0 ? 1 : -1, gain = Math.abs(net);
  let bust = false;
  if (scorer >= 0) {
    let s = m.score[scorer] + gain;
    if (m.exact && s > m.target) { s = 15; bust = true; }
    m.score[scorer] = s;
  }
  const r = { round: m.round, pa, pb, scorer, gain, bust, first: m.first, score: m.score.slice() };
  m.rounds.push(r); m.lastRound = r;
  const win = m.score.findIndex((s) => (m.exact ? s === m.target : s >= m.target));
  if (win >= 0) { m.over = { win, a: m.score[0], b: m.score[1] }; return r; }
  m.first = scorer >= 0 ? scorer : m.first;
  m.round++; m.made = [0, 0]; m.bags = [];
  return r;
}
export function totals(m, side) { return { score: m.score[side], ...m.stats[side] }; }
// The text of a round, for the banner and the result screen.
export function roundText(r, names) {
  if (r.scorer < 0) return r.pa === 0 ? 'No bags counted: no points this round' : `${r.pa} to ${r.pb}: the points cancel out, nobody scores`;
  const who = names[r.scorer];
  return `${r.pa} to ${r.pb}: ${who} score${names[r.scorer] === 'You' ? '' : 's'} ${r.gain} (${Math.max(r.pa, r.pb)} minus ${Math.min(r.pa, r.pb)})${r.bust ? '. Over 21: back to 15' : ''}`;
}

// Match rules on top of the engine: whose shot it is, bonus shots after a pot, the round limit, the count. Pure.
import { makeMat, takeShot, freeWinks, unpotted, MAX_BONUS, POT } from './sim.js';

export const LENGTH = { quick: { winks: 6, rounds: 8 }, full: { winks: 9, rounds: 12 } };

export function newMatch(cfg, rng) {
  const L = cfg.len === 'full' ? LENGTH.full : LENGTH.quick;
  void rng;
  return {
    cfg, mat: makeMat(L.winks), turn: cfg.first ?? 0, total: L.rounds, left: [L.rounds, L.rounds],
    bonus: false, chain: 0, shots: 0, passes: [0, 0], over: null, stats: [{ pots: 0, squops: 0, bombs: 0, off: 0 }, { pots: 0, squops: 0, bombs: 0, off: 0 }],
  };
}
export const potted = (m) => m.mat.potted;
export const roundNo = (m) => Math.min(m.total, m.total - Math.min(m.left[0], m.left[1]) + 1);
export const canShoot = (m, side) => freeWinks(m.mat, side).length > 0;

// Fire a shot for the side to move. Returns the result record (see sim.takeShot) with .over set when the match ended.
export function playShot(m, shot, rng) {
  const side = m.turn;
  const res = takeShot(m.mat, shot, rng);
  m.shots++;
  const st = m.stats[side];
  if (res.kind === 'squop') st.squops++; else if (res.kind === 'bomb') st.bombs++; else if (res.kind === 'off') st.off++;
  st.pots += res.pots[side];
  if (res.pots[1 - side]) m.stats[1 - side].pots += res.pots[1 - side];
  if (!m.bonus) m.left[side] = Math.max(0, m.left[side] - 1);
  if (res.bonus && m.chain < MAX_BONUS && m.left[side] >= 0 && unpotted(m.mat, side).length) { m.bonus = true; m.chain++; }
  else { m.bonus = false; m.chain = 0; m.turn = 1 - side; }
  settle(m);
  return res;
}

// After a shot (or a pass): skip a side that cannot move, end the match when nothing is left to play.
export function settle(m) {
  for (let guard = 0; guard < 200 && !m.over; guard++) {
    const done = (s) => unpotted(m.mat, s).length === 0;
    if (done(0) && done(1)) { finish(m); return; }
    if (m.left[0] === 0 && m.left[1] === 0) { finish(m); return; }
    const s = m.turn;
    const spent = m.left[s] === 0 && !m.bonus;
    if (done(s) || spent) { m.turn = 1 - s; m.bonus = false; m.chain = 0; if (done(m.turn) || m.left[m.turn] === 0) { finish(m); return; } continue; }
    if (!canShoot(m, s)) { m.passes[s]++; if (!m.bonus) m.left[s] = Math.max(0, m.left[s] - 1); m.bonus = false; m.chain = 0; m.turn = 1 - s; continue; }
    return;
  }
}
// Equal pots are settled by the winks still on the mat: the side whose winks lie nearer the cup (smaller total gap) wins.
export function gapTotal(mat, side) {
  return mat.winks.filter((w) => w.side === side && !w.pot).reduce((s, w) => s + Math.hypot(w.x - POT.x, w.y - POT.y), 0);
}
function finish(m) {
  const [a, b] = m.mat.potted;
  let win = a > b ? 0 : b > a ? 1 : -1, tie = false;
  if (win < 0) {
    const ga = gapTotal(m.mat, 0), gb = gapTotal(m.mat, 1);
    if (Math.abs(ga - gb) > 1) { win = ga < gb ? 0 : 1; tie = true; }
  }
  m.over = { win, a, b, tie };
}
export const turnInfo = (m) => ({ side: m.turn, bonus: m.bonus, chain: m.chain });

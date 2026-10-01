// Match rules: whose turn it is, when an end is over, how it is scored. Pure functions over the
// match record `m` and the physics world `w`; the engine (sim.js) never knows about teams or points.
import { JACK_ZONE, LANE, liveBoules, theJack, ranking, endScore, TIE_EPS, dist2D, R_J } from './sim.js';

export const BOULES = 3;
export const JACK_ID = 0;

export function newMatch(cfg) {
  return {
    cfg, scores: [0, 0], end: 1, starter: cfg.firstJack ?? 0, hand: [BOULES, BOULES], turn: 0, last: -1,
    phase: 'jack', jackTry: 0, jackFails: 0, nextId: 1, log: [], over: null, endInfo: null, msg: '', throws: 0,
  };
}

export function beginEnd(m, w) {
  w.balls = []; w.scars = []; w.settled = true;
  m.hand = [BOULES, BOULES];
  m.phase = 'jack'; m.turn = m.starter; m.last = -1; m.jackTry = 0; m.jackFails = 0; m.endInfo = null; m.nextId = 1;
}

// Is the jack validly placed? Returns '' when fine, otherwise the reason.
export function jackProblem(w) {
  const j = w.balls.find((b) => b.k);
  if (!j || j.out) return 'The jack left the lane.';
  const d = Math.hypot(j.x, j.y);
  if (d < JACK_ZONE.min) return 'The jack stopped too close (under 5 m).';
  if (d > JACK_ZONE.max) return 'The jack stopped too far (over 8 m).';
  if (Math.abs(j.x) > LANE.halfW - 14) return 'The jack is too near the border.';
  return '';
}

// Called when the jack has settled. Returns { ok, msg }.
export function judgeJack(m, w) {
  const why = jackProblem(w);
  if (!why) {
    m.phase = 'aim'; m.turn = m.starter; m.last = -1;
    return { ok: true, msg: '' };
  }
  m.jackFails++;
  w.balls = [];
  if (m.jackFails >= 2) {
    // the second failure: the jack is placed for them at 6.5 m
    return { ok: true, placed: true, msg: why + ' Placed at 6.5 m.' };
  }
  m.starter = 1 - m.starter; m.turn = m.starter;
  return { ok: false, msg: why + ' The other side throws it.' };
}
export function placeJack(m, w, newBall) {
  const j = newBall(JACK_ID, 1, -1, 0, 390);
  w.balls.push(j);
  m.phase = 'aim'; m.turn = m.starter; m.last = -1;
}

// Which side throws the next boule? -1 when the end is over.
export function whoNext(m, w) {
  const [a, b] = m.hand;
  if (a === 0 && b === 0) return -1;
  if (a === 0) return 1;
  if (b === 0) return 0;
  const rk = ranking(w);
  if (!rk.length) return 1 - m.last;                     // nothing alive on the lane: the side that did not just play
  const lead = rk[0].b.team;
  const other = rk.find((r) => r.b.team !== lead);
  if (other && Math.abs(other.d - rk[0].d) < TIE_EPS) return 1 - m.last;   // dead heat: the side that did not play last
  return 1 - lead;                                        // the side that is not holding the point plays
}

// Score the finished end. Returns { team, pts, tie, deadJack, text }
export function scoreOf(m, w) {
  const jack = theJack(w);
  if (!jack) {
    const [a, b] = m.hand;
    if (a > 0 && b === 0) return { team: 0, pts: a, tie: false, deadJack: true, text: 'Dead jack: only one side had boules left, so it scores them.' };
    if (b > 0 && a === 0) return { team: 1, pts: b, tie: false, deadJack: true, text: 'Dead jack: only one side had boules left, so it scores them.' };
    return { team: -1, pts: 0, tie: false, deadJack: true, text: a === 0 && b === 0 ? 'Dead jack with no boules left: no score.' : 'Dead jack: both sides had boules left, so no score.' };
  }
  const s = endScore(w);
  if (s.tie) return { ...s, deadJack: false, text: 'Dead heat for the closest boule: no score.' };
  return { ...s, deadJack: false, text: '' };
}

export function applyEnd(m, res) {
  if (res.team >= 0 && res.pts > 0) {
    m.scores[res.team] += res.pts;
    m.starter = res.team;
  }
  m.log.push({ end: m.end, team: res.team, pts: res.pts });
  if (m.scores[0] >= m.cfg.target || m.scores[1] >= m.cfg.target) {
    const win = m.scores[0] >= m.cfg.target ? 0 : 1;
    m.over = { win, fanny: m.scores[1 - win] === 0 };
    m.phase = 'over';
  } else {
    m.end++;
  }
}

// The boules that count in the current end, in order, with their gap to the jack (surface to surface).
export { ranking, liveBoules, theJack, dist2D, R_J };

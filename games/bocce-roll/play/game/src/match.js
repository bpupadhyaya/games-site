// Match rules: whose turn it is, when a frame is over, how it is scored. Pure functions over the match record `m`
// and the physics world `w`; the engine (sim.js) never knows about teams or points.
import { COURT, thePallino, ranking, frameScore, TIE_EPS, newBall, PALLINO } from './sim.js';

export const BALLS = 4;
export const PALLINO_ID = PALLINO;

export function newMatch(cfg) {
  return {
    cfg, scores: [0, 0], frame: 1, starter: cfg.firstPallino ?? 0, hand: [BALLS, BALLS], thrown: [0, 0], turn: 0, last: -1,
    phase: 'pallino', pFails: 0, nextId: 1, log: [], over: null, endInfo: null, throws: 0,
  };
}
export function beginFrame(m, w) {
  w.balls = []; w.settled = true;
  m.hand = [BALLS, BALLS]; m.thrown = [0, 0];
  m.phase = 'pallino'; m.turn = m.starter; m.last = -1; m.pFails = 0; m.endInfo = null; m.nextId = 1;
}
// 0 or 1 for a single player per side, 0..1 for the two players of a team
export const slotOf = (m, side) => (m.cfg.team2 ? m.thrown[side] % 2 : 0);

export function pallinoProblem(w) {
  const p = w.balls.find((b) => b.k);
  if (!p || p.out) return 'The pallino left the court.';
  if (p.wall) return 'The pallino touched the back wall.';
  if (p.y < COURT.center) return 'The pallino did not pass the centre line.';
  return '';
}
// The pallino has settled. { ok, placed, msg }
export function judgePallino(m, w) {
  const why = pallinoProblem(w);
  if (!why) { m.phase = 'aim'; m.turn = m.starter; m.last = -1; return { ok: true, msg: '' }; }
  m.pFails++;
  w.balls = [];
  if (m.pFails >= 2) return { ok: true, placed: true, msg: `${why} It is placed on the centre line.` };
  m.starter = 1 - m.starter; m.turn = m.starter;
  return { ok: false, msg: `${why} The other side throws it.` };
}
export function placePallino(m, w) {
  const p = newBall(PALLINO_ID, -1, true);
  p.x = 0; p.y = COURT.center + 3.5; p.z = p.r;
  w.balls.push(p);
  m.phase = 'aim'; m.turn = m.starter; m.last = -1;
}

// Which side throws the next ball? -1 when the frame is over.
export function whoNext(m, w) {
  const [a, b] = m.hand;
  if (a === 0 && b === 0) return -1;
  if (a === 0) return 1;
  if (b === 0) return 0;
  const rk = ranking(w);
  if (!rk.length) return m.last >= 0 ? m.last : m.starter;         // nothing in play: the side that just threw tries again
  const lead = rk[0].b.team;
  const other = rk.find((r) => r.b.team !== lead);
  if (other && Math.abs(other.d - rk[0].d) < TIE_EPS) return m.last;  // dead heat: the side that threw last throws again
  return 1 - lead;                                                  // the side that is not in plays
}

// Score the finished frame: { team, pts, tie, void, text }
export function scoreOf(m, w) {
  if (!thePallino(w)) return { team: -1, pts: 0, tie: false, void: true, text: 'The pallino left the court: no score, the frame is replayed.' };
  const s = frameScore(w);
  if (s.tie) return { ...s, void: false, text: 'Dead heat for the closest ball: no score.' };
  if (s.empty) return { ...s, void: false, text: 'No ball stayed in play: no score.' };
  return { ...s, void: false, text: '' };
}
export function applyFrame(m, res) {
  if (res.void) { m.log.push({ frame: m.frame, team: -1, pts: 0, void: true }); return; }
  if (res.team >= 0 && res.pts > 0) { m.scores[res.team] += res.pts; m.starter = res.team; }
  m.log.push({ frame: m.frame, team: res.team, pts: res.pts });
  if (m.scores[0] >= m.cfg.target || m.scores[1] >= m.cfg.target) {
    const win = m.scores[0] >= m.cfg.target ? 0 : 1;
    m.over = { win, shutout: m.scores[1 - win] === 0 };
    m.phase = 'over';
  } else m.frame++;
}

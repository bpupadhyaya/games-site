// Match rules: ends, bowl order, the jack, and counting shots. Pure functions over `m` (the match record) and the world.
import { RINK, countEnd, theJack, liveBowls, createWorld } from './sim.js';

export const BOWLS_EACH = 4;

export function newMatch(cfg) {
  const m = {
    cfg: { ends: 6, mode: 'ai', opp: 0, green: 'village', ...cfg },
    end: 1, scores: [0, 0], lead: cfg.lead ?? 0, turn: 0, left: [BOWLS_EACH, BOWLS_EACH], thrown: 0, nextId: 1, phase: 'jack', jackTries: 0,
    log: [], over: null, endInfo: null, last: -1, dead: 0,
  };
  m.turn = m.lead;
  return m;
}

// reset the green for a new end
export function beginEnd(m, w) {
  w.balls = []; w.settled = true;
  m.left = [BOWLS_EACH, BOWLS_EACH]; m.thrown = 0; m.nextId = 1; m.phase = 'jack'; m.jackTries = 0; m.turn = m.lead; m.endInfo = null; m.last = -1; m.dead = 0;
}

// Judge the jack once it has stopped. ok: a fair jack (it is then centred); otherwise a message and whether to roll again.
export function judgeJack(m, w) {
  const j = theJack(w);
  if (!j || j.out) return { ok: false, msg: 'The jack ran out of the rink: roll it again', again: true };
  if (j.ditch) return { ok: false, msg: 'The jack ran into the ditch: roll it again', again: true };
  if (j.y < RINK.minJack - 0.0001) return { ok: false, msg: 'Short jack (under 23 m): roll it again', again: true };
  return { ok: true };
}

// Who bowls next? Bowls alternate; a side with none left yields to the other. -1 when the end is over.
export function whoNext(m) {
  const other = 1 - m.last;
  if (m.last < 0) return m.lead;
  if (m.left[other] > 0) return other;
  if (m.left[m.last] > 0) return m.last;
  return -1;
}

// Result of an end as it lies: { dead, team, pts, tie, text }
export function scoreEnd(m, w) {
  const j = theJack(w);
  if (!j || j.out) return { dead: true, team: -1, pts: 0, tie: false, text: 'Dead end: the jack left the rink. The end is replayed.' };
  const r = countEnd(w);
  if (r.none) return { dead: false, team: -1, pts: 0, tie: false, text: 'No bowl is alive: no score' };
  if (r.tie) return { dead: false, team: -1, pts: 0, tie: true, text: 'Two bowls are the same distance: no score' };
  return { dead: false, team: r.team, pts: r.pts, tie: false, text: '' };
}

// Apply a finished end. Next lead: the winner of the end, else the same player.
export function applyEnd(m, res) {
  if (res.dead) { m.log.push({ end: m.end, dead: true, team: -1, pts: 0 }); return; }
  if (res.team >= 0) { m.scores[res.team] += res.pts; m.lead = res.team; }
  m.log.push({ end: m.end, team: res.team, pts: res.pts });
  m.end++;
  if (m.end > m.cfg.ends && m.scores[0] !== m.scores[1]) m.over = { win: m.scores[0] > m.scores[1] ? 0 : 1, shutout: Math.min(...m.scores) === 0 };
}
export const endsPlayed = (m) => m.log.filter((l) => !l.dead).length;
export { liveBowls, createWorld };

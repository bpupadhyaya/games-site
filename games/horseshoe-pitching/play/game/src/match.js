// Match rules: innings, who pitches, scoring to the target. No physics here (sim.js) and no drawing.
import { scoreInning } from './sim.js';

// cfg: { mode: 'ai'|'two'|'doubles'|'watch', opp, pit, target, first, watchA }
export function newMatch(cfg) {
  const m = {
    cfg: { target: 21, mode: 'ai', opp: 0, pit: 'clay', first: 0, ...cfg },
    scores: [0, 0], inning: 1, first: cfg.first | 0, idx: 0, left: [2, 2], over: null, history: [], nextId: 1,
    ringers: [0, 0], phase: 'aim', endInfo: null, thrown: 0,
  };
  return m;
}
// the four shoes of an inning in order: first side twice, then the other side twice
export const turnOf = (m) => (m.idx < 2 ? m.first : 1 - m.first);
export function shoeThrown(m) {
  const side = turnOf(m);
  m.left[side]--; m.idx++; m.thrown++;
  return m.idx >= 4;
}
export function endInning(m, shoes) {
  const sc = scoreInning(shoes);
  const rec = { inning: m.inning, ...sc, first: m.first };
  m.history.push(rec);
  if (sc.side >= 0) m.scores[sc.side] += sc.pts;
  for (const s of shoes) if (!s.dead && s.ringer) m.ringers[s.side]++;
  return rec;
}
// after the inning has been shown: next inning (the side that just scored pitches first) or the end of the match
export function advance(m, rec) {
  const target = m.cfg.target;
  const a = m.scores[0] >= target, b = m.scores[1] >= target;
  if (a || b) {
    const win = a && b ? (m.scores[0] >= m.scores[1] ? 0 : 1) : a ? 0 : 1;
    m.over = { win, shutout: m.scores[1 - win] === 0, innings: m.inning };
    m.phase = 'over';
    return true;
  }
  if (rec.side >= 0) m.first = rec.side;
  m.inning++; m.idx = 0; m.left = [2, 2]; m.endInfo = null; m.phase = 'aim';
  return false;
}
// the person at the end: in doubles the partner pitches every other inning
export function throwerSlot(m) { return m.inning % 2; }   // 1 = first partner, 0 = second partner

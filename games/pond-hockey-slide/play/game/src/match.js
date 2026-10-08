// Match rules: first side to `goalsTo` goals wins. Sides alternate one skater shot each; after a goal the pond is reset and
// the side that conceded shoots first. After `CAP` shots each the leader wins; a tie goes to sudden death (next goal wins).
export const CAP = 18;
export const LENGTHS = [3, 5];

export function newMatch(cfg) {
  const first = cfg.first ?? 0;
  return {
    cfg: { mode: 'ai', opp: 0, goalsTo: 3, first, watchA: 1, ...cfg }, scores: [0, 0], turn: first, turns: [0, 0], shots: 0, phase: 'aim',
    over: null, log: [], sudden: false, lastGoal: null,
  };
}

// A shot has finished without a goal: pass the turn (and apply the shot cap).
export function afterShot(m) {
  m.shots++; m.turns[m.turn]++;
  m.turn = 1 - m.turn;
  if (!m.sudden && m.turns[0] >= CAP && m.turns[1] >= CAP) {
    if (m.scores[0] !== m.scores[1]) m.over = { win: m.scores[0] > m.scores[1] ? 0 : 1, byCap: true };
    else m.sudden = true;
  }
  return m.over;
}

// A goal for `side`: count it, say who shoots next, finish the match when it is decided.
export function goalFor(m, side) {
  m.scores[side]++; m.shots++; m.turns[m.turn]++;
  m.log.push({ side, shot: m.shots });
  m.lastGoal = side;
  m.turn = 1 - side;       // the conceding side restarts
  if (m.scores[side] >= m.cfg.goalsTo || m.sudden) m.over = { win: side, byCap: false, sudden: m.sudden };
  return m.over;
}

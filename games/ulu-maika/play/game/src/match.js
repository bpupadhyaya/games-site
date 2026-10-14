// Match rules: who rolls, scoring, ties. No physics here (sim.js) and no drawing.
//   cfg: { mode: 'ai' | 'two' | 'watch' | 'solo', opp, watchA, track, rolls, lead }
//   sides: 2 (solo: 1). Sides alternate every roll; after the rolls are used up a tie is settled by sudden death.
export const MAX_SUDDEN = 3;

export function newMatch(cfg) {
  const sides = cfg.mode === 'solo' ? 1 : 2;
  return {
    cfg, sides, turn: cfg.lead % sides, scores: [0, 0], rolls: [0, 0], history: [[], []], sudden: 0, phase: 'aim', over: null, last: null, no: 1,
  };
}
export const rollsLeft = (m, side) => Math.max(0, m.cfg.rolls - m.rolls[side]);

// Record a finished roll for the side that rolled it.
export function applyRoll(m, side, res) {
  m.scores[side] += res.points;
  m.rolls[side]++;
  m.history[side].push(res.points);
  m.last = { side, ...res };
  m.no++;
}

// Next side to roll, or null when the match is over (then m.over is set).
export function advance(m) {
  const a = m.rolls[0], b = m.sides === 2 ? m.rolls[1] : a;
  const n = m.cfg.rolls + m.sudden;
  if (m.sides === 1) { if (a >= n) { m.over = { win: 0, solo: true }; return null; } return 0; }
  if (a >= n && b >= n) {
    if (m.scores[0] !== m.scores[1]) { m.over = { win: m.scores[0] > m.scores[1] ? 0 : 1, margin: Math.abs(m.scores[0] - m.scores[1]) }; return null; }
    if (m.sudden >= MAX_SUDDEN) { m.over = { win: -1, margin: 0 }; return null; }
    m.sudden++;
    return m.cfg.lead % 2;
  }
  // alternate; the side that has rolled fewer goes next, equal counts go to the lead side
  if (a === b) return m.cfg.lead % 2;
  return a < b ? 0 : 1;
}

// Kegeln match rules (pure, no drawing). A match has two parts, played by two sides who throw alternately:
//   Volle     every throw is at a full set of nine pins (the pins are set up again after each throw).
//   Abraeumen every throw is at the pins that are still standing from the player's own previous throw; when all nine
//             have fallen the pins are set up again. Each side keeps its own pins.
// A side's score is the total of pins knocked down ("Holz", wood) over both parts. The higher total wins.
export const LENGTHS = [
  { id: 0, name: 'Short', each: 5, note: '5 Volle + 5 Abräumen throws each' },
  { id: 1, name: 'Standard', each: 10, note: '10 Volle + 10 Abräumen throws each' },
  { id: 2, name: 'Full lane', each: 15, note: '15 Volle + 15 Abräumen throws each, as on a real lane' },
];
const ALL = () => new Array(9).fill(true);

export function newMatch(cfg) {
  const len = LENGTHS[cfg.len ?? 1];
  return {
    cfg: { mode: 'ai', opp: 0, len: 1, first: 0, ...cfg },
    each: len.each, phase: 0,                 // 0 = Volle, 1 = Abraeumen
    turn: cfg.first ?? 0,
    done: [[0, 0], [0, 0]],                   // throws made by [side][phase]
    standing: [ALL(), ALL()],                 // pins still standing for each side (Abraeumen)
    throws: [[], []],                         // per side: { phase, pins, pudel, kranz, alle, cleared, left }
    over: null, laneK: cfg.laneK ?? 1,
  };
}
export const phaseName = (ph) => (ph === 0 ? 'Volle' : 'Abräumen');
export const totals = (m, side) => {
  const t = m.throws[side];
  const a = t.filter((x) => x.phase === 0).reduce((n, x) => n + x.pins, 0), b = t.filter((x) => x.phase === 1).reduce((n, x) => n + x.pins, 0);
  return { volle: a, abr: b, total: a + b };
};
export const throwsLeft = (m, side) => m.each * 2 - m.done[side][0] - m.done[side][1];
export const standingFor = (m) => (m.phase === 0 ? ALL() : m.standing[m.turn].slice());
export const throwNo = (m) => m.done[m.turn][m.phase] + 1;

// Record a finished throw. `res` is simResult(): { down, standing, count, pudel, kingStands }.
export function applyThrow(m, res) {
  const side = m.turn, ph = m.phase;
  const before = standingFor(m);
  const countBefore = before.filter(Boolean).length;
  const rec = {
    phase: ph, pins: res.count, pudel: !!res.pudel, left: res.standing.slice(), before,
    alle: res.count === 9 && countBefore === 9,
    kranz: ph === 0 && res.count === 8 && res.kingStands,
    cleared: false,
  };
  if (ph === 1) {
    const left = res.standing.slice();
    if (left.every((x) => !x)) { m.standing[side] = ALL(); rec.cleared = true; } else m.standing[side] = left;
  }
  m.throws[side].push(rec);
  m.done[side][ph]++;
  // who is next
  const other = 1 - side;
  if (m.done[other][ph] < m.each && (m.done[other][ph] <= m.done[side][ph])) m.turn = other;
  else if (m.done[side][ph] < m.each) m.turn = side;
  else if (m.done[other][ph] < m.each) m.turn = other;
  else if (ph === 0) { m.phase = 1; m.turn = m.cfg.first; }
  else {
    const a = totals(m, 0).total, b = totals(m, 1).total;
    m.over = { win: a === b ? -1 : a > b ? 0 : 1, a, b };
  }
  return rec;
}
export const countOf = (arr) => arr.filter(Boolean).length;
export function toMask(arr) { let n = 0; arr.forEach((v, i) => { if (v) n |= 1 << i; }); return n; }
export function fromMask(n) { return Array.from({ length: 9 }, (_, i) => !!(n & (1 << i))); }

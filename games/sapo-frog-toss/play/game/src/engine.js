// Sapo match rules (pure, no drawing). Two sides throw brass discs, one at a time, alternating. A round is DISCS discs each.
//   - A disc that drops into a hole scores that hole's value for the side that threw it, at once, wherever it was knocked from.
//   - Discs that stay on the table stay for the rest of the round, so later discs can knock them away (or into a hole).
//   - When every disc of the round has been thrown, the loose disc that lies nearest to the middle of the frog's mouth earns its side
//     the Closest bonus. The table is then cleared for the next round, and the side that started the round throws second.
//   - After the last round the higher total wins (equal totals are a draw).
import { newDisc, resting, closestDisc, MOUTH } from './phys.js';
export const DISCS = 5;
export const CLOSEST_BONUS = 25;
export const LENGTHS = [
  { id: 0, rounds: 2, en: 'Short', es: 'Corta', noteEn: '2 rounds of 5 discs each', noteEs: '2 rondas de 5 fichas cada uno' },
  { id: 1, rounds: 4, en: 'Standard', es: 'Normal', noteEn: '4 rounds of 5 discs each', noteEs: '4 rondas de 5 fichas cada uno' },
  { id: 2, rounds: 6, en: 'Long', es: 'Larga', noteEn: '6 rounds of 5 discs each', noteEs: '6 rondas de 5 fichas cada uno' },
];
export function newMatch(cfg) {
  const len = LENGTHS[cfg.len ?? 1];
  return {
    cfg: { mode: 'ai', opp: 0, len: 1, first: 0, ...cfg },
    rounds: len.rounds, round: 0, starter: cfg.first ?? 0, idx: 0,           // idx = throws made so far this round (0..2*DISCS)
    discs: [], nextId: 1, scores: [0, 0], bonus: [0, 0],
    log: [],                                                                  // one record per throw: { round, side, pts, hole, rested }
    roundInfo: [], over: null,
    stats: [{ in: 0, mouth: 0, mill: 0, best: 0, closest: 0, throws: 0 }, { in: 0, mouth: 0, mill: 0, best: 0, closest: 0, throws: 0 }],
  };
}
export const turnSide = (m) => (m.starter + m.idx) % 2;
// How many discs a side still has to throw this round (counting the one about to be thrown when it is that side's turn).
export function leftFor(m, side) {
  let n = 0;
  for (let i = m.idx; i < 2 * DISCS; i++) if ((m.starter + i) % 2 === side) n++;
  return n;
}
export const tableDiscs = (m) => m.discs.map((d) => { const x = newDisc(d.id, d.owner, d.x, d.z); x.ang = d.ang ?? x.ang; return x; });
export const isLastOfRound = (m) => m.idx === 2 * DISCS - 1;

// Apply one finished throw. `res` = { discs (every disc of the finished sim), scored: [{ hole, v, owner, id }] }, `side` threw it.
export function applyThrow(m, side, res) {
  const rec = { round: m.round, side, scored: res.scored.map((s) => ({ ...s })), pts: [0, 0], closest: null, roundEnd: false, rested: false, out: false, knockedOff: 0 };
  const st = m.stats[side];
  st.throws++;
  for (const s of res.scored) { m.scores[s.owner] += s.v; rec.pts[s.owner] += s.v; const t = m.stats[s.owner]; t.in++; if (s.hole === 'mouth') t.mouth++; if (s.hole === 'mill') t.mill++; if (s.owner === side) t.best = Math.max(t.best, s.v); }
  const before = new Set(m.discs.map((d) => d.id));
  m.discs = resting(res.discs).map((d) => ({ id: d.id, owner: d.owner, x: Math.round(d.x * 10000) / 10000, z: Math.round(d.z * 10000) / 10000, ang: Math.round((d.ang % 6.2832) * 100) / 100 }));
  const still = new Set(m.discs.map((d) => d.id));
  const thrown = res.discs.find((d) => !before.has(d.id));
  rec.rested = !!thrown && still.has(thrown.id);
  rec.out = !!thrown && !rec.rested && !res.scored.some((s) => s.id === thrown.id);
  for (const id of before) if (!still.has(id) && !res.scored.some((s) => s.id === id)) rec.knockedOff++;
  m.log.push({ round: m.round, side, pts: rec.pts[side], hole: res.scored.find((s) => s.id === (thrown && thrown.id))?.hole ?? null, rested: rec.rested });
  m.idx++;
  if (m.idx >= 2 * DISCS) {
    const c = closestDisc(res.discs);
    const info = { round: m.round, bonus: null };
    if (c) { m.scores[c.owner] += CLOSEST_BONUS; m.bonus[c.owner] += CLOSEST_BONUS; m.stats[c.owner].closest++; info.bonus = { owner: c.owner, d: c.d }; rec.closest = { owner: c.owner, d: c.d, id: c.id }; rec.pts[c.owner] += CLOSEST_BONUS; }
    m.roundInfo.push(info);
    rec.roundEnd = true;
    m.round++; m.idx = 0; m.starter = 1 - m.starter; m.discs = [];
    if (m.round >= m.rounds) m.over = { win: m.scores[0] > m.scores[1] ? 0 : m.scores[1] > m.scores[0] ? 1 : -1 };
  }
  return rec;
}
export const mouthDist = (d) => Math.hypot(d.x - MOUTH.x, d.z - MOUTH.z);

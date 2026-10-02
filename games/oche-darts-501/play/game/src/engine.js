// Oche Darts 501: the rules engine. Pure and deterministic: board geometry, scoring, double-out, bust,
// legs and the checkout table (computed, not typed in). No drawing, no input, no randomness.
//
// Board coordinates are millimetres on a standard board, origin at the bull, +x right, +y down,
// segment 20 straight up. Standard dimensions: bull 6.35, outer bull 15.9, treble 99-107, double 162-170.

export const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
export const MM = { bull: 6.35, outerBull: 15.9, trebleIn: 99, trebleOut: 107, doubleIn: 162, doubleOut: 170 };
const SEG = Math.PI / 10;

// What a dart at (x, y) mm scores. mult: 0 miss, 1 single, 2 double, 3 treble. The bull is 50 (a double), the outer bull 25.
export function hitAt(x, y) {
  const r = Math.hypot(x, y);
  if (r > MM.doubleOut) return { ring: 'miss', seg: 0, mult: 0, value: 0, label: 'Miss' };
  if (r <= MM.bull) return { ring: 'DB', seg: 25, mult: 2, value: 50, label: 'Bull' };
  if (r <= MM.outerBull) return { ring: 'SB', seg: 25, mult: 1, value: 25, label: '25' };
  const a = Math.atan2(x, -y);
  const idx = Math.floor((((a + SEG / 2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / SEG) % 20;
  const seg = ORDER[idx];
  if (r > MM.doubleIn) return { ring: 'D', seg, mult: 2, value: seg * 2, label: `D${seg}` };
  if (r > MM.trebleOut) return { ring: 'S', seg, mult: 1, value: seg, label: `${seg}` };
  if (r > MM.trebleIn) return { ring: 'T', seg, mult: 3, value: seg * 3, label: `T${seg}` };
  return { ring: 'S', seg, mult: 1, value: seg, label: `${seg}` };
}

// Distance in mm from (x, y) to the nearest wire (ring or radial), or Infinity inside the bull / outside the board.
export function wireDistance(x, y) {
  const r = Math.hypot(x, y);
  if (r > MM.doubleOut + 3) return Infinity;
  let d = Infinity;
  for (const rr of [MM.bull, MM.outerBull, MM.trebleIn, MM.trebleOut, MM.doubleIn, MM.doubleOut]) d = Math.min(d, Math.abs(r - rr));
  if (r > MM.outerBull) {
    const a = Math.atan2(x, -y);
    const k = (((a + SEG / 2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) % SEG;
    d = Math.min(d, Math.min(k, SEG - k) * r);
  }
  return d;
}

// ---- targets ---------------------------------------------------------------------------------------
// Every thing a player can aim at. `at` is the mm aim point (the middle of that region).
export const TARGETS = (() => {
  const list = [{ label: 'Bull', value: 50, mult: 2, seg: 25, dbl: true, at: [0, 0] }, { label: '25', value: 25, mult: 1, seg: 25, dbl: false, at: [0, -11] }];
  ORDER.forEach((seg, i) => {
    const a = i * SEG;
    const at = (r) => [Math.sin(a) * r, -Math.cos(a) * r];
    list.push({ label: `T${seg}`, value: seg * 3, mult: 3, seg, dbl: false, at: at(103) });
    list.push({ label: `D${seg}`, value: seg * 2, mult: 2, seg, dbl: true, at: at(166) });
    list.push({ label: `${seg}`, value: seg, mult: 1, seg, dbl: false, at: at(seg === 20 || seg === 19 || seg === 18 ? 133 : 134.5) });
  });
  return list;
})();
export const targetByLabel = (label) => TARGETS.find((t) => t.label === label);
export const prettyLabel = (label) => (label === 'Bull' ? 'Bull' : label.startsWith('T') ? `Treble ${label.slice(1)}` : label.startsWith('D') ? `Double ${label.slice(1)}` : label === '25' ? 'Outer bull' : `Single ${label}`);

// ---- checkout table -------------------------------------------------------------------------------
const DOUBLE_PREF = [20, 16, 8, 10, 12, 18, 4, 6, 14, 2, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
const doublePenalty = (t) => (t.label === 'Bull' ? 1.5 : DOUBLE_PREF.indexOf(t.seg) * 0.45);
const stepPenalty = (t) => {
  if (t.label === 'Bull') return 2.5;
  if (t.label === '25') return 3.2;
  if (t.mult === 3) return [0, 0.4, 0.9, 1.4, 1.9, 2.4, 2.9, 3.4, 3.9, 4.4, 4.9, 5.4, 5.9, 6.4, 6.9, 7.4, 7.9, 8.4, 8.9, 9.4, 9.9][20 - t.seg] ?? 6;
  if (t.mult === 2) return 6 + (20 - t.seg) * 0.1;
  return 4.6 + (20 - t.seg) * 0.12;
};
const DOUBLES = new Map(TARGETS.filter((t) => t.dbl).map((t) => [t.value, t]));
const NONDOUBLES = TARGETS.filter((t) => !t.dbl);
const STEPS = TARGETS;   // any target may be a non-final dart (a double can be a setup dart too)

const routeCache = new Map();
// The best way to finish exactly `rem` with at most `n` darts, ending on a double. null if there is none.
export function bestRoute(rem, n = 3) {
  if (rem < 2 || rem > 170 || n < 1) return null;
  const key = rem * 4 + n;
  if (routeCache.has(key)) return routeCache.get(key);
  let best = null, bestCost = Infinity;
  const consider = (route) => {
    const cost = route.length * 100 + route.reduce((s, t, i) => s + (i === route.length - 1 ? doublePenalty(t) : stepPenalty(t)), 0);
    if (cost < bestCost) { bestCost = cost; best = route; }
  };
  if (DOUBLES.has(rem)) consider([DOUBLES.get(rem)]);
  if (n >= 2) {
    for (const a of STEPS) {
      const r1 = rem - a.value;
      if (r1 >= 2 && DOUBLES.has(r1)) consider([a, DOUBLES.get(r1)]);
    }
  }
  if (n >= 3) {
    for (const a of STEPS) {
      const r1 = rem - a.value;
      if (r1 < 4) continue;
      for (const b of STEPS) {
        const r2 = r1 - b.value;
        if (r2 >= 2 && DOUBLES.has(r2)) consider([a, b, DOUBLES.get(r2)]);
      }
    }
  }
  routeCache.set(key, best);
  return best;
}
export const canFinish = (rem, n = 3) => bestRoute(rem, n) !== null;

// A cost for being left on `rem` before a visit (lower is better): used to choose setup darts.
function leaveCost(rem) {
  if (rem < 2) return 999;
  const r = bestRoute(rem, 3);
  if (!r) return rem > 170 ? 60 + (rem - 170) * 0.05 : 90;
  const last = r[r.length - 1];
  return r.length * 14 + doublePenalty(last) * 2;
}

// What to aim for with `dartsLeft` darts in hand: { kind: 'finish' | 'setup' | 'score', route: [targets], text }
export function suggest(rem, dartsLeft = 3) {
  const r = bestRoute(rem, dartsLeft);
  if (r) return { kind: 'finish', route: r, text: r.map((t) => t.label).join('  ') };
  // cannot finish now: aim at the dart that leaves the best next visit
  let best = null, bestCost = Infinity;
  for (const t of TARGETS) {
    const left = rem - t.value;
    if (left < 2) continue;
    const harder = t.mult === 3 ? 3.5 : t.label === 'Bull' ? 6 : t.dbl ? 7 : t.label === '25' ? 4.5 : 0;
    const cost = leaveCost(left) + harder - (t.seg === 20 ? 0.6 : t.seg >= 17 ? 0.3 : 0);
    if (cost < bestCost) { bestCost = cost; best = t; }
  }
  if (rem > 100 || !best) { const t = rem > 170 || !best ? targetByLabel('T20') : best; return { kind: 'score', route: [t], text: t.label }; }
  return { kind: 'setup', route: [best], text: best.label };
}

// ---- match -----------------------------------------------------------------------------------------
const blankStats = () => ({ darts: 0, points: 0, visits: 0, hi: 0, c180: 0, c100: 0, bestOut: 0, legsWon: 0, bounce: 0, busts: 0, dblTried: 0, dblHit: 0 });

export function newMatch(cfg) {
  const c = { start: 501, legs: 2, first: 0, ...cfg };
  const m = { cfg: c, rem: [c.start, c.start], legsWon: [0, 0], starter: c.first, turn: c.first, legNo: 1, stats: [blankStats(), blankStats()], visit: null, over: null, lastLeg: null, log: [] };
  m.visit = freshVisit(m);
  return m;
}
const freshVisit = (m) => ({ darts: [], startRem: m.rem[m.turn], total: 0, bust: false, done: false, won: false });
export const dartsLeft = (m) => 3 - m.visit.darts.length;
export const visitScore = (m) => m.visit.darts.reduce((s, d) => s + d.value, 0);
export const avg3 = (st) => (st.darts ? (st.points / st.darts) * 3 : 0);

// Record one dart. d = { label, value, mult, seg, bounced }. Returns what happened.
export function applyDart(m, d) {
  const v = m.visit, side = m.turn, st = m.stats[side];
  st.darts++;
  const before = m.rem[side];
  const onDouble = before <= 40 && before % 2 === 0 || before === 50;
  if (onDouble && before >= 2) { st.dblTried++; if (d.value === before && d.mult === 2) st.dblHit++; }
  if (d.bounced) { st.bounce++; v.darts.push({ ...d, value: 0, mult: 0, label: 'Out' }); return finishDartCheck(m, { kind: 'bounce' }); }
  const left = before - d.value;
  if (left < 0 || left === 1 || (left === 0 && d.mult !== 2)) {
    v.darts.push({ ...d, busted: true });
    v.bust = true; v.done = true; m.rem[side] = v.startRem; st.busts++;
    return { kind: 'bust', why: left === 0 ? 'Finish on a double' : left === 1 ? 'Cannot leave 1' : 'Over the score' };
  }
  v.darts.push({ ...d });
  m.rem[side] = left;
  if (left === 0) { v.done = true; v.won = true; return { kind: 'leg' }; }
  return finishDartCheck(m, { kind: 'score' });
}
function finishDartCheck(m, res) {
  if (m.visit.darts.length >= 3) m.visit.done = true;
  return res;
}

// Close the visit: update the averages and report what to show. Does not change whose turn it is.
export function closeVisit(m) {
  const v = m.visit, side = m.turn, st = m.stats[side];
  const pts = v.bust ? 0 : v.startRem - m.rem[side];
  v.total = pts;
  // the darts a busted visit did not throw still count against nobody; only darts actually thrown count
  st.points += pts;
  st.visits++;
  if (pts > st.hi) st.hi = pts;
  if (pts === 180) st.c180++;
  if (pts >= 100) st.c100++;
  if (v.won) { st.bestOut = Math.max(st.bestOut, pts); }
  return { side, pts, bust: v.bust, won: v.won, darts: v.darts.length };
}

// After a visit (not a won leg): hand the oche to the other player.
export function nextTurn(m) {
  m.turn = 1 - m.turn;
  m.visit = freshVisit(m);
}

// The leg was won by the current thrower. Returns true if that wins the match.
export function winLeg(m) {
  const w = m.turn;
  m.legsWon[w]++;
  m.stats[w].legsWon++;
  m.log.push({ leg: m.legNo, winner: w });
  m.lastLeg = { winner: w };
  if (m.legsWon[w] >= m.cfg.legs) { m.over = { win: w }; return true; }
  return false;
}

export function startNextLeg(m) {
  m.legNo++;
  m.starter = 1 - m.starter;
  m.rem = [m.cfg.start, m.cfg.start];
  m.turn = m.starter;
  m.visit = freshVisit(m);
}

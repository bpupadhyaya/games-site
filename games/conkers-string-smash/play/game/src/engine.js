// The rules of a conker duel, kept apart from the physics (sim.js) and the screens. Pure functions over plain data, so a whole duel can be
// replayed headless. A duel is two conkers, a striker and a defender; the striker gets up to three goes, a go that touches ends the turn.
export const GOES = 3;          // swings the striker may make in one turn if they keep missing
export const DAMAGE_BASE = 13;   // bigger = a tougher world: hits needed to crack a conker
export const WEAK_BONUS = 1.9;  // extra damage when the pale patch takes the hit (the weak spot)
export const WEAK_FLOOR = 0.6; // damage factor of a hit on the far side of the conker

// The kinds of conker in the tin. `mass` makes a harder swing, `tough` is how much punishment it takes, `hard` is how much it hurts the other.
export const KINDS = [
  { id: 'fresh', name: 'Fresh green', mass: 0.95, tough: 0.95, hard: 0.95, short: 'Quick and lively, cracks sooner.' },
  { id: 'seasoned', name: 'Seasoned', mass: 1.0, tough: 1.2, hard: 1.08, short: 'Kept to dry: tougher and sharper.' },
  { id: 'heavy', name: 'Big heavy', mass: 1.18, tough: 1.0, hard: 1.0, short: 'The biggest in the tin: swings hardest.' },
];
export const kindOf = (id) => KINDS.find((k) => k.id === id) ?? KINDS[1];

// Names for a conker by the number of wins it carries (the playground way).
const NAMES = ['none-er', 'oner', 'twoer', 'threeer', 'fourer', 'fifer', 'sixer', 'sevener', 'eighter', 'niner', 'tenner'];
export const countName = (n) => (n >= 0 && n < NAMES.length ? NAMES[n] : `${n}er`);
export const countLabel = (n) => (n === 0 ? 'a none-er' : `a ${countName(n)}`);

export function newConker(kindId, count = 0, extra = {}) {
  return { kind: kindId, count, dmg: 0, psi: 0, ...extra };
}
export const statsOf = (c) => {
  const k = kindOf(c.kind), t = c.toughMul ?? 1;
  return { mass: k.mass, tough: k.tough * t, hard: k.hard };
};
export const stageOf = (c) => (c.dmg >= 1 ? 4 : c.dmg >= 0.72 ? 3 : c.dmg >= 0.42 ? 2 : c.dmg >= 0.14 ? 1 : 0);   // 0 clean .. 3 badly cracked, 4 shattered
export const STAGE_NAMES = ['Sound', 'Hairline crack', 'Cracked', 'Splitting', 'Shattered'];

// The weak spot: the pale patch. `psi` = where it faces on the conker (0 = along the string away from the hand, so down at rest; +pi/2 = toward the
// opponent). Angles below are in the "toward the opponent" frame: 0 = straight at the opponent, +pi/2 = up, -pi/2 = down.
export const PATCH_WIDTH = 0.8;   // radians either side of the patch centre that still count
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
export const patchAngle = (psi, phiToward) => wrap(-Math.PI / 2 + psi + phiToward);
export function weakFactor(patchAng, contactAng) {
  const x = Math.max(0, 1 - Math.abs(wrap(patchAng - contactAng)) / PATCH_WIDTH);
  return WEAK_FLOOR + WEAK_BONUS * x * x * (3 - 2 * x);
}

// The damage one touch does to each conker. hit = { E, nx, ny, phiS, phiD } from the physics (n points from the defender to the striker).
export function touchDamage(hit, cs, cd, roll = 1) {
  const a = statsOf(cs), b = statsOf(cd);
  const wS = weakFactor(patchAngle(cs.psi, hit.phiS), Math.atan2(hit.ny, -hit.nx));
  const wD = weakFactor(patchAngle(cd.psi, -hit.phiD), Math.atan2(-hit.ny, -hit.nx));
  const dD = (hit.E * wD * (0.55 + 0.45 * a.hard) * roll) / (b.tough * DAMAGE_BASE);
  const dS = (hit.E * wS * (0.55 + 0.45 * b.hard) * roll) / (a.tough * DAMAGE_BASE);
  return { dS, dD, wS, wD };
}

export function newDuel(a, b, first = 0, extra = {}) {
  return { c: [a, b], striker: first, goes: 0, goesMax: GOES, turns: 1, touches: [0, 0], swings: [0, 0], over: null, last: null, ...extra };
}
export const defenderOf = (d) => 1 - d.striker;

function endTurn(d) { d.striker = 1 - d.striker; d.goes = 0; d.turns++; }

// Apply a finished swing. `touches` = the hits the physics found, `rolls` = a random factor per hit (0.92..1.08). Returns a summary.
export function applySwing(d, touches, rolls = []) {
  const si = d.striker, di = 1 - si, cs = d.c[si], cd = d.c[di];
  d.swings[si]++;
  const sum = { hit: touches.length > 0, striker: si, dS: 0, dD: 0, E: 0, shattered: -1, weak: false, solid: 0, miss: touches.length === 0 };
  touches.forEach((h, i) => {
    const t = touchDamage(h, cs, cd, rolls[i] ?? 1);
    sum.dS += t.dS; sum.dD += t.dD; sum.E += h.E;
    if (t.wD > 1.45) sum.weak = true;
    sum.wD = t.wD; sum.wS = t.wS;
  });
  if (sum.hit) {
    d.touches[si]++;
    cs.dmg += sum.dS; cd.dmg += sum.dD;
    sum.solid = sum.E > 1.4 ? 2 : sum.E > 0.55 ? 1 : 0;
    // both would break in the same touch: the one that was struck breaks, the swinger's survives with a split
    if (cs.dmg >= 1 && cd.dmg >= 1) cs.dmg = 0.97;
    if (cd.dmg >= 1) { sum.shattered = di; d.over = { loser: di, winner: si }; }
    else if (cs.dmg >= 1) { sum.shattered = si; d.over = { loser: si, winner: di }; }
    if (!d.over) endTurn(d); else d.goes = 0;
  } else {
    d.goes++;
    if (d.goes >= d.goesMax) endTurn(d);
  }
  sum.turnOver = d.striker !== si;
  d.last = sum;
  return sum;
}

// The winner carries the loser's wins and one more (a conker that beat a fifer is itself a sixer or more).
export function awardWin(d) {
  if (!d.over || d.over.awarded) return 0;
  const w = d.c[d.over.winner], l = d.c[d.over.loser];
  const gain = l.count + 1;
  w.count += gain;
  d.over.awarded = true; d.over.gain = gain;
  return gain;
}

// ---- the tournament: a tin of three conkers, four rivals in turn -------------------------------------------------------------------------
export const RIVALS = [
  { name: 'Wren', tag: 'Plays after school; swings wide and hopes', stars: 1, kind: 'fresh', count: 0, toughMul: 0.9, sway: 0.03, skill: 0 },
  { name: 'Hazel', tag: 'Never misses twice in a row', stars: 2, kind: 'seasoned', count: 1, toughMul: 0.95, sway: 0.055, skill: 1 },
  { name: 'Rowan', tag: 'Reads the pale patch and waits for the sway', stars: 3, kind: 'heavy', count: 3, toughMul: 1.0, sway: 0.075, skill: 2 },
  { name: 'Old Alder', tag: 'A sixer in the pocket and patience to spare', stars: 4, kind: 'seasoned', count: 6, toughMul: 1.1, sway: 0.095, skill: 3 },
];
export const CUP_ROUNDS = RIVALS.length;

export function newTin() {
  return KINDS.map((k) => newConker(k.id, 0));
}
export function rivalConker(i) {
  const r = RIVALS[i];
  return newConker(r.kind, r.count, { toughMul: r.toughMul });
}
export function newCup() {
  return { tin: newTin(), round: 0, wins: 0, lost: 0, picked: -1, done: false, champion: false, best: 0 };
}
export const tinLeft = (cup) => cup.tin.filter((c) => c.dmg < 1).length;
export const cupBestCount = (cup) => Math.max(0, ...cup.tin.map((c) => c.count));

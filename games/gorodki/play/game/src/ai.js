// The computer players and the hints. A player plans a throw by trying many (style, landing point) pairs on copies of the town with the
// real physics, then picks by its level: the best plan, or one of the better ones. No randomness inside the planning itself; the
// level's choice and the throw scatter use the rng the caller passes in.
import { STYLES, STYLE_IDS, AIM, SQ, simulate, edgeDist, inPlay, countIn } from './sim.js';

export const RIVALS = [
  { id: 'mitya', name: 'Mitya', stars: 1, tag: 'Still learning', pick: 12, scatter: 2.3, slip: 0.18, think: 1.1 },
  { id: 'varya', name: 'Varya', stars: 2, tag: 'Steady hands', pick: 6, scatter: 1.5, slip: 0.06, think: 1.3 },
  { id: 'grisha', name: 'Grisha', stars: 3, tag: 'Reads the figure', pick: 3, scatter: 1.1, slip: 0, think: 1.5 },
  { id: 'pavel', name: 'Old Pavel', stars: 4, tag: 'Plays it all year', pick: 1, scatter: 0.8, slip: 0, think: 1.7 },
];

// How good a finished throw is: pins out, a big bonus for clearing the figure, and a small push for leaving the rest near the edge.
const objective = (r) => {
  const rest = inPlay(r.w);
  let o = r.out + (rest.length === 0 ? 3 : 0);
  for (const p of rest) o -= 0.08 * Math.max(0, edgeDist(p));
  return o;
};

const GX = []; for (let x = -1.05; x <= 1.051; x += 0.15) GX.push(Math.round(x * 100) / 100);
const GZ = []; for (let z = -0.6; z <= 1.61; z += 0.2) GZ.push(Math.round(z * 100) / 100);

function jitterSet(style, k) {
  const S = STYLES[style];
  return [[0, 0], [S.sx * k, 0], [-S.sx * k, 0], [0, S.sz * k], [0, -S.sz * k]];
}
function robust(w, style, aim, k) {
  let sum = 0, out = 0, left = 0, first = -1;
  const js = jitterSet(style, k);
  js.forEach(([dx, dz], i) => {
    const r = simulate(w, style, aim, { dx, dz, dth: 0 });
    sum += objective(r); out += r.out; left += r.left;
    if (i === 0) first = r.first;
  });
  return { score: sum / js.length, out: out / js.length, left: left / js.length, first };
}

// All candidate throws for this town, best first. `k` scales the scatter the plan guards against.
export function rank(w, k = 1) {
  const coarse = [];
  for (const style of STYLE_IDS) for (const x of GX) for (const z of GZ) {
    const r = simulate(w, style, { x, z });
    coarse.push({ style, x, z, o: objective(r), out: r.out, first: r.first });
  }
  coarse.sort((a, b) => b.o - a.o);
  const top = [];
  const seen = [];
  for (const c of coarse) {
    if (top.length >= 14) break;
    if (seen.some((s) => s.style === c.style && Math.abs(s.x - c.x) < 0.2 && Math.abs(s.z - c.z) < 0.3)) continue;   // distinct ideas only
    seen.push(c);
    // refine around the coarse point, then judge it against the scatter
    let best = null;
    for (const dx of [-0.07, 0, 0.07]) for (const dz of [-0.1, 0, 0.1]) {
      const aim = { x: Math.max(AIM.x0, Math.min(AIM.x1, c.x + dx)), z: Math.max(AIM.z0, Math.min(AIM.z1, c.z + dz)) };
      const r = robust(w, c.style, aim, k);
      if (!best || r.score > best.score) best = { style: c.style, x: aim.x, z: aim.z, ...r };
    }
    top.push(best);
  }
  top.sort((a, b) => b.score - a.score);
  return top;
}

// A computer player's choice for this town: { style, x, z, out, left, first, plans } and the noise multiplier for the throw.
export function choose(w, rival, rng) {
  const plans = rank(w, rival.scatter);
  const n = Math.max(1, Math.min(plans.length, rival.pick));
  let pick = plans[0];
  if (n > 1) {
    // weighted towards the best: the first plan is twice as likely as the last of the shortlist
    const weights = []; for (let i = 0; i < n; i++) weights.push(1 + (n - 1 - i) / n);
    let r = rng.next() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < n; i++) { r -= weights[i]; if (r <= 0) { pick = plans[i]; break; } }
  }
  let { x, z } = pick;
  if (rival.slip > 0 && rng.chance(rival.slip)) { x += (rng.next() - 0.5) * 0.7; z += (rng.next() - 0.5) * 0.6; }
  return { style: pick.style, x: Math.max(AIM.x0, Math.min(AIM.x1, x)), z: Math.max(AIM.z0, Math.min(AIM.z1, z)), out: pick.out, left: pick.left, first: pick.first, plans, scatter: rival.scatter };
}

// One throw's scatter: a bell-ish random number (sum of three uniforms) times the style's own spread and the player's level.
export function scatterFor(rng, style, k = 1) {
  const S = STYLES[style];
  const b = () => (rng.next() + rng.next() + rng.next() - 1.5) / 0.75;
  return { dx: b() * S.sx * k, dz: b() * S.sz * k, dth: b() * 0.12 * k };
}
export const HUMAN_K = 1;

// Advice for the human: the best plan with a sentence on why.
export function advise(w, pins) {
  const plans = rank(w, HUMAN_K);
  const p = plans[0];
  return { ...p, text: describe(w, p, pins) };
}

// Words for a plan: which pin the bat meets first (by place in the figure), and what to expect.
export function describe(w, plan, pins) {
  const S = STYLES[plan.style];
  const live = inPlay(w);
  const total = live.length;
  let where = 'the figure';
  const f = live.find((p) => p.id === plan.first);
  if (f && live.length > 1) {
    const xs = live.map((p) => p.x), zs = live.map((p) => p.z);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    const fx = x1 - x0 < 0.05 ? 0.5 : (f.x - x0) / (x1 - x0), fz = z1 - z0 < 0.05 ? 0.5 : (f.z - z0) / (z1 - z0);
    const h = fx < 0.34 ? 'left' : fx > 0.66 ? 'right' : 'middle';
    const d = fz < 0.34 ? 'front' : fz > 0.66 ? 'back' : 'centre';
    where = d === 'centre' && h === 'middle' ? 'the pin in the centre' : d === 'centre' ? `the ${h} pin` : h === 'middle' ? `the ${d} pin` : `the ${d} ${h} pin`;
  } else if (f) where = 'the last pin';
  const exp = Math.round(plan.out);
  const lead = plan.style === 'sweep' ? 'Sweep through' : plan.style === 'drive' ? 'Drive at' : 'Smash into';
  const tail = exp >= total ? 'This can clear the whole figure.' : `Expect about ${exp} of ${total} out.`;
  return { where, text: `${S.name}: ${lead.toLowerCase().startsWith('sweep') ? 'land just short of' : 'land in front of'} ${where}. ${tail}`, lead, expect: exp, total, style: plan.style };
}
export { SQ, countIn };

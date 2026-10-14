// The computer wrestlers and the coach. A wrestler enumerates every legal move, models what the rival is likely to do (what a rival
// in this spot would sensibly do, blended with the habits seen in the last beats), and picks by expected result, with a
// profile-dependent amount of noise and mistakes. The coach is the same chooser with a clear head: it feeds Think and Watch & Learn.
import { KINDS, NDIR, POWERS, predict, legalMove, norm, DIR_NAMES, techniqueName, dirVec, gripCost, GRIP_MAX } from './sim.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const PROFILES = [
  { name: 'Minjae', cls: 'Taebaek', tag: 'Quick and light, tends to repeat', stars: 1, temp: 0.55, mem: 0.0, slip: 0.22, bold: 0.9, build: 0.82 },
  { name: 'Yuna', cls: 'Geumgang', tag: 'Hooks when you over-commit', stars: 2, temp: 0.38, mem: 0.15, slip: 0.12, bold: 0.7, build: 0.92 },
  { name: 'Seojun', cls: 'Halla', tag: 'Patient, roots and waits', stars: 3, temp: 0.26, mem: 0.3, slip: 0.07, bold: 0.45, build: 1.04 },
  { name: 'Haneul', cls: 'Baekdu', tag: 'Reads your habits', stars: 4, temp: 0.16, mem: 0.5, slip: 0.04, bold: 0.6, build: 1.14 },
  { name: 'Doyun', cls: 'Grand Champion', tag: 'Hard to read, harder to move', stars: 5, temp: 0.09, mem: 0.58, slip: 0.015, bold: 0.55, build: 1.22 },
];
export const COACH = { name: 'Coach', temp: 0.05, mem: 0.45, slip: 0, bold: 0.6 };

export function allMoves(F, s) {
  const out = [];
  for (const kind of KINDS) for (let dir = 0; dir < NDIR; dir++) for (const pow of POWERS) {
    const m = { kind, dir, pow };
    if (legalMove(F, s, m)) out.push(m);
  }
  return out;
}

// Result of a beat from side `s`'s view, in about -10 .. 10.
function value(F, s, a, b) {
  const moves = s === 0 ? [a, b] : [b, a];
  const r = predict(F, moves), o = 1 - s;
  const me = norm(r.p[s]), th = norm(r.p[o]);
  if (me >= 1 || th >= 1) {
    if (me >= 1 && th >= 1) return Math.abs(me - th) < 0.02 ? 0 : me > th ? -8 : 8;
    return me >= 1 ? -9 : 9;
  }
  const edge = (d) => d * d * d;
  const gripEdge = (r.grip[s] - r.grip[o]) * 0.07;
  return (edge(th) * 2.4 - edge(me) * 2.6) + (th - me) * 1.2 + gripEdge - (r.nudged[s] ? 0.9 : 0) + (r.nudged[o] ? 0.7 : 0);
}

// How the rival's recent moves colour what we expect next (older beats count less).
function habits(F, s) {
  const o = 1 - s, w = new Map();
  let k = 1;
  for (let i = F.log.length - 1; i >= 0 && k > 0.12; i--, k *= 0.72) {
    const m = F.log[i].moves[o];
    for (let d = 0; d < NDIR; d++) {
      const dd = Math.min((d - m.dir + 8) % 8, (m.dir - d + 8) % 8);
      const kern = dd === 0 ? 1 : dd === 1 ? 0.45 : dd === 2 ? 0.1 : 0;
      for (const kind of KINDS) {
        const kk = (kind === m.kind ? 1 : 0.18) * kern * k;
        if (kk <= 0) continue;
        for (const pow of POWERS) { const key = `${kind}${d}${pow}`; w.set(key, (w.get(key) ?? 0) + kk * (pow === m.pow ? 1 : 0.6)); }
      }
    }
  }
  return w;
}

function softmax(vals, temp) {
  const mx = Math.max(...vals), e = vals.map((v) => Math.exp((v - mx) / Math.max(0.02, temp)));
  const t = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / t);
}

// Rival model: sensible moves (against a neutral guess of ours), mixed with habits.
function rivalModel(F, s, prof, mine) {
  const o = 1 - s, theirs = allMoves(F, o);
  const sample = mine.length > 14 ? mine.filter((_, i) => i % Math.ceil(mine.length / 14) === 0) : mine;
  const u = theirs.map((b) => sample.reduce((acc, a) => acc + value(F, o, b, a), 0) / sample.length);
  const prior = softmax(u, 0.55);
  const h = habits(F, s);
  let hs = 0; const emp = theirs.map((m) => { const v = h.get(`${m.kind}${m.dir}${m.pow}`) ?? 0; hs += v; return v; });
  const mem = hs > 0.2 ? prof.mem : 0;
  return { theirs, w: theirs.map((_, i) => (1 - mem) * prior[i] + mem * (hs > 0 ? emp[i] / hs : 0)) };
}

// Pick a move for side s. rng is a kit rng fork (or null for a deterministic best move).
export function chooseMove(F, s, prof, rng) {
  const mine = allMoves(F, s);
  const { theirs, w } = rivalModel(F, s, prof, mine);
  const ev = mine.map((a) => theirs.reduce((acc, b, i) => acc + w[i] * value(F, s, a, b), 0));
  // nobody likes to be cautioned: the third brace in a row is only taken when it is clearly best
  if (F.streak[s] >= 2) mine.forEach((m, i) => { if (m.kind === 'brace') ev[i] -= 1.2; });
  // boldness changes how the wrestler weighs spending grip
  mine.forEach((m, i) => { ev[i] -= (1 - prof.bold) * gripCost(m) * 0.35 * (1 - 0.0); });
  let k;
  if (!rng) k = ev.indexOf(Math.max(...ev));
  else {
    if (rng.next() < prof.slip) k = rng.int(mine.length);
    else { const p = softmax(ev, prof.temp * 3); let r = rng.next(); k = 0; for (let i = 0; i < p.length; i++) { r -= p[i]; if (r <= 0) { k = i; break; } k = i; } }
  }
  return { move: mine[k], ev: ev[k], best: ev.indexOf(Math.max(...ev)), mine, evs: ev, rivalLikely: likelyMove(theirs, w) };
}
function likelyMove(theirs, w) { let bi = 0; w.forEach((v, i) => { if (v > w[bi]) bi = i; }); return theirs[bi] ?? null; }

export function createDriver(prof, rng) {
  return { prof, choose: (F, s) => chooseMove(F, s, prof, rng).move };
}

// ---- words for Think / Watch & Learn -------------------------------------------------------------------------------------
const pct = (v) => `${Math.round(clamp(v, 0, 1) * 100)}%`;
const dirWord = (d) => DIR_NAMES[((d % 8) + 8) % 8];
// nearest of the 8 petals to a vector
export function nearestDir(v) {
  if (Math.hypot(v.x, v.y) < 0.02) return 0;
  const a = Math.atan2(v.x, v.y); // 0 = forward, clockwise positive
  return (((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8);
}

export function coachMove(F, s) {
  const c = chooseMove(F, s, COACH, null);
  return c;
}

export function explainMove(F, s, m, ctx = {}) {
  const o = 1 - s, me = norm(F.p[s]), th = norm(F.p[o]);
  const tech = techniqueName(m.kind, m.dir);
  const power = ['light', 'firm', 'full'][m.pow - 1];
  const likely = ctx.rivalLikely;
  if (m.kind === 'brace') {
    if (F.streak[s] >= 2) return { title: `Root ${dirWord(m.dir)}`, text: 'You have rooted twice running: a third in a row is a caution and a step back. Root only if you must; otherwise attack next.' };
    const why = likely && likely.kind !== 'brace' ? `They are most likely to send you ${dirWord(likely.dir)}.` : `Your balance is at ${pct(me)} of the edge.`;
    return { title: `Root ${dirWord(m.dir)}, ${power}`, text: `${why} Bracing against that direction soaks up the pull and settles your dot. A hook would still get through, so do not stay rooted for long.` };
  }
  if (m.kind === 'hook') {
    const why = th > 0.35 ? `Their dot is already ${pct(th)} of the way out` : (F.last[o] && F.last[o].kind === 'pull' ? 'They just pulled, so their weight is committed' : 'They look set to pull');
    return { title: `${tech}, ${power}`, text: `${why}: a hook ignores their brace and catches a loaded wrestler. Against a centred one it whiffs and costs you balance.` };
  }
  const edgeNote = th > 0.5 ? `Their dot is ${pct(th)} out toward the ${dirWord(nearestDir(F.p[o]))} edge, so ` : '';
  const brace = likely && likely.kind === 'brace' ? ' They may root, so keep some grip in hand.' : '';
  const cost = gripCost(m) > 0 ? ` It costs ${gripCost(m)} grip.` : ' It is free.';
  return { title: `${tech}, ${power}`, text: `${edgeNote}send their balance ${dirWord(m.dir)}.${cost}${brace}`.replace(/^s/, 'S') };
}

export function moveLabel(m) {
  return `${m.kind === 'pull' ? 'Pull' : m.kind === 'hook' ? 'Hook' : 'Root'} ${dirWord(m.dir)} (${['light', 'firm', 'full'][m.pow - 1]})`;
}
export { dirVec, GRIP_MAX };

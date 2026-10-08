// Tale engine: pure functions over a session object. No drawing, no clock, no global randomness.
// A session walks   intro -> (tell -> solve -> after) x4 -> moral -> over.   Puzzles are built from content.js data;
// every shuffle comes from a seeded generator, so a saved seed + beat rebuilds the very same tale.
import { TALES } from './content.js';

export function seedRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffled(n, rnd, avoidIdentity = true) {
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let tries = 0; tries < 6; tries++) {
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    if (!avoidIdentity || n < 3 || idx.some((v, i) => v !== i)) break;
  }
  return idx;
}

export const PHASES = ['intro', 'tell', 'solve', 'after', 'moral', 'over'];
export const beatOf = (P) => TALES[P.tale].beats[P.beat];
export const puzzleOf = (P) => beatOf(P).puzzle;

export function newSession({ seed, tale }) {
  return { seed: seed >>> 0, tale, beat: 0, phase: 'intro', pz: null, misses: 0, hints: 0, hintStage: 0, hintText: null, t: 0, done: false };
}

// ---- building a puzzle -----------------------------------------------------------------------------------------------------------
export function buildPuzzle(P) {
  const def = puzzleOf(P), rnd = seedRng(P.seed + P.tale * 7919 + P.beat * 104729 + 17);
  const base = { kind: def.kind, solved: false, msg: null, msgKind: 'bad', shake: -1, shakeT: 0, flashT: 0, miss: 0 };
  if (def.kind === 'choose') return { ...base, order: shuffled(def.options.length, rnd, false), out: [], right: -1 };
  if (def.kind === 'order') return { ...base, deck: shuffled(def.steps.length, rnd), placed: [] };
  if (def.kind === 'match') {
    const n = def.pairs.length;
    let L = shuffled(n, rnd), R = shuffled(n, rnd);
    for (let tries = 0; tries < 8 && L.some((v, i) => v === R[i]); tries++) R = shuffled(n, rnd);
    return { ...base, L, R, locked: [], sel: -1, wrongL: -1, wrongR: -1 };
  }
  return { ...base, order: shuffled(def.tools.length, rnd, false), used: [], flags: [] };
}

export function startBeat(P) { P.pz = buildPuzzle(P); P.hintStage = 0; P.hintText = null; }

// ---- actions: each returns { ok, solved, miss } and sets pz.msg for the panel -------------------------------------------------------
function miss(P, pz, text, shake = -1) { P.misses += 1; pz.miss += 1; pz.msg = text; pz.msgKind = 'bad'; pz.shake = shake; pz.shakeT = 0.45; return { ok: false, miss: true, solved: false }; }

export function tapChoose(P, k) {
  const pz = P.pz, def = puzzleOf(P);
  if (pz.solved) return { ok: false };
  const o = pz.order[k]; if (o === undefined || pz.out.includes(o)) return { ok: false };
  const opt = def.options[o];
  if (opt.ok) { pz.solved = true; pz.right = o; pz.msg = opt.why; pz.msgKind = 'good'; pz.flashT = 0.6; P.hintText = null; return { ok: true, solved: true }; }
  pz.out.push(o);
  return miss(P, pz, opt.why, o);
}
export function tapOrder(P, s) {
  const pz = P.pz, def = puzzleOf(P);
  if (pz.solved || pz.placed.includes(s)) return { ok: false };
  if (s === pz.placed.length) {
    pz.placed.push(s); pz.msg = null; pz.flashT = 0.4;
    if (pz.placed.length === def.steps.length) { pz.solved = true; pz.msg = def.explain; pz.msgKind = 'good'; P.hintText = null; return { ok: true, solved: true }; }
    return { ok: true, solved: false };
  }
  return miss(P, pz, def.steps[s].early, s);
}
export function tapMatchLeft(P, p) {
  const pz = P.pz; if (pz.solved || pz.locked.includes(p)) return { ok: false };
  pz.sel = pz.sel === p ? -1 : p; pz.msg = null; return { ok: true, select: true };
}
export function tapMatchRight(P, p) {
  const pz = P.pz, def = puzzleOf(P);
  if (pz.solved || pz.locked.includes(p)) return { ok: false };
  if (pz.sel < 0) { pz.msg = 'Pick a card on the left first.'; pz.msgKind = 'info'; return { ok: false }; }
  if (pz.sel === p) {
    pz.locked.push(p); pz.sel = -1; pz.msg = null; pz.flashT = 0.4;
    if (pz.locked.length === def.pairs.length) { pz.solved = true; pz.msg = def.explain; pz.msgKind = 'good'; P.hintText = null; return { ok: true, solved: true }; }
    return { ok: true, solved: false };
  }
  const wl = pz.sel; pz.sel = -1; pz.wrongL = wl; pz.wrongR = p;
  return miss(P, pz, `${def.pairs[wl][0].startsWith('pat:') ? 'That pattern' : '\u201c' + def.pairs[wl][0] + '\u201d'} does not go with \u201c${def.pairs[p][1]}\u201d. Think about what each one does, then try another.`, -1);
}
export function toolReady(def, pz, t) { return !!t.sets && t.needs.every((f) => pz.flags.includes(f)); }
export function tapTrap(P, ti) {
  const pz = P.pz, def = puzzleOf(P), t = def.tools[ti];
  if (pz.solved || pz.used.includes(ti)) return { ok: false };
  if (toolReady(def, pz, t)) {
    pz.used.push(ti); for (const f of t.sets) if (!pz.flags.includes(f)) pz.flags.push(f);
    pz.msg = null; pz.flashT = 0.45;
    if (def.goal.every((f) => pz.flags.includes(f))) { pz.solved = true; pz.msg = def.explain; pz.msgKind = 'good'; P.hintText = null; return { ok: true, solved: true }; }
    return { ok: true, solved: false };
  }
  return miss(P, pz, t.fail ?? 'That step needs something else done first.', ti);
}

// ---- hints ----------------------------------------------------------------------------------------------------------------------------
// target: what to highlight on the second hint step, in the same ids the panel uses.
export function nextTarget(P) {
  const pz = P.pz, def = puzzleOf(P);
  if (!pz || pz.solved) return null;
  if (pz.kind === 'choose') return { kind: 'choose', opt: def.options.findIndex((o) => o.ok) };
  if (pz.kind === 'order') return { kind: 'order', step: pz.placed.length };
  if (pz.kind === 'match') {
    // finish the pair in progress, else the first unlocked pair in the current left column order
    const p = pz.sel >= 0 ? pz.sel : pz.L.find((q) => !pz.locked.includes(q));
    return { kind: 'match', pair: p };
  }
  const ti = def.tools.findIndex((t, i) => !pz.used.includes(i) && toolReady(def, pz, t) && t.sets.some((f) => !pz.flags.includes(f)));
  return { kind: 'trap', tool: ti };
}
export function hintStep(P) {
  // 0 -> nudge (counts one hint), 1 -> highlight (counts one more), 2 -> close
  if (P.hintStage === 0) { P.hintStage = 1; P.hints += 1; P.hintText = puzzleOf(P).hint; return 1; }
  if (P.hintStage === 1) { P.hintStage = 2; P.hints += 1; return 2; }
  P.hintStage = 0; P.hintText = null; return 0;
}

// Performs the next correct action (used by Watch and Learn and by dev tools). Returns the action description or null.
export function autoAct(P) {
  const t = nextTarget(P); if (!t) return null;
  const pz = P.pz;
  if (t.kind === 'choose') { const o = t.opt, k = pz.order.indexOf(o); return { r: tapChoose(P, k), target: t }; }
  if (t.kind === 'order') return { r: tapOrder(P, t.step), target: t };
  if (t.kind === 'match') {
    if (pz.sel !== t.pair) { const r = tapMatchLeft(P, t.pair); return { r, target: { ...t, part: 'left' } }; }
    return { r: tapMatchRight(P, t.pair), target: { ...t, part: 'right' } };
  }
  return { r: tapTrap(P, t.tool), target: t };
}
export const solvedAll = (P) => P.pz && P.pz.solved;

// ---- flow -----------------------------------------------------------------------------------------------------------------------------
export function advance(P) {
  const tale = TALES[P.tale];
  if (P.phase === 'intro') { P.phase = 'tell'; startBeat(P); return; }
  if (P.phase === 'tell') { P.phase = 'solve'; return; }
  if (P.phase === 'solve') { if (P.pz.solved) P.phase = 'after'; return; }
  if (P.phase === 'after') {
    if (P.beat + 1 < tale.beats.length) { P.beat += 1; P.phase = 'tell'; startBeat(P); } else { P.phase = 'moral'; P.pz = null; }
    return;
  }
  if (P.phase === 'moral') { P.phase = 'over'; P.done = true; }
}
export const starsFor = (P) => (P.misses <= 1 && P.hints === 0 ? 3 : P.misses <= 5 && P.hints <= 2 ? 2 : 1);
export const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
export const narrationOf = (P) => {
  const tale = TALES[P.tale], b = tale.beats[P.beat];
  if (P.phase === 'intro') return { who: 'The storyteller', text: tale.intro };
  if (P.phase === 'tell') return { who: b.who, text: b.pre };
  if (P.phase === 'after') return { who: 'The storyteller', text: b.post };
  if (P.phase === 'moral') return { who: 'The storyteller', text: tale.moral };
  return null;
};

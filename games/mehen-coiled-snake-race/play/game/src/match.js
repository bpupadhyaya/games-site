// One race in progress: the engine state, the turn flow (throw, choose, move, pass), and the short-lived animation state (tumbling
// sticks, lions walking the snake, rolling marbles, particles). All timing uses dt; randomness comes only from the rng passed in.
import {
  newState, actionsFor, applyAction, passTurn, throwValue, STICKS, isSafe, cellOf, isHome, lengthOf, planGen, EXTRA_AT, TRACK,
} from './rules.js';

export const STICK_T = 0.95;          // the sticks tumble this long
export const STEP_T = 0.13;           // seconds per cell walked
export const PASS_T = 1.1;

export function createMatch(o) {
  const len = lengthOf(o.length ?? 'classic');
  const seats = o.seats.map((s) => ({ ai: Boolean(s.ai), level: s.level ?? 'skilled' }));
  const st = newState(seats.length, len.mode, len.lions);
  const humans = seats.filter((s) => !s.ai).length;
  return {
    st, seats, length: len.id, auto: Boolean(o.auto), humans, you: humans === 1 ? seats.findIndex((s) => !s.ai) : -1,
    phase: 'throw', phaseT: 0, throwT: 0, sticks: null, value: 0, adj: 0, sel: -1, allowSkip: false,
    hint: null, hintTask: null, aiTask: null, aiPlan: null, aiT: 0.6, thinking: false,
    anim: null, ghosts: [], marbles: [], parts: [], t: 0, events: [], log: [], over: null, overT: 0, winT: 0,
    flash: -1, flashT: 0, note: null, passInfo: null, freeze: false, turbo: false, fastAi: seats.filter((s) => s.ai).length >= 3, lastMove: null,
  };
}

export const cur = (M) => M.st.turn;
export const isAiTurn = (M) => !M.over && M.seats[M.st.turn].ai;
export const humanTurn = (M) => !M.over && !M.auto && !M.seats[M.st.turn].ai;
export const settled = (M) => !M.anim && !M.ghosts.length && M.marbles.every((m) => m.t >= m.dur);

// legal actions for the current throw and nudge
export const actionsNow = (M) => (M.value ? actionsFor(M.st, M.st.turn, M.value).filter((a) => a.adj === M.adj) : []);
export const allActions = (M) => (M.value ? actionsFor(M.st, M.st.turn, M.value) : []);
export const canNudge = (M, d) => {
  if (!M.value || M.phase !== 'choose') return false;
  if (M.st.marbles[M.st.turn] < 1) return false;
  return allActions(M).some((a) => a.adj === d);
};

function push(M, e) { M.events.push(e); }

// ------------------------------------------------------------------------------------------------ throwing
export function doThrow(M, rng) {
  if (M.phase !== 'throw' || M.over) return false;
  const flats = Array.from({ length: STICKS }, () => rng.chance(0.5));
  const count = flats.filter(Boolean).length;
  M.sticks = {
    flats, t: 0,
    x: flats.map((_, i) => (i - (STICKS - 1) / 2) + (rng.next() - 0.5) * 0.35),
    ang: flats.map(() => (rng.next() - 0.5) * 0.9), spin: flats.map(() => (rng.next() < 0.5 ? -1 : 1) * (2 + Math.floor(rng.next() * 2)) * Math.PI),
    dy: flats.map(() => (rng.next() - 0.5) * 0.4),
  };
  M.value = throwValue(count);
  M.adj = 0; M.sel = -1; M.hint = null; M.hintTask = null; M.allowSkip = false;
  M.phase = 'rolling'; M.phaseT = 0;
  push(M, { type: 'throw', value: M.value });
  return true;
}

function afterRoll(M) {
  const st = M.st, p = st.turn;
  const all = actionsFor(st, p, M.value);
  push(M, { type: 'thrown', value: M.value, p });
  if (!all.length) {
    M.phase = 'pass'; M.phaseT = 0; M.passInfo = { value: M.value, extra: M.value >= EXTRA_AT };
    push(M, { type: 'nomove', value: M.value, p });
    return;
  }
  const free = all.some((a) => a.adj === 0);
  M.allowSkip = !free;
  M.phase = 'choose'; M.phaseT = 0;
  if (M.seats[p].ai) startAiPlan(M);
}

function startAiPlan(M) {
  const p = M.st.turn, lv = M.seats[p].level, st = M.st, v = M.value;
  M.aiPlan = null; M.thinking = true; M.aiT = 0;
  M.aiTask = planGen(st, v, lv, M.st.tn + p);
}

// ------------------------------------------------------------------------------------------------ choosing
export function toggleNudge(M, d) {
  if (M.phase !== 'choose' || !humanTurn(M)) return false;
  const next = M.adj === d ? 0 : d;
  if (next !== 0 && !canNudge(M, next)) { push(M, { type: 'refuse', why: M.st.marbles[M.st.turn] < 1 ? 'marble' : 'far' }); return false; }
  M.adj = next; M.sel = -1; M.hint = null;
  push(M, { type: 'nudgeSet', adj: next });
  return true;
}
// select the lion (index i of the current seat) or the lit stone `cell`; returns the action it stands for, or null
export function actionFor(M, { lion = -1, cell = -1 }) {
  const acts = actionsNow(M);
  if (lion >= 0) {
    const c = M.st.lions[M.st.turn][lion];
    return acts.find((a) => a.from === c) ?? null;
  }
  if (cell >= 0) return acts.find((a) => cellOf(a.to) === cell && !isHome(a.to)) ?? acts.find((a) => isHome(a.to) && cell === TRACK) ?? null;
  return null;
}
export function pickAction(M, hit) {
  if (M.phase !== 'choose' || !humanTurn(M)) return;
  const a = actionFor(M, hit);
  if (!a) { push(M, { type: 'refuse', why: 'lion' }); return; }
  if (M.sel === a.i || (M.sel >= 0 && M.st.lions[M.st.turn][M.sel] === a.from)) { commit(M, a); return; }
  M.sel = a.i; M.hint = null;
  push(M, { type: 'select', cell: a.from, to: a.to });
}
export function confirmSelected(M) {
  if (M.phase !== 'choose' || !humanTurn(M) || M.sel < 0) return false;
  const a = actionsNow(M).find((x) => x.i === M.sel);
  if (!a) return false;
  commit(M, a);
  return true;
}
export function skipTurn(M) {
  if (M.phase !== 'choose' || !humanTurn(M) || !M.allowSkip) return false;
  M.phase = 'pass'; M.phaseT = 0; M.passInfo = { value: M.value, extra: M.value >= EXTRA_AT, skipped: true };
  return true;
}

// ------------------------------------------------------------------------------------------------ moving
export function commit(M, act) {
  const before = M.st, p = before.turn;
  M.log.push([M.value, act.i, act.adj || 0]);
  const nx = applyAction(before, act);
  const last = nx.last;
  M.st = nx;
  M.lastMove = last;
  const steps = Math.max(1, Math.abs(cellOf(act.to) - cellOf(act.from)));
  const fromCell = cellOf(act.from), toCell = isHome(act.to) ? 0 : cellOf(act.to);
  const back = act.from >= 100 && act.from < 200;
  const dur = Math.min(1.0, Math.max(0.42, steps * STEP_T + 0.18));
  const delay = act.adj ? 0.5 : 0;
  M.anim = { p, i: act.i, from: act.from, to: act.to, fromCell, toCell, back, kind: act.kind, t: -delay, dur, cap: last.cap };
  M.phase = 'moving'; M.phaseT = 0; M.sel = -1; M.hint = null; M.hintTask = null; M.aiTask = null; M.thinking = false; M.adj = 0;
  if (act.adj) {
    M.marbles.push({ kind: 'spend', p, t: 0, dur: 0.95, adj: act.adj });
    push(M, { type: 'spend', p, adj: act.adj });
  }
  if (last.cap) {
    const arrive = delay + dur;
    M.ghosts.push({ p: last.cap.p, i: last.cap.i, cell: last.cap.cell, t: 0, delay: arrive, dur: 0.6 });
    if (last.marbleFrom >= 0) M.marbles.push({ kind: 'steal', from: last.marbleFrom, to: p, t: -arrive - 0.15, dur: 0.8 });
  }
  if (last.marbleGain) M.marbles.push({ kind: 'gain', p, t: -(delay + dur) - 0.1, dur: 0.8 });
  push(M, { type: 'move', p, act, dur, delay });
}

// ------------------------------------------------------------------------------------------------ stepping
export function stepMatch(M, dt, rng, speed = 1) {
  if (M.freeze) return;
  // computer turns can be sped up (pace setting) or skipped through with a tap (turbo); a person's own turn always runs at normal speed
  const who = M.anim ? M.anim.p : M.st.turn;
  if (!M.auto && !M.over && M.seats[who].ai) dt *= M.turbo ? 3.5 : speed;
  else if (!M.seats[M.st.turn].ai) M.turbo = false;
  M.t += dt; M.phaseT += dt;
  if (M.flashT > 0) M.flashT -= dt;
  for (const q of M.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.g ?? 0) * dt; if (q.grow) q.size += 90 * dt; if (q.rot != null) q.rot += (q.vr ?? 0) * dt; }
  M.parts = M.parts.filter((q) => q.life > 0);
  for (const m of M.marbles) m.t += dt;
  M.marbles = M.marbles.filter((m) => m.t < m.dur);
  for (const g of M.ghosts) g.t += dt;
  M.ghosts = M.ghosts.filter((g) => g.t < g.delay + g.dur);
  if (M.sticks) M.sticks.t += dt;

  if (M.anim) {
    const a = M.anim, before = a.t;
    a.t += dt;
    // events at the landing
    if (before < a.dur && a.t >= a.dur) {
      push(M, { type: 'land', p: a.p, cell: a.toCell, kind: a.kind, cap: a.cap, to: a.to });
      if (a.cap) push(M, { type: 'capture', p: a.p, victim: a.cap.p, cell: a.cap.cell, marble: M.lastMove.marbleFrom >= 0 });
      if (isHome(a.to)) push(M, { type: 'home', p: a.p });
      else if (a.to >= 100 && a.from < 100) push(M, { type: 'turn', p: a.p });
    }
    // step sounds while walking
    const k0 = Math.max(0, Math.floor(before / STEP_T)), k1 = Math.floor(Math.max(0, a.t) / STEP_T);
    if (k1 > k0 && a.t < a.dur) push(M, { type: 'step', p: a.p });
    if (a.t >= a.dur + 0.28) M.anim = null;
  }

  if (M.phase === 'rolling') {
    if (M.phaseT >= STICK_T) afterRoll(M);
  } else if (M.phase === 'choose') {
    if (M.aiTask) {
      for (let k = 0; k < 4 && M.aiTask; k++) { const r = M.aiTask.next(); if (r.done) { M.aiPlan = r.value; M.aiTask = null; } }
    }
    if (M.seats[M.st.turn].ai && !M.auto) {
      M.aiT += dt;
      const wait = M.fastAi ? 0.35 : 0.7;
      if (M.aiPlan && M.aiT >= wait) { M.thinking = false; commit(M, M.aiPlan.act); M.aiPlan = null; }
    }
    if (M.hintTask) {
      for (let k = 0; k < 4 && M.hintTask; k++) { const r = M.hintTask.gen.next(); if (r.done) { const h = M.hintTask; M.hintTask = null; h.done(r.value); } }
    }
  } else if (M.phase === 'pass') {
    if (M.phaseT >= PASS_T * (M.fastAi && !humanTurn(M) ? 0.6 : 1)) {
      const before = M.st;
      M.st = passTurn(before, M.value);
      M.log.push([M.value, -1, 0]);
      M.value = 0; M.sticks = M.sticks; M.passInfo = null;
      M.phase = 'throw'; M.phaseT = 0; M.aiT = 0;
    }
  } else if (M.phase === 'moving') {
    if (!M.anim) {
      if (M.st.over) { M.over = M.st.over; M.phase = 'over'; M.phaseT = 0; push(M, { type: 'end', winner: M.over.winner, why: M.over.why }); }
      else { M.phase = 'throw'; M.phaseT = 0; M.aiT = 0; M.value = 0; if (M.lastMove && M.lastMove.extra) push(M, { type: 'extra', p: M.st.turn }); }
    }
  } else if (M.phase === 'throw') {
    if (M.seats[M.st.turn].ai || M.auto) {
      M.aiT += dt;
      if (M.aiT >= (M.fastAi || M.auto ? 0.5 : 0.8) && !(M.auto && M.autoHold)) doThrow(M, rng);
    }
  } else if (M.phase === 'over') {
    M.overT += dt; M.winT += dt;
  }
}

// The history needed to resume a race: [value, lion index, nudge] per turn (lion -1 = the turn passed).
export function replayMatch(o, log) {
  const M = createMatch(o);
  for (const [value, i, adj] of log) {
    if (M.st.over) break;
    if (i < 0) { M.st = passTurn(M.st, value); M.log.push([value, -1, 0]); continue; }
    const act = actionsFor(M.st, M.st.turn, value).find((a) => a.i === i && a.adj === adj);
    if (!act) break;
    M.value = value;
    M.log.push([value, i, adj]);
    M.st = applyAction(M.st, act);
  }
  M.value = 0; M.phase = 'throw'; M.phaseT = 0; M.aiT = 0; M.lastMove = null; M.events.length = 0;
  if (M.st.over) { M.over = M.st.over; M.phase = 'over'; }
  return M;
}

export function spawn(M, rng, x, y, color, kind) {
  const n = kind === 'win' ? 4 : kind === 'capture' ? 22 : kind === 'safe' ? 12 : 9;
  for (let i = 0; i < n; i++) {
    const a = rng.next() * Math.PI * 2, sp = (kind === 'capture' ? 140 : kind === 'safe' ? 90 : 70) * (0.4 + rng.next());
    M.parts.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'win' ? 120 : 30), g: kind === 'win' ? 260 : 180, life: 0.9 + rng.next() * 0.5, max: 1.4,
      size: kind === 'win' ? 10 + rng.next() * 9 : 3 + rng.next() * 4, color,
      shape: kind === 'win' ? 'glint' : kind === 'capture' ? (i % 3 === 0 ? 'chip' : 'dot') : i % 2 ? 'glint' : 'dot', rot: rng.next() * 6, vr: (rng.next() - 0.5) * 8,
    });
  }
  if (kind === 'safe' || kind === 'capture') M.parts.push({ x, y, vx: 0, vy: 0, life: 0.6, max: 0.9, size: 8, color, shape: 'ring', w: 4, grow: true });
}
export { isSafe };

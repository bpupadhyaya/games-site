// One match of Dudo: the phases (shake, roll, bids, call, reveal, result), the builder state for a human bid, particles and events.
// Pure state: the game loop (game.js) feeds it dt and the rng and reads events out. No drawing here.
import {
  newMatch, rollHands, place, resolveCall, nextRound, isOver, winnerOf, minQty, totalDice, prevBid, legalBids, canCalzo, living, nextLiving,
} from './rules.js';
import { decide } from './ai.js';
import { advise } from './explain.js';

export const SHAKE_T = 1.2, ROLL_T = 0.9, CPU_THINK = 1.0, GAP_T = 0.5, CALL_T = 1.2, FLIP_STEP = 0.5, VERDICT_T = 1.5;

// specs: [{ name, kind: 'human' | 'cpu', level }]. resume: a saved snapshot (see snapshot()).
export function createMatch({ specs, auto = false, resume = null }, rng) {
  const st = newMatch(specs);
  const humans = specs.map((s, i) => (s.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  const M = {
    st, auto, humans, hot: humans.length >= 2, phase: 'shake', t: 0, viewer: humans.length ? humans[0] : 0, ack: false, sel: { q: 1, f: 2 }, hint: null, snap: null,
    cpuT: 0, gapT: 0, over: null, overT: 0, parts: [], events: [], rollT: 99, flash: null, shake: 0, toast: null, autoPlan: null, paused: false, rolled: 0, landed: 0, bidT: 99,
  };
  if (resume) {
    st.players.forEach((p, i) => { const r = resume.players[i]; p.dice = r.dice; p.hand = r.hand.slice(); p.palUsed = r.palUsed; });
    Object.assign(st, { round: resume.round, opener: resume.opener, turn: resume.turn, bids: resume.bids.map((b) => ({ ...b })), palifico: resume.palifico });
    M.phase = 'resumed'; M.rollT = 99;
  } else {
    st.opener = rng.int(specs.length); st.turn = st.opener; st.round = 1;
    rollHands(st, rng);
    M.events.push({ type: 'shake' });
  }
  return M;
}

export const snapshot = (M) => ({
  players: M.st.players.map((p) => ({ dice: p.dice, hand: p.hand.slice(), palUsed: p.palUsed })), round: M.st.round, opener: M.st.opener, turn: M.st.turn,
  bids: M.st.bids.map((b) => ({ ...b })), palifico: M.st.palifico,
});

export const isHumanTurn = (M) => !M.over && M.st.players[M.st.turn].kind === 'human';
// The seat shown at the bottom of the table: the human (or the acting human in pass-and-play); watching shows seat 0.
export const bottomSeat = (M) => (M.auto ? 0 : M.viewer);
// Everyone else, clockwise from the bottom seat.
export function seatOrder(M) {
  const n = M.st.players.length, b = bottomSeat(M), out = [];
  for (let k = 1; k < n; k++) out.push((b + k) % n);
  return out;
}
// Whose dice faces are visible right now: watching shows everyone; a lone human sees their own; pass-and-play only after the handoff tap.
export function handVisible(M, seat) {
  if (M.auto) return true;
  if (M.phase === 'reveal' || M.phase === 'result' || M.phase === 'call') return false;
  const p = M.st.players[seat];
  if (p.kind !== 'human' || p.dice === 0) return false;
  if (M.hot) return M.ack && seat === M.viewer && M.st.turn === seat && (M.phase === 'human');
  return true;
}

// ---- bid builder
export const faceAllowed = (M, f) => minQty(prevBid(M.st), f, M.st.palifico && M.st.bids.length > 0) <= totalDice(M.st);
export const qtyMin = (M, f) => minQty(prevBid(M.st), f, M.st.palifico && M.st.bids.length > 0);
export function resetSel(M) {
  const st = M.st, hand = st.players[st.turn].hand;
  let best = 2, bc = -1;
  for (let f = 2; f <= 6; f++) { const c = hand.filter((d) => d === f || d === 1).length; if (c > bc && faceAllowed(M, f)) { bc = c; best = f; } }
  const prev = prevBid(st);
  if (st.palifico && prev) best = prev.f;
  if (!faceAllowed(M, best)) { for (let f = 1; f <= 6; f++) if (faceAllowed(M, f)) { best = f; break; } }
  M.sel = { f: best, q: Math.min(totalDice(st), qtyMin(M, best)) };
}
export function selFace(M, f) {
  if (!faceAllowed(M, f)) return false;
  M.sel.f = f; M.sel.q = qtyMin(M, f); M.hint = null; return true;
}
export function selQty(M, d) {
  const lo = qtyMin(M, M.sel.f), hi = totalDice(M.st);
  const q = Math.max(lo, Math.min(hi, M.sel.q + d));
  if (q === M.sel.q) return false;
  M.sel.q = q; M.hint = null; return true;
}
export const selLegal = (M) => M.sel.q >= qtyMin(M, M.sel.f) && M.sel.q <= totalDice(M.st);

// ---- moves
function beginTurn(M) {
  const st = M.st, p = st.players[st.turn];
  M.hint = null; M.autoPlan = null; M.toast = null;
  if (M.auto) { M.phase = 'autowait'; return; }
  if (p.kind === 'cpu') { M.phase = 'cpu'; M.cpuT = 0; return; }
  M.viewer = st.turn;
  if (M.hot) { M.phase = 'handoff'; M.ack = false; M.events.push({ type: 'handoff' }); return; }
  M.phase = 'human'; M.ack = true; resetSel(M);
}
export function ackHandoff(M) {
  if (M.phase !== 'handoff') return false;
  M.ack = true; M.phase = 'human'; resetSel(M); M.events.push({ type: 'flip' });
  return true;
}

export function doBid(M, q, f) {
  const st = M.st;
  place(st, st.turn, q, f);
  M.events.push({ type: 'bid', seat: st.bids[st.bids.length - 1].p });
  M.bidT = 0; M.phase = 'gap'; M.gapT = 0; M.hint = null;
  M.events.push({ type: 'save' });
}

export function doCall(M, kind, rng) {
  const st = M.st, caller = st.turn;
  const snap = { hands: st.players.map((p) => p.hand.slice()), dice: st.players.map((p) => p.dice), bid: { ...prevBid(st) }, palifico: st.palifico, kind, caller, flipped: 0 };
  const res = resolveCall(st, kind, caller);
  snap.res = res; snap.after = st.players.map((p) => p.dice);
  M.snap = snap; M.hint = null; M.t = 0; M.phase = 'call'; M.rolled = 0;
  M.events.push({ type: 'call', kind, seat: caller });
  if (isOver(st)) M.over = { winner: winnerOf(st).id };
  else { nextRound(st); rollHands(st, rng); }
  M.events.push({ type: 'save' });
}

export function applyDecision(M, d, rng) {
  if (d.act === 'bid') doBid(M, d.q, d.f);
  else doCall(M, d.act, rng);
}

export function humanBid(M) {
  if (M.phase !== 'human' || !selLegal(M)) return false;
  doBid(M, M.sel.q, M.sel.f); return true;
}
export function humanCall(M, kind, rng) {
  if (M.phase !== 'human' || !M.st.bids.length) return false;
  if (kind === 'calzo' && !canCalzo(M.st)) { M.events.push({ type: 'refuse' }); return false; }
  doCall(M, kind, rng); return true;
}
export function think(M) {
  if (M.phase !== 'human') return false;
  const a = advise(M.st, M.st.turn);
  M.hint = a;
  if (a.act === 'bid') { M.sel = { q: a.q, f: a.f }; }
  M.events.push({ type: 'hint' });
  return true;
}
export function nextRoundStart(M) {
  if (M.phase !== 'result' || M.over) return false;
  M.phase = 'shake'; M.t = 0; M.snap = null; M.rolled = 0; M.events.push({ type: 'shake' }); M.events.push({ type: 'save' });
  return true;
}
// A resumed match drops the player straight into the turn (the game shows the pause card first).
export function resumeTurn(M) { if (M.phase === 'resumed') { M.rollT = 99; beginTurn(M); } }

export function spawn(M, rng, x, y, kind) {
  if (kind === 'thud') {
    M.parts.push({ shape: 'ring', x, y, vx: 0, vy: 0, g: 0, size: 12, grow: 160, w: 4, life: 0.45, max: 0.45, color: 'rgba(255,214,130,1)' });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + rng.next() * 0.5, sp = 100 + rng.next() * 140; M.parts.push({ shape: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 50, g: 500, size: 3 + rng.next() * 3, life: 0.45 + rng.next() * 0.3, max: 0.75, color: 'rgba(255,230,170,1)' }); }
  } else if (kind === 'lose') {
    M.parts.push({ shape: 'ring', x, y, vx: 0, vy: 0, g: 0, size: 14, grow: 220, w: 6, life: 0.7, max: 0.7, color: 'rgba(255,110,90,1)' });
    for (let i = 0; i < 14; i++) { const a = rng.next() * Math.PI * 2, sp = 140 + rng.next() * 260; M.parts.push({ shape: 'chip', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 150, g: 900, drag: 0.992, size: 4 + rng.next() * 4, rot: rng.next() * 6, spin: (rng.next() - 0.5) * 14, life: 0.9 + rng.next() * 0.5, max: 1.4, color: 'rgba(240,226,190,1)' }); }
  } else if (kind === 'win') {
    for (let i = 0; i < 30; i++) { const a = rng.next() * Math.PI * 2, sp = 160 + rng.next() * 420; M.parts.push({ shape: i % 3 ? 'chip' : 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 260, g: 800, drag: 0.992, size: 4 + rng.next() * 5, rot: rng.next() * 6, spin: (rng.next() - 0.5) * 12, life: 1.2 + rng.next() * 0.8, max: 2, color: ['#f2b84b', '#c8372d', '#1f8189', '#f7ecd9'][i % 4] }); }
  } else if (kind === 'gain') {
    M.parts.push({ shape: 'ring', x, y, vx: 0, vy: 0, g: 0, size: 10, grow: 200, w: 5, life: 0.7, max: 0.7, color: 'rgba(120,240,190,1)' });
  }
}

export function stepMatch(M, dt, rng) {
  M.t += dt;
  if (M.shake > 0) M.shake = Math.max(0, M.shake - dt);
  if (M.bidT < 90) M.bidT += dt;
  if (M.over) M.overT += dt;
  for (const q of M.parts) {
    q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.g ?? 900) * dt; q.vx *= (q.drag ?? 1); q.rot = (q.rot ?? 0) + (q.spin ?? 0) * dt;
    if (q.shape === 'ring') q.size += q.grow * dt;
  }
  M.parts = M.parts.filter((q) => q.life > 0);
  if (M.parts.length > 160) M.parts.splice(0, M.parts.length - 160);
  const st = M.st;
  switch (M.phase) {
    case 'shake':
      M.rollT = -1;
      if (M.t >= SHAKE_T) { M.phase = 'roll'; M.t = 0; M.rollT = 0; M.landed = 0; M.events.push({ type: 'roll' }); }
      break;
    case 'roll':
      M.rollT = M.t;
      while (M.landed < 5 && M.t >= 0.55 + 0.06 * M.landed) { M.events.push({ type: 'land', i: M.landed }); M.landed++; }
      if (M.t >= ROLL_T) { M.rollT = 99; beginTurn(M); }
      break;
    case 'gap':
      M.gapT += dt;
      if (M.gapT >= GAP_T) beginTurn(M);
      break;
    case 'cpu':
      M.cpuT += dt;
      if (M.cpuT >= CPU_THINK) applyDecision(M, decide(st, st.turn, rng), rng);
      break;
    case 'call':
      if (M.t >= CALL_T) { M.phase = 'reveal'; M.t = 0; }
      break;
    case 'reveal': {
      const n = st.players.length, nl = M.snap.dice.filter((d) => d > 0).length;
      const flips = Math.min(nl, Math.floor(M.t / FLIP_STEP) + 1);
      while (M.snap.flipped < flips) { M.events.push({ type: 'flip', i: M.snap.flipped }); M.snap.flipped++; }
      void n;
      if (M.t >= nl * FLIP_STEP + 0.4) { M.phase = 'verdict'; M.t = 0; M.events.push({ type: 'verdict' }); }
      break;
    }
    case 'verdict':
      if (M.t >= VERDICT_T) { M.phase = 'result'; M.t = 0; M.events.push({ type: 'result' }); }
      break;
    default:
  }
}

export { living, nextLiving, legalBids, isOver };

// Test and screenshot helper: jump past the opening shake and roll straight to the first turn.
export function skipToTurn(M) {
  if (M.phase === 'shake' || M.phase === 'roll' || M.phase === 'resumed' || M.phase === 'gap') { M.rollT = 99; M.landed = 5; beginTurn(M); }
}

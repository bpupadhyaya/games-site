// The computer players. Pure functions of the hand state `H`, a seeded `rng`, and a context.
//
// How they think (the same code serves opponents, the partner, hints and Auto Play):
//  * Determinization: every unseen card is dealt at random to the hidden hands (respecting any gesture the
//    seat is allowed to know about), the rest of the hand is played out with a plain heuristic policy, and
//    the win rate over many such worlds ranks the options.
//  * Truco decisions are expected-value decisions on the match score (not just on the hand): a call is worth
//    it when  P(opponent runs) * (points now) + P(accept) * (points at the new stake)  beats playing on. So
//    bluffs are not random: they appear exactly when the opponent is likely to run, which is learned from how
//    often THIS player has run in this match.
//  * Answering a Truco weighs the caller's hands by how strong a caller would look (a caller is usually, but
//    not always, strong), then compares accept / run / re-raise on the same score-aware value.
import { VARIANTS, TARGET, trickWinner, decideHand, claimHolds, signalClass, zapOf, canRaise, canReraise, partnerOf } from './rules.js';

export const LEVELS = [
  { id: 1, name: 'Rookie', S: 0, margin: 0.03, fslope: 0.6, catchP: 0.1, trust: 0, blurb: 'Plays by feel, rarely bluffs, misses gestures.' },
  { id: 2, name: 'Regular', S: 70, margin: 0.02, fslope: 0.5, catchP: 0.3, trust: 0.7, blurb: 'Counts cards, bluffs now and then, reads some gestures.' },
  { id: 3, name: 'Master', S: 170, margin: 0.05, fslope: 0.35, catchP: 0.55, trust: 1, blurb: 'Samples hidden hands, bluffs the right players, reads gestures.' },
];
export const levelOf = (id) => LEVELS[Math.max(0, Math.min(2, id - 1))];

// match value of holding (a) points against (b): 1 when a team has won
export function V(a, b) {
  if (a >= TARGET) return 1;
  if (b >= TARGET) return 0;
  return 1 / (1 + Math.exp(-0.34 * (a - b)));
}
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ---- the playout ------------------------------------------------------------------------------------------------
function makeSim(H, hands) {
  return {
    n: H.n, teamOf: H.teamOf, pw: H.pow, hands: hands.map((h) => h.slice()), plays: H.plays.map((p) => ({ ...p })),
    results: H.tricks.map((t) => t.winTeam), leader: H.leader, turn: H.turn, mao: H.teamOf[H.lead0], tieAll: VARIANTS[H.variant].tieAll,
  };
}
function lowestIdx(hand, pw) { let b = 0; for (let i = 1; i < hand.length; i++) if (pw[hand[i]] < pw[hand[b]]) b = i; return b; }
function highestIdx(hand, pw) { let b = 0; for (let i = 1; i < hand.length; i++) if (pw[hand[i]] > pw[hand[b]]) b = i; return b; }
// The plain policy used inside playouts (and by the Rookie): cheap, sensible, a little random.
function simPick(sim, seat, rng) {
  const hand = sim.hands[seat], pw = sim.pw;
  if (hand.length === 1) return hand[0];
  const sorted = hand.slice().sort((x, y) => pw[x] - pw[y]);
  const pl = sim.plays;
  if (pl.length === 0) {
    if (sim.results.length === 0) {
      const u = rng.next();
      return u < 0.5 ? sorted[sorted.length >> 1] : u < 0.8 ? sorted[sorted.length - 1] : sorted[0];
    }
    return sorted[sorted.length - 1];
  }
  let best = -1, bestSeat = -1;
  for (const p of pl) if (pw[p.card] > best) { best = pw[p.card]; bestSeat = p.seat; }
  const mine = sim.teamOf[seat];
  const left = sim.n - pl.length - 1;
  if (sim.teamOf[bestSeat] === mine && (best >= 7 || left === 0)) return sorted[0];
  for (const c of sorted) if (pw[c] > best) return c;
  // can only tie: tie the first trick to keep the second trick decisive
  if (sim.results.length === 0 && sim.teamOf[bestSeat] !== mine) for (const c of sorted) if (pw[c] === best) return c;
  return sorted[0];
}
function simPlay(sim, c) {
  const seat = sim.turn, hand = sim.hands[seat];
  hand.splice(hand.indexOf(c), 1); sim.plays.push({ seat, card: c });
  if (sim.plays.length < sim.n) { sim.turn = (seat + 1) % sim.n; return null; }
  const w = trickWinner(sim.pw, sim.teamOf, sim.plays);
  sim.results.push(w.team); sim.plays = [];
  if (w.seat >= 0) sim.leader = w.seat;
  sim.turn = sim.leader;
  return decideHand(sim.results, sim.mao, sim.tieAll);
}
function playout(sim, rng) {
  let guard = 0;
  while (guard++ < 12) {
    const c = simPick(sim, sim.turn, rng);
    const d = simPlay(sim, c);
    if (d !== null) return d;
  }
  return -1;
}

// ---- hidden-hand sampling ---------------------------------------------------------------------------------------
export function makeCtx(H, seat, { model = null, level = 2 } = {}) {
  const L = levelOf(level), claims = [], known = [];
  const team = H.teamOf[seat];
  for (let s = 0; s < H.n; s++) {
    if (s === seat || !H.signals[s]) continue;
    const sameTeam = H.teamOf[s] === team;
    const heard = sameTeam || H.noticed[s].includes(seat);
    if (heard && (sameTeam || L.trust > 0)) claims.push({ seat: s, kind: H.signals[s] });
  }
  if (H.consulted[team]) for (let s = 0; s < H.n; s++) if (s !== seat && H.teamOf[s] === team) known.push(s);
  return { claims, known, model, level: L };
}
const playedBy = (H, s) => { const o = []; for (const t of H.tricks) for (const p of t.plays) if (p.seat === s) o.push(p.card); for (const p of H.plays) if (p.seat === s) o.push(p.card); return o; };
function samplePool(H, seat, ctx) {
  const used = new Set(H.hands[seat]);
  for (const t of H.tricks) for (const p of t.plays) used.add(p.card);
  for (const p of H.plays) used.add(p.card);
  if (H.vira >= 0) used.add(H.vira);
  for (const s of ctx.known) for (const c of H.hands[s]) used.add(c);
  const pool = []; for (let c = 0; c < 40; c++) if (!used.has(c)) pool.push(c);
  return pool;
}
export function sampleWorld(H, seat, rng, ctx, pool) {
  const hands = H.hands.map((h) => h.slice());
  const others = []; for (let s = 0; s < H.n; s++) if (s !== seat && !ctx.known.includes(s)) others.push(s);
  const work = pool.slice();
  for (let attempt = 0; attempt < 30; attempt++) {
    // partial Fisher-Yates over the pool
    let ok = true;
    let idx = 0;
    for (const s of others) {
      const need = H.hands[s].length;
      const take = [];
      for (let k = 0; k < need; k++) { const j = idx + rng.int(work.length - idx); const t = work[idx]; work[idx] = work[j]; work[j] = t; take.push(work[idx]); idx++; }
      hands[s] = take;
    }
    for (const cl of ctx.claims) {
      if (ctx.known.includes(cl.seat)) continue;
      if (!claimHolds(H, hands[cl.seat].concat(playedBy(H, cl.seat)), cl.kind) && attempt < 29) { ok = false; break; }
    }
    if (ok) break;
  }
  return hands;
}

// win rate of the seat's team from the current state; optionally forcing the seat's next card.
// weigh(world) lets answer decisions favour worlds where the caller looks strong.
export function winProb(H, seat, rng, S, ctx, forced = null, weigh = null) {
  if (S <= 0) S = 1;
  const pool = samplePool(H, seat, ctx), mine = H.teamOf[seat];
  let num = 0, den = 0;
  for (let i = 0; i < S; i++) {
    const hands = sampleWorld(H, seat, rng, ctx, pool);
    const w = weigh ? weigh(hands) : 1;
    const sim = makeSim(H, hands);
    let d;
    if (forced !== null && sim.turn === seat) { d = simPlay(sim, forced); if (d === null) d = playout(sim, rng); }
    else d = playout(sim, rng);
    num += w * (d === mine ? 1 : d === -1 ? 0.5 : 0); den += w;
  }
  return den > 0 ? num / den : 0.5;
}

// ---- strength heuristics (Rookie and signalling) -----------------------------------------------------------------
const cardStrength = (pw) => (pw >= 100 ? 1.1 + (pw - 100) * 0.1 : pw / 9);
function handStrength(H, hand) {
  const v = hand.map((c) => cardStrength(H.pow[c])).sort((a, b) => b - a);
  if (!v.length) return 0;
  const k = Math.min(2, v.length); let s = 0; for (let i = 0; i < k; i++) s += v[i];
  return s / k;
}

// ---- play a card -----------------------------------------------------------------------------------------------------
export function chooseCard(H, seat, rng, level, ctx, opts = {}) {
  const hand = H.hands[seat];
  if (hand.length === 1) return { card: hand[0], why: 'Only one card left.', probs: [{ card: hand[0], p: null }] };
  if (H.special === 'iron') return { card: rng.pick(hand), why: 'Blind hand: any card.', probs: [] };
  const L = levelOf(level);
  if (L.S === 0 && !opts.hint) {
    const sim = makeSim(H, H.hands);
    const c = rng.chance(0.2) ? rng.pick(hand) : simPick(sim, seat, rng);
    return { card: c, why: '', probs: [] };
  }
  const S = opts.hint ? 260 : L.S;
  const probs = hand.map((c) => ({ card: c, p: winProb(H, seat, rng, S, ctx, c) }));
  let best = probs[0];
  for (const q of probs) if (q.p > best.p + 1e-9) best = q;
  // near-ties: prefer to keep the stronger card (spend the cheaper one)
  for (const q of probs) if (q.p >= best.p - 0.012 && H.pow[q.card] < H.pow[best.card]) best = q;
  return { card: best.card, why: explainPlay(H, seat, best, probs), probs };
}
function explainPlay(H, seat, best, probs) {
  const hand = H.hands[seat], pw = H.pow, hi = Math.max(...hand.map((c) => pw[c])), lo = Math.min(...hand.map((c) => pw[c]));
  const lead = H.plays.length === 0;
  const pct = Math.round(best.p * 100);
  const cur = H.plays.length ? Math.max(...H.plays.map((p) => pw[p.card])) : -1;
  const myTeamWinning = H.plays.length && H.teamOf[H.plays.reduce((a, p) => (pw[p.card] > pw[a.card] ? p : a), H.plays[0]).seat] === H.teamOf[seat];
  let why;
  if (!lead && myTeamWinning) why = 'Your side is already winning this trick, so keep your strong cards.';
  else if (!lead && pw[best.card] <= cur) why = 'Nothing you hold beats the table, so give up the cheapest card.';
  else if (!lead && pw[best.card] > cur && pw[best.card] < hi) why = 'This beats the table without spending your best card.';
  else if (lead && H.tricks.length === 0 && pw[best.card] > lo && pw[best.card] < hi) why = 'Lead a middle card: it keeps your best for later and shows little.';
  else if (lead && pw[best.card] === hi) why = 'Lead your best: you need to win now.';
  else if (lead && pw[best.card] === lo) why = 'Lead your weakest to learn what they have.';
  else why = 'Best-scoring card in a simulation of the hidden hands.';
  return `${why} About ${pct}% to win the hand.`;
}

// ---- gestures --------------------------------------------------------------------------------------------------------
export function aiSignalKind(H, seat, rng, level) {
  if (H.n !== 4 || H.signalled[seat]) return null;
  const L = levelOf(level);
  const p = L.id === 1 ? 0.35 : L.id === 2 ? 0.75 : 0.95;
  if (!rng.chance(p)) return null;
  return signalClass(H, H.hands[seat]);
}

// ---- shouting --------------------------------------------------------------------------------------------------------
// how often has the other side run from a Truco this match? (blended with a mild prior)
function foldRate(ctx) { const m = ctx.model; return m ? (m.folded + 1.2) / (m.asked + 3) : 0.35; }

// Should `seat` call the next stake? Returns { call, bluff, p, ev }.
export function raiseDecision(H, seat, rng, level, ctx, opts = {}) {
  const none = { call: false, bluff: false, p: null };
  if (!canRaise(H, seat)) return none;
  const L = levelOf(level), V0 = VARIANTS[H.variant];
  const mine = H.teamOf[seat], sc = H.scoresAtDeal, a = sc[mine], b = sc[1 - mine];
  const cur = V0.vals[H.stakeIdx], nxt = V0.vals[H.stakeIdx + 1];
  if (L.S === 0) {
    const st = handStrength(H, H.hands[seat]);
    const won = H.tricks.some((t) => t.winTeam === mine);
    const call = (st > 1.05 || (won && st > 0.85)) && rng.chance(0.55);
    return { call, bluff: false, p: null };
  }
  const S = opts.hint ? 240 : Math.round(L.S * 0.8);
  const p = clamp(winProb(H, seat, rng, S, ctx) + (opts.hint ? 0 : rng.range(-0.025, 0.025)), 0.02, 0.98);
  // How likely is the other side to run? A rational opponent runs when their own chances look poor, i.e. when
  // mine are high. The centre of that curve moves with how often this particular player has actually run.
  const fr = foldRate(ctx);
  const f = clamp(fr + L.fslope * (p - 0.5) + (H.tricks.some((t) => t.winTeam === mine) ? 0.06 : 0) - (H.tricks.some((t) => t.winTeam === 1 - mine) ? 0.05 : 0), 0.05, 0.9);
  const pAcc = clamp(p - 0.05 - 0.3 * f, 0.03, 0.97);
  const evWait = p * V(a + cur, b) + (1 - p) * V(a, b + cur);
  const evCall = f * V(a + cur, b) + (1 - f) * (pAcc * V(a + nxt, b) + (1 - pAcc) * V(a, b + nxt));
  const margin = L.margin;
  let call = evCall > evWait + margin;
  const bluff = call && p < 0.42;
  if (call && bluff && !rng.chance(L.bluffP ?? (L.id === 2 ? 0.5 : 1))) call = false;      // Regular bluffs only half the time it could
  if (call && !bluff && !rng.chance(L.callP ?? 0.88)) call = false;                  // not every strong hand shouts: unpredictable
  return { call, bluff, p, ev: evCall - evWait, f };
}

// Answer a pending raise. Returns { action: 'accept'|'fold'|'raise', p, why }.
export function answerDecision(H, seat, rng, level, ctx, opts = {}) {
  const P = H.pending, L = levelOf(level), V0 = VARIANTS[H.variant];
  const mine = H.teamOf[seat], sc = H.scoresAtDeal, a = sc[mine], b = sc[1 - mine];
  const Sacc = V0.vals[P.idx], Sfold = V0.vals[P.idx - 1];
  const canUp = P.idx < 4;
  if (L.S === 0) {
    const st = handStrength(H, H.hands[seat]);
    const need = 0.78 + 0.07 * P.idx;
    const action = st > 1.2 && canUp && rng.chance(0.3) ? 'raise' : st >= need - 0.18 || rng.chance(0.18) ? 'accept' : 'fold';
    return { action, p: null, why: '' };
  }
  const S = opts.hint ? 260 : L.S;
  const caller = P.seat >= 0 ? P.seat : (() => { for (let s = 0; s < H.n; s++) if (H.teamOf[s] === P.team) return s; return 0; })();
  const bluffMix = 0.28;
  const weigh = (hands) => { const st = handStrength(H, hands[caller]); return bluffMix + (1 - bluffMix) * clamp((st - 0.55) / 0.6, 0, 1); };
  const p = clamp(winProb(H, seat, rng, S, ctx, null, weigh) + (opts.hint ? 0 : rng.range(-0.02, 0.02)), 0.02, 0.98);
  const acc = p * V(a + Sacc, b) + (1 - p) * V(a, b + Sacc);
  const fold = V(a, b + Sfold);
  let raiseEv = -1;
  if (canUp) {
    const Sup = V0.vals[P.idx + 1];
    const fc = clamp(0.08 + 0.35 * foldRate(ctx), 0.08, 0.4);
    const p2 = clamp(p - 0.03, 0.03, 0.97);
    raiseEv = fc * V(a + Sacc, b) + (1 - fc) * (p2 * V(a + Sup, b) + (1 - p2) * V(a, b + Sup));
  }
  let action = 'accept', best = acc;
  if (fold > best) { action = 'fold'; best = fold; }
  if (raiseEv > best + (L.raiseM ?? (L.id === 3 ? 0.02 : 0.05)) && (p > 0.5 || L.id === 3)) { action = 'raise'; best = raiseEv; }
  const need = Math.round(((Sfold / Sacc) < 1 ? (1 - Sfold / Sacc) / 2 : 0) * 100);
  const why = action === 'accept' ? `About ${Math.round(p * 100)}% to win this hand. Worth taking.` : action === 'fold' ? `Only about ${Math.round(p * 100)}% to win. Running costs ${Sfold}.` : `About ${Math.round(p * 100)}% to win, and a raise may make them run.`;
  void need;
  return { action, p, why };
}

// Mao de Onze / Dez: the team may look at its cards and chooses to play (value v) or run.
export function specialDecision(H, seat, rng, level, ctx, opts = {}) {
  const V0 = VARIANTS[H.variant], mine = H.teamOf[seat], a = H.scoresAtDeal[mine], b = H.scoresAtDeal[1 - mine];
  const L = levelOf(level), S = opts.hint ? 300 : Math.max(60, L.S);
  const known = []; for (let s = 0; s < H.n; s++) if (s !== seat && H.teamOf[s] === mine) known.push(s);
  const c2 = { ...ctx, known };
  const p = L.S === 0 && !opts.hint ? clamp(handStrength(H, H.hands[seat]) * 0.45, 0.1, 0.9) : winProb(H, seat, rng, S, c2);
  const play = p * V(a + V0.specialVal, b) + (1 - p) * V(a, b + V0.specialVal) >= V(a, b + V0.specialRun);
  return { play, p, why: play ? `About ${Math.round(p * 100)}% to win for ${V0.specialVal}: play.` : `About ${Math.round(p * 100)}% to win for ${V0.specialVal}: running costs only ${V0.specialRun}.` };
}

// One call for the whole turn: shout or play a card.
export function turnAction(H, seat, rng, level, ctx, opts = {}) {
  const r = raiseDecision(H, seat, rng, level, ctx, opts);
  if (r.call) return { type: 'raise', bluff: r.bluff, p: r.p };
  const c = chooseCard(H, seat, rng, level, ctx, opts);
  return { type: 'play', card: c.card, why: c.why, probs: c.probs, p: r.p };
}
export { partnerOf, zapOf };

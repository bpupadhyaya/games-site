// Morra: the rules and the rivals. Pure and deterministic: no clock, no DOM; randomness only from the rng handed in.
//
// A round: both players throw 0 to 5 fingers and call a total from 0 to 10 at the same instant. The total is both throws added.
// Exactly one correct call scores a point; both right or both wrong scores nothing. First to the target wins the duel.
//
// Memory of a duel (`mem`), from the PLAYER's point of view:
//   pt[]  the player's throws        pg[]  the player's guess of the rival's throw (call minus own throw)
//   ot[]  the rival's throws         oc[]  the rival's calls
// A rival reads `pt` (what will they throw?) and `pg` (what do they expect me to throw? so I can avoid it).

export const THROWS = [0, 1, 2, 3, 4, 5];
export const MAX_CALL = 10;
export const TARGETS = [3, 5, 7];
export const DEFAULT_TARGET = 5;
export const AUTO_TARGET = 2;
export const WORDS = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci'];
export const THINK_TIMES = [3, 5, 8, 10];
export const REVEAL_SECONDS = 2;
export const COUNT_BEATS = 3;                // uno, due, tre ... morra!
export const BEAT_SECONDS = 0.5;
export const SHOW_SECONDS = 1.9;             // how long a revealed round stays before the next one

// Possible calls for a throw: your own fingers are always in the total, the rival adds 0 to 5.
export const callRange = (o) => ({ lo: o, hi: o + 5 });
export const legalCall = (o, c) => Number.isInteger(o) && Number.isInteger(c) && o >= 0 && o <= 5 && c >= o && c <= o + 5;

// A round's outcome. who: 'you' | 'rival' | 'both' | 'none'
export function judge(pThrow, pCall, oThrow, oCall) {
  const total = pThrow + oThrow, pOk = pCall === total, oOk = oCall === total;
  const who = pOk && oOk ? 'both' : pOk ? 'you' : oOk ? 'rival' : 'none';
  return { total, pOk, oOk, who };
}

// ---- the rivals ----------------------------------------------------------------------------------------------------------------------------
// mode 'fixed'  keeps fond habits and never learns; 'repeat' repeats the last throw; 'count' counts up and tracks your favourite;
// 'read' learns from the duel (order-1 / order-2 / cycles) and hides its own throw from your expectations.
// habit: the public prior the Hint uses against this rival before the duel has any history (what the table already knows about them).
export const RIVALS = [
  {
    id: 'lucia', name: 'Nonna Lucia', role: 'The grandmother of the osteria', skill: 1, mode: 'fixed',
    tone: 0, sleeve: '#c9a24b', trim: '#7a2230', accent: '#d94f3d', ring: true, bracelet: false,
    blurb: 'Loves a big five and a steady three. She never changes her mind.',
    habit: [0.02, 0.1, 0.12, 0.3, 0.1, 0.36],
    throwBias: [0.02, 0.1, 0.13, 0.3, 0.1, 0.35], assume: [0.0, 0.0, 0.1, 0.4, 0.3, 0.2],
  },
  {
    id: 'marco', name: 'Marco', role: 'Fisherman from the harbour', skill: 2, mode: 'repeat',
    tone: 1, sleeve: '#2f6f9f', trim: '#e9e1c8', accent: '#5aa8d4', ring: false, bracelet: true,
    blurb: 'Throws what he threw last time more often than not, and expects you to do the same.',
    habit: [0.1, 0.18, 0.2, 0.2, 0.17, 0.15], repeatP: 0.55,
    throwBias: [0.1, 0.18, 0.2, 0.2, 0.17, 0.15], assume: [0.1, 0.16, 0.2, 0.2, 0.17, 0.17],
  },
  {
    id: 'sergio', name: 'Don Sergio', role: 'The barber who counts', skill: 3, mode: 'count',
    tone: 2, sleeve: '#f2eee2', trim: '#3a3a4a', accent: '#b9a14a', ring: true, bracelet: false,
    blurb: 'Counts up one finger at a time, and bets on your favourite throw.',
    habit: [0.16, 0.17, 0.17, 0.17, 0.17, 0.16], stepP: 0.7,
    throwBias: [0.16, 0.17, 0.17, 0.17, 0.17, 0.16], assume: [0.1, 0.15, 0.2, 0.2, 0.2, 0.15],
  },
  {
    id: 'giulia', name: 'Giulia', role: 'Quick-handed market seller', skill: 4, mode: 'read',
    tone: 3, sleeve: '#b4343f', trim: '#f4e6c6', accent: '#ef7c6b', ring: false, bracelet: true,
    blurb: 'Watches what you throw after each throw, and quickly learns your order.',
    habit: [0.17, 0.17, 0.17, 0.17, 0.16, 0.16],
    w: { f: 1, o1: 1.2, o2: 0, c: 0.6 }, guard: 0.45, noise: 0.1, decay: 0.93, prior: 0,
  },
  {
    id: 'maestro', name: 'Il Maestro', role: 'Tavern champion', skill: 5, mode: 'read',
    tone: 1, sleeve: '#23232b', trim: '#c9a24b', accent: '#e8c25a', ring: true, bracelet: false,
    blurb: 'Reads your throws, your guesses and your cycles, and remembers you from one duel to the next.',
    habit: [0.17, 0.17, 0.17, 0.17, 0.16, 0.16],
    w: { f: 1, o1: 1.3, o2: 1.0, c: 0.9 }, guard: 0.8, noise: 0.04, decay: 0.96, prior: 0.4,
  },
];
export const rivalById = (id) => RIVALS.find((r) => r.id === id) ?? RIVALS[0];

// ---- reading a history ---------------------------------------------------------------------------------------------------------------------
const norm = (a) => { const s = a.reduce((x, y) => x + y, 0); return s > 0 ? a.map((v) => v / s) : a.map(() => 1 / a.length); };
const uniform = () => THROWS.map(() => 1 / THROWS.length);

// Probability of each next throw (0..5) from a history `hist`. w: weights of the readers; prior: a 6-vector or null; priorW: its weight.
export function predict(hist, { w = { f: 1, o1: 1, o2: 0.6, c: 0.6 }, decay = 0.94, prior = null, priorW = 0.4 } = {}) {
  const n = hist.length;
  const f = THROWS.map(() => 0.15);
  for (let i = 0; i < n; i++) f[hist[i]] += Math.pow(decay, n - 1 - i);
  if (prior) for (let t = 0; t < 6; t++) f[t] += priorW * 3 * prior[t];
  let P = norm(f).map((v) => v * w.f);
  const follow = (order) => {
    const key = hist.slice(n - order);
    const c = THROWS.map(() => 0); let mass = 0;
    for (let i = order; i < n; i++) {
      let ok = true;
      for (let j = 0; j < order; j++) if (hist[i - order + j] !== key[j]) { ok = false; break; }
      if (ok) { const k = Math.pow(decay, n - 1 - i); c[hist[i]] += k; mass += k; }
    }
    return { c, mass };
  };
  if (n >= 2 && w.o1) {
    const { c, mass } = follow(1);
    if (mass > 0) { const conf = mass / (mass + 1.6); P = P.map((v, t) => v + w.o1 * conf * (c[t] / mass)); }
  }
  if (n >= 4 && w.o2) {
    const { c, mass } = follow(2);
    if (mass > 0) { const conf = mass / (mass + 1.6); P = P.map((v, t) => v + w.o2 * conf * (c[t] / mass)); }
  }
  if (w.c) {
    for (let k = 1; k <= 3; k++) {
      if (n < k * 2) continue;
      let ok = true;
      for (let j = 0; j < k; j++) if (hist[n - 1 - j] !== hist[n - 1 - j - k]) { ok = false; break; }
      if (ok) { const t = hist[n - k]; P = P.map((v, i) => v + (i === t ? w.c * (k === 1 ? 0.55 : 0.8) : 0)); break; }
    }
  }
  return norm(P);
}

// How likely the other side is to guess each of MY throws. `ot` = my throws, `pg` = their guesses of them. People often guess a repeat.
export function guessModel(ot, pg, decay = 0.94, prior = null) {
  const n = Math.min(ot.length, pg.length);
  const f = THROWS.map(() => 0.2);
  for (let i = 0; i < n; i++) f[pg[i]] += Math.pow(decay, n - 1 - i);
  if (prior) for (let t = 0; t < 6; t++) f[t] += 0.6 * prior[t];
  let G = norm(f);
  if (n >= 2) {
    let rep = 0, tot = 0;
    for (let i = 1; i < n; i++) { tot += 1; if (pg[i] === ot[i - 1]) rep += 1; }
    const r = (rep / tot) * (tot / (tot + 1.5));
    const last = ot[ot.length - 1];
    G = G.map((v, t) => v * (1 - r) + (t === last ? r : 0));
  }
  return G;
}

const argmax = (a) => a.reduce((b, v, i) => (v > a[b] ? i : b), 0);
const sample = (rng, p) => { let r = rng.next(), s = 0; for (let i = 0; i < p.length; i++) { s += p[i]; if (r < s) return i; } return p.length - 1; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The best (throw, call) against a predicted opponent: call hits when the opponent throws c - o; my throw o is "guessed" with probability G[o].
function bestPair(P, G, guard, noise, rng, bias = null) {
  let best = null;
  for (let o = 0; o <= 5; o++) {
    for (let c = o; c <= o + 5; c++) {
      const s = P[c - o] - guard * G[o] + 0.002 * (2.5 - Math.abs(c - o - 2.5)) + (bias ? bias[o] * 0.05 : 0) + (noise ? rng.next() * noise : 0);
      if (!best || s > best.s) best = { s, o, c };
    }
  }
  return { throw: best.o, call: best.c, hit: P[best.c - best.o] };
}

// The rival's choice for this round, made before it sees the player's choice. Returns { throw, call }.
export function rivalChoose(rival, mem, rng, life = null) {
  const n = mem.pt.length, lastMine = mem.ot.length ? mem.ot[mem.ot.length - 1] : null;
  let th, call;
  if (rival.mode === 'fixed') {
    th = sample(rng, norm(rival.throwBias));
    const guess = sample(rng, norm(rival.assume));
    call = clamp(th + guess, th, th + 5);
  } else if (rival.mode === 'repeat') {
    th = lastMine !== null && rng.chance(rival.repeatP) ? lastMine : sample(rng, norm(rival.throwBias));
    const guess = n ? mem.pt[n - 1] : sample(rng, norm(rival.assume));
    call = clamp(th + guess, th, th + 5);
  } else if (rival.mode === 'count') {
    th = lastMine !== null && rng.chance(rival.stepP) ? (lastMine + 1) % 6 : sample(rng, norm(rival.throwBias));
    const guess = n >= 2 ? argmax(predict(mem.pt, { w: { f: 1, o1: 0, o2: 0, c: 0 }, decay: 1 })) : sample(rng, norm(rival.assume));
    call = clamp(th + guess, th, th + 5);
  } else {
    const prior = life && rival.prior ? lifeThrowPrior(life) : null;
    const P = predict(mem.pt, { w: rival.w, decay: rival.decay, prior, priorW: rival.prior });
    const G = guessModel(mem.ot, mem.pg, rival.decay);
    const pick = bestPair(P, G, rival.guard, rival.noise, rng);
    th = pick.throw; call = pick.call;
  }
  return { throw: th, call };
}

export function lifeThrowPrior(life) {
  const c = life?.throws ?? [];
  const s = c.reduce((a, b) => a + b, 0);
  return s >= 8 ? c.map((v) => v / s) : null;
}

// The Hint / Watch and Learn coach: plays the PLAYER's side with the same reading ability, using what the table knows about this rival.
// Returns { throw, call, P, why } where P is the predicted rival throw distribution and why is one plain sentence.
export function coach(rival, mem, rng, life = null) {
  const prior = rival.habit;
  const P = predict(mem.ot, { w: { f: 1, o1: 1, o2: 0.5, c: 0.7 }, decay: 0.93, prior, priorW: mem.ot.length < 4 ? 1.4 : 0.5 });
  // What the rival tends to expect of me: mirrored from how they read: use my own throw history against their reading style.
  const Pme = predict(mem.pt, { w: rival.w ?? { f: 1, o1: 0.6, o2: 0, c: 0.4 }, decay: 0.93 });
  const pick = bestPair(P, Pme, 0.5, 0, rng);
  const top = argmax(P), share = Math.round(P[top] * 100);
  const first = mem.ot.length === 0;
  const nm = top === 0 ? 'a fist' : top === 1 ? 'one finger' : `${top} fingers`;
  const why = share < 26
    ? `${rival.name} has no clear favourite yet, so I add a middle guess: I throw ${pick.throw} and call ${pick.call}.`
    : first
      ? `${rival.name} is known to throw ${nm} most (${share}%). I throw ${pick.throw} and call ${pick.call}.`
      : `${rival.name} is likely to throw ${top} (${share}%). I throw ${pick.throw} and call ${pick.call} so I add that to my own fingers.`;
  return { throw: pick.throw, call: pick.call, P, why, top, share };
}

// ---- the duel record ---------------------------------------------------------------------------------------------------------------------------
export function newMem() { return { pt: [], pg: [], ot: [], oc: [] }; }
export function record(mem, pThrow, pCall, oThrow, oCall) {
  mem.pt.push(pThrow); mem.pg.push(clamp(pCall - pThrow, 0, 5)); mem.ot.push(oThrow); mem.oc.push(oCall);
}

// A line about what just happened that teaches a habit (or null).
export function tellOf(mem, rival, res) {
  const n = mem.pt.length;
  if (n >= 3 && mem.pt[n - 1] === mem.pt[n - 2] && mem.pt[n - 2] === mem.pt[n - 3]) return `You have thrown ${mem.pt[n - 1]} three times in a row.`;
  if (n >= 3 && mem.ot[n - 1] === mem.ot[n - 2] && mem.ot[n - 2] === mem.ot[n - 3]) return `${rival.name} has thrown ${mem.ot[n - 1]} three times in a row.`;
  if (n >= 2 && mem.ot[n - 1] === mem.ot[n - 2]) return `${rival.name} threw ${mem.ot[n - 1]} again.`;
  if (n >= 2 && mem.pt[n - 1] === mem.pt[n - 2]) return `You threw ${mem.pt[n - 1]} again.`;
  if (res.who === 'both') return 'Both right: nobody scores.';
  return null;
}

// What the duel says about the player: throw frequencies, the most common throw, repeats, and how often they guessed a repeat.
export function tellsOf(mem) {
  const n = mem.pt.length, freq = THROWS.map(() => 0);
  mem.pt.forEach((t) => { freq[t] += 1; });
  let repeats = 0, guessRep = 0;
  for (let i = 1; i < n; i++) { if (mem.pt[i] === mem.pt[i - 1]) repeats += 1; if (mem.pg[i] === mem.ot[i - 1]) guessRep += 1; }
  const fav = n ? argmax(freq) : 0;
  const lines = [];
  if (n >= 4) {
    lines.push(`Your favourite throw: ${fav} (${freq[fav]} of ${n}).`);
    if (repeats / (n - 1) >= 0.4) lines.push(`You repeat your last throw ${Math.round((repeats / (n - 1)) * 100)}% of the time. Mix it up.`);
    else lines.push('You rarely repeat a throw, which is hard to read.');
    if (guessRep / (n - 1) >= 0.4) lines.push('You often guess that the rival repeats their last throw.');
  }
  return { n, freq, fav, repeats, guessRep, lines };
}

// Takoyaki Flip Stall: the pure, deterministic cooking engine. No DOM, no clock: time is the dt you pass in.
// Everything the Rules pages say is read from K / FILLINGS / FLAMES below, so the pages cannot drift from the engine.

// ---- constants (also quoted on the Rules pages) ------------------------------------------------------------------------------------
export const K = {
  RATE: 0.1,          // doneness per second on the iron at the plain flame (Journey adds a little per shift)
  SIDE: 0.10,        // the two side quarters touch the mould wall: share of the iron rate
  TOP: 0.02,         // the top quarter barely cooks
  RAW: 0.30,         // below this a quarter is still liquid: flipping spills batter
  GOLD: 0.70,        // golden begins (a ball is ready when every quarter is at least this)
  GOLD_END: 1.10,    // golden ends, toasting begins
  BURN: 1.6,         // a bottom quarter this far is burnt: the ball is scrapped
  FULL: 0.85,        // a mould is "full" from here
  MAX_FILL: 1.05,    // above this batter overflows
  DOLLOP: 0.5,       // one tap with the ladle
  POUR_RATE: 2.4,    // fill per second while a sweep rests over a mould
  BRIM_SLOW: 0.3,    // held pouring slows to this share of POUR_RATE once a mould is full, so a late lift-off does not overflow
  TRAY: 4,           // warm tray capacity
  TRAY_COOL: 0.005,  // quality lost per second in the tray
  SLOTS: 3,          // tickets waiting at the rail at once
  HEARTS: 3,
  RUSH_SECONDS: 90,
  PERFECT: 0.92,
  FLIP_AT: 0.74,     // planner: flip once the bottom quarter reaches this
};
export const FLAMES = [{ id: 'low', name: 'Low', mul: 0.7 }, { id: 'mid', name: 'Medium', mul: 1 }, { id: 'high', name: 'High', mul: 1.45 }];
export const FILLINGS = {
  cheese: { id: 'cheese', name: 'Cheese', hue: '#ffcf3d' },
  corn: { id: 'corn', name: 'Sweet corn', hue: '#ffe066' },
  mushroom: { id: 'mushroom', name: 'Mushroom', hue: '#c9a27a' },
  onion: { id: 'onion', name: 'Green onion', hue: '#7bd35a' },
};
export const FILL_IDS = Object.keys(FILLINGS);
export const STALLS = [
  { id: 'corner', name: 'Corner Stall', blurb: 'One small plate, plain balls, patient regulars.' },
  { id: 'arcade', name: 'Station Arcade', blurb: 'A bigger plate, fillings and a livelier queue.' },
  { id: 'lane', name: 'Riverside Lane', blurb: 'The full plate, three fillings and no spare minute.' },
];
export const SHIFTS_PER_STALL = 6;
export const TOTAL_SHIFTS = STALLS.length * SHIFTS_PER_STALL;

// ---- tiny seeded generator (content only; the live game uses env.rng for nothing that affects cooking) ------------------------------
export function seeded(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (n) => Math.floor(next() * n), pick: (arr) => arr[Math.floor(next() * arr.length)] };
}

// ---- shift specs ----------------------------------------------------------------------------------------------------------------------
const PLATES = [[3, 2], [3, 2], [3, 2], [3, 3], [3, 3], [3, 3], [3, 3], [3, 3], [3, 3], [4, 3], [4, 3], [4, 3], [4, 3], [4, 3], [4, 3], [4, 3], [4, 3], [4, 3]];

// kind: 'journey' | 'daily' | 'rush' | 'demo' (the short Watch and Learn shift)
export function makeSpec(kind, g = 0, seed = 1) {
  const r = seeded(seed * 7919 + g * 104729 + 17);
  let cols, rows, fills, n, rate, pat, gap, name;
  if (kind === 'journey') {
    [cols, rows] = PLATES[g];
    const pool = g < 2 ? [] : g < 6 ? ['cheese'] : g < 9 ? ['cheese', 'corn'] : g < 12 ? ['corn', 'mushroom'] : (() => { const a = FILL_IDS.slice(); const out = []; while (out.length < 3) out.push(a.splice(r.int(a.length), 1)[0]); return out; })();
    fills = pool;
    n = 4 + Math.floor(g * 0.3);
    rate = K.RATE + 0.001 * g;
    pat = 2.6 - 0.01 * g;       // patience scale: generous, so a casual player at about two seconds per action gets through
    gap = 26 + 0.5 * g;         // seconds between tickets: later shifts ask for more balls per ticket, so the queue arrives a little slower
    name = `${STALLS[Math.floor(g / SHIFTS_PER_STALL)].name} ${(g % SHIFTS_PER_STALL) + 1}`;
  } else if (kind === 'rush') {
    cols = 4; rows = 3; fills = ['cheese', 'corn', 'mushroom']; n = 60; rate = 0.17; pat = 0.85; gap = 9; name = 'Rush Hour';
  } else if (kind === 'daily') {
    cols = 4; rows = 3; fills = (() => { const a = FILL_IDS.slice(); const out = []; while (out.length < 2) out.push(a.splice(r.int(a.length), 1)[0]); return out; })(); n = 8; rate = 0.12; pat = 2.2; gap = 24; name = 'Daily Shift';
  } else { // demo (Watch and Learn)
    cols = 3; rows = 2; fills = ['cheese']; n = 3; rate = K.RATE; pat = 1.4; gap = 9; name = 'Watch and Learn';
  }
  const kinds = ['plain', ...fills];
  const hot = r.int(cols * rows);
  const tickets = [];
  let at = 1.2;
  for (let c = 0; c < n; c++) {
    const g2 = kind === 'journey' ? g : kind === 'demo' ? 0 : 8;
    const total = kind === 'demo' ? 2 : Math.min(2 + r.int(2 + Math.floor(g2 / 5)) + (g2 > 8 ? 1 : 0), 5);
    const lines = [];
    let left = total;
    while (left > 0) {
      const f = kinds[r.int(kinds.length)], q = Math.min(left, 1 + r.int(2));
      const fv = f === 'plain' ? null : f, same = lines.find((l) => l.fil === fv);
      if (same) same.need += q; else lines.push({ fil: fv, need: q, got: 0 });
      left -= q;
    }
    const balls = lines.reduce((a, l) => a + l.need, 0);
    tickets.push({ no: c + 1, at, lines, patMax: Math.round((30 + 8 * balls) * pat) });
    at += gap * (0.75 + r.next() * 0.5);
  }
  const par = Math.round(tickets.reduce((a, t) => a + t.lines.reduce((b, l) => b + l.need, 0) * 100 + 40, 0));
  return { kind, g, seed, name, cols, rows, fills, hot, rate, tickets, par, endless: kind === 'rush', seconds: kind === 'rush' ? K.RUSH_SECONDS : 0 };
}

// ---- sim -----------------------------------------------------------------------------------------------------------------------------
const mkMould = (i, cols, rows, hot) => {
  const c = i % cols, r = Math.floor(i / cols), dx = (c - (cols - 1) / 2) / Math.max(1, cols / 2), dy = (r - (rows - 1) / 2) / Math.max(1, rows / 2);
  const hs = 0.94 + 0.16 * (1 - Math.min(1, Math.hypot(dx, dy))) + (i === hot ? 0.3 : 0);
  return { i, hs, st: 'empty', fill: 0, fil: null, q: [0, 0, 0, 0], b: 0, flips: 0, spill: 0, ovf: 0, flipT: 9, age: 0, ready: false };
};

export function makeSim(spec) {
  const plate = Array.from({ length: spec.cols * spec.rows }, (_, i) => mkMould(i, spec.cols, spec.rows, spec.hot));
  return {
    spec, t: 0, flame: 1, plate, cols: spec.cols, rows: spec.rows, customers: [], queue: spec.tickets.map((t, k) => ({ ...t, idx: k })), nextNo: spec.tickets.length + 1,
    tray: [], score: 0, hearts: K.HEARTS, served: 0, balls: 0, perfect: 0, streak: 0, bestStreak: 0, left: 0, burnt: 0, spills: 0, ev: [], done: false, outcome: null,
    rushLeft: spec.seconds, rng: seeded(spec.seed * 31 + 5),
  };
}

export const doneness = (q) => (q < K.RAW ? 0 : q < K.GOLD ? 0.8 * (q - K.RAW) / (K.GOLD - K.RAW) : q <= K.GOLD_END ? 1 : q < 1.35 ? 1 - 0.65 * (q - K.GOLD_END) / (1.35 - K.GOLD_END) : 0.1);
export const isReady = (m) => m.st === 'ball' && m.fill >= 0.35 && Math.min(...m.q) >= K.GOLD * 0.97;
export function quality(m) {
  const mean = m.q.reduce((a, q) => a + doneness(q), 0) / 4;
  const size = m.fill >= 0.7 ? 1 : 0.6 + 0.4 * (m.fill / 0.7);
  return Math.max(0, Math.min(1, mean * size * (1 - m.spill * 0.1 - Math.min(0.3, m.ovf * 0.6))));
}
export const grade = (q) => (q >= K.PERFECT ? 'Perfect' : q >= 0.72 ? 'Good' : q >= 0.45 ? 'Okay' : 'Rough');
const emit = (S, e) => { S.ev.push({ t: S.t, ...e }); if (S.ev.length > 60) S.ev.shift(); };
const heatOf = (S, m) => S.spec.rate * FLAMES[S.flame].mul * m.hs;

// ---- player actions ---------------------------------------------------------------------------------------------------------------------
export function canPour(m) { return m.st !== 'burnt' && m.flips === 0 && !(m.st === 'ball' && m.q[0] >= K.GOLD); }

// Add `amount` of batter to mould i. Overflow spills into the neighbours (wasted batter that starts a thin puddle there).
export function pour(S, i, amount, quiet = false) {
  const m = S.plate[i];
  if (!m || S.done || !canPour(m)) return false;
  if (m.st === 'empty') { m.st = 'ball'; m.fill = 0; m.q = [0, 0, 0, 0]; m.b = 0; m.flips = 0; m.spill = 0; m.ovf = 0; m.fil = null; m.age = 0; }
  const before = m.fill;
  m.fill += amount;
  if (m.fill > K.MAX_FILL) {
    const ex = m.fill - K.MAX_FILL;
    m.fill = K.MAX_FILL; m.ovf += ex;
    const c = i % S.cols, r = Math.floor(i / S.cols);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cc = c + dc, rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= S.cols || rr >= S.rows) continue;
      const n = S.plate[rr * S.cols + cc];
      if (canPour(n) && n.fill < K.MAX_FILL) { if (n.st === 'empty') { n.st = 'ball'; n.fill = 0; n.q = [0, 0, 0, 0]; n.b = 0; n.flips = 0; n.spill = 0; n.ovf = 0; n.fil = null; n.age = 0; } n.fill = Math.min(K.MAX_FILL, n.fill + ex * 0.3); }
    }
    if (!quiet) emit(S, { type: 'overflow', i });
  } else if (!quiet && before < K.FULL && m.fill >= K.FULL) emit(S, { type: 'full', i });
  return true;
}

export function topping(S, i, fil) {
  const m = S.plate[i];
  if (!m || S.done || m.st !== 'ball' || m.fil || m.flips > 0 || m.fill < 0.35 || !FILLINGS[fil]) return false;
  m.fil = fil; emit(S, { type: 'topping', i, fil });
  return true;
}

export function flip(S, i) {
  const m = S.plate[i];
  if (!m || S.done || m.st !== 'ball') return false;
  const bq = m.q[m.b];
  if (bq < K.RAW) { m.spill += 1; S.spills += 1; emit(S, { type: 'spill', i }); }
  else emit(S, { type: 'flip', i, q: bq, golden: bq >= K.GOLD && bq <= K.GOLD_END });
  m.b = (m.b + 1) % 4; m.flips += 1; m.flipT = 0;
  m.ready = isReady(m);
  return true;
}

// Customers that still need this filling, most urgent first.
function wanting(S, fil) {
  return S.customers.filter((c) => c.st === 'wait' && c.lines.some((l) => l.fil === fil && l.got < l.need)).sort((a, b) => a.pat / a.patMax - b.pat / b.patMax);
}
function serveTo(S, c, fil, q, from) {
  const line = c.lines.find((l) => l.fil === fil && l.got < l.need);
  line.got += 1; c.qs.push(q);
  const perfect = q >= K.PERFECT;
  S.streak = perfect ? S.streak + 1 : 0; S.bestStreak = Math.max(S.bestStreak, S.streak);
  const pts = Math.round(100 * q) + (perfect ? 20 + 5 * Math.min(5, S.streak - 1) : 0);
  S.score += pts; S.balls += 1; if (perfect) S.perfect += 1;
  emit(S, { type: 'serve', cust: c.id, q, pts, from, fil, perfect });
  if (c.lines.every((l) => l.got >= l.need)) {
    const tip = Math.round(30 * (c.pat / c.patMax)) + (c.qs.every((x) => x >= 0.72) ? 20 : 0);
    c.st = 'happy'; c.exit = 0; S.score += tip; S.served += 1;
    emit(S, { type: 'ticket', cust: c.id, tip, avg: c.qs.reduce((a, x) => a + x, 0) / c.qs.length });
  }
}

// Pack a ready ball: to the most urgent customer who wants its filling, else the warm tray. Returns what happened.
export function pack(S, i) {
  const m = S.plate[i];
  if (!m || S.done || m.st !== 'ball' || !isReady(m)) return null;
  const q = quality(m), fil = m.fil;
  const w = wanting(S, fil);
  if (w.length) { serveTo(S, w[0], fil, q, i); clearMould(m); return { to: 'customer', q }; }
  if (S.tray.length < K.TRAY) { S.tray.push({ fil, q }); emit(S, { type: 'tray', i, q, fil }); clearMould(m); return { to: 'tray', q }; }
  emit(S, { type: 'trayfull', i });
  return { to: 'none', q };
}
function clearMould(m) { m.st = 'empty'; m.fill = 0; m.fil = null; m.q = [0, 0, 0, 0]; m.b = 0; m.flips = 0; m.spill = 0; m.ovf = 0; m.ready = false; m.age = 0; }

export function scrape(S, i) {
  const m = S.plate[i];
  if (!m || S.done || m.st !== 'burnt') return false;
  clearMould(m); emit(S, { type: 'scrape', i });
  return true;
}

// The picks: flip a cooking ball, pack a ready one, scrape a burnt one.
export function pick(S, i) {
  const m = S.plate[i];
  if (!m || S.done) return null;
  if (m.st === 'burnt') return scrape(S, i) ? { act: 'scrape' } : null;
  if (m.st !== 'ball') return null;
  if (isReady(m)) { const r = pack(S, i); return r ? { act: 'pack', ...r } : null; }
  return flip(S, i) ? { act: 'flip' } : null;
}

export function setFlame(S, k) { S.flame = Math.max(0, Math.min(FLAMES.length - 1, k)); emit(S, { type: 'flame', k: S.flame }); }

// ---- time ----------------------------------------------------------------------------------------------------------------------------
function admit(S) {
  if (S.customers.length >= K.SLOTS) return;
  if (S.spec.endless && S.queue.length < 3) {   // Rush: tickets are generated as the clock runs
    const t0 = S.queue.length ? S.queue[S.queue.length - 1].at : S.t, r = S.rng, kinds = ['plain', ...S.spec.fills];
    const total = 2 + r.int(4), lines = []; let left = total;
    while (left > 0) { const f = kinds[r.int(kinds.length)], q = Math.min(left, 1 + r.int(2)); const same = lines.find((l) => l.fil === (f === 'plain' ? null : f)); if (same) same.need += q; else lines.push({ fil: f === 'plain' ? null : f, need: q, got: 0 }); left -= q; }
    const balls = lines.reduce((a, l) => a + l.need, 0);
    S.queue.push({ no: S.nextNo++, at: t0 + 6 + r.next() * 5, lines, patMax: Math.round((24 + 6 * balls) * 0.85), idx: S.nextNo });
  }
  while (S.queue.length && S.queue[0].at <= S.t && S.customers.length < K.SLOTS) {
    const t = S.queue.shift();
    const slot = [0, 1, 2].find((k) => !S.customers.some((x) => x.slot === k));
    const c = { id: t.no, no: t.no, slot, lines: t.lines.map((l) => ({ ...l })), patMax: t.patMax, pat: t.patMax, qs: [], st: 'wait', born: S.t, exit: 0 };
    S.customers.push(c);
    emit(S, { type: 'arrive', cust: c.id });
    // the warm tray feeds a newcomer at once
    for (let k = 0; k < S.tray.length;) {
      const b = S.tray[k], line = c.lines.find((l) => l.fil === b.fil && l.got < l.need);
      if (line && c.st === 'wait') { S.tray.splice(k, 1); serveTo(S, c, b.fil, b.q, -1); } else k += 1;
    }
  }
}

export function step(S, dt) {
  if (S.done) return;
  S.t += dt;
  if (S.spec.endless) { S.rushLeft = Math.max(0, S.rushLeft - dt); }
  // iron
  for (const m of S.plate) {
    if (m.flipT < 9) m.flipT += dt;
    if (m.st !== 'ball') continue;
    m.age += dt;
    const r = heatOf(S, m);
    for (let k = 0; k < 4; k++) {
      const pos = (k - m.b + 4) % 4;                  // 0 bottom, 1 and 3 sides, 2 top
      m.q[k] += r * (pos === 0 ? 1 : pos === 2 ? K.TOP : K.SIDE) * dt * (m.fill < 0.35 ? 0.5 : 1);
    }
    const was = m.ready; m.ready = isReady(m);
    if (m.ready && !was) emit(S, { type: 'ready', i: m.i });
    if (m.q[m.b] >= K.BURN) { m.st = 'burnt'; m.ready = false; S.burnt += 1; emit(S, { type: 'burnt', i: m.i }); }
  }
  for (const b of S.tray) b.q = Math.max(0, b.q - K.TRAY_COOL * dt);
  // customers
  for (const c of S.customers) {
    if (c.st === 'wait') {
      c.pat -= dt;
      if (c.pat <= 0) {
        c.st = 'gone'; c.exit = 0; S.left += 1;
        if (!S.spec.endless) S.hearts -= 1;
        emit(S, { type: 'leave', cust: c.id });
      }
    } else c.exit += dt;
  }
  S.customers = S.customers.filter((c) => c.st === 'wait' || c.exit < 1.4);
  admit(S);
  // end
  const open = S.customers.filter((c) => c.st === 'wait').length;
  if (S.spec.endless) { if (S.rushLeft <= 0) finish(S, 'time'); }
  else if (S.hearts <= 0) finish(S, 'closed');
  else if (!S.queue.length && !open) finish(S, 'cleared');
}

function finish(S, why) {
  S.done = true;
  const ratio = S.score / Math.max(1, S.spec.par);
  let stars = 0;
  if (S.spec.endless) stars = S.score >= 1500 ? 3 : S.score >= 900 ? 2 : S.score >= 350 ? 1 : 0;
  else if (why === 'cleared') stars = ratio >= 1.0 && S.hearts === K.HEARTS ? 3 : ratio >= 0.7 && S.hearts >= K.HEARTS - 1 ? 2 : 1;
  S.outcome = { why, stars, ratio };
  emit(S, { type: 'end', why, stars });
}

// ---- planner (powers the Think hint and Watch and Learn) ----------------------------------------------------------------------------------
// Needs: balls still wanted by waiting customers (and the next one at the rail), minus tray, minus balls already on the plate.
export function demand(S) {
  const need = new Map();
  const add = (f, n) => need.set(f, (need.get(f) ?? 0) + n);
  for (const c of S.customers) if (c.st === 'wait') for (const l of c.lines) if (l.got < l.need) add(l.fil, l.need - l.got);
  const next = S.queue[0];
  if (next && next.at - S.t < 10) for (const l of next.lines) add(l.fil, l.need);
  for (const b of S.tray) add(b.fil, -1);
  return need;
}
function onPlate(S) {
  const have = new Map();
  for (const m of S.plate) if (m.st === 'ball' && m.fill >= 0.35) have.set(m.fil, (have.get(m.fil) ?? 0) + 1);
  return have;
}

const mouldsText = (cells) => (cells.length === 1 ? `mould ${cells[0] + 1}` : `moulds ${cells.map((c) => c + 1).join(', ')}`);

export function plan(S) {
  if (S.done) return { kind: 'wait', text: 'The shift is over.', why: '' };
  const P = S.plate;
  const burnt = P.find((m) => m.st === 'burnt');
  const waitingBalls = (f) => wanting(S, f).length > 0;
  // 1. a ready ball goes out (customer first, tray if nobody wants it)
  const ready = P.filter((m) => m.st === 'ball' && isReady(m)).sort((a, b) => Math.max(...b.q) - Math.max(...a.q));
  for (const m of ready) {
    if (waitingBalls(m.fil)) return { kind: 'pack', i: m.i, text: `Pack mould ${m.i + 1}: a customer is waiting for ${m.fil ? FILLINGS[m.fil].name.toLowerCase() : 'plain'}.`, why: 'Every quarter is golden. Leaving it on the iron only toasts the bottom.' };
  }
  // 2. flip the ball whose bottom quarter is most ripe
  const flips = P.filter((m) => m.st === 'ball' && !isReady(m) && m.fill >= 0.35 && m.q[m.b] >= K.FLIP_AT).sort((a, b) => b.q[b.b] - a.q[a.b]);
  if (flips.length) { const m = flips[0]; return { kind: 'flip', i: m.i, text: `Flip mould ${m.i + 1}: its bottom quarter is golden.`, why: 'A quarter turn brings a raw quarter down and lets the golden one rest on the side.' }; }
  // 3. ready balls nobody wants go to the warm tray while there is room
  for (const m of ready) if (S.tray.length < K.TRAY) return { kind: 'pack', i: m.i, text: `Move mould ${m.i + 1} to the warm tray.`, why: 'No one wants this filling yet, so keep it warm for the next ticket.' };
  if (burnt) return { kind: 'scrape', i: burnt.i, text: `Scrape the burnt ball from mould ${burnt.i + 1}.`, why: 'A burnt ball cannot be served. Clearing it frees the mould.' };
  // 4. topping for a poured, unfilled mould that is wanted
  const need = demand(S), have = onPlate(S);
  const shortage = (f) => (need.get(f) ?? 0) - (have.get(f) ?? 0);
  const fresh = P.filter((m) => m.st === 'ball' && m.flips === 0 && m.fil === null && m.fill >= 0.35);
  if (fresh.length) {
    let best = null, bs = 0;
    for (const f of S.spec.fills) { const s = shortage(f); if (s > bs) { bs = s; best = f; } }
    if (best) {
      const cells = fresh.slice(0, Math.max(1, Math.min(shortage(best), fresh.length))).map((m) => m.i);
      return { kind: 'topping', i: cells[0], cells, fil: best, text: `Sweep ${FILLINGS[best].name.toLowerCase()} over ${mouldsText(cells)}.`, why: `Tickets need ${need.get(best)} ${FILLINGS[best].name.toLowerCase()} ball${need.get(best) === 1 ? '' : 's'} and only ${have.get(best) ?? 0} cooking.` };
    }
  }
  // 5. top up a thin ball before it is flipped
  const thin = P.find((m) => m.st === 'ball' && m.flips === 0 && m.fill > 0 && m.fill < K.FULL - 0.01 && canPour(m));
  if (thin) return { kind: 'pour', i: thin.i, text: `Top up mould ${thin.i + 1} with batter.`, why: 'A full mould makes a full-size ball and a better score.' };
  // 6. pour into an empty mould while tickets still need balls
  const totalNeed = [...need.values()].reduce((a, v) => a + Math.max(0, v), 0), inPlay = P.filter((m) => m.st === 'ball').length;
  const empties = P.filter((m) => m.st === 'empty');
  const want = S.spec.endless ? Math.max(totalNeed - inPlay, inPlay < 6 ? 3 : 0) : totalNeed - inPlay;
  const fresh2 = P.filter((m) => m.st === 'ball' && m.flips === 0 && m.q[0] < 0.45).length;   // stagger: a new batch only when the last one has moved on
  const pressure = P.filter((m) => m.st === 'ball' && m.fill >= 0.35 && (isReady(m) || m.q[m.b] >= 0.55)).length;
  if (empties.length && want > 0 && fresh2 === 0 && pressure <= 1) {
    const cells = empties.slice(0, Math.min(want, 3)).map((m) => m.i);
    return { kind: 'pour', i: cells[0], cells, text: `Sweep batter over ${mouldsText(cells)}.`, why: `${totalNeed} ball${totalNeed === 1 ? ' is' : 's are'} still wanted and ${inPlay} cooking.` };
  }
  return { kind: 'wait', text: 'Watch the cook rings. Nothing needs doing yet.', why: 'Every ball is still cooking its quarter.' };
}

// Apply a planner action through the same player actions (used by Watch and Learn and by tests).
export function applyPlan(S, a) {
  switch (a.kind) {
    case 'pack': case 'flip': case 'scrape': return pick(S, a.i);
    case 'topping': for (const c of a.cells ?? [a.i]) topping(S, c, a.fil); return true;
    case 'pour': for (const c of a.cells ?? [a.i]) { pour(S, c, K.DOLLOP); if (S.plate[c].fill < K.FULL) pour(S, c, K.DOLLOP); } return true;
    default: return null;
  }
}

// The run, the start gate, the cup and the rivals. Pure and deterministic: everything a player sees is read from `S.s`.
import { SEG, HW, buildTrack, at, nrefAt, nextCurve, makeRuts, trackInfo } from './track.js';
import { DT, EDGE, newBody, stepBody } from './physics.js';
import { createPilot } from './pilot.js';
import { clamp } from './util.js';

export { DT, EDGE };
export const LEVELS = [
  { id: 1, name: 'Village cup', blurb: 'Rivals of every standard, generous to beginners.', lo: 0.2, hi: 0.78 },
  { id: 2, name: 'Regional cup', blurb: 'The standard challenge.', lo: 0.45, hi: 0.92 },
  { id: 3, name: 'World class', blurb: 'Seven fast, clean sliders. Every hundredth counts.', lo: 0.7, hi: 1.0 },
];
export const RIVALS = ['Anders', 'Mira', 'Tomas', 'Lena', 'Ivo', 'Greta', 'Pavel', 'Sanna', 'Noor', 'Jonas', 'Ines', 'Kofi'];
export const MEDALS = ['Gold', 'Silver', 'Bronze'];

// The five start handles: ring i closes at PUSH_T[i]; a pull within +-PUSH_WIN seconds counts, the closer the better.
export const PUSH_T = [0.7, 1.15, 1.6, 2.05, 2.5];
export const PUSH_WIN = 0.2;
export const PUSH_END = 3.1;
const V0 = 3.0, V_PER_PULL = 0.9;              // launch speed 3.0 m/s plus up to 0.9 per perfect pull
const COAST = 2.4;

// a computer slider's whole run, with the same physics (only the clock and the push are different)
export function simulateRun(trackId, skill, rng, ruts) {
  const T = buildTrack(trackId), p = createPilot(rng, skill);
  const bonus = V_PER_PULL * 5 * clamp(skill * 1.05 - rng.range(0, 0.28), 0, 1);
  const B = newBody(V0 + bonus);
  const r = ruts.map((x) => ({ ...x }));
  let n = 0;
  while (B.s < T.L && n < 60 * 240) { stepBody(B, T, p(B, T), DT, r); n++; }
  const over = (B.s - T.L) / Math.max(1, B.v);
  // slower sliders also lose time they never get back (a cautious line, a poorer start): modelled as a small fixed factor
  return (B.t - over) * (1 + Math.pow(1 - skill, 2) * 0.075) * (1 + rng.range(-0.004, 0.004));
}

export function createSim(opts, rng) {
  const T = buildTrack(opts.track);
  const level = LEVELS.find((l) => l.id === opts.level) || LEVELS[1];
  const mode = opts.mode;                                   // 'cup' | 'trial' | 'daily' | 'watch'
  const runs = mode === 'cup' || mode === 'watch' ? 2 : 1;
  const rutSeed = mode === 'daily' ? (opts.day || 0) * 31 + 5 : T.spec.seed;
  const ruts0 = makeRuts(T, rutSeed);
  const names = rng.shuffle(RIVALS).slice(0, 7);
  const rivals = names.map((name, i) => ({ name, skill: level.lo + (level.hi - level.lo) * (i / 6), times: [] }));
  const rivalRng = rng.fork();

  const s = {
    track: opts.track, mode, level: level.id, runs, run: 1, ph: 'ready', pt: 0, t: 0, over: false,
    s: 0, n: 0, vn: 0, v: 0, u: 0, top: 0, touches: 0, scrape: 0,
    ruts: ruts0.map((r) => ({ ...r })), pushQ: [], pulls: 0,
    ci: 0, curveClean: 0, curveDone: 0, curveInfo: [], splits: [], bestSplits: opts.bestSplits || null,
    ghost: opts.ghost || null, rec: { s: [], n: [] },
    events: [], evId: 0, you: { times: [], best: 0 }, res: null, standings: [], lastTimes: [],
    hold: null, round: 0, feedback: null, wallT: -9, shake: 0,
    lineErr: 0, lineN: 0,
  };
  const P = { B: newBody(V0) };          // the live body (kept out of the JSON-able state: s mirrors it every tick)
  let ruts = s.ruts;
  const ev = (type, o = {}) => { s.events.push({ id: ++s.evId, type, t: s.t, ...o }); if (s.events.length > 60) s.events.shift(); };
  let hitNow = false;
  const holdIds = new Set();            // Watch & Learn: the bends it stops in front of
  T.curves.forEach((c, i) => { if (i === 0 || c.rad < 40 || i % 4 === 0) holdIds.add(i); });

  function syncBody() {
    const B = P.B;
    s.s = B.s; s.n = B.n; s.vn = B.vn; s.v = B.v; s.u = B.u; s.top = B.top; s.touches = B.touches; s.scrape = B.scrape;
  }
  function beginRun() {
    P.B = newBody(V0);
    ruts = ruts0.map((r) => ({ ...r })); s.ruts = ruts;
    Object.assign(s, { ph: 'ready', pt: 0, t: 0, pushQ: [], pulls: 0, ci: 0, curveClean: 0, curveDone: 0, curveInfo: [], splits: [], rec: { s: [], n: [] },
      res: null, hold: null, feedback: null, lineErr: 0, lineN: 0, wallT: -9 });
    hitNow = false; s.holdDone = -1;
    syncBody();
    // the computer sliders slide this run now
    rivals.forEach((r) => r.times.push(simulateRun(opts.track, r.skill, rivalRng.fork(), ruts0)));
  }
  beginRun();

  const lenBetween = (a, b) => Math.max(0, b - a);
  function standingsNow() {
    const total = (arr, k) => arr.slice(0, k).reduce((x, y) => x + y, 0);
    const done = s.you.times.length;
    const rows = [{ you: true, name: 'You', total: total(s.you.times, done), last: s.you.times[done - 1] }];
    rivals.forEach((r) => rows.push({ you: false, name: r.name, total: total(r.times, done), last: r.times[done - 1] }));
    rows.sort((a, b) => a.total - b.total);
    rows.forEach((r, i) => { r.rank = i + 1; });
    return rows;
  }

  const api = {
    s,
    T,
    input(u) { s.lean = clamp(u, -1, 1); },
    // a pull on the start handles; returns its quality 0..1 (0 = missed everything)
    pull() {
      if (s.ph !== 'push') return 0;
      let bi = -1, bd = 9;
      PUSH_T.forEach((t, i) => { if (s.pushQ[i] === undefined) { const d = Math.abs(s.pt - t); if (d < bd) { bd = d; bi = i; } } });
      if (bi < 0 || bd > PUSH_WIN) { ev('pull', { q: 0 }); return 0; }
      const q = 1 - (bd / PUSH_WIN) * 0.8;
      s.pushQ[bi] = q; s.pulls++;
      ev('pull', { q, i: bi });
      return q;
    },
    go() { if (s.ph === 'ready') { s.ph = 'push'; s.pt = 0; ev('go'); } },
    release() { s.hold = null; },
    next() {
      if (s.ph !== 'board') return;
      if (s.run < s.runs) { s.run++; beginRun(); } else { s.ph = 'end'; s.over = true; s.standings = standingsNow(); ev('end'); }
    },
    suggest() {
      const c = nextCurve(T, s.s);
      if (s.ph === 'ready' || s.ph === 'push') return { title: 'The start', lines: ['Five handle rings close one after another. Tap just as each ring closes: every good pull adds launch speed.', c ? `The first bend is a ${c.dir > 0 ? 'right' : 'left'} bend, ${Math.round(c.s0 - s.s)} m away.` : ''], curve: c ? c.n : 0, dir: c ? c.dir : 0 };
      if (!c) return { title: 'To the finish', lines: ['No more bends. Hold the middle and let the sled run.'], curve: 0, dir: 0 };
      const d = Math.max(0, Math.round(c.s0 - s.s));
      const side = c.dir > 0 ? 'right' : 'left';
      const sharp = c.rad < 38 ? 'sharp' : c.rad < 52 ? 'medium' : 'wide';
      const want = nrefAt(T, c.sA), cur = s.n;
      const wide = c.dir * cur < 0.4;
      const lines = [d > 0 ? `Bend ${c.n} comes in ${d} m: a ${sharp} ${side} bend (${c.deg} degrees).` : `You are in bend ${c.n}, a ${sharp} ${side} bend.`];
      lines.push(wide ? `Go in wide on the ${c.dir > 0 ? 'left' : 'right'}, then cut to the inside at the middle of the bend.` : `Hug the inside (${side}) edge at the middle of the bend, then let the sled drift out.`);
      lines.push(`The gold line on the ice is the fastest line. Lean ${side} to hold it; lean back before the next bend.`);
      return { title: `Bend ${c.n} of ${T.curves.length}`, lines, curve: c.n, dir: c.dir, want, cur };
    },
    update(dt) {
      s.pt += dt;
      if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 3);
      const B = P.B;
      if (s.ph === 'push') {
        if (s.pt >= PUSH_END) {
          const q = s.pushQ.reduce((a, b) => a + (b || 0), 0);
          B.v = V0 + V_PER_PULL * q; s.launchQ = q;
          s.ph = 'run'; s.pt = 0; ev('launch', { q });
        }
      } else if (s.ph === 'run') {
        // Watch & Learn stops in front of chosen bends
        if (opts.hold && !s.hold) {
          const c = nextCurve(T, s.s);
          if (c) { const ci = T.curves.indexOf(c); if (ci >= 0 && ci !== s.holdDone && s.s > c.s0 - 38 && s.s < c.s0 + 2 && holdIds.has(ci)) { s.hold = { id: `c${ci}`, curve: c.n }; s.holdDone = ci; s.round++; return; } }
        }
        if (s.hold) return;
        const lean = s.lean || 0;
        const hit = stepBody(B, T, lean, dt, ruts);
        if (hit > 0) { s.shake = Math.min(1, 0.3 + hit * 0.2); s.wallT = s.t; ev('wall', { sev: hit, n: Math.sign(B.n) }); }
        s.t = B.t;
        syncBody();
        // records, line quality, bends, splits
        if (Math.round(s.t / DT) % 6 === 0) { s.rec.s.push(Math.round(B.s * 10) / 10); s.rec.n.push(Math.round(B.n * 100) / 100); }
        const c = T.curves[s.ci];
        if (c) {
          if (B.s >= c.s0 - 8 && B.s <= c.s1 + 4) {
            const e = Math.abs(B.n - nrefAt(T, B.s)); s.lineErr += e; s.lineN++;
            if (hit > 0) hitNow = true;
          }
          if (B.s > c.s1 + 4) {
            const avg = s.lineN ? s.lineErr / s.lineN : 2;
            const rating = clamp(1 - avg / 1.5, 0, 1);
            const clean = !hitNow && rating >= 0.62;
            s.curveInfo.push({ n: c.n, rating, clean });
            if (clean) s.curveClean++;
            s.curveDone++;
            ev('curve', { n: c.n, rating, clean, perfect: clean && rating >= 0.84 });
            hitNow = false; s.lineErr = 0; s.lineN = 0; s.ci++;
          }
        }
        const thirds = [T.S0 + (T.L - T.S0) / 3, T.S0 + (T.L - T.S0) * 2 / 3];
        const si = s.splits.length;
        if (si < 2 && B.s >= thirds[si]) {
          const best = s.bestSplits ? s.bestSplits[si] : null;
          s.splits.push(s.t);
          ev('split', { i: si, t: s.t, delta: best == null ? null : s.t - best });
        }
        if (B.s >= T.L) {
          const over = (B.s - T.L) / Math.max(1, B.v);
          const time = Math.max(0.1, B.t - over);
          s.time = time;
          s.you.times.push(time);
          s.you.best = s.you.best ? Math.min(s.you.best, time) : time;
          s.ph = 'finish'; s.pt = 0;
          s.res = { time, top: B.top, touches: B.touches, clean: s.curveClean, bends: T.curves.length, scrape: B.scrape, launch: s.launchQ || 0,
            splits: [...s.splits, time], curveInfo: s.curveInfo.slice(), line: s.curveInfo.length ? s.curveInfo.reduce((a, c) => a + c.rating, 0) / s.curveInfo.length : 0,
            rec: s.rec };
          s.standings = standingsNow();
          ev('finish', { time });
        }
      } else if (s.ph === 'finish') {
        B.u += (0 - B.u) * Math.min(1, dt * 4); B.vn *= 0.9; B.n = clamp(B.n * (1 - dt * 0.8), -EDGE, EDGE);
        B.v = Math.max(0, B.v - 13 * dt);
        B.s = Math.min(B.s + B.v * dt, T.N * SEG - 6);
        syncBody();
        if (s.pt >= COAST) { s.ph = 'board'; s.pt = 0; }
      } else if (s.ph === 'board' || s.ph === 'ready') { /* waiting for the player */ }
    },
  };
  return api;
}

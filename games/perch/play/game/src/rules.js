// The whole simulation, pure and deterministic. Randomness only from the `rng` passed in.
import { T, SLOTS, KINDS, BOSS_SLOT } from './tuning.js';
import { levelDef, buildPerches } from './levels.js';
import { createRng } from '../kit/rng.js';

const lerp = (a, b, f) => a + (b - a) * f;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// The boss's pattern: made once from a fixed seed, so every attempt at that level is identical.
function makeChart(level, def) {
  const r = createRng(1000 + level), out = [];
  let t = 2.2;
  while (t < def.duration - 4) {
    const count = 3 + Math.floor(r.next() * 3);
    const slots = r.shuffle(Array.from({ length: Math.min(def.maxHunters, 14) }, (_, i) => i)).slice(0, count);
    out.push({ t, slots, kinds: slots.map(() => r.next()) });
    t += Math.max(1.05, 2.5 - out.length * 0.07) + r.next() * 0.5;
  }
  return out;
}

export function newRun(level = 1) {
  const def = levelDef(level), perches = buildPerches(def);
  // start on the top perch of the tree nearest the middle of the bottom of the screen
  let bestTree = 0, bestScore = Infinity;
  def.trees.forEach((tr, i) => { const sc = Math.abs(tr.x - 360) + (1300 - tr.y) * 0.3; if (sc < bestScore) { bestScore = sc; bestTree = i; } });
  const topSlot = def.trees[bestTree].offs.findIndex((o) => o.dx === 0);
  const start = perches.findIndex((p) => p.tree === bestTree && p.slot === topSlot);
  return {
    level, name: def.name, duration: def.duration, trees: def.trees, perches,
    startHunters: def.startHunters, maxHunters: def.maxHunters, baseDiff: def.diff, feats: def.feats, blurb: def.blurb,
    ammo: 0, nuts: [], knocked: 0,
    wind: 0, windPhase: (level * 1.7) % 6.28, seeds: [], seedT: 4, seedsGot: 0, beaters: [], beaterT: 8, outsmarts: 0,
    chart: def.feats.boss ? makeChart(level, def) : null, chartIdx: 0,
    manual: level >= 2,
    t: 0, wave: 0, diff: def.diff, lives: T.LIVES, hits: 0, score: 0, dodges: 0, streak: 0, bestStreak: 0, combo: 1, closeCalls: 0,
    surviveAcc: 0, over: false, won: false,
    bird: { perch: start, from: start, dest: start, flit: -1, flitTime: 0.3, rest: 0, stun: 0, inv: 0, buf: 0, bufTap: null, lastFlitAt: -99 },
    hunters: SLOTS.map((_, i) => ({ slot: i, phase: 'idle', timer: 0, total: 1, kind: 'lob', target: start, flight: 1, cancel: false })),
    stones: [], volleyIn: T.FIRST_VOLLEY, nextId: 1, events: [],
  };
}

// A point a little above the perch, where the bird's body sits. `s` is the depth scale there.
export const perchPoint = (perches, i) => ({ x: perches[i].x, y: perches[i].y - 24 * perches[i].s, s: perches[i].s });

export function birdPoint(s) {
  const b = s.bird;
  if (b.flit < 0) return perchPoint(s.perches, b.perch);
  const a = perchPoint(s.perches, b.from), c = perchPoint(s.perches, b.dest), f = b.flit;
  const hop = Math.min(90, 40 + dist(a, c) * 0.12);
  return { x: lerp(a.x, c.x, f), y: lerp(a.y, c.y, f) - Math.sin(Math.PI * f) * hop, s: lerp(a.s, c.s, f) };
}

const currentPerch = (s) => (s.bird.flit >= 0 ? s.bird.dest : s.bird.perch);

// What is on its way: stones in the air and hunters mid pull-back (fakes still count: they look real).
function incoming(s) {
  const list = [];
  const add = (kind, target, at) => {
    if (kind === 'net') { const tr = s.perches[target].tree; s.perches.forEach((p, i) => { if (p.tree === tr) list.push({ perch: i, at }); }); }
    else list.push({ perch: target, at });
  };
  for (const st of s.stones) add(st.kind, st.target, st.flight - st.age);
  for (const h of s.hunters) if (h.phase === 'pull') add(h.kind, h.target, h.timer + h.flight);
  return list;
}

// The bird's escape rule. Among perches within reach: prefer one with no stone coming near it,
// farthest from the ones that are (and not much farther to fly than needed); if every perch is
// under a stone, the one whose first impact is latest. Ties: nearer, then lower index.
export function chooseDest(s, cur) {
  const from = perchPoint(s.perches, cur);
  const targets = incoming(s).map((q) => ({ ...perchPoint(s.perches, q.perch), at: q.at }));
  const pick = (reach) => {
    let best = -1, bestKey = -Infinity;
    for (let i = 0; i < s.perches.length; i++) {
      if (i === cur) continue;
      const pt = perchPoint(s.perches, i), df = dist(from, pt);
      if (df > reach) continue;
      let earliest = Infinity, near = 400;
      for (const q of targets) { const dq = dist(pt, q); if (dq < T.AVOID_R * Math.max(pt.s, q.s)) earliest = Math.min(earliest, q.at); near = Math.min(near, dq); }
      const key = earliest === Infinity ? 1000 + Math.min(near, 400) - 0.3 * df : earliest * 100 - 0.01 * df;
      if (key > bestKey || (key === bestKey && i < best)) { bestKey = key; best = i; }
    }
    return best;
  };
  const near = pick(T.REACH);
  return near >= 0 ? near : pick(Infinity);
}

function pullTime(d, kind) { return kind === 'arrow' ? Math.max(0.42, 0.62 - 0.02 * d) : Math.max(T.PULL_MIN, T.PULL_START - 0.07 * d); }
function flightOf(kind, d) {
  if (kind === 'arrow') return Math.max(0.5, 0.85 - 0.03 * d);
  if (kind === 'net') return T.NET_FLIGHT;
  const lob = kind === 'lob' || kind === 'skipper' || kind === 'leader';
  return Math.max(T.FLIGHT_MIN, lob ? T.LOB_FLIGHT - 0.05 * d : T.FLAT_FLIGHT - 0.04 * d);
}

function pickKind(s, rng) {
  const ok = KINDS.filter((k) => s.diff >= k.from && (!k.feat || s.feats[k.feat]) && !(k.kind === 'net' && s.trees.length < 2));
  let r = rng.next() * ok.reduce((a, k) => a + k.weight, 0);
  for (const k of ok) { r -= k.weight; if (r <= 0) return k.kind; }
  return 'lob';
}

function beginPull(s, h, kind) {
  const cur = currentPerch(s);
  h.kind = kind === 'double' ? 'flat' : kind;
  h.phase = 'pull';
  h.flight = flightOf(h.kind, s.diff);
  h.total = h.timer = pullTime(s.diff, h.kind);
  h.cancel = kind === 'fake';
  let target = kind === 'leader' ? chooseDest(s, cur) : cur;
  // wind carries the stone sideways: the ring goes where it will really land
  if (s.feats.wind && h.kind !== 'net' && Math.abs(s.wind) > 0.25) target = windLanding(s, target, s.wind * T.WIND_DRIFT * h.flight);
  h.target = target;
  s.events.push({ t: 'pull', slot: h.slot, kind: h.kind });
}

function windLanding(s, idx, drift) {
  const p = perchPoint(s.perches, idx), gx = p.x + drift;
  let best = idx, bd = Infinity;
  for (let i = 0; i < s.perches.length; i++) {
    const q = perchPoint(s.perches, i), d = Math.abs(q.x - gx) + 1.5 * Math.abs(q.y - p.y);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

const activeCount = (s) => Math.min(s.maxHunters, s.startHunters + s.wave);
export const shownHunters = (s) => activeCount(s);

function startVolley(s, rng) {
  const idle = s.hunters.filter((h) => h.slot < activeCount(s) && h.phase === 'idle');
  const count = Math.min(idle.length, Math.min(5, 1 + Math.floor(s.diff / 3)));
  const pool = rng.shuffle(idle);
  for (let i = 0; i < count; i++) {
    const kind = pickKind(s, rng), h = pool[i];
    h.phase = 'queued'; h.timer = i * T.STAGGER; h._kind = kind;
    if (kind === 'double') {
      const twin = pool.slice(count).find((x) => x.phase === 'idle');
      if (twin) { twin.phase = 'queued'; twin.timer = i * T.STAGGER; twin._kind = 'flat'; }
    }
  }
}

// A boss volley from the fixed chart: same hunters, same kinds, same moments every attempt.
function chartVolley(s, v) {
  const kinds = KINDS.filter((k) => s.diff >= k.from && (!k.feat || s.feats[k.feat]) && !(k.kind === 'net' && s.trees.length < 2));
  const total = kinds.reduce((a, k) => a + k.weight, 0);
  const boss = s.hunters[BOSS_SLOT];
  if (boss.phase === 'idle') { boss.phase = 'queued'; boss.timer = 0; boss._kind = 'flat'; }
  v.slots.forEach((slot, i) => {
    const h = s.hunters[slot]; if (h.phase !== 'idle') return;
    let r = v.kinds[i] * total, kind = 'lob';
    for (const k of kinds) { r -= k.weight; if (r <= 0) { kind = k.kind; break; } }
    h.phase = 'queued'; h.timer = (i + 1) * T.STAGGER; h._kind = kind === 'double' ? 'flat' : kind;
  });
  s.events.push({ t: 'boss' });
}

function launch(s, h) {
  s.stones.push({
    id: s.nextId++, slot: h.slot, kind: h.kind, target: h.target, flight: h.flight, age: 0,
    threat: currentPerch(s) === h.target || (h.kind === 'net' && s.perches[currentPerch(s)].tree === s.perches[h.target].tree), arc: h.kind === 'flat' ? 40 : h.kind === 'arrow' ? 14 : 260, follow: false,
  });
  h.phase = 'cool'; h.timer = 0.6;
  s.events.push({ t: 'launch', slot: h.slot, kind: h.kind });
}

// Another perch on the same tree for a skipping stone to hop to.
function neighbour(s, idx) {
  const me = s.perches[idx], same = s.perches.map((p, i) => ({ p, i })).filter((q) => q.p.tree === me.tree && q.i !== idx);
  same.sort((a, b) => Math.abs(a.p.slot - me.slot) - Math.abs(b.p.slot - me.slot));
  return same.length ? same[0].i : idx;
}

function gainAmmo(s) {
  if (!s.feats.hitback || s.ammo >= T.AMMO_MAX) return;
  s.ammo += 1; s.events.push({ t: 'ammo' });
}

// Tap a hunter while you hold an acorn: throw it. Returns true if a nut was thrown.
function tryThrow(s, tap) {
  if (!s.feats.hitback || s.ammo <= 0 || typeof tap !== 'object' || !tap) return false;
  const shown = activeCount(s);
  let best = null, bd = Infinity;
  for (const h of s.hunters) {
    if (h.phase === 'stunned' || !(h.slot < shown || (s.feats.boss && h.slot === BOSS_SLOT))) continue;
    const sl = SLOTS[h.slot], c = { x: sl.x, y: sl.y - 75 * sl.s }, d = dist(c, tap);
    if (d < 62 * Math.max(sl.s, 0.6) + 34 && d < bd) { bd = d; best = h; }
  }
  if (!best) return false;
  s.ammo -= 1;
  const from = birdPoint(s);
  s.nuts.push({ slot: best.slot, age: 0, flight: T.NUT_FLIGHT, from: { x: from.x, y: from.y } });
  s.events.push({ t: 'throw' });
  return true;
}

function land(s, st) {
  const at = perchPoint(s.perches, st.target), bp = birdPoint(s);
  let near = dist(at, bp) < T.HIT_R * Math.max(at.s, bp.s, 0.55);
  if (st.kind === 'net') {
    const tr = s.trees[s.perches[st.target].tree], c = { x: tr.x, y: tr.y - 210 * tr.s }, R = 215 * tr.s + 34;
    near = dist(c, bp) < R;
    s.events.push({ t: 'net', x: c.x, y: c.y, r: R });
  }
  const b = s.bird;
  if (near && b.inv <= 0) {
    s.lives -= 1; s.hits += 1; b.stun = T.STUN; b.inv = T.INVULN; s.streak = 0; s.combo = 1;
    s.events.push({ t: 'hit', x: bp.x, y: bp.y });
    if (s.lives <= 0) { s.over = true; s.events.push({ t: 'over' }); }
  } else if (!st.follow) {
    const close = st.threat && s.t - b.lastFlitAt <= T.CLOSE_CALL && !near;
    s.dodges += 1; s.streak += 1; s.bestStreak = Math.max(s.bestStreak, s.streak);
    s.combo = Math.min(5, 1 + Math.floor(s.streak / 5));
    s.score += (close ? 5 : 1) * s.combo;
    if (close) { s.closeCalls += 1; gainAmmo(s); }
    if (s.streak > 0 && s.streak % 5 === 0) gainAmmo(s);
    s.events.push({ t: 'dodge', close, x: at.x, y: at.y });
  }
  s.events.push({ t: 'thud', x: at.x, y: at.y });
  if (st.kind === 'skipper' && !st.follow) {
    s.stones.push({ id: s.nextId++, slot: -1, kind: 'skip', target: neighbour(s, st.target), flight: 0.4, age: 0, threat: false, arc: 30, follow: true, fromPerch: st.target });
  }
}

// Is a stone (or a pull-back) coming near the bird's own perch right now?
export function threatened(s) {
  const here = perchPoint(s.perches, currentPerch(s));
  return incoming(s).some((q) => dist(perchPoint(s.perches, q.perch), here) < T.AVOID_R * Math.max(here.s, 0.6));
}

// From level 2 the player chooses: the perch nearest the tap, among those the bird can reach.
// Returns -1 when the tap is nearest the perch the bird is already on (nothing to do).
function pickByTap(s, tap) {
  const cur = currentPerch(s), from = perchPoint(s.perches, cur);
  let best = -1, bd = Infinity;
  for (let i = 0; i < s.perches.length; i++) {
    const pt = perchPoint(s.perches, i);
    if (i !== cur && dist(from, pt) > T.REACH * 1.25) continue;
    const d = dist(pt, tap);
    if (d < bd) { bd = d; best = i; }
  }
  return best === cur ? -1 : best;
}

function startFlit(s, dest, forced) {
  const b = s.bird;
  b.from = b.flit >= 0 ? b.dest : b.perch; b.dest = dest; b.flit = 0; b.lastFlitAt = s.t;
  if (forced) { b.rest = 0; b.stun = 0; }
  b.flitTime = T.FLIT_BASE + dist(perchPoint(s.perches, b.from), perchPoint(s.perches, b.dest)) / T.FLIT_SPEED;
  s.events.push({ t: 'flit', from: b.from, dest: b.dest, forced });
}

// A tap while a stone is coming near you means escape. A tap while nothing threatens you means
// "go for the nearest safe golden seed" if there is one in reach, otherwise a short safe hop.
function chooseTarget(s) {
  const b = s.bird, here = perchPoint(s.perches, b.perch), inc = incoming(s);
  const near = (i) => inc.some((q) => dist(perchPoint(s.perches, q.perch), perchPoint(s.perches, i)) < T.AVOID_R * Math.max(s.perches[i].s, 0.6));
  if (s.seeds.length && !near(b.perch)) {
    let best = -1, bd = Infinity;
    for (const sd of s.seeds) {
      const d = dist(here, perchPoint(s.perches, sd.perch));
      if (sd.perch !== b.perch && d <= T.REACH && !near(sd.perch) && d < bd) { bd = d; best = sd.perch; }
    }
    if (best >= 0) return best;
  }
  return chooseDest(s, b.perch);
}

// Advance one tick. `tap` is true on the tick the player presses.
export function step(s, dt, tap, rng) {
  s.events.length = 0;
  if (s.over || s.won) return;
  const b = s.bird;
  s.t += dt;
  s.wave = Math.floor(s.t / T.WAVE_LEN);
  s.diff = s.baseDiff + s.wave;
  if (s.feats.wind) s.wind = s.feats.wind * Math.sin(s.t * 0.42 + s.windPhase) * (0.75 + 0.25 * Math.sin(s.t * 1.3));
  s.surviveAcc += dt;
  while (s.surviveAcc >= 2) { s.surviveAcc -= 2; s.score += 1; }

  b.rest = Math.max(0, b.rest - dt); b.stun = Math.max(0, b.stun - dt); b.inv = Math.max(0, b.inv - dt); b.buf = Math.max(0, b.buf - dt);
  if (tap && tryThrow(s, tap)) tap = false;
  if (tap) { b.buf = T.BUFFER; b.bufTap = typeof tap === 'object' ? tap : null; }
  if (b.buf > 0 && b.flit < 0 && b.rest <= 0 && b.stun <= 0) {
    const dest = s.manual && b.bufTap ? pickByTap(s, b.bufTap) : chooseTarget(s);
    if (dest >= 0 && dest !== b.perch) startFlit(s, dest, false);
    b.buf = 0;
  }
  if (b.flit >= 0) {
    b.flit += dt / b.flitTime;
    if (b.flit >= 1) {
      b.flit = -1; b.perch = b.dest; b.rest = T.REST;
      const k = s.seeds.findIndex((sd) => sd.perch === b.perch);
      if (k >= 0) {
        s.seeds.splice(k, 1); s.seedsGot += 1; s.score += T.SEED_POINTS;
        s.events.push({ t: 'seed', x: perchPoint(s.perches, b.perch).x, y: perchPoint(s.perches, b.perch).y });
        if (s.seedsGot % 3 === 0 && s.lives < T.LIVES) { s.lives += 1; s.events.push({ t: 'heal' }); }
      }
    }
  }

  // golden seeds appear on perches away from the bird and fade if ignored
  if (s.feats.seeds) {
    for (const sd of s.seeds) sd.ttl -= dt;
    s.seeds = s.seeds.filter((sd) => sd.ttl > 0);
    s.seedT -= dt;
    if (s.seedT <= 0) {
      s.seedT = T.SEED_EVERY + rng.next() * 2.5;
      if (s.seeds.length < 2) {
        const here = currentPerch(s), opts = [];
        s.perches.forEach((p, i) => { if (i !== here && !s.seeds.some((x) => x.perch === i) && dist(perchPoint(s.perches, i), perchPoint(s.perches, here)) < T.REACH) opts.push(i); });
        if (opts.length) { s.seeds.push({ perch: opts[rng.int(opts.length)], ttl: T.SEED_TTL }); s.events.push({ t: 'seedAppears' }); }
      }
    }
  }

  // beaters rattle the bird's perch, then flush it off; leaving in time is rewarded
  if (s.feats.beaters) {
    s.beaterT -= dt;
    if (s.beaterT <= 0) { s.beaterT = T.BEATER_EVERY + rng.next() * 4; if (s.beaters.length === 0) { s.beaters.push({ perch: currentPerch(s), timer: T.BEATER_TIME, total: T.BEATER_TIME }); s.events.push({ t: 'beater' }); } }
    for (const bt of s.beaters) {
      bt.timer -= dt;
      if (bt.timer <= 0) {
        if (b.perch === bt.perch && b.flit < 0) { startFlit(s, chooseDest(s, b.perch), true); s.events.push({ t: 'flush' }); }
        else { s.outsmarts += 1; s.score += 3 * s.combo; s.events.push({ t: 'outsmart' }); }
      }
    }
    s.beaters = s.beaters.filter((bt) => bt.timer > 0);
  }

  if (s.chart) {
    while (s.chartIdx < s.chart.length && s.t >= s.chart[s.chartIdx].t) { chartVolley(s, s.chart[s.chartIdx]); s.chartIdx += 1; }
  } else {
    s.volleyIn -= dt;
    if (s.volleyIn <= 0) { startVolley(s, rng); s.volleyIn = Math.max(T.GAP_MIN, T.GAP_START - 0.12 * s.diff); }
  }

  for (const h of s.hunters) {
    if (h.phase === 'queued') { h.timer -= dt; if (h.timer <= 0) beginPull(s, h, h._kind); }
    else if (h.phase === 'pull') {
      h.timer -= dt;
      if (h.timer <= 0) { if (h.cancel) { h.phase = 'cool'; h.timer = 0.8; s.events.push({ t: 'fake', slot: h.slot }); } else launch(s, h); }
    } else if (h.phase === 'cool' || h.phase === 'stunned') { h.timer -= dt; if (h.timer <= 0) h.phase = 'idle'; }
  }

  for (const n of s.nuts) n.age += dt;
  for (const n of s.nuts.filter((x) => x.age >= x.flight)) {
    const h = s.hunters[n.slot];
    if (h.phase !== 'stunned') {
      h.phase = 'stunned'; h.timer = T.HUNTER_STUN; h.cancel = false;
      s.knocked += 1; s.score += (n.slot === BOSS_SLOT ? 3 : 1) * T.KNOCK_POINTS * s.combo;
      s.events.push({ t: 'knock', slot: n.slot });
    }
  }
  s.nuts = s.nuts.filter((x) => x.age < x.flight);

  const done = [];
  for (const st of s.stones) { st.age += dt; if (st.age >= st.flight) done.push(st); }
  for (const st of done) { s.stones.splice(s.stones.indexOf(st), 1); land(s, st); }

  if (!s.over && s.t >= s.duration) { s.won = true; s.stones.length = 0; s.events.push({ t: 'won' }); }
}

export const stars = (s) => (s.won ? Math.max(1, 3 - s.hits) : 0);

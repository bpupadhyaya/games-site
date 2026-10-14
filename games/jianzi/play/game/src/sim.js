// Jianzi simulation: a feather shuttle with real drag, wind, kicks decided by strike height, the four-person circle and the
// scoring (style multiplier, named combos). Pure and deterministic: randomness only from the rng streams handed in, time only
// from dt. Everything lives in plain objects so getState() is serializable.

export const G = 9;            // gravity falling
export const GU = 11;          // gravity while rising (the base-first shuttle slows quickly)
export const VT = 2.2;         // terminal fall speed of the feathers (m/s)
export const K = G / (VT * VT);
export const KH = 0.6;         // horizontal air drag
export const REACH = 1.05;     // how far from their spot a player can step to reach the shuttle (m)
export const BAND_TOP = 0.88;  // the shuttle can be struck below this height
export const GROUND_HIT = 0.02;

// Standing spots on the ground: 0 you, 1 left partner, 2 far partner, 3 right partner (x lateral, z away from the camera).
// Solo: you stand at the centre. Circle: a diamond seen from the front: you front-left, Lin left, Mei far right, Bao right.
export const SOLO_SPOTS = [{ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 0 }];
export const CIRCLE_SPOTS = [{ x: -0.75, z: 0 }, { x: -2.55, z: 1.45 }, { x: 0.75, z: 3.0 }, { x: 2.55, z: 1.45 }];
export const SPOTS = CIRCLE_SPOTS;
export const PARTNERS = [
  null,
  { name: 'Lin', skill: 0.62, tag: 'Steady and kind to your passes' },
  { name: 'Mei', skill: 0.78, tag: 'Quick feet, loves the far spot' },
  { name: 'Bao', skill: 0.5, tag: 'Still learning, needs clean passes' },
];
export const CIRCLE_SESSION = 24; // kicks in a Watch & Learn circle

export const KINDS = {
  scoop: { name: 'Toe scoop', cn: 'Tiao', c: 0.09, h: 0.07, peak: 1.15, lat: 0.55, noise: 0.55, base: 4 },
  inside: { name: 'Inside kick', cn: 'Pan', c: 0.3, h: 0.16, peak: 2.3, lat: 0, noise: 0.3, base: 10 },
  outside: { name: 'Outside kick', cn: 'Guai', c: 0.3, h: 0.16, peak: 1.95, lat: 1.25, noise: 0.42, base: 14 },
  knee: { name: 'Knee kick', cn: 'Ke', c: 0.66, h: 0.2, peak: 1.55, lat: 0.75, noise: 0.4, base: 18 },
};

export const TRICKS = [
  { id: 'riseFall', name: 'Rise and Fall', seq: ['inside', 'knee', 'inside'], pts: 60, how: 'Inside, Knee, Inside' },
  { id: 'doubleKnee', name: 'Double Knee', seq: ['knee', 'knee'], pts: 40, how: 'Knee, Knee' },
  { id: 'lowHigh', name: 'Low and High', seq: ['scoop', 'knee'], pts: 50, how: 'Toe scoop, then Knee' },
  { id: 'ladder', name: 'Ladder', seq: ['scoop', 'inside', 'knee'], pts: 90, how: 'Toe scoop, Inside, Knee' },
  { id: 'sideSweep', name: 'Side Sweep', seq: ['outside', 'inside', 'outside'], pts: 80, how: 'Outside, Inside, Outside' },
  { id: 'cross', name: 'Cross Step', seq: ['outL', 'outR'], pts: 70, how: 'Outside left, then outside right' },
  { id: 'pendulum', name: 'Pendulum', seq: ['outL', 'inside', 'outR'], pts: 100, how: 'Outside left, Inside, Outside right' },
  { id: 'fullRound', name: 'Full Round', seq: ['inside', 'outL', 'knee', 'outR'], pts: 150, how: 'Inside, Outside left, Knee, Outside right' },
];
const famOf = (k) => (k === 'outL' || k === 'outR' ? 'outside' : k);
const seqMatch = (hist, seq) => {
  if (hist.length < seq.length) return false;
  const tail = hist.slice(hist.length - seq.length);
  return seq.every((s, i) => (s === 'outside' ? famOf(tail[i]) === 'outside' : tail[i] === s));
};

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
// A small seeded stream used for the daily wind (the same for everybody that day) without touching env.rng.
export function seeded(seed) {
  let s = (seed >>> 0) || 1;
  const next = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, range: (a, b) => a + (b - a) * next() };
}
const gauss = (r) => (r.next() + r.next() + r.next() + r.next() - 2) * 1.2247;

// ---- wind ------------------------------------------------------------------------------------------------------------
export function makeWind(src) {
  const gusts = [];
  let t = 3 + src.range(0, 3);
  for (let i = 0; i < 60; i++) { gusts.push({ t0: t, dur: 1.3 + src.range(0, 1.1), a: (src.next() < 0.5 ? -1 : 1) * (0.5 + src.next() * 0.7) }); t += 4.5 + src.range(0, 4.5); }
  return { p1: src.range(0, 6.28), p2: src.range(0, 6.28), gusts };
}
export function windAt(run, t) {
  const w = run.wind, A = run.windAmp;
  let v = 0.55 * Math.sin(0.5 * t + w.p1) + 0.35 * Math.sin(1.17 * t + w.p2);
  for (const g of w.gusts) {
    if (t < g.t0) break;
    const u = (t - g.t0) / g.dur;
    if (u >= 0 && u <= 1) v += g.a * Math.pow(Math.sin(Math.PI * u), 2);
  }
  return A * v;
}
// What the wind will do in the next seconds, for the flag's forecast strip.
export const windForecast = (run, from, secs, n) => { const o = []; for (let i = 0; i < n; i++) o.push(windAt(run, from + (secs * i) / (n - 1))); return o; };

// ---- shuttle physics -------------------------------------------------------------------------------------------------
export function stepShuttle(sh, dt, wx) {
  const n = 3, h = dt / n;
  for (let i = 0; i < n; i++) {
    const rx = sh.vx - wx, rz = sh.vz, sp = Math.hypot(rx, rz);
    sh.vx += -KH * sp * rx * h; sh.vz += -KH * sp * rz * h;
    sh.vy += (sh.vy > 0 ? -GU : -G + K * sh.vy * sh.vy) * h;
    sh.x += sh.vx * h; sh.z += sh.vz * h; sh.y += sh.vy * h;
  }
  // The feathers trail: they point away from the direction of travel; at the top of the flight the shuttle tumbles over.
  const sp = Math.hypot(sh.vx, sh.vy);
  const des = sp < 0.25 ? 0 : Math.atan2(-sh.vx, -sh.vy) * (sp < 1.2 ? sp / 1.2 : 1);
  sh.av += (wrapPi(des - sh.ang) * 38 - sh.av * 6.5) * dt;
  sh.ang = wrapPi(sh.ang + sh.av * dt);
}
const cloneSh = (s) => ({ x: s.x, z: s.z, y: s.y, vx: s.vx, vz: s.vz, vy: s.vy, ang: 0, av: 0 });
// Where the shuttle will be when it comes down to height yTo (wind held at its value now).
export function predictLanding(sh, wx, yTo = 0.3) {
  const s = cloneSh(sh);
  let t = 0;
  for (let i = 0; i < 420; i++) {
    stepShuttle(s, 1 / 60, wx); t += 1 / 60;
    if (s.vy < 0 && s.y <= yTo) return { x: s.x, z: s.z, t, y: s.y };
  }
  return { x: s.x, z: s.z, t, y: s.y };
}
// Launch velocity that lifts the shuttle `peak` metres above the contact point (rising uses the lighter gravity).
export const v0ForPeak = (peak) => Math.sqrt(2 * GU * Math.max(0.2, peak));
// Horizontal velocity that carries a shuttle kicked from (x,z,y) to land on (tx,tz) at height 0.3, by iterating the real physics.
export function solveShot(from, target, peak, wx) {
  const vy = v0ForPeak(peak);
  const eval1 = (vx, vz) => predictLanding({ x: from.x, z: from.z, y: from.y, vx, vz, vy, ang: 0, av: 0 }, wx, 0.3);
  let vx = (target.x - from.x) / 1.7, vz = (target.z - from.z) / 1.7;
  let p = eval1(vx, vz), gx = 0.5, gz = 0.5;
  for (let i = 0; i < 7; i++) {
    const ex = target.x - p.x, ez = target.z - p.z;
    if (Math.abs(ex) < 0.03 && Math.abs(ez) < 0.03) break;
    const nvx = vx + ex / gx, nvz = vz + ez / gz;
    const q = eval1(nvx, nvz);
    if (Math.abs(nvx - vx) > 1e-4) gx = clamp((q.x - p.x) / (nvx - vx), 0.12, 1.5);
    if (Math.abs(nvz - vz) > 1e-4) gz = clamp((q.z - p.z) / (nvz - vz), 0.12, 1.5);
    vx = nvx; vz = nvz; p = q;
  }
  return { vx, vz, vy, land: p };
}

// ---- kicks -----------------------------------------------------------------------------------------------------------
// pad: -1 left, 0 up, 1 right (solo: steer; circle: handled by the caller through the target).
export function kindFor(y, pad) {
  if (y < 0.16) return 'scoop';
  if (y < 0.48) return pad === 0 ? 'inside' : 'outside';
  return 'knee';
}
export function qualityFor(kind, y) {
  const k = KINDS[kind], d = Math.abs(y - k.c) / k.h;
  const q = 1 - 0.85 * Math.min(1, Math.pow(d, 1.35));
  return { q: clamp(q, 0.15, 1), perfect: kind !== 'scoop' && Math.abs(y - k.c) <= 0.075 };
}
// Difficulty by chain length: wind grows, kicks get lower and so the rhythm quickens.
export const windAmpFor = (n, circle) => Math.min(circle ? 1.2 : 1.55, 0.18 + 0.021 * n);
export const loftFor = (n) => Math.max(0.72, 1 - 0.0045 * n);

export function newRun(cfg, rng) {
  const src = cfg.mode === 'daily' ? seeded((cfg.day | 0) * 7919 + 17) : seeded(rng.int(1e9) + 1);
  const circle = cfg.mode === 'circle' || cfg.mode === 'watch';
  return {
    mode: cfg.mode, circle, spots: (circle ? CIRCLE_SPOTS : SOLO_SPOTS).map((p) => ({ ...p })), day: cfg.day | 0, t: 0, over: null,
    wind: makeWind(src), windAmp: windAmpFor(0, circle), wx: 0,
    sh: { x: circle ? -0.6 : 0.1, z: 0, y: 2.0, vx: 0, vz: 0, vy: -0.4, ang: 0.35, av: 0 },
    expect: 0, from: 0, px: (circle ? CIRCLE_SPOTS : SOLO_SPOTS).map((p) => p.x), pz: (circle ? CIRCLE_SPOTS : SOLO_SPOTS).map((p) => p.z), lock: 0,
    streak: 0, points: 0, perfects: 0, kinds: [], recent: [], mult: 1, touches: [0, 0, 0, 0], lastTouch: [0, 0, 0, 0], tricks: [], trickNames: [],
    anim: [null, null, null, null], events: [], passQ: null, fair: 0, kicksBy: [0, 0, 0, 0],
    evSeq: 0, evDone: 0, hPerfects: 0, hints: 0, trail: [], yPlan: [0, 0.3, 0.3, 0.3], toss: true, gaugeFlash: 0, airKicks: 0, cause: '', best: 0,
  };
}
const pushEv = (run, e) => { run.events.push({ ...e, at: run.t, seq: run.evSeq++ }); if (run.events.length > 40) run.events.shift(); };

// Scoring of one successful kick by anyone. Returns { gained, trick }.
export function scoreKick(run, who, kind, side, q, perfect) {
  const fam = kind === 'outside' ? (side < 0 ? 'outL' : 'outR') : kind;
  run.kinds.push(fam); if (run.kinds.length > 8) run.kinds.shift();
  run.recent.push(famOf(fam)); if (run.recent.length > 4) run.recent.shift();
  const distinct = new Set(run.recent).size;
  run.mult = 1 + 0.5 * (distinct - 1) + (run.recent.length >= 4 && distinct === 4 ? 0.5 : 0);
  run.streak++; run.kicksBy[who]++; run.touches[who]++; run.lastTouch[who] = run.streak;
  let gained = Math.round(KINDS[kind].base * run.mult * (perfect ? 1.5 : 0.7 + 0.3 * q));
  if (perfect) run.perfects++;
  let trick = null;
  for (const tr of TRICKS) if (seqMatch(run.kinds, tr.seq) && (!trick || tr.seq.length > trick.seq.length)) trick = tr;
  if (trick) { gained += trick.pts; run.tricks.push(trick.id); run.trickNames.push(trick.name); run.kinds.length = 0; }
  run.points += gained;
  run.windAmp = windAmpFor(run.streak, run.circle);
  return { gained, trick };
}

// The human kick. Returns the kick record or null when nothing was struck.
export function humanKick(run, pad, rngK, wx, hint) {
  const sh = run.sh;
  const kind = kindFor(sh.y, run.circle ? (pad !== 0 && pad !== 2 ? 1 : 0) : pad);
  const side = run.circle ? (pad === 1 ? -1 : pad === 3 ? 1 : 0) : pad;
  const { q, perfect } = qualityFor(kind, sh.y);
  const K0 = KINDS[kind], loft = loftFor(run.streak);
  const peak = K0.peak * loft * (0.82 + 0.18 * q);
  const from = { x: sh.x, z: sh.z, y: sh.y };
  const sigma = 0.06 + K0.noise * (1 - q) * 0.9;
  let fair = false;
  if (run.circle) {
    const tgt = run.spots[pad];
    const err = 0.05 + 0.5 * (1 - q) * (kind === 'knee' ? 1.1 : 1);
    const target = { x: tgt.x + gauss(rngK) * err * 0.7, z: tgt.z + gauss(rngK) * err * 0.7 };
    const s = solveShot(from, target, peak, wx);
    sh.vx = s.vx; sh.vz = s.vz; sh.vy = s.vy;
    run.passQ = { to: pad, err: Math.hypot(target.x - tgt.x, target.z - tgt.z) };
    fair = run.streak - run.lastTouch[pad] >= 4;
    run.expect = pad; run.from = 0;
  } else {
    sh.vx = side * K0.lat + gauss(rngK) * sigma; sh.vz = gauss(rngK) * 0.05; sh.vy = v0ForPeak(peak);
    if (kind === 'scoop' && side === 0) sh.vx += (sh.x < 0 ? 0.35 : -0.35);
    run.expect = 0; run.from = 0;
  }
  sh.av += (gauss(rngK) + (side || 1)) * 5;
  const sc = scoreKick(run, 0, kind, side, q, perfect);
  if (fair) { sc.gained += 10; run.points += 10; run.fair++; }
  if (perfect) run.hPerfects++;
  run.anim[0] = { t: 0, kind, side, cx: from.x, cy: from.y, cz: from.z, perfect };
  run.lock = 0.16;
  const rec = { who: 0, kind, side, q, perfect, y: from.y, gained: sc.gained, trick: sc.trick ? sc.trick.name : null, pad, fair };
  pushEv(run, { type: 'kick', ...rec, x: from.x, z: from.z });
  return rec;
}

// A partner kick (circle). Chooses a target with `choose`, which returns an index in 0..3.
export function partnerKick(run, who, rngA, rngK, wx, target) {
  const sh = run.sh, pf = PARTNERS[who];
  const kind = run.yPlan[who] > 0.5 ? 'knee' : 'inside';
  const q = clamp(pf.skill - 0.2 + 0.4 * rngA.next(), 0.35, 1);
  const perfect = q > 0.88;
  const K0 = KINDS[kind], loft = loftFor(run.streak);
  const peak = (K0.peak + 0.25 + 0.2 * rngA.next()) * loft * (0.82 + 0.18 * q);
  const from = { x: sh.x, z: sh.z, y: sh.y };
  const tg = run.spots[target];
  const err = 0.07 + 0.42 * (1 - q);
  const aim = { x: tg.x + gauss(rngK) * err * 0.7, z: tg.z + gauss(rngK) * err * 0.7 };
  const s = solveShot(from, aim, peak, wx);
  sh.vx = s.vx; sh.vz = s.vz; sh.vy = s.vy; sh.av += (rngA.next() - 0.5) * 9;
  run.expect = target; run.from = who; run.passQ = { to: target, err: Math.hypot(aim.x - tg.x, aim.z - tg.z) };
  const side = tg.x < run.spots[who].x ? -1 : 1;
  const sc = scoreKick(run, who, kind, side, q, perfect);
  run.anim[who] = { t: 0, kind: kind === 'knee' ? 'knee' : 'inside', side, cx: from.x, cy: from.y, cz: from.z, perfect };
  pushEv(run, { type: 'kick', who, kind, side, q, perfect, y: from.y, gained: sc.gained, trick: sc.trick ? sc.trick.name : null, x: from.x, z: from.z, pad: target });
  return { who, kind, q };
}

// Partner picks who to pass to: prefers someone who has not touched it for a while, and often you.
export function choosePass(run, who, rngA) {
  const opts = [0, 1, 2, 3].filter((i) => i !== who);
  const w = opts.map((i) => 1 + Math.min(4, (run.streak - run.lastTouch[i]) * 0.5) + (i === 0 ? 1.4 : 0));
  let r = rngA.next() * w.reduce((a, b) => a + b, 0);
  for (let k = 0; k < opts.length; k++) { r -= w[k]; if (r <= 0) return opts[k]; }
  return opts[opts.length - 1];
}

// ---- the per-tick step -----------------------------------------------------------------------------------------------
// Moves players, steps the shuttle, lets partners kick, detects drops. `ctl` = { frozen, onPartner(who) }.
export function stepRun(run, dt, rngA, rngK) {
  if (run.over) return;
  run.t += dt;
  const wx = windAt(run, run.t); run.wx = wx;
  const sh = run.sh;
  stepShuttle(sh, dt, wx);
  run.trailT = (run.trailT || 0) + dt;
  if (run.trailT >= 0.04) { run.trailT = 0; run.trail.push({ x: sh.x, y: sh.y, z: sh.z }); if (run.trail.length > 12) run.trail.shift(); }
  if (run.lock > 0) run.lock = Math.max(0, run.lock - dt);
  if (run.gaugeFlash > 0) run.gaugeFlash = Math.max(0, run.gaugeFlash - dt);
  for (let i = 0; i < 4; i++) if (run.anim[i]) { run.anim[i].t += dt; if (run.anim[i].t > 1.4) run.anim[i] = null; }
  // players step toward the shuttle when it is theirs, else drift back to their spot
  for (let i = 0; i < 4; i++) {
    if (!run.circle && i > 0) continue;
    const sp = run.spots[i], mine = run.expect === i && sh.vy < 0.5;
    const want = mine ? clamp(sh.x, sp.x - REACH, sp.x + REACH) : sp.x;
    const wantZ = mine ? clamp(sh.z, sp.z - REACH, sp.z + REACH) : sp.z;
    const spd = (mine ? 3.4 : 1.5) * dt;
    run.px[i] += clamp(want - run.px[i], -spd, spd); run.pz[i] += clamp(wantZ - run.pz[i], -spd, spd);
  }
  // a partner's strike
  if (run.circle && run.expect !== 0 && sh.vy < 0) {
    const who = run.expect;
    if (!run.yPlan) run.yPlan = [0, 0, 0, 0];
    if (sh.y <= run.yPlan[who] && sh.y > GROUND_HIT) {
      const d = Math.hypot(sh.x - run.spots[who].x, sh.z - run.spots[who].z), reach = 0.55 + 0.5 * PARTNERS[who].skill;
      if (d <= reach) {
        const target = choosePass(run, who, rngA);
        const rec = partnerKick(run, who, rngA, rngK, wx, target);
        run.yPlan[who] = rngA.next() < 0.28 ? 0.62 : 0.3;
        return rec;
      }
    }
  }
  // the ground
  if (sh.y <= GROUND_HIT && sh.vy < 0) {
    sh.y = GROUND_HIT; run.over = { streak: run.streak, points: run.points, who: run.expect, wide: Math.hypot(sh.x - run.spots[run.expect].x, sh.z - run.spots[run.expect].z) };
    pushEv(run, { type: 'drop', who: run.expect, x: sh.x, z: sh.z });
  }
  return null;
}
export function planYs(run, rngA) { run.yPlan = [0, rngA.next() < 0.28 ? 0.62 : 0.3, rngA.next() < 0.28 ? 0.62 : 0.3, rngA.next() < 0.28 ? 0.62 : 0.3]; }

// Is the shuttle currently in the human's strike band?
export const inBand = (run) => run.expect === 0 && run.sh.vy < 0 && run.sh.y <= BAND_TOP && run.sh.y > GROUND_HIT && !run.over;
export const inReach = (run) => Math.hypot(run.sh.x - run.spots[0].x, run.sh.z - run.spots[0].z) <= REACH + 0.1;

// ---- advice (Think hint and Watch & Learn) -----------------------------------------------------------------------------
// The pad to press for the next kick and the height to strike at, with a plain-language reason.
export function advise(run) {
  const wx = run.wx, sh = run.sh;
  if (run.circle) {
    let best = 1, bs = -1e9;
    for (const i of [1, 2, 3]) {
      const stale = run.streak - run.lastTouch[i];
      const sc = stale * 1 - PARTNERS[i].skill * 0.5 + (i === 2 ? 0.2 : 0);
      if (sc > bs) { bs = sc; best = i; }
    }
    const nm = PARTNERS[best].name;
    const repeat = run.recent.length >= 2 && run.recent[run.recent.length - 1] === 'inside' && run.recent[run.recent.length - 2] === 'inside';
    const knee = repeat;
    return { pad: best, y: knee ? 0.62 : 0.3, why: `${nm} has waited the longest, so pass to ${nm}.${knee ? ' Strike with the knee for a higher style multiplier.' : ''}` };
  }
  const pl = predictLanding(sh, wx, 0.3);
  let best = 0, bd = 1e9;
  for (const pad of [-1, 0, 1]) {
    const kind = kindFor(0.3, pad), K0 = KINDS[kind];
    const vx = pad * K0.lat;
    const fl = predictLanding({ x: pl.x, z: 0, y: 0.3, vx, vz: 0, vy: v0ForPeak(K0.peak * loftFor(run.streak)), ang: 0, av: 0 }, wx, 0.3);
    const d = Math.abs(fl.x - 0) + (pad === 0 ? 0 : 0.0);
    if (d < bd) { bd = d; best = pad; }
  }
  const dirWord = wx > 0.2 ? 'from the left, pushing it right' : wx < -0.2 ? 'from the right, pushing it left' : 'light';
  const why = best === 0 ? `Wind is ${dirWord}. It lands near you: kick straight up with the inside foot.`
    : `Wind is ${dirWord}. It would land ${pl.x > 0 ? 'right' : 'left'} of you: kick ${best < 0 ? 'left' : 'right'} with the outside foot to bring it back.`;
  return { pad: best, y: 0.3, why };
}

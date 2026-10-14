// Intha Leg Rowing: the simulation. Pure and deterministic: all time comes from the dt handed to stepWorld, all chance from W.rng.
// One boat model drives the player, the rivals and the Watch and Learn performer; they differ only in the command they issue.
//
// The command is { hold, pad }: while the thumb is down (hold) the oar is in the water and follows pad in -1..1 (left..right).
//   speed   comes from how fast the oar sweeps through the water (it is capped, and frantic sweeping costs poise)
//   steer   comes from where the sweeps are centred: sweep on the side you want to go
//   poise   is the rower's balance: swells, stakes, banks and frantic strokes cost it, smooth strokes and a still oar restore it
//   net     charges while a shoal is in the net zone, the oar is still and the boat has slowed
import { COURSES, centreAt, halfWidthAt, swellAt, sectionsOf } from './courses.js';

export const PHYS = {
  VMAX: 5.0, KT: 0.9, DRAG1: 0.35, DRAG2: 0.04, HYAC_DRAG: 1.6, KH: 0.12, H_RESTORE: 0.25, HMAX: 0.55,
  A_FOLLOW: 22, A_MAX: 9, TS_CAP: 5.0, FRENZY: 6.5, FRENZY_COST: 0.12,
  BOAT_HALF: 0.55, BOW: 1.7, STAKE_R: 0.28,
  SWELL_COST: 0.5, SWELL_FREE: 1.2, HIT_COST: 0.2, BANK_COST: 0.08, BUMP_COST: 0.04, REGEN_STROKE: 0.10, REGEN_STILL: 0.06,
  NET_X: 0.4, NET_Y: 1.9, NET_R: 1.8, NET_V: 2.2, NET_T: 0.75, NET_STILL: 0.6,
  DOWN_T: 2.4, DOWN_T_PRACTICE: 1.4, ASSIST_KICK: 0.55, GATE_GAP: 3.4,
};
export const SCORE = { finish: 100, place: [1000, 600, 300, 100], fish: 60, gate: 40, clean: 150, perSecond: 8 };
export const DEMO_RUNS = 3;
export const PAD_RATE_NOTE = 'one pad width = 2 units';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- creation ------------------------------------------------------------------------------------------------------------------------
export function newBoat(id, look, skill, bot, n0, name) {
  return {
    id, look, skill, bot, name, s: 0, n: n0, h: 0, v: 0, a: 0, aAvg: 0, oarSpeed: 0, inWater: false, poise: 1, down: 0,
    finished: false, finT: 0, fish: 0, gates: 0, falls: 0, hits: 0, gateIdx: 0, net: 0, netId: -1, netter: id === 0,
    hitCool: 0, bankCool: 0, bumpCool: 0, ph: 0, steady: 0, sway: 0, inHyac: false, inSwell: false, trail: [], trailT: 0, lane: n0,
    swellSeen: -1, still: false,
  };
}

export function createWorld(courseIndex, o, rng) {
  const C = COURSES[courseIndex], mode = o.mode ?? 'race';
  const names = [{ name: 'You', look: 0, skill: 1 }, ...C.rivals.map((r) => ({ name: r.name, look: r.look, skill: r.skill }))];
  const lanes = [0.8, -2.4, -0.8, 2.4];
  const boats = names.map((r, i) => {
    const b = newBoat(i, r.look, r.skill, i > 0 || mode === 'auto', lanes[i] ?? 0, r.name);
    b.netter = i === 0;
    b.ph = i * 1.3;
    return b;
  });
  return {
    course: C, mode, assist: mode === 'practice', rng: rng.fork(), t: 0, go: -3, boats, events: [], over: false, lastCount: 4,
    shoals: C.shoals.map((s) => ({ ...s, caught: false, by: -1, home: s.n })),
    gateRes: C.gates.map(() => null), stakeWob: C.stakes.map(() => 0),
  };
}

// ---- lookups ---------------------------------------------------------------------------------------------------------------------------
export const netZone = (b) => ({
  s: b.s + PHYS.NET_X * Math.cos(b.h) - PHYS.NET_Y * Math.sin(b.h),
  n: b.n + PHYS.NET_X * Math.sin(b.h) + PHYS.NET_Y * Math.cos(b.h),
});
export function obstacles(C) {
  const out = [];
  C.stakes.forEach((o, i) => out.push({ s: o.s, n: o.n, r: o.r, kind: 'stake', i }));
  C.gates.forEach((g, i) => { out.push({ s: g.s, n: g.n - g.gap / 2, r: 0.2, kind: 'pole', i }, { s: g.s, n: g.n + g.gap / 2, r: 0.2, kind: 'pole', i }); });
  return out;
}

// The line the planner wants at position s: the channel centre plus a lane, bent round stakes and weed, through gates, to shoals.
const smooth = (x) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
export function laneTarget(W, b, s) {
  const C = W.course, cen = centreAt(C, s), hw = halfWidthAt(C, s);
  let tn = cen + clamp(b.lane, -hw + 1.2, hw - 1.2) * 0.7;
  const lo = cen - hw + 0.95, hi = cen + hw - 0.95;
  // blend weight: ramps in over `in` metres before the obstacle, holds to just past it, ramps out over 4 m
  const wgt = (os, pre, post) => smooth((s - (os - pre)) / (pre * 0.55)) * (1 - smooth((s - (os + post)) / 4));
  const dodge = (o, w) => {
    const c = o.r + 0.55 + 0.75, base = tn, ahead = o.s - b.s;
    const ref = ahead < 10 && ahead > -1.5 ? b.n : base;
    const near = Math.abs(base - o.n) < c || Math.abs(ref - o.n) < c || (base - o.n) * (ref - o.n) < 0;
    if (!near) return;
    const up = o.n + c, dn = o.n - c, okUp = up <= hi, okDn = dn >= lo;
    const pref = ref >= o.n ? up : dn, other = ref >= o.n ? dn : up, okPref = ref >= o.n ? okUp : okDn, okOther = ref >= o.n ? okDn : okUp;
    const want = okPref ? pref : okOther ? other : base;
    const ww = ahead < 10 && ahead > -1.5 ? Math.max(w, 0.85) : w;
    tn = base + (want - base) * ww;
  };
  for (const o of C.stakes) { const w = wgt(o.s, 10, 1.2); if (w > 0.001) dodge(o, w); }
  for (const o of C.hyac) { const w = wgt(o.s, 9 + o.r, o.r + 1.0); if (w > 0.001) dodge({ n: o.n, r: o.r * 0.9 }, w); }
  if (b.netter && b.shoal !== undefined && b.shoal >= 0) {
    const sh = W.shoals[b.shoal];
    if (sh && !sh.caught) { const w = wgt(sh.s, 12, 2.0); if (w > 0.001) tn = tn + ((sh.n - PHYS.NET_Y) - tn) * w; }
  }
  for (const g of C.gates) { const w = wgt(g.s, 14, 0.8); if (w > 0.001) tn = tn + (g.n - tn) * w; }
  return clamp(tn, lo, hi);
}

// The Watch and Learn performer nets what the course asks for (the fish quota) and takes extra shoals only while it is clearly ahead,
// so it still wins the race. A person racing is never affected: only a bot-driven boat 0 skips shoals.
function skipShoal(W, b) {
  if (b.id !== 0 || !b.bot) return false;
  if (b.fish < W.course.quota) return false;
  let lead = 1e9;
  for (const o of W.boats) if (o.id !== 0 && !o.finished) lead = Math.min(lead, b.s - o.s);
  return lead < 14;
}

// The shoal a netter heads for: the nearest uncaught one ahead (or just alongside), if the channel allows the net side to reach it.
function pickShoal(W, b) {
  let best = -1, bd = 1e9;
  for (const sh of W.shoals) {
    if (sh.caught) continue;
    const ds = sh.s - b.s;
    if (ds < -1.8 || ds > 24) continue;
    if (skipShoal(W, b)) continue;
    if (ds < bd) { bd = ds; best = sh.id; }
  }
  return best;
}

// ---- the AI command (rivals and the Watch and Learn performer) --------------------------------------------------------------------------
export function planFor(W, b) {
  const C = W.course, look = 4 + b.v * 1.1;
  if (b.netter) b.shoal = pickShoal(W, b);
  const tn = laneTarget(W, b, b.s + look * 0.5);
  const hd = clamp((tn - b.n) * 0.30, -0.5, 0.5);
  const bias = clamp((2.5 * (hd - b.h) + PHYS.H_RESTORE * b.h) / (PHYS.KH * 4.3), -0.9, 0.9);
  // when to still the oar
  let still = false, gentle = false, why = '';
  const sw = C.swells.find((w) => b.s < w.s1 && w.s0 - b.s < 0.6 * Math.max(1.5, b.v));
  if (sw && (b.skill > 0.55 || b.id === 0)) { gentle = true; why = 'swell'; }
  if (!still && b.netter && b.shoal >= 0) {
    const sh = W.shoals[b.shoal], ds = sh.s - b.s;
    const z = netZone(b), inZone = Math.hypot(sh.s - z.s, sh.n - z.n) < PHYS.NET_R + 0.3;
    if ((ds < 2.6 + 0.9 * (b.v - 2.0) && ds > -2.4 && Math.abs(sh.n - (b.n + PHYS.NET_Y)) < 2.4) || inZone) { still = true; why = 'net'; }
  }
  return { tn, bias, still, gentle, why, ds: b.shoal >= 0 && b.shoal !== undefined ? W.shoals[b.shoal]?.s - b.s : undefined };
}

function aiCmd(W, b, dt) {
  const p = planFor(W, b);
  b.lane = b.lane ?? 0;
  const sk = b.id === 0 ? 1 : b.skill;
  const f = 1.2 * (0.7 + 0.3 * sk) * (b.poise < 0.35 ? 0.8 : 1);
  let A = Math.max(0.4, 0.9 * (1 - 0.35 * Math.abs(p.bias))) * (0.4 + 0.6 * sk) * (b.poise < 0.35 ? 0.6 : 1);
  if (p.gentle) A = Math.min(A, 0.36);
  b.ph += Math.PI * 2 * f * dt;
  b.plan = p;
  return { hold: !p.still, pad: clamp(p.bias + A * Math.sin(b.ph), -1, 1) };
}

// ---- one boat for one step ----------------------------------------------------------------------------------------------------------
function stepBoat(W, b, c, dt) {
  const C = W.course, P = PHYS, kick = W.assist ? P.ASSIST_KICK : 1, ev = W.events;
  if (b.finished) { b.v = Math.max(0, b.v - 1.4 * dt); b.s += b.v * dt; b.oarSpeed = 0; b.a *= 1 - 3 * dt; return; }
  b.hitCool = Math.max(0, b.hitCool - dt); b.bankCool = Math.max(0, b.bankCool - dt); b.bumpCool = Math.max(0, b.bumpCool - dt);
  let cmd = c;
  if (b.down > 0) {
    b.down -= dt; cmd = null; b.v = Math.max(0, b.v * (1 - 2.2 * dt));
    if (b.down <= 0) { b.poise = 0.55; ev.push({ type: 'up', who: b.id }); }
  }
  const hold = !!cmd && cmd.hold;
  const target = hold ? clamp(cmd.pad, -1, 1) : 0;
  const a0 = b.a;
  const step = clamp((target - b.a) * P.A_FOLLOW * dt, -P.A_MAX * dt, P.A_MAX * dt);
  b.a = clamp(b.a + (hold ? step : (target - b.a) * Math.min(1, 3 * dt)), -1, 1);
  const spd = hold ? Math.abs(b.a - a0) / dt : 0;
  b.aAvg += (b.a - b.aAvg) * Math.min(1, 2.5 * dt);
  b.oarSpeed = spd; b.inWater = hold; b.still = !hold || spd < P.NET_STILL;
  // surroundings
  const cen = centreAt(C, b.s), hw = halfWidthAt(C, b.s);
  b.inHyac = C.hyac.some((o) => Math.hypot(o.s - b.s, o.n - b.n) < o.r + 0.35);
  b.inSwell = swellAt(C, b.s);
  // thrust, drag, steering
  const eff = b.inHyac ? 0.45 : 1;
  if (hold) {
    b.v += P.KT * Math.min(spd, P.TS_CAP) * dt * Math.max(0, 1 - b.v / P.VMAX) * eff;
    b.h += P.KH * b.a * Math.min(spd, P.TS_CAP) * dt;
  }
  b.v -= (P.DRAG1 * b.v + P.DRAG2 * b.v * b.v + (b.inHyac ? P.HYAC_DRAG * b.v : 0)) * dt;
  b.v = Math.max(0, b.v);
  b.h = clamp(b.h - P.H_RESTORE * b.h * dt, -P.HMAX, P.HMAX);
  b.s += b.v * Math.cos(b.h) * dt;
  b.n += b.v * Math.sin(b.h) * dt;
  // banks
  const lim = hw - P.BOAT_HALF - 0.35, dc = b.n - cen;
  if (Math.abs(dc) > lim) {
    const sg = Math.sign(dc);
    b.n = cen + sg * lim; b.v *= 1 - 1.5 * dt;
    if (b.h * sg > 0) b.h *= 1 - 5 * dt;
    if (b.bankCool <= 0) { b.bankCool = 0.9; b.poise -= P.BANK_COST * kick; ev.push({ type: 'bank', who: b.id, s: b.s, n: b.n }); }
  }
  // stakes and gate poles (bow point and middle of the boat)
  if (b.hitCool <= 0) {
    const bx = b.s + P.BOW * Math.cos(b.h), by = b.n + P.BOW * Math.sin(b.h);
    for (const o of obstacles(C)) {
      if (Math.abs(o.s - b.s) > 4) continue;
      const d = Math.min(Math.hypot(o.s - bx, o.n - by), Math.hypot(o.s - b.s, o.n - b.n));
      if (d < o.r + 0.5) {
        b.hitCool = 0.7; b.v *= 0.4; b.hits += 1; b.poise -= P.HIT_COST * kick;
        b.n += (b.n >= o.n ? 1 : -1) * 0.35; b.h *= 0.5;
        if (o.kind === 'stake') W.stakeWob[o.i] = 1;
        ev.push({ type: 'hit', who: b.id, s: o.s, n: o.n, kind: o.kind });
        break;
      }
    }
  }
  // gates
  while (b.gateIdx < C.gates.length && b.s >= C.gates[b.gateIdx].s) {
    const g = C.gates[b.gateIdx], ok = Math.abs(b.n - g.n) < g.gap / 2 - 0.3;
    if (ok) b.gates += 1;
    if (b.id === 0) W.gateRes[b.gateIdx] = ok;
    ev.push({ type: 'gate', who: b.id, ok, s: g.s, n: g.n });
    b.gateIdx += 1;
  }
  // poise
  if (b.inSwell && hold && spd > P.SWELL_FREE) {
    b.poise -= P.SWELL_COST * Math.min(1.6, (spd - P.SWELL_FREE) / 3.5) * kick * dt;
    const k = C.swells.findIndex((w) => b.s >= w.s0 && b.s <= w.s1);
    if (b.swellSeen !== k) { b.swellSeen = k; ev.push({ type: 'swell', who: b.id, s: b.s, n: b.n }); }
  }
  if (hold && spd > P.FRENZY) b.poise -= (spd - P.FRENZY) * P.FRENZY_COST * kick * dt;
  if (!b.inSwell || spd < P.SWELL_FREE + 0.8) {
    if (hold && spd > 0.6 && spd < 3.8) b.poise += P.REGEN_STROKE * (b.inSwell ? 0.5 : 1) * dt;
    else if (!hold) b.poise += P.REGEN_STILL * dt;
  }
  b.poise = Math.min(1, b.poise);
  if (b.down <= 0 && b.poise <= 0) {
    b.poise = 0; b.down = W.assist ? P.DOWN_T_PRACTICE : P.DOWN_T; b.falls += 1; b.v *= 0.3;
    ev.push({ type: 'fall', who: b.id, s: b.s, n: b.n });
  }
  // rivals now and then lose their balance too
  if (b.id !== 0 && b.down <= 0) {
    const pr = (1 - b.skill) * 0.05 * (W.assist ? 0.5 : 1);
    if (W.rng.next() < pr * dt) { b.down = 1.3; b.falls += 1; b.v *= 0.3; ev.push({ type: 'fall', who: b.id, s: b.s, n: b.n }); }
  }
  // the net
  if (b.netter) {
    const z = netZone(b);
    let near = null, nd = 1e9;
    for (const sh of W.shoals) {
      if (sh.caught) continue;
      const d = Math.hypot(sh.s - z.s, sh.n - z.n);
      if (d < P.NET_R && d < nd) { nd = d; near = sh; }
    }
    if (near && b.v <= P.NET_V && b.still && !b.inHyac && b.down <= 0) {
      b.net += dt / P.NET_T; b.netId = near.id;
      if (b.net >= 1) {
        b.net = 0; near.caught = true; near.by = b.id; b.fish += near.size;
        ev.push({ type: 'catch', who: b.id, size: near.size, s: near.s, n: near.n });
      }
    } else b.net = Math.max(0, b.net - 1.5 * dt);
  } else b.net = 0;
  // sway for the painter: the body leans against the sweep, and wobbles as poise runs low
  b.sway = clamp(b.sway + ((-b.a * 0.25 + Math.sin(W.t * 9 + b.id) * (1 - b.poise) * 0.45) - b.sway) * Math.min(1, 10 * dt), -1, 1);
  if (b.s >= C.length && !b.finished) {
    b.finished = true; b.finT = W.t; ev.push({ type: 'finish', who: b.id });
  }
  // wake trail (positions the painter fades out)
  b.trailT += dt;
  if (b.trailT >= 0.09) { b.trailT = 0; b.trail.push({ s: b.s, n: b.n, v: b.v, t: W.t }); if (b.trail.length > 36) b.trail.shift(); }
}

export function stepWorld(W, dt, cmd) {
  W.events.length = 0;
  if (W.go < 0) {
    const before = Math.ceil(-W.go);
    W.go += dt;
    const after = Math.ceil(-W.go);
    if (W.go >= 0) { W.events.push({ type: 'go' }); W.go = 0; }
    else if (after < before) W.events.push({ type: 'count', n: after });
    return;
  }
  W.t += dt;
  const C = W.course;
  for (const b of W.boats) {
    const c = b.id === 0 && !b.bot ? cmd : aiCmd(W, b, dt);
    stepBoat(W, b, c, dt);
  }
  // boats push each other apart
  const bs = W.boats;
  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) {
      const A = bs[i], B = bs[j];
      if (A.finished || B.finished) continue;
      const ds = B.s - A.s, dn = B.n - A.n;
      if (Math.abs(ds) < 3.4 && Math.abs(dn) < 1.4) {
        const push = (1.4 - Math.abs(dn)) * 0.35, sg = dn === 0 ? (i % 2 ? 1 : -1) : Math.sign(dn);
        A.n -= sg * push; B.n += sg * push;
        const rear = ds > 0 ? A : B;
        if (rear.bumpCool <= 0) { rear.bumpCool = 0.8; rear.v *= 0.85; rear.poise -= PHYS.BUMP_COST; W.events.push({ type: 'bump', who: rear.id, s: (A.s + B.s) / 2, n: (A.n + B.n) / 2 }); }
      }
    }
  }
  // shoals drift, and flee a fast boat
  for (const sh of W.shoals) {
    if (sh.caught) continue;
    sh.n += Math.sin(W.t * 0.6 + sh.id * 1.7) * 0.25 * dt;
    for (const b of bs) {
      if (Math.abs(b.s - sh.s) < 5 && Math.abs(b.n - sh.n) < 5 && b.v > 2.7) sh.n += (sh.n >= b.n ? 1 : -1) * 1.2 * dt;
    }
    const cen = centreAt(C, sh.s), hw = halfWidthAt(C, sh.s);
    sh.n = clamp(sh.n, cen - hw + 1.1, cen + hw - 1.1);
  }
  for (let i = 0; i < W.stakeWob.length; i++) W.stakeWob[i] = Math.max(0, W.stakeWob[i] - dt * 2.5);
  const me = bs[0];
  if (me.finished || bs.every((b) => b.finished) || W.t > 420) W.over = true;
}

// ---- standings and results -------------------------------------------------------------------------------------------------------------
export function standings(W) {
  return [...W.boats].sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished) return a.finT - b.finT;
    return b.s - a.s;
  });
}
export const placeOf = (W, id) => standings(W).findIndex((b) => b.id === id);

export function resultOf(W) {
  const C = W.course, me = W.boats[0], st = standings(W), place = st.findIndex((b) => b.id === 0);
  const time = me.finished ? me.finT : W.t;
  const finished = me.finished;
  const stars = !finished ? 0 : 1 + (place === 0 ? 1 : 0) + (me.fish >= C.quota ? 1 : 0);
  const clean = me.falls === 0;
  const score = !finished ? 0 : SCORE.finish + SCORE.place[Math.min(3, place)] + me.fish * SCORE.fish + me.gates * SCORE.gate
    + (clean ? SCORE.clean : 0) + Math.max(0, Math.round((C.par - time) * SCORE.perSecond));
  return {
    ci: C.index, course: C.id, place, time, fish: me.fish, quota: C.quota, gates: me.gates, gateTotal: C.gates.length, falls: me.falls, hits: me.hits,
    stars, score, finished, names: st.map((b) => b.name), shoalsTotal: C.shoals.length,
  };
}

export { sectionsOf };

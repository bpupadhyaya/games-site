// Diketo rules and physics: pure and deterministic. Randomness only comes from an rng passed in.
// World: the yard is 660 x 800 units, y grows downward. The hole (PIT) is in the middle of a chalk circle, the hand rests
// at HOME below the circle. Height z is only used for drawing and for the toss timing.

export const W = 720;
export const H = 1280;
export const WORLD = { w: 660, h: 800 };
export const R = 23;                         // stone radius
export const GHO_R = 27;                     // the throwing stone is a little larger
export const PIT = { x: 330, y: 318, r: 122 };
export const YARD_R = 304;                   // chalk circle
export const HOME = { x: 330, y: 742 };
export const SPEED = 2000;                   // hand speed, units per second
export const LEG = 0.03;                     // fixed cost of every hand movement
export const DWELL = 0.05;                   // closing the hand on one stone
export const SWEEP_DWELL = 0.14;             // sweeping a whole group
export const DROP_DWELL = 0.07;              // opening the hand over the hole
export const REL_DWELL = 0.05;               // setting stones down beside the hole
export const DEV = 130;                      // landing drift of the thrown stone at full height
export const WIN_EARLY = 0.18;               // catch window around the landing time
export const WIN_LATE = 0.22;
export const H_MIN = 0.2;
export const CHARGE_SECS = 1.0;              // holding the pad this long gives full height
export const TAP_REACT = 0.2;                // the pace the planner and the Think hint assume for a steady player
export const TAP_GAP = 0.13;
export const GAP = 2 * R + 4;                // stones never rest closer than this

export const AIR_BASE = 0.9;                 // air time = AIR_BASE + AIR_SLOPE x power
export const AIR_SLOPE = 1.0;
export const airtime = (h) => AIR_BASE + AIR_SLOPE * h;
// a higher toss falls faster, so the catch window narrows with height
export const winScale = (h) => 1 / (0.65 + 0.7 * clamp(h, 0, 1));
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const TAU = Math.PI * 2;

// ---- the match lengths and stages ---------------------------------------------------------------------
// Each stage has two halves: OUT (stones leave the hole) then IN (stones go back). A toss takes `take` stones.
export const MODES = {
  quick: { n: 6, ks: [1, 2, 3, 'all'] },
  full: { n: 10, ks: [1, 2, 3, 5, 'all'] },
};
export const stageCount = (mode) => MODES[mode].ks.length;
export const stageTake = (mode, stage) => { const k = MODES[mode].ks[stage - 1]; return k === 'all' ? MODES[mode].n : k; };
export const isSweep = (mode, stage) => MODES[mode].ks[stage - 1] === 'all';
export const tossesPerHalf = (mode, stage) => Math.ceil(MODES[mode].n / stageTake(mode, stage));
export const takeNow = (mode, stage, done) => Math.min(stageTake(mode, stage), MODES[mode].n - done);

// The ten slots of the hole (stone id = slot). Slot 0 is the middle, then a ring of six, then three more.
export const SLOTS = (() => {
  const s = [{ x: 0, y: 0 }];
  for (let i = 0; i < 6; i++) { const a = i * TAU / 6; s.push({ x: Math.cos(a) * 54, y: Math.sin(a) * 54 }); }
  for (const deg of [30, 150, 270]) { const a = deg * TAU / 360; s.push({ x: Math.cos(a) * 88, y: Math.sin(a) * 88 }); }
  return s;
})();
// A six-stone pile (Quick) sits in a smaller hole with its stones packed closer.
export const SLOTS6 = (() => { const s = [{ x: 0, y: 0 }]; for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + 0.3; s.push({ x: Math.cos(a) * 50, y: Math.sin(a) * 50 }); } return s; })();
export const pitRadius = (n) => (n <= 6 ? 92 : PIT.r);
export const slotPos = (id, n = 10) => { const t = n <= 6 ? SLOTS6 : SLOTS; return { x: PIT.x + t[id].x, y: PIT.y + t[id].y }; };
export const stoneRot = (id) => (id * 1.37) % 3.14;

// A player's progress. pit = ids resting in the hole, ground = stones on the yard.
export function freshPlayer(mode, over = {}) {
  const n = MODES[mode].n;
  return { stage: 1, dir: 'out', done: 0, pit: Array.from({ length: n }, (_, i) => i), ground: [], ...over };
}
export const playerDone = (mode, p) => p.stage > stageCount(mode);

// ---- placing stones on the ground ---------------------------------------------------------------------
const RMIN = PIT.r + R + 10, RMAX = YARD_R - R - 8;
export function relax(pts, fixed = []) {
  for (let pass = 0; pass < 90; pass++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d < GAP) {
          if (d < 0.001) { dx = 1; dy = 0; d = 1; }
          const push = (GAP - d) / 2 + 0.01;
          a.x -= (dx / d) * push; a.y -= (dy / d) * push; b.x += (dx / d) * push; b.y += (dy / d) * push; moved = true;
        }
      }
      for (const f of fixed) {
        const a = pts[i];
        let dx = a.x - f.x, dy = a.y - f.y, d = Math.hypot(dx, dy);
        if (d < GAP) { if (d < 0.001) { dx = 1; dy = 0; d = 1; } const push = GAP - d + 0.01; a.x += (dx / d) * push; a.y += (dy / d) * push; moved = true; }
      }
    }
    for (const p of pts) {
      const dx = p.x - PIT.x, dy = p.y - PIT.y, d = Math.hypot(dx, dy) || 1;
      const k = clamp(d, RMIN, RMAX) / d;
      if (k !== 1) { p.x = PIT.x + dx * k; p.y = PIT.y + dy * k; moved = true; }
    }
    if (!moved) break;
  }
  return pts;
}

// Where the stones taken out of the hole come to rest: one loose group per toss. Seeded, so a replay is identical.
// Stones never overlap each other or the stones already on the ground, and stay in the ring between the hole and the chalk circle.
const freeOf = (pts, fixed) => {
  for (let i = 0; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - PIT.x, pts[i].y - PIT.y);
    if (d < RMIN - 0.5 || d > RMAX + 0.5) return false;
    for (let j = i + 1; j < pts.length; j++) if (dist(pts[i].x, pts[i].y, pts[j].x, pts[j].y) < GAP - 0.5) return false;
    for (const f of fixed) if (dist(pts[i].x, pts[i].y, f.x, f.y) < GAP - 0.5) return false;
  }
  return true;
};
export function dropSpots(rng, n, ground) {
  for (let attempt = 0; attempt < 14; attempt++) {
    const ang = rng.next() * TAU, rad = RMIN + 14 + rng.next() * (RMAX - RMIN - 28);
    const cx = PIT.x + Math.cos(ang) * rad, cy = PIT.y + Math.sin(ang) * rad;
    const spread = n > 1 ? 24 + 9 * n : 0;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = rng.next() * TAU, r = i === 0 ? 0 : spread * Math.sqrt(rng.next());
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, rot: rng.next() * 3.1 });
    }
    relax(pts, ground);
    if (freeOf(pts, ground)) return pts;
  }
  // a crowded yard: walk the ring from a seeded start and take the first free places
  const placed = [], start = rng.next() * TAU;
  for (let i = 0; i < n; i++) {
    let found = null;
    for (let r = RMIN + 6; r <= RMAX && !found; r += 14) {
      for (let k = 0; k < 48 && !found; k++) {
        const a = start + (k * TAU) / 48 + r * 0.01, x = PIT.x + Math.cos(a) * r, y = PIT.y + Math.sin(a) * r;
        if (ground.every((f) => dist(x, y, f.x, f.y) >= GAP) && placed.every((f) => dist(x, y, f.x, f.y) >= GAP)) found = { x, y, rot: rng.next() * 3.1 };
      }
    }
    placed.push(found ?? { x: PIT.x + RMIN + 6, y: PIT.y, rot: 0 });
  }
  return placed;
}

// ---- one toss ------------------------------------------------------------------------------------------
export const newRoll = (rng) => ({ ang: rng.next() * TAU, u: 0.2 + rng.next() * 0.8 });
export const landing = (h, roll) => ({ x: HOME.x + Math.cos(roll.ang) * DEV * h * roll.u, y: HOME.y + Math.sin(roll.ang) * DEV * h * roll.u * 0.6 });
export const legTime = (d) => LEG + d / SPEED;

// The stones a toss may take right now, with their positions. dir 'out': the stones in the hole; 'in': the stones on the ground.
export function takeable(p) {
  return p.dir === 'out' ? p.pit.map((id) => ({ id, ...slotPos(id, p.pit.length + p.ground.length) })) : p.ground.map((g) => ({ id: g.id, x: g.x, y: g.y }));
}

// The hand's timeline for a list of taps [{ t, id }] (time since the toss left the hand). ctx: { dir, take, sweep, stones, L }.
// The hand leaves for a stone as soon as it is free and the tap has come; picks happen when it gets there. When all stones are
// taken, an 'in' toss goes to the hole to drop them (an 'out' toss sets them down beside it), then the hand returns to L.
export function planLegs(ctx, taps) {
  const legs = [], picks = [];
  let ready = 0, px = HOME.x, py = HOME.y;
  const go = (bx, by, depart, dwell, tag) => {
    const t1 = depart + legTime(dist(px, py, bx, by));
    legs.push({ ax: px, ay: py, bx, by, t0: depart, t1, dwell, tag });
    px = bx; py = by;
    return t1 + dwell;
  };
  const seen = new Set();
  let complete = false;
  if (ctx.sweep) {
    const tap = taps.find((q) => ctx.stones.some((s) => s.id === q.id));
    if (tap && ctx.stones.length) {
      const cx = ctx.stones.reduce((a, s) => a + s.x, 0) / ctx.stones.length, cy = ctx.stones.reduce((a, s) => a + s.y, 0) / ctx.stones.length;
      const arrive = go(cx, cy, tap.t, SWEEP_DWELL, 'sweep');
      for (const s of ctx.stones) picks.push({ id: s.id, t: arrive - SWEEP_DWELL * 0.5 });
      ready = arrive; complete = true;
    }
  } else {
    for (const tap of taps) {
      if (picks.length >= ctx.take || seen.has(tap.id)) continue;
      const s = ctx.stones.find((q) => q.id === tap.id);
      if (!s) continue;
      seen.add(tap.id);
      const depart = Math.max(tap.t, ready);
      ready = go(s.x, s.y, depart, DWELL, 'pick');
      picks.push({ id: s.id, t: ready - DWELL * 0.5 });
    }
    complete = picks.length >= ctx.take;
  }
  let tDrop = null, tBack = Infinity;
  if (complete) {
    if (ctx.dir === 'in') { ready = go(PIT.x, PIT.y, ready, DROP_DWELL, 'drop'); tDrop = ready - DROP_DWELL * 0.5; }
    else { ready += REL_DWELL; tDrop = ready - REL_DWELL * 0.5; }
    tBack = go(ctx.L.x, ctx.L.y, ready, 0, 'back');
  }
  return { legs, picks, complete, tDrop, tBack, ready };
}

// Where the hand is at time t (smooth start and stop on every leg).
export function handAt(ev, t) {
  let px = HOME.x, py = HOME.y;
  for (const lg of ev.legs) {
    if (t < lg.t0) return { x: px, y: py, moving: false };
    if (t <= lg.t1) {
      let u = (t - lg.t0) / Math.max(1e-6, lg.t1 - lg.t0);
      u = u * u * (3 - 2 * u);
      return { x: lg.ax + (lg.bx - lg.ax) * u, y: lg.ay + (lg.by - lg.ay) * u, moving: true };
    }
    px = lg.bx; py = lg.by;
    if (t <= lg.t1 + (lg.dwell || 0)) return { x: px, y: py, moving: false, dwelling: true };
  }
  return { x: px, y: py, moving: false };
}

// The result of a toss once the catch tap is known. eps = (tap time) - (landing time); null = no tap at all.
export function catchResult(ev, T, h, eps) {
  if (!ev.complete) return { ok: false, why: 'short', quality: 0 };
  if (ev.tBack > T + 0.02) return { ok: false, why: 'late', quality: 0 };
  const sc = winScale(h);
  if (eps === null || eps === undefined || eps > WIN_LATE * sc) return { ok: false, why: 'slow', quality: 0 };
  if (eps < -WIN_EARLY * sc) return { ok: false, why: 'early', quality: 0 };
  const a = Math.abs(eps) / sc;
  return { ok: true, why: 'ok', quality: a < 0.07 ? 2 : a < 0.14 ? 1 : 0 };
}

// ---- applying a toss that was caught ----------------------------------------------------------------------
// out: the taken stones leave the hole and rest on the ground at `spots`; in: they return to the hole.
export function applyToss(mode, p, ids, spots) {
  const n = MODES[mode].n;
  if (p.dir === 'out') {
    p.pit = p.pit.filter((id) => !ids.includes(id));
    ids.forEach((id, i) => p.ground.push({ id, x: spots[i].x, y: spots[i].y, rot: spots[i].rot }));
  } else {
    p.ground = p.ground.filter((g) => !ids.includes(g.id));
    p.pit = [...p.pit, ...ids];
  }
  p.done += ids.length;
  let event = null;
  if (p.done >= n) {
    p.done = 0;
    if (p.dir === 'out') { p.dir = 'in'; event = 'half'; } else { p.dir = 'out'; p.stage++; event = 'stage'; }
  }
  return event;
}
export const progressOf = (mode, p) => {
  const n = MODES[mode].n, total = stageCount(mode);
  if (p.stage > total) return 1;
  return ((p.stage - 1) * 2 * n + (p.dir === 'in' ? n : 0) + p.done) / (total * 2 * n);
};

// Bolas Criollas physics: a long sand cancha, heavy balls thrown low (roll), lobbed (lob) or flat and fast (shot) at a small white mingo.
// Pure and deterministic: metres, seconds, fixed sub-steps, no DOM, no clock. All randomness comes from a seeded rng passed in.
//
// Coordinates: u runs down the cancha from the throwing line (0) to the dead line (LEN); v is across it (-HALF .. +HALF); z is height.
// Side boards run along both long edges and are in play. The far end has no board: a ball that crosses the dead line is out.

export const COURT = { len: 16, half: 1.5, zoneA: 8, zoneB: 13, minThrow: 3, maxThrow: 15.6 };
// Real bolas are about 12 cm across and the mingo about 6 cm; drawn and simulated at 1.3x so they stay readable.
export const R_BALL = 0.078;
export const R_MINGO = 0.039;
const M_BALL = 1, M_MINGO = 0.32;
const G = 9.8, SUB = 4;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const STYLES = [
  { id: 'roll', name: 'Roll', sub: 'low, runs on' },
  { id: 'lob', name: 'Lob', sub: 'high, drops short' },
  { id: 'shot', name: 'Shot', sub: 'flat and fast' },
];

// ---- courts ----------------------------------------------------------------------------------------------------------------
// mu is the rolling drag of the bare surface. Patches are ellipses: loose sand (heavy drag, buries a ball, kills bounce) and
// hard-packed (slick, balls skid on and rebound livelier).
export const COURTS = {
  clay: { name: 'Packed Earth', mu: 0.2, loose: 2, hard: 1, note: 'Firm and true: balls run on.' },
  soft: { name: 'Soft Sand', mu: 0.31, loose: 1, hard: 2, note: 'Heavy going: balls die quickly.' },
  coast: { name: 'Coast Court', mu: 0.25, loose: 3, hard: 2, note: 'Mixed patches: read the ground.' },
};
export const COURT_IDS = ['clay', 'soft', 'coast', 'daily'];

export function makeSurface(id, rng) {
  const base = COURTS[id] ?? { name: 'Daily Court', mu: 0.19 + rng.next() * 0.14, loose: 1 + rng.int(3), hard: 1 + rng.int(2) };
  const patches = [];
  const add = (kind) => {
    for (let tries = 0; tries < 12; tries++) {
      const ru = 0.9 + rng.next() * 1.4, rv = 0.45 + rng.next() * 0.55;
      const u = 3.2 + rng.next() * (COURT.len - 5.5), v = (rng.next() * 2 - 1) * (COURT.half - 0.45);
      if (patches.every((p) => Math.abs(p.u - u) > (p.ru + ru) * 0.8 || Math.abs(p.v - v) > (p.rv + rv) * 0.9)) { patches.push({ kind, u, v, ru, rv }); return; }
    }
  };
  for (let i = 0; i < base.loose; i++) add('loose');
  for (let i = 0; i < base.hard; i++) add('hard');
  return { id, name: base.name, mu: base.mu, patches };
}

const GR = { mu: 0, bite: 1, rest: 1 };
// Ground at a point: drag, how much of a landing carries on (bite), bounce liveliness. Fills and returns a shared scratch object.
export function groundAt(s, x, y) {
  GR.mu = s.mu; GR.bite = 1; GR.rest = 1;
  for (const p of s.patches) {
    const dx = (x - p.u) / p.ru, dy = (y - p.v) / p.rv, q = dx * dx + dy * dy;
    if (q >= 1) continue;
    const k = 1 - q;
    if (p.kind === 'loose') { GR.mu *= 1 + 1.0 * k; GR.bite *= 1 - 0.6 * k; GR.rest *= 1 - 0.45 * k; }
    else { GR.mu *= 1 - 0.42 * k; GR.bite *= 1 + 0.25 * k; GR.rest *= 1 + 0.12 * k; }
  }
  return GR;
}

// ---- world ---------------------------------------------------------------------------------------------------------------
export const createWorld = (surf) => ({ surf, balls: [], settled: true, still: 0, t: 0 });

export function newBall(id, side, mingo = false) {
  return { id, side, k: mingo, x: 0, y: 0, z: mingo ? R_MINGO : R_BALL, vx: 0, vy: 0, vz: 0, r: mingo ? R_MINGO : R_BALL, m: mingo ? M_MINGO : M_BALL, bite: 1, st: 'roll', fade: 0, hit: 0 };
}
export const theMingo = (w) => w.balls.find((b) => b.k && b.st !== 'out') ?? null;
export const live = (b) => b.st !== 'out';

export const cloneWorld = (w) => ({ surf: w.surf, balls: w.balls.map((b) => ({ ...b })), settled: w.settled, still: w.still, t: w.t });

// Horizontal speed a ground roll needs to stop `dist` metres away along direction (dx,dy) from (x0,y0), on this ground.
function rollSpeed(surf, x0, y0, dx, dy, dist) {
  const stopFor = (v0) => {
    let v2 = v0 * v0, d = 0;
    const ds = 0.05;
    while (v2 > 0 && d < 40) { const g = groundAt(surf, x0 + dx * d, y0 + dy * d); v2 -= 2 * g.mu * G * ds; d += ds; }
    return d;
  };
  let lo = 0.2, hi = 24;
  for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (stopFor(mid) < dist) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

// Throw ball b so that it lands (lob, shot) or comes to rest (roll) at (tx, ty) on a flat reading of the ground.
export function launch(w, b, p) {
  const x0 = 0, y0 = p.y0 ?? 0;
  b.x = x0; b.y = y0; b.st = 'roll'; b.fade = 0;
  const dx = p.tx - x0, dy = p.ty - y0, D = Math.max(0.5, Math.hypot(dx, dy)), ux = dx / D, uy = dy / D;
  b.style = p.style;
  if (p.style === 'lob') {
    const T = 0.8 + 0.05 * D, z0 = 1.0;
    b.z = z0; b.vz = (b.r - z0 + (G * T * T) / 2) / T; b.vx = (ux * D) / T; b.vy = (uy * D) / T; b.bite = 0.3;
  } else if (p.style === 'shot') {
    const V = 9.5 + 0.1 * D, T = D / V, z0 = 0.62;
    b.z = z0; b.vz = (b.r - z0 + (G * T * T) / 2) / T; b.vx = ux * V; b.vy = uy * V; b.bite = 0.42;
  } else {
    const v0 = rollSpeed(w.surf, x0, y0, ux, uy, D);
    b.z = b.r; b.vz = 0; b.vx = ux * v0; b.vy = uy * v0; b.bite = 1;
  }
  w.settled = false; w.still = 0;
}

// ---- stepping --------------------------------------------------------------------------------------------------------------
export function stepWorld(w, dt, ev) {
  const h = dt / SUB;
  const balls = w.balls, S = w.surf;
  for (let s = 0; s < SUB; s++) {
    for (const b of balls) {
      if (b.st === 'out') { b.fade += h; continue; }
      const air = b.z > b.r + 1e-3 || b.vz > 1e-3;
      if (air) {
        b.vz -= G * h;
        b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
        if (b.z <= b.r && b.vz < 0) {
          const g = groundAt(S, b.x, b.y), v = Math.hypot(b.vx, b.vy, b.vz), keep = clamp(b.bite * g.bite, 0.05, 1);
          b.vx *= keep; b.vy *= keep; b.vz = 0; b.z = b.r; b.bite = 0.5;
          ev.push({ t: 'land', x: b.x, y: b.y, v, loose: g.bite < 0.8 });
        }
      } else {
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > 0) {
          const g = groundAt(S, b.x, b.y), ds = g.mu * G * h;
          if (sp <= ds) { b.vx = 0; b.vy = 0; } else { const k = (sp - ds) / sp; b.vx *= k; b.vy *= k; }
          b.x += b.vx * h; b.y += b.vy * h;
        }
        b.z = b.r; b.vz = 0;
      }
      // side boards (low walls, in play); a high ball clears them and is out
      const lim = COURT.half - b.r;
      if (Math.abs(b.y) > lim) {
        if (b.z < 0.55 && Math.abs(b.y) < COURT.half + 0.5) {
          const sg = Math.sign(b.y);
          if (b.vy * sg > 0) {
            const v = Math.abs(b.vy);
            b.vy = -b.vy * 0.5; b.vx *= 0.93;
            if (v > 0.6) ev.push({ t: 'board', x: b.x, y: b.y, v });
          }
          b.y = sg * lim;
        } else if (Math.abs(b.y) > COURT.half + 0.45) { b.st = 'out'; b.fade = 0; ev.push({ t: 'out', k: b.k, x: b.x, y: b.y, why: 'side' }); continue; }
      }
      if (b.x > COURT.len && b.z <= b.r + 0.05) { b.st = 'out'; b.fade = 0; ev.push({ t: 'out', k: b.k, x: b.x, y: b.y, why: 'end' }); continue; }
      if (b.x < -0.6) { b.st = 'out'; b.fade = 0; ev.push({ t: 'out', k: b.k, x: b.x, y: b.y, why: 'near' }); continue; }
      if (b.x > COURT.len + 3 || b.z < -1) { b.st = 'out'; b.fade = 0; ev.push({ t: 'out', k: b.k, x: b.x, y: b.y, why: 'end' }); }
    }
    // ball against ball (3D spheres, so a lob drops on top of a ball and a flat shot drives into it)
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.st === 'out') continue;
      for (let j = i + 1; j < balls.length; j++) {
        const c = balls[j];
        if (c.st === 'out') continue;
        const dx = c.x - a.x, dy = c.y - a.y, dz = c.z - a.z, rr = a.r + c.r, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= rr * rr || d2 < 1e-9) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d, over = rr - d, im = 1 / a.m + 1 / c.m;
        a.x -= nx * over * (1 / a.m / im); a.y -= ny * over * (1 / a.m / im);
        c.x += nx * over * (1 / c.m / im); c.y += ny * over * (1 / c.m / im);
        const vn = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny + (c.vz - a.vz) * nz;
        if (vn >= 0) continue;
        const g = groundAt(S, (a.x + c.x) / 2, (a.y + c.y) / 2), e = clamp(0.6 * g.rest, 0.12, 0.8), j2 = (-(1 + e) * vn) / im;
        a.vx -= (j2 * nx) / a.m; a.vy -= (j2 * ny) / a.m; a.vz -= (j2 * nz) / a.m;
        c.vx += (j2 * nx) / c.m; c.vy += (j2 * ny) / c.m; c.vz += (j2 * nz) / c.m;
        if (a.z <= a.r + 1e-3 && a.vz < 0) a.vz = 0;
        if (c.z <= c.r + 1e-3 && c.vz < 0) c.vz = 0;
        a.hit = c.hit = 0.25;
        ev.push({ t: 'hit', x: (a.x + c.x) / 2, y: (a.y + c.y) / 2, z: (a.z + c.z) / 2, v: -vn, k: a.k || c.k, a: a.id, b: c.id });
      }
    }
  }
  let moving = false;
  for (const b of balls) {
    if (b.hit > 0) b.hit -= dt;
    if (b.st === 'out') continue;
    if (Math.hypot(b.vx, b.vy) > 0.03 || b.z > b.r + 1e-2 || Math.abs(b.vz) > 0.05) moving = true;
  }
  w.t += dt;
  if (moving) { w.still = 0; w.settled = false; } else { w.still += dt; if (w.still > 0.35) w.settled = true; }
}

// What a throw would do on a copy of the world (every ball in place): path samples, where it lands and where it comes to rest.
export function previewThrow(w, p, o = {}) {
  const c = o.alone ? createWorld(w.surf) : cloneWorld(w);
  const b = newBall(-9, p.side ?? 0, !!o.mingo);
  c.balls.push(b);
  launch(c, b, p);
  const path = [], every = o.every ?? 4, ev = [];
  let land = null, hitAt = null, n = 0;
  for (let i = 0; i < 60 * 7; i++) {
    ev.length = 0;
    stepWorld(c, 1 / 60, ev);
    for (const e of ev) { if (e.t === 'land' && !land) land = { x: e.x, y: e.y }; if (e.t === 'hit' && !hitAt && (e.a === -9 || e.b === -9)) hitAt = { x: e.x, y: e.y }; }
    if (n++ % every === 0 && b.st !== 'out') path.push({ x: b.x, y: b.y, z: b.z });
    if (c.settled && i > 10) break;
  }
  return { path, land, hit: hitAt, rest: { x: b.x, y: b.y, out: b.st === 'out' }, world: c, ball: b };
}

// Error a timed release adds to a throw. `dev` is the needle's signed offset from the middle of the sweet spot (negative = early,
// positive = late), `half` the half-width of the sweet spot, `n1`, `n2` two independent draws in -1..1 (the small unavoidable wobble).
// Early throws land short and late throws land long; the further outside the sweet spot, the larger the miss.
export function releaseError(dev, half, style, n1, n2) {
  const w = style === 'shot' ? 1.5 : style === 'lob' ? 1.1 : 0.9;
  const e = Math.abs(dev) / half, over = Math.max(0, e - 1);
  const along = n1 * 0.05 * w + Math.sign(dev) * (over * 0.7 + Math.min(e, 1) * 0.04) * w;
  const across = n2 * 0.05 * w + n2 * over * 0.35 * w;
  return { along, across, e };
}

// Distance between the faces of two balls (what the scorer measures).
export const gap = (a, b) => Math.max(0, Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r);

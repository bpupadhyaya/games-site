// Spinning Tops Arena: the physics. Pure and deterministic (fixed step, no clock, no randomness).
// World: a shallow dish, centre (0,0), x to the right, y toward the player's side of the table.
// Every top has a spin rate, a tilt vector (which precesses around the vertical, faster as the spin slows),
// a position and a velocity. The dish pulls tops toward the middle and curves their paths a little, tops
// push each other off line and off spin, and the rim lets a top out when it arrives hard enough.
export const W = 720, H = 1280;
export const ARENA = { cx: 360, cy: 690, R: 262, sy: 0.8 };
export const STEP = 1 / 60;

// ---- the parts of a top ---------------------------------------------------------------------------------------
// r: radius (px), m: mass, kg: radius of gyration as a share of r (how far out the weight sits),
// h: height of the centre of mass above the tip, e: how bouncy the body is.
export const BODIES = {
  disc: { id: 'disc', name: 'Wide Disc', blurb: 'Broad and heavy at the rim. Hits hard, steady, a big target.', r: 46, m: 1.3, kg: 0.605, h: 17, e: 0.552, air: 1.5, fr: 1.265 },
  pear: { id: 'pear', name: 'Pear', blurb: 'The all-rounder: nothing extreme, nothing missing.', r: 39, m: 1.0, kg: 0.56, h: 29, e: 0.704, air: 0.934, fr: 1 },
  spire: { id: 'spire', name: 'Spire', blurb: 'Tall and light. Quick off the cord, a small target, easier to knock over.', r: 31, m: 0.85, kg: 0.511, h: 40.872, e: 0.7, air: 0.542, fr: 0.72 },
  dome: { id: 'dome', name: 'Low Dome', blurb: 'Squat with a low centre of weight. Very steady, a little slow to hit.', r: 40, m: 1.1, kg: 0.6, h: 15.272, e: 0.483, air: 1.208, fr: 1.257 },
};
export const TIPS = {
  steel: { id: 'steel', name: 'Steel Point', blurb: 'Almost no friction: spins long and skates fast, but slides about.', fric: 0.985, lat: 0.102, kick: 1.15, gm: 0.923 },
  pebble: { id: 'pebble', name: 'Round Tip', blurb: 'A rounded tip: some friction, some grip. Balanced.', fric: 1.083, lat: 0.3, kick: 1, gm: 1.093 },
  peg: { id: 'peg', name: 'Flat Peg', blurb: 'A blunt peg: grips the dish and holds its ground, but wears the spin quickly.', fric: 1.09, lat: 1.25, kick: 0.629, gm: 1.516 },
};
export const BALLAST = {
  light: { id: 'light', name: 'Light', blurb: 'No extra weight. Launches fast and spins up high.', m: 0.737, kg: 0.942, r: 0.97 },
  std: { id: 'std', name: 'Standard', blurb: 'The turned wood as it comes.', m: 1.0, kg: 1.0, r: 1.0 },
  heavy: { id: 'heavy', name: 'Rim Ring', blurb: 'A lead ring set into the rim: more weight and more steadiness, slower to launch.', m: 1.341, kg: 1.016, r: 1.04 },
};
// The contest has a weight limit: the turned body and the ballast together may not go over it.
export const WEIGHT = { limit: 6, body: { disc: 5, dome: 4, pear: 3, spire: 2 }, ballast: { light: 0, std: 1, heavy: 2 } };
export const weightOf = (b) => WEIGHT.body[b.body] + WEIGHT.ballast[b.ballast];
export const legal = (b) => weightOf(b) <= WEIGHT.limit;
export const BODY_IDS = Object.keys(BODIES), TIP_IDS = Object.keys(TIPS), BALLAST_IDS = Object.keys(BALLAST);

// the dishes
export const ARENAS = {
  shallow: { id: 'shallow', name: 'Shallow Dish', blurb: 'A gentle bowl. Tops drift back toward the middle and meet often.', pull: 1.7, rim: 1.1, lip: 340, wall: 0.5 },
  bowl: { id: 'bowl', name: 'Deep Bowl', blurb: 'Steep sides pull everything to the middle. Hard to knock out, so the spin decides.', pull: 2.908, rim: 1.6, lip: 508.158, wall: 0.4 },
  plate: { id: 'plate', name: 'Flat Plate', blurb: 'Almost flat with a low edge. Little pull, and a hard hit can send a top over the rim.', pull: 1, rim: 0.5, lip: 270, wall: 0.55 },
};
export const ARENA_IDS = Object.keys(ARENAS);

export const K = {
  S: 1.3,             // overall size of the tops (the table numbers above are for S = 1)
  E0: 2.9e6,          // energy of a full cord pull (spin up)
  VMAX: 560,          // launch speed at full power for a mass of 1
  TAU0: 1750,         // tip friction torque for a friction factor of 1
  AIR: 1.2e-4,        // air drag on the spin
  G: 980,
  FALL: 1.05,         // tilt (rad) at which a top falls over
  DEAD: 3,            // spin (rad/s) below which a top has stopped
  CURL: 0.9,          // sideways bend of a spinning top's path (rad/s): a spinning top curves rather than runs straight
  KT: 0.9, LREF: 1200,// tilt kick from a hit: impulse * height / (angular momentum + LREF)
  MU: 0.25,           // friction between touching tops
  GRACE: 0.7,         // seconds after launch before the rim can put a top out
  TIME: 70,           // round time limit
  SPAWN: 0.74,        // launch spots at this share of the dish radius
  SLOW: 0.3,
  TREC0: 0.25, TREC1: 0.15, // how fast a steady top settles after being tipped
  FM: 0.85,           // how fast friction grows with weight on the tip
  WC: 5.5,            // steadiness threshold factor (2 for a plain sleeping top; higher so wobble shows earlier)
  BUMP: 40,           // the dish is not perfectly smooth: a fixed pattern of dents nudges tops about
};

const cache = new Map();
export const clearCache = () => { cache.clear(); RANGE = null; };
export function derive(b) {
  const key = `${b.body}|${b.tip}|${b.ballast}`;
  let d = cache.get(key);
  if (d) return d;
  const bo = BODIES[b.body], bl = BALLAST[b.ballast], tp = TIPS[b.tip];
  const S = K.S;
  const m = bo.m * bl.m, r = bo.r * bl.r * S, kg = bo.kg * bl.kg;
  const I = m * (kg * r) * (kg * r);
  const h = bo.h * S;
  const fric = tp.fric * Math.pow(m, K.FM) * bo.fr;
  const w0 = Math.sqrt((2 * K.E0 * S * S) / I);
  const wc = K.WC * Math.sqrt(S) * Math.sqrt((0.8 * m * K.G * h) / I);
  const tau = (K.TAU0 * S * S * fric) / I;
  const air = K.AIR * (r / (39 * S)) * (r / (39 * S)) * bo.air;
  // time to run down from a full launch to the point where it starts to wobble, untouched
  let w = w0, t = 0;
  while (w > wc && t < 200) { w -= (tau + air * w * w) * 0.05; t += 0.05; }
  const life = t;
  const vmax = K.VMAX / Math.sqrt(m);
  d = { key, kick: tp.kick, gm: tp.gm, m, r, kg, I, h, e: bo.e, fric, lat: tp.lat, w0, wc, tau, air, life, vmax, L0: I * w0 };
  cache.set(key, d);
  return d;
}

// What the workshop shows. Each is read straight off the physics numbers above (relative to the whole part range).
let RANGE = null;
function ranges() {
  if (RANGE) return RANGE;
  const R = { a: [1e9, -1e9], d: [1e9, -1e9], s: [1e9, -1e9] };
  for (const bo of BODY_IDS) for (const tp of TIP_IDS) for (const bl of BALLAST_IDS) {
    const v = rawStats(derive({ body: bo, tip: tp, ballast: bl }));
    for (const k of ['a', 'd', 's']) { R[k][0] = Math.min(R[k][0], v[k]); R[k][1] = Math.max(R[k][1], v[k]); }
  }
  RANGE = R;
  return R;
}
// attack: how hard it hits (weight and bounce at the launch pace); defence: how well it keeps steady and holds
// its ground when hit (angular momentum against the height of its weight, and grip); stamina: seconds of good spin
function rawStats(d) {
  return { a: d.m * (1 + d.e) * Math.sqrt(d.r / 39) * Math.sqrt(d.vmax / 560) * (1 - 0.15 * d.lat), d: Math.sqrt(d.L0 / d.h) * (1 + 0.25 * d.lat) * Math.pow(d.m, 0.3), s: d.life };
}
export function partStats(b) {
  const d = derive(b), v = rawStats(d), R = ranges();
  const n = (k) => Math.round(100 * (v[k] - R[k][0]) / Math.max(1e-6, R[k][1] - R[k][0]));
  return { attack: n('a'), defence: n('d'), stamina: n('s'), life: d.life, d };
}

// ---- the world ------------------------------------------------------------------------------------------------
export function newTop(side, build, launch, arena) {
  const d = derive(build);
  const q = launch.q;
  const sy = side === 0 ? 1 : -1;
  const dir = launch.ang;
  const sp = launch.pow * d.vmax;
  return {
    side, build: { body: build.body, tip: build.tip, ballast: build.ballast, hand: build.hand ?? 1 },
    x: 0, y: sy * K.SPAWN * ARENA.R,
    vx: Math.cos(dir) * sp, vy: Math.sin(dir) * sp,
    w: q * d.w0, w0: q * d.w0, sg: build.hand === -1 ? -1 : 1,
    tx: 0.02 + (1 - q) * 0.12, ty: 0.01, // tilt vector
    st: 0, stT: 0, ang: side * 2.1, out: 0, hit: 0, q,
  };
}

export function newWorld(arena, builds, launches) {
  const w = {
    arena, t: 0, tops: [newTop(0, builds[0], launches[0], arena), newTop(1, builds[1], launches[1], arena)],
    over: null, slow: 0, ev: [], contact: 0, hits: 0, shakeE: 0, big: 0,
  };
  return w;
}
export function cloneWorld(w) {
  return { ...w, tops: w.tops.map((t) => ({ ...t, build: t.build })), ev: [], over: w.over ? { ...w.over } : null };
}
export const tiltOf = (t) => Math.hypot(t.tx, t.ty);
export const alive = (t) => t.st === 0;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export { clamp };

function bowlAccel(t, A, d, out) {
  const R = ARENA.R;
  const r = Math.hypot(t.x, t.y);
  const f = A.pull * (1 + A.rim * (r / R) * (r / R));
  out.ax = -f * t.x; out.ay = -f * t.y;
  // the sideways bend: a spinning top on a curved surface is pushed round, not straight, by the slope
  const sp = t.st === 0 ? clamp(t.w / (d.w0 || 1), 0, 1.2) : 0;
  out.cx = -t.sg * K.CURL * sp * t.vy; out.cy = t.sg * K.CURL * sp * t.vx;
  out.cx += K.BUMP * Math.sin(t.x * 0.021 + 1.3) * Math.cos(t.y * 0.017); out.cy += K.BUMP * Math.cos(t.x * 0.019) * Math.sin(t.y * 0.023 + 0.7);
}
const AC = { ax: 0, ay: 0, cx: 0, cy: 0 };

// a top that has stopped or fallen: drawn lying down and rolling to rest
function downTop(t, why) {
  if (t.st !== 0) return;
  t.st = why === 'out' ? 2 : 1; t.stT = 0; t.why = why;
}

export function stepWorld(w, dtIn = STEP) {
  const A = ARENAS[w.arena];
  const nsub = 2, dt = dtIn / nsub;
  for (let s = 0; s < nsub; s++) {
    for (const t of w.tops) {
      const d = derive(t.build);
      if (t.st === 2) { t.stT += dt; continue; }
      bowlAccel(t, A, d, AC);
      if (t.st === 0) {
        // linear motion
        t.vx += (AC.ax + AC.cx) * dt; t.vy += (AC.ay + AC.cy) * dt;
        const damp = Math.exp(-d.lat * dt);
        t.vx *= damp; t.vy *= damp;
        // spin: tip friction (worse when tilted: the side drags), air
        const th = Math.hypot(t.tx, t.ty);
        const dw = (d.tau * (1 + 4 * th * th) + d.air * t.w * t.w) * dt;
        t.w = Math.max(0, t.w - dw);
        // tilt: grows when the spin is below the steady value, shrinks above it; the tilt vector precesses
        const sr = t.w / d.wc;
        const grow = 2.0 * (1 - sr);
        let nt = th + (sr < 1 ? grow * (th + 0.03) : -(K.TREC0 + K.TREC1 * Math.min(sr, 5)) * th) * dt;
        if (nt < 0) nt = 0;
        const om = t.w > 1 ? Math.min(14, (d.m * K.G * d.h * K.S) / (d.I * t.w)) : 14;
        const ang = t.sg * om * dt, ca = Math.cos(ang), sa = Math.sin(ang);
        let ux = th > 1e-6 ? t.tx / th : 1, uy = th > 1e-6 ? t.ty / th : 0;
        const rx = ux * ca - uy * sa, ry = ux * sa + uy * ca;
        t.tx = rx * nt; t.ty = ry * nt;
        t.om = om;
        // the tip wanders as the tilt precesses
        const walk = om * 0.45 * d.h * nt * dt;
        t.x += -ry * walk; t.y += rx * walk;
        t.ang += t.sg * Math.min(t.w, 40) * dt;
        if (nt > K.FALL) downTop(t, 'wobble');
        else if (t.w < K.DEAD) downTop(t, 'spin');
        if (t.st !== 0) { t.stT = 0; w.ev.push({ t: 'down', side: t.side, why: t.why, x: t.x, y: t.y }); }
      } else {
        // fallen: rolls and scrapes to rest
        t.vx += AC.ax * dt * 0.5; t.vy += AC.ay * dt * 0.5;
        const damp = Math.exp(-2.4 * dt);
        t.vx *= damp; t.vy *= damp;
        t.w = Math.max(0, t.w - 40 * dt);
        t.stT += dt;
      }
      t.x += t.vx * dt; t.y += t.vy * dt;
    }
    // top against top
    const [a, b] = w.tops;
    const da = derive(a.build), db = derive(b.build);
    let dx = b.x - a.x, dy = b.y - a.y;
    let dist = Math.hypot(dx, dy);
    const ra = da.r * (a.st === 1 ? 1.1 : 1) + da.h * 0.5 * Math.sin(tiltOf(a)), rb = db.r * (b.st === 1 ? 1.1 : 1) + db.h * 0.5 * Math.sin(tiltOf(b));
    if (a.st !== 2 && b.st !== 2 && dist < ra + rb) {
      if (dist < 1e-6) { dx = 1; dy = 0; dist = 1; }
      const nx = dx / dist, ny = dy / dist, tx = -ny, ty = nx;
      const over = ra + rb - dist;
      const im1 = 1 / (da.m * da.gm), im2 = 1 / (db.m * db.gm);
      a.x -= nx * over * (im1 / (im1 + im2)); a.y -= ny * over * (im1 / (im1 + im2));
      b.x += nx * over * (im2 / (im1 + im2)); b.y += ny * over * (im2 / (im1 + im2));
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn < 0) {
        const e = (da.e + db.e) / 2 * (Math.abs(vn) < 60 ? 0.5 : 1);
        const j = (-(1 + e) * vn) / (im1 + im2);
        a.vx -= j * im1 * nx; a.vy -= j * im1 * ny;
        b.vx += j * im2 * nx; b.vy += j * im2 * ny;
        // friction where the rims meet: spinning the same way they grind each other down, against each other they barely do
        const sa = a.st === 0 ? a.sg * a.w : 0, sb = b.st === 0 ? b.sg * b.w : 0;
        const vt = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty + sa * ra + sb * rb;
        const denom = im1 + im2 + (ra * ra) / da.I + (rb * rb) / db.I;
        let jt = -vt / denom;
        jt = clamp(jt, -K.MU * j, K.MU * j);
        a.vx += jt * im1 * tx; a.vy += jt * im1 * ty;
        b.vx -= jt * im2 * tx; b.vy -= jt * im2 * ty;
        if (a.st === 0) a.w = Math.max(0, a.w + a.sg * (ra * jt) / da.I);
        if (b.st === 0) b.w = Math.max(0, b.w + b.sg * (rb * jt) / db.I);
        // a hit tips a top over in the direction it was pushed; a fast spin resists, a slow one does not
        if (a.st === 0) kick(a, da, j * nx * -1, j * ny * -1, j);
        if (b.st === 0) kick(b, db, j * nx, j * ny, j);
        if (j > 40) {
          w.hits++;
          w.ev.push({ t: 'hit', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, f: j, nx, ny });
          w.big = Math.max(w.big, j);
        }
      }
      w.contact = 0.12;
    }
    // the rim
    for (const t of w.tops) {
      if (t.st === 2) continue;
      const d = derive(t.build);
      const lim = ARENA.R - d.r * 0.95;
      const r = Math.hypot(t.x, t.y);
      if (r > lim) {
        const nx = t.x / r, ny = t.y / r;
        const vr = t.vx * nx + t.vy * ny;
        const lip = A.lip * (1 - 0.006 * (d.h / K.S - 20));
        if (vr > 0) {
          if (t.st === 0 && w.t > K.GRACE && vr > lip) {
            downTop(t, 'out'); t.out = vr;
            w.ev.push({ t: 'out', side: t.side, x: t.x, y: t.y, v: vr });
            continue;
          }
          t.vx -= (1 + A.wall) * vr * nx; t.vy -= (1 + A.wall) * vr * ny;
          if (t.st === 0) kick(t, d, nx * -vr * d.m * 0.5, ny * -vr * d.m * 0.5, vr * d.m * 0.5);
          if (vr > 40) w.ev.push({ t: 'wall', x: t.x, y: t.y, f: vr, side: t.side });
        }
        t.x = nx * lim; t.y = ny * lim;
      }
    }
  }
  w.t += dtIn;
  if (w.contact > 0) w.contact = Math.max(0, w.contact - dtIn);
  if (!w.over) judge(w);
  return w;
}

function kick(t, d, ix, iy, mag) {
  const dth = (K.KT * K.S * d.kick * mag * d.h) / (d.I * t.w + K.LREF * K.S * K.S);
  const m = Math.hypot(ix, iy) || 1;
  // a hit tilts the top away from the side it was pushed from
  t.tx += (ix / m) * dth; t.ty += (iy / m) * dth;
}

function judge(w) {
  const [a, b] = w.tops;
  const la = a.st === 0, lb = b.st === 0;
  const power = (t) => (t.st === 0 ? t.w * derive(t.build).I : 0);
  if (la && lb) {
    if (w.t >= K.TIME) { const win = power(a) >= power(b) ? 0 : 1; w.over = { winner: win, loser: 1 - win, why: 'time', t: w.t }; }
    return;
  }
  if (la && !lb) w.over = { winner: 0, loser: 1, why: b.why, t: w.t };
  else if (!la && lb) w.over = { winner: 1, loser: 0, why: a.why, t: w.t };
  else {
    // both stopped in the same step: the one that was still turning faster at the end wins
    const win = a.w >= b.w ? 0 : 1;
    w.over = { winner: win, loser: 1 - win, why: [a, b][1 - win].why, t: w.t, both: true };
  }
  w.slow = 1.3;
}

// run a whole round to its end (used by the rivals, the hint and the workshop)
export function runRound(w, maxT = K.TIME + 2) {
  while (!w.over && w.t < maxT) { stepWorld(w); w.ev.length = 0; }
  return w;
}

// the path a launched top takes alone for `secs` (aiming guide); returns screen-plane points in world units
export function predictPath(side, build, launch, arena, secs = 1.4, every = 3) {
  const t0 = newTop(side, build, launch, arena);
  const w = { arena, t: 1, tops: [t0, { ...newTop(1 - side, build, { ang: 0, pow: 0, q: 0.01 }, arena), x: 9999, y: 9999, st: 2 }], over: null, slow: 0, ev: [], contact: 0, hits: 0, big: 0 };
  const pts = [];
  const n = Math.round(secs / STEP);
  for (let i = 0; i < n; i++) {
    stepWorld(w); w.ev.length = 0;
    if (i % every === 0) pts.push({ x: t0.x, y: t0.y });
    if (t0.st !== 0) break;
  }
  pts.out = t0.st === 2;
  return pts;
}

export function launchSpot(side) { return { x: 0, y: (side === 0 ? 1 : -1) * K.SPAWN * ARENA.R }; }

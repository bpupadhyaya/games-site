// Bocce physics: a deterministic fixed-step simulation of balls and the pallino on a walled court.
// Pure data in, pure data out (JSON-serialisable world). No DOM, no randomness inside the step.
//
// Units are metres. x runs across the court (0 = centre line), y runs down the court from the
// near end wall (y = 0) to the back wall (y = L), z is the height of a ball's CENTRE above the floor.
// The court is a scaled version of a real one (balls are drawn a little large so they read on a phone).
export const G = 9.8;
export const COURT = { W: 3.4, L: 18, foul: 3.0, center: 9, railH: 0.42, wallH: 0.7, startY: 2.85 };
export const R_B = 0.118;        // ball radius
export const R_P = 0.066;        // pallino radius
export const M_B = 1;
export const M_P = 0.22;
export const HALF = COURT.W / 2;
export const MAX_ANG = (38 * Math.PI) / 180;
const SUB = 4;                   // physics substeps per 1/60 s tick

// What a pull of the finger means. p = 0..1 (pull length), see powerOf() in game.js.
export const TYPES = [
  { id: 'roll', name: 'Roll', it: 'Raffa', hint: 'Bowl it along the floor' },
  { id: 'lob', name: 'Lob', it: 'Volo', hint: 'Fly it, drop it, it stops soon' },
  { id: 'hit', name: 'Hit', it: 'Colpo', hint: 'Fast and low, to knock balls away' },
];
export const SPINS = [-2, -1, 0, 1, 2];
export const spinName = (s) => (s === 0 ? 'Straight' : `${Math.abs(s) === 2 ? 'Strong ' : ''}curve ${s < 0 ? 'left' : 'right'}`);

// ---- courts (surfaces) ----------------------------------------------------------------------------
export const SURFACES = {
  shell: { id: 'shell', name: 'Oyster Shell', sub: 'The classic: crushed shell, true and medium-fast', c: 1.5, rail: 0.64, back: 0.45, bounce: 0.2, keep: 0.26, lean: 0, pal: 'shell' },
  clay: { id: 'clay', name: 'Red Clay', sub: 'Fast and slick: balls run a long way', c: 1.05, rail: 0.72, back: 0.5, bounce: 0.22, keep: 0.34, lean: 0, pal: 'clay' },
  lawn: { id: 'lawn', name: 'Garden Lawn', sub: 'Slow, grippy, with a gentle lean', c: 2.15, rail: 0.52, back: 0.4, bounce: 0.12, keep: 0.18, lean: 0.06, pal: 'lawn' },
  sand: { id: 'sand', name: 'Beach Sand', sub: 'Heavy going: lobs drop dead', c: 3.0, rail: 0.46, back: 0.35, bounce: 0.05, keep: 0.1, lean: 0, pal: 'sand' },
};
export const SURFACE_IDS = ['shell', 'clay', 'lawn', 'sand', 'daily'];
export const surfaceName = (id) => (id === 'daily' ? 'Daily Court' : (SURFACES[id] ?? SURFACES.shell).name);
export function makeSurface(id, rnd) {
  if (SURFACES[id]) return { ...SURFACES[id] };
  const R = (a, b) => a + rnd.next() * (b - a);
  const pals = ['shell', 'clay', 'lawn', 'sand'];
  return {
    id: 'daily', name: 'Daily Court', sub: 'A new court every day', c: R(1.0, 2.5), rail: R(0.48, 0.72), back: R(0.35, 0.5), bounce: R(0.06, 0.22), keep: R(0.12, 0.34),
    lean: (rnd.next() < 0.5 ? -1 : 1) * R(0, 0.08), pal: pals[Math.floor(rnd.next() * 4)],
  };
}

// ---- balls and the world ---------------------------------------------------------------------------
export const PALLINO = 0;
export function newBall(id, team, k = false) {
  return {
    id, team, k, r: k ? R_P : R_B, m: k ? M_P : M_B, x: 0, y: COURT.startY, z: R_B, vx: 0, vy: 0, vz: 0, sp: 0,
    air: false, out: false, dead: false, touched: false, wall: false, fade: 0, flew: 0,
  };
}
export function createWorld(surf) {
  return { surf, balls: [], t: 0, settled: true, ev: [] };
}
export function cloneWorld(w) {
  return { surf: w.surf, t: w.t, settled: w.settled, ev: [], balls: w.balls.map((b) => ({ ...b })) };
}
export const live = (w) => w.balls.filter((b) => !b.out && !b.dead);
export const thePallino = (w) => w.balls.find((b) => b.k && !b.out && !b.dead) ?? null;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- throwing --------------------------------------------------------------------------------------
// A throw: { type: 0 roll | 1 lob | 2 hit, power: 0..1, ang: radians from straight ahead (+ = to the right), spin: -2..2, x: release x }
const LOB_TH = (44 * Math.PI) / 180, LOB_Z = 1.05, HIT_TH = (3 * Math.PI) / 180, HIT_Z = 0.5;
export const rollSpeed = (p) => 1.8 + p * 4.9;
export const hitSpeed = (p) => 9 + p * 8;
export const lobRange = (p) => 3 + p * 12;
// horizontal distance of a ballistic flight released at height z0 with speed v at angle th
function flightRange(v, th, z0) {
  const vs = v * Math.sin(th), vc = v * Math.cos(th);
  return vc * ((vs + Math.sqrt(vs * vs + 2 * G * (z0 - R_B))) / G);
}
export function lobSpeed(D) {
  let lo = 2, hi = 24;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (flightRange(m, LOB_TH, LOB_Z) < D) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
export function launch(w, b, t) {
  b.x = clamp(t.x ?? 0, -HALF + b.r + 0.05, HALF - b.r - 0.05); b.y = COURT.startY;
  const ca = Math.cos(t.ang), sa = Math.sin(t.ang);
  let v, th = 0, z = b.r;
  if (t.type === 0) v = rollSpeed(t.power);
  else if (t.type === 1) { v = lobSpeed(lobRange(t.power)); th = LOB_TH; z = LOB_Z; }
  else { v = hitSpeed(t.power); th = HIT_TH; z = HIT_Z; }
  const vh = v * Math.cos(th);
  b.z = z; b.vx = vh * sa; b.vy = vh * ca; b.vz = v * Math.sin(th);
  b.air = z > b.r + 1e-3; b.sp = t.spin ?? 0; b.out = false; b.dead = false; b.touched = false; b.wall = false; b.fade = 0;
  b.type = t.type;
  w.settled = false;
  return b;
}

// ---- the step --------------------------------------------------------------------------------------
const KC = 0.1;                // curve strength per spin level
export function stepWorld(w, dt, ev = w.ev) {
  const h = dt / SUB;
  for (let s = 0; s < SUB; s++) sub(w, h, ev);
  w.t += dt;
  let still = true;
  for (const b of w.balls) {
    if (b.out || b.dead) { b.fade += dt; continue; }
    if (b.vx * b.vx + b.vy * b.vy > 1e-4 || b.z > b.r + 2e-3 || Math.abs(b.vz) > 0.02) { still = false; }
  }
  w.settled = still;
  return ev;
}
export function drain(w) { const e = w.ev; w.ev = []; return e; }

function sub(w, h, ev) {
  const S = w.surf, balls = w.balls;
  for (const b of balls) {
    if (b.out || b.dead) continue;
    const r = b.r;
    if (b.z > r + 1e-4 || b.vz > 0.05) {
      // in the air
      b.vz -= G * h; b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h; b.flew += h;
      if (b.z <= r && b.vz < 0) {
        const imp = -b.vz;
        b.z = r;
        const k = 1 - (1 - S.keep) * Math.min(1, imp / 3.2);
        b.vx *= k; b.vy *= k;
        b.vz = imp * S.bounce;
        if (b.vz < 0.55) b.vz = 0;
        b.air = false;
        if (imp > 0.7) ev.push({ t: 'land', id: b.id, x: b.x, y: b.y, v: imp, soft: S.keep < 0.2 ? 1 : 0 });
      }
    } else {
      // on the floor: rolling resistance, the court's lean and the curve of a spun ball
      b.z = r; b.vz = 0;
      const v = Math.hypot(b.vx, b.vy);
      if (v > 0) {
        const dec = (S.c + 0.025 * v) * h;
        let nv = v - dec;
        if (nv <= 0.03) { b.vx = 0; b.vy = 0; nv = 0; }
        else {
          const f = nv / v; b.vx *= f; b.vy *= f;
          const cu = b.sp * KC * (1 + 1.4 * (1 - Math.min(1, nv / 6)));
          const ox = b.vx, oy = b.vy; b.vx += (oy / nv) * cu * h; b.vy += (-ox / nv) * cu * h;
        }
        if (S.lean && nv > 0) b.vx += S.lean * h;
        b.x += b.vx * h; b.y += b.vy * h;
      }
    }
    // side rails
    const lim = HALF - r;
    if (b.z < COURT.railH + r) {
      if (b.x > lim) { b.x = lim; if (b.vx > 0) { const sp = b.vx; b.vx = -b.vx * S.rail; b.vy *= 0.97; if (sp > 0.3) ev.push({ t: 'rail', id: b.id, x: b.x, y: b.y, v: sp }); } }
      else if (b.x < -lim) { b.x = -lim; if (b.vx < 0) { const sp = -b.vx; b.vx = -b.vx * S.rail; b.vy *= 0.97; if (sp > 0.3) ev.push({ t: 'rail', id: b.id, x: b.x, y: b.y, v: sp }); } }
    } else if (Math.abs(b.x) > HALF + 0.06 && b.z < COURT.railH + r + 0.05) { /* just clipped the rail top */ }
    else if (Math.abs(b.x) > HALF + 0.12) { b.out = true; b.fade = 0; ev.push({ t: 'out', id: b.id, x: b.x, y: b.y, k: b.k }); continue; }
    // end walls
    if (b.y > COURT.L - r) {
      if (b.z < COURT.wallH + r) {
        b.y = COURT.L - r;
        if (b.vy > 0) {
          const sp = b.vy; b.vy = -b.vy * S.back; b.vx *= 0.96;
          if (sp > 0.3) ev.push({ t: 'wall', id: b.id, x: b.x, y: b.y, v: sp });
          if (!b.touched && !b.k && !b.wall) { b.wall = true; b.dead = true; b.fade = 0; ev.push({ t: 'dead', id: b.id, x: b.x, y: b.y }); continue; }
          if (b.k && !b.touched) b.wall = true;
        }
      } else if (b.y > COURT.L + 0.3) { b.out = true; ev.push({ t: 'out', id: b.id, x: b.x, y: b.y, k: b.k }); continue; }
    }
    if (b.y < r + 0.05 && b.vy < 0 && b.z < COURT.wallH + r) { b.y = r + 0.05; b.vy = -b.vy * 0.5; }
  }
  // ball against ball (full 3D spheres, so a lobbed ball can land on or knock into another)
  for (let i = 0; i < balls.length; i++) {
    const A = balls[i];
    if (A.out || A.dead) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const B = balls[j];
      if (B.out || B.dead) continue;
      const dx = B.x - A.x, dy = B.y - A.y, dz = B.z - A.z, rr = A.r + B.r;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= rr * rr || d2 < 1e-12) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d;
      const rvn = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny + (B.vz - A.vz) * nz;
      if (rvn < 0) {
        const e = A.k || B.k ? 0.78 : 0.86, jm = (-(1 + e) * rvn) / (1 / A.m + 1 / B.m);
        A.vx -= (jm / A.m) * nx; A.vy -= (jm / A.m) * ny; A.vz -= (jm / A.m) * nz;
        B.vx += (jm / B.m) * nx; B.vy += (jm / B.m) * ny; B.vz += (jm / B.m) * nz;
        A.touched = true; B.touched = true;
        if (-rvn > 0.25) ev.push({ t: 'hit', a: A.id, b: B.id, x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, z: (A.z + B.z) / 2, v: -rvn, k: A.k || B.k });
        // a spin does not survive a collision
        A.sp *= 0.3; B.sp *= 0.3;
      }
      const ov = rr - d, ta = B.m / (A.m + B.m), tb = A.m / (A.m + B.m);
      A.x -= nx * ov * ta; A.y -= ny * ov * ta; A.z -= nz * ov * ta;
      B.x += nx * ov * tb; B.y += ny * ov * tb; B.z += nz * ov * tb;
      if (A.z < A.r) { A.z = A.r; if (A.vz < 0) A.vz = 0; }
      if (B.z < B.r) { B.z = B.r; if (B.vz < 0) B.vz = 0; }
    }
  }
}

// run the world until everything is still (used by the AI and by previews)
export function settleWorld(w, maxT = 12) {
  const ev = [];
  for (let t = 0; t < maxT; t += 1 / 60) { stepWorld(w, 1 / 60, ev); ev.length = 0; if (w.settled) break; }
}

// ---- measuring ---------------------------------------------------------------------------------------
export const dist2D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const TIE_EPS = 0.004;
// live balls (not the pallino), nearest first, with their distance to the pallino
export function ranking(w) {
  const p = thePallino(w);
  if (!p) return [];
  return w.balls.filter((b) => !b.k && !b.out && !b.dead).map((b) => ({ b, d: dist2D(b, p) })).sort((a, c) => a.d - c.d);
}
// the end score as the rules count it: { team, pts, tie }
export function frameScore(w) {
  const rk = ranking(w);
  if (!rk.length) return { team: -1, pts: 0, tie: false, empty: true };
  const lead = rk[0].b.team;
  const other = rk.find((r) => r.b.team !== lead);
  if (other && Math.abs(other.d - rk[0].d) < TIE_EPS) return { team: -1, pts: 0, tie: true };
  let pts = 0;
  for (const r of rk) { if (r.b.team !== lead) break; if (!other || r.d < other.d - TIE_EPS) pts++; else break; }
  return { team: lead, pts, tie: false };
}

// ---- previews and the solver the AI and the hint use ---------------------------------------------------
// A lone ball thrown on an empty court: where does it land and where does it stop? Returns the sampled path too.
export function previewThrow(surf, t, o = {}) {
  const w = createWorld(surf);
  const b = newBall(1, 0, !!o.pallino);
  w.balls.push(b);
  launch(w, b, t);
  const path = [];
  let land = null, steps = 0;
  const ev = [];
  for (let tt = 0; tt < 12; tt += 1 / 60) {
    stepWorld(w, 1 / 60, ev);
    for (const e of ev) if (e.t === 'land' && !land) land = { x: e.x, y: e.y };
    ev.length = 0;
    if (steps++ % (o.every ?? 3) === 0) path.push({ x: b.x, y: b.y, z: b.z });
    if (w.settled || b.out || b.dead) break;
  }
  return { path, rest: { x: b.x, y: b.y }, land, out: b.out, dead: b.dead };
}
const restCache = new Map();
export function restOf(surf, t) {
  const key = `${surf.c.toFixed(3)}|${surf.lean.toFixed(3)}|${surf.keep.toFixed(2)}|${t.type}|${t.power.toFixed(4)}|${t.ang.toFixed(4)}|${t.spin}|${t.x.toFixed(3)}`;
  let r = restCache.get(key);
  if (!r) { r = previewThrow(surf, t, { every: 99 }).rest; restCache.set(key, r); if (restCache.size > 4000) restCache.clear(); }
  return r;
}
// Find a throw of this type and spin that comes to rest at (tx, ty) from release x: a few Newton steps on (power, angle).
export function solveThrow(surf, type, spin, x0, tx, ty, p0 = 0.5) {
  let p = clamp(p0, 0.02, 0.98), a = Math.atan2(tx - x0, ty - COURT.startY);
  const f = (pp, aa) => restOf(surf, { type, power: clamp(pp, 0, 1), ang: clamp(aa, -MAX_ANG, MAX_ANG), spin, x: x0 });
  let best = null;
  for (let it = 0; it < 7; it++) {
    const r0 = f(p, a), ex = tx - r0.x, ey = ty - r0.y, err = Math.hypot(ex, ey);
    if (!best || err < best.err) best = { err, p, a, rest: r0 };
    if (err < 0.03) break;
    const dp = 0.01, da = 0.008;
    const rp = f(p + dp, a), ra = f(p, a + da);
    const jxp = (rp.x - r0.x) / dp, jyp = (rp.y - r0.y) / dp, jxa = (ra.x - r0.x) / da, jya = (ra.y - r0.y) / da;
    const det = jxp * jya - jxa * jyp;
    if (Math.abs(det) < 1e-6) break;
    p = clamp(p + (ex * jya - ey * jxa) / det, 0.01, 1); a = clamp(a + (jxp * ey - jyp * ex) / det, -MAX_ANG, MAX_ANG);
  }
  return best;
}

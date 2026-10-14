// Finnish pin toss physics. Pure and deterministic (fixed 1/360 s steps, no clock, no randomness): the same throw on the
// same lawn always gives the same result, so the preview, the hint and the computer rivals all use this exact code.
//
// Units: centimetres and seconds. x across the lawn (0 = the line the thrower stands on), y away from the thrower. The
// cluster of twelve skittles is centred on the origin; the throw line is LINE_Y behind it.
//
// A throw is a 3D flight (analytic arc) that ends when the pin touches the lawn. From then on pin and skittles are 2D
// bodies shaped like capsules (a segment with a radius): a standing skittle is a disc, a toppled one a lying capsule.
// A standing skittle hit hard enough topples (it becomes a lying capsule that slides and spins), softer touches bounce
// off. Lying bodies knock into each other with impulses (normal + a little friction), so chains happen naturally.

export const G = 981;                       // gravity (cm / s^2)
export const SK_R = 3.0;                    // skittle radius (6 cm across)
export const SK_H = 15;                     // skittle height (also its length when lying)
export const SK_HL = 4.5;                   // half length of the lying capsule's core segment (total 15 cm)
export const PIN_R = 3.0;
export const PIN_HL = 8.0;                  // total pin length 22 cm
export const LINE_Y = -350;                 // the throw line (3.5 m from the cluster)
export const HAND_Z = 38;                   // height the pin leaves the hand
export const BOUNDS = { x0: -125, x1: 125, y0: -100, y1: 150 };   // the playing field (rope); skittles stand back inside it
export const STEP = 1 / 360;
export const MU = 560;                      // lawn friction deceleration (cm / s^2)
export const W_FRIC = 16;                   // rotational friction (rad / s^2)
export const V_TOPPLE = 55;                 // normal speed (cm / s) that tips a standing skittle
export const E_BODY = 0.2, MU_C = 0.25;
export const M_SK = 1, M_PIN = 3.2;
export const I_SK = 20, I_PIN = 120;

export const STYLES = {
  elev: [1.08, 0.49],                       // Lob 62 degrees, Skim 28 degrees (radians)
  spinFlat: [false, true],
};
export const V_MIN = 260, V_MAX = 1000;

// The set-up: rows of 2, 3, 4, 3 skittles in a tight hexagonal bundle, numbered as in the traditional arrangement.
const ROWS = [[1, 2], [3, 10, 4], [5, 11, 12, 6], [7, 9, 8]];
const PITCH = 2 * SK_R + 0.25;
export function startSkittles() {
  const out = [];
  ROWS.forEach((row, ri) => {
    const y = (ri - 1.5) * PITCH * 0.866;
    row.forEach((num, j) => out.push({ num, x: (j - (row.length - 1) / 2) * PITCH, y }));
  });
  return out;
}
export const cloneSk = (a) => a.map((s) => ({ num: s.num, x: s.x, y: s.y }));

// Points for a throw: nothing 0, one skittle its number, several skittles their count.
export const pointsOf = (knocked) => (knocked.length === 0 ? 0 : knocked.length === 1 ? knocked[0] : knocked.length);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- the flight --------------------------------------------------------------------------------------------------
// spec: { psi (radians from straight ahead, + to the right), v (cm/s), style: 0 lob | 1 skim, flat: bool, yaw (landing yaw
// of a flat-spinning pin, radians), spinDir: 1 | -1, jit (tip style yaw jitter, radians) }
export function flightOf(spec) {
  const th = STYLES.elev[spec.style | 0];
  const v = clamp(spec.v, V_MIN, V_MAX);
  const vh = v * Math.cos(th), vz = v * Math.sin(th);
  const tl = (vz + Math.sqrt(vz * vz + 2 * G * (HAND_Z - PIN_R))) / G;
  const sx = Math.sin(spec.psi), sy = Math.cos(spec.psi);
  const vzL = vz - G * tl;
  // the lawn takes some of the speed: more when the pin comes in steeply
  const hv = vh * 0.8 * (vh / (vh + 0.4 * Math.abs(vzL)));
  return { vh, vz, tl, sx, sy, vzL, hv, x: vh * sx * tl, y: LINE_Y + vh * sy * tl, land: Math.hypot(vh * tl, 0) };
}
export function landingOf(spec) { const f = flightOf(spec); return { x: f.x, y: f.y, t: f.tl, hv: f.hv }; }
// Position (and axis) of the pin in the air at time t, for drawing and the dotted arc.
export function airPoint(spec, f, t) {
  return { x: f.vh * f.sx * t, y: LINE_Y + f.vh * f.sy * t, z: HAND_Z + f.vz * t - 0.5 * G * t * t };
}
// Solve for the strength that lands at distance `d` from the throw line (horizontal) with the given style.
export function strengthFor(d, style) {
  let lo = V_MIN, hi = V_MAX;
  for (let i = 0; i < 22; i++) {
    const m = (lo + hi) / 2, f = flightOf({ psi: 0, v: m, style });
    if (f.vh * f.tl < d) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}
// A spec that lands at (tx, ty).
export function specFor(tx, ty, style, flat = false, yaw = 0, spinDir = 1) {
  const dx = tx, dy = ty - LINE_Y, d = Math.hypot(dx, dy);
  return { psi: Math.atan2(dx, dy), v: strengthFor(d, style), style, flat, yaw, spinDir, jit: 0 };
}

// ---- bodies ------------------------------------------------------------------------------------------------------
let nextId = 1;
export const resetIds = () => { nextId = 1; };
const mkSk = (s) => ({ id: nextId++, kind: 0, num: s.num, st: 0, x: s.x, y: s.y, a: 0, vx: 0, vy: 0, w: 0, hl: 0, r: SK_R, m: M_SK, I: I_SK, hit: 0 });
const ends = (b, o) => { const c = Math.cos(b.a) * b.hl, s = Math.sin(b.a) * b.hl; o.x0 = b.x - c; o.y0 = b.y - s; o.x1 = b.x + c; o.y1 = b.y + s; };
const E1 = { x0: 0, y0: 0, x1: 0, y1: 0 }, E2 = { x0: 0, y0: 0, x1: 0, y1: 0 }, CP = { ax: 0, ay: 0, bx: 0, by: 0 };

function closestSeg(p1x, p1y, q1x, q1y, p2x, p2y, q2x, q2y, o) {
  const d1x = q1x - p1x, d1y = q1y - p1y, d2x = q2x - p2x, d2y = q2y - p2y, rx = p1x - p2x, ry = p1y - p2y;
  const a = d1x * d1x + d1y * d1y, e = d2x * d2x + d2y * d2y, f = d2x * rx + d2y * ry;
  let s, t;
  if (a <= 1e-9 && e <= 1e-9) { s = 0; t = 0; }
  else if (a <= 1e-9) { s = 0; t = clamp(f / e, 0, 1); }
  else {
    const c = d1x * rx + d1y * ry;
    if (e <= 1e-9) { t = 0; s = clamp(-c / a, 0, 1); }
    else {
      const b = d1x * d2x + d1y * d2y, den = a * e - b * b;
      s = den > 1e-9 ? clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }
  o.ax = p1x + d1x * s; o.ay = p1y + d1y * s; o.bx = p2x + d2x * t; o.by = p2y + d2y * t;
}

// Create a throw. `sk` = the skittles standing on the lawn [{num,x,y}]. Returns an object you advance with
// advance(dt) (any dt; it runs fixed steps) or tick() (one step). `o.events` receives { type, ... } records.
export function makeThrow(sk, spec) {
  const f = flightOf(spec);
  const bodies = sk.map(mkSk);
  const th = {
    spec, f, t: 0, air: true, bodies, pin: null, events: [], knocked: [], done: false, settleT: 0, acc: 0, landed: false, tl: f.tl,
  };
  const topple = (S, nx, ny, vn, vtx, vty) => {
    S.st = 1; S.hl = SK_HL; S.hit = 1;
    S.a = Math.atan2(ny, nx);
    S.x += nx * 4.2; S.y += ny * 4.2;
    S.vx = nx * vn + vtx * 0.25; S.vy = ny * vn + vty * 0.25;
    S.w = (nx * vty - ny * vtx) / (SK_HL + 4) * 0.5;
    th.knocked.push(S.num);
    th.events.push({ type: 'topple', num: S.num, v: vn, x: S.x, y: S.y });
  };
  function pair(A, B) {
    if (A.st === 0 && B.st === 0) return;
    ends(A, E1); ends(B, E2);
    closestSeg(E1.x0, E1.y0, E1.x1, E1.y1, E2.x0, E2.y0, E2.x1, E2.y1, CP);
    let dx = CP.bx - CP.ax, dy = CP.by - CP.ay, d = Math.hypot(dx, dy);
    const sum = A.r + B.r;
    if (d >= sum) return;
    if (d < 1e-6) { dx = -Math.sin(A.a); dy = Math.cos(A.a); d = 1; }
    const nx = dx / d, ny = dy / d, pen = sum - d;
    const cx = (CP.ax + CP.bx) / 2, cy = (CP.ay + CP.by) / 2;
    if (A.st === 0 || B.st === 0) {
      // a standing skittle S met by a body M that is moving or lying
      const S = A.st === 0 ? A : B, M = A.st === 0 ? B : A;
      const mx = S === B ? nx : -nx, my = S === B ? ny : -ny;     // from M towards S
      const rx = cx - M.x, ry = cy - M.y;
      const vcx = M.vx - M.w * ry, vcy = M.vy + M.w * rx;
      const vn = vcx * mx + vcy * my;
      const bonus = M.drop || 0;
      const eff = Math.max(vn, bonus);
      if (eff > V_TOPPLE) {
        const k = 1 + E_BODY;
        const sv = 0.56 * (k * M.m / (M.m + S.m)) * Math.max(vn, bonus * 0.5);
        const vtx = vcx - vn * mx, vty = vcy - vn * my;
        topple(S, mx, my, sv, vtx, vty);
        if (vn > 0) { const dv = ((M.m - E_BODY * S.m) / (M.m + S.m) - 1) * vn - 0.35 * vn; M.vx += mx * dv; M.vy += my * dv; }
        M.x -= mx * pen * 0.3; M.y -= my * pen * 0.3;
        if (M.kind === 1) th.events.push({ type: 'knock', v: vn, x: cx, y: cy });
      } else {
        M.x -= mx * pen; M.y -= my * pen;
        if (vn > 0) { const j = (1 + 0.25) * vn; M.vx -= mx * j; M.vy -= my * j; if (vn > 18) th.events.push({ type: 'tap', v: vn, x: cx, y: cy }); }
      }
      return;
    }
    // two lying bodies: impulse with rotation and a little friction
    const rax = cx - A.x, ray = cy - A.y, rbx = cx - B.x, rby = cy - B.y;
    const vax = A.vx - A.w * ray, vay = A.vy + A.w * rax, vbx = B.vx - B.w * rby, vby = B.vy + B.w * rbx;
    const rvx = vbx - vax, rvy = vby - vay;
    const vn = rvx * nx + rvy * ny;
    const iA = 1 / A.m, iB = 1 / B.m;
    const total = iA + iB;
    const push = pen / total * 0.85;
    A.x -= nx * push * iA; A.y -= ny * push * iA; B.x += nx * push * iB; B.y += ny * push * iB;
    if (vn >= 0) return;
    const raN = rax * ny - ray * nx, rbN = rbx * ny - rby * nx;
    const denom = total + raN * raN / A.I + rbN * rbN / B.I;
    const j = -(1 + E_BODY) * vn / denom;
    A.vx -= j * nx * iA; A.vy -= j * ny * iA; B.vx += j * nx * iB; B.vy += j * ny * iB;
    A.w -= j * raN / A.I; B.w += j * rbN / B.I;
    // friction along the contact
    const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty;
    const raT = rax * ty - ray * tx, rbT = rbx * ty - rby * tx;
    const dT = total + raT * raT / A.I + rbT * rbT / B.I;
    let jt = -vt / dT; const lim = MU_C * j; jt = clamp(jt, -lim, lim);
    A.vx -= jt * tx * iA; A.vy -= jt * ty * iA; B.vx += jt * tx * iB; B.vy += jt * ty * iB;
    A.w -= jt * raT / A.I; B.w += jt * rbT / B.I;
    if (-vn > 14) th.events.push({ type: 'knock', v: -vn, x: cx, y: cy });
  }
  function land() {
    const { spec: sp, f: fl } = th;
    const hx = fl.sx, hy = fl.sy;
    const dir = Math.atan2(hy, hx);
    const a = sp.flat ? sp.yaw : dir + (sp.jit || 0);
    const pin = {
      id: nextId++, kind: 1, num: 0, st: 1, x: fl.x, y: fl.y, a, vx: hx * fl.hv, vy: hy * fl.hv,
      w: sp.flat ? (sp.spinDir || 1) * 7 : 0, hl: PIN_HL, r: PIN_R, m: M_PIN, I: I_PIN, hit: 0, t: 0, drop: Math.abs(fl.vzL) * 0.2 + 30,
    };
    th.pin = pin; th.bodies.push(pin); th.landed = true;
    th.events.push({ type: 'land', v: Math.abs(fl.vzL), x: pin.x, y: pin.y });
  }
  th.tick = function tick() {
    th.t += STEP;
    if (th.air) {
      if (th.t >= th.tl) { th.air = false; land(); }
      else return;
    }
    const bs = th.bodies, n = bs.length;
    let moving = false;
    for (let i = 0; i < n; i++) {
      const b = bs[i];
      if (b.st === 0) continue;
      let sp = Math.hypot(b.vx, b.vy);
      if (sp > 0) {
        const ns = Math.max(0, sp - MU * STEP);
        const k = ns / sp; b.vx *= k; b.vy *= k; sp = ns;
        if (sp < 1.2) { b.vx = 0; b.vy = 0; sp = 0; }
      }
      if (b.w !== 0) { const nw = Math.max(0, Math.abs(b.w) - W_FRIC * STEP); b.w = b.w < 0 ? -nw : nw; if (nw < 0.15) b.w = 0; }
      if (sp > 0 || b.w !== 0) { b.x += b.vx * STEP; b.y += b.vy * STEP; b.a += b.w * STEP; moving = true; }
      if (b.x < -600) { b.x = -600; b.vx = 0; } else if (b.x > 600) { b.x = 600; b.vx = 0; }
      if (b.y < -600) { b.y = -600; b.vy = 0; } else if (b.y > 600) { b.y = 600; b.vy = 0; }
    }
    if (th.pin) { th.pin.t += STEP; if (th.pin.t > 0.06) th.pin.drop = 0; }
    if (moving || th.pin.t < 0.1) {
      for (let i = 0; i < n; i++) {
        const A = bs[i];
        const am = A.st === 1 && (A.vx !== 0 || A.vy !== 0 || A.w !== 0);
        const rA = A.hl + A.r;
        for (let j = i + 1; j < n; j++) {
          const B = bs[j];
          if (A.st === 0 && B.st === 0) continue;
          const bm = B.st === 1 && (B.vx !== 0 || B.vy !== 0 || B.w !== 0);
          if (!am && !bm && A !== th.pin && B !== th.pin) continue;
          const ddx = B.x - A.x, ddy = B.y - A.y, rr = rA + B.hl + B.r;
          if (ddx * ddx + ddy * ddy > rr * rr) continue;
          pair(A, B);
        }
      }
    }
    if (!moving) { th.settleT += STEP; if (th.settleT > 0.12) th.done = true; } else th.settleT = 0;
    if (th.t > 9) th.done = true;
  };
  th.advance = function advance(dt) {
    th.acc += dt;
    let n = 0;
    while (th.acc >= STEP && n < 40 && !th.done) { th.acc -= STEP; n++; th.tick(); }
    if (th.done) th.acc = 0;
  };
  // Stand every skittle up where it lies (back inside the field), separated. Returns the new standing set.
  th.standUp = function standUp() {
    const out = th.bodies.filter((b) => b.kind === 0).map((b) => ({
      num: b.num, x: clamp(b.x, BOUNDS.x0, BOUNDS.x1), y: clamp(b.y, BOUNDS.y0, BOUNDS.y1), moved: b.st === 1, out: b.x < BOUNDS.x0 || b.x > BOUNDS.x1 || b.y < BOUNDS.y0 || b.y > BOUNDS.y1,
    }));
    const min = 2 * SK_R + 0.1;
    for (let it = 0; it < 60; it++) {
      let any = false;
      for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
        const a = out[i], b = out[j];
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d >= min) continue;
        any = true;
        if (d < 1e-6) { dx = 1; dy = 0; d = 1; }
        const nx = dx / d, ny = dy / d, p = min - d;
        // standing skittles that were not toppled do not give way
        const wa = a.moved ? 1 : 0, wb = b.moved ? 1 : 0, ws = wa + wb || 1;
        const fa = wa ? (wb ? 0.5 : 1) : 0, fb = wb ? (wa ? 0.5 : 1) : 0;
        void ws;
        a.x -= nx * p * (fa || (wa + wb ? 0 : 0.5)); a.y -= ny * p * (fa || (wa + wb ? 0 : 0.5));
        b.x += nx * p * (fb || (wa + wb ? 0 : 0.5)); b.y += ny * p * (fb || (wa + wb ? 0 : 0.5));
        a.x = clamp(a.x, BOUNDS.x0, BOUNDS.x1); a.y = clamp(a.y, BOUNDS.y0, BOUNDS.y1);
        b.x = clamp(b.x, BOUNDS.x0, BOUNDS.x1); b.y = clamp(b.y, BOUNDS.y0, BOUNDS.y1);
      }
      if (!any) break;
    }
    return out.map((s) => ({ num: s.num, x: s.x, y: s.y }));
  };
  return th;
}

// Run a whole throw. Returns { knocked (sorted numbers), after (standing set), points, t, land }.
export function simulateThrow(sk, spec, o = {}) {
  const th = makeThrow(sk, spec);
  let n = 0;
  const maxN = Math.round((o.maxT ?? 9) / STEP);
  while (!th.done && n++ < maxN) th.tick();
  const knocked = th.knocked.slice().sort((a, b) => a - b);
  return { knocked, after: th.standUp(), points: pointsOf(knocked), t: th.t, land: { x: th.f.x, y: th.f.y } };
}

export const EXPORT_CONST = { PITCH, ROWS };

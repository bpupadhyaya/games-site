// Ken and ball physics: a side view of a ken (handle with a spike, a crossbar with a big and a small cup, and a base
// cup) held by a hand, and a heavy ball on a string. Pure and deterministic: plain numbers in, plain numbers out.
// The AI planner clones the world and runs this same step thousands of times, so it allocates as little as it can.
//
// Units are screen units (the game draws in 720 x 1280). y grows downward. The ken is kinematic: it follows the
// hand target like a critically damped spring, leans with its acceleration and can be flipped. The ball is a circle
// on an inextensible string. Ken geometry lives in ken-local space (origin = crossbar centre, up = -y) and is made of
// circles and capsules. Each piece is "one-sided": the ball passes through from the far side (as if swung in front
// of the ken) and collides from the near side, so a ball swung up from below never snags on the cups.

export const R = 36;            // ball radius
export const L = 270;           // string length, anchor to ball centre
export const G = 3200;          // gravity
export const SUB = 4;           // substeps per 1/60 s tick
export const W = 720;
export const H = 1280;
export const WALL_L = 20, WALL_R = 700, CEIL = 170;
export const KEN_BOX = { x0: 135, x1: 585, y0: 420, y1: 800 };
export const HOLE_R = 12;       // hole radius at the mouth; the spike tip is 6 wide

const TAU = Math.PI * 2;
const SEAT_Y = -46;             // ball centre when seated on the spike (ken-local)
const ANCHOR_Y = -5;

// ---- ken geometry (ken-local) ------------------------------------------------------------------
// kind: 0 spike, 1 bar, 2 rim. side: -1 active when the ball is above (local -y), +1 active when below (local +y).
// cup: 0 none, 1 big, 2 small, 3 base. rim: 1 inner rim, 2 outer rim.
const P = (kind, cup, rim, ax, ay, bx, by, r, side, e) => ({ kind, cup, rim, ax, ay, bx, by, r, side, e });
export const OBST = [
  P(0, 0, 0, 0, -5, 0, -62, 6, -1, 0.25),
  P(1, 0, 0, -128, 5, 116, 5, 8, -1, 0.2),
  P(2, 1, 1, -60, -12, -60, -12, 7, -1, 0.16),
  P(2, 1, 2, -120, -12, -120, -12, 7, -1, 0.16),
  P(2, 2, 1, 60, -12, 60, -12, 7, -1, 0.16),
  P(2, 2, 2, 108, -12, 108, -12, 7, -1, 0.16),
  P(2, 3, 1, -28, 196, -28, 196, 7, 1, 0.16),
  P(2, 3, 2, 28, 196, 28, 196, 7, 1, 0.16),
];
// Cup descriptions for drawing, targeting and the AI: centre x (local), rim line y, sit position of the ball.
export const CUPS = {
  big: { id: 1, name: 'Big cup', x: -90, y: -12, w: 60, sit: { x: -90, y: -12 - Math.sqrt(43 * 43 - 30 * 30) }, side: -1 },
  small: { id: 2, name: 'Small cup', x: 84, y: -12, w: 48, sit: { x: 84, y: -12 - Math.sqrt(43 * 43 - 24 * 24) }, side: -1 },
  base: { id: 3, name: 'Base cup', x: 0, y: 196, w: 56, sit: { x: 0, y: 196 + Math.sqrt(43 * 43 - 28 * 28) }, side: 1 },
};
export const CUP_BY_ID = [null, 'big', 'small', 'base'];
export const SPIKE = { baseY: -5, tipY: -62, seatY: SEAT_Y };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapAng = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

export function createWorld() {
  const w = {
    tick: 0,
    assist: 1,                       // 0 off, 1 light, 2 strong
    ken: { x: 360, y: 560, vx: 0, vy: 0, ax: 0, ay: 0, tx: 360, ty: 560, axf: 0, ayf: 0, tilt: 0, tv: 0, flip: 0, fv: 0, flipT: 0, th: 0, om: 0 },
    ball: { x: 360, y: 560 + ANCHOR_Y + L, vx: 0, vy: 0, a: -Math.PI / 2, wv: 0, mode: 0, sp: 0, lx: 0, ly: 0, cd: 0, cm: 0, on: 0, onT: 0, taut: 0, vrel: 0, still: 0, rest: 0 },
  };
  return w;
}

export function cloneWorld(w) {
  return { tick: w.tick, assist: w.assist, ken: { ...w.ken }, ball: { ...w.ball } };
}

// ---- helpers: ken pose -> world ---------------------------------------------------------------
export function kenPoint(k, lx, ly, out = {}) {
  const c = Math.cos(k.th), s = Math.sin(k.th);
  out.x = k.x + lx * c - ly * s;
  out.y = k.y + lx * s + ly * c;
  return out;
}
export const anchorOf = (k, out) => kenPoint(k, 0, ANCHOR_Y, out);
export const isFlipped = (k) => Math.cos(k.flip) < 0;
export const hangY = (k) => k.y + (isFlipped(k) ? -ANCHOR_Y : ANCHOR_Y) + L;

// Place the ball hanging straight below the anchor, at rest.
export function settleHanging(w) {
  const a = anchorOf(w.ken, {});
  const b = w.ball;
  b.mode = 0; b.sp = 0; b.x = a.x; b.y = a.y + L; b.vx = 0; b.vy = 0; b.a = -Math.PI / 2; b.wv = 0; b.cd = 0; b.on = 0; b.onT = 0; b.cm = 0; b.still = 0; b.rest = 0;
}

export function setHand(w, tx, ty) {
  w.ken.tx = clamp(tx, KEN_BOX.x0, KEN_BOX.x1);
  w.ken.ty = clamp(ty, KEN_BOX.y0, KEN_BOX.y1);
}
export function toggleFlip(w) { w.ken.flipT = w.ken.flipT === 0 ? Math.PI : 0; }
export function setFlip(w, on) { w.ken.flipT = on ? Math.PI : 0; }

// ---- stepping ----------------------------------------------------------------------------------
// Events are flat records of 4 numbers: [type, value, a, b]. 1 rim hit (speed, cup, kind), 2 spike let go, 3 string snap,
// 4 wall hit, 5 spike catch. The array is reused: read it before stepping again.
export const EVENT_STRIDE = 4;
const EVT = [];
const tmp = { x: 0, y: 0 };
const KEN_K = 9000, KEN_C = 190, KEN_VMAX = 4600, KEN_AMAX = 90000;
const TILT_K = 600, TILT_C = 40, FLIP_K = 320, FLIP_C = 36;

function stepKen(k, h) {
  const ox = k.vx, oy = k.vy;
  let ax = KEN_K * (k.tx - k.x) - KEN_C * k.vx;
  let ay = KEN_K * (k.ty - k.y) - KEN_C * k.vy;
  const am = Math.hypot(ax, ay);
  if (am > KEN_AMAX) { ax *= KEN_AMAX / am; ay *= KEN_AMAX / am; }
  k.vx += ax * h; k.vy += ay * h;
  const sp = Math.hypot(k.vx, k.vy);
  if (sp > KEN_VMAX) { k.vx *= KEN_VMAX / sp; k.vy *= KEN_VMAX / sp; }
  k.x += k.vx * h; k.y += k.vy * h;
  k.ax = (k.vx - ox) / h; k.ay = (k.vy - oy) / h;
  k.axf += (k.ax - k.axf) * Math.min(1, h * 28);
  k.ayf += (k.ay - k.ayf) * Math.min(1, h * 28);
  const tt = clamp(-k.axf * 0.00005, -0.28, 0.28);
  k.tv += (TILT_K * (tt - k.tilt) - TILT_C * k.tv) * h;
  k.tilt += k.tv * h;
  k.fv += (FLIP_K * (k.flipT - k.flip) - FLIP_C * k.fv) * h;
  k.flip += k.fv * h;
  const th = k.tilt + k.flip;
  k.om = (th - k.th) / h;
  k.th = th;
}

function stringPull(b, ax, ay, avx, avy) {
  const dx = b.x - ax, dy = b.y - ay;
  const d = Math.hypot(dx, dy);
  if (d <= L) { b.taut = d > L - 1.5 ? 1 : 0; return 0; }
  const nx = dx / d, ny = dy / d;
  b.x = ax + nx * L; b.y = ay + ny * L;
  const rvn = (b.vx - avx) * nx + (b.vy - avy) * ny;
  b.taut = 1;
  if (rvn > 0) { b.vx -= (1 + 0.02) * rvn * nx; b.vy -= (1 + 0.02) * rvn * ny; return rvn; }
  return 0;
}

// One substep of the ball.
function stepBall(w, h, c, s, ev) {
  const k = w.ken, b = w.ball;
  const surfVx = (px, py) => k.vx - k.om * (py - k.y);
  const surfVy = (px, py) => k.vy + k.om * (px - k.x);
  if (b.cd > 0) b.cd -= h;

  if (b.mode === 1) {
    // seated on the spike: the ball rides the ken
    b.sp = Math.min(1, b.sp + h / 0.1);
    const e = b.sp * b.sp * (3 - 2 * b.sp);
    const lx = b.lx + (0 - b.lx) * e, ly = b.ly + (SEAT_Y - b.ly) * e;
    b.x = k.x + lx * c - ly * s; b.y = k.y + lx * s + ly * c;
    b.vx = surfVx(b.x, b.y); b.vy = surfVy(b.x, b.y);
    // unseat when the hand yanks hard along the spike or shakes sideways, or the ken is tipped over
    const dxk = s, dyk = -c;                               // spike axis (base -> tip) in world
    const ex = -k.axf, ey = G - k.ayf;                       // effective gravity in the ken's frame
    const along = ex * dxk + ey * dyk;
    const lat = ex * (-dyk) + ey * dxk;
    if (b.sp >= 1 && (along > 0.42 * G || Math.abs(lat) > 2.2 * G)) {
      b.mode = 0; b.cd = 0.35; b.sp = 0;
      b.x += dxk * 10; b.y += dyk * 10;
      ev.push(2, 0, 0, 0);
    }
    b.a = Math.atan2(-dyk, -dxk);                        // the hole faces down the spike, toward the ken
    b.cm = 0; b.on = 4;
    return;
  }

  // free flight
  b.vy += G * h;
  const damp = 1 - 0.28 * h;
  b.vx *= damp; b.vy *= damp;
  b.x += b.vx * h; b.y += b.vy * h;
  anchorOf(k, tmp);
  const ax = tmp.x, ay = tmp.y;
  const avx = surfVx(ax, ay), avy = surfVy(ax, ay);
  const snap = stringPull(b, ax, ay, avx, avy);
  if (snap > 420) ev.push(3, snap, 0, 0);

  // walls and ceiling
  if (b.x < WALL_L + R) { b.x = WALL_L + R; if (b.vx < 0) { if (-b.vx > 300) ev.push(4, -b.vx, 0, 0); b.vx = -b.vx * 0.35; } }
  else if (b.x > WALL_R - R) { b.x = WALL_R - R; if (b.vx > 0) { if (b.vx > 300) ev.push(4, b.vx, 0, 0); b.vx = -b.vx * 0.35; } }
  if (b.y < CEIL + R) { b.y = CEIL + R; if (b.vy < 0) b.vy = -b.vy * 0.3; }

  // collisions with the ken
  let cm = 0, seat = 0;
  let vrelMin = 1e9;
  for (let it = 0; it < 2; it++) {
    for (let i = 0; i < OBST.length; i++) {
      const o = OBST[i];
      // endpoints in world
      const p0x = k.x + o.ax * c - o.ay * s, p0y = k.y + o.ax * s + o.ay * c;
      let qx = p0x, qy = p0y;
      if (o.ax !== o.bx || o.ay !== o.by) {
        const p1x = k.x + o.bx * c - o.by * s, p1y = k.y + o.bx * s + o.by * c;
        const ex = p1x - p0x, ey = p1y - p0y;
        const t = clamp(((b.x - p0x) * ex + (b.y - p0y) * ey) / (ex * ex + ey * ey), 0, 1);
        qx = p0x + ex * t; qy = p0y + ey * t;
      }
      let dx = b.x - qx, dy = b.y - qy;
      let d = Math.hypot(dx, dy);
      const rr = R + o.r;
      if (d >= rr) continue;
      if (d < 1e-6) { dx = 0; dy = -1; d = 1e-6; }
      const nx = dx / d, ny = dy / d;
      // one-sided: normal in ken-local space
      const nly = -nx * s + ny * c;                           // local y of the normal (rotate by -th)
      if (o.side < 0 ? nly > 0.25 : nly < -0.25) continue;
      // a ball moving fast away from the active side passes through (it is swung in front of the ken)
      if (((-(b.vx - k.vx) * s + (b.vy - k.vy) * c) * o.side) > 260) continue;
      // ...and a ball coming up at speed from below goes through whatever is above it
      if (ny > 0.25 && b.vy - k.vy < -450) continue;
      if (o.kind === 0 && b.cd <= 0) {
        // the spike: does the ball's hole take it?
        const tx = k.x + o.bx * c - o.by * s, ty = k.y + o.bx * s + o.by * c;
        const hx = Math.cos(b.a), hy = Math.sin(b.a);
        const sdx = s, sdy = -c;                               // axis base -> tip
        const cosphi = -(hx * sdx + hy * sdy);
        const perp = Math.abs((tx - b.x) * hy - (ty - b.y) * hx);
        const tol = HOLE_R - 6 + 4 + w.assist * 5;
        const along = (tx - b.x) * hx + (ty - b.y) * hy;
        if (cosphi >= 0.78 && perp <= tol && along > R * 0.4) { seat = 1; break; }
      }
      // resolve
      b.x += nx * (rr - d); b.y += ny * (rr - d);
      const sx = surfVx(qx, qy), sy = surfVy(qx, qy);
      let rvx = b.vx - sx, rvy = b.vy - sy;
      const vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        const e = -vn < 500 ? 0 : o.e;
        if (-vn > 180 && it === 0) ev.push(1, -vn, o.cup, o.kind);
        b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
      }
      rvx = b.vx - sx; rvy = b.vy - sy;
      const f = Math.max(0, 1 - 12 * h);                      // rolling friction against the surface
      b.vx = sx + rvx * f; b.vy = sy + rvy * f;
      if (o.cup) cm |= 1 << ((o.cup - 1) * 2 + (o.rim - 1));
      const vr = Math.hypot(rvx, rvy);
      if (vr < vrelMin) vrelMin = vr;
    }
    if (seat) break;
  }
  if (seat) {
    // capture: remember where the ball is in ken space and slide it down onto the spike
    const dxp = b.x - k.x, dyp = b.y - k.y;
    b.lx = dxp * c + dyp * s; b.ly = -dxp * s + dyp * c;
    b.mode = 1; b.sp = 0; b.cm = 0; b.on = 4; b.vx = 0; b.vy = 0;
    ev.push(5, 0, 0, 0);
    return;
  }
  stringPull(b, ax, ay, avx, avy);
  b.cm = cm;
  b.vrel = vrelMin;

  // assist: a gentle pull of a falling ball toward the cup it is above
  if (w.assist > 0 && b.vy * (isFlipped(k) ? -1 : 1) > -200) {
    const g = (w.assist === 1 ? 6 : 14);
    for (const key of ['big', 'small', 'base']) {
      const cu = CUPS[key];
      kenPoint(k, cu.sit.x, cu.sit.y, tmp);
      const ddx = tmp.x - b.x, ddy = tmp.y - b.y;
      const up = cu.side * (isFlipped(k) ? -1 : 1) < 0;   // the cup faces up in the world
      if (up && Math.abs(ddx) < 60 && ddy > -10 && ddy < 90) b.vx += clamp(g * ddx, -700, 700) * h;
    }
  }

  // the hole turns toward the string
  const ddx = ax - b.x, ddy = ay - b.y;
  const want = Math.atan2(ddy, ddx);
  const dlt = wrapAng(want - b.a);
  b.wv += (260 * dlt - 24 * b.wv) * h;
  b.a += b.wv * h;
}

export function stepWorld(w, dt = 1 / 60) {
  const ev = EVT; ev.length = 0;
  const h = dt / SUB;
  const k = w.ken, b = w.ball;
  let lastCm = 0;
  for (let i = 0; i < SUB; i++) {
    stepKen(k, h);
    const c = Math.cos(k.th), s = Math.sin(k.th);
    stepBall(w, h, c, s, ev);
    lastCm = b.cm;
  }
  w.tick++;
  // what is the ball resting in?
  let on = 0;
  if (b.mode === 1 && b.sp >= 1) on = 4;
  else if (b.mode === 0) {
    const both = (cup) => ((lastCm >> ((cup - 1) * 2)) & 3) === 3;
    for (let cup = 1; cup <= 3; cup++) if (both(cup) && b.vrel < 170) { on = cup; break; }
  }
  if (on === b.on && on !== 0) b.onT += dt; else { b.on = on; b.onT = on ? dt : 0; }
  // hanging still: below the anchor, near vertical and slow
  const a = anchorOf(k, tmp);
  const dxa = b.x - a.x, dya = b.y - a.y;
  const speed = Math.hypot(b.vx - k.vx, b.vy - k.vy);
  const hang = b.mode === 0 && b.on === 0 && dya > L * 0.85 && Math.abs(dxa) < L * 0.42 && speed < 230;
  b.still = hang ? b.still + dt : 0;
  // lying on the ken somewhere that is not a catch (the bar, a rim and the spike) and not moving
  b.rest = b.mode === 0 && b.on === 0 && b.vrel < 1e8 && speed < 45 ? b.rest + dt : 0;
  return ev;
}

// Spike tip and the cup sit positions in world space (for drawing hints and for the AI).
export function targetPoint(k, key) {
  if (key === 'spike') return kenPoint(k, 0, SEAT_Y, {});
  const cu = CUPS[key];
  return kenPoint(k, cu.sit.x, cu.sit.y, {});
}

// The green: every bowl, the jack and the rink they roll on. Pure and deterministic (fixed step, no clock, no randomness here).
//
// Units are metres and seconds of SIM time. The rink runs along +y from the mat's front edge (y = 0) to the ditch; x is across it
// (0 = centre line, + = the bowler's right). The game plays the sim at 3x real time (see SPEED), so a 25 m bowl takes about six
// seconds on screen.
//
// A bowl is biased: its heading turns toward its bias side at a rate that GROWS as it slows (dtheta/dt = bias * K / (v + V0)), which is
// why a real bowl runs nearly straight, then bends in at the end. Friction is a constant deceleration. A green may also lean (a
// constant sideways pull). Collisions are circle against circle with a mass ratio, so a bowl moves a jack far more than a bowl.

export const H = 1 / 120;            // sim step, seconds
export const SPEED = 3;              // sim seconds per real second
export const STEPS_PER_TICK = Math.round((SPEED / 60) / H);   // = 6 sim steps per 1/60 s tick
export const RINK = { half: 2.3, ditch: 34.0, bank: 34.55, back: -2.2, minJack: 23, maxJack: 32.6, centreSpot: 25 };
export const R_BOWL = 0.082, R_JACK = 0.045, M_BOWL = 1, M_JACK = 0.25;
const V0 = 0.45, VSTOP = 0.02;

// weights: how fast the bowl should be going when it reaches the target ring
export const WEIGHTS = [
  { id: 'draw', name: 'Draw', sub: 'dies at the ring', arrive: 0 },
  { id: 'firm', name: 'Firm', sub: 'arrives with pace', arrive: 0.8 },
  { id: 'drive', name: 'Drive', sub: 'fires it hard', arrive: 3.2 },
];

export const GREENS = {
  village: { id: 'village', name: 'Village green', sub: 'Medium pace, true and friendly', a: 0.17, K: 0.026, slope: 0 },
  tourney: { id: 'tourney', name: 'Tournament green', sub: 'Fast: runs on and bends a lot', a: 0.128, K: 0.030, slope: 0 },
  seaside: { id: 'seaside', name: 'Seaside green', sub: 'A cross-slope pulls everything one way', a: 0.16, K: 0.026, slope: 0.0065 },
  heavy: { id: 'heavy', name: 'Heavy green', sub: 'Damp and slow: needs more weight', a: 0.225, K: 0.022, slope: 0 },
  daily: { id: 'daily', name: 'Daily green', sub: 'A new mix of pace and lean every day', a: 0.17, K: 0.026, slope: 0 },
};
export const GREEN_IDS = ['village', 'tourney', 'seaside', 'heavy', 'daily'];
export const greenName = (id) => (GREENS[id] ?? GREENS.village).name;

// A concrete green for a match. `rnd` (a seeded rng) decides the lean's side and the daily mix.
export function makeGreen(id, rnd) {
  const base = GREENS[id] ?? GREENS.village;
  const g = { id: base.id, name: base.name, a: base.a, K: base.K, slope: base.slope };
  if (id === 'seaside') g.slope = (rnd.next() < 0.5 ? -1 : 1) * base.slope;
  if (id === 'daily') {
    g.a = 0.13 + rnd.next() * 0.095;
    g.K = 0.021 + rnd.next() * 0.01;
    g.slope = rnd.next() < 0.4 ? 0 : (rnd.next() - 0.5) * 0.0125;
  }
  return g;
}
// "pace" in the traditional style: seconds a bowl takes to run 30 m, for the green's info card
export const paceSeconds = (g) => Math.round(Math.sqrt(2 * 30 / g.a) * 1.05 * 10) / 10;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- balls and the world -------------------------------------------------------------------------------------
export function newBowl(id, team, bias) {
  return { id, team, k: false, r: R_BOWL, m: M_BOWL, x: 0, y: 0, vx: 0, vy: 0, bias, out: false, ditch: false, toucher: false, run: false, fade: 0, rot: 0 };
}
export function newJack(id = 0) {
  return { id, team: -1, k: true, r: R_JACK, m: M_JACK, x: 0, y: 0, vx: 0, vy: 0, bias: 0, out: false, ditch: false, toucher: false, run: false, fade: 0, rot: 0 };
}
export const createWorld = (green) => ({ green, balls: [], settled: true, t: 0 });
export function cloneWorld(w) {
  return { green: w.green, settled: w.settled, t: w.t, balls: w.balls.map((b) => ({ ...b })) };
}
export const theJack = (w) => w.balls.find((b) => b.k) ?? null;
export const speedOf = (b) => Math.hypot(b.vx, b.vy);

// Sets a ball off from the mat (or from a given point) with an initial speed and heading (radians from straight down the rink).
export function launch(w, b, p) {
  b.x = p.x ?? 0; b.y = p.y ?? 0;
  b.vx = Math.sin(p.theta) * p.v0; b.vy = Math.cos(p.theta) * p.v0;
  b.run = true; b.out = false; b.ditch = false; b.fade = 0;
  if (!w.balls.includes(b)) w.balls.push(b);
  w.settled = false;
}

// ---- motion --------------------------------------------------------------------------------------------------
function moveBall(g, b, h, ev) {
  const v = Math.hypot(b.vx, b.vy);
  if (v <= 0) return;
  if (v < VSTOP) { b.vx = 0; b.vy = 0; return; }
  if (b.bias) {
    const d = (b.bias * g.K / (v + V0)) * h, c = Math.cos(d), s = Math.sin(d);
    const vx = b.vx * c + b.vy * s, vy = -b.vx * s + b.vy * c;
    b.vx = vx; b.vy = vy;
  }
  if (!b.out) b.vx += g.slope * h;
  const v1 = Math.hypot(b.vx, b.vy);
  let a = g.a * (b.k ? 1.2 : 1);
  if (b.ditch) a *= 9; else if (b.out) a *= 4;
  const nv = Math.max(0, v1 - a * h);
  const f = v1 > 0 ? nv / v1 : 0;
  b.vx *= f; b.vy *= f;
  b.x += b.vx * h; b.y += b.vy * h;
  if (!b.out && Math.abs(b.x) > RINK.half + (b.k ? 0.0 : 0.0)) {
    b.out = true;
    ev.push({ t: 'out', id: b.id, k: b.k, x: b.x, y: b.y });
  }
  if (!b.ditch && b.y + b.r > RINK.ditch) {
    b.ditch = true;
    ev.push({ t: 'ditch', id: b.id, k: b.k, x: b.x, y: b.y, v: v1 });
    b.vx *= 0.35; b.vy *= 0.35;
  }
  if (b.y > RINK.bank - b.r) { b.y = RINK.bank - b.r; if (b.vy > 0) b.vy = 0; }
  if (b.y < RINK.back) { b.out = true; b.vx = 0; b.vy = 0; }
}

function collide(a, b, ev) {
  if (a.out || b.out) return;
  const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr || d2 === 0) return;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
  // pull apart in proportion to the other ball's mass
  const over = rr - d, ia = 1 / a.m, ib = 1 / b.m, tot = ia + ib;
  a.x -= nx * over * (ia / tot); a.y -= ny * over * (ia / tot);
  b.x += nx * over * (ib / tot); b.y += ny * over * (ib / tot);
  const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (vn <= 0) return;
  const e = a.k || b.k ? 0.5 : 0.62;
  const j = ((1 + e) * vn) / tot;
  a.vx -= (j * ia) * nx; a.vy -= (j * ia) * ny;
  b.vx += (j * ib) * nx; b.vy += (j * ib) * ny;
  // the touch counts for the bowl on its own run only
  if (a.k && b.run) b.toucher = true;
  if (b.k && a.run) a.toucher = true;
  ev.push({ t: 'hit', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: vn, a: a.id, b: b.id, jack: a.k || b.k });
}

// Advances the world by `n` fixed steps. Returns the events that happened (hits, ditch drops, balls leaving the rink).
export function stepWorld(w, n = 1, ev = []) {
  const g = w.green, bs = w.balls;
  for (let s = 0; s < n; s++) {
    if (w.settled) break;
    let vmax = 0, moving = false;
    for (const b of bs) { const v = b.vx * b.vx + b.vy * b.vy; if (v > 0) moving = true; if (v > vmax) vmax = v; }
    if (!moving) { w.settled = true; break; }
    vmax = Math.sqrt(vmax);
    const sub = vmax * H > 0.045 ? Math.ceil((vmax * H) / 0.045) : 1, h = H / sub;
    for (let q = 0; q < sub; q++) {
      for (const b of bs) moveBall(g, b, h, ev);
      for (let i = 0; i < bs.length; i++) {
        const a = bs[i];
        for (let j = i + 1; j < bs.length; j++) {
          const c = bs[j];
          if ((a.vx === 0 && a.vy === 0 && c.vx === 0 && c.vy === 0)) continue;
          collide(a, c, ev);
        }
      }
    }
    w.t += H;
  }
  return ev;
}
export function settle(w, maxSteps = 6000) {
  const ev = [];
  let n = 0;
  while (!w.settled && n < maxSteps) { stepWorld(w, 20, ev); n += 20; }
  for (const b of w.balls) b.run = false;
  return ev;
}

// ---- a lone bowl: the path the solver and the guide line use --------------------------------------------------
// Runs one biased ball with nothing else on the green. Stops at rest, or (when `stopY` is given) the moment it reaches that y.
const SOLO = newBowl(-9, 0, 1);
export function soloRun(g, bias, theta, v0, opts = {}) {
  const b = SOLO;
  b.bias = bias; b.x = opts.x0 ?? 0; b.y = opts.y0 ?? 0; b.vx = Math.sin(theta) * v0; b.vy = Math.cos(theta) * v0; b.out = false; b.ditch = false; b.k = !!opts.jack;
  b.r = opts.jack ? R_JACK : R_BOWL;
  const path = opts.path ? [b.x, b.y] : null, every = opts.every ?? 6, ev = [];
  const stopY = opts.stopY ?? 1e9;
  let n = 0, reached = false, vAt = 0, xAt = 0, yAt = 0, tAt = 0;
  while (n < 9000) {
    if (b.vx === 0 && b.vy === 0) break;
    moveBall(g, b, H, ev);
    n++;
    if (path && n % every === 0) path.push(b.x, b.y);
    if (b.y >= stopY && !reached) { reached = true; vAt = Math.hypot(b.vx, b.vy); xAt = b.x; yAt = b.y; tAt = n * H; if (opts.stopAtY) break; }
    if (b.out && b.ditch) break;
    if (b.ditch) break;
  }
  if (path) path.push(b.x, b.y);
  return { x: b.x, y: b.y, out: b.out, ditch: b.ditch, reached, vAt, xAt, yAt, tAt, steps: n, path };
}

// Which launch (heading, speed) makes a biased bowl finish at (tx, ty), or pass through it with the given arrival speed?
export function solveShot(g, bias, arrive, tx, ty, guess) {
  const d = Math.hypot(tx, ty) || 1;
  let v0 = Math.sqrt(arrive * arrive + 2 * g.a * d) * 1.02;
  let th = Math.atan2(tx, ty) - bias * 0.12;
  if (guess) { v0 = guess.v0; th = guess.theta; }
  let err = 9;
  for (let it = 0; it < 16; it++) {
    if (arrive <= 0) {
      const r = soloRun(g, bias, th, v0);
      const ex = tx - r.x, ey = ty - r.y;
      err = Math.hypot(ex, ey);
      if (err < 0.01) break;
      const dr = Math.hypot(r.x, r.y) || 0.5;
      v0 *= Math.sqrt(clamp(d / dr, 0.5, 2));
      th += (ex / Math.max(1.5, r.y)) * 0.9;
    } else {
      const r = soloRun(g, bias, th, v0, { stopY: ty, stopAtY: true });
      if (r.reached) {
        const ex = tx - r.xAt;
        err = Math.abs(ex) + Math.abs(r.vAt - arrive) * 0.3;
        if (Math.abs(ex) < 0.012 && Math.abs(r.vAt - arrive) < 0.06) break;
        th += (ex / Math.max(1.5, ty)) * 0.9;
        v0 = Math.sqrt(Math.max(arrive * arrive + 0.4, v0 * v0 + (arrive * arrive - r.vAt * r.vAt)));
      } else {
        const sh = ty - r.y;
        v0 = Math.sqrt(v0 * v0 + 2 * g.a * (sh + 0.5) + arrive * arrive * 0.5);
        err = 9;
      }
    }
    th = clamp(th, -0.62, 0.62); v0 = clamp(v0, 0.4, 16);
  }
  return { theta: th, v0, err };
}

// The jack: runs straight (no bias) to a length.
export function jackShot(g, length) {
  const v0 = Math.sqrt(2 * g.a * 1.2 * length);
  return { theta: 0, v0 };
}

// What a shot would really do among the bowls already there: a full run on a copy of the world. Returns the path of the new bowl,
// where it rests, which other balls it moved, and what happened (toucher, ditch, out).
export function previewShot(w, params, bias, team, opts = {}) {
  const c = cloneWorld(w);
  for (const b of c.balls) { b.vx = 0; b.vy = 0; b.run = false; }
  const b = newBowl(900, team, bias);
  launch(c, b, params);
  const path = [0, 0], every = opts.every ?? 5;
  const ev = [];
  let n = 0;
  while (!c.settled && n < 8000) {
    stepWorld(c, 1, ev); n++;
    if (n % every === 0) path.push(b.x, b.y);
  }
  path.push(b.x, b.y);
  const moved = [];
  for (const o of c.balls) {
    if (o === b) continue;
    const o0 = w.balls.find((q) => q.id === o.id);
    if (o0 && (Math.abs(o0.x - o.x) > 0.004 || Math.abs(o0.y - o.y) > 0.004)) moved.push({ id: o.id, k: o.k, team: o.team, x: o.x, y: o.y, x0: o0.x, y0: o0.y, out: o.out, ditch: o.ditch });
  }
  return { path, rest: { x: b.x, y: b.y }, out: b.out, ditch: b.ditch, toucher: b.toucher, moved, hits: ev.filter((e) => e.t === 'hit').length, world: opts.keepWorld ? c : null, bowl: b };
}

// Which balls count? bowls on the green; a bowl in the ditch only as a toucher; nothing that left the rink.
export function liveBowls(w) {
  return w.balls.filter((b) => !b.k && !b.out && (!b.ditch || b.toucher));
}
export function ranking(w) {
  const j = theJack(w);
  if (!j) return [];
  return liveBowls(w).map((b) => ({ b, d: Math.hypot(b.x - j.x, b.y - j.y) })).sort((p, q) => p.d - q.d);
}
// shots for the end as it lies: { team, pts, tie }
export function countEnd(w) {
  const rk = ranking(w);
  if (!rk.length) return { team: -1, pts: 0, tie: false, none: true };
  const t = rk[0].b.team;
  const other = rk.find((r) => r.b.team !== t);
  if (other && Math.abs(other.d - rk[0].d) < 0.0005) return { team: -1, pts: 0, tie: true };
  let pts = 0;
  for (const r of rk) { if (r.b.team !== t) break; if (!other || r.d < other.d - 0.0005) pts++; }
  return { team: t, pts, tie: false };
}

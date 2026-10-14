// Lapta engine: pure, seeded and deterministic (no clock, no DOM). One TURN = one batter: serve -> swing -> ball in play -> run -> result.
// Coordinates are metres: x across the green (left negative), y from the home line (0) toward the far line (K.D). z is height.
// A turn is plain JSON, so the AI, the Think hint and the rival innings all plan on copies (clone + reseed) of the same engine the player uses.

export const K = {
  W: 17,                 // half width of the playing green
  D: 22,                 // distance from the home line to the far line
  HOME_Y: 0.8,           // batter stands here
  THROW_Y: 5.2,          // the server stands here (a team-mate, not an opponent)
  FENCE_X: 20, FENCE_Y: 30, BACK_Y: -8,
  G: 9.8,
  WIN: 0.17,             // swing window either side of contact, seconds
  RUN_V: 6.6, ACCEL: 20,
  DODGE_V: 13.5, DODGE_T: 0.115, DODGE_CD: 1.05, DODGE_SLOW: 0.5, X_LIM: 15,
  HIT_R: 0.72,           // how close a thrown ball must pass to the runner to tag
  AIM_MAX: 50,           // degrees either side of straight
  TURNS: 8, OUTS: 3,
  PTS: { far: 1, home: 2 },
  STARS: [3, 7, 12, 17, 21],   // innings totals for 1..5 stars
  CATCH_Z: [0.25, 2.2], CATCH_R: 0.95, PICK_R: 0.95,
  FIELDERS: 6,
};

export const LEVELS = [
  { name: 'Village green', note: 'Friendly fielders, slow throws', speed: 5.0, react: 0.45, throwV: 12.5, sigma: 0.05, windup: 0.55, catchP: 0.42, wind: 0.35, spread: 1.0 },
  { name: 'Town side', note: 'Quick feet, tidy throws', speed: 5.6, react: 0.30, throwV: 15, sigma: 0.04, windup: 0.4, catchP: 0.55, wind: 0.2, spread: 0.92 },
  { name: 'Champions', note: 'Fast, accurate, hard to beat', speed: 5.9, react: 0.22, throwV: 17, sigma: 0.034, windup: 0.32, catchP: 0.6, wind: 0.12, spread: 0.88 },
];

// Computer batters: sig = standard deviation of the swing timing in seconds, aimN = aim noise in degrees, plan = rollouts per candidate.
export const RIVALS = [
  { name: 'Apprentice', note: 'Swings a little early or late', react: 0.34, sig: 0.085, aimN: 9, plan: 1, think: [2, 4], margin: 0.5 },
  { name: 'Veteran', note: 'Steady timing, sensible runs', react: 0.27, sig: 0.055, aimN: 5, plan: 2, think: [2, 4], margin: 0.25 },
  { name: 'Champion', note: 'Picks the gap and the moment', react: 0.2, sig: 0.032, aimN: 2.5, plan: 3, think: [2, 4], margin: 0.1 },
];

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const DEG = Math.PI / 180;
const rnd = (T) => { T.rs = (T.rs + 0x6D2B79F5) | 0; let t = Math.imul(T.rs ^ (T.rs >>> 15), 1 | T.rs); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gauss = (T) => Math.sqrt(-2 * Math.log(rnd(T) + 1e-9)) * Math.cos(6.2831853 * rnd(T));
export const cloneTurn = (T) => JSON.parse(JSON.stringify(T));

// ---- a new turn ---------------------------------------------------------------------------------------------------------------------
// Fielder home spots: three close, two flank, two deep. Jittered each turn so no two turns are alike.
const SPOTS = [[-6.5, 9], [6.5, 9.5], [0, 14], [-12, 16.5], [12, 16], [-4, 21]];

export function newTurn(seed, idx, lv) {
  const L = LEVELS[lv], T = { rs: (seed * 2654435761 + idx * 40503 + 12345) | 0, idx, lv };
  for (let i = 0; i < 4; i++) rnd(T);
  T.tossT = 1.15 + rnd(T) * 0.3;
  T.ph = 'serve'; T.t = 0; T.aim = 0; T.swing = null; T.res = null; T.pts = 0; T.endAt = -1; T.ev = [];
  T.ball = { x: 0, y: K.THROW_Y, z: 1.3, vx: 0, vy: 0, vz: 0, st: 'toss', by: -1, bounced: false };
  T.runner = { st: 'ready', x: 0, y: K.HOME_Y, vx: 0, vy: 0, dT: 0, cd: 0, dir: 0 };
  T.fielders = SPOTS.map((s, i) => {
    const hx = clamp(s[0] * L.spread + (rnd(T) - 0.5) * 3.6, -K.W + 1.5, K.W - 1.5), hy = s[1] * (0.96 + (L.spread < 1 ? 0.04 : 0)) + (rnd(T) - 0.5) * 3;
    return { i, x: hx, y: hy, hx, hy, st: 'idle', tx: hx, ty: hy, wind: 0, tried: false, face: 0, ph: rnd(T) * 6 };
  });
  T.pred = []; T.predAt = -1; T.dead = false; T.holder = -1; T.carry = 0;
  return T;
}

// ---- the serve and the hit --------------------------------------------------------------------------------------------------------------
// The ball path of the serve: a high toss from the server over the batter's bat zone, reaching bat height at tossT.
export function tossAt(T, t) {
  const f = clamp(t / T.tossT, 0, 1.6), z0 = 1.3, zT = 1.0;
  const vz = (zT - z0 + 0.5 * K.G * T.tossT * T.tossT) / T.tossT;
  return { x: 0, y: K.THROW_Y + (K.HOME_Y + 0.15 - K.THROW_Y) * f, z: Math.max(0, z0 + vz * t - 0.5 * K.G * t * t) };
}

// Quality of a swing d seconds off contact (negative = early): 1 is perfect, 0 the edge of the window.
export const quality = (d) => 1 - Math.pow(Math.min(1, Math.abs(d) / K.WIN), 1.6);

function launch(T, d, aimDeg) {
  const q = quality(d), b = T.ball, e = d / K.WIN;           // e < 0 early, > 0 late
  const speed = 8 + 14 * q;
  const elev = Math.max(1.5, 11 - e * 13) * DEG;                        // early swings loft the ball, late ones flatten it
  const dir = (aimDeg + e * 13) * DEG;                     // early pulls left, late pushes right
  const vh = speed * Math.cos(elev);
  Object.assign(b, { vx: vh * Math.sin(dir), vy: vh * Math.cos(dir), vz: speed * Math.sin(elev), st: 'air', by: -1, bounced: false });
  T.hit = { q, d, speed, dirDeg: dir / DEG, elevDeg: elev / DEG };
}

// ---- ball physics (shared by the live ball and the fielders' prediction) ---------------------------------------------------------
function stepBall(b, dt) {
  if (b.st === 'air' || b.st === 'roll') {
    b.vz -= K.G * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.z <= 0) {
      b.z = 0;
      if (b.vz < -1.4) { b.vz = -b.vz * 0.5; b.vx *= 0.8; b.vy *= 0.8; b.bounced = true; b.st = 'air'; }
      else { b.vz = 0; b.st = 'roll'; b.bounced = true; }
    }
    if (b.st === 'roll') {
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 0) { const ns = Math.max(0, sp - 2.6 * dt); b.vx *= ns / sp; b.vy *= ns / sp; }
    }
  } else if (b.st === 'thrown') {
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.z <= 0.05 || b.life <= 0) { b.z = 0; b.st = 'air'; b.vz = 0; b.vx *= 0.55; b.vy *= 0.55; b.bounced = true; }
    b.life -= dt;
  }
  // the fence around the green
  if (b.x > K.FENCE_X) { b.x = K.FENCE_X; b.vx = -Math.abs(b.vx) * 0.4; }
  if (b.x < -K.FENCE_X) { b.x = -K.FENCE_X; b.vx = Math.abs(b.vx) * 0.4; }
  if (b.y > K.FENCE_Y) { b.y = K.FENCE_Y; b.vy = -Math.abs(b.vy) * 0.4; }
  if (b.y < K.BACK_Y) { b.y = K.BACK_Y; b.vy = Math.abs(b.vy) * 0.4; }
}

// Where the ball will be every 0.1 s for the next few seconds if nobody touches it.
function predictBall(b) {
  const c = { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, st: b.st === 'held' || b.st === 'toss' ? 'roll' : b.st, bounced: b.bounced, life: b.life || 0 };
  const out = [{ t: 0, x: c.x, y: c.y, z: c.z, air: c.z > 0.05 }];
  for (let k = 1; k <= 45; k++) {
    for (let s = 0; s < 3; s++) stepBall(c, 0.1 / 3);
    out.push({ t: k * 0.1, x: c.x, y: c.y, z: c.z, air: c.z > 0.05 });
  }
  return out;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const exposed = (r) => (r.st === 'toFar' || r.st === 'back') && r.y > 1.2 && r.y < K.D - 0.25;

// ---- one step of a turn ---------------------------------------------------------------------------------------------------------------
// inp: { swing, aim, run, dodge } (all optional). Returns nothing; read T.ph / T.res / T.ev.
export function stepTurn(T, dt, inp = {}) {
  if (T.ph === 'done') return;
  T.t += dt;
  const L = LEVELS[T.lv];
  if (T.ph === 'serve') {
    if (typeof inp.aim === 'number') T.aim = clamp(inp.aim, -K.AIM_MAX, K.AIM_MAX);
    const p = tossAt(T, T.t); Object.assign(T.ball, p);
    if (inp.swing && !T.swing) {
      const d = T.t - T.tossT;
      T.swing = { t: T.t, d, hit: Math.abs(d) <= K.WIN };
      if (T.swing.hit) {
        launch(T, d, T.aim); T.ph = 'play'; T.ev.push({ type: 'hit', q: T.hit.q });
        if (Math.abs(d) < 0.03) T.ev.push({ type: 'sweet' });
      } else T.ev.push({ type: 'whiff', d });
    }
    if (T.ph === 'serve' && T.t > T.tossT + K.WIN + 0.5) { T.res = { kind: 'miss', pts: 0, out: false }; T.ph = 'done'; T.ev.push({ type: 'miss' }); }
    return;
  }
  // ---- ball in play ---------------------------------------------------------------------------------------------------------------
  const r = T.runner, b = T.ball;
  // runner control
  if (inp.run) {
    if (r.st === 'ready') { r.st = 'toFar'; r.dir = 1; T.ev.push({ type: 'go' }); }
    else if (r.st === 'atFar') { r.st = 'back'; r.dir = -1; T.ev.push({ type: 'return' }); }
  }
  r.cd = Math.max(0, r.cd - dt);
  if (inp.dodge && r.cd <= 0 && (r.st === 'toFar' || r.st === 'back')) {
    r.dT = K.DODGE_T; r.cd = K.DODGE_CD; r.vx = clamp(inp.dodge, -1, 1) * K.DODGE_V; T.ev.push({ type: 'dodge', side: Math.sign(inp.dodge) });
  }
  if (r.st === 'toFar' || r.st === 'back') {
    const slow = r.dT > 0 ? K.DODGE_SLOW : 1;
    r.vy = Math.min(K.RUN_V * slow, Math.abs(r.vy) + K.ACCEL * dt) * r.dir;
    if (r.dT > 0) { r.dT -= dt; if (r.dT <= 0) r.vx = 0; }
    r.x = clamp(r.x + r.vx * dt, -K.X_LIM, K.X_LIM); r.y += r.vy * dt;
    if (r.st === 'toFar' && r.y >= K.D) { r.y = K.D; r.vy = 0; r.vx = 0; r.st = 'atFar'; T.pts += K.PTS.far; T.ev.push({ type: 'far' }); }
    if (r.st === 'back' && r.y <= K.HOME_Y) { r.y = K.HOME_Y; r.vy = 0; r.vx = 0; r.st = 'safe'; T.pts += K.PTS.home; T.ev.push({ type: 'home' }); }
  }
  const prevB = { x: b.x, y: b.y };
  // the ball
  if (b.st === 'held') {
    const f = T.fielders[b.by]; b.x = f.x; b.y = f.y; b.z = 1.1; b.vx = b.vy = b.vz = 0;
  } else stepBall(b, dt);
  // fielders: replan every 0.12 s
  if (T.t - T.predAt > 0.12) { T.predAt = T.t; T.pred = b.st === 'held' ? [] : predictBall(b); assign(T, L); }
  for (const f of T.fielders) moveFielder(T, f, dt, L);
  // catching and picking up
  if (b.st !== 'held' && b.st !== 'thrown') {
    for (const f of T.fielders) {
      if (T.holder >= 0 && b.st === 'held') break;
      const d = Math.hypot(f.x - b.x, f.y - b.y);
      if (b.z >= K.CATCH_Z[0] && b.z <= K.CATCH_Z[1] && d <= K.CATCH_R && b.st === 'air' && !f.tried) {
        f.tried = true;
        if (rnd(T) < L.catchP) {
          const fly = !b.bounced;
          b.st = 'held'; b.by = f.i; T.holder = f.i; f.wind = L.windup;
          if (fly && (r.st === 'ready' || exposed(r) || r.st === 'toFar')) { T.ev.push({ type: 'catch', out: true, at: { x: f.x, y: f.y } }); out(T, 'caught'); }
          else T.ev.push({ type: 'pick', at: { x: f.x, y: f.y } });
          break;
        } else { T.ev.push({ type: 'drop', at: { x: f.x, y: f.y } }); b.vz = Math.abs(b.vz) * 0.2; b.vx *= 0.5; b.vy *= 0.5; }
      } else if (b.z < 0.7 && d <= K.PICK_R && (b.st === 'roll' || b.bounced)) {
        b.st = 'held'; b.by = f.i; T.holder = f.i; f.wind = L.windup; T.ev.push({ type: 'pick', at: { x: f.x, y: f.y } });
        break;
      }
    }
  }
  // thrown ball against the runner (segment test so a fast throw cannot tunnel through)
  if (b.st === 'thrown' && exposed(r) && b.z < 2.1 && T.ph === 'play') {
    const sx = b.x - prevB.x, sy = b.y - prevB.y, l2 = sx * sx + sy * sy;
    const u = l2 > 1e-9 ? clamp(((r.x - prevB.x) * sx + (r.y - prevB.y) * sy) / l2, 0, 1) : 0;
    const cx = prevB.x + sx * u, cy = prevB.y + sy * u;
    if (Math.hypot(cx - r.x, cy - r.y) < K.HIT_R) { T.ev.push({ type: 'tag', at: { x: r.x, y: r.y } }); b.st = 'air'; b.vx *= 0.2; b.vy *= 0.2; b.vz = 1; out(T, 'tagged'); }
  }
  // the thrower stops the play when the ball is back and the runner is safe on a line
  if (T.ph === 'play' && b.st === 'held' && T.holder >= 0) {
    const h = T.fielders[T.holder];
    if (!exposed(r) && h.st === 'carry' && Math.hypot(h.x - 0, h.y - K.THROW_Y) < 1.3) {
      if (r.st === 'ready') end(T, 'stayed', 0);
      else if (r.st === 'atFar') end(T, 'far', T.pts);
    }
  }
  if (r.st === 'safe' && T.ph === 'play') end(T, 'round', T.pts);
  if (T.ph === 'closing' && T.t >= T.endAt) T.ph = 'done';
  if (T.t > 60 && T.ph === 'play') { end(T, r.st === 'atFar' ? 'far' : 'stayed', T.pts); }
}

function end(T, kind, pts) { if (T.ph === 'done') return; T.res = { kind, pts, out: false }; T.ph = 'done'; T.ev.push({ type: 'end', kind }); }
function out(T, kind) {
  if (T.res) return;
  T.runner.st = 'out'; T.runner.vx = 0; T.runner.vy = 0;
  T.res = { kind, pts: kind === 'tagged' ? T.pts : 0, out: true };
  if (kind === 'caught') T.pts = 0;
  T.endAt = T.t + 1.0;
  T.ev.push({ type: 'out', kind });
  // the result is final now; the clock only lets the picture play out
  T.ph = 'closing';
}

// ---- fielders -----------------------------------------------------------------------------------------------------------------------
// Two chasers per ball (the one who can reach it soonest and a back-up), everybody else holds a shape that leans toward the ball.
function assign(T, L) {
  const b = T.ball;
  for (const f of T.fielders) { f.cost = 1e9; f.px = f.hx; f.py = f.hy; }
  if (b.st === 'held') return;
  const pred = T.pred;
  for (const f of T.fielders) {
    if (T.holder === f.i) continue;
    let best = null;
    for (const p of pred) {
      if (p.air && (p.z > K.CATCH_Z[1] - 0.2 || p.z < K.CATCH_Z[0])) { if (!(p.z < 0.7)) continue; }
      const reach = Math.max(0, Math.hypot(p.x - f.x, p.y - f.y) - 0.5) / L.speed + (f.st === 'idle' ? L.react : 0);
      if (reach <= p.t + 0.05) { best = p; break; }
    }
    if (!best) {
      // cannot arrive in time: run at where the ball ends up
      const last = pred[pred.length - 1];
      f.cost = 50 + Math.hypot(last.x - f.x, last.y - f.y) / L.speed; f.px = last.x; f.py = last.y;
    } else { f.cost = best.t; f.px = best.x; f.py = best.y; }
  }
  const order = T.fielders.filter((f) => T.holder !== f.i).sort((a, c) => a.cost - c.cost);
  order.forEach((f, k) => {
    if (k < 2) f.mode = 'chase';
    else { f.mode = 'hold'; f.px = f.hx + clamp((b.x - f.hx) * 0.18, -2.5, 2.5); f.py = f.hy + clamp((b.y - f.hy) * 0.1, -2, 2); }
  });
}

function moveFielder(T, f, dt, L) {
  const r = T.runner, b = T.ball;
  f.ph += dt * 6;
  let tx = f.px ?? f.hx, ty = f.py ?? f.hy, sp = L.speed * (f.mode === 'hold' ? 0.55 : 1);
  if (T.holder === f.i && b.st === 'held') {
    f.tried = false;
    if (exposed(r)) {
      // wind up and throw at where the runner will be
      const d = Math.hypot(r.x - f.x, r.y - f.y);
      f.st = 'wind'; f.wind -= dt; f.face = Math.atan2(r.x - f.x, r.y - f.y);
      if (d < 1.0) { T.ev.push({ type: 'tag', at: { x: r.x, y: r.y } }); b.st = 'air'; b.vx = b.vy = 0; b.vz = 0.5; out(T, 'tagged'); b.by = -1; T.holder = -1; return; }
      if (f.wind <= 0) {
        const v = L.throwV, tf = Math.max(0.3, d / v);
        const px = clamp(r.x + r.vx * tf + gauss(T) * L.sigma * d, -K.FENCE_X, K.FENCE_X), py = clamp(r.y + r.vy * tf + gauss(T) * L.sigma * d * 0.8, -4, K.FENCE_Y);
        const dd = Math.max(0.5, Math.hypot(px - f.x, py - f.y)), tt = dd / v;
        Object.assign(b, { x: f.x, y: f.y, z: 1.5, vx: (px - f.x) / tt, vy: (py - f.y) / tt, vz: (0.8 - 1.5) / tt, st: 'thrown', by: -1, life: tt + 0.35, bounced: false });
        T.holder = -1; f.st = 'idle'; f.mode = 'hold'; f.tried = false; f.wind = 0;
        T.throwT = T.t; T.ev.push({ type: 'throw', from: { x: f.x, y: f.y }, to: { x: px, y: py }, t: tt });
      }
      return;
    }
    // runner is safe on a line: carry the ball back to the server
    f.st = 'carry'; tx = 0; ty = K.THROW_Y; sp = L.speed * 0.85;
  } else if (f.st === 'wind' || f.st === 'carry') f.st = 'idle';
  const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy);
  if (d > 0.05) {
    const s = Math.min(d, sp * dt);
    f.x += (dx / d) * s; f.y += (dy / d) * s;
    f.face = Math.atan2(dx, dy);
    f.moving = true;
  } else f.moving = false;
  if (f.st === 'idle' && f.mode === 'chase') f.st = 'chase';
  else if (f.st === 'chase' && f.mode !== 'chase') f.st = 'idle';
}

// ---- scoring the innings ---------------------------------------------------------------------------------------------------------------
export const starsFor = (pts) => K.STARS.filter((s) => pts >= s).length;
export const RESULT_NAMES = {
  miss: 'Missed', caught: 'Caught out', stayed: 'Safe at home', far: 'Far line reached', tagged: 'Tagged out', round: 'Round trip!',
};
export function resultOf(T) {
  const x = T.res || { kind: 'miss', pts: 0, out: false };
  return { kind: x.kind, name: RESULT_NAMES[x.kind], pts: x.kind === 'caught' ? 0 : T.pts, out: !!x.out };
}
export const isOver = (T) => T.ph === 'done' || T.ph === 'closing';

// ---- computer batter and hints ----------------------------------------------------------------------------------------------------------
// The default runner policy used inside rollouts and by the computer batters after the first decision.
export function policy(T, react = 0.26) {
  const r = T.runner, b = T.ball, L = LEVELS[T.lv], inp = {};
  if (T.ph !== 'play') return inp;
  if (r.st === 'ready') {
    if (b.st === 'air' && !b.bounced && b.z > 0.5) return inp;
    let nearest = 99;
    for (const f of T.fielders) { const t = Math.max(0, Math.hypot(f.x - b.x, f.y - b.y) - 0.6) / L.speed; if (t < nearest) nearest = t; }
    if (b.st !== 'held' && nearest > 1.7 && b.st !== 'thrown') inp.run = true;
  } else if (r.st === 'atFar') {
    let nearest = 99;
    for (const f of T.fielders) { const t = Math.max(0, Math.hypot(f.x - b.x, f.y - b.y) - 0.6) / L.speed; if (t < nearest) nearest = t; }
    if (T.holder < 0 && b.st !== 'thrown' && nearest > 1.4) inp.run = true;
  }
  // dodge: a thrown ball heading at the runner
  if (exposed(r) && b.st === 'thrown' && r.cd <= 0) {
    const dx = r.x - b.x, dy = r.y - b.y, v = Math.hypot(b.vx, b.vy) || 1;
    const along = (dx * b.vx + dy * b.vy) / v, ahead = along > 0.6;
    const cross = (dx * b.vy - dy * b.vx) / v;     // runner offset from the ball's line, signed
    if (ahead && Math.abs(cross) < K.HIT_R + 0.9 && T.t - (T.throwT ?? -9) >= react) inp.dodge = cross >= 0 ? (r.x < K.X_LIM - 2 ? 1 : -1) : (r.x > -K.X_LIM + 2 ? -1 : 1);
  }
  return inp;
}

// Play a copy of a turn to its end with the default policy, optionally forcing the first decision. Returns the value of the turn.
export function rollout(T0, force = null, seed = 1, maxSecs = 30, react = 0.26) {
  const T = cloneTurn(T0);
  T.rs = (T.rs ^ (seed * 2246822519)) | 0; rnd(T); rnd(T);
  let first = force, t0 = T.t;
  const dt = 1 / 30;
  while (!isOver(T) && T.t - t0 < maxSecs) {
    let inp = policy(T, react);
    if (first === 'go') { inp = { ...inp, run: true }; first = null; }
    else if (first === 'wait') { if (T.t - t0 > 0.5) first = null; inp = { ...inp, run: false }; }
    stepTurn(T, dt, inp);
  }
  if (!isOver(T)) return T.pts;
  const x = resultOf(T);
  return x.pts - (x.out ? 1.6 : 0);
}

// Value of hitting this way with a given timing error: a full rollout from a fresh serve.
export function hitValue(T0, aim, d, n = 2, base = 100) {
  let sum = 0;
  for (let k = 0; k < n; k++) {
    const T = cloneTurn(T0);
    T.rs = (T.rs ^ ((base + k) * 3266489917)) | 0; rnd(T);
    T.aim = aim; T.t = T.tossT + d; T.ball = Object.assign({}, T.ball, tossAt(T, T.t));
    T.swing = { t: T.t, d, hit: true }; launch(T, d, aim); T.ph = 'play';
    sum += rollout(T, null, base + k + 7);
  }
  return sum / n;
}

export const AIM_CHOICES = [-40, -30, -20, -10, 0, 10, 20, 30, 40];
export const TIMINGS = [-0.1, -0.05, 0, 0.05, 0.1];   // early (lofted, pulled left) ... late (flat, pushed right)
export function bestAim(T0, n = 2, seed = 1) {
  let best = null;
  for (const a of AIM_CHOICES) for (const d of TIMINGS) {
    const v = hitValue(T0, a, d, n, 100 + seed) - Math.abs(a) * 0.004 - Math.abs(d) * 1.2;
    if (!best || v > best.v) best = { aim: a, d, v };
  }
  return best;
}

// The computer batter's plan for a fresh serve: aim, timing error, and what it expects. Uses its own seed so it never peeks at the live one.
export function planBatter(T, P, seed) {
  const best = bestAim(T, P.plan, seed);
  const R = { rs: seed | 0 }; rnd(R); rnd(R);
  const dErr = gauss(R) * P.sig, aimErr = gauss(R) * P.aimN;
  return { aim: clamp(best.aim + aimErr, -K.AIM_MAX, K.AIM_MAX), plannedAim: best.aim, d: best.d + dErr, expected: best.v, rs: R.rs };
}

// The computer batter's input for this tick of a live turn.
export function batterInput(T, plan, P, st) {
  if (T.ph === 'serve') {
    const inp = { aim: plan.aim };
    if (T.t >= T.tossT + plan.d && !T.swing) inp.swing = true;
    return inp;
  }
  if (T.ph !== 'play') return {};
  const r = T.runner, inp = policy(T, P.react);
  // decisions by rollouts, re-evaluated every 0.35 s
  if ((r.st === 'ready' || r.st === 'atFar') && T.t - (st.lastEval ?? -9) >= 0.35 && T.ball.st !== 'thrown') {
    st.lastEval = T.t;
    const cur = r.st === 'ready' ? 0 : T.pts;
    if (r.st === 'ready' && T.ball.st === 'air' && !T.ball.bounced) st.go = false;
    else {
      let go = 0, wait = 0; const n = P.plan + 1;
      for (let k = 0; k < n; k++) { go += rollout(T, 'go', 31 + k); wait += rollout(T, 'wait', 57 + k); }
      go /= n; wait /= n;
      if (r.st === 'ready') st.go = go > Math.max(0.35, wait + P.margin);
      else st.go = go > cur + 0.2 + P.margin * 0.6;
    }
  }
  if (r.st === 'ready' || r.st === 'atFar') { inp.run = !!st.go; st.go = false; }
  return inp;
}

// What a coach would say: used by Think for a person and by Watch & Learn.
export function adviseServe(T) {
  const best = bestAim(T, 2, 5), a = best.aim, d = best.d;
  const side = a < -4 ? `to the left (about ${Math.abs(a)} degrees)` : a > 4 ? `to the right (about ${a} degrees)` : 'straight up the middle';
  const when = d < -0.03 ? 'a touch early, for a high hit that pulls left' : d > 0.03 ? 'a touch late, for a flat drive that pushes right' : 'right as the ring closes, for the hardest hit';
  const val = best.v >= 1.2 ? `that gap scored about ${best.v.toFixed(1)} points in tests` : 'that was the safest gap in tests';
  return { aim: a, d, value: best.v, text: `Aim ${side} and swing ${when}: ${val}.` };
}
export function adviseRun(T) {
  const r = T.runner;
  if (r.st === 'ready') {
    const go = (rollout(T, 'go', 11) + rollout(T, 'go', 12) + rollout(T, 'go', 13)) / 3, wait = (rollout(T, 'wait', 11) + rollout(T, 'wait', 12)) / 2;
    const near = Math.round(Math.min(...T.fielders.map((f) => Math.hypot(f.x - T.ball.x, f.y - T.ball.y))));
    if (go > Math.max(0.35, wait + 0.15)) return { go: true, text: `Run now. The nearest fielder is about ${near} m from the ball; in tests this run scored ${go.toFixed(1)} on average.` };
    return { go: false, text: `Wait. A fielder is about ${near} m from the ball and a throw would find you in the open; running now scored ${go.toFixed(1)} on average. Staying at home keeps the turn safe.` };
  }
  if (r.st === 'atFar') {
    const go = (rollout(T, 'go', 21) + rollout(T, 'go', 22) + rollout(T, 'go', 23)) / 3;
    if (go > T.pts + 0.2) return { go: true, text: `Come back now: the way home looks open (about ${go.toFixed(1)} points against ${T.pts} for staying).` };
    return { go: false, text: `Stay on the far line: coming back scored about ${go.toFixed(1)} against ${T.pts} for staying. Wait for the fielders to look away.` };
  }
  return { go: false, text: 'Watch the thrown ball and tap Dodge to sidestep it. A dodge takes a moment to recharge.' };
}

// A guess of where the live ball comes down, for the on-screen guide (not an oracle for catches or throws).
export function landing(T) {
  const b = T.ball;
  if (b.st === 'toss' || b.st === 'held') return null;
  const p = predictBall(b).find((q) => !q.air && q.t > 0);
  return p ? { x: p.x, y: p.y, t: p.t } : null;
}

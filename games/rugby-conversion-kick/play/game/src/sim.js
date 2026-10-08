// The kick: pure, deterministic physics and the kick state machine (ready -> runup -> flight -> result). Nothing here knows about drawing.
// The presenter and the HUD only READ the state returned by getState(): positions, the strike time and the outcome all belong to this file.
import { GOAL_HW, BAR_H, BALL_R, TEE_Y, G, KD, VMAX, CURL_A, RUN_Q, CONTACT_LATE, EARLY_MAX, BEATS, YAW_PER_S, AIM_MAX, TILTS, QUALITY, windVec } from './consts.js';
import { clamp, normal, r2 } from './util.js';

const SUB = 1 / 120;
export const RESULT_HOLD = 2.6;

/** The wind (m/s, field axes) at wind-clock time `clock`: a steady breeze with slow gusts. */
export function windAt(w, clock) {
  const g = w.gust || 0, per = w.period || 6;
  const ws = Math.max(0, w.ws * (1 + g * Math.sin((2 * Math.PI * clock) / per + w.ph)));
  const dir = w.dir + g * 0.35 * Math.sin((2 * Math.PI * clock) / (per * 1.7) + w.ph * 1.3);
  const v = windVec(ws, dir);
  return { x: v.x, z: v.z, speed: ws, dir };
}

/**
 * Fly a kicked ball. p: { sx, d, yaw, elev, speed, curl, wind: fn(t)->{x,z} | {x,z}, path? }. Returns where it crosses the posts' plane (z = 0),
 * where it first comes down through bar height, where it lands and how long it flew.
 */
export function flightSim(p) {
  const wf = typeof p.wind === 'function' ? p.wind : () => p.wind || { x: 0, z: 0 };
  let x = p.sx, y = TEE_Y + 0.04, z = -p.d;
  const ce = Math.cos(p.elev);
  let vx = p.speed * Math.sin(p.yaw) * ce, vy = p.speed * Math.sin(p.elev), vz = p.speed * Math.cos(p.yaw) * ce;
  const out = { cross: null, bar: null, landX: x, landZ: z, apex: y, t: 0, path: p.path ? [] : null };
  let t = 0, prev = { x, y, z };
  for (let i = 0; i < 1500; i++) {
    const w = wf(t);
    const rx = vx - w.x, ry = vy, rz = vz - w.z;
    const sp = Math.sqrt(rx * rx + ry * ry + rz * rz);
    const vh = Math.sqrt(vx * vx + vz * vz) || 1;
    const ca = (p.curl || 0) * CURL_A;
    const ax = -KD * sp * rx + ca * (vz / vh), ay = -KD * sp * ry - G, az = -KD * sp * rz - ca * (vx / vh);
    vx += ax * SUB; vy += ay * SUB; vz += az * SUB;
    prev = { x, y, z };
    x += vx * SUB; y += vy * SUB; z += vz * SUB; t += SUB;
    if (y > out.apex) out.apex = y;
    if (out.path && i % 4 === 0) out.path.push({ x, y, z });
    if (!out.cross && prev.z < 0 && z >= 0) {
      const k = -prev.z / (z - prev.z);
      out.cross = { x: prev.x + (x - prev.x) * k, y: prev.y + (y - prev.y) * k, t: t - SUB * (1 - k), vx, vy, vz };
    }
    if (!out.bar && vy < 0 && prev.y >= BAR_H && y < BAR_H) out.bar = { dist: Math.hypot(x - p.sx, z + p.d), x, z };
    if (y <= 0.12 && vy < 0) { out.landX = x; out.landZ = z; break; }
  }
  out.t = t;
  return out;
}

/** What a kick would do in still air with no timing error: used by the power readout, the planner and the lessons. */
export function predict(spot, aimX, tiltIdx, power, wind = null, curl = 0) {
  const yaw = Math.atan2(aimX - spot.sx, spot.d);
  const r = flightSim({ sx: spot.sx, d: spot.d, yaw, elev: TILTS[tiltIdx].elev, speed: VMAX * power, curl, wind: wind || { x: 0, z: 0 } });
  return { carry: r.bar ? r.bar.dist : 0, crossX: r.cross ? r.cross.x : null, crossY: r.cross ? r.cross.y : null, clear: r.cross ? r.cross.y - BAR_H : -BAR_H, apex: r.apex, flight: r.t };
}

export function qualityOf(absE, win) {
  const q = absE / win;
  for (const Q of QUALITY) if (q <= Q.max) return Q;
  return QUALITY[3];
}

export function createSim(cfg, rng) {
  const s = {
    t: 0, clock: 0, tick: 0, phase: 'ready', mode: cfg.mode || 'practice', who: 'you',
    spot: { sx: 0, d: 20 }, wind: { ws: 0, dir: 0, gust: 0, period: 6, ph: 0 }, win: 1.3, noise: 1,
    aimX: 0, power: 0.7, tilt: 1, runT: 0, press: null,
    ball: { x: 0, y: TEE_Y, z: -20, vx: 0, vy: 0, vz: 0, spin: 0, fly: false, rest: true, bounces: 0 },
    shot: null, resultT: 0, events: [], evId: 0, n: 0, kickT: 0, contactDone: false, seq: 0, rc: 0,
  };
  const push = (type, extra = {}) => { s.events.push({ id: ++s.evId, type, t: s.t, ...extra }); if (s.events.length > 40) s.events.shift(); };
  const wf = () => windAt(s.wind, s.clock);

  function setSpot(spec, who = 'you') {
    s.spot = { sx: spec.sx, d: spec.d };
    s.wind = { ws: spec.ws, dir: spec.dir, gust: spec.gust || 0, period: spec.period || 5.5 + rng.next() * 3, ph: spec.ph ?? rng.next() * 6.283 };
    s.win = spec.win ?? 1.2; s.noise = spec.noise ?? 1;
    s.who = who; s.aimX = clamp(Math.round(spec.sx * -0.0 * 4) / 4, -AIM_MAX, AIM_MAX);
    s.phase = 'ready'; s.runT = 0; s.rc = 0; s.press = null; s.shot = null; s.resultT = 0; s.contactDone = false; s.n++;
    s.ball = { x: s.spot.sx, y: TEE_Y, z: -s.spot.d, vx: 0, vy: 0, vz: 0, spin: 0, fly: false, rest: true, bounces: 0 };
    push('ready', { who });
  }
  const canAdjust = () => s.phase === 'ready';
  function skip() { if (s.phase === 'result' && s.resultT > 0.5) s.resultT = RESULT_HOLD; }
  function setAim(x) { if (canAdjust()) s.aimX = clamp(Math.round(x * 20) / 20, -AIM_MAX, AIM_MAX); }
  function setPower(p) { if (canAdjust()) s.power = clamp(Math.round(p * 100) / 100, 0.3, 1); }
  function setTilt(i) { if (canAdjust()) s.tilt = clamp(i | 0, 0, 2); }
  function startRunup() {
    if (s.phase !== 'ready') return false;
    s.phase = 'runup'; s.runT = 0; s.rc = 0; s.press = null; s.contactDone = false;
    push('runup');
    return true;
  }
  function press(curl = 0) {
    if (s.phase !== 'runup' || s.press || s.runT < RUN_Q - EARLY_MAX) return false;
    s.press = { t: s.runT, curl: clamp(curl, -1, 1) };
    push('press', { e: r2(s.runT - RUN_Q) });
    return true;
  }
  function setCurl(c) { if (s.phase === 'runup' && s.press && !s.contactDone) s.press.curl = clamp(c, -1, 1); }

  function strike() {
    s.contactDone = true;
    const has = !!s.press;
    const e = has ? clamp(s.press.t - RUN_Q, -EARLY_MAX, CONTACT_LATE) : 0.3;
    const curl = has ? s.press.curl : 0;
    const eEff = e / s.win;
    const Q = has ? qualityOf(Math.abs(e), s.win) : QUALITY[3];
    const sigma = (0.0035 + 0.0045 * s.power) * s.noise;
    const nz = clamp(normal(rng), -2.2, 2.2), np = clamp(normal(rng), -2.2, 2.2);
    const yawErr = eEff * YAW_PER_S + nz * sigma;
    const powLoss = Math.min(0.4, 0.5 * Math.abs(eEff));
    const pf = clamp(s.power * (1 - powLoss) * (1 + 0.012 * np), 0.1, 1.02);
    const yawAim = Math.atan2(s.aimX - s.spot.sx, s.spot.d);
    const elev = TILTS[s.tilt].elev - (Math.abs(eEff) > 0.3 ? 0.05 : 0);
    const speed = VMAX * pf, yaw = yawAim + yawErr;
    const w0 = wf();
    s.shot = { e: r2(e), has, quality: Q.id, qualityName: has ? Q.name : 'No strike', power: s.power, pf: r2(pf), tilt: s.tilt, aimX: s.aimX, curl: r2(curl), yaw, yawAim, elev, speed,
      wind: { speed: r2(w0.speed), dir: r2(w0.dir) }, outcome: null, cross: null, margin: 0, who: s.who };
    s.shot.curlN = curl;
    const ce = Math.cos(elev);
    s.ball.vx = speed * Math.sin(yaw) * ce; s.ball.vy = speed * Math.sin(elev); s.ball.vz = speed * Math.cos(yaw) * ce;
    s.trail = []; s.ball.fly = true; s.ball.rest = false; s.ball.y = TEE_Y + 0.04; s.kickT = 0; s.shot.clock0 = s.clock;
    s.phase = 'flight';
    push('strike', { q: Q.id, e: r2(e), who: s.who, speed: r2(speed) });
  }

  function resolveCross(cx, cy) {
    const sh = s.shot, ax = Math.abs(cx), h = GOAL_HW - ax, v = cy - BAR_H;
    sh.cross = { x: r2(cx), y: r2(cy) };
    const nearPost = Math.abs(h) < BALL_R + 0.05 && cy > BAR_H - 0.2, nearBar = Math.abs(v) < BALL_R + 0.05 && ax < GOAL_HW + 0.2;
    let out;
    if (h > 0 && v > 0) out = 'goal';
    else if (ax <= GOAL_HW) out = nearBar && v > -BALL_R - 0.05 ? 'bar' : 'short';
    else out = cx < 0 ? 'wide-left' : 'wide-right';
    sh.outcome = out; sh.margin = r2(Math.min(h, v)); sh.touch = nearPost ? 'post' : nearBar ? 'bar' : null;
    sh.close = out === 'goal' && sh.margin < 0.35;
    if (sh.touch) push('touch', { what: sh.touch, out });
    if (out !== 'goal' && (sh.touch || out === 'short')) { s.ball.vz = -Math.abs(s.ball.vz) * 0.3; s.ball.vx *= 0.3; s.ball.vy = Math.max(0.5, Math.abs(s.ball.vy) * 0.3); }
    s.phase = 'result'; s.resultT = 0;
    push('result', { out, margin: sh.margin, close: sh.close, who: s.who });
  }

  function stepBall(dt) {
    const b = s.ball;
    if (b.rest) return;
    const w = windAt(s.wind, s.clock);
    const curl = s.shot ? s.shot.curlN : 0;
    let n = Math.max(1, Math.round(dt / SUB));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      if (b.bounces === 0 || b.y > 0.2) {
        const rx = b.vx - w.x, rz = b.vz - w.z, sp = Math.sqrt(rx * rx + b.vy * b.vy + rz * rz), vh = Math.sqrt(b.vx * b.vx + b.vz * b.vz) || 1;
        const ca = b.bounces ? 0 : curl * CURL_A;
        b.vx += (-KD * sp * rx + ca * (b.vz / vh)) * h; b.vy += (-KD * sp * b.vy - G) * h; b.vz += (-KD * sp * rz - ca * (b.vx / vh)) * h;
      } else b.vy -= G * h;
      const pz = b.z;
      b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
      b.spin += (b.bounces ? 6 : 24) * h;
      if (s.trail && b.y > 0.15) { const L = s.trail[s.trail.length - 1]; if (!L || Math.abs(b.x - L.x) + Math.abs(b.y - L.y) + Math.abs(b.z - L.z) > 0.8) { s.trail.push({ x: r2(b.x), y: r2(b.y), z: r2(b.z) }); if (s.trail.length > 90) s.trail.shift(); } }
      if (s.phase === 'flight' && pz < 0 && b.z >= 0) {
        const k = -pz / (b.z - pz);
        resolveCross(b.x - b.vx * h * (1 - k), b.y - b.vy * h * (1 - k));
      }
      if (b.y <= 0.12 && b.vy < 0) {
        b.y = 0.12;
        if (s.phase === 'flight') { s.shot.outcome = 'short'; s.shot.cross = null; s.shot.margin = r2(b.z); s.shot.touch = null; s.shot.close = false; s.phase = 'result'; s.resultT = 0; push('result', { out: 'short', margin: s.shot.margin, who: s.who }); }
        b.bounces++;
        if (Math.abs(b.vy) < 1.4 || b.bounces > 3) { b.vy = 0; b.rest = true; b.vx *= 0.2; b.vz *= 0.2; break; }
        b.vy = -b.vy * 0.42; b.vx *= 0.72; b.vz *= 0.72;
        push('bounce', { v: r2(Math.abs(b.vy)) });
      }
    }
  }

  function update(dt, c = {}) {
    s.tick++; s.t += dt; s.clock += dt;
    if (s.phase !== 'ready') s.rc += dt;
    if (s.phase === 'runup') {
      const prevT = s.runT;
      s.runT += dt;
      if (c.press) press(c.curl || 0);
      if (c.curl != null && s.press) setCurl(c.curl);
      for (let i = 0; i < BEATS.length; i++) if (prevT < BEATS[i] && s.runT >= BEATS[i]) push('beat', { i });
      if (prevT < RUN_Q && s.runT >= RUN_Q) push('cue');
      if (s.runT >= RUN_Q + CONTACT_LATE && !s.contactDone) strike();
    } else if (s.phase === 'flight' || s.phase === 'result') {
      if (s.phase === 'flight') s.kickT += dt;
      stepBall(dt);
      if (s.phase === 'result') { s.resultT += dt; if (s.resultT >= RESULT_HOLD) { s.phase = 'done'; push('done'); } }
    }
  }

  return {
    s, setSpot, setAim, setPower, setTilt, startRunup, press, setCurl, update, canAdjust, skip,
    nudgeAim: (d) => setAim(s.aimX + d),
    predictNow: () => predict(s.spot, s.aimX, s.tilt, s.power),
    windNow: wf,
  };
}

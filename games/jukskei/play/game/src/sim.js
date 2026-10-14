// Jukskei physics: a flat wooden pin thrown down a sand lane at a stake. Pure and deterministic (no clocks, no randomness: every
// bounce is a function of the throw). World units are metres: x runs along the lane from the thrower (0) to the stake (D), y is
// across the lane (+ toward the camera), z is height. All mutable state lives in the plain `world` object so a copy can be
// simulated for the guide line, the hint and the rival's planner.

export const G = 9.81;
export const DT = 1 / 120;
export const STEPS_PER_TICK = 2;
export const PIN_LEN = 0.3;          // drawn length of a pin (the real pin is a little longer than a hand)
export const R_PIN = 0.16;           // contact radius on the sand
export const R_STAKE = 0.06;
export const R_PIN_STAKE = 0.1;      // the pin's reach against the post (it is a narrow edge head-on)
export const STAKE_H = 0.62;
export const LANE_HALF = 3.0;        // side lines at y = +-3 m
export const TOUCH = 0.3;           // a pin resting this close to the stake is touching it
export const NEAR = 1.0;             // the scoring zone around the stake
export const BONUS_NEAR = 2.0;       // the nearest pin of a round earns its side one extra point inside this distance
export const V_MAX = 25;             // fastest believable throw (m/s, total speed)
export const PINS_EACH = 4;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
export const foldAngle = (a) => { let x = a % Math.PI; if (x > Math.PI / 2) x -= Math.PI; else if (x < -Math.PI / 2) x += Math.PI; return x; };

// How the pin leaves the hand. alpha: launch elevation; om: end-over-end spin (rad/s); z0: release height; th0: start angle.
export const STYLES = [
  { id: 'lob', name: 'Lob', sub: 'high, drops on its end', alpha: 0.95, om: 4.2, z0: 1.55, th0: 0.3 },
  { id: 'skim', name: 'Skim', sub: 'low, skids on its flat', alpha: 0.22, om: 0.9, z0: 1.05, th0: -0.25 },
  { id: 'whirl', name: 'Whirl', sub: 'fast spin, bounces', alpha: 0.62, om: 21, z0: 1.4, th0: 0 },
];

// The pitches. D: stake distance (m); wind: [min, max] base wind speed (m/s); fric: sliding deceleration of a flat pin (m/s^2).
export const PITCHES = {
  farm: { id: 'farm', name: 'Farm lane', sub: 'Short and sheltered: 18 m, light breeze', D: 18, wind: [0, 1.6], fric: 8.5, sky: 0 },
  club: { id: 'club', name: 'Club ground', sub: 'The standard 24 m on packed sand', D: 24, wind: [0.4, 2.8], fric: 8.0, sky: 1 },
  ridge: { id: 'ridge', name: 'Windy ridge', sub: '24 m with a gusting crosswind', D: 24, wind: [2.4, 5.0], fric: 7.5, sky: 2 },
  river: { id: 'river', name: 'River sand', sub: 'Soft, deep sand: pins stop fast', D: 21, wind: [0.2, 2.4], fric: 15, sky: 3 },
  daily: { id: 'daily', name: 'Daily pitch', sub: 'A new mix every day', D: 24, wind: [0.5, 3.5], fric: 9, sky: 4 },
};
export const PITCH_IDS = ['farm', 'club', 'ridge', 'river', 'daily'];
export const pitchName = (id) => PITCHES[id].name;
// the daily pitch: a distance, wind range and surface picked from a seed
export function makePitch(id, rng) {
  const p = { ...PITCHES[id] };
  if (id === 'daily' && rng) {
    p.D = 18 + rng.int(4) * 2;
    const lo = rng.next() * 2, hi = lo + 1.2 + rng.next() * 3;
    p.wind = [lo, hi]; p.fric = 7 + rng.next() * 6;
    p.sub = `${p.D} m, wind up to ${hi.toFixed(0)} m/s`;
  }
  return p;
}

export function createWorld(pitch) {
  return {
    pitch, D: pitch.D, pins: [], stake: { x: pitch.D, y: 0, fallen: false, fallenBy: -1, dirx: 1, diry: 0, t: 0 },
    wind: { speed: 0, dir: 0, ax: 0, ay: 0 }, settled: true, flying: -1, apex: 3, t: 0, thrown: 0,
  };
}
// wind: speed in m/s and direction in radians (0 = blowing toward the stake). Acceleration on a pin in the air.
export function setWind(w, speed, dir) {
  w.wind = { speed, dir, ax: Math.cos(dir) * speed * 0.3, ay: Math.sin(dir) * speed * 0.3 };
}
export function cloneWorld(w) {
  return { ...w, stake: { ...w.stake }, wind: { ...w.wind }, pins: w.pins.map((p) => ({ ...p })) };
}

export function newPin(id, team) {
  return { id, team, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, th: 0, om: 0, yaw: 0, mode: 'rest', bounces: 0, dug: false, out: false, fade: 0, style: 0, hitBy: -1 };
}

// ---- flight maths ---------------------------------------------------------------------------------------------------------------
// Time in the air from release height z0 with vertical speed vz.
const airTime = (z0, vz) => (vz + Math.sqrt(vz * vz + 2 * G * z0)) / G;

// The throw that lands on (tx, ty) for a style in the given wind: heading theta and horizontal speed v0. `clamped` when the
// target is out of reach (the throw is then as hard as a throw can be, landing short).
export function solveThrow(w, styleIdx, tx, ty) {
  const st = STYLES[styleIdx], tn = Math.tan(st.alpha), { ax, ay } = w.wind;
  const vMaxH = V_MAX * Math.cos(st.alpha);
  let vh = Math.max(6, Math.hypot(tx, ty) / 1.4);
  let t = 1, vx = 1, vy = 0;
  for (let i = 0; i < 24; i++) {
    t = airTime(st.z0, vh * tn);
    vx = (tx - 0.5 * ax * t * t) / t; vy = (ty - 0.5 * ay * t * t) / t;
    const nv = Math.hypot(vx, vy);
    if (Math.abs(nv - vh) < 1e-4) { vh = nv; break; }
    vh = vh + (nv - vh) * 0.8;
  }
  let clamped = false;
  if (vh > vMaxH) { const k = vMaxH / vh; vx *= k; vy *= k; vh = vMaxH; clamped = true; }
  return { theta: Math.atan2(vy, vx), v0: vh, t, clamped };
}
// where a throw first touches the sand (no obstacles)
export function landingPoint(w, styleIdx, theta, v0) {
  const st = STYLES[styleIdx], t = airTime(st.z0, v0 * Math.tan(st.alpha)), { ax, ay } = w.wind;
  return { x: v0 * Math.cos(theta) * t + 0.5 * ax * t * t, y: v0 * Math.sin(theta) * t + 0.5 * ay * t * t, t };
}

export function launch(w, pin, { style, theta, v0 }) {
  const st = STYLES[style];
  pin.style = style;
  pin.x = 0; pin.y = 0; pin.z = st.z0;
  pin.vx = v0 * Math.cos(theta); pin.vy = v0 * Math.sin(theta); pin.vz = v0 * Math.tan(st.alpha);
  pin.th = st.th0; pin.om = st.om; pin.yaw = theta * 0.5; pin.mode = 'air'; pin.bounces = 0; pin.dug = false; pin.out = false; pin.fade = 0;
  w.pins.push(pin); w.flying = pin.id; w.settled = false; w.thrown++;
  w.apex = st.z0 + (pin.vz * pin.vz) / (2 * G);
  w.stake.fallen = false; w.stake.fallenBy = -1;
  return pin;
}

// ---- stepping -------------------------------------------------------------------------------------------------------------------
export function stepWorld(w, n, ev = []) {
  for (let i = 0; i < n && !w.settled; i++) step(w, ev);
  return ev;
}

function touchdown(w, p, ev) {
  const fric = w.pitch.fric;
  const vIn = -p.vz, vh = Math.hypot(p.vx, p.vy);
  p.z = 0;
  const a = Math.abs(foldAngle(p.th));
  const flat = a < 0.62;
  // a fast spinning or hard-dropped pin bounces first (at most twice)
  if (p.bounces < 2 && vIn > 3.2 && (flat || p.style === 2)) {
    p.bounces++;
    p.vz = vIn * 0.34; p.vx *= 0.7; p.vy *= 0.7; p.om *= 0.75;
    ev.push({ t: 'bounce', x: p.x, y: p.y, v: vIn, id: p.id });
    return;
  }
  if (flat) {
    // lands on its flat side: skids along the sand
    p.vz = 0; p.mode = 'slide'; p.om = 0; p.dug = false;
    p.vx *= 0.72; p.vy *= 0.72;
    ev.push({ t: 'land', x: p.x, y: p.y, v: vIn, flat: true, id: p.id, vh });
  } else {
    // lands on an end: bites into the sand and mostly stops, then tips over
    p.vz = 0; p.mode = 'slide'; p.om = 0; p.dug = true;
    p.vx *= 0.1; p.vy *= 0.1;
    ev.push({ t: 'land', x: p.x, y: p.y, v: vIn, flat: false, id: p.id, vh });
  }
  p.fall = 0;
}

function hitStake(w, p, ev, speed) {
  const s = w.stake;
  const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1e-6, nx = dx / d, ny = dy / d;
  if (speed >= 1.4) {
    s.fallen = true; s.fallenBy = p.id; s.t = 0;
    const vh = Math.hypot(p.vx, p.vy) || 1;
    s.dirx = p.vx / vh; s.diry = p.vy / vh;
    p.vx *= 0.5; p.vy *= 0.5;
    if (p.mode === 'air') { p.vz = Math.min(p.vz, 0.5); }
    ev.push({ t: 'stake', x: s.x, y: s.y, v: speed, id: p.id });
  } else {
    // a gentle touch: the pin rests against the post
    const vn = p.vx * nx + p.vy * ny;
    if (vn < 0) { p.vx -= (1.15) * vn * nx; p.vy -= 1.15 * vn * ny; }
    p.x = s.x + nx * (R_STAKE + R_PIN_STAKE); p.y = s.y + ny * (R_STAKE + R_PIN_STAKE);
    ev.push({ t: 'tap', x: s.x, y: s.y, v: speed, id: p.id });
  }
}

function step(w, ev) {
  const dt = DT, fric = w.pitch.fric, s = w.stake;
  w.t += dt;
  if (s.fallen) s.t += dt;
  let any = false;
  for (const p of w.pins) {
    if (p.mode === 'rest') continue;
    any = true;
    if (p.mode === 'air') {
      p.vx += w.wind.ax * dt; p.vy += w.wind.ay * dt; p.vz -= G * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.th += p.om * dt;
      if (p.z <= 0) touchdown(w, p, ev);
      // the stake can be hit in the air too
      if (p.mode === 'air' && !s.fallen && p.z < STAKE_H) {
        const d = Math.hypot(p.x - s.x, p.y - s.y);
        if (d < R_STAKE + R_PIN_STAKE) hitStake(w, p, ev, Math.hypot(p.vx, p.vy, p.vz * 0.5));
      }
    } else {
      // sliding on the sand
      const v = Math.hypot(p.vx, p.vy);
      const dec = (p.dug ? fric * 2.4 : fric) * dt;
      if (v <= dec) { p.vx = 0; p.vy = 0; } else { p.vx -= (p.vx / v) * dec; p.vy -= (p.vy / v) * dec; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      // a standing pin tips over; a flat one lies down
      p.th += (0 - p.th) * Math.min(1, dt * (p.dug ? 7 : 14));
      if (v > 0.05) p.yaw += (Math.atan2(p.vy, p.vx) * 0.5 - p.yaw) * Math.min(1, dt * 3);
      if (!s.fallen) {
        const d = Math.hypot(p.x - s.x, p.y - s.y);
        if (d < R_STAKE + R_PIN_STAKE && v > 0.02) hitStake(w, p, ev, v);
      }
      if (p.vx === 0 && p.vy === 0) { p.mode = 'rest'; p.th = 0; p.out = Math.abs(p.y) > LANE_HALF || p.x > w.D + 6 || p.x < -0.5; ev.push({ t: 'rest', id: p.id, x: p.x, y: p.y }); }
    }
  }
  // pin against pin on the sand
  const n = w.pins.length;
  for (let i = 0; i < n; i++) {
    const a = w.pins[i];
    if (a.z > 0.25 && a.mode === 'air') continue;
    for (let j = i + 1; j < n; j++) {
      const b = w.pins[j];
      if (b.z > 0.25 && b.mode === 'air') continue;
      if (a.mode === 'rest' && b.mode === 'rest') continue;
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, r = 2 * R_PIN;
      if (d2 >= r * r || d2 < 1e-10) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn < 0) {
        const j2 = -(1 + 0.35) * vn / 2;
        a.vx -= j2 * nx; a.vy -= j2 * ny; b.vx += j2 * nx; b.vy += j2 * ny;
        if (a.mode === 'rest') { a.mode = 'slide'; a.dug = false; }
        if (b.mode === 'rest') { b.mode = 'slide'; b.dug = false; }
        if (a.mode === 'air') { a.vz = Math.min(a.vz, 0); }
        ev.push({ t: 'hit', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: -vn, a: a.id, b: b.id });
        any = true;
      }
      const o = (r - d) / 2;
      a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
    }
  }
  if (!any && !w.pins.some((p) => p.mode !== 'rest')) w.settled = true;
}

// ---- scoring --------------------------------------------------------------------------------------------------------------------
export const stakeDist = (w, p) => Math.hypot(p.x - w.stake.x, p.y - w.stake.y);
// what a pin that has come to rest scores: 3 for knocking the stake down, 2 touching it, 1 inside the near zone
export function throwPoints(w, p) {
  if (!p) return { pts: 0, kind: 'out', d: Infinity };
  const d = stakeDist(w, p);
  if (w.stake.fallen && w.stake.fallenBy === p.id) return { pts: 3, kind: 'stake', d };
  if (p.out) return { pts: 0, kind: 'out', d };
  if (d <= TOUCH) return { pts: 2, kind: 'touch', d };
  if (d <= NEAR) return { pts: 1, kind: 'near', d };
  return { pts: 0, kind: 'miss', d };
}
// the closest live pin of each side to the stake
export function nearestByTeam(w) {
  const best = [Infinity, Infinity];
  for (const p of w.pins) { if (p.out || p.mode !== 'rest') continue; const d = stakeDist(w, p); if (d < best[p.team]) best[p.team] = d; }
  return best;
}
// who earns the round bonus: the side whose pin is nearest, if it is inside BONUS_NEAR
export function bonusTeam(w) {
  const b = nearestByTeam(w);
  const m = Math.min(b[0], b[1]);
  if (m > BONUS_NEAR || Math.abs(b[0] - b[1]) < 0.001) return -1;
  return b[0] < b[1] ? 0 : 1;
}
export function liveCount(w) { return w.pins.filter((p) => !p.out).length; }

// ---- the guide: run a whole throw on a copy of the world ------------------------------------------------------------------------
// Returns the flight path (x,y,z triples), where it first lands, where it ends, the pins it moves and what it would score.
export function previewThrow(w, team, spec) {
  const c = cloneWorld(w);
  const before = new Map(c.pins.map((p) => [p.id, { x: p.x, y: p.y }]));
  const pin = newPin(9000 + w.thrown, team);
  launch(c, pin, spec);
  const path = [];
  let landed = null, flatLand = null, guard = 0, stakeHit = false;
  const ev = [];
  while (!c.settled && guard++ < 2600) {
    ev.length = 0;
    stepWorld(c, 1, ev);
    if (guard % 3 === 0 && path.length < 3 * 120 && pin.mode === 'air') path.push(pin.x, pin.y, pin.z);
    for (const e of ev) {
      if ((e.t === 'land' || e.t === 'bounce') && !landed && e.id === pin.id) { landed = { x: e.x, y: e.y }; flatLand = e.t === 'bounce' ? true : e.flat; }
      if (e.t === 'stake') stakeHit = true;
    }
  }
  if (!landed) landed = { x: pin.x, y: pin.y };
  path.push(landed.x, landed.y, 0);
  const moved = [];
  for (const p of c.pins) {
    if (p.id === pin.id) continue;
    const b = before.get(p.id);
    if (b && Math.hypot(p.x - b.x, p.y - b.y) > 0.05) moved.push({ id: p.id, team: p.team, x0: b.x, y0: b.y, x: p.x, y: p.y });
  }
  const sc = throwPoints(c, pin);
  return { path, land: landed, flat: flatLand, rest: { x: pin.x, y: pin.y }, moved, pts: sc.pts, kind: sc.kind, d: sc.d, stakeHit, world: c, pin };
}

export const totalSpeed = (styleIdx, v0) => v0 / Math.cos(STYLES[styleIdx].alpha);
export { TAU };

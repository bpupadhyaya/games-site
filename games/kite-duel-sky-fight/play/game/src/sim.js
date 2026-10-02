// Kite Duel: the physics of the sky. Pure and deterministic: no clock, no randomness at step time
// (the wind schedule is generated once from a seeded rng). Everything the Rules page says about numbers
// comes from the constants exported here.
//
// Space: 720 x 1280 virtual units, y grows downward. Two flyers stand at the anchors near the bottom;
// each holds one string to one kite. A kite is a particle that is steered toward a heading point,
// pushed by the wind, held back by its string length. Where the two strings cross they saw at each other.

export const W = 720;
export const H = 1280;
export const BOUNDS = { x0: 50, x1: 670, y0: 280, y1: 1040 };
export const ANCHOR = [{ x: 170, y: 1110 }, { x: 550, y: 1110 }];

export const K = {
  ROUND_TIME: 75,        // seconds, then the thicker string wins
  ARM: 2.0,              // seconds of free flying before strings can bite
  L0: 880, LMIN: 500, LMAX: 1060,
  EASE_RATE: 150, PULL_RATE: 170,   // string units per second
  TAUT_EDGE: 6, TAKE_IN: 300, GIVE_OUT: 400,   // steady mode keeps the string just taut
  GRIP_DRAIN: 0.28, GRIP_REGEN: 0.12, GRIP_REGEN_EASE: 0.2, GRIP_RELOCK: 0.25,
  WIND_X: 260, LIFT: 560, GRAV: 210, DRAG: 1.0,
  KS: 14, CS: 6, A0: 380, A1: 900,
  CUT_K: 26,             // string wear per second at full pressure, full tension, 300 units/s of sliding
  CUT_BASE_SLIDE: 60,    // sliding speed credited to a crossing even when nothing moves
  CUT_SLIDE_REF: 300,
  STRAIN_AT: 1.05, STRAIN_K: 60,
  SEG: 12,
  SLOWMO: 0.25, SLOWMO_T: 0.9,
};

export const SKIES = {
  dawn: { id: 'dawn', name: 'Dawn Breeze', blurb: 'Light, steady wind with soft gusts', base: 0.5, gust: 0.7, swirl: 0.05 },
  noon: { id: 'noon', name: 'Open Noon', blurb: 'Firm wind and sharper gusts', base: 0.58, gust: 0.95, swirl: 0.08 },
  dusk: { id: 'dusk', name: 'Long Dusk', blurb: 'Wind that fades and returns', base: 0.46, gust: 1.0, swirl: 0.14 },
  storm: { id: 'storm', name: 'Gale Front', blurb: 'Strong, restless wind', base: 0.7, gust: 1.25, swirl: 0.12 },
};
export const SKY_IDS = ['dawn', 'noon', 'dusk', 'storm'];

const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- wind -------------------------------------------------------------------------------------
export function makeWind(rng, skyId) {
  const sky = SKIES[skyId] ?? SKIES.dawn;
  const gusts = [];
  let t = 2 + rng.range(0, 2);
  while (t < 140) {
    const lull = rng.chance(0.38);
    const dur = lull ? rng.range(3, 5.5) : rng.range(2.5, 5);
    const amp = (lull ? -rng.range(0.22, 0.38) : rng.range(0.2, 0.5)) * sky.gust;
    gusts.push({ t0: t, dur, amp });
    t += dur + rng.range(1.5, 6);
  }
  return { sky: sky.id, base: sky.base, swirl: sky.swirl, dir: rng.chance(0.5) ? 1 : -1, ph: [rng.range(0, TAU), rng.range(0, TAU)], gusts };
}
export function windAt(wd, t) {
  let w = wd.base + wd.swirl * (Math.sin(t * 0.37 + wd.ph[0]) + 0.6 * Math.sin(t * 0.91 + wd.ph[1]));
  for (const g of wd.gusts) {
    if (t >= g.t0 && t <= g.t0 + g.dur) { const s = Math.sin(Math.PI * (t - g.t0) / g.dur); w += g.amp * s * s; }
  }
  return clamp(w, 0.08, 1.35);
}

// ---- world ------------------------------------------------------------------------------------
export const STYLES = ['patang', 'rokkaku', 'tailed'];

export function newKite(side, style, stat = {}) {
  const a = ANCHOR[side];
  return {
    side, style, x: a.x + (side === 0 ? 120 : -120), y: 700, vx: 0, vy: 0, ang: 0,
    L: K.L0, d: 0, mode: 0, tx: a.x + (side === 0 ? 150 : -150), ty: 560, T: 0.2, integ: 100, grip: 1, lock: false,
    free: false, spin: 0, ph: side * 2.1 + 0.7,
    steer: stat.steer ?? 1, strain: 0,
  };
}

export function newWorld(rng, o = {}) {
  const wind = makeWind(rng, o.sky ?? 'dawn');
  const w = {
    t: 0, wind, wnow: 0, k: [newKite(0, o.styles?.[0] ?? 'patang', o.stats?.[0]), newKite(1, o.styles?.[1] ?? 'rokkaku', o.stats?.[1])],
    contact: null, contactT: 0, over: null, ev: [], dmg: [0, 0], cuts: 0, minInteg: [100, 100], sever: null, slow: 0,
  };
  w.wnow = windAt(wind, 0);
  w.k[0].ty = 560; w.k[1].ty = 540;
  return w;
}

export function cloneWorld(w) {
  return {
    ...w, k: [{ ...w.k[0] }, { ...w.k[1] }], ev: [], contact: w.contact ? { ...w.contact } : null,
    dmg: [...w.dmg], minInteg: [...w.minInteg], over: w.over ? { ...w.over } : null, sever: w.sever ? { ...w.sever } : null,
  };
}

// String as a sagging curve from the anchor to the kite. Returns a flat array of points [x,y,x,y,...].
export function stringPoints(k, out = []) {
  const a = ANCHOR[k.side];
  const dx = k.x - a.x, dy = k.y - a.y, d = Math.hypot(dx, dy) || 1;
  let nx = -dy / d, ny = dx / d;
  const dir = k.dirHint ?? 1;
  if (nx * dir + ny * 0.5 < 0) { nx = -nx; ny = -ny; }
  const slack = clamp((k.L - d) / k.L, 0, 0.5);
  const sag = d * (0.012 + 0.34 * slack + 0.05 * (1 - clamp(k.T, 0, 1)));
  const cx = (a.x + k.x) / 2 + nx * sag * 2, cy = (a.y + k.y) / 2 + ny * sag * 2;
  const n = K.SEG;
  out.length = 0;
  for (let i = 0; i <= n; i++) {
    const u = i / n, m = 1 - u;
    out.push(m * m * a.x + 2 * m * u * cx + u * u * k.x, m * m * a.y + 2 * m * u * cy + u * u * k.y);
  }
  return out;
}

const PA = [], PB = [];
function segHit(ax, ay, bx, by, cx, cy, dx, dy) {
  const r1x = bx - ax, r1y = by - ay, r2x = dx - cx, r2y = dy - cy;
  const den = r1x * r2y - r1y * r2x;
  if (Math.abs(den) < 1e-9) return null;
  const s = ((cx - ax) * r2y - (cy - ay) * r2x) / den, t = ((cx - ax) * r1y - (cy - ay) * r1x) / den;
  if (s < 0 || s > 1 || t < 0 || t > 1) return null;
  return { x: ax + r1x * s, y: ay + r1y * s, s, t };
}
export function findCrossing(w) {
  const a = w.k[0], b = w.k[1];
  a.dirHint = w.wind.dir; b.dirHint = w.wind.dir;
  stringPoints(a, PA); stringPoints(b, PB);
  const n = K.SEG;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const h = segHit(PA[i * 2], PA[i * 2 + 1], PA[i * 2 + 2], PA[i * 2 + 3], PB[j * 2], PB[j * 2 + 1], PB[j * 2 + 2], PB[j * 2 + 3]);
      if (h) return { x: h.x, y: h.y, uA: (i + h.s) / n, uB: (j + h.t) / n };
    }
  }
  return null;
}

export const pressureOf = (k) => (k.free ? 0 : clamp(k.T, 0.15, 1.5) * (k.mode === 1 && !k.lock ? 1.15 : 1));

function stepKite(w, k, dt, wind) {
  const a = ANCHOR[k.side];
  // ---- string length and grip
  if (k.lock && k.grip >= K.GRIP_RELOCK) k.lock = false;
  if (k.mode === 1 && !k.lock && k.grip > 0.02) { k.L -= K.PULL_RATE * dt; k.grip = Math.max(0, k.grip - K.GRIP_DRAIN * dt); if (k.grip <= 0.02) { k.lock = true; k.mode = 0; } }
  else {
    if (k.mode === 1) k.mode = 0;
    k.grip = Math.min(1, k.grip + (k.mode === -1 ? K.GRIP_REGEN_EASE : K.GRIP_REGEN) * dt);
    if (k.mode === -1) k.L += K.EASE_RATE * dt;
    // steady: the flyer keeps the string just taut, giving and taking string as the kite moves
    else k.L += clamp(k.d + K.TAUT_EDGE - k.L, -K.TAKE_IN * dt, K.GIVE_OUT * dt);
  }
  k.L = clamp(k.L, K.LMIN, K.LMAX);
  // ---- forces
  const dir = w.wind.dir;
  const turbX = Math.sin(w.t * 1.9 + k.ph) * 55 * wind, turbY = Math.sin(w.t * 2.3 + k.ph * 1.7) * 45 * wind;
  const wx = dir * K.WIND_X * wind + turbX, wy = K.GRAV - K.LIFT * wind + turbY;
  const tx = clamp(k.tx, BOUNDS.x0, BOUNDS.x1), ty = clamp(k.ty, BOUNDS.y0, BOUNDS.y1);
  let sx = K.KS * (tx - k.x) - K.CS * k.vx, sy = K.KS * (ty - k.y) - K.CS * k.vy;
  const aMax = (K.A0 + K.A1 * wind) * k.steer, sm = Math.hypot(sx, sy);
  if (sm > aMax) { sx *= aMax / sm; sy *= aMax / sm; }
  let ax = sx + wx - K.DRAG * k.vx, ay = sy + wy - K.DRAG * k.vy;
  if (k.x < BOUNDS.x0) ax += (BOUNDS.x0 - k.x) * 30;
  if (k.x > BOUNDS.x1) ax -= (k.x - BOUNDS.x1) * 30;
  if (k.y < BOUNDS.y0) ay += (BOUNDS.y0 - k.y) * 30;
  if (k.y > BOUNDS.y1) ay -= (k.y - BOUNDS.y1) * 30;
  k.vx += ax * dt; k.vy += ay * dt;
  k.x += k.vx * dt; k.y += k.vy * dt;
  // ---- the string holds the kite
  let rx = k.x - a.x, ry = k.y - a.y, d = Math.hypot(rx, ry) || 1;
  rx /= d; ry /= d;
  const aOut = Math.max(0, ax * rx + ay * ry);
  let Tt;
  if (d >= k.L - 12) {
    if (d >= k.L) { k.x = a.x + rx * k.L; k.y = a.y + ry * k.L; d = k.L; }
    const vr = k.vx * rx + k.vy * ry;
    if (d >= k.L - 0.01 && vr > 0) { k.vx -= vr * rx; k.vy -= vr * ry; }
    Tt = clamp(0.25 + 0.4 * wind + aOut / 1000, 0, 1.5) + (k.mode === 1 && !k.lock ? 0.35 : 0);
  } else {
    Tt = (0.05 + 0.15 * wind) * (d / k.L) + (k.mode === 1 && !k.lock ? 0.25 : 0);
  }
  k.d = d;
  k.T += (Tt - k.T) * Math.min(1, dt / 0.15);
  const lean = clamp(k.vx * 0.0016 + dir * 0.12 * wind, -0.8, 0.8);
  k.ang += (lean - k.ang) * Math.min(1, dt * 6);
}

function stepFree(w, k, dt, wind) {
  const dir = w.wind.dir;
  k.vx += (dir * K.WIND_X * 1.1 * wind - k.vx * 0.9) * dt;
  k.vy += (K.GRAV * 0.55 - K.LIFT * 0.35 * wind - k.vy * 1.3) * dt;
  k.x += k.vx * dt; k.y += k.vy * dt;
  k.spin += (dir * 4 + Math.sin(w.t * 3 + k.ph) * 3) * dt;
  k.ang = Math.sin(k.spin) * 1.1;
  k.T = 0;
}

// advances the world by dt. Returns nothing; events are pushed to w.ev for the caller to drain.
export function stepWorld(w, dt) {
  w.t += dt;
  const wind = windAt(w.wind, w.t);
  w.wnow = wind;
  const [a, b] = w.k;
  for (const k of w.k) { if (k.free) stepFree(w, k, dt, wind); else stepKite(w, k, dt, wind); }
  if (w.sever) {
    const s = w.sever; s.t += dt;
    s.vy += 420 * dt; s.vx += w.wind.dir * 90 * wind * dt; s.px += s.vx * dt; s.py += s.vy * dt;
    s.py = Math.min(s.py, 1180);
  }
  if (w.over) return;
  // ---- strings that cross wear each other
  w.contact = null;
  if (w.t >= K.ARM && !a.free && !b.free) {
    const c = findCrossing(w);
    if (c) {
      const va = [a.vx * c.uA, a.vy * c.uA], vb = [b.vx * c.uB, b.vy * c.uB];
      const rv = Math.hypot(va[0] - vb[0], va[1] - vb[1]);
      const slide = (K.CUT_BASE_SLIDE + rv) / K.CUT_SLIDE_REF;
      const dmgB = K.CUT_K * pressureOf(a) * (0.25 + 0.75 * clamp(b.T, 0, 1.2)) * slide * dt;
      const dmgA = K.CUT_K * pressureOf(b) * (0.25 + 0.75 * clamp(a.T, 0, 1.2)) * slide * dt;
      b.integ -= dmgB; a.integ -= dmgA; w.dmg[1] += dmgB; w.dmg[0] += dmgA;
      w.contact = { ...c, rate: [dmgA / dt, dmgB / dt], slide: rv };
      if (w.contactT === 0) w.ev.push({ t: 'cross', x: c.x, y: c.y });
      w.contactT += dt;
    } else w.contactT = 0;
  } else w.contactT = 0;
  // ---- strain: pulling hard into a gust
  for (const k of w.k) {
    if (k.free || w.t < K.ARM) continue;
    if (k.T > K.STRAIN_AT) { const s = (k.T - K.STRAIN_AT) * K.STRAIN_K * dt; k.integ -= s; k.strain = Math.min(1, k.strain + dt * 4); w.dmg[k.side] += s; } else k.strain = Math.max(0, k.strain - dt * 3);
  }
  for (const k of w.k) w.minInteg[k.side] = Math.min(w.minInteg[k.side], Math.max(0, k.integ));
  // ---- the string parts
  if (a.integ <= 0 || b.integ <= 0) {
    const loser = a.integ <= 0 && b.integ <= 0 ? (a.integ < b.integ ? 0 : 1) : a.integ <= 0 ? 0 : 1;
    cutString(w, loser, w.contact);
  } else if (w.t >= K.ROUND_TIME) {
    const diff = a.integ - b.integ;
    const loser = Math.abs(diff) > 1.5 ? (diff < 0 ? 0 : 1) : a.y === b.y ? 0 : a.y > b.y ? 0 : 1;
    cutString(w, loser, null, 'time');
  }
}

function cutString(w, loser, contact, why = 'cut') {
  const k = w.k[loser];
  const a = ANCHOR[loser];
  let x, y;
  if (contact) { const u = loser === 0 ? contact.uA : contact.uB; x = contact.x; y = contact.y; w.cutU = u; } else { x = (a.x + k.x) / 2; y = (a.y + k.y) / 2; w.cutU = 0.5; }
  k.free = true; k.integ = Math.max(k.integ, 0); k.vx *= 0.6;
  k.spin = 0;
  w.sever = { side: loser, px: x, py: y, vx: 0, vy: -60, t: 0 };
  w.over = { winner: 1 - loser, loser, why, t: w.t, x, y };
  w.slow = K.SLOWMO_T;
  w.ev.push({ t: 'cut', side: loser, x, y, why });
}

export const tensionBand = (T) => (T < 0.35 ? 'slack' : T < 0.75 ? 'taut' : T < K.STRAIN_AT ? 'hard' : 'strain');

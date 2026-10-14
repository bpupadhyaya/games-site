// Pitch Pot engine: pure, deterministic, no DOM. Units are centimetres and seconds; the world is one vertical plane.
// An arrow is a rigid rod (tip + tail) thrown from the hand, flying tip-first under gravity, and bouncing, sliding and settling against the
// bronze vase (walls, flared lip, two ear tubes), the floor and the arrows already lying there. resolveThrow() runs the whole flight at once
// and returns a track the view plays back; everything is seeded, so the same throw always gives the same result.

export const G = 981;
export const ARROW = { L: 38, hl: 19, r: 0.45, e: 0.28, mu: 0.5 };
export const HAND = { x: 0, y: 108 };
export const FLOOR_Y = 0;
export const ARROWS_EACH = 4;
export const POINTS = { mouth: 2, bounce: 3, ear: 5, sweep: 3 };
export const DISTANCES = [
  { name: 'Near', d: 180, note: '1.8 m' },
  { name: 'Standard', d: 240, note: '2.4 m' },
  { name: 'Far', d: 300, note: '3.0 m' },
];
export const STYLES = [
  { id: 'count', name: 'Court count', note: 'A set number of rounds, highest total wins' },
  { id: 'race', name: 'Tally race', note: 'First side to the target wins' },
];
export const LENGTHS = { count: [2, 4, 6], race: [10, 16, 24] };
export const LENGTH_NAMES = ['Short', 'Standard', 'Long'];
export const MAX_EXTRA_ROUNDS = 3;
export const AIM = { aMin: 18, aMax: 86, vMin: 300, vMax: 980, pMin: 90, pMax: 330 };
// Execution scatter: degrees of launch angle and percent of launch speed (one standard deviation).
export const HUMAN_SIGMA = { a: 0.85, v: 1.05 };
export const LEVELS = [
  { name: 'Novice', note: 'Learning the throw', sig: { a: 2.6, v: 3.4 }, quality: 0, samples: 3, think: [1.2, 2.0] },
  { name: 'Scholar', note: 'Steady and careful', sig: { a: 1.5, v: 1.9 }, quality: 1, samples: 4, think: [1.6, 2.6] },
  { name: 'Courtier', note: 'Plays the percentages', sig: { a: 0.9, v: 1.15 }, quality: 2, samples: 5, think: [1.8, 3.0] },
  { name: 'Master', note: 'Calm, exact, rarely rattled', sig: { a: 0.55, v: 0.75 }, quality: 3, samples: 6, think: [2.2, 3.4] },
];

// ---- the vase ----------------------------------------------------------------------------------------------------------------------
// Outer radius by height (y from the foot, cm). The wall is 0.8 cm thick. The neck is narrow, the lip flares like a funnel.
export const VASE_PROFILE = [[0, 6.0], [1.2, 6.4], [3, 7.9], [7, 10.2], [12, 11.6], [17, 11.0], [21, 9.4], [25, 6.6], [28, 5.0], [32, 4.5], [36, 4.5], [39.5, 4.8], [42, 5.4]];
export const WALL = 0.8;
export const RIM_Y = 42;
export const FLOOR_IN = 1.2;
export const EAR = { yLow: 27, yTop: 36.5, outer: 7.4, mid: 31.7 };
const rOuterAt = (y) => {
  const p = VASE_PROFILE;
  if (y <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) if (y <= p[i][0]) { const f = (y - p[i - 1][0]) / (p[i][0] - p[i - 1][0]); return p[i - 1][1] + f * (p[i][1] - p[i - 1][1]); }
  return p[p.length - 1][1];
};
export const vaseOuterR = rOuterAt;
export const vaseInnerR = (y) => rOuterAt(y) - WALL;
export const MOUTH_R = vaseInnerR(RIM_Y);
export const NECK_R = vaseInnerR(34);

const segCache = new Map();
function vaseSegments(D) {
  if (segCache.has(D)) return segCache.get(D);
  const out = [], P = VASE_PROFILE, rs = 0.32;
  for (const sx of [-1, 1]) {
    for (let i = 1; i < P.length; i++) out.push([D + sx * P[i - 1][1], P[i - 1][0], D + sx * P[i][1], P[i][0], rs]);
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i];
      if (b[0] < FLOOR_IN) continue;
      const ya = Math.max(a[0], FLOOR_IN), ra = rOuterAt(ya) - WALL;
      out.push([D + sx * ra, ya, D + sx * (b[1] - WALL), b[0], rs]);
    }
    out.push([D + sx * (P[P.length - 1][1] - WALL), RIM_Y, D + sx * P[P.length - 1][1], RIM_Y, rs]);
    // the ear tube: a wall standing off the neck, closed at the bottom
    const eIn = rOuterAt(EAR.yLow);
    out.push([D + sx * EAR.outer, EAR.yLow, D + sx * EAR.outer, EAR.yTop, 0.4]);
    out.push([D + sx * eIn, EAR.yLow, D + sx * EAR.outer, EAR.yLow, 0.4]);
  }
  out.push([D - (rOuterAt(FLOOR_IN) - WALL), FLOOR_IN, D + (rOuterAt(FLOOR_IN) - WALL), FLOOR_IN, rs]);
  segCache.set(D, out);
  return out;
}
const VASE_BOX = { x0: -EAR.outer - 2, x1: EAR.outer + 2, y0: -1, y1: RIM_Y + 3 };

// ---- geometry helpers -----------------------------------------------------------------------------------------------------------
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// Closest points between segments P1-Q1 and P2-Q2 (Ericson). Returns [dist2, x1, y1, x2, y2].
function segSeg(p1x, p1y, q1x, q1y, p2x, p2y, q2x, q2y) {
  const d1x = q1x - p1x, d1y = q1y - p1y, d2x = q2x - p2x, d2y = q2y - p2y, rx = p1x - p2x, ry = p1y - p2y;
  const a = d1x * d1x + d1y * d1y, e = d2x * d2x + d2y * d2y, f = d2x * rx + d2y * ry;
  let s, t;
  if (a < 1e-9 && e < 1e-9) { s = 0; t = 0; }
  else if (a < 1e-9) { s = 0; t = clamp(f / e, 0, 1); }
  else {
    const c = d1x * rx + d1y * ry;
    if (e < 1e-9) { t = 0; s = clamp(-c / a, 0, 1); }
    else {
      const b = d1x * d2x + d1y * d2y, den = a * e - b * b;
      s = den > 1e-9 ? clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }
  const x1 = p1x + d1x * s, y1 = p1y + d1y * s, x2 = p2x + d2x * t, y2 = p2y + d2y * t;
  return [(x1 - x2) ** 2 + (y1 - y2) ** 2, x1, y1, x2, y2];
}

// Is point (x, y) inside the vase cavity (neck + chamber) of a vase standing at D?
export function inCavity(D, x, y) {
  if (y < FLOOR_IN || y > RIM_Y + 0.001) return false;
  return Math.abs(x - D) < vaseInnerR(y) + 0.05;
}
export function inEar(D, x, y) {
  if (y < EAR.yLow + 0.2 || y > EAR.yTop) return 0;
  const dx = x - D, ax = Math.abs(dx);
  if (ax > rOuterAt(y) + 0.1 && ax < EAR.outer - 0.2) return dx < 0 ? -1 : 1;
  return 0;
}

// ---- the board: arrows lying where they stopped -----------------------------------------------------------------------------------
export const newBoard = () => ({ arrows: [] });
const arrowSeg = (a) => [a.x - Math.cos(a.th) * ARROW.hl, a.y - Math.sin(a.th) * ARROW.hl, a.x + Math.cos(a.th) * ARROW.hl, a.y + Math.sin(a.th) * ARROW.hl, ARROW.r];
export const tipOf = (a) => ({ x: a.x + Math.cos(a.th) * ARROW.hl, y: a.y + Math.sin(a.th) * ARROW.hl });
export const tailOf = (a) => ({ x: a.x - Math.cos(a.th) * ARROW.hl, y: a.y - Math.sin(a.th) * ARROW.hl });

function rng32(seed) {
  let s = (seed | 0) || 1;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gauss = (r) => { const u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

// ---- one flight --------------------------------------------------------------------------------------------------------------------
// Core integrator. Returns { track: [[x, y, th], ...] at 60 Hz, contacts, end, entered, touched, dur }.
function fly(board, D, aDeg, v, wantTrack) {
  const segs = vaseSegments(D).slice();
  const resting = board.arrows;
  for (const a of resting) segs.push(arrowSeg(a));
  // static boxes for the broadphase
  const bx0 = D + VASE_BOX.x0, bx1 = D + VASE_BOX.x1;
  let minX = bx0, maxX = bx1;
  for (const a of resting) { const s = arrowSeg(a); minX = Math.min(minX, s[0], s[2]) - 0; maxX = Math.max(maxX, s[0], s[2]); }
  minX -= 3; maxX += 3;
  const al = (aDeg * Math.PI) / 180;
  const m = 1, I = (m * ARROW.L * ARROW.L) / 12, hl = ARROW.hl;
  let th = al, x = HAND.x + Math.cos(al) * hl, y = HAND.y + Math.sin(al) * hl, vx = v * Math.cos(al), vy = v * Math.sin(al), w = 0;
  const track = wantTrack ? [[x, y, th]] : null;
  const contacts = [];
  let t = 0, sampleAt = 1 / 60, calm = 0, entered = -1, touched = false, touchBefore = false, lastC = -1, tipLowest = 1e9, ended = false;
  const T_MAX = 9;
  while (t < T_MAX && !ended) {
    const c = Math.cos(th), s = Math.sin(th);
    const tx = x + c * hl, ty = y + s * hl, ux = x - c * hl, uy = y - s * hl;
    const lowY = Math.min(ty, uy), hiY = Math.max(ty, uy), loX = Math.min(tx, ux), hiX = Math.max(tx, ux);
    const near = lowY < 6 || (hiX > minX - 2 && loX < maxX + 2 && lowY < RIM_Y + 8 && hiY > -2 && lowY < RIM_Y + 24 && hiX > minX - 2);
    const dt = near ? 1 / 960 : 1 / 240;
    // free flight: gravity, then the fletching keeps the tip into the wind
    vy -= G * dt;
    if (lastC < 0 || t - lastC > 0.012) {
      const sp = Math.hypot(vx, vy);
      if (sp > 50) { let err = Math.atan2(vy, vx) - th; err = Math.atan2(Math.sin(err), Math.cos(err)); w += (900 * err - 60 * w) * dt; }
    }
    x += vx * dt; y += vy * dt; th += w * dt;
    t += dt;
    if (near) {
      let any = false;
      for (let it = 0; it < 2; it++) {
        const c2 = Math.cos(th), s2 = Math.sin(th);
        const ax = x - c2 * hl, ay = y - s2 * hl, bx = x + c2 * hl, by = y + s2 * hl;
        for (let k = 0; k < segs.length; k++) {
          const sg = segs[k];
          if (Math.max(sg[0], sg[2]) + 2 < Math.min(ax, bx) || Math.min(sg[0], sg[2]) - 2 > Math.max(ax, bx)) continue;
          if (Math.max(sg[1], sg[3]) + 2 < Math.min(ay, by) || Math.min(sg[1], sg[3]) - 2 > Math.max(ay, by)) continue;
          const [d2, p1x, p1y, p2x, p2y] = segSeg(ax, ay, bx, by, sg[0], sg[1], sg[2], sg[3]);
          const R = ARROW.r + sg[4];
          if (d2 >= R * R) continue;
          let d = Math.sqrt(d2), nx, ny;
          if (d > 1e-5) { nx = (p1x - p2x) / d; ny = (p1y - p2y) / d; }
          else { const ex = sg[2] - sg[0], ey = sg[3] - sg[1], el = Math.hypot(ex, ey) || 1; nx = -ey / el; ny = ex / el; if (nx * (x - p2x) + ny * (y - p2y) < 0) { nx = -nx; ny = -ny; } d = 0; }
          any = true;
          // position correction along the normal
          const pen = R - d;
          x += nx * pen * 0.9; y += ny * pen * 0.9;
          const rx = p1x - x, ry = p1y - y;
          const vcx = vx - w * ry, vcy = vy + w * rx;
          const vn = vcx * nx + vcy * ny;
          if (vn < 0) {
            const e = vn < -40 ? ARROW.e : 0;
            const rn = rx * ny - ry * nx;
            const jn = (-(1 + e) * vn) / (1 / m + (rn * rn) / I);
            vx += (jn * nx) / m; vy += (jn * ny) / m; w += (jn * rn) / I;
            // friction along the tangent
            const tx2 = -ny, ty2 = nx;
            const vcx2 = vx - w * ry, vcy2 = vy + w * rx, vt = vcx2 * tx2 + vcy2 * ty2;
            const rt = rx * ty2 - ry * tx2;
            let jt = -vt / (1 / m + (rt * rt) / I);
            jt = clamp(jt, -ARROW.mu * jn, ARROW.mu * jn);
            vx += (jt * tx2) / m; vy += (jt * ty2) / m; w += (jt * rt) / I;
            if (jn > 25 && (contacts.length === 0 || t - contacts[contacts.length - 1].t > 0.07)) {
              const kind = k >= segs.length - resting.length ? 'arrow' : k >= vaseSegments(D).length ? 'arrow' : sg[1] === 0 && sg[3] === 0 ? 'floor' : 'bronze';
              contacts.push({ t, kind, force: Math.min(1, jn / 260), x: p1x, y: p1y });
            }
          }
          if (entered < 0) { touchBefore = true; }
          touched = true;
        }
        // the floor
        const lo = [[ax, ay], [bx, by]];
        for (const [px, py] of lo) {
          if (py < ARROW.r) {
            any = true; if (entered < 0) touchBefore = true;
            const pen = ARROW.r - py; y += pen * 0.9;
            const rx = px - x, ry = py - y;
            const vcx = vx - w * ry, vcy = vy + w * rx;
            if (vcy < 0) {
              const e = vcy < -40 ? ARROW.e : 0, rn = rx;   // normal (0,1): r x n = rx
              const jn = (-(1 + e) * vcy) / (1 / m + (rn * rn) / I);
              vy += jn / m; w += (jn * rn) / I;
              const vcx2 = vx - w * ry, jt = clamp(-vcx2 / (1 / m + (ry * ry) / I), -ARROW.mu * jn, ARROW.mu * jn);
              vx += jt / m; w += (jt * -ry) / I;
              if (jn > 20 && (contacts.length === 0 || t - contacts[contacts.length - 1].t > 0.07)) contacts.push({ t, kind: 'floor', force: Math.min(1, jn / 260), x: px, y: 0 });
            }
          }
        }
      }
      if (any) lastC = t;
    }
    // the tip going below the rim, inside the mouth, for the first time
    const c3 = Math.cos(th), s3 = Math.sin(th), tipx = x + c3 * hl, tipy = y + s3 * hl;
    if (entered < 0 && tipy < RIM_Y - 0.5 && tipy > RIM_Y - 12 && Math.abs(tipx - D) < vaseInnerR(Math.max(tipy, FLOOR_IN)) + 0.1) entered = t;
    tipLowest = Math.min(tipLowest, tipy);
    // sampling
    if (wantTrack && t >= sampleAt) { track.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round(th * 1000) / 1000]); sampleAt += 1 / 60; }
    // settled? speeds near zero while touching something for a quarter of a second
    if (lastC >= 0 && t - lastC < 0.02 && Math.abs(vx) < 4 && Math.abs(vy) < 4 && Math.abs(w) < 0.6) { calm += dt; if (calm > 0.25) ended = true; } else calm = 0;
    // flown far past anything: stop
    if (x > D + 260 || x < -300 || (y < -5 && vy < 0)) ended = true;
    if (y < 0.1 && Math.abs(vy) < 8 && Math.abs(vx) < 8 && Math.abs(w) < 1) { calm += dt; if (calm > 0.25) ended = true; }
  }
  if (wantTrack) track.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round(th * 1000) / 1000]);
  return { track, contacts, end: { x, y, th }, entered, touched, touchBefore, dur: t, tipLowest };
}

function classify(D, end) {
  const tip = { x: end.x + Math.cos(end.th) * ARROW.hl, y: end.y + Math.sin(end.th) * ARROW.hl };
  const tail = { x: end.x - Math.cos(end.th) * ARROW.hl, y: end.y - Math.sin(end.th) * ARROW.hl };
  // the lower end that rests in the pot counts; arrows fly tip-first but may land either way up
  const pts = [tip, tail];
  for (const p of pts) if (inCavity(D, p.x, p.y)) return { status: 'mouth', end: p === tip ? 'tip' : 'tail' };
  for (const p of pts) { const e = inEar(D, p.x, p.y); if (e) return { status: 'ear', side: e }; }
  return { status: 'miss' };
}

// resolveThrow: the whole throw with human or computer scatter. aim = { a: degrees, v: cm/s }, sig = { a: degrees, v: percent }.
export function resolveThrow(board, D, side, aim, sig, seed, wantTrack = true) {
  const r = rng32(seed);
  const a = clamp(aim.a + gauss(r) * sig.a, 5, 89), v = Math.max(80, aim.v * (1 + (gauss(r) * sig.v) / 100));
  const f = fly(board, D, a, v, wantTrack);
  const cls = classify(D, f.end);
  let points = 0, kind = 'miss';
  const bounce = f.touchBefore;
  if (cls.status === 'ear') { points = POINTS.ear; kind = 'ear'; }
  else if (cls.status === 'mouth') { points = bounce ? POINTS.bounce : POINTS.mouth; kind = bounce ? 'bounce' : 'mouth'; }
  return { side, a, v, track: f.track, contacts: f.contacts, end: f.end, status: cls.status, kind, points, bounce, entered: f.entered, dur: f.dur, tipLowest: f.tipLowest };
}
export function applyThrow(board, res) {
  board.arrows.push({ x: res.end.x, y: res.end.y, th: res.end.th, side: res.side, kind: res.kind });
}
// Round bonus: a side that put every arrow of the round in the pot (mouth or ear) gets a sweep.
export const sweepSides = (stats) => [0, 1].filter((s) => stats.inPot[s] >= ARROWS_EACH);

// ---- aiming -------------------------------------------------------------------------------------------------------------------------
// COM path of a throw (no obstacles): used by the aim guide and by the planner.
export function pathPoint(a, v, t) {
  const al = (a * Math.PI) / 180, hl = ARROW.hl;
  const x0 = HAND.x + Math.cos(al) * hl, y0 = HAND.y + Math.sin(al) * hl;
  return { x: x0 + v * Math.cos(al) * t, y: y0 + v * Math.sin(al) * t - 0.5 * G * t * t };
}
// The guide: where the arrow tip goes, as points, until it is past the vase or on the floor.
export function guidePath(a, v, D, step = 0.03, maxT = 3) {
  const out = [];
  for (let t = 0; t <= maxT; t += step) {
    const p = pathPoint(a, v, t), vx = v * Math.cos((a * Math.PI) / 180), vy = v * Math.sin((a * Math.PI) / 180) - G * t, sp = Math.hypot(vx, vy) || 1;
    const tip = { x: p.x + (vx / sp) * ARROW.hl, y: p.y + (vy / sp) * ARROW.hl };
    out.push({ t, x: p.x, y: p.y, tx: tip.x, ty: tip.y });
    if (tip.y < 0 || tip.x > D + 60) break;
  }
  return out;
}
// Launch speed so the arrow TIP passes the point (tx, ty) falling, at launch angle a. Returns null when out of range.
export function solveSpeed(a, tx, ty) {
  const al = (a * Math.PI) / 180, ca = Math.cos(al), sa = Math.sin(al);
  let px = tx - 12, py = ty + 14;   // first guess for the centre of the arrow when its tip is at (tx, ty)
  let v = null;
  for (let it = 0; it < 4; it++) {
    const X = px - HAND.x - ca * ARROW.hl, Y = py - HAND.y - sa * ARROW.hl;
    const den = 2 * ca * ca * (X * (sa / ca) - Y);
    if (den <= 1e-6 || X <= 10) return null;
    v = Math.sqrt((G * X * X) / den);
    const t = X / (v * ca), vx = v * ca, vy = v * sa - G * t, sp = Math.hypot(vx, vy);
    px = tx - (vx / sp) * ARROW.hl; py = ty - (vy / sp) * ARROW.hl;
  }
  return v;
}
const cand = (a, tx, ty, label) => { const v = solveSpeed(a, tx, ty); return v && v >= AIM.vMin && v <= AIM.vMax * 1.05 ? { a, v, label, tx, ty } : null; };

// Pick a throw: build candidates (mouth with a little offset, ears), score each by simulated throws under the thrower's scatter.
export function chooseThrow(board, D, sig, seed, o = {}) {
  const quality = o.quality ?? 1, samples = o.samples ?? 4, list = [];
  const angles = quality >= 2 ? [52, 56, 60, 64, 68, 72, 76, 80] : [56, 62, 68, 74, 80];
  for (const a of angles) for (const off of quality >= 2 ? [-1.4, 0, 1.4] : [0]) { const c = cand(a, D + off, RIM_Y + 1.5, 'mouth'); if (c) list.push(c); }
  if (quality >= 1) {
    for (const a of [72, 78, 84]) for (const sx of [-1, 1]) { const c = cand(a, D + sx * (EAR.outer - 1.6), EAR.yTop + 1.5, 'ear'); if (c) list.push(c); }
  }
  if (!list.length) list.push({ a: 66, v: solveSpeed(66, D, RIM_Y) || 600, label: 'mouth' });
  const r = rng32(seed);
  const evalOne = (c, n, k0) => {
    let pts = 0, mouth = 0, ear = 0, bounce = 0;
    for (let i = 0; i < n; i++) {
      const res = resolveThrow(board, D, 0, c, sig, ((r() * 1e9) | 0) + k0 + i, false);
      pts += res.points;
      if (res.kind === 'mouth') mouth++; else if (res.kind === 'bounce') bounce++; else if (res.kind === 'ear') ear++;
    }
    return { pts, mouth, bounce, ear, n };
  };
  const first = list.map((c) => ({ ...c, ...(() => { const e = evalOne(c, 2, 1); return { s1: e }; })() }));
  first.sort((p, q) => q.s1.pts - p.s1.pts || p.a - q.a);
  const keep = first.slice(0, quality >= 2 ? 6 : 4);
  const total = keep.map((c) => { const e = evalOne(c, samples, 100); const n = c.s1.n + e.n; return { a: c.a, v: c.v, label: c.label, tx: c.tx, ty: c.ty, n, expected: (c.s1.pts + e.pts) / n, mouth: c.s1.mouth + e.mouth, bounce: c.s1.bounce + e.bounce, ear: c.s1.ear + e.ear }; });
  total.sort((p, q) => q.expected - p.expected || p.a - q.a);
  // a little human fallibility at low quality: sometimes take the second choice
  let pick = total[0];
  if (quality <= 1 && total.length > 1 && r() < (quality === 0 ? 0.35 : 0.12)) pick = total[1];
  return { best: pick, top: total.slice(0, 4) };
}
export function explain(c) {
  const kinds = c.label === 'ear' ? 'aimed at an ear' : 'aimed at the mouth';
  const pct = (k) => Math.round((100 * k) / Math.max(1, c.n));
  const inPot = pct(c.mouth + c.bounce + c.ear);
  return `${kinds[0].toUpperCase()}${kinds.slice(1)}, launch ${Math.round(c.a)} degrees. In ${c.n} test throws: ${inPot}% finished in the pot, ${pct(c.bounce)}% as bounce-ins${c.ear ? `, ${pct(c.ear)}% in an ear` : ''}. About ${c.expected.toFixed(1)} points per arrow.`;
}
// Launch vector <-> controls: the thumb slides a "pull" vector (power units); speed grows linearly with its length.
export const pullToAim = (px, py) => {
  const len = Math.hypot(px, py);
  const a = clamp((Math.atan2(py, Math.max(px, 0.0001)) * 180) / Math.PI, AIM.aMin, AIM.aMax);
  const p = clamp(len, AIM.pMin, AIM.pMax);
  return { a, v: AIM.vMin + ((AIM.vMax - AIM.vMin) * (p - AIM.pMin)) / (AIM.pMax - AIM.pMin), p };
};
export const aimToPull = (a, v) => {
  const p = AIM.pMin + ((v - AIM.vMin) * (AIM.pMax - AIM.pMin)) / (AIM.vMax - AIM.vMin);
  const al = (a * Math.PI) / 180;
  return { px: Math.cos(al) * p, py: Math.sin(al) * p };
};
// Where the arrow tip crosses the rim height on its way down for a throw (a, v), or null if it never does. Used by the aim guide.
export function rimCrossing(a, v, D) {
  const g = guidePath(a, v, D, 0.01, 4);
  let apex = false;
  for (let i = 1; i < g.length; i++) {
    if (g[i].ty < g[i - 1].ty) apex = true;
    if (apex && g[i - 1].ty >= RIM_Y && g[i].ty < RIM_Y) { const f = (g[i - 1].ty - RIM_Y) / (g[i - 1].ty - g[i].ty); return g[i - 1].tx + f * (g[i].tx - g[i - 1].tx); }
  }
  return null;
}
// Spread of the rim crossing for a scatter sig = { a, v }: one standard deviation in cm, or null.
export function crossingSpread(a, v, D, sig) {
  const x0 = rimCrossing(a, v, D);
  if (x0 === null) return null;
  const da = rimCrossing(a + sig.a, v, D), dv = rimCrossing(a, v * (1 + sig.v / 100), D);
  if (da === null || dv === null) return { x: x0, sd: 8 };
  return { x: x0, sd: Math.hypot(da - x0, dv - x0) };
}

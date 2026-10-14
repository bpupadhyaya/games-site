// The Kottabos engine: pure, seeded, no DOM. Units are centimetres and seconds, y is up, the cup leaves the hand at HAND.
// A flick launches NDROP drops 18 ms apart. Every drop is an exact parabola, so a whole flick is resolved at release into a
// small record (drop parameters + per-target outcomes) and played back from it. Nothing here reads a clock.
//   stands: a bronze disc balanced on a pole, a dish hung beneath it. Drops that strike the disc add angular impulse to a damped
//           rocker; enough impulse tips it off (it falls onto the dish: clang), too much flings it past (knocked off).
//   basin:  little cups floating on water. A drop that lands in a cup fills it; a cup sinks at its capacity. Cups drift slowly.
export const G = 980;
export const HAND = { x: 0, y: 34 };
export const NDROP = 10;
export const GAP = 0.018;            // seconds between drops
export const LAUNCH_DELAY = 0.05;    // the snap of the wrist before the first drop leaves
export const DROP_R = 0.9;
export const AIM = { aMin: 14, aMax: 84, vMin: 300, vMax: 760 };
export const SWIPE = { min: 24, lo: 60, hi: 380 };       // units of finger travel: below min a touch is not a flick; lo..hi maps to power
export const SNAP = { slow: 400, fast: 1350 };           // finger speed (units/s) for a lazy slide / a clean snap
export const POINTS = { clang: 10, off: 5, wobble: 1, bowl: 5, multi: 2, clear: 10, spare: 2 };
export const POLE_R = 1.4;
export const DISC_T = 3.2;           // disc thickness
export const MANES_DROP = 22;        // the dish hangs this far below the disc's support
export const MANES_T = 1.6;
export const DISC = { phiC: 0.33, wn: 13, zeta: 0.05, kappa: 1.5e-3, armK: 0.55, slideU: 6 };
export const BASIN = { water: 12, cupH: 4.2, halfW: 52 };
export const MAX_EXTRA = 3;
export const ROUND_KINDS = ['stands', 'basin'];

export const DISTANCES = [
  { name: 'Close', note: 'about 1.6 m', mul: 0.82 },
  { name: 'Standard', note: 'about 2.0 m', mul: 1 },
  { name: 'Far', note: 'about 2.5 m', mul: 1.2 },
];
export const LENGTHS = [3, 5, 7];
export const LENGTH_NAMES = ['Short', 'Standard', 'Long'];
export const LEVELS = [
  { name: 'Novice', note: 'Loose wrist, often sprays', c: 0.52, ta: 1.3, tv: 2.4, samples: 3, quality: 0, think: [2.0, 3.2] },
  { name: 'Guest', note: 'Steady, sometimes careless', c: 0.72, ta: 0.8, tv: 1.5, samples: 4, quality: 1, think: [2.4, 3.6] },
  { name: 'Poet', note: 'Clean snaps, weighs the rim', c: 0.86, ta: 0.5, tv: 1.0, samples: 6, quality: 2, think: [2.6, 4.0] },
  { name: 'Champion', note: 'Tight stream, tests every plan', c: 0.95, ta: 0.32, tv: 0.65, samples: 8, quality: 3, think: [2.8, 4.4] },
];
export const HUMAN = { ta: 0.4, tv: 0.7 };      // everyone's hand shakes a little

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rad = (d) => (d * Math.PI) / 180;

// ---- seeded randomness (own stream, so a resolved flick never shifts the game's rng) ------------------------------------------
export function stream(seed) {
  let s = (seed >>> 0) || 1;
  const next = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => { const u = Math.max(1e-9, next()), v = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  return { next, gauss };
}

// ---- finger -> flick ----------------------------------------------------------------------------------------------------------
// dx, dy: finger travel from the press to the lift in screen units (dy negative = up). speed: units per second at the lift.
export function swipeToAim(dx, dy) {
  const L = Math.hypot(dx, dy);
  const ang = clamp((Math.atan2(-dy, Math.max(dx, 0.0001)) * 180) / Math.PI, AIM.aMin, AIM.aMax);
  const v = lerp(AIM.vMin, AIM.vMax, clamp((L - SWIPE.lo) / (SWIPE.hi - SWIPE.lo), 0, 1));
  return { a: ang, v };
}
export function aimToSwipe(a, v) {
  const L = SWIPE.lo + ((v - AIM.vMin) / (AIM.vMax - AIM.vMin)) * (SWIPE.hi - SWIPE.lo), r = rad(a);
  return { dx: Math.cos(r) * L, dy: -Math.sin(r) * L, L };
}
export const cohesionOf = (speed) => sstep(SNAP.slow, SNAP.fast, speed);
// angular spread (degrees) and relative speed spread (percent) of the ten drops for a cohesion c
export const spreadOf = (c) => ({ sa: lerp(6.2, 0.5, c), sv: lerp(7.5, 0.7, c) });

// ---- scenes -------------------------------------------------------------------------------------------------------------------
// stand: { x, h, r, rm }   h = height of the disc's support, r = disc radius, rm = dish radius
// bowl:  { off, w, cap, amp, per, ph }
export const bowlX = (sc, b, t) => sc.basin.x + b.off + b.amp * Math.sin((2 * Math.PI * t) / b.per + b.ph);

const stand = (x, h, r, rm) => ({ x, h, r, rm });
const bowl = (off, w, cap, amp = 0, per = 5, ph = 0) => ({ off, w, cap, amp, per, ph });
const mkStands = (list, flicks = 5, name = '') => ({ kind: 'stands', name, flicks, stands: list, D: Math.max(...list.map((s) => s.x)), maxX: Math.max(...list.map((s) => s.x)) + 24, maxY: Math.max(...list.map((s) => s.h)) + 30 });
const mkBasin = (x, bowls, flicks = 5, name = '') => ({ kind: 'basin', name, flicks, basin: { x, bowls }, D: x, maxX: x + BASIN.halfW + 14, maxY: 70 });

// The Symposium Ladder: twelve fixed levels, alternating stands and basins, gently harder.
export const LADDER = [
  { name: 'First flick', sc: mkStands([stand(150, 92, 16, 22)], 5), stars: [20, 30, 40] },
  { name: 'Still water', sc: mkBasin(175, [bowl(-22, 15, 3), bowl(0, 15, 3), bowl(22, 15, 3)], 5), stars: [15, 25, 40] },
  { name: 'Higher support', sc: mkStands([stand(195, 112, 14, 20)], 5), stars: [20, 30, 40] },
  { name: 'Drifting cups', sc: mkBasin(205, [bowl(-30, 13, 3, 5, 5.2, 0.4), bowl(-10, 13, 3, 5, 6, 2.2), bowl(10, 13, 3, 5, 4.7, 4.1), bowl(30, 13, 3, 5, 5.6, 1.3)], 5), stars: [20, 35, 50] },
  { name: 'Two stands', sc: mkStands([stand(150, 88, 12, 19), stand(225, 128, 12, 19)], 5), stars: [25, 40, 50] },
  { name: 'Wide drift', sc: mkBasin(235, [bowl(-30, 12, 3, 10, 5, 0.2), bowl(-10, 12, 3, 9, 6.2, 2), bowl(10, 12, 3, 10, 4.6, 3.6), bowl(30, 12, 3, 9, 5.6, 5.1)], 5), stars: [20, 35, 50] },
  { name: 'Far stand', sc: mkStands([stand(270, 150, 11, 17)], 5), stars: [20, 30, 40] },
  { name: 'Five cups', sc: mkBasin(255, [bowl(-36, 11, 4, 9, 5.3, 0), bowl(-18, 11, 4, 10, 6.1, 1.4), bowl(0, 11, 4, 9, 4.8, 2.9), bowl(18, 11, 4, 11, 5.7, 4.2), bowl(36, 11, 4, 9, 6.4, 5.5)], 5), stars: [25, 40, 60] },
  { name: 'Three stands', sc: mkStands([stand(140, 74, 10, 16), stand(205, 122, 10, 16), stand(270, 170, 10, 16)], 5), stars: [30, 45, 60] },
  { name: 'Swift cups', sc: mkBasin(275, [bowl(-40, 10, 4, 12, 4.2, 0.3), bowl(-24, 10, 4, 12, 5.1, 1.8), bowl(-8, 10, 4, 12, 4.5, 3.2), bowl(8, 10, 4, 13, 5.6, 4.4), bowl(24, 10, 4, 12, 4.9, 5.9), bowl(40, 10, 4, 12, 5.3, 0.9)], 5), stars: [30, 50, 70] },
  { name: 'Distant disc', sc: mkStands([stand(305, 165, 9, 15)], 5), stars: [20, 30, 40] },
  { name: 'Grand symposium', sc: mkBasin(300, [bowl(-36, 9, 4, 14, 4.4, 0.2), bowl(-18, 9, 4, 14, 5.2, 1.7), bowl(0, 9, 5, 12, 4.7, 3.1), bowl(18, 9, 4, 14, 5.9, 4.5), bowl(36, 9, 4, 14, 4.9, 5.8)], 5), stars: [30, 50, 70] },
];

// A match round: difficulty rises with the round; `dist` (0..2) stretches the ranges.
export function roundScene(idx, dist = 1) {
  const kind = ROUND_KINDS[idx % 2], k = Math.min(idx, 9), mul = DISTANCES[dist].mul;
  const near = Math.round((135 + k * 12) * mul);
  if (kind === 'stands') {
    const r = Math.max(9, 15.5 - k * 0.7), rm = Math.max(14, 21 - k * 0.7);
    const n = idx >= 4 ? 2 : 1;
    const list = n === 1 ? [stand(Math.round(near * 1.15), 88 + (k % 4) * 17, r, rm)] : [stand(near, 78 + (k % 3) * 8, r, rm), stand(Math.round(near * 1.5), 120 + (k % 3) * 16, r, rm)];
    return mkStands(list, 3, `Round ${idx + 1}`);
  }
  const amp = Math.min(13, 3 + k * 1.2), w = Math.max(10, 14.5 - k * 0.45), n = idx >= 5 ? 5 : 4, bowls = [];
  for (let i = 0; i < n; i++) bowls.push(bowl((i - (n - 1) / 2) * (w + 6), w, 3 + (i === (n >> 1) && idx >= 5 ? 1 : 0), amp, 4.4 + ((i * 7 + idx * 3) % 11) * 0.2, ((i * 2.3 + idx) % 6.28)));
  return mkBasin(Math.round(near * 1.4), bowls, 4, `Round ${idx + 1}`);
}
export const suddenDeath = (dist = 1) => roundScene(0, dist);

export function newBoard(sc) {
  return sc.kind === 'basin' ? { vol: sc.basin.bowls.map(() => 0), sunk: sc.basin.bowls.map(() => false) } : { vol: [], sunk: [] };
}

// ---- geometry helpers -----------------------------------------------------------------------------------------------------------
// first entry of the segment (x0,y0)-(x1,y1) into the box; returns { t, x, y } or null
function segBox(x0, y0, x1, y1, bx0, by0, bx1, by1) {
  const dx = x1 - x0, dy = y1 - y0;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, x0 - bx0], [dx, bx1 - x0], [-dy, y0 - by0], [dy, by1 - y0]]) {
    if (Math.abs(p) < 1e-9) { if (q < 0) return null; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return { t: t0, x: x0 + dx * t0, y: y0 + dy * t0 };
}
export const standGeom = (s) => ({ ysup: s.h, disc: { x0: s.x - s.r, x1: s.x + s.r, y0: s.h, y1: s.h + DISC_T }, manesY: s.h - MANES_DROP, pole: { x0: s.x - POLE_R, x1: s.x + POLE_R } });

// ---- one flick ------------------------------------------------------------------------------------------------------------------
// aim: { a, v } degrees / cm per s.  p: { c, ta, tv }  cohesion and the shake of the hand (degrees, percent).
// t0: scene clock at release (drifting cups). seed: any integer. board: { vol, sunk } for basins (not modified here).
export function resolveFlick(sc, board, aim, p, seed, t0 = 0) {
  const rnd = stream(seed);
  const sp = spreadOf(p.c);
  const tremA = rnd.gauss() * p.ta, tremV = rnd.gauss() * p.tv;
  const drops = [], events = [];
  const stands = sc.kind === 'stands' ? sc.stands.map((s, i) => ({ i, s, g: standGeom(s), hits: [], fell: false })) : [];
  const bowls = sc.kind === 'basin' ? sc.basin.bowls.map((b, i) => ({ i, b, hits: [], sunkAt: -1, vol: board.vol[i], was: board.sunk[i] })) : [];
  const water = BASIN.water + BASIN.cupH;

  for (let k = 0; k < NDROP; k++) {
    const dA = aim.a + tremA + rnd.gauss() * sp.sa, dV = aim.v * (1 + (tremV + rnd.gauss() * sp.sv) / 100);
    const th = rad(clamp(dA, 4, 89)), vx = Math.cos(th) * dV, vy = Math.sin(th) * dV;
    drops.push({ k, t0: LAUNCH_DELAY + k * GAP, vx, vy, tEnd: 0, end: 'air', x: 0, y: 0, hit: null, size: 0.8 + rnd.next() * 0.45 });
  }
  const pos = (d, t) => { const s = t - d.t0; return [HAND.x + d.vx * s, HAND.y + d.vy * s - 0.5 * G * s * s]; };

  // pass 1: where each drop ends and what it touches first. The disc is assumed present; the rocker below decides what a late drop sees.
  const DT = 1 / 240;
  for (const d of drops) {
    let t = d.t0, [px, py] = [HAND.x, HAND.y];
    for (let n = 0; n < 1000; n++) {
      t = d.t0 + (n + 1) * DT;
      const [x, y] = pos(d, t);
      let best = null;
      for (const st of stands) {
        const g = st.g;
        const hd = segBox(px, py, x, y, g.disc.x0 - DROP_R * 0.5, g.disc.y0 - DROP_R * 0.5, g.disc.x1 + DROP_R * 0.5, g.disc.y1 + DROP_R * 0.5);
        if (hd && (!best || hd.t < best.f)) best = { f: hd.t, kind: 'disc', st, x: hd.x, y: hd.y };
        const hm = segBox(px, py, x, y, st.s.x - st.s.rm, g.manesY - MANES_T, st.s.x + st.s.rm, g.manesY);
        if (hm && (!best || hm.t < best.f)) best = { f: hm.t, kind: 'manes', st, x: hm.x, y: hm.y };
        const hp = segBox(px, py, x, y, g.pole.x0, 0, g.pole.x1, g.ysup);
        if (hp && (!best || hp.t < best.f)) best = { f: hp.t, kind: 'pole', st, x: hp.x, y: hp.y };
      }
      if (sc.kind === 'basin') {
        const tt = t0 + t;
        if (py > water && y <= water) {
          // crossing the cup mouths: the drop's x at the crossing
          const f = (py - water) / Math.max(1e-6, py - y), cx = px + (x - px) * clamp(f, 0, 1);
          let hit = -1;
          for (const b of bowls) {
            if (b.was) continue;
            if (Math.abs(cx - bowlX(sc, b.b, tt)) <= b.b.w / 2 + DROP_R * 0.4) { hit = b.i; break; }
          }
          if (hit >= 0 && (!best || f < best.f)) best = { f: clamp(f, 0, 1), kind: 'bowl', bowl: hit, x: cx, y: water };
        }
        if (!best && y <= BASIN.water && py > BASIN.water) {
          const f = (py - BASIN.water) / Math.max(1e-6, py - y);
          best = { f: clamp(f, 0, 1), kind: 'water', x: px + (x - px) * clamp(f, 0, 1), y: BASIN.water };
        }
      }
      if (!best && y <= 0) {
        const f = py / Math.max(1e-6, py - y);
        best = { f: clamp(f, 0, 1), kind: 'floor', x: px + (x - px) * clamp(f, 0, 1), y: 0 };
      }
      if (best) {
        const te = t - DT + DT * best.f;
        d.tEnd = te; d.end = best.kind; d.x = best.x; d.y = best.y; d.hit = best;
        const s = te - d.t0, vxn = d.vx, vyn = d.vy - G * s;
        d.vxEnd = vxn; d.vyEnd = vyn;
        break;
      }
      if (x > sc.maxX + 140 || t - d.t0 > 6) { d.tEnd = t; d.end = 'gone'; d.x = x; d.y = y; d.vxEnd = d.vx; d.vyEnd = d.vy - G * (t - d.t0); break; }
      px = x; py = y;
    }
    if (!d.tEnd) { d.tEnd = d.t0 + 6; d.end = 'gone'; }
  }

  // pass 2 (stands): the rocker for every disc, driven by the hits in time order
  const order = [...drops].sort((a, b) => a.tEnd - b.tEnd);
  let dur = 0.6;
  const standRes = stands.map((st) => {
    const hits = order.filter((d) => d.end === 'disc' && d.hit.st === st);
    const out = { i: st.i, hits: hits.length, theta: [], fall: null, result: 'none', points: 0, peak: 0, impulse: 0 };
    if (!hits.length) return out;
    const dt = 1 / 480, wn = DISC.wn;
    let th = 0, om = 0, hi = 0, t = hits[0].tEnd - dt;
    const tMax = hits[hits.length - 1].tEnd + 1.1;
    let step = 0;
    while (t < tMax) {
      while (hi < hits.length && hits[hi].tEnd <= t) {
        const d = hits[hi++];
        const rx = d.x - st.s.x, ry = d.y - st.g.ysup + 2.5, px = d.vxEnd, py = d.vyEnd;
        const imp = (rx * py - ry * px) * DISC.kappa * (7 / Math.max(5, st.s.r)) * 1.0;
        om += imp; out.impulse += Math.abs(imp);
      }
      // damped rocker
      om += (-wn * wn * th - 2 * DISC.zeta * wn * om) * dt;
      th += om * dt;
      t += dt;
      out.peak = Math.max(out.peak, Math.abs(th));
      if (step++ % 4 === 0) out.theta.push([t, th]);
      if (Math.abs(th) >= DISC.phiC) {
        const dir = th > 0 ? -1 : 1, u = DISC.armK * st.s.r * Math.abs(om) + DISC.slideU;
        const tau = Math.sqrt((2 * MANES_DROP) / G), off = u * tau;
        const onDish = off <= st.s.rm + st.s.r * 0.3;
        out.fall = { tf: t, dir, u, om: Math.abs(om), th0: th, land: onDish ? 'manes' : 'floor', tLand: t + (onDish ? tau : Math.sqrt((2 * st.g.ysup) / G)), xLand: st.s.x + dir * u * (onDish ? tau : Math.sqrt((2 * st.g.ysup) / G)) };
        out.result = onDish ? 'clang' : 'off';
        out.points = onDish ? POINTS.clang : POINTS.off;
        break;
      }
    }
    if (!out.fall && out.peak > 0.035) { out.result = 'wobble'; out.points = POINTS.wobble; }
    else if (!out.fall) { out.result = 'touch'; }
    if (out.fall) {
      // drops arriving after the fall pass the (empty) support: they were resolved as disc hits, treat them as pole splashes
      for (const d of hits) if (d.tEnd > out.fall.tf) { d.end = 'pole'; }
      events.push({ t: out.fall.tLand, type: out.result === 'clang' ? 'clang' : 'floor', stand: st.i, x: out.fall.xLand, y: out.result === 'clang' ? st.g.manesY : 0, force: out.result === 'clang' ? 1 : 0.7 });
      dur = Math.max(dur, out.fall.tLand + 0.7);
    } else dur = Math.max(dur, t + 0.2);
    return out;
  });

  // pass 3 (basin): fill the cups in the order the drops arrive
  const bowlRes = bowls.map((b) => ({ i: b.i, hits: 0, sunkAt: -1, vol: b.vol, sunk: false, was: b.was }));
  if (sc.kind === 'basin') {
    for (const d of order) {
      if (d.end !== 'bowl') continue;
      const br = bowlRes[d.hit.bowl];
      if (br.sunk) { d.end = 'water'; d.hit.kind = 'water'; continue; }
      br.vol++; br.hits++;
      if (br.vol >= sc.basin.bowls[br.i].cap) { br.sunk = true; br.sunkAt = d.tEnd; events.push({ t: d.tEnd + 0.05, type: 'sink', bowl: br.i, x: d.x, y: BASIN.water }); dur = Math.max(dur, d.tEnd + 1.1); }
    }
  }
  for (const d of drops) {
    dur = Math.max(dur, d.tEnd + 0.25);
    const kind = d.end === 'disc' ? 'hit' : d.end === 'manes' ? 'ting' : d.end === 'pole' ? 'pole' : d.end === 'bowl' ? 'plink' : d.end === 'water' ? 'water' : d.end === 'floor' ? 'splat' : null;
    if (kind) events.push({ t: d.tEnd, type: kind, x: d.x, y: d.y, drop: d.k, vx: d.vxEnd, vy: d.vyEnd });
  }
  events.sort((a, b) => a.t - b.t);

  let points = 0, sunk = 0;
  for (const s of standRes) points += s.points;
  const newlySunk = bowlRes.filter((b) => b.sunk && !b.was).length;
  if (sc.kind === 'basin') { points += newlySunk * POINTS.bowl + (newlySunk >= 2 ? POINTS.multi * (newlySunk - 1) : 0); sunk = newlySunk; }
  const clangs = standRes.filter((s) => s.result === 'clang').length;
  const wetCount = drops.filter((d) => d.end === 'disc' || d.end === 'bowl').length;
  return {
    aim: { a: aim.a, v: aim.v }, c: p.c, t0, drops, stands: standRes, bowls: bowlRes, events, dur: dur + 0.2, points, sunk, clangs, wet: wetCount,
    kind: sc.kind,
  };
}

// Apply a resolved flick to the board (cups fill and sink). Stands never change: the servant sets the disc back.
export function applyFlick(sc, board, res) {
  if (sc.kind !== 'basin') return;
  for (const b of res.bowls) { board.vol[b.i] = b.vol; if (b.sunk) board.sunk[b.i] = true; }
}
export const boardCleared = (sc, board) => sc.kind === 'basin' && board.sunk.every(Boolean);

// Where a drop is at scene time t (since the flick began), or null before it leaves / after it ended.
export function dropAt(d, t) {
  if (t < d.t0) return null;
  const s = Math.min(t, d.tEnd) - d.t0;
  return { x: HAND.x + d.vx * s, y: HAND.y + d.vy * s - 0.5 * G * s * s, ended: t >= d.tEnd, vx: d.vx, vy: d.vy - G * s };
}

// Disc pose at time t for one stand result: { th, x, y, rot, state } where state is 'rest' | 'rock' | 'fall' | 'landed'.
export function discPose(s, sr, t) {
  const g = standGeom(s);
  if (!sr || !sr.theta.length) return { th: 0, x: s.x, y: g.ysup, rot: 0, state: 'rest' };
  const f = sr.fall;
  if (f && t >= f.tf) {
    const tau = t - f.tf, tauL = f.tLand - f.tf;
    const k = Math.min(tau, tauL);
    const x = s.x + f.dir * f.u * k, y = g.ysup - 0.5 * G * k * k;
    const rot = f.th0 + Math.sign(f.th0 || 1) * (f.om * k * 0.9);
    if (tau >= tauL) {
      if (f.land === 'manes') {
        const settle = Math.min(1, (tau - tauL) / 0.14), wob = Math.sin((tau - tauL) * 38) * 0.09 * Math.exp(-(tau - tauL) * 7);
        return { th: 0, x: x, y: g.manesY + 0.2, rot: lerp(rot, 0, settle) * 0.4 + wob, state: 'landed', dish: wob };
      }
      return { th: 0, x, y: 0.2, rot: lerp(rot, 0, Math.min(1, (tau - tauL) / 0.4)) * 0.6, state: 'landed' };
    }
    return { th: 0, x, y, rot, state: 'fall' };
  }
  // before the fall: interpolate the recorded rocker
  const a = sr.theta;
  if (t <= a[0][0]) return { th: 0, x: s.x, y: g.ysup, rot: 0, state: 'rest' };
  let i = 0;
  while (i < a.length - 1 && a[i + 1][0] < t) i++;
  if (i >= a.length - 1) return { th: a[a.length - 1][1], x: s.x, y: g.ysup, rot: a[a.length - 1][1], state: 'rock' };
  const k = (t - a[i][0]) / Math.max(1e-6, a[i + 1][0] - a[i][0]), th = lerp(a[i][1], a[i + 1][1], clamp(k, 0, 1));
  return { th, x: s.x, y: g.ysup, rot: th, state: 'rock' };
}

// ---- guide and planning -----------------------------------------------------------------------------------------------------
// The nominal path of one drop for the aim (no spread): points every 1/60 s until it reaches the floor or `xMax`.
export function guidePath(a, v, xMax, stepT = 1 / 40) {
  const th = rad(a), vx = Math.cos(th) * v, vy = Math.sin(th) * v, out = [];
  for (let t = 0; t < 4; t += stepT) {
    const x = HAND.x + vx * t, y = HAND.y + vy * t - 0.5 * G * t * t;
    out.push([x, y]);
    if (y < 0 || x > xMax) break;
  }
  return out;
}
// the angle and speed that put a drop through (x, y) on the way down at launch angle a; null when unreachable
export function solveSpeed(a, x, y) {
  const th = rad(a), c = Math.cos(th), s = Math.sin(th);
  const den = 2 * c * c * (HAND.y + x * (s / c) - y);
  if (den <= 1e-6) return null;
  const v = Math.sqrt((G * x * x) / den);
  return v >= AIM.vMin * 0.8 && v <= AIM.vMax * 1.15 ? v : null;
}
// flight time of a nominal drop to horizontal distance x
export const flightTime = (a, v, x) => x / Math.max(1, Math.cos(rad(a)) * v) + LAUNCH_DELAY;

// Candidate flicks: aim points over every target and launch angles, each solved ballistically.
export function candidates(sc, board, t0) {
  const out = [], angles = [24, 32, 40, 48, 56, 64, 72, 80];
  const add = (x, y, why) => { for (const a of angles) { const v = solveSpeed(a, x, y); if (v) out.push({ a, v: clamp(v, AIM.vMin, AIM.vMax), why }); } };
  if (sc.kind === 'stands') {
    for (const s of sc.stands) {
      const y = s.h + DISC_T + 0.5;
      for (const f of [-0.85, -0.5, -0.15, 0.2, 0.6]) add(s.x + f * s.r, y, `rim ${f < 0 ? 'near' : 'far'}`);
    }
  } else {
    const water = BASIN.water + BASIN.cupH;
    sc.basin.bowls.forEach((b, i) => {
      if (board.sunk[i]) return;
      for (const a of [32, 44, 56, 68]) {
        // lead the cup: aim where it will be when the drops arrive (two passes)
        let x = bowlX(sc, b, t0);
        for (let k = 0; k < 2; k++) { const v = solveSpeed(a, x, water); if (!v) break; x = bowlX(sc, b, t0 + flightTime(a, v, x) + NDROP * GAP * 0.4); }
        const v = solveSpeed(a, x, water);
        if (v) out.push({ a, v: clamp(v, AIM.vMin, AIM.vMax), why: `cup ${i + 1}` });
      }
    });
  }
  return out;
}

// Plan a flick: simulate every candidate `samples` times under the player's own hand and pick the best expected score.
// Returns { best, top, tried } where each entry is { a, v, e (expected points), why }.
export function planFlick(sc, board, p, seed, t0, o = {}) {
  const samples = o.samples ?? 4, cands = candidates(sc, board, t0);
  const scored = cands.map((c, i) => {
    let tot = 0;
    for (let s = 0; s < samples; s++) tot += resolveFlick(sc, board, c, p, seed * 31 + i * 7 + s * 101 + 5, t0).points;
    return { ...c, e: tot / samples };
  });
  scored.sort((a, b) => b.e - a.e || a.a - b.a);
  if (!scored.length) return { best: { a: 55, v: 520, e: 0, why: 'a guess' }, top: [], tried: 0 };
  const top = scored.slice(0, 4);
  let best = top[0];
  const q = o.quality ?? 3;
  if (q <= 1 && top.length > 1 && (seed & 3) === 0) best = top[1];
  return { best, top, tried: cands.length * samples };
}

export function explain(pick, sc, p, samples) {
  const pw = Math.round(((pick.v - AIM.vMin) / (AIM.vMax - AIM.vMin)) * 100);
  return `Launch ${Math.round(pick.a)} degrees at about ${pw} percent power, aimed at ${pick.why}. In ${samples} simulated flicks with a human hand it scored about ${Math.round(pick.e * 10) / 10} points on average.`;
}

export const stars = (lv, pts) => (pts >= lv.stars[2] ? 3 : pts >= lv.stars[1] ? 2 : pts >= lv.stars[0] ? 1 : 0);

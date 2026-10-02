// Gonggi rules and physics: pure and deterministic. Randomness only comes from an rng passed in.
// World coordinates: the mat is 660 x 800 units, y grows downward, the hand rests at HOME near the bottom.
// Stones are 5 pebbles (ids 0-4) of radius R. Height z is only used for drawing and for the kkeokki catch.

export const W = 720;
export const H = 1280;
export const WORLD = { w: 660, h: 800 };
export const R = 24;                       // pebble radius
export const FINGER = 12;                  // half width of the hand's path
export const HOME = { x: 330, y: 712 };
export const FIELD = { x0: 62, y0: 64, x1: 598, y1: 610 };
export const SPEED = 1500;                 // hand speed, units per second
export const LEG = 0.04;                   // fixed cost of every hand movement
export const DWELL = 0.06;                 // time to close the hand on one stone
export const START = 0.05;                 // reaction time before the hand leaves
export const DEV = 160;                    // landing scatter of the tossed stone at full height
export const WIN_EARLY = 0.18;             // catch window around the landing time
export const WIN_LATE = 0.22;
export const H_MIN = 0.2;
export const CHARGE_SECS = 1.1;            // holding the toss pad this long gives full height
export const SET_DWELL = 0.3;              // putting four stones down for stage 4
export const SWEEP_DWELL = 0.14;           // sweeping the four stones up
export const CLUSTER_GAP = 2 * R + 2;
export const SET_MIN_HOME = 140;           // the stage 4 stones are set at least this far from home

export const airtime = (h) => 0.55 + 0.85 * h;
// a higher toss falls faster, so the catch window narrows with height
export const winScale = (h) => 1 / (0.65 + 0.7 * clamp(h, 0, 1));
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

// ---- the stages ---------------------------------------------------------------------------------
export const STAGES = [
  { id: 1, rounds: [{ kind: 'take', take: 1 }, { kind: 'take', take: 1 }, { kind: 'take', take: 1 }, { kind: 'take', take: 1 }] },
  { id: 2, rounds: [{ kind: 'take', take: 2 }, { kind: 'take', take: 2 }] },
  { id: 3, rounds: [{ kind: 'take', take: 3 }, { kind: 'take', take: 1 }] },
  { id: 4, rounds: [{ kind: 'set', take: 0 }, { kind: 'sweep', take: 4 }] },
  { id: 5, rounds: [] },
];
export const KKEOKKI = 5;
export const hasScatter = (stage) => stage >= 1 && stage <= 3;

// ---- geometry -----------------------------------------------------------------------------------
export function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let u = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  u = clamp(u, 0, 1);
  return { d: Math.hypot(px - (ax + dx * u), py - (ay + dy * u)), u };
}

// Push overlapping pebbles apart until none touch (centres at least 2R + 2 apart) and keep them on the mat.
export function relax(pts) {
  for (let pass = 0; pass < 80; pass++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        const min = CLUSTER_GAP;
        if (d < min) {
          if (d < 0.001) { dx = 1; dy = 0; d = 1; }
          const push = (min - d) / 2 + 0.01;
          a.x -= (dx / d) * push; a.y -= (dy / d) * push; b.x += (dx / d) * push; b.y += (dy / d) * push; moved = true;
        }
      }
    }
    for (const p of pts) { p.x = clamp(p.x, FIELD.x0, FIELD.x1); p.y = clamp(p.y, FIELD.y0, FIELD.y1); }
    if (!moved) break;
  }
  return pts;
}

// The opening scatter. The player chooses where (cx, cy) and how wide (spread). Seeded, so a replay is identical.
export function scatterStones(rng, cx, cy, spread, ids = [0, 1, 2, 3, 4]) {
  const pts = ids.map((id) => {
    const a = rng.next() * Math.PI * 2, r = spread * Math.sqrt(rng.next());
    return { id, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, rot: rng.next() * Math.PI };
  });
  return relax(pts);
}

// The four stones put down together for stage 4 (a tight square).
export function clusterAt(x, y, ids) {
  const o = CLUSTER_GAP / 2;
  const cx = clamp(x, FIELD.x0 + o, FIELD.x1 - o), cy = clamp(y, FIELD.y0 + o, FIELD.y1 - o);
  const offs = [[-o, -o], [o, -o], [-o, o], [o, o]];
  return ids.map((id, i) => ({ id, x: cx + offs[i][0], y: cy + offs[i][1], rot: i * 0.7 }));
}
export const setSpotOk = (x, y) => dist(x, y, HOME.x, HOME.y) >= SET_MIN_HOME && y <= FIELD.y1 + 40;
export const clampSpot = (x, y) => {
  let sx = clamp(x, FIELD.x0 + R, FIELD.x1 - R), sy = clamp(y, FIELD.y0 + R, FIELD.y1);
  const d = dist(sx, sy, HOME.x, HOME.y);
  if (d < SET_MIN_HOME) { const k = SET_MIN_HOME / Math.max(1, d); sx = HOME.x + (sx - HOME.x) * k; sy = HOME.y + (sy - HOME.y) * k; if (d < 1) { sx = HOME.x; sy = HOME.y - SET_MIN_HOME; } }
  return { x: clamp(sx, FIELD.x0 + R, FIELD.x1 - R), y: clamp(sy, FIELD.y0 + R, FIELD.y1) };
};

// ---- one toss round (stages 1 to 4) -------------------------------------------------------------
// plan: { targets: [ids in order], h, spot? }.  roll: { ang, u } decides where the tossed stone lands.
export const newRoll = (rng) => ({ ang: rng.next() * Math.PI * 2, u: 0.2 + rng.next() * 0.8 });
export const landing = (h, roll) => ({ x: HOME.x + Math.cos(roll.ang) * DEV * h * roll.u, y: HOME.y + Math.sin(roll.ang) * DEV * h * roll.u * 0.6 });

const legTime = (d) => LEG + d / SPEED;

// Walks the hand through the plan. The stone is in the air for airtime(h); the hand must be back at the landing
// spot by then, and must not brush a stone it is not taking.
export function evaluateRound(mat, rd, plan, roll) {
  const h = clamp(plan.h, H_MIN, 1);
  const T = airtime(h);
  const L = landing(h, roll ?? { ang: 0, u: 0 });
  const out = { T, L, legs: [], picks: [], fault: null, tBack: 0, need: 0, margin: 0, valid: true, h, cluster: null };
  let t = START, px = HOME.x, py = HOME.y;
  const leg = (bx, by, pick, dwell, others) => {
    const { d: len } = { d: dist(px, py, bx, by) };
    const t1 = t + legTime(len);
    const lg = { ax: px, ay: py, bx, by, t0: t, t1, pick, dwell };
    if (!out.fault && others) {
      for (const s of others) {
        const { d, u } = distSeg(s.x, s.y, px, py, bx, by);
        if (d < R + FINGER) {
          const tf = t + (t1 - t) * clamp(u - 0.12, 0, 1);
          out.fault = { kind: 'clip', id: s.id, t: tf, x: px + (bx - px) * Math.max(0, u - 0.12), y: py + (by - py) * Math.max(0, u - 0.12), leg: out.legs.length };
          lg.stopU = Math.max(0, u - 0.12);
          break;
        }
      }
    }
    out.legs.push(lg);
    t = t1 + (dwell || 0); px = bx; py = by;
  };
  if (rd.kind === 'take') {
    const ids = plan.targets ?? [];
    if (ids.length !== rd.take || new Set(ids).size !== ids.length) { out.valid = false; }
    const targets = new Set(ids);
    const others = mat.filter((s) => !targets.has(s.id));
    for (const id of ids) {
      const s = mat.find((m) => m.id === id);
      if (!s) { out.valid = false; continue; }
      leg(s.x, s.y, id, DWELL, others);
      if (!out.fault) out.picks.push({ id, t: t - DWELL * 0.5 });
    }
  } else if (rd.kind === 'set') {
    const sp = plan.spot ?? { x: HOME.x, y: HOME.y - SET_MIN_HOME };
    if (!setSpotOk(sp.x, sp.y)) out.valid = false;
    leg(sp.x, sp.y, null, SET_DWELL, null);
    out.cluster = { x: sp.x, y: sp.y, t: t - SET_DWELL * 0.5 };
  } else if (rd.kind === 'sweep') {
    const c = mat.length ? { x: mat.reduce((a, s) => a + s.x, 0) / mat.length, y: mat.reduce((a, s) => a + s.y, 0) / mat.length } : HOME;
    leg(c.x, c.y, null, SWEEP_DWELL, null);
    out.picks = mat.map((s) => ({ id: s.id, t: t - SWEEP_DWELL * 0.5 }));
  }
  if (!out.fault) {
    const remaining = rd.kind === 'take' ? mat.filter((s) => !(plan.targets ?? []).includes(s.id)) : null;
    leg(L.x, L.y, null, 0, remaining);
  }
  out.tBack = out.fault ? Infinity : t;
  // `need` is the time the route takes when the stone lands exactly at home (what the player is shown while planning).
  out.need = needTime(mat, rd, plan);
  out.margin = out.fault ? -1 : T - out.tBack;
  return out;
}

export function needTime(mat, rd, plan) {
  let t = START, px = HOME.x, py = HOME.y;
  const go = (x, y, dw) => { t += legTime(dist(px, py, x, y)) + dw; px = x; py = y; };
  if (rd.kind === 'take') for (const id of plan.targets ?? []) { const s = mat.find((m) => m.id === id); if (s) go(s.x, s.y, DWELL); }
  else if (rd.kind === 'set') { const sp = plan.spot ?? { x: HOME.x, y: HOME.y - SET_MIN_HOME }; go(sp.x, sp.y, SET_DWELL); }
  else if (rd.kind === 'sweep' && mat.length) go(mat.reduce((a, s) => a + s.x, 0) / mat.length, mat.reduce((a, s) => a + s.y, 0) / mat.length, SWEEP_DWELL);
  go(HOME.x, HOME.y, 0);
  return t;
}

// Where the hand is at time t (smooth start and stop on every leg).
export function handAt(ev, t) {
  let px = HOME.x, py = HOME.y;
  for (const lg of ev.legs) {
    if (t < lg.t0) return { x: px, y: py, moving: false };
    if (t <= lg.t1) {
      let u = (t - lg.t0) / Math.max(1e-6, lg.t1 - lg.t0);
      u = u * u * (3 - 2 * u);
      const k = lg.stopU !== undefined ? Math.min(u, lg.stopU) : u;
      return { x: lg.ax + (lg.bx - lg.ax) * k, y: lg.ay + (lg.by - lg.ay) * k, moving: true };
    }
    px = lg.bx; py = lg.by;
    if (t <= lg.t1 + (lg.dwell || 0)) return { x: px, y: py, moving: false, dwelling: true };
  }
  return { x: px, y: py, moving: false };
}

// The result of a round once the catch tap is known. eps = (tap time) - (landing time); null = no tap at all.
export function catchResult(ev, eps) {
  if (ev.fault) return { ok: false, why: 'clip', quality: 0 };
  if (ev.tBack > ev.T + 0.02) return { ok: false, why: 'late', quality: 0 };
  const sc = winScale(ev.h);
  if (eps === null || eps === undefined || eps > WIN_LATE * sc) return { ok: false, why: 'slow', quality: 0 };
  if (eps < -WIN_EARLY * sc) return { ok: false, why: 'early', quality: 0 };
  const a = Math.abs(eps) / sc;
  return { ok: true, why: 'ok', quality: a < 0.07 ? 2 : a < 0.14 ? 1 : 0 };
}

// ---- kkeokki: throw all five and catch them on the back of the hand --------------------------------
export const KK = { Rb: 108, Zc: 100, T0: 0.5 };
export function kkToss(h, rng) {
  h = clamp(h, H_MIN, 1);
  const T = 0.5 + 0.85 * h, sig = 30 + 60 * h, hmax = 150 + 150 * h;
  const stones = [];
  for (let i = 0; i < 5; i++) {
    const gx = (rng.next() + rng.next() + rng.next() - 1.5) * 1.35, gy = (rng.next() + rng.next() + rng.next() - 1.5) * 1.35;
    stones.push({ id: i, T: T * (1 + (rng.next() - 0.5) * 0.14), hmax: hmax * (0.9 + rng.next() * 0.2), x0: HOME.x + (i - 2) * 10, y0: HOME.y,
      x1: HOME.x + gx * sig, y1: HOME.y - 40 + gy * sig * 0.8, spin: (rng.next() - 0.5) * 8 });
  }
  return { h, T, stones };
}
export function kkPos(s, t) {
  const u = clamp(t / s.T, 0, 1);
  return { x: s.x0 + (s.x1 - s.x0) * u, y: s.y0 + (s.y1 - s.y0) * u, z: s.hmax * 4 * u * (1 - u), u, down: u >= 0.5 };
}
export function kkCatch(toss, tau, tx, ty) {
  const caught = [], dropped = [];
  for (const s of toss.stones) {
    const p = kkPos(s, tau);
    const ok = tau <= s.T + 0.04 && p.down && p.z <= KK.Zc && dist(p.x, p.y, tx, ty) <= KK.Rb;
    (ok ? caught : dropped).push(s.id);
  }
  return { caught, dropped };
}
// The best place and time to catch (used by the hint and by the computer player): returns the time that catches the
// most stones, and the centre of those stones.
export function kkBest(toss) {
  let best = { n: -1, t: 0, x: HOME.x, y: HOME.y, ids: [] };
  const tMax = Math.max(...toss.stones.map((s) => s.T)) + 0.04;
  for (let t = 0.3; t <= tMax; t += 0.01) {
    const ps = toss.stones.map((s) => ({ s, p: kkPos(s, t) })).filter((o) => t <= o.s.T + 0.04 && o.p.down && o.p.z <= KK.Zc);
    if (ps.length <= best.n) continue;
    // centre = mean of the stones that are low enough, then count what a hand there would catch
    let cx = ps.reduce((a, o) => a + o.p.x, 0) / ps.length, cy = ps.reduce((a, o) => a + o.p.y, 0) / ps.length;
    for (let k = 0; k < 4; k++) {
      const inn = ps.filter((o) => dist(o.p.x, o.p.y, cx, cy) <= KK.Rb);
      if (!inn.length) break;
      cx = inn.reduce((a, o) => a + o.p.x, 0) / inn.length; cy = inn.reduce((a, o) => a + o.p.y, 0) / inn.length;
    }
    const n = ps.filter((o) => dist(o.p.x, o.p.y, cx, cy) <= KK.Rb).length;
    if (n > best.n) best = { n, t, x: cx, y: cy, ids: ps.map((o) => o.s.id) };
  }
  return best;
}
// The second throw of kkeokki: the stones caught on the back of the hand are tossed again and caught in the grip.
export const FLICK_T = 0.62;
export function flickKept(n, eps) {
  if (eps === null || eps === undefined) return 0;
  const a = Math.abs(eps);
  const lost = a <= 0.1 ? 0 : a <= 0.18 ? 1 : a <= 0.26 ? 2 : 99;
  return Math.max(0, n - lost);
}

// ---- turns and scoring ----------------------------------------------------------------------------
export const TARGETS = [5, 10, 15];
export const roundsOf = (stage) => STAGES[stage - 1].rounds;

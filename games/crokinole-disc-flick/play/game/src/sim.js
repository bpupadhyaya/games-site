// Disc physics for the flicking board. Pure and deterministic: no randomness, no clock. World units are
// screen pixels at 1x; the board centre is (0, 0), +x right, +y down. Side 0 shoots from the bottom
// (+y), side 1 from the top (-y).
//
// Board (radii from the centre): pocket 28, "15" ring to 100 (the eight pegs stand on its edge),
// "10" ring to 178, "5" ring to 254, shooting baselines at 282, gutter beyond 306.

export const R_DISC = 19;
export const R_PEG = 6;
export const R_POCKET = 28;
export const RINGS = [{ v: 15, r: 100 }, { v: 10, r: 178 }, { v: 5, r: 254 }];
export const R_PEG_RING = 100;
export const R_BASE = 282;          // baseline radius (disc centre when shooting)
export const R_PLAY = 306;          // a disc whose centre goes beyond this drops into the gutter
export const R_BOARD = 330;
export const MAX_U = 0.72;          // shooting position: angle = u * 58 degrees either side of the baseline middle
export const U_ANGLE = (58 * Math.PI) / 180;
export const PEGS = Array.from({ length: 8 }, (_, i) => {
  const a = Math.PI / 8 + (i * Math.PI) / 4;
  return { x: Math.cos(a) * R_PEG_RING, y: Math.sin(a) * R_PEG_RING, r: R_PEG };
});

// Motion: dv/dt = -(A0 + K v). A disc stopping dead needs about v = 450 to travel from the baseline to the pocket.
const A0 = 180, K = 0.5;
const V_MIN = 150, V_MAX = 1450, P_EXP = 1.6;
const REST_E = 0.9, PEG_E = 0.7;
const STOP_V = 5;
const POCKET_V = 360;               // a disc over the pocket slower than this drops in
const EV_MIN = 30;                  // slowest impact worth an event (sound, sparks)
const FALL_T = 0.5;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function powerToSpeed(p) { return V_MIN + (V_MAX - V_MIN) * Math.pow(clamp(p, 0, 1), P_EXP); }
export function speedToPower(v) { return Math.pow(clamp((v - V_MIN) / (V_MAX - V_MIN), 0, 1), 1 / P_EXP); }
// Distance a disc travels on the open board before stopping, for launch speed v.
export function travel(v) { return v / K - (A0 / (K * K)) * Math.log(1 + (K * v) / A0); }
// Launch speed that gives a travel distance d (bisection; monotonic).
export function speedForDistance(d) {
  let lo = 0, hi = 4000;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (travel(mid) < d) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

// ---- world ------------------------------------------------------------------------------------
export function createWorld() { return { discs: [], t: 0, settled: true, nextId: 1, shot: null, hitOpp: false, touched: false, pegHit: false }; }

export function newDisc(w, team, x, y) {
  return { id: w.nextId++, team, x, y, vx: 0, vy: 0, mode: 'live', fall: 0, spin: 0, spinV: 0, heat: 0 };
}
export function cloneWorld(w) {
  return {
    discs: w.discs.map((d) => ({ ...d })), t: w.t, settled: w.settled, nextId: w.nextId,
    shot: w.shot, hitOpp: w.hitOpp, touched: w.touched, pegHit: w.pegHit,
  };
}

// Where a disc of `side` stands on its baseline for shooting position u in [-MAX_U, MAX_U]
export function startPoint(side, u) {
  const a = clamp(u, -MAX_U, MAX_U) * U_ANGLE;
  return side === 0 ? { x: Math.sin(a) * R_BASE, y: Math.cos(a) * R_BASE } : { x: -Math.sin(a) * R_BASE, y: -Math.cos(a) * R_BASE };
}

// True when a disc already lies on the shooting spot, so a new disc cannot stand there (it would start overlapping it).
export function spotBlocked(w, side, u, pad = 1) {
  const p = startPoint(side, u), lim = 2 * R_DISC + pad;
  return w.discs.some((d) => d.mode === 'live' && Math.hypot(d.x - p.x, d.y - p.y) < lim);
}
// The nearest clear spot to u along the baseline (u itself when it is clear).
export function freeSpot(w, side, u) {
  if (!spotBlocked(w, side, u)) return u;
  for (let k = 1; k <= 40; k++) for (const sg of [1, -1]) { const v = clamp(u + sg * k * 0.03, -MAX_U, MAX_U); if (!spotBlocked(w, side, v)) return v; }
  return u;
}

// Launch a new disc for `side` from baseline position u at aim angle `ang` (radians, atan2(dy, dx)) and power 0..1.
export function launch(w, side, u, ang, power) {
  const p = startPoint(side, u);
  const d = newDisc(w, side, p.x, p.y);
  const v = powerToSpeed(power);
  d.vx = Math.cos(ang) * v; d.vy = Math.sin(ang) * v;
  d.spinV = (v / 120) * (side === 0 ? 1 : -1);
  w.discs.push(d);
  w.shot = d.id; w.hitOpp = false; w.touched = false; w.pegHit = false; w.settled = false;
  return d;
}

const live = (d) => d.mode === 'live';

// Value of a disc by where its body lies: the highest ring it touches, the pocket when wholly inside.
export function discValue(d) {
  if (d.mode === 'pocket') return 20;
  if (d.mode !== 'live') return 0;
  const inner = Math.hypot(d.x, d.y) - R_DISC;
  for (const g of RINGS) if (inner < g.r) return g.v;
  return 0;
}
// True when a live disc counts for nothing (it did not reach the outer ring).
export const isOutside = (d) => live(d) && Math.hypot(d.x, d.y) - R_DISC >= RINGS[2].r;

// ---- stepping ---------------------------------------------------------------------------------
// Advance by dt seconds (one frame). Returns events: { t: 'hit'|'peg'|'pocket'|'gutter', x, y, v, a, b }.
export function stepWorld(w, dt) {
  const ev = [];
  let vmax = 0;
  for (const d of w.discs) if (live(d)) { const s = Math.hypot(d.vx, d.vy); if (s > vmax) vmax = s; }
  const n = clamp(Math.ceil((vmax * dt) / 3.5), 1, 10), h = dt / n;
  const ds = w.discs;
  for (let s = 0; s < n; s++) {
    for (const d of ds) {
      if (d.mode === 'live') {
        let sp = Math.hypot(d.vx, d.vy);
        // a gentle dish pulls a slow disc over the pocket towards the middle
        const rc = Math.hypot(d.x, d.y);
        if (rc < R_POCKET + 12 && sp < POCKET_V && rc > 0.5) {
          const k = (1 - rc / (R_POCKET + 12)) * 260 * h;
          d.vx -= (d.x / rc) * k; d.vy -= (d.y / rc) * k; sp = Math.hypot(d.vx, d.vy);
        }
        if (sp > 0) {
          const ns = sp - (A0 + K * sp) * h;
          if (ns <= STOP_V) { d.vx = 0; d.vy = 0; } else { const f = ns / sp; d.vx *= f; d.vy *= f; }
        }
        d.x += d.vx * h; d.y += d.vy * h;
        d.spin += d.spinV * h; d.spinV *= 1 - 2.2 * h;
      } else d.fall += h;
    }
    // disc / peg
    for (const d of ds) {
      if (!live(d)) continue;
      for (const g of PEGS) {
        const dx = d.x - g.x, dy = d.y - g.y, rr = R_DISC + g.r, q = dx * dx + dy * dy;
        if (q < rr * rr) {
          const dist = Math.sqrt(q) || 0.001, nx = dx / dist, ny = dy / dist;
          d.x = g.x + nx * rr; d.y = g.y + ny * rr;
          const vn = d.vx * nx + d.vy * ny;
          if (vn < 0) {
            d.vx -= (1 + PEG_E) * vn * nx; d.vy -= (1 + PEG_E) * vn * ny;
            if (-vn > EV_MIN) ev.push({ t: 'peg', x: g.x + nx * g.r, y: g.y + ny * g.r, v: -vn, a: d.id });
            if (d.id === w.shot) w.pegHit = true;
          }
        }
      }
    }
    // disc / disc
    for (let i = 0; i < ds.length; i++) {
      const a = ds[i];
      if (!live(a)) continue;
      for (let j = i + 1; j < ds.length; j++) {
        const b = ds[j];
        if (!live(b)) continue;
        const dx = b.x - a.x, dy = b.y - a.y, rr = 2 * R_DISC, q = dx * dx + dy * dy;
        if (q >= rr * rr) continue;
        const dist = Math.sqrt(q) || 0.001, nx = dx / dist, ny = dy / dist;
        const push = (rr - dist) / 2;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
        const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rv < 0) {
          const jn = -(1 + REST_E) * rv / 2;
          a.vx -= jn * nx; a.vy -= jn * ny; b.vx += jn * nx; b.vy += jn * ny;
          if (-rv > EV_MIN) ev.push({ t: 'hit', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: -rv, a: a.id, b: b.id });
          a.spinV += (b.vy - a.vy) * 0.01; b.spinV -= (b.vx - a.vx) * 0.01;
        }
        if (a.id === w.shot || b.id === w.shot) { w.touched = true; if (a.team !== b.team) w.hitOpp = true; }
      }
    }
    // pocket and gutter
    for (const d of ds) {
      if (!live(d)) continue;
      const rc = Math.hypot(d.x, d.y), sp = Math.hypot(d.vx, d.vy);
      if (rc < R_POCKET - 6 && sp < POCKET_V) {
        d.mode = 'pocket'; d.fall = 0; d.vx = 0; d.vy = 0;
        ev.push({ t: 'pocket', x: d.x, y: d.y, v: sp, a: d.id });
      } else if (rc > R_PLAY) {
        d.mode = 'gutter'; d.fall = 0;
        ev.push({ t: 'gutter', x: d.x, y: d.y, v: sp, a: d.id });
      }
    }
  }
  w.t += dt;
  let moving = false;
  for (const d of ds) if (live(d) && (d.vx !== 0 || d.vy !== 0)) { moving = true; break; }
  w.settled = !moving;
  return ev;
}

// Run the world until it settles (no rendering): used by the AI and the preview. `limit` frames.
export function settle(w, limit = 420) {
  const evs = [];
  for (let i = 0; i < limit && !w.settled; i++) evs.push(...stepWorld(w, 1 / 60));
  return evs;
}

// After a shot has settled: apply the board rules. Returns { removed: [...], note }.
// Rules: a shot disc that did not touch a rival disc is removed when a rival disc was on the board;
// any disc that finished outside the outer ring leaves the board; discs in the gutter are gone.
export function resolveShot(w, hadRivals) {
  const notes = [];
  const shot = w.discs.find((d) => d.id === w.shot);
  if (shot && hadRivals && !w.hitOpp && shot.mode !== 'gutter') {
    if (shot.mode === 'pocket' || live(shot)) { notes.push({ k: 'nohit', x: shot.x, y: shot.y }); shot.mode = 'gutter'; shot.fall = 0; }
  }
  for (const d of w.discs) {
    if (isOutside(d)) { d.mode = 'gutter'; d.fall = 0; if (d.id !== w.shot) notes.push({ k: 'out', x: d.x, y: d.y }); else if (!notes.length) notes.push({ k: 'short', x: d.x, y: d.y }); }
  }
  return notes;
}
export function tidy(w) { w.discs = w.discs.filter((d) => d.mode !== 'gutter' && !(d.mode === 'pocket' && d.fall > 99)); }

// The sum of values for each side (pocketed discs included).
export function tally(w) {
  const t = [0, 0], cnt = [0, 0], pockets = [0, 0];
  for (const d of w.discs) {
    const v = discValue(d);
    if (v > 0) { t[d.team] += v; cnt[d.team]++; if (v === 20) pockets[d.team]++; }
  }
  return { pts: t, cnt, pockets };
}

// Predict a throw: returns the path of the shot disc and where it ends, without touching w.
export function previewShot(w, side, u, ang, power, every = 3) {
  const c = cloneWorld(w);
  const d = launch(c, side, u, ang, power);
  const path = [{ x: d.x, y: d.y }];
  let first = null, contact = null, i = 0, frames = 0;
  while (!c.settled && frames < 360) {
    const ev = stepWorld(c, 1 / 60);
    frames++;
    for (const e of ev) if (!contact && (e.a === d.id || e.b === d.id)) contact = { x: e.x, y: e.y, kind: e.t };
    if (frames % every === 0) path.push({ x: d.x, y: d.y });
    if (contact && !first) first = path.length - 1;
  }
  path.push({ x: d.x, y: d.y });
  return { path, rest: { x: d.x, y: d.y, mode: d.mode }, contact, first, hitOpp: c.hitOpp };
}
// Straight-line stopping point for a throw that touches nothing.
export function stopPoint(side, u, ang, power) {
  const p = startPoint(side, u), dist = travel(powerToSpeed(power));
  return { x: p.x + Math.cos(ang) * dist, y: p.y + Math.sin(ang) * dist, dist };
}

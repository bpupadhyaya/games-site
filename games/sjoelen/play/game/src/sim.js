// Sjoelen physics: a long board, four arches at the far end, round discs sliding with friction, bouncing off the rails and
// the posts and off each other. Pure and deterministic (fixed 1/240 s steps, no clock, no randomness): the same throw on the
// same board always gives the same result, so the guide, the hint and the rivals all use this exact code.
//
// World units: x across the board (0 = left rail), y along it. The arch line is y = 0, the player's end is y = TL. The arches
// are compartments behind the line (y from -D to 0); a disc whose middle crosses y = 0 inside an arch lane is counted there.

export const R = 12;                    // disc radius
export const AW = 40;                   // arch width (lane between two posts)
export const PD = 8;                    // post width
export const TW = 4 * AW + 3 * PD;      // board width between the rails
export const D = 40;                    // depth of the arch compartments
export const TL = 440;                  // slide length, arch line to the player's end
export const START_Y = TL - 20;         // where a disc is released from
export const BAR = 34;                  // the back board with the brass numbers (above the compartments)
export const NEAR = 28;                 // the player's end rail
export const ARCH_VALUES = [2, 3, 4, 1];
export const SET_BONUS = 20;
export const DISCS_PER_ROUND = 10;
export const MAX_PUSHES = 3;
export const PERFECT = 148;

export const STEP = 1 / 240;
export const MU = 240;                  // friction deceleration (units / s^2)
export const DRAG = 0.30;               // plus a small speed-proportional drag (1 / s)
export const V_MAX = 820;
export const V_MIN = 90;
export const REST_V = 7;
export const E_RAIL = 0.72, E_POST = 0.5, E_DISC = 0.86, E_BACK = 0.3;
export const ANGLE_LIMIT = 0.42;        // radians from straight up the board (effective angle)
export const LANE_PITCH = AW + PD;

export const laneX = (k) => k * LANE_PITCH + AW / 2;                // centre of arch k
export const postRect = (k) => ({ x0: (k + 1) * AW + k * PD, x1: (k + 1) * (AW + PD), y0: -D, y1: 0 });
const POSTS = [postRect(0), postRect(1), postRect(2)];
export const laneOf = (x) => Math.max(0, Math.min(3, Math.floor(x / LANE_PITCH)));

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const startX = (x) => clamp(x, R + 1, TW - R - 1);

// ---- scoring --------------------------------------------------------------------------------------------------------
// A set is one disc in each of the four arches (20). Every other disc scores its arch value (2, 3, 4, 1).
export function setsOf(stack) { return Math.min(stack[0], stack[1], stack[2], stack[3]); }
export function scoreOf(stack) {
  const s = setsOf(stack);
  let t = s * SET_BONUS;
  for (let i = 0; i < 4; i++) t += (stack[i] - s) * ARCH_VALUES[i];
  return t;
}
export const countOf = (stack) => stack[0] + stack[1] + stack[2] + stack[3];
// The best final count still reachable if `rem` more discs all went where they should: finish sets first, spare discs
// to the 4-arch. The rivals and the hint value a position by this, so they build sets instead of piling one arch.
export function potential(stack, rem) {
  let best = -1;
  const mn = Math.min(...stack), mx = Math.max(...stack);
  for (let m = mn; m <= mx + Math.ceil(rem / 4) + 1; m++) {
    let cost = 0;
    for (let i = 0; i < 4; i++) cost += Math.max(0, m - stack[i]);
    if (cost > rem) break;
    const s = stack.map((c) => Math.max(c, m));
    s[2] += rem - cost;
    best = Math.max(best, scoreOf(s));
  }
  return best;
}

// ---- discs and the world ----------------------------------------------------------------------------------------------
let nextId = 1;
export const resetIds = () => { nextId = 1; };
export function makeDisc(side, x, y = START_Y, vx = 0, vy = 0) {
  return { id: nextId++, side, x, y, vx, vy, cap: -1 };
}
export const cloneDisc = (d) => ({ id: d.id, side: d.side, x: d.x, y: d.y, vx: d.vx, vy: d.vy, cap: d.cap });
export const velocityOf = (angle, v) => ({ vx: v * Math.sin(angle), vy: -v * Math.cos(angle) });

// One physics step over `discs` (resting and moving, none captured). `ev` collects { type, ... } events:
//   rail / post / disc: { v } impact speed;  cap: { disc, lane, v }.
// Returns true while anything still moves.
export function stepDiscs(discs, dt, ev) {
  let moving = false;
  for (const d of discs) {
    if (d.cap >= 0) continue;
    let sp = Math.hypot(d.vx, d.vy);
    if (sp > 0) {
      const ns = Math.max(0, sp - (MU + DRAG * sp) * dt);
      const k = ns / sp; d.vx *= k; d.vy *= k; sp = ns;
      if (sp < REST_V) { d.vx = 0; d.vy = 0; sp = 0; }
    }
    if (sp > 0) {
      moving = true;
      d.x += d.vx * dt; d.y += d.vy * dt;
    }
    // rails
    if (d.x < R) { d.x = R; if (d.vx < 0) { if (ev) ev.push({ type: 'rail', v: -d.vx }); d.vx = -d.vx * E_RAIL; d.vy *= 0.97; } }
    else if (d.x > TW - R) { d.x = TW - R; if (d.vx > 0) { if (ev) ev.push({ type: 'rail', v: d.vx }); d.vx = -d.vx * E_RAIL; d.vy *= 0.97; } }
    // the player's end rail and the back board
    if (d.y > TL + NEAR - R - 6) { d.y = TL + NEAR - R - 6; if (d.vy > 0) d.vy = -d.vy * 0.3; }
    if (d.y < -D + R) { d.y = -D + R; if (d.vy < 0) d.vy = -d.vy * E_BACK; }
    // posts (only near the arch line)
    if (d.y < R + 1) {
      for (const p of POSTS) {
        const cx = clamp(d.x, p.x0, p.x1), cy = clamp(d.y, p.y0, p.y1);
        let dx = d.x - cx, dy = d.y - cy, dist = Math.hypot(dx, dy);
        if (dist < R) {
          if (dist < 1e-6) { dx = 0; dy = 1; dist = 1; }
          const nx = dx / dist, ny = dy / dist;
          d.x += nx * (R - dist); d.y += ny * (R - dist);
          const vn = d.vx * nx + d.vy * ny;
          if (vn < 0) {
            if (ev) ev.push({ type: 'post', v: -vn });
            d.vx -= (1 + E_POST) * vn * nx; d.vy -= (1 + E_POST) * vn * ny;
          }
        }
      }
    }
  }
  // disc against disc
  const n = discs.length;
  for (let i = 0; i < n; i++) {
    const a = discs[i]; if (a.cap >= 0) continue;
    for (let j = i + 1; j < n; j++) {
      const b = discs[j]; if (b.cap >= 0) continue;
      let dx = b.x - a.x, dy = b.y - a.y;
      const dd = dx * dx + dy * dy;
      if (dd >= 4 * R * R) continue;
      let dist = Math.sqrt(dd);
      if (dist < 1e-6) { dx = 1; dy = 0; dist = 1; }
      const nx = dx / dist, ny = dy / dist, push = (2 * R - dist) / 2;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
      const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (vn > 0) {
        const j2 = ((1 + E_DISC) / 2) * vn;
        a.vx -= j2 * nx; a.vy -= j2 * ny; b.vx += j2 * nx; b.vy += j2 * ny;
        if (ev) ev.push({ type: 'disc', v: vn });
        moving = true;
      }
    }
  }
  // arches: the middle of a disc crossing the line inside a lane counts
  for (const d of discs) {
    if (d.cap < 0 && d.y < 0) {
      d.cap = laneOf(d.x);
      if (ev) ev.push({ type: 'cap', disc: d, lane: d.cap, v: Math.hypot(d.vx, d.vy) });
    }
  }
  return moving;
}

// Run a throw to rest on a copy of the board. `table` = discs lying on the board (not mutated).
// spec { x, angle, v, side }. Returns { table (resting strays), caps: [{ id, lane, side }], trace, t, thrown }.
export function simulate(table, spec, o = {}) {
  const discs = table.map(cloneDisc);
  const d = makeDisc(spec.side ?? 0, startX(spec.x));
  if (o.fixedId !== undefined) d.id = o.fixedId;
  const vel = velocityOf(clamp(spec.angle, -ANGLE_LIMIT, ANGLE_LIMIT), clamp(spec.v, V_MIN, V_MAX));
  d.vx = vel.vx; d.vy = vel.vy;
  discs.push(d);
  const caps = [], trace = [], ev = [];
  const maxT = o.maxT ?? 9, every = o.trace ? 3 : 0;
  let t = 0, k = 0;
  while (t < maxT) {
    ev.length = 0;
    const mv = stepDiscs(discs, STEP, ev);
    t += STEP; k++;
    for (const e of ev) if (e.type === 'cap') caps.push({ id: e.disc.id, lane: e.lane, side: e.disc.side, v: e.v });
    if (every && k % every === 0 && d.cap < 0 && trace.length < 700) trace.push(d.x, d.y);
    if (!mv) break;
  }
  if (every && d.cap >= 0) trace.push(d.x, d.y);
  return { table: discs.filter((q) => q.cap < 0), caps, trace, t, thrown: d.id, thrownCap: d.cap };
}

// Estimated stopping distance on a clear board (used by hints and the strength read-out).
export function slideDistance(v) {
  let s = v, y = 0;
  while (s > REST_V) { s -= (MU + DRAG * s) * STEP; y += s * STEP; }
  return y;
}

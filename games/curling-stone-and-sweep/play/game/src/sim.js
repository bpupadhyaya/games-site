// The ice: stone physics, curl, sweeping and collisions. Pure and deterministic (fixed step, no clock, no randomness).
// Units are metres and seconds. The button is the origin; +y runs from the thrower towards the far house, +x is to the
// right as the stone travels. A stone is released at the near hog line with a speed and a direction.
export const R = 0.145;                 // stone radius
export const HALF_W = 2.375;            // half the sheet width (a stone touching a side line is out)
export const HOG_FAR = -6.4;            // far hog line (a stone must clear it completely)
export const HOG_NEAR = -28.35;         // where the stone is released
export const BACK = 1.83;               // back line (a stone completely beyond it is out)
export const BUTTON_R = 0.152, FOUR_R = 0.61, EIGHT_R = 1.22, HOUSE_R = 1.83;
export const NEAR_TEE = -34.75;         // the near house (drawn only)
export const H = 1 / 60;                // fixed physics step
const G = 9.81;
const MU = 0.0162;                      // base friction coefficient of the pebbled ice
const FRIC_LOW = 0.55, FRIC_V = 0.45;   // friction rises as the stone slows
export const SWEEP_FRIC = 0.12;         // full sweeping lowers friction by this fraction
export const SWEEP_CURL = 0.7;          // and takes this fraction off the curl
const CURL = 0.021;                    // sideways acceleration of a spinning stone (m/s^2)
const SPIN0 = 1.25;                     // initial spin (rad/s)
const E_REST = 0.88;                    // collision restitution (granite on granite)
const MU_C = 0.12;                      // contact friction (passes spin between stones)
export const V_MAX = 5.2;               // fastest release
export const MAX_SIM_T = 70;

export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const toButton = (s) => Math.hypot(s.x, s.y);

export function newStone(id, team, x, y) {
  return { id, team, x, y, vx: 0, vy: 0, w: 0, ang: (id * 1.7) % 6.283, mode: 'play', fr: 1, cv: 1, out: 0, why: '' };
}
export function createWorld() { return { stones: [], t: 0, nextId: 1, settled: true }; }
export function addStone(w, team, x, y) { const s = newStone(w.nextId++, team, x, y); w.stones.push(s); return s; }
export const inPlay = (w) => w.stones.filter((s) => s.mode === 'play');

export function cloneWorld(w) {
  return { stones: w.stones.map((s) => ({ ...s })), t: w.t, nextId: w.nextId, settled: w.settled };
}

// Speed shape of the curl: strongest in the middle of the slide, weaker for a fast takeout.
const curlShape = (sp) => (1 / (1 + (sp / 2.6) * (sp / 2.6))) * Math.min(1, sp / 0.12);

// One stone for one step. `eff` is the sweeping effort 0..1 for this stone. Returns nothing; mutates the stone.
export function advance(s, eff) {
  const sp = Math.hypot(s.vx, s.vy);
  if (sp <= 0) return;
  const a = G * MU * s.fr * (1 + FRIC_LOW * Math.exp(-sp / FRIC_V)) * (1 - SWEEP_FRIC * eff);
  const nsp = sp - a * H;
  if (nsp <= 0.01) { s.vx = 0; s.vy = 0; s.w = 0; return; }
  const sgn = s.w < 0 ? 1 : s.w > 0 ? -1 : 0;      // clockwise spin curls to the right of travel
  const spin = Math.min(1, Math.abs(s.w) / 0.5);
  const ac = CURL * s.cv * spin * curlShape(nsp) * (1 - SWEEP_CURL * eff);
  const phi = clamp(-sgn * ac * H / Math.max(nsp, 0.15), -0.02, 0.02);
  const c = Math.cos(phi), n = Math.sin(phi), ux = s.vx / sp, uy = s.vy / sp;
  s.vx = (ux * c - uy * n) * nsp;
  s.vy = (ux * n + uy * c) * nsp;
  s.x += s.vx * H; s.y += s.vy * H;
  s.ang += s.w * H;
  s.w *= 1 - 0.02 * H * 6;
}

function collide(a, b, ev) {
  const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, min = 2 * R;
  if (d2 >= min * min || d2 === 0) return false;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
  const over = min - d;
  const ma = a.vx !== 0 || a.vy !== 0, mb = b.vx !== 0 || b.vy !== 0;
  const ta = ma === mb ? 0.5 : ma ? 1 : 0;      // share of the correction taken by a
  a.x -= nx * over * ta; a.y -= ny * over * ta;
  b.x += nx * over * (1 - ta); b.y += ny * over * (1 - ta);
  const rvx = a.vx - b.vx, rvy = a.vy - b.vy;
  const vn = rvx * nx + rvy * ny;           // closing speed (positive = approaching)
  if (vn <= 0) return true;
  const J = (1 + E_REST) * vn / 2;
  a.vx -= J * nx; a.vy -= J * ny; b.vx += J * nx; b.vy += J * ny;
  // contact friction: passes some sideways motion and spin between the stones
  const tx = -ny, ty = nx;
  const slip = rvx * tx + rvy * ty + R * (a.w + b.w);
  const Jt = clamp(-slip / 6, -MU_C * J, MU_C * J);
  a.vx += Jt * tx; a.vy += Jt * ty; b.vx -= Jt * tx; b.vy -= Jt * ty;
  a.w += 2 * Jt / R; b.w += 2 * Jt / R;
  if (ev) ev.push({ k: 'hit', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: vn, a: a.id, b: b.id });
  return true;
}

// Advance the whole sheet by one step. `sweep` = { team, eff } sweeps that team's moving stones. Returns events.
export function stepWorld(w, sweep, ev = []) {
  const S = w.stones;
  let moving = false;
  for (const s of S) {
    if (s.mode !== 'play') continue;
    if (s.vx === 0 && s.vy === 0) continue;
    advance(s, sweep && sweep.team === s.team ? sweep.eff : 0);
    moving = true;
  }
  if (moving) {
    for (let i = 0; i < S.length; i++) {
      const a = S[i];
      if (a.mode !== 'play' || (a.vx === 0 && a.vy === 0)) continue;
      for (let j = 0; j < S.length; j++) {
        if (i === j) continue;
        const b = S[j];
        if (b.mode !== 'play') continue;
        if (Math.abs(b.y - a.y) > 2 * R || Math.abs(b.x - a.x) > 2 * R) continue;
        collide(a, b, ev);
      }
    }
    for (const s of S) {
      if (s.mode !== 'play') continue;
      if (Math.abs(s.x) + R > HALF_W) { s.mode = 'out'; s.why = 'side'; s.out = 0; s.vx = 0; s.vy = 0; ev.push({ k: 'out', id: s.id, why: 'side', x: s.x, y: s.y }); }
      else if (s.y - R > BACK) { s.mode = 'out'; s.why = 'back'; s.out = 0; s.vx = 0; s.vy = 0; ev.push({ k: 'out', id: s.id, why: 'back', x: s.x, y: s.y }); }
    }
  }
  w.t += H;
  w.settled = !moving || !S.some((s) => s.mode === 'play' && (s.vx !== 0 || s.vy !== 0));
  return ev;
}

// ---- throwing ------------------------------------------------------------------------------------------------
// turn: +1 curls right (clockwise handle turn), -1 curls left. theta: direction (rad, + to the right of the centre line).
export function launch(w, team, p) {
  const s = addStone(w, team, 0, HOG_NEAR);
  s.vx = p.v0 * Math.sin(p.theta); s.vy = p.v0 * Math.cos(p.theta);
  s.w = -p.turn * SPIN0;
  s.fr = p.fr ?? 1; s.cv = p.cv ?? 1;
  w.settled = false;
  w.thrown = s.id;
  return s;
}

// Stone-only trace on empty ice (used by the aim solver and the guide).
export function traceStone(turn, v0, theta, o = {}) {
  const s = newStone(0, 0, 0, HOG_NEAR);
  s.vx = v0 * Math.sin(theta); s.vy = v0 * Math.cos(theta); s.w = -turn * SPIN0; s.fr = o.fr ?? 1; s.cv = o.cv ?? 1;
  const eff = o.eff ?? 0, yT = o.yT, path = o.path ? [] : null;
  let cross = null, steps = 0, py = s.y;
  while ((s.vx !== 0 || s.vy !== 0) && steps < 4200) {
    py = s.y;
    advance(s, eff);
    steps++;
    if (path && steps % 6 === 0) path.push([s.x, s.y]);
    if (yT !== undefined && cross === null && s.y >= yT && py < yT) {
      const k = (yT - py) / (s.y - py || 1);
      cross = { x: s.x - s.vx * H * (1 - k), v: Math.hypot(s.vx, s.vy), t: steps * H };
    }
    if (Math.abs(s.x) + R > HALF_W || s.y - R > BACK) break;
  }
  return { x: s.x, y: s.y, t: steps * H, cross, path };
}

// Solve the release (speed and direction) that brings the stone to (px, py). arrival = 0: it stops there (a draw);
// arrival > 0: it passes there at that speed (a hit). Returns { v0, theta, ok, err }.
const solveCache = new Map();
export function solveShot(px, py, arrival, turn) {
  const key = `${Math.round(px * 400)}|${Math.round(py * 400)}|${Math.round(arrival * 20)}|${turn}`;
  const hit = solveCache.get(key);
  if (hit) return hit;
  const L = py - HOG_NEAR;
  let theta = Math.atan2(px, L) - turn * 0.012 * (arrival > 0 ? 0.4 : 1);
  let v0 = arrival > 0 ? 3.4 : Math.sqrt(2 * 0.17 * L);
  const probe = (v, th) => {
    const r = traceStone(turn, v, th, arrival > 0 ? { yT: py } : {});
    return arrival > 0 ? { x: r.cross ? r.cross.x : r.x, m: r.cross ? r.cross.v : 0, r } : { x: r.x, m: r.y, r };
  };
  const want = arrival > 0 ? arrival : py;
  let err = 9;
  for (let it = 0; it < 6; it++) {
    // find the speed (secant on v^2)
    let a = v0, fa = probe(a, theta).m - want;
    let b = a * 1.03, fb = probe(b, theta).m - want;
    for (let k = 0; k < 7 && Math.abs(fb) > 0.004; k++) {
      const slope = (fb - fa) / (b * b - a * a);
      if (!Number.isFinite(slope) || Math.abs(slope) < 1e-6) { a = b; b = b * 1.04; fa = fb; fb = probe(b, theta).m - want; continue; }
      const nb2 = clamp(b * b - fb / slope, 0.5, V_MAX * V_MAX);
      a = b; fa = fb; b = Math.sqrt(nb2); fb = probe(b, theta).m - want;
    }
    v0 = b;
    const pr = probe(v0, theta);
    const ex = pr.x - px;
    err = Math.abs(ex);
    if (err < 0.004) break;
    theta -= ex / L;
  }
  const out = { v0, theta, ok: err < 0.05 && v0 <= V_MAX + 1e-6, err };
  if (solveCache.size > 3000) solveCache.clear();
  solveCache.set(key, out);
  return out;
}

// ---- predictions ----------------------------------------------------------------------------------------------
// Where will this moving stone stop (or first touch another stone) if its team sweeps with effort `eff` from now on?
export function predictStone(w, id, eff, o = {}) {
  const me = w.stones.find((s) => s.id === id);
  if (!me || me.mode !== 'play') return null;
  const s = { ...me };
  const others = w.stones.filter((q) => q.id !== id && q.mode === 'play');
  const path = o.path ? [[s.x, s.y]] : null;
  let steps = 0;
  while ((s.vx !== 0 || s.vy !== 0) && steps < 4500) {
    advance(s, eff);
    steps++;
    if (path && steps % 5 === 0) path.push([s.x, s.y]);
    if (Math.abs(s.x) + R > HALF_W || s.y - R > BACK) return { kind: 'out', x: s.x, y: s.y, t: steps * H, path };
    for (const q of others) {
      if (Math.abs(q.y - s.y) <= 2 * R && Math.abs(q.x - s.x) <= 2 * R && Math.hypot(q.x - s.x, q.y - s.y) < 2 * R) {
        if (path) path.push([s.x, s.y]);
        return { kind: 'contact', x: s.x, y: s.y, t: steps * H, with: q.id, v: Math.hypot(s.vx, s.vy), path };
      }
    }
  }
  if (path) path.push([s.x, s.y]);
  return { kind: 'rest', x: s.x, y: s.y, t: steps * H, path };
}

// Run a world until everything rests. Used by the AI and the guide; the live game uses the same stepWorld.
export function settleWorld(w, sweep, maxT = MAX_SIM_T) {
  const ev = [];
  let n = 0;
  while (!w.settled && n < maxT * 60) { stepWorld(w, sweep, ev); n++; }
  if (!w.settled) for (const s of w.stones) { s.vx = 0; s.vy = 0; }
  w.settled = true;
  return ev;
}

// ---- rules on the ice ------------------------------------------------------------------------------------------
export const inHouse = (s) => toButton(s) < HOUSE_R + R;
// Free guard zone: between the far hog line and the tee line, outside the house.
export const inGuardZone = (s) => s.mode === 'play' && s.y - R >= HOG_FAR && s.y < 0 && !inHouse(s);

// Points if the end stopped now: { team, pts, order } (order = in-house stones, nearest first).
export function scoreEnd(w) {
  const order = w.stones.filter((s) => s.mode === 'play' && inHouse(s)).sort((a, b) => toButton(a) - toButton(b) || a.id - b.id);
  if (!order.length) return { team: null, pts: 0, order };
  const team = order[0].team;
  const other = order.find((s) => s.team !== team);
  const cut = other ? toButton(other) : Infinity;
  const counted = order.filter((s) => s.team === team && toButton(s) < cut);
  return { team, pts: counted.length, order, counted };
}

// Remove every stone that did not clear the far hog line. Returns the removed stones.
export function removeHogged(w) {
  const gone = [];
  for (const s of w.stones) if (s.mode === 'play' && s.y - R < HOG_FAR) { s.mode = 'out'; s.why = 'hog'; s.out = 0; gone.push(s); }
  return gone;
}

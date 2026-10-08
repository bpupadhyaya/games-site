// Marble physics: round balls on dirt. Constant rolling deceleration plus a little drag, near-elastic ball-to-ball
// collisions, four sub-steps per tick. Pure and deterministic (no clock, no randomness).
// World units: origin = centre of the ring. Ring (chalk line) radius RR, arena (the dirt circle) radius RA, the
// shooting line (where a shooter is placed) radius RT.
export const RR = 205, RA = 335, RT = 268, R_T = 18, R_S = 21;
export const FR = 450, DRAG = 0.22, VMIN = 150, VMAX = 1250, E_BALL = 0.94, STOP = 9;
const SUB = 4, TAU = Math.PI * 2;
export const VALUE = { clay: 1, glass: 2, king: 3 };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const powerToSpeed = (p) => VMIN + (VMAX - VMIN) * clamp(p, 0, 1);
export const speedToPower = (v) => clamp((v - VMIN) / (VMAX - VMIN), 0, 1);

// distance travelled by a ball launched at speed v (same integrator as stepWorld, single ball) - tabulated once.
const TABLE = [];
(() => {
  for (let v0 = 0; v0 <= 1300; v0 += 10) {
    let v = v0, d = 0;
    for (let i = 0; i < 6000 && v > STOP; i++) { const h = 1 / 240; d += v * h; v = Math.max(0, v - FR * h) * (1 - DRAG * h); }
    TABLE.push(d);
  }
})();
export function distanceForSpeed(v) { const i = clamp(v / 10, 0, TABLE.length - 1.001), k = Math.floor(i); return TABLE[k] + (TABLE[k + 1] - TABLE[k]) * (i - k); }
export function speedForDistance(d) {
  let lo = 0, hi = 1300;
  for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (distanceForSpeed(mid) < d) lo = mid; else hi = mid; }
  return hi;
}

const mk = (w, kind, x, y, variant, extra = {}) => ({
  id: w.nextId++, kind, side: -1, x, y, vx: 0, vy: 0, r: kind === 'shooter' ? R_S : R_T, m: kind === 'shooter' ? 1.35 : 1,
  rot: 0, ra: 0, variant, mode: 'live', heat: 0, hand: false, ...extra,
});

export function createWorld() {
  const w = { balls: [], settled: true, shot: null, nextId: 1, pre: null, hits: 0 };
  const sp = 2 * R_T + 1.5;
  w.balls.push(mk(w, 'king', 0, 0, 0));
  let n = 0;
  for (let a = 0; a < 4; a++) {
    const c = Math.cos((a * Math.PI) / 2), s = Math.sin((a * Math.PI) / 2);
    for (let k = 1; k <= 3; k++) {
      const glass = k === 2;
      w.balls.push(mk(w, glass ? 'glass' : 'clay', c * sp * k, s * sp * k, (n++) % 5));
    }
  }
  placeShooters(w);
  return w;
}
export function placeShooters(w) {
  for (let side = 0; side < 2; side++) {
    const old = w.balls.find((b) => b.kind === 'shooter' && b.side === side);
    if (old) w.balls.splice(w.balls.indexOf(old), 1);
    const b = mk(w, 'shooter', 0, side === 0 ? RT : -RT, side, { side, hand: true });
    w.balls.push(b);
  }
}
export const shooterOf = (w, side) => w.balls.find((b) => b.kind === 'shooter' && b.side === side);
export const targets = (w) => w.balls.filter((b) => b.kind !== 'shooter' && b.mode === 'live');
export const valueOf = (b) => VALUE[b.kind] ?? 0;
export function cloneWorld(w) { return { ...w, balls: w.balls.map((b) => ({ ...b })), pre: w.pre ? { ...w.pre } : null }; }
export const inRing = (b) => Math.hypot(b.x, b.y) < RR;
export const onLine = (ang) => ({ x: Math.cos(ang) * RT, y: Math.sin(ang) * RT });
export function spotBlocked(w, x, y, ignoreId = -1) {
  for (const b of w.balls) if (b.mode === 'live' && b.id !== ignoreId && Math.hypot(b.x - x, b.y - y) < b.r + R_S + 1) return true;
  return false;
}

export function launch(w, side, ang, power) {
  const sh = shooterOf(w, side), v = powerToSpeed(power);
  sh.vx = Math.cos(ang) * v; sh.vy = Math.sin(ang) * v; sh.hand = false;
  const opp = shooterOf(w, 1 - side);
  w.shot = { side, id: sh.id }; w.settled = false; w.hits = 0;
  w.pre = { oppIn: !!opp && opp.mode === 'live' && inRing(opp), ownIn: inRing(sh) };
}

export function stepWorld(w, dt) {
  const ev = [], h = dt / SUB, B = w.balls;
  for (let s = 0; s < SUB; s++) {
    for (const b of B) {
      if (b.mode !== 'live') continue;
      let sp = Math.hypot(b.vx, b.vy);
      if (sp > 0) {
        b.x += b.vx * h; b.y += b.vy * h;
        b.rot += (sp * h) / b.r; b.ra = Math.atan2(b.vy, b.vx);
        const ns = sp <= STOP ? 0 : Math.max(0, sp - FR * h) * (1 - DRAG * h);
        if (ns <= 0) { b.vx = 0; b.vy = 0; } else { const k = ns / sp; b.vx *= k; b.vy *= k; }
      }
      if (Math.hypot(b.x, b.y) > RA + b.r * 0.3) { b.mode = 'gone'; b.vx = 0; b.vy = 0; ev.push({ t: 'gone', id: b.id, x: b.x, y: b.y }); }
    }
    for (let i = 0; i < B.length; i++) {
      const a = B[i];
      if (a.mode !== 'live') continue;
      for (let j = i + 1; j < B.length; j++) {
        const c = B[j];
        if (c.mode !== 'live') continue;
        const dx = c.x - a.x, dy = c.y - a.y, md = a.r + c.r;
        if (dx > md || dx < -md || dy > md || dy < -md) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 >= md * md) continue;
        const d = Math.sqrt(d2) || 0.001, nx = dx / d, ny = dy / d, ov = md - d;
        const ia = 1 / a.m, ic = 1 / c.m, tot = ia + ic;
        a.x -= nx * ov * (ia / tot); a.y -= ny * ov * (ia / tot); c.x += nx * ov * (ic / tot); c.y += ny * ov * (ic / tot);
        const vn = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
        if (vn > 0) {
          const jn = ((1 + E_BALL) * vn) / tot;
          a.vx -= jn * ia * nx; a.vy -= jn * ia * ny; c.vx += jn * ic * nx; c.vy += jn * ic * ny;
          if (vn > 12) { ev.push({ t: 'hit', a: a.id, b: c.id, x: a.x + nx * a.r, y: a.y + ny * a.r, v: vn }); w.hits++; a.heat = Math.min(1, vn / 500); c.heat = Math.min(1, vn / 500); }
        }
      }
    }
  }
  let moving = false;
  for (const b of B) if (b.mode === 'live' && (b.vx !== 0 || b.vy !== 0)) { moving = true; break; }
  w.settled = !moving;
  return ev;
}
export function settle(w, max = 420) { for (let i = 0; i < max && !w.settled; i++) stepWorld(w, 1 / 60); w.settled = true; for (const b of w.balls) { b.vx = 0; b.vy = 0; } }

// After the shot has come to rest: who scored what. Removes collected marbles; sends a lost shooter back to the line.
export function resolveShot(w) {
  const side = w.shot.side, sh = shooterOf(w, side), opp = shooterOf(w, 1 - side), pre = w.pre ?? {};
  const got = [];
  for (const b of w.balls.slice()) {
    if (b.kind === 'shooter') continue;
    if (b.mode === 'gone' || (b.mode === 'live' && Math.hypot(b.x, b.y) > RR)) {
      got.push({ id: b.id, kind: b.kind, variant: b.variant, value: valueOf(b), x: b.x, y: b.y, off: b.mode === 'gone' });
      w.balls.splice(w.balls.indexOf(b), 1);
    }
  }
  let pts = got.reduce((s, g) => s + g.value, 0), capture = 0, shooterLost = false, captured = false;
  const home = (b, why) => { const a = Math.atan2(b.y, b.x) || 0; b.mode = 'live'; b.vx = 0; b.vy = 0; const p = onLine(a); b.x = p.x; b.y = p.y; b.hand = true; return why; };
  if (sh.mode === 'gone') { shooterLost = true; home(sh); }
  if (pre.oppIn && opp && (opp.mode === 'gone' || Math.hypot(opp.x, opp.y) > RR)) { capture = 2; captured = true; home(opp); }
  // shooters that were pushed apart onto a marble spot or each other are left alone: the collision pass already separated them
  w.shot = null;
  return { got, pts, capture, shooterLost, captured, total: pts + capture, shooterIn: inRing(sh) };
}

// The aim guide: the shooter's path to its first contact (and, with `full`, to rest), plus where the struck marble goes.
export function previewShot(w, side, ang, power, full = false, pos = null) {
  const k = cloneWorld(w), sh = shooterOf(k, side);
  if (pos) { sh.x = pos.x; sh.y = pos.y; }
  launch(k, side, ang, power);
  const path = [{ x: sh.x, y: sh.y }];
  let first = null, contact = null, hit = null, out = null, hitOut = false, afterFirst = 0;
  for (let i = 0; i < 300 && !k.settled; i++) {
    const ev = stepWorld(k, 1 / 60);
    path.push({ x: sh.x, y: sh.y });
    if (first === null) {
      const e = ev.find((q) => q.t === 'hit' && (q.a === sh.id || q.b === sh.id));
      if (e) {
        first = path.length - 1; contact = { x: sh.x, y: sh.y };
        const oid = e.a === sh.id ? e.b : e.a, ob = k.balls.find((q) => q.id === oid);
        hit = oid;
        if (ob) { const sp = Math.hypot(ob.vx, ob.vy) || 1; out = { x: ob.vx / sp, y: ob.vy / sp, sp, id: oid, x0: ob.x, y0: ob.y, kind: ob.kind }; }
      }
    } else { afterFirst++; if (!full && afterFirst > 1) break; }
  }
  const rest = full || first === null ? { x: sh.x, y: sh.y } : null;
  void hitOut;
  return { path, first, contact, hit, out, rest };
}

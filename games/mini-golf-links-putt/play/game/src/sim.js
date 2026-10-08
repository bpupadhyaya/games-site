// The green: ball physics, rails, bumpers, sand, slopes, water, boost pads, tunnels, windmills and gates.
// Pure and deterministic (fixed step, no clock, no randomness). Units are "feet-ish" course units; y runs down the screen
// in a hole's own (portrait) frame: the tee is near the bottom, the cup near the top. Walls are polylines; zones are
// rect / circle / polygon areas. The simulation owns every outcome; drawing only reads it.
export const BR = 0.34;            // ball radius
export const CUP_R = 0.66;         // cup radius
export const H = 1 / 120;          // fixed physics step
export const V_MAX = 22;           // speed at full power
const ROLL = 2.9;                  // rolling deceleration on the felt
const VISC = 0.05;                 // speed-proportional drag
const SAND_DEC = 15.5;             // deceleration in sand
const STOP_V = 0.11;               // slower than this on flat ground: at rest
export const CAP_V = 7.4;          // fastest the ball can be and still drop into the cup
const MAX_ROLL_T = 30;             // a ball is stopped after this long
export const SINK_T = 0.5;         // the drop animation length (drawing only)
export const WALL_RAD = 0.22;      // half the drawn width of a free-standing wall
const E = { timber: 0.68, stone: 0.76, hedge: 0.32, rubber: 1.0 };
export const MATS = Object.keys(E);

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// ---- point tests ---------------------------------------------------------------------------------------------------------
export function inPoly(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
export function inZone(z, x, y) {
  if (z.shape === 'circle') return (x - z.x) * (x - z.x) + (y - z.y) * (y - z.y) <= z.r * z.r;
  if (z.shape === 'poly') return inPoly(z.pts, x, y);
  return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
}
export function zoneBox(z) {
  if (z.shape === 'circle') return [z.x - z.r, z.y - z.r, z.x + z.r, z.y + z.r];
  if (z.shape === 'poly') { const xs = z.pts.map((p) => p[0]), ys = z.pts.map((p) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  return [z.x, z.y, z.x + z.w, z.y + z.h];
}

// ---- compiling a hole definition ---------------------------------------------------------------------------------------
const cache = new Map();
export function compileHole(def) {
  if (cache.has(def.id)) return cache.get(def.id);
  const segs = [], circles = [];
  const addPoly = (pts, closed, mat, kind, rad = 0) => {
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      segs.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], rad, e: E[mat] ?? E.timber, mat, kind, x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) });
    }
  };
  addPoly(def.outer, true, def.railMat ?? 'timber', 'outer');
  for (const isl of def.islands ?? []) addPoly(isl.pts, true, isl.mat ?? 'stone', 'island');
  for (const w of def.walls ?? []) addPoly(w.pts, !!w.closed, w.mat ?? 'timber', 'wall', WALL_RAD);
  for (const p of def.posts ?? []) circles.push({ x: p.x, y: p.y, r: p.r, e: E[p.mat ?? 'stone'], kick: 0, mat: p.mat ?? 'stone', kind: 'post' });
  for (const p of def.bumpers ?? []) circles.push({ x: p.x, y: p.y, r: p.r, e: 1.0, kick: 5.5, mat: 'rubber', kind: 'bumper' });
  const all = [...(def.sand ?? []), ...(def.slopes ?? []), ...(def.water ?? []), ...(def.bridges ?? []), ...(def.boosts ?? [])];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of def.outer) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const h = {
    def, id: def.id, segs, circles, box: { x0, y0, x1, y1 },
    mills: def.mills ?? [], gates: def.gates ?? [], tunnels: def.tunnels ?? [],
    sand: def.sand ?? [], slopes: def.slopes ?? [], water: def.water ?? [], bridges: def.bridges ?? [], boosts: def.boosts ?? [],
    hasMovers: (def.mills ?? []).length + (def.gates ?? []).length > 0, cycle: def.cycle ?? 4,
    cup: def.cup, tee: def.tee, par: def.par, zoneCount: all.length,
  };
  cache.set(def.id, h);
  return h;
}

// ---- moving obstacles --------------------------------------------------------------------------------------------------
// Returns the solid pieces at time t: capsules (segments with a thickness) and discs, each with a velocity function.
export function moversAt(h, t, out = { caps: [], discs: [] }) {
  out.caps.length = 0; out.discs.length = 0;
  for (const m of h.mills) {
    const w = (Math.PI * 2) / m.per * (m.dir ?? 1);
    const a0 = (m.ph ?? 0) * Math.PI * 2 + w * t;
    out.discs.push({ x: m.x, y: m.y, r: m.hub ?? 0.5, w: 0, cx: m.x, cy: m.y, e: E.stone });
    for (let i = 0; i < (m.n ?? 4); i++) {
      const a = a0 + (i * Math.PI * 2) / (m.n ?? 4);
      out.caps.push({ ax: m.x, ay: m.y, bx: m.x + Math.cos(a) * m.len, by: m.y + Math.sin(a) * m.len, rad: m.thick ?? 0.14, w, cx: m.x, cy: m.y, e: E.timber, kind: 'blade' });
    }
  }
  for (const g of h.gates) {
    const k = (Math.PI * 2) / g.per, s = Math.sin(k * t + (g.ph ?? 0) * Math.PI * 2), c = Math.cos(k * t + (g.ph ?? 0) * Math.PI * 2);
    const ox = g.dx * s, oy = g.dy * s;
    out.caps.push({ ax: g.ax + ox, ay: g.ay + oy, bx: g.bx + ox, by: g.by + oy, rad: g.thick ?? 0.2, w: 0, vx: g.dx * c * k, vy: g.dy * c * k, e: E.timber, kind: 'gate' });
  }
  return out;
}

// ---- the ball ------------------------------------------------------------------------------------------------------------
export function newBall(x, y) { return { x, y, vx: 0, vy: 0, mode: 'rest', t: 0, rot: 0, hd: 0, cool: 0, sink: 0, last: -1 }; }
export function launchBall(b, ang, power) {
  const v = V_MAX * clamp(power, 0, 1);
  b.vx = Math.cos(ang) * v; b.vy = Math.sin(ang) * v; b.mode = 'roll'; b.t = 0; b.cool = 0; b.last = -1;
}

function collideSeg(b, ax, ay, bx, by, rad, e, vel, ev, mat) {
  const abx = bx - ax, aby = by - ay, l2 = abx * abx + aby * aby || 1e-9;
  let t = ((b.x - ax) * abx + (b.y - ay) * aby) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + abx * t, cy = ay + aby * t, dx = b.x - cx, dy = b.y - cy, R = BR + rad, d2 = dx * dx + dy * dy;
  if (d2 >= R * R) return false;
  let d = Math.sqrt(d2), nx, ny;
  if (d < 1e-6) { const l = Math.sqrt(l2); nx = -aby / l; ny = abx / l; d = 0; } else { nx = dx / d; ny = dy / d; }
  b.x = cx + nx * R; b.y = cy + ny * R;
  let ox = 0, oy = 0;
  if (vel) { const v = vel(cx, cy); ox = v[0]; oy = v[1]; }
  const rvx = b.vx - ox, rvy = b.vy - oy, vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    const ee = -vn < 0.7 ? 0 : e;
    let tx = rvx - vn * nx, ty = rvy - vn * ny;
    tx *= 0.95; ty *= 0.95;
    b.vx = ox + tx - ee * vn * nx; b.vy = oy + ty - ee * vn * ny;
    if (-vn > 0.9) ev.push({ k: 'wall', v: -vn, x: cx, y: cy, mat });
  }
  return true;
}
function collideDisc(b, c, ev) {
  const dx = b.x - c.x, dy = b.y - c.y, R = BR + c.r, d2 = dx * dx + dy * dy;
  if (d2 >= R * R) return false;
  const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d;
  b.x = c.x + nx * R; b.y = c.y + ny * R;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= (1 + c.e) * vn * nx; b.vy -= (1 + c.e) * vn * ny;
    if (c.kick) {
      const sp = Math.hypot(b.vx, b.vy);
      if (sp < c.kick) { b.vx = nx * c.kick; b.vy = ny * c.kick; }
      ev.push({ k: 'bumper', v: -vn, x: c.x, y: c.y, r: c.r });
    } else if (-vn > 0.9) ev.push({ k: 'wall', v: -vn, x: b.x - nx * BR, y: b.y - ny * BR, mat: c.mat });
  }
  return true;
}

const tmpMovers = { caps: [], discs: [] };
// One physics step. `t` is the course clock (for windmills and gates). opts.noMovers ignores them (the aim guide).
// Appends events to `ev`: wall, bumper, sand, splash, sink, tunnel, boost.
export function stepBall(h, b, t, ev, opts) {
  if (b.mode !== 'roll') return;
  const sp0 = Math.hypot(b.vx, b.vy);
  // forces: slopes, boost pads
  let ax = 0, ay = 0, fric = ROLL, onSand = false, onBoost = false;
  for (const z of h.slopes) {
    if (!inZone(z, b.x, b.y)) continue;
    if (z.mode === 'out' || z.mode === 'in') {
      const dx = b.x - z.x, dy = b.y - z.y, d = Math.hypot(dx, dy) || 1e-6, R = z.r || 1;
      const f = z.k * Math.min(1, d / R) * (z.mode === 'in' ? -1 : 1);
      ax += (dx / d) * f; ay += (dy / d) * f;
    } else { ax += z.ax; ay += z.ay; }
  }
  for (const z of h.sand) if (inZone(z, b.x, b.y)) { fric = SAND_DEC; onSand = true; break; }
  for (const z of h.boosts) if (inZone(z, b.x, b.y)) { ax += z.dx * z.acc; ay += z.dy * z.acc; onBoost = true; }
  b.vx += ax * H; b.vy += ay * H;
  let sp = Math.hypot(b.vx, b.vy);
  if (sp > 0) {
    const dec = (fric + VISC * sp) * H;
    if (sp <= dec) {
      const slopeA = Math.hypot(ax, ay);
      if (slopeA > fric * 0.9 && !onBoost) { /* a steep slope keeps it moving */ } else { b.vx = 0; b.vy = 0; sp = 0; }
    } else { const k = (sp - dec) / sp; b.vx *= k; b.vy *= k; sp -= dec; }
  }
  if (sp > 0.3) b.hd = Math.atan2(b.vy, b.vx);
  if (sp > V_MAX * 1.35) { const k = (V_MAX * 1.35) / sp; b.vx *= k; b.vy *= k; sp = V_MAX * 1.35; }
  if (onBoost && sp0 < sp - 0.2 && (b.last | 0) !== 77) { ev.push({ k: 'boost' }); b.last = 77; } else if (!onBoost) b.last = -1;
  if (onSand && sp0 > 2.5 && (Math.round(b.t / H) % 20) === 0) ev.push({ k: 'sand', v: sp0, x: b.x, y: b.y });
  b.x += b.vx * H; b.y += b.vy * H; b.t += H;
  b.rot += sp * H / BR;
  if (b.cool > 0) b.cool -= H;
  // collisions (a few passes so corners settle)
  for (let pass = 0; pass < 3; pass++) {
    let hit = false;
    const R = BR + 0.3;
    for (let i = 0; i < h.segs.length; i++) {
      const s = h.segs[i];
      if (b.x < s.x0 - R || b.x > s.x1 + R || b.y < s.y0 - R || b.y > s.y1 + R) continue;
      if (collideSeg(b, s.ax, s.ay, s.bx, s.by, s.rad, s.e, null, ev, s.mat)) hit = true;
    }
    for (let i = 0; i < h.circles.length; i++) if (collideDisc(b, h.circles[i], ev)) hit = true;
    if (h.hasMovers && !opts?.noMovers) {
      const mv = moversAt(h, t, tmpMovers);
      for (const d of mv.discs) if (collideDisc(b, { x: d.x, y: d.y, r: d.r, e: d.e, kick: 0, mat: 'stone' }, ev)) hit = true;
      for (const c of mv.caps) {
        const vel = c.w ? (px, py) => [-c.w * (py - c.cy), c.w * (px - c.cx)] : () => [c.vx, c.vy];
        if (collideSeg(b, c.ax, c.ay, c.bx, c.by, c.rad, c.e, vel, ev, 'timber')) hit = true;
      }
    }
    if (!hit) break;
  }
  // water
  for (const z of h.water) {
    if (!inZone(z, b.x, b.y)) continue;
    let bridged = false;
    for (const br of h.bridges) if (inZone(br, b.x, b.y)) { bridged = true; break; }
    if (!bridged) { b.mode = 'water'; ev.push({ k: 'splash', x: b.x, y: b.y, v: sp }); b.vx = 0; b.vy = 0; return; }
  }
  // tunnels: enter one end, leave from the other
  if (b.cool <= 0) {
    for (const tn of h.tunnels) {
      for (let e = 0; e < 2; e++) {
        const a = e ? tn.b : tn.a, o = e ? tn.a : tn.b;
        if ((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y) < (tn.r ?? 0.8) * (tn.r ?? 0.8)) {
          const speed = Math.max(4.5, Math.hypot(b.vx, b.vy) * 0.92), ang = o.dir;
          ev.push({ k: 'tunnel', x: a.x, y: a.y, x2: o.x, y2: o.y });
          b.x = o.x + Math.cos(ang) * ((tn.r ?? 0.8) + BR + 0.05); b.y = o.y + Math.sin(ang) * ((tn.r ?? 0.8) + BR + 0.05);
          b.vx = Math.cos(ang) * speed; b.vy = Math.sin(ang) * speed; b.cool = 0.6;
          return;
        }
      }
    }
  }
  // the cup
  const c = h.cup, dx = c.x - b.x, dy = c.y - b.y, d = Math.hypot(dx, dy), spn = Math.hypot(b.vx, b.vy);
  if (d < CUP_R) {
    if (spn < CAP_V) {
      const pull = 38 * (1 - d / CUP_R);
      if (d > 1e-6) { b.vx += (dx / d) * pull * H; b.vy += (dy / d) * pull * H; }
      if (d < CUP_R * 0.62 || spn < 1.6) {
        b.mode = 'sunk'; b.sink = 0; b.x = c.x + (b.x - c.x) * 0.4; b.y = c.y + (b.y - c.y) * 0.4; b.vx = 0; b.vy = 0; ev.push({ k: 'sink', v: spn }); return;
      }
    } else if (spn < CAP_V * 1.35 && d < CUP_R * 0.9) {
      // a fast ball clips the lip and is turned aside
      const tx = -dy / d, ty = dx / d, s = (b.vx * tx + b.vy * ty) >= 0 ? 1 : -1, a = 0.28 * s, ca = Math.cos(a), sa = Math.sin(a);
      const nvx = b.vx * ca - b.vy * sa, nvy = b.vx * sa + b.vy * ca;
      b.vx = nvx * 0.9; b.vy = nvy * 0.9; ev.push({ k: 'lip', x: b.x, y: b.y });
    }
  }
  if (b.vx === 0 && b.vy === 0 || (Math.hypot(b.vx, b.vy) < STOP_V && Math.hypot(ax, ay) < fric * 0.9)) { b.vx = 0; b.vy = 0; b.mode = 'rest'; }
  else if (b.t > MAX_ROLL_T) { b.vx = 0; b.vy = 0; b.mode = 'rest'; }
}

// Roll a copy of the ball until it stops (or maxT seconds). Returns the end state and, optionally, the path.
// opts: { path:true, noMovers, until:'wall' (stop at the first rail), maxT }
export function simulate(h, start, ang, power, t0, opts = {}) {
  const b = { ...start, vx: 0, vy: 0 };
  launchBall(b, ang, power);
  const ev = [], path = opts.path ? [[b.x, b.y]] : null;
  const maxN = Math.round((opts.maxT ?? 14) / H);
  let bounces = 0, t = t0, sand = false, water = false, tunnel = false, boost = false, bump = 0, slope = false, steps = 0;
  const wallsHit = [];
  for (let n = 0; n < maxN && b.mode === 'roll'; n++) {
    ev.length = 0;
    stepBall(h, b, t, ev, opts);
    t += H; steps++;
    if (opts.path && n % 3 === 0) path.push([b.x, b.y]);
    if (!slope && h.slopes.length && n % 12 === 0) for (const z of h.slopes) if (inZone(z, b.x, b.y)) slope = true;
    if (!sand && h.sand.length && n % 12 === 0) for (const z of h.sand) if (inZone(z, b.x, b.y)) sand = true;
    for (const e of ev) {
      if (e.k === 'wall') { bounces++; wallsHit.push([e.x, e.y]); }
      else if (e.k === 'bumper') bump++;
      else if (e.k === 'splash') water = true;
      else if (e.k === 'tunnel') tunnel = true;
      else if (e.k === 'boost') boost = true;
    }
    if (opts.until === 'wall' && (bounces + bump) > 0) break;
    if (opts.until === 'bounce2' && (bounces + bump) > 1) break;
  }
  if (b.mode === 'roll' && !opts.until) b.mode = 'rest';
  if (opts.path) path.push([b.x, b.y]);
  return { x: b.x, y: b.y, mode: b.mode, speed: Math.hypot(b.vx, b.vy), bounces, bump, sand, water, tunnel, boost, slope, path, time: t - t0, steps, wallsHit };
}

// ---- walking distance to the cup (for the computer players and for hints) --------------------------------------------------
const CELL = 0.5;
const fields = new Map();
export function distField(h) {
  if (fields.has(h.id)) return fields.get(h.id);
  const { x0, y0, x1, y1 } = h.box;
  const nx = Math.ceil((x1 - x0) / CELL) + 1, ny = Math.ceil((y1 - y0) / CELL) + 1;
  const open = new Uint8Array(nx * ny), cost = new Float64Array(nx * ny).fill(1e9);
  const def = h.def;
  const near = (px, py) => {
    for (const s of h.segs) {
      if (px < s.x0 - 0.5 || px > s.x1 + 0.5 || py < s.y0 - 0.5 || py > s.y1 + 0.5) continue;
      const abx = s.bx - s.ax, aby = s.by - s.ay, l2 = abx * abx + aby * aby || 1e-9;
      const t = clamp(((px - s.ax) * abx + (py - s.ay) * aby) / l2, 0, 1);
      if (Math.hypot(px - (s.ax + abx * t), py - (s.ay + aby * t)) < BR * 0.9 + s.rad) return true;
    }
    for (const c of h.circles) if (Math.hypot(px - c.x, py - c.y) < c.r + BR * 0.9) return true;
    return false;
  };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const px = x0 + i * CELL, py = y0 + j * CELL;
    let ok = inPoly(def.outer, px, py);
    if (ok) for (const isl of def.islands ?? []) if (inPoly(isl.pts, px, py)) { ok = false; break; }
    if (ok && near(px, py)) ok = false;
    if (ok) {
      let w = false;
      for (const z of h.water) if (inZone(z, px, py)) { w = true; break; }
      if (w) { let br = false; for (const z of h.bridges) if (inZone(z, px, py)) { br = true; break; } if (!br) ok = false; }
    }
    open[j * nx + i] = ok ? 1 : 0;
  }
  const idx = (x, y) => clamp(Math.round((y - y0) / CELL), 0, ny - 1) * nx + clamp(Math.round((x - x0) / CELL), 0, nx - 1);
  const q = [];
  const start = idx(h.cup.x, h.cup.y);
  open[start] = 1; cost[start] = 0; q.push(start);
  // tunnel links
  const links = new Map();
  for (const tn of h.tunnels) { const a = idx(tn.a.x, tn.a.y), b = idx(tn.b.x, tn.b.y); links.set(a, b); links.set(b, a); open[a] = 1; open[b] = 1; }
  const sandAt = (i, j) => { const px = x0 + i * CELL, py = y0 + j * CELL; for (const z of h.sand) if (inZone(z, px, py)) return true; return false; };
  // Dijkstra with a simple binary heap
  const heap = [[0, start]];
  const push = (c, n) => { heap.push([c, n]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { let l = 2 * k + 1, r = l + 1, m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  heap.length = 0; push(0, start);
  while (heap.length) {
    const [c, n] = pop();
    if (c > cost[n]) continue;
    const i = n % nx, j = (n - i) / nx;
    const tryN = (ni, nj, w) => {
      if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) return;
      const m = nj * nx + ni;
      if (!open[m]) return;
      const cc = c + w * (sandAt(ni, nj) ? 2.2 : 1) * CELL;
      if (cc < cost[m]) { cost[m] = cc; push(cc, m); }
    };
    tryN(i + 1, j, 1); tryN(i - 1, j, 1); tryN(i, j + 1, 1); tryN(i, j - 1, 1);
    tryN(i + 1, j + 1, 1.414); tryN(i - 1, j + 1, 1.414); tryN(i + 1, j - 1, 1.414); tryN(i - 1, j - 1, 1.414);
    const lk = links.get(n);
    if (lk !== undefined && c + 1 < cost[lk]) { cost[lk] = c + 1; push(c + 1, lk); }
  }
  const f = {
    at(x, y) {
      const fi = (x - x0) / CELL, fj = (y - y0) / CELL;
      const i = clamp(Math.round(fi), 0, nx - 1), j = clamp(Math.round(fj), 0, ny - 1);
      let c = cost[j * nx + i];
      if (c >= 1e8) {
        // inside a wall cell: use the best neighbour
        let best = 1e9;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const a = clamp(i + di, 0, nx - 1), b = clamp(j + dj, 0, ny - 1); best = Math.min(best, cost[b * nx + a]); }
        c = best + 1;
      }
      return c >= 1e8 ? 400 : c;
    },
  };
  fields.set(h.id, f);
  return f;
}

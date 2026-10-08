// The brush: how pointer movement becomes width, wetness and dryness (pure and deterministic), and how a stroke's samples are painted.
// A sample is { x, y, w, l, p, d } = position, width (page units), load (ink left, 0..1), pressure (0..1), distance along the stroke.
import { TYPES, envAt } from './lessons.js';
import { mk } from './art.js';

export const BRUSH = {
  vMax: 700,          // page units per second at which the stroke is thinnest
  spacing: 2.5,       // distance between samples
  drain: 0.0004,     // load lost per page unit of travel at average width
  dryBelow: 0.5,      // under this load the bristles start to split
  restAfter: 0.12,     // seconds of stillness before the ink starts to pool
  poolRate: 1.6,      // swell per second while the brush rests on the paper
  swellMax: 0.6,
  swellDecay: 0.012,  // per page unit travelled
  sizes: [{ name: 'Small', k: 0.65 }, { name: 'Medium', k: 1 }, { name: 'Large', k: 1.5 }],
  darkAt: 0.66, midAt: 0.38,
};
export const toneBand = (d) => (d >= BRUSH.darkAt ? 'dark' : d >= BRUSH.midAt ? 'mid' : 'pale');
export const toneAlpha = (d) => 0.18 + 0.8 * Math.pow(Math.max(0, Math.min(1, d)), 0.7);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Integer hash noise in [0,1): the same input always paints the same bristles.
export function hash(a, b = 0, c = 0) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const newBrush = () => ({ load: 0, tone: 0.7 });

export function beginStroke(brush, x, y, base, sizeIdx) {
  const b = base * BRUSH.sizes[sizeIdx].k;
  return { tone: brush.tone, load0: brush.load, b, px: x, py: y, s: [{ x, y, w: b * 0.45 * (0.35 + 0.95 * 0.6), l: brush.load, p: 0.6, d: 0 }], len: 0, vs: 0, p: 0.6, swell: 0, rest: 0, ax: x, ay: y, dx: 0, dy: 1, t: 0, pool: 0 };
}

function pushSample(st, brush, x, y, dist, p) {
  const prev = st.s[st.s.length - 1];
  st.len += dist;
  const land = clamp(0.45 + st.len / 14, 0.45, 1);
  const dir = Math.atan2(y - prev.y, x - prev.x);
  const dirK = 1 + 0.08 * Math.sin(dir);                                   // strokes pulled downwards carry a little more ink
  st.swell = Math.max(0, st.swell - BRUSH.swellDecay * dist);
  let w = st.b * (0.15 + 1.15 * p) * (1 + st.swell) * land * dirK;
  brush.load = Math.max(0, brush.load - BRUSH.drain * dist * (0.5 + w / st.b));
  st.s.push({ x, y, w, l: brush.load, p, d: st.len });
}

// Advance a stroke to a new pointer position. dt is the time since the last call (seconds).
export function strokeMove(st, brush, x, y, dt, pen = null) {
  st.t += dt;
  const last = st.s[st.s.length - 1], dx = x - last.x, dy = y - last.y, dist = Math.hypot(dx, dy);
  const inst = dt > 0 ? Math.hypot(x - st.px, y - st.py) / dt : 0;       // speed from the pointer itself, not from the last painted sample
  st.px = x; st.py = y;
  st.vs = st.vs * 0.8 + inst * 0.2;
  let p = clamp(1 - st.vs / BRUSH.vMax, 0, 1);
  if (pen !== null && pen > 0) p = clamp(p * 0.35 + (0.12 + 0.88 * pen) * 0.65, 0, 1);   // a stylus with real pressure leads; speed still adds a little
  st.p = st.p * 0.7 + p * 0.3;
  if (dist < BRUSH.spacing) {
    if (inst > 8) { st.rest = 0; return; }                                 // slow drag: wait until the pointer has moved a full spacing
    st.rest += dt;
    if (st.rest > BRUSH.restAfter) {                                       // the brush rests: ink pools
      st.swell = Math.min(BRUSH.swellMax, st.swell + dt * BRUSH.poolRate); st.pool += dt;
      if (st.pool >= 0.05) { st.pool = 0; const l = st.s[st.s.length - 1]; st.s.push({ x: l.x, y: l.y, w: Math.max(l.w, st.b * (0.9 + st.swell * 0.8)), l: brush.load, p: 1, d: st.len }); }
    }
    return;
  }
  st.rest = 0; st.dx = dx / dist; st.dy = dy / dist;
  const n = Math.max(1, Math.floor(dist / BRUSH.spacing)), step = dist / n;
  for (let i = 1; i <= n; i++) pushSample(st, brush, last.x + (dx * i) / n, last.y + (dy * i) / n, step, st.p);
}

// Lift: the tip leaves the paper with a tail that depends on how fast the hand was moving.
export function strokeEnd(st, brush) {
  const last = st.s[st.s.length - 1], tail = clamp(st.vs * 0.045, 5, 34), n = Math.max(2, Math.round(tail / BRUSH.spacing));
  for (let i = 1; i <= n; i++) {
    const f = i / n, w = last.w * Math.pow(1 - f, 1.4) + 0.4;
    const x = last.x + st.dx * tail * f, y = last.y + st.dy * tail * f;
    brush.load = Math.max(0, brush.load - BRUSH.drain * (tail / n) * 0.5);
    st.len += tail / n;
    st.s.push({ x, y, w, l: brush.load, p: 0.2, d: st.len });
  }
  st.done = true;
  return st;
}

export const dryness = (s, v = 0) => clamp((BRUSH.dryBelow - s.l) / BRUSH.dryBelow * 1.2 + Math.max(0, (v - 480) / 700) * 0.5, 0, 1);

// ---- painting ------------------------------------------------------------------------------------------------------------------------------------
let sprite = null;
export function getSprite() {
  if (sprite !== null) return sprite;
  const N = 64, c = mk(N, N);
  if (!c) { sprite = false; return false; }
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.68, 'rgba(0,0,0,0.96)'); gr.addColorStop(0.9, 'rgba(0,0,0,0.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
  sprite = c;
  return c;
}

// Paint the part of a stroke between sample i0 and the end (ctx is in page units, drawing black; the caller applies tone as alpha).
export function paintSamples(ctx, samples, i0, seedBase = 0) {
  const sp = getSprite();
  if (!sp) return;
  const N = 16;
  for (let i = Math.max(1, i0); i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i], dist = Math.hypot(b.x - a.x, b.y - a.y);
    const wMean = (a.w + b.w) / 2, nst = Math.max(1, Math.ceil(dist / Math.max(0.8, wMean * 0.07)));
    const dry = dryness(b, 0), wet = clamp(b.l * 1.2, 0, 1);
    const ang = dist > 0 ? Math.atan2(b.y - a.y, b.x - a.x) : 0, nx = -Math.sin(ang), ny = Math.cos(ang);
    for (let k = 1; k <= nst; k++) {
      const f = k / nst, x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f, w = a.w + (b.w - a.w) * f, r = w / 2;
      ctx.globalAlpha = (0.14 + 0.2 * b.p) * (1 - 0.9 * dry);
      if (ctx.globalAlpha > 0.004) ctx.drawImage(sp, x - r, y - r, w, w);
      if (wet > 0.35 && (k & 1) === 0) {                                      // bleeding into the paper: a wider, very light halo with a fibre offset
        const j = (hash(i, k, seedBase) - 0.5) * w * 0.25, rr = r * (1.3 + 0.25 * wet);
        ctx.globalAlpha = 0.018 * wet * (0.4 + b.p);
        ctx.drawImage(sp, x + nx * j - rr, y + ny * j - rr, rr * 2, rr * 2);
      }
    }
    if (dry > 0.06) {                                                         // dry brush: split bristles with flying white
      
      ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
      for (let q = 0; q < N; q++) {
        const o = ((q + 0.5) / N - 0.5) * b.w * 0.95;
        const seg = Math.floor(b.d / (26 + ((q * 13) % 41)));          // each bristle runs out and recovers at its own pace: streaks, not rungs
        if (hash(q, seg, seedBase + 7) < dry * 0.9) continue;
        ctx.globalAlpha = 0.5 + 0.4 * hash(q, seg, 3);
        ctx.lineWidth = Math.max(0.9, (b.w / N) * 1.9);
        ctx.beginPath(); ctx.moveTo(a.x + nx * o * (a.w / (b.w || 1)), a.y + ny * o * (a.w / (b.w || 1))); ctx.lineTo(b.x + nx * o, b.y + ny * o); ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
}

// ---- synthetic strokes (Watch and Learn, the title hero, figures): the same samples a hand would make along a model path -------------------------------------
export function synthSamples(path, type, base, o = {}) {
  const out = [], P = path, L0 = P.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - P[i - 1][0], p[1] - P[i - 1][1]) : 0), 0) || 1;
  const n = Math.max(2, Math.round(L0 / BRUSH.spacing)); let load = o.load ?? 1;
  let seg = 1, acc = 0;
  for (let i = 0; i <= n; i++) {
    const target = (L0 * i) / n;
    while (seg < P.length - 1 && acc + Math.hypot(P[seg][0] - P[seg - 1][0], P[seg][1] - P[seg - 1][1]) < target) { acc += Math.hypot(P[seg][0] - P[seg - 1][0], P[seg][1] - P[seg - 1][1]); seg++; }
    const a = P[seg - 1], b = P[seg], sl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, f = clamp((target - acc) / sl, 0, 1);
    const u = i / n, w = base * 0.85 * envAt(type, u) * (o.k ?? 1);
    load = Math.max(0, load - BRUSH.drain * (L0 / n) * (0.5 + envAt(type, u) * 0.85));
    out.push({ x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, w: Math.max(0.6, w), l: load, p: clamp(0.8 - envAt(type, u) * 0.4, 0, 1), d: target });
  }
  return out;
}

export function tonePaint(ctx, tone) { ctx.globalAlpha = toneAlpha(tone); }
export const typeInfo = (t) => TYPES[t];

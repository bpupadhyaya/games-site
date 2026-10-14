// Drawing of the sea scene: a sky that travels from dawn to dusk, swells running in toward the stilt, the water in cut-away
// with light shafts, sand, rocks, weed and fish, the stilt with the fisherman, the line, float and bait, and the splashes.
// Pure drawing from a `ws` object (see game.js); no state is kept here except small caches.
import { SPECIES, SPOTS, clamp, lerp } from './sim.js';

const TAU = Math.PI * 2;
const hs = (n) => { let x = Math.imul(n | 0, 0x45d9f3b); x ^= x >>> 16; x = Math.imul(x, 0x45d9f3b); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

// ---- colour helpers --------------------------------------------------------------------------------------------------
const hexCache = new Map();
function rgb(h) {
  let v = hexCache.get(h);
  if (!v) { const n = parseInt(h.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; hexCache.set(h, v); }
  return v;
}
export function mix(a, b, k) {
  const A = rgb(a), B = rgb(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * k)},${Math.round(A[1] + (B[1] - A[1]) * k)},${Math.round(A[2] + (B[2] - A[2]) * k)})`;
}
const mixH = (a, b, k) => { // same but returns #hex so it can be mixed again
  const A = rgb(a), B = rgb(b), c = (i) => Math.round(A[i] + (B[i] - A[i]) * k).toString(16).padStart(2, '0');
  return `#${c(0)}${c(1)}${c(2)}`;
};
const rgba = (h, a) => { const c = rgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

// Light at a time of day t (0 dawn, 0.25 morning, 0.5 noon, 0.75 golden hour, 1 dusk).
const KEYS = [
  { t: 0.0, sky: ['#26336c', '#d8728c', '#ffbc78'], far: '#f6b58c', near: '#3a6c92', top: '#4b8ca6', deep: '#0e2a4a', sun: '#fff0c0', amb: 0.78, rim: '#ffc27a' },
  { t: 0.25, sky: ['#3a78c8', '#8ec4ee', '#f4e6c8'], far: '#cfe8ee', near: '#2e86ac', top: '#35aebd', deep: '#0c3f63', sun: '#ffffff', amb: 1.0, rim: '#fff0d0' },
  { t: 0.5, sky: ['#2f74d2', '#7fc0f2', '#d8f0ff'], far: '#a8dcec', near: '#1f8fb0', top: '#2fb6c4', deep: '#0b4a6a', sun: '#ffffff', amb: 1.0, rim: '#ffffff' },
  { t: 0.75, sky: ['#4a5fae', '#f09a6c', '#ffd08a'], far: '#ffc088', near: '#3b6f98', top: '#4b9aaa', deep: '#10314f', sun: '#ffd89a', amb: 0.9, rim: '#ffb468' },
  { t: 1.0, sky: ['#1a1f52', '#b34f7c', '#ff8f62'], far: '#ff9a6a', near: '#38336c', top: '#5a6ea4', deep: '#0d1a40', sun: '#ffb27c', amb: 0.7, rim: '#ff9060' },
];
const STORM = { sky: ['#4a5260', '#6c7684', '#98a2ac'], far: '#8e9aa4', near: '#3a5266', top: '#3f7a8c', deep: '#0e2a3c' };
export function lightAt(tod, storm) {
  const t = clamp(tod, 0, 1);
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  const a = KEYS[i], b = KEYS[i + 1], k = clamp((t - a.t) / (b.t - a.t), 0, 1);
  const L = {
    sky: [mixH(a.sky[0], b.sky[0], k), mixH(a.sky[1], b.sky[1], k), mixH(a.sky[2], b.sky[2], k)],
    far: mixH(a.far, b.far, k), near: mixH(a.near, b.near, k), top: mixH(a.top, b.top, k), deep: mixH(a.deep, b.deep, k),
    sun: mixH(a.sun, b.sun, k), amb: lerp(a.amb, b.amb, k), rim: mixH(a.rim, b.rim, k),
  };
  if (storm) {
    const m = 0.78;
    L.sky = L.sky.map((c, j) => mixH(c, STORM.sky[j], m)); L.far = mixH(L.far, STORM.far, m); L.near = mixH(L.near, STORM.near, m);
    L.top = mixH(L.top, STORM.top, 0.7); L.deep = mixH(L.deep, STORM.deep, 0.7); L.amb *= 0.8; L.storm = true;
  }
  return L;
}

// ---- geometry ----------------------------------------------------------------------------------------------------------
// One place for where things are, so game.js (tapping the sea) and the drawing agree.
export function sceneGeom(rect) {
  const { x, y, w, h } = rect, land = w > h;
  const hor = y + h * 0.27, sy = y + h * 0.42, floor = y + h * 0.965;
  const poleX = x + w * (land ? 0.17 : 0.22);
  const x0 = poleX + w * 0.07, x1 = x + w - w * 0.045;
  const u = Math.min(h * 0.205, w * 0.3);       // fisherman scale: about his seated height
  const barY = sy - Math.min(h * 0.155, u * 0.88);
  return {
    rect, land, hor, sy, floor, poleX, barY, u, k: u / 100, x0, x1,
    fx: (wx) => x0 + wx * (x1 - x0), fy: (d) => sy + h * 0.04 + d * (floor - sy - h * 0.1),
    wx: (px) => (px - x0) / (x1 - x0), wd: (py) => (py - (sy + h * 0.04)) / (floor - sy - h * 0.1),
    ref: Math.min(w, h * 1.05),
  };
}

// ---- particles ---------------------------------------------------------------------------------------------------------
export function stepFx(parts, dt) {
  for (const p of parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
}
export function splash(parts, rng, x, y, n = 10, power = 1) {
  for (let i = 0; i < n && parts.length < 160; i++) {
    const a = -Math.PI / 2 + (rng.next() - 0.5) * 1.5, sp = (60 + rng.next() * 150) * power;
    parts.push({ kind: 'drop', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 520, t: 0, max: 0.55 + rng.next() * 0.4, r: 1.5 + rng.next() * 2.4 });
  }
}
export function bubbles(parts, rng, x, y, n = 4) {
  for (let i = 0; i < n && parts.length < 160; i++) parts.push({ kind: 'bub', x: x + (rng.next() - 0.5) * 16, y, vx: (rng.next() - 0.5) * 10, vy: -(24 + rng.next() * 30), g: 0, t: 0, max: 0.9 + rng.next() * 0.9, r: 1.5 + rng.next() * 2.5 });
}

// ---- fish --------------------------------------------------------------------------------------------------------------
const ASPECT = [0.24, 0.26, 0.33, 0.27, 0.36, 0.36, 0.15, 0.31, 0.3];
export function fishLen(g, cm) { return g.ref * (0.034 + cm * 0.00132); }
// dir +1 faces right. wob is the tail phase, thrash widens the body bend. alpha for fading with depth.
export function drawFish(ctx, x, y, len, dir, sp, o = {}) {
  const { wob = 0, thrash = 0, alpha = 1, tint = null, belly = 1 } = o;
  const S = SPECIES[sp], asp = ASPECT[sp], hgt = len * asp;
  ctx.save();
  ctx.translate(x, y); ctx.scale(dir, 1);
  ctx.rotate(Math.sin(wob * 0.7) * 0.04 * (1 + thrash * 3));
  ctx.globalAlpha = alpha;
  const bend = Math.sin(wob) * len * (0.05 + thrash * 0.06);
  const L = len / 2;
  // tail
  ctx.fillStyle = S.col[2];
  ctx.beginPath();
  ctx.moveTo(-L * 0.8, 0);
  ctx.quadraticCurveTo(-L * 1.0, bend * 0.4, -L * 1.22, -hgt * 0.62 + bend);
  ctx.quadraticCurveTo(-L * 1.05, bend * 0.5, -L * 1.1, bend * 0.4 + hgt * 0.04);
  ctx.quadraticCurveTo(-L * 1.05, bend * 0.5 + hgt * 0.1, -L * 1.22, hgt * 0.62 + bend);
  ctx.quadraticCurveTo(-L * 1.0, bend * 0.4, -L * 0.8, 0);
  ctx.fill();
  // dorsal fin(s)
  ctx.beginPath(); ctx.moveTo(-L * 0.25, -hgt * 0.45); ctx.quadraticCurveTo(-L * 0.05, -hgt * 1.05, L * 0.15, -hgt * 0.5); ctx.closePath(); ctx.fill();
  if (sp === 8) { ctx.fillStyle = '#e6c23a'; ctx.beginPath(); ctx.moveTo(-L * 0.55, -hgt * 0.3); ctx.lineTo(-L * 0.8, -hgt * 0.22); ctx.lineTo(-L * 0.55, -hgt * 0.15); ctx.fill(); }
  // body
  const g = ctx.createLinearGradient(0, -hgt / 2, 0, hgt / 2);
  g.addColorStop(0, S.col[0]); g.addColorStop(0.55, mixH(S.col[0], S.col[1], 0.5 * belly)); g.addColorStop(1, S.col[1]);
  ctx.beginPath();
  ctx.moveTo(L, 0);
  ctx.quadraticCurveTo(L * 0.85, -hgt * 0.62, L * 0.2, -hgt * 0.52);
  ctx.quadraticCurveTo(-L * 0.4, -hgt * 0.42 + bend * 0.3, -L * 0.85, bend * 0.1);
  ctx.quadraticCurveTo(-L * 0.4, hgt * 0.42 + bend * 0.3, L * 0.2, hgt * 0.5);
  ctx.quadraticCurveTo(L * 0.85, hgt * 0.5, L, 0);
  ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  if (sp === 2) { ctx.strokeStyle = 'rgba(40,30,10,0.35)'; ctx.lineWidth = Math.max(1, len * 0.012); for (let i = 0; i < 5; i++) { const sx = -L * 0.35 + i * L * 0.2; ctx.beginPath(); ctx.moveTo(sx, -hgt * 0.4); ctx.lineTo(sx - L * 0.05, hgt * 0.15); ctx.stroke(); } }
  if (sp === 3) { ctx.strokeStyle = 'rgba(10,40,60,0.45)'; ctx.lineWidth = Math.max(1, len * 0.012); for (let i = 0; i < 6; i++) { const sx = -L * 0.5 + i * L * 0.16; ctx.beginPath(); ctx.moveTo(sx, -hgt * 0.42); ctx.quadraticCurveTo(sx + L * 0.06, -hgt * 0.1, sx, hgt * 0.02); ctx.stroke(); } }
  if (sp === 5) { ctx.fillStyle = 'rgba(255,230,160,0.35)'; ctx.beginPath(); ctx.ellipse(L * 0.1, -hgt * 0.1, L * 0.5, hgt * 0.16, 0, 0, TAU); ctx.fill(); }
  // pectoral fin and gill line
  ctx.fillStyle = S.col[2]; ctx.globalAlpha = alpha * 0.85;
  ctx.beginPath(); ctx.moveTo(L * 0.25, hgt * 0.1); ctx.quadraticCurveTo(L * 0.05, hgt * 0.45, -L * 0.12, hgt * 0.35); ctx.quadraticCurveTo(L * 0.05, hgt * 0.2, L * 0.25, hgt * 0.1); ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = Math.max(1, len * 0.01);
  ctx.beginPath(); ctx.arc(L * 0.38, 0, hgt * 0.42, -1.1, 1.1); ctx.stroke();
  // eye
  ctx.fillStyle = '#f6f2e4'; ctx.beginPath(); ctx.arc(L * 0.7, -hgt * 0.1, Math.max(1.5, hgt * 0.13), 0, TAU); ctx.fill();
  ctx.fillStyle = '#10141c'; ctx.beginPath(); ctx.arc(L * 0.72, -hgt * 0.1, Math.max(1, hgt * 0.075), 0, TAU); ctx.fill();
  void tint;
  ctx.restore();
}

// ---- the fisherman -------------------------------------------------------------------------------------------------------------
// Origin: the seat on the crossbar. Returns the rod tip in screen coordinates.
const SKIN = ['#b8794d', '#8f5a38'], SHIRT = ['#e9e2cf', '#b9b09a'], SARONG = ['#2b4f8f', '#1a3263'], HAIR = '#1b1410';
function limb(ctx, pts, w0, w1, col, rim) {
  // a tapered limb through points (polyline with round joins), drawn as stacked strokes
  const n = pts.length;
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass === 0 ? col : rim; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < n - 1; i++) {
      const k = i / (n - 1);
      ctx.lineWidth = lerp(w0, w1, k) * (pass === 0 ? 1 : 0.28);
      ctx.beginPath();
      ctx.moveTo(pts[i][0] + (pass ? lerp(w0, w1, k) * 0.22 : 0), pts[i][1] - (pass ? lerp(w0, w1, k) * 0.12 : 0));
      ctx.lineTo(pts[i + 1][0] + (pass ? lerp(w0, w1, k) * 0.22 : 0), pts[i + 1][1] - (pass ? lerp(w0, w1, k) * 0.12 : 0));
      ctx.stroke();
    }
  }
}
export function drawFisherman(ctx, g, rig, L, o = {}) {
  const { k } = g, t = o.t || 0;
  const s = rig.s, fell = rig.fell, fight = rig.fight;
  const sx = g.poleX + 2 * k, sy = g.barY - 2 * k;
  const amb = L.amb;
  const lit = (c) => mix(c, '#000000', (1 - amb) * 0.55);
  const rimC = rgba(L.rim, 0.8);
  // fall: slides off to the side and drops into the sea
  let fx = sx, fyy = sy, rot = 0, vis = 1;
  if (fell) {
    const q = clamp(fell.t / 0.9, 0, 1);
    fx = sx + fell.side * q * 40 * k; fyy = sy + q * q * (g.sy - sy + 40 * k); rot = fell.side * (0.3 + q * 1.8);
    vis = fell.t < 0.9 ? 1 : 0;
    if (fell.t > FALL_BACK_START(fell)) { // climbing back: shown halfway up the pole
      const c = clamp((fell.t - FALL_BACK_START(fell)) / (fell.dur - FALL_BACK_START(fell)), 0, 1);
      fx = sx; fyy = lerp(g.sy + 30 * k, sy, c * c); rot = 0; vis = 1;
    }
  }
  if (!vis) return { tipX: sx + 150 * k, tipY: sy - 40 * k, hidden: true };
  const lean = rot || s * 0.42 + 0.1 + (fight ? 0.05 * fight.T : 0);
  const breathe = Math.sin(t * 1.9) * 0.012;
  // the hand and the bent rod in the figure's local frame (origin: the seat, 1 unit = 1 px at scale k)
  const tug0 = fight ? clamp(fight.T, 0, 1) : 0;
  const pull0 = fight ? 3 + tug0 * 7 : 0;
  const hand0 = [44 - pull0, -40 + pull0 * 0.4 + Math.sin(t * 2.4) * 0.7];
  const ang0 = -0.52 - tug0 * 0.08, len0 = 150;
  const rg = { bx: -8, by: -22, tx: hand0[0] + Math.cos(ang0) * len0, ty: hand0[1] + Math.sin(ang0) * len0 };
  const bow0 = (fight ? 10 + tug0 * 22 : 4) + (o.cast || 0) * 12;
  rg.cx = (rg.bx + rg.tx) / 2 + 2; rg.cy = (rg.by + rg.ty) / 2 + bow0;
  const climbing = !!fell && rot === 0;
  // climbing back up the pole: the rod is held upright along the pole, not across the body
  if (climbing) { rg.tx = rg.bx + 10; rg.ty = rg.by - 120; rg.cx = rg.bx + 5; rg.cy = (rg.by + rg.ty) / 2; }
  const f3 = globalThis.__fisher3d;
  if (f3 && f3.draw && !f3.off && !o.flat) {
    // real 3D fisherman: the whole picture turns for a fall, the torso leans for normal play
    // a fall is body motion (no picture tumble): the hands catch the bar and the body drops, he lets go into the sea; the climb is hand over hand
    let tilt = lean + breathe, fall3 = null, X = fx, Y = fyy, rg3 = rg;
    if (fell) {
      const SLIP = 0.4, DROPL = 38, back = FALL_BACK_START(fell);
      X = sx;
      if (fell.t < SLIP) { const e = clamp(fell.t / SLIP, 0, 1), d = DROPL * e * e * (3 - 2 * e); Y = sy + d * k; fall3 = { mode: 'slip', t: fell.t, drop: d }; }
      else if (fell.t < 0.9) {
        const u = (fell.t - SLIP) / (0.9 - SLIP); Y = sy + (DROPL + u * u * ((g.sy - sy) / k - DROPL + 34)) * k; fall3 = { mode: 'drop', t: fell.t, q: Math.min(1, u * 4), drop: 0 };
      } else if (fell.t > back) { fall3 = { mode: 'climb', t: fell.t, c: clamp((fell.t - back) / (fell.dur - back), 0, 1) }; }
      tilt = 0;
      // the rod lies across the bar while he hangs, falls with him, and is carried upright along the pole on the way up
      if (fall3 && fall3.mode === 'slip') rg3 = { bx: -26, by: -fall3.drop - 5, tx: 100, ty: -fall3.drop - 18, cx: 40, cy: -fall3.drop - 6 };
      else if (fall3 && fall3.mode === 'drop') rg3 = { bx: -30, by: -22, tx: 70, ty: -40, cx: 20, cy: -20 };
      else if (fall3) rg3 = { bx: -9, by: 30, tx: -8, ty: -120, cx: -8, cy: -45 };
    }
    ctx.save();
    ctx.translate(X, Y); ctx.scale(k, k);
    const ok = f3.draw(ctx, { t, lean: tilt, tug: tug0, cast: o.cast || 0, panic: fall3 && fall3.mode === 'drop' ? 0.8 : 0, hand: hand0, rod: rg3, fall: fall3, amb: L.amb, storm: !!L.storm });
    ctx.restore();
    if (ok) {
      const cr = Math.cos(tilt), sr = Math.sin(tilt);
      return { tipX: X + (rg3.tx * cr - rg3.ty * sr) * k, tipY: Y + (rg3.tx * sr + rg3.ty * cr) * k };
    }
  }
  if (f3 && f3.pending) return { tipX: fx + (rg.tx * Math.cos(lean) - rg.ty * Math.sin(lean)) * k, tipY: fyy + (rg.tx * Math.sin(lean) + rg.ty * Math.cos(lean)) * k };
  ctx.save();
  ctx.translate(fx, fyy);
  ctx.scale(k, k);
  ctx.rotate(lean + breathe);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // far leg (wrapped round the pole) and far arm are drawn first, darker
  limb(ctx, [[-4, 2], [4, 22], [-6, 46], [-12, 64]], 17, 9, lit(SARONG[1]), 'rgba(255,255,255,0.0)');
  ctx.fillStyle = lit(SKIN[1]); ctx.beginPath(); ctx.ellipse(-12, 66, 9, 5, 0.2, 0, TAU); ctx.fill();
  // near leg: thigh forward over the bar, shin hanging, foot on the rest
  const tug = fight ? clamp(fight.T, 0, 1) : 0;
  limb(ctx, [[2, 0], [30, 8], [40, 34], [36, 62]], 21, 11, lit(SARONG[0]), rgba(L.rim, 0.5));
  ctx.fillStyle = lit(SKIN[0]); ctx.beginPath(); ctx.ellipse(40, 66, 11, 5.5, 0, 0, TAU); ctx.fill();
  // sarong cloth over the lap
  ctx.beginPath();
  ctx.moveTo(-14, -3); ctx.quadraticCurveTo(10, -14, 38, 4); ctx.quadraticCurveTo(44, 22, 34, 40); ctx.quadraticCurveTo(16, 30, 4, 34); ctx.quadraticCurveTo(-12, 24, -14, -3); ctx.closePath();
  const sg = ctx.createLinearGradient(-14, 0, 40, 30); sg.addColorStop(0, lit(SARONG[1])); sg.addColorStop(1, lit(SARONG[0]));
  ctx.fillStyle = sg; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-8 + i * 11, -6 + i * 2); ctx.quadraticCurveTo(-4 + i * 11, 14, 2 + i * 10, 30 - i); ctx.stroke(); }
  // torso
  ctx.beginPath();
  ctx.moveTo(-17, -2);
  ctx.bezierCurveTo(-22, -26, -21, -48, -12, -66);
  ctx.quadraticCurveTo(2, -76, 16, -66);
  ctx.bezierCurveTo(24, -46, 24, -22, 17, -2);
  ctx.closePath();
  const tg = ctx.createLinearGradient(-20, 0, 24, 0); tg.addColorStop(0, lit(SHIRT[1])); tg.addColorStop(0.7, lit(SHIRT[0])); tg.addColorStop(1, mix(SHIRT[0], L.rim, 0.45));
  ctx.fillStyle = tg; ctx.fill();
  ctx.strokeStyle = rimC; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(17, -2); ctx.bezierCurveTo(24, -22, 24, -46, 16, -66); ctx.stroke();
  // neck and head
  ctx.fillStyle = lit(SKIN[1]); ctx.fillRect(-1, -80, 11, 16);
  const hx = 8, hy = -90;
  ctx.beginPath(); ctx.ellipse(hx, hy, 12.5, 14.5, 0.1, 0, TAU);
  const hg = ctx.createLinearGradient(hx - 12, 0, hx + 14, 0); hg.addColorStop(0, lit(SKIN[1])); hg.addColorStop(1, mix(SKIN[0], L.rim, 0.3));
  ctx.fillStyle = hg; ctx.fill();
  // nose, ear, hair and a loose head cloth
  ctx.fillStyle = mix(SKIN[0], L.rim, 0.25); ctx.beginPath(); ctx.moveTo(hx + 11, hy - 2); ctx.lineTo(hx + 18, hy + 3); ctx.lineTo(hx + 11, hy + 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = lit(SKIN[1]); ctx.beginPath(); ctx.ellipse(hx - 3, hy + 1, 3, 4.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = HAIR; ctx.beginPath(); ctx.ellipse(hx - 2, hy - 6, 13.5, 10, 0.1, Math.PI * 0.95, Math.PI * 2.1); ctx.lineTo(hx + 10, hy - 4); ctx.lineTo(hx - 12, hy + 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = lit('#c8dde8'); ctx.beginPath(); ctx.moveTo(hx - 12, hy - 8); ctx.quadraticCurveTo(hx, hy - 24, hx + 14, hy - 10); ctx.lineTo(hx + 12, hy - 5); ctx.quadraticCurveTo(hx, hy - 14, hx - 11, hy - 3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#16100c'; ctx.beginPath(); ctx.arc(hx + 7.5, hy - 1.5, 1.5, 0, TAU); ctx.fill();
  // arms and the rod
  const pull = fight ? 3 + tug * 7 : 0;
  const hand = [44 - pull, -40 + pull * 0.4 + Math.sin(t * 2.4) * 0.7];
  limb(ctx, [[-2, -62], [14, -46], hand], 11, 8, lit(SHIRT[1]), 'rgba(0,0,0,0)');
  limb(ctx, [[4, -62], [26, -44], [hand[0] + 2, hand[1] + 2]], 12, 8.5, mix(SKIN[0], '#000000', (1 - amb) * 0.4), rgba(L.rim, 0.5));
  ctx.fillStyle = lit(SKIN[0]); ctx.beginPath(); ctx.arc(hand[0] + 3, hand[1] + 2, 5, 0, TAU); ctx.fill();
  // the rod: out and up over the sea; it bows under a heavy fish
  const ang = -0.52 - tug * 0.08, len = 150;
  const bx = -26, by = -30, tx = hand[0] + Math.cos(ang) * len, ty = hand[1] + Math.sin(ang) * len;
  const bow = (fight ? 10 + tug * 22 : 4) + (o.cast || 0) * 12;
  const cxp = (bx + tx) / 2 + 2, cyp = (by + ty) / 2 + bow;
  ctx.strokeStyle = lit('#3a2a1a'); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(cxp, cyp, tx, ty); ctx.stroke();
  ctx.strokeStyle = rgba(L.rim, 0.55); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(bx + 1, by - 1.5); ctx.quadraticCurveTo(cxp + 1, cyp - 1.5, tx, ty - 1); ctx.stroke();
  ctx.restore();
  // the rod tip in screen space: apply the same transform by hand
  const cr = Math.cos(lean + breathe), sr = Math.sin(lean + breathe);
  const tipX = fx + (tx * cr - ty * sr) * k, tipY = fyy + (tx * sr + ty * cr) * k;
  return { tipX, tipY };
}
const FALL_BACK_START = (f) => Math.min(1.1, f.dur * 0.4);

// ---- the sea ---------------------------------------------------------------------------------------------------------------------
// Height of the water surface at screen x, including the swells that are travelling in.
export function surfaceY(g, rig, px, t) {
  const { rect } = g;
  let y = g.sy + Math.sin(px * 0.021 + t * 1.3) * 1.7 + Math.sin(px * 0.047 - t * 1.9) * 1.1;
  const sp = SPOTS[rig.spot], amp = rect.h * 0.052 * sp.swell, vel = (g.x1 - g.poleX) / 5.2;
  for (const w of rig.waves) {
    if (w.back) continue;
    const dtw = w.t - rig.t;
    if (dtw < -1.4 || dtw > 6.2) continue;
    const cx = g.poleX + dtw * vel, wd = rect.w * (0.055 + w.h * 0.02);
    const q = (px - cx) / wd;
    if (Math.abs(q) < 3) y -= amp * w.h * Math.exp(-q * q);
  }
  return y;
}

function drawSky(ctx, g, L, tod, t, storm) {
  const { rect } = g;
  const sg = ctx.createLinearGradient(0, rect.y, 0, g.hor);
  sg.addColorStop(0, L.sky[0]); sg.addColorStop(0.6, L.sky[1]); sg.addColorStop(1, L.sky[2]);
  ctx.fillStyle = sg; ctx.fillRect(rect.x, rect.y, rect.w, g.hor - rect.y + 2);
  // sun along its arc, from the sea side (right) at dawn to the shore side (left) at dusk
  const a = clamp(tod, 0, 1), skyH = g.hor - rect.y;
  const sunX = rect.x + rect.w * lerp(0.86, 0.14, a), sunY = g.hor - Math.sin(a * Math.PI) * skyH * 0.78 - skyH * 0.02;
  if (!storm) {
    const R = Math.min(rect.w, skyH * 1.6) * 0.07;
    const gl = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, R * 6);
    gl.addColorStop(0, rgba(L.sun, 0.8)); gl.addColorStop(0.25, rgba(L.sun, 0.28)); gl.addColorStop(1, rgba(L.sun, 0));
    ctx.fillStyle = gl; ctx.fillRect(rect.x, rect.y, rect.w, g.hor - rect.y + 2);
    ctx.fillStyle = L.sun; ctx.beginPath(); ctx.arc(sunX, sunY, R, 0, TAU); ctx.fill();
  }
  // clouds drifting left to right slowly
  const nC = storm ? 7 : 5;
  for (let i = 0; i < nC; i++) {
    const sp = 3 + hs(i + 3) * 5, cw = rect.w * (0.18 + 0.22 * hs(i * 7 + 1)), cx = rect.x + ((hs(i * 5 + 2) * rect.w * 1.4 + t * sp) % (rect.w * 1.4)) - rect.w * 0.2;
    const cy = rect.y + skyH * (0.12 + 0.5 * hs(i * 9 + 4)), ch = cw * (storm ? 0.22 : 0.15);
    const col = storm ? '110,120,134' : L.amb > 0.85 ? '255,255,255' : '255,200,190';
    const rg = ctx.createRadialGradient(cx, cy, 2, cx, cy, cw);
    rg.addColorStop(0, `rgba(${col},${storm ? 0.7 : 0.55})`); rg.addColorStop(1, `rgba(${col},0)`);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ch / cw); ctx.translate(-cx, -cy); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, cy, cw, 0, TAU); ctx.fill(); ctx.restore();
  }
  // a far outrigger fishing boat (hull, sail, outrigger float and boom) and seabirds
  {
    const bx = rect.x + rect.w * 0.66 + Math.sin(t * 0.05) * 6, by = g.hor + 3, bw = rect.w * 0.07, bob = Math.sin(t * 0.9) * 0.8;
    const hull = mix(L.near, '#000000', 0.6), sail = storm ? '#3a424c' : mix('#f3e4c4', L.far, 0.35);
    ctx.save(); ctx.translate(0, bob);
    ctx.fillStyle = hull;
    ctx.beginPath(); ctx.moveTo(bx - bw, by - 6); ctx.quadraticCurveTo(bx, by - 3, bx + bw, by - 7); ctx.lineTo(bx + bw * 0.62, by + 1); ctx.lineTo(bx - bw * 0.78, by + 1); ctx.closePath(); ctx.fill();
    ctx.fillRect(bx - 0.8, by - 26, 1.8, 21);                                          // mast
    ctx.fillStyle = sail; ctx.beginPath(); ctx.moveTo(bx + 1.6, by - 25); ctx.quadraticCurveTo(bx + bw * 0.95, by - 17, bx + bw * 0.78, by - 7.5); ctx.lineTo(bx + 1.6, by - 7.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = hull; ctx.lineWidth = 1.1;                                       // outrigger booms + float
    ctx.beginPath(); ctx.moveTo(bx - bw * 0.35, by - 5); ctx.lineTo(bx - bw * 0.45, by + 4); ctx.moveTo(bx + bw * 0.2, by - 5); ctx.lineTo(bx + bw * 0.1, by + 4); ctx.stroke();
    ctx.fillStyle = hull; ctx.beginPath(); ctx.ellipse(bx - bw * 0.15, by + 4.5, bw * 0.75, 1.5, 0, 0, TAU); ctx.fill();
    ctx.restore();
    // reflection and wake
    const rf = ctx.createLinearGradient(0, by + 2, 0, by + 18); rf.addColorStop(0, 'rgba(10,16,24,0.4)'); rf.addColorStop(1, 'rgba(10,16,24,0)');
    ctx.fillStyle = rf; ctx.fillRect(bx - bw * 0.9, by + 2, bw * 1.7, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bx - bw * 1.5, by + 2, bw * 0.7, 1.1);
  }
  if (!storm) {
    // gulls: slow glide with a wing beat; one pair far and small, two near
    for (let i = 0; i < 4; i++) {
      const far = i < 2, sc = far ? 0.65 : 1.15, sp = 11 + i * 4;
      const gx = rect.x + ((hs(i + 40) * rect.w + t * sp) % (rect.w + 60)) - 30, gy = rect.y + skyH * (0.2 + 0.28 * hs(i + 50)) + Math.sin(t * 0.7 + i) * 6;
      const fl = Math.sin(t * (far ? 3.2 : 2.4) + i * 2), w = 10 * sc;
      ctx.strokeStyle = far ? 'rgba(40,40,52,0.45)' : 'rgba(30,30,44,0.7)'; ctx.lineWidth = 1.5 * sc; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(gx - w, gy - 3 * fl * sc); ctx.quadraticCurveTo(gx - w * 0.45, gy - 5 * sc - 2 * fl * sc, gx, gy);
      ctx.quadraticCurveTo(gx + w * 0.45, gy - 5 * sc - 2 * fl * sc, gx + w, gy - 3 * fl * sc); ctx.stroke();
    }
  }
  return { sunX, sunY };
}

export function drawWorld(ctx, g, ws) {
  const { rect } = g, rig = ws.rig, L = lightAt(rig.tod, SPOTS[rig.spot].storm), t = ws.t;
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  const sun = drawSky(ctx, g, L, rig.tod, t, L.storm);
  // far sea: horizon to the surface, banded and glittering toward the sun
  const fg = ctx.createLinearGradient(0, g.hor, 0, g.sy + 6);
  fg.addColorStop(0, L.far); fg.addColorStop(1, L.near);
  ctx.fillStyle = fg; ctx.fillRect(rect.x, g.hor, rect.w, g.sy - g.hor + 8);
  for (let i = 0; i < 9; i++) {
    const q = i / 8, yy = g.hor + (g.sy - g.hor) * (0.08 + q * 0.9);
    ctx.strokeStyle = `rgba(255,255,255,${0.1 + 0.12 * q})`; ctx.lineWidth = 1 + q * 1.6;
    ctx.beginPath();
    for (let x = rect.x; x <= rect.x + rect.w + 10; x += 10) {
      const y2 = yy + Math.sin(x * (0.02 + q * 0.012) + t * (0.5 + q) + i * 1.7) * (1 + q * 2.2);
      if (x === rect.x) ctx.moveTo(x, y2); else ctx.lineTo(x, y2);
    }
    ctx.stroke();
  }
  if (!L.storm) {
    const gr = rect.w * 0.13, gm = (g.hor + g.sy) / 2, gh2 = g.sy - g.hor;
    ctx.save(); ctx.translate(sun.sunX, gm); ctx.scale(1, gh2 / (gr * 1.2));
    const gl = ctx.createRadialGradient(0, 0, 1, 0, 0, gr);
    gl.addColorStop(0, rgba(L.sun, 0.6)); gl.addColorStop(0.5, rgba(L.sun, 0.18)); gl.addColorStop(1, rgba(L.sun, 0));
    ctx.fillStyle = gl; ctx.fillRect(-gr, -gr * 1.2, gr * 2, gr * 2.4); ctx.restore();
    // reflected sun path: a column of short bright dashes that widen toward the viewer and shimmer
    for (let i = 0; i < 26; i++) {
      const q = (i + 0.5) / 26, yy = g.hor + (g.sy - g.hor) * (0.04 + 0.94 * q * q), half = rect.w * (0.012 + 0.07 * q), ph = Math.sin(t * (1.2 + hs(i + 300)) + i * 1.9);
      const w = (3 + 20 * q) * (0.6 + 0.4 * hs(i + 310)) * (0.75 + 0.25 * ph), gx = sun.sunX + (hs(i + 320) - 0.5) * 2 * half + ph * 3 * q;
      ctx.fillStyle = `rgba(255,248,215,${(0.25 + 0.45 * q) * (0.6 + 0.4 * Math.abs(ph))})`; ctx.fillRect(gx - w / 2, yy, w, 1 + 1.4 * q);
    }
    for (let i = 0; i < 12; i++) { const gx = sun.sunX + (hs(i + 11) - 0.5) * rect.w * 0.16, gy = g.hor + (g.sy - g.hor) * hs(i * 3 + 7), a = 0.4 + 0.5 * Math.sin(t * 3 + i * 2); ctx.fillStyle = `rgba(255,255,255,${Math.max(0, a) * 0.7})`; ctx.fillRect(gx, gy, 5 + hs(i) * 9, 1.6); }
  }

  // the water surface polyline
  const pts = [];
  for (let px = rect.x; px <= rect.x + rect.w + 8; px += 8) pts.push([px, surfaceY(g, rig, px, t)]);
  // underwater body
  ctx.beginPath(); ctx.moveTo(rect.x, rect.y + rect.h + 2);
  pts.forEach((p) => ctx.lineTo(p[0], p[1]));
  ctx.lineTo(rect.x + rect.w + 8, rect.y + rect.h + 2); ctx.closePath();
  const wg = ctx.createLinearGradient(0, g.sy - 10, 0, g.floor);
  wg.addColorStop(0, L.top); wg.addColorStop(1, L.deep);
  ctx.fillStyle = wg; ctx.fill();
  ctx.save(); ctx.clip();
  // light shafts
  if (!L.storm) {
    for (let i = 0; i < 6; i++) {
      const sx = sun.sunX + (i - 2.5) * rect.w * 0.12 + Math.sin(t * 0.4 + i) * 12, w0 = rect.w * 0.035;
      const sg = ctx.createLinearGradient(0, g.sy, 0, g.floor);
      sg.addColorStop(0, `rgba(255,255,230,${0.17 * L.amb})`); sg.addColorStop(1, 'rgba(255,255,230,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(sx - w0, g.sy); ctx.lineTo(sx + w0, g.sy); ctx.lineTo(sx + w0 * 3.2 - rect.w * 0.05, g.floor); ctx.lineTo(sx - w0 * 3.2 - rect.w * 0.05, g.floor); ctx.closePath(); ctx.fill();
    }
  }
  // seabed: sand with rocks and weed
  const fl = g.floor, sh = rect.h * 0.045;
  ctx.beginPath(); ctx.moveTo(rect.x, fl + sh * 2);
  for (let x = rect.x; x <= rect.x + rect.w + 10; x += 12) ctx.lineTo(x, fl - sh * (0.55 + 0.3 * Math.sin(x * 0.011 + 1) + 0.15 * Math.sin(x * 0.033)));
  ctx.lineTo(rect.x + rect.w + 10, fl + sh * 2); ctx.closePath();
  const sd = ctx.createLinearGradient(0, fl - sh, 0, fl + sh); sd.addColorStop(0, mix('#d8c08a', L.deep, 0.45)); sd.addColorStop(1, mix('#8a7650', L.deep, 0.6));
  ctx.fillStyle = sd; ctx.fill();
  for (let i = 0; i < 5; i++) {
    const rx = rect.x + rect.w * (0.12 + i * 0.2 + hs(i + 80) * 0.07), rw = rect.w * (0.04 + 0.04 * hs(i + 90)), ry = fl - sh * 0.5;
    ctx.fillStyle = mix('#5a6670', L.deep, 0.5);
    ctx.beginPath(); ctx.moveTo(rx - rw, ry + sh * 0.6); ctx.quadraticCurveTo(rx - rw * 0.6, ry - rw * 0.7, rx, ry - rw * 0.55); ctx.quadraticCurveTo(rx + rw * 0.8, ry - rw * 0.5, rx + rw, ry + sh * 0.6); ctx.closePath(); ctx.fill();
  }
  for (let i = 0; i < 9; i++) {
    const wx = rect.x + rect.w * (0.06 + i * 0.105 + hs(i + 60) * 0.04), hgt = rect.h * (0.07 + 0.07 * hs(i + 70));
    ctx.strokeStyle = mix('#3a8a5a', L.deep, 0.45); ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(wx, fl - sh * 0.3); ctx.quadraticCurveTo(wx + Math.sin(t * 1.1 + i) * 9, fl - hgt * 0.5, wx + Math.sin(t * 1.1 + i + 1) * 12, fl - hgt); ctx.stroke();
  }
  // the stilt below water
  const ug = ctx.createLinearGradient(g.poleX - 5 * g.k, 0, g.poleX + 5 * g.k, 0);
  ug.addColorStop(0, mix('#5a3a1e', L.deep, 0.25)); ug.addColorStop(1, mix('#b08450', L.deep, 0.3));
  ctx.fillStyle = ug;
  ctx.fillRect(g.poleX - 5 * g.k, g.sy, 10 * g.k, fl - g.sy + 4);
  // fish
  const tt = ws.t;
  const sorted = rig.fish.filter((f) => !f.hooked).slice().sort((a, b) => a.d - b.d);
  for (const f of sorted) {
    const px = g.fx(f.x), py = g.fy(f.d), len = fishLen(g, f.cm), dep = clamp(f.d, 0, 1);
    const haze = 0.12 + dep * 0.5;
    drawFish(ctx, px, py, len, f.dir, f.sp, { wob: tt * (3 + f.spd * 30) + f.ph, alpha: (1 - haze * 0.55) * f.fade * (f.wary > 0 ? 0.9 : 1) });
    if (ws.hintFish === f.id) {
      ctx.save(); ctx.strokeStyle = '#ffd75a'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -tt * 20;
      ctx.beginPath(); ctx.ellipse(px, py, len * 0.78, Math.max(len * 0.34, 20), 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
  }
  // bait and fish on the line under water
  drawLineUnder(ctx, g, rig, ws, L);
  // particles under the surface
  for (const p of ws.parts) if (p.kind === 'bub') { ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - p.t / p.max)})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke(); }
  ctx.restore();

  // surface line, foam and highlights
  ctx.beginPath(); pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
  ctx.strokeStyle = rgba('#ffffff', 0.75); ctx.lineWidth = 2.2; ctx.stroke();
  ctx.strokeStyle = rgba(L.top, 0.9); ctx.lineWidth = 1; ctx.stroke();
  for (const w of rig.waves) {
    if (w.back) continue;
    const dtw = w.t - rig.t;
    if (dtw < -0.6 || dtw > 5.8) continue;
    const vel = (g.x1 - g.poleX) / 5.2, cx = g.poleX + dtw * vel, cy = surfaceY(g, rig, cx, t);
    const a = clamp(w.h, 0.4, 1) * (dtw < 0 ? 1 + dtw / 0.6 : 1) * (dtw > 4.8 ? (5.8 - dtw) : 1);
    ctx.fillStyle = `rgba(255,255,255,${0.85 * a})`;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(cx + i * 9 * (g.rect.w / 720), cy + 1 + Math.abs(i) * 1.5, 7 + w.h * 5, 2 + w.h * 2, 0, 0, TAU); ctx.fill(); }
  }
  // foam around the pole
  const pf = 0.5 + 0.5 * Math.sin(t * 3);
  ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.25 * pf})`;
  ctx.beginPath(); ctx.ellipse(g.poleX, surfaceY(g, rig, g.poleX, t) + 2, 14 * g.k + 6 * pf, 3.5, 0, 0, TAU); ctx.fill();
  {
    // bow wave and wake: concentric ripples spreading from the pole, a foam collar with bubbles, spray when a swell lifts the sea against it
    const wy = surfaceY(g, rig, g.poleX, t), lift = clamp((g.sy - wy) / (g.rect.h * 0.05), 0, 1.4);
    for (let i = 0; i < 3; i++) {
      const ph = ((t * 0.55 + i / 3) % 1), rx = (12 + ph * 54) * g.k;
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - ph)})`; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(g.poleX, wy + 3, rx, rx * 0.17, 0, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 12; i++) { const a = hs(i + 200) * TAU, rr = (8 + 7 * hs(i + 210)) * g.k; ctx.beginPath(); ctx.ellipse(g.poleX + Math.cos(a + t * 0.3) * rr, wy + 2 + Math.sin(a + t * 0.3) * 1.6, 1.5 + hs(i + 220) * 1.8, 0.9 + hs(i) * 0.6, 0, 0, TAU); ctx.fill(); }
    if (lift > 0.12) {
      ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.35 * Math.min(1, lift)})`;
      for (let i = 0; i < 14; i++) {
        const ph = (t * 1.6 + hs(i + 230)) % 1, dir = i % 2 ? 1 : -1;
        const sx = g.poleX + dir * (4 + ph * 22 * (0.5 + hs(i + 240))) * g.k, sy2 = wy - Math.sin(ph * Math.PI) * (6 + 22 * lift * hs(i + 250)) * g.k;
        ctx.globalAlpha = (1 - ph) * Math.min(1, lift); ctx.beginPath(); ctx.arc(sx, sy2, 1.1 + hs(i + 260) * 1.6, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // the stilt above water: pole, crossbar, lashing and a foot rest
  const pw = 9 * g.k, top = g.barY - 8 * g.k;
  const pg = ctx.createLinearGradient(g.poleX - pw / 2, 0, g.poleX + pw / 2, 0);
  pg.addColorStop(0, mix('#5a3a1e', '#000000', (1 - L.amb) * 0.5)); pg.addColorStop(0.7, mix('#a8763e', '#000000', (1 - L.amb) * 0.5)); pg.addColorStop(1, mix('#c89a60', L.rim, 0.4));
  ctx.fillStyle = pg; ctx.fillRect(g.poleX - pw / 2, top, pw, g.sy - top + 4);
  {
    // weathered wood: long grain streaks, a few knots, a dark wet band and salt-bleached top, lashings of coir rope
    const dk = (c) => mix(c, '#000000', (1 - L.amb) * 0.5), poleBot = g.sy + 2, wy = surfaceY(g, rig, g.poleX, t);
    ctx.save(); ctx.beginPath(); ctx.rect(g.poleX - pw / 2, top, pw, poleBot - top); ctx.clip();
    for (let i = 0; i < 7; i++) {
      const gx = g.poleX - pw / 2 + pw * (0.12 + i * 0.125 + hs(i + 120) * 0.05);
      ctx.strokeStyle = i % 2 ? 'rgba(40,22,8,0.28)' : 'rgba(255,230,180,0.16)'; ctx.lineWidth = 0.9 * Math.max(1, g.k);
      ctx.beginPath(); ctx.moveTo(gx, top); ctx.bezierCurveTo(gx + 1.2 * g.k, top + (poleBot - top) * 0.3, gx - 1.2 * g.k, top + (poleBot - top) * 0.6, gx + 0.6 * g.k, poleBot); ctx.stroke();
    }
    for (let i = 0; i < 3; i++) { const ky = top + (poleBot - top) * (0.2 + 0.25 * i + hs(i + 130) * 0.08); ctx.fillStyle = 'rgba(40,22,8,0.45)'; ctx.beginPath(); ctx.ellipse(g.poleX + (hs(i + 140) - 0.5) * pw * 0.4, ky, 1.7 * g.k, 3 * g.k, 0, 0, TAU); ctx.fill(); }
    const wetTop = Math.max(top, wy - 26 * g.k), wg2 = ctx.createLinearGradient(0, wetTop, 0, wy + 2);
    wg2.addColorStop(0, 'rgba(20,28,30,0)'); wg2.addColorStop(1, 'rgba(14,24,30,0.55)');
    ctx.fillStyle = wg2; ctx.fillRect(g.poleX - pw / 2, wetTop, pw, wy + 2 - wetTop);
    // barnacle crust right at the waterline
    for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? 'rgba(220,220,205,0.8)' : 'rgba(170,170,160,0.8)'; ctx.beginPath(); ctx.arc(g.poleX - pw / 2 + hs(i + 150) * pw, wy - 2 - hs(i + 160) * 9 * g.k, 0.9 + hs(i + 170) * 1.1, 0, TAU); ctx.fill(); }
    ctx.restore();
    // rope lashings (diagonal turns) at the crossbar and at the foot rest
    const lash = (cy, n) => {
      ctx.save();
      ctx.beginPath(); ctx.rect(g.poleX - pw / 2 - 2, cy - n * 1.6 * g.k, pw + 4, n * 3.2 * g.k + 2); ctx.clip();
      ctx.fillStyle = dk('#8c6a3a'); ctx.fillRect(g.poleX - pw / 2 - 1.5, cy - n * 1.6 * g.k, pw + 3, n * 3.2 * g.k);
      ctx.strokeStyle = dk('#d6bc84'); ctx.lineWidth = 1.5 * Math.max(1, g.k);
      for (let i = 0; i < n; i++) { const yy = cy - n * 1.6 * g.k + i * 3.2 * g.k; ctx.beginPath(); ctx.moveTo(g.poleX - pw / 2 - 2, yy + 2.6 * g.k); ctx.lineTo(g.poleX + pw / 2 + 2, yy); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(40,24,8,0.5)'; ctx.lineWidth = 1;
      for (let i = 0; i < n; i++) { const yy = cy - n * 1.6 * g.k + i * 3.2 * g.k + 3 * g.k; ctx.beginPath(); ctx.moveTo(g.poleX - pw / 2 - 2, yy + 2.6 * g.k); ctx.lineTo(g.poleX + pw / 2 + 2, yy); ctx.stroke(); }
      ctx.restore();
    };
    lash(g.barY + 8 * g.k, 4);
    lash(g.barY + 53 * g.k, 3);
  }
  ctx.fillStyle = mix('#8a5c30', '#000000', (1 - L.amb) * 0.5);
  roundRect(ctx, g.poleX - 34 * g.k, g.barY - 2 * g.k, 70 * g.k, 8 * g.k, 4 * g.k); ctx.fill();
  ctx.fillStyle = rgba(L.rim, 0.55); ctx.fillRect(g.poleX - 33 * g.k, g.barY - 1 * g.k, 68 * g.k, 1.6 * g.k);
  ctx.strokeStyle = 'rgba(40,22,8,0.3)'; ctx.lineWidth = 0.9;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(g.poleX - 32 * g.k, g.barY + (1.5 + i * 2) * g.k); ctx.lineTo(g.poleX + 33 * g.k, g.barY + (1.7 + i * 2) * g.k); ctx.stroke(); }
  ctx.fillStyle = 'rgba(30,16,6,0.4)'; for (const ex of [-33, 35]) { ctx.beginPath(); ctx.ellipse(g.poleX + ex * g.k, g.barY + 2 * g.k, 1.6 * g.k, 3.4 * g.k, 0, 0, TAU); ctx.fill(); }
  // worn seat: a paler polished patch where he sits
  ctx.fillStyle = 'rgba(255,225,170,0.16)'; roundRect(ctx, g.poleX - 6 * g.k, g.barY - 1.5 * g.k, 30 * g.k, 5 * g.k, 2.5 * g.k); ctx.fill();
  ctx.fillStyle = mix('#7a5230', '#000000', (1 - L.amb) * 0.5);
  roundRect(ctx, g.poleX - 6 * g.k, g.barY + 50 * g.k, 66 * g.k, 6 * g.k, 3 * g.k); ctx.fill();
  ctx.strokeStyle = mix('#d9c28a', '#000000', (1 - L.amb) * 0.5); ctx.lineWidth = 2.2 * g.k;
  ctx.beginPath(); ctx.moveTo(g.poleX - pw / 2 - 1, g.barY - 4 * g.k); ctx.lineTo(g.poleX + pw / 2 + 1, g.barY + 8 * g.k); ctx.moveTo(g.poleX - pw / 2 - 1, g.barY + 8 * g.k); ctx.lineTo(g.poleX + pw / 2 + 1, g.barY - 4 * g.k); ctx.stroke();

  // the fisherman, then the line
  const cast = ws.castAnim > 0 ? Math.sin(clamp(ws.castAnim / 0.35, 0, 1) * Math.PI) : 0;
  const tip = drawFisherman(ctx, g, rig, L, { t, cast });
  drawLineAbove(ctx, g, rig, ws, L, tip);
  // a landed fish arcing back into the sea
  if (ws.rel) {
    const q = ws.rel, k2 = clamp(q.t / 1.2, 0, 1);
    drawFish(ctx, g.poleX + (32 + 60 * k2) * g.k, g.sy - Math.sin(k2 * Math.PI) * 70 * g.k + 4, fishLen(g, q.cm), 1, q.sp, { wob: ws.t * 14, thrash: 1 });
  }
  // falling spray, ripples and number pops
  for (const r of ws.ripples) {
    const k2 = clamp(r.t / r.max, 0, 1), rx = (6 + k2 * 46) * r.s;
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k2)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, rx, rx * 0.26, 0, 0, TAU); ctx.stroke();
  }
  for (const p of ws.parts) if (p.kind === 'drop') { ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - p.t / p.max)})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
  // rain in the storm
  if (L.storm) {
    ctx.strokeStyle = 'rgba(220,230,240,0.35)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 46; i++) {
      const rx = rect.x + ((hs(i * 3 + 1) * rect.w * 1.2 + t * 160 + i * 17) % (rect.w * 1.2)), ry = rect.y + ((hs(i * 5 + 2) * rect.h + t * 520) % rect.h);
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 7, ry + 17); ctx.stroke();
    }
  }
  ctx.restore();
  return { tip, L };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Where the hooked fish is on screen (fight): from the landing point at the stilt out to where the bait sank.
export function fightPos(g, rig) {
  const f = rig.fight, b = rig.bait;
  if (!f || !b) return null;
  const bx = g.fx(b.x), by = g.fy(b.d);
  const lx = g.poleX + 26 * g.k, ly = g.sy + 8;
  const r = clamp(f.r, 0, 1.3);
  const w = Math.sin(f.wob) * 0.045 * g.rect.h * (0.3 + f.S.pull) * clamp(f.r, 0.2, 1);
  return { x: lerp(lx, bx, r) + Math.cos(f.wob * 0.7) * 6, y: Math.max(g.sy + 4, lerp(ly, by, r) + w), r };
}
function tensionCol(T) { return T > 0.72 ? '#ff6a4a' : T > 0.35 ? '#fff0b0' : 'rgba(255,255,255,0.8)'; }

function drawLineUnder(ctx, g, rig, ws, L) {
  const b = rig.bait, f = rig.fight;
  if (f && b) {
    const p = fightPos(g, rig);
    if (p.y > g.sy) {
      const len = fishLen(g, f.fish.cm), tr = f.phase === 'run';
      drawFish(ctx, p.x, p.y, len, -1, f.fish.sp, { wob: ws.t * (tr ? 18 : 9), thrash: tr ? 1 : 0.3, alpha: 1 });
      if (ws.parts.length < 150 && (ws.frame % 9) === 0) bubbles(ws.parts, ws.fxRng, p.x, p.y, 1);
    }
    return;
  }
  if (!b) return;
  if (b.state === 'flying') return;
  const fx = g.fx(b.x), top = g.sy + 2, by = g.fy(b.y);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(fx, top); ctx.lineTo(fx + Math.sin(ws.t * 1.5) * 2, by); ctx.stroke();
  ctx.fillStyle = '#d96a4a'; ctx.beginPath(); ctx.arc(fx + Math.sin(ws.t * 1.5) * 2, by + 2, 3.4, 0, TAU); ctx.fill();
}

function drawLineAbove(ctx, g, rig, ws, L, tip) {
  const b = rig.bait, f = rig.fight;
  if (tip.hidden) return;
  ctx.lineCap = 'round';
  if (f && b) {
    const p = fightPos(g, rig);
    ctx.strokeStyle = tensionCol(f.T); ctx.lineWidth = 1.6 + f.T * 1.6;
    ctx.beginPath(); ctx.moveTo(tip.tipX, tip.tipY);
    if (p.y <= g.sy + 5) { ctx.lineTo(p.x, g.sy); ctx.stroke(); }
    else {
      // the line from the tip to the water, slightly bowed when slack, then on to the fish
      const sag = (1 - f.T) * 18;
      const mx = lerp(tip.tipX, p.x, 0.5), my = lerp(tip.tipY, p.y, 0.5) + sag;
      ctx.quadraticCurveTo(mx, my, p.x, p.y); ctx.stroke();
    }
    // landing: the fish leaves the water near the stilt
    if (p.y <= g.sy + 5 && p.r < 0.12) {
      const len = fishLen(g, f.fish.cm), lift = (0.12 - p.r) / 0.12;
      drawFish(ctx, p.x, g.sy - lift * 28, len, -1, f.fish.sp, { wob: ws.t * 16, thrash: 1 });
    }
    return;
  }
  if (!b) {
    // line hanging free with a little weight
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.3;
    const sw = Math.sin(ws.t * 1.7) * 3;
    ctx.beginPath(); ctx.moveTo(tip.tipX, tip.tipY); ctx.quadraticCurveTo(tip.tipX + 4 + sw, tip.tipY + g.rect.h * 0.08, tip.tipX + 6 + sw * 1.4, tip.tipY + g.rect.h * 0.16); ctx.stroke();
    return;
  }
  const bx = g.fx(b.x);
  if (b.state === 'flying') {
    const k = clamp(b.t / 0.32, 0, 1), x = lerp(tip.tipX, bx, k), y = lerp(tip.tipY, g.sy, k) - Math.sin(k * Math.PI) * g.rect.h * 0.16;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(tip.tipX, tip.tipY); ctx.quadraticCurveTo(lerp(tip.tipX, x, 0.5), Math.min(tip.tipY, y) - 6, x, y); ctx.stroke();
    ctx.fillStyle = '#ff7a4a'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill();
    return;
  }
  // float on the surface at the bait's x; the line sags from the rod tip to it
  let bob = 0, dive = 0;
  if (b.state === 'nibble') bob = Math.sin(b.t * 28) * 3.5;
  if (b.state === 'bite') dive = Math.min(1, b.t * 5) * 14;
  const fyy = surfaceY(g, rig, bx, ws.t) + bob + dive;
  const mx = lerp(tip.tipX, bx, 0.5), my = Math.max(tip.tipY, fyy) + 24 + Math.abs(bx - tip.tipX) * 0.06;
  ctx.strokeStyle = 'rgba(255,255,255,0.78)'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(tip.tipX, tip.tipY); ctx.quadraticCurveTo(mx, my - 16, bx, fyy - 6); ctx.stroke();
  // float
  ctx.fillStyle = b.state === 'bite' ? '#ffd75a' : '#ff5a3c';
  ctx.beginPath(); ctx.ellipse(bx, fyy - 4, 3.4, 6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 3, fyy - 5, 6, 2.4);
  if (b.state === 'bite') {
    const a = 0.5 + 0.5 * Math.sin(ws.t * 22);
    ctx.strokeStyle = `rgba(255,215,90,${0.5 + 0.5 * a})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(bx, fyy, 18 + a * 8, 6 + a * 2, 0, 0, TAU); ctx.stroke();
  }
}

// ---- small illustration used by menus and the rules page --------------------------------------------------------------------
export function drawMiniFish(ctx, x, y, len, sp, dir = 1) { drawFish(ctx, x, y, len, dir, sp, { wob: 0.4 }); }
export function drawSeatMini(ctx, x, y, k, lean, tod = 0.2) {
  const g = { k, poleX: x, barY: y + 2 * k, sy: y + 150 * k };
  const rig = { s: lean, fell: null, fight: null };
  const L = lightAt(tod, false);
  ctx.save();
  const pw = 9 * k;
  ctx.fillStyle = '#8a5c30'; ctx.fillRect(x - pw / 2, y, pw, 150 * k);
  roundRect(ctx, x - 34 * k, y - 2 * k, 70 * k, 8 * k, 4 * k); ctx.fillStyle = '#7a5230'; ctx.fill();
  ctx.restore();
  return drawFisherman(ctx, g, rig, L, { t: 0 });
}

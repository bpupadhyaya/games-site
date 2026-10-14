// Drawing for the sea, the beach, the swell lines, the buoy and the painted pirogues. Pure drawing from sim state; no state kept
// here. The world is drawn in SEA metres through a transform (s along the course, y across it), the boats in screen pixels.
import { CW, BRK, BOW, STERN, LANES, crestAt, currentAt } from './sim.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (a, b) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ---- camera and transforms -------------------------------------------------------------------------------------------------------
// cam = { s, y, dir: +1 outward | -1 homeward, phi: extra turn rotation (radians), ppm, ax, ay }
export function toScreen(cam, s, y) {
  if (v3.on && v3.proj) return v3.proj(s, y);
  let u = cam.dir > 0 ? (y - cam.y) * cam.ppm : -(y - cam.y) * cam.ppm;
  let v = cam.dir > 0 ? -(s - cam.s) * cam.ppm : (s - cam.s) * cam.ppm;
  if (cam.phi) { const c = Math.cos(cam.phi), n = Math.sin(cam.phi); const u2 = u * c - v * n; v = u * n + v * c; u = u2; }
  return { x: cam.ax + u, y: cam.ay + v };
}
export function toSea(cam, x, y) {
  let u = x - cam.ax, v = y - cam.ay;
  if (cam.phi) { const c = Math.cos(cam.phi), n = Math.sin(cam.phi); const u2 = u * c + v * n; v = -u * n + v * c; u = u2; }
  return cam.dir > 0 ? { s: cam.s - v / cam.ppm, y: cam.y + u / cam.ppm } : { s: cam.s + v / cam.ppm, y: cam.y - u / cam.ppm };
}
function applyWorld(ctx, cam) {
  ctx.translate(cam.ax, cam.ay);
  if (cam.phi) ctx.rotate(cam.phi);
  if (cam.dir > 0) ctx.transform(0, -cam.ppm, cam.ppm, 0, 0, 0); else ctx.transform(0, cam.ppm, -cam.ppm, 0, 0, 0);
  ctx.translate(-cam.s, -cam.y);
}
function visBox(cam, W, H) {
  const pts = [toSea(cam, 0, 0), toSea(cam, W, 0), toSea(cam, 0, H), toSea(cam, W, H)];
  const s = pts.map((p) => p.s), y = pts.map((p) => p.y), m = 6;
  return { s0: Math.min(...s) - m, s1: Math.max(...s) + m, y0: Math.min(...y) - m, y1: Math.max(...y) + m };
}

// ---- the sea ---------------------------------------------------------------------------------------------------------------------
function waterGrad(ctx, sea) {
  const g = ctx.createLinearGradient(-6, 0, sea.D + 40, 0);
  const n = sea.D + 46;
  const at = (s) => clamp((s + 6) / n, 0, 1);
  g.addColorStop(at(0), '#8fe6d4'); g.addColorStop(at(14), '#4cc8c3'); g.addColorStop(at(40), '#1e9cb8'); g.addColorStop(at(80), '#12709f'); g.addColorStop(1, '#0a4a7c');
  return g;
}

function sparkles(ctx, B, t) {
  // chop: short lateral dashes and little arcs, fixed to the water so they slide past as the boat moves
  const cell = 3.4;
  const i0 = Math.floor(B.s0 / cell), i1 = Math.ceil(B.s1 / cell), j0 = Math.floor(B.y0 / cell), j1 = Math.ceil(B.y1 / cell);
  ctx.lineCap = 'round';
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const h = hash(i, j);
    if (h > 0.5) continue;
    const tw = 0.5 + 0.5 * Math.sin(t * (1.2 + h * 2.4) + h * 40);
    const x = (i + hash(i + 7, j)) * cell, y = (j + hash(i, j + 13)) * cell, len = 0.8 + 1.8 * hash(i + 3, j + 5);
    ctx.strokeStyle = `rgba(255,255,255,${0.05 + 0.2 * tw})`; ctx.lineWidth = 0.09 + 0.07 * h;
    ctx.beginPath(); ctx.moveTo(x, y - len / 2); ctx.quadraticCurveTo(x - 0.25, y, x, y + len / 2); ctx.stroke();
  }
}

function drawBeach(ctx, sea, B, t) {
  if (B.s0 > 2) return;
  const x0 = Math.min(B.s0, -60);
  const g = ctx.createLinearGradient(x0, 0, 0, 0);
  g.addColorStop(0, '#f1d9a4'); g.addColorStop(0.75, '#ecd09a'); g.addColorStop(0.93, '#cfae78'); g.addColorStop(1, '#b89460');
  ctx.fillStyle = g; ctx.fillRect(x0, B.y0, -x0 + 0.2, B.y1 - B.y0);
  // sand texture
  ctx.fillStyle = 'rgba(150,110,60,0.18)';
  for (let i = Math.floor(B.y0 / 2); i < B.y1 / 2; i++) for (let k = 0; k < 4; k++) {
    const h = hash(i, k + 91);
    ctx.fillRect(-4 - h * 55, i * 2 + hash(k, i) * 2, 0.5 + h, 0.18);
  }
  // wet edge and foam scallops
  const fg = ctx.createLinearGradient(-1, 0, 4, 0);
  fg.addColorStop(0, 'rgba(255,255,255,0)'); fg.addColorStop(0.35, 'rgba(255,255,255,0.9)'); fg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.moveTo(-1, B.y0);
  for (let y = B.y0; y <= B.y1; y += 1) ctx.lineTo(0.2 + 0.7 * Math.sin(y * 0.5 + t * 0.9) + 0.4 * Math.sin(y * 1.3 - t * 0.7), y);
  ctx.lineTo(4, B.y1); ctx.lineTo(4, B.y0); ctx.closePath(); ctx.fill();
  // things on the beach: palms, drying nets, pulled-up boats, a few people, huts
  const j0 = Math.floor(B.y0 / 11), j1 = Math.ceil(B.y1 / 11);
  for (let j = j0; j <= j1; j++) {
    const yc = j * 11 + hash(j, 3) * 6;
    const kind = Math.floor(hash(j, 5) * 5), depth = -9 - hash(j, 7) * 24;
    if (kind <= 1) drawPalm(ctx, depth - 6, yc, 5 + hash(j, 9) * 2, hash(j, 11) * TAU);
    else if (kind === 2) { // a pulled-up pirogue seen from above
      ctx.save(); ctx.translate(-9 - hash(j, 13) * 5, yc); ctx.rotate((hash(j, 15) - 0.5) * 0.4);
      hullShape(ctx, 3.2); ctx.fillStyle = ['#d9453d', '#1fa39a', '#f0a81c', '#7c4dbb'][j & 3]; ctx.fill(); ctx.lineWidth = 0.12; ctx.strokeStyle = 'rgba(40,20,10,0.5)'; ctx.stroke();
      ctx.restore();
    } else if (kind === 3) { // drying net
      ctx.fillStyle = 'rgba(60,70,80,0.35)'; ctx.fillRect(depth, yc - 2.5, 8, 5);
      ctx.strokeStyle = 'rgba(240,240,230,0.35)'; ctx.lineWidth = 0.06;
      for (let k = 0; k <= 8; k++) { ctx.beginPath(); ctx.moveTo(depth + k, yc - 2.5); ctx.lineTo(depth + k, yc + 2.5); ctx.stroke(); }
      for (let k = 0; k <= 5; k++) { ctx.beginPath(); ctx.moveTo(depth, yc - 2.5 + k); ctx.lineTo(depth + 8, yc - 2.5 + k); ctx.stroke(); }
    } else { // a small hut roof
      ctx.fillStyle = '#9b6a3a'; ctx.fillRect(depth - 6, yc - 2.2, 4.4, 4.4);
      ctx.fillStyle = '#7a4f28'; ctx.fillRect(depth - 6, yc - 2.2, 2.2, 4.4);
    }
  }
  // spectators along the water line
  for (let i = Math.floor(B.y0 / 2.6); i < B.y1 / 2.6; i++) {
    const h = hash(i, 51);
    if (h > 0.55) continue;
    const y = i * 2.6 + hash(i, 53) * 1.6, x = -2.4 - hash(i, 57) * 2.4;
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(x + 0.08, y + 0.08, 0.34, 0.3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = ['#e24d3d', '#f2c230', '#2a8fd0', '#ffffff', '#3fa34d', '#c25aa0'][Math.floor(h * 11) % 6]; ctx.beginPath(); ctx.ellipse(x, y, 0.32, 0.28, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5a3a24'; ctx.beginPath(); ctx.arc(x, y, 0.16, 0, TAU); ctx.fill();
  }
}
function drawPalm(ctx, x, y, r, rot) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.beginPath(); ctx.arc(0.5, 0.5, r * 0.8, 0, TAU); ctx.fill();
  for (let i = 0; i < 9; i++) {
    const a = rot + (i / 9) * TAU;
    ctx.save(); ctx.rotate(a);
    ctx.fillStyle = i % 2 ? '#2f8a3f' : '#3da34c';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(r * 0.5, -r * 0.22, r, 0); ctx.quadraticCurveTo(r * 0.5, r * 0.2, 0, 0); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#6b4a2a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawWave(ctx, w, c, t, B) {
  const th = 2.2 + 3.0 * w.h, fr = 1.2 + 1.5 * w.h;
  const breaking = c < BRK;
  const xcAt = (y) => c + w.skew * y + (0.5 + 0.25 * w.h) * Math.sin(0.26 * y + w.ph + t * 0.3);
  const y0 = B.y0, y1 = B.y1;
  // shaded body: back slope (light) -> crest (white) -> face (deep shadow)
  const x0 = c - fr - 1.2, span = th + fr + 1.2, at = (x) => clamp((x - x0) / span, 0, 1);
  const g = ctx.createLinearGradient(x0, 0, c + th, 0);
  const aH = 0.38 + 0.34 * Math.min(1, w.h);
  g.addColorStop(0, 'rgba(4,40,76,0)'); g.addColorStop(at(c - fr * 0.55), `rgba(4,40,76,${aH})`); g.addColorStop(at(c - 0.25), `rgba(10,70,110,${aH * 0.7})`);
  g.addColorStop(at(c), 'rgba(240,255,252,0.72)'); g.addColorStop(at(c + 0.5), 'rgba(190,248,238,0.5)'); g.addColorStop(at(c + th * 0.55), 'rgba(150,236,226,0.22)'); g.addColorStop(1, 'rgba(150,236,226,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let y = y0; y <= y1; y += 1.5) { const x = xcAt(y) - fr; if (y === y0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  for (let y = y1; y >= y0; y -= 1.5) ctx.lineTo(xcAt(y) + th, y);
  ctx.closePath(); ctx.fill();
  // the crest line
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.35 * Math.min(1, w.h)})`; ctx.lineWidth = 0.28 + 0.34 * w.h;
  ctx.beginPath();
  for (let y = y0; y <= y1; y += 1.5) { const x = xcAt(y); if (y === y0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke();
  if (breaking) {
    // whitewater: a ragged sheet falling away toward the beach plus foam clots on the crest
    const lenSheet = 5 + 6 * w.h * (1 - c / BRK * 0.4);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    for (let y = y0; y <= y1; y += 1.2) { const jag = hash(Math.floor(y / 1.2) + (w.k * 31), 3) * 1.6; ctx.lineTo(xcAt(y) - 0.2, y); void jag; }
    for (let y = y1; y >= y0; y -= 1.2) { const jag = hash(Math.floor(y / 1.2) + (w.k * 31), 3) * 1.8; ctx.lineTo(xcAt(y) - lenSheet * (0.55 + 0.45 * jag), y); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let y = y0; y <= y1; y += 1.1) { const h = hash(Math.floor(y / 1.1), w.k + 5); if (h < 0.7) { ctx.beginPath(); ctx.arc(xcAt(y) - h * 1.6, y, 0.25 + h * 0.5, 0, TAU); ctx.fill(); } }
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.14;
    ctx.beginPath();
    for (let y = y0; y <= y1; y += 1.5) { const x = xcAt(y) - 1.1 - 0.6 * w.h; if (y === y0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
  }
}

function drawBuoy(ctx, s, y, big, t) {
  ctx.save(); ctx.translate(s, y);
  const r = big ? 1.5 : 0.8;
  ctx.fillStyle = 'rgba(0,30,50,0.3)'; ctx.beginPath(); ctx.arc(0.25, 0.25, r * 1.05, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f26a21';
  for (let i = 0; i < 4; i += 2) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, i * TAU / 4, (i + 1) * TAU / 4); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.38, 0, TAU); ctx.fill();
  ctx.lineWidth = 0.1; ctx.strokeStyle = 'rgba(20,50,70,0.55)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.2 * Math.sin(t * 2)})`; ctx.lineWidth = 0.14;
  ctx.beginPath(); ctx.arc(0, 0, r * (1.3 + 0.1 * Math.sin(t * 2)), 0, TAU); ctx.stroke();
  ctx.restore();
}
function drawGate(ctx, y, big) {
  for (const sy of [-6, 6]) {
    ctx.save(); ctx.translate(2.2, y + sy);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.arc(0.2, 0.2, 0.55, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff6e0'; ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = big ? '#f26a21' : '#1b5fa8'; ctx.beginPath(); ctx.arc(0, 0, 0.3, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = big ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.14; ctx.setLineDash([0.6, 0.5]);
  ctx.beginPath(); ctx.moveTo(2.2, y - 6); ctx.lineTo(2.2, y + 6); ctx.stroke(); ctx.setLineDash([]);
}

// The whole world (not boats): sea, current streaks, beach, lane lines, swells, gate, buoys. scene: { sea, t, cam, mineLane }
export function drawWorld(ctx, W, H, scene) {
  const { sea, cam, t } = scene, tw = scene.t0 ?? t;   // t: animation clock; tw: the sea's own clock (swell positions)
  const B = visBox(cam, W, H);
  ctx.save();
  applyWorld(ctx, cam);
  ctx.fillStyle = waterGrad(ctx, sea);
  ctx.fillRect(B.s0 - 5, B.y0 - 5, B.s1 - B.s0 + 10, B.y1 - B.y0 + 10);
  sparkles(ctx, B, t);
  // lane guide lines
  ctx.lineWidth = 0.12; ctx.setLineDash([0.9, 1.1]);
  for (let l = 0; l < 4; l++) {
    ctx.strokeStyle = l === scene.mineLane ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.moveTo(0, LANES[l]); ctx.lineTo(sea.D, LANES[l]); ctx.stroke();
  }
  ctx.setLineDash([]);
  // current streaks
  ctx.lineWidth = 0.1; ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  const cell = 9;
  for (let i = Math.floor(B.s0 / cell); i <= B.s1 / cell; i++) for (let j = Math.floor(B.y0 / cell); j <= B.y1 / cell; j++) {
    const h = hash(i + 200, j + 100);
    if (h > 0.5) continue;
    const s = (i + hash(i, j + 3)) * cell, y = (j + h) * cell, cur = currentAt(sea, s);
    if (Math.abs(cur) < 0.15) continue;
    const off = ((t * cur * 2 + h * 9) % 3) * Math.sign(cur);
    ctx.beginPath(); ctx.moveTo(s, y + off); ctx.lineTo(s, y + off + cur * 4); ctx.stroke();
  }
  drawBeach(ctx, sea, B, t);
  for (let l = 0; l < 4; l++) drawGate(ctx, LANES[l], l === scene.mineLane);
  // swell lines
  for (const w of sea.waves) {
    const c = crestAt(w, tw);
    if (c < B.s0 - 8) continue;
    if (c > B.s1 + 8) break;
    drawWave(ctx, w, c, t, B);
  }
  for (let l = 0; l < 4; l++) drawBuoy(ctx, sea.D, LANES[l], l === scene.mineLane, t);
  ctx.restore();
}

// ---- foam: wake trails and splash particles in sea coordinates ---------------------------------------------------------------------
export function drawFoam(ctx, W, H, scene) {
  const { cam } = scene;
  ctx.save();
  applyWorld(ctx, cam);
  ctx.lineCap = 'round';
  for (const tr of scene.trails || []) {
    const n = tr.pts.length;
    for (let i = 1; i < n; i++) {
      const a = tr.pts[i - 1], b = tr.pts[i], f = i / n;
      ctx.strokeStyle = `rgba(255,255,255,${0.04 + 0.4 * f * tr.k})`; ctx.lineWidth = 0.25 + 0.5 * f;
      ctx.beginPath(); ctx.moveTo(a.s, a.y); ctx.lineTo(b.s, b.y); ctx.stroke();
    }
  }
  for (const p of scene.parts || []) {
    const f = 1 - p.t / p.max;
    ctx.fillStyle = `rgba(255,255,255,${0.85 * f})`;
    ctx.beginPath(); ctx.arc(p.s, p.y, p.size * (0.6 + 0.6 * (1 - f)), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---- the pirogue -----------------------------------------------------------------------------------------------------------------
function hullShape(ctx, half = 3.5, beam = 0.58) {
  const L = half, b = beam;
  ctx.beginPath();
  ctx.moveTo(0, -L);
  ctx.bezierCurveTo(b * 0.5, -L * 0.74, b, -L * 0.46, b, -L * 0.06);
  ctx.bezierCurveTo(b, L * 0.46, b * 0.8, L * 0.84, b * 0.48, L * 0.985);
  ctx.lineTo(-b * 0.48, L * 0.985);
  ctx.bezierCurveTo(-b * 0.8, L * 0.84, -b, L * 0.46, -b, -L * 0.06);
  ctx.bezierCurveTo(-b, -L * 0.46, -b * 0.5, -L * 0.74, 0, -L);
  ctx.closePath();
}
const SKIN = ['#7a4a2e', '#5e3820', '#8c5a38'];

// One paddler seen from above: seat-bound torso that twists and leans with the stroke, two jointed arms whose hands stay on the
// shaft (top hand over the grip near the chest, lower hand a forearm down the shaft), the shaft itself and the blade. The torso
// leans into the catch, the lower hand pulls the blade aft along the hull, the top hand stays forward and drives; recovery
// feathers the blade above the water. Everything is derived from ph (stroke phase) only.
const sstep = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
function limb(ctx, sx, sy, hx, hy, bend, w, col) {
  // two-bone arm: shoulder -> elbow -> hand; elbow falls to the side given by `bend`
  const L1 = 0.3, L2 = 0.27;
  let dx = hx - sx, dy = hy - sy, d = Math.hypot(dx, dy) || 1e-3;
  const max = (L1 + L2) * 0.985;
  if (d > max) { hx = sx + dx / d * max; hy = sy + dy / d * max; dx = hx - sx; dy = hy - sy; d = max; }
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const ex = sx + dx / d * a + (-dy / d) * h * bend, ey = sy + dy / d * a + (dx / d) * h * bend;
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
  return { x: hx, y: hy };
}
function drawPaddler(ctx, y, side, ph, pal, wet, skin, roll) {
  let a, up = 0;
  if (ph < 1) a = 0.95 - 1.75 * (0.55 * ph + 0.45 * sstep(ph));
  else { const r = Math.min(1, (ph - 1) / 0.7), e = sstep(r); a = -0.8 + 1.75 * e; up = Math.sin(r * Math.PI); }
  const catchK = clamp(a / 0.95, -1, 1);                       // +1 at the catch, -0.84 at the exit
  const th = 0.34 * catchK, c = Math.cos(th), sn = Math.sin(th);
  const lean = side * 0.04 * (1 - Math.min(1, ph)) + roll * 0.1;
  const ty = y + 0.02 - 0.17 * Math.max(0, catchK) + 0.05 * Math.max(0, -catchK);   // torso centre, folds forward into the catch
  const sw = 0.21;
  const so = { x: lean + side * sw * c, y: ty - sw * sn };        // outboard shoulder (paddle side)
  const si = { x: lean - side * sw * c, y: ty + sw * sn };        // inboard shoulder
  const T = { x: lean + side * 0.05, y: ty - 0.14 - 0.05 * Math.sin(a) };   // top hand over the grip
  const dx = side * Math.cos(a), dy = -Math.sin(a);
  const reach = 1.62, tipX = T.x + dx * reach, tipY = T.y + dy * reach;
  const Hh = { x: T.x + dx * 0.46, y: T.y + dy * 0.46 };         // lower hand on the shaft
  ctx.save();
  // seat shadow + hips + torso
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(lean + 0.05, ty + 0.1, 0.34, 0.26, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = pal.shirt; ctx.beginPath(); ctx.ellipse(lean, ty + 0.06, 0.22, 0.2, 0, 0, TAU); ctx.fill();   // lower back and hips
  ctx.strokeStyle = pal.shirt; ctx.lineWidth = 0.27; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(si.x, si.y); ctx.lineTo(so.x, so.y); ctx.stroke();                              // chest and shoulders
  ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(si.x * 0.8 + lean * 0.2, si.y + 0.06); ctx.lineTo(so.x * 0.8 + lean * 0.2, so.y + 0.06); ctx.stroke();
  // arms: outboard arm to the lower hand, inboard arm to the top hand
  const hO = limb(ctx, so.x, so.y, Hh.x, Hh.y, -side * 0.55, 0.105, skin);
  const hI = limb(ctx, si.x, si.y, T.x, T.y, side * 0.55, 0.105, skin);
  // the shaft, from just above the top hand to the tip
  ctx.strokeStyle = up > 0 ? 'rgba(96,64,32,0.8)' : '#6a4423'; ctx.lineWidth = 0.085; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(T.x - dx * 0.1, T.y - dy * 0.1); ctx.lineTo(tipX, tipY); ctx.stroke();
  ctx.fillStyle = '#d9a374'; ctx.strokeStyle = 'rgba(40,20,10,0.4)'; ctx.lineWidth = 0.02;   // T-grip knob
  ctx.fillStyle = skin; for (const h of [hO, hI]) { ctx.beginPath(); ctx.arc(h.x, h.y, 0.075, 0, TAU); ctx.fill(); }
  // blade
  ctx.save(); ctx.translate(tipX, tipY); ctx.rotate(Math.atan2(dy, dx));
  ctx.globalAlpha = up > 0 ? 0.85 : 1;
  ctx.fillStyle = pal.band; ctx.beginPath(); ctx.moveTo(-0.1, -0.05); ctx.quadraticCurveTo(0.2, -0.17, 0.5, 0); ctx.quadraticCurveTo(0.2, 0.17, -0.1, 0.05); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 0.03; ctx.strokeStyle = 'rgba(30,20,10,0.55)'; ctx.stroke();
  ctx.restore();
  if (ph < 1 && wet) {
    ctx.strokeStyle = `rgba(255,255,255,${0.9 - 0.7 * ph})`; ctx.lineWidth = 0.07;
    ctx.beginPath(); ctx.arc(tipX + dx * 0.25, tipY + dy * 0.25, 0.3 + 0.35 * ph, 0, TAU); ctx.stroke();
  }
  // head: neck and shoulders already drawn; hair, cap, a hint of ears and nose direction (head turns a little with the twist)
  const hx = lean + side * 0.02 * catchK, hy = ty - 0.12 - 0.07 * Math.max(0, catchK);
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(hx + 0.05, hy + 0.05, 0.15, 0.16, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = skin; for (const e of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + e * 0.125, hy + 0.01, 0.035, 0.05, 0, 0, TAU); ctx.fill(); }   // ears
  ctx.fillStyle = '#1d130d'; ctx.beginPath(); ctx.ellipse(hx, hy, 0.12, 0.145, 0, 0, TAU); ctx.fill();                // hair
  ctx.fillStyle = pal.cap; ctx.beginPath(); ctx.ellipse(hx, hy - 0.02, 0.105, 0.1, 0, 0, TAU); ctx.fill();            // cap crown
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(hx - 0.03, hy - 0.04, 0.04, 0.03, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(hx, hy + 0.13, 0.05, 0.03, 0, 0, TAU); ctx.fill();               // nape
  ctx.restore();
}

// o: { x, y (screen), ang (radians, 0 = up), ppm, pal, roll, v, tSince, lastSide, swamp, ride, t, shadow }
export function drawPirogue(ctx, o) {
  const { pal } = o;
  const pitch = (o.ride ? 1.05 : 1) * (1 + 0.05 * Math.min(1.4, o.lift || 0));
  ctx.save();
  ctx.translate(o.x, o.y); ctx.rotate(o.ang); ctx.scale(o.ppm * pitch, o.ppm * pitch);
  const roll = clamp(o.roll || 0, -1.2, 1.2), bw = 1 - 0.14 * Math.abs(roll);
  const ph = o.tSince / 0.34;                 // 0..1 stroke, then 1..1.7 recovery
  const swamped = o.swamp > 0;
  // shadow on the water
  ctx.save(); ctx.translate(0.25 + 0.3 * (o.lift || 0), 0.3 + 0.3 * (o.lift || 0)); ctx.scale(bw, 1); hullShape(ctx, 3.5); ctx.fillStyle = 'rgba(0,40,60,0.28)'; ctx.fill(); ctx.restore();
  // bow wave
  if (o.v > 0.8) {
    const k = clamp(o.v / 4, 0, 1.2);
    ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.3 * k})`; ctx.lineWidth = 0.12; ctx.lineCap = 'round';
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 0.2, -3.4); ctx.quadraticCurveTo(sd * (0.8 + 0.4 * k), -2.6, sd * (1.25 + 0.7 * k), -1.0 + 0.3 * k); ctx.stroke(); }
  }
  ctx.save(); ctx.scale(bw, 1);
  // hull with painted bands along its length
  hullShape(ctx, 3.5, 0.58);
  const g = ctx.createLinearGradient(-0.58, 0, 0.58, 0);
  g.addColorStop(0, pal.trim); g.addColorStop(0.13, pal.trim); g.addColorStop(0.15, pal.main); g.addColorStop(0.38, pal.main);
  g.addColorStop(0.41, pal.band); g.addColorStop(0.59, pal.band); g.addColorStop(0.62, pal.main); g.addColorStop(0.85, pal.main);
  g.addColorStop(0.87, pal.trim); g.addColorStop(1, pal.trim);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); hullShape(ctx, 3.5, 0.58); ctx.clip();
  const sh = ctx.createLinearGradient(-0.58, 0, 0.58, 0);
  sh.addColorStop(0, 'rgba(255,255,255,0.22)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,20,40,0.32)');
  ctx.fillStyle = sh; ctx.fillRect(-0.7, -3.6, 1.4, 7.2);
  // bow cap and a painted chevron
  ctx.fillStyle = pal.band; ctx.beginPath(); ctx.moveTo(0, -3.5); ctx.lineTo(0.3, -2.7); ctx.lineTo(-0.3, -2.7); ctx.closePath(); ctx.fill();
  ctx.fillStyle = pal.trim; ctx.fillRect(-0.6, 2.7, 1.2, 0.18);
  ctx.restore();
  ctx.lineWidth = 0.06; ctx.strokeStyle = 'rgba(25,15,8,0.55)'; hullShape(ctx, 3.5, 0.58); ctx.stroke();
  // inside of the dugout
  ctx.save(); ctx.scale(0.62, 0.9); hullShape(ctx, 3.5, 0.58); ctx.fillStyle = '#4a2e1b'; ctx.fill(); ctx.restore();
  ctx.fillStyle = 'rgba(190,140,80,0.55)';
  for (const y of [-0.55, 0.8, 2.1]) ctx.fillRect(-0.3, y, 0.6, 0.07);
  ctx.restore();
  // the low side of a heeling boat takes water
  if (Math.abs(roll) > 0.15) {
    ctx.save(); ctx.globalAlpha = Math.min(0.85, Math.abs(roll)); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.12;
    const sd = Math.sign(roll);
    ctx.beginPath(); ctx.moveTo(sd * 0.55 * bw, -1.8); ctx.quadraticCurveTo(sd * 0.7 * bw, 0, sd * 0.55 * bw, 2.4); ctx.stroke(); ctx.restore();
  }
  // crew and paddles (both paddle the side of the last stroke)
  const side = o.lastSide || 1;
  if (swamped) {
    ctx.fillStyle = 'rgba(40,150,190,0.72)'; ctx.beginPath(); ctx.ellipse(0, 0.2, 0.46 * bw, 2.9, 0, 0, TAU); ctx.fill();
  }
  const cy = [-1.15, 1.25];
  const wet = o.v > 0.3 || ph < 1;
  // stern paddler strokes a hair behind the bow paddler (natural crew timing): same side, phase offset
  const cs = o.crewScale || 1;   // 1 in play; the store icon enlarges the crew so they read at 60 px
  cy.forEach((y, i) => {
    ctx.save(); ctx.translate(0, y); ctx.scale(cs, cs); ctx.translate(0, -y);
    drawPaddler(ctx, y, side, i ? Math.max(0, ph - 0.06) : ph, pal, wet, SKIN[(i + (o.id || 0)) % 3], roll);
    ctx.restore();
  });
  ctx.restore();
}

export { hullShape, drawPalm, drawBuoy };

// Drawing of the lakeside lawn, the birch skittles and the pin, through a pinhole camera that looks down the lawn from
// behind the throw line. Everything is in lawn units (cm); `cam.p(x, y, z)` projects to the screen and `cam.k(x, y, z)`
// gives the pixels per cm at that point. Pure drawing: game state is read-only here.
import { SK_R, SK_H, SK_HL, PIN_R, PIN_HL, BOUNDS } from './sim.js';

const TAU = Math.PI * 2;
export const DISPLAY = "'Fredoka', 'Avenir Next', 'Trebuchet MS', system-ui, sans-serif";
const UI = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', Roboto, system-ui, sans-serif";

// a small deterministic hash -> 0..1 (no randomness: art must be reproducible)
export const h01 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ---- the camera ----------------------------------------------------------------------------------------------------
// target (tx, ty) maps to the screen point (ax, ay); `span` is how many cm of lawn fit across `rect` at the target.
const DIST = 1400;
export function makeCam(rect, c, anchor = 0.6) {
  const PITCH = c.pitch || 0.62;
  const sp = Math.sin(PITCH), cp = Math.cos(PITCH);
  const f = Math.min(rect.w * 0.97 * DIST / c.span, rect.h * DIST / ((c.spanY || c.span * 0.95) * sp));
  const ax = rect.x + rect.w / 2, ay = rect.y + rect.h * anchor;
  const Cy = c.y - DIST * cp, Cz = DIST * sp;
  const p = (x, y, z = 0, out = { x: 0, y: 0 }) => {
    const ry = y - Cy, rz = z - Cz;
    const zc = ry * cp - rz * sp, yc = ry * sp + rz * cp;
    const d = Math.max(30, zc);
    out.x = ax + f * (x - c.x) / d; out.y = ay - f * yc / d;
    return out;
  };
  const k = (x, y, z = 0) => { const ry = y - Cy, rz = z - Cz; return f / Math.max(30, ry * cp - rz * sp); };
  return { p, k, rect, f, ax, ay, depth: (y, z = 0) => (y - Cy) * cp - (z - Cz) * sp, pose: { x: c.x, y: c.y, dist: DIST, pitch: PITCH } };
}

// ---- palette -------------------------------------------------------------------------------------------------------
const GRASS = ['#6aa84a', '#5f9c42'];
const BIRCH = ['#f8ecd0', '#e3c993', '#b08c5a'];

// ---- the scene behind and under the throw ---------------------------------------------------------------------------
const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); };

export function drawLawn(ctx, cam, t = 0) {
  const { rect } = cam;
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  const P = cam.p;
  // sky and water: everything beyond the shore
  const shoreY = BOUNDS.y1 + 40;
  const sky = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h * 0.4);
  sky.addColorStop(0, '#f6c98b'); sky.addColorStop(1, '#fbe3b4');
  ctx.fillStyle = sky; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  // lake
  const wFar = [P(-1400, 2600, 0), P(1400, 2600, 0), P(1400, shoreY, 0), P(-1400, shoreY, 0)];
  const lake = ctx.createLinearGradient(0, wFar[0].y, 0, wFar[2].y);
  lake.addColorStop(0, '#f3c98e'); lake.addColorStop(0.5, '#8fb4cf'); lake.addColorStop(1, '#4f86ad');
  ctx.fillStyle = lake; poly(ctx, wFar); ctx.fill();
  // far shore: dark pines and birch line
  const hz = P(0, 2600, 0).y;
  ctx.fillStyle = 'rgba(44,74,60,0.9)';
  for (let i = 0; i < 46; i++) {
    const x = rect.x - 40 + i * (rect.w + 80) / 45, h = 10 + h01(i + 3) * 22;
    ctx.beginPath(); ctx.moveTo(x - 10, hz + 2); ctx.lineTo(x, hz - h); ctx.lineTo(x + 10, hz + 2); ctx.closePath(); ctx.fill();
  }
  // sun glitter on the water
  ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#fff3cf'; ctx.lineCap = 'round';
  const sx = P(-120, 1400, 0).x;
  for (let i = 0; i < 26; i++) {
    const y = hz + 6 + i * ((P(0, shoreY, 0).y - hz) / 26), w = 6 + i * 2.2 + 6 * Math.sin(t * 1.3 + i * 1.7);
    ctx.lineWidth = 1.4 + i * 0.12; ctx.beginPath(); ctx.moveTo(sx - w + 10 * Math.sin(i), y); ctx.lineTo(sx + w, y); ctx.stroke();
  }
  ctx.restore();
  // the lawn: mowing stripes running away from the thrower
  const yN = -900, yF = shoreY - 8;
  for (let i = -16; i < 16; i++) {
    const x0 = i * 45, x1 = x0 + 45;
    const q = [P(x0, yN, 0), P(x1, yN, 0), P(x1, yF, 0), P(x0, yF, 0)];
    ctx.fillStyle = GRASS[(i + 64) & 1]; poly(ctx, q); ctx.fill();
  }
  // shore: a strip of dark earth, stones and reeds
  const sh = [P(-1400, yF, 0), P(1400, yF, 0), P(1400, shoreY, 0), P(-1400, shoreY, 0)];
  ctx.fillStyle = '#8a7a5a'; poly(ctx, sh); ctx.fill();
  for (let i = 0; i < 30; i++) {
    const x = -260 + i * 18 + h01(i) * 8, a = P(x, yF + 6 + h01(i + 5) * 22, 0), r = (2 + h01(i + 2) * 3) * cam.k(x, yF, 0);
    ctx.fillStyle = h01(i + 9) > 0.5 ? '#b9b3a4' : '#8f897b'; ctx.beginPath(); ctx.ellipse(a.x, a.y, r * 1.6, r, 0, 0, TAU); ctx.fill();
  }
  // grass tufts and clover (deterministic scatter)
  ctx.lineCap = 'round';
  for (let i = 0; i < 360; i++) {
    const x = -320 + h01(i * 1.7) * 640, y = -260 + h01(i * 2.3 + 1) * 410;
    const a = P(x, y, 0), b = P(x + (h01(i + 4) - 0.5) * 3, y, 3 + h01(i + 8) * 4), s = cam.k(x, y, 0);
    ctx.strokeStyle = h01(i + 11) > 0.5 ? 'rgba(40,86,30,0.55)' : 'rgba(150,200,100,0.55)';
    ctx.lineWidth = Math.max(1, 0.5 * s); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (let i = 0; i < 46; i++) {
    const x = -300 + h01(i * 3.3 + 9) * 600, y = -250 + h01(i * 1.9 + 7) * 400, a = P(x, y, 0), r = Math.max(1.2, 0.9 * cam.k(x, y, 0));
    ctx.fillStyle = h01(i + 2) > 0.5 ? '#fffbe6' : '#f4d35e'; ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, TAU); ctx.fill();
  }
  // worn patch where the skittles are set up
  { const c = P(0, 0, 0), kx = cam.k(0, 0, 0); ctx.fillStyle = 'rgba(120,96,48,0.22)'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 26 * kx, 26 * kx * 0.62, 0, 0, TAU); ctx.fill(); }
  // birch trunks and leaves along the shore and at the sides
  const trees = [[-150, 172], [-92, 178], [-30, 181], [38, 179], [96, 174], [152, 170], [-215, 90], [210, 100], [-260, 10], [250, 0]];
  for (const [x, y] of trees) {
    const a = P(x, y, 0), b = P(x, y, 470), w = 7 * cam.k(x, y, 0);
    ctx.strokeStyle = '#f2ead6'; ctx.lineWidth = w; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,26,20,0.7)'; ctx.lineWidth = Math.max(1, w * 0.16);
    for (let k = 0; k < 9; k++) { const z = 40 + k * 48 + h01(x + k) * 20, p = P(x + (h01(k + x) - 0.5) * 5, y, z); ctx.beginPath(); ctx.moveTo(p.x - w * 0.35, p.y); ctx.lineTo(p.x + w * 0.1, p.y + w * 0.1); ctx.stroke(); }
    for (let k = 0; k < 6; k++) {
      const p = P(x + (h01(k + 3 + x) - 0.5) * 70, y - 4, 330 + h01(k + x) * 150), r = (30 + h01(k + 8) * 24) * cam.k(x, y, 380);
      ctx.fillStyle = k % 2 ? 'rgba(122,166,70,0.85)' : 'rgba(150,190,84,0.85)'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    }
  }
  // rope boundary on posts
  ctx.lineWidth = Math.max(1.2, 0.9 * cam.k(0, 0, 0)); ctx.strokeStyle = 'rgba(255,248,230,0.9)'; ctx.lineJoin = 'round';
  const B = BOUNDS, z = 14;
  const edge = [[B.x0, B.y0], [B.x0, B.y1], [B.x1, B.y1], [B.x1, B.y0]];
  ctx.beginPath();
  edge.forEach(([x, y], i) => { const p = P(x, y, z); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const [x0, y0] = edge[i], [x1, y1] = edge[i + 1], n = 5;
    for (let k = 0; k <= n; k++) {
      const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n, a = P(x, y, 0), b = P(x, y, z + 3);
      ctx.strokeStyle = '#7b5632'; ctx.lineWidth = Math.max(2, 2.2 * cam.k(x, y, 0)); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  ctx.restore();
}

// Warm evening light over the whole field (drawn last, under the HUD).
export function drawLight(ctx, rect, t) {
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w * 0.8, rect.y + rect.h);
  g.addColorStop(0, 'rgba(255,214,140,0.22)'); g.addColorStop(0.5, 'rgba(255,190,110,0.04)'); g.addColorStop(1, 'rgba(40,40,90,0.2)');
  ctx.fillStyle = g; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const v = ctx.createRadialGradient(rect.x + rect.w / 2, rect.y + rect.h * 0.55, Math.min(rect.w, rect.h) * 0.35, rect.x + rect.w / 2, rect.y + rect.h * 0.55, Math.max(rect.w, rect.h) * 0.8);
  v.addColorStop(0, 'rgba(10,20,40,0)'); v.addColorStop(1, 'rgba(10,20,40,0.38)');
  ctx.fillStyle = v; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const tf = ctx.createLinearGradient(0, rect.y, 0, rect.y + 46);
  tf.addColorStop(0, 'rgba(10,26,46,0.75)'); tf.addColorStop(1, 'rgba(10,26,46,0)');
  ctx.fillStyle = tf; ctx.fillRect(rect.x, rect.y, rect.w, 46);
  // drifting pollen motes
  ctx.fillStyle = 'rgba(255,248,210,0.75)';
  for (let i = 0; i < 18; i++) {
    const x = rect.x + ((h01(i * 2.1) + t * (0.004 + 0.006 * h01(i))) % 1) * rect.w, y = rect.y + (h01(i * 4.7 + 1) * 0.7 + 0.04 * Math.sin(t * 0.7 + i)) * rect.h;
    ctx.globalAlpha = 0.25 + 0.4 * h01(i + 20); ctx.beginPath(); ctx.arc(x, y, 1.2 + 1.4 * h01(i + 5), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---- skittles and pin -----------------------------------------------------------------------------------------------
const lerpHex = (a, b, k) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * k)).join(',')})`;
};
export function shadowOf(ctx, cam, x, y, len, r) {
  // long soft shadow towards the lower right (the sun is low on the left)
  const a = cam.p(x, y, 0), b = cam.p(x + len * 0.55, y - len * 0.32, 0), w = r * cam.k(x, y, 0) * 2;
  ctx.save(); ctx.strokeStyle = 'rgba(20,30,10,0.2)'; ctx.lineCap = 'round'; ctx.lineWidth = w * 0.8;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
}

// A standing skittle. o: { hop (cm of lift), tint, glow }
export function drawStanding(ctx, cam, s, o = {}) {
  const z0 = o.hop || 0;
  const b = cam.p(s.x, s.y, z0), t = cam.p(s.x, s.y, z0 + SK_H);
  const k0 = cam.k(s.x, s.y, z0), k1 = cam.k(s.x, s.y, z0 + SK_H);
  const r0 = SK_R * k0, r1 = SK_R * k1;
  const ry = Math.abs(cam.p(s.x, s.y + SK_R, z0 + SK_H).y - cam.p(s.x, s.y - SK_R, z0 + SK_H).y) / 2;
  shadowOf(ctx, cam, s.x, s.y, 12 + (o.hop || 0) * 0.2, SK_R * 0.9);
  // body
  const gr = ctx.createLinearGradient(b.x - r0, 0, b.x + r0, 0);
  gr.addColorStop(0, BIRCH[0]); gr.addColorStop(0.45, BIRCH[1]); gr.addColorStop(1, BIRCH[2]);
  ctx.fillStyle = gr; ctx.strokeStyle = 'rgba(70,44,18,0.85)'; ctx.lineWidth = Math.max(1, r0 * 0.1);
  ctx.beginPath();
  ctx.moveTo(b.x - r0, b.y); ctx.lineTo(t.x - r1, t.y); ctx.lineTo(t.x + r1, t.y); ctx.lineTo(b.x + r0, b.y);
  ctx.ellipse(b.x, b.y, r0, Math.max(1, r0 * 0.5), 0, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
  // grain and a band
  ctx.strokeStyle = 'rgba(120,80,36,0.28)'; ctx.lineWidth = Math.max(0.7, r0 * 0.07);
  for (let g = -1; g <= 1; g += 1) { ctx.beginPath(); ctx.moveTo(b.x + g * r0 * 0.5, b.y + r0 * 0.2); ctx.lineTo(t.x + g * r1 * 0.5, t.y + r1 * 0.1); ctx.stroke(); }
  ctx.fillStyle = 'rgba(168,60,40,0.55)';
  { const q0 = cam.p(s.x, s.y, z0 + 3), q1 = cam.p(s.x, s.y, z0 + 5), kq = cam.k(s.x, s.y, z0 + 4) * SK_R;
    ctx.beginPath(); ctx.moveTo(q0.x - kq * 0.98, q0.y); ctx.lineTo(q1.x - kq, q1.y); ctx.lineTo(q1.x + kq, q1.y); ctx.lineTo(q0.x + kq * 0.98, q0.y); ctx.closePath(); ctx.fill(); }
  // top face with its number
  const tg = ctx.createRadialGradient(t.x - r1 * 0.3, t.y - ry * 0.3, 1, t.x, t.y, r1);
  tg.addColorStop(0, '#fff6dc'); tg.addColorStop(1, o.hot ? '#ffe08a' : '#ecd29c');
  ctx.fillStyle = tg; ctx.strokeStyle = 'rgba(70,44,18,0.9)'; ctx.lineWidth = Math.max(1, r1 * 0.12);
  ctx.beginPath(); ctx.ellipse(t.x, t.y, r1, Math.max(r1 * 0.5, ry), 0, 0, TAU); ctx.fill(); ctx.stroke();
  const fs = Math.max(8, r1 * (s.num > 9 ? 1.18 : 1.5));
  ctx.save();
  ctx.translate(t.x, t.y + fs * 0.04); ctx.scale(1, Math.max(0.62, Math.min(1, ry / r1 * 1.05)));
  ctx.fillStyle = '#4b1f12'; ctx.font = `700 ${fs}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(s.num), 0, 0);
  ctx.restore();
}

// A lying capsule (a toppled skittle or the pin): endpoints on the ground plane, resting on its side.
export function drawLying(ctx, cam, b) {
  const c = Math.cos(b.a) * b.hl, s = Math.sin(b.a) * b.hl;
  const z = b.r;
  const p0 = cam.p(b.x - c, b.y - s, z), p1 = cam.p(b.x + c, b.y + s, z);
  const k = cam.k(b.x, b.y, z), w = b.r * 2 * k;
  shadowOf(ctx, cam, b.x, b.y, 8, b.r * 0.7);
  const pin = b.kind === 1;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(60,36,14,0.9)'; ctx.lineWidth = w + Math.max(1.5, w * 0.14);
  ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
  ctx.strokeStyle = pin ? '#b8662a' : BIRCH[1]; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
  // highlight along the top
  const nx = p1.y - p0.y, ny = p0.x - p1.x, nl = Math.hypot(nx, ny) || 1;
  const ox = nx / nl * w * 0.18 * (nx < 0 ? 1 : -1), oy = ny / nl * w * 0.18 * (nx < 0 ? 1 : -1);
  ctx.strokeStyle = pin ? 'rgba(255,214,150,0.5)' : 'rgba(255,255,244,0.7)'; ctx.lineWidth = w * 0.3;
  ctx.beginPath(); ctx.moveTo(p0.x + ox, p0.y + oy - w * 0.1); ctx.lineTo(p1.x + ox, p1.y + oy - w * 0.1); ctx.stroke();
  if (pin) {
    ctx.strokeStyle = '#f5e4b8'; ctx.lineWidth = w * 0.98;
    ctx.beginPath(); ctx.moveTo(p0.x + (p1.x - p0.x) * 0.18, p0.y + (p1.y - p0.y) * 0.18); ctx.lineTo(p0.x + (p1.x - p0.x) * 0.3, p0.y + (p1.y - p0.y) * 0.3); ctx.stroke();
  } else {
    // number on the end face
    const e = p1;
    ctx.fillStyle = '#f6e3b4'; ctx.strokeStyle = 'rgba(70,44,18,0.9)'; ctx.lineWidth = Math.max(1, w * 0.07);
    ctx.beginPath(); ctx.arc(e.x, e.y, w * 0.45, 0, TAU); ctx.fill(); ctx.stroke();
    if (w > 9) { ctx.fillStyle = '#4b1f12'; ctx.font = `700 ${Math.round(w * (b.num > 9 ? 0.5 : 0.62))}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(b.num), e.x, e.y + 0.5); }
  }
}

// The pin in the air: axis is a 3D unit vector.
export function drawFlying(ctx, cam, P, axis, spin) {
  const hl = PIN_HL;
  const a = cam.p(P.x - axis.x * hl, P.y - axis.y * hl, Math.max(PIN_R, P.z - axis.z * hl)), b = cam.p(P.x + axis.x * hl, P.y + axis.y * hl, Math.max(PIN_R, P.z + axis.z * hl));
  const k = cam.k(P.x, P.y, P.z), w = PIN_R * 2 * k;
  // its shadow on the lawn
  const g0 = cam.p(P.x - axis.x * hl + P.z * 0.2, P.y - axis.y * hl - P.z * 0.12, 0), g1 = cam.p(P.x + axis.x * hl + P.z * 0.2, P.y + axis.y * hl - P.z * 0.12, 0);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(15,25,10,0.32)'; ctx.lineWidth = w * 0.85; ctx.beginPath(); ctx.moveTo(g0.x, g0.y); ctx.lineTo(g1.x, g1.y); ctx.stroke();
  ctx.strokeStyle = 'rgba(60,36,14,0.95)'; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.strokeStyle = '#c4722f'; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,224,170,0.55)'; ctx.lineWidth = w * 0.3; ctx.beginPath(); ctx.moveTo(a.x, a.y - w * 0.15); ctx.lineTo(b.x, b.y - w * 0.15); ctx.stroke();
  void spin;
}

// ---- small things for HUD and pages ---------------------------------------------------------------------------------
// A standing skittle as an icon (front view), `s` = width in px.
export function drawSkittleIcon(ctx, x, y, s, num, o = {}) {
  const h = s * 2.1;
  ctx.save();
  if (o.angle) { ctx.translate(x, y); ctx.rotate(o.angle); ctx.translate(-x, -y); }
  const g = ctx.createLinearGradient(x - s / 2, 0, x + s / 2, 0);
  g.addColorStop(0, BIRCH[0]); g.addColorStop(0.5, BIRCH[1]); g.addColorStop(1, BIRCH[2]);
  ctx.fillStyle = g; ctx.strokeStyle = 'rgba(70,44,18,0.9)'; ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.beginPath(); ctx.rect(x - s / 2, y - h / 2, s, h); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f6e3b4'; ctx.beginPath(); ctx.ellipse(x, y - h / 2, s / 2, s * 0.26, 0, 0, TAU); ctx.fill(); ctx.stroke();
  if (num !== undefined && num !== null) {
    ctx.fillStyle = '#4b1f12'; ctx.font = `700 ${Math.round(s * (num > 9 ? 0.5 : 0.62))}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(num), x, y - h / 2 + s * 0.02);
  }
  ctx.restore();
}
export function drawPinIcon(ctx, x, y, len, angle = -0.35) {
  const w = len * 0.2;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(60,36,14,0.95)'; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2, 0); ctx.stroke();
  ctx.strokeStyle = '#c4722f'; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2, 0); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,224,170,0.55)'; ctx.lineWidth = w * 0.3; ctx.beginPath(); ctx.moveTo(-len / 2, -w * 0.2); ctx.lineTo(len / 2, -w * 0.2); ctx.stroke();
  ctx.restore();
}
void lerpHex; void SK_HL; void UI;

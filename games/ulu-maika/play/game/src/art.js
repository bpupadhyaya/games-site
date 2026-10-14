// Art: the first-person scope down the lane (perspective projection), sky, mountains, sea, palms, stakes, boulders and discs.
// Everything is procedural and drawn every frame, so it stays crisp at every size. No images, no clock: `t` is the game's own time.
import { DISC_R, STAKE_R, FAR_R, RING_R } from './sim.js';

const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

export const SIDE = [
  { name: 'Charcoal', hi: '#9aa3ad', base: '#3a4048', dark: '#12151a', band: '#e9d9a6', chip: '#4d5560' },
  { name: 'Ochre', hi: '#ffd2a0', base: '#c4663a', dark: '#4e1c0a', band: '#fff0cf', chip: '#c4663a' },
];

// ---- the camera ---------------------------------------------------------------------------------------------------------------
// cam = { x, y, yaw }: standing at (x, y) looking along heading yaw (0 = straight up the lane, positive = to the right).
const NEAR = 0.35;
const lerp = (a, b, k) => a + (b - a) * k;
// The scope camera as pure numbers, shared by the 2D art, the HUD and the 3D presenter (view3d/) so they always agree.
// A raised camera stands behind the roll line (4 m in portrait, 5 m in a short wide scope) so the players at the line, the lane and
// the far post all fit; the start line sits about 80 percent of the way down the picture and the horizon 34 percent from the top.
export function scopeParams(rect) {
  const a = rect.w / Math.max(1, rect.h), k = Math.max(0, Math.min(1, (a - 0.9) / 1.3));
  const camH = lerp(2.3, 1.8, k), d0 = lerp(3.4, 4.4, k), extra = d0 - 4.0, hy = rect.y + rect.h * 0.34;
  const f = Math.min(1.3 * rect.w, ((0.86 - 0.34) * rect.h * d0) / camH);
  return { camH, extra, f, cx: rect.x + rect.w / 2, hy };
}
export function makeScope(rect, cam0) {
  const P = scopeParams(rect), { f, cx, hy, camH } = P;
  const cam = { x: cam0.x, y: cam0.y - P.extra, yaw: cam0.yaw };
  const sn = Math.sin(cam.yaw), cs = Math.cos(cam.yaw);
  const V = { rect, f, cx, hy, cam, camH };
  V.depth = (wx, wy) => (wx - cam.x) * sn + (wy - cam.y) * cs;
  V.lat = (wx, wy) => (wx - cam.x) * cs - (wy - cam.y) * sn;
  V.pt = (wx, wy, z = 0) => {
    const d = V.depth(wx, wy);
    if (d < NEAR) return null;
    return { x: cx + (f * V.lat(wx, wy)) / d, y: hy + (f * (camH - z)) / d, d, s: f / d };
  };
  // a ground polygon clipped at the near plane
  V.poly = (pts, z = 0) => {
    const c = pts.map(([wx, wy]) => ({ d: V.depth(wx, wy), l: V.lat(wx, wy) }));
    const out = [];
    for (let i = 0; i < c.length; i++) {
      const a = c[i], b = c[(i + 1) % c.length], ain = a.d >= NEAR, bin = b.d >= NEAR;
      if (ain) out.push(a);
      if (ain !== bin) { const k = (NEAR - a.d) / (b.d - a.d); out.push({ d: NEAR, l: a.l + (b.l - a.l) * k }); }
    }
    return out.map((q) => ({ x: cx + (f * q.l) / q.d, y: hy + (f * (camH - z)) / q.d }));
  };
  // screen -> sight angle change per screen unit (for a drag): one screen unit is atan(1/f) radians
  V.radPerPx = 1 / f;
  return V;
}

// ---- scenery ------------------------------------------------------------------------------------------------------------------
// Distant things are fixed in direction (azimuth), not position: they slide sideways as the sight turns, with no parallax.
const ridge = (az) => 0.5 + 0.28 * Math.sin(az * 2.3 + 0.7) + 0.16 * Math.sin(az * 5.9 + 2.1) + 0.08 * Math.sin(az * 13 + 0.4);
export function drawSky(ctx, V, t) {
  const { rect, f, cx, hy, cam } = V, yaw = cam.yaw;
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  const sky = ctx.createLinearGradient(0, rect.y, 0, hy);
  sky.addColorStop(0, '#4f9fe0'); sky.addColorStop(0.55, '#a8d8f4'); sky.addColorStop(0.88, '#ffe3b8'); sky.addColorStop(1, '#ffd0a0');
  ctx.fillStyle = sky; ctx.fillRect(rect.x, rect.y, rect.w, hy - rect.y + 2);
  const azx = (az) => cx + f * Math.tan(az - yaw);
  // sun and glow
  const sx = azx(0.42), sy = hy - (hy - rect.y) * 0.5;
  const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, rect.w * 0.35);
  sg.addColorStop(0, 'rgba(255,248,214,0.95)'); sg.addColorStop(0.18, 'rgba(255,226,150,0.55)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = sg; ctx.fillRect(rect.x, rect.y, rect.w, hy - rect.y + 2);
  ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(sx, sy, Math.max(8, rect.w * 0.022), 0, TAU); ctx.fill();
  // trade-wind clouds drifting slowly
  const rc = lcg(11);
  for (let i = 0; i < 6; i++) {
    const az = -1.2 + rc() * 2.4 + t * 0.004, k = rc(), x = azx(az), y = rect.y + (hy - rect.y) * (0.14 + 0.42 * rc()), w = rect.w * (0.1 + 0.12 * k);
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    for (const [dx, dy, r] of [[0, 0, 0.5], [0.35, -0.08, 0.38], [-0.35, 0.02, 0.34], [0.12, 0.08, 0.4]]) { ctx.beginPath(); ctx.ellipse(x + dx * w, y + dy * w * 0.4, w * r, w * r * 0.34, 0, 0, TAU); ctx.fill(); }
  }
  // mountains: two ridges of dark basalt, the far one hazier
  const hgt = (hy - rect.y);
  const ridgeFill = (col, scale, phase, base) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(rect.x, hy);
    for (let x = rect.x; x <= rect.x + rect.w + 8; x += 8) {
      const az = yaw + Math.atan((x - cx) / f);
      ctx.lineTo(x, hy - base - hgt * scale * ridge(az + phase));
    }
    ctx.lineTo(rect.x + rect.w + 8, hy); ctx.closePath(); ctx.fill();
  };
  ridgeFill('#7fa7c4', 0.5, 1.7, 2); ridgeFill('#4d7a6a', 0.34, 0, 0);
  // sea between the ridges and the lawn
  const sea = ctx.createLinearGradient(0, hy - 14, 0, hy);
  sea.addColorStop(0, '#47b9d0'); sea.addColorStop(1, '#1d8aa6');
  ctx.fillStyle = sea; ctx.fillRect(rect.x, hy - 7, rect.w, 9);
  ctx.restore();
}

// ---- the lane --------------------------------------------------------------------------------------------------------------------
const fillPoly = (ctx, p, fill, stroke) => {
  if (p.length < 3) return;
  ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
};

export function drawLane(ctx, V, track, t) {
  const { rect } = V;
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  const W = track.half, Y0 = -6, Y1 = track.len + 7;
  // outer meadow (below the horizon everywhere)
  const g = ctx.createLinearGradient(0, V.hy, 0, rect.y + rect.h);
  g.addColorStop(0, '#5fae62'); g.addColorStop(1, '#2f7f3c');
  ctx.fillStyle = g; ctx.fillRect(rect.x, V.hy, rect.w, rect.y + rect.h - V.hy);
  // mown stripes along the lane
  for (let y = Y0; y < Y1; y += 1) {
    const a = Math.floor(y / 2) % 2 === 0;
    fillPoly(ctx, V.poly([[-W, y], [W, y], [W, y + 1.02], [-W, y + 1.02]]), a ? '#7fcf72' : '#6dbd62');
  }
  // far-side bank behind the stake: a low wall of rough basalt and shrubs
  const by = track.len + 3.2;
  const b0 = V.pt(-W - 5, by, 0), b1 = V.pt(W + 5, by, 0), b2 = V.pt(W + 5, by, 1.1), b3 = V.pt(-W - 5, by, 1.1);
  if (b0 && b1 && b2 && b3) {
    const gg = ctx.createLinearGradient(0, b3.y, 0, b0.y);
    gg.addColorStop(0, '#2f6a45'); gg.addColorStop(1, '#244a3a');
    ctx.fillStyle = gg; ctx.fillRect(Math.min(b0.x, b3.x), b3.y, Math.abs(b1.x - b0.x), b0.y - b3.y);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(Math.min(b0.x, b3.x), b3.y, Math.abs(b1.x - b0.x), 2);
  }
  // mud patches: dark wet earth with a few lighter pits
  for (const m of track.mud) {
    const p = V.poly([[m.x0, m.y0], [m.x1, m.y0], [m.x1, m.y1], [m.x0, m.y1]]);
    fillPoly(ctx, p, '#6a4a2e', 'rgba(40,24,10,0.6)');
    const r = lcg(Math.round(m.y0 * 7));
    ctx.fillStyle = 'rgba(160,120,80,0.45)';
    for (let i = 0; i < 26; i++) {
      const q = V.pt(m.x0 + r() * (m.x1 - m.x0), m.y0 + r() * (m.y1 - m.y0));
      if (q) { ctx.beginPath(); ctx.ellipse(q.x, q.y, Math.max(1.5, q.s * 0.14), Math.max(1, q.s * 0.05), 0, 0, TAU); ctx.fill(); }
    }
  }
  // cross slopes: soft chevrons pointing the way the disc will be pushed
  for (const s of track.slopes) {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let y = s.y0 + 1; y < s.y1; y += 2.4) for (let x = -1.8; x <= 1.9; x += 1.8) {
      const dir = s.a > 0 ? 1 : -1;
      const a = V.pt(x - 0.4 * dir, y - 0.25), b = V.pt(x + 0.4 * dir, y), c = V.pt(x - 0.4 * dir, y + 0.25);
      if (a && b && c) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.stroke(); }
    }
  }
  // lane edges and the roll line
  const edge = (x) => { const a = V.poly([[x - 0.05, Y0], [x + 0.05, Y0], [x + 0.05, Y1], [x - 0.05, Y1]]); fillPoly(ctx, a, 'rgba(255,255,255,0.85)'); };
  edge(-W); edge(W);
  fillPoly(ctx, V.poly([[-W, -0.04], [W, -0.04], [W, 0.04], [-W, 0.04]]), 'rgba(255,255,255,0.75)');
  // metre marks along the right edge
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let y = 5; y <= track.len; y += 5) {
    const p = V.pt(W + 0.35, y, 0.0), q = V.pt(W + 0.35, y, 0.28);
    if (p && q) { ctx.fillRect(p.x - Math.max(1.5, p.s * 0.03), q.y, Math.max(3, p.s * 0.06), p.y - q.y); }
  }
  // the ring round the far stake
  const f = track.far;
  ctx.save();
  const rp = [];
  for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU; rp.push(V.pt(f.x + Math.cos(a) * RING_R, f.y + Math.sin(a) * RING_R)); }
  if (rp.every(Boolean)) {
    ctx.beginPath(); rp.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
    ctx.fillStyle = 'rgba(255,214,96,0.2)'; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,224,120,0.95)'; ctx.stroke();
  }
  ctx.restore();
  // chalk lines between each gate's stakes
  for (const gt of track.gates) {
    const a = V.pt(gt.x - gt.w / 2, gt.y), b = V.pt(gt.x + gt.w / 2, gt.y);
    if (a && b) { ctx.strokeStyle = 'rgba(255,230,140,0.95)'; ctx.lineWidth = Math.max(2, a.s * 0.04); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  }
  void t;
  ctx.restore();
}

// ---- standing things (drawn far to near) ---------------------------------------------------------------------------------------------
export function drawStake(ctx, V, x, y, height, rad, o = {}) {
  const b = V.pt(x, y, 0), tp = V.pt(x, y, height);
  if (!b || !tp) return;
  const w = Math.max(2.5, rad * 2 * b.s), top = tp.y, bot = b.y;
  // shadow on the lawn
  ctx.fillStyle = 'rgba(10,40,20,0.28)';
  ctx.beginPath(); ctx.ellipse(b.x + w * 0.9, bot, w * 1.5, Math.max(1.5, w * 0.35), 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(b.x - w / 2, 0, b.x + w / 2, 0);
  g.addColorStop(0, '#d9b98a'); g.addColorStop(0.45, '#fff0cf'); g.addColorStop(1, '#a8855a');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(b.x - w / 2, top, w, bot - top, w * 0.35); ctx.fill();
  // painted bands
  ctx.fillStyle = o.far ? '#e23a5c' : '#14b3a7';
  ctx.fillRect(b.x - w / 2, top + (bot - top) * 0.18, w, (bot - top) * 0.16);
  ctx.fillStyle = '#ffc857';
  ctx.fillRect(b.x - w / 2, top + (bot - top) * 0.42, w, (bot - top) * 0.1);
  ctx.beginPath(); ctx.arc(b.x, top, w * 0.62, 0, TAU); ctx.fillStyle = o.far ? '#e23a5c' : '#ffc857'; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(b.x - w * 0.18, top - w * 0.18, w * 0.18, 0, TAU); ctx.fill();
  if (o.far) {
    // a small ribbon on the far stake so it can be found from the roll line
    const sway = Math.sin((o.t || 0) * 2.2) * 0.12;
    ctx.fillStyle = '#ff7a4d'; ctx.beginPath();
    ctx.moveTo(b.x + w * 0.4, top + w * 0.2); ctx.quadraticCurveTo(b.x + w * (2 + sway * 4), top + w * (0.3 - sway), b.x + w * 3, top + w * 0.9); ctx.lineTo(b.x + w * 0.4, top + w * 1.2); ctx.closePath(); ctx.fill();
  }
}

export function drawRock(ctx, V, x, y, r) {
  const b = V.pt(x, y, 0);
  if (!b) return;
  const rw = Math.max(3, r * b.s), rh = rw * 0.9, cy = b.y - rh * 0.35;
  ctx.fillStyle = 'rgba(10,30,20,0.3)'; ctx.beginPath(); ctx.ellipse(b.x + rw * 0.4, b.y, rw * 1.2, rw * 0.28, 0, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(b.x - rw * 0.4, cy - rh * 0.5, rw * 0.1, b.x, cy, rw * 1.2);
  g.addColorStop(0, '#9aa0a8'); g.addColorStop(0.45, '#4a5058'); g.addColorStop(1, '#1b1e24');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(b.x - rw, b.y);
  ctx.quadraticCurveTo(b.x - rw * 1.05, cy - rh * 0.9, b.x - rw * 0.2, cy - rh * 1.05);
  ctx.quadraticCurveTo(b.x + rw * 0.9, cy - rh * 1.1, b.x + rw, b.y);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(b.x - rw * 0.35, cy - rh * 0.55, rw * 0.28, rh * 0.14, -0.5, 0, TAU); ctx.fill();
}

export function drawPalm(ctx, V, x, y, h, t, lean = 0.25) {
  const b = V.pt(x, y, 0), tp = V.pt(x + lean, y, h);
  if (!b || !tp) return;
  const s = b.s;
  ctx.strokeStyle = '#5a3d24'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, s * 0.16);
  ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x + (tp.x - b.x) * 0.1 - s * 0.1, (b.y + tp.y) / 2, tp.x, tp.y); ctx.stroke();
  const L = Math.max(10, s * 1.5);
  for (let k = 0; k < 8; k++) {
    const a = -Math.PI + (k / 7) * Math.PI + Math.sin(t * 0.9 + x * 3 + k) * 0.05;
    ctx.strokeStyle = k % 2 ? '#2f8a4a' : '#3da75a'; ctx.lineWidth = Math.max(2, s * 0.12);
    ctx.beginPath(); ctx.moveTo(tp.x, tp.y);
    ctx.quadraticCurveTo(tp.x + Math.cos(a) * L * 0.6, tp.y + Math.sin(a) * L * 0.55 - L * 0.35, tp.x + Math.cos(a) * L, tp.y + Math.sin(a) * L * 0.5 + L * 0.22);
    ctx.stroke();
  }
  ctx.fillStyle = '#6b4a2a'; ctx.beginPath(); ctx.arc(tp.x, tp.y + 3, Math.max(2, s * 0.09), 0, TAU); ctx.fill();
}

// A disc on its edge at ground position (x, y). `face` 0..1: how much of its face the camera sees (1 = side-on).
export function drawDisc(ctx, V, x, y, side, o = {}) {
  const b = V.pt(x, y, DISC_R);
  if (!b) return;
  const ry = DISC_R * b.s, rx = Math.max(ry * 0.22, ry * (o.face ?? 0.4)), cx = b.x, cy = b.y - 0;
  const alpha = o.alpha ?? 1;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(10,40,20,0.32)'; ctx.beginPath(); ctx.ellipse(cx + ry * 0.35, cy + ry, Math.max(rx, ry * 0.5) * 1.1, Math.max(1.5, ry * 0.2), 0, 0, TAU); ctx.fill();
  const S = SIDE[side] || SIDE[0];
  const g = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
  g.addColorStop(0, S.hi); g.addColorStop(0.45, S.base); g.addColorStop(1, S.dark);
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(1, ry * 0.08); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke();
  if (rx > ry * 0.5) {
    // polished face: an inner ring, a roll mark that turns with the distance, a soft highlight
    ctx.strokeStyle = S.band; ctx.lineWidth = Math.max(1.2, ry * 0.07); ctx.globalAlpha = alpha * 0.75;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.68, ry * 0.68, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = alpha;
    const a = o.spin || 0;
    ctx.strokeStyle = S.band; ctx.lineWidth = Math.max(1.5, ry * 0.1);
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * rx * 0.2, cy + Math.sin(a) * ry * 0.2); ctx.lineTo(cx + Math.cos(a) * rx * 0.68, cy + Math.sin(a) * ry * 0.68); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(cx - rx * 0.3, cy - ry * 0.45, Math.max(1, rx * 0.22), ry * 0.2, -0.4, 0, TAU); ctx.fill();
  ctx.restore();
}

// A flat disc face for icons, the pad and the reader: radius r at (x, y).
export function discIcon(ctx, x, y, r, side, spin = 0.8) {
  const S = SIDE[side] || SIDE[0];
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + r * 0.15, y + r * 0.95, r * 0.95, r * 0.18, 0, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
  g.addColorStop(0, S.hi); g.addColorStop(0.5, S.base); g.addColorStop(1, S.dark);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.07); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.stroke();
  ctx.strokeStyle = S.band; ctx.globalAlpha = 0.75; ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.beginPath(); ctx.arc(x, y, r * 0.68, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.beginPath(); ctx.moveTo(x + Math.cos(spin) * r * 0.2, y + Math.sin(spin) * r * 0.2); ctx.lineTo(x + Math.cos(spin) * r * 0.68, y + Math.sin(spin) * r * 0.68); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.28, r * 0.16, -0.7, 0, TAU); ctx.fill();
  ctx.restore();
}

export const SIZES = { DISC_R, STAKE_R, FAR_R };

// The 2D fallback picture of the ballpark: used when WebGL is unavailable (and by tools/arc shots). It draws the same camera as the 3D layer
// (cam.js) with plain canvas shapes, so everything the HUD labels still lines up. Pure functions of (state, size).
import { PARKS, fenceDist, FENCE_H, PITCH_Z, FOUL_DEG, DEG, clamp, lerp, sectorCentre, SECTORS, SECTOR_DEG, PITCH_KEYS, PITCHES } from './core.js';
import { project } from './cam.js';
import { ballNow } from './engine.js';
import { vGrad, glow, shade } from './art.js';

const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); };

export function drawBallpark(ctx, w, h, cam, r, parkKey, t, look = {}) {
  const park = PARKS[parkKey] ?? PARKS.harbor;
  const night = park.light === 'night', day = park.light === 'day';
  const P = (x, y, z) => project(cam, w, h, [x, y, z], {});
  const hor = P(0, 0, 900);
  const hy = clamp(hor.y, 0, h);
  const sky = park.sky;
  ctx.fillStyle = vGrad(ctx, 0, hy, [[0, sky[0]], [0.7, sky[1]], [1, sky[2]]]);
  ctx.fillRect(0, 0, w, hy + 2);
  if (night) { ctx.fillStyle = '#fff'; for (let i = 0; i < 50; i++) { ctx.globalAlpha = 0.25 + 0.3 * Math.sin(t * 1.5 + i); ctx.fillRect((i * 97) % w, (i * 53) % Math.max(10, hy * 0.7), 2, 2); } ctx.globalAlpha = 1; }
  // ground
  const gA = day ? '#58a542' : night ? '#2f6a36' : '#4c9340', gB = day ? '#4a9437' : night ? '#285c2f' : '#41823a';
  ctx.fillStyle = vGrad(ctx, hy, h, [[0, gB], [1, gA]]); ctx.fillRect(0, hy, w, h - hy);
  // stands and wall
  const wallTop = [], wallBot = [], standTop = [];
  for (let a = -52; a <= 52; a += 4) {
    const d = fenceDist(parkKey, clamp(a, -FOUL_DEG, FOUL_DEG)) + (Math.abs(a) > FOUL_DEG ? (Math.abs(a) - FOUL_DEG) * 3 : 0), s = Math.sin(a * DEG) * d, c = Math.cos(a * DEG) * d;
    wallBot.push(P(s, 0, c)); wallTop.push(P(s, FENCE_H, c)); standTop.push(P(s * 1.28, 20, c * 1.28));
  }
  const ok = (arr) => arr.every((p) => p.ok);
  if (ok(wallBot) && ok(standTop)) {
    poly(ctx, [...standTop, ...wallTop.slice().reverse()]);
    ctx.fillStyle = vGrad(ctx, standTop[0].y, wallTop[0].y, [[0, night ? '#242a4a' : '#6b6f86'], [1, night ? '#3a3560' : '#8d8aa0']]); ctx.fill();
    ctx.fillStyle = night ? 'rgba(255,214,140,0.45)' : 'rgba(255,255,255,0.28)';
    for (let i = 0; i < 160; i++) { const u = (i * 0.6180339) % 1, v = (i * 0.3819) % 1; const k = Math.floor(u * (standTop.length - 1)); const a = standTop[k], b = standTop[k + 1], c = wallTop[k]; const x = lerp(a.x, b.x, (u * 7) % 1), y = lerp(c.y, a.y, v); ctx.fillRect(x, y, 3, 3); }
    poly(ctx, [...wallTop, ...wallBot.slice().reverse()]); ctx.fillStyle = '#1f5a45'; ctx.fill();
    ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 3; ctx.beginPath(); wallTop.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  }
  // warning track + infield
  const dirt = day ? '#b88a5a' : '#a67b52';
  const ring = [];
  for (let a = -46; a <= 46; a += 4) { const d = fenceDist(parkKey, a) - 5; ring.push(P(Math.sin(a * DEG) * d, 0, Math.cos(a * DEG) * d)); }
  const inner = []; for (let a = 46; a >= -46; a -= 4) { const d = fenceDist(parkKey, a); inner.push(P(Math.sin(a * DEG) * d, 0, Math.cos(a * DEG) * d)); }
  if (ok(ring) && ok(inner)) { poly(ctx, [...ring, ...inner]); ctx.fillStyle = dirt; ctx.fill(); }
  const circ = []; for (let a = 0; a < 360; a += 15) circ.push(P(Math.sin(a * DEG) * 29, 0, PITCH_Z + Math.cos(a * DEG) * 29));
  const home = []; for (let a = 0; a < 360; a += 20) home.push(P(Math.sin(a * DEG) * 7, 0, Math.cos(a * DEG) * 7 + 1.5));
  if (ok(circ)) { poly(ctx, circ); ctx.fillStyle = dirt; ctx.fill(); }
  const dia = [P(0, 0, 4), P(19.4 - 1.5, 0, 19.4), P(0, 0, 38.8 - 3), P(-19.4 + 1.5, 0, 19.4)];
  if (ok(dia)) { poly(ctx, dia); ctx.fillStyle = day ? '#4fa13b' : night ? '#2b6a33' : '#478f3d'; ctx.fill(); }
  if (ok(home)) { poly(ctx, home); ctx.fillStyle = dirt; ctx.fill(); }
  // lines
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
  for (const s of [-1, 1]) { const a = P(0, 0.01, 0), b = P(s * 90, 0.01, 90); if (b.ok) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
  // spotlight sector on the stands
  if (r && ok(standTop)) {
    const s = r.spot, a0 = -FOUL_DEG + s * SECTOR_DEG, a1 = a0 + SECTOR_DEG, pts = [];
    for (const [a, hh] of [[a0, 0.5], [a1, 0.5], [a1, 14], [a0, 14]]) { const d = fenceDist(parkKey, a) * (hh > 1 ? 1.2 : 1.01); pts.push(P(Math.sin(a * DEG) * d, hh, Math.cos(a * DEG) * d)); }
    if (pts.every((p) => p.ok)) { poly(ctx, pts); ctx.fillStyle = 'rgba(255,236,150,0.42)'; ctx.fill(); }
  }
  // bases, plate, mound
  const plate = P(0, 0.02, 0.2); if (plate.ok) { ctx.fillStyle = '#fff'; ctx.fillRect(plate.x - 0.215 * plate.k, plate.y - 3, 0.43 * plate.k, 6); }
  const mound = P(0, MOUND(), PITCH_Z); if (mound.ok) { ctx.fillStyle = dirt; ctx.beginPath(); ctx.ellipse(mound.x, mound.y, 2.5 * mound.k, 0.6 * mound.k * 0.35, 0, 0, 7); ctx.fill(); }
  for (const [bx, bz] of [[19.4, 19.4], [0, 38.8], [-19.4, 19.4]]) { const b = P(bx, 0.05, bz); if (b.ok) { ctx.fillStyle = '#fff'; ctx.fillRect(b.x - 0.19 * b.k, b.y - 0.19 * b.k * 0.3, 0.38 * b.k, 0.38 * b.k * 0.3); } }
  // people (simple)
  if (r) {
    const bx = -0.8 * r.batter.hand;
    figure(ctx, P, bx, 0, 0, r.batter.trim, '#f2f0e8', look.bat);
    figure(ctx, P, -0.2, 0.25, PITCH_Z, '#f3f0e8', '#e9e6dc', look.pit);
  }
  // ball
  if (r) {
    const b = ballNow(r);
    if (b) {
      const q = P(b[0], b[1], b[2]), g = P(b[0], 0, b[2]);
      if (q.ok) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(g.x, g.y, Math.max(3, 0.2 * g.k), Math.max(1.5, 0.07 * g.k), 0, 0, 7); ctx.fill();
        const rad = Math.max(3.2, 0.1 * q.k);
        glow(ctx, q.x, q.y, rad * 3.2, 'rgba(255,248,220,A)', 0.55);
        ctx.fillStyle = '#fffdf6'; ctx.beginPath(); ctx.arc(q.x, q.y, rad, 0, 7); ctx.fill();
        ctx.strokeStyle = '#d9402f'; ctx.lineWidth = Math.max(1, rad * 0.18); ctx.beginPath(); ctx.arc(q.x, q.y, rad * 0.62, -0.9, 0.9); ctx.stroke();
      }
    }
  }
}
const MOUND = () => 0.25;
function figure(ctx, P, x, y, z, trim, pants, o = {}) {
  const f = P(x, y, z), hd = P(x, y + 1.78, z);
  if (!f.ok) return;
  const k = f.k, hgt = f.y - hd.y;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(f.x, f.y, 0.45 * k, 0.12 * k, 0, 0, 7); ctx.fill();
  ctx.fillStyle = pants; ctx.fillRect(f.x - 0.2 * k, f.y - hgt * 0.5, 0.4 * k, hgt * 0.5);
  ctx.fillStyle = trim; ctx.fillRect(f.x - 0.23 * k, f.y - hgt * 0.85, 0.46 * k, hgt * 0.38);
  ctx.fillStyle = '#d9a579'; ctx.beginPath(); ctx.arc(f.x, f.y - hgt * 0.92, hgt * 0.07, 0, 7); ctx.fill();
  ctx.fillStyle = '#1d2f55'; ctx.fillRect(f.x - hgt * 0.075, f.y - hgt * 0.995, hgt * 0.15, hgt * 0.05);
}

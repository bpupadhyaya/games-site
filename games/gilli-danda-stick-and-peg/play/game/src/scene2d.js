// The 2D ground used when the 3D layer is not available (no WebGL2, assets still loading, context lost): same camera numbers as the 3D scene.
import { project } from './cam.js';
import { FIELDS, DEG, STRIKER_Z, DANDA } from './core.js';
import { gilliNow } from './engine.js';

const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

export function drawGround(ctx, w, h, cam, r, fieldKey, t) {
  const F = FIELDS[fieldKey] ?? FIELDS.lane;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, F.sky[0]); g.addColorStop(0.5, F.sky[1]); g.addColorStop(0.62, F.sky[2]); g.addColorStop(0.621, '#9b7448'); g.addColorStop(1, '#6e4f30');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const P = (x, y, z) => project(cam, w, h, [x, y, z], {});
  // earth with a few lane lines
  ctx.strokeStyle = 'rgba(255,230,190,0.12)'; ctx.lineWidth = 2;
  for (let z = 0; z <= 60; z += 6) { const a = P(-40, 0, z), b = P(40, 0, z); if (a.ok && b.ok) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
  // houses as simple blocks at the sides
  for (const s of [-1, 1]) for (let z = 8; z < 60; z += 14) {
    const a = P(s * 30, 0, z), b = P(s * 30, 6, z); if (!a.ok || !b.ok) continue;
    const wd = 8 * a.k; ctx.fillStyle = '#e9dcc3'; ctx.fillRect(a.x - wd / 2, b.y, wd, a.y - b.y); ctx.fillStyle = '#b4573c'; ctx.fillRect(a.x - wd / 2 - 4, b.y - 10, wd + 8, 14);
  }
  // hole
  const hole = P(0, 0.02, 0); if (hole.ok) { ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.ellipse(hole.x, hole.y, 0.12 * hole.k, 0.05 * hole.k, 0, 0, 7); ctx.fill(); }
  if (r) {
    for (const f of r.fielders) { const a = P(f.x, 0, f.z), b = P(f.x, 1.5, f.z); if (!a.ok) continue; ctx.fillStyle = '#e8d8bc'; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5; rr(ctx, a.x - (a.y - b.y) * 0.17, b.y, (a.y - b.y) * 0.34, a.y - b.y, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#7a4c34'; ctx.beginPath(); ctx.arc(a.x, b.y - (a.y - b.y) * 0.08, (a.y - b.y) * 0.11, 0, 7); ctx.fill(); }
    const a = P(0, 0, STRIKER_Z), b = P(0, 1.6, STRIKER_Z);
    if (a.ok) { const hh = a.y - b.y; ctx.fillStyle = r.striker && r.striker.top ? r.striker.top : '#f2b02e'; rr(ctx, a.x - hh * 0.2, b.y, hh * 0.4, hh, 10); ctx.fill(); ctx.fillStyle = '#7a4c34'; ctx.beginPath(); ctx.arc(a.x, b.y - hh * 0.07, hh * 0.11, 0, 7); ctx.fill(); }
    const gl = gilliNow(r);
    const q = gl ? P(gl.x, gl.y, gl.z) : P(0, 0.05, 0);
    if (q.ok) { ctx.fillStyle = '#e6c27a'; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(4, 0.06 * q.k), 0, 7); ctx.fill(); }
  }
  void t; void DEG; void DANDA;
}

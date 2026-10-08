// The flat view, for a device without WebGL: the same valley painted in 2D from the same cameras (camera.js) - sky, three ridges with snow, terraced slopes, the lane in
// perspective, boards, flags, little archers in team robes, spectators, the arrow. It follows the simulation exactly like the 3D view, only simpler.
import { mainCam, project, basis, stand, fwd, rgt, danceSpot, lerp3, lerp, V3 } from './camera.js';
import { windAt } from './engine.js';
import { boardZ, standX, standZ, rightX } from './ballistics.js';
import { FONT } from './ui.js';

const TAU = Math.PI * 2;
const lcg = (s) => () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
const hillH = (x, z) => { const ax = Math.abs(x), d = Math.max(0, ax - 46); return (0.34 * (0.9 * d + 0.0009 * d * d)) * (0.8 + 0.3 * Math.sin(z * 0.011 + (x < 0 ? 1 : 4))) + Math.max(0, Math.abs(z - 72) - 700) * 0.25; };
const mixc = (a, b, t) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
const trees = (() => { const r = lcg(9), out = []; for (let i = 0; i < 160; i++) { const side = r() < 0.5 ? -1 : 1, x = side * (60 + r() * 220), z = -150 + r() * 460; out.push({ x, z, y: hillH(x, z), s: 0.8 + r() }); } return out; })();
const houses = (() => { const r = lcg(31), out = []; for (let i = 0; i < 9; i++) { const side = i % 2 ? 1 : -1, x = side * (64 + r() * 60), z = -60 + r() * 260; out.push({ x, z, y: hillH(x, z) }); } return out; })();
const crowd = (() => { const out = []; for (const z0 of [0, 145]) for (const [x, dz] of [[-13, 0], [-16, 6], [-11.5, -7], [14, 1], [12, 8], [17, -4], [-6.5, 7.5], [7, 9]]) out.push({ x, z: z0 + (Math.abs(x) < 8 ? (z0 ? 1 : -1) * Math.abs(dz) : dz), c: ['#b3271f', '#1f6fb3', '#e0922b', '#2c8a5b', '#7a3f9e', '#26727a'][(out.length * 5) % 6] }); return out; })();

const st = { cam: null };
export function drawFlatScene(ctx, state, E, region, full, dt, t) {
  const play = state.scene === 'play' && E, aspect = region.w / Math.max(1, region.h);
  let spec;
  if (play) spec = mainCam(E, aspect);
  else { const S = stand(1); spec = { pos: V3(S.x + 6.5 + Math.sin(t * 0.05) * 2.2, 1.35, S.z + 10), look: V3(S.x - 0.4, 1.35, S.z - 0.4), fov: aspect < 1 ? 54 : 38 }; }
  if (state.scene === 'result' && state.over && state.over.winner >= 0) { const ds = danceSpot(1); spec = { pos: ds.cam, look: ds.look, fov: aspect < 1 ? 50 : 36 }; }
  const k = !st.cam ? 1 : 1 - Math.exp(-dt * (play && E.phase === 'flight' ? 16 : 5));
  st.cam = st.cam ? { pos: lerp3(st.cam.pos, spec.pos, k), look: lerp3(st.cam.look, spec.look, k), fov: lerp(st.cam.fov, spec.fov, k) } : spec;
  const cam = st.cam, W = ctx.canvas ? 0 : 0; void W;
  ctx.save();
  const P = (x, y, z) => { const p = project(cam, aspect, V3(x, y, z)); return p ? { x: region.x + (p.x * 0.5 + 0.5) * region.w, y: region.y + (0.5 - p.y * 0.5) * region.h, z: p.z } : null; };
  // polygons are clipped against the camera's near plane before projecting, so ground close to the camera never vanishes
  const bs = basis(cam), thv = Math.tan((cam.fov * Math.PI) / 360);
  const toCam = (x, y, z) => { const dx = x - cam.pos.x, dy = y - cam.pos.y, dz = z - cam.pos.z; return [dx * bs.r.x + dy * bs.r.y + dz * bs.r.z, dx * bs.u.x + dy * bs.u.y + dz * bs.u.z, dx * bs.f.x + dy * bs.f.y + dz * bs.f.z]; };
  const poly = (pts) => { const c = pts.map((p) => toCam(p[0], p[1], p[2])), out = [], N = 0.4;
    for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length], ina = a[2] > N, inb = b[2] > N; if (ina) out.push(a); if (ina !== inb) { const t2 = (N - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t2, a[1] + (b[1] - a[1]) * t2, N]); } }
    return out.length < 3 ? null : out.map((q) => ({ x: region.x + ((q[0] / q[2] / (thv * aspect)) * 0.5 + 0.5) * region.w, y: region.y + (0.5 - (q[1] / q[2] / thv) * 0.5) * region.h })); };
  const fillPoly = (pts, style) => { const q = poly(pts); if (!q) return; ctx.fillStyle = style; ctx.beginPath(); ctx.moveTo(q[0].x, q[0].y); for (let i = 1; i < q.length; i++) ctx.lineTo(q[i].x, q[i].y); ctx.closePath(); ctx.fill(); };
  // sky and ridges: the ridges are painted by azimuth, so they slide as the camera turns
  const horizonRay = (sx) => { const nx = ((sx - region.x) / region.w) * 2 - 1, th = Math.tan((cam.fov * Math.PI) / 360); return { nx, th }; };
  const fwd0 = V3(cam.look.x - cam.pos.x, cam.look.y - cam.pos.y, cam.look.z - cam.pos.z), yaw0 = Math.atan2(fwd0.x, fwd0.z), pitch0 = Math.atan2(fwd0.y, Math.hypot(fwd0.x, fwd0.z));
  const th = Math.tan((cam.fov * Math.PI) / 360), yOfElev = (el) => region.y + (0.5 - (Math.tan(el - pitch0) / th) * 0.5) * region.h, yH = yOfElev(0);
  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(8, yH)); sky.addColorStop(0, '#2f6fb5'); sky.addColorStop(0.7, '#9cc8e8'); sky.addColorStop(1, '#d9ecf2');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, full.w, full.h);
  const sun = P(cam.pos.x - 900, 700, cam.pos.z + 1500); if (sun) { const g = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, region.h * 0.4); g.addColorStop(0, 'rgba(255,246,200,0.85)'); g.addColorStop(1, 'rgba(255,246,200,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, full.w, full.h); }
  const ridge = (seed, base, amp, col, snow, haze) => {
    ctx.beginPath(); ctx.moveTo(0, yH + 4);
    const pts = [];
    for (let sx = 0; sx <= full.w + 8; sx += 8) { const { nx } = horizonRay(sx), az = yaw0 + Math.atan(nx * th * aspect), e = base + amp * (0.5 * Math.abs(Math.sin(az * 3.1 + seed)) + 0.3 * Math.abs(Math.sin(az * 7.7 + seed * 2)) + 0.2 * Math.abs(Math.sin(az * 17.3 + seed * 3))); const y = yOfElev(e); pts.push([sx, y, e]); ctx.lineTo(sx, y); }
    ctx.lineTo(full.w, yH + 4); ctx.closePath(); ctx.fillStyle = mixc(col, [214, 232, 240], haze); ctx.fill();
    if (snow) { ctx.fillStyle = 'rgba(246,250,253,0.92)'; for (let i = 1; i < pts.length - 1; i++) { const a = pts[i]; if (a[2] > snow) { ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1] + (a[1] - pts[i - 1][1]) * 0 + 0); ctx.lineTo(a[0], a[1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.lineTo(a[0], a[1] + Math.min(24, (a[2] - snow) * region.h * 3)); ctx.closePath(); ctx.fill(); } } }
  };
  ridge(1.3, 0.1, 0.17, [104, 128, 150], 0.19, 0.55); ridge(2.7, 0.06, 0.1, [86, 118, 128], 0.14, 0.38); ridge(4.1, 0.025, 0.06, [70, 108, 90], 0, 0.2);
  // ground
  const gr = ctx.createLinearGradient(0, yH, 0, Math.max(yH + 10, full.h)); gr.addColorStop(0, '#a6c778'); gr.addColorStop(0.15, '#79a64a'); gr.addColorStop(1, '#4f8a35'); ctx.fillStyle = gr; ctx.fillRect(0, yH, full.w, Math.max(0, full.h - yH));
  // the valley sides, drawn far to near as strips of quads
  const zs = []; for (let z = 520; z > -90; z -= (z > 200 ? 40 : 18)) zs.push(z);
  const bands = [48, 80, 130, 200, 300];
  for (let zi = 0; zi < zs.length - 1; zi++) for (const side of [-1, 1]) for (let bi = bands.length - 2; bi >= 0; bi--) {
    const x0 = side * bands[bi], x1 = side * bands[bi + 1], za = zs[zi], zb = zs[zi + 1];
    const terr = bi < 2 && ((zi + bi) % 2 === 0), dist = Math.min(1, Math.max(0, (za - cam.pos.z) / 500));
    fillPoly([[x0, hillH(x0, za), za], [x1, hillH(x1, za), za], [x1, hillH(x1, zb), zb], [x0, hillH(x0, zb), zb]], mixc(terr ? [118, 160, 70] : [92, 140, 62], [150, 190, 150], dist * 0.7 + (bi >= 3 ? 0.15 : 0)));
  }
  // river
  { ctx.strokeStyle = 'rgba(110,160,190,0.9)'; ctx.lineCap = 'round'; let prev = null; for (let z = 300; z > -100; z -= 14) { const x = -37 + 6 * Math.sin(z * 0.012), p = P(x, 0, z); if (p && prev) { ctx.lineWidth = Math.max(1, 5 * 220 / Math.max(30, p.z) * (region.h / 700)); ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke(); } prev = p; } }
  // lane
  fillPoly([[-14, 0, -20], [14, 0, -20], [14, 0, 165], [-14, 0, 165]], '#86b458');
  for (let z = -20; z < 165; z += 10) fillPoly([[-14, 0.01, z + 5], [14, 0.01, z + 5], [14, 0.01, z + 10], [-14, 0.01, z + 10]], 'rgba(255,255,255,0.07)');
  for (const z of [0, 145]) fillPoly([[-5, 0.02, z - 0.12], [5, 0.02, z - 0.12], [5, 0.02, z + 0.12], [-5, 0.02, z + 0.12]], 'rgba(245,242,230,0.7)');
  // trees and houses, far to near
  const items = [];
  for (const tr of trees) items.push({ z: tr.z, draw: () => { const b = P(tr.x, tr.y, tr.z), t2 = P(tr.x, tr.y + 9 * tr.s, tr.z); if (!b || !t2) return; const h = b.y - t2.y; if (h < 2) return; ctx.fillStyle = '#2f5a38'; ctx.beginPath(); ctx.moveTo(b.x, t2.y); ctx.lineTo(b.x - h * 0.28, b.y - h * 0.1); ctx.lineTo(b.x + h * 0.28, b.y - h * 0.1); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#3d7448'; ctx.beginPath(); ctx.moveTo(b.x, t2.y + h * 0.1); ctx.lineTo(b.x - h * 0.2, b.y - h * 0.35); ctx.lineTo(b.x + h * 0.2, b.y - h * 0.35); ctx.closePath(); ctx.fill(); } });
  for (const hs of houses) items.push({ z: hs.z, draw: () => { const b = P(hs.x, hs.y, hs.z), t2 = P(hs.x, hs.y + 7, hs.z); if (!b || !t2) return; const h = b.y - t2.y, w = h * 1.5; if (h < 3) return; ctx.fillStyle = '#efe7d4'; ctx.fillRect(b.x - w / 2, b.y - h * 0.5, w, h * 0.5); ctx.fillStyle = '#5a3a22'; ctx.fillRect(b.x - w / 2, b.y - h * 0.9, w, h * 0.4); ctx.fillStyle = '#e8e2d6'; ctx.beginPath(); ctx.moveTo(b.x - w * 0.62, b.y - h * 0.9); ctx.lineTo(b.x, b.y - h * 1.2); ctx.lineTo(b.x + w * 0.62, b.y - h * 0.9); ctx.closePath(); ctx.fill(); } });
  items.sort((a, b) => b.z - a.z).forEach((i) => i.draw());
  // the wind streamers on their poles
  const ww = E ? windAt(E, E.t) : { x: 1, z: 0.4, s: 1.4 };
  for (const z of [30, 60, 90, 120]) for (const sx of [-1, 1]) { const x = sx * 12, b = P(x, 0, z), t2 = P(x, 5.2, z); if (!b || !t2) continue; ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = Math.max(1, (b.y - t2.y) * 0.02); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(t2.x, t2.y); ctx.stroke(); const tip = P(x + ww.x * 0.5, 5.2 - 1.2 * Math.exp(-ww.s / 3), z + ww.z * 0.5); if (tip) { ctx.strokeStyle = z % 60 ? '#d6382a' : '#f2c14e'; ctx.lineWidth = Math.max(2, (b.y - t2.y) * 0.05); ctx.beginPath(); ctx.moveTo(t2.x, t2.y); ctx.lineTo(tip.x, tip.y); ctx.stroke(); } }
  // boards
  const board = (z) => { const b = P(0, 0, z), t2 = P(0, 0.91, z); if (!b || !t2) return; const h = Math.max(4, b.y - t2.y), w = h * 0.31; ctx.fillStyle = '#e8dcc0'; ctx.fillRect(b.x - w / 2, b.y - h, w, h); ctx.strokeStyle = '#8a1e14'; ctx.lineWidth = Math.max(1, w * 0.07); ctx.strokeRect(b.x - w / 2, b.y - h, w, h); const c = P(0, 0.62, z); if (c) for (const [rr, col] of [[0.115, '#1f3d6e'], [0.07, '#c42a1d'], [0.035, '#f0b830']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(1, (rr / 0.28) * w), 0, 7); ctx.fill(); } };
  // people, far to near: a simple painted figure (robe, shirt, head, arms) in the team colours
  const people = [];
  const figure = (x, z, o) => people.push({ z, draw: () => {
    const f = P(x, 0, z), h = P(x, 1.75, z); if (!f || !h) return; const H = f.y - h.y; if (H < 5) return; const w = H * 0.3, ph = o.pose || 0;
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(f.x, f.y, w * 0.8, w * 0.22, 0, 0, 7); ctx.fill();
    ctx.fillStyle = o.skin || '#c8936a'; ctx.fillRect(f.x - w * 0.16, f.y - H * 0.33, w * 0.12, H * 0.3); ctx.fillRect(f.x + w * 0.04, f.y - H * 0.33, w * 0.12, H * 0.3);
    ctx.fillStyle = o.robe; ctx.beginPath(); ctx.moveTo(f.x - w * 0.42, f.y - H * (o.long ? 0.06 : 0.3)); ctx.lineTo(f.x + w * 0.42, f.y - H * (o.long ? 0.06 : 0.3)); ctx.lineTo(f.x + w * 0.3, f.y - H * 0.58); ctx.lineTo(f.x - w * 0.3, f.y - H * 0.58); ctx.closePath(); ctx.fill();
    ctx.fillStyle = o.trim || '#f2c14e'; ctx.fillRect(f.x - w * 0.32, f.y - H * 0.6, w * 0.64, H * 0.05);
    ctx.fillStyle = o.robe; ctx.fillRect(f.x - w * 0.3, f.y - H * 0.84, w * 0.6, H * 0.26);
    ctx.fillStyle = o.skin || '#c8936a'; ctx.beginPath(); ctx.arc(f.x, f.y - H * 0.9, H * 0.075, 0, 7); ctx.fill(); ctx.fillStyle = '#1b1714'; ctx.beginPath(); ctx.arc(f.x, f.y - H * 0.93, H * 0.075, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = o.robe; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.5, H * 0.06);
    const arm = (sgn, a1, a2) => { ctx.beginPath(); ctx.moveTo(f.x + sgn * w * 0.3, f.y - H * 0.8); ctx.lineTo(f.x + sgn * w * 0.3 + a1 * H, f.y - H * 0.8 + a2 * H); ctx.stroke(); };
    if (o.mode === 'dance') { const s = Math.sin(t * 5 + ph); arm(-1, -0.16, -0.22 - 0.1 * s); arm(1, 0.16, -0.22 + 0.1 * s); }
    else if (o.mode === 'shoot') { arm(-1, -0.42, -0.02); arm(1, 0.1, -0.02); ctx.strokeStyle = '#b98d45'; ctx.lineWidth = Math.max(1.5, H * 0.03); ctx.beginPath(); ctx.moveTo(f.x - w * 0.3 - 0.42 * H, f.y - H * 1.0); ctx.quadraticCurveTo(f.x - w * 0.3 - 0.5 * H, f.y - H * 0.82, f.x - w * 0.3 - 0.42 * H, f.y - H * 0.62); ctx.stroke(); }
    else if (o.mode === 'cheer') { const s = Math.sin(t * 6 + ph); arm(-1, -0.12, -0.3 - 0.05 * s); arm(1, 0.12, -0.3 + 0.05 * s); }
    else { arm(-1, -0.04, 0.22); arm(1, 0.04, 0.22); }
  } });
  if (E) {
    const dir = play || state.scene !== 'result' ? E.dir : 1, S = stand(dir), F = fwd(dir), R = rgt(dir), cheerEnd = play && (E.phase === 'result' || E.phase === 'dance') && E.last && E.last.pts >= 2;
    for (let tm = 0; tm < E.teams.length; tm++) E.teams[tm].members.forEach((m, mi) => {
      const T = E.teams[tm], isCur = play && E.cur && E.cur.team === tm && E.cur.m === mi && E.phase !== 'swap' && E.phase !== 'endscore' && E.phase !== 'walk';
      let x = S.x + F.x * (2.6 + 1.1 * mi) + R.x * (-5.4 - 3.6 * tm - 0.6 * (mi % 2)), z = S.z + F.z * (2.6 + 1.1 * mi) + R.z * (-5.4 - 3.6 * tm - 0.6 * (mi % 2)), mode = 'idle';
      if (isCur) { x = S.x; z = S.z; mode = 'shoot'; }
      const winner = state.scene === 'result' && state.over ? state.over.winner : -1;
      if (winner >= 0 && !play) { const ds = danceSpot(1); if (tm === winner) { x = ds.c.x + R.x * (mi - 1) * 1.55; z = ds.c.z + R.z * (mi - 1) * 1.55; mode = 'dance'; } else { x = ds.c.x + R.x * ((mi - 1) * 1.7); z = ds.c.z - 3.2; mode = 'cheer'; } }
      else if (play && E.phase === 'dance' && E.last && E.last.team === tm) { const ds = danceSpot(dir); x = ds.c.x + R.x * (mi - 1) * 1.55; z = ds.c.z + R.z * (mi - 1) * 1.55; mode = 'dance'; }
      else if (cheerEnd && E.last.team === tm && !isCur) mode = 'cheer';
      figure(x, z, { robe: T.top, trim: T.trim, long: m.g === 'f', mode, pose: mi * 1.3, skin: ['#c8936a', '#b48765', '#a97a47'][mi % 3] });
    });
  } else { const S = stand(1); for (let tm = 0; tm < 2; tm++) for (let mi = 0; mi < 3; mi++) figure(S.x + (mi - 1) * 1.9 * rgt(1).x, S.z + (tm ? 5 : 0), { robe: tm ? '#1f6fb3' : '#b3271f', long: mi === 1, mode: 'idle', pose: mi }); }
  for (const c of crowd) figure(c.x, c.z, { robe: c.c, long: (c.x * 3 | 0) % 2 === 0, mode: play && E.phase === 'dance' ? 'cheer' : 'idle', pose: c.x });
  figure(-2.5 * 0 + 2.7 * (E ? rgt(E.dir).x : 1), E ? boardZ(E.dir) - E.dir * 1.5 : 143, { robe: '#8a6a2a', mode: cheerEnd2(E) ? 'cheer' : 'idle' });
  people.sort((a, b) => b.z - a.z); board(0); board(145); people.forEach((p) => p.draw());
  // the arrow and its trail
  if (play && E.arrow && E.arrow.alive) { const a = E.arrow, sp = Math.hypot(a.vx, a.vy, a.vz) || 1, head = P(a.x, a.y, a.z), tail = P(a.x - (a.vx / sp) * 3.5, a.y - (a.vy / sp) * 3.5, a.z - (a.vz / sp) * 3.5); if (head && tail) { ctx.strokeStyle = 'rgba(255,244,210,0.8)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(head.x, head.y); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(head.x, head.y, 3, 0, 7); ctx.fill(); } }
  if (play && E.stuck) for (const s of E.stuck) { const sp = Math.hypot(s.vx, s.vy, s.vz) || 1, a = P(s.x, s.y, s.z), b = P(s.x - (s.vx / sp) * 0.9, s.y - (s.vy / sp) * 0.9, s.z - (s.vz / sp) * 0.9); if (a && b) { ctx.strokeStyle = '#d8b46a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
  ctx.restore();
  void FONT; void standX; void standZ; void rightX;
}
const cheerEnd2 = (E) => !!E && (E.phase === 'result' || E.phase === 'dance') && E.last && E.last.pts >= 2;

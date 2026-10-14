// Beach Flags: the world and the people. A perspective camera behind the racers, a drawn beach, and a small 3D skeleton of
// joints that is posed, projected and painted as shaded limbs. Pure drawing: reads state, never writes it.
import { LANE_W, FLAG_Z, FLAG_H, RISE_T, DIVE_T, SLIDE_T, LOOKS, clamp } from './sim.js';

const TAU = Math.PI * 2;
export const SHORE_Z = 46;
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

// ---- camera ----------------------------------------------------------------------------------------------------------------
// rect: where the world is drawn. camX/camZ: the point the camera looks from (the camera sits behind and above it).
export function makeCam(rect, camX, camZ, lift = 0) {
  const ZR = 6.0;
  const pm = Math.min(rect.w / 11.6, rect.h * 0.15);        // pixels per metre at the player's depth
  const land = rect.w > rect.h * 0.9;
  const yh = rect.y + rect.h * (land ? 0.2 : 0.17), foot = rect.y + rect.h * ((land ? 0.72 : 0.68) - lift);
  return { rect, cx: rect.x + rect.w / 2, yh, F: pm * ZR, camH: (foot - yh) / pm, camX, camZ, pm, ZR };
}
export function proj(cam, x, y, z) {
  const zr = Math.max(0.45, z - cam.camZ), k = cam.F / zr;
  return { x: cam.cx + (x - cam.camX) * k, y: cam.yh + (cam.camH - y) * k, k, zr };
}
const groundY = (cam, z) => cam.yh + (cam.camH * cam.F) / Math.max(0.45, z - cam.camZ);

// ---- the beach -------------------------------------------------------------------------------------------------------------
function hash(n) { let h = Math.imul(n | 0, 374761393) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

export function drawBeach(ctx, cam, t) {
  const R = cam.rect, yh = cam.yh, x0 = R.x, w = R.w, bottom = R.y + R.h;
  ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
  // sky
  let g = ctx.createLinearGradient(0, R.y, 0, yh);
  g.addColorStop(0, '#2f9be6'); g.addColorStop(0.6, '#8fd5fb'); g.addColorStop(1, '#e8f7ff');
  ctx.fillStyle = g; ctx.fillRect(x0, R.y, w, yh - R.y + 1);
  // sun and a soft glow
  const sx = x0 + w * 0.8, sy = R.y + (yh - R.y) * 0.5;
  g = ctx.createRadialGradient(sx, sy, 4, sx, sy, (yh - R.y) * 0.9);
  g.addColorStop(0, 'rgba(255,248,214,0.95)'); g.addColorStop(0.15, 'rgba(255,240,190,0.55)'); g.addColorStop(1, 'rgba(255,240,190,0)');
  ctx.fillStyle = g; ctx.fillRect(x0, R.y, w, yh - R.y);
  // clouds drift slowly
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 4; i++) {
    const cx = x0 + ((i * 0.31 + t * 0.004 + 0.1) % 1.2 - 0.1) * w, cy = R.y + (yh - R.y) * (0.2 + 0.17 * (i % 3)), s = (yh - R.y) * (0.12 + 0.03 * (i % 2));
    for (const [dx, dy, r] of [[0, 0, 1], [0.9, 0.12, 0.8], [-0.9, 0.15, 0.75], [0.3, -0.25, 0.7]]) { ctx.beginPath(); ctx.ellipse(cx + dx * s, cy + dy * s, r * s * 1.1, r * s * 0.55, 0, 0, TAU); ctx.fill(); }
  }
  // a headland on the horizon
  ctx.fillStyle = '#6d9bb5';
  ctx.beginPath(); ctx.moveTo(x0, yh);
  const hh = (yh - R.y) * 0.16;
  ctx.bezierCurveTo(x0 + w * 0.08, yh - hh * 1.6, x0 + w * 0.2, yh - hh * 0.5, x0 + w * 0.34, yh - hh * 0.1);
  ctx.lineTo(x0 + w * 0.34, yh); ctx.closePath(); ctx.fill();
  // a distant strip of sea: deep blue at the horizon, turquoise at the shore, with surf lines rolling in
  const ys = groundY(cam, SHORE_Z);
  g = ctx.createLinearGradient(0, yh, 0, ys);
  g.addColorStop(0, '#0a4f86'); g.addColorStop(0.5, '#1486b8'); g.addColorStop(1, '#47c9d4');
  ctx.fillStyle = g; ctx.fillRect(x0, yh, w, ys - yh + 2);
  for (let i = 0; i < 4; i++) {                       // wave crests, each rolling towards the beach and fading as it breaks
    const u = ((t * 0.12 + i / 4) % 1), yy = yh + (ys - yh) * (0.15 + 0.8 * u), th = Math.max(1.5, (ys - yh) * 0.05 * (0.4 + u));
    ctx.fillStyle = `rgba(255,255,255,${0.1 + 0.32 * u * (1 - Math.pow(u, 6))})`;
    for (let j = 0; j < 4; j++) { const px = x0 + (((hash(i * 5 + j) + j * 0.25) % 1) * 1.1 - 0.05) * w; ctx.fillRect(px, yy, w * (0.12 + 0.12 * hash(i + j * 9)), th); }
  }
  g = ctx.createLinearGradient(0, yh, 0, ys);
  g.addColorStop(0, 'rgba(255,248,214,0.6)'); g.addColorStop(1, 'rgba(255,248,214,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx - w * 0.02, yh); ctx.lineTo(sx + w * 0.02, yh); ctx.lineTo(sx + w * 0.08, ys); ctx.lineTo(sx - w * 0.08, ys); ctx.closePath(); ctx.fill();
  // surf foam, wet sand, dry sand
  const wob = Math.sin(t * 0.9) * 0.5;
  const yf = groundY(cam, SHORE_Z + wob), yw = groundY(cam, SHORE_Z - 5.5);
  const fh = Math.max(5, (yw - yf) * 0.35);
  ctx.fillStyle = '#f2fdff'; ctx.fillRect(x0, yf - 2, w, fh);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(x0, yf - 2 - fh * 0.6, w, fh * 0.5);          // a second, thinner breaker behind the first
  g = ctx.createLinearGradient(0, yf, 0, yw);
  g.addColorStop(0, '#9f8660'); g.addColorStop(1, '#d4bb8d');
  ctx.fillStyle = g; ctx.fillRect(x0, yf + fh - 2, w, yw - yf - fh + 3);
  g = ctx.createLinearGradient(0, yw, 0, bottom);
  g.addColorStop(0, '#f1dcab'); g.addColorStop(1, '#e6c98d');
  ctx.fillStyle = g; ctx.fillRect(x0, yw, w, bottom - yw);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x0, yw, w, 2);
  // ripples in the dry sand
  const zStep = 0.9, z0 = Math.floor((cam.camZ + 0.6) / zStep) * zStep;
  for (let z = z0; z < SHORE_Z - 5.6; z += zStep) {
    const y = groundY(cam, z); if (y > bottom || y < yw) continue;
    const k = cam.F / (z - cam.camZ), odd = Math.round(z / zStep) & 1;
    const hv = hash(Math.round(z / zStep) * 7 + 3);
    if (hv < 0.35) continue;
    ctx.fillStyle = odd ? `rgba(150,110,50,${0.04 + 0.05 * hv})` : `rgba(255,255,255,${0.05 + 0.07 * hv})`;
    const sx0 = x0 + hash(Math.round(z / zStep) * 5 + 1) * w * 0.3, sw = w * (0.4 + 0.6 * hv);
    ctx.fillRect(sx0, y, sw, Math.max(1, 0.012 * k + 0.8));
  }
  // specks of shell and pebble, fixed in the world
  for (let i = 0; i < 60; i++) {
    const z = z0 + hash(i * 3 + Math.floor(z0)) * 16, zz = z + 0.01 * i;
    const wx = (hash(i * 11 + 5) - 0.5) * 22 + cam.camX * 0.0;
    const y = groundY(cam, zz); if (y > bottom || y < yw) continue;
    const k = cam.F / (zz - cam.camZ), x = cam.cx + (wx - cam.camX) * k;
    ctx.fillStyle = hash(i) < 0.5 ? 'rgba(120,90,50,0.35)' : 'rgba(255,255,255,0.55)';
    ctx.fillRect(x, y, Math.max(1.5, 0.05 * k), Math.max(1, 0.03 * k));
  }
  ctx.restore();
}

// Beach sprint lanes: raked sand (alternate lanes a little darker, a shallow furrow between them), a rope on stakes down each outer side,
// an orange start tape with a cone at every lane boundary, and a flag line with a cone at each end. Nothing white and pool-like.
export const FLAG_COLS = ['#ff7a1a', '#e8503a', '#ffd23d', '#2fb67a', '#2f8fd6', '#a05cf0', '#ff5fa8'];
export function drawLanes(ctx, cam, round) {
  const n = round.n, span = round.span, zA = Math.max(cam.camZ + 0.6, -1.2), zB = FLAG_Z + 1.4;
  const xL = -span / 2 - LANE_W / 2, xR = span / 2 + LANE_W / 2;
  ctx.save(); ctx.beginPath(); ctx.rect(cam.rect.x, cam.rect.y, cam.rect.w, cam.rect.h); ctx.clip();
  const quad = (x0, x1, z0, z1, col) => {
    const a = proj(cam, x0, 0, z0), b = proj(cam, x1, 0, z0), c = proj(cam, x1, 0, z1), d = proj(cam, x0, 0, z1);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
  };
  const line = (x, z0, z1, wm, col) => {
    const a = proj(cam, x, 0, z0), b = proj(cam, x, 0, z1);
    const wa = Math.max(1, wm * a.k), wb = Math.max(1, wm * b.k);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(a.x - wa / 2, a.y); ctx.lineTo(a.x + wa / 2, a.y); ctx.lineTo(b.x + wb / 2, b.y); ctx.lineTo(b.x - wb / 2, b.y); ctx.closePath(); ctx.fill();
  };
  const cone = (x, z, h, col) => {
    const p = proj(cam, x, 0, z), q = proj(cam, x, h, z), w = 0.13 * p.k;
    if (p.k < 3) return;
    ctx.fillStyle = 'rgba(70,45,10,0.25)'; ctx.beginPath(); ctx.ellipse(p.x + w * 0.5, p.y, w * 1.1, Math.max(1, w * 0.35), 0, 0, TAU); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(p.x - w, p.y); ctx.lineTo(p.x + w, p.y); ctx.lineTo(q.x + w * 0.2, q.y); ctx.lineTo(q.x - w * 0.2, q.y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(p.x - w * 0.62, (p.y + q.y) / 2, w * 1.24, Math.max(1, w * 0.3));
  };
  if (zB > zA) {
    // raked lanes
    for (let i = 0; i < n; i++) {
      const x0 = xL + i * LANE_W;
      quad(x0, x0 + LANE_W, zA, zB, i % 2 ? 'rgba(168,124,60,0.16)' : 'rgba(255,240,200,0.14)');
    }
    for (let i = 1; i < n; i++) { const x = xL + i * LANE_W; line(x, zA, zB, 0.07, 'rgba(120,82,34,0.26)'); line(x + 0.05, zA, zB, 0.03, 'rgba(255,245,215,0.28)'); }
    // the outer ropes on stakes
    for (const x of [xL, xR]) {
      line(x, zA, zB, 0.05, 'rgba(110,70,25,0.55)');
      for (let z = Math.ceil(zA / 4) * 4; z <= zB; z += 4) {
        const p = proj(cam, x, 0, z), q = proj(cam, x, 0.5, z);
        if (p.k < 4) continue;
        ctx.strokeStyle = '#7a5528'; ctx.lineWidth = Math.max(1.2, 0.04 * p.k); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1.6, 0.06 * p.k), 0, TAU); ctx.fill();
        if (z + 4 <= zB) { const q2 = proj(cam, x, 0.5, z + 4); ctx.strokeStyle = 'rgba(255,214,120,0.9)'; ctx.lineWidth = Math.max(1, 0.025 * p.k); ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q2.x, (q.y + q2.y) / 2 + 0.03 * p.k); ctx.lineTo(q2.x, q2.y); ctx.stroke(); }
      }
    }
  }
  // start tape and cones
  if (-1.0 > cam.camZ + 0.6) {
    const a = proj(cam, xL, 0, -1.0), b = proj(cam, xR, 0, -1.0), h = Math.max(2, 0.07 * a.k);
    ctx.fillStyle = 'rgba(255,122,26,0.9)'; ctx.fillRect(a.x, a.y - h / 2, b.x - a.x, h);
    for (let i = 0; i <= n; i++) cone(xL + i * LANE_W, -1.0, 0.3, '#ff7a1a');
  }
  // the flag line: a tape on the sand and a cone at each end
  {
    const z = FLAG_Z + 0.55, a = proj(cam, xL - LANE_W, 0, z), b = proj(cam, xR + LANE_W, 0, z), h = Math.max(1.5, 0.04 * a.k);
    ctx.fillStyle = 'rgba(120,82,34,0.4)'; ctx.fillRect(a.x, a.y - h / 2, b.x - a.x, h);
    cone(xL - LANE_W, z, 0.45, '#ff7a1a'); cone(xR + LANE_W, z, 0.45, '#ff7a1a');
  }
  ctx.restore();
}

// ---- the skeleton ----------------------------------------------------------------------------------------------------------
// Joint order: head, neck, chest, pelvis, shoulderL, shoulderR, elbowL, elbowR, handL, handR, hipL, hipR, kneeL, kneeR, footL, footR.
const NJ = 16;
const newPose = () => Array.from({ length: NJ }, () => [0, 0, 0]);
const set = (p, i, x, y, z) => { p[i][0] = x; p[i][1] = y; p[i][2] = z; };
const J = { head: 0, neck: 1, chest: 2, pelvis: 3, shL: 4, shR: 5, elL: 6, elR: 7, haL: 8, haR: 9, hipL: 10, hipR: 11, knL: 12, knR: 13, ftL: 14, ftR: 15 };
const L_THIGH = 0.46, L_SHIN = 0.46, L_UARM = 0.3, L_FARM = 0.28;

// A runner in mid-stride. ph: leg phase, lean: forward lean (rad), eff: 0..1 effort.
function poseRun(ph, lean, eff, raise = 0, holdSide = 1) {
  const p = newPose(), A = 0.22 + 0.42 * eff, AR = 0.3 + 0.55 * eff;
  const cl = Math.cos(lean), sl = Math.sin(lean);
  set(p, J.pelvis, 0, 0.95, 0);
  set(p, J.chest, 0, 0.95 + 0.46 * cl, 0.46 * sl);
  set(p, J.neck, 0, 0.95 + 0.64 * cl, 0.64 * sl);
  const hl = lean * 0.5;
  set(p, J.head, 0, 0.95 + 0.64 * cl + 0.19 * Math.cos(hl), 0.64 * sl + 0.19 * Math.sin(hl));
  const sy = p[J.chest][1] + 0.03, sz = p[J.chest][2];
  set(p, J.shL, -0.2, sy, sz); set(p, J.shR, 0.2, sy, sz);
  for (const s of [-1, 1]) {
    const li = s < 0 ? 0 : 1, pl = ph + (li ? Math.PI : 0);
    const hx = s * 0.12;
    set(p, J.hipL + li, hx, 0.95, 0);
    const th = A * Math.sin(pl), bend = 0.12 + 0.95 * Math.max(0, Math.cos(pl)) * (0.35 + 0.65 * eff), sa = th - bend;
    const kx = hx, ky = 0.95 - L_THIGH * Math.cos(th), kz = L_THIGH * Math.sin(th);
    set(p, J.knL + li, kx, ky, kz);
    set(p, J.ftL + li, kx, ky - L_SHIN * Math.cos(sa), kz + L_SHIN * Math.sin(sa));
    const q = pl + Math.PI, al = AR * Math.sin(q), fa = al + 1.2 + 0.4 * (1 - eff) * 0;
    const ex = s * 0.27, ey = sy - L_UARM * Math.cos(al), ez = sz + L_UARM * Math.sin(al);
    set(p, J.elL + li, ex, ey, ez);
    set(p, J.haL + li, ex, ey - L_FARM * Math.cos(fa), ez + L_FARM * Math.sin(fa));
  }
  if (raise > 0) { // one arm up holding the baton
    const i = holdSide > 0 ? 1 : 0, s = holdSide > 0 ? 1 : -1;
    const lerpJ = (j, x, y, z) => set(p, j, lerp(p[j][0], x, raise), lerp(p[j][1], y, raise), lerp(p[j][2], z, raise));
    lerpJ(J.elL + i, s * 0.3, sy + 0.28, sz + 0.1); lerpJ(J.haL + i, s * 0.3, sy + 0.6, sz + 0.12);
  }
  ground(p);
  return p;
}
function ground(p) {
  const m = Math.min(p[J.ftL][1], p[J.ftR][1], p[J.knL][1], p[J.knR][1]);
  for (const j of p) j[1] -= m - 0.04;
}
// Face down on the sand, head towards +z. b: breathing, lift: how far the shoulders rise.
function poseProne(b = 0, lift = 0, reach = 0) {
  const p = newPose();
  set(p, J.head, 0, 0.27 + 0.012 * b + lift * 0.6, 0.94 + reach * 0.2);
  set(p, J.neck, 0, 0.21 + lift * 0.5, 0.74 + reach * 0.15);
  set(p, J.chest, 0, 0.2 + 0.015 * b + lift * 0.4, 0.5 + reach * 0.1);
  set(p, J.pelvis, 0, 0.15, -0.05);
  set(p, J.shL, -0.21, 0.19 + lift * 0.4, 0.62 + reach * 0.12); set(p, J.shR, 0.21, 0.19 + lift * 0.4, 0.62 + reach * 0.12);
  set(p, J.elL, -0.3 + reach * 0.15, 0.1, 0.52 + reach * 0.55); set(p, J.elR, 0.3 - reach * 0.15, 0.1, 0.52 + reach * 0.55);
  set(p, J.haL, -0.13, 0.1, 0.82 + reach * 0.6); set(p, J.haR, 0.13, 0.1, 0.82 + reach * 0.6);
  set(p, J.hipL, -0.1, 0.12, -0.1); set(p, J.hipR, 0.1, 0.12, -0.1);
  set(p, J.knL, -0.12, 0.1, -0.56); set(p, J.knR, 0.12, 0.1, -0.56);
  set(p, J.ftL, -0.13, 0.08, -1.0); set(p, J.ftR, 0.13, 0.08, -1.0);
  return p;
}
// The half-way key: on hands and knees, chest lifted.
function poseKneel() {
  const p = newPose();
  set(p, J.pelvis, 0, 0.46, -0.25); set(p, J.chest, 0, 0.62, 0.12); set(p, J.neck, 0, 0.7, 0.3); set(p, J.head, 0, 0.78, 0.46);
  set(p, J.shL, -0.2, 0.64, 0.14); set(p, J.shR, 0.2, 0.64, 0.14);
  set(p, J.elL, -0.28, 0.34, 0.3); set(p, J.elR, 0.28, 0.34, 0.3); set(p, J.haL, -0.24, 0.05, 0.5); set(p, J.haR, 0.24, 0.05, 0.5);
  set(p, J.hipL, -0.1, 0.46, -0.25); set(p, J.hipR, 0.1, 0.46, -0.25);
  set(p, J.knL, -0.13, 0.18, -0.42); set(p, J.knR, 0.13, 0.18, -0.42);
  set(p, J.ftL, -0.13, 0.05, -0.85); set(p, J.ftR, 0.13, 0.05, -0.85);
  return p;
}
const mix = (a, b, t) => a.map((j, i) => [lerp(j[0], b[i][0], t), lerp(j[1], b[i][1], t), lerp(j[2], b[i][2], t)]);
const lift = (p, dy, dz = 0) => p.map((j) => [j[0], j[1] + dy, j[2] + dz]);
function standPose(slump = 0, t = 0) {
  const p = poseRun(0.0, 0.05 + slump * 0.12, 0.05);
  // hands on the hips
  const s = slump;
  for (const [i, sx] of [[0, -1], [1, 1]]) {
    const ex = sx * (0.22 + 0.2 * s), ey = p[J.shL][1] - 0.28, ez = -0.05;
    p[J.elL + i] = [ex, lerp(p[J.elL + i][1], ey, s), lerp(p[J.elL + i][2], ez, s)];
    p[J.haL + i] = [lerp(p[J.haL + i][0], sx * 0.16, s), lerp(p[J.haL + i][1], p[J.pelvis][1] + 0.06, s), lerp(p[J.haL + i][2], 0.02, s)];
  }
  p[J.head][1] -= 0.06 * s; p[J.head][2] += 0.1 * s;
  const br = Math.sin(t * 3) * 0.01;
  for (const j of [J.chest, J.shL, J.shR, J.head, J.neck]) p[j][1] += br;
  return p;
}
function poseCheer(t, side) {
  const p = standPose(0, t);
  const sw = Math.sin(t * 7 + side) * 0.5 + 0.5;
  for (const [i, sx] of [[0, -1], [1, 1]]) {
    const up = i === 0 ? sw : 1 - sw;
    const sh = p[J.shL + i];
    p[J.elL + i] = [sx * (0.34 + 0.05 * up), sh[1] + 0.2 + 0.1 * up, 0.02];
    p[J.haL + i] = [sx * (0.38 + 0.06 * up), sh[1] + 0.52 + 0.28 * up, 0.04];
  }
  return p;
}
const diveBody = (u, grab) => {
  const air = Math.sin(Math.PI * Math.min(1, u * 1.15));
  const p = poseProne(0, 0.12 * (1 - u), 1);
  // arms stretch right out in front
  p[J.haL] = [-0.1, 0.2, 1.42]; p[J.haR] = [0.1, 0.2, 1.42]; p[J.elL] = [-0.13, 0.2, 1.1]; p[J.elR] = [0.13, 0.2, 1.1];
  void grab;
  return lift(p, 0.05 + 0.72 * air);
};

// The pose for one runner, with its facing.
export function figureFor(q, t) {
  const sp = q.sp || 0, ph = q.phase;
  const holding = q.flag >= 0;
  if (ph === 'prone') return { pose: lift(poseProne(Math.sin(t * 2.6 + q.id), 0), 0), yaw: Math.PI };
  if (ph === 'flinch') { const k = Math.sin(Math.min(1, q.pt / 0.35) * Math.PI); return { pose: poseProne(0, 0.55 * k), yaw: Math.PI }; }
  if (ph === 'spin') {
    const u = Math.min(1, q.pt / RISE_T), e = ease(u);
    const run = poseRun(0.6, 0.45, 0.3);
    const kneel = poseKneel();
    const pr = q.stand ? poseProne(0, 0, 1) : poseProne(0, 0.2, 0);
    const pose = u < 0.45 ? mix(pr, kneel, ease(u / 0.45)) : mix(kneel, run, ease((u - 0.45) / 0.55));
    return { pose, yaw: q.stand ? 0 : Math.PI * (1 - e), dz: 0 };
  }
  if (ph === 'run') {
    const eff = clamp(q.v / 8.5, 0.15, 1);
    return { pose: poseRun(sp, 0.12 + 0.34 * eff, eff, holding ? 1 : 0), yaw: 0 };
  }
  if (ph === 'dive') return { pose: diveBody(clamp(q.pt / DIVE_T, 0, 1), holding), yaw: 0 };
  if (ph === 'slide') { const u = clamp(q.pt / SLIDE_T, 0, 1); return { pose: lift(poseProne(Math.sin(t * 3), 0.0, 1), lerp(0.0, 0.0, u)), yaw: 0 }; }
  if (ph === 'down') return { pose: poseProne(Math.sin(t * 3 + q.id), 0.1, 1), yaw: 0 };
  if (ph === 'hold') {
    if (q.v > 1.5) { const eff = clamp(q.v / 8.5, 0.15, 1); return { pose: poseRun(sp, 0.1 + 0.2 * eff, eff, 1), yaw: 0 }; }
    const p = standPose(0, t);
    const sy = p[J.shR][1], sz = p[J.shR][2];
    p[J.elR] = [0.3, sy + 0.28, sz + 0.1]; p[J.haR] = [0.3, sy + 0.62 + 0.04 * Math.sin(t * 6), sz + 0.12];
    return { pose: p, yaw: 0 };
  }
  if (ph === 'beaten') {
    if (q.v > 1.5) { const eff = clamp(q.v / 8.5, 0.1, 0.7); return { pose: poseRun(sp, 0.1, eff, 0), yaw: 0 }; }
    return { pose: standPose(1, t), yaw: 0 };
  }
  return { pose: standPose(0, t), yaw: 0 };
}

// ---- painting a figure ------------------------------------------------------------------------------------------------------
const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16), r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255), g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255), b = clamp(Math.round((n & 255) * f), 0, 255);
  return `rgb(${r},${g},${b})`;
};
// The soft shadow on the sand under a person (2D: the 3D people are lit but cast no shadow map). air: 0..1 how high the body is.
export function drawShadow(ctx, P, x, z, air = 0, long = false, lieLen = 0) {
  const a = P(x, 0, z), ln = long ? 1 : 0, ar = Math.min(1, air);
  const rx = (0.42 + ln * 0.15 + lieLen) * a.k, ry = (0.2 + ln * 0.5) * a.k * (a.kz || 0.8);
  ctx.fillStyle = `rgba(60,40,10,${(ln ? 0.2 : 0.3) - 0.12 * Math.max(0, ar)})`;
  ctx.beginPath(); ctx.ellipse(a.x, a.y + 1, rx, Math.max(2, ry), 0, 0, TAU); ctx.fill();
}

// P(x, y, z) -> { x, y, k } maps world metres to the screen. fig: { x, z, yaw, pose, look, number, you, baton, alpha }
export function drawFigure(ctx, P, fig) {
  const look = fig.look, c = Math.cos(fig.yaw), s = Math.sin(fig.yaw);
  // seen from a high camera a striding leg's depth swing reads as stilts: compress the depth of upright poses a little
  const zs = fig.long ? 1 : 0.6;
  const pts = fig.pose.map((j) => {
    const jz = j[2] * zs;
    const wx = fig.x + j[0] * c + jz * s, wz = fig.z - j[0] * s + jz * c, wy = (fig.y || 0) + j[1];
    return { w: [wx, wy, wz], p: P(wx, wy, wz) };
  });
  const k0 = pts[J.pelvis].p.k;
  if (fig.alpha != null && fig.alpha < 1) { ctx.save(); ctx.globalAlpha = fig.alpha; }
  drawShadow(ctx, P, fig.x, fig.z, (pts[J.pelvis].w[1] - 0.3) / 1.2, !!fig.long, fig.lieLen || 0);
  const ops = [];
  const skin = look.skin, top = look.top, bot = look.bot;
  const W = (a) => pts[a].w;
  // legs: thigh (with shorts over the upper part), shin with a calf, bare foot
  for (const [h, kn, ft] of [[J.hipL, J.knL, J.ftL], [J.hipR, J.knR, J.ftR]]) {
    ops.push({ d: (W(h)[2] + W(kn)[2]) / 2, t: 'thigh', a: h, b: kn });
    ops.push({ d: (W(kn)[2] + W(ft)[2]) / 2, t: 'shin', a: kn, b: ft });
    ops.push({ d: W(ft)[2] - 0.02, t: 'foot', a: kn, b: ft });
  }
  ops.push({ d: (W(J.chest)[2] + W(J.pelvis)[2]) / 2 + 0.02, t: 'torso' });
  for (const [sh, el, ha] of [[J.shL, J.elL, J.haL], [J.shR, J.elR, J.haR]]) {
    ops.push({ d: (W(sh)[2] + W(el)[2]) / 2, t: 'uarm', a: sh, b: el });
    ops.push({ d: (W(el)[2] + W(ha)[2]) / 2, t: 'farm', a: el, b: ha });
    ops.push({ d: W(ha)[2] - 0.01, t: 'hand', a: el, b: ha });
  }
  ops.push({ d: W(J.head)[2] - 0.03, t: 'head' });
  if (fig.baton) ops.push({ d: W(J.haR)[2] - 0.02, t: 'baton' });
  ops.sort((m, n) => n.d - m.d);
  // a tapered limb with a muscle belly: radii in metres at both ends, `bulge` adds width a third of the way along
  const limb = (A, B, r0, r1, col, bulge = 0, rim = true, caps = true) => {
    const w0 = Math.max(1.2, r0 * 2 * A.k), w1 = Math.max(1.2, r1 * 2 * B.k);
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    const wm = (w0 * 0.62 + w1 * 0.38) * (1 + bulge), mx = lerp(A.x, B.x, 0.36), my = lerp(A.y, B.y, 0.36);
    const shape = (g, round) => {
      const a = (w0 + g) / 2, m = (wm + g) / 2, b = (w1 + g) / 2;
      ctx.beginPath();
      ctx.moveTo(A.x + nx * a, A.y + ny * a); ctx.lineTo(mx + nx * m, my + ny * m); ctx.lineTo(B.x + nx * b, B.y + ny * b);
      ctx.lineTo(B.x - nx * b, B.y - ny * b); ctx.lineTo(mx - nx * m, my - ny * m); ctx.lineTo(A.x - nx * a, A.y - ny * a); ctx.closePath();
      if (round) { ctx.moveTo(A.x + a, A.y); ctx.arc(A.x, A.y, a, 0, TAU); ctx.moveTo(B.x + b, B.y); ctx.arc(B.x, B.y, b, 0, TAU); }
    };
    if (rim) { ctx.fillStyle = shade(col, 0.58); shape(Math.max(1, 0.012 * A.k) * 2, false); ctx.fill('nonzero'); }
    ctx.fillStyle = col; shape(0, caps); ctx.fill('nonzero');
    // a soft light along one side
    ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = Math.max(1, Math.min(w0, w1) * 0.24); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(A.x - nx * w0 * 0.2, A.y - ny * w0 * 0.2); ctx.lineTo(B.x - nx * w1 * 0.2, B.y - ny * w1 * 0.2); ctx.stroke();
  };
  const dirOf = (a, b) => { const A = pts[a].p, B = pts[b].p, l = Math.hypot(B.x - A.x, B.y - A.y) || 1; return { x: (B.x - A.x) / l, y: (B.y - A.y) / l }; };
  for (const o of ops) {
    if (o.t === 'thigh') {
      const A = pts[o.a].p, B = pts[o.b].p;
      limb(A, B, 0.088, 0.058, skin, 0.06);
      // shorts cover the upper two thirds of the thigh and a little past the hip
      const m = { x: lerp(A.x, B.x, 0.62), y: lerp(A.y, B.y, 0.62), k: lerp(A.k, B.k, 0.62) };
      limb({ x: A.x, y: A.y, k: A.k }, m, 0.105, 0.082, bot, 0, false, false);
    } else if (o.t === 'shin') {
      limb(pts[o.a].p, pts[o.b].p, 0.058, 0.036, skin, 0.22);
    } else if (o.t === 'foot') {
      // a bare foot: heel at the ankle, toes ahead (continues the shin when the body lies down)
      const F = pts[o.b].p, a = W(o.b), kw = W(o.a);
      let sx = a[0] - kw[0], sy = a[1] - kw[1], sz = a[2] - kw[2];
      const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
      let dx, dy, dz;
      if (Math.abs(sy) > 0.5) { dx = s * 1; dy = -0.12; dz = c * 1; }          // standing/running: the toes point where the body faces
      else { dx = sx; dy = -0.15; dz = sz; }                                  // lying: the foot carries on from the shin
      const dl = Math.hypot(dx, dy, dz) || 1;
      const T = P(a[0] + dx / dl * 0.19, a[1] + dy / dl * 0.19, a[2] + dz / dl * 0.19);
      const Hh = P(a[0] - dx / dl * 0.035, a[1] + 0.0, a[2] - dz / dl * 0.035);
      limb(Hh, T, 0.04, 0.028, shade(skin, 0.9), 0, false, true);
    } else if (o.t === 'torso') {
      const sl = pts[J.shL].p, sr = pts[J.shR].p, hl = pts[J.hipL].p, hr = pts[J.hipR].p, ch = pts[J.chest].p, pe = pts[J.pelvis].p, nk = pts[J.neck].p;
      const kk = ch.k;
      const ex = (sr.x - sl.x) * 0.1, ey = (sr.y - sl.y) * 0.1;                 // shoulders reach a little past the joints
      const wl = { x: lerp(sl.x, hl.x, 0.62), y: lerp(sl.y, hl.y, 0.62) }, wr = { x: lerp(sr.x, hr.x, 0.62), y: lerp(sr.y, hr.y, 0.62) };
      const cxm = (wl.x + wr.x) / 2, cym = (wl.y + wr.y) / 2;
      const waistIn = 0.12;                                                     // the waist is narrower than the chest
      wl.x = lerp(wl.x, cxm, waistIn); wl.y = lerp(wl.y, cym, waistIn); wr.x = lerp(wr.x, cxm, waistIn); wr.y = lerp(wr.y, cym, waistIn);
      const topY = Math.min(sl.y, sr.y) - 0.045 * kk;
      ctx.beginPath();
      ctx.moveTo(sl.x - ex, sl.y - ey + 0.01 * kk);
      ctx.quadraticCurveTo(nk.x - (nk.x - sl.x) * 0.5, topY - 0.01 * kk, nk.x, topY + 0.01 * kk);
      ctx.quadraticCurveTo(nk.x + (sr.x - nk.x) * 0.5, topY - 0.01 * kk, sr.x + ex, sr.y + ey + 0.01 * kk);
      ctx.quadraticCurveTo(lerp(sr.x, wr.x, 0.5) + 0.03 * kk, lerp(sr.y, wr.y, 0.5), wr.x, wr.y);
      ctx.quadraticCurveTo(lerp(wr.x, hr.x, 0.5) + 0.04 * kk, lerp(wr.y, hr.y, 0.5), hr.x + 0.07 * kk, hr.y + 0.02 * kk);
      ctx.lineTo(hl.x - 0.07 * kk, hl.y + 0.02 * kk);
      ctx.quadraticCurveTo(lerp(wl.x, hl.x, 0.5) - 0.04 * kk, lerp(wl.y, hl.y, 0.5), wl.x, wl.y);
      ctx.quadraticCurveTo(lerp(sl.x, wl.x, 0.5) - 0.03 * kk, lerp(sl.y, wl.y, 0.5), sl.x - ex, sl.y - ey + 0.01 * kk);
      ctx.closePath();
      const gr = ctx.createLinearGradient(Math.min(sl.x, hl.x) - 2, 0, Math.max(sr.x, hr.x) + 2, 0);
      gr.addColorStop(0, shade(top, 0.82)); gr.addColorStop(0.45, shade(top, 1.12)); gr.addColorStop(1, shade(top, 0.76));
      ctx.fillStyle = gr; ctx.fill(); ctx.lineWidth = Math.max(1, 0.014 * kk); ctx.strokeStyle = shade(top, 0.5); ctx.stroke();
      // the waistband / shorts top
      ctx.fillStyle = bot; ctx.beginPath(); ctx.moveTo(lerp(wl.x, hl.x, 0.45), lerp(wl.y, hl.y, 0.45)); ctx.lineTo(lerp(wr.x, hr.x, 0.45), lerp(wr.y, hr.y, 0.45));
      ctx.lineTo(hr.x + 0.07 * kk, hr.y + 0.02 * kk); ctx.lineTo(hl.x - 0.07 * kk, hl.y + 0.02 * kk); ctx.closePath(); ctx.fill();
      if (fig.number != null && kk > 24) {
        ctx.fillStyle = shade(top, 0.42); ctx.font = `800 ${Math.round(0.19 * kk)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(fig.number), (ch.x + wl.x / 2 + wr.x / 2) / 2, (ch.y + (wl.y + wr.y) / 2) / 2 + 0.02 * kk);
      }
      void pe;
    } else if (o.t === 'uarm') {
      limb(pts[o.a].p, pts[o.b].p, 0.05, 0.04, skin, 0.08);
    } else if (o.t === 'farm') {
      limb(pts[o.a].p, pts[o.b].p, 0.04, 0.028, skin, 0.14);
    } else if (o.t === 'hand') {
      const E = pts[o.a].p, H = pts[o.b].p, d = dirOf(o.a, o.b), l = 0.1 * H.k;
      limb({ x: H.x, y: H.y, k: H.k }, { x: H.x + d.x * l, y: H.y + d.y * l, k: H.k }, 0.034, 0.024, shade(skin, 0.96), 0, false, true);
      void E;
    } else if (o.t === 'head') {
      const H = pts[J.head].p, N = pts[J.neck].p, ry = Math.max(2.5, 0.118 * H.k), rx = ry * 0.82;
      limb(N, H, 0.052, 0.05, shade(skin, 0.85), 0, false);                       // neck
      ctx.fillStyle = shade(skin, 0.7); ctx.beginPath(); ctx.ellipse(H.x, H.y + ry * 0.06, rx * 1.05, ry * 1.04, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(H.x, H.y, rx, ry, 0, 0, TAU); ctx.fill();
      // ears
      ctx.fillStyle = shade(skin, 0.88);
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(H.x + sx * rx * 0.98, H.y + ry * 0.05, rx * 0.16, ry * 0.2, 0, 0, TAU); ctx.fill(); }
      // swim cap covering the back and top of the head
      const cg = ctx.createRadialGradient(H.x - rx * 0.3, H.y - ry * 0.4, ry * 0.1, H.x, H.y, ry * 1.05);
      cg.addColorStop(0, shade(look.cap, 1.35)); cg.addColorStop(1, shade(look.cap, 0.8));
      ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(H.x, H.y - ry * 0.04, rx * 1.0, ry * 0.99, 0, Math.PI * 0.98, TAU + Math.PI * 0.02); ctx.lineTo(H.x + rx * 0.97, H.y + ry * 0.3); ctx.quadraticCurveTo(H.x, H.y + ry * 0.5, H.x - rx * 0.97, H.y + ry * 0.3); ctx.closePath(); ctx.fill();
      if (fig.you) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, ry * 0.18); ctx.beginPath(); ctx.ellipse(H.x, H.y - ry * 0.04, rx * 0.7, ry * 0.7, 0, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    } else if (o.t === 'baton') {
      const h = pts[J.haR].p, hw = pts[J.haR].w;
      const top2 = P(hw[0], hw[1] + 0.55, hw[2]);
      const wd = Math.max(2, 0.07 * h.k);
      ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = wd + 2; ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(top2.x, top2.y); ctx.stroke();
      ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(top2.x, top2.y); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = wd * 0.5; ctx.beginPath(); ctx.moveTo(lerp(h.x, top2.x, 0.45), lerp(h.y, top2.y, 0.45)); ctx.lineTo(lerp(h.x, top2.x, 0.7), lerp(h.y, top2.y, 0.7)); ctx.stroke();
    }
  }
  void k0;
  if (fig.alpha != null && fig.alpha < 1) ctx.restore();
}

// ---- a baton in the sand -----------------------------------------------------------------------------------------------------
export function drawBaton(ctx, P, f, t, o = {}) {
  const a = P(f.x, 0, f.z), col = o.col || FLAG_COLS[(f.id || 0) % FLAG_COLS.length];
  // the pole is drawn tall enough to read from the start line: at least ~46 virtual px, never less than 1.5x the real baton
  const hv = Math.max(FLAG_H * 1.5, 64 / Math.max(1, a.k)), b = P(f.x, hv, f.z), wd = Math.max(2.4, 0.07 * a.k);
  if (o.ring) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 6), rr = Math.max(0.5, 7 / Math.max(1, a.k));
    ctx.strokeStyle = o.ringCol || `rgba(255,214,70,${0.6 + 0.4 * pulse})`; ctx.lineWidth = Math.max(2, 0.08 * a.k + 1);
    ctx.beginPath(); ctx.ellipse(a.x, a.y, (rr + 0.12 * pulse) * a.k, (rr + 0.12 * pulse) * a.k * (a.kz || 0.8), 0, 0, TAU); ctx.stroke();
  }
  // a little mound of sand round the foot and a soft shadow
  ctx.fillStyle = 'rgba(60,40,10,0.3)'; ctx.beginPath(); ctx.ellipse(a.x + 0.08 * a.k, a.y + 1, Math.max(3, 0.24 * a.k), Math.max(1.5, 0.08 * a.k), 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d9bf88'; ctx.beginPath(); ctx.ellipse(a.x, a.y, Math.max(2.5, 0.16 * a.k), Math.max(1.2, 0.05 * a.k), 0, 0, TAU); ctx.fill();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = wd + 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  // a pennant on the top that flutters in the sea breeze
  const ph = b.y - a.y, fh = Math.abs(ph) * 0.3, fw = Math.abs(ph) * 0.5, fl = Math.sin(t * 5 + (f.id || 0) * 1.3) * fh * 0.18;
  ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x + fw * 0.5, b.y + fl - fh * 0.1, b.x + fw, b.y + fh * 0.5 + fl); ctx.quadraticCurveTo(b.x + fw * 0.5, b.y + fh * 0.6 + fl * 0.5, b.x, b.y + fh); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff6e0'; ctx.beginPath(); ctx.arc(b.x, b.y, wd * 0.62, 0, TAU); ctx.fill();
}

// ---- props -------------------------------------------------------------------------------------------------------------------
function drawUmbrella(ctx, P, x, z, col) {
  const a = P(x, 0, z), top = P(x, 2.1, z), r = 1.15 * a.k;
  ctx.fillStyle = 'rgba(60,40,10,0.25)'; ctx.beginPath(); ctx.ellipse(a.x + 0.5 * a.k, a.y + 2, 1.0 * a.k, 0.3 * a.k, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#5a3a1c'; ctx.lineWidth = Math.max(1.5, 0.05 * a.k); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(top.x, top.y); ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(top.x - r, top.y + 0.25 * r); ctx.quadraticCurveTo(top.x, top.y - 0.8 * r, top.x + r, top.y + 0.25 * r); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.moveTo(top.x - r * 0.33, top.y + 0.1 * r); ctx.quadraticCurveTo(top.x, top.y - 0.78 * r, top.x + r * 0.33, top.y + 0.1 * r); ctx.lineTo(top.x + r * 0.05, top.y + 0.2 * r); ctx.lineTo(top.x - r * 0.05, top.y + 0.2 * r); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.moveTo(top.x, top.y - 0.55 * r); ctx.quadraticCurveTo(top.x + r * 0.7, top.y - 0.2 * r, top.x + r, top.y + 0.25 * r); ctx.lineTo(top.x, top.y + 0.25 * r); ctx.closePath(); ctx.fill();
}
function drawTower(ctx, P, x, z) {
  const a = P(x, 0, z), t1 = P(x, 2.6, z), k = a.k;
  ctx.fillStyle = 'rgba(60,40,10,0.25)'; ctx.beginPath(); ctx.ellipse(a.x, a.y + 2, 1.2 * k, 0.35 * k, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = Math.max(2, 0.12 * k);
  for (const dx of [-0.8, 0.8]) { ctx.beginPath(); ctx.moveTo(a.x + dx * k, a.y); ctx.lineTo(a.x + dx * 0.7 * k, t1.y); ctx.stroke(); }
  ctx.fillStyle = '#f4f1e6'; ctx.fillRect(a.x - 1.0 * k, t1.y - 1.1 * k, 2.0 * k, 1.1 * k);
  ctx.fillStyle = '#e8503a'; ctx.fillRect(a.x - 1.15 * k, t1.y - 1.3 * k, 2.3 * k, 0.28 * k);
  ctx.fillStyle = '#2f8fd6'; ctx.fillRect(a.x - 0.7 * k, t1.y - 0.85 * k, 1.4 * k, 0.45 * k);
}

// ---- the whole scene -----------------------------------------------------------------------------------------------------------
const CROWD_LOOKS = [LOOKS[1], LOOKS[3], LOOKS[5], LOOKS[2], LOOKS[6], LOOKS[7], LOOKS[4]];
export function planeP(cam) {
  const P = (x, y, z) => {
    const zr = Math.max(0.45, z - cam.camZ), k = cam.F / zr;
    return { x: cam.cx + (x - cam.camX) * k, y: cam.yh + (cam.camH - y) * k, k, kz: cam.camH / zr };
  };
  return P;
}
// o: { t, fx, hint: { flag, act } | null, names: bool, you: runner id or -1, camera focus handled by caller }
export function drawRound(ctx, cam, round, o = {}) {
  const t = o.t || 0, P = planeP(cam);
  drawBeach(ctx, cam, t);
  if (!o.icon) drawLanes(ctx, cam, round);
  ctx.save(); ctx.beginPath(); ctx.rect(cam.rect.x, cam.rect.y, cam.rect.w, cam.rect.h); ctx.clip();
  const items = [];
  const half = round.span / 2 + 3.4;
  if (!o.icon) items.push({ z: 13, f: () => drawTower(ctx, P, -half - 5.5, 13) });
  if (!o.icon) [[-half - 1.3, 4.2, '#e8503a'], [half + 1.2, 9.5, '#2f8fd6'], [-half - 2.6, 17, '#ffc83d'], [half + 2.4, 21, '#2fb67a']].forEach(([x, z, c]) => items.push({ z, f: () => drawUmbrella(ctx, P, x, z, c) }));
  // people: real 3D athletes when the view3d layer is ready (src/../view3d/racers.js installs globalThis.__racers3d), else the 2D figures below
  const f3 = o.fig === '2d' ? null : globalThis.__racers3d;
  let use3d = !!(f3 && f3.draw && !f3.lost);
  const crowd3 = [], runners3 = [], fallback = [];
  // the starter: an official in lifesaver red and yellow beside the start line, whistle at the mouth
  if (!o.icon) {
    const ox = -(round.span / 2 + LANE_W / 2 + 1.4), oz = 0.4;
    const lk = { top: '#e8503a', bot: '#f2c230', skin: '#d99a6c', hair: '#32200f' };
    if (use3d && f3.specs.length) {
      crowd3.push({ x: ox, z: oz, face: Math.PI / 2 - 0.12, mood: 0, phase: 0.3, top: lk.top, bottoms: lk.bot, skin: lk.skin, hair: lk.hair, key: 'official' });
      items.push({ z: oz, f: () => drawShadow(ctx, P, ox, oz, 0, false, 0) });
    } else items.push({ z: oz, f: () => drawFigure(ctx, P, { x: ox, z: oz, yaw: -Math.PI / 2, pose: standPose(0, t), look: { ...LOOKS[1], top: lk.top, bot: lk.bot }, number: null, alpha: 1 }) });
    const blow = !round.go ? round.count < 0.5 : round.tgo < 0.45;
    items.push({ z: 0, f: () => {
      const m = P(ox + 0.12, 1.5, oz - 0.05);
      const s = Math.max(5, 0.1 * m.k);
      // the whistle: a small silver barrel with a mouthpiece, and the sound as three arcs when it blows
      ctx.fillStyle = '#d7dde4'; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(m.x + s * 0.6, m.y, s * 0.55, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c3cad2'; ctx.fillRect(m.x - s * 0.3, m.y - s * 0.22, s * 0.9, s * 0.44);
      if (blow) {
        const k = round.go ? round.tgo / 0.45 : 1 - round.count / 0.5;
        ctx.strokeStyle = `rgba(255,255,255,${0.9 - 0.4 * Math.min(1, k)})`; ctx.lineWidth = Math.max(2, s * 0.22); ctx.lineCap = 'round';
        for (let j = 1; j <= 3; j++) { const rr = s * (1.2 + j * 0.9 + k * 1.2); ctx.beginPath(); ctx.arc(m.x + s * 0.6, m.y, rr, -0.7, 0.7); ctx.stroke(); }
      }
    } });
  }
  // spectators along both sides
  for (let i = 0; i < (o.icon ? 0 : 12); i++) {
    const side = i % 2 ? 1 : -1, z = 1 + (i >> 1) * 3.4 + hash(i) * 1.2, x = side * (half - 0.4 + hash(i + 40) * 0.8);
    const look = CROWD_LOOKS[i % CROWD_LOOKS.length], pose = poseCheer(t + i * 1.7, i), bot = LOOKS[(i + 3) % 8].bot;
    const fig = { x, z, yaw: -side * Math.PI / 2, pose, look: { ...look, top: look.top, bot }, number: null, alpha: 1 };
    if (use3d && crowd3.length >= f3.specs.length) continue;
    if (use3d) {
      crowd3.push({ x, z, face: -side * Math.PI / 2 + side * 0.25, mood: [1, 2, 0, 3][i % 4], phase: i * 1.7, top: look.top, bottoms: bot, skin: look.skin, hair: look.hair, key: `${look.top}|${bot}|${look.skin}|${look.hair}` });
      items.push({ z, f: () => drawShadow(ctx, P, x, z, 0, false, 0) });
    } else items.push({ z, f: () => drawFigure(ctx, P, fig) });
  }
  const hintFlag = o.hint && o.hint.flag != null && o.hint.flag >= 0 ? o.hint.flag : -1;
  for (const f of round.flags) {
    if (f.owner >= 0 && round.runners[f.owner].flag === f.id && round.runners[f.owner].phase !== 'hold' && round.runners[f.owner].phase !== 'slide' && round.runners[f.owner].phase !== 'dive') continue;
    if (f.owner >= 0) continue; // held batons are drawn in the winner's hand
    items.push({ z: f.z, f: () => drawBaton(ctx, P, f, t, { ring: !o.icon, ringCol: f.id === hintFlag ? `rgba(255,255,255,${0.7 + 0.3 * Math.sin(t * 9)})` : 'rgba(255,200,60,0.55)' }) });
  }
  const freeFlags = round.flags.filter((f) => f.owner < 0);
  for (const q of round.runners) {
    if (o.icon && !q.you) continue;
    const fg = figureFor(q, t);
    const fig = { x: q.x, z: q.z, yaw: fg.yaw, pose: fg.pose, look: LOOKS[q.look % LOOKS.length], number: q.id + 1, you: q.you, baton: q.flag >= 0 && q.phase !== 'prone', long: q.phase === 'prone' || q.phase === 'flinch' || q.phase === 'dive' || q.phase === 'slide' || q.phase === 'down' };
    if (q.look === 0 && o.youLook) fig.look = o.youLook;
    if (use3d && runners3.length < f3.people.length) {
      let nearest = null;
      if (q.flag >= 0) nearest = round.flags[q.flag];
      else if (q.phase === 'dive') { let best = 1e9; for (const f of freeFlags) { const dz = f.z - q.z, c = Math.abs(f.x - q.x) + 0.4 * Math.abs(dz); if (dz > -0.6 && c < best) { best = c; nearest = f; } } }
      const lk = fig.look;
      runners3.push({ id: q.id, q, yawOff: o.yawOff || 0, x: q.x, z: q.z, nearest: nearest ? { x: nearest.x, z: nearest.z } : null, look: { cap: lk.cap, top: lk.top, bot: lk.bot, skin: lk.skin, hair: lk.hair, key: `${lk.cap}|${lk.top}|${lk.bot}|${lk.skin}|${lk.hair}` }, fig });
      const lying = fig.long, air = q.phase === 'dive' ? 1 : 0;
      items.push({ z: q.z, f: () => drawShadow(ctx, P, q.x, q.z, air, lying, q.phase === 'dive' || q.phase === 'slide' ? 0.45 : 0) });
    } else items.push({ z: q.z, f: () => drawFigure(ctx, P, fig) });
  }
  items.sort((a, b) => b.z - a.z);
  for (const it of items) it.f();
  if (use3d) {
    const drawn = f3.draw(ctx, cam, cam.rect, runners3, crowd3, t);
    if (!drawn) for (const r of runners3) drawFigure(ctx, P, r.fig);           // the 3D layer lost its context mid-frame: paint the 2D figures
    else {
      // race bibs on the backs of upright runners (a flat number on the shirt, seen from behind)
      for (const r of runners3) {
        const q = r.q, ph = q.phase, up = ph === 'run' || ph === 'beaten' || (ph === 'hold' && (q.pt > 0.6 || !q.diveGrab));
        if (!up) continue;
        const c = P(q.x, 1.22, q.z);
        if (c.k < 22) continue;
        const fz = Math.round(0.19 * c.k);
        ctx.font = `800 ${fz}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(1.5, fz * 0.16); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.strokeText(String(q.id + 1), c.x, c.y);
        ctx.fillStyle = '#10243c'; ctx.fillText(String(q.id + 1), c.x, c.y);
      }
    }
  }
  // particles
  if (o.fx) for (const p of o.fx) {
    const a = P(p.x, p.y, p.z), k = p.t / p.max, r = Math.max(1.2, p.size * a.k * (p.kind === 2 ? 1 : 1 + k));
    ctx.globalAlpha = Math.max(0, 1 - k) * (p.kind === 2 ? 1 : 0.75); ctx.fillStyle = p.col;
    if (p.kind === 2) { ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(p.rot + p.t * p.spin); ctx.fillRect(-r, -r * 0.5, r * 2, r); ctx.restore(); } else { ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  // a marker over the player's head
  const me = round.runners[o.you != null ? o.you : round.you];
  if (me && o.marker !== false) {
    const hp = P(me.x, (me.phase === 'prone' || me.phase === 'flinch' || me.phase === 'down' || me.phase === 'slide') ? 0.4 : me.phase === 'dive' ? 1.4 : 2.05, me.z);
    const bob = Math.sin(t * 6) * 3, s = Math.max(9, 0.34 * hp.k);
    ctx.fillStyle = '#ffd35a'; ctx.strokeStyle = 'rgba(40,24,0,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hp.x, hp.y - s * 0.6 + bob - s * 0.5); ctx.lineTo(hp.x - s * 0.7, hp.y - s * 1.9 + bob - s * 0.5); ctx.lineTo(hp.x + s * 0.7, hp.y - s * 1.9 + bob - s * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

// ---- particles ------------------------------------------------------------------------------------------------------------------
export function stepFx(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]; p.t += dt;
    if (p.t >= p.max) { list.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 7 * dt;
    if (p.y < 0.02) { p.y = 0.02; p.vy *= -0.2; p.vx *= 0.8; p.vz *= 0.8; }
  }
}

// ---- small figures for menus and the rules illustrations ------------------------------------------------------------------
export const poses = { run: poseRun, prone: poseProne, stand: standPose, dive: diveBody, cheer: poseCheer };
// A runner seen from behind and slightly above, feet at (cx, yb), s pixels per metre. o.st = { phase, pt?, v? } draws a real 3D athlete when
// the view3d layer is ready (o.t = the scene clock); otherwise the 2D figure from o.pose / ph / lean / eff.
let miniSlot = 0, miniT = -1;
export function drawMini(ctx, cx, yb, s, look, o = {}) {
  const f3 = o.st ? globalThis.__racers3d : null;
  if (f3 && f3.draw && !f3.lost) {
    const t = o.t || 0;
    if (t !== miniT) { miniT = t; miniSlot = 0; }
    const slot = Math.min(f3.people.length - 1, miniSlot++);
    const D = 10, camH = 3, F = s * D;
    const rc = { x: cx - 1.8 * s, y: yb - 2.5 * s, w: 3.6 * s, h: 3.1 * s };
    const cam = { rect: rc, cx, yh: yb - camH * s, F, camH, camX: -(o.x || 0), camZ: -D };
    const q = { id: slot, phase: o.st.phase, pt: o.st.pt || 0, v: o.st.v == null ? 5 : o.st.v, lat: 0, flag: o.st.flag == null ? -1 : o.st.flag, stand: false, diveGrab: false };
    const lk = { cap: look.cap, top: look.top, bot: look.bot, skin: look.skin, hair: look.hair, key: `${look.cap}|${look.top}|${look.bot}|${look.skin}|${look.hair}` };
    const nearest = o.st.target ? { x: o.st.target[0], z: o.st.target[1] } : null;
    const P = (x, y, z) => ({ x: cx + x * s, y: yb - y * s - z * s * 0.3, k: s, kz: 0.3 });
    drawShadow(ctx, P, 0, 0, 0, !!o.long, o.long ? 0.3 : 0);
    const drawn = f3.draw(ctx, cam, rc, [{ id: slot, slot, q, x: 0, z: 0, look: lk, nearest }], [], t);
    if (drawn) return;
  }
  const P = (x, y, z) => ({ x: cx + x * s, y: yb - y * s - z * s * 0.3, k: s, kz: 0.3 });
  const pose = o.pose || poseRun(o.ph == null ? 0.9 : o.ph, o.lean == null ? 0.3 : o.lean, o.eff == null ? 0.6 : o.eff, o.raise || 0);
  drawFigure(ctx, P, { x: o.x || 0, z: o.z || 0, yaw: o.yaw || 0, pose, look, number: o.number == null ? null : o.number, you: !!o.you, baton: !!o.baton, long: !!o.long, alpha: o.alpha });
}
export function drawMiniBaton(ctx, cx, yb, s, o = {}) {
  const P = (x, y, z) => ({ x: cx + x * s, y: yb - y * s - z * s * 0.3, k: s, kz: 0.3 });
  drawBaton(ctx, P, { x: o.x || 0, z: o.z || 0 }, o.t || 0, { ring: !!o.ring });
}

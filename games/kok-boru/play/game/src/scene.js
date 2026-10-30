// The broadcast picture: sky, ridge line, yurts, crowd, the pitch in perspective, the horses and riders sorted by depth, the ball, dust and
// the aiming overlays. It reads the simulation state and a small presentation state (camera, particles); it never changes the simulation.
import { HL, HW, GOAL_X, GOAL_R, GRAB_R, TUG_R, DROP_R, V_BASE, TEAMS } from './consts.js';
import { drawHorseRider, drawBall, shade } from './rig.js';
import { rangeFor, THROW_Y } from './phys.js';
import { clamp, hyp, hash01, lerp } from './util.js';
import { live } from './layout.js';

const TAU = Math.PI * 2;
export const K_FAR = 0.68;
// metres of pitch across the screen: a closer broadcast camera so riders, their reach and the ball read on a phone
const SPAN_PORT = 8.2, SPAN_LAND = 13;
const last3 = { t: null };          // clock of the previous 3D frame (kept out of the game state: presentation only)

let CUR = null;                     // the camera of the frame being drawn (kAt() has no camera argument)
// The picture is a shift-lens pinhole: a camera Dn metres beyond the near touchline, HE metres up, looking along -z, with the principal
// point moved so that the near touchline lands on yNear and the far one on yFar. Scale at depth z is k = Dn / (zCam - z) (1 at the near
// touchline, K_FAR at the far one). The 3D field (view3d/field3d.js) uses exactly this camera, so 2D marks and 3D objects agree.
export function makeCam(area, view) {
  const land = area.w > area.h * 1.05;
  const span = land ? SPAN_LAND : SPAN_PORT;
  const ppm = area.w / span;
  const horizon = area.y + area.h * (land ? 0.26 : 0.17);
  const yFar = area.y + area.h * (land ? 0.38 : 0.27);
  const yNear = area.y + area.h * (land ? 0.93 : 0.97);
  const Dn = 2 * HW * K_FAR / (1 - K_FAR), zCam = HW + Dn;
  const HE = (yNear - yFar) / (ppm * (1 - K_FAR)), pcy = yNear - HE * ppm;
  const c = { ax: area.x, ay: area.y, aw: area.w, ah: area.h, ppm, span, horizon, yFar, yNear, x: view.camX, land, Dn, zCam, HE, pcy };
  CUR = c;
  return c;
}
export const kAt = (z) => (CUR ? CUR.Dn / Math.max(1, CUR.zCam - z) : lerp(K_FAR, 1, (z + HW) / (2 * HW)));
export function proj(c, x, z, y = 0) {
  const k = c.Dn / Math.max(1, c.zCam - z);
  return { x: c.ax + c.aw / 2 + (x - c.x) * c.ppm * k, y: c.pcy + (c.HE - y) * c.ppm * k, k };
}
const inv = (c, sx) => c.x + (sx - c.ax - c.aw / 2) / c.ppm;       // x at the near depth for a screen x

export function updateView(v, sim, dt, area) {
  const s = sim, b = s.ball;
  const carrier = s.carrier >= 0 ? s.riders[s.carrier] : null;
  const ctl = s.ctl >= 0 && v.follow !== false ? s.riders[s.ctl] : null;
  const span = area.w > area.h * 1.05 ? SPAN_LAND : SPAN_PORT;
  let tx = b.x;
  if (b.owner < 0 && (b.y > 0.3 || Math.hypot(b.vx, b.vz) > 3)) tx = b.x + b.vx * 0.3;
  if (ctl) tx = tx * 0.5 + ctl.x * 0.5;
  const dir = carrier ? (carrier.team === 0 ? 1 : -1) : 0;
  tx += dir * span * 0.08;
  const lim = Math.max(0, HL + 1.5 - span / 2);
  tx = clamp(tx, -lim, lim);
  if (v.camInit !== true) { v.camX = tx; v.camInit = true; }
  const err = tx - v.camX;
  v.camX += err * (1 - Math.exp(-dt * (2.8 + Math.min(5, Math.abs(err) * 0.6))));
  if (ctl) v.camX = clamp(v.camX, ctl.x - span * 0.32, ctl.x + span * 0.32);
  v.camX = clamp(v.camX, -lim, lim);
  v.t += dt;
}

// ---- particles (picture only) ------------------------------------------------------------------------------------------------
export function stepParticles(v, dt) {
  const P = v.parts;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i]; p.life -= dt;
    if (p.life <= 0) { P.splice(i, 1); continue; }
    p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt; p.vy -= (p.g ?? 0.6) * dt; if (p.y < 0) { p.y = 0; p.vy *= -0.2; }
    p.vx *= 0.97;
  }
  if (P.length > 260) P.splice(0, P.length - 260);
}
export function emitDust(v, x, z, vx, n, seedBase) {
  for (let i = 0; i < n; i++) {
    const h = hash01(seedBase + i * 7.3 + v.t * 31);
    v.parts.push({ x: x + (h - 0.5) * 0.5, z: z + (hash01(seedBase + i) - 0.5) * 0.4, y: 0.1, vx: -vx * 0.15 + (h - 0.5) * 1.2, vy: 0.5 + h * 0.8, vz: (hash01(i + seedBase * 3) - 0.5) * 0.6, life: 0.5 + h * 0.45, max: 0.95, kind: 'dust', size: 0.25 + h * 0.2 });
  }
}
export function emitConfetti(v, team, x, z, n = 60) {
  const t = TEAMS[team];
  const cols = [t.c1, t.c2, t.trim, '#ffffff'];
  for (let i = 0; i < n; i++) {
    const h = hash01(v.t * 91 + i * 1.7);
    v.parts.push({ x, z, y: 1 + h * 2, vx: (h - 0.5) * 9, vy: 4 + hash01(i * 3.1 + v.t) * 6, vz: (hash01(i * 1.3) - 0.5) * 6, life: 1.4 + h, max: 2.4, kind: 'conf', col: cols[i % 4], g: 9, size: 0.1 });
  }
}

// ---- background ------------------------------------------------------------------------------------------------------------------------
function drawSky(ctx, c) {
  const g = ctx.createLinearGradient(0, 0, 0, c.horizon + 20);
  g.addColorStop(0, '#5f97d6'); g.addColorStop(0.55, '#a9cdee'); g.addColorStop(0.9, '#f5dfba'); g.addColorStop(1, '#f7e7c8');
  ctx.fillStyle = g; ctx.fillRect(0, 0, live.w, c.horizon + 20);
  // a few high clouds
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (let i = 0; i < 6; i++) {
    const x = ((i * 311 + 40 - c.x * c.ppm * 0.03) % (live.w + 300) + live.w + 300) % (live.w + 300) - 150, y = c.horizon * 0.35 + (i % 3) * 36;
    ctx.beginPath(); ctx.ellipse(x, y, 80 + (i % 2) * 40, 12, 0, 0, TAU); ctx.ellipse(x + 40, y - 6, 50, 10, 0, 0, TAU); ctx.fill();
  }
}
function ridge(ctx, c, par, base, amp, col, snow, seed) {
  const w = live.w;
  ctx.beginPath(); ctx.moveTo(0, c.horizon + 4);
  const pts = [];
  for (let sx = -20; sx <= w + 20; sx += 24) {
    const wx = (sx - w / 2) / c.ppm * 0.9 + c.x * par;
    const h = Math.sin(wx * 0.21 + seed) * 0.5 + Math.sin(wx * 0.53 + seed * 2.3) * 0.28 + Math.sin(wx * 1.3 + seed * 5) * 0.1 + 0.6;
    const y = base - h * amp;
    pts.push([sx, y]); ctx.lineTo(sx, y);
  }
  ctx.lineTo(w + 20, c.horizon + 4); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  if (snow) {
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    for (let i = 1; i < pts.length - 1; i++) {
      if (pts[i][1] < pts[i - 1][1] && pts[i][1] < pts[i + 1][1] && base - pts[i][1] > amp * 0.82) {
        const [x, y] = pts[i];
        ctx.beginPath(); ctx.moveTo(x - 16, y + 12); ctx.lineTo(x - 5, y + 6); ctx.lineTo(x, y); ctx.lineTo(x + 6, y + 8); ctx.lineTo(x + 17, y + 14); ctx.lineTo(x + 8, y + 10); ctx.lineTo(x, y + 14); ctx.lineTo(x - 7, y + 10); ctx.closePath(); ctx.fill();
      }
    }
  }
}
function drawYurt(ctx, x, y, s, hue) {
  ctx.fillStyle = '#efe7d2'; ctx.beginPath(); ctx.rect(x - s * 0.9, y - s * 0.6, s * 1.8, s * 0.6); ctx.fill();
  ctx.fillStyle = '#fbf6e8'; ctx.beginPath(); ctx.moveTo(x - s * 1.0, y - s * 0.58); ctx.quadraticCurveTo(x, y - s * 1.55, x + s * 1.0, y - s * 0.58); ctx.closePath(); ctx.fill();
  ctx.fillStyle = hue; ctx.fillRect(x - s * 0.9, y - s * 0.66, s * 1.8, s * 0.07);
  ctx.fillStyle = '#8a3b20'; ctx.fillRect(x - s * 0.17, y - s * 0.45, s * 0.34, s * 0.45);
}
function drawBackdrop(ctx, c, v, sim) {
  drawSky(ctx, c);
  ridge(ctx, c, 0.04, c.horizon + 4, 110, '#9bb0c9', true, 1.3);
  ridge(ctx, c, 0.09, c.horizon + 4, 70, '#6f89a8', false, 4.1);
  ridge(ctx, c, 0.16, c.horizon + 4, 38, '#56744f', false, 7.7);
  // yurts on the far slope
  const sc = c.ppm * 0.42;
  for (let i = -3; i < 8; i++) {
    const wx = i * 11.3 + 0.8 * Math.sin(i * 2.7), sx = c.ax + c.aw / 2 + (wx - c.x * 0.5) * c.ppm * 0.5;
    if (sx < -60 || sx > live.w + 60) continue;
    drawYurt(ctx, sx, c.horizon + 6 + (i % 2) * 4, sc * (0.85 + 0.2 * hash01(i)), ['#c24a34', '#2f6fb0', '#d9a43a', '#1f8a7a'][((i % 4) + 4) % 4]);
  }
  // grass behind the boards
  const gg = ctx.createLinearGradient(0, c.horizon, 0, c.yFar);
  gg.addColorStop(0, '#70864a'); gg.addColorStop(1, '#8c9a52');
  ctx.fillStyle = gg; ctx.fillRect(0, c.horizon, live.w, c.yFar - c.horizon);
  // spectators: real 3D people on timber stands (view3d/stands.js) when the layer is up, else the flat crowd below
  const st3 = globalThis.__stands3d;
  if (st3 && st3.render && !st3.lost && !v.no3dStands) {
    const k = c.ppm * K_FAR * (live.h > live.w ? 1.18 : 0.92), cxS = c.ax + c.aw / 2;
    const half = Math.max(cxS, live.w - cxS) / k + 1;
    const dtS = last3s.t === null ? 0 : Math.min(0.1, Math.max(0, v.t - last3s.t)); last3s.t = v.t;
    const tf = ctx.getTransform ? ctx.getTransform() : null;
    const dpr = (tf && tf.a) || 1;
    const pxm = Math.max(26, Math.min(st3.quality === 'low' ? 34 : 52, k * dpr));
    const cheer3 = v.cheer > 0 ? Math.min(1, v.cheer) : 0;
    st3.render(dtS, c.x, half * 2, pxm, cheer3);
    st3.blit(ctx, cxS, c.x, k, c.yFar + 6 + 0.3 * k);
    return;
  }
  // spectators in three rows behind the far boards (the roar goes up on a goal)
  const cheer = v.cheer > 0 ? Math.min(1, v.cheer) : 0;
  const rows = 3, hFig = 1.7;
  const k0 = K_FAR;
  for (let row = rows - 1; row >= 0; row--) {
    const rz = HW + 1.2 + row * 1.35, yb = c.yFar - (row + 1) * (c.yFar - c.horizon) * 0.2 + 6;
    const kk = k0 * (1 - row * 0.05);
    const step = 0.8, x0 = Math.floor((c.x - c.span * 0.65) / step) * step;
    for (let wx = x0; wx < c.x + c.span * 0.65; wx += step) {
      const id = Math.round(wx / step) + row * 977;
      const sx = c.ax + c.aw / 2 + (wx + hash01(id) * 0.3 - c.x) * c.ppm * kk * 1.0;
      const hue = ['#c9432f', '#e2a93a', '#2a73c8', '#f1ece0', '#1f8a7a', '#6b4aa0', '#d8d2c0'][Math.floor(hash01(id * 3.3) * 7)];
      const jump = cheer ? Math.abs(Math.sin(v.t * 9 + id)) * 0.35 * cheer : 0;
      const fh = hFig * c.ppm * kk * (0.9 + 0.2 * hash01(id * 1.7));
      const y = yb - jump * c.ppm * kk;
      ctx.fillStyle = hue; ctx.beginPath(); ctx.roundRect(sx - fh * 0.2, y - fh * 0.62, fh * 0.4, fh * 0.62, fh * 0.12); ctx.fill();
      ctx.fillStyle = '#d9ab82'; ctx.beginPath(); ctx.arc(sx, y - fh * 0.74, fh * 0.14, 0, TAU); ctx.fill();
      if (hash01(id * 5.1) > 0.55) { ctx.fillStyle = hash01(id * 8.1) > 0.5 ? '#f3efe2' : '#262a3c'; ctx.beginPath(); ctx.arc(sx, y - fh * 0.8, fh * 0.13, Math.PI, TAU); ctx.fill(); }
    }
    void rz;
  }
}

// ---- the pitch ------------------------------------------------------------------------------------------------------------------------------
function poly(ctx, c, pts) {
  ctx.beginPath();
  pts.forEach(([x, z], i) => { const p = proj(c, x, z, 0); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
  ctx.closePath();
}
function circlePts(cx, cz, r, n = 36) { const a = []; for (let i = 0; i < n; i++) a.push([cx + Math.cos((i / n) * TAU) * r, cz + Math.sin((i / n) * TAU) * r]); return a; }
function drawPitch(ctx, c, v) {
  // base
  poly(ctx, c, [[-HL, -HW], [HL, -HW], [HL, HW], [-HL, HW]]);
  const g = ctx.createLinearGradient(0, c.yFar, 0, c.yNear);
  g.addColorStop(0, '#a3a257'); g.addColorStop(1, '#b49a55');
  ctx.fillStyle = g; ctx.fill();
  // mown stripes
  for (let i = 0; i < 16; i++) {
    if (i % 2) continue;
    const x0 = -HL + i * 4;
    poly(ctx, c, [[x0, -HW], [x0 + 4, -HW], [x0 + 4, HW], [x0, HW]]);
    ctx.fillStyle = 'rgba(255,240,170,0.08)'; ctx.fill();
  }
  // worn earth: centre and both pits
  for (const [wx, r] of [[0, 5.5], [-GOAL_X, 6], [GOAL_X, 6]]) {
    poly(ctx, c, circlePts(wx, 0, r)); ctx.fillStyle = 'rgba(140,100,60,0.22)'; ctx.fill();
  }
  // lines
  ctx.strokeStyle = 'rgba(255,250,235,0.78)'; ctx.lineWidth = Math.max(2, c.ppm * 0.06);
  poly(ctx, c, [[-HL + 0.5, -HW + 0.5], [HL - 0.5, -HW + 0.5], [HL - 0.5, HW - 0.5], [-HL + 0.5, HW - 0.5]]); ctx.stroke();
  poly(ctx, c, [[0, -HW + 0.5], [0.001, -HW + 0.5], [0.001, HW - 0.5], [0, HW - 0.5]]); ctx.stroke();
  poly(ctx, c, circlePts(0, 0, 3.2)); ctx.stroke();
  // the two goal pits: raked sand ring and a darker hollow
  for (const gx of [-GOAL_X, GOAL_X]) {
    poly(ctx, c, circlePts(gx, 0, GOAL_R + 0.7)); ctx.fillStyle = 'rgba(224,196,140,0.55)'; ctx.fill();
    poly(ctx, c, circlePts(gx, 0, GOAL_R));
    const p = proj(c, gx, 0, 0);
    const gr = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, GOAL_R * c.ppm * 1.1);
    gr.addColorStop(0, '#6f4a2a'); gr.addColorStop(0.7, '#a07a46'); gr.addColorStop(1, '#d8b878');
    ctx.fillStyle = gr; ctx.fill();
    ctx.strokeStyle = '#fff6e0'; ctx.lineWidth = Math.max(2.5, c.ppm * 0.09); ctx.stroke();
    // ring of the drop-in zone, dotted
    ctx.save(); ctx.setLineDash([6, 10]); ctx.strokeStyle = 'rgba(255,250,235,0.35)'; ctx.lineWidth = 2;
    poly(ctx, c, circlePts(gx, 0, DROP_R)); ctx.stroke(); ctx.restore();
  }
  void v;
}
function drawRails(ctx, c, far) {
  // low timber rail with a felt-pattern band: far side behind the play, near side in front of it
  const z = far ? -HW - 0.3 : HW + 0.9;
  const a = proj(c, c.x - c.span, z, 0), b = proj(c, c.x + c.span, z, 0);
  const hgt = (far ? 0.9 : 1.1) * c.ppm * a.k;
  const x0 = a.x, x1 = b.x, y = a.y;
  ctx.fillStyle = 'rgba(30,20,10,0.25)'; ctx.fillRect(x0, y, x1 - x0, 6);
  const gr = ctx.createLinearGradient(0, y - hgt, 0, y);
  gr.addColorStop(0, '#6b4a2c'); gr.addColorStop(1, '#4a3019');
  ctx.fillStyle = gr; ctx.fillRect(x0, y - hgt, x1 - x0, hgt);
  // woven band
  const bh = hgt * 0.5, by = y - hgt * 0.78;
  ctx.fillStyle = '#b53a2a'; ctx.fillRect(x0, by, x1 - x0, bh);
  const step = 0.9 * c.ppm * a.k;
  const start = Math.floor((c.x - c.span) / 0.9) * 0.9;
  for (let wx = start; wx < c.x + c.span; wx += 0.9) {
    const p = proj(c, wx, z, 0).x;
    ctx.fillStyle = '#f0e2bd'; ctx.beginPath(); ctx.moveTo(p, by + bh * 0.1); ctx.lineTo(p + step * 0.4, by + bh * 0.5); ctx.lineTo(p, by + bh * 0.9); ctx.lineTo(p - step * 0.4, by + bh * 0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a4a8a'; ctx.beginPath(); ctx.arc(p + step * 0.5, by + bh * 0.5, bh * 0.14, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#8a6238'; ctx.fillRect(x0, y - hgt, x1 - x0, Math.max(3, hgt * 0.1));
  if (!far && y < live.h) {
    // the meadow in front of the near boards sinks into soft shade toward the bottom edge: depth for the picture, contrast for the thumb controls
    const sh = ctx.createLinearGradient(0, y, 0, live.h);
    sh.addColorStop(0, 'rgba(18,26,8,0.38)'); sh.addColorStop(0.18, 'rgba(18,26,8,0.12)'); sh.addColorStop(1, 'rgba(10,14,6,0.42)');
    ctx.fillStyle = sh; ctx.fillRect(0, y, live.w, live.h - y);
  }
}
function drawBunting(ctx, c, v) {
  const z = -HW - 0.3, a = proj(c, c.x - c.span, z, 0), b = proj(c, c.x + c.span, z, 0);
  const y0 = a.y - 1.9 * c.ppm * a.k;
  ctx.strokeStyle = 'rgba(60,40,20,0.7)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(a.x, y0); ctx.quadraticCurveTo((a.x + b.x) / 2, y0 + 16, b.x, y0); ctx.stroke();
  const cols = ['#c9432f', '#f1ece0', '#2a73c8', '#e2a93a', '#1f8a7a'];
  const start = Math.floor((c.x - c.span) / 1.4) * 1.4;
  for (let wx = start; wx < c.x + c.span; wx += 1.4) {
    const p = proj(c, wx, z, 0), sag = 16 * (1 - Math.pow((p.x - (a.x + b.x) / 2) / ((b.x - a.x) / 2 || 1), 2));
    const id = Math.round(wx / 1.4);
    ctx.fillStyle = cols[((id % 5) + 5) % 5];
    const sw = Math.sin(v.t * 2 + id) * 3;
    ctx.beginPath(); ctx.moveTo(p.x - 7, y0 + sag); ctx.lineTo(p.x + 7, y0 + sag); ctx.lineTo(p.x + sw, y0 + sag + 24 * (c.ppm / 50)); ctx.closePath(); ctx.fill();
  }
}

// ---- entities ----------------------------------------------------------------------------------------------------------------------------------
function drawShadow(ctx, p, k, c, w = 1.3) {
  ctx.fillStyle = 'rgba(30,24,10,0.3)';
  ctx.beginPath(); ctx.ellipse(p.x + 0.1 * c.ppm * k, p.y + 2, w * c.ppm * k * 0.95, 0.3 * c.ppm * k, 0, 0, TAU); ctx.fill();
}
export function riderScreen(c, r) { return proj(c, r.x, r.z, 0); }

const last3s = { t: null };
export function drawWorld(ctx, c, v, sim, opts = {}) {
  // With the 3D field up (it was drawn last frame) everything BEHIND the riders goes to the far canvas under it; the near rail, overlays
  // and the HUD stay on this canvas above the field.
  const fld0 = opts.no3d ? null : globalThis.__field3d;
  const useFar = !!(fld0 && fld0.ok && !fld0.lost && fld0.active && globalThis.__riders3d && !globalThis.__riders3d.lost);
  const bctx = useFar ? fld0.farContext(ctx) : ctx;
  drawBackdrop(bctx, c, v, sim);
  drawBunting(bctx, c, v);
  drawRails(bctx, c, true);
  // every rider's presentation state once per frame (shared by the 2D rig, the atlas and the 3D field)
  const states = sim.riders.map((r) => riderState(c, v, sim, r, opts));
  const ctl = sim.ctl >= 0 && !opts.noCtl ? sim.riders[sim.ctl] : null;
  const fld = opts.no3d ? null : globalThis.__field3d, r3 = opts.no3d ? null : globalThis.__riders3d;
  const dt = last3.t === null ? 0 : Math.min(0.1, Math.max(0, v.t - last3.t)); last3.t = v.t;
  // the real 3D pitch, horses, riders, ball, dust and ring on the canvas under this one
  let fieldOn = false;
  if (fld && fld.ok && !fld.lost && r3 && !r3.lost) {
    const list = [];
    sim.riders.forEach((r, i) => {
      const st = states[i];
      const sx = proj(c, r.x, r.z, 0).x, m = 3.2 * c.ppm * kAt(r.z);
      if (sx < c.ax - m || sx > c.ax + c.aw + m) return;
      st.id = r.id; st.dt = dt; st.look = { kit: st.tm.kit, trim: st.tm.trim, horse: st.tm.horse };
      list.push({ r, st });
    });
    try { fieldOn = fld.render({ c, W: live.w, H: live.h, list, ball: sim.ball, parts: v.parts, ctlId: ctl ? ctl.id : -1, t: v.t }); } catch (e) { if (!fld.warned) { fld.warned = true; console.warn('3D field failed; using the painted pitch', e); } try { fld.release(); } catch { /* ignore */ } fieldOn = false; }
  }
  if (!fieldOn) {
    // ground out to the bottom of the screen (the apron in front of the near boards)
    const gb = ctx.createLinearGradient(0, c.yFar, 0, live.h);
    gb.addColorStop(0, '#a3a257'); gb.addColorStop(0.7, '#8e8a4a'); gb.addColorStop(1, '#6f6c3a');
    ctx.fillStyle = gb; ctx.fillRect(0, c.yFar, live.w, live.h - c.yFar);
    drawPitch(ctx, c, v);
  }
  // the atlas renders every rider now when the 3D field is not up but the riders layer is
  let use3 = null;
  if (!fieldOn && r3 && r3.render && !r3.lost) {
    const list = [];
    sim.riders.forEach((r, i) => {
      const st = states[i];
      // riders far outside the picture are not rendered at all (the atlas and the draw calls are for what the player can see)
      const sx = proj(c, r.x, r.z, 0).x, m = 3.2 * c.ppm;
      if (sx < c.ax - m || sx > c.ax + c.aw + m) { st.slot = null; return; }
      st.id = r.id; st.dt = dt; st.look = { kit: st.tm.kit, trim: st.tm.trim, horse: st.tm.horse };
      list.push(st);
    });
    const tf = ctx.getTransform ? ctx.getTransform() : null;
    const scale = (tf && tf.a) || 1;
    if (r3.render(list, c.ppm * scale)) use3 = r3;
  }
  const items = [];
  for (const r of sim.riders) items.push({ z: r.z, r, kind: 'r' });
  const b = sim.ball;
  if (b.owner < 0 && !fieldOn) items.push({ z: b.z + 0.01, kind: 'b' });
  for (const p of v.parts) if (!fieldOn || p.kind !== 'dust') items.push({ z: p.z, p, kind: 'p' });
  items.sort((a, b2) => a.z - b2.z);
  for (const it of items) {
    if (it.kind === 'r') {
      if (fieldOn) { drawStun(ctx, c, v, it.r); continue; }
      drawRider(ctx, c, v, sim, it.r, ctl && ctl.id === it.r.id, { ...opts, f3: use3 }, states[sim.riders.indexOf(it.r)]);
    } else if (it.kind === 'b') drawFreeBall(ctx, c, v, b);
    else drawParticle(ctx, c, it.p);
  }
  drawRails(ctx, c, false);
}
function drawStun(ctx, c, v, r) {
  if (!(r.stun > 0)) return;
  const p = proj(c, r.x, r.z, 0), s = c.ppm * p.k;
  ctx.fillStyle = '#fff4c2'; ctx.font = `700 ${Math.round(s * 0.5)}px sans-serif`; ctx.textAlign = 'center';
  ctx.fillText('\u2733', p.x + Math.sin(v.t * 9) * s * 0.3, p.y - 2.6 * s);
}

function drawFreeBall(ctx, c, v, b) {
  const g = proj(c, b.x, b.z, 0), p = proj(c, b.x, b.z, b.y + 0.3);
  const r = 0.3 * c.ppm * g.k;
  ctx.fillStyle = `rgba(30,24,10,${0.34 - Math.min(0.2, b.y * 0.08)})`;
  ctx.beginPath(); ctx.ellipse(g.x, g.y + 2, r * (1.1 - Math.min(0.35, b.y * 0.1)), r * 0.32, 0, 0, TAU); ctx.fill();
  drawBall(ctx, p.x, p.y, r, v.t * 4 + b.x * 0.8);
}
function drawParticle(ctx, c, p) {
  const s = proj(c, p.x, p.z, p.y), a = clamp(p.life / p.max, 0, 1);
  if (p.kind === 'dust') {
    const r = (0.3 + (1 - a) * 0.7) * p.size * c.ppm * s.k * 2.2;
    ctx.fillStyle = `rgba(214,186,140,${a * 0.5})`; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill();
  } else {
    ctx.fillStyle = p.col; ctx.globalAlpha = Math.min(1, a * 2); const z = p.size * c.ppm * s.k * 1.4;
    ctx.fillRect(s.x - z, s.y - z * 0.6, z * 2, z * 1.2); ctx.globalAlpha = 1;
  }
}
// The presentation state of one rider this frame (shared by the 2D rig and the 3D layer): turn, lean, reach, throw. Call once per frame.
function riderState(c, v, sim, r, opts) {
  const tm = TEAMS[r.team === 0 ? (opts.homeTeam ?? 0) : (opts.awayTeam ?? 1)];
  const vs = v.rider[r.id] || (v.rider[r.id] = { f: r.face, ft: 0 });
  // turning around takes a moment (the picture squeezes / swings through the turn)
  if (vs.target !== r.face) { vs.target = r.face; vs.from = vs.f; vs.ft = 0; }
  vs.ft = Math.min(1, vs.ft + 1 / 12);
  vs.f = lerp(vs.from ?? r.face, vs.target, vs.ft);
  const fx = Math.abs(vs.f) < 0.28 ? 0.28 * Math.sign(vs.f || 1) : vs.f;
  const actK = r.act ? r.act.k : null;
  const prog = r.act ? 1 - r.act.t / 0.34 : 0;
  const b = sim.ball;
  const bx = clamp((b.x - r.x) * r.face, 0.35, 1.5);
  let reachX = bx, reachY = -0.22 + (b.z - r.z) * 0.02;
  if (actK === 'tug' && sim.carrier >= 0) {
    const t = sim.riders[sim.carrier];
    reachX = clamp((t.x - r.x) * r.face, 0.5, 1.4) + 0.2; reachY = -1.15;
  }
  const lean = actK === 'grab' ? Math.sin(Math.min(1, prog) * Math.PI) * 0.95 : actK === 'tug' ? Math.sin(Math.min(1, prog) * Math.PI) * 0.55 : 0;
  const throwP = r.throwT > 0 ? 1 - r.throwT / 0.35 : -1;
  return {
    tm, vs, fx, f: vs.f, actK, kind: actK, reachX, reachY, lean, throwP,
    ph: r.ph, spd: r.spd, t: v.t + r.id * 1.3, carry: r.carry, charge: r.charge, stun: r.stun > 0,
    cheer: opts.cheerTeam === r.team, tugKick: r.tugT > 0 ? r.tugT * 2 : 0,
  };
}
function drawRider(ctx, c, v, sim, r, controlled, opts, st) {
  const p = proj(c, r.x, r.z, 0), s = c.ppm * p.k;
  const { tm, fx, actK, reachX, reachY, lean, throwP } = st;
  drawShadow(ctx, p, p.k, c, 1.25);
  // controlled ring on the ground
  if (controlled) {
    const pulse = 1 + Math.sin(v.t * 6) * 0.06;
    ctx.strokeStyle = '#ffe36a'; ctx.lineWidth = Math.max(2.5, s * 0.07);
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 1.55 * s * pulse, 0.42 * s * pulse, 0, 0, TAU); ctx.stroke();
  }
  const f3 = opts.f3;
  if (f3 && st.slot) {
    // real 3D horse and rider (view3d layer): the slot already holds the picture, with the carried ball
    f3.blit(ctx, st.slot, p.x, p.y, s);
  } else {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(s * fx, s);
    drawHorseRider(ctx, {
      ph: r.ph, spd: r.spd, t: st.t, horse: tm.horse, kit: tm.kit, trim: tm.trim, carry: r.carry, lean, kind: actK, reachX, reachY,
      tugKick: st.tugKick, throwP, charge: r.charge, stun: st.stun, cheer: st.cheer,
    });
    ctx.restore();
    // the carried ball rides across the saddle
    if (r.carry && !(r.throwT > 0.2)) {
      const bp = proj(c, r.x + r.face * 0.0, r.z, 0);
      const bxs = bp.x + r.face * 0.55 * s, bys = bp.y - 1.12 * s;
      drawBall(ctx, bxs, bys, 0.3 * s, v.t * 3);
    }
  }
  if (r.stun > 0) {
    ctx.fillStyle = '#fff4c2'; ctx.font = `700 ${Math.round(s * 0.5)}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText('\u2733', p.x + Math.sin(v.t * 9) * s * 0.3, p.y - 2.6 * s);
  }
}

// ---- overlays: pointers over the rider, rings, aim ----------------------------------------------------------------------------------
export function drawOverlays(ctx, c, v, sim, o = {}) {
  const ctl = sim.ctl >= 0 ? sim.riders[sim.ctl] : null;
  const b = sim.ball;
  // rider tags
  for (const r of sim.riders) {
    if (r.team !== 0) continue;
    const p = proj(c, r.x, r.z, 2.75);
    if (ctl && r.id === ctl.id) {
      const bob = Math.sin(v.t * 6) * 3;
      ctx.fillStyle = '#ffe36a'; ctx.beginPath(); ctx.moveTo(p.x, p.y - 4 + bob); ctx.lineTo(p.x - 11, p.y - 22 + bob); ctx.lineTo(p.x + 11, p.y - 22 + bob); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(20,16,10,0.7)'; ctx.lineWidth = 2; ctx.stroke();
    }
  }
  if (!ctl || o.noAim) return;
  const gp = proj(c, b.x, b.z, 0);
  // grab ring: green when the lift will be clean, amber when too fast, only when it matters
  if (!ctl.carry && sim.carrier < 0 && b.owner < 0) {
    const d = hyp(b.x - ctl.x, b.z - ctl.z);
    if (d < GRAB_R + 3.5) {
      const fast = hyp(ctl.vx, ctl.vz) > 6.2, inReach = d <= GRAB_R;
      const col = inReach ? (fast ? '#ffb13a' : '#4be28a') : 'rgba(255,255,255,0.5)';
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.5, c.ppm * 0.07);
      const rr = (inReach ? GRAB_R : GRAB_R + 0.4 * (1 + Math.sin(v.t * 8))) * 0.55;
      ctx.beginPath(); ctx.ellipse(gp.x, gp.y + 1, rr * c.ppm * gp.k, rr * c.ppm * gp.k * 0.32, 0, 0, TAU); ctx.stroke();
    }
  }
  // tug ring
  if (!ctl.carry && sim.carrier >= 0 && sim.riders[sim.carrier].team !== ctl.team) {
    const t = sim.riders[sim.carrier], d = hyp(t.x - ctl.x, t.z - ctl.z);
    if (d < TUG_R + 2) {
      const tp = proj(c, t.x, t.z, 0), inR = d <= TUG_R;
      ctx.strokeStyle = inR ? '#4be28a' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(2.5, c.ppm * 0.07);
      ctx.beginPath(); ctx.ellipse(tp.x, tp.y + 1, 1.9 * c.ppm * tp.k, 0.55 * c.ppm * tp.k, 0, 0, TAU); ctx.stroke();
    }
  }
  // throw preview: the landing ring and the arc for the current charge
  if (ctl.carry && (ctl.charge > 0.02 || o.showAim)) {
    const pl = o.plan;
    if (pl) {
      const L = proj(c, pl.lx, pl.lz, 0);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.setLineDash([5, 7]); ctx.lineWidth = 3;
      ctx.beginPath();
      const steps = 22;
      for (let i = 0; i <= steps; i++) {
        const f = i / steps, tt = f * pl.t;
        const wx = ctl.x + Math.cos(pl.ang) * pl.vh * tt + ctl.vx * 0.5 * tt, wz = ctl.z + Math.sin(pl.ang) * pl.vh * tt + ctl.vz * 0.5 * tt;
        const wy = THROW_Y + pl.vy * tt - 4.9 * tt * tt;
        const p = proj(c, wx, wz, Math.max(0, wy));
        if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
      }
      ctx.stroke(); ctx.restore();
      const inside = pl.hit;
      ctx.strokeStyle = inside ? '#4be28a' : '#ffffff'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(L.x, L.y, 0.7 * c.ppm * L.k, 0.7 * c.ppm * L.k * 0.34, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = inside ? 'rgba(75,226,138,0.35)' : 'rgba(255,255,255,0.18)'; ctx.fill();
    }
  }
  void rangeFor; void V_BASE; void shade; void inv; void GOAL_R;
}

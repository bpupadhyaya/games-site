// The picture: a true perspective projection of the chute's centre line (heading, bank and slope per sample), drawn far to near with the
// canvas 2D API. Reads the simulation, never writes to it. All lengths are metres, all screen units are the game's virtual units.
import { SEG, HW, at, nrefAt } from './track.js';
import { clamp } from './util.js';

const NSEG = 86;                // 172 m of chute ahead of the camera
const CAM_BACK_DEFAULT = 5.0, WALL_H = 1.15, NEAR = 1.2;
const TAU = Math.PI * 2;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgb = (c, a = 1) => (a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hash = (i) => { let x = (i * 374761393 + 668265263) | 0; x = (x ^ (x >>> 13)) * 1274126177 | 0; return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };

// per-frame smoothing that belongs to the picture only (not the simulation)
const camFallback = { nc: 0, roll: 0 };

// Camera-space placement of a sled at lateral nu between two chute samples A (t = 0) and B (t = 1): where the sled's floor point is (X right, Y up
// relative to the eye, Z ahead), and its heading / slope / bank, so the 3D picture can use exactly the same perspective as the chute.
function place(A, B, t, nu, camY) {
  const X = A.X + (B.X - A.X) * t, Z = A.Z + (B.Z - A.Z) * t, Y0 = A.Y + (B.Y - A.Y) * t;
  const rx = A.rx + (B.rx - A.rx) * t, rz = A.rz + (B.rz - A.rz) * t, tilt = A.tilt + (B.tilt - A.tilt) * t;
  const dx = B.X - A.X, dz = B.Z - A.Z, dy = B.Y - A.Y;
  return { X: X + rx * nu, Z: Z + rz * nu, Y: Y0 - tilt * (nu / HW) - camY, heading: Math.atan2(dx, dz), pitch: Math.atan2(dy, Math.max(0.01, Math.hypot(dx, dz))), tilt };
}
const VIS = 1.3;     // the sled is drawn a little larger than life so the rider reads on a phone

// V: { T, s, n, v, u, t, fx, line, ghost: {s, n}|null, shake, flash, lap, ruts, phase, rider }
function drawWorld2D(ctx, SW, H, V) {
  const T = V.T, pal = T.pal, cam = V.cam || camFallback;
  const CAM_BACK = V.camBack || CAM_BACK_DEFAULT;      // (the store icon renders a closer camera)
  const F = Math.min(SW, H) * 1.06 * (1 + 0.04 * clamp(V.v / 36, 0, 1.2));
  const land = SW > H;
  const hy = H * (V.hyFrac || (land ? 0.38 : 0.34));
  const CAM_H = V.hyFrac ? (V.sledFrac * H - hy) * CAM_BACK / F : clamp((0.66 * H - hy) * CAM_BACK / F, 1.1, 3.0);   // (hyFrac / sledFrac: the store icon's own framing)
  const cx = SW / 2;
  const sSled = V.s;
  const sc = Math.max(1, sSled - CAM_BACK);
  const psiC = at(T.psi, sc);
  const bankS = at(T.bank, sSled);
  // camera follows the sled a little way across the chute
  const tgtN = V.n * 0.5;
  if (V.fixedCam) { cam.nc = V.cam.nc; cam.roll = V.cam.roll; } else cam.nc += (tgtN - cam.nc) * Math.min(1, 0.12);
  const tgtRoll = bankS * 0.42 - (V.u || 0) * 0.04;
  if (!V.fixedCam) cam.roll += (tgtRoll - cam.roll) * 0.1;
  const shakeX = V.shake ? (Math.sin(V.t * 71) * V.shake * 9) : 0, shakeY = V.shake ? (Math.cos(V.t * 83) * V.shake * 6) : 0;

  ctx.save();
  ctx.translate(shakeX, shakeY);
  // camera roll about the middle of the lower screen
  ctx.translate(cx, H * 0.72); ctx.rotate(-cam.roll); ctx.translate(-cx, -H * 0.72);
  const ext = 0.35 * Math.max(SW, H);          // room around the screen so the roll never shows an edge
  // ---- sky, mountains, ground -----------------------------------------------------------------------
  const sky = ctx.createLinearGradient(0, hy - H * 0.9, 0, hy + 4);
  sky.addColorStop(0, pal.sky0); sky.addColorStop(1, pal.sky1);
  ctx.fillStyle = sky; ctx.fillRect(-ext, -ext, SW + ext * 2, hy + ext + 2);
  const sunA = 0.55;
  const sunX = cx + F * Math.tan(clamp(sunA - psiC, -1.3, 1.3));
  const glow = ctx.createRadialGradient(sunX, hy - H * 0.2, 4, sunX, hy - H * 0.2, H * 0.34);
  glow.addColorStop(0, 'rgba(255,250,235,0.85)'); glow.addColorStop(0.25, 'rgba(255,244,214,0.35)'); glow.addColorStop(1, 'rgba(255,244,214,0)');
  ctx.fillStyle = glow; ctx.fillRect(-ext, -ext, SW + ext * 2, hy + ext);
  drawMountains(ctx, SW, hy, F, psiC, pal, ext);
  const gnd = ctx.createLinearGradient(0, hy, 0, H + ext);
  gnd.addColorStop(0, rgb(mix(pal.snow, pal.fog, 0.55))); gnd.addColorStop(1, rgb(pal.snow));
  ctx.fillStyle = gnd; ctx.fillRect(-ext, hy, SW + ext * 2, H - hy + ext);

  // ---- the chute ---------------------------------------------------------------------------------------
  const i0 = Math.floor(sc / SEG);
  const camPsi = psiC;
  const sinC = Math.sin(camPsi), cosC = Math.cos(camPsi);
  const camX = at(T.px, sc) + cosC * cam.nc, camZ = at(T.py, sc) - sinC * cam.nc;      // world position of the camera (x, y of the plan)
  const Hc = at(T.H, sc), gC = at(T.g, sc);
  const tiltOf = (s) => clamp(HW * Math.tan(at(T.bank, s)) * 0.55, -2.3, 2.3);
  const camY = CAM_H - tiltOf(sc) * (cam.nc / HW);
  const pts = [];
  for (let j = 0; j <= NSEG; j++) {
    const s = (i0 + j) * SEG;
    const wx = at(T.px, s) - camX, wy = at(T.py, s) - camZ;
    const X = wx * cosC - wy * sinC, Z = wx * sinC + wy * cosC;           // centre line in camera space
    const psi = at(T.psi, s) - camPsi;
    const rx = Math.cos(psi), rz = -Math.sin(psi);                           // chute's right vector in camera space
    const Y = at(T.H, s) - Hc + gC * Z;
    const tilt = tiltOf(s);
    pts.push({ s, X, Z, Y, rx, rz, tilt, bank: at(T.bank, s), idx: i0 + j });
  }
  // project a point at lateral nu (m, + right) and extra height h above the local floor
  const proj = (p, nu, h) => {
    const X = p.X + p.rx * nu, Z = p.Z + p.rz * nu, Y = p.Y - p.tilt * (nu / HW) + h - camY;
    const zz = Math.max(0.25, Z), k = F / zz;
    return [cx + X * k, hy - Y * k, zz];
  };
  const fogK = (Z) => clamp(Math.pow(Z / (NSEG * SEG), 1.15), 0, 1);
  const showLine = V.line;
  const signs = V.signs || [];
  let ghostDone = false;
  const poly = (a, b, c, d, col) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };

  for (let j = NSEG - 1; j >= 0; j--) {
    let A = pts[j];
    const B = pts[j + 1];
    if (B.Z <= NEAR) continue;
    if (A.Z < NEAR) { const t = (NEAR - A.Z) / (B.Z - A.Z); A = { s: A.s + (B.s - A.s) * t, X: A.X + (B.X - A.X) * t, Z: NEAR, Y: A.Y + (B.Y - A.Y) * t, rx: A.rx + (B.rx - A.rx) * t, rz: A.rz + (B.rz - A.rz) * t, tilt: A.tilt + (B.tilt - A.tilt) * t, bank: A.bank + (B.bank - A.bank) * t, idx: A.idx }; }
    const f = fogK(A.Z);
    const band = (A.idx % 6 < 3) ? 1 : 0.972;
    const bShade = clamp(1 - Math.abs(A.bank) * 0.07, 0.9, 1);
    // floor in three lateral strips: edges a touch bluer, the middle carries the sun's sheen
    const stripes = [[-HW, -HW * 0.45, 0.86], [-HW * 0.45, HW * 0.45, 1.0], [HW * 0.45, HW, 0.9]];
    for (const [n0, n1, sh] of stripes) {
      const col = mix(mix(pal.floor, [255, 255, 255], sh === 1 ? 0.34 : 0.08), pal.fog, f * 0.9).map((x, i) => (i < 3 ? x * band * sh * bShade * (sh === 1 ? 1 : 1) : x));
      poly(proj(A, n0, 0), proj(A, n1, 0), proj(B, n1, 0), proj(B, n0, 0), rgb(col.map((x) => Math.min(255, x))));
    }
    if (f < 0.8) poly(proj(A, -0.55, 0), proj(A, 0.55, 0), proj(B, 0.55, 0), proj(B, -0.55, 0), `rgba(255,255,255,${0.2 * (1 - f)})`);
    // sled grooves and cross cuts
    if (f < 0.75) {
      ctx.strokeStyle = `rgba(120,170,205,${0.34 * (1 - f)})`; ctx.lineWidth = Math.max(1, F / A.Z * 0.03);
      for (const nu of [-HW * 0.62, -HW * 0.2, HW * 0.2, HW * 0.62]) { const a = proj(A, nu, 0), b = proj(B, nu, 0); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      if (A.idx % 8 === 0) { const a = proj(A, -HW, 0), b = proj(A, HW, 0); ctx.strokeStyle = `rgba(150,196,226,${0.55 * (1 - f)})`; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    }
    // ice ruts: darker patches (the dark spot is where a kick will come)
    if (V.ruts) for (const r of V.ruts) if (!r.done && r.s >= A.s && r.s < B.s) {
      const a = proj(A, r.n - 0.9, 0), b = proj(A, r.n + 0.9, 0), c = proj(B, r.n + 0.9, 0), d = proj(B, r.n - 0.9, 0);
      poly(a, b, c, d, `rgba(70,110,150,${0.3 * (1 - f)})`);
      const e = proj({ ...A, X: A.X + (B.X - A.X) * 0.5, Z: A.Z + (B.Z - A.Z) * 0.5, Y: A.Y + (B.Y - A.Y) * 0.5 }, r.n, 0);
      ctx.strokeStyle = `rgba(230,245,255,${0.6 * (1 - f)})`; ctx.lineWidth = Math.max(1, F / A.Z * 0.05);
      ctx.beginPath(); ctx.moveTo(a[0] + (b[0] - a[0]) * 0.3, a[1] + (b[1] - a[1]) * 0.3); ctx.lineTo(d[0] + (c[0] - d[0]) * 0.7, d[1] + (c[1] - d[1]) * 0.7); ctx.stroke();
    }
    // start line and finish line
    if (V.lines) for (const L of V.lines) if (L.s >= A.s && L.s < B.s) {
      const cells = 8;
      for (let q = 0; q < cells; q++) {
        const n0 = -HW + (2 * HW * q) / cells, n1 = n0 + (2 * HW) / cells;
        const a = proj(A, n0, 0), b = proj(A, n1, 0), c = proj(B, n1, 0), d = proj(B, n0, 0);
        poly(a, b, c, d, q % 2 ? 'rgba(20,32,48,0.9)' : 'rgba(250,252,255,0.95)');
      }
    }
    // the racing line
    if (showLine && j % 2 === 0 && A.Z < 120) {
      const nA = nrefAt(T, A.s), nB = nrefAt(T, B.s);
      const hw = 0.13;
      const a0 = proj(A, nA - hw, 0.02), a1 = proj(A, nA + hw, 0.02), b1 = proj(B, nB + hw, 0.02), b0 = proj(B, nB - hw, 0.02);
      poly(a0, a1, b1, b0, `rgba(255,236,150,${0.9 * (1 - f * 0.8)})`);
    }
    // walls: inner faces and a rim on top
    const wallBase = mix(pal.wall, pal.fog, f * 0.85);
    for (const side of [-1, 1]) {
      const edge = side * HW;
      const outer = (side < 0 ? A.bank > 0 : A.bank < 0);          // the outside of the current bend: taller, banked
      const hh = WALL_H + (outer ? Math.min(1.1, Math.abs(A.bank) * 1.1) : 0);
      const hhB = WALL_H + ((side < 0 ? B.bank > 0 : B.bank < 0) ? Math.min(1.1, Math.abs(B.bank) * 1.1) : 0);
      const shade = (side < 0 ? 1.0 : 0.82) * (outer ? 0.93 : 1) * band;
      const wallCol = rgb(mix(wallBase, mix(pal.wallDark, pal.fog, f), 0.18 + (outer ? 0.12 : 0)).map((x) => x * shade));
      poly(proj(A, edge, 0), proj(A, edge, hh), proj(B, edge, hhB), proj(B, edge, 0), wallCol);
      // lower shadow band at the foot of the wall
      poly(proj(A, edge, 0), proj(A, edge, hh * 0.22), proj(B, edge, hhB * 0.22), proj(B, edge, 0), `rgba(40,80,120,${0.28 * (1 - f)})`);
      // rim cap (coloured) and the outer snow lip
      const rimC = mix(hexRgb(pal.rim), pal.fog, f);
      const alt = (A.idx % 10 < 5);
      poly(proj(A, edge, hh), proj(A, edge + side * 0.5, hh + 0.02), proj(B, edge + side * 0.5, hhB + 0.02), proj(B, edge, hhB), rgb(alt ? rimC : mix(rimC, [255, 255, 255], 0.55)));
      poly(proj(A, edge + side * 0.5, hh + 0.02), proj(A, edge + side * 9, hh - 0.8), proj(B, edge + side * 9, hhB - 0.8), proj(B, edge + side * 0.5, hhB + 0.02), rgb(mix(pal.snow, pal.fog, f * 0.9).map((x) => x * (0.97 + 0.03 * band))));
    }
    // pines and bend signs beside the chute
    if (f < 0.97) {
      const h = hash(A.idx * 7 + T.id.length);
      if (h < 0.42) {
        const side = hash(A.idx * 13 + 3) < 0.5 ? -1 : 1;
        const nu = side * (HW + 2.6 + hash(A.idx) * 9);
        const base = proj(A, nu, -0.8), size = (3.2 + hash(A.idx * 3) * 3.4);
        drawPine(ctx, base[0], base[1], F / base[2] * size, f, pal);
      }
    }
    for (const sg of signs) if (sg.s >= A.s && sg.s < B.s && f < 0.9) drawSign(ctx, proj(A, -sg.dir * (HW + 1.1) * -1, 0), F / A.Z, sg, f);
    // the ghost: drawn in its place in the order
    if (V.ghost && !ghostDone && V.ghost.s >= A.s && V.ghost.s < B.s) {
      ghostDone = true;
      const g = proj(A, V.ghost.n, 0);
      const L3 = globalThis.__luger;
      let ok = false;
      if (L3 && L3.draw && g[2] > 0.9) {
        const pl = place(A, B, (V.ghost.s - A.s) / (B.s - A.s), V.ghost.n, camY), kk = F / g[2];
        const half = 1.7 * kk * VIS;
        ok = L3.draw(ctx, { ghost: true, F, cx, hy, X: pl.X, Y: pl.Y, Z: pl.Z, heading: pl.heading, pitch: pl.pitch, roll: Math.atan2(pl.tilt * 2, HW * 2) * 0.7, scale: VIS,
          rect: [g[0] - half, g[1] - half * 1.25, half * 2, half * 2], rider: { lie: 1, u: 0, v: V.v }, t: V.t });
      }
      if (!ok) drawSledSprite(ctx, g[0], g[1], F / g[2], { ghost: true, t: V.t, lean: 0, roll: -A.tilt * 0.25 });
    }
  }
  // the finish arch: posts and a banner, in its place (drawn after the segments, only when ahead of the camera)
  if (V.lines) for (const L of V.lines) if (L.arch) {
    const k = (L.s / SEG) - i0;
    const jj = Math.floor(k);
    if (jj >= 0 && jj < NSEG) {
      const A = pts[jj], B = pts[jj + 1], tt = k - jj;
      const P = { X: A.X + (B.X - A.X) * tt, Z: A.Z + (B.Z - A.Z) * tt, Y: A.Y + (B.Y - A.Y) * tt, rx: A.rx, rz: A.rz, tilt: A.tilt };
      if (P.Z > 1) drawArch(ctx, proj(P, -HW - 0.3, 0), proj(P, HW + 0.3, 0), proj(P, -HW - 0.3, 4.3), proj(P, HW + 0.3, 4.3), L.label, F / P.Z);
    }
  }
  // ---- the sled -------------------------------------------------------------------------------------------
  const kS = (sSled / SEG) - i0, jS = clamp(Math.floor(kS), 0, NSEG - 1), tS = kS - jS;
  const SA = pts[jS], SB = pts[jS + 1];
  const SP = { X: SA.X + (SB.X - SA.X) * tS, Z: SA.Z + (SB.Z - SA.Z) * tS, Y: SA.Y + (SB.Y - SA.Y) * tS, rx: SA.rx + (SB.rx - SA.rx) * tS, rz: SA.rz + (SB.rz - SA.rz) * tS, tilt: SA.tilt + (SB.tilt - SA.tilt) * tS };
  const sp = proj(SP, V.n, 0);
  const yaw = Math.atan2(V.vn || 0, Math.max(3, V.v));
  const floorRoll = Math.atan2(SP.tilt * 2, HW * 2) * 0.9;
  V.out = { x: sp[0], y: sp[1], k: F / sp[2] };
  const kS0 = F / sp[2];
  const L3 = globalThis.__luger;
  if (V.shadow !== false) {
    ctx.save(); ctx.translate(sp[0], sp[1] - kS0 * 0.02); ctx.scale(1, 0.38);
    ctx.beginPath(); ctx.ellipse(0, 0, kS0 * 0.42 * VIS, kS0 * 0.5 * VIS, 0, 0, TAU); ctx.fillStyle = 'rgba(30,70,110,0.28)'; ctx.fill(); ctx.restore();
  }
  let drew3d = false;
  if (L3 && L3.draw && V.rider && sp[2] > 0.9) {
    const pl = place(SA, SB, tS, V.n, camY);
    const half = 1.7 * kS0 * VIS;
    const args = { ghost: false, F, cx, hy, X: pl.X, Y: pl.Y, Z: pl.Z, heading: pl.heading + yaw * 0.6 + (V.sledYaw || 0), pitch: pl.pitch, roll: floorRoll * 0.75 + (V.u || 0) * 0.1, scale: VIS,
      rect: [sp[0] - half, sp[1] - half * 1.25, half * 2, half * 2], rider: V.rider, t: V.t };
    if (V.deferSled) { V.out.sled = args; drew3d = true; } else drew3d = L3.draw(ctx, args);
  }
  if (!drew3d && !(L3 && L3.pending)) drawSledSprite(ctx, sp[0], sp[1], kS0 * VIS, { ghost: false, t: V.t, lean: V.u || 0, roll: floorRoll * 0.75 + (V.u || 0) * 0.1, yaw, v: V.v, hit: V.hitFlag });
  // speed streaks: thin white lines flying out of the vanishing point
  if (V.v > 8) {
    const n = 16, sp0 = clamp((V.v - 8) / 26, 0, 1);
    ctx.strokeStyle = `rgba(255,255,255,${0.14 + 0.2 * sp0})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = hash(i * 17 + 5) * TAU, ph = ((V.t * (0.8 + hash(i) * 0.8) * (0.4 + sp0)) + hash(i * 3)) % 1;
      const r0 = (60 + ph * ph * 0.55 * Math.max(SW, H)) , r1 = r0 + 18 + 70 * sp0 * ph;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, hy + H * 0.12 + Math.sin(a) * r0 * 0.55); ctx.lineTo(cx + Math.cos(a) * r1, hy + H * 0.12 + Math.sin(a) * r1 * 0.55); ctx.stroke();
    }
  }
  ctx.restore();
  // vignette on the whole screen, stronger when fast
  const vg = ctx.createRadialGradient(cx, H * 0.5, Math.min(SW, H) * 0.35, cx, H * 0.5, Math.max(SW, H) * 0.78);
  vg.addColorStop(0, 'rgba(10,25,45,0)'); vg.addColorStop(1, `rgba(10,25,45,${0.10 + 0.16 * clamp(V.v / 36, 0, 1)})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, SW, H);
  if (V.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.35 * V.flash})`; ctx.fillRect(0, 0, SW, H); }
  return V.out;
}

// The picture: the real 3D scene (view3d/world3d.js) when it is loaded and its context is alive, else the 2D chute above. While the 3D scene
// comes in it fades over the 2D picture; the HUD, laid over either, reads the same V.out (sled screen x, y and scale).
export function drawWorld(ctx, SW, H, V) {
  const W3 = globalThis.__world3d;
  if (W3 && W3.ready && !W3.lost && !V.no3d) {
    const f = W3.fade ? W3.fade() : 1;
    if (f < 1) drawWorld2D(ctx, SW, H, V);
    let out = null;
    try { out = W3.draw(ctx, SW, H, V, f < 1 ? f * f * (3 - 2 * f) : 1); } catch (e) { console.warn('3D scene failed, using the 2D picture', e); W3.lost = true; }
    if (out) { drawOverlay(ctx, SW, H, V); return out; }
  }
  return drawWorld2D(ctx, SW, H, V);
}

// speed streaks, vignette and the wall-hit flash over the 3D picture (the 2D picture draws the same inline)
function drawOverlay(ctx, SW, H, V) {
  const cx = SW / 2, land = SW > H, hy = H * (V.hyFrac || (land ? 0.38 : 0.34));
  if (V.v > 8) {
    const n = 14, sp0 = clamp((V.v - 8) / 26, 0, 1);
    ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.10 + 0.14 * sp0})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = hash(i * 17 + 5) * TAU, ph = ((V.t * (0.8 + hash(i) * 0.8) * (0.4 + sp0)) + hash(i * 3)) % 1;
      const r0 = (60 + ph * ph * 0.55 * Math.max(SW, H)), r1 = r0 + 18 + 70 * sp0 * ph;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, hy + H * 0.12 + Math.sin(a) * r0 * 0.55); ctx.lineTo(cx + Math.cos(a) * r1, hy + H * 0.12 + Math.sin(a) * r1 * 0.55); ctx.stroke();
    }
    ctx.restore();
  }
  const vg = ctx.createRadialGradient(cx, H * 0.5, Math.min(SW, H) * 0.35, cx, H * 0.5, Math.max(SW, H) * 0.78);
  vg.addColorStop(0, 'rgba(10,25,45,0)'); vg.addColorStop(1, `rgba(10,25,45,${0.10 + 0.16 * clamp(V.v / 36, 0, 1)})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, SW, H);
  if (V.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.35 * V.flash})`; ctx.fillRect(0, 0, SW, H); }
}

function drawMountains(ctx, SW, hy, F, psiC, pal, ext) {
  const cx = SW / 2;
  for (let layer = 0; layer < 2; layer++) {
    const par = layer ? 1.0 : 0.82, base = hy - (layer ? 0 : 22), amp = layer ? 150 : 210;
    ctx.beginPath(); ctx.moveTo(-ext, hy + 2);
    for (let x = -ext; x <= SW + ext; x += 10) {
      const a = psiC * par + Math.atan((x - cx) / F);
      const h = amp * (0.35 + 0.65 * Math.abs(Math.sin(a * 2.3 + layer * 1.7) * 0.6 + Math.sin(a * 5.1 + 0.4) * 0.28 + Math.sin(a * 11.7 + layer) * 0.12));
      ctx.lineTo(x, base - h * (F / 760) * (layer ? 0.7 : 1));
    }
    ctx.lineTo(SW + ext, hy + 2); ctx.closePath();
    const g = ctx.createLinearGradient(0, hy - amp * 1.1, 0, hy);
    g.addColorStop(0, rgb(mix(pal.mount, [255, 255, 255], layer ? 0.55 : 0.7))); g.addColorStop(0.5, rgb(mix(pal.mount, [255, 255, 255], layer ? 0.25 : 0.4))); g.addColorStop(1, rgb(mix(pal.mount, pal.fog, 0.6)));
    ctx.fillStyle = g; ctx.fill();
  }
}

function drawPine(ctx, x, y, h, f, pal) {
  if (h < 3) return;
  const c = mix(pal.tree, pal.fog, f * 0.8), w = h * 0.34;
  ctx.fillStyle = rgb(mix([70, 52, 40], pal.fog, f)); ctx.fillRect(x - w * 0.06, y - h * 0.12, w * 0.12, h * 0.14);
  for (let i = 0; i < 3; i++) {
    const by = y - h * (0.1 + i * 0.26), tw = w * (1 - i * 0.2), th = h * 0.42;
    ctx.beginPath(); ctx.moveTo(x - tw, by); ctx.lineTo(x, by - th); ctx.lineTo(x + tw, by); ctx.closePath();
    ctx.fillStyle = rgb(c.map((v, k) => v * (1 - i * 0.06)));
    ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - tw * 0.3, by - th * 0.6); ctx.lineTo(x, by - th); ctx.lineTo(x + tw * 0.3, by - th * 0.6); ctx.closePath();
    ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - f)})`; ctx.fill();
  }
}

function drawSign(ctx, p, k, sg, f) {
  const w = 0.9 * k, h = 0.75 * k;
  if (w < 5) return;
  ctx.save();
  ctx.fillStyle = `rgba(60,70,84,${1 - f})`; ctx.fillRect(p[0] - w * 0.05, p[1] - h * 1.7, w * 0.1, h * 1.7);
  const x = p[0] - w / 2, y = p[1] - h * 2.4;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, w * 0.12); ctx.fillStyle = `rgba(235,240,246,${1 - f})`; ctx.fill();
  ctx.lineWidth = Math.max(1, w * 0.06); ctx.strokeStyle = `rgba(214,63,44,${1 - f})`; ctx.stroke();
  ctx.fillStyle = `rgba(20,36,56,${1 - f})`; ctx.font = `800 ${Math.round(h * 0.6)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${sg.dir > 0 ? '' : ''}${sg.n}`, p[0] - w * 0.12, y + h * 0.52);
  // arrow
  ctx.beginPath(); const ax = p[0] + w * 0.27, ay = y + h * 0.52, s = h * 0.2 * sg.dir;
  ctx.moveTo(ax - s, ay - h * 0.2); ctx.lineTo(ax + s, ay); ctx.lineTo(ax - s, ay + h * 0.2); ctx.closePath(); ctx.fillStyle = `rgba(214,63,44,${1 - f})`; ctx.fill();
  ctx.restore();
}

function drawArch(ctx, bl, br, tl, tr, label, k) {
  ctx.save();
  const th = Math.max(3, k * 0.28);
  ctx.strokeStyle = '#e8eef4'; ctx.lineWidth = th;
  ctx.beginPath(); ctx.moveTo(bl[0], bl[1]); ctx.lineTo(tl[0], tl[1]); ctx.moveTo(br[0], br[1]); ctx.lineTo(tr[0], tr[1]); ctx.stroke();
  // banner
  const ax = (tl[0] + tr[0]) / 2, ay = (tl[1] + tr[1]) / 2, w = tr[0] - tl[0], h = Math.max(10, k * 0.9);
  ctx.beginPath(); ctx.roundRect(tl[0], ay - h / 2, w, h, h * 0.18); ctx.fillStyle = '#d63f2c'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(h * 0.6)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, ax, ay + 1);
  ctx.restore();
}

// The 2D fallback (no WebGL2, 3D load failure, ?fig=2d, small menu cards): the rider lying on his back on the sled, seen from behind and above, drawn
// to match the 3D picture (white helmet with a red stripe, navy suit, dark boots, steel runners with curled tips, red pod). Local units are metres * k,
// y is up the screen (forward along the chute). lean -1..1 shifts the shoulders; the picture is foreshortened like the real camera.
export function drawSledSprite(ctx, x, y, k, o) {
  const a = o.ghost ? 0.5 : 1;
  if (k < 2) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.rotate((o.roll || 0) + (o.yaw || 0) * 0.5);
  ctx.scale(k, -k);                                         // y up, metres
  const lean = o.lean || 0, sh = lean * 0.05;
  const G = !!o.ghost;
  const pod = G ? ['#4a7fb8', '#7db8ee', '#bfe0ff'] : ['#8f1d14', '#e0412c', '#ff8e6e'];
  const suit = G ? ['#6c9bd0', '#a8d0f4'] : ['#122a63', '#2a54b0'];
  const boot = G ? '#d8ecff' : '#14171d';
  const helm = G ? ['#ffffff', '#cfe6fb', '#8fbce8'] : ['#ffffff', '#e6eaee', '#9aa3ad'];
  const vert = (x0, y0, x1, y1, c0, c1) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; };
  // steel runners with the curled tips (the left one a touch darker)
  for (const sx of [-1, 1]) {
    ctx.strokeStyle = sx < 0 ? '#aeb8c4' : '#d9e0e8'; ctx.lineWidth = 0.045; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx * 0.215, 0.0); ctx.lineTo(sx * 0.215, 0.62); ctx.quadraticCurveTo(sx * 0.215, 0.98, sx * 0.19, 1.04); ctx.stroke();
  }
  ctx.strokeStyle = '#c9d2dc'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(-0.215, 0.0); ctx.lineTo(0.215, 0.0); ctx.stroke();
  // pod
  ctx.beginPath(); ctx.moveTo(-0.22, 0.02); ctx.quadraticCurveTo(-0.24, 0.5, -0.12, 0.94); ctx.quadraticCurveTo(0, 1.02, 0.12, 0.94); ctx.quadraticCurveTo(0.24, 0.5, 0.22, 0.02);
  ctx.quadraticCurveTo(0, -0.07, -0.22, 0.02); ctx.closePath();
  ctx.fillStyle = vert(-0.24, 0, 0.24, 0, pod[0], pod[0]); const pg = ctx.createLinearGradient(-0.24, 0, 0.24, 0); pg.addColorStop(0, pod[0]); pg.addColorStop(0.55, pod[1]); pg.addColorStop(1, pod[0]);
  ctx.fillStyle = pg; ctx.fill();
  // legs stretched forward, boots on the bows
  ctx.lineCap = 'round';
  for (const sx of [-1, 1]) {
    ctx.strokeStyle = suit[0]; ctx.lineWidth = 0.15; ctx.beginPath(); ctx.moveTo(sx * 0.1, 0.34); ctx.lineTo(sx * 0.1, 0.8); ctx.stroke();
    ctx.strokeStyle = suit[1]; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(sx * 0.085, 0.36); ctx.lineTo(sx * 0.085, 0.78); ctx.stroke();
    ctx.strokeStyle = boot; ctx.lineWidth = 0.13; ctx.beginPath(); ctx.moveTo(sx * 0.1, 0.8); ctx.lineTo(sx * 0.105, 0.9); ctx.stroke();
  }
  // torso, shoulders shifting with the lean; arms along the body ending in fists on the straps
  const tg = ctx.createLinearGradient(-0.3, 0, 0.3, 0); tg.addColorStop(0, suit[0]); tg.addColorStop(0.5, suit[1]); tg.addColorStop(1, suit[0]);
  ctx.beginPath(); ctx.moveTo(-0.14, 0.4); ctx.lineTo(0.14, 0.4); ctx.quadraticCurveTo(0.27 + sh, 0.2, 0.25 + sh, 0.08); ctx.lineTo(-0.25 + sh, 0.08); ctx.quadraticCurveTo(-0.27 + sh, 0.2, -0.14, 0.4); ctx.closePath();
  ctx.fillStyle = tg; ctx.fill();
  for (const sx of [-1, 1]) {
    ctx.strokeStyle = suit[0]; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(sx * 0.26 + sh, 0.13); ctx.lineTo(sx * 0.25, 0.38); ctx.stroke();
    ctx.fillStyle = boot; ctx.beginPath(); ctx.arc(sx * 0.25, 0.4, 0.05, 0, TAU); ctx.fill();
  }
  // helmet: white shell (nearest the camera), red centre stripe, dark visor edge on the far side
  const hx = sh * 1.5, hy2 = 0.07;
  ctx.beginPath(); ctx.ellipse(hx, hy2 + 0.15, 0.14, 0.16, 0, 0, TAU);
  ctx.fillStyle = '#131820'; ctx.fill();                  // visor / dark edge on the far side
  const hg = ctx.createRadialGradient(hx - 0.04, hy2 + 0.04, 0.02, hx, hy2 + 0.04, 0.2);
  hg.addColorStop(0, helm[0]); hg.addColorStop(0.6, helm[1]); hg.addColorStop(1, helm[2]);
  ctx.beginPath(); ctx.ellipse(hx, hy2, 0.14, 0.17, 0, 0, TAU); ctx.fillStyle = hg; ctx.fill();
  ctx.strokeStyle = G ? '#7db8ee' : '#d8342a'; ctx.lineWidth = 0.022; ctx.beginPath(); ctx.moveTo(hx, hy2 - 0.15); ctx.lineTo(hx, hy2 + 0.15); ctx.stroke();
  ctx.restore();
}

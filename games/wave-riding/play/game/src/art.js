// Wave Riding: drawing the sea. Pure canvas, no assets. The camera rides along the wave: the rider is always at the same
// screen spot and the world scrolls past. A gentle perspective makes the wave ahead (to the right) smaller and the
// foam behind (to the left) larger. Everything here only READS the simulation state.
import { hollowAt, BEACHES, BOARDS, clamp, lineAt } from './sim.js';

const TAU = Math.PI * 2;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
// a cheap deterministic wobble in -1..1 from a position and a time
const wob = (x, t) => 0.5 * Math.sin(x * 0.93 + t * 3.1) + 0.3 * Math.sin(x * 2.37 - t * 5.2 + 1.3) + 0.2 * Math.sin(x * 5.11 + t * 7.3 + 2.1);

// ---- palettes, one per beach ---------------------------------------------------------------------------------------------------
export const PALS = [
  { // Dawn Cove
    sky: ['#2b4b86', '#e58fa0', '#ffd8a8'], sun: { x: 0.74, y: 0.62, c: '255,236,190', r: 0.55 }, far: ['#f3b79e', '#6d8fc2'],
    face: ['#d9fff1', '#5fd0c4', '#1f8fae', '#0c4a7a'], deep: '#082f55', foam: ['#ffffff', '#e6f6f6', '#a8c8d6'], haze: '255,214,190', moon: false,
  },
  { // Reef Point
    sky: ['#2f7fd8', '#7cc2f0', '#d6f1ff'], sun: { x: 0.28, y: 0.3, c: '255,252,225', r: 0.5 }, far: ['#bde4f5', '#4a9fd0'],
    face: ['#cdf8e6', '#4fdcb6', '#119fa6', '#06507a'], deep: '#05355a', foam: ['#ffffff', '#ecfbfb', '#a6d0da'], haze: '200,236,250', moon: false,
  },
  { // Long Bay
    sky: ['#4a3d8f', '#f07a6a', '#ffc27a'], sun: { x: 0.62, y: 0.66, c: '255,214,150', r: 0.6 }, far: ['#f6a27a', '#6a5aa8'],
    face: ['#ffe6c8', '#6fd0c0', '#2a86a8', '#1a3a78'], deep: '#14275c', foam: ['#fffaf0', '#fde9dc', '#c8b4c8'], haze: '255,190,150', moon: false,
  },
  { // Storm Head
    sky: ['#070d27', '#17285a', '#37508a'], sun: { x: 0.7, y: 0.22, c: '210,230,255', r: 0.28 }, far: ['#37508a', '#142450'],
    face: ['#a4f0f6', '#2fa3c8', '#14588e', '#071d4a'], deep: '#05122f', foam: ['#f2fbff', '#cfe6f6', '#7f9cc0'], haze: '80,110,170', moon: true,
  },
];

// ---- the camera ---------------------------------------------------------------------------------------------------------------
const U0 = 170;
export function makeCam(W, H, r, wave, o = {}) {
  const sc = Math.min(W, H) / 720, land = W > H;
  const F0 = clamp(H * (land ? 0.5 : 0.47), 270 * sc, 760 * sc) * (o.fill || 1);
  const ppm = 6.3 * sc * (land ? 1.12 : 1);
  const X0 = W * (land ? 0.3 : 0.36);
  const yB0 = H * (o.base || (land ? 0.8 : 0.85));
  const Hh = yB0 - F0 * 0.9;
  const cam = {
    W, H, sc, land, F0, ppm, X0, yB0, Hh, r, wave,
    k: (u) => U0 / (U0 + Math.max(u, -U0 * 0.6)),
    X: (u) => X0 + U0 * ppm * Math.log(1 + Math.max(u, -U0 * 0.6) / U0),
    uOf: (x) => U0 * (Math.exp((x - X0) / (U0 * ppm)) - 1),
    yB: (u) => Hh + (yB0 - Hh) * (U0 / (U0 + Math.max(u, -U0 * 0.6))),
  };
  // height of the face (px) at u metres ahead of the rider
  cam.fh = (u) => {
    const s = r.s + u, scd = u + r.d;
    const base = 1 - 0.38 * smooth(30, 150, scd);
    const undul = 0.05 * Math.sin(s * 0.045 + wave.ph) + 0.03 * Math.sin(s * 0.11 + 1);
    const end = 0.35 + 0.65 * smooth(wave.len + 6, wave.len - 70, s);
    const hol = hollowAt(wave, s);
    return cam.F0 * cam.k(u) * (base + undul) * end * (1 + 0.1 * hol);
  };
  cam.sx = X0;
  cam.sy = (y) => cam.yB(0) - y * cam.fh(0);
  cam.xc = cam.X(-r.d);
  return cam;
}

// ---- sky and far sea ----------------------------------------------------------------------------------------------------------------
export function drawSky(ctx, cam, pal, t, scroll) {
  const { W, H, Hh } = cam;
  const g = ctx.createLinearGradient(0, 0, 0, Hh + 8);
  g.addColorStop(0, pal.sky[0]); g.addColorStop(0.6, pal.sky[1]); g.addColorStop(1, pal.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh + 8);
  // sun / moon glow
  const sx = W * pal.sun.x, sy = Hh * pal.sun.y, sr = Math.max(W, Hh) * pal.sun.r;
  const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
  rg.addColorStop(0, `rgba(${pal.sun.c},0.95)`); rg.addColorStop(0.12, `rgba(${pal.sun.c},0.6)`); rg.addColorStop(1, `rgba(${pal.sun.c},0)`);
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, Hh + 8);
  ctx.fillStyle = pal.moon ? '#f4f8ff' : `rgba(${pal.sun.c},1)`;
  ctx.beginPath(); ctx.arc(sx, sy, pal.moon ? 26 * cam.sc : 30 * cam.sc, 0, TAU); ctx.fill();
  if (pal.moon) { ctx.fillStyle = 'rgba(160,180,220,0.45)'; for (const [dx, dy, rr] of [[-8, -6, 6], [7, 5, 5], [-2, 10, 4]]) { ctx.beginPath(); ctx.arc(sx + dx * cam.sc, sy + dy * cam.sc, rr * cam.sc, 0, TAU); ctx.fill(); } }
  // stars at night
  if (pal.moon) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 46; i++) { const px = (i * 97.3 % 1) * W, py = ((i * 61.7) % 1) * Hh * 0.75, tw = 0.5 + 0.5 * Math.sin(t * 1.5 + i); ctx.globalAlpha = 0.25 + 0.5 * tw; ctx.fillRect(px, py, 2 * cam.sc, 2 * cam.sc); }
    ctx.globalAlpha = 1;
  }
  // streaky clouds drifting slowly (parallax with the ride)
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const px = ((((i * 0.231 + 0.07) * W * 1.6 - scroll * 0.35 * (0.5 + i * 0.15)) % (W * 1.6)) + W * 1.6) % (W * 1.6) - W * 0.3;
    const py = Hh * (0.18 + 0.13 * i), cw = W * (0.28 + 0.07 * (i % 3)), ch = 10 * cam.sc * (1 + (i % 2));
    const cg = ctx.createLinearGradient(px, 0, px + cw, 0);
    cg.addColorStop(0, `rgba(${pal.haze},0)`); cg.addColorStop(0.5, `rgba(${pal.haze},${pal.moon ? 0.16 : 0.5})`); cg.addColorStop(1, `rgba(${pal.haze},0)`);
    ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(px + cw / 2, py, cw / 2, ch, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // far land on the horizon
  ctx.fillStyle = pal.far[1]; ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.moveTo(0, Hh + 4);
  const lx = ((scroll * 0.05) % 400);
  for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, Hh - (10 + 16 * Math.sin((x + lx) * 0.012) + 9 * Math.sin((x + lx) * 0.031 + 2)) * cam.sc * (x > W * 0.55 ? 1.3 : 0.5));
  ctx.lineTo(W, Hh + 4); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  // open sea between the horizon and the wave
  const sg = ctx.createLinearGradient(0, Hh, 0, cam.yB0);
  sg.addColorStop(0, pal.far[0]); sg.addColorStop(1, pal.far[1]);
  ctx.fillStyle = sg; ctx.fillRect(0, Hh, W, cam.H - Hh);
  // far swell lines
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5 * cam.sc;
  for (let i = 0; i < 7; i++) {
    const yy = Hh + 4 + i * i * 2.5 * cam.sc + i * 4 * cam.sc;
    if (yy > cam.yB0) break;
    ctx.beginPath();
    const off = (scroll * (0.04 + i * 0.02) + i * 70) % 90;
    for (let x = -90; x <= W + 90; x += 90) { ctx.moveTo(x - off, yy); ctx.lineTo(x - off + 38 + i * 6, yy); }
    ctx.stroke();
  }
}

// ---- the wave ---------------------------------------------------------------------------------------------------------------------
export const CURL_W = 15;   // metres over which the crest falls away into the whitewater
const colPool = [];
function columns(cam, step = 8) {
  // at most about 70 columns whatever the screen size, and the column records are reused between frames (no per-frame allocation)
  step = Math.max(step, Math.ceil(cam.W / 70));
  let n = 0;
  for (let x = -step; x <= cam.W + step; x += step) {
    const u = cam.uOf(x), yb = cam.yB(u), fh = cam.fh(u), sc = u + cam.r.d;
    // the crest steepens just ahead of the curl, so the face stands up there; behind it the crest falls into the foam
    const lift = sc > -4 && sc < 50 ? cam.F0 * cam.k(u) * 0.05 * Math.exp(-Math.pow((sc - 10) / 14, 2)) : 0;
    const c = colPool[n] || (colPool[n] = {});
    c.x = x; c.u = u; c.yb = yb; c.fh = fh; c.top = yb - fh - lift; c.sc = sc; c.s = cam.r.s + u;
    n++;
  }
  colPool.length = n;
  return colPool;
}
// Whitewater height (px, above the base) at u metres ahead of the rider
export const foamH = (cam, u) => { const sc = u + cam.r.d; return cam.F0 * cam.k(u) * (0.5 * Math.exp(Math.min(0, sc) / 60) * (0.85 + 0.15 * Math.sin((cam.r.s + u) * 0.05)) + 0.05); };

export function drawWave(ctx, cam, pal, t) {
  const { r, wave, W } = cam;
  const cols = columns(cam, W > 900 ? 10 : 8);
  const xc = cam.xc;
  const topAt = (c) => {
    if (c.sc >= 0) return c.top;
    const q = clamp(-c.sc / CURL_W, 0, 1), e = 1 - (1 - q) * (1 - q);
    const ft = c.yb - foamH(cam, c.u);
    return mix(c.top, Math.max(ft, c.yb - c.fh), e);
  };
  const usable = cols;
  ctx.save();
  const faceTop = cam.yB0 - cam.F0 * 1.15, faceBot = cam.yB0 + cam.F0 * 0.14;
  const fg = ctx.createLinearGradient(0, faceTop, 0, faceBot);
  fg.addColorStop(0, pal.face[0]); fg.addColorStop(0.24, pal.face[1]); fg.addColorStop(0.62, pal.face[2]); fg.addColorStop(1, pal.face[3]);
  ctx.beginPath();
  usable.forEach((c, i) => (i ? ctx.lineTo(c.x, topAt(c)) : (ctx.moveTo(c.x, c.yb + 6), ctx.lineTo(c.x, topAt(c)))));
  for (let i = usable.length - 1; i >= 0; i--) ctx.lineTo(usable[i].x, usable[i].yb + 6);
  ctx.closePath(); ctx.fillStyle = fg; ctx.fill();
  ctx.clip();
  // the sun shines through the thin upper face
  const bl = ctx.createLinearGradient(0, faceTop, 0, cam.yB0 - cam.F0 * 0.3);
  bl.addColorStop(0, `rgba(${pal.sun.c},0.55)`); bl.addColorStop(1, `rgba(${pal.sun.c},0)`);
  ctx.fillStyle = bl; ctx.fillRect(0, faceTop, W, cam.F0 * 0.85);
  // bulges: soft darker and lighter swells running along the face
  for (let j = 0; j < 4; j++) {
    ctx.beginPath(); let first = true;
    for (const c of usable) {
      const y = c.yb - c.fh * (0.22 + 0.17 * j + 0.05 * Math.sin(c.s * 0.07 + j * 2.1 + t * 0.5));
      if (first) { ctx.moveTo(c.x, y); first = false; } else ctx.lineTo(c.x, y);
    }
    ctx.lineWidth = (14 + 6 * j) * cam.sc * 0.9; ctx.strokeStyle = j % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,28,70,0.045)'; ctx.stroke();
  }
  // draw-up streaks along the face
  for (let j = 1; j <= 6; j++) {
    const f = j / 7;
    ctx.beginPath(); let first = true;
    for (const c of usable) {
      const y = c.yb - c.fh * (f + 0.018 * Math.sin(c.s * 0.07 + j * 1.9 + t * 0.5) + 0.01 * Math.sin(c.s * 0.19 + j));
      if (first) { ctx.moveTo(c.x, y); first = false; } else ctx.lineTo(c.x, y);
    }
    ctx.lineWidth = (1.4 + (j % 3)) * cam.sc; ctx.strokeStyle = j % 2 ? 'rgba(255,255,255,0.12)' : 'rgba(0,30,70,0.14)'; ctx.stroke();
  }
  // light shafts slide across the face as the rider moves; small glints sparkle on the streaks
  for (let i = 0; i < 4; i++) {
    const ph = (((i * 97 - r.s * 1.4) % 400) + 400) % 400, x = -60 + ph * (W + 120) / 400;
    const sg2 = ctx.createLinearGradient(x, 0, x + 70 * cam.sc, 0);
    sg2.addColorStop(0, 'rgba(255,255,255,0)'); sg2.addColorStop(0.5, `rgba(${pal.sun.c},0.11)`); sg2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save(); ctx.translate(x, 0); ctx.transform(1, 0, -0.35, 1, 0, 0); ctx.translate(-x, 0);
    ctx.fillStyle = sg2; ctx.fillRect(x, faceTop, 70 * cam.sc, faceBot - faceTop); ctx.restore();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (const c of usable) {
    if (c.sc < 0) continue;
    const n = Math.sin(c.s * 2.9 + 1.7) * Math.sin(c.s * 0.37 + t * 1.3);
    if (n > 0.72) { const y = c.yb - c.fh * (0.25 + 0.55 * ((Math.sin(c.s * 7.1) + 1) / 2)); ctx.globalAlpha = (n - 0.72) * 3; ctx.fillRect(c.x, y, 7 * cam.sc * cam.k(c.u), 2 * cam.sc); }
  }
  ctx.globalAlpha = 1;
  // atmospheric haze toward the far end of the wave
  const hz = ctx.createLinearGradient(W * 0.45, 0, W, 0);
  hz.addColorStop(0, `rgba(${pal.haze},0)`); hz.addColorStop(1, `rgba(${pal.haze},0.5)`);
  ctx.fillStyle = hz; ctx.fillRect(0, faceTop, W, faceBot - faceTop);
  // the shade inside a hollow stretch: one smooth horizontal gradient, not bars
  const x0 = usable.length ? usable[0].x : 0, x1 = W;
  const sg = ctx.createLinearGradient(x0, 0, x1, 0);
  let any = false;
  for (let i = 0; i <= 12; i++) {
    const x = mix(x0, x1, i / 12), u = cam.uOf(x), h = hollowAt(wave, r.s + u), sc = u + r.d;
    const a = 0.5 * h * Math.exp(-Math.max(0, sc - 8) / 40);
    if (a > 0.01) any = true;
    sg.addColorStop(i / 12, `rgba(0,52,86,${(a * 0.7).toFixed(3)})`);
  }
  if (any) { ctx.fillStyle = sg; ctx.fillRect(x0, faceTop, x1 - x0, faceBot - faceTop); }
  ctx.restore();
  // the crest line: a bright, slightly broken line of foam along the top
  ctx.beginPath();
  usable.forEach((c, i) => (i ? ctx.lineTo(c.x, topAt(c)) : ctx.moveTo(c.x, topAt(c))));
  ctx.lineWidth = 7 * cam.sc; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
  ctx.lineWidth = 3 * cam.sc; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.stroke();
  // wind-blown spray off the crest
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (const c of usable) {
    if (c.sc < 2 || c.sc > 110) continue;
    const n = Math.sin(c.s * 1.7 + t * 4.1);
    if (n > 0.5) { ctx.globalAlpha = 0.3 + 0.5 * (n - 0.5); ctx.beginPath(); ctx.arc(c.x, c.top - 8 * cam.sc - (n - 0.5) * 22 * cam.sc, 2.4 * cam.sc * cam.k(c.u), 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

// The whitewater behind the curl, the pitching lip, and the tube mouth when the wave is hollow.
export function drawCurl(ctx, cam, pal, t) {
  const { r, wave, W } = cam;
  const xc = cam.xc, uc = -r.d, kC = cam.k(uc), ybc = cam.yB(uc), fhC = cam.fh(uc);
  const hol = hollowAt(wave, r.s - r.d);
  const sc = cam.sc;
  // 1. the foam mass: a ragged cloud of billows, tall at the curl and settling to the left
  ctx.save();
  const billow = (x, y, rad) => { ctx.moveTo(x + rad, y); ctx.arc(x, y, rad, 0, TAU); };
  const edge = xc - 4 * cam.ppm * kC;     // the foam's right edge hugs the falling lip
  const g = ctx.createLinearGradient(0, ybc - fhC * 0.7, 0, ybc + fhC * 0.3);
  g.addColorStop(0, pal.foam[0]); g.addColorStop(0.5, pal.foam[1]); g.addColorStop(1, pal.foam[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  // the solid body
  ctx.moveTo(-20, cam.yB(cam.uOf(-20)) - foamH(cam, cam.uOf(-20)));
  for (let x = -20; x <= edge; x += 10) { const u = cam.uOf(x); ctx.lineTo(x, cam.yB(u) - foamH(cam, u)); }
  ctx.lineTo(edge, ybc + 10);
  for (let x = edge; x >= -20; x -= 12) { const u = cam.uOf(x); ctx.lineTo(x, Math.min(cam.H + 20, cam.yB(u) + 18 * cam.k(u) * cam.sc)); }
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  // billows along the top and up the curl as a plume (a separate path: overlapping circles must not cancel the body)
  for (let x = -20; x <= edge; x += 22) {
    const u = cam.uOf(x), k = cam.k(u), top = cam.yB(u) - foamH(cam, u), n = wob(r.s + u, t * 0.8);
    billow(x, top + 6 * k * sc + n * 5 * k * sc, (24 + 10 * Math.sin(x * 0.07 + t)) * sc * k);
  }
  for (let y = ybc + 6; y > ybc - fhC * 0.5; y -= 30 * sc * kC) { const n = wob(y * 0.05 + r.s * 0.3, t * 0.9); billow(edge + n * 10 * sc, y, (30 + 6 * n) * sc * kC); }
  const plume = 9;
  for (let i = 0; i < plume; i++) {
    const f = i / (plume - 1), n = wob(i * 1.7 + r.s * 0.2, t * 1.2), n2 = wob(i * 3.3 + 7 + r.s * 0.13, t * 0.9);
    billow(edge - (4 + 26 * f + n * 8) * sc, ybc - fhC * (0.1 + 0.34 * f + 0.05 * n2), (30 - 12 * f + 4 * n2) * sc * kC);
  }
  ctx.fill();
  ctx.clip();
  // shading, texture
  ctx.fillStyle = 'rgba(120,170,200,0.25)';
  ctx.beginPath();
  for (let i = 0; i < 40; i++) {
    const s0 = r.s - r.d - 5 - ((i * 13.3) % 150), u = s0 - r.s, x = cam.X(u);
    if (x < -20 || x > edge) continue;
    const k = cam.k(u), yb = cam.yB(u), hh = foamH(cam, u);
    const ey = yb - hh * (0.1 + 0.8 * ((i * 0.37) % 1)) + Math.sin(t * 1.5 + i) * 3 * k, erx = (16 + (i % 4) * 7) * sc * k;
    ctx.moveTo(x + erx, ey); ctx.ellipse(x, ey, erx, (6 + (i % 3) * 2) * sc * k, 0, 0, TAU);
  }
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  for (let i = 0; i < 60; i++) {
    const s0 = r.s - r.d - 2 - ((i * 7.9) % 150), u = s0 - r.s, x = cam.X(u);
    if (x < -20 || x > edge) continue;
    const k = cam.k(u), yb = cam.yB(u), hh = foamH(cam, u);
    const dy = yb - hh * (0.08 + 0.9 * ((i * 0.618) % 1)) + Math.sin(t * 2 + i * 1.3) * 4 * k, dr = (3 + (i % 4) * 1.6) * sc * k;
    ctx.moveTo(x + dr, dy); ctx.arc(x, dy, dr, 0, TAU);
  }
  ctx.fill();
  ctx.restore();
  // a soft mist where the foam meets the face, so there is no hard seam
  { const mg = ctx.createLinearGradient(edge - 30 * sc, 0, edge + 130 * sc * kC, 0);
    mg.addColorStop(0, 'rgba(255,255,255,0)'); mg.addColorStop(0.25, `rgba(${pal.haze},0.32)`); mg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = mg; ctx.fillRect(edge - 30 * sc, ybc - fhC * 0.75, 160 * sc * kC + 30 * sc, fhC * 0.8 + 40 * sc); }
  // 2. the lip: a crescent of water thrown forward from the crest and hooking down onto the foam; on a hollow wave it is
  // long and deep and the cavity under it is the tube.
  const Dh = fhC * (0.16 + 0.5 * hol), Lh = (2.5 + 9 * hol) * cam.ppm * kC, th = fhC * (0.05 + 0.09 * hol);
  const xp = xc + 1.5 * cam.ppm * kC, yp = ybc - fhC * 0.985;
  const S = [xp + 0.4 * Lh, yp], T = [xp - 0.95 * Lh, yp + Dh];
  const bez = (p0, p1, p2, p3, u) => { const m = 1 - u; return [m * m * m * p0[0] + 3 * m * m * u * p1[0] + 3 * m * u * u * p2[0] + u * u * u * p3[0], m * m * m * p0[1] + 3 * m * m * u * p1[1] + 3 * m * u * u * p2[1] + u * u * u * p3[1]]; };
  const O1 = [xp - 0.25 * Lh, yp - 0.14 * Dh], O2 = [xp - 1.05 * Lh, yp + 0.15 * Dh];
  const S2 = [S[0] + 0.1 * Lh, yp + 0.4 * th], I1 = [xp + 0.05 * Lh, yp + th * 1.4], I2 = [xp - 0.75 * Lh, yp + th * 1.2 + 0.4 * Dh];
  ctx.save();
  if (hol > 0.04) {
    // the cavity under the lip: a soft dark ellipse centred just ahead of the curl
    ctx.save();
    const ccx = xc + 8 * cam.ppm * kC, ccy = ybc - fhC * 0.4, crx = (6 + 7 * hol) * cam.ppm * kC, cry = fhC * 0.5;
    ctx.translate(ccx, ccy); ctx.scale(1, cry / crx);
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, crx);
    cg.addColorStop(0, `rgba(2,30,60,${(0.62 * hol).toFixed(3)})`); cg.addColorStop(0.55, `rgba(4,50,86,${(0.4 * hol).toFixed(3)})`); cg.addColorStop(1, 'rgba(6,70,104,0)');
    ctx.fillStyle = cg; ctx.fillRect(-crx, -crx, 2 * crx, 2 * crx);
    ctx.restore();
    const lx = S2[0] - 0.15 * Lh, ly = yp + Dh * 0.7;
    const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, Lh * 0.5);
    lg.addColorStop(0, `rgba(255,255,225,${(0.5 * hol).toFixed(3)})`); lg.addColorStop(1, 'rgba(255,255,225,0)');
    ctx.fillStyle = lg; ctx.fillRect(lx - Lh * 0.5, ly - Lh * 0.5, Lh, Lh);
  }
  // the crescent
  ctx.beginPath();
  ctx.moveTo(S[0], S[1]);
  for (let i = 1; i <= 20; i++) { const p = bez(S, O1, O2, T, i / 20); ctx.lineTo(p[0], p[1]); }
  for (let i = 1; i <= 20; i++) { const p = bez(T, I2, I1, S2, i / 20); ctx.lineTo(p[0], p[1]); }
  ctx.closePath();
  const lgp = ctx.createLinearGradient(0, yp - th, 0, yp + Dh);
  lgp.addColorStop(0, pal.face[0]); lgp.addColorStop(0.5, pal.face[1]); lgp.addColorStop(1, pal.face[2]);
  ctx.fillStyle = lgp; ctx.fill();
  ctx.beginPath(); ctx.moveTo(S[0], S[1]);
  for (let i = 1; i <= 20; i++) { const p = bez(S, O1, O2, T, i / 20); ctx.lineTo(p[0], p[1]); }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.lineWidth = 6 * sc; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.stroke();
  ctx.lineWidth = 3 * sc; ctx.strokeStyle = 'rgba(255,255,255,0.97)'; ctx.stroke();
  ctx.restore();
  // the lip lands on the foam: a burst of white at the tip
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 7; i++) { const n = wob(i * 2.1 + r.s * 0.1, t * 1.5); ctx.beginPath(); ctx.arc(T[0] + n * 10 * sc, T[1] + 10 * sc + i * 5 * sc * kC, (16 - i) * sc * kC * (0.8 + 0.2 * Math.sin(t * 3 + i)), 0, TAU); ctx.fill(); }
  // 3. spray where the lip lands
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 18; i++) {
    const ph = (t * 1.3 + i * 0.37) % 1, ang = -Math.PI * (0.1 + 0.8 * ((i * 0.618) % 1));
    const px = edge - 20 * sc + Math.cos(ang) * ph * 60 * sc * kC, py = ybc - fhC * 0.4 + Math.sin(ang) * ph * 90 * sc * kC + ph * ph * 50 * sc;
    ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.arc(px, py, (2 + (i % 3)) * sc * kC, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  void W;
}

// ---- gates, line and bursts --------------------------------------------------------------------------------------------------
export function drawLine(ctx, cam, pal, t, show) {
  const { r, wave } = cam;
  const gates = wave.gates;
  // the line: a dotted curve through the next gates
  ctx.save();
  const pts = [];
  for (let u = -4; u <= 95; u += 3) {
    const s = r.s + u;
    const y = lineAt(wave, s), x = cam.X(u);
    pts.push([x, cam.yB(u) - y * cam.fh(u), u]);
  }
  ctx.lineCap = 'round';
  ctx.setLineDash([2, 12 * cam.sc]);
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.lineWidth = 4 * cam.sc; ctx.strokeStyle = show ? 'rgba(255,230,120,0.95)' : 'rgba(255,255,255,0.4)'; ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  // the gates
  for (let i = Math.max(0, r.gi - 1); i < gates.length; i++) {
    const g = gates[i], u = g.s - r.s;
    if (u > 100) break;
    if (u < -6) continue;
    const x = cam.X(u), k = cam.k(u), y = cam.yB(u) - g.y * cam.fh(u);
    const next = i === r.gi;
    const rad = (g.lip ? 20 : 13) * cam.sc * k * (next ? 1.15 + 0.12 * Math.sin(t * 8) : 1);
    ctx.save();
    ctx.globalAlpha = clamp(1 - Math.max(0, u - 60) / 40, 0.2, 1);
    const gg = ctx.createRadialGradient(x, y, 0, x, y, rad * 2);
    gg.addColorStop(0, g.lip ? 'rgba(255,220,120,0.95)' : 'rgba(255,255,255,0.95)'); gg.addColorStop(0.35, g.lip ? 'rgba(255,190,60,0.55)' : 'rgba(180,255,240,0.5)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, rad * 2, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(1.5, 3 * cam.sc * k); ctx.strokeStyle = g.lip ? '#ffd24a' : '#ffffff';
    if (g.lip) {
      ctx.beginPath();
      for (let a = 0; a < 8; a++) { const rr = a % 2 ? rad * 0.5 : rad; const an = a * Math.PI / 4 + t * 1.5; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
      ctx.closePath(); ctx.fillStyle = 'rgba(255,214,90,0.9)'; ctx.fill(); ctx.stroke();
    } else { ctx.beginPath(); ctx.arc(x, y, rad * 0.55, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
}

export function drawBursts(ctx, cam, pal, t) {
  const { r, wave } = cam;
  const blob = (x, y, rad, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill(); };
  // a lit billow: bright core, foam-coloured body, soft transparent rim (no hard clip-art edge)
  const puff = (x, y, rad, a = 1) => {
    const g2 = ctx.createRadialGradient(x - rad * 0.2, y - rad * 0.3, rad * 0.05, x, y, rad);
    g2.addColorStop(0, `rgba(255,255,255,${a})`); g2.addColorStop(0.55, `rgba(240,250,252,${0.95 * a})`); g2.addColorStop(0.85, `rgba(168,200,214,${0.7 * a})`); g2.addColorStop(1, 'rgba(150,190,210,0)');
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
  };
  for (const b of wave.bursts) {
    const u0 = b.s - r.s;
    if (u0 > 130 || u0 + b.w * 0.6 < -r.d) continue;
    const xm = cam.X(u0), k = cam.k(u0), yb = cam.yB(u0), fh = cam.fh(u0);
    const yE = yb - b.e * fh, bw = Math.max(60 * cam.sc * k, b.w * cam.ppm * k * 1.7);
    const warn = u0 > 8 ? smooth(130, 40, u0) : 0;
    ctx.save();
    if (u0 > 4) {
      // a warning: the water boils and spray lifts before it breaks
      ctx.fillStyle = `rgba(255,255,255,${0.18 + 0.5 * warn})`;
      const yy = b.kind === 'low' ? yb - fh * 0.04 : yb - fh;
      for (let i = 0; i < 7; i++) {
        const ph = (t * 0.9 + i * 0.27) % 1;
        ctx.globalAlpha = (1 - ph) * (0.35 + 0.65 * warn);
        ctx.beginPath(); ctx.arc(xm + (((i * 0.37) % 1) - 0.5) * bw, yy + (b.kind === 'low' ? -ph * fh * 0.3 : ph * fh * 0.3), (3 + (i % 3) * 2) * cam.sc * k, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (u0 < 75) {
      const grow = smooth(75, 24, Math.max(0, u0));
      const g = ctx.createLinearGradient(0, yb - fh, 0, yb);
      g.addColorStop(0, pal.foam[0]); g.addColorStop(0.6, pal.foam[1]); g.addColorStop(1, pal.foam[2]);
      if (b.kind === 'low') {
        const h = (yb - yE) * (0.3 + 0.7 * grow);
        const n = 34;
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 0; i < n; i++) {
            const f = i / (n - 1), wz = wob(i * 1.9 + b.s, t * 0.6), hz = ((Math.sin(i * 12.9898 + b.s) * 43758.5453) % 1 + 1) % 1;
            // a rounded mound: wide at the water, rising to a few big billows, ragged edges
            const spread = bw * 0.55 * (1 - 0.3 * f) * (hz * 2 - 1);
            const rad = bw * (0.5 - 0.14 * f) * (0.8 + 0.3 * hz + 0.06 * wz) * (pass ? 0.88 : 1);
            const yy = yb - h * Math.pow(f, 0.9) * 0.95 + (pass ? -rad * 0.14 : 0);
            if (pass) puff(xm + spread + wz * bw * 0.04, yy, rad); else blob(xm + spread, yy + rad * 0.12, rad, 'rgba(70,120,160,0.35)');
          }
        }
        for (let i = 0; i < 6; i++) { const ph = (t * 1.2 + i * 0.31) % 1; ctx.globalAlpha = 1 - ph; blob(xm + (((i * 0.43) % 1) - 0.5) * bw * 1.2, yb - h - ph * 40 * cam.sc * k, (4 + i % 3 * 2) * cam.sc * k, '#fff'); }
        ctx.globalAlpha = 1;
      } else {
        const h = (yE - (yb - fh)) * (0.35 + 0.65 * grow);
        const top = yb - fh;
        // the curtain: a line of billows on the crest with long falling streaks below
        for (let i = 0; i < 6; i++) { const wz = wob(i * 2.3 + b.s, t * 0.7); puff(xm + (i / 5 - 0.5) * bw * 1.1, top + 4 * cam.sc + wz * 4, bw * 0.2 * (1 + 0.15 * wz)); }
        for (let i = 0; i < 9; i++) {
          const fx = xm + (i / 8 - 0.5) * bw, ph = (t * 0.8 + i * 0.173) % 1;
          ctx.fillStyle = g; ctx.globalAlpha = 0.95 - 0.5 * (i % 2) * 0.5;
          ctx.beginPath(); ctx.ellipse(fx, top + h * 0.5, bw * 0.075, h * (0.5 + 0.12 * ((i * 0.37) % 1)), 0, 0, TAU); ctx.fill();
          ctx.globalAlpha = 1; blob(fx, top + h * (0.2 + 0.8 * ph), (4 + (i % 3)) * cam.sc * k, '#fff');
        }
        puff(xm, top + h, bw * 0.38);
      }
    }
    ctx.restore();
  }
}

// ---- particles ---------------------------------------------------------------------------------------------------------------
export function drawFx(ctx, cam, fx) {
  for (const p of fx) {
    const u = p.s - cam.r.s, x = cam.X(u), k = cam.k(u);
    if (x < -20 || x > cam.W + 20) continue;
    const y = cam.yB(u) - p.fy * cam.fh(u);
    const a = clamp(1 - p.t / p.life, 0, 1);
    ctx.globalAlpha = a * 0.9;
    ctx.fillStyle = p.col || '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, p.r * cam.sc * k * (0.6 + 0.6 * a), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---- the wake: a fading carve line on the face behind the rider -----------------------------------------------------------------
export function drawTrail(ctx, cam, trail) {
  if (trail.length < 3) return;
  ctx.save();
  ctx.lineCap = 'round';
  // older points fade and thin out, so the carve looks like a wake on the face
  let prev = null;
  trail.forEach((p, i) => {
    const u = p.s - cam.r.s, x = cam.X(u), y = cam.yB(u) - p.y * cam.fh(u);
    if (prev && x > -10) {
      const k = (i + 1) / trail.length;
      ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(x, y);
      ctx.lineWidth = (3 + 9 * k) * cam.sc; ctx.strokeStyle = `rgba(255,255,255,${(0.1 + 0.3 * k).toFixed(3)})`; ctx.stroke();
      ctx.lineWidth = (1.5 + 3 * k) * cam.sc; ctx.strokeStyle = `rgba(255,255,255,${(0.2 + 0.6 * k).toFixed(3)})`; ctx.stroke();
    }
    prev = [x, y];
  });
  ctx.restore();
}

// foreground water under the wave
export function drawForeground(ctx, cam, pal, t) {
  const { W, H, yB0 } = cam;
  const g = ctx.createLinearGradient(0, yB0 - 4, 0, H);
  g.addColorStop(0, pal.face[3]); g.addColorStop(1, pal.deep);
  // the base of the wave runs along yB(u): draw the channel as everything below it
  ctx.beginPath();
  ctx.moveTo(-10, H + 10);
  for (let x = -10; x <= W + 10; x += 12) ctx.lineTo(x, cam.yB(cam.uOf(x)) + 2);
  ctx.lineTo(W + 10, H + 10); ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 2 * cam.sc;
  for (let j = 0; j < 5; j++) {
    ctx.beginPath();
    for (let x = -10; x <= W + 10; x += 16) {
      const u = cam.uOf(x), s = cam.r.s + u;
      const y = yB0 + (j + 1) * (H - yB0) / 6 + Math.sin(s * 0.16 + j * 2 + t * 1.3) * 3 * cam.sc;
      if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ---- the rider -----------------------------------------------------------------------------------------------------------------
// pose: { crouch 0..1, lean -1..1, yaw degrees (spin), pitch (board angle, radians), mode: 'ride'|'paddle'|'wipe'|'air', t, arms }
const SKIN = ['#d9a07a', '#b97b55', '#7a4a30'];
const lerpPt = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
// two-bone IK: from p0 reach p1 with bone lengths l1, l2; bend = +1 / -1 picks the side of the knee/elbow
function ik(p0, p1, l1, l2, bend) {
  let dx = p1[0] - p0[0], dy = p1[1] - p0[1], d = Math.hypot(dx, dy);
  const dm = Math.min(d, l1 + l2 - 0.001);
  const a = Math.acos(clamp((l1 * l1 + dm * dm - l2 * l2) / (2 * l1 * dm), -1, 1));
  const base = Math.atan2(dy, dx) + bend * a;
  return [p0[0] + Math.cos(base) * l1, p0[1] + Math.sin(base) * l1];
}
function limb(ctx, pts, w, col, edge) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  if (edge) { ctx.lineWidth = w + 2.5; ctx.strokeStyle = edge; ctx.stroke(); }
  ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke();
}

export function drawBoard(ctx, len, th, col, spec = true) {
  // origin at the board's centre, nose to +x
  const g = ctx.createLinearGradient(0, -th, 0, th);
  g.addColorStop(0, col[0]); g.addColorStop(0.55, col[1]); g.addColorStop(1, col[2]);
  ctx.beginPath();
  ctx.moveTo(-len / 2, 0);
  ctx.bezierCurveTo(-len * 0.34, -th * 1.1, len * 0.3, -th * 1.15, len / 2, -th * 0.2);
  ctx.bezierCurveTo(len * 0.32, th * 0.95, -len * 0.3, th * 1.0, -len / 2, 0);
  ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.8; ctx.strokeStyle = 'rgba(8,24,48,0.55)'; ctx.stroke();
  if (spec) {
    ctx.beginPath(); ctx.moveTo(-len * 0.4, -th * 0.2); ctx.quadraticCurveTo(0, -th * 0.55, len * 0.42, -th * 0.12);
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-len * 0.08, -th * 0.9, len * 0.1, th * 1.6);
  }
}

// x, y = feet on the board. size = standing height in px.
export function drawRider(ctx, x, y, size, pose, boardIdx, t) {
  const L = size, mode = pose.mode || 'ride';
  const bc = BOARDS[boardIdx] ? BOARDS[boardIdx].col : BOARDS[0].col;
  if (globalThis.__rider3d) {
    // real 3D surfer (view3d): see view3d/rider.js; `pending` draws nothing while the module loads, a failure falls back to the 2D figure below
    const R3 = globalThis.__rider3d;
    if (R3.pending) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-(pose.pitch || 0));
    const okk = R3.draw(ctx, 0, 0, L, pose, boardIdx, t, bc);
    ctx.restore();
    if (okk) return;
  }
  const blen = L * (boardIdx === 0 ? 1.25 : boardIdx === 2 ? 0.88 : boardIdx === 3 ? 1.12 : 1.0), bth = L * 0.045;
  ctx.save();
  ctx.translate(x, y);
  if (mode === 'wipe') {
    const w = pose.t;
    // tumbling: the body spins and sinks, the board floats off
    ctx.save();
    ctx.translate(w * L * 0.9, -L * 0.45 * Math.sin(Math.min(1, w * 1.4) * Math.PI) + w * L * 0.35);
    ctx.rotate(w * 6.5);
    wipeBody(ctx, L, w, t);
    ctx.restore();
    ctx.save(); ctx.translate(-w * L * 0.6, -L * 0.2 * Math.sin(Math.min(1, w * 1.2) * Math.PI)); ctx.rotate(-w * 2.6 + 0.4); drawBoard(ctx, blen, bth, bc); ctx.restore();
    ctx.restore(); return;
  }
  // yaw: a spin is seen side-on, so the figure narrows to a sliver and comes back facing the other way
  const yaw = (pose.yaw || 0) * Math.PI / 180;
  const sx = Math.cos(yaw);
  const sgn = sx < 0 ? -1 : 1;
  ctx.scale(Math.max(0.12, Math.abs(sx)) * sgn, 1);
  ctx.rotate(-(pose.pitch || 0));
  if (mode === 'paddle') { paddler(ctx, L, blen, bth, bc, pose, t); ctx.restore(); return; }
  // ---- standing on the board
  const crouch = clamp(pose.crouch ?? 0.4, 0, 1), lean = clamp(pose.lean ?? 0, -1, 1);
  drawBoard(ctx, blen, bth, bc);
  const fy = -bth * 0.8;                                  // feet sit on the deck
  const footF = [L * 0.17, fy], footB = [-L * 0.16, fy];
  const hipH = L * (0.44 - crouch * 0.15);
  const hip = [L * (-0.01 + lean * 0.03 + crouch * 0.03), fy - hipH];
  const torsoLen = L * 0.3, torsoAng = (-84 + crouch * 30 + lean * 8) * Math.PI / 180;   // from +x, going up
  const sh = [hip[0] + Math.cos(torsoAng) * torsoLen, hip[1] + Math.sin(torsoAng) * torsoLen];
  const neck = [sh[0] + Math.cos(torsoAng + 0.25) * L * 0.045, sh[1] + Math.sin(torsoAng + 0.25) * L * 0.045];
  const headC = [neck[0] + Math.cos(torsoAng + 0.3) * L * 0.07, neck[1] + Math.sin(torsoAng + 0.3) * L * 0.07];
  const th = L * 0.265;
  const kF = ik(hip, footF, th, th, 1), kB = ik(hip, footB, th, th, 1);
  const swing = (pose.arms ?? 0);
  const handF = [sh[0] + L * (0.26 + 0.06 * swing), sh[1] + L * (0.12 - 0.12 * swing)];
  const handB = [sh[0] - L * (0.22 + 0.05 * swing), sh[1] + L * (0.1 + 0.1 * swing)];
  const eF = ik(sh, handF, L * 0.15, L * 0.14, -1), eB = ik(sh, handB, L * 0.15, L * 0.14, 1);
  const skin = SKIN[0], skinD = SKIN[1], suit = pose.suit || '#1c3b66', trunk = '#e5603f', trunkD = '#b8442b';
  const seg = (a2, b2, wa, wb, col) => {
    const dx = b2[0] - a2[0], dy = b2[1] - a2[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(a2[0], a2[1], wa, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(b2[0], b2[1], wb, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(a2[0] + nx * wa, a2[1] + ny * wa); ctx.lineTo(b2[0] + nx * wb, b2[1] + ny * wb); ctx.lineTo(b2[0] - nx * wb, b2[1] - ny * wb); ctx.lineTo(a2[0] - nx * wa, a2[1] - ny * wa); ctx.closePath(); ctx.fill();
  };
  const E = 'rgba(30,14,6,0.35)';
  // the far arm and far leg, a shade darker
  seg(sh, eB, L * 0.034, L * 0.027, skinD, E); seg(eB, handB, L * 0.027, L * 0.02, skinD, E);
  seg(hip, kB, L * 0.062, L * 0.043, skinD, E); seg(kB, footB, L * 0.042, L * 0.026, skinD, E);
  seg(footB, [footB[0] + L * 0.075, footB[1] - 1], L * 0.024, L * 0.016, skinD);
  seg(hip, lerpPt(hip, kB, 0.5), L * 0.074, L * 0.058, trunkD);
  // torso: a wetsuit vest, wider at the chest than the waist
  const mid = lerpPt(hip, sh, 0.5);
  seg(hip, mid, L * 0.072, L * 0.062, '#122a50');
  seg(mid, sh, L * 0.062, L * 0.078, suit, 'rgba(8,20,48,0.5)');
  seg(hip, lerpPt(hip, sh, 0.18), L * 0.074, L * 0.07, trunk);
  // near leg
  seg(hip, kF, L * 0.068, L * 0.046, skin, E); seg(kF, footF, L * 0.046, L * 0.028, skin, E);
  seg(footF, [footF[0] + L * 0.08, footF[1] - 1], L * 0.026, L * 0.017, skin, E);
  seg(hip, lerpPt(hip, kF, 0.52), L * 0.082, L * 0.062, trunk);
  // neck and head: a profile with a nose and jaw, dark hair that streams back
  seg(sh, neck, L * 0.032, L * 0.028, skin);
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.ellipse(headC[0], headC[1], L * 0.058, L * 0.066, 0.1, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(headC[0] + L * 0.05, headC[1] - L * 0.012); ctx.lineTo(headC[0] + L * 0.083, headC[1] + L * 0.012); ctx.lineTo(headC[0] + L * 0.05, headC[1] + L * 0.02); ctx.closePath(); ctx.fill();
  ctx.fillStyle = skinD; ctx.beginPath(); ctx.ellipse(headC[0] - L * 0.012, headC[1] + L * 0.004, L * 0.012, L * 0.02, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#23140e';
  ctx.beginPath(); ctx.ellipse(headC[0] - L * 0.012, headC[1] - L * 0.026, L * 0.064, L * 0.05, -0.15, Math.PI * 0.92, Math.PI * 2.15); ctx.fill();
  const wv = Math.sin(t * 9) * L * 0.012;
  ctx.beginPath(); ctx.moveTo(headC[0] - L * 0.04, headC[1] - L * 0.04);
  ctx.quadraticCurveTo(headC[0] - L * 0.12, headC[1] - L * 0.05 + wv, headC[0] - L * 0.18, headC[1] + L * 0.01 + wv);
  ctx.quadraticCurveTo(headC[0] - L * 0.11, headC[1] - L * 0.0, headC[0] - L * 0.05, headC[1] + L * 0.02); ctx.fill();
  ctx.fillStyle = '#23140e'; ctx.beginPath(); ctx.arc(headC[0] + L * 0.035, headC[1] - L * 0.008, L * 0.0075, 0, TAU); ctx.fill();
  // near arm
  seg(sh, eF, L * 0.04, L * 0.031, skin, E); seg(eF, handF, L * 0.031, L * 0.023, skin, E);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(handF[0], handF[1], L * 0.028, 0, TAU); ctx.fill();
  ctx.fillStyle = skinD; ctx.beginPath(); ctx.arc(handB[0], handB[1], L * 0.024, 0, TAU); ctx.fill();
  ctx.restore();
}

function paddler(ctx, L, blen, bth, bc, pose, t) {
  drawBoard(ctx, blen * 1.05, bth, bc);
  const stroke = Math.sin((pose.stroke ?? t) * 9);
  const back = [-L * 0.22, -bth * 1.4], chest = [L * 0.12, -bth * 1.6];
  const head = [L * 0.32, -bth * 1.4 - L * 0.1];
  const skin = SKIN[0], skinD = SKIN[1];
  ctx.lineCap = 'round';
  limb(ctx, [back, [-L * 0.46, -bth * 1.4 - L * 0.01 * stroke], [-L * 0.62, -bth * 1.4 + L * 0.02 * stroke]], L * 0.07, skinD);
  limb(ctx, [back, chest], L * 0.15, '#1c3b66', '#0d2244');
  limb(ctx, [lerpPt(back, chest, 0.1), lerpPt(back, chest, 0.4)], L * 0.14, '#e5603f');
  const a1 = [L * 0.18 + stroke * L * 0.1, -bth * 1.2 + Math.max(0, stroke) * L * 0.2];
  const a2 = [L * 0.18 - stroke * L * 0.1, -bth * 1.2 + Math.max(0, -stroke) * L * 0.2];
  limb(ctx, [[L * 0.1, -bth * 2.5], [L * 0.28, -bth * 1.4 + L * 0.08], a2], L * 0.055, skinD);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(head[0], head[1], L * 0.06, L * 0.065, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a1a12'; ctx.beginPath(); ctx.ellipse(head[0] - L * 0.02, head[1] - L * 0.02, L * 0.064, L * 0.055, -0.2, Math.PI, TAU * 1.05); ctx.fill();
  limb(ctx, [[L * 0.12, -bth * 2.5], [L * 0.3, -bth * 1.5 + L * 0.1], a1], L * 0.058, skin, 'rgba(30,14,6,0.4)');
}
function wipeBody(ctx, L, w, t) {
  const f = Math.sin(t * 14);
  limb(ctx, [[0, 0], [L * 0.14, -L * 0.1 * f], [L * 0.28, L * 0.04]], L * 0.06, SKIN[1]);
  limb(ctx, [[0, 0], [-L * 0.14, L * 0.1 * f], [-L * 0.26, -L * 0.05]], L * 0.07, SKIN[1]);
  limb(ctx, [[-L * 0.08, 0], [L * 0.12, 0]], L * 0.15, '#1c3b66', '#0d2244');
  limb(ctx, [[-L * 0.1, 0], [-L * 0.03, 0]], L * 0.14, '#e5603f');
  limb(ctx, [[0.1 * L, 0], [L * 0.2, -L * 0.2 * f], [L * 0.3, -L * 0.1]], L * 0.055, SKIN[0]);
  ctx.fillStyle = SKIN[0]; ctx.beginPath(); ctx.arc(L * 0.2, 0, L * 0.065, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a1a12'; ctx.beginPath(); ctx.arc(L * 0.19, -L * 0.02, L * 0.06, Math.PI, TAU * 1.0); ctx.fill();
}

export { BEACHES };

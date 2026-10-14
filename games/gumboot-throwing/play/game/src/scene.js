// The throwing field seen from the side, drawn with plain canvas paths: sky, hills, a farm, tents with bunting, a crowd along the lane,
// distance boards, the mat, the thrower, the boot, the trail and the landing. Drawing only: it reads the throw state and never changes it.
// Everything that "varies" comes from fixed hashes of an index, never from a random call, so a given frame always looks the same.
import { PIVOT_Y, ARM_R, LINE_X, BOOTS } from './consts.js';
import { GL } from './glbridge.js';

const TAU = Math.PI * 2;
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hex = (c) => (c[0] === '#' ? [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)] : c.match(/\d+/g).slice(0, 3).map(Number));
export const shade = (col, k) => { const [r, g, b] = hex(col); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(r)},${f(g)},${f(b)})`; };

// One look per time of day. g = grass pair, far = hill pair, tent = marquee colour.
export const SKIES = [
  { name: 'morning mist', top: '#7fb6e8', bot: '#eef6ee', sun: '#fff1c8', sunA: 0.8, g1: '#6aa63e', g2: '#5f9a38', far: ['#a6c3b4', '#8fb09b'], tree: '#4f8a4a', crowd: 1, night: 0 },
  { name: 'bright noon', top: '#2f93e6', bot: '#c6e8ff', sun: '#ffffff', sunA: 0.7, g1: '#5ea838', g2: '#529a2f', far: ['#8fb7c9', '#78a79a'], tree: '#3f7f3a', crowd: 1, night: 0 },
  { name: 'golden afternoon', top: '#5a8fd6', bot: '#ffe0a8', sun: '#ffe7a8', sunA: 1, g1: '#7aa83a', g2: '#6c9a32', far: ['#b3aebf', '#9aa98f'], tree: '#587f33', crowd: 1, night: 0 },
  { name: 'sunset', top: '#3b4a86', bot: '#ff9a6a', sun: '#ffc07a', sunA: 1, g1: '#5f8c3c', g2: '#537e34', far: ['#7a6f9a', '#66768a'], tree: '#3d6a3a', crowd: 0.92, night: 0.15 },
  { name: 'floodlit evening', top: '#0e1840', bot: '#2e3e80', sun: '#dfe8ff', sunA: 0.5, g1: '#3f7a3c', g2: '#366e35', far: ['#27346a', '#202b58'], tree: '#1f4a35', crowd: 0.82, night: 0.7 },
];
const CLOTH = ['#d6453d', '#2f6fb6', '#f2c14e', '#3a9b8e', '#e98aa5', '#f4efe3', '#7a56b8', '#e8863a', '#3a4252', '#8cbf4a'];
const SKIN = ['#f1c9a5', '#d8a074', '#b97a4f', '#8a5634', '#e5b48c'];
const HAIR = ['#1d1410', '#3a2314', '#5a3a1e', '#8a6a3a', '#c9b48a', '#2a2a2e', '#6e6e72'];
const BUNT = ['#d6453d', '#f2c14e', '#2f6fb6', '#f4efe3', '#3a9b8e', '#e98aa5'];

export function makeCam(W, H, L) {
  const land = W > H;
  const S0 = land ? clamp(H * 0.17, 70, 124) : clamp(W * 0.25, 70, 190);
  const gy = L && land ? Math.round(L.strip.y - 34) : Math.round(H * (L ? 0.64 : land ? 0.6 : 0.62));
  return { W, H, land, gy, S0 };
}

// Where the camera is for a throw state (pure function of the state): resting on the mat, or following the boot out to the landing.
export function viewFor(c, s) {
  let S = c.S0, camX = c.land ? 2.4 : 1.3;
  if (s && (s.phase === 'flight' || s.phase === 'landed')) {
    // follow the boot: the zoom eases out with the height reached, the boot sits a little right of centre
    const my = Math.max(0, s.maxY), bx = s.phase === 'landed' ? s.landX : (s.b ? s.b.x : 0);
    S = Math.max(14, Math.min(c.S0, (c.gy - 120) / (my + 3), c.W * 0.09));
    camX = Math.max(camX, bx - 0.16 * c.W / S);
  }
  return { S, camX };
}
// An optional renderer for the thrower, installed by main.js (a real 3D person drawn into this 2D layer). It returns null when it cannot draw
// (no WebGL, context lost), in which case the drawn figure below is used.
let personRenderer = null;
export const setPersonRenderer = (fn) => { personRenderer = fn; };
const lerpView = (a, b, e) => ({ S: Math.exp(mix(Math.log(a.S), Math.log(b.S), e)), camX: mix(a.camX, b.camX, e) });

// ---- the boot --------------------------------------------------------------------------------------------------------------------------
// Local units are metres, origin at the middle of the top rim, y UP (the caller flips), toe towards +x.
export function drawBoot(ctx, x, y, px, angle, boot, alpha = 1) {
  const b = typeof boot === 'object' ? boot : (BOOTS[boot] || BOOTS[0]);
  ctx.save(); ctx.translate(x, y); ctx.rotate(-angle); ctx.scale(px, -px); ctx.globalAlpha *= alpha;
  const path = () => {
    ctx.beginPath(); ctx.moveTo(-0.082, 0); ctx.lineTo(0.082, 0); ctx.lineTo(0.088, -0.22);
    ctx.quadraticCurveTo(0.125, -0.275, 0.2, -0.29); ctx.quadraticCurveTo(0.318, -0.3, 0.318, -0.36);
    ctx.lineTo(0.318, -0.4); ctx.lineTo(-0.105, -0.4); ctx.lineTo(-0.112, -0.34); ctx.quadraticCurveTo(-0.1, -0.27, -0.088, -0.2); ctx.closePath();
  };
  const g = ctx.createLinearGradient(-0.11, 0, 0.12, 0); g.addColorStop(0, shade(b.col, 0.78)); g.addColorStop(0.4, shade(b.col, 1.18)); g.addColorStop(1, shade(b.col, 0.7));
  path(); ctx.fillStyle = g; ctx.fill();
  ctx.save(); path(); ctx.clip();
  ctx.fillStyle = b.sole; ctx.fillRect(-0.2, -0.4, 0.6, 0.07);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-0.09, 0, 0.18, -0.045);
  ctx.fillStyle = 'rgba(255,255,255,0.32)'; ctx.fillRect(-0.045, -0.06, 0.03, -0.17);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0.06, -0.05, 0.05, -0.3);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 0; k < 6; k++) ctx.fillRect(-0.1 + k * 0.07, -0.4, 0.028, 0.035);
  ctx.restore();
  path(); ctx.lineWidth = 0.014; ctx.strokeStyle = 'rgba(10,14,12,0.78)'; ctx.stroke();
  ctx.restore();
}

// ---- people --------------------------------------------------------------------------------------------------------------------------------
function spectator(ctx, x, y, sc, i, t, cheer, dim) {
  // standing spectator, y = feet; sc = pixels per metre of the layer
  const cl = CLOTH[(i * 7 + 3) % CLOTH.length], sk = SKIN[(i * 5 + 1) % SKIN.length], hr = HAIR[(i * 3 + 2) % HAIR.length];
  const kid = i % 5 === 0, hgt = (kid ? 1.15 : 1.62 + hash(i + 7) * 0.2) * sc, w = (kid ? 0.3 : 0.4) * sc;
  const bob = cheer ? Math.abs(Math.sin(t * 7 + i * 1.7)) * 0.1 * sc : 0;
  ctx.globalAlpha = dim;
  ctx.fillStyle = shade(cl, 0.8); ctx.fillRect(x - w * 0.32, y - hgt * 0.42 - bob, w * 0.26, hgt * 0.42); ctx.fillRect(x + w * 0.06, y - hgt * 0.42 - bob, w * 0.26, hgt * 0.42);
  ctx.fillStyle = cl; ctx.beginPath(); ctx.roundRect(x - w / 2, y - hgt * 0.84 - bob, w, hgt * 0.5, w * 0.3); ctx.fill();
  ctx.fillStyle = sk; ctx.beginPath(); ctx.arc(x, y - hgt * 0.92 - bob, Math.max(1.5, hgt * 0.095), 0, TAU); ctx.fill();
  if (i % 3 !== 1) { ctx.fillStyle = hr; ctx.beginPath(); ctx.arc(x, y - hgt * 0.95 - bob, hgt * 0.1, Math.PI, TAU); ctx.fill(); }
  else { ctx.fillStyle = CLOTH[(i * 11) % CLOTH.length]; ctx.fillRect(x - hgt * 0.12, y - hgt * 0.99 - bob, hgt * 0.24, hgt * 0.05); }
  if (cheer && i % 2 === 0 && sc > 12) {
    ctx.strokeStyle = sk; ctx.lineWidth = Math.max(1.5, 0.09 * sc); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + w * 0.45, y - hgt * 0.78 - bob); ctx.lineTo(x + w * 0.8, y - hgt * 1.18 - bob - Math.abs(Math.sin(t * 8 + i)) * 0.12 * sc); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function limb(ctx, pts, w, col, dark) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = dark; ctx.lineWidth = w + 3; ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
}

// The thrower: feet at world x = 0 on the mat, facing +x, in jeans, a red check wool shirt, a beanie and gumboots. phi is the angle of the
// swinging arm (0 = hanging straight down). Returns the hand position in metres.
function thrower(ctx, sx, sy, S, phi, held, boot, t, cheer, pose) {
  const P = (x, y) => [sx + x * S, sy - y * S];
  const lean = Math.sin(phi) * 0.16 + (pose === 'swing' ? 0.06 : 0);
  const crouch = 0.04 + 0.035 * Math.abs(Math.sin(phi));
  const hip = [-0.04 - lean * 0.25, 0.86 - crouch], sh = [hip[0] + 0.02 + lean * 0.6, hip[1] + 0.52], neck = [sh[0] + 0.04, sh[1] + 0.1];
  const skin = '#e4b48a', jeans = '#33507a', dark = 'rgba(14,16,22,0.82)', red = '#b3261e';
  const fKnee = [0.17, 0.46 - crouch * 0.5], bKnee = [-0.24, 0.47 - crouch * 0.5];
  const fAnk = [0.3, 0.42], bAnk = [-0.3, 0.42];
  const ground = (x) => { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(...P(x, 0), 0.34 * S, 0.06 * S, 0, 0, TAU); ctx.fill(); };
  ground(-0.02);
  // back leg and boot
  limb(ctx, [P(...hip), P(...bKnee), P(...bAnk)], 0.17 * S, shade(jeans, 0.8), dark);
  drawBoot(ctx, ...P(bAnk[0] - 0.02, 0.42), S, 0, boot);
  // far arm
  const hand = (r, ph) => [sh[0] + r * Math.sin(ph), sh[1] - r * Math.cos(ph)];
  const farH = hand(0.62, phi - 0.5);
  limb(ctx, [P(...sh), P(...hand(0.32, phi - 0.4)), P(...farH)], 0.1 * S, shade(red, 0.7), dark);
  // torso: a tapered shape with a check pattern
  const hw = 0.15, sw = 0.19, ang = Math.atan2(sh[0] - hip[0], sh[1] - hip[1]);
  const nx = Math.cos(ang), ny = -Math.sin(ang);
  const q = [[hip[0] - nx * hw, hip[1] - ny * hw], [hip[0] + nx * hw, hip[1] + ny * hw], [sh[0] + nx * sw, sh[1] + ny * sw], [sh[0] - nx * sw, sh[1] - ny * sw]];
  ctx.save();
  ctx.beginPath(); q.forEach((p, k) => (k ? ctx.lineTo(...P(...p)) : ctx.moveTo(...P(...p)))); ctx.closePath();
  const tg = ctx.createLinearGradient(...P(sh[0] - 0.2, 1), ...P(sh[0] + 0.2, 1)); tg.addColorStop(0, shade(red, 0.82)); tg.addColorStop(0.5, red); tg.addColorStop(1, shade(red, 0.62));
  ctx.fillStyle = tg; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = dark; ctx.stroke(); ctx.clip();
  ctx.strokeStyle = 'rgba(20,12,10,0.42)'; ctx.lineWidth = Math.max(2, 0.04 * S);
  for (let k = 0; k < 6; k++) { const yy = hip[1] + 0.1 * k; ctx.beginPath(); ctx.moveTo(...P(-0.5, yy)); ctx.lineTo(...P(0.5, yy)); ctx.stroke(); }
  for (let k = -3; k < 4; k++) { ctx.beginPath(); ctx.moveTo(...P(hip[0] + k * 0.1, 0.7)); ctx.lineTo(...P(sh[0] + k * 0.1, 1.5)); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = '#6b4a2a'; ctx.beginPath(); ctx.moveTo(...P(hip[0] - nx * hw, hip[1] - ny * hw)); ctx.lineTo(...P(hip[0] + nx * hw, hip[1] + ny * hw));
  ctx.lineTo(...P(hip[0] + nx * hw * 1.0 + 0.0, hip[1] + 0.07)); ctx.lineTo(...P(hip[0] - nx * hw, hip[1] + 0.07)); ctx.closePath(); ctx.fill();
  // front leg and boot
  limb(ctx, [P(...hip), P(...fKnee), P(...fAnk)], 0.18 * S, jeans, dark);
  drawBoot(ctx, ...P(fAnk[0] - 0.02, 0.42), S, 0, boot);
  // head
  const hr = 0.13 * S, hc = P(neck[0] + 0.03, neck[1] + 0.13);
  ctx.fillStyle = skin; ctx.fillRect(...P(neck[0] - 0.05, neck[1] + 0.02), 0.1 * S, 0.1 * S);
  const hg = ctx.createRadialGradient(hc[0] - hr * 0.3, hc[1] - hr * 0.3, hr * 0.2, hc[0], hc[1], hr * 1.3); hg.addColorStop(0, '#f6d2ae'); hg.addColorStop(1, '#c98f66');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(hc[0], hc[1], hr, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e4a67d'; ctx.beginPath(); ctx.ellipse(hc[0] + hr * 0.95, hc[1] + hr * 0.1, hr * 0.2, hr * 0.17, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f4efe3'; ctx.beginPath(); ctx.arc(hc[0] - hr * 0.12, hc[1] - hr * 0.2, hr * 1.04, Math.PI * 1.0, TAU * 1.0); ctx.fill();
  ctx.fillStyle = '#d24a3c'; ctx.beginPath(); ctx.arc(hc[0] - hr * 0.12, hc[1] - hr * 0.35, hr * 1.0, Math.PI * 1.0, TAU); ctx.fill();
  ctx.fillStyle = '#f4efe3'; ctx.fillRect(hc[0] - hr * 1.12, hc[1] - hr * 0.3, hr * 2.1, hr * 0.26);
  ctx.beginPath(); ctx.arc(hc[0] - hr * 0.1, hc[1] - hr * 1.36, hr * 0.3, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(30,18,10,0.9)'; ctx.beginPath(); ctx.arc(hc[0] + hr * 0.46, hc[1] + hr * 0.02, hr * 0.1, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(120,50,40,0.85)'; ctx.lineWidth = Math.max(1.5, hr * 0.1); ctx.beginPath();
  if (cheer || pose === 'swing') ctx.arc(hc[0] + hr * 0.4, hc[1] + hr * 0.3, hr * 0.3, 0.1, Math.PI - 0.6); else ctx.arc(hc[0] + hr * 0.4, hc[1] + hr * 0.45, hr * 0.2, 0.2, Math.PI - 0.8);
  ctx.stroke();
  // near arm and the boot
  const nearH = hand(0.7, phi);
  limb(ctx, [P(...sh), P(...hand(0.38, phi - 0.04)), P(...nearH)], 0.115 * S, red, dark);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(...P(...nearH), 0.065 * S, 0, TAU); ctx.fill();
  if (held) {
    const bc = P(...nearH);
    drawBoot(ctx, bc[0], bc[1], S, phi, boot);
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(...P(...nearH), 0.058 * S, 0, TAU); ctx.fill();
  }
  return { hand: nearH };
}

export function drawScene(ctx, c, st) {
  const { W, H, gy } = c;
  const s = st.run, t = st.time, sky = SKIES[st.sky | 0];
  let view = viewFor(c, s);
  if (st.camFrom) { const e = clamp((t - st.camFrom.t0) / 0.7, 0, 1); view = lerpView(st.camFrom, view, e * e * (3 - 2 * e)); }
  const { S, camX } = view;
  const X = (x, d = 1) => W / 2 + (x - camX * d) * S * d;       // world x -> screen x for a layer at depth factor d (1 = the lane)
  const yE = gy - 0.55 * S;                                     // the far edge of the field
  const cheer = !!st.cheer;
  if (GL.on) {
    // the 3D layer (web/view3d) draws the whole field behind this canvas: leave it clear, hand over what it needs, keep the guide dots
    ctx.clearRect(0, 0, W, H);
    GL.views.push({ c, st, S, camX, gy });
    if (st.ghost && st.ghost.length > 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.82)'; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4;
      st.ghost.forEach((p, i) => { if (i % 2) return; ctx.beginPath(); ctx.arc(X(p[0]), gy - p[1] * S, Math.max(2, S * 0.025), 0, TAU); ctx.fill(); });
      ctx.shadowBlur = 0;
    }
    return { S, camX, gy, yE, X, view, hand: [0, PIVOT_Y - ARM_R * 0.4] };
  }

  // sky
  let g = ctx.createLinearGradient(0, 0, 0, yE);
  g.addColorStop(0, sky.top); g.addColorStop(1, sky.bot); ctx.fillStyle = g; ctx.fillRect(0, 0, W, yE + 2);
  const sx = W * 0.72 - camX * 4, sy = yE * 0.38;
  g = ctx.createRadialGradient(sx, sy, 4, sx, sy, 240); g.addColorStop(0, sky.sun); g.addColorStop(0.18, sky.sun); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = sky.sunA * 0.6; ctx.fillStyle = g; ctx.fillRect(sx - 250, sy - 250, 500, 500); ctx.globalAlpha = 1;
  if (sky.night > 0.5) { ctx.fillStyle = '#fff'; for (let i = 0; i < 46; i++) { ctx.globalAlpha = 0.3 + hash(i) * 0.5; ctx.fillRect(hash(i + 9) * W, hash(i + 3) * yE * 0.7, 2, 2); } ctx.globalAlpha = 1; }
  // clouds
  for (let i = 0; i < 6; i++) {
    const cxp = ((hash(i + 40) * W * 1.7 + t * (5 + i * 1.5)) % (W * 1.7)) - W * 0.35 - camX * 2, cyp = yE * (0.08 + hash(i + 50) * 0.42), w = 110 + hash(i + 60) * 140;
    ctx.globalAlpha = sky.night > 0.5 ? 0.12 : 0.72; ctx.fillStyle = '#fff';
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(cxp + (k - 2) * w * 0.2, cyp + Math.sin(k * 2.1) * 8, w * 0.22, w * 0.11, 0, 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  // far hills, two layers, slow parallax
  for (let L = 0; L < 2; L++) {
    const d = 0.05 + L * 0.08, base = yE - (L ? 8 : 40) * (S / 100 + 0.4);
    ctx.fillStyle = sky.far[L]; ctx.beginPath(); ctx.moveTo(0, yE);
    for (let x = 0; x <= W; x += 24) { const wx = (x - W / 2) / (S * d) + camX * d; ctx.lineTo(x, base - (Math.sin(wx * 0.11 + L * 2.2) * 0.5 + Math.sin(wx * 0.047 + L) * 0.5 + 0.8) * (46 + L * 10)); }
    ctx.lineTo(W, yE); ctx.closePath(); ctx.fill();
  }
  // tree line and farm at depth 0.35
  {
    const d = 0.32, Sd = S * d;
    for (let i = -6; i < 40; i++) {
      const wx = i * 3.1 + hash(i) * 1.6, x = X(wx, d); if (x < -80 || x > W + 80) continue;
      const h = (3.4 + hash(i + 3) * 3) * Sd * 0.9 + 18;
      ctx.fillStyle = shade(sky.tree, 0.78 + hash(i + 5) * 0.3); ctx.beginPath(); ctx.ellipse(x, yE - h * 0.42, h * 0.34, h * 0.5, 0, 0, TAU); ctx.fill();
    }
    // the giant corrugated boot (a landmark) and a red-roofed shed
    const bx = X(-9, d), bh = 7 * Sd + 40;
    drawBoot(ctx, bx, yE - bh, bh / 0.4, 0, { col: '#aab3ba', sole: '#5b636a' });
    ctx.strokeStyle = 'rgba(40,50,60,0.25)'; ctx.lineWidth = 2;
    for (let k = 1; k < 8; k++) { const yy = yE - bh + (bh * 0.72) * (k / 8); ctx.beginPath(); ctx.moveTo(bx - bh * 0.2, yy); ctx.lineTo(bx + bh * 0.2, yy); ctx.stroke(); }
    const shx = X(-26, d), shw = 9 * Sd + 30, shh = 5 * Sd + 18;
    ctx.fillStyle = shade('#9a8f84', sky.night ? 0.6 : 1); ctx.fillRect(shx - shw / 2, yE - shh, shw, shh);
    ctx.fillStyle = '#b8372d'; ctx.beginPath(); ctx.moveTo(shx - shw / 2 - 6, yE - shh); ctx.lineTo(shx, yE - shh - shh * 0.45); ctx.lineTo(shx + shw / 2 + 6, yE - shh); ctx.closePath(); ctx.fill();
  }
  // marquee tents (generic colours) and bunting at depth 0.6
  {
    const d = 0.62, Sd = S * d;
    for (let i = 0; i < 9; i++) {
      const wx = -2 + i * 11 + hash(i + 12) * 3, x = X(wx, d); if (x < -200 || x > W + 200) continue;
      const w = 6 * Sd + 40, h = 2.6 * Sd + 22, col = BUNT[(i * 3 + 1) % BUNT.length];
      ctx.fillStyle = '#f4efe3'; ctx.fillRect(x - w / 2, yE - h, w, h);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - w / 2 - 8, yE - h); ctx.lineTo(x, yE - h - h * 0.55); ctx.lineTo(x + w / 2 + 8, yE - h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(col, 0.75); for (let k = 0; k < 4; k++) ctx.fillRect(x - w / 2 + k * w / 4 + w / 8, yE - h, w / 8, h);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x - w * 0.18, yE - h * 0.72, w * 0.36, h * 0.72);
    }
  }
  // the field: mown stripes in world coordinates
  const fg = ctx.createLinearGradient(0, yE, 0, H); fg.addColorStop(0, sky.g1); fg.addColorStop(1, shade(sky.g2, 0.72));
  ctx.fillStyle = fg; ctx.fillRect(0, yE, W, H - yE);
  {
    const step = S > 40 ? 2.5 : S > 14 ? 5 : 10, a = Math.floor((camX - W / 2 / S) / step) - 1, b = Math.ceil((camX + W / 2 / S) / step) + 1;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (let k = a; k <= b; k++) if (k % 2 === 0) ctx.fillRect(X(k * step), yE, step * S + 1, H - yE);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, yE, W, 3);
  }
  // spectators in a row along the far edge of the lane, behind the boards
  {
    const a = Math.floor(camX - W / 2 / S) - 2, b = Math.ceil(camX + W / 2 / S) + 2;
    const stepM = S > 40 ? 0.85 : S > 14 ? 2 : 4;
    for (let m = Math.floor(a / stepM); m <= Math.ceil(b / stepM); m++) {
      const wx = m * stepM + hash(m + 100) * stepM * 0.6; if (wx < -4 || wx > 130) continue;
      const x = X(wx), sc = Math.max(S * 0.82, 15 / 1.7);
      spectator(ctx, x, yE + 0.28 * S, sc, m & 4095, t, cheer, sky.crowd);
    }
  }
  // distance boards every 10 m (5 m when close)
  {
    const stepB = S > 55 ? 5 : 10;
    for (let k = 0; k <= 130 / stepB; k++) {
      const wx = LINE_X + k * stepB; if (k === 0) continue;
      const x = X(wx); if (x < -60 || x > W + 60) continue;
      const bw = Math.max(26, 1.1 * S), bh = Math.max(22, 0.78 * S), y0 = yE + 0.55 * S;
      ctx.fillStyle = '#6b4a2a'; ctx.fillRect(x - 2, y0 - bh - 0.35 * S, 4, bh + 0.35 * S);
      ctx.fillStyle = '#fdf9ee'; ctx.beginPath(); ctx.roundRect(x - bw / 2, y0 - bh - 0.5 * S, bw, bh, 4); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(20,30,50,0.6)'; ctx.stroke();
      ctx.fillStyle = '#1c2a44'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const fs = Math.max(16, Math.min(40, bh * 0.58)); ctx.font = `800 ${fs}px "Avenir Next", system-ui, sans-serif`; ctx.fillText(String(k * stepB), x, y0 - bh * 0.5 - 0.5 * S);
      // chalk line across the near field
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x - 1, yE + 0.55 * S, 2, H);
    }
  }
  // distances painted on the grass in front of the boards
  {
    const stepB = S > 55 ? 5 : 10, fs = clamp(S * 0.62, 18, 46);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = `800 ${fs}px "Avenir Next", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let k = 1; k <= 130 / stepB; k++) { const x = X(LINE_X + k * stepB); if (x < -40 || x > W + 40) continue; ctx.fillText(String(k * stepB), x, gy + Math.max(0.55 * S, fs * 0.85)); }
  }
  // the mat and the throwing line
  {
    const x0 = X(-1.5), x1 = X(LINE_X), my = gy;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, my + 3, (x1 - x0) / 2 + 10, 8, 0, 0, TAU); ctx.fill();
    const mg = ctx.createLinearGradient(0, my - 0.1 * S, 0, my + 0.05 * S); mg.addColorStop(0, '#3a3f45'); mg.addColorStop(1, '#1b1e22');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.roundRect(x0, my - 0.07 * S, x1 - x0, 0.14 * S, 5); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(x1 - 3, my - 0.09 * S, 6, 0.4 * S);
  }
  // wind sock on a pole behind the mat
  {
    const px = X(-2.9), top = gy - 3.3 * S, ws = s ? s.wind.x : st.windX || 0, str = clamp(Math.abs(ws) / 7, 0.12, 1);
    ctx.fillStyle = '#d9d9de'; ctx.fillRect(px - 2, top, 4, 3.3 * S);
    const dir = ws >= 0 ? 1 : -1, len = (0.7 + 0.8 * str) * S, ph = Math.sin(t * 5) * 0.06 * str, lift = (1 - str) * 0.9;
    for (let k = 0; k < 5; k++) {
      const x0 = px + dir * (k * len / 5), x1 = px + dir * ((k + 1) * len / 5), r0 = (0.17 - k * 0.022) * S, r1 = (0.17 - (k + 1) * 0.022) * S;
      const y0 = top + 0.12 * S + lift * (k * len / 5) * 0.55 + Math.sin(t * 6 + k) * 2 * str, y1 = top + 0.12 * S + lift * ((k + 1) * len / 5) * 0.55 + Math.sin(t * 6 + k + 1) * 2 * str;
      ctx.fillStyle = k % 2 ? '#f4efe3' : '#e8863a'; ctx.beginPath(); ctx.moveTo(x0, y0 - r0); ctx.lineTo(x1, y1 - r1 + ph * S); ctx.lineTo(x1, y1 + r1 + ph * S); ctx.lineTo(x0, y0 + r0); ctx.closePath(); ctx.fill();
    }
  }
  // marks of the earlier throws of this round (pegs with a distance)
  if (st.marks) {
    st.marks.forEach((m, i) => {
      const x = X(m.x + 0); if (x < -30 || x > W + 30) return;
      ctx.fillStyle = m.fair ? '#fff6e4' : '#d6453d'; ctx.fillRect(x - 1.5, gy - 0.5 * S, 3, 0.5 * S);
      ctx.beginPath(); ctx.moveTo(x, gy - 0.5 * S); ctx.lineTo(x + 0.35 * S, gy - 0.4 * S); ctx.lineTo(x, gy - 0.3 * S); ctx.closePath(); ctx.fillStyle = m.fair ? '#ffd45a' : '#d6453d'; ctx.fill();
    });
  }
  // the thrower
  let phi = 0;
  if (s) phi = s.phase === 'swing' || s.phase === 'ready' ? s.phi : (s.rel ? s.rel.phi : 0); else phi = 0.15 * Math.sin(t * 1.6);
  if (s && s.phase === 'ready') phi = 0.12 * Math.sin(t * 2.2);
  const held = !s || s.phase === 'ready' || s.phase === 'swing';
  const wind = Math.sin(t * 2) * 0;
  let body = null;
  if (personRenderer) {
    // the real person: after release the arm keeps going and eases out (follow-through), then hangs at that angle
    let phi3 = phi;
    if (s && !held && s.rel) { const tt = s.phase === 'flight' && s.b ? s.b.t : 3; phi3 = s.rel.phi + Math.min(1.1, Math.max(0, s.rel.om) * 0.2 * (1 - Math.exp(-tt / 0.18))); }
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(X(-0.02), gy, 0.5 * S, 0.07 * S, 0, 0, TAU); ctx.fill();
    const r = personRenderer(ctx, X(0), gy, S, { phi: phi3, held, t, night: sky.night });
    if (r) {
      const dx = Math.sin(phi3), dy = -Math.cos(phi3);
      const hx = r.hx + dx * 0.09, hy = r.hy + dy * 0.09;
      if (held) drawBoot(ctx, X(0) + hx * S, gy - hy * S, S, phi3, s ? s.boot : st.boot || 0);
      body = { hand: [hx, hy] };
    }
  }
  if (!body) body = thrower(ctx, X(0), gy, S, phi + wind, held, s ? s.boot : st.boot || 0, t, cheer && s && s.outcome === 'fair', s ? s.phase : 'ready');
  // hands up after a good throw
  // the trail and predicted path
  if (st.ghost && st.ghost.length > 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    st.ghost.forEach((p, i) => { if (i % 2) return; const x = X(p[0]), y = gy - p[1] * S; ctx.beginPath(); ctx.arc(x, y, Math.max(2, S * 0.025), 0, TAU); ctx.fill(); });
  }
  if (s && s.trail && s.trail.length > 1) {
    s.trail.forEach((p, i) => {
      const a = 0.25 + 0.6 * (i / s.trail.length), x = X(p[0]), y = gy - p[1] * S;
      ctx.globalAlpha = a; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, Math.max(2.2, S * 0.03), 0, TAU); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  // the boot in the air, the landing, the bounce
  if (s && (s.phase === 'flight' || s.phase === 'landed') && s.b) {
    const b = s.b, ang0 = s.rel ? s.rel.phi : 0, spin = (s.rel ? s.rel.om : 6) * 0.55;
    const size = Math.max(S, 96);
    if (s.phase === 'flight') {
      const x = X(b.x), y = gy - b.y * S;
      // a soft shadow on the ground below the boot
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, gy + 6, Math.max(8, 0.28 * S * Math.max(0.4, 1 - b.y / 40)), 4, 0, 0, TAU); ctx.fill();
      drawBoot(ctx, x, y, size, ang0 + spin * b.t, s.boot);
    } else {
      const L = s.land, tt = s.since;
      // damped bounces then a short slide
      let h = 0, slide = 0; const v0 = Math.min(6, Math.max(1.5, Math.abs(Math.min(b.vy, -2)) * 0.45));
      let tl = tt, vv = v0, k = 0;
      while (k < 3) { const T = 2 * vv / 9.81; if (tl < T) { h = vv * tl - 4.9 * tl * tl; break; } tl -= T; vv *= 0.42; k++; if (k === 3) h = 0; }
      slide = Math.min(1, tt / 0.9) * 0.0 + Math.min(tt, 1.1) * Math.max(0, L.vx) * 0.12;
      const lx = L.x + Math.max(-1, Math.min(3, slide)), ly = Math.max(0, h) * 0.5;
      const rest = tt > 1.2 ? 1 : 0, ang = mix(ang0 + spin * 1.2, Math.PI * 0.5 + 0.2, clamp(tt / 1.2, 0, 1));
      const x = X(lx), y = gy - ly * S - (rest ? 0.1 * size : 0);
      if (tt < 0.6) { // dust and grass
        for (let i = 0; i < 9; i++) { const a = -0.4 - hash(i + 3) * 2.3, r = tt * (0.9 + hash(i) * 2.2) * S * 0.5; ctx.globalAlpha = (1 - tt / 0.6) * 0.7; ctx.fillStyle = i % 2 ? '#cdb98a' : '#7ab04a'; ctx.beginPath(); ctx.arc(X(L.x) + Math.cos(a) * r, gy + Math.sin(a) * r * 0.8, Math.max(2, 0.05 * S), 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      if (s.outcome === 'fair' || true) drawBoot(ctx, x, y, size, ang, s.boot);
      // the landing flag with the distance
      const fx = X(L.x), fa = clamp((tt - 0.25) / 0.3, 0, 1);
      if (fa > 0) {
        ctx.globalAlpha = fa; const col = s.outcome === 'fair' ? '#ffd45a' : '#e5513f';
        ctx.fillStyle = '#fff6e4'; ctx.fillRect(fx - 1.5, gy - 1.3 * S * fa, 3, 1.3 * S * fa);
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(fx, gy - 1.3 * S); ctx.lineTo(fx + 0.7 * S, gy - 1.05 * S); ctx.lineTo(fx, gy - 0.8 * S); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
  // the crowd cheers: confetti (generic shapes) on a good throw
  if (s && s.phase === 'landed' && s.outcome === 'fair' && s.since < 1.8) {
    const n = 26, base = X(s.landX);
    for (let i = 0; i < n; i++) {
      const tt = s.since, a = hash(i) * TAU, r = (0.7 + hash(i + 1) * 1.8) * Math.min(S, 70) * tt * 1.2;
      ctx.globalAlpha = Math.max(0, 1 - tt / 1.8); ctx.fillStyle = BUNT[i % BUNT.length];
      ctx.fillRect(base + Math.cos(a) * r, gy - 40 + Math.sin(a) * r * 0.7 + tt * tt * 60, 7, 4);
    }
    ctx.globalAlpha = 1;
  }
  // bunting string across the top of the field
  {
    const y0 = (st.topPad || yE * 0.2) + 6;
    ctx.strokeStyle = 'rgba(40,30,20,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, y0); ctx.quadraticCurveTo(W / 2, y0 + 40, W, y0); ctx.stroke();
    for (let i = 0; i < 16; i++) {
      const u = (i + 0.5) / 16, x = u * W, y = y0 + 40 * 2 * u * (1 - u) + 2; ctx.fillStyle = BUNT[i % BUNT.length];
      ctx.beginPath(); ctx.moveTo(x - 13, y); ctx.lineTo(x + 13, y); ctx.lineTo(x + Math.sin(t * 3 + i) * 2, y + 26); ctx.closePath(); ctx.fill();
    }
  }
  return { S, camX, gy, yE, X, view, hand: body.hand };
}

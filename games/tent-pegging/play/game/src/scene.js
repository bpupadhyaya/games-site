// The lane seen from the saddle: pseudo-3D drawn with plain canvas paths (sky, hills, mown field, lane, stands with a crowd, bunting, boards, the peg,
// the lance, the horse's ears and mane). Drawing only: reads the run state, never changes it. Everything that "varies" comes from fixed hashes of
// an index, never from a random call, so a given frame always looks the same.
import { EYE, SIDE, REACH, DROP, LANE_LEN, PTS } from './consts.js';

const TAU = Math.PI * 2;
export const FOCAL = 520;
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hex = (c) => (c[0] === '#' ? [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)] : c.match(/\d+/g).slice(0, 3).map(Number));
const lerpCol = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${Math.round(mix(A[0], B[0], t))},${Math.round(mix(A[1], B[1], t))},${Math.round(mix(A[2], B[2], t))})`; };

// One look per time of day. g = grass pair, haze = colour distant things fade to.
export const SKIES = [
  { name: 'morning', top: '#5fa8ee', bot: '#d9f0ff', sun: '#fff2c4', sunA: 0.9, g1: '#6fa83f', g2: '#62973a', hill: ['#8fb2c9', '#7ea29a'], haze: '#d9f0ff', stand: '#c9b48c', crowdK: 1, night: 0 },
  { name: 'noon', top: '#2f8be0', bot: '#bfe3ff', sun: '#ffffff', sunA: 0.8, g1: '#5fa13a', g2: '#53902f', hill: ['#86a6c4', '#6f9a8c'], haze: '#c6e5ff', stand: '#d3c19b', crowdK: 1, night: 0 },
  { name: 'afternoon', top: '#4f86cf', bot: '#ffd9a2', sun: '#ffe2a0', sunA: 1, g1: '#78a63a', g2: '#6a9632', hill: ['#a7a1b8', '#8d9a86'], haze: '#ffdcae', stand: '#d9bf90', crowdK: 1, night: 0 },
  { name: 'evening', top: '#35477f', bot: '#ff9d68', sun: '#ffc27a', sunA: 1, g1: '#5f8a3c', g2: '#537b34', hill: ['#6c6a96', '#5d6f7b'], haze: '#ffae82', stand: '#c19b78', crowdK: 0.9, night: 0.15 },
  { name: 'floodlit', top: '#0d1638', bot: '#2c3b78', sun: '#dfe8ff', sunA: 0.55, g1: '#3d6e3a', g2: '#356333', hill: ['#26335f', '#1f2c52'], haze: '#2c3b78', stand: '#8a7a68', crowdK: 0.8, night: 0.7 },
];
const CLOTH = ['#d6453d', '#2f6fb6', '#f2c14e', '#3a9b8e', '#e98aa5', '#f4efe3', '#7a56b8', '#e8863a', '#3a4252', '#8cbf4a'];
const SKIN = ['#f1c9a5', '#d8a074', '#b97a4f', '#8a5634', '#e5b48c'];
const BUNT = ['#d6453d', '#f2c14e', '#2f6fb6', '#f4efe3', '#3a9b8e', '#e98aa5'];

export function makeCam(W, H) {
  const hor = Math.round(H * (W > H ? 0.38 : 0.4));
  return { W, H, cx: W / 2, hor, F: FOCAL, k: clamp(H / 1100, 0.55, 1) * (W > H ? 0.95 : 1) };
}

// Project a world point (x across, y up, z along) for a camera at lateral camX, along camZ. Returns null behind/at the camera.
const proj = (c, camX, camZ, x, y, z, bob = 0) => {
  const d = z - camZ;
  if (d < 0.35) return null;
  const sc = c.F / d;
  return { x: c.cx + (x - camX) * sc, y: c.hor + bob + (EYE - y) * sc, sc, d };
};

function quad(ctx, a, b, cc, d) {
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(cc.x, cc.y); ctx.lineTo(d.x, d.y); ctx.closePath();
}

const HAIR = ['#1d1410', '#3a2314', '#5a3a1e', '#8a6a3a', '#c9b48a', '#2a2a2e', '#6e6e72'];
function figure(ctx, x, y, sc, i, t, cheer, sky) {
  // x,y = where the person sits (bottom of the torso); sc = pixels per metre. Seated spectators: shoulders, neck, head, hair or hat, arms.
  const cl = CLOTH[(i * 7 + 3) % CLOTH.length], sk = SKIN[(i * 5 + 1) % SKIN.length], hr = HAIR[(i * 3 + 2) % HAIR.length];
  const dim = sky.crowdK, far = sc < 30;
  const sw = 0.52 * sc, h = 0.66 * sc, hd = 0.115 * sc;
  ctx.globalAlpha = dim;
  const wave = cheer ? Math.sin(t * 7 + i * 1.7) : 0;
  if (far) {
    ctx.fillStyle = cl; ctx.fillRect(x - sw / 2, y - h, sw, h);
    ctx.fillStyle = sk; ctx.beginPath(); ctx.arc(x, y - h - hd * 0.9, hd * 1.15, 0, TAU); ctx.fill();
    if (i % 3 === 0) { ctx.fillStyle = hr; ctx.beginPath(); ctx.arc(x, y - h - hd * 1.2, hd * 1.2, Math.PI, TAU); ctx.fill(); }
    ctx.globalAlpha = 1; return;
  }
  // torso with shoulders
  const g = ctx.createLinearGradient(x - sw / 2, 0, x + sw / 2, 0);
  g.addColorStop(0, shade(cl, 0.78)); g.addColorStop(0.45, cl); g.addColorStop(1, shade(cl, 0.62));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - sw * 0.5, y); ctx.lineTo(x - sw * 0.5, y - h * 0.62);
  ctx.quadraticCurveTo(x - sw * 0.5, y - h * 0.92, x - sw * 0.2, y - h * 0.96);
  ctx.lineTo(x + sw * 0.2, y - h * 0.96);
  ctx.quadraticCurveTo(x + sw * 0.5, y - h * 0.92, x + sw * 0.5, y - h * 0.62);
  ctx.lineTo(x + sw * 0.5, y); ctx.closePath(); ctx.fill();
  if (i % 5 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.22)'; for (let k = 0; k < 3; k++) ctx.fillRect(x - sw / 2, y - h * (0.18 + k * 0.22), sw, h * 0.07); }
  // neck and head
  ctx.fillStyle = shade(sk, 0.85); ctx.fillRect(x - hd * 0.45, y - h * 1.04, hd * 0.9, h * 0.12);
  const hy = y - h * 1.04 - hd * 0.95;
  const hg = ctx.createRadialGradient(x - hd * 0.3, hy - hd * 0.3, hd * 0.1, x, hy, hd * 1.3);
  hg.addColorStop(0, shade(sk, 1.08)); hg.addColorStop(1, shade(sk, 0.82));
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(x, hy, hd * 0.92, hd * 1.08, 0, 0, TAU); ctx.fill();
  // hair or a hat (never religious dress)
  const style = i % 6;
  if (style === 0 || style === 3) { ctx.fillStyle = hr; ctx.beginPath(); ctx.ellipse(x, hy - hd * 0.25, hd * 1.0, hd * 0.85, 0, Math.PI, TAU); ctx.fill(); }
  else if (style === 1) { ctx.fillStyle = hr; ctx.beginPath(); ctx.ellipse(x, hy - hd * 0.1, hd * 1.08, hd * 1.2, 0, Math.PI * 0.95, TAU * 1.03); ctx.fill(); ctx.fillRect(x - hd * 1.05, hy - hd * 0.2, hd * 0.45, hd * 1.5); ctx.fillRect(x + hd * 0.6, hy - hd * 0.2, hd * 0.45, hd * 1.5); }
  else if (style === 2) { ctx.fillStyle = CLOTH[(i * 11) % CLOTH.length]; ctx.beginPath(); ctx.ellipse(x, hy - hd * 0.45, hd * 1.0, hd * 0.7, 0, Math.PI, TAU); ctx.fill(); ctx.fillRect(x - hd * 1.35, hy - hd * 0.42, hd * 2.7, hd * 0.2); }
  else if (style === 4) { ctx.fillStyle = '#e8d9a8'; ctx.beginPath(); ctx.ellipse(x, hy - hd * 0.55, hd * 1.7, hd * 0.32, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(x, hy - hd * 0.7, hd * 0.9, hd * 0.6, 0, Math.PI, TAU); ctx.fill(); }
  else { ctx.fillStyle = hr; ctx.beginPath(); ctx.ellipse(x, hy - hd * 0.45, hd * 0.95, hd * 0.55, 0, Math.PI, TAU); ctx.fill(); }
  if (sc > 70) {
    ctx.fillStyle = 'rgba(40,24,16,0.85)'; ctx.beginPath(); ctx.arc(x - hd * 0.36, hy + hd * 0.05, hd * 0.09, 0, TAU); ctx.arc(x + hd * 0.36, hy + hd * 0.05, hd * 0.09, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(120,50,40,0.7)'; ctx.lineWidth = Math.max(1, hd * 0.08); ctx.beginPath(); ctx.arc(x, hy + hd * 0.35, hd * 0.28, 0.15, Math.PI - 0.15); ctx.stroke();
  }
  // a raised arm for some of the crowd when a strike lands
  if (cheer && i % 3 === 0) {
    ctx.strokeStyle = shade(cl, 0.9); ctx.lineWidth = Math.max(2, 0.12 * sc); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + sw * 0.42, y - h * 0.8); ctx.lineTo(x + sw * 0.62 + wave * 0.1 * sc, y - h * 1.5 - Math.abs(wave) * 0.1 * sc); ctx.stroke();
    ctx.fillStyle = sk; ctx.beginPath(); ctx.arc(x + sw * 0.62 + wave * 0.1 * sc, y - h * 1.55 - Math.abs(wave) * 0.1 * sc, hd * 0.4, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
const shade = (col, k) => { const [r, g, b] = hex(col); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(r)},${f(g)},${f(b)})`; };

export function drawWorld(ctx, c, st) {
  const { W, H, cx, hor, F } = c;
  const sky = SKIES[st.sky | 0], s = st.run, t = st.time;
  const camZ = (s ? s.z : 0) - 0.4, riderX = (s ? s.x : 0) - SIDE;
  const bobAmp = s && s.phase !== 'ready' ? Math.min(1, s.v / 12) : 0.15;
  const ph = (s ? s.stride : t * 1.6) * TAU;
  const bob = Math.sin(ph) * 5 * bobAmp + Math.sin(ph * 2 + 1) * 2 * bobAmp;
  const camX = riderX;

  // sky
  let g = ctx.createLinearGradient(0, 0, 0, hor + 10);
  g.addColorStop(0, sky.top); g.addColorStop(1, sky.bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, hor + 14);
  // sun / floodlight glow
  const sunX = cx + W * 0.26 - camX * 6, sunY = hor * 0.62;
  g = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 220);
  g.addColorStop(0, sky.sun); g.addColorStop(0.15, sky.sun); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = sky.sunA * 0.55; ctx.fillStyle = g; ctx.fillRect(sunX - 230, sunY - 230, 460, 460); ctx.globalAlpha = 1;
  if (sky.night > 0.5) {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 40; i++) { ctx.globalAlpha = 0.35 + hash(i) * 0.5; ctx.fillRect(hash(i + 9) * W, hash(i + 3) * hor * 0.8, 2, 2); }
    ctx.globalAlpha = 1;
  }
  // clouds
  for (let i = 0; i < 7; i++) {
    const cxp = ((hash(i + 40) * W * 1.6 + t * (4 + i)) % (W * 1.6)) - W * 0.3 - camX * 3, cyp = hor * (0.12 + hash(i + 50) * 0.5), w = 120 + hash(i + 60) * 150;
    ctx.globalAlpha = sky.night > 0.5 ? 0.12 : 0.55;
    ctx.fillStyle = sky.night > 0.5 ? '#6f80c0' : '#ffffff';
    for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.ellipse(cxp + (j - 1.5) * w * 0.22, cyp + (j % 2) * 5, w * 0.24, w * 0.09, 0, 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  // hills in two layers, parallax with lateral motion
  for (let L = 0; L < 2; L++) {
    ctx.fillStyle = sky.hill[L];
    ctx.beginPath(); ctx.moveTo(0, hor + 6);
    const amp = L ? 22 : 40, base = hor - (L ? 2 : 8), par = camX * (L ? 4 : 2);
    for (let x = 0; x <= W + 30; x += 30) {
      const u = (x + par) / (L ? 140 : 210) + L * 3.1;
      ctx.lineTo(x, base - (Math.sin(u) * 0.5 + 0.5) * amp - (Math.sin(u * 2.3 + 1.1) * 0.5 + 0.5) * amp * 0.5);
    }
    ctx.lineTo(W, hor + 6); ctx.closePath(); ctx.fill();
  }
  // tree line
  for (let i = 0; i < 46; i++) {
    const x = ((i * 53 + hash(i) * 40 - camX * 9) % (W + 120) + (W + 120)) % (W + 120) - 60, r = 14 + hash(i + 7) * 16;
    ctx.fillStyle = lerpCol('#3f6f3a', sky.hill[1], 0.35 + sky.night * 0.4);
    ctx.beginPath(); ctx.ellipse(x, hor - r * 0.2 + 4, r * 0.9, r, 0, 0, TAU); ctx.fill();
  }

  // ground
  g = ctx.createLinearGradient(0, hor, 0, H);
  g.addColorStop(0, lerpCol(sky.g2, sky.haze, 0.55)); g.addColorStop(0.25, sky.g2); g.addColorStop(1, sky.g1);
  ctx.fillStyle = g; ctx.fillRect(0, hor + bob, W, H - hor);

  // mown stripes: z bands, drawn far to near
  const z0 = Math.floor((camZ + 1) / 6) * 6;
  for (let zz = z0 + 6 * 24; zz >= z0; zz -= 6) {
    const k = Math.round(zz / 6);
    const a = proj(c, camX, camZ, -90, 0, zz, bob), b = proj(c, camX, camZ, 90, 0, zz, bob);
    const a2 = proj(c, camX, camZ, -90, 0, zz + 6, bob), b2 = proj(c, camX, camZ, 90, 0, zz + 6, bob);
    if (!a2 || !b2) continue;
    const near = a || { x: -9000, y: H + 400 }, nearB = b || { x: 9000, y: H + 400 };
    if (k % 2) { ctx.fillStyle = 'rgba(255,255,255,0.055)'; quad(ctx, near, nearB, b2, a2); ctx.fill(); }
    else { ctx.fillStyle = 'rgba(0,30,0,0.05)'; quad(ctx, near, nearB, b2, a2); ctx.fill(); }
  }

  // lane
  const laneW = 2.7;
  const lanePoly = (xa, xb, zA, zB, fill) => {
    const p1 = proj(c, camX, camZ, xa, 0, zA, bob), p2 = proj(c, camX, camZ, xb, 0, zA, bob), p3 = proj(c, camX, camZ, xb, 0, zB, bob), p4 = proj(c, camX, camZ, xa, 0, zB, bob);
    if (!p3 || !p4) return;
    const q1 = p1 || { x: c.cx + (xa - camX) * 9000, y: H + 900 }, q2 = p2 || { x: c.cx + (xb - camX) * 9000, y: H + 900 };
    ctx.fillStyle = fill; quad(ctx, q1, q2, p3, p4); ctx.fill();
  };
  const sand = lerpCol('#d9bd8a', sky.stand, 0.15);
  g = ctx.createLinearGradient(0, hor, 0, H); g.addColorStop(0, lerpCol(sand, sky.haze, 0.5)); g.addColorStop(0.3, sand); g.addColorStop(1, lerpCol(sand, '#a8885a', 0.5));
  lanePoly(-laneW, laneW, camZ + 0.4, LANE_LEN + 14, g);
  // worn track and hoof marks
  lanePoly(riderX - 0.8, riderX + 0.8, camZ + 0.4, LANE_LEN + 14, 'rgba(120,88,52,0.18)');
  for (let k = Math.floor(camZ / 1.5); k < Math.floor(camZ / 1.5) + 70; k++) {
    const zz = k * 1.5 + hash(k) * 0.4; if (zz < camZ + 1.2) continue;
    const xx = -0.9 + hash(k + 17) * 0.5 - (k % 2) * 0.3 - 0.4;
    const p = proj(c, camX, camZ, xx, 0, zz, bob); if (!p) continue;
    ctx.fillStyle = 'rgba(96,70,40,0.35)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.16 * p.sc, 0.05 * p.sc, 0, 0, TAU); ctx.fill();
  }
  // chalk edges
  for (const sx of [-laneW, laneW]) lanePoly(sx - 0.07, sx + 0.07, camZ + 0.4, LANE_LEN + 14, 'rgba(255,255,255,0.9)');
  // start and end lines
  const line = (zz, col) => lanePoly(-laneW, laneW, zz, zz + 0.35, col);
  line(0, 'rgba(255,255,255,0.85)');
  line(LANE_LEN, 'rgba(255,255,255,0.85)');

  // distance boards, bunting poles, peg gate, stands, crowd (far to near)
  const items = [];
  for (let zz = 10; zz <= LANE_LEN + 10; zz += 10) items.push({ k: 'board', z: zz, n: zz });
  for (let zz = 4; zz <= LANE_LEN + 20; zz += 12) items.push({ k: 'pole', z: zz, i: Math.round(zz / 12) });
  for (let zz = 6, i = 0; zz < LANE_LEN + 24; zz += 24, i++) items.push({ k: 'stand', z: zz, i });
  if (st.pegZ) items.push({ k: 'gate', z: st.pegZ });
  items.sort((a, b) => b.z - a.z);
  const fade = (d) => clamp((d - 70) / 80, 0, 0.7);
  for (const it of items) {
    const d = it.z - camZ; if (d < 0.6 || d > 170) continue;
    if (it.k === 'stand') drawStand(ctx, c, camX, camZ, bob, it, sky, t, st);
    else if (it.k === 'pole') drawPole(ctx, c, camX, camZ, bob, it, sky, t);
    else if (it.k === 'board') {
      for (const sd of [-1]) {
        const x = sd * 3.3 - (it.n % 20 ? 0 : 0);
        const a = proj(c, camX, camZ, x, 0, it.z, bob), b = proj(c, camX, camZ, x, 1.1, it.z, bob);
        if (!a || !b) continue;
        const w = 0.55 * a.sc, h = a.y - b.y;
        ctx.globalAlpha = 1 - fade(d);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(a.x - w / 2 + 2, a.y - 2, w, 3);
        ctx.fillStyle = '#4a3a2a'; ctx.fillRect(a.x - 1.5, b.y + h * 0.5, 3, h * 0.5);
        ctx.fillStyle = '#fdfaf0'; ctx.fillRect(a.x - w / 2, b.y, w, h * 0.55);
        ctx.fillStyle = '#d6453d'; ctx.fillRect(a.x - w / 2, b.y, w, Math.max(1, h * 0.07));
        if (a.sc > 5) { ctx.fillStyle = '#23304a'; ctx.font = `800 ${Math.round(h * 0.34)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(it.n), a.x, b.y + h * 0.3); }
        ctx.globalAlpha = 1;
      }
    } else if (it.k === 'gate' && d > 9) drawGate(ctx, c, camX, camZ, bob, it.z, sky, t);
  }

  // the peg and its chalk mat
  if (st.pegZ && st.pegDraw !== false) drawPeg(ctx, c, camX, camZ, bob, st, t);

  // haze over the far field
  g = ctx.createLinearGradient(0, hor - 30, 0, hor + 90);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.35, hexA(sky.haze, 0.55)); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, hor - 30, W, 120);
  return { camX, camZ, bob, ph };
}
const hexA = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };

function drawPole(ctx, c, camX, camZ, bob, it, sky, t) {
  for (const sd of [-1, 1]) {
    const x = sd * 4.6;
    const a = proj(c, camX, camZ, x, 0, it.z, bob), b = proj(c, camX, camZ, x, 3.2, it.z, bob);
    if (!a || !b) continue;
    ctx.strokeStyle = '#5a4630'; ctx.lineWidth = Math.max(1, 0.08 * a.sc); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    // bunting to the next pole
    const z2 = it.z + 12, b2 = proj(c, camX, camZ, x, 3.2, z2, bob);
    if (!b2) continue;
    const n = 7;
    ctx.strokeStyle = 'rgba(40,30,20,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(b.x, b.y);
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const u = k / n, zz = mix(it.z, z2, u), sag = Math.sin(u * Math.PI) * 0.5, wob = Math.sin(t * 2 + zz) * 0.04;
      const p = proj(c, camX, camZ, x, 3.2 - sag + wob, zz, bob); if (p) pts.push(p);
    }
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    for (let k = 1; k < pts.length - 1; k++) {
      const p = pts[k], w = 0.34 * p.sc, h = 0.46 * p.sc;
      ctx.fillStyle = BUNT[(it.i * 3 + k + (sd > 0 ? 2 : 0)) % BUNT.length];
      ctx.beginPath(); ctx.moveTo(p.x - w / 2, p.y); ctx.lineTo(p.x + w / 2, p.y); ctx.lineTo(p.x, p.y + h); ctx.closePath(); ctx.fill();
    }
  }
}

function drawGate(ctx, c, camX, camZ, bob, z, sky, t) {
  const xs = [-3.0, 3.0];
  const tops = [];
  for (const x of xs) {
    const a = proj(c, camX, camZ, x, 0, z, bob), b = proj(c, camX, camZ, x, 3.0, z, bob);
    if (!a || !b) return;
    ctx.fillStyle = '#e9e1cf';
    const w = Math.max(2, 0.14 * a.sc);
    ctx.fillRect(a.x - w / 2, b.y, w, a.y - b.y);
    ctx.fillStyle = '#d6453d';
    for (let k = 0; k < 6; k += 2) ctx.fillRect(a.x - w / 2, b.y + (a.y - b.y) * k / 6, w, (a.y - b.y) / 6);
    tops.push(b);
  }
  // a banner stretched across at the peg line (plain cloth)
  const y = tops[0].y, h = 0.55 * tops[0].sc;
  const x0 = tops[0].x, x1 = tops[1].x;
  const gr = ctx.createLinearGradient(x0, 0, x1, 0);
  gr.addColorStop(0, '#2b7f8c'); gr.addColorStop(0.5, '#3da3a8'); gr.addColorStop(1, '#f2c14e');
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.lineTo(x1, y + h); ctx.lineTo(x0, y + h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x0, y + h * 0.85, x1 - x0, h * 0.15);
}

function drawStand(ctx, c, camX, camZ, bob, it, sky, t, st) {
  const z0 = Math.max(it.z, camZ + 1.5), z1 = it.z + 22;
  if (z1 - z0 < 1) return;
  for (const sd of [-1, 1]) {
    const xf = sd * 9.5, xb = sd * 15;
    const fb0 = proj(c, camX, camZ, xf, 0, z0, bob), fb1 = proj(c, camX, camZ, xf, 0, z1, bob);
    const ft0 = proj(c, camX, camZ, xf, 3.3, z0, bob), ft1 = proj(c, camX, camZ, xf, 3.3, z1, bob);
    if (!fb1 || !ft1) continue;
    const a0 = fb0 || { x: c.cx + (xf - camX) * 3000, y: c.H + 600 }, t0 = ft0 || { x: a0.x, y: -400 };
    // front face
    const gr = ctx.createLinearGradient(0, ft1.y, 0, fb1.y);
    gr.addColorStop(0, lerpCol(sky.stand, '#6a5a48', 0.35)); gr.addColorStop(1, lerpCol(sky.stand, '#3d3226', 0.5 + sky.night * 0.3));
    ctx.fillStyle = gr; quad(ctx, a0, fb1, ft1, t0); ctx.fill();
    // tiers of spectators
    const rows = 3;
    for (let r = 0; r < rows; r++) {
      const y = 0.55 + r * 0.95;
      const cols = 22;
      for (let k = cols - 1; k >= 0; k--) {
        const zz = z0 + 0.5 + k * (22 / cols), p = proj(c, camX, camZ, xf + sd * (0.2 + r * 0.9), y, zz, bob);
        if (!p) continue;
        if (p.sc < 4) continue;
        const idx = Math.floor(zz * 2) * 3 + r * 17 + (sd > 0 ? 5 : 0);
        figure(ctx, p.x, p.y, p.sc, idx, t, st.cheer, sky);
      }
    }
    // canopy
    const zc = Math.max(z0, camZ + 10);
    const rt0 = proj(c, camX, camZ, xf - sd * 0.4, 4.4, zc, bob), rt1 = proj(c, camX, camZ, xf - sd * 0.4, 4.4, z1, bob);
    const rb0 = proj(c, camX, camZ, xb, 5.2, zc, bob), rb1 = proj(c, camX, camZ, xb, 5.2, z1, bob);
    if (rt1 && rb1 && ft1 && z1 - camZ > 14) {
      const r0 = rt0 || { x: t0.x, y: -400 }, q0 = rb0 || { x: c.cx + (xb - camX) * 3000, y: -400 };
      ctx.fillStyle = (it.i % 2 ? '#2f7a86' : '#e2d6b6'); quad(ctx, r0, rt1, rb1, q0); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; const s0 = proj(c, camX, camZ, xf - sd * 0.4, 4.0, zc, bob), s1 = proj(c, camX, camZ, xf - sd * 0.4, 4.0, z1, bob);
      if (s1) { const sa = s0 || { x: r0.x, y: -400 }; quad(ctx, sa, s1, rt1, r0); ctx.fill(); }
    }
  }
}

function drawPeg(ctx, c, camX, camZ, bob, st, t) {
  const s = st.run;
  const z = st.pegZ, x = st.pegX;
  const p = proj(c, camX, camZ, x, 0, z, bob);
  if (!p) return;
  // chalk mat
  ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.75 * p.sc, 0.26 * p.sc, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(214,69,61,0.9)'; ctx.lineWidth = Math.max(1.5, 0.05 * p.sc);
  ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.75 * p.sc, 0.26 * p.sc, 0, 0, TAU); ctx.stroke();
  const hit = s && s.outcome && s.outcome !== 'miss' && s.phase === 'after';
  if (hit) return; // the peg is drawn flying by the effects layer
  drawPegBlock(ctx, p.x, p.y, p.sc, 0, 1);
}

export function drawPegBlock(ctx, x, y, sc, rot, k = 1) {
  const w = 0.2 * sc * k, h = 0.2 * sc * k;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-w * 0.55, -h * 0.05, w * 1.1, h * 0.18);
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, '#d89a52'); g.addColorStop(1, '#a96a2a');
  ctx.fillStyle = g; ctx.fillRect(-w / 2, -h, w, h);
  ctx.fillStyle = '#f0c585'; ctx.fillRect(-w / 2, -h, w, h * 0.22);
  ctx.strokeStyle = 'rgba(60,30,10,0.7)'; ctx.lineWidth = Math.max(1, sc * 0.012); ctx.strokeRect(-w / 2, -h, w, h);
  ctx.restore();
}

// ---- foreground: the ring, the lance, the horse --------------------------------------------------------------------------------------
export function drawRing(ctx, c, camX, camZ, bob, st, t) {
  const s = st.run; if (!s || st.guide > 1) return;
  let z, x;
  if (s.phase === 'ride' || s.phase === 'ready') { const m = st.mark; z = m.z; x = m.x; }
  else if (s.phase === 'drop') { z = s.zcP; x = s.xcP; }
  else return;
  const p = proj(c, camX, camZ, x, 0, z, bob);
  if (!p) return;
  const col = st.guide === 0 ? (st.predict === 'lift' ? '#6dff9a' : st.predict === 'strike' ? '#ffd45a' : '#ffffff') : '#ffffff';
  const r = 0.34 * p.sc, ry = r * 0.36;
  ctx.save();
  ctx.shadowColor = col; ctx.shadowBlur = 14;
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, 0.055 * p.sc);
  ctx.beginPath(); ctx.ellipse(p.x, p.y, r, ry, 0, 0, TAU); ctx.stroke();
  ctx.lineWidth = Math.max(1.5, 0.03 * p.sc); ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.moveTo(p.x - r * 1.5, p.y); ctx.lineTo(p.x - r * 0.55, p.y); ctx.moveTo(p.x + r * 0.55, p.y); ctx.lineTo(p.x + r * 1.5, p.y); ctx.stroke();
  ctx.restore();
}

// Where the lance point is, in world coordinates (lane x, height, along z), for a given moment of the run.
export function tipPos(s, cz) {
  const rel0 = 4.3, h0 = 1.05;
  const xr = s.x + s.aim;
  if (!s.outcome && s.phase !== 'drop') return { x: xr, y: h0 + Math.sin(s.stride * TAU) * 0.04, z: s.z + rel0 };
  if (s.phase === 'drop') {
    const u = clamp((s.t - s.relT) / DROP, 0, 1), e = u * u * (3 - 2 * u);
    return { x: s.x + s.aimRel, y: mix(h0, 0.02, e), z: s.z + mix(rel0, REACH, e) };
  }
  const u = clamp((s.t - s.contactT) / 0.35, 0, 1);
  if (s.unfired) return { x: s.x + s.aim, y: h0, z: s.z + rel0 };
  const rise = s.outcome === 'lift' ? 1.5 : 0.8;
  const e = 1 - Math.pow(1 - u, 2);
  return { x: s.x + s.aimRel, y: mix(0.02, rise, e), z: s.z + mix(REACH, rel0, e) };
}

function drawLance(ctx, c, camX, camZ, bob, st, t) {
  const s = st.run, { W, H, cx } = c, k = c.k;
  const tip = s ? tipPos(s) : { x: 0, y: 1.75, z: camZ + 3.4 };
  const p = proj(c, camX, camZ, tip.x, tip.y, tip.z, bob);
  const hx = cx + 0.3 * Math.min(W, H) * 0.95 + 20, hy = H + 24 * k;
  if (!p) return null;
  // shaft: from the hand to the point, thickness by depth
  const ang = Math.atan2(p.y - hy, p.x - hx), len = Math.hypot(p.x - hx, p.y - hy);
  const w0 = 24 * k, w1 = Math.max(2.5, 0.07 * p.sc);
  ctx.save();
  ctx.translate(hx, hy); ctx.rotate(ang);
  // a tiny shadow on the ground is implied by the ring; the shaft itself
  let gr = ctx.createLinearGradient(0, -w0 / 2, 0, w0 / 2);
  gr.addColorStop(0, '#e6c48a'); gr.addColorStop(0.45, '#b9854a'); gr.addColorStop(1, '#6a4120');
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.moveTo(-60, -w0 / 2); ctx.lineTo(len, -w1 / 2); ctx.lineTo(len, w1 / 2); ctx.lineTo(-60, w0 / 2); ctx.closePath(); ctx.fill();
  // bands and pennon
  ctx.fillStyle = '#d6453d';
  for (const u of [0.35, 0.5]) { const bx = len * u, bw = mix(w0, w1, u); ctx.fillRect(bx - 5, -bw / 2, 8, bw); }
  // steel point
  const pl = Math.max(10, 0.28 * p.sc);
  ctx.fillStyle = '#cfd6df';
  ctx.beginPath(); ctx.moveTo(len - 2, -w1 * 0.9); ctx.lineTo(len + pl, 0); ctx.lineTo(len - 2, w1 * 0.9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7e8896'; ctx.beginPath(); ctx.moveTo(len - 2, 0); ctx.lineTo(len + pl, 0); ctx.lineTo(len - 2, w1 * 0.9); ctx.closePath(); ctx.fill();
  ctx.restore();
  // the riding sleeve, cuff and a gloved hand wrapped round the grip (fingers across the shaft, thumb along it)
  ctx.save();
  gr = ctx.createLinearGradient(hx - 90 * k, hy - 150 * k, hx + 80 * k, hy + 20 * k);
  gr.addColorStop(0, '#34569a'); gr.addColorStop(0.55, '#223a70'); gr.addColorStop(1, '#101c3a');
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.moveTo(hx + 96 * k, H + 4); ctx.bezierCurveTo(hx + 100 * k, hy - 30 * k, hx + 84 * k, hy - 90 * k, hx + 52 * k, hy - 116 * k);
  ctx.quadraticCurveTo(hx + 10 * k, hy - 140 * k, hx - 44 * k, hy - 84 * k);
  ctx.bezierCurveTo(hx - 62 * k, hy - 40 * k, hx - 70 * k, hy, hx - 76 * k, H + 4); ctx.closePath(); ctx.fill();
  // sleeve folds
  ctx.strokeStyle = 'rgba(8,14,34,0.45)'; ctx.lineWidth = 3 * k;
  for (const [u, v] of [[0.2, 0.0], [0.55, 0.12], [0.8, 0.0]]) { ctx.beginPath(); ctx.moveTo(hx - 50 * k + u * 120 * k, H); ctx.quadraticCurveTo(hx - 30 * k + u * 110 * k + v * 20 * k, hy - 10 * k, hx - 24 * k + u * 90 * k, hy - 80 * k); ctx.stroke(); }
  // leather cuff
  ctx.fillStyle = '#5a3a22'; ctx.beginPath(); ctx.ellipse(hx - 2 * k, hy - 80 * k, 54 * k, 20 * k, -0.28, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#8a6040'; ctx.lineWidth = 2 * k; ctx.stroke();
  // glove: back of the hand, four fingers over the shaft, thumb on top
  ctx.translate(hx - 2 * k, hy - 100 * k); ctx.rotate(ang * 0.25 + 0.1);
  gr = ctx.createLinearGradient(-40 * k, -30 * k, 40 * k, 30 * k); gr.addColorStop(0, '#9c6b3f'); gr.addColorStop(1, '#5f3b1e');
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.moveTo(-34 * k, 18 * k); ctx.bezierCurveTo(-42 * k, -10 * k, -30 * k, -34 * k, -4 * k, -36 * k); ctx.bezierCurveTo(26 * k, -38 * k, 40 * k, -16 * k, 36 * k, 14 * k); ctx.closePath(); ctx.fill();
  for (let f = 0; f < 4; f++) {
    const fx = -26 * k + f * 17 * k, fy = -26 * k - Math.abs(f - 1.5) * 1.5 * k;
    const fg = ctx.createLinearGradient(fx, fy, fx + 14 * k, fy);
    fg.addColorStop(0, '#b5804c'); fg.addColorStop(1, '#6b4322'); ctx.fillStyle = fg;
    ctx.beginPath(); ctx.roundRect(fx - 1 * k, fy - 12 * k, 15 * k, 40 * k, 7 * k); ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,8,0.55)'; ctx.lineWidth = 1.5 * k; ctx.beginPath(); ctx.moveTo(fx + 1 * k, fy + 8 * k); ctx.lineTo(fx + 12 * k, fy + 8 * k); ctx.stroke();
  }
  ctx.fillStyle = '#b5804c'; ctx.beginPath(); ctx.ellipse(-30 * k, 8 * k, 11 * k, 22 * k, 0.5, 0, TAU); ctx.fill();
  ctx.restore();
  return p;
}

function drawHorse(ctx, c, st, t) {
  const { W, H, cx } = c, k = c.k, s = st.run;
  const ph = (s ? s.stride : t * 1.6) * TAU, amp = s && s.phase !== 'ready' ? Math.min(1, s.v / 12) : 0.15;
  const by = Math.sin(ph) * 8 * amp * k, rot = Math.sin(ph * 0.5) * 0.015 * amp;
  const sway = s ? clamp(s.x * 24, -26, 26) * k : 0;
  const nod = Math.sin(ph + 0.8) * 6 * amp;       // the head nods with the stride
  ctx.save();
  ctx.translate(cx - sway, H + by); ctx.rotate(rot); ctx.scale(k, k);
  // shoulders and neck seen from above and behind: wide at the base, narrowing to the poll
  let g = ctx.createLinearGradient(-230, 0, 230, 0);
  g.addColorStop(0, '#4a2410'); g.addColorStop(0.3, '#8b4a21'); g.addColorStop(0.62, '#b4683a'); g.addColorStop(1, '#52290f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-250, 30); ctx.bezierCurveTo(-236, -90, -140, -190, -64, -304 + nod); ctx.quadraticCurveTo(0, -318 + nod, 64, -304 + nod); ctx.bezierCurveTo(140, -190, 236, -90, 250, 30); ctx.closePath(); ctx.fill();
  g = ctx.createLinearGradient(0, -300, 0, 30); g.addColorStop(0, 'rgba(255,225,170,0.30)'); g.addColorStop(0.5, 'rgba(255,225,170,0.0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = g; ctx.fill();
  // soft coat sheen on the lit shoulder (a blurred glow, no hard edges)
  g = ctx.createRadialGradient(110, -110, 6, 110, -110, 150); g.addColorStop(0, 'rgba(255,220,170,0.26)'); g.addColorStop(1, 'rgba(255,220,170,0)');
  ctx.fillStyle = g; ctx.fillRect(-20, -300, 300, 330);
  // the head beyond the poll: rounded forehead, cheekbones, tapering to the muzzle
  const H0 = -292 + nod;
  g = ctx.createLinearGradient(-76, 0, 76, 0); g.addColorStop(0, '#4f2711'); g.addColorStop(0.28, '#9a5428'); g.addColorStop(0.55, '#c27b46'); g.addColorStop(1, '#5b2e15');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-66, H0);
  ctx.bezierCurveTo(-82, H0 - 40, -74, H0 - 90, -50, H0 - 130);
  ctx.bezierCurveTo(-40, H0 - 152, -34, H0 - 170, -30, H0 - 184);
  ctx.bezierCurveTo(-24, H0 - 198, 24, H0 - 198, 30, H0 - 184);
  ctx.bezierCurveTo(34, H0 - 170, 40, H0 - 152, 50, H0 - 130);
  ctx.bezierCurveTo(74, H0 - 90, 82, H0 - 40, 66, H0); ctx.closePath(); ctx.fill();
  // roundness: darker towards the edges and the muzzle, lighter on the forehead
  g = ctx.createRadialGradient(6, H0 - 60, 6, 6, H0 - 60, 120); g.addColorStop(0, 'rgba(255,214,165,0.30)'); g.addColorStop(1, 'rgba(30,14,6,0.28)');
  ctx.fillStyle = g; ctx.fill();
  g = ctx.createLinearGradient(0, H0 - 198, 0, H0); g.addColorStop(0, 'rgba(24,10,4,0.5)'); g.addColorStop(0.3, 'rgba(24,10,4,0)'); g.addColorStop(1, 'rgba(24,10,4,0)');
  ctx.fillStyle = g; ctx.fill();
  // the head meets the neck in a soft shadow, not a seam
  g = ctx.createRadialGradient(0, H0 + 6, 4, 0, H0 + 6, 74); g.addColorStop(0, 'rgba(30,14,6,0.5)'); g.addColorStop(1, 'rgba(30,14,6,0)');
  ctx.fillStyle = g; ctx.fillRect(-76, H0 - 70, 152, 150);
  // a narrow blaze following the face
  g = ctx.createLinearGradient(0, H0 - 190, 0, H0 - 10); g.addColorStop(0, 'rgba(255,250,240,0.9)'); g.addColorStop(1, 'rgba(255,250,240,0.3)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-7, H0 - 10); ctx.quadraticCurveTo(-11, H0 - 100, -9, H0 - 176); ctx.quadraticCurveTo(0, H0 - 188, 9, H0 - 176); ctx.quadraticCurveTo(11, H0 - 100, 7, H0 - 10); ctx.closePath(); ctx.fill();
  // bridle: browband under the forelock and the cheek straps down the face
  ctx.strokeStyle = '#26130a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-60, H0 - 14); ctx.quadraticCurveTo(0, H0 - 34, 60, H0 - 14); ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(-58, H0 - 18); ctx.quadraticCurveTo(-50, H0 - 80, -34, H0 - 150); ctx.moveTo(58, H0 - 18); ctx.quadraticCurveTo(50, H0 - 80, 34, H0 - 150); ctx.stroke();
  // ears: upright and slightly apart, rounded tips
  for (const sd of [-1, 1]) {
    ctx.save(); ctx.translate(sd * 44, H0 - 22); ctx.scale(1.2, 1.2); ctx.rotate(sd * 0.2 + Math.sin(ph + sd) * 0.04 * amp);
    g = ctx.createLinearGradient(-18, 0, 18, 0); g.addColorStop(0, '#4a230f'); g.addColorStop(1, '#a05a2d');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-19, 4); ctx.bezierCurveTo(-27, -40, -16, -80, -2, -96); ctx.bezierCurveTo(14, -82, 26, -40, 19, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(40,18,8,0.5)'; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.bezierCurveTo(-13, -36, -7, -64, -1, -76); ctx.bezierCurveTo(8, -64, 13, -36, 9, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // forelock: a soft clump falling between the ears
  ctx.lineCap = 'round';
  for (let i = -2; i <= 2; i++) {
    const x0 = i * 8, len = 40 - Math.abs(i) * 6;
    ctx.strokeStyle = i % 2 ? '#1a0c06' : '#2b160b'; ctx.lineWidth = 13 - Math.abs(i) * 2;
    ctx.beginPath(); ctx.moveTo(x0, H0 - 16); ctx.quadraticCurveTo(x0 * 1.2, H0 - 16 - len * 0.5, x0 * 1.3 + Math.sin(ph + i) * 2 * amp, H0 - 16 - len); ctx.stroke();
  }
  // mane along the crest, falling to the near side
  for (let i = 0; i < 22; i++) {
    const u = i / 21, x = mix(-6, -34, u) + (hash(i + 3) - 0.5) * 18, y = mix(-282 + nod, -20, u), len = 60 + hash(i + 8) * 46 + u * 40, sw = Math.sin(ph + i * 0.7) * 5 * amp;
    const gm = ctx.createLinearGradient(x, y, x - 30 + sw, y + len);
    gm.addColorStop(0, '#0f0603'); gm.addColorStop(0.65, '#2a140a'); gm.addColorStop(1, 'rgba(60,32,16,0)');
    ctx.strokeStyle = gm; ctx.lineWidth = 14 - u * 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 18 + sw * 0.5, y + len * 0.45, x - 30 + sw, y + len); ctx.stroke();
  }
  // reins to both hands
  ctx.strokeStyle = '#2d170a'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-34, -440 + nod); ctx.quadraticCurveTo(-110, -240, -150, -70); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(34, -440 + nod); ctx.quadraticCurveTo(116, -240, 188, -36); ctx.stroke();
  // left hand closed on the reins (knuckles, thumb over the leather, a sliver of sleeve)
  ctx.save(); ctx.translate(-152, -56);
  let gh = ctx.createLinearGradient(-44, -40, 44, 40); gh.addColorStop(0, '#a87345'); gh.addColorStop(1, '#5c3a1d');
  ctx.fillStyle = gh; ctx.beginPath(); ctx.roundRect(-40, -34, 80, 70, 24); ctx.fill();
  ctx.strokeStyle = 'rgba(30,14,6,0.6)'; ctx.lineWidth = 3;
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-40 + i * 20, -30); ctx.lineTo(-40 + i * 20, 4); ctx.stroke(); }
  ctx.fillStyle = '#2d170a'; ctx.beginPath(); ctx.roundRect(-30, -50, 60, 22, 10); ctx.fill();
  ctx.restore();
  ctx.restore();
}

// Everything drawn on the lane picture for one frame. st: { run, time, sky, guide, mark, predict, pegZ, pegX, cheer, effects... }
// The whole lane in real 3D (view3d/lane3d.js, installed by main.js): returns null when it is missing, lost, or draws nothing, so the painted lane takes over.
function drawLane3d(ctx, c, st) {
  const L3 = globalThis.__lane3d;
  if (!L3 || L3.lost) return null;
  const s = st.run;
  let pxs = 1; try { pxs = ctx.getTransform().a || 1; } catch { /* default */ }
  pxs = Math.min(pxs, 1.6, L3.pxsCap || 2, 1500 / Math.max(c.W, c.H));
  let ok = false;
  try {
    ok = L3.render({ W: c.W, H: c.H, cx: c.cx, hor: c.hor, F: c.F, k: c.k, pxs, look: st.sky | 0, s, time: st.time, guide: st.guide, mark: st.mark, predict: st.predict,
      pegZ: st.pegZ, pegX: st.pegX, cam: st.cam || 'saddle', replay: st.replay !== false, heroX: st.heroX, heroY: st.heroY, heroH: st.heroH });
  } catch (e) { console.warn('3D lane failed, using the painted lane', e); L3.lost = true; ok = false; }
  if (!ok) return null;
  ctx.drawImage(L3.canvas, 0, 0, c.W, c.H);
  const g = ctx.createRadialGradient(c.cx, c.H * 0.5, Math.min(c.W, c.H) * 0.45, c.cx, c.H * 0.5, Math.max(c.W, c.H) * 0.82);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(10,14,30,${0.22 + (SKIES[st.sky | 0].night) * 0.2})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, c.W, c.H);
  const sd = SKIES[st.sky | 0];
  return { camX: 0, camZ: 0, bob: 0, p3: (x, y, z) => L3.project(x, y, z, c.W, c.H), night: sd.night };
}

export function drawScene(ctx, c, st) {
  const r3 = drawLane3d(ctx, c, st);
  if (r3) return r3;
  ctx.save();
  const s = st.run;
  const shake = s ? s.shake : 0;
  const sx = shake ? Math.sin(st.time * 60) * 5 * shake : 0, sy = shake ? Math.cos(st.time * 52) * 4 * shake : 0;
  const roll = s ? clamp(s.x * 0.02, -0.02, 0.02) + Math.sin((s.stride || 0) * TAU) * 0.004 : 0;
  ctx.translate(c.cx + sx, c.hor + sy); ctx.rotate(roll); ctx.scale(1.035, 1.035); ctx.translate(-c.cx, -c.hor);
  const info = drawWorld(ctx, c, st);
  drawRing(ctx, c, info.camX, info.camZ, info.bob, st, st.time);
  drawEffects(ctx, c, info, st);
  ctx.restore();
  // speed streaks (screen space, no roll)
  if (s && s.phase !== 'ready' && s.v > 6) {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2;
    const n = 14, spd = s.v / 16;
    for (let i = 0; i < n; i++) {
      const u = (hash(i + 70) + (s.stride * 0.8 + i * 0.13) % 1) % 1;
      const side = i % 2 ? 1 : -1, x = c.cx + side * (60 + u * u * c.W * 0.55) * (0.6 + hash(i) * 0.7), y = c.hor + 20 + u * (c.H - c.hor) * 0.9;
      const l = (14 + u * 90) * spd;
      ctx.globalAlpha = 0.2 + u * 0.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + side * l * 0.35, y + l); ctx.stroke();
    }
    ctx.restore();
  }
  const pr = drawLance(ctx, c, info.camX, info.camZ, info.bob, st, st.time);
  drawHorse(ctx, c, st, st.time);
  // vignette
  const g = ctx.createRadialGradient(c.cx, c.H * 0.5, Math.min(c.W, c.H) * 0.35, c.cx, c.H * 0.5, Math.max(c.W, c.H) * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(10,14,30,${0.32 + (SKIES[st.sky | 0].night) * 0.25})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, c.W, c.H);
  return { tipScreen: pr, camX: info.camX, camZ: info.camZ, bob: info.bob };
}

// contact flash, the peg in flight or on the lance, dust, ribbons
function drawEffects(ctx, c, info, st) {
  const s = st.run; if (!s || !s.outcome) return;
  const { camX, camZ, bob } = info;
  const u = s.t - s.contactT;
  if (u < 0) return;
  const gnd = proj(c, camX, camZ, s.pegX, 0, s.pegZ, bob);
  if (s.outcome === 'lift') {
    const tp = tipPos(s);
    const p = proj(c, camX, camZ, tp.x, tp.y + 0.05, tp.z, bob);
    if (p) drawPegBlock(ctx, p.x, p.y + 0.1 * p.sc, p.sc, u * 3, 1.15);
  } else if (s.outcome === 'strike') {
    const pg = s.peg, g = 9.8;
    const y = Math.max(0, 0.1 + pg.vy * u - 0.5 * g * u * u), zz = s.pegZ + pg.vz * Math.min(u, 1.4), xx = s.pegX + pg.vx * Math.min(u, 1.4) * 0.5;
    const p = proj(c, camX, camZ, xx, y, zz, bob);
    if (p) drawPegBlock(ctx, p.x, p.y, p.sc, u * pg.spin * 0.4, 1.2);
  }
  if (!gnd) return;
  // dust or sparkle burst at the contact spot
  const n = s.outcome === 'miss' ? 7 : 14, life = s.outcome === 'miss' ? 0.9 : 1.1;
  if (u < life) {
    const f = u / life;
    for (let i = 0; i < n; i++) {
      const a = hash(i + 5) * TAU, r = (0.2 + hash(i + 11) * 0.9) * f * 1.4, h = Math.sin(f * Math.PI) * (0.2 + hash(i + 2) * 0.6);
      const p = proj(c, camX, camZ, s.pegX + Math.cos(a) * r, h, s.pegZ + Math.sin(a) * r * 1.4, bob); if (!p) continue;
      ctx.globalAlpha = (1 - f) * 0.7;
      ctx.fillStyle = s.outcome === 'lift' ? (i % 2 ? '#ffe38a' : '#ffffff') : '#cdb38c';
      ctx.beginPath(); ctx.arc(p.x, p.y, (s.outcome === 'lift' ? 0.07 : 0.16) * p.sc * (1 + f), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (s.perfect && u < 1.4) {
    // ribbons rising from the lance point
    const f = u / 1.4, tp = tipPos(s), p = proj(c, camX, camZ, tp.x, tp.y, tp.z, bob);
    if (p) for (let i = 0; i < 16; i++) {
      const a = hash(i + 30) * TAU, r = f * (0.4 + hash(i + 31) * 1.4) * p.sc * 0.5;
      ctx.globalAlpha = 1 - f; ctx.fillStyle = BUNT[i % BUNT.length];
      ctx.save(); ctx.translate(p.x + Math.cos(a) * r, p.y - f * 70 - Math.abs(Math.sin(a)) * r * 0.6 + f * f * 60); ctx.rotate(a + f * 6); ctx.fillRect(-4, -2, 9, 4); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

export const pegScreen = (c, st, info) => proj(c, info.camX, info.camZ, st.pegX, 0.1, st.pegZ, info.bob);
export const project = proj;

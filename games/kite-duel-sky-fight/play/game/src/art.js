// Drawing the sky, the land, the flyers, the kites and the strings. Pure canvas, no assets. Everything
// that moves is driven by the `t` handed in (the game's own animation clock, which stops on pause).
import { W, H, ANCHOR, BOUNDS, K, clamp } from './sim.js';

const TAU = Math.PI * 2;

export const SKY_PAL = {
  dawn: { top: '#2f3a8f', mid: '#d9709c', low: '#ffc98e', glow: 'rgba(255,214,150,0.9)', sun: [0.28, 0.86], sunCol: '#fff0c8', cloud: [255, 226, 214], hill: ['#5b3d7a', '#3a2a63'], roof: '#2a1f4d', mist: 'rgba(255,200,170,0.28)' },
  noon: { top: '#1565c8', mid: '#59b2ee', low: '#d8f1ff', glow: 'rgba(255,255,255,0.7)', sun: [0.8, 0.12], sunCol: '#ffffff', cloud: [255, 255, 255], hill: ['#3f7fa8', '#2a5f86'], roof: '#1e3d63', mist: 'rgba(255,255,255,0.25)' },
  dusk: { top: '#171a4a', mid: '#a1456f', low: '#ff9a5a', glow: 'rgba(255,150,90,0.9)', sun: [0.72, 0.9], sunCol: '#ffd9a0', cloud: [255, 170, 150], hill: ['#4a2a55', '#2a1840'], roof: '#1b1034', mist: 'rgba(255,150,110,0.25)' },
  storm: { top: '#202c36', mid: '#4a6572', low: '#a3b7b8', glow: 'rgba(210,225,225,0.55)', sun: [0.5, 0.08], sunCol: '#d9e6e6', cloud: [150, 172, 178], hill: ['#33474f', '#222f36'], roof: '#16212a', mist: 'rgba(200,220,220,0.3)' },
};

// kite colours: index 0 is the player, 1..5 the rivals
export const KITE_PAL = [
  { a: '#e2503c', b: '#fff1d6', c: '#ffc94d', spar: '#5a2a1a', tail: '#ffc94d' },
  { a: '#d4308f', b: '#ffd23f', c: '#6a1b7a', spar: '#4a1230', tail: '#d4308f' },
  { a: '#27327f', b: '#f2f4ff', c: '#27327f', spar: '#141a45', tail: '#f2f4ff' },
  { a: '#1f9d5a', b: '#ffe14d', c: '#0b5a33', spar: '#0b3a22', tail: '#ffe14d' },
  { a: '#18b4c8', b: '#ff7ab0', c: '#0a5f70', spar: '#0a3f4a', tail: '#ff7ab0' },
  { a: '#22222c', b: '#f0b830', c: '#f0b830', spar: '#0d0d12', tail: '#f0b830' },
];

const lerp = (a, b, t) => a + (b - a) * t;

export function drawSky(ctx, skyId, t) {
  const P = SKY_PAL[skyId] ?? SKY_PAL.dawn;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, P.top); g.addColorStop(0.52, P.mid); g.addColorStop(1, P.low);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // sun or moon glow
  const sx = P.sun[0] * W, sy = P.sun[1] * H;
  const gg = ctx.createRadialGradient(sx, sy, 10, sx, sy, 520);
  gg.addColorStop(0, P.glow); gg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = P.sunCol; ctx.globalAlpha = skyId === 'storm' ? 0.35 : 0.95;
  ctx.beginPath(); ctx.arc(sx, sy, skyId === 'noon' ? 34 : 52, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  void t;
}

const CLOUDS = [];
{
  let s = 12345;
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 14; i++) CLOUDS.push({ x: r() * W, y: 90 + r() * 900, sc: 0.5 + r() * 1.1, sp: 4 + r() * 12, a: 0.25 + r() * 0.4, ph: r() * 6 });
}
// phase: the game's integrated wind (so clouds speed up with gusts and stop when paused); dir: wind direction
export function drawClouds(ctx, skyId, phase, dir) {
  const P = SKY_PAL[skyId] ?? SKY_PAL.dawn;
  const [r, g, b] = P.cloud;
  for (const c of CLOUDS) {
    const span = W + 520;
    let x = (c.x + dir * phase * c.sp * 6) % span; if (x < 0) x += span; x -= 260;
    const y = c.y, sc = c.sc;
    const depth = 0.55 + 0.45 * (y / 1000);
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = `rgba(${r},${g},${b},${c.a * (0.5 - k * 0.12)})`;
      const w = (180 - k * 36) * sc * depth, h = (46 - k * 9) * sc * depth;
      ctx.beginPath();
      ctx.ellipse(x, y, w, h, 0, 0, TAU);
      ctx.ellipse(x - w * 0.55, y + h * 0.25, w * 0.55, h * 0.8, 0, 0, TAU);
      ctx.ellipse(x + w * 0.5, y + h * 0.2, w * 0.6, h * 0.85, 0, 0, TAU);
      ctx.ellipse(x + w * 0.1, y - h * 0.4, w * 0.5, h * 0.9, 0, 0, TAU);
      ctx.fill();
    }
  }
}

// long thin streaks that show the wind; speed follows the wind's phase, density its strength
const STREAKS = [];
{
  let s = 777;
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 26; i++) STREAKS.push({ x: r() * W, y: 160 + r() * 880, len: 60 + r() * 150, sp: 14 + r() * 26, a: 0.12 + r() * 0.22, th: 1 + r() * 1.4 });
}
export function drawWindStreaks(ctx, phase, dir, wind) {
  const n = Math.round(clamp((wind - 0.15) / 0.9, 0, 1) * STREAKS.length);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const s = STREAKS[i];
    let x = (s.x + dir * phase * s.sp * 8) % (W + 300); if (x < 0) x += W + 300; x -= 150;
    const y = s.y + Math.sin(phase * 0.4 + i) * 10;
    ctx.strokeStyle = `rgba(255,255,255,${s.a * clamp(wind, 0.3, 1.2)})`; ctx.lineWidth = s.th;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + dir * s.len * 0.5, y - 6, x + dir * s.len, y); ctx.stroke();
  }
}

// hills, terrace rooftops and trees along the bottom; the wind bends the grass and trees a little
export function drawLand(ctx, skyId, phase, dir, wind) {
  const P = SKY_PAL[skyId] ?? SKY_PAL.dawn;
  // mist
  const mg = ctx.createLinearGradient(0, 930, 0, 1130);
  mg.addColorStop(0, 'rgba(255,255,255,0)'); mg.addColorStop(1, P.mist);
  ctx.fillStyle = mg; ctx.fillRect(0, 930, W, 200);
  // far hills
  ctx.fillStyle = P.hill[0];
  ctx.beginPath(); ctx.moveTo(0, 1280); ctx.lineTo(0, 1070);
  for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 1060 + Math.sin(x * 0.011 + 1) * 26 + Math.sin(x * 0.027) * 12);
  ctx.lineTo(W, 1280); ctx.closePath(); ctx.fill();
  // rooftops: flat terrace roofs with parapets on the left, low tiled roofs on the right
  ctx.fillStyle = P.hill[1];
  const roofs = [[-10, 1096, 120, 60], [96, 1108, 90, 48], [190, 1088, 70, 70], [452, 1100, 80, 56], [540, 1090, 100, 66], [650, 1104, 90, 52]];
  for (const [x, y, w, h] of roofs) {
    ctx.fillRect(x, y, w, h);
    ctx.fillRect(x - 3, y - 6, w + 6, 8);
    for (let p = 0; p < w; p += 22) ctx.fillRect(x + p, y - 14, 12, 8);
  }
  ctx.fillStyle = P.roof;
  ctx.beginPath(); ctx.moveTo(300, 1112); ctx.lineTo(332, 1084); ctx.lineTo(400, 1084); ctx.lineTo(432, 1112); ctx.closePath(); ctx.fill();
  ctx.fillRect(312, 1112, 108, 40);
  // foreground ridge
  ctx.fillStyle = P.roof;
  ctx.beginPath(); ctx.moveTo(0, 1280); ctx.lineTo(0, 1140);
  for (let x = 0; x <= W; x += 30) ctx.lineTo(x, 1138 + Math.sin(x * 0.02 + 2) * 10);
  ctx.lineTo(W, 1280); ctx.closePath(); ctx.fill();
  // trees that lean with the wind
  const lean = dir * clamp(wind, 0, 1.2) * 14;
  for (const [x, y, s] of [[40, 1140, 1], [330, 1146, 0.8], [660, 1138, 1.1], [700, 1150, 0.7]]) {
    const sw = Math.sin(phase * 0.8 + x) * 2.5;
    ctx.strokeStyle = P.roof; ctx.lineWidth = 6 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.quadraticCurveTo(x + lean * 0.3 * s, y - 40 * s, x + (lean + sw) * s, y - 80 * s); ctx.stroke();
    ctx.fillStyle = P.roof;
    ctx.beginPath(); ctx.arc(x + (lean + sw) * s, y - 92 * s, 28 * s, 0, TAU); ctx.arc(x + (lean + sw) * s - 20 * s, y - 76 * s, 20 * s, 0, TAU); ctx.arc(x + (lean + sw) * s + 20 * s, y - 78 * s, 20 * s, 0, TAU); ctx.fill();
  }
}

// a flyer at the anchor: seen from behind, one arm raised toward the kite, the reel in the other hand
export function drawFlyer(ctx, side, kite, pal, t) {
  const a = ANCHOR[side];
  const dx = kite.x - a.x, dy = kite.y - a.y, d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  const body = '#161236';
  ctx.save();
  ctx.translate(a.x, a.y + 40);
  ctx.rotate(ux * 0.12);
  // legs, tunic and head
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.roundRect(-15, -4, 12, 44, 5); ctx.roundRect(3, -4, 12, 44, 5); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-20, -6); ctx.lineTo(-17, -58); ctx.quadraticCurveTo(0, -66, 17, -58); ctx.lineTo(20, -6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -74, 13, 0, TAU); ctx.fill();
  // scarf and cap pick up the kite colours
  ctx.fillStyle = pal.a;
  ctx.beginPath(); ctx.ellipse(0, -80, 13, 6, 0, Math.PI, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-14, -60); ctx.quadraticCurveTo(0, -52, 14, -60); ctx.lineTo(12, -54); ctx.quadraticCurveTo(0, -46, -12, -54); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(12, -58); ctx.quadraticCurveTo(26 + Math.sin(t * 6 + side) * 3, -52, 30, -38 + Math.sin(t * 5) * 3); ctx.lineTo(24, -40); ctx.closePath(); ctx.fill();
  // the arm that holds the string, reaching toward the kite
  ctx.strokeStyle = body; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const sx = side === 0 ? 14 : -14;
  const hx = sx + ux * 30, hy = -52 + Math.max(-46, uy * 40) - 14;
  ctx.beginPath(); ctx.moveTo(sx, -50); ctx.lineTo(sx + ux * 16, -62); ctx.lineTo(hx, hy); ctx.stroke();
  // the reel in the other hand
  const rx = side === 0 ? -22 : 22;
  ctx.beginPath(); ctx.moveTo(-sx, -50); ctx.lineTo(rx, -30); ctx.stroke();
  ctx.fillStyle = pal.b; ctx.strokeStyle = body; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(rx, -24, 11, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function pathPoly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }

// A kite centred on its string. sc = depth scale; fl = flutter amplitude (rad)
export function drawKite(ctx, k, pal, t, o = {}) {
  const { alpha = 1 } = o;
  const depth = 0.8 + 0.3 * clamp((k.y - 150) / 900, 0, 1);
  const sc = (o.scale ?? 1) * depth;
  const wob = Math.sin(t * 5.2 + k.ph) * 0.05 + Math.sin(t * 8.9 + k.ph * 2) * 0.025;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(k.x, k.y);
  ctx.rotate(k.ang + wob);
  ctx.scale(sc, sc);
  const style = k.style;
  if (style === 'rokkaku') {
    const hex = [[-30, -66], [30, -66], [50, 0], [30, 66], [-30, 66], [-50, 0]];
    pathPoly(ctx, hex); ctx.fillStyle = pal.b; ctx.fill();
    ctx.save(); pathPoly(ctx, hex); ctx.clip();
    ctx.fillStyle = pal.a; ctx.fillRect(-60, -70, 120, 36); ctx.fillRect(-60, 2, 120, 32);
    ctx.fillStyle = pal.c; ctx.globalAlpha = alpha * 0.9; ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = pal.spar; ctx.lineWidth = 2.4; ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.moveTo(0, -66); ctx.lineTo(0, 66); ctx.moveTo(-48, -33); ctx.lineTo(48, -33); ctx.moveTo(-48, 33); ctx.lineTo(48, 33); ctx.stroke();
    pathPoly(ctx, hex); ctx.lineWidth = 3; ctx.stroke();
  } else {
    const top = [0, -62], right = [46, -6], bottom = [0, 66], left = [-46, -6], mid = [0, -6];
    // four panels, two colours
    const fillTri = (p, q, r, col) => { pathPoly(ctx, [p, q, r]); ctx.fillStyle = col; ctx.fill(); };
    fillTri(top, right, mid, pal.a); fillTri(top, left, mid, pal.b);
    fillTri(bottom, right, mid, pal.b); fillTri(bottom, left, mid, pal.a);
    // light edge of the paper
    pathPoly(ctx, [top, right, bottom, left]); ctx.strokeStyle = pal.spar; ctx.lineWidth = 3; ctx.stroke();
    // spine and bowed spar
    ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, -62); ctx.lineTo(0, 66); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-46, -6); ctx.quadraticCurveTo(0, -22, 46, -6); ctx.stroke();
    ctx.fillStyle = pal.c; ctx.beginPath(); ctx.arc(0, -6, 6, 0, TAU); ctx.fill();
    if (style === 'tailed') {
      ctx.strokeStyle = pal.tail; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 66);
      for (let i = 1; i <= 14; i++) ctx.lineTo(Math.sin(t * 6 + i * 0.7 + k.ph) * (4 + i * 1.5), 66 + i * 11);
      ctx.stroke();
      for (let i = 2; i <= 14; i += 3) { ctx.fillStyle = i % 2 ? pal.a : pal.b; ctx.beginPath(); ctx.arc(Math.sin(t * 6 + i * 0.7 + k.ph) * (4 + i * 1.5), 66 + i * 11, 6, 0, TAU); ctx.fill(); }
    } else {
      ctx.strokeStyle = pal.tail; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 66); for (let i = 1; i <= 6; i++) ctx.lineTo(Math.sin(t * 7 + i * 0.9 + k.ph) * (2 + i * 1.2), 66 + i * 7); ctx.stroke();
    }
  }
  ctx.restore();
}

// tension -> colour. low: cool white, taut: warm white, hard: amber, strain: red
export function stringColor(T, integ) {
  const wear = clamp(1 - integ / 100, 0, 1);
  if (T > K.STRAIN_AT) return `rgb(255,${Math.round(120 - 40 * wear)},${Math.round(90 - 40 * wear)})`;
  if (T > 0.75) return `rgb(255,${Math.round(210 - 40 * wear)},${Math.round(120 - 30 * wear)})`;
  if (T > 0.35) return `rgb(255,${Math.round(246 - 30 * wear)},${Math.round(225 - 70 * wear)})`;
  return `rgb(${Math.round(225 - 20 * wear)},${Math.round(240 - 40 * wear)},255)`;
}

export function drawString(ctx, pts, k, t) {
  const col = stringColor(k.T, k.integ);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const w = 1.6 + 1.6 * clamp(k.T, 0, 1.3);
  // glow
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = w + 6;
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w;
  if (k.integ < 35) ctx.setLineDash([22, 3 + (35 - k.integ) * 0.25]);
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  void t;
}

// the crossing: a glint, ring, and saw-lines that flicker
export function drawContact(ctx, c, t, rate) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 22);
  const power = clamp(rate / 30, 0.2, 1.2);
  const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 40 + 20 * power);
  g.addColorStop(0, 'rgba(255,240,190,0.95)'); g.addColorStop(0.35, 'rgba(255,170,80,0.45)'); g.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, 40 + 20 * power, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(255,236,170,${0.5 + 0.4 * pulse})`; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(c.x, c.y, 14 + 4 * pulse, 0, TAU); ctx.stroke();
}

export function drawParticles(ctx, parts) {
  for (const p of parts) {
    const k = 1 - p.t / p.max;
    if (k <= 0) continue;
    if (p.kind === 'spark') {
      ctx.strokeStyle = `rgba(255,${Math.round(190 + 60 * k)},${Math.round(90 + 100 * k)},${k})`; ctx.lineWidth = 2.2 * k + 0.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
    } else if (p.kind === 'ring') {
      ctx.strokeStyle = `rgba(255,240,200,${k * 0.8})`; ctx.lineWidth = 4 * k + 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, (1 - k) * p.size + 6, 0, TAU); ctx.stroke();
    } else if (p.kind === 'flash') {
      ctx.fillStyle = `rgba(255,255,240,${k * 0.55})`; ctx.fillRect(0, 0, W, H);
    } else if (p.kind === 'shred') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col; ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore();
    } else {
      ctx.fillStyle = `rgba(255,255,255,${k * 0.6})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + 0.4 * k), 0, TAU); ctx.fill();
    }
  }
}

export { lerp, BOUNDS };

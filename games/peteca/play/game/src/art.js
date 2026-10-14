// The scenery, the peteca and the particles. Pure drawing: reads state and never writes it (the only module state is a cache
// of the static backdrop layers).
import { FONT } from './ui.js';
import { COURT, NET, NET_H } from './sim.js';

const TAU = Math.PI * 2;
const clampv = (v, a, b) => Math.max(a, Math.min(b, v));
export const FX = { soft: true, gl: null };   // gl: the 3D presenter (view3d/presenter.js) when it is running; art stays 2D otherwise

// ---- courts -------------------------------------------------------------------------------------------------------------------
export const COURTS = [
  { id: 0, name: 'Praia do Sol', sub: 'Beach at noon', need: 0, sky: ['#55b8f2', '#bfe7fb', '#fdf3d8'], sun: '#fffbe6', sunAt: 0.7, sea: ['#1fa7b8', '#58cfd0'], far: '#5c9a7a', mid: '#3d7d62', sand: ['#f6e2aa', '#e6c47c'], sand2: '#d9b56a', line: '#fffdf3', tree: 'palm', accent: '#ff7a2b', cloud: 'rgba(255,255,255,0.9)', night: false },
  { id: 1, name: 'Praça da Manhã', sub: 'Park square, morning', need: 1, sky: ['#9bd0f0', '#f7e9d2', '#ffe9c7'], sun: '#fff1c8', sunAt: 0.25, sea: ['#7bb6c9', '#a7d4d9'], far: '#7ca88a', mid: '#4f8a62', sand: ['#d7cdb8', '#b9ad92'], sand2: '#a39878', line: '#ffffff', tree: 'jaca', accent: '#a05bd8', cloud: 'rgba(255,255,255,0.85)', night: false, stone: true },
  { id: 2, name: 'Quadra do Entardecer', sub: 'Dusk court with lanterns', need: 2, sky: ['#2a2a6b', '#d9647a', '#ffb867'], sun: '#ffe2a8', sunAt: 0.5, sea: ['#3a3a82', '#e0788c'], far: '#35345f', mid: '#26284d', sand: ['#c9a58a', '#8f6f6a'], sand2: '#7a5c5e', line: '#ffeedd', tree: 'palm', accent: '#ffb347', cloud: 'rgba(255,190,160,0.55)', night: true },
];
export const WORLD_X0 = -3.6, WORLD_X1 = 15.6;

// ---- petecas ---------------------------------------------------------------------------------------------------------------
export const PETECAS = [
  { id: 0, name: 'Garça', how: 'Always yours', f: ['#fdfcf6', '#d5dde6'], tip: '#ffffff', base: ['#c98a45', '#7d4a1e'] },
  { id: 1, name: 'Arara', how: 'Win a match', f: ['#e8392c', '#2a62d9'], tip: '#ffd23c', base: ['#d29a50', '#82511f'], mix: ['#e8392c', '#ffd23c', '#2a62d9', '#e8392c', '#ffd23c'] },
  { id: 2, name: 'Tucano', how: '50 perfect strikes', f: ['#2b2e3a', '#10121a'], tip: '#ff9b2b', base: ['#b87a3a', '#6e3f14'] },
  { id: 3, name: 'Beija-flor', how: 'Beach Rally streak of 20', f: ['#1dd3b0', '#7a4fd0'], tip: '#ffe5fb', base: ['#d3a05a', '#85561f'], mix: ['#1dd3b0', '#7a4fd0', '#1dd3b0', '#7a4fd0', '#ffe5fb'] },
];

// ---- camera -------------------------------------------------------------------------------------------------------------------
// World metres -> screen pixels. x along the court, z up. `camX` is the world x at the centre of the stage.
export function makeCam(stage, camX = 6) {
  const asp = stage.w / Math.max(1, stage.h);
  const tall = asp < 1.05;                                          // portrait stage: use the height, the camera follows the action
  const Z = FX.gl && FX.gl.active ? (tall ? 1.3 : 1.12) : 1;          // the 3D scene frames the athletes a little tighter
  const want = clampv((tall ? 5.7 : 6.6) + (asp - 0.9) * 9, tall ? 5.7 : 6.6, 13.4) / Z;          // metres of court shown: a narrow phone zooms in, a tablet shows it all
  const gyF = tall ? 0.86 : 0.8;
  const s = clampv(Math.min(stage.w / want, stage.h * gyF / ((tall ? 4.9 : 5.4) / (Z > 1 ? 1.1 : 1))), 30, 190);
  const visW = stage.w / s;
  const fixed = visW >= 13.0;
  const gy = stage.y + stage.h * gyF;
  const cx = stage.x + stage.w / 2;
  const cam = {
    s, visW, fixed, gy, stage, cx,
    camX: fixed ? 6 : clampv(camX, WORLD_X0 + 1.0 + visW / 2, WORLD_X1 - 1.0 - visW / 2),
  };
  cam.X = (x) => cx + (x - cam.camX) * s;
  cam.Y = (z) => gy - z * s;
  cam.clampTarget = (x) => (fixed ? 6 : clampv(x, WORLD_X0 + 1.0 + visW / 2, WORLD_X1 - 1.0 - visW / 2));
  return cam;
}

// ---- the static backdrop (cached in two layers) ----------------------------------------------------------------------------------
let CACHE = { far: { key: '', canvas: null }, near: { key: '', canvas: null } };
export const resetArt = () => { CACHE = { far: { key: '', canvas: null }, near: { key: '', canvas: null } }; };

const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
const pseudo = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

function paintFar(ctx, w, h, s, gy, c) {
  const hz = gy - 2.05 * s;                              // sea horizon
  const X = (wx) => (wx - WORLD_X0) * s;
  const g = ctx.createLinearGradient(0, 0, 0, hz + 6);
  g.addColorStop(0, c.sky[0]); g.addColorStop(0.62, c.sky[1]); g.addColorStop(1, c.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, hz + 6);
  // sun with a halo
  const sx = X(WORLD_X0 + (WORLD_X1 - WORLD_X0) * c.sunAt), sy = hz - s * (c.night ? 0.9 : 3.6), sr = s * (c.night ? 0.75 : 0.55);
  const halo = ctx.createRadialGradient(sx, sy, sr * 0.3, sx, sy, sr * 4.2);
  halo.addColorStop(0, c.night ? 'rgba(255,200,150,0.7)' : 'rgba(255,248,215,0.85)'); halo.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = halo; ctx.fillRect(sx - sr * 4.2, sy - sr * 4.2, sr * 8.4, sr * 8.4);
  ctx.fillStyle = c.sun; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
  // far mountains (generic, soft)
  const hill = (base, amp, col, seed, k) => {
    ctx.beginPath(); ctx.moveTo(0, hz + 2);
    for (let x = 0; x <= w + 8; x += 8) ctx.lineTo(x, base - amp * (0.5 * Math.sin(x / (s * k) + seed) + 0.32 * Math.sin(x / (s * k * 0.42) + seed * 2.2) + 0.18 * Math.sin(x / (s * k * 0.17) + seed * 3.3) + 0.5));
    ctx.lineTo(w + 8, hz + 2); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  };
  hill(hz - s * 0.35, s * 1.6, c.far, 1.7, 3.2);
  if (!c.night) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, hz - s * 0.9, w, s * 0.5); }
  hill(hz - s * 0.05, s * 0.9, c.mid, 4.3, 2.0);
  // sea
  const sg = ctx.createLinearGradient(0, hz, 0, gy);
  sg.addColorStop(0, c.sea[1]); sg.addColorStop(1, c.sea[0]);
  ctx.fillStyle = sg; ctx.fillRect(0, hz, w, gy - hz + 2);
  // sea glitter (static dashes)
  ctx.strokeStyle = c.night ? 'rgba(255,200,170,0.35)' : 'rgba(255,255,255,0.4)'; ctx.lineWidth = Math.max(1, s * 0.015);
  for (let i = 0; i < 90; i++) { const x = pseudo(i) * w, y = hz + 4 + pseudo(i + 50) * (gy - hz - 10), l = s * (0.12 + pseudo(i + 9) * 0.3); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l, y); ctx.stroke(); }
  // sun path on the water
  const pg = ctx.createLinearGradient(sx, hz, sx, gy);
  pg.addColorStop(0, c.night ? 'rgba(255,190,140,0.5)' : 'rgba(255,250,220,0.55)'); pg.addColorStop(1, 'rgba(255,250,220,0)');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.moveTo(sx - sr * 0.8, hz); ctx.lineTo(sx + sr * 0.8, hz); ctx.lineTo(sx + sr * 3.2, gy); ctx.lineTo(sx - sr * 3.2, gy); ctx.closePath(); ctx.fill();
  // far boats / sails
  if (!c.night) {
    for (let i = 0; i < 3; i++) { const bx = X(2 + i * 5.7) + pseudo(i) * s, by = hz + s * 0.12; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(bx, by - s * 0.38); ctx.lineTo(bx + s * 0.2, by); ctx.lineTo(bx, by); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#2f4a6b'; ctx.fillRect(bx - s * 0.1, by, s * 0.34, s * 0.05); }
  }
}

function drawPalm(ctx, x, base, h, s, lean, col, trunk) {
  ctx.strokeStyle = trunk; ctx.lineWidth = s * 0.17; ctx.lineCap = 'round';
  const tx = x + lean * s, ty = base - h * s;
  ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + lean * s * 0.2, base - h * s * 0.55, tx, ty); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = s * 0.03;
  for (let i = 1; i < 9; i++) { const t = i / 9; const bx = x + (tx - x) * t * t * 0.9, by = base - h * s * t; ctx.beginPath(); ctx.moveTo(bx - s * 0.08, by); ctx.lineTo(bx + s * 0.08, by - s * 0.025); ctx.stroke(); }
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * 0.95 + (i / 8) * Math.PI * 0.9 + (lean > 0 ? 0.08 : -0.08), len = s * (1.0 + 0.25 * Math.sin(i * 1.7 + x));
    const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.62 + len * 0.28 * (Math.abs(Math.cos(a)));
    ctx.fillStyle = i % 2 ? col : '#2f8a4a';
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo((tx + ex) / 2, Math.min(ty, ey) - len * 0.22, ex, ey); ctx.quadraticCurveTo((tx + ex) / 2, Math.min(ty, ey) - len * 0.02, tx, ty + s * 0.03); ctx.fill();
  }
  ctx.fillStyle = '#6b4a22'; ctx.beginPath(); ctx.arc(tx - s * 0.05, ty + s * 0.08, s * 0.07, 0, TAU); ctx.arc(tx + s * 0.08, ty + s * 0.1, s * 0.06, 0, TAU); ctx.fill();
}
function drawLeafy(ctx, x, base, h, s, col, col2, bloom) {
  ctx.fillStyle = '#5e4326'; ctx.fillRect(x - s * 0.1, base - h * s * 0.55, s * 0.2, h * s * 0.55);
  const r = s * (0.9 + h * 0.18);
  const blob = (dx, dy, rad, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + dx * s, base - h * s * 0.55 + dy * s, rad, 0, TAU); ctx.fill(); };
  blob(-0.5, -0.1, r * 0.8, col2); blob(0.6, -0.15, r * 0.75, col2); blob(0, -0.6, r * 0.9, col); blob(-0.1, 0.05, r * 0.7, col);
  if (bloom) { ctx.fillStyle = bloom; for (let i = 0; i < 26; i++) { ctx.beginPath(); ctx.arc(x + (pseudo(i + x) - 0.5) * r * 2.0, base - h * s * 0.55 - r * 0.3 + (pseudo(i * 3 + x) - 0.5) * r * 1.5, s * 0.06, 0, TAU); ctx.fill(); } }
}
function drawUmbrella(ctx, x, base, s, c1, c2) {
  ctx.strokeStyle = '#d8d0c0'; ctx.lineWidth = s * 0.04; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + s * 0.06, base - s * 1.3); ctx.stroke();
  const cx = x + s * 0.06, cy = base - s * 1.3, r = s * 0.62;
  for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? c1 : c2; ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.12); ctx.arc(cx, cy, r, Math.PI + (i / 6) * Math.PI, Math.PI + ((i + 1) / 6) * Math.PI); ctx.closePath(); ctx.fill(); }
}
function drawKiosk(ctx, x, base, s, c) {
  ctx.fillStyle = '#f4ead2'; ctx.fillRect(x, base - s * 1.1, s * 1.5, s * 1.1);
  ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - s * 0.12, base - s * 1.1); ctx.lineTo(x + s * 0.75, base - s * 1.55); ctx.lineTo(x + s * 1.62, base - s * 1.1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7a4a24'; ctx.fillRect(x + s * 0.18, base - s * 0.8, s * 0.5, s * 0.8);
  ctx.fillStyle = 'rgba(40,130,160,0.65)'; ctx.fillRect(x + s * 0.85, base - s * 0.85, s * 0.46, s * 0.4);
}
function drawSpectator(ctx, x, base, s, sk, shirt, seated) {
  const h = seated ? 0.55 : 0.95;
  ctx.fillStyle = shirt; rr(ctx, x - s * 0.1, base - h * s, s * 0.2, h * s * 0.7, s * 0.06); ctx.fill();
  ctx.fillStyle = sk; ctx.beginPath(); ctx.arc(x, base - (h + 0.1) * s, s * 0.085, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a1c14'; ctx.beginPath(); ctx.arc(x, base - (h + 0.13) * s, s * 0.085, Math.PI, TAU); ctx.fill();
}

function paintNear(ctx, w, h, s, gy, c, stageH) {
  const X = (wx) => (wx - WORLD_X0) * s;
  const base = gy - 0.3 * s;           // the far edge of the court
  // beach / ground plane
  const sandTop = gy - 0.72 * s;
  const sg = ctx.createLinearGradient(0, sandTop, 0, stageH);
  sg.addColorStop(0, c.sand[0]); sg.addColorStop(1, c.sand[1]);
  // shoreline wave strip
  ctx.fillStyle = c.stone ? '#8fb38a' : 'rgba(255,255,255,0.55)';
  if (!c.stone) { ctx.beginPath(); ctx.moveTo(0, sandTop); for (let x = 0; x <= w + 10; x += 10) ctx.lineTo(x, sandTop - s * 0.04 - s * 0.05 * Math.sin(x / (s * 0.7))); ctx.lineTo(w, sandTop + s * 0.06); ctx.lineTo(0, sandTop + s * 0.06); ctx.fill(); }
  ctx.fillStyle = sg; ctx.fillRect(0, sandTop + (c.stone ? 0 : s * 0.05), w, stageH - sandTop);
  // scenery behind the court: trees, kiosks, umbrellas, spectators
  const scenery = () => {
    const base2 = sandTop + s * 0.05;
    if (c.tree === 'palm') {
      [[-2.6, 3.4, -0.5], [0.4, 2.7, 0.3], [7.0, 3.1, -0.3], [11.2, 3.5, 0.5], [14.4, 2.9, -0.4]].forEach(([x, hh, l], i) => drawPalm(ctx, X(x), base2 + s * 0.05, hh, s, l, i % 2 ? '#3da35a' : '#58bf62', '#8a6a3c'));
    } else {
      [[-2.4, 3.3], [1.0, 2.5], [5.2, 3.0], [9.6, 3.4], [13.6, 2.8]].forEach(([x, hh], i) => drawLeafy(ctx, X(x), base2 + s * 0.05, hh, s, '#3f8f4f', '#2f6f3d', i % 2 ? '#b57be6' : '#e6a8f0'));
      // low colonial houses (secular, generic)
      [[-1.0, '#f2d6a2'], [3.0, '#d7ecd0'], [8.0, '#f6c7b6'], [12.0, '#cfe2f0']].forEach(([x, col], i) => { const hx = X(x), hh = s * (1.3 + (i % 2) * 0.3); ctx.fillStyle = col; ctx.fillRect(hx, base2 - hh, s * 2.2, hh); ctx.fillStyle = '#b5543a'; ctx.beginPath(); ctx.moveTo(hx - s * 0.1, base2 - hh); ctx.lineTo(hx + s * 1.1, base2 - hh - s * 0.55); ctx.lineTo(hx + s * 2.3, base2 - hh); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(60,90,120,0.6)'; ctx.fillRect(hx + s * 0.3, base2 - hh * 0.75, s * 0.4, s * 0.45); ctx.fillRect(hx + s * 1.3, base2 - hh * 0.75, s * 0.4, s * 0.45); });
    }
    if (!c.stone) {
      drawKiosk(ctx, X(-3.2), base2, s, c.accent);
      drawKiosk(ctx, X(12.9), base2, s, '#2fb5a6');
      [[-0.9, '#ff7a2b', '#fff3d0'], [2.2, '#2a62d9', '#fff3d0'], [9.4, '#e8392c', '#fff3d0'], [11.2, '#ffd23c', '#ffffff']].forEach(([x, a, b]) => drawUmbrella(ctx, X(x), base2 + s * 0.04, s * 0.9, a, b));
    }
    // a few people far away
    const sk = ['#d9a273', '#8d5a3b', '#f0c9a4', '#b97a50'], sh = ['#e5483a', '#1fb5a6', '#f4c534', '#7a4fd0', '#2a62d9'];
    for (let i = 0; i < 9; i++) { const wx = WORLD_X0 + 0.7 + pseudo(i + 3) * (WORLD_X1 - WORLD_X0 - 1.4); if (wx > -0.4 && wx < 12.4) continue; drawSpectator(ctx, X(wx), base2 + s * 0.14, s, sk[i % 4], sh[i % 5], i % 3 === 0); }
    for (let i = 0; i < 5; i++) { const wx = 0.8 + pseudo(i + 40) * 10.6; drawSpectator(ctx, X(wx), base2 + s * 0.02, s * 0.6, sk[(i + 1) % 4], sh[(i + 2) % 5], true); }
  };
  scenery();
  // court: the playing strip gets a slightly different shade, with tape lines
  const cy0 = gy - 0.62 * s, cy1 = gy + 0.7 * s;
  const cg = ctx.createLinearGradient(0, cy0, 0, cy1);
  cg.addColorStop(0, c.stone ? '#c9c2ad' : 'rgba(255,255,255,0.12)'); cg.addColorStop(1, c.stone ? '#a89f86' : 'rgba(180,130,60,0.18)');
  ctx.fillStyle = cg; ctx.fillRect(X(-0.9), cy0, X(COURT + 0.9) - X(-0.9), cy1 - cy0);
  if (c.stone) {
    // portuguese pavement waves, stylised
    ctx.strokeStyle = 'rgba(40,40,40,0.22)'; ctx.lineWidth = s * 0.05;
    for (let k = 0; k < 5; k++) { ctx.beginPath(); for (let x = X(-0.9); x <= X(COURT + 0.9); x += 8) ctx.lineTo(x, cy0 + (k + 0.5) * (cy1 - cy0) / 5 + Math.sin(x / (s * 0.5) + k) * s * 0.06); ctx.stroke(); }
  } else {
    ctx.fillStyle = 'rgba(160,110,50,0.1)';
    for (let i = 0; i < 220; i++) ctx.fillRect(pseudo(i) * w, sandTop + pseudo(i + 7) * (stageH - sandTop), Math.max(1, s * 0.02), Math.max(1, s * 0.012));
  }
  // lines
  ctx.lineCap = 'butt'; ctx.strokeStyle = c.line; ctx.lineWidth = Math.max(2, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(X(0), cy0); ctx.lineTo(X(COURT), cy0); ctx.lineTo(X(COURT), cy1); ctx.lineTo(X(0), cy1); ctx.closePath(); ctx.stroke();
  ctx.lineWidth = Math.max(1.5, s * 0.03); ctx.globalAlpha = 0.75;
  ctx.beginPath(); ctx.moveTo(X(NET), cy0); ctx.lineTo(X(NET), cy1); ctx.stroke(); ctx.globalAlpha = 1;
  // net: posts + mesh drawn as a skewed panel, with the white top band
  const nd = 0.34 * s;                         // visual depth offset of the far post
  const bn = [X(NET), cy1 - s * 0.08], bf = [X(NET) + nd * 0.55, cy0 + s * 0.1];
  const hN = NET_H * s;
  const mesh = (alpha) => {
    ctx.beginPath(); ctx.moveTo(bn[0], bn[1] - hN * 0.0); ctx.lineTo(bn[0], bn[1] - hN); ctx.lineTo(bf[0], bf[1] - hN); ctx.lineTo(bf[0], bf[1]); ctx.closePath();
    ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.fill();
  };
  // net shadow on the sand
  ctx.fillStyle = 'rgba(40,30,10,0.14)'; ctx.beginPath(); ctx.moveTo(bn[0], bn[1]); ctx.lineTo(bf[0], bf[1]); ctx.lineTo(bf[0] + s * 0.6, bf[1] + s * 0.05); ctx.lineTo(bn[0] + s * 0.55, bn[1] + s * 0.02); ctx.closePath(); ctx.fill();
  mesh(0.26);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(1.2, s * 0.016);
  const rows = 9, cols = 8;
  for (let i = 1; i < rows; i++) { const z = (hN * i) / rows; ctx.beginPath(); ctx.moveTo(bn[0], bn[1] - z); ctx.lineTo(bf[0], bf[1] - z); ctx.stroke(); }
  for (let i = 0; i <= cols; i++) { const t = i / cols, x = bn[0] + (bf[0] - bn[0]) * t, y = bn[1] + (bf[1] - bn[1]) * t; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - hN); ctx.stroke(); }
  // top tape and bottom tape
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(3, s * 0.085); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(bn[0], bn[1] - hN); ctx.lineTo(bf[0], bf[1] - hN); ctx.stroke();
  ctx.strokeStyle = c.accent; ctx.lineWidth = Math.max(2, s * 0.03);
  ctx.beginPath(); ctx.moveTo(bn[0], bn[1] - hN + s * 0.06); ctx.lineTo(bf[0], bf[1] - hN + s * 0.06); ctx.stroke();
  // posts
  const post = (p, col) => { ctx.strokeStyle = col; ctx.lineWidth = Math.max(3, s * 0.07); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - hN - s * 0.12); ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p[0], p[1] - hN - s * 0.14, s * 0.06, 0, TAU); ctx.fill(); };
  post(bf, '#6f7a86'); post(bn, '#9aa5b1');
  ctx.fillStyle = 'rgba(40,30,10,0.2)'; ctx.beginPath(); ctx.ellipse(bn[0], bn[1] + 2, s * 0.15, s * 0.04, 0, 0, TAU); ctx.fill();
  // string lights for the dusk court
  if (c.night) {
    ctx.strokeStyle = 'rgba(40,20,40,0.7)'; ctx.lineWidth = Math.max(1, s * 0.015);
    for (let seg = 0; seg < 5; seg++) { const x0 = X(-3 + seg * 4.6), x1 = X(-3 + (seg + 1) * 4.6); ctx.beginPath(); ctx.moveTo(x0, gy - 3.7 * s); ctx.quadraticCurveTo((x0 + x1) / 2, gy - 3.1 * s, x1, gy - 3.7 * s); ctx.stroke();
      for (let i = 1; i < 6; i++) { const t = i / 6, x = x0 + (x1 - x0) * t, y = (1 - t) * (1 - t) * (gy - 3.7 * s) + 2 * t * (1 - t) * (gy - 3.1 * s) + t * t * (gy - 3.7 * s); const gl = ctx.createRadialGradient(x, y + s * 0.08, 1, x, y + s * 0.08, s * 0.34); gl.addColorStop(0, 'rgba(255,210,120,0.95)'); gl.addColorStop(1, 'rgba(255,170,80,0)'); ctx.fillStyle = gl; ctx.fillRect(x - s * 0.35, y - s * 0.26, s * 0.7, s * 0.7); ctx.fillStyle = '#fff2c2'; ctx.beginPath(); ctx.arc(x, y + s * 0.08, s * 0.045, 0, TAU); ctx.fill(); } }
  }
}

function cached(slot, key, w, h, k, paint) {
  if (typeof OffscreenCanvas === 'undefined') return null;
  const e = CACHE[slot];
  if (e.key !== key) {
    try {
      const cv = new OffscreenCanvas(Math.max(2, Math.round(w * k)), Math.max(2, Math.round(h * k)));
      const cc = cv.getContext('2d'); cc.scale(k, k);
      paint(cc);
      CACHE[slot] = { key, canvas: cv };
    } catch { CACHE[slot] = { key: '', canvas: null }; return null; }
  }
  return CACHE[slot].canvas;
}

// Draws the whole backdrop for the stage: far layer (parallax) and the court layer (locked to the world).
export function drawBackdrop(ctx, cam, courtIdx) {
  const c = COURTS[courtIdx] ?? COURTS[0], st = cam.stage, s = cam.s;
  const tr = ctx.getTransform ? ctx.getTransform() : null;
  const k = clampv(tr && tr.a ? tr.a : 1, 1, 2);
  const w = (WORLD_X1 - WORLD_X0) * s, h = st.h;
  const gyL = cam.gy - st.y;
  const keyFar = `${Math.round(s * 10)}|${Math.round(h)}|${Math.round(gyL)}|${courtIdx}|${k.toFixed(1)}`;
  const far = cached('far', keyFar, w, h, k, (cc) => paintFar(cc, w, h, s, gyL, c));
  const near = cached('near', keyFar, w, h, k, (cc) => { cc.clearRect(0, 0, w, h); paintNear(cc, w, h, s, gyL, c, h); });
  ctx.save();
  ctx.beginPath(); ctx.rect(st.x, st.y, st.w, st.h); ctx.clip();
  const parCam = 6 + (cam.camX - 6) * 0.35;
  const fx = cam.cx - (parCam - WORLD_X0) * s, nx = cam.cx - (cam.camX - WORLD_X0) * s;
  if (far) ctx.drawImage(far, fx, st.y, w, h);
  else { ctx.save(); ctx.translate(fx, st.y); paintFar(ctx, w, h, s, gyL, c); ctx.restore(); }
  if (near) ctx.drawImage(near, nx, st.y, w, h);
  else { ctx.save(); ctx.translate(nx, st.y); paintNear(ctx, w, h, s, gyL, c, h); ctx.restore(); }
  ctx.restore();
}

// Moving parts: clouds, sea glints and bird shapes (all deterministic in t)
export function drawAmbient(ctx, cam, courtIdx, t) {
  const c = COURTS[courtIdx] ?? COURTS[0], st = cam.stage, s = cam.s, hz = cam.gy - 2.05 * s;
  ctx.save(); ctx.beginPath(); ctx.rect(st.x, st.y, st.w, st.h); ctx.clip();
  ctx.fillStyle = c.cloud;
  for (let i = 0; i < 5; i++) {
    const sp = 0.012 + i * 0.004, cxp = ((i * 0.23 + t * sp) % 1.3 - 0.15) * st.w, cyp = st.y + st.h * (0.12 + 0.09 * i) + Math.sin(t * 0.1 + i) * 4;
    const sc = s * (0.9 + (i % 3) * 0.4);
    for (const [dx, dy, r] of [[0, 0, 0.5], [0.5, -0.12, 0.42], [-0.5, 0.05, 0.36], [1.0, 0.05, 0.34]]) { ctx.beginPath(); ctx.ellipse(cxp + dx * sc, cyp + dy * sc, r * sc, r * sc * 0.5, 0, 0, TAU); ctx.fill(); }
  }
  // sparkles on the sea
  ctx.fillStyle = c.night ? 'rgba(255,220,190,0.8)' : 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 14; i++) { const a = 0.5 + 0.5 * Math.sin(t * 2.3 + i * 1.7); if (a < 0.6) continue; const x = st.x + pseudo(i + 77) * st.w, y = hz + 6 + pseudo(i + 21) * (cam.gy - hz - 14); ctx.globalAlpha = a; ctx.fillRect(x, y, s * 0.1, Math.max(1.5, s * 0.02)); }
  ctx.globalAlpha = 1;
  // gulls
  if (!c.night) { ctx.strokeStyle = 'rgba(40,50,70,0.7)'; ctx.lineWidth = Math.max(1.5, s * 0.02); for (let i = 0; i < 3; i++) { const x = st.x + ((i * 0.37 + t * 0.02) % 1) * st.w, y = st.y + st.h * 0.2 + i * s * 0.5 + Math.sin(t * 1.3 + i) * s * 0.1, f = Math.sin(t * 4 + i) * s * 0.06; ctx.beginPath(); ctx.moveTo(x - s * 0.18, y + f); ctx.quadraticCurveTo(x - s * 0.08, y - s * 0.1, x, y); ctx.quadraticCurveTo(x + s * 0.08, y - s * 0.1, x + s * 0.18, y + f); ctx.stroke(); } }
  ctx.restore();
}

// ---- the peteca --------------------------------------------------------------------------------------------------------------
// `u` = pixels per metre. ang: direction of flight in radians (math convention: +y up) so the base leads. Visual size is
// a little larger than life so the peteca reads on a phone.
export function drawPeteca(ctx, x, y, u, ang, design, t, alpha = 1, spin = false) {
  const d = PETECAS[design] ?? PETECAS[0];
  const S = u * 1.7;                                    // art scale: 1 unit = 1 m of real peteca * 1.7
  ctx.save(); ctx.translate(x, y); ctx.rotate(-ang); ctx.globalAlpha = alpha;
  // feathers trail behind the base (toward -x)
  const n = 5;
  for (const k of [0, 4, 1, 3, 2]) {
    const a = (k - 2) * 0.2 + Math.sin(t * 19 + k * 1.7) * 0.025;
    ctx.save(); ctx.rotate(Math.PI + a);
    const L = 0.3 * S, wd = 0.055 * S;
    const col = d.mix ? d.mix[k % d.mix.length] : null;
    const g = ctx.createLinearGradient(0, 0, L, 0);
    g.addColorStop(0, col || d.f[1]); g.addColorStop(0.7, col || d.f[0]); g.addColorStop(1, d.tip);
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(30,20,10,0.45)'; ctx.lineWidth = Math.max(0.8, S * 0.012);
    ctx.beginPath(); ctx.moveTo(0.02 * S, 0);
    ctx.bezierCurveTo(L * 0.3, -wd * 1.2, L * 0.8, -wd * 1.1, L, 0);
    ctx.bezierCurveTo(L * 0.8, wd * 1.1, L * 0.3, wd * 1.2, 0.02 * S, 0);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(0.04 * S, 0); ctx.lineTo(L * 0.92, 0); ctx.stroke();
    ctx.restore();
  }
  // leather base (disc seen from the side), lit from above
  const bg = ctx.createLinearGradient(0, -0.07 * S, 0, 0.07 * S);
  bg.addColorStop(0, d.base[0]); bg.addColorStop(1, d.base[1]);
  ctx.fillStyle = bg; ctx.strokeStyle = 'rgba(30,16,6,0.7)'; ctx.lineWidth = Math.max(1, S * 0.016);
  ctx.beginPath(); ctx.ellipse(0.0, 0, 0.055 * S, 0.075 * S, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,240,200,0.55)'; ctx.beginPath(); ctx.ellipse(-0.012 * S, -0.03 * S, 0.02 * S, 0.028 * S, 0, 0, TAU); ctx.fill();
  if (spin) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(1.5, S * 0.02); ctx.beginPath(); ctx.arc(0, 0, 0.17 * S, t * 12, t * 12 + 2.2); ctx.stroke(); }
  ctx.restore();
}

// A soft shadow on the sand under the peteca: grows and darkens as it falls.
export function drawShadow(ctx, x, y, rx, ry, a = 0.28) {
  ctx.save(); ctx.fillStyle = `rgba(40,25,10,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); ctx.restore();
}

// ---- particles -------------------------------------------------------------------------------------------------------------------
export function stepFx(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const q = list[i];
    q.t += dt;
    if (q.t >= q.max) { list.splice(i, 1); continue; }
    q.x += q.vx * dt; q.z += q.vz * dt;
    if (q.kind === 0) { q.vz -= 1.6 * dt; q.vx *= 0.98; if (q.z < 0) { q.z = 0; q.vz = 0; } }
    else if (q.kind === 1) { q.vz -= 6 * dt; if (q.z < 0) { q.z = 0; q.vz *= -0.35; q.vx *= 0.6; } }
    else if (q.kind === 3) { q.vz -= 2.2 * dt; q.vx *= 0.97; q.rot += q.spin * dt; if (q.z < 0) { q.z = 0; q.vz = 0; q.vx = 0; q.spin = 0; } }
    else if (q.kind === 4) { q.vz -= 5 * dt; q.rot += q.spin * dt; }
  }
}
// kinds: 0 sand puff, 1 spark, 2 ring, 3 feather, 4 confetti
export function drawFx(ctx, cam, list) {
  const s = cam.s;
  for (const q of list) {
    const k = q.t / q.max, a = 1 - k;
    const x = cam.X(q.x), y = cam.Y(q.z);
    if (q.kind === 0) { ctx.fillStyle = `rgba(232,200,140,${0.5 * a})`; ctx.beginPath(); ctx.arc(x, y, q.size * s * (1 + k * 1.6), 0, TAU); ctx.fill(); }
    else if (q.kind === 1) { ctx.fillStyle = q.col; ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, y, Math.max(1.2, q.size * s), 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    else if (q.kind === 2) { ctx.strokeStyle = q.col; ctx.globalAlpha = a; ctx.lineWidth = Math.max(2, s * 0.05 * a + 1); ctx.beginPath(); ctx.arc(x, y, q.size * s * (0.25 + k), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    else if (q.kind === 3) { ctx.save(); ctx.translate(x, y); ctx.rotate(q.rot); ctx.globalAlpha = Math.min(1, a * 1.6); ctx.fillStyle = q.col; ctx.beginPath(); ctx.ellipse(0, 0, q.size * s * 1.1, q.size * s * 0.38, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    else if (q.kind === 4) { ctx.save(); ctx.translate(x, y); ctx.rotate(q.rot); ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = q.col; ctx.fillRect(-q.size * s, -q.size * s * 0.5, q.size * s * 2, q.size * s); ctx.restore(); }
  }
  ctx.globalAlpha = 1;
}

export const labelFont = (px, w = 700) => `${w} ${px}px ${FONT}`;

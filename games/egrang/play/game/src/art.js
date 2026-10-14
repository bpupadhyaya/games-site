// Egrang: all the painting that is not a person or the interface. A village festival road in four depth lanes: sky, a volcano ridge,
// rice terraces, palms, bamboo, houses, bunting, a crowd, the road with its hazards, the start and finish. Pure canvas 2D; every
// function is a function of its arguments and the clock passed in (no wall clock, no random: scenery uses a position hash).
import { tileAt, groundH } from './courses.js';

export const PAL = {
  ink: '#1a1030', deep: '#2a1a4a', gold: '#ffd77a', goldDeep: '#d29a34', cream: '#fff5df', text: '#fdf3df', dim: 'rgba(253,243,223,0.66)',
  teal: '#2fb6a3', tealHi: '#8ef0dc', saffron: '#f08a24', ember: '#e0502c', rose: '#ff8aa0', leaf: '#4fae45', bamboo: '#a8b648', water: '#4cb8d8',
};
export const DISPLAY = '"Dela Gothic One", Impact, "Arial Black", system-ui, sans-serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const ease = (x) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
export const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const mixHex = (a, b, t) => {
  const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(((p >> s) & 255) * (1 - t) + ((q >> s) & 255) * t);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};

export const LANE_DY = 0.36;           // metres of screen depth between lanes
export const laneScale = (lane) => 1 - 0.065 * (3 - lane);

// The camera: world x of the left edge, pixels per metre, and the ground line of the front lane.
export function makeCam(S, camX, ppm, groundFrac = 0.8) {
  return { S, x: camX, ppm, gy: S.y + S.h * groundFrac, laneDy: S.h > S.w * 1.15 ? 0.5 : 0.38 };
}
// A road point to the screen. my is metres above the road surface of that x.
export function proj(cam, lane, mx, my = 0, C = null) {
  const k = cam.ppm * laneScale(lane), gh = C ? groundH(C, mx) : 0;
  return { x: cam.S.x + (mx - cam.x) * cam.ppm, y: cam.gy - (3 - lane) * cam.laneDy * cam.ppm - (gh + my) * k, k };
}

// ---- backdrop ----------------------------------------------------------------------------------------------------------------------
export function drawBackdrop(ctx, S, cam, C, t, o = {}) {
  const th = C.theme, hz = cam.gy - 3 * cam.laneDy * cam.ppm - 0.55 * cam.ppm;
  const sk = ctx.createLinearGradient(0, S.y, 0, hz);
  sk.addColorStop(0, th.sky[0]); sk.addColorStop(0.55, th.sky[1]); sk.addColorStop(1, th.sky[2]);
  ctx.fillStyle = sk; ctx.fillRect(S.x, S.y, S.w, hz - S.y + 2);
  // sun glow and clouds
  const sx = S.x + S.w * 0.78, sy = S.y + (hz - S.y) * 0.3;
  const g = ctx.createRadialGradient(sx, sy, 4, sx, sy, Math.max(S.w, S.h) * 0.45);
  g.addColorStop(0, 'rgba(255,248,214,0.95)'); g.addColorStop(0.08, 'rgba(255,236,170,0.55)'); g.addColorStop(1, 'rgba(255,220,140,0)');
  ctx.fillStyle = g; ctx.fillRect(S.x, S.y, S.w, hz - S.y);
  const par = (f) => -((cam.x * f * cam.ppm) % 4000);
  for (let i = 0; i < 6; i++) {
    const w = (140 + hash(i) * 180) * (cam.ppm / 100), x = S.x + ((hash(i * 3 + 1) * 1.4 * S.w + par(0.02) + t * (6 + i * 1.5)) % (S.w * 1.5 + 400) + (S.w * 1.5 + 400)) % (S.w * 1.5 + 400) - 200;
    const y = S.y + (hz - S.y) * (0.1 + 0.4 * hash(i * 7));
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.ellipse(x + (j - 1.5) * w * 0.22, y + (j % 2 ? -3 : 3), w * 0.2, w * 0.085, 0, 0, TAU); ctx.fill(); }
  }
  // festival kites: a few diamonds with long tails drifting in the sky
  for (let i = 0; i < 3; i++) {
    const kx = S.x + ((hash(i * 5 + 2) * S.w * 1.3 + par(0.05) + Math.sin(t * 0.5 + i) * 18) % (S.w * 1.3) + S.w * 1.3) % (S.w * 1.3) - S.w * 0.1;
    const ky = S.y + (hz - S.y) * (0.16 + 0.2 * hash(i * 9 + 1)) + Math.sin(t * 0.9 + i * 2) * 8, ks = Math.max(26, cam.ppm * 0.3);
    const cols = ['#ff4f8b', '#ffb43c', '#7c5cff'];
    ctx.save(); ctx.translate(kx, ky); ctx.rotate(Math.sin(t * 0.8 + i) * 0.18);
    ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.moveTo(0, -ks); ctx.lineTo(ks * 0.62, 0); ctx.lineTo(0, ks * 1.15); ctx.lineTo(-ks * 0.62, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(0, -ks); ctx.lineTo(ks * 0.62, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,24,10,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -ks); ctx.lineTo(0, ks * 1.15); ctx.moveTo(-ks * 0.62, 0); ctx.lineTo(ks * 0.62, 0); ctx.stroke();
    ctx.strokeStyle = cols[(i + 1) % 3]; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, ks * 1.15);
    for (let q = 1; q <= 7; q++) ctx.lineTo(Math.sin(t * 3 + q * 0.9 + i) * ks * 0.35, ks * 1.15 + q * ks * 0.32);
    ctx.stroke(); ctx.restore();
  }
  // the volcano ridge: two layers of far mountains with haze
  const ridge = (f, col, base, amp, seed, cone) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(S.x, hz + 2);
    const off = cam.x * f * cam.ppm;
    for (let px = 0; px <= S.w; px += 8) {
      const wx = (px + off) / (cam.ppm * 7);
      let h = base + amp * (0.5 + 0.5 * Math.sin(wx * 1.7 + seed) * 0.6 + 0.5 * Math.sin(wx * 0.6 + seed * 2) * 0.4);
      if (cone) { const c = ((wx + seed) % 9 + 9) % 9 - 4.5; h += Math.max(0, 1 - Math.abs(c) / 1.5) * amp * 1.5; }
      ctx.lineTo(S.x + px, hz - h * Math.max(cam.ppm * 0.9, S.h * 0.17));
    }
    ctx.lineTo(S.x + S.w, hz + 2); ctx.closePath(); ctx.fill();
  };
  ridge(0.015, th.mount[1], 0.55, 0.9, 1.3, true);
  const hzg = ctx.createLinearGradient(0, hz - cam.ppm * 2.4, 0, hz);
  hzg.addColorStop(0, rgba(th.haze, 0)); hzg.addColorStop(1, rgba(th.haze, 0.6));
  ctx.fillStyle = hzg; ctx.fillRect(S.x, hz - cam.ppm * 2.4, S.w, cam.ppm * 2.4);
  ridge(0.035, th.mount[0], 0.3, 0.6, 4.1, false);
  // rice terraces and the village band between the ridge and the road
  const bandTop = hz - cam.ppm * 0.35, bandBot = cam.gy - 3 * cam.laneDy * cam.ppm - 0.3 * cam.ppm;
  const tg = ctx.createLinearGradient(0, bandTop, 0, bandBot);
  tg.addColorStop(0, mixHex(th.grass, th.haze, 0.45)); tg.addColorStop(1, th.grass);
  ctx.fillStyle = tg; ctx.fillRect(S.x, bandTop, S.w, bandBot - bandTop + 4);
  const off = cam.x * 0.2 * cam.ppm;
  for (let i = 0; i < 5; i++) {
    const y = bandTop + (bandBot - bandTop) * (i / 5);
    ctx.strokeStyle = i % 2 ? 'rgba(255,255,200,0.16)' : 'rgba(20,70,30,0.14)'; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let px = 0; px <= S.w; px += 10) { const yy = y + Math.sin((px + off) / (60 + i * 14) + i) * 4 * (cam.ppm / 100); if (px === 0) ctx.moveTo(S.x, yy); else ctx.lineTo(S.x + px, yy); }
    ctx.stroke();
  }
  // houses, palms and bamboo clumps, in world space at 0.5 parallax (so they drift slower than the road)
  const sc = cam.ppm / 100, f = 0.45, vis0 = cam.x * f - 3, vis1 = vis0 + S.w / cam.ppm + 6;
  for (let i = Math.floor(vis0 / 5.5); i <= Math.ceil(vis1 / 5.5); i++) {
    const h = hash(i * 1.37 + C.seed), wx = i * 5.5 + h * 2, px = S.x + (wx - cam.x * f) * cam.ppm, by = bandBot - (0.05 + hash(i * 9.1) * 0.5) * cam.ppm * 0.6;
    if (h < 0.34) house(ctx, px, by, 150 * sc * (0.8 + h), h);
    else if (h < 0.68) palm(ctx, px, by, 260 * sc * (0.7 + h * 0.5), t + i);
    else bambooClump(ctx, px, by, 230 * sc, t + i, i);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.0)';
  return { hz, bandTop, bandBot };
}

function house(ctx, x, y, w, h) {
  const wall = h > 0.17 ? '#d8b98a' : '#c99f6a', roof = h > 0.17 ? '#9a4a34' : '#7a3a2a';
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(x, y + 2, w * 0.55, w * 0.07, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#6a4a2a'; for (const dx of [-0.38, -0.12, 0.12, 0.38]) ctx.fillRect(x + dx * w - 2, y - w * 0.12, 4, w * 0.12);   // stilts
  ctx.fillStyle = wall; ctx.fillRect(x - w * 0.42, y - w * 0.5, w * 0.84, w * 0.38);
  ctx.fillStyle = 'rgba(70,40,20,0.35)'; for (let i = 1; i < 6; i++) ctx.fillRect(x - w * 0.42 + i * w * 0.84 / 6, y - w * 0.5, 1.5, w * 0.38);
  ctx.fillStyle = '#ffd77a'; ctx.fillRect(x - w * 0.08, y - w * 0.42, w * 0.16, w * 0.28);
  ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x - w * 0.3, y - w * 0.4, w * 0.14, w * 0.14);
  ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x - w * 0.56, y - w * 0.48); ctx.lineTo(x - w * 0.2, y - w * 0.82); ctx.lineTo(x + w * 0.2, y - w * 0.82); ctx.lineTo(x + w * 0.56, y - w * 0.48); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,200,150,0.22)'; ctx.beginPath(); ctx.moveTo(x - w * 0.2, y - w * 0.82); ctx.lineTo(x + w * 0.2, y - w * 0.82); ctx.lineTo(x + w * 0.56, y - w * 0.48); ctx.lineTo(x + w * 0.1, y - w * 0.5); ctx.closePath(); ctx.fill();
}
function palm(ctx, x, y, h, t) {
  const sway = Math.sin(t * 0.8) * h * 0.012;
  ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = Math.max(3, h * 0.045); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + h * 0.08, y - h * 0.5, x + h * 0.04 + sway, y - h); ctx.stroke();
  const tx = x + h * 0.04 + sway, ty = y - h;
  ctx.strokeStyle = '#2f8a3a'; ctx.lineWidth = Math.max(2, h * 0.03);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.95 + i * (Math.PI * 0.9 / 6), L = h * 0.42;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a) * L * 0.6, ty + Math.sin(a) * L * 0.6 - L * 0.25, tx + Math.cos(a) * L, ty + Math.sin(a) * L * 0.55 + L * 0.3); ctx.stroke();
  }
  ctx.fillStyle = '#7a5a2a'; ctx.beginPath(); ctx.arc(tx - 3, ty + 5, h * 0.025, 0, TAU); ctx.arc(tx + 4, ty + 6, h * 0.025, 0, TAU); ctx.fill();
}
function bambooClump(ctx, x, y, h, t, i) {
  for (let j = 0; j < 6; j++) {
    const hh = h * (0.7 + hash(i * 3 + j) * 0.5), dx = (j - 2.5) * h * 0.04, lean = (hash(i + j * 5) - 0.5) * h * 0.14 + Math.sin(t * 0.7 + j) * 2;
    ctx.strokeStyle = j % 2 ? '#8fa23a' : '#a8b648'; ctx.lineWidth = Math.max(3, h * 0.026); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + dx, y); ctx.quadraticCurveTo(x + dx + lean * 0.4, y - hh * 0.5, x + dx + lean, y - hh); ctx.stroke();
    ctx.fillStyle = '#5f9a34';
    for (let l = 0; l < 3; l++) { ctx.beginPath(); ctx.ellipse(x + dx + lean + (l - 1) * h * 0.06, y - hh + l * 6, h * 0.07, h * 0.016, (l - 1) * 0.5, 0, TAU); ctx.fill(); }
  }
}

// ---- the road ------------------------------------------------------------------------------------------------------------------------
export function drawRoad(ctx, S, cam, C) {
  const th = C.theme, x0 = cam.x - 1, x1 = cam.x + S.w / cam.ppm + 1;
  const step = 0.5, i0 = Math.floor(x0 / step), i1 = Math.ceil(x1 / step);
  // below the horizon: grass verge at the back and front, the road band between the back lane and the front lane
  const edgeBack = (mx) => proj(cam, 0, mx, 0, C).y - 0.3 * cam.ppm * laneScale(0), edgeFront = (mx) => proj(cam, 3, mx, 0, C).y + 0.32 * cam.ppm;
  // verge
  ctx.fillStyle = th.grass;
  ctx.beginPath(); ctx.moveTo(S.x, edgeBack(x0));
  for (let i = i0; i <= i1; i++) ctx.lineTo(S.x + (i * step - cam.x) * cam.ppm, edgeBack(i * step));
  ctx.lineTo(S.x + S.w, S.y + S.h); ctx.lineTo(S.x, S.y + S.h); ctx.closePath(); ctx.fill();
  // the road surface in vertical strips (colour varies a little with position)
  for (let i = i0; i < i1; i++) {
    const ax = S.x + (i * step - cam.x) * cam.ppm, bx = S.x + ((i + 1) * step - cam.x) * cam.ppm;
    const yb0 = edgeBack(i * step), yb1 = edgeBack((i + 1) * step), yf0 = edgeFront(i * step), yf1 = edgeFront((i + 1) * step);
    const tile = tileAt(C, i * step + step / 2);
    const wave = 0.5 + 0.5 * Math.sin(i * 0.31 + C.seed) * Math.cos(i * 0.113);
    let col = mixHex(th.road, th.roadHi, 0.25 + 0.5 * wave);
    if (tile === 'mud') col = '#6b4328';
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(ax, yb0); ctx.lineTo(bx + 0.6, yb1); ctx.lineTo(bx + 0.6, yf1); ctx.lineTo(ax, yf0); ctx.closePath(); ctx.fill();
  }
  // dust wash at the front edge
  const fy = edgeFront(cam.x);
  const lg = ctx.createLinearGradient(0, fy - 40, 0, fy + 10);
  lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(60,30,10,0.25)');
  ctx.fillStyle = lg; ctx.fillRect(S.x, fy - 40, S.w, 50);
  // lane lines (chalk) every 10 m and the start and finish
  for (let m = Math.ceil(x0 / 10) * 10; m < x1; m += 10) {
    if (m < 0 || m > C.length) continue;
    const a = proj(cam, 0, m, 0, C), b = proj(cam, 3, m, 0, C);
    ctx.strokeStyle = m === 0 || m === C.length ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.28)'; ctx.lineWidth = m === 0 || m === C.length ? 5 : 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y - 0.3 * a.k); ctx.lineTo(b.x, b.y + 0.32 * cam.ppm); ctx.stroke();
    if (m > 0 && m < C.length) {
      ctx.font = `700 ${Math.max(12, 0.17 * cam.ppm)}px ${UI}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(`${m} m`, b.x, b.y + 0.55 * cam.ppm);
    }
  }
  return { edgeBack, edgeFront };
}

// Terrain that sits ON the road: puddles, holes, rocks, stones in the stream, plank bridges, mud, drawn across all four lanes.
export function drawTerrain(ctx, S, cam, C, t) {
  const x0 = cam.x - 2, x1 = cam.x + S.w / cam.ppm + 2;
  const lanePt = (lane, mx) => proj(cam, lane, mx, 0, C);
  const bandY = (mx) => [lanePt(0, mx).y - 0.28 * cam.ppm * laneScale(0), lanePt(3, mx).y + 0.3 * cam.ppm];
  for (const g of C.segs) {
    if (g.x1 < x0 || g.x0 > x1) continue;
    const steps = Math.max(2, Math.ceil((g.x1 - g.x0) / 0.5));
    const poly = (fn) => {
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) { const mx = g.x0 + (g.x1 - g.x0) * i / steps, p = lanePt(0, mx), yy = bandY(mx); const X = S.x + (mx - cam.x) * cam.ppm; if (i === 0) ctx.moveTo(X, yy[0]); else ctx.lineTo(X, yy[0]); void p; }
      for (let i = steps; i >= 0; i--) { const mx = g.x0 + (g.x1 - g.x0) * i / steps, yy = bandY(mx); ctx.lineTo(S.x + (mx - cam.x) * cam.ppm, yy[1]); }
      ctx.closePath(); fn();
    };
    if (g.kind === 'stream') {
      poly(() => { const gr = ctx.createLinearGradient(0, S.y, 0, S.y + S.h); gr.addColorStop(0, '#6fd0ea'); gr.addColorStop(1, '#2a8fb8'); ctx.fillStyle = gr; ctx.fill(); });
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      for (let r = 0; r < 8; r++) { const y = S.y + S.h * (0.4 + r * 0.07); ctx.beginPath(); for (let px = 0; px <= S.w; px += 14) { const yy = y + Math.sin(px / 30 + t * 2.2 + r) * 2.4; if (px === 0) ctx.moveTo(S.x, yy); else ctx.lineTo(S.x + px, yy); } ctx.stroke(); }
      ctx.restore();
    } else if (g.kind === 'mud') {
      poly(() => { ctx.fillStyle = '#5a3a22'; ctx.fill(); });
      ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(255,220,170,0.12)';
      for (let i = 0; i < 40; i++) { const mx = g.x0 + hash(i * 1.7) * (g.x1 - g.x0), lane = Math.floor(hash(i * 3.3) * 4), p = lanePt(lane, mx); ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.18 * p.k, 0.05 * p.k, 0, 0, TAU); ctx.fill(); }
      ctx.restore();
    } else if (g.kind === 'plank' || g.kind === 'bund') {
      const bridge = g.kind === 'plank';
      if (bridge) {
        // the water under the bridge
        poly(() => { ctx.fillStyle = '#3aa4c6'; ctx.fill(); });
        // the deck (all lanes) with plank gaps and rails along the back and front edges
        for (let i = 0; i < steps * 2; i++) {
          const mx = g.x0 + (g.x1 - g.x0) * i / (steps * 2), nx = g.x0 + (g.x1 - g.x0) * (i + 1) / (steps * 2);
          const a = bandY(mx), b = bandY(nx), ax = S.x + (mx - cam.x) * cam.ppm, bx = S.x + (nx - cam.x) * cam.ppm;
          const dk = hash(i * 2.2 + 7) * 0.2;
          ctx.fillStyle = mixHex('#c58f55', '#7a4f26', dk); ctx.beginPath(); ctx.moveTo(ax, a[0] + 0.04 * cam.ppm); ctx.lineTo(bx - 1.2, a[0] + 0.04 * cam.ppm); ctx.lineTo(bx - 1.2, a[1] - 0.02 * cam.ppm); ctx.lineTo(ax, a[1] - 0.02 * cam.ppm); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = '#6a4a22'; ctx.lineWidth = 5;
        const rail = (lane, up) => { ctx.beginPath(); for (let i = 0; i <= steps; i++) { const mx = g.x0 + (g.x1 - g.x0) * i / steps, p = lanePt(lane, mx); const yy = p.y - up * p.k; if (i === 0) ctx.moveTo(S.x + (mx - cam.x) * cam.ppm, yy); else ctx.lineTo(S.x + (mx - cam.x) * cam.ppm, yy); } ctx.stroke(); };
        rail(0, 0.95);
      } else {
        // a raised earth bund with water either side
        poly(() => { ctx.fillStyle = mixHex(C.theme.road, '#3f2a18', 0.2); ctx.fill(); });
      }
    }
  }
  for (const s of C.spots) {
    if (s.x < x0 || s.x > x1) continue;
    for (let lane = 0; lane < 4; lane++) {
      const p = lanePt(lane, s.x), k = p.k;
      ctx.save();
      if (s.kind === 'puddle') {
        ctx.fillStyle = 'rgba(70,40,20,0.35)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 0.52 * k, 0.12 * k, 0, 0, TAU); ctx.fill();
        const g = ctx.createLinearGradient(p.x - 0.4 * k, 0, p.x + 0.4 * k, 0); g.addColorStop(0, '#9fd8ee'); g.addColorStop(0.5, '#e8f8fd'); g.addColorStop(1, '#7fc4e0');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.45 * k, 0.095 * k, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.3 * k * (0.7 + 0.1 * Math.sin(t * 2 + lane)), 0.06 * k, 0, 0, TAU); ctx.stroke();
      } else if (s.kind === 'hole') {
        ctx.fillStyle = 'rgba(40,20,8,0.55)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 0.01 * k, 0.5 * k, 0.12 * k, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1c0e06'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 0.02 * k, 0.4 * k, 0.085 * k, 0, 0, TAU); ctx.fill();
      } else if (s.kind === 'rock') {
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x + 0.05 * k, p.y + 0.02 * k, 0.3 * k, 0.07 * k, 0, 0, TAU); ctx.fill();
        const g = ctx.createRadialGradient(p.x - 0.07 * k, p.y - 0.16 * k, 0.02 * k, p.x, p.y - 0.08 * k, 0.28 * k); g.addColorStop(0, '#c4c0b6'); g.addColorStop(1, '#6f6a60');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y - 0.07 * k, 0.26 * k, 0.17 * k, 0, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }
  // stepping stones
  for (const sx of C.stones) {
    if (sx < x0 || sx > x1) continue;
    for (let lane = 0; lane < 4; lane++) {
      const p = lanePt(lane, sx), k = p.k;
      ctx.fillStyle = 'rgba(0,30,50,0.3)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 0.02 * k, 0.37 * k, 0.1 * k, 0, 0, TAU); ctx.fill();
      const g = ctx.createLinearGradient(0, p.y - 0.14 * k, 0, p.y + 0.05 * k); g.addColorStop(0, '#d7d2c4'); g.addColorStop(1, '#7d786c');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y - 0.03 * k, 0.32 * k, 0.1 * k, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(p.x, p.y + 0.02 * k, 0.37 * k, 0.1 * k, 0, 0.2, Math.PI - 0.2); ctx.stroke();
    }
  }
}

// ---- roadside: bunting poles, the crowd behind the back lane, start and finish arches --------------------------------------------------
const BUNT = ['#ff4f8b', '#ffb43c', '#2fc4b2', '#7c5cff', '#8fd13a', '#ff7a3c', '#33a8ff'];
export function drawRoadside(ctx, S, cam, C, t, o = {}) {
  const x0 = cam.x - 4, x1 = cam.x + S.w / cam.ppm + 4, k = cam.ppm;
  const yb = (mx) => proj(cam, 0, mx, 0, C).y - 0.34 * k;           // road edge, back
  // crowd: two rows standing behind the fence line
  const exc = o.excite ?? 0.3, pulse = o.pulse ?? 0;
  const g3 = o.crowd3d ? o.crowd3d() : false;       // the 3D crowd (web/view3d) is drawn here, before the fence and bunting
  for (let row = 1; row >= 0 && !g3; row--) {
    const sp = row ? 0.55 : 0.62;
    for (let i = Math.floor(x0 / sp); i <= Math.ceil(x1 / sp); i++) {
      const mx = i * sp + (row ? 0.28 : 0), h = hash(i * 1.9 + row * 17 + C.seed);
      if (mx < -6 || mx > C.length + 8 || h < 0.12) continue;
      const px = S.x + (mx - cam.x) * k, py = yb(mx) - (row ? 0.0 : 0.16) * k;
      const sz = (0.34 + h * 0.08) * k, bob = Math.sin(t * 3 + i * 1.3 + row) * (1 + exc * 3) * (k / 100) + pulse * exc * 2 * (k / 100);
      person(ctx, px, py - bob, sz, h, exc, t + i);
    }
    // the fence rail in front of the first row
    if (!row) continue;
  }
  ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = Math.max(3, 0.05 * k);
  ctx.beginPath(); for (let mx = x0; mx <= x1 + 0.5; mx += 0.5) { const X = S.x + (mx - cam.x) * k, Y = yb(mx) + 0.1 * k; if (mx === x0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); } ctx.stroke();
  ctx.strokeStyle = '#6a4a22'; ctx.lineWidth = Math.max(3, 0.06 * k);
  for (let mx = Math.ceil(x0 / 2) * 2; mx < x1; mx += 2) { const X = S.x + (mx - cam.x) * k, Y = yb(mx) + 0.1 * k; ctx.beginPath(); ctx.moveTo(X, Y - 0.35 * k); ctx.lineTo(X, Y + 0.35 * k); ctx.stroke(); }
  // bunting: tall bamboo poles every 7 m with strings of pennants between them
  const pole = (mx) => ({ x: S.x + (mx - cam.x) * k, y: yb(mx) + 0.1 * k, top: yb(mx) + 0.1 * k - 3.3 * k });
  for (let m = Math.ceil((x0 - 7) / 7) * 7; m < x1 + 7; m += 7) {
    const a = pole(m), b = pole(m + 7);
    ctx.strokeStyle = '#8a7a2a'; ctx.lineWidth = Math.max(3, 0.07 * k);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x, a.top); ctx.stroke();
    const n = 12;
    ctx.strokeStyle = 'rgba(40,30,20,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let j = 0; j <= n; j++) { const q = j / n, X = a.x + (b.x - a.x) * q, Y = a.top + (b.top - a.top) * q + Math.sin(q * Math.PI) * 0.55 * k; if (j === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); }
    ctx.stroke();
    for (let j = 0; j < n; j++) {
      const q = (j + 0.5) / n, X = a.x + (b.x - a.x) * q, Y = a.top + (b.top - a.top) * q + Math.sin(q * Math.PI) * 0.55 * k, w = 0.22 * k, sw = Math.sin(t * 2.6 + j + m) * 0.03 * k;
      ctx.fillStyle = BUNT[(j + Math.floor(m / 7)) % BUNT.length];
      ctx.beginPath(); ctx.moveTo(X - w * 0.5, Y); ctx.lineTo(X + w * 0.5, Y); ctx.lineTo(X + sw, Y + w * 1.15); ctx.closePath(); ctx.fill();
    }
  }
  // start and finish arches
  const arch = (mx, label, col) => {
    if (mx < x0 - 2 || mx > x1 + 2) return;
    const a = pole(mx), p0 = proj(cam, 3, mx, 0, C);
    const L = { x: S.x + (mx - cam.x) * k, base: p0.y + 0.3 * k, top: yb(mx) - 3.9 * k };
    ctx.strokeStyle = '#8a7a2a'; ctx.lineWidth = Math.max(4, 0.1 * k);
    ctx.beginPath(); ctx.moveTo(L.x, L.base); ctx.lineTo(L.x, L.top); ctx.stroke();
    const rw = 0.5 * k, bandY = L.top;
    ctx.fillStyle = col; ctx.fillRect(L.x - 2.2 * k, bandY, 4.4 * k, 0.75 * k);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(L.x - 2.2 * k, bandY, 4.4 * k, 0.12 * k);
    ctx.font = `${0.4 * k}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff5df'; ctx.fillText(label, L.x, bandY + 0.38 * k);
    void rw; void a;
  };
  arch(0, 'START', '#2a8f86');
  arch(C.length, 'FINISH', '#c23a6a');
  // finish line tape drawn across the road is handled by drawRoad (a white chalk line)
}

// The grass strip in front of the road: tufts, flowers and a few kids' flip-flops, drawn after the racers.
export function drawForeground(ctx, S, cam, C, t) {
  const k = cam.ppm, y0 = proj(cam, 3, cam.x, 0, C).y + 0.32 * k, x0 = cam.x - 1, x1 = cam.x + S.w / k + 1;
  const vg = ctx.createLinearGradient(0, y0, 0, S.y + S.h);
  vg.addColorStop(0, 'rgba(20,70,20,0.0)'); vg.addColorStop(1, 'rgba(10,40,16,0.5)');
  ctx.fillStyle = vg; ctx.fillRect(S.x, y0, S.w, S.y + S.h - y0);
  const spanY = S.y + S.h - y0;
  for (let i = Math.floor(x0 * 3); i < x1 * 3; i++) {
    const h = hash(i * 1.31 + C.seed * 0.7), h2 = hash(i * 2.17 + 4);
    const x = S.x + (i / 3 - cam.x * 1.08) * k * 0.97 + h * 20, y = y0 + 6 + h2 * Math.max(10, spanY - 24);
    const s = (0.18 + h * 0.2) * k * (0.7 + (y - y0) / Math.max(20, spanY) * 0.8);
    ctx.strokeStyle = h > 0.5 ? '#2f7a2a' : '#3f9a38'; ctx.lineWidth = Math.max(2, s * 0.09); ctx.lineCap = 'round';
    for (let b = -2; b <= 2; b++) { const sw = Math.sin(t * 1.6 + i + b) * s * 0.06; ctx.beginPath(); ctx.moveTo(x + b * s * 0.08, y); ctx.quadraticCurveTo(x + b * s * 0.2 + sw, y - s * 0.5, x + b * s * 0.34 + sw * 1.5, y - s * (0.9 - Math.abs(b) * 0.12)); ctx.stroke(); }
    if (h2 > 0.62) { ctx.fillStyle = BUNT[Math.floor(h * 97) % BUNT.length]; ctx.beginPath(); ctx.arc(x + s * 0.2, y - s * 0.3, Math.max(2, s * 0.09), 0, TAU); ctx.fill(); }
  }
}

function person(ctx, x, y, sz, h, exc, t) {
  const skins = ['#b9774a', '#8a5532', '#d49a6a', '#a56a40', '#c68856', '#7a4a2c'];
  const shirts = ['#f3b21b', '#2fa79a', '#d9455f', '#6d4bd1', '#38a85a', '#e8791c', '#f06fa0', '#2c7fd1', '#fff3da'];
  const skin = skins[Math.floor(h * 97) % skins.length], shirt = shirts[Math.floor(h * 311) % shirts.length];
  const kid = h > 0.78;
  const s = kid ? sz * 0.72 : sz;
  ctx.fillStyle = shirt; ctx.beginPath(); ctx.roundRect(x - s * 0.5, y - s * 1.55, s, s * 1.45, s * 0.3); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x + s * 0.1, y - s * 1.45, s * 0.4, s * 1.3);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x, y - s * 1.85, s * 0.34, 0, TAU); ctx.fill();
  ctx.fillStyle = h > 0.5 ? '#1c120c' : '#2a1a10'; ctx.beginPath(); ctx.arc(x, y - s * 1.97, s * 0.34, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  if (h > 0.45 && exc > 0.2) {   // a waving arm
    ctx.strokeStyle = skin; ctx.lineWidth = s * 0.2; ctx.lineCap = 'round';
    const w = Math.sin(t * 6) * 0.4;
    ctx.beginPath(); ctx.moveTo(x + s * 0.4, y - s * 1.35); ctx.lineTo(x + s * (0.7 + w * 0.2), y - s * (2.1 + exc * 0.5)); ctx.stroke();
  }
}

// Particles live in road metres (x along the road, y above it) in a lane, so they stay put on the road while the camera moves.
export function burst(list, rng, x, y, lane, n, col, power = 1, up = 1) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), sp = rng.range(0.4, 1.7) * power;
    list.push({ x, y, lane, vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp * 1.3 * up + 0.6, life: 0, max: rng.range(0.35, 0.8), r: rng.range(2, 4.5), col });
  }
  if (list.length > 140) list.splice(0, list.length - 140);
}
export function stepParticles(list, dt) {
  for (const p of list) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 5.5 * dt; p.vx *= 1 - 1.3 * dt; if (p.y < 0) { p.y = 0; p.vy = 0; } }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].life >= list[i].max) list.splice(i, 1);
}
export function drawParticles(ctx, list, cam, C) {
  ctx.save();
  for (const p of list) {
    const a = 1 - p.life / p.max, q = proj(cam, p.lane, p.x, p.y, C);
    ctx.fillStyle = rgba(p.col, 0.85 * a); ctx.beginPath(); ctx.arc(q.x, q.y, p.r * (0.6 + 0.6 * a) * (cam.ppm / 100), 0, TAU); ctx.fill();
  }
  ctx.restore();
}
export function drawStars(ctx, cx, cy, size, n, total = 3, gap = 1.25) {
  for (let i = 0; i < total; i++) {
    const x = cx + (i - (total - 1) / 2) * size * gap * 2;
    ctx.save(); ctx.translate(x, cy); ctx.beginPath();
    for (let q = 0; q < 10; q++) { const r = q % 2 ? size * 0.45 : size, a = -Math.PI / 2 + q * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath();
    ctx.fillStyle = i < n ? '#ffd45a' : 'rgba(255,255,255,0.14)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = i < n ? '#a8741a' : 'rgba(255,255,255,0.25)'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  }
}

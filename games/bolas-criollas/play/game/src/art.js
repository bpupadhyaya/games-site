// Art: the dusk scenery, the sand and the ball sprites. Everything is procedural and drawn each frame in world space through a
// projection (`makeView`), so it stays crisp at every zoom. No images, no clock: `t` is the game's own time.
import { COURT } from './sim.js';
import { roundPath } from './ui.js';

const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

export const TEAM = [
  { name: 'Turquoise', hi: '#9ffff2', base: '#12b3a7', dark: '#053b37', ring: '#e9fffb' },
  { name: 'Crimson', hi: '#ffc4cf', base: '#e23a5c', dark: '#50081d', ring: '#fff0f3' },
];
export const MINGO = { hi: '#ffffff', base: '#f6efdc', dark: '#a59775' };

// ---- projection ----------------------------------------------------------------------------------------------------------
// An oblique "stage" view of the cancha: u runs left to right, the far board is at the top, the near board at the bottom.
// The far side is a little smaller (taper) so the ground reads as a floor, and height z lifts a point straight up.
export function makeView(rect, o) {
  const V = { rect, uc: o.uc, cx: o.cx ?? rect.x + rect.w / 2, kx: o.kx, ky: o.ky, kz: o.kz ?? o.kx, yFar: o.yFar, taper: o.taper ?? 0.1, minR: o.minR ?? 0 };
  V.H = 2 * COURT.half * V.ky;
  V.s = (v) => 1 - V.taper * (1 - (v + COURT.half) / (2 * COURT.half));
  V.x = (u, v) => V.cx + (u - V.uc) * V.kx * V.s(v);
  V.y = (v, z = 0) => V.yFar + ((v + COURT.half) / (2 * COURT.half)) * V.H - z * V.kz * V.s(v);
  V.rad = (r, v) => Math.max(V.minR, r * V.kx * V.s(v));
  V.inv = (sx, sy) => {
    const t = Math.max(0, Math.min(1, (sy - V.yFar) / V.H)), v = t * 2 * COURT.half - COURT.half;
    return { u: V.uc + (sx - V.cx) / (V.kx * V.s(v)), v };
  };
  return V;
}

// ---- scenery -------------------------------------------------------------------------------------------------------------
// Draws the sky, hills, palms, houses and lights above the far board, into `rect`, with the horizon at y = hy.
export function drawScenery(ctx, rect, hy, scale, t) {
  const { x, y, w } = rect, top = y, hgt = Math.max(10, hy - top);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, hy - y + 2); ctx.clip();
  const sky = ctx.createLinearGradient(0, top, 0, hy);
  sky.addColorStop(0, '#1d1450'); sky.addColorStop(0.45, '#7a3a86'); sky.addColorStop(0.8, '#f2745e'); sky.addColorStop(1, '#ffc27a');
  ctx.fillStyle = sky; ctx.fillRect(x, y, w, hy - y + 2);
  // sun
  const sg = ctx.createRadialGradient(x + w * 0.72, hy, 4, x + w * 0.72, hy, hgt * 1.4);
  sg.addColorStop(0, 'rgba(255,236,170,0.95)'); sg.addColorStop(0.25, 'rgba(255,170,110,0.5)'); sg.addColorStop(1, 'rgba(255,120,90,0)');
  ctx.fillStyle = sg; ctx.fillRect(x, y, w, hy - y + 2);
  // stars (fixed positions)
  const rs = lcg(77);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 26; i++) { const sx = x + rs() * w, sy = top + rs() * hgt * 0.45, tw = 0.5 + 0.5 * Math.sin(t * 1.7 + i * 2.1); ctx.globalAlpha = 0.35 + 0.5 * tw; ctx.fillRect(sx, sy, 2, 2); }
  ctx.globalAlpha = 1;
  // two layers of hills
  const hill = (col, amp, base, f1, f2, ph) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, hy);
    for (let i = 0; i <= 40; i++) { const px = x + (w * i) / 40, k = i / 40, ht = amp * (0.55 + 0.3 * Math.sin(k * f1 + ph) + 0.15 * Math.sin(k * f2 + ph * 1.7)); ctx.lineTo(px, hy - base - ht); }
    ctx.lineTo(x + w, hy); ctx.closePath(); ctx.fill();
  };
  hill('#5a3472', hgt * 0.5, hgt * 0.12, 7, 17, 0.6);
  hill('#3a2360', hgt * 0.38, hgt * 0.02, 5, 23, 2.4);
  // houses with lit windows
  const rh = lcg(31);
  for (let i = 0; i < 9; i++) {
    const hx = x + (i + 0.3 + rh() * 0.4) * (w / 9), hw = (22 + rh() * 26) * scale, hh = (18 + rh() * 24) * scale;
    ctx.fillStyle = i % 2 ? '#2c1b4d' : '#241540'; ctx.fillRect(hx, hy - hh, hw, hh);
    ctx.fillStyle = i % 3 ? '#ffd27a' : '#ffa86a';
    for (let k = 0; k < 2; k++) if (rh() < 0.8) ctx.fillRect(hx + hw * (0.2 + 0.4 * k), hy - hh * 0.65, hw * 0.18, hh * 0.22);
  }
  // palms
  const palm = (px, ph, lean) => {
    ctx.strokeStyle = '#150c2e'; ctx.fillStyle = '#150c2e'; ctx.lineWidth = Math.max(3, ph * 0.045); ctx.lineCap = 'round';
    const tx = px + lean, ty = hy - ph;
    ctx.beginPath(); ctx.moveTo(px, hy); ctx.quadraticCurveTo(px + lean * 0.2, hy - ph * 0.6, tx, ty); ctx.stroke();
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI * 0.95 + (k / 6) * Math.PI * 0.9 + Math.sin(t * 0.8 + px) * 0.04, L = ph * 0.46;
      ctx.lineWidth = Math.max(2, ph * 0.03);
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a) * L * 0.6, ty + Math.sin(a) * L * 0.6 - L * 0.25, tx + Math.cos(a) * L, ty + Math.sin(a) * L + L * 0.22); ctx.stroke();
    }
  };
  palm(x + w * 0.1, hgt * 0.9, 16 * scale); palm(x + w * 0.9, hgt * 1.0, -18 * scale); palm(x + w * 0.5, hgt * 0.55, 8 * scale);
  // string of lights
  ctx.strokeStyle = 'rgba(30,18,60,0.8)'; ctx.lineWidth = 1.5;
  const ly = top + hgt * 0.14;
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) { const px = x + (w * i) / 24, py = ly + Math.sin((i / 24) * Math.PI * 4) * 0 + Math.abs(Math.sin((i / 24) * Math.PI * 4)) * hgt * 0.1; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
  ctx.stroke();
  for (let i = 0; i <= 24; i += 2) {
    const px = x + (w * i) / 24, py = ly + Math.abs(Math.sin((i / 24) * Math.PI * 4)) * hgt * 0.1, k = 0.65 + 0.35 * Math.sin(t * 2 + i);
    const g = ctx.createRadialGradient(px, py, 0, px, py, 9 * scale); g.addColorStop(0, `rgba(255,226,140,${0.9 * k})`); g.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = g; ctx.fillRect(px - 10 * scale, py - 10 * scale, 20 * scale, 20 * scale);
    ctx.fillStyle = '#fff1b8'; ctx.beginPath(); ctx.arc(px, py, 2.2 * scale, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---- ground --------------------------------------------------------------------------------------------------------------
const SPECKS = (() => {
  const r = lcg(2026), a = [];
  for (let i = 0; i < 260; i++) a.push({ u: r() * COURT.len, v: (r() * 2 - 1) * COURT.half, s: 0.4 + r() * 0.9, tone: r() });
  return a;
})();
const PRINTS = (() => { const r = lcg(909), a = []; for (let i = 0; i < 10; i++) a.push({ u: 0.15 + r() * 1.7, v: (r() * 2 - 1) * 1.1, a: r() * 0.6 - 0.3 }); return a; })();

export function drawGround(ctx, V, surf, o = {}) {
  const near = COURT.half, far = -COURT.half;
  const uA = Math.max(-0.6, V.inv(V.rect.x, V.y(0)).u - 0.2), uB = Math.min(COURT.len + 1.2, V.inv(V.rect.x + V.rect.w, V.y(0)).u + 0.2);
  ctx.save();
  ctx.beginPath(); ctx.rect(V.rect.x, V.rect.y, V.rect.w, V.rect.h); ctx.clip();
  // base sand
  const gy0 = V.y(far), gy1 = V.y(near);
  const g = ctx.createLinearGradient(0, gy0, 0, gy1);
  g.addColorStop(0, '#c58a5a'); g.addColorStop(0.5, '#dca872'); g.addColorStop(1, '#efc98f');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(V.x(uA, far), gy0); ctx.lineTo(V.x(uB, far), gy0); ctx.lineTo(V.x(uB, near), gy1); ctx.lineTo(V.x(uA, near), gy1); ctx.closePath(); ctx.fill();
  // dune ripples across the court (soft darker bands), then patches
  for (let u = 0.6; u < COURT.len; u += 1.7) {
    ctx.fillStyle = 'rgba(120,70,40,0.07)';
    ctx.beginPath(); ctx.moveTo(V.x(u, far), gy0); ctx.lineTo(V.x(u + 0.55, far), gy0); ctx.lineTo(V.x(u + 0.55, near), gy1); ctx.lineTo(V.x(u, near), gy1); ctx.closePath(); ctx.fill();
  }
  for (const p of surf.patches) {
    const cx = V.x(p.u, p.v), cy = V.y(p.v), s = V.s(p.v), rx = p.ru * V.kx * s, ry = p.rv * V.ky;
    if (cx + rx < V.rect.x || cx - rx > V.rect.x + V.rect.w) continue;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx);
    const pg = ctx.createRadialGradient(0, 0, rx * 0.15, 0, 0, rx);
    if (p.kind === 'loose') { pg.addColorStop(0, 'rgba(120,58,26,0.62)'); pg.addColorStop(0.7, 'rgba(130,66,30,0.38)'); pg.addColorStop(1, 'rgba(130,66,30,0)'); }
    else { pg.addColorStop(0, 'rgba(255,236,196,0.75)'); pg.addColorStop(0.7, 'rgba(255,226,176,0.4)'); pg.addColorStop(1, 'rgba(255,226,176,0)'); }
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
    ctx.restore();
    if (o.detail) {   // pitted dots on loose sand, a glint on hard ground
      const rr = lcg(Math.round(p.u * 100 + p.v * 37));
      for (let i = 0; i < 26; i++) {
        const a = rr() * TAU, d = Math.sqrt(rr()) * 0.85, px = cx + Math.cos(a) * d * rx, py = cy + Math.sin(a) * d * ry;
        ctx.fillStyle = p.kind === 'loose' ? 'rgba(70,38,20,0.5)' : 'rgba(255,255,240,0.55)';
        ctx.beginPath(); ctx.arc(px, py, p.kind === 'loose' ? 2.2 : 1.6, 0, TAU); ctx.fill();
      }
    }
  }
  // specks
  for (const s of SPECKS) {
    if (s.u < uA || s.u > uB) continue;
    const px = V.x(s.u, s.v), py = V.y(s.v), sz = Math.max(1.2, s.s * V.kx * 0.035 * V.s(s.v));
    ctx.fillStyle = s.tone < 0.5 ? 'rgba(110,64,36,0.35)' : 'rgba(255,240,205,0.5)';
    ctx.fillRect(px, py, sz * 1.6, sz);
  }
  // rake lines along the court
  ctx.lineWidth = Math.max(1, V.kx * 0.015); ctx.strokeStyle = 'rgba(110,64,36,0.18)';
  for (const v of [-1.05, -0.35, 0.35, 1.05]) {
    ctx.beginPath(); ctx.moveTo(V.x(uA, v), V.y(v)); ctx.lineTo(V.x(uB, v), V.y(v)); ctx.stroke();
  }
  // footprints at the throwing line
  for (const p of PRINTS) {
    const px = V.x(p.u - 0.9, p.v), py = V.y(p.v), k = V.kx * 0.05;
    if (px < V.rect.x - 20 || px > V.rect.x + V.rect.w + 20) continue;
    ctx.fillStyle = 'rgba(110,64,36,0.28)'; ctx.beginPath(); ctx.ellipse(px, py, k * 1.7, k * 0.8, p.a, 0, TAU); ctx.fill();
  }
  // mingo zone, throwing line, dead line
  const za = COURT.zoneA, zb = COURT.zoneB;
  ctx.fillStyle = 'rgba(20,179,167,0.10)';
  ctx.beginPath(); ctx.moveTo(V.x(za, far), gy0); ctx.lineTo(V.x(zb, far), gy0); ctx.lineTo(V.x(zb, near), gy1); ctx.lineTo(V.x(za, near), gy1); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(14,140,130,0.75)'; ctx.lineWidth = Math.max(1.5, V.kx * 0.03); ctx.setLineDash([6, 8]);
  for (const u of [za, zb]) { ctx.beginPath(); ctx.moveTo(V.x(u, far), gy0); ctx.lineTo(V.x(u, near), gy1); ctx.stroke(); }
  ctx.setLineDash([]);
  const band = (u, w, col) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(V.x(u, far), gy0); ctx.lineTo(V.x(u + w, far), gy0); ctx.lineTo(V.x(u + w, near), gy1); ctx.lineTo(V.x(u, near), gy1); ctx.closePath(); ctx.fill();
  };
  band(-0.05, 0.1, 'rgba(255,252,240,0.95)');
  band(COURT.len, 0.2, 'rgba(160,40,40,0.85)');
  ctx.restore();
}

// Far board (behind the balls) and near board (in front of them): painted wood with a lit top edge.
export function drawBoards(ctx, V, which) {
  const far = -COURT.half, near = COURT.half;
  const uA = Math.max(-0.7, V.inv(V.rect.x, V.y(0)).u - 0.3), uB = Math.min(COURT.len + 1.4, V.inv(V.rect.x + V.rect.w, V.y(0)).u + 0.3);
  const planks = (v, yTop, yBot, side) => {
    const x0 = V.x(uA, v), x1 = V.x(uB, v);
    const g = ctx.createLinearGradient(0, yTop, 0, yBot);
    g.addColorStop(0, side ? '#c06a3a' : '#a85a30'); g.addColorStop(1, side ? '#7a3a1c' : '#5c2a14');
    ctx.fillStyle = g; ctx.fillRect(x0, yTop, x1 - x0, yBot - yTop);
    ctx.fillStyle = 'rgba(255,214,150,0.55)'; ctx.fillRect(x0, yTop, x1 - x0, Math.max(1.5, (yBot - yTop) * 0.12));
    ctx.strokeStyle = 'rgba(40,16,6,0.4)'; ctx.lineWidth = 1;
    for (let u = Math.ceil(uA); u <= uB; u++) { const px = V.x(u, v); ctx.beginPath(); ctx.moveTo(px, yTop); ctx.lineTo(px, yBot); ctx.stroke(); }
    // painted marks every two metres
    for (let u = 2; u <= COURT.len; u += 2) {
      const px = V.x(u, v), wd = (yBot - yTop) * 0.55;
      ctx.fillStyle = u % 4 ? 'rgba(255,200,87,0.85)' : 'rgba(20,179,167,0.9)';
      ctx.fillRect(px - wd / 2, yTop + (yBot - yTop) * 0.3, wd, (yBot - yTop) * 0.4);
    }
  };
  if (which === 'far') { const y1 = V.y(far), h = 0.55 * V.kz * V.s(far); planks(far, y1 - h, y1, 0); }
  else { const y1 = V.y(near), h = 0.5 * V.kz * V.s(near); planks(near, y1 - h * 0.15, y1 + h * 0.85, 1); }
}

// ---- balls ---------------------------------------------------------------------------------------------------------------
export function drawBall(ctx, V, b, o = {}) {
  const s = V.s(b.y), r = V.rad(b.r, b.y) * (o.grow ?? 1), gx = V.x(b.x, b.y), gy = V.y(b.y, 0);
  const lift = Math.max(0, b.z - b.r) * V.kz * s;
  const cy = gy - r * 0.9 - lift;
  // shadow on the sand
  const hh = Math.max(0, b.z - b.r), sa = 0.4 / (1 + hh * 1.3);
  ctx.fillStyle = `rgba(40,16,4,${sa})`;
  ctx.beginPath(); ctx.ellipse(gx + r * 0.25, gy - r * 0.05, r * (1.05 + hh * 0.2), r * 0.38, 0, 0, TAU); ctx.fill();
  const pal = b.k ? MINGO : TEAM[b.side] ?? TEAM[0];
  const g = ctx.createRadialGradient(gx - r * 0.35, cy - r * 0.4, r * 0.1, gx, cy, r * 1.05);
  g.addColorStop(0, pal.hi); g.addColorStop(0.45, pal.base); g.addColorStop(1, pal.dark);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gx, cy, r, 0, TAU); ctx.fill();
  if (!b.k && b.side === 1) { ctx.strokeStyle = pal.ring; ctx.lineWidth = Math.max(1.2, r * 0.14); ctx.beginPath(); ctx.arc(gx, cy, r * 0.58, 0, TAU); ctx.stroke(); }
  if (!b.k && b.side === 0) { ctx.fillStyle = pal.ring; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(gx, cy, r * 0.2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(gx - r * 0.36, cy - r * 0.42, r * 0.28, r * 0.16, -0.7, 0, TAU); ctx.fill();
  if (b.hit > 0) { ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, b.hit * 4)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(gx, cy, r * (1.2 + (0.25 - b.hit) * 3), 0, TAU); ctx.stroke(); }
  return { x: gx, y: cy, r };
}

export function ballIcon(ctx, x, y, r, side) {
  const pal = side < 0 ? MINGO : TEAM[side];
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
  g.addColorStop(0, pal.hi); g.addColorStop(0.45, pal.base); g.addColorStop(1, pal.dark);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  if (side === 1) { ctx.strokeStyle = pal.ring; ctx.lineWidth = Math.max(1.2, r * 0.14); ctx.beginPath(); ctx.arc(x, y, r * 0.58, 0, TAU); ctx.stroke(); }
  if (side === 0) { ctx.fillStyle = pal.ring; ctx.beginPath(); ctx.arc(x, y, r * 0.2, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(x - r * 0.36, y - r * 0.42, r * 0.28, r * 0.16, -0.7, 0, TAU); ctx.fill();
}

export { roundPath };

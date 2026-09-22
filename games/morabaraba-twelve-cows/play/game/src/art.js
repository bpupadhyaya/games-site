// The world behind the game: a dusk sky over the veld, the board scratched into red earth, painted geometric bands.
// Static layers are painted once into cached canvases; a few things (herd, dust, clouds) move every frame.
// One light, from the upper left (the low sun is behind the hills, so the board is lit softly from the left).
import { W, H, project } from './layout.js';
import { POINT_UV, RULES } from './morabaraba.js';

const TAU = Math.PI * 2;
export const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); };
// earth pigments used by the bands (decoration only)
export const PIGMENT = { ochre: '#e2a22c', clay: '#c4502a', teal: '#2b8f8c', bone: '#f1e2c2', night: '#2a1410', sand: '#d98d5a', blue: '#3a5fa0' };

// ---- a painted geometric band along a straight strip (used for panels, buttons and the title) ----
export function band(ctx, x, y, w, h, seed = 1) {
  const c = [PIGMENT.ochre, PIGMENT.clay, PIGMENT.teal, PIGMENT.bone], u = h, n = Math.max(1, Math.round(w / u)), uw = w / n;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = PIGMENT.night; ctx.fillRect(x, y, w, h);
  for (let i = 0; i < n; i++) {
    const x0 = x + i * uw, a = c[(i + seed) % 4], b = c[(i + seed + 2) % 4];
    ctx.fillStyle = a; ctx.beginPath(); ctx.moveTo(x0 + uw * 0.06, y + h * 0.94); ctx.lineTo(x0 + uw / 2, y + h * 0.1); ctx.lineTo(x0 + uw * 0.94, y + h * 0.94); ctx.closePath(); ctx.fill();
    ctx.fillStyle = PIGMENT.night; ctx.beginPath(); ctx.moveTo(x0 + uw * 0.3, y + h * 0.94); ctx.lineTo(x0 + uw / 2, y + h * 0.52); ctx.lineTo(x0 + uw * 0.7, y + h * 0.94); ctx.closePath(); ctx.fill();
    ctx.fillStyle = b; ctx.beginPath(); ctx.moveTo(x0 + uw * 0.42, y + h * 0.94); ctx.lineTo(x0 + uw / 2, y + h * 0.72); ctx.lineTo(x0 + uw * 0.58, y + h * 0.94); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = PIGMENT.bone; ctx.fillRect(x, y, w, Math.max(1.5, h * 0.05)); ctx.fillRect(x, y + h - Math.max(1.5, h * 0.05), w, Math.max(1.5, h * 0.05));
  ctx.restore();
}

// ---- the backdrop: sky, sun, hills, acacia, earth ----
export const HORIZON = 372;
function paintBackdrop(ctx) {
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON + 10);
  sky.addColorStop(0, '#2a1a3e'); sky.addColorStop(0.35, '#7a2f4c'); sky.addColorStop(0.68, '#d8613a'); sky.addColorStop(0.9, '#f2a24c'); sky.addColorStop(1, '#f9cf7a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HORIZON + 10);
  const rnd = lcg(11);
  for (let i = 0; i < 46; i++) { ctx.fillStyle = `rgba(255,236,210,${0.15 + rnd() * 0.5})`; ctx.fillRect(rnd() * W, rnd() * 130, 1.6, 1.6); }        // first stars in the dark of the sky
  // long cloud streaks lit from below
  for (let i = 0; i < 9; i++) {
    const y = 120 + i * 24 + rnd() * 10, x = rnd() * W, w = 180 + rnd() * 320;
    const g = ctx.createLinearGradient(0, y - 6, 0, y + 8); g.addColorStop(0, 'rgba(255,190,120,0)'); g.addColorStop(0.5, `rgba(255,${170 + i * 8},120,${0.18 + rnd() * 0.16})`); g.addColorStop(1, 'rgba(120,40,70,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, w, 7 + rnd() * 5, 0, 0, TAU); ctx.fill();
  }
  // the low sun
  const sx = 520, sy = HORIZON - 34;
  const halo = ctx.createRadialGradient(sx, sy, 10, sx, sy, 330); halo.addColorStop(0, 'rgba(255,224,150,0.85)'); halo.addColorStop(0.3, 'rgba(255,170,90,0.42)'); halo.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, W, HORIZON + 10);
  ctx.fillStyle = '#fff2c4'; ctx.beginPath(); ctx.arc(sx, sy, 46, 0, TAU); ctx.fill();
  // hills: far to near, each darker and warmer
  const ridge = (base, amp, seed, color, flat) => {
    const r = lcg(seed); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, HORIZON + 40);
    let y = base; for (let x = 0; x <= W + 20; x += 20) { y += (r() - 0.5) * amp; y = Math.max(base - amp * 2.2, Math.min(base + amp * 2.2, y)); ctx.lineTo(x, y); }
    ctx.lineTo(W, HORIZON + 40); ctx.closePath(); ctx.fill();
    return flat;
  };
  ridge(HORIZON - 40, 8, 5, '#a04a58'); ridge(HORIZON - 22, 9, 8, '#7b3550');
  // a flat-topped kopje on the left
  ctx.fillStyle = '#5e2a44'; ctx.beginPath(); ctx.moveTo(-10, HORIZON + 6); ctx.lineTo(30, HORIZON - 70); ctx.lineTo(70, HORIZON - 96); ctx.lineTo(150, HORIZON - 98); ctx.lineTo(196, HORIZON - 70); ctx.lineTo(250, HORIZON - 14); ctx.lineTo(300, HORIZON + 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,170,110,0.26)'; ctx.beginPath(); ctx.moveTo(70, HORIZON - 96); ctx.lineTo(150, HORIZON - 98); ctx.lineTo(160, HORIZON - 88); ctx.lineTo(64, HORIZON - 86); ctx.closePath(); ctx.fill();
  ridge(HORIZON - 4, 7, 21, '#4a2036');
  // an acacia with a flat crown
  const ax = 610, ay = HORIZON - 2;
  ctx.strokeStyle = '#231018'; ctx.lineCap = 'round'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(ax - 8, ay - 44, ax - 22, ay - 82); ctx.stroke();
  ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(ax - 12, ay - 58); ctx.quadraticCurveTo(ax + 6, ay - 76, ax + 34, ay - 92); ctx.stroke();
  ctx.fillStyle = '#231018';
  for (const [dx, dy, rx, ry] of [[-24, -96, 58, 14], [12, -104, 46, 12], [-56, -88, 36, 10], [40, -96, 40, 10], [-8, -112, 34, 8]]) { ctx.beginPath(); ctx.ellipse(ax + dx, ay + dy, rx, ry, -0.04, 0, TAU); ctx.fill(); }
  // the earth
  const gr = ctx.createLinearGradient(0, HORIZON, 0, H);
  gr.addColorStop(0, '#6d2a1c'); gr.addColorStop(0.12, '#8d3d24'); gr.addColorStop(0.55, '#7a3220'); gr.addColorStop(1, '#4e1d14');
  ctx.fillStyle = gr; ctx.fillRect(0, HORIZON + 8, W, H - HORIZON - 8);
  const rg = lcg(77);
  for (let i = 0; i < 2600; i++) { const x = rg() * W, y = HORIZON + 10 + rg() * (H - HORIZON), l = rg() < 0.5; ctx.fillStyle = l ? `rgba(230,150,100,${0.05 + rg() * 0.1})` : `rgba(30,8,4,${0.06 + rg() * 0.12})`; ctx.fillRect(x, y, 1 + rg() * 2.6, 1 + rg() * 1.6); }
  for (let i = 0; i < 40; i++) { const x = rg() * W, y = HORIZON + 30 + rg() * (H - HORIZON - 40), r = 2 + rg() * 5; ctx.fillStyle = 'rgba(30,10,6,0.28)'; ctx.beginPath(); ctx.ellipse(x + 1.5, y + 1.6, r, r * 0.6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = `rgba(190,110,80,${0.35 + rg() * 0.3})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.62, 0, 0, TAU); ctx.fill(); }
  // horizon dust haze
  const hz = ctx.createLinearGradient(0, HORIZON - 12, 0, HORIZON + 46); hz.addColorStop(0, 'rgba(255,190,120,0)'); hz.addColorStop(0.4, 'rgba(255,170,100,0.5)'); hz.addColorStop(1, 'rgba(255,150,90,0)');
  ctx.fillStyle = hz; ctx.fillRect(0, HORIZON - 12, W, 60);
  // low-sun light across the ground (from the upper left, warm) and a dark vignette at the edges
  const lit = ctx.createRadialGradient(150, HORIZON + 40, 20, 150, HORIZON + 40, 900); lit.addColorStop(0, 'rgba(255,190,120,0.22)'); lit.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = lit; ctx.fillRect(0, HORIZON, W, H - HORIZON);
  const vg = ctx.createRadialGradient(W / 2, H * 0.55, 400, W / 2, H * 0.55, 1000); vg.addColorStop(0, 'rgba(20,4,2,0)'); vg.addColorStop(1, 'rgba(20,4,2,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

// ---- the board: earth slab with a painted frame, incised lines, dished points ----
const EDGE = 3.3, FRAME = 3.66;
const rectPts = (e) => [project(-e, -e), project(e, -e), project(e, e), project(-e, e)];
export const BOARD_SEGMENTS = (() => { const out = []; RULES.adj.forEach((a, i) => a.forEach((j) => { if (i < j) out.push([i, j]); })); return out; })();

function paintBoard(ctx) {
  const outer = rectPts(FRAME), face = rectPts(EDGE);
  // shadow on the ground
  for (let i = 0; i < 9; i++) { ctx.fillStyle = 'rgba(15,3,1,0.09)'; poly(ctx, outer.map((p) => ({ x: p.x + 6 + i * 2, y: p.y + 14 + i * 3.4 }))); ctx.fill(); }
  // frame: raised clay rim
  const fr = ctx.createLinearGradient(0, outer[0].y, 0, outer[2].y); fr.addColorStop(0, '#5a2a1c'); fr.addColorStop(1, '#3a1810');
  ctx.fillStyle = fr; poly(ctx, outer); ctx.fill();
  ctx.strokeStyle = 'rgba(255,190,140,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(outer[3].x, outer[3].y); ctx.lineTo(outer[0].x, outer[0].y); ctx.lineTo(outer[1].x, outer[1].y); ctx.stroke();   // lit upper edges
  ctx.strokeStyle = 'rgba(10,2,0,0.6)'; ctx.beginPath(); ctx.moveTo(outer[1].x, outer[1].y); ctx.lineTo(outer[2].x, outer[2].y); ctx.lineTo(outer[3].x, outer[3].y); ctx.stroke();
  // painted geometric border: cells go around the ring, each a triangle pointing at the board (decoration only)
  const ring = (u0, v0, du, dv, nx, ny, k) => {         // one cell whose base runs from (u0,v0) along (du,dv), tip toward (nx,ny)
    const a = project(u0, v0), b = project(u0 + du, v0 + dv), c = project(u0 + du / 2 + nx, v0 + dv / 2 + ny);
    const cols = [PIGMENT.ochre, PIGMENT.clay, PIGMENT.teal, PIGMENT.bone];
    ctx.fillStyle = cols[k % 4]; poly(ctx, [a, b, c]); ctx.fill();
    const a2 = project(u0 + du * 0.3 + nx * 0.4, v0 + dv * 0.3 + ny * 0.4), b2 = project(u0 + du * 0.7 + nx * 0.4, v0 + dv * 0.7 + ny * 0.4), c2 = project(u0 + du / 2 + nx * 0.72, v0 + dv / 2 + ny * 0.72);
    ctx.fillStyle = PIGMENT.night; poly(ctx, [a2, b2, c2]); ctx.fill();
  };
  const t = 0.36, cells = 18, cw = (2 * FRAME) / cells;
  for (let i = 0; i < cells; i++) {
    const s = -FRAME + i * cw;
    ring(s, -FRAME, cw, 0, 0, t, i); ring(s + cw, FRAME, -cw, 0, 0, -t, i + 1);
    ring(FRAME, s, 0, cw, -t, 0, i + 2); ring(-FRAME, s + cw, 0, -cw, t, 0, i + 3);
  }
  // earth face
  const eg = ctx.createLinearGradient(face[0].x, face[0].y, face[2].x, face[2].y); eg.addColorStop(0, '#b0603a'); eg.addColorStop(0.5, '#9a4a2c'); eg.addColorStop(1, '#833a22');
  ctx.save(); poly(ctx, face); ctx.fillStyle = eg; ctx.fill(); ctx.clip();
  const rnd = lcg(303), bx = face[0].x, by = face[0].y, bw = face[2].x - face[0].x, bh = face[2].y - face[0].y;
  for (let i = 0; i < 2800; i++) { const x = bx + rnd() * bw, y = by + rnd() * bh; ctx.fillStyle = rnd() < 0.5 ? `rgba(240,170,120,${0.06 + rnd() * 0.12})` : `rgba(50,14,6,${0.06 + rnd() * 0.14})`; ctx.fillRect(x, y, 1 + rnd() * 2.4, 1 + rnd() * 1.6); }
  for (let i = 0; i < 26; i++) { const x = bx + rnd() * bw, y = by + rnd() * bh, r = 1.5 + rnd() * 4; ctx.fillStyle = 'rgba(40,12,6,0.3)'; ctx.beginPath(); ctx.ellipse(x + 1, y + 1.4, r, r * 0.6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(205,130,96,0.5)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0, 0, TAU); ctx.fill(); }
  // broad soft light from the left and a shade toward the lower right
  const lg = ctx.createRadialGradient(face[0].x + 60, face[0].y + 40, 20, face[0].x + 60, face[0].y + 40, 720); lg.addColorStop(0, 'rgba(255,200,150,0.22)'); lg.addColorStop(1, 'rgba(255,200,150,0)');
  ctx.fillStyle = lg; ctx.fillRect(bx, by, bw, bh);
  ctx.restore();
  // inner edge of the frame: a thin shadow line where the earth sits lower than the rim
  ctx.strokeStyle = 'rgba(20,4,0,0.65)'; ctx.lineWidth = 3; poly(ctx, face); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,190,140,0.28)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(face[1].x, face[1].y + 2); ctx.lineTo(face[2].x, face[2].y + 2); ctx.lineTo(face[3].x, face[3].y + 2); ctx.stroke();
  // incised lines: sunlit lip on the lower right, dark groove, deep core
  const pts = POINT_UV.map(([u, v]) => project(u, v));
  const stroke = (col, w, dx, dy) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); for (const [i, j] of BOARD_SEGMENTS) { ctx.moveTo(pts[i].x + dx, pts[i].y + dy); ctx.lineTo(pts[j].x + dx, pts[j].y + dy); } ctx.stroke(); };
  stroke('rgba(255,205,160,0.55)', 8.5, 1.6, 1.8); stroke('rgba(38,10,5,0.9)', 8, 0, 0); stroke('rgba(14,3,1,0.85)', 4.2, -0.6, -0.7);
  // dished points
  for (let i = 0; i < 24; i++) {
    const p = pts[i], rx = 17 * p.s, ry = rx * 0.82;
    ctx.fillStyle = 'rgba(255,205,160,0.5)'; ctx.beginPath(); ctx.ellipse(p.x + 1.4, p.y + 1.8, rx + 1.5, ry + 1.5, 0, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(p.x + rx * 0.3, p.y + ry * 0.35, 1, p.x, p.y, rx); g.addColorStop(0, '#5a2414'); g.addColorStop(0.7, '#2e0f08'); g.addColorStop(1, '#1a0703');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(10,2,0,0.7)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, TAU); ctx.stroke();
  }
}

// ---- cached layers ----
const layers = {};
function cached(name, w, h, scale, paint) {
  if (!(name in layers)) {
    layers[name] = null;
    try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(w * scale, h * scale), l = c.getContext('2d'); l.scale(scale, scale); paint(l); layers[name] = c; } } catch { layers[name] = null; }
  }
  return layers[name];
}
export function drawBackdrop(ctx) { const c = cached('back', W, H, 2, paintBackdrop); if (c) ctx.drawImage(c, 0, 0, W, H); else paintBackdrop(ctx); }
export function drawBoard(ctx) { const c = cached('board', W, H, 2, paintBoard); if (c) ctx.drawImage(c, 0, 0, W, H); else paintBoard(ctx); }

// ---- things that move every frame ----
// A herd walking along the far ridge; each cow's legs swing. Silhouettes only, so they stay readable at any size.
function herdCow(ctx, x, y, s, ph, dir) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
  ctx.fillStyle = '#1e0c14'; ctx.strokeStyle = '#1e0c14'; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(0, -22, 26, 12, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(24, -30, 9, 6.5, -0.5, 0, TAU); ctx.fill();
  ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(26, -35); ctx.quadraticCurveTo(24, -46, 32, -46); ctx.moveTo(22, -35); ctx.quadraticCurveTo(16, -44, 20, -49); ctx.stroke();
  ctx.lineWidth = 4;
  for (const [lx, off] of [[-16, 0], [-8, Math.PI], [10, Math.PI], [18, 0]]) { const sw = Math.sin(ph + off) * 6; ctx.beginPath(); ctx.moveTo(lx, -16); ctx.lineTo(lx + sw, -1); ctx.stroke(); }
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-26, -26); ctx.quadraticCurveTo(-34, -20, -32, -8 + Math.sin(ph) * 2); ctx.stroke();
  ctx.restore();
}
export function drawLife(ctx, t, calm) {
  const k = calm ? 0.25 : 1;
  // drifting dust in the low light
  const r = lcg(5);
  for (let i = 0; i < 26; i++) {
    const sp = 6 + r() * 10, x = ((r() * W + t * sp * k) % (W + 40)) - 20, y = HORIZON - 60 + r() * 130 + Math.sin(t * 0.7 + i) * 6 * k, a = 0.12 + r() * 0.2;
    ctx.fillStyle = `rgba(255,214,150,${a})`; ctx.beginPath(); ctx.arc(x, y, 1.4 + r() * 2, 0, TAU); ctx.fill();
  }
  // the herd
  const y0 = HORIZON + 4;
  for (let i = 0; i < 6; i++) {
    const s = 0.5 + (i % 3) * 0.06, x = ((i * 148 + t * 9 * k) % (W + 200)) - 100, ph = t * 3.2 * k + i * 1.7;
    herdCow(ctx, x, y0 + (i % 2) * 5, s, ph, 1);
  }
}
export { poly, TAU };

// The world behind the porter: sky that follows the day clock, snow peaks, ridges, terraced hills, a valley below the
// trail, the trail itself with its rest platforms, stone steps and suspension bridges, and the village at the end.
// Pure drawing: reads a model, never changes game state. World units: 100 per metre, y up in the engine, y down on screen.
import { groundY, segAt, K } from './engine.js';
import { drawPorter, drawGood } from './porter.js';
import { mix } from './ui.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (n) => { n = Math.imul((n | 0) ^ ((n | 0) >>> 15), 2246822507); n = Math.imul(n ^ (n >>> 13), 3266489909); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const noise = (x, seed) => { const i = Math.floor(x), f = x - i, a = hash(i * 374761393 + seed), b = hash((i + 1) * 374761393 + seed), s = f * f * (3 - 2 * f); return a + (b - a) * s; };
const fbm = (x, seed) => noise(x, seed) * 0.56 + noise(x * 2.07, seed + 11) * 0.3 + noise(x * 4.3, seed + 23) * 0.14;

// ---- sky ---------------------------------------------------------------------------------------------------------------
const KEYS = [
  [0.0, '#35467f', '#ffb48a', '#ffd9a0'],
  [0.12, '#4a74c4', '#ffd2a0', '#fff1c8'],
  [0.4, '#3d84da', '#bfe1ff', '#ffffff'],
  [0.72, '#5675c2', '#ffcc88', '#fff0c0'],
  [0.98, '#3a3878', '#ff875a', '#ffb070'],
  [1.25, '#12163a', '#5a3a6a', '#7a4a7a'],
];
export function skyAt(f) {
  f = clamp(f, 0, 1.25);
  let i = 0; while (i < KEYS.length - 2 && f > KEYS[i + 1][0]) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = clamp((f - a[0]) / (b[0] - a[0]), 0, 1);
  const light = clamp(1.15 - Math.max(0, f - 0.7) * 1.7, 0.18, 1);
  return { top: mix(a[1], b[1], t), hor: mix(a[2], b[2], t), glow: mix(a[3], b[3], t), light, stars: clamp((f - 1.0) / 0.2, 0, 1) };
}
const shade = (hex, sky, amt = 0.3) => mix(mix(hex, '#0a1030', (1 - sky.light) * 0.7), sky.hor, amt);

// ---- geometry ----------------------------------------------------------------------------------------------------------
export function sceneGeom(w, h, px = 0) {
  const land = w >= h;
  return { px: px || Math.round(w * (land ? 0.3 : 0.36)), gy: Math.round(h * (land ? 0.7 : 0.6)), land };
}

function ridge(ctx, w, camX, par, baseY, amp, freq, seed, step = 20) {
  ctx.beginPath(); ctx.moveTo(-10, baseY + 600);
  for (let x = -step; x <= w + step; x += step) ctx.lineTo(x, baseY - amp * fbm((x + camX * par) * freq, seed));
  ctx.lineTo(w + step, baseY + 600); ctx.closePath();
}
function terraceRidge(ctx, w, camX, par, baseY, amp, freq, seed, riser) {
  ctx.beginPath(); ctx.moveTo(-10, baseY + 600);
  let last = null;
  for (let x = -24; x <= w + 24; x += 12) {
    const y = baseY - Math.round((amp * fbm((x + camX * par) * freq, seed)) / riser) * riser;
    if (last !== null && y !== last) ctx.lineTo(x, last);
    ctx.lineTo(x, y); last = y;
  }
  ctx.lineTo(w + 24, baseY + 600); ctx.closePath();
}

function conifer(ctx, x, y, s, col, dark) {
  ctx.fillStyle = dark; ctx.fillRect(x - s * 0.04, y - s * 0.2, s * 0.08, s * 0.2);
  for (let i = 0; i < 3; i++) { const yy = y - s * (0.14 + i * 0.27), ww = s * (0.34 - i * 0.07); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, yy - s * 0.4); ctx.lineTo(x + ww, yy); ctx.lineTo(x - ww, yy); ctx.closePath(); ctx.fill(); }
}
function bush(ctx, x, y, s, col, bloom) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y - s * 0.3, s * 0.5, s * 0.34, 0, 0, TAU); ctx.fill();
  if (bloom) { ctx.fillStyle = bloom; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x + Math.cos(i * 2.1) * s * 0.3, y - s * 0.32 + Math.sin(i * 1.7) * s * 0.18, s * 0.07, 0, TAU); ctx.fill(); } }
}
function bigTree(ctx, x, y, s, sky) {
  ctx.fillStyle = shade('#5a3c22', sky, 0.1); ctx.beginPath(); ctx.moveTo(x - s * 0.06, y); ctx.lineTo(x - s * 0.03, y - s * 0.5); ctx.lineTo(x + s * 0.04, y - s * 0.5); ctx.lineTo(x + s * 0.07, y); ctx.fill();
  const cols = [shade('#2f6a3a', sky, 0.1), shade('#3f8a46', sky, 0.1), shade('#58a85a', sky, 0.1)];
  [[-0.28, -0.62, 0.34], [0.26, -0.6, 0.32], [0, -0.82, 0.36], [-0.05, -0.55, 0.3]].forEach((c, i) => { ctx.fillStyle = cols[i % 3]; ctx.beginPath(); ctx.arc(x + c[0] * s, y + c[1] * s, c[2] * s, 0, TAU); ctx.fill(); });
}

function house(ctx, x, y, w, hgt, sky, lit, seed) {
  const wall = shade('#efe3cb', sky, 0.15), roof = shade(seed % 2 ? '#5d6b7e' : '#6f7a8c', sky, 0.1);
  ctx.fillStyle = wall; ctx.fillRect(x, y - hgt, w, hgt);
  ctx.fillStyle = shade('#c9b48a', sky, 0.15); ctx.fillRect(x, y - 14, w, 14);
  ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x - 12, y - hgt); ctx.lineTo(x + w * 0.5, y - hgt - w * 0.34); ctx.lineTo(x + w + 12, y - hgt); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - 12 + i * 7, y - hgt - i * 6); ctx.lineTo(x + w + 12 - i * 7, y - hgt - i * 6); ctx.stroke(); }
  ctx.fillStyle = lit ? '#ffd679' : shade('#445a7a', sky, 0.1);
  ctx.fillRect(x + w * 0.14, y - hgt * 0.72, w * 0.22, hgt * 0.34); ctx.fillRect(x + w * 0.64, y - hgt * 0.72, w * 0.2, hgt * 0.34);
  ctx.fillStyle = shade('#7a4a24', sky, 0.1); ctx.fillRect(x + w * 0.42, y - hgt * 0.6, w * 0.16, hgt * 0.6);
}

// ---- the whole scene -----------------------------------------------------------------------------------------------------
// m: { trail, x (m), t (s clock), f (day fraction), pose{...}, bridgeSway, gust{dir,t,dur}|null, rain, highlight{x0,x1}|null,
//      falls[], theme (0..2), hideTrail, calm }
export function drawScene(ctx, w, h, m) {
  const g = sceneGeom(w, h, m.px), { px, gy } = g;
  const sky = skyAt(m.f), trail = m.trail;
  const camX = m.x * 100 - px, baseY = groundY(trail, m.x) * 100;
  const elev = (wx) => groundY(trail, wx / 100) * 100;
  const screenY = (wx) => gy - (elev(wx) - baseY);
  const theme = m.theme ?? 0;

  // sky
  const sg = ctx.createLinearGradient(0, 0, 0, gy);
  sg.addColorStop(0, sky.top); sg.addColorStop(0.75, sky.hor); sg.addColorStop(1, sky.hor);
  ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
  // stars
  if (sky.stars > 0) { ctx.fillStyle = `rgba(255,255,255,${0.8 * sky.stars})`; for (let i = 0; i < 46; i++) { const sx = hash(i * 7 + 1) * w, sy = hash(i * 13 + 5) * gy * 0.6, r = 0.8 + hash(i + 40) * 1.4; ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill(); } }
  // sun and its glow, riding an arc over the day
  const df = clamp(m.f / 1.15, 0, 1), sunX = w * (0.08 + 0.84 * df), sunY = gy - 190 - Math.sin(df * Math.PI) * gy * 0.42;
  const rg = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 240);
  rg.addColorStop(0, sky.glow); rg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = 0.85 * (sky.light > 0.3 ? 1 : sky.light * 3); ctx.fillStyle = rg; ctx.fillRect(sunX - 250, sunY - 250, 500, 500); ctx.globalAlpha = 1;
  if (m.f < 1.12) { ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(sunX, sunY, 30, 0, TAU); ctx.fill(); }
  else { ctx.fillStyle = '#eef2ff'; ctx.beginPath(); ctx.arc(w * 0.78, gy * 0.22, 24, 0, TAU); ctx.fill(); ctx.fillStyle = sky.top; ctx.beginPath(); ctx.arc(w * 0.78 + 9, gy * 0.22 - 5, 21, 0, TAU); ctx.fill(); }

  const elevShift = (par) => -(baseY - 0) * 0.12 * par;        // gentle vertical parallax with elevation
  // far snow peaks
  {
    const base = gy - 150 + elevShift(0.1), amp = 430 + theme * 60;
    ridge(ctx, w, camX, 0.04, base, amp, 0.0045, 11, 14);
    const gr = ctx.createLinearGradient(0, base - amp, 0, base);
    gr.addColorStop(0, shade('#ffffff', sky, 0.15)); gr.addColorStop(0.28, shade('#e6eefb', sky, 0.2)); gr.addColorStop(0.5, shade('#9fb4d6', sky, 0.3)); gr.addColorStop(1, shade('#7d96bd', sky, 0.4));
    ctx.fillStyle = gr; ctx.fill();
  }
  // blue ridges
  {
    const base = gy - 110 + elevShift(0.2);
    ridge(ctx, w, camX, 0.1, base, 300, 0.0065, 31, 16);
    const gr = ctx.createLinearGradient(0, base - 300, 0, base + 40);
    gr.addColorStop(0, shade('#8fa7c9', sky, 0.35)); gr.addColorStop(1, shade('#5f7ea8', sky, 0.4));
    ctx.fillStyle = gr; ctx.fill();
  }
  // drifting clouds
  ctx.fillStyle = `rgba(255,255,255,${0.1 + 0.2 * sky.light})`;
  for (let i = 0; i < 5; i++) { const cx = ((hash(i * 17) * (w + 400) - (m.t * (6 + i * 2) + camX * 0.03)) % (w + 400) + (w + 400)) % (w + 400) - 200, cy = gy * (0.15 + 0.5 * hash(i * 29)); for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(cx + k * 38, cy + (k % 2) * 6, 70 - k * 8, 18, 0, 0, TAU); ctx.fill(); } }
  // terraced hills
  {
    const base = gy - 60 + elevShift(0.3), col = theme === 2 ? '#8a8f6a' : theme === 1 ? '#b9a85a' : '#6aa64f';
    terraceRidge(ctx, w, camX, 0.2, base, 220, 0.0085, 53, 14);
    const gr = ctx.createLinearGradient(0, base - 220, 0, base + 40);
    gr.addColorStop(0, shade(col, sky, 0.28)); gr.addColorStop(1, shade(theme === 1 ? '#8c7a34' : '#3f7a3a', sky, 0.25));
    ctx.fillStyle = gr; ctx.fill();
    ctx.strokeStyle = shade('#e8f4c0', sky, 0.3); ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
    // a few distant houses on the terraces
    for (let i = Math.floor((camX * 0.2) / 420) - 1; i < Math.floor((camX * 0.2 + w) / 420) + 2; i++) {
      if (hash(i * 5 + 77) < 0.45) continue;
      const wx = i * 420 + hash(i + 3) * 260, sx = wx - camX * 0.2, sy = base - Math.round((220 * fbm(wx * 0.0085, 53)) / 14) * 14 + 4;
      house(ctx, sx, sy, 46, 26, sky, sky.light < 0.6, i);
    }
  }
  // foothill with trees (closer, darker)
  {
    const base = gy - 14 + elevShift(0.5);
    ridge(ctx, w, camX, 0.45, base, 150, 0.011, 77, 18);
    const gr = ctx.createLinearGradient(0, base - 150, 0, base + 60);
    gr.addColorStop(0, shade(theme === 2 ? '#4f6a55' : '#3c7a45', sky, 0.2)); gr.addColorStop(1, shade('#25502f', sky, 0.15));
    ctx.fillStyle = gr; ctx.fill();
    const c0 = Math.floor((camX * 0.45 - 60) / 96), c1 = Math.ceil((camX * 0.45 + w + 60) / 96);
    for (let i = c0; i <= c1; i++) {
      const r = hash(i * 31 + 9); if (r < 0.28) continue;
      const wx = i * 96 + hash(i * 7) * 70, sx = wx - camX * 0.45, sy = base - 150 * fbm(wx * 0.011, 77) + 6, s = 56 + 70 * hash(i * 3 + 1);
      if (r > 0.78) bush(ctx, sx, sy, s * 0.8, shade('#2f7a3a', sky, 0.1), shade('#ff7aa8', sky, 0.1));
      else conifer(ctx, sx, sy, s, shade(theme === 2 ? '#2a4a42' : '#245a38', sky, 0.1), shade('#4a2f1a', sky, 0.1));
    }
  }
  // mist band between the foothill and the trail
  { const mg = ctx.createLinearGradient(0, gy - 90, 0, gy + 20); mg.addColorStop(0, 'rgba(255,255,255,0)'); mg.addColorStop(1, `rgba(${m.rain ? '210,220,230' : '255,245,230'},${m.rain ? 0.35 : 0.14})`); ctx.fillStyle = mg; ctx.fillRect(0, gy - 90, w, 110); }

  // ---- the valley below the trail: terraces falling away -----------------------------------------------------------------
  { const vg = ctx.createLinearGradient(0, gy, 0, h); vg.addColorStop(0, shade('#5f9a4a', sky, 0.2)); vg.addColorStop(0.6, shade('#4a8a6a', sky, 0.3)); vg.addColorStop(1, shade('#3f7f90', sky, 0.3)); ctx.fillStyle = vg; ctx.fillRect(0, gy, w, h - gy); }
  for (let L = 0; L < 4; L++) {
    const par = 0.62 + L * 0.12, off = 70 + L * 100, base = gy + off + elevShift(1), amp = 110 + L * 38, riser = 8 + L * 2;
    const col = ['#8fbf5f', '#c9b45a', '#6aa84f', '#9bc060'][(L + theme) % 4];
    terraceRidge(ctx, w, camX, par, base, amp, 0.011 - L * 0.0012, 91 + L * 7, riser);
    const vg2 = ctx.createLinearGradient(0, base - amp, 0, base + 40);
    vg2.addColorStop(0, shade(col, sky, 0.12 + L * 0.03)); vg2.addColorStop(1, shade('#3d7a45', sky, 0.25));
    ctx.fillStyle = vg2; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 2; ctx.beginPath();
    for (let yy = base - amp; yy < base + 30; yy += riser * 1.5) { ctx.moveTo(0, yy); ctx.lineTo(w, yy); }
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = shade('#ffffff', sky, 0.3); ctx.globalAlpha = 0.2; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
    // life on the terraces: small houses and trees
    const c0 = Math.floor((camX * par - 40) / 150), c1 = Math.ceil((camX * par + w + 40) / 150);
    for (let i = c0; i <= c1; i++) {
      const r = hash(i * 17 + L * 101); if (r < 0.45) continue;
      const wx = i * 150 + hash(i * 3 + L) * 100, sx = wx - camX * par, sy = base - Math.round((amp * fbm(wx * (0.011 - L * 0.0012), 91 + L * 7)) / riser) * riser + 3;
      if (r > 0.88) house(ctx, sx, sy, 40 + L * 8, 24 + L * 4, sky, sky.light < 0.6, i);
      else if (r > 0.6) conifer(ctx, sx, sy, 36 + L * 12, shade('#2f6a3a', sky, 0.15), shade('#4a2f1a', sky, 0.1));
      else bush(ctx, sx, sy, 30 + L * 8, shade('#3f8a46', sky, 0.15), null);
    }
  }
  // river far below
  { const ry = h - 70; const rgd = ctx.createLinearGradient(0, ry, 0, h); rgd.addColorStop(0, shade('#5fb3d0', sky, 0.2)); rgd.addColorStop(1, shade('#2a7fa0', sky, 0.2)); ctx.fillStyle = rgd; ctx.fillRect(0, ry, w, h - ry); }

  // ---- trail ground ----------------------------------------------------------------------------------------------------------
  const x0 = -30, x1 = w + 30, stp = 14;
  const bridges = [];
  const surf = [];
  for (let sx = x0; sx <= x1; sx += stp) {
    const wxm = (sx + camX) / 100, seg = segAt(trail, wxm);
    let y = screenY(wxm * 100);
    const inBridge = seg.t === 'bridge' && wxm >= seg.x0 && wxm <= seg.x1;
    if (inBridge) { y = gy - (seg.y0 * 100 - baseY); }
    surf.push({ sx, y, inBridge });
  }
  // river under bridges
  for (const sgm of trail.segs) {
    if (sgm.t !== 'bridge' || sgm.x1 * 100 < camX - 60 || sgm.x0 * 100 > camX + w + 60) continue;
    const a = sgm.x0 * 100 - camX, b = sgm.x1 * 100 - camX, dy = gy - (sgm.y0 * 100 - baseY);
    bridges.push({ a, b, dy, seg: sgm });
    const rgd = ctx.createLinearGradient(0, dy + 4, 0, h);
    rgd.addColorStop(0, shade('#1c3a3a', sky, 0.1)); rgd.addColorStop(0.55, shade('#2c6a78', sky, 0.15)); rgd.addColorStop(1, shade('#4fb0c8', sky, 0.2));
    ctx.fillStyle = rgd; ctx.fillRect(a - 8, dy + 4, b - a + 16, h - dy);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    for (let k = 0; k < 8; k++) { const yy = Math.min(h - 20, dy + 230 + k * 24), xx = a + ((k * 53 + m.t * 24 * (1 + k * 0.1)) % Math.max(60, b - a)); ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + 26, yy); ctx.stroke(); }
  }
  // the retaining bank under the path: a band that follows the trail, with a cliff face beside a bridge
  const runs = []; let cur = [];
  for (const p of surf) { if (p.inBridge) { if (cur.length) runs.push(cur); cur = []; } else cur.push(p); }
  if (cur.length) runs.push(cur);
  const eg = ctx.createLinearGradient(0, gy - 40, 0, gy + 200);
  eg.addColorStop(0, shade('#8a6a40', sky, 0.1)); eg.addColorStop(0.5, shade('#5f4528', sky, 0.1)); eg.addColorStop(1, shade('#3a2a1a', sky, 0.1));
  for (const rn of runs) {
    const leftCliff = rn[0].sx > x0 + 1, rightCliff = rn[rn.length - 1].sx < x1 - 1, T = 120;
    ctx.beginPath(); ctx.moveTo(rn[0].sx, rn[0].y);
    for (const p of rn) ctx.lineTo(p.sx, p.y);
    ctx.lineTo(rn[rn.length - 1].sx, rn[rn.length - 1].y + (rightCliff ? 420 : T));
    for (let i = rn.length - 1; i >= 0; i--) ctx.lineTo(rn[i].sx, rn[i].y + T);
    ctx.lineTo(rn[0].sx, rn[0].y + (leftCliff ? 420 : T));
    ctx.closePath(); ctx.fillStyle = eg; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 2;
    for (let r = 1; r <= 4; r++) { ctx.beginPath(); rn.forEach((p, i) => (i ? ctx.lineTo(p.sx, p.y + r * 26) : ctx.moveTo(p.sx, p.y + r * 26))); ctx.stroke(); }
    // stone joints
    for (const p of rn) { if (Math.round(p.sx / stp) % 3) continue; const row = Math.round(p.sx / stp / 3) % 2; for (let r = 0; r < 4; r++) { if ((r + row) % 2) continue; ctx.beginPath(); ctx.moveTo(p.sx, p.y + r * 26); ctx.lineTo(p.sx, p.y + (r + 1) * 26); ctx.stroke(); } }
    ctx.restore();
    // a soft shadow where the bank meets the valley
    const sg2 = ctx.createLinearGradient(0, 0, 0, 1);
    void sg2;
  }
  // path surface band
  const pathCol = shade('#d8bd8a', sky, 0.12), pathLo = shade('#b7965e', sky, 0.12);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  let run = [];
  const flush = () => { if (run.length > 1) { ctx.beginPath(); run.forEach((p, i) => (i ? ctx.lineTo(p.sx, p.y + 5) : ctx.moveTo(p.sx, p.y + 5))); ctx.lineWidth = 17; ctx.strokeStyle = pathLo; ctx.stroke(); ctx.beginPath(); run.forEach((p, i) => (i ? ctx.lineTo(p.sx, p.y + 2) : ctx.moveTo(p.sx, p.y + 2))); ctx.lineWidth = 11; ctx.strokeStyle = pathCol; ctx.stroke(); ctx.beginPath(); run.forEach((p, i) => (i ? ctx.lineTo(p.sx, p.y - 3) : ctx.moveTo(p.sx, p.y - 3))); ctx.lineWidth = 5; ctx.strokeStyle = shade('#5f9a45', sky, 0.1); ctx.stroke(); } run = []; };
  for (const p of surf) { if (p.inBridge) flush(); else run.push(p); }
  flush();

  // ---- trail objects --------------------------------------------------------------------------------------------------------
  const gyAt = (wx) => screenY(wx);
  for (const s of trail.segs) {
    const a = s.x0 * 100 - camX, b = s.x1 * 100 - camX;
    if (b < -140 || a > w + 140) continue;
    if (s.t === 'steps') {
      const n = s.jolts.length;
      for (let k = 0; k < n; k++) {
        const sx = a + k * K.STEP_LEN * 100, cy = gyAt(s.x0 * 100 + (k + 0.5) * K.STEP_LEN * 100);
        if (sx > w + 60 || sx < -60) continue;
        ctx.fillStyle = shade('#a9a094', sky, 0.15); ctx.beginPath(); ctx.roundRect(sx + 1, cy - 8, K.STEP_LEN * 100 - 2, 15, 3); ctx.fill();
        ctx.fillStyle = shade('#d6cfc2', sky, 0.15); ctx.fillRect(sx + 3, cy - 8, K.STEP_LEN * 100 - 6, 4);
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(sx + K.STEP_LEN * 100 - 4, cy - 4, 3, 11);
      }
    } else if (s.t === 'rest') {
      const y = gyAt((s.x0 + s.x1) * 50);
      ctx.fillStyle = shade('#a79b88', sky, 0.15); ctx.beginPath(); ctx.roundRect(a, y - 22, b - a, 26, 4); ctx.fill();
      ctx.fillStyle = shade('#cfc4b0', sky, 0.15); ctx.fillRect(a, y - 22, b - a, 7);
      ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 2;
      for (let k = 1; k < 8; k++) { ctx.beginPath(); ctx.moveTo(a + k * (b - a) / 8, y - 15); ctx.lineTo(a + k * (b - a) / 8, y + 4); ctx.stroke(); }
      bigTree(ctx, a + (b - a) * 0.78, y - 20, 230, sky);
      // stone seat
      ctx.fillStyle = shade('#8e8472', sky, 0.15); ctx.beginPath(); ctx.roundRect(a + (b - a) * 0.3, y - 48, (b - a) * 0.34, 26, 5); ctx.fill();
      // a marker that this is the place to rest
      const vis = trail.endless ? true : true;
      if (vis && m.restCue) { ctx.fillStyle = 'rgba(255,230,160,0.9)'; ctx.font = '600 22px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('chautara', (a + b) / 2, y - 60 + Math.sin(m.t * 3) * 3); }
    }
  }
  // village at the goal
  if (!trail.endless && trail.goal * 100 - camX < w + 700) {
    const gx = trail.goal * 100 - camX;
    for (let i = 0; i < 6; i++) {
      const hx = gx + 70 + i * 190 + (i % 2) * 20, hy = gyAt(trail.goal * 100 + 70 + i * 190) + 4, ww = 130 + (i % 3) * 22;
      house(ctx, hx, hy, ww, 90 + (i % 2) * 14, sky, sky.light < 0.7 || i % 2 === 0, i);
      if (i % 2 === 1) { const t0 = m.t * 0.5 + i; ctx.fillStyle = `rgba(230,230,230,0.35)`; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(hx + ww * 0.7 + Math.sin(t0 + k) * 8, hy - 150 - k * 22, 9 + k * 3, 0, TAU); ctx.fill(); } }
    }
    // the shop with a striped awning and other porters' empty baskets
    const sx = gx + 20, sy = gyAt(trail.goal * 100 + 20);
    ctx.fillStyle = shade('#7a4a24', sky, 0.1); ctx.fillRect(sx, sy - 110, 8, 110); ctx.fillRect(sx + 120, sy - 110, 8, 110);
    for (let k = 0; k < 6; k++) { ctx.fillStyle = k % 2 ? shade('#f2e6c8', sky, 0.1) : shade('#c9473a', sky, 0.1); ctx.beginPath(); ctx.moveTo(sx - 8 + k * 23, sy - 118); ctx.lineTo(sx - 8 + (k + 1) * 23, sy - 118); ctx.lineTo(sx - 12 + (k + 1) * 23, sy - 96); ctx.lineTo(sx - 12 + k * 23, sy - 96); ctx.fill(); }
    ctx.fillStyle = shade('#a8742e', sky, 0.1); ctx.beginPath(); ctx.moveTo(sx + 150, sy); ctx.lineTo(sx + 160, sy - 64); ctx.lineTo(sx + 206, sy - 64); ctx.lineTo(sx + 216, sy); ctx.fill();
  }
  // bridge decks, cables, posts
  for (const br of bridges) {
    const sway = m.bridgeSway ?? 0, lenPx = br.b - br.a;
    const deckY = (u) => br.dy - 2 + Math.sin(Math.PI * u) * clamp(sway * 5, -22, 22) * Math.cos(m.t * 0.0) ;
    ctx.fillStyle = shade('#6a4a28', sky, 0.1);
    for (const px2 of [br.a - 4, br.b - 4]) { ctx.fillRect(px2, br.dy - 120, 10, 124); }
    // deck planks
    ctx.beginPath(); ctx.moveTo(br.a, deckY(0));
    for (let u = 0; u <= 1.0001; u += 0.05) ctx.lineTo(br.a + u * lenPx, deckY(u));
    for (let u = 1; u >= -0.0001; u -= 0.05) ctx.lineTo(br.a + u * lenPx, deckY(u) + 12);
    ctx.closePath(); ctx.fillStyle = shade('#a8793e', sky, 0.1); ctx.fill();
    ctx.strokeStyle = 'rgba(60,30,10,0.45)'; ctx.lineWidth = 1.5;
    for (let xx = br.a; xx < br.b; xx += 22) { const u = (xx - br.a) / lenPx; ctx.beginPath(); ctx.moveTo(xx, deckY(u)); ctx.lineTo(xx, deckY(u) + 12); ctx.stroke(); }
    // cables with hangers
    ctx.strokeStyle = shade('#3a2a1a', sky, 0.1); ctx.lineWidth = 3;
    ctx.beginPath();
    for (let u = 0; u <= 1.0001; u += 0.05) { const cy = br.dy - 112 + Math.sin(Math.PI * u) * 56 + Math.sin(Math.PI * u) * clamp(sway * 3, -12, 12); u === 0 ? ctx.moveTo(br.a, cy) : ctx.lineTo(br.a + u * lenPx, cy); }
    ctx.stroke();
    ctx.lineWidth = 1.6;
    for (let xx = br.a + 18; xx < br.b - 10; xx += 38) { const u = (xx - br.a) / lenPx, cy = br.dy - 112 + Math.sin(Math.PI * u) * 56 + Math.sin(Math.PI * u) * clamp(sway * 3, -12, 12); ctx.beginPath(); ctx.moveTo(xx, cy); ctx.lineTo(xx, deckY(u)); ctx.stroke(); }
  }
  // highlight of the segment a hint is about
  if (m.highlight) {
    const a = m.highlight.x0 * 100 - camX, b = m.highlight.x1 * 100 - camX;
    if (b > 0 && a < w) {
      const pulse = 0.5 + 0.5 * Math.sin(m.t * 5), ya = gyAt(m.highlight.x0 * 100), yb = gyAt(m.highlight.x1 * 100), yy = Math.min(ya, yb) - 20;
      const hg = ctx.createLinearGradient(0, yy - 260, 0, yy + 130); hg.addColorStop(0, 'rgba(255,214,100,0)'); hg.addColorStop(0.75, `rgba(255,214,100,${0.16 + 0.1 * pulse})`); hg.addColorStop(1, 'rgba(255,214,100,0.05)');
      ctx.fillStyle = hg; ctx.fillRect(a, yy - 260, b - a, 390);
      ctx.strokeStyle = `rgba(255,224,130,0.95)`; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a, ya + 22); ctx.lineTo(b, yb + 22); ctx.stroke();
    }
  }

  // ---- porter and falling goods ----------------------------------------------------------------------------------------------
  const P = m.pose;
  if (P) drawPorter(ctx, { scale: 1.12, ...P, x: px, y: gy + 0, t: m.t, slope: m.slope ?? 0 });
  if (m.falls) for (const f of m.falls) {
    const sx = f.x - camX, sy = gy - (f.y - baseY);
    if (sx < -60 || sx > w + 60) continue;
    drawGood(ctx, f.kind, sx, sy, 15, f.rot);
  }
  // foreground tufts
  ctx.fillStyle = shade('#3f7a3a', sky, 0.1);
  for (let i = Math.floor((camX * 1.2) / 140); i < Math.floor((camX * 1.2 + w) / 140) + 2; i++) { if (hash(i * 11) < 0.5) continue; const sx = i * 140 + hash(i) * 80 - camX * 1.2, sy = gyAt((sx + camX) ) + 26 + hash(i + 9) * 40; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(sx + k * 6, sy); ctx.lineTo(sx + k * 6 + 3 - k * 2, sy - 18 - k * 2); ctx.lineTo(sx + k * 6 + 6, sy); ctx.fill(); } }

  // ---- weather -----------------------------------------------------------------------------------------------------------------
  if (m.rain) {
    ctx.strokeStyle = 'rgba(210,225,245,0.5)'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let i = 0; i < 70; i++) { const rx = (hash(i * 3) * (w + 200) - m.t * 160) % (w + 200), ry = (hash(i * 5 + 1) * h + m.t * 700) % h; const xx = (rx + w + 200) % (w + 200) - 100; ctx.moveTo(xx, ry); ctx.lineTo(xx - 10, ry + 30); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(60,80,100,0.12)'; ctx.fillRect(0, 0, w, h);
  }
  if (m.gust) {
    const a = Math.sin((Math.PI * m.gust.t) / m.gust.dur);
    ctx.strokeStyle = `rgba(255,255,255,${0.55 * a})`; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = 0; i < 12; i++) { const yy = gy - 330 + hash(i * 9) * 380, ph = ((m.gust.t / m.gust.dur) * 1.2 + hash(i)) % 1, xx = m.gust.dir > 0 ? -100 + ph * (w + 200) : w + 100 - ph * (w + 200); ctx.moveTo(xx, yy); ctx.lineTo(xx + m.gust.dir * 90, yy + 6); }
    ctx.stroke();
  }
  // evening tint
  if (sky.light < 0.7) { ctx.fillStyle = `rgba(20,20,60,${(0.7 - sky.light) * 0.45})`; ctx.fillRect(0, 0, w, h); }
  return g;
}

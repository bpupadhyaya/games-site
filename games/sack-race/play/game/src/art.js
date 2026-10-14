// Sack Race art: a village-fair field in afternoon sun, the crowd, the runners hopping in sacks, ruts, mud and effects.
// Pure canvas drawing, no assets. World units: x in metres along the lane, y in metres up from the ground.
// Every runner is drawn in a local frame of metres (scale = cam.s * lane scale) so proportions stay human at any zoom.
import { AIR_T } from './sim.js';

// The 3D layer (web/view3d) fills this in each frame when it is drawing the field: { on, project, heads, scale, ... } or null.
export const glState = { gl: null, lic: '' };

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (i) => { let h = Math.imul(i | 0, 2654435761) ^ 0x9e3779b9; h = Math.imul(h ^ (h >>> 15), 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296; };

// ---- sack styles (the unlockable look of the player's sack) --------------------------------------------------------------
export const SACKS = [
  { name: 'Burlap', how: 'the first sack', base: '#d1ab6b', shade: '#a98348', ink: '#7a5a2c', pat: 'plain' },
  { name: 'Candy Stripe', how: 'win a race', base: '#fbf3e4', shade: '#d9ccb4', ink: '#e23a62', pat: 'stripe' },
  { name: 'Red Check', how: 'win the Harvest Fair heat', base: '#e2493f', shade: '#b52e2a', ink: '#fff2e0', pat: 'check' },
  { name: 'Denim', how: 'finish a race without falling', base: '#3f6fb5', shade: '#2c5090', ink: '#bcd4ff', pat: 'denim' },
  { name: 'Patchwork', how: 'finish the Daily field', base: '#e7c98c', shade: '#c0a064', ink: '#2f8f7a', pat: 'patch' },
  { name: 'Festival Gold', how: 'finish a race in under 18 seconds', base: '#f6c640', shade: '#c8921d', ink: '#fff3b8', pat: 'gold' },
];

const SKIN = ['#f1c7a0', '#d8a171', '#b07848', '#7d4c2b', '#f7d9bb', '#c68b5c'];
const HAIR = ['#2a1a12', '#5a3320', '#c98a2e', '#16161e', '#8a2d1c', '#3b2a22'];
const SHIRT = ['#2f8fd6', '#ffc83d', '#14a897', '#7a5cff', '#ff7a2f', '#e0568f', '#8cc63f', '#f2f2f2'];
export const LOOKS = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ skin: SKIN[(i * 5 + 1) % SKIN.length], hair: HAIR[(i * 3 + 2) % HAIR.length], shirt: SHIRT[i % SHIRT.length], style: i % 3 }));
export const YOU_LOOK = { skin: '#e4b184', hair: '#2a1a12', shirt: '#e23a62', style: 1 };

// ---- camera ----------------------------------------------------------------------------------------------------------
// Short side of the stage shows about 8.4 m of lane; lanes are spread over a band of the stage, nearest lane in front.
export function makeCam(stage, camX, n = 4) {
  const land = stage.w > stage.h * 1.05;
  const s = clamp(Math.min(stage.w / (land ? 7.0 : 5.6), stage.h / (land ? 4.0 : 5.0)), 26, 220);
  const horizon = stage.y + stage.h * (land ? 0.25 : 0.22);
  const top = stage.y + stage.h * (land ? 0.36 : 0.36), bot = stage.y + stage.h * (land ? 0.8 : 0.79);
  const cx = stage.x + stage.w * (land ? 0.3 : 0.36);
  const k = Math.max(1, n);
  const laneY = (i) => top + ((i + 0.5) / k) * (bot - top);
  const laneSc = (i) => (k === 1 ? 1 : 0.8 + 0.2 * (i / (k - 1)));
  return { s, cx, camX, stage, n: k, horizon, top, bot, X: (x) => cx + (x - camX) * s, laneY, laneSc, land };
}
export const camSpan = (cam) => ({ x0: cam.camX - (cam.cx - 0) / cam.s - 2, x1: cam.camX + (cam.stage.x + cam.stage.w - cam.cx) / cam.s + 2 });

// ---- the field ---------------------------------------------------------------------------------------------------------
function sky(ctx, W, H, cam) {
  const g = ctx.createLinearGradient(0, 0, 0, cam.horizon + 40);
  g.addColorStop(0, '#2f7fd8'); g.addColorStop(0.55, '#7fc3f0'); g.addColorStop(1, '#d9f0ff');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, cam.horizon + 40);
}
function sun(ctx, cam) {
  const x = cam.stage.x + cam.stage.w * 0.82, y = cam.horizon * 0.42, r = cam.s * 0.5;
  const g = ctx.createRadialGradient(x, y, 4, x, y, r * 3.2);
  g.addColorStop(0, 'rgba(255,248,200,0.95)'); g.addColorStop(0.2, 'rgba(255,236,160,0.45)'); g.addColorStop(1, 'rgba(255,236,160,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r * 3.3, y - r * 3.3, r * 6.6, r * 6.6);
  ctx.fillStyle = '#fff6c9'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
function clouds(ctx, W, cam, t) {
  const s = cam.s, span = s * 9;
  for (let i = -1; i < Math.ceil(W / span) + 2; i++) {
    const q = hash(i + 91), x = (i * span - ((cam.camX * 0.05 + t * 0.12) * s) % span) + q * s * 2, y = cam.horizon * (0.16 + 0.5 * hash(i + 17));
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(x + k * s * 0.42, y + (k % 2) * s * 0.06, s * (0.45 + 0.15 * hash(i * 4 + k)), s * 0.26, 0, 0, TAU); ctx.fill(); }
  }
}
function hills(ctx, W, cam) {
  const s = cam.s, base = cam.horizon;
  const layer = (col, par, amp, freq, lift) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, base + 2);
    const off = cam.camX * par * s;
    for (let x = 0; x <= W + 20; x += 20) { const u = (x + off) / s; ctx.lineTo(x, base - lift * s - amp * s * (0.5 + 0.5 * Math.sin(u * freq) * Math.cos(u * freq * 0.37 + 1.3))); }
    ctx.lineTo(W + 20, base + 2); ctx.closePath(); ctx.fill();
  };
  layer('#8dbf9a', 0.04, 0.9, 0.28, 0.35);
  layer('#6fae82', 0.09, 0.55, 0.45, 0.1);
}
function house(ctx, x, y, s, q) {
  const w = s * (0.9 + 0.5 * q), h = s * (0.55 + 0.3 * hash(Math.floor(q * 1000)));
  const walls = ['#f4e3c4', '#f2c9a0', '#e6efe0', '#f7d9d0'], roofs = ['#c8503a', '#a8412f', '#7b5a46', '#b86a3a'];
  const k = Math.floor(q * 100);
  ctx.fillStyle = walls[k % 4]; ctx.fillRect(x, y - h, w, h);
  ctx.fillStyle = roofs[(k >> 2) % 4]; ctx.beginPath(); ctx.moveTo(x - w * 0.08, y - h); ctx.lineTo(x + w * 0.5, y - h - s * 0.42); ctx.lineTo(x + w * 1.08, y - h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6b8fb0'; ctx.fillRect(x + w * 0.16, y - h * 0.7, w * 0.2, h * 0.3); ctx.fillRect(x + w * 0.6, y - h * 0.7, w * 0.2, h * 0.3);
  ctx.fillStyle = '#7a5236'; ctx.fillRect(x + w * 0.42, y - h * 0.46, w * 0.16, h * 0.46);
}
function tree(ctx, x, y, s, q) {
  ctx.fillStyle = '#6b4a30'; ctx.fillRect(x - s * 0.04, y - s * 0.45, s * 0.08, s * 0.45);
  const g = ['#3f9a52', '#2f8745', '#58ad54'];
  ctx.fillStyle = g[Math.floor(q * 3) % 3]; ctx.beginPath(); ctx.arc(x, y - s * 0.62, s * 0.34, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x - s * 0.2, y - s * 0.5, s * 0.22, 0, TAU); ctx.arc(x + s * 0.22, y - s * 0.5, s * 0.24, 0, TAU); ctx.fill();
}
function palm(ctx, x, y, s, q, t) {
  ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * 0.12 * (q - 0.5) * 2, y - s * 0.5, x + s * 0.06, y - s * 0.95); ctx.stroke();
  const tx = x + s * 0.06, ty = y - s * 0.95;
  ctx.strokeStyle = '#2f9a4a'; ctx.lineWidth = s * 0.05;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI + (i / 5) * Math.PI + Math.sin(t * 1.4 + i + q * 6) * 0.05;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a) * s * 0.3, ty + Math.sin(a) * s * 0.3 - s * 0.1, tx + Math.cos(a) * s * 0.55, ty + Math.sin(a) * s * 0.45 + s * 0.12); ctx.stroke();
  }
}
function village(ctx, W, cam, t) {
  const s = cam.s * 0.95, par = 0.18, step = s * 1.25, off = cam.camX * par * cam.s;
  const i0 = Math.floor((off - 40) / step), i1 = Math.ceil((off + W + 60) / step);
  for (let i = i0; i <= i1; i++) {
    const q = hash(i * 7 + 3), x = i * step - off + q * s * 0.3, y = cam.horizon + s * 0.18;
    const kind = Math.floor(q * 10);
    if (kind < 4) house(ctx, x, y, s * 0.9, q); else if (kind < 7) tree(ctx, x + s * 0.4, y, s * 1.1, q); else palm(ctx, x + s * 0.4, y, s * 1.2, q, t);
  }
}
// The crowd standing behind the rope. People are simple lit figures; the ones near a runner cheer.
function crowd(ctx, W, cam, race, t) {
  const s = cam.s, y0 = cam.top - cam.s * 0.08, step = s * 0.36, par = 0.7, off = cam.camX * par * s;
  const i0 = Math.floor((off - 30) / step), i1 = Math.ceil((off + W + 30) / step);
  for (let row = 0; row < 2; row++) {
    for (let i = i0; i <= i1; i++) {
      const q = hash(i * 13 + row * 101), x = i * step - off + q * step * 0.5 + (row ? step * 0.5 : 0), wx = cam.camX + (x - cam.cx) / s;
      let cheer = 0;
      if (race) for (const r of race.racers) { const d = Math.abs(r.x - wx / 1); if (d < 3) cheer = Math.max(cheer, 1 - d / 3); }
      const bob = Math.abs(Math.sin(t * (3 + q * 2) + i)) * s * 0.05 * (0.3 + cheer * 1.2);
      const base = y0 - row * s * 0.1 + s * 0.04, h = s * (0.62 + 0.18 * q) * (row ? 0.92 : 1);
      const shirt = SHIRT[Math.floor(q * 8) % 8], skin = SKIN[Math.floor(hash(i * 3 + row) * 6) % 6], hair = HAIR[Math.floor(hash(i * 5 + row) * 5) % 5];
      const dim = row ? 'rgba(20,40,20,0.18)' : null;
      ctx.fillStyle = shirt; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - s * 0.1, base - h * 0.68 - bob, s * 0.2, h * 0.68, s * 0.06) : ctx.rect(x - s * 0.1, base - h * 0.68 - bob, s * 0.2, h * 0.68); ctx.fill();
      if (dim) { ctx.fillStyle = dim; ctx.fill(); }
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x, base - h * 0.78 - bob, s * 0.085, 0, TAU); ctx.fill();
      ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(x, base - h * 0.8 - bob, s * 0.088, Math.PI, TAU); ctx.fill();
      if (cheer > 0.15 || q > 0.8) {
        const up = (cheer > 0.15 ? 1 : 0.3) * (0.6 + 0.4 * Math.sin(t * 9 + i));
        ctx.strokeStyle = skin; ctx.lineWidth = s * 0.045; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - s * 0.09, base - h * 0.6 - bob); ctx.lineTo(x - s * 0.17, base - h * (0.62 + 0.4 * up) - bob); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + s * 0.09, base - h * 0.6 - bob); ctx.lineTo(x + s * 0.17, base - h * (0.62 + 0.36 * up) - bob); ctx.stroke();
      }
    }
  }
}
const BUNT = ['#e23a62', '#ffc83d', '#2f8fd6', '#14a897', '#ff7a2f', '#fff2e0'];
function bunting(ctx, W, cam, t) {
  const s = cam.s, spacing = 7, y0 = cam.top - s * 0.95;
  const x0 = Math.floor((cam.camX - cam.cx / s) / spacing) * spacing - spacing, x1 = cam.camX + (W - cam.cx) / s + spacing;
  for (let wx = x0; wx <= x1; wx += spacing) {
    const xa = cam.X(wx), xb = cam.X(wx + spacing), sag = s * 0.38;
    // pole
    ctx.fillStyle = '#6b4a30'; ctx.fillRect(xa - s * 0.04, y0 - s * 0.2, s * 0.08, cam.top - y0 + s * 0.4);
    ctx.fillStyle = '#f3d9a4'; ctx.beginPath(); ctx.arc(xa, y0 - s * 0.2, s * 0.07, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,30,0.8)'; ctx.lineWidth = Math.max(1.5, s * 0.015);
    ctx.beginPath(); ctx.moveTo(xa, y0); ctx.quadraticCurveTo((xa + xb) / 2, y0 + sag * 2, xb, y0); ctx.stroke();
    const n = 9;
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n, bx = xa + (xb - xa) * u, by = y0 + sag * 2 * u * (1 - u) * 2 * 0.5 * 2 * 0.5 * 2;
      const sw = Math.sin(t * 2.2 + wx + k) * 0.06;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(sw);
      ctx.fillStyle = BUNT[(k + Math.floor(wx / spacing)) % BUNT.length];
      ctx.beginPath(); ctx.moveTo(-s * 0.1, 0); ctx.lineTo(s * 0.1, 0); ctx.lineTo(0, s * 0.26); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
}
function rope(ctx, W, cam) {
  const s = cam.s, y = cam.top - s * 0.02;
  ctx.fillStyle = 'rgba(40,70,30,0.35)'; ctx.fillRect(0, y - 2, W, 6);
  ctx.strokeStyle = '#f4efe2'; ctx.lineWidth = Math.max(2, s * 0.03);
  ctx.beginPath(); ctx.moveTo(0, y - s * 0.26); ctx.lineTo(W, y - s * 0.26); ctx.stroke();
  const sp = 2.5, x0 = Math.floor((cam.camX - cam.cx / s) / sp) * sp - sp;
  for (let wx = x0; cam.X(wx) < W + 30; wx += sp) { const x = cam.X(wx); ctx.fillStyle = '#9b7040'; ctx.fillRect(x - s * 0.03, y - s * 0.34, s * 0.06, s * 0.36); }
}
function grass(ctx, W, H, cam) {
  const g = ctx.createLinearGradient(0, cam.horizon, 0, H);
  g.addColorStop(0, '#7cc25a'); g.addColorStop(0.35, '#5eae48'); g.addColorStop(1, '#3f8a38');
  ctx.fillStyle = g; ctx.fillRect(0, cam.horizon, W, H - cam.horizon);
  // mown stripes, one every 4 m, moving with the course
  const s = cam.s, sp = 4, x0 = Math.floor((cam.camX - cam.cx / s) / sp) * sp - sp;
  for (let wx = x0, k = Math.floor(x0 / sp); cam.X(wx) < W + 20; wx += sp, k++) {
    if (k & 1) { ctx.fillStyle = 'rgba(255,255,220,0.07)'; ctx.fillRect(cam.X(wx), cam.top - s * 0.05, s * sp, H - cam.top); }
  }
  // the back strip of grass under the crowd is a little darker
  ctx.fillStyle = 'rgba(20,60,20,0.18)'; ctx.fillRect(0, cam.horizon, W, cam.top - cam.horizon);
}
function lanes(ctx, W, cam, race) {
  const n = cam.n, s = cam.s;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineCap = 'butt';
  for (let i = 0; i <= n; i++) {
    const y = cam.top + (i / n) * (cam.bot - cam.top);
    ctx.lineWidth = Math.max(1.5, s * (i === 0 || i === n ? 0.045 : 0.03));
    ctx.setLineDash(i === 0 || i === n ? [] : [s * 0.5, s * 0.35]);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.setLineDash([]);
  if (!race) return;
  const len = race.len;
  // start line and the 10 m marks
  const mark = (wx, w, col, label) => {
    const x = cam.X(wx);
    ctx.fillStyle = col; ctx.fillRect(x - s * w / 2, cam.top, s * w, cam.bot - cam.top);
    if (label) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = `800 ${Math.round(s * 0.34)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, cam.bot + s * 0.32); }
  };
  mark(0, 0.14, 'rgba(255,255,255,0.9)', 'START');
  for (let m = 10; m < len; m += 10) mark(m, 0.06, 'rgba(255,255,255,0.45)', `${m} m`);
}
export function drawBackdrop(ctx, W, H, cam, race, t) {
  sky(ctx, W, H, cam); sun(ctx, cam); clouds(ctx, W, cam, t); hills(ctx, W, cam); village(ctx, W, cam, t);
  grass(ctx, W, H, cam); crowd(ctx, W, cam, race, t); rope(ctx, W, cam); bunting(ctx, W, cam, t);
  lanes(ctx, W, cam, race);
}

// ---- course features: ruts, mud, the finish ----------------------------------------------------------------------------------
function drawRut(ctx, cam, r, lane) {
  const s = cam.s * cam.laneSc(lane), x = cam.X(r.x), w = r.w * s, y = cam.laneY(lane);
  ctx.save();
  ctx.fillStyle = 'rgba(70,40,22,0.62)'; ctx.beginPath(); ctx.ellipse(x + w / 2, y, w * 0.62, s * 0.11, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(40,22,10,0.8)'; ctx.lineWidth = Math.max(1.5, s * 0.025);
  for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.ellipse(x + w / 2, y + k * s * 0.035, w * 0.5, s * 0.05, 0, 0, TAU); ctx.stroke(); }
  // a camber arrow: the direction it throws you
  const ax = x + w / 2, ay = y - s * 0.16, d = r.dir;
  ctx.strokeStyle = r.dir > 0 ? '#ffd35a' : '#9fe0ff'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = Math.max(2, s * 0.04); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ax - d * s * 0.22, ay); ctx.lineTo(ax + d * s * 0.2, ay); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ax + d * s * 0.32, ay); ctx.lineTo(ax + d * s * 0.16, ay - s * 0.1); ctx.lineTo(ax + d * s * 0.16, ay + s * 0.1); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawMud(ctx, cam, m, lane, t) {
  const s = cam.s * cam.laneSc(lane), x = cam.X(m.x), w = m.w * s, y = cam.laneY(lane);
  ctx.save();
  ctx.fillStyle = 'rgba(88,58,34,0.9)'; ctx.beginPath(); ctx.ellipse(x + w / 2, y, w * 0.55, s * 0.16, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(140,104,70,0.55)'; ctx.beginPath(); ctx.ellipse(x + w * 0.46, y - s * 0.03, w * 0.34, s * 0.07, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,210,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x + w * 0.5 + Math.sin(t * 2) * s * 0.03, y - s * 0.02, w * 0.2, s * 0.05, 0, 0, TAU); ctx.stroke();
  ctx.restore();
}
export function drawFeatures(ctx, cam, race, t) {
  for (let lane = 0; lane < cam.n; lane++) {
    for (const m of race.course.mud) { const x = cam.X(m.x); if (x > -cam.s * 4 && x < cam.stage.x + cam.stage.w + cam.s * 4) drawMud(ctx, cam, m, lane, t); }
    for (const r of race.course.ruts) { const x = cam.X(r.x); if (x > -cam.s * 3 && x < cam.stage.x + cam.stage.w + cam.s * 3) drawRut(ctx, cam, r, lane); }
  }
}
export function drawFinish(ctx, cam, race, t, broke = {}) {
  const s = cam.s, x = cam.X(race.len);
  if (x < -s * 3 || x > cam.stage.x + cam.stage.w + s * 3) return;
  const w = s * 0.5;
  // chequered line across the whole band
  const y0 = cam.top, y1 = cam.bot, cells = Math.max(4, Math.round((y1 - y0) / (w / 2)));
  for (let k = 0; k < cells; k++) for (let c = 0; c < 2; c++) { ctx.fillStyle = (k + c) & 1 ? '#1c1c24' : '#fbfbfb'; ctx.fillRect(x + c * w / 2 - w / 2, y0 + (k / cells) * (y1 - y0), w / 2, (y1 - y0) / cells + 0.5); }
  // two tall poles with a banner
  const hFar = s * 2.6 * cam.laneSc(0), hNear = s * 2.6 * cam.laneSc(cam.n - 1);
  ctx.strokeStyle = '#d9d2c0'; ctx.lineWidth = Math.max(3, s * 0.08); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 - hFar); ctx.moveTo(x, y1); ctx.lineTo(x, y1 - hNear); ctx.stroke();
  ctx.fillStyle = '#e23a62'; ctx.beginPath(); ctx.moveTo(x - s * 0.04, y0 - hFar); ctx.lineTo(x + s * 0.04, y0 - hFar); ctx.lineTo(x + s * 0.04, y1 - hNear); ctx.lineTo(x - s * 0.04, y1 - hNear); ctx.closePath(); ctx.fill();
  // the banner hangs on the far pole facing the viewer
  const bw = s * 2.1, bh = s * 0.5, bx = x - bw / 2, by = y0 - hFar - bh * 0.4;
  ctx.fillStyle = '#fff6df'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, s * 0.08) : ctx.rect(bx, by, bw, bh); ctx.fill();
  ctx.strokeStyle = '#e23a62'; ctx.lineWidth = Math.max(2, s * 0.05); ctx.stroke();
  ctx.fillStyle = '#c4234a'; ctx.font = `800 ${Math.round(s * 0.34)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('FINISH', x, by + bh / 2 + 1);
  // a tape across each lane, until somebody breaks it
  for (let lane = 0; lane < cam.n; lane++) {
    const y = cam.laneY(lane), sc = cam.laneSc(lane), top = y - s * 0.95 * sc, half = ((y1 - y0) / cam.n) * 0.5;
    if (broke[lane]) {
      const k = broke[lane];
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, s * 0.04); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, top - half * 0.8); ctx.quadraticCurveTo(x + s * 0.4 * k, top - half * 0.3, x + s * 0.7 * k, top + s * 0.5 * k); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, top + half * 0.8); ctx.quadraticCurveTo(x + s * 0.4 * k, top + half * 0.3, x + s * 0.6 * k, top + s * 0.7 * k); ctx.stroke();
    } else {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2.5, s * 0.05); ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.moveTo(x, top - half * 0.8); ctx.lineTo(x + Math.sin(t * 5 + lane) * s * 0.03, top + half * 0.8); ctx.stroke();
      ctx.strokeStyle = '#e23a62'; ctx.setLineDash([s * 0.12, s * 0.12]); ctx.beginPath(); ctx.moveTo(x, top - half * 0.8); ctx.lineTo(x + Math.sin(t * 5 + lane) * s * 0.03, top + half * 0.8); ctx.stroke(); ctx.setLineDash([]);
    }
  }
}

// ---- the runner -------------------------------------------------------------------------------------------------------------
// Pose from the simulation state: crouch/stretch, hop height, lean, fall.
export function poseOf(r) {
  let hop = 0, squash = 0, lean = r.th, lie = 0, tuck = 0;
  if (r.phase === 'air') {
    const u = clamp(r.pt / AIR_T, 0, 1);
    hop = 0.36 * 4 * u * (1 - u);
    tuck = Math.sin(u * Math.PI);
  } else if (r.phase === 'ground') {
    squash = clamp(1 - r.pt / 0.16, 0, 1) * 0.9 + clamp((r.pt - 0.16) / 0.5, 0, 0.35);
  } else if (r.phase === 'down') {
    lie = clamp(r.pt / 0.22, 0, 1); lean = 0;
  } else if (r.phase === 'rise') {
    lie = 1 - clamp(r.pt / 0.4, 0, 1); lean = 0;
  } else if (r.finishT != null) {
    tuck = 0.2;
  }
  return { hop, squash, lean, lie, tuck, fwd: r.fwdFall !== false };
}

function patternFill(ctx, sk, x0, y0, x1, y1) {
  ctx.fillStyle = sk.base; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = sk.ink; ctx.fillStyle = sk.ink;
  const w = x1 - x0, h = y1 - y0;
  if (sk.pat === 'stripe') { ctx.lineWidth = 0.075; for (let i = -2; i < 8; i++) { ctx.beginPath(); ctx.moveTo(x0 + i * 0.14, y1); ctx.lineTo(x0 + i * 0.14 + 0.28, y0); ctx.stroke(); } }
  else if (sk.pat === 'check') { ctx.lineWidth = 0.045; for (let i = 0; i < 6; i++) { ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.moveTo(x0 + (i / 5) * w, y0); ctx.lineTo(x0 + (i / 5) * w, y1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x0, y0 + (i / 5) * h); ctx.lineTo(x1, y0 + (i / 5) * h); ctx.stroke(); } ctx.globalAlpha = 1; }
  else if (sk.pat === 'denim') { ctx.lineWidth = 0.02; ctx.globalAlpha = 0.5; for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.moveTo(x0, y0 + (i / 15) * h); ctx.lineTo(x1, y0 + (i / 15) * h + 0.03); ctx.stroke(); } ctx.globalAlpha = 1; ctx.setLineDash([0.05, 0.04]); ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(x0 + w * 0.5, y0); ctx.lineTo(x0 + w * 0.5, y1); ctx.stroke(); ctx.setLineDash([]); }
  else if (sk.pat === 'patch') { const cs = ['#d9534f', '#3f8fd0', '#f0c24b', '#5aa469']; for (let i = 0; i < 4; i++) { ctx.fillStyle = cs[i]; ctx.fillRect(x0 + w * (0.12 + 0.5 * (i % 2)) - 0.0, y0 + h * (0.12 + 0.22 * i), w * 0.34, h * 0.16); } ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 0.02; ctx.setLineDash([0.04, 0.03]); ctx.strokeRect(x0 + w * 0.1, y0 + h * 0.1, w * 0.36, h * 0.2); ctx.setLineDash([]); }
  else if (sk.pat === 'gold') { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, '#fff0a0'); g.addColorStop(0.5, '#f6c640'); g.addColorStop(1, '#c8921d'); ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h); ctx.fillStyle = sk.ink; ctx.globalAlpha = 0.7; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x0 + w / 2, y0 + h * (0.15 + 0.25 * i)); ctx.lineTo(x0 + w * 0.7, y0 + h * (0.22 + 0.25 * i)); ctx.lineTo(x0 + w / 2, y0 + h * (0.29 + 0.25 * i)); ctx.lineTo(x0 + w * 0.3, y0 + h * (0.22 + 0.25 * i)); ctx.closePath(); ctx.fill(); } ctx.globalAlpha = 1; }
  else { ctx.globalAlpha = 0.35; ctx.lineWidth = 0.02; for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(x0, y0 + (i / 11) * h); ctx.lineTo(x1, y0 + (i / 11) * h + 0.02 * ((i % 2) * 2 - 1)); ctx.stroke(); } for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x0 + (i / 5) * w, y0); ctx.lineTo(x0 + (i / 5) * w + 0.02, y1); ctx.stroke(); } ctx.globalAlpha = 1; }
}

// Two-bone arm to a target; returns the elbow.
function elbow(sx, sy, hx, hy, l1, l2, bend) {
  let dx = hx - sx, dy = hy - sy, d = Math.hypot(dx, dy);
  const maxD = l1 + l2 - 0.001;
  if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; hx = sx + dx; hy = sy + dy; }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mx = sx + (dx * a) / d, my = sy + (dy * a) / d;
  return { ex: mx + (-dy / d) * h * bend, ey: my + (dx / d) * h * bend, hx, hy };
}

// r: pose carrier { x, th, phase, pt, v, finishT, falls, fwdFall, anim, lane }; o: { look, sack, you, name, bib, ghost, t, mood }
export function drawRunner(ctx, cam, r, o) {
  const lane = r.lane, sc = cam.s * cam.laneSc(lane), px = cam.X(r.x), py = cam.laneY(lane);
  const P = poseOf(r), look = o.look, sk = SACKS[o.sack || 0], t = o.t;
  ctx.save();
  if (o.ghost) ctx.globalAlpha = 0.42;
  // ground shadow
  const sh = 1 - P.hop * 1.1;
  ctx.fillStyle = `rgba(20,40,10,${0.3 * sh})`; ctx.beginPath(); ctx.ellipse(px + 0.02 * sc, py + 0.02 * sc, 0.38 * sc * (1 + 0.15 * P.lie), 0.1 * sc, 0, 0, TAU); ctx.fill();
  ctx.translate(px, py); ctx.scale(sc, sc);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // whole-body fall rotation about the feet
  const fall = P.lie * (P.fwd ? 1.38 : -1.3);
  const wig = r.phase === 'down' ? Math.sin(r.pt * 14) * 0.06 : 0;
  ctx.rotate(fall + wig);
  if (P.lie > 0.3) ctx.translate(0, 0.0);
  const lift = -P.hop;                                     // the sack leaves the ground
  const sy = 1 - 0.12 * P.squash + 0.05 * P.tuck, sx = 1 + 0.1 * P.squash;
  const hipY = -0.84 + lift + 0.12 * P.squash * 0.5;
  // far arm first, then the sack, torso, head, near arm
  const lean = P.lean * 0.92, tc = Math.cos(lean), ts = Math.sin(lean);
  const bodyLen = 0.5;
  const shX = ts * bodyLen, shY = hipY - tc * bodyLen;     // shoulder
  const hdX = shX + ts * 0.2, hdY = shY - tc * 0.2;        // head centre
  const rimY = hipY - 0.02 - 0.06 * P.tuck + 0.04 * P.squash;
  const arm = (side) => {
    const gx = (side > 0 ? 0.2 : 0.1) + 0.02 * P.tuck, gy = rimY - 0.02 + (side > 0 ? 0 : 0.02);
    const sxp = shX + (side > 0 ? 0.04 : -0.02), syp = shY + 0.04;
    const e = elbow(sxp, syp, gx, gy, 0.28, 0.27, -1);
    return { sxp, syp, ...e };
  };
  const far = arm(-1), near = arm(1);
  const limb = (a, col, wdt) => { ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.beginPath(); ctx.moveTo(a.sxp, a.syp); ctx.lineTo(a.ex, a.ey); ctx.lineTo(a.hx, a.hy); ctx.stroke(); };
  limb(far, look.skin, 0.075); ctx.fillStyle = look.skin; ctx.beginPath(); ctx.arc(far.hx, far.hy, 0.05, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.arc(far.hx, far.hy, 0.05, 0, TAU); ctx.fill();
  // the sack: from the rim at the waist to the ground, corners standing out at the bottom
  const topY = rimY, botY = lift * 0.55 - 0.0, w0 = 0.25 * sx, w1 = 0.29 * sx;
  const bulge = 0.05 * P.tuck + 0.03 * P.squash;
  const sackH = botY - topY;
  ctx.save();
  ctx.translate(0, 0);
  ctx.beginPath();
  const sway = Math.sin((r.anim || 0) * 14) * 0.015 * (P.hop > 0 ? 1 : 0);
  ctx.moveTo(-w0 + 0.02, topY);
  ctx.bezierCurveTo(-w1 - 0.05 + sway, topY + sackH * 0.35, -w1 - 0.07, topY + sackH * 0.75, -w1 - 0.09, botY);
  ctx.lineTo(-w1 - 0.14, botY + 0.02 * (1 + P.squash)); // corner ear
  ctx.lineTo(-w1 - 0.02, botY + 0.0);
  ctx.quadraticCurveTo(0, botY + 0.03 + 0.03 * P.squash, w1 + 0.02, botY + 0.0);
  ctx.lineTo(w1 + 0.15, botY + 0.02 * (1 + P.squash));
  ctx.lineTo(w1 + 0.09, botY);
  ctx.bezierCurveTo(w1 + 0.07, topY + sackH * 0.75, w1 + 0.05 + sway + bulge, topY + sackH * 0.35, w0 + 0.02, topY);
  ctx.closePath();
  ctx.save(); ctx.clip();
  patternFill(ctx, sk, -0.5, topY, 0.5, botY + 0.05);
  // a soft cylinder shading
  const sg = ctx.createLinearGradient(-0.3, 0, 0.3, 0); sg.addColorStop(0, 'rgba(0,0,0,0.22)'); sg.addColorStop(0.45, 'rgba(255,255,255,0.14)'); sg.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = sg; ctx.fillRect(-0.5, topY, 1, sackH + 0.1);
  const vg = ctx.createLinearGradient(0, topY, 0, botY + 0.05); vg.addColorStop(0, 'rgba(0,0,0,0.0)'); vg.addColorStop(0.8, 'rgba(0,0,0,0.0)'); vg.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = vg; ctx.fillRect(-0.5, topY, 1, sackH + 0.1);
  // the knees push the cloth: two soft highlights
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.ellipse(0.1 + bulge, topY + sackH * 0.5, 0.09, 0.2, 0.1, 0, TAU); ctx.fill();
  // wrinkles where the knees push
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 0.02;
  for (let k = 0; k < 3; k++) { const yy = topY + sackH * (0.3 + 0.2 * k) + Math.sin((r.anim || 0) * 9 + k) * 0.01; ctx.beginPath(); ctx.moveTo(-0.2, yy); ctx.quadraticCurveTo(0, yy + 0.04, 0.2, yy); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = sk.shade; ctx.lineWidth = 0.025; ctx.stroke();
  ctx.restore();
  // the rolled rim, held in both hands
  ctx.fillStyle = sk.shade; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-w0 - 0.01, topY - 0.05, 2 * w0 + 0.05, 0.1, 0.05) : ctx.rect(-w0 - 0.01, topY - 0.05, 2 * w0 + 0.05, 0.1); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-w0 + 0.02, topY - 0.04, 2 * w0 - 0.02, 0.03);
  // torso
  ctx.save(); ctx.translate(0, hipY); ctx.rotate(lean); ctx.translate(0, -hipY);
  ctx.fillStyle = look.shirt;
  ctx.beginPath(); ctx.moveTo(-0.15, hipY + 0.02); ctx.quadraticCurveTo(-0.19, hipY - 0.28, -0.1, hipY - bodyLen); ctx.lineTo(0.1, hipY - bodyLen); ctx.quadraticCurveTo(0.2, hipY - 0.28, 0.15, hipY + 0.02); ctx.closePath(); ctx.fill();
  const tg = ctx.createLinearGradient(-0.2, 0, 0.2, 0); tg.addColorStop(0, 'rgba(0,0,0,0.22)'); tg.addColorStop(0.6, 'rgba(255,255,255,0.08)'); tg.addColorStop(1, 'rgba(0,0,0,0.12)'); ctx.fillStyle = tg; ctx.fill();
  if (o.bib) { ctx.fillStyle = '#fff'; ctx.fillRect(-0.075, hipY - 0.42, 0.15, 0.2); ctx.fillStyle = '#1c1c24'; ctx.font = '800 0.15px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(o.bib), 0, hipY - 0.31); }
  ctx.restore();
  // neck and head
  ctx.save();
  ctx.translate(hdX, hdY); ctx.rotate(lean * 0.6 + (r.phase === 'down' ? 0.2 : 0));
  ctx.fillStyle = look.skin; ctx.fillRect(-0.035, 0.07, 0.07, 0.14);
  ctx.beginPath(); ctx.ellipse(0, 0, 0.115, 0.125, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.beginPath(); ctx.ellipse(-0.03, 0.02, 0.09, 0.11, 0, 0, TAU); ctx.fill();
  // ear and nose
  ctx.fillStyle = look.skin; ctx.beginPath(); ctx.ellipse(-0.03, 0.01, 0.025, 0.035, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(0.1, -0.01); ctx.lineTo(0.15, 0.04); ctx.lineTo(0.1, 0.05); ctx.closePath(); ctx.fill();
  // hair
  ctx.fillStyle = look.hair; ctx.beginPath();
  ctx.ellipse(-0.015, -0.035, 0.12, 0.095, 0, Math.PI * 0.95, TAU * 1.02); ctx.fill();
  if (look.style === 1) { const wv = Math.sin((r.anim || 0) * 10) * 0.04 + (P.hop > 0 ? -0.05 : 0); ctx.beginPath(); ctx.moveTo(-0.1, -0.02); ctx.quadraticCurveTo(-0.28, 0.0 + wv, -0.24 + wv, 0.15); ctx.quadraticCurveTo(-0.15, 0.08, -0.07, 0.07); ctx.closePath(); ctx.fill(); }
  else if (look.style === 2) { ctx.beginPath(); ctx.arc(-0.1, -0.08, 0.06, 0, TAU); ctx.fill(); }
  // face: eye, brow, mouth
  const strain = r.phase === 'down' ? 1 : clamp(Math.abs(r.th) - 0.35, 0, 0.6) * 1.6;
  ctx.fillStyle = '#1c1c24'; ctx.beginPath(); ctx.ellipse(0.06, -0.01, 0.014, strain > 0.4 ? 0.022 : 0.017, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = look.hair; ctx.lineWidth = 0.016; ctx.beginPath(); ctx.moveTo(0.03, -0.045 - strain * 0.01); ctx.lineTo(0.09, -0.05 + strain * 0.015); ctx.stroke();
  ctx.strokeStyle = '#8a2f2f'; ctx.lineWidth = 0.02; ctx.beginPath();
  if (strain > 0.4) { ctx.ellipse(0.075, 0.07, 0.025, 0.02 + strain * 0.012, 0, 0, TAU); }
  else { ctx.moveTo(0.04, 0.06); ctx.quadraticCurveTo(0.08, 0.1 + (o.mood === 'happy' ? 0.03 : 0), 0.11, 0.055); }
  ctx.stroke();
  ctx.restore();
  // near arm in front
  limb(near, look.skin, 0.085);
  ctx.fillStyle = look.skin; ctx.beginPath(); ctx.arc(near.hx, near.hy, 0.058, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(90,50,30,0.55)'; ctx.lineWidth = 0.012; for (let f = 0; f < 3; f++) { ctx.beginPath(); ctx.moveTo(near.hx - 0.03, near.hy - 0.02 + f * 0.02); ctx.lineTo(near.hx + 0.04, near.hy - 0.018 + f * 0.02); ctx.stroke(); }
  // forearm shading
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.moveTo(near.ex, near.ey); ctx.lineTo(near.hx, near.hy); ctx.stroke();
  // shirt sleeve over the shoulder end
  ctx.strokeStyle = look.shirt; ctx.lineWidth = 0.11; ctx.beginPath(); ctx.moveTo(near.sxp, near.syp); ctx.lineTo(near.sxp + (near.ex - near.sxp) * 0.38, near.syp + (near.ey - near.syp) * 0.38); ctx.stroke();
  ctx.strokeStyle = look.shirt; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(far.sxp, far.syp); ctx.lineTo(far.sxp + (far.ex - far.sxp) * 0.3, far.syp + (far.ey - far.syp) * 0.3); ctx.stroke();
  // dizzy stars when down
  if (r.phase === 'down') {
    for (let k = 0; k < 3; k++) { const a = (r.pt * 5 + k * TAU / 3); ctx.fillStyle = '#ffd35a'; ctx.beginPath(); ctx.arc(hdX + Math.cos(a) * 0.22, hdY - 0.2 + Math.sin(a) * 0.06, 0.035, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
  // markers (drawn upright, outside the body transform)
  if (o.you && !o.ghost) {
    const mx = px + P.lean * 0.1 * sc, my = py - (1.95 + P.hop * 0.4) * sc;
    ctx.save();
    ctx.fillStyle = '#ffd35a'; ctx.strokeStyle = 'rgba(40,20,0,0.7)'; ctx.lineWidth = Math.max(1.5, sc * 0.03);
    const b = Math.sin(t * 6) * sc * 0.04;
    ctx.beginPath(); ctx.moveTo(mx, my + b + sc * 0.2); ctx.lineTo(mx - sc * 0.16, my + b); ctx.lineTo(mx + sc * 0.16, my + b); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  } else if (o.name) {
    ctx.save(); ctx.font = `700 ${Math.max(11, Math.round(sc * 0.22))}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tx = px, ty = py - (1.85 + P.hop * 0.4) * sc, w = ctx.measureText(o.name).width + 12;
    ctx.fillStyle = 'rgba(14,30,20,0.55)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(tx - w / 2, ty - sc * 0.15, w, sc * 0.3, sc * 0.15) : ctx.rect(tx - w / 2, ty - sc * 0.15, w, sc * 0.3); ctx.fill();
    ctx.fillStyle = o.ghost ? '#cfe8ff' : '#fff6e0'; ctx.fillText(o.name, tx, ty + 1); ctx.restore();
  }
}

// ---- effects -----------------------------------------------------------------------------------------------------------------
// kinds: 0 dust, 1 spark, 2 ring, 3 grass bit, 4 confetti, 5 mud splat, 6 streamer
export function stepFx(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const q = list[i];
    q.t += dt;
    if (q.t >= q.max) { list.splice(i, 1); continue; }
    q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.kind === 1 || q.kind === 3 || q.kind === 4 || q.kind === 5) { q.vy -= 9 * dt; if (q.y < 0) { q.y = 0; q.vy *= -0.3; q.vx *= 0.7; } }
    if (q.kind === 0) { q.vx *= 0.95; q.vy *= 0.95; }
    if (q.rot !== undefined) q.rot += q.spin * dt;
  }
}
export function drawFx(ctx, cam, list) {
  for (const q of list) {
    const k = q.t / q.max, sc = cam.s * cam.laneSc(q.lane), x = cam.X(q.x), y = cam.laneY(q.lane) - q.y * sc, a = Math.max(0, 1 - k);
    ctx.save(); ctx.globalAlpha = a;
    if (q.kind === 0) { ctx.fillStyle = 'rgba(240,225,190,0.75)'; ctx.beginPath(); ctx.arc(x, y, sc * q.size * (1 + k * 1.6), 0, TAU); ctx.fill(); }
    else if (q.kind === 1) { ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, sc * q.size * a), 0, TAU); ctx.fill(); }
    else if (q.kind === 2) { ctx.strokeStyle = q.col; ctx.lineWidth = Math.max(2, sc * 0.05 * a); ctx.beginPath(); ctx.ellipse(x, y, sc * q.size * (0.2 + k), sc * q.size * (0.2 + k) * 0.35, 0, 0, TAU); ctx.stroke(); }
    else if (q.kind === 3) { ctx.translate(x, y); ctx.rotate(q.rot); ctx.fillStyle = q.col; ctx.fillRect(-sc * q.size, -sc * q.size * 0.2, sc * q.size * 2, sc * q.size * 0.4); }
    else if (q.kind === 4) { ctx.translate(x, y); ctx.rotate(q.rot); ctx.fillStyle = q.col; ctx.fillRect(-sc * q.size, -sc * q.size * 0.5, sc * q.size * 2, sc * q.size); }
    else if (q.kind === 5) { ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, sc * q.size), 0, TAU); ctx.fill(); }
    ctx.restore();
  }
}

// ---- the whole field: used by the play screen, the menus' living background and the illustrations -------------------------------------
// o: { t, sack, fx, broke, you: racer id highlighted }
export function ghostPose(gx, lane, t) {
  const u = ((gx / 1.2) % 1 + 1) % 1;
  return u < 0.88 ? { x: gx, th: 0.16, om: 0, phase: 'air', pt: (u / 0.88) * AIR_T, lane, anim: t, finishT: null, fwdFall: true }
    : { x: gx, th: 0.12, om: 0, phase: 'ground', pt: (u - 0.88) * 0.8, lane, anim: t, finishT: null, fwdFall: true };
}
export function drawRace(ctx, W, H, cam, race, o) {
  const t = o.t, off = o.ghostX != null ? 1 : 0;
  drawBackdrop(ctx, W, H, cam, race, t);
  drawFeatures(ctx, cam, race, t);
  drawFinish(ctx, cam, race, t, o.broke || {});
  const items = [];
  if (o.ghostX != null) items.push({ lane: 0, r: ghostPose(o.ghostX, 0, t), ghost: true });
  for (const r of race.racers) items.push({ lane: r.lane + off, r: { ...r, lane: r.lane + off }, you: r.player, who: r });
  items.sort((a, b) => a.lane - b.lane);
  for (const it of items) {
    drawRunner(ctx, cam, it.r, {
      look: it.ghost ? YOU_LOOK : it.you ? YOU_LOOK : LOOKS[(it.who.id * 3 + (race.seed & 7)) % LOOKS.length],
      sack: it.ghost ? o.sack : it.you ? o.sack : (it.who.id * 2 + 1) % SACKS.length === o.sack ? (it.who.id * 2 + 2) % SACKS.length : (it.who.id * 2 + 1) % SACKS.length,
      you: it.you, name: o.names === false ? null : it.ghost ? 'Best' : it.you ? null : it.who.name, bib: it.ghost ? null : it.who.id + 1, ghost: it.ghost, t, mood: it.who && it.who.finishT != null ? 'happy' : '',
    });
  }
  drawFx(ctx, cam, o.fx || []);
}

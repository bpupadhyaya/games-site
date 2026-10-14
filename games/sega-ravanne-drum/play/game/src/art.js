// Everything that is painted: palette, the dusk beach, the ravanne with its sweeping beam, triangle, maravanne, fire, the dancer, stroke dots.
// Pure canvas drawing (no DOM). All positions are in virtual units.
import { TRACK, CUE_OUT } from './layout.js';

export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const DISPLAY = '"Fredoka", "Arial Rounded MT Bold", system-ui, sans-serif';
export const PAL = {
  night: '#150d33', dusk: '#3d2170', plum: '#6a2c7e', coral: '#f2685a', amber: '#ffb347', sun: '#ffd37a', teal: '#2fd8c4', tealLo: '#0f8a86',
  sea: '#0e5878', seaDeep: '#072a42', sand: '#e6bf86', sandLo: '#8a5b34', palm: '#0a1626', wood: '#7a4420', woodHi: '#b87838', woodLo: '#3d1f0c',
  skin: '#f0d6a0', skinLo: '#c69255', text: '#fff6e6', dim: '#c9b9d6', cream: '#ffeccb', gold: '#ffc04d', lav: '#c9a8ff', flame: '#ff8a2e', miss: '#ff7d8f', good: '#8ef0dc',
  ink: '#1a0f2e',
};
export const KIND_COL = { boom: '#ffc04d', slap: '#3fe0c8', ting: '#c9a8ff', shake: '#ff7a6b', warm: '#ff9a3c' };
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const TAU = Math.PI * 2;
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => 1 - (1 - clamp01(x)) ** 3;
const lerp = (a, b, k) => a + (b - a) * k;

// angle of a slot on the clock face: 0 = twelve o'clock, clockwise, 12 slots to a turn
export const slotAngle = (slot) => -Math.PI / 2 + (slot / 12) * TAU;
export const beamAngle = (phase) => -Math.PI / 2 + phase * TAU;

// ---- dusk beach ------------------------------------------------------------------------------------------------------------------
const STARS = Array.from({ length: 46 }, (_, i) => { const a = Math.sin(i * 91.7) * 43758.5, b = Math.sin(i * 12.9) * 24634.6; return { x: a - Math.floor(a), y: b - Math.floor(b), p: i * 0.7, s: 0.6 + ((i * 37) % 10) / 10 }; });

function palm(ctx, x, y, h, lean, t, flip = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(flip, 1);
  ctx.strokeStyle = PAL.palm; ctx.fillStyle = PAL.palm; ctx.lineCap = 'round';
  ctx.lineWidth = h * 0.045;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(lean * 0.4, -h * 0.5, lean, -h); ctx.stroke();
  const tx = lean, ty = -h;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.42 + Math.sin(t * 0.9 + i) * 0.03, len = h * (0.42 + (i % 2) * 0.06);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.8 + len * 0.35;
    ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.5, ty + Math.sin(a) * len * 0.9 - len * 0.18, ex, ey);
    ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.5, ty + Math.sin(a) * len * 0.5 - len * 0.02, tx, ty);
    ctx.fill();
  }
  ctx.restore();
}

export function drawBackground(ctx, w, h, t, o = {}) {
  const groove = o.groove ?? 0, hz = h * 0.4;
  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, PAL.night); sky.addColorStop(0.55, PAL.dusk); sky.addColorStop(0.85, PAL.plum); sky.addColorStop(1, '#f0643e');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, hz + 1);
  for (const s of STARS) {
    const a = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.3 + s.p)), y = s.y * hz * 0.7;
    ctx.fillStyle = `rgba(255,240,220,${a * (1 - y / (hz * 0.8))})`; ctx.fillRect(s.x * w, y, s.s * 2, s.s * 2);
  }
  // sun on the horizon
  const sx = w * 0.7, sr = Math.min(w, h) * 0.13;
  const glow = ctx.createRadialGradient(sx, hz, sr * 0.2, sx, hz, sr * 3.2);
  glow.addColorStop(0, 'rgba(255,190,90,0.7)'); glow.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, hz - sr * 3.2, w, sr * 3.2);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, hz); ctx.clip();
  const sg = ctx.createLinearGradient(0, hz - sr, 0, hz + sr); sg.addColorStop(0, '#ffe9a8'); sg.addColorStop(1, '#ff9a4a');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, hz + sr * 0.15, sr, 0, TAU); ctx.fill(); ctx.restore();
  // sea
  const sea = ctx.createLinearGradient(0, hz, 0, h * 0.62);
  sea.addColorStop(0, '#f08a52'); sea.addColorStop(0.08, PAL.sea); sea.addColorStop(1, PAL.seaDeep);
  ctx.fillStyle = sea; ctx.fillRect(0, hz, w, h * 0.62 - hz + 1);
  for (let i = 0; i < 9; i++) {
    const y = hz + 10 + i * ((h * 0.22 - 10) / 9), ww = (60 + i * 26) * (0.8 + 0.2 * Math.sin(t * 0.7 + i * 2));
    const x = sx + Math.sin(t * 0.6 + i * 1.7) * (14 + i * 3) - ww / 2;
    ctx.fillStyle = `rgba(255,205,120,${0.5 - i * 0.04})`; ctx.fillRect(x, y, ww, 2.5 + i * 0.4);
  }
  // sand
  const sand = ctx.createLinearGradient(0, h * 0.62, 0, h);
  sand.addColorStop(0, '#d8a867'); sand.addColorStop(0.5, '#9a6a3c'); sand.addColorStop(1, '#4a2c18');
  ctx.fillStyle = sand; ctx.beginPath(); ctx.moveTo(0, h * 0.62);
  for (let x = 0; x <= w + 20; x += 20) ctx.lineTo(x, h * 0.62 + Math.sin(x * 0.012 + t * 0.4) * 3);
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  // foam line
  ctx.strokeStyle = 'rgba(255,240,220,0.45)'; ctx.lineWidth = 3; ctx.beginPath();
  for (let x = 0; x <= w + 20; x += 20) { const y = h * 0.62 + Math.sin(x * 0.012 + t * 0.4) * 3 + 2; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();
  // palms at the edges
  const ph = Math.min(h * 0.46, 420);
  palm(ctx, -6, h * 0.66, ph, 70, t, 1);
  palm(ctx, w + 6, h * 0.7, ph * 0.9, 60, t + 2, -1);
  // string lights: more bulbs glow as the groove builds
  const n = 11, lit = Math.round(2 + groove * (n - 2));
  ctx.strokeStyle = 'rgba(20,10,40,0.7)'; ctx.lineWidth = 2; ctx.beginPath();
  const ly = (x) => hz * 0.62 + Math.sin((x / w) * Math.PI) * 26 - 8 + (1 - Math.abs(x / w * 2 - 1)) * 0;
  for (let i = 0; i <= 40; i++) { const x = (i / 40) * w, y = hz * 0.4 + Math.sin((x / w) * Math.PI) * 34; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n) * w, y = hz * 0.4 + Math.sin((x / w) * Math.PI) * 34 + 4, on = i < lit || (n - 1 - i) < Math.floor(lit / 2);
    const pul = on ? 0.8 + 0.2 * Math.sin(t * 3 + i) : 0.15;
    const g = ctx.createRadialGradient(x, y + 6, 1, x, y + 6, 22); g.addColorStop(0, `rgba(255,214,120,${0.6 * pul})`); g.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 24, y - 18, 48, 48);
    ctx.fillStyle = on ? ['#ffd37a', '#ff9a8a', '#8ef0dc'][i % 3] : 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(x, y + 6, 5.5, 0, TAU); ctx.fill();
  }
  void ly;
  // soft vignette
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(8,2,20,0.5)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
}

// ---- the ravanne -------------------------------------------------------------------------------------------------------------------
// o: tension 0..1, hit 0..1 (flash), pulse 0..1, labels (beat numbers), hot 0..1 (warming glow)
export function drawDrum(ctx, cx, cy, r, o = {}) {
  const T = o.tension ?? 0.8, hit = o.hit ?? 0, pulse = o.pulse ?? 0, hot = o.hot ?? 0;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 1.04, r * 1.02, r * 0.16, 0, 0, TAU); ctx.fill();
  // hoop
  const hg = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  hg.addColorStop(0, PAL.woodHi); hg.addColorStop(0.5, PAL.wood); hg.addColorStop(1, PAL.woodLo);
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, cy, r * (1 + 0.012 * pulse), 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,160,0.45)'; ctx.lineWidth = r * 0.014; ctx.beginPath(); ctx.arc(cx, cy, r * 0.985, Math.PI * 1.05, Math.PI * 1.7); ctx.stroke();
  // wedges (tuning keys)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.26, x = cx + Math.cos(a) * r * 0.945, y = cy + Math.sin(a) * r * 0.945;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = i % 2 ? '#2d1608' : '#4a2810'; ctx.beginPath(); ctx.roundRect(-r * 0.035, -r * 0.022, r * 0.07, r * 0.044, r * 0.01); ctx.fill();
    ctx.restore();
  }
  // wood grain on the hoop and a bevelled inner edge, so the frame reads as a thick turned rim
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r * 0.99, 0, TAU); ctx.arc(cx, cy, r * 0.9, 0, TAU, true); ctx.clip();
  ctx.strokeStyle = 'rgba(40,16,4,0.22)'; ctx.lineWidth = Math.max(1, r * 0.006);
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(cx + r * 0.05 * Math.sin(i), cy + r * 0.04 * Math.cos(i * 1.7), r * (0.915 + i * 0.0085), 0.2 + i * 0.5, 2.6 + i * 0.5); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(20,8,2,0.75)'; ctx.lineWidth = r * 0.028; ctx.beginPath(); ctx.arc(cx, cy, r * 0.905, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,225,170,0.4)'; ctx.lineWidth = r * 0.01; ctx.beginPath(); ctx.arc(cx, cy, r * 0.925, Math.PI * 0.9, Math.PI * 1.75); ctx.stroke();
  // skin: cream when warm, dull and grey when slack, a rosy glow while warming
  const sr = r * 0.9;
  const sg = ctx.createRadialGradient(cx - sr * 0.25, cy - sr * 0.3, sr * 0.1, cx, cy, sr);
  const cold = 1 - clamp01(T);
  sg.addColorStop(0, hot > 0 ? '#fff0c8' : cold > 0.5 ? '#e0cfae' : '#fff1cf'); sg.addColorStop(0.7, cold > 0.5 ? '#bda27a' : '#ebc88a'); sg.addColorStop(1, cold > 0.5 ? '#8f7650' : '#c48b4c');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, sr, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(60,30,12,0.55)';
  for (let i = 0; i < 48; i++) { const an = (i / 48) * TAU; ctx.beginPath(); ctx.arc(cx + Math.cos(an) * sr * 0.965, cy + Math.sin(an) * sr * 0.965, Math.max(0.8, r * 0.0085), 0, TAU); ctx.fill(); }
  if (hot > 0) { const hg2 = ctx.createRadialGradient(cx, cy, sr * 0.2, cx, cy, sr); hg2.addColorStop(0, `rgba(255,170,70,${0.0})`); hg2.addColorStop(1, `rgba(255,120,40,${0.4 * hot})`); ctx.fillStyle = hg2; ctx.beginPath(); ctx.arc(cx, cy, sr, 0, TAU); ctx.fill(); }
  // wrinkles on a slack skin
  if (cold > 0.35) {
    ctx.strokeStyle = `rgba(80,50,20,${(cold - 0.35) * 0.5})`; ctx.lineWidth = r * 0.012;
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * sr * 0.18, cy + Math.sin(a) * sr * 0.18); ctx.quadraticCurveTo(cx + Math.cos(a + 0.25) * sr * 0.5, cy + Math.sin(a + 0.25) * sr * 0.5, cx + Math.cos(a) * sr * 0.88, cy + Math.sin(a) * sr * 0.88); ctx.stroke(); }
  }
  // skin sheen
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, sr, 0, TAU); ctx.clip();
  const sh = ctx.createLinearGradient(cx - sr, cy - sr, cx + sr * 0.2, cy + sr * 0.6); sh.addColorStop(0, 'rgba(255,255,255,0.35)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh; ctx.fillRect(cx - sr, cy - sr, sr * 2, sr * 2);
  // painted bands: the track ring and an inner ring
  ctx.strokeStyle = 'rgba(122,68,32,0.5)'; ctx.lineWidth = r * 0.02; ctx.beginPath(); ctx.arc(cx, cy, r * 0.85, 0, TAU); ctx.stroke();
  ctx.setLineDash([r * 0.04, r * 0.05]); ctx.beginPath(); ctx.arc(cx, cy, r * 0.45, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  // the track the dots land on
  ctx.strokeStyle = 'rgba(70,30,10,0.3)'; ctx.lineWidth = r * 0.17; ctx.beginPath(); ctx.arc(cx, cy, r * TRACK, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,200,0.4)'; ctx.lineWidth = r * 0.012; ctx.beginPath(); ctx.arc(cx, cy, r * (TRACK + 0.085), 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, r * (TRACK - 0.085), 0, TAU); ctx.stroke();
  // twelve slot ticks, bigger on the four beats
  for (let i = 0; i < 12; i++) {
    const a = slotAngle(i), beat = i % 3 === 0, r0 = r * (TRACK - (beat ? 0.085 : 0.05)), r1 = r * (TRACK + (beat ? 0.085 : 0.05));
    ctx.strokeStyle = beat ? 'rgba(60,24,6,0.85)' : 'rgba(60,24,6,0.45)'; ctx.lineWidth = beat ? r * 0.02 : r * 0.012;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
  }
  ctx.restore();
  if (hit > 0) { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, sr); g.addColorStop(0, `rgba(255,236,170,${0.55 * hit})`); g.addColorStop(1, 'rgba(255,200,100,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, sr, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// The sweeping beam: a bright clock hand with a fading wake behind it.
export function drawBeam(ctx, cx, cy, r, phase, o = {}) {
  const a = beamAngle(phase), alpha = o.alpha ?? 1;
  ctx.save();
  const N = 14, span = 0.95;
  for (let i = 0; i < N; i++) {
    const a0 = a - span * ((i + 1) / N), a1 = a - span * (i / N);
    ctx.fillStyle = `rgba(255,214,130,${0.3 * alpha * (1 - i / N) ** 1.5})`;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r * 0.9, a0, a1 + 0.004); ctx.closePath(); ctx.fill();
  }
  const x1 = cx + Math.cos(a) * r * 0.9, y1 = cy + Math.sin(a) * r * 0.9;
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(255,170,60,${0.35 * alpha})`; ctx.lineWidth = r * 0.06; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.1, cy + Math.sin(a) * r * 0.1); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = `rgba(255,248,214,${alpha})`; ctx.lineWidth = r * 0.022; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.1, cy + Math.sin(a) * r * 0.1); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.045, 0, TAU); ctx.fill();
  ctx.fillStyle = `rgba(255,240,190,${alpha})`; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * TRACK, cy + Math.sin(a) * r * TRACK, r * 0.05, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- stroke dots ---------------------------------------------------------------------------------------------------------------------
// Draws one stroke icon centred on (x, y), radius r. kind: boom slap ting shake warm.
export function drawStroke(ctx, x, y, r, kind, o = {}) {
  const col = KIND_COL[kind], a = o.alpha ?? 1, glow = o.glow ?? 0;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y);
  if (glow > 0) { const g = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.1); g.addColorStop(0, rgba(col, 0.55 * glow)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2.1, 0, TAU); ctx.fill(); }
  const body = (path, fill, dark) => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.save(); ctx.translate(0, r * 0.12); path(); ctx.fill(); ctx.restore();
    const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, fill); g.addColorStop(1, dark);
    ctx.fillStyle = g; path(); ctx.fill();
    ctx.strokeStyle = 'rgba(30,12,4,0.8)'; ctx.lineWidth = Math.max(2, r * 0.1); path(); ctx.stroke();
  };
  if (kind === 'boom') {
    body(() => { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); }, '#ffe08a', '#e8921e');
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.4, r * 0.34, r * 0.18, -0.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(90,40,0,0.55)'; ctx.lineWidth = r * 0.1; ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, TAU); ctx.stroke();
  } else if (kind === 'slap') {
    body(() => { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); }, '#8cf5e4', '#13917f');
    ctx.strokeStyle = 'rgba(4,50,46,0.85)'; ctx.lineWidth = r * 0.17; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.34); ctx.lineTo(r * 0.45, -r * 0.34); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.12, -r * 0.5); ctx.lineTo(r * 0.52, -r * 0.34); ctx.lineTo(r * 0.3, 0.02 * r + r * 0.02); ctx.stroke();
  } else if (kind === 'ting') {
    const tri = () => { ctx.beginPath(); for (let i = 0; i < 3; i++) { const an = -Math.PI / 2 + (i * TAU) / 3, px = Math.cos(an) * r * 1.12, py = Math.sin(an) * r * 1.12 + r * 0.14; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); };
    ctx.lineJoin = 'round';
    body(tri, '#e8d8ff', '#8a63d8');
    ctx.fillStyle = 'rgba(40,10,90,0.7)'; ctx.beginPath(); ctx.arc(0, r * 0.28, r * 0.17, 0, TAU); ctx.fill();
  } else if (kind === 'shake') {
    body(() => { ctx.beginPath(); ctx.roundRect(-r * 1.02, -r * 0.8, r * 2.04, r * 1.6, r * 0.5); }, '#ffb4a6', '#e04a3c');
    ctx.fillStyle = 'rgba(70,10,4,0.8)';
    [[-0.5, -0.1], [0.05, 0.28], [0.5, -0.18], [-0.1, -0.38], [0.25, 0.04]].forEach(([sx, sy]) => { ctx.beginPath(); ctx.ellipse(sx * r, sy * r, r * 0.13, r * 0.09, sx * 2, 0, TAU); ctx.fill(); });
  } else if (kind === 'warm') {
    const fl = () => { ctx.beginPath(); ctx.moveTo(0, -r * 1.15); ctx.bezierCurveTo(r * 0.9, -r * 0.3, r * 0.95, r * 0.6, 0, r * 0.95); ctx.bezierCurveTo(-r * 0.95, r * 0.6, -r * 0.9, -r * 0.3, 0, -r * 1.15); };
    body(fl, '#ffd36a', '#ee5a1a');
    ctx.fillStyle = 'rgba(255,250,210,0.9)'; ctx.beginPath(); ctx.ellipse(0, r * 0.35, r * 0.32, r * 0.42, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---- pads --------------------------------------------------------------------------------------------------------------------------------
export function drawTriangle(ctx, p, o = {}) {
  const hit = o.hit ?? 0, glow = o.glow ?? 0, r = p.r, t = o.t ?? 0;
  ctx.save(); ctx.translate(p.cx, p.cy);
  if (glow > 0) { const g = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.9); g.addColorStop(0, rgba(KIND_COL.ting, 0.5 * glow)); g.addColorStop(1, rgba(KIND_COL.ting, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.9, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(8,2,24,0.5)'; ctx.beginPath(); ctx.arc(0, r * 0.1, r * 1.12, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(KIND_COL.ting, 0.55); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, r * 0.1, r * 1.12, 0, TAU); ctx.stroke();
  ctx.rotate(Math.sin(t * 38) * 0.07 * hit);
  // cord
  ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -r * 1.12); ctx.lineTo(0, -r * 0.66); ctx.stroke();
  // metal bar bent into a triangle
  const pts = [[0, -r * 0.7], [r * 0.78, r * 0.62], [-r * 0.78, r * 0.62]];
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = r * 0.2; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1] + 5); ctx.lineTo(pts[1][0], pts[1][1] + 5); ctx.lineTo(pts[2][0], pts[2][1] + 5); ctx.closePath(); ctx.stroke();
  const mg = ctx.createLinearGradient(-r, -r, r, r); mg.addColorStop(0, '#fdfdff'); mg.addColorStop(0.5, '#b7c2d6'); mg.addColorStop(1, '#7c879f');
  ctx.strokeStyle = mg; ctx.lineWidth = r * 0.16; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); ctx.lineTo(pts[2][0], pts[2][1]); ctx.closePath(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = r * 0.04; ctx.beginPath(); ctx.moveTo(pts[0][0] - 2, pts[0][1] + 4); ctx.lineTo(pts[2][0] + 4, pts[2][1] - 3); ctx.stroke();
  ctx.restore();
  if (hit > 0) for (let k = 0; k < 2; k++) { const q = clamp01(1 - hit + k * 0.2); ctx.strokeStyle = rgba(KIND_COL.ting, 0.6 * (1 - q)); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.cx, p.cy, r * (1.1 + q * 0.8), 0, TAU); ctx.stroke(); }
}

export function drawMaravanne(ctx, p, o = {}) {
  const hit = o.hit ?? 0, glow = o.glow ?? 0, t = o.t ?? 0, w = p.w, h = p.h;
  ctx.save(); ctx.translate(p.cx + Math.sin(t * 60) * 5 * hit, p.cy);
  if (glow > 0) { const g = ctx.createRadialGradient(0, 0, h * 0.3, 0, 0, w * 0.9); g.addColorStop(0, rgba(KIND_COL.shake, 0.45 * glow)); g.addColorStop(1, rgba(KIND_COL.shake, 0)); ctx.fillStyle = g; ctx.fillRect(-w, -w, w * 2, w * 2); }
  ctx.fillStyle = 'rgba(8,2,24,0.5)'; ctx.beginPath(); ctx.roundRect(-w / 2 - 6, -h / 2 - 2, w + 12, h + 12, 22); ctx.fill();
  const fg = ctx.createLinearGradient(0, -h / 2, 0, h / 2); fg.addColorStop(0, PAL.woodHi); fg.addColorStop(1, PAL.woodLo);
  ctx.fillStyle = fg; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 18); ctx.fill();
  const ig = ctx.createLinearGradient(0, -h / 2, 0, h / 2); ig.addColorStop(0, '#f6e2b4'); ig.addColorStop(1, '#d9b070');
  ctx.fillStyle = ig; ctx.beginPath(); ctx.roundRect(-w / 2 + 9, -h / 2 + 9, w - 18, h - 18, 11); ctx.fill();
  // woven lines and seeds
  ctx.strokeStyle = 'rgba(122,68,32,0.35)'; ctx.lineWidth = 2;
  for (let i = 1; i < 6; i++) { const y = -h / 2 + 9 + ((h - 18) * i) / 6; ctx.beginPath(); ctx.moveTo(-w / 2 + 12, y); ctx.lineTo(w / 2 - 12, y); ctx.stroke(); }
  ctx.fillStyle = '#7a1c14';
  for (let i = 0; i < 14; i++) { const sx = (((i * 37) % 100) / 100 - 0.5) * (w - 44), sy = (((i * 61) % 100) / 100 - 0.5) * (h - 40) - Math.sin(t * 40 + i) * 6 * hit; ctx.beginPath(); ctx.ellipse(sx, sy, 5.5, 3.8, i, 0, TAU); ctx.fill(); }
  ctx.restore();
  if (hit > 0) { ctx.strokeStyle = rgba(KIND_COL.shake, 0.7 * hit); ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(p.cx - w / 2 - 8 - 14 * (1 - hit), p.cy - h / 2 - 8 - 14 * (1 - hit), w + 16 + 28 * (1 - hit), h + 16 + 28 * (1 - hit), 26); ctx.stroke(); }
}

export function drawFire(ctx, p, o = {}) {
  const t = o.t ?? 0, heat = o.heat ?? 0, glow = o.glow ?? 0, r = p.r;
  ctx.save(); ctx.translate(p.cx, p.cy);
  const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * (1.9 + heat * 0.9)); g.addColorStop(0, `rgba(255,150,50,${0.45 + 0.35 * heat + 0.2 * glow})`); g.addColorStop(1, 'rgba(255,100,30,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * (1.9 + heat * 0.9), 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(8,2,24,0.45)'; ctx.beginPath(); ctx.ellipse(0, r * 0.62, r * 1.0, r * 0.38, 0, 0, TAU); ctx.fill();
  // ember stones
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; ctx.fillStyle = i % 2 ? '#3a2a30' : '#52383a'; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * 0.78, r * 0.55 + Math.sin(a) * r * 0.28, r * 0.2, r * 0.14, 0, 0, TAU); ctx.fill(); }
  // two crossed logs
  ctx.lineCap = 'round'; ctx.strokeStyle = '#4a2410'; ctx.lineWidth = r * 0.24; ctx.beginPath(); ctx.moveTo(-r * 0.6, r * 0.55); ctx.lineTo(r * 0.6, r * 0.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(r * 0.6, r * 0.55); ctx.lineTo(-r * 0.6, r * 0.2); ctx.stroke();
  // flames
  const flames = [[-0.38, 0.8, 0.0], [0.0, 1.15, 1.3], [0.38, 0.85, 2.4], [-0.15, 0.7, 3.1], [0.2, 0.65, 4.0]];
  flames.forEach(([fx, fh, ph], i) => {
    const k = 1 + 0.22 * Math.sin(t * 9 + ph * 2) + heat * 0.35, hh = r * fh * k * (0.9 + 0.1 * Math.sin(t * 13 + ph)), w = r * 0.34 * (1 - i * 0.04), sway = Math.sin(t * 5 + ph) * r * 0.1;
    ctx.fillStyle = i < 3 ? (i === 1 ? '#ffb23a' : '#ff7a20') : 'rgba(255,214,110,0.9)';
    ctx.beginPath(); ctx.moveTo(fx * r - w, r * 0.35); ctx.quadraticCurveTo(fx * r - w * 0.6 + sway * 0.4, r * 0.35 - hh * 0.5, fx * r + sway, r * 0.35 - hh); ctx.quadraticCurveTo(fx * r + w * 0.6 + sway * 0.4, r * 0.35 - hh * 0.5, fx * r + w, r * 0.35); ctx.closePath(); ctx.fill();
  });
  ctx.restore();
}

// ---- dancer ----------------------------------------------------------------------------------------------------------------------------
// (x, y) is her waist. s = scale (1 = about 175 units from waist to the top of the head). beat: 0..1 within the beat; energy 0..1.2; bounce 0..1.
export function drawDancer(ctx, x, y, s, t, o = {}) {
  const energy = o.energy ?? 0.3, beat = o.beat ?? 0, bounce = o.bounce ?? 0, paused = o.paused;
  const sway = Math.sin(t * Math.PI * (o.rate ?? 2) ) * (0.4 + energy * 0.8);
  const hipX = sway * 16 * s, dip = (Math.abs(Math.sin(beat * Math.PI)) * 5 + bounce * 7) * s * (paused ? 0 : 1);
  ctx.save(); ctx.translate(x + hipX, y + dip); ctx.scale(s, s);
  // skirt: layered bell in three colours, hem swinging against the hip
  const hem = 150, flare = 118 + energy * 22, hs = -sway * 26;
  const skirt = (c0, c1, k, off) => {
    const g = ctx.createLinearGradient(0, 0, 0, hem); g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-26, 0);
    ctx.bezierCurveTo(-48 * k, 60, -flare * k + hs * 0.4, hem * 0.78, -flare * k + hs + off, hem);
    for (let i = 0; i <= 6; i++) { const u = i / 6; ctx.quadraticCurveTo(lerp(-flare * k, flare * k, (i + 0.5) / 6) + hs + off, hem + (i % 2 ? -4 : 14), lerp(-flare * k, flare * k, u) + hs + off, hem + 2); }
    ctx.bezierCurveTo(flare * k + hs * 0.4, hem * 0.78, 48 * k, 60, 26, 0); ctx.closePath(); ctx.fill();
  };
  skirt('#ffe08a', '#f2a21e', 1.0, 0);
  ctx.save(); ctx.beginPath(); ctx.rect(-200, 0, 400, 300); ctx.clip();
  skirt('#ff8e7a', '#d93a52', 0.86, 4);
  skirt('#46e6d0', '#119184', 0.7, 8);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 3;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 8, 8); ctx.quadraticCurveTo(i * 26 + hs * 0.3, 70, i * 42 + hs, hem - 6); ctx.stroke(); }
  // torso
  const lean = -sway * 0.07;
  ctx.save(); ctx.rotate(lean);
  const tg = ctx.createLinearGradient(-30, -80, 30, 0); tg.addColorStop(0, '#fffaf0'); tg.addColorStop(1, '#f2cf86');
  ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(-24, 4); ctx.quadraticCurveTo(-34, -40, -30, -78); ctx.lineTo(30, -78); ctx.quadraticCurveTo(34, -40, 24, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d93a52'; ctx.beginPath(); ctx.roundRect(-27, -6, 54, 12, 5); ctx.fill();            // sash
  // arms: one reaches up and waves, the other holds the skirt out
  const wave = Math.sin(t * Math.PI * (o.rate ?? 2) * 1.0 + 1.2), up = 0.7 + energy * 0.5;
  const arm = (sx, a1, a2, len1, len2) => {
    const ex = sx + Math.cos(a1) * len1, ey = -70 + Math.sin(a1) * len1, hx = ex + Math.cos(a2) * len2, hy = ey + Math.sin(a2) * len2;
    ctx.strokeStyle = '#b37445'; ctx.lineCap = 'round'; ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(sx, -70); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = '#b37445'; ctx.beginPath(); ctx.arc(hx, hy, 9, 0, TAU); ctx.fill();
  };
  arm(-28, Math.PI * 0.85 - wave * 0.12, -Math.PI * 0.5 - wave * 0.55 * up, 46, 48);
  arm(28, Math.PI * 0.18 + sway * 0.18, Math.PI * 0.05 - sway * 0.1 + 0.15, 50, 44);
  // neck + head
  ctx.fillStyle = '#b37445'; ctx.fillRect(-8, -96, 16, 22);
  const tilt = sway * 0.1;
  ctx.save(); ctx.translate(0, -122); ctx.rotate(tilt);
  ctx.fillStyle = '#1d1210'; ctx.beginPath(); ctx.arc(0, -4, 30, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
  ctx.beginPath(); ctx.arc(-24, 12, 12, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(24, 12, 12, 0, TAU); ctx.fill();
  const fg = ctx.createLinearGradient(-22, -26, 22, 26); fg.addColorStop(0, '#c98a58'); fg.addColorStop(1, '#a46438');
  ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(0, 2, 22, 26, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1d1210'; ctx.beginPath(); ctx.ellipse(0, -18, 24, 13, 0, Math.PI, TAU); ctx.fill();
  ctx.strokeStyle = '#2a1410'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-8, 2, 5, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); ctx.beginPath(); ctx.arc(8, 2, 5, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  ctx.strokeStyle = '#7a2a22'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(0, 11, 9, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  // flower in the hair
  ctx.fillStyle = '#ff4a5e'; for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; ctx.beginPath(); ctx.ellipse(-22 + Math.cos(a) * 8, -14 + Math.sin(a) * 8, 7, 4.5, a, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#ffd37a'; ctx.beginPath(); ctx.arc(-22, -14, 4, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.restore();
}

// ---- particles --------------------------------------------------------------------------------------------------------------------------
export function burst(parts, rng, x, y, n, col, speed = 1) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), v = rng.range(40, 220) * speed;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: rng.range(0.35, 0.8), age: 0, r: rng.range(2, 5.5), col });
  }
  if (parts.length > 220) parts.splice(0, parts.length - 220);
}
export function stepParticles(parts, dt) {
  for (const p of parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.vx *= 1 - dt * 1.6; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age >= parts[i].life) parts.splice(i, 1);
}
export function drawParticles(ctx, parts) {
  for (const p of parts) { const k = 1 - p.age / p.life; ctx.fillStyle = rgba(p.col, k); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.4 + k * 0.7), 0, TAU); ctx.fill(); }
}

export { CUE_OUT, TRACK, ease };

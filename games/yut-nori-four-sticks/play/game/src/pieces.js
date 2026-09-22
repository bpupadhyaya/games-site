// Sprites: the two token sets (lacquered wooden pucks with a carved horse), the four carved sticks, the paper lantern.
// Each is painted once into a cached canvas and drawn with drawImage.
const TAU = Math.PI * 2;
const SC = 2;   // sprite resolution multiplier

function cached(key, w, h, paint, store) {
  if (key in store) return store[key];
  store[key] = null;
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const c = new OffscreenCanvas(Math.ceil(w * SC), Math.ceil(h * SC)), x = c.getContext('2d');
      x.scale(SC, SC); paint(x); store[key] = c;
    }
  } catch { store[key] = null; }
  return store[key];
}
const store = {};

// ---- tokens --------------------------------------------------------------------------------------------
export const TEAMS = [
  { name: 'Blue', top: ['#5b7fd0', '#2c4a9a', '#182a63'], side: ['#1b2b66', '#0d1638'], rim: '#efd07a', inlay: '#f4e3a8', rgb: '90,140,255' },
  { name: 'Red', top: ['#ee6a4e', '#c23a26', '#7c1a12'], side: ['#8a2214', '#4a0d08'], rim: '#efd07a', inlay: '#f7dfae', rgb: '255,110,80' },
];
function horse(ctx) {
  ctx.beginPath();
  ctx.moveTo(26, 88);
  ctx.bezierCurveTo(30, 66, 30, 50, 38, 36);
  ctx.bezierCurveTo(40, 24, 44, 16, 47, 8);
  ctx.lineTo(52, 22);
  ctx.bezierCurveTo(58, 19, 65, 21, 71, 28);
  ctx.bezierCurveTo(79, 40, 88, 55, 92, 65);
  ctx.bezierCurveTo(95, 72, 90, 79, 83, 78);
  ctx.lineTo(75, 75);
  ctx.bezierCurveTo(71, 81, 65, 81, 62, 74);
  ctx.bezierCurveTo(58, 79, 56, 85, 58, 94);
  ctx.closePath();
}
function paintToken(ctx, team) {
  const T = TEAMS[team], cx = 50, cy = 46, rx = 40, ry = 35, th = 15;
  // side (thickness)
  const sg = ctx.createLinearGradient(0, cy, 0, cy + th + ry); sg.addColorStop(0, T.side[0]); sg.addColorStop(1, T.side[1]);
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(cx, cy + th, rx, ry, 0, 0, Math.PI); ctx.lineTo(cx - rx, cy); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
  ctx.fillStyle = sg; ctx.fillRect(cx - rx, cy, rx * 2, th); ctx.beginPath(); ctx.ellipse(cx, cy + th, rx, ry, 0, 0, Math.PI); ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,140,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(cx, cy + th, rx - 0.5, ry - 0.5, 0, 0.15, Math.PI - 0.15); ctx.stroke();
  // top face
  const g = ctx.createRadialGradient(cx - 14, cy - 14, 4, cx, cy, rx + 6); g.addColorStop(0, T.top[0]); g.addColorStop(0.55, T.top[1]); g.addColorStop(1, T.top[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = T.rim; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, cy, rx - 2, ry - 2, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(cx, cy, rx - 6, ry - 6, 0, 0, TAU); ctx.stroke();
  // carved horse: a dark cut and a pale inlay slightly offset
  for (const [dx, dy, col] of [[1.2, 1.6, 'rgba(0,0,0,0.45)'], [0, 0, T.inlay]]) {
    ctx.save(); ctx.translate(cx + dx, cy + dy); ctx.scale(0.36, 0.30); ctx.translate(-52, -50); ctx.fillStyle = col; horse(ctx); ctx.fill(); ctx.restore();
  }
  ctx.save(); ctx.translate(cx, cy); ctx.scale(0.36, 0.30); ctx.translate(-52, -50);
  ctx.fillStyle = T.top[2]; ctx.beginPath(); ctx.arc(63, 40, 2.6, 0, TAU); ctx.fill();
  ctx.strokeStyle = T.top[2]; ctx.lineWidth = 1.6; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(40 - k * 1.5, 30 + k * 9); ctx.lineTo(33 - k * 1.5, 36 + k * 9); ctx.stroke(); }
  ctx.restore();
  // lacquer highlight
  const hg = ctx.createLinearGradient(cx - 26, cy - 30, cx + 6, cy - 6); hg.addColorStop(0, 'rgba(255,255,255,0.5)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(cx - 12, cy - 15, 22, 9, -0.5, 0, TAU); ctx.fill();
}

const blobs = {};
function blob(ctx, x, y, rx, ry, rgb, a) {
  if (!(rgb in blobs)) {
    blobs[rgb] = null;
    try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(96, 96), b = c.getContext('2d'); const g = b.createRadialGradient(48, 48, 2, 48, 48, 48); g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(1, `rgba(${rgb},0)`); b.fillStyle = g; b.fillRect(0, 0, 96, 96); blobs[rgb] = c; } } catch { blobs[rgb] = null; }
  }
  const ga = ctx.globalAlpha;
  if (blobs[rgb]) { ctx.globalAlpha = ga * a; ctx.drawImage(blobs[rgb], x - rx, y - ry, rx * 2, ry * 2); ctx.globalAlpha = ga; }
  else { ctx.fillStyle = `rgba(${rgb},${a * 0.5})`; ctx.beginPath(); ctx.ellipse(x, y, rx * 0.7, ry * 0.7, 0, 0, TAU); ctx.fill(); }
}
export { blob };

// opts: { scale, lift (px raised), glow (rgb), dim, n (stack size) }
export function drawToken(ctx, x, y, team, o = {}) {
  const s = (o.scale ?? 1) * 0.86, lift = o.lift ?? 0, n = o.n ?? 1;
  const spr = cached('t' + team, 100, 100, (c) => paintToken(c, team), store);
  ctx.save();
  if (o.dim) ctx.globalAlpha *= 0.4;
  if (o.glow) blob(ctx, x, y + 6, 66 * s, 44 * s, o.glow, 0.9);
  blob(ctx, x + 5, y + 14, 46 * s * (1 - lift / 300), 22 * s, '0,0,0', 0.6 - Math.min(0.3, lift / 200));
  const layers = Math.min(n, 4);
  for (let k = 0; k < layers; k++) {
    const ly = y - lift - k * 12 * s, w = 100 * s;
    if (spr) ctx.drawImage(spr, x - w / 2, ly - 50 * s, w, w); else { ctx.fillStyle = TEAMS[team].top[1]; ctx.beginPath(); ctx.arc(x, ly - 4, 30 * s, 0, TAU); ctx.fill(); }
  }
  if (n > 1) {
    const bx = x + 26 * s, by = y - lift - (layers - 1) * 12 * s - 36 * s;
    ctx.fillStyle = '#fff4d6'; ctx.strokeStyle = '#2a1608'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bx, by, 15, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a1608'; ctx.font = '700 20px "Cormorant Garamond", Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText(String(n), bx, by + 6);
  }
  ctx.restore();
}

// ---- sticks --------------------------------------------------------------------------------------------
const SL = 210, SWD = 46;            // stick length and width
function paintStick(ctx, kind) {   // kind: 'flat' | 'flatMark' | 'round' | 'edge'
  const w = SWD, l = SL, x0 = 4, y0 = 4;
  const shape = () => { ctx.beginPath(); ctx.roundRect(x0, y0, w, l, 18); };
  if (kind === 'edge') { const g = ctx.createLinearGradient(x0, 0, x0 + w, 0); g.addColorStop(0, '#3a220f'); g.addColorStop(0.5, '#b58a54'); g.addColorStop(1, '#3a220f'); ctx.fillStyle = g; shape(); ctx.fill(); return; }
  if (kind === 'round') {
    const g = ctx.createLinearGradient(x0, 0, x0 + w, 0); g.addColorStop(0, '#2a180a'); g.addColorStop(0.25, '#6d4522'); g.addColorStop(0.5, '#9a6a38'); g.addColorStop(0.75, '#6a421f'); g.addColorStop(1, '#2a180a');
    ctx.fillStyle = g; shape(); ctx.fill();
    ctx.save(); shape(); ctx.clip(); ctx.strokeStyle = 'rgba(30,14,4,0.55)'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 14; k++) { const y = y0 + 14 + k * 14; ctx.beginPath(); ctx.moveTo(x0 + 3, y); ctx.quadraticCurveTo(x0 + w / 2, y + (k % 2 ? 4 : -4), x0 + w - 3, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,220,160,0.28)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0 + w * 0.42, y0 + 12); ctx.lineTo(x0 + w * 0.42, y0 + l - 12); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(20,8,0,0.7)'; ctx.lineWidth = 2; shape(); ctx.stroke();
    return;
  }
  const g = ctx.createLinearGradient(x0, 0, x0 + w, 0); g.addColorStop(0, '#c9ad76'); g.addColorStop(0.2, '#f1e3bd'); g.addColorStop(0.8, '#ead8ac'); g.addColorStop(1, '#bd9f68');
  ctx.fillStyle = g; shape(); ctx.fill();
  ctx.save(); shape(); ctx.clip();
  ctx.strokeStyle = 'rgba(120,80,30,0.22)'; ctx.lineWidth = 1;
  for (let k = 0; k < 9; k++) { const x = x0 + 6 + k * 4.4; ctx.beginPath(); ctx.moveTo(x, y0); ctx.bezierCurveTo(x + 3, y0 + 70, x - 3, y0 + 140, x + 1, y0 + l); ctx.stroke(); }
  // carved grooves
  ctx.strokeStyle = 'rgba(70,40,15,0.75)'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
  for (const yy of [0.32, 0.5, 0.68]) { ctx.beginPath(); ctx.moveTo(x0 + 8, y0 + l * yy - 3); ctx.lineTo(x0 + w - 8, y0 + l * yy + 3); ctx.stroke(); }
  if (kind === 'flatMark') { ctx.strokeStyle = 'rgba(190,40,30,0.95)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x0 + 9, y0 + 20); ctx.lineTo(x0 + w - 9, y0 + 50); ctx.moveTo(x0 + w - 9, y0 + 20); ctx.lineTo(x0 + 9, y0 + 50); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(90,55,20,0.85)'; ctx.lineWidth = 2; shape(); ctx.stroke();
}
// face: cos of the tumble angle (+ = flat side toward the sky, - = round side). x,y = point on the mat, h = height above it
export function drawStick(ctx, x, y, rot, face, marked, h = 0) {
  const a = Math.abs(face);
  const kind = a < 0.22 ? 'edge' : face > 0 ? (marked ? 'flatMark' : 'flat') : 'round';
  const spr = cached('s-' + kind, SWD + 8, SL + 8, (c) => paintStick(c, kind), store);
  const sc = 1 + h / 900, wid = Math.max(0.16, a) * sc;
  ctx.save();
  // shadow on the mat
  ctx.globalAlpha = Math.max(0.12, 0.5 - h / 320);
  ctx.fillStyle = '#000'; ctx.translate(x + h * 0.14, y + h * 0.06); ctx.rotate(rot);
  ctx.beginPath(); ctx.ellipse(6, 6, (SWD / 2 + 3) * Math.max(0.4, a) * (1 + h / 500), SL / 2, 0, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.translate(x, y - h * 0.9); ctx.rotate(rot); ctx.scale(wid, sc);
  if (spr) ctx.drawImage(spr, -(SWD + 8) / 2, -(SL + 8) / 2, SWD + 8, SL + 8);
  else { ctx.fillStyle = face > 0 ? '#eadcb0' : '#6a421f'; ctx.fillRect(-SWD / 2, -SL / 2, SWD, SL); }
  ctx.restore();
}

// ---- lantern -------------------------------------------------------------------------------------------
function paintLantern(ctx) {
  const g = ctx.createRadialGradient(50, 62, 4, 50, 62, 52); g.addColorStop(0, '#fff2c0'); g.addColorStop(0.55, '#f5b95a'); g.addColorStop(1, '#c46a26');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(50, 66, 38, 46, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(120,50,10,0.55)'; ctx.lineWidth = 1.6;
  for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(50, 66, Math.abs(k) * 12.5 + 0.1, 46, 0, 0, TAU); ctx.stroke(); }
  for (const yy of [40, 66, 92]) { ctx.beginPath(); ctx.ellipse(50, yy, 38 * Math.sqrt(Math.max(0, 1 - ((yy - 66) / 46) ** 2)), 5, 0, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = '#4a2810'; ctx.fillRect(28, 16, 44, 9); ctx.fillRect(28, 108, 44, 9);
  ctx.fillStyle = '#b52d20'; for (let k = 0; k < 5; k++) ctx.fillRect(34 + k * 8, 117, 3, 22);
}
export function drawLantern(ctx, x, y, s, t) {
  const spr = cached('lantern', 100, 140, paintLantern, store);
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 0.9 + x) * 0.05);
  ctx.strokeStyle = 'rgba(40,22,8,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -300); ctx.lineTo(0, 12 * s); ctx.stroke();
  const fl = 0.85 + 0.15 * Math.sin(t * 5 + x * 0.1) + 0.05 * Math.sin(t * 13);
  blob(ctx, 0, 60 * s, 170 * s * fl, 170 * s * fl, '255,190,90', 0.42);
  if (spr) ctx.drawImage(spr, -50 * s, 0, 100 * s, 140 * s);
  ctx.restore();
}

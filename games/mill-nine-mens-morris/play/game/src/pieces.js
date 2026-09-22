// The men: turned wooden discs with lathe rings. Painted once per set into sprites (never per frame).
const TAU = Math.PI * 2;
export const SETS = {
  boxwood: { name: 'Boxwood and walnut', men: [{ hi: '#fff0c4', mid: '#e3c283', lo: '#a57b3e', side: '#8b622c', ring: 'rgba(120,80,30,0.45)' }, { hi: '#6d4a32', mid: '#3d2416', lo: '#1e0f08', side: '#160a05', ring: 'rgba(0,0,0,0.55)' }] },
  ivory: { name: 'Ivory and ebony', men: [{ hi: '#ffffff', mid: '#eee6d2', lo: '#b8ad92', side: '#9d9378', ring: 'rgba(110,100,80,0.4)' }, { hi: '#5a5a64', mid: '#26262c', lo: '#0c0c10', side: '#08080b', ring: 'rgba(0,0,0,0.6)' }] },
};
export const SET_NAMES = { boxwood: 'Boxwood and walnut', ivory: 'Ivory and ebony' };
const SPR = { w: 140, h: 120, cx: 70, cy: 62, r: 50 }, SCALE = 2;

function paintMan(ctx, c) {
  const { cx, cy, r } = SPR, rx = r, ry = r * 0.86, th = 15;
  // side band
  const sg = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0); sg.addColorStop(0, c.side); sg.addColorStop(0.3, c.lo); sg.addColorStop(0.7, c.side); sg.addColorStop(1, '#000');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(cx, cy + th, rx, ry, 0, 0, Math.PI); ctx.lineTo(cx - rx, cy); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
  ctx.fillStyle = c.side; ctx.beginPath(); ctx.ellipse(cx, cy + th, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(cx - rx, cy); ctx.lineTo(cx - rx, cy + th); ctx.ellipse(cx, cy + th, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(cx + rx, cy); ctx.closePath(); ctx.fill();
  // top face
  const tg = ctx.createRadialGradient(cx - rx * 0.4, cy - ry * 0.45, 2, cx, cy, rx * 1.05); tg.addColorStop(0, c.hi); tg.addColorStop(0.55, c.mid); tg.addColorStop(1, c.lo);
  ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(cx, cy, rx - 1, ry - 1, 0, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke();
  // lathe rings and a shallow dish
  for (const f of [0.82, 0.66, 0.34]) { ctx.strokeStyle = c.ring; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(cx, cy, rx * f, ry * f, 0, 0, TAU); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(cx + 0.8, cy + 1.6, rx * f, ry * f, 0, 0, TAU); ctx.stroke(); }
  const dish = ctx.createRadialGradient(cx - 4, cy - 3, 1, cx, cy, rx * 0.34); dish.addColorStop(0, 'rgba(0,0,0,0.0)'); dish.addColorStop(1, 'rgba(0,0,0,0.16)'); ctx.fillStyle = dish; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.34, ry * 0.34, 0, 0, TAU); ctx.fill();
  // grain hint
  ctx.strokeStyle = c.ring; ctx.lineWidth = 0.9; for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(cx - rx * 0.7, cy + k * 7); ctx.quadraticCurveTo(cx, cy + k * 7 + 4, cx + rx * 0.7, cy + k * 7); ctx.stroke(); }
  // specular
  const sp = ctx.createRadialGradient(cx - rx * 0.42, cy - ry * 0.5, 0, cx - rx * 0.42, cy - ry * 0.5, rx * 0.5); sp.addColorStop(0, 'rgba(255,255,255,0.5)'); sp.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sp; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill();
}
const sprites = {};
function sprite(side, set) {
  const key = side + set;
  if (!(key in sprites)) {
    sprites[key] = null;
    try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(SPR.w * SCALE, SPR.h * SCALE), s = c.getContext('2d'); s.scale(SCALE, SCALE); paintMan(s, (SETS[set] ?? SETS.boxwood).men[side]); sprites[key] = c; } } catch { sprites[key] = null; }
  }
  return sprites[key];
}
const blobs = {};
function blob(ctx, x, y, rx, ry, rgb, a) {
  if (!(rgb in blobs)) {
    blobs[rgb] = null;
    try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(128, 128), b = c.getContext('2d'), g = b.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(1, `rgba(${rgb},0)`); b.fillStyle = g; b.fillRect(0, 0, 128, 128); blobs[rgb] = c; } } catch { blobs[rgb] = null; }
  }
  const ga = ctx.globalAlpha; ctx.globalAlpha = ga * a;
  if (blobs[rgb]) ctx.drawImage(blobs[rgb], x - rx, y - ry, rx * 2, ry * 2);
  else { const g = ctx.createRadialGradient(x, y, 0, x, y, rx); g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = ga;
}
export { blob };
// (x, y) = the point on the board; r = piece radius on screen. opts: lift (0..1), selected, dim, alpha, scale
export function drawMan(ctx, x, y, r, side, set, opts = {}) {
  const lift = opts.lift ?? 0, k = (r / SPR.r) * (opts.scale ?? 1);
  ctx.save(); if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (opts.selected) blob(ctx, x, y + r * 0.1, r * 1.9, r * 1.4, '255,214,120', 0.85);
  blob(ctx, x + r * 0.18, y + r * 0.34, r * (1.25 - lift * 0.15), r * 0.62, '0,0,0', 0.62 - lift * 0.25);
  const s = sprite(side, set), ty = y - lift * r * 0.9 - 6 * k;
  ctx.translate(x, ty); ctx.scale(k, k);
  if (s) ctx.drawImage(s, -SPR.cx, -SPR.cy, SPR.w, SPR.h); else { ctx.translate(-SPR.cx, -SPR.cy); paintMan(ctx, (SETS[set] ?? SETS.boxwood).men[side]); }
  ctx.restore();
}

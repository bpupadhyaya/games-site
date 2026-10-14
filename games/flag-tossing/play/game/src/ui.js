// Small drawing helpers for the interface: text, flat buttons, panels, icons. Pure canvas.
import { PAL, UI, DISPLAY, rgba } from './art.js';
import { host } from './layout.js';

// Text that never goes below ~11 css px.
export const minUnits = () => 11.5 / Math.max(0.2, host.px);

export function txt(ctx, s, x, y, size, color = PAL.text, o = {}) {
  ctx.font = `${o.weight ?? 600} ${Math.max(size, minUnits())}px ${o.font ?? UI}`;
  ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'middle'; ctx.fillStyle = color;
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor ?? 'rgba(8,16,36,0.85)'; ctx.strokeText(s, x, y); }
  if (o.maxW && ctx.measureText(s).width > o.maxW) {                      // squeeze to fit rather than overflow
    const k = o.maxW / ctx.measureText(s).width; ctx.font = `${o.weight ?? 600} ${Math.max(size * k, minUnits())}px ${o.font ?? UI}`;
  }
  ctx.fillText(s, x, y);
}

// Greedy word wrap into lines no wider than maxW at the font currently set on ctx.
export function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxW) { out.push(line); line = word; } else line = next;
    }
    out.push(line);
  }
  return out;
}

export function rrect(ctx, r, rad) { ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); }

// ---- the world's own furniture: carved walnut plaques with a brass rim, lacquered buttons --------------------------------------------------
let woodCanvas = null;
function woodTile() {
  if (woodCanvas !== null) return woodCanvas;
  try {
    if (typeof OffscreenCanvas !== 'function') { woodCanvas = false; return woodCanvas; }
    const c = new OffscreenCanvas(192, 192);
    const g = c.getContext('2d');
    g.fillStyle = '#3a2314'; g.fillRect(0, 0, 192, 192);
    let sd = 7; const r = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
    for (let i = 0; i < 46; i++) {
      const y = r() * 192, a = r() > 0.5;
      g.strokeStyle = a ? `rgba(255,214,160,${0.03 + r() * 0.07})` : `rgba(10,4,0,${0.12 + r() * 0.2})`;
      g.lineWidth = 0.8 + r() * 2.4;
      g.beginPath(); g.moveTo(-4, y); g.bezierCurveTo(48, y + (r() - 0.5) * 9, 140, y + (r() - 0.5) * 9, 196, y + (r() - 0.5) * 5); g.stroke();
    }
    woodCanvas = c;
  } catch { woodCanvas = false; }
  return woodCanvas;
}
const brassGrad = (ctx, r) => {
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  g.addColorStop(0, '#fff0b0'); g.addColorStop(0.35, '#e3b24a'); g.addColorStop(0.7, '#9a6a18'); g.addColorStop(1, '#d9a638');
  return g;
};
// A plaque: dark carved wood (tinted by `fill`), a brass rim and a small stud in each corner.
function plaque(ctx, r, rad, o = {}) {
  const tile = woodTile();
  ctx.save();
  rrect(ctx, r, rad); ctx.clip();
  if (tile) { const pat = ctx.createPattern(tile, 'repeat'); if (pat) { ctx.fillStyle = pat; ctx.fillRect(r.x, r.y, r.w, r.h); } }
  else { ctx.fillStyle = '#3a2314'; ctx.fillRect(r.x, r.y, r.w, r.h); }
  const sh = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  sh.addColorStop(0, `rgba(10,6,16,${o.shadeTop ?? 0.4})`); sh.addColorStop(1, `rgba(6,3,8,${o.shadeBot ?? 0.62})`);
  ctx.fillStyle = sh; ctx.fillRect(r.x, r.y, r.w, r.h);
  if (o.tint) { ctx.fillStyle = o.tint; ctx.fillRect(r.x, r.y, r.w, r.h); }
  ctx.restore();
  // brass rim (outer light, inner shade) and a top highlight
  ctx.save();
  ctx.lineWidth = Math.max(2, Math.min(4, r.h * 0.04)); ctx.strokeStyle = brassGrad(ctx, r);
  rrect(ctx, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, rad); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(20,8,0,0.55)';
  rrect(ctx, { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: r.h - 8 }, Math.max(2, rad - 3)); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,236,190,0.22)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(r.x + rad, r.y + 6.5); ctx.lineTo(r.x + r.w - rad, r.y + 6.5); ctx.stroke();
  if (o.studs !== false && r.h > 60 && r.w > 120) {
    ctx.fillStyle = '#e8bd55';
    for (const [sx, sy] of [[r.x + 11, r.y + 11], [r.x + r.w - 11, r.y + 11], [r.x + 11, r.y + r.h - 11], [r.x + r.w - 11, r.y + r.h - 11]]) { ctx.beginPath(); ctx.arc(sx, sy, 3.2, 0, 6.2832); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(sx - 1, sy - 1, 1.1, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#e8bd55'; }
  }
  ctx.restore();
}
export { plaque };

// Buttons: lacquered crimson (primary), walnut plaques with a brass rim (the rest), pressed state sinks the face.
export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(22, r.h * 0.3), size = o.size ?? Math.min(34, r.h * 0.4);
  const dn = o.press ? 3 : 0;
  ctx.save();
  if (!o.noShadow) { ctx.fillStyle = 'rgba(0,0,0,0.38)'; rrect(ctx, { x: r.x + 1, y: r.y + 6, w: r.w - 2, h: r.h }, rad); ctx.fill(); }
  const face = { x: r.x, y: r.y + dn, w: r.w, h: r.h - dn };
  if (kind === 'primary' || kind === 'on' || kind === 'danger' || kind === 'gold') {
    const col = { primary: ['#e85a3a', '#b02a1c', '#7e150d'], on: ['#46b87a', '#2a8a58', '#17603b'], danger: ['#d9486a', '#b9304a', '#7c1a30'], gold: ['#ffe28a', '#f2c14e', '#b88a1c'] }[kind];
    const g = ctx.createLinearGradient(0, face.y, 0, face.y + face.h);
    g.addColorStop(0, col[0]); g.addColorStop(0.55, col[1]); g.addColorStop(1, col[2]);
    ctx.fillStyle = g; rrect(ctx, face, rad); ctx.fill();
    // lacquer sheen: a soft band across the upper third
    ctx.save(); rrect(ctx, face, rad); ctx.clip();
    const sg = ctx.createLinearGradient(0, face.y, 0, face.y + face.h * 0.5); sg.addColorStop(0, 'rgba(255,255,255,0.34)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.fillRect(face.x, face.y, face.w, face.h * 0.5);
    ctx.restore();
    ctx.lineWidth = Math.max(2, r.h * 0.03); ctx.strokeStyle = brassGrad(ctx, face); rrect(ctx, { x: face.x + 1, y: face.y + 1, w: face.w - 2, h: face.h - 2 }, rad); ctx.stroke();
  } else {
    plaque(ctx, face, rad, { studs: false, shadeTop: kind === 'disabled' ? 0.55 : 0.3, shadeBot: kind === 'disabled' ? 0.75 : 0.5, tint: kind === 'quiet' ? 'rgba(255,230,180,0.06)' : null });
  }
  if (o.press) { ctx.fillStyle = 'rgba(255,255,255,0.14)'; rrect(ctx, face, rad); ctx.fill(); }
  const dark = kind === 'gold';
  const col = kind === 'disabled' ? 'rgba(251,241,220,0.4)' : dark ? '#2a1d05' : kind === 'primary' || kind === 'on' || kind === 'danger' ? '#fff' : PAL.text;
  const hasSub = !!o.sub, pad = o.icon ? r.h * 0.9 : 14;
  if (o.icon) icon(ctx, o.icon, r.x + r.h * 0.5, face.y + face.h / 2, r.h * 0.42, col);
  const cx = r.x + (o.icon ? r.h * 0.9 + (r.w - r.h * 0.9) / 2 : r.w / 2);
  txt(ctx, label, cx, face.y + face.h * (hasSub ? 0.36 : 0.5), size, col, { align: 'center', weight: 700, maxW: r.w - pad - 14, stroke: kind === 'primary' ? 3 : 0, strokeColor: 'rgba(80,10,0,0.45)' });
  if (hasSub) txt(ctx, o.sub, cx, face.y + face.h * 0.72, size * 0.6, dark ? 'rgba(40,24,5,0.8)' : PAL.dim, { align: 'center', weight: 500, maxW: r.w - pad - 14 });
  ctx.restore();
}

export function panel(ctx, r, o = {}) {
  const rad = o.rad ?? 24;
  plaque(ctx, r, rad, { tint: o.tint ?? null, shadeTop: 0.5, shadeBot: 0.72, studs: o.studs });
}

// Icons: pause, back, play, plus, minus, restart, think, eye.
export function icon(ctx, name, cx, cy, s, col = PAL.text) {
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.5, s * 0.16); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (name === 'pause') { ctx.fillRect(cx - s * 0.5, cy - s * 0.6, s * 0.32, s * 1.2); ctx.fillRect(cx + s * 0.18, cy - s * 0.6, s * 0.32, s * 1.2); }
  else if (name === 'play') { ctx.beginPath(); ctx.moveTo(cx - s * 0.4, cy - s * 0.6); ctx.lineTo(cx + s * 0.6, cy); ctx.lineTo(cx - s * 0.4, cy + s * 0.6); ctx.closePath(); ctx.fill(); }
  else if (name === 'back') { ctx.beginPath(); ctx.moveTo(cx + s * 0.35, cy - s * 0.6); ctx.lineTo(cx - s * 0.35, cy); ctx.lineTo(cx + s * 0.35, cy + s * 0.6); ctx.stroke(); }
  else if (name === 'plus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.moveTo(cx, cy - s * 0.55); ctx.lineTo(cx, cy + s * 0.55); ctx.stroke(); }
  else if (name === 'minus') { ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx + s * 0.55, cy); ctx.stroke(); }
  else if (name === 'restart') { ctx.beginPath(); ctx.arc(cx, cy, s * 0.5, -0.4, Math.PI * 1.55); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + s * 0.55, cy - s * 0.55); ctx.lineTo(cx + s * 0.55, cy - s * 0.05); ctx.lineTo(cx + s * 0.05, cy - s * 0.15); ctx.stroke(); }
  else if (name === 'think') { ctx.beginPath(); ctx.arc(cx, cy - s * 0.15, s * 0.5, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - s * 0.22, cy + s * 0.5); ctx.lineTo(cx + s * 0.22, cy + s * 0.5); ctx.moveTo(cx - s * 0.16, cy + s * 0.75); ctx.lineTo(cx + s * 0.16, cy + s * 0.75); ctx.stroke(); }
  else if (name === 'eye') { ctx.beginPath(); ctx.moveTo(cx - s * 0.7, cy); ctx.quadraticCurveTo(cx, cy - s * 0.75, cx + s * 0.7, cy); ctx.quadraticCurveTo(cx, cy + s * 0.75, cx - s * 0.7, cy); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2); ctx.fill(); }
  else if (name === 'skip') { ctx.beginPath(); ctx.moveTo(cx - s * 0.5, cy - s * 0.55); ctx.lineTo(cx + s * 0.15, cy); ctx.lineTo(cx - s * 0.5, cy + s * 0.55); ctx.closePath(); ctx.fill(); ctx.fillRect(cx + s * 0.3, cy - s * 0.55, s * 0.2, s * 1.1); }
  ctx.restore();
}

// A rounded chip with text.
export function chip(ctx, x, y, label, size, o = {}) {
  ctx.font = `${o.weight ?? 700} ${Math.max(size, minUnits())}px ${UI}`;
  const w = ctx.measureText(label).width + size * 1.1, h = size * 1.7;
  const rx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  const dark = !o.fill || /rgba\(13,\s*24,\s*48/.test(o.fill);
  if (dark && o.fill) { plaque(ctx, { x: rx, y: y - h / 2, w, h }, h / 2, { studs: false, shadeTop: 0.35, shadeBot: 0.55 }); if (o.stroke) { ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = o.stroke; rrect(ctx, { x: rx + 5, y: y - h / 2 + 5, w: w - 10, h: h - 10 }, h / 2 - 4); ctx.stroke(); ctx.restore(); } }
  else {
    ctx.fillStyle = o.fill ?? 'rgba(255,240,220,0.12)'; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.fill();
    if (o.stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = o.stroke; rrect(ctx, { x: rx, y: y - h / 2, w, h }, h / 2); ctx.stroke(); }
  }
  txt(ctx, label, rx + w / 2, y + size * 0.02, size, o.color ?? PAL.text, { align: 'center', weight: o.weight ?? 700 });
  return { x: rx, y: y - h / 2, w, h };
}

export { PAL, UI, DISPLAY, rgba };

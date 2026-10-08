// Drawing primitives for Kintsugi: lacquer-and-gold theme, text with wrapping, flat buttons, small line icons.
export const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", "Songti SC", Georgia, "Times New Roman", serif';
export const C = {
  bg: '#0e0b0b', bg2: '#1b1514', panel: '#241c1a', panel2: '#2e2420', line: 'rgba(222,178,86,0.30)', lineHi: 'rgba(240,200,110,0.75)',
  gold: '#e3b24f', goldHi: '#ffe7a6', goldDeep: '#a9772a', text: '#f2e8d6', dim: '#b9a98f', faint: '#7d6f5d', red: '#d0604a', green: '#8fcf9a', ink: '#2a1c0c',
};
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

export function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function txt(ctx, s, x, y, o = {}) {
  const { size = 28, weight = 500, color = C.text, align = 'left', base = 'middle', maxW = 0, min = 12, serif = false, italic = false, shadow = 0 } = o;
  let sz = size;
  const font = () => `${italic ? 'italic ' : ''}${weight} ${sz}px ${serif ? SERIF : SANS}`;
  ctx.font = font();
  if (maxW) { let w = ctx.measureText(String(s)).width; while (w > maxW && sz > min) { sz -= 1; ctx.font = font(); w = ctx.measureText(String(s)).width; } }
  ctx.textAlign = align; ctx.textBaseline = base;
  if (shadow) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(String(s), x + shadow, y + shadow); }
  ctx.fillStyle = color; ctx.fillText(String(s), x, y);
  return sz;
}

export function wrapLines(ctx, text, maxW, size, weight = 400, serif = false) {
  ctx.font = `${weight} ${size}px ${serif ? SERIF : SANS}`;
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (line && ctx.measureText(t).width > maxW) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}
// Draws a wrapped paragraph; returns its height. draw=false only measures.
export function para(ctx, text, x, y, w, o = {}) {
  const { size = 28, weight = 400, color = C.text, lh = 1.34, serif = false, italic = false, align = 'left', draw = true } = o;
  const lines = wrapLines(ctx, text, w, size, weight, serif);
  if (draw) lines.forEach((l, i) => txt(ctx, l, align === 'center' ? x + w / 2 : x, y + size * lh * (i + 0.5), { size, weight, color, serif, italic, align }));
  return lines.length * size * lh;
}

export function panel(ctx, r, o = {}) {
  const { radius = 22, fill = C.panel, stroke = C.line, lw = 1.5 } = o;
  rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}

export function icon(ctx, name, cx, cy, s, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(2.2, s * 0.11); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const h = s / 2;
  if (name === 'back') { ctx.beginPath(); ctx.moveTo(cx + h * 0.35, cy - h * 0.75); ctx.lineTo(cx - h * 0.4, cy); ctx.lineTo(cx + h * 0.35, cy + h * 0.75); ctx.stroke(); }
  else if (name === 'pause') { ctx.fillRect(cx - h * 0.55, cy - h * 0.7, h * 0.38, h * 1.4); ctx.fillRect(cx + h * 0.17, cy - h * 0.7, h * 0.38, h * 1.4); }
  else if (name === 'play') { ctx.beginPath(); ctx.moveTo(cx - h * 0.45, cy - h * 0.7); ctx.lineTo(cx + h * 0.7, cy); ctx.lineTo(cx - h * 0.45, cy + h * 0.7); ctx.closePath(); ctx.fill(); }
  else if (name === 'hint') { ctx.beginPath(); ctx.arc(cx, cy - h * 0.15, h * 0.58, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - h * 0.28, cy + h * 0.62); ctx.lineTo(cx + h * 0.28, cy + h * 0.62); ctx.moveTo(cx - h * 0.2, cy + h * 0.9); ctx.lineTo(cx + h * 0.2, cy + h * 0.9); ctx.stroke(); }
  else if (name === 'eye') { ctx.beginPath(); ctx.moveTo(cx - h * 0.9, cy); ctx.quadraticCurveTo(cx, cy - h * 0.95, cx + h * 0.9, cy); ctx.quadraticCurveTo(cx, cy + h * 0.95, cx - h * 0.9, cy); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, h * 0.28, 0, 7); ctx.fill(); }
  else if (name === 'rotl' || name === 'rotr') {
    if (name === 'rotl') { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
    const r = h * 0.62, a1 = 0.55; ctx.beginPath(); ctx.arc(cx, cy, r, -2.7, a1); ctx.stroke();
    const ex = cx + Math.cos(a1) * r, ey = cy + Math.sin(a1) * r, tx = -Math.sin(a1), ty = Math.cos(a1), L = h * 0.5;
    ctx.beginPath(); ctx.moveTo(ex + (tx * 0.5 - ty * 0.85) * -L, ey + (ty * 0.5 + tx * 0.85) * -L); ctx.lineTo(ex, ey); ctx.lineTo(ex + (tx * 0.5 + ty * 0.85) * -L, ey + (ty * 0.5 - tx * 0.85) * -L); ctx.stroke();
  }
  else if (name === 'restart') { ctx.beginPath(); ctx.arc(cx, cy, h * 0.6, -1.2, 4.2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + h * 0.2, cy - h * 0.95); ctx.lineTo(cx + h * 0.62, cy - h * 0.55); ctx.lineTo(cx + h * 0.05, cy - h * 0.38); ctx.stroke(); }
  else if (name === 'think') { ctx.beginPath(); ctx.arc(cx, cy, h * 0.7, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx, cy - h * 0.4); ctx.lineTo(cx, cy); ctx.lineTo(cx + h * 0.3, cy + h * 0.22); ctx.stroke(); }
  ctx.restore();
}

// Flat button. kind: solid | gold | ghost. active draws a gold ring. flash: 0..1 brighten.
export function button(ctx, r, label, o = {}) {
  const { kind = 'solid', size = 28, active = false, disabled = false, flash = 0, ico = null, radius = 18, serif = false, sub = null } = o;
  ctx.save();
  if (disabled) ctx.globalAlpha = 0.4;
  rr(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.fillStyle = kind === 'gold' ? C.gold : kind === 'ghost' ? 'rgba(255,255,255,0.02)' : active ? '#3a2c1f' : '#2a211e';
  ctx.fill();
  if (flash > 0) { ctx.fillStyle = `rgba(255,236,180,${0.38 * flash})`; ctx.fill(); }
  ctx.lineWidth = active ? 2.6 : 1.5; ctx.strokeStyle = kind === 'gold' ? C.goldHi : active ? C.gold : C.line; ctx.stroke();
  const col = kind === 'gold' ? C.ink : active ? C.goldHi : C.text;
  const hasIco = ico && label, isz = Math.min(r.h * 0.46, size * 1.15);
  if (ico && !label) icon(ctx, ico, r.x + r.w / 2, r.y + r.h / 2, isz, col);
  else if (hasIco) { icon(ctx, ico, r.x + r.h * 0.5, r.y + r.h / 2, isz, col); txt(ctx, label, r.x + r.h * 0.9, r.y + r.h / 2, { size, weight: 600, color: col, maxW: r.w - r.h * 1.05, min: 12, serif }); }
  else if (sub) { txt(ctx, label, r.x + r.w / 2, r.y + r.h * 0.42, { size, weight: 600, color: col, align: 'center', maxW: r.w - 20, min: 12, serif }); txt(ctx, sub, r.x + r.w / 2, r.y + r.h * 0.74, { size: size * 0.62, weight: 400, color: kind === 'gold' ? 'rgba(42,28,12,0.75)' : C.dim, align: 'center', maxW: r.w - 20, min: 10 }); }
  else txt(ctx, label, r.x + r.w / 2, r.y + r.h / 2, { size, weight: 600, color: col, align: 'center', maxW: r.w - 20, min: 12, serif });
  ctx.restore();
}

export function stars(ctx, cx, cy, size, n, total = 3, on = C.gold, off = 'rgba(255,255,255,0.14)') {
  const gap = size * 1.15;
  for (let i = 0; i < total; i++) {
    const x = cx + (i - (total - 1) / 2) * gap; ctx.beginPath();
    for (let k = 0; k < 10; k++) { const r = k % 2 ? size * 0.22 : size * 0.5, a = -Math.PI / 2 + (k * Math.PI) / 5; ctx.lineTo(x + Math.cos(a) * r, cy + Math.sin(a) * r); }
    ctx.closePath(); ctx.fillStyle = i < n ? on : off; ctx.fill();
  }
}

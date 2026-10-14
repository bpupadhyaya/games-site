// Small drawing helpers for the interface: text, flat buttons, panels, stars. Pure canvas.
import { PAL, UI, DISPLAY, rgba } from './art.js';
import { host } from './layout.js';

export const minUnits = () => 11.5 / Math.max(0.2, host.px);          // text never goes below ~11 css px

export function txt(ctx, s, x, y, size, color = PAL.text, o = {}) {
  const fam = o.font ?? UI, wt = o.weight ?? 600;
  let sz = Math.max(size, minUnits());
  ctx.font = `${wt} ${sz}px ${fam}`;
  ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = o.base ?? 'middle';
  if (o.maxW && ctx.measureText(s).width > o.maxW) { sz = Math.max(sz * o.maxW / ctx.measureText(s).width, minUnits() * 0.9); ctx.font = `${wt} ${sz}px ${fam}`; }
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor ?? 'rgba(6,14,18,0.85)'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}

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

export const rrect = (ctx, r, rad) => { ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); };

// Premium chrome: lacquered / carved-wood plaques with a brass rim, a lit top edge and a pressed shadow. Pure canvas gradients.
const lerpC = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
function plaque(ctx, r, rad, top, bot, rim, press) {
  const dy = press ? 2 : 0;
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, top); g.addColorStop(1, bot);
  ctx.fillStyle = g; rrect(ctx, { x: r.x, y: r.y + dy, w: r.w, h: r.h }, rad); ctx.fill();
  // lit top edge and darker bottom lip (bevel, not a gloss shape)
  ctx.save(); rrect(ctx, { x: r.x, y: r.y + dy, w: r.w, h: r.h }, rad); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.42)'; ctx.lineWidth = 2.5; rrect(ctx, { x: r.x + 1.5, y: r.y + dy + 1.5, w: r.w - 3, h: r.h - 3 }, rad - 1); ctx.stroke();
  const sh = ctx.createLinearGradient(0, r.y + r.h - 12, 0, r.y + r.h); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = sh; ctx.fillRect(r.x, r.y + r.h - 12, r.w, 12);
  ctx.restore();
  if (rim) { ctx.strokeStyle = rim; ctx.lineWidth = 2.5; rrect(ctx, { x: r.x, y: r.y + dy, w: r.w, h: r.h }, rad); ctx.stroke(); }
}

// kind: primary (brass-gold lacquer), turq (tile-glaze), ghost (carved wood), quiet (dark walnut), on, danger, disabled
export function button(ctx, r, label, o = {}) {
  const kind = o.kind ?? 'ghost', rad = o.rad ?? Math.min(24, r.h * 0.3), size = o.size ?? Math.min(34, r.h * 0.42);
  ctx.save();
  if (!o.noShadow && kind !== 'disabled') { ctx.fillStyle = 'rgba(0,0,0,0.42)'; rrect(ctx, { x: r.x, y: r.y + 6, w: r.w, h: r.h }, rad); ctx.fill(); }
  let col = PAL.text, top = '#5a3a24', bot = '#33200f', rim = 'rgba(232,190,110,0.55)';
  if (kind === 'primary') { top = '#ffdc78'; bot = '#d9831c'; rim = '#7a4308'; col = '#2a1606'; }
  else if (kind === 'turq') { top = '#4fe6d3'; bot = '#14877a'; rim = '#0a4a43'; col = '#04231f'; }
  else if (kind === 'quiet') { top = '#4a3020'; bot = '#2a190d'; rim = 'rgba(210,160,90,0.45)'; }
  else if (kind === 'on') { top = '#1d7f74'; bot = '#0d4a44'; rim = PAL.turq; }
  else if (kind === 'danger') { top = '#7a2a30'; bot = '#4a1218'; rim = PAL.miss; }
  else if (kind === 'disabled') { top = '#2a2622'; bot = '#1c1916'; rim = null; col = 'rgba(255,255,255,0.3)'; }
  plaque(ctx, r, rad, top, bot, rim, false);
  if (kind === 'primary' || kind === 'turq') {                       // inlaid highlight line near the bottom, like a brass inlay
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(r.x + rad, r.y + r.h - 7); ctx.lineTo(r.x + r.w - rad, r.y + r.h - 7); ctx.stroke();
  }
  const cy = r.y + r.h / 2;
  if (o.sub) { txt(ctx, label, r.x + r.w / 2, cy - size * 0.28, size, col, { align: 'center', weight: 800, maxW: r.w - 28 }); txt(ctx, o.sub, r.x + r.w / 2, cy + size * 0.72, size * 0.58, kind === 'primary' || kind === 'turq' ? 'rgba(0,0,0,0.65)' : PAL.dim, { align: 'center', weight: 500, maxW: r.w - 28 }); }
  else txt(ctx, label, r.x + r.w / 2 + (o.icon ? size * 0.5 : 0), cy, size, col, { align: 'center', weight: 800, maxW: r.w - 28 - (o.icon ? size : 0) });
  if (o.icon === 'back') { ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; const ix = r.x + r.w / 2 - ctx.measureText(label).width / 2 - size * 0.6; ctx.beginPath(); ctx.moveTo(ix + 8, cy - 11); ctx.lineTo(ix, cy); ctx.lineTo(ix + 8, cy + 11); ctx.stroke(); }
  ctx.restore();
}

// A carved-wood / brass-edged slate panel.
export function panel(ctx, r, o = {}) {
  ctx.save();
  const rad = o.rad ?? 22;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrect(ctx, { x: r.x, y: r.y + 5, w: r.w, h: r.h }, rad); ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  if (o.fill) { g.addColorStop(0, o.fill); g.addColorStop(1, o.fill); } else { g.addColorStop(0, 'rgba(26,18,12,0.88)'); g.addColorStop(1, 'rgba(10,8,6,0.9)'); }
  ctx.fillStyle = g; rrect(ctx, r, rad); ctx.fill();
  ctx.strokeStyle = 'rgba(214,166,84,0.62)'; ctx.lineWidth = 2.5; rrect(ctx, r, rad); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,230,170,0.12)'; ctx.lineWidth = 1.5; rrect(ctx, { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: r.h - 8 }, Math.max(2, rad - 4)); ctx.stroke();
  ctx.restore();
}

// Embossed gold lettering: extrusion, vertical metal gradient, lit edge.
export function embossText(ctx, s, x, y, size, o = {}) {
  ctx.save();
  const sz = Math.max(size, minUnits()); ctx.font = `800 ${sz}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let k = 1; if (o.maxW) { const w = ctx.measureText(s).width; if (w > o.maxW) { k = o.maxW / w; ctx.font = `800 ${sz * k}px ${DISPLAY}`; } }
  const f = sz * k, d = Math.max(2, f * 0.06);
  ctx.lineJoin = 'round'; ctx.lineWidth = f * 0.16; ctx.strokeStyle = 'rgba(6,10,12,0.92)'; ctx.strokeText(s, x, y + d);
  ctx.fillStyle = o.deep ?? '#6a3a06'; for (let i = d; i > 0; i -= 1) ctx.fillText(s, x, y + i);
  const g = ctx.createLinearGradient(0, y - f * 0.5, 0, y + f * 0.5);
  const c = o.metal ?? ['#fff3b8', '#ffd25a', '#c9831a', '#ffdf86'];
  g.addColorStop(0, c[0]); g.addColorStop(0.45, c[1]); g.addColorStop(0.55, c[2]); g.addColorStop(1, c[3]);
  ctx.fillStyle = g; ctx.fillText(s, x, y);
  ctx.lineWidth = Math.max(1, f * 0.018); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.strokeText(s, x, y - 0.5);
  ctx.restore();
}

export function star(ctx, x, y, r, on, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.46 : r; i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath();
  if (on) { const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#ffe58a'); g.addColorStop(1, '#e8962a'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(80,40,0,0.7)'; ctx.lineWidth = r * 0.08; ctx.stroke(); }
  else { ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = r * 0.06; ctx.stroke(); }
  ctx.restore();
}

export const display = (size) => ({ font: DISPLAY, weight: 800, size });

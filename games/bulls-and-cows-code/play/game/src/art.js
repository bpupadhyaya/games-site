// The pieces: lit enamel pegs with engraved numerals, rail holes, clue pips (bulls and cows), brass lids. Drawing only.
import { theme, mix, rgba, UI } from './ui.js';

// One hue per digit; the numeral is always printed too, so colour is never the only clue.
export const PEG = [
  { c: '#dfe3ee', ink: '#2a3042' }, { c: '#e5484d', ink: '#ffffff' }, { c: '#f08a24', ink: '#2b1500' }, { c: '#f2c230', ink: '#2b2000' }, { c: '#93c83f', ink: '#16280a' },
  { c: '#2fae6a', ink: '#ffffff' }, { c: '#1fb5c9', ink: '#032a31' }, { c: '#3d7be0', ink: '#ffffff' }, { c: '#8a5cf0', ink: '#ffffff' }, { c: '#e0509f', ink: '#ffffff' },
];

// A rail hole: dark socket with a lit lower lip.
export function hole(ctx, cx, cy, d, { glow = 0, hot = false } = {}) {
  const T = theme(), r = d / 2;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.04, r * 1.06, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill();
  const g = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.28, r * 0.1, cx, cy, r);
  g.addColorStop(0, mix(T.hole, '#000000', 0.25)); g.addColorStop(0.8, T.hole); g.addColorStop(1, T.holeRim);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(1.5, d * 0.035); ctx.strokeStyle = hot ? T.accent : 'rgba(0,0,0,0.5)'; ctx.stroke();
  if (glow > 0) { ctx.beginPath(); ctx.arc(cx, cy, r + d * 0.05, 0, 7); ctx.lineWidth = d * 0.06; ctx.strokeStyle = rgba(T.accent, 0.5 * glow); ctx.stroke(); }
  ctx.restore();
}

// A peg. `lift` raises it (selected / hovering), `dim` fades it (unavailable key), `ghost` draws a see-through preview.
export function peg(ctx, cx, cy, d, digit, { lift = 0, dim = 0, ghost = false, shadow = true, scale = 1, ring = null, mark = 0 } = {}) {
  const P = PEG[digit] ?? PEG[0], r = (d / 2) * scale;
  if (r < 2) return;
  ctx.save();
  if (dim) ctx.globalAlpha = 1 - dim;
  if (ghost) ctx.globalAlpha *= 0.55;
  const up = lift * d * 0.07;
  if (shadow && !ghost) {
    ctx.beginPath(); ctx.ellipse(cx + r * 0.1, cy + r * 0.34 + up * 0.5, r * 0.98, r * 0.88, 0, 0, 7); ctx.fillStyle = `rgba(0,0,0,${0.3 - lift * 0.08})`; ctx.fill();
  }
  cy -= up;
  // body
  const g = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.46, r * 0.05, cx + r * 0.05, cy + r * 0.1, r * 1.12);
  g.addColorStop(0, mix(P.c, '#ffffff', 0.62)); g.addColorStop(0.28, mix(P.c, '#ffffff', 0.18)); g.addColorStop(0.62, P.c); g.addColorStop(1, mix(P.c, '#000000', 0.5));
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.06); ctx.strokeStyle = mix(P.c, '#000000', 0.55); ctx.stroke();
  // engraved face
  const fr = r * 0.62, fg = ctx.createLinearGradient(0, cy - fr, 0, cy + fr);
  fg.addColorStop(0, mix(P.c, '#000000', 0.2)); fg.addColorStop(1, mix(P.c, '#ffffff', 0.28));
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.02, fr, 0, 7); ctx.fillStyle = fg; ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.05); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(cx, cy + r * 0.02, fr + r * 0.04, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.font = `700 ${r * 1.08}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const ty = cy + r * 0.07;
  ctx.fillStyle = P.ink === '#ffffff' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.45)'; ctx.fillText(String(digit), cx, ty + r * 0.05);
  ctx.fillStyle = P.ink; ctx.fillText(String(digit), cx, ty);
  // specular
  ctx.beginPath(); ctx.ellipse(cx - r * 0.34, cy - r * 0.5, r * 0.3, r * 0.16, -0.7, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.93, Math.PI * 0.15, Math.PI * 0.75); ctx.lineWidth = r * 0.07; ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.stroke();
  if (ring) { ctx.beginPath(); ctx.arc(cx, cy, r + d * 0.05, 0, 7); ctx.lineWidth = Math.max(2.5, d * 0.06); ctx.strokeStyle = ring; ctx.stroke(); }
  if (mark) markGlyph(ctx, cx + r * 0.62, cy - r * 0.62, r * 0.46, mark);
  ctx.restore();
}

// Small corner mark on a key: 1 in (tick), 2 out (cross), 3 maybe (?).
export function markGlyph(ctx, x, y, s, kind) {
  const T = theme();
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fillStyle = kind === 1 ? T.good : kind === 2 ? T.err : '#7b8497'; ctx.fill();
  ctx.lineWidth = Math.max(2, s * 0.26); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  if (kind === 1) { ctx.moveTo(x - s * 0.45, y + s * 0.02); ctx.lineTo(x - s * 0.1, y + s * 0.38); ctx.lineTo(x + s * 0.5, y - s * 0.34); }
  else if (kind === 2) { ctx.moveTo(x - s * 0.4, y - s * 0.4); ctx.lineTo(x + s * 0.4, y + s * 0.4); ctx.moveTo(x + s * 0.4, y - s * 0.4); ctx.lineTo(x - s * 0.4, y + s * 0.4); }
  else { ctx.font = `700 ${s * 1.3}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('?', x, y + s * 0.06); ctx.restore(); return; }
  ctx.stroke(); ctx.restore();
}

// Bull: warm lit orb. Cow: teal ring around a dark centre. Empty: a faint dot. `pop` 0..1 scales the pip in.
export function pip(ctx, cx, cy, d, kind, pop = 1) {
  const T = theme(), r = d / 2 * (pop < 1 ? 0.2 + 0.8 * pop + Math.sin(pop * Math.PI) * 0.3 : 1);
  if (r < 1) return;
  ctx.save();
  if (kind === 'bull') {
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.45, 0, 7); ctx.fillStyle = rgba(T.bull, 0.18 * Math.min(1, pop)); ctx.fill();
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r);
    g.addColorStop(0, '#fff6cf'); g.addColorStop(0.35, T.bull); g.addColorStop(1, mix(T.bull, '#7a3a00', 0.6));
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.1); ctx.strokeStyle = mix(T.bull, '#3a1a00', 0.6); ctx.stroke();
  } else if (kind === 'cow') {
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.98, 0, 7); ctx.lineWidth = r * 0.42; ctx.strokeStyle = T.cow; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.98, Math.PI * 1.1, Math.PI * 1.7); ctx.lineWidth = r * 0.14; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.52, 0, 7); ctx.fillStyle = rgba(T.hole, 0.7); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.32, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
  }
  ctx.restore();
}

// Brass lid over a hidden peg; `open` 0..1 turns it edge-on and away.
export function lid(ctx, cx, cy, d, open = 0) {
  const T = theme(), r = d / 2, sx = Math.max(0.02, Math.cos(open * Math.PI / 2));
  if (open >= 0.999) return;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(sx, 1);
  ctx.beginPath(); ctx.arc(0, r * 0.1, r * 1.02, 0, 7); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  const g = ctx.createRadialGradient(-r * 0.4, -r * 0.5, r * 0.05, 0, 0, r * 1.1);
  g.addColorStop(0, mix(T.plate, '#ffffff', 0.7)); g.addColorStop(0.4, mix(T.plate, '#ffffff', 0.15)); g.addColorStop(0.8, T.plate); g.addColorStop(1, mix(T.plate, '#000000', 0.5));
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.06); ctx.strokeStyle = mix(T.plate, '#000000', 0.55); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.74, 0, 7); ctx.lineWidth = Math.max(1, r * 0.05); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.stroke();
  ctx.font = `700 ${r * 1.0}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillText('?', 0, r * 0.1); ctx.fillStyle = mix(T.plate, '#2a1a00', 0.7); ctx.fillText('?', 0, r * 0.05);
  ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.52, r * 0.28, r * 0.13, -0.7, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
  ctx.restore();
}

// Feedback cluster for a row: gold bulls then teal cows then faint dots, in up to two lines, plus "2B 1C" when there is room.
export function clue(ctx, r, fb, len, t = 99, { text = true } = {}) {
  const T = theme(), b = fb >> 3, c = fb & 7;
  const cols = len <= 3 ? len : Math.ceil(len / 2), rows = len <= 3 ? 1 : 2;
  const showText = text && r.w >= 138 && r.h >= 50;
  const pw = showText ? Math.min(r.w * 0.58, 140) : r.w, ps = Math.min(r.h / (rows === 2 ? 2.7 : 1.7), pw / (cols + 0.3), 30);
  const gx = ps * 1.12, x0 = r.x + (pw - (cols - 1) * gx) / 2, y0 = r.y + r.h / 2 - (rows - 1) * gx * 0.5;
  for (let i = 0; i < len; i++) {
    const kind = i < b ? 'bull' : i < b + c ? 'cow' : 'none', px = x0 + (i % cols) * gx, py = y0 + Math.floor(i / cols) * gx;
    const pop = kind === 'none' ? 1 : Math.min(1, Math.max(0, (t - 0.3 - i * 0.11) / 0.22));
    if (kind === 'none') { if (t > 0.3) pip(ctx, px, py, ps, 'none'); } else if (pop > 0) pip(ctx, px, py, ps, kind, pop);
  }
  if (showText && t > 0.3 + (b + c) * 0.11) {
    const fs = Math.min(r.h * 0.3, 26), tx = r.x + pw + (r.w - pw) / 2;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${fs}px ${UI}`;
    ctx.fillStyle = T.bull; ctx.fillText(`${b}B`, tx, r.y + r.h / 2 - fs * 0.55);
    ctx.fillStyle = T.cow; ctx.fillText(`${c}C`, tx, r.y + r.h / 2 + fs * 0.62);
    ctx.restore();
  }
}

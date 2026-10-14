// The stones: round, lit, with a carved rim. Digits in Cinzel, the traditional dot pattern, or Chinese numerals.
import { theme, NUM, CJK, mix, rgba, LOOKS } from './ui.js';
import { v3 } from './v3.js';

const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
export function chinese(v) {
  if (v <= 10) return CN[v];
  if (v < 20) return `十${CN[v - 10]}`;
  const t = Math.floor(v / 10), o = v % 10;
  return `${CN[t]}十${o ? CN[o] : ''}`;
}
// positions on a 3 x 3 lattice (0..8), drawn like the pips of the old river-diagram
const DOTS = [null, [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8], [0, 2, 3, 4, 5, 6, 8], [0, 1, 2, 3, 5, 6, 7, 8], [0, 1, 2, 3, 4, 5, 6, 7, 8]];

export function stoneLabel(ctx, v, cx, cy, r, ink, style, dotsOn = true) {
  const T = theme();
  if (style === 'dots' && v >= 1 && v <= 9) {
    // odd numbers: light dots (yang), even: dark dots (yin), as in the diagram; a ring behind keeps them legible
    const light = v % 2 === 1, col = light ? T.dotLight : T.dotDark, dr = r * 0.16, sp = r * 0.42;
    if (!light) { ctx.beginPath(); ctx.arc(cx, cy, r * 0.74, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill(); }
    for (const k of DOTS[v]) {
      const x = cx + ((k % 3) - 1) * sp, y = cy + (Math.floor(k / 3) - 1) * sp;
      ctx.beginPath(); ctx.arc(x, y, dr, 0, 7); ctx.fillStyle = col; ctx.fill();
      ctx.beginPath(); ctx.arc(x - dr * 0.25, y - dr * 0.3, dr * 0.35, 0, 7); ctx.fillStyle = rgba(light ? '#ffffff' : '#ffffff', light ? 0.7 : 0.25); ctx.fill();
    }
    return;
  }
  const s = style === 'chinese' ? chinese(v) : String(v);
  const long = s.length;
  const size = style === 'chinese' ? r * (long > 2 ? 0.82 : long > 1 ? 0.96 : 1.2) : r * (long > 1 ? 1.0 : 1.18);
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = style === 'chinese' ? `700 ${size}px ${CJK}` : `700 ${size}px ${NUM}`;
  const y = cy + size * (style === 'chinese' ? 0.04 : 0.06);
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillText(s, cx + r * 0.02, y + r * 0.045);
  ctx.fillStyle = ink; ctx.fillText(s, cx, y);
  ctx.restore();
}

// kind: 'stone' (player's) | 'given' (fixed lacquer). lift 0..1 raises it; glow lights the rim gold.
export function drawStone(ctx, cx, cy, r, v, { kind = 'stone', lift = 0, glow = 0, style = 'digits', alpha = 1, tint = null, flat = false } = {}) {
  const T = theme(), pal = kind === 'given' ? T.given : T.stone, ink = kind === 'given' ? T.givenInk : T.stoneInk;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const up = lift * r * 0.2, y = cy - up;
  const spr = v3.on && !flat && v3.sprites[Object.keys(LOOKS).find((k) => LOOKS[k] === T)]?.[kind];
  if (spr) {
    // pre-rendered 3D tablet (view3d/presenter.js): soft shadow, the lit body, then the engraved label squashed to the top face
    const f = r / 100, sw = 256 * f, base = y + 41 * f;
    ctx.beginPath(); ctx.ellipse(cx + r * 0.04, cy + r * 0.2 + up * 0.35, r * (0.98 + lift * 0.05), r * 0.62, 0, 0, 7); ctx.fillStyle = `rgba(0,0,0,${0.34 - lift * 0.08})`; ctx.fill();
    ctx.drawImage(spr, cx - sw / 2, base - sw / 2, sw, sw);
    if (tint) { ctx.beginPath(); ctx.ellipse(cx, y, r * 0.96, r * 0.74, 0, 0, 7); ctx.fillStyle = rgba(tint, 0.35); ctx.fill(); }
    if (glow > 0) { ctx.beginPath(); ctx.ellipse(cx, y + r * 0.06, r * 1.04, r * 0.82, 0, 0, 7); ctx.lineWidth = Math.max(2.5, r * 0.1); ctx.strokeStyle = rgba(T.sel, Math.min(1, glow)); ctx.stroke(); }
    ctx.save(); ctx.translate(cx, y); ctx.scale(1, 0.82); stoneLabel(ctx, v, 0, 0, r * 0.86, ink, style); ctx.restore();
    ctx.restore();
    return;
  }
  if (!flat) {
    ctx.beginPath(); ctx.ellipse(cx + r * 0.04, cy + r * 0.16 + up * 0.35, r * (0.98 + lift * 0.05), r * 0.86, 0, 0, 7);
    ctx.fillStyle = `rgba(0,0,0,${0.34 - lift * 0.08})`; ctx.fill();
  }
  // rim (the thickness of the stone)
  ctx.beginPath(); ctx.arc(cx, y + r * 0.06, r, 0, 7); ctx.fillStyle = pal[2]; ctx.fill();
  const g = ctx.createRadialGradient(cx - r * 0.34, y - r * 0.4, r * 0.08, cx, y, r * 1.05);
  g.addColorStop(0, tint ? mix(pal[0], tint, 0.5) : pal[0]); g.addColorStop(0.55, tint ? mix(pal[1], tint, 0.4) : pal[1]); g.addColorStop(1, pal[2]);
  ctx.beginPath(); ctx.arc(cx, y, r * 0.97, 0, 7); ctx.fillStyle = g; ctx.fill();
  // carved inner ring
  ctx.beginPath(); ctx.arc(cx, y, r * 0.78, 0, 7); ctx.lineWidth = Math.max(1.2, r * 0.045); ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, y + r * 0.02, r * 0.78, Math.PI * 0.15, Math.PI * 0.85); ctx.lineWidth = Math.max(1, r * 0.03); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.stroke();
  // gloss
  ctx.beginPath(); ctx.ellipse(cx - r * 0.2, y - r * 0.5, r * 0.46, r * 0.2, -0.45, 0, 7); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
  if (glow > 0) { ctx.beginPath(); ctx.arc(cx, y, r * 1.02, 0, 7); ctx.lineWidth = Math.max(2.5, r * 0.1); ctx.strokeStyle = rgba(T.sel, Math.min(1, glow)); ctx.stroke(); }
  stoneLabel(ctx, v, cx, y, r, ink, style);
  ctx.restore();
}

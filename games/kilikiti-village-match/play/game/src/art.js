// Drawing primitives and characters: lit sphere ball, figures, stumps and bin, particles, text styles.
// Pure functions of (ctx, params): no state, no randomness except a tiny hash for repeatable speckle.
import { W, H, clamp, lerp } from "./core.js";

export const FONT = "Georgia, 'Times New Roman', serif";
export const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const PAL = {
  gold: '#ffd36b', amber: '#ff9d3d', peach: '#ffb48a', coral: '#ff6b57', plum: '#0c3a46', ink: '#08222c', navy: '#13203a',
  cream: '#fff4dc', teal: '#2ec4b6', tealDark: '#0f6f6a', sky1: '#35609a', sky2: '#e58f6c', sky3: '#ffd98a',
  panel: 'rgba(6,30,40,0.8)', panelEdge: 'rgba(255,214,140,0.35)', white: '#ffffff', red: '#e24a3b', green: '#58c46a',
};

export const hash = (n) => { let h = (n | 0) * 374761393 + 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function rr(ctx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y); ctx.arcTo(x + w, y, x + w, y + h, k); ctx.arcTo(x + w, y + h, x, y + h, k); ctx.arcTo(x, y + h, x, y, k); ctx.arcTo(x, y, x + w, y, k); ctx.closePath();
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
export const mix = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};

export function vGrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

export function glow(ctx, x, y, r, color, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace('A', String(a)));
  g.addColorStop(1, color.replace('A', '0'));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function drawParticles(ctx, parts) {
  for (const p of parts) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = a;
    if (p.kind === 'ring') { ctx.strokeStyle = p.color; ctx.lineWidth = p.w * a + 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke(); }
    else if (p.kind === 'confetti') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); ctx.restore(); }
    else if (p.kind === 'flash') { const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.4, 'rgba(255,224,150,0.5)'); g.addColorStop(1, 'rgba(255,200,100,0)'); ctx.fillStyle = g; ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2); }
    else if (p.kind === 'grass') { ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.5, p.rot, 0, 7); ctx.fill(); }
    else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.4 + 0.6 * a), 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

export function textFill(ctx, text, x, y, size, opts = {}) {
  const { weight = 700, font = FONT, italic = false, color = PAL.cream, stroke = null, align = 'center', alpha = 1, shadow = true, grad = null, base = 'alphabetic' } = opts;
  ctx.save();
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${Math.round(size)}px ${font}`;
  ctx.textAlign = align; ctx.textBaseline = base; ctx.globalAlpha = alpha;
  if (shadow) { ctx.fillStyle = 'rgba(10,6,20,0.55)'; ctx.fillText(text, x + size * 0.04, y + size * 0.06); }
  if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.12; ctx.strokeStyle = stroke; ctx.strokeText(text, x, y); }
  if (grad) { const g = ctx.createLinearGradient(0, y - size, 0, y + size * 0.2); grad.forEach(([o, c]) => g.addColorStop(o, c)); ctx.fillStyle = g; } else ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(t).width > maxW) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}

export { W, H };

// The two gauges under the player's thumb: LEAN (how far back you are) and BALANCE (a bubble that drifts and must be steered home).
import { PAL, UI, clamp01, rgba } from './art.js';
import { txt, rrect } from './ui.js';

// A bamboo tube track: gold outer sleeve, dark inner groove (the part you read), brass end caps. Returns the inner rect.
function track(ctx, r) {
  const g = ctx.createLinearGradient(0, r.y - 4, 0, r.y + r.h + 4);
  g.addColorStop(0, '#fff0b0'); g.addColorStop(0.3, '#e0b455'); g.addColorStop(0.75, '#a77428'); g.addColorStop(1, '#6a4410');
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrect(ctx, { x: r.x, y: r.y + 4, w: r.w, h: r.h + 2 }, (r.h + 8) / 2); ctx.fill();
  ctx.fillStyle = g; rrect(ctx, { x: r.x - 3, y: r.y - 4, w: r.w + 6, h: r.h + 8 }, (r.h + 8) / 2); ctx.fill();
  const inner = { x: r.x, y: r.y, w: r.w, h: r.h };
  const ig = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  ig.addColorStop(0, '#0a0410'); ig.addColorStop(0.5, '#1c0e20'); ig.addColorStop(1, '#2c1630');
  ctx.fillStyle = ig; rrect(ctx, inner, r.h / 2); ctx.fill();
  return inner;
}
function gloss(ctx, r, rad, a = 0.28) {
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.48, `rgba(255,255,255,${a * 0.2})`); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = g; rrect(ctx, r, rad); ctx.fill();
}

// lean: current lean 0..1; target: where the finger asks for; need: the lean that gets under the bar (shown when `hint`).
export function drawLean(ctx, r, lean, o = {}) {
  ctx.save();
  const inner = track(ctx, r);
  // tick marks every 25%
  ctx.fillStyle = 'rgba(255,230,190,0.16)';
  for (let i = 1; i < 4; i++) ctx.fillRect(r.x + r.w * i / 4 - 1, r.y + r.h * 0.2, 2, r.h * 0.6);
  if (o.need !== undefined && o.hint) {
    const x0 = r.x + r.w * clamp01(o.need);
    ctx.fillStyle = 'rgba(127,255,224,0.30)'; rrect(ctx, { x: x0, y: r.y + 2, w: r.x + r.w - x0 - 2, h: r.h - 4 }, (r.h - 4) / 2); ctx.fill();
    ctx.fillStyle = '#7fffe0'; ctx.fillRect(x0 - 1.5, r.y - 6, 3, r.h + 12);
    txt(ctx, 'ENOUGH', Math.min(r.x + r.w - 6, x0 + (r.x + r.w - x0) / 2), r.y + r.h / 2, Math.max(14, r.h * 0.5), '#bffff0', { align: 'center', weight: 800, maxW: r.x + r.w - x0 - 10 });
  }
  const f = Math.max(0, Math.min(1, lean));
  if (f > 0.004) {
    const fr = { x: r.x + 3, y: r.y + 3, w: Math.max(r.h - 6, (r.w - 6) * f), h: r.h - 6 };
    const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
    g.addColorStop(0, '#18b7a6'); g.addColorStop(0.6, '#ffb347'); g.addColorStop(1, '#ff4d3d');
    ctx.fillStyle = g; rrect(ctx, fr, fr.h / 2); ctx.fill();
    gloss(ctx, fr, fr.h / 2, 0.36);
  }
  if (o.target !== undefined && o.target > 0.01) {
    const tx = r.x + 3 + (r.w - 6) * clamp01(o.target);
    ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(255,255,255,0.7)'; ctx.shadowBlur = 6; ctx.fillRect(tx - 1.5, r.y - 4, 3, r.h + 8); ctx.shadowBlur = 0;
  }
  ctx.restore();
  void inner;
}

// w: balance -1..1 (negative = tipping backward, positive = forward). Returns nothing; pure drawing.
export function drawBalance(ctx, r, w, o = {}) {
  ctx.save();
  track(ctx, r);
  const cx = r.x + r.w / 2, half = r.w / 2 - r.h * 0.5;
  // safe zone and danger ends
  const danger = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
  danger.addColorStop(0, 'rgba(255,90,90,0.65)'); danger.addColorStop(0.2, 'rgba(255,107,107,0.12)'); danger.addColorStop(0.5, 'rgba(127,227,176,0.38)');
  danger.addColorStop(0.8, 'rgba(255,107,107,0.12)'); danger.addColorStop(1, 'rgba(255,90,90,0.65)');
  const ir = { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: r.h - 6 };
  ctx.fillStyle = danger; rrect(ctx, ir, ir.h / 2); ctx.fill();
  gloss(ctx, ir, ir.h / 2, 0.16);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(cx - 1, r.y + 5, 2, r.h - 10);
  const v = Math.max(-1.1, Math.min(1.1, w));
  const bx = cx + v * half, by = r.y + r.h / 2, br = r.h * 0.66;
  const near = Math.abs(v);
  const col = near > 0.75 ? '#ff5a5a' : near > 0.45 ? '#ffb347' : '#6fe6b0';
  const glow = ctx.createRadialGradient(bx, by, 1, bx, by, br * 2.4);
  glow.addColorStop(0, rgba(col, 0.55)); glow.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = glow; ctx.fillRect(bx - br * 2.4, by - br * 2.4, br * 4.8, br * 4.8);
  // a glass bead: dark rim, body, soft core, bright specular
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(bx, by + br * 0.78, br * 0.8, br * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  const body = ctx.createRadialGradient(bx - br * 0.32, by - br * 0.4, br * 0.1, bx, by, br);
  body.addColorStop(0, '#ffffff'); body.addColorStop(0.28, col); body.addColorStop(0.85, rgba(col, 0.92)); body.addColorStop(1, 'rgba(10,30,30,0.9)');
  ctx.fillStyle = body; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(bx, by, br - 0.8, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(bx - br * 0.3, by - br * 0.42, br * 0.26, br * 0.14, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Small vector icons for the five commands, drawn on the 2D canvas. r = half size.
const TAU = Math.PI * 2;
function arrowHead(ctx, x, y, a, s) {
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a - 0.5) * s, y - Math.sin(a - 0.5) * s); ctx.lineTo(x - Math.cos(a + 0.5) * s, y - Math.sin(a + 0.5) * s); ctx.closePath(); ctx.fill();
}
export function drawCmdIcon(ctx, cmd, cx, cy, r, col) {
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(2.5, r * 0.2); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (cmd === 'comebye' || cmd === 'away') {
    const cw = cmd === 'comebye';
    // an arc round a small flock, with an arrow head
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.28, 0, TAU); ctx.fill();
    const a0 = cw ? -2.5 : -0.64, a1 = cw ? 0.7 : -3.84 + TAU;      // screen angles: clockwise on screen = increasing angle
    ctx.beginPath();
    if (cw) ctx.arc(cx, cy, r * 0.82, -2.6, 0.9, false); else ctx.arc(cx, cy, r * 0.82, -0.54, -4.04 + TAU, true);
    ctx.stroke();
    const ae = cw ? 0.9 : -4.04 + TAU, ex = cx + Math.cos(ae) * r * 0.82, ey = cy + Math.sin(ae) * r * 0.82;
    arrowHead(ctx, ex, ey, ae + (cw ? Math.PI / 2 : -Math.PI / 2), r * 0.46);
    void a0; void a1;
  } else if (cmd === 'walkon') {
    ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.8); ctx.lineTo(cx, cy - r * 0.55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - r * 0.55, cy - r * 0.1); ctx.lineTo(cx, cy - r * 0.75); ctx.lineTo(cx + r * 0.55, cy - r * 0.1); ctx.stroke();
  } else if (cmd === 'lie') {
    // a crouching body on the ground
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.25, r * 0.78, r * 0.3, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 0.72, cy + r * 0.1, r * 0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - r * 0.95, cy + r * 0.72); ctx.lineTo(cx + r * 0.95, cy + r * 0.72); ctx.stroke();
  } else {
    // stand: a raised palm / a stop bar
    ctx.beginPath(); ctx.roundRect(cx - r * 0.55, cy - r * 0.55, r * 1.1, r * 1.1, r * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - r * 0.25, cy + r * 0.2); ctx.lineTo(cx + r * 0.25, cy + r * 0.2); ctx.stroke();
  }
  ctx.restore();
}
export const CMD_LABEL = { comebye: 'Come bye', away: 'Away to me', walkon: 'Walk on', lie: 'Lie down', stand: 'Stand' };
export const CMD_ORDER = ['comebye', 'away', 'walkon', 'lie', 'stand'];
export const CMD_KEYS = { comebye: 'D', away: 'A', walkon: 'W', lie: 'S', stand: '␣' };

// Small illustrations for the "The Story & Its World" screen, drawn in the same lit shadow-puppet
// style. Each draws inside a 640 x 300 window whose top-left is (x, y).
import { TAU, INK, GOLD, light, rr, sea, lerp } from './stage.js';
import { figure, poses } from './puppets.js';

const CUT = 'rgba(255,205,130,0.92)';

function frame(ctx, x, y, w, h, glow, top, bottom) {
  ctx.save();
  rr(ctx, x, y, w, h, 22); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  light(ctx, x + w / 2, y + h * 0.7, 300, glow, 0.5);
}
function unframe(ctx, x, y, w, h) {
  ctx.restore();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 3.5; rr(ctx, x, y, w, h, 22); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,205,130,0.5)'; ctx.lineWidth = 1.4; rr(ctx, x + 8, y + 8, w - 16, h - 16, 16); ctx.stroke();
}

export function worldArt(ctx, art, x, y, t, rm = false) {
  const w = 640, h = 300, cx = x + w / 2, gy = y + h - 34;
  if (art === 'poet') {
    frame(ctx, x, y, w, h, '255,190,110', '#2a1a3c', '#8a3c2c');
    // a broad leafy tree
    ctx.fillStyle = '#120a10'; ctx.fillRect(x + 82, y + 40, 16, h);
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(x + 90 + Math.cos(i * 1.7) * 90, y + 44 + Math.sin(i * 2.3) * 24, 62, 30, i * 0.4, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,205,130,0.5)'; for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.arc(x + 20 + (i * 37) % 170, y + 30 + (i * 53) % 70, 2, 0, TAU); ctx.fill(); }
    // patterned mat
    ctx.fillStyle = '#1b0c12'; ctx.beginPath(); ctx.moveTo(cx - 190, gy + 4); ctx.lineTo(cx + 210, gy + 4); ctx.lineTo(cx + 250, gy + 34); ctx.lineTo(cx - 230, gy + 34); ctx.fill();
    ctx.fillStyle = 'rgba(232,96,110,0.5)'; ctx.fill();
    ctx.fillStyle = CUT; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(cx - 180 + i * 44, gy + 19); ctx.lineTo(cx - 172 + i * 44, gy + 12); ctx.lineTo(cx - 164 + i * 44, gy + 19); ctx.lineTo(cx - 172 + i * 44, gy + 26); ctx.fill(); }
    // the poet, seated, writing with a quill on a leaf manuscript
    figure(ctx, { x: cx - 10, y: gy + 4, s: 1.35, kind: 'hermit', pose: { ...poses.sit(t), shF: 1.25, elF: 1.1, lean: 0.12, head: 0.2 } });
    ctx.fillStyle = '#efdcae'; ctx.beginPath(); ctx.moveTo(cx + 44, gy - 10); ctx.lineTo(cx + 132, gy - 20); ctx.lineTo(cx + 140, gy - 2); ctx.lineTo(cx + 52, gy + 8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = 1.6; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx + 54 + i * 3, gy - 6 + i * 3 - i * 2); ctx.lineTo(cx + 128 + i * 2, gy - 15 + i * 3 - i * 2); ctx.stroke(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + 56, gy - 34); ctx.lineTo(cx + 40, gy - 6); ctx.stroke();
    ctx.fillStyle = '#efdcae'; ctx.beginPath(); ctx.moveTo(cx + 56, gy - 34); ctx.quadraticCurveTo(cx + 70, gy - 60, cx + 84, gy - 62); ctx.quadraticCurveTo(cx + 70, gy - 48, cx + 58, gy - 30); ctx.fill();
    light(ctx, cx + 100, gy - 12, 90, '255,220,150', 0.55);
    unframe(ctx, x, y, w, h);
  } else if (art === 'map') {
    frame(ctx, x, y, w, h, '255,200,130', '#20304a', '#6a4a3a');
    const pts = [[70, 70, 'janakpur'], [180, 106, 'ayodhya'], [260, 200, 'panchavati'], [330, 236, 'kishkindha'], [560, 254, 'lanka']];
    ctx.strokeStyle = 'rgba(255,214,130,0.85)'; ctx.lineWidth = 4; ctx.setLineDash([3, 12]); ctx.lineCap = 'round'; ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(x + p[0], y + p[1]) : ctx.moveTo(x + p[0], y + p[1]))); ctx.stroke(); ctx.setLineDash([]);
    sea(ctx, { y: y + 262, t, scroll: t * 30, colors: ['#3a3a7a', '#2a2a66', '#1c1c50', '#12123a', '#0a0a28'], crest: '255,200,150', bottom: y + h });
    for (const [px, py] of pts) { light(ctx, x + px, y + py, 30, '255,220,140', 0.8); ctx.fillStyle = GOLD; ctx.beginPath(); ctx.moveTo(x + px, y + py - 9); ctx.lineTo(x + px + 7, y + py); ctx.lineTo(x + px, y + py + 9); ctx.lineTo(x + px - 7, y + py); ctx.fill(); }
    unframe(ctx, x, y, w, h);
  } else if (art === 'bridge') {
    frame(ctx, x, y, w, h, '255,190,120', '#1a1c48', '#c8688a');
    sea(ctx, { y: y + 190, t, scroll: t * 40, colors: ['#4a4a88', '#34346c', '#22225a', '#161644', '#0c0c2c'], crest: '255,210,160', bottom: y + h });
    ctx.fillStyle = INK; for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.ellipse(x + 90 + i * 32, y + 196 + Math.sin(i) * 3, 18, 10, 0, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 70, y + 187); ctx.lineTo(x + 540, y + 187); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(x + 560, y + 196); ctx.lineTo(x + 580, y + 120); ctx.lineTo(x + 598, y + 108); ctx.lineTo(x + 620, y + 196); ctx.fill();
    ctx.fillStyle = CUT; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + 588 + i * 8, y + 150 + i * 14, 3, 0, TAU); ctx.fill(); }
    unframe(ctx, x, y, w, h);
  } else if (art === 'puppet') {
    frame(ctx, x, y, w, h, '255,200,120', '#3a2410', '#c47a34');
    light(ctx, cx, y + 200, 320, '255,210,140', 0.45);
    figure(ctx, { x: cx - 120, y: y + h - 22, s: 1.25, kind: "prince", prop: "bow", pose: poses.drawBow(t, 0.4, -0.05) });
    figure(ctx, { x: cx + 110, y: y + h - 22, s: 1.25, kind: "leaper_c", prop: "mace", pose: poses.walk(t, 3) });
    ctx.strokeStyle = 'rgba(30,14,8,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 108, y + h); ctx.lineTo(cx - 84, y + 150); ctx.moveTo(cx + 122, y + h); ctx.lineTo(cx + 100, y + 160); ctx.stroke();
    unframe(ctx, x, y, w, h);
  } else { // travel: a line of figures in different dress moving along one road
    frame(ctx, x, y, w, h, '255,190,120', '#1e1846', '#a4523c');
    const kinds = ['prince', 'princess', 'citizen', 'woman', 'king', 'vanara'];
    kinds.forEach((k, i) => figure(ctx, { x: x + 70 + i * 100, y: gy, s: 1.0, kind: k, pose: poses.walk(t + i * 0.7, 3.4), prop: k === 'prince' ? 'bow' : k === 'vanara' ? 'mace' : null }));
    unframe(ctx, x, y, w, h);
  }
}

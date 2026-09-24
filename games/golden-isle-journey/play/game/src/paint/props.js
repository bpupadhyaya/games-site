// Painted props: bow, mace, sword, spear, staff, lamps, ring, herb mountain, boulders.
import { TAU, sprite, blit, lin, rad, goldFill, pearl, gem, rosette, lighten, darken, rgba, mix } from './kit.js';
import { light } from '../stage.js';
import { relief } from './sculpt.js';

const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

const arrowSp = () => sprite('arrow', 130, 14, 4, 7, 2, (c) => {
  c.strokeStyle = '#4a2a14'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(0, 0); c.lineTo(104, 0); c.stroke();
  c.strokeStyle = '#d9a866'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -0.6); c.lineTo(104, -0.6); c.stroke();
  for (const d of [-1, 1]) { c.fillStyle = d < 0 ? '#c23a30' : '#efe6d4'; c.beginPath(); c.moveTo(2, 0); c.quadraticCurveTo(8, d * 7, 20, d * 5.4); c.lineTo(16, 0); c.fill(); }
  c.fillStyle = lin(c, 100, -6, 100, 6, [[0, '#fff4c8'], [0.5, '#e8b03a'], [1, '#8a5a12']]); c.beginPath(); c.moveTo(122, 0); c.lineTo(102, -6); c.quadraticCurveTo(106, 0, 102, 6); c.closePath(); c.fill();
  c.fillStyle = goldFill(c, 96, -3, 100, 3); c.fillRect(96, -3, 5, 6);
});

// Fire-tipped arrow: the same shaft with a cloth-wrapped head and a painted flame (layered teardrops, hot core).
const arrowFireSp = () => sprite('arrowF', 190, 60, 4, 30, 2, (c) => {
  c.strokeStyle = '#4a2a14'; c.lineWidth = 2.8; c.beginPath(); c.moveTo(0, 0); c.lineTo(112, 0); c.stroke();
  c.strokeStyle = '#d9a866'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -0.7); c.lineTo(112, -0.7); c.stroke();
  for (const d of [-1, 1]) { c.fillStyle = d < 0 ? '#c23a30' : '#efe6d4'; c.beginPath(); c.moveTo(2, 0); c.quadraticCurveTo(8, d * 7, 20, d * 5.4); c.lineTo(16, 0); c.fill(); }
  c.fillStyle = '#3a1a0c'; c.beginPath(); c.moveTo(100, -4); c.quadraticCurveTo(122, -9, 128, 0); c.quadraticCurveTo(122, 9, 100, 4); c.closePath(); c.fill();
  c.strokeStyle = '#f2c04e'; c.lineWidth = 1.4; for (const x of [106, 114, 122]) { c.beginPath(); c.moveTo(x, -6); c.lineTo(x + 1, 6); c.stroke(); }
  const flame = (len, wid, cols) => { const g = lin(c, 116, 0, 116 + len, 0, cols); c.fillStyle = g; c.beginPath(); c.moveTo(112, 0); c.bezierCurveTo(118, -wid, 116 + len * 0.6, -wid * 1.05, 116 + len, -2); c.bezierCurveTo(116 + len * 0.7, wid * 0.2, 118 + len * 0.5, wid * 1.05, 118, wid * 0.7); c.bezierCurveTo(112, wid * 0.5, 110, wid * 0.2, 112, 0); c.fill(); };
  flame(62, 17, [[0, '#a02010'], [0.4, '#e8501a'], [1, 'rgba(255,150,40,0.1)']]);
  flame(50, 12, [[0, '#f27a20'], [0.5, '#ffb030'], [1, 'rgba(255,220,100,0.1)']]);
  flame(34, 7, [[0, '#ffe08a'], [0.6, '#fff4c0'], [1, 'rgba(255,255,230,0.1)']]);
});

// A flying fire-tipped arrow with its tip at (x, y), pointing along angle a: flame, glow and a streaming ember trail.
export function fireArrow(ctx, { x, y, a = 0, s = 1, t = 0, trail = 1 }) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  if (trail > 0) {
    const g = ctx.createLinearGradient(-230 * s, 0, -30 * s, 0); g.addColorStop(0, 'rgba(255,120,40,0)'); g.addColorStop(1, `rgba(255,170,70,${0.5 * trail})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-230 * s, 0); ctx.lineTo(-30 * s, -9 * s); ctx.lineTo(-30 * s, 9 * s); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 7; i++) { const u = (i / 7 + t * 2.3) % 1; ctx.fillStyle = `rgba(255,${200 - u * 90},80,${(1 - u) * 0.8 * trail})`; ctx.beginPath(); ctx.arc(-40 * s - u * 190 * s, Math.sin(i * 5.3 + t * 9) * 9 * s, (3.6 - u * 2.4) * s, 0, TAU); ctx.fill(); }
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; light(ctx, 30 * s, 0, 64 * s * (0.85 + 0.15 * Math.sin(t * 30)), '255,150,50', 0.6); ctx.restore();
  ctx.scale(s, s); ctx.translate(-118, 0); blit(ctx, arrowFireSp());
  ctx.restore();
}

// The great mace: twisted-rope gold shaft, ringed collar, ribbed melon head set with a gem rosette, tiered finial.
// Drawn pointing DOWN from the grip at (0,0), in gold relief.
const maceSp = () => sprite('mace', 64, 156, 32, 24, 3, (c) => {
  const cy = 86, R = 21;
  relief(c, { mat: 'gold', inflate: 2.6, depth: 2.4, bump: 1.6, aoR: 2,
    paint(g) { g.fillStyle = '#d9a238'; g.fillRect(-2.7, -18, 5.4, 78); g.strokeStyle = '#8a5a14'; g.lineWidth = 0.9; for (let y = -20; y < 62; y += 3.2) { g.beginPath(); g.moveTo(-2.7, y); g.lineTo(2.7, y + 3.4); g.stroke(); }
      g.fillStyle = '#e2a93c'; g.beginPath(); g.ellipse(0, -19, 4.2, 3, 0, 0, TAU); g.fill(); for (const [y, w] of [[-12, 3.8], [6, 3.8], [54, 5.4], [58.5, 7.4], [63, 9.6]]) { g.beginPath(); g.ellipse(0, y, w, 2.1, 0, 0, TAU); g.fill(); } } });
  relief(c, { mat: 'silk', inflate: 2, depth: 1.6, heightFn: (x, y) => Math.sin(y * 2.2) * 0.3, paint(g) { g.fillStyle = '#b8202e'; g.fillRect(-3.3, -9, 6.6, 12); } });
  relief(c, { mat: 'gold', inflate: 15, depth: 15, bump: 1.2, aoR: 3,
    heightFn: (x, y) => { const v = (y - cy) / (R * 1.08), k = Math.sqrt(Math.max(0.02, 1 - v * v)), u = Math.max(-1, Math.min(1, x / (R * k))); return Math.abs(Math.cos(Math.asin(u) * 4.5)) * 2.2 * k; },
    paint(g) { g.fillStyle = '#e0a63a'; g.beginPath(); g.ellipse(0, cy, R, R * 1.08, 0, 0, TAU); g.fill();
      g.strokeStyle = '#9a6818'; g.lineWidth = 0.7; for (let i = -3; i <= 3; i++) { const a = (i + 0.5) / 4.5 * (Math.PI / 2) * 1.0; g.beginPath(); for (let q = -10; q <= 10; q++) { const v = q / 10, k = Math.sqrt(Math.max(0, 1 - v * v)); g[q === -10 ? 'moveTo' : 'lineTo'](Math.sin(a) * R * k, cy + v * R * 1.08); } g.stroke(); } } });
  relief(c, { mat: 'gold', inflate: 3, depth: 3, bump: 1.4, aoR: 2,
    paint(g) { g.fillStyle = '#e2a93c'; for (const [y, w, h] of [[cy + R * 1.06, 8.5, 2.6], [cy + R * 1.06 + 4.4, 6.4, 3.2], [cy + R * 1.06 + 9, 4.2, 2.6]]) { g.beginPath(); g.ellipse(0, y, w, h, 0, 0, TAU); g.fill(); } g.beginPath(); g.moveTo(-2.2, cy + R * 1.06 + 10); g.lineTo(0, cy + R * 1.06 + 21); g.lineTo(2.2, cy + R * 1.06 + 10); g.fill(); } });
  for (let i = 0; i < 9; i++) { const a = Math.PI * ((i + 0.5) / 9); pearl(c, Math.cos(a) * 11.4, 65.4 + Math.sin(a) * 2.2, 1.25); }
  rosette(c, 1.5, cy - 2, 5, '#d8283a', 8, true); pearl(c, 0, cy + R * 1.06 + 22, 1.5);
});
const swordSp = () => sprite('sword', 40, 100, 20, 14, 2, (c) => {
  c.fillStyle = '#5a2a14'; c.fillRect(-2.6, -12, 5.2, 18); c.fillStyle = goldFill(c, -3, 0, 3, 0); c.fillRect(-3, -12, 6, 2.4);
  c.fillStyle = goldFill(c, -11, 4, 11, 8); c.beginPath(); c.moveTo(-11, 5); c.quadraticCurveTo(0, 2, 11, 5); c.lineTo(10, 8); c.quadraticCurveTo(0, 5.5, -10, 8); c.fill(); gem(c, 0, 6.5, 1.6, '#d8283a');
  c.fillStyle = lin(c, -6, 0, 8, 0, [[0, '#8a96a2'], [0.45, '#f4f8fc'], [1, '#6a7480']]); c.beginPath(); c.moveTo(-3.4, 8); c.quadraticCurveTo(-4, 50, 6, 80); c.quadraticCurveTo(8.4, 46, 3.4, 8); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(30,40,50,0.5)'; c.lineWidth = 0.6; c.stroke();
});
const spearSp = (gold) => sprite('spear', 24, 190, 12, 60, 2, (c) => {
  c.fillStyle = lin(c, -3, 0, 3, 0, [[0, '#3a1c0c'], [0.5, '#8a5a30'], [1, '#2c1408']]); c.fillRect(-2.2, -60, 4.4, 178);
  c.fillStyle = goldFill(c, -3, 0, 3, 0); for (const y of [-56, 100]) c.fillRect(-3.4, y, 6.8, 5);
  c.fillStyle = lin(c, -6, 0, 6, 0, [[0, '#7a8692'], [0.5, '#f6faff'], [1, '#6a7480']]); c.beginPath(); c.moveTo(0, 168); c.quadraticCurveTo(-9, 140, -3, 118); c.lineTo(3, 118); c.quadraticCurveTo(9, 140, 0, 168); c.fill();
  c.fillStyle = '#c23a30'; c.beginPath(); c.moveTo(2.2, 116); c.quadraticCurveTo(12, 118, 8, 132); c.quadraticCurveTo(4, 124, 2.2, 122); c.fill();
  rosette(c, 0, 116, 3, '#d8283a', 5, false);
});
const staffSp = () => sprite('staff', 20, 170, 10, 60, 2, (c) => {
  c.fillStyle = lin(c, -3, 0, 3, 0, [[0, '#3a1c0c'], [0.5, '#9a6a3a'], [1, '#2c1408']]); c.beginPath(); c.moveTo(-2.4, -60); c.lineTo(2.4, -60); c.lineTo(3, 105); c.lineTo(-3, 105); c.fill();
  c.fillStyle = goldFill(c, -3, 0, 3, 0); for (const y of [-58, 50, 100]) c.fillRect(-3.6, y, 7.2, 3.4);
  c.strokeStyle = 'rgba(255,220,160,0.4)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(0.8, -56); c.lineTo(1.4, 100); c.stroke();
});
const lampBody = () => sprite('lampbody', 30, 24, 15, 10, 3, (c) => {
  c.fillStyle = lin(c, 0, -4, 0, 12, [[0, '#ffd870'], [0.5, '#c98a22'], [1, '#6a3a08']]);
  c.beginPath(); c.moveTo(-10, 0); c.quadraticCurveTo(-8, 10, 0, 11); c.quadraticCurveTo(8, 10, 10, 0); c.quadraticCurveTo(0, 3, -10, 0); c.fill();
  c.strokeStyle = 'rgba(80,40,4,0.8)'; c.lineWidth = 0.7; c.stroke();
  c.fillStyle = '#ffe9a0'; c.beginPath(); c.ellipse(0, -0.4, 8, 2, 0, 0, TAU); c.fill();
  c.fillStyle = goldFill(c, -3, 9, 3, 13); c.fillRect(-4, 10, 8, 2.6);
});
const mountSp = () => sprite('mountain', 260, 190, 130, 150, 1.5, (c) => {
  c.fillStyle = lin(c, 0, -140, 0, 24, [[0, '#8a7a90'], [0.5, '#5a4a60'], [1, '#2e2236']]);
  c.beginPath(); c.moveTo(-120, 8); c.lineTo(-74, -66); c.lineTo(-44, -46); c.lineTo(0, -132); c.lineTo(46, -56); c.lineTo(76, -84); c.lineTo(120, 8); c.quadraticCurveTo(0, 36, -120, 8); c.fill();
  c.fillStyle = 'rgba(255,220,190,0.22)'; c.beginPath(); c.moveTo(0, -132); c.lineTo(46, -56); c.lineTo(18, -40); c.lineTo(-4, -80); c.fill();
  c.strokeStyle = 'rgba(20,10,30,0.4)'; c.lineWidth = 1.4; for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(-90 + i * 30, 0); c.lineTo(-60 + i * 26, -60 - hash(i) * 40); c.stroke(); }
});

const boulderSp = (v) => sprite('rock' + v, 64, 56, 32, 28, 2, (c) => {
  const cols = [['#c8a878', '#8a6a48', '#3e2e22'], ['#b8a08a', '#7a6650', '#362a24'], ['#c4b08a', '#847052', '#3a2e22']][v % 3];
  c.beginPath(); for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, r = 25 * (0.86 + hash(i * 3 + v * 7) * 0.24); c.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.82); } c.closePath();
  c.fillStyle = rad(c, 0, 0, 2, 30, [[0, cols[0]], [0.55, cols[1]], [1, cols[2]]], -8, -9); c.fill();
  c.strokeStyle = 'rgba(20,10,6,0.55)'; c.lineWidth = 1; c.stroke();
  c.save(); c.clip(); c.strokeStyle = 'rgba(30,16,8,0.4)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-14, 6); c.lineTo(-4, 0); c.lineTo(4, 10); c.moveTo(6, -12); c.lineTo(14, -4); c.stroke();
  c.fillStyle = 'rgba(255,236,190,0.28)'; c.beginPath(); c.ellipse(-8, -10, 10, 5, -0.5, 0, TAU); c.fill(); c.restore();
});
export function boulder(ctx, x, y, r) {
  const s = boulderSp(Math.abs(Math.round(r + x * 0.07)) % 3);
  ctx.save(); ctx.translate(x, y); const k = r / 25; ctx.scale(k, k); blit(ctx, s); ctx.restore();
}

// ---- drawing a prop held at (fx,fy) in figure space ----
export function drawProp(ctx, kind, hand, back, P, gold) {
  const [fx, fy] = hand, [bx, by] = back;
  if (kind === 'bow' || kind === 'greatbow') {
    const big = kind === 'greatbow' ? 1.7 : 1, R = 72 * big, aim = P.aim ?? 0, bend = P.bend ?? 0, spread = 1.0 + bend * 0.35;
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(aim); ctx.translate(-R * (1 - Math.cos(spread)), 0);
    const cx = -R * Math.cos(spread), tipX = cx + R * Math.cos(spread), tipY = R * Math.sin(spread), w = 6.4 * Math.sqrt(big);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2a0c08'; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.arc(cx, 0, R, -spread, spread); ctx.stroke();
    ctx.strokeStyle = '#8a2a1c'; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(cx, 0, R, -spread, spread); ctx.stroke();
    ctx.strokeStyle = '#d05a34'; ctx.lineWidth = w * 0.45; ctx.beginPath(); ctx.arc(cx, 0, R - w * 0.15, -spread + 0.05, spread - 0.05); ctx.stroke();
    ctx.strokeStyle = '#ffe2a0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, 0, R - w * 0.35, -spread * 0.9, -spread * 0.2); ctx.stroke();
    // gold-wrapped grip and tip caps
    ctx.strokeStyle = '#f2c04e'; ctx.lineWidth = w + 1.4; ctx.beginPath(); ctx.arc(cx, 0, R, -0.2, 0.2); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,70,10,0.8)'; ctx.lineWidth = 0.8; for (let i = -2; i <= 2; i++) { const a = i * 0.075; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R - 4), Math.sin(a) * (R - 4)); ctx.lineTo(cx + Math.cos(a) * (R + 4), Math.sin(a) * (R + 4)); ctx.stroke(); }
    for (const d of [-1, 1]) { ctx.fillStyle = '#f2c04e'; ctx.beginPath(); ctx.arc(tipX, d * tipY, w * 0.62, 0, TAU); ctx.fill(); }
    if (P.string !== false) {
      const pull = P.pull ?? 0, ax = tipX - pull * 62 * big;
      ctx.strokeStyle = 'rgba(255,238,200,0.95)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(tipX, -tipY); ctx.lineTo(ax, 0); ctx.lineTo(tipX, tipY); ctx.stroke();
      if (P.arrow) {
        ctx.save(); ctx.translate(ax, 0);
        if (P.fireArrow) { const fl = 0.8 + 0.2 * Math.sin((P.t ?? 0) * 17); ctx.save(); ctx.globalCompositeOperation = 'lighter'; light(ctx, 132, -2, 70 * fl, '255,150,50', 0.6); ctx.restore(); blit(ctx, arrowFireSp()); }
        else blit(ctx, arrowSp());
        ctx.restore();
      }
    }
    ctx.restore();
  } else if (kind === 'mace') {
    const a = P.propA ?? 2.6; // sprite points +y (down); direction (sin a, cos a) => rotate(-a)
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(-a); blit(ctx, maceSp()); ctx.restore();
  } else if (kind === 'sword') {
    const a = P.propA ?? 2.3; ctx.save(); ctx.translate(fx, fy); ctx.rotate(-a + 0.12); blit(ctx, swordSp()); ctx.restore();
  } else if (kind === 'spear' || kind === 'staff') {
    const a = P.propA ?? 3.0; ctx.save(); ctx.translate(fx, fy); ctx.rotate(-a); blit(ctx, kind === 'spear' ? spearSp() : staffSp()); ctx.restore();
  } else if (kind === 'lantern' || kind === 'lamp') {
    const ly = fy + (kind === 'lantern' ? 30 : -4);
    if (kind === 'lantern') { ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, ly - 10); ctx.stroke(); }
    light(ctx, fx, ly - 4, kind === 'lantern' ? 74 : 62, '255,200,110', 0.8);
    ctx.save(); ctx.translate(fx, ly); blit(ctx, lampBody()); ctx.restore();
    ctx.fillStyle = 'rgba(255,240,180,1)'; ctx.beginPath(); ctx.ellipse(fx, ly - 6, 2.6, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,170,60,0.9)'; ctx.beginPath(); ctx.ellipse(fx, ly - 3, 3.6, 3.4, 0, 0, TAU); ctx.fill();
  } else if (kind === 'stone') {
    const mx = (fx + bx) / 2, my = Math.min(fy, by) - 20; boulder(ctx, mx, my, 30);
  } else if (kind === 'ring') {
    light(ctx, fx + 6, fy, 44, '255,220,130', 0.9);
    ctx.strokeStyle = '#e8b030'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(fx + 6, fy, 6, 0, TAU); ctx.stroke(); gem(ctx, fx + 6, fy - 6.5, 2.4, '#d8283a');
  } else if (kind === 'mountain') {
    const mx = fx, my = fy - 8; ctx.save(); ctx.translate(mx, my); blit(ctx, mountSp()); ctx.restore();
    for (let i = 0; i < 7; i++) { const px = mx - 80 + i * 27, py = my - 22 - hash(i) * 50; light(ctx, px, py, 26, '170,255,170', 0.7); ctx.fillStyle = '#d8ffd0'; ctx.beginPath(); ctx.arc(px, py, 2.6, 0, TAU); ctx.fill(); }
  }
}

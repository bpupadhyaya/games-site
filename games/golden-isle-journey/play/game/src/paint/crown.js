// Crowns in gold relief: a band of pearls, a diadem of pointed gem-set plates over a velvet cap, stacked ribbed
// dome tiers and a finial. Variants: tall (heroes, kings), spiked (the ten-crowned king), tiara (princess).
import { TAU, lin, rad, pearl, gem, darken, lighten, rgba } from './kit.js';
import { relief } from './sculpt.js';

const GOLD = '#e2a93c', GOLD_D = '#a8741c', GOLD_L = '#f6d478';
export const GEMS = { ruby: '#d8283a', emerald: '#1fa872', sapphire: '#3a6fd0' };

// o = { cx, base, w, tiers (dome tiers 0..3), gems:[...], tilt, tassel, spikes, velvet, scale, plates }
export function goldCrown(ctx, o) {
  const w = o.w ?? 14, tiers = o.tiers ?? 3, gems = o.gems ?? [GEMS.ruby, GEMS.emerald, GEMS.ruby], velvet = o.velvet ?? '#6a2a7a', sp = !!o.spikes, k = o.scale ?? 1;
  const nP = o.plates ?? 5, plateH = (i) => (sp ? 17 - Math.abs(i) * 2.2 : 13.5 - Math.abs(i) * 2.6) * (o.plateK ?? 1);
  const px = (i) => i * w * (1.9 / nP), domes = [];
  let y = -(o.capH ?? 12.5) + 1, rx = w * 0.84;
  for (let t = 0; t < tiers; t++) { const ry = 5.8 - t * 0.9; domes.push({ y: y - ry * 0.55, rx, ry }); y -= ry * 1.36; rx *= 0.72; }
  const topY = y;
  ctx.save(); ctx.translate(o.cx ?? 0, o.base ?? 0); ctx.rotate(o.tilt ?? 0); ctx.scale(k, k);
  const plate = (c, i, grow = 0) => { const x = px(i), h = plateH(i) + grow, hw = w * (1.05 / nP) + grow * 0.5; c.beginPath(); c.moveTo(x - hw, -2); c.bezierCurveTo(x - hw * 1.15, -h * 0.55, x - hw * 0.35, -h * 0.8, x, -h - (sp ? 3 : 0)); c.bezierCurveTo(x + hw * 0.35, -h * 0.8, x + hw * 1.15, -h * 0.55, x + hw, -2); c.closePath(); };
  if (o.fan) relief(ctx, { mat: 'gold', inflate: 1.6, depth: 1.4, bump: 1.4, aoR: 2, // grand fan crest: a sunburst of gold leaves behind the domes, tipped with pearls
    paint(c) { const n = 13, R = w * 1.75, cy = -6; for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) { const a = -Math.PI * (0.06 + 0.88 * i / (n - 1)), r = R * (pass ? 0.78 : 1) * (0.9 + 0.1 * Math.sin(i / (n - 1) * Math.PI)), x = Math.cos(a) * r, y = cy + Math.sin(a) * r, bx = Math.cos(a) * w * 0.7, by = cy + Math.sin(a) * w * 0.5, nx = -Math.sin(a) * w * 0.17, ny = Math.cos(a) * w * 0.17;
      c.fillStyle = pass ? GOLD_L : GOLD; c.beginPath(); c.moveTo(bx - nx, by - ny); c.quadraticCurveTo((bx + x) / 2 - nx * 2.1, (by + y) / 2 - ny * 2.1, x, y); c.quadraticCurveTo((bx + x) / 2 + nx * 2.1, (by + y) / 2 + ny * 2.1, bx + nx, by + ny); c.closePath(); c.fill(); c.strokeStyle = GOLD_D; c.lineWidth = 0.35; c.stroke(); } },
    over(g) { const n = 13, R = w * 1.75, cy = -6; for (let i = 0; i < n; i++) { const a = -Math.PI * (0.06 + 0.88 * i / (n - 1)), r = R * (0.9 + 0.1 * Math.sin(i / (n - 1) * Math.PI)); pearl(g, Math.cos(a) * (r + 0.6), cy + Math.sin(a) * (r + 0.6), 0.8); if (i % 2 === 0) gem(g, Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, 0.9, i % 4 ? '#d8283a' : '#1fa872'); } } });
  // velvet cap behind the plates
  if (tiers > 0 || o.cap) relief(ctx, { mat: 'cloth', inflate: 5, depth: 4, paint(c) { c.fillStyle = lin(c, -w, 0, w, 0, [[0, darken(velvet, 0.4)], [0.6, velvet], [1, lighten(velvet, 0.15)]]); c.beginPath(); c.moveTo(-w * 0.94, -1); c.bezierCurveTo(-w * 0.98, -(o.capH ?? 12.5) * 1.2, w * 0.98, -(o.capH ?? 12.5) * 1.2, w * 0.94, -1); c.closePath(); c.fill(); } });
  relief(ctx, {
    mat: 'gold', inflate: 1.8, depth: 1.5, bump: 1.6, aoR: 2,
    blobs: [{ cap: [-w, 0, 3, w, 0, 3], z: 2.4 }, ...domes.map((d) => ({ x: 0, y: d.y, rx: d.rx * 1.05, ry: d.ry * 1.25, z: 4.5 })), ...Array.from({ length: nP }, (_, j) => ({ x: px(j - (nP - 1) / 2), y: -plateH(j - (nP - 1) / 2) * 0.5, rx: w * 0.24, ry: plateH(j - (nP - 1) / 2) * 0.6, z: 1.6 }))],
    paint(c) {
      // dome tiers (back to front = top to bottom)
      for (let t = domes.length - 1; t >= 0; t--) { const d = domes[t]; c.fillStyle = GOLD; c.beginPath(); c.ellipse(0, d.y, d.rx, d.ry, 0, 0, TAU); c.fill();
        c.strokeStyle = GOLD_D; c.lineWidth = 0.5; for (let i = -4; i <= 4; i++) { c.beginPath(); c.moveTo(i * d.rx * 0.2, d.y - d.ry * 0.9); c.quadraticCurveTo(i * d.rx * 0.27, d.y, i * d.rx * 0.2, d.y + d.ry * 0.9); c.stroke(); }
        c.fillStyle = GOLD_L; for (let i = -5; i <= 5; i++) { c.beginPath(); c.arc(i * d.rx * 0.185, d.y + d.ry * 0.86 - Math.abs(i) * 0.12, 0.62, 0, TAU); c.fill(); } }
      if (tiers > 0) { c.fillStyle = GOLD; c.beginPath(); c.moveTo(-1.6, topY + 2.6); c.quadraticCurveTo(-3.4, topY - 1.4, 0, topY - 4.4); c.quadraticCurveTo(3.4, topY - 1.4, 1.6, topY + 2.6); c.closePath(); c.fill(); c.beginPath(); c.moveTo(-0.9, topY - 3.6); c.lineTo(0, topY - 9.6); c.lineTo(0.9, topY - 3.6); c.fill(); }
      // plates: outer ones first so the centre overlaps
      const order = Array.from({ length: nP }, (_, j) => j - (nP - 1) / 2).sort((a, b) => Math.abs(b) - Math.abs(a));
      for (const i of order) {
        plate(c, i); c.fillStyle = GOLD; c.fill(); c.strokeStyle = GOLD_D; c.lineWidth = 0.45; c.stroke();
        const x = px(i), h = plateH(i); c.fillStyle = '#9a1c2c'; c.beginPath(); c.moveTo(x, -h * 0.84); c.quadraticCurveTo(x + w * 0.13, -h * 0.48, x, -h * 0.2); c.quadraticCurveTo(x - w * 0.13, -h * 0.48, x, -h * 0.84); c.fill();
        c.fillStyle = GOLD_L; for (let q = 0; q < 7; q++) { const u = q / 6, a = Math.PI * (1 - u), rr = w * (0.98 / nP); c.beginPath(); c.arc(x + Math.cos(a) * rr * (0.95 - 0.25 * Math.sin(a)), -2.4 - Math.sin(a) * (h * 0.78), 0.5, 0, TAU); c.fill(); }
      }
      // brow band
      c.fillStyle = GOLD; c.beginPath(); c.moveTo(-w - 0.8, 1.8); c.quadraticCurveTo(0, 4.4, w + 0.8, 1.8); c.lineTo(w + 0.5, -3); c.quadraticCurveTo(0, -0.6, -w - 0.5, -3); c.closePath(); c.fill();
      c.strokeStyle = GOLD_D; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-w, -1.4); c.quadraticCurveTo(0, 1, w, -1.4); c.stroke();
    },
    over(g) {
      for (let i = -(nP - 1) / 2; i <= (nP - 1) / 2; i++) { const x = px(i), h = plateH(i); gem(g, x, -h * 0.5, Math.max(1, w * (i === 0 ? 0.13 : 0.1)), gems[Math.abs(Math.round(i)) % gems.length]); if (!sp) pearl(g, x, -h - 0.6, 0.85); }
      const nb = Math.round(w * 0.95); for (let i = 0; i < nb; i++) { const u = (i + 0.5) / nb, x = -w + u * w * 2, yy = 0.2 + Math.sin(u * Math.PI) * 2.3; i % 3 === 1 ? gem(g, x, yy, 0.95, gems[(i >> 1) % gems.length]) : pearl(g, x, yy, 0.85); }
      domes.forEach((d, t) => gem(g, 0, d.y + 0.4, 1.5 - t * 0.25, gems[(t + 1) % gems.length]));
      if (tiers > 0) pearl(g, 0, topY - 10.2, 1.05);
      if (o.fringe) for (let i = 0; i < 13; i++) { const u = (i + 0.5) / 13, x = -w * 0.35 + u * w * 1.3, yy = 2.5 + Math.sin((x / w + 1) * Math.PI / 2) * 2.0; pearl(g, x, yy + 0.7, 0.5); if (i % 2 === 0) pearl(g, x, yy + 1.7, 0.42); }
      if (o.drops !== false) for (let i = 0; i < 7; i++) { const u = (i + 0.5) / 7, x = -w * 0.2 + u * w * 1.15, yy = 2.6 + Math.sin((x / w + 1) * Math.PI / 2) * 2.0; g.strokeStyle = 'rgba(240,200,110,0.9)'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(x, yy); g.lineTo(x, yy + 1.6); g.stroke(); pearl(g, x, yy + 2.2, 0.6); }
    },
  });
  if (o.tassel) { // strings of pearls with a silk tuft, hanging behind the temple
    const x = -w * 0.86;
    for (let i = 0; i < 9; i++) { pearl(ctx, x - 0.9 + Math.sin(i * 0.5) * 0.3, 3 + i * 1.9, 0.9); pearl(ctx, x + 1.1 + Math.sin(i * 0.5 + 1) * 0.3, 3.6 + i * 1.9, 0.8); }
    ctx.fillStyle = lin(ctx, x - 2, 0, x + 2, 0, [[0, '#f6d478'], [1, '#a8741c']]); ctx.beginPath(); ctx.ellipse(x, 21.4, 1.9, 1.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = lin(ctx, x - 2, 22, x + 2, 28, [[0, '#d8283a'], [1, '#7a1020']]); ctx.beginPath(); ctx.moveTo(x - 1.6, 22.4); ctx.lineTo(x + 1.6, 22.4); ctx.lineTo(x + 2.2, 28.4); ctx.lineTo(x - 2.2, 28.4); ctx.fill();
  }
  ctx.restore();
}

// The two pieces: a realistic hare's head and a realistic hound's head, painted once (fur and all) into sprites and
// reused for every piece on the board. Reference space: 50 units = the base radius; origin at the middle of the head.
// Light: upper left. Both are painted as real animals, never masks: a solid skull under the fur, no outline drawn
// around the whole head (the fur is the silhouette), eyes set into shadowed sockets, whiskers and nose with depth.
const TAU = Math.PI * 2;
const BOX = { x: -68, y: -96, w: 136, h: 168 }, SPRITE_SCALE = 4;

function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function soft(ctx, x, y, rx, ry, rgb, a, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.55, `rgba(${rgb},${a * 0.8})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill(); ctx.restore();
}
// Many short strokes: what makes it read as fur and not plastic.
function fur(ctx, rnd, n, box, inside, angle, color, len, width) {
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = box[0] + rnd() * (box[2] - box[0]), y = box[1] + rnd() * (box[3] - box[1]);
    if (!inside(x, y)) continue;
    const a = angle(x, y) + (rnd() - 0.5) * 0.5, l = len * (0.6 + rnd() * 0.8);
    ctx.strokeStyle = color(x, y, rnd()); ctx.lineWidth = width * (0.6 + rnd() * 0.8);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
}
const ell = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); };

// Outlines are point lists, smoothed through their midpoints, so the same list can also be walked to grow fur over the edge:
// the fur, not a drawn line, is the silhouette (the lesson of the tiger's "mask" in the sister game).
const mirror = (half) => half.concat(half.slice(1, -1).reverse().map(([x, y]) => [-x, y]));
function smooth(ctx, pts) {
  const n = pts.length, m = (i) => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
  ctx.beginPath(); const s0 = m(n - 1); ctx.moveTo(s0[0], s0[1]);
  for (let i = 0; i < n; i++) { const e = m(i); ctx.quadraticCurveTo(pts[i][0], pts[i][1], e[0], e[1]); }
  ctx.closePath();
}
// strokes that start just inside the outline and lean out of it
function edgeFur(ctx, rnd, pts, cx, cy, per, color, len, width, lean = 0) {
  ctx.lineCap = 'round';
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    for (let k = 0; k < per; k++) {
      const t = rnd(), x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      const out = Math.atan2(y - cy, x - cx) + (rnd() - 0.5) * 0.7 + lean, l = len * (0.5 + rnd() * 0.9);
      ctx.strokeStyle = color(x, y, rnd()); ctx.lineWidth = width * (0.6 + rnd() * 0.7);
      ctx.beginPath(); ctx.moveTo(x - Math.cos(out) * 2.2, y - Math.sin(out) * 2.2); ctx.lineTo(x + Math.cos(out) * l, y + Math.sin(out) * l); ctx.stroke();
    }
  }
}
const insidePts = (pts) => (x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };

// ---------------------------------------------------------------------------------------------
// Hare: a European brown hare from the front. Tall ears with black tips, amber eyes in dark-rimmed sockets, a cream
// jaw and throat, a tawny black-flecked face, a split lip and long whiskers.
// ---------------------------------------------------------------------------------------------
const HARE = mirror([[0, -38], [9, -37], [17, -32], [22, -22], [25, -10], [28, 2], [31, 13], [29, 23], [23, 31], [14, 37], [6, 40], [0, 41]]);
const HARE_EAR = (sx) => [[3, -30], [5, -46], [10, -64], [16, -80], [23, -92], [30, -84], [34, -68], [34, -52], [31, -38], [25, -29], [13, -26]].map(([x, y]) => [x * sx, y]);
function paintHare(ctx) {
  const rnd = lcg(4242), inHare = insidePts(HARE);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // ears: long leaves behind the head; cream, veined inside; a black tip; fur creeping over the edge
  for (const sx of [-1, 1]) {
    const E = HARE_EAR(sx), inE = insidePts(E);
    smooth(ctx, E);
    const g = ctx.createLinearGradient(sx * 8, -30, sx * 30, -92); g.addColorStop(0, '#b07b46'); g.addColorStop(0.65, '#8a5a2e'); g.addColorStop(1, '#3e2614');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); smooth(ctx, E); ctx.clip();
    const I = E.map(([x, y]) => [sx * 19.5 + (x - sx * 19.5) * 0.5, -60 + (y + 60) * 0.86]);      // the inner ear: the same leaf, narrower
    smooth(ctx, I); const ig = ctx.createLinearGradient(0, -30, 0, -90); ig.addColorStop(0, '#dfbf9a'); ig.addColorStop(0.55, '#e6c6a6'); ig.addColorStop(1, '#bf9474'); ctx.fillStyle = ig; ctx.fill();
    ctx.strokeStyle = 'rgba(176,104,98,0.32)'; ctx.lineWidth = 0.9;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(sx * (10 + k * 0.8), -34 - k * 3); ctx.quadraticCurveTo(sx * (14 + k * 1.4), -58, sx * (23 - k * 0.6), -80 + k * 2.4); ctx.stroke(); }
    soft(ctx, sx * 14, -34, 9, 8, '90,50,34', 0.35);
    fur(ctx, rnd, 120, [sx * 3, -92, sx * 34, -26], () => true, () => -Math.PI / 2 + sx * 0.14, (x, y, r) => (r > 0.6 ? 'rgba(160,112,66,0.5)' : r > 0.3 ? 'rgba(70,42,20,0.45)' : 'rgba(224,190,146,0.35)'), 5, 0.7);
    const tip = ctx.createLinearGradient(0, -66, 0, -94); tip.addColorStop(0, 'rgba(12,6,3,0)'); tip.addColorStop(0.45, 'rgba(12,6,3,0.9)'); tip.addColorStop(1, '#0c0603'); ctx.fillStyle = tip; ctx.fillRect(-60, -98, 120, 34);
    soft(ctx, sx * 30, -52, 4, 24, '20,10,4', 0.55);                                                   // dark outer rim
    ctx.restore();
    edgeFur(ctx, rnd, E, sx * 19, -60, 3, (x, y, r) => (y < -70 ? 'rgba(12,6,3,0.85)' : r > 0.5 ? 'rgba(150,104,60,0.8)' : 'rgba(70,42,20,0.8)'), 2.4, 0.6);
  }
  // throat and chest: only fur, fading away below the chin (no solid shape: nothing to read as a base)
  fur(ctx, rnd, 260, [-24, 24, 24, 62], (x, y) => y > 26 && Math.abs(x) < 26 - (y - 26) * 0.3, (x) => Math.PI / 2 + x * 0.045, (x, y, r) => { const a = Math.max(0, 1 - (y - 26) / 40); return r > 0.45 ? `rgba(240,226,196,${0.85 * a})` : `rgba(160,118,72,${0.75 * a})`; }, 6, 1.0);
  // the head
  smooth(ctx, HARE);
  const hg = ctx.createRadialGradient(-9, -20, 4, 0, 0, 48); hg.addColorStop(0, '#d0a06a'); hg.addColorStop(0.5, '#a97a45'); hg.addColorStop(1, '#6d4826');
  ctx.fillStyle = hg; ctx.fill();
  ctx.save(); smooth(ctx, HARE); ctx.clip();
  soft(ctx, 0, -26, 17, 11, '38,20,8', 0.55);                        // dark crown between the ears
  soft(ctx, 0, -4, 6, 20, '240,206,160', 0.2);                       // light on the nose bridge
  for (const sx of [-1, 1]) {
    soft(ctx, sx * 16.5, -11, 11, 10, '28,12,4', 0.62);              // shadowed eye sockets
    soft(ctx, sx * 19, 22, 12, 12, '244,232,206', 0.95);             // cream cheek
    soft(ctx, sx * 28, 4, 8, 20, '56,30,12', 0.4);                   // darker fur at the outer cheek
  }
  soft(ctx, 0, 25, 15, 11, '246,238,220', 1);                        // cream muzzle
  soft(ctx, 0, 35, 11, 8, '252,248,238', 0.95);                      // cream chin
  fur(ctx, rnd, 1500, [-32, -40, 32, 44], inHare, (x, y) => Math.PI / 2 + (x > 0 ? 0.38 : -0.38) * Math.min(1, Math.abs(x) / 14) * (y < 8 ? 1 : 0.4),
    (x, y, r) => (y > 16 ? (r > 0.45 ? 'rgba(252,246,230,0.5)' : 'rgba(150,120,84,0.3)') : y < -4 && r > 0.72 ? 'rgba(20,10,4,0.5)' : r > 0.5 ? 'rgba(228,186,130,0.42)' : 'rgba(76,44,20,0.32)'), 4.4, 0.75);
  fur(ctx, rnd, 260, [-26, -38, 26, -4], inHare, () => Math.PI / 2, () => 'rgba(16,8,3,0.55)', 3.4, 0.7);   // black flecking on brow and crown
  soft(ctx, 21, 8, 22, 46, '24,10,2', 0.36);                          // far side in shadow
  ctx.restore();
  edgeFur(ctx, rnd, HARE, 0, 0, 4, (x, y, r) => (y > 20 ? (r > 0.4 ? 'rgba(244,232,206,0.9)' : 'rgba(170,132,88,0.85)') : y < -20 ? (r > 0.5 ? 'rgba(80,50,24,0.9)' : 'rgba(150,104,60,0.85)') : r > 0.5 ? 'rgba(190,140,86,0.9)' : 'rgba(96,62,30,0.85)'), 2.8, 0.6);
  // a dark line down the bridge of the nose
  ctx.strokeStyle = 'rgba(20,10,4,0.5)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -20); ctx.quadraticCurveTo(-0.5, -6, 0, 12); ctx.stroke();
  // eyes: large and lateral; an almond, dark-rimmed, amber iris, a round dark pupil, a pale ring only below
  for (const sx of [-1, 1]) {
    ctx.save(); ctx.translate(sx * 17, -11);
    ctx.fillStyle = 'rgba(236,220,186,0.42)'; ctx.beginPath(); ctx.ellipse(0, 2.4, 8.6, 5.6, 0, 0, Math.PI); ctx.fill();                  // pale lower ring
    const eye = () => { ctx.beginPath(); ctx.moveTo(-8, 0.4); ctx.quadraticCurveTo(-1, -8.2, 8, -0.2); ctx.quadraticCurveTo(0, 7.6, -8, 0.4); ctx.closePath(); };
    ctx.fillStyle = 'rgba(12,5,2,0.9)'; eye(); ctx.fill();
    ctx.save(); eye(); ctx.clip();
    const ig = ctx.createRadialGradient(-1.2, -1.6, 0.4, 0, 0, 7); ig.addColorStop(0, '#ffcf55'); ig.addColorStop(0.55, '#d98426'); ig.addColorStop(1, '#5e3210');
    ctx.fillStyle = ig; ell(ctx, 0, 0, 6.2, 6.2); ctx.fill();
    ctx.fillStyle = '#080402'; ell(ctx, 0.2, 0.3, 3.3, 3.9); ctx.fill();
    ctx.fillStyle = 'rgba(20,8,0,0.2)'; ctx.fillRect(-9, -9, 18, 4.2);
    ctx.fillStyle = '#fff'; ell(ctx, -2.2, -2.5, 1.5, 1.3); ctx.fill(); ctx.globalAlpha = 0.5; ell(ctx, 2.4, 2.4, 0.9, 0.8); ctx.globalAlpha = 1; ctx.fill();
    ctx.restore(); eye(); ctx.strokeStyle = '#100703'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
  // nose: small, pink-brown, wet; the split upper lip; the mouth closes below
  ctx.beginPath(); ctx.moveTo(-5.4, 14.4); ctx.quadraticCurveTo(0, 12.2, 5.4, 14.4); ctx.quadraticCurveTo(4.6, 20, 0, 21); ctx.quadraticCurveTo(-4.6, 20, -5.4, 14.4); ctx.closePath();
  const ng = ctx.createLinearGradient(-3, 12, 3, 22); ng.addColorStop(0, '#c98c86'); ng.addColorStop(1, '#7a4a44'); ctx.fillStyle = ng; ctx.fill(); ctx.strokeStyle = 'rgba(40,16,10,0.75)'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.fillStyle = '#2a0f0c'; for (const sx of [-1, 1]) { ell(ctx, sx * 2.3, 16.6, 1.5, 0.8, sx * 0.9); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,240,236,0.8)'; ell(ctx, -1.8, 14.6, 1.6, 0.7); ctx.fill();
  ctx.strokeStyle = 'rgba(52,26,16,0.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 21); ctx.lineTo(0, 24.6); ctx.moveTo(0, 24.6); ctx.quadraticCurveTo(-3.6, 28, -8, 25.6); ctx.moveTo(0, 24.6); ctx.quadraticCurveTo(3.6, 28, 8, 25.6); ctx.stroke();
  soft(ctx, 0, 30, 6, 3, '90,60,50', 0.25);
  // whiskers: long and fine, pale against the dark side, dark against the pale; dots at their roots
  for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) {
    const y0 = 17 + k * 2.2, a = -0.3 + k * 0.22;
    ctx.strokeStyle = k % 2 ? 'rgba(255,250,240,0.7)' : 'rgba(40,24,14,0.42)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(sx * 8, y0); ctx.quadraticCurveTo(sx * 24, y0 + Math.sin(a) * 4 - 3, sx * (46 + k * 2.2), y0 + 6 + Math.sin(a) * 13); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(60,34,22,0.5)'; for (const sx of [-1, 1]) for (let k = 0; k < 7; k++) { ell(ctx, sx * (9 + (k % 3) * 2.4), 15 + Math.floor(k / 3) * 3.2 + (k % 2), 0.5, 0.5); ctx.fill(); }
  soft(ctx, -12, -27, 9, 5, '255,236,200', 0.28, -0.5);
}

// ---------------------------------------------------------------------------------------------
// Hound: a lean tricolour foxhound from the front. A white blaze, a broad tan skull with a black cap, long soft ears
// hanging at the cheeks, a big black nose, loose flews, and gentle dark eyes under a serious brow.
// ---------------------------------------------------------------------------------------------
const HOUND = mirror([[0, -39], [11, -38], [20, -34], [26, -25], [28, -13], [25, -2], [22, 8], [20, 20], [18, 32], [14, 41], [7, 46], [0, 47]]);
const HOUND_EAR = (sx) => [[18, -35], [30, -37], [40, -28], [45, -12], [44, 6], [41, 20], [36, 31], [30, 35], [25, 28], [23, 14], [22, -4], [20, -22]].map(([x, y]) => [x * sx, y]);
function paintHound(ctx) {
  const rnd = lcg(9090), inHound = insidePts(HOUND);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // chest and throat: only fur (white centre, tan at the sides), fading below the chin
  fur(ctx, rnd, 260, [-26, 30, 26, 64], (x, y) => y > 30 && Math.abs(x) < 26 - (y - 30) * 0.3, (x) => Math.PI / 2 + x * 0.05, (x, y, r) => { const a = Math.max(0, 1 - (y - 30) / 40); return Math.abs(x) > 13 ? (r > 0.5 ? `rgba(184,108,48,${0.85 * a})` : `rgba(96,52,20,${0.8 * a})`) : r > 0.45 ? `rgba(252,248,238,${0.9 * a})` : `rgba(190,170,140,${0.7 * a})`; }, 6, 1.0);
  // ears: hanging flaps (dark brown, tan at the outer edge and tip), drawn first so the cheeks overlap their inner edge
  for (const sx of [-1, 1]) {
    const E = HOUND_EAR(sx);
    smooth(ctx, E);
    const g = ctx.createLinearGradient(sx * 20, -34, sx * 40, 30); g.addColorStop(0, '#5e3418'); g.addColorStop(0.45, '#2e1b10'); g.addColorStop(1, '#1b100a');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); smooth(ctx, E); ctx.clip();
    soft(ctx, sx * 38, -14, 9, 26, '160,90,38', 0.4); soft(ctx, sx * 31, 28, 8, 8, '130,70,28', 0.45);
    soft(ctx, sx * 23, 2, 5, 32, '0,0,0', 0.6);
    fur(ctx, rnd, 320, [sx * 20 - 14, -38, sx * 20 + 28, 38], () => true, () => Math.PI / 2 - sx * 0.1, (x, y, r) => (r > 0.62 ? 'rgba(176,102,46,0.42)' : r > 0.3 ? 'rgba(8,3,1,0.5)' : 'rgba(96,54,26,0.4)'), 6, 0.75);
    ctx.restore();
    edgeFur(ctx, rnd, E, sx * 32, -2, 3, (x, y, r) => (r > 0.5 ? 'rgba(110,62,28,0.9)' : 'rgba(22,12,6,0.9)'), 2.4, 0.6);
  }
  // the head: tan
  smooth(ctx, HOUND);
  const hg = ctx.createRadialGradient(-9, -22, 4, 0, 0, 52); hg.addColorStop(0, '#d38a44'); hg.addColorStop(0.5, '#b06a2c'); hg.addColorStop(1, '#6d3814');
  ctx.fillStyle = hg; ctx.fill();
  ctx.save(); smooth(ctx, HOUND); ctx.clip();
  soft(ctx, -5, -33, 16, 8, '18,10,6', 0.78); soft(ctx, 10, -31, 10, 6, '18,10,6', 0.5);          // the black cap, off centre
  // the white blaze: between the brows, down the nose, widening into the muzzle
  ctx.beginPath(); ctx.moveTo(-3, -34); ctx.bezierCurveTo(-5, -20, -6, -4, -9, 12); ctx.lineTo(-13, 36); ctx.lineTo(13, 36); ctx.lineTo(9, 12); ctx.bezierCurveTo(6, -4, 5, -20, 3, -34); ctx.closePath();
  const wg = ctx.createLinearGradient(0, -30, 0, 38); wg.addColorStop(0, 'rgba(255,252,244,0.5)'); wg.addColorStop(0.35, 'rgba(255,250,240,0.96)'); wg.addColorStop(1, '#f6efe0'); ctx.fillStyle = wg; ctx.fill();
  for (const sx of [-1, 1]) {
    soft(ctx, sx * 15, -10, 11, 9, '30,12,4', 0.6);                    // shadowed sockets
    soft(ctx, sx * 12, 24, 9, 15, '244,236,220', 0.9);                 // white upper lip / flews
    soft(ctx, sx * 19, 14, 8, 10, '208,140,70', 0.42);                 // tan cheek
  }
  soft(ctx, 0, 41, 14, 6, '250,246,236', 0.9);                         // white chin
  fur(ctx, rnd, 1500, [-30, -40, 30, 48], inHound, (x) => Math.PI / 2 + x * 0.014,
    (x, y, r) => (Math.abs(x) < 9 && y > -32 ? (r > 0.5 ? 'rgba(255,255,250,0.35)' : 'rgba(180,160,130,0.28)') : y < -26 ? (r > 0.5 ? 'rgba(30,18,10,0.42)' : 'rgba(10,4,2,0.36)') : y > 20 ? (r > 0.5 ? 'rgba(246,238,222,0.36)' : 'rgba(150,100,60,0.26)') : r > 0.5 ? 'rgba(232,150,80,0.36)' : 'rgba(96,46,14,0.3)'), 4.2, 0.75);
  soft(ctx, 22, 6, 22, 46, '26,10,0', 0.34);                           // far side in shadow
  ctx.restore();
  edgeFur(ctx, rnd, HOUND, 0, 0, 3, (x, y, r) => (y > 30 ? (r > 0.4 ? 'rgba(246,238,222,0.9)' : 'rgba(180,150,116,0.85)') : y < -28 ? (r > 0.5 ? 'rgba(40,24,12,0.9)' : 'rgba(14,6,3,0.9)') : r > 0.5 ? 'rgba(206,132,66,0.9)' : 'rgba(110,56,20,0.85)'), 2.6, 0.6);
  // brows: a serious, gentle ridge above each eye
  for (const sx of [-1, 1]) { ctx.strokeStyle = 'rgba(78,38,14,0.85)'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(sx * 6.8, -19.6); ctx.quadraticCurveTo(sx * 14, -23.6, sx * 21, -18.4); ctx.stroke(); ctx.strokeStyle = 'rgba(255,176,104,0.3)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(sx * 7.6, -21.2); ctx.quadraticCurveTo(sx * 14, -25.2, sx * 20, -20.2); ctx.stroke(); }
  // eyes: deep brown, gentle, with a bright catch-light
  for (const sx of [-1, 1]) {
    ctx.save(); ctx.translate(sx * 13.8, -10);
    const eye = () => { ctx.beginPath(); ctx.moveTo(-7.2, 0.7); ctx.quadraticCurveTo(0, -6.4, 7.2, 0.3); ctx.quadraticCurveTo(0, 5.8, -7.2, 0.7); ctx.closePath(); };
    ctx.fillStyle = 'rgba(14,6,2,0.85)'; eye(); ctx.fill();
    ctx.save(); eye(); ctx.clip();
    ctx.fillStyle = '#e4d6bc'; ctx.fillRect(-9, -8, 18, 16);
    const ig = ctx.createRadialGradient(0.4, -0.6, 0.4, 0, 0, 5.4); ig.addColorStop(0, '#6e3c14'); ig.addColorStop(0.6, '#3a1c08'); ig.addColorStop(1, '#170a03');
    ctx.fillStyle = ig; ell(ctx, 0.4, 0.2, 4.8, 5); ctx.fill();
    ctx.fillStyle = '#050201'; ell(ctx, 0.4, 0.2, 2.5, 2.6); ctx.fill();
    ctx.fillStyle = 'rgba(20,8,0,0.45)'; ctx.fillRect(-9, -8, 18, 5);
    ctx.fillStyle = '#fff'; ell(ctx, -1.5, -1.6, 1.4, 1.3); ctx.fill(); ctx.globalAlpha = 0.5; ell(ctx, 2.2, 1.9, 0.9, 0.8); ctx.globalAlpha = 1; ctx.fill();
    ctx.restore(); eye(); ctx.strokeStyle = '#110603'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
  // nose: big, black, glossy, comma nostrils; philtrum; loose flews and a soft mouth line
  ctx.beginPath(); ctx.moveTo(-10, 24.6); ctx.quadraticCurveTo(0, 20.6, 10, 24.6); ctx.quadraticCurveTo(9, 33, 0, 34.8); ctx.quadraticCurveTo(-9, 33, -10, 24.6); ctx.closePath();
  const ng = ctx.createLinearGradient(-5, 22, 5, 35); ng.addColorStop(0, '#3a3634'); ng.addColorStop(0.5, '#151210'); ng.addColorStop(1, '#050403'); ctx.fillStyle = ng; ctx.fill();
  ctx.fillStyle = '#000'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 4.6, 28.6, 2.7, 1.3, sx * 0.9, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ell(ctx, -3.4, 24.6, 3.6, 1.3, -0.15); ctx.fill();
  ctx.strokeStyle = 'rgba(40,18,10,0.85)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, 34.6); ctx.lineTo(0, 38.2); ctx.moveTo(0, 38.2); ctx.quadraticCurveTo(-7, 41.4, -13, 36.4); ctx.moveTo(0, 38.2); ctx.quadraticCurveTo(7, 41.4, 13, 36.4); ctx.stroke();
  ctx.strokeStyle = 'rgba(70,40,26,0.5)'; ctx.lineWidth = 0.9; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 11, 29); ctx.quadraticCurveTo(sx * 15, 34, sx * 13.5, 41); ctx.stroke(); }
  ctx.fillStyle = 'rgba(70,40,26,0.5)'; for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) { ell(ctx, sx * (10 + (k % 3) * 2.6), 30 + Math.floor(k / 3) * 3.2, 0.5, 0.5); ctx.fill(); }
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { ctx.strokeStyle = 'rgba(250,245,232,0.6)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(sx * 12, 31 + k * 2); ctx.quadraticCurveTo(sx * 24, 32 + k * 3, sx * (33 + k * 2), 36 + k * 5); ctx.stroke(); }
  soft(ctx, -13, -29, 10, 5, '255,220,170', 0.28, -0.5);
}

// ---------------------------------------------------------------------------------------------
// Sprites and the public draw calls
// ---------------------------------------------------------------------------------------------
// Piece sets. 'wild' is the painting as it stands. 'snow' is the same painting washed pale (a white winter hare, a pale
// hound), made by laying a translucent colour over the finished sprite: one extra sprite and nothing per frame.
export const SETS = { wild: null, snow: { H: 'rgba(238,244,255,0.62)', D: 'rgba(230,236,246,0.5)' } };
export const SET_NAMES = { wild: 'Wild', snow: 'Snow' };
const sprites = {};
function sprite(kind, paint, set = 'wild') {
  const key = kind + '-' + set;
  if (key in sprites) return sprites[key];
  sprites[key] = null;
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const c = new OffscreenCanvas(BOX.w * SPRITE_SCALE, BOX.h * SPRITE_SCALE), sctx = c.getContext('2d');
      sctx.scale(SPRITE_SCALE, SPRITE_SCALE); sctx.translate(-BOX.x, -BOX.y); paint(sctx);
      const tint = SETS[set]?.[kind === 'hare' ? 'H' : 'D'];
      if (tint) { sctx.globalCompositeOperation = 'source-atop'; sctx.fillStyle = tint; sctx.fillRect(BOX.x, BOX.y, BOX.w, BOX.h); sctx.globalCompositeOperation = 'source-over'; }
      sprites[key] = c;
    }
  } catch { sprites[key] = null; }
  return sprites[key];
}

// Soft blobs (contact shadow, selection glow) are drawn every frame for every piece, so they are sprites too.
const blobs = {};
function blob(ctx, x, y, rx, ry, rgb, a) {
  if (!(rgb in blobs)) {
    blobs[rgb] = null;
    try { if (typeof OffscreenCanvas !== 'undefined') { const c = new OffscreenCanvas(128, 128), b = c.getContext('2d'); soft(b, 64, 64, 64, 64, rgb, 1); blobs[rgb] = c; } } catch { blobs[rgb] = null; }
  }
  if (!blobs[rgb]) { soft(ctx, x, y, rx, ry, rgb, a); return; }
  const ga = ctx.globalAlpha; ctx.globalAlpha = ga * a; ctx.drawImage(blobs[rgb], x - rx, y - ry, rx * 2, ry * 2); ctx.globalAlpha = ga;
}

// opts: { selected, dim, lift (0..1: raised off the board), threat }
function drawPiece(kind, paint, ctx, x, y, r, opts) {
  const lift = opts.lift ?? 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(r / 50, r / 50);
  if (opts.dim) ctx.globalAlpha *= 0.45;
  if (opts.selected) blob(ctx, 0, 36, 72, 26, '255,224,120', 0.9);
  blob(ctx, 9, 47, 56 - lift * 8, 18 - lift * 4, '0,0,0', 0.55 - lift * 0.22);      // contact shadow stays on the ground
  ctx.translate(0, -lift * 24);
  const s = sprite(kind, paint, opts.set);
  if (s) ctx.drawImage(s, BOX.x, BOX.y, BOX.w, BOX.h); else paint(ctx);
  if (opts.threat) {
    ctx.fillStyle = '#e5342a'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(38, -50, 9, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(36.5, -56, 3, 8); ctx.fillRect(36.5, -46.5, 3, 3);
  }
  ctx.restore();
}
export const drawHare = (ctx, x, y, r, opts = {}) => drawPiece('hare', paintHare, ctx, x, y, r, opts);
export const drawHound = (ctx, x, y, r, opts = {}) => drawPiece('hound', paintHound, ctx, x, y, r, opts);

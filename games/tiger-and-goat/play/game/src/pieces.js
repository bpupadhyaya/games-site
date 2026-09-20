// The two pieces: a realistic tiger head and a realistic goat head, standing on the board with a soft shadow.
// They are painted once (fur and all) into a sprite and reused for every piece on the board.
// Reference space: 50 units = the base radius; origin at the centre of the base. Light: upper left.
const TAU = Math.PI * 2;
const BOX = { x: -68, y: -92, w: 136, h: 160 }, SPRITE_SCALE = 4;

function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function leaf(ctx, x1, y1, x2, y2, w) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * w, ny = (dx / l) * w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx + nx, my + ny, x2, y2); ctx.quadraticCurveTo(mx - nx, my - ny, x1, y1); ctx.fill();
}

function soft(ctx, x, y, rx, ry, rgb, a) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
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

// A stripe that follows a curve and tapers to a point at both ends (tiger markings).
function stripe(ctx, x1, y1, cx, cy, x2, y2, w) {
  const L = [], R = [];
  for (let k = 0; k <= 12; k++) {
    const t = k / 12, mt = 1 - t;
    const x = mt * mt * x1 + 2 * mt * t * cx + t * t * x2, y = mt * mt * y1 + 2 * mt * t * cy + t * t * y2;
    const dx = 2 * mt * (cx - x1) + 2 * t * (x2 - cx), dy = 2 * mt * (cy - y1) + 2 * t * (y2 - cy), l = Math.hypot(dx, dy) || 1;
    const hw = w * Math.pow(Math.sin(Math.PI * t), 0.7);
    L.push([x - (dy / l) * hw, y + (dx / l) * hw]); R.push([x + (dy / l) * hw, y - (dx / l) * hw]);
  }
  ctx.beginPath(); L.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); R.reverse().forEach((q) => ctx.lineTo(q[0], q[1])); ctx.closePath(); ctx.fill();
}

// ---------------------------------------------------------------------------------------------
// Tiger: a real Bengal tiger's head from the front, built as a solid form and not a flat mask:
// a flat-topped skull, a ragged ruff for an outline (no drawn outline), small round slanted eyes set
// back in shadowed sockets, vertical forehead stripes, and a big muzzle that stands out from the face.
// ---------------------------------------------------------------------------------------------
const RUFF = [[49, 0], [54, 8], [51, 14], [55, 21], [49, 26], [50, 33], [41, 33], [36, 39], [28, 36], [19, 40]];
// soft tufts: curve through the midpoints so the ruff reads as fur, not cut paper
function tufts(ctx, pts) { for (let i = 0; i < pts.length - 1; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2); ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); }
function tigerHead(ctx) {
  ctx.beginPath(); ctx.moveTo(0, -45);
  ctx.bezierCurveTo(12, -46, 22, -45, 30, -40); ctx.bezierCurveTo(38, -34, 43, -22, 46, -10);
  tufts(ctx, RUFF);
  ctx.bezierCurveTo(12, 42, 6, 43, 0, 43); ctx.bezierCurveTo(-6, 43, -12, 42, -19, 40);
  tufts(ctx, RUFF.slice().reverse().map(([x, y]) => [-x, y]));
  ctx.lineTo(-46, -10); ctx.bezierCurveTo(-43, -22, -38, -34, -30, -40); ctx.bezierCurveTo(-22, -45, -12, -46, 0, -45); ctx.closePath();
}
const tigerEdge = (y) => (y < -12 ? 30 + (y + 45) * 0.48 : y < 16 ? 46 + (y + 12) * 0.25 : 53 - (y - 16) * 1.35);
const inTiger = (x, y) => y > -44 && y < 41 && Math.abs(x) < tigerEdge(y) - 1;

function paintTiger(ctx) {
  const rnd = lcg(7001), INK = '#0e0603';
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // ears: small, round, set wide and partly behind the skull; pale fluff inside
  for (const sx of [-1, 1]) {
    const ex = sx * 32, ey = -39;
    const g = ctx.createRadialGradient(ex - 3, ey - 5, 1, ex, ey, 11); g.addColorStop(0, '#d39a60'); g.addColorStop(0.75, '#8a5222'); g.addColorStop(1, '#3a1e0c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(ex, ey, 9.8, 10.8, sx * 0.35, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2e1a10'; ctx.beginPath(); ctx.ellipse(ex - sx * 1.5, ey + 3, 6, 7.4, sx * 0.35, 0, TAU); ctx.fill();
    fur(ctx, rnd, 60, [ex - 8, ey - 5, ex + 8, ey + 11], (x, y) => Math.hypot((x - ex + sx * 1.5) / 6.6, (y - ey - 3) / 8) < 1, () => -Math.PI / 2 + sx * 0.7, (x, y, r) => (r > 0.4 ? 'rgba(244,234,214,0.85)' : 'rgba(190,165,130,0.75)'), 3.4, 0.9);
  }
  // the coat: no outline, the ragged ruff is the silhouette
  const hg = ctx.createRadialGradient(-8, -20, 4, 0, -2, 66);
  hg.addColorStop(0, '#e0953f'); hg.addColorStop(0.5, '#bf6f27'); hg.addColorStop(1, '#6e370f');
  tigerHead(ctx); ctx.fillStyle = hg; ctx.fill();
  ctx.save(); tigerHead(ctx); ctx.clip();
  for (const sx of [-1, 1]) {
    soft(ctx, sx * 42, 12, 19, 28, '248,243,232', 1);                 // white cheeks and ruff
    soft(ctx, sx * 33, 31, 18, 11, '248,243,232', 0.95);
    soft(ctx, sx * 30, 4, 8, 12, '248,243,232', 0.7);
    soft(ctx, sx * 15.5, -25.5, 8.5, 5.2, '252,247,236', 0.95);       // pale patch over the eye
    soft(ctx, sx * 23, -9, 6, 5.5, '252,247,236', 0.8);               // and beside it
  }
  soft(ctx, 0, 36, 19, 10, '250,246,238', 1);                          // chin and lower jaw
  // the long nose bridge: a lit top plane with a shadowed plane down each side
  soft(ctx, 0, -8, 8, 24, '232,176,110', 0.85);
  for (const sx of [-1, 1]) soft(ctx, sx * 10.5, -3, 4.2, 15, '70,28,4', 0.42);
  fur(ctx, rnd, 1900, [-56, -46, 56, 43], inTiger, (x, y) => Math.atan2(y - 8, x) + 0.15 * Math.sign(x), (x, y, r) => (r > 0.5 ? 'rgba(255,240,214,0.30)' : 'rgba(60,24,4,0.26)'), 5, 0.9);
  // eye sockets sit back in the skull
  for (const sx of [-1, 1]) soft(ctx, sx * 15.5, -15, 10.5, 8, '40,14,0', 0.5);
  // markings: forehead stripes run down toward the eyes; brackets on the cheeks
  ctx.fillStyle = INK;
  stripe(ctx, 0, -45, 0.8, -38, 0, -29, 1.5);
  stripe(ctx, -4, -26.5, 0, -28, 4, -26.5, 1.1); stripe(ctx, -3, -23, 0, -24.2, 3, -23, 0.9);
  for (const sx of [-1, 1]) {
    const j = () => (rnd() - 0.5) * 1.3, S = (x1, y1, cx, cy, x2, y2, w) => stripe(ctx, sx * (x1 + j()), y1, sx * cx, cy + j(), sx * (x2 + j()), y2, w);
    S(5, -45, 6.5, -38, 3.5, -31, 1.4); S(10, -45, 11.5, -37.5, 7.5, -30, 1.7); S(15.5, -44.5, 16, -38, 12, -32.5, 1.8);
    S(21.5, -43, 21, -37, 17.5, -33, 1.8); S(27.5, -40, 27.5, -34, 23, -30.5, 1.8); S(33.5, -35, 33, -29, 28, -26, 1.7);
    S(11, -27, 12, -29.5, 14, -31.5, 0.8); S(16.5, -26.5, 18.5, -28.5, 21, -30.5, 0.8);      // dashes on the pale brow
    S(21, -16.5, 27, -19, 31, -22.5, 1.5);                                                   // from the outer corner of the eye
    S(24, -12, 33, -10, 37, 1, 2.1); S(38, -27, 48, -11, 41, 8, 2.5); S(30, -3, 39, 7, 32, 19, 2.2);
    S(46, -13, 56, 3, 46, 20, 2.4); S(38, 21, 37, 30, 27, 33, 2.0); S(48, 22, 47, 31, 38, 34.5, 1.9);
  }
  fur(ctx, rnd, 380, [-56, -46, 56, 38], inTiger, (x, y) => Math.atan2(y - 8, x), (x, y, r) => (Math.abs(x) > 28 && y > -6 ? 'rgba(250,246,238,0.33)' : 'rgba(196,116,46,0.24)'), 4.4, 0.8);
  // the muzzle stands out from the face: shadow where it meets the cheeks, then the lit pads on top
  for (const sx of [-1, 1]) soft(ctx, sx * 21, 17, 7, 13, '60,24,4', 0.5);
  soft(ctx, 0, 31, 19, 5.5, '30,10,0', 0.55);                                                // shadow the muzzle casts on the chin
  for (const sx of [-1, 1]) {
    ctx.save(); ctx.translate(sx * 8.6, 19);
    const pg = ctx.createRadialGradient(-3.5, -4.5, 1, 0, 0, 14.5);
    pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.6, '#f3ece0'); pg.addColorStop(1, '#b9a68a');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(0, 0, 12.6, 10.4, sx * 0.12, 0, TAU); ctx.fill(); ctx.restore();
  }
  fur(ctx, rnd, 220, [-21, 9, 21, 29], (x, y) => Math.hypot((Math.abs(x) - 8.6) / 12, (y - 19) / 9.8) < 1, (x, y) => Math.atan2(y - 10, x), (x, y, r) => (r > 0.5 ? 'rgba(255,255,255,0.55)' : 'rgba(150,128,100,0.30)'), 3.4, 0.8);
  // overall form: lit from the upper left, the far side and the underside fall away
  soft(ctx, 40, 22, 50, 50, '30,10,0', 0.36);
  soft(ctx, 0, 44, 50, 12, '30,10,0', 0.4);
  soft(ctx, -14, -38, 26, 9, '255,232,190', 0.26);
  ctx.restore();
  // loose hairs breaking the edge of the ruff
  fur(ctx, rnd, 140, [-60, -6, 60, 42], (x, y) => { const ax = Math.abs(x); return ax > 30 && Math.abs(ax - tigerEdge(y)) < 2; }, (x) => (x > 0 ? 0.8 : Math.PI - 0.8), (x, y, r) => (r > 0.3 ? 'rgba(248,242,230,0.75)' : 'rgba(186,170,146,0.7)'), 3, 0.9);
  // eyes: small, round, slanted up at the outer corner; pale amber with a tiny round pupil
  for (const sx of [-1, 1]) {
    ctx.save(); ctx.translate(sx * 15.5, -15); ctx.scale(sx, 1);
    const eye = () => { ctx.beginPath(); ctx.moveTo(-5.4, 2.5); ctx.bezierCurveTo(-3.6, -3.2, 2.6, -4.7, 5.6, -2.1); ctx.bezierCurveTo(3.6, 2.7, -1.4, 4.1, -5.4, 2.5); ctx.closePath(); };
    ctx.fillStyle = INK;
    stripe(ctx, -5, 2, -8.6, 5, -8.2, 13, 1.5);                       // the dark line from the inner corner down beside the nose
    ctx.save(); eye(); ctx.clip();
    const ig = ctx.createRadialGradient(0, -1, 0.3, 0.2, -0.4, 4.6); ig.addColorStop(0, '#f6e6a6'); ig.addColorStop(0.6, '#d2ad52'); ig.addColorStop(1, '#5e430e');
    ctx.fillStyle = ig; ctx.fillRect(-7, -6, 14, 12);
    ctx.fillStyle = '#040201'; ctx.beginPath(); ctx.arc(0.3, -0.5, 1.55, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(10,4,0,0.55)'; ctx.fillRect(-7, -6, 14, 3.3);                       // shade under the brow
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-1, -1.7, 0.75, 0, TAU); ctx.fill();
    ctx.restore();
    eye(); ctx.strokeStyle = INK; ctx.lineWidth = 2.1; ctx.stroke();
    ctx.restore();
  }
  // nose leather: broad and flat-topped, darker along the bottom edge
  ctx.beginPath(); ctx.moveTo(-9.6, 5.4); ctx.quadraticCurveTo(0, 3, 9.6, 5.4); ctx.quadraticCurveTo(8.6, 11.6, 2, 15.6); ctx.lineTo(0, 16.8); ctx.lineTo(-2, 15.6); ctx.quadraticCurveTo(-8.6, 11.6, -9.6, 5.4); ctx.closePath();
  const ng = ctx.createLinearGradient(-5, 4, 5, 17); ng.addColorStop(0, '#d89c8c'); ng.addColorStop(0.6, '#b9705f'); ng.addColorStop(1, '#6e352c');
  ctx.fillStyle = ng; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(30,8,4,0.9)'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 4.8, 11.4, 2.6, 1.4, sx * 0.7, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(-2.4, 6.4, 4, 1.1, -0.08, 0, TAU); ctx.fill();
  // philtrum, black lips running out under the pads, the lower lip
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 16.8); ctx.lineTo(0, 23.4); ctx.stroke();
  ctx.lineWidth = 2.3; ctx.beginPath(); ctx.moveTo(0, 23.4); ctx.bezierCurveTo(-5, 30.5, -13, 30, -19, 24.5); ctx.moveTo(0, 23.4); ctx.bezierCurveTo(5, 30.5, 13, 30, 19, 24.5); ctx.stroke();
  ctx.fillStyle = 'rgba(30,8,4,0.85)'; ctx.beginPath(); ctx.ellipse(0, 28.6, 6, 2.3, 0, 0, TAU); ctx.fill();
  // whisker spots in rows, and fine whiskers
  for (const sx of [-1, 1]) {
    ctx.fillStyle = 'rgba(24,10,4,0.9)';
    for (let row = 0; row < 4; row++) for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(sx * (5 + k * 3.3 + row * 0.5), 14.8 + row * 2.8 - k * 0.3, 0.66, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    for (const [ex, ey, w] of [[58, 12, 0.7], [60, 21, 0.8], [56, 30, 0.7], [48, 37, 0.6]]) { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(sx * 13, 18 + (ey - 18) * 0.2); ctx.quadraticCurveTo(sx * 36, ey - 4, sx * ex, ey); ctx.stroke(); }
  }
}

// ---------------------------------------------------------------------------------------------
// Goat: a chestnut-brown goat. Long grey horns sweeping out, big drooping ears, darker forehead tuft,
// pale pinkish muzzle with dark nostrils, amber eyes on the sides of the head, a small beard.
// ---------------------------------------------------------------------------------------------
function goatHead(ctx) {
  ctx.beginPath(); ctx.moveTo(0, -46);
  ctx.bezierCurveTo(10, -47, 19, -42, 22, -32); ctx.bezierCurveTo(25, -24, 25, -16, 22, -8);
  ctx.bezierCurveTo(19, 4, 17, 16, 15.5, 24); ctx.bezierCurveTo(14.5, 33, 8.5, 38, 0, 38);
  ctx.bezierCurveTo(-8.5, 38, -14.5, 33, -15.5, 24); ctx.bezierCurveTo(-17, 16, -19, 4, -22, -8);
  ctx.bezierCurveTo(-25, -16, -25, -24, -22, -32); ctx.bezierCurveTo(-19, -42, -10, -47, 0, -46); ctx.closePath();
}
const inGoat = (x, y) => { const ax = Math.abs(x); return y > -45 && y < 37 && ax < (y < -30 ? 12 + (y + 45) * 0.7 : y < -8 ? 24 : y < 24 ? 22 - (y + 8) * 0.21 : 15.5 - (y - 24) * 0.9); };

function paintGoat(ctx) {
  const rnd = lcg(9002), INK = '#2c1408';
  // no disc under the goat (owner, 2026-09-20): the head stands on the board by itself
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // horns: long, grey, ridged; up from the skull, then sweeping outward
  for (const sx of [-1, 1]) {
    const P = [[8, -41], [8, -74], [36, -88], [60, -68]], L = [], R = [];
    for (let k = 0; k <= 18; k++) {
      const t = k / 18, mt = 1 - t;
      const bx = mt * mt * mt * P[0][0] + 3 * mt * mt * t * P[1][0] + 3 * mt * t * t * P[2][0] + t * t * t * P[3][0];
      const by = mt * mt * mt * P[0][1] + 3 * mt * mt * t * P[1][1] + 3 * mt * t * t * P[2][1] + t * t * t * P[3][1];
      const dx = 3 * mt * mt * (P[1][0] - P[0][0]) + 6 * mt * t * (P[2][0] - P[1][0]) + 3 * t * t * (P[3][0] - P[2][0]);
      const dy = 3 * mt * mt * (P[1][1] - P[0][1]) + 6 * mt * t * (P[2][1] - P[1][1]) + 3 * t * t * (P[3][1] - P[2][1]);
      const l = Math.hypot(dx, dy) || 1, w = 7.6 * Math.pow(1 - t, 0.75) + 0.7;
      L.push([sx * (bx - (dy / l) * w), by + (dx / l) * w]); R.push([sx * (bx + (dy / l) * w), by - (dx / l) * w]);
    }
    ctx.beginPath(); L.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); R.slice().reverse().forEach((q) => ctx.lineTo(q[0], q[1])); ctx.closePath();
    const g = ctx.createLinearGradient(-20, -88, 40, -40); g.addColorStop(0, '#c9c4b8'); g.addColorStop(0.5, '#918b80'); g.addColorStop(1, '#4e4a42');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#2a2622'; ctx.lineWidth = 1.3; ctx.stroke();
    for (let k = 1; k <= 17; k++) {
      ctx.strokeStyle = k % 2 ? 'rgba(30,26,20,0.5)' : 'rgba(240,236,225,0.35)'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(L[k][0], L[k][1]); ctx.quadraticCurveTo((L[k][0] + R[k][0]) / 2, (L[k][1] + R[k][1]) / 2 - 1.6, R[k][0], R[k][1]); ctx.stroke();
    }
  }
  // ears: big, carried level and drooping at the tip
  for (const sx of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(sx * 20, -36); ctx.bezierCurveTo(sx * 36, -42, sx * 54, -34, sx * 62, -14); ctx.bezierCurveTo(sx * 58, -8, sx * 52, -8, sx * 47, -12); ctx.bezierCurveTo(sx * 40, -18, sx * 30, -22, sx * 21, -24); ctx.closePath();
    const g = ctx.createLinearGradient(sx * 20, -40, sx * 60, -10); g.addColorStop(0, '#b4602f'); g.addColorStop(1, '#7a3a18');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx * 26, -33); ctx.bezierCurveTo(sx * 38, -36, sx * 51, -30, sx * 57, -15); ctx.bezierCurveTo(sx * 50, -14, sx * 38, -24, sx * 26, -27); ctx.closePath();
    const ig = ctx.createLinearGradient(sx * 26, -32, sx * 57, -14); ig.addColorStop(0, '#5a2a1c'); ig.addColorStop(1, '#a8655a');
    ctx.fillStyle = ig; ctx.fill();
  }
  // two small wattles hanging under the jaw
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 9, 31); ctx.quadraticCurveTo(sx * 13, 44, sx * 10, 50); ctx.quadraticCurveTo(sx * 6, 45, sx * 6, 32); ctx.closePath(); ctx.fillStyle = '#8a4520'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke(); }
  // small beard
  ctx.beginPath(); ctx.moveTo(-6, 33); ctx.quadraticCurveTo(-5, 47, 1, 56); ctx.quadraticCurveTo(6, 46, 6, 33); ctx.closePath();
  ctx.fillStyle = '#7a3a1a'; ctx.fill();
  fur(ctx, rnd, 90, [-6, 33, 6, 53], (x, y) => Math.abs(x) < 6 - (y - 33) * 0.26, (x) => Math.PI / 2 - x * 0.03, (x, y, r) => (r > 0.5 ? 'rgba(210,130,80,0.7)' : 'rgba(50,18,6,0.6)'), 7, 0.9);
  // head: chestnut coat
  const hg = ctx.createRadialGradient(-8, -26, 3, 0, -4, 54);
  hg.addColorStop(0, '#cf7a42'); hg.addColorStop(0.5, '#a9552a'); hg.addColorStop(1, '#6a2e12');
  goatHead(ctx); ctx.fillStyle = hg; ctx.fill();
  ctx.save(); goatHead(ctx); ctx.clip();
  soft(ctx, 0, -40, 15, 10, '80,32,10', 0.6);                        // darker tuft on the forehead
  soft(ctx, 0, -10, 7.5, 24, '224,140,88', 0.75);                    // light catches the long nose bridge
  for (const sx of [-1, 1]) { soft(ctx, sx * 19, -16, 10, 9, '60,22,6', 0.5); soft(ctx, sx * 12, 14, 6, 14, '80,32,10', 0.3); }
  soft(ctx, 0, -6, 4.6, 27, '240,196,158', 0.7);                     // pale stripe down the nose
  soft(ctx, 0, 27, 16, 13, '206,180,170', 0.95);                     // pale grey-pink muzzle
  soft(ctx, 0, 34, 12, 6, '226,208,200', 0.9);
  fur(ctx, rnd, 1000, [-26, -46, 26, 38], inGoat, (x) => Math.PI / 2 + x * 0.014, (x, y, r) => (y > 20 ? (r > 0.5 ? 'rgba(255,236,224,0.35)' : 'rgba(120,80,66,0.22)') : r > 0.5 ? 'rgba(236,150,92,0.38)' : 'rgba(56,20,4,0.28)'), 4.6, 0.85);
  soft(ctx, 20, 6, 22, 46, '30,10,0', 0.38);                         // far side in shadow
  ctx.restore();
  goatHead(ctx); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
  // forelock: darker hair falling on the brow
  fur(ctx, rnd, 120, [-12, -47, 12, -30], (x, y) => Math.abs(x) < 11 - (y + 47) * 0.3, (x) => Math.PI / 2 + x * 0.08, (x, y, r) => (r > 0.5 ? 'rgba(170,84,40,0.95)' : 'rgba(70,26,8,0.9)'), 8, 1.2);
  // eyes: on the sides of the head, amber with the level slot pupil
  for (const sx of [-1, 1]) {
    ctx.save(); ctx.translate(sx * 19.5, -16.5); ctx.scale(sx, 1);
    const eye = () => { ctx.beginPath(); ctx.moveTo(-7, 0.6); ctx.quadraticCurveTo(-1, -6.2, 7.2, -1); ctx.quadraticCurveTo(1.2, 5.6, -7, 0.6); ctx.closePath(); };
    ctx.save(); eye(); ctx.clip();
    const ig = ctx.createRadialGradient(-0.5, -1, 0.4, 0, 0, 6.8); ig.addColorStop(0, '#f6dc8a'); ig.addColorStop(0.6, '#cf9a36'); ig.addColorStop(1, '#6e4a0e');
    ctx.fillStyle = ig; ctx.fillRect(-8, -7, 16, 13);
    ctx.fillStyle = '#0a0604'; ctx.beginPath(); ctx.roundRect(-4, -1.7, 8.2, 3.3, 1.6); ctx.fill();
    ctx.fillStyle = 'rgba(20,8,0,0.3)'; ctx.fillRect(-8, -7, 16, 3.2);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-2.2, -2.4, 1.2, 0, TAU); ctx.fill();
    ctx.restore();
    eye(); ctx.strokeStyle = '#140804'; ctx.lineWidth = 1.9; ctx.stroke();
    ctx.restore();
  }
  // nose: grey-brown leather, dark comma nostrils, split lip, quiet mouth
  ctx.beginPath(); ctx.moveTo(-7.6, 24.6); ctx.quadraticCurveTo(0, 22.4, 7.6, 24.6); ctx.quadraticCurveTo(6.4, 31, 0, 32.4); ctx.quadraticCurveTo(-6.4, 31, -7.6, 24.6); ctx.closePath();
  const ng = ctx.createLinearGradient(-4, 23, 4, 33); ng.addColorStop(0, '#a08a86'); ng.addColorStop(1, '#5e4a48');
  ctx.fillStyle = ng; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.stroke();
  ctx.fillStyle = '#1c0e0a'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 3.8, 27.4, 2.4, 1.15, sx * 0.9, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(0, 29); ctx.lineTo(0, 34.4); ctx.moveTo(0, 34.4); ctx.quadraticCurveTo(-4.4, 36.6, -9.4, 33.8); ctx.moveTo(0, 34.4); ctx.quadraticCurveTo(4.4, 36.6, 9.4, 33.8); ctx.stroke();
}

// ---------------------------------------------------------------------------------------------
// Sprites and the public draw calls
// ---------------------------------------------------------------------------------------------
// Piece sets. 'classic' is the approved painting. 'snow' is the same painting washed pale (a white tiger, a white goat),
// made by laying a translucent colour over the finished sprite, so it costs one extra sprite and nothing per frame.
export const SETS = { classic: null, snow: { T: 'rgba(236,241,255,0.58)', G: 'rgba(255,255,255,0.72)' } };
export const SET_NAMES = { classic: 'Classic', snow: 'Snow' };
const sprites = {};
function sprite(kind, paint, set = 'classic') {
  const key = kind + '-' + set;
  if (key in sprites) return sprites[key];
  sprites[key] = null;
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const c = new OffscreenCanvas(BOX.w * SPRITE_SCALE, BOX.h * SPRITE_SCALE), sctx = c.getContext('2d');
      sctx.scale(SPRITE_SCALE, SPRITE_SCALE); sctx.translate(-BOX.x, -BOX.y); paint(sctx);
      const tint = SETS[set]?.[kind === 'tiger' ? 'T' : 'G'];
      if (tint) { sctx.globalCompositeOperation = 'source-atop'; sctx.fillStyle = tint; sctx.fillRect(BOX.x, BOX.y, BOX.w, BOX.h); sctx.globalCompositeOperation = 'source-over'; }
      sprites[key] = c;
    }
  } catch { sprites[key] = null; }
  return sprites[key];
}

// Soft blobs (contact shadow, selection glow) are drawn every frame for every piece, so they are sprites too:
// building a radial gradient per piece per frame is the kind of cost that shows up on a 120 Hz phone.
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
  if (opts.selected) blob(ctx, 0, 32, 72, 26, '255,224,120', 0.9);
  blob(ctx, 9, 43, 58 - lift * 8, 19 - lift * 4, '0,0,0', 0.55 - lift * 0.22);      // contact shadow stays on the board
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

export const drawTiger = (ctx, x, y, r, opts = {}) => drawPiece('tiger', paintTiger, ctx, x, y, r, opts);
export const drawGoat = (ctx, x, y, r, opts = {}) => drawPiece('goat', paintGoat, ctx, x, y, r, opts);

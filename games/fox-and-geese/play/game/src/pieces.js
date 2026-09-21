// The two pieces: a realistic red fox head and a realistic white goose (head and neck), standing on the board with a
// soft shadow. They are painted once (fur, feathers and all) into a sprite and reused for every piece on the board.
// Reference space: 50 units = the base radius; origin near the centre of the head. Light: upper left.
// Rule for both (owner, from Tiger and Goat): heads only, no base or disc under them, never a mask or a sticker.
const TAU = Math.PI * 2;
const BOX = { x: -68, y: -98, w: 136, h: 170 }, SPRITE_SCALE = 4;

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

// Many short strokes: what makes it read as fur and not plastic. `inside` is tested against the current path.
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
// Fur that pokes out past the silhouette: strokes that start just inside the edge and run outwards.
function fuzz(ctx, rnd, n, box, inside, angle, color, len, width) {
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = box[0] + rnd() * (box[2] - box[0]), y = box[1] + rnd() * (box[3] - box[1]);
    if (!inside(x, y)) continue;
    const a = angle(x, y) + (rnd() - 0.5) * 0.5;
    if (inside(x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2)) continue;            // only near the edge
    const l = len * (0.7 + rnd() * 0.8);
    ctx.strokeStyle = color(x, y, rnd()); ctx.lineWidth = width * (0.6 + rnd() * 0.8);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
}
// A silhouette is a function that draws onto a path target. With Path2D it is a reusable shape (so the fur can ask
// "am I inside?" while it paints); without Path2D (headless tests) the same function draws on the context itself.
const mk = (fn) => { if (typeof Path2D === 'undefined') return null; const p = new Path2D(); fn(p); return p; };
const fillP = (ctx, P, fn) => { if (P) ctx.fill(P); else { ctx.beginPath(); fn(ctx); ctx.fill(); } };
const clipP = (ctx, P, fn) => { if (P) ctx.clip(P); else { ctx.beginPath(); fn(ctx); ctx.clip(); } };
const strokeP = (ctx, P, fn) => { if (P) ctx.stroke(P); else { ctx.beginPath(); fn(ctx); ctx.stroke(); } };
// isPointInPath takes canvas pixels, not the current units, so the point is pushed through the current transform first.
const insideP = (ctx, P) => (x, y) => { if (!P) return false; const m = ctx.getTransform(); return ctx.isPointInPath(P, m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f); };
// soft tufts: curve through the midpoints so the outline reads as fur, not cut paper
function tufts(ctx, pts) { for (let i = 0; i < pts.length - 1; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2); ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); }

// ---------------------------------------------------------------------------------------------
// Fox: a red fox's head from the front. Russet crown and bridge, white cheek ruff with pointed tufts, a narrow
// white muzzle with a black nose, black-backed tall ears with pale fur inside, slanted amber eyes with slit pupils
// and dark liners running down the nose. No outline: the tufted ruff is the silhouette.
// ---------------------------------------------------------------------------------------------
const RUFF = [[46, -8], [60, -3], [50, 3], [62, 13], [50, 16], [55, 27], [40, 29]];
function foxHead(ctx) {
  ctx.moveTo(0, -46);
  ctx.bezierCurveTo(13, -46, 26, -43, 34, -35); ctx.bezierCurveTo(41, -28, 44, -17, 46, -8);
  tufts(ctx, RUFF);
  ctx.bezierCurveTo(32, 38, 20, 51, 0, 53);
  ctx.bezierCurveTo(-20, 51, -32, 38, -40, 29);
  tufts(ctx, RUFF.slice().reverse().map(([x, y]) => [-x, y]));
  ctx.bezierCurveTo(-44, -17, -41, -28, -34, -35); ctx.bezierCurveTo(-26, -43, -13, -46, 0, -46); ctx.closePath();
}
// white where the cheeks and muzzle are, rust elsewhere (used to colour the fur strokes)
const foxWhite = (x, y) => {
  const ax = Math.abs(x);
  if (y > 26) return true;                                        // chin and throat
  if (ax < 7 + Math.max(0, (y - 6) * 0.15) && y < 22) return false; // the rust nose bridge
  if (y < -12) return false;                                      // forehead
  if (ax > 24 && y < -2) return false;                            // upper temples
  return true;                                                    // cheeks, muzzle sides
};
const foxAngle = (x, y) => Math.atan2(y + 44, x * 1.05);

function paintFox(ctx) {
  const rnd = lcg(5101), INK = '#0d0806';
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // ears: tall, pointed, set high; black behind, pale fluff inside, a dark rim
  for (const sx of [-1, 1]) {
    ctx.save(); ctx.scale(sx, 1);
    const earFn = (t) => { t.moveTo(8, -36); t.bezierCurveTo(14, -58, 26, -80, 38, -95); t.bezierCurveTo(46, -80, 51, -60, 47, -30); t.bezierCurveTo(38, -26, 22, -30, 8, -36); t.closePath(); }, EP = mk(earFn);
    const cupFn = (t) => { t.moveTo(14, -35); t.bezierCurveTo(18, -54, 27, -72, 37, -87); t.bezierCurveTo(42, -72, 44, -55, 42, -33); t.bezierCurveTo(34, -30, 22, -32, 14, -35); t.closePath(); }, CP = mk(cupFn);
    const g = ctx.createLinearGradient(20, -34, 40, -95); g.addColorStop(0, '#5a2a12'); g.addColorStop(0.55, '#231009'); g.addColorStop(1, '#0a0605');
    ctx.fillStyle = g; fillP(ctx, EP, earFn);
    // the inside of the ear: a smaller cup of cream fur, dark toward the base
    ctx.save(); clipP(ctx, EP, earFn);
    const ig = ctx.createLinearGradient(20, -36, 38, -88); ig.addColorStop(0, '#3a2416'); ig.addColorStop(0.4, '#a98a68'); ig.addColorStop(1, '#e8dcc6');
    ctx.fillStyle = ig; fillP(ctx, CP, cupFn);
    fur(ctx, rnd, 520, [12, -90, 46, -30], insideP(ctx, CP), () => -1.25, (x, y, r) => (r > 0.6 ? 'rgba(250,240,222,0.7)' : r > 0.25 ? 'rgba(190,160,124,0.55)' : 'rgba(70,44,28,0.5)'), 3.6, 0.55);
    ctx.restore();
    ctx.strokeStyle = 'rgba(8,4,2,0.55)'; ctx.lineWidth = 0.8; strokeP(ctx, EP, earFn);
    ctx.restore();
  }
  // the coat: no outline, the tufted ruff is the silhouette
  const hg = ctx.createRadialGradient(-10, -34, 3, 0, -8, 62);
  hg.addColorStop(0, '#e2853a'); hg.addColorStop(0.5, '#c25a1f'); hg.addColorStop(1, '#7c3410');
  const HP = mk(foxHead), inFox = insideP(ctx, HP);
  ctx.fillStyle = hg; fillP(ctx, HP, foxHead);
  ctx.save(); clipP(ctx, HP, foxHead);
  // white cheeks, muzzle and chin, painted as soft fields so the edge stays furry
  for (const sx of [-1, 1]) {
    soft(ctx, sx * 31, 12, 24, 22, '246,240,228', 0.98, sx * 0.3);
    soft(ctx, sx * 15, 24, 15, 16, '248,244,236', 0.98);
    soft(ctx, sx * 43, 10, 12, 12, '250,246,238', 0.9);
  }
  soft(ctx, 0, 38, 24, 14, '250,247,240', 1);
  soft(ctx, 0, 27, 12, 11, '250,246,238', 1);
  // the rust bridge and forehead laid back over the white, narrowing towards the nose
  ctx.beginPath(); ctx.moveTo(-24, -46); ctx.bezierCurveTo(-24, -24, -13, -6, -7.5, 20); ctx.lineTo(7.5, 20); ctx.bezierCurveTo(13, -6, 24, -24, 24, -46); ctx.closePath();
  const bg = ctx.createLinearGradient(0, -46, 0, 22); bg.addColorStop(0, 'rgba(190,84,28,0)'); bg.addColorStop(0.3, 'rgba(206,96,34,0.96)'); bg.addColorStop(1, 'rgba(228,122,54,0.92)');
  ctx.fillStyle = bg; ctx.fill();
  soft(ctx, 0, -28, 30, 18, '150,60,20', 0.55);                          // darker crown
  soft(ctx, 0, -16, 9, 26, '236,140,70', 0.55, 0);                       // light on the bridge
  for (const sx of [-1, 1]) { soft(ctx, sx * 30, -22, 12, 12, '160,66,22', 0.5); soft(ctx, sx * 19, -3, 7, 7, '120,50,16', 0.35); }
  // dark liners from each eye down the side of the muzzle, and the black lip corners
  for (const sx of [-1, 1]) {
    ctx.strokeStyle = 'rgba(30,14,8,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx * 11.5, -4); ctx.quadraticCurveTo(sx * 11, 6, sx * 9.5, 17); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,14,8,0.22)'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(sx * 11.5, -2); ctx.quadraticCurveTo(sx * 11.5, 7, sx * 10, 16); ctx.stroke();
  }
  // fur: strokes fan out from the crown; colour follows the zone
  fur(ctx, rnd, 7000, [-62, -48, 62, 56], inFox, foxAngle, (x, y, r) => foxWhite(x, y)
    ? (r > 0.5 ? 'rgba(255,254,250,0.6)' : r > 0.15 ? 'rgba(232,222,206,0.4)' : 'rgba(190,176,158,0.22)')
    : (r > 0.6 ? 'rgba(248,166,96,0.4)' : r > 0.25 ? 'rgba(120,48,14,0.3)' : 'rgba(210,108,44,0.32)'), 3.6, 0.5);
  // darker guard hairs on the crown
  fur(ctx, rnd, 320, [-30, -46, 30, -20], inFox, foxAngle, (x, y, r) => (r > 0.5 ? 'rgba(96,36,10,0.5)' : 'rgba(255,190,120,0.3)'), 5, 0.6);
  // the far (right) side falls into shade, the left cheek is lit
  soft(ctx, 34, 6, 30, 52, '24,10,2', 0.34);
  soft(ctx, -34, 4, 14, 26, '255,250,240', 0.16);
  soft(ctx, 0, 48, 34, 12, '40,24,16', 0.25);                            // under the chin
  ctx.restore();
  // fluffy edge
  fuzz(ctx, rnd, 1100, [-64, -48, 64, 56], inFox, foxAngle, (x, y, r) => (foxWhite(x, y) ? (r > 0.4 ? 'rgba(255,252,244,0.7)' : 'rgba(228,218,200,0.55)') : (r > 0.4 ? 'rgba(226,120,52,0.75)' : 'rgba(130,52,16,0.6)')), 2.6, 0.5);
  // eyes: slanted almond, amber, slit pupil, black liner running out to a point; a pale brow spot above
  for (const sx of [-1, 1]) {
    ctx.save(); ctx.translate(sx * 20, -13); ctx.scale(sx, 1);
    soft(ctx, 0, -1, 15, 9, '20,8,2', 0.5);                                // socket shade
    const eye = () => { ctx.beginPath(); ctx.moveTo(-9.2, 3.6); ctx.quadraticCurveTo(-1, -6.4, 10.4, -3.4); ctx.quadraticCurveTo(0.6, 5.6, -9.2, 3.6); ctx.closePath(); };
    ctx.save(); eye(); ctx.clip();
    const ig = ctx.createRadialGradient(-0.5, -1.6, 0.4, 0, 0, 8); ig.addColorStop(0, '#fbe08a'); ig.addColorStop(0.5, '#e0a020'); ig.addColorStop(1, '#8a5210');
    ctx.fillStyle = ig; ctx.fillRect(-11, -8, 22, 16);
    ctx.fillStyle = '#080402'; ctx.beginPath(); ctx.ellipse(0.4, -0.4, 1.7, 4.6, 0.12, 0, TAU); ctx.fill();          // the slit
    ctx.fillStyle = 'rgba(20,8,0,0.38)'; ctx.fillRect(-11, -8, 22, 4.2);                                             // lid shadow
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-2.4, -2.2, 1.15, 0, TAU); ctx.fill();
    ctx.restore();
    eye(); ctx.strokeStyle = '#100804'; ctx.lineWidth = 1.7; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10.4, -3.4); ctx.quadraticCurveTo(13, -5, 15.4, -6.6); ctx.stroke();                 // liner tail
    ctx.beginPath(); ctx.moveTo(-9.2, 3.6); ctx.quadraticCurveTo(-11, 6, -10.6, 9); ctx.lineWidth = 1.5; ctx.stroke();  // tear line start
    // brow
    ctx.fillStyle = 'rgba(250,236,212,0.75)'; ctx.beginPath(); ctx.ellipse(2, -11.6, 4.6, 1.5, -0.25, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // nose: black leather, glossy, with a split and a quiet mouth
  ctx.beginPath(); ctx.moveTo(-8.2, 17.6); ctx.quadraticCurveTo(0, 15, 8.2, 17.6); ctx.quadraticCurveTo(7.4, 25, 0.6, 27.4); ctx.quadraticCurveTo(-0.6, 27.4, -0.6, 27.4); ctx.quadraticCurveTo(-7.4, 25, -8.2, 17.6); ctx.closePath();
  const ng = ctx.createLinearGradient(-4, 16, 5, 28); ng.addColorStop(0, '#3a3634'); ng.addColorStop(0.4, '#151312'); ng.addColorStop(1, '#050404');
  ctx.fillStyle = ng; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(-2.6, 18.6, 3.2, 1.1, -0.15, 0, TAU); ctx.fill();
  ctx.fillStyle = '#000'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 3.7, 22.6, 1.9, 1.05, sx * 0.85, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = '#0d0806'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 26.6); ctx.lineTo(0, 32.4); ctx.moveTo(0, 32.4); ctx.quadraticCurveTo(-5.4, 35.2, -11, 31.6); ctx.moveTo(0, 32.4); ctx.quadraticCurveTo(5.4, 35.2, 11, 31.6); ctx.stroke();
  // whisker dots and a few fine whiskers
  ctx.fillStyle = 'rgba(30,18,12,0.85)';
  for (const sx of [-1, 1]) for (const [x, y] of [[9, 25], [12.5, 27.5], [8.5, 29], [13.5, 24], [10.5, 22.5]]) { ctx.beginPath(); ctx.arc(sx * x, y, 0.75, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 0.7;
  for (const sx of [-1, 1]) for (const [y0, y1, cx] of [[26, 24, 26], [28.5, 30, 28], [30.5, 35, 24]]) { ctx.beginPath(); ctx.moveTo(sx * 12, y0); ctx.quadraticCurveTo(sx * cx, y0 - 3, sx * 44, y1); ctx.stroke(); }
}

// ---------------------------------------------------------------------------------------------
// Goose: a white domestic goose in profile: sloping forehead, orange bill with a pale nail, a dark eye in a fine
// orange ring, and a long neck that curves down into soft breast feathers. Faces left; flipped for variety.
// ---------------------------------------------------------------------------------------------
// The neck is a tube of varying width along an S-shaped centre line (head at the top, breast at the bottom).
const NECK = { pts: [[2, -56], [4, -46], [10, -30], [10, -12], [2, 8], [-6, 26], [-8, 42], [-4, 54]], w: [15.5, 14.5, 11.5, 12.2, 15, 21, 29, 33] };
const NECK_S = (() => {                                            // samples: x, y, half-width, tangent angle
  const out = [], P = NECK.pts, n = P.length, at = (i) => P[Math.max(0, Math.min(n - 1, i))], wa = (i) => NECK.w[Math.max(0, Math.min(n - 1, i))];
  const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < 16; k++) {
    const t = k / 16;
    out.push({ x: cr(at(i - 1)[0], at(i)[0], at(i + 1)[0], at(i + 2)[0], t), y: cr(at(i - 1)[1], at(i)[1], at(i + 1)[1], at(i + 2)[1], t), w: cr(wa(i - 1), wa(i), wa(i + 1), wa(i + 2), t) });
  }
  out.push({ x: P[n - 1][0], y: P[n - 1][1], w: NECK.w[n - 1] });
  for (let i = 0; i < out.length; i++) { const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)]; out[i].a = Math.atan2(b.y - a.y, b.x - a.x); }
  // the last stretch is level with the board: the breast sits squarely, with no slant at the bottom
  const tail = 22; for (let i = out.length - tail; i < out.length; i++) { const f = (i - (out.length - tail)) / (tail - 1); out[i].a = out[i].a * (1 - f) + (Math.PI / 2) * f; }
  return out;
})();
function gooseNeck(ctx) {
  const L = [], R = [];
  for (const q of NECK_S) { const nx = -Math.sin(q.a), ny = Math.cos(q.a); L.push([q.x + nx * q.w, q.y + ny * q.w]); R.push([q.x - nx * q.w, q.y - ny * q.w]); }
  ctx.moveTo(L[0][0], L[0][1]);
  // the round top of the head, then down the right (back) side, round the breast, up the left (front) side
  const top = NECK_S[0]; for (let k = 0; k <= 14; k++) { const a = top.a + Math.PI / 2 + (k / 14) * Math.PI; ctx.lineTo(top.x + Math.cos(a) * top.w, top.y + Math.sin(a) * top.w); }
  for (const p of R) ctx.lineTo(p[0], p[1]);
  const r1 = R[R.length - 1], l1 = L[0 + L.length - 1];
  ctx.bezierCurveTo(r1[0] + 3, r1[1] + 15, l1[0] - 3, l1[1] + 15, l1[0], l1[1]);                // the soft round bottom of the breast
  for (let i = L.length - 2; i >= 0; i--) ctx.lineTo(L[i][0], L[i][1]);
  ctx.closePath();
}
// feathers lie along the neck: the angle of the nearest centre-line sample
const gooseAngle = (x, y) => { let best = 0, bd = 1e9; for (let i = 0; i < NECK_S.length; i += 2) { const q = NECK_S[i], d = (q.x - x) ** 2 + (q.y - y) ** 2; if (d < bd) { bd = d; best = q.a; } } return best;  };

function paintGoose(ctx) {
  const rnd = lcg(9203), INK = '#20140c';
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // the soft white body: cool grey in the shadow, warm white where the light falls
  const bg = ctx.createLinearGradient(-30, -70, 40, 60);
  bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.5, '#f1f3f6'); bg.addColorStop(1, '#c9d0dc');
  const GP = mk(gooseNeck), inG = insideP(ctx, GP);
  ctx.fillStyle = bg; fillP(ctx, GP, gooseNeck);
  ctx.save(); clipP(ctx, GP, gooseNeck);
  soft(ctx, 28, 0, 14, 62, '120,134,160', 0.45);                                    // the far side of the neck in shade
  soft(ctx, 18, 44, 44, 22, '120,134,160', 0.4);                                    // under the back
  soft(ctx, -8, 52, 40, 12, '150,164,188', 0.35);                                   // underside of the breast
  soft(ctx, -12, -20, 8, 30, '255,255,255', 0.85);                                  // light down the front of the neck
  soft(ctx, -6, -62, 12, 7, '255,255,255', 0.9);                                    // light on the crown
  soft(ctx, 20, -46, 8, 10, '150,164,190', 0.3);                                    // shade behind the head
  // neck feathers: fine downy strokes running down the neck; on the breast, overlapping scallops
  fur(ctx, rnd, 4200, [-52, -72, 52, 64], inG, gooseAngle, (x, y, r) => (r > 0.6 ? 'rgba(255,255,255,0.7)' : r > 0.25 ? 'rgba(214,222,234,0.45)' : 'rgba(160,174,200,0.28)'), 3.6, 0.55);
  for (let row = 0; row < 4; row++) for (let k = 0; k < 9; k++) {                   // breast feathers as scalloped arcs
    const x = -34 + k * 8.4 + (row % 2) * 4.2 + rnd() * 1.5, y = 34 + row * 6.4 + rnd() * 1.2;
    if (!inG(x, y) || !inG(x, y + 4)) continue;
    ctx.strokeStyle = `rgba(${150 + row * 4},${164 + row * 3},${190},${0.26 - row * 0.03})`; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(x, y, 5.4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(x, y - 1.3, 5.4, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  }
  ctx.restore();
  fuzz(ctx, rnd, 900, [-52, -72, 52, 64], inG, gooseAngle, (x, y, r) => (r > 0.4 ? 'rgba(255,255,255,0.85)' : 'rgba(208,216,230,0.7)'), 3.4, 0.55);
  // the bill: orange, deep at the base, a pale rounded nail; a dark mouth line and a lit ridge
  ctx.beginPath(); ctx.moveTo(-13, -63); ctx.bezierCurveTo(-24, -65, -38, -60, -47, -52); ctx.bezierCurveTo(-49, -50, -48, -47, -45, -46);
  ctx.bezierCurveTo(-37, -43, -26, -43, -15, -46); ctx.bezierCurveTo(-11, -52, -11, -58, -13, -63); ctx.closePath();
  const bl = ctx.createLinearGradient(-30, -64, -28, -43); bl.addColorStop(0, '#ffb238'); bl.addColorStop(0.55, '#f08a14'); bl.addColorStop(1, '#c2600a');
  ctx.fillStyle = bl; ctx.fill(); ctx.strokeStyle = 'rgba(96,40,4,0.7)'; ctx.lineWidth = 1.1; ctx.stroke();
  ctx.fillStyle = '#fff2d0'; ctx.beginPath(); ctx.ellipse(-46.5, -49, 2.3, 3.1, 0.7, 0, TAU); ctx.fill();               // the nail
  ctx.strokeStyle = 'rgba(70,28,4,0.85)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-14, -51); ctx.quadraticCurveTo(-30, -50, -44, -47.5); ctx.stroke();   // the mouth line
  ctx.strokeStyle = 'rgba(255,224,150,0.85)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-17, -62); ctx.quadraticCurveTo(-32, -62, -43, -54.4); ctx.stroke();  // the ridge
  ctx.fillStyle = 'rgba(90,34,2,0.8)'; ctx.beginPath(); ctx.ellipse(-31, -57.4, 3, 1.1, 0.05, 0, TAU); ctx.fill();              // nostril
  ctx.fillStyle = 'rgba(80,30,4,0.5)'; ctx.beginPath(); ctx.ellipse(-24, -46.4, 10, 1.6, 0.03, 0, TAU); ctx.fill();            // shade under the upper bill
  // the eye
  const ex = -3, ey = -55;
  ctx.fillStyle = '#e88a1c'; ctx.beginPath(); ctx.ellipse(ex, ey, 5.6, 5.1, 0, 0, TAU); ctx.fill();                 // the orange ring
  ctx.strokeStyle = 'rgba(120,52,6,0.8)'; ctx.lineWidth = 0.9; ctx.stroke();
  const eg = ctx.createRadialGradient(ex - 1, ey - 1.4, 0.4, ex, ey, 4.2); eg.addColorStop(0, '#5a6e86'); eg.addColorStop(0.4, '#1c2634'); eg.addColorStop(1, '#05070a');
  ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ex, ey, 3.9, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex - 1.5, ey - 1.7, 1.2, 0, TAU); ctx.fill();
  soft(ctx, ex + 1, ey - 4, 8, 3, '150,164,190', 0.5);                                                            // brow shade
}

// ---------------------------------------------------------------------------------------------
// Sprites and the public draw calls
// ---------------------------------------------------------------------------------------------
// Piece sets. 'classic' is the natural painting. 'dusk' is the same painting washed with cool evening light (a grey
// fox, a grey goose), made by laying a translucent colour over the finished sprite, so it costs one extra sprite.
export const SETS = { classic: null, dusk: { F: 'rgba(70,84,118,0.52)', G: 'rgba(96,108,136,0.4)' } };
export const SET_NAMES = { classic: 'Classic', dusk: 'Dusk' };
const sprites = {};
function sprite(kind, paint, set = 'classic') {
  const key = kind + '-' + set;
  if (key in sprites) return sprites[key];
  sprites[key] = null;
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const c = new OffscreenCanvas(BOX.w * SPRITE_SCALE, BOX.h * SPRITE_SCALE), sctx = c.getContext('2d');
      sctx.scale(SPRITE_SCALE, SPRITE_SCALE); sctx.translate(-BOX.x, -BOX.y); paint(sctx);
      const tint = SETS[set]?.[kind === 'fox' ? 'F' : 'G'];
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

// opts: { selected, dim, lift (0..1: raised off the board), threat, flip (goose faces right), set }
function drawPiece(kind, paint, ctx, x, y, r, opts) {
  const lift = opts.lift ?? 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(r / 50, r / 50);
  if (opts.dim) ctx.globalAlpha *= 0.45;
  if (opts.selected) blob(ctx, 0, 40, 74, 26, '255,236,150', 0.9);
  blob(ctx, kind === 'goose' ? 4 : 8, 52, 56 - lift * 8, 16 - lift * 4, '0,0,0', 0.55 - lift * 0.22);      // contact shadow stays on the board
  ctx.translate(0, -lift * 24);
  if (opts.flip) ctx.scale(-1, 1);
  const s = sprite(kind, paint, opts.set);
  if (s) ctx.drawImage(s, BOX.x, BOX.y, BOX.w, BOX.h); else paint(ctx);
  if (opts.flip) ctx.scale(-1, 1);
  if (opts.threat) {
    ctx.fillStyle = '#e5342a'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(38, -60, 9, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(36.5, -66, 3, 8); ctx.fillRect(36.5, -56.5, 3, 3);
  }
  ctx.restore();
}

export const drawFox = (ctx, x, y, r, opts = {}) => drawPiece('fox', paintFox, ctx, x, y, r, opts);
export const drawGoose = (ctx, x, y, r, opts = {}) => drawPiece('goose', paintGoose, ctx, x, y, r, opts);

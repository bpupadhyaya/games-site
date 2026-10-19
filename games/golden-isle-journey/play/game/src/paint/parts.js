// Body parts in painted relief (see relief.js). Each part is drawn ONCE into a cached sprite, in its own local
// space with the pivot at the joint: torso (pivot hip centre, extends up to -T, 3/4 view facing +x), arms and legs
// (pivot shoulder/elbow/hip/knee, hanging down +y), foot (pivot ankle, toes toward +x), wrap (pivot waist).
// A spec `s` (looks.js) sets the build: T, hw, sw, leg, arm, legW, armW, muscle, fem, skin | fur, jewels, cloth...
import { TAU, mix, lighten, darken, rgba, lin, rad, pearl, gem, rosette, beads, flower } from './kit.js';
import { relief, furCoat, insideOf, fillShapes, hash1 } from './sculpt.js';
import { furCols } from './vanarahead.js';

const isFur = (s) => !!s.fur;
const GOLD = '#e2a93c', GOLD_D = '#a8741c', GOLD_L = '#f6d478';
const bodyFur = (f) => [darken(f, 0.16), darken(f, 0.04), lighten(f, 0.1), lighten(f, 0.24)];
const handSkin = (s) => (isFur(s) ? s.face ?? '#d9a084' : s.skin);

// Paint a body surface: fur coat (directional strokes) or skin with soft colour shifts.
function surface(c, s, shapes, box, o = {}) {
  if (isFur(s)) {
    const cols = bodyFur(s.fur);
    fillShapes(c, shapes, darken(s.fur, 0.06));
    furCoat(c, { box, inside: insideOf(shapes), n: (o.n ?? 1600) * (s.silky ? 2.4 : 1.4), len: (o.len ?? 2.3) * (s.silky ? 0.75 : 1), wid: s.silky ? 0.2 : 0.3, seed: o.seed ?? 3, jitter: s.silky ? 0.13 : 0.22, tuft: s.silky ? 0 : 0.04, cols, flow: o.flow ?? (() => Math.PI / 2) });
  } else {
    fillShapes(c, shapes, s.skin);
    if (o.tint) o.tint(c);
  }
}
const glow = (c, x, y, r, col, a) => { c.fillStyle = rad(c, x, y, 0, r, [[0, rgba(col, a)], [1, rgba(col, 0)]]); c.fillRect(x - r, y - r, r * 2, r * 2); };
// soft contact shadow under whatever `fn` draws (the drawing itself is expected to be painted over afterwards)
export function shadowed(g, fn, blurU = 1.6, dy = 1.2, col = 'rgba(40,10,8,0.55)') {
  if (!g._sp || !g._sp.make) return;
  const M = g.getTransform(), k = Math.sqrt(Math.abs(M.a * M.d - M.b * M.c));
  g.save(); g.setTransform(M.a, M.b, M.c, M.d, M.e - 20000, M.f); g.shadowColor = col; g.shadowBlur = blurU * k; g.shadowOffsetY = dy * k; g.shadowOffsetX = 20000 - 0.5 * k; fn(g); g.restore();
}
// a gold band across a limb or body at y: half-width w, thickness t, beaded
export function goldBand(g, y, w, t, o = {}) {
  const cv = o.curve ?? 0.8;
  relief(g, { mat: 'gold', inflate: t * 0.6, depth: t * 0.6, bump: 1.2, aoR: 1.5,
    paint(c) { c.fillStyle = GOLD; c.beginPath(); c.moveTo(-w, y - t / 2 - cv); c.quadraticCurveTo(0, y - t / 2 + cv, w, y - t / 2 - cv); c.lineTo(w, y + t / 2 - cv); c.quadraticCurveTo(0, y + t / 2 + cv, -w, y + t / 2 - cv); c.closePath(); c.fill();
      c.fillStyle = GOLD_L; const n = Math.max(3, Math.round(w * 1.1)); for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, x = -w + u * w * 2; c.beginPath(); c.arc(x, y + cv * (1 - 4 * (u - 0.5) * (u - 0.5)) - cv, t * 0.2, 0, TAU); c.fill(); } } });
}

// ---------------- torso ----------------
export function torso(ctx, s) {
  const T = s.T, hw = s.hw, sw = s.sw, fem = !!s.fem, mus = s.muscle ?? 0.6, cx = 2.2, swf = sw * 0.93, jew = s.jewels ?? 0;
  const path = (c) => {
    c.beginPath(); c.moveTo(-hw, 4);
    c.bezierCurveTo(-hw - (fem ? 2 : 0.5), -T * 0.12, -hw + (fem ? 3.5 : 0.5), -T * 0.26, -hw + (fem ? 2.5 : -0.5), -T * 0.34);
    c.bezierCurveTo(-hw - 1, -T * 0.5, -sw + 3, -T * 0.56, -sw + 2.5, -T + 17);
    c.bezierCurveTo(-sw - 1, -T + 10, -sw + 1, -T + 3, -sw + 7, -T + 1.5);
    c.bezierCurveTo(-sw * 0.5, -T - 1, -9, -T - 4, -6.4, -T - 9); c.lineTo(-5.6, -T - 13); c.lineTo(7.6, -T - 13); c.lineTo(8.4, -T - 9);
    c.bezierCurveTo(10, -T - 4, swf * 0.5, -T - 1, swf - 6, -T + 1.5);
    c.bezierCurveTo(swf - 0.5, -T + 3, swf + 1, -T + 10, swf - 2, -T + 17);
    c.bezierCurveTo(swf - 2.5, -T * 0.56, hw + 1.5, -T * 0.5, hw + (fem ? -0.5 : 1), -T * 0.34);
    c.bezierCurveTo(hw - (fem ? 3 : 1), -T * 0.26, hw + (fem ? 2.5 : 1), -T * 0.12, hw + 0.5, 4); c.quadraticCurveTo(0, 8, -hw, 4); c.closePath();
  };
  const py = -T + 25, blobs = fem ? [
    { x: -sw * 0.3 + cx, y: py + 1, rx: sw * 0.42, ry: 9, z: 3 }, { x: sw * 0.42 + cx, y: py + 1, rx: sw * 0.36, ry: 8.6, z: 2.6 },
    { x: -9, y: -T - 1, rx: 8, ry: 5, z: 1 }, { x: cx, y: -T * 0.3, rx: hw * 0.8, ry: 9, z: 1 },
  ] : [
    // pec plate: one broad, flat-topped muscular mass across the upper chest (NOT two round separate domes -
    // rx is wide, ry is shallow, so the two halves read as one continuous plate that just meets near the sternum).
    { x: -sw * 0.46 + cx, y: py - 3, rx: sw * 0.56, ry: 8, rot: -0.06, z: 1.7 + 2.3 * mus }, { x: sw * 0.5 + cx, y: py - 3, rx: sw * 0.5, ry: 7.6, rot: 0.06, z: 1.6 + 2.1 * mus },
    // sternum: a thin subtle groove only (no lower "sag" crease, no deep valley splitting the pec into two masses)
    { cap: [cx, -T + 14, 1.0, cx, py + 12, 0.7], z: -0.5 * mus },
    ...[0, 1, 2].flatMap((i) => [-1, 1].map((d) => ({ x: cx + d * (5 - i * 0.3), y: py + 19 + i * (T - 44) / 3.4, rx: 4.9, ry: (T - 44) / 7, z: 2.6 * mus }))),
    { x: -hw + 1.5, y: -T * 0.27, rx: 5, ry: T * 0.17, z: 1.4 * mus }, { x: hw - 1, y: -T * 0.27, rx: 4.6, ry: T * 0.17, z: 1.3 * mus },
    ...[0, 1, 2].map((i) => ({ cap: [-sw * 0.74 + i, py + 14 + i * 5.5, 1.6, -sw * 0.4 + i, py + 17 + i * 5.5, 1.2], z: 0.7 * mus })),
    { cap: [cx + 1, -T + 5.5, 1.5, -sw * 0.78, -T + 7, 1.7], z: 1.2 }, { cap: [cx + 3, -T + 5.5, 1.5, swf * 0.8, -T + 7, 1.7], z: 1.1 },
    { x: -10, y: -T - 1, rx: 9, ry: 5.5, z: 1.4 + mus }, { x: 12, y: -T - 1, rx: 8, ry: 5, z: 1.2 + mus },
    { x: -sw * 0.74, y: -T + 9, rx: 9.5, ry: 9.5, z: 2.4 }, { x: swf * 0.74, y: -T + 9, rx: 9, ry: 9, z: 2.2 },
    { x: cx + 0.5, y: -9.5, rx: 1.1, ry: 1.5, z: -1.2 },
  ];
  relief(ctx, {
    mat: isFur(s) ? 'fur' : 'skin', inflate: fem ? 9 : 11, depth: fem ? 8 : 11, bump: isFur(s) ? (s.silky ? 0.25 : 0.5) : 0, blobs, aoR: 4,
    paint(c) {
      if (isFur(s)) {
        path(c); c.save(); c.clip(); c.fillStyle = darken(s.fur, 0.06); c.fillRect(-sw - 4, -T - 16, sw * 2 + 8, T + 26);
        const cols = bodyFur(s.fur), cc = bodyFur(s.ruff ?? mix(s.fur, '#fff1d6', 0.7));
        furCoat(c, { box: [-sw - 2, -T - 14, sw + 2, 8], n: s.silky ? 14000 : 8000, len: s.silky ? 1.8 : 2.4, wid: s.silky ? 0.2 : 0.3, seed: 7, jitter: s.silky ? 0.13 : 0.22, tuft: s.silky ? 0 : 0.04, cols,
          flow: (x, y) => Math.PI / 2 + (x - cx) * 0.012 * (y < -T * 0.5 ? 1 : -0.4),
          colAt: (x, y, L, r) => mix(cols[L], cc[L], Math.max(0, Math.min(0.75, 0.95 - Math.hypot((x - cx) / (sw * 0.4), (y + T * 0.95) / (T * 0.34)) + (r - 0.5) * 0.3))) });
        c.globalCompositeOperation = 'source-atop'; c.fillStyle = lin(c, -sw, 0, sw, 0, [[0, 'rgba(90,40,10,0.4)'], [0.3, 'rgba(90,40,10,0)'], [0.75, 'rgba(90,40,10,0)'], [1, 'rgba(90,40,10,0.35)']]); c.fillRect(-sw - 4, -T - 16, sw * 2 + 8, T + 26);
        c.fillStyle = lin(c, 0, -T * 0.4, 0, 6, [[0, 'rgba(110,50,14,0)'], [1, 'rgba(110,50,14,0.3)']]); c.fillRect(-sw - 4, -T * 0.4, sw * 2 + 8, T); c.globalCompositeOperation = 'source-over';
        c.restore();
      } else {
        path(c); c.fillStyle = s.skin; c.fill(); c.save(); path(c); c.clip();
        glow(c, cx, -T * 0.55, sw * 1.1, lighten(s.skin, 0.12), 0.5); glow(c, -sw * 0.74, -T + 9, 10, mix(s.skin, '#c05a48', 0.35), 0.35); glow(c, swf * 0.74, -T + 9, 10, mix(s.skin, '#c05a48', 0.35), 0.3);
        if (!fem && s.chest !== 'cloth') for (const x of [-sw * 0.34 + cx, sw * 0.4 + cx]) { c.fillStyle = rgba(mix(s.skin, '#6a2a20', 0.5), 0.65); c.beginPath(); c.ellipse(x, py + 1, 1.25, 1.0, 0, 0, TAU); c.fill(); }
        c.restore();
      }
    },
  });
  if (s.chest === 'choli' || s.chest === 'cloth') {
    const col = s.top ?? s.cloth ?? '#c0303a', low = s.chest === 'cloth' ? -T * 0.22 : -T * 0.46;
    relief(ctx, { mat: 'silk', inflate: 8, depth: 8, blobs: blobs.slice(0, 2).map((b) => ({ ...b, z: b.z * 0.9 })),
      heightFn: (x, y) => Math.sin(x * 0.9 + y * 0.35) * 0.18,
      paint(c) { c.save(); path(c); c.clip(); c.fillStyle = col; c.beginPath(); c.moveTo(-sw - 3, -T + 2); c.quadraticCurveTo(cx, -T + (fem ? 9 : 3), sw + 3, -T + 2); c.lineTo(sw + 3, low); c.quadraticCurveTo(cx, low + 5, -sw - 3, low); c.closePath(); c.fill();
        c.fillStyle = GOLD; c.beginPath(); c.moveTo(-sw - 3, low - 3.4); c.quadraticCurveTo(cx, low + 1.6, sw + 3, low - 3.4); c.lineTo(sw + 3, low); c.quadraticCurveTo(cx, low + 5, -sw - 3, low); c.fill();
        c.fillStyle = GOLD_L; for (let i = 0; i < 14; i++) { const u = (i + 0.5) / 14, x = -sw + u * sw * 2; c.beginPath(); c.arc(x, low - 1.6 + 5 * (1 - 4 * (u - 0.5) * (u - 0.5)) * 0.9, 0.7, 0, TAU); c.fill(); }
        if (s.motif) { c.fillStyle = s.motif; for (let r = 0; r < 4; r++) for (let k = -3; k <= 3; k++) { c.beginPath(); c.arc(cx + k * 6 + (r % 2) * 3, -T + 10 + r * 6, 0.7, 0, TAU); c.fill(); } }
        c.restore(); } });
  }
  if (s.armour) {
    // no chest blobs here: a banded cuirass reads as armour plates wrapping a cylinder, not a muscled
    // torso underneath, so it keeps only the pillow-round inflate (uniform) plus its own horizontal bands.
    relief(ctx, { mat: 'iron', inflate: 9, depth: 9, bump: 1,
      paint(c) { c.save(); path(c); c.clip(); c.fillStyle = '#4a4048'; c.fillRect(-sw - 3, -T + 1, sw * 2 + 6, T - 5);
        c.strokeStyle = '#2a2228'; c.lineWidth = 0.7; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-sw, -T * 0.78 + i * 8); c.quadraticCurveTo(cx, -T * 0.78 + i * 8 + 4, sw, -T * 0.78 + i * 8); c.stroke(); }
        c.fillStyle = GOLD; c.fillRect(-sw - 3, -T + 1, sw * 2 + 6, 3); c.fillRect(-sw - 3, -9, sw * 2 + 6, 3); c.restore(); },
      over(g) { gem(g, cx, -T * 0.58, 3, s.armGem ?? '#e8b030'); for (const d of [-1, 1]) for (let i = 0; i < 3; i++) pearl(g, cx + d * (sw - 7 - i * 1.5), -T + 9 + i * 9, 1.1); } });
  }
  if (s.sash) sash(ctx, s, path);
  if (s.collar) collar(ctx, s, cx);
  else if (jew > 0 && !s.armour) necklaces(ctx, s, cx, jew);
  if (s.garland) garland(ctx, s, cx);
  belt(ctx, s, cx);
}

function sash(ctx, s, path) { // diagonal shoulder cloth with a brocade border, soft folds along its length
  const T = s.T, sw = s.sw, hw = s.hw, col = s.sash, x0 = -sw + 5, y0 = -T + 1, x1 = hw + 1, y1 = -3, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, w = s.sashW ?? 8.5;
  relief(ctx, { mat: 'silk', inflate: 3, depth: 2.4, bump: 1,
    heightFn: (x, y) => { const d = (x - x0) * nx + (y - y0) * ny; return Math.sin(d * 1.3) * 0.5 + Math.sin(d * 2.9 + 1) * 0.2; },
    paint(c) { c.save(); path(c); c.clip();
      c.beginPath(); c.moveTo(x0 + nx * w, y0 + ny * w); c.quadraticCurveTo((x0 + x1) / 2 + nx * w - 3, (y0 + y1) / 2 + ny * w, x1 + nx * w * 0.55, y1 + ny * w * 0.55); c.lineTo(x1 - nx * w * 0.55, y1 - ny * w * 0.55); c.quadraticCurveTo((x0 + x1) / 2 - nx * w - 3, (y0 + y1) / 2 - ny * w, x0 - nx * w, y0 - ny * w); c.closePath(); c.fillStyle = col; c.fill();
      for (const o of [-1, 1]) { c.strokeStyle = GOLD; c.lineWidth = 2; c.beginPath(); c.moveTo(x0 + nx * w * o * 0.84, y0 + ny * w * o * 0.84); c.quadraticCurveTo((x0 + x1) / 2 + nx * w * o * 0.84 - 3, (y0 + y1) / 2 + ny * w * o * 0.84, x1 + nx * w * o * 0.46, y1 + ny * w * o * 0.46); c.stroke(); }
      c.fillStyle = GOLD_L; for (let i = 1; i < 12; i++) { const u = i / 12; c.beginPath(); c.arc(x0 + dx * u - 2.4 * Math.sin(u * 3), y0 + dy * u, 0.8, 0, TAU); c.fill(); }
      c.restore(); } });
}

function necklaces(ctx, s, cx, jew) {
  const n0 = -s.T - 1, R = '#d8283a', G = '#1fa872';
  const strands = (g) => {
    beads(g, cx - 10, n0 + 1, cx, n0 + 11, cx + 10, n0 + 1, 12, 1.05, ['pearl']);
    if (jew > 1) beads(g, cx - 14, n0 + 2, cx, n0 + 24, cx + 14, n0 + 2, 17, 1.2, ['pearl', 'pearl', G, 'pearl', 'pearl', R]);
    if (jew > 2) { beads(g, cx - 17, n0 + 3, cx, n0 + 36, cx + 17, n0 + 3, 21, 1.35, [R, 'pearl', G, 'pearl']); beads(g, cx - 18.5, n0 + 4, cx + 1, n0 + 66, cx + 18.5, n0 + 4, 30, 1.1, ['pearl', 'pearl', 'pearl', R]); }
  };
  shadowed(ctx, strands, 1.4, 1.1); strands(ctx);
  if (jew > 1) {
    relief(ctx, { mat: 'gold', inflate: 1.4, depth: 1.2, bump: 1.4, aoR: 1.5, paint(c) { c.fillStyle = GOLD; c.beginPath(); c.moveTo(cx - 9.5, n0 - 2); c.quadraticCurveTo(cx, n0 + 5.5, cx + 9.5, n0 - 2); c.lineTo(cx + 9, n0 + 1.4); c.quadraticCurveTo(cx, n0 + 10.5, cx - 9, n0 + 1.4); c.closePath(); c.fill(); c.fillStyle = GOLD_L; for (let i = 0; i < 9; i++) { const u = (i + 0.5) / 9; c.beginPath(); c.arc(cx - 9 + u * 18, n0 + 0.2 + Math.sin(u * Math.PI) * 5.2, 0.6, 0, TAU); c.fill(); } } });
    gem(ctx, cx, n0 + 6.2, 1.7, s.bandGem ?? G);
  }
  if (jew > 2) { rosette(ctx, cx, n0 + 20.5, 3.6, G, 6); rosette(ctx, cx + 0.5, n0 + 36, 4.4, R, 8); gem(ctx, cx + 0.5, n0 + 42.6, 1.9, G); pearl(ctx, cx + 0.5, n0 + 46.4, 1.5); }
}

function collar(ctx, s, cx) { // broad jewelled gold collar-breastplate
  const n0 = -s.T, sw = s.sw;
  const shape = (c) => { c.beginPath(); c.moveTo(-sw * 0.86, n0 + 2); c.quadraticCurveTo(cx, n0 - 3, sw * 0.82, n0 + 2); c.bezierCurveTo(sw * 0.74, n0 + 20, sw * 0.3, n0 + 34, cx, n0 + 46); c.bezierCurveTo(-sw * 0.3, n0 + 34, -sw * 0.78, n0 + 20, -sw * 0.86, n0 + 2); c.closePath(); };
  shadowed(ctx, (g) => { shape(g); g.fillStyle = '#000'; g.fill(); }, 2.4, 1.6);
  relief(ctx, { mat: 'gold', inflate: 4, depth: 2.6, bump: 1.8, aoR: 2,
    paint(c) { shape(c); c.fillStyle = GOLD; c.fill(); c.save(); shape(c); c.clip();
      for (let r = 0; r < 4; r++) { c.strokeStyle = r % 2 ? GOLD_D : GOLD_L; c.lineWidth = r % 2 ? 0.6 : 1.1; c.beginPath(); c.moveTo(-sw, n0 + 7 + r * 7); c.quadraticCurveTo(cx, n0 + 22 + r * 10, sw, n0 + 7 + r * 7); c.stroke(); }
      c.fillStyle = GOLD_L; for (let r = 0; r < 3; r++) for (let i = 0; i < 16; i++) { const u = (i + 0.5) / 16, x = -sw * 0.8 + u * sw * 1.6; c.beginPath(); c.arc(x, n0 + 10.5 + r * 7 + Math.sin(u * Math.PI) * (7.5 + r * 5), 0.7, 0, TAU); c.fill(); }
      c.restore(); },
    over(g) { for (let i = 0; i < 9; i++) { const u = (i + 0.5) / 9, x = -sw * 0.7 + u * sw * 1.4; gem(g, x, n0 + 7 + Math.sin(u * Math.PI) * 10, 1.9, i % 2 ? '#d8283a' : '#1fa872'); } rosette(g, cx, n0 + 32, 5, '#d8283a', 8); gem(g, cx, n0 + 41, 2, '#1fa872'); pearl(g, cx, n0 + 46.5, 1.7); } });
}

function garland(ctx, s, cx) { // white blossoms with pink roses, hanging from the shoulders to the waist
  const T = s.T, sw = s.sw, P = [[-sw * 0.5, -T + 1], [-sw * 0.62, -T * 0.5], [cx, -5], [sw * 0.6, -T * 0.5], [sw * 0.46, -T + 1]], pts = [];
  for (let i = 0; i <= 44; i++) { const u = i / 44, seg = Math.min(1, Math.floor(u * 2)), v = u * 2 - seg, [a, b, d] = [P[seg * 2], P[seg * 2 + 1], P[seg * 2 + 2]]; pts.push([(1 - v) * (1 - v) * a[0] + 2 * (1 - v) * v * b[0] + v * v * d[0], (1 - v) * (1 - v) * a[1] + 2 * (1 - v) * v * b[1] + v * v * d[1]]); }
  shadowed(ctx, (g) => { g.strokeStyle = '#000'; g.lineWidth = 5; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); }, 2.2, 1.6, 'rgba(40,10,8,0.5)');
  relief(ctx, { mat: 'cloth', inflate: 2.6, depth: 2.4, bump: 2.6, aoR: 1.5,
    paint(c) { pts.forEach(([x, y], i) => { const rose = i % 7 === 3; if (rose) { c.fillStyle = '#d8527a'; c.beginPath(); c.arc(x, y, 2.9, 0, TAU); c.fill(); c.strokeStyle = '#f4a0b8'; c.lineWidth = 0.5; for (let q = 0; q < 3; q++) { c.beginPath(); c.arc(x, y, 0.7 + q * 0.8, q * 2, q * 2 + 4); c.stroke(); } c.fillStyle = '#3f8a3a'; c.beginPath(); c.ellipse(x - 2.6, y + 1.8, 1.6, 0.8, 0.6, 0, TAU); c.fill(); } else for (let k = 0; k < 3; k++) { const a = hash1(i * 3.3 + k) * TAU; flower(c, x + Math.cos(a) * 1.5, y + Math.sin(a) * 1.5, 2.3, k % 2 ? '#fffaf0' : '#f2ead8', '#e8c850'); } }); } });
}

function belt(ctx, s, cx) {
  const bw = s.hw + 1.6;
  if (s.beltCol) { relief(ctx, { mat: 'silk', inflate: 2.4, depth: 2, heightFn: (x) => Math.sin(x * 1.4) * 0.3, paint(c) { c.fillStyle = s.beltCol; c.beginPath(); c.moveTo(-bw, -7); c.quadraticCurveTo(0, -4.4, bw, -7); c.lineTo(bw, 1.5); c.quadraticCurveTo(0, 4.2, -bw, 1.5); c.closePath(); c.fill(); } }); return; }
  goldBand(ctx, -2.6, bw, 7.4, { curve: -1.3 });
  for (let i = -2; i <= 2; i++) gem(ctx, cx + i * (bw * 0.4), -1.6 - Math.abs(i) * 0.35, i === 0 ? 2.3 : 1.3, i === 0 ? '#d8283a' : '#1fa872');
}

// ---------------- limbs ----------------
export function armUpper(ctx, s) {
  const A = s.arm[0], aw = s.armW ?? 14, mus = s.muscle ?? 0.5, fem = !!s.fem;
  const shapes = [{ x: 0, y: 3.5, rx: aw * (fem ? 0.5 : 0.62), ry: 9 }, { cap: [0, 3, aw * (fem ? 0.44 : 0.53), 0, A + 4, aw * 0.37] }];
  relief(ctx, { mat: isFur(s) ? 'fur' : 'skin', inflate: aw * 0.5, depth: aw * 0.5, bump: isFur(s) ? 0.5 : 0, aoR: 3,
    blobs: [{ x: aw * 0.1, y: A * 0.5, rx: aw * 0.42, ry: A * 0.3, z: 0.8 + 3.2 * mus }, { x: -aw * 0.22, y: A * 0.46, rx: aw * 0.3, ry: A * 0.34, z: 0.5 + 1.8 * mus }, { x: 0, y: 5, rx: aw * 0.56, ry: 8.5, z: 1.2 + 2.6 * mus }, { cap: [-aw * 0.1, 12, 1.2, aw * 0.06, A * 0.3, 1], z: -0.7 * mus }],
    paint(c) { surface(c, s, shapes, [-aw, -8, aw, A + 8], { n: 1500, seed: 13, flow: (x) => Math.PI / 2 - x * 0.02, tint: (cc) => glow(cc, 0, 3, 8, mix(s.skin ?? '#000000', '#c05a48', 0.35), 0.3) }); } });
  if ((s.jewels ?? 0) >= 2 || (isFur(s) && s.jewels)) {
    const y = A * 0.44, w = aw * 0.5;
    shadowed(ctx, (g) => { g.fillStyle = '#000'; g.fillRect(-w, y - 3, w * 2, 6.6); }, 1.2, 1);
    goldBand(ctx, y, w + 0.4, 6.4, { curve: 0.9 });
    for (let i = 0; i < 6; i++) { const u = (i + 0.5) / 6, x = -w + u * w * 2, cy = 0.9 * (1 - 4 * (u - 0.5) * (u - 0.5)) - 0.9; pearl(ctx, x, y - 3.6 + cy, 0.75); pearl(ctx, x, y + 3.6 + cy, 0.75); }
    rosette(ctx, 0.6, y, 3.9, s.bandGem ?? '#d8283a', 8); gem(ctx, 0.6, y + 6.4, 1.2, '#1fa872'); pearl(ctx, 0.6, y + 9, 0.9);
  }
}
export function armLower(ctx, s) {
  const A = s.arm[1], aw = (s.armW ?? 14) * 0.82, mus = s.muscle ?? 0.5;
  const shapes = [{ cap: [0, -7, aw * 0.44, 0, A * 0.3, aw * 0.5] }, { cap: [0, A * 0.3, aw * 0.5, 0, A, aw * 0.29] }];
  relief(ctx, { alphaFn: (x, y) => (y + 6) / 5, mat: isFur(s) ? 'fur' : 'skin', inflate: aw * 0.5, depth: aw * 0.5, bump: isFur(s) ? 0.5 : 0, aoR: 3,
    blobs: [{ x: aw * 0.12, y: A * 0.26, rx: aw * 0.4, ry: A * 0.24, z: 0.5 + 1.4 * mus }, { x: 0, y: 0.5, rx: aw * 0.4, ry: 4, z: 0.8 }],
    paint(c) { surface(c, s, shapes, [-aw, -6, aw, A + 3], { n: 1300, seed: 17, flow: (x) => Math.PI / 2 - x * 0.02 }); } });
  // the hand itself is a separate part (see `hand()` below) so it can be posed with its own wrist joint
  const jew = s.jewels ?? 0;
  if (jew >= 1) { const w = aw * 0.33, n = jew >= 3 ? 4 : 2; shadowed(ctx, (g) => { g.fillStyle = '#000'; g.fillRect(-w, A - 4 - n * 2.3, w * 2, n * 2.3); }, 1, 0.8);
    for (let i = 0; i < n; i++) goldBand(ctx, A - 3.4 - i * 2.4, w + 0.7 + (i === 0 ? 0.5 : 0), 2.3, { curve: 0.6 });
    if (s.beadBracelet) for (let i = 0; i < 7; i++) { const u = (i + 0.5) / 7, bx = -w + u * w * 2, by = A - 4 - n * 2.4 + Math.sin(u * Math.PI) * 0.7; ctx.fillStyle = rad(ctx, bx, by, 0, 1.2, [[0, '#8a6a5a'], [0.5, '#2a1410'], [1, '#0c0404']], bx - 0.3, by - 0.4); ctx.beginPath(); ctx.arc(bx, by, 1.15, 0, TAU); ctx.fill(); } }
}
// ---------------- hand ----------------
// A relief-sculpted hand, posed independently of the forearm (its own wrist joint - see rig.js `arm()`).
// Local space: the wrist is (0,0), the hand hangs toward +y (same "hanging down" convention as the arm above
// it). hp picks the shape: 'relaxed' (soft natural rest curl, cascading index->pinky), 'grip' (wrapped around
// a held shaft, thumb wraps the other way), 'open' (presenting/offering, fingers near straight) or 'point'
// (index extended, the rest curled). Each finger is three tapered capsule segments with two knuckle bends -
// never a single rigid rod - and the thumb sits at its own base angle, clearly not parallel to the fingers.
const curlFor = (hp, i) => {
  if (hp === 'point') return i === 0 ? [0.03, 0.03, 0.02] : [0.55, 0.6, 0.55];
  if (hp === 'grip') { const g = [0.82, 0.95, 0.95, 0.88][i]; return [g, g * 1.05, g * 1.05]; } // wrapped fairly evenly around a shaft
  const base = [0.11, 0.17, 0.23, 0.31][i]; // cascading rest curl: index straightest, pinky most curled
  const mul = hp === 'open' ? 0.18 : 1;
  return [base * mul, base * 1.15 * mul, base * 1.3 * mul];
};
export function hand(ctx, s, hp = 'relaxed', k = 1) {
  const hs = handSkin(s);
  // A human palm is a substantial, roughly-trapezoidal mass: about as wide (at the knuckle line) as it is
  // long, narrowing only moderately to the wrist (never pinching to a point) so it stays proportionate to
  // the forearm's own end width (~3.3*k radius - see armLower). wristW/kW are HALF-widths.
  const palmLen = 5 * k, wristW = 2.6 * k, kW = 3.6 * k;
  // fingers root well inside the knuckle line (their total span is clearly narrower than the palm itself,
  // so they read as attached to a mass, not radiating past its edges), are only 60-75% of the palm's own
  // length (never as long as or longer than the palm), and taper mildly - never down to a spider-leg point.
  const FINGERS = [-2.35, -0.8, 0.8, 2.3].map((x, i) => ({
    x: x * k, fan: [-0.12, -0.04, 0.05, 0.15][i], curl: curlFor(hp, i),
    len: [0.66, 0.76, 0.71, 0.6][i] * palmLen, wid: [0.72, 0.82, 0.76, 0.62][i] * k,
  }));
  const caps = [];
  for (const f of FINGERS) {
    let x = f.x, y = palmLen, a = f.fan;
    for (let j = 0; j < 3; j++) {
      const l = f.len * [0.4, 0.34, 0.26][j], r0 = f.wid * (1 - j * 0.16), r1 = f.wid * (1 - (j + 1) * 0.16);
      a += f.curl[j];
      const nx = x + Math.sin(a) * l, ny = y + Math.cos(a) * l;
      caps.push({ cap: [x, y, r0, nx, ny, r1], z: (0.5 - j * 0.06) * k });
      x = nx; y = ny;
    }
  }
  // thumb: shorter (~60% of the middle finger) and noticeably thicker than the fingers, rooted low on the
  // palm's radial side (not up near the finger roots) at a clearly different, more lateral base angle.
  { const base = hp === 'grip' ? -0.6 : hp === 'point' ? -1.1 : -1.05, bend = hp === 'grip' ? 0.7 : hp === 'open' ? 0.06 : 0.22;
    let x = -kW * 0.78, y = palmLen * 0.24, a = base;
    for (const [l, r0, r1] of [[1.3 * k, 0.98 * k, 0.8 * k], [1.05 * k, 0.76 * k, 0.56 * k]]) {
      if (l < 1.2 * k) a += bend;
      const nx = x + Math.sin(a) * l, ny = y + Math.cos(a) * l;
      caps.push({ cap: [x, y, r0, nx, ny, r1], z: 0.5 * k }); x = nx; y = ny;
    }
  }
  // the palm itself: a rounded trapezoid (never a tapered capsule, which reads as a thin lens, and never
  // sharp-cornered, which reads as a cut block) - clearly wider at the knuckle line than at the wrist, built
  // with arcTo fillets so every corner blends smoothly into the next edge (no box-like right angles).
  const palmPath = (c) => {
    const P = [[-wristW, 0], [-kW, palmLen], [kW, palmLen], [wristW, 0]], R = [wristW * 0.5, kW * 0.46, kW * 0.46, wristW * 0.5];
    c.beginPath(); c.moveTo(0, 0);
    for (let i = 0; i < 4; i++) c.arcTo(P[i][0], P[i][1], P[(i + 1) % 4][0], P[(i + 1) % 4][1], R[i]);
    c.closePath();
  };
  // SMOOTHNESS: the rounded volume of the fingers comes from the pillow inflate of the whole silhouette (one
  // continuous soft mass), NOT from a height blob per finger segment - adjacent segment blobs add up where they
  // meet, and every joint became a knob with a lit edge (the "not smooth" hand). The per-segment capsules are
  // kept only as the silhouette; the palm keeps its three mounds at low amplitude. No hard knuckle lines either.
  const fur = isFur(s);
  relief(ctx, { mat: { ...MAT_SOFT_SKIN }, inflate: 1.5 * k, depth: 1.05 * k, aoR: 1.4, profile: 'soft',
    blobs: [
      { x: 0, y: palmLen * 0.56, rx: kW * 0.82, ry: palmLen * 0.56, z: 0.3 * k },
      { x: -kW * 0.56, y: palmLen * 0.34, rx: kW * 0.46, ry: palmLen * 0.4, z: 0.3 * k },
      { x: kW * 0.52, y: palmLen * 0.58, rx: kW * 0.32, ry: palmLen * 0.32, z: 0.16 * k },
      ...caps.map((b) => ({ ...b, z: b.z * 0.18 })),
    ],
    paint(c) {
      c.fillStyle = hs; palmPath(c); c.fill(); fillShapes(c, caps, hs);
      if (fur) { // a soft fur cuff at the wrist fading into the bare palm, so the hand grows out of the furred arm instead of being glued on
        c.save(); palmPath(c); c.clip(); c.fillStyle = lin(c, 0, -0.5 * k, 0, palmLen * 0.62, [[0, rgba(s.fur, 0.9)], [0.45, rgba(s.fur, 0.45)], [1, rgba(s.fur, 0)]]); c.fillRect(-kW - 1, -1, kW * 2 + 2, palmLen); c.restore();
        c.save(); palmPath(c); c.clip(); furCoat(c, { box: [-kW, 0, kW, palmLen * 0.45], inside: () => true, n: 220, len: 0.9 * k, wid: 0.12 * k, seed: 77, jitter: 0.3, tuft: 0, cols: bodyFur(s.fur).slice(1), flow: () => Math.PI / 2 }); c.restore();
      }
    },
    over(g) { // the faintest warm shade in the web of each finger root (structure without a drawn line)
      for (let i = 0; i < 3; i++) { const x = (FINGERS[i].x + FINGERS[i + 1].x) / 2; glow(g, x, palmLen + 0.3 * k, 0.55 * k, darken(hs, 0.5), 0.22); } } });
}
const MAT_SOFT_SKIN = { wrap: 0.6, sss: 0.2, spec: 0.08, shine: 18, rim: 0.3, ao: 0.6, mottle: 0.02 };
export function thigh(ctx, s) {
  const L = s.leg, w = s.legW ?? 20, mus = s.muscle ?? 0.5;
  const fz = isFur(s) ? 0.45 : 1;   // fur hides muscle: at full amplitude the muscle blobs under a fur coat read as lumps, not muscle
  const shapes = [{ cap: [0, 0, w * 0.56, 0.5, L * 0.3, w * 0.57] }, { cap: [0.5, L * 0.3, w * 0.57, 0, L + 5, w * 0.36] }];
  relief(ctx, { mat: isFur(s) ? 'fur' : 'skin', inflate: w * 0.5, depth: w * 0.5, bump: isFur(s) ? (s.silky ? 0.22 : 0.4) : 0, aoR: 4,
    blobs: [{ x: w * 0.12, y: L * 0.45, rx: w * 0.4, ry: L * 0.36, z: (0.8 + 3 * mus) * fz }, { x: -w * 0.2, y: L * 0.5, rx: w * 0.26, ry: L * 0.3, z: (0.3 + 0.8 * mus) * fz }, { x: w * 0.05, y: L - 1, rx: w * 0.3, ry: 4.5, z: 1.2 * fz }],
    paint(c) { surface(c, s, shapes, [-w, -10, w, L + 8], { n: 2200, seed: 19, flow: (x) => Math.PI / 2 - x * 0.015 }); } });
}
export function shin(ctx, s) {
  const L = s.leg, w = s.legW ?? 20, mus = s.muscle ?? 0.5;
  const fz = isFur(s) ? 0.45 : 1;
  // the shin reaches up INTO the knee and fades over a long run, so the thigh's rounded end never shows as a step
  const shapes = [{ cap: [0, -12, w * 0.34, -w * 0.05, L * 0.3, w * 0.4] }, { cap: [-w * 0.05, L * 0.3, w * 0.4, 0, L, w * 0.2] }];
  relief(ctx, { alphaFn: (x, y) => (y + 11) / 10, mat: isFur(s) ? 'fur' : 'skin', inflate: w * 0.42, depth: w * 0.42, bump: isFur(s) ? (s.silky ? 0.22 : 0.4) : 0, aoR: 3,
    blobs: [{ x: -w * 0.14, y: L * 0.3, rx: w * 0.32, ry: L * 0.26, z: (0.7 + 2.6 * mus) * fz }, { x: w * 0.06, y: 1, rx: w * 0.3, ry: 5, z: 1.4 * fz }, { cap: [w * 0.12, 8, 1.2, w * 0.06, L * 0.85, 0.9], z: 0.7 * fz }],
    paint(c) { surface(c, s, shapes, [-w, -8, w, L + 6], { n: 1700, seed: 29, flow: (x) => Math.PI / 2 - x * 0.015 }); } });
  if (s.anklets !== false && (s.jewels ?? 0) >= 1) { goldBand(ctx, L - 5, w * 0.24, 2.6, { curve: 0.6 }); goldBand(ctx, L - 2.4, w * 0.25, 2.2, { curve: 0.6 }); }
}
export function foot(ctx, s) {
  const hs = isFur(s) ? darken(handSkin(s), 0.12) : s.skin, k = (s.legW ?? 20) / 20 * (isFur(s) ? 0.78 : 0.92);
  if (s.boots) { relief(ctx, { mat: 'iron', inflate: 3, depth: 3, paint(c) { c.fillStyle = '#4a4048'; c.beginPath(); c.moveTo(-6, -6); c.lineTo(6, -6); c.lineTo(7, 0); c.quadraticCurveTo(17, 0.5, 17, 6); c.lineTo(-6.6, 6); c.closePath(); c.fill(); c.fillStyle = GOLD; c.fillRect(-6, -5, 12, 2); } }); return; }
  const fur = isFur(s);
  // the sole: a raised arch between heel and ball; the toes are four separate rounded bumps past the ball
  const TOES = [[14.6, 1.6, 2.0, 1.75], [16.3, 3.0, 1.7, 1.5], [17.4, 4.3, 1.45, 1.3], [17.9, 5.4, 1.2, 1.1]].map(([x, y, rx, ry]) => ({ x: x * k, y: y * k, rx: rx * k, ry: ry * k }));
  const sole = (c) => { c.beginPath(); c.moveTo(-4.4 * k, -6 * k); c.lineTo(4 * k, -6 * k); c.bezierCurveTo(5.4 * k, -2.6 * k, 9 * k, -0.6 * k, 13.2 * k, 1.0 * k); c.bezierCurveTo(15.2 * k, 2.0 * k, 16.4 * k, 4.0 * k, 16.2 * k, 5.6 * k); c.lineTo(15.4 * k, 6.2 * k); c.lineTo(7 * k, 6.3 * k); c.quadraticCurveTo(2.6 * k, 3.4 * k, -1.2 * k, 6.1 * k); c.lineTo(-4.6 * k, 6 * k); c.bezierCurveTo(-7.6 * k, 4.2 * k, -6.6 * k, -1.2 * k, -4.4 * k, -6 * k); c.closePath(); };
  relief(ctx, { mat: { ...MAT_SOFT_SKIN }, inflate: 3.2 * k, depth: 2.6 * k, aoR: 2.2, profile: 'soft',
    blobs: [{ x: -3.4 * k, y: -0.4 * k, rx: 2.2 * k, ry: 2.2 * k, z: 0.7 }, { x: 6 * k, y: 0.6 * k, rx: 6 * k, ry: 2.4 * k, z: 0.8 }, { x: 2.5 * k, y: 5.2 * k, rx: 3.2 * k, ry: 1.4 * k, z: -0.9 }, ...TOES.map((t) => ({ ...t, z: 0.35 }))],
    paint(c) {
      c.fillStyle = hs; sole(c); c.fill(); fillShapes(c, TOES, hs);
      if (fur) { c.save(); sole(c); c.clip(); c.fillStyle = lin(c, 0, -6 * k, 0, 0.5 * k, [[0, rgba(s.fur, 0.95)], [0.5, rgba(s.fur, 0.5)], [1, rgba(s.fur, 0)]]); c.fillRect(-8 * k, -7 * k, 16 * k, 8 * k); c.restore();
        furCoat(c, { box: [-4.4 * k, -6 * k, 4.4 * k, -0.5 * k], inside: (x, y) => x > -4.6 * k - (y + 6 * k) * 0.3 && x < 4.2 * k + (y + 6 * k) * 0.6, n: 260, len: 1.0 * k, wid: 0.12 * k, seed: 79, jitter: 0.3, tuft: 0, cols: bodyFur(s.fur).slice(1), flow: () => Math.PI / 2 }); }
    },
    over(g) {
      g.fillStyle = 'rgba(255,238,228,0.5)'; g.beginPath(); g.ellipse(14.9 * k, 0.9 * k, 0.9 * k, 0.55 * k, -0.4, 0, TAU); g.fill();
      for (let i = 0; i < 3; i++) { const a = TOES[i], b = TOES[i + 1]; glow(g, (a.x + b.x) / 2 + 0.3 * k, (a.y + b.y) / 2 + 0.6 * k, 0.75 * k, darken(hs, 0.55), 0.3); } // soft seams between the toes
      for (const t of TOES) { g.fillStyle = 'rgba(255,240,230,0.45)'; g.beginPath(); g.ellipse(t.x + t.rx * 0.45, t.y - t.ry * 0.2, t.rx * 0.32, t.ry * 0.28, 0, 0, TAU); g.fill(); }   // nail light
    } });
}

// ---------------- garments ----------------
// Waist-down wrap in silk relief: fanned pleats, a gathered front bundle, scattered butti motifs, brocade hem,
// and a knotted waist sash with hanging ends. len = drop (units), flare = extra half-width at the hem. pivot = waist centre.
export function wrap(ctx, s, len, flare, o = {}) {
  const col = s.dhoti ?? s.cloth ?? '#e8a020', hw = s.hw + 3.5, bcol = s.dborder ?? '#b3242a', bh = Math.min(9, len * 0.2);
  const half = (y) => hw + flare * Math.pow(Math.max(0, y) / len, 1.25);
  const hem = (x) => len + 3.2 * Math.cos((x / (hw + flare)) * 1.4) + Math.sin(x * 0.55) * 1.3 - (s.long ? 0 : len * 0.2 * Math.exp(-(x - 1) * (x - 1) / 30));
  const path = (c) => { c.beginPath(); c.moveTo(-hw, -2); c.lineTo(hw, -2); for (let i = 1; i <= 10; i++) { const y = (i / 10) * len; c.lineTo(half(y), y); } const W = hw + flare; for (let i = 0; i <= 24; i++) { const x = W - (i / 24) * 2 * W; c.lineTo(x, hem(x)); } for (let i = 10; i >= 1; i--) { const y = (i / 10) * len; c.lineTo(-half(y), y); } c.closePath(); };
  relief(ctx, { mat: 'silk', inflate: 7, depth: 5, bump: 1.2, aoR: 3,
    heightFn: (x, y) => { const v = Math.max(0, y) / len, u = x / half(y), pl = o.noPleat ? 0 : Math.exp(-((u - 0.12) * (u - 0.12)) / 0.02) * Math.sin(u * 60) * 0.9; return (Math.sin(u * 9.5 + 0.6) * 1.5 + Math.sin(u * 21 + v * 2) * 0.5) * (0.25 + v * 1.2) + pl * (0.4 + v); },
    paint(c) {
      path(c); c.fillStyle = col; c.fill(); c.save(); path(c); c.clip();
      c.fillStyle = lin(c, 0, 0, 0, len, [[0, rgba(lighten(col, 0.3), 0.25)], [1, rgba(darken(col, 0.5), 0.3)]]); c.fillRect(-hw - flare - 4, -4, (hw + flare) * 2 + 8, len + 12);
      if (s.motif) for (let r = 0; r < Math.ceil(len / 9); r++) for (let k = -5; k <= 5; k++) { const y = 7 + r * 9, x = (k + (r % 2) * 0.5) * 0.2 * half(y); if (y < len - bh - 2 && Math.abs(x) < half(y) - 2) flower(c, x, y, 2.5, s.motif, darken(col, 0.3)); }
      const W = hw + flare; for (let i = 0; i <= 60; i++) { const x = -W + (i / 60) * 2 * W, y = hem(x); c.fillStyle = bcol; c.fillRect(x - W / 30, y - bh, W / 15 + 0.4, bh + 2); }
      for (const [dy, lw, cc] of [[-bh, 1.3, GOLD], [-1.2, 1.5, GOLD], [-bh + 1.8, 0.5, GOLD_L]]) { c.strokeStyle = cc; c.lineWidth = lw; c.beginPath(); for (let i = 0; i <= 60; i++) { const x = -W + (i / 60) * 2 * W; c[i ? 'lineTo' : 'moveTo'](x, hem(x) + dy); } c.stroke(); }
      c.fillStyle = GOLD_L; for (let i = 0; i < 22; i++) { const x = -W + ((i + 0.5) / 22) * 2 * W, y = hem(x) - bh * 0.5; c.beginPath(); c.moveTo(x, y - bh * 0.3); c.lineTo(x + 1.6, y); c.lineTo(x, y + bh * 0.3); c.lineTo(x - 1.6, y); c.fill(); }
      c.restore();
    } });
  if (!o.noTail) {
    const sc = s.kamar ?? bcol;
    relief(ctx, { mat: 'silk', inflate: 2.6, depth: 2.2, heightFn: (x, y) => Math.sin(x * 1.7 + y * 0.2) * 0.45, aoR: 2,
      paint(c) { c.fillStyle = sc; c.beginPath(); c.moveTo(-hw - 0.5, -5); c.quadraticCurveTo(0, -2, hw + 0.5, -5); c.lineTo(hw + 0.5, 2.5); c.quadraticCurveTo(0, 5.5, -hw - 0.5, 2.5); c.closePath(); c.fill();
        for (const [dx, l, w2] of [[4, len * 0.78, 5], [8.5, len * 0.62, 4.2]]) { c.beginPath(); c.moveTo(dx - w2 / 2, 1); c.bezierCurveTo(dx - w2 * 0.6, l * 0.4, dx - w2 * 0.2, l * 0.7, dx - w2 * 0.7 + 1, l); c.lineTo(dx + w2 * 0.8 + 1, l + 1.5); c.bezierCurveTo(dx + w2 * 0.9, l * 0.7, dx + w2 * 0.5, l * 0.4, dx + w2 / 2, 1); c.closePath(); c.fillStyle = sc; c.fill(); c.fillStyle = GOLD; c.fillRect(dx - w2 * 0.7 + 1, l - 3.2, w2 * 1.5, 1.6); }
        c.beginPath(); c.ellipse(6, 0, 4, 3.4, 0.2, 0, TAU); c.fillStyle = lighten(sc, 0.1); c.fill(); } });
  }
}
// veil hanging from the crown of the head down the back (pivot: neck base); translucent silk with a gold edge
export function veil(ctx, s, len) {
  const col = s.veilCol ?? s.cloth ?? '#e56b4e';
  const shape = (c) => { c.beginPath(); c.moveTo(-4, -42); c.bezierCurveTo(-22, -40, -27, -8, -23, len * 0.5); c.bezierCurveTo(-21, len * 0.85, -14, len, -3, len - 3); c.bezierCurveTo(-9, len * 0.5, -3, -8, 6, -34); c.closePath(); };
  relief(ctx, { mat: 'silk', inflate: 5, depth: 3, profile: 'soft', heightFn: (x, y) => Math.sin(x * 0.75 + y * 0.05) * 0.8 + Math.sin(x * 1.9 - y * 0.04) * 0.3,
    paint(c) { shape(c); c.fillStyle = rgba(col, 0.86); c.fill(); c.save(); shape(c); c.clip(); c.strokeStyle = GOLD; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-4, -42); c.bezierCurveTo(-22, -40, -27, -8, -23, len * 0.5); c.bezierCurveTo(-21, len * 0.85, -14, len, -3, len - 3); c.stroke(); c.fillStyle = GOLD_L; for (let i = 0; i < 26; i++) { c.beginPath(); c.arc(-19 + hash1(i) * 14, -30 + i * (len + 24) / 26, 0.6, 0, TAU); c.fill(); } c.restore(); } });
}
export function quiver(ctx, s) {
  for (let i = -2; i <= 2; i++) { const x = i * 2.1, top = -30 - (2 - Math.abs(i)) * 3; ctx.strokeStyle = '#6a4424'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x * 0.7, -6); ctx.lineTo(x, top); ctx.stroke(); for (const d of [-1, 1]) { ctx.fillStyle = (i + 2) % 2 ? '#c23a30' : '#efe6d4'; ctx.beginPath(); ctx.moveTo(x, top - 1); ctx.quadraticCurveTo(x + d * 2.6, top + 3, x + d * 1.2, top + 9); ctx.lineTo(x, top + 8); ctx.fill(); } }
  relief(ctx, { mat: 'wood', inflate: 5, depth: 5, bump: 1.4,
    paint(c) { c.fillStyle = '#7a4a28'; c.beginPath(); c.moveTo(-6.6, -8); c.lineTo(6.6, -8); c.lineTo(8, 44); c.quadraticCurveTo(0, 49, -8, 44); c.closePath(); c.fill(); c.strokeStyle = '#4a2a14'; c.lineWidth = 0.5; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(-7, -4 + i * 5.5); c.lineTo(7.4, -1 + i * 5.5); c.stroke(); } } });
  for (const y of [-6, 19, 41]) goldBand(ctx, y, 7.4 + (y > 0 ? 0.5 : 0), 4, { curve: 1 });
  rosette(ctx, 0, 7, 3.2, '#d8283a', 6);
}

// The "noble" face (spec.noble): the classical court-painting ideal used for the four leads - a smooth oval face,
// long lotus-petal eyes with a kohl wing, shaped tapered brows, a slender straight nose and a full bowed mouth.
// HOW IT IS BUILT (two layers, the way the classical painters work):
//   1. soft relief for VOLUME - a few large forms only (forehead dome, cheekbone, nose ridge, lips, chin); no small
//      blobs, because every small blob reads as a lump/bag at portrait size;
//   2. a DRAWN layer of crisp tapered ink strokes for STRUCTURE (`ink()`): the upper-lid line carried out into a
//      wing, the lid crease, the lower-lid line, the brow as one shaped stroke with a thick head and a fine tail,
//      the shadow-side line of the nose, nostril + wing accents, the philtrum, the seam of the lips and a faint
//      accent along the shadow-side jaw. Soft relief alone cannot produce a "handsome / beautiful" face; the lines can.
// Face parameters on the spec (all optional):
//   eyeH   eye openness multiplier (1; <1 keener)        eyeW   eye length multiplier (1)
//   gaze   0..1 downcast gaze and lowered upper lid       smile  added to every expression's smile (-0.4..0.4)
//   browTilt  + lowers the inner brow (keen), - raises it (soft, humble)      browW brow thickness multiplier
//   lip    lip colour, blush 0..1, kohl 0..1 (lash-line weight), noseStud true, iris '#hex', brow 0..1.5 heaviness
import { TAU, mix, lighten, darken, rgba, lin, rad, ink, bez, quad, chain, peak, head, fade } from './kit.js';
export { ink } from './kit.js';
import { relief } from './sculpt.js';
import { shadowed } from './parts.js';

// soft elliptical glow / shade (radial falloff) - the painter's soft brush
function soft(c, x, y, rx, ry, rot, col, a) {
  c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(rx, ry);
  c.fillStyle = rad(c, 0, 0, 0, 1, [[0, rgba(col, a)], [0.55, rgba(col, a * 0.55)], [1, rgba(col, 0)]]); c.fillRect(-1, -1, 2, 2); c.restore();
}

// A long lotus eye. d = +1 when the inner corner points toward +x (near eye), -1 for the far eye.
// Large dark iris sitting under the upper lid (the classical heavy-lidded serenity), clear limbal ring and
// catch-light, then the drawn layer: lid line + wing, lashes, lower-lid line, lid crease.
function lotusEye(g, x, y, w, h, d, o) {
  const lid = o.lid ?? 0, squint = o.squint ?? 0, kohl = o.kohl ?? 0.5, gaze = o.gaze ?? 0, near = d > 0;
  const ix = x + d * w, iy = y + h * 0.3, ox = x - d * w, oy = y - h * 0.3;
  const up = 1 - lid * 0.4, lo = 1 - squint * 0.55;
  const U = [ix, iy, x + d * w * 0.5, y - h * 1.5 * up, x - d * w * 0.48, y - h * 1.42 * up, ox, oy];        // upper lid, inner -> outer
  const Lo = [ox, oy, x - d * w * 0.45, y + h * 0.86 * lo, x + d * w * 0.45, y + h * 1.02 * lo, ix, iy];       // lower lid, outer -> inner
  const shape = () => { g.beginPath(); g.moveTo(ix, iy); g.bezierCurveTo(U[2], U[3], U[4], U[5], ox, oy); g.bezierCurveTo(Lo[2], Lo[3], Lo[4], Lo[5], ix, iy); g.closePath(); };
  g.save(); shape(); g.clip();
  // sclera: luminous, a touch warmer at the inner corner, cooler under the lid
  g.fillStyle = lin(g, x - w, 0, x + w, 0, near ? [[0, '#cdb8a8'], [0.3, '#f9f3ea'], [0.8, '#f7efe4'], [1, '#d8bcaa']] : [[0, '#d2b9a8'], [0.3, '#f6eee2'], [0.8, '#f7f0e6'], [1, '#c8b0a0']]);
  g.fillRect(x - w - 1, y - h * 2, w * 2 + 2, h * 4);
  const ir = h * 1.28, cx = x + d * w * 0.08 + (o.look ?? 0.12) * w, cy = y - h * 0.02 + gaze * h * 0.3 + lid * h * 0.1;
  g.fillStyle = rad(g, cx, cy, 0, ir, [[0, '#2a140c'], [0.45, o.iris ?? '#3d1f10'], [0.82, '#1c0b06'], [1, '#080302']]); g.beginPath(); g.arc(cx, cy, ir, 0, TAU); g.fill();
  g.fillStyle = rad(g, cx - ir * 0.15, cy + ir * 0.45, 0, ir * 0.75, [[0, 'rgba(184,110,54,0.7)'], [1, 'rgba(150,84,40,0)']]); g.beginPath(); g.arc(cx, cy, ir * 0.92, 0, TAU); g.fill();   // warm lower iris
  g.fillStyle = '#050202'; g.beginPath(); g.arc(cx, cy, ir * 0.44, 0, TAU); g.fill();
  g.fillStyle = lin(g, 0, y - h * 1.55, 0, y + h * 0.15, [[0, 'rgba(22,8,6,0.72)'], [0.5, 'rgba(22,8,6,0.3)'], [1, 'rgba(22,8,6,0)']]); g.fillRect(x - w - 1, y - h * 1.6, w * 2 + 2, h * 1.9);   // lid shadow on the eye
  g.fillStyle = 'rgba(255,255,255,0.97)'; g.beginPath(); g.arc(cx + ir * 0.3, cy - ir * 0.4, Math.max(0.34, ir * 0.27), 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,244,230,0.5)'; g.beginPath(); g.arc(cx - ir * 0.34, cy + ir * 0.44, ir * 0.15, 0, TAU); g.fill();
  g.restore();
  // ---- drawn layer ----
  const kw = 0.6 + kohl * 0.5;
  const wing = (near ? 1.15 : 0.4) * (0.55 + kohl * 0.75), wx = ox - d * wing, wy = oy - wing * 0.42;
  // upper lid line: from the inner corner, swelling over the outer third, carried past the corner as a wing
  const lidLine = chain(bez(U), quad([ox, oy, ox - d * wing * 0.45, oy - wing * 0.1, wx, wy]), 0.8);
  ink(g, lidLine, (near ? 0.62 : 0.5) * kw, '#120605', (t) => (t < 0.12 ? t / 0.12 * 0.35 : t < 0.7 ? 0.35 + (t - 0.12) / 0.58 * 0.65 : 1 - (t - 0.7) / 0.3));
  // lashes on the outer third (a few confident strokes, not fuzz)
  if (kohl > 0.45) { const nL = near ? (kohl > 0.8 ? 6 : 4) : 3; for (let i = 0; i < nL; i++) { const u = 0.42 + i * (0.5 / nL), p = bez(U)(u), q = bez(U)(u + 0.02), dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, len = (0.55 + kohl * 0.5) * (0.6 + Math.sin(u * Math.PI) * 0.5); const nx = dy / l, ny = -dx / l; ink(g, quad([p[0], p[1], p[0] + nx * len * 0.5 - dx / l * len * 0.25, p[1] + ny * len * 0.5 - dy / l * len * 0.25, p[0] + nx * len * 0.85 - dx / l * len * 0.7, p[1] + ny * len * 0.85 - dy / l * len * 0.7]), 0.22, 'rgba(18,6,5,0.9)', fade); } }
  // lower lid line: thin, heavier toward the outer corner, fading before the inner corner
  ink(g, bez(Lo), 0.3 + kohl * 0.12, rgba('#2a0e0a', 0.55 + kohl * 0.2), (t) => (t < 0.15 ? t / 0.15 : t < 0.55 ? 1 : Math.max(0, 1 - (t - 0.55) / 0.35)));
  // a light line on the lower lid's wet edge, then the lid crease above the lashes
  ink(g, (t) => { const p = bez(Lo)(t); return [p[0], p[1] + 0.32]; }, 0.24, 'rgba(255,236,222,0.5)', peak(0.5));
  const cr = [ix - d * w * 0.3, y - h * 1.35 * up - 0.3, x + d * w * 0.15, y - h * (2.15 + lid * 0.3), x - d * w * 0.6, y - h * 2.0, ox - d * wing * 0.15, oy - h * 0.8];
  ink(g, bez(cr), 0.34, rgba(o.shade, 0.55), peak(0.55));
}

// brow as ONE shaped stroke: rounded thicker head at the inner end, gentle arch, long fine tail
function brow(g, x, yb, w, d, th, tiltIn, arch, col) {
  const H = [x + d * w * 0.95, yb + tiltIn + 0.1], P1 = [x + d * w * 0.35, yb - arch * 0.9 + tiltIn * 0.4], P2 = [x - d * w * 0.55, yb - arch * 0.95], T = [x - d * w * 1.4, yb + 0.4 + Math.max(0, -tiltIn) * 0.5];
  ink(g, bez([H[0], H[1], P1[0], P1[1], P2[0], P2[1], T[0], T[1]]), th, col, head(0.3, 0.1), 30);
  // a soft shade under the brow's head so it sits IN the face, not on it
  soft(g, H[0] - d * w * 0.3, H[1] + th * 0.9, w * 0.45, th * 0.9, 0, col, 0.16);
}

// MALE noble mask - authored as its own silhouette: jaw hinge nearly as wide as the cheekbone, jawline running
// down nearly straight into a broad, flat-planed chin with a faint centre notch; the face reads a touch longer.
export function nobleMaskMale(c, jw = 0) {
  c.beginPath(); c.moveTo(-10.8, -25);
  c.bezierCurveTo(-11.8, -37.4, -3, -43.6, 5, -42.6); c.bezierCurveTo(10.8, -41.8, 14, -37.6, 14.3, -32.4);
  c.bezierCurveTo(14.4, -30.2, 13.85, -28.4, 14.0, -26.2); c.bezierCurveTo(14.15, -24.2, 15.0, -22.4, 14.9, -19.6);
  c.bezierCurveTo(14.3 + jw * 0.7, -15.4, 13.4 + jw * 1.7, -11.4, 11.7 + jw * 2.2, -8.5 - jw * 1.0);
  c.bezierCurveTo(10.6 + jw * 1.7, -7.1 - jw * 1.1, 9.0 + jw * 1.0, -6.2 - jw * 1.3, 6.6 + jw * 0.6, -6.5 - jw * 1.1);
  c.bezierCurveTo(6.0 + jw * 0.4, -6.55 - jw * 1.1, 5.2, -6.6, 4.6 - jw * 0.2, -6.5 - jw * 1.0);
  c.bezierCurveTo(2.0 - jw * 0.5, -6.2 - jw * 1.0, -2.6 - jw * 1.9, -7.3 - jw * 0.6, -6.2 - jw * 1.5, -11.8 - jw * 0.3);
  c.bezierCurveTo(-8.2, -15.2, -10.1, -19.4, -10.8, -25); c.closePath();
}
// FEMALE noble mask - the jaw pulls in below the cheekbone to a small, round, centred chin; a touch shorter.
export function nobleMaskFemale(c) {
  c.beginPath(); c.moveTo(-10.4, -25);
  c.bezierCurveTo(-11.4, -36.6, -3, -42.8, 5, -41.8); c.bezierCurveTo(10.4, -41, 13.4, -37, 13.7, -32.2);
  c.bezierCurveTo(13.8, -30.2, 13.3, -28.4, 13.4, -26.2); c.bezierCurveTo(13.5, -24.2, 13.9, -22.6, 13.3, -20.0);
  c.bezierCurveTo(12.6, -15.8, 10.2, -11.4, 7.6, -8.6);
  c.bezierCurveTo(6.6, -7.5, 5.2, -6.7, 3.6, -6.5);
  c.bezierCurveTo(2.0, -6.7, 0.4, -7.3, -1.2, -8.3);
  c.bezierCurveTo(-3.6, -9.9, -5.6, -12.1, -7.2, -14.7);
  c.bezierCurveTo(-9.0, -17.6, -10.1, -21.1, -10.4, -25); c.closePath();
}
export function nobleMask(c, jw = 0, fem = false) { if (fem) nobleMaskFemale(c); else nobleMaskMale(c, jw); }
// the shadow-side jaw run of each mask, as a point function (ear -> chin), used for the jaw shade + accent line
const jawCurve = (jw, fem) => (fem
  ? chain(quad([-10.4, -25, -10.2, -18, -7.2, -14.7]), quad([-7.2, -14.7, -3.6, -9.9, 1.6, -7.2]), 0.5)
  : chain(quad([-10.8, -25, -10.2, -18, -7.6, -14.4]), quad([-7.6, -14.4, -5 - jw * 1.6, -8.4 - jw * 0.7, 2.4 - jw * 0.4, -6.9 - jw * 1.0]), 0.5));

export function nobleFace(ctx, s, E) {
  const skin = s.skin, hair = s.hair ?? '#0d0707', fem = !!s.fem, jw = s.jaw ?? 0;
  const sm = Math.max(-0.7, Math.min(1.3, E.mouth + (s.smile ?? 0) * (E.mouth > 0 ? 1 : 0.4))), bw = E.brow;
  const shade = mix(darken(skin, 0.5), '#7a2c1c', 0.35), cool = mix(darken(skin, 0.5), '#4a2a4c', 0.4), lip = s.lip ?? (fem ? '#c64450' : mix(skin, '#b0474a', 0.62));
  const mask = (c) => nobleMask(c, jw, fem);
  const ex = 2.9, fx = 11.0, ey = -25.6, mx = 8.9, my = -13.1;
  const ew = (fem ? 5.0 : 4.75) * (s.eyeW ?? 1), eh = (fem ? 2.1 : 1.88) * (s.eyeH ?? 1) * E.eye, fw = ew * 0.58;
  const lid = Math.min(0.9, E.lid + 0.1 + (s.gaze ?? 0) * 0.5), squint = Math.max(0, sm - 0.8) * 0.9;
  const Lw = 3.5 + Math.max(0, sm) * 0.35, Rw = 2.6 + Math.max(0, sm) * 0.25, cyL = my - sm * 0.62, cyR = my - sm * 0.5;   // mouth corners
  const jawPt = jawCurve(jw, fem), heavy = s.brow ?? (fem ? 0.3 : 0.6);
  shadowed(ctx, (g) => { mask(g); g.fillStyle = '#000'; g.fill(); }, 2.6, 2.8, 'rgba(30,8,6,0.45)');
  relief(ctx, {
    mat: { wrap: 0.66, sss: 0.24, spec: 0.09, shine: 20, rim: 0.36, ao: 0.4, mottle: 0.015 }, inflate: 8.5, depth: 5.4, aoR: 3.5, key: [1.1, 1.0, 0.86],
    // the face TURNS away at both edges (far side past the nose, ear side) instead of the pillow's lit rounded rim,
    // which read as a bright rim down the far cheek / a lit lump at the jaw
    heightFn: (x, y) => (x > 9 ? -Math.pow(x - 9, 1.2) * 0.24 : x < -6 ? -(-6 - x) * 0.14 : 0) - (y > -12 ? (y + 12) * 0.08 : 0),
    // VOLUME: a few large forms. No small blobs - they read as lumps at portrait size.
    blobs: [
      { x: 3.5, y: -35, rx: 12, ry: 7.2, z: 0.85 },                                                     // forehead dome
      { cap: [-1.5, -29.6, 1.7, 7.5, -30.0, 1.6], z: 0.2 + heavy * 0.35 },                              // brow ridge (heavier on a man)
      { x: 1.5, y: -21.8, rx: 8 - jw * 1.6, ry: 5.2, rot: -0.1, z: 0.4 - jw * 0.12 + Math.max(0, sm) * 0.12 }, { x: 12.7, y: -20.6, rx: 2.4, ry: 3.6, z: 0.35 }, // cheekbone planes
      { x: ex, y: ey - 0.6, rx: 5.2, ry: 2.6, z: -0.36 }, { x: fx, y: ey - 0.6, rx: 3.0, ry: 2.4, z: -0.34 },  // eye sockets (shallow)
      { cap: [8.1, -29.2, 1.2, 9.9, -20.9, 1.5], z: 0.65 }, { x: 10.1, y: -20.3, rx: 1.5, ry: 1.3, z: 0.42 }, { x: 8.3, y: -19.1, rx: 1.3, ry: 1.0, z: 0.3 }, // nose ridge, tip, wing
      { x: mx + 0.2, y: my - 1.5, rx: 3.6, ry: 1.5, z: 0.42 }, { x: mx, y: my + 1.4, rx: 3.1, ry: 1.6, z: 0.78 },  // lips
      { cap: [mx - Lw, cyL, 0.4, mx + Rw, cyR, 0.36], z: -0.34 }, { x: mx - 0.2, y: my + 3.5, rx: 2.6, ry: 0.9, z: -0.3 },
      { x: mx - 0.9, y: my + 5.0, rx: 3.4, ry: 2.3, z: 0.6 },                                            // chin
    ],
    paint(c) {
      mask(c); c.fillStyle = skin; c.fill(); c.save(); mask(c); c.clip();
      // ONE key light from the upper front: forehead, bridge + tip of the nose, near cheekbone, chin
      soft(c, 4.5, -35.2, 10.5, 6.6, 0, lighten(skin, 0.32), 0.38);
      soft(c, 2.6, -20.4, 5.0, 3.2, -0.25, lighten(skin, 0.36), 0.3 - jw * 0.06);
      soft(c, mx - 1.2, my + 4.8, 3.0, 1.9, 0, lighten(skin, 0.3), 0.22);
      soft(c, 9.25, -25.2, 0.85, 4.6, -0.18, lighten(skin, 0.5), 0.3); soft(c, 10.15, -20.6, 1.15, 0.95, 0, lighten(skin, 0.55), 0.42);
      // the SHADOW SIDE: a cool plane across the ear side (a gradient, never a blob) and a chain of soft shades
      // hugging the jaw's own silhouette so the form turns under - never a shadow blob in the middle of the cheek
      c.fillStyle = lin(c, -11, 0, -1.5, 0, [[0, rgba(cool, 0.4)], [1, rgba(cool, 0)]]); c.fillRect(-12, -46, 11, 46);
      c.fillStyle = lin(c, 0, -6.2 - jw, 0, -13.8 - jw, [[0, rgba(cool, fem ? 0.32 : 0.4)], [1, rgba(cool, 0)]]); c.fillRect(-12, -14.5 - jw, 28, 9.5);   // the jaw turns under (clipped by the mask, so it hugs the silhouette)
      soft(c, 12.4, -10.8 - jw * 0.8, 3.0, 3.2, -0.5, cool, 0.28);                                       // the far jaw corner turns away
      // sockets: shade only under the brow and at the inner corner - never a dark ring around the eye
      soft(c, ex, ey - 2.5, 5.2, 1.7, 0, shade, 0.2); soft(c, fx, ey - 2.4, 3.1, 1.5, 0, shade, 0.22);
      soft(c, ex + ew * 0.92, ey + 0.5, 1.3, 1.1, 0, shade, 0.18); soft(c, fx - fw * 0.9, ey + 0.5, 1.0, 0.9, 0, shade, 0.16);
      // nose: its shadow side is a narrow band, plus the shadow under the tip
      soft(c, 6.9, -24.6, 1.6, 4.4, -0.15, shade, 0.09); soft(c, 7.4, -28.9, 1.4, 2.0, 0, shade, 0.08); soft(c, 9.3, -17.7, 2.6, 1.0, 0, shade, 0.34);
      soft(c, 10.4, -19.9, 2.0, 1.4, 0, '#e2604e', 0.12);                                                // warmth at the tip
      // blush on the apple of the cheek (rosier on Sita), warmth at the ear side
      const blushA = s.blush ?? (fem ? 0.32 : 0.11);
      soft(c, 1.4, -18.2, 5.6, 4.2, -0.2, '#e0524e', blushA); soft(c, 12.8, -19.4, 2.3, 2.9, 0, '#e0524e', blushA * 0.7); soft(c, -9.4, -23, 3, 5, 0, '#d8584a', 0.22);
      soft(c, mx - 0.3, my + 3.6, 3.0, 1.1, 0, shade, 0.32);                                             // under the lower lip
      soft(c, 6, -41.5, 12, 4, 0.1, hair, 0.3); soft(c, -7.6, -33, 3.4, 8, 0.25, hair, 0.3);             // soft hairline
      if (s.stubble) soft(c, 6, -9, 8, 5, 0, '#1a1210', 0.14);
      // LIPS: a clearly bowed upper lip (two peaks, a dip under the philtrum), a fuller lighter lower lip
      const up = darken(lip, 0.16), lf = 1 + Math.max(0, sm) * 0.12;
      c.fillStyle = up; c.beginPath(); c.moveTo(mx - Lw, cyL);
      c.bezierCurveTo(mx - 2.6, my - 1.5, mx - 1.9, my - 2.0, mx - 1.0, my - 1.95); c.quadraticCurveTo(mx - 0.3, my - 1.9, mx + 0.25, my - 1.5);
      c.quadraticCurveTo(mx + 0.8, my - 1.95, mx + 1.4, my - 1.9); c.bezierCurveTo(mx + 2.0, my - 1.85, mx + 2.4, my - 1.4, mx + Rw, cyR);
      c.bezierCurveTo(mx + 1.2, my + 0.25, mx - 1.6, my + 0.3, mx - Lw, cyL); c.fill();
      c.fillStyle = lip; c.beginPath(); c.moveTo(mx - Lw * 0.92, cyL + 0.2); c.bezierCurveTo(mx - 1.6, my + 0.3, mx + 1.2, my + 0.25, mx + Rw * 0.92, cyR + 0.2);
      c.bezierCurveTo(mx + 1.7, my + 2.7 * lf, mx - 2.2, my + 2.95 * lf, mx - Lw * 0.92, cyL + 0.2); c.fill();
      // a light edge just above the upper lip (the lit vermilion border), the moist highlight on the lower lip
      soft(c, mx - 0.4, my - 2.3, 2.4, 0.42, 0, lighten(skin, 0.5), 0.35);
      soft(c, mx - 0.4, my + 1.35, 1.8, 0.8, 0, '#fff0ea', fem ? 0.55 : 0.24); soft(c, mx - 1.2, my - 0.95, 1.1, 0.36, -0.2, '#ffe6e0', fem ? 0.28 : 0.1);
      c.restore();
    },
    over(g) {
      const eo = { lid, squint, kohl: s.kohl ?? (fem ? 1 : 0.55), gaze: s.gaze ?? 0, iris: s.iris, shade };
      lotusEye(g, ex, ey, ew, eh, 1, eo); lotusEye(g, fx, ey - 0.05, fw, eh * 0.94, -1, { ...eo, look: -0.3 });
      // brows: one shaped stroke each; a heavier brow sits lower and flatter, a light one higher and more arched
      const tilt = (s.browTilt ?? 0) * 0.5 + (bw > 0 ? bw * 0.62 : bw * 0.55), arch = 1.9 - Math.max(0, bw) * 0.4 + (fem ? 0.2 : 0) - heavy * 0.35, th = (fem ? 0.6 : 0.86) * (s.browW ?? 1) * (0.7 + heavy * 0.5), bc = rgba(darken(hair, fem ? 0.1 : 0.25), 0.95);
      const by = ey - (4.3 - heavy * 0.8) - (fem ? 0.25 : 0);
      brow(g, ex - 0.2, by, ew, 1, th, tilt, arch, bc); brow(g, fx + 0.1, by - 0.05, fw * 0.98, -1, th * 0.82, tilt * 0.9, arch * 0.8, bc);
      // NOSE: the shadow-side line of the bridge, thin, fading in from the inner brow down to the wing; the far
      // wing's small curve; the nostrils as two small soft darks - never an outline round the whole nose
      ink(g, bez([7.9, -29.4, 7.4, -26.5, 7.1, -23.5, 7.25, -20.6]), 0.28, rgba(shade, 0.32), (t) => Math.sin(t * Math.PI) * 0.8 + t * 0.2);
      ink(g, quad([7.3, -20.4, 6.8, -18.8, 7.9, -17.9]), 0.32, rgba(shade, 0.6), peak(0.5));
      ink(g, quad([11.55, -20.3, 12.2, -18.9, 11.35, -17.95]), 0.3, rgba(shade, 0.48), peak(0.5));
      g.fillStyle = rgba(darken(shade, 0.5), 0.6); g.beginPath(); g.ellipse(10.55, -18.2, 0.7, 0.34, -0.25, 0, TAU); g.fill();
      g.fillStyle = rgba(darken(shade, 0.5), 0.48); g.beginPath(); g.ellipse(8.55, -18.05, 0.62, 0.32, 0.3, 0, TAU); g.fill();
      // philtrum: two faint lines from the nose to the bow of the lip
      ink(g, quad([9.35, -17.4, 9.2, -16.0, 9.3, -15.0]), 0.22, rgba(shade, 0.3), peak(0.4)); ink(g, quad([8.25, -17.3, 8.15, -16.0, 8.5, -15.05]), 0.22, rgba(shade, 0.22), peak(0.4));
      // the seam between the lips: one confident stroke, darkest and widest at the centre, lifted at the corners
      const s0 = Math.max(0, sm);
      ink(g, bez([mx - Lw - 0.2, cyL - s0 * 0.12, mx - 1.9, my + 0.4 + s0 * 0.25, mx + 1.2, my + 0.32 + s0 * 0.2, mx + Rw + 0.15, cyR - s0 * 0.1]), 0.5, rgba(darken(lip, 0.72), 0.88), peak(0.45));
      if (sm > 1.0) { g.fillStyle = 'rgba(250,244,234,0.95)'; g.beginPath(); g.moveTo(mx - 2.4, my - 0.05); g.quadraticCurveTo(mx - 0.2, my + 1.3, mx + 1.9, my); g.quadraticCurveTo(mx - 0.2, my + 0.4, mx - 2.4, my - 0.05); g.fill(); }
      soft(g, mx - Lw - 0.5, cyL, 0.8, 0.9, 0, shade, 0.28 + s0 * 0.2); soft(g, mx + Rw + 0.3, cyR, 0.6, 0.8, 0, shade, 0.24);
      // a faint accent along the shadow-side jaw (structure without a cartoon outline)
      ink(g, jawPt, 0.36, rgba(cool, fem ? 0.22 : 0.3), (t) => Math.sin(t * Math.PI) * (t < 0.5 ? 0.8 : 1));
      if (s.noseStud) { g.fillStyle = '#f0c456'; g.beginPath(); g.arc(7.75, -18.95, 0.5, 0, TAU); g.fill(); g.fillStyle = '#fff8e0'; g.beginPath(); g.arc(7.65, -19.1, 0.2, 0, TAU); g.fill(); }
    },
  });
}

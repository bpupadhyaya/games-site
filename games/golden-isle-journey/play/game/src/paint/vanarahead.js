// Vanara (monkey-folk) head, painted in relief: tufted cream-gold ruff, modelled pink-tan face with a heavy brow
// and a broad soft muzzle, deep-set warm eyes, tall tiered gold crown with gem settings, pearl drops and tassel.
// Authored facing RIGHT in 3/4 view; pivot = neck base (0,0); face centre near (6,-22).
import { TAU, mix, lighten, darken, rgba, lin, rad, pearl, gem, ink, bez, quad, chain, peak } from './kit.js';
import { relief, furCoat, insideOf, fillShapes, hash1 } from './sculpt.js';
import { exprOf } from './heads.js';
import { goldCrown } from './crown.js';

export function furCols(base) { return [darken(base, 0.3), darken(base, 0.1), lighten(base, 0.14), lighten(base, 0.38)]; }

export function vanaraHead(ctx, s, expr = 'calm') {
  const E = exprOf(expr), fur = s.fur, cream = s.ruff ?? mix(fur, '#fff1d6', 0.72), skin = s.face ?? '#d9a084';
  const cols = furCols(fur), ccols = furCols(cream);
  // ---- 1. neck + back ruff (long tufts flowing down and back onto the shoulders) ----
  const ruffShapes = [{ x: -2, y: -23, rx: 15.5, ry: 16.5 }, { x: -5, y: -8, rx: 12.5, ry: 10 }, { x: 3, y: -3, rx: 11, ry: 7.5 }, { cap: [0, -12, 8, 1, 6, 9] }];
  relief(ctx, {
    mat: 'fur', inflate: 7, depth: 6, bump: 0.55,
    paint(c) {
      fillShapes(c, ruffShapes, darken(mix(fur, cream, 0.35), 0.3));
      const inside = insideOf(ruffShapes);
      furCoat(c, { box: [-24, -44, 18, 12], inside, n: 9000, len: 3.1, wid: 0.24, seed: 11, jitter: 0.12, tuft: 0, cols,
        flow: (x, y) => Math.atan2(y + 26, x - 8) * 0.55 + (Math.PI * 0.62) * 0.45,
        colAt: (x, y, L, r) => { const k = Math.max(0, Math.min(1, 1.15 - Math.hypot(x - 4, y + 14) / 17)); return mix(cols[L], ccols[L], Math.min(1, k + r * 0.25)); } });
    },
  });
  // ---- 2. ear ----
  relief(ctx, {
    mat: 'skin', inflate: 2.2, depth: 1.6,
    blobs: [{ x: -8.2, y: -23.2, rx: 2.2, ry: 3.6, rot: 0.2, z: -1.3 }],
    paint(c) {
      c.fillStyle = rad(c, -8, -23, 0, 6, [[0, mix(skin, '#c0605a', 0.45)], [1, darken(skin, 0.18)]]);
      c.beginPath(); c.moveTo(-5.4, -29); c.bezierCurveTo(-11, -31.5, -14, -26, -12.6, -21.4); c.bezierCurveTo(-11.6, -17.6, -7.6, -16.4, -5, -18.6); c.closePath(); c.fill();
    },
    over(g) { g.strokeStyle = rgba(darken(skin, 0.6), 0.55); g.lineWidth = 0.6; g.beginPath(); g.moveTo(-6.4, -27.4); g.bezierCurveTo(-10.4, -28.6, -12, -24.6, -10.6, -21); g.stroke(); },
  });
  // ---- 3. furred cranium ----
  const skull = [{ x: 1.5, y: -27, rx: 15, ry: 14.5 }, { x: 4, y: -15, rx: 11, ry: 9 }];
  relief(ctx, {
    mat: 'fur', inflate: 8, depth: 7, bump: 0.6,
    paint(c) {
      fillShapes(c, skull, darken(fur, 0.25));
      furCoat(c, { box: [-15, -43, 18, -5], inside: insideOf(skull), n: 5200, len: 2.3, wid: 0.22, seed: 23, jitter: 0.12, tuft: 0, cols, flow: (x, y) => Math.atan2(y + 24, x - 10),
        colAt: (x, y, L, r) => mix(cols[L], ['#1c0f0a', '#2a1810', '#3a2216', '#4a2e1e'][L], Math.max(0, Math.min(0.9, (-27 - y) / 6 + (2 - x) / 14 + (r - 0.5) * 0.3))) });   // darker hair under the crown and at the temples
    },
  });
  // ---- 4. the face: pink-tan skin mask, sculpted ----
  const bw = E.brow, sm = E.mouth;
  const mask = (c) => {
    c.beginPath(); c.moveTo(1.5, -33.5);
    c.bezierCurveTo(6, -36.5, 12, -36, 14.6, -32.4);              // forehead
    c.bezierCurveTo(16.6, -30.6, 16.6, -28.2, 15.2, -26.6);        // brow overhang
    c.bezierCurveTo(14.4, -25, 15.4, -23.6, 17.2, -22.4);          // socket dip, bridge
    c.bezierCurveTo(19.9, -21.2, 21.3, -18.6, 21, -15.8);            // muzzle top, nose
    c.bezierCurveTo(21, -13.4, 20.3, -11.4, 19.1, -10);            // lips
    c.bezierCurveTo(18, -7.2, 14, -5.4, 9.6, -5.8);                // chin
    c.bezierCurveTo(4.6, -6.4, 0.4, -9.6, -1.4, -14.6);            // jaw
    c.bezierCurveTo(-3.2, -19.6, -3.4, -27, 1.5, -33.5); c.closePath();
  };
  relief(ctx, {
    mat: 'skin', inflate: 6.5, depth: 6.5, aoR: 3, rim: 0.1,
    blobs: [
      { cap: [2.5, -29.6 + bw * 0.25, 2.5, 15, -29.2 - bw * 0.35, 2.7], z: 1.5 },   // brow ridge
      { x: 8.4, y: -25.2, rx: 5, ry: 3.3, z: -1.2 },                               // near eye socket
      { x: 15.6, y: -25, rx: 2.5, ry: 2.6, z: -0.8 },                                // far eye socket
      { x: 12.6, y: -24.4, rx: 1.6, ry: 3.6, z: 1.2 },                               // nose bridge
      { x: 14.8, y: -15, rx: 8.6, ry: 7.6, z: 4.4 },                                 // broad muzzle dome
      { x: 17.8, y: -19, rx: 3.2, ry: 2.5, z: 1.7 },                                 // nose pad
      { x: 5, y: -17.8, rx: 6, ry: 5.6, z: 1.4 + Math.max(0, sm) * 0.3 },          // cheek
      { cap: [21, -12.4 - sm * 0.1, 0.9, 11, -12.7 - sm * 0.45, 0.7], z: -0.9 },    // mouth groove
      { x: 15, y: -8.6, rx: 4.6, ry: 2.6, z: 1.3 },                                  // chin / lower lip
      { cap: [11.6, -20.6, 1.4, 9, -13, 1.5], z: -0.35 },                          // fold from nose to mouth corner
      { x: 17.6, y: -13.6, rx: 0.8, ry: 1.8, z: -0.5 },                              // philtrum
    ],
    paint(c) {
      mask(c); c.fillStyle = skin; c.fill();
      c.save(); mask(c); c.clip();
      const glow = (x, y, r, col, a) => { c.fillStyle = rad(c, x, y, 0, r, [[0, rgba(col, a)], [1, rgba(col, 0)]]); c.fillRect(x - r, y - r, r * 2, r * 2); };
      glow(15, -14, 10, mix(skin, '#f0a098', 0.6), 0.5);        // rosy muzzle
      glow(5, -17, 6.5, '#d0584a', 0.3); glow(2, -12, 7, mix(skin, '#9a5a44', 0.7), 0.3);                          // cheek warmth
      glow(8.4, -25.4, 6, darken(skin, 0.5), 0.36); glow(15.6, -25.2, 3.4, darken(skin, 0.5), 0.34); glow(9, -29, 8, mix(skin, '#8a4a3a', 0.6), 0.2);   // deep-set eyes
      glow(18.4, -18.4, 3, '#a05a54', 0.4);                  // darker nose pad
      glow(8, -33, 8, lighten(skin, 0.3), 0.4);
      // brows: a soft blurred underwash first (no hard silhouette edge at all) so the strong brow reads as
      // shadowed brow, then dark fur strokes on top for texture/direction - a furCoat band alone, however
      // feathered its inclusion test, still carries a crisp "combed" edge on the side its strokes point
      // toward (their tips), which is what read as a flat painted bar with a ruler-straight top edge
      glow(7, -30.3 + bw * 0.15, 5.2, mix(fur, '#1c0d08', 0.62), 0.42 + Math.max(0, bw) * 0.08); glow(14.4, -29.6 - bw * 0.25, 3.2, mix(fur, '#1c0d08', 0.58), 0.38 + Math.max(0, bw) * 0.08);
      furCoat(c, { box: [2, -32.5, 16.4, -27],
        inside: (x, y) => { const half = 0.62 * (1.1 - Math.abs(x - 8) / 16), d = Math.abs(y - (-29.9 + bw * 0.2 - Math.sin((x - 2) / 14 * Math.PI) * 1.5 - (x - 2) * bw * 0.04)); return d < half * (0.45 + hash1(x * 3.1 + y * 7.7) * 0.95) && (x < 12.2 || x > 13.4); },
        n: 3000, len: 2.1, wid: 0.2, seed: 5, jitter: 0.32, tuft: 0.16, cols: ['#1c0d08', '#2a160e', '#3a2014', '#5a3420'], flow: (x) => -0.25 + (x - 3) * 0.035 - bw * 0.06 });
      c.restore();
    },
    over(g) {
      const eo = { kohl: 0.2, iris: s.iris ?? '#4a2410' }; eye(g, 8.4, -25, 3.8, 1.95 * E.eye, E.lid + 0.1, false, eo); eye(g, 15.6, -24.9, 2.0, 1.75 * E.eye, E.lid + 0.1, true, eo);
      // nostrils
      for (const [x, y, r] of [[18.8, -17.2, 0.8], [16.2, -16.9, 0.65]]) { g.fillStyle = rad(g, x, y, 0, r * 1.5, [[0, 'rgba(30,8,6,0.95)'], [0.6, 'rgba(50,16,12,0.7)'], [1, 'rgba(60,20,14,0)']]); g.beginPath(); g.ellipse(x, y, r * 1.5, r, -0.4, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,230,215,0.5)'; g.beginPath(); g.ellipse(18.6, -20.2, 1.6, 0.7, -0.5, 0, TAU); g.fill();
      // mouth: soft dark line with a lift at the corner
      g.strokeStyle = 'rgba(90,30,26,0.85)'; g.lineWidth = 0.55; g.beginPath(); g.moveTo(20.2, -12.5 - sm * 0.1); g.bezierCurveTo(18, -11.5 + sm * 0.25, 14, -11.8 + sm * 0.15, 11.2, -12.8 - sm * 0.5); g.stroke();
      g.strokeStyle = 'rgba(70,22,18,0.4)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(10.9, -12.8 - sm * 0.5); g.quadraticCurveTo(10.3, -13.2 - sm * 0.5, 10.2, -13.9 - sm * 0.5); g.stroke();
      if (sm > 9) { g.fillStyle = '#f6ecdc'; g.beginPath(); g.moveTo(19.6, -11.9); g.quadraticCurveTo(15.4, -10.2, 11.4, -11.9); g.quadraticCurveTo(15.4, -11.2, 19.6, -11.9); g.fill(); }
      g.fillStyle = 'rgba(255,235,220,0.35)'; g.beginPath(); g.ellipse(16.4, -9.6, 2.6, 0.8, -0.15, 0, TAU); g.fill();
    },
  });
  // ---- 5. cheek and jaw ruff overlapping the edge of the face ----
  const jaw = [{ cap: [-3.6, -26, 2.6, -2.4, -12, 4.4] }, { cap: [-2.4, -12, 4.4, 7, -3.6, 4.2] }, { cap: [7, -3.6, 4.2, 16, -4.4, 2.6] }];
  relief(ctx, {
    mat: 'fur', inflate: 3.4, depth: 3, bump: 0.5, rim: 0.2,
    paint(c) {
      furCoat(c, { box: [-8, -30, 19, 1], inside: insideOf(jaw), n: 6400, len: 2.7, wid: 0.22, seed: 41, jitter: 0.12, tuft: 0, cols: ccols,
        flow: (x, y) => (y < -14 ? Math.PI * 0.72 : Math.PI * 0.5 - (x - 4) * 0.035),
        colAt: (x, y, L, r) => mix(ccols[L], cols[L], Math.max(0, Math.min(1, (-x - 1) / 6 + r * 0.2))) });
    },
  });
  // ---- 6. crown, earring, tassel ----
  if (s.crown !== false) goldCrown(ctx, { cx: 3, base: -34.8, drops: false, w: s.crownW ?? 14.5, tiers: s.tiers ?? 3, gems: s.gems, tilt: -0.07, tassel: s.tassel !== false, scale: s.crownS ?? 1, fan: s.fan, fringe: s.fan });
  else { // circlet only
    ctx.strokeStyle = '#e8b848'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-11, -33); ctx.quadraticCurveTo(3, -38.5, 16, -32.4); ctx.stroke(); gem(ctx, 8, -35.4, 1.5, '#d8283a');
  }
  if (s.earrings !== false) { ctx.strokeStyle = '#f0c45a'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(-8.6, -14.6, 2.8, -1.2, 3.6); ctx.stroke(); pearl(ctx, -8.6, -11, 1.9); gem(ctx, -8.6, -7.6, 1.2, '#d8283a'); pearl(ctx, -8.6, -4.9, 1.2); if (s.longEar) { for (let i = 0; i < 3; i++) pearl(ctx, -8.6, -2.6 + i * 2, 0.9); gem(ctx, -8.6, 3.8, 1.3, '#1fa872'); pearl(ctx, -8.6, 6.4, 1.3); } }
}

// A painted eye: shaded sclera, deep brown iris with limbal ring, catch-light, heavy upper lid, soft lower lid.
export function eye(g, x, y, w, h, lid = 0, far = false, o = {}) {
  const iris = o.iris ?? '#5a3016', kohl = o.kohl ?? 0;
  const shape = () => { g.beginPath(); g.moveTo(x - w, y + h * 0.25); g.bezierCurveTo(x - w * 0.5, y - h * 1.15, x + w * 0.45, y - h * 1.2, x + w, y - h * 0.05); g.bezierCurveTo(x + w * 0.4, y + h * 0.95, x - w * 0.5, y + h * 0.9, x - w, y + h * 0.25); g.closePath(); };
  g.save(); shape(); g.clip();
  g.fillStyle = lin(g, x - w, 0, x + w, 0, [[0, '#b8a493'], [0.3, '#f4ebdd'], [0.75, '#efe4d2'], [1, '#b09a88']]); g.fillRect(x - w, y - h * 1.5, w * 2, h * 3);
  const ix = x + w * (far ? 0.2 : 0.22), ir = Math.min(w * 0.56, h * 1.12);
  g.fillStyle = rad(g, ix, y, 0, ir, [[0, lighten(iris, 0.25)], [0.55, iris], [0.85, darken(iris, 0.6)], [1, '#0c0504']], ix + ir * 0.2, y + ir * 0.35); g.beginPath(); g.arc(ix, y - h * 0.05, ir, 0, TAU); g.fill();
  g.fillStyle = '#060202'; g.beginPath(); g.arc(ix, y - h * 0.05, ir * 0.45, 0, TAU); g.fill();
  g.fillStyle = lin(g, 0, y - h * 1.3, 0, y - h * 0.2 + lid * h, [[0, 'rgba(20,6,4,0.75)'], [1, 'rgba(20,6,4,0)']]); g.fillRect(x - w, y - h * 1.4, w * 2, h * 1.4 + lid * h);   // lid shadow
  g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(ix + ir * 0.36, y - h * 0.42, Math.max(0.28, ir * 0.24), 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,240,220,0.35)'; g.beginPath(); g.arc(ix - ir * 0.35, y + h * 0.3, ir * 0.3, 0, TAU); g.fill();
  g.restore();
  // DRAWN layer: the upper-lid line as one tapered ink stroke, thin at the inner corner, swelling over the outer
  // third and carried past the corner as a small wing; then the crease above it (structure the relief cannot give)
  const wing = (far ? 0.25 : 0.55) + kohl * 0.6, U = [x - w, y + h * 0.3, x - w * 0.5, y - h * 1.2, x + w * 0.45, y - h * 1.25, x + w, y - h * 0.05];
  ink(g, chain(bez(U), quad([x + w, y - h * 0.05, x + w + wing * 0.5, y - h * 0.12, x + w + wing, y - h * 0.2 - wing * 0.35]), 0.82), (far ? 0.7 : 1.0) + kohl * 0.4, '#1a0806', (t) => (t < 0.1 ? t / 0.1 * 0.3 : t < 0.68 ? 0.3 + (t - 0.1) / 0.58 * 0.7 : 1 - (t - 0.68) / 0.32));
  g.strokeStyle = rgba('#2a0e0a', 0.35 + kohl * 0.4); g.lineWidth = 0.4 + kohl * 0.2; g.beginPath(); g.moveTo(x + w, y - h * 0.05); g.bezierCurveTo(x + w * 0.4, y + h, x - w * 0.5, y + h * 0.95, x - w, y + h * 0.25); g.stroke();
  ink(g, quad([x - w * 0.8, y - h * 1.3, x + w * 0.05, y - h * 2.15 - lid * h * 0.3, x + w * 0.95, y - h * 1.15]), 0.45, 'rgba(40,14,10,0.5)', peak(0.55));   // lid crease
  g.strokeStyle = 'rgba(255,225,205,0.4)'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(x - w * 0.6, y + h * 1.25); g.quadraticCurveTo(x, y + h * 1.6, x + w * 0.7, y + h * 1.05); g.stroke();
}

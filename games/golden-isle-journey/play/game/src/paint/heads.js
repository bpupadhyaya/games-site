// Human heads in painted relief. Authored facing RIGHT in 3/4 view; pivot = neck base (0,0); eyes on y = -26.
// A spec `s` sets: skin, hair, fem, head ('crown' | 'tiara' | 'knot' | 'bun' | 'turban' | 'helm'), beard, stache,
// longBeard, brow (heaviness), jaw (width), gems, tiers, crownW, spikes, earrings, flowerBand.
// Expressions: calm, determined, sorrowful, joyful, wrathful (pose.expr).
import { TAU, mix, lighten, darken, rgba, lin, rad, pearl, gem } from './kit.js';
import { relief, furCoat, insideOf, fillShapes, hash1 } from './sculpt.js';
import { goldCrown } from './crown.js';
import { eye } from './vanarahead.js';
import { shadowed } from './parts.js';
import { nobleFace, ink } from './noble.js';

const EXPR = {
  calm:       { brow: 0, mouth: 0.55, eye: 1, lid: 0 },
  determined: { brow: 1.3, mouth: -0.15, eye: 0.9, lid: 0.25 },
  sorrowful:  { brow: -1.5, mouth: -0.6, eye: 0.85, lid: 0.4 },
  joyful:     { brow: -0.4, mouth: 1.2, eye: 0.78, lid: 0.1 },
  wrathful:   { brow: 2.2, mouth: -0.7, eye: 1.05, lid: 0.3 },
};
export const exprOf = (e) => EXPR[e] ?? EXPR.calm;
// kept for older callers: a tiered crown centred at (cx, baseY)
export function tieredCrown(ctx, cx, baseY, w, tiers, o = {}) { goldCrown(ctx, { cx, base: baseY, w, tiers, gems: o.gems, spikes: o.spikes, drops: false }); return baseY - 14 - tiers * 7; }

// glossy black hair of the noble leads: fine long strands, low bump, a broad soft sheen
const GLOSS_MAT = { wrap: 0.3, sss: 0, spec: 0.2, shine: 22, rim: 0.22, ao: 1, mottle: 0.02 };
const glossCols = (hair) => ['#040202', hair, mix(hair, '#2a2024', 0.5), mix(hair, '#463a40', 0.5)];
const HAIR_MAT = { wrap: 0.3, sss: 0, spec: 0.2, shine: 20, rim: 0.5, ao: 1, mottle: 0.03 };
function clipShapes(c, shapes) { c.beginPath(); for (const s of shapes) { if (s.cap) { const [ax, ay, r0, bx, by, r1] = s.cap, an = Math.atan2(by - ay, bx - ax); c.moveTo(ax + Math.cos(an + Math.PI / 2) * r0, ay + Math.sin(an + Math.PI / 2) * r0); c.arc(ax, ay, r0, an + Math.PI / 2, an - Math.PI / 2); c.arc(bx, by, r1, an - Math.PI / 2, an + Math.PI / 2); c.closePath(); } else { c.moveTo(s.x + s.rx * Math.cos(s.rot ?? 0), s.y + s.rx * Math.sin(s.rot ?? 0)); c.ellipse(s.x, s.y, s.rx, s.ry, s.rot ?? 0, 0, TAU); } } c.clip(); }
function strands(c, shapes, box, hair, o = {}) {
  fillShapes(c, shapes, darken(hair, 0.2)); c.save(); clipShapes(c, shapes); strandsIn(c, shapes, box, hair, o); c.restore();
}
function strandsIn(c, shapes, box, hair, o) {
  furCoat(c, { box, inside: insideOf(shapes), n: o.n ?? 1400, len: o.len ?? 9, wid: o.wid ?? 0.34, seed: o.seed ?? 61, jitter: o.jit ?? 0.12, tuft: 0, cols: o.cols || [darken(hair, 0.4), darken(hair, 0.15), hair, lighten(hair, 0.09)], flow: o.flow ?? (() => Math.PI / 2) });
}

// Long hair behind the head and shoulders (drawn BEFORE the torso; pivot: neck base).
export function humanHairBack(ctx, s) {
  // a noble MAN's hair is worn at true shoulder length, gathered under the crown, not flowing loose down the
  // back like a woman's - the single biggest reason the leads used to read as interchangeably female.
  const hair = s.hair ?? '#1b100c', len = s.hairLong ? (s.fem ? 40 : s.noble ? 11 : 12) : 4, nb = !!s.noble;
  const shapes = [{ x: -3, y: -24, rx: 13.5, ry: 17 }, { cap: [-7, -12, 10, -8, len * 0.6, 8.5] }, { cap: [-8, len * 0.6, 8.5, -6, len, 4] }];
  if (nb && !s.fem) shapes.push({ x: -13, y: len - 1, rx: 3.4, ry: 3 }, { x: -2, y: len + 1, rx: 3.6, ry: 2.6 });   // soft curled ends on the shoulders
  relief(ctx, { mat: nb ? GLOSS_MAT : HAIR_MAT, inflate: 6, depth: 5, bump: nb ? 0.2 : 0.5, amb: nb ? [0.3, 0.27, 0.33] : [0.5, 0.45, 0.5], paint(c) { strands(c, shapes, [-24, -44, 8, len + 6], hair, { n: nb ? 5200 : 3200, len: nb ? 15 : 9, wid: nb ? 0.17 : 0.34, jit: nb ? 0.05 : 0.12, cols: nb ? glossCols(hair) : null, flow: (x, y) => Math.PI / 2 + Math.sin(y * 0.12 + x * 0.2) * (nb ? 0.3 : 0.22) + (y < -20 ? 0.5 : 0) }); } });
}

export function humanHead(ctx, s, expr = 'calm') {
  const E = exprOf(expr), skin = s.skin, hair = s.hair ?? '#1b100c', fem = !!s.fem, bw = E.brow, sm = E.mouth, heavy = s.brow ?? (fem ? 0.3 : 0.8), jw = s.jaw ?? (fem ? -0.8 : 0.4);
  const lip = fem ? '#b8323e' : mix(skin, '#8a3a36', 0.38);
  // ---- neck ----
  relief(ctx, { mat: 'skin', inflate: 5, depth: 4.5, blobs: [{ cap: [3.4, -12, 1.6, 0.5, 1, 1.4], z: s.noble ? 0 : 0.9 }, { x: 4.6, y: -7.4, rx: 1.6, ry: 1.4, z: fem ? 0 : s.noble ? 0.15 : 0.8 }],
    paint(c) { c.fillStyle = darken(skin, 0.08); c.beginPath(); c.moveTo(-8 + (fem ? 1.6 : 0), 5); c.quadraticCurveTo(-5.4 + (fem ? 0.8 : 0), -2, -5.6 + (fem ? 0.8 : 0), -14); c.lineTo(7.6 - (fem ? 0.8 : 0), -11); c.quadraticCurveTo(7.6 - (fem ? 0.6 : 0), -2, 10 - (fem ? 1.4 : 0), 5); c.closePath(); c.fill(); } });
  // ---- ear ----
  relief(ctx, { mat: 'skin', inflate: 1.8, depth: 1.4, blobs: [{ x: -8.6, y: -23.4, rx: 1.6, ry: 3, z: -1 }],
    paint(c) { c.fillStyle = mix(skin, '#b8584a', 0.25); c.beginPath(); c.moveTo(-7, -28.4); c.bezierCurveTo(-11.6, -30, -12.8, -24.6, -11.4, -20.6); c.bezierCurveTo(-10.6, -18, -8, -17.6, -7, -19.6); c.closePath(); c.fill(); },
    over(g) { g.strokeStyle = rgba(darken(skin, 0.6), 0.5); g.lineWidth = 0.5; g.beginPath(); g.moveTo(-7.8, -27.2); g.bezierCurveTo(-10.6, -28, -11.4, -24.4, -10.4, -21.4); g.stroke(); } });
  // ---- face ----
  const mask = (c) => {
    c.beginPath(); c.moveTo(-11, -24);
    c.bezierCurveTo(-12, -36, -3, -43, 5.6, -41.6); c.bezierCurveTo(10.6, -40.6, 14, -36.4, 14.6, -31.4);
    c.bezierCurveTo(14.9, -29.6, 14.5, -28.2, 14.6, -26.4); c.bezierCurveTo(14.8, -24.4, 15.7, -23, 15.5, -20.8);
    c.bezierCurveTo(15.3, -17.6, 14.4, -14.6, 13.4, -12); c.bezierCurveTo(12.6, -9.6, 11.6 + jw * 0.2, -6.4, 9.4, -5);
    c.bezierCurveTo(7.4, -3.9 - jw * 0.2, 3, -4 - jw * 0.4, -2, -6.4 - jw * 0.3); c.bezierCurveTo(-6 - jw, -8.6, -8.4 - jw * 0.7, -11, -9.6 - jw * 0.5, -14.6);
    c.bezierCurveTo(-10.6, -17, -11, -20, -11, -24); c.closePath();
  };
  if (s.noble) nobleFace(ctx, s, E); else {
  shadowed(ctx, (g) => { mask(g); g.fillStyle = '#000'; g.fill(); }, 2.6, 2.8, 'rgba(30,8,6,0.5)');
  const ex = 3.7, fx = 12.1, ey = -26, mx = 9.2, my = -12.4;
  relief(ctx, {
    mat: 'skin', inflate: 7, depth: 6.6, aoR: 2.6, rim: 0.25,
    blobs: [
      { x: 3, y: -35, rx: 11.5, ry: 6.5, z: 1.3 },
      { cap: [-1.4, -30 + bw * 0.22, 1.8, 7, -30.4 - bw * 0.15, 1.7], z: 0.4 + heavy }, { cap: [10.4, -30.3, 1.4, 13.8, -30, 1.3], z: 0.3 + heavy * 0.8 },
      { x: ex, y: ey - 0.2, rx: 4.4, ry: 2.5, z: -1.5 - heavy * 0.5 }, { x: fx, y: ey - 0.2, rx: 2.3, ry: 2.2, z: -1.2 - heavy * 0.4 },
      { cap: [8.7, -29, 1.15, 11.6, -20, 1.8], z: fem ? 2 : 2.7 }, { x: 12.2, y: -19, rx: fem ? 2 : 2.4, ry: fem ? 1.7 : 2, z: fem ? 1.5 : 1.9 }, { x: 9.4, y: -18.2, rx: 1.6, ry: 1.3, z: 1.1 }, { x: 13.9, y: -18.4, rx: 1, ry: 1.1, z: 0.6 },
      { x: 0.6, y: -21, rx: 6, ry: 4.2, z: 1.3 + Math.max(0, sm) * 0.5 }, { x: 1.6, y: -14.4, rx: 5.6, ry: 5.4, z: 0.7 }, { x: 14, y: -21.4, rx: 1.8, ry: 3, z: 0.5 },
      { x: mx + 0.4, y: my - 2.3, rx: 4, ry: 1.7, z: 0.9 }, { x: mx + 0.2, y: my - 0.8, rx: 3.2, ry: 0.95, z: 0.8 }, { x: mx, y: my + 1, rx: 2.8, ry: 1.2, z: 1.25 },
      { cap: [mx - 3.6, my - 0.1 - sm * 0.5, 0.5, mx + 2.9, my - 0.1 - sm * 0.2, 0.5], z: -0.9 }, { x: mx - 0.2, y: my + 2.8, rx: 2.6, ry: 1, z: -0.6 }, { x: mx - 0.6, y: my + 5.6, rx: 3.6, ry: 2.7, z: 1.4 },
      { cap: [7.4, -17.2, 1, 4.6, -11.4, 1.1], z: -0.2 - Math.max(0, sm) * 0.4 },
    ],
    paint(c) {
      mask(c); c.fillStyle = skin; c.fill(); c.save(); mask(c); c.clip();
      const glow = (x, y, r, col, a) => { c.fillStyle = rad(c, x, y, 0, r, [[0, rgba(col, a)], [1, rgba(col, 0)]]); c.fillRect(x - r, y - r, r * 2, r * 2); };
      glow(1, -18, 7, '#d8584e', fem ? 0.32 : 0.16); glow(12.2, -19, 3, '#d06a5a', 0.25); glow(-9, -22, 6, '#c8685a', 0.2);
      glow(ex, ey, 5, darken(skin, 0.5), 0.4); glow(fx, ey, 3, darken(skin, 0.5), 0.4); glow(4, -36, 9, lighten(skin, 0.22), 0.35);
      if (s.stubble) glow(6, -9, 9, '#1a1210', 0.22);
      // lips: darker upper with a cupid's bow, fuller lighter lower
      const L0 = mx - 3.6, L1 = mx + 2.9, cy0 = my - sm * 0.8, cy1 = my - sm * 0.35;
      c.fillStyle = rgba(darken(lip, 0.18), 0.95); c.beginPath(); c.moveTo(L0, cy0); c.bezierCurveTo(mx - 2, my - 1.5, mx - 0.4, my - 1.5, mx + 0.4, my - 1.1); c.bezierCurveTo(mx + 1.2, my - 1.6, mx + 2.2, my - 1.2, L1, cy1); c.bezierCurveTo(mx + 1, my + 0.3, mx - 1.6, my + 0.3, L0, cy0); c.fill();
      c.fillStyle = rgba(lighten(lip, 0.1), 0.95); c.beginPath(); c.moveTo(L0, cy0); c.bezierCurveTo(mx - 1.6, my + 0.3, mx + 1, my + 0.3, L1, cy1); c.bezierCurveTo(mx + 1.6, my + 2.2 + Math.max(0, sm) * 0.3, mx - 2, my + 2.5 + Math.max(0, sm) * 0.3, L0, cy0); c.fill();
      // brows: fine hairs along an arch
      const arch = (x) => -30.2 + bw * 0.25 - Math.sin(Math.max(0, Math.min(1, (x + 1.2) / 8.8)) * Math.PI) * (1.5 - bw * 0.25) - Math.max(0, x - 3) * bw * 0.09;
      furCoat(c, { box: [-1.2, -33.4, 7.8, -28], inside: (x, y) => Math.abs(y - arch(x)) < (fem ? 0.4 : 0.6) * (1.15 - Math.abs(x - 2.6) / 7), n: 1700, len: 1.9, wid: 0.22, seed: 9, jitter: 0.2, cols: [darken(hair, 0.2), hair, lighten(hair, 0.1)], flow: (x) => -0.4 + (x + 1) * 0.07 });
      furCoat(c, { box: [10.2, -32.4, 14.2, -29], inside: (x, y) => Math.abs(y - (-30.9 + bw * 0.2 + Math.abs(x - 11.6) * 0.3)) < (fem ? 0.34 : 0.48), n: 500, len: 1.3, wid: 0.2, seed: 19, jitter: 0.2, cols: [darken(hair, 0.2), hair], flow: () => 0.25 });
      c.restore();
    },
    over(g) {
      const ko = { kohl: fem ? 0.9 : 0.2, iris: s.iris ?? '#4a2814' };
      eye(g, ex, ey, fem ? 3.3 : 3.1, (fem ? 1.45 : 1.3) * E.eye, E.lid, false, ko); eye(g, fx, ey - 0.05, fem ? 2.0 : 1.9, (fem ? 1.3 : 1.2) * E.eye, E.lid, true, ko);
      g.fillStyle = 'rgba(40,12,8,0.7)'; g.beginPath(); g.ellipse(12.7, -17.5, 0.9, 0.5, -0.2, 0, TAU); g.fill(); g.fillStyle = 'rgba(40,12,8,0.55)'; g.beginPath(); g.ellipse(10, -17.3, 0.8, 0.45, 0.2, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,240,225,0.5)'; g.beginPath(); g.ellipse(12.3, -20, 0.8, 1.3, -0.3, 0, TAU); g.fill();
      g.strokeStyle = rgba(darken(lip, 0.65), 0.9); g.lineWidth = 0.42; g.beginPath(); g.moveTo(mx - 3.8, my - 0.1 - sm * 0.85); g.bezierCurveTo(mx - 1.6, my + 0.4 + Math.max(0, sm) * 0.2, mx + 1, my + 0.3, mx + 3, my - 0.1 - sm * 0.4); g.stroke();
      if (sm > 0.9) { g.fillStyle = '#f6eee2'; g.beginPath(); g.moveTo(mx - 2.8, my); g.quadraticCurveTo(mx, my + 1.4, mx + 2.4, my); g.quadraticCurveTo(mx, my + 0.4, mx - 2.8, my); g.fill(); }
      g.fillStyle = 'rgba(255,235,225,0.4)'; g.beginPath(); g.ellipse(mx, my + 1.3, 1.4, 0.4, -0.05, 0, TAU); g.fill();
    },
  });
  }
  // ---- beard / moustache (hair strokes in relief) ----
  if (s.beard || s.stache) {
    const bc = s.beard || hair, L = s.longBeard ? 10 + s.longBeard * 12 : 0;
    const shapes = [];
    if (s.beard) shapes.push({ cap: [-8.6, -15, 2.6, -2, -6.4, 4] }, { cap: [-2, -6.4, 4, 8.4, -4.4 + L * 0.5, 4.4 + L * 0.12] }, { cap: [8.4, -5, 3.6, 12.6, -8.6, 1.6] }, { x: 9, y: -8.4, rx: 2.8, ry: 1.3 });
    if (L) shapes.push({ cap: [4, -2, 5.4, 6, L, 2] });
    if (s.stache || s.beard) shapes.push({ cap: [12.4, -14.6, 0.8, 9.4, -14.4, 1.3] }, { cap: [9.4, -14.4, 1.3, 4.6, -11.8 - (s.stacheUp ?? 0) * 3, 0.7] });
    relief(ctx, { mat: HAIR_MAT, inflate: 2.6, depth: 2.2, bump: 1.4, rim: 0.2, paint(c) { strands(c, shapes, [-12, -17, 16, L + 4], bc, { n: 2200 + L * 60, len: 3.4 + L * 0.12, seed: 71, flow: (x, y) => (y < -13.6 ? Math.PI * 0.85 : Math.PI / 2 - (x - 4) * 0.03) }); } });
  }
  headgear(ctx, s, hair);
  if (s.earrings !== false) { ctx.fillStyle = '#e8b848'; ctx.beginPath(); ctx.arc(-9.6, -18.4, 1.3, 0, TAU); ctx.fill(); if (fem) { for (let i = 0; i < 3; i++) pearl(ctx, -9.6, -16 + i * 1.9, 0.85); gem(ctx, -9.6, -9.6, 1.5, s.earGem ?? '#d8283a'); pearl(ctx, -9.6, -7, 0.9); } else { gem(ctx, -9.6, -15.6, 1.5, s.earGem ?? '#d8283a'); pearl(ctx, -9.6, -12.8, 1); } }
}

function headgear(ctx, s, hair) {
  const kind = s.head, fem = !!s.fem;
  // hair over the skull with a hairline and a sideburn / temple lock
  const cap = [{ x: -1.5, y: -31.5, rx: 12.6, ry: 11.6, rot: -0.15 }, { x: 4.5, y: -36.4, rx: 10.4, ry: 6.2, rot: 0.2 }, { cap: [-9.6, -30, 3, -10, -17 - (fem ? 0 : 2), 1.6] }];
  const hairline = (x, y) => { const d = Math.hypot((x - 7) / 12, (y + 27) / 10.6); return d > 1 || (fem && Math.abs(x - 6) < 0.35 && y < -33); };
  if (s.noble && kind !== 'helm' && kind !== 'turban') { // smooth glossy cap: solid base with a clean curved hairline, fine strands swept back along it
    const nc = [cap[0], cap[1], { cap: [-9.6, -30, 3, -9.9, -21.5, 1.3] }], ins = insideOf(nc);
    const top = (x) => (x < 5 ? -29 - 10.5 * Math.sqrt(Math.max(0, 1 - (1 - (x + 8.4) / 13.4) ** 2)) : -39.5 + ((x - 5) / 9.5) ** 2 * 3.5), bare = (x, y) => x > -8.4 && y > top(x);
    relief(ctx, { mat: GLOSS_MAT, inflate: 5, depth: 4.4, bump: 0.2, rim: 0.22, amb: [0.3, 0.27, 0.33],
      paint(c) { c.save(); c.beginPath(); c.rect(-30, -60, 60, 80); c.moveTo(-8.4, 20); for (let x = -8.4; x <= 16; x += 0.4) c.lineTo(x, top(x)); c.lineTo(16, 20); c.closePath(); c.clip('evenodd'); fillShapes(c, nc, hair); clipShapes(c, nc);
        furCoat(c, { box: [-15, -44, 14, -14], inside: (x, y) => ins(x, y) && !bare(x, y), n: 3400, len: 10, wid: 0.16, seed: 83, jitter: 0.05, tuft: 0, cols: glossCols(hair), flow: (x, y) => Math.atan2(y + 27, x - 7) - Math.PI / 2 - 0.12 }); c.restore(); },
      // a few clean strand groups catching the light, swept back from the hairline (so the cap is glossy hair, not a helmet)
      over(g) { const hl = lighten(hair, 0.62); for (let i = 0; i < 7; i++) { const r = 10.6 + i * 0.7 + hash1(i * 3.3) * 0.5, a0 = -3.15 + hash1(i * 5.1) * 0.3, a1 = a0 + 0.45 + hash1(i * 7.7) * 0.4, am = (a0 + a1) / 2; ink(g, (t) => { const a = a0 + (a1 - a0) * t, rr = r + Math.sin(t * Math.PI) * 0.4; return [7 + Math.cos(a) * rr, -27 + Math.sin(a) * rr]; }, 0.5, rgba(hl, 0.26 + hash1(i * 9.7) * 0.14), (t) => Math.sin(t * Math.PI)); void am; } } });
  } else
  if (kind !== 'helm' && kind !== 'turban') relief(ctx, { mat: HAIR_MAT, inflate: 5, depth: 4.4, bump: 0.5, rim: 0.4, amb: [0.5, 0.45, 0.5],
    paint(c) { const ins = insideOf(cap); c.save(); clipShapes(c, cap); furCoat(c, { box: [-15, -44, 13, -14], inside: (x, y) => ins(x, y) && hairline(x, y), n: 3000, len: 6, wid: 0.34, seed: 83, jitter: 0.1, tuft: 0, cols: [darken(hair, 0.4), darken(hair, 0.15), hair, lighten(hair, 0.08)], flow: (x, y) => (fem ? Math.atan2(y + 44, x - 6) : Math.atan2(y + 40, x - 4)) + 0.2 }); c.restore(); } });
  if (kind === 'crown') goldCrown(ctx, { cx: 1.6, base: -36.6, w: s.crownW ?? 12.8, tiers: s.tiers ?? 3, gems: s.gems, spikes: s.spikes, tilt: -0.08, drops: false, velvet: s.velvet, plates: s.plates, plateK: s.plateK, tassel: s.tassel });
  else if (kind === 'tiara') { // low jewelled diadem, centre-parting pendant
    goldCrown(ctx, { cx: 1.4, base: -37, w: 11.6, tiers: 0, gems: ['#d8283a', '#1fa872', '#3a6fd0'], tilt: -0.1, drops: false, plateK: 0.62 });
    ctx.strokeStyle = '#e8b848'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(5.4, -37.4); ctx.quadraticCurveTo(7.6, -35, 8.4, -32.6); ctx.stroke(); gem(ctx, 8.5, -31.6, 1.25, '#d8283a'); pearl(ctx, 8.6, -29.6, 0.7);
  } else if (kind === 'knot') { // forest top-knot bound with a band of small flowers
    const knot = [{ x: -2, y: -45.5, rx: 6.4, ry: 5.6 }, { cap: [-2, -42, 4.6, -1.5, -38, 5.6] }];
    relief(ctx, { mat: HAIR_MAT, inflate: 4, depth: 4, bump: 1.2, paint(c) { strands(c, knot, [-10, -53, 6, -36], hair, { n: 1300, len: 6, seed: 87, flow: (x, y) => Math.atan2(y + 45.5, x + 2) + Math.PI / 2 }); } });
    if (s.flowerBand !== false) relief(ctx, { mat: 'cloth', inflate: 1.4, depth: 1.2, bump: 2, paint(c) { for (let i = 0; i < 9; i++) { const u = i / 8, x = -8 + u * 12.4, y = -40.6 - Math.sin(u * Math.PI) * 1.6; c.fillStyle = i % 3 === 1 ? '#f4c84a' : '#fff6e4'; for (let q = 0; q < 5; q++) { const a = q / 5 * TAU; c.beginPath(); c.arc(x + Math.cos(a) * 0.8, y + Math.sin(a) * 0.8, 0.62, 0, TAU); c.fill(); } } } });
    else { ctx.strokeStyle = s.band ?? '#8a6a3a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-8, -40); ctx.quadraticCurveTo(-2, -42.6, 4.4, -40.4); ctx.stroke(); }
  } else if (kind === 'bun') {
    const bun = [{ x: -11.5, y: -33, rx: 6, ry: 5.6 }];
    relief(ctx, { mat: HAIR_MAT, inflate: 4, depth: 4, bump: 1.2, paint(c) { strands(c, bun, [-19, -40, -4, -26], hair, { n: 900, len: 5, seed: 89, flow: (x, y) => Math.atan2(y + 33, x + 11.5) + Math.PI / 2 }); } });
    relief(ctx, { mat: 'cloth', inflate: 1.2, depth: 1, bump: 2, paint(c) { for (let i = 0; i < 8; i++) { const a = -2.6 + i * 0.5, x = -11.5 + Math.cos(a) * 6, y = -33 + Math.sin(a) * 5.6; c.fillStyle = '#fff6e4'; c.beginPath(); c.arc(x, y, 1.1, 0, TAU); c.fill(); } } });
  } else if (kind === 'turban') {
    const col = s.cloth ?? '#d9a03a';
    relief(ctx, { mat: 'cloth', inflate: 6, depth: 5.4, heightFn: (x, y) => Math.sin((y + x * 0.45) * 1.15) * 0.75, aoR: 2,
      paint(c) { c.fillStyle = col; c.beginPath(); c.moveTo(-12.4, -28.6); c.bezierCurveTo(-16.4, -42, -2, -51, 9.6, -44.4); c.bezierCurveTo(14.6, -41, 15, -35.6, 13.8, -32); c.bezierCurveTo(5, -36.6, -5, -34, -12.4, -28.6); c.closePath(); c.fill(); c.strokeStyle = darken(col, 0.3); c.lineWidth = 0.5; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-13 + i, -31 - i * 3.6); c.quadraticCurveTo(0, -39 - i * 3.4, 13.4 - i * 0.7, -33.4 - i * 2.4); c.stroke(); } },
      over(g) { gem(g, 9.6, -36.6, 1.4, '#d8283a'); pearl(g, 9.7, -34, 0.8); } });
  } else if (kind === 'helm') {
    relief(ctx, { mat: 'iron', inflate: 6, depth: 6, bump: 1, paint(c) { c.fillStyle = '#5a5058'; c.beginPath(); c.moveTo(-12.6, -24); c.bezierCurveTo(-15, -44, 3, -48, 13.6, -36); c.lineTo(14, -30.6); c.quadraticCurveTo(2, -33, -8.4, -28.6); c.lineTo(-8.6, -18); c.lineTo(-12.2, -18); c.closePath(); c.fill(); c.fillStyle = '#d9a238'; c.beginPath(); c.moveTo(-8.4, -31); c.quadraticCurveTo(2, -35.6, 14, -32.6); c.lineTo(14, -30.6); c.quadraticCurveTo(2, -33, -8.4, -28.6); c.fill(); } });
    relief(ctx, { mat: 'stone', inflate: 2.4, depth: 2.4, key: [1.3, 1.2, 1.0], paint(c) { c.fillStyle = '#e8dcc0'; c.beginPath(); c.moveTo(-7, -40); c.quadraticCurveTo(-19, -46, -15, -60); c.quadraticCurveTo(-11, -48, -2, -43); c.fill(); c.beginPath(); c.moveTo(6, -42); c.quadraticCurveTo(16, -52, 10, -64); c.quadraticCurveTo(5, -52, 0, -44); c.fill(); } });
    relief(ctx, { mat: 'cloth', inflate: 2, depth: 2, heightFn: (x, y) => Math.sin(x * 1.6 + y) * 0.4, paint(c) { c.fillStyle = '#c23a30'; c.beginPath(); c.moveTo(-1, -45); c.quadraticCurveTo(-11, -62 - (s.plume ?? 0), -2, -71); c.quadraticCurveTo(1, -58, 4.6, -45); c.fill(); } });
    gem(ctx, 6, -32.4, 1.5, '#e8b030');
  }
}

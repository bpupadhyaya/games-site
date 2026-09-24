// The ten-crowned king: one commanding central head with a spiked crown, nine smaller crowned heads fanned behind
// the shoulders like a peacock's tail, a broad jewelled collar, ordered radiating arms, and the carved gold throne
// framed by serpent coils. Everything is cached relief art; per frame only sprites are posed.
import { TAU, sprite, blit, tinted, lin, rad, pearl, gem, rosette, lighten, darken, rgba } from './kit.js';
import { partsFor } from './rig.js';
import { drawProp } from './props.js';
import { relief, hash1 } from './sculpt.js';
import { light } from '../stage.js';

// [x, y (head centre), scale, tilt]: index 0 is the great central head; 1..9 fan from the left shoulder to the right
const FAN_R = 112, FAN_Y = -214;
export const FAN = [[0, -242, 1.62, 0], ...Array.from({ length: 9 }, (_, q) => { const j = q - 4, th = j * 0.335; return [Math.sin(th) * FAN_R * 1.12, FAN_Y - Math.cos(th) * FAN_R, 1.04 - Math.abs(j) * 0.07, th * 0.6]; })];
export const tenHeadPos = (i, x, y, s) => [x + FAN[i][0] * s, y + FAN[i][1] * s];
const EXPRS = ['determined', 'wrathful', 'calm', 'determined', 'joyful', 'calm', 'wrathful', 'determined', 'sorrowful', 'wrathful'];
const ORDER = [1, 9, 2, 8, 3, 7, 4, 6, 5, 0];

function headAt(ctx, i, k, glint) {
  const [hx, hy, , tilt] = FAN[i], { S } = partsFor('ravan', i, false), flip = hx < -4 ? -1 : 1, depth = i === 0 ? 0 : 0.1 + Math.abs(i - 5) * 0.06;
  let sp = S.head(EXPRS[i]); if (depth) sp = tinted(sp, '#1a0a1c', depth);
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(tilt); ctx.translate(0, 24 * k); ctx.scale(flip * k, k);
  if (S.hair) blit(ctx, depth ? tinted(S.hair, '#1a0a1c', depth) : S.hair);
  blit(ctx, sp); ctx.restore();
  if (glint === i) light(ctx, hx, hy - 20, 90, '255,240,170', 0.95);
}

const WEAPONS = ['sword', 'mace', 'spear', 'staff', 'sword', 'spear', 'mace', 'staff'];
// the lap of a seated king seen from the front: silk drape over the knees, shins and feet below
const lapSp = () => sprite('ravan:lap', 190, 150, 95, 30, 3, (c) => {
  const col = '#1f7a50';
  relief(c, { mat: 'silk', inflate: 12, depth: 9, bump: 1.2, aoR: 4,
    blobs: [{ x: -42, y: 22, rx: 30, ry: 24, z: 9 }, { x: 42, y: 22, rx: 30, ry: 24, z: 9 }, { cap: [0, 0, 8, 0, 60, 14], z: -5 }],
    heightFn: (x, y) => Math.sin(x * 0.24 + Math.sin(y * 0.08) * 2) * 1.6 * (0.3 + y / 80) + Math.sin(x * 0.6 + y * 0.1) * 0.5,
    paint(g) { g.fillStyle = col; g.beginPath(); g.moveTo(-36, -8); g.lineTo(36, -8); g.bezierCurveTo(70, -6, 86, 20, 78, 52); g.bezierCurveTo(70, 80, 40, 96, 22, 104); g.quadraticCurveTo(0, 86, -22, 104); g.bezierCurveTo(-40, 96, -70, 80, -78, 52); g.bezierCurveTo(-86, 20, -70, -6, -36, -8); g.closePath(); g.fill();
      g.save(); g.clip(); g.fillStyle = '#f6cf6a'; for (let r = 0; r < 9; r++) for (let k = -8; k <= 8; k++) { const x = k * 11 + (r % 2) * 5.5, y = 4 + r * 11; g.beginPath(); g.moveTo(x, y - 2); g.lineTo(x + 1.8, y); g.lineTo(x, y + 2); g.lineTo(x - 1.8, y); g.fill(); }
      g.strokeStyle = '#e0b030'; g.lineWidth = 7; g.beginPath(); g.moveTo(-78, 52); g.bezierCurveTo(-70, 80, -40, 96, -22, 104); g.quadraticCurveTo(0, 86, 22, 104); g.bezierCurveTo(40, 96, 70, 80, 78, 52); g.stroke(); g.strokeStyle = '#8a1c2c'; g.lineWidth = 2; g.stroke(); g.restore(); } });
});

// x, y = ground under the figure (standing) or the seat front (seated)
export function tenCrowned(ctx, { x, y, s = 1, t = 0, heads, glint = -1, arms = 0, core = 0, seated = false, showArms = true }) {
  const { K, S } = partsFor('ravan', 0, false), B = 1.55;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  // nine heads fanned behind the shoulders, outermost first, each on its own short column of neck
  for (const i of ORDER) { if (i === 0) continue; const v = heads ? heads[i] : 1; if (v <= 0.02) continue; const [hx, hy, sc] = FAN[i];
    headAt(ctx, i, 1.3 * sc * v, glint); }
  // arms: four each side in an ordered radiating fan behind the body, each with its own weapon
  if (showArms) for (const d of [-1, 1]) for (let k = 3; k >= 0; k--) {
    const a1 = d * (0.8 + k * 0.3 + arms * 0.55 - Math.sin(t * 2 + k + d) * 0.04), a2 = a1 + d * (0.55 + arms * 0.3 - k * 0.08);
    ctx.save(); ctx.translate(d * 46, -158 - k * 3); ctx.scale(1.2, 1.2);
    const tn = (sp) => (k > 0 ? tinted(sp, '#1a0a1c', 0.1 + k * 0.07) : sp);
    ctx.save(); ctx.rotate(-a1); blit(ctx, tn(S.armU)); ctx.restore();
    const jx = Math.sin(a1) * K.arm[0], jy = Math.cos(a1) * K.arm[0];
    ctx.save(); ctx.translate(jx, jy); ctx.rotate(-a2); blit(ctx, tn(S.armL)); ctx.restore();
    const hxp = jx + Math.sin(a2) * (K.arm[1] + 3), hyp = jy + Math.cos(a2) * (K.arm[1] + 3);
    drawProp(ctx, WEAPONS[k + (d > 0 ? 4 : 0)], [hxp, hyp], [hxp, hyp], { propA: d * (2.05 - k * 0.16) }, K);
    ctx.restore();
  }
  if (core > 0) { light(ctx, 0, -112, 130 * core, '255,240,170', 0.95); ctx.fillStyle = `rgba(255,246,200,${core})`; ctx.beginPath(); ctx.arc(0, -112, 15, 0, TAU); ctx.fill(); }
  if (seated) { // frontal seat: shins and feet, then the silk lap
    for (const d of [-1, 1]) { ctx.save(); ctx.translate(d * 44, -34); ctx.scale(d * 1.35, 1.35); blit(ctx, S.shin); ctx.translate(0, K.leg); blit(ctx, S.foot); ctx.restore(); }
    ctx.save(); ctx.translate(0, -78); blit(ctx, lapSp()); ctx.restore();
  } else { ctx.save(); ctx.translate(0, -72); ctx.scale(B, B); blit(ctx, S.wrap); ctx.restore(); }
  ctx.save(); ctx.translate(0, -72); ctx.scale(B, B); blit(ctx, S.torso); ctx.restore();
  if (seated) for (const d of [-1, 1]) { // forearms resting on the knees
    ctx.save(); ctx.translate(d * 52, -172); ctx.scale(1.3, 1.3); const a1 = d * 0.42, a2 = d * -0.25; ctx.save(); ctx.rotate(-a1); blit(ctx, S.armU); ctx.restore(); ctx.translate(Math.sin(a1) * K.arm[0], Math.cos(a1) * K.arm[0]); ctx.rotate(-a2); blit(ctx, S.armL); ctx.restore(); }
  const v0 = heads ? heads[0] : 1; if (v0 > 0.02) headAt(ctx, 0, 1.3 * FAN[0][2] * v0, glint);
  ctx.restore();
}

// PERF: the title screen's effigy (showArms:false, standing) only ever touches torso+wrap for the
// body and head(+hair) per fan head - NOT the arms/legs `warmFigureParts` would assume. These mirror
// exactly what tenCrowned()/headAt() touch above, so game.js's title-boot warmup can build the ten
// heads one relief-pass at a time across frames instead of all ten (plus the body) on one frame.
export const HEAD_COUNT = FAN.length;
export function warmBody() { const { S } = partsFor('ravan', 0, false); return [() => void S.torso, () => void S.wrap]; }
export function warmHead(i) {
  const { S } = partsFor('ravan', i, false);
  const tasks = [() => void S.head(EXPRS[i])];
  if ('hair' in S) tasks.push(() => void S.hair);
  return tasks;
}

// portrait bust (inside the arch window; local units ~ 180 x 250): the central head with the fan behind
export function tenBust(ctx) {
  ctx.save(); ctx.translate(0, 318); ctx.scale(1.02, 1.02);
  tenCrowned(ctx, { x: 0, y: 0, s: 1, showArms: false });
  ctx.restore();
}

// ---- the throne: a set piece in gold relief ----
// steps with a crimson runner, a cusped filigree back crowned with flame-leaves, a velvet recess with gold lattice,
// serpent coils rearing over the top (coils = true) or jewelled pillars, armrests, silk cushion, two standing lamps.
const GOLD = '#e2a93c', GOLD_D = '#a8741c', GOLD_L = '#f6d478';
const throneSp = (w, h, coils) => sprite(`throne${w}x${h}${coils}`, w + 150, h + 40, (w + 150) / 2, h + 30, 1.6, (c) => {
  const top = 56, arch = (g, inset, drop) => { g.beginPath(); g.moveTo(-w / 2 + inset, -top); g.lineTo(-w / 2 + inset, -h * 0.45); g.bezierCurveTo(-w / 2 + inset, -h * 0.75, -w * 0.2, -h * 0.82, 0, -h + drop); g.bezierCurveTo(w * 0.2, -h * 0.82, w / 2 - inset, -h * 0.75, w / 2 - inset, -h * 0.45); g.lineTo(w / 2 - inset, -top); g.closePath(); };
  // flame-leaf crest behind the arch
  relief(c, { mat: 'gold', inflate: 4, depth: 3, bump: 1.4, paint(g) { g.fillStyle = GOLD; for (let i = -9; i <= 9; i++) { const a = i / 9 * 1.25, R0 = h * 0.5, cx0 = Math.sin(a) * w * 0.47, cy0 = -h * 0.47 - Math.cos(a) * R0 * 0.98, L = 34 + (9 - Math.abs(i)) * 2.4; g.save(); g.translate(cx0, cy0); g.rotate(a); g.beginPath(); g.moveTo(-11, 6); g.bezierCurveTo(-13, -L * 0.5, -3, -L * 0.7, 2, -L); g.bezierCurveTo(4, -L * 0.6, 13, -L * 0.45, 11, 6); g.closePath(); g.fill(); g.strokeStyle = GOLD_D; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 4); g.quadraticCurveTo(-2, -L * 0.5, 2, -L * 0.9); g.stroke(); g.restore(); } } });
  // back plate with scroll filigree
  relief(c, { mat: 'gold', inflate: 9, depth: 5, bump: 2.2, aoR: 3,
    paint(g) { arch(g, 8, 6); g.fillStyle = GOLD; g.fill(); g.save(); arch(g, 8, 6); g.clip(); g.strokeStyle = GOLD_L; g.lineWidth = 2.2;
      for (let r = 0; r < 26; r++) for (let q = -7; q <= 7; q++) { const x = q * 40 + (r % 2) * 20, y = -top - 16 - r * 34; g.beginPath(); for (let k = 0; k <= 22; k++) { const a = k * 0.42, rr = 2 + k * 0.62; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a + r) * rr, y + Math.sin(a + r) * rr); } g.stroke(); }
      g.restore(); } });
  // velvet recess with a gold lattice and cusped inner arches
  relief(c, { mat: 'cloth', inflate: 6, depth: -3, bump: 1.6,
    paint(g) { arch(g, 40, 44); g.fillStyle = '#5a1222'; g.fill(); g.save(); arch(g, 40, 44); g.clip(); g.strokeStyle = '#c8922c'; g.lineWidth = 1.6; for (let i = -10; i <= 10; i++) { g.beginPath(); g.moveTo(i * 30, -top); g.lineTo(i * 30 + h * 0.5, -h); g.moveTo(i * 30, -top); g.lineTo(i * 30 - h * 0.5, -h); g.stroke(); }
      for (let k = 1; k <= 2; k++) { g.strokeStyle = GOLD; g.lineWidth = 5 - k; g.beginPath(); g.moveTo(-w / 2 + 40 + k * 24, -top); g.lineTo(-w / 2 + 40 + k * 24, -h * 0.4); g.bezierCurveTo(-w * 0.32, -h * 0.66, -w * 0.12, -h * 0.72 + k * 8, 0, -h + 56 + k * 28); g.bezierCurveTo(w * 0.12, -h * 0.72 + k * 8, w * 0.32, -h * 0.66, w / 2 - 40 - k * 24, -h * 0.4); g.lineTo(w / 2 - 40 - k * 24, -top); g.stroke(); } g.restore(); } });
  for (const [x, y, r] of [[0, -h * 0.8, 13], [-w * 0.31, -h * 0.56, 10], [w * 0.31, -h * 0.56, 10]]) rosette(c, x, y, r, '#d8283a', 8);
  // serpents or pillars
  for (const d of [-1, 1]) {
    const bx = d * (w / 2 - 4), pts = [];
    if (coils) { for (let k = 0; k <= 70; k++) { const u = k / 70, y = -top - u * (h * 0.78 - top), x = bx - d * 10 + d * Math.sin(u * 17) * 22 * (1 - u * 0.3); pts.push([x, y]); } for (let k = 1; k <= 14; k++) { const a = k / 14 * 2.1, [x0, y0] = pts[70]; pts.push([x0 - d * (1 - Math.cos(a)) * 60, y0 - Math.sin(a) * 72]); } }
    else for (let k = 0; k <= 10; k++) pts.push([bx - d * 8, -top - k * (h * 0.62 - top) / 10]);
    relief(c, { mat: 'gold', inflate: 9, depth: 9, bump: 1.8, aoR: 3,
      paint(g) { g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = coils ? '#c49a34' : GOLD; g.lineWidth = coils ? 22 : 26; g.beginPath(); pts.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](p[0], p[1])); g.stroke();
        g.strokeStyle = coils ? '#7a5a14' : GOLD_D; g.lineWidth = 1.3; pts.forEach(([x, y], i) => { if (i % 1 === 0 && coils) { g.beginPath(); g.arc(x, y + 3, 7, 0.3, 2.84); g.stroke(); } else if (!coils && i % 2) { g.beginPath(); g.moveTo(x - 13, y); g.lineTo(x + 13, y); g.stroke(); } });
        if (coils) { const [hx, hy] = pts[pts.length - 1]; g.fillStyle = '#c49a34'; g.beginPath(); g.ellipse(hx - d * 6, hy + 6, 30, 22, d * 0.5, 0, TAU); g.fill(); g.beginPath(); g.ellipse(hx - d * 22, hy + 24, 13, 9, d * 0.7, 0, TAU); g.fill(); } },
      over(g) { if (coils) { const [hx, hy] = pts[pts.length - 1]; gem(g, hx - d * 25, hy + 21, 2.6, '#d8283a'); gem(g, hx - d * 6, hy + 2, 4, '#1fa872'); } else { rosette(g, bx - d * 8, -h * 0.64, 11, '#1fa872', 8); for (let k = 1; k < 6; k++) gem(g, bx - d * 8, -top - k * (h * 0.58 - top) / 6, 3.4, k % 2 ? '#d8283a' : '#1fa872'); } } });
  }
  // seat block, armrests, cushion
  relief(c, { mat: 'gold', inflate: 8, depth: 6, bump: 1.8, aoR: 3,
    paint(g) { g.fillStyle = GOLD; g.fillRect(-w * 0.43, -top - 66, w * 0.86, 70); for (const d of [-1, 1]) { g.beginPath(); g.ellipse(d * w * 0.4, -top - 96, 26, 40, 0, 0, TAU); g.fill(); }
      g.fillStyle = GOLD_L; for (let i = -9; i <= 9; i++) { g.beginPath(); g.arc(i * w * 0.043, -top - 58, 3, 0, TAU); g.fill(); g.beginPath(); g.arc(i * w * 0.043, -top - 6, 3, 0, TAU); g.fill(); } g.strokeStyle = GOLD_D; g.lineWidth = 1.4; for (let i = -6; i <= 6; i++) { g.beginPath(); g.arc(i * w * 0.062, -top - 32, 13, 0, TAU); g.stroke(); } },
    over(g) { for (let i = -6; i <= 6; i++) gem(g, i * w * 0.062, -top - 32, 5, i % 2 ? '#1fa872' : '#d8283a'); for (const d of [-1, 1]) rosette(g, d * w * 0.4, -top - 100, 13, '#d8283a', 8); } });
  relief(c, { mat: 'silk', inflate: 12, depth: 9, heightFn: (x) => Math.sin(x * 0.2) * 0.8,
    paint(g) { g.fillStyle = '#1f7a50'; g.beginPath(); g.moveTo(-w * 0.34, -top - 62); g.quadraticCurveTo(0, -top - 104, w * 0.34, -top - 62); g.lineTo(w * 0.34, -top - 50); g.lineTo(-w * 0.34, -top - 50); g.closePath(); g.fill(); g.strokeStyle = GOLD; g.lineWidth = 3; g.beginPath(); g.moveTo(-w * 0.34, -top - 52); g.lineTo(w * 0.34, -top - 52); g.stroke(); } });
  // steps with a crimson runner
  for (let k = 0; k < 3; k++) { const y0 = -top + k * (top / 3), ww = w * (0.92 + k * 0.12);
    relief(c, { mat: 'gold', inflate: 4, depth: 3, bump: 1.4, key: [1.0, 0.9, 0.7], paint(g) { g.fillStyle = k % 2 ? '#c8902c' : GOLD; g.fillRect(-ww / 2, y0, ww, top / 3 + 2); g.fillStyle = GOLD_L; for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(i * ww / 26, y0 + 4); g.lineTo(i * ww / 26 + 5, y0 + top / 6); g.lineTo(i * ww / 26, y0 + top / 3 - 3); g.lineTo(i * ww / 26 - 5, y0 + top / 6); g.fill(); } } }); }
  relief(c, { mat: 'cloth', inflate: 3, depth: 1.5, bump: 1, paint(g) { g.fillStyle = '#8a1428'; g.beginPath(); g.moveTo(-w * 0.13, -top - 2); g.lineTo(w * 0.13, -top - 2); g.lineTo(w * 0.17, 8); g.lineTo(-w * 0.17, 8); g.closePath(); g.fill(); g.strokeStyle = GOLD; g.lineWidth = 3; g.beginPath(); g.moveTo(-w * 0.115, -top); g.lineTo(-w * 0.15, 8); g.moveTo(w * 0.115, -top); g.lineTo(w * 0.15, 8); g.stroke(); } });
  // standing lamps
  for (const d of [-1, 1]) { const lx = d * (w / 2 + 44);
    relief(c, { mat: 'gold', inflate: 5, depth: 5, bump: 1.2, paint(g) { g.fillStyle = GOLD; g.fillRect(lx - 4, -h * 0.34, 8, h * 0.34); for (const [yy, rw, rh] of [[0, 24, 8], [-h * 0.1, 10, 6], [-h * 0.2, 12, 6], [-h * 0.34, 26, 9]]) { g.beginPath(); g.ellipse(lx, yy - 2, rw, rh, 0, 0, TAU); g.fill(); } } });
    c.fillStyle = rad(c, lx, -h * 0.34 - 26, 0, 90, [[0, 'rgba(255,214,120,0.75)'], [0.3, 'rgba(255,160,60,0.3)'], [1, 'rgba(255,140,40,0)']]); c.fillRect(lx - 90, -h * 0.34 - 116, 180, 180);
    c.fillStyle = '#fff2c0'; c.beginPath(); c.moveTo(lx - 7, -h * 0.34 - 8); c.quadraticCurveTo(lx - 9, -h * 0.34 - 28, lx + 1, -h * 0.34 - 48); c.quadraticCurveTo(lx + 9, -h * 0.34 - 26, lx + 7, -h * 0.34 - 8); c.fill(); }
});
export function throne(ctx, x, y, w = 420, h = 520, coils = true) { ctx.save(); ctx.translate(x, y); blit(ctx, throneSp(w, h, coils)); ctx.restore(); }

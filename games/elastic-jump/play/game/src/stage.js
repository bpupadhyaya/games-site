// The playground scene: the wall, the ground, the two holders, the elastic and the jumper, drawn from a small visual state.
// Used by the play screen, the title screen (a looping demo) and, dimmed, behind the menus.
import { POSES } from './moves.js';
import { stageGeo, drawScene, drawKid, drawStrand, drawLoopEnds, KIDS, clamp, lerp, smooth, TAU } from './art.js';

const DEMO_SEQ = [1, 0, 1, 2, 1, 3, 1, 0, 2, 3, 2, 1];

// A visual state for the looping demo: one landing every 0.6 s.
export function demoVisual(t, hgt = 0.34, apexK = 0.15) {
  const step = 0.6, i = Math.floor(t / step), jt = t - i * step;
  const pose = DEMO_SEQ[((i % DEMO_SEQ.length) + DEMO_SEQ.length) % DEMO_SEQ.length], from = DEMO_SEQ[(((i - 1) % DEMO_SEQ.length) + DEMO_SEQ.length) % DEMO_SEQ.length];
  return { hgt, J: { pose, from, jt, jdur: 0.3, apexK, stumble: 0, sinceLand: Math.max(0, jt - 0.3) }, wob: 0.012, wobPh: t * 9, beat: (t / step) % 1 };
}

// V: { hgt, J: {pose, from, jt, jdur, apexK, stumble, sinceLand}, wob, wobPh, beat (0..1 inside the beat) }
export function drawPlayground(ctx, W, H, rect, V, t, o = {}) {
  const g = stageGeo(rect), k = g.Bh, J = V.J;
  drawScene(ctx, W, H, g, t, { vignette: o.vignette });
  const pulse = Math.pow(Math.max(0, 1 - (V.beat ?? 0) * 3.2), 2);
  // jumper feet
  const place = (p) => POSES[p].depth.map((d, i) => ({ x: g.jx + (i ? 1 : -1) * POSES[p].spread * k, y: g.gy + d * g.D, s: 1 + d * 0.02, d }));
  const A = place(J.from), B = place(J.pose);
  const s = clamp(J.jt / J.jdur, 0, 1), e = smooth(s * 1.15);
  const feet = A.map((a, i) => ({ x: lerp(a.x, B[i].x, e), y: lerp(a.y, B[i].y, e), s: lerp(a.s, B[i].s, e), d: lerp(a.d, B[i].d, e) }));
  const air = J.jt < J.jdur ? 4 * s * (1 - s) : 0, lift = air * J.apexK * k;
  const shadowY = feet.map((f) => f.y);
  feet.forEach((f) => { f.y -= lift; });
  const landed = J.jt >= J.jdur, stub = J.stumble;
  const crouch = (landed ? 0.2 * Math.exp(-J.sinceLand * 13) : 0.3 * Math.sin(Math.PI * s)) + 0.025 * pulse + stub * 0.12;
  const flail = Math.sin(t * 28) * stub;
  const pn = POSES[J.pose].id;
  const armBase = 0.22 + (pn === 'split' || pn === 'on' ? 0.38 * (landed ? 1 : e) : 0);
  const arms = armBase + (J.jt < J.jdur ? 0.9 * Math.sin(Math.PI * s) : 0);
  const vy = J.jt < J.jdur ? (4 * (1 - 2 * s) * J.apexK * k) / J.jdur : 0;
  const swing = clamp(-vy * 0.0016, -0.9, 0.9) + flail * 0.4 + Math.sin(t * 5) * 0.06;
  const depthNow = lerp((A[0].d + A[1].d) / 2, (B[0].d + B[1].d) / 2, e);
  const front = depthNow > 1.2;
  // the elastic: pressed down by feet standing on a strand
  const dips = [];
  if (pn === 'on' && landed) {
    const a = 0.035 * k * smooth(J.sinceLand * 12);
    dips.push({ depth: 1, x: B[0].x, a }, { depth: -1, x: B[1].x, a });
  }
  const band = { dips, wob: (V.wob ?? 0) * 0.55, ph: V.wobPh ?? 0, tight: V.hgt > 0.6 ? 1 : 0 };
  // far strand and loop ends first
  drawStrand(ctx, g, V.hgt, -1, band);
  drawLoopEnds(ctx, g, V.hgt);
  // holders
  const holder = (style, x, look, ph) => {
    const sw = Math.sin(t * 2.1 + ph) * 0.03;
    drawKid(ctx, style, { k, x, feet: [{ x: x - 0.055 * k, y: g.gy, s: 1 }, { x: x + 0.055 * k, y: g.gy, s: 1 }], crouch: 0.025 * pulse, lean: sw, armL: 0.2 + 0.1 * pulse, armR: 0.2 + 0.1 * pulse, look, mouth: pulse > 0.4 ? 0.8 : 0 });
  };
  holder(KIDS.holderA, g.ax, 1, 0);
  holder(KIDS.holderB, g.bx, -1, 1.7);
  const drawJ = () => drawKid(ctx, KIDS.jumper, {
    k, x: g.jx, feet, shadowY: Math.max(...shadowY), crouch: clamp(crouch, 0, 0.42), lean: flail * 0.25 + (stub > 0 ? 0.12 * stub : 0), armL: arms + flail * 0.5, armR: arms - flail * 0.5, hairSwing: swing,
    look: stub > 0 ? 0 : 0, mouth: stub > 0.3 ? 1 : pulse > 0.4 ? 0.8 : 0,
  });
  let head = { hcx: g.jx, hcy: g.gy - k };
  if (front) { drawStrand(ctx, g, V.hgt, 1, band); head = drawJ(); }
  else { head = drawJ(); drawStrand(ctx, g, V.hgt, 1, band); }
  return { g, head, pulse };
}
void TAU;

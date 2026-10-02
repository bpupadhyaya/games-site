// Body capsules for the interpenetration check (used by the verification pages and available to the presenter for debugging).
// Two bodies must never pass through each other: at every contact frame the deepest overlap of any two limb capsules is measured.
const SEGS = [
  ['Pelvis', 'Spine', 0.17, 'pelvis'], ['Spine', 'Spine1', 0.17, 'abdomen'], ['Spine1', 'Spine2', 0.17, 'chest'], ['Spine2', 'Neck', 0.15, 'chest2'], ['Neck', 'Head', 0.065, 'neck'],
  ['L_Clavicle', 'L_UpperArm', 0.05, 'L shoulder'], ['R_Clavicle', 'R_UpperArm', 0.05, 'R shoulder'],
  ['L_UpperArm', 'L_Forearm', 0.05, 'L upper arm'], ['R_UpperArm', 'R_Forearm', 0.05, 'R upper arm'],
  ['L_Forearm', 'L_Hand', 0.04, 'L forearm'], ['R_Forearm', 'R_Hand', 0.04, 'R forearm'],
  ['L_Thigh', 'L_Calf', 0.085, 'L thigh'], ['R_Thigh', 'R_Calf', 0.085, 'R thigh'],
  ['L_Calf', 'L_Foot', 0.06, 'L calf'], ['R_Calf', 'R_Foot', 0.06, 'R calf'], ['L_Foot', 'L_Toe0', 0.045, 'L foot'], ['R_Foot', 'R_Toe0', 0.045, 'R foot'],
];
function closest(p1, q1, p2, q2) {
  // distance between segments p1q1 and p2q2 (Ericson, Real-Time Collision Detection)
  const d1 = [q1[0] - p1[0], q1[1] - p1[1], q1[2] - p1[2]], d2 = [q2[0] - p2[0], q2[1] - p2[1], q2[2] - p2[2]], r = [p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
  let s, t;
  if (a <= 1e-9 && e <= 1e-9) { s = t = 0; } else if (a <= 1e-9) { s = 0; t = Math.min(1, Math.max(0, f / e)); } else {
    const c = dot(d1, r);
    if (e <= 1e-9) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else {
      const b = dot(d1, d2), den = a * e - b * b;
      s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  const c1 = [p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s], c2 = [p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t];
  return Math.hypot(c1[0] - c2[0], c1[1] - c2[1], c1[2] - c2[2]);
}
// Capsules of one human in world space: [{a:[x,y,z], b:[x,y,z], r, name}]
export function capsulesOf(human) {
  const out = [];
  const p = (n) => { const v = human.bonePosition(n); return [v.x, v.y, v.z]; };
  for (const [a, b, r, name] of SEGS) out.push({ a: p(a), b: p(b), r, name });
  // head sphere a little above the head bone, hand tip beyond the wrist
  const h = p('Head'), n = p('Neck'); out.push({ a: [h[0], h[1] + 0.06, h[2]], b: [h[0], h[1] + 0.1, h[2]], r: 0.1, name: 'head' });
  for (const s of ['L', 'R']) { const f = p(`${s}_Forearm`), w = p(`${s}_Hand`); const d = [w[0] - f[0], w[1] - f[1], w[2] - f[2]], l = Math.hypot(...d) || 1; out.push({ a: w, b: [w[0] + d[0] / l * 0.1, w[1] + d[1] / l * 0.1, w[2] + d[2] / l * 0.1], r: 0.04, name: `${s} hand` }); }
  return out;
}
// Deepest overlap (metres, positive = penetration) between two humans, with the pair of limbs.
export function penetration(hA, hB) {
  const A = capsulesOf(hA), B = capsulesOf(hB);
  let worst = { depth: -9, a: '', b: '' };
  for (const x of A) for (const y of B) {
    const gap = closest(x.a, x.b, y.a, y.b) - (x.r + y.r);
    if (-gap > worst.depth) worst = { depth: -gap, a: x.name, b: y.name };
  }
  return worst;
}

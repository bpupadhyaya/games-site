// Small math helpers shared by the pose modules (all pure).
import { V3, clamp, smooth } from './rig.js';
export { clamp, lerp, smooth, smoother, V3, Quat, D2R } from './rig.js';

export const UP = new V3(0, 1, 0);
export const ramp = (x, a, b) => smooth((x - a) / Math.max(1e-6, b - a));
export const rampL = (x, a, b) => clamp((x - a) / Math.max(1e-6, b - a), 0, 1);
export const fvec = (psi) => new V3(Math.sin(psi), 0, Math.cos(psi));
export const lvec = (psi) => new V3(Math.cos(psi), 0, -Math.sin(psi));
export const comb = (psi, f, u, l) => fvec(psi).multiplyScalar(f).addScaledVector(UP, u).addScaledVector(lvec(psi), l);
export const norm = (v) => v.clone().normalize();
export const nlerp = (a, b, t) => a.clone().multiplyScalar(1 - t).addScaledVector(b, t).normalize();

/** Catmull-Rom (non-uniform, clamped ends) through vectors ps at times ts, evaluated at t. */
export function spline(ts, ps, t) {
  const n = ts.length;
  if (t <= ts[0]) return ps[0].clone();
  if (t >= ts[n - 1]) return ps[n - 1].clone();
  let i = 0; while (i < n - 2 && t > ts[i + 1]) i++;
  const h = ts[i + 1] - ts[i], u = (t - ts[i]) / h;
  const i0 = Math.max(0, i - 1), i3 = Math.min(n - 1, i + 2);
  const m1 = ps[i + 1].clone().sub(ps[i0]).multiplyScalar(h / Math.max(1e-6, ts[i + 1] - ts[i0]));
  const m2 = ps[i3].clone().sub(ps[i]).multiplyScalar(h / Math.max(1e-6, ts[i3] - ts[i]));
  const u2 = u * u, u3 = u2 * u;
  return ps[i].clone().multiplyScalar(2 * u3 - 3 * u2 + 1).addScaledVector(m1, u3 - 2 * u2 + u).addScaledVector(ps[i + 1], -2 * u3 + 3 * u2).addScaledVector(m2, u3 - u2);
}

/** Scalar keyframes [[t, v], ...] with smooth (cubic Hermite, zero-slope-free Catmull-Rom) interpolation. */
export function K(t, keys) {
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0; while (i < n - 2 && t > keys[i + 1][0]) i++;
  const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
  const h = t1 - t0, u = (t - t0) / h;
  const [ta, va] = keys[Math.max(0, i - 1)], [tb, vb] = keys[Math.min(n - 1, i + 2)];
  const m1 = (v1 - va) / Math.max(1e-6, t1 - ta) * h, m2 = (vb - v0) / Math.max(1e-6, tb - t0) * h;
  const u2 = u * u, u3 = u2 * u;
  return v0 * (2 * u3 - 3 * u2 + 1) + m1 * (u3 - 2 * u2 + u) + v1 * (-2 * u3 + 3 * u2) + m2 * (u3 - u2);
}

export function kV(t, keys) { // vector keyframes [[t, V3], ...]
  return spline(keys.map((k) => k[0]), keys.map((k) => k[1]), t);
}

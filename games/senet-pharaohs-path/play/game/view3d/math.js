// Small column-major 4x4 matrix + vector helpers for the Senet presenter (no dependencies).
export const m4 = {
  ident: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  mul(a, b, o = new Float32Array(16)) {
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  // translation * rotationY(ry) * rotationX(rx) * rotationZ(rz) * scale
  compose(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, o = new Float32Array(16)) {
    const cx = Math.cos(rx), snx = Math.sin(rx), cy = Math.cos(ry), sny = Math.sin(ry), cz = Math.cos(rz), snz = Math.sin(rz);
    // R = Ry * Rx * Rz
    const r00 = cy * cz + sny * snx * snz, r01 = -cy * snz + sny * snx * cz, r02 = sny * cx;
    const r10 = cx * snz, r11 = cx * cz, r12 = -snx;
    const r20 = -sny * cz + cy * snx * snz, r21 = sny * snz + cy * snx * cz, r22 = cy * cx;
    o[0] = r00 * sx; o[1] = r10 * sx; o[2] = r20 * sx; o[3] = 0;
    o[4] = r01 * sy; o[5] = r11 * sy; o[6] = r21 * sy; o[7] = 0;
    o[8] = r02 * sz; o[9] = r12 * sz; o[10] = r22 * sz; o[11] = 0;
    o[12] = x; o[13] = y; o[14] = z; o[15] = 1;
    return o;
  },
  lookAt(eye, at, up = [0, 1, 0]) {
    let zx = eye[0] - at[0], zy = eye[1] - at[1], zz = eye[2] - at[2];
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * eye[0] + xy * eye[1] + xz * eye[2]), -(yx * eye[0] + yy * eye[1] + yz * eye[2]), -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1]);
  },
  ortho(l, r, b, t, n, f) {
    const o = new Float32Array(16);
    o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n); o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); o[15] = 1;
    return o;
  },
  // Off-centre perspective in screen terms: a camera-space point maps to virtual screen (ox + f*x/-z, oy - f*y/-z) on a W x H screen.
  screenPersp(f, ox, oy, W, H, n, fa) {
    const o = new Float32Array(16);
    o[0] = 2 * f / W; o[8] = -(2 * ox / W - 1);
    o[5] = 2 * f / H; o[9] = -(1 - 2 * oy / H);
    o[10] = -(fa + n) / (fa - n); o[11] = -1; o[14] = -2 * fa * n / (fa - n);
    return o;
  },
  xform(m, x, y, z) {
    return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
  },
  // normal matrix (upper 3x3 of the inverse transpose); good enough for uniform-ish scales
  normal3(m) {
    const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, D = -(b * i - c * h), E = a * i - c * g, F = -(a * h - b * g), G = b * f - c * e, H = -(a * f - c * d), I = a * e - b * d;
    const det = a * A + b * B + c * C || 1;
    return new Float32Array([A / det, B / det, C / det, D / det, E / det, F / det, G / det, H / det, I / det]);
  },
};
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

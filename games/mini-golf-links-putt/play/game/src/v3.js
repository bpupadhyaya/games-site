// Hand-off between the 2D screens (view.js, menus.js, game.js) and the optional 3D presenter (view3d/presenter.js). The simulation never
// reads this. `on` is true only while a WebGL scene is alive and drawn; with it off every screen draws exactly as before (the flat 2D
// art is the fallback for no WebGL, a lost context, ?flat=1 and the headless tests).
//
// The camera is an ORTHOGRAPHIC, tilted diorama view, so the ground plane maps to the screen by one exact affine matrix. That matrix
// (makeCam3, pure maths, no three.js) is what the tap mapping, the aim guide and the 2D overlay use, and the presenter builds its
// three.js camera from the very same numbers: what you see is exactly what you touch.
export const v3 = {
  on: false,
  want: null,   // what the 2D layer asks the presenter to draw this frame: { mode, def, cam, clock, balls, cur, bump, near, t }
  scale: 1,     // css px per virtual unit and the centring offsets, published by the presenter each frame
};
export const TILT = (50 * Math.PI) / 180;   // camera elevation above the ground
export const K = Math.sin(TILT);            // ground depth foreshortening
export const CZ = Math.cos(TILT);           // screen lift per unit of height
export const HZ = 3.0;                      // headroom reserved above the top edge for the flag and rail heights (hole units)

// Same interface as view.js makeCam (s, rot, m2s, s2m, dirFromScreen) plus `mat` for ctx.transform and `lift`.
export function makeCam3(h, area, prefRot = 0) {
  const b = h.box, pad = 1.08;
  const bw = b.x1 - b.x0 + 2 * pad, bh = b.y1 - b.y0 + 2 * pad;
  const fit = (r) => { const ew = r ? bh : bw, eh = r ? bw : bh; return Math.min(area.w / ew, area.h / (eh * K + HZ * CZ)); };
  const f0 = fit(0), f1 = fit(1);
  let rot = prefRot;
  if (f1 > f0 * 1.1) rot = 1; else if (f0 > f1 * 1.1) rot = 0;
  const s = rot ? f1 : f0;
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const sx = area.x + area.w / 2, sy = area.y + area.h / 2 + (HZ * CZ * s) / 2;
  // u = ox + a x + c y ; v = oy + bb x + d y
  const a = rot ? 0 : s, bb = rot ? s * K : 0, c = rot ? -s : 0, d = rot ? 0 : s * K;
  const ox = sx - (a * cx + c * cy), oy = sy - (bb * cx + d * cy);
  const det = a * d - c * bb;
  const cam = {
    s, rot, ox, oy, k: K, mat: [a, bb, c, d, ox, oy], persp: true,
    m2s: (x, y) => [ox + a * x + c * y, oy + bb * x + d * y],
    lift: (z) => z * s * CZ,
    s2m: (u, v) => { const du = u - ox, dv = v - oy; return [(d * du - c * dv) / det, (-bb * du + a * dv) / det]; },
    toLight: (k) => [-0.53 * k, -0.85 * k],
    // a screen delta -> the hole-space direction it points along
    dirFromScreen: (du, dv) => [(d * du - c * dv) / det, (-bb * du + a * dv) / det],
  };
  return cam;
}

// Chaturanga 3D models (pure builders, no game state). Sculpted heritage pieces (Raja with canopy, Mantri with turban, Gaja elephant with
// howdah and tusks, Ashva horse, Ratha chariot with spoked wheels, Padati soldier with spear and shield), the carved sandalwood / ebony
// ashtapada board with brass inlay, and the palace courtyard (stone floor, rug, cusped arcade, sunset sky, oil lamps).
// Everything is procedural (lathe / extrude / merged primitives + canvas textures). Units: one square = 1.
import { board3d as B, THREE } from '../vendor3d/index.js';

const TAU = Math.PI * 2;
export const TILE_TOP = 0.4;          // y of the playing surface
export const FRAME = 0.5;             // frame width around the 8x8 grid
export const BOARD_W = 8 + FRAME * 2;

const xf = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
const P = (geo, ...a) => ({ geo, m: xf(...a) });
const sph = (r, ws = 18, hs = 14) => new THREE.SphereGeometry(r, ws, hs);
const cyl = (rt, rb, h, seg = 18) => new THREE.CylinderGeometry(rt, rb, h, seg);
const tor = (R, r, seg = 28, tube = 8) => new THREE.TorusGeometry(R, r, tube, seg);
const cap = (r, len, seg = 8) => new THREE.CapsuleGeometry(r, len, 4, seg);
const rbox = (w, h, d, r = 0.02) => B.roundedBox(w, h, d, r, 3);
const lat = (prof, seg = 28) => B.lathe(prof, seg);

// a smooth closed outline through points [[u, v], ...] extruded `depth` along x (u points toward -z, v up)
function sideSolid(pts, depth, bevel = 0.05) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([u, v]) => new THREE.Vector3(u, v, 0)), true, 'catmullrom', 0.5);
  const shape = new THREE.Shape(curve.getPoints(90).map((p) => new THREE.Vector2(p.x, p.y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2);          // u -> -z, extrusion -> x
  g.computeVertexNormals();
  return g;
}
function tube(points, r, seg = 24, rs = 10) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), seg, r, rs, false);
}

// ---------------------------------------------------------------- materials
// one enamel collar colour per piece type, so the six kinds read apart at phone size on either side
export const ENAMEL = { 1: '#7b8794', 2: '#2f7bff', 3: '#1fb36f', 4: '#ff8a1f', 5: '#8a46e0', 6: '#ffd23a' };
let MATS = null;
export function mats() {
  if (MATS) return MATS;
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a1209, roughness: 0.42, metalness: 0.05 });
  MATS = {
    ivory: B.material('ivory', { color: '#f1e3c1', color2: '#dcc99d', seed: 11, size: 256 }),
    red: B.material('lacquer', { color: '#c4261a' }),
    brass: B.material('brass', { size: 256 }),
    bone: B.material('ivory', { color: '#fbf2da', color2: '#e8d8b0', seed: 21, size: 128 }),
    dark,
    accentW: B.material('lacquer', { color: '#a81f2a' }),
    accentB: B.material('ivory', { color: '#efd9a0', color2: '#d9bd7a', seed: 41, size: 128 }),
    enamel: Object.fromEntries(Object.entries(ENAMEL).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.28, metalness: 0.1, emissive: c, emissiveIntensity: 0.28 })])),
    glowGold: new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
  };
  return MATS;
}
export const bodyMat = (side) => (side > 0 ? mats().ivory : mats().red);

// ---------------------------------------------------------------- the pieces
const BASE_Y = 0.12;
function addBase(o) {
  o.body.push({ geo: lat([[0, 0], [0.33, 0], [0.365, 0.02], [0.365, 0.06], [0.33, 0.09], [0.29, 0.115], [0.26, BASE_Y], [0, BASE_Y]], 36), m: xf() });
  o.enamel.push(P(tor(0.356, 0.036, 40, 10), 0, 0.058, 0, Math.PI / 2, 0, 0));
  o.brass.push(P(tor(0.318, 0.014, 36), 0, 0.104, 0, Math.PI / 2, 0, 0));
}
const PIECES = {
  // 1 Padati: foot soldier with plumed helmet, spear and round shield
  1(o) {
    o.body.push(P(lat([[0, BASE_Y], [0.21, BASE_Y], [0.19, 0.28], [0.16, 0.44], [0.175, 0.5], [0.14, 0.58], [0, 0.6]]), 0));
    o.accent.push(P(lat([[0.205, BASE_Y], [0.2, 0.2], [0.185, 0.2], [0.19, BASE_Y]], 24), 0));            // hem band
    o.brass.push(P(tor(0.168, 0.018), 0, 0.37, 0, Math.PI / 2, 0, 0));                                      // belt
    o.brass.push(P(sph(0.032, 10, 8), 0, 0.37, -0.168));                                                    // buckle
    o.body.push(P(sph(0.11, 18, 14), 0, 0.71, 0));                                                          // head
    o.body.push(P(sph(0.026, 8, 6), 0, 0.695, -0.108));                                                     // nose
    o.dark.push(P(sph(0.017, 8, 6), -0.042, 0.72, -0.098), P(sph(0.017, 8, 6), 0.042, 0.72, -0.098));      // eyes
    o.dark.push(P(cap(0.014, 0.06, 6), 0, 0.66, -0.1, 0, 0, Math.PI / 2));                                   // moustache
    o.brass.push(P(new THREE.SphereGeometry(0.125, 18, 10, 0, TAU, 0, Math.PI * 0.55), 0, 0.735, 0));      // helmet
    o.brass.push(P(cyl(0, 0.024, 0.1, 10), 0, 0.88, 0));
    o.accent.push(P(cyl(0, 0.03, 0.16, 8), 0, 0.97, 0.03, -0.35, 0, 0));                                     // plume
    o.body.push(P(cap(0.045, 0.15), 0.17, 0.5, -0.04, 0, 0, -0.75));                                         // spear arm
    o.body.push(P(cap(0.045, 0.14), -0.15, 0.45, -0.08, 0, 0, 0.65));                                        // shield arm
    o.dark.push(P(cyl(0.014, 0.014, 1.0, 8), 0.245, 0.62, -0.02, 0, 0, -0.05));
    o.brass.push(P(cyl(0, 0.042, 0.19, 10), 0.275, 1.2, -0.02, 0, 0, -0.05));
    o.accent.push(P(cyl(0.02, 0.0, 0.1, 8), 0.26, 1.08, -0.02, 0, 0, -0.05));                                // pennon
    o.body.push(P(cyl(0.19, 0.19, 0.045, 26), -0.23, 0.46, -0.12, Math.PI / 2, 0, 0));                       // shield
    o.brass.push(P(tor(0.19, 0.022, 28), -0.23, 0.46, -0.145));
    o.accent.push(P(tor(0.115, 0.018, 24), -0.23, 0.46, -0.147));
    o.brass.push(P(sph(0.052, 12, 8), -0.23, 0.46, -0.162, 0, 0, 0, 1, 1, 0.6));
  },
  // 2 Ashva: war horse, arched neck with mane, tapered head, ears and a brass breast collar
  2(o) {
    const D = (a, len, base) => [base[0], base[1] + Math.cos(a) * len, base[2] - Math.sin(a) * len];
    const B0 = [0, 0.2, 0.14], a1 = 0.28, T = D(a1, 0.62, B0);
    const mid = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
    o.body.push(P(lat([[0, BASE_Y], [0.27, BASE_Y], [0.2, 0.22], [0, 0.24]], 24), 0));
    o.body.push(P(sph(0.25, 18, 14), 0, 0.34, 0.12, 0, 0, 0, 0.95, 0.95, 1.0));                          // chest
    const nc = mid(B0, T, 0.5);
    o.body.push(P(cyl(0.115, 0.2, 0.64, 20), nc[0], nc[1], nc[2], -a1, 0, 0));                               // neck
    const b1 = 1.95, H0 = [T[0], T[1] + 0.02, T[2] - 0.0], tip = D(b1, 0.36, H0), hc = mid(H0, tip, 0.5);
    o.body.push(P(cap(0.105, 0.2, 14), hc[0], hc[1], hc[2], -b1, 0, 0, 1, 1, 1));                              // head
    o.body.push(P(sph(0.092, 14, 10), tip[0], tip[1] - 0.01, tip[2] - 0.0, 0, 0, 0, 0.95, 0.95, 1.1));       // muzzle
    o.body.push(P(sph(0.12, 14, 10), H0[0], H0[1] + 0.02, H0[2] + 0.02));                                     // poll
    for (const s of [-1, 1]) {
      o.body.push(P(cyl(0, 0.04, 0.16, 10), s * 0.055, H0[1] + 0.15, H0[2] + 0.07, -0.25, 0, -s * 0.12));    // ears
      o.dark.push(P(sph(0.022, 8, 6), s * 0.092, hc[1] + 0.035, hc[2] - 0.045));                              // eyes
      o.dark.push(P(sph(0.016, 8, 6), s * 0.042, tip[1] + 0.0, tip[2] - 0.085));                              // nostrils
    }
    for (let i = 0; i < 7; i++) { const t = 0.08 + i * 0.14, p = mid(B0, H0, t); o.dark.push(P(sph(0.06, 10, 8), 0, p[1] + 0.03, p[2] + 0.13, 0, 0, 0, 0.55, 1.25, 0.9)); }   // mane
    o.dark.push(P(sph(0.06, 10, 8), 0, H0[1] + 0.1, H0[2] - 0.07, 0, 0, 0, 0.6, 1.0, 0.9));                  // forelock
    o.brass.push(P(tor(0.215, 0.022, 28), 0, 0.3, 0.1, 0.2, 0, 0, 1, 1, 1));                                // breast collar
    o.brass.push(P(tor(0.1, 0.014, 18), hc[0], hc[1] - 0.0, hc[2] - 0.0, -b1, 0, 0));                         // bridle band
    o.brass.push(P(sph(0.035, 10, 8), 0, 0.2, -0.1));                                                         // chest jewel
  },
  // 3 Gaja: elephant with a big domed head, flared ears, curled trunk, tusks, draped blanket and a canopied howdah
  3(o) {
    o.body.push(P(sph(0.3, 24, 18), 0, 0.5, 0.1, 0, 0, 0, 0.92, 0.82, 1.22));                              // barrel
    for (const [x, z] of [[-0.18, 0.3], [0.18, 0.3], [-0.17, -0.06], [0.17, -0.06]]) {
      o.body.push(P(cyl(0.098, 0.11, 0.4, 14), x, 0.3, z));
      o.brass.push(P(tor(0.105, 0.016, 16), x, 0.17, z, Math.PI / 2, 0, 0));
    }
    o.body.push(P(sph(0.29, 22, 16), 0, 0.63, -0.28, 0, 0, 0, 1, 1.02, 0.95));                                       // head
    o.body.push(P(sph(0.17, 18, 14), 0, 0.8, -0.3, 0, 0, 0, 1.15, 0.85, 0.85));                              // brow dome
    for (const s of [-1, 1]) {
      o.body.push(P(sph(0.3, 20, 14), s * 0.37, 0.64, -0.12, 0, s * 0.7, 0, 0.1, 1, 0.85));                  // ears
      o.accent.push(P(sph(0.22, 16, 12), s * 0.39, 0.62, -0.16, 0, s * 0.7, 0, 0.1, 1, 0.8));
      o.dark.push(P(sph(0.026, 8, 6), s * 0.165, 0.72, -0.5));                                                // eyes
    }
    o.body.push(P(sph(0.1, 16, 12), 0, 0.55, -0.45));                                                        // trunk root
    o.body.push({ geo: tube([[0, 0.53, -0.47], [0, 0.38, -0.59], [0, 0.26, -0.66], [0, 0.25, -0.74], [0, 0.37, -0.77], [0, 0.5, -0.72]], 0.092, 28, 12), m: xf() });
    for (const s of [-1, 1]) {
      o.bone.push({ geo: tube([[s * 0.15, 0.5, -0.4], [s * 0.24, 0.4, -0.55], [s * 0.22, 0.36, -0.72], [s * 0.13, 0.43, -0.8]], 0.034, 18, 8), m: xf() });
      o.brass.push(P(tor(0.036, 0.012, 10), s * 0.24, 0.4, -0.55, 0.9, 0, 0));
    }
    o.brass.push(P(tor(0.13, 0.02, 24), 0, 0.76, -0.47, 0.1, 0, 0, 1, 0.8, 1));                              // forehead ornament
    o.brass.push(P(sph(0.04, 10, 8), 0, 0.82, -0.5));
    // blanket + howdah
    o.accent.push(P(rbox(0.7, 0.07, 0.62, 0.03), 0, 0.76, 0.12));
    for (const s of [-1, 1]) { o.accent.push(P(rbox(0.05, 0.28, 0.58, 0.02), s * 0.33, 0.62, 0.12)); o.brass.push(P(rbox(0.055, 0.03, 0.6, 0.012), s * 0.335, 0.47, 0.12)); }
    for (const z of [-0.2, 0.44]) o.brass.push(P(rbox(0.72, 0.03, 0.03, 0.01), 0, 0.8, z));
    for (const x of [-0.355, 0.355]) o.brass.push(P(rbox(0.03, 0.03, 0.64, 0.01), x, 0.8, 0.12));
    for (const [x, z] of [[-0.31, -0.2], [0.31, -0.2], [-0.31, 0.44], [0.31, 0.44]]) o.brass.push(P(sph(0.035, 8, 6), x, 0.45, z));
    o.body.push(P(rbox(0.4, 0.14, 0.36, 0.03), 0, 0.89, 0.12));
    for (const z of [-0.075, 0.315]) o.brass.push(P(rbox(0.43, 0.035, 0.03, 0.01), 0, 0.97, z));
    for (const x of [-0.2, 0.2]) o.brass.push(P(rbox(0.03, 0.035, 0.39, 0.01), x, 0.97, 0.12));
    for (const [x, z] of [[-0.17, -0.04], [0.17, -0.04], [-0.17, 0.28], [0.17, 0.28]]) o.brass.push(P(cyl(0.014, 0.014, 0.26, 8), x, 1.1, z));
    o.accent.push(P(cyl(0.0, 0.31, 0.2, 4), 0, 1.33, 0.12, 0, Math.PI / 4, 0));
    o.brass.push(P(sph(0.04, 10, 8), 0, 1.47, 0.12), P(cyl(0.012, 0.012, 0.12, 6), 0, 1.4, 0.12));
    o.dark.push(P(sph(0.075, 12, 10), 0, 1.0, 0.12));
  },
  // 4 Ratha: chariot with big spoked wheels, shield front, pennant, charioteer
  4(o) {
    o.body.push(P(rbox(0.46, 0.16, 0.42, 0.04), 0, 0.44, 0.02));
    o.body.push(P(rbox(0.46, 0.3, 0.05, 0.02), 0, 0.56, -0.2));
    o.brass.push(P(rbox(0.5, 0.035, 0.07, 0.015), 0, 0.72, -0.2), P(rbox(0.5, 0.03, 0.07, 0.015), 0, 0.37, -0.2));
    o.dark.push(P(cyl(0.025, 0.025, 0.82, 10), 0, 0.3, 0.02, 0, 0, Math.PI / 2));
    for (const s of [-1, 1]) {
      o.brass.push(P(tor(0.19, 0.036, 30, 8), s * 0.34, 0.31, 0.02, 0, Math.PI / 2, 0));
      o.brass.push(P(sph(0.062, 12, 8), s * 0.38, 0.31, 0.02));
      for (let k = 0; k < 8; k++) o.dark.push(P(cyl(0.012, 0.012, 0.38, 6), s * 0.34, 0.31, 0.02, (k * Math.PI) / 8, 0, 0));
    }
    o.dark.push(P(cyl(0.02, 0.02, 0.46, 8), 0, 0.34, -0.37, Math.PI / 2, 0, 0));
    for (const hs of [-1, 1]) {                                                                             // the pair of horses
      o.body.push(P(cap(0.075, 0.2, 10), hs * 0.14, 0.33, -0.4, 0.35, 0, 0));
      o.body.push(P(cap(0.052, 0.12, 8), hs * 0.14, 0.5, -0.5, -1.1, 0, 0));
      o.body.push(P(cyl(0, 0.026, 0.09, 8), hs * 0.12, 0.6, -0.44, 0, 0, 0), P(cyl(0, 0.026, 0.09, 8), hs * 0.165, 0.6, -0.44, 0, 0, 0));
      o.dark.push(P(sph(0.034, 8, 6), hs * 0.14, 0.48, -0.37, 0, 0, 0, 1, 1.5, 0.6));
    }
    o.brass.push(P(sph(0.04, 10, 8), 0, 0.34, -0.6));
    o.body.push(P(lat([[0, 0.5], [0.095, 0.5], [0.085, 0.62], [0.06, 0.7], [0, 0.7]], 14), -0.02, 0.0, 0.1));
    o.body.push(P(sph(0.08, 14, 10), -0.02, 0.78, 0.1));
    o.brass.push(P(new THREE.SphereGeometry(0.09, 14, 8, 0, TAU, 0, Math.PI * 0.5), -0.02, 0.8, 0.1));
    o.dark.push(P(cyl(0.012, 0.012, 0.8, 8), 0.17, 0.72, 0.18));
    // pennant: a small flag cut as a prism
    const fl = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.3, -0.07), new THREE.Vector2(0, -0.17), new THREE.Vector2(0.05, -0.085)]);
    const fg = new THREE.ExtrudeGeometry(fl, { depth: 0.015, bevelEnabled: false }); fg.rotateY(Math.PI / 2); fg.translate(0.17, 1.1, 0.18); fg.computeVertexNormals();
    o.body.push({ geo: fg, m: xf() });
    o.brass.push(P(sph(0.026, 8, 6), 0.17, 1.13, 0.18));
  },
  // 5 Mantri: counsellor in a long robe with a cape, sash, folded hands, jewelled turban and plume
  5(o) {
    o.body.push(P(lat([[0, BASE_Y], [0.27, BASE_Y], [0.25, 0.3], [0.205, 0.5], [0.185, 0.64], [0.19, 0.7], [0.13, 0.76], [0.0, 0.78]], 32), 0));
    o.accent.push(P(lat([[0.272, BASE_Y], [0.268, 0.2], [0.245, 0.22], [0.252, BASE_Y]], 32), 0));         // embroidered hem
    o.brass.push(P(tor(0.222, 0.02, 30), 0, 0.42, 0, Math.PI / 2, 0, 0));
    o.accent.push(P(cap(0.065, 0.1), 0, 0.42, -0.2, 0, 0, 0, 1.3, 1.0, 0.7));                            // knot of the sash
    for (const s of [-1, 1]) {
      o.body.push(P(cap(0.044, 0.2), s * 0.12, 0.52, -0.13, 0.5, 0, s * 0.5));                              // arms folded forward
      o.dark.push(P(sph(0.016, 8, 6), s * 0.045, 0.9, -0.108));
    }
    o.body.push(P(sph(0.1, 14, 10), 0, 0.49, -0.2));                                                       // hands
    o.body.push(P(sph(0.115, 20, 14), 0, 0.88, 0));                                                        // head
    o.body.push(P(sph(0.026, 8, 6), 0, 0.875, -0.113));
    o.dark.push(P(cap(0.014, 0.07, 6), 0, 0.84, -0.105, 0, 0, Math.PI / 2));
    o.accent.push(P(lat([[0.0, 0.93], [0.135, 0.93], [0.165, 0.99], [0.145, 1.07], [0.085, 1.13], [0, 1.14]], 26), 0));   // turban
    o.brass.push(P(tor(0.14, 0.02, 26), 0, 0.965, 0, Math.PI / 2, 0, 0));
    o.brass.push(P(sph(0.036, 10, 8), 0, 0.995, -0.148));
    o.bone.push(P(cyl(0.0, 0.026, 0.26, 8), 0.02, 1.22, 0.07, -0.45, 0, 0.1));
  },
  // 6 Raja: king in royal robes, crown, necklace, sash and a canopy (chhatra) over his head
  6(o) {
    o.body.push(P(lat([[0, BASE_Y], [0.3, BASE_Y], [0.275, 0.28], [0.23, 0.5], [0.205, 0.68], [0.215, 0.76], [0.14, 0.84], [0.0, 0.86]], 34), 0));
    o.accent.push(P(lat([[0.302, BASE_Y], [0.297, 0.21], [0.268, 0.23], [0.275, BASE_Y]], 34), 0));       // border of the robe
    o.accent.push(P(rbox(0.1, 0.5, 0.03, 0.01), 0, 0.42, -0.24, -0.12, 0, 0));                            // front panel
    o.brass.push(P(tor(0.245, 0.022, 30), 0, 0.4, 0, Math.PI / 2, 0, 0), P(tor(0.19, 0.022, 28), 0, 0.72, -0.01, Math.PI / 2 - 0.25, 0, 0));
    o.brass.push(P(sph(0.045, 10, 8), 0, 0.62, -0.215));
    for (const s of [-1, 1]) {
      o.body.push(P(cap(0.048, 0.22), s * 0.13, 0.54, -0.15, 0.5, 0, s * 0.45));
      o.dark.push(P(sph(0.018, 8, 6), s * 0.048, 0.97, -0.112));
    }
    o.body.push(P(sph(0.105, 14, 10), 0, 0.49, -0.22));
    o.body.push(P(sph(0.12, 20, 14), 0, 0.96, 0));
    o.body.push(P(sph(0.028, 8, 6), 0, 0.955, -0.12));
    o.dark.push(P(cap(0.015, 0.08, 6), 0, 0.92, -0.112, 0, 0, Math.PI / 2));
    o.brass.push(P(lat([[0.0, 1.03], [0.125, 1.03], [0.145, 1.1], [0.12, 1.16]], 26), 0));                // crown band
    for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU; o.brass.push(P(cyl(0, 0.03, 0.12, 8), Math.cos(a) * 0.115, 1.2, Math.sin(a) * 0.115)); }
    o.accent.push(P(sph(0.035, 10, 8), 0, 1.1, -0.14));
    o.brass.push(P(sph(0.03, 8, 6), 0, 1.27, 0));
    // canopy with scalloped fringe
    o.dark.push(P(cyl(0.014, 0.014, 0.5, 8), 0, 1.2, 0.17));
    o.accent.push(P(cyl(0.0, 0.36, 0.15, 28), 0, 1.52, 0.0));
    o.brass.push(P(tor(0.36, 0.022, 30), 0, 1.445, 0, Math.PI / 2, 0, 0));
    for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; o.brass.push(P(sph(0.024, 8, 6), Math.cos(a) * 0.36, 1.395, Math.sin(a) * 0.36)); }
    o.brass.push(P(sph(0.042, 10, 8), 0, 1.63, 0), P(cyl(0.01, 0.01, 0.07, 6), 0, 1.57, 0));
    o.dark.push(P(cyl(0.012, 0.012, 0.42, 6), 0, 1.24, 0.0));
  },
};

// build one piece; returns a Group (children: body mesh, brass mesh, dark mesh [, bone mesh]), base at y=0, facing -z
const pieceCache = new Map();
const SCALE = { 1: [1.02, 1.22, 0.3], 2: [1.18, 1.26, 0.75], 3: [1.16, 1.18, 0.5], 4: [1.16, 1.26, 0.0], 5: [1.14, 1.2, 0.2], 6: [1.2, 1.1, 0.0] };
export function buildPiece(type, side) {
  const key = `${type}:${side}`;
  const o = { body: [], brass: [], dark: [], bone: [], accent: [], enamel: [] };
  addBase(o);
  PIECES[type](o);
  const g = new THREE.Group(), M = mats();
  const add = (parts, mat) => { if (!parts.length) return; const m = new THREE.Mesh(B.mergeGeos(parts), mat); m.castShadow = true; m.receiveShadow = true; g.add(m); };
  add(o.body, bodyMat(side)); add(o.brass, M.brass); add(o.dark, M.dark); add(o.bone, M.bone); add(o.accent, side > 0 ? M.accentW : M.accentB); add(o.enamel, M.enamel[type]);
  // a touch bigger and taller so the silhouette reads at phone size; figures turn a little so the profile shows from behind or in front
  const k = SCALE[type]; g.scale.set(k[0], k[1], k[0]); g.rotation.y = k[2];
  g.userData = { type, side, key };
  void pieceCache;
  return g;
}
// piece height (for picking) in board units
export const PIECE_H = { 1: 1.45, 2: 1.4, 3: 1.55, 4: 1.4, 5: 1.4, 6: 1.85 };

// ---------------------------------------------------------------- board
export const BOARD_LOOKS = {
  sandal: { a: ['#a8703a', '#cc9858'], b: ['#2b1a12', '#43291b'], frame: ['#5a2f17', '#7a4526'], rug: ['#6e1420', '#9a2230'] },
  lapis: { a: ['#e6d6a8', '#f4e9c8'], b: ['#1f3a82', '#3153a6'], frame: ['#3a2a1e', '#58402c'], rug: ['#142a63', '#244496'] },
  ebony: { a: ['#8a5e37', '#b0844f'], b: ['#171011', '#2a1d1f'], frame: ['#241714', '#3d2a22'], rug: ['#2a1218', '#4a1e26'] },
};
function uvShift(geo, ox, oy, sc) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sc + ox, uv.getY(i) * sc + oy);
  uv.needsUpdate = true; return geo;
}
// squares + frame + inlay for a look; returns a Group with y = 0 at the table
export function buildBoard(look = 'sandal') {
  const L = BOARD_LOOKS[look] || BOARD_LOOKS.sandal, g = new THREE.Group();
  const M = mats();
  const frameMat = B.material('darkWood', { color: L.frame[0], color2: L.frame[1], seed: 17, size: 512, repeat: [2, 2] });
  const half = BOARD_W / 2;
  // foot, plinth under the grid, and a raised carved frame made of four bars
  const foot = new THREE.Mesh(B.slab(BOARD_W + 0.3, BOARD_W + 0.3, 0.1, 0.32, 0.05), B.material('darkWood', { color: '#2a160b', color2: '#3d2312', seed: 4, size: 256 }));
  foot.castShadow = foot.receiveShadow = true; g.add(foot);
  const plinth = new THREE.Mesh(B.slab(BOARD_W - 0.02, BOARD_W - 0.02, 0.22, 0.12, 0.04), M.dark); plinth.position.y = 0.1; plinth.receiveShadow = true; g.add(plinth);
  const bars = [[BOARD_W, FRAME, 0, -half + FRAME / 2], [BOARD_W, FRAME, 0, half - FRAME / 2], [FRAME, BOARD_W - FRAME * 2 + 0.02, -half + FRAME / 2, 0], [FRAME, BOARD_W - FRAME * 2 + 0.02, half - FRAME / 2, 0]];
  for (const [w, d, x, z] of bars) {
    const bar = new THREE.Mesh(B.slab(w, d, 0.2, 0.06, 0.05), frameMat); bar.position.set(x, 0.3, z); bar.castShadow = bar.receiveShadow = true; g.add(bar);
  }
  // squares: one uncheckered sandalwood, every tile a different cut of the grain
  const matA = B.material('wood', { color: L.a[0], color2: L.a[1], seed: 5, size: 256, repeat: [1, 1] });
  const tile = B.slab(0.985, 0.985, 0.1, 0.025, 0.02);
  const partsA = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const geo = uvShift(tile.clone(), rnd() * 0.7, rnd() * 0.7, 0.3);
    partsA.push({ geo, m: xf(f - 3.5, TILE_TOP - 0.1, 3.5 - r) });   // the ashtapada was one uncheckered colour: every square the same sandalwood
  }
  const meshA = new THREE.Mesh(B.mergeGeos(partsA), matA);
  for (const m of [meshA]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  // brass inlay: a fine line round the grid, another along the frame top, studs and edge beads, the ashtapada marks
  const ring = (w, wd) => {
    const s = new THREE.Shape([[-w, -w], [w, -w], [w, w], [-w, w]].map(([x, z]) => new THREE.Vector2(x, z)));
    s.holes.push(new THREE.Path([[-w + wd, -w + wd], [-w + wd, w - wd], [w - wd, w - wd], [w - wd, -w + wd]].map(([x, z]) => new THREE.Vector2(x, z))));
    return B.inlay(s, 0.03, { bevel: 0.004 });
  };
  const inl1 = new THREE.Mesh(ring(4.0, 0.06), M.brass); inl1.position.y = TILE_TOP - 0.04; g.add(inl1);
  const inl2 = new THREE.Mesh(ring(half - 0.1, 0.04), M.brass); inl2.position.y = 0.5 - 0.02; g.add(inl2);
  const marks = [];
  for (const [f, r] of [[3, 3], [4, 3], [3, 4], [4, 4]]) marks.push(P(B.inlay(B.starPoints(8, 0.2, 0.085), 0.014, { bevel: 0.002 }), f - 3.5, TILE_TOP + 0.004, 3.5 - r));
  for (const [f, r] of [[0, 0], [7, 0], [0, 7], [7, 7]]) {
    marks.push(P(B.inlay(B.starPoints(4, 0.2, 0.045, Math.PI / 4), 0.014, { bevel: 0.002 }), f - 3.5, TILE_TOP + 0.004, 3.5 - r));
  }
  const markMesh = new THREE.Mesh(B.mergeGeos(marks), M.brass); markMesh.receiveShadow = true; g.add(markMesh);
  const studs = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) studs.push(P(sph(0.11, 14, 10), sx * (BOARD_W / 2 - 0.2), 0.5, sz * (BOARD_W / 2 - 0.2), 0, 0, 0, 1, 0.6, 1));
  for (let i = 1; i < 8; i += 1) { /* edge beads */
    const p = i - 4;
    for (const [x, z] of [[p, -(BOARD_W / 2 - 0.08)], [p, BOARD_W / 2 - 0.08], [-(BOARD_W / 2 - 0.08), p], [BOARD_W / 2 - 0.08, p]]) studs.push(P(sph(0.026, 8, 6), x, 0.5, z));
  }
  const studMesh = new THREE.Mesh(B.mergeGeos(studs), M.brass); studMesh.castShadow = true; g.add(studMesh);
  return g;
}

// ---------------------------------------------------------------- textures for the set
function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, { srgb = true, repeat = null } = {}) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4; return t;
}
function rugCanvas(c0, c1) {
  const s = 1024, c = cv(s), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, s, s); g.addColorStop(0, c0); g.addColorStop(1, c1); x.fillStyle = g; x.fillRect(0, 0, s, s);
  x.strokeStyle = '#e8c36a'; x.fillStyle = '#e8c36a';
  for (const [inset, wd] of [[26, 10], [60, 4], [92, 3], [150, 3]]) { x.lineWidth = wd; x.strokeRect(inset, inset, s - inset * 2, s - inset * 2); }
  x.globalAlpha = 0.5;
  for (let i = 0; i < 14; i++) for (const side of [0, 1, 2, 3]) {
    const p = 110 + (i * (s - 220)) / 13; x.save(); x.translate(s / 2, s / 2); x.rotate((side * Math.PI) / 2); x.translate(p - s / 2, -s / 2 + 121);
    x.rotate(Math.PI / 4); x.fillRect(-9, -9, 18, 18); x.restore();
  }
  x.globalAlpha = 0.16; x.fillStyle = '#ffffff';
  for (let i = 0; i < 9000; i++) x.fillRect(Math.random() * s, Math.random() * s, 1.2, 1.2);   // fibre noise: texture only, never feeds the sim
  x.globalAlpha = 0.18; x.fillStyle = '#000';
  for (let i = 0; i < 9000; i++) x.fillRect(Math.random() * s, Math.random() * s, 1.2, 1.2);
  return c;
}
function skyCanvas() {
  const w = 1024, h = 640, c = cv(w, h), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b0c30'); g.addColorStop(0.34, '#3c1b58'); g.addColorStop(0.6, '#b53b3a'); g.addColorStop(0.82, '#ea7a35'); g.addColorStop(1, '#f6b35a');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const sun = x.createRadialGradient(w / 2, h * 0.78, 6, w / 2, h * 0.78, h * 0.55); sun.addColorStop(0, 'rgba(255,244,205,1)'); sun.addColorStop(0.18, 'rgba(255,200,110,0.7)'); sun.addColorStop(1, 'rgba(255,130,50,0)');
  x.fillStyle = sun; x.fillRect(0, 0, w, h);
  let s = 5; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  x.fillStyle = '#fff';
  for (let i = 0; i < 70; i++) { x.globalAlpha = 0.25 + r() * 0.6; x.beginPath(); x.arc(r() * w, r() * h * 0.45, 0.7 + r() * 1.5, 0, TAU); x.fill(); }
  x.globalAlpha = 1; x.fillStyle = 'rgba(52,14,40,0.92)';
  x.beginPath(); x.moveTo(0, h);
  const sk = [[0, 70], [80, 70], [80, 110], [120, 150], [160, 110], [160, 70], [260, 70], [280, 112], [300, 160], [320, 112], [340, 70], [450, 70], [450, 96], [490, 96], [490, 70], [610, 70], [640, 118], [680, 190], [720, 118], [750, 70], [860, 70], [890, 120], [920, 170], [950, 120], [980, 70], [1024, 70]];
  for (const [px, py] of sk) x.lineTo(px, h - py);
  x.lineTo(w, h); x.closePath(); x.fill();
  return c;
}
export function glowTexture(rgb = '255,200,120', size = 128) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.3, `rgba(${rgb},0.55)`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return tex(c);
}
export function dotTexture() {
  const c = cv(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,235,1)'); g.addColorStop(0.35, 'rgba(255,225,150,0.95)'); g.addColorStop(0.55, 'rgba(255,190,80,0.5)'); g.addColorStop(1, 'rgba(255,170,60,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c);
}
export function squareGlowTexture() {
  const c = cv(128), x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 8, 64, 64, 80); g.addColorStop(0, 'rgba(255,225,130,0.95)'); g.addColorStop(0.6, 'rgba(255,200,90,0.55)'); g.addColorStop(1, 'rgba(255,180,60,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c);
}

// ---------------------------------------------------------------- the palace courtyard
function arch(x0, x1, y0, h, ys = 0.58) {
  const cx = (x0 + x1) / 2, w = x1 - x0, spr = y0 + h * ys, tip = y0 + h;
  const p = new THREE.Path();
  p.moveTo(x0, y0); p.lineTo(x0, spr);
  p.bezierCurveTo(x0, spr + (tip - spr) * 0.45, cx - w * 0.2, spr + (tip - spr) * 0.62, cx, tip);
  p.bezierCurveTo(cx + w * 0.2, spr + (tip - spr) * 0.62, x1, spr + (tip - spr) * 0.45, x1, spr);
  p.lineTo(x1, y0); p.lineTo(x0, y0);
  return p;
}
function archPts(path) { return path.getPoints(24); }
function column(x, z, h, M) {
  const prof = [[0, 0], [0.34, 0], [0.34, 0.12], [0.26, 0.2], [0.2, 0.3], [0.17, 0.5], [0.15, h * 0.5], [0.17, h - 0.45], [0.23, h - 0.3], [0.3, h - 0.22], [0.36, h - 0.1], [0.36, h], [0, h]];
  const m = new THREE.Mesh(lat(prof, 22), M); m.position.set(x, 0, z); m.castShadow = true; m.receiveShadow = true; return m;
}
export function buildCourt() {
  const g = new THREE.Group(), M = mats();
  const floorMat = B.material('stone', { color: '#5c4030', color2: '#8a6a52', seed: 31, size: 512, repeat: [10, 10] });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; floor.receiveShadow = true; g.add(floor);
  // arcade wall with three arched openings + brass trim, sky behind
  const WZ = -11.5, wh = 9.5;
  const wall = new THREE.Shape([new THREE.Vector2(-13, 0), new THREE.Vector2(13, 0), new THREE.Vector2(13, wh), new THREE.Vector2(-13, wh)]);
  const arches = [[-6.2, 1.8, 6.2], [-1.9, 1.9, 7.6], [2.3, 6.2, 6.2]].map(([a, b, h]) => ({ a, b, h }));
  const aDefs = [[-8.2, -3.8, 6.2], [-2.2, 2.2, 7.4], [3.8, 8.2, 6.2]];
  void arches;
  for (const [a, b, h] of aDefs) wall.holes.push(arch(a, b, 0, h));
  const wallGeo = new THREE.ExtrudeGeometry(wall, { depth: 0.7, bevelEnabled: false, curveSegments: 14 });
  const wallMat = B.material('stone', { color: '#8a5238', color2: '#b5764f', seed: 12, size: 512, repeat: [0.12, 0.12] });
  const wm = new THREE.Mesh(wallGeo, wallMat); wm.position.set(0, 0, WZ); wm.receiveShadow = true; wm.castShadow = true; g.add(wm);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(30, 15), new THREE.MeshBasicMaterial({ map: tex(skyCanvas()), fog: false, color: 0x8a8a8a }));
  sky.position.set(0, 4.4, WZ - 3.2); g.add(sky);
  for (const [a, b, h] of aDefs) {
    const outer = arch(a - 0.3, b + 0.3, 0, h + 0.32), inner = arch(a, b, 0, h);
    const s = new THREE.Shape(archPts(outer)); s.holes.push(new THREE.Path(archPts(inner)));
    const tr = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 4 }), M.brass);
    tr.position.set(0, 0, WZ + 0.72); g.add(tr);
    const fin = new THREE.Mesh(lat([[0, 0], [0.12, 0], [0.09, 0.18], [0.04, 0.42], [0, 0.5]], 14), M.brass); fin.position.set((a + b) / 2, h + 0.34, WZ + 0.7); g.add(fin);
  }
  for (const x of [-10.4, -3, 3, 10.4]) g.add(column(x, WZ + 1.0, 8.0, B.material('stone', { color: '#7a4a32', color2: '#b07a58', seed: 8, size: 256 })));
  // rug under the board
  return g;
}
export function buildRug(look = 'sandal') {
  const L = BOARD_LOOKS[look] || BOARD_LOOKS.sandal;
  const t = tex(rugCanvas(L.rug[0], L.rug[1]));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 15.5), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, metalness: 0 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.0; m.receiveShadow = true; return m;
}
// a standing brass oil lamp (deepam): lathe stem, bowl with wick, returns { group, flame: Vector3 (world offset) }
export function buildLamp(h = 2.2) {
  const g = new THREE.Group(), M = mats();
  g.add(Object.assign(new THREE.Mesh(lat([[0, 0], [0.34, 0], [0.34, 0.05], [0.24, 0.12], [0.1, 0.22], [0.07, h * 0.4], [0.12, h * 0.46], [0.07, h * 0.52], [0.06, h - 0.3], [0.22, h - 0.16], [0.3, h - 0.08], [0.3, h - 0.02], [0.2, h + 0.02], [0, h + 0.02]], 24), M.brass), { castShadow: true }));
  const wick = new THREE.Mesh(cyl(0.012, 0.012, 0.14, 6), M.dark); wick.position.set(0, h + 0.1, 0); g.add(wick);
  return { group: g, flameY: h + 0.2 };
}
export function buildDiya() {
  const g = new THREE.Group(), M = mats();
  g.add(Object.assign(new THREE.Mesh(lat([[0, 0], [0.14, 0], [0.18, 0.04], [0.26, 0.1], [0.3, 0.17], [0.24, 0.16], [0.14, 0.1], [0, 0.1]], 20), M.brass), { castShadow: true }));
  return { group: g, flameY: 0.24 };
}

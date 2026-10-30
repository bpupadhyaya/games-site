// The player's two hands rolling the copter's stick, first person. One modelled right hand + forearm (handmesh.js: a measured adult
// hand, open palm, fingers together, thumb alongside, nails, skin shading) drawn twice: as itself and mirrored for the left hand.
// Indigo sleeves with a cream cuff run from the forearm to the elbow and on toward the shoulder. Presenter-only: never touches the sim.
//
//   const pair = await createHandPair({ skin, shaftR });   group.add(pair.object);
//   pair.pose({ rub, press, release, y }, dt)
// Units: metres. The stick is the +Y axis through the origin; the hands press on it from either side (x), fingers up and tipped a
// little away from the player (+z is away). How a stick is rolled: both palms flat on it, sliding in opposite directions along z, so
// the stick rolls between them; each hand pivots a few degrees in its own plane with the stroke (the wrist's give), never off the stick.
import * as THREE from '../vendor3d/three.js';
import { buildHandGeometry, skinMaterial, nailMaterial, OUT_SCALE } from './handmesh.js';

const T = THREE;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SKINS = { light: '#d29c7c', tan: '#b97f5c', brown: '#8c5b40', deep: '#5e3b28' };
export const FINGER_TILT = 20 * Math.PI / 180;     // fingers lean this far away from the player from vertical
const CONTACT = [5.6 * OUT_SCALE * 0.01, 0, 0.3 * OUT_SCALE * 0.01];   // the palm point on the stick (hand frame, m): mid palm
const FOREARM_L = 0.255;   // wrist to elbow (m)
const UPPER_L = 0.3;
const STROKE = 0.034;      // half the fore-aft slide of each palm at a full rub (m)

/** The hand frame's rotation for the right hand (world from hand): X = fingers, Y = back of the hand (facing out, -x), Z = little finger side. */
function baseBasis() {
  const F = new T.Vector3(0, Math.cos(FINGER_TILT), Math.sin(FINGER_TILT)), B = new T.Vector3(-1, 0, 0), Z = new T.Vector3().crossVectors(F, B);
  return new T.Matrix4().makeBasis(F, B, Z);
}

/** How far the hand frame's plane must sit from the stick axis so the palm rests ON the stick (radius r) and the two hands never meet. */
function clearance(geo, R, r, stroke) {
  const P = geo.attributes.position.array, up = new T.Vector3(0, 1, 0).applyMatrix4(new T.Matrix4().copy(R).invert()).normalize();
  const Y = new T.Vector3(0, 1, 0), e = new T.Vector3().crossVectors(up, Y).normalize();   // in the palm plane, square to the stick
  let yMin = Infinity, yBand = Infinity;
  const w = new T.Vector3();
  for (let i = 0; i < P.length; i += 3) {
    const y = P[i + 1];
    if (P[i] < -0.01) continue;   // the forearm, which leaves the stick
    if (y < yMin) yMin = y;
    w.set(P[i] - CONTACT[0], 0, P[i + 2] - CONTACT[2]);
    if (Math.abs(w.dot(e)) < r * 0.8 + stroke && y < yBand) yBand = y;
  }
  return { d0: Math.max(r - yBand, 0.0012 - yMin), yMin, yBand };
}

/** The soft pads of a palm pressed on a stick flatten: compress the palm side past `c` (m) with a soft limit and turn those normals
 *  toward the palm normal, so the thenar pad and the heel of the hand press flat instead of bulging through the stick. */
function pressPalm(geo, c = 0.0205, soft = 0.004) {
  const P = geo.attributes.position.array, N = geo.attributes.normal.array;
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], depth = -P[i + 1];
    if (depth <= c || x < -0.016 || x > 0.15) continue;
    const wx = Math.min(1, (x + 0.016) / 0.012, (0.15 - x) / 0.02), ex = depth - c;
    const nd = c + soft * (1 - Math.exp(-ex / soft));
    P[i + 1] = -(depth + (nd - depth) * wx);
    if (N[i + 1] < 0) {
      const k = Math.min(1, ex / soft) * 0.6 * wx;
      const nx = N[i] * (1 - k), ny = N[i + 1] * (1 - k) - k, nz = N[i + 2] * (1 - k), l = Math.hypot(nx, ny, nz) || 1;
      N[i] = nx / l; N[i + 1] = ny / l; N[i + 2] = nz / l;
    }
  }
  geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true; geo.computeBoundingSphere();
}

export async function createHandPair({ skin = 'tan', shaftR = 0.0075, voxel = 0.24 } = {}) {
  const H = await buildHandGeometry({ skin: SKINS[skin] || skin, voxel });
  pressPalm(H.geometry);
  const object = new T.Group();
  const skinMat = skinMaterial(), nailMat = nailMaterial();
  const clothTex = sleeveTexture();
  const sleeveMat = new T.MeshStandardMaterial({ map: clothTex, roughness: 0.9, envMapIntensity: 0.3 });
  const cuffMat = new T.MeshStandardMaterial({ color: '#e2d8b8', roughness: 0.75, envMapIntensity: 0.35 });
  const foreGeo = new T.CylinderGeometry(1.5, 1, 1, 32, 1, true).translate(0, 0.5, 0);
  const upperGeo = new T.CylinderGeometry(1.12, 1, 1, 28, 1, true).translate(0, 0.5, 0);
  const cuffGeo = new T.TorusGeometry(1, 0.15, 10, 40);
  const elbowGeo = new T.SphereGeometry(1, 24, 16);
  const R0 = baseBasis();
  const fit = clearance(H.geometry, R0, shaftR, STROKE * 0.5);

  function makeArm(mirror) {
    const g = new T.Group(); if (mirror) g.scale.x = -1;
    const hand = new T.Mesh(H.geometry, skinMat), nails = new T.Mesh(H.nailGeometry, nailMat);
    hand.frustumCulled = nails.frustumCulled = false;
    const fore = new T.Mesh(foreGeo, sleeveMat), upper = new T.Mesh(upperGeo, sleeveMat), cuff = new T.Mesh(cuffGeo, cuffMat), elbow = new T.Mesh(elbowGeo, sleeveMat);
    for (const m of [fore, upper, cuff, elbow]) { m.matrixAutoUpdate = false; m.frustumCulled = false; }
    g.add(hand, nails, fore, upper, cuff, elbow); object.add(g);
    return { g, hand, nails, fore, upper, cuff, elbow };
  }
  const arms = [makeArm(false), makeArm(true)];   // [right (at -x), left (mirrored, at +x)]

  const q = new T.Quaternion(), qa = new T.Quaternion(), Rq = new T.Quaternion().setFromRotationMatrix(R0);
  const C = new T.Vector3(...CONTACT), O = new T.Vector3(), W = new T.Vector3(), fa = new T.Vector3(), fy = new T.Vector3(), fz = new T.Vector3();
  const cuffP = new T.Vector3(), E = new T.Vector3(), S = new T.Vector3(), d = new T.Vector3(), m4 = new T.Matrix4(), s1 = new T.Vector3(), s2 = new T.Vector3();
  const AX = new T.Vector3(1, 0, 0), AZ = new T.Vector3(0, 0, 1), UPPER_DIR = new T.Vector3(-0.08, 0.5, -0.86).normalize();
  const sm = { rub: 0, press: 0, rel: 0, init: false };

  function placeArm(A, dz, press, rel, y) {
    // hand: the base basis, pivoted in its own plane with the stroke (about the palm normal), opened outward as it lets go
    qa.setFromAxisAngle(AX, (dz / STROKE) * 0.07);
    q.setFromAxisAngle(AZ, rel * 0.32).multiply(qa).multiply(Rq);
    const d0 = fit.d0 - press * 0.0005 + rel * 0.065;
    W.set(-d0, y - rel * 0.035, dz - rel * 0.02);
    O.copy(C).applyQuaternion(q).negate().add(W);
    A.hand.position.copy(O); A.hand.quaternion.copy(q);
    A.nails.position.copy(O); A.nails.quaternion.copy(q);
    // forearm frame in the world (the modelled forearm is rigid with the hand)
    fa.copy(H.forearm.axis).applyQuaternion(q); fy.copy(H.forearm.y).applyQuaternion(q); fz.copy(H.forearm.z).applyQuaternion(q);
    const sc = 0.062, r0 = H.armRadii(sc), pad = 0.0048;
    cuffP.copy(O).addScaledVector(fa, sc).addScaledVector(fy, r0.yo);
    E.copy(O).addScaledVector(fa, FOREARM_L);
    // sleeve over the forearm: an oval tube that fits the arm at the cuff and widens to the elbow
    d.copy(E).sub(cuffP);
    s1.copy(fz).multiplyScalar(r0.rz + pad); s2.copy(fy).multiplyScalar(r0.ry + pad);
    A.fore.matrix.makeBasis(s1, d, s2).setPosition(cuffP); A.fore.matrixWorldNeedsUpdate = true;
    s1.copy(fz).multiplyScalar(r0.rz + pad + 0.0006); s2.copy(fy).multiplyScalar(r0.ry + pad + 0.0006); d.copy(fa).multiplyScalar(0.03);
    A.cuff.matrix.makeBasis(s1, s2, d).setPosition(cuffP); A.cuff.matrixWorldNeedsUpdate = true;
    const re = (r0.rz + pad) * 1.48;
    A.elbow.matrix.makeScale(re, re, re).setPosition(E); A.elbow.matrixWorldNeedsUpdate = true;
    // upper arm toward the shoulder (out of frame below the camera)
    S.copy(E).addScaledVector(UPPER_DIR, UPPER_L);
    d.copy(S).sub(E);
    s1.crossVectors(d, AX).normalize(); s2.crossVectors(s1, d).normalize();
    A.upper.matrix.makeBasis(s1.multiplyScalar(re), d, s2.multiplyScalar(re)).setPosition(E); A.upper.matrixWorldNeedsUpdate = true;
    void m4;
  }

  const api = {
    object, fit, stats: H.stats,
    /** rub -1..1 (left hand forward / right hand back), press 0..1, release 0..1 (hands part and open), y = palm height on the stick (m) */
    pose({ rub = 0, press = 0, release = 0, y = -0.16 }, dt = 1 / 60) {
      const k = sm.init ? 1 - Math.exp(-dt * 20) : 1, kr = sm.init ? 1 - Math.exp(-dt * 12) : 1;
      sm.rub += (clamp(rub, -1, 1) - sm.rub) * k; sm.press += (press - sm.press) * k; sm.rel += (clamp(release, 0, 1) - sm.rel) * kr; sm.init = true;
      const dz = sm.rub * STROKE * (1 - sm.rel);
      placeArm(arms[0], -dz, sm.press, sm.rel, y);
      placeArm(arms[1], dz, sm.press, sm.rel, y);
    },
    reset() { sm.init = false; },
    dispose() { H.geometry.dispose(); H.nailGeometry.dispose(); skinMat.dispose(); nailMat.dispose(); sleeveMat.dispose(); cuffMat.dispose(); clothTex.dispose(); },
  };
  return api;
}

// woven indigo cotton: a fine twill with a little slub, drawn once
function sleeveTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#2b4c82'; g.fillRect(0, 0, 128, 128);
  let sd = 9; const r = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  for (let y = 0; y < 128; y += 2) { g.fillStyle = `rgba(10,22,52,${0.18 + r() * 0.12})`; g.fillRect(0, y, 128, 1); }
  for (let x = 0; x < 128; x += 2) { g.fillStyle = `rgba(120,150,205,${0.05 + r() * 0.07})`; g.fillRect(x, 0, 1, 128); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(160,185,230,${0.05 + r() * 0.06})`; g.fillRect(r() * 128, r() * 128, 6 + r() * 14, 1); }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(3, 3); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

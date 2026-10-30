// The drawing hand: an elder's right hand and forearm modelled in this game (view3d/handmesh.js: one smooth, measured surface with
// five jointed fingers, nails and skin shading) in the pointing grip used to draw in sand. The pad of the index finger rests on the
// floor of the groove it is drawing and follows the arc of the tile being turned; the hand approaches from the near side, presses
// in, and lifts away when the stroke is done. A cloth sleeve with a pale cuff (the elder's tunic) covers
// the forearm; past the elbow the sleeve fades out so the arm never covers the field.
// Motion: the fingertip follows the stroke with a frame-rate independent smoother, the hand's orientation turns with a critically
// damped slerp, and its pitch is solved each frame (then eased) so the curled knuckles stay just clear of the sand: no pops, no
// sliding fingertip, no knuckles through the bed.
import * as V3D from '../vendor3d/index.js';
import { buildHandGeometry, skinMaterial, nailMaterial } from './handmesh.js';

const { THREE } = V3D;
const T = THREE;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);

// tunic cloth: plain terracotta homespun (fine weave, slub threads); the forearm sleeve carries a woven indigo-and-gold border by the cuff
function clothTexture(border) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#93401f'; x.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 256; y += 2) { x.fillStyle = `rgba(40,18,6,${0.05 + ((y * 37) % 7) * 0.012})`; x.fillRect(0, y, 128, 1); }
  for (let i = 0; i < 128; i += 2) { x.fillStyle = `rgba(255,220,180,${0.02 + ((i * 53) % 5) * 0.008})`; x.fillRect(i, 0, 1, 256); }
  if (border) {   // v = 0 is the cuff end
    const band = (y, h, col) => { x.fillStyle = col; x.fillRect(0, 256 - y - h, 128, h); };
    band(6, 10, '#2b3f78'); band(18, 5, '#e3b25a'); band(25, 3, '#2b3f78'); band(30, 5, '#e3b25a');
    for (let i = 0; i < 128; i += 16) { x.fillStyle = '#e3b25a'; x.beginPath(); x.moveTo(i + 8, 256 - 8); x.lineTo(i + 12, 256 - 11); x.lineTo(i + 8, 256 - 14); x.lineTo(i + 4, 256 - 11); x.fill(); }
  }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping;
  return t;
}
const clothMaterial = (border, rv, fade = false) => { const t = clothTexture(border); t.repeat.set(3, rv); return new T.MeshStandardMaterial({ map: t, roughness: 0.95, side: T.DoubleSide, vertexColors: fade, transparent: fade }); };

export async function createFinger({ scene, sand = null, voxel = 0.19, skin = '#6e4129' }) {
  let H;
  try { H = await buildHandGeometry({ voxel, skin }); } catch (e) { console.warn('hand build failed', e); return null; }
  const root = new T.Group();
  const mesh = new T.Mesh(H.geometry, skinMaterial());
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  const nails = new T.Mesh(H.nailGeometry, nailMaterial()); nails.receiveShadow = true; nails.frustumCulled = false;
  root.add(mesh, nails); root.visible = false; scene.add(root);

  // the tunic sleeve: a loose cloth tube from about 15 cm up the forearm to the elbow, then the upper-arm sleeve running back toward
  // the drawer's shoulder at the near side of the bed (beyond the edge of the screen), with a pale rolled cuff and a cloth elbow
  const SLEEVE_AT = 0.15, ELBOW_AT = 0.28;
  const clothMat = clothMaterial(true, 1), upperMat = clothMaterial(false, 1.2, true), elbowMat = clothMaterial(false, 0.3);
  // soft cloth folds: the tube's radius ripples round and along it (loose homespun bunches at the elbow end)
  const folds = (g, L, k) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i) / L, a = Math.atan2(z, x);
    const f = 1 + k * (0.6 * Math.sin(a * 3 + y * 9) + 0.4 * Math.sin(a * 5 - y * 14 + 1.3)) * (0.5 + 0.5 * y); p.setX(i, x * f); p.setZ(i, z * f); } g.computeVertexNormals(); };
  const foreGeo = new T.CylinderGeometry(0.054, 0.046, 1, 28, 6, true); foreGeo.translate(0, 0.5, 0); folds(foreGeo, 1, 0.07);   // unit length, base at y = 0
  const UPPER_LEN = 0.42;   // the upper sleeve fades out toward the shoulder so the arm never hides the drawing or ends in a cut
  const upperGeo = new T.CylinderGeometry(0.056, 0.054, UPPER_LEN, 28, 8, true); upperGeo.translate(0, UPPER_LEN / 2, 0); folds(upperGeo, UPPER_LEN, 0.05);
  { const p = upperGeo.attributes.position, c = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) { const v = p.getY(i) / UPPER_LEN, a = 1 - ease(clamp((v - 0.2) / 0.8, 0, 1)); c.set([1, 1, 1, a], i * 4); }
    upperGeo.setAttribute('color', new T.BufferAttribute(c, 4)); }
  const sleeve = new T.Mesh(foreGeo, clothMat), upper = new T.Mesh(upperGeo, upperMat);
  const elbow = new T.Mesh(new T.SphereGeometry(0.055, 20, 14), elbowMat);
  const cuff = new T.Mesh(new T.TorusGeometry(0.047, 0.008, 10, 28), new T.MeshStandardMaterial({ color: '#efe2c0', roughness: 0.9 }));
  const cloth = [sleeve, upper, elbow, cuff];
  upper.renderOrder = 2;
  for (const m of cloth) { m.castShadow = m !== upper; m.visible = false; m.frustumCulled = false; scene.add(m); }
  const show = (v) => { root.visible = v; for (const m of cloth) m.visible = v && !window.__dbgNoSleeve; };

  const IX = H.index, FA = H.forearm;
  const up = new T.Vector3(0, 1, 0), zAxis = new T.Vector3(0, 0, 1);
  const Xd = new T.Vector3(), Yd = new T.Vector3(), Zd = new T.Vector3(), toCam = new T.Vector3(), side = new T.Vector3(), heading = new T.Vector3();
  const mBasis = new T.Matrix4(), qWant = new T.Quaternion(), qHand = new T.Quaternion(), qTry = new T.Quaternion();
  const tipNow = new T.Vector3(), home = new T.Vector3(), contact = new T.Vector3(), tmp = new T.Vector3(), tmp2 = new T.Vector3(), armAxis = new T.Vector3();
  const elbowP = new T.Vector3(), shoulder = new T.Vector3(), uDir = new T.Vector3();
  let started = false, hold = 0, pitch = 0.45, firstFrame = true;
  // critically damped springs (continuous velocity: no pops when a target jumps)
  const P = { x: 0, v: 0 }, PR = { x: 0, v: 0 }, LIFT = { x: 0, v: 0 }, TX = { x: 0, v: 0 }, TZ = { x: 0, v: 0 }, PT = { x: 0.45, v: 0 };
  const spring = (s, target, w, dt) => { const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n; for (let i = 0; i < n; i++) { s.v += (w * w * (target - s.x) - 2 * w * s.v) * h; s.x += s.v * h; } };
  const tune = { roll: 0.32, yaw: 1.3, clear: 0.004, rest: 0.36, sink: 0.45 };

  // hand orientation: fingers heading away from the camera (and a little left), pitched down by p, rolled thumb-up by tune.roll
  function orient(p, out) {
    heading.copy(toCam).multiplyScalar(-1).addScaledVector(side, -tune.yaw).normalize();
    Xd.set(heading.x * Math.cos(p), -Math.sin(p), heading.z * Math.cos(p));
    Yd.copy(up).addScaledVector(Xd, -up.dot(Xd)).normalize();
    // roll about the finger axis, thumb side up: the pad of the pointing finger meets the sand, as when drawing
    Yd.applyAxisAngle(Xd, -tune.roll); Zd.crossVectors(Xd, Yd).normalize();
    mBasis.makeBasis(Xd, Yd, Zd); out.setFromRotationMatrix(mBasis);
    return out;
  }
  // lowest curled knuckle above the sand surface with the index pad at `at`
  function clearance(p, at, floor) {
    orient(p, qTry);
    const padY = tmp.copy(IX.pad).applyQuaternion(qTry).y;
    let lo = Infinity;
    for (const pr of H.probes) lo = Math.min(lo, tmp2.copy(pr).applyQuaternion(qTry).y - padY + at.y - floor);
    return lo;
  }

  const api = {
    hand: { object: root }, object: root, approach: null, stats: H.stats, tune, thumbErr: H.thumbErr,
    state: { pad: new T.Vector3(), wrist: new T.Vector3(), pitch: 0 },
    update(tip, dt, clock, camera) {
      dt = Math.min(dt, 0.05);
      hold = tip ? 0.25 : Math.max(0, hold - dt);
      const on = tip || hold > 0;
      spring(P, on ? 1 : 0, on ? 9 : 6, dt);
      if (P.x < 0.02 && !on) { show(false); started = false; firstFrame = true; P.x = 0; P.v = 0; return; }
      if (tip) {
        // a fresh appearance starts right on the stroke (the approach is the lift + offset that fade with presence)
        if (!started) { TX.x = tip.x; TZ.x = tip.z; TX.v = TZ.v = 0; started = true; }
        // the fingertip follows the stroke with a critically damped spring; a jump to a new arc is a lift-and-carry (softer, raised)
        const far = Math.hypot(tip.x - TX.x, tip.z - TZ.x);
        spring(TX, tip.x, far > 0.04 ? 13 : 24, dt); spring(TZ, tip.z, far > 0.04 ? 13 : 24, dt);
        spring(LIFT, Math.min(0.05, far * 0.45), 18, dt);
        spring(PR, 1, 14, dt);
      } else { spring(PR, 0, 10, dt); spring(LIFT, 0, 18, dt); }
      home.set(TX.x, 0, TZ.x);
      const presence = clamp(P.x, 0, 1), press = clamp(PR.x, 0, 1);
      // the forearm comes from the camera side (a fixed direction for the icon)
      if (api.approach) toCam.copy(api.approach); else if (camera) toCam.set(camera.position.x - home.x, 0, camera.position.z - home.z); else toCam.set(0, 0, 1);
      toCam.y = 0; toCam.normalize(); side.set(toCam.z, 0, -toCam.x);
      const surf = sand ? sand.surfaceY(home.x, home.z) : 0.035, depth = sand ? sand.grooveDepth : 0.0275;
      // pressed: the pad rides in the groove it ploughs, about half its depth below the surface (the groove's U floor is the sand it
      // pushed aside and the berm round it); lifted: it hovers above the surface
      const hover = (1 - ease(press)) * 0.06 + (1 - ease(presence)) * 0.1 + Math.max(0, LIFT.x);
      contact.set(home.x + side.x * (1 - presence) * 0.08 + toCam.x * (1 - presence) * 0.08, surf - depth * tune.sink * ease(press) + hover, home.z + side.z * (1 - presence) * 0.08 + toCam.z * (1 - presence) * 0.08);
      // pitch: the angle nearest a relaxed drawing angle that keeps the curled knuckles clear of the sand (local search, then eased)
      const cost = (p) => Math.max(0, tune.clear - clearance(p, contact, surf)) * 80 + Math.abs(p - tune.rest) * 0.02;
      let best = firstFrame ? tune.rest : pitch, bc = cost(best);
      for (let s = 0.2; s > 0.002; s *= 0.5) for (const c of [best + s, best - s]) { const cc = clamp(c, 0.15, 1.2), v = cost(cc); if (v < bc) { bc = v; best = cc; } }
      if (firstFrame) { PT.x = best; PT.v = 0; } else spring(PT, best, 10, dt);
      pitch = PT.x;
      orient(pitch, qWant);
      if (firstFrame) qHand.copy(qWant); else qHand.slerp(qWant, 1 - Math.exp(-dt * 9));
      // place the hand so the index pad is exactly on the contact point (the fingertip never slides off the stroke)
      root.quaternion.copy(qHand);
      root.position.copy(contact).sub(tmp.copy(IX.pad).applyQuaternion(qHand));
      root.updateMatrixWorld(true);
      firstFrame = false;
      api.state.pad.copy(contact); api.state.wrist.copy(root.position); api.state.pitch = pitch;
      // forearm sleeve + cuff to the elbow; the upper arm runs from the elbow back toward the shoulder (off screen, near side)
      armAxis.copy(FA.axis).applyQuaternion(qHand);
      cuff.position.copy(root.position).addScaledVector(armAxis, SLEEVE_AT); cuff.quaternion.setFromUnitVectors(zAxis, armAxis);
      sleeve.position.copy(cuff.position); sleeve.quaternion.setFromUnitVectors(up, armAxis); sleeve.scale.set(1, ELBOW_AT - SLEEVE_AT, 1);
      elbowP.copy(root.position).addScaledVector(armAxis, ELBOW_AT); elbow.position.copy(elbowP);
      shoulder.copy(home).addScaledVector(toCam, 0.55).addScaledVector(side, 1.0); shoulder.y = 0.3;
      uDir.copy(shoulder).sub(elbowP); const ul = uDir.length(); uDir.multiplyScalar(1 / ul);
      upper.position.copy(elbowP); upper.quaternion.setFromUnitVectors(up, uDir);
      show(true);
    },
  };
  return api;
}

// The puzzler's hand: a real-proportioned right hand and forearm (view3d/handmesh.js, one smooth surface modelled and meshed in this game)
// reaching in from across the bar and pinching the selected wire at its grip bead between the thumb pad and the index pad, with a rolled
// linen shirt sleeve. Presenter-only: it reads where the grip point is (and which way the wire runs there) and follows it.
// How the hand holds the wire: the pinch point sits exactly on the wire's axis at the grip and the pinch axis is kept square to the
// wire, so the wire is held between the pads (never through a finger); the hand turns about the pinch axis to keep the curled fingers
// clear of the bar-top. Orientation is critically damped and a jump of the grip (another piece chosen, Undo, Reset) is carried across
// in a lifted arc, so the hand never pops. Scale: 1 lattice unit = 2.4 cm; the hand is built in metres and scaled into lattice units.
import * as THREE from '../vendor3d/three.js';
import { buildHandGeometry, skinMaterial, nailMaterial } from './handmesh.js';
import { TUBE } from './models.js';

const T = THREE;
const UNIT = 0.024;   // metres per lattice unit
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// a cream linen weave with a few soft lengthwise creases
function linenTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#ddd0b0'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) { g.fillStyle = `rgba(80,60,30,${0.03 + hash(y, 4) * 0.06})`; g.fillRect(0, y, 256, 1); }
  for (let x = 0; x < 256; x += 2) { g.fillStyle = `rgba(80,60,30,${0.03 + hash(x, 5) * 0.06})`; g.fillRect(x, 0, 1, 256); }
  for (let k = 0; k < 9; k++) {   // creases run along the sleeve (texture u = around, v = along)
    const x = hash(k, 9) * 256, w = 6 + hash(k, 3) * 14, gr = g.createLinearGradient(x - w, 0, x + w, 0);
    gr.addColorStop(0, 'rgba(60,40,20,0)'); gr.addColorStop(0.5, 'rgba(60,40,20,0.16)'); gr.addColorStop(1, 'rgba(255,250,235,0)');
    g.fillStyle = gr; g.fillRect(x - w, 0, w * 2, 256);
  }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
  return t;
}

export async function createHands(handScene, { skin = '#c98e70' } = {}) {
  const H = await buildHandGeometry({ skin, wire: TUBE * 2 * UNIT });
  const root = new T.Group();            // lattice units
  root.scale.setScalar(1 / UNIT);
  handScene.add(root);
  const hand = new T.Group();            // metres, the hand's own frame (origin at the wrist centre)
  const skinMat = skinMaterial(), nailMat = nailMaterial();
  const mesh = new T.Mesh(H.geometry, skinMat), nails = new T.Mesh(H.nailGeometry, nailMat);
  mesh.frustumCulled = nails.frustumCulled = false;
  hand.add(mesh, nails); root.add(hand);

  // rolled linen sleeve: a fat rolled cuff about 12 cm up the forearm, then the sleeve running off toward the shoulder
  const linen = new T.MeshStandardMaterial({ map: linenTexture(), roughness: 0.93, metalness: 0, side: T.DoubleSide, envMapIntensity: 0.4 });
  const sleeveGeo = new T.CylinderGeometry(1, 1, 1, 30, 4, true); sleeveGeo.translate(0, 0.5, 0);   // unit radius, 0..1 along +Y
  { const p = sleeveGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = p.getY(i), k = 1 + 0.32 * v; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } sleeveGeo.computeVertexNormals(); }
  const sleeve = new T.Mesh(sleeveGeo, linen);
  const cuffGeo = new T.LatheGeometry([[0.96, 0], [1.1, 0.06], [1.2, 0.22], [1.24, 0.5], [1.2, 0.78], [1.1, 0.94], [0.97, 1]].map(([r, y]) => new T.Vector2(r, y)), 30);
  const cuff = new T.Mesh(cuffGeo, linen);
  sleeve.frustumCulled = cuff.frustumCulled = false;
  root.add(sleeve, cuff);
  const SLEEVE0 = 0.122, CUFF_LEN = 0.034, SLEEVE_LEN = 0.5;

  // the same shapes, invisible, in the main scene: they only cast the hand's shadow onto the bar-top and the wire
  const shadowRoot = new T.Group(); shadowRoot.scale.setScalar(1 / UNIT);
  const ghost = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const sh = { hand: new T.Group(), sleeve: new T.Mesh(sleeveGeo, ghost), cuff: new T.Mesh(cuffGeo, ghost) };
  sh.hand.add(new T.Mesh(H.geometry, ghost)); shadowRoot.add(sh.hand, sh.sleeve, sh.cuff);
  shadowRoot.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  shadowRoot.visible = false;

  // clipping (world units): the far end of the sleeve, and nothing below the bar-top
  const plane = new T.Plane(new T.Vector3(0, 0, 1), 0), floorCut = new T.Plane(new T.Vector3(0, 1, 0), 0);
  root.visible = false;

  // ---- placement state (metres)
  const P = H.pinch, FA = H.forearm;
  const qHand = new T.Quaternion(), qWant = new T.Quaternion(), qTmp = new T.Quaternion(), qTry = new T.Quaternion(), mBasis = new T.Matrix4();
  const up = new T.Vector3(0, 1, 0), down = new T.Vector3(0, -1, 0);
  const F = new T.Vector3(), N = new T.Vector3(), Yd = new T.Vector3(), Zd = new T.Vector3(), side = new T.Vector3();
  const aW = new T.Vector3(), aP = new T.Vector3(), nW = new T.Vector3(), wrist = new T.Vector3(), tmp = new T.Vector3(), d = new T.Vector3(), wfb = new T.Vector3();
  const grip = new T.Vector3(), gripNow = new T.Vector3(), from = new T.Vector3(), armAxis = new T.Vector3(), armY = new T.Vector3(), armZ = new T.Vector3();
  const tune = { palmDown: 0.55, pitch: -0.32, lift: 0.006 };
  let shown = 0, roll = 0, first = true, travel = 1;
  const state = { wrist: new T.Vector3(), index: new T.Vector3(), thumb: new T.Vector3(), pinch: new T.Vector3(), grip: new T.Vector3(), roll: 0 };

  // the hand orientation that holds a wire running along wDir at the pinch, the forearm coming from direction dd (horizontal, unit)
  function orient(dd, wDir, out) {
    F.copy(dd).multiplyScalar(-1); F.y = 0; F.normalize(); F.y = tune.pitch; F.normalize();   // fingers: toward the player, reaching down
    side.crossVectors(up, F).normalize();                                                       // the thumb side of a right hand
    N.copy(down).multiplyScalar(tune.palmDown).addScaledVector(side, 1 - tune.palmDown).normalize();
    Yd.copy(N).multiplyScalar(-1).addScaledVector(F, N.dot(F)).normalize();
    Zd.crossVectors(F, Yd).normalize();
    mBasis.makeBasis(F, Yd, Zd); out.setFromRotationMatrix(mBasis);
    // turn the hand the least amount that puts its pinch axis square to the wire
    nW.copy(wDir).normalize();
    aW.copy(P.axis).applyQuaternion(out);
    aP.copy(aW).addScaledVector(nW, -aW.dot(nW));
    if (aP.lengthSq() > 1e-6) { aP.normalize(); qTmp.setFromUnitVectors(aW, aP); out.premultiply(qTmp); }
    return out;
  }
  // height of the lowest finger joint / tip above the bar-top with the hand turned by r about the pinch axis
  function clearance(r, g, floorY) {
    qTry.setFromAxisAngle(aW, r).multiply(qWant);
    let lo = Infinity;
    for (const p of H.probes) { tmp.copy(p).sub(P.point).applyQuaternion(qTry); lo = Math.min(lo, tmp.y + g.y - floorY); }
    return lo;
  }

  return {
    root, shadowRoot, mesh, plane, floorCut, planes: [plane, floorCut], state, tune, stats: H.stats, pinch: P,
    // pivot: three.js world point of the grip (lattice units); camPos: camera position; want: show the hand;
    // wireDir: the wire's direction at the grip (three.js); floorY: the bar-top height (lattice units)
    update(pivot, camPos, want, dt, curl = 0, wireDir = null, floorY = pivot.y - 3) {
      void curl;
      shown = Math.max(0, Math.min(1, shown + (want ? 1 : -1) * dt * 3.2));
      const vis = shown > 0.01;
      root.visible = shadowRoot.visible = vis;
      if (!vis) { first = true; return; }
      const e = shown * shown * (3 - 2 * shown);
      // the arm comes from across the bar: horizontal direction from the grip away from the camera
      d.set(pivot.x - camPos.x, 0, pivot.z - camPos.z); if (d.lengthSq() < 1e-6) d.set(0, 0, -1); d.normalize();
      grip.copy(pivot).multiplyScalar(UNIT);
      // follow the grip exactly while the piece slides or turns; carry the hand across a jump in a lifted arc
      if (first) { gripNow.copy(grip); travel = 1; }
      else if (travel >= 1 && gripNow.distanceTo(grip) > 0.6 * UNIT) { from.copy(gripNow); travel = 0; }
      if (travel < 1) {
        travel = Math.min(1, travel + dt / 0.38);
        const s = travel * travel * (3 - 2 * travel);
        gripNow.lerpVectors(from, grip, s); gripNow.y += Math.sin(Math.PI * s) * Math.min(0.05, from.distanceTo(grip) * 0.5);
      } else gripNow.copy(grip);
      const wd = wireDir && wireDir.lengthSq() > 1e-8 ? wireDir : wfb.crossVectors(up, d);
      orient(d, wd, qWant);
      aW.copy(P.axis).applyQuaternion(qWant);
      const fy = floorY * UNIT;
      const cost = (r) => Math.max(0, tune.lift - clearance(r, gripNow, fy)) * 60 + Math.abs(r) * 0.01;
      let best = first ? 0 : roll, bc = cost(best);
      for (let s = 0.32; s > 0.003; s *= 0.5) for (const c of [best + s, best - s]) { const v = cost(c); if (v < bc) { bc = v; best = c; } }
      roll = first ? best : roll + (best - roll) * (1 - Math.exp(-dt * 10));
      state.roll = roll;
      qTmp.setFromAxisAngle(aW, roll); qWant.premultiply(qTmp);
      if (first) qHand.copy(qWant); else qHand.slerp(qWant, 1 - Math.exp(-dt * (travel < 1 ? 7 : 9)));
      // the pinch point sits on the wire's axis at the grip; the hand arrives from across the bar
      wrist.copy(P.point).applyQuaternion(qHand).multiplyScalar(-1).add(gripNow);
      wrist.addScaledVector(d, (1 - e) * 0.22); wrist.y += (1 - e) * 0.06;
      hand.position.copy(wrist); hand.quaternion.copy(qHand);
      armAxis.copy(FA.axis).applyQuaternion(qHand); armY.copy(FA.y).applyQuaternion(qHand); armZ.copy(FA.z).applyQuaternion(qHand);
      // cuff and sleeve on the forearm's oval
      const ar = H.armRadii(SLEEVE0 + CUFF_LEN);
      mBasis.makeBasis(armY, armAxis, armZ);
      cuff.quaternion.setFromRotationMatrix(mBasis); cuff.position.copy(wrist).addScaledVector(armAxis, SLEEVE0);
      cuff.scale.set(ar.ry + 0.0035, CUFF_LEN, ar.rz + 0.0035);
      sleeve.quaternion.copy(cuff.quaternion); sleeve.position.copy(wrist).addScaledVector(armAxis, SLEEVE0 + CUFF_LEN * 0.4);
      sleeve.scale.set(ar.ry + 0.006, SLEEVE_LEN, ar.rz + 0.008);
      for (const k of ['position', 'quaternion', 'scale']) { sh.cuff[k].copy(cuff[k]); sh.sleeve[k].copy(sleeve[k]); sh.hand[k].copy(hand[k]); }
      root.updateMatrixWorld(true); shadowRoot.updateMatrixWorld(true);
      state.wrist.copy(wrist); state.grip.copy(grip); state.pinch.copy(P.point).applyQuaternion(qHand).add(wrist);
      state.index.copy(P.index).applyQuaternion(qHand).add(wrist); state.thumb.copy(P.thumb).applyQuaternion(qHand).add(wrist);
      // clip the sleeve's far end (off screen) and anything under the bar-top (world = lattice units)
      plane.normal.copy(armAxis).multiplyScalar(-1);
      tmp.copy(wrist).addScaledVector(armAxis, SLEEVE0 + SLEEVE_LEN * 0.9).multiplyScalar(1 / UNIT);
      plane.constant = -plane.normal.dot(tmp);
      floorCut.constant = -(floorY + 0.02);
      first = false;
    },
    get shown() { return shown; },
    dispose() { handScene.remove(root); shadowRoot.parent?.remove(shadowRoot); H.geometry.dispose(); H.nailGeometry.dispose(); },
  };
}

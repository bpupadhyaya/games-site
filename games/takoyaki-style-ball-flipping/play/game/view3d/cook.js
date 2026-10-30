// The cook's right hand: a real-proportioned hand + forearm (view3d/handmesh.js, one smooth surface modelled and meshed in this game)
// holding the two takoyaki picks like a pen: the thumb pad and the index pad close on the pair from either side and the picks run
// back over the web between thumb and index, the other fingers curled under. The hand is rigidly in the picks' frame, so it can never
// drift off them: the presenter computes the pick pose for the frame, THEN this file places the hand on it, THEN everything renders.
// On a flip the wrist turns the picks a little about their own axis (the quick turn a takoyaki cook gives each ball) and comes back;
// the hand slides in from the cook's side with the picks and slides back out when they are put down. Critically damped, no pops.
// Scale: 1 scene unit = 5.5 cm. A rolled cotton sleeve covers the forearm; an invisible copy casts the hand's shadow on the pan.
import { buildHandGeometry, skinMaterial, nailMaterial } from './handmesh.js';

const UNIT = 0.055;   // metres per scene unit
const PAIR = 0.0090;  // thickness of the two picks side by side where they are held (m)
const GRIP = 1.5;     // where the picks are held: scene units from the cap end (8 cm)
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

export async function createCook({ scene, THREE, renderer }) {
  const T = THREE;
  const hs = new T.Scene();
  const key = new T.DirectionalLight(0xffd9a6, 2.6); key.position.set(-7, 15, 9);
  const fill = new T.DirectionalLight(0xaec4ff, 0.45); fill.position.set(9, 5, 8);
  const rimL = new T.DirectionalLight(0xffb27a, 1.3); rimL.position.set(6, 6, -9);
  hs.add(new T.HemisphereLight(0xffe6c8, 0x3a2a20, 0.65), key, fill, rimL);

  // cotton weave for the rolled sleeve (white cook's shirt), a few soft creases along the arm
  function cottonTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#eee8da'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 2) { g.fillStyle = `rgba(90,70,40,${0.02 + hash(y, 4) * 0.05})`; g.fillRect(0, y, 128, 1); }
    for (let x = 0; x < 128; x += 2) { g.fillStyle = `rgba(90,70,40,${0.02 + hash(x, 5) * 0.05})`; g.fillRect(x, 0, 1, 128); }
    for (let k = 0; k < 6; k++) {
      const x = hash(k, 9) * 128, w = 4 + hash(k, 3) * 8, gr = g.createLinearGradient(x - w, 0, x + w, 0);
      gr.addColorStop(0, 'rgba(70,50,30,0)'); gr.addColorStop(0.5, 'rgba(70,50,30,0.14)'); gr.addColorStop(1, 'rgba(255,250,240,0)');
      g.fillStyle = gr; g.fillRect(x - w, 0, w * 2, 128);
    }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4;
    return t;
  }

  // ---- placement state (vectors reused: no per-frame allocation)
  const tipH = new T.Vector3(), axH = new T.Vector3();
  let ready = false, visible = true, flick = 0, shown = 0, first = true, roll = 0;
  const parts = {};
  const plane = new T.Plane(new T.Vector3(0, 0, 1), 0);
  // build the hand in the background, after the presenter is up (no title-time cost)
  (async () => {
    await new Promise((r) => setTimeout(r, 250));
    const H = await buildHandGeometry({ skin: '#c8956a', wire: PAIR });
    const root = new T.Group(); root.scale.setScalar(1 / UNIT); hs.add(root);
    const hand = new T.Group();
    const mesh = new T.Mesh(H.geometry, skinMaterial()), nails = new T.Mesh(H.nailGeometry, nailMaterial());
    mesh.frustumCulled = nails.frustumCulled = false;
    hand.add(mesh, nails); root.add(hand);
    const cloth = new T.MeshStandardMaterial({ map: cottonTexture(), roughness: 0.92, metalness: 0, side: T.DoubleSide, envMapIntensity: 0.4 });
    const sleeveGeo = new T.CylinderGeometry(1, 1, 1, 30, 4, true); sleeveGeo.translate(0, 0.5, 0);   // unit radius, 0..1 along +Y
    { const p = sleeveGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = p.getY(i), k = 1 + 0.3 * v; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } sleeveGeo.computeVertexNormals(); }
    const cuffGeo = new T.LatheGeometry([[0.96, 0], [1.1, 0.06], [1.2, 0.22], [1.24, 0.5], [1.2, 0.78], [1.1, 0.94], [0.97, 1]].map(([r, y]) => new T.Vector2(r, y)), 30);
    const sleeve = new T.Mesh(sleeveGeo, cloth), cuff = new T.Mesh(cuffGeo, cloth);
    sleeve.frustumCulled = cuff.frustumCulled = false;
    root.add(sleeve, cuff);
    // shadow proxy in the main scene: only casts the hand's shadow onto the pan and the balls
    const shadowRoot = new T.Group(); shadowRoot.scale.setScalar(1 / UNIT);
    const ghost = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    const sh = { hand: new T.Group(), sleeve: new T.Mesh(sleeveGeo, ghost), cuff: new T.Mesh(cuffGeo, ghost) };
    sh.hand.add(new T.Mesh(H.geometry, ghost)); shadowRoot.add(sh.hand, sh.sleeve, sh.cuff);
    shadowRoot.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    shadowRoot.visible = false; root.visible = false;
    scene.add(shadowRoot);
    tipH.copy(H.pinch.back).negate(); axH.copy(H.pinch.axis);
    // compile the skin / nail / cloth shaders now, so the first flip does not hitch
    try { root.visible = true; if (renderer) { renderer.clippingPlanes = [plane]; renderer.compile(hs, new T.PerspectiveCamera()); renderer.clippingPlanes = []; } } catch { /* first show compiles instead */ }
    root.visible = false;
    Object.assign(parts, { H, root, hand, sleeve, cuff, shadowRoot, sh });
    ready = true;
  })().catch((e) => { console.warn('cook hand unavailable', e); });

  const SLEEVE0 = 0.118, CUFF_LEN = 0.034, SLEEVE_LEN = 0.5;
  const qHand = new T.Quaternion(), qWant = new T.Quaternion(), qA = new T.Quaternion(), qB = new T.Quaternion(), mB = new T.Matrix4();
  const tipW = new T.Vector3(), axW = new T.Vector3(), tmp = new T.Vector3(), tmp2 = new T.Vector3();
  const armWant = new T.Vector3(0.62, 0.42, 0.66).normalize(), up = new T.Vector3(0, 1, 0), grip = new T.Vector3(), off = new T.Vector3(), wrist = new T.Vector3();
  const armAxis = new T.Vector3(), armY = new T.Vector3(), armZ = new T.Vector3(), pX = new T.Vector3(), pY = new T.Vector3(), pZ = new T.Vector3(), zNeg = new T.Vector3(0, 0, -1);
  const state = { grip: new T.Vector3(), pinch: new T.Vector3(), wrist: new T.Vector3(), index: new T.Vector3(), thumb: new T.Vector3(), roll: 0, shown: 0 };

  // the hand orientation whose pen-grip tip direction is `dir` (world, unit), rolled about it by r; returns a score (higher = better):
  // the forearm should run back toward the cook and the thumb side and back of the hand face up into the stall light (a pen grip
// held over the pan rests on the little-finger side of the hand)
  function orientFor(dir, r, out) {
    qA.setFromUnitVectors(tipH, dir);
    qB.setFromAxisAngle(dir, r); out.copy(qB).multiply(qA);
    tmp.copy(parts.H.forearm.axis).applyQuaternion(out);
    tmp2.set(0, 0.55, -0.85).applyQuaternion(out);   // between the back of the hand and its thumb side: a pen grip turned on its side
    return tmp.dot(armWant) + tmp2.dot(up) * 0.5;
  }

  const api = {
    setVisible(v) { visible = v; },
    flipAt() { flick = 0.34; },
    update(dt, o) {
      const { picks } = o;
      if (!ready) return;
      const P = parts;
      const want = visible && !!o.active;
      shown = Math.max(0, Math.min(1, shown + (want ? 1 / 0.14 : -1 / 0.3) * dt));
      if (!visible) shown = 0;
      state.shown = shown;
      const vis = shown > 0.01;
      P.root.visible = P.shadowRoot.visible = vis;
      if (!vis) { first = true; return; }
      picks.visible = true;                            // the picks stay in the hand while it slides out
      const e = shown * shown * (3 - 2 * shown);
      flick = Math.max(0, flick - dt);
      // the picks' tip direction (world) and the grip on them
      tipW.copy(zNeg).applyQuaternion(picks.quaternion).normalize();
      grip.copy(picks.position).addScaledVector(tipW, GRIP);
      // the roll about the picks that best brings the forearm back toward the cook with the back of the hand up
      let best = 0, bs = -1e9;
      for (let k = 0; k < 24; k++) { const r = -Math.PI + (2 * Math.PI * k) / 24, s = orientFor(tipW, r, qWant); if (s > bs) { bs = s; best = r; } }
      let lo = best - Math.PI / 12, hi = best + Math.PI / 12;
      for (let k = 0; k < 12; k++) { const a = lo + (hi - lo) * 0.382, b = lo + (hi - lo) * 0.618; if (orientFor(tipW, a, qWant) > orientFor(tipW, b, qWant)) hi = b; else lo = a; }
      const r0 = (lo + hi) / 2;
      // the wrist turn on a flip: quick out (0.1 s), eased back (follow-through)
      const u = flick > 0 ? 1 - flick / 0.34 : 1;
      const turn = flick > 0 ? (u < 0.3 ? Math.sin((u / 0.3) * Math.PI / 2) : 0.5 + 0.5 * Math.cos(((u - 0.3) / 0.7) * Math.PI)) * 0.5 : 0;
      roll = first ? r0 : roll + (r0 - roll) * (1 - Math.exp(-dt * 12));
      orientFor(tipW, roll + turn, qWant);
      if (first) qHand.copy(qWant); else qHand.slerp(qWant, 1 - Math.exp(-dt * 30));
      state.roll = roll + turn;
      // the picks turn with the hand: their spread lies across the pinch (one pick against each pad)
      axW.copy(axH).applyQuaternion(qHand);
      pZ.copy(tipW).negate();
      pX.copy(axW).addScaledVector(pZ, -axW.dot(pZ)).normalize();
      pY.crossVectors(pZ, pX);
      mB.makeBasis(pX, pY, pZ); picks.quaternion.setFromRotationMatrix(mB);
      // slide in / out along the arm while appearing or putting the picks down
      off.copy(armWant).multiplyScalar((1 - e) * 4.2); off.y += (1 - e) * 0.8;
      picks.position.add(off); grip.add(off);
      picks.updateMatrixWorld(true);
      // the pinch point sits on the picks' axis at the grip
      wrist.copy(P.H.pinch.point).applyQuaternion(qHand).multiplyScalar(-1).addScaledVector(grip, UNIT);
      P.hand.position.copy(wrist); P.hand.quaternion.copy(qHand);
      armAxis.copy(P.H.forearm.axis).applyQuaternion(qHand); armY.copy(P.H.forearm.y).applyQuaternion(qHand); armZ.copy(P.H.forearm.z).applyQuaternion(qHand);
      const ar = P.H.armRadii(SLEEVE0 + CUFF_LEN);
      // right-handed basis (z x axis = y): local x = the forearm's width, local z = its thickness
      mB.makeBasis(armZ, armAxis, armY);
      P.cuff.quaternion.setFromRotationMatrix(mB); P.cuff.position.copy(wrist).addScaledVector(armAxis, SLEEVE0).addScaledVector(armY, ar.yo);
      P.cuff.scale.set(ar.rz + 0.0035, CUFF_LEN, ar.ry + 0.0035);
      P.sleeve.quaternion.copy(P.cuff.quaternion); P.sleeve.position.copy(wrist).addScaledVector(armAxis, SLEEVE0 + CUFF_LEN * 0.4).addScaledVector(armY, ar.yo);
      P.sleeve.scale.set(ar.rz + 0.008, SLEEVE_LEN, ar.ry + 0.006);
      for (const k of ['position', 'quaternion', 'scale']) { P.sh.cuff[k].copy(P.cuff[k]); P.sh.sleeve[k].copy(P.sleeve[k]); P.sh.hand[k].copy(P.hand[k]); }
      P.root.updateMatrixWorld(true); P.shadowRoot.updateMatrixWorld(true);
      // cut the sleeve's far end (off screen)
      plane.normal.copy(armAxis).multiplyScalar(-1);
      tmp.copy(wrist).addScaledVector(armAxis, SLEEVE0 + SLEEVE_LEN * 0.9).multiplyScalar(1 / UNIT);
      plane.constant = -plane.normal.dot(tmp);
      state.grip.copy(grip); state.wrist.copy(wrist).multiplyScalar(1 / UNIT);
      state.pinch.copy(P.H.pinch.point).applyQuaternion(qHand).add(wrist).multiplyScalar(1 / UNIT);
      state.index.copy(P.H.pinch.index).applyQuaternion(qHand).add(wrist).multiplyScalar(1 / UNIT);
      state.thumb.copy(P.H.pinch.thumb).applyQuaternion(qHand).add(wrist).multiplyScalar(1 / UNIT);
      first = false;
    },
    render(rend, camera) {
      if (!ready || !parts.root.visible) return;
      hs.environment = scene.environment; hs.environmentIntensity = scene.environmentIntensity ?? 0.38;
      rend.clippingPlanes = [plane];
      rend.render(hs, camera);
      rend.clippingPlanes = [];
    },
    get ready() { return ready; },
    state,
  };
  return api;
}

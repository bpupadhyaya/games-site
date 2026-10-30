// The fisher: a real 3D person (view3d athlete_m) in a strip-woven indigo boubou with wide sleeves, loose trousers, bare feet and a
// broad woven hat. The garments are cloth tubes driven by the posed bones, with a spring-lagged hem so the robe swings and billows.
const LIB = '../vendor3d/index.js';
export async function createFisher(V3, anchor, quality) {
  const { loadHuman, buildClip, THREE, limbCapsuleGeometry } = V3;
  const SKIN = '#6a432c';
  let human;
  human = await loadHuman({ character: 'athlete_m', skin: 'brown', hair: 'black', castShadow: true, lod: quality === 'high' ? 0 : 1,
    kit: { top: '#33519a', bottoms: '#d6cdb4', socks: SKIN, shoes: SKIN, trim: '#6286c0' } });
  try { human.setKit({ top: '#2a4378', bottoms: '#d6cdb4', socks: '#6a432c', shoes: '#6a432c' }); } catch { /* cosmetic */ }
  anchor.add(human.root);
  human.play('ready_stance', { fade: 0 });
  human.update(0);
  human.setFacing(0);
  // twist clip indexed by body twist (same approach as the 2D-fisher presenter): t = twist + 0.5
  const keys = [];
  for (let k = 0; k <= 10; k++) {
    const t = k / 10, tw = (t - 0.5) * 2;
    keys.push({ t, ease: 'linear', pose: { Spine: { flex: 7, twist: -34 * tw, side: 4 * tw }, Head: { twist: 14 * tw, flex: -4 }, Pelvis: { pos: [0, -0.03, 0], twist: -6 * tw },
      R_Thigh: { flex: 6 }, L_Thigh: { flex: 6 }, R_Calf: { flex: 10 }, L_Calf: { flex: 10 } } });
  }
  human.addClip(buildClip(human, { name: 'twist', duration: 1, fps: 30, base: 'ready_stance', keys, fingers: 'relaxed' }));
  human.play('twist', { fade: 0, speed: 0 });

  // ---- cloth ----
  const clothTex = (() => {
    const c = globalThis.document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    for (let x = 0; x < 128; x += 8) { g.fillStyle = (x / 8) % 2 ? '#2b4579' : '#26407a'; g.fillRect(x, 0, 8, 128); g.fillStyle = 'rgba(210,225,255,0.07)'; g.fillRect(x, 0, 1, 128); }
    g.fillStyle = 'rgba(230,236,255,0.10)'; for (let y = 6; y < 128; y += 32) g.fillRect(0, y, 128, 1);
    let s = 9; const img = g.getImageData(0, 0, 128, 128);
    for (let i = 0; i < img.data.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; const n = ((s >>> 24) - 128) * 0.12; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
  })();
  const robe = new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.92, side: THREE.DoubleSide });
  const cotton = new THREE.MeshStandardMaterial({ color: '#dcd3ba', roughness: 0.95 });
  const trim = new THREE.MeshStandardMaterial({ color: '#e9e3cf', roughness: 0.8 });
  const unit = new THREE.Vector3(0, 1, 0);
  const tubes = [];
  // closed tapered capsules (view3d 1.13 limbCapsuleGeometry, unit length, scaled along the limb): no open ends, no slits
  const tube = (rTop, rBot, mat, seg = 16) => {
    const geo = limbCapsuleGeometry(rBot, rTop, 1, seg); geo.translate(0, -0.5, 0);
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    tubes.push(m); return m;
  };
  const place = (m, a, b) => {
    m.position.copy(a).add(b).multiplyScalar(0.5);
    const d = new THREE.Vector3().subVectors(b, a); const len = Math.max(1e-4, d.length()); d.divideScalar(len);
    m.quaternion.setFromUnitVectors(unit, d); m.scale.set(1, len, 1);
  };
  const g = new THREE.Group(); g.name = 'garments';
  // one gown: a lathe from the hem (y = 0) to the neck (y = 1), scaled along the line between them
  const gownGeo = new THREE.LatheGeometry([[0.285, 0], [0.265, 0.12], [0.24, 0.3], [0.222, 0.46], [0.212, 0.58], [0.215, 0.7], [0.222, 0.82], [0.205, 0.92], [0.16, 0.975], [0.09, 1.0], [0.0, 1.002]].map((p) => new THREE.Vector2(p[0], p[1])), 40);
  gownGeo.translate(0, -0.5, 0);
  const chest = new THREE.Mesh(gownGeo, robe); chest.castShadow = true; chest.receiveShadow = true; chest.frustumCulled = false;
  const skirt = new THREE.Object3D(), hemTrim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 5, 28), trim);
  const sh = [0, 1].map(() => new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), robe));
  const elb = [0, 1].map(() => new THREE.Mesh(new THREE.SphereGeometry(0.108, 14, 10), robe));
  const cuff = [0, 1].map(() => new THREE.Mesh(new THREE.SphereGeometry(0.088, 14, 10), robe));
  const knee = [0, 1].map(() => new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), cotton));
  const slU = [tube(0.105, 0.125, robe, 12), tube(0.105, 0.125, robe, 12)], slF = [tube(0.125, 0.085, robe, 12), tube(0.125, 0.085, robe, 12)];
  const thA = [tube(0.105, 0.085, cotton, 10), tube(0.105, 0.085, cotton, 10)], thB = [tube(0.085, 0.062, cotton, 10), tube(0.085, 0.062, cotton, 10)];
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.02, 6, 16), trim); collar.rotation.x = Math.PI / 2;
  g.add(chest, hemTrim, ...sh, ...elb, ...cuff, ...knee, ...slU, ...slF, ...thA, ...thB, collar);
  // The cloth lives in the anchor space so it rocks with the boat.
  anchor.add(g);

  // hat
  const hatTex = (() => {
    const c = globalThis.document.createElement('canvas'); c.width = c.height = 128; const cx = c.getContext('2d');
    cx.fillStyle = '#d8b878'; cx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 24; i++) { cx.fillStyle = i % 2 ? 'rgba(120,80,30,0.25)' : 'rgba(255,240,190,0.2)'; cx.fillRect(0, i * 5.4, 128, 2.4); }
    for (let i = 0; i < 32; i++) { cx.fillStyle = 'rgba(100,70,30,0.18)'; cx.fillRect(i * 4, 0, 1.2, 128); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();
  const hatMat = new THREE.MeshStandardMaterial({ map: hatTex, roughness: 0.9, side: THREE.DoubleSide });
  const prof = [[0, 0.115], [0.07, 0.108], [0.115, 0.085], [0.13, 0.035], [0.14, 0.012], [0.26, -0.004], [0.36, -0.03], [0.375, -0.042]].map((p) => new THREE.Vector2(p[0], p[1]));
  const hat = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), hatMat); hat.castShadow = true;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.011, 6, 28), new THREE.MeshStandardMaterial({ color: '#7a2a20', roughness: 0.7 })); band.rotation.x = Math.PI / 2; band.position.y = 0.012;
  hat.add(band); anchor.add(hat);

  const b = (n) => human.bones[`Bip01_${n}`];
  const P = {}; for (const n of ['Pelvis', 'Spine2', 'Neck', 'Head', 'L_UpperArm', 'R_UpperArm', 'L_Forearm', 'R_Forearm', 'L_Hand', 'R_Hand', 'L_Thigh', 'R_Thigh', 'L_Calf', 'R_Calf', 'L_Foot', 'R_Foot']) P[n] = new THREE.Vector3();
  const wp = (n) => b(n).getWorldPosition(P[n]);
  const lag = new THREE.Vector3(), lagV = new THREE.Vector3(), last = new THREE.Vector3();
  let lastT = null, started = false;
  const fisher = { human, hat, group: g, P, bones: P };
  // o: { hands:[[x,y],[x,y]] (sim, from the fisher), z:[], twist, grip:[], t, dt, anchor-based }
  fisher.update = (o, dt) => {
    const tr = human.current, tw = Math.max(-1, Math.min(1, (o.twist || 0) / 0.5));
    if (tr) { tr.speed = 0; tr.warp = null; tr.time = (tw * 0.5 + 0.5) * tr.clip.dur; }
    anchor.updateMatrixWorld(true);
    const world = (i, dx = 0, dy = 0, dz = 0) => anchor.localToWorld(new THREE.Vector3(-o.hands[i][0] + dx, o.hands[i][1] + dy, o.z[i] + dz));
    human.setReach('L', world(0), { weight: 1, pole: world(0, 0.25, -0.45, -0.25) });
    human.setReach('R', world(1), { weight: 1, pole: world(1, -0.25, -0.45, -0.25) });
    human.setFingers('L', o.grip[0] ? 'fist' : 'relaxed'); human.setFingers('R', o.grip[1] ? 'fist' : 'open');
    if (o.look) human.lookAt(o.look, { weight: 0.55, maxYaw: 0.7, maxPitch: 0.4 }); else human.lookAt(null);
    human.update(dt);                 // FIRST the human (clips + IK), THEN everything that is attached to its bones
    anchor.updateMatrixWorld(true);
    for (const n in P) wp(n);
    // bring world bone points into the anchor's local space where the garments live
    const inv = new THREE.Matrix4().copy(anchor.matrixWorld).invert();
    const L = {}; for (const n in P) L[n] = P[n].clone().applyMatrix4(inv);
    fisher.local = L;
    const waist = L.Pelvis.clone(); waist.y += 0.04;
    const neck = L.Neck.clone();
    const top = neck.clone().lerp(L.Spine2, 0.25); top.y -= 0.02;
    // spring-lagged hem: it trails the hips and swings out with the twist (the robe billows)
    if (!started || dt <= 0) { lag.set(0, 0, 0); lagV.set(0, 0, 0); last.copy(waist); started = true; }
    const vel = new THREE.Vector3().subVectors(waist, last); last.copy(waist);
    if (dt > 0) {
      const v = vel.divideScalar(Math.max(dt, 1e-3));
      const k = 60, c = 7;
      lagV.addScaledVector(lag, -k * dt).addScaledVector(lagV, -c * dt).addScaledVector(v, -0.5 * dt * 12);
      lag.addScaledVector(lagV, dt);
      lag.clampLength(0, 0.2);
    }
    const hem = new THREE.Vector3(waist.x, waist.y - 0.62, waist.z).add(lag);
    hem.x += Math.sin((o.t || 0) * 1.3) * 0.006;
    place(chest, hem, top);
    hemTrim.position.copy(hem); hemTrim.quaternion.copy(chest.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)); hemTrim.scale.set(0.285, 0.285, 0.285);
    sh[0].position.copy(L.L_UpperArm); sh[1].position.copy(L.R_UpperArm);
    elb[0].position.copy(L.L_Forearm); elb[1].position.copy(L.R_Forearm);
    const cl = L.L_Hand.clone().lerp(L.L_Forearm, 0.12), cr = L.R_Hand.clone().lerp(L.R_Forearm, 0.12); cuff[0].position.copy(cl); cuff[1].position.copy(cr);
    knee[0].position.copy(L.L_Calf); knee[1].position.copy(L.R_Calf);
    place(slU[0], L.L_UpperArm, L.L_Forearm); place(slU[1], L.R_UpperArm, L.R_Forearm);
    // the sleeve past the elbow flares a little and hangs below the forearm
    place(slF[0], L.L_Forearm, L.L_Hand.clone().lerp(L.L_Forearm, 0.12)); place(slF[1], L.R_Forearm, L.R_Hand.clone().lerp(L.R_Forearm, 0.12));
    place(thA[0], L.L_Thigh, L.L_Calf); place(thA[1], L.R_Thigh, L.R_Calf);
    place(thB[0], L.L_Calf, L.L_Foot); place(thB[1], L.R_Calf, L.R_Foot);
    collar.position.copy(neck).add(new THREE.Vector3(0, -0.04, 0));
    const hp = L.Head; hat.position.set(hp.x, hp.y + 0.1, hp.z);
    const hq = b('Head').getWorldQuaternion(new THREE.Quaternion()); const e = new THREE.Euler().setFromQuaternion(hq, 'YXZ');
    hat.rotation.set(0, e.y, 0);
  };
  fisher.dispose = () => { human.dispose?.(); };
  return fisher;
}
export { LIB };

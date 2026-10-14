// Equipment helpers: procedural props and wearable kit attached to bones. Every function returns an object with remove().
// Gloves cover the back of the hand and the wrist cuff only (fingers stay free so every finger pose still reads); with the batGrip
// finger pose they give the gloved-hand look. All sizes in metres for a ~1.75 m person.
import * as THREE from './three.js';

const mat = (c, r = 0.7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const shadowed = (g) => { g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } }); return g; };
const capsule = (r, len, m) => { const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), m); const a = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m); const b = a.clone(); a.position.y = len / 2; b.position.y = -len / 2; g.add(body, a, b); return g; };

function addTo(bone, obj) { bone.add(obj); return { obj, remove() { bone.remove(obj); } }; }

const basis = (human, boneName) => { const f = human.boneFrame(boneName); const m = new THREE.Matrix4().makeBasis(f.left.normalize(), f.up.normalize(), f.fwd.normalize()); return { q: new THREE.Quaternion().setFromRotationMatrix(m), f }; };

/**
 * Batting gloves: padded back-of-hand pillow, segmented padded fingers and thumb (capsules riding on the finger bones, so every finger pose
 * bends them), knuckle roll and a wrist cuff. sides: 'LR' | 'L' | 'R'.
 */
export function addGloves(human, { color = 0xf2f2f0, trim = 0x1f4aa8, sides = 'LR' } = {}) {
  const parts = [];
  const skinless = mat(color, 0.82);
  const trimM = mat(trim, 0.85);
  for (const s of sides) {
    const hand = human.bones[`Bip01_${s}_Hand`];
    const fr = human.fingers[s];
    if (!hand || !fr.ok) continue;
    const g = new THREE.Group();
    const back = fr.palmDir.clone().negate().normalize();
    const along = fr.fingerDir.clone().normalize();
    const across = new THREE.Vector3().crossVectors(along, back).normalize();
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, along, back));
    g.position.copy(fr.knuckle.clone().multiplyScalar(0.5)).addScaledVector(back, 0.01);
    const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.034, 18, 12), skinless); pillow.scale.set(1.0, 1.1, 0.34);
    const roll = new THREE.Mesh(new THREE.CapsuleGeometry(0.0062, 0.05, 4, 10), trimM); roll.rotation.z = Math.PI / 2; roll.position.set(0, 0.04, 0.002);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.0285, 0.031, 0.045, 18), trimM); cuff.position.set(0, -0.05, -0.008);
    const cuffRim = new THREE.Mesh(new THREE.TorusGeometry(0.0305, 0.0028, 8, 20), skinless); cuffRim.rotation.x = Math.PI / 2; cuffRim.position.set(0, -0.0725, -0.008);
    g.add(pillow, roll, cuff, cuffRim);
    shadowed(g);
    parts.push(addTo(hand, g));
    // fingers: one capsule per phalanx on the finger bone, along the bone's own axis (child offset); radius tapers with the finger
    const radii = [0.0115, 0.0105, 0.0105, 0.0098, 0.0085];
    for (let f = 0; f < 5; f++) {
      const chain = [`Bip01_${s}_Finger${f}`, `Bip01_${s}_Finger${f}1`, `Bip01_${s}_Finger${f}2`].map((n) => human.bones[n]);
      if (chain.some((x) => !x)) continue;
      let lastDir = null;
      chain.forEach((bone, k) => {
        const child = chain[k + 1];
        const dir = child ? child.position.clone().normalize() : (lastDir || new THREE.Vector3(1, 0, 0));
        const len = child ? child.position.length() : 0.022;
        lastDir = dir;
        const r = radii[f] * (1 - k * 0.08);
        const seg = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.004, len - r * 0.4), 4, 8), skinless);
        seg.quaternion.setFromUnitVectors(_yAxis, dir);
        seg.position.copy(dir).multiplyScalar(len * 0.5);
        shadowed(seg);
        parts.push(addTo(bone, seg));
      });
    }
  }
  return { parts, remove() { parts.forEach((p) => p.remove()); } };
}
const _yAxis = new THREE.Vector3(0, 1, 0);

/** Batting pads on both shins: hard shell with ridges and a top bolster, strapped in FRONT of the shin. */
export function addPads(human, { color = 0xf4f4f0 } = {}) {
  const parts = [];
  for (const s of ['L', 'R']) {
    const calf = human.bones[`Bip01_${s}_Calf`], foot = human.bones[`Bip01_${s}_Foot`];
    if (!calf || !foot) continue;
    const len = foot.position.length();                              // knee -> ankle
    const dir = foot.position.clone().normalize();
    const f = human.boneFrame(`${s}_Calf`);
    const fwd = f.fwd.clone().addScaledVector(dir, -f.fwd.dot(dir)).normalize();   // character-forward, perpendicular to the shin
    const side = new THREE.Vector3().crossVectors(dir, fwd).normalize();
    const g = new THREE.Group();
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, dir, fwd));
    g.position.copy(fwd).multiplyScalar(0.09);
    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.115, len * 0.88, 0.04), mat(color, 0.75)); shell.position.y = len * 0.5;
    const bolster = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.075, 0.06), mat(color, 0.75)); bolster.position.set(0, len * 0.93, 0.004);
    g.add(shell, bolster);
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.012), mat(0xdcdcd4, 0.8)); r.position.set(0, len * (0.25 + i * 0.2), 0.024); g.add(r); }
    shadowed(g);
    parts.push(addTo(calf, g));
  }
  return { parts, remove() { parts.forEach((p) => p.remove()); } };
}

function headFrame(human) {
  const { q, f } = basis(human, 'Head');
  const box = human.headBox;
  const c = box ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3(0.07, 0, 0);
  const size = box ? box.getSize(new THREE.Vector3()) : new THREE.Vector3(0.25, 0.17, 0.2);
  // the head bone's local +X is "up the head" in this rig; use the avatar's up/forward expressed in bone space instead of assuming axes
  const upExt = box ? Math.max(box.max.dot(f.up), box.min.dot(f.up)) : 0.2;
  const fwdExt = box ? Math.max(box.max.dot(f.fwd), box.min.dot(f.fwd)) : 0.1;
  const topPt = c.clone().addScaledVector(f.up, upExt - c.dot(f.up));
  const frontPt = c.clone().addScaledVector(f.fwd, fwdExt - c.dot(f.fwd));
  void size;
  return { q, f, c, topPt, frontPt };
}

const tube = (pts, r, m, closed = false) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), 24, r, 6, closed), m);
const ell = (R, az, el, sx = 1, sy = 1, sz = 1.06) => new THREE.Vector3(R * sx * Math.cos(el) * Math.sin(az), R * sy * Math.sin(el), R * sz * Math.cos(el) * Math.cos(az));

/** Helmet: smooth shell, brow peak, steel grille from curved tubes, ear flaps and a rear neck guard. Sized to the skinned head extents. */
export function addHelmet(human, { color = 0x1f4aa8, grille = 0xc9ced4 } = {}) {
  const head = human.bones.Bip01_Head;
  const { q, f, topPt } = headFrame(human);
  const g = new THREE.Group();
  g.quaternion.copy(q);
  const R = 0.122;
  g.position.copy(topPt).addScaledVector(f.up, -R * 0.6);
  const shellM = mat(color, 0.38, 0.15);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.57), shellM); shell.scale.set(1, 1, 1.07);
  const rim = tube([...Array(24)].map((_, i) => { const a = (i / 24) * Math.PI * 2; return ell(R * 1.005, a, -Math.PI * 0.07, 1, 1, 1.07); }), 0.0042, mat(0x14171b, 0.5), true);
  const peak = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.96, R * 0.96, 0.006, 28, 1, false, -Math.PI * 0.42, Math.PI * 0.84), shellM);
  peak.scale.set(1, 1, 0.66); peak.position.set(0, R * 0.12, R * 0.8); peak.rotation.x = -0.1;
  const flapL = new THREE.Mesh(new THREE.SphereGeometry(R * 1.01, 16, 10, Math.PI * 0.46, Math.PI * 0.34, Math.PI * 0.42, Math.PI * 0.24), shellM);
  const flapR = new THREE.Mesh(new THREE.SphereGeometry(R * 1.01, 16, 10, -Math.PI * 0.8, Math.PI * 0.34, Math.PI * 0.42, Math.PI * 0.24), shellM);
  g.add(shell, rim, peak, flapL, flapR);
  const steel = mat(grille, 0.28, 0.9);
  const Rg = R * 1.08;
  for (let i = -3; i <= 3; i++) {
    const az = i * 0.17;
    g.add(tube([...Array(7)].map((_, k) => ell(Rg, az, -Math.PI * (0.05 + k * 0.062), 0.98, 1.0, 1.06)), 0.0034, steel));
  }
  for (let j = 0; j < 3; j++) {
    const el = -Math.PI * (0.1 + j * 0.095);
    g.add(tube([...Array(11)].map((_, k) => ell(Rg, -0.62 + k * 0.124, el, 0.98, 1.0, 1.06)), 0.0034, steel));
  }
  g.add(tube([...Array(9)].map((_, k) => ell(Rg, -0.55 + k * 0.1375, -Math.PI * 0.42, 0.98, 1.0, 1.06)), 0.0044, steel));      // chin bar
  shadowed(g);
  return addTo(head, g);
}

/** Cap: six-panel dome with seams and a button, and a curved peak. */
export function addCap(human, { color = 0x1f4aa8 } = {}) {
  const head = human.bones.Bip01_Head;
  const { q, f, topPt } = headFrame(human);
  const g = new THREE.Group();
  g.quaternion.copy(q);
  const R = 0.104;
  g.position.copy(topPt).addScaledVector(f.up, -R * 0.74);
  const m = mat(color, 0.9);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.56), m); dome.scale.set(1.03, 1, 1.1);
  g.add(dome);
  const seam = mat(new THREE.Color(color).multiplyScalar(0.55).getHex(), 0.9);
  for (let i = 0; i < 6; i++) { const az = (i / 6) * Math.PI * 2; g.add(tube([...Array(10)].map((_, k) => ell(R * 1.004, az, Math.PI / 2 - k * 0.15, 1.03, 1, 1.1)), 0.0016, seam)); }
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), seam); button.position.set(0, R * 1.0, 0); g.add(button);
  const peak = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.0, R * 1.0, 0.005, 28, 1, false, -Math.PI * 0.40, Math.PI * 0.80), m);
  peak.scale.set(1.03, 1, 0.82); peak.position.set(0, -R * 0.12, R * 0.74); peak.rotation.x = -0.18;
  g.add(peak);
  shadowed(g);
  return addTo(head, g);
}

/**
 * Full-length trousers (cricket whites) over the bare thighs/knees of the shorts-wearing athlete_m: a tapered tube per thigh and shin plus a knee cap sphere, riding on the
 * bones so a deep knee bend never shows skin. athlete_f already wears trousers (no-op for her unless force: true).
 */
export function addWhites(human, { color = 0xf2f2ee, force = false } = {}) {
  const parts = [];
  if (human.info.sex === 'f' && !force) return { parts, remove() {} };
  const m = mat(color, 0.9);
  const H = human.info.height ? human.info.height / 1.8 : 1;
  for (const s of ['L', 'R']) {
    const thigh = human.bones[`Bip01_${s}_Thigh`], calf = human.bones[`Bip01_${s}_Calf`], foot = human.bones[`Bip01_${s}_Foot`];
    if (!thigh || !calf || !foot) continue;
    const seg = (bone, child, r0, r1, overlap = 0.0) => {
      const dir = child.position.clone(); const len = dir.length(); dir.normalize();
      const geo = new THREE.CylinderGeometry(r1, r0, len + overlap, 20, 1, true);   // top = r1 (child side), bottom = r0 ... three puts +Y first
      const mesh = new THREE.Mesh(geo, m); mesh.material.side = THREE.DoubleSide;
      mesh.quaternion.setFromUnitVectors(_yAxis, dir);
      mesh.position.copy(dir).multiplyScalar((len - overlap) * 0.5);
      shadowed(mesh); return mesh;
    };
    // CylinderGeometry(radiusTop, radiusBottom): +Y end is the child end, so pass (child radius, parent radius)
    parts.push(addTo(thigh, seg(thigh, calf, 0.104 * H, 0.078 * H, 0.0)));
    parts.push(addTo(calf, seg(calf, foot, 0.074 * H, 0.056 * H, 0.0)));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.079 * H, 18, 12), m); shadowed(cap); parts.push(addTo(calf, cap));
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.058 * H, 0.058 * H, 0.03, 18, 1, true), m); cuff.material.side = THREE.DoubleSide;
    cuff.quaternion.setFromUnitVectors(_yAxis, foot.position.clone().normalize()); cuff.position.copy(foot.position).multiplyScalar(0.97);
    parts.push(addTo(calf, cuff));
  }
  return { parts, remove() { parts.forEach((p) => p.remove()); } };
}

/** One call: the full batter's kit (helmet, pads, gloves). Returns {remove()}. */
export function equipBatter(human, { shell = 0x1f4aa8, pads = 0xf4f4f0, gloves = 0xf2f2f0, trim = 0x1f4aa8 } = {}) {
  const parts = [addWhites(human, { color: pads }), addHelmet(human, { color: shell }), addPads(human, { color: pads }), addGloves(human, { color: gloves, trim })];
  return { parts, remove() { parts.forEach((p) => p.remove()); } };
}

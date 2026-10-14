// Winter clothes for the view3d athlete rig, built from simple shapes riding on the skeleton: a fur cap with ear flaps, a scarf, a
// quilted jacket hem, padded trousers, mittens, felt boots (colour only). Every piece is attached to a bone, so it moves with the body.
const TAU = Math.PI * 2;
const mat = (THREE, c, r = 0.9, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });

// the avatar's left / up / forward axes expressed in a bone's local space (at the pose the person has when the gear is fitted)
function basisOf(THREE, human, name) {
  human.root.updateMatrixWorld(true);
  const b = human.bones[`Bip01_${name}`];
  const qb = b.getWorldQuaternion(new THREE.Quaternion()), qr = human.root.getWorldQuaternion(new THREE.Quaternion());
  const rel = qb.invert().multiply(qr);
  const x = new THREE.Vector3(1, 0, 0).applyQuaternion(rel), y = new THREE.Vector3(0, 1, 0).applyQuaternion(rel), z = new THREE.Vector3(0, 0, 1).applyQuaternion(rel);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

// a tapered open tube from a bone to its child bone (r0 at the bone, r1 at the child), riding on the bone
function tube(THREE, h, boneName, childName, r0, r1, material, { cap = 0, over = 0.0 } = {}) {
  const b = h.bones[`Bip01_${boneName}`], c = h.bones[`Bip01_${childName}`];
  if (!b || !c) return null;
  const dir = c.position.clone(), len = dir.length(); dir.normalize();
  const geo = new THREE.CylinderGeometry(r1, r0, len + over, 22, 1, true);
  const m = new THREE.Mesh(geo, material); m.material.side = THREE.DoubleSide;
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  m.position.copy(dir).multiplyScalar((len + over) * 0.5 - over * 0.25);
  m.castShadow = true;
  const g = new THREE.Group(); g.add(m);
  if (cap) { const s = new THREE.Mesh(new THREE.SphereGeometry(cap, 18, 12), material); s.castShadow = true; g.add(s); }
  b.add(g);
  return { obj: g, remove() { b.remove(g); } };
}

export function dressWinter(V3, h, o = {}) {
  const { THREE } = V3;
  const parts = [];
  const jacket = o.jacket ?? '#2f4a7a', fur = o.fur ?? '#6a5238', trousers = o.trousers ?? '#2a2d36', mitt = o.mitt ?? '#7a2a24', scarf = o.scarf ?? '#b5342c', boots = o.boots ?? '#6d6a64';
  h.setKit({ top: jacket, bottoms: trousers, socks: '#cfc9b8', shoes: boots, trim: scarf });
  // padded trousers over the whole leg (the athlete_m wears shorts), a quilted jacket body and long sleeves, all riding on the bones
  try {
    const tm = mat(THREE, trousers, 0.9), jm = mat(THREE, jacket, 0.85), jd = mat(THREE, new THREE.Color(jacket).multiplyScalar(0.72).getHex(), 0.9);
    for (const sd of ['L', 'R']) {
      for (const t of [
        tube(THREE, h, `${sd}_Thigh`, `${sd}_Calf`, 0.112, 0.092, tm, { over: 0.03 }),
        tube(THREE, h, `${sd}_Calf`, `${sd}_Foot`, 0.092, 0.064, tm, { cap: 0.098, over: 0.02 }),
        tube(THREE, h, `${sd}_Clavicle`, `${sd}_UpperArm`, 0.075, 0.072, jm, { cap: 0.074, over: 0.02 }),
        tube(THREE, h, `${sd}_UpperArm`, `${sd}_Forearm`, 0.07, 0.058, jm, { cap: 0.072, over: 0.01 }),
        tube(THREE, h, `${sd}_Forearm`, `${sd}_Hand`, 0.057, 0.047, jm, { cap: 0.05 }),
      ]) if (t) parts.push(t);
    }
    // the body of the jacket: an oval tube per spine segment (wider than deep), a thicker shoulder yoke
    const body = (a, b, w0, w1, dz) => {
      const bn = h.bones[`Bip01_${a}`], ch = h.bones[`Bip01_${b}`]; if (!bn || !ch) return;
      const len = ch.position.length();
      const g = new THREE.Group(); g.quaternion.copy(basisOf(THREE, h, a)); g.position.copy(ch.position).multiplyScalar(0.5);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(w1 * 1.04, w0 * 1.04, len * 1.3, 26, 1, true), jm); m.material.side = THREE.DoubleSide; m.scale.set(1.12, 1, dz); m.castShadow = true;
      g.add(m); bn.add(g); parts.push({ obj: g, remove() { bn.remove(g); } });
    };
    body('Pelvis', 'Spine', 0.2, 0.19, 0.86); body('Spine', 'Spine1', 0.192, 0.196, 0.86); body('Spine1', 'Spine2', 0.198, 0.208, 0.88); body('Spine2', 'Neck', 0.21, 0.13, 0.84);
    // quilting: darker bands across the jacket
    for (const [bn, y, r] of [['Spine', 0.02, 0.2], ['Spine1', 0.0, 0.21], ['Spine2', 0.0, 0.214]]) {
      const bo = h.bones[`Bip01_${bn}`]; if (!bo) continue;
      const g = new THREE.Group(); g.quaternion.copy(basisOf(THREE, h, bn)); g.position.set(0, 0, 0);
      const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 6, 30), jd); t.rotation.x = Math.PI / 2; t.scale.set(1.12, 0.88, 1); t.position.y = y;
      g.add(t); bo.add(g); parts.push({ obj: g, remove() { bo.remove(g); } });
    }
  } catch (e) { console.warn('gear: body', e); }
  // fur cap (ushanka): a fluffy dome, a thick fur band, two ear flaps and a small front badge; built on the head bone
  try {
    const head = h.bones.Bip01_Head;
    if (head) {
      const g = new THREE.Group(); g.quaternion.copy(basisOf(THREE, h, 'Head'));
      const hb = h.headBox;                       // the skinned head extents, in head-bone space
      const f = h.boneFrame('Head');
      const top = hb ? f.up.clone().multiplyScalar(Math.max(hb.max.dot(f.up), hb.min.dot(f.up))) : new THREE.Vector3(0.18, 0, 0);
      const ctr = hb ? hb.getCenter(new THREE.Vector3()) : new THREE.Vector3(0.1, 0, 0);
      g.position.copy(ctr).addScaledVector(f.up, top.dot(f.up) - ctr.dot(f.up) + 0.03);
      const R = 0.118, furM = mat(THREE, fur, 1.0), furD = mat(THREE, new THREE.Color(fur).multiplyScalar(0.75).getHex(), 1.0);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 16, 0, TAU, 0, Math.PI * 0.55), furM); dome.scale.set(1.0, 0.9, 1.1); dome.position.y = -R * 0.55;
      const band = new THREE.Mesh(new THREE.TorusGeometry(R * 0.93, 0.032, 12, 32), furM); band.rotation.x = Math.PI / 2; band.position.y = -R * 0.62; band.scale.set(1.0, 1.12, 1);
      g.add(dome, band);
      for (const sx of [-1, 1]) {
        const fl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), furD); fl.scale.set(0.55, 1.5, 0.9); fl.position.set(sx * R * 0.98, -R * 0.62 - 0.06, -0.01);
        g.add(fl);
      }
      const badge = new THREE.Mesh(new THREE.CircleGeometry(0.018, 14), mat(THREE, 0xd9b13a, 0.4, 0.6)); badge.position.set(0, -R * 0.45, R * 1.03); g.add(badge);
      g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      head.add(g);
      parts.push({ obj: g, remove() { head.remove(g); } });
    }
  } catch (e) { console.warn('gear: cap', e); }
  // scarf and collar
  try {
    const neck = h.bones.Bip01_Neck;
    if (neck) {
      const g = new THREE.Group(); g.quaternion.copy(basisOf(THREE, h, 'Neck'));
      const sc = mat(THREE, scarf, 0.95);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.03, 12, 24), sc); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.02, 0.0); ring.scale.set(1.05, 1.0, 1.15);
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), sc); knot.position.set(0.055, 0.0, 0.07); knot.scale.set(1, 1.1, 0.9);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.014), sc); tail.position.set(0.05, -0.1, 0.1); tail.rotation.x = 0.1;
      g.add(ring, knot, tail); g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      neck.add(g);
      parts.push({ obj: g, remove() { neck.remove(g); } });
    }
  } catch { /* ignore */ }
  // quilted jacket hem: a short flared skirt of padding over the hips
  try {
    const pel = h.bones.Bip01_Pelvis || h.bones.Bip01;
    if (pel) {
      const g = new THREE.Group(); g.quaternion.copy(basisOf(THREE, h, 'Pelvis'));
      const m = mat(THREE, jacket, 0.88);
      const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.245, 0.34, 24, 1, true), m); hem.material.side = THREE.DoubleSide; hem.scale.set(1.05, 1, 0.82); hem.position.set(0, -0.12, 0.0);
      const quilt = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.017, 8, 28), mat(THREE, new THREE.Color(jacket).multiplyScalar(0.7).getHex(), 0.9)); quilt.rotation.x = Math.PI / 2; quilt.position.set(0, -0.15, 0); quilt.scale.set(1.07, 0.84, 1);
      g.add(hem, quilt); g.traverse((mm) => { if (mm.isMesh) mm.castShadow = true; });
      pel.add(g);
      parts.push({ obj: g, remove() { pel.remove(g); } });
    }
  } catch { /* ignore */ }
  // mittens
  try { const gl = V3.addGloves(h, { color: new THREE.Color(mitt).getHex(), trim: new THREE.Color(scarf).getHex() }); if (gl) parts.push(gl); } catch { /* ignore */ }
  return { parts, remove() { parts.forEach((p) => p.remove && p.remove()); } };
}

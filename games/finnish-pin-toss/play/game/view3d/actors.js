// The thrower: a real 3D person (view3d athlete rig) in Finnish summer clothes with an underhand toss authored as ONE clip over a
// progress value p in 0..1, scrubbed by the presenter (the arm in the picture is the pull on the screen, then the sim's release):
//   p 0.00 ready (pin held low at the hip, knees soft)    p 0.30 wound up (arm back, crouch, eyes on the bundle)
//   p 0.62 release (arm swung through, weight on the front foot)    p 0.74 follow-through (arm up toward the bundle)    p 1.00 ready.
// Feet are IK-planted at fixed character-space points, so nothing skates. Nothing here writes back to the game.
export const P_READY = 0, P_WIND = 0.3, P_REL = 0.62, P_FOLLOW = 0.74;
const TAU = Math.PI * 2;
const mat = (THREE, c, r = 0.9, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });

export async function loadThrower(V3, { character = 'athlete_m', kit, skin = 'light', hair = 'brown', lod = 0 } = {}) {
  const { loadHuman, buildClip } = V3;
  const h = await loadHuman({ character, kit, skin, hair, lod });
  h.groundClamp = 'off'; h.footPlanting = false;
  const A = { h, p: 0 };
  const arm = (R, L) => ({
    R_UpperArm: { flex: R[0], abduct: R[1], twist: R[3] || 0 }, R_Forearm: { flex: R[2] },
    L_UpperArm: { flex: L[0], abduct: L[1], twist: L[3] || 0 }, L_Forearm: { flex: L[2] },
  });
  const body = ({ lean, hip, y, z, neck, twist = 0, side = 0, arms }) => ({
    Pelvis: { pos: [0, y, z], flex: hip, twist: twist * 0.3, side },
    Spine: { flex: (lean - hip) / 3, twist: twist * 0.3, side: side * 0.3 }, Spine1: { flex: (lean - hip) / 3, twist: twist * 0.4 }, Spine2: { flex: (lean - hip) / 3, twist: twist * 0.3 },
    Neck: { flex: neck }, Head: { flex: -4 },
    ...arms,
  });
  const legs = (t, c) => ({ L_Thigh: { flex: t, abduct: 4 }, R_Thigh: { flex: t, abduct: 4 }, L_Calf: { flex: c }, R_Calf: { flex: c } });
  const K = (t, pose, ease = 'inOut') => ({ t, pose, ease });
  const ready = { ...body({ lean: 20, hip: 10, y: -0.06, z: 0.0, neck: -14, arms: arm([-6, 5, 16], [4, 10, 22]) }), ...legs(18, 32) };
  const wind = { ...body({ lean: 34, hip: 20, y: -0.12, z: -0.05, neck: -24, twist: -10, arms: arm([-58, 3, 6], [26, 34, 24, -10]) }), ...legs(24, 46) };
  const rel = { ...body({ lean: 44, hip: 26, y: -0.2, z: 0.22, neck: -32, twist: 14, side: -3, arms: arm([50, 2, 4], [-14, 48, 12, 10]) }), ...legs(30, 46) };
  const fol = { ...body({ lean: 46, hip: 28, y: -0.15, z: 0.28, neck: -34, twist: 22, side: -4, arms: arm([78, 4, 6], [-22, 56, 10, 12]) }), ...legs(26, 40) };
  const end = ready;
  const AY = 0.10;
  const lf = [
    { t: 0.00, pos: [0.12, AY, 0.06] }, { t: 0.30, pos: [0.12, AY, 0.06] },
    { t: 0.42, pos: [0.13, AY + 0.14, 0.34], ease: 'out' }, { t: 0.56, pos: [0.14, AY, 0.56], ease: 'inOut' },
    { t: 0.80, pos: [0.14, AY, 0.56] }, { t: 0.90, pos: [0.13, AY + 0.09, 0.30], ease: 'inOut' }, { t: 1.0, pos: [0.12, AY, 0.06], ease: 'out' },
  ];
  const rf = [
    { t: 0.00, pos: [-0.14, AY, -0.04] }, { t: 0.55, pos: [-0.14, AY, -0.06] },
    { t: 0.74, pos: [-0.13, AY + 0.06, -0.10], ease: 'inOut' }, { t: 0.86, pos: [-0.14, AY, -0.06], ease: 'inOut' }, { t: 1.0, pos: [-0.14, AY, -0.04] },
  ];
  const clip = buildClip(h, {
    name: 'fpt_toss', duration: 1.0, base: 'idle_relaxed', fingers: 'relaxed', events: { release: P_REL },
    keys: [K(0, ready), K(P_WIND, wind, 'linear'), K(P_REL, rel, 'linear'), K(P_FOLLOW, fol, 'linear'), K(1, end, 'inOut')],
    ik: { L_Foot: lf, R_Foot: rf },
  });
  h.addClip(clip);
  h.play('fpt_toss', { fade: 0, loop: false });
  const tr = () => h.layers.base.current;
  A.setP = (p) => { const t = tr(); if (t) { t.speed = 0; t.time = Math.max(0, Math.min(0.999, p)) * clip.dur; } A.p = p; };
  return A;
}

// ---- summer clothes built from simple shapes riding on the skeleton ---------------------------------------------------------------------
function basisOf(THREE, human, name) {
  human.root.updateMatrixWorld(true);
  const b = human.bones[`Bip01_${name}`];
  const qb = b.getWorldQuaternion(new THREE.Quaternion()), qr = human.root.getWorldQuaternion(new THREE.Quaternion());
  const rel = qb.invert().multiply(qr);
  const x = new THREE.Vector3(1, 0, 0).applyQuaternion(rel), y = new THREE.Vector3(0, 1, 0).applyQuaternion(rel), z = new THREE.Vector3(0, 0, 1).applyQuaternion(rel);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
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

// look: { top, bottoms, hat: 'cap' | 'sunhat' | 'none', hatColor, trousers: true|false, sleeves: color|null }
export function dressSummer(V3, h, look = {}) {
  const { THREE } = V3;
  const parts = [];
  const top = look.top ?? '#e9eef2', bottoms = look.bottoms ?? '#4a6384', socks = look.socks ?? '#f2f2f2';
  h.setKit({ top, bottoms, socks, shoes: look.shoes ?? '#d8d4c8' });
  if (look.trousers !== false) {
    try {
      const tm = mat(THREE, bottoms, 0.92);
      for (const sd of ['L', 'R']) {
        for (const t of [
          tube(THREE, h, `${sd}_Thigh`, `${sd}_Calf`, 0.106, 0.082, tm, { cap: 0.104, over: 0.04 }),
          tube(THREE, h, `${sd}_Calf`, `${sd}_Foot`, 0.082, 0.062, tm, { cap: 0.082, over: 0.02 }),
        ]) if (t) parts.push(t);
      }
    } catch (e) { console.warn('gear: trousers', e); }
  }
  if (look.sleeves) {
    try {
      const sm = mat(THREE, look.sleeves, 0.9);
      for (const sd of ['L', 'R']) for (const t of [tube(THREE, h, `${sd}_UpperArm`, `${sd}_Forearm`, 0.062, 0.052, sm, { cap: 0.064, over: 0.01 })]) if (t) parts.push(t);
    } catch { /* ignore */ }
  }
  const hatKind = look.hat ?? 'cap';
  if (hatKind !== 'none') {
    try {
      const head = h.bones.Bip01_Head;
      if (head) {
        const g = new THREE.Group(); g.quaternion.copy(basisOf(THREE, h, 'Head'));
        const hb = h.headBox, f = h.boneFrame('Head');
        const top2 = hb ? Math.max(hb.max.dot(f.up), hb.min.dot(f.up)) : 0.18;
        const ctr = hb ? hb.getCenter(new THREE.Vector3()) : new THREE.Vector3(0.1, 0, 0);
        g.position.copy(ctr).addScaledVector(f.up, top2 - ctr.dot(f.up) + 0.02);
        const col = look.hatColor ?? '#e8dcb0', m = mat(THREE, col, 0.9);
        if (hatKind === 'sunhat') {
          const R = 0.12;
          const crown = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 14, 0, TAU, 0, Math.PI * 0.5), m); crown.position.y = -R * 0.45; crown.scale.set(1, 0.75, 1.08);
          const brim = new THREE.Mesh(new THREE.CylinderGeometry(R * 2.05, R * 2.05, 0.012, 32), m); brim.position.y = -R * 0.42; brim.scale.set(1, 1, 1.0);
          const ribbon = new THREE.Mesh(new THREE.TorusGeometry(R * 0.98, 0.014, 8, 28), mat(THREE, look.ribbon ?? '#3a5c9a', 0.8)); ribbon.rotation.x = Math.PI / 2; ribbon.position.y = -R * 0.5;
          g.add(crown, brim, ribbon);
        } else {
          const R = 0.116;
          const dome = new THREE.Mesh(new THREE.SphereGeometry(R * 1.08, 24, 16, 0, TAU, 0, Math.PI * 0.6), m); dome.position.y = -R * 0.72; dome.scale.set(1.02, 0.95, 1.12);
          const visor = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.95, R * 0.95, 0.012, 20, 1, false, -Math.PI * 0.45, Math.PI * 0.9), m); visor.position.set(0, -R * 0.78, R * 0.78); visor.scale.set(1, 1, 0.8);
          const button = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), m); button.position.y = R * 0.28;
          g.add(dome, visor, button);
        }
        g.traverse((mm) => { if (mm.isMesh) mm.castShadow = true; });
        head.add(g); parts.push({ obj: g, remove() { head.remove(g); } });
      }
    } catch (e) { console.warn('gear: hat', e); }
  }
  return { parts, remove() { parts.forEach((p) => p.remove && p.remove()); } };
}
void TAU;

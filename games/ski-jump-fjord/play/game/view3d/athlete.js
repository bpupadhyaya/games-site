// The jumper: a lifelike Rocketbox figure in a ski-jump suit, helmet, goggles, gloves and boots on two long skis, plus the authored poses for the crouch, the
// take-off, the flight, the landing variants and the celebration. The sim sets which pose and how far into it; the skis follow the feet every frame.
export async function loadAthlete(V3, { character = 'athlete_m', lod = 0 } = {}) {
  const { loadHuman, buildClip, THREE, addWhites, addGloves } = V3;
  const female = character === 'athlete_f';
  const suit = 0xd5361f, dark = 0x16263c;
  const h = await loadHuman({
    character,
    kit: { top: '#d5361f', bottoms: '#d5361f', socks: '#16263c' },
    skin: 'light', hair: female ? 'brown' : 'brown', lod,
  });
  h.groundClamp = 'off'; h.footPlanting = false;
  const A = { h, THREE, ready: true, clips: {}, skis: [], gear: [] };
  const mat = (c, r = 0.5, m = 0.1) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });

  // ---- suit: long legs and gloves so no bare skin shows in the crouch
  try { A.gear.push(addWhites(h, { color: suit, force: true })); } catch (e) { console.warn('legs', e); }
  try { A.gear.push(addGloves(h, { color: 0x1a2330, trim: 0xd5361f })); } catch (e) { console.warn('gloves', e); }


  // ---- sleeves over the bare arms, and ski boots over the trainers
  try {
    const suitM = mat(suit, 0.85, 0.02); suitM.side = THREE.DoubleSide;
    const yAxis = new THREE.Vector3(0, 1, 0);
    const seg = (bone, child, r0, r1) => {
      const dir = child.position.clone(); const len = dir.length(); dir.normalize();
      const geo = new THREE.CylinderGeometry(r1, r0, len, 18, 1, true);
      const mesh = new THREE.Mesh(geo, suitM);
      mesh.quaternion.setFromUnitVectors(yAxis, dir); mesh.position.copy(dir).multiplyScalar(len * 0.5); mesh.castShadow = true;
      bone.add(mesh); A.gear.push({ remove() { bone.remove(mesh); } });
    };
    for (const sd of ['L', 'R']) {
      const up = h.bones[`Bip01_${sd}_UpperArm`], fo = h.bones[`Bip01_${sd}_Forearm`], hand = h.bones[`Bip01_${sd}_Hand`];
      if (up && fo && hand) {
        seg(up, fo, 0.056, 0.045); seg(fo, hand, 0.045, 0.036);
        const el = new THREE.Mesh(new THREE.SphereGeometry(0.047, 14, 10), suitM); el.castShadow = true; fo.add(el); A.gear.push({ remove() { fo.remove(el); } });
        const sh = new THREE.Mesh(new THREE.SphereGeometry(0.078, 14, 10), suitM); sh.castShadow = true; up.add(sh); A.gear.push({ remove() { up.remove(sh); } });
      }
      const foot = h.bones[`Bip01_${sd}_Foot`], toe = h.bones[`Bip01_${sd}_Toe0`], calf = h.bones[`Bip01_${sd}_Calf`];
      if (foot && toe) {
        const bm = mat(0x151a20, 0.5, 0.2), dir = toe.position.clone(), len = dir.length(); dir.normalize();
        const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, Math.max(0.12, len * 1.5), 6, 12), bm);
        boot.quaternion.setFromUnitVectors(yAxis, dir); boot.position.copy(dir).multiplyScalar(len * 0.55); boot.castShadow = true;
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.07, 0.2, 14), bm); shaft.position.set(0, 0, 0); shaft.castShadow = true;
        const up = foot.position.clone().negate().normalize();
        shaft.quaternion.setFromUnitVectors(yAxis, up); shaft.position.copy(up).multiplyScalar(0.09);
        foot.add(boot, shaft); A.gear.push({ remove() { foot.remove(boot, shaft); } });
      }
      void calf;
    }
  } catch (e) { console.warn('sleeves', e); }

  // ---- helmet and goggles, sized from the skinned head
  try {
    const head = h.bones.Bip01_Head, fr = h.boneFrame('Head');
    const left = fr.left.clone().normalize(), up = fr.up.clone().normalize(), fwd = fr.fwd.clone().normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(left, up, fwd));
    const box = h.headBox;
    const c = box ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3(0.07, 0, 0);
    const upExt = box ? Math.max(box.max.dot(up), box.min.dot(up)) : 0.2, fwdExt = box ? Math.max(box.max.dot(fwd), box.min.dot(fwd)) : 0.1;
    const topPt = c.clone().addScaledVector(up, upExt - c.dot(up)), frontPt = c.clone().addScaledVector(fwd, fwdExt - c.dot(fwd));
    const g = new THREE.Group(); g.quaternion.copy(q);
    const R = 0.125;
    g.position.copy(topPt).addScaledVector(up, -R * 0.62);
    const shellM = mat(0xf3f6f9, 0.3, 0.2);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(R, 36, 22, 0, Math.PI * 2, 0, Math.PI * 0.62), shellM); shell.scale.set(1.0, 1, 1.12);
    g.add(shell);
    const band = new THREE.Mesh(new THREE.TorusGeometry(R * 0.985, 0.006, 6, 40), mat(suit, 0.5)); band.rotation.x = Math.PI / 2; band.position.y = -R * 0.12; band.scale.set(1, 1.12, 1); g.add(band);
    // goggles on the face, strap round the helmet
    const gog = new THREE.Group();
    const lens = new THREE.Mesh(new THREE.SphereGeometry(R * 0.98, 24, 12, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.4, Math.PI * 0.2), new THREE.MeshStandardMaterial({ color: 0x1b2a3a, roughness: 0.12, metalness: 0.7, side: THREE.DoubleSide }));
    lens.scale.set(1.0, 1, 1.14); gog.add(lens);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(R * 1.0, 0.012, 6, 40), mat(0x111820, 0.8)); strap.rotation.x = Math.PI / 2; strap.position.y = -R * 0.07; strap.scale.set(1, 1.12, 1); gog.add(strap);
    gog.position.set(0, -R * 0.2, R * 0.02); g.add(gog);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    head.add(g); A.gear.push({ remove() { head.remove(g); } });
    void frontPt;
  } catch (e) { console.warn('helmet', e); }

  // ---- skis: long thin boards with an upturned tip, a coloured top and a binding block
  const makeSki = (tint) => {
    const g = new THREE.Group();
    const L = 2.45, body = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.014, L), mat(0x20262e, 0.4, 0.3));
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.093, 0.002, L - 0.02), mat(tint, 0.45, 0.1)); top.position.y = 0.0085;
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.014, 0.34), mat(0x20262e, 0.4, 0.3)); tip.position.set(0, 0.04, L / 2 + 0.1); tip.rotation.x = -0.34;
    const tipTop = new THREE.Mesh(new THREE.BoxGeometry(0.093, 0.002, 0.33), mat(tint, 0.45, 0.1)); tipTop.position.set(0, 0.048, L / 2 + 0.1); tipTop.rotation.x = -0.34;
    const bind = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.34), mat(0x9aa7b4, 0.35, 0.6)); bind.position.set(0, 0.022, -0.02);
    g.add(body, top, tip, tipTop, bind);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  };
  A.skis = [makeSki(0xf2f6fa), makeSki(0xf2f6fa)];

  // ---- the poses. Character space: +Y up, +Z forward. A pose is described by what you can see: the torso lean T from vertical (forward +), the leg angle from
  // vertical (knee forward +), the knee bend, and the arms. Pelvis flex tilts torso AND legs together, so the thigh flex adds it back.
  const mk = (spec) => { const c = buildClip(h, spec); h.addClip(c); A.clips[spec.name] = c; return c; };
  const arm = (flex, abd, fore = 8, tw = 0) => ({ L_UpperArm: { flex, abduct: abd, twist: tw }, R_UpperArm: { flex, abduct: abd, twist: -tw }, L_Forearm: { flex: fore }, R_Forearm: { flex: fore } });
  const body = ({ T = 0, th = 0, th2 = th, kn = 0, kn2 = kn, pos = [0, 0, 0], neck, abd = 3, twist = 0, side = 0, arms }) => {
    const pel = T * 0.55, sp = T - pel;
    return {
      Pelvis: { pos, flex: pel, twist, side }, Spine: { flex: sp * 0.34 }, Spine1: { flex: sp * 0.4 }, Spine2: { flex: sp * 0.26 },
      Neck: { flex: neck === undefined ? -T * 0.55 : neck }, Head: { flex: -4 },
      L_Thigh: { flex: th + pel, abduct: abd }, R_Thigh: { flex: th2 + pel, abduct: abd }, L_Calf: { flex: kn }, R_Calf: { flex: kn2 },
      ...(arms || arm(10, 8, 12)),
    };
  };
  const stand = body({ T: 8, th: 10, kn: 18, pos: [0, -0.03, 0], arms: arm(14, 10, 20) });
  const tuck = body({ T: 64, th: 80, kn: 122, pos: [0, -0.4, -0.12], arms: arm(-40, 6, 6) });
  const extend = body({ T: 10, th: 4, kn: 8, pos: [0, 0, 0.04], arms: arm(70, 18, 10) });
  const fly = body({ T: 78, th: -64, kn: 8, pos: [0, 0, 0], arms: arm(-30, 6, 6) });
  const prep = body({ T: 36, th: 40, kn: 60, pos: [0, -0.14, 0.02], arms: arm(18, 50, 12) });
  // one clip scrubbed by the sim: crouch (0), extension (0.14), flight (0.45), landing prepared (1.0)
  mk({ name: 'sj_air', duration: 1.0, base: 'idle', smoothTrunk: false, keys: [
    { t: 0, pose: tuck },
    { t: 0.14, ease: 'out', pose: extend },
    { t: 0.45, ease: 'inOut', pose: fly },
    { t: 1.0, ease: 'inOut', pose: prep },
  ], fingers: 'relaxed' });
  // on the in-run: standing (0) to full crouch (1)
  mk({ name: 'sj_ground', duration: 1.0, base: 'idle', smoothTrunk: false, keys: [{ t: 0, pose: stand }, { t: 1.0, ease: 'inOut', pose: tuck }], fingers: 'relaxed' });
  // landings, each starting from the prepared pose
  const tele = body({ T: 24, th: 52, th2: -16, kn: 72, kn2: 104, pos: [0, -0.22, 0.02], arms: arm(14, 78, 10) });
  const rise = body({ T: 6, th: 8, th2: 2, kn: 18, kn2: 12, arms: arm(150, 28, 8) });
  mk({ name: 'sj_tele', duration: 1.6, base: 'idle', smoothTrunk: false, keys: [
    { t: 0, pose: prep }, { t: 0.18, ease: 'out', pose: tele }, { t: 0.8, pose: tele }, { t: 1.3, ease: 'inOut', pose: rise },
  ], fingers: 'open' });
  const clean = body({ T: 40, th: 62, kn: 96, pos: [0, -0.3, -0.04], arms: arm(20, 66, 12) });
  mk({ name: 'sj_clean', duration: 1.4, base: 'idle', smoothTrunk: false, keys: [
    { t: 0, pose: prep }, { t: 0.18, ease: 'out', pose: clean }, { t: 0.7, pose: clean }, { t: 1.2, ease: 'inOut', pose: body({ T: 6, th: 10, kn: 22, arms: arm(110, 30, 10) }) },
  ], fingers: 'open' });
  const rough = body({ T: 56, th: 72, th2: 62, kn: 112, kn2: 100, pos: [0, -0.32, -0.12], abd: 10, arms: arm(40, 84, 20) });
  mk({ name: 'sj_rough', duration: 1.4, base: 'idle', smoothTrunk: false, keys: [
    { t: 0, pose: prep }, { t: 0.14, ease: 'out', pose: rough }, { t: 0.6, ease: 'inOut', pose: body({ T: 44, th: 60, th2: 56, kn: 100, kn2: 92, pos: [0, -0.28, -0.1], arms: arm(70, 70, 24) }) },
    { t: 1.2, ease: 'inOut', pose: body({ T: 16, th: 28, kn: 46, pos: [0, -0.08, 0], arms: arm(40, 40, 16) }) },
  ], fingers: 'open' });
  mk({ name: 'sj_squat', duration: 0.6, base: 'idle', smoothTrunk: false, keys: [{ t: 0, pose: prep }, { t: 0.2, ease: 'out', pose: body({ T: 40, th: 62, kn: 92, pos: [0, -0.26, 0], arms: arm(18, 52, 12) }) }], fingers: 'open' });
  mk({ name: 'sj_cheer', duration: 1.2, loop: true, base: 'idle', smoothTrunk: false, keys: [{ t: 0, pose: { ...stand, ...arm(165, 35, 6) } }, { t: 0.6, pose: { ...stand, ...arm(150, 55, 6) } }, { t: 1.2, pose: { ...stand, ...arm(165, 35, 6) } }], fingers: 'open' });
  h.play('sj_ground', { fade: 0 });
  return A;
}

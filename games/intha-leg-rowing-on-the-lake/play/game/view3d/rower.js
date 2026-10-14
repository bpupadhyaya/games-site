// The Intha rower: a real lifelike figure (view3d athlete) standing on ONE leg on the stern platform. The free leg is lifted and wrapped
// round the oar shaft, the foot hooking it, so the leg drives the sweep. One hand holds the net pole, the other arm is flung out for balance.
// The presenter hands us the boat's posed oar and net (sim-driven); hands and the free foot are placed on them every frame by IK.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export async function loadRower(V3, stage, { look, female = false, lod = 0 } = {}) {
  const { loadHuman, buildClip, THREE } = V3;
  const h = await loadHuman({
    character: female ? 'athlete_f' : 'athlete_m',
    kit: { top: look.shirt, bottoms: look.sarong, socks: look.sarong },
    skin: look.skin, hair: 'black', lod,
  });
  h.groundClamp = 'off'; h.footPlanting = false;
  stage.add(h); stage.track(h);
  // the stance: weight on the left leg, right thigh lifted and opened, knee bent, a light backward counter-lean and a steady head
  const stance = (j) => ({
    Pelvis: { pos: [0, -0.03, 0], side: 5 + j, flex: 2, twist: 4 },
    Spine: { flex: -3, side: -4 - j }, Spine1: { flex: -2, side: -3 }, Spine2: { flex: -1, side: -2 },
    Neck: { flex: 4 }, Head: { flex: -3 },
    L_Thigh: { flex: 3, abduct: 3 }, L_Calf: { flex: 5 },
    R_Thigh: { flex: 62, abduct: 24 + j, twist: 8 }, R_Calf: { flex: 84 },
    L_UpperArm: { flex: 12, abduct: 55 }, R_UpperArm: { flex: 38, abduct: 12 },
    L_Forearm: { flex: 22 }, R_Forearm: { flex: 38 },
  });
  const clip = buildClip(h, { name: 'ilr_stand', duration: 2.4, loop: true, base: 'idle', smoothTrunk: false,
    keys: [{ t: 0, pose: stance(0) }, { t: 1.2, ease: 'inOut', pose: stance(2.5) }, { t: 2.4, ease: 'inOut', pose: stance(0) }], fingers: 'open' });
  h.addClip(clip);
  h.play('ilr_stand', { fade: 0 });

  // a wrapped head cloth with its knot (the figure's own hair shows under it). Placed from world offsets so the bone's local axes do not matter.
  const R = { h, taken: false, ready: true };
  try {
    const head = h.bones.Bip01_Head || h.bones.Head;
    if (head) {
      h.root.updateMatrixWorld(true);
      const hp = head.getWorldPosition(new THREE.Vector3()), hq = head.getWorldQuaternion(new THREE.Quaternion()), inv = hq.clone().invert();
      const mat = new THREE.MeshStandardMaterial({ color: look.wrap, roughness: 0.85 });
      const cloth = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), mat);
      cloth.scale.set(0.098, 0.062, 0.108); cloth.quaternion.copy(inv);
      cloth.position.copy(head.worldToLocal(hp.clone().add(new THREE.Vector3(0, 0.125, -0.012))));
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.016, 8, 24), mat);
      band.rotation.x = Math.PI / 2; band.quaternion.premultiply(inv); band.position.copy(head.worldToLocal(hp.clone().add(new THREE.Vector3(0, 0.112, -0.012))));
      band.scale.set(1, 1.08, 1);
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), mat);
      knot.position.copy(head.worldToLocal(hp.clone().add(new THREE.Vector3(0.0, 0.1, -0.115))));
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat); tail.scale.set(0.7, 1.6, 0.7); tail.quaternion.copy(inv);
      tail.position.copy(head.worldToLocal(hp.clone().add(new THREE.Vector3(0.012, 0.062, -0.135))));
      head.add(cloth, band, knot, tail); R.cloth = cloth;
    }
  } catch { /* the head cloth is decoration only */ }

  const v = new THREE.Vector3();
  const hint = new THREE.Vector3();
  let pm = 0;
  // pose: called every frame by the presenter AFTER the boat group, oar pivot and net were posed and BEFORE stage.update(dt)
  R.pose = (bt, c) => {
    const { b, m, t, s } = c;
    const sp = clamp(0.45 + (1 - m.poise) * 0.5 + Math.abs(m.sway) * 0.25, 0.3, 1.2);
    pm += 0;
    h.root.position.set(-1.8, 0.18, 0.14);
    const twist = -m.a * 0.2, lean = -m.sway * 0.18 + Math.sin(t * 1.3 + b.id) * 0.012 * (1 + (1 - m.poise) * 2);
    h.root.rotation.set(0, Math.PI / 2 + twist, lean);
    bt.group.updateMatrixWorld(true);
    const world = (x, y, z) => bt.model.localToWorld(v.set(x, y, z)).clone();
    // free foot on the oar shaft just outboard of the post (the leg drives the sweep)
    const r = 0.26, ca = Math.cos(c.ang), sa = Math.sin(c.ang);
    const fx = -1.9 + ca * r * Math.cos(c.phi), fz = 0.36 + sa * r * Math.cos(c.phi), fy = 0.64 - Math.sin(c.phi) * r + 0.1;
    h.setReachFoot('R', world(fx, fy, fz - 0.03), 1);
    // hands: the right on the net pole, the left flung out for balance (spreads as poise falls)
    const ps = s.poleStart, pe = s.poleEnd;
    const gx = ps.x + (pe.x - ps.x) * 0.2, gy = ps.y + (pe.y - ps.y) * 0.2, gz = ps.z + (pe.z - ps.z) * 0.2;
    h.setReach('R', world(gx, gy, gz), { weight: 1, pole: world(gx - 0.1, gy - 0.35, gz + 0.35) });
    const wob = Math.sin(t * 4.6 + b.id * 2) * 0.05 * (0.6 + sp);
    h.setReach('L', world(-1.55, 1.74 + wob, -0.18 - 0.5 - sp * 0.28), { weight: 1, pole: world(-1.8, 1.45, -0.7) });
    void hint;
  };
  R.step = () => {};
  return R;
}

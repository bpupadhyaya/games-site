// The jumper: a lifelike Rocketbox figure in a plain shirt and shorts, plus the authored poses for the hang on the pole, the leap, the flight and the landing,
// and the pole itself (a chain of tapered segments that can bow under load). The sim sets which pose and how far into it; the hands and feet are placed on
// the pole every frame by the presenter (two-bone IK), so the picture agrees with the sim.
export async function loadAthlete(V3, { character = 'athlete_m' } = {}) {
  // full detail ALWAYS (no LOD sets, no tier swaps in the simplified hands/shoulders) and a long top (no tank armhole edge): the athlete is seen close up.
  const { loadHuman, buildClip, THREE } = V3;
  const female = character === 'athlete_f';
  const h = await loadHuman({
    character,
    kit: { top: female ? '#c9442f' : '#e9eef2', bottoms: '#1d3552', socks: '#e9eef2' },
    skin: 'light', hair: female ? 'brown' : 'brown', top: 'long',
  });
  h.lodAuto = false;
  h.groundClamp = 'off'; h.footPlanting = false;
  const A = { h, THREE, ready: true, clips: {}, gear: [] };
  const mat = (c, r = 0.5, m = 0.1) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });

  // ---- poses. Character space: +Y up, +Z forward. A pose is described by what you can see: the torso lean T from vertical (forward +), the leg angle from
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
  // hanging on the pole: arms overhead, body long, knees bent with the feet on the pole
  const hang = body({ T: 2, th: -6, th2: 10, kn: 18, kn2: 40, pos: [0, 0, 0], neck: -8, abd: 2, arms: arm(165, 4, 4) });
  const hangB = body({ T: 3, th: 10, th2: -8, kn: 42, kn2: 16, pos: [0, 0, 0], neck: -8, abd: 2, arms: arm(165, 4, 4) });
  mk({ name: 'cvp_hang', duration: 1.8, loop: true, base: 'idle', smoothTrunk: false, keys: [{ t: 0, pose: hang }, { t: 0.9, ease: 'inOut', pose: hangB }, { t: 1.8, ease: 'inOut', pose: hang }], fingers: 'fist' });
  // the leap onto the pole: one clip scrubbed by the sim from the take-off (0) to the grab (1)
  const takeoff = body({ T: 22, th: 22, th2: -30, kn: 40, kn2: 80, pos: [0, 0, 0], arms: arm(30, 6, 60) });
  const reach = body({ T: 10, th: 70, th2: -14, kn: 100, kn2: 40, pos: [0, 0.05, 0.05], arms: arm(160, 12, 8) });
  mk({ name: 'cvp_leap', duration: 1.0, base: 'idle', smoothTrunk: false, keys: [{ t: 0, pose: takeoff }, { t: 1.0, ease: 'out', pose: reach }], fingers: 'open' });
  // the flight, scrubbed by the lean: 0 = High (tucked and hanging), 1 = Flat (stretched forward, legs out)
  const flyHigh = body({ T: 30, th: 78, kn: 88, pos: [0, -0.05, 0], arms: arm(100, 40, 20) });
  const flyFlat = body({ T: 54, th: 84, th2: 78, kn: 18, kn2: 24, pos: [0, 0, 0.1], arms: arm(40, 28, 10) });
  mk({ name: 'cvp_fly', duration: 1.0, base: 'idle', smoothTrunk: false, keys: [{ t: 0, pose: flyHigh }, { t: 1.0, ease: 'inOut', pose: flyFlat }], fingers: 'open' });
  // landings: sit down onto the sand with the weight forward (clean), or a stumble forward (rough)
  const sitClean = body({ T: 38, th: 66, kn: 86, pos: [0, -0.34, -0.1], arms: arm(24, 60, 14) });
  const rise = body({ T: 6, th: 8, kn: 18, arms: arm(150, 28, 8) });
  mk({ name: 'cvp_land', duration: 1.6, base: 'idle', smoothTrunk: false, keys: [{ t: 0, pose: flyFlat }, { t: 0.2, ease: 'out', pose: sitClean }, { t: 0.8, pose: sitClean }, { t: 1.4, ease: 'inOut', pose: rise }], fingers: 'open' });
  const stumble = body({ T: 62, th: 72, th2: 58, kn: 100, kn2: 90, pos: [0, -0.3, 0.1], abd: 12, arms: arm(70, 70, 24) });
  mk({ name: 'cvp_rough', duration: 1.5, base: 'idle', smoothTrunk: false, keys: [{ t: 0, pose: flyFlat }, { t: 0.15, ease: 'out', pose: stumble }, { t: 0.7, ease: 'inOut', pose: body({ T: 40, th: 56, kn: 80, pos: [0, -0.24, 0], arms: arm(60, 50, 18) }) }, { t: 1.3, ease: 'inOut', pose: rise }], fingers: 'open' });
  mk({ name: 'cvp_cheer', duration: 1.2, loop: true, base: 'idle', smoothTrunk: false, keys: [{ t: 0, pose: { ...rise, ...arm(165, 35, 6) } }, { t: 0.6, pose: { ...rise, ...arm(150, 55, 6) } }, { t: 1.2, pose: { ...rise, ...arm(165, 35, 6) } }], fingers: 'open' });
  // standing at the start mark: a settled, ready stance
  mk({ name: 'cvp_ready', duration: 1.0, loop: true, base: 'idle', smoothTrunk: false, keys: [{ t: 0, pose: body({ T: 14, th: 12, kn: 26, pos: [0, -0.04, 0], arms: arm(26, 8, 40) }) }, { t: 0.5, ease: 'inOut', pose: body({ T: 16, th: 14, kn: 30, pos: [0, -0.06, 0], arms: arm(30, 8, 44) }) }, { t: 1.0, ease: 'inOut', pose: body({ T: 14, th: 12, kn: 26, pos: [0, -0.04, 0], arms: arm(26, 8, 40) }) }], fingers: 'fist' });

  // ---- the pole: a tapered chain of segments; update() lays it along the bent line from the foot to the top
  const SEG = 16;
  const poleG = new THREE.Group();
  const woodM = mat(0xcfb78a, 0.7, 0.05), bandM = mat(0x2d4a6a, 0.6, 0.1);
  const segs = [];
  for (let i = 0; i < SEG; i++) {
    const t0 = i / SEG, t1 = (i + 1) / SEG, r0 = 0.032 - 0.012 * t0, r1 = 0.032 - 0.012 * t1;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 1, 10, 1), i % 5 === 2 ? bandM : woodM);
    m.castShadow = true; poleG.add(m); segs.push(m);
  }
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.08, 18), mat(0x6e7b86, 0.5, 0.3)); poleG.add(foot);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat(0x2d4a6a)); poleG.add(tip);
  const yAxis = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
  A.pole = {
    group: poleG,
    // base (world), unit direction u (in the YZ plane), bowing direction n, length, bend amount (m of sideways bow at the middle)
    update(base, u, n, L, bend) {
      for (let i = 0; i < SEG; i++) {
        const a = i / SEG, b = (i + 1) / SEG;
        const sa = 4 * a * (1 - a) * bend, sb = 4 * b * (1 - b) * bend;
        p0.set(base.x + u.x * L * a + n.x * sa, base.y + u.y * L * a + n.y * sa, base.z + u.z * L * a + n.z * sa);
        p1.set(base.x + u.x * L * b + n.x * sb, base.y + u.y * L * b + n.y * sb, base.z + u.z * L * b + n.z * sb);
        dir.copy(p1).sub(p0); const len = dir.length(); dir.normalize();
        const m = segs[i];
        m.position.copy(p0).add(p1).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(yAxis, dir);
        m.scale.set(1, len, 1);
      }
      foot.position.set(base.x, base.y - 0.02, base.z);
      tip.position.set(base.x + u.x * L, base.y + u.y * L, base.z + u.z * L);
    },
    // the point on the pole at distance r from the foot (with the bow)
    at(base, u, n, L, bend, r, out) {
      const a = Math.max(0, Math.min(1, r / L)), s = 4 * a * (1 - a) * bend;
      return out.set(base.x + u.x * r + n.x * s, base.y + u.y * r + n.y * s, base.z + u.z * r + n.z * s);
    },
  };
  h.play('cvp_ready', { fade: 0 });
  return A;
}

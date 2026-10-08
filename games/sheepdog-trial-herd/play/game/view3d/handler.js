// The handler: a lifelike Rocketbox figure in a tweed flat cap and a waxed jacket, with a shepherd's crook in the left hand and authored signal clips
// (arm out to the left or right, a forward push, a flat hand down, a raised stop hand), each with the right hand coming to the lips for the whistle.
export async function loadHandler(V3, { lod = 0 } = {}) {
  const { loadHuman, buildClip, THREE, addCap } = V3;
  const h = await loadHuman({ character: 'athlete_m', kit: { top: '#4c5a3b', bottoms: '#5a4936', socks: '#2e2a26' }, skin: 'light', hair: 'grey', lod });
  h.groundClamp = 'auto'; h.footPlanting = true;
  let cap = null; try { cap = addCap(h, { color: 0x6b5d4a }); } catch (e) { console.warn('cap', e); }
  // the crook, held upright in the left hand
  const staff = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5530, roughness: 0.7 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 1.55, 8), wood); shaft.position.y = 0.05; staff.add(shaft);
  const pts = []; for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI * 1.15; pts.push(new THREE.Vector3(0, 0.82 + Math.sin(a) * 0.1, -0.1 + Math.cos(a) * 0.1 - 0.0)); }
  const hook = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.016, 6, false), wood); staff.add(hook);
  staff.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const A = { h, cap, staff, clips: {}, THREE };
  dress(THREE, h);
  const mk = (spec) => { const c = buildClip(h, spec); h.addClip(c); A.clips[spec.name] = c; return c; };
  const hold = { L_UpperArm: { flex: 8, abduct: 6 }, L_Forearm: { flex: 38 }, Spine1: { flex: 2 } };
  // idle with the crook
  mk({ name: 's_idle', base: 'idle', inherit: true, keys: [{ t: 0, pose: hold }], fingers: 'relaxed' });
  // signals: the right arm does the work; keys: raise (0.35), hold, drop
  const sig = (name, up, extra = {}) => mk({
    name, duration: 1.5, base: 'idle', inherit: true,
    keys: [
      { t: 0, pose: hold },
      { t: 0.35, ease: 'out', pose: { ...hold, ...up } },
      { t: 1.0, ease: 'inOut', pose: { ...hold, ...up, ...(extra.hold || {}) } },
      { t: 1.5, ease: 'inOut', pose: hold },
    ], fingers: extra.fingers || 'open',
  });
  sig('s_left', { L_UpperArm: { flex: 4, abduct: 84 }, L_Forearm: { flex: 6 }, Spine1: { twist: 8 } });          // Come bye: the left arm sweeps out to the left
  sig('s_right', { R_UpperArm: { flex: 6, abduct: 84 }, R_Forearm: { flex: 6 }, Spine1: { twist: -8 } });       // Away to me: the right arm out to the right
  sig('s_walk', { R_UpperArm: { flex: 72, abduct: 6 }, R_Forearm: { flex: 12 } }, { hold: { R_UpperArm: { flex: 92, abduct: 4 } } });   // Walk on: a push forward
  sig('s_lie', { R_UpperArm: { flex: 52, abduct: 10 }, R_Forearm: { flex: 14 } }, { hold: { R_UpperArm: { flex: 36, abduct: 10 } }, fingers: 'flat' });   // Lie down: a flat hand pressed down
  sig('s_stand', { R_UpperArm: { flex: 100, abduct: 14 }, R_Forearm: { flex: 84 } }, { fingers: 'open' });       // Stand: the raised stop hand
  h.play('s_idle', { fade: 0 });
  return A;
}

// Long waxed-cotton sleeves, corduroy trousers and tall rubber boots over the athlete's shorts, vest and trainers.
function dress(THREE, h) {
  const B = (n) => h.bones[`Bip01_${n}`];
  const cloth = (c, r = 0.82) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
  const jacket = cloth(0x4c5a3b, 0.7), trousers = cloth(0x5d4a35, 0.9), boot = cloth(0x1d2420, 0.45), cuff = cloth(0x2c3426, 0.8);
  // a tapering tube along the child bone's local vector (its +X) starting at the parent bone
  const tube = (parent, child, r0, r1, mat, from = 0, to = 1) => {
    if (!parent || !child) return null;
    const v = child.position, L = v.length();
    const g = new THREE.CylinderGeometry(r1, r0, L * (to - from), 14, 1, false);
    g.rotateZ(-Math.PI / 2); g.translate(L * (from + to) / 2, 0, 0);
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  for (const s of ['L', 'R']) {
    tube(B(`${s}_UpperArm`), B(`${s}_Forearm`), 0.062, 0.052, jacket, 0.0, 1.0);
    tube(B(`${s}_Forearm`), B(`${s}_Hand`), 0.052, 0.042, jacket, 0.0, 0.95);
    tube(B(`${s}_Forearm`), B(`${s}_Hand`), 0.047, 0.047, cuff, 0.86, 1.0);
    tube(B(`${s}_Thigh`), B(`${s}_Calf`), 0.108, 0.078, trousers, 0.0, 1.02);
    tube(B(`${s}_Calf`), B(`${s}_Foot`), 0.077, 0.066, trousers, 0.0, 0.5);
    tube(B(`${s}_Calf`), B(`${s}_Foot`), 0.074, 0.062, boot, 0.42, 1.05);
    // the boot's foot: a rounded sole along the foot bone's toe vector
    const foot = B(`${s}_Foot`), toe = B(`${s}_Toe0`);
    if (foot && toe) {
      const v = toe.position.clone(), L = v.length();
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), boot);
      m.scale.set(L * 0.78, 0.058, 0.062); m.position.copy(v).multiplyScalar(0.45);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), v.clone().normalize()); m.castShadow = true; foot.add(m);
      const m2 = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), boot); m2.scale.set(0.07, 0.06, 0.065); m2.position.set(0.02, 0.01, 0); foot.add(m2);
    }
  }
}

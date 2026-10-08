// One rope-puller: a Rocketbox athlete in team kit with a headband, and the authored tug poses (set, heave, dig in, ready, stumble, cheer).
// The pose is one continuous number the presenter scrubs: p 0 = set (leaning back, weight in the heels), 0.5 = heave (hips drop, arms drive),
// 1 = dig in (deep and braced). The whole body leans about the feet, so the soles stay on the ground.
const D2R = Math.PI / 180;

export async function loadPerson(V3, spec) {
  const { loadHuman, buildClip, THREE } = V3;
  const { character = 'athlete_m', kit, skin = 'tan', hair = 'black', lod = 0, scale = 1, accent = '#ffffff', anchor = false } = spec;
  const h = await loadHuman({ character, kit: { top: kit.top, bottoms: kit.bottoms || '#262b3a', socks: kit.socks || accent }, skin, hair, lod });
  h.groundClamp = 'off'; h.footPlanting = false;
  h.root.scale.setScalar(scale);
  const P = { h, THREE, clips: {}, gear: {}, pelvisH: h.pelvisRest ? h.pelvisRest.y : 0.895, anchor };
  const mat = (c, r = 0.6, m = 0.05) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });

  // ---- a headband in the team accent colour
  try {
    const head = h.bones.Bip01_Head, fr = h.boneFrame('Head');
    const left = fr.left.clone().normalize(), up = fr.up.clone().normalize(), fwd = fr.fwd.clone().normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(left, up, fwd));
    const box = h.headBox, c = box ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3(0.07, 0, 0);
    const upExt = box ? Math.max(box.max.dot(up), box.min.dot(up)) : 0.2;
    const topPt = c.clone().addScaledVector(up, upExt - c.dot(up));
    const g = new THREE.Group(); g.quaternion.copy(q);
    const R = 0.108;
    g.position.copy(topPt).addScaledVector(up, -R * 0.78);
    const band = new THREE.Mesh(new THREE.TorusGeometry(R, 0.017, 8, 36), mat(accent, 0.7)); band.rotation.x = Math.PI / 2; band.scale.set(1, 1.15, 1); band.castShadow = true; g.add(band);
    head.add(g); P.gear.band = g;
  } catch (e) { console.warn('headband', e); }

  // ---- a rope loop round the waist of the anchor (shown while the anchor call is active)
  try {
    const pel = h.bones.Bip01_Pelvis;
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 28), mat(0xc9a56a, 0.9)); loop.rotation.x = Math.PI / 2; loop.visible = false; loop.castShadow = true;
    pel.add(loop); P.gear.loop = loop;
  } catch (e) { console.warn('waist loop', e); }

  // ---- poses ----
  const mk = (spec2) => { const cl = buildClip(h, spec2); h.addClip(cl); P.clips[spec2.name] = cl; return cl; };
  const arm = (flex, abd, fore, tw = 0, flexR = flex) => ({ L_UpperArm: { flex, abduct: abd, twist: tw }, R_UpperArm: { flex: flexR, abduct: abd, twist: -tw }, L_Forearm: { flex: fore }, R_Forearm: { flex: fore } });
  const PH = 0.82 * (h.root.scale.x ? 1 : 1);
  // L: lean back from vertical (degrees); the whole body is one straight inclined line from the ankles unless bent.
  const body = ({ L = 20, kF = 14, kR = 24, tF = 12, tR = -10, curl = 0, drop = 0, shift = 0, twist = 22, side = 0, neck = 0, arms, abd = 6, footFlat = true }) => {
    const l = L * D2R;
    const pel = -L;
    const posY = PH * (Math.cos(l) - 1) - drop;
    const posZ = -PH * Math.sin(l) + shift;
    const tw = twist;
    return {
      Pelvis: { pos: [0, posY, posZ], flex: pel, twist: tw * 0.25, side }, Spine: { flex: curl * 0.3, twist: tw * 0.25 }, Spine1: { flex: curl * 0.4, twist: tw * 0.25 }, Spine2: { flex: curl * 0.3, twist: tw * 0.25 },
      Neck: { flex: L * 0.55 + neck }, Head: { flex: L * 0.25 },
      L_Thigh: { flex: tF, abduct: abd }, R_Thigh: { flex: tR, abduct: abd }, L_Calf: { flex: kF }, R_Calf: { flex: kR },
      L_Foot: { rot: footFlat ? [0, 0, 0] : [0, 0, 0] },
      ...(arms || arm(40, 8, 12)),
    };
  };
  P.body = body; P.arm = arm; P.mk = mk;
  P.defs = {
    set: body({ L: 20, kF: 10, kR: 18, tF: 8, tR: -6, curl: 0, arms: arm(52, 6, 10, 8) }),
    heave: body({ L: 32, kF: 22, kR: 34, tF: 14, tR: -10, curl: -4, drop: 0.04, arms: arm(40, 4, 52, 8) }),
    brace: body({ L: 38, kF: 34, kR: 52, tF: 24, tR: -14, curl: 6, drop: 0.12, arms: arm(46, 4, 6, 8) }),
    ready: body({ L: 6, kF: 28, kR: 40, tF: 20, tR: -10, curl: 18, drop: 0.12, arms: arm(40, 8, 18, 8) }),
  };
  mk({ name: 'tug_main', duration: 1.0, base: 'idle', smoothTrunk: false, keys: [
    { t: 0, pose: P.defs.set }, { t: 0.5, ease: 'inOut', pose: P.defs.heave }, { t: 1.0, ease: 'inOut', pose: P.defs.brace },
  ], fingers: 'fist' });
  mk({ name: 'tug_ready', duration: 1.0, base: 'idle', smoothTrunk: false, keys: [{ t: 0, pose: P.defs.ready }, { t: 1.0, ease: 'inOut', pose: P.defs.set }], fingers: 'fist' });
  // losing: lurch forward over the line, then stumble to the knees
  const lurch = body({ L: -22, kF: 30, kR: 20, tF: 38, tR: 6, curl: 26, drop: 0.1, shift: 0.3, twist: 10, arms: arm(78, 18, 24, 0), neck: -14 });
  const knees = body({ L: -34, kF: 100, kR: 118, tF: 70, tR: 60, curl: 28, drop: 0.4, shift: 0.25, twist: 8, arms: arm(70, 22, 26, 0), neck: -22 });
  mk({ name: 'tug_lose', duration: 1.4, base: 'idle', smoothTrunk: false, keys: [{ t: 0, pose: P.defs.heave }, { t: 0.35, ease: 'out', pose: lurch }, { t: 1.4, ease: 'inOut', pose: knees }], fingers: 'open' });
  // winning: weight back, then the arms go up
  const settle = body({ L: 6, kF: 8, kR: 10, tF: 4, tR: -2, curl: 0, twist: 0, arms: arm(30, 14, 12) });
  const cheer1 = body({ L: -4, kF: 8, kR: 8, tF: 4, tR: 0, curl: -4, twist: 0, arms: arm(158, 38, 8, 0), neck: -8 });
  const cheer2 = body({ L: -2, kF: 24, kR: 24, tF: 14, tR: 8, curl: -2, twist: 0, drop: 0.06, arms: arm(148, 52, 10, 0), neck: -6 });
  mk({ name: 'tug_win', duration: 0.9, base: 'idle', smoothTrunk: false, keys: [{ t: 0, pose: P.defs.set }, { t: 0.4, ease: 'out', pose: settle }, { t: 0.9, ease: 'out', pose: cheer1 }], fingers: 'open' });
  mk({ name: 'tug_cheer', duration: 1.1, loop: true, base: 'idle', smoothTrunk: false, keys: [{ t: 0, pose: cheer1 }, { t: 0.55, ease: 'inOut', pose: cheer2 }, { t: 1.1, ease: 'inOut', pose: cheer1 }], fingers: 'open' });
  // the coach / judge: standing with a clap
  const talk = body({ L: 0, kF: 6, kR: 8, tF: 3, tR: -2, curl: 0, twist: 0, arms: arm(30, 14, 70) });
  mk({ name: 'tug_stand', duration: 2.0, loop: true, base: 'idle', smoothTrunk: false, keys: [{ t: 0, pose: talk }, { t: 1.0, ease: 'inOut', pose: { ...talk, ...arm(36, 16, 60) } }, { t: 2.0, ease: 'inOut', pose: talk }], fingers: 'relaxed' });
  h.play('tug_main', { fade: 0 });
  return P;
}

// scrub a clip to a time (the sim decides the number, the clip only gives the shape)
export function setBase(h, name, opts = {}) { const cur = h.layers.base.current; if (!cur || cur.clip.name !== name || cur.target === 0) h.play(name, { fade: 0.15, ...opts }); return h.layers.base.current; }
export function scrub(h, name, time) { const tr = setBase(h, name, { fade: 0.1, loop: false }); if (tr) { tr.speed = 0; tr.time = time; } }

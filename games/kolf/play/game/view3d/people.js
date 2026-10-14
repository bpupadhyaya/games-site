// Kolf people: the player (a 17th-century Dutch kolver in doublet, breeches, white collar, hat and skates, with the long-handled club)
// and the skaters on the open ice. All real rigged figures (view3d athlete + authored skating clips). Presentation only.
const SKIN = ['light', 'light', 'tan', 'peach', 'ivory', 'light'];
const HAIR = ['brown', 'black', 'blond', 'grey', 'ginger', 'brown'];

function mount(V3, human, boneName, obj, up = 0, fwd = 0, left = 0, frame = boneName) {
  const { THREE } = V3;
  const f = human.boneFrame(frame);
  const m = new THREE.Matrix4().makeBasis(f.left.clone().normalize(), f.up.clone().normalize(), f.fwd.clone().normalize());
  obj.quaternion.setFromRotationMatrix(m);
  obj.position.copy(f.up).multiplyScalar(up).addScaledVector(f.fwd, fwd).addScaledVector(f.left, left);
  human.bones[`Bip01_${boneName}`].add(obj);
  return obj;
}
// the top of the head in the head bone's space (same recipe as the library's cap/helmet)
function headTop(V3, human) {
  const { THREE } = V3;
  const f = human.boneFrame('Head'), box = human.headBox;
  const c = box ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3(0.07, 0, 0);
  const upExt = box ? Math.max(box.max.dot(f.up), box.min.dot(f.up)) : 0.2;
  return c.clone().addScaledVector(f.up, upExt - c.dot(f.up));
}
function mountHead(V3, human, obj, lift = 0) {
  const { THREE } = V3;
  const f = human.boneFrame('Head');
  const m = new THREE.Matrix4().makeBasis(f.left.clone().normalize(), f.up.clone().normalize(), f.fwd.clone().normalize());
  obj.quaternion.setFromRotationMatrix(m);
  obj.position.copy(headTop(V3, human)).addScaledVector(f.up, lift);
  human.bones.Bip01_Head.add(obj);
}

// Re-sample a 30 fps clip at a higher rate with a Catmull-Rom spline through the original frames, so the pose is C1 in time:
// linear interpolation between mocap frames makes the angular velocity step every 1/30 s, which reads as a tremor when the
// camera is close. Loops wrap around. Presentation only.
export function smoothClip(V3, clip, fps = 120) {
  const NB = clip.quats.length / (clip.frames * 4);
  const n = clip.frames, dur = clip.dur, nf = Math.round(dur * fps) + 1;
  const q = new Float32Array(nf * NB * 4), p = new Float32Array(nf * 3);
  const idx = (i) => (clip.loop ? ((i % (n - 1)) + (n - 1)) % (n - 1) : Math.min(n - 1, Math.max(0, i)));
  const cr = (a, b, c, d, t) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (let k = 0; k < nf; k++) {
    const x = Math.min(n - 1, (k / fps) * clip.fps), i = Math.min(n - 2, Math.floor(x)), t = x - i;
    const ii = [idx(i - 1), idx(i), idx(i + 1), idx(i + 2)];
    for (let b = 0; b < NB; b++) {
      const ref = clip.quats.subarray((ii[1] * NB + b) * 4, (ii[1] * NB + b) * 4 + 4);
      const v = [0, 0, 0, 0];
      for (let c = 0; c < 4; c++) {
        const g = ii.map((f) => { const o = (f * NB + b) * 4; const dot = clip.quats[o] * ref[0] + clip.quats[o + 1] * ref[1] + clip.quats[o + 2] * ref[2] + clip.quats[o + 3] * ref[3]; return clip.quats[o + c] * (dot < 0 ? -1 : 1); });
        v[c] = cr(g[0], g[1], g[2], g[3], t);
      }
      const l = 1 / Math.hypot(v[0], v[1], v[2], v[3]);
      for (let c = 0; c < 4; c++) q[(k * NB + b) * 4 + c] = v[c] * l;
    }
    for (let c = 0; c < 3; c++) p[k * 3 + c] = cr(clip.pelvis[ii[0] * 3 + c], clip.pelvis[ii[1] * 3 + c], clip.pelvis[ii[2] * 3 + c], clip.pelvis[ii[3] * 3 + c], t);
  }
  return new V3.Clip({ ...clip, frames: nf, fps, dur: (nf - 1) / fps, quats: q, pelvis: p });
}
function smoothAll(V3, h, names) { for (const n of names) { const c = h.clips[n]; if (c && !c._smoothed) { const s = smoothClip(V3, c, 120); s._smoothed = true; h.clips[n] = s; } } }

// ---- skating clips ----------------------------------------------------------------------------------------------------------
export function addSkateClips(V3, h) {
  const { buildClip } = V3;
  const arm = (flex, abd, fore, tw = 0) => ({ L_UpperArm: { flex, abduct: abd, twist: tw }, R_UpperArm: { flex, abduct: abd, twist: -tw }, L_Forearm: { flex: fore }, R_Forearm: { flex: fore } });
  const body = ({ T = 0, thL = 0, thR = 0, knL = 0, knR = 0, abL = 3, abR = 3, twist = 0, side = 0, pos = [0, 0, 0], arms }) => {
    const pel = T * 0.5, sp = T - pel;
    return {
      Pelvis: { pos, flex: pel, twist, side }, Spine: { flex: sp * 0.34 }, Spine1: { flex: sp * 0.4 }, Spine2: { flex: sp * 0.26 },
      Neck: { flex: -T * 0.5 }, Head: { flex: -4 },
      L_Thigh: { flex: thL + pel, abduct: abL }, R_Thigh: { flex: thR + pel, abduct: abR }, L_Calf: { flex: knL }, R_Calf: { flex: knR },
      ...(arms || arm(8, 8, 12)),
    };
  };
  // the long Dutch stroke: weight on one knee, the other leg thrust out to the side and back, torso low, hands in the small of the back
  const behind = arm(-38, 10, 78);
  const a = body({ T: 30, thL: 28, knL: 52, abL: 2, thR: -22, knR: 6, abR: 24, side: 5, twist: 4, pos: [0, -0.1, 0], arms: behind });
  const m = body({ T: 28, thL: 20, knL: 40, abL: 3, thR: 8, knR: 30, abR: 8, side: 0, twist: 0, pos: [0, -0.08, 0], arms: behind });
  const b = body({ T: 30, thR: 28, knR: 52, abR: 2, thL: -22, knL: 6, abL: 24, side: -5, twist: -4, pos: [0, -0.1, 0], arms: behind });
  h.addClip(buildClip(h, { name: 'skate_hb', duration: 3.2, loop: true, base: 'idle', smoothTrunk: false, keys: [{ t: 0, pose: a }, { t: 0.8, ease: 'inOut', pose: m }, { t: 1.6, ease: 'inOut', pose: b }, { t: 2.4, ease: 'inOut', pose: m }, { t: 3.2, ease: 'inOut', pose: a }], fingers: 'relaxed' }));
  // free-arm skating for the player: arms counter-swing with the stroke
  const fa = (l, r) => ({ L_UpperArm: { flex: l, abduct: 10 }, R_UpperArm: { flex: r, abduct: 10 }, L_Forearm: { flex: 26 }, R_Forearm: { flex: 26 } });
  const a2 = body({ T: 18, thL: 22, knL: 40, thR: -18, knR: 6, abR: 20, side: 3, twist: -6, pos: [0, -0.07, 0], arms: fa(-22, 30) });
  const m2 = body({ T: 16, thL: 16, knL: 30, thR: 6, knR: 24, abR: 6, pos: [0, -0.05, 0], arms: fa(4, 4) });
  const b2 = body({ T: 18, thR: 22, knR: 40, thL: -18, knL: 6, abL: 20, side: -3, twist: 6, pos: [0, -0.07, 0], arms: fa(30, -22) });
  h.addClip(buildClip(h, { name: 'skate_free', duration: 2.4, loop: true, base: 'idle', smoothTrunk: false, keys: [{ t: 0, pose: a2 }, { t: 0.6, ease: 'inOut', pose: m2 }, { t: 1.2, ease: 'inOut', pose: b2 }, { t: 1.8, ease: 'inOut', pose: m2 }, { t: 2.4, ease: 'inOut', pose: a2 }], fingers: 'relaxed' }));
  // a low seat for the sledge rider: knees bent, hands on the pole
  h.addClip(buildClip(h, { name: 'sledge_sit', duration: 2.0, loop: true, base: 'idle', smoothTrunk: false, keys: [
    { t: 0, pose: body({ T: 10, thL: 84, knL: 84, thR: 84, knR: 84, abL: 10, abR: 10, pos: [0, -0.46, 0], arms: arm(40, 10, 40) }) },
    { t: 1.0, ease: 'inOut', pose: body({ T: 14, thL: 84, knL: 84, thR: 84, knR: 84, abL: 10, abR: 10, pos: [0, -0.47, 0], arms: arm(44, 10, 44) }) },
    { t: 2.0, ease: 'inOut', pose: body({ T: 10, thL: 84, knL: 84, thR: 84, knR: 84, abL: 10, abR: 10, pos: [0, -0.46, 0], arms: arm(40, 10, 40) }) }], fingers: 'relaxed' }));
  smoothAll(V3, h, ['skate_hb', 'skate_free', 'sledge_sit', 'swing2h', 'idle', 'idle_relaxed']);
}

// ---- costume parts -------------------------------------------------------------------------------------------------------------
function costume(V3, h, { coat = '#6b2a1c', hat = '#1d140d', trim = '#efe9da', hose = '#241a12' } = {}) {
  const { THREE } = V3;
  const mk = (c, r = 0.9, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, side: THREE.DoubleSide });
  const parts = { coatMat: mk(coat, 0.92), hatMat: mk(hat, 0.8), trimMat: mk(trim, 0.85), hoseMat: mk(hose, 0.95) };
  const yAxis = new THREE.Vector3(0, 1, 0);
  const B = (n) => h.bones[`Bip01_${n}`];
  const seg = (parent, child, r0, r1, m, ext = 0) => {
    const dir = child.position.clone(); const len = dir.length(); dir.normalize();
    const me = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len + ext, 18, 1, true), m);
    me.quaternion.setFromUnitVectors(yAxis, dir); me.position.copy(dir).multiplyScalar((len + ext) * 0.5 - ext * 0.2); parent.add(me); return me;
  };
  const sph = (parent, r, m, sx = 1, sy = 1, sz = 1, at = [0, 0, 0]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m); s.scale.set(sx, sy, sz); s.position.set(...at); parent.add(s); return s; };
  for (const side of ['L', 'R']) {
    const th = B(`${side}_Thigh`), ca = B(`${side}_Calf`), ft = B(`${side}_Foot`), ua = B(`${side}_UpperArm`), fa = B(`${side}_Forearm`), ha = B(`${side}_Hand`);
    // breeches: full to the knee, then stockings; boots
    seg(th, ca, 0.118, 0.085, parts.hoseMat, 0.0);
    seg(ca, ft, 0.066, 0.052, parts.hoseMat);
    sph(ca, 0.08, parts.hoseMat);
    const to = B(`${side}_Toe0`);
    if (to) { seg(ft, to, 0.076, 0.058, mk('#17110c', 0.6)); sph(ft, 0.074, mk('#17110c', 0.6)); }
    // doublet sleeves with a white cuff
    seg(ua, fa, 0.062, 0.05, parts.coatMat); seg(fa, ha, 0.052, 0.042, parts.coatMat);
    sph(fa, 0.052, parts.coatMat); sph(ua, 0.066, parts.coatMat);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.05, 14, 1, true), parts.trimMat); cuff.position.set(0, ha.position.length() > 0.001 ? 0 : 0, 0);
    const d = ha.position.clone().normalize(); cuff.quaternion.setFromUnitVectors(yAxis, d); cuff.position.copy(d).multiplyScalar(-0.012); ha.add(cuff);
    // skate: wooden stock with a long iron blade curling at the toe
    const sk = new THREE.Group();
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.035, 0.3), mk('#6b4a28', 0.7)); stock.position.set(0, 0, 0.03); sk.add(stock);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.05, 0.38), mk('#aab3ba', 0.3, 0.8)); blade.position.set(0, -0.04, 0.04); sk.add(blade);
    const curl = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.05, 0.1), mk('#aab3ba', 0.3, 0.8)); curl.position.set(0, -0.015, 0.25); curl.rotation.x = -0.6; sk.add(curl);
    mount(V3, h, `${side}_Foot`, sk, -0.095, 0.05, 0);
  }
  // doublet skirts and a hip block
  for (const side of ['L', 'R']) {
    const th = B(`${side}_Thigh`), ca = B(`${side}_Calf`);
    const dir = ca.position.clone(); const len = dir.length(); dir.normalize();
    const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.152, len * 0.7, 20, 1, true), parts.coatMat);
    sk.quaternion.setFromUnitVectors(yAxis, dir); sk.position.copy(dir).multiplyScalar(len * 0.3); th.add(sk);
  }
  const hip = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 14), parts.coatMat); hip.scale.set(1.0, 0.85, 0.82); hip.position.set(0.02, 0, 0); h.pelvis.add(hip);
  // white falling collar around the neck
  const collar = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.175, 0.07, 24, 1, true), parts.trimMat); ring.position.y = 0.0; collar.add(ring);
  mount(V3, h, 'Neck', collar, 0.02, 0.0, 0.0, 'Spine2');
  // wide-brimmed dark hat with a band
  const hatG = new THREE.Group();
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.15, 24), parts.hatMat); crown.position.y = 0.075; hatG.add(crown);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.012, 24), parts.hatMat); top.position.y = 0.152; hatG.add(top);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 32), parts.hatMat); brim.position.y = 0.01; hatG.add(brim);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.103, 0.03, 24), mk('#d9a540', 0.5)); band.position.y = 0.035; hatG.add(band);
  const feather = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.012, 0.22, 6), mk('#efe9da', 0.8)); feather.position.set(0.09, 0.11, 0.0); feather.rotation.z = -0.9; hatG.add(feather);
  mountHead(V3, h, hatG, -0.075);
  parts.hat = hatG; parts.collar = collar;
  return parts;
}

// ---- the player ------------------------------------------------------------------------------------------------------------
export async function loadPlayer(V3, { lod = 0 } = {}) {
  const { loadHuman, THREE } = V3;
  const human = await loadHuman({ character: 'athlete_m', kit: { top: '#6b2a1c', bottoms: '#241a12', socks: '#241a12', shoes: '#17110c' }, skin: 'light', hair: 'brown', lod });
  human.groundClamp = 'off'; human.footPlanting = false;
  const c = costume(V3, human);
  human.setKit({ top: '#6b2a1c', bottoms: '#241a12', socks: '#241a12', shoes: '#17110c' });
  addSkateClips(V3, human);
  // the kolf club: a long wooden shaft with a leather grip and a heavy iron-shod head
  const club = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.65 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.015, 1.08, 10), wood); shaft.position.y = 0.54; club.add(shaft);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.26, 10), new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.9 })); grip.position.y = 0.16; club.add(grip);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.085, 0.2), new THREE.MeshStandardMaterial({ color: 0x35302d, roughness: 0.45, metalness: 0.55 }));
  head.position.set(0, 1.1, 0.06); club.add(head);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.07, 0.03), new THREE.MeshStandardMaterial({ color: 0x8a6f4a, roughness: 0.6 })); face.position.set(0, 1.1, 0.17); club.add(face);
  club.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const holder = new THREE.Group(); holder.add(club);
  const A0 = -65, A1 = globalThis.__A1 ?? -40;
  const tiltClub = (t) => { const u = Math.min(1, Math.max(0, t / 1.8)); club.rotation.set(0, 0, ((A0 + A1 * u * u * (3 - 2 * u)) * Math.PI) / 180); };
  tiltClub(0);
  human.attach(holder, 'R', 'bat');
  try { human.holdTwoHanded(holder, 'L', { gap: 0.1, weight: 0 }); } catch { /* optional */ }
  return {
    human, club, holder, parts: c,
    setCoat(col) { c.coatMat.color.set(col); human.setKit({ top: col }); },
    tiltClub,
  };
}

// ---- skaters on the open ice -------------------------------------------------------------------------------------------------
const COATS = ['#3b4a63', '#6b2a1c', '#5a4a2c', '#2f3f33', '#7a6a58', '#4b3a5a'];
export async function loadSkater(V3, i, { lod = 1 } = {}) {
  const { loadHuman } = V3;
  const female = i % 3 === 1;
  const h = await loadHuman({ character: female ? 'athlete_f' : 'athlete_m', lod, skin: SKIN[i % SKIN.length], hair: HAIR[i % HAIR.length],
    kit: { top: COATS[i % COATS.length], bottoms: '#2a2018', socks: '#2a2018', shoes: '#17110c' } });
  h.groundClamp = 'off'; h.footPlanting = false;
  addSkateClips(V3, h);
  const { THREE } = V3;
  const col = COATS[i % COATS.length];
  const cm = new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, side: THREE.DoubleSide });
  const yAxis = new THREE.Vector3(0, 1, 0);
  // a long coat skirt and a scarf so the silhouette reads as winter clothing
  for (const side of ['L', 'R']) {
    const th = h.bones[`Bip01_${side}_Thigh`], ca = h.bones[`Bip01_${side}_Calf`];
    const dir = ca.position.clone(); const len = dir.length(); dir.normalize();
    const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.16, len * 1.05, 18, 1, true), cm);
    sk.quaternion.setFromUnitVectors(yAxis, dir); sk.position.copy(dir).multiplyScalar(len * 0.45); th.add(sk);
  }
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 8, 18), new THREE.MeshStandardMaterial({ color: ['#b8412e', '#e8dcc0', '#2b5aa0'][i % 3], roughness: 0.9 }));
  const sg = new THREE.Group(); scarf.rotation.x = Math.PI / 2; sg.add(scarf); mount(V3, h, 'Neck', sg, 0.0, 0.0, 0.0, 'Spine2');
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.105, 0.12, 18), new THREE.MeshStandardMaterial({ color: '#2a1d12', roughness: 0.85 }));
  if (!female) { const hg = new THREE.Group(); hat.position.y = 0.06; hg.add(hat); mountHead(V3, h, hg, -0.06); }
  return h;
}

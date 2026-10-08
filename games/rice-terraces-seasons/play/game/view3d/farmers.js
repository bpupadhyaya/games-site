// The people of the terraces: real Rocketbox figures dressed as farmers (long sleeves, trousers, boots, a woven hat) with authored work poses: planting, weeding, cutting the
// rice, mending a wall, and the storyteller who greets you before each season. Presentation only: the simulation says which field has a job and for how long; the figures
// walk there along the footpath and work while the job runs.
import { gatePos } from '../src/geom.js';
import { plotPos, HW, HD, plotZ, tierY, PD } from '../src/geom.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;

const LOOKS = [
  // Cordillera and Bali: tops, trousers, hats
  [{ top: '#8c3b2a', bottoms: '#2b3550', hat: 0xc9a24a, hatKind: 'cone', skin: 'tan', hair: 'black' }, { top: '#3f5d3a', bottoms: '#3a2f27', hat: 0xb98f3d, hatKind: 'cone', skin: 'brown', hair: 'black' }, { top: '#d9d2bd', bottoms: '#27324a', hat: 0xd2b25a, hatKind: 'cone', skin: 'tan', hair: 'black' }, { top: '#2f4b7a', bottoms: '#3b2f28', hat: 0xbb9a48, hatKind: 'cone', skin: 'brown', hair: 'black' }, { top: '#a55a2a', bottoms: '#2a3a3a', hat: 0xcaa855, hatKind: 'cone', skin: 'tan', hair: 'black' }],
  [{ top: '#c9962f', bottoms: '#4a2f2a', hat: 0xd6b865, hatKind: 'wide', skin: 'brown', hair: 'black' }, { top: '#2f6f5f', bottoms: '#3a2a2a', hat: 0xc9aa55, hatKind: 'wide', skin: 'brown', hair: 'black' }, { top: '#e8e2d2', bottoms: '#2a3a52', hat: 0xd4b45e, hatKind: 'wide', skin: 'tan', hair: 'black' }, { top: '#b4482e', bottoms: '#33302a', hat: 0xcaa752, hatKind: 'wide', skin: 'brown', hair: 'black' }, { top: '#4a4a8a', bottoms: '#3a3028', hat: 0xd0b05a, hatKind: 'wide', skin: 'tan', hair: 'black' }],
];

export async function createFarmers(V3, stage, T, lv, { quality = 'high', onReady } = {}) {
  const { loadHuman, buildClip, addWhites, THREE } = V3;
  const F = { list: [], speakers: {}, ready: false };
  const chapter = lv.chapter;
  const mat = (c, r = 0.9) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0.02 });

  async function make(character, look, idx) {
    const h = await loadHuman({ character, kit: { top: look.top, bottoms: look.bottoms, socks: look.bottoms }, skin: look.skin, hair: look.hair, lod: quality === 'high' ? 0 : 1 });
    h.groundClamp = 'off'; h.footPlanting = false;
    const gear = [];
    const suit = new THREE.Color(look.top).getHex();
    try { gear.push(addWhites(h, { color: new THREE.Color(look.bottoms).getHex(), force: true })); } catch (e) { console.warn('legs', e); }
    // long sleeves and boots
    try {
      const sleeveM = mat(suit, 0.85); sleeveM.side = THREE.DoubleSide;
      const yAxis = new THREE.Vector3(0, 1, 0);
      const seg = (bone, child, r0, r1) => {
        const dir = child.position.clone(); const len = dir.length(); dir.normalize();
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 16, 1, true), sleeveM);
        mesh.quaternion.setFromUnitVectors(yAxis, dir); mesh.position.copy(dir).multiplyScalar(len * 0.5); mesh.castShadow = true; bone.add(mesh);
      };
      for (const sd of ['L', 'R']) {
        const up = h.bones[`Bip01_${sd}_UpperArm`], fo = h.bones[`Bip01_${sd}_Forearm`], hand = h.bones[`Bip01_${sd}_Hand`];
        if (up && fo && hand) { seg(up, fo, 0.06, 0.049); seg(fo, hand, 0.049, 0.041); const el = new THREE.Mesh(new THREE.SphereGeometry(0.051, 12, 8), sleeveM); fo.add(el); const sh = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), sleeveM); sh.castShadow = true; up.add(sh); }
        const foot = h.bones[`Bip01_${sd}_Foot`], toe = h.bones[`Bip01_${sd}_Toe0`];
        if (foot && toe) {
          const bm = mat(0x2d3a2a, 0.55), dir = toe.position.clone(), len = dir.length(); dir.normalize();
          const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.066, Math.max(0.14, len * 1.7), 6, 12), bm); boot.quaternion.setFromUnitVectors(yAxis, dir); boot.position.copy(dir).multiplyScalar(len * 0.55); boot.castShadow = true;
          const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.078, 0.26, 14), bm); const up2 = foot.position.clone().negate().normalize(); shaft.quaternion.setFromUnitVectors(yAxis, up2); shaft.position.copy(up2).multiplyScalar(0.1); shaft.castShadow = true;
          foot.add(boot, shaft);
        }
      }
    } catch (e) { console.warn('sleeves', e); }
    // the woven hat on the head
    try {
      const head = h.bones.Bip01_Head, fr = h.boneFrame('Head');
      const left = fr.left.clone().normalize(), up = fr.up.clone().normalize(), fwd = fr.fwd.clone().normalize();
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(left, up, fwd));
      const box = h.headBox;
      const c = box ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3(0.07, 0, 0);
      const upExt = box ? Math.max(box.max.dot(up), box.min.dot(up)) : 0.2;
      const topPt = c.clone().addScaledVector(up, upExt - c.dot(up));
      const g = new THREE.Group(); g.quaternion.copy(q); g.position.copy(topPt).addScaledVector(up, -0.06);
      const hm = mat(look.hat, 0.85); hm.side = THREE.DoubleSide;
      if (look.hatKind === 'cone') {
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.34, 0.2, 28, 1, true), hm); cone.position.y = 0.06; g.add(cone);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.008, 6, 32), mat(0x8a6a2a)); rim.rotation.x = Math.PI / 2; rim.position.y = -0.04; g.add(rim);
      } else {
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.36, 0.07, 28, 1, true), hm); brim.position.y = 0.02; g.add(brim);
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.1, 20, 1, false), hm); crown.position.y = 0.1; g.add(crown);
      }
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.006, 6, 24), mat(0x3a2a18)); strap.rotation.x = Math.PI / 2; strap.position.y = -0.06; g.add(strap);
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      head.add(g);
    } catch (e) { console.warn('hat', e); }
    // ---- poses. Character space +Y up, +Z forward. Semantic offsets in degrees.
    const mk = (spec) => { const cl = buildClip(h, spec); h.addClip(cl); return cl; };
    const arm = (flex, abd, fore = 8, tw = 0) => ({ L_UpperArm: { flex, abduct: abd, twist: tw }, R_UpperArm: { flex, abduct: abd, twist: -tw }, L_Forearm: { flex: fore }, R_Forearm: { flex: fore } });
    const body = ({ T: tt = 0, th = 0, th2 = th, kn = 0, kn2 = kn, pos = [0, 0, 0], abd = 4, twist = 0, side = 0, neck, arms }) => {
      const pel = tt * 0.5, sp = tt - pel;
      return {
        Pelvis: { pos, flex: pel, twist, side }, Spine: { flex: sp * 0.34 }, Spine1: { flex: sp * 0.4 }, Spine2: { flex: sp * 0.26 },
        Neck: { flex: neck === undefined ? -tt * 0.5 : neck }, Head: { flex: -4 },
        L_Thigh: { flex: th + pel, abduct: abd }, R_Thigh: { flex: th2 + pel, abduct: abd }, L_Calf: { flex: kn }, R_Calf: { flex: kn2 },
        ...(arms || arm(8, 6, 12)),
      };
    };
    const bendA = body({ T: 66, th: 30, kn: 40, pos: [0, -0.12, 0.04], abd: 14, arms: { ...arm(70, 6, 8), R_UpperArm: { flex: 82, abduct: 4 }, R_Forearm: { flex: 6 } } });
    const bendB = body({ T: 62, th: 28, kn: 36, pos: [0, -0.1, 0.06], abd: 14, arms: { ...arm(70, 6, 8), R_UpperArm: { flex: 56, abduct: 6 }, R_Forearm: { flex: 36 }, L_UpperArm: { flex: 82, abduct: 4 } } });
    mk({ name: 'f_plant', duration: 1.6, loop: true, base: 'idle', smoothTrunk: false, keys: [{ t: 0, pose: bendA }, { t: 0.4, ease: 'inOut', pose: bendB }, { t: 0.8, ease: 'inOut', pose: bendA }, { t: 1.2, ease: 'inOut', pose: bendB }, { t: 1.6, ease: 'inOut', pose: bendA }], fingers: 'pinch' });
    const weedA = body({ T: 58, th: 26, kn: 32, pos: [0, -0.1, 0.05], twist: 12, arms: { ...arm(78, 12, 10), R_UpperArm: { flex: 64, abduct: 24 }, R_Forearm: { flex: 20 } } });
    const weedB = body({ T: 58, th: 26, kn: 32, pos: [0, -0.1, 0.05], twist: -12, arms: { ...arm(78, 12, 10), R_UpperArm: { flex: 70, abduct: -6 }, R_Forearm: { flex: 52 }, L_UpperArm: { flex: 60, abduct: 22 } } });
    mk({ name: 'f_weed', duration: 1.8, loop: true, base: 'idle', smoothTrunk: false, keys: [{ t: 0, pose: weedA }, { t: 0.9, ease: 'inOut', pose: weedB }, { t: 1.8, ease: 'inOut', pose: weedA }], fingers: 'ballGrip' });
    const cutA = body({ T: 46, th: 22, kn: 30, pos: [0, -0.08, 0.03], twist: 14, arms: { ...arm(40, 10, 20), R_UpperArm: { flex: 70, abduct: 36 }, R_Forearm: { flex: 24 }, L_UpperArm: { flex: 66, abduct: 8 }, L_Forearm: { flex: 30 } } });
    const cutB = body({ T: 40, th: 18, kn: 26, pos: [0, -0.06, 0.02], twist: -18, arms: { ...arm(40, 10, 20), R_UpperArm: { flex: 50, abduct: -10 }, R_Forearm: { flex: 70 }, L_UpperArm: { flex: 60, abduct: 4 }, L_Forearm: { flex: 40 } } });
    mk({ name: 'f_cut', duration: 1.5, loop: true, base: 'idle', smoothTrunk: false, keys: [{ t: 0, pose: cutA }, { t: 0.5, ease: 'out', pose: cutB }, { t: 1.0, ease: 'inOut', pose: cutA }, { t: 1.5, ease: 'inOut', pose: cutA }], fingers: 'ballGrip' });
    const sqA = body({ T: 44, th: 70, kn: 100, pos: [0, -0.34, 0.02], abd: 16, arms: arm(40, 12, 26) });
    const sqB = body({ T: 24, th: 58, kn: 86, pos: [0, -0.26, 0.0], abd: 16, arms: arm(66, 16, 74) });
    mk({ name: 'f_stone', duration: 2.0, loop: true, base: 'idle', smoothTrunk: false, keys: [{ t: 0, pose: sqA }, { t: 0.7, ease: 'inOut', pose: sqB }, { t: 1.2, pose: sqB }, { t: 2.0, ease: 'inOut', pose: sqA }], fingers: 'ballGrip' });
    const talkA = body({ T: 3, th: 4, kn: 6, arms: { ...arm(14, 10, 20), R_UpperArm: { flex: 46, abduct: 22 }, R_Forearm: { flex: 70 } } });
    const talkB = body({ T: 3, th: 4, kn: 6, arms: { ...arm(14, 10, 20), R_UpperArm: { flex: 56, abduct: 30 }, R_Forearm: { flex: 52 }, L_UpperArm: { flex: 30, abduct: 14 }, L_Forearm: { flex: 60 } } });
    mk({ name: 'f_talk', duration: 3.2, loop: true, base: 'idle_relaxed', smoothTrunk: false, keys: [{ t: 0, pose: talkA }, { t: 0.8, ease: 'inOut', pose: talkB }, { t: 1.7, ease: 'inOut', pose: talkA }, { t: 2.4, ease: 'inOut', pose: talkB }, { t: 3.2, ease: 'inOut', pose: talkA }], fingers: 'relaxed' });
    const proud = body({ T: 2, arms: { ...arm(14, 12, 26), L_UpperArm: { flex: 20, abduct: 36 }, R_UpperArm: { flex: 20, abduct: 36 } } });
    mk({ name: 'f_rest', duration: 3.0, loop: true, base: 'idle_relaxed', smoothTrunk: false, keys: [{ t: 0, pose: proud }, { t: 1.5, ease: 'inOut', pose: body({ T: 1, arms: { ...arm(10, 10, 20), L_UpperArm: { flex: 16, abduct: 30 }, R_UpperArm: { flex: 20, abduct: 38 } } }) }, { t: 3.0, ease: 'inOut', pose: proud }], fingers: 'relaxed' });
    h.play('f_rest', { fade: 0 });
    // fewer shadow draws on phones: only the body casts, not the hat, sleeves and boots
    if (quality !== 'high') h.root.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) o.castShadow = false; });
    return { h, gear, character };
  }

  const specs = [];
  const looks = LOOKS[chapter];
  for (let i = 0; i < 5; i++) specs.push({ role: 'farmer', character: i % 2 === 0 ? 'athlete_m' : 'athlete_f', look: looks[i % looks.length], i });
  specs.push({ role: 'neighbour', character: 'athlete_f', look: { ...looks[2], top: '#7a3f6a' }, i: 5 }, { role: 'neighbour', character: 'athlete_m', look: { ...looks[3], top: '#3a6a7a' }, i: 6 });
  specs.push({ role: 'speaker-f', character: 'athlete_f', look: { ...looks[0], top: chapter ? '#c8952a' : '#8c3b2a' }, i: 7 }, { role: 'speaker-m', character: 'athlete_m', look: { ...looks[1], top: chapter ? '#e4dcc4' : '#3f5d3a' }, i: 8 });
  const home = { x: T.xP, z: T.zc0 - 0.8 };
  const startPos = (i) => ({ x: T.xP + (i % 2 ? 1.1 : -1.1), z: home.z + (i % 3) * 0.9 });
  let idx = 0;
  for (const sp of specs) {
    // load in the background so the picture is up at once; the figures appear as they arrive
    make(sp.character, sp.look, sp.i).then((m) => {
      const entry = { ...m, role: sp.role, i: sp.i, pos: startPos(sp.i), yaw: 0, job: -1, jobType: '', path: [], state: 'idle', clip: '', speed: 0, vis: false, t0: 0 };
      stage.add(m.h); stage.track(m.h); m.h.root.visible = false; m.h.root.scale.setScalar(1.18);
      if (sp.role === 'farmer' || sp.role === 'neighbour') F.list.push(entry); else F.speakers[sp.role === 'speaker-f' ? 'f' : 'm'] = entry;
      if (F.list.length + Object.keys(F.speakers).length === specs.length) { F.ready = true; onReady && onReady(); }
    }).catch((e) => console.warn('figure failed', e));
    idx++;
  }
  void idx; void gatePos; void plotZ; void tierY; void PD; void lerp; void clamp;

  const spotFor = (lv2, i, e) => {
    const p = plotPos(lv2, i);
    const side = e.i % 2 ? 1 : -1;
    return { x: p.x + side * HW * 0.5, z: p.z - 0.3 + (e.i % 3) * 0.3, face: { x: p.x, z: p.z + 1.2 } };
  };
  const routeTo = (e, to) => {
    const pts = [];
    if (Math.abs(e.pos.x - T.xP) > 0.6) pts.push({ x: T.xP, z: e.pos.z });
    if (Math.abs(e.pos.z - to.z) > 0.3) pts.push({ x: T.xP, z: to.z });
    pts.push({ x: to.x, z: to.z });
    return pts;
  };
  const faceYaw = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
  const WORK = { plant: 'f_plant', tend: 'f_weed', pests: 'f_weed', harvest: 'f_cut', repair: 'f_stone' };
  const SPEED = 3.4;

  // each frame: give the running jobs a figure, move the figures, play their poses
  F.update = (G, f, dt, time) => {
    if (!F.ready && !F.list.length) return;
    const lv2 = lv, n = lv2.farmers;
    const mine = F.list.filter((e) => e.role === 'farmer'), nb = F.list.filter((e) => e.role === 'neighbour');
    const inPlay = G.scene === 'play' && f;
    // assign figures to jobs
    if (inPlay) {
      const jobsNow = [];
      f.plots.forEach((p, i) => { if (p.job) jobsNow.push({ i, p }); });
      for (const e of F.list) if (e.job >= 0 && !(f.plots[e.job] && f.plots[e.job].job)) { e.job = -1; e.state = 'idle'; }
      for (const jb of jobsNow) {
        if (F.list.some((e) => e.job === jb.i)) continue;
        const pool = (jb.p.job.by ? nb : mine.slice(0, n)).filter((e) => e.job < 0);
        if (!pool.length) continue;
        pool.sort((a, b) => Math.hypot(a.pos.x - plotPos(lv2, jb.i).x, a.pos.z - plotPos(lv2, jb.i).z) - Math.hypot(b.pos.x - plotPos(lv2, jb.i).x, b.pos.z - plotPos(lv2, jb.i).z));
        const e = pool[0];
        e.job = jb.i; e.jobType = jb.p.job.type; e.spot = spotFor(lv2, jb.i, e); e.path = routeTo(e, e.spot); e.state = 'walk';
      }
    }
    for (const e of F.list) {
      const active = inPlay || G.scene === 'result';
      const idxOk = e.role === 'farmer' ? e.i < n : true;
      e.vis = active && !G.card && idxOk && (e.role === 'farmer' || nb.indexOf(e) < 2) && (e.role === 'farmer' || lv2.owners && Object.keys(lv2.owners).length > 0);
      e.h.root.visible = e.vis;
      if (!e.vis) continue;
      stepFigure(e, f, dt, time, G);
    }
    // the storyteller
    for (const k of ['f', 'm']) {
      const s = F.speakers[k]; if (!s) continue;
      const want = G.card && G.card.look === k && G.scene === 'play';
      s.h.root.visible = !!want; s.vis = !!want;
      if (want) placeSpeaker(s, dt, G);
    }
  };

  function stepFigure(e, f, dt, time, G) {
    const h = e.h;
    let moving = false;
    if (e.state === 'walk' || (e.state === 'idle' && e.path.length)) {
      const tgt = e.path[0];
      if (tgt) {
        const dx = tgt.x - e.pos.x, dz = tgt.z - e.pos.z, d = Math.hypot(dx, dz);
        const sp = SPEED * (e.state === 'walk' ? 1.5 : 0.6);
        if (d < Math.max(0.12, sp * dt)) { e.pos.x = tgt.x; e.pos.z = tgt.z; e.path.shift(); }
        else { e.pos.x += (dx / d) * sp * dt; e.pos.z += (dz / d) * sp * dt; e.yaw = Math.atan2(dx, dz); moving = true; }
      }
      if (!e.path.length && e.state === 'walk') { e.state = 'work'; if (e.spot) e.yaw = faceYaw(e.pos, e.spot.face); }
    }
    if (e.state === 'idle' && !e.path.length) {
      // wander a little around the hot spot (the next field that needs a hand), else around the middle of the hill
      e.t0 += dt;
      if (e.t0 > 5 + (e.i % 3)) {
        e.t0 = 0;
        const need = f ? f.plots.map((p, i) => ({ p, i })).filter((q) => !q.p.owner && !q.p.job && (q.p.crop === 0 && f.season <= 1 || q.p.crop === 3 || q.p.wall < 0.5)) : [];
        const tp = need.length ? plotPos(lv, need[(e.i * 7 + Math.floor(time)) % need.length].i) : { x: T.xP, z: T.zc0 + 2 * PD };
        const to = need.length ? { x: tp.x - (e.i % 2 ? -1 : 1) * (HW + 0.8), z: tp.z + (e.i % 3) * 0.4 } : { x: T.xP + (e.i % 2) * 1.6, z: tp.z + (e.i % 3) * 1.2 };
        e.path = routeTo(e, to);
      }
    }
    const y = T.height(e.pos.x, e.pos.z);
    h.setPosition(e.pos.x, y, e.pos.z);
    h.setFacing(e.yaw, { snap: false }); h.turnRate = 7;
    let clip;
    if (e.state === 'work') clip = WORK[e.jobType] || 'f_plant';
    else if (moving) clip = 'walk';
    else clip = 'f_rest';
    if (clip !== e.clip) { e.clip = clip; if (clip === 'walk') h.crossfade('walk', 0.25); else h.crossfade(clip, 0.3); }
    if (clip === 'walk') h.locomote && h.locomote(e.state === 'walk' ? 2.4 : 1.4);
  }

  // the storyteller stands at the left end of the second tier and turns to the camera, which looks along the tier so the terraces stretch away behind her
  function spot() {
    const t = Math.min(1, lv.R - 1), x = plotPos(lv, t * lv.C).x - HW - 0.35, z = plotZ(lv, t) - 0.4, y = T.height(x, z);
    const cx = x - 6.2, cz = z + 1.8, cy = Math.max(T.height(cx, cz) + 1.2, y + 1.35);
    return { x, y, z, yaw: Math.atan2(cx - x, cz - z), cam: { x: cx, y: cy, z: cz } };
  }
  function placeSpeaker(s, dt, G) {
    const h = s.h, sp = spot();
    s.pos.x = sp.x; s.pos.z = sp.z; s.yaw = sp.yaw;
    h.setPosition(sp.x, sp.y, sp.z); h.setFacing(s.yaw);
    const clip = G.card && G.card.kind === 'festival' ? 'clap' : 'f_talk';
    if (s.clip !== clip) { s.clip = clip; h.crossfade(clip, 0.3); }
  }
  F.speakerSpot = spot;
  F.dispose = () => { for (const e of [...F.list, ...Object.values(F.speakers)]) { stage.remove(e.h); } };
  return F;
}

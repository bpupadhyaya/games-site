// Ulu Maika 3D people (game-owned): the two players at the roll line (a real view3d athlete each, bare-chested in a kapa malo with a
// flower lei and a headband, no religious symbols) and the underhand roll as pose-to-pose clips with IK on the rolling hand.
//
// Presenter contract: stage.update(dt) FIRST (it resets the arms to the clip pose), THEN `afterUpdate()` places the cloth and lei
// from the posed bones and returns the disc grip point; the presenter positions the held disc from that, THEN renders.
//
// Signature details (real-world, see STATUS.md): (1) the malo flap and sash hang under gravity and swing with the hips and the
// trade wind, (2) the player settles into a deep crouch and the back-swing grows with the swipe, (3) the release hand speed matches
// the disc speed and the follow-through carries the arm up, (4) breathing and a slow weight shift while waiting, (5) the other
// player watches the disc with their head, (6) the lei beads swing with the lean.

const D2R = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (cur, tgt, k, dt) => cur + (tgt - cur) * (1 - Math.exp(-k * dt));

export const REL = { x: 0.40, hand: 0.19 };       // root x offset from the line, shoulder lateral offset (m)
export const LINE_Z = 0.30;                       // the roll line is this far in front of the player's feet (char z)

// mirror a pose spec for a left-hander: swap L_/R_ and negate lateral rotations
const mirrorName = (n) => (n.startsWith('L_') ? `R_${n.slice(2)}` : n.startsWith('R_') ? `L_${n.slice(2)}` : n);
const mirrorPose = (pose) => {
  const o = {};
  for (const [n, p] of Object.entries(pose)) {
    const q = { ...p };
    if (/^(Pelvis|Spine\d?|Neck|Head)$/.test(n)) { if (q.twist) q.twist = -q.twist; if (q.side) q.side = -q.side; }
    else if (q.twist) q.twist = -q.twist;
    if (q.rot) q.rot = [q.rot[0], -q.rot[1], -q.rot[2]];
    o[mirrorName(n)] = q;
  }
  return o;
};

export async function createThrower(V3, stage, { character = 'athlete_m', skin = 'tan', hair = 'black', left = false, quality = 'high', accent = '#b21f26', trim = '#f0e4c4', top = '#e6d6a8', seed = 1 } = {}) {
  const { THREE, loadHuman, buildClip } = V3;
  const SKIN_HEX = { tan: '#c68e63', brown: '#8f5c3c', deep: '#5a3a2a', light: '#e3b48f' };
  const TOP_HEX = { tan: '#c98f63', brown: '#946040', deep: '#5e402f', light: '#e3b48f' };
  const kit = { top: TOP_HEX[skin] || top, bottoms: '#3a2416', socks: SKIN_HEX[skin] || skin, shoes: '#2a1c12', trim: '#f0e4c4' };
  const h = await loadHuman({ character, kit, skin, hair, lod: 0, quality, body: 'anatomic', top: 'bare' });
  h.lodAuto = false;                               // close-up players: full-detail hands and legs on every tier
  h.groundClamp = 'auto'; h.footPlanting = true; h.groundY = -0.05; stage.add(h); stage.track(h);
  const sgn = left ? -1 : 1;                       // +1 right-hander (right hand rolls)
  const HS = left ? 'L' : 'R', OS = left ? 'R' : 'L';
  const P = (pose) => (left ? mirrorPose(pose) : pose);     // pose authored for a right-hander
  const LEG = Math.max(0.6, h.pelvisHeight - 0.09);
  const drop = (a, b) => LEG - (LEG / 2) * (Math.cos(a * D2R) + Math.cos((a - b) * D2R));
  // a deep staggered crouch; pelvis drop keeps the feet on the ground
  const crouch = (k = 1) => {
    const a = 62 * k, b = 108 * k;
    return { Pelvis: { pos: [0, -drop(a, b) * 0.97, -0.04 * k], flex: 8 * k },
      L_Thigh: { flex: a + 8 * k, abduct: 5 }, R_Thigh: { flex: a - 14 * k, abduct: 5 }, L_Calf: { flex: b + 10 * k }, R_Calf: { flex: b - 22 * k } };
  };
  const trunk = (flex, twist = 0, side = 0) => ({ Spine: { flex: flex * 0.34, twist: twist * 0.3, side: side * 0.4 }, Spine1: { flex: flex * 0.34, twist: twist * 0.4, side: side * 0.3 }, Spine2: { flex: flex * 0.32, twist: twist * 0.3, side: side * 0.3 }, Neck: { flex: -flex * 0.42 }, Head: { flex: -flex * 0.2 } });
  const armsFree = (hand = 'R') => ({ [`${hand === 'R' ? 'L' : 'R'}_UpperArm`]: { flex: 18, abduct: 22 }, [`${hand === 'R' ? 'L' : 'R'}_Forearm`]: { flex: 36 } });
  const BASE = { clip: 'idle_relaxed', time: 0.6 };
  // IK helper: character space, right hand targets are authored with x < 0 (the avatar's right); mirror for left-handers
  const hx = (x) => x * sgn;
  const hand = (x, y, z) => [hx(x), y, z];
  const IKN = `${HS}_Hand`;
  const arm = (flex, abd, fore) => ({ [`${HS}_UpperArm`]: { flex, abduct: abd }, [`${HS}_Forearm`]: { flex: fore } });
  // keys are authored as a right-hander and mirrored by P() when needed (IK positions are mirrored by hx)
  const mk = (name, duration, keys, ik, extra = {}) => {
    const k2 = keys.map((k) => ({ ...k, pose: k.pose ? P(k.pose) : undefined }));
    void ik; const c = buildClip(h, { name, duration, base: BASE, keys: k2, grounded: true, fingers: 'ballGrip', ...extra });
    h.addClip(c); return c;
  };
  const READY_HAND = hand(-0.40, 0.32, LINE_Z);
  const S0 = () => ({ ...crouch(1), ...trunk(40, 0, -10), ...armsFree('R'), ...arm(30, 4, 28) });
  // breathing / weight shift loop while waiting (2.8 s)
  const ready = mk('ul_ready', 2.8, [
    { t: 0, pose: { ...S0() } },
    { t: 1.1, pose: { ...S0(), ...trunk(43, 3, -9), Pelvis: { pos: [0, -drop(62, 108) * 0.97 + 0.012, -0.04], flex: 8 } }, ease: 'inOut' },
    { t: 2.0, pose: { ...S0(), ...trunk(41, -2, -11), Pelvis: { pos: [0, -drop(62, 108) * 0.97 - 0.004, -0.04], flex: 8 } }, ease: 'inOut' },
    { t: 2.8, pose: { ...S0() }, ease: 'inOut' },
  ], [{ t: 0, pos: READY_HAND }, { t: 1.1, pos: hand(-0.40, 0.335, LINE_Z - 0.01), ease: 'inOut' }, { t: 2.0, pos: hand(-0.405, 0.315, LINE_Z + 0.01), ease: 'inOut' }, { t: 2.8, pos: READY_HAND, ease: 'inOut' }], { loop: true });
  // rehearsal swing for the computer players: a slow pendulum while they think
  const rehearse = mk('ul_rehearse', 1.8, [
    { t: 0, pose: { ...S0() } },
    { t: 0.8, pose: { ...S0(), ...trunk(45, 8, -8), ...arm(8, 6, 30) }, ease: 'inOut' },
    { t: 1.8, pose: { ...S0() }, ease: 'inOut' },
  ], [{ t: 0, pos: READY_HAND }, { t: 0.8, pos: hand(-0.36, 0.42, LINE_Z - 0.34), ease: 'inOut' }, { t: 1.8, pos: READY_HAND, ease: 'inOut' }], { loop: true });
  // wind: scrubbed 0..1 with the swipe power (the back-swing grows)
  const wind = mk('ul_wind', 1, [
    { t: 0, pose: { ...S0() } },
    { t: 1, pose: { ...S0(), ...trunk(46, 14, -6), ...arm(-14, 8, 22), Pelvis: { pos: [0, -drop(62, 108) * 0.97, -0.07], flex: 10, twist: 6 } }, ease: 'inOut' },
  ], [{ t: 0, pos: READY_HAND }, { t: 1, pos: hand(-0.34, 0.56, LINE_Z - 0.78), ease: 'out' }]);
  // swing(p): back-swing(p) -> release at the line (hand low) -> follow-through -> settle. event 'release' at 0.10 s
  const relT = (q) => 0.2 - 0.08 * q;                 // seconds from the start of the swing to the release: a harder roll is a quicker stroke
  const swings = new Map();
  const swingClip = (p) => {
    const q = Math.round(clamp(p, 0, 1) * 10) / 10, key = String(q);
    if (swings.has(key)) return swings.get(key);
    const bz = LINE_Z - 0.08 - 0.70 * q, by = 0.34 + 0.22 * q;
    void bz; void by;
    const tr = relT(q), tp = tr + 0.26;
    const c = mk(`ul_swing_${key}`, 1.2, [
      { t: 0, pose: { ...S0(), ...trunk(40 + 6 * q, 14 * q, -6), ...arm(6 - 22 * q, 8, 24) } },
      { t: tr, pose: { ...S0(), ...crouch(1.12), ...trunk(48, -8, -12), ...arm(34, 4, 14) }, ease: 'inOut' },
      { t: tp, pose: { ...S0(), ...crouch(0.96), ...trunk(36, -22, -16), ...arm(70, 8, 8) }, ease: 'out' },
      { t: 0.78, pose: { ...S0(), ...trunk(38, -8, -12), ...arm(40, 6, 22) }, ease: 'inOut' },
      { t: 1.2, pose: { ...S0() }, ease: 'inOut' },
    ], null, { events: { release: tr } });
    swings.set(key, c); return c;
  };
  // watching: relaxed deep stance, hands on thighs
  const watch = mk('ul_watch', 3.2, [
    { t: 0, pose: { ...crouch(0.9), ...trunk(30, 0, 0), ...arm(26, 10, 40), [`${OS}_UpperArm`]: { flex: 26, abduct: 10 }, [`${OS}_Forearm`]: { flex: 40 } } },
    { t: 1.6, pose: { ...crouch(0.92), ...trunk(32, 2, 0), ...arm(26, 10, 40), [`${OS}_UpperArm`]: { flex: 26, abduct: 10 }, [`${OS}_Forearm`]: { flex: 40 } }, ease: 'inOut' },
    { t: 3.2, pose: { ...crouch(0.9), ...trunk(30, 0, 0), ...arm(26, 10, 40), [`${OS}_UpperArm`]: { flex: 26, abduct: 10 }, [`${OS}_Forearm`]: { flex: 40 } }, ease: 'inOut' },
  ], [{ t: 0, pos: hand(-0.30, 0.50, 0.12) }, { t: 3.2, pos: hand(-0.30, 0.50, 0.12) }], { loop: true });
  h.setFingers(HS, 'ballGrip');

  // the shipped athlete wears trainers baked into the texture: paint every triangle skinned to the foot / toe bones with the skin
  // tone (bare feet), then add a thin cord at each ankle. UV islands are found from the mesh itself.
  {
    const hex = SKIN_HEX[skin] || skin;
    h.model.traverse((o) => {
      if (!o.isSkinnedMesh || !o.geometry.attributes.skinIndex) return;
      const g = o.geometry, uv = g.attributes.uv, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, idx = g.index, bones = o.skeleton.bones;
      const isFoot = (v) => { let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(v, k); if (w > bw) { bw = w; best = si.getComponent(v, k); } } const n = bones[best] && bones[best].name; return /(_Foot|_Toe0)$/.test(n || ''); };
      const mats = [].concat(o.material);
      const groups = g.groups && g.groups.length ? g.groups : [{ start: 0, count: idx ? idx.count : uv.count, materialIndex: 0 }];
      groups.forEach((gr) => {
        const m = mats[gr.materialIndex]; if (!m || !m.map || !m.map.image || (m.userData && m.userData.kind === 'head')) return;
        const img = m.map.image, W = img.width, Hh = img.height; if (!W) return;
        const c = globalThis.document.createElement('canvas'); c.width = W; c.height = Hh; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
        x.fillStyle = hex; x.strokeStyle = hex; x.lineWidth = 2.5; x.lineJoin = 'round';
        let n = 0;
        for (let t = gr.start; t < gr.start + gr.count; t += 3) {
          const a = idx ? idx.getX(t) : t, b = idx ? idx.getX(t + 1) : t + 1, d = idx ? idx.getX(t + 2) : t + 2;
          if (!(isFoot(a) && isFoot(b) && isFoot(d))) continue;
          x.beginPath(); x.moveTo(uv.getX(a) * W, uv.getY(a) * Hh); x.lineTo(uv.getX(b) * W, uv.getY(b) * Hh); x.lineTo(uv.getX(d) * W, uv.getY(d) * Hh); x.closePath(); x.fill(); x.stroke(); n++;
        }
        if (n) { const tx = new THREE.CanvasTexture(c); tx.flipY = m.map.flipY; tx.colorSpace = m.map.colorSpace; tx.anisotropy = 4; tx.wrapS = m.map.wrapS; tx.wrapT = m.map.wrapT; m.map = tx; m.needsUpdate = true; }
      });
    });
    const cordMat = new THREE.MeshStandardMaterial({ color: 0xe9dcb4, roughness: 0.9 });
    const toeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.75 });
    for (const side of ['L', 'R']) {
      const foot = h.bones[`Bip01_${side}_Foot`]; if (!foot) continue;
      const toeB = h.bones[`Bip01_${side}_Toe0`];
      if (toeB) {
        const tp = toeB.getWorldPosition(new THREE.Vector3()), fp = foot.getWorldPosition(new THREE.Vector3());
        for (let k = 0; k < 5; k++) {
          const r = k === 0 ? 0.0135 : 0.0105 - k * 0.0006, lat = (k - 2) * 0.0205 * (side === 'L' ? 1 : 1);
          const toe = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), toeMat); toe.scale.set(1, 0.8, 1.35);
          toe.position.set(tp.x + lat + (side === 'L' ? 0.006 : -0.006), Math.max(0.024, tp.y * 0.55 + 0.01), tp.z + 0.045 - Math.abs(k - 1) * 0.004);
          h.root.add(toe); toe.updateMatrixWorld(true); toeB.attach(toe);
        }
      }
      const cord = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.005, 6, 14), cordMat);
      cord.rotation.x = Math.PI / 2; cord.position.copy(foot.getWorldPosition(new THREE.Vector3())); cord.position.y += 0.005;
      h.root.add(cord); cord.updateMatrixWorld(true); foot.attach(cord);
    }
  }
  // ------------------------------------------------------------------ the rolling hand: a smoothed world target (no clip IK, so no pops)
  const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const sm = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  const BACK = (p) => hand(-0.34 - 0.04 * p, 0.34 + 0.22 * p, LINE_Z - 0.08 - 0.70 * p);
  const REL_P = hand(-0.43, 0.13, LINE_Z + 0.06), FOLLOW = hand(-0.36, 0.62, LINE_Z + 0.80), SETTLE = hand(-0.38, 0.40, LINE_Z + 0.30);
  const WATCH_HAND = hand(-0.36, 0.36, 0.2);
  const H = { pos: [...READY_HAND], vel: [0, 0, 0], p: 0, swingT: -1, relT: 0.12, lastMode: '' };
  const handPath = (mode, p, rehearseT) => {
    if (mode === 'swing') {
      const t = H.swingT, tr = H.relT, tp = tr + 0.26;
      if (t < tr) return lerp3(BACK(H.p), REL_P, sm(t / tr));
      if (t < tp) return lerp3(REL_P, FOLLOW, sm((t - tr) / (tp - tr)));
      if (t < 0.78) return lerp3(FOLLOW, SETTLE, sm((t - tp) / (0.78 - tp)));
      return lerp3(SETTLE, READY_HAND, sm((t - 0.78) / 0.42));
    }
    if (mode === 'wind') return lerp3(READY_HAND, BACK(p), sm(Math.min(1, p * 8)) * 0.35 + 0.65 * p);
    if (mode === 'rehearse') return lerp3(READY_HAND, hand(-0.36, 0.42, LINE_Z - 0.34), 0.5 - 0.5 * Math.cos(rehearseT * 2 * Math.PI / 1.8));
    if (mode === 'watch') return WATCH_HAND;
    return READY_HAND;
  };
  const _tw = new THREE.Vector3(), _pole = new THREE.Vector3();
  const driveHand = (mode, p, dt, t) => {
    if (mode !== 'swing') H.swingT = -1;
    const goal = handPath(mode, p, t);
    const w = mode === 'swing' ? 38 : 16;
    for (let i = 0; i < 3; i++) {
      const x = H.pos[i] - goal[i];
      const a = -2 * w * H.vel[i] - w * w * x;
      H.vel[i] += a * dt; H.pos[i] += H.vel[i] * dt;
    }
    h.root.updateMatrixWorld(true);
    _tw.set(H.pos[0], H.pos[1], H.pos[2]).applyMatrix4(h.root.matrixWorld);
    _pole.set(-0.55 * sgn, 0.55, -0.25).applyMatrix4(h.root.matrixWorld);
    h.setReach(HS, _tw, { weight: 1, pole: _pole });
  };

  // ------------------------------------------------------------------ costume: kapa malo (sash + two hanging panels), headband, lei
  const kapaTex = (() => {
    const c = globalThis.document.createElement('canvas'); c.width = 128; c.height = 192; const g = c.getContext('2d');
    g.fillStyle = accent; g.fillRect(0, 0, 128, 192);
    g.fillStyle = trim; g.fillRect(0, 0, 128, 14); g.fillRect(0, 178, 128, 14);
    g.fillStyle = '#1b1210';
    for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) { const x = i * 32 + 4, y = 28 + r * 38; g.beginPath(); g.moveTo(x, y + 28); g.lineTo(x + 12, y); g.lineTo(x + 24, y + 28); g.closePath(); g.fill(); }
    g.fillStyle = trim; for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) { const x = i * 32 + 16, y = 28 + r * 38 + 6; g.beginPath(); g.moveTo(x - 4, y + 22); g.lineTo(x, y); g.lineTo(x + 4, y + 22); g.closePath(); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const clothMat = new THREE.MeshStandardMaterial({ map: kapaTex, roughness: 0.92, side: THREE.DoubleSide });
  const smallTex = kapaTex.clone(); smallTex.repeat.set(2, 2); smallTex.wrapS = smallTex.wrapT = THREE.RepeatWrapping; smallTex.needsUpdate = true;
  const smallMat = new THREE.MeshStandardMaterial({ map: smallTex, roughness: 0.92, side: THREE.DoubleSide });
  
  const mkPanel = (w, hh) => { const g = new THREE.PlaneGeometry(w, hh, 1, 4); g.translate(0, -hh / 2, 0); const m = new THREE.Mesh(g, smallMat); m.castShadow = true; return m; };
  const front = mkPanel(0.15, 0.34), back = mkPanel(0.15, 0.3);
  const sashGeo = new THREE.TorusGeometry(0.168, 0.024, 8, 36); sashGeo.rotateX(Math.PI / 2);
  const sash = new THREE.Mesh(sashGeo, new THREE.MeshStandardMaterial({ color: new THREE.Color(accent), roughness: 0.85 }));
  sash.scale.set(1, 1, 0.82);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.094, 0.011, 6, 22), new THREE.MeshStandardMaterial({ color: new THREE.Color(accent), roughness: 0.8 }));
  band.rotation.x = Math.PI / 2;
  const beads = (() => {
    const n = 26, g = new THREE.SphereGeometry(0.024, 8, 6), im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.55 }), n), col = new THREE.Color();
    const pal = ['#ffd23f', '#ff7a3d', '#ff4f8a', '#fff6dc', '#ffb347'];
    for (let i = 0; i < n; i++) { col.set(pal[(i * 3 + seed) % pal.length]); im.setColorAt(i, col); }
    im.instanceColor.needsUpdate = true; return im;
  })();
  const kihei = (() => { const g = new THREE.PlaneGeometry(0.34, 0.4, 4, 5); g.translate(0, -0.2, 0); const m = new THREE.Mesh(g, smallMat); m.castShadow = true; return m; })();
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshStandardMaterial({ color: new THREE.Color(accent), roughness: 0.8 }));
  const costume = new THREE.Group(); costume.add(front, back, sash, band, beads); stage.scene.add(costume);
  costume.traverse((o) => { o.frustumCulled = false; });
  const V = { frontAng: 0, backAng: 0, frontVel: 0, backVel: 0, kAng: 0, kVel: 0, prev: new THREE.Vector3(), vel: new THREE.Vector3(), inited: false, yaw: 0 };
  const _p = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Matrix4(), _d = new THREE.Object3D(), _q = new THREE.Quaternion(), _hp = new THREE.Vector3(), _hp2 = new THREE.Vector3(), _hp3 = new THREE.Vector3(), _q2v = new THREE.Vector3(), _ax = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

  // ------------------------------------------------------------------ state machine
  const S = {
    h, left, mode: 'ready', swingT: 0, lastRelease: false, phase: 'ready',
    gripLocal: new THREE.Vector3(0, 0, 0),
  };
  const setClip = (clip, fade = 0.25, opts = {}) => {
    const tr = h.layers.base.current;
    if (tr && tr.clip === clip && !opts.restart) return;
    h.play(clip, { fade, loop: !!opts.loop });
  };
  const scrub = (clip, time, fade = 0.08) => {
    let tr = h.layers.base.current;
    if (!tr || tr.clip !== clip) { h.play(clip, { fade, loop: false }); tr = h.layers.base.current; }
    tr.speed = 0; tr.time = clamp(time, 0, clip.dur); tr.warp = null; tr.loop = false;
  };
  const loop = (clip, fade = 0.3) => {
    let tr = h.layers.base.current;
    if (!tr || tr.clip !== clip) { h.play(clip, { fade, loop: true }); tr = h.layers.base.current; }
    tr.speed = 1; tr.loop = true;
  };
  Object.assign(S, {
    // mode: 'ready' (aiming human / waiting AI), 'wind' (swipe in progress, p), 'rehearse' (AI thinking), 'swing' (p), 'watch'
    drive(mode, p = 0, dt = 0, t = 0) {
      if (mode === 'ready') loop(ready);
      else if (mode === 'rehearse') loop(rehearse);
      else if (mode === 'watch') loop(watch, 0.5);
      else if (mode === 'wind') scrub(wind, p, 0.1);
      S.mode = mode;
      if (mode === 'wind') H.p = p;
      driveHand(mode, p, dt, t);
    },
    // per-frame hand reach while a swing plays (call before stage.update)
    driveSwing(dt) { H.swingT += dt; driveHand('swing', H.p, dt, 0); },
    startSwing(p) {
      const clip = swingClip(p);
      h.play(clip, { fade: 0.07, loop: false });
      const tr = h.layers.base.current; if (tr) { tr.speed = 1; tr.loop = false; }
      S.mode = 'swing'; S.swingT = 0; H.swingT = 0; H.relT = relT(clamp(p, 0, 1)); H.p = clamp(p, 0, 1);
    },
    swinging() { return S.mode === 'swing' && H.swingT >= 0 && H.swingT < 1.18; },
    swingTime() { const tr = h.layers.base.current; return tr && tr.clip.name.startsWith('ul_swing') ? tr.time : -1; },
    place(x, z, yaw, dt = 1 / 60) {
      h.setPosition(x, 0, z);
      V.yaw = V.inited ? V.yaw + Math.atan2(Math.sin(yaw - V.yaw), Math.cos(yaw - V.yaw)) * (1 - Math.exp(-9 * dt)) : yaw;
      h.setFacing(V.yaw);
    },
    // the gaze: a smoothed world point (critically damped), so a fast disc never snaps the head or the shoulders
    look(pt, w = 1, dt = 1 / 60) {
      if (!pt) { h.lookAt(null); return; }
      if (!V.gaze) V.gaze = { p: [pt.x, pt.y, pt.z], v: [0, 0, 0] };
      const g = V.gaze, goal = [pt.x, pt.y, pt.z], om = 5;
      for (let i = 0; i < 3; i++) { const x = g.p[i] - goal[i]; g.v[i] += (-2 * om * g.v[i] - om * om * x) * dt; g.p[i] += g.v[i] * dt; }
      h.lookAt({ x: g.p[0], y: g.p[1], z: g.p[2] }, { weight: w, maxYaw: 0.75, maxPitch: 0.45 });
    },
    // call AFTER stage.update(dt): cloth, lei, headband from the posed bones; returns the disc grip point (world)
    afterUpdate(dt, t, wind = 0.3, out = _hp) {
      h.root.updateMatrixWorld(true);
      const pel = h.bonePosition('Pelvis', _p);
      if (!V.inited) { V.prev.copy(pel); V.inited = true; }
      V.vel.copy(pel).sub(V.prev).divideScalar(Math.max(dt, 1 / 240)); V.prev.copy(pel);
      const yaw = h.root.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw);           // body forward (world xz)
      const fwdSpeed = V.vel.x * fx + V.vel.z * fz;
      // hanging panels: pendulum about their top edge, driven by hip speed, the trade wind and a lean-against-the-thighs bias
      const bias = 0.28;
      const drive = (ang, vel, tgt, k, c) => { const a = (tgt - ang) * k - vel * c; const nv = vel + a * dt; return [ang + nv * dt, nv]; };
      const gust = Math.sin(t * 1.7 + seed) * 0.5 + Math.sin(t * 3.1 + seed * 2) * 0.25;
      [V.frontAng, V.frontVel] = drive(V.frontAng, V.frontVel, bias + gust * wind * 0.5 + fwdSpeed * 0.16, 70, 6.5);
      [V.backAng, V.backVel] = drive(V.backAng, V.backVel, -bias * 0.5 - gust * wind * 0.4 - fwdSpeed * 0.1, 70, 6.5);
      _d.position.copy(pel); _d.rotation.set(0, yaw, 0); _d.updateMatrix();
      const place = (obj, dz, dy, ang) => {
        _n.set(0, dy, dz).applyMatrix4(_d.matrix); obj.position.copy(_n);
        obj.rotation.set(0, yaw, 0);
        obj.rotateX(ang); obj.position.y -= 0.0;
      };
      place(front, 0.155, -0.05, -clamp(V.frontAng, -0.9, 1.1) - 0.1);
      place(back, -0.14, -0.05, clamp(V.backAng, -0.9, 1.1) * -1 + 0.08);
      { const sp2 = h.bonePosition('Spine1', _hp2); _ax.copy(sp2).sub(pel).normalize(); sash.quaternion.setFromUnitVectors(_up, _ax).multiply(_q.setFromAxisAngle(_up, yaw)); sash.position.copy(pel).addScaledVector(_ax, 0.02); }
      // headband and lei from the head / spine
      const head = h.bonePosition('Head', _p);
      band.position.set(head.x, head.y + 0.065, head.z); band.rotation.set(Math.PI / 2, 0, yaw);
      { // lei: a garland around the neck that hangs down the front of the chest and swings a little with the torso
        const neck = h.bonePosition('Neck', _p), s1 = h.bonePosition('Spine1', _hp2);
        _ax.copy(neck).sub(s1).normalize();                                         // torso axis (up the spine)
        _n.set(fx, 0, fz); _n.addScaledVector(_ax, -_n.dot(_ax)).normalize();        // body front, perpendicular to the spine
        const front = _hp3.copy(_n), side = _q2v.crossVectors(_ax, front).normalize();
        const n = beads.count, sway = Math.sin(t * 2.2 + seed) * 0.012;
        for (let i = 0; i < n; i++) {
          const a = (i / (n - 1)) * Math.PI, c = Math.cos(a), sn = Math.sin(a);          // a U-shaped garland down the chest
          _n.copy(neck).addScaledVector(side, c * 0.1).addScaledVector(front, 0.075 + sway * sn).addScaledVector(_ax, -0.03 - 0.15 * sn);
          _m.makeTranslation(_n.x, _n.y, _n.z); beads.setMatrixAt(i, _m);
        }
      }
      beads.instanceMatrix.needsUpdate = true;
      // grip point: just inside the rolling hand
      h.bonePosition(`${HS}_Hand`, out);
      h.bonePosition(`${HS}_Forearm`, _hp3);
      out.addScaledVector(_n.copy(out).sub(_hp3).normalize(), 0.07);       // the disc sits in the palm, not at the wrist
      return out;
    },
    show(on) { h.root.visible = on; costume.visible = on; },
    dispose() { stage.scene.remove(costume); },
  });
  S.clips = { ready, rehearse, wind, watch, swingClip };
  S.root = h.root;
  return S;
}

// The Bira beach yard: a sandy shore at golden hour, the hull on keel blocks with shores, a timber stack, trestles, a thatched shed, palms, and
// shipwrights (real 3D people from view3d) swinging a mallet, chopping with an adze and carrying a plank. The hull is built strake by strake
// from the sim's plank count; the rig rises when the hull is done. READS the sim state only.
//
// Hand/prop ordering: every pose input (clip scrub time, hand reach targets computed from the tool's own grip frame) is set BEFORE the
// presenter's stage.update(dt); the library applies the reach inside human.update and the tools are bone children of the hands, so a tool
// can never float away from the grip (the update-then-pose ordering bug).
import { THREE, loadHuman, buildClip } from '../vendor3d/index.js';
import { TUNE } from '../src/engine.js';
import { clamp, lerp, smooth, hash1, fbm2, mat4 } from './util.js';
import { buildPinisi } from './ship.js';
import { palmParts, hutParts, islandMaterial } from './island.js';
import { createPoints } from './sea.js';

const { Group, Mesh, Vector3, Quaternion, Matrix4, BoxGeometry, CylinderGeometry, MeshStandardMaterial, BufferGeometry, Float32BufferAttribute, Color } = THREE;
const YARD_SCALE = 1.12;
const SHIP_Y = 2.15;                     // waterline height of the hull on its blocks (keel sits on the blocks)
const V = (x = 0, y = 0, z = 0) => new Vector3(x, y, z);

const KITS = [
  { top: '#e9ddc3', bottoms: '#3a4f7a', socks: '#c8b490', skin: 'tan', hair: 'black' },
  { top: '#2d5b73', bottoms: '#5b3a22', socks: '#b8a47a', skin: 'brown', hair: 'black' },
  { top: '#a24a30', bottoms: '#2f2a24', socks: '#b8a47a', skin: 'tan', hair: 'brown' },
  { top: '#d8c8a0', bottoms: '#6a3a3a', socks: '#b8a47a', skin: 'brown', hair: 'black' },
];

// tool geometry: +Y runs from the butt (origin, where the hand holds) to the head
function makeMallet() {
  const g = new Group(), wood = new MeshStandardMaterial({ color: 0x8a5a30, roughness: 0.7 }), head = new MeshStandardMaterial({ color: 0x6d4423, roughness: 0.65 });
  const h = new Mesh(new CylinderGeometry(0.018, 0.022, 0.4, 8), wood); h.position.y = 0.2; g.add(h);
  const m = new Mesh(new CylinderGeometry(0.055, 0.055, 0.17, 12), head); m.rotation.z = Math.PI / 2; m.position.y = 0.4; g.add(m);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function makeAdze() {
  const g = new Group(), wood = new MeshStandardMaterial({ color: 0x8a5a30, roughness: 0.7 }), iron = new MeshStandardMaterial({ color: 0x4a4e52, metalness: 0.7, roughness: 0.4 });
  const h = new Mesh(new CylinderGeometry(0.02, 0.026, 0.85, 8), wood); h.position.y = 0.425; g.add(h);
  const blade = new Mesh(new BoxGeometry(0.14, 0.2, 0.012), iron); blade.position.set(0, 0.88, 0.07); blade.rotation.x = 0.55; g.add(blade);
  const ferrule = new Mesh(new BoxGeometry(0.05, 0.08, 0.05), iron); ferrule.position.y = 0.86; g.add(ferrule);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export async function createYard({ scene, stage, windUni, camera }) {
  const root = new Group(); scene.add(root);
  const imat = islandMaterial(windUni);
  const rr = (n) => hash1(n * 12.9);

  // ---- beach ------------------------------------------------------------------------------------------------------------------------
  { const W = 180, D = 120, nx = 90, nz = 60, pos = [], col = [], idx = [];
    const hAt = (x, z) => 0.32 - smooth(-8, -22, z) * 0.95 + (fbm2(x * 0.08, z * 0.08, 5, 3) - 0.5) * 0.25 * smooth(-8, 6, z);
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = -W / 2 + (i / nx) * W, z = -D * 0.62 + (j / nz) * D, h = hAt(x, z);
      pos.push(x, h, z);
      const wet = smooth(0.2, -0.35, h), n = fbm2(x * 0.5, z * 0.5, 9, 3);
      const sand = new Color('#ecd5a0').lerp(new Color('#d3b87c'), n * 0.7).lerp(new Color('#a89060'), wet);
      const grass = smooth(14, 26, z) * 0.7; sand.lerp(new Color('#6f8a4a'), grass * smooth(0.3, 0.8, fbm2(x * 0.05, z * 0.05, 3, 2)));
      col.push(sand.r, sand.g, sand.b);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('color', new Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new Mesh(g, new MeshStandardMaterial({ vertexColors: true, roughness: 0.96 })); m.receiveShadow = true; root.add(m);
  }

  // ---- hull on blocks ---------------------------------------------------------------------------------------------------------------
  let ship = null, shipKey = '';
  const shipHolder = new Group(); root.add(shipHolder);
  const woodMat = new MeshStandardMaterial({ color: 0x6e4a28, roughness: 0.8 }), darkMat = new MeshStandardMaterial({ color: 0x45301c, roughness: 0.85 });
  for (let i = -3; i <= 3; i++) { const b = new Mesh(new BoxGeometry(0.9, 0.5, 0.7), woodMat); b.position.set(i * 1.9, 0.5, 0); b.castShadow = true; b.receiveShadow = true; root.add(b); }
  for (const s of [1, -1]) for (let i = -2; i <= 2; i++) {            // shores leaning on the hull
    const x = i * 2.6 + 0.4, top = V(x, 2.7, s * 1.75), bot = V(x + s * 0.2, 0.3, s * 3.9);
    const d = top.clone().sub(bot), p = new Mesh(new CylinderGeometry(0.09, 0.11, d.length(), 7), woodMat);
    p.position.copy(bot).addScaledVector(d, 0.5); p.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); p.castShadow = true; root.add(p);
    const foot = new Mesh(new BoxGeometry(0.6, 0.12, 0.35), darkMat); foot.position.set(bot.x, 0.34, bot.z); root.add(foot);
  }
  function ensureShip(y) {
    const k = `${y.size}|${y.timber}|${y.rig}`;
    if (ship && k === shipKey) return;
    if (ship) { shipHolder.remove(ship.root); ship.dispose?.(); }
    ship = buildPinisi({ size: y.size, timber: y.timber, rig: y.rig }); shipKey = k;
    ship.root.scale.setScalar(YARD_SCALE); ship.root.position.set(0, SHIP_Y, 0);
    shipHolder.add(ship.root);
  }

  // ---- props and scenery (one merged mesh with the wind-sway material) ----------------------------------------------------------------
  { const parts = [];
    const add = (geo, m, color, sway = 0) => parts.push({ geo, m, color: new Color(color), sway });
    for (let k = 0; k < 8; k++) add(new BoxGeometry(4.2, 0.12, 0.34), mat4(-9.5 + (k % 2) * 0.08, 0.57 + 0.16 * (k >> 1), 5.2 + (k % 2) * 0.1, 0.05 * (k % 3 - 1)), k % 2 ? '#b9824a' : '#a8723c');
    for (const x of [-9.5 - 1.6, -9.5 + 1.6]) add(new BoxGeometry(0.3, 0.9, 0.6), mat4(x, 0.7, 5.2), '#5a3a1e');
    for (const x of [6.0, 9.2]) { add(new BoxGeometry(0.12, 1.0, 0.12), mat4(x - 0.4, 0.7, 5.6, 0, 1, 1, 1, 0, 0.25), '#6a4a28'); add(new BoxGeometry(0.12, 1.0, 0.12), mat4(x + 0.4, 0.7, 5.6, 0, 1, 1, 1, 0, -0.25), '#6a4a28'); }
    add(new BoxGeometry(4.2, 0.26, 0.4), mat4(7.6, 1.32, 5.6), '#c79b5e');
    for (const [px, pz] of [[13, -4], [19, -4], [13, 1.5], [19, 1.5]]) add(new CylinderGeometry(0.12, 0.14, 3.2, 6), mat4(px, 1.9, pz), '#6a4a28');
    { const roof = new CylinderGeometry(0.0, 5.2, 2.0, 4, 1); roof.rotateY(Math.PI / 4); add(roof, mat4(16, 4.4, -1.2, 0, 1.25, 1, 0.82), '#c4a45a'); }
    for (let k = 0; k < 5; k++) add(new CylinderGeometry(0.28, 0.3, 0.6, 8), mat4(15 + (k % 3) * 1.2, 0.62, -2 + Math.floor(k / 3) * 1.4), k % 2 ? '#7a5a38' : '#5a6a50');
    [[-16, -3], [-18.5, 1], [24, 3], [26, -2], [-13, -9], [10, -10], [3, -12]].forEach(([x, z], i) => parts.push(...palmParts(x, 0.3, z, 4.2 + 1.3 * rr(i + 4), 900 + i, 0.25)));
    parts.push(...hutParts(30, 0.3, 4, -0.4, 1.6));
    const merged = (() => {
      const pos = [], nor = [], col = [], sw = [], idx = []; let base = 0; const v = new Vector3(), nm = new THREE.Matrix3();
      for (const p of parts) {
        const g = p.geo, pa = g.attributes.position, na = g.attributes.normal, m = p.m, c = p.color; nm.getNormalMatrix(m);
        for (let i = 0; i < pa.count; i++) {
          v.fromBufferAttribute(pa, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
          if (na) { v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z); } else nor.push(0, 1, 0);
          col.push(c.r, c.g, c.b); sw.push(p.sway ?? 0);
        }
        if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base); else for (let i = 0; i < pa.count; i++) idx.push(i + base);
        base += pa.count;
      }
      const o = new BufferGeometry();
      o.setAttribute('position', new Float32BufferAttribute(pos, 3)); o.setAttribute('normal', new Float32BufferAttribute(nor, 3));
      o.setAttribute('color', new Float32BufferAttribute(col, 3)); o.setAttribute('aSway', new Float32BufferAttribute(sw, 1)); o.setIndex(idx);
      return o;
    })();
    const props = new Mesh(merged, imat); props.castShadow = true; props.receiveShadow = true; root.add(props);
  }
  const plankMat = new MeshStandardMaterial({ color: 0xc08a50, roughness: 0.7 });
  const carried = new Mesh(new BoxGeometry(3.4, 0.07, 0.26), plankMat); carried.castShadow = true; root.add(carried);

  // wood chips (adze) and dust (mallet)
  const chips = createPoints(40, 0.12, 0xe8c890, 0.9); root.add(chips);
  const chipP = Array.from({ length: 40 }, () => ({ x: 0, y: -9, z: 0, vx: 0, vy: 0, vz: 0, life: 0 }));
  const dust = createPoints(30, 0.55, 0xd8c8a0, 0.5); root.add(dust);
  const dustP = Array.from({ length: 30 }, () => ({ x: 0, y: -9, z: 0, vx: 0, vy: 0, vz: 0, life: 0 }));
  const emit = (arr, n, x, y, z, spread, up, life) => { for (let i = 0; i < n; i++) { const p = arr.find((q) => q.life <= 0); if (!p) return; p.x = x; p.y = y; p.z = z; p.vx = (Math.random() - 0.5) * spread; p.vz = (Math.random() - 0.5) * spread; p.vy = up * (0.5 + Math.random()); p.life = life * (0.6 + 0.4 * Math.random()); } };
  const stepPts = (arr, pts, dt, g) => { const P = pts.geometry.attributes.position.array; arr.forEach((p, i) => { if (p.life > 0) { p.life -= dt; p.vy -= g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < 0.35) { p.y = 0.35; p.vy *= -0.2; p.vx *= 0.5; p.vz *= 0.5; } } P[i * 3] = p.x; P[i * 3 + 1] = p.life > 0 ? p.y : -50; P[i * 3 + 2] = p.z; }); pts.geometry.attributes.position.needsUpdate = true; };

  // ---- shipwrights ---------------------------------------------------------------------------------------------------------------------
  const W = {};
  const listeners = [];
  async function mkWorker(kit, name, pos, yaw) {
    const h = await loadHuman({ character: 'athlete_m', kit: { top: kit.top, bottoms: kit.bottoms, socks: kit.socks, shoes: '#6a5a44' }, skin: kit.skin, hair: kit.hair });
    h.groundClamp = 'feet'; h.footPlanting = true;
    stage.add(h); stage.track(h);
    h.setPosition(pos[0], 0.3, pos[1]); h.setFacing(yaw);
    const hc = new Mesh(new THREE.TorusGeometry(0.095, 0.03, 8, 18), new MeshStandardMaterial({ color: name === 'adze' ? 0xa83a2a : 0xe8d8b0, roughness: 0.9 }));
    hc.rotation.x = Math.PI / 2; hc.position.set(0, 0.11, 0.015); h.bones.Bip01_Head.add(hc);
    return h;
  }
  const BASE = { clip: 'idle_relaxed', time: 0.6 };
  function mkClips(h) {
    const LEG = Math.max(0.6, h.pelvisHeight - 0.09);
    const drop = (a, b = 2 * a) => LEG - (LEG / 2) * (Math.cos(a * Math.PI / 180) + Math.cos((a - b) * Math.PI / 180));
    const knees = (a, o = {}) => { const b = o.calf ?? 2 * a; return { Pelvis: { pos: [o.px ?? 0, -drop(a, b), o.pz ?? 0] }, L_Thigh: { flex: a, abduct: o.ab ?? 5 }, R_Thigh: { flex: a, abduct: o.ab ?? 5 }, L_Calf: { flex: b }, R_Calf: { flex: b } }; };
    const P = (o) => ({ ...knees(o.k ?? 12, { px: o.px, pz: o.pz, ab: o.ab }), Spine: { flex: o.sp ?? 4, twist: o.tw ?? 0 }, Spine1: { flex: o.s1 ?? 4, twist: o.t1 ?? 0, side: o.side ?? 0 }, Spine2: { flex: o.s2 ?? 2, twist: o.t2 ?? 0 }, Neck: { flex: o.nk ?? 6 }, Head: { flex: o.hd ?? 4 } });
    const hammer = buildClip(h, { name: 'hammer', duration: 1, base: BASE, grounded: false, keys: [
      { t: 0.0, pose: P({ k: 12, sp: 6, s1: 6, t1: -5, tw: -2 }) },
      { t: 0.42, pose: P({ k: 7, sp: -2, s1: -4, t1: -14, s2: -6, t2: -8, pz: -0.05, nk: 2 }), ease: 'inOut' },
      { t: 0.6, pose: P({ k: 22, sp: 14, s1: 14, t1: 8, s2: 6, t2: 4, pz: 0.07, nk: 10 }), ease: 'in' },
      { t: 0.72, pose: P({ k: 18, sp: 11, s1: 11, t1: 6, pz: 0.05, nk: 9 }), ease: 'out' },
      { t: 1.0, pose: P({ k: 12, sp: 6, s1: 6, t1: -5, tw: -2 }), ease: 'inOut' },
    ] });
    const chop = buildClip(h, { name: 'chop', duration: 1, base: BASE, grounded: false, keys: [
      { t: 0.0, pose: P({ k: 20, ab: 14, sp: 16, s1: 14, t1: -6, s2: 6, nk: 4, pz: -0.05 }) },
      { t: 0.45, pose: P({ k: 16, ab: 14, sp: 10, s1: 8, t1: -14, s2: 0, nk: 0, pz: -0.09 }), ease: 'inOut' },
      { t: 0.62, pose: P({ k: 28, ab: 14, sp: 30, s1: 24, t1: 6, s2: 12, nk: 12, pz: 0.04 }), ease: 'in' },
      { t: 0.78, pose: P({ k: 26, ab: 14, sp: 28, s1: 22, t1: 4, nk: 10, pz: 0.03 }), ease: 'out' },
      { t: 1.0, pose: P({ k: 20, ab: 14, sp: 16, s1: 14, t1: -6, s2: 6, nk: 4, pz: -0.05 }), ease: 'inOut' },
    ] });
    const hold = buildClip(h, { name: 'hold', duration: 4, base: BASE, grounded: false, keys: [
      { t: 0, pose: P({ k: 10, sp: 8, s1: 8, nk: 8 }) }, { t: 2, pose: P({ k: 12, sp: 10, s1: 9, nk: 9, side: 1.5 }), ease: 'inOut' }, { t: 4, pose: P({ k: 10, sp: 8, s1: 8, nk: 8 }), ease: 'inOut' },
    ] });
    h.addClip(hammer); h.addClip(chop); h.addClip(hold);
    return { hammer, chop, hold };
  }
  function scrub(h, clip, u) {
    let tr = h.layers.base.current;
    if (!tr || tr.clip !== clip) { h.play(clip, { fade: 0.12, loop: false }); tr = h.layers.base.current; }
    tr.speed = 0; tr.time = clamp(u, 0, 0.9999) * clip.dur; tr.warp = null; tr.loop = false;
  }
  const toWorld = (h, x, y, z) => V(x, y, z).applyMatrix4(h.root.matrixWorld);
  const axisW = (h, x, y, z) => V(x, y, z).transformDirection(h.root.matrixWorld);
  const _m = new Matrix4();
  function qFromDir(dir, side) {
    const y = dir.clone().normalize(), x = side.clone().sub(y.clone().multiplyScalar(side.dot(y))).normalize(), z = new Vector3().crossVectors(x, y).normalize();
    return new Quaternion().setFromRotationMatrix(_m.makeBasis(x, y, z));
  }
  // put a tool's origin at T pointing `dir`, by driving the hand that holds it (the grip frame comes from the attach)
  function holdTool(h, side, tool, T, dir, sideAxis, pole) {
    const Qp = qFromDir(dir, sideAxis), handQ = Qp.clone().multiply(tool.quaternion.clone().invert());
    const hp = T.clone().sub(tool.position.clone().applyQuaternion(handQ));
    h.setReach(side, hp, { weight: 1, quat: handQ, pole });
  }
  const knock = (kind, power = 1) => { for (const f of listeners) f(kind, power); };

  let ready = false; const clips = {};
  const mallet = makeMallet(), adze = makeAdze();
  (async () => {
    try {
      W.ham = await mkWorker(KITS[0], 'ham', [-1.0, 3.7], Math.PI);
      W.hold = await mkWorker(KITS[1], 'hold', [1.8, 3.6], Math.PI);
      W.adze = await mkWorker(KITS[2], 'adze', [7.6, 6.7], Math.PI);
      W.carry = await mkWorker(KITS[3], 'carry', [-8, 2.2], Math.PI / 2);
      clips.ham = mkClips(W.ham); clips.hold = mkClips(W.hold); clips.adze = mkClips(W.adze);
      W.ham.attach(mallet, 'R', 'bat', { slide: 0.07 });
      W.adze.attach(adze, 'R', 'bat', { slide: 0.12 });
      W.adze.holdTwoHanded(adze, 'L', { gap: 0.28 });
      W.ham.setFingers('L', 'open'); W.hold.setFingers('L', 'open'); W.hold.setFingers('R', 'open');
      ready = true;
    } catch (e) { console.warn('yard workers failed', e); }
  })();

  const st = { hamPhase: 0.3, adzePhase: 0.0, lastRes: 0, burst: 0, camD: 30, camT: V(0, 3, 0), carryT: 0 };
  const shadowTarget = { x: 0, z: 0 };
  const api = {
    root, shadowTarget, workers: W,
    onStrike(fn) { listeners.push(fn); },
    get ready() { return ready; },
    // Sets every pose input for this frame. The presenter calls stage.update(dt) AFTER this, then renders.
    update(dt, t, s, L, c) {
      const y = s.yard;
      ensureShip(y);
      const fitting = y.phase === 'fit' || y.phase === 'done';
      const planks = fitting ? clamp(y.bShown / TUNE.planks, 0, 1) : 1;
      const rigT = !fitting ? 1 : y.phase === 'done' ? clamp(y.rigT, 0, 1) : 0;
      ship.setPlanks(planks); ship.setRig(rigT);
      ship.update(t, { setting: rigT >= 1 ? (y.phase === 'done' ? 'full' : 'reef') : 'anchor', side: 1, rel: 1.3, str: 0.45, dt });
      ship.ship.rotation.x = 0;
      const n = y.task ? y.task.res.length : 0;
      if (n > st.lastRes) { st.burst = 3; st.lastRes = n; }
      if (!fitting) st.lastRes = 0; else if (n < st.lastRes) st.lastRes = n;

      if (ready) {
        const calm = c.calm;
        const rate = (y.phase === 'fit' ? 1.0 : y.phase === 'done' ? 0.0 : 0.55) * (calm ? 0.6 : 1) + (st.burst > 0 ? 0.9 : 0);
        const prev = st.hamPhase;
        st.hamPhase = (st.hamPhase + dt * rate * 0.9) % 1;
        if (rate > 0 && prev < 0.6 && st.hamPhase >= 0.6) {
          knock('hammer', st.burst > 0 ? 1.3 : 0.8); emit(dustP, 3, -0.9, 1.15, 2.1, 0.8, 0.9, 0.7);
          if (st.burst > 0) st.burst -= 1;
        }
        const wHam = W.ham, u = st.hamPhase;
        scrub(wHam, clips.ham.hammer, u);
        const raise = u < 0.42 ? lerp(0.3, 1, smooth(0, 0.42, u)) : u < 0.6 ? 1 - Math.pow(smooth(0.42, 0.6, u), 2) : u < 0.8 ? 0 : 0.3 * smooth(0.8, 1.0, u);
        const hy = lerp(1.12, 1.82, raise), hz = lerp(0.58, 0.05, raise), hx = -0.2, theta = lerp(1.55, 0.35, raise);
        holdTool(wHam, 'R', mallet, toWorld(wHam, hx, hy, hz), axisW(wHam, 0, Math.cos(theta), Math.sin(theta)), axisW(wHam, 1, 0, 0), toWorld(wHam, -0.55, hy - 0.25, -0.2));
        wHam.setReach('L', toWorld(wHam, 0.28, 1.05, 0.52), { weight: 1, pole: toWorld(wHam, 0.5, 0.9, 0.1) });

        scrub(W.hold, clips.hold.hold, (t * 0.25) % 1);
        const jig = (st.burst > 0 || (u > 0.58 && u < 0.7)) ? 0.012 : 0;
        W.hold.setReach('R', toWorld(W.hold, -0.2, 1.12 + jig, 0.5), { weight: 1, pole: toWorld(W.hold, -0.5, 0.85, 0.1) });
        W.hold.setReach('L', toWorld(W.hold, 0.2, 1.12 - jig, 0.5), { weight: 1, pole: toWorld(W.hold, 0.5, 0.85, 0.1) });

        const prevA = st.adzePhase;
        st.adzePhase = (st.adzePhase + dt * 0.62 * (calm ? 0.6 : 1)) % 1;
        if (prevA < 0.62 && st.adzePhase >= 0.62) { knock('adze', 0.8); emit(chipP, 6, 7.6 + (Math.random() - 0.5) * 1.6, 1.55, 5.4, 2.6, 2.4, 0.9); }
        scrub(W.adze, clips.adze.chop, st.adzePhase);
        { const ua = st.adzePhase, up = ua < 0.45 ? smooth(0, 0.45, ua) : ua < 0.62 ? 1 - smooth(0.45, 0.62, ua) : 0;
          const hyA = lerp(0.95, 1.55, up), hzA = lerp(0.42, -0.02, up), th = lerp(2.45, 0.9, up), dir = V(0, Math.cos(th), Math.sin(th));
          holdTool(W.adze, 'R', adze, toWorld(W.adze, -0.12, hyA, hzA), axisW(W.adze, dir.x, dir.y, dir.z), axisW(W.adze, 1, 0, 0), toWorld(W.adze, -0.5, hyA - 0.3, -0.1)); }

        // carrier: plank from the stack to the hull, put it down, walk back empty
        st.carryT = (st.carryT + dt) % 24;
        const ct = st.carryT, h = W.carry, TW = 4.6, A = V(-9.4, 0.3, 2.9), B = V(-3.6, 0.3, 3.0);
        let cx, cz, face, speed = 0, carrying = false;
        if (ct < TW) { const u2 = ct / TW; cx = lerp(A.x, B.x, u2); cz = lerp(A.z, B.z, u2); face = Math.PI / 2; speed = 1.25; carrying = true; }
        else if (ct < TW + 3.4) { cx = B.x; cz = B.z; face = ct > TW + 2.1 ? -Math.PI / 2 : Math.PI / 2; carrying = ct < TW + 1.3; }
        else if (ct < 2 * TW + 3.4) { const u2 = (ct - TW - 3.4) / TW; cx = lerp(B.x, A.x, u2); cz = lerp(B.z, A.z, u2); face = -Math.PI / 2; speed = 1.25; }
        else { cx = A.x; cz = A.z; face = ct > 2 * TW + 3.4 + 1.8 ? Math.PI / 2 : -Math.PI / 2; }
        h.setPosition(cx, 0.3, cz); h.turnRate = 3.2; h.setFacing(face, { snap: false });
        h.locomote(speed);
        carried.visible = carrying || (ct >= TW + 1.3 && ct < 2 * TW + 3.4 && false) || (ct >= TW + 1.3 && ct < TW + 3.4);
        if (ct >= TW + 1.3) { carried.position.set(-3.1, 1.05, 2.0); carried.rotation.set(0, 0.2, 0.03); }
        if (carrying && ct < TW + 1.3) {
          carried.position.copy(toWorld(h, -0.22, 1.5, 0.55)); carried.rotation.set(0, Math.PI / 2 - h.root.rotation.y, 0.03);
          h.setReach('R', toWorld(h, -0.2, 1.48, 0.3), { weight: 1, pole: toWorld(h, -0.55, 1.1, 0.0) });
          h.setReach('L', toWorld(h, 0.1, 1.55, 1.05), { weight: 1, pole: toWorld(h, 0.4, 1.2, 0.8) });
        } else { h.setReach('R', null); h.setReach('L', null); }
      }
      stepPts(chipP, chips, dt, 9); stepPts(dustP, dust, dt, -0.3);

      // camera: pull back as the rig rises; 3/4 view from the stern side
      const rect = L.yard.preview;
      const rigVis = fitting ? rigT : 1;
      const extH = lerp(7.5, 15.5, rigVis), extW = 19;
      const tanH = Math.tan(camera.fov * Math.PI / 360), vh = rect.h / c.VH, vw = rect.w / c.VW, asp = c.VW / c.VH;
      const D = Math.max(extH / (0.9 * vh * tanH * 2), extW / (0.9 * vw * tanH * 2 * asp), 18);
      const k = dt > 0 ? 1 - Math.exp(-dt * 2.2) : 1;
      st.camD = lerp(st.camD, D, k);
      st.camT.lerp(V(0.5, extH * 0.37 - 0.2, 0), k);
      const az = 0.5 + Math.sin(t * 0.07) * 0.12, el = 0.2 + Math.sin(t * 0.05) * 0.015;
      camera.position.set(st.camT.x - Math.sin(az) * Math.cos(el) * st.camD, st.camT.y + Math.sin(el) * st.camD + 0.4, st.camT.z + Math.cos(az) * Math.cos(el) * st.camD);
      camera.lookAt(st.camT);
      c.frameRect(rect);
    },
  };
  return api;
}

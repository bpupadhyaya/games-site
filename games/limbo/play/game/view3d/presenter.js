// Limbo 3D presenter. READS the game state (game.getState()) and draws the beach party: sunset sky and sea, sand, palms, tiki torches, string
// lights, a steel pan band, a crowd, the bar (bamboo / torch / fire) and the dancer with real cloth. It never writes back to the simulation.
// One WebGL canvas sits behind the kit's transparent 2D canvas; the 2D layer draws only the HUD, gauges, plaques and banners.
// The camera is fitted so the bar's foot lands exactly where the 2D layout expects it (layout.play.bx / gy / U), which keeps every overlay
// (pops, ready chip, bar tag) aligned. Fallbacks: no WebGL or lost context -> view.gl3d false and src/art.js paints the 2D beach.
import { layoutFor } from '../src/layout.js';
import { heroScene } from '../src/view.js';
import { pose as enginePose, BEAT, PAN } from '../src/engine.js';
import { LOOKS, dancerJoints } from '../src/art.js';
import { glowTexture, flameTexture, Particles, hash, clamp } from './fx.js';
import { buildSky, buildSea, buildSand, buildPalm, buildSteelPan, buildTorch, buildStringLights } from './world.js';
import { createBar, BAR_HALF } from './bar.js';

const LIB = '../vendor3d/index.js';
const K = 1.74;                                  // metres per body height
const CAM = { az: 30, el: 8, fov: 34 };
const TAU = Math.PI * 2;

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  return weak ? 'medium' : 'high';
}

const MUSICIANS = [
  { x: -4.7, z: -3.0, yaw: 0.5, kit: { top: '#ffd240', bottoms: '#2b5a8f', socks: '#ffffff' }, skin: '#6b4430', hair: '#14100e' },
  { x: -5.9, z: -3.7, yaw: 0.36, kit: { top: '#ff6a4d', bottoms: '#f1ede4', socks: '#ffffff' }, skin: '#8a5a3c', hair: '#1b1210' },
  { x: -3.7, z: -3.8, yaw: 0.62, kit: { top: '#18b7a6', bottoms: '#3a2a52', socks: '#ffffff' }, skin: '#4a2f22', hair: '#0e0a08' },
];

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { ok: false, stage: null, wrap: (g) => g };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D beach', e); return none; }
  const { createStage, loadHuman, createCrowd3d, THREE } = V3;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'evening', mode: 'continuous', shadowSize: 4.5, transparent: true });
  if (!stage.supported) { canvas.remove(); return none; }
  const { scene, camera, renderer } = stage;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  // ------------------------------------------------------------------------------------------------ light
  // The sun sits low behind the bar (a little to the right of the view), warm; a cool violet fill comes from the camera side.
  const az = CAM.az * Math.PI / 180;
  const fwd = V(-Math.sin(az), 0, -Math.cos(az)), right = V(Math.cos(az), 0, -Math.sin(az));
  const sunDir = fwd.clone().multiplyScalar(Math.cos(-0.1)).addScaledVector(right, Math.sin(-0.1)); sunDir.y = 0.026; sunDir.normalize();
  stage.setLighting('evening', { sky: 0x000000, fog: 0xe08a62, hemiSky: 0xffb48a, hemiGround: 0xa87048, hemi: 0.7, key: 0xffa060, keyI: 2.5, rim: 0xffb3a0, rimI: 1.7, exposure: 1.02 });
  scene.background = null;
  scene.fog = new THREE.Fog(0xe0865e, 30, 150);
  stage._shadowOffset.set(sunDir.x * 16, 8.5, sunDir.z * 16);
  stage.lights.key.shadow.camera.far = 40;
  scene.environmentIntensity = 0.28;

  // ------------------------------------------------------------------------------------------------ the world
  const glowTex = glowTexture(128), flameTex = flameTexture();
  const sky = buildSky(); sky.material.uniforms.uSun.value.copy(sunDir); scene.add(sky);
  const sea = buildSea(); sea.material.uniforms.uSun.value.copy(sunDir); scene.add(sea);
  const sand = buildSand(Math.min(8, renderer.capabilities.getMaxAnisotropy())); scene.add(sand);
  const palms = [];
  for (const [x, z, h, lean, seed, fl] of [[-6.6, -3.0, 6.2, 0.5, 1, 2.3], [4.6, -4.9, 6.6, -0.5, 2, 2.4], [-11.0, -7.0, 8.0, 0.35, 3, 2.7], [10.5, -9.2, 7.6, -0.35, 4, 2.6], [1.0, -12, 7.4, 0.45, 5, 2.5], [-3.6, -9.5, 7.0, 0.3, 6, 2.5]]) {
    const p = buildPalm({ height: h, lean, seed, frondLen: fl }); p.position.set(x, 0, z); p.rotation.y = seed * 0.9; scene.add(p); palms.push(p);
  }
  // string lights across the back of the party
  scene.add(buildStringLights([V(-5.0, 5.6, -2.6), V(-2.2, 4.4, -3.8), V(1.2, 4.2, -4.2), V(4.2, 4.9, -4.6)], { sag: 0.55, bulbs: 10, glowTex }));
  // tiki torches around the dance space (the two near ones also light the dancer)
  const torches = [];
  for (const [x, z, lit] of [[-1.7, -2.2, 0], [1.6, -2.4, 0], [-1.6, 2.3, 1], [3.0, 1.9, 1], [-6.0, -1.2, 0], [5.6, -1.6, 0]]) {
    const t = buildTorch({ height: 1.75, seed: x * 3 + z, flameTex, glowTex, light: !!lit && quality !== 'low' });
    t.group.position.set(x, 0, z); scene.add(t.group); torches.push(t);
  }
  // driftwood logs for depth
  {
    const logMat = new THREE.MeshStandardMaterial({ color: 0x6b4b34, roughness: 0.95 });
    for (const [x, z, r] of [[-5.8, -3.2, 0.3], [5.4, -3.3, -0.25], [-1.0, 4.5, 0.1]]) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 1.9, 9), logMat); l.rotation.set(0, r, Math.PI / 2); l.position.set(x, 0.15, z); l.castShadow = true; scene.add(l);
    }
  }
  // a conch shell on the sand, so the bottom of the picture is not bare
  { const shell = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf4d6c0, roughness: 0.5 })); shell.scale.set(1.3, 0.7, 1); shell.position.set(-0.6, 0.05, 2.0); scene.add(shell); }
  // ------------------------------------------------------------------------------------------------ effects
  const sandFx = new Particles(140, { map: glowTex, gravity: -4.5, drag: 1.0 }); sandFx.groundY = 0.01; scene.add(sandFx.points);
  const emberFx = new Particles(180, { map: glowTex, additive: true, gravity: 0.7, drag: 0.4 }); scene.add(emberFx.points);
  const flameFx = new Particles(120, { map: glowTex, additive: true, gravity: 0.9, drag: 1.2 }); scene.add(flameFx.points);
  const confetti = new Particles(160, { map: glowTex, gravity: -2.2, drag: 1.4 }); scene.add(confetti.points);
  const prints = [];
  {
    const g = new THREE.PlaneGeometry(0.1, 0.26); g.rotateX(-Math.PI / 2);
    for (let i = 0; i < 22; i++) { const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x3a1c14, transparent: true, opacity: 0, depthWrite: false })); m.position.y = 0.012; m.renderOrder = -8; m.visible = false; scene.add(m); prints.push({ m, age: 99 }); }
  }
  const bar = createBar({ flameTex, glowTex, particles: sandFx, embers: flameFx });
  scene.add(bar.root);

  // the hint hologram
  const ghost = new THREE.Group(); ghost.visible = false; scene.add(ghost);
  const ghostSegs = [];
  {
    const gm = new THREE.MeshBasicMaterial({ color: 0x7fffe0, transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending });
    for (const r of [0.12, 0.07, 0.06, 0.075, 0.055, 0.075, 0.055, 0.045, 0.04, 0.045, 0.04]) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, 1, 4, 10), gm); ghost.add(m); ghostSegs.push({ m, r }); }
    ghostSegs.head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), gm); ghost.add(ghostSegs.head);
  }

  const P = { ok: true, stage, THREE, ready: false, lost: false, overlay: {}, shot: false, bar };
  let dancer = null, crowd = null, perfLevel = 0;
  const players = [];

  async function build() {
    const { createDancer } = await import('./dancer.js');
    dancer = await createDancer({ quality });
    scene.add(dancer.root, dancer.group);
    stage.track(dancer.human);
    for (let i = 0; i < MUSICIANS.length; i++) {
      const d = MUSICIANS[i];
      const h = await loadHuman({ character: 'athlete_m', kit: d.kit, skin: d.skin, hair: d.hair, lod: quality === 'low' ? 2 : 'auto', quality });
      h.groundClamp = 'off'; h.footPlanting = false;
      h.play('idle_relaxed', { fade: 0 });
      h.root.position.set(d.x, 0, d.z); h.root.rotation.y = d.yaw; h.facing = d.yaw;
      scene.add(h.root); stage.track(h);
      const pan = buildSteelPan({ radius: i === 2 ? 0.34 : 0.29, color: i === 1 ? 0xe2c37a : 0xd9d2c4 });
      const fwdv = V(Math.sin(d.yaw), 0, Math.cos(d.yaw));
      const pp = V(d.x, 0, d.z).addScaledVector(fwdv, 0.5); pan.position.set(pp.x, 0.76, pp.z); pan.rotation.y = d.yaw; pan.rotation.x = 0.06;
      scene.add(pan);
      const mallets = [0, 1].map(() => {
        const g = new THREE.Group();
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 1, 6), new THREE.MeshStandardMaterial({ color: 0x8a6a3c, roughness: 0.6 }));
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshStandardMaterial({ color: 0x1c1a1c, roughness: 0.9 }));
        g.add(rod, tip); g.userData = { rod, tip }; scene.add(g); return g;
      });
      h.setFingers('R', 'relaxed'); h.setFingers('L', 'relaxed');
      players.push({ human: h, pan, mallets, def: d, fwd: fwdv, phase: i * 0.5 });
    }
    // the crowd: seated on the sand behind the bar, a few standing at the sides; nobody blocks the dancer's line to the sea
    const rows = [{ from: [-1.2, 0, -3.5], to: [3.6, 0, -3.8], count: 8, face: [0, 0, 0], seated: true }, { from: [0.4, 0, -5.4], to: [6.6, 0, -5.8], count: 8, face: [0, 0, 0] },
      { from: [-9.4, 0, -3.8], to: [-7.2, 0, -4.2], count: 4, face: [0, 0, 0], seated: true }, { from: [6.6, 0, -1.2], to: [8.6, 0, -2.0], count: 4, face: [0, 0, 0] }];
    const pts = [{ x: 5.4, z: 0.6, yaw: -1.7, seated: true }, { x: -8.4, z: -0.8, yaw: 1.5 }, { x: 4.4, z: -2.4, yaw: -2.2 }];
    try {
      crowd = createCrowd3d(stage, { rows, points: pts, seed: 11, culture: ['latin_american', 'african'], quality, cold: false, props: { flag: 0.1, phone: 0.14, child: 0.05 }, excitement: 0.35, viewportHeight: 800, kids: 0.1 });
    } catch (e) { console.warn('crowd3d unavailable', e && e.message); crowd = null; }
    stage.setAutoLOD(true);
    P.ready = true;
    stage.invalidate();
  }
  P.ready_p = build().catch((e) => { console.warn('3D build failed', e); P.failed = e; });

  // ------------------------------------------------------------------------------------------------ camera fit
  const map = { cw: 720, ch: 1280, sc: 1, ox: 0, oy: 0 };
  let camKey = '', lastNow = 0, T = 0;
  function fitCamera(cw, ch, vw, vh, bx, gy, U) {
    const sc = Math.min(cw / vw, ch / vh), ox = (cw - vw * sc) / 2, oy = (ch - vh * sc) / 2;
    Object.assign(map, { cw, ch, sc, ox, oy });
    const s = (U * sc) / K, f = CAM.fov * Math.PI / 180;
    const d = (ch / 2) / (s * Math.tan(f / 2));
    const el = CAM.el * Math.PI / 180;
    camera.fov = CAM.fov; camera.aspect = cw / ch; camera.near = 1; camera.far = 700;
    camera.clearViewOffset();
    camera.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    const px = ox + bx * sc, py = oy + gy * sc;
    camera.setViewOffset(cw, ch, -(px - cw / 2), -(py - ch / 2), cw, ch);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    P.camDist = d;
  }
  const proj = V();
  function project(x, y, z) {
    proj.set(x, y, z).project(camera);
    return { x: ((proj.x * 0.5 + 0.5) * map.cw - map.ox) / map.sc, y: ((-proj.y * 0.5 + 0.5) * map.ch - map.oy) / map.sc };
  }

  // ------------------------------------------------------------------------------------------------ state followers
  const sm = { lean: 0, wob: 0, ph: 0, init: false };
  const feetState = [{ lift: 0 }, { lift: 0 }];
  let prevAttPhase = '', prevAtt = null, printIdx = 0;
  const gust = (t, k = 0) => 0.5 + 0.5 * Math.sin(t * 0.7 + k) * Math.sin(t * 0.23 + k * 2.1);
  const yAx = V(0, 1, 0);

  function driveDancer(att, look, calm, dt, beat) {
    if (!dancer) return null;
    if (prevAtt !== att) { prevAtt = att; prevAttPhase = att.phase; bar.reset(); sm.init = false; dancer.cloth.reset(); dancer.resetGait(); }
    const k = 1 - Math.exp(-dt / 0.045);
    const phTarget = att.phase === 'ready' ? beat * Math.PI : att.stepPh;
    if (!sm.init) { sm.lean = att.lean; sm.wob = att.wobble; sm.ph = phTarget; sm.init = true; }
    sm.lean += (att.lean - sm.lean) * k; sm.wob += (att.wobble - sm.wob) * k;
    const dph = phTarget - sm.ph; sm.ph += Math.abs(dph) > 1.2 ? dph : dph * Math.min(1, dt / 0.04);
    let ang = 0, sit = 0, cheer = 0;
    if (att.phase === 'fall') { ang = att.fallDir * Math.min(1.45, Math.pow(att.sinceHit * 2.6, 1.7)); sit = clamp((att.sinceHit - 0.35) * 2, 0, 1); }
    else if (att.phase === 'clear') { const u = clamp(att.sinceHit * 2.2, 0, 1); cheer = u * u * (3 - 2 * u); }
    else if (att.phase === 'touch') ang = -0.1 * Math.sin(att.sinceHit * 9) * Math.max(0, 1 - att.sinceHit);
    const sway = att.phase === 'ready' && !calm ? Math.sin(beat * Math.PI) * 0.015 : 0;
    const p = enginePose(sm.lean, att.phase === 'fall' ? sm.wob * 0.5 : sm.wob, sm.ph);
    const J = dancerJoints(p, { ang: ang + sway, sit, cheer });
    dancer.setLook(look);
    dancer.t = T;
    const wind = gust(T, 1) * 1.6;
    const info = dancer.apply({ p, att, ang, sit, cheer, dt, rootX: att.x * K, phase: sm.ph, beat, wind, J, fall: att.phase === 'fall' ? 1 : 0 });
    info.feet.forEach((f, i) => {
      const st = feetState[i];
      const was = st.lift > 0.2, now = f.lift > 0.2;
      if (!calm) {
        if (!was && now && f.vx < 0.05) for (let n = 0; n < 5; n++) sandFx.emit(f.x - 0.05, 0.04, f.z, -0.4 - hash(T * 9 + n) * 0.7, 0.5 + hash(T * 5 + n) * 0.9, (hash(T * 3 + n) - 0.5) * 0.7, 0.55, 0.07, 0.17, 0.86, 0.68, 0.46, 0.85);
        if (was && !now) for (let n = 0; n < 2; n++) sandFx.emit(f.x + 0.1, 0.03, f.z, (hash(T * 7 + n) - 0.3) * 0.4, 0.25 + hash(T * 5 + n) * 0.3, (hash(T + n) - 0.5) * 0.3, 0.4, 0.06, 0.14, 0.86, 0.68, 0.46, 0.6);
      }
      if (was && !now && att.phase !== 'ready') { const pr = prints[printIdx++ % prints.length]; pr.m.position.set(f.x + 0.06, 0.012, f.z); pr.age = 0; pr.m.visible = true; }
      st.lift = f.lift;
    });
    if (att.phase !== prevAttPhase) {
      if (att.phase === 'fall' && !calm) for (let n = 0; n < 26; n++) { const a = hash(n * 3.7) * TAU; sandFx.emit(att.x * K + Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.35, Math.cos(a) * (0.6 + hash(n) * 1.2), 0.9 + hash(n + 9) * 1.4, Math.sin(a) * (0.5 + hash(n + 3)), 0.9, 0.1, 0.26, 0.86, 0.68, 0.46, 0.9); }
      if (att.phase === 'touch') {
        bar.release(Math.sign(att.wobble) || 1, att.wobble);
        if (crowd) crowd.react('gasp', { intensity: 1 });
        for (let n = 0; n < 18; n++) emberFx.emit(0, bar.S.y, (hash(n) - 0.5) * 1.4, (hash(n + 4) - 0.2) * 1.4, 0.8 + hash(n + 8) * 1.2, (hash(n + 2) - 0.5) * 1.0, 0.8, 0.08, 0.01, 1, 0.8, 0.4, 1);
      } else if (att.phase === 'fall' && crowd) crowd.react('groan', { intensity: 0.9 });
      else if (att.phase === 'clear') {
        if (crowd) crowd.react('cheer', { intensity: 1 });
        if (!calm) for (let n = 0; n < 40; n++) { const c = [[1, 0.85, 0.45], [1, 0.42, 0.3], [0.1, 0.72, 0.65], [1, 0.55, 0.76]][n % 4]; confetti.emit((hash(n) - 0.5) * 1.4, 1.2 + hash(n + 7) * 0.8, (hash(n + 5) - 0.5) * 1.2, (hash(n + 3) - 0.5) * 2.2, 2.0 + hash(n + 1) * 2.4, (hash(n + 9) - 0.5) * 1.6, 1.8, 0.09, 0.07, c[0], c[1], c[2], 1); }
      }
      prevAttPhase = att.phase;
    }
    return info;
  }

  // the steel pan band follows the beat: a mallet strike on each beat, alternating hands, notes from the engine's pan figure
  const hv = V(), tv = V(), dirV = V(), qa = new THREE.Quaternion();
  function driveBand(dt, beat, calm) {
    const n = Math.floor(beat), b = beat - n;
    for (const pl of players) {
      const h = pl.human;
      h.update(dt);
      const root = pl.def, basis = pl.pan;
      for (let s = 0; s < 2; s++) {
        const side = s === 0 ? 'R' : 'L';
        const mine = ((n + (pl.phase > 0.4 ? 1 : 0)) % 2) === s;
        const note = PAN[(n + (mine ? 0 : 1)) % 8];
        const rr = basis.userData.radius;
        const lx = (s === 0 ? -1 : 1) * rr * (0.22 + 0.42 * (note / 10)), lz = rr * 0.45 * Math.sin(note * 1.3 + pl.phase * 4);
        const c = Math.cos(root.yaw), sn = Math.sin(root.yaw);
        const face = basis.position.y + basis.userData.faceY * 0.98;
        const hit = V(basis.position.x + lx * c + lz * sn, face, basis.position.z - lx * sn + lz * c);
        const lift = mine ? 0.2 * Math.pow(Math.sin(Math.PI * b), 1.3) * (calm ? 0.6 : 1) : 0.07 + 0.02 * Math.sin(T * 3 + s);
        const hand = hit.clone(); hand.y += 0.1 + lift;
        hand.addScaledVector(pl.fwd, -0.04);
        h.setReach(side, hand, { weight: 1 });
        const m = pl.mallets[s];
        h.bonePosition(`${side}_Hand`, hv);
        tv.copy(hit); tv.y += mine ? lift * 0.6 : 0.04;
        dirV.copy(tv).sub(hv);
        const len = Math.max(0.12, dirV.length() + 0.1);
        dirV.normalize();
        m.position.copy(hv).addScaledVector(dirV, len * 0.5 - 0.1);
        qa.setFromUnitVectors(yAx, dirV); m.quaternion.copy(qa);
        m.userData.rod.scale.set(1, len, 1); m.userData.tip.position.y = len / 2;
      }
      h.setFingers('R', 'relaxed'); h.setFingers('L', 'relaxed');
    }
  }

  // ------------------------------------------------------------------------------------------------ heat shimmer (second pass)
  // The frame is copied to a texture and re-drawn through a few rising, wobbling quads above the flames: the picture really bends.
  let shimmer = null;
  function initShimmer(w, h) {
    try {
      const tex = new THREE.Texture(); tex.isFramebufferTexture = true; tex.image = { width: w, height: h }; tex.needsUpdate = true; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, depthTest: true,
        uniforms: { tScene: { value: tex }, uRes: { value: new THREE.Vector2(w, h) }, uTime: { value: 0 }, uAmp: { value: 0.0045 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform sampler2D tScene; uniform vec2 uRes; uniform float uTime; uniform float uAmp; varying vec2 vUv;
          void main(){
            vec2 sp = gl_FragCoord.xy / uRes;
            float fall = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y)) * smoothstep(0.0, 0.3, vUv.x) * (1.0 - smoothstep(0.7, 1.0, vUv.x));
            float w = sin(sp.y * 90.0 - uTime * 7.0 + sp.x * 30.0) + sin(sp.y * 47.0 - uTime * 5.3 - sp.x * 20.0) * 0.7;
            vec2 off = vec2(w * uAmp, 0.0) * fall;
            vec3 c = texture2D(tScene, sp + off).rgb;
            gl_FragColor = vec4(c, fall > 0.01 ? 1.0 : 0.0);
          }`,
      });
      const g = new THREE.PlaneGeometry(1, 1);
      const sc = new THREE.Scene(), quads = [];
      for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(g, mat); m.visible = false; sc.add(m); quads.push(m); }
      shimmer = { tex, mat, scene: sc, quads, w, h };
    } catch (e) { shimmer = null; console.warn('heat shimmer unavailable', e); }
  }
  function placeShimmer(srcs) {
    let k = 0;
    for (const s of srcs) {
      if (k >= shimmer.quads.length) break;
      const q = shimmer.quads[k++];
      q.visible = true; q.position.set(s.x, s.y + s.h * 0.5, s.z); q.quaternion.copy(camera.quaternion); q.scale.set(s.w, s.h, 1);
    }
    for (; k < shimmer.quads.length; k++) shimmer.quads[k].visible = false;
  }

  // ------------------------------------------------------------------------------------------------ sprite pass for the How to Play figure
  const SPR = { cache: new Map(), want: new Set() };
  const RX = 1.15, RY0 = -0.22, RY1 = 1.52;
  function renderSprite(lean, zoom) {
    if (!dancer || stage.contextLost) return null;
    const key = zoom ? 'z' + zoom.ty + zoom.h : Math.round(lean * 100);
    if (!zoom && SPR.cache.has(key)) return SPR.cache.get(key);
    const pw = 460, ph = 400;
    const hidden = [];
    scene.children.forEach((o) => { if (o !== dancer.root && o !== dancer.group && o.visible && !o.isLight) { o.visible = false; hidden.push(o); } });
    const dpr = renderer.getPixelRatio();
    renderer.setPixelRatio(1); renderer.setSize(pw, ph, false);
    const cam2 = new THREE.PerspectiveCamera(10, pw / ph, 1, 80);
    const D = 16, yaw = 24 * Math.PI / 180, pitch = 4 * Math.PI / 180;
    const hM = zoom ? zoom.h : (RY1 - RY0) * K; cam2.fov = 2 * Math.atan(hM / 2 / D) * 180 / Math.PI;
    const tgt = V(0, zoom ? zoom.ty : ((RY0 + RY1) / 2) * K, 0);
    cam2.position.set(tgt.x + D * Math.sin(yaw) * Math.cos(pitch), tgt.y + D * Math.sin(pitch), tgt.z + D * Math.cos(yaw) * Math.cos(pitch));
    cam2.lookAt(tgt); cam2.updateProjectionMatrix(); cam2.updateMatrixWorld(true);
    const p = enginePose(lean, 0, 0.6);
    const J = dancerJoints(p, {});
    dancer.setLook(LOOKS[0]);
    dancer.cloth.reset(); dancer.resetGait();
    dancer.apply({ p, att: { wobble: 0 }, dt: 0.016, rootX: 0, phase: 0.6, beat: 0, wind: 0, J });
    for (let i = 0; i < 24; i++) dancer.cloth.update(1 / 30, V());
    const prevClear = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    const fog = scene.fog; scene.fog = null;
    renderer.render(scene, cam2);
    scene.fog = fog;
    const out = globalThis.document.createElement('canvas'); out.width = pw; out.height = ph;
    out.getContext('2d').drawImage(renderer.domElement, 0, 0);
    renderer.setClearColor(prevClear, prevA);
    hidden.forEach((o) => { o.visible = true; });
    renderer.setPixelRatio(dpr); stage.resize(); camKey = '';
    dancer.cloth.reset(); dancer.resetGait();
    if (!zoom) SPR.cache.set(key, out);
    return out;
  }
  // the 2D docs call this with the same signature the old compositor had
  globalThis.__figure3d = {
    pending: false, off: false,
    draw(ctx, p, fx, fy, U) {
      const c = SPR.cache.get(Math.round(p.lean * 100));
      if (!c) { SPR.want.add(p.lean); return false; }
      ctx.drawImage(c, fx - RX * U, fy - RY1 * U, RX * 2 * U, (RY1 - RY0) * U);
      return true;
    },
  };

  // ------------------------------------------------------------------------------------------------ per frame
  let perfN = 0, perfSum = 0, perfLast = 0;
  function perfTick(now) {
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 22 && perfLevel < 3) {
        perfLevel++;
        if (perfLevel === 1) { renderer.shadowMap.enabled = false; stage.lights.key.castShadow = false; scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; }); }
        else if (perfLevel === 2) { renderer.setPixelRatio(Math.min(1.25, renderer.getPixelRatio())); shimmer = null; }
        else renderer.setPixelRatio(1);
        stage.invalidate();
      }
    }
  }

  function frame(game, view, nowOverride) {
    if (!P.ready || P.lost || stage.contextLost) return false;
    const G = game.getState();
    stage.setVisible(true);
    const now = nowOverride ?? globalThis.performance.now();
    const realDt = P.shot ? 1 / 60 : Math.min(0.05, Math.max(0, (now - lastNow) / 1000)); lastNow = now;
    T += realDt;
    const sc = G.scene, pl = sc === 'play' ? G.pl : null;
    const calm = !!G.prefs.calm;
    const cw = kitCanvas.clientWidth || canvas.clientWidth || 720, ch = kitCanvas.clientHeight || canvas.clientHeight || 1280;
    if (cw !== P.cw || ch !== P.ch) { P.cw = cw; P.ch = ch; stage.resize(); crowd && crowd.invalidate && crowd.invalidate(); }
    const L = layoutFor(view.width, view.height);
    let bx, gy, U;
    if (pl) { bx = L.play.bx; gy = L.play.gy; U = L.play.U; }
    else {
      // title and the screens behind the documents: the dancer is the hero, as big as the title lettering and the buttons leave room for
      const T0 = L.title, S0 = L.S, hs = heroScene(T0, L);
      const top = (T0.titleY + T0.size * 0.95), bottomY = T0.hero.y + T0.hero.h + (L.mode === 'wide' ? 0 : 6);
      gy = Math.min(bottomY - 6, Math.max(hs.gy, top + 220));
      U = Math.max(hs.U, Math.min((gy - top) / 1.18, S0.w * (L.mode === 'wide' ? 0.3 : 0.4)));
      bx = L.mode === 'wide' ? T0.hero.x + T0.hero.w * 0.55 : S0.x + S0.w * 0.56;
    }
    if (SPR.want.size) { for (const l of SPR.want) renderSprite(l); SPR.want.clear(); }
    const key = `${cw}x${ch}|${view.width}x${view.height}|${bx.toFixed(1)},${gy.toFixed(1)},${U.toFixed(1)}`;
    if (key !== camKey) { camKey = key; fitCamera(cw, ch, view.width, view.height, bx, gy, U); crowd && crowd.invalidate && crowd.invalidate(); }
    const att = pl ? pl.att : G.hero.att;
    const look = LOOKS[(pl ? pl.look : G.hero.look) % LOOKS.length];
    const barH = pl ? pl.barShown : G.hero.bar;
    const beat = pl ? pl.beatT / BEAT : G.t * 104 / 60;
    const gustV = gust(T, 0);
    const info = driveDancer(att, look, calm, realDt, beat);
    const round = pl ? pl.round : G.hero.round;
    bar.setVariant(bar.variantFor(round));
    bar.update(realDt, { calm, h: barH * K, wind: gustV });
    driveBand(realDt, beat, calm);
    if (crowd) { crowd.setExcitement && crowd.setExcitement(0.3 + 0.35 * (att.phase === 'run' ? 1 : 0)); crowd.update(realDt, camera); }
    torches.forEach((t, i) => {
      const f = 0.8 + 0.2 * Math.sin(T * (12 + i * 1.3) + i * 2.0) + 0.1 * Math.sin(T * 27 + i * 4.1);
      t.flame.scale.set(0.24 * (0.9 + 0.2 * f), 0.5 * f * (1 + gustV * 0.15), 1); t.flame.material.rotation = 0.06 * Math.sin(T * 9 + i);
      t.flame2.scale.set(0.18 * (0.9 + 0.2 * f), 0.36 * (1.1 - f * 0.1), 1);
      t.halo.material.opacity = 0.42 + 0.22 * f;
      if (t.light) t.light.intensity = 4.4 * (0.82 + 0.28 * f);
      if (!calm && hash(T * 40 + i) < 0.18) emberFx.emit(t.group.position.x + (hash(T * 7 + i) - 0.5) * 0.05, t.tipY + 0.15, t.group.position.z, (hash(T + i) - 0.5) * 0.15 + gustV * 0.1, 0.6 + hash(T * 3 + i) * 0.6, (hash(T * 5 + i) - 0.5) * 0.15, 1.3, 0.05, 0.01, 1, 0.55, 0.15, 0.85);
    });
    for (const p of palms) { const c = p.userData.crown; c.userData.uTime.value = T; c.userData.uWind.value = 0.35 + gustV * 0.9; }
    sky.material.uniforms.uTime.value = T; sea.material.uniforms.uTime.value = T;
    for (const pr of prints) { if (pr.age < 40) { pr.age += realDt; const a = Math.max(0, 0.55 * (1 - pr.age / 7)); pr.m.material.opacity = a; if (a <= 0) pr.m.visible = false; } }
    const vhp = renderer.domElement.height / (2 * Math.tan(CAM.fov * Math.PI / 360));
    for (const fx of [sandFx, emberFx, flameFx, confetti]) { fx.mat.uniforms.uScale.value = vhp; fx.update(realDt, gustV * 0.3); }
    // the hint hologram: the lean that just fits
    const hint = !!(pl && (pl.hint || (pl.ai && (pl.ai.phase === 'reveal' || pl.ai.phase === 'think') && pl.ai.plan)));
    ghost.visible = hint;
    if (hint) {
      const gl = pl.ai && pl.ai.plan ? pl.ai.plan.target : P.hintLean ?? 0.6;
      const gp = enginePose(gl, 0, 0.6), J = dancerJoints(gp, {});
      const pair = [[J.hip, J.sh], [J.sh, J.neck], [J.neck, J.head], [J.hip, J.nK], [J.nK, J.nA], [J.hip, J.fK], [J.fK, J.fA], [J.sh, J.nE], [J.nE, J.nH], [J.sh, J.fE], [J.fE, J.fH]];
      const zOf = [0, 0, 0, 0.1, 0.1, -0.1, -0.1, 0.22, 0.3, -0.22, -0.3];
      pair.forEach(([a, b], i) => {
        const seg = ghostSegs[i];
        const A = V(att.x * K + a.x * K, a.y * K, zOf[i] * 0.6), Bv = V(att.x * K + b.x * K, b.y * K, zOf[i]);
        const mid = A.clone().add(Bv).multiplyScalar(0.5), d = Bv.clone().sub(A), l = d.length();
        seg.m.position.copy(mid); seg.m.quaternion.setFromUnitVectors(yAx, d.normalize()); seg.m.scale.set(1, Math.max(0.01, l - seg.r * 1.5), 1);
      });
      ghostSegs.head.position.set(att.x * K + J.head.x * K, J.head.y * K, 0);
    }
    // overlay anchors for the 2D layer
    const poleTop = Math.max(barH * K + 0.3, 1.0) + 0.1;
    P.overlay = { barTag: project(0, poleTop, BAR_HALF), ready: info ? project(att.x * K, 1.95, 0) : null };
    if (pl && pl.shake > 0 && !calm) { camera.position.x += Math.sin(T * 83) * 0.03 * pl.shake; camera.position.y += Math.cos(T * 71) * 0.025 * pl.shake; }
    stage.setShadowTarget(att.x * K * 0.3, 0, 0);
    stage.lights.rim.position.set(-3, 3.2, 8);
    camera.updateMatrixWorld(true);
    renderer.setClearColor(0x000000, 1);
    renderer.render(scene, camera);
    stage.stats.renders++;
    const wantShimmer = !calm && perfLevel < 2 && quality !== 'low';
    if (wantShimmer) {
      const bw = renderer.domElement.width, bh = renderer.domElement.height;
      if (!shimmer || shimmer.w !== bw || shimmer.h !== bh) initShimmer(bw, bh);
      if (shimmer) {
        const srcs = [];
        if (bar.S.fire > 0.3 && !bar.S.fallen) srcs.push({ x: 0, y: bar.S.y + 0.15, z: 0, w: 2.1, h: 1.6 });
        else if (bar.S.variant === 'torch') for (const sd of [-1, 1]) srcs.push({ x: 0, y: bar.S.y, z: sd * BAR_HALF, w: 0.7, h: 1.2 });
        for (const t of torches.slice(0, 4)) srcs.push({ x: t.group.position.x, y: t.tipY + 0.15, z: t.group.position.z, w: 0.55, h: 1.5 });
        try {
          renderer.copyFramebufferToTexture(shimmer.tex, new THREE.Vector2(0, 0));
          shimmer.mat.uniforms.uTime.value = T;
          placeShimmer(srcs);
          const ac = renderer.autoClear; renderer.autoClear = false;
          renderer.render(shimmer.scene, camera);
          renderer.autoClear = ac;
        } catch (e) { shimmer = null; console.warn('heat shimmer off', e && e.message); }
      }
    }
    stage.dirty = false;
    perfTick(now);
    return true;
  }
  P.frame = frame;
  P.debug = { get dancer() { return dancer; }, players, bar, get crowd() { return crowd; } };
  P.spriteURL = (l, zoom) => { const c = renderSprite(l, zoom); return c ? c.toDataURL('image/png') : null; };

  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; shimmer = null; SPR.cache.clear(); camKey = ''; stage.resize(); stage.invalidate(); });

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      let ok = false;
      try { ok = frame(game, view); } catch (e) { if (!P.err) { P.err = e; console.warn('3D frame failed', e); } }
      view.gl3d = ok; view.overlay = P.overlay; P.dbg = { ok, ready: P.ready, w: view.width, h: view.height, n: (P.dbg ? P.dbg.n : 0) + 1 }; view.gl3dPending = !ok && !P.ready && !P.failed;
      if (!ok) { try { stage.setVisible(false); } catch { /* ignore */ } }
      r(ctx, view);
    };
    return game;
  };
  return P;
}

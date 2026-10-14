// Pitch Pot 3D presenter. It READS game.getState() (the match, the board, the flight track, the layout) and never writes back. The WebGL canvas sits behind
// the kit's transparent 2D canvas: a lacquered garden pavilion terrace, a bronze touhu vase, bamboo arrows in a real arc with flutter and rattle, a robed
// thrower, golden-hour light. The 2D layer draws only the HUD, text and buttons. If WebGL is missing or the context is lost, state.has3d turns false and
// every screen paints the flat 2D art again; on restore it flips back without a reload.
// Animation advances by the difference of the sim clock (state.t), so it pauses with the game and is reproducible in headless runs.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { createStage } from '../vendor3d/index.js';
import { makeVase, makeArrow, setArrowSide, makeMat, CM, TEAM3 } from './models.js';
import { buildWorld } from './world.js';
import { createThrower, followBody, V } from './thrower.js';
import { FR, playLayout } from '../src/layout.js';
import { HAND, ARROW, RIM_Y, guidePath, crossingSpread, resolveThrow, applyThrow, newBoard, solveSpeed } from '../src/sim.js';
import { baseSigma, isHuman, flightFrame } from '../src/view.js';
import { cameraFor } from '../src/art.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const TIERS = ['high', 'medium', 'low'];
const SHADOW = { high: 2048, medium: 1024, low: 0 };

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { stage: null, wrap: (g) => g, busy: () => false };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  let tierIx = Math.max(0, TIERS.indexOf(quality));
  const qm = /[?&]q=(low|medium|high)/.exec(location.search);
  if (qm) tierIx = TIERS.indexOf(qm[1]);
  else { const nav = globalThis.navigator || {}; if ((nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3)) tierIx = Math.max(tierIx, 1); }
  const stage = createStage({ canvas, quality: TIERS[tierIx], dprCap: 2, lighting: 'day', transparent: false });
  if (!stage.supported) { canvas.remove(); return noop; }
  const { scene, camera, renderer } = stage;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  // ---- lights: stage's own are replaced by a golden-hour rig (warm key from the low sun, cool fill, rim from behind) ---------------------------
  for (const l of [stage.lights.hemi, stage.lights.key, stage.lights.key.target, stage.lights.rim]) scene.remove(l);
  const rig = B.lightingRig(scene, 'duskOutdoor', {
    renderer, shadow: SHADOW[TIERS[tierIx]] || 0, extent: 4.2, fog: { near: 7, far: 30 }, target: [1.6, 0.6, 0],
    overrides: { bg: 0xcdb594, fog: 0xcdb594, key: 0xffcf90, keyI: 3.1, keyPos: [-3.5, 6.0, 5.5], hemi: 0.42, hemiSky: 0xffe2b8, hemiGround: 0x3a281a, fill: 0x9db4e8, fillI: 0.35, rim: 0xffb070, rimI: 1.6, rimPos: [5, 4, -6], exposure: 0.88, env: 0.5 },
  });
  scene.environmentIntensity = 0.55;

  const world = buildWorld(scene, { D: 2.4, quality: TIERS[tierIx] });
  const vase = makeVase(); scene.add(vase);
  const mat = makeMat(); scene.add(mat);
  const lineMat = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.006, 1.6), new THREE.MeshStandardMaterial({ color: '#d8a54a', metalness: 0.85, roughness: 0.3 }));
  lineMat.position.set(0, 0.003, 0); scene.add(lineMat);
  const inGlow = new THREE.PointLight(0xffc070, 0, 1.2, 1.6); scene.add(inGlow);
  const vaseKey = new THREE.PointLight(0xffdca8, 1.5, 3.2, 1.5); scene.add(vaseKey);

  // ---- reflections: mirrored copies of the vase, mat and arrows sit under the (slightly transparent) polished floor
  const mirror = new THREE.Group(); mirror.scale.y = -1; scene.add(mirror);
  const mVase = vase.clone(true); mirror.add(mVase);
  const mMat = mat.clone(true); mirror.add(mMat);
  mirror.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  { const floor = world.root.children[0]; if (floor && floor.material) { floor.material.transparent = true; floor.material.opacity = 0.84; floor.renderOrder = 4; }
    const base = new THREE.Mesh(new THREE.PlaneGeometry(22, 9), new THREE.MeshBasicMaterial({ color: '#150d08' })); base.rotation.x = -Math.PI / 2; base.position.set(1.2, -0.7, 0.9); scene.add(base); }

  // ---- arrows: a pool; each is a Group built for a side colour -----------------------------------------------------------------------------
  const pool = [];
  const mpool = [];
  const takeArrow = (i, side) => {
    while (pool.length <= i) { const a = makeArrow(0); a.visible = false; scene.add(a); pool.push(a); const m2 = makeArrow(0); m2.visible = false; m2.traverse((o) => { o.castShadow = false; }); mirror.add(m2); mpool.push(m2); }
    const a = pool[i]; if (a.userData.side !== side) { setArrowSide(a, side); setArrowSide(mpool[i], side); } return a;
  };
  const setArrow = (a, x, y, th, o = {}) => {
    a.visible = true; a.position.set(x * CM, y * CM, o.z || 0);
    a.rotation.set(o.roll || 0, o.yaw || 0, th, 'ZYX');
  };

  // ---- guide beads ---------------------------------------------------------------------------------------------------------------------------
  const beadGeo = new THREE.SphereGeometry(0.011, 8, 6);
  function makeBeads(n, color) {
    const m = new THREE.InstancedMesh(beadGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, fog: false, depthWrite: false }), n);
    m.frustumCulled = false; m.count = 0; scene.add(m); return m;
  }
  const beadsAim = makeBeads(70, '#ff9d84'), beadsHint = makeBeads(70, '#7dffb0'), beadsPlan = [0, 1, 2, 3].map((i) => makeBeads(70, i === 0 ? '#7dffb0' : '#ffffff'));
  const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 1, 4, 8), new THREE.MeshBasicMaterial({ color: '#ff9d84', transparent: true, opacity: 0.95, fog: false, depthWrite: false }));
  bar.rotation.z = Math.PI / 2; bar.visible = false; scene.add(bar);
  const _m4 = new THREE.Matrix4();
  function fillBeads(m, a, v, D) {
    const g = guidePath(a, v, D, 0.025, 3);
    let n = 0;
    for (let i = 0; i < g.length && n < m.instanceMatrix.count; i++) { const p = g[i]; if (p.ty < 0) break; _m4.makeTranslation(p.tx * CM, p.ty * CM, 0.02); m.setMatrixAt(n++, _m4); }
    m.count = n; m.instanceMatrix.needsUpdate = true; m.visible = true;
  }

  // ---- particles: additive sparks + soft dust (one shaded Points each), petals (instanced) ---------------------------------------------------------
  const PMAX = 220;
  function makePoints(additive) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(PMAX * 3), col = new Float32Array(PMAX * 4), size = new Float32Array(PMAX);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aCol', new THREE.BufferAttribute(col, 4)); geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 600 } },
      vertexShader: 'attribute vec4 aCol; attribute float aSize; varying vec4 vC; uniform float uScale; void main(){ vC=aCol; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uScale/ -mv.z; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying vec4 vC; void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d)*2.0; float a=smoothstep(1.0,0.0,r); a*=a; gl_FragColor=vec4(vC.rgb, vC.a*a); }',
    });
    const pts = new THREE.Points(geo, m); pts.frustumCulled = false; scene.add(pts);
    return { pts, geo, pos, col, size, mat: m, list: [] };
  }
  const sparks = makePoints(true), dust = makePoints(false);
  function emit(sys, p) { if (sys.list.length >= PMAX) sys.list.shift(); sys.list.push(p); }
  function stepPts(sys, dt) {
    const L = sys.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i]; p.life += dt;
      if (p.life >= p.max) { L.splice(i, 1); continue; }
      p.vy -= (p.g ?? 3.5) * dt; const dr = p.drag ?? 1.2; p.vx *= 1 - dr * dt; p.vz *= 1 - dr * dt; p.vy *= 1 - dr * 0.4 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    for (let i = 0; i < PMAX; i++) {
      const p = L[i];
      if (!p) { sys.size[i] = 0; sys.col[i * 4 + 3] = 0; continue; }
      const k = p.life / p.max;
      sys.pos[i * 3] = p.x; sys.pos[i * 3 + 1] = p.y; sys.pos[i * 3 + 2] = p.z;
      sys.col[i * 4] = p.r; sys.col[i * 4 + 1] = p.g2; sys.col[i * 4 + 2] = p.b; sys.col[i * 4 + 3] = (1 - k) * (p.a ?? 1);
      sys.size[i] = p.s * (p.grow ? 0.6 + k * p.grow : 1 - k * 0.5);
    }
    sys.geo.attributes.position.needsUpdate = true; sys.geo.attributes.aCol.needsUpdate = true; sys.geo.attributes.aSize.needsUpdate = true;
  }
  const rgb = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
  // FX randomness is presentation only (never feeds the sim): a tiny seeded generator keeps screenshots reproducible
  let fxs = 12345; const frnd = () => { fxs = (fxs * 1664525 + 1013904223) >>> 0; return fxs / 4294967296; };
  function burst(sys, x, y, z, n, o = {}) {
    const [r, g, b] = rgb(o.color || '#fff0b0');
    for (let i = 0; i < n; i++) {
      const a = frnd() * TAU, e = (frnd() - 0.3) * 1.4, sp = (o.speed ?? 1.6) * (0.35 + frnd() * 0.9);
      emit(sys, { x, y, z, vx: Math.cos(a) * Math.cos(e) * sp, vy: Math.sin(e) * sp * (o.up ?? 1) + (o.lift ?? 0.6), vz: Math.sin(a) * Math.cos(e) * sp * 0.5, life: 0, max: (o.life ?? 0.7) * (0.6 + frnd() * 0.8), r, g2: g, b, a: o.alpha ?? 1, s: (o.size ?? 0.05) * (0.6 + frnd() * 0.8), g: o.gravity, drag: o.drag, grow: o.grow });
    }
  }
  const NP = 36, petalGeo = new THREE.PlaneGeometry(0.05, 0.03);
  const petals = new THREE.InstancedMesh(petalGeo, new THREE.MeshStandardMaterial({ color: '#ffd9d9', side: THREE.DoubleSide, roughness: 0.6, emissive: '#5a3030', emissiveIntensity: 0.35 }), NP);
  petals.frustumCulled = false; scene.add(petals);
  const petalState = Array.from({ length: NP }, (_, i) => ({ x: hash(i) * 7 - 2, y: hash(i + 3) * 4, z: hash(i + 7) * 3 - 1.2, ph: hash(i + 11) * TAU, burst: 0, bx: 0, by: 0, bvx: 0, bvy: 0 }));
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
  function stepPetals(t, dt, cx) {
    for (let i = 0; i < NP; i++) {
      const p = petalState[i];
      if (p.burst > 0) {
        p.burst -= dt; p.bvy -= 1.4 * dt; p.bvx *= 1 - 1.5 * dt; p.bvy *= 1 - 1.1 * dt; p.bx += p.bvx * dt; p.by += p.bvy * dt;
        _p.set(p.bx, p.by, 0.1 + Math.sin(t * 5 + p.ph) * 0.05);
        if (p.burst <= 0) { p.x = cx + hash(i + t) * 5 - 2.5; p.y = 3.6; }
      } else {
        p.y -= (0.16 + hash(i) * 0.12) * dt; p.x += (Math.sin(t * 0.7 + p.ph) * 0.18 + 0.1) * dt;
        if (p.y < -0.05) { p.y = 3.6; p.x = cx + hash(i + t) * 6 - 3; }
        _p.set(p.x, p.y, p.z + Math.sin(t * 0.5 + p.ph) * 0.2);
      }
      _e.set(t * 1.7 + p.ph, t * 1.1 + p.ph * 2, t * 2.3 + p.ph); _q.setFromEuler(_e);
      _m4.compose(_p, _q, _s); petals.setMatrixAt(i, _m4);
    }
    petals.instanceMatrix.needsUpdate = true;
  }
  function petalBurst(x, y) {
    for (let i = 0; i < 18; i++) { const p = petalState[(i * 2) % NP]; const a = frnd() * TAU, sp = 0.6 + frnd() * 1.2; p.burst = 1.7 + frnd() * 0.8; p.bx = x; p.by = y; p.bvx = Math.cos(a) * sp; p.bvy = Math.abs(Math.sin(a)) * sp + 0.6; }
  }

  // ---- throwers ----------------------------------------------------------------------------------------------------------------------------
  const throwers = [];
  const KITS = [{ top: '#a9281c', trim: '#f2c14e' }, { top: '#1f7f66', trim: '#f4ecd0' }];
  async function addThrower(side, g) {
    const T = await createThrower({ g, kit: KITS[side], skin: side ? 'light' : 'tan', hair: 'black', quality: TIERS[tierIx] });
    scene.add(T.root); stage.track(T.h);
    T.h.play('idle'); T.side = side; T.root.visible = false;
    T.pos.set(-0.3, 0, 0); throwers[side] = T; return T;
  }
  let ready = false;
  // the two throwers stream in while the menu is already playable (the pavilion and the vase show immediately)
  Promise.all([addThrower(0, 'm'), addThrower(1, 'f')]).then(() => { ready = true; stage.invalidate(); }).catch((e) => console.warn('throwers unavailable', e));

  // ---- camera ---------------------------------------------------------------------------------------------------------------------------------
  // The 2D layout maps world (cm) -> screen px by cam = { ox, cx, s, floorY }; the camera reproduces exactly that mapping on the plane z = 0 so the
  // 2D float texts, banners and the scope frame stay glued to the 3D scene.
  const FOV = 24;
  function placeCamera(cam, o = {}) {
    const spm = cam.s * 100, H = FR.h, W = FR.w;
    const dist = (H / spm) / (2 * Math.tan((FOV * Math.PI) / 360));
    const tx = cam.cx * CM + (W / 2 - cam.ox) / spm, ty = (cam.floorY - H / 2) / spm;
    const yaw = o.yaw ?? 0.2, pitch = o.pitch ?? 0.1;
    camera.fov = FOV; camera.aspect = W / H; camera.near = Math.max(0.5, dist - 6); camera.far = dist + 60;
    camera.position.set(tx + Math.sin(yaw) * Math.cos(pitch) * dist, ty + Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
    camera.lookAt(tx, ty, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    if (scene.fog) { scene.fog.near = dist + 1.5; scene.fog.far = dist + 60; }
  }
  const cam2 = new THREE.PerspectiveCamera(24, 1, 0.05, 80);

  // ---- state ---------------------------------------------------------------------------------------------------------------------------------
  let lastT = null, lost = false, gameRef = null;
  let vaseWob = 0, vaseWobPh = 0, glowK = 0, flutter = 0, rollSpin = 0, simT = 0;
  let firedFor = null, firedIdx = 0, enteredFired = false, endFired = false;
  const hero = { board: newBoard(), res: null, t: 0, seed: 7, phase: 'wait', wait: 0.8, n: 0, fired: 0, side: 0, flutter: 0, spin: 0 };
  const heroAims = [[63, 0], [58, 0], [70, 0], [61, 0.7], [66, 0]];
  let frames = 0, slow = 0, lastReal = 0;
  const dbg = /[?&]dbg/.test(location.search);

  function frame(game) {
    const s = game.getState();
    let dt = lastT === null ? 0 : s.t - lastT; lastT = s.t; dt = clamp(dt, 0, 0.1);
    simT = s.t;
    if (lost) return;
    const t = s.t;
    // quality watchdog: if the real frame time stays high the tier drops one step (shadow maps, pixel ratio)
    const now = performance.now(); const real = lastReal ? now - lastReal : 16; lastReal = now;
    if (real > 40 && real < 500) slow++; else slow = Math.max(0, slow - 1);
    if (slow > 50 && tierIx < TIERS.length - 1) { tierIx++; slow = 0; stage.setQuality(TIERS[tierIx]); rig.key.castShadow = !!SHADOW[TIERS[tierIx]]; stage.invalidate(); }
    const play = s.scene === 'play' && s.m;
    const m = s.m;
    const D = play ? m.D : 240;
    vase.position.set(D * CM, 0, 0); mat.position.set(D * CM, 0.0, 0);
    // ---- camera
    if (play) {
      const L = playLayout();
      const cam = cameraFor(L.scene, D, s.camZ || 0), e = smooth(s.camZ || 0);
      placeCamera(cam, { yaw: 0.26 - 0.1 * e, pitch: 0.3 - 0.1 * e });
    } else {
      const hr = (s.scene === 'title' && s.hero) || { x: 0, y: FR.h * 0.01, w: FR.w, h: FR.h * (FR.land ? 0.8 : 0.34) };
      const land = hr.w > hr.h * 1.15;
      const sH = Math.max(1.4, Math.min(hr.h / 96, hr.w / (land ? 112 : 118)));
      const drift = Math.sin(t * 0.22) * 0.08;
      placeCamera({ ox: hr.x + hr.w * (land ? 0.6 : 0.64), cx: D - 6, s: sH, floorY: hr.y + hr.h * 0.9 }, { yaw: 0.34 + drift, pitch: 0.14 });
    }
    rig.key.target.position.set(D * CM * 0.5, 0.6, 0); rig.key.position.set(D * CM * 0.5 - 3.5, 6.5, 6);
    // ---- arrows
    let used = 0;
    const flying = play && m.fl && m.ph === 'fly' ? m.fl : null;
    beadsAim.visible = false; beadsHint.visible = false; bar.visible = false; for (const b of beadsPlan) b.visible = false;
    if (play) {
      m.board.arrows.forEach((a, i) => { const ar = takeArrow(used++, a.side); setArrow(ar, a.x, a.y, a.th, { z: (hash(i * 13 + 1) - 0.5) * (a.y > 3 ? 0.012 : 0.1), roll: hash(i + 5) * TAU }); });
      const aimPhase = m.ph === 'aim' || m.ph === 'think' || m.ph === 'reveal' || m.ph === 'act';
      if (aimPhase && m.left[m.turn] > 0 && !m.fl) {
        const al = (m.aim.a * Math.PI) / 180, ar = takeArrow(used++, m.turn);
        setArrow(ar, HAND.x + Math.cos(al) * ARROW.hl, HAND.y + Math.sin(al) * ARROW.hl, al, { roll: Math.sin(t * 1.3) * 0.2, yaw: Math.sin(t * 1.9) * 0.01 });
      }
      if (flying) {
        const res = flying.res;
        if (firedFor !== res) { firedFor = res; firedIdx = 0; enteredFired = false; endFired = false; flutter = 0.07; rollSpin = 0; }
        const f = flightFrame(flying), end = flying.t >= res.dur;
        flutter *= Math.exp(-dt * 2.2); rollSpin += dt * 11;
        const ar = takeArrow(used++, res.side);
        if (!end) setArrow(ar, f.x, f.y, f.th, { roll: rollSpin, yaw: Math.sin(t * 38) * flutter + Math.sin(t * 17) * flutter * 0.5 });
        else ar.visible = false;
        const cs = res.contacts;
        while (firedIdx < cs.length && cs[firedIdx].t <= flying.t) {
          const c = cs[firedIdx++], px = c.x * CM, py = c.y * CM, fo = clamp(c.force || 0.5, 0.1, 2);
          if (c.kind === 'bronze') {
            burst(sparks, px, py, 0.02, 4 + Math.round(fo * 5), { color: '#ffe9a8', speed: 1.4, size: 0.035, life: 0.45, gravity: 4 });
            vaseWob = Math.min(1, vaseWob + 0.3 + fo * 0.35); vaseWobPh = t; glowK = Math.min(1, glowK + 0.5);
            flutter = Math.min(0.14, flutter + 0.03 * fo);
          } else if (c.kind === 'floor') {
            burst(dust, px, 0.015, 0.02, 5 + Math.round(fo * 4), { color: '#d9c7a0', speed: 0.5, size: 0.11, life: 0.9, gravity: -0.1, drag: 1.8, alpha: 0.5, grow: 1.4, up: 0.5, lift: 0.1 });
            flutter = Math.min(0.14, flutter + 0.04 * fo);
          } else { burst(sparks, px, py, 0.02, 3, { color: '#ffe0a0', speed: 0.6, size: 0.025, life: 0.25 }); flutter = Math.min(0.14, flutter + 0.02 * fo); }
        }
        if (!enteredFired && res.entered >= 0 && res.status !== 'miss' && flying.t >= res.entered) { enteredFired = true; glowK = 1; }
        if (!endFired && flying.t >= res.dur) {
          endFired = true;
          if (res.status !== 'miss') {
            petalBurst(D * CM, (RIM_Y + 8) * CM);
            burst(sparks, D * CM, (RIM_Y + 4) * CM, 0.05, 26, { color: '#ffd24a', speed: 2.2, size: 0.045, life: 0.9, gravity: 2 });
            burst(sparks, D * CM, (RIM_Y + 4) * CM, 0.05, 10, { color: '#fff6c8', speed: 1.2, size: 0.07, life: 0.5 }); glowK = 1;
          }
        }
      } else { firedFor = null; flutter = 0; }
      const guide = s.settings.guide;
      if (guide && aimPhase && !m.fl && ((m.ph === 'aim' && isHuman(m, m.turn)) || m.ph === 'act' || m.ph === 'reveal')) {
        const col = TEAM3[m.turn].light; beadsAim.material.color.set(col);
        fillBeads(beadsAim, m.aim.a, m.aim.v, D);
        const sp = crossingSpread(m.aim.a, m.aim.v, D, baseSigma(s, m.turn));
        if (sp) { const w = Math.max(0.04, sp.sd * 3 * CM); bar.visible = true; bar.position.set(sp.x * CM, (RIM_Y + 4) * CM, 0.03); bar.scale.set(1, w, 1); bar.material.color.set(col); }
      }
      if (s.hint && m.ph === 'aim') fillBeads(beadsHint, s.hint.a, s.hint.v, D);
      if (m.ph === 'reveal' && m.plan && m.plan.top) m.plan.top.forEach((c, i) => { if (beadsPlan[i]) fillBeads(beadsPlan[i], c.a, c.v, D); });
    } else {
      used = heroStep(dt, D, used);
    }
    for (let i = used; i < pool.length; i++) pool[i].visible = false;
    for (let i = 0; i < pool.length; i++) { const a = pool[i], b = mpool[i]; b.visible = a.visible; if (a.visible) { b.position.copy(a.position); b.rotation.copy(a.rotation); } }
    mVase.position.copy(vase.position); mVase.rotation.copy(vase.rotation); mMat.position.copy(mat.position);
    // ---- vase: ring after a bronze hit, interior glow
    vaseWob *= Math.exp(-dt * 4.5);
    vase.rotation.z = Math.sin((t - vaseWobPh) * 70) * 0.012 * vaseWob;
    glowK *= Math.exp(-dt * 2.4);
    vaseKey.position.set(D * CM - 0.55, 0.85, 1.3);
    inGlow.position.set(D * CM, (RIM_Y - 10) * CM, 0.05); inGlow.intensity = glowK * 2.2;
    vase.userData.interiorShade.material.opacity = 0.55 - 0.35 * glowK;
    if (ready) updateThrowers(s, play ? m : null, dt, t);
    world.update(t, dt, camera);
    stepPts(sparks, dt); stepPts(dust, dt);
    stepPetals(t, dt, D * CM * 0.5);
    const pxScale = (renderer.domElement.height / (2 * Math.tan((FOV * Math.PI) / 360)));
    sparks.mat.uniforms.uScale.value = pxScale; dust.mat.uniforms.uScale.value = pxScale;
    stage.update(dt, { renderNow: false });
    for (const T of throwers) if (T && T.root.visible) followBody(T, dt, T.vel);
    renderer.setScissorTest(false);
    renderer.render(scene, camera);
    if (play && m.ph === 'aim' && isHuman(m, m.turn) && !s.paused && !s.hint && playLayout().sheet && !s.pauseMenu) renderScope(D);
    frames++;
    if (dbg) window.__pp = { tier: TIERS[tierIx], frames, real };
  }

  function renderScope(D) {
    const r = playLayout().sheet, cw = renderer.domElement.width, ch = renderer.domElement.height, k = cw / FR.w;
    const win = 52, sc = Math.min(r.h / (win + 4), r.w / 72);
    const dist = (r.h / (sc * 100)) / (2 * Math.tan((24 * Math.PI) / 360));
    cam2.aspect = r.w / r.h; cam2.fov = 24; cam2.updateProjectionMatrix();
    const tx = (D - 4) * CM, ty = 0.38;
    cam2.position.set(tx + Math.sin(0.12) * dist, ty + 0.08 * dist, Math.cos(0.12) * dist); cam2.lookAt(tx, ty, 0);
    const pr = 1; // viewport/scissor are in CSS pixels (three multiplies by the pixel ratio)
    const kk = (cw / renderer.getPixelRatio()) / FR.w, hh = ch / renderer.getPixelRatio();
    renderer.setScissorTest(true);
    renderer.setViewport(r.x * kk * pr, hh - (r.y + r.h) * kk, r.w * kk, r.h * kk); renderer.setScissor(r.x * kk * pr, hh - (r.y + r.h) * kk, r.w * kk, r.h * kk);
    renderer.clearDepth();
    renderer.render(scene, cam2);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cw / renderer.getPixelRatio(), hh);
    void k;
  }

  // ---- menu hero: real sim throws in a loop (the same physics as the game), bounce-outs and all ----------------------------------------------------
  function heroStep(dt, D, used) {
    const h = hero;
    h.board.arrows.forEach((a, i) => { const ar = takeArrow(used++, a.side); setArrow(ar, a.x, a.y, a.th, { z: (hash(i * 13 + 1) - 0.5) * 0.012, roll: hash(i + 5) * TAU }); });
    if (h.phase === 'wait') {
      h.wait -= dt;
      if (h.wait <= 0) {
        if (h.board.arrows.length >= 4) h.board = newBoard();
        const [a, jit] = heroAims[h.n++ % heroAims.length], v = solveSpeed(a, D, RIM_Y + 1.5) || 600;
        h.side = h.n % 2; h.res = resolveThrow(h.board, D, h.side, { a, v: v * (1 + jit * 0.03) }, { a: 0.7, v: 0.9 }, h.seed += 7919, true);
        h.t = 0; h.phase = 'fly'; h.fired = 0; h.flutter = 0.07; h.spin = 0;
      }
    } else if (h.phase === 'fly') {
      h.t += dt; h.flutter *= Math.exp(-dt * 2.2); h.spin += dt * 11;
      const res = h.res, i = Math.min(res.track.length - 1, Math.floor(h.t * 60)), j = Math.min(res.track.length - 1, i + 1), k = h.t * 60 - i, A = res.track[i], Bb = res.track[j];
      const x = lerp(A[0], Bb[0], k), y = lerp(A[1], Bb[1], k), th = lerp(A[2], Bb[2], k);
      while (h.fired < res.contacts.length && res.contacts[h.fired].t <= h.t) {
        const c = res.contacts[h.fired++];
        if (c.kind === 'bronze') { burst(sparks, c.x * CM, c.y * CM, 0.02, 6, { color: '#ffe9a8', speed: 1.3, size: 0.03, life: 0.4 }); vaseWob = Math.min(1, vaseWob + 0.5); vaseWobPh = simT; glowK = Math.min(1, glowK + 0.4); h.flutter = Math.min(0.14, h.flutter + 0.04); }
        else if (c.kind === 'floor') { burst(dust, c.x * CM, 0.015, 0.02, 6, { color: '#d9c7a0', speed: 0.5, size: 0.1, life: 0.9, gravity: -0.1, drag: 1.8, alpha: 0.5, grow: 1.4, up: 0.5, lift: 0.1 }); }
      }
      if (h.t < res.dur) { const ar = takeArrow(used++, h.side); setArrow(ar, x, y, th, { roll: h.spin, yaw: Math.sin(simT * 38) * h.flutter }); }
      else {
        applyThrow(h.board, res); h.phase = 'wait'; h.wait = 1.6;
        if (res.status !== 'miss') { petalBurst(D * CM, (RIM_Y + 8) * CM); burst(sparks, D * CM, (RIM_Y + 4) * CM, 0.05, 18, { color: '#ffd24a', speed: 2, size: 0.04, life: 0.8, gravity: 2 }); glowK = 1; }
      }
    }
    return used;
  }

  // ---- throwers: stand at the line (active) or wait behind (the other), hand at the sim's HAND point, a follow-through on release ----------------
  const LINE = V(-0.34, 0, 0.02), WAIT = V(-1.05, 0, -0.95);
  const _bp = V();
  function updateThrowers(s, m, dt, t) {
    for (const T of throwers) {
      if (!T) continue;
      const side = T.side, solo = m && m.cfg.mode === 'solo';
      const show = !!m && (side === 0 || !solo);
      T.root.visible = show; if (!show) continue;
      // the next thrower starts walking in while the last arrow settles, so the line is never empty when the turn begins
      let who = m.turn;
      if (m.cfg.mode !== 'solo' && (m.ph === 'settle' || (m.ph === 'fly' && m.fl && m.fl.t > 1.0)) && m.left[1 - m.turn] > 0) who = 1 - m.turn;
      const active = who === side && m.ph !== 'over';
      const tgt = active ? LINE : WAIT;
      if (!T.placed) { T.placed = true; T.pos.set(tgt.x, 0, tgt.z); }
      const dx = tgt.x - T.pos.x, dz = tgt.z - T.pos.z, dist = Math.hypot(dx, dz);
      const want = dist > 0.04 ? Math.min(2.0, 0.5 + dist * 1.6) : 0;
      T.spd += (want - T.spd) * Math.min(1, dt * 6);
      T.vel.set(0, 0, 0);
      if (T.spd > 0.02 && dist > 0.001) { const stp = Math.min(dist, T.spd * dt); T.pos.x += (dx / dist) * stp; T.pos.z += (dz / dist) * stp; T.vel.set((dx / dist) * T.spd, 0, (dz / dist) * T.spd); }
      T.h.setPosition(T.pos.x, 0, T.pos.z);
      if (T.spd > 0.15) { T.h.faceDirection(T.vel.x, T.vel.z, { snap: false }); T.h.locomote(T.spd); }
      else { T.h.setFacing(Math.PI / 2 - (active ? 0.5 : 0.1), { snap: false }); T.h.locomote(0); }
      // hands: only the planted, active thrower reaches for the arrow; the reach weight and the targets are eased so the arm never pops
      T.h.footPlanting = false;
      const reach = active && T.spd < 0.2;
      T.rw = T.rw ?? 0; T.rw += ((reach ? 1 : 0) - T.rw) * (1 - Math.exp(-dt * (reach ? 7 : 12)));
      if (reach || T.rw > 0.02) {
        const al = (m.aim.a * Math.PI) / 180, ca = Math.cos(al), sa = Math.sin(al);
        let fwd = 0, up = 0;
        const fl = m.fl && m.ph === 'fly' ? m.fl : null;
        if (fl) { const k = clamp(fl.t / 0.16, 0, 1), back = clamp((fl.t - 0.16) / 0.7, 0, 1); const e = Math.sin(k * Math.PI * 0.5) * (1 - smooth(back)); fwd = 0.16 * e; up = 0.05 * e; }
        else { fwd = -0.03 + Math.sin(t * 1.1) * 0.004; up = Math.sin(t * 0.9) * 0.004; }
        const want = V(HAND.x * CM + ca * (fwd + 0.06), HAND.y * CM + sa * (fwd + 0.06) + up, 0);
        // critically damped follow: no single-frame jump even when the aim angle changes quickly
        T.hand = T.hand || want.clone(); const kf = 1 - Math.exp(-dt * 22); T.hand.lerp(want, T.rw < 0.3 ? 1 : kf);
        const sh = T.h.bonePosition('R_UpperArm', V());
        T.h.setReach('R', T.hand, { weight: T.rw, pole: V(sh.x - 0.25, sh.y - 0.5, sh.z + 0.15) }); T.h.setFingers('R', 'pinch');
        const lsh = T.h.bonePosition('L_UpperArm', V());
        T.h.setReach('L', V(lsh.x + 0.16, lsh.y - 0.4, lsh.z + 0.16), { weight: 0.9 * T.rw, pole: V(lsh.x - 0.2, lsh.y - 0.5, lsh.z + 0.25) }); T.h.setFingers('L', 'fist');
        showBundle(T, Math.max(0, m.left[side] - 1));
      } else { T.h.setReach('R', null); T.h.setReach('L', null); T.h.setFingers('R', 'relaxed'); T.h.setFingers('L', 'relaxed'); showBundle(T, 0); T.hand = null; }
    }
  }
  function showBundle(T, n) {
    const g = T.bundle;
    while (g.children.length < 3) { const a = makeArrow(T.side); g.add(a); }
    g.children.forEach((a, i) => { a.visible = i < n; });
    if (n > 0) {
      T.h.bonePosition('L_Hand', _bp); g.position.copy(_bp);
      g.children.forEach((a, i) => { a.position.set(0, 0.14, (i - 1) * 0.012); a.rotation.set(0, (i - 1) * 0.12, Math.PI / 2 - 0.15 + (i - 1) * 0.08); });
    }
  }

  stage.onContextLost(() => { lost = true; canvas.style.visibility = 'hidden'; gameRef?.setHas3d?.(false); });
  stage.onContextRestored(() => { lost = false; canvas.style.visibility = 'visible'; scene.environmentIntensity = 0.55; gameRef?.setHas3d?.(true); stage.invalidate(); });

  return {
    stage, scene, camera, world, vase, throwers, rig,
    busy: () => false,
    // development probe (smoothness / locomotion gates): world positions of the visible arrows and the main joints of each thrower
    debug() {
      const arrows = pool.filter((a) => a.visible).map((a) => [a.position.x, a.position.y, a.position.z, a.rotation.z]);
      const joints = throwers.map((T) => {
        if (!T || !T.root.visible) return null;
        const o = { root: [T.pos.x, T.pos.z], spd: T.spd };
        for (const n of ['Pelvis', 'Spine2', 'Head', 'L_UpperArm', 'L_Forearm', 'L_Hand', 'R_UpperArm', 'R_Forearm', 'R_Hand', 'L_Thigh', 'L_Calf', 'L_Foot', 'R_Thigh', 'R_Calf', 'R_Foot']) { const v = T.h.bonePosition(n, _bp); o[n] = [v.x, v.y, v.z]; }
        return o;
      });
      return { t: simT, arrows, joints, vaseRot: vase.rotation.z };
    },
    wrap(game) {
      gameRef = game;
      const r = game.render.bind(game);
      game.render = (ctx, view) => { r(ctx, view); if (!lost) frame(game); };
      return game;
    },
    loseContext: () => stage.loseContextForTest(), restoreContext: () => stage.restoreContextForTest(),
  };
}

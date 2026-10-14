// Sled Dog Race 3D presenter. It READS the game state (game.getState()) and the frame the 2D layer publishes in src/v3.js; it never writes
// back to the sim. One WebGL canvas sits BEHIND the kit's transparent 2D canvas (which keeps the HUD, menus, text and all input):
// a lit trail world (ridges, pines, packed snow, rough ice, signs, gantries, cabin), six husky models with IK legs on a gait driven by
// real distance, a sled with a real person standing on the runners, snow spray, breath fog, spectators in parkas and a weather system.
// Boot: the flat 2D art is interactive immediately; the 3D scene is built in slices (await a frame between them), then crossfades in.
// Fallback: no WebGL, or a lost context -> v3.on = false and every screen draws the flat 2D scene again; restored -> back to 3D.
import { v3 } from '../src/v3.js';
import { slopeAt } from '../src/sim.js';
import * as MN from '../src/menus.js';
import { DOGS } from '../src/consts.js';
import { buildWorld, groundY, terrainY, VX } from './world.js';
import { makeDog, gaitParams } from './dog.js';
import { makeSled } from './sled.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (cur, tgt, k, dt) => cur + (tgt - cur) * (1 - Math.exp(-k * dt));
const tick = () => new Promise((r) => (globalThis.requestAnimationFrame ? globalThis.requestAnimationFrame(() => r()) : setTimeout(r, 0)));

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  let touch = false; try { touch = !!(globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches); } catch { /* ignore */ }
  return weak ? 'low' : touch ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { stage: null, wrap: (g) => g, ok: false };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, THREE } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '2';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: quality !== 'low', shadowSize: 12 });
  if (!stage.supported || stage.failed) { canvas.remove(); return none; }
  const P = { stage, THREE, ok: false, quality, lost: false, errors: 0, stats: { frames: 0 }, V3 };
  const scene = stage.scene, camera = new THREE.PerspectiveCamera(30, 1, 0.5, 2500);
  stage.camera = camera;
  stage.render = () => { if (stage.contextLost) return false; stage.renderer.render(scene, camera); stage.stats.renders++; stage.dirty = false; return true; };
  scene.environmentIntensity = 0.3;
  const lights = stage.lights;
  lights.key.shadow.camera.far = 70; lights.key.shadow.camera.near = 1;
  const rig = { scene, key: lights.key, hemi: lights.hemi, rim: lights.rim, keyDir: stage._shadowOffset, set exposure(v) { stage.renderer.toneMappingExposure = v; } };

  // ---- world + sky (slice 1)
  const world = buildWorld({ quality });
  scene.add(world.group);
  P.world = world;
  await tick();

  // ---- the team, the sled, a ghost team for the rival (slice 2)
  const team = new THREE.Group(); scene.add(team);
  const dogs = DOGS.map((d) => { const m = makeDog(d, { harness: '#e0683a', quality }); team.add(m.root); return m; });
  const sled = makeSled(); scene.add(sled);
  const ghost = new THREE.Group(); ghost.visible = false; scene.add(ghost);
  const ghostSled = makeSled({ bagColor: '#8a8f9c' }); ghost.add(ghostSled);
  const ghostDogs = [0, 1, 2].map((i) => { const m = makeDog(DOGS[(i + 3) % 6], { harness: '#ffffff', quality }); ghost.add(m.root); return m; });
  const ghostFlag = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' })); ghost.add(ghostFlag);
  ghost.traverse((o) => {
    if (o.isMesh && o !== ghostFlag) {
      const mats = [].concat(o.material).map((m) => { const c = m.clone(); c.transparent = true; c.opacity = 0.42; c.depthWrite = false; return c; });
      o.material = Array.isArray(o.material) ? mats : mats[0]; o.castShadow = false;
    }
  });
  // gangline: three straps from the sled's bridle to the dogs
  const lineMat = new THREE.MeshStandardMaterial({ color: '#d8cdb6', roughness: 0.8 });
  const lines = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 6), lineMat); scene.add(m); return m; });
  // contact shadows under every dog and the sled (cheap, always on; the real shadow map adds the cast on high / medium)
  const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(10,20,50,0.55)'); g.addColorStop(1, 'rgba(10,20,50,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  const blobGeo = new THREE.PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2);
  const blobs = [...dogs.map(() => 1.5), 4.2].map((w) => { const m = new THREE.Mesh(blobGeo, blobMat); m.scale.set(w, 1, w * 0.55); m.renderOrder = 2; scene.add(m); return m; });
  await tick();

  // ---- particles: snow spray, paw puffs, breath, smoke
  const NP = 220;
  const pg = new THREE.BufferGeometry();
  const pPos = new Float32Array(NP * 3), pSize = new Float32Array(NP), pAlpha = new Float32Array(NP), pCol = new Float32Array(NP * 3);
  pg.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pg.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
  pg.setAttribute('aAlpha', new THREE.BufferAttribute(pAlpha, 1)); pg.setAttribute('aCol', new THREE.BufferAttribute(pCol, 3));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uPx: { value: 900 } },
    vertexShader: 'attribute float aSize; attribute float aAlpha; attribute vec3 aCol; uniform float uPx; varying float vA; varying vec3 vC; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(aSize*uPx/max(0.5,-mv.z),0.0,160.0); vA=aAlpha; vC=aCol; }',
    fragmentShader: 'varying float vA; varying vec3 vC; void main(){ vec2 q=gl_PointCoord-0.5; float a=smoothstep(0.5,0.0,length(q))*vA; gl_FragColor=vec4(vC,a); }',
  });
  const pts = new THREE.Points(pg, pMat); pts.frustumCulled = false; pts.renderOrder = 15; scene.add(pts);
  const parts = Array.from({ length: NP }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 0.1, s1: 0.3, a: 0.6, c: [1, 1, 1], g: 0 }));
  let pHead = 0;
  const emit = (x, y, z, vx, vy, vz, life, s0, s1, a, c = [1, 1, 1], g = 2.5) => { const p = parts[pHead]; pHead = (pHead + 1) % NP; Object.assign(p, { life, max: life, x, y, z, vx, vy, vz, s0, s1, a, c, g }); };
  const stepParts = (dt) => {
    for (let i = 0; i < NP; i++) {
      const p = parts[i];
      if (p.life > 0) { p.life -= dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= 1 - 1.5 * dt; p.vz *= 1 - 1.5 * dt; }
      const u = p.life > 0 ? 1 - p.life / p.max : 1, alive = p.life > 0;
      pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
      pSize[i] = alive ? lerp(p.s0, p.s1, u) : 0; pAlpha[i] = alive ? p.a * (1 - u) * Math.min(1, u * 8) : 0;
      pCol[i * 3] = p.c[0]; pCol[i * 3 + 1] = p.c[1]; pCol[i * 3 + 2] = p.c[2];
    }
    pg.attributes.position.needsUpdate = pg.attributes.aSize.needsUpdate = pg.attributes.aAlpha.needsUpdate = pg.attributes.aCol.needsUpdate = true;
  };

  // ---- the musher and the spectators load after the first flat frame has been painted
  const S = { musher: null, crowdStart: null, crowdEnd: null, clip: '', csG: null, ceG: null };
  P.loading = (async () => {
    try {
      const { loadMusher } = await import('./musher.js');
      const { dressMusher } = await import('./parka.js');
      await tick(); await new Promise((r) => setTimeout(r, 60));
      const h = await loadMusher(V3, { quality });
      sled.add(h.root); h.root.position.set(-1.72, 0.1, 0); h.setFacing(Math.PI / 2);
      try { h.parka = dressMusher(V3, h); } catch (e) { console.warn('parka failed', e); }
      stage.track(h); S.musher = h;
      h.root.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.frustumCulled = false; });
    } catch (e) { console.warn('musher unavailable', e); }
    try {
      await tick(); await new Promise((r) => setTimeout(r, 120));
      const mk = (seed, n) => V3.createCrowd3d({ scene, camera }, {
        rows: [
          { from: [-5, 0, -4.2], to: [5, 0, -4.4], count: n, face: [0, 0, 8] },
          { from: [-4, 0, -5.4], to: [4, 0, -5.6], count: Math.round(n * 0.7), face: [0, 0, 8] },
        ],
        seed, culture: ['nordic', 'european_village', 'american_rural'], quality: quality === 'high' ? 'medium' : 'low', cold: true, excitement: 0.35,
        props: { flag: 0.12, phone: 0.1, child: 0.12 }, flagColors: ['#c8452a', '#2a6fb5', '#f4f4f0'],
      });
      const known = new Set(scene.children);
      S.crowdStart = mk(31, quality === 'low' ? 5 : 8);
      S.csG = scene.children.find((o) => !known.has(o) && o.name === 'crowd3d') || null;
      const known2 = new Set(scene.children);
      S.crowdEnd = mk(77, quality === 'low' ? 5 : 9);
      S.ceG = scene.children.find((o) => !known2.has(o) && o.name === 'crowd3d') || null;
    } catch (e) { console.warn('spectators unavailable', e); }
  })();

  // ---- per-frame state
  const F = { clock: 0, xr: 0, prevX: null, sv: 0, phase: 0, ema: 16, frames: 0, leg: null, legKey: '', look: -1, weather: '', camE: 0, brakeAmt: 0, lean: 0, spray: 0, tierDrops: 0, smokeT: 0, cheered: false };
  const tmp = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const SNOWC = [0.96, 0.98, 1.0];

  // Cameras. play, portrait: a rear three-quarter chase view down the line of dogs (the sled big in the foreground, the leaders
  // receding), so the tall screen is filled with depth; play, landscape / tablet: a low side-on view that shows the whole team;
  // menus: a slow cinematic drift in front of the team, low, as they charge toward the viewer.
  const CAMS = { yaw: 0, sy: 0 };
  function setCamera(cam, X, groundE, t, menu, dt) {
    const W = cam.w, H = cam.h, rect = cam.rect || { x: 0, y: 0, w: W, h: H };
    const aspect = W / H, tall = aspect < 0.82;
    let pos, look, fov;
    if (menu) {
      const sw = Math.sin(t * 0.11);
      pos = [X + (tall ? 15.5 : 19) + sw * 2.5, groundE + 1.15 + Math.sin(t * 0.17) * 0.25, (tall ? 6.2 : 7.5) + Math.cos(t * 0.09) * 1.0];
      look = [X + 3.4, groundE + 0.85, 0]; fov = tall ? 38 : 28;
    } else if (tall) {
      pos = [X - 11.5, groundE + 3.2, 5.6]; look = [X + 2.1, groundE + 0.5, 0]; fov = aspect < 0.55 ? 44 : 36;
    } else {
      pos = [X + 3.2, groundE + 2.1, 16.5]; look = [X + 4.0, groundE + 0.95, 0]; fov = 28;
    }
    if (P.zoom) { const k = 1 / P.zoom; pos = pos.map((v, i) => look[i] + (v - look[i]) * k); }
    camera.fov = fov; camera.aspect = aspect;
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(look[0] + (P.pan || 0), look[1], look[2]);
    camera.near = 0.6; camera.far = 2400;
    // the subject sits in the free band between the top HUD and the bottom controls
    const hero = v3.hero;
    const cx = menu && hero ? hero.cx : rect.x + rect.w * 0.5, cy = menu ? (hero ? hero.cy : H * 0.3) : rect.y + rect.h * (tall ? 0.6 : 0.52);
    const useRect = !!cam.rect && !menu;
    if (P.pin || !useRect && !menu) camera.clearViewOffset();
    else camera.setViewOffset(W, H, -(cx - W / 2), -(cy - H / 2), W, H);
    camera.updateProjectionMatrix();
  }

  const pairX = (X) => [X + 3.9, X + 3.9 + 2.8, X + 3.9 + 5.6];

  function frame(game, dt) {
    const G = game.getState();
    const fr = v3.frame; if (!fr) return;
    const { cam, info } = fr, s = info.s, L = info.L;
    if (!s || !L) return;
    const menu = G.scene !== 'play';
    // ---- leg + look
    const lookIdx = menu ? 3 : (info.look ?? G.look ?? 1);
    const weather = menu ? 'snow' : (L.weather || 'clear');
    const isLast = s.leg + 1 >= s.legCount;
    const legKey = `${L.idx}|${L.len}|${L.hill}|${isLast ? 1 : 0}|${L.rough.length}|${L.jx.length}|${lookIdx}`;
    if (F.leg !== L || F.legKey !== legKey) {
      world.setLeg(L, lookIdx, { isLast }); F.leg = L; F.legKey = legKey; F.look = -1; F.prevX = null;
    }
    if (F.look !== lookIdx || F.weather !== weather) { world.applyLook(lookIdx, weather, rig); F.look = lookIdx; F.weather = weather; }

    // ---- time, smoothed position, speed and gait phase (driven by the distance actually travelled)
    F.clock += dt;
    const sx = s.x;
    if (F.prevX === null || Math.abs(sx - F.prevX) > 8) { F.prevX = sx; F.xr = sx; F.sv = s.v; }
    F.prevX = sx;
    const xr0 = F.xr;
    F.xr = damp(F.xr, sx, 40, dt); if (Math.abs(F.xr - sx) > 1.5) F.xr = sx;
    const dx = F.xr - xr0;
    const moving = s.phase === 'run' && s.v > 0.3;
    F.sv = damp(F.sv, moving ? s.v : 0, 6, dt);
    const gp = gaitParams(Math.max(0.5, F.sv));
    if (dx > 0 && dx < 3) F.phase += dx / gp.strideLen;
    const X = F.xr;
    // ---- camera
    const camE = info.camE ?? 0;
    F.gE = F.gE === undefined ? groundY(L, X) : damp(F.gE, groundY(L, X), 3, dt);
    setCamera(cam, X, F.gE, F.clock, menu, dt);

    // ---- team
    const px = pairX(X);
    const ang = (x) => Math.atan(slopeAt(L, x) * VX);
    const brakeOn = !!(s.brake && moving);
    const praise = (info.praiseT || 0) > 0;
    let riders = 0;
    for (let i = 0; i < 6; i++) {
      const dog = dogs[i], d = s.dogs[i], pair = i >> 1, far = i & 1;
      const Xw = px[2 - pair] + (far ? 0.55 : 0), z = far ? -0.62 : 0.5;
      const y = groundY(L, Xw);
      if (d && d.riding) {
        if (dog.root.parent !== sled) sled.add(dog.root);
        const k = riders++;
        dog.root.position.set(0.55 - k * 0.55, 0.62, 0); dog.root.rotation.set(0, 0, 0); dog.root.scale.setScalar(0.85);
        dog.update({ v: 0, phase: 0, pose: 'lie', e: d.e, t: F.clock, dt, ph0: i * 0.37, happy: true, panting: true });
        continue;
      }
      if (dog.root.parent !== team) { team.add(dog.root); dog.root.scale.setScalar(1); }
      dog.root.position.set(Xw, y, z);
      dog.root.rotation.set(0, 0, ang(Xw));
      const resting = s.phase === 'stop';
      const pose = resting ? (info.sel === i ? 'sit' : 'lie') : moving ? 'run' : 'stand';
      dog.update({
        v: F.sv, phase: F.phase + i * 0.11 + far * 0.18, pose, e: d ? d.e : 1, t: F.clock, dt, ph0: i * 0.37 + 0.2,
        happy: praise || s.phase === 'finished' || resting, panting: resting, look: praise ? 0.25 : 0,
        onStep: (fx, fz) => { emit(Xw + fx, y + 0.05, z + fz * 0.5, -F.sv * 0.25, 0.9 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6, 0.55, 0.12, 0.34, 0.5, SNOWC); },
      });
    }
    // ---- gangline
    let prev = new THREE.Vector3(X + 1.8, groundY(L, X + 1.8) + 0.45, 0);
    px.forEach((xx, k) => {
      const next = new THREE.Vector3(xx, groundY(L, xx) + 0.74, 0);
      const m = lines[k], dv = next.clone().sub(prev), len = dv.length();
      m.position.copy(prev).addScaledVector(dv, 0.5); m.scale.set(1, len, 1);
      m.quaternion.setFromUnitVectors(UP, dv.normalize());
      prev = next;
    });
    // ---- sled + musher
    const gy0 = groundY(L, X), sa = ang(X);
    const lean = brakeOn ? -0.1 : moving ? clamp(s.pace * 0.1 - slopeAt(L, X) * 0.6, -0.06, 0.12) : 0;
    F.lean = damp(F.lean, lean, 5, dt);
    sled.position.set(X, gy0, 0);
    sled.rotation.set(0, 0, sa + F.lean * 0.3 + Math.sin(F.clock * 9) * 0.004 * Math.min(1, F.sv / 6));
    F.brakeAmt = damp(F.brakeAmt, brakeOn ? 1 : 0, 10, dt);
    sled.userData.brake.rotation.z = -0.75 * F.brakeAmt;
    const mh = S.musher;
    if (mh) {
      const climbing = moving && slopeAt(L, X) > 0.045 && s.v < 7.5;
      let want = 'm_ride';
      if (s.phase === 'finished') want = 'm_wave'; else if (brakeOn) want = 'm_brake'; else if (climbing) want = 'm_pedal';
      if (want !== S.clip) { mh.play(want, { fade: 0.28 }); S.clip = want; }
      mh.setSpeed(want === 'm_pedal' ? clamp(F.sv / 3.4, 0.5, 2.0) : 1);
      if (mh.parka) mh.parka.step(dt, clamp(F.sv / 9, 0, 1));
    }
    // ---- contact shadows
    dogs.forEach((dg, i) => {
      const b = blobs[i], r = dg.root.parent === sled;
      b.visible = !r;
      if (!r) { b.position.set(dg.root.position.x, dg.root.position.y + 0.025, dg.root.position.z); b.rotation.z = dg.root.rotation.z; }
    });
    blobs[6].position.set(X - 0.2, gy0 + 0.03, 0); blobs[6].rotation.z = sa;
    // ---- snow spray from the runners and the brake, breath in the cold, chimney smoke
    if (dt > 0) {
      if (moving) {
        F.spray += dt * (14 + F.sv * 3 + (brakeOn ? 30 : 0));
        while (F.spray > 1) {
          F.spray -= 1;
          const bx = X - 1.9, by = groundY(L, bx) + 0.1;
          emit(bx, by, (Math.random() - 0.5) * 0.7, -F.sv * 0.18 - Math.random() * 0.8, 0.5 + Math.random() * (brakeOn ? 2.4 : 1.1), (Math.random() - 0.5) * (brakeOn ? 2.2 : 1.0),
            0.5 + Math.random() * 0.4, 0.10, brakeOn ? 0.5 : 0.32, brakeOn ? 0.75 : 0.55, SNOWC);
        }
      }
      dogs.forEach((dg, i) => {
        if (dg.root.parent === sled) return;
        const per = 1.7 + (i % 3) * 0.25, u = ((F.clock + i * 0.43) % per) / per;
        if (u < (dt / per) * 1.6) {
          const p = dg.root.position, hd = dg.root.rotation.z;
          emit(p.x + 1.05 * Math.cos(hd), p.y + 0.78 + 1.05 * Math.sin(hd) * 0.4, p.z, 0.8 + F.sv * 0.1, 0.35, 0, 0.9, 0.14, 0.5, 0.35, [0.95, 0.97, 1.0], -0.1);
        }
      });
      if (world.cabin) {
        F.smokeT += dt;
        if (F.smokeT > 0.12) { F.smokeT = 0; const c = world.cabin.position; emit(c.x + 1.6, c.y + 6.2, c.z - 0.4, 0.5, 1.1, 0, 3.0, 0.5, 2.2, 0.35, [0.92, 0.94, 0.98], -0.15); }
      }
    }
    stepParts(dt);

    // ---- the rival ghost
    const g = info.ghost;
    if (g && Math.abs(g.x - sx) < 60 && g.leg === L.idx && s.phase === 'run') {
      ghost.visible = true;
      ghostSled.position.set(g.x, groundY(L, g.x), 0); ghostSled.rotation.z = ang(g.x);
      ghostDogs.forEach((dg, k) => {
        const Xw = g.x + 3.9 + k * 3.0, y = groundY(L, Xw);
        dg.root.position.set(Xw, y, 0); dg.root.rotation.z = ang(Xw);
        dg.update({ v: F.sv || s.v, phase: F.phase + k * 0.2, pose: 'run', e: 1, t: F.clock, dt, ph0: k });
      });
      ghostFlag.material.color.set(g.col || '#ffffff'); ghostFlag.position.set(g.x + 4.5, groundY(L, g.x) + 3.3, 0);
    } else ghost.visible = false;

    // ---- junction signs light up with the call window; the marked state tints the board
    for (const sg of world.signs) {
      const j = sg.j;
      const lit = s.phase === 'run' && j.state === 'ahead' && s.x >= j.x - Math.max(26, L.vis - 10) && s.x < j.x;
      sg.mat.emissiveIntensity = lit ? 0.5 + 0.5 * Math.max(0, Math.sin(F.clock * 9)) : j.state === 'ok' ? 0.5 : j.state === 'missed' ? 0.35 : 0;
      sg.mat.emissive.set(j.state === 'ok' ? '#3ddc84' : j.state === 'missed' ? '#ff5a4a' : '#ffd54a');
    }
    // ---- spectators: the start gathering and the finish / checkpoint gathering
    if (S.csG) { S.csG.visible = L.idx === 0; S.csG.position.set(1, terrainY(L, 1, -4.4), 0); }
    if (S.ceG) S.ceG.position.set(L.len + 1, terrainY(L, L.len + 1, -4.4), 0);
    for (const c of [S.crowdStart, S.crowdEnd]) if (c) { try { c.update(dt, camera); } catch { /* ignore */ } }
    if (S.crowdEnd && s.phase === 'finished' && !F.cheered) { F.cheered = true; try { S.crowdEnd.react('ovation', { intensity: 1 }); S.crowdEnd.setExcitement(1); } catch { /* ignore */ } }
    if (s.phase !== 'finished') F.cheered = false;

    // ---- lights follow the action; sky and sun follow the camera
    stage.setShadowTarget(X + 4, gy0, 0);
    world.sky.position.copy(camera.position);
    world.sun.position.copy(world.skyMat.uniforms.sunDir.value).multiplyScalar(700).add(camera.position);
    world.skyMat.uniforms.uTime.value = F.clock;
    world.snowMat.uniforms.uTime.value = F.clock;
    world.snowMat.uniforms.uCam.value.set(camera.position.x, camera.position.y - 2, camera.position.z - 14);
    const pxs = canvas.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    world.snowMat.uniforms.uPx.value = pxs; pMat.uniforms.uPx.value = pxs;
    if (world.cabinLight) world.cabinLight.intensity = 7 + Math.sin(F.clock * 7) * 0.8;
  }

  // ---- context loss: flat art again, then back to 3D without a reload
  stage.onContextLost(() => { P.lost = true; v3.on = false; MN.invalidateLayout(); });
  stage.onContextRestored(() => { P.lost = false; if (!P.off) { v3.on = true; MN.invalidateLayout(); } stage.resize(); stage.invalidate(); });

  // ---- flat-to-3D crossfade: keep the last flat frame in an overlay canvas and fade it out
  function crossfade() {
    try {
      const ov = document.createElement('canvas'); ov.width = kitCanvas.width; ov.height = kitCanvas.height;
      ov.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;pointer-events:none;z-index:1;opacity:1;transition:opacity .45s ease';
      ov.getContext('2d').drawImage(kitCanvas, 0, 0);
      kitCanvas.parentElement.insertBefore(ov, kitCanvas);
      requestAnimationFrame(() => requestAnimationFrame(() => { ov.style.opacity = '0'; setTimeout(() => ov.remove(), 600); }));
    } catch { /* no crossfade */ }
  }

  let ready = false, lastT = performance.now();
  // compile the shaders in the background (no frame hitch), then switch to 3D
  (async () => {
    await P.loading.catch(() => {});
    try { if (stage.renderer.compileAsync) await stage.renderer.compileAsync(scene, camera); } catch { /* compile on first draw */ }
    ready = true;
  })();
  P.setReadyForTest = () => { ready = true; };
  P.wrap = (game) => Object.assign({}, game, {
    render(ctx, view) {
      if (!v3.on && ready && !P.lost && !P.off) { crossfade(); v3.on = true; P.ok = true; MN.invalidateLayout(); }
      game.render(ctx, view);
      if (!v3.on) return;
      try {
        const now = performance.now(), dt = clamp((now - lastT) / 1000, 0, 0.1); lastT = now;
        F.ema = F.ema * 0.95 + dt * 1000 * 0.05; F.frames++;
        if (F.frames > 120 && F.ema > 26 && F.tierDrops < 2 && stage.quality !== 'low') {
          F.tierDrops++; F.frames = 0; F.ema = 16;
          const next = stage.quality === 'high' ? 'medium' : 'low'; stage.setQuality(next); P.quality = next;
        }
        const G = game.getState();
        const frozen = G.scene === 'play' && (G.paused || G.pauseMenu);
        frame(game, frozen ? 0 : dt);
        stage.update(frozen ? 0 : dt);
        P.stats.frames++;
      } catch (e) {
        P.errors++; if (P.errors < 4) console.warn('3D frame failed', e);
        if (P.errors >= 3) { v3.on = false; P.off = true; canvas.style.visibility = 'hidden'; }
      }
    },
  });
  P.probe = () => ({ dogs: dogs.map((d) => ({ x: d.root.position.x, y: d.root.position.y, z: d.root.position.z })), sled: sled.position.toArray(), phase: F.phase, sv: F.sv });
  P.F = F; P.dogs = dogs; P.sled = sled; P.camera = camera; P.canvas = canvas; P.S = S;
  return P;
}

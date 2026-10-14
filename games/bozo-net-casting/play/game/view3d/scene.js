// The 3D river for Bozo Net Casting. READS the same numbers the 2D art used (netState, shoal paths, ripples, spray, pose) and draws them as a lit
// WebGL scene behind the transparent kit canvas. The camera reproduces the 2D pinhole exactly (art.makeCam), so the 2D HUD, aim marker,
// hint rings and score pops that stay on the kit canvas line up with the 3D water. It never writes back to the simulation.
import { buildWorld } from './world.js';
import { buildBoat, BOAT } from './boat.js';
import { createNet } from './net.js';
import { createFish } from './fish.js';
import { createFisher } from './fisher.js';
import { PALS, WATER_PAL, netState, FISHER, CAM_H, Z0, FISH_SCALE } from '../src/art.js';
import { SPECIES, NETS, FLIGHT, fishPosDuring } from '../src/sim.js';

const LIB = '../vendor3d/index.js';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const hs = (n) => { let x = Math.imul(n | 0, 0x45d9f3b); x ^= x >>> 16; x = Math.imul(x, 0x45d9f3b); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const FISH_LEN = 1.1;               // body length of the unit fish geometry
const rgb = (s) => { const [r, g, b] = s.split(',').map(Number); return [r / 255, g / 255, b / 255]; };

export async function createScene3d({ kitCanvas, quality = 'medium' } = {}) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D river', e); return null; }
  const { createStage, THREE } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: quality !== 'low', shadowSize: 5, preserveDrawingBuffer: false });
  if (!stage.supported) { canvas.remove(); return null; }
  const scene = stage.scene, camera = stage.camera;
  camera.near = 0.1; camera.far = 3200;
  scene.background = null; scene.fog = new THREE.Fog(0xffd9b0, 60, 420);
  const S = { lost: false, ready: false, stage, THREE };
  stage.onContextLost(() => { S.lost = true; });
  stage.onContextRestored(() => { S.lost = false; sizeKey = ''; stage.invalidate(); });

  const world = buildWorld(THREE, scene, { quality });
  // ---- the pirogue: real hull + its reflection + the fisher standing in it ----
  const boat = buildBoat(THREE);
  const boatRoot = new THREE.Group(); boatRoot.add(boat.group);
  // the reflected hull: the outer shell only, clipped at the waterline (the part below the water would otherwise poke up inside the real hull)
  stage.renderer.localClippingEnabled = true;
  const mirrorBoat = new THREE.Group();
  {
    const shellSrc = boat.hull.children[0];
    const mm = shellSrc.material.clone(); mm.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)];
    mirrorBoat.add(new THREE.Mesh(shellSrc.geometry, mm));
  }
  const mirrorRoot = new THREE.Group(); mirrorRoot.scale.y = -1; mirrorRoot.add(mirrorBoat);   // everything reflected hangs under here
  scene.add(boatRoot, mirrorRoot, boat.water);
  const bx = -FISHER.x;                                   // three X = -sim x
  boatRoot.position.set(bx, 0, 0); mirrorBoat.position.set(bx, 0, 0); boat.water.position.set(bx, 0, 0);
  const anchor = new THREE.Group(); anchor.position.set(0, BOAT.floorY, FISHER.z);
  boatRoot.add(anchor);
  let fisher = null;
  try { fisher = await createFisher(V3, anchor, quality); } catch (e) { console.warn('3D fisher failed to load', e); stage.dispose(); return null; }
  anchor.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // ---- net, cord, fish, sparkle, spray, drips, rings ----
  const net = createNet(THREE);
  scene.add(net.group); mirrorRoot.add(net.mirror);       // the reflected copy hangs under the mirror root (its scale.y = -1 flips it)
  const cordGeo = new THREE.BufferGeometry(); const CN = 18; const cordPos = new Float32Array(CN * 3);
  cordGeo.setAttribute('position', new THREE.BufferAttribute(cordPos, 3));
  const cord = new THREE.Line(cordGeo, new THREE.LineBasicMaterial({ color: '#3a2a18' })); cord.frustumCulled = false; cord.renderOrder = 9; scene.add(cord);
  const fish = createFish(THREE, SPECIES, 80); fish.meshes.forEach((m) => scene.add(m));
  const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const mkPoints = (n, size, color, additive = true) => {
    const geo = new THREE.BufferGeometry(); const p = new Float32Array(n * 3), c = new Float32Array(n * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3)); geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.setDrawRange(0, 0);
    const m = new THREE.PointsMaterial({ size, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, color, sizeAttenuation: true });
    const pts = new THREE.Points(geo, m); pts.frustumCulled = false; pts.renderOrder = 10; scene.add(pts);
    return { pts, p, c, n, geo, set(i, x, y, z, r, g, b) { p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z; c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b; }, done(count) { geo.setDrawRange(0, count); geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; } };
  };
  const spray = mkPoints(160, 0.13, 0xffffff);
  const flash = mkPoints(48, 0.2, 0xffffff);
  const drips = mkPoints(40, 0.07, 0xffffff);
  const foamTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.15)'); gr.addColorStop(0.8, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(gr && c); })();
  const splashes = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 7; scene.add(m); splashes.push({ m, t0: -9, r: 1 });
  }
  // overlay rings: the aim ring, the full-open guide and the helper's suggested spot
  const ringGeo = (() => { const pos = [], idx = [], N = 72; for (let i = 0; i < N; i++) { if (i % 2) continue; const a0 = (i / N) * TAU, a1 = ((i + 1) / N) * TAU; const b = pos.length / 3; for (const [a, r] of [[a0, 0.95], [a0, 1.02], [a1, 0.95], [a1, 1.02]]) pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g; })();
  const discGeo = (() => { const g = new THREE.CircleGeometry(1, 48); g.rotateX(-Math.PI / 2); return g; })();
  const mkRing = (color, disc) => {
    const g = new THREE.Group();
    const r = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); r.renderOrder = 8;
    g.add(r);
    if (disc) { const d = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending })); d.renderOrder = 7; g.add(d); g.userData.disc = d; }
    g.visible = false; scene.add(g); g.userData.ring = r; return g;
  };
  const aimRing = mkRing('#ffd36a', true), fullRing = mkRing('#ffffff', false), hintRing = mkRing('#ffc94a', true);

  // ---- state ----
  const cur = { top: new THREE.Color(), mid: new THREE.Color(), hor: new THREE.Color(), deep: new THREE.Color(), shallow: new THREE.Color(), sunCol: new THREE.Color(), glint: new THREE.Color(), foam: new THREE.Color(), bank0: new THREE.Color(), bank1: new THREE.Color() };
  let palInit = false, lastNow = 0, sizeKey = '', tReal = 0, lastRip = -1, kicked = '', lastPhase = '';
  const boatS = { roll: 0, rollV: 0, pitch: 0, pitchV: 0 };
  const netS = { x: 0, y: 0, z: 0, r: 0.15, bell: 0.5, pitch: 0, roll: 0, a: 1, init: false };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(), m4 = new THREE.Matrix4(), sc = new THREE.Vector3();
  const sunDir = new THREE.Vector3(), lightDir = new THREE.Vector3();
  const tint = new THREE.Color();
  const hands3d = (hands, mode, pose) => {
    const u = clamp(pose.u || 0, 0, 1);
    return hands.map((h, i) => {
      if (mode === 'swing') {
        const x = clamp(h[0] * 0.62, -0.62, 0.62), sinv = clamp((h[1] - 1.08) / 0.38, -1.2, 1.2), z = clamp(sinv * 0.38 + 0.05, -0.4, 0.5), y = 1.06 + sinv * 0.1;
        return [x, y, z];   // continuous: the swing circle never crosses the torso (behind the back it stays at z <= -0.2 where |x| is small)
      }
      const z = mode === 'throw' ? lerp(i ? 0.12 : 0.3, 0.5, Math.sin(Math.min(1, u * 1.4) * Math.PI * 0.5)) : mode === 'release' ? 0.35 : 0.28;
      return [h[0], h[1], z];
    });
  };

  // env: { rect, cam, W, H, kitW, kitH }, o: world state, fx: the eased fisher pose from art.js
  S.frame = (env, o, fx) => {
    if (S.lost || stage.contextLost) return false;
    const now = performance.now(); let dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0; lastNow = now;
    tReal += dt; S.dt = dt;
    const cam = env.cam, w = kitCanvas.clientWidth || window.innerWidth, h = kitCanvas.clientHeight || window.innerHeight;
    const key = `${w}x${h}`; if (key !== sizeKey) { sizeKey = key; stage.setSize(w, h); }
    stage.setVisible(true);
    const U = world.uniforms;
    // ---- palette (eased so a change of water cross-fades) ----
    const pal = PALS[WATER_PAL[o.water] ?? 0], pk = palInit ? 1 - Math.exp(-dt * 3.2) : 1; palInit = true;
    const tgt = (c, hex) => c.lerp(tint.set(hex), pk);
    tgt(cur.top, pal.sky[0]); tgt(cur.mid, pal.sky[1]); tgt(cur.hor, pal.sky[2]); tgt(cur.deep, pal.water[2]); tgt(cur.shallow, pal.water[1]);
    tgt(cur.bank0, pal.bank[0]); tgt(cur.bank1, pal.bank[1]);
    const sc3 = rgb(pal.sun.c), gl3 = rgb(pal.glint), fo3 = rgb(pal.foam), hz3 = rgb(pal.haze);
    cur.sunCol.lerp(tint.setRGB(sc3[0], sc3[1], sc3[2]), pk); cur.glint.lerp(tint.setRGB(gl3[0], gl3[1], gl3[2]), pk); cur.foam.lerp(tint.setRGB(fo3[0], fo3[1], fo3[2]), pk);
    U.uTop.value.copy(cur.top); U.uMid.value.copy(cur.mid); U.uHor.value.copy(cur.hor); U.uDeep.value.copy(cur.deep); U.uShallow.value.copy(cur.shallow);
    U.uSunCol.value.copy(cur.sunCol); U.uGlint.value.copy(cur.glint); U.uFoam.value.copy(cur.foam);
    U.uNight.value = pal.night ? 1 : 0;
    U.uCur.value.set(o.world ? -o.world.cur.x : 0, o.world ? o.world.cur.z : 0);
    U.uVis.value = o.world ? o.world.vis : 1;
    world.bedMat.color.copy(cur.deep).multiplyScalar(0.7);
    world.groundMat.color.copy(cur.bank0).lerp(cur.hor, 0.12).multiplyScalar(1.5);
    world.mats.mud.color.copy(tint.set('#c9a578')).lerp(cur.sunCol, 0.25).multiplyScalar(pal.night ? 0.5 : 0.95);
    world.mats.mudDark.color.copy(tint.set('#9c7e58')).lerp(cur.mid, 0.2).multiplyScalar(pal.night ? 0.5 : 0.9);
    world.frondMat.color.copy(tint.set('#6f9a4a')).lerp(cur.sunCol, 0.15).multiplyScalar(pal.night ? 0.45 : 1);
    world.bushMat.color.copy(cur.bank1).lerp(tint.set('#5b8040'), 0.5).multiplyScalar(pal.night ? 0.6 : 1.1);
    world.reedMat.color.copy(tint.set('#9ab870')).lerp(cur.sunCol, 0.15).multiplyScalar(pal.night ? 0.5 : 1);
    scene.fog.color.setRGB(hz3[0], hz3[1], hz3[2]).lerp(cur.hor, 0.5);
    // ---- the sun in the sky where the 2D art had it ----
    const rect = env.rect, f = cam.f, sx = rect.x + pal.sun.x * rect.w, sy = rect.y + (cam.hor - rect.y) * pal.sun.y;
    if (env.sunDir) sunDir.set(env.sunDir[0], env.sunDir[1], env.sunDir[2]).normalize(); else sunDir.set(-(sx - cam.cx) / f, (cam.hor - sy) / f, 1).normalize();
    U.uSunDir.value.copy(sunDir);
    U.uSunR.value = Math.cos(0.5 * (pal.sun.r / f) * 0.9);
    lightDir.copy(sunDir); lightDir.y = Math.max(lightDir.y, 0.3); lightDir.normalize();
    stage._shadowOffset.copy(lightDir).multiplyScalar(22);
    stage.setShadowTarget(bx, 0.6, FISHER.z);
    stage.lights.key.color.copy(cur.sunCol).lerp(tint.set('#ffffff'), 0.25); stage.lights.key.intensity = pal.night ? 0.7 : 2.4;
    stage.lights.hemi.color.copy(cur.mid).lerp(cur.top, 0.4); stage.lights.hemi.groundColor.copy(cur.bank1).lerp(cur.deep, 0.4); stage.lights.hemi.intensity = pal.night ? 0.7 : 1.5;
    stage.lights.rim.color.copy(cur.sunCol).lerp(tint.set('#ffffff'), 0.4); stage.lights.rim.intensity = pal.night ? 1.0 : 2.8;
    scene.environmentIntensity = pal.night ? 0.12 : 0.28;
    // ---- camera: the 2D pinhole as an off-centre frustum over the whole canvas ----
    {
      const W = env.W, H = env.H, near = 0.1, far = 3200;
      const l = -cam.cx / f * near, r = (W - cam.cx) / f * near, t = cam.hor / f * near, b = -(H - cam.hor) / f * near;
      camera.projectionMatrix.makePerspective(l, r, t, b, near, far);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      camera.position.set(0, CAM_H, -Z0); camera.rotation.set(0, Math.PI, 0); camera.updateMatrixWorld(true);
      if (env.override) {            // store icon / hero shots: a free camera (three coordinates), standard projection
        const ov = env.override; camera.fov = ov.fov; camera.aspect = W / H; camera.updateProjectionMatrix();
        camera.position.set(ov.pos[0], ov.pos[1], ov.pos[2]); camera.up.set(0, 1, 0); camera.lookAt(ov.look[0], ov.look[1], ov.look[2]); camera.updateMatrixWorld(true);
      }
    }

    // ---- the boat rocks: slow swell plus a spring kicked by the throw, the landing and the haul ----
    const pose = o.pose || { mode: 'idle' }, mode = pose.mode || 'idle', tt = o.cast ? o.t - o.cast.t0 : -1;
    const ns = o.cast ? netState(o.cast, Math.max(0, tt)) : null;
    const phaseKey = mode + (ns ? ns.phase : '');
    if (phaseKey !== lastPhase) {
      if (mode === 'throw' && lastPhase.indexOf('throw') !== 0) boatS.rollV += 0.5;
      if (ns && ns.phase === 'sink' && lastPhase.indexOf('flight') >= 0) boatS.pitchV += 0.12;
      if (mode === 'release') boatS.rollV -= 0.2;
      lastPhase = phaseKey;
    }
    {
      const k = 38, c = 3.2, sd = Math.min(dt, 0.033);
      boatS.rollV += (-k * boatS.roll - c * boatS.rollV) * sd; boatS.roll += boatS.rollV * sd;
      boatS.pitchV += (-k * 0.8 * boatS.pitch - c * boatS.pitchV) * sd; boatS.pitch += boatS.pitchV * sd;
      const haul = mode === 'haul' ? Math.sin((pose.u || 0) * TAU * 2.5) * 0.012 : 0;
      const sw = Math.sin(tReal * 1.15) * 0.012 + Math.sin(tReal * 0.7 + 1) * 0.006;
      const roll = boatS.roll + sw + haul, pitch = boatS.pitch + Math.sin(tReal * 0.9) * 0.005, bob = Math.sin(tReal * 1.3) * 0.012;
      boatRoot.position.y = bob; boatRoot.rotation.set(pitch, 0, roll);
      mirrorBoat.position.y = bob; mirrorBoat.rotation.set(pitch, 0, roll);
      boat.ring.scale.set(1 + Math.sin(tReal * 1.3) * 0.015, 1, 1);
    }

    // ---- the fisher (human clips + IK first; cloth and net read the posed bones afterwards) ----
    // 3D hand targets follow with a critically damped spring (so a change of mode never teleports a hand in depth)
    const hraw = hands3d(fx.hands, fx.mode, pose), hh = hraw;
    {
      const Hs = (S.hs ||= { p: hraw.map((p) => p.slice()), v: [[0, 0, 0], [0, 0, 0]], init: false });
      const w = 24, h = Math.min(dt, 0.05), ex = Math.exp(-w * h);
      for (let i = 0; i < 2; i++) for (let k = 0; k < 3; k++) {
        const x = Hs.p[i][k] - hraw[i][k], v = Hs.v[i][k], c1 = v + w * x;
        Hs.p[i][k] = hraw[i][k] + (x + c1 * h) * ex; Hs.v[i][k] = (v - w * c1 * h) * ex;
        hh[i][k] = Hs.p[i][k];
      }
    }
    const mapHand = (i) => ({ x: fx.hands[i][0], y: fx.hands[i][1] });
    void mapHand;
    // the head follows the net (or the water ahead)
    let look = null;
    if (ns) look = new THREE.Vector3(-ns.x, Math.max(0, ns.h), ns.z); else look = new THREE.Vector3(bx - 0.0, 0.9, 12);
    fisher.update({ hands: hh.map((p) => [p[0], p[1]]), z: hh.map((p) => p[2]), twist: fx.twist, grip: fx.grip, t: o.t, look }, o.t === undefined ? 0 : dt);
    const L = fisher.local, P = fisher.P;

    // ---- net ----
    const netIdx = o.cast ? o.cast.net : (pose.net ?? 0);
    net.setStyle(NETS[netIdx].col);
    const Rn = NETS[netIdx].R;
    let tg;  // target: x,y,z (three coords), r, bell, pitch, roll, spin, flutter, alpha, cord (bool), cordTo
    let spin = 0, flutter = 0, cordOn = false, drip = 0;
    if (ns) {
      const p3 = { x: -ns.x, z: ns.z };
      if (ns.phase === 'flight') {
        const u = ns.u, r = ns.r;
        tg = { x: p3.x, y: Math.max(0.05, ns.h), z: p3.z, r, bell: r * (0.8 * Math.pow(1 - u, 2) + 0.1), pitch: 0.22 * Math.sin(tt * 7) * (1 - u), roll: 0.28 * Math.sin(tt * 9 + 1) * (1 - u), a: 1 };
        spin = tt * 16; flutter = 1 - 0.6 * u; cordOn = true;
      } else if (ns.phase === 'sink') {
        const su = ns.u, r = ns.r * (1 - 0.18 * su * su);
        tg = { x: p3.x, y: ns.h, z: p3.z, r, bell: r * (0.1 + 1.1 * Math.pow(su, 1.3)), pitch: 0.05 * Math.sin(tt * 2.1), roll: 0.06 * Math.sin(tt * 1.7), a: 1 - 0.4 * clamp(-ns.h / 3.5, 0, 1) };
        spin = tt * 0.9; flutter = 0.1; cordOn = true;
      } else if (ns.phase === 'haul') {
        const r = ns.r;
        tg = { x: p3.x, y: ns.h, z: p3.z, r, bell: r * 1.15, pitch: 0.1 * Math.sin(tt * 3), roll: 0, a: 1 }; spin = tt * 0.5; cordOn = true; drip = 1;
      } else {
        const r = ns.r * (1 - 0.3 * ns.rel);
        tg = { x: p3.x, y: ns.h, z: p3.z, r, bell: r * 1.1, pitch: 0, roll: 0, a: 1 - ns.rel * 0.9 }; drip = 1 - ns.rel;
      }
    } else if (fx.mode === 'swing' && fx.ring) {
      const th = fx.ring.th, s = pose.s || 0, r = Rn * (0.17 + 0.21 * s);
      const c = anchor.localToWorld(new THREE.Vector3(lerp(0, -0.1, Math.sin(th)), 0.98 + 0.06 * Math.sin(th), 0.3));
      tg = { x: c.x, y: c.y, z: c.z, r, bell: r * (0.9 - 0.65 * s), pitch: 0.38 * Math.cos(th), roll: 0.55 * Math.sin(th), a: 1 };
      spin = th; flutter = 0.3 + 0.5 * s;
    } else {
      // folded over the right forearm and hanging from the hand
      const hnd = P.R_Hand;
      tg = { x: hnd.x + 0.0, y: hnd.y - 0.04, z: hnd.z + 0.02, r: 0.17, bell: 0.55, pitch: 0.12 * Math.sin(tReal * 1.4), roll: 0.1 * Math.sin(tReal * 1.1 + 1), a: 1 };
      spin = tReal * 0.2;
    }
    {
      // critically damped follow: continuous position AND velocity through every change of net phase
      const w = 20, h = Math.min(dt, 0.05), ex = Math.exp(-w * h);
      if (!netS.init) { for (const k of ['x', 'y', 'z', 'r', 'bell', 'pitch', 'roll', 'a']) { netS[k] = tg[k]; netS['v' + k] = 0; } netS.init = true; }
      else for (const k of ['x', 'y', 'z', 'r', 'bell', 'pitch', 'roll', 'a']) {
        const x = netS[k] - tg[k], v = netS['v' + k], c1 = v + w * x;
        netS[k] = tg[k] + (x + c1 * h) * ex; netS['v' + k] = (v - w * c1 * h) * ex;
      }
      net.set({ x: netS.x, y: netS.y, z: netS.z, r: netS.r, bell: netS.bell, pitch: netS.pitch, roll: netS.roll, spin, flutter, alpha: netS.a, t: tReal });
      net.setVisible(true);
    }
    // the cord from the right hand to the net, sagging, going under water with it
    cord.visible = cordOn;
    if (cordOn) {
      const a = P.R_Hand, bpt = tmp2.set(netS.x, netS.y, netS.z);
      for (let i = 0; i < CN; i++) {
        const u = i / (CN - 1), sag = Math.sin(Math.PI * u) * (ns && ns.phase === 'flight' ? 0.12 : 0.35);
        cordPos[i * 3] = lerp(a.x, bpt.x, u); cordPos[i * 3 + 1] = lerp(a.y, bpt.y, u) - sag; cordPos[i * 3 + 2] = lerp(a.z, bpt.z, u);
      }
      cordGeo.attributes.position.needsUpdate = true;
    }

    // ---- ripples, foam bursts ----
    const rips = U.uRip.value; let ri = 0;
    const ws = o.ripples || [];
    for (let i = ws.length - 1; i >= 0 && ri < 9; i--) {
      const rp = ws[i], age = o.t - rp.t0;
      if (age < 0 || age > 3.2) continue;
      rips[ri++].set(-rp.x, rp.z, age, rp.s);
    }
    if (o.world) {
      const t = o.t;
      for (let si = 0; si < o.world.shoals.length && ri < 14; si++) {
        const sh = o.world.shoals[si];
        if (sh.depth > 2.0 && o.world.vis < 0.8) continue;
        const per = 1.5, kk = Math.floor(t / per + sh.p1 * 3), age = (t / per + sh.p1 * 3 - kk) * per;
        if (age > 1.1) continue;
        const fi = (kk * 7 + si) % sh.fish.length;
        const fp = fishPosDuring(o.world, null, null, si, fi, t, { x: 0, z: 0 });
        rips[ri++].set(-fp.x, fp.z, age * 1.0, 0.22 * (sh.depth > 2 ? 0.5 : 1));
      }
    }
    for (; ri < 14; ri++) rips[ri].set(0, 0, 0, 0);
    if (o.ripples) for (const rp of o.ripples) {
      if (rp.t0 > lastRip && rp.s >= 0.6 && o.t - rp.t0 < 0.3) {
        const sp = splashes.reduce((a, b) => (a.t0 < b.t0 ? a : b));
        sp.t0 = o.t; sp.r = rp.s * 1.0; sp.m.position.set(-rp.x, 0.05, rp.z); sp.m.visible = true;
      }
      if (rp.t0 > lastRip) lastRip = rp.t0;
    }
    if (o.t < lastRip - 1) lastRip = -1;
    for (const sp of splashes) {
      const u = (o.t - sp.t0) / 0.8;
      if (u < 0 || u > 1) { sp.m.visible = false; continue; }
      sp.m.visible = true; sp.m.scale.setScalar(sp.r * (0.4 + 1.3 * Math.sqrt(u))); sp.m.material.opacity = 0.8 * (1 - u) * (1 - u);
    }

    // ---- fish ----
    {
      const world3 = o.world, cast = o.cast, t = o.t, vis = world3 ? world3.vis : 1;
      const counts = new Array(SPECIES.length).fill(0), FP = { x: 0, z: 0 }, FQ = { x: 0, z: 0 };
      let nf = 0;
      if (world3) for (let si = 0; si < world3.shoals.length; si++) {
        const sh = world3.shoals[si], sp = SPECIES[sh.sp];
        for (let fi = 0; fi < sh.fish.length; fi++) {
          const fs = sh.fish[fi], key2 = si * 100 + fi;
          const rec = cast && cast.caughtIdx ? cast.caughtIdx[key2] : null;
          const inNet = rec && cast && tt >= FLIGHT + rec.tc;
          let x, z, dep = fs.depth, a = 1, dx, dz;
          if (inNet && ns) {
            const cc = { x: cast.x + cast.res.drift.x * rec.tc, z: cast.z + cast.res.drift.z * rec.tc };
            const ox = rec.x - cc.x, oz = rec.z - cc.z;
            if (ns.phase === 'release') {
              const u = ns.rel, k = (hs(key2 * 3 + 1) - 0.5) * 2.4, away = 0.4 + 2.2 * u * (0.7 + 0.6 * hs(key2));
              x = ns.x + ox * 0.2 + k * away; z = ns.z + oz * 0.2 + (0.8 + hs(key2 + 9)) * away; dep = fs.depth * u * 0.8 + 0.1; a = 1 - u * u;
              dx = k; dz = 0.8; if (a <= 0.02) continue;
            } else {
              x = ns.x + ox * ns.contract; z = ns.z + oz * ns.contract;
              dep = ns.phase === 'sink' ? Math.max(fs.depth, -ns.h) : Math.max(0, -ns.h + hs(key2) * 0.2);
              const an = fs.ph + t * 6 * (ns.phase === 'haul' ? 2 : 0.5); dx = Math.cos(an); dz = Math.sin(an);
            }
          } else {
            fishPosDuring(world3, cast ? cast.res : null, cast || null, si, fi, t, FP); x = FP.x; z = FP.z;
            fishPosDuring(world3, cast ? cast.res : null, cast || null, si, fi, t + 0.12, FQ); dx = FQ.x - x; dz = FQ.z - z;
          }
          if (z < 0.2) continue;
          if (counts[sh.sp] >= fish.cap) continue;
          const fleeing = cast && tt > FLIGHT && !inNet;
          const wag = Math.sin(t * (fleeing ? 16 : 6.5) + fs.ph * 3) * (fleeing ? 1.0 : 0.6);
          // heading (three coords: x is mirrored)
          const yaw = Math.atan2(-dz, -dx) + wag * (fleeing ? 0.32 : 0.2);
          const bob = inNet && ns && ns.phase !== 'sink' ? 0 : Math.sin(t * 1.3 + fs.ph) * 0.03;
          const L2 = sp.len * FISH_SCALE * 0.6 * fs.sz / FISH_LEN;
          e.set(wag * 0.12, yaw, 0, 'YXZ'); q.setFromEuler(e);
          tmp.set(-x, -dep + bob, z); sc.set(L2, L2, L2 * 1.1);
          m4.compose(tmp, q, sc);
          const mesh = fish.meshes[sh.sp], i = counts[sh.sp]++;
          mesh.setMatrixAt(i, m4);
          const deepFade = 1 - 0.14 * dep, base = inNet && ns && ns.phase !== 'sink' ? 1.5 : 0.9 + 0.9 * vis * deepFade;
          const g = clamp(base * a, 0.05, 1.9);
          tint.setRGB(g * 0.92, g * 1.0, g * 0.98);
          mesh.setColorAt(i, tint);
          // silver flash as the flank turns to the sun
          const fl = Math.pow(Math.max(0, Math.sin(t * 1.9 + fs.ph * 5.1)), 18) * (fleeing ? 1.4 : 1) * (0.4 + 0.6 * vis) * (sp.id === 1 || sp.id === 6 ? 1.2 : 0.7);
          if (fl > 0.12 && nf < 48 && dep < 2.8) { flash.set(nf++, -x, -dep + 0.08, z, 1.0 * fl, 0.95 * fl, 0.85 * fl); }
          void nf;
        }
      }
      fish.meshes.forEach((m, i) => { m.count = counts[i]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
      flash.done(nf);
    }

    // ---- spray from the sim, drips from the lifted net ----
    {
      const parts = o.parts || []; let n = 0;
      for (const p of parts) {
        if (n >= spray.n) break;
        const a = 1 - p.t / p.max; if (a <= 0) continue;
        spray.set(n++, -p.x, Math.max(0, p.y), p.z, 0.9 * a, 0.95 * a, 1.0 * a);
      }
      spray.done(n);
      let dn = 0;
      if (drip > 0.02 && netS.y > -0.2) {
        for (let i = 0; i < 30; i++) {
          const ph = hs(i * 7 + 3), u = ((tReal * (0.9 + ph * 0.6) + ph * 5) % 1), a = ph * TAU;
          const rr = netS.r * (0.7 + 0.3 * hs(i + 11)), y0 = netS.y - netS.bell;
          drips.set(dn++, netS.x + Math.cos(a) * rr * 0.9, Math.max(0.02, y0 - u * u * 1.4), netS.z + Math.sin(a) * rr * 0.9, 0.7 * drip * (1 - u), 0.8 * drip * (1 - u), 0.9 * drip * (1 - u));
        }
      }
      drips.done(dn);
    }

    // ---- aim / hint rings on the water ----
    const ov = o.overlay || {};
    const setRing = (g, d, color, discOp) => {
      if (!d) { g.visible = false; return; }
      g.visible = true; g.position.set(-d.x, 0.04, d.z); g.scale.set(d.r, 1, d.r);
      g.userData.ring.material.color.set(color);
      if (g.userData.disc) { g.userData.disc.material.color.set(color); g.userData.disc.material.opacity = discOp * 1.8; }
      g.rotation.y = d.rot || 0;
    };
    setRing(aimRing, ov.aim, ov.aim && ov.aim.wide ? '#7dffb0' : '#ffd36a', ov.aim && ov.aim.wide ? 0.16 : 0.1);
    if (ov.aim) { fullRing.visible = true; fullRing.position.set(-ov.aim.x, 0.04, ov.aim.z); fullRing.scale.set(ov.aim.rFull, 1, ov.aim.rFull); fullRing.userData.ring.material.opacity = 0.35; } else fullRing.visible = false;
    setRing(hintRing, ov.hint, '#ffc94a', 0.12);
    if (ov.hint) hintRing.rotation.y = tReal * 0.4;
    if (ov.aim) aimRing.rotation.y = tReal * 0.6;

    if (globalThis.__rec) {       // dev only: joint trace for the smoothness check (anchor-local metres) + net + boat
      const j = {}; for (const n in fisher.local) j[n] = [fisher.local[n].x, fisher.local[n].y, fisher.local[n].z];
      globalThis.__rec.push({ t: o.t, real: tReal, mode, j, net: [netS.x, netS.y, netS.z, netS.r], roll: boatS.roll, hat: [fisher.hat.position.x, fisher.hat.position.y, fisher.hat.position.z] });
    }
    world.step(tReal, dt, o.world ? o.world.cur : { x: 0.3, z: 0 });
    stage.update(0, { renderNow: false });      // humans are updated by the fisher module (above); nothing else is tracked
    stage.render();
    return true;
  };
  S.fisher = fisher; S.boat = boatS; S.world = world;
  S.active = () => !S.lost;
  S.ready = true;
  S.dispose = () => { try { stage.dispose(); } catch { /* ignore */ } };
  return S;
}

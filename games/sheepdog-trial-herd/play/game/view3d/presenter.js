// 3D presenter: READS the simulation (game.getState().sim, or the attract trial behind the menus) and shows the hill pasture, the flock, the dog and the handler.
// It never writes back. The simulation owns every position and time; animations are driven by the speeds and states it reports.
// Cameras are a function of the live screen shape: portrait frames the dog and the flock from behind and above, landscape from the side of the action.
import { buildWorld, updateWorld, applyAtmosphere } from './scene.js';
import { createAnimals } from './animals.js';
import { loadHandler } from './handler.js';
import { COURSES } from '../src/courses.js';

const LIB = '../vendor3d/index.js';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  // touch devices (phones and tablets, mostly mid-range GPUs): the safe default is 'medium'; the frame-time watcher below steps the pixel ratio down further
  let touch = false;
  try { touch = !!(globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches) || (nav.maxTouchPoints || 0) > 0; } catch { /* ignore */ }
  return weak || touch ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  const { createStage, THREE } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: quality !== 'low', shadowSize: 22 });
  if (!stage.supported) { canvas.remove(); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  stage.camera.near = 0.3; stage.camera.far = 900; stage.camera.fov = 44; stage.camera.updateProjectionMatrix();
  const P = { stage, THREE, ready: false, lost: false };
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  let sizeKey = '';
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; sizeKey = ''; stage.resize(); stage.invalidate(); });
  stage.lights.rim.intensity = 0.6;

  // ---- budget: the canvas fills the whole screen; on big screens the pixel ratio is lowered so the buffer stays about phone-sized
  const COARSE = (() => { try { return !!(globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches); } catch { return false; } })();
  const PIXELS = COARSE ? 1.5e6 : 2.0e6;
  let budgetR = 1, perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function sizeBudget(w, h) {
    const k = `${w}x${h}|${perfLevel}`;
    if (k !== sizeKey) {
      sizeKey = k; stage.resize();
      const dpr = Math.min(globalThis.devicePixelRatio || 1, 2, perfLevel ? 1.25 : 2);
      budgetR = Math.max(1, Math.min(dpr, Math.sqrt(PIXELS / Math.max(1, w * h))));
    }
    if (Math.abs(stage.renderer.getPixelRatio() - budgetR) > 0.01) { stage.renderer.setPixelRatio(budgetR); stage.invalidate(); }
  }
  function perfTick() {
    const now = performance.now();
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) { const avg = perfSum / perfN; perfN = 0; perfSum = 0; if (avg > 24 && perfLevel < 1) { perfLevel++; sizeKey = ''; stage.invalidate(); } }
  }

  // ---- the world, rebuilt when the course changes; the atmosphere when the time of day or weather does
  let world = null, animals = null, worldKey = '', atmoKey = '', atmo = { cloud: 0.6, wind: 0.15, rain: 0 };
  const worldGroup = new THREE.Group(); stage.scene.add(worldGroup);
  const cam = { pos: V(0, 30, -60), look: V(0, 0, 40), fov: 44, init: false };
  function ensureWorld(s) {
    const c = COURSES[s.course];
    if (worldKey !== s.course) {
      if (animals) animals.dispose();
      if (world) world.dispose();
      world = buildWorld(V3, stage, c, quality);
      animals = createAnimals(V3, worldGroup, c.n);
      worldKey = s.course; atmoKey = '';
      P.world = world; P.animals = animals;
      cam.init = false;
    }
    const ak = `${s.tod}|${s.weather}`;
    if (atmoKey !== ak) { atmoKey = ak; atmo = applyAtmosphere(stage, THREE, world, s.tod, s.weather); }
  }

  // ---- markers on the field: the balance point (a gold dashed ring behind the flock), the training ring, the lesson sector
  const mkMat = (color, op) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, side: THREE.DoubleSide, fog: false });
  const markers = new THREE.Group(); stage.scene.add(markers);
  const balance = new THREE.Group();
  for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1.0, 10, 1, (i / 10) * Math.PI * 2, 0.42 * Math.PI * 2 / 10 * 1.5), mkMat(0xf2c35b, 0.85)); balance.add(m); }
  balance.rotation.x = -Math.PI / 2; markers.add(balance);
  let ringMesh = null, ringKey = '', sectorMesh = null, sectorKey = '';
  function updateMarkers(s, G, hAt, dt) {
    const showBal = G.scene === 'play' && !s.over && s.bal && s.bal.on && (G.mode !== 'shot' || true);
    balance.visible = !!showBal;
    if (showBal) {
      const X = -s.bal.x, Z = s.bal.z, y = hAt(X, Z) + 0.12;
      const dcam = Math.hypot(cam.pos.x - X, cam.pos.z - Z, cam.pos.y - y), sc = clamp(dcam / 30, 1.4, 6);
      balance.position.set(X, y, Z); balance.scale.setScalar(sc); balance.children.forEach((m) => { m.material.opacity = 0.55 + 0.3 * Math.sin(tReal * 3); });
      balance.rotation.z += dt * 0.6;
    }
    // the training ring
    const L = s.training ? s.lesson : null, ring = L && L.ring ? L.ring : null;
    const rk = ring ? `${ring.x},${ring.z},${ring.r}` : '';
    if (rk !== ringKey) {
      ringKey = rk; if (ringMesh) { markers.remove(ringMesh); ringMesh.geometry.dispose(); ringMesh = null; }
      if (ring) { ringMesh = new THREE.Mesh(new THREE.RingGeometry(ring.r - 0.4, ring.r, 72), mkMat(0x2fe0b0, 0.9)); ringMesh.rotation.x = -Math.PI / 2; markers.add(ringMesh); }
    }
    if (ringMesh) { const X = -ring.x, Z = ring.z; ringMesh.position.set(X, hAt(X, Z) + 0.12, Z); ringMesh.material.opacity = L.done ? 0.3 : 0.6 + 0.3 * Math.sin(tReal * 3); }
    // the lesson sector (behind the flock, on the balance side)
    const sec = L && L.sector && !L.done;
    const sk = sec ? `${Math.round(s.rho)}|${Math.round(s.bal.ang * 12)}` : '';
    if (sk !== sectorKey) {
      sectorKey = sk; if (sectorMesh) { markers.remove(sectorMesh); sectorMesh.geometry.dispose(); sectorMesh = null; }
      if (sec) { const c0 = s.bal.ang + Math.PI; sectorMesh = new THREE.Mesh(new THREE.RingGeometry(s.rho + 6, s.rho + 36, 28, 1, c0 - 0.55, 1.1), mkMat(0xf2c35b, 0.28)); sectorMesh.rotation.x = -Math.PI / 2; markers.add(sectorMesh); }
    }
    if (sectorMesh) { const X = -s.cen.x, Z = s.cen.z; sectorMesh.position.set(X, hAt(X, Z) + 0.1, Z); }
  }

  // ---- the handler (loaded in the background; the picture works without him)
  let H = null;
  P.loading = loadHandler(V3, { lod: quality === 'high' ? 0 : 1 }).then((a) => { H = a; stage.add(a.h); stage.track(a.h); stage.invalidate(); P.H = a; }).catch((e) => { console.warn('handler failed to load', e); });
  P.ready = true;

  // ---- cameras. The director returns where the camera wants to be; the frame smooths towards it.
  const tmpV = V();
  function director(d) {
    const { aspect, mode, A, B, Hn, shift, land, chase, sceneT } = d;
    let pos, look, fov = aspect < 0.8 ? 52 : 44, k = 0.45, sh = 0;
    const vfov = (fov * Math.PI) / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * Math.min(aspect, 2.4));
    if (mode === 'menu') {
      // a low, wide look across the pasture with the dog at work, the action in the lower half so the title sits in the sky;
      // in landscape the action sits left of the menu column
      const M = V((A.x + B.x) / 2, 0, (A.z + B.z) / 2);
      const span = Math.max(24, Math.hypot(A.x - B.x, A.z - B.z) + 18);
      const az = 0.55 + Math.sin(sceneT * 0.04) * 0.2;
      const dist = clamp(span / (2 * Math.tan(Math.min(vfov, hfov) / 2)) * (land ? 0.8 : 0.62), 14, 120);
      pos = V(M.x - Math.sin(az) * dist, 3.2 + dist * 0.14, M.z - Math.cos(az) * dist);
      look = V(M.x, land ? 2.2 : 3.0 + dist * 0.1, M.z);
      sh = land ? shift : 0; k = 0.9;
      return { pos, look, fov, k, shift: sh };
    }
    if (mode === 'end') {
      const M = V(B.x, 0, B.z);
      const a = 0.6 + sceneT * 0.08;
      pos = V(M.x + Math.sin(a) * 15, 6.5, M.z - Math.cos(a) * 15); look = V(M.x, 1.0, M.z); fov = 40; k = 0.8; sh = land ? shift : 0;
      return { pos, look, fov, k, shift: sh };
    }
    if (chase) {
      const dx = B.x - A.x, dz = B.z - A.z, dl = Math.hypot(dx, dz) || 1, ux = dx / dl, uz = dz / dl;
      pos = V(A.x - ux * 5.8 + uz * 1.4, A.y + 2.3, A.z - uz * 5.8 - ux * 1.4);
      look = V(lerp(A.x, B.x, 0.55), A.y + 0.6, lerp(A.z, B.z, 0.55));
      fov = 52; k = 0.4;
      return { pos, look, fov, k, shift: 0 };
    }
    // auto: frame the dog and the flock (and the handler when he is walking) from behind, looking up the field
    const pts = [A, B]; void Hn;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    const rad = Math.max(d.flockR + 3.5, 7.5);
    const hw = (x1 - x0) / 2 + rad, hd = (z1 - z0) / 2 + rad;
    const M = V((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const pitch = land ? 0.5 : 0.52;
    const distW = hw / Math.tan(hfov / 2), distD = (hd * Math.sin(pitch) + 6) / Math.tan(vfov / 2);
    const dist = clamp(Math.max(distW, distD) * 1.12, 18, 330);
    const az = land ? 0.28 : 0.22;
    pos = V(M.x - Math.sin(az) * dist * Math.cos(pitch), M.y + dist * Math.sin(pitch) + 1.5, M.z - Math.cos(az) * dist * Math.cos(pitch));
    look = V(M.x, 0.5, M.z);
    k = 0.55;
    return { pos, look, fov, k, shift: sh };
  }

  // dev only: ?cd=dx,dy,dz,fov puts the camera at an offset from the dog (?cd=...&cdt=sheep for the lead ewe) looking at it
  const QS = (() => { try { return new URLSearchParams(globalThis.location.search); } catch { return new URLSearchParams(); } })();
  function dbgCam(dogS, cenS) {
    const cd = QS.get('cd'); if (!cd || !QS.has('dev')) return null;
    const [dx, dy, dz, fov] = cd.split(',').map(Number);
    const tgt = QS.get('cdt') === 'sheep' && world ? { x: -world.sheepX, y: 0, z: world.sheepZ } : QS.get('cdt') === 'hand' ? { x: 0, y: 0, z: 0 } : dogS;
    return { pos: V(tgt.x + dx, (tgt.y || 0) + dy, tgt.z + dz), look: V(tgt.x, (tgt.y || 0) + 0.45, tgt.z), fov: fov || 40, k: 0.01, shift: 0 };
  }

  // the handler: idle with the crook, walks to the pen, signals the commands
  let hFacing = 0, lastSig = 0, sigLeft = 0;
  function poseHandler(A, s, hs, dt, hAt) {
    const h = A.h;
    h.setPosition(-hs.x, hAt(-hs.x, hs.z), hs.z);
    const yaw = -hs.h; hFacing += ((((yaw - hFacing) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, 10 * dt); h.setFacing(hFacing, { snap: true });
    if (hs.v > 0.2) h.locomote(hs.v);
    else if (!sigLeft) h.crossfade('s_idle', 0.3, { loop: true });
    for (const e of s.events) {
      if (e.id <= lastSig) continue; lastSig = e.id;
      if (e.type === 'cmd' && hs.v < 0.3 && s.t - e.t < 0.5) {
        const clip = { comebye: 's_left', away: 's_right', walkon: 's_walk', lie: 's_lie', stand: 's_stand' }[e.cmd];
        if (clip) { h.play(clip, { fade: 0.12, loop: false }); sigLeft = 1.5; }
      }
    }
    sigLeft = Math.max(0, sigLeft - dt);
  }

  // the crook stands on the ground by the left hand while he waits and is carried when he walks
  function placeStaff(A, hs, hAt) {
    const hand = A.h.bones.Bip01_L_Hand; if (!hand) return;
    if (!A.staff.parent) stage.scene.add(A.staff);
    const p = hand.getWorldPosition(tmpV);
    const y0 = hAt(p.x, p.z), carry = hs.v > 0.2;
    A.staff.position.set(p.x, carry ? p.y - 0.7 : y0 + 0.76, p.z);
    A.staff.rotation.set(carry ? 0.5 : 0.05, -hs.h, carry ? 0.1 : 0);
  }

  // ---- the frame ----------------------------------------------------------------------------------------------------
  let tReal = 0, lastNow = 0;
  function frame(G, view) {
    if (!P.ready || P.lost) return;
    const nowMs = performance.now(); let dt = lastNow ? Math.min(0.05, (nowMs - lastNow) / 1000) : 0; lastNow = nowMs;
    const live = (G.scene === 'play' || G.scene === 'result') && G.sim;
    const s = live ? G.sim : G.attract;
    if (!s) { stage.setVisible(false); return; }
    stage.setVisible(true);
    const inPlay = G.scene === 'play' && !!G.sim;
    const frozen = !!(G.pauseMenu || G.think || (G.mode === 'watch' && G.watch && (G.watch.paused || G.watch.pending)) || (live && G.scene !== 'play') || (inPlay && G.sim.over));
    if (frozen) dt = 0;
    tReal += dt;
    ensureWorld(s);
    const w = canvas.clientWidth || 720, h = canvas.clientHeight || 1280, aspect = w / h;
    sizeBudget(w, h);
    const hAt = world.hAt;
    animals.updateFlock(s.sheep, s.dog, dt, tReal, hAt);
    animals.updateDog(s.dog, s.cen, dt, tReal, hAt);
    if (world) { world.sheepX = s.sheep[0].x; world.sheepZ = s.sheep[0].z; }
    const dogS = { x: -s.dog.x, y: hAt(-s.dog.x, s.dog.z), z: s.dog.z }, cenS = { x: -s.cen.x, y: hAt(-s.cen.x, s.cen.z), z: s.cen.z };
    const hs = s.hand, handS = { x: -hs.x, y: hAt(-hs.x, hs.z), z: hs.z, moving: hs.v > 0.1 };
    if (H) poseHandler(H, s, hs, dt, hAt);
    const dcam = Math.hypot(cam.pos.x - dogS.x, cam.pos.z - dogS.z, cam.pos.y - dogS.y);
    animals.dog.scale.setScalar(1.12 * clamp(dcam / 30, 1, 1.7));   // the dog stays findable when the camera is far
    animals.setRing(dogS.x, dogS.y, dogS.z, clamp(dcam / 28, 0.9, 5), clamp((dcam - 16) / 40, 0, 0.65) * (s.dog.cmd === 'lie' ? 0.6 : 1));
    updateMarkers(s, G, hAt, dt);
    updateWorld(world, THREE, dt, tReal, { wind: atmo.wind, cloud: atmo.cloud, rain: atmo.rain, penOpen: s.pen ? s.pen.open : false, cam: cam.pos });
    // camera
    const land = aspect > 1.1;
    const d = {
      aspect, mode: !inPlay && G.scene !== 'result' ? 'menu' : G.scene === 'result' ? 'end' : 'play', A: dogS, B: cenS, Hn: handS, land,
      shift: land ? 4.5 + (clamp(aspect, 1.1, 2.4) - 1.1) * 3.2 : 0, chase: !!(G.settings && G.settings.cam === 'chase' && inPlay), sceneT: tReal, flockR: s.rho,
    };
    let dr = director(d);
    const dbg = dbgCam(dogS, cenS);
    if (dbg) dr = dbg;
    const kk = dt > 0 ? 1 - Math.exp(-dt / Math.max(0.05, dr.k)) : (cam.init ? 0 : 1);
    if (!cam.init || G.frozen) { cam.pos.copy(dr.pos); cam.look.copy(dr.look); cam.fov = dr.fov; cam.init = true; } else { cam.pos.lerp(dr.pos, kk); cam.look.lerp(dr.look, kk); cam.fov = lerp(cam.fov, dr.fov, kk); }
    const c = stage.camera;
    if (Math.abs(c.fov - cam.fov) > 1e-3 || Math.abs(c.aspect - aspect) > 1e-4) { c.fov = cam.fov; c.aspect = aspect; c.updateProjectionMatrix(); }
    c.position.copy(cam.pos); c.lookAt(cam.look);
    if (dr.shift) { const r = tmpV.set(1, 0, 0).applyQuaternion(c.quaternion); c.position.addScaledVector(r, dr.shift); c.lookAt(cam.look.clone().addScaledVector(r, dr.shift)); }
    stage.setShadowTarget(lerp(dogS.x, cenS.x, 0.5), 0, lerp(dogS.z, cenS.z, 0.5));
    stage.update(dt, { renderNow: false });
    if (H) placeStaff(H, hs, hAt);
    if (!P.noRender) { stage.render(); perfTick(); }
    void view;
  }

  P.frame = frame; P.cam = cam;
  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      view.cssW = kitCanvas.clientWidth || 720; view.cssH = kitCanvas.clientHeight || 1280;
      r(ctx, view);
      frame(game.getState(), view);
    };
    return game;
  };
  return P;
}

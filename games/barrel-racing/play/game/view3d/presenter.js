// 3D presenter: READS the simulation through the game's per-frame view description (game.getState().v3) and draws the arena, the barrels, the
// horse with its rider, the rival's ghost horse and the dust. It never writes back. The camera is src/camera3d.js, the same maths the 2D guides
// use, so the lines drawn on the ground land exactly on the 3D dirt. Display is interpolated between the two latest sim ticks.
import { createRider, makeKerchief } from './rider.js';
import { buildField, buildBlobs, buildPuffs, makeBarrel, standLayouts } from './field.js';
import { FIG, HORSES, BARREL_R } from '../src/consts.js';

const LIB = '../vendor3d/index.js';
const DT = 1 / 60;
const lerp = (a, b, t) => a + (b - a) * t;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const LOOKS = [
  { name: 'Dawn', g0: '#cfa878', key: '#ffc7a0', keyI: 2.5, hemiSky: '#c0cce8', hemiGround: '#7a6048', hemi: 0.95, rim: '#ffd8b0', rimI: 1.0, exposure: 1.0, sky: '#6e7aa0', fog: '#a8a8b8', pos: [-30, 20, 16], night: 0 },
  { name: 'Day', g0: '#dbb985', key: '#fff4e2', keyI: 3.1, hemiSky: '#cfe0f2', hemiGround: '#8a7458', hemi: 1.05, rim: '#ffffff', rimI: 1.1, exposure: 1.02, sky: '#9cc4e8', fog: '#cfdde8', pos: [-18, 34, 16], night: 0 },
  { name: 'Afternoon', g0: '#d9b074', key: '#ffd9a2', keyI: 2.9, hemiSky: '#d4d8e0', hemiGround: '#8a6a48', hemi: 0.95, rim: '#ffe6c0', rimI: 1.0, exposure: 1.0, sky: '#a8bcd0', fog: '#d8cfc0', pos: [-26, 24, 18], night: 0 },
  { name: 'Dusk', g0: '#bf926a', key: '#ff9a72', keyI: 2.0, hemiSky: '#8e82b0', hemiGround: '#5a4048', hemi: 0.75, rim: '#ffb890', rimI: 0.9, exposure: 0.98, sky: '#4a3a5c', fog: '#6a5068', pos: [-30, 14, 10], night: 0.3 },
  { name: 'Floodlit', g0: '#ab8660', key: '#dbe4ff', keyI: 1.0, hemiSky: '#5a6a9a', hemiGround: '#3a3430', hemi: 0.55, rim: '#a8b8ff', rimI: 0.5, exposure: 1.18, sky: '#080c1c', fog: '#0c1226', pos: [-14, 36, 8], night: 1 },
];

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { stage: null, wrap: (g) => g, ready: Promise.resolve(false), active: () => false };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, THREE, loadHorse, createCrowd3d } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  let stage;
  try { stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: false, preserveDrawingBuffer: /[?&]shot=/.test(globalThis.location.search) }); } catch (e) { canvas.remove(); console.warn(e); return none; }
  if (!stage.supported) { canvas.remove(); return none; }

  const P = { stage, THREE, ready: false, lost: false, quality, events: [] };
  P.active = () => P.ready && !P.lost && !P.failed;
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; });

  const fieldState = buildField(stage, LOOKS[1]);
  const blobs = buildBlobs(6); stage.add(blobs.mesh);
  const puffs = buildPuffs(60); stage.add(puffs.mesh);
  const dust = buildPuffs(72); stage.add(dust.mesh);
  // clods of dirt thrown by the hooves: a small instanced pool with real gravity and a bounce
  const NCL = 64, clods = [];
  const clodMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 6, 4), new THREE.MeshStandardMaterial({ color: '#6a4a2c', roughness: 1 }), NCL);
  clodMesh.frustumCulled = false; stage.add(clodMesh);
  for (let i = 0; i < NCL; i++) clods.push({ life: 0, x: 0, y: -9, z: 0, vx: 0, vy: 0, vz: 0, s: 0.1, rx: 0, rz: 0 });
  let clodNext = 0;
  const spawnClod = (x, y, z, vx, vy, vz, s) => { const c = clods[clodNext]; clodNext = (clodNext + 1) % NCL; Object.assign(c, { life: 1.1, x, y, z, vx, vy, vz, s, rx: Math.random() * 6, rz: Math.random() * 6 }); };
  const barrels = [0, 1, 2].map(() => { const g = new THREE.Group(), m = makeBarrel(); m.position.y = -0.725; g.add(m); stage.add(g); return { g, m, axis: null }; });
  const lights = [];
  // the crowd: real 3D spectators on the terraces (crowd3d); the sim is never touched by it
  const crowdQ = quality === 'high' ? 'medium' : 'low';
  let crowd = null;
  // the arena camera sits 150 m away with a lens shift (a near-orthographic zoom): crowd3d culls by distance and by a symmetric fov, so it gets a
  // proxy camera that looks along the same ray from nearer with a matching field of view
  const crowdCam = new THREE.PerspectiveCamera(30, 1, 1, 300);
  const crowdOpts = { viewportHeight: 800, stands: standLayouts(quality === 'high' ? 1 : 0.6), seed: 11, culture: 'american_rural', quality: crowdQ, excitement: 0.3 };
  try { crowd = createCrowd3d({ scene: stage.scene, camera: crowdCam }, crowdOpts); } catch (e) { console.warn('crowd3d unavailable', e); }

  P.crowd = crowd; P.crowdCam = crowdCam;
  let horse = null, ghost = null, rider = null, kerchief = null;
  const sweatMats = [];
  P.ready_p = (async () => {
    const mk = async (o) => { const h = await loadHorse({ coat: 'bay', mane: 'loose', tack: 'western', quality: quality === 'high' ? 'high' : 'medium', ...o }); h.root.scale.setScalar(FIG); stage.add(h); return h; };
    horse = await mk({});
    rider = await createRider({ top: '#f1ead8', bottoms: '#2f4a78', skin: 'tan', hair: 'brown', lod: quality === 'high' ? 0 : quality === 'medium' ? 'medium' : 'light', seed: 3 });
    stage.add(rider.human);
    kerchief = makeKerchief('#c8372d'); stage.add(kerchief);
    const rd = horse.attachRider(rider.human, { style: 'western', hatColor: '#d8c294' });
    // the rider is drawn FIG times life size, so are the seat drop and the pole targets of the rider rig
    P.seat0 = rd.S.seat; P.pole0 = rd.S.pole;
    const setScale = (k) => { horse.root.scale.setScalar(k); rider.human.root.scale.setScalar(k); rd.S.seat = P.seat0 * k; rd.S.pole = P.pole0 * k; kerchief.userData.k = k; P.scaleK = k; };   // in place: the rider rig reads this very object
    P.setScale = setScale; setScale(FIG);
    P.rd = rd;
    horse.root.traverse((o) => { if (o.isMesh && o.userData.cls && /body|coat|skin/i.test(o.userData.cls) && o.material.clearcoat !== undefined) sweatMats.push(o.material); });
    P.horse = horse; P.rider = rider;
    horse.on('hoof', (e) => { P.hoofs.push(e); });
    // the rival's ghost horse: pale blue-grey and see-through
    ghost = await mk({ coat: 'grey', tack: 'none', quality: 'medium' });
    ghost.root.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); Object.assign(o.material, { transparent: true, opacity: 0.45, depthWrite: false }); o.material.color && o.material.color.set('#9bbbe0'); o.renderOrder = 2; } });
    ghost.root.visible = false;
    P.ready = true; stage.invalidate();
  })();
  P.ready_p.catch((e) => { console.warn('3D rider failed to load', e); P.failed = true; });
  P.hoofs = [];

  // ---- time of day: lights, sky and ground
  function applyLook(i) {
    const L = LOOKS[Math.max(0, Math.min(LOOKS.length - 1, i | 0))];
    stage.setLighting('day', { key: L.key, keyI: L.keyI, hemiSky: L.hemiSky, hemiGround: L.hemiGround, hemi: L.hemi, rim: L.rim, rimI: L.rimI, exposure: L.exposure, sky: L.sky, fog: L.fog });
    stage.setSky(L.sky, L.fog, { near: 120, far: 380 });
    stage.lights.key.position.set(L.pos[0], L.pos[1], L.pos[2]);
    stage.lights.key.target.position.set(0, 0, -21);
    stage.lights.rim.position.set(14, 10, -40);
    if (fieldState) fieldState.dirt.color.set(L.night > 0.5 ? '#8f8a94' : L.night > 0 ? '#c8b0b0' : '#ffffff');
    // floodlight pools on the ground at night
    for (const q of lights) { stage.scene.remove(q); q.geometry.dispose(); }
    lights.length = 0;
    if (L.night > 0.5) {
      const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, 'rgba(255,246,214,0.55)'); g.addColorStop(1, 'rgba(255,246,214,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
      for (const [lx, ly] of [[-12, 2], [12, 2], [-12, 22], [12, 22], [-12, 42], [12, 42]]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
        m.rotation.x = -Math.PI / 2; m.position.set(lx, 0.03, -ly); m.renderOrder = 2; stage.scene.add(m); lights.push(m);
      }
    }
    stage.invalidate();
  }

  // ---- display interpolation of the rider: the two latest sim ticks
  let curSnap = null, prevSnap = null, curStamp = 0, lastRun = null, lastT = -1, lastTr = 0, seen = -1, lastLook = -1, wallLast = 0, whipT = -1, sweat = 0, ghostTh = null;
  const nowMs = () => (P.clock ? P.clock() : performance.now());
  const snap = (s) => ({ t: s.t, x: s.x, y: s.y, th: s.th, v: s.v, yaw: s.yaw, steer: s.sAct, burst: s.burstT > 0 });
  const tmpT = new THREE.Vector3(), camQ = new THREE.Quaternion(), tgt = new THREE.Vector3(), pv = new THREE.Vector3(), qa = new THREE.Quaternion(), wp = new THREE.Vector3(), anchor = new THREE.Vector3(), wind = new THREE.Vector3();
  const mtx = new THREE.Matrix4(), cq = new THREE.Quaternion(), cs3 = new THREE.Vector3(), cp3 = new THREE.Vector3(), ce = new THREE.Euler();
  const bState = [0, 1, 2].map(() => ({ down: false, age: 0, dx: 0, dz: 1, side: 1, t: 0, roll: 0, wob: 0, wx: 0, wz: 1, wt: 0 }));
  // the right hand's seat-frame target for the quirt: rest at the thigh, cocked up, strike forward
  const REST = [-0.23, 0.10, 0.08], COCK = [-0.30, 0.62, 0.0], HIT = [-0.16, 0.30, 0.62];
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const ease = (k) => k * k * (3 - 2 * k);


  // ---- the hero scene behind the title: the rider and her horse standing in the dusk light in front of the stands, real size
  const HERO = { at: [-15.5, 0, -17.5], cam: [5.4, 1.5, 4.6], aim: 1.75 };
  let heroLast = null, heroSnort = -1;
  function heroFrame(V) {
    const W = canvas.clientWidth || 720, H = canvas.clientHeight || 1280, cam = stage.camera;
    if (P.scaleK !== 1) P.setScale(1);
    P.warmed = false;
    const t = V.t || 0;
    let dt = heroLast === null ? 1 / 60 : t - heroLast; heroLast = t; if (dt < 0 || dt > 0.1) dt = 1 / 60;
    const dr = 0.14 * Math.sin(t * 0.12), cx = HERO.cam[0], cz = HERO.cam[2], cs = Math.cos(dr), sn = Math.sin(dr);
    cam.position.set(HERO.at[0] + cx * cs - cz * sn, HERO.cam[1] + 0.12 * Math.sin(t * 0.2), HERO.at[2] + cx * sn + cz * cs);
    tgt.set(HERO.at[0], HERO.aim, HERO.at[2]); cam.up.set(0, 1, 0); cam.lookAt(tgt);
    cam.near = 0.3; cam.far = 400; cam.fov = 30; cam.aspect = W / H;
    // the window the menu leaves clear: the horse and rider (3.4 m tall, about 3.2 m long in three-quarter view) are fitted into it
    const r = V.hero, pxH = Math.max(120, r.h / V.H * H * 1.12), pxW = r.w / V.W * W;
    const sx = (r.x + r.w / 2) / V.W * W, sy = (r.y + r.h * 0.5) / V.H * H - pxH * 0.04;
    const tanH = Math.tan(15 * Math.PI / 180), d0 = 3.1 * H / (2 * tanH * 0.98 * pxH), dW = 3.4 * H / (2 * tanH * 0.92 * Math.max(120, pxW));
    const dist = Math.max(d0, dW), base = Math.hypot(HERO.cam[0], HERO.cam[1], HERO.cam[2]), k = dist / base;
    cam.position.set(HERO.at[0] + (cx * cs - cz * sn) * k, HERO.cam[1] * k * 0.8 + 0.12 * Math.sin(t * 0.2), HERO.at[2] + (cx * sn + cz * cs) * k);
    tgt.set(HERO.at[0], HERO.aim, HERO.at[2]); cam.lookAt(tgt);
    cam.clearViewOffset(); cam.setViewOffset(W, H, -(sx - W / 2), -(sy - H / 2), W, H);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true); camQ.copy(cam.quaternion);
    if (lastLook !== 3) { lastLook = 3; applyLook(3); }
    horse.setPosition(HERO.at[0], 0, HERO.at[2]); horse.setFacing(Math.atan2(HERO.cam[0], HERO.cam[2]) + 0.75 + 0.05 * Math.sin(t * 0.3));
    horse.drive(0, 0);
    if (P.coat !== (V.horse | 0)) { P.coat = V.horse | 0; horse.setCoat(['darkbay', 'bay', 'palomino'][P.coat] || 'chestnut'); }
    // now and then she snorts and shakes her head
    const ph = t % 16;
    if (ph > 6 && heroSnort !== 1) { heroSnort = 1; horse.play('snort'); } else if (ph > 12 && heroSnort !== 2) { heroSnort = 2; horse.play('shake'); } else if (ph < 3 && heroSnort !== 0) { heroSnort = 0; horse.play('idle'); }
    if (P.rd) P.rd.S.R = REST;
    horse.update(dt);
    horse.root.visible = true; rider.human.root.visible = true; if (ghost) ghost.root.visible = false;
    blobs.set(0, HERO.at[0], HERO.at[2], horse.root.rotation.y, 1.35, 0.62); blobs.hide(1);
    if (kerchief) { kerchief.visible = true; rider.human.bones.Bip01_Neck.getWorldPosition(anchor); anchor.y -= 0.05; wind.set(0.05 * Math.sin(t * 1.3), 0.0, 0.04); kerchief.userData.update(anchor, wind, dt, t); }
    // one barrel stands beside her
    for (let i = 0; i < 3; i++) { barrels[i].g.visible = i === 0; blobs.hide(2 + i); }
    barrels[0].g.scale.setScalar(0.52); barrels[0].g.position.set(HERO.at[0] - 3.4, 0.725 * 0.52, HERO.at[2] - 2.2); barrels[0].g.quaternion.identity(); barrels[0].m.rotation.y = 0;
    blobs.set(2, HERO.at[0] - 3.3, HERO.at[2] - 2.1, 0, 0.5, 0.5, 0.03);
    // warm motes drift in the dusk light
    if (quality !== 'low' && Math.random() < dt * 5) puffs.spawn(HERO.at[0] + (Math.random() - 0.3) * 7, 0.4 + Math.random() * 2.4, HERO.at[2] + (Math.random() - 0.6) * 5, 0.05 + Math.random() * 0.1, 0.05, 0.02, 4, 0.05, 0.1);
    puffs.update(Math.min(dt, 0.05), camQ);
    dust.setList([], camQ);
    for (let i = 0; i < NCL; i++) { cp3.set(0, -9, 0); cs3.setScalar(0.0001); mtx.compose(cp3, cq.identity(), cs3); clodMesh.setMatrixAt(i, mtx); clodMesh.instanceMatrix.needsUpdate = true; }
    if (crowd) {
      crowdCam.position.copy(cam.position); crowdCam.quaternion.copy(cam.quaternion); crowdCam.fov = 62; crowdCam.aspect = W / H; crowdCam.updateProjectionMatrix(); crowdCam.updateMatrixWorld(true);
      crowdOpts.viewportHeight = H * 0.5;
      crowd.setExcitement(0.18); crowd.update(dt);
    }
    if (!P.noRender) { stage.render(); P.drawCalls = stage.renderer.info.render.calls; P.tris = stage.renderer.info.render.triangles; }
  }

  function frame(game) {
    const G = game.getState(), V = G.v3;
    if (!P.ready || P.lost || !V) { stage.setVisible(false); return; }
    stage.setVisible(true);
    if (V.hero) { heroFrame(V); return; }
    if (P.scaleK !== FIG) { P.setScale(FIG); P.warmed = false; }
    barrels[0].g.scale.setScalar(1);
    heroLast = null;
    const cam0 = stage.camera; if (cam0.view) cam0.clearViewOffset();
    const R = V.rig, s = V.run;
    // camera (the exact camera the 2D guides project through)
    const W = canvas.clientWidth || 720, H = canvas.clientHeight || 1280;
    const cam = stage.camera;
    cam.position.set(R.pos[0], R.pos[1], R.pos[2]); cam.up.set(0, 1, 0);
    tgt.set(R.pos[0] + R.f[0], R.pos[1] + R.f[1], R.pos[2] + R.f[2]); cam.lookAt(tgt);
    cam.near = R.near; cam.far = R.far; cam.fov = 40; cam.aspect = W / H; cam.updateProjectionMatrix();
    const e = cam.projectionMatrix.elements; e[0] = R.P0; e[5] = R.P5; e[8] = R.P8; e[9] = R.P9;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    cam.updateMatrixWorld(true); camQ.copy(cam.quaternion);
    if (V.look !== lastLook) { lastLook = V.look; applyLook(V.look); }
    // the rider's horse colour follows the chosen horse
    const hk = V.horse | 0;
    if (P.coat !== hk) { P.coat = hk; horse.setCoat(['darkbay', 'bay', 'palomino'][hk] || 'chestnut'); }

    const stamp = nowMs();
    let dt = 0, Tr = lastTr, pace = 0, warm = !P.warmed;
    P.hoofs.length = 0;
    // ---- the rider and horse
    if (s) {
      if (s !== lastRun) { lastRun = s; curSnap = prevSnap = null; lastT = -1; seen = s.evId - 1; lastTr = s.t; whipT = -1; sweat = 0; for (const st of bState) { st.down = false; st.wob = 0; st.roll = 0; } }
      if (s.t !== lastT) { prevSnap = curSnap || snap(s); curSnap = snap(s); curStamp = stamp; lastT = s.t; if (Math.abs(curSnap.t - prevSnap.t) > 0.1) prevSnap = curSnap; }
      const alpha = curSnap === prevSnap ? 1 : Math.min(1, Math.max(0, (stamp - curStamp) / (DT * 1000)));
      Tr = lerp(prevSnap.t, curSnap.t, alpha);
      dt = Tr - lastTr; if (dt < 0 || dt > 0.1) { dt = 0; warm = true; } lastTr = Tr;
      const X = lerp(prevSnap.x, curSnap.x, alpha), Y = lerp(prevSnap.y, curSnap.y, alpha);
      const th = prevSnap.th + wrapA(curSnap.th - prevSnap.th) * alpha;
      const v = lerp(prevSnap.v, curSnap.v, alpha), yaw = lerp(prevSnap.yaw, curSnap.yaw, alpha);
      pace = v;
      for (const ev of s.events) {
        if (ev.id <= seen) continue;
        seen = ev.id; P.events.push(ev); if (P.events.length > 60) P.events.shift();
        if (ev.type === 'burst') whipT = 0;
        const bb = (s.barrels || [])[ev.barrel];
        if (ev.type === 'knock' && crowd && bb) crowd.react('gasp', { origin: [bb.x, 0, -bb.y], radius: 60, intensity: 1 });
        else if (ev.type === 'barrel' && crowd) crowd.react('cheer', { origin: [X, 0, -Y], radius: 30, intensity: 0.35 });
        else if (ev.type === 'finish' && crowd) crowd.react(s.knocked === 0 && !s.dnf ? 'ovation' : s.dnf ? 'groan' : 'cheer', { origin: [0, 0, 0], radius: 90, intensity: 1 });
      }
      // horse: position and heading from the sim (+Z forward in horse3d; heading = PI - th), gait from the distance travelled
      horse.setPosition(X, 0, -Y); horse.setFacing(Math.PI - th);
      horse.drive(v / FIG, -yaw);
      // the right hand: the quirt swing of the Burst, otherwise at rest
      if (P.rd) {
        let tgtR = REST;
        if (whipT >= 0) {
          whipT += dt;
          if (whipT < 0.12) tgtR = mix(REST, COCK, ease(whipT / 0.12));
          else if (whipT < 0.3) tgtR = mix(COCK, HIT, ease((whipT - 0.12) / 0.18));
          else if (whipT < 0.7) tgtR = mix(HIT, REST, ease((whipT - 0.3) / 0.4));
          else whipT = -1;
        }
        P.rd.S.R = tgtR;
      }
      if (warm && v > 0.5) { for (let i = 0; i < 70; i++) horse.update(1 / 60); P.warmed = true; }
      else if (warm) { for (let i = 0; i < 4; i++) horse.update(1 / 60); P.warmed = true; }
      horse.update(dt > 1e-4 ? dt : 1e-5);
      sweat = Math.min(1, sweat + dt / 40);
      for (const m of sweatMats) { m.clearcoat = 0.05 + 0.5 * sweat; m.clearcoatRoughness = 0.5 - 0.3 * sweat; m.roughness = 0.62 - 0.2 * sweat; }
      horse.root.visible = true; rider.human.root.visible = true;
      blobs.set(0, X, -Y, Math.PI - th, 1.35 * FIG, 0.62 * FIG);
      // hoof dust and clods; grit flies backward and sideways, more when the horse digs in on a turn
      const slip = Math.min(1, Math.abs(yaw) * v / 14);
      for (const fe of P.hoofs) {
        if (v < 3.5 || quality === 'low') continue;
        const L = horse.legs.find((l) => l.side === fe.side && l.front === fe.front);
        if (!L) continue;
        L.bones[L.bones.length - 1].getWorldPosition(wp);
        const hd = Math.PI - th, bx = -Math.sin(hd), bz = -Math.cos(hd);
        const sz = 0.3 + 0.35 * Math.min(1, v / 12) + 0.3 * slip;
        puffs.spawn(wp.x, 0.1, wp.z, bx * (0.8 + 0.1 * v) * 0.4, 0.5 + 0.8 * slip, bz * (0.8 + 0.1 * v) * 0.4, 0.5 + 0.5 * slip, sz, sz * 3.4);
        const nc = 1 + (slip > 0.35 ? 2 : 0) + (v > 9 ? 1 : 0);
        for (let k = 0; k < nc; k++) spawnClod(wp.x, 0.12, wp.z, bx * (2 + Math.random() * 0.25 * v) + (Math.random() - 0.5) * 2, 1.8 + Math.random() * 2.2 + slip * 1.5, bz * (2 + Math.random() * 0.25 * v) + (Math.random() - 0.5) * 2, 0.045 + Math.random() * 0.05);
      }
      // the sim's own dust (turns, knocked barrels)
      const list = [];
      for (const p of s.particles) { const a = Math.max(0, p.life / p.max); list.push({ x: p.x, y: 0.25 + (1 - a) * 0.5, z: -p.y, s: (p.size + (1 - a) * 0.9) * 1.8 }); }
      dust.setList(list, camQ);
      // neckerchief: streams back on the wind of the ride, whips outward on a turn
      if (kerchief && rider.human.bones.Bip01_Neck) {
        rider.human.bones.Bip01_Neck.getWorldPosition(anchor); anchor.y -= 0.05 * FIG;
        const hd = Math.PI - th;
        wind.set(-Math.sin(hd) * v * 0.55, 0.4 + v * 0.02, -Math.cos(hd) * v * 0.55);
        kerchief.userData.update(anchor, wind, Math.max(dt, 0), Tr);
      }
    } else {
      horse.root.visible = false; rider.human.root.visible = false; blobs.hide(0);
      if (kerchief) kerchief.visible = false;
      dust.setList([], camQ);
    }
    if (kerchief && s) kerchief.visible = true;
    // ghost
    if (V.ghost && ghost) {
      const gh = V.ghost;
      ghost.setPosition(gh.x, 0, -gh.y); ghost.setFacing(Math.PI - gh.th);
      const gyaw = ghostTh === null ? 0 : -wrapA(gh.th - ghostTh) / Math.max(dt, 1 / 120) * (dt > 0 ? 1 : 0);
      ghostTh = gh.th;
      ghost.drive((gh.v || 9) / FIG, Math.max(-2.5, Math.min(2.5, gyaw)));
      if (!P.gwarm) { for (let i = 0; i < 70; i++) ghost.update(1 / 60); P.gwarm = true; }
      ghost.update(dt > 1e-4 ? dt : 1e-5);
      ghost.root.visible = true;
      blobs.set(1, gh.x, -gh.y, Math.PI - gh.th, 1.35 * FIG, 0.62 * FIG);
    } else { if (ghost) ghost.root.visible = false; ghostTh = null; blobs.hide(1); }
    // puffs, clods, crowd
    const pdt = Math.max(0, Math.min(0.05, dt));
    puffs.update(pdt, camQ);
    for (let i = 0; i < NCL; i++) {
      const c = clods[i];
      if (c.life > 0 && pdt > 0) {
        c.life -= pdt; c.vy -= 9.8 * pdt; c.x += c.vx * pdt; c.y += c.vy * pdt; c.z += c.vz * pdt;
        if (c.y < 0.05) { c.y = 0.05; c.vy *= -0.3; c.vx *= 0.5; c.vz *= 0.5; }
        c.rx += pdt * 9; c.rz += pdt * 7;
      }
      const k = c.life > 0 ? Math.min(1, c.life / 0.25) : 0;
      ce.set(c.rx, 0, c.rz); cq.setFromEuler(ce); cs3.setScalar(Math.max(0.0001, c.s * k)); cp3.set(c.x, c.life > 0 ? c.y : -9, c.z);
      mtx.compose(cp3, cq, cs3); clodMesh.setMatrixAt(i, mtx);
    }
    clodMesh.instanceMatrix.needsUpdate = true;
    if (crowd) {
      const D0 = 150, near0 = 70, pe = cam.projectionMatrix.elements;
      // the real view is a lens-shifted frustum: its centre ray leaves the optical axis by (e8/e0, e9/e5) tangent units
      const rx = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion), uy = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion), fz = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      tmpT.copy(fz).addScaledVector(rx, pe[8] / pe[0]).addScaledVector(uy, pe[9] / pe[5]).normalize();
      crowdCam.position.copy(cam.position).addScaledVector(tmpT, D0 - near0);
      crowdCam.lookAt(tmpT.add(crowdCam.position));
      // a symmetric cone that still contains everything the real frustum sees from the nearer apex (points at ~105 m real depth are the worst case)
      const amp = 105 / (105 - (D0 - near0)), tY = Math.min(2.4, 1.1 * amp / pe[5]), tX = Math.min(2.4 * 0.8, 1.1 * amp / pe[0]);
      crowdCam.fov = 2 * Math.atan(tY) * 180 / Math.PI; crowdCam.aspect = tX / tY;
      // keep the on-screen size estimate (LOD) true to the real camera: px = 1.78 s * vh / (2 tanH) / depth
      crowdOpts.viewportHeight = Math.max(100, (canvas.clientHeight || 844) * pe[5] * tY * 0.5);
      crowdCam.updateMatrixWorld(true);
      const wallDt = Math.min(0.05, Math.max(0, (stamp - wallLast) / 1000)); wallLast = stamp;
      crowd.setExcitement(Math.min(1, 0.22 + pace / 16 + (s && s.finished ? 0.4 : 0)));
      crowd.update(dt > 0 ? dt : wallDt * 0.0);
    }
    // barrels: stand up, wobble when brushed, tip over and roll away
    const bars = (s ? s.barrels : V.barrels) || [];
    for (let i = 0; i < 3; i++) {
      const o = barrels[i], b = bars[i], st = bState[i];
      if (!b) { o.g.visible = false; blobs.hide(2 + i); continue; }
      o.g.visible = true;
      o.g.position.set(b.x, 0.725, -b.y);
      if (b.down) {
        if (!st.down) {
          st.down = true; st.t = 0; st.roll = 0;
          const l = Math.hypot(b.vx, b.vy) || 1; st.dx = b.vx / l; st.dz = -b.vy / l;
          // topples to the side the rider was not on
          st.side = s && ((s.x - b.x) * st.dz - (-s.y + b.y) * st.dx) > 0 ? -1 : 1;
        }
        st.t += dt;
        const tilt = Math.min(1, b.age / 0.28), k = 1 - Math.pow(1 - tilt, 2.2);
        const over = Math.PI / 2 - 0.02;
        const bounce = tilt >= 1 ? Math.max(0, Math.sin(Math.min(1, (b.age - 0.28) / 0.35) * Math.PI)) * 0.1 : 0;
        qa.setFromAxisAngle(pv.set(st.dx, 0, st.dz), st.side * (k * over + bounce * 0.15));
        o.g.quaternion.copy(qa);
        const sp = Math.hypot(b.vx, b.vy);
        st.roll += sp * dt / (BARREL_R * 1.25);
        o.m.rotation.y = st.roll * st.side;
        o.g.position.y = lerp(0.725, 0.62, k) + bounce * 0.2;
        blobs.set(2 + i, b.x, -b.y, 0, 0.85, 0.85, 0.03);
      } else {
        st.down = false;
        // a brush wobble: damped swing away from the rider
        if (s && s.phase === 'ride') {
          const dx = b.x - s.x, dz = -b.y + s.y, d = Math.hypot(dx, dz);
          if (d < 2.2) { const amp = (2.2 - d) / 2.2 * Math.min(1, s.v / 9) * 0.22; if (amp > st.wob) { st.wob = amp; st.wx = dx / (d || 1); st.wz = dz / (d || 1); st.wt = 0; } }
        }
        st.wt += dt; st.wob *= Math.exp(-3.2 * dt);
        const a = st.wob * Math.cos(st.wt * 16);
        qa.setFromAxisAngle(pv.set(st.wz, 0, -st.wx), -a);
        o.g.quaternion.copy(qa);
        o.m.rotation.y = 0;
        blobs.set(2 + i, b.x + 0.15, -b.y + 0.15, 0, 0.78, 0.78, 0.03);
      }
    }
    if (!P.noRender) { stage.render(); P.drawCalls = stage.renderer.info.render.calls; P.tris = stage.renderer.info.render.triangles; }
  }

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => { r(ctx, view); frame(game); };
    return game;
  };
  P.setClock = (f) => { P.clock = f; };
  return P;
}
void HORSES;

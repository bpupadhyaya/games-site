// The 3D world of Hide and Seek: one WebGL scene (ground, buildings, trees, the eight hiding places at real size, six real children)
// rendered by a perspective camera that src/worldmap.js also uses for hit-testing, then composited under the 2D HUD. It only READS
// the model view.js builds each frame; it never writes to the sim. If WebGL2 or an asset is unavailable, createWorld returns null and
// the 2D pictures take over; if the context is lost mid-round, render() returns false until it is restored (no reload needed).
import { createStage, buildScenery, THREE, board3d as B } from '../vendor3d/index.js';
import { buildProp } from './props.js';
import { PLACE_BUILDERS, SCENERY, HOURS } from './places.js';
import { createChildren, CH } from './children.js';
import { mat, canvasTex, put, TAU, clamp, cv } from './kit.js';
import { spotXZ, homeXZ } from '../src/worldmap.js';
import { THEMES } from '../src/art.js';

const COLS = { cold: '#4aa8e8', warm: '#f2a92e', hot: '#e8503a', ok: '#6fe0a0', gold: '#ffd97a' };

// camera and cast of each illustration (metres; wide layout unless tall)
const SNAPS = {
  scene: { place: 0, tall: true, fov: 38, pitch: 8, pos: [1.2, 1.5, 6.2], kids: [{ look: 1, X: 1.78, Z: -0.35, pose: 'peek', faceX: 1, faceZ: 6 }, { look: 0, X: -0.6, Z: 1.4, pose: 'eyes', faceX: 0.6, faceZ: 0.2 }] },
  place0: { place: 0, tall: true, fov: 34, pitch: 12, pos: [1.0, 1.7, 5.4], kids: [{ look: 2, X: 2.0, Z: 0.1, pose: 'stand', faceX: 1, faceZ: 6 }] },
  place1: { place: 1, tall: true, fov: 34, pitch: 12, pos: [-0.2, 1.7, 5.4], kids: [{ look: 3, X: 0.9, Z: 0.5, pose: 'stand', faceX: 0, faceZ: 6 }] },
  place2: { place: 2, tall: true, fov: 34, pitch: 12, pos: [0.0, 1.7, 5.4], kids: [{ look: 1, X: 1.2, Z: 0.7, pose: 'stand', faceX: 0, faceZ: 6 }] },
  clue: { place: 0, tall: false, fov: 40, pitch: 22, pos: [0, 4.5, 10.5], looked: [0, 0, 0, 0, 0, 1, 1, 1], clue: [0, 0, 0, 0, 0, 0, 1, 2], kids: [] },
  listen: { place: 2, tall: false, fov: 40, pitch: 22, pos: [0, 4.5, 5.5], listen: [0, 1, 2], kids: [] },
  hide: { place: 1, tall: false, fov: 40, pitch: 22, pos: [0, 4.5, 10.5], mine: 5, target: 7, kids: [{ look: 5, X: -5.4, Z: 2.1, pose: 'crouch' }, { look: 4, X: 3.8, Z: 3.6, pose: 'stand', faceX: 5.5, faceZ: 2.9 }] },
  sneak: { place: 1, tall: false, fov: 40, pitch: 22, pos: [-2.7, 4.5, 10.5], mine: 5, sneak: [6], kids: [{ look: 5, X: -5.4, Z: 2.1, pose: 'crouch' }] },
};
export async function createWorld({ quality = 'medium', looks, base = './assets3d/', rig = 'athlete' }) {
  const canvas = globalThis.document.createElement('canvas');
  const stage = createStage({ canvas, container: globalThis.document.body, quality, dprCap: 2, transparent: false, shadows: quality !== 'low', lighting: 'day', fov: 34, shadowSize: 11 });
  if (!stage.supported) return null;
  const scene = stage.scene, camera = stage.camera, renderer = stage.renderer;
  camera.near = 0.5; camera.far = 260; camera.updateProjectionMatrix();
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const world = { stage, quality, lost: false, ready: false, place: -1, tier: quality, ms: 0, frames: 0 };
  stage.onContextLost(() => { world.lost = true; });
  stage.onContextRestored(() => { world.lost = false; portraitCache.clear(); stage.invalidate(); });

  // ---- places ---------------------------------------------------------------------------------------------------------------
  const places = [];
  const hour = (i) => HOURS[i];
  function buildPlace(i) {
    if (places[i]) return places[i];
    const P = { group: new THREE.Group(), props: [], tall: null, built: null };
    P.group.visible = false; scene.add(P.group);
    const B0 = PLACE_BUILDERS[i]({});
    P.built = B0; P.group.add(B0.group);
    const T = THEMES[i];
    for (let s = 0; s < 8; s++) {
      // which spot kind is at index s of place i comes from sim PLACES (passed in via model.kinds)
      P.props.push(null);
    }
    // scenery (sky, backdrop, far ground) streams in
    try {
      const sc = buildScenery({ layers: SCENERY[i].layers, timeOfDay: SCENERY[i].tod, quality: world.tier === 'low' ? 'low' : 'medium', clouds: 0.4, wind: 0.5, culture: SCENERY[i].culture });
      P.scenery = sc; P.group.add(sc.group);
      sc.ready.catch((e) => console.warn('scenery failed', e));
    } catch (e) { console.warn('scenery unavailable', e); }
    // ambient particles: fireflies / dust motes
    const N = i === 0 ? 40 : 60, geo = new THREE.BufferGeometry(), arr = new Float32Array(N * 3), seeds = [];
    for (let k = 0; k < N; k++) { seeds.push([Math.random() * TAU, Math.random() * TAU, 0.3 + Math.random() * 0.8, (Math.random() - 0.5) * 22, 0.4 + Math.random() * 3.2, -6 + Math.random() * 12]); }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pm = new THREE.PointsMaterial({ color: i === 1 ? '#fff3b0' : '#ffe7a8', size: i === 0 ? 0.05 : 0.09, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    const pts = new THREE.Points(geo, pm); pts.frustumCulled = false; P.group.add(pts);
    P.motes = { geo, seeds, arr, pm };
    places[i] = P;
    void T;
    return P;
  }
  function ensureProps(P, i, kinds, tall) {
    if (P.tall === tall && P.kinds === kinds) return;
    for (let s = 0; s < 8; s++) {
      if (P.props[s]) { P.group.remove(P.props[s].holder); }
    }
    for (let s = 0; s < 8; s++) {
      const k = kinds[s], pr = buildProp(k.kind, k.v, THEMES[i]);
      pr.holder = new THREE.Group(); pr.holder.add(pr.group); P.group.add(pr.holder);
      const [X, Z] = spotXZ(s, tall);
      pr.holder.position.set(X, 0, Z);
      pr.X = X; pr.Z = Z;
      pr.group.traverse((o) => { if (o.isMesh) { o.castShadow = o.castShadow || false; } });
      P.props[s] = pr;
    }
    const [hx, hz] = homeXZ(tall);
    P.built.home.position.set(hx, 0, hz - 0.2);
    P.tall = tall; P.kinds = kinds;
  }

  // ---- markers (rings, target cone, light column) ----------------------------------------------------------------------------
  const ringTex = (col, dash = false) => canvasTex(128, 128, (c, W, H) => {
    c.strokeStyle = col; c.lineWidth = 9; c.shadowColor = col; c.shadowBlur = 10;
    if (dash) c.setLineDash([16, 12]);
    c.beginPath(); c.arc(W / 2, H / 2, W * 0.4, 0, TAU); c.stroke();
    c.setLineDash([]); c.globalAlpha = 0.22; c.fillStyle = col; c.beginPath(); c.arc(W / 2, H / 2, W * 0.38, 0, TAU); c.fill();
  });
  const rings = [];
  const mkRing = (col, dash) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: ringTex(col, dash), transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.02; m.renderOrder = 4; m.visible = false; scene.add(m); return m; };
  const clueRings = Array.from({ length: 8 }, () => ({ cold: mkRing(COLS.cold), warm: mkRing(COLS.warm), hot: mkRing(COLS.hot) }));
  const hintRing = mkRing(COLS.gold, true), youRing = mkRing(COLS.ok), cursorRing = mkRing('#ffffff', true);
  const sneakRings = Array.from({ length: 8 }, () => mkRing('#8af0b0', true));
  const listenRings = Array.from({ length: 8 }, () => mkRing('#ffe9a0'));
  rings.push(hintRing, youRing, cursorRing);
  // a beam of light over the hinted place
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 5, 20, 1, true), new THREE.MeshBasicMaterial({ map: canvasTex(8, 64, (c, W, H) => { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(255,230,140,0)'); g.addColorStop(1, 'rgba(255,230,140,0.55)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  beam.visible = false; beam.position.y = 2.5; scene.add(beam);
  // the seeker's current target: a red cone bobbing over the place
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.28, 0.5, 4), mat('#e8503a', { emissive: '#ff3a20', ei: 1.1, rough: 0.4 }));
  cone.rotation.x = Math.PI; cone.visible = false; scene.add(cone);

  // ---- kids ---------------------------------------------------------------------------------------------------------------------
  const kids = await createChildren({ stage, looks, base, quality, rig });

  // ---- sparkle bursts (found!) -----------------------------------------------------------------------------------------------------
  const SP = 90, spGeo = new THREE.BufferGeometry(), spArr = new Float32Array(SP * 3), spCol = new Float32Array(SP * 3), spLife = new Float32Array(SP), spVel = new Float32Array(SP * 3);
  spGeo.setAttribute('position', new THREE.BufferAttribute(spArr, 3)); spGeo.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
  const sparks = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false; scene.add(sparks);
  let spNext = 0;
  const palette = ['#ffd97a', '#ff8a6a', '#7be0ff', '#a0f08a', '#ffffff'].map((c) => new THREE.Color(c));
  function burst(X, Z, n = 26) {
    for (let k = 0; k < n; k++) {
      const i = spNext; spNext = (spNext + 1) % SP;
      const a = Math.random() * TAU, v = 1.2 + Math.random() * 2.4;
      spArr[i * 3] = X; spArr[i * 3 + 1] = 0.9; spArr[i * 3 + 2] = Z;
      spVel[i * 3] = Math.cos(a) * v; spVel[i * 3 + 1] = 2.2 + Math.random() * 2.2; spVel[i * 3 + 2] = Math.sin(a) * v;
      const c = palette[k % palette.length]; spCol[i * 3] = c.r; spCol[i * 3 + 1] = c.g; spCol[i * 3 + 2] = c.b; spLife[i] = 0.9 + Math.random() * 0.4;
    }
  }
  function stepSparks(dt) {
    for (let i = 0; i < SP; i++) {
      if (spLife[i] <= 0) { spArr[i * 3 + 1] = -10; continue; }
      spLife[i] -= dt; spVel[i * 3 + 1] -= 7 * dt;
      spArr[i * 3] += spVel[i * 3] * dt; spArr[i * 3 + 1] += spVel[i * 3 + 1] * dt; spArr[i * 3 + 2] += spVel[i * 3 + 2] * dt;
      if (spArr[i * 3 + 1] < 0.02) { spArr[i * 3 + 1] = 0.02; spVel[i * 3 + 1] *= -0.3; spVel[i * 3] *= 0.6; spVel[i * 3 + 2] *= 0.6; }
    }
    spGeo.attributes.position.needsUpdate = true; spGeo.attributes.color.needsUpdate = true;
  }
  // dust puffs under running feet
  const DU = 40, duGeo = new THREE.BufferGeometry(), duArr = new Float32Array(DU * 3), duLife = new Float32Array(DU), duVel = new Float32Array(DU * 3);
  duGeo.setAttribute('position', new THREE.BufferAttribute(duArr, 3));
  const dust = new THREE.Points(duGeo, new THREE.PointsMaterial({ size: 0.22, color: '#d8c8a8', transparent: true, opacity: 0.35, depthWrite: false }));
  dust.frustumCulled = false; scene.add(dust);
  let duNext = 0;
  function puff(X, Z, vx, vz) { const i = duNext; duNext = (duNext + 1) % DU; duArr[i * 3] = X; duArr[i * 3 + 1] = 0.06; duArr[i * 3 + 2] = Z; duVel[i * 3] = -vx * 0.2 + (Math.random() - 0.5) * 0.4; duVel[i * 3 + 1] = 0.3 + Math.random() * 0.3; duVel[i * 3 + 2] = -vz * 0.2 + (Math.random() - 0.5) * 0.4; duLife[i] = 0.5 + Math.random() * 0.3; }
  function stepDust(dt) {
    for (let i = 0; i < DU; i++) {
      if (duLife[i] <= 0) { duArr[i * 3 + 1] = -10; continue; }
      duLife[i] -= dt; duArr[i * 3] += duVel[i * 3] * dt; duArr[i * 3 + 1] += duVel[i * 3 + 1] * dt; duArr[i * 3 + 2] += duVel[i * 3 + 2] * dt; duVel[i * 3 + 1] *= 0.96;
    }
    duGeo.attributes.position.needsUpdate = true;
  }

  // ---- per-frame --------------------------------------------------------------------------------------------------------------------
  let lastT = null, wall = 0, slow = 0, shown = -1, foundSeen = new Set(), roundKey = '', stepAcc = 0;
  const camPos = [0, 6, 12];
  function setHour(i, tall) {
    const H = hour(i), k = stage.lights.key, hm = stage.lights.hemi, rim = stage.lights.rim;
    scene.background = new THREE.Color(H.bg);
    scene.fog = new THREE.Fog(H.fog, H.fogNear, H.fogFar);
    hm.color.set(H.hemiSky); hm.groundColor.set(H.hemiGround); hm.intensity = H.hemi;
    k.color.set(H.key); k.intensity = H.keyI; rim.color.set(H.rim); rim.intensity = H.rimI;
    k.position.set(H.keyPos[0], H.keyPos[1], H.keyPos[2]); k.target.position.set(0, 0, 0);
    rim.position.set(H.rimPos[0], H.rimPos[1], H.rimPos[2]);
    const ext = tall ? 8.5 : 12.5;
    Object.assign(k.shadow.camera, { left: -ext, right: ext, top: ext * 0.8, bottom: -ext * 0.8, near: 2, far: 50 }); k.shadow.camera.updateProjectionMatrix();
    renderer.toneMappingExposure = H.exposure; scene.environmentIntensity = H.env;
  }
  let hourKey = '';

  function frameSize(rect, ppu) {
    const dprCap = world.tier === 'high' ? 2 : world.tier === 'medium' ? 1.6 : 1;
    let k = Math.min(ppu, dprCap);
    const maxPix = world.tier === 'high' ? 3.2e6 : world.tier === 'medium' ? 2.0e6 : 0.9e6;
    const px = rect.w * rect.h * k * k;
    if (px > maxPix) k *= Math.sqrt(maxPix / px);
    return [Math.max(64, Math.round(rect.w * k)), Math.max(64, Math.round(rect.h * k))];
  }

  // model: { place, kinds:[{kind,v}x8], cam, tall, rect:{x,y,w,h}, t, shake[8], lit[8], looked[8], clue[8], mine, hint, target, cursor, sneak:[...], listen:[...], listenA, kids:[cmd], found:[spot...], round }
  world.render = function (ctx, model) {
    if (world.lost || stage.contextLost || !world.ready) return false;
    const t0 = globalThis.performance.now();
    const P = buildPlace(model.place);
    ensureProps(P, model.place, model.kinds, model.tall);
    if (shown !== model.place) { if (places[shown]) places[shown].group.visible = false; P.group.visible = true; shown = model.place; hourKey = ''; }
    const hk = `${model.place}|${model.tall}`;
    if (hk !== hourKey) { setHour(model.place, model.tall); hourKey = hk; for (const l of P.built.lamps) { /* lights on */ } P.built.lanternsOn(model.place === 1 ? 0 : 1); P.props.forEach((p) => p.lightOn && p.lightOn(1)); }
    let dt = lastT == null ? 0 : model.t - lastT; if (!(dt >= 0) || dt > 0.25) dt = 0; lastT = model.t;
    const frozen = dt === 0;
    wall = model.t;
    // camera
    const C = model.cam;
    camera.fov = C.fov * 180 / Math.PI; camera.aspect = model.rect.w / model.rect.h;
    camera.position.set(C.pos[0], C.pos[1], C.pos[2]); camera.rotation.set(-C.pitch, 0, 0); camera.updateProjectionMatrix();
    if (C.shift) { camera.projectionMatrix.elements[8] = C.shift[0]; camera.projectionMatrix.elements[9] = C.shift[1]; camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert(); }
    camera.updateMatrixWorld(true);
    camPos[0] = C.pos[0]; camPos[1] = C.pos[1]; camPos[2] = C.pos[2];
    const m = ctx.getTransform(), ppu = Math.hypot(m.a, m.b);
    const [dw, dh] = frameSize(model.rect, ppu);
    renderer.setPixelRatio(1); renderer.setSize(dw, dh, false);
    // props
    for (let s = 0; s < 8; s++) {
      const pr = P.props[s]; if (!pr) continue;
      pr.update(model.t);
      const sh = model.shake ? model.shake[s] : 0;
      pr.holder.rotation.z = sh > 0 ? Math.sin((1 - sh) * 34) * 0.045 * sh : 0;
      pr.holder.position.x = pr.X + (sh > 0 ? Math.sin((1 - sh) * 52) * 0.05 * sh : 0);
    }
    if (P.scenery) P.scenery.update(dt, camera);
    P.built.tick(model.t, dt);
    // ambient motes
    const M = P.motes;
    for (let k = 0; k < M.seeds.length; k++) {
      const sd = M.seeds[k], tt = model.t * sd[2];
      M.arr[k * 3] = sd[3] + Math.sin(tt * 0.7 + sd[0]) * 1.2; M.arr[k * 3 + 1] = sd[4] + Math.sin(tt * 0.9 + sd[1]) * 0.35; M.arr[k * 3 + 2] = sd[5] + Math.cos(tt * 0.5 + sd[0]) * 1.2;
    }
    M.geo.attributes.position.needsUpdate = true; M.pm.opacity = 0.55 + 0.35 * Math.sin(model.t * 2.1);
    // markers
    const at = (s) => [P.props[s].X, P.props[s].Z];
    for (let s = 0; s < 8; s++) {
      const cr = clueRings[s], c = model.looked && model.looked[s] ? model.clue[s] : -1;
      cr.cold.visible = c === 0 || (c < 0 && false); cr.warm.visible = c === 1; cr.hot.visible = c >= 2;
      for (const r of [cr.cold, cr.warm, cr.hot]) if (r.visible) { r.position.x = P.props[s].X; r.position.z = P.props[s].Z; r.material.opacity = 0.7 + 0.2 * Math.sin(model.t * 3 + s); }
      const sn = sneakRings[s]; sn.visible = !!(model.sneak && model.sneak.includes(s));
      if (sn.visible) { sn.position.set(P.props[s].X, 0.02, P.props[s].Z); sn.rotation.z = model.t * 0.6; sn.material.opacity = 0.6 + 0.35 * Math.sin(model.t * 4 + s); sn.scale.setScalar(0.9); }
      const li = listenRings[s]; li.visible = !!(model.listen && model.listen.includes(s));
      if (li.visible) { const a = model.listenA || 0; li.position.set(P.props[s].X, 0.02, P.props[s].Z); li.scale.setScalar(0.8 + a * 1.1); li.material.opacity = Math.sin(a * Math.PI); }
    }
    const place = (r, s, vis, sc = 1) => { r.visible = !!vis && s != null && s >= 0; if (r.visible) { r.position.set(P.props[s].X, 0.025, P.props[s].Z); r.scale.setScalar(sc); } };
    place(hintRing, model.hint, model.hint != null && model.hint >= 0, 1 + 0.06 * Math.sin(model.t * 5)); if (hintRing.visible) hintRing.rotation.z = model.t * 0.5;
    beam.visible = hintRing.visible; if (beam.visible) { beam.position.set(hintRing.position.x, 2.5, hintRing.position.z); beam.material.opacity = 0.55 + 0.25 * Math.sin(model.t * 5); }
    place(youRing, model.mine, model.mine != null && model.mine >= 0, 0.9 + 0.05 * Math.sin(model.t * 3));
    place(cursorRing, model.cursor, model.cursor != null && model.cursor >= 0, 1.0); if (cursorRing.visible) cursorRing.rotation.z = -model.t * 0.4;
    if (model.target != null && model.target >= 0) { cone.visible = true; const [tx, tz] = at(model.target); cone.position.set(tx, P.props[model.target].top + 0.8 + Math.sin(model.t * 9) * 0.12, tz); cone.rotation.y = model.t * 3; } else cone.visible = false;
    // children
    const wasPos = kids.map((k) => [k.x, k.z]);
    const reg = new Set();
    for (const k of kids) k.set(null);
    for (const c of model.kids) { const k = kids[c.look % kids.length]; if (k) { k.set(c); reg.add(k.id); } }
    for (const k of kids) { k.update(dt, camPos, frozen); }
    // dust under running kids, sparkles for new finds
    stepAcc += dt;
    kids.forEach((k, i) => { if (k.speed > 2.0 && stepAcc > 0.04 && k.have) puff(k.x, k.z, k.vx, k.vz); });
    if (stepAcc > 0.04) stepAcc = 0;
    if (model.round !== roundKey) { roundKey = model.round; foundSeen = new Set(); }
    for (const s of model.found || []) { if (!foundSeen.has(s)) { foundSeen.add(s); const [fx, fz] = at(s); burst(fx, fz + 0.8); } }
    stepSparks(dt); stepDust(dt);
    void wasPos;
    // humans update + render
    // advance the clips first, THEN everything that depends on the posed skeleton (accessories ride on bones; nothing is held in a hand)
    for (const k of kids) if (k.h.root.visible) k.h.update(dt);
    stage.render();
    // composite
    ctx.drawImage(canvas, model.rect.x, model.rect.y, model.rect.w, model.rect.h);
    // quality watchdog: sustained slow frames drop a tier
    const ms = globalThis.performance.now() - t0; world.ms = world.ms ? world.ms * 0.95 + ms * 0.05 : ms; world.frames++;
    if (world.frames > 90 && world.ms > 14 && world.tier !== 'low' && !world.noAuto) { world.tier = world.tier === 'high' ? 'medium' : 'low'; stage.setQuality(world.tier); world.frames = 0; world.ms = 0; }
    return true;
  };

  // head-and-shoulders portraits for the "who is found" tray (cached canvases)
  const portraitCache = new Map();
  world.portrait = function (look, size = 128) {
    if (!world.ready || world.lost) return null;
    const key = `${look}|${size}`; let c = portraitCache.get(key);
    if (c) return c;
    const k = kids[look]; if (!k) return null;
    const saveVis = kids.map((o) => o.h.root.visible);
    const sw = canvas.width, sh = canvas.height;
    renderer.setPixelRatio(1); renderer.setSize(size, size, false);
    const b = k.h.bones.Bip01_Head; const v = new THREE.Vector3(); b.getWorldPosition(v);
    for (const o of kids) o.h.root.visible = o === k;
    const sceneBg = scene.background, fog = scene.fog;
    scene.background = new THREE.Color('#2a3a6a'); scene.fog = null;
    const oc = camera.clone ? null : null; void oc;
    const keep = { fov: camera.fov, aspect: camera.aspect, pos: camera.position.clone(), rot: camera.rotation.clone() };
    camera.fov = 22; camera.aspect = 1; camera.position.set(v.x + Math.sin(k.yaw) * 1.6, v.y + 0.04, v.z + Math.cos(k.yaw) * 1.6); camera.lookAt(v.x, v.y - 0.02, v.z); camera.updateProjectionMatrix();
    if (places[shown]) places[shown].group.visible = false;
    stage.render();
    c = cv(size, size); c.getContext('2d').drawImage(canvas, 0, 0, size, size);
    if (places[shown]) places[shown].group.visible = true;
    scene.background = sceneBg; scene.fog = fog;
    camera.fov = keep.fov; camera.aspect = keep.aspect; camera.position.copy(keep.pos); camera.rotation.copy(keep.rot); camera.updateProjectionMatrix();
    kids.forEach((o, i) => { o.h.root.visible = saveVis[i]; });
    renderer.setSize(sw, sh, false);
    portraitCache.set(key, c);
    return c;
  };

  // illustrations for About / How to play / result: the same scene photographed from a chosen camera into a cached canvas
  const snapCache = new Map();
  world.snapshot = function (key, w, h, kindsOf) {
    if (!world.ready || world.lost) return null;
    const ck = `${key}|${Math.round(w)}x${Math.round(h)}`; let c = snapCache.get(ck); if (c) return c;
    const S = SNAPS[key]; if (!S) return null;
    const px = 2, cvs = cv(Math.round(w * px), Math.round(h * px)), cx = cvs.getContext('2d'); cx.scale(px, px);
    const asp = w / h;
    const model = { place: S.place, kinds: kindsOf(S.place), tall: !!S.tall, cam: { fov: S.fov * Math.PI / 180, pitch: S.pitch * Math.PI / 180, pos: S.pos }, rect: { x: 0, y: 0, w, h }, t: lastT == null ? 0 : lastT, round: 'snap' + key,
      kids: (S.kids || []).map((k) => ({ ...k, visible: true, snap: true })), looked: S.looked || null, clue: S.clue || null, sneak: S.sneak || [], listen: S.listen || [], listenA: 0.4, mine: S.mine ?? -1, target: S.target ?? -1, found: [], shake: null };
    void asp;
    for (let i = 0; i < 6; i++) { world.render(cx, { ...model, t: model.t + i * 0.05 }); }
    // the live scene's puppets must not chase from illustration positions
    for (const k of kids) { k.have = false; k.cmd = null; }
    lastT = null; hourKey = ''; shown = -1;
    for (const P of places) if (P) P.group.visible = false;
    snapCache.set(ck, cvs);
    return cvs;
  };
  world.kids = kids; world.places = places; world.burst = burst; world.camPos = camPos; world.buildPlace = buildPlace; world.ensureProps = ensureProps; world.setHour = setHour;
  world.ready = true;
  return world;
}
export { CH };

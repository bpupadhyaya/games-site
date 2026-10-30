// The whole lienzo as one 3D scene, composited into the 2D game canvas (presentation only; reads numbers the 2D game already computes).
// Layers: the far scenery (sierra, stands, crowd) and the fence/sand are rendered once per size into a cached picture with depth of field and a
// vignette baked in; each frame renders only the live part (horse, charro, rope, post, bunting, dust, shadows) over it.
import { createStage, THREE, buildScenery, createCrowd3d } from '../vendor3d/index.js';
import { createHorse } from './horse.js';
import { createCharroRig } from './charro.js';
import { createLasso } from './rope.js';
import { buildGround, buildGroundFg, buildFence, buildStands, buildBunting, buildPost, contactShadow, buildTrack, paintSky, EXT } from './scenery.js';
import { clamp, lerp, TAU } from './geo.js';

const { Vector3, Group, Fog, Color } = THREE;
const D = 22;                          // camera distance to the horse lane, metres
const WORLD_W = 9.5;                   // metres of rail across the screen (tighter than before: horse and charro fill more of the picture)

const MAXW = { low: 760, medium: 1100, high: 1500 };

export async function createArena({ quality = 'medium', base } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  const stage = createStage({ canvas, container: globalThis.document.body, quality, dprCap: 1, transparent: true, shadows: quality !== 'low', lighting: 'evening', shadowSize: 12, fov: 30 });
  if (!stage.supported) return null;
  const { scene, camera, renderer } = stage;
  const api = { ok: true, lost: false, quality, stage, bakes: 0, avgMs: 0 };

  // ---- lights: a warm low sun from the left, cool sky fill, a faint rim
  const L = stage.lights;
  L.hemi.color.set('#ffe0b8'); L.hemi.groundColor.set('#7a5a38'); L.hemi.intensity = 0.42;
  L.key.color.set('#ffc17a'); L.key.intensity = 3.7;
  L.rim.color.set('#a8c0ff'); L.rim.intensity = 0.7;
  stage._shadowOffset = new Vector3(-12, 6.8, 6.5);
  if (scene.environment) scene.environmentIntensity = 0.2;
  stage.setShadowTarget(0, 0, 0.5);
  const sh = L.key.shadow;
  const setShadowBox = (half, mapSize) => {
    if (!sh) return;
    Object.assign(sh.camera, { left: -half, right: half, top: half * 0.6, bottom: -half * 0.6, near: 1, far: 60 }); sh.camera.updateProjectionMatrix();
    if (mapSize && sh.mapSize.x !== mapSize) { sh.mapSize.set(mapSize, mapSize); if (sh.map) { sh.map.dispose(); sh.map = null; } }
  };
  const FG_MAP = quality === 'high' ? 2048 : 1024;

  // ---- scene content
  const far = new Group(), near = new Group(), fg = new Group();
  scene.add(far, near, fg);
  const ground = buildGround(); near.add(ground);
  near.add(buildFence());
  far.add(buildStands(quality));
  // photographic dusk sky + desert sierra from the shared scenery kit (replaces the painted sky), baked into the far layer
  let scen = null;
  try {
    scen = buildScenery({ layers: [{ t: 'backdrop', id: 'bd-desert' }], timeOfDay: 'dusk', quality, clouds: 0.4 });
    scene.add(scen.group); scen.group.visible = false;
    await scen.ready;
  } catch (e) { console.warn('scenery kit unavailable, painted sky used', e); scen = null; }
  // the lienzo crowd: real-looking people in the stands (culture latin_american), live in the foreground pass, reacting to catches and misses
  let crowd = null;
  try {
    crowd = createCrowd3d(stage, {
      stands: [{ center: [0, 0.5, -9.0], yaw: 0, rows: 5, perRow: quality === 'low' ? 44 : 76, width: 44, rise: 0.6, rowDepth: 1.25, fill: quality === 'low' ? 0.8 : 0.9, standing: 0.12 }],
      seed: 21, culture: ['mediterranean', 'latin_american'], quality: quality === 'high' ? 'high' : quality === 'medium' ? 'medium' : 'low', excitement: 0.2,
      props: { flag: 0.05, phone: 0.04, child: 0.05 }, flagColors: ['#1f8a4a', '#f2f2f2', '#c8202a'], blobShadows: true,
    });
  } catch (e) { console.warn('crowd3d failed', e); crowd = null; }
  const groundFg = buildGroundFg(ground.material.map); fg.add(groundFg);
  const bunting = buildBunting(120); fg.add(bunting.group);
  const twine = [0, 1].map(() => {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(25 * 3), 3));
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#3a2a20' })); l.frustumCulled = false; fg.add(l); return l;
  });
  const post = buildPost(); fg.add(post);
  const horse = await createHorse({ quality, base: base ? base.replace(/characters\/?$/, '') : undefined }); fg.add(horse.root);
  const lasso = createLasso({ quality }); fg.add(lasso.root);
  const track = buildTrack(); fg.add(track.group);
  const hShadow = contactShadow(2.6, 0.9, 0.55); fg.add(hShadow);
  const cShadow = contactShadow(0.9, 0.5, 0.6); fg.add(cShadow);
  const rig = await createCharroRig({ base });
  stage.add(rig.human); stage.track(rig.human);
  const charroRoot = rig.human.root;
  rig.human.root.traverse((o) => { if (o.isMesh) { o.castShadow = quality !== 'low'; } });
  stage.setSky(null, null);

  // ---- helpers
  const bgCache = new Map();
  const ghost = (grp, on) => grp.traverse((o) => { if (o.isMesh || o.isInstancedMesh) for (const m of [].concat(o.material)) { m.colorWrite = !on; m.depthWrite = !on; } });
  const depthOnly = (grp, on) => grp.traverse((o) => { if (o.isMesh || o.isInstancedMesh) for (const m of [].concat(o.material)) { m.colorWrite = !on; } });
  const mk2d = (w, h) => { try { if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h); } catch { /* fall through */ } const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };

  /** camera + world mapping for a layout; px = rect px (virtual units) */
  function layoutOf(g) {
    const s = g.s || Math.min(g.railW / 9.5, g.sc.h / 6.8);
    const worldW = g.railW / s;
    const target = 150 * g.k * 1.32 * (g.charroScale || 1);                    // apparent charro height in px, as the 2D art drew him
    const r = clamp(target / (1.8 * s), 1.18, 2.9);
    const delta = g.footY - g.railY;
    const Hc = clamp(delta / (r - 1) / s, 1.7, 4.6);
    const hz = (g.railY - g.sc.y) - Hc * s;
    const cx0 = g.railL - g.sc.x + g.railW / 2;
    const zc = D * (1 - 1 / r);
    return { s, worldW, Hc, hz, cx0, r, zc, xw: (frac) => (frac - 0.5) * worldW, xpx: (px) => (px - g.sc.x - cx0) / (s * r) };
  }
  function frame(W, H, lay, sc, zoom = 1) {
    renderer.setPixelRatio(1); renderer.setSize(W, H, false);
    const k = W / sc.w;                                // device px per rect px
    const fpx = lay.s * D * k * zoom;
    camera.aspect = W / H; camera.fov = 2 * Math.atan(H / (2 * fpx)) * 180 / Math.PI; camera.near = 1; camera.far = 220;
    camera.position.set(0, lay.Hc, D); camera.lookAt(0, lay.Hc, 0); camera.updateProjectionMatrix();
    const e = camera.projectionMatrix.elements;
    e[8] = -(2 * (lay.cx0 * k) / W - 1); e[9] = -(1 - 2 * (lay.hz * k) / H);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.updateMatrixWorld(true);
  }
  const toScreenY = (yw, d, lay) => lay.hz + (lay.Hc - yw) * lay.s * D / d;

  // ---- the cached background
  function bake(W, H, lay, sc, key) {
    const t0 = performance.now();
    const bg = mk2d(W, H), g = bg.getContext('2d');
    const kk = W / sc.w, wallTop = (toScreenY(6.7, D + 15.7, lay) - 6) * kk;
    paintSky(g, W, H, Math.max(2, lay.hz * kk), wallTop);
    if (crowd) crowd.group.visible = false;
    if (scen) {
      // the photographic sky + sierra is drawn with a wider lens (same horizon line) so the mountains read at a believable size
      far.visible = false; near.visible = false; fg.visible = false; charroRoot.visible = false;
      scen.group.visible = true; scen.update(0, camera);
      frame(W, H, lay, sc, 0.75);
      renderer.setClearColor(0x000000, 0);
      stage.render();
      g.drawImage(renderer.domElement, 0, 0, W, H);
      scen.group.visible = false;
    }
    const prevVis = { far: far.visible, near: near.visible, fg: fg.visible, ch: charroRoot.visible };
    fg.visible = false; charroRoot.visible = false;
    frame(W, H, lay, sc);
    scene.fog = new Fog('#f0c28f', 30, 150);
    setShadowBox(EXT, quality === 'low' ? 0 : 2048);
    stage.setShadowTarget(0, 0, -2);
    renderer.setClearColor(0x000000, 0);
    // pass A: far scenery, then depth of field
    far.visible = true; near.visible = false;
    stage.render();
    const A = mk2d(W, H); A.getContext('2d').drawImage(renderer.domElement, 0, 0, W, H);
    const k = clamp(W / 280, 2, 5);
    const w1 = Math.max(16, Math.round(W / 2)), h1 = Math.max(16, Math.round(H / 2)), w2 = Math.max(12, Math.round(W / k)), h2 = Math.max(12, Math.round(H / k));
    const T1 = mk2d(w1, h1), c1 = T1.getContext('2d'); c1.imageSmoothingQuality = 'high'; c1.drawImage(A, 0, 0, w1, h1);
    const T2 = mk2d(w2, h2), c2 = T2.getContext('2d'); c2.imageSmoothingQuality = 'high'; c2.drawImage(T1, 0, 0, w2, h2);
    g.imageSmoothingQuality = 'high'; g.drawImage(T2, 0, 0, W, H);
    g.globalAlpha = 0.35; g.drawImage(A, 0, 0, W, H); g.globalAlpha = 1;
    g.fillStyle = 'rgba(26,10,30,0.2)'; g.fillRect(0, 0, W, H);          // calm the far crowd so the horse and charro read first
    // pass B: sand + fence sharp; the stands act as depth-only occluders so the ground behind them is not painted
    near.visible = true; ground.visible = true; ghost(near, false); depthOnly(far, true);
    stage.render();
    depthOnly(far, false);
    g.drawImage(renderer.domElement, 0, 0, W, H);
    // vignette + a warm glow from the low sun
    const vg = g.createRadialGradient(W * 0.5, H * 0.55, Math.min(W, H) * 0.25, W * 0.5, H * 0.55, Math.hypot(W, H) * 0.62);
    vg.addColorStop(0, 'rgba(20,8,30,0)'); vg.addColorStop(1, 'rgba(20,8,30,0.42)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    const gl = g.createLinearGradient(0, 0, W, 0); gl.addColorStop(0, 'rgba(255,170,90,0.14)'); gl.addColorStop(0.6, 'rgba(255,170,90,0)');
    g.fillStyle = gl; g.fillRect(0, 0, W, H);
    scene.fog = null;
    far.visible = false; fg.visible = true; charroRoot.visible = true; near.visible = prevVis.near;
    ghost(near, false); depthOnly(near, true); ground.visible = false;
    if (crowd) crowd.group.visible = true;
    setShadowBox(12, FG_MAP);
    api.bakes++; api.lastBakeMs = performance.now() - t0;
    bgCache.set(key, bg);
    if (bgCache.size > 4) bgCache.delete(bgCache.keys().next().value);
    return bg;
  }
  ghost(near, false); depthOnly(near, true); ground.visible = false; far.visible = false;
  setShadowBox(12, FG_MAP);

  // ---- per-frame state
  const S = { lastT: null, lastFrac: null, speed: 0, charroX: 0, prevHand: new Vector3(), key: '' };
  const hand = new Vector3(), tmpV = new Vector3();
  const buntingM = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pv = new Vector3(), sv = new Vector3(1, 1, 1);

  /**
   * g: { sc:{x,y,w,h}, railL, railW, railY, footY, charX, k, charroScale }
   * d: { t, calm, charro:{arm,lean,step,crouch}, horse:{frac, dir, caught, parked}|null, gateFrac, items:[...], neckFrac(res) }
   */
  api.draw = function (ctx, g, d) {
    if (api.lost || stage.contextLost) return false;
    const tStart = performance.now();
    const sc = g.sc, m = ctx.getTransform(), dpu = Math.hypot(m.a, m.b);
    const W = clamp(Math.round(sc.w * dpu), 160, MAXW[quality] * (api.scale || 1)), H = Math.max(80, Math.round(W * sc.h / sc.w));
    const lay = layoutOf(g);
    const key = `${W}x${H}|${Math.round(lay.hz)}|${lay.s.toFixed(1)}|${lay.Hc.toFixed(2)}|${Math.round(lay.cx0)}`;
    let bg = bgCache.get(key);
    if (!bg) bg = bake(W, H, lay, sc, key);
    frame(W, H, lay, sc);
    scene.fog = null;
    renderer.setClearColor(0x000000, 0);
    // time step
    const t = d.t, dt = S.lastT === null || t < S.lastT ? 0 : Math.min(0.1, t - S.lastT); S.lastT = t;
    // the horse
    const hz = d.horse;
    const lane = lay.xw;
    horse.root.visible = !!hz;
    if (hz) {
      const xw = lane(hz.frac);
      let dist = 0;
      if (S.lastFrac !== null && dt > 0) { dist = Math.abs(xw - S.lastFrac); if (dist > 3) dist = 0; }
      S.lastFrac = xw;
      const inst = dt > 0 ? dist / dt : 0;
      S.speed += (inst - S.speed) * Math.min(1, dt * 8);
      horse.root.position.set(xw, 0, 0);
      horse.root.rotation.y = hz.dir > 0 ? 0 : Math.PI;
      const evs = horse.update({ dt, dist, speed: S.speed, head: hz.caught ? 0.6 * Math.sin(t * 5) * 0.2 + 0.5 : 0, rear: hz.caught ? 0.25 : 0 });
      horse.root.updateMatrixWorld(true);
      if (evs.length && !d.calm) for (const ev of evs) { if (ev.world) tmpV.set(ev.x, 0, ev.z); else tmpV.set(ev.x, 0, ev.z).applyAxisAngle(new Vector3(0, 1, 0), horse.root.rotation.y).add(horse.root.position); track.spawn(tmpV.x, tmpV.z, horse.root.rotation.y, ev.fore, Math.min(2, S.speed / 4)); }
      hShadow.position.set(xw - hz.dir * 0.1, 0.004, 0); hShadow.visible = true;
    } else { hShadow.visible = false; S.lastFrac = null; S.speed = 0; }
    track.update(dt, false);
    // post
    const gx = lane(d.gateFrac);
    post.position.set(gx, 0, -0.95);
    { const fl = post.userData.flag, base = post.userData.flagBase, pa = fl.geometry.attributes.position, tt = d.calm ? 0 : t;
      for (let i = 0; i < pa.count; i++) { const x = base[i * 3] - 0.25, w = Math.min(1, x / 0.5 + 0.5); pa.setZ(i, Math.sin(tt * 4 + x * 9) * 0.05 * (w + 0.2) + Math.sin(tt * 2.3) * 0.02 * w); }
      pa.needsUpdate = true; fl.geometry.computeVertexNormals(); }
    // the charro
    const cx = lay.xpx(g.charX), yaw = Math.PI / 2 - 0.38;
    rig.place(cx, lay.zc, yaw);
    rig.pose({ arm: d.charro.arm, lean: d.charro.lean, step: d.charro.step, crouch: d.charro.crouch, circle: d.charro.circle ?? 1 }, t, dt);
    rig.hand(hand);
    cShadow.position.set(cx + d.charro.step / 98 * Math.sin(yaw), 0.004, lay.zc + d.charro.step / 98 * Math.cos(yaw));
    // the rope
    lasso.setScale(lay.s);
    const items = [];
    const ctxL = { yaw, charro: { x: cx, z: lay.zc }, gate: gx };
    for (const it of d.items || []) {
      if (it.type === 'flight') {
        const hit = it.grade !== 'miss';
        const px = lane(clamp(it.landFrac, -0.1, 1.1));
        const T = hit ? new Vector3(px + (it.dir || 1) * 0.98, 1.52, 0) : new Vector3(gx, 1.35, 0);
        items.push({ ...it, target: T, caught: hit && it.caught, axis: new Vector3((it.dir || 1) * 0.55, 0.62, 0.0).normalize() });
      } else if (it.type === 'caught') {
        const T = horse.neckPoint(new Vector3());
        items.push({ ...it, target: T, axis: new Vector3((it.dir || 1) * 0.55, 0.62, 0).normalize() });
      } else items.push(it);
    }
    lasso.update(items, hand, t, ctxL);
    // bunting: two strings across the top of the scene, flags swaying
    {
      const zb = -2.2, dd = D + 2.2, sx = lay.s * D / dd, half = (sc.w / 2) / sx + 1.5;
      const rows = [0.045, 0.045 + 56 / Math.max(300, sc.h) * 0.5];
      const per = Math.min(60, Math.ceil(2 * half / 0.62));
      let idx = 0;
      const calm = d.calm;
      for (let r = 0; r < 2; r++) {
        const ys = sc.h * rows[r], y0 = lay.Hc + (lay.hz - ys) / sx;
        const sag = 0.38 + 0.05 * r;
        { const pa = twine[r].geometry.attributes.position; for (let j = 0; j <= 24; j++) { const f = j / 24; pa.setXYZ(j, -half + f * 2 * half, y0 - sag * (1 - Math.pow(2 * f - 1, 2)) + 0.0, zb); } pa.needsUpdate = true; }
        for (let i = 0; i < per && idx < bunting.count; i++, idx++) {
          const f = (i + 0.5) / per, x = -half + f * 2 * half, y = y0 - sag * (1 - Math.pow(2 * f - 1, 2));
          const sw = calm ? 0 : Math.sin(t * 1.9 + i * 1.3 + r) * 0.14 + Math.sin(t * 3.1 + i * 0.7) * 0.05;
          e.set(sw, 0, Math.sin(t * 1.3 + i) * (calm ? 0 : 0.06) + (2 * f - 1) * -0.18 * sag);
          q.setFromEuler(e);
          buntingM.compose(pv.set(x, y, zb), q, sv.set(1, 1, 1));
          bunting.mesh.setMatrixAt(idx, buntingM);
        }
      }
      for (; idx < bunting.count; idx++) { buntingM.compose(pv.set(0, -50, 0), q.identity(), sv.set(0.0001, 0.0001, 0.0001)); bunting.mesh.setMatrixAt(idx, buntingM); }
      bunting.mesh.instanceMatrix.needsUpdate = true;
    }
    // the crowd: reacts to a catch (cheer) and to a missed throw (groan)
    if (crowd) {
      const caughtNow = !!(hz && hz.caught), missNow = (d.items || []).some((it) => it.type === 'flight' && it.grade === 'miss');
      if (caughtNow && !S.wasCaught) { crowd.react('cheer', { intensity: 0.9 }); crowd.setExcitement(0.8); S.exciteT = t; }
      if (S.wasMiss && !missNow && !caughtNow && !d.calm) crowd.react('groan', { intensity: 0.7 });
      S.wasCaught = caughtNow; S.wasMiss = missNow;
      if (S.exciteT != null && t - S.exciteT > 4) { crowd.setExcitement(0.2); S.exciteT = null; }
      crowd.update(dt, camera);
    }
    if (scen) scen.update(d.calm ? 0 : dt, camera);
    // shadows follow the action
    stage.setShadowTarget(clamp(hz ? horse.root.position.x : 0, -6, 6) * 0.3 + cx * 0.3, 0, 1.0);
    // render the live layer and composite
    ctx.drawImage(bg, sc.x, sc.y, sc.w, sc.h);
    stage.render();
    ctx.drawImage(renderer.domElement, sc.x, sc.y, sc.w, sc.h);
    // adaptive quality: if frames are slow, shrink the live layer, then drop shadows
    const ms = performance.now() - tStart;
    api.avgMs = api.avgMs ? api.avgMs * 0.9 + ms * 0.1 : ms;
    S.frames = (S.frames || 0) + 1;
    if (S.frames % 45 === 0 && api.avgMs > 26) {
      if ((api.scale || 1) > 0.62) api.scale = (api.scale || 1) * 0.82;
      else if (renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; L.key.castShadow = false; scene.traverse((o) => { if (o.material) for (const mm of [].concat(o.material)) mm.needsUpdate = true; }); }
    }
    api.hand = hand;
    return { hand, lay };
  };
  api.layoutOf = layoutOf;
  api.horse = horse;
  api.crowd = crowd;
  api.rig = rig;
  stage.onContextLost(() => { api.lost = true; });
  stage.onContextRestored(() => {
    api.lost = false; bgCache.clear();
    // the image-based light is a render target whose contents die with the context: rebuild it (otherwise everything comes back darker)
    try { const old = scene.environment, pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); if (old && old.dispose) old.dispose(); } catch { /* keep the old one */ }
  });
  return api;
}

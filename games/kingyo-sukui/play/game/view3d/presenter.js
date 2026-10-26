// Kingyo Sukui: 3D presenter. It only READS the game state (game.getState()); the sim and the flat UI layer stay untouched.
// One WebGL canvas sits behind the transparent kit canvas. The play camera is the SAME pure function the layout uses for input
// (src/v3.js playCamera), so the finger, ripples, score pops and the Think ring land exactly on the 3D water.
// No WebGL, or a lost context -> v3.on = false and the flat art draws; a restored context brings the scene back without a reload.
import * as THREE from '../vendor3d/three.js';
import { createCrowd3d } from '../vendor3d/index.js';
import { v3, playCamera, cameraFromParams, makeCamera, tubCorners, TUB, WS } from '../src/v3.js';
import { FISH, TW, TH, LIFT_T } from '../src/sim.js';
import { buildStall, applyLook, LOOKS } from './stall.js';
import { createFish, fishLen } from './fish.js';
import { createPoi, POI_RM } from './poi.js';
import { createPoiHand } from './hand.js';
import { bakeFishSprites, SPRITE } from './sprites.js';
import { hash, clamp, lerp, glowCanvas, texOf } from './tex.js';

const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, q: 2 }, { name: 'medium', dpr: 1.5, shadow: 1024, q: 1 }, { name: 'low', dpr: 1, shadow: 0, q: 0 }];
const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const toWX = (x) => (x - TW / 2) * WS, toWZ = (y) => (y - TH / 2) * WS;
const FISH_DEPTH = -0.05;
const UP = new THREE.Vector3(0, 1, 0);

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { wrap: (g) => g, ok: false };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x10103a, 1);
  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')) | 0, 0, TIERS.length - 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x131240, 3.2, 9);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 40);

  const stall = buildStall({ tier });
  scene.add(stall.root);
  const { key } = stall;

  // ---- fish pool ------------------------------------------------------------------------------------------------------------------
  const fishLayer = new THREE.Group(); scene.add(fishLayer);
  const pool = FISH.map(() => []);                  // per species: [{ model, used, world, id }]
  function acquire(k) {
    let e = pool[k].find((q) => !q.used);
    if (!e) { e = { model: createFish(k, TIERS[tier].q), used: false, world: null, id: -1 }; fishLayer.add(e.model.group); pool[k].push(e); }
    e.used = true; e.model.group.visible = true; return e;
  }
  const shadowOn = () => TIERS[tier].shadow > 0;

  // ---- poi, hand ----------------------------------------------------------------------------------------------------------------------
  const poi = createPoi(); scene.add(poi.group); poi.group.visible = false;
  poi.group.traverse((o) => { if (o.isMesh && o !== poi.paper) o.castShadow = true; });
  let hand = null;
  if (!qs.has('nohand')) createPoiHand(scene).then((h) => { hand = h; }).catch((e) => console.warn('hand unavailable', e));

  // ---- effects: ripples (water shader), drops, paper bits, Think ring ------------------------------------------------------------------
  const NDROP = 96, NBIT = 40;
  const dropM = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), new THREE.MeshBasicMaterial({ color: 0xe8f8ff, transparent: true, opacity: 0.85, depthWrite: false, fog: false }), NDROP);
  const bitM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff4dc, side: THREE.DoubleSide, transparent: true, opacity: 0.95, fog: false }), NBIT);
  for (const m of [dropM, bitM]) { m.frustumCulled = false; m.renderOrder = 4; scene.add(m); }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.058, 0.07, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  ring.renderOrder = 4; ring.visible = false; scene.add(ring);
  const ringHalo = new THREE.Mesh(new THREE.CircleGeometry(0.1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: texOf(glowCanvas(64, [255, 224, 130]), { wrap: false }), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  ringHalo.renderOrder = 4; ringHalo.visible = false; scene.add(ringHalo);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

  // ---- 3D splash and drain particles, spawned here from what the scoop does (the game's own 2D effect list stays as it was) ----------------
  const NSP = 110;
  const splM = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), new THREE.MeshBasicMaterial({ color: 0xf2fbff, transparent: true, opacity: 0.9, depthWrite: false, fog: false }), NSP);
  splM.frustumCulled = false; splM.renderOrder = 5; scene.add(splM);
  const spl = [];
  const emit = (x, y, z, vx, vy, vz, r, max) => { if (spl.length >= NSP) spl.shift(); spl.push({ x, y, z, vx, vy, vz, r, t: 0, max }); };
  const crown = (x, z, n) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3, s = 0.1 + Math.random() * 0.16;
      emit(x + Math.cos(a) * 0.03, -0.004, z + Math.sin(a) * 0.03, Math.cos(a) * s, 0.5 + Math.random() * 0.45, Math.sin(a) * s, 0.0042 + Math.random() * 0.003, 0.9);
    }
  };
  const foam = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, fog: false }));
  foam.visible = false; foam.renderOrder = 4; scene.add(foam);
  let foamT = 9, foamX = 0, foamZ = 0, prevDown = false, prevLifting = false, relT = 9, relItems = [];
  const relFrom = new THREE.Vector3(), lastPaper = new THREE.Vector3();

  // ---- crowd (deferred: it is only background) -------------------------------------------------------------------------------------------
  let crowd = null;
  const mkCrowd = () => {
    try {
      const gy = -0.98;
      crowd = createCrowd3d({ scene, camera }, {
        points: [
          { x: -1.58, y: gy, z: 0.3, yaw: Math.PI / 2 }, { x: -1.15, y: gy, z: -1.12, yaw: 0.5 }, { x: 0.05, y: gy, z: -1.3, yaw: 0.1 },
          { x: 1.05, y: gy, z: -1.2, yaw: -0.4 }, { x: 1.6, y: gy, z: 0.05, yaw: -Math.PI / 2 }, { x: -1.7, y: gy, z: -0.55, yaw: 1.2 },
        ],
        seed: 11, culture: 'east_asian', quality: TIERS[tier].q === 2 ? 'medium' : 'low', kids: 0.45, props: { phone: 0.05, flag: 0, child: 0 }, excitement: 0.25, count: 8,
      });
    } catch (e) { console.warn('crowd unavailable', e); crowd = null; }
  };

  // ---- environment map ----------------------------------------------------------------------------------------------------------------------
  function buildEnv() {
    const pm = new THREE.PMREMGenerator(renderer);
    const tex = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    pm.dispose(); scene.environment = tex; scene.environmentIntensity = 0.4;
  }

  // ---- size / tiers -------------------------------------------------------------------------------------------------------------------------
  let W = 1, H = 1, dprNow = 1, LW = 720, LH = 1280;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    stall.blobs.visible = t.shadow === 0;
    if (crowd) crowd.setQuality(t.q === 2 ? 'medium' : 'low');
    W = 0;
    scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } });
  }

  // ---- camera --------------------------------------------------------------------------------------------------------------------------------
  let camP = null, camFrom = null, camTo = null, camT = 1;
  const sameP = (a, b) => a && b && Math.abs(a.yaw - b.yaw) + Math.abs(a.pitch - b.pitch) + Math.abs(a.dist - b.dist) + Math.abs(a.s - b.s) * 100 + Math.abs(a.ox - b.ox) + Math.abs(a.oy - b.oy) < 1e-3;
  const parOf = (c) => ({ yaw: c.yaw, pitch: c.pitch, dist: c.dist, fov: c.fov, T: c.T, s: c.s, ox: c.ox, oy: c.oy });
  const isPlayCam = { v: false };
  function setCameraTarget(p, snap, play) {
    if (!camTo || snap) { camTo = p; camFrom = p; camP = p; camT = 1; isPlayCam.v = play; return; }
    if (play && isPlayCam.v && sameP(p, camTo)) { camTo = p; camP = p; return; }
    if (play !== isPlayCam.v || !sameP(p, camTo)) {
      // menus drift every frame (follow them directly); switching between play and menu eases over half a second
      if (play === isPlayCam.v && !play) { camTo = p; camP = p; camT = 1; return; }
      camFrom = camP; camTo = p; camT = 0; isPlayCam.v = play;
    }
  }
  function blendCamera(dt) {
    if (camT < 1) {
      camT = Math.min(1, camT + dt / 0.45); const e = ease(camT);
      camP = { yaw: lerp(camFrom.yaw, camTo.yaw, e), pitch: lerp(camFrom.pitch, camTo.pitch, e), dist: lerp(camFrom.dist, camTo.dist, e), fov: camTo.fov, T: camTo.T, s: lerp(camFrom.s, camTo.s, e), ox: lerp(camFrom.ox, camTo.ox, e), oy: lerp(camFrom.oy, camTo.oy, e) };
    }
    return camP;
  }
  function applyCamera(p) {
    const c = cameraFromParams(p, LW, LH);
    camera.position.set(c.C[0], c.C[1], c.C[2]);
    camera.up.set(0, 1, 0); camera.lookAt(p.T[0], p.T[1], p.T[2]);
    camera.fov = (p.fov * 180) / Math.PI; camera.aspect = c.aspect; camera.near = 0.05; camera.far = 40;
    camera.updateProjectionMatrix();
    const e = camera.projectionMatrix.elements;   // NDC' = s * NDC + o (rows 0 and 1 mix with the w row, which is -z)
    e[0] *= c.s; e[4] *= c.s; e[8] = e[8] * c.s - c.ox; e[12] *= c.s;
    e[1] *= c.s; e[5] *= c.s; e[9] = e[9] * c.s - c.oy; e[13] *= c.s;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    return c;
  }

  // ---- ambient hand (menus): a scripted dip-and-lift near a fish ---------------------------------------------------------------
  const amb = { t: 0, id: -1, x: TW * 0.5, y: TH * 0.5, phase: 0, until: 1.2, down: false };
  function stepAmbient(world, dt) {
    amb.t += dt; amb.phase += dt;
    if (!world) return;
    const f = world.fish.find((q) => q.id === amb.id);
    if (amb.phase > amb.until || (!f && amb.phase > 0.3)) {
      const fs = world.fish; if (!fs.length) return;
      const pick = fs[Math.floor(hash(amb.t, fs.length) * fs.length) % fs.length];
      amb.id = pick.id; amb.phase = 0; amb.until = 4.6; amb.down = false;
    }
    if (f) {
      const lx = f.x + Math.cos(f.h) * f.s * 0.35, ly = f.y + Math.sin(f.h) * f.s * 0.35;
      const k = 1 - Math.exp(-dt * (amb.phase < 1.4 ? 3 : 5));
      amb.x += (lx - amb.x) * k; amb.y += (ly - amb.y) * k;
      amb.down = amb.phase > 1.0 && amb.phase < 3.3;
    }
  }

  // ---- state -------------------------------------------------------------------------------------------------------------------------------------
  let clock = 0, lastT = 0, frames = 0, ema = 16, lookNow = -1, lastBannerKey = '', lastFlights = 0, inited = false;
  const poiS = { x: TW * 0.5, y: TH * 0.45, yy: 0.08, tilt: 0 };
  let handWant = true;
  const rippleUni = stall.rip;
  const tmpV = new THREE.Vector3(), gripV = new THREE.Vector3();

  function present(game, view, dt) {
    const st = game.getState();
    LW = view?.width ?? 720; LH = view?.height ?? 1280;
    resize();
    const playing = !!(st.scene === 'play' && st.run && st.ws && st.tr);
    const world = playing ? st.ws : st.att;
    const tankIdx = playing ? world.tank : 2;   // menus: the festival evening
    if (lookNow !== tankIdx) { lookNow = tankIdx; const L0 = applyLook(stall, tankIdx); renderer.setClearColor(L0.bg, 1); scene.fog.color.setHex(L0.fog); renderer.toneMappingExposure = L0.exp; scene.environmentIntensity = L0.env; }

    // camera: the play camera is the layout's own; menus get a slow drift around the tub framed in the hero rectangle
    if (playing) setCameraTarget(parOf(playCamera(st.tr, LW, LH)), !inited, true);
    else {
      const land = LW > LH, hero = v3.hero;
      const rect = hero || (land ? { x: LW * 0.04, y: LH * 0.12, w: LW * 0.56, h: LH * 0.76 } : { x: LW * 0.06, y: LH * 0.2, w: LW * 0.88, h: LH * 0.5 });
      const drift = Math.sin(clock * 0.15) * 0.16;
      const c = makeCamera({ yaw: drift, pitch: (hero ? 46 : 52) * Math.PI / 180, dist: 1.9 }, LW, LH, rect, tubCorners());
      setCameraTarget(parOf(c), !inited, false);
    }
    const P = blendCamera(dt);
    applyCamera(P);
    const dX = Math.sin(P.yaw), dZ = Math.cos(P.yaw);   // horizontal unit vector from the tub toward the camera (toward the player)

    key.position.set(-0.7, 2.0, 0.85); key.target.position.set(0, 0, 0); key.target.updateMatrixWorld();

    // lanterns flicker; the warm point lights follow
    const L = LOOKS[tankIdx] ?? LOOKS[3];
    stall.lanterns.forEach((g, i) => {
      const fl = 0.93 + 0.07 * Math.sin(clock * (7 + i) + i * 2) + 0.04 * Math.sin(clock * 19 + i * 5);
      g.userData.mat.emissiveIntensity = (0.12 + 1.15 * L.lan) * fl;
      g.userData.spr.material.opacity = (0.07 + 0.78 * L.glow * (0.35 + 0.65 * L.lan)) * (0.9 + 0.1 * fl);
      g.rotation.z = Math.sin(clock * 0.8 + i * 1.7) * 0.03; g.rotation.x = Math.cos(clock * 0.7 + i) * 0.02;
    });
    stall.warmA.intensity = L.lampI * (0.9 + 0.1 * Math.sin(clock * 9));
    stall.warmB.intensity = L.lampI * 0.9 * (0.9 + 0.1 * Math.sin(clock * 11 + 2));
    const wu = stall.waterMat.uniforms; wu.uTime.value = clock; stall.causMat.uniforms.uTime.value = clock;
    wu.uKeyDir.value.copy(key.position);
    stall.lanterns.slice(0, 3).forEach((g, i) => { stall.lp[i].set(g.position.x, g.position.y, g.position.z); stall.lc[i].setRGB(1, 0.62 - i * 0.04, 0.3).multiplyScalar(0.2 + 0.6 * L.lan); });

    // ---- fish
    for (const l of pool) for (const e of l) e.used = false;
    const fx = st.fx || { ripples: [], drops: [], bits: [], flights: [] };
    let blobN = 0;
    const putBlob = (x, z, sx, sz, rot) => { _q.setFromAxisAngle(UP, rot); _p.set(x, TUB.floorY + 0.002, z); _s.set(sx, 1, sz); _m.compose(_p, _q, _s); stall.blobs.setMatrixAt(blobN++, _m); };
    if (world) {
      for (const f of world.fish) {
        let e = pool[f.k].find((q) => !q.used && q.world === world && q.id === f.id) || pool[f.k].find((q) => !q.used);
        if (!e) e = acquire(f.k); else e.used = true;
        e.world = world; e.id = f.id;
        const g = e.model.group, spec = FISH[f.k], len = fishLen(spec.len, f.size);
        const boost = f.flee > 0 ? 1 : Math.min(1, f.s / 160);
        e.model.pose(len, f.ph, boost, 0);
        const depth = FISH_DEPTH + (f.rest > 0 ? 0.026 : 0) + Math.sin(f.ph * 0.37 + f.id) * 0.006 - (spec.w > 1.5 ? 0.012 : 0);
        g.position.set(toWX(f.x), depth, toWZ(f.y)); g.rotation.set(Math.sin(f.ph * 0.9) * 0.04, -f.h, 0); g.visible = true;
        if (blobN < 30 && !shadowOn()) putBlob(g.position.x + 0.01, g.position.z + 0.01, len * 1.5, len * 0.6, -f.h);
      }
    }
    // ---- poi + hand (play) or the ambient demo (menus)
    let px, py, down = false, lifting = false, lt = 0, paper = 1, wet = 0, hold = 0, sheet = 0, items = null, over = false, load = 0, dipT = 0;
    if (playing) {
      const w = st.ws, Pp = w.poi;
      px = Pp.x; py = Pp.y; down = Pp.down; lifting = !!Pp.lift; lt = Pp.lift ? Pp.lift.t * LIFT_T / (Pp.lift.dur || LIFT_T) : 0; paper = Pp.paper; wet = Pp.wet; hold = Pp.hold; sheet = w.sheetNo;
      items = Pp.lift ? Pp.lift.items : null; over = w.over; dipT = Pp.dipT;
      load = items ? Math.min(1.2, items.reduce((a, it) => a + FISH[it.k].w, 0) * 0.16 * 0.9) : 0;
      handWant = !(hold > 0.05) && !over;
    } else {
      stepAmbient(world, dt);
      px = amb.x; py = amb.y; down = amb.down && st.scene === 'title'; handWant = st.scene === 'title';
      paper = 0.88; wet = down ? 0.45 : 0.1;
      lifting = amb.phase >= 3.3 && amb.phase < 4.0 && st.scene === 'title'; lt = ((amb.phase - 3.3) / 0.7) * LIFT_T;
    }
    {
      const k = 1 - Math.exp(-dt * 14), fol = down || playing ? 1 : k;
      poiS.x += (px - poiS.x) * fol; poiS.y += (py - poiS.y) * fol;
      let ty = 0.075 + Math.sin(clock * 1.6) * 0.004, tilt = 0;
      // the paper goes under the surface (below the fish, which swim at FISH_DEPTH) with the handle tipped up out of the water;
      // on lift it rises through the surface carrying the fish on the paper
      const DIP_Y = FISH_DEPTH - 0.012;
      if (lifting) { const e = ease(lt / LIFT_T); ty = lerp(DIP_Y, 0.17, e); tilt = lerp(0.3, 0.28, e); }
      else if (down) { const e = ease(clamp(dipT / 0.2, 0, 1)); ty = lerp(0.06, DIP_Y, playing ? e : 1); tilt = 0.3 * e; }
      poiS.yy += (ty - poiS.yy) * (1 - Math.exp(-dt * (down ? 26 : 12)));
      poiS.tilt += (tilt - poiS.tilt) * (1 - Math.exp(-dt * 10));
    }
    const pg = poi.group;
    pg.position.set(toWX(poiS.x), poiS.yy, toWZ(poiS.y));
    pg.rotation.set(0, P.yaw, 0); pg.rotateX(-poiS.tilt);
    const showPoi = handWant || (hand && hand.shown > 0.05);
    pg.visible = showPoi;
    pg.updateMatrixWorld(true);
    if (showPoi) {
      poi.set(clamp(paper, 0, 1), clamp(wet, 0, 1), load, sheet, clock);
      poi.paper.renderOrder = poiS.yy < 0.004 ? 1 : 3;
      if (blobN < 31 && !shadowOn()) putBlob(pg.position.x, pg.position.z, 0.2, 0.2, 0);
    }
    // ---- the scoop in the water: a crown of splash and a foam ring when it goes in, water sheeting off the paper as it lifts, and the
    // caught fish carried off the paper toward the bowl once it is up
    {
      const R = POI_RM;
      if (down && !prevDown) { crown(pg.position.x, pg.position.z, 26); foamT = 0; foamX = pg.position.x; foamZ = pg.position.z; }
      if (lifting && !prevLifting) {
        for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; _p.set(Math.cos(a) * R * 0.92, 0, Math.sin(a) * R * 0.92); pg.localToWorld(_p); emit(_p.x, _p.y, _p.z, Math.cos(a) * 0.05, 0.1 + Math.random() * 0.12, Math.sin(a) * 0.05, 0.0034, 0.9); }
      }
      if (lifting) {
        for (let i = 0; i < 2; i++) { const a = Math.random() * Math.PI * 2; _p.set(Math.cos(a) * R, -0.004, Math.sin(a) * R); pg.localToWorld(_p); emit(_p.x, _p.y, _p.z, 0, 0, 0, 0.0026 + Math.random() * 0.0016, 1.0); }
        lastPaper.copy(pg.position);
        if (items && items.length) relItems = items.map((it) => it.k);
      }
      if (prevLifting && !lifting && relItems.length) { relT = 0; relFrom.copy(lastPaper); relFrom.y += 0.02; }
      prevDown = down; prevLifting = lifting;
      if (relT < 0.85 && relItems.length) {
        relT += dt;
        const k = Math.min(1, relT / 0.85);
        relItems.forEach((kk, i) => {
          const e = acquire(kk), len = fishLen(FISH[kk].len, 1) * 0.9 * (1 - 0.35 * k);
          e.world = null; e.id = -1;
          e.model.pose(len, clock * 14 + i * 2, 0.5, 1);
          const g = e.model.group, sd = (i - (relItems.length - 1) / 2) * 0.05;
          // shown on the paper, then set back into the same pool: a short arc (never leaving the tub); scored runs shrink it away into the bowl count
          const rel = st.ws && st.ws.release, reach = rel ? 0.1 : 0.18, q = rel ? Math.min(1, k * 1.15) : k;
          const hx = clamp(relFrom.x + dX * reach * q + dZ * sd, -TUB.hx + 0.06, TUB.hx - 0.06), hz = clamp(relFrom.z + dZ * reach * q - dX * sd, -TUB.hz + 0.06, TUB.hz - 0.06);
          g.position.set(hx, relFrom.y * (1 - q * q) + 0.12 * Math.sin(Math.PI * q), hz);
          g.rotation.set(0.5 * k, -Math.atan2(dX, dZ) + i, Math.sin(clock * 16 + i) * 0.5); g.visible = true;
        });
        if (relT >= 0.85) relItems = [];
      }
      if (foamT < 0.75) {
        foamT += dt; const f = Math.min(1, foamT / 0.75);
        foam.visible = true; foam.position.set(foamX, 0.003, foamZ); foam.scale.set(0.03 + f * 0.2, 1, 0.03 + f * 0.2); foam.material.opacity = 0.75 * (1 - f);
      } else foam.visible = false;
      let ns = 0;
      for (let i = spl.length - 1; i >= 0; i--) {
        const q = spl[i]; q.t += dt; q.vy -= 3.0 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
        if (q.t >= q.max || q.y < -0.012) { spl.splice(i, 1); continue; }
      }
      for (const q of spl) { if (ns >= NSP) break; _p.set(q.x, q.y, q.z); _s.setScalar(q.r * (1 - 0.4 * (q.t / q.max))); _q.identity(); _m.compose(_p, _q, _s); splM.setMatrixAt(ns++, _m); }
      for (let i = ns; i < NSP; i++) splM.setMatrixAt(i, ZERO);
      splM.instanceMatrix.needsUpdate = true;
    }
    if (hand) {
      gripV.set(0, 0.012, POI_RM + 0.13); pg.localToWorld(gripV);
      hand.update(gripV, tmpV.set(dX, 0, dZ), handWant, dt, down ? Math.sin(clock * 3) * 0.3 : 0);
    }
    // fish carried on the paper while it lifts
    if (items && lifting) {
      items.forEach((it, i) => {
        const e = acquire(it.k), len = fishLen(FISH[it.k].len, 1) * 0.95;
        e.world = null; e.id = -1;
        e.model.pose(len, clock * 15 + i * 2, 0.4, 1);
        const g = e.model.group, a = i * 2.1 + clock * 0.8;
        _p.set(Math.cos(a) * 0.016, -0.004 + 0.006 * Math.sin(clock * 20 + i), Math.sin(a) * 0.016);
        pg.localToWorld(_p);
        g.position.copy(_p); g.rotation.set(0, -(a + clock * 2), Math.sin(clock * 18 + i) * 0.5); g.visible = true;
      });
    }
    for (const l of pool) for (const e of l) if (!e.used) e.model.group.visible = false;
    if (!shadowOn()) { stall.blobs.count = blobN; stall.blobs.instanceMatrix.needsUpdate = true; }

    // ---- water ripples from the game's effect list (newest 14)
    const rs = fx.ripples;
    for (let i = 0; i < 14; i++) {
      const r = rs[rs.length - 1 - i];
      if (r) rippleUni[i].set(toWX(r.x), toWZ(r.y), clamp(r.t / r.max, 0, 1), Math.min(1.4, 0.45 + r.sp / 90 * 0.5));
      else rippleUni[i].w = 0;
    }
    let n = 0;
    for (const d of fx.drops) {
      if (n >= NDROP) break;
      const a = clamp(d.t / d.max, 0, 1), h = 0.003 + 0.12 * 4 * a * (1 - a) * (0.4 + (d.vx * d.vx + d.vy * d.vy) / 40000);
      _p.set(toWX(d.x), h, toWZ(d.y)); _s.setScalar((d.r || 4) * 0.0012 * (1 - 0.5 * a)); _q.identity(); _m.compose(_p, _q, _s); dropM.setMatrixAt(n++, _m);
    }
    for (let i = n; i < NDROP; i++) dropM.setMatrixAt(i, ZERO);
    dropM.instanceMatrix.needsUpdate = true;
    n = 0;
    for (const b of fx.bits) {
      if (n >= NBIT) break;
      const a = clamp(b.t / b.max, 0, 1);
      _p.set(toWX(b.x), 0.002 + 0.03 * Math.sin(Math.PI * Math.min(1, a * 1.6)) * (1 - a), toWZ(b.y)); _e.set(0, b.rot, 0.3 * Math.sin(b.rot * 3)); _q.setFromEuler(_e); _s.set(0.018, 1, 0.011); _m.compose(_p, _q, _s); bitM.setMatrixAt(n++, _m);
    }
    for (let i = n; i < NBIT; i++) bitM.setMatrixAt(i, ZERO);
    bitM.instanceMatrix.needsUpdate = true;

    // ---- Think ring on the suggested fish
    const hint = playing ? st.hint : null;
    ring.visible = ringHalo.visible = !!hint;
    if (hint) {
      const f = st.ws.fish.find((q) => q.id === hint.id);
      if (f) {
        const pulse = 0.5 + 0.5 * Math.sin(clock * 5);
        ring.position.set(toWX(f.x), 0.002, toWZ(f.y)); ring.scale.setScalar(1.15 + 0.2 * pulse); ring.material.opacity = 0.55 + 0.4 * pulse;
        ringHalo.position.copy(ring.position); ringHalo.scale.setScalar(1.3 + 0.3 * pulse);
      } else ring.visible = ringHalo.visible = false;
    }

    // ---- the crowd reacts to catches and tears
    if (crowd) {
      const fl = fx.flights.length;
      if (playing && fl > lastFlights) crowd.react('cheer', { origin: [0, 0, 0], radius: 6, intensity: 0.8 });
      lastFlights = fl;
      const bn = st.banner ? st.banner.text : '';
      if (bn && bn !== lastBannerKey) crowd.react(bn === 'Torn!' || bn === 'Spent' ? 'gasp' : 'ovation', { origin: [0, 0, 0], radius: 8, intensity: 0.9 });
      lastBannerKey = bn;
      crowd.setExcitement(playing ? 0.35 + Math.min(0.5, (st.ws.streak || 0) * 0.12) : 0.2);
      crowd.update(dt, camera);
    }

    renderer.setViewport(0, 0, W, H);
    renderer.render(scene, camera);
    renderBowl(st);
    inited = true;
  }

  // ---- the catch bowl: a small lit scene rendered into the HUD bowl panel (v3.bowl = { x, y, w, h } in layout units) -----------------------
  const bowlScene = new THREE.Scene();
  const bowlCam = new THREE.PerspectiveCamera(30, 1, 0.05, 5);
  const bowlGroup = new THREE.Group(); bowlScene.add(bowlGroup);
  {
    bowlScene.add(new THREE.HemisphereLight(0xdfe8ff, 0x4a3426, 0.9));
    const kl = new THREE.DirectionalLight(0xffe2b8, 2.4); kl.position.set(-0.5, 1.6, 0.9); bowlScene.add(kl);
    const rim = new THREE.DirectionalLight(0x8fb0ff, 0.9); rim.position.set(0.8, 0.6, -1); bowlScene.add(rim);
    const lac = new THREE.MeshPhysicalMaterial({ color: 0xc02a1a, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide });
    const pts = [[0.001, 0], [0.05, 0], [0.06, 0.008], [0.1, 0.05], [0.112, 0.085], [0.118, 0.092]].map(([r, y]) => new THREE.Vector2(r, y));
    bowlGroup.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 40), lac));
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3a1f0e, roughness: 0.75 }));
    back.position.y = -0.002; bowlGroup.add(back);
    const inner = new THREE.Mesh(new THREE.LatheGeometry(pts.map((q) => new THREE.Vector2(Math.max(0.001, q.x - 0.007), q.y + 0.005)), 40), new THREE.MeshStandardMaterial({ color: 0xf4eee2, roughness: 0.35, side: THREE.BackSide }));
    bowlGroup.add(inner);
    const wat = new THREE.Mesh(new THREE.CircleGeometry(0.104, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6fd2ea, emissive: 0x1b7b96, emissiveIntensity: 0.7, roughness: 0.08, transparent: true, opacity: 0.8, depthWrite: false }));
    wat.position.y = 0.074; wat.renderOrder = 2; bowlGroup.add(wat);
  }
  const bowlFish = [];   // { k, model }
  function renderBowl(st) {
    const b = v3.bowl;
    if (!b || !(st.scene === 'play' && st.run && st.ws)) return;
    const kinds = st.ws.caught, n = Math.min(7, kinds.length);
    for (const e of bowlFish) { e.used = false; e.model.group.visible = false; }
    for (let i = 0; i < n; i++) {
      const k = kinds[kinds.length - 1 - i];
      let e = bowlFish.find((q) => !q.used && q.k === k);
      if (!e) { e = { k, model: createFish(k, 1), used: false }; bowlGroup.add(e.model.group); bowlFish.push(e); }
      e.used = true;
      const a = clock * (0.5 + i * 0.06) + i * 2.1, rr = 0.03 + (i % 3) * 0.02, len = fishLen(FISH[k].len, 1) * 0.9;
      e.model.pose(len, clock * 5 + i, 0.2, 0);
      const g = e.model.group; g.visible = true;
      g.position.set(Math.cos(a) * rr, 0.045 + (i % 2) * 0.012, Math.sin(a) * rr); g.rotation.set(0, -(a + Math.PI / 2), 0);
    }
    const sx = W / LW, sy = H / LH;
    const x = Math.round(b.x * sx), y = Math.round((LH - b.y - b.h) * sy), w = Math.max(1, Math.round(b.w * sx)), h = Math.max(1, Math.round(b.h * sy));
    const asp = w / h;
    bowlCam.aspect = asp; bowlCam.updateProjectionMatrix();
    const d = 0.5 / Math.min(1, asp);
    bowlCam.position.set(0.0, 0.8 * d, 0.5 * d); bowlCam.lookAt(0, 0.04, 0);
    renderer.setScissorTest(true); renderer.setScissor(x, y, w, h); renderer.setViewport(x, y, w, h);
    renderer.autoClear = false; renderer.clearDepth();
    renderer.render(bowlScene, bowlCam);
    renderer.autoClear = true; renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
  }

  // ---- context loss ----------------------------------------------------------------------------------------------------------------------
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { buildEnv(); } catch { /* reflections only */ }
    lookNow = -1; W = 0; applyTier(); resize(); v3.on = true;
  });

  try { buildEnv(); applyTier(); resize(); } catch (e) { console.warn('3D init failed; flat fallback', e); canvas.remove(); v3.on = false; return noop; }
  v3.on = true;
  // deferred extras: the crowd and the baked goldfish portraits for the flat screens
  setTimeout(() => {
    mkCrowd();
    try { const s = bakeFishSprites(FISH.length); if (s) { v3.sprites = s; v3.spriteInfo = SPRITE; } } catch (e) { console.warn('sprites', e); }
  }, 60);

  return {
    ok: true, renderer, scene, camera, stall, pool,
    get hand() { return hand; }, get crowd() { return crowd; },
    setTier(t) { tier = clamp(t, 0, 2); applyTier(); },
    wrap(game) {
      return Object.assign({}, game, {
        render(ctx, view) {
          if (!v3.on) { game.render(ctx, view); return; }
          v3.bowl = null;
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt; v3.t = clock;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          game.render(ctx, view);
          try { present(game, view, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}

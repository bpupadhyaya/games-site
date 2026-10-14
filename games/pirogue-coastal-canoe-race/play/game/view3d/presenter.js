// Pirogue 3D presenter. READS the simulation (game.getState()), never writes. One WebGL canvas sits behind the kit's transparent 2D canvas:
// the sea + beach (one ground shader), sculpted dugout pirogues with two real paddlers each, buoys, palms, huts, a real 3D crowd on the
// sand, spray and wake. The 2D layer keeps the HUD, menus and text; with no WebGL (or a lost context) every screen falls back to the
// flat art. World frame: X = across the course (sea y), Z = -s (distance from the beach), Y up.
import { v3 } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { CW, BRK, LANES } from '../src/sim.js';
import { makeWater, MAXW } from './water.js';
import { makeHull, makePaddle, HULL_L } from './hull.js';
import { buildWorld } from './world.js';
import { loadPaddler, STROKE_LEN } from './crew.js';
import { PALETTES } from '../src/match.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const tick = () => new Promise((r) => setTimeout(r, 0));
const SKINS = ['deep', 'brown', 'brown', 'deep', 'tan', 'brown', 'deep', 'brown'];
const SEATS = [-1.15, 1.25];

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  let touch = false; try { touch = !!(globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches); } catch { /* ignore */ }
  return weak || touch ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return null; }
  const { createStage, THREE } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;opacity:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: quality !== 'low', shadowSize: 15 });
  if (!stage.supported) { canvas.remove(); return null; }
  stage.camera.near = 1; stage.camera.far = 900; stage.camera.fov = 34; stage.camera.updateProjectionMatrix();
  stage.setLighting('day', { exposure: 1.0, hemi: 0.85, keyI: 3.1, sky: 0x9cc6e0, fog: null, hemiSky: 0xdff1ff, hemiGround: 0x6aa6b0, key: 0xfff1d6, rim: 0xbfe0ff, rimI: 1.0 });
  stage.scene.fog = null;
  stage._shadowOffset.set(-16, 30, -12);
  const P = { stage, THREE, ready: false, lost: false, lab: null, tier: quality, crew: [], boats: [] };
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  let sizeKey = '';
  stage.onContextLost(() => { P.lost = true; v3.on = false; });
  stage.onContextRestored(() => { P.lost = false; sizeKey = ''; stage.resize(); stage.invalidate(); v3.on = true; });

  // ---- sea + world
  const water = makeWater(THREE); stage.scene.add(water.mesh);
  water.uniforms.uSun.value.copy(V(-16, 30, -12).normalize());
  await tick();
  const world = buildWorld(THREE, stage.scene, { quality });
  await tick();

  // ---- boats: 4 racing slots, each a hull + two paddle sets + foam skirt
  const foamTex = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 512; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 256, 10, 64, 256, 250); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0.0)'); g.addColorStop(0.72, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.save(); x.translate(64, 256); x.scale(0.32, 1); x.translate(-64, -256); x.fillStyle = g; x.fillRect(0, 0, 128, 512); x.restore();
    const t = new THREE.CanvasTexture(c); return t;
  })();
  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(0,30,50,0.55)'); g.addColorStop(1, 'rgba(0,30,50,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const NB = 4;
  function makeBoat(i) {
    const root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt);
    const pal = { main: '#f0a81c', band: '#1b5fa8', trim: '#fff6e0', cap: '#d8412f', shirt: '#fff6e0' };
    const hull = makeHull(THREE, pal, 10 + i); tilt.add(hull.group);
    const paddles = SEATS.map(() => makePaddle(THREE, pal.band)); paddles.forEach((p) => stage.scene.add(p));
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 8.0), new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, depthWrite: false, opacity: 0.9 }));
    skirt.rotation.x = -Math.PI / 2; skirt.position.y = 0.035; skirt.renderOrder = 2; root.add(skirt);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 9.5), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.set(0.5, 0.03, 0.2); sh.renderOrder = 1; root.add(sh);
    stage.scene.add(root);
    return { i, root, tilt, hull, paddles, skirt, sh, palKey: '', crew: [null, null], lastT: 99, side: 1 };
  }
  for (let i = 0; i < NB; i++) P.boats.push(makeBoat(i));
  await tick();

  // ---- spray + wake: one Points object, per-point size/alpha
  const MAXP = 360;
  const spGeo = new THREE.BufferGeometry();
  const spPos = new Float32Array(MAXP * 3), spSize = new Float32Array(MAXP), spAlpha = new Float32Array(MAXP);
  spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); spGeo.setAttribute('aSize', new THREE.BufferAttribute(spSize, 1)); spGeo.setAttribute('aAlpha', new THREE.BufferAttribute(spAlpha, 1));
  const spMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uScale: { value: 600 } },
    vertexShader: 'attribute float aSize; attribute float aAlpha; varying float vA; uniform float uScale; void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.15, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vec3(0.97,1.0,1.0), a); }',
  });
  const spray = new THREE.Points(spGeo, spMat); spray.frustumCulled = false; spray.renderOrder = 5; stage.scene.add(spray);
  // wake ribbons
  const MAXR = 4 * 90;
  const rbPos = new Float32Array(MAXR * 2 * 3), rbCol = new Float32Array(MAXR * 2), rbIdx = [];
  for (let b = 0; b < 4; b++) for (let k = 0; k < 89; k++) { const a = (b * 90 + k) * 2; rbIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const rbGeo = new THREE.BufferGeometry();
  rbGeo.setAttribute('position', new THREE.BufferAttribute(rbPos, 3)); rbGeo.setAttribute('aAlpha', new THREE.BufferAttribute(rbCol, 1)); rbGeo.setIndex(rbIdx);
  const rbMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'attribute float aAlpha; varying float vA; void main(){ vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(vec3(0.96,1.0,1.0), vA); }',
  });
  const ribbon = new THREE.Mesh(rbGeo, rbMat); ribbon.frustumCulled = false; ribbon.renderOrder = 3; stage.scene.add(ribbon);

  // ---- real spectators on the sand (instanced crowd3d)
  let crowd = null;
  try {
    const n = quality === 'low' ? 40 : quality === 'medium' ? 90 : 160;
    crowd = V3.createCrowd3d(stage, { free: { area: [-60, 3.2, 60, 11], y: 0.0, count: n, walkers: 0.15, face: [0, 0, -1] }, count: n, seed: 7, culture: 'african', quality: quality === 'high' ? 'medium' : 'low', excitement: 0.3 });
  } catch (e) { console.warn('crowd unavailable', e); }

  // ---- paddlers (loaded after the first frames so the picture never waits on them)
  P.loadCrew = (async () => {
    for (let b = 0; b < NB; b++) {
      for (let k = 0; k < 2; k++) {
        try {
          const pd = await loadPaddler(V3, { character: (b + k) % 3 === 2 ? 'athlete_f' : 'athlete_m', skin: SKINS[b * 2 + k], lod: quality === 'high' ? 0 : 1 });
          const B = P.boats[b]; pd.h.root.position.set(0, 0.05, SEATS[k]); pd.h.root.rotation.y = Math.PI; B.tilt.add(pd.h.root); stage.track(pd.h);
          B.crew[k] = pd; pd.h.play(pd.clips[1], { fade: 0 });
          stage.invalidate();
        } catch (e) { console.warn('paddler failed to load', e); }
        await tick();
      }
    }
    P.crewReady = true;
  })();

  // ---- camera / projection
  const cam = { ppm: 20, ax: 360, ay: 800, pitch: 56 };
  const tmp = V();
  function setCamera(c, L, st) {
    const ppm = c.ppm, fov = stage.camera.fov, d = L.h / (2 * ppm * Math.tan((fov * Math.PI) / 360));
    const th = (c.pitch ?? 56) * Math.PI / 180;
    const yaw = c.phi + (c.dir < 0 ? Math.PI : 0);
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const tx = c.y, tz = -c.s;
    const camera = stage.camera;
    camera.position.set(tx - fx * d * Math.cos(th), d * Math.sin(th), tz - fz * d * Math.cos(th));
    camera.up.set(0, 1, 0); camera.lookAt(tx, 0, tz);
    camera.aspect = L.w / L.h;
    camera.setViewOffset(L.w, L.h, L.w / 2 - c.ax, L.h / 2 - c.ay, L.w, L.h);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    st.d = d; st.yaw = yaw;
  }
  const projSt = { L: null };
  v3.proj = (s, y) => { tmp.set(y, 0, -s).project(stage.camera); const L = projSt.L || { w: 720, h: 1280 }; return { x: (tmp.x * 0.5 + 0.5) * L.w, y: (0.5 - tmp.y * 0.5) * L.h }; };

  // ---- paddle + crew pose per boat
  const P3 = V(), G = V(), Lw = V(), Bt = V(), dirv = V(), up = V(0, 1, 0), q = new THREE.Quaternion();
  const loc = (B, x, y, z) => B.tilt.localToWorld(P3.set(x, y, z)).clone();
  function poseCrew(B, bo, tSince, side, dt, wet) {
    for (let k = 0; k < 2; k++) {
      const pd = B.crew[k], paddle = B.paddles[k];
      if (!pd) { paddle.visible = false; continue; }
      const ph = clamp(Math.max(0, tSince / 0.34 - k * 0.06), 0, STROKE_LEN);
      const clip = pd.clips[side];
      const tr = pd.h.layers.base.current;
      if (!tr || tr.clip !== clip) { pd.h.play(clip, { fade: 0.12, loop: false }); }
      const t2 = pd.h.layers.base.current; if (t2) { t2.speed = 0; t2.time = clamp(ph, 0, STROKE_LEN - 0.001); }
      // blade and shaft in the hull frame
      const zs = SEATS[k] - 0.1;
      let e, tipY, tipZ, tilt;
      if (ph <= 1) { e = ss(0, 1, ph); tipZ = lerp(zs - 0.9, zs + 0.45, e); tipY = lerp(-0.30, -0.22, e); tilt = lerp(0.42, -0.34, e); }
      else { const r = clamp((ph - 1) / 0.7, 0, 1), er = ss(0, 1, r); tipZ = lerp(zs + 0.45, zs - 0.9, er); tipY = lerp(-0.2, 0.08, Math.sin(Math.min(1, r * 1.6) * Math.PI / 2)) + 0.12 * Math.sin(r * Math.PI); tilt = lerp(-0.34, 0.42, er); }
      const sx = side * 0.76;
      const inward = -side * 0.34;
      dirv.set(inward * 0.8, 1, tilt).normalize();
      Bt.set(sx, tipY, tipZ);
      // hand points on the shaft (hull frame -> world)
      const topLocal = V().copy(Bt).addScaledVector(dirv, 1.33), lowLocal = V().copy(Bt).addScaledVector(dirv, 0.80);
      B.tilt.updateMatrixWorld(true);
      B.tilt.localToWorld(topLocal); B.tilt.localToWorld(lowLocal);
      const hi = side > 0 ? 'L' : 'R', lo = side > 0 ? 'R' : 'L';
      pd.h.setReach(hi, topLocal, { weight: 1 }); pd.h.setReach(lo, lowLocal, { weight: 1 });
      B.reach = B.reach || []; B.reach[k] = { topLocal, lowLocal, Bt: Bt.clone(), dirv: dirv.clone() };
      paddle.visible = true;
    }
  }
  function placePaddles(B) {
    for (let k = 0; k < 2; k++) {
      const pd = B.crew[k], paddle = B.paddles[k], rc = B.reach && B.reach[k];
      if (!pd || !rc) continue;
      // after the humans updated: derive the paddle from where the hands actually are (so it is always in the hands)
      const hh = pd.h.arms ? pd.h.arms : null;
      let top = rc.topLocal, low = rc.lowLocal;
      if (hh && hh.L && hh.R) {
        const a = hh.L.end.getWorldPosition(V()), b = hh.R.end.getWorldPosition(V());
        const sideSign = B.side;
        top = sideSign > 0 ? a : b; low = sideSign > 0 ? b : a;
      }
      dirv.copy(top).sub(low);
      if (dirv.lengthSq() < 1e-4) dirv.set(0, 1, 0);
      dirv.normalize();
      q.setFromUnitVectors(up, dirv);
      paddle.quaternion.copy(q);
      paddle.position.copy(low).addScaledVector(dirv, -0.80);
      // roll the blade square to the boat
      paddle.updateMatrixWorld(true);
    }
  }

  // ---- per frame
  let clock = 0, last = 0, frames = 0, ema = 16;
  const parts = [];
  function boatPal(B, pal) {
    const key = pal.main + pal.band + pal.trim;
    if (B.palKey === key) return;
    B.palKey = key;
    const g = B.hull; const old = g.skin.map;
    const fresh = makeHull(THREE, pal, 10 + B.i);
    g.skin.map = fresh.skin.map; g.innerM.map = fresh.skin.map; g.skin.needsUpdate = true; g.innerM.needsUpdate = true; old.dispose();
    B.paddles.forEach((p) => { p.children[0].material.color.set(pal.band === '#ffffff' ? pal.main : pal.band); });
    B.crew.forEach((pd) => { if (pd) pd.h.setKit({ top: pal.shirt }); });
  }
  function prepare(state, L) {
    sizeKey = `${L.w}x${L.h}`;
    projSt.L = L;
    const sc = state.scene;
    let src = null;
    if (sc === 'play' && state.race) src = { race: state.race, cam: state.cam, trails: state.trails, parts: state.parts, t: state.t, t0: state.race.t };
    else if (state.att) src = { race: state.att.race, cam: state.att.cam, trails: state.att.trails, parts: state.att.parts, t: state.att.t, t0: state.att.race.t };
    P.src = src;
    if (!src) return null;
    const c = { ...src.cam };
    if (sc === 'title' && v3.hero && !P.lab) {
      const h = v3.hero, bs = src.race.boats;
      let sMin = 1e9, sMax = -1e9, yMin = 1e9, yMax = -1e9;
      for (const b of bs) { sMin = Math.min(sMin, b.s); sMax = Math.max(sMax, b.s); yMin = Math.min(yMin, b.y); yMax = Math.max(yMax, b.y); }
      if (bs.length === 1) { sMin = bs[0].s - 3.5; sMax = bs[0].s + 2; yMin = bs[0].y - 5; yMax = bs[0].y + 12; }
      c.s = (sMin + sMax) / 2; c.y = (yMin + yMax) / 2;
      c.ppm = clamp(Math.min(h.w / (yMax - yMin + 12), h.h / (sMax - sMin + 14)), 9, 26); c.ax = h.x + h.w / 2; c.ay = h.y + h.h * 0.66; c.pitch = 52;
    }
    if (P.lab) Object.assign(c, P.lab.cam || {});
    P.camState = c;
    setCamera(c, L, cam);
    return src;
  }
  function present(state, L, dt, src) {
    if (!src) return;
    const { race, cam: c } = src;
    clock += dt;
    const U = water.uniforms;
    const sea = race.sea, tw = src.t0;
    U.uT.value = src.t; U.uD.value = sea.D; U.uCurAmp.value = sea.curAmp; U.uP1.value = sea.p1; U.uP2.value = sea.p2;
    U.uMineY.value = LANES[race.boats[0].lane];
    U.uCam.value.copy(stage.camera.position);
    // swells near the camera focus
    const arr = U.uW.value, brk = U.uBrk.value; let n = 0;
    for (const w of sea.waves) {
      const cr = w.c0 - CW * tw;
      if (cr < c.s - 90) continue;
      if (cr > c.s + 150) break;
      if (n >= MAXW) break;
      arr[n].set(cr, w.h, w.skew, w.ph); brk[n] = cr < BRK ? clamp((BRK - cr) / 6, 0, 1) : 0; n++;
    }
    for (; n < MAXW; n++) { arr[n].set(0, 0, 0, 0); brk[n] = 0; }
    // buoys and gates
    const mine = race.boats[0].lane;
    world.buoys.forEach((b, l) => {
      const big = l === mine;
      b.g.position.set(LANES[l], 0.1 + 0.07 * Math.sin(clock * 1.7 + l), -sea.D);
      b.g.scale.setScalar(big ? 1.35 : 1);
      b.body.rotation.y = clock * 0.2 + l; b.g.rotation.z = 0.05 * Math.sin(clock * 1.3 + l);
      b.halo.scale.setScalar(1 + 0.1 * Math.sin(clock * 2)); b.halo.material.opacity = big ? 0.75 : 0.3;
      b.flag.rotation.y = 0.35 * Math.sin(clock * 3 + l);
    });
    world.gates.forEach((g, i) => { const l = i >> 1, sd = i & 1 ? 1 : -1; g.g.position.set(LANES[l] + sd * 6, 0.05 + 0.03 * Math.sin(clock * 1.5 + i), -2.2); g.g.rotation.z = 0.04 * Math.sin(clock * 1.4 + i); g.pen.material.color.set(l === mine ? '#f26a21' : '#1b5fa8'); });
    // boats
    const cs = Math.sin(cam.yaw ?? 0);
    for (let i = 0; i < NB; i++) {
      const B = P.boats[i];
      let b = race.boats[i];
      if (!b && i > 0 && race.boats.length === 1 && state.scene !== 'play') {   // menus: the lone attract crew gets three showcase rivals
        const m = race.boats[0], off = [[-7, -4], [7, 2.5], [14, -7]][i - 1];
        b = { ...m, y: m.y + off[0], s: m.s + off[1], hd: m.hd * (i % 2 ? -1 : 1) * 0.6 + 0.04 * i, tSince: (m.tSince + i * 0.23) % 0.78, lastSide: i % 2 ? -m.lastSide : m.lastSide, roll: 0, swamp: 0, ride: null };
        if (!B.showPal) B.showPal = PALETTES[i];
      }
      if (!b) { B.root.visible = false; B.paddles.forEach((p) => { p.visible = false; }); continue; }
      B.root.visible = true;
      boatPal(B, race.pal[i] || B.showPal || race.pal[0]);
      let lift = 0;
      for (const w of sea.waves) { const cc = w.c0 - CW * tw - b.s; if (cc < -6) continue; if (cc > 6) break; lift += w.h * Math.exp(-(cc * cc) / 6); }
      const heave = 0.16 * Math.min(1.4, lift) + (b.ride ? 0.08 : 0) + 0.02 * Math.sin(clock * 2.1 + i * 1.7);
      B.root.position.set(b.y, heave - (b.swamp > 0 ? 0.12 : 0), -b.s);
      B.root.rotation.y = (cam.yaw ?? 0) - b.hd; B.root.scale.setScalar(1.22);
      B.tilt.rotation.z = -clamp(b.roll, -1.2, 1.2) * 0.3;
      B.tilt.rotation.x = -0.05 * Math.min(1.2, lift) - (b.ride ? 0.06 : 0) + 0.015 * Math.sin(clock * 1.7 + i);
      B.hull.water.visible = b.swamp > 0;
      B.skirt.material.opacity = 0.55 + 0.4 * clamp(b.v / 3.5, 0, 1);
      B.skirt.scale.set(1 + 0.12 * clamp(b.v / 4, 0, 1), 1, 1);
      B.sh.visible = true;
      B.side = b.lastSide || 1;
      // a fresh stroke: catch splash
      if (b.tSince < B.lastT - 0.2 && b.v > 0.3) emitSplash(B, b);
      B.lastT = b.tSince;
      const wet = b.v > 0.3 || b.tSince < 0.34;
      B.tilt.updateMatrixWorld(true);
      const ts = P.lab && P.lab.tSince !== undefined ? P.lab.tSince : b.tSince;
      if (P.lab && P.lab.side) B.side = P.lab.side;
      poseCrew(B, b, ts, B.side, dt, wet);
    }
    // humans: advance first, then place props from the posed bones
    stage.setShadowTarget(race.boats[0].y, 0, -race.boats[0].s);
    stage.update(dt, { renderNow: false });
    for (let i = 0; i < NB; i++) if (race.boats[i]) placePaddles(P.boats[i]);
    if (crowd) crowd.update(dt);
    // spray particles and wake ribbons
    writeFx(src, race, dt);
    spMat.uniforms.uScale.value = (canvas.clientHeight || 800) * 0.5 / Math.tan((stage.camera.fov * Math.PI) / 360);
    stage.render();
  }
  const sp = [];   // { x,y,z,vx,vy,vz,life,max,size }
  function emitSplash(B, b) {
    const sx = B.root.position.x + B.side * 0.8, sz = B.root.position.z + SEATS[0] * 0.0;
    for (let i = 0; i < 7; i++) sp.push({ x: sx + Math.sin(i * 12.9) * 0.2, y: 0.1, z: sz - 0.8 + Math.cos(i * 7.7) * 0.25, vx: Math.sin(i * 3.3) * 0.7 + B.side * 0.5, vy: 1.0 + Math.abs(Math.sin(i * 5.1)) * 1.4, vz: 0.5 + Math.cos(i * 2.3) * 0.5, life: 0.8, max: 0.8, size: 0.35 });
  }
  function writeFx(src, race, dt) {
    // sim particles (splashes, punch spray) from the game
    let n = 0;
    for (const p of src.parts || []) {
      if (n >= MAXP - 40) break;
      const f = 1 - p.t / p.max;
      spPos[n * 3] = p.y; spPos[n * 3 + 1] = 0.25 + 0.9 * Math.sin(Math.min(1, p.t / p.max) * Math.PI); spPos[n * 3 + 2] = -p.s;
      spSize[n] = p.size * (0.7 + 0.8 * (1 - f)) * 1.4; spAlpha[n] = 0.85 * f; n++;
    }
    for (let i = sp.length - 1; i >= 0; i--) { const s = sp[i]; s.life -= dt; if (s.life <= 0) { sp.splice(i, 1); continue; } s.vy -= 6 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; if (n < MAXP) { const u = s.life / s.max; spPos[n * 3] = s.x; spPos[n * 3 + 1] = Math.max(0.05, s.y); spPos[n * 3 + 2] = s.z; spSize[n] = s.size * (1.4 - u * 0.5); spAlpha[n] = u * 0.9; n++; } }
    for (let i = n; i < MAXP; i++) { spAlpha[i] = 0; spSize[i] = 0; }
    spGeo.attributes.position.needsUpdate = spGeo.attributes.aSize.needsUpdate = spGeo.attributes.aAlpha.needsUpdate = true;
    // wake ribbons: one strip per boat from its trail
    const trails = src.trails || [];
    for (let b = 0; b < 4; b++) {
      const tr = trails[b];
      for (let k = 0; k < 90; k++) {
        const o = (b * 90 + k) * 2;
        if (!tr || !tr.pts || tr.pts.length < 2 || k >= tr.pts.length) { rbCol[o] = rbCol[o + 1] = 0; for (let m = 0; m < 6; m++) rbPos[o * 3 + m] = 0; continue; }
        const pt = tr.pts[k], f = k / tr.pts.length, wdt = 0.08 + 0.3 * f;
        rbPos[o * 3] = pt.y - wdt; rbPos[o * 3 + 1] = 0.05; rbPos[o * 3 + 2] = -pt.s;
        rbPos[o * 3 + 3] = pt.y + wdt; rbPos[o * 3 + 4] = 0.05; rbPos[o * 3 + 5] = -pt.s;
        rbCol[o] = rbCol[o + 1] = (0.02 + 0.22 * f) * tr.k;
      }
    }
    rbGeo.attributes.position.needsUpdate = rbGeo.attributes.aAlpha.needsUpdate = true;
  }

  P.ready = true;
  P.canvas = canvas;
  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      const state = game.getState();
      const L = layoutFor(view?.width ?? 720, view?.height ?? 1280);
      const now = performance.now(); let dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
      if (state.paused && state.scene === 'play') dt = 0;
      if (P.lost || !P.ready) { v3.on = false; r(ctx, view); return; }
      // quality auto-drop on slow devices
      ema = ema * 0.96 + dt * 1000 * 0.04; frames++;
      if (frames > 150 && ema > 26 && stage.quality !== 'low') { stage.setQuality && stage.setQuality(stage.quality === 'high' ? 'medium' : 'low'); frames = 0; ema = 16; }
      let src = null;
      try { src = prepare(state, L); } catch (e) { console.warn('3D prepare failed', e); v3.on = false; r(ctx, view); return; }
      if (src && !v3.on) { v3.on = true; canvas.style.transition = 'opacity 0.45s ease'; canvas.style.opacity = '1'; P.t0 = now; }
      if (v3.on) v3.fade = clamp((now - P.t0) / 450, 0, 1);
      v3.scene = state.scene;
      if (!P.noHud) r(ctx, view);
      try { present(state, L, dt, src); } catch (e) { console.warn('3D present failed', e); v3.on = false; canvas.style.opacity = '0'; }
    };
    return game;
  };
  P.noHud = /[?&]icon=1/.test(location.search);
  P.setLab = (o) => { P.lab = o; };
  return P;
}

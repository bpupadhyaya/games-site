// 3D presenter: READS the simulation (game.getState().sim) and draws the hall, the net, the shuttle with its trail and two lifelike players
// with rackets. It never writes back. Contact discipline: the sim decides where and when the shuttle is hit; poses.js makes the racket
// meet the shuttle at that exact moment (the swing is retimed to the sim's contact tick).
import { Actor } from './actor.js';
import { buildHall, buildShuttle, buildRacket } from './court.js';
import { poseFor } from './poses.js';
import { CAMV, cam, vfovOf, MODE } from '../src/camera.js';

const LIB = '../vendor3d/index.js';
const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return { stage: null, wrap: (g) => g, ready_p: Promise.resolve(false) }; }
  const { createStage, loadHuman, THREE } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'indoor', mode: 'continuous', shadows: false });
  if (!stage.supported) { canvas.remove(); return { stage: null, wrap: (g) => g, ready_p: Promise.resolve(false) }; }
  stage.camera.near = 0.5; stage.camera.far = 120; stage.camera.updateProjectionMatrix();
  stage.setLighting('indoor', { exposure: 1.0, hemi: 1.05, keyI: 2.2, rim: 0xcad8ff, rimI: 0.8 });
  stage.setSky('#0c1624', '#0c1624', { near: 45, far: 110 });
  const P = { stage, THREE, V3, humans: [null, null], actors: [null, null], rackets: [null, null], ball: null, hall: null, ready: false, lost: false, noRender: false, look: [null, null], loading: [false, false] };
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; });

  // ---- decals: ONE mesh with a quad per shadow (2 players, the shuttle) ---------------------------------------------------------------------
  const dTex = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.6, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const NQ = 4;
  const dPos = new Float32Array(NQ * 12), dUv = new Float32Array(NQ * 8), dIdx = new Uint16Array(NQ * 6);
  for (let q = 0; q < NQ; q++) {
    dUv.set([0, 0, 0.5, 0, 0.5, 1, 0, 1], q * 8);
    dIdx.set([q * 4, q * 4 + 2, q * 4 + 1, q * 4, q * 4 + 3, q * 4 + 2], q * 6);
  }
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3)); dGeo.setAttribute('uv', new THREE.BufferAttribute(dUv, 2)); dGeo.setIndex(new THREE.BufferAttribute(dIdx, 1));
  const decals = new THREE.Mesh(dGeo, new THREE.MeshBasicMaterial({ map: dTex, transparent: true, depthWrite: false }));
  decals.frustumCulled = false; decals.renderOrder = 1; stage.add(decals);
  const setDecal = (q, x, z, rx, rz) => { dPos.set([x - rx, 0.012, z + rz, x + rx, 0.012, z + rz, x + rx, 0.012, z - rz, x - rx, 0.012, z - rz], q * 12); };

  // ---- the trail: a camera-facing ribbon in additive vertex colours (fades to black = invisible) -----------------------------------------------
  const TN = 16;
  const tPos = new Float32Array(TN * 2 * 3), tCol = new Float32Array(TN * 2 * 3), tIdx = [];
  for (let i = 0; i < TN - 1; i++) { const a = i * 2; tIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3)); tGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3)); tGeo.setIndex(tIdx);
  const trail = new THREE.Mesh(tGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  trail.frustumCulled = false; trail.renderOrder = 4; stage.add(trail);
  const trailPts = [];
  // ---- hit sparks: a few additive sprites -------------------------------------------------------------------------------------------------
  const sparkTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 1, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,240,180,0.7)'); g.addColorStop(1, 'rgba(255,200,80,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const sparks = [];
  for (let i = 0; i < 10; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    sp.visible = false; sp.renderOrder = 5; stage.add(sp); sparks.push({ sp, life: 0, max: 1, size: 0.2, v: V() });
  }
  const burst = (x, y, z, power, dirz) => {
    let n = 0;
    for (const s of sparks) {
      if (s.life > 0) continue;
      s.life = 0.28 + 0.1 * n / 3; s.max = s.life; s.sp.visible = true; s.sp.position.set(x, y, z);
      const a = (n / 5) * Math.PI * 2 + n, sp = (0.8 + 0.8 * power) * (0.6 + 0.4 * ((n * 37) % 10) / 10);
      s.v.set(Math.cos(a) * sp, Math.sin(a * 1.7) * sp * 0.7 + 0.6, Math.sin(a) * sp + dirz * power * 1.2);
      s.size = 0.18 + 0.16 * power * (n === 0 ? 2 : 1);
      if (++n >= 6) break;
    }
  };
  // landing ring on the floor
  const ringM = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40), new THREE.MeshBasicMaterial({ color: 0x7fe8d6, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  ringM.rotation.x = -Math.PI / 2; ringM.position.y = 0.02; ringM.renderOrder = 2; ringM.visible = false; stage.add(ringM);
  let ringLife = 0;

  const kitOf = (look) => ({ top: look.kit.top, bottoms: look.kit.bottoms, socks: look.kit.socks });
  async function loadPlayer(i, look) {
    P.loading[i] = true;
    try {
      const h = await loadHuman({ character: look.female ? 'athlete_f' : 'athlete_m', kit: kitOf(look), skin: look.skin, hair: look.hair });
      h.groundClamp = 'auto'; h.footPlanting = true;
      h.play('ready_stance', { fade: 0, startTime: i * 0.9 });
      if (P.humans[i]) { stage.remove(P.humans[i]); const k = stage.humans.indexOf(P.humans[i]); if (k >= 0) stage.humans.splice(k, 1); }
      stage.add(h); stage.track(h);
      // the racket in the right hand: its axis along the fingers, the face across the palm; the pose layer re-aims it every frame
      const racket = buildRacket(look.racket || 0x2fb6a6);
      const fr = h.fingers.R;
      const hand = h.bones.Bip01_R_Hand;
      const axis = fr.fingerDir.clone().normalize(), nrm = fr.across.clone().normalize();
      nrm.addScaledVector(axis, -nrm.dot(axis)).normalize();
      const xAx = V().crossVectors(axis, nrm).normalize();
      racket.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAx, axis, nrm));
      const palmC = fr.knuckle.clone().multiplyScalar(0.55).addScaledVector(fr.palmDir, 0.012);
      racket.position.copy(palmC).addScaledVector(axis, -0.1);
      hand.add(racket);
      const a = new Actor(h);
      P.humans[i] = h; P.actors[i] = { a, h, i, state: 'idle', seed: i * 0.37, T: {}, byaw: i === 0 ? Math.PI : 0, racket, lite: false };
      P.rackets[i] = racket;
      P.look[i] = { female: look.female, sig: JSON.stringify([look.kit, look.skin, look.hair, look.racket]) };
    } finally { P.loading[i] = false; }
  }
  async function build() {
    P.ready = false;
    P.hall = buildHall(stage, { quality });
    P.ball = buildShuttle(2.1); stage.add(P.ball);
    const looks = P.pendingLooks || [{ female: false, kit: { top: '#2467c9', bottoms: '#173c78', socks: '#f3f3f3' }, skin: 'tan', hair: 'black', racket: 0x2fb6a6 }, { female: true, kit: { top: '#d6402f', bottoms: '#ffffff', socks: '#f3f3f3' }, skin: 'light', hair: 'brown', racket: 0xe8892f }];
    await Promise.all([loadPlayer(0, looks[0]), loadPlayer(1, looks[1])]);
    P.ready = true;
    stage.invalidate();
  }
  P.ready_p = build();
  P.build = build;
  function syncLooks(G) {
    if (!G.look) return;
    if (!P.ready) { P.pendingLooks = G.look; return; }
    for (let i = 0; i < 2; i++) {
      const lk = G.look[i]; if (!lk || P.loading[i]) continue;
      const sig = JSON.stringify([lk.kit, lk.skin, lk.hair, lk.racket]);
      if (P.look[i].female !== lk.female) { loadPlayer(i, lk); continue; }
      if (P.look[i].sig !== sig) { const h = P.humans[i]; h.setKit(kitOf(lk)); h.setSkin(lk.skin); h.setHair(lk.hair); P.look[i].sig = sig; }
    }
  }

  // ---- interpolation between 60 Hz sim ticks (also smooths slow motion) ----------------------------------------------------------------------
  const IP = { tick: -1, prev: null, cur: null, w0: 0, dur: 16.7, last: 0 };
  P.ip = IP;
  const snapOf = (s) => ({ t: s.t, p: s.players.map((p) => ({ x: p.x, z: p.z, vx: p.vx, vz: p.vz })), b: { x: s.shuttle.x, y: s.shuttle.y, z: s.shuttle.z, vx: s.shuttle.vx, vy: s.shuttle.vy, vz: s.shuttle.vz, age: s.shuttle.age } });
  const lerp = (a, b, t) => a + (b - a) * t;
  function display(s) {
    const now = performance.now();
    if (P.exact || !IP.cur) { IP.cur = snapOf(s); IP.prev = IP.cur; IP.tick = s.tick; IP.w0 = now; return { ...IP.cur, td: s.t }; }
    if (s.tick !== IP.tick) {
      const el = Math.min(4, Math.max(1, s.tick - IP.tick));
      const gap = now - IP.last; IP.last = now;
      IP.prev = IP.cur; IP.cur = snapOf(s); IP.w0 = now; IP.tick = s.tick;
      IP.dur = clampN(gap > 0 && gap < 80 ? gap : 16.7 * el, 8, 60);
    }
    const a = Math.min(1, (now - IP.w0) / IP.dur);
    const jump = Math.hypot(IP.cur.b.x - IP.prev.b.x, IP.cur.b.z - IP.prev.b.z, IP.cur.b.y - IP.prev.b.y) > 2.5 || s.t < IP.prev.t;
    const A = jump ? 1 : a;
    const sh = { t: lerp(IP.prev.t, IP.cur.t, A), p: IP.cur.p.map((q, i) => { const o = IP.prev.p[i]; const tele = Math.hypot(q.x - o.x, q.z - o.z) > 1.5; return { x: tele ? q.x : lerp(o.x, q.x, A), z: tele ? q.z : lerp(o.z, q.z, A), vx: q.vx, vz: q.vz }; }), b: { x: lerp(IP.prev.b.x, IP.cur.b.x, A), y: lerp(IP.prev.b.y, IP.cur.b.y, A), z: lerp(IP.prev.b.z, IP.cur.b.z, A), vx: IP.cur.b.vx, vy: IP.cur.b.vy, vz: IP.cur.b.vz, age: IP.cur.b.age } };
    return { ...sh, td: sh.t };
  }

  // adaptive quality: when frames run long on a weak device, solve the arms more cheaply, then lower the pixel ratio
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick() {
    const now = performance.now();
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 21 && perfLevel < 2) {
        perfLevel++;
        if (perfLevel === 1) { for (const pa of P.actors) if (pa) pa.a.lite = true; }
        else stage.renderer.setPixelRatio(Math.min(1.25, stage.renderer.getPixelRatio()));
        stage.invalidate();
      }
    }
  }
  let lastT = null, evSeen = 0;
  const _q = new THREE.Quaternion(), _a = V(), _b = V(0, 1, 0);
  function frame(game) {
    if (!P.ready || P.lost) return;
    const G = game.getState();
    syncLooks(G);
    const s = G.sim;
    if (!s) { stage.setVisible(false); return; }
    stage.setVisible(true);
    const D = display(s);
    let dt = lastT === null ? 0 : D.td - lastT; lastT = D.td;
    if (dt < 0) dt = 0; dt = Math.min(dt, 0.1);
    for (const e of s.events) {
      if (e.id < evSeen) continue;
      evSeen = e.id + 1;
      if (e.type === 'hit') burst(e.x, e.y, e.z, Math.min(1, e.v / 60), e.who === 0 ? -1 : 1);
      else if (e.type === 'net' || e.type === 'cord') P.hall.net.poke(s.shuttle.x, e.type === 'net' ? 1 : 0.6);
      else if (e.type === 'land') { ringM.position.set(e.x, 0.02, e.z); ringM.material.color.setHex(e.inside ? 0x7fe8d6 : 0xff7a66); ringLife = 1.3; ringM.visible = true; }
    }
    for (let i = 0; i < 2; i++) {
      const sp = s.players[i], d = D.p[i], pa = P.actors[i];
      pa.h.root.position.set(d.x, 0, d.z);
      poseFor(P, s, sp, d, pa, D, dt);
    }
    // the shuttle
    const bm = P.ball, b = D.b, sh = s.shuttle;
    const held = s.phase === 'serve' && sh.kind === 'held';
    if (held) {
      const sv = s.serve ? s.serve.srv : s.server, pa = P.actors[sv];
      const hp = pa.h.bonePosition('L_Hand'); bm.position.set(hp.x, hp.y + 0.07, hp.z);
    } else bm.position.set(b.x, b.y, b.z);
    bm.visible = !!sh.vis;
    const spd = Math.hypot(b.vx, b.vy, b.vz);
    {
      // the cork leads; just after a hit the shuttle is still turning round (the flip)
      if (held) _a.set(0, 1, 0);
      else if (spd > 0.3) {
        _a.set(b.vx / spd, b.vy / spd, b.vz / spd);
        const age = b.age;
        if (age < 0.1 && sh.kind === 'flight') {
          const k = 1 - age / 0.1;       // 1 at the hit (cork backwards) -> 0 (cork forward)
          _a.multiplyScalar(1 - 2 * k * k).addScaledVector(V(-_a.z, 0.25, _a.x), 1.4 * k * (1 - k) * 2).normalize();
        }
      } else _a.set(0, -1, 0);
      _q.setFromUnitVectors(_b, _a);
      bm.quaternion.copy(_q);
      if (sh.kind === 'down') { bm.quaternion.setFromAxisAngle(V(1, 0, 0), Math.PI / 2 + 0.2); bm.position.y = 0.03; }
      bm.userData.inner.rotation.y += dt * (spd > 3 ? 18 : 0);
    }
    if (sh.kind === 'flight' && sh.vis) {
      const last = trailPts[trailPts.length - 1];
      if (!last || Math.hypot(last.x - bm.position.x, last.y - bm.position.y, last.z - bm.position.z) > 0.03) { trailPts.push({ x: bm.position.x, y: bm.position.y, z: bm.position.z, sp: spd }); if (trailPts.length > TN) trailPts.shift(); }
    } else if (trailPts.length) trailPts.shift();
    updateTrail();
    for (let i = 0; i < 2; i++) { const d = D.p[i]; setDecal(i, d.x, d.z, 0.55, 0.36); }
    { const h = Math.max(0, b.y - 0.05), k = 0.12 + h * 0.012; if (sh.vis && !held && sh.kind !== 'down') setDecal(2, b.x, b.z, k, k * 0.7); else setDecal(2, 0, 0, 0, 0); }
    setDecal(3, 0, 0, 0, 0);
    dGeo.attributes.position.needsUpdate = true;
    for (const q of sparks) {
      if (q.life <= 0) { q.sp.visible = false; continue; }
      q.life -= dt; const k = Math.max(0, q.life / q.max);
      q.sp.position.addScaledVector(q.v, dt); q.v.y -= 6 * dt; q.sp.material.opacity = k; q.sp.scale.setScalar(q.size * (0.5 + 0.8 * (1 - k)));
    }
    if (ringLife > 0) { ringLife -= dt; const k = Math.max(0, ringLife / 1.3); ringM.material.opacity = 0.9 * Math.min(1, k * 2); ringM.scale.setScalar(1 + (1 - k) * 0.6); if (ringLife <= 0) ringM.visible = false; }
    if (P.hallMode !== MODE) { P.hallMode = MODE; P.hall.setView(MODE); }
    P.hall.net.update(Math.min(dt, 0.03));
    positionCamera();
    if (!P.noRender) { stage.render(); perfTick(); }
  }
  function updateTrail() {
    const n = trailPts.length;
    if (n < 2) { trail.visible = false; return; }
    trail.visible = true;
    const cp = stage.camera.position;
    for (let i = 0; i < TN; i++) {
      const p = trailPts[Math.min(i, n - 1)], q = trailPts[Math.min(i + 1, n - 1)];
      let dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z; let l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
      const vx = cp.x - p.x, vy = cp.y - p.y, vz = cp.z - p.z;
      let rx = dy * vz - dz * vy, ry = dz * vx - dx * vz, rz = dx * vy - dy * vx; l = Math.hypot(rx, ry, rz) || 1; rx /= l; ry /= l; rz /= l;
      const age = i < n ? (i + 1) / n : 1;
      const w = 0.006 + 0.022 * age * Math.min(1, p.sp / 25);
      const o = i * 6;
      tPos[o] = p.x + rx * w; tPos[o + 1] = p.y + ry * w; tPos[o + 2] = p.z + rz * w;
      tPos[o + 3] = p.x - rx * w; tPos[o + 4] = p.y - ry * w; tPos[o + 5] = p.z - rz * w;
      const c = i < n ? Math.pow(age, 1.7) * Math.min(1, p.sp / 18) * 0.55 : 0;
      tCol[o] = tCol[o + 3] = c * 0.75; tCol[o + 1] = tCol[o + 4] = c * 0.95; tCol[o + 2] = tCol[o + 5] = c;
    }
    tGeo.attributes.position.needsUpdate = true; tGeo.attributes.color.needsUpdate = true;
  }
  // FLUID FRAMING: the camera position and direction never change; the field of view and a small principal-point shift are solved from the live
  // screen size (src/camera.js fitCamera, set by game.js each frame) so the whole court fills the free part of the screen, never stretched.
  let camKey = '';
  function positionCamera() {
    const c = P.camOverride || cam(), camr = stage.camera;
    const W = canvas.clientWidth || 720, Hh = canvas.clientHeight || 1280;
    const key = `${W}x${Hh}|${CAMV.key}|${P.camOverride ? 'o' : ''}`;
    if (key !== camKey) {
      camKey = key;
      const aspect = W / Hh;
      camr.aspect = aspect;
      if (P.camOverride) { camr.fov = (2 * Math.atan(Math.tan((c.hfov * Math.PI) / 360) / aspect) * 180) / Math.PI; camr.clearViewOffset(); }
      else {
        camr.fov = vfovOf(CAMV);
        camr.setViewOffset(W, Hh, (-CAMV.ox / 2) * W, (CAMV.oy / 2) * Hh, W, Hh);
      }
      camr.updateProjectionMatrix();
    }
    camr.position.set(c.x, c.y, c.z); camr.lookAt(c.lx, c.ly, c.lz);
  }
  function placeCanvas(view) {
    const cw = kitCanvas.clientWidth || globalThis.innerWidth, ch = kitCanvas.clientHeight || globalThis.innerHeight;
    const vw = (view && view.width) || 720, vh = (view && view.height) || 1280;
    const sc = Math.min(cw / vw, ch / vh), w = Math.round(vw * sc), h = Math.round(vh * sc);
    const key = `${cw}x${ch}|${w}x${h}`;
    if (key === P.placeKey) return;
    P.placeKey = key;
    const full = Math.abs(w - cw) <= 1 && Math.abs(h - ch) <= 1;
    canvas.style.cssText = full ? 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0'
      : `position:fixed;left:${Math.round((cw - w) / 2)}px;top:${Math.round((ch - h) / 2)}px;width:${w}px;height:${h}px;display:block;pointer-events:none;z-index:0`;
    stage.resize();
  }
  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      view.cssW = kitCanvas.clientWidth || 720; view.cssH = kitCanvas.clientHeight || 1280;
      r(ctx, view);
      placeCanvas(view);
      frame(game);
    };
    return game;
  };
  P.frame = frame;
  return P;
}

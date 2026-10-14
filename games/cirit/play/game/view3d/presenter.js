// 3D presenter: READS the simulation (game.getState().sim) and draws the field, the horses, the riders, the target standards and the
// javelins. It never writes back. Release discipline: the sim owns when and where a javelin leaves the hand; the presenter retimes the throw
// clip so its release frame lands on the sim's release tick. Display is interpolated between the two latest sim ticks. The camera comes from
// game state (`cam`, smoothed by game.js) through src/camera.js, the same maths the HUD uses to place rings and read the finger.
import { createRider, makeJavelin, makeBundle, makeShield } from './rider.js';
import { Actor } from './actor.js';
import { buildField, buildBlobs, buildPuffs, STANDS } from './field.js';
import { rigFor } from '../src/camera.js';
import { FIG, COSTUMES, SKINS, HORSES, OPP_COATS } from '../src/consts.js';

const LIB = '../vendor3d/index.js';
const DT = 1 / 60;
const lerp = (a, b, t) => a + (b - a) * t;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const COAT_MAP = { dun: 'buckskin' };

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  const { createStage, THREE, loadHorse, createCrowd3d } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: false });
  if (!stage.supported) { canvas.remove(); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  stage.camera.near = 1.0; stage.camera.far = 900; stage.camera.updateProjectionMatrix();
  stage.setLighting('day', { exposure: 1.0, hemi: 1.0, keyI: 2.5 });
  stage.setSky('#a9c8e4', '#dbe4e6', { near: 260, far: 700 });
  stage.lights.key.position.set(-18, 30, -14);

  const P = { stage, THREE, ready: false, lost: false, quality, events: [] };
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; stage.invalidate(); });

  const fld = buildField(stage, { quality });
  P.field = fld;
  const blobs = buildBlobs(16); stage.add(blobs.mesh);
  const camQ = new THREE.Quaternion();
  const puffs = buildPuffs(60, camQ); stage.add(puffs.mesh);

  // ---- kicked-up clods of earth: small lumps that fly, bounce once and die
  const CL = 90;
  const clodMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshStandardMaterial({ color: '#6b4a2b', roughness: 1, flatShading: true }), CL);
  clodMesh.frustumCulled = false; clodMesh.name = 'clods'; stage.add(clodMesh);
  const clods = []; for (let i = 0; i < CL; i++) clods.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0.05, spin: 0, bounced: false });
  let clodNext = 0;
  const cm4 = new THREE.Matrix4(), cq = new THREE.Quaternion(), cs = new THREE.Vector3(), cp = new THREE.Vector3(), ce = new THREE.Euler();
  const spawnClod = (x, y, z, vx, vy, vz, s) => { const c = clods[clodNext]; clodNext = (clodNext + 1) % CL; Object.assign(c, { life: 1.1, x, y, z, vx, vy, vz, s, spin: Math.random() * 6, bounced: false }); };
  const updateClods = (dt) => {
    for (let i = 0; i < CL; i++) {
      const c = clods[i];
      if (c.life > 0) {
        c.life -= dt; c.vy -= 9.8 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.spin += dt * 12;
        if (c.y < c.s) { c.y = c.s; if (!c.bounced) { c.vy *= -0.3; c.vx *= 0.5; c.vz *= 0.5; c.bounced = true; } else { c.vx = c.vz = c.vy = 0; } }
      }
      const s = c.life > 0 ? c.s * Math.min(1, c.life * 4) : 0.0001;
      cs.set(s, s * 0.8, s); cp.set(c.x, c.y, c.z); ce.set(c.spin, c.spin * 0.7, 0); cq.setFromEuler(ce);
      cm4.compose(cp, cq, cs); clodMesh.setMatrixAt(i, cm4);
    }
    clodMesh.instanceMatrix.needsUpdate = true;
  };

  // ---- javelins in flight and on the ground: two colour sets of 6, with spin, wobble and a skip on landing
  let javMeshes = [];
  const buildJavs = (cloth) => {
    for (const jm of javMeshes) stage.scene.remove(jm.m);
    javMeshes = [];
    for (let t = 0; t < 2; t++) for (let i = 0; i < 6; i++) { const m = makeJavelin(cloth[t], 1.1); m.visible = false; stage.add(m); javMeshes.push({ m, team: t, id: -1, dir: new THREE.Vector3(0, 0, 1), age: 0, roll: 0, down: 0, skip: 0, seen: false }); }
  };
  buildJavs([COSTUMES[0].cloth, COSTUMES[1].cloth]);
  const jav3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), qj = new THREE.Quaternion(), qr = new THREE.Quaternion(), dn = new THREE.Vector3();

  const actors = [];
  P.actors = actors;
  const look = { key: '' };
  let crowd = null;
  const camPos = new THREE.Vector3();
  P.ready_p = (async () => {
    const hq = quality === 'high' ? 'high' : quality === 'medium' ? 'medium' : 'low';
    for (let i = 0; i < 6; i++) {
      const team = i < 3 ? 0 : 1, K = COSTUMES[team === 0 ? 0 : 1];
      const coat = team === 0 ? HORSES[i % 3].coat : OPP_COATS[i % 3];
      const horse = await loadHorse({ coat: COAT_MAP[coat] || coat, mane: 'loose', tack: 'ottoman', quality: hq, blaze: i % 2 ? 'star' : undefined });
      horse.root.scale.setScalar(FIG);
      stage.add(horse);
      const rider = await createRider({ top: K.top, trim: K.trim, bottoms: K.bottoms, cap: K.cap, cloth: K.cloth, skin: SKINS[(i * 5 + 1) % SKINS.length], hair: i % 2 ? 'brown' : 'black', lod: quality === 'high' ? 0 : quality === 'medium' ? 'medium' : 'light', seed: i + 1 });
      stage.add(rider.human);
      const api = horse.attachRider(rider.human, { style: 'ottoman', hat: false });
      if (api && api.S) { api.S.seat = 0.85 * FIG; }
      try { horse.setTack('ottoman', { blanket: K.cloth, trim: K.trim }); } catch { /* keep default tack */ }
      const a = new Actor(i, rider, horse, THREE, i + 1);
      a.addTo(stage);
      horse.on('hoof', (e) => { if (a.hoofCb) a.hoofCb(e); });
      actors.push(a);
    }
    try {
      crowd = createCrowd3d(stage, {
        stands: STANDS.map((s) => ({ center: s.center, yaw: s.yaw, rows: s.rows, perRow: s.perRow, width: s.width, rise: s.rise, rowDepth: s.rowDepth, fill: s.name === 'end' ? 0.8 : 0.9, standing: 0.12 })),
        count: quality === 'high' ? 900 : quality === 'medium' ? 520 : 240, seed: 11, culture: ['middle_eastern', 'mediterranean'],
        quality: quality === 'high' ? 'high' : quality === 'medium' ? 'medium' : 'low', excitement: 0.25, props: { flag: 0.04, phone: 0.06, child: 0.05 }, flagColors: ['#c8202a', '#ffffff'],
      });
    } catch (e) { console.warn('crowd3d failed', e); }
    P.ready = true; stage.invalidate();
  })();
  P.ready_p.catch((e) => console.warn('presenter assets failed', e));

  // costume / horse choices for the match in progress (game state `look`): restyle only when they change
  function restyle(G) {
    const L = G.look || { costume: [0, 1], horses: [[0, 1, 2], [2, 1, 0]] };
    const key = JSON.stringify(L);
    if (key === look.key || !actors.length) return;
    look.key = key;
    actors.forEach((a, i) => {
      const team = i < 3 ? 0 : 1, slot = i % 3, K = COSTUMES[L.costume[team] % COSTUMES.length], hi = L.horses[team][slot];
      const coat = team === 0 ? HORSES[hi].coat : OPP_COATS[(hi + slot) % 3];
      try { a.horse.setCoat(COAT_MAP[coat] || coat); a.horse.setTack('ottoman', { blanket: K.cloth, trim: K.trim }); } catch { /* ignore */ }
      const r = a.rider, h = r.human;
      h.setKit({ top: K.top, bottoms: K.bottoms, trim: K.trim });
      r.costume.sash.material.color.set(K.cloth);
      r.costume.cap.children[0].material.color.set(K.cap); r.costume.cap.children[1].material.color.set(K.cap);
      for (const e of r.costume.parts) if (e.userData && e.userData.pants) e.material.color.set(K.bottoms);
      a.setCloth(K.cloth);
      for (const s of r.shields) { h.root.remove(s); }
      const sh = makeShield(K.cloth, K.trim)();
      sh.position.set(0, 0.05, -0.38); sh.rotation.x = -0.1;
      r.shields = [sh]; h.root.add(sh);
      h.detach(r.jav); r.jav = makeJavelin(K.cloth); h.attach(r.jav, 'R', 'bat', { slide: 0.55 });
      h.detach(r.bundle); r.bundle = makeBundle(K.cloth); h.attach(r.bundle, 'L', 'bat', { slide: 0.5 });
    });
    buildJavs([COSTUMES[L.costume[0] % COSTUMES.length].cloth, COSTUMES[L.costume[1] % COSTUMES.length].cloth]);
    stage.invalidate();
  }

  // ---- display interpolation: the two latest sim ticks
  let curSnap = null, prevSnap = null, curStamp = 0, lastTick = -1, lastSim = null, lastTr = 0, seen = -1;
  const nowMs = () => (P.clock ? P.clock() : performance.now());
  const snap = (s) => ({
    tick: s.tick, t: s.t,
    r: s.riders.map((r) => ({ x: r.x, z: r.z, h: r.h, v: r.v, w: r.w, javs: r.javs, role: r.role, active: r.active, lean: r.lean.t })),
    j: s.javs.map((j) => ({ id: j.id, x: j.x, y: j.y, z: j.z, vx: j.vx, vy: j.vy, vz: j.vz, state: j.state, team: j.team })),
  });
  const lookAt = new THREE.Vector3();
  let tAbs = 0;

  function frame(game) {
    if (!P.ready || P.lost) return;
    const G = game.getState(), s = G.sim;
    if (!s) { stage.setVisible(false); return; }
    stage.setVisible(true);
    restyle(G);
    if (s !== lastSim) { lastSim = s; curSnap = prevSnap = null; lastTick = -1; seen = s.evId - 1; lastTr = s.t; for (const a of actors) a.reset(); }
    if (s.tick !== lastTick) { prevSnap = curSnap || snap(s); curSnap = snap(s); curStamp = nowMs(); lastTick = s.tick; if (prevSnap.tick > curSnap.tick || curSnap.tick - prevSnap.tick > 3) prevSnap = curSnap; }
    const alpha = curSnap === prevSnap ? 1 : Math.min(1, Math.max(0, (nowMs() - curStamp) / (DT * 1000)));
    const Tr = lerp(prevSnap.t, curSnap.t, alpha);
    let dt = Tr - lastTr; if (dt < 0 || dt > 0.1) dt = 0; lastTr = Tr;
    tAbs += dt;
    const R = curSnap.r.map((c, i) => { const p = prevSnap.r[i]; return { x: lerp(p.x, c.x, alpha), z: lerp(p.z, c.z, alpha), h: wrapA(p.h + wrapA(c.h - p.h) * alpha), v: lerp(p.v, c.v, alpha), w: lerp(p.w, c.w, alpha), javs: c.javs, role: c.role, active: c.active, lean: c.lean }; });
    // camera first: ribbons face it and the HUD uses the same rig
    const W = canvas.clientWidth || 720, H = canvas.clientHeight || 1280;
    const cam = stage.camera;
    const aspect = W / H;
    if (G.scene !== 'play' && !(G.dev && G.dev.cam)) {
      heroCam(s, R, aspect, dt);
    } else {
      const rig = rigFor(aspect, G.cam || { z: 0, span: 20 });
      cam.position.set(rig.pos[0], rig.pos[1], rig.pos[2]); cam.up.set(0, 1, 0); cam.lookAt(rig.look[0], rig.look[1], rig.look[2]);
      if (Math.abs(cam.fov - rig.fov) > 1e-3 || Math.abs(cam.aspect - aspect) > 1e-4) { cam.fov = rig.fov; cam.aspect = aspect; cam.updateProjectionMatrix(); }
      P.rig = rig;
    }
    cam.updateMatrixWorld(true); camQ.copy(cam.quaternion); camPos.copy(cam.position);
    // events
    for (const e of s.events) {
      if (e.id <= seen) continue;
      seen = e.id;
      P.events.push(e); if (P.events.length > 60) P.events.shift();
      if (e.type === 'throw') actors[e.rider].onThrow(e, Tr);
      else if (e.type === 'lean') actors[e.rider].onLean(R[e.rider], Tr);
      else if (e.type === 'hit') { actors[e.tgt].struck = 0.45; spawnHit(e); cheer(e, 1); }
      else if (e.type === 'dodge') { const a = actors[e.rider]; if (a) a.onShy(Math.sign(e.x - R[e.rider].x) || 1); cheer(e, 0.6); }
      else if (e.type === 'ground') { spawnDust(e.x, e.z, 0.5); for (let k = 0; k < 4; k++) spawnClod(-e.x, 0.1, e.z, (Math.random() - 0.5) * 2, 1.5 + Math.random(), (Math.random() - 0.5) * 2, 0.05); }
    }
    // actors
    const ch = s.chaser, ru = s.runner;
    for (let i = 0; i < 6; i++) {
      const a = actors[i], r = R[i];
      let lk = null;
      if (r.active) { const oi = i === ch ? ru : i === ru ? ch : -1; if (oi >= 0) { const o = R[oi]; lookAt.set(-o.x, 2.4, o.z); lk = lookAt; } }
      a.hoofCb = (fe) => { if (r.v > 4.2 && quality !== 'low') hoofFx(a, fe, r); };
      a.update(r, Tr, dt, i, lk, camPos);
      blobs.set(i, a.horse.root.position.x, a.horse.root.position.z, a.heading, 1.35 * FIG, 0.62 * FIG);
    }
    // javelins
    const cj = curSnap.j, pj = new Map(prevSnap.j.map((j) => [j.id, j]));
    for (const j of cj) {
      const p = pj.get(j.id) || j;
      const x = lerp(p.x, j.x, alpha), y = lerp(p.y, j.y, alpha), z = lerp(p.z, j.z, alpha);
      let jm = javMeshes.find((q) => q.id === j.id);
      if (!jm) { jm = javMeshes.find((q) => q.id < 0 && q.team === j.team) || javMeshes.find((q) => q.id < 0); if (!jm) continue; jm.id = j.id; jm.age = 0; jm.roll = 0; jm.down = 0; jm.skip = 0; }
      jm.m.visible = true; jm.age += dt;
      jm.m.position.set(-x, y, z);
      if (j.state === 'fly' || j.state === 'drop') { jav3.set(-j.vx, j.vy, j.vz); if (jav3.lengthSq() > 0.01) { jav3.normalize(); jm.dir.copy(jav3); } }
      const d = jm.dir;
      jm.roll += dt * (j.state === 'fly' ? 14 : 4);
      if (j.state === 'down') {
        jm.down += dt;
        // a blunt stick skips once on landing, rolls a little and lies still
        const sk = Math.max(0, Math.sin(Math.min(1, jm.down / 0.22) * Math.PI)) * 0.22 * Math.exp(-jm.down * 3);
        dn.set(d.x, -0.12, d.z).normalize(); qj.setFromUnitVectors(up, dn); jm.m.position.y = 0.05 + sk;
        jm.m.userData.flex(0.25 * Math.exp(-jm.down * 4) * Math.sin(jm.down * 30));
      } else {
        // in flight: the stick spins about its axis and wobbles about its path, flexing as it settles after the throw
        qj.setFromUnitVectors(up, d);
        const wob = 0.045 * Math.exp(-jm.age * 1.2) * Math.sin(jm.age * 22);
        qr.setFromAxisAngle(new THREE.Vector3(1, 0, 0), wob); qj.multiply(qr);
        jm.m.userData.flex(0.18 * Math.exp(-jm.age * 5) * Math.sin(jm.age * 38));
      }
      qr.setFromAxisAngle(up, jm.roll); qj.multiply(qr);
      jm.m.quaternion.copy(qj);
    }
    for (const jm of javMeshes) if (jm.id >= 0 && !cj.some((c) => c.id === jm.id)) { jm.id = -1; jm.m.visible = false; }
    puffs.update(dt, camQ);
    updateClods(dt);
    if (fld.scenery) fld.scenery.update(dt, stage.camera);
    if (crowd) crowd.update(dt);
    if (!P.noRender) { stage.render(); P.drawCalls = stage.renderer.info.render.calls; P.tris = stage.renderer.info.render.triangles; }
  }

  // menus: a slow cinematic orbit around the leading rider, placed so the hero sits in the part of the screen the menu leaves free
  const heroP = new THREE.Vector3(), heroL = new THREE.Vector3(), fwd = new THREE.Vector3(), rgt = new THREE.Vector3(), hs = { x: 0, z: 0, init: false };
  function heroCam(s, R, aspect, dt) {
    const cam = stage.camera, r = R[s.chaser];
    const hx = -r.x, hz = r.z, hh = -r.h;
    if (!hs.init) { hs.x = hx; hs.z = hz; hs.init = true; }
    const k = Math.min(1, dt * 6); hs.x += (hx - hs.x) * k; hs.z += (hz - hs.z) * k;
    const t = tAbs;
    const port = aspect < 1.05;
    const phi = 0.42 + 0.3 * Math.sin(t * 0.22);            // orbit angle from side-on toward the front: the camera drifts slowly
    const D = port ? 16 : 11.5, fov = port ? 50 : 38;
    fwd.set(Math.sin(hh), 0, Math.cos(hh)); rgt.set(Math.cos(hh), 0, -Math.sin(hh));
    heroP.set(hs.x, 0, hs.z).addScaledVector(rgt, -Math.cos(phi) * D).addScaledVector(fwd, Math.sin(phi) * D);
    heroP.y = 1.8 + 0.35 * Math.sin(t * 0.17);
    heroL.set(hs.x, 2.0, hs.z).addScaledVector(fwd, 0.4);
    cam.position.copy(heroP); cam.up.set(0, 1, 0); cam.lookAt(heroL);
    cam.fov = fov; cam.aspect = aspect; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    // screen-space framing: shift the look target so the rider sits in the free part (top of a phone, lower left of a landscape screen)
    const half = Math.tan(fov * Math.PI / 360) * D * 2;
    if (port) heroL.y -= 0.3 * half;
    else { rgt.set(1, 0, 0).applyQuaternion(cam.quaternion); heroL.addScaledVector(rgt, 0.27 * half * aspect); heroL.y += 0.16 * half; }
    cam.lookAt(heroL);
  }

  function cheer(e, k) {
    if (!crowd) return;
    try { crowd.react('cheer', { origin: [-(e.x || 0), 0, e.z || 0], radius: 60, intensity: k }); } catch { /* optional */ }
  }
  function spawnHit(e) {
    if (quality === 'low') return;
    for (let i = 0; i < 9; i++) { const ang = i / 9 * 6.283; puffs.spawn(-e.x + Math.cos(ang) * 0.1, e.y, e.z + Math.sin(ang) * 0.1, Math.cos(ang) * 1.6, 0.9 + (i % 3) * 0.4, Math.sin(ang) * 1.6, 0.5, 0.22, 0.9); }
  }
  function spawnDust(x, z, k = 1) {
    if (quality === 'low') return;
    puffs.spawn(-x, 0.15, z, 0, 0.5, 0, 0.4, 0.2, 0.5 * k);
  }
  const hv = new THREE.Vector3();
  // hoof strike: a small dust puff and a couple of clods thrown back
  function hoofFx(a, fe, r) {
    const L = a.horse.legs.find((l) => (l.side + (l.front ? 'F' : 'H')) === fe.leg);
    if (!L) return;
    const b = L.bones[L.bones.length - 1]; b.getWorldPosition(hv);
    const sp = Math.min(1, r.v / 10);
    const back = a.heading;                                   // three-space heading: forward = (sin, cos)
    const bx = -Math.sin(back), bz = -Math.cos(back);
    puffs.spawn(hv.x, 0.08, hv.z, bx * 0.8, 0.5, bz * 0.8, 0.5, 0.18, 0.55 + sp * 0.4);
    const n = fe.front ? 1 : 2;
    for (let k = 0; k < n; k++) spawnClod(hv.x, 0.06, hv.z, bx * (2.5 + 3 * sp) + (Math.random() - 0.5), 1.6 + Math.random() * 1.6 * sp, bz * (2.5 + 3 * sp) + (Math.random() - 0.5), 0.035 + Math.random() * 0.03);
  }

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      view.cssW = kitCanvas.clientWidth || 720; view.cssH = kitCanvas.clientHeight || 1280;
      r(ctx, view);
      frame(game);
    };
    return game;
  };
  P.setClock = (f) => { P.clock = f; };
  return P;
}

// The director: builds the 3D set and cast, then each frame reads the sim state (round r) and poses everybody, places the gilli and its trail,
// the blob shadows, and moves the camera. Reads only; never writes to the sim.
import { THREE } from '../vendor3d/index.js';
import { FIELDS, AIM_MAX, DEG, clamp, lerp, GILLI_Y0, SW, TEAMS, FIELDER_PANTS, STRIKER_Z } from '../src/core.js';
import { gilliNow, gilliAt, idealPress, idealTime, airTime, penPos, strikeHeight } from '../src/engine.js';
import { cameraFor, titleCam } from '../src/cam.js';
import { World, toWorld, V3 } from './world.js';
import { makeActor, equipDanda, dress, lookOf, show } from './cast.js';
import { buildGilli } from './props3.js';
import { strikerPose, mirrorCtx, P0 } from './striker.js';
import { fielderPose } from './fielder.js';

const GILLI_SCALE = 2.2;      // the gilli is drawn bigger than life so it can be seen down the whole field on a phone
const SLOTS = [
  { female: false, skin: 'tan', hair: 'black' }, { female: true, skin: 'brown', hair: 'black' }, { female: false, skin: 'light', hair: 'brown' },
  { female: true, skin: 'tan', hair: 'black' }, { female: false, skin: 'deep', hair: 'black' },
];
const FIELD_TOPS = ['#2f78c8', '#4aa264', '#d4503f', '#8a5ab5', '#e0a040'];
const sw3 = (x, y, z, out) => toWorld(x, y, z, out);

export function createDirector(P) {
  const { stage } = P;
  const worlds = new Map();
  let cur = null, strikerM = null, strikerF = null, fielders = [], gilli = null, trail = [], glow = null, loadingF = false;
  const tmp = new V3();
  let lastT = 0, aimSm = 0, aimSwSm = 0;
  const fstate = [];
  let lastFieldKey = '';

  async function init() {
    const look = lookOf({ top: TEAMS[0].top, trim: TEAMS[0].trim, cap: TEAMS[0].cap, pants: TEAMS[0].pants, skin: 'tan', hair: 'black' });
    const mk = (i) => makeActor(stage, 'fielder', lookOf({ top: FIELD_TOPS[i], trim: '#222', pants: FIELDER_PANTS[i], cap: '#efe8d6', ...SLOTS[i] }), P.quality);
    const [s, ...fs] = await Promise.all([makeActor(stage, 'striker', look, P.quality), ...SLOTS.map((_, i) => mk(i))]);
    strikerM = s; fielders = fs;
    equipDanda(strikerM);
    gilli = buildGilli(GILLI_SCALE); gilli.visible = false; stage.scene.add(gilli);
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,240,200,0.6)'); gr.addColorStop(1, 'rgba(255,230,170,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const gt = new THREE.CanvasTexture(c); gt.colorSpace = THREE.SRGBColorSpace;
    for (let i = 0; i < 14; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; stage.scene.add(sp); trail.push(sp); }
    glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.7 })); glow.visible = false; stage.scene.add(glow);
    for (let i = 0; i < fielders.length; i++) fstate.push({ x: 0, z: 0, ph: 0, init: false });
  }

  function ensureWorld(key) {
    let w = worlds.get(key);
    if (!w) { w = new World(stage, key); w.group.visible = false; worlds.set(key, w); }
    if (cur !== w) {
      if (cur) cur.group.visible = false;
      cur = w; w.group.visible = true;
      const F = FIELDS[key];
      stage.setLighting(F.light);
      const fogCol = key === 'lamp' ? 0x2a2b52 : key === 'harvest' ? 0xdfeaf2 : 0xf0c890;
      stage.scene.fog = new THREE.Fog(new THREE.Color(fogCol), 90, 330);
      stage.scene.background = new THREE.Color(F.sky[0]);
      stage._shadowOffset.set(key === 'lamp' ? 4 : -5, 9, key === 'lamp' ? -3 : 5);
    }
    return w;
  }

  async function ensureFemaleStriker() {
    if (strikerF || loadingF) return;
    loadingF = true;
    try { strikerF = await makeActor(stage, 'striker', lookOf({ top: TEAMS[0].top, trim: TEAMS[0].trim, pants: TEAMS[0].pants, female: true, skin: 'brown', hair: 'black' }), P.quality); equipDanda(strikerF); } catch (e) { console.warn('female striker unavailable', e); }
  }

  // ---- striker ---------------------------------------------------------------------------------------------------------------------------
  function driveStriker(r, idleT, dtv, menu) {
    const st = r.striker;
    if (st.female && !strikerF) ensureFemaleStriker();
    const a = st.female && strikerF ? strikerF : strikerM;
    if (a !== strikerM && strikerM.h.root.visible) show(strikerM, false);
    if (a !== strikerF && strikerF && strikerF.h.root.visible) show(strikerF, false);
    dress(a, lookOf(st));
    show(a, true);
    const sw = r.sw, gl = gilliNow(r);
    const gW = gl ? sw3(gl.x, gl.y, gl.z, new V3()) : sw3(0.07, 0.05, 0, new V3());
    let aimSw = aimSm;
    if (sw) { aimSw = ((r.fly ? r.fly.par.azDeg : sw.az * AIM_MAX) ) * DEG; aimSwSm = aimSw; }
    const fpPhases = ['flip', 'swing', 'fly', 'result'];
    const hasFlip = r.flip && fpPhases.includes(r.phase);
    const fp = hasFlip ? r.fp : -1;
    const tau = sw ? (r.fp - sw.tc) + (r.phase === 'result' ? r.pt : 0) : -9;
    // where the sweet spot of the danda must be at contact; a miss passes above or below the gilli
    let N = sw3(0.2, strikeHeight(r.flip ?? { vy: 5.5 }), 0.1, new V3());
    if (sw && sw.pos) {
      const dy = sw.kind === 'whiff' ? clamp(sw.dy, -0.5, 0.5) * 0.9 + Math.sign(sw.dy || 1) * 0.12 : sw.kind === 'tip' ? clamp(sw.dy, -0.5, 0.5) * 0.35 : 0;
      N = sw3(sw.pos[0], sw.pos[1] - dy, sw.pos[2], new V3());
    } else if (r.flip && sw) N = sw3(0.2, 0.86, 0.1, new V3());
    let lookAfter = null;
    if (r.phase === 'fly' || r.phase === 'result') { const g2 = gilliNow(r); if (g2) lookAfter = sw3(g2.x, g2.y, g2.z, new V3()); }
    const ctx = {
      phase: r.phase, pend: penPos(r), pt: r.pt, fp, tap: r.tap, sw, tau, aim: aimSm, aimSw, gilli: gW, N, lookAfter, idleT, dandaProp: a.danda,
      loft: r.fly ? r.fly.par.loft : 31,
    };
    if (menu) Object.assign(ctx, menu);
    const left = !!st.left;
    const out = strikerPose(left ? mirrorCtx(ctx) : ctx, a.rig, {});
    if (a.mir) { a.mir.scale.x = 1; a.mir.updateMatrixWorld(true); }
    a.rig.setBase([{ clip: 'ready_stance', time: idleT % 2.7, w: 1 }]);
    a.rig.solve(out.spec);
    a.rig.limitWrists();
    if (a.mir && left) a.mir.scale.x = -1;
    (a.mir || a.h.root).updateMatrixWorld(true);
    a.last = out;
    return a;
  }

  // ---- fielders --------------------------------------------------------------------------------------------------------------------------
  function sideLooks(state, r) {
    // the fielding side: a rival village when you bat, your own village when they do
    const m = state.match;
    const teamDef = m && r.bot ? TEAMS[0] : m ? TEAMS.find((t) => t.key === m.teams[1].key) ?? TEAMS[1] : null;
    return teamDef;
  }
  function driveFielders(state, r, dtv, idleT, world) {
    const teamDef = sideLooks(state, r);
    const gl = gilliNow(r);
    const lookAt = gl ? sw3(gl.x, Math.max(0.3, gl.y), gl.z, new V3()) : sw3(0, 0.3, 0, new V3());
    const f = r.fly;
    fielders.forEach((a, i) => {
      const fd = r.fielders[i];
      if (!fd) { show(a, false); return; }
      const slot = SLOTS[i];
      const look = lookOf({ top: teamDef ? teamDef.top : FIELD_TOPS[i], trim: teamDef ? teamDef.trim : '#222', pants: teamDef ? teamDef.pants : FIELDER_PANTS[i], cap: teamDef ? teamDef.cap : '#efe8d6', ...slot });
      dress(a, look);
      show(a, true);
      const fs = fstate[i];
      const w = sw3(fd.x, 0, fd.z, new V3());
      if (!fs.init) { fs.x = fd.x; fs.z = fd.z; fs.init = true; }
      const moved = Math.hypot(fd.x - fs.x, fd.z - fs.z);
      if (moved > 3) fs.ph = 0; else fs.ph += moved;
      fs.x = fd.x; fs.z = fd.z;
      const mv = dtv > 1e-4 ? fd.moving : 0;
      // facing: along the run, else toward the action
      const simYaw = mv > 0.2 ? fd.yaw : Math.atan2(-fd.x, -fd.z);
      fs.yaw = fs.yaw == null ? simYaw : fs.yaw + Math.atan2(Math.sin(simYaw - fs.yaw), Math.cos(simYaw - fs.yaw)) * clamp(dtv * 9, 0, 1);
      const yawW = Math.PI - fs.yaw;
      let reach = null, celebrate = -1;
      if (f && f.caught && f.caught.i === i && (r.phase === 'fly' || r.phase === 'result')) {
        const tcatch = f.caught.t, now = r.phase === 'fly' ? r.ft : f.tEnd + r.pt;
        const k = clamp((now - (tcatch - 0.35)) / 0.3, 0, 1);
        reach = { pos: sw3(f.caught.x, f.caught.y, f.caught.z, new V3()), w: k, held: now >= tcatch };
        if (now >= tcatch + 0.55) { celebrate = now - tcatch - 0.55; reach = null; }
      } else if (f && f.drop && f.drop.i === i && (r.phase === 'fly' || r.phase === 'result')) {
        const tcatch = f.drop.t, now = r.phase === 'fly' ? r.ft : f.tEnd + r.pt;
        const k = clamp((now - (tcatch - 0.35)) / 0.3, 0, 1) * (1 - clamp((now - tcatch - 0.1) / 0.35, 0, 1));
        reach = { pos: sw3(f.drop.x, f.drop.y, f.drop.z, new V3()), w: k, held: false };
      }
      const pose = fielderPose({ x: w.x, z: w.z, yaw: yawW, moving: mv, runPhase: fs.ph, idleT, id: i, look: lookAt, reach, celebrate }, a.rig, {});
      a.rig.solve(pose.spec);
      a.h.root.updateMatrixWorld(true);
      a.h.autoLOD(P.cam, P.cssH, stage.lodPolicy);
      if (world) world.setBlob(i, w.x + 0.15, w.z - 0.1, 0.8, 0.85);
    });
  }

  // ---- the gilli ----------------------------------------------------------------------------------------------------------------------------
  function placeGilli(r, t, world, striker) {
    const gl = gilliNow(r);
    let pos = null, spin = 0, up = false;
    if (gl) { pos = sw3(gl.x, Math.max(0.02, gl.y), gl.z, new V3()); spin = gl.spin; up = gl.air; if (gl.held != null) { pos = sw3(gl.x, Math.max(0.02, gl.y), gl.z, new V3()); } }
    else pos = sw3(0, 0.03, 0, new V3());
    if (r.phase === 'result' && r.res && r.res.kind === 'tapmiss') pos = sw3(0, 0.03, 0, new V3());
    if (!pos) { gilli.visible = false; glow.visible = false; trail.forEach((s) => { s.visible = false; }); return null; }
    gilli.visible = true; gilli.position.copy(pos);
    gilli.rotation.set(0, 0, 0);
    gilli.rotation.z = spin * 0.9; gilli.rotation.y = spin * 0.45;
    if (!up && !gl) { gilli.rotation.set(0, 0, 0); gilli.position.y = 0.02 + 0.02; }
    const dist = Math.hypot(pos.x - P.cam.position.x, pos.y - P.cam.position.y, pos.z - P.cam.position.z);
    const live = r.phase === 'fly' || r.phase === 'flip' || r.phase === 'swing';
    const s = live ? clamp(dist / 5, 1.25, 9) : 1.25;
    gilli.scale.setScalar(s);
    glow.visible = live && pos.y > 0.15; glow.position.copy(pos); glow.scale.setScalar(Math.max(0.5, 0.085 * dist)); glow.material.opacity = 0.5;
    if (r.phase === 'fly') {
      trail.unshift(trail.pop()); const s0 = trail[0]; s0.visible = true; s0.position.copy(pos); s0.material.opacity = 0.5; s0.scale.setScalar(Math.max(0.25, dist * 0.022));
      for (let i = 1; i < trail.length; i++) { const q = trail[i]; if (!q.visible) continue; q.material.opacity = Math.max(0, q.material.opacity - 0.05); q.scale.multiplyScalar(0.95); if (q.material.opacity <= 0.02) q.visible = false; }
    } else trail.forEach((q) => { q.visible = false; });
    if (world) world.setBlob(6, pos.x, pos.z, 0.14 + 0.1 * s, clamp(1 - pos.y / 12, 0.2, 0.8));
    void t; void striker;
    return pos;
  }

  function setCamera(c) {
    const cam = P.cam;
    toWorld(c.pos[0], c.pos[1], c.pos[2], tmp); cam.position.copy(tmp);
    toWorld(c.look[0], c.look[1], c.look[2], tmp); cam.lookAt(tmp);
    cam.fov = c.fov; cam.aspect = P.cssW / Math.max(1, P.cssH); cam.near = 0.15; cam.far = 1200;
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  }

  // the menus: the striker keeps tapping, flips the gilli and strikes it, over and over
  function menuScript(t, r) {
    const cyc = 6.4, u = t % cyc, tapEnd = 2.7;
    const vy = 5.2;
    const fl = { vy, dx: 0.02, dz: 0.2, spin: 9 };
    const tIdeal = idealTime(fl), ts = tIdeal - SW, tc = ts + SW, air = airTime(fl);
    const out = { fp: -1, tau: -9, sw: null, tap: null, phase: 'tap', pend: Math.cos(u * 2.6) };
    if (u >= tapEnd) {
      const fp = u - tapEnd;
      out.phase = fp < air ? 'flip' : 'result'; out.fp = Math.min(fp, 4);
      out.tap = { pend: 0.02, kind: 'perfect' };
      const g = gilliAt(fl, tc);
      const sw = { ts, tc, q: 1, kind: 'perfect', dy: 0, dt: 0, pos: [g.x, g.y, g.z] };
      if (fp >= ts) { out.sw = sw; out.phase = fp < tc ? 'swing' : 'fly'; out.tau = fp - tc; out.N = sw3(g.x, g.y, g.z, new V3()); }
      out.fl = fl;
      const gp = fp < tc ? gilliAt(fl, fp) : null;
      out.gilliPos = gp ? sw3(gp.x, gp.y, gp.z, new V3()) : null;
      if (fp >= tc) { const tt = fp - tc, k = tt; out.gilliPos = sw3(g.x + 0.2 * k * 8, g.y + 6 * k - 4 * k * k * 3, g.z + 9 * k, new V3()); out.lookAfter = out.gilliPos; }
      out.spin = fp * 9;
    }
    out.menu = true; void r;
    return out;
  }

  function frame(state, mode) {
    const idleT = state.t;
    const dtv = clamp(idleT - lastT, 0, 0.1); lastT = idleT;
    const live = (state.scene === 'play' || state.scene === 'auto') && state.r;
    const key = live ? state.r.field : state.setup && state.scene === 'setup' ? state.setup.field : state.match && state.scene === 'lineup' ? state.match.field : state.prefs.field;
    const world = ensureWorld(key);
    const aspect = P.cssW / Math.max(1, P.cssH);
    let camPose;
    if (live) { const azT = state.r.az * AIM_MAX * DEG; aimSm += (azT - aimSm) * clamp(dtv * 6, 0, 1); camPose = cameraFor(state.r, aspect, aimSm); }
    else { aimSm = 0; camPose = titleCam(idleT, aspect); }
    P.info.cam = camPose;
    setCamera(camPose);
    if (live) {
      const r = state.r;
      const a = driveStriker(r, idleT, dtv, null);
      driveFielders(state, r, dtv, idleT, world);
      const gp = placeGilli(r, idleT, world, a);
      world.setBlob(5, (a.mir ? a.mir.scale.x : 1) * a.h.root.position.x + 0.1, a.h.root.position.z, 0.9, 0.8);
      void gp;
    } else {
      // menus: a stand-in round for the striker; no fielders
      fielders.forEach((f) => show(f, false));
      const ms = menuScript(idleT);
      const fake = { phase: ms.phase, pt: idleT, fp: ms.fp, tap: ms.tap, sw: ms.sw, flip: ms.fl ?? null, az: 0, fly: null, striker: { ...TEAMS[0], name: 'You', skin: 'tan', hair: 'black', female: false }, res: null };
      fake.fly = null;
      const s0 = driveStrikerMenu(fake, ms, idleT, dtv);
      if (ms.gilliPos) { gilli.visible = true; gilli.position.copy(ms.gilliPos); gilli.rotation.z = ms.spin; gilli.scale.setScalar(Math.max(1, Math.hypot(ms.gilliPos.x - P.cam.position.x, ms.gilliPos.y - P.cam.position.y, ms.gilliPos.z - P.cam.position.z) / 9)); }
      else { gilli.visible = true; gilli.position.set(0, 0.05, 0); gilli.rotation.set(0, 0, 0); gilli.scale.setScalar(1.25); }
      glow.visible = false; trail.forEach((q) => { q.visible = false; });
      world.setBlob(5, (s0.mir ? s0.mir.scale.x : 1) * s0.h.root.position.x + 0.1, s0.h.root.position.z, 0.9, 0.8);
      for (let i = 0; i < 5; i++) if (i !== 5) world.setBlob(i, 0, 0, 0, 0);
      world.setBlob(6, 0, 0, 0, 0);
    }
    world.update(idleT, P.cam.position);
    stage.setShadowTarget(P0.x, 0, P0.z);
    for (const a of [strikerM, strikerF]) if (a && a.h.root.visible) a.h.autoLOD(P.cam, P.cssH, stage.lodPolicy);
    stage.render();
    void mode; void lastFieldKey; void GILLI_Y0; void idealPress; void lerp; void STRIKER_Z;
  }

  function driveStrikerMenu(fake, ms, idleT, dtv) {
    const a = strikerM;
    dress(a, lookOf(fake.striker)); show(a, true);
    const gW = ms.gilliPos ?? sw3(0.07, 0.05, 0, new V3());
    const ctx = {
      phase: ms.phase, pend: ms.pend, pt: idleT, fp: ms.fp, tap: ms.tap, sw: ms.sw, tau: ms.tau, aim: 0, aimSw: 0, gilli: gW,
      N: ms.N ?? sw3(0.2, 0.86, 0.1, new V3()), lookAfter: ms.lookAfter ?? null, idleT, dandaProp: a.danda, loft: 31,
    };
    const left = !!fake.striker.left;
    const out = strikerPose(left ? mirrorCtx(ctx) : ctx, a.rig, {});
    if (a.mir) { a.mir.scale.x = 1; a.mir.updateMatrixWorld(true); }
    a.rig.setBase([{ clip: 'ready_stance', time: idleT % 2.7, w: 1 }]);
    a.rig.solve(out.spec);
    a.rig.limitWrists();
    if (a.mir && left) a.mir.scale.x = -1;
    (a.mir || a.h.root).updateMatrixWorld(true);
    void dtv; void penPos;
    return a;
  }

  return { init, frame, ensureWorld, resized() {}, get cur() { return cur; }, striker: () => strikerM, fielders: () => fielders, worlds };
}

// The director: builds the 3D set and cast once per theme, then each frame reads the sim state and poses everybody.
// Two pictures: the batter's-eye DELIVERY view (full screen, the game's own camera) and the ACTION CAM (a picture-in-picture over the
// 2D overhead field while the ball is live: the finish of the shot, the chase, the pick-up, the throw, the keeper).
import { THEMES, clamp } from '../src/core.js';
import { CAM } from '../src/scene.js';
import { toWorld, World, makeBackdrop, yawOfSim } from './world.js';
import { makeActor, equipBat, setActorLod } from './cast.js';
import { buildBall } from './gear.js';
import { swingOf, ballOf, bowlerAction, contactPoint, HOLD_T } from './sim.js';
import { batterPose, familyOf, PIVOT } from './batter.js';
import { bowlerPose, bowlerArms, VARIANTS } from './bowler.js';
import { liveBall, fielderDesc, keeperDesc, runnersOf, reactionOf, pipShot } from './live.js';
import { V3, quatFromBasis } from './rig.js';
import { ramp } from './util3.js';

export { HOLD_T };

export function createDirector(P) {
  const { stage, V } = P;
  const THREE = V.THREE;
  const casts = new Map();
  const loading = new Map();
  let cur = null;
  const tmp = new V3();
  const pipCam = { pos: new V3(), look: new V3(), key: '', t: 0, init: false };
  const skyColor = new THREE.Color(0xa9c3de);
  let fog = null;

  async function build(theme) {
    const world = new World(stage, theme);
    const mk = (side, role, k) => makeActor(stage, theme, side, role, k, 'athlete_m', P.quality);
    const batter = await mk('bat', 'batter', 0);       // the hero: dressed (pads, gloves, helmet), the only shadow caster
    const nonStriker = await mk('bat', 'batter', 3);
    const bowler = await mk('field', 'bowler', 1);
    const umpire = await mk('field', 'umpire', 5);
    const keeper = await mk('field', 'keeper', 4);
    const fielders = [];
    for (let i = 0; i < 8; i++) fielders.push(await mk('field', 'fielder', 2 + i));
    const ball = buildBall(THEMES[theme].ball);
    stage.scene.add(ball);
    const all = [batter, nonStriker, bowler, umpire, keeper, ...fielders];
    for (const a of all) { a.h.root.visible = false; }
    // real shadows only for the batter (set in makeActor); everybody else gets a blob shadow
    if (batter.bat) batter.bat.traverse((o) => { o.castShadow = false; });
    ball.traverse((o) => { o.castShadow = false; });
    ball.visible = false; world.group.visible = false;
    const cast = { theme, world, batter, nonStriker, bowler, umpire, keeper, fielders, all, ball, backdrop: null, backdropKey: '', hand: 0, byId: {} };
    casts.set(theme, cast);
    return cast;
  }
  function preload(theme) {
    if (casts.has(theme)) return Promise.resolve(casts.get(theme));
    if (!loading.has(theme)) loading.set(theme, build(theme).finally(() => loading.delete(theme)));
    return loading.get(theme);
  }
  function activate(theme) {
    if (cur && cur.theme !== theme) { cur.world.group.visible = false; cur.ball.visible = false; for (const a of cur.all) a.h.root.visible = false; }
    cur = casts.get(theme);
    cur.world.group.visible = true;
  }
  const show = (a, on) => { if (a.h.root.visible !== on) a.h.root.visible = on; };

  // ------------------------------------------------------------------------------------------------------------------------------
  function frame(state, mode) {
    const m = state.m;
    const c = casts.get(m.theme);
    if (!c) { preload(m.theme); return; }
    if (cur !== c) activate(m.theme);
    const hand = m.hand;
    if (c.hand !== hand) { equipBat(c.batter, hand > 0 ? 'R' : 'L'); equipBat(c.nonStriker, hand > 0 ? 'R' : 'L'); c.hand = hand; }
    const d = m.d, th = THEMES[m.theme], L = th.pitchLen;
    const v = state.v || {};
    const sw = swingOf(state);
    const ball = ballOf(state, sw);
    const act = bowlerAction(state);
    const phase = m.phase;
    const ZR = L - 0.8;
    const relS = d ? { x: d.spec.relX, y: d.spec.relY, z: ZR } : { x: 0.1, y: 2.1, z: ZR };
    const relW = toWorld(hand, relS.x, relS.y, relS.z);
    const live = !!m.live;
    let ft;
    if (phase === 'flight') ft = m.ft;
    else if (phase === 'contact') ft = (sw ? sw.T_c : m.ft) + m.pt;
    else if ((phase === 'live' || phase === 'result') && live && sw) ft = sw.T_c + 0.13 + m.live.t;
    else if (phase === 'result' || phase === 'inningsEnd') ft = m.ft + m.pt;
    else ft = -1;
    const tau = phase === 'runup' ? m.pt - (m.runT ?? 1) : ft >= 0 ? ft + 1 / 60 : null;
    const ctx = { state, m, c, hand, d, L, sw, ball, act, relW, ft, tau, live, th };
    const pos = {};
    drive_batter(c, ctx);
    drive_nonstriker(c, ctx);
    drive_bowler(c, ctx);
    drive_umpire(c, ctx);
    drive_fielders(c, ctx, mode === 'delivery', pos);
    place_ball(c, ctx);
    blobs(c);
    const broken = Math.max(v.stumpsBroken ?? 0, d && d.bowled && ft >= d.t0 && !(sw && sw.contact) && phase === 'flight' ? clamp((ft - d.t0) / 0.45, 0, 1) : 0);
    const endHit = live && m.live.th ? m.live.th.end : 0;
    c.world.setBroken(0, endHit === 1 ? 0 : broken);
    c.world.setBroken(1, endHit === 1 ? broken : 0);
    if (mode === 'delivery') renderDelivery(c, ctx); else renderPip(c, ctx, pos);
  }

  // skip people who are outside the picture (the vendored skinned meshes are never frustum-culled)
  const _p = new V3();
  function cull(c, margin = 1.3) {
    for (const a of c.all) {
      if (!a.h.root.visible) continue;
      _p.copy(a.h.root.position); _p.y += 0.9;
      _p.applyMatrix4(P.cam.matrixWorldInverse);
      if (_p.z > -0.2) { a.h.root.visible = false; continue; }
      _p.applyMatrix4(P.cam.projectionMatrix);
      if (Math.abs(_p.x) > margin || Math.abs(_p.y) > margin) a.h.root.visible = false;
    }
  }
  // level of detail from the size on screen (viewport height in css px): full / medium / light per person, gear follows
  function lodPass(c, vph) { for (const a of c.all) if (a.h.root.visible) setActorLod(a, P.cam, vph, P.quality === 'high' ? 0 : 1); }
  const setupFog = () => (fog || (fog = new THREE.Fog(0xe8c398, 45, 300)));

  function renderDelivery(c, ctx) {
    const { state, m } = ctx;
    const v = state.v || {};
    stage.renderer.setScissorTest(false);
    stage.renderer.setViewport(0, 0, P.cssW, P.cssH);
    const zoom = m.phase === 'contact' ? 1 + 0.06 * clamp(m.pt / 0.13, 0, 1) : 1;
    P.proj.zoom = zoom; P.proj.sx = v.shake ? Math.sin(state.t * 90) * v.shake : 0; P.proj.sy = v.shake ? Math.cos(state.t * 77) * v.shake * 0.7 : 0;
    if (P.debugCam) {
      const dc = typeof P.debugCam === 'function' ? P.debugCam(state, cur) : P.debugCam;
      P.cam.position.set(dc.pos[0], dc.pos[1], dc.pos[2]); P.cam.lookAt(dc.look[0], dc.look[1], dc.look[2]);
      persp(dc.fov || 30, P.cssW / P.cssH);
    } else {
      P.cam.position.set(0, CAM.y, -CAM.z); P.cam.lookAt(0, CAM.y, -200);
      P.cam.updateProjectionMatrix();
    }
    P.cam.updateMatrixWorld(true);
    P.cam.matrixWorldInverse.copy(P.cam.matrixWorld).invert();
    const key = `${m.theme}:${P.size.w}x${P.size.h}`;
    if (c.backdropKey !== key) { c.backdropKey = key; c.backdrop = makeBackdrop(globalThis.document, m.theme, P.size.w, P.size.h, Math.min(globalThis.devicePixelRatio || 1, 2)); }
    stage.scene.background = c.backdrop;
    stage.scene.fog = setupFog();
    stage._shadowOffset.set(-4.5, 7.5, 6.5);
    stage.setShadowTarget(ctx.hand * PIVOT.x, 0, -PIVOT.z);
    cull(c);
    lodPass(c, P.cssH);
    stage.render();
  }

  function persp(fovDeg, aspect) {
    const e = P.cam.projectionMatrix.elements, fov = fovDeg * Math.PI / 180, nr = 0.1, fr = 420, t = 1 / Math.tan(fov / 2);
    e.fill(0); e[0] = t / aspect; e[5] = t; e[10] = -(fr + nr) / (fr - nr); e[14] = -2 * fr * nr / (fr - nr); e[11] = -1;
    P.cam.projectionMatrixInverse.copy(P.cam.projectionMatrix).invert();
  }

  function renderPip(c, ctx, pos) {
    const { state, hand } = ctx;
    const R = P.pipRect, fit = P.fit;
    if (!R || !fit) return;
    const shot = P.pipOverride ? P.pipOverride(state, pos) : pipShot(state, hand, pos);
    const dtRaw = state.t - pipCam.t, dt = clamp(dtRaw, 0, 0.1);
    if (!pipCam.init || pipCam.key !== shot.key || dtRaw > 0.12 || dtRaw < -0.01) { pipCam.pos.copy(shot.pos); pipCam.look.copy(shot.look); pipCam.init = true; }
    else { const k = 1 - Math.exp(-dt * 7); pipCam.pos.lerp(shot.pos, k); pipCam.look.lerp(shot.look, k); }
    pipCam.key = shot.key; pipCam.t = state.t;
    const x = fit.ox + R.x * fit.s, y = fit.oy + R.y * fit.s, w = R.w * fit.s, h = R.h * fit.s;
    const r = stage.renderer;
    r.setScissorTest(true);
    r.setViewport(x, P.cssH - y - h, w, h); r.setScissor(x, P.cssH - y - h, w, h);
    P.cam.position.copy(pipCam.pos); P.cam.lookAt(pipCam.look); persp(shot.fov, w / h);
    P.cam.updateMatrixWorld(true); P.cam.matrixWorldInverse.copy(P.cam.matrixWorld).invert();
    stage.scene.background = skyColor;
    stage.scene.fog = setupFog();
    stage._shadowOffset.set(-4.5, 7.5, 6.5);
    stage.setShadowTarget(pipCam.look.x, 0, pipCam.look.z);
    cull(c);
    lodPass(c, h);
    stage.render();
    r.setScissorTest(false);
    r.setViewport(0, 0, P.cssW, P.cssH);
  }

  // ------------------------------------------------------------------------------------------------------------------------------
  function drive_batter(c, ctx) {
    const { state, m, sw, ball, ft, hand, d } = ctx;
    const a = c.batter, rig = a.rig;
    show(a, true);
    const run = ctx.live ? runnersOf(state, hand) : null;
    if (run && run[0].state !== 'rest') { driveRunner(a, run[0], ctx); return; }
    const rx = reactionOf(state);
    if (rx && rx.boundary && m.phase === 'result') { celebrateBat(a, ctx, rx.t); return; }
    const fam = familyOf(sw, d);
    const N = d ? toWorld(1, ...contactPoint(d)) : new V3(0, 1, 0);
    const resting = m.phase === 'ready' || m.phase === 'runup' || m.phase === 'aim' || m.phase === 'overbreak';
    const ballC = ball.vis ? { vis: true, p: toWorld(1, ball.p[0], ball.p[1], ball.p[2]) } : { vis: false };
    const bctx = {
      hand, ft: resting ? -1 : ft, tC: d ? d.tC : 1, tB: d ? d.bounceT : -1, lenClass: d ? d.lengthClass : 'good', sw, fam, N, ball: ballC,
      pivotZ: ctx.th.wicketBin ? -0.55 : undefined, phase: m.phase, tr: m.phase === 'result' ? m.pt : 0, idleT: state.t, batProp: a.bat, release: toWorld(1, d ? d.spec.relX : 0, d ? d.spec.relY : 2.1, ctx.L - 0.8), resting,
    };
    if (a.h._hold) a.h._hold.weight = 1;
    const out = batterPose(bctx, rig, {});
    rig.setBase([{ clip: 'ready_stance', time: state.t % 2.7, w: 1 }]);
    rig.solve(out.spec);
    a.h._twoHand();
    rig.limitWrists();
    a.h.root.updateMatrixWorld(true);
    a.last = out;
  }

  // bat held high in the bottom hand after a four or a six, the other arm up
  function celebrateBat(a, ctx, t) {
    const { hand, state } = ctx, rig = a.rig;
    const bottom = hand > 0 ? 'R' : 'L';
    const gq = a.bat.quaternion, gp = a.bat.position;
    const aDir = new V3(0.0, 1.0, -0.15).normalize(), nDir = new V3(0, 0.0, -1).normalize();
    const Q = quatFromBasis(aDir.clone().cross(nDir).normalize(), aDir, nDir);
    const Qh = Q.clone().multiply(gq.clone().invert());
    rig.setBase([{ clip: 'celebrate_2', time: (t * 0.9) % 2.5, w: 1 }]);
    const p0 = new V3(hand * -0.5, 0, -0.05);
    rig.solve({
      x: p0.x, z: p0.z, yaw: Math.PI,
      arms: (rg) => { const hp = rg.head.getWorldPosition(new V3()); const side = bottom === 'R' ? -1 : 1; const butt = hp.clone().add(new V3(side * 0.28, 0.12, 0.02)); return { [bottom]: { p: butt.sub(gp.clone().applyQuaternion(Qh)), q: Qh, pole: hp.clone().add(new V3(side * 0.6, -0.1, 0)) } }; },
      fingers: { L: 'open', R: 'batGrip' },
    });
    if (a.h._hold) a.h._hold.weight = 0;
    a.h.root.updateMatrixWorld(true);
  }

  function driveRunner(a, r, ctx) {
    const { hand, th } = ctx;
    const rig = a.rig;
    const z = r.state === 'rest' ? (r.from === 0 ? 0 : th.pitchLen) : r.z;
    const yaw = yawOfSim(hand, 0, r.heading);
    const cl = a.h.getClip('sprint');
    let clip = 'sprint', time = (((r.dist / cl.travel[1]) * cl.dur) % cl.dur + cl.dur) % cl.dur;
    if (r.state === 'dive') { clip = 'slide'; time = clamp((r.u - 0.9) / 0.1 * 0.5, 0, 0.8); }
    rig.setBase([{ clip, time, w: 1 }]);
    const bottom = hand > 0 ? 'R' : 'L';
    const gq = a.bat.quaternion;
    const fw = new V3(Math.sin(yaw), 0, Math.cos(yaw));
    const ax = fw.clone().multiplyScalar(0.55).add(new V3(0, -0.8, 0)).normalize();
    const nn = new V3(0, 1, 0).addScaledVector(ax, -ax.y).normalize();
    const Qh = quatFromBasis(ax.clone().cross(nn).normalize(), ax, nn).multiply(gq.clone().invert());
    rig.solve({ x: hand * r.x, z: -z, yaw, fingers: { L: 'relaxed', R: 'relaxed', [bottom]: 'batGrip' }, hands: { [bottom]: { q: Qh, clav: 0 } } });
    if (a.h._hold) a.h._hold.weight = 0;
    a.h.root.updateMatrixWorld(true);
  }

  function drive_nonstriker(c, ctx) {
    const { state, hand, th, live } = ctx;
    const a = c.nonStriker;
    const run = live ? runnersOf(state, hand) : null;
    show(a, ctx.live);
    if (!ctx.live) return;   // not visible from the batter's-eye camera
    if (run && run[1].state !== 'rest') { driveRunner(a, run[1], ctx); return; }
    const end = run ? run[1].from : 1;
    const z = end === 0 ? -0.5 : th.pitchLen + 0.5;
    a.rig.setBase([{ clip: 'ready_stance', time: (state.t + 1.1) % 2.7, w: 1 }]);
    a.rig.solve({ x: hand * (-1.35), z: -z, yaw: end === 0 ? Math.PI : 0, fingers: { L: 'relaxed', R: 'relaxed' } });
    a.h.root.updateMatrixWorld(true);
  }

  function drive_bowler(c, ctx) {
    const { state, m, d, L, relW, act, tau } = ctx;
    const a = c.bowler, rig = a.rig, h = a.h;
    show(a, true);
    if (ctx.live) {
      const f = m.field.find((q) => q.role === 'bowler');
      h.root.scale.setScalar(1);
      fielderPlace(a, f, ctx);
      return;
    }
    const bowlerIdx = Math.floor(m.inn.balls / 6) % Math.max(1, m.inn.bowlers.length);
    const V0 = P.bowlerVariant ? VARIANTS[P.bowlerVariant] : act.spin ? VARIANTS.spin : (bowlerIdx % 2 ? VARIANTS.frontOn : VARIANTS.sideOn);
    h.root.scale.setScalar(V0.scale);
    const bctx = { tau: tau ?? -9, variant: V0, rel: relW, L, runT: m.runT ?? 1, scale: V0.scale };
    const bp = bowlerPose(bctx, rig, {});
    const T = bp.timing, spec = bp.spec;
    a.last = { bp, tau };
    const standing = tau === null || m.phase === 'ready' || m.phase === 'aim' || m.phase === 'overbreak';
    const t = bctx.tau;
    const wicket = m.phase === 'result' && m.last && m.last.out;
    if (wicket && m.pt > 0.15) {
      rig.setBase([{ clip: 'celebrate', time: clamp(m.pt - 0.15, 0, 3.5), w: 1 }]);
      rig.solve({ x: relW.x + 0.2 * V0.scale + 1.7, z: -(L - 3.6), yaw: 0 });
      h.root.updateMatrixWorld(true); a.bowlerBall = false; return;
    }
    if (standing) {
      rig.setBase([{ clip: 'idle', time: state.t % 2.7, w: 1 }]);
      rig.solve({ x: relW.x + 0.2 * V0.scale, z: -T.zMark, yaw: 0 });
      a.bowlerBall = true;
    } else if (t < T.Tj - 0.1) {
      const clip = h.getClip(V0.run);
      const dist = T.runDist(t - T.tauStart);
      const phaseTime = (((dist - T.DJ) / clip.travel[1]) * clip.dur + (V0.run === 'sprint' ? 0.2 : 0.7)) % clip.dur;
      rig.setBase([{ clip: V0.run, time: (phaseTime + clip.dur) % clip.dur, w: 1 }]);
      rig.solve({ x: relW.x + 0.2 * V0.scale, z: -(T.zMark - dist), yaw: 0 });
      a.bowlerBall = true;
    } else {
      const wb = ramp(t, T.Tj - 0.10, T.Tj);
      spec.pelvis.w = wb; spec.feet.L.w = wb; spec.feet.R.w = wb;
      spec.arms = (rg, sp) => bowlerArms(bctx, rg, { ...bp, spec: sp }).spec.hands;
      spec.head = { target: new V3(0, 1.3, 2), weight: 1, maxYaw: 1.5 };
      rig.setBase([{ clip: V0.run, time: 0.2, w: 1 - wb }, { clip: 'idle', time: 0.5, w: wb }].filter((x) => x.w > 0));
      rig.solve(spec);
      a.bowlerBall = t < -1 / 60;
    }
    h.root.updateMatrixWorld(true);
  }

  function drive_umpire(c, ctx) {
    const a = c.umpire, rig = a.rig;
    show(a, true);
    rig.setBase([{ clip: 'idle_relaxed', time: ctx.state.t % 3.0, w: 1 }]);
    rig.solve({ x: 1.6, z: -(ctx.L + 1.5), yaw: -0.1 });
    a.h.root.updateMatrixWorld(true);
  }

  function fielderPlace(a, f, ctx) {
    const { state, hand } = ctx;
    const d = f.role === 'wk' ? keeperDesc(state, f, hand) : fielderDesc(state, f, hand);
    const h = a.h, rig = a.rig;
    for (const k of Object.keys(a.targets || {})) if (!d.targets[k]) h.setTarget(k, null);
    a.targets = d.targets;
    for (const k of Object.keys(d.targets)) h.setTarget(k, d.targets[k]);
    h.setReach('R', null); h.setReach('L', null);
    for (const r of d.reach) h.setReach(r.side, r.p, { weight: r.w });
    rig.setBase([{ clip: d.clip, time: d.time, w: 1 }]);
    rig.noLower = false;
    rig.solve({ x: d.x, z: d.z, yaw: d.yaw });
    rig.noLower = true;
    h.root.updateMatrixWorld(true);
    a.fid = f.id;
  }

  function drive_fielders(c, ctx, deliveryCam, pos) {
    const { m } = ctx;
    const list = (m.field || []).filter((f) => f.role === 'field');
    const wk = (m.field || []).find((f) => f.role === 'wk');
    const seen = deliveryCam ? list.filter((f) => f.z > 2.5 && Math.abs(f.x) < 0.5 * f.z + 6).sort((a, b) => a.z - b.z).slice(0, 4).sort((a, b) => b.z - a.z) : list;
    pos.fielders = {};
    c.byId = {};
    c.fielders.forEach((a, i) => {
      const f = seen[i];
      if (!f) { show(a, false); return; }
      show(a, true);
      fielderPlace(a, f, ctx);
      pos.fielders[f.id] = a.h.root.position.clone(); c.byId[f.id] = a;
    });
    if (wk && !deliveryCam) { show(c.keeper, true); fielderPlace(c.keeper, wk, ctx); pos.fielders[wk.id] = c.keeper.h.root.position.clone(); c.byId[wk.id] = c.keeper; }
    else show(c.keeper, false);
    const bw = (m.field || []).find((f) => f.role === 'bowler');
    if (bw && ctx.live) { pos.fielders[bw.id] = c.bowler.h.root.position.clone(); c.byId[bw.id] = c.bowler; }
    pos.batter = c.batter.h.root.position.clone();
    pos.striker = pos.batter;
  }

  function place_ball(c, ctx) {
    const { state, m, ball, hand, live } = ctx;
    const b = c.ball;
    const inHand = (a) => {
      const hb = a.h.bones.Bip01_R_Hand, fr = a.h.fingers.R;
      const local = fr.knuckle.clone().multiplyScalar(0.45).addScaledVector(fr.palmDir, 0.038);
      b.position.copy(local.applyMatrix4(hb.matrixWorld)); b.visible = true;
    };
    if (live) {
      const lb = liveBall(m);
      if (lb && lb.kind === 'air') { toWorld(hand, lb.p[0], lb.p[1], lb.p[2], tmp); b.position.copy(tmp); b.visible = true; b.rotation.set(state.t * 20, 0, state.t * 12); return; }
      if (lb && lb.kind === 'hand' && c.byId[lb.holder]) { inHand(c.byId[lb.holder]); return; }
      b.visible = false; return;
    }
    if (ball.vis) {
      toWorld(hand, ball.p[0], ball.p[1], ball.p[2], tmp);
      b.position.copy(tmp); b.rotation.set(ball.spin * 0.4, ball.spin * 0.2, ball.spin); b.visible = true;
    } else if (c.bowler.bowlerBall && (m.phase === 'ready' || m.phase === 'runup' || m.phase === 'aim')) inHand(c.bowler);
    else b.visible = false;
  }

  function blobs(c) {
    const l = [];
    for (const a of c.all) if (a.h.root.visible && a !== c.batter) l.push([a.h.root.position.x, a.h.root.position.z, a === c.bowler ? 0.7 : 0.62]);
    if (c.ball.visible) l.push([c.ball.position.x, c.ball.position.z, 0.1 + Math.min(0.1, c.ball.position.y * 0.04)]);
    c.world.setBlobs(l);
  }

  function resized() { for (const c of casts.values()) c.backdropKey = ''; }
  return { preload, frame, resized, has: (t) => casts.has(t), casts, get cur() { return cur; } };
}

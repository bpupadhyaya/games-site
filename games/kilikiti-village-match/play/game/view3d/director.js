// The director: builds the 3D set and the cast once, then each frame READS the sim state (never writes it) and poses everybody.
// Two FIXED cameras (camera.js): the batter's-eye view and the high field view; the picture cuts between them, nothing ever pans or zooms.
import { PITCH, END_Z, FIELD, BALL_R, DT, clamp, lerp } from '../src/core.js';
import { CAMS, VIEW, project } from '../src/camera.js';
import { viewOf, T_RUN, runU, HOLD_VIEW, GATHER_T } from '../src/sim.js';
import { deliveryPos, trackPos, throwPos, REL_Z, REL_Y, SWING_LEAD, resolveSwing } from '../src/ball.js';
import { World, fitCamera, makeBackdrop, V3 } from './world.js';
import { makeActor, dress, equipBat, setSkinOf } from './cast.js';
import { buildBall } from './props.js';
import { batterPose, familyOf, PIVOT, BAT } from './batter.js';
import { bowlerPose, bowlerArms, VARIANTS } from './bowler.js';
import { quatFromBasis } from './rig.js';
import { ramp } from './util3.js';
import { diveSpec, DIVE } from './dive.js';

const toWorld = (x, y, z, out = new V3()) => out.set(x, y, -z);
const yawOfDir = (dx, dz) => Math.atan2(dx, -dz);        // sim direction (dx, dz) -> world avatar yaw (yaw 0 faces +Z world)
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const hash = (n) => { let h = (n | 0) * 374761393 + 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const STUB = { next: () => 0.5, range: (lo, hi) => (lo + hi) / 2, chance: (p) => p >= 0.5, pick: (x) => x[0], int: () => 0 };

export async function createDirector(P) {
  const { stage, V } = P;
  const THREE = V.THREE;
  const world = new World(stage);
  const batters = [await makeActor(stage, 0, 0), await makeActor(stage, 1, 0), await makeActor(stage, 11, 0)];
  for (const b of batters) equipBat(b);
  const field = [];
  for (let i = 0; i < 9; i++) field.push(await makeActor(stage, i + 2, 1));
  const ball = buildBall(1.0);
  stage.scene.add(ball); ball.visible = false;
  world.group.visible = false;
  const all = [...batters, ...field];
  const skyCol = new THREE.Color(0xa8d4f0);
  const fog = new THREE.Fog(0xcfe6d6, 60, 420);
  const fogField = new THREE.Fog(0xb7dcc0, 140, 520);
  let backdrop = null, backdropKey = '';
  const aOf = new Map();           // batter index -> actor
  const walkers = [];               // batters walking out after a dismissal / the next batter walking in
  const liveActors = new WeakMap(); // live ball -> [actor of the facing batter, actor of the other batter]
  let lastInn = -1;
  const tmp = new V3();
  const stateOf = { prevT: -1 };

  // ---- helpers -------------------------------------------------------------------------------------------------------------
  const show = (a, on) => { if (a.h.root.visible !== on) a.h.root.visible = on; };
  const U = (G) => clamp((G.alpha ?? 1) - 1, -1, 0);   // display time offset in ticks: render between the previous tick and this one

  // which swing is the batter making (or about to)? Returns null when nobody swings.
  function swingOf(G, s) {
    if (s.sw) {
      const r = s.sw.res;
      return { src: 'sim', known: true, kind: s.sw.kind, angle: s.sw.angle, power: s.sw.power, T_c: s.sw.T_c, tCommit: s.sw.t, contact: !!r.contact, resKind: r.kind, e: r.e, elev: r.elev ?? 0, init: r.init ?? null, speed: r.speed ?? 0 };
    }
    if (s.phase !== 'flight' || !s.d) return null;
    const tc = G.touch;
    if (s.api.humanBats() && tc && tc.down && tc.committed && tc.ok && tc.commitFt !== undefined) {
      const sw = { kind: 'swing', t: tc.commitFt, angle: tc.aimDeg ?? 0, power: 0.6 };
      const res = resolveSwing(s.d, sw, STUB, [0.75, 1, 1.3][s.cfg.assist] ?? 1);
      return { src: 'touch', known: false, kind: 'swing', angle: sw.angle, power: sw.power, T_c: sw.t + SWING_LEAD, tCommit: sw.t, contact: !!res.contact, resKind: res.kind, e: res.e, elev: res.elev ?? 0, init: res.init ?? null, speed: res.speed ?? 0 };
    }
    if (s.plan && !s.api.humanBats() && s.plan.kind !== 'leave' && s.plan.swingAt != null) {
      const sw = { kind: s.plan.kind === 'block' ? 'block' : 'swing', t: s.plan.swingAt, angle: s.plan.angle, power: s.plan.power };
      const tick = Math.ceil(sw.t / DT - 1e-6) * DT;
      sw.t = tick;
      const res = resolveSwing(s.d, sw, STUB, [0.75, 1, 1.3][s.cfg.assist] ?? 1);
      return { src: 'ai', known: false, kind: sw.kind, angle: sw.angle, power: sw.power, T_c: sw.t + (sw.kind === 'block' ? 0 : SWING_LEAD), tCommit: sw.t, contact: !!res.contact, resKind: res.kind, e: res.e, elev: res.elev ?? 0, init: res.init ?? null, speed: res.speed ?? 0 };
    }
    return null;
  }

  // the ball in the batter's-eye phases, with the final approach guided onto the sweet spot when the swing connects
  function deliveryBall(s, sw, u) {
    const d = s.d;
    const dur = d.n / 60 - 0.02;
    let t = (s.phase === 'flight' ? s.ft : s.ft + s.pt) + u * DT;
    if (s.phase === 'live') t = (s.sw ? s.sw.T_c : s.ft) + u * DT;
    t = clamp(t, 0, dur);
    const real = deliveryPos(d, t);
    if (sw && sw.contact && t > sw.T_c - 0.09 && s.phase !== 'live') {
      const w = clamp((t - (sw.T_c - 0.09)) / 0.09, 0, 1), k = w * w * (3 - 2 * w);
      const N = [d.xc, d.yc, 0.4];
      return [lerp(real[0], N[0], k), lerp(real[1], N[1], k), lerp(real[2], N[2], k)];
    }
    return real;
  }

  // ---- the ball ---------------------------------------------------------------------------------------------------------------
  function ballState(G, s, sw, u) {
    const L = s.live;
    if (s.phase === 'flight') { if (s.ft < 0) return { vis: false }; const p = deliveryBall(s, sw, u); return { vis: p[2] > -1.6, p, kind: 'delivery' }; }
    if (s.phase === 'runup' || s.phase === 'ready' || s.phase === 'aim') return { vis: false, inHand: 'bowler' };
    if (L && (s.phase === 'live' || (s.phase === 'dead' && s.deadFrom === 'live'))) {
      if (L.bs === 'fly') { const i = Math.max(0, Math.min(L.track.n - 1.001, L.i + u)); const a = Math.floor(i), f = i - a; const p0 = trackPos(L.track, a), p1 = trackPos(L.track, a + 1); return { vis: true, p: [lerp(p0[0], p1[0], f), lerp(p0[1], p1[1], f), lerp(p0[2], p1[2], f)], kind: 'hit', fast: true }; }
      if (L.bs === 'thrown') { const th = L.th; if (th.t < 0) return { vis: true, inHand: th.from, hold: true }; const tt = th.t + u * DT, k = clamp((tt - 1 / 60) / 0.1, 0, 1); return { vis: true, p: throwPos(th.fl, tt), kind: 'throw', fromHand: tt < 0.1 ? th.from : -1, w: 1 - k * k * (3 - 2 * k) }; }
      if (L.bs === 'held') return { vis: !(L.dead && s.phase === 'dead' && s.pt > 0.9), inHand: L.holder };
      if (L.bs === 'loose') return { vis: true, p: L.loosePos, kind: 'rest' };
      if (L.bs === 'over') { const b = L.track.boundary; const tb = (s.t - (L.overAt ?? (L.overAt = s.t))); return { vis: tb < 0.45, p: trackPos(L.track, Math.min(L.track.n - 1, b.idx + Math.floor(tb * 60 * 0.7))), kind: 'hit' }; }
    }
    if (s.phase === 'dead' && s.deadFrom === 'flight') { const p = deliveryBall(s, sw, u); return { vis: p[2] > -2.0 && s.pt < 0.6, p, kind: 'delivery' }; }
    return { vis: false };
  }

  // ---- the frame ----------------------------------------------------------------------------------------------------------------
  function frame(G, vw) {
    const s = G.sim;
    const view = vw ?? viewOf(s);
    const u = U(G);
    const tNow = s.t + u * DT;
    const L = s.live;
    const sw = swingOf(G, s);
    const ball3 = ballState(G, s, sw, u);
    const team = { bat: s.inn.bat, fld: 1 - s.inn.bat };
    // innings change: dress everybody for the new roles
    if (lastInn !== s.innNo || stateOf.bat !== s.inn.bat) {
      lastInn = s.innNo; stateOf.bat = s.inn.bat; aOf.clear();
      for (const b of batters) dress(b, team.bat);
      for (const f of field) dress(f, team.fld);
    }
    // the two batters at the wickets
    const inn = s.inn;
    const onField = [inn.st, inn.ns];
    const wicketNow = s.phase === 'dead' && s.last && s.last.wicket;
    if (stateOf.inn !== s.innNo) { stateOf.inn = s.innNo; walkers.length = 0; }
    for (const k of [...aOf.keys()]) if (!onField.includes(k)) {
      const a = aOf.get(k); aOf.delete(k);
      if (wicketNow) walkers.push({ a, kind: 'off', t0: s.t, from: [a.h.root.position.x, -a.h.root.position.z], how: s.last.wicket.how, dir: a.h.root.rotation.y });
    }
    for (let q = walkers.length - 1; q >= 0; q--) { const w = walkers[q]; if (s.t - w.t0 > (w.kind === 'off' ? 6 : 3.3) || s.t < w.t0) { if (w.kind === 'off') show(w.a, false); walkers.splice(q, 1); } }
    for (const bi of onField) {
      if (aOf.has(bi)) continue;
      const used = new Set(aOf.values());
      const a = batters.find((x) => !used.has(x) && !walkers.some((w) => w.a === x)) ?? batters.find((x) => !used.has(x)) ?? batters[0];
      aOf.set(bi, a); setSkinOf(a, bi + 3 + inn.bat * 4);
      if (wicketNow && !walkers.some((w) => w.a === a)) { const to = bi === inn.st ? [-0.5, END_Z[0]] : [-1.2, END_Z[1]]; walkers.push({ a, kind: 'in', t0: s.t, to, from: [-9.0, to[1]] }); }
    }
    const strikerA = aOf.get(inn.st), nonA = aOf.get(inn.ns);
    const ctx = { s, G, sw, ball3, u, tNow, view, L, team };
    ctx.hero = P.hero ?? null;
    driveBatters(ctx, strikerA, nonA);
    driveFielders(ctx);
    placeBall(ctx);
    // visibility by view
    cullAndShadows(ctx, strikerA, nonA);
    // where the human's own player stands on screen (for the gold ring the HUD draws); a view hint, never read by the sim
    { let ha = null;
      if (s.api.humanBats()) ha = L && L.rn && (s.phase === 'live' || (s.phase === 'dead' && s.deadFrom === 'live')) ? (liveActors.get(L) || [strikerA])[0] : strikerA;
      else if (s.api.humanBowls()) ha = field[0];
      else if (s.api.humanFields()) { const f = s.field.find((q) => q.ctl); ha = f ? field[f.id] : null; }
      const pr = ha && ha.h.root.visible ? project(CAMS[view], ha.h.root.position.x, 0, -ha.h.root.position.z) : null;
      Object.defineProperty(G, 'ringPos', { value: pr, enumerable: false, writable: true, configurable: true }); }
    world.setBroken(0, s.stumpsEnd === 0 ? brokenT(s, tNow) : 0);
    world.setBroken(1, s.stumpsEnd === 1 ? brokenT(s, tNow) : 0);
    renderView(ctx);
  }

  function brokenT(s, tNow) {
    if (!(s.stumpsBroken > 0)) return 0;
    const e = [...s.ev].reverse().find((x) => x.type === 'stumps');
    if (!e) return 0;
    return clamp((tNow - e.t) / 0.5, 0, 1);
  }

  function renderView(ctx) {
    const { view } = ctx;
    const cam = CAMS[view];
    stage.renderer.setScissorTest(false);
    stage.renderer.setViewport(0, 0, P.cssW, P.cssH);
    P.fit = fitCamera(P.cam, cam, P.cssW, P.cssH);
    if (P.debugCam) {   // dev only: a free camera for close-up pose checks
      const dc = typeof P.debugCam === 'function' ? P.debugCam(ctx) : P.debugCam;
      P.cam.position.set(dc.pos[0], dc.pos[1], dc.pos[2]); P.cam.rotation.set(0, 0, 0); P.cam.lookAt(dc.look[0], dc.look[1], dc.look[2]);
      const e = P.cam.projectionMatrix.elements, fov = (dc.fov || 30) * Math.PI / 180, aspect = P.cssW / P.cssH, nr = 0.1, fr = 700, t = 1 / Math.tan(fov / 2);
      e.fill(0); e[0] = t / aspect; e[5] = t; e[10] = -(fr + nr) / (fr - nr); e[14] = -2 * fr * nr / (fr - nr); e[11] = -1;
      P.cam.projectionMatrixInverse.copy(P.cam.projectionMatrix).invert(); P.cam.updateMatrixWorld(true); P.cam.matrixWorldInverse.copy(P.cam.matrixWorld).invert();
    }
    if (view === 'bat') {
      const key = `${P.size.w}x${P.size.h}|${VIEW.w}x${VIEW.h}|${P.epoch || 0}`;
      if (backdropKey !== key) { backdropKey = key; backdrop = makeBackdrop(globalThis.document, P.size.w, P.size.h, Math.min(globalThis.devicePixelRatio || 1, 2)); }
      stage.scene.background = backdrop; stage.scene.fog = fog;
    } else { stage.scene.background = skyCol; stage.scene.fog = fogField; }
    if (P.noRender) return;
    stage.render();
  }

  // ---- batters and runners -----------------------------------------------------------------------------------------------------------
  function driveBatters(ctx, A, B) {
    const { s, L, view } = ctx;
    const inn = s.inn;
    const stA = inn.batters[inn.st], stB = inn.batters[inn.ns];
    void stA; void stB;
    for (const a of batters) if (a !== A && a !== B && !walkers.some((w) => w.a === a)) show(a, false);
    driveWalkers(ctx);
    const inW = (a) => walkers.some((w) => w.a === a && w.kind === 'in');
    const running = L && (s.phase === 'live' || (s.phase === 'dead' && s.deadFrom === 'live'));
    if (running && L.rn) {
      // L.rn[0] is the batter who faced the ball; L.rn[1] the non-striker
      if (!liveActors.has(L)) liveActors.set(L, [aOf.get(L.rn[0].b) ?? A, aOf.get(L.rn[1].b) ?? B]);   // who is who is fixed for the whole play
      const la = liveActors.get(L);
      const aFor = (r) => (r === L.rn[0] ? la[0] : la[1]);
      const runner0 = L.rn[0], runner1 = L.rn[1];
      const early = s.phase === 'live' && L.t < HOLD_VIEW && view === 'bat' && runner0.state === 'rest';
      if (early) strikerPose(ctx, aFor(runner0));
      else runnerPose(ctx, aFor(runner0), runner0);
      runnerPose(ctx, aFor(runner1), runner1);
      return;
    }
    if (!inW(A)) strikerPose(ctx, A);
    // non-striker waits at the far end, watching the ball
    const a = B;
    if (inW(a)) return;
    show(a, true);
    a.bat.visible = false;   // the far batter's bat is dropped from the picture (one draw call fewer; he is tiny)
    const clapNow = s.phase === 'dead' && s.last && s.last.boundary && s.pt > 0.3;
    a.rig.setBase([{ clip: clapNow ? 'clap' : 'ready_stance', time: clapNow ? ((s.pt - 0.3) * 1.2) % 2.8 : (ctx.tNow + a.seed * 3) % 2.7, w: 1 }]);
    a.rig.solve({ x: -1.2, z: -END_Z[1], yaw: 0.35 + (a.seed - 0.5) * 0.3, fingers: { L: 'relaxed', R: 'batGrip' } });
    // bat grounded in the hand: no hold IK, the prop simply rides the right hand
    a.h._hold && (a.h._hold.weight = 0);
    a.h.root.updateMatrixWorld(true);
  }

  // walking batters: the next one in, the dismissed one out (a run-out batter looks back at the stumps first)
  function walkPose(a, x, z, yaw, speed, ctx, look = null) {
    const h = a.h, rig = a.rig;
    show(a, true); a.bat.visible = true;
    const clipName = speed > 2.2 ? 'jog' : 'walk';
    const cl = h.getClip(clipName);
    a.cyc = ((a.cyc ?? 0) + speed * DT * 0.0) % cl.dur;
    const phase = (((a.walkDist ?? 0) / cl.travel[1]) * cl.dur) % cl.dur;
    rig.setBase([{ clip: clipName, time: (phase + cl.dur) % cl.dur, w: 1 }]);
    if (h._hold) h._hold.weight = 0;
    rig.noLower = false;
    rig.solve({ x, z: -z, yaw, fingers: { L: 'relaxed', R: 'batGrip' }, head: look ? { target: look, weight: 0.9, maxYaw: 1.6, maxPitch: 0.5 } : null });
    rig.noLower = true;
    h.root.updateMatrixWorld(true);
  }
  function driveWalkers(ctx) {
    const { s, tNow } = ctx;
    for (const w of walkers) {
      const t = tNow - w.t0, a = w.a;
      if (w.kind === 'in') {
        const dur = 3.1, k = clamp(t / dur, 0, 1), e = k * (2 - k) * 0.35 + k * 0.65;   // a quick walk that eases into the crease
        const x = lerp(w.from[0], w.to[0], e), z = lerp(w.from[1], w.to[1], e);
        const sp = Math.hypot(w.to[0] - w.from[0], w.to[1] - w.from[1]) / dur;
        a.walkDist = sp * t;
        const look = new V3(0, 1.4, -PITCH);
        if (k < 1) walkPose(a, x, z, yawOfDir(w.to[0] - w.from[0], w.to[1] - w.from[1]) + 0.0, sp, ctx, t > 2.0 ? look : null);
      } else {
        const stand = w.how === 'run out' ? 0.9 : 0.6;
        if (t < stand) {   // a low-key reaction: shoulders drop, he looks back at the wicket (run out) or at the ground
          const look = w.how === 'run out' ? new V3(0, 0.8, -(w.from[1] > 7 ? PITCH : 0)) : new V3(w.from[0], 0.1, -w.from[1] - 1);
          a.rig.setBase([{ clip: 'idle_relaxed', time: (tNow * 0.8 + a.seed) % 3, w: 1 }]); show(a, true); a.bat.visible = true; if (a.h._hold) a.h._hold.weight = 0;
          a.rig.solve({ x: w.from[0], z: -w.from[1], yaw: w.dir, spine: { pitch: 0.18, yaw: 0, roll: 0 }, head: { target: look, weight: 1, maxYaw: 1.8, maxPitch: 0.8 }, fingers: { L: 'relaxed', R: 'batGrip' } });
          a.h.root.updateMatrixWorld(true);
        } else {
          const sp = 1.7, tx = w.from[0] - (w.from[0] > -9 ? 1 : 0) * 0 - 12, dist = Math.min(Math.abs(tx - w.from[0]), (t - stand) * sp);
          const x = w.from[0] - dist, z = w.from[1] + (w.from[1] > 7 ? 0.25 : -0.25) * Math.min(dist, 2);
          a.walkDist = dist;
          if (x < -FIELD.ax * 0.99) { show(a, false); continue; }
          walkPose(a, x, z, yawOfDir(-1, 0), sp, ctx);
        }
      }
    }
  }

  function runnerPose(ctx, a, r) {
    const { s } = ctx;
    show(a, true); a.bat.visible = !!(r === ctx.L?.rn[0]) || r.state === 'run' && false;
    const rig = a.rig;
    const endZ = (e) => END_Z[e];
    let z, yaw, clip = 'sprint', time = 0, state = r.state;
    const u = state === 'out' ? (r.uOut ?? 0) : state === 'run' ? runU(clamp(r.tau + ctx.u * DT, 0, T_RUN)) : 0;
    const from = state === 'run' || state === 'out' ? r.from : r.end, to = 1 - from;
    z = lerp(endZ(from), endZ(to), u);
    const REST_X = [-0.5, -1.2], LANE = [0.45, -0.95];
    const x = state === 'run' || state === 'out' ? lerp(lerp(REST_X[from], LANE[from], ramp(u, 0, 0.14)), REST_X[to], ramp(u, 0.86, 1)) : REST_X[from];
    if (state === 'run') {
      yaw = yawOfDir(0, to === 0 ? -1 : 1);
      const cl = a.h.getClip('sprint');
      time = (((u * 13.4) / cl.travel[1]) * cl.dur % cl.dur + cl.dur) % cl.dur;
      rig.setBase([{ clip, time, w: 1 }]);
      const gq = a.bat.quaternion;
      const fw = new V3(Math.sin(yaw), 0, Math.cos(yaw));
      const ax = fw.clone().multiplyScalar(0.55).add(new V3(0, -0.8, 0)).normalize();
      const nn = new V3(0, 1, 0).addScaledVector(ax, -ax.y).normalize();
      const Qh = quatFromBasis(ax.clone().cross(nn).normalize(), ax, nn).multiply(gq.clone().invert());
      a.h._hold && (a.h._hold.weight = 0);
      rig.solve({ x, z: -z, yaw, fingers: { L: 'relaxed', R: 'batGrip' }, hands: { R: { q: Qh, clav: 0 } } });
    } else {
      // at rest at an end (or out): standing, watching the ball
      yaw = yawOfDir(0, from === 0 ? 1 : -1) + (a.seed - 0.5) * 0.3;
      if (state === 'out') yaw = yawOfDir(0, to === 0 ? -1 : 1);
      rig.setBase([{ clip: state === 'out' ? 'idle_relaxed' : 'ready_stance', time: (ctx.tNow + a.seed * 3) % 2.7, w: 1 }]);
      a.h._hold && (a.h._hold.weight = 0);
      rig.solve({ x: state === 'out' ? x : REST_X[from], z: -(state === 'out' ? z : endZ(from)), yaw, fingers: { L: 'relaxed', R: 'batGrip' } });
    }
    a.h.root.updateMatrixWorld(true);
    void s;
  }

  function strikerPose(ctx, a) {
    const { s, sw, ball3, L } = ctx;
    show(a, true); a.bat.visible = true;
    const rig = a.rig, d = s.d;
    // the finish of a four or a six: bat raised
    if (s.phase === 'dead' && s.last && s.last.boundary && s.pt > 0.15) { celebrateBat(ctx, a); return; }
    const fam = familyOf(sw, d);
    const N = d ? toWorld(d.xc, d.yc, 0.4) : new V3(0, 1, 0);
    const resting = s.phase === 'ready' || s.phase === 'aim' || s.phase === 'runup';
    let ft;
    if (resting) ft = -1;
    else if (s.phase === 'flight') ft = s.ft + ctx.u * DT;
    else if (s.phase === 'live') ft = (s.sw ? s.sw.T_c : s.ft) + (L ? L.t : 0) + ctx.u * DT;
    else if (s.phase === 'dead') ft = s.deadFrom === 'live' ? (s.sw ? s.sw.T_c : s.ft) + (L ? L.t : 0) : s.ft + s.pt;
    else ft = -1;
    const bctx = {
      hand: 1, ft, tC: d ? d.tC : 1, tB: d ? d.bounceT : -1, lenClass: d ? d.lengthClass : 'good', sw, fam, N,
      ball: ball3.vis && ball3.p ? { vis: true, p: toWorld(ball3.p[0], ball3.p[1], ball3.p[2]) } : { vis: false },
      phase: s.phase === 'dead' ? 'result' : s.phase, tr: s.phase === 'dead' ? s.pt : 0, idleT: ctx.tNow + a.seed * 7, batProp: a.bat,
      release: toWorld(d ? d.spec.relX : 0, REL_Y, REL_Z), resting,
    };
    if (a.h._hold) a.h._hold.weight = 1;
    const out = batterPose(bctx, rig, {});
    rig.setBase([{ clip: 'ready_stance', time: (ctx.tNow + a.seed * 3) % 2.7, w: 1 }]);
    rig.solve(out.spec);
    a.h._twoHand();
    rig.limitWrists();
    a.h.root.updateMatrixWorld(true);
    a.last = out;
  }

  function celebrateBat(ctx, a) {
    const rig = a.rig, t = ctx.s.pt;
    const gq = a.bat.quaternion, gp = a.bat.position;
    const aDir = new V3(0.0, 1.0, -0.15).normalize(), nDir = new V3(0, 0.0, -1).normalize();
    const Q = quatFromBasis(aDir.clone().cross(nDir).normalize(), aDir, nDir);
    const Qh = Q.clone().multiply(gq.clone().invert());
    rig.setBase([{ clip: 'celebrate_2', time: (t * 0.9) % 2.5, w: 1 }]);
    const p0 = new V3(-0.5, 0, -0.05);
    rig.solve({
      x: p0.x, z: p0.z, yaw: Math.PI,
      arms: (rg) => { const hp = rg.head.getWorldPosition(new V3()); const butt = hp.clone().add(new V3(-0.28, 0.12, 0.02)); return { R: { p: butt.sub(gp.clone().applyQuaternion(Qh)), q: Qh, pole: hp.clone().add(new V3(-0.6, -0.1, 0)) } }; },
      fingers: { L: 'open', R: 'batGrip' },
    });
    if (a.h._hold) a.h._hold.weight = 0;
    a.h.root.updateMatrixWorld(true);
  }

  // ---- the fielding side ---------------------------------------------------------------------------------------------------------------
  function driveFielders(ctx) {
    const { s, L, view } = ctx;
    const live = L && (s.phase === 'live' || (s.phase === 'dead' && s.deadFrom === 'live'));
    s.field.forEach((f, i) => {
      const a = field[i];
      if (i === 0 && !live) {
        const tau = s.phase === 'runup' ? s.pt - 0.95 : s.phase === 'flight' ? s.ft : s.phase === 'dead' && s.deadFrom === 'flight' ? s.ft + s.pt : -9;
        const stand = s.phase === 'ready' || s.phase === 'aim';
        if (!stand && tau < 1.3) { driveBowler(ctx, a, f); return; }
        if (stand && Math.hypot(f.vx, f.vz) < 0.3 && Math.hypot(f.x - f.x0, f.z - f.z0) < 0.05) { driveBowler(ctx, a, f); return; }
      }
      if (i === 1 && view === 'bat') { show(a, false); return; }
      if (i === 2 && walkers.length) { show(a, false); return; }   // keeps the draw calls down while a batter walks
      show(a, true);
      placeFielder(ctx, a, f, live);
    });
  }

  function driveBowler(ctx, a, f) {
    const { s } = ctx;
    const d = s.d;
    const h = a.h, rig = a.rig;
    const speed = d ? d.spec.speed : 16;
    const relX = d ? d.spec.relX : 0.1;
    const rel = toWorld(relX, REL_Y, REL_Z);
    const V00 = speed < 15.2 ? VARIANTS.spin : (s.ballSeq % 2 ? VARIANTS.frontOn : VARIANTS.sideOn);
    // each bowler has his own run-up and action: a little more or less stride, coil and spring, from his own seed
    const q1 = hash(Math.floor(a.seed * 4096) + 1) - 0.5, q2 = hash(Math.floor(a.seed * 4096) + 2) - 0.5;
    const V0 = { ...V00, stride: V00.stride * (1 + 0.12 * q1), coil: V00.coil + 26 * q2, up: V00.up * (1 + 0.5 * q1), vmax: V00.vmax * (1 + 0.1 * q2) };
    h.root.scale.setScalar(V0.scale);
    const tau = s.phase === 'runup' ? s.pt - 0.95 + ctx.u * DT : s.phase === 'flight' ? s.ft + ctx.u * DT : s.phase === 'dead' && s.deadFrom === 'flight' ? s.ft + s.pt : (s.phase === 'ready' || s.phase === 'aim') ? -9 : s.ft + s.pt;
    const bctx = { tau, variant: V0, rel, L: PITCH, runT: 0.95, scale: V0.scale };
    const bp = bowlerPose(bctx, rig, {});
    const T = bp.timing, spec = bp.spec;
    a.last = { bp, tau };
    const standing = tau <= -8;
    const wicket = s.phase === 'dead' && s.last && s.last.wicket;
    if (wicket && s.pt > 0.15) {
      rig.setBase([{ clip: 'celebrate', time: clamp(s.pt - 0.15, 0, 3.5), w: 1 }]);
      rig.solve({ x: rel.x + 0.2 * V0.scale + 1.2, z: -(PITCH - 3.6), yaw: 0 });
      h.root.updateMatrixWorld(true); a.bowlerBall = false; return;
    }
    if (standing) {
      rig.setBase([{ clip: 'idle', time: (ctx.tNow + a.seed * 2) % 2.7, w: 1 }]);
      rig.solve({ x: f.x, z: -f.z, yaw: 0 });
      a.bowlerBall = true;
    } else if (tau < T.Tj - 0.1) {
      const clip = h.getClip(V0.run);
      const dist = T.runDist(tau - T.tauStart);
      const phaseTime = (((dist - T.DJ) / clip.travel[1]) * clip.dur + (V0.run === 'sprint' ? 0.2 : 0.7)) % clip.dur;
      rig.setBase([{ clip: V0.run, time: (phaseTime + clip.dur) % clip.dur, w: 1 }]);
      const blend = 1 - ramp(tau - T.tauStart, 0, 0.45);   // the run-up starts from where the bowler stands
      rig.solve({ x: lerp(rel.x + 0.2 * V0.scale, f.x0, blend), z: -(T.zMark - dist + (f.z0 - T.zMark) * blend), yaw: 0 });
      a.bowlerBall = true;
    } else {
      const wb = ramp(tau, T.Tj - 0.10, T.Tj);
      spec.pelvis.w = wb; spec.feet.L.w = wb; spec.feet.R.w = wb;
      spec.arms = (rg, sp) => bowlerArms(bctx, rg, { ...bp, spec: sp }).spec.hands;
      spec.head = { target: new V3(0, 1.3, 2), weight: 1, maxYaw: 1.5 };
      rig.setBase([{ clip: V0.run, time: 0.2, w: 1 - wb }, { clip: 'idle', time: 0.5, w: wb }].filter((x) => x.w > 0));
      rig.solve(spec);
      a.bowlerBall = tau < -1 / 60;
    }
    h.root.updateMatrixWorld(true);
  }

  // pose for every fielder while the ball is live (and the idle stance before it)
  function placeFielder(ctx, a, f, live) {
    const { s, L, tNow, u, ball3 } = ctx;
    const h = a.h, rig = a.rig;
    h.root.scale.setScalar(1);
    const x = f.x + f.vx * u * DT, z = f.z + f.vz * u * DT;
    const speed = Math.hypot(f.vx, f.vz);
    let yaw = yawOfDir(f.fx, f.fz);
    // idle variation: every player stands a little differently
    const idle = (a.seed - 0.5) * 0.35;
    let d = { clip: 'field_ready', time: (tNow * 0.9 + a.seed * 3.7) % 1.0, targets: {}, reach: [], yaw: yaw + (speed < 0.5 ? idle : 0), loco: false };
    const ballW = ball3.p ? toWorld(ball3.p[0], ball3.p[1], ball3.p[2]) : null;
    if (f.role === 'wk') { d.clip = 'keeper_crouch'; d.time = (tNow * 0.8 + a.seed) % 1.2; if (!live) d.yaw = f.end === 0 ? Math.PI : 0; }
    const act = f.act, actAge = act ? s.t - act.t0 : 99;
    if (live && L) {
      const holding = L.bs === 'held' && L.holder === f.id;
      const throwing = L.bs === 'thrown' && L.th && L.th.from === f.id;
      const isHolder = holding || throwing;
      if (isHolder && act && (act.kind === 'catch' || act.kind === 'catchBounce')) {
        d = { ...d, clip: 'catch_two_hand', time: clamp(0.3 + actAge, 0, 0.79), targets: { catch: L.takePos ? toWorld(L.takePos[0], L.takePos[1], L.takePos[2]) : (ballW ?? toWorld(f.x, 1.5, f.z)) }, yaw };
      } else if (isHolder) {
        const th = L.th;
        const dive = false;   // a dive is shown as a deep lunge-and-scoop (the hands are verified to reach the ball; the library dive clip does not)
        if (dive) d = { ...d, clip: 'field_dive_stop', time: clamp(0.36 + actAge, 0, 1.19), targets: { stop: L.takePos ? toWorld(L.takePos[0], Math.max(0.1, L.takePos[1]), L.takePos[2]) : toWorld(f.x, 0.12, f.z) }, yaw };
        else {
          let time;
          if (throwing) { time = th.t < 0 ? 0.3 + ((th.t + 0.12) / 0.12) * 0.4 : 0.7 + th.t; yaw = Math.atan2(0 - f.x, -((th.end === 0 ? 0 : PITCH) - f.z)); }
          else time = 0.22 + Math.min(0.08, actAge * 0.4);
          d = { ...d, clip: 'field_pickup_throw', time: clamp(time, 0, 1.14), targets: { ball: L.takePos ? toWorld(L.takePos[0], Math.max(0.1, L.takePos[1]), L.takePos[2]) : toWorld(f.x + f.fx * 0.3, 0.1, f.z + f.fz * 0.3) }, yaw };
          if (throwing && th.t > -0.1 && th.t < 0.05) d.reach = [{ side: 'R', p: toWorld(th.fl.p0[0], 1.85, th.fl.p0[2]), w: 1 - Math.abs(th.t + 0.025) / 0.075 }];
        }
      } else if (act && (act.kind === 'drop' || act.kind === 'fumble') && actAge < 0.7) {
        d = { ...d, clip: act.kind === 'drop' ? 'catch_two_hand' : 'field_pickup_throw', time: act.kind === 'drop' ? clamp(0.3 + actAge, 0, 0.79) : clamp(0.22 + actAge * 0.6, 0, 1.14), targets: ballW ? (act.kind === 'drop' ? { catch: ballW } : { ball: ballW }) : {}, yaw };
      } else if ((L.bs === 'fly') && ballW) {
        // anticipation: a ball about to arrive in the hands or at the feet
        const bp = L.track ? trackPos(L.track, L.i) : null;
        if (bp) {
          const dh = Math.hypot(f.x - bp[0], f.z - bp[2]);
          const sp = Math.max(4, Math.hypot((trackPos(L.track, L.i + 1)[0] - bp[0]) * 60, (trackPos(L.track, L.i + 1)[2] - bp[2]) * 60));
          const eta = Math.max(0, dh - 0.9) / sp;
          if (dh < 3.2 && bp[1] > 0.4 && bp[1] < 2.4 && L.bounces === 0 && eta < 0.3) d = { ...d, clip: 'catch_two_hand', time: clamp(0.3 - eta, 0, 0.79), targets: { catch: ballW }, yaw: Math.atan2(f.x - bp[0] < 0 ? bp[0] - f.x : bp[0] - f.x, -(bp[2] - f.z)) };
          else if (dh < 2.4 && bp[1] >= 0.5 && bp[1] < 1.2 && eta < 0.3) d = { ...d, clip: 'catch_two_hand', time: clamp(0.3 - eta, 0, 0.79), targets: { catch: ballW }, yaw };
          else if (dh < 2.4 && bp[1] < 0.5 && eta < 0.22) d = { ...d, clip: 'field_pickup_throw', time: clamp(0.22 - eta, 0, 0.22), targets: { ball: ballW }, yaw };
        }
      }
    }
    // an authored dive: the human fielder who pressed CATCH for a ball just out of reach, and the take itself (act kind 'dive') with the slide and the rise
    let dv = null;
    if (live && L && f.role !== 'wk') {
      if (L.bs === 'held' && L.holder === f.id && act && act.kind === 'dive' && actAge < DIVE.total && L.takePos) dv = { tgt: toWorld(L.takePos[0], Math.max(0.1, L.takePos[1]), L.takePos[2]), tau: actAge };
      else if (f.ctl && (L.bs === 'fly' || L.bs === 'loose') && ballW && L.track && s.t - s.ctl.tapAt >= 0 && s.t - s.ctl.tapAt < 0.5) {
        const bp = trackPos(L.track, L.i), nx = trackPos(L.track, L.i + 1);
        const dh = Math.hypot(f.x - bp[0], f.z - bp[2]), sp = Math.max(4, Math.hypot((nx[0] - bp[0]) * 60, (nx[2] - bp[2]) * 60));
        const eta = Math.max(0, dh - 0.95) / (sp + speed * 0.8);
        if (a.diveTc == null && bp[1] <= 1.15 && dh > 0.62 && dh < 3.0 && eta < DIVE.launch + 0.1) { a.diveTc = s.t + eta; a.diveL = clamp(eta + 0.06, 0.16, DIVE.launch); }
        if (a.diveTc != null) dv = { tgt: ballW.clone(), tau: Math.min(0, s.t - a.diveTc) };
      }
    }
    if (!dv && !(L && L.bs === 'held' && L.holder === f.id) && a.diveTc != null && s.t - a.diveTc > 0.5) a.diveTc = null;
    if (dv) {
      const dx = dv.tgt.x - x, dz = dv.tgt.z + z;
      const yawD = Math.atan2(dx, dz);
      if (speed > 0.6 && dv.tau < 0) { const clipName = speed > 4.0 ? 'sprint' : speed > 2.2 ? 'jog' : 'walk'; const cl = h.getClip(clipName); rig.setBase([{ clip: clipName, time: (((a.cyc ?? 0) % cl.dur) + cl.dur) % cl.dur, w: 1 }]); }
      else rig.setBase([{ clip: 'field_pickup_throw', time: 0.22, w: 1 }]);
      h.root.position.set(x, 0, -z); h.root.rotation.y = yawD; h.update(1 / 120); h.root.updateMatrixWorld(true);
      const standY = a.standY ?? (a.standY = rig.pelvis.getWorldPosition(new V3()).y);
      rig.noLower = false;
      const r = diveSpec({ x, z: -z, yaw: yawD, tgt: dv.tgt, tau: dv.tau, launch: a.diveL ?? DIVE.launch, standY, ankleH: rig.ankleH ?? 0.08, loco: speed > 0.6 && dv.tau < 0 });
      const spec = r.spec; spec.head = ballW && live ? { target: dv.tgt, weight: 0.7, maxYaw: 1.0, maxPitch: 0.6 } : null;
      a.lastDesc = { clip: 'dive', time: +dv.tau.toFixed(2), tgt: true };
      for (const k of Object.keys(a.targets || {})) h.setTarget(k, null); a.targets = {};
      h.setReach('R', null); h.setReach('L', null);
      rig.solve(spec);
      rig.noLower = true;
      h.root.updateMatrixWorld(true);
      return;
    }
    if (d.clip === 'field_ready' || d.clip === 'keeper_crouch') {
      if (speed > 0.6) { d.loco = true; }
      else if (!live && s.phase !== 'dead' && !(s.last && s.last.wicket && s.pt > 0.3)) {
        // before the ball: face the batter's end, head follows the ball when it is in play
        d.yaw = f.role === 'wk' ? d.yaw : yawOfDir(-f.x, -f.z + 0.4) + idle;
      }
      if (s.phase === 'dead' && s.last && s.last.wicket && s.pt > 0.3 && f.role !== 'wk' && !(f.ctl)) { d.clip = 'celebrate_2'; d.time = ((s.pt - 0.3) * 0.9 + a.seed) % 2.5; }
    }
    // facing: a runner faces where he is going
    if (d.loco) {
      yaw = yawOfDir(f.vx / speed, f.vz / speed);
      const fast = speed > 4.0;
      const clipName = fast ? 'sprint' : speed > 2.2 ? 'jog' : 'walk';
      const cl = h.getClip(clipName);
      a.dist += speed * DT * 0 + 0;
      // phase from the distance covered, so the feet match the ground speed
      a.cyc = ((a.cyc ?? a.seed * 3) + (speed * Math.max(0, tNow - (a.lastT ?? tNow))) / cl.travel[1] * cl.dur) % cl.dur;
      a.lastT = tNow;
      rig.setBase([{ clip: clipName, time: ((a.cyc % cl.dur) + cl.dur) % cl.dur, w: 1 }]);
      rig.noLower = false;
      rig.solve({ x, z: -z, yaw, head: ballW ? { target: ballW, weight: 0.5, maxYaw: 0.9, maxPitch: 0.6 } : null });
      rig.noLower = true;
      h.root.updateMatrixWorld(true);
      return;
    }
    a.lastT = tNow;
    a.lastDesc = { clip: d.clip, time: +d.time.toFixed(2), tgt: !!(d.targets.catch || d.targets.ball) };
    // a lunge toward the ball (presentation only): the figure leans its whole body toward the catch / pick-up point so the hands reach it exactly
    let lx = x, lz = z;
    const tgt = d.targets.catch || d.targets.ball || d.targets.stop;
    if (tgt) {
      const dive = d.clip === 'field_dive_stop';
      const dx = tgt.x - x, dz = -tgt.z - z, dd = Math.hypot(dx, dz), w = clamp(d.time / (dive ? 0.36 : d.clip === 'catch_two_hand' ? 0.3 : 0.22), 0, 1);
      const m = clamp(dd - (dive ? 0.2 : d.clip === 'catch_two_hand' ? 0.38 : 0.30), 0, dive ? 1.4 : 0.9) * w;
      if (dd > 1e-3) { lx = x + dx / dd * m; lz = z + dz / dd * m; }
    }
    for (const k of Object.keys(a.targets || {})) if (!d.targets[k]) h.setTarget(k, null);
    a.targets = d.targets;
    for (const k of Object.keys(d.targets)) h.setTarget(k, d.targets[k]);
    h.setReach('R', null); h.setReach('L', null);
    for (const r of d.reach) h.setReach(r.side, r.p, { weight: r.w });
    rig.setBase([{ clip: d.clip, time: d.time, w: 1 }]);
    rig.noLower = false;
    const head = ballW && live ? { target: ballW, weight: 0.6, maxYaw: 1.0, maxPitch: 0.6 } : null;
    const spec = { x: lx, z: -lz, yaw: d.yaw, head };
    if (d.clip === 'field_ready' || d.clip === 'keeper_crouch') {   // the live idle layer: every player stands a little differently (weight on one side, a turn of the trunk)
      const sw = Math.sin(tNow * 0.7 + a.seed * 9) * 0.04;
      spec.spine = { pitch: 0.03 * Math.sin(tNow * 1.3 + a.seed * 5), yaw: (a.seed - 0.5) * 0.18, roll: (a.seed - 0.5) * 0.14 + sw };
      if (d.clip === 'field_ready' && !d.loco) {
        // authored waiting stances, one at a time per player, each held 9-15 s on the player's own schedule: 0 ready, 1 hands on knees, 2 hands on hips, 3 one hand on a hip, a hand to the neck
        const per = 9 + a.seed * 6, ph = tNow / per + a.seed * 7, idx = Math.floor(ph), fr = ph - idx;
        const stance = Math.floor(hash(idx * 13 + Math.floor(a.seed * 1000)) * 4), w = ramp(fr, 0, 0.08) * (1 - ramp(fr, 0.92, 1));
        a.stance = stance;
        if (stance === 1) spec.spine.pitch += 0.42 * w;
        if (stance !== 0 && w > 0.01) {
          const yw = d.yaw, latv = new V3(Math.cos(yw), 0, -Math.sin(yw)), fv = new V3(Math.sin(yw), 0, Math.cos(yw));
          spec.arms = (rg) => {
            const hips = rg.pelvis.getWorldPosition(new V3());
            if (stance === 1) {
              const kl = rg.leg.L.calf.getWorldPosition(new V3()), kr = rg.leg.R.calf.getWorldPosition(new V3());
              return { L: { p: kl.add(new V3(0, 0.1, 0)), pole: kl.clone().addScaledVector(latv, 0.5), w }, R: { p: kr.add(new V3(0, 0.1, 0)), pole: kr.clone().addScaledVector(latv, -0.5), w } };
            }
            const hl = hips.clone().addScaledVector(latv, 0.25).addScaledVector(fv, 0.03).add(new V3(0, 0.1, 0));
            const hr = hips.clone().addScaledVector(latv, -0.25).addScaledVector(fv, 0.03).add(new V3(0, 0.1, 0));
            if (stance === 2) return { L: { p: hl, pole: hl.clone().addScaledVector(latv, 0.5).addScaledVector(fv, -0.3), w }, R: { p: hr, pole: hr.clone().addScaledVector(latv, -0.5).addScaledVector(fv, -0.3), w } };
            const nk = rg.neck.getWorldPosition(new V3()).addScaledVector(latv, -0.12).addScaledVector(fv, 0.1);
            return { L: { p: hl, pole: hl.clone().addScaledVector(latv, 0.5).addScaledVector(fv, -0.3), w }, R: { p: nk, pole: nk.clone().addScaledVector(latv, -0.5).add(new V3(0, 0.1, 0)), w } };
          };
        }
      }
    }
    if (tgt && (d.clip === 'catch_two_hand' || d.clip === 'field_pickup_throw')) {
      // the hands go to the ball exactly (two-bone IK), the torso folds forward to bring the shoulders down to a low ball
      const catching = d.clip === 'catch_two_hand';
      const wIK = catching ? ramp(d.time, 0.02, 0.28) : ramp(d.time, 0.04, 0.2);
      const lat = new V3(Math.cos(d.yaw), 0, -Math.sin(d.yaw)).multiplyScalar(catching ? 0.06 : 0.04);
      const bendDeg = clamp((1.15 - tgt.y) * 62, 0, 62) * wIK;
      spec.spine = { pitch: bendDeg * Math.PI / 180, yaw: 0, roll: 0 };
      // a low ball: the knees bend (pelvis drops, feet stay planted where the clip had them)
      const drop = clamp((0.95 - tgt.y) * 0.5, 0, 0.42) * wIK;
      if (drop > 0.01) {
        h.root.position.set(lx, 0, -lz); h.root.rotation.y = d.yaw; h.update(1 / 120); h.root.updateMatrixWorld(true);
        const fw = new V3(Math.sin(d.yaw), 0, Math.cos(d.yaw));
        const pel = rig.pelvis.getWorldPosition(new V3());
        spec.pelvis = { pos: pel.clone().add(new V3(fw.x * drop * 0.6, -drop, fw.z * drop * 0.6)), w: 1 };
        spec.feet = {};
        for (const sd of ['L', 'R']) { const fp = h.bonePosition(sd + '_Foot'); fp.y = Math.max(fp.y, rig.ankleH); spec.feet[sd] = { p: fp, yaw: d.yaw, pitch: 0, pole: fp.clone().addScaledVector(fw, 0.6).add(new V3(0, 0.55, 0)) }; }
      }
      spec.hands = { R: { p: tgt.clone().sub(lat), pole: tgt.clone().add(new V3(Math.cos(d.yaw) * -0.5, 0.15, -Math.sin(d.yaw) * 0.5)), clav: 1, w: wIK }, L: { p: tgt.clone().add(lat), pole: tgt.clone().add(new V3(Math.cos(d.yaw) * 0.5, 0.15, Math.sin(d.yaw) * 0.5)), clav: 1, w: catching ? wIK : wIK * 0.0 } };
      if (!catching) delete spec.hands.L;
    }
    else if (d.clip === 'field_dive_stop' && d.targets.stop) {   // the diving hand goes to the ball
      const wI = ramp(d.time, 0.05, 0.36);
      spec.hands = { R: { p: d.targets.stop.clone(), pole: d.targets.stop.clone().add(new V3(0.3, 0.4, 0)), clav: 1, w: wI } };
    }
    rig.solve(spec);
    rig.noLower = true;
    h.root.updateMatrixWorld(true);
  }

  // ---- ball and shadows ------------------------------------------------------------------------------------------------------------------
  function placeBall(ctx) {
    const { s, ball3, view } = ctx;
    const b = ball;
    // the ball is drawn larger when it would be too small to follow: at least 11 px (bat view) or 14 px (field view) radius on the 720 px canvas
    let big = view === 'field' ? 2.4 : 1;
    if (ball3.vis && ball3.p) { const pk = project(CAMS[view], ball3.p[0], ball3.p[1], ball3.p[2]); if (pk) big = clamp((view === 'field' ? 14 : 11) / (pk.k * BALL_R), 1, 7); }
    b.scale.setScalar(big);
    const inHand = (idx) => {
      const a = idx === 'bowler' ? field[0] : field[idx];
      if (!a || !a.h.root.visible) { b.visible = false; return; }
      const hb = a.h.bones.Bip01_R_Hand, fr = a.h.fingers.R;
      const local = fr.knuckle.clone().multiplyScalar(0.45).addScaledVector(fr.palmDir, 0.038);
      b.position.copy(local.applyMatrix4(hb.matrixWorld)); b.visible = true; b.rotation.set(0, 0, 0);
    };
    if (ball3.inHand !== undefined) {
      if (ball3.inHand === 'bowler') { const a = field[0]; if (a.bowlerBall && ctx.s.phase !== 'ready') inHand('bowler'); else if (ctx.s.phase === 'ready' || ctx.s.phase === 'aim') inHand('bowler'); else b.visible = false; }
      else inHand(ball3.inHand);
    } else if (ball3.vis && ball3.p) {
      toWorld(ball3.p[0], Math.max(BALL_R * big * 0.5, ball3.p[1]), ball3.p[2], tmp); b.position.copy(tmp); b.visible = true;
      const tt = ctx.tNow * 18; b.rotation.set(tt * 0.7, tt * 0.3, tt);
    } else b.visible = false;
    if (ball3.fromHand !== undefined && ball3.fromHand >= 0 && ball3.p) {   // the ball leaves the hand exactly where the hand is, then eases onto the sim's flight
      const a = field[ball3.fromHand]; if (a) { const hb = a.h.bones.Bip01_R_Hand, fr = a.h.fingers.R; const hp = fr.knuckle.clone().multiplyScalar(0.45).addScaledVector(fr.palmDir, 0.038).applyMatrix4(hb.matrixWorld); b.position.lerp(hp, ball3.w); }
    }
  }

  function cullAndShadows(ctx, A, B) {
    const { view, s } = ctx;
    const cam = CAMS[view];
    const list = [];
    for (const a of all) {
      if (!a.h.root.visible) continue;
      const p = a.h.root.position;
      const sp = project(cam, p.x, 0.9, -p.z);
      if (!sp || sp.x < -120 || sp.x > VIEW.w + 120 || sp.y < -150 || sp.y > VIEW.h + 220) { a.h.root.visible = false; continue; }
      // level of detail from the size on screen (virtual px for a 1.8 m person): full / medium / light
      const px = 1.8 * sp.k, lv = px > 190 ? 0 : px > 80 ? 1 : 2;
      a.h.setLOD(P.quality === 'low' ? Math.max(1, lv) : lv);
      list.push([p.x, p.z, a === A || a === B ? 0.7 : 0.66]);
    }
    if (ball.visible) { const y = ball.position.y; list.push([ball.position.x, ball.position.z, (view === 'field' ? 0.5 : 0.14) + Math.min(0.2, y * 0.05)]); }
    world.setBlobs(list);
    void s;
  }

  function setVisibleWorld(on) { world.group.visible = on; if (!on) { for (const a of all) show(a, false); ball.visible = false; } }

  return { frame, world, batters, field, ball, all, setVisibleWorld, swingOf, aOf, ballState, fitCamera };
}

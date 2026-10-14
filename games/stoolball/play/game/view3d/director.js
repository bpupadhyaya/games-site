// The director: owns the 3D cast (bowler, eight fielders, two batters), the boards and the camera, and turns the simulation's state into
// poses every frame. READ-ONLY with respect to the game: positions, timings and outcomes come from the sim; the animation is retimed
// to them (human.playTimed / timeWarpTo), never the other way round.
import { GL } from '../src/glbridge.js';
import { meta, proj, unproj as unprojCam } from '../src/layout.js';
import { fieldersOf } from '../src/play.js';
import { WIND, WIND_H } from '../src/play.js';
import * as M from '../src/sim.js';
import { makeCast, applyLOD } from './cast.js';
import { initProps, makeBoard, makeBallMesh } from './props.js';
import { createGreen } from './scene.js';
import { createPoseFilter } from './smooth.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export async function createDirector(P) {
  const V = P.V, THREE = V.THREE, stage = P.stage;
  initProps(V);
  const green = await createGreen(V, stage, { quality: P.info.quality });
  const cast = await makeCast(V, stage);       // { bowler, fielders[8], bats[2] } of actors
  const actors = [cast.bowler, ...cast.fielders, ...cast.bats];
  for (const a of actors) a.filter = createPoseFilter(a.h, THREE, { armRate: a.paddle ? 32 : 0 });
  const boards = [makeBoard(THREE), makeBoard(THREE)];
  for (const b of boards) stage.add(b.root);
  const ball3 = makeBallMesh(THREE, 0.036); ball3.visible = false; stage.add(ball3);
  const blobs = V.createBlobShadows(16, { radius: 0.5, opacity: 0.5 }); stage.add(blobs.mesh);
  const D = { S: null, lastCamKey: '', swingFor: null, green, ball3, boards, ballLast: null, prevOutcome: null };

  // ---- the camera: an oblique projection equal to layout.js proj() -------------------------------------------------
  // three space: portrait (x, z, -y), landscape (-y, z, -x). Screen x = ox + s X, screen y = oy + s k Z - s Y; depth d = -Z - k Y.
  const toThree = (land, x, y, z, out) => (land ? out.set(-y, z, -x) : out.set(x, z, -y));
  const fromThree = (land, v) => (land ? { x: -v.z, y: -v.x, z: v.y } : { x: v.x, y: -v.z, z: v.y });
  const dirThree = (land, dx, dy) => (land ? [-dy, -dx] : [dx, -dy]);
  const W = () => meta.width, H = () => meta.height;
  const proM = new THREE.Matrix4();
  function setProjection(cam) {
    const w = W(), h = H(), s = cam.s, k = cam.k, ox = cam.ox, oy = cam.oy;
    proM.set(
      2 * s / w, 0, 0, 2 * ox / w - 1,
      0, 2 * s / h, -2 * s * k / h, 1 - 2 * oy / h,
      0, -k / 60, -1 / 60, -0.25,
      0, 0, 0, 1);
    const c = stage.camera;
    c.position.set(0, 0, 0); c.quaternion.identity(); c.updateMatrixWorld(true);
    c.projectionMatrix.copy(proM); c.projectionMatrixInverse.copy(proM).invert();
  }

  // The sun's shadow box follows what the screen shows (so the map's resolution is spent where the player looks).
  const key = stage.lights && stage.lights.key;
  if (key) { stage._shadowOffset.set(-13, 24, 15); key.shadow.camera.near = 1; key.shadow.camera.far = 90; key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03; }
  function fitShadow(cam, rect, land) {
    if (!(stage.renderer.shadowMap.enabled && key)) return;
    const mx = rect.x + rect.w / 2, my = rect.y + rect.h / 2;
    const g = unprojCam(cam, mx, my);
    const halfX = rect.w / (2 * cam.s), halfY = rect.h / (2 * cam.s * cam.k);
    const R = Math.min(48, Math.hypot(halfX, halfY) * 0.95 + 3);
    const sc = key.shadow.camera;
    if (Math.abs(sc.right - R) > 0.5) { sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.updateProjectionMatrix(); }
    toThree(land, g.x, g.y, 0, v3);
    stage.setShadowTarget(Math.round(v3.x * 2) / 2, 0, Math.round(v3.z * 2) / 2);   // snapped to half metres: no shimmer as the camera follows
  }

  // ---- people ------------------------------------------------------------------------------------------------------
  const v3 = new THREE.Vector3();
  function place(a, cam, x, y, dt, snap) {
    // Track the sim position exactly (the sim is continuous); only a discontinuity (mode / camera change) is chased at a limited speed.
    // a.vx / a.vy / a.spd = the velocity of the DISPLAYED body, smoothed: that is what the legs are driven from.
    if (snap || a.x === null) { a.x = x; a.y = y; a.vx = 0; a.vy = 0; a.spd = 0; }
    else {
      const dx = x - a.x, dy = y - a.y, d = Math.hypot(dx, dy);
      if (d > 7) { a.x = x; a.y = y; a.vx = 0; a.vy = 0; }
      else {
        const maxStep = 9.5 * Math.max(dt, 1 / 120), k = d > maxStep ? maxStep / d : 1;
        const nx = a.x + dx * k, ny = a.y + dy * k;
        if (dt > 1e-4) { const f = 1 - Math.exp(-dt * 9); a.vx += ((nx - a.x) / dt - a.vx) * f; a.vy += ((ny - a.y) / dt - a.vy) * f; }
        a.x = nx; a.y = ny;
      }
      a.spd = Math.hypot(a.vx, a.vy);
    }
    toThree(cam.land, a.x, a.y, 0, v3);
    a.h.setPosition(v3.x, 0, v3.z);
  }
  // Facing is a critically damped spring on the yaw with a turn-rate cap (people ease into a turn and ease out of it); the human's own
  // turn limiter is off so nothing snaps. face() only sets the target; stepYaw() advances it once per frame.
  function face(a, cam, dx, dy, snap = false) {
    if (dx * dx + dy * dy < 1e-6) return;
    const [X, Z] = dirThree(cam.land, dx, dy);
    a.yawT = Math.atan2(X, Z);
    if (snap || a.yaw === undefined) { a.yaw = a.yawT; a.yawV = 0; }
  }
  function stepYaw(a, dt) {
    if (a.yaw === undefined) return;
    const mv = (a.spd || 0) > 1;
    const w = mv ? 17 : 8, vmax = mv ? 12 : 6.5;      // a figure that is travelling lines up with its heading quickly; a standing turn is gentler
    let e = a.yawT - a.yaw; e = Math.atan2(Math.sin(e), Math.cos(e));
    const steps = Math.max(1, Math.ceil(dt / 0.008)), h = dt / steps;
    for (let k = 0; k < steps; k++) {
      a.yawV += (w * w * e - 2 * w * a.yawV) * h;
      a.yawV = clamp(a.yawV, -vmax, vmax);
      const d = a.yawV * h; a.yaw += d; e -= d;
    }
    a.h.turnRate = 0;
    a.h.setFacing(a.yaw, { snap: true });
  }
  const setKey = (a, key) => { if (a.key === key) return false; a.key = key; a.h._pending = null; return true; };   // a delayed playTimed from the old state must not fire in the new one

  // Gait choice by the speed the body really covers (clip m/s in unscaled units): walk / jog / sprint with hysteresis, each played at
  // speed / nominal so stride length matches the ground. Crossfades are phase aligned on the foot events.
  const GAITS = [['walk', 1.4, 0.45, 2.7], ['jog', 4.0, 2.3, 6.2], ['sprint', 7.0, 5.6, 99]];   // name, nominal, enter, leave-above
  function loco(a, speed) {
    const h = a.h;
    let g = a.gait;
    if (!g || !h.clips[g]) g = a.gait = 'walk';
    const cur = GAITS.find((x) => x[0] === g);
    let want = g;
    if (speed > cur[3] || speed < cur[2] - 0.15) {
      want = GAITS[0][0];
      for (const x of GAITS) if (speed >= x[2] && h.clips[x[0]]) want = x[0];
    }
    a.gait = want;
    const info = GAITS.find((x) => x[0] === want), tr0 = h.layers.base.current;
    if (!tr0 || tr0.clip.name !== want || tr0.target === 0) {
      const opts = { fade: 0.25, loop: true };
      if (tr0 && tr0.clip.loop && tr0.clip.events.footL !== undefined && h.clips[want].events.footL !== undefined) {
        const A = tr0.clip, B = h.clips[want];
        const ph = (((tr0.time - A.events.footL) / A.dur) % 1 + 1) % 1;
        opts.startTime = (B.events.footL + ph * B.dur) % B.dur;
      }
      h.play(want, opts);
    }
    const t = h.layers.base.current;
    const nominal = (h.clips[want].speed > 0 ? h.clips[want].speed : info[1]);
    t.speed = clamp(speed / nominal, 0.55, 1.6);
    return want;
  }

  // a short per-actor phase so a line of idle fielders is never in step
  const idle = (a, name, snap) => {
    const cur = a.h.current;
    if (!cur || cur.clip.name !== name || cur.target === 0) a.h.play(name, { fade: snap ? 0 : 0.25, loop: true, startPhase: a.seed });
  };

  function resetAll() {
    for (const a of actors) {
      a.filter.reset(); a.yaw = undefined; a.x = null; a.key = ''; a.h._pending = null; a.h.play('idle', { fade: 0 }); a.h.setPropTarget && a.h.setPropTarget(a.paddle || {}, [0, 0, 0], null); }
    D.swingFor = null; D.resets = (D.resets || 0) + 1;
  }

  // ---- one frame --------------------------------------------------------------------------------------------------------
  D.frame = (state, req, dt, c2d, kcss) => {
    const { S, cam } = req, land = cam.land;
    let snap = false;
    if (S !== D.S) { D.S = S; resetAll(); snap = true; }
    const camKey = `${land ? 1 : 0}`;
    if (camKey !== D.lastCamKey) { D.lastCamKey = camKey; snap = true; }
    setProjection(cam);
    if (green.land !== land) green.setLand(land);
    fitShadow(cam, req.rect, land);
    if (green.dressing) green.dressing.visible = cam.s > 32;      // kit, rug, scorers' table and roller read as clutter on the wide view
    const sc = clamp(48 / (1.75 * cam.s), 1, 2.6);          // keep people readable on the wide field view
    D.sc = sc;
    const inField = req.field && S.F;
    const F = S.F;
    const pxH = 1.75 * cam.s * sc * kcss;                   // css px of a person's height, for the level of detail
    GL.hand = null; GL.handFor = null; D.heldBy = null;

    // visibility: skip people outside the stage rectangle (cheap) -----------------------------------------------------------
    const r = req.rect, mg = 60;
    const onStage = (x, y) => { const [sx, sy] = proj(cam, x, y, 0); return sx > r.x - mg && sx < r.x + r.w + mg && sy > r.y - mg && sy < r.y + r.h + mg + 40; };

    if (!inField) {
      // ---- the pitch view ----------------------------------------------------------------------------------------------
      const set = fieldersOf(S);
      const bowl = cast.bowler, bx = set[0].x, by = M.BOWL_Y - 0.3;
      place(bowl, cam, bx, by, dt, snap); face(bowl, cam, 0, -1, snap);
      bowl.h.root.visible = true;
      const rate = S.humanBat ? WIND : WIND_H;
      if (S.phase === 'ready' && S.windT > 0) {
        const eta = Math.max(0, (1 - S.windT) * rate);
        if (setKey(bowl, 'toss')) { bowl.h.playTimed('toss_underarm', 'release', eta, { fade: 0.2, frameDt: dt }); bowl.rel = false; }
        else bowl.h.timeWarpTo('release', eta);
      } else if (S.phase === 'ready') {
        if (setKey(bowl, 'idle')) idle(bowl, 'idle_relaxed', snap);
      } else if (S.phase === 'flight' || S.phase === 'settle') {
        // the throw-through finishes by itself; then stand
        if (bowl.key !== 'toss' && setKey(bowl, 'stand')) idle(bowl, 'idle_relaxed', snap);
      }
      if (bowl.key === 'toss' && S.phase === 'ready' && S.windT === 0) bowl.key = '';   // a new ball: back to the stance
      // the ball sits in the bowler's right hand until it is let go
      D.heldBy = S.phase === 'ready' ? bowl : null;
      // the field
      for (let i = 1; i <= 8; i++) {
        const a = cast.fielders[i - 1], p = set[i];
        a.h.root.visible = onStage(p.x, p.y);
        place(a, cam, p.x, p.y, dt, snap);
        if (a.spd > (a.key === 'run' ? 0.35 : 0.7)) {
          face(a, cam, a.vx, a.vy, snap);
          if (a.key !== 'run') { a.key = 'run'; a.h._pending = null; }
          loco(a, a.spd / sc);
        } else {
          face(a, cam, 0 - p.x, M.STRIKE_Y - p.y, snap);
          if (setKey(a, 'ready')) idle(a, Math.hypot(p.x, p.y - 2) < 9 ? 'field_ready' : 'idle_relaxed', snap);
        }
        applyLOD(a, pxH);
      }
      // the striker: stands side-on at the ring's x, the paddle held out in front at the ring
      const st = cast.bats[0], ns = cast.bats[1];
      const sx = clamp(S.paddleX, -1.4, 1.4) - 0.5, sy = M.STRIKE_Y - 0.5;
      place(st, cam, sx, sy, dt, snap);
      st.h.root.visible = true;
      face(st, cam, 1, 0, snap);                      // side-on to the bowler: chest towards +x, left shoulder to the bowler
      st.paddle.visible = true;
      const human = S.humanBat && !S.auto;
      const ringAt = { x: S.paddleX, y: M.STRIKE_Y, z: 0.9 };
      if (!S.swing) {
        toThree(land, ringAt.x, ringAt.y, ringAt.z, v3);
        if (setKey(st, S.phase === 'flight' ? 'wait' : 'stance')) st.h.play('bat_stance', { fade: 0.2, loop: true });
        st.h.setPropTarget(st.paddle, [0, st.paddle.userData.sweet, 0], v3, { weight: 1 });
        D.swingFor = null;
      } else if (D.swingFor !== S.swing) {
        D.swingFor = S.swing;
        const kind = S.swing.type, clip = kind === 'block' ? 'bat_block' : kind === 'lift' ? 'bat_pull' : 'bat_drive';
        const P0 = S.path, tc = clamp(S.swing.t, 0, P0 ? P0.T : 1);
        const b = P0 ? M.ballAt(P0, tc) : { x: S.paddleX, y: M.STRIKE_Y, z: 0.9 };
        toThree(land, b.x, b.y, b.z, v3);
        st.h.setTarget('contact', v3);
        st.h.setPropTarget(st.paddle, [0, 0, 0], null);
        const eta = Math.max(0.001, S.swing.t - S.tf);
        st.key = 'swing';
        st.h.playTimed(clip, 'contact', eta, { fade: 0.06, frameDt: dt });
      }
      void human;
      applyLOD(st, pxH);
      // the other batter waits at the far board
      place(ns, cam, 0.55, M.END_Y[1] + 0.2, dt, true);
      ns.h.root.visible = onStage(0.55, M.END_Y[1]);
      face(ns, cam, -0.2, -1, snap);
      ns.paddle.visible = true;
      if (setKey(ns, 'wait')) ns.h.play('idle_relaxed', { fade: 0.2, loop: true, startPhase: ns.seed });
      applyLOD(ns, pxH);
      applyLOD(bowl, pxH);
    } else {
      // ---- the field view ----------------------------------------------------------------------------------------------
      const ball = F.ball, over = F.over, o = F.outcome;
      const wicket = over && o && o.wicket, cheerB = over && o && !o.wicket && o.runs >= 4;
      for (let i = 0; i < 9; i++) {
        const f = F.fielders[i], a = i === 0 ? cast.bowler : cast.fielders[i - 1];
        a.h.root.visible = true;
        place(a, cam, f.x, f.y, dt, snap);
        const sp = Math.hypot(f.vx, f.vy), holding = ball.held === f.id;
        const cur = a.h.current;
        const oneShot = (a.key === 'throw' || a.key === 'catch') && cur && cur.target > 0 && cur.time < (cur.clip.dur || 1) - 0.04;
        if (holding && !over && F.run.moving) {
          // gather and throw: the release lands on the sim's throw
          const bd = Math.hypot(f.x, f.y) <= Math.hypot(f.x, f.y - M.PITCH) ? 0 : M.PITCH;
          face(a, cam, 0 - f.x, bd - f.y, false);
          if (setKey(a, 'throw')) a.h.playTimed('throw_overarm', 'release', Math.max(0.03, 0.18 - f.hold), { fade: 0.08, frameDt: dt });
        } else if (holding && over && o && o.kind === 'caught' && o.by === f.id) {
          if (setKey(a, 'catch')) { toThree(land, ball.x, ball.y, Math.max(0.9, ball.z), v3); a.h.setTarget('catch', v3); a.h.playTimed('catch_two_hand', 'catch', 0.02, { fade: 0.05, frameDt: dt }); }
        } else if (oneShot) {
          /* let the throw / catch finish */
        } else if (wicket) {
          if (setKey(a, 'cheer')) a.h.play('cheer', { fade: 0.2, loop: true, startPhase: a.seed });
        } else if (a.spd > (a.key === 'run' ? 0.35 : 0.7) && sp > 0.2) {
          // the legs follow the DISPLAYED speed (distance really covered), the body turns to the way it is really going
          face(a, cam, a.vx, a.vy, false);
          if (a.key !== 'run') { a.key = 'run'; a.h._pending = null; }
          loco(a, a.spd / sc);
        } else {
          if (setKey(a, 'ready')) idle(a, 'field_ready', false);
          face(a, cam, ball.x - f.x, ball.y - f.y, false);
        }
        applyLOD(a, pxH);
      }
      // the batters
      F.bats.forEach((b, i) => {
        const a = cast.bats[i], R = F.run;
        const frac = R.moving || R.frac > 0 ? R.frac : 0;
        const y = M.batY(b, frac), x = i === 0 ? -0.55 : 0.55;
        a.h.root.visible = true;
        place(a, cam, x, y, dt, snap);
        a.paddle.visible = !cheerB;
        a.h.setPropTarget(a.paddle, [0, 0, 0], null);
        const dirY = (R.dir > 0 ? (b.end === 0 ? 1 : -1) : (b.end === 0 ? -1 : 1));
        if (R.moving) {
          face(a, cam, a.spd > 0.7 ? a.vx : 0, a.spd > 0.7 ? a.vy : dirY, false);
          a.key = 'brun';
          if (a.spd > 0.4) loco(a, a.spd / sc); else idle(a, 'idle_relaxed', false);   // legs only move when the body really travels
        } else if (cheerB) {
          if (setKey(a, 'cheer')) a.h.play('cheer', { fade: 0.2, loop: true, startPhase: a.seed });
        } else if (a.key === 'swing' && a.h.current && a.h.current.time < (a.h.current.clip.dur || 1) - 0.05 && a.h.current.target > 0) {
          /* finish the stroke */
        } else {
          face(a, cam, 0, b.end === 0 ? 1 : -1, false);
          if (setKey(a, 'bready')) a.h.play('idle_relaxed', { fade: 0.2, loop: true, startPhase: a.seed });
        }
        applyLOD(a, pxH);
      });
    }

    // scale + boards ---------------------------------------------------------------------------------------------------
    for (const a of actors) a.h.root.scale.setScalar(sc);
    const fall = S.boardFall || 0;
    boards.forEach((bd, i) => {
      toThree(land, 0, i === 0 ? 0 : M.PITCH, 0, v3);
      // each board faces the other end of the pitch
      const [fx, fz] = dirThree(land, 0, i === 0 ? 1 : -1);
      bd.root.rotation.y = Math.atan2(fx, fz);
      bd.setFall(i === 0 ? fall : 0, v3.x, v3.z, sc, dt);
    });

    // events the picture reacts to (read from the sim state, never written back) ---------------------------------------------
    events(S, F, land, sc);

    // order: advance the people FIRST, then read the posed hand for the ball, then draw (props follow the posed bones)
    for (const a of actors) stepYaw(a, dt);
    stage.update(dt, { renderNow: false });
    for (const a of actors) if (a.h.root.visible) { a.filter.apply(dt); if (a.h.limbSanity) a.h.limbSanity(); a.h.root.updateMatrixWorld(true); }
    ballAndShadows(S, F, cam, land, sc, dt, inField);
    green.update(D.clock += dt, dt, { pxPerM: cam.s * kcss, vh: P.size.h, aspect: P.size.w / Math.max(1, P.size.h) });
    if (P.probe) probeFrame(dt, S);
    stage.render();
  };

  // ---- reactions: crowd, bell, dust, clippings, board ring ------------------------------------------------------------------
  D.clock = 0;
  function events(S, F, land, sc) {
    const res = S.res;
    if (res && res !== D.prevRes) {
      D.prevRes = res;
      if (res.kind === 'hit' && res.ball) {
        const b = res.ball;
        green.puff('grass', b.x, b.y, Math.max(0.05, b.z), 6, 0, 0, 1);
        green.puff('dust', S.paddleX, M.STRIKE_Y, 0.05, 2, 0, 0, 0.6);
        boards[0].strike(0.5);
      }
    }
    if (S.boardFall > 0 && !D.boardHit) { D.boardHit = true; green.puff('grass', 0, 0.1, 0.2, 8, 0, 0, 1); green.puff('dust', 0, 0.1, 0.05, 4, 0, 0, 1); green.react('gasp', 0.8); }
    if (!(S.boardFall > 0)) D.boardHit = false;
    if (S.phase === 'break' && D.prevPhase !== 'break') { green.ringBell(); green.react('cheer', 0.5); }
    if (S.phase === 'done' && D.prevPhase !== 'done') { green.ringBell(); green.react('ovation', 1); }
    D.prevPhase = S.phase;
    if (F && F.over && F.outcome && F.outcome !== D.prevOutcome) {
      D.prevOutcome = F.outcome;
      const o = F.outcome;
      if (o.wicket) green.react('gasp', 1); else if (o.runs >= 6) green.react('ovation', 1); else if (o.runs >= 4) { green.react('cheer', 1); green.puff('grass', F.ball.x, F.ball.y, 0.05, 6, 0, 0, 1); } else if (o.runs > 0) green.react('cheer', 0.35);
    }
    if (!F || !F.over) D.prevOutcome = null;
    void land; void sc;
  }
  function ballAndShadows(S, F, cam, land, sc, dt, inField) {
    // the ball: real size (scaled with the people on the wide view), spinning with its speed, over a soft shadow
    const gb = GL.ball;
    let bp = null;
    if (gb) {
      bp = gb;
      if (!inField && S.phase === 'ready' && D.heldBy) { const p = V.palmPoint(D.heldBy.h, 'R'); const q = fromThree(land, p); bp = { x: q.x, y: q.y, z: q.z + 0.03 }; GL.hand = { x: bp.x, y: bp.y, z: bp.z }; GL.handFor = S; }
    }
    if (bp) {
      toThree(land, bp.x, bp.y, bp.z, v3);
      const b3 = D.ball3; b3.visible = true; b3.position.copy(v3); b3.scale.setScalar(sc);
      if (D.ballLast) {
        const dx = bp.x - D.ballLast.x, dy = bp.y - D.ballLast.y, dz = bp.z - D.ballLast.z, sp = Math.hypot(dx, dy, dz);
        if (sp < 3 && sp > 1e-6) { b3.rotation.x -= (dy * (land ? 0 : 1) + dx * (land ? 1 : 0)) / (0.036 * sc) * 0.9; b3.rotation.z += (land ? dy : -dx) / (0.036 * sc) * 0.9 * 0; }
        // a bounce on the grass kicks a puff of clippings
        if (D.ballLast.z > 0.06 && bp.z <= 0.06 && sp > 0.12 && Math.abs(bp.y) < 60) green.puff('grass', bp.x, bp.y, 0.02, 3, dx / Math.max(dt, 0.001), dy / Math.max(dt, 0.001), 0.8);
      }
      D.ballLast = { x: bp.x, y: bp.y, z: bp.z };
    } else { D.ball3.visible = false; D.ballLast = null; }
    // soft shadows, offset away from the sun (to the right and slightly up the screen), grow with height
    let n = 0;
    const off = 0.34, offz = 0.3, real = green.shadowsOn;
    if (!real) for (const a of actors) {
      if (!a.h.root.visible || a.x === null) continue;
      toThree(land, a.x, a.y, 0, v3);
      blobs.set(n++, v3.x + off * sc * 0.6, v3.z - offz * sc * 0.6, 0.3 * sc);
    }
    if (bp) { toThree(land, bp.x, bp.y, 0, v3); const h = Math.max(0, bp.z); blobs.set(n++, v3.x + 0.65 * h * sc, v3.z - 0.55 * h * sc, (0.07 + h * 0.012) * sc * 1.6); }
    if (!real) for (let i = 0; i < 2; i++) { toThree(land, 0, i === 0 ? 0 : M.PITCH, 0, v3); if (n < 16) blobs.set(n++, v3.x + 0.5 * sc, v3.z - 0.3 * sc, 0.3 * sc); }
    blobs.mesh.count = n; blobs.mesh.instanceMatrix.needsUpdate = true;
    // dust kicked by the runners' footfalls
    for (const a of actors) {
      if (!a.h.root.visible || a.spd < 2.2) { a.stepT = 0; continue; }
      a.stepT = (a.stepT || 0) + dt * a.spd / (1.5 * sc);   // a footfall every ~1.5 m of real travel (scaled)
      if (a.stepT >= 1) { a.stepT -= 1; green.puff('dust', a.x - a.vx * 0.05, a.y - a.vy * 0.05, 0.03, 2, -a.vx * 0.2, -a.vy * 0.2, Math.min(1.4, a.spd / 4)); }
    }
  }

  // ---- motion probe (dev): per frame joint orientations and key positions of every visible figure --------------------------------
  const PROBE_J = ['Pelvis', 'Spine1', 'Neck', 'Head', 'L_UpperArm', 'R_UpperArm', 'L_Forearm', 'R_Forearm', 'L_Thigh', 'R_Thigh', 'L_Calf', 'R_Calf', 'L_Foot', 'R_Foot'];
  const PROBE_P = ['Pelvis', 'Head', 'L_Hand', 'R_Hand', 'L_Foot', 'R_Foot'];
  const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
  function probeFrame(dt, S) {
    actors.forEach((a, i) => {
      if (!a.h.root.visible) return;
      const q = {}, p = {};
      for (const j of PROBE_J) { const b = a.h.bones[`Bip01_${j}`]; if (!b) continue; b.getWorldQuaternion(_q); q[j] = [_q.x, _q.y, _q.z, _q.w]; }
      for (const j of PROBE_P) { const b = a.h.bones[`Bip01_${j}`]; if (!b) continue; b.getWorldPosition(_v); p[j] = [_v.x, _v.y, _v.z]; }
      const cur = a.h.current;
      let grip = null;
      if (a.paddle && a.paddle.visible) { _v.set(0, 0.14, 0); a.paddle.localToWorld(_v); grip = [_v.x, _v.y, _v.z]; }
      P.probe.push({ grip, id: i, dt, t: D.clock, who: a.key, q, p, root: [a.h.root.position.x, a.h.root.position.z], clip: cur ? cur.clip.name : '', sim: [a.x, a.y], spd: a.spd || 0, rs: D.resets || 0, cam: D.lastCamKey, yaw: a.h.root.rotation.y, scale: a.h.root.scale.x });
    });
  }

  D.cast = cast;
  P.dir = D;
  return D;
}

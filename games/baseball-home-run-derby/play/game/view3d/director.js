// The director: builds the 3D set and cast, then each frame reads the sim state (round r) and poses everybody, places the ball, the tracer and
// the blob shadows, and moves the camera. Reads only; never writes to the sim.
import { THREE } from '../vendor3d/index.js';
import { PARKS, PITCH_Z, MOUND_H, clamp, lerp, PITCHES, DEG } from '../src/core.js';
import { WINDUP_T, ballNow } from '../src/engine.js';
import { cameraFor, titleCam } from '../src/cam.js';
import { pitchPos, LEAD } from '../src/ball.js';
import { World, toWorld, V3 } from './world.js';
import { makeActor, equipBat, dress, lookOfBatter, lookOfPitcher, show } from './cast.js';
import { buildBall } from './gear.js';
import { batterPose, PIVOT } from './batter.js';
import { pitcherPose, pitcherArms } from './pitcher.js';
import { quatFromBasis } from './rig.js';
import { ramp, norm } from './util3.js';

const BALL_SCALE = 2.4;     // the ball is drawn bigger than life so it can be seen from 18 m on a phone

export function createDirector(P) {
  const { stage } = P;
  const worlds = new Map();
  let cur = null, batter = null, pitcher = null, ball = null, trail = [], glowTex = null;
  const tmp = new V3();
  const skyFog = {};
  let lastLook = '';

  async function init() {
    const bl = lookOfBatter({ trim: '#ffcf4a', skin: 'tan', hair: 'brown', hand: 1 });
    batter = await makeActor(stage, 'batter', bl, P.quality);
    pitcher = await makeActor(stage, 'pitcher', lookOfPitcher(), P.quality);
    ball = buildBall(BALL_SCALE); ball.visible = false; stage.scene.add(ball);
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,245,215,0.6)'); gr.addColorStop(1, 'rgba(255,235,180,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace;
    for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; stage.scene.add(s); trail.push(s); }
    ballGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.7 })); ballGlow.visible = false; stage.scene.add(ballGlow);
    batter.h.root.visible = false;
  }
  let ballGlow = null;

  function ensureWorld(parkKey) {
    let w = worlds.get(parkKey);
    if (!w) { w = new World(stage, parkKey); w.group.visible = false; worlds.set(parkKey, w); }
    if (cur !== w) {
      if (cur) cur.group.visible = false;
      cur = w; w.group.visible = true;
      const L = PARKS[parkKey];
      stage.setLighting(L.light);
      stage.scene.fog = new THREE.Fog(new THREE.Color(L.sky[2]), 260, 700);
      stage.scene.background = new THREE.Color(L.sky[0]);
      stage._shadowOffset.set(-5, 9, 5);
    }
    return w;
  }

  // ---- poses ---------------------------------------------------------------------------------------------------------------------------------------
  function driveBatter(r, world, idleT) {
    const hand = r.batter.hand;
    const look = lookOfBatter(r.batter);
    dress(batter, look);
    const want = hand > 0 ? 'R' : 'L';
    if (batter.batSide !== want) equipBat(batter, want);
    show(batter, true);
    const sw = r.sw;
    let ft = -1, afterT = 0;
    if (r.phase === 'pitch') ft = r.pt;
    else if (r.phase === 'flight') ft = (sw ? sw.tc : r.pitch.T) + r.ft;
    else if (r.phase === 'result') ft = (sw ? sw.tc : r.pitch.T) + (r.res && r.res.kind === 'ball' ? (r.ftEnd ?? 0) : 0) + r.pt;
    else if (r.phase === 'end') ft = (sw ? sw.tc : r.pitch.T) + 4;
    const resting = r.phase === 'ready' || r.phase === 'windup';
    // the contact point (world) the bat must reach; for a miss the bat passes in front of or behind the ball
    let N = new V3(0, 0.8, 0);
    if (sw) {
      const bp = sw.bp;
      let zs = bp[2];
      if (sw.res.kind === 'whiff') zs += (sw.res.dt < 0 ? 0.45 : -0.45);
      N = toWorld(bp[0], bp[1], zs);
    } else { const p0 = pitchPos(r.pitch, r.pitch.T, [0, 0, 0]); N = toWorld(p0[0], p0[1], p0[2]); }
    const b = ballNow(r);
    const ballW = b ? toWorld(b[0], b[1], b[2]) : null;
    const ctx = {
      hand, ft: resting ? -1 : ft, T: r.pitch.T, idleT, sw: sw ? { ts: sw.ts, tc: sw.tc, dt: sw.res.dt, loft: sw.aim.loft, kind: sw.res.kind } : null, N, ball: ballW, batProp: batter.bat,
      after: r.phase === 'flight' || r.phase === 'result' ? { t: ft, hr: !!(r.fly && r.fly.hr), look: ballW } : null,
    };
    if (batter.h._hold) batter.h._hold.weight = 1;
    const out = batterPose(ctx, batter.rig, {});
    batter.rig.setBase([{ clip: 'ready_stance', time: idleT % 2.7, w: 1 }]);
    batter.rig.solve(out.spec);
    batter.h._twoHand();
    batter.rig.limitWrists();
    batter.h.root.updateMatrixWorld(true);
    batter.last = out;
  }

  function drivePitcher(r, world, idleT) {
    show(pitcher, true);
    const rig = pitcher.rig, h = pitcher.h;
    const p = r.pitch;
    const relW = toWorld(p.R.x, p.R.y, p.R.z);
    let tau;
    if (r.phase === 'ready') tau = -WINDUP_T - 0.3;
    else if (r.phase === 'windup') tau = r.pt - WINDUP_T;
    else if (r.phase === 'pitch') tau = r.pt;
    else if (r.phase === 'flight') tau = (r.sw ? r.sw.tc : p.T) + r.ft;
    else tau = (r.sw ? r.sw.tc : p.T) + (r.ftEnd ?? 0) + r.pt;
    const ctx = { tau, rel: relW, mound: MOUND_H, z0: -PITCH_Z };
    const pp = pitcherPose(ctx, rig, {});
    pp.spec.arms = (rg, sp) => pitcherArms(ctx, rg, { ...pp, spec: sp }).spec.hands;
    const standing = tau <= -WINDUP_T;
    rig.setBase([{ clip: standing ? 'idle' : 'idle_relaxed', time: idleT % 2.7, w: 1 }]);
    rig.solve(pp.spec);
    h.root.updateMatrixWorld(true);
    pitcher.holdBall = tau < -0.003;
    pitcher.last = pp;
  }

  function ballHandPos(a) {
    const hb = a.h.bones.Bip01_R_Hand, fr = a.h.fingers.R;
    const local = fr.knuckle.clone().multiplyScalar(0.45).addScaledVector(fr.palmDir, 0.038);
    return local.applyMatrix4(hb.matrixWorld);
  }

  function placeBall(r, world, t) {
    const b = ballNow(r);
    let pos = null;
    if (b) {
      pos = toWorld(b[0], b[1], b[2]);
      // the last 0.1 s before contact the ball is guided onto the bat's sweet spot (only matters for mistimed contact)
      if (r.phase === 'pitch' && r.sw && r.sw.res.kind === 'hit') {
        const tc = r.sw.tc, w = ramp(r.pt, tc - 0.10, tc), raw = pitchPos(r.pitch, tc, [0, 0, 0]);
        const bp = r.sw.bp;
        pos.x += (bp[0] - raw[0]) * w * 0; pos.y += (bp[1] - raw[1]) * w; pos.z -= (bp[2] - raw[2]) * w;
        const cur0 = pitchPos(r.pitch, r.pt, [0, 0, 0]);
        pos.copy(toWorld(cur0[0] + (bp[0] - raw[0]) * w, cur0[1] + (bp[1] - raw[1]) * w, cur0[2] + (bp[2] - raw[2]) * w));
      }
    } else if ((r.phase === 'ready' || r.phase === 'windup' || (r.phase === 'pitch' && false)) && pitcher.holdBall) pos = ballHandPos(pitcher);
    else if (r.phase === 'windup') pos = null;
    if (!pos) { ball.visible = false; ballGlow.visible = false; trail.forEach((s) => { s.visible = false; }); return null; }
    ball.visible = true; ball.position.copy(pos); ball.rotation.set(t * 18, t * 6, t * 11);
    const live = r.phase === 'pitch' || r.phase === 'flight';
    const dist = Math.hypot(pos.x - P.cam.position.x, pos.y - P.cam.position.y, pos.z - P.cam.position.z);
    const s = live ? clamp(dist / 14, 1, 7) : 1;                       // far away it grows so it stays visible
    ball.scale.setScalar(s);
    ballGlow.visible = live; ballGlow.position.copy(pos); ballGlow.scale.setScalar(Math.max(0.5, 0.18 * dist * 0.4));
    ballGlow.material.opacity = 0.55;
    // tracer: the last positions (kept by the director only for drawing)
    if (live) {
      trail.unshift(trail.pop()); const s0 = trail[0]; s0.visible = true; s0.position.copy(pos); s0.material.opacity = 0.5; s0.scale.setScalar(Math.max(0.3, dist * 0.028));
      for (let i = 1; i < trail.length; i++) { const q = trail[i]; if (!q.visible) continue; q.material.opacity = Math.max(0, q.material.opacity - 0.06); q.scale.multiplyScalar(0.94); if (q.material.opacity <= 0.02) q.visible = false; }
    } else trail.forEach((q) => { q.visible = false; });
    return pos;
  }

  function placeBlobs(world, ballPos) {
    if (pitcher.h.root.visible) { const p = pitcher.h.root.position; world.setBlob(0, p.x + 0.4, p.z - 0.3, 0.8, 0.9); } else world.setBlob(0, 0, 0, 0, 0);
    if (ballPos && ball.visible) { const hgt = Math.max(0, ballPos.y); world.setBlob(1, ballPos.x, ballPos.z, 0.16 + 0.12 * ball.scale.x * 0.5, clamp(1 - hgt / 40, 0.25, 0.9)); } else world.setBlob(1, 0, 0, 0, 0);
    world.setBlob(2, 0, 0, 0, 0); world.setBlob(3, 0, 0, 0, 0);
  }

  // ---- camera ---------------------------------------------------------------------------------------------------------------------------------------
  function setCamera(c) {
    const cam = P.cam;
    toWorld(c.pos[0], c.pos[1], c.pos[2], tmp); cam.position.copy(tmp);
    toWorld(c.look[0], c.look[1], c.look[2], tmp); cam.lookAt(tmp);
    cam.fov = c.fov; cam.aspect = P.cssW / Math.max(1, P.cssH); cam.near = 0.2; cam.far = 1200;
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  }

  function frame(state, mode) {
    const idleT = state.t;
    const live = (state.scene === 'play' || state.scene === 'auto') && state.r;
    const parkKey = live ? state.r.park : state.setup && state.scene === 'setup' ? state.setup.park : state.prefs.park;
    const world = ensureWorld(parkKey);
    const aspect = P.cssW / Math.max(1, P.cssH);
    let r = state.r;
    let camPose;
    if (live) camPose = cameraFor(r, aspect, r.batter.hand);
    else {
      camPose = titleCam(idleT, aspect, state.prefs.hand);
      // a stand-in round for the batter's stance in the menus
      r = P.menuRound(state);
    }
    P.info.cam = camPose;
    setCamera(camPose);
    driveBatter(r, world, idleT);
    drivePitcher(r, world, idleT);
    const bp = placeBall(r, world, idleT);
    placeBlobs(world, bp);
    world.setSpot(r.spot);
    world.setScoreboard(live ? r : null);
    world.update(idleT, state.v ? state.v.crowd : 0);
    stage.setShadowTarget(-0.7 * r.batter.hand, 0, 0.2);
    for (const a of [batter, pitcher]) if (a.h.root.visible) a.h.autoLOD(P.cam, P.cssH, stage.lodPolicy);
    stage.render();
  }

  return { init, frame, ensureWorld, resized() {}, get cur() { return cur; }, batter: () => batter, pitcher: () => pitcher, worlds };
}

// Pose evaluation for one act: builds the contact context (where the ball is, which way it leaves) from the sim's act and evaluates the technique.
// Shared by the presenter and by the Node-only contact checks (no renderer needed).
import { TECH, evalPose, BALL_R } from './skills.js';

const G = 9.81;

export function createPosing(THREE, getK) {
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const vec = (o) => V(o.x, o.y, o.z);
  const P = { get K() { return getK(); } };
  const HIT = { spike: 1, tip: 1, serveF: 1, serveJ: 1 };
  function ctxFor(sp, ac, pa, ballPos, s, tNow) {
    const K = P.K;
    const C = vec(ac.c);
    const vin = ac.vin ? vec(ac.vin) : V(0, -1, 0);
    const fl = s.ball.flight;
    const real = fl && Math.abs(fl.t0 - ac.tc) < 1e-6;
    const toX = ac.to ? ac.to.x : C.x, toZ = ac.to ? ac.to.z : C.z + (sp.team === 0 ? 5 : -5);
    const hx = toX - C.x, hz = toZ - C.z, hl = Math.hypot(hx, hz) || 1;
    const k = ac.tech;
    let est;
    if (k === 'spike' || k === 'tip' || k === 'serveJ' || k === 'serveF') {
      const spd = k === 'tip' ? 8 : k === 'serveF' ? 15 : 20;
      const T = Math.max(0.3, Math.hypot(hx, hz, C.y) / spd);
      est = V(hx / T, (BALL_R - C.y) / T + 0.5 * G * T, hz / T);
    } else if (k === 'block') {
      est = V(0, -3.5, (sp.team === 0 ? -1 : 1) * 3.5);
    } else {
      const T = ac.kind === 'set' ? 1.0 : 1.45;
      est = V(hx / T, (ac.kind === 'set' ? 2.8 - C.y : 1.1 - C.y) / T + 0.5 * G * T, hz / T);
    }
    let d = est.clone().normalize();
    if (real) { const v = V(fl.vx, fl.vy, fl.vz); if (v.lengthSq() > 1e-4) { const dr = v.clone().normalize(); const u = Math.min(1, Math.max(0, (tNow - ac.tc) / 0.07)); d = d.lerp(dr, u).normalize(); } }
    let n;
    if (HIT[k]) n = d.clone();
    else { n = d.clone().sub(vin.clone().normalize()); if (n.lengthSq() < 1e-4) n = d.clone(); n.normalize(); }
    if (k === 'block') n = ac.vin ? vin.clone().normalize().negate().add(V(0, 0.15, 0)).normalize() : V(0, 0.35, sp.team === 0 ? 0.94 : -0.94).normalize();
    return { m: 1, K, C, d, n, vin, yaw: pa.yaw, yawT: Math.atan2(hx, hz), hl };
  }

  function poseFor(sp, ac, pa, ballPos, tNow, s) {
    const ctx0 = ctxFor(sp, ac, pa, ballPos, s, tNow);
    const air = ac.air;
    const extra = { K: ctx0.K, cy: ac.c.y, ts: air ? air.ts - ac.tc : undefined, tl: air ? air.te - ac.tc : undefined, tr: ac.tr != null ? ac.tr - ac.tc : undefined, toss: ac.toss, shot: ac.shot, back: ac.back, over: ac.tech === 'dive' ? Math.max(0, Math.hypot(ac.c.x - sp.x, ac.c.z - sp.z) - 0.55) : ac.over, lunge: ac.stretch > 0.4 ? ac.stretch : 0 };
    const def = TECH[ac.tech](extra);
    const t = tNow - ac.tc;
    const pelvisBase = pa.a.b.pelvis.getWorldPosition(V());
    const ctx = { ...ctx0, ...extra, x: sp.x, z: sp.z, jy: sp.jy, pelvisBase, H0: pa.a.pelvisRest.y, lock: null, ground: 0, look: ballPos };
    return { pose: evalPose(def, ctx, t, pa.a), def, ctx, t, name: ac.tech };
  }

  return { poseFor, ctxFor };
}

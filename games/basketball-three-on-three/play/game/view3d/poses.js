// Basketball body language on top of the base locomotion clips, authored with the Actor's pelvis anchor, torso lean and two-bone IK:
// dribble (the hand follows the ball through carry, release, bounce and catch), gather and jump shot, layup, chest pass, catch,
// steal swipe, block / rebound jump, screen, defensive stance. The sim owns every time and position; hands are solved to the
// ball's displayed position so the palm meets it at the exact tick (palm correction loop below). Left / right: +x is the body's left.
import { THREE } from '../vendor3d/index.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const easeOut = (k) => { k = clamp(k, 0, 1); return 1 - (1 - k) * (1 - k); };
const D2R = Math.PI / 180;
const angDiff = (a, b) => { const d = a - b; return Math.atan2(Math.sin(d), Math.cos(d)); };
import { BR as BALL_R } from '../src/consts.js';   // the ball is simulated and drawn at toy scale (src/consts.js)
export { BALL_R };
const PALM = 0.085;                          // wrist -> palm centre along the forearm (x root scale)
const HAND_T = 0.012;                        // half hand thickness: the palm centre sits this far outside the ball surface

// palm centre of a hand (world), measured from the solved skeleton
export function palmOf(h, side) {
  const hand = h.bonePosition(`${side}_Hand`), fore = h.bonePosition(`${side}_Forearm`);
  return hand.clone().add(hand.clone().sub(fore).normalize().multiplyScalar(PALM * h.root.scale.y));
}

// arm target: a palm point in the world, solved for the wrist. pole: elbow direction in the body frame.
function palmTarget(A, side, palm, w, pole) {
  const sh = A.b[side].up.getWorldPosition(V());
  const dir = palm.clone().sub(sh).normalize();
  const wrist = palm.clone().addScaledVector(dir, -PALM * A.h.root.scale.y);
  return { p: [wrist.x, wrist.y, wrist.z], f: 'w', w, pole, pf: 'b', palm: palm.clone() };
}
const POLE_R = [-0.5, -1, -0.35], POLE_L = [0.5, -1, -0.35];
const poleOf = (side) => (side === 'R' ? POLE_R : POLE_L);

// Solve the pose; arms with a palm target are corrected twice so the palm lands on the point within a few millimetres.
export function applyPose(A, P) {
  A.snapshot();
  const sides = ['L', 'R'].filter((sd) => P.arms && P.arms[sd] && P.arms[sd].palm && P.arms[sd].w >= 0.5);
  A._run(P);
  A.out.iters = [];
  const best = {};
  const errOf = (sd) => P.arms[sd].palm.distanceTo(palmOf(A.h, sd));
  for (const sd of sides) best[sd] = { e: errOf(sd), p: P.arms[sd].p.slice() };
  for (let it = 0; it < (A.lite ? 1 : 4); it++) {
    let moved = false;
    for (const sd of sides) {
      const T = P.arms[sd], pal = palmOf(A.h, sd), e = T.palm.clone().sub(pal), len = e.length();
      A.out.iters.push([sd, it, +len.toFixed(3)]);
      if (len > 0.006) { const g = it < 2 ? 1 : 0.6; T.p = [T.p[0] + e.x * g, T.p[1] + e.y * g, T.p[2] + e.z * g]; moved = true; }
    }
    if (!moved) break;
    A.restore(); A._run(P);
    for (const sd of sides) { const e = errOf(sd); if (e < best[sd].e) best[sd] = { e, p: P.arms[sd].p.slice() }; }
  }
  // a hand that still misses the ball by more than 2 cm: try other elbow directions and keep the best
  if (!A.lite) {
    for (const sd of sides) {
      if (errOf(sd) <= 0.02) continue;
      const T = P.arms[sd], pole0 = T.pole.slice(), p00 = T.p.slice(); let bestE = errOf(sd), bestPole = pole0, bestP = T.p.slice();
      const sg = sd === 'L' ? 1 : -1;
      for (const alt of [[0.9 * sg, -0.5, -0.2], [0.25 * sg, -1, 0.3], [0.2 * sg, 0.3, -0.9], [1 * sg, 0.2, 0.2]]) {
        T.pole = alt; T.p = p00.slice();
        A.restore(); A._run(P);
        for (let it = 0; it < 3; it++) { const e = T.palm.clone().sub(palmOf(A.h, sd)); if (e.length() < 0.006) break; T.p = [T.p[0] + e.x, T.p[1] + e.y, T.p[2] + e.z]; A.restore(); A._run(P); }
        const er = errOf(sd);
        if (er < bestE) { bestE = er; bestPole = alt; bestP = T.p.slice(); }
        if (bestE <= 0.012) break;
      }
      T.pole = bestPole; T.p = bestP; A.restore(); A._run(P);
    }
  }
  // arms that are not on the ball keep out of the other players' bodies and arms (checked on the SOLVED pose, two passes)
  if (P.avoid && P.avoid.length && !A.lite) {
    const closest = (pt, a, b) => { const ab = b.clone().sub(a), t = clamp(pt.clone().sub(a).dot(ab) / Math.max(1e-6, ab.lengthSq()), 0, 1); return a.clone().addScaledVector(ab, t); };
    for (let pass = 0; pass < 1; pass++) {
      let changed = false;
      for (const sd of ['L', 'R']) {
        const T0 = P.arms && P.arms[sd];
        if (T0 && T0.palm && T0.w >= 0.5) continue;
        const sh = A.b[sd].up.getWorldPosition(V()), wr = A.h.bonePosition(`${sd}_Hand`).clone(), el = A.h.bonePosition(`${sd}_Forearm`).clone();
        const w = wr.clone();
        let moved = false;
        for (const [a, b, r] of P.avoid) {
          for (const [pt, f] of [[wr, 1], [el, 0.5]]) {
            const c = closest(pt, a, b), dv = pt.clone().sub(c); dv.y *= 0.4; const dl = dv.length();
            if (dl < r) { w.addScaledVector(dl > 1e-4 ? dv.multiplyScalar(1 / dl) : V(0, 0, 0), (r - dl) / f); moved = true; }
          }
        }
        if (moved) {
          const wl = w.clone().sub(sh), maxL = 0.62 * A.h.root.scale.y; if (wl.length() > maxL) w.copy(sh).addScaledVector(wl.normalize(), maxL);
          P.arms[sd] = { p: [w.x, w.y, w.z], f: 'w', w: 1, pole: sd === 'L' ? [0.5, -1, -0.35] : [-0.5, -1, -0.35], pf: 'b' };
          changed = true;
        }
      }
      if (!changed) break;
      A.restore(); A._run(P);
    }
  }
  // keep the best solution found (the fixed-point iteration can oscillate when the elbow swings)
  let again = false;
  for (const sd of sides) { if (errOf(sd) > best[sd].e + 1e-4) { P.arms[sd].p = best[sd].p; again = true; } }
  if (again) { A.restore(); A._run(P); }
  let worst = 0;
  for (const sd of sides) worst = Math.max(worst, errOf(sd));
  A.out.palmErr = worst;
  A.out.dbg = ['L', 'R'].map((side) => { const T = P.arms && P.arms[side]; if (!T) return null; const h = A.h.bonePosition(`${side}_Hand`); return { side, w: T.w, wristT: T.p.map((x) => +x.toFixed(2)), wristA: [h.x, h.y, h.z].map((x) => +x.toFixed(2)), palmT: T.palm && [T.palm.x, T.palm.y, T.palm.z].map((x) => +x.toFixed(2)), sh: A.b[side].up.getWorldPosition(V()).toArray().map((x) => +x.toFixed(2)) }; });
  return worst;
}

export function poseFor(P, s, sp, d, pa, D, dt, speed) {
  const H = pa.h, A = pa.a, id = sp.id;
  const act = sp.act, td = D.td, ball = D.b, sc = pa.sc;
  const B = s.ball;
  const holder = B.mode === 'held' ? s.players[B.holder] : null;
  const hasBall = holder && holder.id === id;
  const myOff = s.poss === sp.team;
  const defending = !myOff && B.mode === 'held' || (!myOff && (B.mode === 'pass'));
  const t = performance.now() / 1000;
  const T = pa.T || (pa.T = { dtAcc: 0 });
  // ---------------- body yaw: run in the direction of travel, twist the torso towards where the player is looking
  const vdir = Math.atan2(d.vx, d.vz);
  let target = d.face;
  if (act && (act.kind === 'shot' || act.kind === 'layup' || act.kind === 'pass')) target = d.face;
  else if (speed > 1.0) {
    const dl = angDiff(d.face, vdir);
    target = Math.abs(dl) > 1.75 ? d.face - Math.sign(dl) * 1.75 : vdir;
  }
  if (pa.byaw === undefined) pa.byaw = d.face;
  const dy0 = angDiff(target, pa.byaw);
  pa.byaw += clamp(dy0, -(act ? 34 : 14) * dt, (act ? 34 : 14) * dt);
  H.setFacing(pa.byaw);
  const twist = clamp(angDiff(d.face, pa.byaw), -1.25, 1.25);
  // ---------------- celebration after a basket: the scoring team cheers while the ball is dead
  const won = s.phase === 'over' && s.winner === sp.team, lost = s.phase === 'over' && s.winner >= 0 && s.winner !== sp.team;
  const cheer = won || (s.phase === 'dead' && s.last && s.last.kind === 'score' && s.last.team === sp.team && td - s.last.t < 1.7 && !act && speed < 1.2);
  if (cheer) {
    if (pa.state !== 'cheer') { H.crossfade(pa.i % 2 ? 'celebrate_2' : (won ? 'cheer' : 'celebrate'), 0.25); pa.state = 'cheer'; }
    H.setFingers('L', 'open'); H.setFingers('R', 'open');
    H.update(dt);
    pa.report = { kind: 'cheer' };
    return;
  }
  if (lost) {
    if (pa.state !== 'sad') { H.crossfade('idle_relaxed', 0.4); pa.state = 'sad'; }
    H.update(dt); pa.report = { kind: 'sad' }; return;
  }
  if (pa.state === 'cheer' || pa.state === 'sad') { pa.state = 'idle'; H.play('ready_stance', { fade: 0.3 }); }
  // ---------------- base animation
  const lowStance = defending || (sp.screenOn);
  const speedBase = speed;
  H.locomote(speedBase, { set: { idle: 'ready_stance' } });
  H.update(dt);
  // ---------------- animated reference (before any override)
  const pelvisBase = A.b.pelvis.getWorldPosition(V());
  const footAnim = { L: A.b.L.foot.getWorldPosition(V()), R: A.b.R.foot.getWorldPosition(V()) };
  const yaw = pa.byaw;
  const fwd = V(Math.sin(yaw), 0, Math.cos(yaw)), left = V(Math.cos(yaw), 0, -Math.sin(yaw));
  const aimF = V(Math.sin(d.face), 0, Math.cos(d.face));
  const ph = pa.phase;
  // ---------------- idle layer: breathing, weight shift, head
  const sway = Math.sin(t * 0.9 + ph * 6) * (1.2 + pa.seed * 1.2), sway2 = Math.sin(t * 0.55 + ph * 3) * 1.0;
  const P2 = { pelvis: pelvisBase.clone(), yaw, pitch: 0, roll: 0, groundY: 0, torso: { bend: Math.sin(t * 1.3 + ph) * 0.6, side: sway * (speed < 0.5 ? 1 : 0.3), twist: twist / D2R * 0.0 }, pelvisTilt: { bend: 0, side: 0, twist: 0 }, legs: { L: null, R: null }, arms: { L: null, R: null } };
  P2.torso.twist = (twist / D2R) * 0.85 + (pa.seed - 0.5) * 8 * (speed < 0.5 ? 1 : 0.3);   // per-player seeded posture so no two stand alike
  P2.pelvisTilt.twist = (twist / D2R) * 0.15;
  let dy = 0, lookAt = null, lookW = 0.75, fingers = { L: 'auto', R: 'auto' };
  const legLift = { L: 0, R: 0 };
  let reachT = null, reachW = 0;               // palm targets that must be reached by leaning (a contact): { L, R } world points
  const hand = sp.sideT < 0 ? 'R' : 'L', off = hand === 'R' ? 'L' : 'R';
  const sgn = (side) => (side === 'L' ? 1 : -1);     // lateral sign of a side in the body frame (+ = left)
  // lateral axis for two-hand contacts: perpendicular to the direction body -> ball, the body's own left when the ball is overhead
  const latTo = (bx, bz) => { const dx = bx - sp.x, dz = bz - sp.z, d = Math.hypot(dx, dz); return d < 0.3 ? V(left.x, 0, left.z) : V(dz / d, 0, -dx / d); };
  const palmAt = (b, n, extra = 0) => b.clone().addScaledVector(n, BALL_R + HAND_T + extra);
  const ballV = V(ball.x, ball.y, ball.z);
  let report = null;

  // a free ball (or one just taken) within reach: a scoop with one palm on top when it is low, both palms on its sides otherwise
  const reachBall = (w) => {
    const latB = latTo(ball.x, ball.z);
    const low = ball.y < 0.8;
    if (low) {
      crouch(0.45 * w);
      const side = (ball.x - sp.x) * left.x + (ball.z - sp.z) * left.z > 0 ? 'L' : 'R';
      const top = ballV.clone().add(V(0, BALL_R + HAND_T, 0));
      P2.arms[side] = palmTarget(A, side, top, w, poleOf(side));
      const other = side === 'L' ? 'R' : 'L';
      P2.arms[other] = palmTarget(A, other, V(sp.x + (other === 'L' ? 1 : -1) * left.x * 0.5, 0.7 * sc, sp.z + (other === 'L' ? 1 : -1) * left.z * 0.5), 0.8 * w, poleOf(other));
      reachT = { [side]: top }; reachW = w;
    } else {
      P2.arms.L = palmTarget(A, 'L', ballV.clone().addScaledVector(latB, BALL_R + HAND_T), w, POLE_L);
      P2.arms.R = palmTarget(A, 'R', ballV.clone().addScaledVector(latB, -(BALL_R + HAND_T)), w, POLE_R);
      reachT = { L: P2.arms.L.palm, R: P2.arms.R.palm }; reachW = w;
    }
    fingers = { L: 'open', R: 'open' };
    P2.torso.bend = 8 + (low ? 26 * w : 0);
  };
  // ============================= situations ==================================================================================
  const catching = B.mode === 'pass' && B.target === id && !B.check;
  const checkRecv = B.mode === 'pass' && B.target === id && B.check;
  const sinceCatch = td - (sp.lastCatch ?? -9);
  const cd = sp.catchDur ?? 0.16;
  const crouch = (v) => { dy = Math.min(dy, -v); };
  const landDip = sp.landT > 0 ? 0.11 * clamp(sp.landT / 0.18, 0, 1) : 0;

  if (act && (act.kind === 'shot' || act.kind === 'layup')) {
    // ---- shooting: gather, rise, release at the sim's release tick, follow through, land
    const layup = act.kind === 'layup';
    const tr = act.tr, apex = act.apexT;
    const relRef = tr !== null ? tr : Math.max(apex, td);
    const k = (td - act.t0) / Math.max(0.2, relRef - act.t0);
    const aimTo = V(-sp.x, 0, -sp.z).normalize();             // towards the hoop
    const gather = sm((td - act.t0) / (act.tj - act.t0));
    // dip then rise: the pelvis follows the sim's jump height; before take-off a knee bend
    const dip = layup ? 0.07 : 0.14;
    const dipK = td < act.tj ? Math.sin(Math.PI * clamp((td - act.t0) / (act.tj - act.t0) * 0.9, 0, 1) * 0.5) : 0;
    dy = -dip * dipK;
    if (td > act.tj && sp.jy < 0.02 && td < act.tj + 0.05) dy = -dip * (1 - (td - act.tj) / 0.05);
    const lean = layup ? 14 : lerp(10, 2, sm((td - act.tj) / 0.3));
    P2.torso.bend = lean; P2.torso.side = 0;
    const shootHand = 'R', guide = 'L';
    const rel = tr !== null ? tr : null;
    const dirH = V(aimTo.x, 0, aimTo.z);
    const lat = V(Math.cos(act.face), 0, -Math.sin(act.face));      // body-left at the shooting facing
    const fw = V(Math.sin(act.face), 0, Math.cos(act.face));
    // hands: guide hand on the ball's left side, shooting hand under and behind; after release the shooting hand flicks to the hoop
    const sinceR = rel !== null ? td - rel : -1;
    // gather: both palms on the ball's sides while it rises into the pocket; overhead the shooting palm slides under and behind it
    const T1 = layup ? 0.14 : 0.18, t1 = act.t0 + T1 * 0.8;
    const kB = sm((td - t1) / Math.max(0.05, apex - t1));
    const dRu = V(0, -1, 0).addScaledVector(lat, -0.35).normalize(), dRs = lat.clone().multiplyScalar(-1);
    const dLu = lat.clone().addScaledVector(fw, -0.15).addScaledVector(V(0, -1, 0), 0.4).normalize();
    const pr = ballV.clone().addScaledVector(dRs.clone().lerp(dRu, kB).normalize(), BALL_R + HAND_T - 0.02 * kB);
    const pl = ballV.clone().addScaledVector(lat.clone().lerp(dLu, kB).normalize(), BALL_R + HAND_T);
    let wR = 1, wL = 1, pRt = pr, pLt = pl;
    if (sinceR >= 0) {
      const fo = easeOut(sinceR / 0.16);
      // follow-through: starting from the palms on the released ball, the shooting arm extends up and towards the hoop, the wrist snaps down
      const relPt = V(act.rel.x, act.rel.y, act.rel.z);
      const r0 = palmAt(relPt, dRu, -0.02);
      const l0 = palmAt(relPt, dLu, 0);
      pRt = r0.clone().addScaledVector(dirH, 0.16 * fo).add(V(0, 0.10 * fo - 0.05 * sm((sinceR - 0.1) / 0.2), 0));
      pLt = l0.clone().addScaledVector(lat, 0.10 * fo).add(V(0, -0.18 * sm(sinceR / 0.3), 0));
      wL = 1 - sm((sinceR - 0.18) / 0.25);
      if (sinceR > 0.45) wR = 1 - sm((sinceR - 0.45) / 0.25);
    }
    if (layup && tr === null) {
      // one-handed layup: the ball rides high in the right hand, the left arm stays tucked in front of the chest
      const ph = sm((td - act.t0) / 0.3);
      pRt = pr.clone();
      pLt = V(act.x0 * 0 + sp.x + lat.x * 0.28 + fw.x * 0.22, 1.35 * sc + sp.jy, sp.z + lat.z * 0.28 + fw.z * 0.22);
      wL = 0.9;
    } else if (layup) { pLt = V(sp.x + lat.x * 0.3 + fw.x * 0.1, 1.2 * sc + sp.jy, sp.z + lat.z * 0.3 + fw.z * 0.1); wL = 1 - sm((sinceR - 0.1) / 0.3); }
    P2.arms[shootHand] = palmTarget(A, shootHand, pRt, wR, poleOf(shootHand));
    P2.arms[guide] = palmTarget(A, guide, pLt, wL, [0.6, -0.8, -0.2]);
    fingers = { L: 'ballGrip', R: 'ballGrip' };
    if (sinceR >= 0.05) { fingers.R = 'relaxed'; }
    // legs: planted through the gather, tucked slightly in the air, bent knees on landing
    const air = sp.jy;
    legLift.L = air * 0.82; legLift.R = air * 0.9 + (layup ? 0.2 * Math.min(1, air / 0.2) : 0);
    if (layup && air > 0.02) { /* knee drive on the layup side */ }
    lookAt = V(0, 3.05, 0); lookW = 0.9;
    pa.aimFace = act.face;
    P2.yaw = act.face; // body squared to the hoop through the shot
    report = { kind: act.kind, release: tr !== null };
  } else if (act && act.kind === 'pass') {
    const to = s.players[act.to];
    const tr = act.tr;
    const k = sm((td - act.t0) / 0.14);
    const dirT = V(to.x - sp.x, 0, to.z - sp.z).normalize();
    const lat = V(dirT.z, 0, -dirT.x);                         // left of the pass direction
    const since = td - tr;
    crouch(0.05 * Math.sin(Math.PI * clamp((td - act.t0) / 0.4, 0, 1)));
    P2.torso.bend = 8 + 6 * sm(since / 0.1);
    let pl, pr, w = 1;
    if (since < 0) { pl = palmAt(ballV, lat.clone().multiplyScalar(1), 0); pr = palmAt(ballV, lat.clone().multiplyScalar(-1), 0); }
    else {
      const ext = easeOut(since / 0.13);
      const relPt = V(B.x, B.y, B.z);
      const c0 = pa.passRel || (pa.passRel = ballV.clone());
      if (since < 0.02) pa.passRel = ballV.clone();
      const c = pa.passRel;
      pl = c.clone().addScaledVector(dirT, 0.04 + 0.30 * ext).addScaledVector(lat, BALL_R + HAND_T - 0.03 * ext); pr = c.clone().addScaledVector(dirT, 0.04 + 0.30 * ext).addScaledVector(lat, -(BALL_R + HAND_T - 0.03 * ext));
      w = 1 - sm((since - 0.2) / 0.2);
    }
    P2.arms.L = palmTarget(A, 'L', pl, w, POLE_L); P2.arms.R = palmTarget(A, 'R', pr, w, POLE_R);
    fingers = { L: since < 0 ? 'ballGrip' : 'open', R: since < 0 ? 'ballGrip' : 'open' };
    lookAt = V(to.x, 1.6, to.z); lookW = 0.9;
  } else if (act && act.kind === 'steal') {
    const k = clamp((td - act.t0) / (act.tc - act.t0), 0, 1), back = sm((td - act.tc) / (act.tl - act.tc));
    const reachK = easeOut(k) * (1 - back);
    const side = 'R';
    const sh = A.b[side].up.getWorldPosition(V());
    sh.y += sp.jy;
    // the palm lands on the near surface of the ball (the sim only lets a steal hit when it can)
    const toB = ballV.clone().sub(sh), tl = toB.length();
    const tgt = ballV.clone().addScaledVector(toB.normalize(), -(BALL_R + HAND_T));
    const guard = V(sp.x + fwd.x * 0.4 - left.x * 0.35, 1.0, sp.z + fwd.z * 0.4 - left.z * 0.35);
    const palm = guard.clone().lerp(tgt, reachK);
    P2.arms[side] = palmTarget(A, side, palm, 1, poleOf(side));
    reachT = { [side]: palm }; reachW = reachK;
    P2.arms.L = palmTarget(A, 'L', V(sp.x + fwd.x * 0.3 + left.x * 0.5, 1.0, sp.z + fwd.z * 0.3 + left.z * 0.5), 0.9, POLE_L);
    crouch(0.10 * Math.sin(Math.PI * clamp((td - act.t0) / (act.tl - act.t0), 0, 1)));
    P2.torso.bend = 10 + 6 * reachK;
    fingers = { L: 'open', R: 'open' };
    lookAt = ballV; lookW = 0.9;
  } else if (act && act.kind === 'jump') {
    const air = sp.jy;
    const crouchK = td < act.tj ? sm((td - act.t0) / (act.tj - act.t0)) : 0;
    dy = -0.12 * crouchK * (td < act.tj ? 1 : 0);
    legLift.L = air * 0.8; legLift.R = air * 0.9;
    const up = clamp((td - act.t0 + 0.02) / 0.22, 0, 1);
    const hy = sp.jy + 1.40 * sc + 0.60;
    let aL = V(sp.x + left.x * 0.2 + fwd.x * 0.1, lerp(1.2, hy, sm(up)), sp.z + left.z * 0.2 + fwd.z * 0.1);
    let aR = V(sp.x - left.x * 0.2 + fwd.x * 0.1, lerp(1.2, hy, sm(up)), sp.z - left.z * 0.2 + fwd.z * 0.1);
    // towards the ball when it is in reach: both hands on its sides
    const near = (B.mode === 'shot' || B.mode === 'loose' || B.mode === 'pass' || hasBall) && Math.hypot(ball.x - sp.x, ball.z - sp.z) < 1.1 && ball.y > 1.5 && ball.y < hy + 0.5;
    if (near) {
      const k = sm((1.1 - Math.hypot(ball.x - sp.x, ball.z - sp.z)) / 0.45);
      const l2 = V(left.x, 0, left.z);
      aL = aL.lerp(ballV.clone().addScaledVector(l2, BALL_R + HAND_T), k); aR = aR.lerp(ballV.clone().addScaledVector(l2, -(BALL_R + HAND_T)), k);
    }
    P2.arms.L = palmTarget(A, 'L', aL, 1, [0.5, -0.4, 0.3]); P2.arms.R = palmTarget(A, 'R', aR, 1, [-0.5, -0.4, 0.3]);
    if (near) { reachT = { L: aL, R: aR }; reachW = 1; }
    else if ((B.mode === 'loose' || B.mode === 'shot' || hasBall) && Math.hypot(ball.x - sp.x, ball.z - sp.z) < 1.2 && ball.y < 1.5) reachBall(1);
    fingers = { L: 'open', R: 'open' };
    P2.torso.bend = -4;
    lookAt = ballV; lookW = 0.9;
  } else if (sp.screenOn) {
    dy = -0.09 * sm(sp.setT / 0.25);
    P2.torso.bend = 8; P2.torso.side = 0;
    const hp = V(sp.x + fwd.x * 0.3, 1.0, sp.z + fwd.z * 0.3);
    P2.arms.L = palmTarget(A, 'L', hp.clone().addScaledVector(left, 0.07), 1, [0.4, -1, 0.2]); P2.arms.R = palmTarget(A, 'R', hp.clone().addScaledVector(left, -0.07), 1, [-0.4, -1, 0.2]);
    fingers = { L: 'fist', R: 'fist' };
    lookAt = ballV; lookW = 0.6;
  } else if (hasBall || (sinceCatch < cd + 0.12 && B.mode === 'held' && holder && holder.id === id)) {
    // ---- dribbling / holding
    const dr = null;
    const u = sp.du;
    const fast = speed > 2.2;
    P2.torso.bend = clamp(speed * 2.4, 0, 14) + 4;
    const crossK = sp.crossT > 0 ? Math.sin(Math.PI * (1 - sp.crossT / 0.32)) : 0;
    crouch(0.06 + 0.06 * crossK);
    const uCarry = 0.20;     // approximate: the hand carries the ball for the first ~0.11 s of the cycle
    const palmY = (() => {
      const ytop = ball.y + BALL_R + HAND_T;
      if (sinceCatch < cd + 0.12) return ytop;
      if (u < sp.dT ? 0.2 : 0.2) { /* placeholder to keep structure */ }
      const uc = 0.11 / (sp.dT || 0.5);
      if (u < uc) return ytop;
      if (u < 0.72) return lerp(0.86 * sc + BALL_R + HAND_T, 1.10 * sc + 0.0, sm((u - uc) / (0.72 - uc)));
      return lerp(1.10 * sc, ytop, Math.pow(clamp((u - 0.72) / 0.28, 0, 1), 2));
    })();
    const palm = V(ball.x, Math.max(palmY, ball.y + BALL_R + HAND_T - 0.01) , ball.z);
    if (u < 0.2 || sinceCatch < cd + 0.12) palm.y = ball.y + BALL_R + HAND_T;
    const side = sp.sideT < 0 ? 'R' : 'L', other = side === 'R' ? 'L' : 'R';
    // two hands on the ball right after a catch
    if (sinceCatch < cd) {
      const kk = 1 - sm(sinceCatch / cd);
      const latB = latTo(ball.x, ball.z);
      const pOther = ballV.clone().addScaledVector(latB, (other === 'L' ? 1 : -1) * (BALL_R + HAND_T));
      P2.arms[other] = palmTarget(A, other, pOther, kk, poleOf(other));
      if (kk > 0.3) { const dS = latB.clone().multiplyScalar(side === 'L' ? 1 : -1), dT = palm.clone().sub(ballV).normalize(); palm.copy(ballV.clone().addScaledVector(dT.lerp(dS, kk).normalize(), BALL_R + HAND_T)); }
    }
    if (!P2.arms[other]) {
      const sign = sgn(other);
      const guard = V(sp.x + left.x * 0.34 * sign + fwd.x * 0.30, sp.z * 0 + 1.18 * sc, sp.z + left.z * 0.34 * sign + fwd.z * 0.30);
      guard.x = sp.x + left.x * 0.34 * sign + fwd.x * 0.30; guard.z = sp.z + left.z * 0.34 * sign + fwd.z * 0.30;
      P2.arms[other] = palmTarget(A, other, guard, 0.85, poleOf(other));
    }
    P2.arms[side] = palmTarget(A, side, palm, 1, poleOf(side));
    if (sinceCatch < cd + 0.04) {
      // just taken (a catch, a rebound, a pickup): lean / crouch to meet the ball where it was taken, then settle into the dribble
      const rw = 1 - sm(sinceCatch / (cd + 0.04));
      reachT = { [side]: palm.clone() }; if (P2.arms[other] && P2.arms[other].palm) reachT[other] = P2.arms[other].palm.clone(); reachW = rw;
      if (ball.y < 0.8) crouch(0.45 * rw);
    }
    fingers[side] = 'open'; fingers[other] = 'open';
    lookAt = V(0, 1.8, 0); lookW = 0.5;
    report = { kind: 'dribble', side };
  } else if (catching || checkRecv) {
    // ---- reaching for the incoming pass: both hands to the ball, weight ramps in over the last 0.35 s
    const toBall = Math.hypot(ball.x - sp.x, ball.z - sp.z);
    const spd = Math.max(3, Math.hypot(B.vx, B.vz));
    const eta = toBall / spd;
    const w = sm((0.42 - eta) / 0.30);
    const lat = latTo(ball.x, ball.z);
    const k = clamp(1 - eta / 0.3, 0, 1);
    const sideGap = lerp(BALL_R + HAND_T + 0.10, BALL_R + HAND_T, sm(k));
    const pL = ballV.clone().addScaledVector(lat, sideGap), pR = ballV.clone().addScaledVector(lat, -sideGap);
    P2.arms.L = palmTarget(A, 'L', pL, w, POLE_L);
    P2.arms.R = palmTarget(A, 'R', pR, w, POLE_R);
    reachT = { L: pL, R: pR }; reachW = w;
    fingers = { L: 'open', R: 'open' };
    P2.torso.bend = 6;
    lookAt = ballV; lookW = 0.9;
    report = { kind: 'catch', eta };
  } else if (defending) {
    // ---- defensive stance: low, wide hands, eyes on the ball
    crouch(0.07);
    P2.torso.bend = 14 + (speed > 2 ? 4 : 0);
    const man = holder || null;
    const sign = (s0) => (s0 === 'L' ? 1 : -1);
    const bp = holder ? V(holder.x, 1.1, holder.z) : ballV;
    const toB = V(bp.x - sp.x, 0, bp.z - sp.z); const dB = toB.length(); if (dB > 0.01) toB.multiplyScalar(1 / dB);
    const lft = V(toB.z, 0, -toB.x);
    const wave = Math.sin(t * 2.3 + ph * 5) * 0.03;
    // the hand nearer the ball goes up, the other stays wide
    const near = Math.sign(lft.dot(V(bp.x - sp.x, 0, bp.z - sp.z).normalize().cross(V(0, 1, 0)))) || 1;
    let nearD = 9; for (const q of s.players) if (q.team !== sp.team && !q.out) nearD = Math.min(nearD, Math.hypot(q.x - sp.x, q.z - sp.z));
    const hf = nearD < 1.2 ? 0.08 : 0.24;       // hands stay out of the opponent's body when he is close
    const hands = { L: V(sp.x + left.x * 0.58 + fwd.x * hf, 1.12 * sc + wave, sp.z + left.z * 0.58 + fwd.z * hf), R: V(sp.x - left.x * 0.58 + fwd.x * hf, 1.02 * sc - wave, sp.z - left.z * 0.58 + fwd.z * hf) };
    P2.arms.L = palmTarget(A, 'L', hands.L, 0.95, [0.6, -0.7, 0.1]); P2.arms.R = palmTarget(A, 'R', hands.R, 0.95, [-0.6, -0.7, 0.1]);
    fingers = { L: 'open', R: 'open' };
    lookAt = bp; lookW = 0.85;
    // a ball passing or bouncing within reach: both hands go to it (interceptions, deflections)
    if ((B.mode === 'pass' || B.mode === 'loose' || B.mode === 'shot') && !hasBall) { const dxz = Math.hypot(ball.x - sp.x, ball.z - sp.z); if (dxz < 1.6 && ball.y < sp.jy + 2.4 * sc) reachBall(sm((1.6 - dxz) / 0.7)); }
    P2._wideLegs = true;
  } else {
    // ---- off the ball on offence (or a loose ball): ready, eyes on the ball; hand up when calling for it
    P2.torso.bend = 8 + clamp(speed * 1.5, 0, 8);
    if (sp.callT > 0) {
      const sh = A.b.R.up.getWorldPosition(V());
      P2.arms.R = palmTarget(A, 'R', V(sp.x - left.x * 0.28 + fwd.x * 0.28, 2.0 * sc, sp.z - left.z * 0.28 + fwd.z * 0.28), 1, [-0.8, -0.4, -0.3]);
      fingers.R = 'open';
    }
    lookAt = ballV; lookW = 0.75;
    // a free ball within reach: both hands go to it (a scoop when it is low, a catch when it is higher)
    if ((B.mode === 'loose' || B.mode === 'shot') && !hasBall) {
      const dxz = Math.hypot(ball.x - sp.x, ball.z - sp.z), w = sm((1.5 - dxz) / 0.9);
      // only the nearest player of each team reaches for it (two reachers of the same team would cross arms)
      let rank = 0; for (const q of s.players) { if (q.id === id || q.out || q.team !== sp.team) continue; if (Math.hypot(q.x - ball.x, q.z - ball.z) < dxz - 0.05) rank++; }
      if (w > 0.02 && rank === 0 && ball.y < sp.jy + 2.5 * sc) reachBall(w);
    }
    if (sp.stumble > 0) { P2.torso.side = 12; P2.torso.bend = 18; crouch(0.05); }
  }
  if (sp.stumble > 0 && !(act)) { P2.torso.side += 10 * Math.sin(td * 18); }
  if (landDip > 0) dy = Math.min(dy, -landDip);

  // ---------------- personal space: the other players' body capsules; applyPose keeps the free arms out of them
  P2.avoid = [];
  if (Math.hypot(ball.x - sp.x, ball.z - sp.z) < 1.4) P2.avoid.push([ballV.clone(), ballV.clone(), BALL_R + 0.07]);   // free hands keep off the ball too
  for (const q of s.players) {
    if (q.id === id || q.out) continue;
    if (Math.hypot(q.x - sp.x, q.z - sp.z) > 1.7) continue;
    const hq = P.humans[q.id], pel = hq.bonePosition('Pelvis'), sp2 = hq.bonePosition('Spine2'), nk = hq.bonePosition('Neck'), hd = hq.bonePosition('Head');
    P2.avoid.push([pel.clone(), sp2.clone(), 0.24], [sp2.clone(), nk.clone(), 0.23], [nk.clone(), hd.clone(), 0.2]);
    for (const sd of ['L', 'R']) { const ua = hq.bonePosition(`${sd}_UpperArm`), fa = hq.bonePosition(`${sd}_Forearm`), ha = hq.bonePosition(`${sd}_Hand`); P2.avoid.push([ua.clone(), fa.clone(), 0.2], [fa.clone(), ha.clone(), 0.22]); }
  }
  // ---------------- contact lean: when the palms are further than the arms reach, the body steps / leans towards the ball
  let lunged = false;
  if (reachT && reachW > 0.05) {
    let need = 0, mid = V();
    let nr = 0;
    for (const side of ['L', 'R']) { if (!reachT[side]) continue; const sh = A.b[side].up.getWorldPosition(V()); sh.y += dy + sp.jy; need = Math.max(need, sh.distanceTo(reachT[side]) - 0.55 * sc); mid.add(reachT[side]); nr++; }
    mid.multiplyScalar(1 / Math.max(1, nr));
    const dirL = V(mid.x - sp.x, 0, mid.z - sp.z).normalize();
    let room = 9; for (const q of s.players) { if (q.id === id || q.out) continue; const dq = Math.hypot(q.x - sp.x, q.z - sp.z); const toQ = V(q.x - sp.x, 0, q.z - sp.z).normalize(); if (toQ.dot(dirL) > 0.3) room = Math.min(room, (dq - 0.8) / 2); }
    const L = clamp(need * 1.2, 0, Math.max(0, Math.min(0.45, room))) * reachW;
    if (L > 0.01) { P2.pelvis.addScaledVector(dirL, L); lunged = true; P2.torso.bend = Math.max(P2.torso.bend, 14 + L * 40); }
  }
  // ---------------- legs: when the pelvis leaves its animated height (dip, jump) the feet are held to the ground / lifted with the jump
  const jy = sp.jy;
  if (Math.abs(dy) > 0.002 || jy > 0.003 || lunged) {
    P2.pelvis.y += dy + jy;
    for (const side of ['L', 'R']) {
      const f = footAnim[side].clone();
      f.y = Math.max(A.groundAnkle, f.y) + legLift[side];
      if (jy < 0.01 && !legLift[side]) f.y = A.groundAnkle;
      P2.legs[side] = { p: [f.x, f.y, f.z], f: 'w', w: 1, pole: [0, 0.1, 1], pf: 'g', aim: jy < 0.01 ? { n: [0, -1, 0], face: 'sole', fwd: [fwd.x, 0, fwd.z], w: 1 } : undefined };
    }
  }
  if (lookAt) P2.look = { target: lookAt, w: lookW };
  H.setFingers('L', fingers.L); H.setFingers('R', fingers.R);
  applyPose(A, P2);
  pa.report = report;
}

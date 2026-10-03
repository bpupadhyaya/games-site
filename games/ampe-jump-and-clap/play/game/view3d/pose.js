// The Ampe body: every pose is a pure function of the engine's beat times (s.round / s.prev), so the clap lands exactly on the beat,
// the jump apex is exactly on the beat and the foot snaps out after every tap window has closed. Solved with two-bone IK through
// actor.js (pelvis anchored in the world, feet planted, hands and feet placed by explicit targets). A live idle layer (breathing,
// weight shift, head tracking, asymmetric arm placement, per-player phase) runs underneath and keeps going when the game is paused.
import { THREE } from '../vendor3d/index.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const G = 9.81;
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const easeOut = (x) => { x = clamp(x, 0, 1); return 1 - (1 - x) * (1 - x); };

// ---- tuning --------------------------------------------------------------------------------------------------------------
export const BODY = {
  stand: 0.866,         // pelvis height when standing (slightly bent knees)
  stanceX: 0.115,       // half distance between the planted ankles
  handGapMin: 0.0975,   // half distance between the two wrist joints at the moment the palms touch (calibrated, see dev/verify)
  handGapMax: 0.2,      // half distance at the widest part of the clap
  clapY: 0.30,          // clap height above the pelvis
  clapZ: 0.40,          // clap distance in front of the pelvis
  clapIn: 0.26,         // how long the hands take to close (s)
  thrustFwd: 0.60, thrustSide: 0.15, thrustUp: 0.50,
  tuckUp: 0.19,
  wristFollow: 0.8,     // 0 = palms exactly parallel, 1 = hand continues the forearm; trades wrist bend (cuff look) against palm alignment
};

// ---- the vertical channel: cubic Hermite keys with take-off speed, so every flight is an exact parabola --------------------------
function actionsOf(s) {
  const out = [];
  const R = s.round, P = s.prev;
  if (P) out.push({ kind: 'jump', apex: P.tb, A: P.A, foot: P.foot, miss: P.miss, round: P });
  if (R) {
    if (s.phase !== 'hold') {
      if (s.n === 0 && R.r0 > 0) for (let k = 3; k >= 1; k--) out.push({ kind: 'hop', apex: R.r0 - k * R.T, A: 0.12 });
      out.push({ kind: 'hop', apex: R.r0, A: 0.12 });
    }
    out.push({ kind: 'jump', apex: R.tb, A: R.A, foot: R.foot, miss: R.miss, round: R, cur: true });
  }
  return out.filter((a) => a.apex > 0).sort((a, b) => a.apex - b.apex);
}
function verticalKeys(acts) {
  const keys = [];
  for (const a of acts) {
    const big = a.kind === 'jump';
    const v0 = (G * a.A) / 2, h = (G * a.A * a.A) / 8;
    const dip = big ? 0.1 : 0.032, lead = big ? 0.1 : 0.06;
    const tt = a.apex - a.A / 2, tl = a.apex + a.A / 2;
    keys.push({ t: tt - lead - 0.1, y: 0, v: 0, pr: 0 }, { t: tt - lead, y: -dip, v: 0, pr: 2 }, { t: tt, y: 0, v: v0, pr: 3 }, { t: a.apex, y: h, v: 0, pr: 3 },
      { t: tl, y: 0, v: -v0, pr: 3 }, { t: tl + lead * 0.7, y: -dip, v: 0, pr: 1 }, { t: tl + lead * 0.7 + 0.14, y: 0, v: 0, pr: 0 });
  }
  keys.sort((a, b) => a.t - b.t);
  // drop keys that crowd a more important neighbour
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 1; i < keys.length; i++) {
      if (keys[i].t - keys[i - 1].t < 0.045) { keys.splice(keys[i].pr <= keys[i - 1].pr ? i : i - 1, 1); changed = true; break; }
    }
  }
  return keys;
}
function evalKeys(keys, t) {
  if (!keys.length || t <= keys[0].t || t >= keys[keys.length - 1].t) return 0;
  let i = 1;
  while (keys[i].t < t) i++;
  const a = keys[i - 1], b = keys[i], d = b.t - a.t, u = (t - a.t) / d;
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * a.y + (u3 - 2 * u2 + u) * d * a.v + (-2 * u3 + 3 * u2) * b.y + (u3 - u2) * d * b.v;
}

// nearest clap (beat) times: every hop apex and every jump apex
function clapTimes(acts) { return acts.map((a) => a.apex); }

function jumpPhase(a, t) {
  // 0..1 tuck, thrust u (0..1), retract, all as weights; relative to the apex
  const dtA = t - a.apex, half = a.A / 2;
  const air = dtA > -half && dtA < half;
  return { dtA, half, air };
}

/** The pose of one player at display time `t`. Returns the P object for Actor.apply. */
export function playerPose(c) {
  const { s, t, i, actor, base, yaw, idle, oppHead } = c;
  const acts = actionsOf(s);
  const keys = verticalKeys(acts);
  const rhythm = !!s.round && s.phase !== 'hold' && s.phase !== 'over' || (s.phase === 'over' && !!s.round);
  // end-of-match reaction: starts once the last jump has landed. Winner: arms up and happy hops. Loser: head down, then a slow sporting clap.
  // Friendly pair (no winner): both give a relaxed slow clap and a nod.
  const scoringMode = s.cfg && (s.cfg.mode === 'match' || s.cfg.mode === 'watch');
  const cel = s.over && s.round && scoringMode ? t - (s.round.tb + s.round.A / 2 + 0.12) : -1;
  const role = cel >= 0 ? (s.winner < 0 ? 'draw' : s.winner === i ? 'win' : 'lose') : null;
  let hopFrac = 0, celHop = 0;
  if (role === 'win') {
    const cs = Math.max(0, cel - 0.2), ph = (cs * 1.9) % 1;
    hopFrac = cs > 0 ? 4 * ph * (1 - ph) : 0;
    celHop = 0.15 * hopFrac * smooth(cs / 0.3);
  }
  const dy = (rhythm ? evalKeys(keys, t) : 0) + celHop;
  const up = Math.max(0, dy);
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  const W = (lx, lz) => [base.x + lx * cos + lz * sin, base.z - lx * sin + lz * cos];     // local (x = left, z = forward) -> world
  const gA = actor.groundAnkle;
  // ---- idle layer ------------------------------------------------------------------------------------------------------
  const ph = idle.phase, ti = idle.t;
  const amp = rhythm ? 0.45 : 1;
  const breath = Math.sin(ti * 1.7 + ph) * amp;
  const shift = Math.sin(ti * 0.71 + ph * 1.7) * amp;
  const shift2 = Math.sin(ti * 0.43 + ph * 0.6 + 1.3) * amp;
  const swayX = shift * 0.012;                        // weight shift (pelvis sideways)
  const pel = V(0, 0, 0);
  // the pelvis stays over the planted feet
  const [px, pz] = W(swayX, -0.012 * breath);
  pel.set(px, BODY.stand + dy - 0.004 * breath * amp, pz);

  // ---- flight state ----------------------------------------------------------------------------------------------------
  let tuck = 0, thrustU = 0, thrown = -1, thrustSide = 0, miss = false, flightJump = null;
  for (const a of acts) {
    if (a.kind !== 'jump') continue;
    const { dtA, half } = jumpPhase(a, t);
    if (dtA < -half - 0.05 || dtA > half + 0.02) continue;
    flightJump = a;
    // tuck: knees up right after take-off, down again before landing
    const up1 = smooth((dtA + half) / 0.07), down1 = 1 - smooth((dtA - (half - 0.1)) / 0.1);
    tuck = Math.min(up1, dtA > 0 ? down1 : 1);
    const foot = a.round.foot[i], isMiss = a.round.miss[i];
    miss = isMiss;
    // the thrust: starts when every tap window has closed (80 ms before the apex), full at the apex, held, then pulled back
    const ts = a.apex - 0.08;
    let u = 0;
    if (t >= ts && t < a.apex + 0.08) u = easeOut((t - ts) / 0.08);
    else if (t >= a.apex + 0.08) u = 1 - smooth((t - (a.apex + 0.08)) / 0.12);
    if (foot !== null && foot !== undefined && !isMiss) { thrustU = u; thrown = foot; thrustSide = foot === 0 ? 1 : -1; }
  }
  if (role === 'win') tuck = Math.max(tuck, 0.45 * hopFrac);
  // ---- feet --------------------------------------------------------------------------------------------------------------
  const legs = {};
  const airHop = (() => { for (const a of acts) { if (a.kind !== 'hop') continue; if (Math.abs(t - a.apex) < 0.06) return up; } return 0; })();
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    const isThrown = thrown >= 0 && ((thrown === 0 && side === 'L') || (thrown === 1 && side === 'R'));
    let lx = sx * BODY.stanceX, lz = side === 'L' ? 0.03 : -0.03, ly = gA + up * 1 + airHop * 0;
    ly = gA + up;
    if (tuck > 0) {
      // tucked: knees up, feet under the hips, slightly back
      lz = lz - 0.06 * tuck; ly += BODY.tuckUp * tuck;
    }
    let pole = [0, 0.15, 1];
    let aim = { n: [0, -1, 0], face: 'sole', fwd: [sin, 0, cos], w: 1 };
    if (thrown >= 0 && thrustU > 0) {
      const u = thrustU;
      if (isThrown) {
        lx = lerp(lx, sx * BODY.thrustSide, u); lz = lerp(lz, BODY.thrustFwd, u); ly = lerp(ly, gA + up + BODY.thrustUp, u);
        pole = [0, 1, 0.1];
        const nf = [0, -0.55, 0.83], ff = [0, 0.83, 0.55];
        aim = { n: [nf[0] * cos + nf[2] * sin, nf[1], -nf[0] * sin + nf[2] * cos], face: 'sole', fwd: [ff[0] * cos + ff[2] * sin, ff[1], -ff[0] * sin + ff[2] * cos], w: u };
      } else {
        lz = lerp(lz, -0.2, u); ly = lerp(ly, gA + up + BODY.tuckUp + 0.1, u);
        pole = [0, 0.3, 1];
        const nf = [0, -0.6, -0.8], ff = [0, -0.5, 0.86];
        aim = { n: [nf[0] * cos + nf[2] * sin, nf[1], -nf[0] * sin + nf[2] * cos], face: 'sole', fwd: [ff[0] * cos + ff[2] * sin, ff[1], -ff[0] * sin + ff[2] * cos], w: u * 0.8 };
      }
    }
    if (miss && flightJump && tuck > 0) { lz += side === 'L' ? 0.1 : -0.04; }
    const [wx, wz] = W(lx, lz);
    const pw = [pole[0] * cos + pole[2] * sin, pole[1], -pole[0] * sin + pole[2] * cos];
    legs[side] = { p: [wx, ly, wz], f: 'w', w: 1, pole: pw, pf: 'w', aim };
  }

  // ---- arms: the clap -------------------------------------------------------------------------------------------------------
  let tau = 9, nearest = null;
  for (const ct of clapTimes(acts)) { const d = t - ct; if (Math.abs(d) < Math.abs(tau)) { tau = d; nearest = ct; } }
  const clapping = rhythm && nearest !== null;
  let gap = BODY.handGapMax * 0.55, ha = 0, hz = 0;     // resting: hands loosely apart in front
  if (clapping) {
    const u = clamp(Math.abs(tau) / BODY.clapIn, 0, 1);
    const k = 0.5 * (1 - (1 - u) * (1 - u)) + 0.5 * u * u * (3 - 2 * u);   // hands part briskly but stay within a few cm of each other around the beat
    gap = lerp(BODY.handGapMin, BODY.handGapMax, k);
    ha = 0.04 * k; hz = -0.03 * k;
  } else {
    gap = BODY.handGapMax * (0.5 + 0.12 * shift2);
  }
  // before the first beat and between matches the hands hang ready; arms follow the idle layer
  const armsOut = (!rhythm) ? 1 : 0;
  const arms = {};
  for (const side of ['L', 'R']) {
    const sx = side === 'L' ? 1 : -1;
    const asym = side === 'L' ? 0.02 : -0.015;
    let x = sx * gap, y = BODY.clapY + ha + (side === 'L' ? 0.012 : -0.01) * Math.sin(ti * 1.1 + ph), z = BODY.clapZ + hz;
    if (armsOut) { x = sx * (0.23 + asym + 0.015 * breath); y = 0.04 + 0.01 * breath * sx; z = 0.12 + (side === 'L' ? 0.04 : 0); }
    // the thrust leans the body back a little, so the hands follow the chest
    arms[side] = { p: [x, y, z], f: 'b', w: 1, pole: [sx * 0.25, -1, -0.15], pf: 'b', hand: armsOut ? null : { alpha: -80, w: 1, follow: BODY.wristFollow } };
  }

  if (role) {
    const u = smooth(cel / 0.35);
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? 1 : -1;
      let x, y, z, hand = null, pole = [sx * 0.25, -1, -0.15];
      if (role === 'win') {
        const w = Math.sin(cel * 9 + (side === 'L' ? 0 : 1.7));
        x = sx * (0.30 + 0.04 * w); y = lerp(BODY.clapY, 0.98, u); z = lerp(BODY.clapZ, 0.10, u); pole = [sx * 0.9, -0.2, -0.3];
      } else {
        const slow = role === 'draw' ? smooth(cel / 0.5) : smooth((cel - 0.9) / 0.5);          // loser starts clapping after a moment
        const g = lerp(BODY.handGapMin, 0.15, 0.5 + 0.5 * Math.sin(cel * Math.PI * 2 * 1.5 + Math.PI / 2));
        const hang = [sx * 0.21, 0.03, 0.10];
        x = lerp(hang[0], sx * g, slow); y = lerp(hang[1], BODY.clapY - 0.04, slow); z = lerp(hang[2], BODY.clapZ - 0.04, slow);
        if (slow > 0.6) hand = { alpha: -80, w: slow };
      }
      arms[side] = { p: [x, y, z], f: 'b', w: 1, pole, pf: 'b', hand };
    }
  }

  // ---- torso and head ------------------------------------------------------------------------------------------------------------
  const crouch = clamp(-dy / 0.1, 0, 1);
  let bend = 2 + 7 * crouch + breath * 0.8 - 9 * thrustU;
  let side = shift * 1.4 + (thrown >= 0 ? -thrustSide * 2.5 * thrustU : 0);
  if (miss && flightJump) { side += Math.sin(t * 22) * 5 * tuck; bend += 6; }
  const target = oppHead.clone();
  target.y += 0.02 * Math.sin(ti * 0.9 + ph);
  let lookW = 0.85;
  if (role === 'win') { bend = -5 + 3 * Math.sin(cel * 9); side = shift * 1.0; target.y += 0.45 * smooth(cel / 0.4); }
  else if (role === 'lose') { const u = smooth(cel / 0.5); bend = lerp(bend, 15, u); side = 2.5 * Math.sin(cel * 1.1) * u; target.set(base.x + 0.02, 0.2, base.z + (yaw ? -0.5 : 0.5)); target.x += 0.25 * Math.sin(cel * 3.2) * Math.min(1, cel / 0.6) * (cel < 2.2 ? 1 : Math.max(0, 1 - (cel - 2.2))); target.y = lerp(oppHead.y, 0.25, u); lookW = 1; }
  else if (role === 'draw') { bend = lerp(bend, 6 + 3 * Math.sin(cel * 4), smooth(cel / 0.4)); }
  return {
    pelvis: pel, yaw, pitch: 0, roll: shift * 0.8, groundY: 0,
    torso: { bend, side, twist: 2.5 * shift2 + (i === 0 ? 1 : -1) * 1.5 },
    pelvisTilt: { bend: 0, side: shift * 1.0, twist: 0 },
    legs, arms,
    look: { target, w: lookW },
    out: { dy, gap, thrustU, tuck, tau },
  };
}

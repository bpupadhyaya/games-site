// Computer riders: the chaser's pace and throw, the runner's pace, weave and dodge, and the planner used for the Think hint and Watch & Learn.
// Pure and deterministic: all randomness comes from the sim's rng.
import { DT, GRAV, LANES, LANE_NAMES, MARK_Y, MARK_BACK, WIND_TICKS, flightTime, REACH_MAX, HORSES, Z_END } from './consts.js';
import { clamp, hyp } from './util.js';

const laneOfX = (x) => { let b = 0; for (let i = 1; i < 3; i++) if (Math.abs(x - LANES[i]) < Math.abs(x - LANES[b])) b = i; return b; };

// Where to aim so the javelin meets the runner: lead along the field and a lane. q = how well the runner's pace is predicted (0..1).
export function planThrow(s, ch, ru, q = 1) {
  const dir = s.dir, t0 = WIND_TICKS * DT;
  const Oz = ch.z + dir * ch.v * t0;
  let T = 0.6, Pz = ru.z, lat = 0;
  for (let i = 0; i < 5; i++) {
    Pz = ru.z + dir * ru.v * q * (t0 + T);
    lat = LANES[ru.lane] - ch.x;
    T = flightTime(hyp(Pz - Oz, lat));
  }
  const reach = HORSES[ru.horse].lat * (t0 + T);
  const xr = ru.x + clamp((LANES[ru.lane] - ru.x) * q, -reach, reach);
  const lane = laneOfX(xr);
  const gap = dir * (ru.z - ch.z), lead = dir * (Pz - ru.z), dist = hyp(Pz - Oz, LANES[lane] - ch.x);
  const why = `The runner is ${gap.toFixed(0)} m ahead at ${ru.v.toFixed(0)} m/s in the ${LANE_NAMES[lane]} lane. The javelin needs ${(T + t0).toFixed(1)} s, so aim ${lead.toFixed(0)} m ahead of him in that lane.`;
  return { z: Pz, lane, T, lead, gap, dist, why };
}

// The nearest javelin that is flying at rider r: when it will cross him and how far from his shield it passes
export function incoming(s, r) {
  const dir = s.dir;
  let best = null;
  for (const j of s.javs) {
    if (j.state !== 'fly' || j.team === r.team) continue;
    for (let t = 0.04; t <= 1.3; t += 0.04) {
      const jz = j.z + j.vz * t, rz = r.z + dir * r.v * t - dir * MARK_BACK;
      if ((jz - rz) * dir >= 0) {
        const jx = j.x + j.vx * t, jy = j.y + j.vy * t - 0.5 * GRAV * t * t, rx = r.x + r.vlat * t;
        if (!best || t < best.t) best = { t, miss: hyp(jx - rx, jy - MARK_Y), jav: j, jx, jz, rx };
        break;
      }
    }
  }
  return best;
}

export function aiInput(s, r, o, lvl, rng, gauss) {
  const dir = s.dir, A = r.ai, out = {};
  if (A.force) { const f = A.force; A.force = null; return { thr: f.thr, lane: f.lane, lean: !!f.lean }; }
  if (r.role === 'run' && s.cfg.practice && s.cfg.practice.steady) return { thr: 0.62 };
  if (r.role === 'run') {
    // pace wanders, lane changes now and then, and a javelin in the air is dodged after the reaction time
    if (s.t >= A.next) { A.thr = clamp(0.62 + rng.next() * (lvl.thrMax - 0.55), 0.5, lvl.thrMax); A.next = s.t + 1.1 + rng.next() * 1.6 * (1.3 - lvl.weave * 0.5); }
    out.thr = A.thr;
    if (s.t >= A.laneAt) { A.laneAt = s.t + 1.5 + rng.next() * 2.4; if (rng.next() < 0.25 + lvl.weave * 0.6) { out.lane = rng.int(3); } }
    const th = incoming(s, r);
    if (th && th.jav.id !== A.seen) {
      if (A.react < 0) A.react = s.t + lvl.react * (0.8 + 0.4 * rng.next());
      if (s.t >= A.react && th.t > 0.1) {
        const danger = th.miss < 1.7;
        if (!danger) { A.seen = th.jav.id; A.react = -1; }
        else if (rng.next() > 0.0) {
          const canLean = r.lean.cool <= 0 && r.lean.t <= 0;
          const wantLean = canLean && th.t <= 0.52 && th.t >= 0.14;
          if (canLean && th.t > 0.52 && rng.next() < 0.5) { /* wait for the lean window */ }
          else {
            A.seen = th.jav.id; A.react = -1;
            if (rng.next() < lvl.dodge) {
              let act;
              if (wantLean && rng.next() < 0.6) act = { lean: true, thr: r.thr, lane: r.lane };
              else {
                const H = HORSES[r.horse];
                let bl = r.lane, bd = -1;
                for (let l = 0; l < 3; l++) { const reach = Math.abs(LANES[l] - r.x) / H.lat; const d = Math.abs(LANES[l] - th.jx); if (reach <= th.t + 0.12 && d > bd) { bd = d; bl = l; } }
                act = bd > 1.2 ? { lane: bl, thr: r.thr } : { lane: r.lane, thr: clamp(r.thr + (r.thr > 0.6 ? -0.4 : 0.4), 0, 1) };
              }
              if (s.cfg.watch) {
                out.hold = { kind: 'dodge', rider: r.id, action: act, why: act.lean ? 'A javelin is coming at the shield. Lean off the near side as it arrives: the shield is out of its way.' : act.lane !== r.lane ? `A javelin is coming at the ${LANE_NAMES[r.lane]} lane. Change to the ${LANE_NAMES[act.lane]} lane before it arrives.` : 'A javelin is coming. Change pace so it arrives where you are not.' };
              } else { out.lane = act.lane; out.thr = act.thr; if (act.lean) out.lean = true; A.thr = act.thr; }
            }
          }
        }
      }
    }
    return out;
  }
  if (r.role === 'chase') {
    const ru = o, gap = dir * (ru.z - r.z);
    // close the gap with a pace that leaves some in hand, follow the runner's lane after a short delay
    const want = clamp(0.55 + (gap - 8) * 0.045 + (rng.next() - 0.5) * 0.04, 0.45, lvl.thrMax);
    out.thr = want;
    if (s.t >= A.laneAt) { A.laneAt = s.t + lvl.react * 0.6; out.lane = ru.lane; }
    else out.lane = r.lane;
    // the throw
    if (r.javs > 0 && r.sw.ph === 'idle' && r.cool <= 0 && !s.hold) {
      const inBand = gap >= lvl.band[0] && gap <= lvl.band[1];
      const closing = dir * (Z_END * 1) - dir * 0;
      void closing;
      const nearEnd = dir * ru.z > Z_END - 8;
      const steady = Math.abs(ru.x - LANES[ru.lane]) < (lvl.id >= 3 ? 0.35 : 1.6);
      if (inBand && steady) A.want += DT; else if (gap < lvl.band[0] * 0.85 || nearEnd) A.want += DT * 2.5;
      if (A.want >= A.delay && gap > 2.5 && gap <= REACH_MAX) {
        A.want = 0; A.delay = 0.25 + rng.next() * 0.65 * (1.4 - lvl.weave);
        const p = planThrow(s, r, ru, lvl.lead);
        let z = p.z + dir * gauss() * lvl.err * 0.8 * (0.5 + p.dist / 18);
        let lane = p.lane;
        if (rng.next() < (1 - lvl.lead) * 0.22) lane = clamp(lane + (rng.next() < 0.5 ? -1 : 1), 0, 2);
        z = clamp(z, -70, 70);
        const aim = { z, lane };
        if (s.cfg.watch) out.hold = { kind: 'throw', rider: r.id, aim, why: p.why };
        else out.throw = aim;
      }
    }
    return out;
  }
  return { thr: 0.4 };
}

// Watch & Learn: carry out the decision the game was holding on
export function applyAiHold(s, hold, { startThrow, R }) {
  const r = R(hold.rider);
  if (hold.kind === 'throw') { if (r.javs > 0 && r.sw.ph === 'idle') startThrow(r, hold.aim, hold.why); }
  else if (hold.kind === 'dodge') r.ai.force = hold.action;
}

// A scripted stand-in for the human (tests, the AI calibration ladder, store screenshots): plays the human role through the same sim API
// the touch controls use. skill 0..1 scales its timing / aim noise; it never reads anything a human could not see.
import { localRng, planBat, planDelivery, RUN_TIME, levelOf } from './ai.js';
import { MATE, DEG, clamp } from './core.js';
import { trackPos } from './ball.js';
import { REACH } from './field.js';

export function makeBot(S, o = {}) {
  const skill = o.skill ?? 0.55;
  const rng = localRng(o.seed ?? 77);
  let planKey = -1, plan = null, bowled = -1, tapped = -1, readyAt = -1, aimAt = -1;
  const g = () => (rng.next() + rng.next() + rng.next() - 1.5) * 2;
  return function act() {
    const s = S.s;
    if (s.hold) return;
    const L = s.live;
    if (S.humanBats()) {
      if (s.phase === 'flight' && !s.sw) {
        if (planKey !== s.ballSeq) {
          planKey = s.ballSeq;
          plan = planBat({ fielders: S.analysis(), lvl: { ...levelOf(MATE), skill }, inn: s.inn, runTime: RUN_TIME }, s.d, rng);
          plan.at = s.d.tC - (plan.kind === 'block' ? 0 : 0.05) + plan.terr;
        }
        if (plan.kind !== 'leave' && s.ft >= plan.at) S.swing({ kind: plan.kind === 'block' ? 'block' : 'swing', angle: plan.angle, power: plan.power, t: s.ft });
      }
      if (s.phase === 'live' && L && !L.dead && L.rn.every((r) => r.state === 'rest')) { const adv = S.advice(); if (adv && adv.act === 'run') S.callRun(); }
    } else if (S.humanBowls()) {
      if (s.phase !== 'aim') aimAt = -1;
      if (s.phase === 'aim' && aimAt < 0) aimAt = s.t;
      if (s.phase === 'aim' && bowled !== s.ballSeq && s.t - aimAt >= (o.aimWait ?? 0)) {
        bowled = s.ballSeq;
        const pl = planDelivery({ level: { ...levelOf(MATE), acc: 0.3 + (1 - skill) * 0.5, iq: skill }, inn: s.inn, recent: s.inn.recent, zoneRuns: s.inn.zoneRuns }, rng);
        S.bowl({ type: pl.type, bx: pl.aim.bx, bz: pl.aim.bz, speed: pl.aim.speed });
      }
    } else if (S.humanFields()) {
      const uf = s.field.find((f) => f.ctl);
      if (s.phase === 'ready') { if (readyAt < 0) readyAt = s.t + 0.5; if (s.t >= readyAt && s.waitReady) { S.ready(); readyAt = -1; } }
      else readyAt = -1;
      if (L && !L.dead) {
        if (L.bs === 'held' && L.holder === uf.id) S.throwTo(S.bestThrowEnd(uf));
        if ((L.bs === 'fly' || L.bs === 'loose') && L.claim) S.setTarget(L.claim.pos[0], L.claim.pos[2]); else if (L.bs !== 'held') S.setTarget(null);
        if (L.bs === 'fly' && L.claim && tapped !== s.ballSeq * 100 + L.bounces) {
          // tap just before the ball reaches the hands
          for (let j = L.i; j < Math.min(L.track.n, L.i + 20); j++) {
            const p = trackPos(L.track, j);
            if (Math.hypot(p[0] - uf.x, p[2] - uf.z) <= REACH.catchR) { if ((j - L.i) / 60 <= 0.2 + 0.1 * g() * (1 - skill)) { S.tap(); tapped = s.ballSeq * 100 + L.bounces; } break; }
          }
        }
      } else S.setTarget(null);
    }
  };
}
export { DEG, clamp };

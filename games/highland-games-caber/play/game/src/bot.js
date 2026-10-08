// A computer player that drives the same inputs a finger would (Watch & Learn, the Think hint, the rivals' style). Skill 0..1: higher = steadier.
import { STONE_ANGLE, WIND_FULL, ARC } from './sim.js';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function createBot(S, rng, skill = 0.85) {
  const e = rng.fork();
  const gauss = () => (e.next() + e.next() + e.next() - 1.5) * 1.4;
  const sd = (1 - skill) * 0.12 + 0.012;               // seconds of timing error
  let key = '', plan = {};
  const s = S.s;
  const out = () => ({ pad: { f: 0, l: 0 }, act: { down: false, pressed: false, released: false } });
  return function step() {
    const i = out();
    const k = `${s.event}:${s.attempt}:${s.ph}`;
    if (k !== key) { key = k; plan = {}; }
    if (s.ph === 'choose') {
      if (s.event === 'caber') S.choose(['glen', 'braemar', 'champion'][s.attempt] || 'braemar');
      else if (s.event === 'stone') S.choose(s.attempt === 0 ? 'heavy' : s.attempt === 1 ? 'heavy' : 'light');
      else S.choose([1, 2, 3, 4, 5][s.attempt] ?? 2);
      return i;
    }
    if (s.ph === 'judge') { plan.w = (plan.w ?? 0) + 1 / 60; if (plan.w > 3.2) S.next(); return i; }
    if (s.ph === 'evend') { plan.w = (plan.w ?? 0) + 1 / 60; if (plan.w > 3.5) S.next(); return i; }
    if (s.event === 'caber' && s.cab) {
      const c = s.cab;
      if (s.ph === 'lift' || s.ph === 'run') {
        const kp = 0.55 + 0.1 * skill, kd = 0.14;
        i.pad.f = clamp(kp * c.bx + kd * c.vbx + gauss() * 0.04 * (1 - skill), -1, 1);
        i.pad.l = clamp(kp * c.bz + kd * c.vbz + gauss() * 0.04 * (1 - skill), -1, 1);
      }
      if (s.ph === 'run') {
        for (let k2 = 0; k2 < 6; k2++) if (plan[k2] === undefined) plan[k2] = gauss() * sd;
        const P = s.lv.beat;
        for (let k2 = 0; k2 < 6; k2++) if (Math.abs(s.t - (c.beat0 + k2 * P + plan[k2])) < 1 / 120) i.act.pressed = true;
      }
      if (s.ph === 'heave' && c.zone) {
        if (plan.t === undefined) plan.t = clamp(c.zone.mid + gauss() * (1 - skill) * 0.12, 0.05, 1);
        if (c.tau >= plan.t && c.sweepT > 0) i.act.pressed = true;
      } else if (s.ph === 'heave' && c.sweepT > 0.3) i.act.pressed = true;
    } else if (s.event === 'stone' && s.st) {
      const k2 = s.st;
      if (s.ph === 'angle') {
        if (plan.a === undefined) plan.a = STONE_ANGLE.ideal + gauss() * (1 - skill) * 9;
        if (s.pt > 0.8 && Math.abs(k2.angle - plan.a) < 0.7) i.act.pressed = true;
      } else if (s.ph === 'wind') {
        if (!k2.wind) { if (s.pt > 0.5) { i.act.pressed = true; i.act.down = true; } }
        else {
          if (plan.p === undefined) plan.p = clamp(0.97 + gauss() * (1 - skill) * 0.12, 0.7, 1.25);
          i.act.down = true;
          if (k2.windT / WIND_FULL >= plan.p) { i.act.down = false; i.act.released = true; }
        }
      }
    } else if (s.event === 'weight' && s.wt) {
      const w = s.wt;
      if (s.ph === 'spin') {
        const need = S.needSpeed(w.bar) + 0.35;
        if (plan.pe === undefined) plan.pe = {};
        const toNext = ((Math.PI * 2 - (((w.a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2))) % (Math.PI * 2)) / Math.max(0.5, w.w);
        if (w.vb < need && !w.inArc) {
          const lapKey = w.lap + (toNext < 0.3 ? 1 : 0);
          if (plan.pe[lapKey] === undefined) plan.pe[lapKey] = gauss() * sd * 0.8;
          if (toNext < 0.3 && Math.abs(toNext - -plan.pe[lapKey]) < 1 / 100 && !plan.pe['d' + lapKey]) { plan.pe['d' + lapKey] = 1; i.act.pressed = true; }
        } else if (w.vb >= need && w.w > 0) {
          const sweet = S.sweetAngle(w.vb, w.bar);
          if (plan.r === undefined) plan.r = sweet + gauss() * (1 - skill) * 0.13;
          const a = ((w.a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          if (w.inArc && a >= plan.r && !plan.rd) { plan.rd = 1; i.act.pressed = true; }
        }
      }
    }
    return i;
  };
}

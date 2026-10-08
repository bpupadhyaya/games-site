// The visible life of one throw, shared by the match and the title-screen demo. A "table" is { target, rest, fly, ex }:
// target = the tile lying on the floor, rest = the tile that was just thrown (once it lands), fly = the tile in the air.
// Everything that matters was decided in sim.js (resolveThrow); this only replays it frame by frame and reports events.
import { flightPose, THICK } from './sim.js';

const ease = (t) => 1 - Math.pow(1 - t, 3);

export function beginFlight(tb, out, held) {
  tb.ex = { out, t: 0, phase: 'fly', held, t2: 0, flipSnd: false };
  tb.fly = { ...flightPose(out.land, out.aim.s, 0), pat: held.pat };
  tb.rest = null;
}

// Advances the replay by dt. Returns a list of events: { type: 'impact' | 'lift' | 'settle' | 'done', ... }.
export function stepAnim(tb, dt) {
  const ev = [], e = tb.ex; if (!e) return ev;
  const out = e.out;
  if (e.phase === 'fly') {
    e.t += dt;
    const u = Math.min(1, e.t / out.T);
    tb.fly = { ...flightPose(out.land, out.aim.s, u), pat: e.held.pat };
    if (u >= 1) {
      e.phase = 'react'; e.t2 = 0;
      tb.fly = null;
      tb.rest = { x: out.land.x, y: out.land.y, z: out.kind === 'pinned' ? THICK : 0, yaw: out.land.yaw, pat: e.held.pat, mass: e.held.mass, atop: out.kind === 'pinned', theta: 0 };
      if (tb.target) tb.target.lift = { x: out.nl.x, y: out.nl.y };
      ev.push({ type: 'impact', out });
    }
  } else if (e.phase === 'react') {
    e.t2 += dt;
    const k = Math.min(1, e.t2 / 0.3);
    if (tb.rest) {
      const sx = out.rest.x - out.land.x, sy = out.rest.y - out.land.y, s = ease(k);
      tb.rest.x = out.land.x + sx * s; tb.rest.y = out.land.y + sy * s;
      const hop = e.t2 < 0.22 && out.aim.s > 0.45 ? Math.sin((e.t2 / 0.22) * Math.PI) * 0.1 * out.aim.s : 0;
      tb.rest.z = (out.kind === 'pinned' ? THICK : 0) + hop;
    }
    const arr = out.theta, f = e.t2 * 60, i = Math.min(arr.length - 1, Math.floor(f)), j = Math.min(arr.length - 1, i + 1), fr = f - i;
    if (tb.target) tb.target.theta = arr[i] + (arr[j] - arr[i]) * fr;
    if (!e.lifted && tb.target && tb.target.theta > 0.08) { e.lifted = true; ev.push({ type: 'lift', out }); }
    if (out.flipped && !e.landed && f >= arr.length - 1) { e.landed = true; ev.push({ type: 'settle', out }); }
    if (f >= arr.length - 1 + 18) { e.phase = 'done'; ev.push({ type: 'done', out }); }
  }
  return ev;
}

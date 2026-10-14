// A throw in motion: the flight (for the chase camera), the landing, the slide and any shoes it pushes. The plan is computed up
// front by sim.resolveThrow; this plays it back in time and tells the caller what happened when, so sound and dust line up.
import { FLIGHT_T, FLIPS, flightPos } from './sim.js';

export const REST_T = 0.95;

export function makeAnim(plan, p, side, base, team) {
  const n = Math.max(1, plan.slide.length);
  return {
    t: 0, plan, side, p, team: team ?? side, id: plan.me.id, fired: 0, hit: 0, landed: false,
    slideDur: plan.slide.length ? Math.min(0.55, 0.16 + n * 0.012) : 0.12, base: base.map((s) => ({ ...s })), finished: false,
  };
}
export function animTotal(a) { return FLIGHT_T + a.slideDur + REST_T; }

// advance by dt; returns the list of things that happened this step: { t:'land'|'clank'|... , x, v }
export function stepAnim(a, dt, world) {
  const out = [];
  const prev = a.t;
  a.t += dt;
  const plan = a.plan, turns = FLIPS[a.p.flip].turns;
  if (a.t < FLIGHT_T) {
    const k = a.t / FLIGHT_T, pos = flightPos(plan.land, k);
    const spin = (turns + Math.max(0, Math.min(0.25, 0.25 * Math.abs(a.p.e || 0)))) * Math.PI * 2;
    world.fly = { pos, phi: -spin * (1 - k), roll: Math.sin(k * 5 + a.id) * 0.15 * (1 - k), team: a.team, k, land: plan.land };
    return out;
  }
  world.fly = null;
  if (!a.landed) {
    a.landed = true;
    world.shoes = a.base.map((s) => ({ ...s }));
    world.shoes.push({ id: a.id, side: a.side, x: plan.land.x, v: plan.land.v, ang: plan.land.ang, dead: false, ringer: false });
  }
  const ts = a.t - FLIGHT_T;
  const idx = a.slideDur > 0 && plan.slide.length ? Math.min(plan.slide.length, Math.floor((ts / a.slideDur) * plan.slide.length)) : 0;
  const me = world.shoes.find((s) => s.id === a.id);
  if (me && idx > 0) { const q = plan.slide[Math.min(idx, plan.slide.length) - 1]; me.x = q.x; me.v = q.v; me.ang = q.ang; }
  const at = (e) => (e.at ?? 0);
  while (a.fired < plan.events.length && at(plan.events[a.fired]) <= idx && (idx > 0 || at(plan.events[a.fired]) === 0)) {
    const e = plan.events[a.fired++];
    out.push(e);
  }
  while (a.hit < plan.hits.length && plan.hits[a.hit].at <= idx) {
    const h = plan.hits[a.hit++];
    const o = world.shoes.find((s) => s.id === h.id);
    if (o) { o.x = h.to.x; o.v = h.to.v; o.ang = h.to.ang; }
  }
  if (ts >= a.slideDur && !a.finished) {
    a.finished = true;
    // snap to the exact final result (including ringer flags and anything knocked out)
    while (a.fired < plan.events.length) out.push(plan.events[a.fired++]);
    world.shoes = plan.shoes.map((s) => ({ ...s }));
  }
  void prev;
  return out;
}
export const animDone = (a) => a.t >= animTotal(a);

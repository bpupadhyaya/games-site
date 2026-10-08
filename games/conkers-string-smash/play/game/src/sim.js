// The duel physics: two conkers, each a bob on a string (a pendulum) hanging from a hand. Pure and deterministic; no clock, no randomness
// (the game hands in everything that varies). Units are metres and seconds; x runs toward the defender, y runs DOWN, angle phi is measured from the
// straight-down string and is positive toward +x. The striker is always on the left in this world (the view mirrors it when the other player strikes).
// The defender's hand is not quite still: it wobbles sideways a little (amplitude A, angular speed w), so the hanging conker sways and the striker
// has to time the release.
export const L = 0.5;            // string length from the hand to the middle of the conker
export const R = 0.07;           // conker radius
export const G = 9.81;
export const DT = 1 / 240;
export const REST = 0.7;         // how bouncy a conker-on-conker hit is
export const OMEGA0 = Math.sqrt(G / L);   // small-swing angular frequency, rad/s
export const PD = { x: 0.45, y: 0 };      // the defender's hand (middle of its wobble)
export const PS = { x: 0.04, y: 0.09 };   // the striker's hand at the middle height
export const HAND_RANGE = 0.07;           // how far the striker's hand moves up (+) or down (-)
export const PULL_MIN = 0.2, PULL_MAX = 1.75;   // pull-back angle limits, radians (about 11 to 100 degrees)
export const FLICK_KICK = 4.2;            // extra angular speed (rad/s) of a full flick at the moment of release
export const WOBBLE_W = 3.7;              // angular speed of the defender's hand wobble (period about 1.7 s)
export const WOBBLE_PERIOD = (2 * Math.PI) / WOBBLE_W;
export const DAMP = 0.1;

export const strikerHand = (hand) => ({ x: PS.x, y: PS.y - HAND_RANGE * hand });
export const bobPos = (p, phi) => ({ x: p.x + L * Math.sin(phi), y: p.y + L * Math.cos(phi) });
// where the defender's hand is at wobble clock `c`, and how fast it is being accelerated sideways
export const defHand = (sw, c) => ({ x: PD.x + sw.A * Math.sin(WOBBLE_W * c), y: PD.y });
const defAcc = (sw, c) => -sw.A * WOBBLE_W * WOBBLE_W * Math.sin(WOBBLE_W * c);

// A swing: `plan` = { pull (rad), hand (-1..1, + = higher), delay (s the striker holds the pulled-back conker before letting go; a huge value = held),
// flick (0..1) }; `d` = { phi, om } the defender's conker as it hangs; `sw` = { A, c } the wobble (amplitude in metres, clock in seconds at t = 0).
export function newSim(plan, d, ms = 1, md = 1, sw = { A: 0.03, c: 0 }) {
  const pull = Math.max(PULL_MIN, Math.min(PULL_MAX, plan.pull));
  const hand = Math.max(-1, Math.min(1, plan.hand));
  return {
    t: 0, releaseT: Math.max(0, plan.delay ?? 0), released: false, done: false, doneT: 0, hitT: -1, hits: [], pull, hand,
    kick: Math.max(0, Math.min(1, plan.flick || 0)) * FLICK_KICK, relT: 0,
    ps: strikerHand(hand), pd: defHand(sw, sw.c), damp: DAMP, live: true, passed: false, sw: { A: sw.A, c: sw.c },
    S: { phi: -pull, om: 0, m: ms }, D: { phi: d.phi, om: d.om, m: md },
  };
}

const integrate = (b, damp, ax = 0) => { b.om += (-(G / L) * Math.sin(b.phi) - (ax / L) * Math.cos(b.phi) - damp * b.om) * DT; b.phi += b.om * DT; };

export function setHand(s, hand) { s.hand = Math.max(-1, Math.min(1, hand)); s.ps = strikerHand(s.hand); }
export function setPull(s, pull) { s.pull = Math.max(PULL_MIN, Math.min(PULL_MAX, pull)); }

export function stepSim(s) {
  if (!s.released && s.t >= s.releaseT) { s.released = true; s.S.om = s.kick; s.relT = s.t; }
  if (s.released) integrate(s.S, s.damp); else { s.S.phi = -s.pull; s.S.om = 0; }
  const c = s.sw.c + s.t;
  integrate(s.D, s.damp, defAcc(s.sw, c));
  s.t += DT;
  s.pd = defHand(s.sw, s.sw.c + s.t);
  if (s.released) {
    const a = bobPos(s.ps, s.S.phi), b = bobPos(s.pd, s.D.phi);
    const nx = a.x - b.x, ny = a.y - b.y, dist = Math.hypot(nx, ny);
    if (dist < 2 * R && dist > 1e-6) {
      const ux = nx / dist, uy = ny / dist;
      const tS = { x: Math.cos(s.S.phi), y: -Math.sin(s.S.phi) }, tD = { x: Math.cos(s.D.phi), y: -Math.sin(s.D.phi) };
      const vS = { x: L * s.S.om * tS.x, y: L * s.S.om * tS.y }, vD = { x: L * s.D.om * tD.x, y: L * s.D.om * tD.y };
      const vn = ux * (vS.x - vD.x) + uy * (vS.y - vD.y);
      if (vn < 0) {
        const cS = ux * tS.x + uy * tS.y, cD = ux * tD.x + uy * tD.y;
        const den = (cS * cS) / s.S.m + (cD * cD) / s.D.m;
        if (den > 1e-9) {
          const j = (-(1 + REST) * vn) / den;
          const phiS = s.S.phi, phiD = s.D.phi;
          s.S.om += (j * cS) / (s.S.m * L);
          s.D.om -= (j * cD) / (s.D.m * L);
          const mu = (s.S.m * s.D.m) / (s.S.m + s.D.m);
          if (s.live) {
            if (s.hitT < 0) s.hitT = s.t;
            s.hits.push({ t: s.t, E: 0.5 * mu * vn * vn, vn: -vn, j, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, nx: ux, ny: uy, phiS, phiD });
          } else s.bumps = (s.bumps || 0) + 1;
        }
      }
    }
    if (!s.done) {
      if (s.S.phi > 0.25) s.passed = true;
      const fell = s.passed && s.S.om < 0;            // the swing has gone as far as it will and is coming back
      if (s.hitT >= 0 ? s.t >= s.hitT + 0.15 : (fell && s.t > s.relT + 0.35) || s.t > s.relT + 2.2) { s.done = true; s.doneT = s.t; s.live = false; }
    }
  }
  return s;
}

// How hard the swing struck: total energy of the hits inside the swing window (J-like), the contact geometry of the first one.
export function runSwing(plan, d, ms, md, sw, maxSteps = 2000) {
  const s = newSim(plan, d, ms, md, sw);
  let n = 0;
  const lim = maxSteps + Math.round(Math.min(plan.delay || 0, 50) / DT);
  while (!s.done && n++ < lim) stepSim(s);
  const E = s.hits.reduce((a, h) => a + h.E, 0);
  return { s, E, hit: s.hits.length > 0, first: s.hits[0] || null };
}

// Between swings the conkers settle: heavier damping, no hits. Advances both bobs by dt seconds (the wobble keeps driving the defender's).
export function settleSim(s, dt, damp = 1.6) {
  const n = Math.max(1, Math.round(dt / DT));
  for (let i = 0; i < n; i++) {
    if (s.released) integrate(s.S, damp); else { s.S.phi = -s.pull; s.S.om = 0; }
    integrate(s.D, DAMP, defAcc(s.sw, s.sw.c + s.t));
    s.t += DT;
  }
  s.pd = defHand(s.sw, s.sw.c + s.t);
}

// The defender alone, t seconds on (it keeps swaying while the striker thinks and draws back). Returns the new conker state and the new wobble clock.
export function advanceD(d, t, sw) {
  const b = { phi: d.phi, om: d.om };
  const n = Math.round(t / DT);
  for (let i = 0; i < n; i++) integrate(b, DAMP, defAcc(sw, sw.c + i * DT));
  return { phi: b.phi, om: b.om, sw: { A: sw.A, c: sw.c + n * DT } };
}

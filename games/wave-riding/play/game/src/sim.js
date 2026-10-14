// Wave Riding: the simulation of one ride. Pure and deterministic (no DOM, no clock, no Math.random).
//
// The model in one paragraph. A wave peels along a beach. The breaking foam ("the curl") travels along the wave at a steady
// speed; the rider is at distance d metres ahead of it and must never let it catch up. The rider carves up and down the
// face: going DOWN the face (and, less, back up) pumps energy E into the board, drag takes it away. Speed over the foam is
// proportional to E - E0, so pumping moves the rider ahead of the curl and stillness lets the foam close in. The pocket
// (d about 4 to 26 m) is where the face is steep and the wave pushes best; far ahead on the shoulder it is flat and weak.
// Along the ride sit glints ("gates") that trace a good pumping line, hollow stretches (tubes: ride low and close to the
// foam), foam bursts that fill part of the face, and lip gates at the very top that launch an air.
//
// Units: metres, seconds. y is the height on the face, 0 = trough, 1 = lip.
export const STEP = 1 / 60;
export const RIDES_PER_SESSION = 3;
export const E0 = 0.45;          // the energy at which the rider holds its distance to the foam
export const KV = 6.5;           // m/s of speed over the foam per unit of energy above E0
export const TUBE_D = [2.5, 14]; // distance to the foam that counts as inside the tube
export const TUBE_Y = [0.16, 0.64];
export const FOAM_D = 0.5;       // the foam catches the rider below this distance
export const AIR_Y = 0.82;       // height needed to launch from a lip gate
export const MAX_D = 70;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const seeded = (a) => {
  let s = (a | 0) >>> 0;
  return { next() { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } };
};

// Boards: turn = fastest vertical carve (face heights per second), pump = how much a carve gives, drag = how fast speed
// bleeds, tol = how forgiving the gates are (face height). need = best ride score that unlocks it.
export const BOARDS = [
  { id: 0, name: 'Mellow Log', how: 'Long and stable: forgiving gates, slow to turn.', turn: 1.15, pump: 0.95, drag: 0.15, tol: 0.2, need: 0, col: ['#f6dfa4', '#d99a3a', '#7a4a14'] },
  { id: 1, name: 'Twin Fish', how: 'Quick and lively: turns fast, wants a steady rhythm.', turn: 1.55, pump: 1.05, drag: 0.165, tol: 0.17, need: 1000, col: ['#bff0e6', '#2fb3a1', '#0f5148'] },
  { id: 2, name: 'Short Thruster', how: 'Sharp and loose: the most speed from every carve.', turn: 2.1, pump: 1.3, drag: 0.2, tol: 0.15, need: 2200, col: ['#ffd1c4', '#ec6a4c', '#7c2414'] },
  { id: 3, name: 'Big Gun', how: 'Fast and calm on a long wall, hard to turn.', turn: 1.3, pump: 0.95, drag: 0.115, tol: 0.18, need: 3600, col: ['#d6d8ff', '#6a6de0', '#23246e'] },
];

// Beaches. vF0 -> vF1 = speed of the foam along the wave (m/s) over the first 50 s; len = length of the wave; lam = length of
// one carve cycle on the pumping line (m); amp = height of that line; tubes/bursts = how many per 100 m; gap = gate spacing.
export const BEACHES = [
  { id: 0, name: 'Dawn Cove', time: 'Dawn', vF0: 9.0, vF1: 10.5, len: 520, lam: 62, amp: 0.27, tubes: 0.35, bursts: 0.25, lips: 0.55, gap: 15, need: 0, blurb: 'Soft, even waves at sunrise. The place to learn.' },
  { id: 1, name: 'Reef Point', time: 'Noon', vF0: 10.5, vF1: 12.5, len: 640, lam: 56, amp: 0.3, tubes: 0.7, bursts: 0.4, lips: 0.5, gap: 15, need: 1000, blurb: 'A hollow wave that stands up and throws a tube.' },
  { id: 2, name: 'Long Bay', time: 'Sunset', vF0: 9.5, vF1: 11.5, len: 860, lam: 66, amp: 0.3, tubes: 0.5, bursts: 0.5, lips: 0.7, gap: 15, need: 2200, blurb: 'One long, slow wall that goes on and on.' },
  { id: 3, name: 'Storm Head', time: 'Night', vF0: 12, vF1: 14.5, len: 720, lam: 54, amp: 0.32, tubes: 0.8, bursts: 0.8, lips: 0.5, gap: 14, need: 3600, blurb: 'Fast, heavy water under the moon: foam bursts everywhere.' },
];

export const footSpeed = (wave, t) => wave.vF0 + (wave.vF1 - wave.vF0) * Math.min(1, t / 50) + 0.7 * Math.sin(t * 0.37 + wave.ph);
// How hollow the wave is at distance s along it (0..1): a smooth bump over every tube section.
export function hollowAt(wave, s) {
  let h = 0;
  for (const u of wave.tubes) h = Math.max(h, smooth(u.s0 - 10, u.s0 + 6, s) * (1 - smooth(u.s1 - 6, u.s1 + 10, s)));
  return h;
}
// The pocket: the wave pushes best here.
export const pocketOf = (d) => (d <= 26 ? 1 : 1 - 0.7 * smooth(26, 62, d));

// ---- building a wave -----------------------------------------------------------------------------------------------------
// A wave is plain data: sections along the wave, positions in metres from where the rider drops in.
export function makeWave(beachIdx, rng) {
  const B = BEACHES[beachIdx], len = B.len;
  const w = { beach: beachIdx, len, vF0: B.vF0, vF1: B.vF1, ph: rng.next() * 6.28, lamPh: rng.next() * 6.28, tubes: [], bursts: [], gates: [] };
  // tubes: hollow stretches 70..110 m long, never in the first 60 m or the last 90 m
  let s = 70 + rng.next() * 30;
  while (s < len - 140) {
    const l = 60 + rng.next() * 40;
    if (rng.next() < Math.min(0.95, B.tubes * 1.5)) { w.tubes.push({ s0: s, s1: s + l }); s += l + 70 + rng.next() * 60; } else s += 60 + rng.next() * 50;
  }
  // bursts: foam columns on the face, away from the tubes
  s = 60 + rng.next() * 30;
  while (s < len - 70) {
    const clear = w.tubes.every((u) => s < u.s0 - 20 || s > u.s1 + 14);
    if (clear && rng.next() < 0.75) {
      const low = rng.next() < 0.55;
      w.bursts.push({ s, w: 7 + rng.next() * 3, kind: low ? 'low' : 'high', e: low ? 0.5 + rng.next() * 0.1 : 0.55 + rng.next() * 0.1 });
    }
    s += 100 / Math.max(0.15, B.bursts) * (0.6 + rng.next() * 0.5);
  }
  // lip gates: ramps at the very top
  const lipS = [];
  s = 90 + rng.next() * 40;
  while (s < len - 60) {
    if (w.tubes.every((u) => s < u.s0 - 12 || s > u.s1 + 12) && w.bursts.every((b) => Math.abs(b.s - s) > 34)) lipS.push(s);
    s += 100 / Math.max(0.2, B.lips) * (0.8 + rng.next() * 0.5);
  }
  // gates: a pumping line, bent for the tubes, the bursts and the lip gates
  for (s = 22; s < len - 14; s += B.gap) {
    let y = 0.5 + B.amp * Math.sin((2 * Math.PI * s) / B.lam + w.lamPh);
    const h = hollowAt(w, s);
    y = y * (1 - 0.8 * h) + 0.4 * 0.8 * h;
    for (const b of w.bursts) {
      const dd = s - b.s;
      if (dd > -16 && dd < 9) { if (b.kind === 'low') y = Math.max(y, b.e + 0.24); else y = Math.min(y, b.e - 0.26); }
    }
    let lip = false;
    for (const ls of lipS) {
      const dd = s - ls;
      if (Math.abs(dd) < B.gap * 0.5) { y = 1; lip = true; } else if (dd > -B.gap * 1.6 && dd < 0) y = Math.max(y, 0.7); else if (dd > 0 && dd < B.gap * 1.6) y = Math.max(y, 0.62);
    }
    w.gates.push({ s: Math.round(s * 10) / 10, y: Math.round(clamp(y, 0.08, 1) * 100) / 100, lip });
  }
  return w;
}

// ---- a ride ----------------------------------------------------------------------------------------------------------------
// q = quality of the catch (0..1): paddling and the pop-up. It sets the start energy and the head start on the foam.
export function newRide(wave, board, q = 0.7) {
  return {
    t: 0, s: 0, d: 16 + 12 * q, y: 0.35, vy: 0, E: 0.38 + 0.2 * q, v: 0, ty: 0.4, F: 0,
    combo: 0, mult: 1, score: 0, gi: 0, bog: 0, tubeT: 0, tubeTotal: 0, tubeNow: false, tubeRuns: 0, curTubeT: 0,
    air: null, wiped: false, done: false, finished: false, why: '',
    board: board.id, events: [], stats: { gates: 0, hits: 0, airs: 0, clean: 0, bursts: 0, bestCombo: 0, tubeBest: 0, tubes: 0, dist: 0, pocketT: 0 },
    flickT: 0, lastPx: 0, lastLand: null,
  };
}
const ev = (r, type, o = {}) => { if (r.events.length < 40) r.events.push({ type, t: r.t, ...o }); };
const multOf = (c) => 1 + Math.min(4, Math.floor(c / 4));

// Steps the ride by dt with `in` = { ty (target height or null for hands off), flick (bool: a spin impulse) }.
export function stepRide(r, wave, inp, dt = STEP) {
  if (r.done) return;
  const B = BOARDS[r.board];
  r.t += dt;
  const vF = footSpeed(wave, r.t);
  const hollow = hollowAt(wave, r.s);
  // ---- steering
  if (!r.air) {
    r.ty = inp.ty == null ? r.ty + (0.42 - r.ty) * Math.min(1, dt * 0.8) : clamp(inp.ty, 0, 1);
    const want = clamp((r.ty - r.y) * 5.2, -B.turn, B.turn);
    r.vy += (want - r.vy) * Math.min(1, dt * 9);
    r.y = clamp(r.y + r.vy * dt, 0, 1);
    if ((r.y <= 0 && r.vy < 0) || (r.y >= 1 && r.vy > 0)) r.vy = 0;
  }
  // ---- energy: carving pumps, drag takes away
  const pocket = pocketOf(r.d);
  const inTube = !r.air && hollow > 0.5 && r.d >= TUBE_D[0] && r.d <= TUBE_D[1] && r.y >= TUBE_Y[0] && r.y <= TUBE_Y[1];
  if (!r.air) {
    const pump = B.pump * pocket * (Math.max(0, -r.vy) + 0.45 * Math.max(0, r.vy));
    let drag = B.drag * (0.5 + r.E) + (r.y > 0.86 ? 0.08 : 0);
    if (inTube) drag *= 0.35;
    r.E = clamp(r.E + (pump - drag) * dt, 0, 1);
  } else {
    r.E = clamp(r.E - 0.03 * dt, 0, 1);
  }
  if (r.bog > 0) r.bog = Math.max(0, r.bog - dt);
  // ---- motion along the wave
  r.v = vF + (r.E - E0) * KV;
  r.s += r.v * dt;
  r.d = clamp(r.d + (r.v - vF) * dt, -5, MAX_D);
  r.stats.dist = r.s;
  if (r.d > 12 && r.d <= 26) r.stats.pocketT += dt;
  // ---- tube
  if (inTube) {
    if (!r.tubeNow) { r.tubeNow = true; r.curTubeT = 0; ev(r, 'tube-in'); }
    r.curTubeT += dt; r.tubeT += dt; r.tubeTotal += dt;
    r.score += 32 * r.mult * dt;
    r.stats.tubeBest = Math.max(r.stats.tubeBest, r.curTubeT);
  } else if (r.tubeNow) {
    r.tubeNow = false;
    if (r.curTubeT >= 1.4) { const bonus = Math.round(90 + 55 * r.curTubeT); r.score += bonus; r.stats.tubes++; ev(r, 'tube-out', { secs: r.curTubeT, pts: bonus }); } else ev(r, 'tube-lost');
    r.curTubeT = 0;
  }
  // ---- air
  if (r.air) {
    const a = r.air;
    a.t += dt;
    a.rotV = (a.target - a.rot) * 7.5;
    a.rot += clamp(a.rotV, -900, 900) * dt * 1;
    if (inp.flick && a.flicks < 3 && a.t < a.dur - 0.12) { a.flicks++; a.target += 180; ev(r, 'spin', { n: a.flicks }); }
    if (a.t >= a.dur) landAir(r);
  }
  // ---- gates
  while (r.gi < wave.gates.length && wave.gates[r.gi].s <= r.s) {
    const g = wave.gates[r.gi++];
    r.stats.gates++;
    if (r.air) { continue; }
    if (g.lip) {
      if (r.y >= AIR_Y && r.E >= 0.3 && r.bog <= 0) { launch(r); } else { ev(r, 'miss', { lip: true }); r.combo = 0; r.mult = 1; }
      continue;
    }
    if (Math.abs(r.y - g.y) <= B.tol) {
      r.combo++; r.mult = multOf(r.combo); r.stats.hits++; r.stats.bestCombo = Math.max(r.stats.bestCombo, r.combo);
      const pts = Math.round(14 * r.mult * (r.d <= 22 ? 1.5 : r.d <= 40 ? 1 : 0.6));
      r.score += pts; ev(r, 'gate', { pts, mult: r.mult, y: g.y });
    } else { if (r.combo > 0) ev(r, 'miss', {}); r.combo = 0; r.mult = 1; }
  }
  // ---- foam bursts
  if (!r.air && r.bog <= 0) {
    for (const b of wave.bursts) {
      if (Math.abs(r.s - b.s) <= b.w / 2 && (b.kind === 'low' ? r.y < b.e : r.y > b.e)) {
        r.bog = 1.4; r.E = Math.max(0, r.E - 0.36); r.d = Math.max(FOAM_D + 1, r.d - 3); r.combo = 0; r.mult = 1; r.stats.bursts++;
        ev(r, 'burst', { kind: b.kind });
        break;
      }
    }
  }
  // ---- end of the ride
  if (!r.air && r.d <= FOAM_D) { r.done = true; r.wiped = true; r.why = 'foam'; ev(r, 'wipe', { why: 'foam' }); return; }
  if (r.s >= wave.len) {
    r.done = true; r.finished = true;
    const bonus = 150 + Math.round(2 * r.stats.hits);
    r.score += bonus; ev(r, 'finish', { pts: bonus });
  }
}
function launch(r) {
  r.air = { t: 0, dur: 0.85 + 0.55 * r.E, rot: 0, target: 0, rotV: 0, flicks: 0, y0: r.y };
  r.stats.airs++; ev(r, 'air');
}
function landAir(r) {
  const a = r.air; r.air = null;
  const half = Math.round(a.rot / 180), err = Math.abs(a.rot - half * 180), n = Math.abs(half);
  let kind = 'clean';
  if (n % 2 === 1 || err > 38) kind = (err <= 38 && n % 2 === 1) ? 'fakie' : err <= 70 ? 'rough' : 'sloppy';
  // an odd number of half turns lands backwards: allowed but worth less
  const base = [160, 300, 520, 800][Math.min(3, n)];
  let pts = 0;
  if (err <= 38 && n % 2 === 0) { pts = base; kind = 'clean'; }
  else if (err <= 38) { pts = Math.round(base * 0.6); kind = 'fakie'; }
  else if (err <= 70) { pts = Math.round(base * 0.25); kind = 'rough'; }
  else { kind = 'sloppy'; }
  r.y = 0.62; r.vy = -0.3; r.ty = 0.5;
  if (kind === 'sloppy') { r.E = Math.max(0, r.E - 0.3); r.combo = 0; r.mult = 1; r.bog = 0.8; }
  else {
    r.E = clamp(r.E + (kind === 'clean' ? 0.2 : 0.06), 0, 1);
    pts = Math.round(pts * r.mult); r.score += pts; if (kind === 'clean' || kind === 'fakie') r.stats.clean++;
    r.combo += kind === 'clean' ? 3 : 1; r.mult = multOf(r.combo); r.stats.bestCombo = Math.max(r.stats.bestCombo, r.combo);
  }
  r.lastLand = { kind, turns: n / 2, pts };
  ev(r, 'land', { kind, turns: n / 2, pts });
}

// ---- the pilot (Watch & Learn and the Think hint) -----------------------------------------------------------------------------
// Returns { ty, flick }. It follows the pumping line, stalls to tuck into a tube, and spins for a clean landing. `skill`
// (0..1) adds a human's slowness: the target is read a little late and a little off.
export function lineAt(wave, s) {
  const g = wave.gates;
  if (!g.length) return 0.5;
  if (s <= g[0].s) return g[0].y;
  for (let i = 1; i < g.length; i++) {
    if (s <= g[i].s) { const a = g[i - 1], b = g[i], t = (s - a.s) / Math.max(0.01, b.s - a.s); return a.y + (b.y - a.y) * t; }
  }
  return g[g.length - 1].y;
}
export function pilot(r, wave, skill = 0.9) {
  const lead = 0.28 + 0.12 * skill;
  let ty = lineAt(wave, r.s + r.v * lead);
  const hol = hollowAt(wave, r.s + 6);
  if (!r.air && hol > 0.35) {
    // in a hollow stretch: let the foam close in until it is at the mouth of the tube, then hold it there
    if (r.d > 15) ty = 0.28;
    else if (r.d < 5.5) ty = clamp(0.45 + 0.22 * Math.sin(r.t * 4.4), 0, 1);
    else ty = 0.4;
  } else if (r.d < 7 && !r.air) {
    ty = clamp(0.5 + 0.34 * Math.sin(r.t * 4.4), 0, 1);       // the foam is close: pump hard to get away
  }
  let flick = false;
  if (r.air) {
    const a = r.air, wantTurn = r.E > 0.6 ? 2 : 1;
    if (a.target < wantTurn * 180 && a.flicks < 3 && a.t > 0.04 && a.t < a.dur - 0.5 && a.t > a.flicks * 0.3) flick = true;
  }
  return { ty, flick };
}

// The scouting report shown while thinking: the key sections of the wave, in plain words.
export function scout(wave) {
  const out = [];
  wave.tubes.forEach((u) => out.push({ s: u.s0, kind: 'tube', text: `Tube from ${Math.round(u.s0)} m: slow down, sit low and tuck in close to the foam.` }));
  wave.bursts.forEach((b) => out.push({ s: b.s, kind: 'burst', text: b.kind === 'low' ? `Foam burst at ${Math.round(b.s)} m on the lower face: climb above it.` : `Lip crash at ${Math.round(b.s)} m on the upper face: stay low.` }));
  wave.gates.filter((g) => g.lip).forEach((g) => out.push({ s: g.s, kind: 'lip', text: `Lip at ${Math.round(g.s)} m: ride up to the very top, then flick to spin.` }));
  out.sort((a, b) => a.s - b.s);
  return out;
}
// One line about what to do right now (the Think hint).
export function adviceNow(r, wave) {
  const list = scout(wave).filter((x) => x.s > r.s - 4 && x.s < r.s + 90);
  if (r.air) return 'In the air: flick sideways once or twice for a clean landing, then let go.';
  if (r.d < 6) return 'The foam is right behind you: carve down the face hard to speed away.';
  if (list.length) return list[0].text.replace(/ at \d+ m| from \d+ m/, ' ahead');
  if (r.d > 40) return 'You are far ahead on the shoulder: slow down and drop back into the pocket.';
  return 'Follow the glints: carve down, then up, in an easy rhythm.';
}

// ---- paddle and pop-up ------------------------------------------------------------------------------------------------------
export const PADDLE = { dur: 3.4, ring: [2.25, 3.0], ideal: 2.62 };
export function newPaddle() { return { t: 0, taps: 0, power: 0, popped: false, q: 0, done: false, tapT: -1 }; }
// action: 'tap' (a paddle stroke), 'pop' (stand up). The first tap before the ring is a stroke, a tap in/after the ring pops up.
export function stepPaddle(p, act, dt = STEP) {
  if (p.done) return;
  p.t += dt;
  p.power = Math.max(0, p.power - dt * 0.35);
  if (act === 'tap') {
    if (p.t < PADDLE.ring[0] - 0.15) { p.taps++; p.power = Math.min(1, p.power + 0.22); p.tapT = p.t; }
    else pop(p);
  }
  if (!p.done && p.t >= PADDLE.dur) pop(p, true);
}
function pop(p, late = false) {
  const off = Math.abs(p.t - PADDLE.ideal);
  const timing = late ? 0.15 : clamp(1 - off / 0.55, 0, 1);
  p.q = clamp(0.25 + 0.5 * timing + 0.25 * Math.min(1, p.taps / 5), 0, 1);
  p.popped = true; p.done = true; p.late = late;
}

export const rankFor = (total) => (total >= 12000 ? 'Wave Master' : total >= 9000 ? 'Barrel Hunter' : total >= 6000 ? 'Wave Rider' : total >= 3500 ? 'Cruiser' : total >= 1500 ? 'Paddler' : 'First Wave');
export const rideRank = (s) => (s >= 5000 ? 'Epic ride' : s >= 3000 ? 'Great ride' : s >= 1600 ? 'Good ride' : s >= 700 ? 'Nice ride' : 'Keep paddling');

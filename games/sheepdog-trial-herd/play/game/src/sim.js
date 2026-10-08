// The trial: a flock of sheep with flight zones, cohesion and a lead ewe; a border collie that obeys five commands; a handler at the post;
// the phases of a trial (outrun, lift, fetch, drive, pen) and the judge's score. Pure and deterministic: every random draw comes from the rng
// handed in, time only from dt. Positions are metres, x to the handler's right, z up the course, heading h means forward = (sin h, cos h).
import { clamp, lerp, hyp, wrapAng } from './util.js';
import { COURSES, courseWalls, courseCircles, penGeom, slopeAlong } from './courses.js';
import { createLesson, checkLesson } from './training.js';

export const DT = 1 / 60;
export const CMDS = ['away', 'comebye', 'walkon', 'lie', 'stand'];
export const CMD_NAME = { away: 'Away to me', comebye: 'Come bye', walkon: 'Walk on', lie: 'Lie down', stand: 'Stand' };

// dog speeds in m/s
export const DOG_V = { walk: 1.7, trot: 4.8, gallop: 8.6, creep: 0.7 };
// the sheep
const SHEEP_V = { walk: 0.9, max: 6.4 };
const PHASE_PTS = { outrun: 15, lift: 10, fetch: 20, drive: 20, pen: 15, time: 10, control: 10 };
export { PHASE_PTS };

export const WEATHER = {
  clear: { name: 'Clear', Z: 1, skit: 0, wind: 0, stam: 1, blurb: 'Steady conditions.' },
  breeze: { name: 'Breezy', Z: 1, skit: 0.04, wind: 0.32, stam: 1.12, blurb: 'The wind pushes the flock along and tires the dog a little.' },
  mist: { name: 'Mist', Z: 0.88, skit: -0.04, wind: 0, stam: 1, blurb: 'Sheep see the dog late and are calmer, the view is short.' },
  rain: { name: 'Rain', Z: 1.1, skit: 0.1, wind: 0.14, stam: 1.06, blurb: 'Sheep are livelier and the flight zone is wider.' },
};
export const TOD = {
  dawn: { name: 'Dawn', rest: 1.2, coh: 1.0, blurb: 'Cool air: the dog recovers its breath faster.' },
  day: { name: 'Day', rest: 1, coh: 1, blurb: 'Full daylight.' },
  dusk: { name: 'Dusk', rest: 1, coh: 1.2, blurb: 'Settled flock: sheep stay a little closer together.' },
};

const dirVec = (h) => ({ x: Math.sin(h), z: Math.cos(h) });
const segDist = (px, pz, s) => {
  const ex = s.x1 - s.x0, ez = s.z1 - s.z0, l2 = ex * ex + ez * ez || 1;
  const t = clamp(((px - s.x0) * ex + (pz - s.z0) * ez) / l2, 0, 1);
  const qx = s.x0 + ex * t, qz = s.z0 + ez * t;
  return { d: hyp(px - qx, pz - qz), qx, qz };
};

export function createSim(opts, rng) {
  const c = COURSES[opts.course] || COURSES.valley;
  const wx = WEATHER[opts.weather] || WEATHER.clear, td = TOD[opts.tod] || TOD.day;
  const training = !!c.training;
  const pen = penGeom(c);
  const circles = courseCircles(c);
  const R = rng.fork();
  const sh = [];
  let wallKey = 0, wallList = courseWalls(c, false);
  // ---- the flock
  for (let i = 0; i < c.n; i++) {
    let x, z, ok = false, tries = 0;
    while (!ok && tries++ < 60) {
      const a = R.range(0, Math.PI * 2), r = Math.sqrt(R.next()) * (2.4 + c.n * 0.35);
      x = c.set.x + Math.cos(a) * r; z = c.set.z + Math.sin(a) * r;
      ok = sh.every((o) => hyp(o.x - x, o.z - z) > 1.3);
    }
    sh.push({
      id: i, x, z, vx: 0, vz: 0, h: R.range(0, 6.28), alarm: 0, thr: 0, lead: i === 0, bold: i >= c.n - c.bold && i > 0,
      skit: 1 + R.range(-c.skit, c.skit) + wx.skit, graze: R.range(0, 4), mode: 'graze', size: R.range(0.92, 1.08), through: {}, side: {}, away: 0, inPen: false, stamp: 0, wob: R.range(0, 6.28),
    });
  }
  const dog = { x: 0.9, z: -1.2, h: 0, v: 0, cmd: 'stand', gait: 'stand', stamina: 1, eye: 0, crouch: 0, orbitR: 20, turn: 0, tired: false, flankAng: 0, nearest: 99 };
  const hand = { x: 0, z: 0, h: 0, v: 0, target: null, arrived: true, sig: '', sigT: 0 };
  const gates = [];
  const mkGate = (id, g, label) => g && gates.push({ id, label, ...g, through: 0, around: 0, passed: false, resolved: false, pts: 0 });
  mkGate('fetch', c.fetch, 'Fetch gate'); mkGate('d1', c.d1, 'First drive gate'); mkGate('d2', c.d2, 'Second drive gate');

  const s = {
    t: 0, course: c.id, weather: opts.weather || 'clear', tod: opts.tod || 'day', training,
    phase: training ? 'training' : 'outrun', phaseT: 0, over: false, retired: false, result: null,
    sheep: sh, dog, hand, gates, pen: pen ? { ...pen, open: false, inside: 0, closed: false, shut: false } : null,
    cen: { x: c.set.x, z: c.set.z }, rho: 3, spread: 3, events: [], evId: 0, cmdCount: 0, lastCmdT: -9,
    faults: [], pts: { outrun: 0, lift: 0, fetch: 0, drive: 0, pen: 0, time: 0, control: 0 }, done: {},
    m: { alertSec: 0, panicSec: 0, maxSpread: 0, breakaways: 0, exhausted: 0, devSum: 0, devT: 0, lostSec: 0, liftStart: null, cwTravel: 0, ccwTravel: 0, balDelta: 3 },
    task: null, lesson: training ? createLesson(opts.lesson || 0) : null, bal: { x: 0, z: 0, on: false, ang: 0 },
    dest: { x: c.set.x, z: 0 }, Z: c.Z * wx.Z,
  };
  let evSeen = 0;
  const ev = (type, o = {}) => { s.events.push({ id: ++s.evId, type, t: s.t, ...o }); if (s.events.length > 40) s.events.shift(); };

  // ---- helpers
  const alive = () => sh;
  function flockStats() {
    // in the pen phase the dog works the sheep that are still outside
    let act = sh;
    if (s.pen && s.phase === 'pen') { const o = sh.filter((a) => !a.inPen); if (o.length) act = o; }
    let cx = 0, cz = 0; for (const a of act) { cx += a.x; cz += a.z; } cx /= act.length; cz /= act.length;
    let rho = 0, mx = 0; for (const a of act) { const d = hyp(a.x - cx, a.z - cz); rho = Math.max(rho, d); mx += d; }
    s.cen.x = cx; s.cen.z = cz; s.rho = rho; s.spread = mx / act.length;
    let ax = 0, az = 0; for (const a of sh) { ax += a.x; az += a.z; } s.all = { x: ax / sh.length, z: az / sh.length };
  }
  // where should the flock go next? (the destination of the current task)
  let penAligned = false;
  function destination() {
    const g = (id) => gates.find((q) => q.id === id);
    if (training) return s.lesson ? s.lesson.dest : { x: 0, z: 4 };
    switch (s.phase) {
      case 'outrun': case 'lift': case 'fetch': {
        const f = g('fetch');
        if (!f) return { x: hand.x, z: hand.z + 6 };
        if (!f.resolved) return gateAim(f);
        return { x: 0, z: 6 };
      }
      case 'drive1': return gateAim(g('d1'));
      case 'drive2': return gateAim(g('d2'));
      case 'pen': {
        // ewes that slipped beside or behind the pen are walked round to the front of the mouth first (a push into the wall only pins them)
        const inLane = Math.abs(s.cen.x - pen.cx) < pen.m + 0.8 && s.cen.z > pen.z1 - 1;
        const inBox = s.cen.x > pen.x0 - 0.3 && s.cen.x < pen.x1 + 0.3 && s.cen.z > pen.z0 - 0.3;
        if (s.cen.z < pen.z1 + 1 && !inBox && !inLane) return { x: pen.cx, z: pen.z1 + 4, pen: true, wp: true };
        const aligned = Math.abs(s.cen.x - pen.cx) < (penAligned ? 4.2 : 2.4) && s.cen.z > pen.z1 - 0.5;
        penAligned = aligned;
        if (aligned || s.cen.z < pen.z1 + 1) return { x: pen.cx, z: pen.z0 + 1.2, pen: true };
        return { x: pen.cx, z: pen.z1 + 6, pen: true, wp: true };
      }
      default: return { x: s.cen.x, z: s.cen.z + 10 };
    }
  }
  // where the flock should head for a gate: straight through when it is lined up, else to a point on the approach axis in front of it
  function gateAim(g) {
    const lat = (s.cen.x - g.cx) * (-g.dz) + (s.cen.z - g.cz) * g.dx;
    const along = -((s.cen.x - g.cx) * g.dx + (s.cen.z - g.cz) * g.dz);          // metres before the gate
    const a = Math.abs(lat) - g.w * 0.3;
    if (a <= 0 || along < 3) return { x: g.cx + g.dx * 3, z: g.cz + g.dz * 3, gate: g };
    const k = clamp(1.6 * a + 2, 2, Math.min(15, along));
    return { x: g.cx - g.dx * k, z: g.cz - g.dz * k, gate: g, wp: true };
  }
  const nearestSheep = (x, z) => { let m = 99; for (const a of sh) m = Math.min(m, hyp(a.x - x, a.z - z)); return m; };
  const Zbase = () => c.Z * wx.Z;
  const sheepMode = (v) => (v < 0.12 ? 'graze' : v < 1.5 ? 'walk' : v < 3.6 ? 'trot' : 'run');

  // ---- commands
  function command(cmd) {
    if (s.over || !CMDS.includes(cmd) || cmd === dog.cmd) return false;
    const prev = dog.cmd;
    dog.cmd = cmd; s.cmdCount++; s.lastCmdT = s.t;
    if (cmd === 'comebye' || cmd === 'away') {
      const dC = hyp(dog.x - s.cen.x, dog.z - s.cen.z);
      const wide = s.rho + Zbase() * 1.02 + 3;
      dog.orbitR = dC > wide ? wide : Math.max(dC, s.rho + 2.5);
      if ((prev === 'comebye' && cmd === 'away') || (prev === 'away' && cmd === 'comebye')) dog.eye = Math.max(0, dog.eye - 0.25);
    }
    if (cmd === 'lie') dog.eye = Math.max(0, dog.eye - 0.15);
    ev('cmd', { cmd });
    return true;
  }
  function toggleGate() {
    if (!s.pen || !hand.arrived || s.pen.closed) return false;
    s.pen.open = !s.pen.open; ev(s.pen.open ? 'gateOpen' : 'gateShut');
    if (!s.pen.open) { s.pen.shut = true; checkPenDone(); }
    return true;
  }

  // ---- the dog
  function dogPressure() {
    switch (dog.gait) {
      case 'gallop': return dog.cmd === 'walkon' ? 1.25 : 1.12;
      case 'trot': return 1.05;
      case 'walk': return 0.95 + 0.12 * dog.eye;
      default: return dog.cmd === 'lie' ? 0.28 : 0.86 + 0.1 * dog.eye;
    }
  }
  function stepDog(dt) {
    const C = s.cen, rho = s.rho, Z = Zbase();
    const dC = hyp(dog.x - C.x, dog.z - C.z);
    let want = 0, tx = dog.x, tz = dog.z, turnRate = 7;
    const cmd = dog.cmd;
    const near = nearestSheep(dog.x, dog.z); dog.nearest = near;
    const stamF = 0.5 + 0.5 * clamp(dog.stamina / 0.4, 0, 1);
    if (cmd === 'comebye' || cmd === 'away') {
      const dir = cmd === 'comebye' ? -1 : 1;
      const Rt = Math.max(dog.orbitR, rho + 2.5);
      const ang = Math.atan2(dog.z - C.z, dog.x - C.x);
      let pa;
      if (dC > Rt * 1.04) pa = ang + dir * Math.max(0.3, Math.acos(clamp(Rt / dC, 0, 1)));
      else pa = ang + dir * 0.55;
      const rr = dC > Rt * 1.04 ? Rt : lerp(dC, Rt, 0.5);
      tx = C.x + Math.cos(pa) * rr; tz = C.z + Math.sin(pa) * rr;
      want = (Rt > 13 || dC > 22) ? DOG_V.gallop : DOG_V.trot;
      // a trained dog eases as it comes to the balance point
      if (s.bal.on) { const d = Math.abs(wrapAng(ang - s.bal.ang)); if (d < 0.6) want *= 0.4 + 0.6 * d / 0.6; }
      // flank travel accounting (for lessons)
      const prevA = dog.flankAng; dog.flankAng = ang;
      const da = wrapAng(ang - prevA); if (Math.abs(da) < 1) { if (dir < 0) s.m.cwTravel += Math.max(0, -da); else s.m.ccwTravel += Math.max(0, da); }
    } else if (cmd === 'walkon') {
      // straight at the flock; trot when far, a stalking walk inside the flight zone
      tx = C.x; tz = C.z;
      const e = dC - rho;
      want = e > 40 ? DOG_V.gallop * 0.75 : e > Z * 1.5 ? DOG_V.trot : e > Z * 0.55 ? DOG_V.walk : DOG_V.walk * 0.8;
      if (near < 2.2) want = DOG_V.creep * (near < 1.5 ? 0.3 : 1);
      dog.flankAng = Math.atan2(dog.z - C.z, dog.x - C.x);
    } else { want = 0; dog.flankAng = Math.atan2(dog.z - C.z, dog.x - C.x); }
    // terrain and tiredness
    let slope = 0;
    if (want > 0) { const hx = tx - dog.x, hz = tz - dog.z, hl = hyp(hx, hz) || 1; slope = slopeAlong(c, dog.x, dog.z, hx / hl, hz / hl); }
    want *= stamF * clamp(1 - 2.6 * slope, 0.55, 1.25);
    // heading
    if (want > 0.05) {
      const dh = wrapAng(Math.atan2(tx - dog.x, tz - dog.z) - dog.h);
      const tr = turnRate * (dog.v > 6 ? 0.55 : 1);
      dog.h += clamp(dh, -tr * dt, tr * dt); dog.turn = clamp(dh, -1, 1);
    } else dog.turn *= 0.9;
    // a dog has to point somewhere useful when it stops: face the flock
    if (want <= 0.05 && dog.v < 0.4) { const fh = Math.atan2(C.x - dog.x, C.z - dog.z); dog.h += clamp(wrapAng(fh - dog.h), -3 * dt, 3 * dt); }
    // speed: quick to start, quicker to stop
    const acc = want > dog.v ? 9 : (cmd === 'lie' ? 16 : 12);
    dog.v += clamp(want - dog.v, -acc * dt, acc * dt);
    dog.x += Math.sin(dog.h) * dog.v * dt; dog.z += Math.cos(dog.h) * dog.v * dt;
    // fences, posts, boulders
    collide(dog, 0.45, true);
    dog.gait = dog.v < 0.15 ? 'stand' : dog.v < 2.6 ? 'walk' : dog.v < 6.4 ? 'trot' : 'gallop';
    const crouchT = cmd === 'lie' ? 1 : (cmd === 'walkon' && dog.v < 2.4 && near < Z * 1.3) ? 0.55 : (cmd === 'stand' && near < Z) ? 0.25 : 0;
    dog.crouch += clamp(crouchT - dog.crouch, -4 * dt, 4 * dt);
    // stamina and eye
    const drain = dog.gait === 'gallop' ? 0.024 : dog.gait === 'trot' ? 0.012 : dog.gait === 'walk' ? 0.005 : cmd === 'lie' ? -0.032 * td.rest : 0.001;
    const up = Math.max(0, slope) * 5;
    dog.stamina = clamp(dog.stamina - (drain > 0 ? (drain * wx.stam + up * 0.004 * dog.v / 5) : drain) * dt, 0, 1);
    if (dog.stamina <= 0.02 && !dog.tired) { dog.tired = true; s.m.exhausted++; ev('tired'); }
    if (dog.stamina > 0.3) dog.tired = false;
    const working = cmd === 'walkon' && dog.v > 0.25 && dog.v < 2.6 && near < Z * 1.25 && near > 2;
    if (working) dog.eye = Math.min(1, dog.eye + 0.2 * dt);
    else if (cmd === 'stand' && near < Z * 1.1) dog.eye = Math.max(0, dog.eye - 0.02 * dt);
    else dog.eye = Math.max(0, dog.eye - 0.2 * dt);
    if (dog.gait === 'gallop' && near < Z * 0.85) dog.eye = Math.max(0, dog.eye - 0.7 * dt);
    if (cmd === 'lie' && dog.crouch > 0.9) dog.eye = Math.max(0, dog.eye - 0.1 * dt);
  }

  // ---- fences: slide along walls, posts and boulders
  function collide(o, r, isDog) {
    const key = s.pen && s.pen.open ? 1 : 0;
    if (wallKey !== key) { wallKey = key; wallList = courseWalls(c, !!key); }
    // the dog never goes into the pen: the mouth is shut to it whether the gate is open or not
    const list = isDog && key ? wallList.concat([{ x0: pen.hinge.x, z0: pen.hinge.z, x1: pen.tip.x, z1: pen.tip.z }]) : wallList;
    for (const w of list) {
      const q = segDist(o.x, o.z, w);
      if (q.d < r && q.d > 1e-6) {
        const nx = (o.x - q.qx) / q.d, nz = (o.z - q.qz) / q.d;
        o.x += nx * (r - q.d); o.z += nz * (r - q.d);
        if (o.vx !== undefined) { const vn = o.vx * nx + o.vz * nz; if (vn < 0) { o.vx -= vn * nx; o.vz -= vn * nz; } }
      } else if (q.d <= 1e-6) { o.z += r; }
    }
    for (const k of circles) {
      if (isDog && k.soft) continue;
      const dx = o.x - k.x, dz = o.z - k.z, d = hyp(dx, dz), rr = k.r + r * (k.post ? 0.6 : 1);
      if (d < rr && d > 1e-6) {
        o.x += (dx / d) * (rr - d); o.z += (dz / d) * (rr - d);
        if (o.vx !== undefined) { const vn = (o.vx * dx + o.vz * dz) / d; if (vn < 0) { o.vx -= vn * dx / d; o.vz -= vn * dz / d; } }
      }
    }
  }

  // a fence between the dog and a ewe takes most of the pressure off
  function fenced(x0, z0, x1, z1) {
    for (const w of wallList) {
      const d1x = x1 - x0, d1z = z1 - z0, d2x = w.x1 - w.x0, d2z = w.z1 - w.z0;
      const den = d1x * d2z - d1z * d2x; if (Math.abs(den) < 1e-9) continue;
      const u = ((w.x0 - x0) * d2z - (w.z0 - z0) * d2x) / den, v = ((w.x0 - x0) * d1z - (w.z0 - z0) * d1x) / den;
      if (u > 0 && u < 1 && v > 0 && v < 1) return true;
    }
    return false;
  }
  // ---- the sheep
  function stepSheep(dt) {
    const Zb = Zbase(), P = dogPressure();
    const hv = dirVec(dog.h);
    const C = s.all;
    const leader = sh[0];
    const alarm0 = sh.map((a) => a.alarm);
    const out = [];
    for (let i = 0; i < sh.length; i++) {
      const a = sh[i];
      const zi = Zb * (0.9 + 0.1 * a.skit) * (a.bold ? 0.55 : 1) * a.size;
      // from the dog
      let fx = 0, fz = 0, thr = 0;
      const rx = a.x - dog.x, rz = a.z - dog.z, dd = hyp(rx, rz) || 0.001;
      const face = Math.max(0, (hv.x * rx + hv.z * rz) / dd);
      let Ze = zi * P * (0.42 + 0.58 * face);
      if (s.pen && dd < Ze * 1.3 && fenced(dog.x, dog.z, a.x, a.z)) Ze *= 0.3;
      if (dd < Ze) {
        thr = 1 - dd / Ze;
        let sp = (0.55 + 4.6 * Math.pow(thr, 1.15)) * (1 - 0.28 * dog.eye) * (0.85 + 0.2 * a.skit);
        if (a.bold && dog.eye < 0.6 && dd > 0.4 * Ze) { sp *= 0.25; a.stamp = Math.min(1, a.stamp + dt * 2); } else a.stamp = Math.max(0, a.stamp - dt);
        fx = (rx / dd) * sp; fz = (rz / dd) * sp;
      } else a.stamp = Math.max(0, a.stamp - dt);
      // from the handler
      const hx = a.x - hand.x, hz = a.z - hand.z, hd = hyp(hx, hz) || 0.01;
      const hz0 = hand.arrived && s.phase === 'pen' ? 2.6 : 6;
      if (hd < hz0) { const f = (1 - hd / hz0) * 1.6; fx += (hx / hd) * f; fz += (hz / hd) * f; }
      // neighbours
      let sx = 0, sz = 0, ax = 0, az = 0, an = 0, al = 0;
      for (let j = 0; j < sh.length; j++) {
        if (j === i) continue; const b = sh[j];
        const dx = a.x - b.x, dz = a.z - b.z, d = hyp(dx, dz) || 0.01;
        if (d < 1.7) { const f = (1.7 - d) * 1.7; sx += (dx / d) * f; sz += (dz / d) * f; }
        if (d < 11) { ax += b.vx; az += b.vz; an++; al = Math.max(al, alarm0[j] * (1 - d / 14)); }
      }
      const alarm = Math.max(a.alarm - 0.45 * dt, thr, al * 0.8);
      out.push(alarm);
      a.thr = thr;
      // cohesion towards the rest of the flock (stronger when something is going on and when the dog has its eye on them)
      const tcx = (C.x * sh.length - a.x) / Math.max(1, sh.length - 1), tcz = (C.z * sh.length - a.z) / Math.max(1, sh.length - 1);
      const cdx = tcx - a.x, cdz = tcz - a.z, cd = hyp(cdx, cdz) || 0.01;
      const kc = (0.18 + 0.85 * Math.min(1, alarm * 1.4)) * (1 + 0.9 * dog.eye) * c.cohes * td.coh;
      const want = Math.max(0, cd - (alarm > 0.08 ? 2.4 : 5.5));
      let dvx = fx + (cdx / cd) * Math.min(2.4, want * kc) + sx, dvz = fz + (cdz / cd) * Math.min(2.4, want * kc) + sz;
      // the lead ewe: the flock follows where she goes
      if (!a.lead) {
        const ldx = leader.x - a.x, ldz = leader.z - a.z, ld = hyp(ldx, ldz) || 0.01;
        if (ld > 4.5) { const k = Math.min(1.2, (ld - 4.5) * 0.12) * (0.35 + alarm); dvx += (ldx / ld) * k; dvz += (ldz / ld) * k; }
        dvx += leader.vx * 0.3 * alarm; dvz += leader.vz * 0.3 * alarm;
      }
      if (an) { dvx += (ax / an) * 0.35 * alarm; dvz += (az / an) * 0.35 * alarm; }
      // grazing and idle wandering
      if (alarm < 0.04 && thr === 0) {
        a.graze -= dt;
        if (a.graze <= 0) { a.graze = R.range(2.5, 7); a.wx = R.range(-1, 1); a.wz = R.range(-1, 1); a.step = R.chance(0.35); }
        if (a.step && a.graze > 1.2) { dvx += a.wx * 0.35; dvz += a.wz * 0.35; }
      }
      // breeze
      dvx += wx.wind * 0.8 * (alarm > 0.1 ? 0.4 : 1); dvz += 0;
      const sp = hyp(dvx, dvz);
      if (sp > SHEEP_V.max) { dvx *= SHEEP_V.max / sp; dvz *= SHEEP_V.max / sp; }
      // uphill is slow
      let sl = 0; if (sp > 0.3) sl = slopeAlong(c, a.x, a.z, dvx / sp, dvz / sp);
      const sm = clamp(1 - 2.2 * sl, 0.6, 1.2);
      a._dx = dvx * sm; a._dz = dvz * sm;
    }
    for (let i = 0; i < sh.length; i++) {
      const a = sh[i];
      a.alarm = out[i];
      const k = Math.min(1, 3.4 * dt);
      a.vx += (a._dx - a.vx) * k; a.vz += (a._dz - a.vz) * k;
      a.x += a.vx * dt; a.z += a.vz * dt;
      collide(a, 0.42, false);
      const v = hyp(a.vx, a.vz);
      a.sp = v; a.mode = a.stamp > 0.4 ? 'stamp' : sheepMode(v);
      if (v > 0.25) { const th = Math.atan2(a.vx, a.vz); a.h += clamp(wrapAng(th - a.h), -4 * dt, 4 * dt); }
      else if (a.thr > 0) { const th = Math.atan2(dog.x - a.x, dog.z - a.z); a.h += clamp(wrapAng(th - a.h), -3 * dt, 3 * dt); }
    }
    // pen and gate crossings
    for (const a of sh) {
      if (s.pen) a.inPen = a.x > pen.x0 + 0.1 && a.x < pen.x1 - 0.1 && a.z > pen.z0 + 0.1 && a.z < pen.z1 + 0.05;
      for (const g of gates) {
        const side = (a.x - g.cx) * g.dx + (a.z - g.cz) * g.dz;
        const prev = a.side[g.id];
        a.side[g.id] = side;
        if (prev === undefined) continue;
        const lat = (a.x - g.cx) * (-g.dz) + (a.z - g.cz) * g.dx;
        if (prev < 0 && side >= 0) {
          if (Math.abs(lat) < g.w / 2 - 0.2) { a.through[g.id] = 1; } else a.through[g.id] = -1;
        } else if (prev >= 0 && side < 0) { if (a.through[g.id]) a.through[g.id] = 0; }
      }
    }
    if (s.pen) s.pen.inside = sh.filter((a) => a.inPen).length;
  }

  // ---- phases and scoring
  const fault = (ph, pts, why) => { if (pts <= 0) return; s.faults.push({ ph, pts: Math.round(pts * 10) / 10, why, t: s.t }); };
  const faultSum = (ph) => s.faults.filter((f) => f.ph === ph).reduce((q, f) => q + f.pts, 0);
  function award(ph, base) { s.pts[ph] = Math.max(0, Math.round((base - faultSum(ph)) * 10) / 10); }
  function setPhase(p) {
    s.phase = p; s.phaseT = 0; ev('phase', { phase: p });
    s.m.devSum = 0; s.m.devT = 0; s.m.panicSec = 0; s.m.alertSec = 0;
  }
  function gateStatus(g) {
    let thr = 0, bad = 0;
    for (const a of sh) { const v = a.through[g.id]; if (v === 1) thr++; else if (v === -1) bad++; }
    g.through = thr; g.around = bad;
    if (!g.resolved && thr + bad >= sh.length) {
      g.resolved = true; g.passed = thr === sh.length;
      ev('gate', { id: g.id, passed: g.passed, thr });
    }
  }
  function checkPenDone() {
    if (!s.pen || s.pen.closed) return;
    if (s.pen.shut && s.pen.inside === sh.length) { s.pen.closed = true; ev('penned'); finish(false); }
  }
  function dev() {
    // distance of the flock from the straight line it should be travelling along
    const d = s.dest; let ax = s.cen.x, az = s.cen.z; const bx = d.x, bz = d.z;
    const base = s.phase === 'fetch' || s.phase === 'lift' ? { x: c.set.x, z: c.set.z } : { x: s.m.lx ?? ax, z: s.m.lz ?? az };
    const ex = bx - base.x, ez = bz - base.z, l = hyp(ex, ez) || 1;
    return Math.abs((ax - base.x) * ez - (az - base.z) * ex) / l;
  }
  function stepPhase(dt) {
    const C = s.cen;
    s.phaseT += dt;
    const g = (id) => gates.find((q) => q.id === id);
    for (const q of gates) gateStatus(q);
    s.dest = destination();
    // balance point: opposite side of the flock from where it should go
    const dx = C.x - s.dest.x, dz = C.z - s.dest.z, dl = hyp(dx, dz) || 1;
    s.bal = { on: true, ang: Math.atan2(dz, dx), x: C.x + (dx / dl) * (s.rho + 7), z: C.z + (dz / dl) * (s.rho + 7) };
    // faults that apply everywhere while the dog works
    const alerted = sh.filter((a) => a.thr > 0.12).length;
    const panic = sh.some((a) => a.sp > 4.6);
    s.m.alertSec += alerted * dt; if (panic) s.m.panicSec += dt;
    s.m.maxSpread = Math.max(s.m.maxSpread, s.spread);
    // break-aways: a ewe far from the rest for a while
    let lost = false; for (const a of sh) { if (hyp(a.x - C.x, a.z - C.z) > Math.max(20, s.rho * 0.7 + 12) && sh.length > 2) lost = true; }
    if (lost) { s.m.lostSec += dt; if (s.m.lostSec > 5 && !s.m.lostFlag) { s.m.lostFlag = 1; s.m.breakaways++; fault('control', 2.5, 'A ewe broke away from the flock'); ev('breakaway'); } } else { s.m.lostSec = Math.max(0, s.m.lostSec - dt * 2); if (s.m.lostSec === 0) s.m.lostFlag = 0; }
    switch (s.phase) {
      case 'outrun': {
        const toH = Math.atan2(hand.x - C.x, hand.z - C.z), toD = Math.atan2(dog.x - C.x, dog.z - C.z);
        const th = Math.abs(wrapAng(toD - toH)), dC = hyp(dog.x - C.x, dog.z - C.z);
        if (th > 2.35 && dC < s.rho + Zbase() * 1.8) {
          fault('outrun', Math.min(9, s.m.alertSec * 0.45), 'The sheep were disturbed on the outrun');
          if (s.m.panicSec > 0.5) fault('outrun', Math.min(4, s.m.panicSec), 'Sheep bolted as the dog arrived');
          if (dog.eye === 0 && false) { /* reserved */ }
          award('outrun', PHASE_PTS.outrun); s.done.outrun = true; setPhase('lift'); s.m.liftStart = { x: C.x, z: C.z };
        }
        break;
      }
      case 'lift': {
        const ls = s.m.liftStart || c.set;
        if (hyp(C.x - ls.x, C.z - ls.z) > 7 || s.phaseT > 60) {
          if (s.m.panicSec > 0.6) fault('lift', Math.min(4, s.m.panicSec * 1.4), 'The sheep ran on the lift');
          if (s.m.maxSpread > 12) fault('lift', 3, 'The flock was split on the lift');
          if (s.phaseT > 45) fault('lift', 2, 'A slow lift');
          award('lift', PHASE_PTS.lift); s.done.lift = true; setPhase('fetch');
        }
        break;
      }
      case 'fetch': {
        const f = g('fetch');
        s.m.devSum += dev() * dt; s.m.devT += dt;
        if (f.resolved && !s.done.fetchGate) {
          s.done.fetchGate = true;
          if (!f.passed) fault('fetch', 10 * (1 - f.through / sh.length), `${sh.length - f.through} sheep missed the fetch gate`);
        }
        if (f.resolved && hyp(C.x - hand.x, C.z - hand.z) < 13) {
          const avg = s.m.devSum / Math.max(1, s.m.devT);
          fault('fetch', clamp((avg - 4) * 0.9, 0, 5), 'The fetch was not on a straight line');
          if (s.m.panicSec > 1) fault('fetch', Math.min(4, s.m.panicSec * 0.7), 'Sheep ran on the fetch');
          if (s.m.maxSpread > 16) fault('fetch', 2, 'The flock split on the fetch');
          award('fetch', PHASE_PTS.fetch); s.done.fetch = true; setPhase('drive1'); s.m.lx = C.x; s.m.lz = C.z; s.m.maxSpread = s.spread;
        }
        break;
      }
      case 'drive1': case 'drive2': {
        const q = g(s.phase === 'drive1' ? 'd1' : 'd2');
        s.m.devSum += dev() * dt; s.m.devT += dt;
        if (q.resolved) {
          if (!q.passed) fault('drive', 10 * (1 - q.through / sh.length), `${sh.length - q.through} sheep missed the ${q.label.toLowerCase()}`);
          const avg = s.m.devSum / Math.max(1, s.m.devT);
          fault('drive', clamp((avg - 4) * 0.5, 0, 2.5), 'The drive was not on a straight line');
          if (s.m.panicSec > 1.2) fault('drive', Math.min(2, s.m.panicSec * 0.5), 'Sheep ran on the drive');
          s.done[s.phase] = true;
          if (s.phase === 'drive1') { setPhase('drive2'); s.m.lx = C.x; s.m.lz = C.z; hand.target = { x: pen.handler.x, z: pen.handler.z }; hand.arrived = false; }
          else { award('drive', PHASE_PTS.drive); setPhase('pen'); }
        }
        break;
      }
      case 'pen': {
        const stop = s.pen.closed;
        if (!stop && s.pen.shut && s.pen.inside < sh.length) { /* gate shut before all were in: reopen allowed */ s.pen.shut = false; }
        break;
      }
      default: break;
    }
    // time
    if (!training && s.t >= c.time && !s.over) { s.retired = true; finish(true); }
  }
  function finish(timeout) {
    if (s.over) return;
    s.over = true; s.retired = !!timeout;
    if (!timeout) {
      const e = sh.filter((a) => !a.inPen).length; if (e) fault('pen', e * 3, `${e} sheep not in the pen`);
      award('pen', PHASE_PTS.pen);
      s.pts.time = Math.round(PHASE_PTS.time * clamp((c.time - s.t) / (c.time * 0.7), 0, 1));
      const cmds = s.cmdCount; if (cmds > 70) fault('control', Math.min(3, (cmds - 70) * 0.06), 'Too many commands');
      if (s.m.exhausted) fault('control', Math.min(3, s.m.exhausted * 1.5), 'The dog ran out of breath');
      if (s.m.maxSpread > 22) fault('control', 1, 'The flock was often strung out');
      award('control', PHASE_PTS.control);
    } else { s.pts.time = 0; if (s.pen && s.phase === 'pen') s.pts.pen = Math.round(PHASE_PTS.pen * (s.pen.inside / sh.length) * 0.6 * 10) / 10; }
    s.total = Math.round(Object.values(s.pts).reduce((q, v) => q + v, 0));
    ev('finish', { total: s.total, timeout: !!timeout });
  }

  // ---- handler
  function stepHandler(dt) {
    const T = hand.target;
    if (T) {
      const dx = T.x - hand.x, dz = T.z - hand.z, d = hyp(dx, dz);
      if (d > 0.25) {
        hand.v = Math.min(1.9, hand.v + 3 * dt);
        const th = Math.atan2(dx, dz); hand.h += clamp(wrapAng(th - hand.h), -4 * dt, 4 * dt);
        hand.x += Math.sin(hand.h) * hand.v * dt; hand.z += Math.cos(hand.h) * hand.v * dt;
        hand.arrived = false;
      } else { hand.v = 0; hand.arrived = true; hand.target = null; hand.h = Math.PI / 2 + 0.2; ev('arrived'); }
    } else {
      hand.v = 0;
      // the handler watches the dog or the flock
      const look = Math.atan2(dog.x - hand.x, dog.z - hand.z);
      if (s.phase === 'pen' && hand.arrived) hand.h += clamp(wrapAng(Math.atan2(s.cen.x - hand.x, s.cen.z - hand.z) - hand.h), -2 * dt, 2 * dt);
      else hand.h += clamp(wrapAng(look - hand.h), -2.2 * dt, 2.2 * dt);
    }
    if (hand.sigT > 0) hand.sigT -= dt;
  }

  function update(dt) {
    if (s.over) { s.t += 0; return; }
    s.t += dt;
    flockStats(); s.Z = Zbase();
    stepHandler(dt);
    stepDog(dt);
    stepSheep(dt);
    flockStats();
    stepPhase(dt);
    if (s.pen && s.phase === 'pen') checkPenDone();
    if (training) checkLesson(s, c, dt);
    // events for sound: a ewe bleats now and then when alarmed
    for (const a of sh) { if (a.alarm > 0.5 && !a.bl) { a.bl = 1; ev('bleat', { id: a.id }); } else if (a.alarm < 0.2) a.bl = 0; }
  }
  flockStats();
  s.dest = destination();
  return { s, c, update, command, toggleGate, dirVec, input() {}, penOpen: () => (s.pen ? s.pen.open : false) };
}

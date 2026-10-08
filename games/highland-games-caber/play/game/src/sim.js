// The festival simulation: three events (caber toss, stone put, weight over the bar), their attempts, the scoring, the rivals' marks and the
// replay clock. Pure and deterministic: time comes only from dt, randomness only from the rng handed in. The 3D picture and the HUD only READ
// this state. Input per tick: { pad: { f, l }, act: { pressed, down, released } }  (f = forward, l = left, both -1..1).
import { flyCaber, releaseOf, solveZone, inertiaOf, CABERS, STONES, stoneFlight, weightFlight, wtPos, WT, BAR_HEIGHTS, G } from './physics.js';
import { EVENTS, ATTEMPTS, LEVELS, RIVALS, scoreCaber, clockOf, barPts, EVENT_NAME } from './consts.js';

export const DT = 1 / 60;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const TAU = Math.PI * 2;
export const STRIDES = 6;
export const STONE_ANGLE = { lo: 26, hi: 56, ideal: 41 };
export const WIND_FULL = 1.2;                    // seconds of holding for full power
export const WIND_FOUL = 1.55;                   // hold longer than this and the thrower steps over the board
export const ARC = { lo: 50 * Math.PI / 180, hi: 122 * Math.PI / 180 };   // the slow release arc of the weight (angle from straight down)
export const SPIN_V0 = 7.9;                      // speed of the whirled weight at the start (m/s at the lowest point)
export const VB_MAX = 12.6;

const stonePointsFor = (d, stone) => (stone.id === 'heavy' ? clamp(((d - 2.5) / 8.0) * 100, 0, 100) : clamp(((d - 2.5) / 9.5) * 80, 0, 100));

export function createSim(cfg, rng) {
  const lvl = LEVELS[(cfg.level || 2) - 1];
  const list = cfg.events || EVENTS;
  const r = rng.fork();
  const noiseR = rng.fork(), scatterR = rng.fork();
  const s = {
    t: 0, ph: 'choose', pt: 0, level: lvl.id, lv: lvl, mode: cfg.mode || 'festival', watch: !!cfg.watch, hold: null,
    list: [...list], idx: 0, event: list[0], attempt: 0,
    sel: null, cab: null, st: null, wt: null,
    pad: { f: 0, l: 0 }, act: { down: false },
    res: null, replay: null, card: null,
    scores: { caber: [], stone: [], weight: [] }, best: { caber: 0, stone: 0, weight: 0 }, total: 0,
    bestDist: 0, barBest: null, rivals: [], over: false, standings: [],
    events: [], evId: 0,
  };
  // rivals' marks: a fixed draw per event so the scoreboard is the same however long you take
  const rivalDraw = { caber: [], stone: [], weight: [] };
  for (const ev of EVENTS) for (const rv of RIVALS) rivalDraw[ev].push(clamp(Math.round(rv.rate[ev] + (r.next() + r.next() + r.next() - 1.5) * 26), 8, 98));
  s.rivals = RIVALS.map((rv, i) => ({ name: rv.name, pts: { caber: rivalDraw.caber[i], stone: rivalDraw.stone[i], weight: rivalDraw.weight[i] } }));

  const emit = (type, extra = {}) => { s.events.push({ id: ++s.evId, type, t: s.t, ...extra }); if (s.events.length > 40) s.events.shift(); };
  const setPh = (ph) => { s.ph = ph; s.pt = 0; };
  const hold = (id, kind, summary, reason, hl) => { if (cfg.hold) s.hold = { id: s.evId + ':' + id, kind, summary, reason, hl }; };

  // deterministic wobble for the balance: three sines per axis
  const mkNoise = () => Array.from({ length: 3 }, (_, i) => ({ f: 0.35 + noiseR.next() * 1.35 + i * 0.1, p: noiseR.next() * TAU, a: [0.55, 0.3, 0.2][i] }));
  const noiseAt = (n, t) => n.reduce((a, c) => a + c.a * Math.sin(TAU * c.f * t + c.p), 0);

  // ---- events: set up an attempt ---------------------------------------------------------------------------------------------
  function beginAttempt() {
    s.attempt = s.attempt || 0;
    s.res = null; s.card = null; s.replay = null; s.sel = null;
    setPh('choose');
    if (s.event === 'caber') hold('choose', 'choose', `Throw ${s.attempt + 1}: choose a caber`, 'A lighter caber is easier to turn but scores less. The Championship caber needs a fast run and a clean heave, and pays the most.', 'choose');
    else if (s.event === 'stone') hold('choose', 'choose', `Throw ${s.attempt + 1}: choose a stone`, 'The light stone flies further but scores a little less than the same distance with the Braemar stone.', 'choose');
    else hold('choose', 'choose', s.attempt === 0 ? 'Choose the opening height' : 'Choose the next height', 'Start low and the bar goes up three tenths of a metre after each clear. Five tries in all, and the highest clear scores.', 'choose');
  }

  function choose(id) {
    if (s.ph !== 'choose') return;
    s.sel = id; s.hold = null;
    if (s.event === 'caber') {
      const cab = CABERS.find((c) => c.id === id) || CABERS[1];
      s.cab = { cab, bx: 0.07, bz: -0.05, vbx: 0, vbz: 0, steady: 0, drops: 0, n1: mkNoise(), n2: mkNoise(), nt: 0, x: 0, v: 0, vT: 0.4, strides: [], beat0: 0, resolved: 0, vPlant: 0, zone: null, tau: 0, sweepT: 0, sweepDur: lvl.sweep * (cab.id === 'glen' ? 1.15 : cab.id === 'champion' ? 0.9 : 1) };
      setPh('lift'); emit('lift', { caber: cab.id });
      hold('lift', 'lift', 'The lift: find the balance', 'The caber stands on its small end in your cupped hands and wants to fall. Drag toward the dot to get your hands under it. Small early moves beat big late ones. Hold it steady to finish the lift.', 'pad');
    } else if (s.event === 'stone') {
      const stone = STONES.find((c) => c.id === id) || STONES[1];
      s.st = { stone, angle: 41, t0: 0, locked: null, p: 0, dist: 0, foul: false, fly: null, flyT: 0, wind: false };
      setPh('angle'); emit('stoneset');
      hold('angle', 'angle', 'Set the angle', `The angle gauge swings. Tap to lock it. About ${STONE_ANGLE.ideal} degrees gives the longest put; too flat or too steep wastes the throw.`, 'angle');
    } else {
      const h0 = BAR_HEIGHTS[clamp(id | 0, 0, BAR_HEIGHTS.length - 1)];
      s.wt = { barIdx: clamp(id | 0, 0, BAR_HEIGHTS.length - 1), bar: h0, a: 0.4, w: 0, vb: SPIN_V0, pumps: 0, lap: 0, crossT: -9, lastCross: 0, pumpedThisLap: false, qs: [], fly: null, flyT: 0, rel: null, slow: 1, inArc: false, timeUp: 0 };
      // the weight starts at the bottom going back with speed SPIN_V0: a first beat arrives after a moment
      s.wt.a = -0.2; s.wt.w = SPIN_V0 / WT.R;
      setPh('spin'); emit('spinstart');
      hold('spin', 'spin', 'Spin it up, then let go', `Tap when the weight passes its lowest point to spin it faster. Then tap in the slow arc as it rises behind you. The bar is at ${h0.toFixed(1)} m: you will need about ${needSpeed(h0).toFixed(1)} m/s.`, 'spin');
    }
  }

  const needSpeed = (H) => 9.0 + (H - 3.6) * 1.0;

  // ---- caber ------------------------------------------------------------------------------------------------------------------
  const C_KG = 3.0, C_KU = 14, C_D = 1.25;
  function balanceStep(c, dt, noiseGain, v) {
    c.nt += dt;
    const kg = C_KG * (5.9 / c.cab.L), mass = Math.sqrt(c.cab.m / 79);
    const kn = 2.3 * lvl.noise * mass * noiseGain;
    const uf = clamp(s.pad.f, -1, 1), ul = clamp(s.pad.l, -1, 1);
    const ax = kg * c.bx - C_KU * uf - C_D * c.vbx + kn * noiseAt(c.n1, c.nt);
    const az = kg * c.bz - C_KU * ul - C_D * c.vbz + kn * noiseAt(c.n2, c.nt);
    c.vbx += ax * dt; c.vbz += az * dt; c.bx += c.vbx * dt; c.bz += c.vbz * dt;
  }
  const leanMag = (c) => Math.hypot(c.bx, c.bz);

  function dropCaber(why) {
    const c = s.cab;
    emit('drop', { why });
    c.drops++;
    if (why === 'lift' && c.drops < 3) {
      c.bx = 0.12; c.bz = 0.1; c.vbx = 0; c.vbz = 0; c.steady = 0; c.dropT = 1.4;
      s.card = { kind: 'note', text: 'Dropped! Pick it up again' };
      return;
    }
    // a drop in the run, or the third drop at the lift: no throw
    finishAttempt({ kind: 'fault', why: why === 'lift' ? 'Dropped three times: no throw' : 'Dropped in the run: no throw', turned: false, pts: 0, psi: 0, line: 0, quality: 0 });
  }

  function updateCaber(dt) {
    const c = s.cab, inp = s.act;
    if (s.ph === 'lift') {
      if (c.dropT > 0) { c.dropT -= dt; if (c.dropT <= 0) { s.card = null; emit('lift', { again: true }); } return; }
      balanceStep(c, dt, 1, 0);
      if (leanMag(c) < 0.14) c.steady += dt; else c.steady = Math.max(0, c.steady - dt * 0.6);
      if (c.steady >= 1.6) {
        c.steady = 1.6; setPh('run'); c.beat0 = s.t + 1.1 + 0.2; c.resolved = 0; c.strides = [];
        emit('ready');
        hold('run', 'run', 'The run-up: tap on each beat', `Six strides. Tap STRIDE as each ring closes on the button: the closer to the beat, the faster you go. Keep steering the lean at the same time. A faster run gives more power, so the heave zone moves earlier.`, 'beat');
      } else if (leanMag(c) > 0.78) dropCaber('lift');
      else if (s.pt > 26) dropCaber('lift');
      return;
    }
    if (s.ph === 'run') {
      const P = lvl.beat;
      // stride beats
      for (let k = c.resolved; k < STRIDES; k++) {
        const bt = c.beat0 + k * P;
        if (s.t > bt + 0.24 * lvl.win && c.strides[k] === undefined) { c.strides[k] = 0; c.vT = Math.max(0.3, c.vT - 0.8); c.resolved = k + 1; emit('miss', { k }); }
        else break;
      }
      if (inp.pressed) {
        let k = c.resolved, bt = c.beat0 + k * P;
        if (k < STRIDES && Math.abs(s.t - bt) <= 0.24 * lvl.win && c.strides[k] === undefined) {
          const e = Math.abs(s.t - bt), w = lvl.win;
          const q = e <= 0.055 * w ? 1 : e <= 0.11 * w ? 0.75 : e <= 0.2 * w ? 0.45 : 0.2;
          c.strides[k] = q; c.vT = clamp(c.vT + (q === 1 ? 1.15 : q === 0.75 ? 0.85 : q === 0.45 ? 0.5 : 0.25), 0.3, 6.9); c.resolved = k + 1;
          emit('stride', { k, q, early: s.t < bt });
        }
      }
      // each stride jolts the pole; a faster run jolts it more
      for (let k = 0; k < STRIDES; k++) {
        const bt = c.beat0 + k * P;
        if (s.t >= bt && s.t - dt < bt) { const sg = k % 2 ? 1 : -1, kick = 0.22 * lvl.noise * (0.5 + c.v / 6); c.vbx += kick * (0.6 + 0.4 * Math.sin(k * 2.1)); c.vbz += sg * kick; }
      }
      balanceStep(c, dt, 1 + 0.12 * c.v, c.v);
      c.v += (c.vT - c.v) * Math.min(1, dt * 5);
      c.x += c.v * dt;
      if (leanMag(c) > 0.95) { dropCaber('run'); return; }
      if (c.resolved >= STRIDES && !c.planted) {
        c.planted = true; c.vPlant = c.vT; c.plantT = 0;
        c.zone = solveZone(c.cab, c.vPlant, c.bx, c.bz);
        emit('plant', { v: c.vPlant, zone: c.zone });
        setPh('heave'); c.sweepT = -0.5; c.tau = 0;
        const zt = c.zone ? `The green zone is ${Math.round(c.zone.lo * 100)} to ${Math.round(c.zone.hi * 100)} percent of the sweep.` : 'At this speed the pole cannot be turned. Run faster next time.';
        hold('heave', 'heave', 'The heave: tap in the green', `Tap HEAVE while the cursor is in the green. ${zt} Early and the pole falls back; late and it spins over too far. The middle of the green is cleanest.`, 'zone');
      }
      return;
    }
    if (s.ph === 'heave') {
      c.plantT += dt;
      c.v = Math.max(0, c.v - dt * 14);
      c.x += c.v * dt;
      c.sweepT += dt;
      c.tau = clamp(c.sweepT / c.sweepDur, 0, 1);
      if (c.sweepT > 0 && (inp.pressed || c.sweepT > c.sweepDur + 0.25)) releaseCaber(c.tau);
      return;
    }
    if (s.ph === 'fly') {
      c.flyT += dt;
      if (c.flyT >= c.res.tEnd + 0.35) judgeCaber();
    }
  }

  function releaseCaber(tau) {
    const c = s.cab;
    const rel = releaseOf(c.cab, c.vPlant, tau, c.bx, c.bz);
    const res = flyCaber(rel, { record: true });
    // direction: how far from straight ahead the pole travels. Lean to the left sends it left (anticlockwise, towards 11).
    const z = c.zone;
    const off = z ? Math.abs(tau - z.mid) / z.half : 1;
    const tw = (scatterR.next() < 0.5 ? -1 : 1) * 8 * Math.min(2, off) * Math.min(2, off) * 0.5;
    const psiPlane = -(150 * c.bz + 42 * c.vbz) + tw + (scatterR.next() - 0.5) * 1.5;
    const line = res.landF * Math.sin((psiPlane * Math.PI) / 180);
    const eps = (scatterR.next() + scatterR.next() - 1) * 4.5 * clamp(Math.abs(res.thFirst ? 1 : 1), 0.5, 1.5);
    c.res = { ...res, turned: res.turned, psi: psiPlane + eps, psiPlane, line, tau, rel, vPlant: c.vPlant };
    c.flyT = 0; c.relT = s.t; c.xRel = c.x;
    setPh('fly');
    emit('heave', { tau, turned: res.turned });
    emit('flight', { first: res.first });
  }

  function judgeCaber() {
    const c = s.cab, res = c.res;
    let text, kind;
    if (res.turned) { kind = 'turned'; text = 'Turned'; }
    else if (res.fellBack) { kind = 'fellback'; text = 'Fell back'; }
    else { const under = ((res.thFirst % TAU) + TAU) % TAU < Math.PI; kind = under ? 'short' : 'over'; text = under ? 'No turn: too soft' : 'No turn: too hard'; }
    const sc = scoreCaber({ ...res, turned: res.turned, psi: res.psi, line: res.line }, c.cab.id);
    finishAttempt({ kind, turned: res.turned, text, psi: res.psi, line: res.line, clock: res.turned ? clockOf(res.psi) : null, pts: sc.pts, quality: sc.quality, clockPts: sc.clockPts, linePts: sc.linePts, caber: c.cab.id, tau: c.res.tau });
  }

  // ---- stone ------------------------------------------------------------------------------------------------------------------
  function updateStone(dt) {
    const k = s.st, inp = s.act;
    if (s.ph === 'angle') {
      // the angle swings smoothly between the limits
      k.t0 += dt;
      const sp = 1 / (1.5 * lvl.win * 0.9 + 0.55);
      k.angle = STONE_ANGLE.lo + (STONE_ANGLE.hi - STONE_ANGLE.lo) * (0.5 + 0.5 * Math.sin(k.t0 * TAU * sp * 0.5 - Math.PI / 2 + 1.3));
      if (inp.pressed && s.pt > 0.25) { k.locked = k.angle; emit('lock'); setPh('wind'); k.p = 0; k.wind = false; hold('wind', 'wind', 'Wind up and put', `Press and hold to wind up, release to put. Power fills in ${WIND_FULL.toFixed(1)} seconds. Let go close to full; hold too long and you step over the board for a foul.`, 'power'); }
      return;
    }
    if (s.ph === 'wind') {
      if (!k.wind && inp.pressed && s.pt > 0.2) { k.wind = true; k.windT = 0; emit('windup'); }
      if (k.wind) {
        k.windT += dt; k.p = k.windT / WIND_FULL;
        if (k.windT > WIND_FOUL) { throwStone(true); return; }
        if (inp.released) throwStone(false);
      }
      return;
    }
    if (s.ph === 'fly') { k.flyT += dt; if (k.fly && k.flyT >= k.fly.tl + 0.35) judgeStone(); else if (!k.fly && k.flyT > 1.2) judgeStone(); }
  }
  function throwStone(foul) {
    const k = s.st;
    k.foul = foul;
    if (foul) { k.fly = null; k.flyT = 0; setPh('fly'); emit('foul'); return; }
    const p = clamp(k.p, 0, 1);
    k.power = p;
    k.fly = stoneFlight(k.stone, k.locked, p);
    k.dist = k.fly.dist - 0.5;
    k.flyT = -0.18;                         // the arm needs a moment before the stone leaves the hand
    setPh('fly'); emit('put', { p, angle: k.locked });
  }
  function judgeStone() {
    const k = s.st;
    if (k.foul) return finishAttempt({ kind: 'foul', text: 'Foul: over the board', pts: 0, dist: 0 });
    const pts = Math.round(stonePointsFor(k.dist, k.stone));
    finishAttempt({ kind: 'put', text: `${k.dist.toFixed(2)} m`, dist: k.dist, pts, stone: k.stone.id, power: k.power, angle: k.locked });
  }

  // ---- weight over the bar --------------------------------------------------------------------------------------------------
  function updateWeight(dt0) {
    const w = s.wt, inp = s.act;
    if (s.ph === 'spin') {
      // slow motion while the weight climbs through the release arc behind the thrower
      const a = ((w.a % TAU) + TAU) % TAU;
      const inArc = w.w > 0 && a >= ARC.lo - 0.12 && a <= ARC.hi + 0.1 && w.lastCross > 0;
      w.inArc = w.w > 0 && a >= ARC.lo && a <= ARC.hi;
      const target = inArc ? 0.2 : 1;
      w.slow += (target - w.slow) * Math.min(1, dt0 * 18);
      const dt = dt0 * w.slow;
      w.timeUp += dt0;
      // energy conserving circle at speed vb at the bottom
      const prev = w.a;
      const v2 = w.vb * w.vb - 2 * G * WT.R * (1 - Math.cos(w.a));
      const v = Math.sqrt(Math.max(0.01, v2));
      w.w = v / WT.R;
      w.a += w.w * dt;
      // bottom crossing (a passes a multiple of 2*pi): the beat for a pump
      const crossed = Math.floor(w.a / TAU) > Math.floor(prev / TAU);
      if (crossed) { w.lap++; w.crossT = s.t; w.pumpedThisLap = false; w.lastCross = 1; emit('cross', { lap: w.lap }); }
      // a pump: a tap within the window of the bottom
      if (inp.pressed) {
        const win = 0.16 * lvl.win;
        const dist = Math.min(Math.abs(s.t - w.crossT), w.w > 0 ? 9 : 9);
        // allow the tap a little before the crossing too: predict the time of the next crossing
        const toNext = ((TAU - ((w.a % TAU) + TAU) % TAU) % TAU) / Math.max(0.5, w.w);
        const e = Math.min(dist, toNext);
        const early = toNext < dist;
        if (!w.inArc && e <= win && !(w.pumpedThisLap && !early) && w.lap >= 0) {
          const q = e <= 0.045 * lvl.win ? 1 : e <= 0.1 * lvl.win ? 0.7 : 0.4;
          w.vb = clamp(w.vb + (q === 1 ? 0.9 : q === 0.7 ? 0.6 : 0.3), 0, VB_MAX);
          w.pumps++; w.qs.push(q); if (!early) w.pumpedThisLap = true; else w.pumpEarly = w.lap + 1;
          emit('pump', { q, vb: w.vb });
        } else if (w.inArc) {
          releaseWeight(a);
        }
      }
      if (w.timeUp > 30 || (w.a > TAU * 14)) { finishAttempt({ kind: 'miss', text: 'Out of time', pts: 0, cleared: false, bar: w.bar }); }
      return;
    }
    if (s.ph === 'fly') { w.flyT += dt0; if (w.flyT >= w.fly.tEnd + 0.4) judgeWeight(); }
  }
  function releaseWeight(a) {
    const w = s.wt;
    const sweet = sweetAngle(w.vb, w.bar);
    // aim assist pulls a slightly early or late tap towards the best angle
    const assist = lvl.id === 1 ? 0.55 : lvl.id === 2 ? 0.3 : 0.0;
    const eff = a + (sweet - a) * assist * (Math.abs(sweet - a) < 0.35 ? 1 : 0);
    const f = weightFlight(w.vb, eff, w.bar);
    w.fly = f; w.flyT = 0; w.relA = a; w.effA = eff; w.rel = f.release;
    setPh('fly'); emit('release', { a, eff, vb: w.vb, cleared: f.cleared });
  }
  function sweetAngle(vb, H) {
    // the release angle that gives the biggest margin over the bar (scan; cheap)
    let best = 1.45, bm = -9;
    for (let d = 55; d <= 125; d += 1.5) {
      const f = weightFlight(vb, (d * Math.PI) / 180, H);
      const m = f.barY == null ? -5 : f.barY - H;
      if (m > bm) { bm = m; best = (d * Math.PI) / 180; }
    }
    return best;
  }
  function judgeWeight() {
    const w = s.wt, f = w.fly;
    const cleared = !!f.cleared;
    finishAttempt({ kind: cleared ? 'cleared' : f.hit ? 'knock' : 'miss', text: cleared ? `Cleared ${w.bar.toFixed(2)} m` : f.hit ? 'Bar knocked' : 'Missed the bar', cleared, bar: w.bar, pts: cleared ? Math.round(barPts(w.bar)) : 0, margin: f.barY == null ? null : f.barY - w.bar });
  }

  // ---- attempts, events, the festival ---------------------------------------------------------------------------------------
  function finishAttempt(res) {
    const ev = s.event;
    s.res = res;
    s.scores[ev][s.attempt] = res.pts;
    if (ev === 'weight') {
      if (res.cleared) { s.barBest = Math.max(s.barBest ?? 0, res.bar); s.best.weight = Math.round(barPts(s.barBest)); }
    } else s.best[ev] = Math.max(...s.scores[ev].filter((x) => x != null), 0);
    if (ev === 'stone' && res.dist) s.bestDist = Math.max(s.bestDist, res.dist);
    s.total = s.best.caber + s.best.stone + s.best.weight;
    setPh('judge');
    s.card = { kind: 'result', res };
    emit('judge', { kind: res.kind, pts: res.pts });
  }

  function advance() {
    // from the result card: the next attempt, or the end of the event
    if (s.attempt + 1 < ATTEMPTS[s.event]) {
      s.attempt++;
      if (s.event === 'weight' && s.res && s.res.cleared) s.wt.nextIdx = Math.min(BAR_HEIGHTS.length - 1, s.wt.barIdx + 1);
      beginAttempt();
      return;
    }
    endEvent();
  }
  function endEvent() {
    setPh('evend');
    const ev = s.event;
    s.card = { kind: 'event', event: ev, pts: s.best[ev], board: boardFor(ev) };
    emit('evend', { event: ev, pts: s.best[ev] });
    hold('evend', 'evend', `${EVENT_NAME[ev]} done`, 'The scoreboard shows how the other competitors did.', null);
  }
  function boardFor(ev) {
    const rows = s.rivals.map((r) => ({ name: r.name, pts: r.pts[ev], you: false }));
    rows.push({ name: 'You', pts: s.best[ev], you: true });
    rows.sort((a, b) => b.pts - a.pts);
    return rows;
  }
  function standingsNow() {
    const evs = s.list;
    const rows = s.rivals.map((r) => ({ name: r.name, total: evs.reduce((a, e) => a + r.pts[e], 0), you: false }));
    rows.push({ name: 'You', total: evs.reduce((a, e) => a + s.best[e], 0), you: true });
    rows.sort((a, b) => b.total - a.total);
    rows.forEach((x, i) => { x.rank = i + 1; });
    return rows;
  }
  function nextEvent() {
    if (s.idx + 1 < s.list.length) {
      s.idx++; s.event = s.list[s.idx]; s.attempt = 0; s.card = null;
      emit('newevent', { event: s.event });
      beginAttempt();
    } else {
      s.standings = standingsNow();
      s.over = true; setPh('end'); s.card = null;
      emit('festivalEnd', { rank: s.standings.find((x) => x.you).rank });
    }
  }

  // ---- the clock ---------------------------------------------------------------------------------------------------------------
  function update(dt) {
    step(dt);
    s.act = { down: s.act.down, pressed: false, released: false };
  }
  function step(dt) {
    if (s.hold || s.over) return;
    s.t += dt; s.pt += dt;
    if (s.replay) {
      s.replay.t += dt * s.replay.speed;
      if (s.replay.t > s.replay.end) s.replay = null;
    }
    if (s.ph === 'choose' || s.ph === 'evend' || s.ph === 'end') return;
    if (s.ph === 'judge') { return; }
    if (s.event === 'caber') updateCaber(dt);
    else if (s.event === 'stone') updateStone(dt);
    else updateWeight(dt);
  }

  function input(i) {
    s.pad = { f: i.pad ? i.pad.f : 0, l: i.pad ? i.pad.l : 0 };
    const a = i.act || {};
    // pressed / released are edges: keep them until the tick that reads them has run
    s.act = { down: !!a.down, pressed: s.act.pressed || !!a.pressed, released: s.act.released || !!a.released };
  }

  function startReplay() {
    if (s.ph !== 'judge' || !s.res) return false;
    let end = 0, start = -0.9;
    if (s.event === 'caber' && s.cab && s.cab.res && s.cab.res.frames) end = s.cab.res.tEnd + 0.8;
    else if (s.event === 'stone' && s.st && s.st.fly) end = s.st.fly.tl + 0.8;
    else if (s.event === 'weight' && s.wt && s.wt.fly) end = s.wt.fly.tEnd + 0.8;
    else return false;
    s.replay = { t: start, end, speed: 0.25, event: s.event };
    emit('replay');
    return true;
  }

  const api = {
    s, update, input, choose,
    startReplay,
    stopReplay() { s.replay = null; },
    next() {
      if (s.ph === 'judge') { s.replay = null; s.card = null; advance(); }
      else if (s.ph === 'evend') { nextEvent(); }
    },
    release() { s.hold = null; },
    begin() { beginAttempt(); },
    stoneSweet: () => STONE_ANGLE.ideal,
    sweetAngle,
    needSpeed,
    standings: standingsNow,
    suggest() {
      if (s.hold) return { summary: s.hold.summary, reason: s.hold.reason };
      const ph = s.ph, c = s.cab, w = s.wt;
      if (ph === 'lift') return { summary: 'Find the balance', reason: 'Drag toward the yellow dot so your hands go under the pole. Small early moves work best. Keep the dot inside the green ring until the bar fills.' };
      if (ph === 'run') return { summary: 'Hit the beats', reason: 'Tap STRIDE as each ring closes on the button. A perfect beat adds the most pace. Keep steering the lean with the other thumb.' };
      if (ph === 'heave') return { summary: 'Heave in the green', reason: c && c.zone ? `Tap HEAVE with the cursor inside the green (${Math.round(c.zone.lo * 100)} to ${Math.round(c.zone.hi * 100)} percent). The middle of the green is cleanest.` : 'The pole cannot be turned at this pace. Run faster next time.' };
      if (ph === 'angle') return { summary: 'Lock near 41 degrees', reason: 'Tap LOCK when the cursor is in the middle of the green.' };
      if (ph === 'wind') return { summary: 'Release near full', reason: 'Hold to wind up, and let go when the bar is full. Holding past full steps you over the board.' };
      if (ph === 'spin') return { summary: 'Spin, then let go', reason: w ? `Tap as the weight passes the bottom to add speed. The bar at ${w.bar.toFixed(1)} m needs about ${needSpeed(w.bar).toFixed(1)} m/s. Then tap in the slow arc.` : '' };
      if (ph === 'choose') return { summary: 'Choose', reason: 'Pick the option that suits how you feel: safer or bolder.' };
      return { summary: 'Take your time', reason: 'Nothing is timed right now.' };
    },
  };
  beginAttempt();
  return api;
}

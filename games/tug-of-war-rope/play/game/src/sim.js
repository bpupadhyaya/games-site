// The rope contest, pure and deterministic. One pull = one createPull(). Side 'a' is the team on the left of the screen in landscape (the player in a single-player
// pull), side 'b' the rivals. s.x is the flag's offset from the centre line in metres, positive = toward side 'a'. The simulation owns every number the picture shows:
// the 3D presenter and the HUD only read it.
export const DT = 1 / 60;
export const LIMIT = 1.6;            // metres from the centre line to a win line
export const PULL_TIME = 45;          // seconds of pulling before the flag's side wins
export const READY = 3;               // seconds of "take the strain" before the first pull
const WIN = { perfect: 0.075, good: 0.14, ok: 0.21 };    // timing windows in seconds either side of the beat
const GRADE = { perfect: { q: 1, sync: 0.14, cost: 0.05, coach: 0.2 }, good: { q: 0.72, sync: 0.07, cost: 0.06, coach: 0.1 }, ok: { q: 0.42, sync: -0.02, cost: 0.07, coach: 0 }, jerk: { q: 0.12, sync: -0.3, cost: 0.1, coach: 0 } };
const K_IMPULSE = 0.5;               // m/s given to the rope by one perfect heave at full sync and full stamina
const TAU = 0.7;                     // rope velocity decay time (s)
const ANCHOR_S = 5, COACH_S = 4, ANCHOR_N = 2;
export const BRACE_FULL = 0.35;      // seconds of holding for a full brace

// Rival strength 1-5. sd = timing noise (s), pow = how hard they pull, every = a surge every N of their beats, T = the chant period.
export const LEVELS = [
  { id: 1, name: 'Friendly', blurb: 'A slow chant, soft surges', sd: 0.15, pow: 0.95, every: 8, T: 1.0 },
  { id: 2, name: 'Local', blurb: 'Steady and honest', sd: 0.12, pow: 1.1, every: 6, T: 0.95 },
  { id: 3, name: 'Regional', blurb: 'Quick chant, surges to read', sd: 0.09, pow: 1.28, every: 5, T: 0.9 },
  { id: 4, name: 'Champion', blurb: 'Tight timing, hard surges', sd: 0.065, pow: 1.5, every: 4, T: 0.85 },
  { id: 5, name: 'Legend', blurb: 'Almost no mistakes', sd: 0.045, pow: 1.75, every: 3, T: 0.8 },
];
export const levelById = (id) => LEVELS[Math.max(0, Math.min(LEVELS.length - 1, (id | 0) - 1))];

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const other = (k) => (k === 'a' ? 'b' : 'a');
const mkSide = (stam) => ({
  stam, sync: 0.25, down: false, downT: 0, brace: 0, braceHold: 0, cd: 0, since: 9,
  anchorLeft: ANCHOR_N, anchorT: 0, coachMeter: 0, coachT: 0, streak: 0, bestStreak: 0,
  heaves: 0, perfect: 0, good: 0, jerks: 0, blocked: 0, hit: 0, effort: 0, last: null, gassed: false,
});

// opts: { level, T, mode: 'solo' | 'versus' | 'watch', stam: [a, b] }
export function createPull(opts, rng) {
  const lv = levelById(opts.level || 2);
  const T = opts.T || lv.T;
  const versus = opts.mode === 'versus';
  const st = opts.stam || [1, 1];
  const s = {
    mode: opts.mode || 'solo', level: lv.id, T, ph: 'ready', t: -READY, pt: 0, x: 0, v: 0, over: false, winner: null, why: '',
    a: mkSide(st[0]), b: mkSide(st[1]), events: [], evId: 0, surge: null, hold: null, hint: null,
    phase: { a: 0, b: 0.5 * T }, // beats: side a on k*T, side b half a beat later
    rival: { beatsLeft: lv.every + (rng.int ? rng.int(3) : 0), resting: false, anchorUsed: false, lastBeat: -9 },
    maxLead: 0, minLead: 0, timeLeft: PULL_TIME, dur: 0,
  };
  const ev = (type, o = {}) => { s.events.push({ id: ++s.evId, type, t: s.t, ...o }); if (s.events.length > 60) s.events.shift(); };
  const ws = (k) => (s[k].coachT > 0 ? 1.7 : 1);
  const beatPhase = (k) => s.phase[k];
  // error of time `t` against the nearest beat of side k: negative = early
  const beatErr = (k, t = s.t) => { const p = beatPhase(k); return t - p - Math.round((t - p) / T) * T; };
  const nextBeat = (k, t = s.t) => { const p = beatPhase(k); return p + Math.ceil((t - p) / T - 1e-9) * T; };
  const grade = (err, k) => { const a = Math.abs(err), w = ws(k); return a <= WIN.perfect * w ? 'perfect' : a <= WIN.good * w ? 'good' : a <= WIN.ok * w ? 'ok' : 'jerk'; };
  const stamF = (sd) => (sd.stam <= 0.08 ? 0.3 : 0.4 + 0.6 * Math.min(1, sd.stam / 0.45));
  const syncMult = (sd) => 0.55 + 0.75 * sd.sync;
  const braceF = (sd) => (sd.braceHold < 2.5 ? 1 : Math.max(0.4, 1 - ((sd.braceHold - 2.5) / 3.6) * 0.6));

  function pushRope(k, imp, surge) {
    const o = other(k), od = s[o];
    let block = od.brace * braceF(od) * (surge ? 0.8 : 0.35);
    if (od.anchorT > 0) block = 1 - (1 - block) * 0.5;
    const eff = imp * (1 - block);
    s.v += (k === 'a' ? 1 : -1) * K_IMPULSE * eff;
    if (surge) { if (block > 0.5) { od.blocked++; ev('block', { side: o, k: block }); od.sync = Math.min(1, od.sync + 0.1); s[k].sync = Math.max(0, s[k].sync - 0.15); } else { od.hit++; od.sync = Math.max(0, od.sync - 0.15); ev('hit', { side: o }); } }
    return eff;
  }

  function heave(k, err, surge = false) {
    const sd = s[k];
    const g = surge ? 'perfect' : grade(err, k), G = GRADE[g];
    const coach = sd.coachT > 0;
    let imp = G.q * syncMult(sd) * stamF(sd) * (coach ? 1.15 : 1) * (sd.anchorT > 0 ? 0.85 : 1);
    if (k === 'b') imp *= lv.pow;
    if (surge) imp *= 2.1;
    sd.stam = Math.max(0, sd.stam - G.cost * (coach ? 0.6 : 1) * (surge ? 4 : 1));
    sd.sync = clamp(sd.sync + G.sync, 0, 1);
    if (coach) sd.sync = Math.max(sd.sync, 0.85);
    sd.heaves++; sd.since = 0; sd.cd = 0.3; sd.effort = 1;
    if (g === 'perfect') { sd.perfect++; sd.streak++; sd.bestStreak = Math.max(sd.bestStreak, sd.streak); } else if (g === 'good') { sd.good++; sd.streak = 0; } else { sd.streak = 0; if (g === 'jerk') sd.jerks++; }
    if (sd.coachT <= 0) sd.coachMeter = clamp(sd.coachMeter + G.coach, 0, 1);
    sd.last = { t: s.t, g, err, surge };
    const eff = pushRope(k, imp, surge);
    ev('heave', { side: k, g, err, q: G.q, surge, eff });
  }

  function press(k) {
    const sd = s[k];
    if (s.over || s.ph === 'end') return;
    if (s.ph === 'ready') { sd.effort = 0.6; ev('warm', { side: k, err: beatErr(k) }); return; }
    if (sd.cd > 0) { sd.sync = Math.max(0, sd.sync - 0.1); sd.streak = 0; ev('rush', { side: k }); return; }
    heave(k, beatErr(k));
  }
  function call(k, what) {
    const sd = s[k];
    if (s.ph !== 'pull') return false;
    if (what === 'anchor' && sd.anchorLeft > 0 && sd.anchorT <= 0) { sd.anchorLeft--; sd.anchorT = ANCHOR_S; ev('anchor', { side: k }); return true; }
    if (what === 'coach' && sd.coachMeter >= 1 && sd.coachT <= 0) { sd.coachMeter = 0; sd.coachT = COACH_S; sd.sync = Math.max(sd.sync, 0.85); ev('coach', { side: k }); return true; }
    return false;
  }

  // human input for one side: `down` is the finger state this tick
  function input(k, down) {
    const sd = s[k];
    if (down && !sd.down) press(k);
    if (!down) sd.downT = 0;
    sd.down = down;
  }

  // ---- the rival: same rules, driven by a timer ------------------------------------------------------------------------------------------
  function rivalTick() {
    if (versus) return;
    const r = s.rival, b = s.b;
    const nb = nextBeat('b', s.t - DT * 0.5);
    // fire on the tick when the beat time passes
    if (s.t >= nb - 1e-9 && s.t - DT < nb - 1e-9 && r.lastBeat !== nb) {
      r.lastBeat = nb;
      if (s.ph !== 'pull') return;
      if (r.resting) { if (b.stam > 0.5) r.resting = false; else return; }
      if (b.stam < 0.22) { r.resting = true; ev('gasp', { side: 'b' }); return; }
      if (rng.next() < 0.03 + (b.stam < 0.4 ? 0.06 : 0)) return;                // a stumble: no heave
      r.beatsLeft--;
      if (r.beatsLeft <= 0 && b.stam > 0.45) {
        heave('b', 0, true); r.beatsLeft = lv.every + rng.int(3); s.surge = null; return;
      }
      const err = (rng.next() + rng.next() + rng.next() - 1.5) * 2 * lv.sd;
      heave('b', err);
      if (r.beatsLeft === 1 && b.stam > 0.45) { s.surge = { warn: s.t, hit: nb + T }; ev('surgeWarn', { side: 'b', hit: nb + T }); }
    }
    if (!r.anchorUsed && b.anchorLeft > 0 && s.ph === 'pull' && s.x > 0.9 && s.t > 8) { r.anchorUsed = true; call('b', 'anchor'); }
    if (r.anchorUsed && s.x < 0.1 && b.anchorLeft > 0 && s.t > 25 && b.anchorT <= 0) call('b', 'anchor');
    if (b.coachMeter >= 1 && s.ph === 'pull') call('b', 'coach');
  }

  function update(dt) {
    s.t += dt; s.pt += dt;
    if (s.ph === 'ready' && s.t >= 0) { s.ph = 'pull'; s.pt = 0; ev('go'); }
    else if (s.ph === 'end' && s.pt > 3.2) { s.over = true; }
    for (const k of ['a', 'b']) {
      const sd = s[k], o = s[other(k)];
      sd.cd = Math.max(0, sd.cd - dt); sd.since += dt; sd.effort = Math.max(0, sd.effort - dt * 3.2);
      const human = k === 'a' || versus;
      if (human) {
        sd.downT = sd.down ? sd.downT + dt : 0;
        sd.brace = clamp(sd.brace + (sd.down ? dt / BRACE_FULL : -dt / 0.15), 0, 1);
      } else sd.brace = s.ph === 'pull' ? 0.3 : 0;      // the rival keeps a light, steady grip
      if (sd.brace > 0.6) sd.braceHold += dt; else sd.braceHold = Math.max(0, sd.braceHold - dt * 0.5);
      if (sd.anchorT > 0) sd.anchorT = Math.max(0, sd.anchorT - dt);
      if (sd.coachT > 0) sd.coachT = Math.max(0, sd.coachT - dt);
      // sync fades, stamina comes back faster when braced or resting
      if (sd.since > 0.9) sd.sync = Math.max(0, sd.sync - 0.02 * dt);
      const regen = sd.brace * braceF(sd) > 0.5 ? 0.1 : sd.since > 0.5 ? 0.035 : 0;
      if (s.ph === 'pull') sd.stam = Math.min(1, sd.stam + regen * dt);
      sd.gassed = sd.stam <= 0.08;
      void o;
    }
    if (s.ph === 'pull' || s.ph === 'end') {
      if (s.ph === 'pull') rivalTick();
      const brace = Math.max(s.a.brace * braceF(s.a), s.b.brace * braceF(s.b));
      const anchor = (s.a.anchorT > 0 || s.b.anchorT > 0) ? 0.6 : 1;
      const tau = TAU * (1 - 0.35 * brace) * anchor * (s.ph === 'end' ? 0.35 : 1);
      s.v *= Math.exp(-dt / tau);
      s.x += s.v * dt;
      s.maxLead = Math.max(s.maxLead, s.x); s.minLead = Math.min(s.minLead, s.x);
    }
    if (s.ph === 'pull') {
      s.timeLeft = Math.max(0, PULL_TIME - s.pt);
      if (s.surge && s.t > s.surge.hit + 0.05) s.surge = null;
      if (Math.abs(s.x) >= LIMIT) finish(s.x > 0 ? 'a' : 'b', 'line');
      else if (s.pt >= PULL_TIME) {
        const w = Math.abs(s.x) > 0.04 ? (s.x > 0 ? 'a' : 'b') : (s.a.stam >= s.b.stam ? 'a' : 'b');
        finish(w, 'time');
      }
    }
  }
  function finish(w, why) {
    s.dur = s.pt; s.ph = 'end'; s.pt = 0; s.winner = w; s.why = why; s.surge = null;
    s.x = clamp(s.x, -LIMIT - 0.3, LIMIT + 0.3);
    ev('end', { winner: w, why });
  }

  // ---- hints for the player: the same advice Watch & Learn explains ----------------------------------------------------------------------------
  function suggest(k = 'a') {
    const sd = s[k], o = s[other(k)];
    if (s.ph === 'ready') return { id: 'tempo', title: 'Find the beat', text: 'The ring closes on the target at every chant beat. Tap exactly when it lands. Practise now: nothing counts until GO.', action: 'tap' };
    if (s.surge && s.t < s.surge.hit) return { id: 'surge', title: 'Rival surge coming', text: 'The rivals are about to heave with everything they have. HOLD your finger down now to dig in and block most of it.', action: 'hold' };
    if (sd.coachMeter >= 1 && sd.coachT <= 0) return { id: 'coach', title: 'Call the coach', text: 'Your coach meter is full. Tap COACH: the timing windows get wider and your team pulls together for four seconds.', action: 'coach' };
    if (s.x < -0.8 && sd.anchorLeft > 0 && sd.anchorT <= 0) return { id: 'anchor', title: 'Anchor down', text: 'The flag is close to the rivals\' line. Call ANCHOR: the last person wraps the rope and the rivals\' pulls are halved for five seconds.', action: 'anchor' };
    if (sd.stam < 0.3) return { id: 'tired', title: 'Arms are tiring', text: 'Your stamina is low and every heave is weaker. HOLD to dig in and breathe for a few beats, then pull again.', action: 'hold' };
    if (o.stam < 0.25 && o.gassed !== undefined) return { id: 'rivalTired', title: 'Rivals are gasping', text: 'Their stamina is low. Keep pulling on the beat now: this is the moment to take the line.', action: 'tap' };
    if (sd.sync < 0.4) return { id: 'sync', title: 'Build team sync', text: 'Perfect heaves build sync, and sync adds pull to every heave. Wait for the target, then tap.', action: 'tap' };
    return { id: 'beat', title: 'Pull on the beat', text: 'Tap as the ring lands on the target. Perfect timing pulls hardest and costs the least stamina.', action: 'tap' };
  }

  const API = { s, update, input, press, call, heave, suggest, beatErr, nextBeat, grade, windows: () => ({ ...WIN }), ws };
  return API;
}

// A computer teammate used by Watch & Learn and by the tests: taps with a small timing error, braces for surges, rests when tired, uses the calls.
export function createCoachBot(rng, skill = 0.96) {
  let tapAt = null, upAt = 0;
  const sdv = 0.2 * (1.1 - skill);
  const noise = () => (rng.next() + rng.next() + rng.next() - 1.5) * 2 * sdv;
  return (P, k = 'a') => {
    const s = P.s, sd = s[k];
    if (s.ph !== 'pull') { if (sd.down) P.input(k, false); tapAt = null; return; }
    const brace = !!(s.surge && s.t < s.surge.hit + 0.2) || sd.stam < 0.2;
    if (s.x < -0.8) P.call(k, 'anchor');
    if (sd.coachMeter >= 1) P.call(k, 'coach');
    if (brace && s.t > s.surge?.warn - 0.45 + 0.0 || (sd.stam < 0.2)) { if (!sd.down) P.input(k, true); tapAt = null; return; }
    if (sd.down && s.t >= upAt) P.input(k, false);
    if (tapAt === null) tapAt = P.nextBeat(k, s.t + 0.03) + noise();
    if (!sd.down && s.t >= tapAt) { P.input(k, true); upAt = s.t + 0.1; tapAt = null; }
  };
}

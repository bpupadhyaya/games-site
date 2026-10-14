// Cirit simulation: pure, deterministic, fixed 60 Hz. One bout = two passes between one rider of each team on a long field.
// In a pass the CHASER rides behind the RUNNER and throws blunt wooden javelins at the runner's target shield; at the end both riders
// wheel away and the roles swap. The presenter and the HUD only READ the state exposed here.
import {
  DT, GRAV, Z_END, Z_START, PADDOCK_Z, LANES, V_MIN, JAV_N, WIND_TICKS, FOLLOW_TICKS, THROW_COOL, V_THROW, HAND_Y, MARK_Y,
  HIT_R, BULL_R, SOLID_R, REACH_MAX, flightTime, LEAN_T, LEAN_SAFE, PTS, LONG_RANGE, MARK_BACK, PASS_MAX, INTRO_T, WHEEL_MAX, OUTRO_T, GAP_START,
  HORSES, LEVELS,
} from './consts.js';
import { clamp, lerp, hyp, wrap } from './util.js';
import { aiInput, applyAiHold } from './ai.js';
import { solveThrow, handAt } from './ballistics.js';

const mkStats = () => ({ throws: 0, hits: 0, bulls: 0, dodges: 0, leanDodges: 0, pts: 0, best: 0, streak: 0, bestStreak: 0, fast: 0, long: 0 });

export const vmaxOf = (r) => HORSES[r.horse].vmax;
export const laneOf = (x) => { let b = 0; for (let i = 1; i < 3; i++) if (Math.abs(x - LANES[i]) < Math.abs(x - LANES[b])) b = i; return b; };

function mkRider(id, team, slot, horse) {
  return {
    id, team, slot, horse, x: -7, z: PADDOCK_Z, h: 0, v: 0, w: 0, lane: 1, thr: 0.5, vlat: 0, role: 'idle', active: false,
    javs: 0, sw: { ph: 'idle', tc: 0, end: 0, aim: null }, cool: 0, lean: { t: 0, cool: 0, on: false }, stam: 1, turn: 0, turnDir: 1,
    ai: { next: 0, want: 0, delay: 0.3, thr: 0.7, laneAt: 0, react: -1, seen: -1 }, human: false,
  };
}

export function createSim(cfg, rngIn) {
  const rng = rngIn;
  const gauss = () => { let u = 0; while (u <= 1e-9) u = rng.next(); const v = rng.next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const bouts = cfg.practice ? 9999 : cfg.bouts;
  const s = {
    cfg: { human: cfg.human, levels: cfg.levels, bouts, watch: !!cfg.watch, practice: cfg.practice || null, lineups: cfg.lineups, first: cfg.first || 0 },
    t: 0, tick: 0, evId: 0, events: [], phase: 'intro', phaseT: 0, bout: 0, pass: 0, dir: 1, score: [0, 0], stats: [mkStats(), mkStats()],
    riders: [], act: [0, 3], chaser: 0, runner: 3, javs: [], jid: 0, over: false, winner: -1, hold: null, passT: 0, passScore: [0, 0], boutScore: [[0, 0]],
    fade: 0, resets: 0, hint: '',
  };
  for (let t = 0; t < 2; t++) for (let i = 0; i < 3; i++) s.riders.push(mkRider(t * 3 + i, t, i, cfg.lineups[t][i % cfg.lineups[t].length]));
  s.riders.forEach((r) => { r.human = cfg.human === r.team; });
  const emit = (e) => { e.id = s.evId++; e.t = s.t; s.events.push(e); if (s.events.length > 48) s.events.shift(); return e; };
  const R = (id) => s.riders[id];
  const opp = (r) => R(s.act[1 - r.team]);

  // ---- bout / pass lifecycle ------------------------------------------------------------------------------------------------
  function parkAll() {
    const k = [0, 0];
    s.riders.forEach((r) => {
      r.active = false; r.role = 'idle'; r.v = 0; r.w = 0; r.vlat = 0; r.h = 0; r.sw = { ph: 'idle', tc: 0, end: 0, aim: null }; r.lean.t = 0;
      r.x = -5.6 - 2.1 * r.team - 0.6 * r.slot; r.z = PADDOCK_Z + 3 - 3.1 * k[r.team]++ - r.team * 1.2; r.lane = 1;
    });
  }
  function beginBout() {
    const b = s.bout, slot = b % 3;
    s.act = [slot, 3 + slot];
    const pm = s.cfg.practice;
    const first = pm ? (pm.mode === 'defend' ? 1 - s.cfg.human : s.cfg.human) : (b + s.cfg.first) % 2;   // who chases first
    s.dir = 1; s.pass = 0;
    const lane = rng.int(3);
    const ch = R(first * 3 + slot), ru = R((1 - first) * 3 + slot);
    s.chaser = ch.id; s.runner = ru.id;
    for (const r of [ch, ru]) { r.active = true; r.h = 0; r.v = 1.5; r.w = 0; r.vlat = 0; r.lane = lane; r.x = LANES[lane] - 3.2; r.lean = { t: 0, cool: 0, on: false }; r.stam = 1; r.thr = 0.4; }
    ch.role = 'chase'; ru.role = 'run';
    ch.z = -Z_START - 12; ru.z = ch.z + GAP_START;
    ch.x = LANES[lane]; ru.x = LANES[lane];
    s.phase = 'intro'; s.phaseT = 0; s.javs = [];
    emit({ type: 'bout', bout: b, chaser: ch.id, runner: ru.id });
  }
  function startPass() {
    s.phase = 'pass'; s.phaseT = 0; s.passT = 0; s.passScore = [0, 0];
    const ch = R(s.chaser), ru = R(s.runner);
    ch.javs = JAV_N; ch.cool = 0.3; ch.sw = { ph: 'idle', tc: 0, end: 0, aim: null }; ch.ai.want = 0; ch.ai.delay = 0.2 + rng.next() * 0.5;
    ru.javs = 0; ru.ai.react = -1; ru.ai.laneAt = s.t + 1.2 + rng.next() * 1.5; ru.ai.next = s.t + 0.5;
    s.javs = [];
    emit({ type: 'pass', pass: s.pass, bout: s.bout, dir: s.dir, chaser: ch.id, runner: ru.id });
  }
  function endPass(why) {
    s.javs.forEach((j) => { if (j.state === 'fly') j.state = 'down'; });
    emit({ type: 'passEnd', why, pass: s.pass, bout: s.bout });
    s.hold = null;
    for (const id of s.act) { const r = R(id); r.turn = 0; r.turnDir = -s.dir; r.sw = { ph: 'idle', tc: 0, end: 0, aim: null }; r.lean.t = 0; }
    if (s.cfg.practice) { s.phase = 'reset'; s.phaseT = 0; return; }
    if (s.pass >= 1) { s.pass++; s.phase = 'outro'; s.phaseT = 0; return; }
    s.phase = 'wheel'; s.phaseT = 0;
  }
  function afterWheel() {
    s.pass++;
    s.dir = -s.dir;
    const old = s.chaser; s.chaser = s.runner; s.runner = old;
    R(s.chaser).role = 'chase'; R(s.runner).role = 'run';
    const lane = rng.int(3);
    for (const id of s.act) { R(id).lane = id === s.chaser ? R(id).lane : lane; }
    R(s.chaser).lane = R(s.runner).lane;
    s.phase = 'intro2'; s.phaseT = 0;
  }
  function endBout() {
    s.bout++;
    s.boutScore.push([s.score[0], s.score[1]]);
    emit({ type: 'boutEnd', bout: s.bout - 1, score: [s.score[0], s.score[1]] });
    if (s.bout >= s.cfg.bouts) {
      s.phase = 'end'; s.phaseT = 0; s.over = true;
      s.winner = s.score[0] === s.score[1] ? -1 : s.score[0] > s.score[1] ? 0 : 1;
      emit({ type: 'end', winner: s.winner });
      return;
    }
    parkAll(); beginBout();
  }

  // ---- control -----------------------------------------------------------------------------------------------------------------
  function control(r, inp) {
    const o = opp(r);
    const human = r.human && !s.cfg.watch;
    let c;
    if (human) c = inp || {};
    else c = aiInput(s, r, o, LEVELS[clamp(s.cfg.levels[r.team] - 1, 0, 4)], rng, gauss);
    return c;
  }
  const effVmax = (r) => vmaxOf(r) * (r.stam > 0.15 ? 1 : 0.86);

  function moveRider(r, c, dt, dir) {
    const H = HORSES[r.horse];
    if (c.thr !== undefined) r.thr = clamp(c.thr, 0, 1);
    if (c.laneStep) r.lane = clamp(r.lane + c.laneStep, 0, 2);
    if (c.lane !== undefined && c.lane !== null) r.lane = clamp(c.lane | 0, 0, 2);
    const vt = lerp(V_MIN, effVmax(r), r.thr);
    const acc = r.v < vt ? H.acc : H.acc * 1.9;
    r.v += clamp(vt - r.v, -acc * dt, acc * dt);
    // stamina: full gallop burns it, an easy pace restores it
    r.stam = clamp(r.stam + (r.thr > 0.86 ? -0.085 : r.thr < 0.55 ? 0.05 : 0.0) * dt, 0, 1);
    const rejoin = Math.abs(r.x - LANES[r.lane]) > 2.8 ? 2.2 : 1;
    const vl = clamp((LANES[r.lane] - r.x) * 3.2, -H.lat * rejoin, H.lat * rejoin);
    r.vlat += (vl - r.vlat) * Math.min(1, dt * 9);
    r.x += r.vlat * dt; r.z += dir * r.v * dt;
    const hn = Math.atan2(r.vlat, dir * Math.max(r.v, 1));
    const dh = wrap(hn - r.h);
    r.h = wrap(r.h + dh * Math.min(1, dt * 8));
    r.w = dh * Math.min(1, dt * 8) / dt;
    if (r.lean.cool > 0) r.lean.cool = Math.max(0, r.lean.cool - dt);
    if (c.lean && r.lean.t <= 0 && r.lean.cool <= 0 && r.role === 'run') { r.lean.t = 1e-6; emit({ type: 'lean', rider: r.id }); }
  }

  function startThrow(r, aim, why) {
    r.sw = { ph: 'wind', tc: s.tick + WIND_TICKS, end: 0, aim: { z: aim.z, lane: clamp(aim.lane | 0, 0, 2) }, why: why || '' };
    r.javs--; r.cool = THROW_COOL + WIND_TICKS * DT;
    s.stats[r.team].throws++;
    emit({ type: 'throw', rider: r.id, tc: r.sw.tc, aim: r.sw.aim, team: r.team });
  }

  function release(r) {
    const o = opp(r), dir = s.dir, aim = r.sw.aim;
    const O = handAt(r.x, r.z, dir);
    const ratio = r.thr;
    const dist0 = Math.abs(aim.z - O.z);
    const sig = 0.14 + 0.6 * Math.pow(ratio, 2) * HORSES[r.horse].shake + 0.012 * dist0;
    const ez = gauss() * sig, ex = gauss() * sig * 0.55;
    const P = { x: LANES[aim.lane] + ex, y: MARK_Y, z: aim.z + ez };
    const sol = solveThrow(O, { x: r.vlat, z: dir * r.v }, P);
    const j = { id: s.jid++, owner: r.id, team: r.team, x: O.x, y: O.y, z: O.z, vx: sol.vx, vy: sol.vy, vz: sol.vz, state: 'fly', age: 0, sgn: 0, fast: r.thr >= 0.86, dist: sol.dist, long: sol.dist >= LONG_RANGE, aimLane: aim.lane, tgt: o.id, ax: P.x, az: P.z };
    s.javs.push(j);
    emit({ type: 'release', rider: r.id, jav: j.id, dist: sol.dist, q: ratio, short: sol.short });
  }

  function leanSafe(r) { return r.lean.t >= LEAN_SAFE[0] && r.lean.t <= LEAN_SAFE[1]; }

  function stepJavs(dt) {
    for (const j of s.javs) {
      if (j.state === 'down') { j.age += dt; continue; }
      if (j.state === 'drop') { j.vy -= GRAV * dt; j.x += j.vx * dt; j.y += j.vy * dt; j.z += j.vz * dt; if (j.y <= 0.04) { j.y = 0.04; j.state = 'down'; j.age = 0; } continue; }
      if (j.state !== 'fly') continue;
      const tg = R(j.tgt), dir = s.dir;
      const N = 3, h = dt / N;
      for (let k = 0; k < N; k++) {
        j.vy -= GRAV * h; j.x += j.vx * h; j.y += j.vy * h; j.z += j.vz * h; j.age += h;
        if (tg.active && s.phase === 'pass') {
          const mz = tg.z - dir * MARK_BACK;
          const dxm = j.x - tg.x, dym = j.y - MARK_Y, dzm = j.z - mz;
          const sg = Math.sign(dzm) || 1;
          if (hyp(dxm, dym, dzm) <= HIT_R && !leanSafe(tg)) {
            // closest approach along the relative path decides the quality
            const rvx = j.vx - tg.vlat, rvy = j.vy, rvz = j.vz - dir * tg.v;
            const uu = rvx * rvx + rvy * rvy + rvz * rvz || 1;
            const tt = clamp(-(dxm * rvx + dym * rvy + dzm * rvz) / uu, 0, 0.2);
            scoreHit(j, tg, hyp(dxm + rvx * tt, dym + rvy * tt, dzm + rvz * tt));
            break;
          }
          if (j.sgn === 0) j.sgn = sg;
          else if (sg !== j.sgn && !j.crossed) {
            j.crossed = true;
            const miss = hyp(j.x - tg.x, j.y - MARK_Y);
            if (miss <= HIT_R + 0.01) dodge(j, tg, true, miss);
            else if (miss < 3.2) dodge(j, tg, tg.lean.t > 0, miss);
            else { s.stats[j.team].streak = 0; emit({ type: 'miss', rider: j.owner, jav: j.id, miss, x: j.x, z: j.z }); }
          }
        }
        if (j.y <= 0.04) { j.y = 0.04; j.state = 'down'; j.age = 0; j.vx = j.vy = j.vz = 0; emit({ type: 'ground', jav: j.id, x: j.x, z: j.z, owner: j.owner }); break; }
      }
    }
  }

  function scoreHit(j, tg, dm) {
    const st = s.stats[j.team];
    const q = dm <= BULL_R ? 'bull' : dm <= SOLID_R ? 'solid' : 'glance';
    let pts = q === 'bull' ? PTS.bull : q === 'solid' ? PTS.solid : PTS.glance;
    const style = [];
    if (j.fast) { pts += PTS.fast; style.push('fast'); st.fast++; }
    if (j.long) { pts += PTS.long; style.push('long'); st.long++; }
    st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak);
    if (st.streak > 1) { const b = Math.min(PTS.streakMax, st.streak - 1); pts += b; style.push('streak'); }
    st.hits++; if (q === 'bull') st.bulls++; st.pts += pts; st.best = Math.max(st.best, pts);
    s.score[j.team] += pts; s.passScore[j.team] += pts;
    j.state = 'drop'; j.vx = tg.vlat * 0.6; j.vz = s.dir * tg.v * 0.55; j.vy = 1.6;
    emit({ type: 'hit', rider: j.owner, team: j.team, tgt: tg.id, q, pts, style, x: j.x, y: j.y, z: j.z, dist: j.dist, dm });
    tg.struck = s.tick;
  }
  function dodge(j, tg, lean, miss) {
    const team = tg.team, st = s.stats[team];
    st.dodges++;
    let pts = PTS.dodge;
    if (lean) { pts += PTS.leanDodge; st.leanDodges++; }
    st.pts += pts; s.score[team] += pts; s.passScore[team] += pts;
    // a dodge also breaks the thrower's streak
    s.stats[j.team].streak = 0;
    emit({ type: 'dodge', team, rider: tg.id, lean, pts, miss, x: j.x, z: j.z });
  }

  // ---- one tick ----------------------------------------------------------------------------------------------------------------------
  function step(inp) {
    const dt = DT;
    const ph0 = s.phase;
    if (ph0 === 'end') { s.t += dt; s.tick++; return; }
    if (s.hold && !s.hold.go) return;        // Watch & Learn: the whole world waits for the decision
    s.t += dt; s.tick++; s.phaseT += dt;
    const ph = s.phase;
    if (s.phase !== 'reset' && s.fade > 0) s.fade = Math.max(0, s.fade - dt * 1.6);
    // javelins fly in every phase
    stepJavs(dt);
    if (s.javs.length > 12) s.javs = s.javs.filter((j) => j.state !== 'down' || j.age < 2.5 || s.javs.indexOf(j) > s.javs.length - 7);
    // lean timers
    for (const id of s.act) {
      const r = R(id);
      if (r.lean.t > 0) { r.lean.t += dt; if (r.lean.t >= LEAN_T) { r.lean.t = 0; r.lean.cool = HORSES[r.horse].leanCool; } }
    }
    if (ph === 'intro' || ph === 'intro2') {
      for (const id of s.act) {
        const r = R(id);
        const c = { thr: 0.52 };
        moveRider(r, c, dt, s.dir);
      }
      const limit = ph === 'intro' ? INTRO_T : 0.01;
      if (s.phaseT >= limit) { s.phase = 'pass'; startPass(); }
      return;
    }
    if (ph === 'pass') {
      s.passT += dt;
      // resolve a Watch & Learn hold that the game released
      if (s.hold && s.hold.go) { applyAiHold(s, s.hold, { startThrow, R }); s.hold = null; }
      const ch = R(s.chaser), ru = R(s.runner), dir = s.dir;
      for (const id of s.act) {
        const r = R(id);
        const isHumanTeam = r.human && !s.cfg.watch;
        let c = control(r, isHumanTeam ? (inp ? inp[r.team] : null) : null);
        if (c && c.hold) { // an AI decision that Watch & Learn stops on
          if (!s.hold) s.hold = { id: s.tick, ...c.hold, go: false };
          c = { thr: c.thr, lane: c.lane };
        }
        if (isHumanTeam && r.role === 'chase') {
          // the human chaser's lane follows the runner by itself; the thumb only aims the ring
          c = { ...c, lane: laneOf(ru.x) };
        }
        if (r.role === 'chase' && r.sw.ph === 'idle' && c.throw && r.javs > 0 && r.cool <= 0 && !s.hold) {
          const dist = dir * (ru.z - r.z);
          if (dist > 1.5 && dist < REACH_MAX) startThrow(r, c.throw, c.why);
        }
        moveRider(r, c, dt, dir);
        if (r.cool > 0) r.cool -= dt;
        if (r.sw.ph === 'wind' && s.tick >= r.sw.tc) { release(r); r.sw.ph = 'follow'; r.sw.end = s.tick + FOLLOW_TICKS; }
        else if (r.sw.ph === 'follow' && s.tick >= r.sw.end) r.sw = { ph: 'idle', tc: 0, end: 0, aim: null };
      }
      // pass end
      const ahead = dir * (ru.z - ch.z);
      const flying = s.javs.some((j) => j.state === 'fly');
      if (dir * ru.z >= Z_END) endPass('line');
      else if (s.passT >= PASS_MAX) endPass('time');
      else if (ahead < 1.2) endPass('level');
      else if (ch.javs <= 0 && ch.sw.ph === 'idle' && !flying && s.passT > 1 && s.cfg.practice) endPass('spent');
      return;
    }
    if (ph === 'wheel') {
      // both riders sweep a turn toward the far side and settle onto the new heading (the old runner ends up behind the old chaser)
      let done = 0;
      for (const id of s.act) {
        const r = R(id), H = HORSES[r.horse];
        const om = 2.3 * (0.8 + 0.2 * H.lat / 3);
        r.v += clamp(7.0 - r.v, -6 * dt, 4 * dt);
        if (r.turn < Math.PI - 0.02) {
          const d = Math.min(om * dt, Math.PI - r.turn);
          r.turn += d; r.h = wrap(r.h + r.turnDir * d); r.w = r.turnDir * om;
        } else { r.w = 0; done++; }
        r.x += Math.sin(r.h) * r.v * dt; r.z += Math.cos(r.h) * r.v * dt;
        r.vlat = Math.sin(r.h) * r.v;
        if (r.lean.cool > 0) r.lean.cool = Math.max(0, r.lean.cool - dt);
      }
      if (done === 2 || s.phaseT > WHEEL_MAX) {
        for (const id of s.act) {
          const r = R(id);
          r.h = s.dir > 0 ? Math.PI : 0; r.turn = 0; r.lane = laneOf(r.x); r.vlat = 0;
        }
        afterWheel();
        if (s.phase === 'intro2') {
          // the old runner (now behind) is the new chaser: set the gap and let both settle for a moment
          const ch = R(s.chaser), ru = R(s.runner);
          const gapNow = s.dir * (ru.z - ch.z);
          if (gapNow < 8) ru.z += s.dir * (8 - gapNow);
          if (gapNow > 15) ru.z -= s.dir * (gapNow - 15);
          s.phase = 'pass'; startPass();
        }
      }
      return;
    }
    if (ph === 'outro') {
      for (const id of s.act) {
        const r = R(id);
        // ride on to the paddock end and ease down; the next riders come out from there
        const toZ = PADDOCK_Z + 4 - r.z;
        const v = Math.abs(toZ) < 6 ? 2.0 : 10.0;
        r.v += clamp(v - r.v, -5 * dt, 4 * dt);
        const dz = Math.sign(toZ) || 1;
        r.h = dz > 0 ? 0 : Math.PI; r.z += dz * r.v * dt; r.w = 0;
        const tx = LANES[r.lane] - 3;
        r.vlat = clamp((tx - r.x) * 2, -2.5, 2.5); r.x += r.vlat * dt;
      }
      const near = s.act.every((id) => Math.abs(R(id).z - (PADDOCK_Z + 4)) < 7);
      if ((near && s.phaseT >= OUTRO_T * 0.6) || s.phaseT >= 9) endBout();
      return;
    }
    if (ph === 'reset') {
      for (const id of s.act) { const r = R(id); moveRider(r, { thr: 0.55 }, dt, s.dir); }
      s.fade = Math.min(1, s.phaseT / 0.8);
      if (s.phaseT >= 0.8) { const b = s.bout; parkAll(); beginBout(); s.bout = b; s.fade = 1; s.resets++; s.freshT = s.t; }
    }
  }

  const api = {
    s,
    update(dt, inp) { step(inp || null); },
    // Watch & Learn: the stopped decision may now be carried out
    release() { if (s.hold) s.hold.go = true; },
    snapshot() { return JSON.parse(JSON.stringify(s)); },
    restore(d) { Object.assign(s, JSON.parse(JSON.stringify(d))); },
    startBout() { beginBout(); },
    // continue a saved match at the start of bout b
    resumeAt(b, score, stats) {
      parkAll(); s.bout = b; s.score = [score[0], score[1]]; if (stats) s.stats = JSON.parse(JSON.stringify(stats));
      s.boutScore = [[0, 0]]; beginBout();
    },
    R, rng,
  };
  parkAll();
  beginBout();
  return api;
}

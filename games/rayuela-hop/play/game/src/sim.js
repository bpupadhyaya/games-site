// The Rayuela engine: turns, the toss mini-game, the beat-timed hop route, fouls, the pick-up, the Sky turn, two players and the computer.
// Pure and deterministic: time only from update(dt), randomness only from the rng handed in. The 3D scene and the 2D fallback only READ `s`.
import { getCourse } from './courses.js';
import {
  STEP, COUNT_BEATS, AIR, TIMING, POINTS, TEJO_R, AIM_RANGE, TOSS_FLIGHT, AIM_START_DELAY, T_INTRO, T_LANDED, T_FOUL, T_CLEAN, SKILL,
} from './consts.js';

const sin = Math.sin, cos = Math.cos;
const tri = (u) => { const f = u - Math.floor(u); return f < 0.5 ? -1 + 4 * f : 3 - 4 * f; };       // triangle wave, -1..1, period 1
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const FOUL_TEXT = {
  line: 'Stepped on a line',
  late: 'Missed the beat',
  wrong: 'Wrong feet',
  foot: 'Wrong foot order',
  pick: 'Dropped the tejo',
};

/** Where the tejo lands for a given sweep offset in the target square's own frame (x = its left, z = its forward). */
export function worldOf(cell, lx, lz) {
  const l = [cos(cell.yaw), -sin(cell.yaw)], f = [sin(cell.yaw), cos(cell.yaw)];
  return { x: cell.x + l[0] * lx + f[0] * lz, z: cell.z + l[1] * lx + f[1] * lz };
}
export function localOf(cell, x, z) {
  const dx = x - cell.x, dz = z - cell.z;
  return { lx: dx * cos(cell.yaw) - dz * sin(cell.yaw), lz: dx * sin(cell.yaw) + dz * cos(cell.yaw) };
}

/** Classify where a disc of radius TEJO_R centred at (x, z) lies relative to the target cell and the whole course. */
export function judgeToss(C, targetId, x, z) {
  const T = C.cells[targetId];
  const { lx, lz } = localOf(T, x, z);
  const hx = T.w / 2, hz = T.d / 2;
  const inner = Math.abs(lx) <= hx - TEJO_R && Math.abs(lz) <= hz - TEJO_R;
  if (inner) return { ok: true, reason: 'in', lx, lz };
  if (Math.abs(lx) <= hx + TEJO_R && Math.abs(lz) <= hz + TEJO_R) return { ok: false, reason: 'line', lx, lz };
  for (const c of C.cells) {
    if (c.id === targetId) continue;
    const q = localOf(c, x, z);
    if (Math.abs(q.lx) <= c.w / 2 + TEJO_R && Math.abs(q.lz) <= c.d / 2 + TEJO_R) return { ok: false, reason: Math.abs(q.lx) <= c.w / 2 - TEJO_R && Math.abs(q.lz) <= c.d / 2 - TEJO_R ? 'wrong' : 'line', lx, lz };
  }
  return { ok: false, reason: 'off', lx, lz };
}

const needsHard = (k) => k === 'both' || k === 'open' || k === 'pick' || k === 'sky';

/** The list of landings for one run, given where the tejo lies. mk = null (no tejo on the course) or { cell } (a numbered square). */
export function buildRoute(C, mk) {
  const S = C.stops.length - 1;
  const steps = [];
  const mkStop = mk ? C.cells[mk.cell].stop : -1;
  const mkSide = mk ? C.cells[mk.cell].side : null;
  const centre = (st) => ({ x: st.x, z: st.z });
  const posOf = (k, stopI, side) => {
    if (k === 'exit') return { x: C.start.x, z: C.start.z };
    const st = C.stops[stopI];
    if (k === 'one') { const c = C.cells[st.cells[0]]; return { x: c.x, z: c.z }; }
    if (k === 'open') { const c = C.cells[st.cells.find((id) => C.cells[id].side === side)]; return { x: c.x, z: c.z }; }
    return centre(st);
  };
  const push = (k, stopI, dir, extra = {}) => {
    const st = stopI >= 0 ? C.stops[stopI] : null;
    const span = k === 'sky' || k === 'pick' ? 2 : 1;
    const o = { i: steps.length, k, stop: stopI, dir, span, side: extra.side || null, state: 'pending', t: 0, d: 0, grade: '', foot: '', reason: '', pos: null, from: null, yaw: 0 };
    o.pos = posOf(k, stopI, extra.side);
    steps.push(o);
    void st;
    return o;
  };
  for (let i = 0; i <= S; i++) {
    const st = C.stops[i];
    if (st.type === 'k') { push('sky', i, 'out'); continue; }
    if (mkStop === i) {
      if (st.type === 'p') push('open', i, 'out', { side: mkSide === 'L' ? 'R' : 'L' });
      continue;                                    // a single square holding the tejo is leapt over
    }
    push(st.type === 'p' ? 'both' : 'one', i, 'out');
  }
  if (mk && mkStop === S - 1) push('pick', S, 'back');
  for (let i = S - 1; i >= 0; i--) {
    const st = C.stops[i];
    push(st.type === 'p' ? 'both' : 'one', i, 'back');
    if (mk && mkStop === i - 1) push('pick', i, 'back');
  }
  push('exit', -1, 'back');
  // positions the hopper travels between, and the heading of each hop
  let prev = { x: C.start.x, z: C.start.z }, yaw = C.stops[0].yaw;
  for (const st of steps) {
    st.from = prev;
    const dx = st.pos.x - prev.x, dz = st.pos.z - prev.z;
    if (st.k !== 'pick' && Math.hypot(dx, dz) > 0.02) yaw = Math.atan2(dx, dz);
    st.yaw = yaw;
    if (st.k === 'sky') st.yaw = yaw;
    prev = st.pos;
  }
  return steps;
}

export function actionLabel(st) {
  if (st.k === 'one') return 'ONE foot';
  if (st.k === 'both' || st.k === 'sky' || st.k === 'exit') return 'TWO feet';
  if (st.k === 'open') return `${st.side === 'L' ? 'LEFT' : 'RIGHT'} foot`;
  return 'PICK UP';
}

export function createSim(cfg, rng) {
  const C = getCourse(cfg.course);
  const tm = TIMING[cfg.timing === 'relaxed' ? 'relaxed' : 'standard'];
  const mode = cfg.mode || 'match';
  const lessonCfg = cfg.lesson || null;
  const target = mode === 'practice' || mode === 'lesson' ? 0 : Math.min(C.N, cfg.target > 0 ? cfg.target : C.N);
  const players = (cfg.players || [{ human: true, level: 0, name: 'You' }, { human: false, level: 2, name: 'Computer' }]).map((p, i) => ({
    name: p.name || `P${i + 1}`, human: !!p.human, level: p.level | 0, done: 0, score: 0, streak: 0,
    stats: { perfect: 0, good: 0, ok: 0, fouls: 0, tossOk: 0, tossBad: 0, clean: 0, best: 0 },
  }));
  const r = rng;
  const s = {
    t: 0, tick: 0, phase: 'intro', phaseT: 0, over: false, winner: -1, mode, course: C.id, N: C.N, target,
    cur: 0, turnNo: 0, players, turn: null, events: [], evId: 0, hold: null, holdId: 0, lessonRes: null,
    lesson: lessonCfg ? { tries: 0, ok: 0, attempts: lessonCfg.attempts, need: lessonCfg.need } : null,
    finished: [false, false], cfg: { timing: cfg.timing === 'relaxed' ? 'relaxed' : 'standard', hold: !!cfg.hold, mode },
  };
  if (cfg.resume) {
    const q = cfg.resume;
    q.players.forEach((p, i) => { if (players[i]) Object.assign(players[i], { done: p.done, score: p.score, streak: p.streak || 0, stats: { ...players[i].stats, ...p.stats } }); });
    s.cur = q.cur | 0; s.turnNo = q.turnNo | 0; s.finished = q.finished ? [...q.finished] : [false, false];
  }
  const offset = (cfg.offset || 0) / 1000;
  const emit = (o) => { s.events.push({ id: s.evId++, t: s.t, ...o }); if (s.events.length > 60) s.events.shift(); };
  const P = () => players[s.cur];
  const isAI = () => !P().human;

  // ---- tempo: rises with the number being played ----------------------------------------------------------------------------------------
  const bpmFor = (n) => {
    if (cfg.bpm) return cfg.bpm;
    const f = C.N > 1 ? clamp((n - 1) / (C.N - 1), 0, 1) : 0;
    return Math.round(C.bpm + (C.bpmTo - C.bpm) * f);
  };

  // ---- a turn --------------------------------------------------------------------------------------------------------------------------
  function nextNumber() {
    if (mode === 'practice') return (P().done % C.N) + 1;
    if (mode === 'lesson') return lessonCfg.number || 1;
    return Math.min(C.N, P().done + 1);
  }
  function startTurn() {
    const n = nextNumber();
    const cell = C.cells[C.byNum[n]];
    const sk = P().human ? null : SKILL[clamp(P().level - 1, 0, SKILL.length - 1)];
    const form = 0.85 + r.next() * 0.45;                                    // the computer's good day / bad day
    const T = {
      id: s.turnNo, p: s.cur, n, cell: cell.id, stop: cell.stop, side: cell.side, bpm: bpmFor(n), beat: 60 / bpmFor(n),
      aim: { x: null, z: null, px: r.next(), pz: r.next(), sx: 0, sz: 0, tx: 0, tz: 0, curX: 0, curZ: 0, lockT: 0, plan: null },
      marker: { x: C.start.x, z: C.start.z, state: 'hand', t0: 0, t1: 0, fx: C.start.x, fz: C.start.z },
      toss: null, route: [], si: 0, tc: 0, t0: 0, beatIdx: 0, nextBeat: 0, lastFoot: '', legFoot: '', result: null, plan: [], pi: 0, sk, form,
      bias: (r.next() - 0.5) * 0.04, ai: !P().human,
    };
    const easy = mode === 'lesson' ? 0.7 : 1;
    const nn = Math.min(n, 10);
    T.aim.sx = (0.40 + 0.022 * (nn - 1) + (P().human ? 0 : 0)) * easy * (cfg.timing === 'relaxed' ? 0.82 : 1);
    T.aim.sz = (0.46 + 0.024 * (nn - 1)) * easy * (cfg.timing === 'relaxed' ? 0.82 : 1);
    s.turn = T;
    s.phase = 'intro'; s.phaseT = s.t;
    emit({ type: 'turnStart', p: s.cur, n });
  }

  function startAimX() {
    const T = s.turn;
    if (lessonCfg && lessonCfg.noMarker) {
      T.marker = { x: C.start.x, z: C.start.z, state: 'none', t0: s.t, t1: s.t, fx: C.start.x, fz: C.start.z };
      T.toss = { ok: true, reason: 'in', lx: 0, lz: 0, x: C.start.x, z: C.start.z, bull: false }; T.cell = -1; T.stop = -1; T.side = null;
      startCount(); return;
    }
    if (lessonCfg && lessonCfg.marker) {            // lessons that are about hopping: the tejo is already placed
      const c = C.cells[C.byNum[lessonCfg.marker]];
      T.marker = { x: c.x, z: c.z, state: 'ground', t0: s.t, t1: s.t, fx: c.x, fz: c.z };
      T.toss = { ok: true, reason: 'in', lx: 0, lz: 0, x: c.x, z: c.z, bull: false }; T.cell = c.id; T.stop = c.stop; T.side = c.side; T.n = c.num;
      startCount(); return;
    }
    s.phase = 'aimX'; s.phaseT = s.t; T.aim.tx = s.t;
    if (T.ai) planToss(T);
  }

  // The computer aims at the middle of the square with a skill-dependent error; its taps are found on the same sweeps a person uses.
  function planToss(T) {
    const sk = T.sk, sd = sk.toss * T.form * (1 + 0.012 * T.n);
    const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += r.next(); return (u - 3) * 1.4142; };
    const ex = gauss() * sd, ez = gauss() * sd;
    const find = (ph, sp, A, want, tmin) => {
      let best = tmin, bd = 9;
      for (let k = 0; k < 600; k++) { const tt = tmin + k / 120, d = Math.abs(A * tri(ph + (tt - tmin) * sp) - want); if (d < bd) { bd = d; best = tt; } if (d < 0.012) break; }
      return best;
    };
    const tminX = s.t + 0.5 + r.next() * 0.9;
    // the sweep position at time tt is tri(px + (tt - tx) * sx): shift the planning origin so the search starts at tminX
    const phX = T.aim.px + (tminX - T.aim.tx) * T.aim.sx;
    const tX = find(phX, T.aim.sx, AIM_RANGE.x, ex, tminX);
    T.aim.plan = { tX, ez, tZ: 0 };
  }

  function lockX(tt) {
    const T = s.turn, a = T.aim;
    a.x = AIM_RANGE.x * tri(a.px + (tt - a.tx) * a.sx);
    a.lockT = tt; s.phase = 'aimLock'; s.phaseT = s.t;
    emit({ type: 'lockX', p: s.cur, x: a.x });
  }
  function startAimZ() {
    const T = s.turn, a = T.aim;
    s.phase = 'aimZ'; s.phaseT = s.t; a.tz = s.t;
    if (T.ai) {
      const find = (ph, sp, A, want, tmin) => {
        let best = tmin, bd = 9;
        for (let k = 0; k < 600; k++) { const tt = tmin + k / 120, d = Math.abs(A * tri(ph + (tt - tmin) * sp) - want); if (d < bd) { bd = d; best = tt; } if (d < 0.012) break; }
        return best;
      };
      const tmin = s.t + 0.35 + r.next() * 0.6;
      const ph = a.pz + (tmin - a.tz) * a.sz;
      a.plan.tZ = find(ph, a.sz, AIM_RANGE.z, a.plan.ez, tmin);
    }
  }
  function lockZ(tt) {
    const T = s.turn, a = T.aim;
    a.z = AIM_RANGE.z * tri(a.pz + (tt - a.tz) * a.sz);
    emit({ type: 'lockZ', p: s.cur, z: a.z });
    throwTejo();
  }
  function throwTejo() {
    const T = s.turn, a = T.aim, cell = C.cells[T.cell];
    const wob = 0.010 + 0.0016 * T.n;
    const g = () => { let u = 0; for (let i = 0; i < 4; i++) u += r.next(); return (u - 2) * 0.9; };
    const lx = a.x + g() * wob, lz = a.z + g() * wob;
    const w = worldOf(cell, lx, lz);
    const res = judgeToss(C, T.cell, w.x, w.z);
    T.toss = { ...res, x: w.x, z: w.z, bull: res.ok && Math.abs(lx) < 0.05 && Math.abs(lz) < 0.05 };
    T.marker = { x: w.x, z: w.z, state: 'air', t0: s.t + 0.12, t1: s.t + 0.12 + TOSS_FLIGHT, fx: C.start.x, fz: C.start.z };
    s.phase = 'flight'; s.phaseT = s.t;
    emit({ type: 'throw', p: s.cur, x: w.x, z: w.z });
  }
  function landed() {
    const T = s.turn, pl = P();
    T.marker.state = 'ground';
    s.phase = 'landed'; s.phaseT = s.t;
    if (T.toss.ok) { pl.stats.tossOk++; pl.score += T.toss.bull ? POINTS.toss : Math.round(POINTS.toss * 0.4); }
    else pl.stats.tossBad++;
    emit({ type: 'land', p: s.cur, ok: T.toss.ok, reason: T.toss.reason, bull: T.toss.bull });
  }

  // ---- the hop run ----------------------------------------------------------------------------------------------------------------------
  // The route and the computer's plan are built as soon as the toss is good, so Watch & Learn can explain them during its hold;
  // when the hold is released every time moves forward by the time spent waiting.
  function buildRun(T) {
    T.route = buildRoute(C, T.cell >= 0 ? { cell: T.cell } : null);
    T.tc = s.t; T.t0 = s.t + COUNT_BEATS * T.beat;
    let tt = T.t0;
    for (const st of T.route) { st.t = tt; tt += st.span * T.beat; }
    if (T.ai) planHops(T);
    T.prepared = true;
  }
  function startCount() {
    const T = s.turn;
    if (!T.prepared) buildRun(T);
    else { const sh = s.t - T.tc; if (sh) { T.tc += sh; T.t0 += sh; for (const st of T.route) st.t += sh; if (T.plan) for (const pk of T.plan) pk.t += sh; } }
    T.prepared = false;
    T.nextBeat = s.t; T.beatIdx = 0; T.si = 0;
    s.phase = 'count'; s.phaseT = s.t;
    emit({ type: 'count', p: s.cur, bpm: T.bpm, steps: T.route.length });
  }

  // Computer hops: each tap lands near its beat with a skill-dependent spread, and now and then it slips (wrong button).
  function planHops(T) {
    const sk = T.sk, gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += r.next(); return (u - 3) * 1.4142; };
    const plan = [];
    let leg = '', last = '', prefer = r.next() < 0.5 ? 'L' : 'R';
    const ruleOf = C.rule;
    for (const st of T.route) {
      if (st.k === 'both' || st.k === 'sky' || st.k === 'exit' || st.k === 'pick') { leg = ''; last = ''; }
      let act;
      if (st.k === 'one') {
        if (ruleOf === 'same') { if (!leg) leg = prefer; act = leg; }
        else if (ruleOf === 'alternate') { act = last ? (last === 'L' ? 'R' : 'L') : prefer; }
        else { if (r.next() < 0.12) prefer = prefer === 'L' ? 'R' : 'L'; act = prefer; }
        last = act;
      } else if (st.k === 'open') { act = st.side; last = act; if (ruleOf === 'same' && !leg) leg = act; }
      else if (st.k === 'pick') act = 'P';
      else act = 'B';
      const hard = needsHard(st.k) ? sk.hard : 1;
      const sd = T.beat * sk.beat * T.form * hard * (1 + 0.004 * st.i);
      let d = T.bias + gauss() * sd;
      let skip = false;
      if (r.next() < sk.slip * hard) {
        const roll = r.next();
        if (roll < 0.45) skip = true;
        else if (st.k === 'one') act = 'B';
        else if (st.k === 'pick') act = r.next() < 0.5 ? 'L' : 'R';
        else if (st.k === 'open') act = st.side === 'L' ? 'R' : 'L';
        else act = r.next() < 0.5 ? 'L' : 'R';
      }
      if (!skip) plan.push({ t: st.t + d, act, i: st.i });
    }
    plan.sort((a, b) => a.t - b.t);
    T.plan = plan; T.pi = 0;
  }

  const GRADE_PTS = { perfect: POINTS.perfect, good: POINTS.good, ok: POINTS.ok };
  function foul(st, reason, d) {
    const T = s.turn, pl = P();
    st.state = 'foul'; st.reason = reason; st.d = d;
    T.result = { clean: false, reason, step: st.i };
    pl.stats.fouls++; pl.streak = 0;
    s.phase = 'foul'; s.phaseT = s.t;
    emit({ type: 'foul', p: s.cur, reason, step: st.i, k: st.k, d });
  }
  function expectAct(st) {
    if (st.k === 'one') return 'LR';
    if (st.k === 'open') return st.side;
    if (st.k === 'pick') return 'P';
    return 'B';
  }

  /** A hop tap by player p: act = 'L' | 'R' | 'B' (both feet) | 'P' (pick up). Returns what happened. */
  function tapHop(p, act) {
    if (p !== s.cur || (s.phase !== 'hop' && s.phase !== 'count')) return 'ignored';
    const T = s.turn, st = T.route[T.si];
    if (!st) return 'ignored';
    const tt = s.t - (T.ai ? 0 : offset), d = tt - st.t;
    if (d < -tm.early) return 'early';
    const want = expectAct(st);
    if (!want.includes(act)) { foul(st, st.k === 'pick' || act === 'P' ? 'pick' : 'wrong', d); return 'foul'; }
    if (Math.abs(d) > tm.ok) { foul(st, 'line', d); return 'foul'; }
    // the order of feet on the "same foot" / "alternate" courses
    if ((st.k === 'one') && (act === 'L' || act === 'R')) {
      if (C.rule === 'same' && T.legFoot && T.legFoot !== act) { foul(st, 'foot', d); return 'foul'; }
      if (C.rule === 'alternate' && T.lastFoot && T.lastFoot === act) { foul(st, 'foot', d); return 'foul'; }
    }
    const ad = Math.abs(d), grade = ad <= tm.perfect ? 'perfect' : ad <= tm.good ? 'good' : 'ok';
    st.state = 'done'; st.grade = grade; st.d = d; st.foot = act;
    const pl = P();
    pl.stats[grade]++;
    pl.score += Math.round(GRADE_PTS[grade] * (st.k === 'pick' ? 1.5 : 1));
    if (st.k === 'one' || st.k === 'open') {
      T.lastFoot = act; if (!T.legFoot) T.legFoot = act;
    } else { T.legFoot = ''; T.lastFoot = ''; }
    if (st.k === 'pick') { T.marker.state = 'held'; }
    emit({ type: 'hop', p: s.cur, step: st.i, k: st.k, grade, d, foot: act });
    T.si++;
    if (T.si >= T.route.length) clean();
    return grade;
  }
  function clean() {
    const T = s.turn, pl = P();
    T.result = { clean: true, reason: 'clean', step: T.route.length };
    pl.stats.clean++; pl.streak++; pl.stats.best = Math.max(pl.stats.best, pl.streak);
    pl.score += POINTS.clean;
    s.phase = 'clean'; s.phaseT = s.t;
    emit({ type: 'clean', p: s.cur, n: T.n });
  }

  function tapAim(p) {
    if (p !== s.cur) return false;
    const T = s.turn;
    if (s.phase === 'aimX') { lockX(s.t); return true; }
    if (s.phase === 'aimZ') { lockZ(s.t); return true; }
    void T;
    return false;
  }

  // ---- turn end, match end ------------------------------------------------------------------------------------------------------------------
  function endTurn() {
    const T = s.turn, pl = P(), ok = !!(T.result && T.result.clean);
    if (T.marker.state !== 'none') T.marker.state = ok ? 'none' : T.marker.state;
    if (mode === 'lesson') {
      s.lesson.tries++;
      const good = lessonCfg.tossOnly ? !!(T.toss && T.toss.ok) : ok;
      if (good) s.lesson.ok++;
      emit({ type: 'lessonTry', ok: good, tries: s.lesson.tries });
      if (s.lesson.tries >= s.lesson.attempts) {
        s.over = true; s.lessonRes = { ok: s.lesson.ok, n: s.lesson.attempts, pass: s.lesson.ok >= s.lesson.need };
        emit({ type: 'lessonEnd', ...s.lessonRes });
        return;
      }
      s.turnNo++; startTurn(); return;
    }
    if (ok) { pl.done++; if (target && pl.done >= target) s.finished[s.cur] = true; }
    emit({ type: 'turnEnd', p: s.cur, ok, n: T.n, done: pl.done });
    s.turnNo++;
    if (mode === 'practice') { startTurn(); return; }
    // equal turns: when the first player has finished, the second still gets the same number of turns
    const np = players.length;
    const next = (s.cur + 1) % np;
    const roundEnds = next === 0;
    if (s.finished.some(Boolean) && (np === 1 || roundEnds)) { matchEnd(); return; }
    s.cur = next;
    startTurn();
  }
  function matchEnd() {
    s.over = true; s.phase = 'over'; s.phaseT = s.t;
    const a = players[0], b = players[1];
    if (!b) s.winner = 0;
    else if (s.finished[0] && !s.finished[1]) s.winner = 0;
    else if (s.finished[1] && !s.finished[0]) s.winner = 1;
    else s.winner = a.score === b.score ? -1 : a.score > b.score ? 0 : 1;
    emit({ type: 'matchEnd', winner: s.winner });
  }

  // ---- watch & learn: the engine waits at two points of every turn --------------------------------------------------------------------------
  function holdAt(kind) {
    s.phase = 'hold'; s.phaseT = s.t; s.hold = { kind, id: ++s.holdId, turn: s.turn.id };
    emit({ type: 'hold', kind });
  }

  // ---- the clock ----------------------------------------------------------------------------------------------------------------------------
  function update(dt) {
    s.tick++;
    if (s.over) { s.t += dt; return; }
    s.t += dt;
    const T = s.turn;
    switch (s.phase) {
      case 'intro':
        if (s.t - s.phaseT >= T_INTRO) { if (s.cfg.hold && !lessonCfg) holdAt('aim'); else startAimX(); }
        break;
      case 'hold': break;
      case 'aimX':
        if (T.ai && T.aim.plan && s.t >= T.aim.plan.tX) lockX(T.aim.plan.tX);
        break;
      case 'aimLock':
        if (s.t - s.phaseT >= AIM_START_DELAY) startAimZ();
        break;
      case 'aimZ':
        if (T.ai && s.t >= T.aim.plan.tZ) lockZ(T.aim.plan.tZ);
        break;
      case 'flight':
        if (s.t >= T.marker.t1) landed();
        break;
      case 'landed':
        if (s.t - s.phaseT >= T_LANDED) {
          if (T.toss.ok && lessonCfg && lessonCfg.tossOnly) endTurn();
          else if (T.toss.ok) { if (s.cfg.hold && !lessonCfg) { buildRun(T); holdAt('hop'); } else startCount(); }
          else { T.result = { clean: false, reason: 'toss', step: -1 }; s.phase = 'tossEnd'; s.phaseT = s.t; emit({ type: 'tossEnd', p: s.cur }); }
        }
        break;
      case 'tossEnd':
        if (s.t - s.phaseT >= 0.9) endTurn();
        break;
      case 'count': case 'hop': {
        // the metronome
        while (T.nextBeat <= s.t + 1e-9 && T.route.length) {
          const lastT = T.route[T.route.length - 1].t + 0.2;
          if (T.nextBeat > lastT) break;
          emit({ type: 'beat', i: T.beatIdx, kind: T.beatIdx < COUNT_BEATS ? 'count' : 'play', bar: T.beatIdx % 4 });
          T.beatIdx++; T.nextBeat = T.tc + T.beatIdx * T.beat;
        }
        if (s.phase === 'count' && s.t >= T.t0 - 0.0001) s.phase = 'hop';
        // computer taps
        if (T.ai) while (T.pi < T.plan.length && T.plan[T.pi].t <= s.t && (s.phase === 'hop' || s.phase === 'count')) { const pk = T.plan[T.pi++]; tapHop(s.cur, pk.act); }
        // a beat that passes without a tap
        if (s.phase === 'hop' || s.phase === 'count') {
          const st = T.route[T.si];
          if (st && s.t - (T.ai ? 0 : offset) > st.t + tm.ok) foul(st, 'late', s.t - st.t);
        }
        break;
      }
      case 'foul':
        if (s.t - s.phaseT >= T_FOUL) endTurn();
        break;
      case 'clean':
        if (s.t - s.phaseT >= T_CLEAN) endTurn();
        break;
      default: break;
    }
  }

  // ---- watch & learn / hints ----------------------------------------------------------------------------------------------------------------------
  function release() {
    if (s.phase !== 'hold') return;
    const k = s.hold.kind;
    s.hold = null;
    if (k === 'aim') startAimX(); else startCount();
  }

  function snapshot() {
    return { cur: s.cur, turnNo: s.turnNo, finished: [...s.finished], players: players.map((p) => ({ done: p.done, score: p.score, streak: p.streak, stats: { ...p.stats } })) };
  }

  const api = {
    s, C, tm,
    update, tapAim, tapHop, release, snapshot,
    canAim: () => s.phase === 'aimX' || s.phase === 'aimZ',
    nextStep: () => (s.turn && s.turn.route[s.turn.si]) || null,
  };
  startTurn();
  return api;
}

/** Current reticle offsets (the sweep) in the target square's frame, for the HUD / scene. */
export function reticle(s) {
  const T = s.turn;
  if (!T) return null;
  const a = T.aim;
  const x = a.x !== null ? a.x : s.phase === 'aimX' ? AIM_RANGE.x * tri(a.px + (s.t - a.tx) * a.sx) : 0;
  let z = a.z !== null ? a.z : 0;
  if (s.phase === 'aimZ') z = AIM_RANGE.z * tri(a.pz + (s.t - a.tz) * a.sz);
  return { x, z, lockedX: a.x !== null, lockedZ: a.z !== null, active: s.phase === 'aimX' || s.phase === 'aimZ' || s.phase === 'aimLock' };
}
void AIR; void STEP;

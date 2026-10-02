// The match with a clock. rules.js decides what an exchange can do; this file runs a raid in time: where every player stands and
// moves, when the contact happens, when a decision is needed. It is the authority for positions and contact times: the 3D
// presenter only reads `scene.actors` and `scene.events` and fits its animation to them (it never writes back).
//
// World frame: x across the court (-5..5), z along it (-6.5..6.5). Team 0 defends the z < 0 half and raids toward +z; team 1 the
// other way. Raid-local (x, u) from rules.js maps to world with toWorld().
import {
  COURT, ACTIONS, RESPONSES, TOUCH_ACTIONS, BEAT_SECS, REACH, ACTION_NAME, RESPONSE_NAME,
  startRaid, defenderPositions, validTargets, nearestTarget, available, resolveBeat, endRaid, engaged, raiderDestination, raiderOf, defenderOf,
  formationSlots, newMatch, FORMATION_NAME,
} from './rules.js';
import { POSE_OF, TOUCH_DIST, RUN_PASS, HOLD_LEAD, HOLD_SIDE, BLOCK_SLOT, KEEP_APART } from './geometry.js';
import { makeBrain, suggestRaid, suggestResponse, explainRaid, explainResponse, explainFormation, formationScores, disguise, LEVELS } from './ai.js';

export const toWorld = (team, x, u) => (team === 0 ? { x: x - COURT.W / 2, z: u } : { x: COURT.W / 2 - x, z: -u });
export const toLocal = (team, wx, wz) => (team === 0 ? { x: wx + COURT.W / 2, u: wz } : { x: COURT.W / 2 - wx, u: -wz });
const yawOf = (dx, dz) => Math.atan2(dx, dz);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hyp = Math.hypot;

export const TIMING = { enter: 2.2, result: 2.8, swap: 0.45, approach: 0.95, lead: 0.55, afterTouch: 1.05, afterTackle: 2.2, afterEscape: 1.2 };
export const RESP_WINDOWS = [4.5, 3.2, 2.3];     // Relaxed, Normal, Quick

// Benches sit outside the right-hand sideline behind each team's end line.
const bench = (team, k) => ({ x: 6.1 + (k % 2) * 0.6, z: (team === 0 ? -1 : 1) * (4.2 + Math.floor(k / 2) * 0.8) });
const mateSpot = (team, k) => ({ x: -3.6 + (k % 7) * 1.2, z: (team === 0 ? -1 : 1) * 5.2 });

export function newScene(match, rng, ctl = {}) {
  const sc = {
    t: 0, phase: 'pre', phaseT: 0, match, ctl: { human: [false, false], levels: [0, 0], watch: false, respWin: 1, ...ctl }, raid: null, beat: null,
    actors: [], events: [], eid: 0, need: null, pre: null, input: {}, summary: null, banner: null, lastResult: null, clockRun: true, tap: null, thinking: 0,
    ring: null, recap: null, shotLog: [],
  };
  const hid = (k, v) => Object.defineProperty(sc, k, { value: v, enumerable: false, writable: true });
  hid('brains', [0, 1].map((t) => (sc.ctl.human[t] && !sc.ctl.watch ? null : makeBrain(sc.ctl.levels[t]))));
  match.teams.forEach((tm, team) => tm.players.forEach((p, idx) => {
    const a = { g: team * 7 + idx, team, idx, num: p.num, wx: 0, wz: 0, yaw: team === 0 ? 0 : Math.PI, speed: 0, role: 'mate', show: false, track: null, face: null, act: null, k: idx };
    sc.actors.push(a);
  }));
  placeAll(sc);
  hid('rngSim', rng.fork()); hid('rngAi', rng.fork()); hid('rngFx', rng.fork());
  return sc;
}
const actor = (sc, team, id) => sc.actors[team * 7 + id];
// Lessons make the first exchanges go the way the lesson shows: the draws resolveBeat makes are replaced by fixed values.
function rigRng(rig, action, resp) {
  const t = rig.touch ? 0.001 : 0.999, c = rig.catch ? 0.001 : 0.999;
  const seq = action === 'retreat' ? [c] : action === 'bonus' ? [c, t] : TOUCH_ACTIONS.includes(action) ? [t, c] : [c];
  return { next: () => (seq.length ? seq.shift() : 0.999) };
}
export const actorOf = actor;

function emit(sc, type, data = {}) { sc.events.push({ id: ++sc.eid, type, t: sc.t, ...data }); if (sc.events.length > 160) sc.events.splice(0, sc.events.length - 160); }

// Put everyone where the sides would stand between raids (used at the start and after loading a saved match).
export function placeAll(sc) {
  const m = sc.match;
  m.teams.forEach((tm, team) => {
    const onMat = tm.onMat.filter((id) => true);
    let k = 0, o = 0;
    tm.players.forEach((p, idx) => {
      const a = actor(sc, team, idx);
      a.track = null; a.speed = 0; a.act = null;
      if (tm.onMat.includes(idx)) { const sp = mateSpot(team, k++); a.wx = sp.x; a.wz = sp.z; a.role = 'mate'; a.show = false; a.yaw = team === 0 ? 0 : Math.PI; }
      else { const b = bench(team, o++); a.wx = b.x; a.wz = b.z; a.role = 'out'; a.show = false; a.yaw = -Math.PI / 2; }
    });
  });
}

// --- movement -------------------------------------------------------------------------------------------------------------
function moveTo(sc, a, to, secs, o = {}) {
  const dist = hyp(to.x - a.wx, to.z - a.wz);
  a.track = { t0: sc.t + (o.delay ?? 0), t1: sc.t + (o.delay ?? 0) + Math.max(0.05, secs), from: { x: a.wx, z: a.wz }, to: { x: to.x, z: to.z }, dist, ease: o.ease ?? 'mid' };
  a.faceMove = o.faceMove !== false;
}
const shape = (s, kind) => (kind === 'lin' ? s : kind === 'out' ? 1 - (1 - s) * (1 - s) : kind === 'in' ? s * s : 0.5 * s + 0.5 * (s * s * (3 - 2 * s)));
function advanceActors(sc, dt) {
  for (const a of sc.actors) {
    const tr = a.track;
    let v = 0;
    if (tr && sc.t >= tr.t0) {
      const s = clamp((sc.t - tr.t0) / (tr.t1 - tr.t0), 0, 1);
      const e = shape(s, tr.ease);
      const nx = tr.from.x + (tr.to.x - tr.from.x) * e, nz = tr.from.z + (tr.to.z - tr.from.z) * e;
      const mv = hyp(nx - a.wx, nz - a.wz);
      v = dt > 0 ? mv / dt : 0;
      if (a.faceMove && mv > 1e-4 && tr.dist > 0.35) a.yaw = yawOf(nx - a.wx, nz - a.wz);
      a.wx = nx; a.wz = nz;
      if (s >= 1) a.track = null;
    }
    a.speed = a.speed + (v - a.speed) * Math.min(1, dt * 12);
    if (!a.track && a.face) a.yaw = yawOf(a.face.x - a.wx, a.face.z - a.wz);
  }
}
const face = (a, wx, wz) => { a.face = { x: wx, z: wz }; };

// --- raid set-up ----------------------------------------------------------------------------------------------------------
export function beginPre(sc) {
  const m = sc.match;
  sc.phase = 'pre'; sc.phaseT = 0; sc.summary = null; sc.beat = null; sc.raid = null; sc.input = {};
  const rt = m.raiding, dt = 1 - rt;
  const rb = sc.brains[rt], db = sc.brains[dt];
  sc.pre = { team: rt, def: dt, raider: null, formation: null, rReady: false, dReady: false };
  // the AI sides choose now (the human sides get to change theirs before starting)
  sc.pre.raider = rb ? rb.pickRaider(m, sc.rngAi) : m.teams[rt].onMat[m.teams[rt].rot % m.teams[rt].onMat.length];
  sc.pre.formation = db ? db.pickFormation(m, sc.rngAi) : 'arc';
  const humanR = !!sc.ctl.human[rt] && !sc.ctl.watch, humanD = !!sc.ctl.human[dt] && !sc.ctl.watch;
  sc.pre.humanR = humanR; sc.pre.humanD = humanD;
  sc.need = { kind: 'pre', ai: !humanR && !humanD, humanR, humanD };
  if (!sc.ctl.watch && !humanR && !humanD) { /* AI against AI outside watch mode does not happen */ }
  layoutPre(sc);
  emit(sc, 'pre', { team: rt });
  // everyone drifts to where the previous raid left them: only the next raid's cast is shown from raidStart
}
// Everybody stands where the raid is about to start (the raider behind the midline, the defenders in the chosen formation).
export function layoutPre(sc) {
  const p = sc.pre; if (!p) return;
  const m = sc.match, rt = p.team, dt = p.def;
  const raid = startRaid(m, { raider: p.raider, formation: p.formation });
  const pos = defenderPositions(raid);
  for (const a of sc.actors) { a.show = false; a.track = null; a.act = null; a.face = null; a.speed = 0; }
  const R = actor(sc, rt, raid.raider);
  const rw = toWorld(rt, COURT.W / 2, -2.2);
  R.role = 'raider'; R.show = true; R.wx = rw.x; R.wz = rw.z; R.yaw = rt === 0 ? 0 : Math.PI;
  const dw = (id) => toWorld(rt, pos[id].x, pos[id].u);
  raid.defIds.forEach((id) => { const a = actor(sc, dt, id), w = dw(id); a.role = 'def'; a.show = true; a.wx = w.x; a.wz = w.z; face(a, rw.x, rw.z); a.yaw = yawOf(rw.x - w.x, rw.z - w.z); });
}
export function preSet(sc, what, value) {
  const p = sc.pre; if (!p) return;
  const m = sc.match;
  if (what === 'raider' && m.teams[p.team].onMat.includes(value)) p.raider = value;
  if (what === 'formation') p.formation = value;
  layoutPre(sc);
}
export function preStart(sc) {
  if (sc.phase !== 'pre') return;
  const p = sc.pre, m = sc.match;
  const raid = startRaid(m, { raider: p.raider, formation: p.formation });
  sc.raid = raid; sc.need = null;
  sc.phase = 'enter'; sc.phaseT = 0;
  // the cast was laid out by layoutPre: the defenders hold their formation, the raider walks to the midline
  const rt = raid.team, dt = raid.def;
  const R = actor(sc, rt, raid.raider);
  const mid = toWorld(rt, COURT.W / 2, 0.0);
  moveTo(sc, R, mid, TIMING.enter - 0.3, { ease: 'mid' });
  raid.defIds.forEach((id) => face(actor(sc, dt, id), mid.x, mid.z));
  sc.fa = null;
  emit(sc, 'raidStart', { team: rt, def: dt, raider: raid.raider, form: raid.form, defIds: [...raid.defIds], dod: raid.dod, mat: raid.defIds.length });
}

// --- the decision and the exchange -----------------------------------------------------------------------------------------
const raiderAI = (sc) => sc.brains[sc.raid.team];
const defAI = (sc) => sc.brains[sc.raid.def];

function enterDecide(sc) {
  const raid = sc.raid;
  sc.phase = 'decide'; sc.phaseT = 0; raid.cant = 1;
  const humanRaid = !raiderAI(sc) || sc.ctl.watch;
  const R = actor(sc, raid.team, raid.raider);
  R.face = null;
  sc.thinkLeft = null;
  const pos = defenderPositions(raid);
  raid.defIds.forEach((id) => face(actor(sc, raid.def, id), R.wx, R.wz));
  if (raiderAI(sc) && !sc.ctl.watch) { sc.thinkLeft = LEVELS[sc.ctl.levels[raid.team]].think * (0.6 + sc.rngAi.next() * 0.6); sc.need = null; }
  else {
    const watch = sc.ctl.watch;
    sc.need = { kind: 'action', ai: watch, side: raid.team };
    if (watch) { const p = raiderAI(sc).chooseAction(sc.match, raid, sc.rngAi); sc.need.pick = p.action === 'timeout' ? { action: 'retreat', target: null } : p; sc.need.why = explainRaid(sc.match, raid, { ...sc.need.pick, pos }); }
  }
}

export function submitAction(sc, action, target = null) {
  if (sc.phase !== 'decide' || !sc.need || sc.need.kind !== 'action') return false;
  const raid = sc.raid, av = available(raid);
  if (!ACTIONS.includes(action) || av[action]) return false;
  let tgt = target;
  if (TOUCH_ACTIONS.includes(action)) { if (tgt == null || !validTargets(raid).includes(tgt)) tgt = nearestTarget(raid); if (tgt == null) return false; }
  else if (action === 'feintL' || action === 'feintR') { tgt = target != null && validTargets(raid).includes(target) ? target : nearestTarget(raid); }
  else tgt = null;
  sc.need = null;
  commit(sc, action, tgt);
  return true;
}

function commit(sc, action, tgt) {
  const raid = sc.raid, m = sc.match, rt = raid.team, dt = raid.def;
  const pos = defenderPositions(raid);
  raid.cant = 1;
  const R = actor(sc, rt, raid.raider);
  const dest = raiderDestination(raid, action, tgt, pos);
  const seen = action === 'feintL' || action === 'feintR' ? disguise({ action, target: tgt }, raid, sc.rngSim) : { action, target: tgt };
  const dApp = clamp(hyp(dest.x - raid.P.x, dest.u - raid.P.u) / 3.4, 0.7, 1.3);
  const beat = {
    n: raid.beat + 1, action, target: tgt, seen, dest, t0: sc.t, tApp: sc.t + dApp, tResp: null, tc: null, resp: null, respBy: null, res: null,
    from: { ...raid.P }, pos, engaged: [], qR: null, qD: null, respLeft: null, tap: null, dApp,
  };
  sc.beat = beat; sc.phase = 'commit'; sc.phaseT = 0;
  // the raider approaches to a point just short of the contact spot and probes
  const pre = { x: raid.P.x + (dest.x - raid.P.x) * 0.72, u: raid.P.u + (dest.u - raid.P.u) * 0.72 };
  const w = toWorld(rt, pre.x, pre.u);
  if (action === 'retreat') moveTo(sc, R, toWorld(rt, raid.P.x + (dest.x - raid.P.x) * 0.5, raid.P.u * 0.45), dApp, { ease: 'out' });
  else moveTo(sc, R, w, dApp, { ease: 'out' });
  // facing for the contact: the raider looks at his target, the defenders look at the raider
  if (tgt != null) { const d = actor(sc, dt, tgt); face(R, d.wx, d.wz); } else face(R, ...Object.values(toWorld(rt, COURT.W / 2, 6)).slice(0, 2));
  R.act = { kind: 'approach', action, t0: sc.t, dur: dApp };
  emit(sc, 'commit', { team: rt, raider: raid.raider, action, seen: seen.action, target: tgt, seenTarget: seen.target, tApp: beat.tApp, dest, n: beat.n, from: { ...raid.P }, shownTarget: seen.target });
  // who answers
  const humanD = !defAI(sc) || sc.ctl.watch;
  if (humanD) {
    beat.respLeft = RESP_WINDOWS[sc.ctl.respWin ?? 1];
    sc.need = { kind: 'response', ai: !!sc.ctl.watch, side: dt, tele: { action: seen.action, target: seen.target } };
    if (sc.ctl.watch) {
      const pick = defAI(sc).chooseResponse(m, raid, { action, target: tgt }, pos, sc.rngAi);
      sc.need.pick = pick; sc.need.why = explainResponse(m, raid, { action: seen.action, target: seen.target }, { resp: pick, pos });
    }
  } else {
    beat.aiRespAt = sc.t + 0.35 + sc.rngAi.next() * 0.4;
  }
}

export function submitResponse(sc, resp, auto = false) {
  const b = sc.beat;
  if (sc.phase !== 'commit' || !b || b.resp || !RESPONSES.includes(resp)) return false;
  b.resp = resp; b.respBy = auto ? 'auto' : 'player'; b.tResp = Math.max(sc.t, b.tApp - 0.0);
  sc.need = null;
  b.tc = Math.max(b.tApp, sc.t) + TIMING.lead;
  planContact(sc);
  return true;
}

// Where everyone goes for the contact (positions are raid-local, owned here; the presenter reads them from actors).
const sub = (a, b) => ({ x: a.x - b.x, u: a.u - b.u });
const norm = (v) => { const l = Math.hypot(v.x, v.u) || 1; return { x: v.x / l, u: v.u / l }; };
// keep a raider who is not touching anybody apart from the defenders (they lunge, he must not stand inside them)
function separate(dest, pos, ids) {
  const d = { ...dest };
  for (let k = 0; k < 3; k++) for (const id of ids) {
    const p = pos[id], dx = d.x - p.x, du = d.u - p.u, dist = Math.hypot(dx, du);
    if (dist < KEEP_APART) {
      const need = Math.sqrt(Math.max(0, KEEP_APART * KEEP_APART - du * du));       // slide sideways first: a feint or a step must not push him back across a line
      d.x = p.x + (dx >= 0 ? 1 : -1) * Math.max(need, Math.abs(dx));
      d.x = clamp(d.x, 1.3, 8.7);
    }
  }
  return d;
}
function planContact(sc) {
  const raid = sc.raid, b = sc.beat, rt = raid.team, dt = raid.def;
  const R = actor(sc, rt, raid.raider);
  const pos = b.pos;
  const act = b.action, resp = b.resp, pose = POSE_OF[resp];
  b.engaged = [];
  const secs = b.tc - sc.t;
  const tgt = b.target;
  // where the raider ends up for this contact, and who is engaged
  let dest = b.dest, after = null;
  if ((act === 'hand' || act === 'toe') && tgt != null) {
    const dir = norm(sub(pos[tgt], raid.P)), dist = TOUCH_DIST[act][pose];
    dest = { x: pos[tgt].x - dir.x * dist, u: pos[tgt].u - dir.u * dist };
  } else if (act === 'run' && tgt != null) {
    const dir = norm(sub(pos[tgt], raid.P)), left = { x: dir.u, u: -dir.x };
    dest = { x: pos[tgt].x + left.x * RUN_PASS.lateral + dir.x * RUN_PASS.along[pose], u: pos[tgt].u + left.u * RUN_PASS.lateral + dir.u * RUN_PASS.along[pose] };
    after = { x: dest.x + dir.x * RUN_PASS.onward, u: dest.u + dir.u * RUN_PASS.onward };
  } else if (act !== 'retreat') dest = separate(b.dest, pos, raid.defIds);
  dest = { x: clamp(dest.x, 1.2, 8.8), u: clamp(dest.u, 0.1, 6.2) };
  b.dest = dest; b.after = after;
  if (act !== 'retreat') moveTo(sc, R, toWorld(rt, dest.x, dest.u), secs, { ease: act === 'run' ? 'lin' : 'mid', faceMove: false });
  const at = act === 'retreat' ? { x: raid.P.x, u: raid.P.u * 0.5 } : dest;
  const near = engaged(raid, pos, at);
  const lead = tgt != null ? tgt : near[0];
  const helpers = near.filter((id) => id !== lead).slice(0, 2);
  const R0 = toWorld(rt, at.x, at.u);
  b.engaged = lead != null ? [lead, ...helpers] : [];
  b.slots = {};
  // the engaged defenders keep their places until the hold (they only lean and reach); everyone faces the contact
  raid.defIds.forEach((id) => face(actor(sc, dt, id), R0.x, R0.z));
  sc.phase = 'contact'; sc.phaseT = 0;
  R.act = { kind: act, action: act, t0: sc.t, tc: b.tc, resp, tgt };
  emit(sc, 'respond', { resp, by: b.respBy, tc: b.tc, engaged: [...b.engaged], lead, action: act, target: tgt, slots: b.slots, from: { ...b.from }, dest, after, n: b.n, pose });
  sc.ring = { t0: sc.t, tc: b.tc };
}

export function tapTiming(sc) {
  const b = sc.beat;
  if (!b || sc.phase !== 'contact' || b.tap !== null || sc.ctl.twoHumans) return false;
  b.tap = sc.t;
  return true;
}

function timingQuality(sc, humanSide, b) {
  if (!humanSide) return null;
  if (b.tap === null) return 0.35;
  const err = Math.abs(b.tap - b.tc);
  return clamp(1 - err / 0.32, 0, 1);
}

function contact(sc) {
  const raid = sc.raid, b = sc.beat, m = sc.match, rt = raid.team, dt = raid.def;
  const rb = raiderAI(sc), db = defAI(sc);
  const humanR = !rb && !sc.ctl.watch, humanD = !db && !sc.ctl.watch;
  const two = humanR && humanD;
  const qR = two ? 0.5 : humanR ? timingQuality(sc, true, b) : (rb ?? makeBrain(0)).timing(sc.rngAi);
  const qD = two ? 0.5 : humanD ? (b.respBy === 'auto' ? 0.25 : timingQuality(sc, true, b)) : (db ?? makeBrain(0)).timing(sc.rngAi);
  b.qR = qR; b.qD = qD;
  const res = resolveBeat(m, raid, b.action, b.target, b.resp, qR, qD, sc.ctl.rig ? rigRng(sc.ctl.rig, b.action, b.resp) : sc.rngSim);
  b.res = res;
  const R = actor(sc, rt, raid.raider);
  const pos2 = defenderPositions(raid);
  const lead = b.engaged[0] ?? null;
  const joiners = b.resp === 'chain' ? b.engaged : b.resp === 'block' ? b.engaged.slice(0, 2) : b.engaged.slice(0, 1);
  const out = { joiners: [...joiners], n: b.n, action: b.action, target: b.target, resp: b.resp, lead, engaged: [...b.engaged], touched: [...res.touched], caught: res.caught, escaped: res.escaped, bonusGot: res.bonusGot, off: [...res.off], chainBroke: res.chainBroke, dashOut: res.dashOut, pTouch: res.pTouch, pCatch: res.pCatch, qR, qD, slots: b.slots, dest: b.dest, tc: b.tc, from: b.from };
  b.out = out;
  sc.lastResult = out;
  emit(sc, 'contact', out);
  sc.thinkLeft = null;
  if (res.caught) {
    // the hold: the defenders close in on the raider and he is stopped (readable key poses; the presenter cuts and slows)
    sc.phase = 'after'; sc.phaseT = 0; sc.afterT = TIMING.afterTackle; sc.afterKind = 'tackle';
    const at = b.dest, R0 = toWorld(rt, at.x, at.u);
    joiners.forEach((id, i) => {
      const a = actor(sc, dt, id);
      const sl = holdSlot(b.resp, i, joiners.length);
      const p = holdPoint(rt, R0, a, sl);
      moveTo(sc, a, p, 0.45, { ease: 'out', faceMove: false });
      face(a, R0.x, R0.z);
    });
    R.track = null; R.face = null;
    moveTo(sc, R, { x: R.wx + (toWorld(rt, 0, -1).z - toWorld(rt, 0, 0).z) * 0.0, z: R.wz }, 0.1, { faceMove: false });
    R.act = { kind: 'held', t0: sc.t, dur: sc.afterT, resp: b.resp };
  } else if (res.escaped) {
    sc.phase = 'after'; sc.phaseT = 0; sc.afterT = TIMING.afterEscape; sc.afterKind = 'escape';
    const home = toWorld(rt, clamp(raid.P.x, 1.5, 8.5), -1.6);
    R.track = null;
    moveTo(sc, R, home, TIMING.afterEscape, { ease: 'out' });
    raid.P = { x: raid.P.x, u: 0 };
    R.act = { kind: 'escape', t0: sc.t, dur: TIMING.afterEscape };
  } else {
    sc.phase = 'after'; sc.phaseT = 0; sc.afterT = TIMING.afterTouch; sc.afterKind = 'continue';
    // recoil: the raider steps back from the contact point; the chain closes a little
    const dest = b.dest;
    let back = { x: dest.x, u: dest.u };
    if (b.action !== 'step' && b.action !== 'feintL' && b.action !== 'feintR' && b.action !== 'bonus') {
      const d = lead != null ? pos2[lead] : null;
      if (d) { const dx = dest.x - d.x, du = dest.u - d.u, l = hyp(dx, du) || 1; back = { x: dest.x + (dx / l) * 0.35, u: dest.u + (du / l) * 0.35 }; }
    }
    if (b.action === 'run' && b.after) back = { x: clamp(b.after.x, 1.2, 8.8), u: clamp(b.after.u, 0.2, 6.2) };
    raid.P = { x: clamp(back.x, 1.2, 8.8), u: Math.max(0.2, back.u) };
    moveTo(sc, R, toWorld(rt, raid.P.x, raid.P.u), b.action === 'run' ? 0.7 : TIMING.afterTouch * 0.8, { ease: b.action === 'run' ? 'lin' : 'out', faceMove: b.action === 'run' });
    const np = defenderPositions(raid);
    raid.defIds.forEach((id) => {
      const a = actor(sc, dt, id);
      const to = toWorld(rt, np[id].x, np[id].u);
      moveTo(sc, a, to, TIMING.afterTouch, { ease: 'mid', faceMove: false });
      face(a, toWorld(rt, raid.P.x, raid.P.u).x, toWorld(rt, raid.P.x, raid.P.u).z);
    });
    R.act = { kind: 'recoil', t0: sc.t, dur: TIMING.afterTouch, touched: res.touched.length > 0 };
  }
}
// Where each defender stands once the hold is on, relative to the raider (f toward the defenders, l to the raider's left).
export function holdSlot(resp, i, n = 1) {
  if (resp === 'block') return n > 1 ? { f: BLOCK_SLOT.f, l: i === 0 ? BLOCK_SLOT.l : -BLOCK_SLOT.l } : { f: BLOCK_SLOT.f + 0.1, l: 0 };
  if (i === 0) return { f: HOLD_LEAD[resp] ?? 0.88, l: 0 };
  return { f: HOLD_SIDE.f, l: i === 1 ? HOLD_SIDE.l : -HOLD_SIDE.l };
}
function holdPoint(rt, R0, a, sl) {
  // forward is the raid direction in world (+z for team 0, -z for team 1); left of a raider facing forward is +x for team 0
  const dir = rt === 0 ? 1 : -1;
  return { x: R0.x + sl.l * dir, z: R0.z + sl.f * dir };
}

// --- the raid's end ---------------------------------------------------------------------------------------------------------------
function finish(sc, how) {
  const raid = sc.raid, m = sc.match;
  raid.ended = how;
  const sum = endRaid(m, raid, how);
  sc.summary = sum;
  sc.phase = 'result'; sc.phaseT = 0; sc.need = null; sc.beat = sc.beat;
  const rt = raid.team, dt = raid.def;
  const R = actor(sc, rt, raid.raider);
  // everyone walks to where the next raid expects them: the touched go to the bench, the revived come on
  let o = 0;
  const benchIds = (team) => m.teams[team].outQ;
  sc.actors.forEach((a) => { a.act = null; });
  for (const id of sum.defOut) { const a = actor(sc, dt, id); const k = m.teams[dt].outQ.indexOf(id); moveTo(sc, a, bench(dt, Math.max(0, k)), 1.8, { ease: 'mid' }); a.role = 'out'; a.act = { kind: 'outWalk' }; }
  if (sum.raiderOut) { const k = m.teams[rt].outQ.indexOf(raid.raider); moveTo(sc, R, bench(rt, Math.max(0, k)), 2.0, { ease: 'mid', delay: 0.5 }); R.role = 'out'; R.act = { kind: 'outWalk' }; }
  else { R.role = 'mate'; moveTo(sc, R, mateSpot(rt, 0), 1.8, { ease: 'mid' }); }
  const revive = [...sum.revive.raiders.map((id) => [rt, id]), ...sum.revive.defenders.map((id) => [dt, id])];
  revive.forEach(([team, id], i) => {
    const a = actor(sc, team, id);
    a.show = true; a.role = 'revive';
    const b0 = bench(team, 0);
    a.wx = b0.x; a.wz = b0.z; a.yaw = Math.PI / 2 * -1;
    moveTo(sc, a, { x: team === dt ? mateSpot(team, i).x : mateSpot(team, i).x, z: mateSpot(team, i).z }, 1.9, { ease: 'mid', delay: 0.7 + 0.2 * i });
    a.act = { kind: 'reenter' };
  });
  for (const t of sum.allOut) m.teams[t].players.forEach((p, idx) => { const a = actor(sc, t, idx); if (!a.show) { a.show = true; } });
  const total = [...sum.points];
  sc.banner = { text: sum.label, sub: sum.how === 'safe' && !sum.empty ? `${sum.touches + sum.bonus} point${sum.touches + sum.bonus === 1 ? '' : 's'} for ${rt === 0 ? 'Blue' : 'Red'}` : sum.defPts ? `${sum.defPts} point${sum.defPts > 1 ? 's' : ''} for ${dt === 0 ? 'Blue' : 'Red'}` : '', t: 0, team: sum.defPts ? dt : rt, kind: sum.superRaid ? 'super' : sum.superTackle ? 'super' : sum.how };
  emit(sc, 'raidEnd', { how, summary: { ...sum, revive: { ...sum.revive }, defOut: [...sum.defOut], allOut: [...sum.allOut] }, team: rt, def: dt, raider: raid.raider, score: [...m.score] });
  for (const id of sum.defOut) emit(sc, 'out', { team: dt, id });
  if (sum.raiderOut) emit(sc, 'out', { team: rt, id: raid.raider });
  for (const [team, id] of revive) emit(sc, 'revive', { team, id });
  sc.recap = { n: m.raids, team: rt, how, label: sum.label, score: [...m.score], touches: sum.touches, bonus: sum.bonus };
  if (sum.allOut.length) emit(sc, 'allOut', { teams: [...sum.allOut] });
}

// --- stepping ------------------------------------------------------------------------------------------------------------------------
export function step(sc, dt) {
  sc.t += dt; sc.phaseT += dt;
  advanceActors(sc, dt);
  if (sc.banner) sc.banner.t += dt;
  const raid = sc.raid;
  switch (sc.phase) {
    case 'pre': break;
    case 'enter':
      if (sc.phaseT >= TIMING.enter) enterDecide(sc);
      break;
    case 'decide': {
      raid.clock -= dt; raid.cant -= dt / COURT.CANT_SECS;
      if (sc.need && sc.need.ai && sc.ctl.watch) { raid.clock += dt; raid.cant += dt / COURT.CANT_SECS; }   // Watch & Learn thinks off the clock
      if (sc.thinkLeft !== null) {
        sc.thinkLeft -= dt;
        if (sc.thinkLeft <= 0) {
          const p = sc.ctl.script && sc.ctl.script.length ? sc.ctl.script.shift() : raiderAI(sc).chooseAction(sc.match, raid, sc.rngAi);
          if (p.target === 'nearest') p.target = nearestTarget(raid);
          sc.thinkLeft = null;
          if (p.action === 'timeout') { finish(sc, 'time'); break; }
          sc.need = { kind: 'action', ai: false, side: raid.team };
          if (!submitAction(sc, p.action, p.target)) submitAction(sc, 'retreat', null) || finish(sc, 'time');
        }
      } else if (raid.cant <= 0) { raid.cant = 0; finish(sc, 'cant'); }
      else if (raid.clock <= 0) { raid.clock = 0; finish(sc, 'time'); }
      break;
    }
    case 'commit': {
      const b = sc.beat;
      const watchWait = sc.need && sc.need.ai && sc.ctl.watch;
      if (!watchWait) raid.clock -= dt;
      if (b.aiRespAt !== undefined && !b.resp && sc.t >= b.aiRespAt) {
        const db = defAI(sc);
        const resp = db.chooseResponse(sc.match, raid, { action: b.action, target: b.target }, b.pos, sc.rngAi);
        submitResponse(sc, resp);
      } else if (b.respLeft !== null && !b.resp && !watchWait) {
        b.respLeft -= dt;
        if (b.respLeft <= 0) submitResponse(sc, 'thigh', true);
      }
      if (raid.clock <= 0 && !b.resp) { raid.clock = 0; finish(sc, 'time'); }
      break;
    }
    case 'contact':
      raid.clock -= dt;
      if (sc.t >= sc.beat.tc) contact(sc);
      break;
    case 'after': {
      if (sc.afterKind === 'continue') raid.clock -= dt;
      if (sc.phaseT >= sc.afterT) {
        const k = sc.afterKind;
        if (k === 'tackle') finish(sc, 'caught');
        else if (k === 'escape') finish(sc, 'safe');
        else if (raid.clock <= 0) { raid.clock = 0; finish(sc, 'time'); }
        else enterDecide(sc);
      }
      break;
    }
    case 'result':
      if (sc.phaseT >= TIMING.result) {
        const m = sc.match;
        if (m.over) { sc.phase = 'over'; sc.need = null; emit(sc, 'matchEnd', { winner: m.over.winner }); }
        else { if (sc.summary && sc.summary.halfEnd) { sc.phase = 'half'; sc.phaseT = 0; emit(sc, 'halfEnd', {}); } else { emit(sc, 'swap', {}); placeAll(sc); beginPre(sc); } }
      }
      break;
    case 'half':
      if (sc.phaseT >= 2.6) { emit(sc, 'swap', {}); placeAll(sc); beginPre(sc); }
      break;
    default: break;
  }
}

// Short, plain facts for the HUD / hints. Everything is derived from the scene so it stays in step with the sim.
export const phaseLive = (sc) => sc.phase === 'decide' || sc.phase === 'commit' || sc.phase === 'contact' || sc.phase === 'after';

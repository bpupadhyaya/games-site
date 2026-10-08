// The match engine: teams, ends, turns, wind, the draw, the arrow, scoring and the computer's archers. Pure and deterministic (its own seeded generator lives in E.seed,
// so the whole match is plain JSON and can be saved). The 3D presenter only reads it.
import { RANGE, BOARD, NEAR, POINTS, ARROWS_PER_TURN, TEAM_SIZE, MATCH_TARGETS, V0, DRAW_T, SWAY_A, BREATH_T, BREATH_CALM, SPEED_JITTER, NOCK_NOISE, LEVELS, COACH, VALLEYS, NAMES_M, NAMES_F, LESSONS } from './consts.js';
import { stepArrow, launch, solveAim, impact, boardZ, standZ, rightX, standX, originOf, NO_WIND } from './ballistics.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
export const T = { endintro: 1.7, nock: 0.5, swap: 1.4, result: 2.2, resultMiss: 1.5, dance: 5.2, walk: 3.4, endAuto: 6 };
export const AIM_EASE = 0.95;

// ---- the generator -------------------------------------------------------------------------------------------------------------------------------------------
export function rnd(E) { let t = (E.seed = (E.seed + 0x6d2b79f5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
export function gauss(E) { const u = Math.max(1e-9, rnd(E)), v = rnd(E); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
const between = (E, a, b) => a + (b - a) * rnd(E);

// ---- wind --------------------------------------------------------------------------------------------------------------------------------------------------------
export function windAt(E, t) {
  if (E.cfg.perfect) return { x: 0, z: 0, s: 0, phi: 0 };
  const w = E.wind, g = 1 + 0.16 * Math.sin((TAU * t) / 7.3 + w.p[0]) + 0.09 * Math.sin((TAU * t) / 3.1 + w.p[1]);
  const s = Math.max(0, w.s * g * (w.calm ? 0 : 1)), phi = w.phi + 0.16 * Math.sin((TAU * t) / 11 + w.p[2]);
  return { x: Math.sin(phi) * s, z: Math.cos(phi) * s, s, phi };
}
// the wind as a shooter sees it: metres per second towards his right (cross) and towards the board (along); the compass word for the HUD
export function windRel(E, dir, t = E.t) {
  const w = windAt(E, t), cross = w.x * rightX(dir), along = w.z * dir;
  return { s: w.s, cross, along };
}
export function windWords(r) {
  if (r.s < 0.4) return 'Calm';
  const parts = [];
  if (Math.abs(r.cross) > 0.35) parts.push(`from your ${r.cross > 0 ? 'left' : 'right'}`);
  if (Math.abs(r.along) > 0.35) parts.push(r.along > 0 ? 'behind you' : 'in your face');
  return `${r.s.toFixed(1)} m/s ${parts.join(' and ') || 'light'}`;
}
function newWind(E, fresh) {
  if (E.lessonWind) { const [s, deg] = E.lessonWind; E.wind = { s, phi: (deg * Math.PI) / 180, p: [1.1, 2.3, 0.4], calm: s === 0 }; return; }
  if (fresh || !E.wind) {
    E.wind = { s: clamp(Math.abs(gauss(E)) * 2.6 + 0.4, 0, 7.5), phi: rnd(E) * TAU, p: [rnd(E) * TAU, rnd(E) * TAU, rnd(E) * TAU], calm: false };
  } else {
    E.wind.s = clamp(E.wind.s + gauss(E) * 0.8, 0, 7.5); E.wind.phi += gauss(E) * 0.4;
  }
}

// ---- teams ---------------------------------------------------------------------------------------------------------------------------------------------------------
function makeTeam(E, valley, gender) {
  const V = VALLEYS[valley % VALLEYS.length], used = new Set();
  const members = [];
  for (let i = 0; i < TEAM_SIZE; i++) {
    const g = gender === 'men' ? 'm' : gender === 'women' ? 'f' : (i + valley) % 2 === 0 ? 'm' : 'f';
    const list = g === 'm' ? NAMES_M : NAMES_F;
    let n; do { n = list[Math.floor(rnd(E) * list.length)]; } while (used.has(n));
    used.add(n);
    members.push({ name: n, g, look: Math.floor(rnd(E) * 7) });
  }
  return { valley, name: V.name, top: V.top, trim: V.trim, members, pts: 0, endPts: 0, st: { arrows: 0, hits: 0, karay: 0, near: 0, best: 0, streak: 0 } };
}

export function createMatch(seedInt, cfg) {
  const E = { seed: seedInt | 0, cfg: { mode: 'match', target: 0, level: 0, help: 0, valley: 0, opp: 1, gender: 'mixed', first: 0, levels: [0, 0], lesson: -1, practiceWind: -1, ...cfg }, t: 0, pt: 0, phase: 'endintro', evId: 0, events: [], end: -1, dir: 1, turn: 0, arrowNo: 0, order: [], cur: null, aim: { u: 0, h: 0.55 }, zoom: 2, draw: null, arrow: null, stuck: [], last: null, ai: null, plan: null, go: false, endRes: null, log: [], over: null, danceT: 0, lesson: null, wind: null, shots: 0, ff: 1 };
  const c = E.cfg;
  E.teams = [makeTeam(E, c.valley, c.gender), makeTeam(E, c.opp, c.gender)];
  if (c.mode === 'practice' || c.mode === 'lesson') E.teams = [E.teams[0]];
  if (c.mode === 'lesson') { const L = LESSONS[c.lesson]; E.lesson = { def: L, left: L.arrows, pts: 0, done: false, pass: false }; E.lessonWind = L.wind; c.help = L.help; }
  if (c.mode === 'practice' && c.practiceWind >= 0) E.lessonWind = [c.practiceWind, 70];
  startEnd(E);
  return E;
}
export const targetPts = (E) => MATCH_TARGETS[E.cfg.target];
export const isHuman = (E, team) => E.cfg.mode !== 'watch' && team === 0;
export const levelOf = (E, team) => (E.cfg.mode === 'watch' ? (E.cfg.levels[team] < 0 ? COACH : LEVELS[E.cfg.levels[team]]) : team === 1 ? LEVELS[E.cfg.level] : COACH);

function ev(E, type, o = {}) { E.events.push({ id: ++E.evId, type, t: E.t, ...o }); if (E.events.length > 60) E.events.splice(0, E.events.length - 60); }

function startEnd(E) {
  E.end++; E.dir = E.end % 2 === 0 ? 1 : -1; E.turn = 0; E.arrowNo = 0; E.stuck = []; E.endRes = null;
  for (const tm of E.teams) tm.endPts = 0;
  const solo = E.teams.length === 1;
  const first = solo ? 0 : (E.cfg.first + E.end) % 2;
  E.order = [];
  for (let i = 0; i < TEAM_SIZE; i++) { if (solo) { E.order.push({ team: 0, m: i }); break; } E.order.push({ team: first, m: i }, { team: 1 - first, m: i }); }
  newWind(E, E.end === 0 || E.cfg.mode === 'match' || E.cfg.mode === 'watch');
  E.cur = E.order[0]; E.phase = E.cfg.mode === 'practice' || E.cfg.mode === 'lesson' ? 'nock' : 'endintro'; E.pt = 0;
  E.snap = null;
  ev(E, 'end', { end: E.end, dir: E.dir });
  if (E.phase === 'nock') E.pt = 0;
}
function startTurn(E) {
  E.cur = E.order[E.turn]; E.arrowNo = 0;
  if (E.turn > 0 && E.cfg.mode !== 'practice') newWind(E, false);
  beginAim(E);
}
function beginAim(E) {
  E.phase = 'aim'; E.pt = 0; E.draw = null; E.go = false; E.plan = null; E.ai = null;
  E.aim = { u: E.aim.u, h: E.aim.h };
  if (!isHuman(E, E.cur.team)) { E.plan = makePlan(E); E.ai = { t: 0, from: { u: E.aim.u, h: E.aim.h } }; }
  else if (E.arrowNo === 0 && E.teams.length > 1) E.aim = { u: 0, h: 0.55 };
  E.snap = E.arrowNo === 0 && E.cfg.mode === 'match' ? JSON.parse(JSON.stringify({ ...E, snap: null, events: [] })) : E.snap;
  ev(E, 'aim', { team: E.cur.team, m: E.cur.m, arrowNo: E.arrowNo });
}

// ---- the computer's archer -------------------------------------------------------------------------------------------------------------------------------------
export function makePlan(E) {
  const lv = levelOf(E, E.cur.team), dir = E.dir;
  const w = windAt(E, E.t + 1.1), s = w.s;
  const sp = Math.max(0, s * (1 + gauss(E) * lv.wind * 0.3) + gauss(E) * lv.wind * 0.5), phi = w.phi + gauss(E) * lv.wind * 0.12;
  const pw = { x: Math.sin(phi) * sp, z: Math.cos(phi) * sp };
  const aimH = BOARD.karayY - 0.06;
  const ang = solveAim(dir, 0, aimH, pw);
  const intended = impact(dir, ang.yaw, ang.pitch, NO_WIND);
  const dist = Math.abs(boardZ(dir) - originOf(dir).z);
  const eu = gauss(E) * lv.su, eh = gauss(E) * lv.sh;
  const hold = lv.hold[0] + rnd(E) * (lv.hold[1] - lv.hold[0]);
  const rel = windRel(E, dir, E.t + 1.1);
  const real = impact(dir, ang.yaw, ang.pitch, w);
  const drift = real.u - intended.u;
  const lines = [`Wind: ${windWords(rel)}.`, Math.abs(drift) > 0.15 ? `It will push the arrow about ${Math.abs(drift).toFixed(1)} m to the ${drift > 0 ? 'right' : 'left'}, so aim ${Math.abs(drift).toFixed(1)} m to the ${drift > 0 ? 'left' : 'right'} of the board.` : 'The wind is too light to matter much.', `Hold the draw for about ${hold.toFixed(1)} seconds, then let go.`];
  return { yaw: ang.yaw + eu / dist, pitch: ang.pitch + eh / (dist * 1.1), aim: { u: intended.u, h: intended.h }, hold, lines, value: { u: intended.u, h: intended.h } };
}

// ---- the sway of the bow arm -----------------------------------------------------------------------------------------------------------------------------------
export function breath(t) { return 0.3 + 0.7 * (0.5 + 0.5 * Math.cos((TAU * (t - BREATH_CALM)) / BREATH_T + Math.PI)); }   // 0.3 = calm, 1 = least steady
export function swayAmp(t) { const ramp = Math.min(1, t / 0.7), tired = 1 + 0.45 * Math.max(0, t - 4); return SWAY_A * ramp * breath(t) * tired; }
export function swayAt(ph, t) {
  const a = swayAmp(t);
  return { u: a * (0.62 * Math.sin(TAU * 0.9 * t + ph[0]) + 0.38 * Math.sin(TAU * 1.7 * t + ph[1])), h: a * (0.5 * Math.sin(TAU * 1.1 * t + ph[2]) + 0.3 * Math.sin(TAU * 2.3 * t + ph[3])) };
}
export const drawFrac = (t) => Math.min(1, t / DRAW_T);
export const speedFor = (d) => (d >= 0.97 ? 1 : 0.55 + 0.45 * d * d);

// ---- the human's moves -------------------------------------------------------------------------------------------------------------------------------------------
export const canAct = (E) => E.phase === 'aim' && isHuman(E, E.cur.team) && !E.over;
export function setReticle(E, u, h) { if (!canAct(E)) return; E.aim.u = clamp(u, -14, 14); E.aim.h = clamp(h, -1.5, 7); }
export function setZoom(E, z) { E.zoom = clamp(z | 0, 0, 3); }
export function beginDraw(E) {
  if (!canAct(E) && !(E.phase === 'aim' && E.ai && E.go)) return false;
  E.phase = 'draw'; E.pt = 0; E.draw = { t: 0, ph: [rnd(E) * TAU, rnd(E) * TAU, rnd(E) * TAU, rnd(E) * TAU], auto: !isHuman(E, E.cur.team) };
  ev(E, 'drawStart', { team: E.cur.team, m: E.cur.m });
  return true;
}
export function cancelDraw(E) { if (E.phase !== 'draw' || !isHuman(E, E.cur.team)) return false; E.phase = 'aim'; E.pt = 0; E.draw = null; ev(E, 'letdown', { team: E.cur.team, m: E.cur.m }); return true; }
export function releaseDraw(E) {
  if (E.phase !== 'draw' || !E.draw) return false;
  if (isHuman(E, E.cur.team) && E.draw.t < 0.3) return cancelDraw(E);
  const dir = E.dir, w = windAt(E, E.t), dist = Math.abs(boardZ(dir) - originOf(dir).z), d = drawFrac(E.draw.t);
  let ang;
  if (E.draw.auto && E.plan) ang = { yaw: E.plan.yaw, pitch: E.plan.pitch };
  else {
    ang = solveAim(dir, E.aim.u, E.aim.h, E.cfg.help === 0 ? w : NO_WIND);
    const sw = E.cfg.perfect ? { u: 0, h: 0 } : swayAt(E.draw.ph, E.draw.t), nn = E.cfg.perfect ? 0 : NOCK_NOISE;   // `perfect` is only set by the store-screenshot presets
    ang.yaw += (sw.u + gauss(E) * nn) / dist; ang.pitch += (sw.h + gauss(E) * nn) / (dist * 1.1);
  }
  const speed = V0 * speedFor(d) * (1 + gauss(E) * (E.cfg.perfect ? 0 : SPEED_JITTER));
  const a = launch(dir, ang.yaw, ang.pitch, speed);
  E.arrow = { ...a, t0: E.t, dir, team: E.cur.team, m: E.cur.m, alive: true, full: d >= 0.97, yaw: ang.yaw, pitch: ang.pitch };
  E.shots++; E.phase = 'flight'; E.pt = 0; E.last = null;
  ev(E, 'release', { team: E.cur.team, m: E.cur.m, hold: E.draw.t, full: d >= 0.97, speed });
  E.draw = null; E.go = false;
  return true;
}
export function actPlan(E) { if (E.phase === 'aim' && E.ai) E.go = true; }
export function continueEnd(E) { if (E.phase === 'endscore') E.go = true; }
export function skipDance(E) { if (E.phase === 'dance' && E.pt > 0.8) E.pt = T.dance; }

// ---- stepping --------------------------------------------------------------------------------------------------------------------------------------------------------
function resolve(E, kind, u, y, gx, gz) {
  const a = E.arrow, tm = E.teams[a.team], st = tm.st;
  let pts = 0, k = kind;
  if (kind === 'board') {
    const dk = Math.hypot(u, y - BOARD.karayY);
    if (dk <= BOARD.karayR) { k = 'karay'; pts = POINTS.karay; } else { k = 'hit'; pts = POINTS.hit; }
  } else {
    const d = Math.hypot(gx, gz - boardZ(a.dir));
    if (d <= NEAR) { k = 'near'; pts = POINTS.near; } else k = 'miss';
  }
  if (!a.full) { /* a short draw keeps whatever it earned */ }
  st.arrows++; if (k === 'karay') { st.karay++; st.hits++; } else if (k === 'hit') st.hits++; else if (k === 'near') st.near++;
  st.streak = pts >= POINTS.hit ? st.streak + 1 : 0; st.best = Math.max(st.best, st.streak);
  tm.endPts += pts;
  const missBy = kind === 'board' ? 0 : Math.hypot(gx, gz - boardZ(a.dir));
  E.last = { team: a.team, m: a.m, arrowNo: E.arrowNo, kind: k, pts, u: u ?? 0, y: y ?? 0, missBy, full: a.full, celebrate: k === 'karay', t: E.t };
  a.alive = false;
  E.stuck.push({ x: a.x, y: a.y, z: a.z, vx: a.vx, vy: a.vy, vz: a.vz, team: a.team, board: kind === 'board', id: E.shots });
  E.phase = 'result'; E.pt = 0;
  ev(E, k, { team: a.team, m: a.m, pts, u, y, gx, gz });
  if (E.lesson) { E.lesson.left--; E.lesson.pts += pts; if (k === 'karay' && E.lesson.def.id === 'karay') E.lesson.pts = Math.max(E.lesson.pts, E.lesson.def.goal_pts); }
}
function afterResult(E) {
  const lz = E.lesson;
  if (lz) {
    if (lz.pts >= lz.def.goal_pts) { lz.done = true; lz.pass = true; } else if (lz.left <= 0) { lz.done = true; lz.pass = false; }
    if (lz.done) { E.phase = 'over'; E.over = { lesson: true, pass: lz.pass }; ev(E, 'over', {}); return; }
  }
  E.arrowNo++;
  const solo = E.teams.length === 1;
  if (solo) { E.arrowNo = 0; E.phase = 'nock'; E.pt = 0; if (E.cfg.mode === 'practice' && E.shots % 6 === 0) newWind(E, true); return; }
  if (E.arrowNo < ARROWS_PER_TURN) { E.phase = 'nock'; E.pt = 0; return; }
  E.turn++;
  if (E.turn >= E.order.length) { scoreEnd(E); return; }
  E.phase = 'swap'; E.pt = 0; ev(E, 'swap', { next: E.order[E.turn] });
}
function scoreEnd(E) {
  const [a, b] = E.teams, net = Math.abs(a.endPts - b.endPts), win = a.endPts === b.endPts ? -1 : a.endPts > b.endPts ? 0 : 1;
  if (win >= 0) E.teams[win].pts += net;
  E.endRes = { e: [a.endPts, b.endPts], net, winner: win, end: E.end, total: [a.pts, b.pts] };
  E.log.push(E.endRes);
  E.phase = 'endscore'; E.pt = 0; E.go = false;
  const tgt = targetPts(E);
  if (a.pts >= tgt || b.pts >= tgt || (E.end >= 13 && a.pts !== b.pts)) E.over = { winner: a.pts > b.pts ? 0 : b.pts > a.pts ? 1 : -1, total: [a.pts, b.pts] };
  ev(E, 'endScore', { res: E.endRes });
}

export function step(E, dt) {
  E.t += dt; E.pt += dt;
  switch (E.phase) {
    case 'endintro': if (E.pt >= T.endintro) startTurn(E); break;
    case 'nock': if (E.pt >= T.nock) { if (!E.cur) E.cur = E.order[0]; beginAim(E); } break;
    case 'swap': if (E.pt >= T.swap) startTurn(E); break;
    case 'aim':
      if (E.ai && E.plan) {
        if (E.cfg.mode !== 'watch' || E.go || E.ai.rev) E.ai.t += dt;
        const k = Math.min(1, E.ai.t / AIM_EASE), e = k * k * (3 - 2 * k);
        E.aim = { u: E.ai.from.u + (E.plan.aim.u - E.ai.from.u) * e, h: E.ai.from.h + (E.plan.aim.h - E.ai.from.h) * e };
        if (E.cfg.mode !== 'watch' && E.ai.t >= AIM_EASE + 0.35) { E.go = true; }
        if (E.go && E.ai.t >= AIM_EASE) beginDraw(E);
      }
      break;
    case 'draw':
      E.draw.t += dt;
      if (E.draw.auto && E.plan && E.draw.t >= E.plan.hold) releaseDraw(E);
      else if (!E.draw.auto && E.draw.t > 9) releaseDraw(E);
      break;
    case 'flight': stepFlight(E, dt); break;
    case 'result':
      if (E.pt >= (E.last && E.last.pts > 0 ? T.result : T.resultMiss)) { if (E.last && E.last.celebrate) { E.phase = 'dance'; E.pt = 0; ev(E, 'dance', { team: E.last.team }); } else afterResult(E); }
      break;
    case 'dance': if (E.pt >= T.dance) afterResult(E); break;
    case 'endscore':
      if (E.go || (E.cfg.mode === 'watch' && E.pt >= T.endAuto)) { if (E.over) { E.phase = 'over'; ev(E, 'over', {}); } else { E.phase = 'walk'; E.pt = 0; ev(E, 'walk', {}); } }
      break;
    case 'walk': if (E.pt >= T.walk) startEnd(E); break;
    default: break;
  }
}
function stepFlight(E, dt) {
  const a = E.arrow; if (!a || !a.alive) return;
  const bz = boardZ(a.dir);
  for (let i = 0; i < 2 && a.alive; i++) {
    const px = a.x, py = a.y, pz = a.z;
    stepArrow(a, dt / 2, windAt(E, E.t));
    if ((a.z - bz) * a.dir >= 0 && (pz - bz) * a.dir < 0 && !a.passed) {
      const f = (bz - pz) / (a.z - pz), x = px + (a.x - px) * f, y = py + (a.y - py) * f, u = x * rightX(a.dir);
      a.passed = true;
      if (Math.abs(u) <= BOARD.w / 2 && y >= 0 && y <= BOARD.h) { a.x = x; a.y = y; a.z = bz; resolve(E, 'board', u, y, x, bz); return; }
      ev(E, 'pass', { u, y });
    }
    if (a.y <= 0) { const f = py / Math.max(1e-6, py - a.y); a.x = px + (a.x - px) * f; a.z = pz + (a.z - pz) * f; a.y = 0; resolve(E, 'ground', a.x * rightX(a.dir), 0, a.x, a.z); return; }
  }
  if (E.t - a.t0 > 14) { a.y = 0; resolve(E, 'ground', a.x * rightX(a.dir), 0, a.x, a.z); }
}

// ---- helpers for the screens ------------------------------------------------------------------------------------------------------------------------------------------
export const shooter = (E) => (E.cur ? E.teams[E.cur.team].members[E.cur.m] : null);
export const arrowOf = (E) => (E.cur ? `${E.arrowNo + 1} of ${ARROWS_PER_TURN}` : '');
export const dist = (E) => Math.abs(boardZ(E.dir) - originOf(E.dir).z);
export { RANGE, rightX, boardZ, standZ, standX, originOf, solveAim, impact, NO_WIND };

// the reticle as the player sees it: the aim point plus the sway of the arm while drawing
export function reticle(E) {
  const r = { u: E.aim.u, h: E.aim.h };
  if (E.phase === 'draw' && E.draw && !E.draw.auto) { const s = swayAt(E.draw.ph, E.draw.t); r.u += s.u; r.h += s.h; }
  return r;
}

// ---- the coach (Think) ---------------------------------------------------------------------------------------------------------------------------------------------------
export function coachHint(E) {
  if (!canAct(E)) return null;
  const dir = E.dir, w = windAt(E, E.t), rel = windRel(E, dir);
  const mw = E.cfg.help === 0 ? w : NO_WIND, aimH = BOARD.karayY - 0.05;
  const ang = solveAim(dir, 0, aimH, w);
  const shown = impact(dir, ang.yaw, ang.pitch, mw);
  const noWindImp = impact(dir, ang.yaw, ang.pitch, NO_WIND), drift = impact(dir, ang.yaw, ang.pitch, w).u - noWindImp.u;
  const lines = [`Wind: ${windWords(rel)}.`];
  if (Math.abs(drift) > 0.12) lines.push(`Left alone it pushes the arrow about ${Math.abs(drift).toFixed(1)} m to the ${drift > 0 ? 'right' : 'left'}.`);
  if (E.cfg.help === 0) lines.push('Guided help already counts the wind: put the reticle on the karay, the small painted circle.');
  else if (Math.abs(shown.u) > 0.1) lines.push(`Put the reticle ${Math.abs(shown.u).toFixed(1)} m to the ${shown.u > 0 ? 'right' : 'left'} of the board centre (the suggestion button does it for you).`);
  else lines.push('Put the reticle on the karay, the small painted circle.');
  if (Math.abs(rel.along) > 1.5) lines.push(rel.along > 0 ? 'A wind from behind lifts the arrow: aim a little lower than usual.' : 'A wind in your face drops the arrow: aim a little higher.');
  lines.push('Hold DRAW until the ring is full, wait for the calm moment of the breath (the ring is smallest), then let go.');
  return { title: 'Think', lines, value: { u: shown.u, h: shown.h }, applyLabel: 'Move the reticle there' };
}

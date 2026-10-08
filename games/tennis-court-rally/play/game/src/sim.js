// The match: two players, rally, serve, rules, scoring, swings, computer players. Pure and deterministic (fixed sub-step, seeded streams).
// The presenter and the HUD only READ `sim.s`. Contact times are exact: a swing is committed at release time and the ball is struck on the
// sub-step grid at tc; the 3D layer retimes its animation to land the racket face on the ball at exactly that time.
import { HW, HL, SL, BR, SHOTS, SURFACES, LEVELS, PHYS, SWING_DELAY, SWING_TAIL, PACE, FORMATS, TOSS_H, RUN_X, RUN_Z, NET_C } from './consts.js';
import { newBall, cloneBall, stepBall, forecast } from './physics.js';
import { solveShot } from './shots.js';
import { analyse, planFor, stanceFor, sideOf, clampStance } from './plan.js';
import { evaluate, pick, reasonFor, wordsFor } from './ai.js';
import { newScore, awardPoint, serverOf, courtOf, pointText } from './score.js';
import { clamp, normal } from './util.js';

const H = PHYS.h;
const READY_T = 1.0, DEAD_T = 2.3;
export const TOSS_UP = 0.95, TOSS_H0 = 1.2;
const HUMAN_ST = { spd: 5.6, agg: 0.5, react: 0, timing: 0, aim: 0.1, think: 1, cover: 1, err: 0, lunge: 1, net: 0, srv: 1 };

// Toss height at u seconds after the toss starts: rises with an ease-out to the contact height, then falls.
export const tossY = (u) => (u <= TOSS_UP ? TOSS_H0 + (TOSS_H - TOSS_H0) * (1 - (1 - u / TOSS_UP) * (1 - u / TOSS_UP)) : TOSS_H - 4.2 * (u - TOSS_UP) * (u - TOSS_UP));

// Map a drag (virtual units from the press point; up is negative dy) to a shot. side: the hitter's side sign. Pure; used by the HUD marker too.
export function shotFromDrag(dx, dy, side, serving = false, boxSign = 1, serveNo = 1) {
  const os = -side, len = Math.hypot(dx, dy), up = -dy;
  if (serving) {
    const x0 = 1.8 * boxSign, x = clamp(x0 - (dx / 150) * 1.7, boxSign > 0 ? 0.3 : -2.98, boxSign > 0 ? 2.98 : -0.3);
    const d = clamp(3.6 + clamp(up / 160, -1, 1) * 0.95, 2.6, 4.52);
    return { kind: serveNo === 1 ? 'serve1' : 'serve2', aim: { x, z: os * d }, tap: len < 26 };
  }
  const x = clamp(-dx / 150 * 2.9, -3.45, 3.45);
  if (len < 26) return { kind: null, aim: null, tap: true };
  const t = (a, b, v, v0, v1) => a + (b - a) * clamp((v - v0) / (v1 - v0), 0, 1);
  if (up >= 0.35 * len) {
    if (len < 85) return { kind: 'drop', aim: { x: x * 0.7, z: os * t(1.5, 3.2, len, 26, 85) }, tap: false };
    if (len < 150) return { kind: 'slice', aim: { x, z: os * t(4.6, 7.0, len, 85, 150) }, tap: false };
    return { kind: 'drive', aim: { x, z: os * t(5.4, 8.1, len, 150, 260) }, tap: false };
  }
  if (-up >= 0.35 * len) return { kind: 'lob', aim: { x, z: os * t(5.4, 8.1, len, 26, 200) }, tap: false };
  return { kind: 'slice', aim: { x, z: os * 6.0 }, tap: false };
}
// The inverse, for hints: a drag that makes shotFromDrag return roughly this shot.
export function dragFor(kind, aim, side, boxSign = 1) {
  const dx = -aim.x / 2.9 * 150, d = Math.abs(aim.z);
  if (kind === 'serve1' || kind === 'serve2') return { dx: -(aim.x - 1.8 * boxSign) / 1.7 * 150, dy: -(d - 3.6) / 0.95 * 160 };
  if (kind === 'drop') return { dx: dx / 0.7, dy: -(26 + (d - 1.5) / 1.7 * 59) };
  if (kind === 'slice') return { dx, dy: -(85 + (d - 4.6) / 2.4 * 65) };
  if (kind === 'lob') return { dx, dy: 26 + (d - 5.4) / 2.7 * 174 };
  return { dx, dy: -(150 + (d - 5.4) / 2.7 * 110) };
}

export function createSim(cfg0, rng) {
  const cfg = { fmt: 'quick', surface: 'lawn', level: 3, pace: 'normal', watch: false, watchLevels: [3, 3], drill: null, firstServer: 0, resume: null, bot: false, ...cfg0 };
  const surf = SURFACES[cfg.surface] || SURFACES.lawn;
  const fmt = FORMATS[cfg.fmt] || FORMATS.quick;
  const pace = PACE[cfg.pace] ?? 1;
  const aiRng = rng.fork(), noiseRng = rng.fork(), pickRng = rng.fork();

  // ------------------------------------------------------------------------------------------------ players
  const players = [];
  const mk = (team, lvl, human) => {
    const st = human ? { ...HUMAN_ST } : { ...LEVELS[clamp(lvl, 1, 5) - 1] };
    const p = { id: players.length, team, dir: team === 0 ? 1 : -1, human, level: human ? 0 : lvl, st, lefty: !human && aiRng.next() < 0.18, x: 0, z: sideOf(team) * (HL + 0.5), vx: 0, vz: 0, face: team === 0 ? 0 : Math.PI, target: { x: 0, z: 0 }, swing: null, plan: null, press: null, stance: 'back', phase: aiRng.next() * 6.28 };
    players.push(p);
    return p;
  };
  const human = !cfg.watch && !cfg.bot && !cfg.drill;
  if (cfg.watch) { mk(0, cfg.watchLevels[0], false); mk(1, cfg.watchLevels[1], false); }
  else if (cfg.drill) { mk(0, 3, true); mk(1, 5, false); }
  else { mk(0, cfg.bot ? 4 : 0, human); mk(1, cfg.level, false); }
  if (cfg.bot) players[0].isUser = true;
  const pOf = (id) => players[id];

  // ------------------------------------------------------------------------------------------------ state
  const sc = newScore(fmt.id, cfg.firstServer);
  const s = {
    n: 0, t: 0, phase: 'ready', phaseT: 0,
    cfg: { fmt: fmt.id, surface: surf.id, pace: cfg.pace, level: cfg.level, watch: !!cfg.watch, drill: cfg.drill ? cfg.drill.kind : null },
    surf: surf.id, players, sc,
    ball: { x: 0, y: 1.2, z: -9, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, vis: false, held: true, tossing: false, rot: [0, 0, 0, 1] },
    prev: null, trail: [],
    rally: null, serve: null, toss: null,
    match: { rallies: 0, history: [], stats: [{ winners: 0, errors: 0, aces: 0, faults: 0, doubles: 0 }, { winners: 0, errors: 0, aces: 0, faults: 0, doubles: 0 }], longest: 0, over: false, winner: -1 },
    events: [], eid: 0, last: null, cue: null,
    ctl: { auto: true, autoAim: true, stance: 'back', assist: null }, autoAim: null,
    drill: cfg.drill ? { ...cfg.drill, fed: 0, n: cfg.drill.n || 6 } : null,
    hold: null,
  };
  if (cfg.resume) {
    const r = cfg.resume;
    sc.pts = [...r.pts]; sc.games = [...r.games]; sc.tb = !!r.tb; sc.server = r.server; sc.tbServer = r.tbServer ?? r.server; sc.gamesPlayed = r.gamesPlayed | 0;
    s.match.rallies = r.rallies | 0; if (r.stats) s.match.stats = JSON.parse(JSON.stringify(r.stats));
  }
  let acc = 0, F = null, A = null, pendSwing = null, pendToss = false, R = null;
  const ev = (type, o = {}) => { const e = { id: s.eid++, t: s.t, type, ...o }; s.events.push(e); if (s.events.length > 160) s.events.splice(0, s.events.length - 120); return e; };
  const newRally = (serve, server, boxSign) => ({ serve, server, serveNo: 1, struck: false, lastHit: -1, lastTeam: -1, hits: 0, bounces: 0, side: 0, boxSign, cord: false, tHit: 0, claim: -1, tIdeal: null });
  const flagsOf = () => ({ serve: R.serve && !R.serveDone, side: R.side, boxSign: R.boxSign, bounces: R.bounces, cord: R.cord });

  // ------------------------------------------------------------------------------------------------ point set-up and serving
  const homeOf = (p) => {
    const side = sideOf(p.team);
    if (p.stance === 'net') return { x: clamp((s.ball.vis && s.ball.x * 0.4) || 0, -1.2, 1.2), z: side * 2.7 };
    return { x: 0, z: side * (HL + 0.2) };
  };
  function placeForPoint() {
    const srvId = cfg.drill ? 0 : serverOf(sc);
    const server = pOf(srvId), recv = pOf(1 - srvId);
    const court = cfg.drill ? 0 : courtOf(sc);
    const boxSign = court === 0 ? server.dir : -server.dir;
    R = newRally(true, srvId, boxSign);
    R.serveNo = (s.faultCarry | 0) + 1;
    s.rally = R;
    for (const p of players) { p.swing = null; p.plan = null; p.press = null; p.vx = 0; p.vz = 0; p.stance = 'back'; p.dec = null; }
    s.ctl.stance = 'back';
    if (cfg.drill && cfg.drill.kind === 'volley') { pOf(0).stance = 'net'; s.ctl.stance = 'net'; }
    const sx = (court === 0 ? -server.dir : server.dir) * 0.9;
    server.target = { x: sx, z: sideOf(server.team) * (HL + 0.4) };
    recv.target = { x: boxSign * 1.4, z: sideOf(recv.team) * (HL + 0.7) };
    // players walk to their spots; on the first point they start there
    if (s.n === 0 || s.firstPlace !== true) { for (const p of players) { p.x = p.target.x; p.z = p.target.z; } s.firstPlace = true; }
    s.ball.vis = false; s.ball.held = true; s.ball.tossing = false; s.cue = null; s.toss = null; s.serve = null;
    s.phase = 'ready'; s.phaseT = 0; s.hold = null; pendSwing = null; pendToss = false;
    F = null; A = null; s.autoAim = null;
  }
    function startServePhase() {
    s.phase = 'serve'; s.phaseT = 0;
    const sv = pOf(R.server);
    s.serve = { server: sv.id, tPrompt: s.t, tToss: sv.human ? 1e9 : s.t + 0.5 + aiRng.next() * 0.6 };
    s.ball.held = true; s.ball.vis = true; s.ball.tossing = false;
    placeBallInHand();
    s.toss = null;
    ev('ready', { server: sv.id, serveNo: R.serveNo });
    s.cue = null;
    // a human server's auto aim: the best serve target for the box
    if ((sv.human) && s.ctl.autoAim && !cfg.drill) {
      const cp = { x: sv.x, y: TOSS_H, z: sv.z + sv.dir * 0.45 };
      const kind = R.serveNo === 1 ? 'serve1' : 'serve2';
      const list = evaluate({ cp, tc: s.t + 1.2, q: 0.85, sigma: 0.35, side: sideOf(sv.team), opps: [pOf(1 - sv.id)], serve: true, kinds: [kind], surf, boxSign: R.boxSign, agg: 0.4 });
      const top = list.find((c) => !c.fault);
      if (top) s.autoAim = { kind: top.kind, aim: top.aim };
    }
  }
  function placeBallInHand() {
    const sv = pOf(R.server), b = s.ball;
    b.x = sv.x + (sv.lefty ? 1 : -1) * -sv.dir * 0.22; b.z = sv.z + sv.dir * 0.4; b.y = TOSS_H0; b.vx = b.vy = b.vz = 0; b.wx = b.wy = b.wz = 0;
  }
  function startToss() {
    if (s.phase !== 'serve') return;
    const sv = pOf(R.server), b = s.ball;
    placeBallInHand();
    b.held = false; b.tossing = true;
    s.toss = { t0: s.t, x: b.x, z: b.z };
    const tApex = s.t + TOSS_UP;
    s.cue = (sv.human || sv.isUser) ? { team: sv.team, who: sv.id, tIdeal: tApex, tPress: tApex - SWING_DELAY, serve: true, claim: true, cp: { x: b.x, y: TOSS_H, z: b.z } } : null;
    if (!(sv.human)) {
      const lv = sv.st;
      sv.press = { t: tApex - SWING_DELAY + normal(noiseRng) * lv.timing * 0.8, kind: null };
    }
    ev('toss', { p: sv.id, t0: s.t });
  }

  // ball machine for drills: a ball arrives from the rival's baseline, in play
  function feedBall() {
    const d = s.drill, k = d.kind, i = d.fed++;
    const fr = (n) => ((i * 0.6180339887 + n) % 1);
    const hp = pOf(0);
    const x = -2.4 + 4.8 * fr(0.1);
    const cp = { x: clamp(x * 0.4, -1.5, 1.5), y: 1.2, z: HL + 0.3 };
    let aim = { x: (fr(0.4) - 0.5) * 4.6, z: -6.3 - fr(0.7) * 1.2 }, kind = 'drive';
    if (k === 'volley') { aim = { x: (fr(0.4) - 0.5) * 3.0, z: -3.1 }; kind = 'slice'; hp.stance = 'net'; s.ctl.stance = 'net'; }
    if (k === 'dropLob' || k === 'depth') { aim = { x: (fr(0.4) - 0.5) * 4.6, z: -5.4 - fr(0.7) * 2.4 }; }
    const sol = solveShot(cp, aim, kind, 0.9, surf);
    Object.assign(s.ball, { x: cp.x, y: cp.y, z: cp.z, vx: sol.vx, vy: sol.vy, vz: sol.vz, wx: sol.wx, wy: sol.wy, wz: sol.wz, vis: true, held: false, tossing: false });
    R = newRally(false, 1, 0); R.struck = true; R.hits = 1; R.lastTeam = 1; R.lastHit = 1; R.side = -1; R.tHit = s.t; R.serve = false; R.serveDone = true;
    s.rally = R; s.phase = 'live';
    afterHit();
    ev('feed', { i });
  }

  // ------------------------------------------------------------------------------------------------ forecast and plans
  function refreshForecast() {
    F = forecast(s.ball, { maxT: 4.0, t0: s.t, surf });
    A = analyse(F, flagsOf());
    R.tIdeal = A.tIdeal;
  }
  function afterHit() { refreshForecast(); replan(); }
  function replan() {
    for (const p of players) { p.plan = null; p.press = null; }
    R.claim = -1;
    if (!A || A.ta === null) { for (const p of players) p.target = homeOf(p); s.cue = null; return; }
    const recv = pOf(R.lastTeam === 0 ? 1 : 0);
    const pl = planFor(recv, F, A, s.t);
    if (pl) {
      recv.plan = pl; R.claim = recv.id;
      recv.target = { x: pl.S.x, z: pl.S.z };
      if (!(recv.human) && !cfg.drill) recv.press = { t: Math.max(s.t + 0.02, pl.t - SWING_DELAY + normal(noiseRng) * recv.st.timing), kind: null };
    } else recv.target = homeOf(recv);
    const other = pOf(recv.id === 0 ? 1 : 0);
    other.target = recoverTarget(other);
    const hp = recv.human || recv.isUser ? recv : null;
    s.cue = hp ? { team: recv.team, who: recv.id, tIdeal: pl ? pl.t : A.tIdeal, tPress: (pl ? pl.t : A.tIdeal) - SWING_DELAY, claim: !!pl, cp: pl ? pl.cp : null, serve: false } : null;
    s.autoAim = null;
    if (hp && s.ctl.autoAim && pl) {
      const list = evaluate({ cp: pl.cp, tc: pl.t, q: 0.8, sigma: 0.4, side: sideOf(hp.team), opps: [other], serve: false, surf, agg: 0.4, kinds: ['drive', 'slice'] });
      const top = list.find((c) => !c.fault);
      if (top) s.autoAim = { kind: top.kind, aim: top.aim };
    }
  }
  function recoverTarget(p) {
    const lv = p.st.cover, h = homeOf(p);
    const foe = pOf(1 - p.id);
    return clampStance(p.team, h.x + (clamp(foe.x * 0.45, -1.4, 1.4) - h.x) * lv * 0.0 + clamp(-s.ball.x * 0.25, -1.1, 1.1) * lv, h.z);
  }

  // ------------------------------------------------------------------------------------------------ swings
  function ballAt(tc) {
    const b = cloneBall(s.ball), steps = Math.round((tc - s.t) / H);
    let floors = 0;
    for (let k = 0; k < steps; k++) { const e = stepBall(b, H, surf); if (e.length) for (const x of e) if (x.kind === 'floor') floors++; }
    return { b, floors };
  }
  const faceBase = (p) => (p.dir > 0 ? 0 : Math.PI);
  /** Start a swing for player p now (a rally stroke). Returns the swing or null when busy. */
  function startSwing(p, kind, aim) {
    if (p.swing && s.t < p.swing.t1) return null;
    if (s.phase !== 'live') return null;
    const tPress = s.t;
    const tc = Math.ceil((tPress + SWING_DELAY) / H - 1e-9) * H;
    const { b } = ballAt(tc);
    const cp = { x: b.x, y: b.y, z: b.z };
    const side = sideOf(p.team);
    let playable = false, why = '';
    if (R.struck && p.team !== R.lastTeam && A && A.ta !== null) {
      if (tc >= A.ta && tc <= A.tb) playable = true; else why = tc < A.ta ? 'early' : 'late';
    } else why = 'not your turn';
    let dirEst = null;
    if (aim && playable) { const so = solveShot(cp, aim, kind, 0.85, surf); if (so) { const vl = Math.hypot(so.vx, so.vy, so.vz) || 1; dirEst = { x: so.vx / vl, y: so.vy / vl, z: so.vz / vl }; } }
    void dirEst;
    const S = stanceFor(p, cp, p);
    const d = Math.hypot(S.x - p.x, S.z - p.z);
    const maxD = 0.5 + p.st.spd * SWING_DELAY * 0.95 * (p.st.lunge || 1);
    const own = Math.sign(cp.z) === side && Math.abs(cp.z) > 0.95;
    const contact = playable && own && cp.y >= (kind === 'lob' ? 0.4 : 0.3) && cp.y <= 2.4 && d <= maxD && Math.abs(cp.x) < HW + RUN_X - 0.3 && Math.abs(cp.z) < HL + RUN_Z - 0.3;
    if (playable && !contact) why = !own ? 'net' : d > maxD ? 'reach' : 'height';
    const tIdeal = A ? A.tIdeal : null;
    const e = tIdeal === null || tIdeal === undefined ? 0.1 : tc - tIdeal;
    const bsp = Math.hypot(b.vx, b.vy, b.vz);
    const qt = 1 - Math.pow(clamp(Math.abs(cp.y - 1.0) / 0.8, 0, 1), 1.3);
    const qs = 1 - clamp((d - 0.6) / Math.max(0.2, maxD - 0.6), 0, 1) * 0.5;
    const qh = 1 - clamp((bsp - 15) / 25, 0, 0.3);
    const q = contact ? clamp(qt * qs * qh, 0, 1) : 0;
    const volley = A && A.tB1 !== null ? tc < A.tB1 : true;
    const tech = S.tech === 'high' ? 'high' : volley && cp.y > 0.55 && Math.abs(cp.z) < SL + 1.2 ? 'vol' : S.tech;
    const sw = { id: s.eid, p: p.id, t0: s.t, tc, t1: tc + SWING_TAIL, kind, aim, tech, back: S.back, S: { x: S.x, z: S.z }, p0: { x: p.x, z: p.z, vx: p.vx, vz: p.vz }, cp, contact, q, e, why, hit: false, done: false, serve: false, lefty: p.lefty, volley };
    if (!contact) { const m = p.lefty ? -1 : 1; sw.cp = { x: S.x + (-p.dir * m) * 0.5, y: clamp(cp.y, 0.6, 1.4), z: S.z + p.dir * 0.4 }; sw.ballAt = cp; }
    p.swing = sw; p.press = null;
    faceFor(p, sw);
    ev('swing', { p: p.id, tc, contact, kind, tech, q, e, why });
    return sw;
  }
  /** A serve stroke: the toss is rising or falling; the contact is where the ball is at tc. */
  function startServeSwing(p, kind, aim) {
    if (!s.toss || p.swing && s.t < p.swing.t1) return null;
    const tc = Math.ceil((s.t + SWING_DELAY) / H - 1e-9) * H;
    const u = tc - s.toss.t0, y = tossY(u);
    const tApex = s.toss.t0 + TOSS_UP, e = tc - tApex;
    const cp = { x: s.toss.x, y, z: s.toss.z };
    const contact = y >= 2.05 && Math.abs(e) <= 0.36;
    const q = contact ? clamp(1 - Math.pow(clamp(Math.abs(e) / 0.24, 0, 1), 1.3), 0, 1) : 0;
    const m = p.lefty ? -1 : 1;
    const S = { x: p.x, z: p.z + p.dir * 0.0 };
    const sw = { id: s.eid, p: p.id, t0: s.t, tc, t1: tc + SWING_TAIL + 0.1, kind, aim, tech: 'serve', back: false, S, p0: { x: p.x, z: p.z, vx: 0, vz: 0 }, cp, contact, q, e, why: contact ? '' : e < 0 ? 'early' : 'late', hit: false, done: false, serve: true, lefty: p.lefty };
    if (!contact) sw.cp = { x: cp.x, y: Math.max(cp.y, 2.4), z: cp.z };
    void m;
    p.swing = sw; p.press = null;
    faceFor(p, sw);
    ev('swing', { p: p.id, tc, contact, kind, tech: 'serve', q, e, why: sw.why, serve: true });
    return sw;
  }
  function faceFor(p, sw) {
    const m = p.lefty ? -1 : 1, side = sw.back ? -1 : 1;
    let turn = -m * side * (sw.tech === 'vol' ? 0.35 : 0.8);
    if (sw.tech === 'high') turn = -m * 1.15 * (sw.serve ? 1 : 0.6);
    sw.faceYaw = faceBase(p) + turn;
    return sw.faceYaw;
  }

  function applyContact(p, sw) {
    sw.done = true;
    const b = s.ball;
    const serveShot = sw.serve;
    const dBall = Math.hypot(b.x - sw.cp.x, b.y - sw.cp.y, b.z - sw.cp.z);
    const okState = serveShot ? (s.phase === 'live' || s.phase === 'serve') && b.tossing : R.struck && p.team !== R.lastTeam && R.bounces < 2;
    if (!sw.contact || !okState || (!serveShot && dBall > 0.09)) { sw.contact = false; sw.why = sw.why || 'late'; ev('whiff', { p: p.id, why: sw.why, tc: sw.tc, serve: serveShot }); return; }
    const st = p.st, q = sw.q;
    const mishit = !p.human && aiRng.next() < st.err * (1.2 - 0.6 * q);
    let sig = st.aim * 0.55 + (1 - q) * 0.9 + (mishit ? 1.2 : 0);
    if (sw.kind === 'serve1') sig *= 1.15;
    const nx = normal(noiseRng), nz = normal(noiseRng), ny = normal(noiseRng);
    const base = sw.aim;
    const aim = { x: base.x + nx * sig, z: base.z + Math.sign(base.z) * nz * sig * 0.8 };
    const clearNoise = SHOTS[sw.kind].clear + ny * sig * 0.22;
    const qq = mishit ? Math.min(q, 0.25) : q;
    const sol = solveShot(sw.cp, aim, sw.kind, qq, surf, { clear: clearNoise });
    Object.assign(b, { vx: sol.vx, vy: sol.vy, vz: sol.vz, wx: sol.wx, wy: sol.wy, wz: sol.wz, held: false, tossing: false });
    b.x = sw.cp.x; b.y = sw.cp.y; b.z = sw.cp.z;
    const vl = Math.hypot(sol.vx, sol.vy, sol.vz) || 1;
    sw.d = { x: sol.vx / vl, y: sol.vy / vl, z: sol.vz / vl }; sw.speed = vl; sw.hit = true; sw.shotAim = aim;
    const wasServe = serveShot;
    R.struck = true; R.bounces = 0; R.cord = false; R.lastHit = p.id; R.lastTeam = p.team; R.hits++; R.tHit = s.t; R.side = -sideOf(p.team);
    if (wasServe) { R.serveDone = false; R.serveHit = true; } else R.serveDone = true;
    if (wasServe) s.phase = 'live';
    s.toss = null;
    ev('hit', { p: p.id, team: p.team, kind: sw.kind, tech: sw.tech, q, e: sw.e, cp: sw.cp, speed: vl, serve: wasServe, d: sw.d });
    s.cue = null;
    // AI: decide whether to move to the net behind this ball
    if (!(p.human)) {
      const lv = p.st.net;
      if (!wasServe && Math.abs(sw.cp.z) < SL + 1.0 && sw.kind !== 'lob' && aiRng.next() < lv) p.stance = 'net';
      else if (p.stance === 'net' && (sw.kind === 'lob' || Math.abs(sw.cp.z) > SL + 2)) p.stance = 'back';
      else if (wasServe && aiRng.next() < lv * 0.35) p.stance = 'net';
    }
    afterHit();
  }

  // ------------------------------------------------------------------------------------------------ a computer player decides its shot
  function decideShot(p, serveShot) {
    const foe = pOf(1 - p.id);
    let cp, tc, q;
    const side = sideOf(p.team);
    if (serveShot) {
      const t0 = s.toss ? s.toss.t0 : s.t;
      cp = { x: s.toss ? s.toss.x : p.x, y: TOSS_H, z: s.toss ? s.toss.z : p.z + p.dir * 0.4 }; tc = t0 + TOSS_UP; q = 0.9;
    } else {
      tc = Math.ceil((s.t + SWING_DELAY) / H - 1e-9) * H;
      const { b } = ballAt(tc); cp = { x: b.x, y: b.y, z: b.z };
      q = 1 - Math.pow(clamp(Math.abs(cp.y - 1.0) / 0.8, 0, 1), 1.3);
    }
    const sigma = p.st.aim * 0.55 + (1 - q) * 0.9;
    const kinds = serveShot ? [R.serveNo === 1 ? 'serve1' : 'serve2'] : undefined;
    const bias = {};
    if (!serveShot && p.stance === 'net') { bias.drop = 0.1; bias.lob = -0.2; }
    if (serveShot && R.serveNo === 1) { /* srv scales the aggression of the first serve */ }
    const list = evaluate({ cp, tc, q: Math.max(0.5, q), sigma: Math.min(sigma, 1.3), side, opps: [foe], serve: serveShot, kinds, surf, boxSign: R.boxSign, agg: serveShot ? 0.35 + 0.4 * p.st.srv : p.st.agg ?? 0.7, bias });
    const c = pick(list, serveShot ? Math.max(0.6, p.st.think) : p.st.think, pickRng);
    return { kind: c.kind, aim: c.aim, reason: reasonFor(c, { serve: serveShot, opps: [foe] }), summary: `${SHOTS[c.kind].name}: ${wordsFor(c.aim, c.kind)}`, cp, minSlack: c.minSlack, pf: c.pf };
  }

  // ------------------------------------------------------------------------------------------------ impacts and rules
  function onImpact(im) {
    if (im.kind === 'floor') ev('bounce', { x: im.x, y: im.y, z: im.z, speed: im.speed });
    else if (im.kind === 'net' || im.kind === 'cord') ev(im.kind, { x: im.x, y: im.y, z: im.z, speed: im.speed });
    const rs = { serve: R.serve && !R.serveDone, side: R.side, boxSign: R.boxSign, bounces: R.bounces, cord: R.cord };
    const j = judgeOne(rs, im);
    R.bounces = rs.bounces; R.cord = rs.cord;
    if (j) fault(j);
  }
  function judgeOne(rs, im) { return judge(rs, im); }
  function fault(j) {
    if (s.phase !== 'live') return;
    const hitterTeam = R.lastTeam;
    if (j.let) { s.last = { t: s.t, kind: 'let', text: 'Let: the serve clipped the net. Serve again.', winner: -1 }; s.faultCarry = R.serveNo - 1; ev('let', {}); endLive(true); return; }
    const isServeFlight = R.serve && !R.serveDone;
    if (isServeFlight && j.by === 'hitter') {
      if (R.serveNo < 2 && !cfg.drill) {
        s.faultCarry = R.serveNo; s.match.stats[hitterTeam].faults++;
        ev('serveFault', { team: hitterTeam, text: j.reason, serveNo: R.serveNo });
        s.last = { t: s.t, kind: 'fault', text: `${j.reason}. Second serve.`, winner: -1, fault: true };
        endLive(true); return;
      }
      s.match.stats[hitterTeam].doubles++;
      s.faultCarry = 0;
      score(1 - hitterTeam, 'Double fault', 'double');
      return;
    }
    const winner = j.by === 'hitter' ? 1 - hitterTeam : hitterTeam;
    s.faultCarry = 0;
    if (j.by === 'receiver') { s.match.stats[winner].winners++; if (R.serve && R.hits === 1) { s.match.stats[winner].aces++; } }
    else s.match.stats[hitterTeam].errors++;
    score(winner, j.by === 'receiver' && R.hits === 1 && isServeFlight ? 'Ace' : j.reason, j.by);
  }
  function endLive(replaySame) {
    s.phase = 'dead'; s.phaseT = 0; s.replay = replaySame; s.ball.vis = true;
    for (const p of players) { p.press = null; p.target = homeOf(p); }
    s.cue = null;
  }
  function score(winner, text, how) {
    const m = s.match;
    m.rallies++; m.longest = Math.max(m.longest, R.hits);
    if (cfg.drill) { if (s.drill.kind === 'serve') s.drill.fed++; ev('point', { winner, text, how, drill: true, hits: R.hits, lastHit: R.lastHit }); s.last = { t: s.t, kind: 'point', text, winner }; endLive(false); return; }
    const prevGames = [...sc.games];
    const r = awardPoint(sc, winner);
    m.history.push({ w: winner, text, hits: R.hits });
    ev('point', { winner, text, how, hits: R.hits, game: r.game, set: r.set });
    s.last = { t: s.t, kind: r.set ? 'set' : r.game ? 'game' : 'point', text: `${text}.`, winner, game: r.game, prevGames };
    if (r.set) { m.over = true; m.winner = sc.winner; ev('matchEnd', { winner: sc.winner }); }
    else if (r.game) ev('game', { winner, games: [...sc.games] });
    endLive(false);
  }

  // ------------------------------------------------------------------------------------------------ players
  function movePlayers() {
    const ph = s.phase;
    for (const p of players) {
      const sw = p.swing;
      let swinging = false;
      if (sw && s.t < sw.t1) {
        swinging = true;
        const u = (s.t - sw.t0) / Math.max(1e-6, sw.tc - sw.t0);
        if (u < 1 && !sw.serve) {
          const uu = clamp(u, 0, 1), u2 = uu * uu, u3 = u2 * uu;
          const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + uu, h01 = -2 * u3 + 3 * u2;
          const Tt = sw.tc - sw.t0;
          const nx = h00 * sw.p0.x + h10 * Tt * sw.p0.vx + h01 * sw.S.x, nz = h00 * sw.p0.z + h10 * Tt * sw.p0.vz + h01 * sw.S.z;
          p.vx = (nx - p.x) / H; p.vz = (nz - p.z) / H; p.x = nx; p.z = nz;
        } else { if (!sw.serve) { p.x = sw.S.x; p.z = sw.S.z; } p.vx = 0; p.vz = 0; }
      }
      if (!swinging) {
        let dvx = 0, dvz = 0;
        const isU = p.human;
        if (!(isU && !s.ctl.auto && (ph === 'live' || ph === 'serve'))) {
          const dx = p.target.x - p.x, dz = p.target.z - p.z, d = Math.hypot(dx, dz);
          const reactDelay = ph === 'live' && R && s.t - R.tHit < p.st.react;
          if (d > 0.03 && !reactDelay) { const sp = Math.min(p.st.spd * (ph === 'ready' ? 0.7 : 1), d / 0.16); dvx = dx / d * sp; dvz = dz / d * sp; }
        }
        const ax = dvx - p.vx, az = dvz - p.vz, al = Math.hypot(ax, az), maxA = 19 * H;
        if (al > maxA) { p.vx += ax / al * maxA; p.vz += az / al * maxA; } else { p.vx = dvx; p.vz = dvz; }
        p.x += p.vx * H; p.z += p.vz * H;
      }
      p.x = clamp(p.x, -HW - RUN_X, HW + RUN_X);
      p.z = sideOf(p.team) < 0 ? clamp(p.z, -HL - RUN_Z, -0.95) : clamp(p.z, 0.95, HL + RUN_Z);
    }
    for (const p of players) {
      const sp = Math.hypot(p.vx, p.vz), base = faceBase(p);
      let want = base;
      if (p.swing && s.t < p.swing.t1 + 0.1) want = p.swing.faceYaw ?? base;
      else if (sp > 2.2) want = Math.atan2(p.vx, p.vz);
      let d = want - p.face; d = Math.atan2(Math.sin(d), Math.cos(d));
      const rate = (p.swing && s.t < p.swing.t1 ? 16 : 9) * H;
      p.face += clamp(d, -rate * 2, rate * 2) * (Math.abs(d) > 0.02 ? 1 : 0.3);
      p.face = Math.atan2(Math.sin(p.face), Math.cos(p.face));
    }
  }

  // ------------------------------------------------------------------------------------------------ Watch & Learn holds
  let holdId = 0;
  const holdFor = (p, dec, serve) => { s.hold = { id: ++holdId, who: p.id, team: p.team, serve, decision: dec, t: s.t }; };

  // ------------------------------------------------------------------------------------------------ one sub-step
  function sub() {
    if (s.hold) return;
    s.n++; s.t = s.n * H;
    const ph = s.phase;
    if (ph === 'ready') {
      s.phaseT += H;
      if (s.phaseT >= READY_T) { if (cfg.drill && s.drill.kind !== 'serve') feedBall(); else startServePhase(); }
    } else if (ph === 'serve') {
      s.phaseT += H;
      const sv = pOf(R.server), isU = sv.human;
      if (!s.toss) {
        placeBallInHand(); if (!isU) pendSwing = null; else if (pendSwing) pendSwing = null;
        if ((pendToss && isU) || (!isU && s.t >= s.serve.tToss)) { pendToss = false; startToss(); }
      } else serveUpdate(sv, isU);
    } else if (ph === 'live') {
      if (s.toss) serveUpdate(pOf(R.server), pOf(R.server).human);
      if (pendSwing) {
        const hp = players.find((p) => p.human);
        const g = pendSwing; pendSwing = null;
        if (hp && !s.toss) startFromGesture(hp, g);
      }
      for (const p of players) {
        if (p.human || p.swing && s.t < p.swing.t1) continue;
        if (p.press && s.t >= p.press.t && !s.toss) {
          if (!p.dec) { p.dec = decideShot(p, false); if (cfg.watch) { holdFor(p, p.dec, false); break; } }
          const d1 = p.dec; p.dec = null;
          startSwing(p, d1.kind, d1.aim);
        }
      }
      if (s.n % 12 === 0) for (const p of players) { if (R.claim === p.id || (p.swing && s.t < p.swing.t1)) continue; p.target = R.lastTeam === p.team ? recoverTarget(p) : homeOf(p); }
      for (const p of players) { const sw = p.swing; if (sw && !sw.done && !sw.serve && s.t >= sw.tc - 1e-9) { if (sw.contact) applyContact(p, sw); else { sw.done = true; ev('whiff', { p: p.id, why: sw.why, tc: sw.tc }); } } }
      stepLive();
    } else if (ph === 'dead') {
      s.phaseT += H;
      if (s.phaseT >= DEAD_T) nextPoint();
    }
    movePlayers();
  }
  // the serve toss in flight (phase 'serve' once the toss started, or 'live' never for a toss; the strike moves the phase to 'live')
  function serveUpdate(sv, isU) {
    const b = s.ball, u = s.t - s.toss.t0;
    b.y = tossY(u); b.x = s.toss.x; b.z = s.toss.z; b.vx = b.vy = b.vz = 0;
    // the strike
    if (isU && pendSwing) {
      const g = pendSwing; pendSwing = null;
      const sh = shotFromDrag(g.dx, g.dy, sideOf(sv.team), true, R.boxSign, R.serveNo);
      let kind = sh.kind, aim = sh.aim;
      if (g.assist) { kind = g.assist.kind; aim = g.assist.aim; }
      else if (g.tap && s.autoAim && s.ctl.autoAim) { kind = s.autoAim.kind; aim = s.autoAim.aim; }
      startServeSwing(sv, kind, aim);
    } else if (!isU && sv.press && s.t >= sv.press.t && !(sv.swing && s.t < sv.swing.t1)) {
      if (!sv.dec) { sv.dec = decideShot(sv, true); if (cfg.watch) { holdFor(sv, sv.dec, true); return; } }
      const d1 = sv.dec; sv.dec = null;
      startServeSwing(sv, d1.kind, d1.aim);
    }
    const sw = sv.swing;
    if (sw && sw.serve && !sw.done && s.t >= sw.tc - 1e-9) { if (sw.contact) { s.phase = 'live'; applyContact(sv, sw); } else { sw.done = true; ev('whiff', { p: sv.id, why: sw.why, tc: sw.tc, serve: true }); } }
    // a toss that is not struck is caught and thrown again (no fault)
    if (s.toss && s.phase === 'serve' && u > TOSS_UP + 0.5) {
      s.toss = null; s.ball.tossing = false; s.ball.held = true; sv.swing = null; sv.press = null; s.cue = null;
      s.serve.tToss = s.t + 0.5 + aiRng.next() * 0.5; ev('tossReset', {});
    }
  }
  function startFromGesture(hp, g) {
    let kind, aim;
    const sh = shotFromDrag(g.dx, g.dy, sideOf(hp.team), false);
    if (g.assist) { kind = g.assist.kind; aim = g.assist.aim; }
    else if (sh.tap) { if (s.autoAim && s.ctl.autoAim) { kind = s.autoAim.kind; aim = s.autoAim.aim; } else { kind = 'slice'; aim = { x: clamp(-s.ball.x * 0.6, -1.8, 1.8), z: -sideOf(hp.team) * 6.0 }; } }
    else { kind = sh.kind; aim = sh.aim; }
    startSwing(hp, kind, aim);
  }
  function stepLive() {
    if (s.phase !== 'live') return;
    const b = s.ball;
    if (b.tossing) return;
    const evs = stepBall(b, H, surf);
    spinBall(b);
    if (evs.length) for (const im of evs) { if (s.phase !== 'live') break; onImpact(im); }
  }
  function spinBall(b) {
    const wl = Math.hypot(b.wx, b.wy, b.wz);
    if (wl < 1e-6) return;
    const a = wl * H * 0.5, k = Math.sin(a) / wl, q = b.rot;
    const dx = b.wx * k, dy = b.wy * k, dz = b.wz * k, dw = Math.cos(a);
    const x = dw * q[0] + dx * q[3] + dy * q[2] - dz * q[1], y = dw * q[1] - dx * q[2] + dy * q[3] + dz * q[0], z = dw * q[2] + dx * q[1] - dy * q[0] + dz * q[3], w = dw * q[3] - dx * q[0] - dy * q[1] - dz * q[2];
    const l = Math.hypot(x, y, z, w) || 1;
    q[0] = x / l; q[1] = y / l; q[2] = z / l; q[3] = w / l;
  }
  function nextPoint() {
    if (s.match.over) { s.phase = 'over'; return; }
    if (cfg.drill) {
      if (s.drill.fed >= s.drill.n) { s.phase = 'over'; ev('drillEnd'); return; }
      placeForPoint();
      if (s.drill.kind !== 'serve') s.phaseT = READY_T - 0.3;
      return;
    }
    placeForPoint();
  }

  placeForPoint();
  s.prev = snapshot();
  function trailPt() { const b = s.ball; return { t: s.t, x: b.x, y: b.y, z: b.z }; }
  function snapshot() { return { t: s.t, ball: { x: s.ball.x, y: s.ball.y, z: s.ball.z }, players: players.map((p) => ({ x: p.x, z: p.z, face: p.face })) }; }

  // ------------------------------------------------------------------------------------------------ the API
  const api = {
    s, cfg,
    update(dt) {
      s.prev = snapshot();
      s.trail.length = 0; s.trail.push(trailPt());
      acc += dt * pace;
      let n = Math.floor(acc / H + 1e-9);
      acc -= n * H;
      while (n-- > 0) { sub(); if (s.ball.vis) s.trail.push(trailPt()); }
    },
    // ---- human input (set by game.js each tick)
    setStance(st) { s.ctl.stance = st; const hp = players.find((p) => p.human || p.isUser); if (hp) hp.stance = st; },
    pressToss() { pendToss = true; },
    release(g) { pendSwing = g; },                         // g = { dx, dy, tap, assist }
    releaseHold() { s.hold = null; },
    humanPlayer() { return players.find((p) => p.human || p.isUser) || null; },
    servingHuman() { const hp = players.find((p) => p.human); return !!(hp && s.phase === 'serve' && s.serve && s.serve.server === hp.id); },
    // ---- Think: the best shot for the human right now (or a note when nothing is to be done)
    suggest() {
      const hp = players.find((p) => p.human);
      if (!hp) return null;
      const foe = pOf(1 - hp.id), side = sideOf(hp.team);
      if (api.servingHuman()) {
        const kind = R.serveNo === 1 ? 'serve1' : 'serve2';
        const cp = { x: hp.x, y: TOSS_H, z: hp.z + hp.dir * 0.4 };
        const list = evaluate({ cp, tc: s.t + 1.2, q: 0.9, sigma: 0.3, side, opps: [foe], serve: true, kinds: [kind], surf, boxSign: R.boxSign });
        const c = list[0];
        const dr = dragFor(c.kind, c.aim, side, R.boxSign);
        return { kind: c.kind, aim: c.aim, reason: `${reasonFor(c, { serve: true, opps: [foe] })} ${dragWords(dr)}`, summary: `${SHOTS[c.kind].name}: ${wordsFor(c.aim, c.kind)}`, serve: true };
      }
      if (s.phase === 'live' && A && A.ta !== null && R.struck && R.lastTeam !== hp.team) {
        const pl = hp.plan || planFor(hp, F, A, s.t);
        if (!pl) return { kind: null, reason: 'The ball cannot be reached: let it go.', summary: 'Let it go' };
        const list = evaluate({ cp: pl.cp, tc: pl.t, q: 0.9, sigma: 0.3, side, opps: [foe], serve: false, surf });
        const c = list[0];
        const dr = dragFor(c.kind, c.aim, side);
        let reason = `${reasonFor(c, { serve: false, opps: [foe] })} ${dragWords(dr)}`;
        if (!pl.ok) reason = 'This ball is hard to reach: it will take everything. ' + reason;
        return { kind: c.kind, aim: c.aim, reason, summary: `${SHOTS[c.kind].name}: ${wordsFor(c.aim, c.kind)}` };
      }
      return { kind: null, reason: 'Nothing to hit yet. Watch where the ball bounces; the player runs to it. Release your drag as the ring closes.', summary: 'Wait and watch' };
    },
    saveData() { return { pts: [...sc.pts], games: [...sc.games], tb: sc.tb, server: sc.server, tbServer: sc.tbServer, gamesPlayed: sc.gamesPlayed, rallies: s.match.rallies, stats: JSON.parse(JSON.stringify(s.match.stats)) }; },
    forecast: () => F, analysis: () => A, rallyState: () => R,
    previewShot(cp, aim, kind, q = 0.9) { const sol = solveShot(cp, aim, kind, q, surf); if (!sol) return null; const f = forecast(newBall(cp.x, cp.y, cp.z, sol.vx, sol.vy, sol.vz, sol.wx, sol.wy, sol.wz), { maxT: 2.2, surf }); return { cp, f, sol }; },
  };
  return api;
}

function dragWords(dr) {
  const side = Math.abs(dr.dx) < 25 ? 'straight' : dr.dx > 0 ? `${Math.abs(dr.dx) > 90 ? 'well ' : ''}to the right` : `${Math.abs(dr.dx) > 90 ? 'well ' : ''}to the left`;
  const len = dr.dy > 20 ? 'Drag down' : Math.abs(dr.dy) > 150 ? 'Drag a long way up' : Math.abs(dr.dy) > 85 ? 'Drag up a medium way' : 'Drag up a short way';
  return `${len}, ${side}.`;
}

// the rules judge lives in plan.js; imported late to keep the sim readable
import { judgeImpact as judge } from './plan.js';
export { pointText, courtOf, serverOf, NET_C, BR };

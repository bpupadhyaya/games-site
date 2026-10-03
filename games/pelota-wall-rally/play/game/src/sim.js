// The match: players, rally, serve, rules, scoring, swings, computer players. Pure and deterministic (fixed sub-step, seeded streams).
// The presenter and the HUD only READ `sim.s`. Contact times are exact: a swing is committed at press time and the ball is struck on the
// sub-step grid at tc; the 3D layer retimes its animation to land the hand (or paddle) on the ball at exactly that time.
import { HW, L, BR, SHORT, TIN, TOP, SHOTS, SHOT_IDS, SERVE_SHOT_IDS, EQUIP, LEVELS, PHYS, SWING_DELAY, SWING_TAIL, WINDOW, MATCH_POINTS, PACE } from './consts.js';
import { newBall, cloneBall, stepBall, forecast } from './physics.js';
import { solveShot, frontAim } from './shots.js';
import { judgeImpact, analyse, planFor, stanceFor } from './plan.js';
import { evaluate, pick, reasonFor } from './ai.js';
import { clamp, normal, smooth } from './util.js';
import { initialCam } from './camera.js';

const H = PHYS.h;
const READY_T = 1.1, DEAD_T = 2.1;
export const HOMES = {
  solo: [{ x: 0.7, z: 4.4 }, { x: -0.7, z: 4.2 }],
  front: [{ x: 1.0, z: 6.4 }, { x: -1.0, z: 6.2 }],
  back: [{ x: 0.8, z: 3.0 }, { x: -0.8, z: 2.8 }],
};
const SERVE_SPOT = [{ x: 1.1, z: 2.3 }, { x: -1.1, z: 2.3 }];
export const DEFAULT_AIM = { drive: { x: 0.4, y: 2.3 }, power: { x: 0.4, y: 2.7 }, drop: { x: 0.2, y: 1.15 }, lob: { x: 0.2, y: 3.7 } };
const HUMAN_ST = { spd: 5.0, agg: 0.5, react: 0, timing: 0, aim: 0.1, think: 1, cover: 1, err: 0, lunge: 1 };

export function createSim(cfg0, rng) {
  const cfg = { mode: '1v1', equip: 'hand', role: 'front', level: 3, partner: 0, points: MATCH_POINTS.full, pace: 'normal', watch: false, watchLevels: [3, 3], drill: null, firstServer: 0, resume: null, ...cfg0 };
  const equip = EQUIP[cfg.equip] ? cfg.equip : 'hand';
  const pace = PACE[cfg.pace] ?? 1;
  const aiRng = rng.fork(), noiseRng = rng.fork(), pickRng = rng.fork();
  const doubles = cfg.mode === '2v2' && !cfg.drill;
  const partnerLevel = cfg.partner || clamp(cfg.level, 2, 4);

  // ------------------------------------------------------------------------------------------------ players
  const players = [];
  const mk = (team, role, lvl, human, idx) => {
    const st = human ? { ...HUMAN_ST } : { ...LEVELS[clamp(lvl, 1, 5) - 1] };
    const home = HOMES[role][team];
    const lefty = !human && (aiRng.next() < 0.22);
    const p = { id: players.length, team, role, human, level: human ? 0 : lvl, st, lefty, x: home.x, z: home.z, vx: 0, vz: 0, face: 0, home: { ...home }, target: { ...home }, swing: null, plan: null, press: null, idx, look: 0, phase: aiRng.next() * 6.28 };
    players.push(p);
    return p;
  };
  const human = !cfg.watch && !cfg.bot;
  if (cfg.drill) mk(0, 'solo', 3, true, 0);
  else if (doubles) {
    const fr = cfg.role === 'front';
    mk(0, 'front', fr ? 0 : partnerLevel, human && fr, 0); mk(0, 'back', fr ? partnerLevel : 0, human && !fr, 1);
    mk(1, 'front', cfg.level, false, 0); mk(1, 'back', cfg.level, false, 1);
    if (cfg.watch) { players[0].st = { ...LEVELS[cfg.watchLevels[0] - 1] }; players[1].st = { ...LEVELS[cfg.watchLevels[0] - 1] }; players[2].st = { ...LEVELS[cfg.watchLevels[1] - 1] }; players[3].st = { ...LEVELS[cfg.watchLevels[1] - 1] }; for (const p of players) p.human = false; }
  } else {
    mk(0, 'solo', cfg.watch ? cfg.watchLevels[0] : cfg.bot ? 4 : 0, human, 0);
    mk(1, 'solo', cfg.watch ? cfg.watchLevels[1] : cfg.level, false, 0);
    if (cfg.watch) players[0].st = { ...LEVELS[cfg.watchLevels[0] - 1] };
  }
  if (cfg.bot) { const u = doubles ? players.find((p) => p.role === cfg.role && p.team === 0) : players[0]; u.isUser = true; }
  if (cfg.bot && doubles) { for (const p of players) if (p.team === 0) p.st = { ...LEVELS[3] }; }
  const teamPlayers = (t) => players.filter((p) => p.team === t);
  const pOf = (id) => players[id];

  // ------------------------------------------------------------------------------------------------ state
  const s = {
    n: 0, t: 0, phase: 'ready', phaseT: 0, cfg: { mode: cfg.mode, equip, points: cfg.points, pace: cfg.pace, role: cfg.role, level: cfg.level, watch: !!cfg.watch, drill: cfg.drill ? cfg.drill.kind : null },
    equip, doubles, players, cam: initialCam(),
    ball: { x: 0, y: 1.1, z: 3, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, vis: false, held: false, rot: [0, 0, 0, 1] },
    prev: null, trail: [],
    rally: null,                                   // the rally in progress (see newRally)
    match: { pts: [0, 0], target: cfg.points, serving: cfg.firstServer, srv: [0, 0], over: false, winner: -1, rallies: 0, history: [], stats: [{ winners: 0, errors: 0, aces: 0, faults: 0 }, { winners: 0, errors: 0, aces: 0, faults: 0 }], longest: 0, firstServer: cfg.firstServer },
    events: [], eid: 0, last: null, cue: null,
    ctl: { stickX: 0, stickZ: 0, stick: false, kind: 'drive', aim: null, aimSet: false, auto: true, autoAim: true }, autoAim: null,
    drill: cfg.drill ? { ...cfg.drill, fed: 0, n: cfg.drill.n || 6 } : null,
    hold: null,                                    // Watch & Learn: a pending decision the presenter / game may pause on
    msg: null,
  };
  if (cfg.resume) { const r = cfg.resume; s.match.pts = [...r.pts]; s.match.serving = r.serving; s.match.srv = [...(r.srv || [0, 0])]; s.match.rallies = r.rallies | 0; s.match.firstServer = r.firstServer | 0; s.match.stats = r.stats ? JSON.parse(JSON.stringify(r.stats)) : s.match.stats; }
  s.ctl.aim = { wall: 'front', ...DEFAULT_AIM.drive };

  let acc = 0, F = null, A = null, pendSwing = false, pendDrop = false, R = null;
  const ev = (type, o = {}) => { const e = { id: s.eid++, t: s.t, type, ...o }; s.events.push(e); if (s.events.length > 160) s.events.splice(0, s.events.length - 120); return e; };

  function newRally(serve, server) {
    return { serve, server, struck: false, preBounces: 0, frontHit: false, leftFirst: false, bounces: 0, lastHit: -1, lastTeam: -1, hits: 0, faults: 0, serveIdeal: null, tHit: 0, tIdeal: null, claim: -1, ace: true };
  }
  const publicRally = () => { s.rally = R; };

  // ------------------------------------------------------------------------------------------------ rally set-up and serving
  function placeForPoint() {
    const sv = s.match.serving, srvIdx = doubles ? s.match.srv[sv] : 0;
    const team = teamPlayers(sv);
    const server = team[srvIdx] || team[0];
    R = newRally(true, server.id);
    R.faults = (s.faultCarry | 0);
    if (!s.replay) s.letDone = false;
    publicRally();
    for (const p of players) {
      p.swing = null; p.plan = null; p.press = null; p.vx = 0; p.vz = 0;
      const h = HOMES[p.role][p.team];
      p.home = { x: h.x, z: h.z };
      p.target = p.id === server.id ? { ...SERVE_SPOT[sv] } : p.team === sv ? { x: -SERVE_SPOT[sv].x * 1.1, z: 1.1 } : { ...p.home };
    }
    s.ball.vis = false; s.ball.held = true; s.cue = null;
    s.phase = 'ready'; s.phaseT = 0; s.hold = null;
    F = null; A = null;
  }
  function startServePhase() {
    s.phase = 'serve'; s.phaseT = 0;
    const sv = pOf(R.server);
    s.serve = { server: sv.id, tDrop: s.t + (sv.human ? 1e9 : 0.7 + aiRng.next() * 0.5), tPrompt: s.t };
    s.ball.held = true; s.ball.vis = true;
    holdBall();
    if (cfg.drill && cfg.drill.kind !== 'serve') feedBall();
    ev('ready', { server: sv.id });
  }
  function holdBall() {
    const sv = pOf(R.server), m = sv.lefty ? -1 : 1;
    s.ball.x = sv.x - m * 0.28; s.ball.z = sv.z + 0.18; s.ball.y = 1.05; s.ball.vx = s.ball.vy = s.ball.vz = 0;
  }
  function dropBall() {
    if (s.phase !== 'serve') return;
    const sv = pOf(R.server);
    s.ball.held = false; s.ball.vis = true;
    s.ball.vx = 0; s.ball.vy = -5.2; s.ball.vz = 0.9; s.ball.wx = s.ball.wy = s.ball.wz = 0;
    s.phase = 'live';
    R.tHit = s.t;
    if (cfg.drill) s.drill.fed++;
    // the serve ball bounces once; its best moment to strike is when it falls back through about 0.85 m
    const f = forecast(s.ball, { maxT: 1.6, t0: s.t, frontHit: false });
    let kb = -1; for (const im of f.impacts) if (im.kind === 'floor') { kb = im.k; break; }
    let ideal = null;
    if (kb >= 0) for (let k = kb + 4; k <= f.n; k++) { if (f.vy[k] < 0 && f.ys[k] <= 0.85) { ideal = f.t0 + k * f.h; break; } if (k === f.n) ideal = f.t0 + k * f.h; }
    R.serveIdeal = ideal; R.serveBounceT = kb >= 0 ? f.t0 + kb * f.h : null;
    s.autoAim = null;
    if (sv.human && ideal && s.ctl.autoAim) {
      const ci = Math.min(f.n, Math.round((ideal - f.t0) / f.h)), cp0 = { x: f.xs[ci], y: f.ys[ci], z: f.zs[ci] };
      const list = evaluate({ cp: cp0, tc: ideal, equip, q: 0.8, sigma: 0.4, opps: players.filter((o) => o.team !== sv.team), serve: true, agg: 0.4 });
      const aa = {}; for (const c of list) if (!aa[c.kind] && !c.fault) aa[c.kind] = c.aim; s.autoAim = aa;
    }
    F = f; A = null;
    ev('drop', { p: sv.id });
    // the server steps to the ball
    if (!sv.human) sv.press = { t: ideal - SWING_DELAY + normal(noiseRng) * sv.st.timing, kind: null };
    s.cue = ideal ? { team: sv.team, who: sv.id, tIdeal: ideal, tPress: ideal - SWING_DELAY, serve: true } : null;
    for (const p of players) if (p.team !== sv.team) p.target = { ...p.home };
  }
  function feedBall() {
    // ball machine for drills: a ball arrives from the front wall, in play
    const d = s.drill, k = d.kind, i = d.fed++;
    const fr = (n) => ((i * 0.6180339887 + n) % 1);
    const x = -2 + 4 * fr(0.1);
    let vz = -11 - 3 * fr(0.5), vy = 2 + 2 * fr(0.8), y = 1.7;
    if (k === 'rebote') { vz = -14.5; vy = 0.5; y = 1.5; }
    if (k === 'angle') { vz = -12; }
    s.ball.held = false; s.ball.vis = true;
    Object.assign(s.ball, { x, y, z: L - 0.9, vx: (fr(0.3) - 0.5) * 3, vy, vz, wx: 0, wy: 0, wz: 0 });
    R = newRally(false, -1); R.struck = true; R.frontHit = true; R.lastTeam = 1; R.lastHit = -1; R.tHit = s.t;
    publicRally();
    s.phase = 'live';
    afterHit();
    ev('feed', { i });
  }

  // ------------------------------------------------------------------------------------------------ forecast and plans
  function refreshForecast() {
    F = forecast(s.ball, { maxT: 4.2, t0: s.t, frontHit: R.frontHit, bounces: R.bounces });
    A = analyse(F, { serve: R.serve && R.struck, frontHit: R.frontHit, bounces: R.bounces });
    R.tIdeal = A.tIdeal;
  }
  function afterHit() {
    refreshForecast();
    replan();
  }
  const zonePenalty = (p, cp) => (p.role === 'front' ? (cp.z < 4.8 ? 0.45 : 0) : p.role === 'back' ? (cp.z > 5.2 ? 0.45 : 0) : 0);
  function replan() {
    for (const p of players) { p.plan = null; p.press = null; }
    R.claim = -1;
    if (!A || A.ta === null) { for (const p of players) p.target = { ...p.home }; s.cue = null; return; }
    const recv = 1 - R.lastTeam;
    const mine = teamPlayers(recv);
    let best = null;
    for (const p of mine) {
      const pl = planFor(p, F, A, s.t, equip);
      if (!pl) continue;
      p.plan = pl;
      const c = pl.cost + zonePenalty(p, pl.cp) + (p.human ? -0.15 : 0) + (pl.ok ? 0 : 3);
      if (!best || c < best.c) best = { p, c, pl };
    }
    R.claim = best ? best.p.id : -1;
    for (const p of players) {
      if (p.team !== recv) { p.target = recoverTarget(p); continue; }
      if (best && p === best.p) { p.target = { x: best.pl.S.x, z: best.pl.S.z }; if (!p.human) p.press = { t: Math.max(s.t + 0.02, best.pl.t - SWING_DELAY + normal(noiseRng) * p.st.timing + (best.pl.ok ? 0 : 0)), kind: null }; }
      else p.target = avoidPath(coverTarget(p));
    }
    // the cue shown to a human on the team that must strike next
    const hp = mine.find((p) => p.human || p.isUser);
    s.cue = hp ? { team: recv, who: hp.id, tIdeal: A.tIdeal, tPress: A.tIdeal - SWING_DELAY, claim: best && best.p === hp, cp: best && best.p === hp ? best.pl.cp : (hp.plan ? hp.plan.cp : null), serve: false } : null;
    // auto aim: a sensible target for each shot kind, computed for the human's own contact
    s.autoAim = null;
    if (hp && s.ctl.autoAim && best && best.p === hp) {
      const opps = players.filter((o) => o.team !== hp.team);
      const list = evaluate({ cp: best.pl.cp, tc: best.pl.t, equip, q: 0.8, sigma: 0.4, opps, serve: false, agg: 0.4, role: hp.role });
      const aa = {};
      for (const c of list) if (!aa[c.kind] && !c.fault) aa[c.kind] = c.aim;
      s.autoAim = aa;
      // the shot kind follows the role until the player picks a chip: front plays drops from the front half, back lobs and drives deep
      if (!s.ctl.kindManual && doubles && list.length) { const top = list.find((c) => !c.fault); if (top) s.ctl.kind = top.kind; }
    }
    // backup: if the human is the claimant, the computer partner may step in when the human is late
    s.backup = null;
    if (hp && doubles) { const partner = mine.find((p) => !p.human); if (partner && partner.plan && partner.plan.ok) s.backup = { id: partner.id, tCheck: (best && best.p === hp ? best.pl.t : A.tIdeal) - SWING_DELAY + 0.22 }; }
    if (!hp && !cfg.watch) { /* computer vs computer: nothing to cue */ }
  }
  function recoverTarget(p) {
    return avoidPath(recoverTarget0(p));
  }
  function recoverTarget0(p) {
    const lv = p.st.cover;
    const h = p.home;
    // the further the ball went away, the more a good player recovers towards the centre
    const cx = lerp2(h.x, h.x * 0.55 + (R && s.ball.x ? clamp(s.ball.x * 0.2, -0.8, 0.8) : 0), lv);
    return { x: cx, z: h.z };
  }
  const lerp2 = (a, b, t) => a + (b - a) * t;
  function coverTarget(p) { return { x: p.home.x * 0.9, z: p.home.z }; }
  // keep clear of the ball's flight path (a ball that strikes a body is a let)
  function avoidPath(tg) {
    if (!F) return tg;
    let x = tg.x, z = tg.z;
    const k0 = Math.max(0, Math.round((s.t - F.t0) / F.h));
    for (let it = 0; it < 2; it++) {
      let worst = null;
      for (let k = k0; k <= F.n && k < k0 + 300; k += 10) {
        const px = F.xs[k], py = F.ys[k], pz = F.zs[k];
        if (py > 2.0) continue;
        const d = Math.hypot(px - x, pz - z);
        if (d < 1.2 && (!worst || d < worst.d)) worst = { d, px, pz };
      }
      if (!worst) break;
      const dx = x - worst.px, dz = z - worst.pz, dl = Math.hypot(dx, dz) || 1;
      x += dx / dl * (1.25 - worst.d); z += dz / dl * (1.25 - worst.d);
    }
    return { x: clamp(x, -HW + 0.4, HW - 0.55), z: clamp(z, 0.8, L - 1.8) };
  }
  // every so often the players who are not striking move clear of the ball's remaining path
  function refreshAvoid() {
    if (!F || s.phase !== 'live') return;
    for (const p of players) {
      if (R.claim === p.id || (p.swing && s.t < p.swing.t1)) continue;
      if (p.human && s.ctl.stick) continue;
      const base = p.team === 1 - R.lastTeam ? coverTarget(p) : recoverTarget0(p);
      p.target = avoidPath(base);
    }
  }

  // ------------------------------------------------------------------------------------------------ swings
  /** Start a swing for player p now. Returns the swing (or null when busy). */
  function startSwing(p, kind, aim) {
    if (p.swing && s.t < p.swing.t1) return null;
    if (s.phase !== 'live' && s.phase !== 'serve') return null;
    if (s.phase === 'serve') return null;
    const tPress = s.t;
    const tc = Math.ceil((tPress + SWING_DELAY) / H - 1e-9) * H;
    // look ahead with the real physics to where the ball will be at tc
    const b = cloneBall(s.ball);
    const steps = Math.round((tc - s.t) / H);
    let floors = 0;
    for (let k = 0; k < steps; k++) { const e = stepBall(b, H); if (e.length) for (const x of e) if (x.kind === 'floor') floors++; }
    const cp = { x: b.x, y: b.y, z: b.z };
    const serveShot = R.serve && !R.struck;
    let playable = false, why = '';
    if (serveShot) { playable = p.id === R.server && R.preBounces + floors >= 1 && R.preBounces + floors <= 1; why = playable ? '' : (R.preBounces + floors < 1 ? 'early' : 'late'); }
    else if (R.struck && p.team !== R.lastTeam && R.lastTeam >= 0 || (R.struck && cfg.drill && p.team !== R.lastTeam)) {
      if (A && A.ta !== null && tc >= A.ta && tc <= A.tb) playable = true;
      else why = A && A.ta !== null && tc < A.ta ? 'early' : 'late';
    } else why = 'not your turn';
    const maxY = equip === 'paddle' ? 2.15 : 1.92;
    let dirEst = null;
    if (aim && (playable || serveShot)) { const so = solveShot(cp, aim, kind, equip, 0.85); const vl = Math.hypot(so.vx, so.vy, so.vz) || 1; dirEst = { x: so.vx / vl, y: so.vy / vl, z: so.vz / vl }; }
    const S = stanceFor(p, cp, equip, p, dirEst);
    const d = Math.hypot(S.x - p.x, S.z - p.z);
    const maxD = 0.5 + p.st.spd * SWING_DELAY * 0.95 * (p.st.lunge || 1);
    let contact = playable && cp.y >= (kind === 'lob' ? 0.46 : 0.34) && cp.y <= maxY && d <= maxD && Math.hypot(cp.x - S.x, cp.z - S.z) < 0.8 && cp.x > -HW && cp.x < HW - 0.05 && cp.z > 0.62 && cp.z < L - 0.85;
    if (playable && !contact) why = d > maxD ? 'reach' : 'height';
    // quality: timing against the ideal moment, stretch to reach it, height
    const tIdeal = serveShot ? R.serveIdeal : (A ? A.tIdeal : null);
    const e = tIdeal === null || tIdeal === undefined ? 0.1 : tc - tIdeal;
    // quality: where the ball is when it is struck (waist height is best: that is when the ring closes), how far the player had to stretch, how fast it comes
    const bsp = Math.hypot(b.vx, b.vy, b.vz);
    const qt = 1 - Math.pow(clamp(Math.abs(cp.y - (serveShot ? 0.9 : 0.95)) / 0.75, 0, 1), 1.3);
    const qs = 1 - clamp((d - 0.6) / Math.max(0.2, maxD - 0.6), 0, 1) * 0.5;
    const qh = 1 - clamp((bsp - 13) / 25, 0, 0.3);
    const q = contact ? clamp(qt * qs * qh, 0, 1) : 0;
    const sw = { id: s.eid, p: p.id, t0: s.t, tc, t1: tc + SWING_TAIL, kind, aim, tech: S.tech, back: S.back, S: { x: S.x, z: S.z }, p0: { x: p.x, z: p.z, vx: p.vx, vz: p.vz }, cp, contact, q, qt, e, why, hit: false, done: false, serve: serveShot, lefty: p.lefty };
    if (!contact) {                       // a whiff reaches for a spot that is NOT the ball
      const m = p.lefty ? -1 : 1;
      sw.cp = { x: S.x - m * 0.5, y: clamp(cp.y, 0.5, 1.5) + 0.0, z: S.z + 0.5 };
      sw.ballAt = cp;
    }
    p.swing = sw; p.press = null; p.pendKind = null;
    ev('swing', { p: p.id, tc, contact, kind, tech: S.tech, q, e, why, planT: p.plan ? p.plan.t : null, planOk: p.plan ? p.plan.ok : null, tIdeal, dbg: contact ? undefined : { d, maxD, pl: p.plan && { S: p.plan.S, t: p.plan.t, cp: p.plan.cp, ok: p.plan.ok }, S, cp, pos: { x: p.x, z: p.z, vx: p.vx, vz: p.vz }, tc, tIdeal } });
    return sw;
  }

  function applyContact(p, sw) {
    sw.done = true;
    const b = s.ball;
    const dBall = Math.hypot(b.x - sw.cp.x, b.y - sw.cp.y, b.z - sw.cp.z);
    const stillOk = sw.contact && (R.serve && !R.struck ? true : R.struck && p.team !== R.lastTeam && R.frontHit && R.bounces < 2);
    if (!stillOk || dBall > 0.08) { sw.contact = false; sw.why = sw.why || 'late'; ev('whiff', { p: p.id, why: sw.why, tc: sw.tc }); return; }
    // the error model: timing and stretch decide how far the ball strays from the aim
    const st = p.st, q = sw.q;
    const kind = sw.kind;
    const mishit = !p.human && aiRng.next() < st.err * (1.2 - 0.6 * q);
    let sig = st.aim * 0.55 + (1 - q) * 0.95 + (mishit ? 1.3 : 0);
    if (kind === 'power') sig *= 1.35;
    const nx = normal(noiseRng), ny = normal(noiseRng);
    let aim = sw.aim;
    if (aim.wall === 'front') aim = { wall: 'front', x: clamp(aim.x + nx * sig, -HW - 0.3, HW + 0.3), y: Math.max(0.3, aim.y + ny * sig * 0.7) };
    else aim = { wall: 'left', z: clamp(aim.z + nx * sig, 5, L), y: Math.max(0.3, aim.y + ny * sig * 0.7) };
    const qq = mishit ? Math.min(q, 0.25) : q;
    const sol = solveShot(sw.cp, aim, kind, equip, qq);
    Object.assign(b, { vx: sol.vx, vy: sol.vy, vz: sol.vz, wx: sol.wx, wy: sol.wy, wz: sol.wz });
    // unit direction of the outgoing ball (for the swing's follow-through)
    const vl = Math.hypot(sol.vx, sol.vy, sol.vz) || 1;
    sw.d = { x: sol.vx / vl, y: sol.vy / vl, z: sol.vz / vl }; sw.speed = vl; sw.hit = true; sw.shotAim = aim;
    const wasServe = R.serve && !R.struck;
    R.struck = true; R.frontHit = false; R.leftFirst = false; R.bounces = 0; R.lastHit = p.id; R.lastTeam = p.team; R.hits++; R.tHit = s.t;
    R.serve = wasServe;                              // the serve rules apply to the serve's own flight only
    ev('hit', { p: p.id, team: p.team, kind, tech: sw.tech, q, e: sw.e, cp: sw.cp, speed: vl, serve: wasServe, d: sw.d });
    s.cue = null;
    afterHit();
    if (A && A.fault && A.ta === null) { /* the ball will fault on its own: nothing for the receivers to do */ }
  }

  // ------------------------------------------------------------------------------------------------ a computer player decides its shot
  function decideShot(p, sw0) {
    const serveShot = R.serve && !R.struck;
    const opps = players.filter((o) => o.team !== p.team);
    const b = cloneBall(s.ball);
    // contact point and time: where the ball will be in SWING_DELAY
    const tc = Math.ceil((s.t + SWING_DELAY) / H - 1e-9) * H;
    const steps = Math.round((tc - s.t) / H);
    for (let k = 0; k < steps; k++) stepBall(b, H);
    const cp = { x: b.x, y: b.y, z: b.z };
    const q = 1 - Math.pow(clamp(Math.abs(cp.y - (serveShot ? 0.9 : 0.95)) / 0.75, 0, 1), 1.3);
    const sigma = p.st.aim * 0.55 + (1 - q) * 0.95;
    const list = evaluate({ cp, tc, equip, q: Math.max(0.5, q), sigma: Math.min(sigma, 1.4), opps, serve: serveShot, agg: p.st.agg ?? 0.7, role: p.role });
    const c = pick(list, p.st.think, pickRng);
    return { kind: c.kind, aim: c.aim, reason: reasonFor(c, { serve: serveShot, opps }), summary: `${SHOTS[c.kind].name}: aim ${aimWords(c.aim)}`, cp, minSlack: c.minSlack, pf: c.pf };
  }

  // ------------------------------------------------------------------------------------------------ impacts and rules
  function onImpact(im) {
    ev('wall', { kind: im.kind, x: im.x, y: im.y, z: im.z, speed: im.speed });
    if (R.serve && !R.struck) {                     // the serve's own bounce, before the strike
      if (im.kind === 'floor') { R.preBounces++; if (R.preBounces >= 2) fault({ by: 'hitter', reason: 'Serve fault: the ball bounced twice before it was struck' }, true); }
      else if (im.kind === 'out') fault({ by: 'hitter', reason: 'The ball went out' }, true);
      return;
    }
    const j = judgeImpact(R, im);
    if (j) fault(j, false);
  }
  function fault(j, noHitter) {
    if (s.phase !== 'live') return;
    const hitterTeam = noHitter ? pOf(R.server).team : R.lastTeam;
    if (R.serve && j.by === 'hitter' && R.faults < 1 && !cfg.drill) {           // first service fault: serve again
      s.faultCarry = R.faults + 1;
      s.match.stats[hitterTeam].faults++;
      ev('serveFault', { team: hitterTeam, text: j.reason });
      s.last = { t: s.t, kind: 'fault', text: `${j.reason}. Second serve.`, winner: -1 };
      endLive(true);
      return;
    }
    const winner = j.by === 'hitter' ? 1 - hitterTeam : hitterTeam;
    s.faultCarry = 0;
    if (j.by === 'receiver') { s.match.stats[winner].winners++; if (R.serve && R.hits === 1) s.match.stats[winner].aces++; }
    else s.match.stats[hitterTeam].errors++;
    score(winner, j.reason, j.by);
  }
  function endLive(replaySame) {
    s.phase = 'dead'; s.phaseT = 0; s.replay = replaySame; s.ball.vis = true;
    for (const p of players) { p.press = null; p.target = { ...p.home }; }
    s.cue = null; s.backup = null;
  }
  function score(winner, text, how) {
    const m = s.match;
    m.rallies++; m.longest = Math.max(m.longest, R.hits);
    if (cfg.drill) {
      ev('point', { winner, text, how, drill: true, hits: R.hits, lastHit: R.lastHit });
      s.last = { t: s.t, kind: 'point', text, winner };
      endLive(false);
      return;
    }
    m.pts[winner]++;
    m.history.push({ w: winner, text, hits: R.hits });
    ev('point', { winner, text, how, hits: R.hits, serving: m.serving });
    s.last = { t: s.t, kind: 'point', text: `${text}.`, winner };
    if (winner !== m.serving) { m.serving = winner; if (doubles) m.srv[winner] ^= 1; }
    if (m.pts[winner] >= m.target) { m.over = true; m.winner = winner; ev('matchEnd', { winner }); }
    endLive(false);
  }
  function letPoint(by) {
    s.letDone = true;
    ev('let', { p: by });
    s.last = { t: s.t, kind: 'let', text: 'Let: the ball struck a player. Replay.', winner: -1 };
    endLive(true);
  }

  // ------------------------------------------------------------------------------------------------ players
  function movePlayers() {
    const ph = s.phase;
    for (const p of players) {
      const sw = p.swing;
      let swinging = false;
      if (sw && s.t < sw.t1) {
        swinging = true;
        const T = SWING_DELAY, u = (s.t - sw.t0) / (sw.tc - sw.t0);
        if (u < 1) {
          const uu = clamp(u, 0, 1), u2 = uu * uu, u3 = u2 * uu;
          const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + uu, h01 = -2 * u3 + 3 * u2;
          const Tt = sw.tc - sw.t0;
          const nx = h00 * sw.p0.x + h10 * Tt * sw.p0.vx + h01 * sw.S.x, nz = h00 * sw.p0.z + h10 * Tt * sw.p0.vz + h01 * sw.S.z;
          p.vx = (nx - p.x) / H; p.vz = (nz - p.z) / H; p.x = nx; p.z = nz;
        } else { p.x = sw.S.x; p.z = sw.S.z; p.vx = 0; p.vz = 0; }
        void T;
      }
      if (!swinging) {
        let dvx = 0, dvz = 0;
        const stick = p.human && s.ctl.stick && (ph === 'live' || ph === 'serve' || ph === 'ready');
        if (stick) { dvx = s.ctl.stickX * p.st.spd; dvz = s.ctl.stickZ * p.st.spd; }
        else if (!(p.human && !s.ctl.auto && (ph === 'live' || ph === 'serve'))) {
          const dx = p.target.x - p.x, dz = p.target.z - p.z, d = Math.hypot(dx, dz);
          const reactDelay = ph === 'live' && R && s.t - R.tHit < p.st.react;
          if (d > 0.03 && !reactDelay) { const sp = Math.min(p.st.spd * (ph === 'ready' ? 0.8 : 1), d / 0.16); dvx = dx / d * sp; dvz = dz / d * sp; }
        }
        // accelerate
        const ax = dvx - p.vx, az = dvz - p.vz, al = Math.hypot(ax, az), maxA = 17 * H;
        if (al > maxA) { p.vx += ax / al * maxA; p.vz += az / al * maxA; } else { p.vx = dvx; p.vz = dvz; }
        p.x += p.vx * H; p.z += p.vz * H;
      }
      p.x = clamp(p.x, -HW + 0.35, HW - 0.5); p.z = clamp(p.z, 0.7, L - 1.5);
    }
    // keep players apart (soft)
    for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
      const a = players[i], b = players[j];
      const sa = !!(a.swing && s.t < a.swing.t1 && s.t < a.swing.tc + 0.2), sb = !!(b.swing && s.t < b.swing.t1 && s.t < b.swing.tc + 0.2);
      if (sa && sb) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      // a player in a stroke is planted: the other one steps clear; bodies never get closer than 0.62 m (centre to centre)
      if (d < 0.8 && d > 1e-4) {
        const hard = d < 0.62 ? (0.62 - d) : 0;
        const push = (0.8 - d) * 0.5 * Math.min(1, 12 * H * 4);
        const ux = dx / d, uz = dz / d;
        if (sa) { const k = Math.max(push * 2, hard); b.x += ux * k; b.z += uz * k; }
        else if (sb) { const k = Math.max(push * 2, hard); a.x -= ux * k; a.z -= uz * k; }
        else { const k = Math.max(push, hard * 0.5); a.x -= ux * k; a.z -= uz * k; b.x += ux * k; b.z += uz * k; }
      }
    }
    for (const p of players) {
      // facing: the front wall at rest; the direction of travel when running; the shot direction in a swing
      const sp = Math.hypot(p.vx, p.vz);
      let want = 0;
      if (p.swing && s.t < p.swing.t1 + 0.1) want = p.swing.faceYaw ?? faceFor(p.swing);
      else if (sp > 1.4) want = Math.atan2(p.vx, p.vz);
      else if (s.ball.vis && !s.ball.held && s.ball.z < p.z - 0.5) want = clamp(Math.atan2(s.ball.x - p.x, s.ball.z - p.z), -2.6, 2.6) * 0.8;
      let d = want - p.face; d = Math.atan2(Math.sin(d), Math.cos(d));
      const rate = (p.swing && s.t < p.swing.t1 ? 14 : 8) * H;
      p.face += clamp(d, -rate * 2, rate * 2) * (Math.abs(d) > 0.02 ? 1 : 0.3);
      p.face = Math.atan2(Math.sin(p.face), Math.cos(p.face));
    }
  }
  function faceFor(sw) {
    // side-on to the ball: a forehand turns the shoulders to the dominant side, a backhand to the other
    const m = sw.lefty ? -1 : 1, side = sw.back ? -1 : 1;
    let yaw = -m * side * 0.55;                                    // + is a turn to the left (+x)
    if (sw.tech === 'high') yaw *= 0.5;
    sw.faceYaw = yaw;
    return yaw;
  }

  // ------------------------------------------------------------------------------------------------ Watch & Learn holds
  let holdId = 0;
  function holdFor(p, dec, serve) {
    s.hold = { id: ++holdId, who: p.id, team: p.team, serve, decision: dec, t: s.t };
  }

  // ------------------------------------------------------------------------------------------------ one sub-step
  function sub() {
    if (s.hold) return;                              // Watch & Learn: the whole match waits at a decision
    s.n++; s.t = s.n * H;
    const ph = s.phase;
    if (ph === 'ready') {
      s.phaseT += H;
      if (s.phaseT >= READY_T) startServePhase();
    } else if (ph === 'serve') {
      s.phaseT += H;
      holdBall();
      if ((pendDrop && pOf(R.server).human) || (!pOf(R.server).human && s.t >= s.serve.tDrop)) { pendDrop = false; dropBall(); }
    } else if (ph === 'live') {
      // human pressing SWING
      if (pendSwing) {
        pendSwing = false;
        const hp = players.find((p) => p.human);
        if (hp) { const sw = startSwing(hp, s.ctl.kind, api.currentAim()); if (sw && s.ctl.autoAim) { s.ctl.aimSet = false; s.ctl.kindManual = false; } }
      }
      // computer players press on their own timing
      for (const p of players) {
        if (p.human || p.swing && s.t < p.swing.t1) continue;
        if (p.press && s.t >= p.press.t) {
          if (!p.dec) {
            p.dec = decideShot(p);
            if (cfg.watch) { holdFor(p, p.dec, R.serve && !R.struck); break; }
          }
          const d1 = p.dec; p.dec = null;
          startSwing(p, d1.kind, d1.aim);
        }
      }
      // the partner steps in when the human is late
      if (s.backup && s.t >= s.backup.tCheck) {
        const hp = players.find((p) => p.human), bp = pOf(s.backup.id);
        s.backup = null;
        if (hp && !hp.swing && bp && !bp.swing && A && A.ta !== null && !hp.swingedRecent) {
          const pl = planFor(bp, F, A, s.t, equip);
          if (pl && pl.ok && pl.t > s.t + SWING_DELAY * 0.8) { bp.press = { t: s.t, kind: null }; }
        }
      }
      if (s.n % 12 === 0) refreshAvoid();
      for (const p of players) { const sw = p.swing; if (sw && !sw.done && s.t >= sw.tc - 1e-9) { if (sw.contact) applyContact(p, sw); else { sw.done = true; ev('whiff', { p: p.id, why: sw.why, tc: sw.tc }); } } }
      stepLive();
    } else if (ph === 'dead') {
      s.phaseT += H;
      if (s.phaseT >= DEAD_T) nextPoint();
    }
    movePlayers();
  }
  function stepLive() {
    if (s.phase !== 'live') return;
    const b = s.ball;
    const evs = stepBall(b, H);
    spinBall(b);
    if (evs.length) for (const im of evs) { if (s.phase !== 'live') break; onImpact(im); }
    // spin of the drawn ball
    if (s.phase !== 'live') return;
    // a ball that strikes a player who is not striking it is a let
    if (R.struck || R.serve) {
      const sp = Math.hypot(b.vx, b.vy, b.vz);
      if (sp > 3 && !cfg.drill && !s.letDone) for (const p of players) {
        if (p.swing && s.t < p.swing.tc + 0.25 && s.t > p.swing.t0) continue;
        if (R.lastHit === p.id && s.t - R.tHit < 0.5) continue;
        if (R.claim === p.id) continue;
        if (b.y < 1.85 && Math.hypot(b.x - p.x, b.z - p.z) < 0.3) { letPoint(p.id); return; }
      }
    }
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
      if (s.drill.kind !== 'serve') { s.phaseT = READY_T - 0.3; }
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
      if (s.phase === 'over' && cfg.drill) { /* drills end here */ }
    },
    // ---- human input (set by game.js each tick)
    currentAim() { return s.ctl.aimSet || !s.ctl.autoAim || !s.autoAim || !s.autoAim[s.ctl.kind] ? s.ctl.aim : { wall: s.autoAim[s.ctl.kind].wall, ...s.autoAim[s.ctl.kind] }; },
    setStick(x, z, on) { s.ctl.stickX = x; s.ctl.stickZ = z; s.ctl.stick = !!on; },
    setAim(a) { s.ctl.aim = a; s.ctl.aimSet = true; },
    setKind(k, manual = true) {
      s.ctl.kind = k; if (manual) s.ctl.kindManual = true;
      if (!s.ctl.aimSet) { const d = DEFAULT_AIM[k]; if (d) s.ctl.aim = { wall: 'front', ...d }; }
      else if (s.ctl.aim && s.ctl.aim.wall === 'front') {                    // keep the chosen side, move to the height band of the shot
        const d = DEFAULT_AIM[k]; if (d) s.ctl.aim = { wall: 'front', x: s.ctl.aim.x, y: d.y };
      }
    },
    pressSwing() { pendSwing = true; },
    pressDrop() { pendDrop = true; },
    release() { s.hold = null; },
    humanPlayer() { return players.find((p) => p.human || p.isUser) || null; },
    // ---- Think: the best shot for the human right now (or a note when nothing is to be done)
    suggest() {
      const hp = players.find((p) => p.human);
      if (!hp) return null;
      const opps = players.filter((o) => o.team !== hp.team);
      if (s.phase === 'serve' && R.server === hp.id) {
        const cp = { x: hp.x - (hp.lefty ? -1 : 1) * 0.5, y: 0.85, z: hp.z + 0.3 };
        const list = evaluate({ cp, tc: s.t + 1, equip, q: 0.9, sigma: 0.25, opps, serve: true });
        const c = list[0];
        return { kind: c.kind, aim: c.aim, reason: reasonFor(c, { serve: true, opps }), summary: `${SHOTS[c.kind].name}: aim ${aimWords(c.aim)}` };
      }
      if (s.phase === 'live' && A && A.ta !== null && R.struck && R.lastTeam !== hp.team) {
        const pl = hp.plan || planFor(hp, F, A, s.t, equip);
        if (!pl) return { kind: null, reason: 'The ball cannot be played: let it go.', summary: 'Let it go' };
        const claim = R.claim === hp.id;
        const list = evaluate({ cp: pl.cp, tc: pl.t, equip, q: 0.9, sigma: 0.25, opps, serve: false, role: hp.role });
        const c = list[0];
        let reason = reasonFor(c, { serve: false, opps });
        if (!claim) reason = 'Your partner is better placed for this ball. Get back to your spot and be ready. ' + reason;
        else if (!pl.ok) reason = 'This ball is hard to reach: run to it now. ' + reason;
        return { kind: c.kind, aim: c.aim, reason, summary: `${SHOTS[c.kind].name}: aim ${aimWords(c.aim)}`, claim };
      }
      return { kind: null, reason: 'Nothing to hit yet. Watch where the ball bounces and move so it comes to you at waist height.', summary: 'Wait and watch' };
    },
    // ---- save / resume
    saveData() { const m = s.match; return { pts: [...m.pts], serving: m.serving, srv: [...m.srv], rallies: m.rallies, firstServer: m.firstServer, stats: JSON.parse(JSON.stringify(m.stats)) }; },
    forecast: () => F, analysis: () => A, rallyState: () => R,
    // used by the 3D presenter and the HUD for cues
    shotPreview(p, aim, kind, q = 0.9) {
      if (!p || !s.cue) return null;
      const cp = s.cue.cp || { x: p.x, y: 0.95, z: p.z + 0.4 };
      const sol = solveShot(cp, aim, kind, equip, q);
      const f = forecast(newBall(cp.x, cp.y, cp.z, sol.vx, sol.vy, sol.vz, sol.wx, sol.wy, sol.wz), { maxT: 2.4 });
      return { cp, f };
    },
  };
  return api;
}

export function aimWords(a) {
  if (a.wall === 'left') return 'the left wall first';
  return a.x > 1.8 ? 'the left corner' : a.x > 0.7 ? 'left of centre' : a.x < -1.8 ? 'the right corner' : a.x < -0.7 ? 'right of centre' : 'the centre';
}
export { SHOT_IDS, SERVE_SHOT_IDS, TIN, TOP, SHORT, BR, smooth };

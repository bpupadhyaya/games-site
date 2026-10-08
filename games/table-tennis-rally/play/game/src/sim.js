// The match simulation: rules of table tennis, two paddles, a ball with real flight, and the opponent AI. Pure and deterministic.
// The human is side 'p' (z > 0, near the camera); the opponent is 'o'. Time inside the match runs at TIME_SCALE of real time so
// the ball is readable on a phone; every physical speed below is in true metres per second.
import { TABLE, BALL_R, stepBall, sign, other } from './physics.js';
import { launch, KINDS } from './shots.js';
import { readSpin, mismatchFor, contactQuality, intentFromFlick } from './strokes.js';
import { aiIntent, aiServe } from './ai.js';
import { levelStats } from './profiles.js';

export const H = 1 / 240;
export const TIME_SCALE = 0.62;
const BOX = { d0: 1.4, d1: 2.7, y0: 0.7, y1: 1.75 };
const SERVE_POS = { z: 1.5, y: 1.0 };
const TOSS_V = 2.3, TOSS_T = 0.4;
const HAND_SPEED = 8.0;                   // human paddle lateral speed (true m/s)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const ASSIST = {
  easy: { reach: 0.19, autoBlock: true, mm: 0.5 },
  normal: { reach: 0.155, autoBlock: true, mm: 0.75 },
  pro: { reach: 0.13, autoBlock: false, mm: 1.0 },
};

export function createSim(cfg, rng) {
  const prof = cfg.opp ?? null;
  const oppLevel = cfg.level ?? prof?.level ?? 3;
  const ost = levelStats(oppLevel);
  const asst = ASSIST[cfg.assist ?? 'normal'];
  const target = cfg.target ?? 11;
  const need = Math.ceil((cfg.bestOf ?? 1) / 2);
  const machine = !!cfg.machine;
  const w = {
    t: 0, acc: 0, slow: 1, phase: 'intro', phaseT: 0,
    ball: { p: [0, SERVE_POS.y, SERVE_POS.z], v: [0, 0, 0], w: [0, 0, 0] }, bprev: [0, SERVE_POS.y, SERVE_POS.z],
    server: cfg.firstServer ?? 'p', firstServer: cfg.firstServer ?? 'p', serveInRow: 0,
    score: { p: 0, o: 0 }, games: { p: 0, o: 0 }, gameNo: 1, target, bestOf: cfg.bestOf ?? 1, need,
    rally: { hitter: null, bounce: { p: 0, o: 0 }, crossed: false, hits: 0, isServe: false, netTouch: false, since: 0 },
    pad: { p: { x: 0, tx: 0, swing: null, cool: 0, plan: null, speed: HAND_SPEED }, o: { x: 0, tx: 0, swing: null, cool: 0, plan: null, speed: ost.speed } },
    auto: { p: !!cfg.autoPlay, o: !machine },
    events: [], eid: 0, guide: null, last: null, stats: { points: 0, won: 0, winners: 0, errors: 0, longest: 0, aces: 0, fastest: 0, bestStreak: 0 },
    machine, lives: 3, streak: 0, over: null, serveCount: 0, hold: 0, history: [],
    ai: { level: oppLevel, st: ost, name: prof?.name ?? 'Ball machine' }, coach: null,
  };
  const rnd = () => rng.next() * 2 - 1;
  const push = (type, o = {}) => { const e = { id: ++w.eid, type, t: w.t, ...o }; w.events.push(e); if (w.events.length > 48) w.events.shift(); return e; };
  const reachOf = (s) => (s === 'p' ? asst.reach : ost.reach);
  const profOf = (s) => (s === 'o' ? prof : cfg.coach ?? prof) ?? { style: 'allround', aggression: 0.5, place: 'mixed', serve: [2, 2, 2], weak: null };
  const levelOf = (s) => (s === 'o' ? oppLevel : cfg.coachLevel ?? 8);

  // ---- predictions -------------------------------------------------------------------------------------------------
  // The part of the ball's future during which `side` could hit it: samples every 10 ms while it is inside the reach box
  // after exactly one bounce on that side. dt is seconds from now.
  function contactWindow(side, tMin, tMax) {
    const sg = sign(side);
    const b = { p: [...w.ball.p], v: [...w.ball.v], w: [...w.ball.w] };
    let bn = w.rally.bounce[side], crossed = w.rally.crossed, t = 0, next = 0;
    const ev = [], out = [];
    const recvSide = side;
    while (t < tMax) {
      const z0 = b.p[2];
      ev.length = 0; stepBall(b, H, ev); t += H;
      for (const e of ev) {
        if (e.type === 'net' && e.kind === 'wall') return out;
        if (e.type === 'floor') return out;
        if (e.type === 'bounce') { if (e.side === recvSide) bn++; else if (w.rally.hitter === side) return out; }
      }
      if ((z0 > 0) !== (b.p[2] > 0)) crossed = true;
      if (bn >= 2) return out;
      const d = sg * b.p[2];
      if (bn === 1 && crossed || (bn === 1 && !w.rally.isServe && w.rally.hitter === other(side))) {
        if (t >= tMin && t >= next && d >= BOX.d0 && d <= BOX.d1 && b.p[1] >= BOX.y0 && b.p[1] <= BOX.y1) { out.push({ dt: t, p: [...b.p], v: [...b.v], w: [...b.w] }); next = t + 0.01; }
        if (d > BOX.d1 + 0.1 || (d > BOX.d0 && b.p[1] < BOX.y0 - 0.1)) return out;
      }
    }
    return out;
  }
  const inBox = (side, p) => { const d = sign(side) * p[2]; return d >= BOX.d0 && d <= BOX.d1 && p[1] >= BOX.y0 && p[1] <= BOX.y1; };

  // The human's guide: when the ball passes the ideal hitting point and when to flick.
  function computeGuide() {
    const s = contactWindow('p', 0, 2.2);
    if (!s.length) { w.guide = null; return; }
    let best = s[0], bd = 9;
    for (const c of s) { const dd = Math.hypot((c.p[1] - 1.02) * 1.5, (sign('p') * c.p[2] - 1.82) * 0.85); if (dd < bd) { bd = dd; best = c; } }
    const sp = readSpin({ v: w.ball.v, w: w.ball.w });
    w.guide = { tHit: w.t + best.dt, tFlick: w.t + best.dt - 0.13, x: best.p[0], y: best.p[1], z: best.p[2], first: w.t + s[0].dt, last: w.t + s[s.length - 1].dt, spin: sp };
  }

  // ---- rally state ----------------------------------------------------------------------------------------------------
  function afterHit(side, serve) {
    w.rally.hitter = side; w.rally.bounce = { p: 0, o: 0 }; w.rally.crossed = false; w.rally.hits += 1; w.rally.since = 0;
    w.rally.isServe = serve; w.rally.netTouch = false;
    w.stats.longest = Math.max(w.stats.longest, w.rally.hits);
    const rcv = other(side);
    w.pad[rcv].plan = w.auto[rcv] ? { at: w.t + (serve ? 0.5 : levelStatsFor(rcv).reaction) * (0.85 + 0.3 * rng.next()), done: false } : null;
    if (rcv === 'p') computeGuide();
    w.pad[side].home = true;
  }
  const levelStatsFor = (s) => (s === 'o' ? ost : levelStats(levelOf('p')));

  function winPoint(winner, why) {
    if (w.phase !== 'rally' && w.phase !== 'toss') return;
    w.phase = 'dead'; w.phaseT = 0;
    w.last = { winner, why, hits: w.rally.hits };
    if (machine) {
      if (winner === 'p') { w.streak += 1; w.stats.bestStreak = Math.max(w.stats.bestStreak, w.streak); w.score.p = w.streak; }
      else { w.lives -= 1; w.streak = 0; w.score.p = 0; }
      push('point', { winner, why, streak: w.streak, lives: w.lives, hits: w.rally.hits });
      return;
    }
    w.score[winner] += 1;
    w.stats.points += 1;
    if (winner === 'p') w.stats.won += 1;
    if (why === 'winner' || why === 'ace') { if (winner === 'p') w.stats.winners += 1; }
    if (why === 'ace' && winner === 'p') w.stats.aces += 1;
    if (winner === 'o' && (why === 'net' || why === 'out' || why === 'own side' || why === 'serve fault' || why === 'missed')) w.stats.errors += 1;
    push('point', { winner, why, score: { ...w.score }, hits: w.rally.hits });
  }
  const loser = (side, why) => winPoint(other(side), why);

  function onBounce(e) {
    const r = w.rally, hit = r.hitter;
    if (hit === null) return;
    const rcv = other(hit);
    if (r.isServe) {
      if (e.side === hit && !r.crossed && r.bounce[hit] === 0) { r.bounce[hit] = 1; return; }
      if (e.side === rcv && r.crossed && r.bounce[hit] === 1) {
        r.bounce[rcv] = 1;
        if (r.netTouch) { push('let'); w.phase = 'dead'; w.phaseT = 0; w.last = { winner: null, why: 'let' }; return; }
        if (machine) { return; }
        return;
      }
      loser(hit, 'serve fault'); return;
    }
    if (e.side === hit) { loser(hit, 'own side'); return; }
    r.bounce[rcv] += 1;
    if (machine && hit === 'p' && r.bounce.o === 1) { winPoint('p', 'return'); return; }
    if (r.bounce[rcv] >= 2) winPoint(hit, w.pad[rcv].swing && w.pad[rcv].swing.whiff ? 'missed' : 'winner');
  }

  function deadBall() {
    const r = w.rally;
    if (r.hitter === null) return;
    const rcv = other(r.hitter);
    if (r.bounce[rcv] >= 1) winPoint(r.hitter, 'winner');
    else loser(r.hitter, r.crossed ? 'out' : 'net');
  }

  // ---- strokes -----------------------------------------------------------------------------------------------------
  function strikeServe(side, intent, q) {
    const b = w.ball;
    const from = [b.p[0], b.p[1], b.p[2]];
    const res = launch(b, from, side, intent, q, 0, rnd, side === 'p' ? 1 : 1);
    if (!res) { b.v = [0, 2, -sign(side) * 3]; b.w = [0, 0, 0]; }
    afterHit(side, true);
    w.phase = 'rally'; w.phaseT = 0;
    push('hit', { side, kind: intent.kind, serve: true, speed: res ? res.speed : 3, q, x: from[0], y: from[1], z: from[2] });
  }

  function contactAt(side, sw) {
    const pad = w.pad[side], b = w.ball, sg = sign(side);
    const d = sg * b.p[2];
    if (!inBox(side, b.p) || w.rally.bounce[side] !== 1 || w.rally.hitter !== other(side)) { sw.whiff = true; push('whiff', { side, why: 'late' }); return; }
    const dx = b.p[0] - pad.x;
    const reach = reachOf(side);
    if (Math.abs(dx) > reach) { sw.whiff = true; pad.cool = 0.3; push('whiff', { side, why: 'reach', dx }); return; }
    const spd = Math.hypot(b.v[0], b.v[1], b.v[2]);
    const sIn = readSpin(b);
    let q = contactQuality(dx, reach, b.p[1], d, spd);
    const c = { x: b.p[0], y: b.p[1], d };
    let intent;
    if (side === 'p' && !w.auto.p) {
      intent = sw.flick ? intentFromFlick(sw.flick, c, false) : blockIntent(c);
    } else {
      const pr = profOf(side), lv = levelOf(side), st = levelStatsFor(side);
      intent = sw.intent ?? aiIntent(pr, lv, b, c, w.pad[other(side)].x, rng, spd);
      q = clamp(q * (0.55 + 0.5 * st.base) + rnd() * 0.04, 0.12, 1);
      if (pr.weak === 'speed' && spd > 9) q *= 0.82;
      if (pr.weak === 'wide' && Math.abs(dx) > reach * 0.5) q *= 0.78;
      if (pr.weak === 'short' && d < 1.6) q *= 0.82;
    }
    let mm = mismatchFor(intent.kind, sIn) * (side === 'p' ? asst.mm : 0.8) * (1 - 0.6 * q);
    if (side === 'o') { const pr = profOf('o'); if ((pr.weak === 'backspin' && sIn.top < -0.4) || (pr.weak === 'topspin' && sIn.top > 0.4)) mm *= 1.6; }
    sw.kind = intent.kind;
    const from = [b.p[0], b.p[1], b.p[2]];
    const res = launch(b, from, side, intent, q, mm, rnd, side === 'p' ? 1 : 1);
    if (!res) { sw.whiff = true; return; }
    w.stats.fastest = Math.max(w.stats.fastest, res.speed);
    pad.cool = 0.25; sw.done = true; sw.contact = { x: from[0], y: from[1], z: from[2] };
    push('hit', { side, kind: intent.kind, speed: res.speed, q, x: from[0], y: from[1], z: from[2], spin: intent.top, tx: intent.tx, perfect: q > 0.86 });
    afterHit(side, false);
    if (intent.kind === 'smash') w.hold = 0.06;
  }

  const blockIntent = (c) => {
    const K = KINDS.block;
    return { kind: 'block', tx: clamp(c.x * -0.35, -0.5, 0.5), depth: K.depth, speed: K.v[0] + (K.v[1] - K.v[0]) * 0.4, top: K.top, side: 0, risk: K.risk, maxPitch: K.maxPitch };
  };

  // ---- phases ------------------------------------------------------------------------------------------------------------
  function placeServeBall(side) {
    const p = w.pad[side], sg = sign(side);
    w.ball.p = [p.x, SERVE_POS.y, sg * SERVE_POS.z]; w.ball.v = [0, 0, 0]; w.ball.w = [0, 0, 0];
    w.bprev = [...w.ball.p];
  }
  function startServe() {
    w.phase = 'serve'; w.phaseT = 0; w.rally = { hitter: null, bounce: { p: 0, o: 0 }, crossed: false, hits: 0, isServe: false, netTouch: false, since: 0 };
    w.guide = null;
    for (const s of ['p', 'o']) { w.pad[s].swing = null; w.pad[s].plan = null; w.pad[s].cool = 0; }
    if (machine) w.server = 'o';
    w.pad[w.server].tx = w.server === 'o' ? rnd() * 0.5 : w.pad.p.x;
    placeServeBall(w.server);
    push('serveReady', { server: w.server });
  }
  function beginToss(side, intent, flick) {
    const b = w.ball, sg = sign(side);
    b.p = [w.pad[side].x, SERVE_POS.y, sg * SERVE_POS.z]; b.v = [0, TOSS_V, 0]; b.w = [0, 0, 0];
    w.pad[side].tx = w.pad[side].x;
    w.pad[side].swing = { side, t0: w.t, tc: w.t + TOSS_T, flick, intent, serve: true, cpos: [b.p[0], SERVE_POS.y - 0.02, sg * SERVE_POS.z] };
    w.phase = 'toss'; w.phaseT = 0;
    push('toss', { side });
  }
  function nextServer() {
    const deuce = w.score.p >= w.target - 1 && w.score.o >= w.target - 1;
    w.serveInRow += 1;
    if (deuce || w.serveInRow >= 2) { w.server = other(w.server); w.serveInRow = 0; }
  }
  function afterPoint() {
    if (machine) {
      if (w.lives <= 0) { w.phase = 'over'; w.over = { winner: null, streak: w.stats.bestStreak }; push('over', {}); return; }
      w.server = 'o'; startServe(); return;
    }
    if (w.last && w.last.why === 'let') { startServe(); return; }
    const { p, o } = w.score, T = w.target;
    const hi = Math.max(p, o);
    if (hi >= T && Math.abs(p - o) >= 2) {
      const gw = p > o ? 'p' : 'o';
      w.games[gw] += 1; w.history.push({ p, o });
      push('game', { winner: gw, games: { ...w.games }, score: { ...w.score } });
      if (w.games[gw] >= need) { w.phase = 'over'; w.over = { winner: gw, games: { ...w.games } }; push('over', { winner: gw }); return; }
      w.phase = 'gameBreak'; w.phaseT = 0; return;
    }
    nextServer();
    startServe();
  }
  function nextGame() {
    w.gameNo += 1; w.score = { p: 0, o: 0 }; w.serveInRow = 0;
    w.firstServer = other(w.firstServer); w.server = w.firstServer;
    startServe();
  }

  // ---- AI driving ----------------------------------------------------------------------------------------------------
  function aiThink(side) {
    const pad = w.pad[side];
    if (pad.plan && !pad.plan.done && w.t >= pad.plan.at && w.phase === 'rally') {
      pad.plan.done = true;
      const s = contactWindow(side, 0.1, 2.0);
      if (!s.length) return;
      const prof2 = profOf(side);
      const wantD = prof2.style === 'chopper' ? 2.35 : prof2.style === 'lobber' ? 2.5 : prof2.style === 'blocker' ? 1.62 : 1.85;
      let best = s[0], bd = 9;
      for (const c of s) { const dd = Math.abs(sign(side) * c.p[2] - wantD); if (dd < bd) { bd = dd; best = c; } }
      const st = levelStatsFor(side);
      pad.tx = clamp(best.p[0] + rnd() * st.sigma, -1.2, 1.2);
      const spd0 = Math.hypot(best.v[0], best.v[1], best.v[2]);
      const intent = aiIntent(prof2, levelOf(side), { v: best.v, w: best.w }, { x: best.p[0], y: best.p[1], d: sign(side) * best.p[2] }, w.pad[other(side)].x, rng, spd0);
      pad.swing = { side, t0: w.t, tc: w.t + best.dt, auto: true, intent, kind: intent.kind, cpos: best.p };
      pad.plan.tc = w.t + best.dt;
    }
    if (!pad.plan && w.phase === 'rally' && w.rally.hitter === side && pad.swing === null) pad.tx = clamp(pad.tx * 0.97, -1.2, 1.2) * 1;
  }

  function aiServeNow(side) {
    const intent = machine && cfg.feed ? cfg.feed(w, rng) : aiServe(profOf(side), levelOf(side), rng);
    if (machine && !cfg.feed) {
      const k = Math.min(1, w.streak / 30);
      intent.speed *= 0.9 + 0.35 * k; intent.side = rnd() * 220 * k;
      intent.top = intent.top * (0.8 + 0.5 * k);
    }
    beginToss(side, intent, null);
    w.pad[side].swing.quality = 0.8;
  }

  // ---- the fixed step ---------------------------------------------------------------------------------------------------------
  function step(ctrl) {
    const b = w.ball;
    // paddles move
    for (const s of ['p', 'o']) {
      const pad = w.pad[s];
      if (s === 'p' && !w.auto.p && ctrl && ctrl.x !== null && ctrl.x !== undefined && !(pad.swing && pad.swing.flick)) pad.tx = clamp(ctrl.x, -1.2, 1.2);
      const dx = pad.tx - pad.x, m = pad.speed * H;
      pad.x += Math.abs(dx) <= m ? dx : Math.sign(dx) * m;
      if (pad.cool > 0) pad.cool -= H;
    }
    if (w.phase === 'serve') { if (w.pad[w.server]) { w.ball.p[0] = w.pad[w.server].x; } return; }
    if (w.phase === 'intro' || w.phase === 'gameBreak' || w.phase === 'over') return;

    // keep the ball visually stable before it is served; live play otherwise
    w.bprev[0] = b.p[0]; w.bprev[1] = b.p[1]; w.bprev[2] = b.p[2];
    const z0 = b.p[2];
    const evs = [];
    stepBall(b, H, evs);
    if (w.phase === 'toss') {
      // the toss has only gravity; discard any table events
      const sw = w.pad[w.server].swing;
      if (sw && w.t + H >= sw.tc) {
        const sg = w.server;
        const fl = sw.flick;
        const c = { x: b.p[0], y: b.p[1], d: 1.5 };
        const intent = sw.intent ?? intentFromFlick(fl, c, true);
        const q = sw.quality ?? clamp(0.78 + 0.2 * Math.min(1, (fl ? fl.f : 0.5) * 1.3), 0.5, 1);
        sw.done = true; sw.contact = { x: b.p[0], y: b.p[1], z: b.p[2] };
        strikeServe(sg, intent, q);
      }
      return;
    }
    if (w.phase === 'dead') return;
    w.rally.since += H;
    for (const e of evs) {
      if (e.type === 'bounce') { push('bounce', { side: e.side, x: e.x, z: e.z, vIn: e.vIn, spin: readSpin(b).top }); onBounce(e); }
      else if (e.type === 'net') { push('net', { kind: e.kind }); if (w.rally.isServe && w.rally.hitter !== null) w.rally.netTouch = true; }
      else if (e.type === 'floor') { if (w.phase === 'rally') deadBall(); }
    }
    if (w.phase !== 'rally') return;
    if ((z0 > 0) !== (b.p[2] > 0) && !evs.some((e) => e.type === 'net' && e.kind === 'wall')) w.rally.crossed = true;
    const hit = w.rally.hitter;
    if (hit !== null) {
      const rcv = other(hit);
      if (sign(rcv) * b.p[2] > TABLE.hl + 0.05 && w.rally.bounce[rcv] === 0 && w.rally.crossed && !(w.pad[rcv].swing && !w.pad[rcv].swing.done)) loser(hit, 'out');
      else if (w.rally.since > 7) deadBall();
      else if (b.p[1] < 0.35 && w.phase === 'rally') deadBall();
    }
    // swings
    for (const s of ['p', 'o']) {
      const sw = w.pad[s].swing;
      if (sw && !sw.done && !sw.whiff && !sw.serve && w.t + H >= sw.tc) { contactAt(s, sw); if (w.phase === 'rally' && sw.whiff && !sw.auto) w.pad[s].cool = 0.3; }
    }
    // automatic block for the human, when nothing else was planned
    const hp = w.pad.p;
    if (w.phase === 'rally' && asst.autoBlock && !w.auto.p && !hp.swing && hp.cool <= 0 && w.rally.hitter === 'o' && w.rally.bounce.p === 1 && sign('p') * b.p[2] >= 1.62 && inBox('p', b.p)) {
      hp.swing = { side: 'p', t0: w.t, tc: w.t, block: true, cpos: [...b.p] };
    }
    if (w.phase === 'rally' && hp.swing && hp.swing.block && !hp.swing.done && !hp.swing.whiff) { contactAt('p', hp.swing); if (hp.swing.whiff) hp.swing = null; }
    for (const s of ['p', 'o']) if (w.auto[s]) aiThink(s);
  }

  function playerFlick(f) {
    const pad = w.pad.p;
    if (w.auto.p) return;
    if (w.phase === 'serve' && w.server === 'p') {
      const intent = intentFromFlick(f, { x: pad.x, y: SERVE_POS.y, d: 1.5 }, true);
      beginToss('p', null, f); w.pad.p.swing.intent = intent; w.pad.p.swing.flick = f;
      return;
    }
    if (w.phase !== 'rally' || pad.cool > 0 || (pad.swing && !pad.swing.done && !pad.swing.whiff)) return;
    if (w.rally.hitter !== 'o' || w.rally.bounce.p > 1) return;
    pad.tx = clamp(f.x ?? pad.x, -1.2, 1.2);
    const s = contactWindow('p', 0.07, 0.24);
    pad.cool = 0.4;
    if (s.length) pad.swing = { side: 'p', t0: w.t, tc: w.t + s[0].dt, flick: f, cpos: s[0].p };
    else pad.swing = { side: 'p', t0: w.t, tc: w.t + 0.16, flick: f, whiff: true, air: true, cpos: [pad.tx, 1.0, 1.75] };
    push('swing', { side: 'p', dir: f.dir, f: f.f, hit: s.length > 0 });
  }

  const api = {
    w,
    update(dt, ctrl) {
      w.phaseT += dt;
      if (w.hold > 0) { w.hold -= dt; return; }
      if (ctrl && ctrl.flick) playerFlick(ctrl.flick);
      if (w.phase === 'intro') { if (w.phaseT > 0.1) startServe(); }
      else if (w.phase === 'serve') {
        const sv = w.server;
        if (sv === 'o' && w.auto.o && w.phaseT > (machine ? 0.9 : 1.1 + 0.5 * rng.next())) aiServeNow('o');
        else if (sv === 'p' && w.auto.p && w.phaseT > 1.0) aiServeNow('p');
      } else if (w.phase === 'dead') { if (w.phaseT > (machine ? 1.0 : 1.5)) afterPoint(); }
      else if (w.phase === 'gameBreak') { if (w.phaseT > 3.0) nextGame(); }
      const adv = dt * TIME_SCALE * w.slow;
      w.acc += adv;
      let guard = 0;
      while (w.acc >= H && guard++ < 40) { step(ctrl); w.acc -= H; w.t += H; }
    },
    ballRender() {
      const a = w.acc / H, b = w.ball, pr = w.bprev;
      return [pr[0] + (b.p[0] - pr[0]) * a, pr[1] + (b.p[1] - pr[1]) * a, pr[2] + (b.p[2] - pr[2]) * a];
    },
    contactWindow, computeGuide,
    // The coach's plan for the human side right now (used by hints and Watch & Learn): what a good player would do.
    coachPlan() {
      const s = contactWindow('p', 0.05, 2.0);
      if (!s.length) return null;
      let best = s[0], bd = 9;
      for (const c of s) { const dd = Math.hypot((c.p[1] - 1.02) * 1.5, (c.p[2] - 1.82) * 0.85); if (dd < bd) { bd = dd; best = c; } }
      const pr = cfg.coach ?? { style: 'allround', aggression: 0.55, place: 'mixed', serve: [3, 3, 3], weak: null };
      const spd = Math.hypot(best.v[0], best.v[1], best.v[2]);
      const intent = aiIntent(pr, 8, { v: best.v, w: best.w }, { x: best.p[0], y: best.p[1], d: best.p[2] }, w.pad.o.x, rng, spd);
      return { intent, at: best, spin: readSpin({ v: best.v, w: best.w }) };
    },
    // Serve plan for the human side
    startMatch() { w.phase = 'intro'; w.phaseT = 0; },
    fail: () => null,
  };
  return api;
}

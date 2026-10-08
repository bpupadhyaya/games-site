// The match simulation: serve, rally, scoring, the two players' movement, interception planning, stroke execution with timing quality,
// the computer's decisions, and everything the presenter and HUD read. Pure and deterministic (randomness only from the rng handed in).
// Player index 0 = the human end (side +1, z > 0, the near end); index 1 = the computer end (side -1, z < 0).
import { HL, HW, SHORT, NET_H, REACH_MAX_Y, REACH_MIN_Y, HOME_Z, SERVE_Z, DT, LEVELS, LENGTHS, STYLES } from './consts.js';
import { flyOut } from './phys.js';
import { heightClass, planShot, powerTable, classifySwipe, swipeAim, aimFrom, clamp, OPTIONS } from './shots.js';
import { decide, evaluate, errSigma, capsFor } from './ai.js';

const HUMAN_L = { id: 0, name: 'You', speed: 5.7, react: 0.07, aim: 1.0, err: 0, temp: 0.2, smash: 64, reachR: 1.18, judge: 1, accel: 20 };
export const sideOf = (i) => (i === 0 ? 1 : -1);

// time for a player starting at rest to cover d metres (accelerate, cruise)
const tMove = (d, v, a) => (d <= 0 ? 0 : d <= (v * v) / a ? 2 * Math.sqrt(d / a) : d / v + v / a);

export function createSim(cfg, rng) {
  const r = rng;
  const L = [cfg.aiNear ? LEVELS[clamp(cfg.nearLevel || 3, 1, 5)] : HUMAN_L, LEVELS[clamp(cfg.level || 3, 1, 5)]];
  const powerOf = (who) => (who === 0 && !cfg.aiNear ? 1 : (L[who].id / 5) * 0.9 + 0.1);
  const decs = [null, null]; let serveDec = null;
  // the feeder (Rally Challenge) never slips
  if (cfg.mode === 'rally') L[1] = { ...L[1], err: 0, aim: Math.min(L[1].aim, 0.7) };
  const style = [cfg.nearStyle || 'allround', cfg.style || 'allround'];
  const len = LENGTHS[cfg.lengthId] || LENGTHS.to21;
  const target = cfg.target || len.target, cap = cfg.cap || len.cap, gamesTotal = cfg.games || len.games;
  const s = {
    v: 1, mode: cfg.mode || 'match', t: 0, tick: 0, acc: 0, phase: 'serve', timeScale: 1,
    score: [0, 0], games: [0, 0], gameNo: 1, gamesTotal, target, cap, server: cfg.firstServer ?? 0, winner: -1, matchWinner: -1, gameWinner: -1,
    rally: 0, bestRally: 0, challenge: { returns: 0, over: false },
    players: [0, 1].map((i) => ({ i, side: sideOf(i), x: 0, z: sideOf(i) * HOME_Z, vx: 0, vz: 0, face: i === 0 ? Math.PI : 0, level: L[i].id, style: style[i], sw: null, run: 0, goalX: 0, goalZ: sideOf(i) * HOME_Z, lastHit: -9 })),
    shuttle: { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, vis: false, lastHit: -1, age: 0, kind: 'held' },
    plan: null, intent: null, serve: null, hold: null, msg: null, pointT: 0, resumeT: 0,
    events: [], eid: 0, stats: [{ shots: 0, smashes: 0, winners: 0, errors: 0, perfect: 0 }, { shots: 0, smashes: 0, winners: 0, errors: 0, perfect: 0 }],
    cfg: { watch: !!cfg.watch, mode: cfg.mode || 'match', lengthId: cfg.lengthId || 'to21' },
    flash: null,
  };
  if (cfg.resume) Object.assign(s, { score: cfg.resume.score.slice(), games: cfg.resume.games.slice(), gameNo: cfg.resume.gameNo, server: cfg.resume.server });
  let fl = null;            // current flight { samples, end, k0, serve }
  let pend = null;          // pending human input (swipe) not yet consumed by a tick
  const ev = (type, o = {}) => { s.events.push({ id: s.eid++, type, t: s.t, ...o }); if (s.events.length > 60) s.events.splice(0, s.events.length - 40); };
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += r.next(); return (u - 2) * 1.7320508; };   // ~N(0,1)

  // ---- serve set-up ---------------------------------------------------------------------------------------------------------------------------
  const serveX = (srv) => { const even = s.score[srv] % 2 === 0; return (even ? 1 : -1) * sideOf(srv) * 1.35; };
  function setupServe() {
    s.phase = 'serve'; s.plan = null; s.intent = null; fl = null; s.rally = 0; s.msg = s.msg;
    const sv = s.server, rc = 1 - sv, sx = serveX(sv);
    const ps = s.players[sv], pr = s.players[rc];
    ps.goalX = sx; ps.goalZ = sideOf(sv) * SERVE_Z; pr.goalX = -sx; pr.goalZ = sideOf(rc) * 3.5;
    ps.sw = null; pr.sw = null;
    s.shuttle.vis = true; s.shuttle.kind = 'held'; s.shuttle.lastHit = -1;
    s.serve = { t0: s.t, tcTick: null, intent: null, srv: sv }; serveDec = null; decs[0] = decs[1] = null;
    s.hold = null;
  }
  const serveContact = (sv) => { const p = s.players[sv]; return { x: p.x + (sv === 0 ? 0.0 : 0.0), y: 0.95, z: p.z - sideOf(sv) * 0.25 }; };
  function placeHeld() {
    const sv = s.serve ? s.serve.srv : s.server, p = s.players[sv];
    const c = { x: p.x + 0.1 * -sideOf(sv), y: 1.15, z: p.z - sideOf(sv) * 0.3 };
    s.shuttle.x = c.x; s.shuttle.y = c.y; s.shuttle.z = c.z; s.shuttle.vx = s.shuttle.vy = s.shuttle.vz = 0;
  }

  // ---- movement ---------------------------------------------------------------------------------------------------------------------------------
  function move(p, gx, gz, vmax, acc) {
    const dx = gx - p.x, dz = gz - p.z, d = Math.hypot(dx, dz);
    let tvx = 0, tvz = 0;
    if (d > 0.015) { const sp = Math.min(vmax, Math.sqrt(2 * acc * d) * 0.9); tvx = (dx / d) * sp; tvz = (dz / d) * sp; }
    const dvx = tvx - p.vx, dvz = tvz - p.vz, dv = Math.hypot(dvx, dvz), mx = acc * DT;
    if (dv > mx) { p.vx += (dvx / dv) * mx; p.vz += (dvz / dv) * mx; } else { p.vx = tvx; p.vz = tvz; }
    p.x += p.vx * DT; p.z += p.vz * DT;
    p.x = clamp(p.x, -HW - 1.6, HW + 1.6);
    const sz = p.z * p.side; p.z = p.side * clamp(sz, 0.3, HL + 2.2);
    p.run = Math.hypot(p.vx, p.vz);
  }

  // ---- planning the interception ---------------------------------------------------------------------------------------------------------------------
  function makePlan(who) {
    const p = s.players[who], Lv = L[who], side = p.side;
    const samples = fl.samples;
    const end = fl.end;
    const margin = Math.max(Math.abs(end.x) - HW, Math.abs(end.z) - HL);
    const outLand = end.kind === 'land' && margin > 0;
    const wrongSide = end.kind === 'land' && Math.sign(end.z) !== side;       // falls on the hitter's own side
    const onNet = end.kind === 'net';
    let letGo = false;
    if (onNet || wrongSide) letGo = true;
    else if (outLand) { letGo = who === 0 ? margin > 0.28 : margin > 0.1 && r.next() < Lv.judge; }
    const react = Lv.react, yPref = who === 0 ? 2.5 : 2.35 + 0.15 * Lv.judge;
    const reachR = Lv.reachR;
    let pick = null, last = null, stretch = false;
    if (!letGo) {
      const i0 = Math.ceil(react / DT);
      for (let i = Math.max(1, i0); i < samples.length; i++) {
        const q = samples[i];
        if (Math.sign(q.z) !== side || Math.abs(q.z) > HL + 2.2 || Math.abs(q.x) > HW + 2.0) continue;
        if (q.y > REACH_MAX_Y || q.y < REACH_MIN_Y) continue;
        const d = Math.max(0, Math.hypot(q.x - p.x, q.z - p.z) - reachR * 0.9);
        const tNeed = react + tMove(d, Lv.speed, Lv.accel);
        if (tNeed <= q.t + 0.02) { last = { q, i, slack: q.t - tNeed }; if (q.y <= yPref) { pick = last; break; } }
      }
      if (!pick) pick = last;
      if (!pick) {
        // out of reach: the player still runs to the last point he could hit it, but he will probably miss
        for (let i = samples.length - 1; i >= 1; i--) { const q = samples[i]; if (Math.sign(q.z) === side && q.y >= 0.25 && q.y <= REACH_MAX_Y) { pick = { q, i, slack: -0.3 }; break; } }
        stretch = true;
      }
    }
    if (!pick) { s.plan = { who, letGo: true, tcTick: -1, tc: 0, spot: null, cls: 'low', landX: end.x, landZ: end.z, kind: end.kind, out: outLand, stretch: false, rush: 0, fast: false, flight: end.t }; p.sw = null; return; }
    const q = pick.q, tcTick = fl.k0 + pick.i, cls = heightClass(q.y);
    const rush = clamp(1 - pick.slack / 0.28, 0, 1);
    s.plan = { who, letGo: false, tcTick, tc: tcTick * DT, spot: { x: q.x, y: q.y, z: q.z }, cls, landX: end.x, landZ: end.z, kind: end.kind, out: outLand, stretch, rush, fast: fl.samples[pick.i].t < 0.95 && (fl.v0 > 40), flight: end.t, tHit: fl.k0 * DT, vIn: Math.hypot(q.vx, q.vy, q.vz), decided: false };
    // the player's stance: racket-side of the shuttle and a little behind it
    const behind = cls === 'over' ? 0.32 : cls === 'mid' ? 0.2 : 0.1;
    p.goalX = q.x - 0.42 * side + 0 * clamp(q.vx, -1, 1);
    p.goalZ = q.z + side * behind;
    p.sw = { t0: Math.max(s.t, tcTick * DT - 0.62), tc: tcTick * DT, cls, forehand: (q.x - p.x) * side >= -0.1 || cls === 'over', shot: null, y: q.y, x: q.x, z: q.z };
    p.decideAt = Math.max(s.t + 0.02, tcTick * DT - 0.36);
    if (who === 0 && !cfg.aiNear) s.timeScale = s.plan.fast ? 0.62 : 1;
    s.plan.react = react;
  }

  // ---- stroke execution ------------------------------------------------------------------------------------------------------------------------------
  function strike(who, type, aim, q, contact, extra = {}) {
    const p = s.players[who], side = p.side, Lv = L[who];
    const caps = capsFor(Lv, powerOf(who));
    if (who === 0 && !cfg.aiNear) { caps.smash = 52 + 12 * q; caps.clear *= 0.86 + 0.14 * q; caps.lift *= 0.86 + 0.14 * q; caps.drive *= 0.88 + 0.12 * q; }
    // human-like misjudgement: a computer player sometimes overhits (long) or aims too close to the side line
    if ((who === 1 || cfg.aiNear) && s.mode !== 'rally' && type !== 'net' && type !== 'block' && r.next() < L[who].err * 3 + 0.015) {
      if (r.next() < 0.55) aim = { x: aim.x, d: aim.d + 0.7 + r.next() * 1.1 };
      else aim = { x: aim.x + (aim.x >= 0 ? 1 : -1) * (0.5 + r.next() * 0.9), d: aim.d };
    }
    let res = planShot(type, contact, aim, side, caps);
    if (!res) res = planShot('safe', contact, { x: 0, d: 5 }, side, caps);
    // execution noise: speed, elevation and direction (smaller with good timing, larger when rushed or stretched)
    const rush = s.plan && s.plan.who === who ? s.plan.rush : 0;
    const qe = clamp(q * (1 - 0.4 * rush), 0.05, 1);
    const k = Lv.aim * (who === 0 && !cfg.aiNear ? 1 : 0.9);
    const sv = (0.012 + 0.05 * (1 - qe)) * k, sth = (0.3 + 1.5 * (1 - qe)) * k, saz = (0.45 + 1.8 * (1 - qe)) * k;
    const D2R = Math.PI / 180;
    let v = res.v * (1 + gauss() * sv), th = (res.th + gauss() * sth) * D2R, az = Math.atan2(res.ux, res.uz) + gauss() * saz * D2R;
    const ux = Math.sin(az), uz = Math.cos(az);
    const sh = s.shuttle;
    sh.x = contact.x; sh.y = contact.y; sh.z = contact.z;
    sh.vx = v * Math.cos(th) * ux; sh.vy = v * Math.sin(th); sh.vz = v * Math.cos(th) * uz;
    sh.vis = true; sh.kind = 'flight'; sh.lastHit = who; sh.age = 0;
    fl = { samples: null, end: null, k0: s.tick, v0: v, serve: !!extra.serve };
    const f = flyOut(sh, 600, true);
    fl.samples = f.samples; fl.end = f.end; fl.n = 0;
    s.rally++; s.bestRally = Math.max(s.bestRally, s.rally);
    const st = s.stats[who]; st.shots++; if (type === 'smash') st.smashes++; if (extra.grade === 'perfect') st.perfect++;
    p.lastHit = s.t; if (p.sw) { p.sw.shot = type; p.sw.q = q; p.sw.grade = extra.grade || ''; p.sw.vOut = v; p.sw.hitT = s.t; }
    ev('hit', { who, shot: type, v, q, grade: extra.grade || '', x: contact.x, y: contact.y, z: contact.z, serve: !!extra.serve, aimX: aim.x, aimD: aim.d, landX: f.end.x, landZ: f.end.z, kind: f.end.kind });
    if (f.end.cord) ev('cord', {});
    s.plan = null; s.intent = null; s.timeScale = 1;
    // the opponent plans his answer; the hitter recovers
    p.goalX = 0 + clamp(contact.x * 0.1, -0.3, 0.3); p.goalZ = side * HOME_Z;
    makePlan(1 - who);
    const rp = s.players[1 - who];
    if (!s.plan || s.plan.letGo) { rp.goalX = rp.x; rp.goalZ = rp.z; }
  }

  // The computer's decision for player `who` at the current plan (or serve). Returns the decision object (also used by Think).
  function aiContext(who, plan, serveMode) {
    const p = s.players[who], o = s.players[1 - who], side = p.side;
    const Lv = L[who];
    const caps = capsFor(Lv, powerOf(who));
    const contact = serveMode ? serveContact(who) : plan.spot;
    const rush = serveMode ? 0 : plan.rush;
    return { side, contact, cls: serveMode ? 'low' : plan.cls, me: { L: Lv, style: style[who] }, opp: { x: o.x, z: o.z, vx: o.vx, vz: o.vz, L: L[1 - who] }, caps, serve: !!serveMode, serveSign: 0, quality: who === 0 && !cfg.aiNear ? 0.88 : 0.92, rush };
  }
  function aiDecide(who, plan, serveMode) {
    const ctx = aiContext(who, plan, serveMode);
    // serve sign: the shuttle goes to the diagonal court: x sign opposite to the server's x
    ctx.serveSign = serveMode ? (serveX(who) >= 0 ? -1 : 1) : 0;
    if (s.mode === 'rally' && who === 1 && !serveMode) return feederDecide(ctx);
    return decide(ctx, r);
  }
  function feederDecide(ctx) {
    const list = evaluate(ctx).filter((c) => c.pOK > 0.9 && c.type !== 'smash');
    if (!list.length) return decide(ctx, r);
    const diff = Math.min(1, s.challenge.returns / 26);
    const tau = -0.9 + 1.5 * diff;
    list.sort((a, b) => Math.abs(a.pressure - tau) - Math.abs(b.pressure - tau));
    const pool = list.slice(0, 6), c = pool[Math.floor(r.next() * pool.length)];
    return { ...c, summary: '', reason: '' };
  }
  function suggestFor(who) {
    if (s.phase === 'serve' && s.serve && s.serve.srv === who) {
      const ctx = aiContext(who, null, true); ctx.serveSign = serveX(who) >= 0 ? -1 : 1;
      return decide(ctx, null);
    }
    if (s.plan && s.plan.who === who && !s.plan.letGo) return decide(aiContext(who, s.plan, false), null);
    return null;
  }

  // ---- point / game / match flow --------------------------------------------------------------------------------------------------------------------
  function endPoint(winner, why, extra = {}) {
    const loser = 1 - winner;
    s.score[winner]++;
    s.server = winner;
    s.phase = 'point'; s.pointT = s.t + 1.55; s.timeScale = 1; s.plan = null; s.intent = null;
    if (why === 'winner') s.stats[winner].winners++; else if (why === 'out' || why === 'net' || why === 'fault') s.stats[loser].errors++;
    s.msg = { why, winner, t: s.t, ...extra };
    ev('point', { winner, why, score: s.score.slice(), ...extra });
    if (s.mode === 'rally' && winner === 1) { s.challenge.over = true; s.phase = 'over'; s.matchWinner = 1; s.winner = 1; ev('match', { winner: 1 }); return; }
    const a = s.score[winner], b = s.score[loser];
    const gameWon = (a >= s.target && a - b >= 2) || a >= s.cap;
    if (gameWon) {
      s.games[winner]++; s.gameWinner = winner;
      const need = Math.ceil(s.gamesTotal / 2);
      if (s.games[winner] >= need) { s.matchWinner = winner; s.winner = winner; s.phase = 'over'; ev('game', { winner, final: true }); ev('match', { winner }); return; }
      s.phase = 'gamebreak'; s.pointT = s.t + 2.8; ev('game', { winner, final: false });
    }
  }
  function nextAfterPoint() {
    if (s.phase === 'gamebreak') { s.score = [0, 0]; s.gameNo++; s.gameWinner = -1; }
    setupServe();
  }

  function landed() {
    const e = fl.end, last = s.shuttle.lastHit, rec = 1 - last;
    s.shuttle.kind = 'down'; s.shuttle.y = 0; s.shuttle.x = e.x; s.shuttle.z = e.z; s.shuttle.vx = s.shuttle.vy = s.shuttle.vz = 0;
    if (e.kind === 'net') { ev('net', { who: last }); endPoint(rec, 'net', { x: e.x, z: e.z }); return; }
    const onHitterSide = Math.sign(e.z) === sideOf(last);
    const inside = Math.abs(e.x) <= HW + 0.002 && Math.abs(e.z) <= HL + 0.002;
    ev('land', { x: e.x, z: e.z, inside, serve: fl.serve });
    if (onHitterSide) { endPoint(rec, 'net', { x: e.x, z: e.z }); return; }
    if (fl.serve) {
      const sx = serveX(last);
      const ok = e.x * sx < 0 && Math.abs(e.x) <= HW && Math.abs(e.z) >= SHORT && Math.abs(e.z) <= HL;
      if (!ok) { endPoint(rec, 'fault', { x: e.x, z: e.z, detail: Math.abs(e.z) < SHORT ? 'short' : e.x * sx > 0 ? 'wrongcourt' : 'out' }); return; }
    }
    if (!inside) { endPoint(rec, 'out', { x: e.x, z: e.z }); return; }
    endPoint(last, 'winner', { x: e.x, z: e.z });
  }

  // ---- the tick ---------------------------------------------------------------------------------------------------------------------------------------
  const SW_LEAD = 0.18;
  function humanSwipe(sw) {
    const pl = s.plan, human = !cfg.aiNear;
    if (!human) return;
    if (s.phase === 'serve' && s.serve && s.serve.srv === 0 && s.serve.tcTick === null && s.t - s.serve.t0 > 0.5) {
      const cl = sw.tap ? { kind: 'serveShort', f: 0.4 } : (() => { const c = classifySwipe(sw, 'low'); return { kind: Math.max(sw.F, 0) >= 230 ? 'serveLong' : 'serveShort', f: c.f }; })();
      const a = swipeAim(sw, cl.kind);
      const sx = serveX(0), sign = sx >= 0 ? -1 : 1;
      // aim inside the diagonal box: straight = the middle of the box, lean across = towards the centre line or the side line
      const center = 1.3, lean = sign > 0 ? a : -a;           // lean in court x
      const x = clamp(sign * center + a * 1.0, sign > 0 ? 0.25 : -2.3, sign > 0 ? 2.3 : -0.25);
      const dr = cl.kind === 'serveLong' ? [5.55, 6.35] : [SHORT + 0.2, SHORT + 0.9];
      const f = cl.kind === 'serveLong' ? clamp((Math.max(sw.F, 0) - 230) / 250, 0, 1) : clamp(cl.f, 0, 1);
      s.serve.intent = { type: cl.kind, aim: { x, d: dr[0] + (dr[1] - dr[0]) * f } };
      s.serve.tcTick = s.tick + 16;
      s.players[0].sw = { t0: s.t, tc: (s.tick + 16) * DT, cls: 'serve', forehand: true, shot: cl.kind, y: 0.95, x: s.players[0].x, z: s.players[0].z };
      return;
    }
    if (!pl || pl.who !== 0 || pl.letGo || !pl.spot) return;
    if (s.t > pl.tc + 0.07) return;
    const dtc = pl.tc - s.t;
    const cl = sw.tap ? { kind: 'safe', f: 0.5 } : classifySwipe(sw, pl.cls);
    const a = swipeAim(sw, cl.kind);
    const kap = clamp((pl.flight || 1.1) / 1.1, 0.55, 1.4);
    let grade, q;
    if (dtc < -0.02) { grade = 'late'; q = 0.5; }
    else if (dtc < 0.03) { grade = 'good'; q = 0.82; }
    else if (dtc <= 0.28 * kap) { grade = 'perfect'; q = 1; }
    else if (dtc <= 0.55 * kap) { grade = 'good'; q = 0.82; }
    else { grade = 'early'; q = 0.62; }
    s.intent = { shot: cl.kind, aim: aimFrom(cl.kind, cl.f, a, 1), q, grade, tSwipe: s.t, sw: { F: sw.F, Lx: sw.Lx } };
    const p0 = s.players[0]; if (p0.sw) p0.sw.shot = cl.kind;
    ev('intent', { shot: cl.kind, grade });
  }

  function executePlanned() {
    const pl = s.plan; if (!pl || pl.letGo || !pl.spot) return;
    const who = pl.who, p = s.players[who];
    // the computer decides a little before contact
    if (who === 1 || cfg.aiNear) {
      if (!decs[who] && s.t >= p.decideAt) {
        decs[who] = aiDecide(who, pl, false);
        if (cfg.watch && who === 0) { s.hold = { id: s.eid++, who, t0: s.t, dec: slim(decs[who]), kind: 'rally' }; return; }
      }
    }
    if (s.tick < pl.tcTick) return;
    const sp = pl.spot;
    // reach check at the contact tick
    const dist = Math.hypot(p.x - sp.x, p.z - sp.z);
    const reach = L[who].reachR + (sp.y < 1.0 ? 0.2 : 0);
    if (pl.stretch || dist > reach + 0.05) {
      if (!pl.missed) { pl.missed = true; ev('miss', { who, dist }); }
      if (s.tick > pl.tcTick + 6) { s.plan = { ...pl, letGo: true }; if (p.sw) p.sw.shot = 'miss'; }
      return;
    }
    let type, aim, q, grade = '';
    if (who === 1 || cfg.aiNear) {
      const d = decs[who]; decs[who] = null;
      if (d) { type = d.type; aim = d.aim; } else { type = 'safe'; aim = { x: 0, d: 5 }; }
      q = 0.9; grade = 'good';
      if (r.next() < L[who].err) { q = 0.18; grade = 'slip'; }
      if (s.mode === 'rally') q = 0.95;
    } else if (s.intent) {
      type = s.intent.shot; aim = s.intent.aim; q = s.intent.q; grade = s.intent.grade;
    } else {
      if (s.tick < pl.tcTick + 4) return;
      // no swipe in time: a weak automatic return
      type = pl.cls === 'over' ? 'clear' : 'lift'; aim = { x: 0, d: 4.6 }; q = 0.34; grade = 'auto';
    }
    // the stroke must be possible from this height (a smash needs a high contact)
    if (!OPTIONS[pl.cls].includes(type) && type !== 'safe') type = pl.cls === 'over' ? 'clear' : 'lift';
    if (s.mode === 'rally' && who === 0) s.challenge.returns++;
    if (who === 0 && grade) s.flash = { text: grade, t: s.t, shot: type };
    strike(who, type, aim, q, { x: sp.x, y: sp.y, z: sp.z }, { grade });
    if (s.mode === 'rally' && who === 0) ev('returns', { n: s.challenge.returns });
  }

  function doServe() {
    const sv = s.serve.srv, p = s.players[sv], c = serveContact(sv);
    const it = s.serve.intent;
    const q = sv === 0 && !cfg.aiNear ? 0.85 : 0.9;
    s.stats[sv].shots += 0;
    s.serve.done = true;
    strike(sv, it.type, it.aim, r.next() < (sv === 1 ? L[1].err * 0.5 : 0) ? 0.2 : q, c, { serve: true, grade: 'good' });
    s.phase = 'rally';
    ev('serve', { who: sv });
  }

  function slim(d) { return { type: d.type, aim: d.aim, summary: d.summary, reason: d.reason, pressure: d.pressure, pOK: d.pOK, landX: d.r.landX, landZ: d.r.landZ, t: d.r.t, zone: d.zone }; }

  function tickOnce() {
    s.tick++; s.t = s.tick * DT;
    if (pend) { const sw = pend; pend = null; humanSwipe(sw); }
    switch (s.phase) {
      case 'serve': {
        const sv = s.serve.srv, rc = 1 - sv;
        for (const i of [0, 1]) { const p = s.players[i]; move(p, p.goalX, p.goalZ, 3.6, 12); }
        placeHeld();
        const sr = s.serve;
        const ready = s.t - sr.t0 > 0.9;
        if ((sv === 1 || cfg.aiNear) && ready && sr.tcTick === null) {
          if (!serveDec) {
            serveDec = aiDecide(sv, null, true);
            if (cfg.watch && sv === 0) { s.hold = { id: s.eid++, who: sv, t0: s.t, dec: slim(serveDec), kind: 'serve' }; return; }
          }
          if (s.t - sr.t0 > (cfg.watch ? 1.0 : 1.4) + 0.2 * (L[sv].id % 3)) { sr.intent = { type: serveDec.type, aim: serveDec.aim }; sr.tcTick = s.tick + 16; s.players[sv].sw = { t0: s.t, tc: (s.tick + 16) * DT, cls: 'serve', forehand: true, shot: serveDec.type, y: 0.95, x: s.players[sv].x, z: s.players[sv].z }; }
        }
        if (sv === 0 && !cfg.aiNear && sr.tcTick === null && s.t - sr.t0 > 12) { sr.intent = { type: 'serveShort', aim: { x: serveX(0) >= 0 ? -1.3 : 1.3, d: 2.5 } }; sr.tcTick = s.tick + 16; }
        if (sr.tcTick !== null && s.tick >= sr.tcTick) doServe();
        break;
      }
      case 'rally': {
        // shuttle
        fl.n++;
        const sm = fl.samples[Math.min(fl.n, fl.samples.length - 1)];
        const sh = s.shuttle; sh.x = sm.x; sh.y = sm.y; sh.z = sm.z; sh.vx = sm.vx; sh.vy = sm.vy; sh.vz = sm.vz; sh.age += DT;
        for (const i of [0, 1]) {
          const p = s.players[i], Lv = L[i];
          const active = s.plan && s.plan.who === i && !s.plan.letGo;
          const hitterRecover = !active;
          move(p, p.goalX, p.goalZ, active ? Lv.speed : Lv.speed * 0.8, Lv.accel);
        }
        if (fl.n >= fl.samples.length - 1) {
          // a pending human swipe cannot outlive the flight
          landed();
          break;
        }
        executePlanned();
        // slow motion ends once the contact is over
        if (s.plan && s.plan.who === 0 && s.tick > s.plan.tcTick + 8) s.timeScale = 1;
        break;
      }
      case 'point': case 'gamebreak': {
        for (const i of [0, 1]) { const p = s.players[i]; move(p, p.x * 0.98, p.z, 1, 8); }
        if (s.t >= s.pointT) nextAfterPoint();
        break;
      }
      default: break;
    }
  }

  setupServe();
  s.t = 0;
  for (const p of s.players) { p.x = p.goalX; p.z = p.goalZ; }
  placeHeld();

  return {
    s,
    // ctl: { swipe: { F, Lx, tap }, } once per tick
    update(dt, ctl) {
      if (ctl && ctl.swipe) pend = ctl.swipe;
      if (s.hold) return;
      if (s.phase === 'over') { s.events.length > 0 && 0; return; }
      s.acc += Math.min(dt, 0.1) / DT * s.timeScale;
      let n = 0;
      while (s.acc >= 1 && n < 6) {
        s.acc -= 1; n++;
        tickOnce();
        if (s.hold) break;
      }
    },
    release() { if (s.hold) { s.hold = null; } },
    suggest(who = 0) {
      const d = suggestFor(who);
      return d ? slim(d) : null;
    },
    // lets the HUD ask what a swipe would do right now
    classify(sw) { return s.plan ? classifySwipe(sw, s.plan.cls) : null; },
    // for Watch & Learn: human is an AI (aiNear)
    caps: (who) => capsFor(L[who], powerOf(who)),
    level: (i) => L[i],
    serveBox: () => (s.serve ? { sign: serveX(s.serve.srv) >= 0 ? -1 : 1, srv: s.serve.srv } : null),
  };
}

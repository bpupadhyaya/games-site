// The match: innings, balls, scoring, the live ball (fielding, running, throwing). No drawing, no input
// handling. Operates on a plain JSON `m` so the whole match is part of getState(). R = { m, f, a } rngs.
import { THEMES, LEVELS, clamp, DT } from './core.js';
import { flyDelivery, flyBall, resolveSwing, trackPos, shotName, ASSIST, TYPES } from './ball.js';
import { buildField, planFielding, PRESETS, sectorOf, throwTime, THROW_SPEED, rearField } from './field.js';
import { teamNames, boundaryLine, runsLine, wicketLine, missLines, edgeLines, wideLine, noBallLine, byeLine, droppedLine, overLine } from './words.js';
import { planDelivery, planBat, captainPreset, runAdvice, aiMargin } from './ai.js';

export const RUN_SPEED = 7.4; // batters, m/s
export const READY_T = 0.95;

export const MODES = {
  chase5: { name: 'Chase 5 overs', overs: 5, wkts: 5, roles: ['bat'], rr: 9.2 },
  chase10: { name: 'Chase 10 overs', overs: 10, wkts: 7, roles: ['bat'], rr: 7.9, lv: [0.93, 0.90, 0.88, 0.85] },
  chase20: { name: 'Chase 20 overs', overs: 20, wkts: 10, roles: ['bat'], rr: 8.0, lv: [0.68, 0.62, 0.55, 0.52] },
  full5: { name: 'Full match, 5 overs', overs: 5, wkts: 5, roles: ['bowl', 'bat'], rr: 9.2 },
  super: { name: 'Super Over', overs: 1, wkts: 2, roles: ['bat'], rr: 12.5, lv: [0.80, 1.04, 1.15, 1.24] },
  yard: { name: 'Classic Backyard', overs: 4, wkts: 4, roles: ['bat'], rr: 8.7, rules: { extras: false, bin: true }, theme: 'backyard' },
  tippy: { name: 'Tippy-Go', overs: 4, wkts: 4, roles: ['bat'], rr: 7.2, lv: [0.93, 0.93, 0.88, 0.90], rules: { extras: false, bin: true, tippy: true }, theme: 'backyard' },
  ohob: { name: 'One-Hand One-Bounce', overs: 4, wkts: 4, roles: ['bat'], rr: 8.8, rules: { extras: false, bin: true, ohob: true }, theme: 'backyard' },
  sixout: { name: 'Six and Out', overs: 4, wkts: 4, roles: ['bat'], rr: 8.5, rules: { extras: false, bin: true, sixOut: true }, theme: 'backyard' },
  daily: { name: 'Daily Innings', overs: 5, wkts: 5, roles: ['bat'], rr: 9.2 },
  auto: { name: 'Auto Play', overs: 5, wkts: 5, roles: ['bat'], rr: 11, ai: true },
};

export function createMatch(cfg, R) {
  const mode = MODES[cfg.mode];
  const theme = cfg.theme ?? mode.theme ?? 'stadium';
  const rules = { extras: true, bin: false, tippy: false, ohob: false, sixOut: false, ...(mode.rules ?? {}) };
  const level = LEVELS[cfg.level ?? 1];
  const names = teamNames(R.m, (mode.wkts + 1) + 6);
  const m = {
    mode: cfg.mode, theme, rules, lvl: cfg.level ?? 1, hand: cfg.hand ?? 1, assist: cfg.assist ?? 1,
    overs: mode.overs, wkts: mode.wkts, roles: mode.roles, ai: !!mode.ai, freeze: !!mode.ai,
    names: { bat: names.slice(0, mode.wkts + 1), bowl: names.slice(mode.wkts + 1) },
    innNo: -1, inns: [], inn: null,
    phase: 'ready', pt: 0, ft: 0, ev: [], hold: false,
    field: null, fieldKey: 'balanced', fieldNotes: [], fieldPick: 'balanced',
    d: null, sw: null, res: null, live: null, next: null, aim: null, aiPlan: null,
    call: null, hints: 3, runT: 1, over: false, result: null, winShot: null, lastHit: null,
    t: 0, firstTarget: 0,
  };
  // Targets are tuned so a decent player wins about 70 / 50 / 30 / 15 percent against the four opponents.
  const per = mode.rr * (mode.lv ? mode.lv[cfg.level ?? 1] : level.tgt) * R.m.range(0.93, 1.07);
  m.firstTarget = Math.max(8, Math.round(per * mode.overs));
  startInnings(m, R);
  return m;
}

function newInnings(m, role, target) {
  const maxBalls = m.overs * 6;
  const batNames = role === 'bat' ? m.names.bat : m.names.bowl.concat(m.names.bat).slice(0, m.wkts + 1);
  const bowlNames = role === 'bat' ? m.names.bowl : m.names.bat;
  return {
    role, ai: role === 'bowl' || m.ai, runs: 0, wk: 0, balls: 0, maxBalls, maxWk: m.wkts, target,
    batters: batNames.map((n) => ({ name: n, runs: 0, balls: 0, f4: 0, f6: 0, out: null })),
    ends: [0, 1], nextBat: 2, over: [], overRuns: 0, overWk: 0, extras: { wd: 0, nb: 0, b: 0 }, fh: false,
    bowlers: bowlNames.slice(0, 5).map((n, i) => ({ name: n, kind: i % 2 === 0 ? 'pace' : 'spin', balls: 0, runs: 0, wk: 0 })),
    zones: [0, 0, 0, 0, 0, 0, 0, 0], zoneRuns: [0, 0, 0, 0, 0, 0, 0, 0], recent: [], shorts: 0, sixes: 0, fours: 0,
    done: false, result: null, log: [], balls6: 0,
  };
}

export function startInnings(m, R) {
  m.innNo += 1;
  const role = m.roles[m.innNo];
  let target = null;
  if (role === 'bat') target = m.innNo > 0 ? m.inns[m.innNo - 1].runs + 1 : m.firstTarget;
  m.inn = newInnings(m, role, target);
  m.inns.push(m.inn);
  m.phase = 'ready'; m.pt = 0; m.d = null; m.sw = null; m.res = null; m.live = null; m.call = null;
  m.hints = 3;
  m.fieldPick = 'balanced';
  setupOver(m, R);
  prepareBall(m, R);
  if (role === 'bowl') { m.phase = 'overbreak'; m.hold = true; m.pt = 1.1; m.d = null; }
  else if (target != null) setCall(m, `TARGET ${target}! ${m.overs === 1 ? 'One over' : m.overs + ' overs'}, ${m.wkts} wickets. Chase it down.`, 'info', true, true);
}

export const strikerOf = (m) => m.inn.batters[m.inn.ends[0]];
export const nonStrikerOf = (m) => m.inn.batters[m.inn.ends[1]];
export const bowlerOf = (m) => { const i = m.inn; const o = Math.floor(i.balls / 6); return i.bowlers[o % i.bowlers.length]; };
export const ballsLeft = (m) => m.inn.maxBalls - m.inn.balls;
export function requiredRate(m) {
  const i = m.inn;
  if (i.target == null) return null;
  const need = i.target - i.runs, bl = ballsLeft(m);
  return bl > 0 ? (need / bl) * 6 : 99;
}
export const runRate = (m) => (m.inn.balls ? (m.inn.runs / m.inn.balls) * 6 : 0);

// ---- over / ball preparation ------------------------------------------------------------------------------
export function setupOver(m, R) {
  const lvl = LEVELS[m.lvl];
  const i = m.inn;
  const old = m.field ? m.field.map((f) => [f.x, f.z]) : null; // fielders walk from here to the new field
  const b = bowlerOf(m);
  if (i.role === 'bat') {
    const key = captainPreset(m, b, R.a);
    const heat = i.zones.map((v) => v);
    const built = buildField(key, m.theme, lvl, R.a, heat);
    let fs = built.fielders;
    if (m.theme === 'backyard') fs = fs.filter((f, k) => f.role !== 'field' || k <= 5).map((f, k) => ({ ...f, id: k }));
    fs.forEach((f, k) => { f.id = k; });
    m.field = fs; m.fieldKey = key; m.fieldNotes = built.notes;
  } else {
    const built = buildField(m.fieldPick, m.theme, lvl, R.a, null);
    let fs = built.fielders;
    if (m.theme === 'backyard') fs = fs.filter((f, k) => f.role !== 'field' || k <= 5);
    fs.forEach((f, k) => { f.id = k; });
    m.field = fs; m.fieldKey = m.fieldPick; m.fieldNotes = [];
  }
  if (old && old.length) m.field.forEach((f, k) => { const o = old[Math.min(k, old.length - 1)]; f.sx = o[0]; f.sz = o[1]; });
  i.shorts = 0; i.overRuns = 0; i.overWk = 0;
}

// Fielders jog back to their places (or to the captain's new field) between balls instead of snapping there.
// Planning always uses the home positions; the glide is cosmetic and is finished before the ball is released.
export const GLIDE_T = 1.5;
function startGlide(m) {
  m.gl = false; m.gt = 0;
  for (const f of m.field) {
    const sx = f.sx ?? f.x, sz = f.sz ?? f.z;
    delete f.sx; delete f.sz;
    f.gx = sx; f.gz = sz; // glide start (home positions are f.x0 / f.z0)
    if (Math.hypot(sx - f.x0, sz - f.z0) > 0.3) m.gl = true;
  }
  if (m.gl) glideField(m, 0);
}
export function glideField(m, dt) {
  if (!m.gl) return;
  m.gt += dt;
  const u = clamp(m.gt / GLIDE_T, 0, 1), e = u * u * (3 - 2 * u);
  for (const f of m.field) {
    if (f.gx === undefined) continue;
    const nx = f.gx + (f.x0 - f.gx) * e, nz = f.gz + (f.z0 - f.gz) * e;
    const dx = nx - f.x, dz = nz - f.z, dl = Math.hypot(dx, dz);
    if (dl > 0.001 && dt > 0) { f.fx = dx / dl; f.fz = dz / dl; f.run = 1; } else if (u >= 1) f.run = 0;
    f.x = nx; f.z = nz;
  }
  if (u >= 1) { m.gl = false; rearField(m.field); }
}

export function prepareBall(m, R) {
  const i = m.inn;
  m.sw = null; m.res = null; m.live = null; m.aiPlan = null; m.ft = 0;
  for (const f of m.field) if (f.sx === undefined) { f.sx = f.x; f.sz = f.z; }
  rearField(m.field);
  if (i.role === 'bat') {
    const b = bowlerOf(m);
    const pl = planDelivery(m, b, R.a);
    m.d = flyDelivery(pl.spec, m.theme, m.rules.bin ? 'bin' : 'stumps');
    m.next = { type: pl.spec.type, bowler: b.name, why: pl.why };
    m.runT = pl.spec.type === 'offspin' || pl.spec.type === 'legspin' ? 0.8 : 1.05;
    m.phase = 'ready'; m.pt = 0;
    if (i.ai) m.aiPlan = planBat(m, m.d, R.a);
  } else {
    m.d = null; m.next = null;
    m.aim = m.aim ?? { type: 'pace', tx: 0.18, tz: 4.0, pace: 0.5 };
    m.phase = 'aim'; m.pt = 0;
  }
  startGlide(m);
}

// Human bowls: aim = { type, tx, tz, pace 0..1 }. Accuracy noise grows with pace.
export function bowlNow(m, R, aim) {
  if (m.phase !== 'aim') return false;
  const lvl = LEVELS[m.lvl];
  const T = TYPES[aim.type];
  const pace = clamp(aim.pace, 0, 1);
  const spd = T.speed[0] + (T.speed[1] - T.speed[0]) * pace;
  const noise = 0.06 + 0.22 * pace + (aim.type === 'bouncer' ? 0.06 : 0);
  const spec = {
    type: aim.type, speed: spd,
    bx: aim.tx + R.m.range(-1, 1) * noise, bz: aim.tz + R.m.range(-1, 1) * noise * 3.2,
    swing: R.m.range(T.swing[0], T.swing[1]) * (aim.type.endsWith('swing') ? 1 : 0.4),
    turn: R.m.range(T.turn[0], T.turn[1]), relX: R.m.range(-0.2, 0.2), relY: T.rel,
  };
  if (aim.type === 'fulltoss') spec.bz = Math.min(spec.bz, -1.2);
  m.d = flyDelivery(spec, m.theme, m.rules.bin ? 'bin' : 'stumps');
  m.next = { type: aim.type, bowler: 'You', why: '' };
  m.runT = 0.8; m.phase = 'runup'; m.pt = 0;
  m.aiPlan = planBat(m, m.d, R.a);
  return true;
}

// ---- batting input ---------------------------------------------------------------------------------------
// sw = { kind: 'swing'|'block', angle (deg), power 0..1 }. Returns true if accepted.
export function batSwing(m, R, sw) {
  if (m.phase !== 'flight' || m.sw) return false;
  const t = sw.t ?? m.ft;
  const res = resolveSwing(m.d, { kind: sw.kind, t, angle: sw.angle, power: sw.power }, m.theme, R.f, ASSIST[m.assist] ?? 1);
  m.sw = { kind: sw.kind, t, angle: sw.angle, power: sw.power, res };
  m.res = res;
  m.ev.push({ k: 'swing', kind: sw.kind, hit: res.contact });
  return true;
}

// ---- main step ---------------------------------------------------------------------------------------------
export function stepMatch(m, R, dt = DT) {
  m.t += dt;
  const i = m.inn;
  if (m.call) { m.call.t += dt; }
  if (m.gl) {
    if (m.phase === 'ready' || m.phase === 'runup' || m.phase === 'aim') glideField(m, dt);
    else { m.gl = false; rearField(m.field); }
  }
  switch (m.phase) {
    case 'ready': {
      m.pt += dt;
      if (!m.hold && m.pt >= (i.balls === 0 && !i.log.length ? 1.25 : READY_T)) { m.phase = 'runup'; m.pt = 0; }
      break;
    }
    case 'aim': m.pt += dt; break;
    case 'runup': {
      m.pt += dt;
      if (m.pt >= m.runT) {
        m.phase = 'flight'; m.ft = 0; m.pt = 0; m.ev.push({ k: 'release' });
        if (i.ai && m.aiPlan) {
          const p = m.aiPlan;
          m.aiSwingAt = p.kind === 'leave' ? null : m.d.tC + (p.kind === 'swing' ? -0.05 : 0) + p.terr;
        }
      }
      break;
    }
    case 'flight': {
      m.ft += dt;
      const d = m.d;
      if (d.bounceT > 0 && m.ft - dt < d.bounceT && m.ft >= d.bounceT) m.ev.push({ k: 'bounce' });
      if (i.ai && !m.sw && m.aiPlan && m.aiPlan.kind !== 'leave' && m.aiSwingAt != null && m.ft >= m.aiSwingAt) {
        const p = m.aiPlan;
        batSwing(m, R, { kind: p.kind === 'block' ? 'block' : 'swing', angle: p.angle, power: p.power });
      }
      if (m.sw && m.res.contact && m.ft >= m.sw.t + 0.05) { beginContact(m, R); break; }
      const limit = d.tC + 0.28;
      if (m.ft >= limit || (m.sw && !m.res.contact && m.ft >= d.t0 + 0.12)) {
        if (!m.sw) m.ft = Math.max(m.ft, limit);
        if (m.ft >= d.t0 + 0.12) finishPassed(m, R);
      }
      break;
    }
    case 'contact': {
      m.pt += dt;
      if (m.pt >= 0.13) { startLive(m, R); }
      break;
    }
    case 'live': stepLive(m, R, dt); break;
    case 'result': {
      m.pt += dt;
      if (m.pt >= (m.resT ?? 1.15)) afterResult(m, R);
      break;
    }
    case 'overbreak': {
      m.pt += dt;
      if (m.pt >= 1.1 && !m.hold) {
        setupOver(m, R); prepareBall(m, R);
      }
      break;
    }
    default: break;
  }
}

function setCall(m, text, kind, big = false, pin = false) { m.call = { text, kind, t: 0, big, pin }; }

function beginContact(m, R) {
  m.phase = 'contact'; m.pt = 0;
  const r = m.res;
  m.ev.push({ k: 'crack', q: r.Q, kind: r.kind, power: r.power });
}

function finishPassed(m, R) {
  const d = m.d, i = m.inn;
  const rules = m.rules;
  const noBall = rules.extras && d.noBall;
  let text = '', runs = 0, out = null, extra = null, kind = 'dot';
  const missed = !!m.sw;
  if (d.bowled && !i.fh) {
    out = { how: 'bowled' };
    m.ev.push({ k: 'stumps' });
  } else if (d.wide && rules.extras && !m.sw && !noBall) {
    extra = 'wd';
  } else {
    if (rules.extras && !d.wide && R.f.chance(0.1)) { runs = 1; extra = 'b'; text = byeLine(R.a); kind = 'run'; }
  }
  if (noBall) extra = extra === 'wd' ? 'nb' : 'nb';
  const t = text || (extra === 'wd' ? wideLine(R.a) : out ? '' : missed ? missLines(R.a) : d.wide ? 'Left alone, well outside.' : 'Left alone.');
  m.res = m.res ?? { kind: 'miss', contact: false };
  concludeBall(m, R, { runs, bat: 0, extra, out, text: t, kind: extra === 'wd' ? 'extra' : kind, miss: true, noBall });
}

// ---- live ball ---------------------------------------------------------------------------------------------
function startLive(m, R) {
  const r = m.res, d = m.d;
  const lvl = LEVELS[m.lvl];
  const track = flyBall(r.init, m.theme);
  const rules = m.rules;
  const plan = planFielding(track, m.field, m.theme, lvl, rules, R.f);
  const th = THEMES[m.theme];
  m.phase = 'live';
  const aerial = r.elev > 17;
  const shot = shotName(r.angle, r.elev, d, r.kind);
  m.live = {
    track, plan, i: 0, bs: 'track', holder: -1, hold: 0, th: null,
    runs: 0, bd: 0, over: false, dead: false, deadT: 0, out: null, extra: null, overthrow: 0,
    run: { mode: 'rest', u: [0, 0], from: [0, 1], q: false, delay: 0, turn: 0, count: 0, startedAt: -1 },
    aerial, shot, t: 0, dropped: plan.kind === 'drop', dropText: false, forced: false,
    frozen: null, settle: 0, decided: false, firstAdvice: false, rb: [m.inn.ends[0], m.inn.ends[1]],
  };
  // fielders chase
  m.live.chaser = plan.fielder ?? -1;
  if (r.kind === 'hit' || r.kind === 'edge' || r.kind === 'block') {
    m.lastHit = { track: track.p.slice(0, Math.min(track.p.length, plan.idx * 3 + 6)), shot, angle: r.angle, elev: r.elev, kind: r.kind, speed: r.speed };
  }
  // tippy-go: any contact forces a run
  if (rules.tippy && !(plan.kind === 'boundary' || plan.kind === 'catch')) {
    m.live.forced = true;
    m.live.run.delay = 0.12; m.live.run.mode = 'start';
    setCall(m, 'TIPPY-GO! You must run!', 'info');
  }
}

export function currentRunTime(m) { return THEMES[m.theme].runLen / RUN_SPEED; }

// Player / AI command: take a run, or queue / unqueue the next one.
export function callRun(m) {
  const L = m.live;
  if (m.phase !== 'live' || !L || L.dead || L.over) return false;
  const rn = L.run;
  if (rn.mode === 'rest') { rn.mode = 'start'; rn.delay = 0.1; m.ev.push({ k: 'call' }); return true; }
  if (rn.mode === 'start') return false;
  if (rn.mode === 'run') { if (L.forced && !rn.q) { rn.q = true; return true; } rn.q = !rn.q; m.ev.push({ k: 'call' }); return true; }
  return false;
}

function runnerSpeedU(m) { return RUN_SPEED / THEMES[m.theme].runLen; }

function moveFielders(m, dt) {
  const L = m.live, th = THEMES[m.theme];
  const track = L.track;
  const bp = trackPos(track, Math.min(L.i, track.n - 1));
  const plan = L.plan;
  for (const f of m.field) {
    let tx = f.x, tz = f.z, sp = 0;
    if (L.holder === f.id) { continue; }
    if (f.id === L.chaser && (L.bs === 'track' || L.bs === 'wait')) {
      const idx = plan.pickupIdx ?? plan.idx;
      const tt = Math.max(0.05, idx / 60 - L.i / 60);
      const px = plan.pos[0], pz = plan.pos[2];
      const d = Math.hypot(px - f.x, pz - f.z);
      const lead = Math.max(0, L.i / 60 - f.react);
      const speed = d / Math.max(0.12, tt + 0.0);
      tx = px; tz = pz; sp = Math.min(f.spd * 1.12, Math.max(speed, 0)) ;
      if (L.i / 60 < f.react) sp = 0;
    } else if (L.bs === 'track' && f.role === 'field') {
      // others drift toward the ball if it is coming their way
      const dd = Math.hypot(bp[0] - f.x, bp[2] - f.z);
      if (dd < 14) { tx = bp[0]; tz = bp[2]; sp = f.spd * 0.45; }
    }
    if (sp > 0) {
      const dx = tx - f.x, dz = tz - f.z, dl = Math.hypot(dx, dz);
      if (dl > 0.05) { const s = Math.min(dl, sp * dt); f.x += (dx / dl) * s; f.z += (dz / dl) * s; f.fx = dx / dl; f.fz = dz / dl; f.run = Math.min(1, f.run + dt * 3); }
    } else f.run = Math.max(0, f.run - dt * 4);
  }
}

function ballPos(m) {
  const L = m.live;
  if (L.bs === 'held') { const f = m.field[L.holder]; return [f.x, 1.0, f.z]; }
  if (L.bs === 'thrown') {
    const T = L.th, u = clamp(T.t / T.dur, 0, 1);
    return [T.fx + (T.tx - T.fx) * u, 1.0 + Math.sin(u * Math.PI) * Math.min(2.2, T.d * 0.05) , T.fz + (T.tz - T.fz) * u];
  }
  if (L.bs === 'over') { return L.overPos ?? [0, 0, 0]; }
  return trackPos(L.track, Math.min(L.i, L.track.n - 1));
}
export { ballPos };

function throwOrHold(m, R) {
  const L = m.live, rn = L.run, th = THEMES[m.theme];
  const f = m.field[L.holder];
  // runners that are still in transit (or about to be)
  const going = [];
  if (rn.mode === 'run') { for (let k = 0; k < 2; k++) if (rn.u[k] < 1) going.push(k); }
  else if (rn.mode === 'start') { going.push(0, 1); }
  else if (rn.mode === 'rest' && rn.q) { going.push(0, 1); }
  if (!going.length) return false;
  // choose the end where the runner will be latest
  const lvl = LEVELS[m.lvl];
  let best = null;
  const uRate = runnerSpeedU(m);
  for (const k of going) {
    const to = 1 - rn.from[k];
    const rem = rn.mode === 'run' ? (1 - rn.u[k]) / uRate : (rn.delay || 0) + 1 / uRate;
    const endZ = to === 0 ? 0 : th.pitchLen;
    const tt = throwTime(f.x, f.z, 0, endZ);
    const margin = rem - tt;
    if (!best || margin > best.margin) best = { k, to, endZ, margin, tt };
  }
  const dist = Math.hypot(f.x - 0, f.z - best.endZ);
  const pHit = clamp(lvl.throwAcc - 0.012 * dist + (dist < 9 ? 0.1 : 0), 0.1, 0.8);
  const hit = R.f.chance(pHit);
  const over = !hit && R.f.chance(0.1 + 0.1 * (1 - lvl.fieldIq));
  const dur = best.tt + (hit ? 0 : 0.3);
  L.th = { t: 0, dur: Math.max(0.3, dur), fx: f.x, fz: f.z, tx: 0, tz: best.endZ, end: best.to, k: best.k, hit, over, d: dist };
  L.bs = 'thrown'; L.holder = -1;
  m.ev.push({ k: 'throw' });
  return true;
}

function stepLive(m, R, dt) {
  const L = m.live, th = THEMES[m.theme], rn = L.run, i = m.inn;
  if (L.frozen) return;
  L.t += dt;
  const uRate = runnerSpeedU(m);
  // --- runners
  if (rn.mode === 'start') {
    rn.delay -= dt;
    if (rn.delay <= 0) { rn.mode = 'run'; rn.u = [0, 0]; rn.startedAt = L.t; }
  } else if (rn.mode === 'run') {
    for (let k = 0; k < 2; k++) if (rn.u[k] < 1) rn.u[k] = Math.min(1, rn.u[k] + uRate * dt);
    if (rn.u[0] >= 1 && rn.u[1] >= 1) {
      rn.count += 1; L.runs += 1;
      m.ev.push({ k: 'run' });
      rn.from = [1 - rn.from[0], 1 - rn.from[1]];
      m.inn.ends = [m.inn.ends[1], m.inn.ends[0]];
      rn.mode = 'rest';
      rn.turn = 0.16;
      rn.swapped = !rn.swapped;
    }
  } else if (rn.mode === 'rest') {
    if (rn.q) {
      rn.turn -= dt;
      if (rn.turn <= 0) { rn.q = false; rn.mode = 'run'; rn.u = [0, 0]; }
    } else rn.turn = Math.max(0, rn.turn - dt);
  }
  // --- ball
  if (L.bs === 'track') {
    L.i += 1;
    const plan = L.plan;
    const tr = L.track;
    for (const bi of tr.bounces) if (bi === L.i) m.ev.push({ k: 'ground', i: L.i });
    if (L.i >= plan.idx) {
      if (plan.kind === 'boundary') {
        L.bd = plan.runs; L.over = true; L.bs = 'over'; L.overPos = trackPos(tr, plan.idx);
        m.ev.push({ k: plan.runs === 6 ? 'six' : 'four' });
      } else if (plan.kind === 'catch') {
        L.holder = plan.fielder; L.bs = 'held'; L.caught = true;
        const f = m.field[plan.fielder]; f.x = plan.pos[0]; f.z = plan.pos[2];
        if (!i.fh || !m.rules.extras) { L.out = { how: f.role === 'wk' ? 'caught behind' : 'caught', by: f.name }; L.over = true; m.ev.push({ k: 'caught' }); }
        else { L.caughtFree = true; L.hold = 0; }
      } else if (plan.kind === 'drop') {
        L.bs = 'wait'; L.waitUntil = plan.pickupIdx; L.dropText = true; m.ev.push({ k: 'dropped' });
      } else if (plan.kind === 'pickup') {
        if ((plan.pickupIdx ?? plan.idx) > L.i) { L.bs = 'wait'; L.waitUntil = plan.pickupIdx; if (plan.fumble) m.ev.push({ k: 'fumble' }); }
        else { L.bs = 'held'; L.holder = plan.fielder; L.hold = 0; m.ev.push({ k: 'pickup' }); }
      }
    }
  } else if (L.bs === 'wait') {
    L.i += 1;
    if (L.i >= L.waitUntil) { L.bs = 'held'; L.holder = L.plan.fielder; L.hold = 0; m.ev.push({ k: 'pickup' }); }
  }
  decisionPoints(m, R);
  moveFielders(m, dt);
  if (L.bs === 'held') {
    L.hold += dt;
    const f = m.field[L.holder];
    if (L.hold >= 0.04 && !L.out) {
      if (!throwOrHold(m, R)) {
        // nobody running
        L.deadT += dt;
        if (L.deadT >= 0.4) L.dead = true;
      }
    }
  } else if (L.bs === 'thrown') {
    const T = L.th;
    T.t += dt;
    if (T.t >= T.dur) {
      const k = T.k;
      const rr = L.run;
      const runnerAtEnd = (rr.mode === 'run' && rr.u[k] < 1 && (1 - rr.from[k]) === T.end) ? k : (rr.mode === 'run' && rr.u[1 - k] < 1 && (1 - rr.from[1 - k]) === T.end ? 1 - k : -1);
      if (T.over) {
        L.overthrow += 1; L.bs = 'over'; L.overPos = [0, 0.3, T.tz + (T.end === 0 ? -6 : 6)]; L.over2 = true; L.overT = 0;
        m.ev.push({ k: 'overthrow' });
      } else if (runnerAtEnd >= 0 && !(i.fh && m.rules.extras && false)) {
        // run out: the batter who was heading to this end
        L.out = { how: 'runout', runner: runnerAtEnd }; L.over = true; L.bs = 'over'; L.overPos = [0, 0.3, T.tz]; m.ev.push({ k: 'stumps' });
      } else {
        // receiver (keeper / bowler) holds it; throw on if someone is still running
        const rec = T.end === 0 ? m.field.find((f) => f.role === 'wk') : m.field.find((f) => f.role === 'bowler');
        L.holder = rec.id; L.bs = 'held'; L.hold = 0; L.th = null;
        rec.x = 0; rec.z = T.tz + (T.end === 0 ? -1.0 : 1.0);
      }
    }
  } else if (L.bs === 'over' && L.over2) {
    L.overT += dt;
    if (L.overT > 0.9) L.dead = true;
  }
  // block / dribble: if the ball stops and nobody is running, call it
  if (L.bs === 'track' && rn.mode === 'rest' && !rn.q && L.i > 20) {
    const [x0, , z0] = trackPos(L.track, Math.max(0, L.i - 6));
    const [x1, , z1] = trackPos(L.track, L.i);
    if (Math.hypot(x1 - x0, z1 - z0) < 0.08) { L.settle += dt; if (L.settle > 0.7 && m.res.kind === 'block') L.dead = true; }
  }
  if (L.over && !L.over2) L.dead = true;
  if (L.dead) endLive(m, R);
}

function decisionPoints(m, R) {
  const L = m.live, rn = L.run, i = m.inn;
  if (!i.ai || L.forced || L.over || L.dead) return;
  const pk = L.plan.kind;
  if (pk === 'boundary' || pk === 'catch') return;
  if (!L.decided && L.i >= 8) { L.decided = true; L.decidedCount = 0; offerDecision(m, 'first'); return; }
  if (L.decided && rn.mode === 'rest' && !rn.q && L.decidedCount !== rn.count && L.bs !== 'thrown') { L.decidedCount = rn.count; offerDecision(m, 'again'); }
}

function offerDecision(m, kind) {
  const L = m.live;
  const adv = runAdvice(m, aiMargin(m));
  if (!adv) return;
  if (m.freeze) { L.frozen = { kind, adv }; return; }
  if (adv.act === 'run') callRun(m);
}

export function resolveFrozen(m, act) {
  const L = m.live;
  if (!L || !L.frozen) return;
  L.frozen = null;
  if (act === 'run') callRun(m);
}

function endLive(m, R) {
  const L = m.live, rn = L.run, i = m.inn, d = m.d, r = m.res;
  const rules = m.rules;
  let bat = L.runs, out = L.out, text = '', kind = 'run';
  if (L.bd) bat = L.bd;
  let extraRuns = 0;
  if (L.overthrow) { extraRuns += L.overthrow; }
  const noBall = rules.extras && d.noBall;
  if (L.bd === 6 && rules.sixOut && !(i.fh && rules.extras)) out = { how: 'sixout' };
  if (out && (out.how === 'caught' || out.how === 'caught behind')) { bat = 0; }
  if (out && out.how === 'runout') { bat = L.runs; }
  const shot = L.shot;
  if (out) {
    text = wicketLine(R.a, out.how, '', bowlerOf(m).name);
    kind = 'wicket';
  } else if (L.bd === 6) { text = boundaryLine(R.a, 6, shot, true); kind = 'six'; }
  else if (L.bd === 4) { text = boundaryLine(R.a, 4, shot, L.aerial); kind = 'four'; }
  else if (r.kind === 'edge') { text = edgeLines(R.a) + (bat ? ` ${bat} run${bat > 1 ? 's' : ''}.` : ' No run.'); kind = bat ? 'run' : 'dot'; }
  else { text = runsLine(R.a, bat, shot); kind = bat ? 'run' : 'dot'; }
  if (L.dropText && !out) text = droppedLine(R.a) + ' ' + text;
  concludeBall(m, R, { runs: bat + extraRuns, bat, extra: noBall ? 'nb' : (extraRuns ? 'ov' : null), out, text, kind, noBall, aerial: L.aerial, boundary: L.bd || 0, shot, angle: r.angle, overthrow: extraRuns });
}

// ---- scoring ----------------------------------------------------------------------------------------------------
function concludeBall(m, R, o) {
  const i = m.inn, b = bowlerOf(m);
  const rb = m.live ? m.live.rb : [i.ends[0], i.ends[1]];
  const striker = i.batters[rb[0]];
  const rules = m.rules;
  let runsTotal = 0, token = '.', legal = true;
  const freeHit = i.fh && rules.extras;
  let out = o.out;
  if (out && freeHit && out.how !== 'runout') out = null;
  if (o.extra === 'wd') { runsTotal = 1; i.extras.wd += 1; legal = false; token = 'Wd'; }
  else {
    if (o.extra === 'nb') { runsTotal += 1; i.extras.nb += 1; legal = false; token = 'Nb'; }
    if (o.extra === 'b') { runsTotal += o.runs; i.extras.b += o.runs; token = `${o.runs}b`; }
    else {
      runsTotal += o.bat + (o.overthrow ?? 0);
      if (o.bat) { striker.runs += o.bat; if (o.boundary === 4) { striker.f4++; i.fours++; } if (o.boundary === 6) { striker.f6++; i.sixes++; } }
      if (o.noBall) token = o.bat ? `${o.bat}+Nb` : 'Nb';
      else token = out ? 'W' : o.bat ? String(o.bat) : '.';
      if (o.bat === 0 && !out && !o.noBall) token = '.';
    }
  }
  if (legal) { striker.balls += 1; i.balls += 1; b.balls += 1; }
  if (o.extra === 'nb') striker.balls += 0;
  i.runs += runsTotal; b.runs += runsTotal; i.overRuns += runsTotal;
  if (out) { i.wk += 1; i.overWk += 1; if (out.how !== 'runout') b.wk += 1; }
  // zones: where the batter scored (for the bowler's and captain's memory)
  if (o.angle != null && o.bat >= 1 && !o.out) {
    const s = sectorOf(o.angle);
    i.zoneRuns[s] += o.bat;
    if (o.boundary) i.zones[s] += 1.5; else if (o.bat >= 2) i.zones[s] += 0.6;
  }
  i.zones = i.zones.map((v) => v * 0.985);
  i.log.push(token);
  i.over.push(token);
  i.recent.push(m.d.spec.type); if (i.recent.length > 6) i.recent.shift();
  if (m.d.lengthClass === 'bouncer' || m.d.lengthClass === 'short') i.shorts++;
  // wicket handling
  let outName = null;
  if (out) {
    let outIdx = rb[0];
    if (out.how === 'runout') {
      // the runner heading to the broken end; if two runners: the one at the thrown-to end
      outIdx = rb[out.runner ?? 0];
      // incomplete run does not count (runs already completed stay)
    }
    const ob = i.batters[outIdx];
    ob.out = out.how;
    outName = ob.name;
    const endPos = i.ends.indexOf(outIdx);
    if (i.nextBat < i.batters.length && i.wk < i.maxWk) { i.ends[endPos] = i.nextBat; i.nextBat += 1; }
    o.text = wicketLine(R.a, out.how, ob.name, b.name) + (o.bat && out.how === 'runout' ? ` ${o.bat} completed.` : '');
    if (out.how === 'sixout') o.text = wicketLine(R.a, 'sixout', ob.name, b.name);
  }
  if (freeHit && legal) i.fh = false;
  if (o.extra === 'nb' && rules.extras) i.fh = true;
  // strike rotation: odd completed runs already swapped ends during the run animation; byes rotate here
  if (o.extra === 'b' && o.runs % 2 === 1) i.ends = [i.ends[1], i.ends[0]];
  if (o.extra === 'wd' || o.noBall) { /* rebowl */ }
  if (m.live == null && o.runs && o.extra !== 'b' && o.extra !== 'wd') { /* nothing */ }
  const text = o.text + (o.extra === 'nb' ? ' No ball, free hit next.' : '');
  setCall(m, text, o.kind, o.kind === 'six' || o.kind === 'four' || o.kind === 'wicket');
  if (o.noBall && rules.extras && o.kind !== 'wicket') setCall(m, noBallLine(R.a) + (o.bat ? ` Plus ${o.bat}.` : ''), 'extra');
  m.last = { token, runs: runsTotal, out: !!out, outName, kind: o.kind, boundary: o.boundary || 0, shot: o.shot, legal };
  if (m.live) {
    m.winShot = null;
    if (i.target != null && i.runs >= i.target) m.winShot = m.lastHit;
  }
  m.phase = 'result'; m.pt = 0; m.resT = o.kind === 'six' || o.kind === 'four' || o.kind === 'wicket' ? 1.55 : 1.0;
  m.ev.push({ k: 'result', kind: o.kind });
  if (o.kind === 'wicket') m.ev.push({ k: 'wicket' });
}

function afterResult(m, R) {
  const i = m.inn;
  const won = i.target != null && i.runs >= i.target;
  const allOut = i.wk >= i.maxWk;
  const oversDone = i.balls >= i.maxBalls;
  if (won || allOut || oversDone) { endInnings(m, R, won); return; }
  const lastLegal = m.last?.legal;
  if (lastLegal && i.balls % 6 === 0 && i.balls > 0) {
    // end of over
    i.ends = [i.ends[1], i.ends[0]];
    setCall(m, overLine(R.a, i.overRuns, i.overWk), 'info');
    i.over = [];
    m.phase = 'overbreak'; m.pt = 0;
    m.ev.push({ k: 'overend' });
    if (i.role === 'bowl') m.hold = true;
    return;
  }
  prepareBall(m, R);
}

export function resumeAfterOverbreak(m, R, presetKey) {
  if (m.phase !== 'overbreak') return;
  if (presetKey) m.fieldPick = presetKey;
  m.hold = false; m.pt = 1.1;
}

function endInnings(m, R, won) {
  const i = m.inn;
  i.done = true;
  if (i.role === 'bat') {
    if (won) i.result = 'won';
    else if (i.target != null && i.runs === i.target - 1) i.result = 'tied';
    else i.result = 'lost';
  } else i.result = 'set';
  m.phase = 'inningsEnd'; m.pt = 0;
  m.ev.push({ k: 'inningsEnd', result: i.result });
  if (m.innNo >= m.roles.length - 1) { m.over = true; m.result = i.result; }
}

export function nextInnings(m, R) {
  if (m.over) return false;
  startInnings(m, R);
  return true;
}

export function popEvents(m) { const e = m.ev; m.ev = []; return e; }

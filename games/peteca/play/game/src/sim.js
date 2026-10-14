// Peteca simulation: the court, the peteca's flight, the strokes, the rival AI and scoring. Pure and deterministic.
// Units: metres and seconds. x runs along the court (0 = left baseline, NET = the net, COURT = right baseline), z is height.
// Team 0 (you, and your partner in doubles) plays the left half and strikes towards +x; team 1 plays the right half.
// Everything the screen shows is derived from this file; game.js only feeds it taps and plays sound/effects from run.events.

export const COURT = 12;
export const NET = 6;
export const NET_H = 2.15;      // top of the net
export const G = 7.5;
export const KD = 0.2;          // quadratic air drag (per metre): terminal fall speed about 6.1 m/s
export const STEP = 1 / 120;    // physics sub-step
export const REACH_X = 0.95;    // how far from the palm the peteca can be struck cleanly (m)
export const STRETCH_X = 1.45;  // a stretch: reachable, but never better than Good and aimed worse
export const Z_MIN = 0.22;
export const Z_MAX = 2.6;
export const PLAYER_H = 1.75;
export const SMASH_FROM = 3.4;  // a smash needs the contact within this distance of the net

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const gauss = (r) => (r.next() + r.next() + r.next() - 1.5) * 2;   // about unit spread, bounded to +-3

// ---- strokes -----------------------------------------------------------------------------------------------------------
// zi = best contact height; tol = height error at which quality reaches zero; minZ = lowest contact that allows the stroke;
// angles = launch angles to try (degrees, in order of preference); vmax = fastest the palm can send it.
export const SHOTS = {
  set:   { id: 'set',   name: 'Set',   zi: 1.0,  tol: 0.62, minZ: 0.22, vmax: 18, angles: [80, 72, 64], spin: null,    sub: 'to partner' },
  lob:   { id: 'lob',   name: 'Lob',   zi: 0.75, tol: 0.62, minZ: 0.22, vmax: 38, angles: [74, 66, 58, 50, 44], spin: 'float', sub: 'high and safe' },
  drive: { id: 'drive', name: 'Drive', zi: 1.3,  tol: 0.55, minZ: 0.75, vmax: 38, angles: [14, 22, 32, 44], spin: 'dive', sub: 'flat and fast' },
  drop:  { id: 'drop',  name: 'Drop',  zi: 1.5,  tol: 0.5,  minZ: 0.7,  vmax: 22, angles: [28, 36, 44, 56, 68], spin: 'cut',  sub: 'short, dies at the net' },
  smash: { id: 'smash', name: 'Smash', zi: 2.2,  tol: 0.45, minZ: 1.75, vmax: 44, angles: [-34, -24, -14, -6, 2, 10], spin: 'heavy', sub: 'from high up' },
};
export const SHOT_ORDER = ['lob', 'drive', 'drop', 'smash'];
export const PERFECT_W = 0.16, GOOD_W = 0.4;
export const SPIN_NAMES = { float: 'Float', dive: 'Dive', cut: 'Cut', heavy: 'Heavy' };

// Rivals, weakest first: speed (m/s), reaction (s), timing noise (m of contact height), shot IQ noise.
export const RIVALS = [
  { name: 'Rafa', look: 0, speed: 4.4, react: 0.36, sigma: 0.5, temp: 1.4, blurb: 'Beach regular, friendly rallies' },
  { name: 'Duda', look: 1, speed: 5.0, react: 0.3, sigma: 0.38, temp: 1.0, blurb: 'Quick feet, loves the lob' },
  { name: 'Bruno', look: 2, speed: 5.5, react: 0.24, sigma: 0.28, temp: 0.7, blurb: 'Reads the court well' },
  { name: 'Marina', look: 3, speed: 5.9, react: 0.2, sigma: 0.2, temp: 0.45, blurb: 'Park champion, punishes short balls' },
  { name: 'Caio', look: 4, speed: 6.4, react: 0.15, sigma: 0.13, temp: 0.25, blurb: 'Competition player' },
];
// Your side's look indices: 5 = you, 6 = partner
export const YOU = { name: 'You', look: 5 }, PARTNER = { name: 'Lia', look: 6, speed: 4.6, react: 0.28, sigma: 0.24, temp: 0.7 };
export const TO_CHOICES = [7, 11];

// ---- flight --------------------------------------------------------------------------------------------------------------
// One step of the peteca (base first, feathers drag): quadratic drag against the wind, gravity, plus the spin effects.
export function stepBall(b, dt, wind) {
  const rx = b.vx - wind, sp = Math.hypot(rx, b.vz);
  let kx = KD, az = -G - KD * sp * b.vz;
  const sn = b.spin;
  if (sn === 'float' && b.vz < 0) kx *= 2.3;       // back-spin: the peteca hangs and drops steeply
  else if (sn === 'cut') kx *= 2.0;                 // slice: it loses its pace and dies
  else if (sn === 'dive' && b.vz < 0) az -= 5;     // top-spin: it dives
  b.vx += -kx * sp * rx * dt;
  b.vz += az * dt;
  b.x += b.vx * dt; b.z += b.vz * dt;
}

// Fly a copy until it lands. Returns where, when and whether it clears the net.
export function trace(x0, z0, vx, vz, spin, wind, dir, zRef = 1.2) {
  const b = { x: x0, z: z0, vx, vz, spin };
  let t = 0, cross = null, tRef = null, xRef = null, apex = z0, prevX = x0;
  for (let i = 0; i < 2400; i++) {
    const pz = b.z;
    stepBall(b, STEP, wind); t += STEP;
    if (b.z > apex) apex = b.z;
    if (cross === null && (prevX - NET) * (b.x - NET) <= 0 && prevX !== b.x) cross = b.z;
    if (tRef === null && b.vz < 0 && pz > zRef && b.z <= zRef) { tRef = t; xRef = b.x; }
    prevX = b.x;
    if (b.z <= 0) break;
  }
  void dir;
  return { landX: b.x, t, cross, tRef: tRef ?? t, xRef: xRef ?? b.x, apex, net: cross !== null && cross < NET_H + 0.02 };
}

// Find the launch (speed + angle) that lands the peteca on targetX with the stroke's own style. Returns null when the palm cannot
// do it (too far / too short). `flat` prefers the fastest, flattest solution (Power Palm).
export function solveShot(x0, z0, dir, shot, targetX, wind, flat = false) {
  const S = SHOTS[shot];
  const angles = flat ? [...S.angles].reverse() : S.angles;
  let best = null;
  for (const a of angles) {
    const th = (a * Math.PI) / 180, cx = Math.cos(th) * dir, cz = Math.sin(th);
    const land = (s) => trace(x0, z0, cx * s, cz * s, S.spin, wind, dir);
    const hi = land(S.vmax);
    const dHi = (hi.landX - x0) * dir, want = (targetX - x0) * dir;
    if (dHi < want) { if (!best || dHi > best.d) best = { fail: 'short', d: dHi }; continue; }
    const lo0 = land(1.5);
    if ((lo0.landX - x0) * dir > want) continue;     // even the slowest hit lands too far for this angle
    let lo = 1.5, hiS = S.vmax;
    for (let i = 0; i < 11; i++) {
      const mid = (lo + hiS) / 2, r = land(mid);
      if ((r.landX - x0) * dir < want) lo = mid; else hiS = mid;
    }
    const s = (lo + hiS) / 2, r = land(s);
    if (r.net) continue;
    return { vx: cx * s, vz: cz * s, speed: s, angle: a, ...r };
  }
  // nothing clears: report the flattest fast attempt so the ball visibly meets the net
  const a = flat ? S.angles[0] : S.angles[S.angles.length - 1], th = (a * Math.PI) / 180, s = Math.min(S.vmax, 14);
  const r = trace(x0, z0, Math.cos(th) * dir * s, Math.sin(th) * s, S.spin, wind, dir);
  return { vx: Math.cos(th) * dir * s, vz: Math.sin(th) * s, speed: s, angle: a, ...r, forcedNet: true };
}

// How far beyond the net (m, on the opponent's half) can this stroke land from here? The pad's short..deep scale is mapped onto
// that interval, so a drop is always short and a lob can be deep, and no pad value is ever physically impossible.
const NEAR = 0.7, FAR = COURT - NET - 0.6;
export function shotRange(x0, z0, dir, shot, wind) {
  let min = null, max = null;
  for (let k = 0; k <= 5; k++) {
    const d = NEAR + ((FAR - NEAR) * k) / 5;
    const sol = solveShot(x0, z0, dir, shot, NET + dir * d, wind, false);
    if (sol.forcedNet) continue;
    const dd = (sol.landX - NET) * dir;
    if (min === null || dd < min) min = dd;
    if (max === null || dd > max) max = dd;
  }
  if (min === null) return null;
  return { min, max: Math.max(max, min + 0.01) };
}
export const rangeX = (rg, depth, dir) => NET + dir * (rg.min + (rg.max - rg.min) * clamp(depth, 0, 1));

// ---- quality ---------------------------------------------------------------------------------------------------------------
export function gradeFor(shot, z, spinPenalty = 1) {
  const S = SHOTS[shot], dz = z - S.zi, a = Math.abs(dz);
  const pw = PERFECT_W * spinPenalty, gw = GOOD_W * (0.5 + 0.5 * spinPenalty);
  const q = clamp(1 - Math.pow(a / S.tol, 1.35), 0, 1);
  let grade = 'perfect';
  if (a > pw) grade = a <= gw ? 'good' : dz > 0 ? 'early' : 'late';
  return { q, grade, dz };
}

// Reaching past the clean reach (a stretch) costs quality: never Perfect, and a weaker aim.
export function stretchGrade(g, dx) {
  if (dx <= REACH_X) return g;
  return { q: g.q * 0.55, grade: g.grade === 'perfect' || g.grade === 'good' ? 'good' : g.grade, dz: g.dz, stretch: true };
}

// ---- the run ----------------------------------------------------------------------------------------------------------------
const HOME = { singles: [[3.2], [8.8]], doubles: [[4.6, 2.2], [7.4, 9.8]] };
export function makePlayers(format, level) {
  const out = [];
  const n = format === 'doubles' ? 2 : 1;
  for (let team = 0; team < 2; team++) {
    for (let k = 0; k < n; k++) {
      const x = HOME[format][team][k];
      let prof;
      if (team === 0) prof = k === 0 ? { ...YOU, speed: 4.8, react: 0, sigma: 0, temp: 0 } : { ...PARTNER };
      else { const r = RIVALS[clamp(level - 1, 0, 4)]; prof = { ...r, look: k === 0 ? r.look : (r.look + 2) % 5 }; if (k === 1) prof.name = RIVALS[(level + 1) % 5].name; }
      out.push({ team, k, x, home: x, v: 0, human: team === 0 && k === 0, ai: !(team === 0 && k === 0), prof, dir: team === 0 ? 1 : -1, anim: null, z: 0, run: 0, ready: 0, plan: null });
    }
  }
  return out;
}

export function newRun(cfg, rng) {
  const mode = cfg.mode || 'match', format = mode === 'match' ? (cfg.format || 'singles') : 'singles';
  const level = clamp(cfg.level || 2, 1, 5);
  const players = makePlayers(format, level);
  if (mode === 'rally') { const q = players[1]; q.prof = { name: 'Lia', look: 6, speed: 4.6, react: 0.2, sigma: 0.07, temp: 0.2 }; q.look = 6; }
  if (mode === 'watch') { players[0].human = false; players[0].ai = false; players[0].scripted = true; players[0].prof = { ...players[0].prof, sigma: 0.07, temp: 0.2, speed: 5.0, react: 0.18 }; }
  if (cfg.attract) { players[0].human = false; players[0].ai = true; players[0].prof = { ...players[0].prof, sigma: 0.14, temp: 0.4, speed: 4.4, react: 0.24, name: 'Lia', look: 6 }; if (players[1] && players[1].team === 0) players[1].prof = { ...players[1].prof, look: 5 }; }
  const run = {
    mode, format, level, court: cfg.court || 0,
    to: cfg.to || (mode === 'watch' ? 5 : 11), cap: 0,
    t: 0, score: [0, 0], server: 0, phase: 'serve', phaseT: 0, over: null,
    players, recv: -1, nextTeam: 0, lastTeam: -1, lastPlayer: -1, touches: 0,
    ball: { x: 1, z: 1.2, vx: 0, vz: 0, spin: null, ang: 0, av: 0, tumble: 0, held: true, alive: false, hits: 0 },
    rally: 0, longest: 0, flow: 0, power: false,
    streak: 0, points: 0, bestMult: 1,
    wind: 0, windAmp: mode === 'rally' ? 0.2 : (cfg.windAmp ?? (level >= 3 ? 0.9 : 0.5)), windPh: rng.next() * TAU,
    stats: { strikes: 0, perfects: 0, goods: 0, errors: 0, winners: 0, aces: 0, spins: 0, powers: 0, pointsWon: 0, pointsLost: 0, shots: { lob: 0, drive: 0, drop: 0, smash: 0, set: 0 } },
    events: [], seq: 0, evDone: 0, lock: 0, hints: 0, last: null, why: '', pointWhy: '', hist: [],
    lastGrade: null, lastShot: null, serveGrace: 0,
  };
  run.cap = run.to + 4;
  beginServe(run, cfg.firstServer ?? 0);
  return run;
}

const ev = (run, e) => { run.events.push({ seq: run.seq++, t: run.t, ...e }); if (run.events.length > 60) run.events.splice(0, run.events.length - 60); };
export const windNow = (run) => run.windAmp * (Math.sin(run.t * 0.37 + run.windPh) * 0.8 + Math.sin(run.t * 0.91 + run.windPh * 2) * 0.2);
const teamPlayers = (run, team) => run.players.filter((p) => p.team === team);
export const humanIdx = (run) => run.players.findIndex((p) => p.human);

function beginServe(run, server) {
  run.server = server; run.phase = 'serve'; run.phaseT = 0; run.serving = true;
  run.rally = 0; run.touches = 0; run.lastTeam = -1; run.lastPlayer = -1; run.pointWhy = '';
  for (const p of run.players) { p.x = p.home; p.v = 0; p.plan = null; p.anim = null; p.z = 0; p.ready = 0; }
  const sp = run.players.find((p) => p.team === server);
  const sx = server === 0 ? 1.1 : COURT - 1.1;
  sp.x = sx;
  if (run.format === 'doubles') { const o = run.players.find((p) => p.team === server && p !== sp); o.x = server === 0 ? 4.6 : COURT - 4.6; o.home = o.x; }
  sp.home = sx;
  const b = run.ball;
  b.x = sx + sp.dir * 0.3; b.z = 1.15; b.vx = 0; b.vz = 0; b.spin = null; b.alive = false; b.held = true; b.hits = 0; b.ang = 0; b.av = 0;
  run.nextTeam = server; run.recv = run.players.indexOf(sp);
  run.serveWait = 0.9;     // the server settles, then tosses
  run.lock = 0;
  ev(run, { type: 'serve-ready', team: server });
}

function toss(run) {
  const b = run.ball; b.held = false; b.alive = true; b.vx = 0; b.vz = 4.3; b.spin = null; b.av = 0;
  run.phase = 'rally';
  ev(run, { type: 'toss', x: b.x, z: b.z });
}

// ---- prediction helpers ------------------------------------------------------------------------------------------------------
// Where will the live peteca be when it falls through height zRef? (null when it will not fall through)
export function predictAt(ball, wind, zRef) {
  const b = { x: ball.x, z: ball.z, vx: ball.vx, vz: ball.vz, spin: ball.spin };
  let t = 0;
  for (let i = 0; i < 1800; i++) {
    const pz = b.z;
    stepBall(b, STEP * 2, wind); t += STEP * 2;
    if (b.vz < 0 && pz > zRef && b.z <= zRef) return { x: b.x, t, z: zRef };
    if (b.z <= 0) return { x: b.x, t, z: 0, ground: true };
  }
  return { x: b.x, t, z: 0, ground: true };
}
export const landing = (ball, wind) => { const r = predictAt(ball, wind, -1); return { x: r.x, t: r.t }; };

// ---- choosing who plays the next touch ---------------------------------------------------------------------------------------
function chooseReceiver(run) {
  const team = run.nextTeam, list = run.players.map((p, i) => ({ p, i })).filter((o) => o.p.team === team);
  let pool = list;
  if (run.lastTeam === team && list.length > 1) pool = list.filter((o) => o.i !== run.lastPlayer);
  const pr = predictAt(run.ball, run.wind, 1.2), hx = clamp(pr.x, 0.4, team === 0 ? NET - 0.4 : COURT - 0.4);
  let best = pool[0], bd = 1e9;
  for (const o of pool) { const d = Math.abs(o.p.x - hx); if (d < bd) { bd = d; best = o; } }
  return best.i;
}

// ---- the strike ----------------------------------------------------------------------------------------------------------------
// Execute a stroke for player index pi. quality g = gradeFor(...). Returns the record the UI turns into words and sound.
export function execStrike(run, pi, shot, depth, z, g, rng, opts = {}) {
  const p = run.players[pi], team = p.team, dir = p.dir, b = run.ball, wind = run.wind;
  const S = SHOTS[shot];
  const power = !!opts.power && (shot === 'smash' || shot === 'drive');
  const sd = 0.12 + (1 - g.q) * (shot === 'smash' ? 2.5 : 1.9);
  let xT;
  if (shot === 'set') xT = team === 0 ? NET - 1.45 : NET + 1.45;
  else { const rg = shotRange(b.x, z, dir, shot, wind); xT = rg ? rangeX(rg, depth, dir) : NET + dir * 2; }
  let off = gauss(rng) * sd;
  if (g.grade === 'late') off -= dir * 0.5; else if (g.grade === 'early') off += dir * 0.15;
  const target = xT + off * (shot === 'set' ? 0.4 : 1);
  const x0 = b.x;
  const sol = solveShot(x0, z, dir, shot, target, wind, power);
  b.vx = sol.vx; b.vz = sol.vz;
  const perfect = g.grade === 'perfect';
  b.spin = perfect || shot === 'smash' ? S.spin : null;
  if (!perfect && shot !== 'smash') b.spin = (g.grade === 'good' && shot === 'drop') ? 'cut' : null;
  b.z = z; b.held = false; b.alive = true; b.hits++; b.spinIn = !!b.spin; b.falling = false;
  b.av = (dir > 0 ? 1 : -1) * (6 + 6 * Math.min(1, sol.speed / 20)); b.tumble = 0.5;
  const spin = b.spin;
  const rec = {
    type: 'strike', who: pi, team, shot, grade: g.grade, q: g.q, perfect, spin, power, x: x0, z, speed: sol.speed, forcedNet: !!sol.forcedNet,
    landX: sol.landX, human: p.human, target,
  };
  // possession bookkeeping
  const same = run.lastTeam === team;
  if (run.mode === 'rally') {
    run.streak++;
    run.windAmp = Math.min(2.0, 0.2 + 0.028 * run.streak);
    if (p.human) { const mult = 1 + Math.min(3, Math.floor(run.flow / 2)); rec.mult = mult; rec.gain = Math.round(10 * mult * (g.grade === 'perfect' ? 1.5 : g.grade === 'good' ? 1.15 : 1)); run.points += rec.gain; run.bestMult = Math.max(run.bestMult, mult); }
  }
  run.touches = same ? run.touches + 1 : 1;
  run.lastTeam = team; run.lastPlayer = pi;
  run.nextTeam = shot === 'set' ? team : 1 - team;
  run.rally++;
  run.recv = -1;
  run.phase = 'rally'; run.serving = false;
  p.anim = { t: 0, kind: 'strike', shot, cx: x0, cz: z, perfect, power, dir };
  p.plan = null;
  if (team === 0) {
    run.stats.strikes++; run.stats.shots[shot]++;
    if (perfect) run.stats.perfects++; else if (g.grade === 'good') run.stats.goods++;
    if (spin) run.stats.spins++;
    if (power) run.stats.powers++;
  }
  run.lastGrade = g.grade; run.lastShot = shot;
  ev(run, rec);
  return rec;
}

// ---- human stroke ----------------------------------------------------------------------------------------------------------------
export function strikeWindow(run, pi) {
  const b = run.ball, p = run.players[pi];
  if (!p || !b.alive) return { ok: false, why: 'none' };
  if (b.vz > 0.9) return { ok: false, why: 'rising' };
  if (b.z > Z_MAX) return { ok: false, why: 'high' };
  if (b.z < Z_MIN) return { ok: false, why: 'low' };
  if (Math.abs(b.x - p.x) > STRETCH_X) return { ok: false, why: 'far' };
  if (p.team === 0 && b.x > NET - 0.1) return { ok: false, why: 'net' };
  if (p.team === 1 && b.x < NET + 0.1) return { ok: false, why: 'net' };
  return { ok: true };
}
export const shotAvailable = (run, shot, z) => {
  const S = SHOTS[shot];
  if (z < S.minZ - 0.03) return false;
  if (shot === 'set' && !setAllowed(run, run.recv)) return false;
  if (shot === 'smash') { const p = run.players[run.recv]; if (p && Math.abs(run.ball.x - NET) > SMASH_FROM) return false; }
  return true;
};
// A set is possible when the team still has at least two touches left and a partner who did not just touch it.
export function setAllowed(run, pi) {
  const p = run.players[pi]; if (!p || run.format !== 'doubles') return false;
  const taken = run.lastTeam === p.team ? run.touches : 0;
  return taken < 2 && !run.players.every((q) => q.team !== p.team || q === p);
}
export function padShots(run) {
  const pi = run.recv >= 0 ? run.recv : humanIdx(run);
  return [setAllowed(run, pi) && !run.serving ? 'set' : 'lob', 'drive', 'drop', 'smash'];
}

export function humanStrike(run, shot, depth, rng, who = run.recv) {
  const pi = who;
  const p = run.players[pi];
  if (!p || run.over || run.phase === 'point' || run.phase === 'over') return { ok: false, why: 'idle' };
  if (run.recv !== pi) return { ok: false, why: 'notyours' };
  if (run.phase === 'serve' && run.ball.held) return { ok: false, why: 'serving' };
  const w = strikeWindow(run, pi), b = run.ball;
  if (!w.ok) return w;
  if (!shotAvailable(run, shot, b.z)) return { ok: false, why: 'shot', shot };
  if (shot === 'set' && !setAllowed(run, pi)) return { ok: false, why: 'shot', shot };
  if (run.touches >= 3 && run.lastTeam === p.team && shot === 'set') return { ok: false, why: 'shot' };
  const pen = b.spinIn ? 0.65 : 1;
  const g = stretchGrade(gradeFor(shot, b.z, pen), Math.abs(b.x - p.x));
  const power = run.power && p.human && g.grade === 'perfect';
  const rec = execStrike(run, pi, shot, depth, b.z, g, rng, { power });
  if (p.human) updateFlow(run, rec);
  return { ok: true, rec };
}
function updateFlow(run, rec) {
  if (rec.power) { run.power = false; run.flow = 0; }
  else if (rec.perfect) { run.flow++; if (run.flow >= 3 && !run.power) { run.power = true; ev(run, { type: 'power' }); } }
  else if (rec.grade !== 'good') run.flow = 0;
}

// ---- AI --------------------------------------------------------------------------------------------------------------------------
// Score a candidate stroke from contact point (x0, z0) for a striker on `team`. Higher is better. Uses the real physics.
function evalCandidate(run, team, x0, shot, depth, prof, q = 0.85) {
  const dir = team === 0 ? 1 : -1, S = SHOTS[shot];
  let xT;
  if (shot === 'set') xT = team === 0 ? NET - 1.45 : NET + 1.45;
  else { const rg = rng_(x0, S.zi, dir, shot, run.wind); if (!rg) return null; xT = rangeX(rg, depth, dir); }
  const sol = solveShot(x0, S.zi, dir, shot, xT, run.wind, false);
  if (!sol || sol.forcedNet || sol.net) return null;
  const sd = 0.12 + (1 - q) * 1.9;
  if (shot === 'set') return { sol, xT, score: 0.5, risk: 0 };
  const lnd = sol.landX;
  const out = (dir > 0 ? COURT - lnd : lnd) / sd, shortM = ((dir > 0 ? lnd - NET : NET - lnd)) / sd;
  const risk = 1 / (1 + Math.exp(1.7 * out)) + 1 / (1 + Math.exp(1.7 * (shortM - 0.4)));
  // the best defender
  const defs = run.players.filter((p) => p.team !== team);
  let margin = -9;
  for (const d of defs) {
    // a defender starts from where they stand, after a reaction delay; time to the contact point at 1.2 m
    const arrive = d.prof.react + Math.max(0, Math.abs(d.x - sol.xRef) - 0.35) / Math.max(2.5, d.prof.speed) + 0.1;
    const m = sol.tRef - arrive;
    if (margin === -9 || m > margin) margin = m;     // the defender with the best chance
  }
  const score = clamp(-margin, -1.2, 1.4) * 3.2 - risk * 4.2 - (S.id === 'lob' ? 0.35 : 0);
  return { sol, xT, score, risk, margin };
}
const DEPTHS = [0.05, 0.3, 0.55, 0.8, 1.0];
let RNG_KEY = '', RNG_VAL = null;
const rng_ = (x0, z0, dir, shot, wind) => { const k = `${x0.toFixed(2)}|${z0}|${dir}|${shot}|${wind.toFixed(2)}`; if (k !== RNG_KEY) { RNG_KEY = k; RNG_VAL = shotRange(x0, z0, dir, shot, wind); } return RNG_VAL; };
const WHY = {
  lob: (m) => (m.deep ? 'A deep lob pushes the rival back and gives you time.' : 'A high lob is safe and buys time to get back.'),
  drive: () => 'A flat drive arrives fast: the rival has little time to react.',
  drop: () => 'The rival is deep, so a drop just over the net makes them run.',
  smash: () => 'High contact: a smash gives the rival almost no time.',
  set: () => 'Set your partner up near the net for the attack.',
};
export function chooseStroke(run, striker, opts = {}) {
  const p = run.players[striker], team = p.team, prof = opts.prof || p.prof;
  const pr = predictAt(run.ball, run.wind, 1.2);
  const hx = opts.x ?? clamp(pr.x, 0.3, team === 0 ? NET - 0.5 : COURT - 0.3);
  const zNow = opts.z ?? 1.2;
  const out = [];
  const shots = ['lob', 'drive', 'drop', 'smash', 'set'];
  for (const sh of shots) {
    if (zNow < SHOTS[sh].minZ - 0.03 && !opts.ideal) continue;
    if (sh === 'smash' && Math.abs(hx - NET) > SMASH_FROM) continue;
    if (sh === 'set' && !(opts.allowSet ?? setAllowed(run, striker))) continue;
    if (sh === 'set' && run.touches >= 2 && run.lastTeam === team) continue;
    const ds = sh === 'set' ? [0.5] : DEPTHS;
    for (const d of ds) {
      const e = evalCandidate(run, team, hx, sh, d, prof, opts.q ?? 0.85);
      if (!e) continue;
      out.push({ shot: sh, depth: d, e, score: e.score });
    }
  }
  if (!out.length) return { shot: 'lob', depth: 0.6, why: 'A high lob keeps the point alive.', score: 0 };
  // team-play: in doubles, with touches left, the partner sets before attacking
  const wantSet = run.format === 'doubles' && setAllowed(run, striker) && run.lastTeam !== team && !opts.noSet;
  const hist = run.hist;
  for (const c of out) {
    c.s2 = c.score;
    if (hist.length && hist[hist.length - 1] === c.shot) c.s2 -= 0.5;
    if (hist.length > 1 && hist[hist.length - 1] === c.shot && hist[hist.length - 2] === c.shot) c.s2 -= 0.7;
    if (c.shot === 'set') c.s2 += wantSet && (run.touches === 1 || run.lastTeam !== team) ? 2.4 : -3;
    if (opts.rng && prof.temp) c.s2 += gauss(opts.rng) * prof.temp;
  }
  out.sort((a, b) => b.s2 - a.s2);
  const c = out[0];
  const defs = run.players.filter((q) => q.team !== team);
  const far = defs.length && Math.min(...defs.map((d) => Math.abs(d.x - (team === 0 ? COURT : 0)))) > 3.2;
  void far;
  const deep = c.depth > 0.6;
  return { shot: c.shot, depth: c.depth, why: WHY[c.shot]({ deep }), score: c.score, landX: c.e.sol.landX, zi: SHOTS[c.shot].zi };
}

// AI-controlled planning: pick the stroke before the peteca arrives, with its own timing error.
function aiPlan(run, pi, rng) {
  const p = run.players[pi], prof = p.prof;
  const allowSet = setAllowed(run, pi);
  let c;
  if (run.mode === 'rally' && p.team === 1) c = rallyFeed(run, pi, rng);
  else c = chooseStroke(run, pi, { rng, prof, allowSet, ideal: true });
  const S = SHOTS[c.shot];
  const sigma = prof.sigma;
  const err = gauss(rng) * sigma;
  const pr = predictAt(run.ball, run.wind, S.zi + err);
  p.plan = { shot: c.shot, depth: c.depth, zHit: S.zi + err, err, x: clamp(pr.x, 0.3, p.team === 0 ? NET - 0.45 : COURT - 0.3), why: c.why };
}
// Beach Rally: the partner feeds the player fairly: a mix of lobs and drives, getting quicker as the streak grows.
function rallyFeed(run, pi, rng) {
  const n = run.streak, u = rng.next();
  const pace = Math.min(1, n / 50);
  let shot = 'lob';
  if (u < 0.25 + 0.3 * pace) shot = 'drive'; else if (u < 0.45 + 0.35 * pace) shot = 'drop'; else shot = 'lob';
  const depth = clamp(0.25 + rng.next() * 0.55 + pace * 0.15, 0.2, 0.9);
  return { shot, depth, why: '' };
}

// ---- movement -----------------------------------------------------------------------------------------------------------------------
function movePlayers(run, dt, idle = false) {
  const b = run.ball;
  for (let i = 0; i < run.players.length; i++) {
    const p = run.players[i], prof = p.prof, lo = p.team === 0 ? 0.35 : NET + 0.4, hi = p.team === 0 ? NET - 0.4 : COURT - 0.35;
    let tx = p.home;
    const mine = !idle && run.recv === i && b.alive;
    const live = !idle && b.alive && (run.nextTeam === p.team);
    if (mine) {
      const zRef = p.plan ? p.plan.zHit : 1.2;
      const pr = predictAt(b, run.wind, Math.max(0.5, zRef));
      tx = clamp(pr.x, lo, hi);
      p.ready = Math.min(1, p.ready + dt * 6);
    } else if (live && run.format === 'doubles') {
      // support: stay clear of the partner who plays the ball: near the net when they are deep, covering the back when they are up
      const r = run.players[run.recv];
      const away = p.team === 0 ? -1 : 1;
      const pr = predictAt(b, run.wind, 1.2);
      const rx = r ? r.x : pr.x, dn = Math.abs(rx - NET);
      tx = dn > 3.4 ? NET + (p.team === 0 ? -1 : 1) * 1.7 : rx + away * 2.9;
      if (run.touches >= 1 && run.lastTeam === p.team) tx = NET + (p.team === 0 ? -1 : 1) * 1.5;
      tx = clamp(tx, lo, hi);
      p.ready = Math.max(0, p.ready - dt * 3);
    } else {
      // between touches drift back to the home spot (the other side is watching the flight)
      tx = p.home;
      p.ready = Math.max(0, p.ready - dt * 3);
    }
    // reaction delay: opponents only start running a moment after the stroke
    let sp = prof.speed;
    if (p.ai && p.reactT > 0) { p.reactT -= dt; sp = 0; }
    const dx = tx - p.x;
    const vWant = clamp(dx * 7, -sp, sp);
    const acc = 26;
    p.v += clamp(vWant - p.v, -acc * dt, acc * dt);
    p.x = clamp(p.x + p.v * dt, lo - 0.1, hi + 0.1);
    p.run += Math.abs(p.v) * dt * 1.05;
    if (p.anim) { p.anim.t += dt; if (p.anim.t > 0.6) p.anim = null; }
    // jump for high contacts: raised just before and after a smash
    p.z = p.anim && p.anim.shot === 'smash' ? Math.max(0, Math.sin(Math.min(1, p.anim.t / 0.5) * Math.PI)) * 0.34 : 0;
  }
}

// ---- points ----------------------------------------------------------------------------------------------------------------------
function endPoint(run, winner, why, kind) {
  if (run.phase === 'point' || run.phase === 'over') return;
  run.phase = 'point'; run.phaseT = 0; run.pointWhy = why; run.ball.alive = false; run.recv = -1;
  run.longest = Math.max(run.longest, run.rally);
  if (run.mode === 'rally') {
    run.over = { streak: run.streak, points: run.points, why, kind };
    run.phase = 'over';
    ev(run, { type: 'drop', x: run.ball.x, kind, why });
    return;
  }
  run.score[winner]++;
  if (winner === 0) run.stats.pointsWon++; else run.stats.pointsLost++;
  if (kind === 'error' && run.lastTeam === 0) run.stats.errors++;
  if (winner === 0 && run.rally >= 1 && run.lastTeam === 0 && kind === 'land') run.stats.winners++;
  if (winner === 0 && run.rally === 1 && run.lastTeam === 0 && run.players[run.lastPlayer].k === 0) run.stats.aces++;
  run.server = winner; run.lastWinner = winner;
  ev(run, { type: 'point', winner, why, kind, x: run.ball.x, score: [...run.score] });
  const [a, c] = run.score, hi = Math.max(a, c), lo = Math.min(a, c);
  if ((hi >= run.to && hi - lo >= 2) || hi >= run.cap) {
    run.phase = 'over';
    run.over = { winner, score: [...run.score], rally: run.longest };
    ev(run, { type: 'game', winner });
  }
}

function lose(run, team, why, kind) { endPoint(run, 1 - team, why, kind); }

function ballLanded(run) {
  const b = run.ball;
  if (run.mode === 'rally') {
    const out = b.x < -0.05 || b.x > COURT + 0.05;
    ev(run, { type: 'floor', x: b.x, out });
    endPoint(run, 0, out ? 'The peteca went out.' : 'The peteca dropped.', out ? 'out' : 'land');
    return;
  }
  const out = b.x < -0.05 || b.x > COURT + 0.05;
  ev(run, { type: 'floor', x: b.x, out });
  if (out) {
    const t = run.lastTeam < 0 ? run.server : run.lastTeam;
    const why = run.lastTeam < 0 ? 'The serve was not struck.' : t === 0 ? 'Your stroke went out.' : 'The rival hit it out.';
    lose(run, t, why, 'out');
  } else {
    const side = b.x < NET ? 0 : 1;
    if (run.lastTeam < 0) lose(run, side, side === 0 ? 'Serve not struck: a fault.' : 'The rival missed the serve.', 'fault');
    else if (run.lastTeam === side && run.touches >= 3) lose(run, side, side === 0 ? 'No touches left: it dropped on your side.' : 'The rivals could not return it.', 'land');
    else lose(run, side, side === 0 ? (run.lastTeam === 0 ? 'It dropped on your side.' : 'You could not reach it.') : 'The rival could not reach it.', 'land');
  }
}

// ---- the tick --------------------------------------------------------------------------------------------------------------------
export function stepRun(run, dt, rng) {
  if (run.over && run.phase === 'over') { run.t += dt; stepIdle(run, dt); return; }
  run.t += dt;
  run.wind = windNow(run);
  if (run.lock > 0) run.lock = Math.max(0, run.lock - dt);
  const b = run.ball;
  if (run.phase === 'point') {
    run.phaseT += dt;
    stepIdle(run, dt);
    if (run.phaseT > 1.7) beginServe(run, run.server);
    return;
  }
  if (run.phase === 'serve') {
    run.phaseT += dt;
    b.x += 0; b.z = 1.15 + 0.03 * Math.sin(run.t * 3);
    movePlayers(run, dt);
    const sp = run.players[run.recv];
    if (run.serveWait > 0) { run.serveWait -= dt; return; }
    if (!run.holdToss) toss(run);
    return;
  }
  // rally: who plays next?
  if (b.alive && run.recv < 0) {
    run.recv = chooseReceiver(run);
    const p = run.players[run.recv];
    p.plan = null; p.missed = false;
    if (p.ai) p.reactT = (p.prof.react || 0.2) * (run.lastTeam === p.team ? 0.4 : 1);
  }
  const p = run.recv >= 0 ? run.players[run.recv] : null;
  if (p && p.ai && b.alive && !p.plan && !p.missed && b.vz <= 1.5) aiPlan(run, run.recv, rng);
  movePlayers(run, dt);
  // sub-step the flight
  for (let k = 0; k < 2; k++) {
    if (!b.alive) break;
    const px = b.x;
    stepBall(b, STEP, run.wind);
    b.ang += b.av * STEP; b.av *= 0.995;
    // net
    if ((px - NET) * (b.x - NET) < 0 || Math.abs(b.x - NET) < 0.001) {
      if (b.z < NET_H) {
        ev(run, { type: 'net', x: NET, z: b.z, side: px < NET ? 0 : 1 });
        b.x = px < NET ? NET - 0.05 : NET + 0.05; b.vx = -b.vx * 0.12; b.vz = Math.min(b.vz, 0);
        b.alive = false; b.spin = null; b.falling = true;
        const t = run.lastTeam < 0 ? run.server : run.lastTeam;
        run.fall = { x: b.x, z: b.z, vx: b.vx, vz: b.vz };
        lose(run, t, t === 0 ? 'Into the net.' : 'The rival hit the net.', 'net');
        break;
      }
    }
    if (b.z <= 0) { b.z = 0; b.alive = false; b.vx = 0; b.vz = 0; ballLanded(run); break; }
    if (b.x < -4 || b.x > COURT + 4) { b.alive = false; ballLanded(run); break; }
    // AI strike at its planned height
    const q = run.recv >= 0 ? run.players[run.recv] : null;
    if (q && q.ai && q.plan && b.vz < 0 && b.z <= q.plan.zHit && b.alive) {
      aiStrike(run, run.recv, rng);
    }
    // the peteca falls past the reach with nobody striking: the point is decided when it lands (above)
  }
  // rally mode scoring
  if (run.mode === 'rally') { /* streak is awarded in game.js from events so combos can show */ }
  if (b.tumble > 0) b.tumble = Math.max(0, b.tumble - dt);
  if (!b.alive && b.falling) {
    // the dead peteca slides down the net for a moment
    b.vz -= G * dt; b.z = Math.max(0, b.z + b.vz * dt); b.x += b.vx * dt;
  }
}
function stepIdle(run, dt) {
  const b = run.ball;
  if (b.falling || b.z > 0) { b.vz -= G * dt; b.x += b.vx * dt; b.z = Math.max(0, b.z + b.vz * dt); if (b.z === 0) { b.vz = 0; b.vx = 0; b.falling = false; } }
  b.av *= 0.97; b.ang += b.av * dt;
  movePlayers(run, dt, true);
}

function aiStrike(run, pi, rng) {
  const p = run.players[pi], b = run.ball, plan = p.plan;
  const w = strikeWindow(run, pi);
  if (!w.ok) {
    // not there yet (or still rising): keep waiting; only a peteca that has fallen past the reach is a miss
    if (b.z < Z_MIN + 0.05) { p.plan = null; p.missed = true; }
    return;
  }
  let shot = plan.shot;
  if (!shotAvailable(run, shot, b.z)) shot = b.z < SHOTS.drive.minZ ? 'lob' : 'drive';
  if (shot === 'set' && !setAllowed(run, pi)) shot = 'lob';
  const g = stretchGrade(gradeFor(shot, b.z, b.spinIn ? 0.65 : 1), Math.abs(b.x - p.x));
  const rec = execStrike(run, pi, shot, plan.depth, b.z, g, rng, { power: false });
  void rec;
}

// ---- Think hint and Watch & Learn ------------------------------------------------------------------------------------------------
export function advise(run, pi = humanIdx(run)) {
  const idx = pi < 0 ? 0 : pi;
  const p = run.players[idx];
  const prof = { temp: 0 };
  const c = chooseStroke(run, idx, { prof, ideal: true, q: 0.9, allowSet: setAllowed(run, idx) });
  const pads = padShots(run);
  let pad = pads.indexOf(c.shot);
  if (pad < 0) pad = c.shot === 'set' ? 0 : 0;
  return { shot: c.shot, depth: c.depth, pad, zi: SHOTS[c.shot].zi, why: c.why, landX: c.landX, power: !!(run.power && p.human) };
}

// Is the human's palm able to strike right now (used by the UI to light the pads)?
export function ready(run) {
  const pi = run.recv;
  if (pi < 0 || !run.players[pi] || !run.players[pi].human) return false;
  return strikeWindow(run, pi).ok && !run.over;
}

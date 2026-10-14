// Circle Dodgeball: the world and its rules. Pure and deterministic: no DOM, no clock, no Math.random (randomness comes from the rng
// handed to newWorld / stepWorld; AI "noise" that must not consume the rng comes from `hash`).
//
// Two formats share one engine:
//   court  Queimada: two teams, each on its half of a painted circle. A hit player is burned and goes to the cemetery behind the
//          other team, from where he still throws. A catch burns the thrower and brings a teammate back.
//   ring   Volkerball / Palla avvelenata: the ring team stands round the circle, the dodgers move inside. A burned dodger joins the
//          ring; a catch brings the longest-waiting ex-dodger back inside and sits the thrower out for a moment.
// Team 0 is always the player's team (orange); the player controls player 0 of it.

export const ARENA = 1000;
export const CX = 500, CY = 500;
export const R = 440;            // radius of the painted circle (play area)
export const RIM = 480;          // radius of the line rim players stand on
export const HIT_R = 38, CATCH_R = 56, BODY_H = 88, CATCH_H = 110;
export const SPEED = 235, STANCE = 0.45, CATCH_CD = 1.3, WIND_FAST = 0.3, WIND_LOB = 0.42, WIND_PASS = 0.2;
export const FAST_V = 920, LOB_V = 440, PASS_V = 560, HOLD_MAX = 7;
const GRAV = { fast: 260, lob: 900, pass: 420, dead: 900 };
export const GRACE = 1.8;        // nobody may throw in the first moments of a match
export const THINK_TIMES = [3, 5, 8, 10];
export const REVEAL_SECONDS = 2;
export const AUTO_VENUE = 0;

export const VENUES = [
  { id: 'patio', name: 'Patio da Escola', place: 'Brazil', local: 'Queimada', kind: 'court', per: 3, balls: 1, time: 120, skill: 0.42, err: 1, vk: 1, hold: 0.25, drag: 1, floor: 'terracotta', names: 'br',
    blurb: 'A schoolyard court: three against three, one ball. The classic.' },
  { id: 'turnhalle', name: 'Turnhalle', place: 'Germany', local: 'Volkerball', kind: 'ring', dodgers: 4, ring: 3, balls: 1, time: 150, skill: 0.55, err: 2, vk: 0.85, hold: 1.6, drag: 1, floor: 'parquet', names: 'de',
    blurb: 'A gym circle: the ring throws, the dodgers survive. Burned dodgers join the ring.' },
  { id: 'piazza', name: 'Piazza', place: 'Italy', local: 'Palla avvelenata', kind: 'ring', dodgers: 5, ring: 3, balls: 2, time: 165, skill: 0.64, err: 1.7, vk: 0.9, hold: 1.2, drag: 1, floor: 'cobble', names: 'it',
    blurb: 'Two balls on an old cobbled square. Pass round the ring to find the gap.' },
  { id: 'praia', name: 'Praia', place: 'Brazil', local: 'Queimada', kind: 'court', per: 5, balls: 2, time: 150, skill: 0.78, err: 1.2, vk: 1, hold: 0.2, drag: 0.88, floor: 'sand', names: 'br',
    blurb: 'Five against five on soft sand, two balls. Heavy legs, quick hands.' },
];

const NAMES = {
  br: ['Ana', 'Caio', 'Bia', 'Davi', 'Lia', 'Rafa', 'Marta', 'Beto', 'Nina', 'Teo'],
  de: ['Anna', 'Jonas', 'Lena', 'Felix', 'Mia', 'Paul', 'Emma', 'Leon', 'Hanna', 'Tim'],
  it: ['Giulia', 'Marco', 'Sofia', 'Luca', 'Chiara', 'Matteo', 'Elena', 'Paolo', 'Sara', 'Dario'],
};
const SKINS = ['#f6d9c0', '#eec19a', '#d9a577', '#b57d54', '#8a5a3a'];
const HAIRS = ['#2a1a10', '#5a3a1e', '#c9a14a', '#1a1a1e', '#8a3a1e'];

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const rimPos = (th) => ({ x: CX + Math.cos(th) * RIM, y: CY + Math.sin(th) * RIM });
const polar = (x, y) => Math.atan2(y - CY, x - CX);

// ---- world ----------------------------------------------------------------------------------------------------------------------------------
// opts: { venueIdx, role: 'dodger' | 'ring' (ring venues; the player's side), rng, auto }
export function newWorld({ venueIdx = 0, role = 'dodger', rng, auto = false }) {
  const v = VENUES[venueIdx];
  const w = {
    venueIdx, kind: v.kind, role: v.kind === 'ring' ? role : 'court', t: 0, tick: 0, timeTotal: v.time, timeLeft: v.time, phase: 'play', done: null,
    ps: [], balls: [], events: [], evN: 0, me: 0, auto, nextBall: 1, nextThrow: 1,
    stats: { burns: 0, catches: 0, hitsTaken: 0, throws: 0, passes: 0, revived: 0, aimed: 0 },
    teamBurns: [0, 0], msg: null, msgT: 0, dodgerTeam: v.kind === 'ring' ? (role === 'dodger' ? 0 : 1) : -1,
  };
  const names = NAMES[v.names];
  let ni = 0;
  const mk = (team, i, x, y, st) => {
    const id = w.ps.length;
    const sk = rng.int(SKINS.length), hr = rng.int(HAIRS.length);
    const p = {
      id, team, orig: team, i, name: id === 0 ? 'You' : names[(ni++) % names.length], x, y, vx: 0, vy: 0, a: team === 0 ? -Math.PI / 2 : Math.PI / 2, st,
      ball: null, windT: 0, aim: null, catchT: 0, catchCd: 0, stun: 0, hitT: 0, throwT: 0, catchAnim: 0, gait: rng.range(0, 6), heldT: 0,
      lost: false, lostAt: 0, skin: SKINS[sk], hair: HAIRS[hr], style: rng.int(4), num: 1 + ((id * 3 + 2) % 9), tall: 0.92 + rng.range(0, 0.16),
      plan: null, aiT: rng.range(0, 0.2), react: 0.42 - 0.3 * v.skill + rng.range(0, 0.15), sk: v.skill + rng.range(-0.08, 0.08), seen: {}, home: { x, y },
      dest: null, joinedRim: false,
    };
    w.ps.push(p);
    return p;
  };
  if (v.kind === 'court') {
    for (let team = 0; team < 2; team++) {
      for (let i = 0; i < v.per; i++) {
        const k = (i + 0.5) / v.per, spread = Math.min(300, 120 + v.per * 40);
        const x = CX + (k - 0.5) * 2 * spread * (v.per > 1 ? 1 : 0), depth = 110 + (i % 2) * 90;
        const y = team === 0 ? CY + depth + 30 : CY - depth - 30;
        mk(team, i, x, y, 'in');
      }
    }
  } else {
    const dTeam = w.dodgerTeam, rTeam = 1 - dTeam;
    const order = [];
    // the human is always player 0 of team 0: create team 0 first
    for (const team of [0, 1]) order.push(team);
    for (const team of order) {
      if (team === dTeam) {
        for (let i = 0; i < v.dodgers; i++) {
          const a = (i / v.dodgers) * Math.PI * 2 + 0.5, rr = i === 0 && team === 0 ? 0 : 130 + (i % 2) * 70;
          mk(team, i, CX + Math.cos(a) * rr, CY + Math.sin(a) * rr, 'in');
        }
      } else {
        for (let i = 0; i < v.ring; i++) {
          const th = -Math.PI / 2 + (i / v.ring) * Math.PI * 2 + (team === 0 ? 0.3 : 0);
          const q = rimPos(th); const p = mk(team, i, q.x, q.y, 'rim'); p.a = th + Math.PI;
        }
      }
    }
  }
  // the AI dodgers are sharper when the human is on the ring (the ring role is the easier one)
  if (v.kind === 'ring' && role === 'ring') for (const p of w.ps) if (p.team === w.dodgerTeam) { p.sk += 0.13; p.react = Math.max(0.12, p.react - 0.05); }
  // ball(s): court: on the centre line; ring: in the hands of rim players
  for (let b = 0; b < v.balls; b++) {
    if (v.kind === 'court') {
      // one ball: on the player's side of the line (the first reach is theirs); two balls: one on each side
      const side = v.balls === 1 ? 1 : (b === 0 ? 1 : -1), off = v.balls === 1 ? 0 : (b === 0 ? -110 : 110);
      w.balls.push(newBall(w, CX + off, CY + side * 70, null));
    } else {
      const rimPs = w.ps.filter((p) => p.st === 'rim' && p.team !== w.dodgerTeam);
      const holder = rimPs[(b * 2) % rimPs.length];
      const ball = newBall(w, holder.x, holder.y, holder.id);
      holder.ball = ball.id; ball.holder = holder.id; holder.heldT = 0;
      w.balls.push(ball);
    }
  }
  return w;
}

function newBall(w, x, y) {
  return { id: w.nextBall++, x, y, z: 0, vx: 0, vy: 0, vz: 0, live: false, holder: null, thrower: null, team: -1, kind: 'dead', age: 0, rest: true, restT: 0, inside: true, ret: null, sn: 0 };
}

const ballById = (w, id) => w.balls.find((b) => b.id === id) ?? null;
export const alive = (w, team) => w.ps.filter((p) => p.team === team && p.st === 'in');
export const playerById = (w, id) => w.ps[id];

function emit(w, kind, o = {}) {
  w.evN += 1;
  w.events.push({ n: w.evN, kind, t: w.t, ...o });
  if (w.events.length > 24) w.events.shift();
}
function say(w, text) { w.msg = text; w.msgT = 0; }

// ---- geometry of who may stand where -----------------------------------------------------------------------------------------------
function ownHalfSign(team) { return team === 0 ? 1 : -1; }   // team 0 plays the lower half (y > CY)

function cemeteryRange(team) {
  // team's cemetery lies on the rim of the OTHER team's half. Team 0 is the lower half, so its cemetery is the upper rim (angles -pi..0).
  return team === 0 ? [-Math.PI + 0.22, -0.22] : [0.22, Math.PI - 0.22];
}

function constrain(w, p) {
  if (p.st === 'in') {
    if (w.kind === 'court') {
      const s = ownHalfSign(p.team);
      if (s > 0) p.y = Math.max(p.y, CY + 16); else p.y = Math.min(p.y, CY - 16);
    }
    const dx = p.x - CX, dy = p.y - CY, d = Math.hypot(dx, dy), lim = R - 26;
    if (d > lim) { p.x = CX + (dx / d) * lim; p.y = CY + (dy / d) * lim; }
  } else {
    // rim: stay on or outside the ring line, and in the cemetery arc when in a court
    let dx = p.x - CX, dy = p.y - CY, d = Math.hypot(dx, dy) || 1;
    let th = Math.atan2(dy, dx);
    if (w.kind === 'court') {
      const [lo, hi] = cemeteryRange(p.team);
      if (th < lo || th > hi) { th = Math.abs(angDiff(th, lo)) < Math.abs(angDiff(th, hi)) ? lo : hi; dx = Math.cos(th) * d; dy = Math.sin(th) * d; }
    }
    const rr = clamp(d, RIM, RIM + 18);
    p.x = CX + Math.cos(th) * rr; p.y = CY + Math.sin(th) * rr;
  }
}

function toRim(w, p) {
  p.st = 'rim'; p.lost = true; p.lostAt = w.t; p.catchT = 0; p.windT = 0; p.aim = null; p.dest = null; p.plan = null;
  if (p.ball !== null) { const b = ballById(w, p.ball); if (b) dropBall(b, p); }
  // walk to the rim from where he stands (not a teleport): the next steps pull him out radially
  p.joinedRim = true;
  // Volkerball: a burned dodger joins the ring and throws at the dodgers who are left
  if (w.kind === 'ring' && p.team === w.dodgerTeam) p.team = 1 - w.dodgerTeam;
}

function dropBall(b, p) {
  b.holder = null; b.live = false; b.kind = 'dead'; b.team = -1; b.rest = false; b.restT = 0; b.vx = 0; b.vy = 0; b.vz = 0; b.z = 0; b.age = 0;
  if (p) { b.x = p.x; b.y = p.y; p.ball = null; p.heldT = 0; }
}

// ---- physics of a ball in flight ----------------------------------------------------------------------------------------------------------
function flightVelocity(b, sx, sy, tx, ty, kind, z0, zt, vk = 1) {
  const v = (kind === 'fast' ? FAST_V : kind === 'lob' ? LOB_V : PASS_V) * vk;
  const dx = tx - sx, dy = ty - sy, d = Math.max(30, Math.hypot(dx, dy)), T = d / v, g = GRAV[kind];
  b.vx = (dx / d) * v; b.vy = (dy / d) * v;
  b.vz = (zt - z0 + 0.5 * g * T * T) / T;
  return T;
}

// Where will this ball be, step by step (used for warnings and for the AI's reading of threats). Returns the first hit time on `p`, or null.
export function threatOf(w, b, p) {
  if (!b.live || b.team === p.team || b.holder !== null) return null;
  let x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz, inside = b.inside;
  const g = GRAV[b.kind] ?? GRAV.dead, dt = 1 / 30;
  let best = 1e9;
  for (let k = 1; k <= 54; k++) {
    x += vx * dt; y += vy * dt; z += vz * dt; vz -= g * dt;
    if (z <= 0) return best < 1e8 ? { eta: k * dt - dt, miss: best } : null;
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < best && z < CATCH_H) best = d;
    if (d < HIT_R + 4 && z < BODY_H) return { eta: k * dt, miss: d, x, y };
    const r = Math.hypot(x - CX, y - CY);
    if (r < R - 10) inside = true;
    if (inside && r > R + 40) break;
  }
  return null;
}

// ---- stepping ---------------------------------------------------------------------------------------------------------------------------
// ctl for the human (or for the coach driving the human): { mx, my, throw: { tid, tx, ty, kind }, pass: tid, catch: bool }
export function stepWorld(w, dt, rng, ctl) {
  if (w.phase !== 'play') return;
  w.t += dt; w.tick += 1; w.timeLeft = Math.max(0, w.timeTotal - w.t);
  if (w.msg) w.msgT += dt;
  const v = VENUES[w.venueIdx];
  const speedK = v.drag;

  // ---- who acts
  for (const p of w.ps) {
    if (p.catchCd > 0) p.catchCd = Math.max(0, p.catchCd - dt);
    if (p.catchT > 0) p.catchT = Math.max(0, p.catchT - dt);
    if (p.stun > 0) p.stun = Math.max(0, p.stun - dt);
    if (p.hitT > 0) p.hitT = Math.max(0, p.hitT - dt);
    if (p.throwT > 0) p.throwT = Math.max(0, p.throwT - dt);
    if (p.catchAnim > 0) p.catchAnim = Math.max(0, p.catchAnim - dt);
    let c;
    c = p.id === w.me && ctl ? ctl : aiControl(w, p, dt, rng);
    act(w, p, c || {}, dt, rng, speedK);
  }
  // players push each other apart a little
  for (let i = 0; i < w.ps.length; i++) {
    const a = w.ps[i];
    for (let j = i + 1; j < w.ps.length; j++) {
      const b = w.ps[j];
      if (a.st !== b.st) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      const sep = a.st === 'rim' ? 54 : 40;
      if (d > 0 && d < sep) { const k = (sep - d) / 2 / d; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; }
    }
  }
  for (const p of w.ps) constrain(w, p);

  // ---- balls
  for (const b of w.balls) stepBall(w, b, dt, rng);

  // ---- win
  checkEnd(w);
}

function act(w, p, c, dt, rng, speedK) {
  // movement
  let mx = c.mx || 0, my = c.my || 0;
  const m = Math.hypot(mx, my);
  if (m > 1) { mx /= m; my /= m; }
  let sp = SPEED * speedK;
  if (p.st === 'rim') sp *= 1.1;
  if (p.catchT > 0) sp *= 0.45;
  if (p.windT > 0) sp *= 0.25;
  if (p.stun > 0) sp = 0;
  if (p.hitT > 0.2) sp *= 0.3;
  if (p.ball !== null) sp *= 0.94;
  const k = Math.min(1, dt * 12);
  p.vx += (mx * sp - p.vx) * k; p.vy += (my * sp - p.vy) * k;
  p.x += p.vx * dt; p.y += p.vy * dt;
  const spd = Math.hypot(p.vx, p.vy);
  p.gait += spd * dt * 0.052;
  if (spd > 30) { const ta = Math.atan2(p.vy, p.vx); if (p.windT <= 0) p.a += angDiff(ta, p.a) * Math.min(1, dt * 10); }

  // catch stance
  if (c.catch && p.st === 'in' && p.catchT <= 0 && p.catchCd <= 0 && p.ball === null && p.stun <= 0 && p.windT <= 0) {
    p.catchT = STANCE; p.catchCd = CATCH_CD; p.catchAnim = STANCE; emit(w, 'stance', { x: p.x, y: p.y, p: p.id });
  }

  // throw / pass request
  if (p.ball !== null) {
    p.heldT += dt;
    const b = ballById(w, p.ball);
    if (b) { b.x = p.x + Math.cos(p.a) * 17; b.y = p.y + Math.sin(p.a) * 17; b.z = 50; b.vx = 0; b.vy = 0; b.vz = 0; }
    if (p.windT <= 0 && p.catchT <= 0 && p.stun <= 0 && w.t >= GRACE) {
      if (c.throw && (w.kind === 'court' || p.team !== w.dodgerTeam)) {
        const tg = c.throw.tid !== undefined && c.throw.tid !== null ? w.ps[c.throw.tid] : null;
        p.aim = { tid: tg ? tg.id : null, tx: tg ? tg.x : c.throw.tx, ty: tg ? tg.y : c.throw.ty, kind: c.throw.kind === 'lob' ? 'lob' : 'fast', pass: false, lead: c.throw.lead ?? 0.75, err: c.throw.err ?? 0.03 };
        p.windT = p.aim.kind === 'lob' ? WIND_LOB : WIND_FAST;
        p.windMax = p.windT;
        p.a = Math.atan2(p.aim.ty - p.y, p.aim.tx - p.x);
        p.vx *= 0.3; p.vy *= 0.3;
      } else if (c.pass !== undefined && c.pass !== null) {
        const tg = w.ps[c.pass];
        if (tg && tg.team === p.team && tg.id !== p.id && tg.ball === null) {
          p.aim = { tid: tg.id, tx: tg.x, ty: tg.y, kind: 'pass', pass: true, lead: 0.8, err: 0.01 };
          p.windT = WIND_PASS; p.windMax = WIND_PASS; p.a = Math.atan2(tg.y - p.y, tg.x - p.x);
        }
      }
    }
    if (p.windT > 0) {
      // keep facing the target while winding up
      if (p.aim) {
        const tg = p.aim.tid !== null ? w.ps[p.aim.tid] : null;
        if (tg) { p.aim.tx = tg.x; p.aim.ty = tg.y; }
        p.a = Math.atan2(p.aim.ty - p.y, p.aim.tx - p.x);
      }
      p.windT -= dt;
      if (p.windT <= 0) { p.windT = 0; release(w, p, rng); }
    } else if (p.heldT > HOLD_MAX + (p.id === w.me ? 0 : 0)) {
      // shot clock: the ball is taken from the holder
      const bb = ballById(w, p.ball); if (bb) { dropBall(bb, p); emit(w, 'clock', { x: p.x, y: p.y, p: p.id }); }
    }
  } else { p.heldT = 0; if (p.windT > 0) { p.windT = 0; p.aim = null; } }
}

function release(w, p, rng) {
  const b = ballById(w, p.ball), aim = p.aim;
  p.aim = null;
  if (!b || !aim) return;
  p.ball = null; p.heldT = 0; b.holder = null; b.rest = false; b.age = 0; b.inside = Math.hypot(p.x - CX, p.y - CY) < R - 10;
  p.throwT = 0.35;
  const tg = aim.tid !== null ? w.ps[aim.tid] : null;
  let tx = aim.tx, ty = aim.ty;
  const sx = p.x + Math.cos(p.a) * 17, sy = p.y + Math.sin(p.a) * 17;
  const kind = aim.kind;
  if (tg) {
    const v = (kind === 'fast' ? FAST_V : kind === 'lob' ? LOB_V : PASS_V) * VENUES[w.venueIdx].vk;
    // lead: the target keeps moving while the ball is in the air
    const T = Math.hypot(tg.x - sx, tg.y - sy) / v;
    tx = tg.x + tg.vx * T * aim.lead; ty = tg.y + tg.vy * T * aim.lead;
  }
  // aim error: a small random turn of the whole throw
  const err = (rng.next() * 2 - 1) * aim.err;
  const dx = tx - sx, dy = ty - sy, ca = Math.cos(err), sa = Math.sin(err);
  tx = sx + dx * ca - dy * sa; ty = sy + dx * sa + dy * ca;
  b.x = sx; b.y = sy; b.z = 54;
  flightVelocity(b, sx, sy, tx, ty, kind, 54, kind === 'lob' ? 40 : 46, VENUES[w.venueIdx].vk);
  b.kind = kind; b.thrower = p.id; b.team = p.team; b.sn = w.nextThrow++;
  if (aim.pass) { b.live = false; w.stats.passes += p.orig === 0 ? 1 : 0; emit(w, 'pass', { x: sx, y: sy, p: p.id }); }
  else { b.live = true; if (p.orig === 0) w.stats.throws += 1; emit(w, 'throw', { x: sx, y: sy, p: p.id, k: kind }); }
}

function stepBall(w, b, dt, rng) {
  b.age += dt;
  if (b.holder !== null) return;
  if (b.ret !== null) {   // sent back to the ring by hand (ring format): glides to the chosen player
    const q = w.ps[b.ret];
    if (!q || q.st !== 'rim' || q.ball !== null) { b.ret = null; }
    else {
      const dx = q.x - b.x, dy = q.y - b.y, d = Math.hypot(dx, dy);
      if (d < 36) { b.ret = null; give(w, q, b); return; }
      b.x += (dx / d) * 560 * dt; b.y += (dy / d) * 560 * dt; b.z = 30; b.live = false; return;
    }
  }
  const g = b.live || b.kind === 'pass' ? GRAV[b.kind] : GRAV.dead;
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.z > 0 || b.vz !== 0) { b.z += b.vz * dt; b.vz -= g * dt; }
  const r = Math.hypot(b.x - CX, b.y - CY);
  if (r < R - 10) b.inside = true;

  if (b.live) {
    // catches first, then hits
    let who = null, how = null, bestD = 1e9;
    for (const q of w.ps) {
      if (q.st !== 'in' || q.team === b.team) continue;
      const d = Math.hypot(q.x - b.x, q.y - b.y);
      if (q.catchT > 0 && d < CATCH_R && b.z < CATCH_H && d < bestD) { who = q; how = 'catch'; bestD = d; }
    }
    if (!who) {
      for (const q of w.ps) {
        if (q.st !== 'in' || q.team === b.team) continue;
        const d = Math.hypot(q.x - b.x, q.y - b.y);
        if (d < HIT_R && b.z < BODY_H && b.z > -5 && d < bestD) { who = q; how = 'hit'; bestD = d; }
      }
    }
    if (who && how === 'catch') { doCatch(w, who, b, rng); return; }
    if (who && how === 'hit') { doHit(w, who, b, rng); return; }
    if (b.inside && r > R + 30) { b.live = false; b.kind = 'dead'; emit(w, 'wall', { x: b.x, y: b.y }); }
  } else if (b.kind === 'pass') {
    for (const q of w.ps) {
      if (q.team !== b.team || q.id === b.thrower || q.ball !== null || q.stun > 0) continue;
      if (q.st === 'in' && w.kind === 'ring' && q.team === w.dodgerTeam) continue;
      const d = Math.hypot(q.x - b.x, q.y - b.y);
      if (d < 40 && b.z < 110) { give(w, q, b); emit(w, 'receive', { x: q.x, y: q.y, p: q.id }); return; }
    }
  }

  // ground
  if (b.z <= 0 && b.vz <= 0) {
    b.z = 0;
    if (b.live || b.kind === 'pass') { b.live = false; b.kind = 'dead'; emit(w, 'bounce', { x: b.x, y: b.y }); }
    if (b.vz < -90) { b.vz = -b.vz * 0.46; emit(w, 'thud', { x: b.x, y: b.y }); } else b.vz = 0;
    b.vx *= 0.72; b.vy *= 0.72;
  }
  if (!b.live && b.z <= 0) {
    const f = Math.max(0, 1 - 2.4 * dt);
    b.vx *= f; b.vy *= f;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp < 14) { b.vx = 0; b.vy = 0; b.rest = true; b.restT += dt; } else { b.rest = false; b.restT = 0; }
  }
  // the fence: dead balls bounce off the edge of the circle (rim players reach them)
  if (!b.live && b.kind === 'dead') {
    const rr = Math.hypot(b.x - CX, b.y - CY);
    if (rr > R + 8) {
      const nx = (b.x - CX) / rr, ny = (b.y - CY) / rr, vn = b.vx * nx + b.vy * ny;
      if (vn > 0) { b.vx -= 1.6 * vn * nx; b.vy -= 1.6 * vn * ny; }
      b.x = CX + nx * (R + 8); b.y = CY + ny * (R + 8);
    }
  }
  if (!b.live && b.kind === 'dead') pickups(w, b);
}

function give(w, q, b) {
  b.holder = q.id; b.live = false; b.kind = 'dead'; b.team = -1; b.vx = 0; b.vy = 0; b.vz = 0; b.rest = false; b.ret = null; b.thrower = null;
  q.ball = b.id; q.heldT = 0;
}

function pickups(w, b) {
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > 260 || b.z > 30 || b.holder !== null) return;
  let who = null, bd = 1e9;
  for (const q of w.ps) {
    if (q.ball !== null || q.stun > 0 || q.windT > 0 || q.catchT > 0 || q.hitT > 0.25) continue;
    const reach = q.st === 'rim' ? 74 : 36;
    const d = Math.hypot(q.x - b.x, q.y - b.y);
    if (d > reach) continue;
    if (w.kind === 'ring' && q.st === 'in') continue;          // dodgers never touch the ball
    if (w.kind === 'court' && q.st === 'in') {
      const s = ownHalfSign(q.team);
      if ((b.y - CY) * s < -14) continue;                      // on the other side
    }
    if (d < bd) { bd = d; who = q; }
  }
  if (who) { give(w, who, b); emit(w, 'pickup', { x: who.x, y: who.y, p: who.id }); return; }
  // ring format: a ball resting out of every ring player's reach is sent back by hand to the nearest free one
  if (w.kind === 'ring' && b.rest && b.restT > 0.3) {
    let best = null, bd2 = 1e9;
    for (const q of w.ps) {
      if (q.st !== 'rim' || q.team === w.dodgerTeam || q.ball !== null || q.stun > 0) continue;
      const d = Math.hypot(q.x - b.x, q.y - b.y);
      if (d < bd2) { bd2 = d; best = q; }
    }
    if (best) b.ret = best.id;
  }
}

function doCatch(w, q, b, rng) {
  const t = b.thrower !== null ? w.ps[b.thrower] : null;
  give(w, q, b);
  q.catchT = 0; q.catchAnim = 0.5; q.a = t ? Math.atan2(t.y - q.y, t.x - q.x) : q.a;
  if (q.orig === 0) w.stats.catches += 1;
  emit(w, 'catch', { x: q.x, y: q.y, p: q.id, from: t ? t.id : null });
  if (w.kind === 'court') {
    if (t && t.st === 'in') { w.teamBurns[q.team] += 1; toRim(w, t); emit(w, 'burn', { x: t.x, y: t.y, p: t.id, by: q.id, how: 'catch' }); }
  } else if (t) {
    t.stun = 4; emit(w, 'stun', { x: t.x, y: t.y, p: t.id });
  }
  revive(w, q.team, q);
  if (w.kind === 'ring') {
    // the dodgers cannot keep the ball: it goes straight back to the ring
    const ringTeam = 1 - w.dodgerTeam;
    const free = w.ps.filter((p) => p.st === 'rim' && p.team === ringTeam && p.ball === null && p.stun <= 0);
    free.sort((a, c) => Math.hypot(a.x - q.x, a.y - q.y) - Math.hypot(c.x - q.x, c.y - q.y));
    q.ball = null; b.holder = null;
    if (free.length) { b.ret = free[free.length - 1].id; b.x = q.x; b.y = q.y; } else { b.x = q.x; b.y = q.y; }
  }
  if (q.orig === 0) say(w, w.kind === 'court' ? 'Caught! Burned on the other side' : 'Caught! A teammate is back');
  else say(w, 'They caught it');
}

function revive(w, team, by) {
  const cand = w.ps.filter((p) => (w.kind === 'ring' ? p.orig === team : p.team === team) && p.st === 'rim' && p.lost && p.stun <= 0).sort((a, b) => a.lostAt - b.lostAt);
  const p = cand[0];
  if (!p) return false;
  p.team = team; p.st = 'in'; p.lost = false; p.hitT = 0; p.windT = 0; p.catchCd = 0.5; p.joinedRim = false;
  if (w.kind === 'court') {
    const s = ownHalfSign(team);
    p.x = CX + clamp(by ? by.x - CX : 0, -120, 120) * -0.6 + (hash(p.id, w.tick) - 0.5) * 120; p.y = CY + s * (190 + hash(p.id, 3) * 80);
  } else {
    p.x = CX + (hash(p.id, w.tick) - 0.5) * 120; p.y = CY + (hash(p.id, w.tick + 5) - 0.5) * 120;
  }
  p.vx = 0; p.vy = 0;
  if (p.orig === 0) w.stats.revived += 1;
  emit(w, 'revive', { x: p.x, y: p.y, p: p.id });
  return true;
}

function doHit(w, q, b, rng) {
  const t = b.thrower !== null ? w.ps[b.thrower] : null;
  emit(w, 'hit', { x: q.x, y: q.y, p: q.id, by: t ? t.id : null });
  if (t && t.orig === 0) w.stats.burns += 1;
  if (q.orig === 0) w.stats.hitsTaken += 1;
  w.teamBurns[1 - q.orig] += 1;
  q.hitT = 0.7;
  // the ball drops and bounces away
  b.live = false; b.kind = 'dead'; b.team = -1;
  const sp = Math.hypot(b.vx, b.vy) || 1;
  b.vx = (b.vx / sp) * -80 + (rng.next() - 0.5) * 220; b.vy = (b.vy / sp) * -80 + (rng.next() - 0.5) * 220; b.vz = 200; b.thrower = null;
  toRim(w, q);
  if (q.orig === 0) say(w, w.kind === 'court' ? `${q.id === w.me ? 'You are' : q.name + ' is'} burned` : `${q.id === w.me ? 'You are' : q.name + ' is'} out: join the ring`);
  else say(w, `Burned: ${q.name}`);
}

function checkEnd(w) {
  if (w.phase !== 'play') return;
  const a0 = alive(w, 0).length, a1 = alive(w, 1).length;
  let done = null;
  if (w.kind === 'court') {
    if (a0 === 0) done = 'lost'; else if (a1 === 0) done = 'won';
    else if (w.timeLeft <= 0) done = a0 > a1 ? 'won' : a0 < a1 ? 'lost' : (w.teamBurns[0] > w.teamBurns[1] ? 'won' : w.teamBurns[0] < w.teamBurns[1] ? 'lost' : 'draw');
  } else {
    const dTeam = w.dodgerTeam, dAlive = alive(w, dTeam).length;
    if (dAlive === 0) done = dTeam === 0 ? 'lost' : 'won';
    else if (w.timeLeft <= 0) done = dTeam === 0 ? 'won' : 'lost';
  }
  if (done) { w.done = done; w.phase = 'over'; emit(w, 'end', { how: done }); }
}

// ---- the AI (also the coach): decide what a player does ---------------------------------------------------------------------------------
const enemiesIn = (w, team) => w.ps.filter((p) => p.team !== team && p.st === 'in');

// Every ball that will reach p: [{ b, eta, miss }]
export function threatsTo(w, p, minAge = 0) {
  const out = [];
  for (const b of w.balls) {
    if (!b.live || b.holder !== null || b.age < minAge) continue;
    const t = threatOf(w, b, p);
    if (t && t.eta !== undefined && t.x !== undefined) out.push({ b, eta: t.eta, miss: t.miss, x: t.x, y: t.y });
  }
  out.sort((a, c) => a.eta - c.eta);
  return out;
}

function lowerHalf(p) { return p.y > CY; }

function slotFor(w, p) {
  // formation: spread over the own half (court) or the inner circle (ring dodgers), then a short random hop every half second or so, so
  // nobody runs a straight line the thrower can lead
  const t = w.t, ph = hash(p.id, 9) * 6.28, step = Math.floor(t / (0.45 + 0.25 * hash(p.id, 5)) + hash(p.id, 6) * 7);
  const jx = (hash(p.id + 31, step) - 0.5) * 2, jy = (hash(p.id + 57, step) - 0.5) * 2;
  if (w.kind === 'court') {
    const s = ownHalfSign(p.team);
    const team = w.ps.filter((q) => q.team === p.team && q.st === 'in');
    const idx = team.findIndex((q) => q.id === p.id), n = Math.max(1, team.length);
    const gx = CX + ((idx + 0.5) / n - 0.5) * 2 * Math.min(300, 110 + n * 45);
    const depth = 130 + (idx % 2) * 95;
    return { x: gx + jx * 90, y: CY + s * (depth + 40 + jy * 70) };
  }
  const dod = w.ps.filter((q) => q.team === p.team && q.st === 'in');
  const idx = dod.findIndex((q) => q.id === p.id), n = Math.max(1, dod.length);
  const a = (idx / n) * Math.PI * 2 + ph * 0.2;
  return { x: CX + Math.cos(a) * 110 + jx * 210, y: CY + Math.sin(a) * 110 + jy * 210 };
}

function rimSlot(w, p) {
  const mates = w.ps.filter((q) => q.team === p.team && q.st === 'rim');
  const targets = enemiesIn(w, p.team);
  const idx = mates.findIndex((q) => q.id === p.id), n = Math.max(1, mates.length);
  if (w.kind === 'court') {
    const [lo, hi] = cemeteryRange(p.team);
    const th = lo + ((idx + 0.5) / n) * (hi - lo);
    return rimPos(th + Math.sin(w.t * 0.6 + idx) * 0.12);
  }
  const base = -Math.PI / 2 + (idx / n) * Math.PI * 2;
  let th = base;
  if (targets.length) {
    const cx = targets.reduce((s, q) => s + q.x, 0) / targets.length, cy = targets.reduce((s, q) => s + q.y, 0) / targets.length;
    th = base + angDiff(polar(cx, cy), base) * 0.0;
  }
  return rimPos(th + w.t * 0.12 * (idx % 2 ? 1 : -1));
}

// The plan for player p right now. Deterministic given the world (no rng): the same function drives the AI and explains the coach.
export function planFor(w, p, o = {}) {
  const why = [];
  const skill = o.skill ?? p.sk;
  const minAge = o.coach ? 0 : p.react;
  const mates = w.ps.filter((q) => q.team === p.team);
  const foes = enemiesIn(w, p.team);

  // 1. a ball is coming for me
  if (p.st === 'in') {
    const th = threatsTo(w, p, minAge).filter((t) => t.eta < 1.3);
    if (th.length) {
      const t = th[0], b = t.b;
      const sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp;
      const canCatch = p.catchCd <= 0 && p.ball === null && p.stun <= 0;
      const want = hash(b.sn * 31 + 7, p.id) < (o.coach ? 1 : 0.03 + 0.5 * skill * skill + (b.kind === 'lob' ? 0.06 : 0));
      if (canCatch && t.eta < (b.kind === 'lob' ? 0.5 : 0.36) && t.eta > 0.03 && want && t.miss < 40) {
        why.push(`${b.kind === 'lob' ? 'A lob is dropping' : 'A fast ball is coming'} straight at ${p.id === w.me ? 'you' : p.name}.`);
        why.push('Press Catch just before it arrives: a catch burns the thrower and brings a teammate back.');
        return { kind: 'catch', bid: b.id, eta: t.eta, why };
      }
      // dodge sideways, away from where it will hit
      const nx = -uy, ny = ux;
      const side = (p.x - t.x) * nx + (p.y - t.y) * ny;
      let s = side === 0 ? (hash(p.id, w.tick >> 4) < 0.5 ? 1 : -1) : Math.sign(side);
      // do not run into the wall: prefer the direction with more room
      const room = (sg) => R - 40 - Math.hypot(p.x + nx * sg * 90 - CX, p.y + ny * sg * 90 - CY);
      if (room(s) < 0 && room(-s) > room(s)) s = -s;
      // a lob is dodged by simply leaving the landing spot in any direction away from the ball's line
      why.push(`A ball is heading for ${p.id === w.me ? 'you' : p.name}: sidestep out of its line.`);
      if (p.catchCd > 0 && canCatch === false && p.ball === null) why.push('The catch is still recovering, so move instead.');
      const need = clamp((HIT_R + 26 - t.miss), 20, 90);
      return { kind: 'dodge', dx: nx * s, dy: ny * s, need, bid: b.id, eta: t.eta, tx: p.x + nx * s * (need + 60), ty: p.y + ny * s * (need + 60), why };
    }
  }

  // 2. I hold a ball
  if (p.ball !== null && p.stun <= 0) {
    const bid = p.ball;
    if (!(w.kind === 'ring' && p.st === 'in')) {
      const pick = chooseTarget(w, p, foes);
      // ring format: pass round the ring when a teammate has a much better shot
      if (w.kind === 'ring' || (w.kind === 'court' && p.st === 'in')) {
        const best = bestPass(w, p, foes, pick);
        if (best && hash(w.tick >> 3, p.id + 4) < 0.5 + 0.3 * skill) {
          why.push(`${best.q.name} has a much cleaner shot: pass.`);
          return { kind: 'pass', tid: best.q.id, bid, why };
        }
      }
      if (pick) {
        const tg = pick.q, d = dist(p, tg);
        const kindT = pick.kind;
        why.push(`${tg.name} ${pick.reason}.`);
        why.push(kindT === 'lob' ? 'A lob arcs over the others and drops on the spot: hard to catch, easy to step away from.' : 'A fast throw: little time to react, so it needs a quick catch to stop.');
        void d;
        return { kind: 'throw', tid: tg.id, tx: tg.x, ty: tg.y, kindT, bid, why, wait: pick.wait };
      }
    }
    why.push('Nobody to aim at yet: keep the ball and stay clear.');
    return { kind: 'hold', bid, why };
  }

  // 3. a loose ball I should fetch (the nearest of my side goes; the human is never replaced mid-run)
  const loose = w.balls.filter((b) => b.holder === null && !b.live && b.ret === null);
  if (loose.length && p.stun <= 0) {
    let bestB = null, bd = 1e9;
    for (const b of loose) {
      if (w.kind === 'court' && p.st === 'in' && (b.y - CY) * ownHalfSign(p.team) < -14) continue;
      if (w.kind === 'ring' && p.st === 'in') continue;
      if (p.st === 'rim' && Math.hypot(b.x - CX, b.y - CY) > R + 30 + 220) continue;
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d < bd) { bd = d; bestB = b; }
    }
    if (bestB) {
      // the closest teammate without a ball goes; the others hold shape
      const cands = mates.filter((q) => q.ball === null && q.stun <= 0 && (w.kind === 'ring' ? q.st === 'rim' : true)
        && !(w.kind === 'court' && q.st === 'in' && (bestB.y - CY) * ownHalfSign(q.team) < -14));
      cands.sort((a, c) => Math.hypot(a.x - bestB.x, a.y - bestB.y) - Math.hypot(c.x - bestB.x, c.y - bestB.y));
      if (cands[0] && cands[0].id === p.id) {
        why.push('The ball is loose on your side: run over it to pick it up.');
        // for rim players the ball may be inside the circle: they wait at the nearest rim point
        let tx = bestB.x, ty = bestB.y;
        if (p.st === 'rim') { const th = polar(bestB.x, bestB.y); const q = rimPos(th); tx = q.x; ty = q.y; }
        return { kind: 'fetch', bid: bestB.id, tx, ty, why };
      }
    }
  }

  // 4. hold shape
  if (p.st === 'rim') {
    const s = rimSlot(w, p);
    why.push(w.kind === 'court' ? 'You are in the cemetery: stay behind them and throw into their backs.' : 'Stay on the ring and wait for the ball.');
    return { kind: 'rim', tx: s.x, ty: s.y, why };
  }
  const s = slotFor(w, p);
  // someone is winding up at me: break the line early
  const aimers = foes.filter((q) => q.windT > 0 && q.aim && q.aim.tid === p.id);
  if (aimers.length) {
    const q = aimers[0], ax = p.x - q.x, ay = p.y - q.y, L = Math.hypot(ax, ay) || 1, nx = -ay / L, ny = ax / L;
    let sg = hash(p.id, q.id + 3) < 0.5 ? 1 : -1;
    // the throw leads a moving target: reversing just before the release makes it miss
    const flip = q.windT < 0.1 && hash(p.id + 11, q.id + (w.tick >> 5)) < 0.05 + 0.75 * skill * skill;
    if (flip) sg = -sg;
    why.push(`${q.name} is winding up at ${p.id === w.me ? 'you' : p.name}: step off the line now${flip ? ', and reverse as the ball leaves' : ''}.`);
    return { kind: 'juke', tx: p.x + nx * sg * 110, ty: p.y + ny * sg * 110, why };
  }
  why.push('Keep moving: a moving target is hard to hit. Stay clear of the ball holders.');
  return { kind: 'weave', tx: s.x, ty: s.y, why };
}

function chooseTarget(w, p, foes) {
  let best = null, bs = -1e9;
  for (const q of foes) {
    const d = dist(p, q);
    if (d < 30) continue;
    let s = -d * 0.35;
    const spd = Math.hypot(q.vx, q.vy);
    s += clamp(160 - spd, 0, 160) * 0.5;                              // standing still is easy to hit
    if (q.catchT > 0) s -= 160;                                       // ready to catch
    else if (q.catchCd > 0.35) s += 90;                               // cannot catch right now
    if (q.ball !== null || q.windT > 0) s += 60;                      // busy holding or winding up
    if (q.hitT > 0) s -= 400;
    // facing away from me
    const fa = angDiff(Math.atan2(p.y - q.y, p.x - q.x), q.a);
    s += Math.abs(fa) > 1.8 ? 40 : 0;
    if (s > bs) { bs = s; best = q; }
  }
  if (!best) return null;
  const d = dist(p, best);
  let kind = 'fast', reason = 'is the best target right now';
  if (best.catchCd > 0.35 && best.catchT <= 0) reason = 'just spent the catch and cannot catch for a moment';
  else if (Math.hypot(best.vx, best.vy) < 40) reason = 'is standing still';
  else if (best.ball !== null || best.windT > 0) reason = 'is busy with the ball';
  else reason = 'is the closest and least ready';
  if (best.catchT > 0) { kind = 'lob'; reason = 'is ready to catch: lob it over the stance'; }
  else if (d > 560 && hash(p.id, w.tick >> 5) < 0.4 + 0.2 * p.sk) { kind = 'lob'; }
  // wait a human beat before the wind-up (AI): never in the same tick it got the ball
  const wait = VENUES[w.venueIdx].hold + hash(p.id, w.tick >> 6) * (w.kind === 'ring' ? 0.6 : 0.6) * (1 - p.sk * 0.5);
  return { q: best, kind, reason, wait };
}

function bestPass(w, p, foes, pick) {
  if (!foes.length) return null;
  const mates = w.ps.filter((q) => q.team === p.team && q.id !== p.id && q.ball === null && q.stun <= 0 && (w.kind === 'court' ? q.st === 'rim' || false : q.st === 'rim'));
  if (!mates.length) return null;
  const myBest = foes.reduce((m, q) => Math.min(m, dist(p, q)), 1e9);
  let best = null, bs = 1e9;
  for (const q of mates) {
    const d = foes.reduce((m, f) => Math.min(m, dist(q, f)), 1e9);
    if (d < bs) { bs = d; best = q; }
  }
  if (!best) return null;
  const gain = myBest - bs;
  // a pass only when it makes the shot much better, and the pick is not already close
  if (gain > 140 && myBest > 300 && (!pick || pick.kind !== 'fast' || myBest > 420)) return { q: best, gain };
  return null;
}

// Turn a plan into controls for one tick.
export function controlFromPlan(w, p, plan) {
  const c = { mx: 0, my: 0 };
  if (!plan) return c;
  const toward = (tx, ty, stop = 10) => {
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d > stop) { c.mx = dx / d; c.my = dy / d; }
  };
  switch (plan.kind) {
    case 'catch': c.catch = true; break;
    case 'dodge': c.mx = plan.dx; c.my = plan.dy; break;
    case 'throw': c.throw = { tid: plan.tid, kind: plan.kindT, lead: 0.8 + 0.2 * p.sk, err: (0.012 + 0.09 * (1 - p.sk) * (1 - p.sk)) * VENUES[w.venueIdx].err }; break;
    case 'pass': c.pass = plan.tid; break;
    case 'fetch': case 'weave': case 'juke': case 'rim': toward(plan.tx, plan.ty, 14); break;
    default: break;
  }
  return c;
}

function aiControl(w, p, dt, rng) {
  p.aiT -= dt;
  // the plan is refreshed a few times a second; urgent things (a ball in the air) are re-read every tick
  const urgent = p.st === 'in' && w.balls.some((b) => b.live && b.team !== p.team && b.holder === null);
  if (p.aiT <= 0 || urgent || !p.plan) {
    p.plan = planFor(w, p);
    if (!urgent) p.aiT = 0.14 + hash(p.id, w.tick) * 0.12;
  }
  const plan = p.plan;
  const c = controlFromPlan(w, p, plan);
  if (plan.kind === 'throw') {
    // hold the ball for a beat first so the AI is not a machine gun
    if (p.heldT < (plan.wait ?? 0.4)) { c.throw = undefined; }
    else c.throw.err = (0.012 + 0.09 * (1 - p.sk) * (1 - p.sk)) * VENUES[w.venueIdx].err;
  }
  void rng;
  return c;
}

export function autoControl(w, plan) {
  const p = w.ps[w.me];
  const c = controlFromPlan(w, p, plan);
  if (plan.kind === 'throw') { c.throw = { tid: plan.tid, kind: plan.kindT, lead: 0.8, err: 0.03 }; }
  return c;
}

// ---- result ------------------------------------------------------------------------------------------------------------------------------
export function resultOf(w) {
  const v = VENUES[w.venueIdx], s = w.stats;
  const mineAlive = w.ps.filter((p) => p.orig === 0 && p.st === 'in').length, theirAlive = w.ps.filter((p) => p.orig === 1 && p.st === 'in').length;
  const won = w.done === 'won', draw = w.done === 'draw';
  let stars = 0;
  if (won) {
    stars = 1;
    if (w.kind === 'court') { if (mineAlive * 2 >= v.per) stars += 1; if (s.catches >= 1) stars += 1; }
    else if (w.role === 'dodger') { if (mineAlive * 2 >= v.dodgers) stars += 1; if (s.catches >= 1) stars += 1; }
    else { if (w.timeLeft > w.timeTotal * 0.3) stars += 1; if (s.burns >= 2) stars += 1; }
  }
  const score = Math.round(s.burns * 100 + s.catches * 150 + s.revived * 50 + (won ? 300 + w.timeLeft * 3 : 0) - s.hitsTaken * 20);
  return {
    won, draw, how: w.done, stars, score: Math.max(0, score), mineAlive, theirAlive, burns: s.burns, catches: s.catches, hitsTaken: s.hitsTaken, revived: s.revived,
    throws: s.throws, passes: s.passes, seconds: Math.round(w.t), timeLeft: Math.round(w.timeLeft), teamBurns: [...w.teamBurns], role: w.role, kind: w.kind,
  };
}

export const roleText = (w) => (w.kind === 'court' ? 'court' : w.role);

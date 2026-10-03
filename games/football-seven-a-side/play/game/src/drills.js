// Learn drills: scripted scenarios played through the real simulation. A drill places the players, runs one attempt, reports it with a
// 'drillAttempt' event and starts the next one; after the last it reports 'drillDone'. Players not needed by the drill stand still (idle).
import { HL, HW, GOAL_HW, BOX_HW, BR } from './consts.js';

const STEP = 1 / 60;
export function setupDrill(X, drill) {
  const s = X.s, P = X.P, B = s.ball;
  s.phase = 'play'; s.sp = null; s.clock = 3600;
  const D = s.drill = { kind: drill.kind, n: drill.n, attempt: 0, ok: 0, stage: 'ready', st: 0, res: null, marks: [], target: -1, hint: '', seen: 0, extra: {} };
  for (const p of P) { p.idle = true; p.script = false; p.act = null; p.vx = p.vz = 0; }
  const human = P[s.human];
  const put = (p, x, z, face) => { p.x = x; p.z = z; p.vx = p.vz = 0; p.face = face ?? p.face; p.act = null; p.stun = 0; p.tx = x; p.tz = z; p.cmd = { dx: 0, dz: 0, v: 0 }; };
  const park = () => { for (const p of P) if (p.idle && p !== human) { const i = p.id; put(p, ((i % 2) ? 1 : -1) * (HW - 1.5), ((p.team === 0) ? -1 : 1) * (HL - 3 - (i % 7) * 0.2), p.face); } };
  const ballTo = (x, z, owner = -1) => { X.putBall(x, z); B.owner = owner; B.last = owner; B.lastTeam = owner >= 0 ? P[owner].team : -1; };
  const kind = drill.kind;
  const emit = (ok, msg) => { D.ok += ok ? 1 : 0; X.ev('drillAttempt', { ok, msg, n: D.attempt }); };
  const finishAttempt = (ok, msg) => { emit(ok, msg); D.stage = 'result'; D.st = 0; };
  const gk1 = P[7], gk0 = P[0];
  const SPAWN = { shoot: [[3, 9], [-4, 10], [0, 8], [-6, 11], [6, 10]], tackle: [[3, 7], [-4, 8], [2, 9], [-3, 7]], head: [-1, 1, 0.5, -0.5] };

  // ---- per-kind attempt set-up ------------------------------------------------------------------------------------------------------------
  function arm() {
    D.res = null; D.st = 0; D.stage = 'ready'; D.t0 = s.t; D.marks = []; D.target = -1; D.seen = s.evN;
    for (const p of P) { p.act = null; p.stun = 0; p.vx = p.vz = 0; }
    park();
    if (kind === 'move') {
      put(human, 0, -6, 0); ballTo(0, 30); 
      D.marks = [[-7, -2], [7, 1], [-5, 7], [6, 11]].map(([x, z], i) => ({ x, z, label: `${i + 1}`, hit: false }));
      D.stage = 'live'; D.hint = 'Touch the markers';
    } else if (kind === 'pass') {
      put(human, 0, -7, 0); ballTo(human.x + 0.4, human.z + 0.3, human.id);
      const spots = [[0, 6], [8, -1], [-8, 0], [4, 8], [-5, 7]]; const ids = [6, 4, 5, 3, 1];
      ids.forEach((id, i) => put(P[id], spots[i][0], spots[i][1], Math.PI));
      D.target = ids[D.attempt % ids.length]; D.hint = 'Pass to the ringed teammate';
    } else if (kind === 'shoot') {
      const [x, z] = SPAWN.shoot[D.attempt % 5];
      put(human, x, z, 0); ballTo(x + 0.3, z + 0.4, human.id);
      put(gk1, 0, HL - 1.3, Math.PI); gk1.idle = false; gk1.ai.at = 0;
      D.hint = 'Aim and shoot';
    } else if (kind === 'tackle') {
      const [x, z] = SPAWN.tackle[D.attempt % 4];
      put(human, 0, -1, Math.PI / 2 * 0); human.face = 0;
      const att = P[13]; put(att, x, z + 5, Math.PI); att.idle = true; att.script = true;
      ballTo(att.x, att.z - 0.45, att.id);
      D.hint = 'Win the ball without a foul'; D.extra = { att: att.id };
    } else if (kind === 'head') {
      put(human, 0, HL - 6.5, 0); ballTo(0, 30);
      const w = P[4]; put(w, HW - 3, HL - 12, Math.PI * 0.8); w.script = true;
      ballTo(w.x - 0.4, w.z + 0.2, w.id);
      put(gk1, 0, HL - 1.3, Math.PI); gk1.idle = false; gk1.ai.at = 0;
      D.hint = 'Head the cross at the goal'; D.extra = { crossed: false, headed: false };
    } else if (kind === 'keeper') {
      put(human, 0, -HL + 1.2, 0); ballTo(0, 30);
      const sh = P[13]; sh.st.shot = 1; const xs = [-5, 5, 0, -3, 6, 2], zs = [-9, -8, -10, -7, -9, -8]; const k = D.attempt % 6;
      put(sh, xs[k], zs[k], 0); sh.face = 0; sh.script = true; ballTo(sh.x, sh.z + 0.45, sh.id); B.owner = -1;
      D.hint = 'Dive to save'; D.extra = { shot: false };
    }
  }
  X.drillArm = arm;

  X.drillStep = () => {
    if (D.stage === 'done') return;
    D.st += STEP;
    // events since the attempt began
    const evs = s.events.filter((e) => e.id >= D.seen);
    if (D.stage === 'ready') {
      if (D.st > (D.attempt === 0 ? 2.2 : 1.0)) { D.stage = 'live'; D.st = 0; D.seen = s.evN; D.attempt++; if (kind === 'head') { const w = P[4]; X.kick(w, 'cross', { tx: 0.3 + (SPAWN.head[(D.attempt - 1) % 4]) * 1.5, tz: HL - 6.0, power: 0.55, force: true }); D.extra.crossed = true; } if (kind === 'keeper') { const sh = P[13]; D.extra.shotT = s.t + 0.9; } if (kind === 'tackle') { D.extra.t0 = s.t; } }
      return;
    }
    if (D.stage === 'result') {
      if (D.st > 1.4) {
        if (D.attempt >= D.n || (kind === 'move' && D.marks.every((m) => m.hit))) { D.stage = 'done'; X.ev('drillDone', { ok: D.ok, n: D.n }); return; }
        arm();
      }
      return;
    }
    // ---- live ----
    if (kind === 'move') {
      for (const m of D.marks) if (!m.hit && Math.hypot(human.x - m.x, human.z - m.z) < 1.3) { m.hit = true; D.attempt++; emit(true, ''); }
      if (D.marks.every((m) => m.hit)) { D.stage = 'result'; D.st = 0; }
      else if (D.st > 30) { for (const m of D.marks) if (!m.hit) { m.hit = true; D.attempt++; emit(false, 'Out of time'); } D.stage = 'result'; D.st = 0; }
      return;
    }
    if (kind === 'pass') {
      for (const e of evs) {
        if (e.type === 'control') { const ok = e.pid === D.target; finishAttempt(ok, ok ? '' : e.pid === s.human ? 'Pass to the ringed player' : 'Wrong player'); return; }
      }
      if (D.res === 'out' || D.st > 5) finishAttempt(false, D.st > 5 ? 'Too slow' : 'Out of play');
      return;
    }
    if (kind === 'shoot') {
      if (D.res === 'goal') { finishAttempt(true, ''); return; }
      for (const e of evs) { if (e.type === 'save') { finishAttempt(false, 'Saved'); return; } }
      if (D.res === 'out') { finishAttempt(false, 'Missed the target'); return; }
      if (D.st > 7) finishAttempt(false, 'Take your shot');
      return;
    }
    if (kind === 'tackle') {
      const att = P[13];
      // the attacker dribbles at the goal
      const dx = 0 - att.x, dz = -HL - att.z, l = Math.hypot(dx, dz) || 1;
      if (B.owner === att.id) att.cmd = { dx: dx / l, dz: dz / l, v: 3.2 }; else att.cmd = { dx: 0, dz: 0, v: 0 };
      for (const e of evs) {
        if (e.type === 'foul') { finishAttempt(false, 'Foul'); s.phase = 'play'; return; }
        if (e.type === 'tackle' && e.pid === s.human && e.ok) { att.cmd = { dx: 0, dz: 0, v: 0 }; finishAttempt(true, ''); return; }
      }
      if (B.owner === s.human) { finishAttempt(true, ''); return; }
      if (att.z < -HL + 7 || D.st > 14 || (B.owner !== att.id && B.owner !== s.human && D.st > 2 && Math.hypot(B.vx, B.vz) < 0.3 && Math.hypot(att.x - B.x, att.z - B.z) > 2.5)) finishAttempt(false, att.z < -HL + 7 ? 'He got past you' : 'Not this time');
      return;
    }
    if (kind === 'head') {
      for (const e of evs) {
        if (e.type === 'head' && e.pid === s.human) { D.extra.headed = true; D.extra.shot = e.shot; D.extra.t = s.t; }
      }
      if (D.res === 'goal') { finishAttempt(true, ''); return; }
      for (const e of evs) if (e.type === 'save' && D.extra.headed) { finishAttempt(true, 'On target'); return; }
      if (D.res === 'out' || D.st > 6 || (D.extra.headed && s.t - D.extra.t > 2)) finishAttempt(D.extra.headed && D.extra.shot && D.res !== 'out' ? true : false, D.extra.headed ? 'Not on target' : 'You did not reach it');
      return;
    }
    if (kind === 'keeper') {
      const sh = P[13];
      if (!D.extra.shot && s.t >= D.extra.shotT) {
        D.extra.shot = true; const k = (D.attempt - 1) % 6;
        const ty = [0.5, 1.4, 0.3, 1.2, 0.9, 1.6][k], tx = [-1.9, 1.7, 0.4, -1.0, 2.0, -1.5][k] ;
        B.owner = sh.id; X.kick(sh, 'shot', { tx, tz: -HL, ty, power: [0.55, 0.65, 0.5, 0.7, 0.6, 0.75][k], force: true });
      }
      for (const e of evs) { if (e.type === 'save' && e.pid === s.human) { finishAttempt(true, ''); return; } }
      if (D.res === 'goal') { finishAttempt(false, 'Goal'); return; }
      if (D.res === 'out' || D.st > 6) finishAttempt(false, 'Wide of the goal ' ); 
      return;
    }
  };
  arm();
}

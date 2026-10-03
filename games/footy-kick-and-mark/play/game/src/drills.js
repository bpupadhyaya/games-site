// Learn drills: short scripted scenes on the real pitch, played through the real simulation. Each drill sets up a situation, watches the
// events, scores the rep, and starts the next one. Everything here is deterministic (the sim's own streams, no clock).
import { ZG, HW, HL, JOG } from './consts.js';
import { clamp, hyp } from './util.js';
import { LESSONS } from './content.js';

export const DRILL_ROLE = { basics: 'mid', marking: 'fwd', kicking: 'fwd', tackling: 'def', fwd: 'fwd', mid: 'mid', def: 'def', ruck: 'ruck' };

export function createDrill(S) {
  const s = S.s, P = s.players, B = s.ball;
  const id = s.cfg.drill, L = LESSONS.find((l) => l.drill === id);
  const d = s.drill = { id, rep: 0, n: 0, ok: 0, total: L.n, need: L.need, prompt: '', ring: null, state: 'setup', t0: 0, msg: '', flash: 0, done: false, evSeen: 0, tkick: -1, tgt: null };
  const H = () => S.humanPlayer();
  let kept = [];
  const put = (p, x, z, face = null) => { kept.push(p.id); p.x = x; p.z = z; p.vx = p.vz = 0; p.act = null; p.st = 'free'; p.jt = -1; p.jh = 0; p.in = { mx: 0, mz: 0, sprint: false }; if (face !== null) p.face = face; };
  const give = (p) => { B.owner = p.id; B.kind = 'held'; B.vx = B.vy = B.vz = 0; p.hold = 0; B.touched = false; B.bounced = false; };
  const lose = () => { for (const p of P) { p.ex.frozen = true; p.ex.script = false; } };
  const free = (p) => { p.ex.frozen = false; };
  const perfect = (p) => { p.ex.perfect = true; };
  const at = (team, slot) => P[team * 6 + slot];
  const stash = (keep = []) => { let k = 0; for (const p of P) { if (p.ex.frozen && !keep.includes(p.id)) { const side = p.team === 0 ? -1 : 1; put(p, side * (HW - 3), (k % 6 - 2.5) * 7); k++; } } };
  function begin() {
    kept = [];
    d.state = 'run'; d.t0 = s.t; d.evSeen = s.evId; d.tkick = -1; d.ring = null; d.msg = '';
    s.phase = 'play'; s.phaseT = 0; s.set = null; s.contest = null; s.hold = null; s.ballup = null; B.owner = -1; B.kind = 'none'; B.claim = -1;
    const h = H(), r = d.rep;
    lose();
    for (const p of P) { p.cool = { pick: 0, catch: 0, tackle: 0, jump: 0 }; p.stam = 1; }
    const sgn = r % 2 ? -1 : 1;
    if (id === 'basics') {
      d.prompt = 'Push the stick towards your teammate and press HANDBALL.';
      const m = at(0, 2); put(h, 0, -8, 0); put(m, sgn * 5, 0, Math.PI); give(h);
      const sel = at(0, 2); free(h); sel.ex.frozen = true; d.tgt = sel.id;
    } else if (id === 'marking') {
      d.prompt = 'Run to the gold ring and wait there. Press MARK as the ball arrives.';
      const k = at(0, 2); perfect(k); put(k, sgn * -4, -18, 0); put(h, sgn * -7, -2, Math.PI); give(k); put(at(1, 5), sgn * 5.5, 8 + (r % 3) * 2, 0);
      d.ring = { x: sgn * 2.5, z: 7 + (r % 3) * 2 }; d.tkick = s.t + 3.0; d.tgt = h.id; free(h);
    } else if (id === 'kicking') {
      d.prompt = 'Aim at the goal and press KICK when the bar is in the middle.';
      put(h, 0, 0); const x = [-5, 4, -2, 6][r % 4], z = ZG - 17 - (r % 2) * 3; s.phase = 'play'; S.startSetShot('free', h, x, z, { why: 'drill' }); s.set.limit = 40; free(h);
    } else if (id === 'tackling') {
      d.prompt = 'Chase the runner and press TACKLE when you are close.';
      const c = at(1, 1); put(c, sgn * -12, 12, 0); give(c); c.ex.script = true; c.ex.frozen = true; put(h, sgn * 2, 0, 0); d.tgt = c.id; c.ex.dir = { x: sgn * 1, z: -0.8 }; free(h);
    } else if (id === 'fwd') {
      d.prompt = 'Run to the gold ring: your midfielder will kick to you. Mark it.';
      const k = at(0, 1); perfect(k); put(k, 0, -4, 0); give(k); put(h, -4, 8, 0); put(at(1, 5), 5, 13, Math.PI); const rx = [6, -6, 3, -3][r % 4] * 1, rz = 15 + (r % 2) * 4; d.ring = { x: rx, z: rz }; d.tkick = s.t + 3.2; d.tgt = h.id; free(h); d.kicker = k.id;
    } else if (id === 'mid') {
      d.prompt = 'Your ruck taps to you. Run over the ball to pick it up, then handball to a teammate.';
      s.phase = 'ballup'; s.ballup = { x: 0, z: 0, why: 'center', c: [0, 6], ready: false };
      const form = [[0, -1.3], [-3, -4], [6, -6], [-6, 8], [6, 8], [0, -15]];
      for (const p of P) { const f = form[p.slot], sg = p.team === 0 ? 1 : -1; put(p, f[0] * sg, f[1] * sg); p.goto = null; p.ex.frozen = !(p === h || p.slot === 0); }
      put(h, -3, -4); put(at(0, 2), 7, -7, Math.PI); at(0, 0).ex.tapTo = h.id; at(0, 0).ex.perfect = true;
      B.x = 0; B.y = 1.1; B.z = 0; B.vx = B.vy = B.vz = 0; B.kind = 'none'; d.bounceAt = s.t + 1.0; d.handballed = false;
    } else if (id === 'def') {
      d.prompt = 'Their forward leads. Get to the ring and MARK or SPOIL.';
      const k = at(1, 1); perfect(k); put(k, 0, 6, Math.PI); give(k); put(h, sgn * 2, -16, Math.PI); const f = at(1, 3); put(f, sgn * -3, -18, 0); d.ring = { x: sgn * -1, z: -15 }; d.tkick = s.t + 1.6; d.tgt = f.id; d.kicker = k.id; free(h); f.ex.frozen = true;
    } else if (id === 'ruck') {
      d.prompt = 'Stand under the ball and press TAP as it comes down. Steer with the stick.';
      for (const p of P) p.ex.frozen = false;
      s.phase = 'ballup'; s.ballup = { x: 0, z: 0, why: 'center', c: [0, 6], ready: false };
      const form = [[0, -1.3], [-5, -6], [5, -6], [-6, 8], [6, 8], [0, -15]];
      for (const p of P) { const f = form[p.slot], sg = p.team === 0 ? 1 : -1; put(p, f[0] * sg, f[1] * sg); }
      put(h, -0.2, -1.3); put(at(1, 0), 0.2, 1.3, Math.PI); B.x = 0; B.y = 1.1; B.z = 0; B.vx = B.vy = B.vz = 0; B.kind = 'none'; d.bounceAt = s.t + 1.0;
    }
    if (id !== 'mid' && id !== 'ruck') stash(kept);
  }
  function result(ok, msg) {
    if (d.state !== 'run') return;
    d.n++; if (ok) d.ok++; d.state = 'wait'; d.t0 = s.t; d.msg = msg; d.flash = s.t; d.ring = null;
    S.s.last = { text: ok ? `Good: ${msg}` : msg, team: ok ? 0 : 1, t: s.t };
    d.rep++;
    s.phase = 'drillwait'; s.set = null;
  }
  const API = {
    begin,
    tick() {
      if (d.done) return;
      if (d.state === 'wait') { if (s.t - d.t0 > 1.6) { if (d.n >= d.total) { d.done = true; d.state = 'done'; } else begin(); } return; }
      if (d.state !== 'run') return;
      const h = H(), el = s.t - d.t0;
      if ((id === 'mid' || id === 'ruck') && d.bounceAt && s.t >= d.bounceAt && s.phase === 'ballup') { d.bounceAt = 0; S.forceBounce(); }
      if ((d.tkick > 0) && s.t >= d.tkick && B.owner >= 0) {
        const k = P[B.owner]; d.tkick = -1;
        const tg = P[d.tgt]; const px = d.ring ? d.ring.x : tg.x, pz = d.ring ? d.ring.z : tg.z;
        S.startKick(k, { type: 'mate', id: tg.id, x: px, z: pz, D: hyp(px - k.x, pz - k.z) });
        d.kicked = true;
      }
      if (id === 'tackling') { const c = P[d.tgt]; if (B.owner === c.id && c.st === 'free') { c.in.mx = c.ex.dir.x; c.in.mz = c.ex.dir.z; c.in.sprint = false; if (Math.abs(c.x) > HW - 4 || Math.abs(c.z) > HL - 4) result(false, 'He got away'); } }
      for (const e of s.events) {
        if (e.id < d.evSeen) continue; d.evSeen = e.id + 1;
        if (id === 'basics') {
          if (e.type === 'handball' && e.pid === h.id) d.hb = true;
          if (d.hb && e.type === 'catch' && e.pid === d.tgt) result(true, 'Nice handball');
          else if (d.hb && (e.type === 'fumble' || e.type === 'out')) result(false, 'The handball missed');
        } else if (id === 'marking' || id === 'fwd') {
          if (e.type === 'mark' && e.pid === h.id) result(true, 'Mark!');
          else if (e.type === 'mark') result(false, 'Someone else marked it');
          else if (e.type === 'fumble' || e.type === 'spoil' || e.type === 'out' || (e.type === 'catch' && e.pid !== h.id)) result(false, 'Missed the ball');
        } else if (id === 'kicking') {
          if (e.type === 'goal') result(true, 'GOAL!');
          else if (e.type === 'behind') result(false, 'A behind: one point');
          else if (e.type === 'out' || e.type === 'mark') result(false, 'Missed the target');
        } else if (id === 'tackling') {
          if (e.type === 'tackle' && e.pid === h.id) result(true, 'Held ball: free kick');
        } else if (id === 'def') {
          if (e.type === 'spoil' && e.pid === h.id) result(true, 'Spoiled');
          else if (e.type === 'mark' && e.pid === h.id) result(true, 'Intercept mark');
          else if (e.type === 'mark' || e.type === 'goal') result(false, 'They marked it');
          else if (e.type === 'out' || e.type === 'fumble' || e.type === 'spoil') result(false, 'Not by you');
        } else if (id === 'mid') {
          if (e.type === 'tap') at(1, 0).ex.frozen = true;
          if (e.type === 'handball' && e.pid === h.id) d.handballed = true;
          if (d.handballed && e.type === 'catch' && e.team === 0 && e.pid !== h.id) result(true, 'Ball won and shared');
          else if (d.handballed && (e.type === 'fumble' || e.type === 'out')) result(false, 'The handball missed');
          else if (e.type === 'hold' && e.team === 1 && el > 2) result(false, 'They won the ball');
        } else if (id === 'ruck') {
          if (e.type === 'tap' && e.pid === h.id) result(true, 'Tapped');
          else if (e.type === 'tap') result(false, 'Their ruck got it');
        }
      }
      if (d.state === 'run') {
        if (el > (id === 'mid' ? 24 : id === 'kicking' ? 60 : id === 'ruck' ? 8 : 12)) result(false, 'Out of time');
        else if (d.kicked && B.owner < 0 && B.y < 0.3 && el > 3 && B.vx * B.vx + B.vz * B.vz < 4 && id !== 'tackling') { d.kicked = false; result(false, 'The ball hit the ground'); }
      }
    },
  };
  S.drillApi = API;
  d.prompt = L.intro[0];
  return API;
}

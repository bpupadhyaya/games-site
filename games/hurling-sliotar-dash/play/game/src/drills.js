// Learn drills: scripted practice scenes on the real pitch. Each attempt is set up, played live, judged from the sim's own events,
// and followed by a short pause. Returns { ok } once per attempt; game.js counts them.
import { HW, HL, GOAL_HW } from './consts.js';

export function createDrill(S, kind, R) {
  const s = S.s, B = S.B, P = S.P;
  const me = P[s.cfg.human];
  const st = { phase: 'wait', t: 0, n: 0, seen: 0, flag: 0 };
  const homeAll = () => { for (const p of P) { p.frozen = true; p.script = null; p.act = null; p.stun = 0; p.vx = p.vz = 0; p.stam = 1; } };
  const place = (p, x, z, face) => { p.frozen = false; p.free = true; p.x = x; p.z = z; p.vx = p.vz = 0; if (face != null) p.face = face; p.act = null; p.ai.tx = x; p.ai.tz = z; };
  const park = () => {
    // everyone not in the scene stands in a tidy row at the sides
    let i = 0;
    for (const p of P) { if (p.free) continue; const side = p.team === 0 ? -1 : 1; p.x = side * (HW - 1.2); p.z = -HL + 3 + (i++ % 6) * 6; p.vx = p.vz = 0; p.face = p.team === 0 ? 0 : Math.PI; }
  };
  const setupAttempt = () => {
    homeAll(); park();
    B.holder = -1; B.mode = 'free'; B.path = null; B.vx = B.vy = B.vz = 0; B.dead = false; s.last = null; s.restart = null;
    s.phase = 'play'; s.phaseT = 0; s.deadNext = null; s.charge = null;
    const a = R.range(-1, 1);
    for (const p of P) p.free = false;
    me.free = true;
    if (kind === 'rise') {
      place(me, 0, -3.5, 0);
      const sx = (R.chance(0.5) ? 1 : -1) * R.range(2, 4);
      B.x = sx; B.z = 4; B.y = 0.07;
      const dx = -sx * 0.6 + R.range(-1, 1), dz = -8, l = Math.hypot(dx, dz);
      B.vx = dx / l * 4.5; B.vz = dz / l * 4.5;
    } else if (kind === 'point') {
      place(me, a * 2, 4 + R.range(0, 2), 0); S.giveBall(me, 'hand');
    } else if (kind === 'goal') {
      place(me, a * 1.8, 7.5 + R.range(0, 1.5), 0); S.giveBall(me, 'hand');
      const gk = P[6]; gk.free = true; gk.frozen = false; place(gk, 0, HL - 0.8, Math.PI);
    } else if (kind === 'pass') {
      place(me, -1.5, -2, 0); S.giveBall(me, 'hand');
      const t = P[4]; t.free = true; place(t, -4.5, 2, Math.PI / 2); t.script = { vx: 2.5, vz: 0 };
      B.intended = -1;
    } else if (kind === 'solo') {
      place(me, 0, -9.5, 0); S.giveBall(me, 'bal');
      const c = P[9]; c.free = true; c.frozen = false; place(c, 0, -4.5, Math.PI);
      st.hooked = false;
    } else if (kind === 'hook') {
      const c = P[9]; c.free = true; place(c, 5, 0.8, -Math.PI / 2); S.giveBall(c, 'bal'); c.script = { vx: -2.5, vz: 0 };
      place(me, 1, -1.8, 0);
    } else if (kind === 'keeper') {
      place(me, 0, -HL + 0.8, 0);
      const f = P[11]; f.free = true; place(f, R.range(-2, 2), -HL + 6 + R.range(0, 1), Math.PI); S.giveBall(f, 'hand'); f.frozen = true;
      st.shot = false;
    }
    st.phase = 'live'; st.t = 0;
  };
  function judge() {
    for (const e of s.events) {
      if (e.id < st.seen) continue;
      st.seen = e.id + 1;
      if (st.phase !== 'live') continue;
      if (kind === 'point' && e.type === 'score' && e.team === 0) return { ok: true };
      if (kind === 'goal' && e.type === 'score' && e.team === 0) return e.kind === 'goal' ? { ok: true } : { ok: false };
      if (kind === 'pass' && e.type === 'catch') return { ok: e.by === 4 };
      if (kind === 'hook' && (e.type === 'hook' || e.type === 'shoulder' && e.won) && e.by === me.id) return { ok: true };
      if (kind === 'keeper') { if (e.type === 'score') return { ok: false }; if ((e.type === 'block' || e.type === 'catch') && e.by === me.id) return { ok: true }; if (e.type === 'strike') st.shot = true; }
      if (e.type === 'wide' || e.type === 'side') return { ok: false };
    }
    if (kind === 'rise' && B.holder === me.id) return { ok: true };
    if (kind === 'solo') { if (B.holder === me.id && me.z >= 4) return { ok: true }; if (B.holder !== me.id && st.t > 0.6) return { ok: false }; }
    return null;
  }
  const limits = { rise: 7, point: 8, goal: 8, pass: 5, solo: 14, hook: 8, keeper: 6 };
  return {
    tick(dt) {
      st.t += dt;
      if (st.phase === 'wait') { if (st.t > 0.4) { st.seen = s.evId; setupAttempt(); } return null; }
      if (st.phase === 'live') {
        const o = judge();
        if (o) { st.phase = 'pause'; st.t = 0; st.n++; return o; }
        if (st.t > limits[kind] || (kind === 'hook' && P[9].x < -HW + 1.2) || s.phase === 'dead') { st.phase = 'pause'; st.t = 0; st.n++; return { ok: false }; }
        if (kind === 'keeper' && !st.shot && st.t > 0.9) { const f = P[11]; if (!f.act && B.holder === f.id) { const gx = R.range(-1.7, 1.7); S.startStrike(f, { style: 'drive', f: 0.28, aim: { x: gx - f.x, z: -HL - f.z } }); if (f.act) { f.act.q = 0.8; f.act.noAssist = false; } st.shot = true; } }
        return null;
      }
      if (st.phase === 'pause' && st.t > 1.3) { st.phase = 'wait'; st.t = 0; }
      return null;
    },
  };
}

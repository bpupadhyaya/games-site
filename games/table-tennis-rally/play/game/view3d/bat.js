// The player's bat. First person: no body, no arm, no hand. The bat is the player's own finger made visible, so it must feel directly
// attached to it: it follows with a little lag and inertia, leans into the movement and the flick, tilts with the stroke (closed face for
// topspin, open for backspin, a turn for sidespin), swings along an arc with a short trail, recoils and flashes on contact, and keeps out of
// the way of the incoming ball by fading when it would cover it. Presentation only: it reads the published state and never writes back.
import { THREE } from '../vendor3d/index.js';
import { padTarget } from './stroke-pose.js';

const T = THREE;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const READY = [1.08, 1.98], SERVE_READY = [1.1, 1.84];       // the resting bat: low and near the camera, out of the ball's way

export function createBat(A) {
  const B = A.bat;
  const st = {
    vp: new T.Vector3(0.0, READY[0], READY[1]), vel: new T.Vector3(), tp: null, tpPrev: new T.Vector3(), lag: new T.Vector3(),
    q: new T.Quaternion(), qInit: false, recoil: 0, recoilV: 0, squash: 0, squashV: 0, impactT: 9, flash: 0, ghost: 1, seen: 0,
    trail: [], glow: 0, tossT: 0,
  };
  const tmpG = new T.Group(), v1 = new T.Vector3(), v2 = new T.Vector3(), q1 = new T.Quaternion();
  const matBase = B.mats.map((m) => ({ m, c: m.color ? m.color.clone() : null }));

  function impact(e) { st.recoilV -= 1.5; st.squashV -= 7; st.impactT = 0; st.flash = 1; st.kind = e.kind; }

  function update(v, dr, tNow, clock, ctx) {
    const pad = v.pads.p;
    const holdBall = v.phase === 'serve' && v.server === 'p';
    const tg = padTarget('p', pad, tNow, clock, v.ball, holdBall, { carry: 0, ready: READY, serveReady: SERVE_READY });
    const sw = pad.swing;
    // ---- position: the stroke path, plus a little lag that melts away at the contact so the bat is exactly on the ball
    const tp = new T.Vector3(tg.pos[0], tg.pos[1], tg.pos[2]);
    if (!st.tp) { st.tp = tp.clone(); st.tpPrev.copy(tp); st.vp.copy(tp); }
    const tv = tp.clone().sub(st.tpPrev).divideScalar(Math.max(dr, 1e-3)); st.tpPrev.copy(tp);
    const wc = sw ? clamp(1 - Math.abs(tNow - sw.tc) / 0.14, 0, 1) : 0;           // 1 at the contact
    const tau = 0.055 * (1 - wc * wc * (3 - 2 * wc));
    const lagT = tv.clone().multiplyScalar(-tau); lagT.y *= 0.6;
    st.lag.lerp(lagT, Math.min(1, dr * 14));
    st.vp.copy(tp).add(st.lag);
    // idle bob and breathing
    if (!sw) st.vp.y += Math.sin(clock * 2.1) * 0.006;
    // ---- orientation: face tilt of the stroke, turned toward the aim, leaning into the movement and the flick
    const u = tg.u;
    const bump = Math.sin(clamp(u, 0, 1) * Math.PI);
    const curve = sw && sw.flick ? sw.flick.curve : 0;
    const aim = sw && sw.flick ? sw.flick.aim : 0;
    let tilt = tg.tilt;
    // the resting bat leans back a little toward the player (handle toward the camera) so the face never hides the table
    tilt += -0.32 * (1 - wc);
    const n = v1.set(Math.sin(tg.yaw) * Math.cos(tilt), Math.sin(tilt), -Math.cos(tg.yaw) * Math.cos(tilt));
    tmpG.position.copy(st.vp); tmpG.up.set(0, 1, 0);
    tmpG.lookAt(st.vp.x + n.x, st.vp.y + n.y, st.vp.z + n.z);
    const roll = 0.32 - clamp(tv.x * 0.07, -0.35, 0.35) * (1 - wc * 0.5) + curve * 0.55 * bump + aim * 0.18 * bump;
    tmpG.rotateZ(roll);
    tmpG.updateMatrixWorld(true);
    const qT = tmpG.quaternion.clone();
    if (!st.qInit) { st.q.copy(qT); st.qInit = true; }
    st.q.rotateTowards(qT, Math.max(0.03, dr * (wc > 0.05 ? 40 : 14)));
    B.g.quaternion.copy(st.q);
    // ---- contact feedback: recoil along the face normal and a squash of the blade
    st.recoilV += (-260 * st.recoil - 26 * st.recoilV) * dr; st.recoil += st.recoilV * dr;
    st.squashV += (-420 * st.squash - 30 * st.squashV) * dr; st.squash += st.squashV * dr;
    const nn = v2.set(0, 0, 1).applyQuaternion(st.q);
    B.g.position.copy(st.vp).addScaledVector(nn, st.recoil * 0.06);
    B.blade.scale.set(1 + st.squash * 0.05, 1 + st.squash * 0.05, 1 + st.squash * 0.9);
    st.impactT += dr; st.flash = Math.max(0, st.flash - dr * 6);
    const ik = clamp(st.impactT / 0.28, 0, 1);
    B.impact.material.opacity = ik < 1 ? 0.8 * (1 - ik) : 0; B.impact.scale.setScalar(1 + ik * 1.6);
    // ---- timing glow on the face (when to flick) and spin tint
    const g = v.flickGlow || 0;
    st.glow += (g - st.glow) * Math.min(1, dr * 18);
    B.glow.material.opacity = st.glow * (0.55 + 0.35 * Math.sin(clock * 22));
    B.glow.material.color.set(v.spinColor ?? 0xffe27a);
    B.glow.scale.setScalar(1.25 - 0.25 * st.glow);
    // ---- keep out of the ball's view: fade when the ball would be hidden behind the bat on screen
    let ghost = 1;
    if (ctx && ctx.camera && v.phase === 'rally') {
      const a = new T.Vector3(...v.ball).project(ctx.camera), b = B.g.position.clone().project(ctx.camera);
      const dx = (a.x - b.x) * (ctx.W / ctx.H), dy = a.y - b.y;
      const d = Math.hypot(dx, dy), incoming = v.ball[2] > -0.2 && v.ball[2] < 3.2;
      if (incoming && a.z < 1 && b.z < 1) ghost = clamp((d - 0.07) / 0.22, 0.22, 1);
    }
    st.ghost += (ghost - st.ghost) * Math.min(1, dr * 12);
    for (const { m, c } of matBase) { m.opacity = st.ghost; m.depthWrite = st.ghost > 0.95; if (c && st.flash > 0) m.color.copy(c).lerp(new T.Color(0xffffff), st.flash * 0.25); else if (c) m.color.copy(c); }
    B.glow.material.opacity *= st.ghost; B.impact.material.opacity *= st.ghost;
    // ---- soft shadow on the floor / table under the bat
    const over = Math.abs(B.g.position.x) < 0.78 && Math.abs(B.g.position.z) < 1.4;
    const gy = over ? 0.7625 : 0.004, h = Math.max(0, B.g.position.y - gy);
    A.batBlob.position.set(B.g.position.x, gy + 0.002, B.g.position.z + 0.05);
    A.batBlob.scale.set(1 + h * 0.5, 1 + h * 0.2, 1);
    A.batBlob.material.opacity = clamp(0.3 - h * 0.12, 0.06, 0.3) * st.ghost;
    // ---- swing trail: the blade's centre and tip over the last few frames
    const speed = tv.length();
    const tip = B.g.position.clone().addScaledVector(v2.set(0, 1, 0).applyQuaternion(st.q), 0.1), ctr = B.g.position.clone();
    st.trail.unshift({ a: ctr, b: tip }); if (st.trail.length > A.TR) st.trail.pop();
    const fast = clamp((speed - 1.6) / 3, 0, 1);
    const pos = A.batTrail.geometry.attributes.position, col = A.batTrail.geometry.attributes.color;
    for (let i = 0; i < A.TR; i++) {
      const s = st.trail[Math.min(i, st.trail.length - 1)]; if (!s) continue;
      pos.setXYZ(i * 2, s.a.x, s.a.y, s.a.z); pos.setXYZ(i * 2 + 1, s.b.x, s.b.y, s.b.z);
      const f = (1 - i / (A.TR - 1)) * fast * 0.55 * st.ghost;
      col.setXYZ(i * 2, 1.0 * f, 0.62 * f, 0.22 * f); col.setXYZ(i * 2 + 1, 0.9 * f, 0.4 * f, 0.1 * f);
    }
    pos.needsUpdate = true; col.needsUpdate = true; A.batTrail.visible = fast > 0.02;
    // ---- serve toss preview: dots along the arc the ball will fly when you flick to serve
    const showToss = holdBall && !v.auto && !pad.swing;
    st.tossT += (showToss ? 1 : -1) * dr * 5; st.tossT = clamp(st.tossT, 0, 1);
    A.tossDots.forEach((s, i) => {
      s.visible = st.tossT > 0.02;
      if (!s.visible) return;
      const t = (i + 1) / A.tossDots.length * 0.4, y = v.ball[1] + 2.3 * t - 4.9 * t * t;
      s.position.set(v.ball[0], y, v.ball[2]);
      s.scale.setScalar(0.035 + 0.02 * Math.sin(clock * 6 + i));
      s.material.opacity = st.tossT * (0.25 + 0.5 * (1 - i / A.tossDots.length)) * (0.7 + 0.3 * Math.sin(clock * 5 - i * 0.7));
    });
  }
  return { update, impact, state: st };
}

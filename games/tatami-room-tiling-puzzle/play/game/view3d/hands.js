// Two real human hands (view3d athlete rig via hand3d.js, see arm.js) in kimono sleeves lay each mat: they guide it in from the near edge,
// press it down, give it two soft pats, then draw back. Positions follow the mat's own animated pose; every target is smoothed with a
// critically damped spring (no teleports), finger curl and press are eased, the sleeve's hanging panel swings with the wrist's motion.
// Presenter calls: place(entry, tile, board) when a mat is laid by the sim, update(dt, clock, ctx) each frame, hide(), cancel(entry).
import { createArm } from './arm.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);

// critically damped spring toward a target (position + velocity), frame-rate independent
function spring(cur, vel, target, omega, dt) {
  const x = cur - target, e = Math.exp(-omega * dt);
  return [target + (x + (vel + omega * x) * dt) * e, (vel - omega * (vel + omega * x) * dt) * e];
}

export function createHands({ THREE, scene, camera, renderer, burst, look }) {
  const api = { place() {}, cancel() {}, update() {}, hide() {}, ready: false };
  let slots = null, loading = false, job = null, queued = null;
  renderer.localClippingEnabled = true;

  async function init() {
    if (loading) return; loading = true;
    try {
      const mk = async (side) => {
        const arm = await createArm(THREE, side, { skin: 'light', cloth: '#' + new THREE.Color(look().cloth ?? 0x9a2a4a).getHexString() });
        scene.add(arm.object, arm.root); arm.setVisible(false);
        return { side, arm, wrist: new THREE.Vector3(), vel: new THREE.Vector3(), has: false };
      };
      slots = [await mk('L'), await mk('R')];
      api.ready = true;
    } catch (e) { console.warn('hands unavailable', e); slots = null; }
    loading = false;
  }
  init();

  api.place = (e) => { const j = { e, t: 0 }; if (job && job.e && job.t < 1.6) queued = j; else job = j; };
  api.cancel = (e) => { if (job && job.e === e) { job = queued; queued = null; } if (queued && queued.e === e) queued = null; };
  const none = () => { if (slots) for (const s of slots) { s.arm.setVisible(false); s.has = false; } };
  api.hide = () => { none(); job = null; queued = null; };

  const DUR = 1.4;
  const dirF = new THREE.Vector3(), tmpV = new THREE.Vector3();
  api.update = (dt, clock) => {
    if (!slots) return;
    if (!job) { none(); return; }
    job.t += dt;
    if (job.t > DUR) { job = queued; queued = null; if (!job) { none(); return; } }
    const e = job.e, tj = e.t;             // the mat's own clock since it was laid (0 = it started to slide in)
    const depthHalf = e.stand ? 1 : 0.5, spread = e.half ? 0.2 : e.stand ? 0.22 : 0.55;
    const gp = e.grp.position;
    const guide = clamp(tj / 0.3, 0, 1), landed = tj >= 0.3, tp = Math.max(0, tj - 0.3);   // tp: time since the mat landed
    const pat = tp > 0.12 && tp < 0.62 ? Math.abs(Math.sin((tp - 0.12) * Math.PI * 4)) : 0;      // two soft pats
    const press = landed ? clamp(tp / 0.1, 0, 1) * (tp < 0.65 ? 1 : 1 - ease(clamp((tp - 0.65) / 0.2, 0, 1))) : 0;
    const away = ease(clamp((tp - 0.62) / 0.5, 0, 1));                 // withdraw toward the viewer, rising
    for (let i = 0; i < 2; i++) {
      const s = slots[i], sd = i === 0 ? -1 : 1;
      s.arm.setVisible(true);
      s.arm.fade(Math.min(clamp(job.t / 0.14, 0, 1), 1 - clamp((tp - 0.62 - 0.3) / 0.22, 0, 1)));
      const tx = e.x + sd * spread + sd * 0.12 * away;
      const ty = gp.y + 0.075 + 0.02 * (1 - press) - 0.03 * press * (0.4 + 0.6 * pat) + 0.55 * away + (1 - guide) * 0.06;
      const tz = gp.z + depthHalf + 0.1 + 0.06 * pat + 0.95 * away - 0.02 * press;
      if (!s.has) { s.wrist.set(tx + sd * 0.15, ty + 0.5, tz + 0.7); s.vel.set(0, 0, 0); s.has = true; s.arm.state.prev.copy(s.wrist); }
      // velocity follower: aims for the target with a proportional speed, limited to ~3.5 m/s and ~30 m/s^2 (no snaps, no teleports)
      const om = away > 0 ? 6 : 10, VMAX = 4.0, AMAX = 34;
      const want = tmpV.set(tx - s.wrist.x, ty - s.wrist.y, tz - s.wrist.z).multiplyScalar(om);
      const wl = want.length(); if (wl > VMAX) want.multiplyScalar(VMAX / wl);
      const dv = want.sub(s.vel), dl = dv.length(), lim = AMAX * dt; if (dl > lim) dv.multiplyScalar(lim / dl);
      s.vel.add(dv); s.wrist.addScaledVector(s.vel, dt);
      dirF.set(sd * 0.08, -0.12 * (1 - press), -1);
      s.arm.pose(s.wrist, { dirF, press, pat, dt, iters: 3, clock });
    }
  };
  api.flush = () => { job = null; queued = null; };
  // measurement hook: the main joints of both arms in world units (smoothness check, see STATUS.md)
  api.joints = () => (slots ? slots.map((s) => {
    const h = s.arm.hand.human, p = (n) => h.bonePosition(`${s.side}_${n}`, new THREE.Vector3()).toArray();
    return { side: s.side, vis: s.arm.object.visible, upper: p('UpperArm'), elbow: p('Forearm'), wrist: p('Hand'), target: s.wrist.toArray(), tamoto: s.arm.root.children[1].quaternion.toArray() };
  }) : null);
  api.debug = () => (slots ? slots.map((s) => ({ side: s.side, wrist: s.wrist.toArray().map((v) => +v.toFixed(2)), vis: s.arm.object.visible })) : null);
  return api;
}

// One player: a real athlete skeleton (view3d Human) driven from the simulation each frame. This file knows the moves (run, ready crouch,
// wind-up, throw, sidestep, bend to a stone, carry, get hit, celebrate); the presenter decides which one is wanted. Nothing here feeds back
// into the simulation.
import { THREE, buildClip, addThrowClips, addFieldClips } from '../vendor3d/index.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapAng = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// authored moves ------------------------------------------------------------------------------------------------------------------------
const COCK = { Pelvis: { twist: -40 }, Spine1: { twist: -30, flex: -3 }, Spine2: { twist: -14 }, R_Thigh: { flex: 6, abduct: 3 }, R_Calf: { flex: 14 }, L_Thigh: { flex: 20 }, L_Calf: { flex: 14 } };
function addMoves(h) {
  const S = h.info && h.info.height ? h.info.height / 1.74 : 1, P = (x, y, z) => [x * S, y * S, z * S];
  // held wind-up: the throwing arm cocked behind the ear, the other hand pointing at the target; a slow sway so it is never frozen
  h.addClip(buildClip(h, {
    name: 'cock', duration: 1.4, loop: true, base: 'idle', grounded: true, fingerHands: { R: 'throwGrip', L: 'open' },
    keys: [{ t: 0, pose: COCK }, { t: 0.7, pose: { ...COCK, Pelvis: { twist: -44 }, Spine1: { twist: -33, flex: -5 } }, ease: 'inOut' }, { t: 1.4, pose: COCK, ease: 'inOut' }],
    ik: {
      R_Hand: { keys: [{ t: 0, pos: P(-0.27, 1.44, -0.3) }, { t: 0.7, pos: P(-0.29, 1.47, -0.34), ease: 'inOut' }, { t: 1.4, pos: P(-0.27, 1.44, -0.3), ease: 'inOut' }], pole: [{ t: 0, pos: [-0.7, 1.6, -0.4] }] },
      L_Hand: { keys: [{ t: 0, pos: P(0.14, 1.4, 0.62) }, { t: 1.4, pos: P(0.14, 1.4, 0.62) }], pole: [{ t: 0, pos: [0.6, 1.2, 0.2] }] },
    },
  }));
  // sidestep dodge, to the avatar's left (+1) or right (-1): push off, lean into it, arms out for balance, recover
  for (const [nm, s] of [['dodgeL', 1], ['dodgeR', -1]]) {
    const lead = s > 0 ? 'L' : 'R', trail = s > 0 ? 'R' : 'L';
    const mid = { Pelvis: { side: 18 * s, flex: 10, pos: [0.12 * s, -0.17, 0.05] }, Spine1: { side: -14 * s, flex: 12 }, Head: { flex: -6, side: 8 * s }, [`${lead}_Thigh`]: { abduct: 40, flex: 20 }, [`${lead}_Calf`]: { flex: 26 }, [`${trail}_Thigh`]: { abduct: -6, flex: 16 }, [`${trail}_Calf`]: { flex: 34 } };
    h.addClip(buildClip(h, {
      name: nm, duration: 0.56, base: 'idle', grounded: true, fingerHands: { R: 'open', L: 'open' },
      keys: [{ t: 0 }, { t: 0.12, pose: mid, ease: 'out' }, { t: 0.34, pose: mid }, { t: 0.56, pose: { Pelvis: { flex: 4, pos: [0, -0.06, 0] } }, ease: 'inOut' }],
      ik: {
        [`${lead}_Hand`]: { keys: [{ t: 0, pos: P(0.2 * s, 1.0, 0.3) }, { t: 0.12, pos: P(0.7 * s, 1.18, 0.15), ease: 'out' }, { t: 0.34, pos: P(0.7 * s, 1.15, 0.12) }, { t: 0.56, pos: P(0.25 * s, 0.95, 0.2), ease: 'inOut' }], pole: [{ t: 0, pos: [0.8 * s, 0.9, -0.3] }] },
        [`${trail}_Hand`]: { keys: [{ t: 0, pos: P(-0.2 * s, 1.0, 0.3) }, { t: 0.12, pos: P(-0.35 * s, 1.35, 0.3), ease: 'out' }, { t: 0.34, pos: P(-0.35 * s, 1.3, 0.28) }, { t: 0.56, pos: P(-0.25 * s, 0.95, 0.2), ease: 'inOut' }], pole: [{ t: 0, pos: [-0.8 * s, 0.9, -0.3] }] },
      },
    }));
  }
  // upper-body bend (a masked layer): scooping a stone up, lowering one onto the tower
  h.addClip(buildClip(h, {
    name: 'bend', duration: 1, loop: true, base: 'idle',
    keys: [{ t: 0, pose: { Spine: { flex: 22 }, Spine1: { flex: 26 }, Spine2: { flex: 18 }, Neck: { flex: -14 }, Head: { flex: -20 } } }, { t: 1, pose: { Spine: { flex: 22 }, Spine1: { flex: 26 }, Spine2: { flex: 18 }, Neck: { flex: -14 }, Head: { flex: -20 } } }],
  }));
  // sitting out: crouched on the heels, forearms on the knees (a runner who has been hit waits for the next inning)
  h.addClip(buildClip(h, {
    name: 'rest', duration: 3, loop: true, base: 'crouch_idle', grounded: true,
    keys: [{ t: 0, pose: { Spine1: { flex: 10 }, Head: { flex: -8 } } }, { t: 1.5, pose: { Spine1: { flex: 14 }, Head: { flex: -6 } }, ease: 'inOut' }, { t: 3, pose: { Spine1: { flex: 10 }, Head: { flex: -8 } }, ease: 'inOut' }],
  }));
}

export class Person {
  constructor(human, { x = 0, z = 0 } = {}) {
    this.h = human;
    addThrowClips(human); addFieldClips(human); addMoves(human);
    human.addLayer('bend', { mask: 'spine', weight: 0 });
    human.play('bend', { layer: 'bend', fade: 0 });
    human.layers.bend.setWeight(0, 0);
    human.turnRate = 11;
    this.pos = V(x, 0, z); this.vel = 0; this.yaw = 0; this.t = 0; this.busyUntil = 0; this.mode = ''; this.bend = 0; this.bendT = 0;
    this.speedLP = 0; this.id = -1; this.lastClip = '';
    human.setPosition(x, 0, z);
  }
  get busy() { return this.t < this.busyUntil; }
  /** Move the visual position toward a sim target at most `maxSpeed` m/s; returns the ground speed this frame. */
  step(tx, tz, dt, maxSpeed = 7) {
    if (this.busy && (this.mode === 'throw' || this.mode === 'catch')) maxSpeed = Math.min(maxSpeed, 0.25);
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz), m = maxSpeed * dt;
    let moved = 0;
    if (d > 1e-5) { moved = Math.min(d, m); this.pos.x += dx / d * moved; this.pos.z += dz / d * moved; }
    const sp = dt > 0 ? moved / dt : 0;
    this.speedLP += (Math.max(sp, this.shownSp || 0) - this.speedLP) * Math.min(1, dt * 14);
    return sp;
  }
  faceTo(x, z, snap = false) { const dx = x - this.pos.x, dz = z - this.pos.z; if (dx * dx + dz * dz > 1e-4) { this.yaw = Math.atan2(dx, dz); this.h.setFacing(this.yaw, { snap }); } }
  faceYaw(a, snap = false) { this.yaw = a; this.h.setFacing(a, { snap }); }
  /** continuous ground movement (the library picks idle / walk / jog / sprint and matches the foot speed to the ground) */
  loco(speed, fade = 0.2) { if (!this.busy) this.h.locomote(speed, { fade, set: { jog: 'jog_slow' } }); }
  idle(name = 'idle', fade = 0.25) { if (!this.busy) this.h.ensure(name, { fade, loop: true }); }
  once(name, { fade = 0.08, dur = null, speed = 1 } = {}) { const c = this.h.getClip(name); this.h.play(name, { fade, loop: false, speed }); this.busyUntil = this.t + (dur ?? c.dur / speed); return c; }
  /** a throw whose release lands `eta` seconds from now */
  throwIn(eta, dt = 0) {
    const c = this.h.getClip('throw_overarm'), rel = c.events.release ?? 0.3;
    this.h.playTimed('throw_overarm', 'release', Math.max(0.02, eta), { fade: 0.1, frameDt: dt });
    this.busyUntil = this.t + Math.max(0.02, eta) + (c.dur - rel) * 0.8; this.mode = 'throw';
  }
  setBend(w, rate = 0.12) { if (Math.abs(w - this.bendT) > 0.02) { this.bendT = w; this.h.layers.bend.setWeight(w, rate); } }
  /** both hands to a point (carrying a stone in front of the chest, or reaching for one on the ground) */
  reachBoth(point, weight, gap = 0.17, pole = null) {
    if (!point || weight <= 0) { this.h.setReach('L', null); this.h.setReach('R', null); return; }
    const l = V(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); // the avatar's left in the world
    const pl = point.clone().addScaledVector(l, gap), pr = point.clone().addScaledVector(l, -gap);
    this.h.setReach('L', pl, { weight, pole }); this.h.setReach('R', pr, { weight, pole });
  }
  forward(d) { return V(Math.sin(this.yaw) * d, 0, Math.cos(this.yaw) * d); }
  update(dt) { this.t += dt; this.h.setPosition(this.pos.x, 0, this.pos.z); }
}

export { V, clamp, wrapAng };

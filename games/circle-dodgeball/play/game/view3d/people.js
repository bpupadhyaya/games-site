// One person: a real athlete skeleton (view3d Human) driven from the simulated player every frame. This file knows the moves (run gaits,
// ready stance, overarm and underarm throws timed to the release, the two-handed catch, a hit, a kneel, a scoop for the ball, cheering);
// the presenter decides which one is wanted. Nothing here feeds back into the simulation.
import { buildClip, addThrowClips } from '../vendor3d/index.js';
import { clamp } from './world.js';

const GAITS = [{ name: 'walk', v: 1.4, lo: 0 }, { name: 'jog_slow', v: 2.41, lo: 1.9 }, { name: 'jog', v: 3.07, lo: 2.75 }, { name: 'sprint', v: 5.84, lo: 3.9 }];

function addMoves(h) {
  // the upper body bends to scoop a ball off the floor (a masked layer, weight driven by the presenter)
  const bent = { Spine: { flex: 22 }, Spine1: { flex: 26 }, Spine2: { flex: 18 }, Neck: { flex: -14 }, Head: { flex: -20 } };
  h.addClip(buildClip(h, { name: 'bend', duration: 1, loop: true, base: 'idle', keys: [{ t: 0, pose: bent }, { t: 1, pose: bent }] }));
}

export class Person {
  constructor(human) {
    this.h = human;
    addThrowClips(human); addMoves(human);
    human.addLayer('bend', { mask: 'spine', weight: 0 });
    human.play('bend', { layer: 'bend', fade: 0 });
    human.layers.bend.setWeight(0, 0);
    human.groundClamp = 'auto'; human.footPlanting = true; human.turnRate = 16;
    this.x = 0; this.z = 0; this.yaw = null; this.t = 0; this.busyUntil = 0; this.gait = null;
    this.bendW = 0; this.bendUntil = 0; this.wind = false; this.pid = -1; this.hand = null;
    this.prev = { hit: 0, catch: 0 };
    this.vx = 0; this.vz = 0; this.vs = 0; this.heading = null; this.scuffT = -9;   // displayed velocity (smoothed), speed, last shoe scuff
  }
  get busy() { return this.t < this.busyUntil; }
  setFacing(yaw, snap = false) { if (this.yaw === null || Math.abs(yaw - this.yaw) > 1e-4) { this.h.setFacing(yaw, { snap }); this.yaw = yaw; } }
  place(x, z) { this.x = x; this.z = z; this.h.setPosition(x, 0, z); }
  // choose / keep the locomotion clip for ground speed v (m/s); the cadence follows the ground so feet do not skate
  run(v) {
    if (this.busy) return;
    const h = this.h;
    let want = GAITS[0];
    for (const g of GAITS) if (v >= g.lo) want = g;
    if (this.gait) {   // hysteresis: stay in the current gait until the speed is clearly outside its band
      const i = GAITS.indexOf(this.gait), lo = this.gait.lo * 0.88, hi = GAITS[i + 1] ? GAITS[i + 1].lo * 1.1 : 1e9;
      if (v >= lo && v < hi) want = this.gait;
    }
    const cur = h.layers.base.current;
    if (!cur || cur.clip.name !== want.name || cur.target === 0) {
      const opts = { fade: 0.22, loop: true };
      if (cur && cur.clip.loop && cur.clip.events.footL !== undefined && h.clips[want.name].events.footL !== undefined) {
        const a = cur.clip, b = h.clips[want.name];
        const ph = (((cur.time - a.events.footL) / a.dur) % 1 + 1) % 1;
        opts.startTime = (b.events.footL + ph * b.dur) % b.dur;
      }
      h.play(want.name, opts);
    }
    this.gait = want;
    const tr = h.layers.base.current; if (tr) tr.speed = clamp(v / want.v, 0.6, 1.45);
  }
  still(name = 'ready_stance') { if (this.busy) return; this.gait = null; this.h.ensure(name, { fade: 0.25, loop: true }); }
  once(name, { fade = 0.08, dur = null, speed = 1 } = {}) {
    const c = this.h.getClip(name);
    this.gait = null; this.h.play(name, { fade, loop: false, speed });
    this.busyUntil = this.t + (dur ?? c.dur / speed);
  }
  // a throw whose release lands `eta` seconds from now
  throwIn(clip, eta, dt = 0) {
    const c = this.h.getClip(clip), rel = c.events.release ?? 0.3;
    this.gait = null;
    this.h.playTimed(clip, 'release', Math.max(0.03, eta), { fade: 0.07, frameDt: dt });
    this.busyUntil = this.t + Math.max(0.03, eta) + (c.dur - rel) * 0.55;
  }
  // a catch stance: the hands go to the named target 'catch' and meet the ball there at the sim's catch time
  catchIn(eta, dt = 0) {
    this.gait = null;
    this.h.playTimed('catch_two_hand', 'catch', Math.max(0.05, eta), { fade: 0.14, frameDt: dt });
    this.busyUntil = this.t + Math.max(0.05, eta) + 0.35;
  }
  // both hands to one world point (a ball carried at the chest): weight 0 releases them
  reachBoth(point, weight, gap = 0.15, pole = null) {
    const h = this.h;
    if (!point || weight <= 0) { h.setReach('L', null); h.setReach('R', null); return; }
    const lx = Math.cos(this.yaw ?? 0), lz = -Math.sin(this.yaw ?? 0);
    h.setReach('L', { x: point.x + lx * gap, y: point.y, z: point.z + lz * gap }, { weight, pole });
    h.setReach('R', { x: point.x - lx * gap, y: point.y, z: point.z - lz * gap }, { weight, pole });
  }
  setBend(w, rate = 0.1) { if (Math.abs(w - this.bendW) > 0.02) { this.bendW = w; this.h.layers.bend.setWeight(w, rate); } }
  update(dt) { this.t += dt; }
}

// One mounted rider in the scene: a horse3d horse (its gait follows the distance it travels) with a dressed athlete_m seated by horse3d's
// rider solver (seat, stirrup feet, rein hand). It only READS what the sim says (position, heading, speed, throw and lean events) and
// arranges the picture; it never writes back. The throw and lean clips own the trunk and the right arm while they run; the rest of the time the
// seat clip follows the pace.
import { Streamer } from './rider.js';
import { FIG } from '../src/consts.js';

const DT = 1 / 60;
const lerp = (a, b, t) => a + (b - a) * t;

export class Actor {
  constructor(id, rider, horse, THREE, seed) {
    this.id = id; this.rider = rider; this.h = rider.human; this.horse = horse; this.THREE = THREE;
    this.seat = ''; this.mode = 'ride';          // ride | throw | lean
    this.until = 0; this.releaseT = 0; this.struck = 0; this.shy = 0; this.shyDir = 0; this.busy = false; this.own = false;
    this.x = 0; this.z = 0; this.heading = 0; this.vx = 0; this.vz = 0; this.t = seed * 3.1;
    this.flex = 0; this.flexV = 0;
    const K = rider.kit;
    // secondary motion: sash ends at the right hip, a turban tail behind the head
    this.tails = [
      { s: new Streamer({ n: 6, len: 0.62, width: 0.13, color: K.cloth, taper: 0.7 }), bone: 'Bip01_Pelvis', off: [0.02, -0.05, -0.17] },
      { s: new Streamer({ n: 5, len: 0.5, width: 0.1, color: K.cloth, taper: 0.5 }), bone: 'Bip01_Pelvis', off: [0.02, 0.03, -0.17] },
      { s: new Streamer({ n: 6, len: 0.5, width: 0.1, color: '#efe6cf', taper: 0.5 }), bone: 'Bip01_Head', off: [0.12, 0.0, -0.1] },
    ];
    this.tmpP = new THREE.Vector3(); this.tmpW = new THREE.Vector3();
    // the right hand is the javelin hand: horse3d's rider solver must not pin it to the reins
    const hu = this.h;
    const setReach = hu.setReach.bind(hu);
    hu.setReach = (side, p, o) => setReach(side, side === 'R' ? null : p, o);
    // while a throw or lean clip runs, the seat solver's own seat-clip switches are ignored (it would cancel the clip)
    this._play = hu.play.bind(hu);
    hu.play = (name, o) => { if (this.busy && /^ride/.test(name) && !this.own) return null; return this._play(name, o); };
    this._seat('ride', 0);
  }
  addTo(stage) { for (const t of this.tails) stage.add(t.s.mesh); }
  setCloth(c) { this.tails[0].s.setColor(c); this.tails[1].s.setColor(c); }
  _seat(name, fade) { this.own = true; this._play(name, { fade }); this.own = false; this.seat = name; }
  onThrow(ev, Tr) {
    const eta = ev.tc * DT - Tr;
    this.busy = true;
    this.h.playTimed('throw', 'contact', Math.max(0.001, eta), { fade: 0.16, frameDt: DT });
    this.mode = 'throw'; this.releaseT = ev.tc * DT; this.until = ev.tc * DT + 0.7;
    if (this.h.layers.live) this.h.layers.live.setWeight(0, 0.05);
  }
  onLean(r, Tr) {
    const nearIsLeft = Math.cos(r.h) < 0;
    this.busy = true;
    this.h.play(nearIsLeft ? 'lean_L' : 'lean_R', { fade: 0.14 });
    this.mode = 'lean'; this.until = Tr + 0.7;
    if (this.h.layers.live) this.h.layers.live.setWeight(0, 0.05);
  }
  // a near miss: the horse shies away from the flying javelin (a quick yaw skip with a snort), the rider sits it out
  onShy(dir) { this.shy = 0.5; this.shyDir = dir; try { this.horse.play('snort'); } catch { /* optional */ } }
  reset() { this.mode = 'ride'; this.seat = ''; this.busy = false; this._seat('ride', 0); this.vx = this.vz = 0; this.tails.forEach((t) => { t.s.init = false; }); }

  // r = interpolated sim rider (x, z, h, v, w, javs, lean, role); Tr = render time (s); look = three-space point to look at or null
  update(r, Tr, dt, idx, look, camPos) {
    const hs = this.horse, h = this.h;
    this.t += dt;
    const x = -r.x, z = r.z, heading = -r.h;
    if (dt > 0) { const ix = (x - this.x) / dt, iz = (z - this.z) / dt; if (Math.abs(ix) < 40 && Math.abs(iz) < 40) { this.vx = lerp(this.vx, ix, Math.min(1, dt * 10)); this.vz = lerp(this.vz, iz, Math.min(1, dt * 10)); } }
    this.x = x; this.z = z; this.heading = heading;
    let yawAdd = 0;
    if (this.shy > 0) { this.shy = Math.max(0, this.shy - dt); const k = Math.sin((1 - this.shy / 0.5) * Math.PI); yawAdd = this.shyDir * 0.22 * k; }
    hs.setPosition(x, 0, z); hs.setFacing(heading + yawAdd);
    hs.drive(r.v / FIG, -r.w);
    if (dt <= 0 && !globalThis.__keepHorse) { hs.v = hs.target.v; hs.yawRate = hs.target.yaw; if (this.devPhase !== undefined) hs.phase = this.devPhase; }   // frozen sim (dev renders): settle straight to the pose
    hs.update(Math.max(dt, 1e-4));
    if (!this.busy) {
      let want = this.seat || 'ride';
      const v = r.v;
      if (want === 'ride' && v > 3.6) want = 'ride_fast';
      else if (want === 'ride_fast' && v < 3.0) want = 'ride';
      else if (want === 'ride_fast' && v > 6.8) want = 'ride_deep';
      else if (want === 'ride_deep' && v < 6.0) want = 'ride_fast';
      if (want !== this.seat) this._seat(want, 0.4);
    } else if (Tr > this.until) { this.busy = false; this.mode = 'ride'; this._seat(this.seat || 'ride', 0.35); }
    { const lw = h.layers.live; if (lw) { const want = this.mode === 'ride' ? 1 : 0; if (lw._wTarget !== want) lw.setWeight(want, 0.2); } }
    if (look) h.lookAt(look, { weight: 0.6, maxYaw: 1.9, maxPitch: 0.6 }); else h.lookAt(null);
    // the javelin in the hand and the bundle of spares
    const total = r.javs + (this.mode === 'throw' && Tr < this.releaseT ? 1 : 0);
    const inHand = total > 0 && !(this.mode === 'throw' && Tr >= this.releaseT) && r.role === 'chase';
    this.rider.jav.visible = inHand;
    this.rider.bundle.visible = r.role === 'chase' && total > 1;
    if (this.rider.bundle.visible) this.rider.bundle.children.forEach((c, i) => { c.visible = i < total - 1; });
    // whip: the stick in the hand flexes as the arm snaps forward (a damped spring excited at the release)
    if (this.mode === 'throw') {
      const into = Tr - (this.releaseT - 0.12);
      const target = into > 0 && into < 0.2 ? 0.55 * Math.sin(Math.min(1, into / 0.12) * Math.PI) : 0;
      this.flexV += (target - this.flex) * 160 * dt; this.flexV *= Math.exp(-9 * dt); this.flex += this.flexV * dt;
    } else { this.flex *= Math.exp(-10 * dt); }
    this.rider.jav.userData.flex(this.flex);
    // target standard: wobbles after a hit and leans out with the rider during a lean
    if (this.struck > 0) this.struck = Math.max(0, this.struck - dt);
    const k = 1 + 0.28 * Math.sin(this.struck * 40) * Math.min(1, this.struck / 0.35);
    const lk = r.lean > 0 ? Math.sin(Math.min(1, r.lean / 0.7) * Math.PI) : 0;
    const side = Math.cos(r.h) < 0 ? -1 : 1;
    for (const s of this.rider.shields) { s.scale.set(1, k, k); s.rotation.z = side * 1.05 * Math.min(1, lk * 1.6); s.rotation.x = -0.1 - Math.min(0.35, r.v * 0.02); }
    // cloth ribbons stream behind the pace
    const wind = this.tmpW.set(-this.vx * 0.5, 0.2, -this.vz * 0.5);
    for (const t of this.tails) {
      const b = h.bones[t.bone]; b.updateWorldMatrix(true, false);
      this.tmpP.set(t.off[0], t.off[1], t.off[2]); b.localToWorld(this.tmpP);
      t.s.step(dt, this.tmpP, wind, camPos, this.t);
    }
  }
}

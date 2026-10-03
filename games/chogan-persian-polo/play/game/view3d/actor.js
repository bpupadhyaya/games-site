// One mounted player in the scene: a procedural horse (animated by its speed and turn rate) with a mannequin rider on top.
// It only READS what the sim says (position, heading, speed, stroke events) and arranges the picture; it never writes back.
import { HorseAnim } from './horse.js';
import { seatRider } from './rider.js';
import { REACH } from '../src/consts.js';

const DT = 1 / 60;
const lerp = (a, b, t) => a + (b - a) * t;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Actor {
  constructor(id, rider, THREE, seed) {
    this.id = id; this.rider = rider; this.h = rider.human; this.THREE = THREE;
    this.horse = new HorseAnim(seed);
    this.seat = 'ride'; this.seatSince = 0;
    this.mode = 'ride';          // ride | wind | strike | hook | hooked
    this.kind = 'R'; this.tc = 0; this.q = 0; this.strikeEnd = 0; this.fromT = 0;
    this.live = { phase: seed * 1.7, rate: 0.6 + (seed % 3) * 0.12 };
    this.contact = null;
    this.cvec = new THREE.Vector3(); this.tmp = new THREE.Vector3();
    this.prevHeading = null;
  }

  // Swing bookkeeping from sim events ---------------------------------------------------------------------------------------------------
  onWind(ev, st) {
    // pick the wind-up by where the ball is now: the near side across the neck, else the right-hand forehand
    const r = st.riders[this.id], b = st.ball;
    const dx = b.x - r.x, dz = b.z - r.z, lat = dx * Math.cos(r.h) - dz * Math.sin(r.h), f = dx * Math.sin(r.h) + dz * Math.cos(r.h);
    const clip = lat < -0.15 && f > 0.1 ? 'wind_L' : f < -0.35 ? 'wind_B' : 'wind_R';
    this.mode = 'wind'; this.windClip = clip;
    if (this.h.layers.live) this.h.layers.live.setWeight(0, 0);
    this.h.play(clip, { fade: 0.12 });
  }
  onSwing(ev, Tr, st) {
    this.kind = ev.kind; this.tc = ev.tc; this.q = ev.q;
    const eta = ev.tc * DT - Tr;
    const clip = 'strike_' + ev.kind;
    this.h.playTimed(clip, 'contact', Math.max(0.001, eta), { fade: 0.06, frameDt: DT });
    this.mode = 'strike'; this.strikeEnd = ev.tc * DT + 0.45;
    if (this.h.layers.live) this.h.layers.live.setWeight(0, 0);
  }
  onHook(ev, Tr) {
    this.mode = 'hook'; this.strikeEnd = Tr + 0.7;
    this.h.play(ev.side > 0 ? 'hook_R' : 'hook_L', { fade: 0.08 });
  }
  onHooked() { this.mode = 'hooked'; this.strikeEnd = 0; this.until = 0; this.h.play('hooked', { fade: 0.06 }); this.hookedUntil = -1; }
  onCancel() { if (this.mode === 'wind') { this.mode = 'ride'; this.seat = ''; } }

  // contact target: the ball when it is inside the envelope of the stroke, else the nearest point of the envelope (a visible whiff)
  targetFor(st, ball3, r) {
    const E = REACH[this.kind];
    const sx = Math.sin(r.h), cx = Math.cos(r.h);
    const dx = -ball3.x - r.x, dz = ball3.z - r.z;      // interpolated ball, in sim axes
    let f = dx * sx + dz * cx, rr = dx * cx - dz * sx;
    const side = this.kind === 'L' ? -1 : 1;
    let lat = side * rr;
    lat = Math.min(E.latMax, Math.max(E.latMin, lat)); f = Math.min(E.fMax, Math.max(E.fMin, f));
    rr = side * lat;
    const wx = r.x + rr * cx + f * sx, wz = r.z - rr * sx + f * cx;
    return { x: -wx, y: ball3.y, z: wz };      // three space
  }

  // per-frame pose update. r = interpolated rider record (x, z, h, v, w); Tr = render time (s); dt = animation step
  update(r, st, Tr, dt, ball3, batch, idx, rein) {
    const hs = this.horse;
    hs.calm = this.mode === 'strike' || this.mode === 'wind';
    hs.x = -r.x; hs.z = r.z; hs.heading = -r.h;
    const pose = hs.step(dt, r.v, -r.w);
    const sad = hs.saddle();
    // reins: the hand is at REIN_HAND in the rider's frame, which sits on the body of the horse
    pose.rein = rein;
    batch.write(idx, { ...pose, x: hs.x, z: hs.z, heading: hs.heading });
    seatRider(this.rider, hs, sad, pose);
    const h = this.h;
    // seat variant by speed (hysteresis), only while riding
    if (this.mode === 'ride') {
      const v = r.v;
      let want = this.seat;
      if (!want) want = 'ride';
      if (want === 'ride' && v > 3.6) want = 'ride_fast';
      else if (want === 'ride_fast' && v < 3.0) want = 'ride';
      else if (want === 'ride_fast' && v > 6.8) want = 'ride_deep';
      else if (want === 'ride_deep' && v < 6.0) want = 'ride_fast';
      if (want !== this.seat) { h.play(want, { fade: 0.4 }); this.seat = want; }
    } else if (Tr > this.strikeEnd && this.mode !== 'wind') { this.mode = 'ride'; this.seat = ''; }
    // the idle sway fades out for strokes (the mallet must meet the ball exactly) and back in for riding
    { const lw = this.h.layers.live; if (lw) { const want = this.mode === 'ride' ? 1 : 0; if (lw._wTarget !== want) lw.setWeight(want, 0.12); } }
    // look at the ball
    h.lookAt(ball3, { weight: 0.65, maxYaw: 1.1, maxPitch: 0.55 });
    // the mallet sweet spot target during a stroke
    if (this.mode === 'strike' || this.mode === 'wind') h.setTarget('contact', this.targetFor(st, ball3, r));
    return pose;
  }
}

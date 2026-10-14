// One player of Bentengan: a real athlete skeleton posed every frame from the simulated player (position, velocity, state). Nothing flows back.
//   fort / waiting   ready stance (half crouch, weight on the balls of the feet), eyes on the nearest rival
//   moving           walk / slow jog / jog / sprint chosen from the real ground speed, cadence scaled to match it (feet do not skate)
//   chasing          the tagging arm reaches out when the rival is within arm's length
//   tagged           a flinch (hit), a short stop, then a jog to the jail; prisoners wave for a rescue
//   rescued          a freed prisoner runs home; the rescuer reaches for the jail rail
//   round won        the winners cheer, the others catch their breath
import { buildClip } from '../vendor3d/index.js';
import { S, wx, wz } from './scene.js';
import { POLE } from '../src/engine.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const SHUF = { name: 'crouch_walk', v: 1.0, lo: 0 };
const GAITS = [{ name: 'walk', v: 1.4, lo: 0 }, { name: 'jog_slow', v: 2.41, lo: 1.9 }, { name: 'jog', v: 3.07, lo: 2.75 }, { name: 'sprint', v: 5.84, lo: 3.9 }];

export class Figure {
  constructor(human, idx, scale = 1) {
    this.h = human; this.idx = idx; this.sc = scale;   // body scale: stride length grows with it
    this.gait = null; this.act = null; this.prevSt = 'fort'; this.t = 0; this.reach = 0; this.reachSide = 'R'; this.yaw = null; this.wave = 0;
    this.pos = { x: 0, z: 0 };
    human.groundClamp = 'auto'; human.footPlanting = true; human.turnRate = 9;
    // additive arm layer: a reach (tag or touch) on top of whatever the legs and body are doing
    human.addLayer('reachR', { mask: 'armR', additive: true });
    human.addLayer('reachL', { mask: 'armL', additive: true });
    const mk = (side) => buildClip(human, {
      name: 'reach' + side, duration: 0.7, base: 'ready_stance',
      keys: [
        { t: 0 },
        { t: 0.18, pose: { [side + '_UpperArm']: { flex: 78, abduct: 14 }, [side + '_Forearm']: { flex: 14 }, Spine1: { flex: 8, twist: side === 'R' ? -8 : 8 } }, ease: 'out' },
        { t: 0.5, pose: { [side + '_UpperArm']: { flex: 84, abduct: 12 }, [side + '_Forearm']: { flex: 6 }, Spine1: { flex: 10, twist: side === 'R' ? -10 : 10 } }, ease: 'inOut' },
        { t: 0.7, pose: { [side + '_UpperArm']: { flex: 0, abduct: 0 }, [side + '_Forearm']: { flex: 0 }, Spine1: { flex: 0, twist: 0 } }, ease: 'inOut' },
      ],
      fingers: 'open',
    });
    human.addClip(mk('R')); human.addClip(mk('L'));
    human.play('ready_stance', { fade: 0 });
  }

  doReach(side = 'R') { this.reachSide = side; const l = 'reach' + side; this.h.play('reach' + side, { layer: l, fade: 0.06, loop: false }); this.reach = 0.7; }

  // choose / keep the locomotion clip for ground speed v (m/s)
  _gait(v, shuffle = false) {
    const h = this.h;
    let want = shuffle && h.hasClip('crouch_walk') ? SHUF : GAITS[0];
    if (!shuffle)
    for (const g of GAITS) if (v >= g.lo) want = g;
    if (this.gait && !shuffle) {   // hysteresis: stay in the current gait until the speed is clearly outside its band
      const i = GAITS.indexOf(this.gait);
      const lo = this.gait.lo * 0.88, hi = GAITS[i + 1] ? GAITS[i + 1].lo * 1.1 : 1e9;
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
    const tr = h.layers.base.current; tr.speed = clamp(v / (want.v * this.sc), 0.3, 1.6);   // cadence = speed / stride
  }

  _still(name) { this.gait = null; this.h.ensure(name, { fade: 0.25, loop: true }); }

  // The picture follows the sim through a speed-limited, smoothed follower. Everything the legs do is derived from how far THIS figure's
  // displayed root really moved: speed picks walk / jog / sprint, cadence = speed / stride, no distance = idle. Heading follows that velocity.
  _follow(tx, tz, dt) {
    const D = this.disp;
    if (!D) { this.disp = { x: tx, z: tz }; this.vx = this.vz = this.tvx = this.tvz = 0; this.tpx = tx; this.tpz = tz; this.moving = false; return; }
    if (dt <= 0) return;
    if (this.tpx !== undefined) {   // where the sim is heading: the picture is turned toward it before the body has built up speed
      const a0 = 1 - Math.exp(-dt / 0.05);
      this.tvx += ((tx - this.tpx) / dt - this.tvx) * a0; this.tvz += ((tz - this.tpz) / dt - this.tvz) * a0;
    }
    this.tpx = tx; this.tpz = tz;
    const dx = tx - D.x, dz = tz - D.z, d = Math.hypot(dx, dz);
    const px = D.x, pz = D.z;
    if (d > 3.5) { D.x = tx; D.z = tz; this.vx = this.vz = this.tvx = this.tvz = 0; this.tpx = tx; this.tpz = tz; this.moving = false; return; }   // a new round: no skating across the field
    const step = Math.min(d * (1 - Math.exp(-dt * 20)), 7.2 * dt);
    if (d > 1e-6) { D.x += dx / d * step; D.z += dz / d * step; }
    const a = 1 - Math.exp(-dt / 0.09);
    this.vx += ((D.x - px) / dt - this.vx) * a; this.vz += ((D.z - pz) / dt - this.vz) * a;
    const sp = Math.hypot(this.vx, this.vz);
    this.moving = this.moving ? sp > 0.3 : sp > 0.5;   // hysteresis: idle when stationary
  }

  // p: the sim player, env: { dt, w, foes (players), jailGate (+1 / -1 x direction), result, winner }
  step(p, env) {
    const h = this.h, dt = env.dt;
    this.t += dt;
    const sx = wx(p.x), sz = wz(p.y);
    // ---- guards in the fort: now and then a quick sidestep along the ring (a 0.5 m offset eased over 0.7 s so the legs read it as real travel)
    let ox = 0, oz = 0;
    const idleFort = p.st === 'fort' && !env.result && !p.moving;
    if (this.shufA === undefined) { this.shufA = 0; this.shufB = 0; this.shufT = 1; this.shufNext = 3 + (this.idx * 1.7) % 5; }
    if (dt > 0) {
      if (idleFort) {
        this.shufNext -= dt;
        if (this.shufNext <= 0 && this.shufT >= 1) { this.shufA = this.shufB; this.shufB = this.shufB > 0.5 ? 0 : 1; this.shufT = 0; this.shufNext = 6 + (this.idx * 2.3) % 5; }
      } else if (this.shufB !== 0 && this.shufT >= 1) { this.shufA = this.shufB; this.shufB = 0; this.shufT = 0; }
      if (this.shufT < 1) this.shufT = Math.min(1, this.shufT + dt / 0.7);
    }
    const u = this.shufT, sm = u * u * (3 - 2 * u), shuf = this.shufA + (this.shufB - this.shufA) * sm;
    this.shuf = shuf; this.shufMoving = this.shufT < 1;
    if (shuf > 0.001) {
      const q = POLE[p.team], rx = sx - wx(q.x), rz = sz - wz(q.y), rl = Math.hypot(rx, rz) || 1;
      const sgn = this.idx % 2 ? 1 : -1;
      ox = -rz / rl * 0.5 * shuf * sgn; oz = rx / rl * 0.5 * shuf * sgn;
    }
    this._follow(sx + ox, sz + oz, dt);
    const x = this.disp.x, z = this.disp.z;
    this.pos.x = x; this.pos.z = z;
    h.setPosition(x, 0, z);
    // ---- transitions between sim states
    if (this.prevSt !== p.st) {
      if (p.st === 'jail') this.act = { name: 'hit', t: 0, dur: 0.55 };
      if (this.prevSt === 'jail' && p.st === 'return') this.act = null;
      if (p.st === 'out' && this.prevSt === 'fort') this.reach = 0;
      this.prevSt = p.st;
    }
    const speed = Math.hypot(this.vx, this.vz), moving = this.moving;
    // ---- facing: along the real velocity while moving (smoothed turn); stationary: toward the rival / the jail rail
    let yaw = this.yaw;
    const ts = Math.hypot(this.tvx, this.tvz);
    if (ts > 0.9) yaw = Math.atan2(this.tvx, this.tvz);
    else if (moving && speed > 0.5) yaw = Math.atan2(this.vx, this.vz);             // yaw 0 faces +z; atan2(x, z)
    else if (p.st === 'jail') yaw = env.jailGate < 0 ? -Math.PI / 2 : Math.PI / 2;
    else if (env.near && env.near.id !== p.id) yaw = Math.atan2(wx(env.near.x) - x, wz(env.near.y) - z);
    else if (yaw === null) yaw = p.team === 'H' ? Math.PI : 0;
    if (env.result && env.result.kind === 'pole' && env.result.by === p.id) yaw = Math.atan2(env.poleX - x, env.poleZ - z);
    this.yaw = yaw;
    if (this.yawCur == null) this.yawCur = yaw;
    else if (dt > 0) {
      let dy = Math.atan2(Math.sin(yaw - this.yawCur), Math.cos(yaw - this.yawCur));
      const rate = moving || ts > 0.9 ? 18 : 7, m = rate * dt;
      this.yawCur += Math.abs(dy) <= m ? dy : Math.sign(dy) * m;
    }
    h.turnRate = 0; h.setFacing(this.yawCur, { snap: true });

    // ---- the round is over: the winners cheer, the rest catch their breath
    if (env.result) {
      const won = env.winner === p.team;
      if (p.st === 'jail') { this._still('idle_relaxed'); }
      else if (env.winner === 'draw') this._still('idle_relaxed');
      else if (won) { if (!this.act || this.act.name !== 'celeb') this.act = { name: 'celeb', t: 0, dur: 99, clip: this.idx % 2 ? 'celebrate' : 'celebrate_2' }; }
      else this._still('crouch_idle');
      if (this.act && this.act.name === 'celeb') { this.act.t += dt; h.ensure(this.act.clip, { fade: 0.25, loop: this.act.clip !== 'celebrate' }); if (this.act.clip === 'celebrate' && this.act.t > 3.4) h.ensure('cheer', { fade: 0.3, loop: true }); }
      this._reachFade(dt);
      return;
    }
    if (this.act && this.act.name === 'celeb') this.act = null;

    // ---- reaching arm: when chasing a rival who is in arm's length, or touching the jail / pole
    const near = env.touch;       // { x, z } world point to reach for, or null
    if (near && this.reach <= 0) { const dx = near.x - x, dz = near.z - z; const rightSide = Math.sin(yaw) * dz - Math.cos(yaw) * dx; this.doReach(rightSide > 0 ? 'L' : 'R'); }
    this._reachFade(dt);

    // ---- the base clip
    if (this.act && this.act.name === 'hit') {
      this.act.t += dt;
      if (this.act.t < this.act.dur) { h.ensure('hit', { fade: 0.08 }); return; }
      this.act = null;
    }
    if (p.st === 'jail' && !moving) {
      // the prisoner stands at the rail; now and then waves for a rescue (a fixed cycle per player: deterministic)
      const cyc = (this.t + this.idx * 1.9) % 7;
      if (cyc < 2.6) { this.gait = null; h.ensure('wave', { fade: 0.3, loop: true }); } else this._still('idle_relaxed');
      return;
    }
    if (moving) this._gait(speed, this.shufMoving && p.st === 'fort');
    else this._still('ready_stance');
  }

  _reachFade(dt) { if (this.reach > 0) this.reach = Math.max(0, this.reach - dt); }
}

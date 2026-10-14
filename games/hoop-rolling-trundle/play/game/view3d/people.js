// One hoop roller: a real athlete skeleton (view3d Human) in period dress, running beside a steel hoop it drives with a stick, plus the hoop,
// the stick, the pinafore/skirt cloth, the hair ribbon / scarf tail and the dust. Everything is driven from the simulation's racer record
// (position, speed, lean, heading, spin, fall) and the presenter's road frame; nothing here feeds back into the simulation.
//
// LOCOMOTION RULE: stride cadence = displayed ground speed / stride (speed picks walk / jog / sprint with hysteresis, phase-aligned
// crossfades), no speed = idle; the heading follows the velocity through a critically damped turn; the stick hand is placed by a
// critically damped spring and its IK weight is blended in and out over 0.15 s, so no pose ever pops.
import { THREE as T3 } from '../vendor3d/index.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = Math.PI * 2;
export const SCALE = 0.92;            // a child of about ten: 1.3 m tall
export const HOOP_R = 0.36;           // the iron hoop is 72 cm across
const HOOP_DRAW = 1.2;                // drawn at most a little larger than life so it reads on a phone
const STICK_LEN = 0.78;
const DBG = (() => { try { return new URLSearchParams(globalThis.location.search).get('x') || ''; } catch { return ''; } })();

function spring3(o, tx, ty, tz, w, dt) {
  const e = Math.exp(-w * dt);
  for (const [k, t] of [['x', tx], ['y', ty], ['z', tz]]) {
    const x = o.p[k] - t, tmp = (o.v[k] + w * x) * dt;
    o.v[k] = (o.v[k] - w * tmp) * e; o.p[k] = t + (x + tmp) * e;
  }
  return o.p;
}
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

const GAITS = [{ name: 'walk', lo: 0 }, { name: 'jog_slow', lo: 1.9 }, { name: 'jog', lo: 2.75 }, { name: 'sprint', lo: 4.1 }];

export class Roller {
  constructor(human, scene, THREE, fx, V3) {
    this.h = human; this.T = THREE; this.fx = fx; this.V3 = V3; this.scene = scene;
    human.turnRate = 0; human.footPlanting = false; human.groundClamp = 'auto';
    this.gait = null; this.t = 0; this.vLP = 0; this.speedNow = 0; this.groundY = 0;
    this.yaw = { p: 0, v: 0 }; this.init = false;
    this.hand = { p: new THREE.Vector3(), v: new THREE.Vector3() }; this.handW = 0; this._handInit = false;
    this.gaze = { p: new THREE.Vector3(), v: new THREE.Vector3() }; this.gazeW = 0; this._gazeInit = false; this.tapPh = 0; this.rateLP = 0;
    this.lastSpin = 0; this.lastFall = false; this.bounceT = 99; this.fallDir = 1; this._lastCl = -1;
    this.key = ''; this.extras = []; this.cloth = null; this.chains = [];
    // ---- the hoop: a thin steel ring with two painted bands that show the spin. hoop = contact point on the road (yaw), roll = lean about it.
    this.hoop = new THREE.Group(); this.roll = new THREE.Group(); this.hoop.add(this.roll);
    this.ringMat = new THREE.MeshStandardMaterial({ color: 0xcfd6dd, metalness: 0.85, roughness: 0.3 });
    this.spin = new THREE.Group(); this.spin.position.y = 1; this.roll.add(this.spin);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.062, 10, 72), this.ringMat); ring.rotation.y = Math.PI / 2; ring.castShadow = true; this.spin.add(ring);
    this.bandA = new THREE.Mesh(new THREE.TorusGeometry(1, 0.085, 8, 14, 0.6), new THREE.MeshStandardMaterial({ color: 0xe8472f, roughness: 0.5 })); this.bandA.rotation.y = Math.PI / 2;
    this.bandB = new THREE.Mesh(new THREE.TorusGeometry(1, 0.085, 8, 14, 0.45), new THREE.MeshStandardMaterial({ color: 0xffd35a, roughness: 0.5 })); this.bandB.rotation.y = Math.PI / 2; this.bandB.rotation.z = Math.PI;
    this.spin.add(this.bandA, this.bandB);
    scene.add(this.hoop);
    // ---- the stick
    this.stick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.019, 1, 8), new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.75 }));
    this.stick.castShadow = true; scene.add(this.stick);
    this.up = new THREE.Vector3(0, 1, 0);
    this.v1 = new THREE.Vector3(); this.v2 = new THREE.Vector3(); this.v3 = new THREE.Vector3(); this.v4 = new THREE.Vector3();
    human.on('footL', () => this._strike('L_Foot'));
    human.on('footR', () => this._strike('R_Foot'));
    this.surf = 'road';
  }

  // ---- costume: period dress from the kit colours plus a few attached pieces ----------------------------------------------------------------
  setLook(look, tape) {
    const h = this.h, key = look.shirt + look.shorts + look.skin + look.style + look.hair + look.accent;
    this.bandA.material.color.set(tape);
    if (this.key === key) return;
    this.key = key; this.look = look;
    const girl = look.style === 'long';
    h.setKit({ top: look.shirt, bottoms: girl ? '#f1ece0' : look.shorts, socks: girl ? '#f1ece0' : '#34302c', shoes: '#2d2018', trim: look.accent });
    h.setSkin(look.skin); h.setHair(look.hair);
    for (const e of this.extras) { if (e.parent) e.parent.remove(e); if (e.geometry) e.geometry.dispose(); }
    this.extras.length = 0;
    this._dress(look, girl);
    if (this.cloth) { this.scene.remove(this.cloth.mesh); this.cloth.dispose(); this.cloth = null; }
    for (const c of this.chains) { this.scene.remove(c.mesh); c.dispose(); }
    this.chains.length = 0;
    const THREE = this.T;
    if (look.style === 'cap') {
      try {
        const g = this.V3.addCap(h, { color: new THREE.Color(look.accent).multiplyScalar(0.5).getHex() });
        const dome = g.children[0]; if (dome) dome.scale.set(1.2, 0.62, 1.22);
        this.extras.push(g);
      } catch { /* the cap is optional */ }
    }
    if (girl) {
      this.cloth = new Cloth(THREE, this.scene, { dress: look.shirt, apron: '#f6f1e6', trim: look.accent, len: 0.4 * SCALE, rWaist: 0.14 * SCALE, rHem: 0.3 * SCALE });
      this.chains.push(new Chain(THREE, this.scene, { color: look.accent, w: 0.05, n: 7, seg: 0.07, anchor: 'head', off: [0.0, 0.1, -0.1] }));
    } else if (look.style === 'scarf') {
      this.chains.push(new Chain(THREE, this.scene, { color: look.accent, w: 0.085, n: 9, seg: 0.08, anchor: 'neck', off: [0.05, 0.02, -0.08] }));
    }
  }
  // Period dress on top of the shared athlete: tubes along the bones (short sleeves, knickerbockers, stockings) and dark boots over the shoes.
  _dress(look, girl) {
    const THREE = this.T, h = this.h;
    const tube = (bone, child, r0, r1, color, frac = 1) => {
      const b = h.bones[bone], c = h.bones[child]; if (!b || !c) return;
      const v = c.position.clone(); const len = v.length() * frac; if (len < 1e-4) return;
      const geo = new THREE.CylinderGeometry(r1, r0, len, 10, 1, true);
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
      const dir = v.clone().normalize();
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      m.position.copy(dir).multiplyScalar(len / 2);
      m.castShadow = false; b.add(m); this.extras.push(m);
    };
    const shirt = new THREE.Color(look.shirt), shorts = new THREE.Color(girl ? '#f1ece0' : look.shorts), sock = girl ? '#f1ece0' : '#34302c';
    for (const s of ['L', 'R']) {
      tube(`Bip01_${s}_UpperArm`, `Bip01_${s}_Forearm`, 0.056, 0.048, shirt, 0.92);
      if (!girl) tube(`Bip01_${s}_Thigh`, `Bip01_${s}_Calf`, 0.098, 0.088, shorts, 0.98);
      tube(`Bip01_${s}_Calf`, `Bip01_${s}_Foot`, 0.058, 0.044, sock, 1.0);
      const foot = h.bones[`Bip01_${s}_Foot`], toe = h.bones[`Bip01_${s}_Toe0`];
      if (foot && toe) {
        const v = toe.position.clone(), len = v.length() + 0.05;
        const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, len, 4, 10), new THREE.MeshLambertMaterial({ color: 0x2d2018 }));
        const dir = v.clone().normalize();
        boot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        boot.position.copy(dir).multiplyScalar(len * 0.4); boot.scale.set(1, 1, 0.8);
        boot.castShadow = false; foot.add(boot); this.extras.push(boot);
      }
    }
  }

  hide() {
    this.h.root.visible = false; this.hoop.visible = false; this.stick.visible = false;
    if (this.cloth) this.cloth.mesh.visible = false; for (const c of this.chains) c.mesh.visible = false;
    this.init = false; this._handInit = false; this._gazeInit = false;
  }

  // After the skeleton update and before drawing: a 3-tap filter [1 2 1]/4 on every bone's rotation (one frame of latency). The shared clips are
  // 30 fps captures resampled at the display rate, which leaves a 30 Hz stair-step in the angular velocity of the feet and calves; this removes it.
  smooth() {
    if (!this.h.root.visible || DBG.includes('nosmooth')) return;
    const bones = this._bones || (this._bones = Object.values(this.h.bones).filter((b) => b && b.isBone !== false && b.quaternion));
    const H = this._hist || (this._hist = new Map());
    for (const b of bones) {
      let e = H.get(b);
      const q = b.quaternion;
      if (!e) { e = { a: q.clone(), b: q.clone() }; H.set(b, e); continue; }
      // e.a = previous frame (raw), e.b = the one before; output = 0.25 q + 0.5 a + 0.25 b (nlerp on the same hemisphere)
      const cur = this._q0 || (this._q0 = q.clone());
      cur.copy(q);
      const sa = e.a.dot(q) < 0 ? -1 : 1, sb = e.b.dot(q) < 0 ? -1 : 1;
      q.set(0.25 * cur.x + 0.5 * sa * e.a.x + 0.25 * sb * e.b.x, 0.25 * cur.y + 0.5 * sa * e.a.y + 0.25 * sb * e.b.y, 0.25 * cur.z + 0.5 * sa * e.a.z + 0.25 * sb * e.b.z, 0.25 * cur.w + 0.5 * sa * e.a.w + 0.25 * sb * e.b.w).normalize();
      e.b.copy(e.a); e.a.copy(cur);
    }
  }

  _strike(bone) {
    if (!this.h.root.visible || this.speedNow < 1.2) return;
    const p = this.h.bonePosition(bone, this.v4), gy = this.groundY;
    const mud = this.surf === 'mud', cob = this.surf === 'cobble', plank = this.surf === 'plank';
    const k = clamp(this.speedNow / 5, 0.4, 1.3);
    if (plank) this.fx.emit(p.x, gy + 0.02, p.z, 1, { size: 0.1, life: 0.35, r: 0.7, g: 0.55, b: 0.35, a: 0.22, speed: 0.15, up: 0.2 });
    else if (mud) this.fx.emit(p.x, gy + 0.03, p.z, 3, { size: 0.11, life: 0.55, r: 0.36, g: 0.26, b: 0.17, a: 0.85, speed: 0.55 * k, up: 0.9 * k, grav: 5, grow: 0.2, drag: 1.2 });
    else this.fx.emit(p.x, gy + 0.03, p.z, cob ? 1 : 2, { size: cob ? 0.12 : 0.17, life: 0.7, r: cob ? 0.75 : 0.82, g: cob ? 0.74 : 0.72, b: cob ? 0.7 : 0.58, a: cob ? 0.2 : 0.4, speed: 0.35 * k, up: 0.35 * k, grow: 2.2, drag: 1.8 });
  }

  _gait(v) {
    const h = this.h;
    let want = GAITS[0];
    for (const g of GAITS) if (v >= g.lo && h.clips[g.name]) want = g;
    if (this.gait) {
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
    const tr = h.layers.base.current, cv = (h.clips[want.name].speed || 4) * SCALE;
    tr.speed = clamp(v / cv, 0.3, 1.7);                // cadence = speed / stride
  }
  _still(name) { this.gait = null; this.h.ensure(name, { fade: 0.25, loop: true }); }

  /**
   * E: { r (racer), hoop: {x,y,z,h}, child: {x,y,z,h}, surf, W (world), splash (bool), onFall/onRoll/onClatter callbacks }.
   * hoop.h / child.h are the road heading in the camera frame; the racer's own heading psi is added here.
   */
  place(E, dt) {
    const r = E.r, h = this.h;
    this.t += dt; this.surf = E.surf; this.groundY = E.hoop.y;
    h.root.visible = true; this.hoop.visible = true;
    const down = r.phase === 'down', waiting = E.W.go < 0;
    this.vLP += (r.v - this.vLP) * (1 - Math.exp(-dt * 14));
    this.speedNow = this.vLP;
    // ---- the hoop (pivot at the contact point): leans with the balance, wobbles when slow, tips over and rattles when it falls
    const R = HOOP_R * HOOP_DRAW;
    if (down && !this.lastFall) { this.bounceT = 0; this.fallDir = r.downKind === 'water' ? 1 : (r.lam >= 0 ? 1 : -1); E.onFall && E.onFall(); }
    this.lastFall = down;
    this.bounceT = down ? this.bounceT + dt : 99;
    let tilt = clamp(r.lam, -1.2, 1.2) * 0.62;
    const wob = 1 - clamp(r.v / 3.4, 0, 1);
    tilt += (Math.sin(this.t * 9.0 + r.id * 2.1) * 0.05 + Math.sin(this.t * 4.3 + r.id) * 0.03) * wob;
    let flat = 0;
    if (down) {
      const u = clamp(this.bounceT / 0.4, 0, 1), fall = u * u * (3 - 2 * u), q = this.bounceT - 0.4;
      const rattle = q > 0 ? 0.3 * Math.exp(-q * 2.8) * Math.abs(Math.cos(q * (14 + q * 24))) : 0;
      tilt = this.fallDir * (1.5708 - rattle) * fall + tilt * (1 - fall);
      flat = fall;
    }
    const psi = r.psi, th = E.hoop.h + psi * 0.55;
    this.view = 0.52 + 0.25 * Math.sin(psi * 1.2);                       // the ring is turned a little toward the camera so it reads as a ring, not a line
    const fwx = Math.sin(th), fwz = -Math.cos(th);                        // direction of travel in the camera frame
    this.hoop.position.set(E.hoop.x, E.hoop.y + 0.012, E.hoop.z);
    this.hoop.rotation.set(0, Math.PI - th - this.view, 0);
    this.hoop.scale.setScalar(R);
    this.roll.rotation.set(0, 0, tilt);                                    // +lean = top toward the right of travel
    this.spin.rotation.x = r.spin;
    this.hoop.updateMatrixWorld(true);
    // ---- the child
    const targetYaw = Math.PI - (E.child.h + psi * 0.9);
    if (!this.init) { this.yaw.p = targetYaw; this.yaw.v = 0; this.init = true; }
    {
      const w = this.vLP > 0.5 ? 9 : 5, x = angDiff(this.yaw.p, targetYaw), tmp = (this.yaw.v + w * x) * dt, e = Math.exp(-w * dt);
      this.yaw.v = (this.yaw.v - w * tmp) * e; this.yaw.p = targetYaw + (x + tmp) * e;
    }
    h.setPosition(E.child.x, E.child.y, E.child.z);
    h.turnRate = 0; h.setFacing(this.yaw.p, { snap: true });
    if (down) {
      if (this.bounceT < 0.25) this._gait(Math.max(0.8, this.vLP + 1.0)); else this._still('idle_relaxed');
    } else if (r.finished && this.vLP < 0.8) this._still('cheer');
    else if (waiting || this.vLP < 0.35) this._still('ready_stance');
    else this._gait(this.vLP);
    // ---- the stick hand
    const wantW = down && this.bounceT > 0.5 ? 0 : 1;
    this.handW += clamp(wantW - this.handW, -dt / 0.15, dt / 0.15);
    const fx = Math.sin(this.yaw.p), fz = Math.cos(this.yaw.p);            // child forward (x, z)
    const rx = -fz, rz = fx;                                              // child's right
    const base = h.root.position;
    const gait = h.layers.base.current;
    // the stick taps once per step: the phase integrates the real step frequency (2 steps per gait cycle x playback rate / cycle length)
    const cyc = gait && gait.clip && gait.clip.loop && gait.clip.dur && this.gait ? (gait.speed || 1) / gait.clip.dur : 0;
    this.rateLP += (cyc - this.rateLP) * (1 - Math.exp(-dt * 8));
    this.tapPh = (this.tapPh + dt * this.rateLP * 2) % 1;
    const tapAmp = clamp(this.vLP / 3, 0, 1);
    const tap = tapAmp * (0.5 - 0.5 * Math.cos(this.tapPh * TAU));            // smooth 0..1 once per step
    const alpha = 0.55 + 0.1 * tap;                                         // where on the rear half of the ring the tip touches
    const rim = this.v1.set(0, 1 + Math.sin(alpha), -Math.cos(alpha) * 0.98);
    this.roll.localToWorld(rim);
    const hc = this.v2.set(base.x + rx * 0.22 + fx * 0.28, base.y + 0.72 * SCALE, base.z + rz * 0.22 + fz * 0.28);
    const dx = hc.x - rim.x, dyv = hc.y - rim.y, dz = hc.z - rim.z, dl = Math.hypot(dx, dyv, dz) || 1;
    const L = Math.min(STICK_LEN, dl);
    const tx = rim.x + dx / dl * L, ty = rim.y + dyv / dl * L, tz = rim.z + dz / dl * L;
    if (!this._handInit) { this.hand.p.set(tx, ty, tz); this.hand.v.set(0, 0, 0); this._handInit = true; }
    const hp = spring3(this.hand, tx, ty, tz, 16, dt);
    const sh = h.bonePosition('R_UpperArm', this.v4);
    const pole = this.v3.set(sh.x + rx * 0.5 - fx * 0.1, sh.y - 0.28, sh.z + rz * 0.5 - fz * 0.1);
    if (this.handW > 0.01 && !DBG.includes('noreach')) h.setReach('R', hp, { weight: clamp(this.handW, 0, 1), pole }); else h.setReach('R', null);
    const sx = hp.x - rim.x, sy = hp.y - rim.y, sz = hp.z - rim.z, sl = Math.hypot(sx, sy, sz) || 1;
    const ux = sx / sl, uy = sy / sl, uz = sz / sl;
    const ex = rim.x - ux * 0.02, ey = rim.y - uy * 0.02, ez = rim.z - uz * 0.02;
    const px = hp.x + ux * 0.1, py = hp.y + uy * 0.1, pz = hp.z + uz * 0.1;
    const len = Math.hypot(px - ex, py - ey, pz - ez);
    this.stick.position.set((ex + px) / 2, (ey + py) / 2, (ez + pz) / 2);
    this.stick.scale.set(1, len, 1);
    this.stick.quaternion.setFromUnitVectors(this.up, this.v3.set(px - ex, py - ey, pz - ez).normalize());
    this.stick.visible = this.handW > 0.2;
    {
      const gx = this.hoop.position.x, gy = this.hoop.position.y + R * 0.9, gz = this.hoop.position.z;
      if (!this._gazeInit) { this.gaze.p.set(gx, gy, gz); this._gazeInit = true; }
      const gp = spring3(this.gaze, gx, gy, gz, 5, dt);
      this.gazeW += clamp((down && this.bounceT > 0.6 ? 0.3 : 0.5) - this.gazeW, -dt / 0.4, dt / 0.4);
      if (!DBG.includes('nolook')) h.lookAt({ x: gp.x, y: gp.y, z: gp.z }, { weight: this.gazeW, maxYaw: 0.8, maxPitch: 0.45 });
    }
    // ---- the dust of the hoop: a puff every half turn on a dirt lane, a spark on cobbles, splash when it crosses water
    if (!down && r.v > 1.3) {
      const half = Math.floor(r.spin / Math.PI);
      if (half !== this.lastSpin) {
        this.lastSpin = half;
        const sp = this.surf, k = clamp(r.v / 5, 0.4, 1.2), x = this.hoop.position.x, z = this.hoop.position.z, y = E.hoop.y + 0.03;
        if (sp === 'mud') this.fx.emit(x, y, z, 2, { size: 0.1, life: 0.5, r: 0.36, g: 0.26, b: 0.17, a: 0.8, up: 0.8 * k, speed: 0.4, grav: 5, grow: 0.3 });
        else if (sp === 'cobble') this.fx.emit(x, y, z, 1, { size: 0.06, life: 0.25, r: 1, g: 0.85, b: 0.5, a: 0.9, up: 0.5, speed: 0.3, grow: 0, drag: 3 });
        else if (sp !== 'plank') this.fx.emit(x, y, z, 1, { size: 0.14 * k, life: 0.6, r: 0.84, g: 0.74, b: 0.6, a: 0.36, speed: 0.15, up: 0.3, grow: 2.2, vx: -fwx * 0.4, vz: -fwz * 0.4 });
        E.onRoll && E.onRoll(sp, r.v);
      }
    }
    if (E.splash) this.fx.emit(this.hoop.position.x, E.hoop.y + 0.05, this.hoop.position.z, 14, { size: 0.09, life: 0.7, r: 0.8, g: 0.92, b: 1, a: 0.85, up: 2.2, speed: 0.9, grav: 7, grow: 0.2, spread: 0.3 });
    if (down && this.bounceT > 0.4 && this.bounceT < 1.3) {
      const cyc = Math.floor((this.bounceT - 0.4) * 8);
      if (cyc !== this._lastCl) { this._lastCl = cyc; E.onClatter && E.onClatter(clamp(1 - (this.bounceT - 0.4) / 0.9, 0, 1)); }
    } else this._lastCl = -1;
    // ---- cloth and ribbons
    const wind = { x: -fwx * this.vLP * 0.25, z: -fwz * this.vLP * 0.25 };
    if (this.cloth) { this.cloth.mesh.visible = true; this.cloth.update(h, dt, this.yaw.p, this.vLP, this.t); }
    for (const c of this.chains) { c.mesh.visible = true; c.update(h, dt, wind, this.vLP, this.t); }
  }
}

// ---- the skirt and pinafore: rings (waist, two between, hem). The hem is on lagging springs so it swings out behind the runner, bells with the
// hip sway and settles when she stops. Vertex colours give a white apron front over the dress, the hem a trim band.
class Cloth {
  constructor(THREE, scene, o) {
    this.T = THREE; this.N = 22; this.o = o;
    const N = this.N, rings = 4;
    this.pos = new Float32Array(N * rings * 3);
    const col = new Float32Array(N * rings * 3);
    const dress = new THREE.Color(o.dress), apron = new THREE.Color(o.apron), trim = new THREE.Color(o.trim);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU, front = Math.cos(a) > 0.3;
      for (let k = 0; k < rings; k++) {
        const c = k === rings - 1 ? trim : front && k > 0 ? apron : dress;
        const f = k === 0 ? 0.9 : 1 - k * 0.04; col.set([c.r * f, c.g * f, c.b * f], (k * N + i) * 3);
      }
    }
    const idx = [];
    for (let k = 0; k < rings - 1; k++) for (let i = 0; i < N; i++) { const a = k * N + i, b = k * N + (i + 1) % N, c = (k + 1) * N + i, d = (k + 1) * N + (i + 1) % N; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; this.mesh.castShadow = true; scene.add(this.mesh);
    this.hem = Array.from({ length: N }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }));
    this.init = false; this.tmp = new THREE.Vector3(); this.q = new THREE.Quaternion(); this.eu = new THREE.Euler();
  }
  update(h, dt, yaw, speed, t) {
    const N = this.N, o = this.o, P = this.pos;
    const pel = h.bones.Bip01_Pelvis;
    h.root.updateMatrixWorld(true);
    const pv = pel.getWorldPosition(this.tmp), pq = pel.getWorldQuaternion(this.q);
    const cx = pv.x, cy = pv.y + 0.07 * SCALE, cz = pv.z;
    const fwx = Math.sin(yaw), fwz = Math.cos(yaw);
    const sway = clamp(speed / 5, 0, 1);
    const eu = this.eu.setFromQuaternion(pq, 'YXZ');
    const roll = clamp(eu.z, -0.4, 0.4), pitch = clamp(eu.x, -0.4, 0.4);
    const dtc = Math.min(dt, 1 / 30);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      // body frame: front (a = 0) along the child's forward, sa toward the child's left
      const wx = ca * fwx + sa * fwz, wz = ca * fwz - sa * fwx;
      const rw = o.rWaist, hemR = o.rHem * (1 + 0.16 * sway);
      P[i * 3] = cx + wx * rw; P[i * 3 + 1] = cy; P[i * 3 + 2] = cz + wz * rw;
      const back = 0.5 + 0.5 * Math.max(0, -ca + 0.3);
      const drag = (0.04 + 0.16 * sway) * back;
      const flutter = Math.sin(t * (9 + speed * 1.3) + i * 1.9) * 0.014 * (0.3 + sway);
      const lift = Math.max(0, -ca) * 0.09 * sway + Math.sin(t * 7.3 + i) * 0.008 * sway;
      const tx = cx + wx * hemR - fwx * drag + flutter * fwz;
      const tz = cz + wz * hemR - fwz * drag - flutter * fwx;
      const ty = cy - o.len * (1 - 0.12 * sway) + lift - sa * roll * 0.22 + ca * pitch * 0.18;
      const H = this.hem[i];
      if (!this.init) { H.x = tx; H.y = ty; H.z = tz; H.vx = H.vy = H.vz = 0; }
      const w = 13, z = 0.45, k = w * w, c = 2 * z * w;          // underdamped spring: the hem lags, overshoots, settles
      H.vx += (k * (tx - H.x) - c * H.vx) * dtc; H.vy += (k * (ty - H.y) - c * H.vy) * dtc; H.vz += (k * (tz - H.z) - c * H.vz) * dtc;
      H.x += H.vx * dtc; H.y += H.vy * dtc; H.z += H.vz * dtc;
      const ddx = H.x - cx, ddy = H.y - cy, ddz = H.z - cz, dl = Math.hypot(ddx, ddy, ddz), maxL = o.len + o.rHem * 0.9;
      if (dl > maxL) { const s = maxL / dl; H.x = cx + ddx * s; H.y = cy + ddy * s; H.z = cz + ddz * s; }
      for (let k2 = 1; k2 < 4; k2++) {
        const u = k2 / 3, bell = Math.sin(u * Math.PI * 0.5), rr = rw + (hemR - rw) * bell;
        const j = (k2 * N + i) * 3;
        P[j] = cx + wx * rr + (H.x - (cx + wx * hemR)) * u * u;
        P[j + 1] = cy + (H.y - cy) * u;
        P[j + 2] = cz + wz * rr + (H.z - (cz + wz * hemR)) * u * u;
      }
    }
    this.init = true;
    this.geo.attributes.position.needsUpdate = true; this.geo.computeVertexNormals();
  }
  dispose() { this.geo.dispose(); this.mesh.material.dispose(); }
}

// ---- a hair ribbon / scarf tail: a short chain that trails behind its anchor with drag and flutter
class Chain {
  constructor(THREE, scene, o) {
    this.T = THREE; this.o = o; this.n = o.n;
    this.pts = Array.from({ length: o.n }, () => new THREE.Vector3());
    this.init = false;
    this.pos = new Float32Array(o.n * 2 * 3);
    const idx = [];
    for (let i = 0; i < o.n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setIndex(idx);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: o.color, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; scene.add(this.mesh);
    this.tmp = new THREE.Vector3(); this.tmp2 = new THREE.Vector3(); this.q = new THREE.Quaternion();
  }
  update(h, dt, wind, speed, t) {
    const o = this.o, n = this.n, P = this.pts;
    const bone = o.anchor === 'neck' ? (h.bones.Bip01_Neck || h.bones.Bip01_Head) : h.bones.Bip01_Head;
    bone.updateWorldMatrix(true, false);
    const q = bone.getWorldQuaternion(this.q);
    const a = this.tmp.set(o.off[0], o.off[1], o.off[2]).applyQuaternion(q).add(bone.getWorldPosition(this.tmp2));
    if (!this.init) { for (let i = 0; i < n; i++) P[i].copy(a); this.init = true; }
    P[0].copy(a);
    const dtc = Math.min(dt, 1 / 30);
    for (let i = 1; i < n; i++) {
      const p = P[i], pr = P[i - 1];
      p.y -= 0.5 * dtc;
      p.x += (wind.x * 2.4 + Math.sin(t * 11 + i * 1.7) * 0.05 * (0.3 + speed * 0.15)) * dtc;
      p.z += (wind.z * 2.4 + Math.cos(t * 9 + i * 1.3) * 0.05 * (0.3 + speed * 0.15)) * dtc;
      const dx = p.x - pr.x, dy = p.y - pr.y, dz = p.z - pr.z, dl = Math.hypot(dx, dy, dz) || 1e-4;
      p.set(pr.x + dx / dl * o.seg, pr.y + dy / dl * o.seg, pr.z + dz / dl * o.seg);
    }
    for (let i = 0; i < n; i++) {
      const prev = P[Math.max(0, i - 1)], next = P[Math.min(n - 1, i + 1)];
      let sx = next.z - prev.z, sz = -(next.x - prev.x); const sl = Math.hypot(sx, sz) || 1; sx /= sl; sz /= sl;
      const w = o.w * (1 - (i / n) * 0.3) * 0.5;
      this.pos.set([P[i].x - sx * w, P[i].y, P[i].z - sz * w, P[i].x + sx * w, P[i].y, P[i].z + sz * w], i * 6);
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.computeVertexNormals();
  }
  dispose() { this.geo.dispose(); this.mesh.material.dispose(); }
}
void T3;

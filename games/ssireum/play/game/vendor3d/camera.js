// Camera rig with deterministic exponential smoothing. update(dt) only; no wall clock.
import * as THREE from './three.js';

const xyz = (t) => (t && t.root ? t.root.position : t && t.position ? t.position : t);

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'follow';
    this.o = { target: null, distance: 5, height: 1.6, side: 0, lookHeight: 0.95, azimuth: 0, elevation: 0.3, yaw: null, lead: 0, fov: null };
    this.pos = camera.position.clone();
    this.look = new THREE.Vector3(0, 1, 0);
    this.posSmooth = 0.12; // seconds-ish time constant (smaller = snappier)
    this.lookSmooth = 0.08;
    this.shakeAmp = 0; this.shakeT = 0; this._shakeSeed = 0;
    this._snap = true;
  }

  _set(mode, o) { this.mode = mode; Object.assign(this.o, o); return this; }

  /** Chase camera behind-and-beside the target; direction follows the target facing unless `yaw` is fixed. */
  follow(target, o = {}) { return this._set('follow', { target, distance: 5, height: 1.6, side: -2.4, lookHeight: 0.95, ...o }); }

  /** Pure side-on view (long axis = `axis` direction, default +Z). Camera sits to the -X side of the target. */
  side(target, o = {}) { return this._set('side', { target, distance: 4.2, height: 1.1, lookHeight: 0.95, ...o }); }

  /** Straight behind the target's facing, e.g. batter's-eye or runner view. */
  behind(target, o = {}) { return this._set('behind', { target, distance: 4, height: 1.7, lookHeight: 1.0, ...o }); }

  /** Orbit around a point/target: azimuth/elevation in radians, radius metres. */
  orbit(target, o = {}) { return this._set('orbit', { target, distance: 4, azimuth: 0.6, elevation: 0.25, lookHeight: 1.0, ...o }); }

  /** Fixed pose. */
  fixed(position, lookAt) { this.mode = 'fixed'; this.pos.set(position.x, position.y, position.z); this.look.set(lookAt.x, lookAt.y, lookAt.z); this._snap = true; return this; }

  setFov(f) { this.o.fov = f; return this; }

  snap() { this._snap = true; }

  shake(amount = 0.05, duration = 0.3) { this.shakeAmp = amount; this.shakeT = duration; this.shakeDur = duration; }

  update(dt) {
    const o = this.o;
    const want = new THREE.Vector3();
    const wantLook = new THREE.Vector3();
    if (this.mode !== 'fixed' && o.target) {
      const p = xyz(o.target);
      const yaw = o.yaw !== null && o.yaw !== undefined ? o.yaw : (o.target.facing ?? 0);
      const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
      switch (this.mode) {
        case 'follow': want.copy(p).addScaledVector(fwd, -o.distance).addScaledVector(right, -o.side).setY(p.y + o.height); break;
        case 'side': want.copy(p).addScaledVector(right, -o.distance).setY(p.y + o.height); break;
        case 'behind': want.copy(p).addScaledVector(fwd, -o.distance).setY(p.y + o.height); break;
        case 'orbit': { const a = o.azimuth, e = o.elevation; want.set(p.x + Math.sin(a) * Math.cos(e) * o.distance, p.y + o.lookHeight + Math.sin(e) * o.distance, p.z + Math.cos(a) * Math.cos(e) * o.distance); break; }
        default: break;
      }
      wantLook.set(p.x, p.y + o.lookHeight, p.z).addScaledVector(fwd, o.lead);
    } else { want.copy(this.pos); wantLook.copy(this.look); }
    if (this._snap) { this.pos.copy(want); this.look.copy(wantLook); this._snap = false; } else if (this.mode !== 'fixed') {
      const kp = 1 - Math.exp(-dt / Math.max(1e-3, this.posSmooth));
      const kl = 1 - Math.exp(-dt / Math.max(1e-3, this.lookSmooth));
      this.pos.lerp(want, kp); this.look.lerp(wantLook, kl);
    }
    this.camera.position.copy(this.pos);
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      const k = this.shakeAmp * (this.shakeT / (this.shakeDur || 1));
      this._shakeSeed = (this._shakeSeed * 1664525 + 1013904223) >>> 0;
      const r = (this._shakeSeed / 4294967296 - 0.5) * 2;
      this.camera.position.x += r * k; this.camera.position.y += -r * k * 0.7;
    }
    this.camera.lookAt(this.look);
    if (o.fov && this.camera.fov !== o.fov) { this.camera.fov = o.fov; this.camera.updateProjectionMatrix(); }
  }
}

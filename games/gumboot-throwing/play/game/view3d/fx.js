// Effects and the boot's landing physics: mud flecks and clods, grass blades, dust puffs, a divot decal, the landing flag with the distance on it,
// pegs for the earlier throws, and a small rigid body that makes the boot bounce, flop and settle (visual only; the sim already decided where
// it first touched). Everything advances by the dt it is handed (the game clock), so a paused game freezes it.
import { BOOT_COM } from './boot.js';

const TAU = Math.PI * 2;
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// contact points on the boot (local, rim-centre origin): rim ring, shaft, toe, heel, sole corners
export const CONTACTS = (() => {
  const p = [];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; p.push([Math.cos(a) * 0.082, 0.0, Math.sin(a) * 0.078]); }
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; p.push([Math.cos(a) * 0.06, -0.17, Math.sin(a) * 0.058]); }
  p.push([0.29, -0.305, 0], [0.22, -0.34, 0.06], [0.22, -0.34, -0.06], [0.05, -0.348, 0.058], [0.05, -0.348, -0.058], [-0.045, -0.345, 0.05], [-0.045, -0.345, -0.05], [0.14, -0.35, 0.06], [0.14, -0.35, -0.06]);
  return p;
})();

export function makeFx(THREE, scene, { puff, quality = 'high' } = {}) {
  const lo = quality === 'low';
  const FX = {};
  // ---- flecks and clods (instanced boxes) ---------------------------------------------------------------------------------------------
  const N = lo ? 70 : 180;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, color: 0xffffff });
  const inst = new THREE.InstancedMesh(geo, mat, N); inst.frustumCulled = false; inst.castShadow = false; scene.add(inst);
  const P = Array.from({ length: N }, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0.03, life: 0, age: 0, rx: 0, ry: 0, rz: 0, ax: 0, ay: 0, az: 0, kind: 0 }));
  const col = new THREE.Color(), dummy = new THREE.Object3D();
  let head = 0;
  const KIND = [[0x4b3522, 0x6b4a2c, 0x3a2a18], [0x5fa03a, 0x7cbc48, 0x3f7a2a], [0x8a6e44, 0xa88a5a, 0x6e5836]];   // mud, grass, dry earth
  FX.spray = (kind, x, y, z, vx, vy, vz, count, size = 0.03, life = 1.1, seed = 0) => {
    for (let i = 0; i < count; i++) {
      const p = P[head]; head = (head + 1) % N;
      const h1 = hash(seed * 13.1 + i * 7.7 + head), h2 = hash(seed * 5.3 + i * 3.1 + 1), h3 = hash(seed * 2.9 + i * 11.3 + 2);
      p.on = true; p.kind = kind; p.x = x + (h1 - 0.5) * 0.08; p.y = Math.max(0.02, y); p.z = z + (h2 - 0.5) * 0.08;
      const sp = 0.6 + h3 * 1.4;
      p.vx = vx + (h1 - 0.5) * 2 * sp; p.vy = vy + h2 * 1.6 * sp; p.vz = vz + (h3 - 0.5) * 2 * sp;
      p.s = size * (0.6 + h2 * 0.9); p.life = life * (0.7 + h3 * 0.6); p.age = 0;
      p.rx = h1 * 6; p.ry = h2 * 6; p.rz = h3 * 6; p.ax = (h2 - 0.5) * 14; p.ay = (h3 - 0.5) * 14; p.az = (h1 - 0.5) * 14;
      const pal = KIND[kind]; p._c = pal[Math.floor(h1 * pal.length) % pal.length];
    }
  };
  // ---- dust / splash puffs (sprites) ----------------------------------------------------------------------------------------------------
  const sprites = [];
  const NS = lo ? 8 : 18;
  for (let i = 0; i < NS; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, opacity: 0, color: 0xd6c8a6 }));
    s.visible = false; scene.add(s); sprites.push({ s, on: false, age: 0, life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, size: 0.3, grow: 1 });
  }
  let sh = 0;
  FX.puff = (x, y, z, vx, vy, size = 0.5, life = 0.9, color = 0xd6c8a6, grow = 2.2, opacity = 0.55) => {
    const q = sprites[sh]; sh = (sh + 1) % NS;
    q.on = true; q.age = 0; q.life = life; q.x = x; q.y = y; q.z = z; q.vx = vx; q.vy = vy; q.size = size; q.grow = grow; q.op = opacity; q.s.material.color.set(color); q.s.visible = true;
  };
  // ---- the divot where the boot first hit ----------------------------------------------------------------------------------------------
  const divot = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(48,32,18,0.95)'); gr.addColorStop(0.5, 'rgba(70,48,26,0.7)'); gr.addColorStop(1, 'rgba(70,48,26,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 40; i++) { const a = hash(i) * TAU, r = 30 + hash(i + 9) * 30; g.fillStyle = 'rgba(40,26,14,0.7)'; g.beginPath(); g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 1 + hash(i + 3) * 3, 0, TAU); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 2; scene.add(m); return m;
  })();
  FX.setDivot = (x, z, size, show) => { divot.visible = show; divot.position.set(x, 0.01, z); divot.scale.set(size, size * 0.8, 1); };
  FX.clear = () => { for (const p of P) p.on = false; for (const q of sprites) { q.on = false; q.s.visible = false; } divot.visible = false; inst.count = 0; };

  FX.update = (dt) => {
    let n = 0;
    for (const p of P) {
      if (!p.on) continue;
      p.age += dt;
      if (p.age > p.life) { p.on = false; continue; }
      if (p.y > p.s * 0.5 + 0.005) {
        p.vy -= 9.81 * dt; p.vx *= 1 - 0.3 * dt; p.vz *= 1 - 0.3 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.rx += p.ax * dt; p.ry += p.ay * dt; p.rz += p.az * dt;
        if (p.y < p.s * 0.5 + 0.005) { p.y = p.s * 0.5 + 0.005; p.vx = p.vy = p.vz = 0; }
      }
      dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.rx, p.ry, p.rz);
      const fade = p.age > p.life * 0.75 ? Math.max(0.0, (p.life - p.age) / (p.life * 0.25)) : 1;
      const sc = p.s * (p.kind === 1 ? 1 : 1) * (0.3 + 0.7 * fade);
      dummy.scale.set(sc * (p.kind === 1 ? 0.35 : 1), sc * (p.kind === 1 ? 1.6 : 1), sc * (p.kind === 1 ? 0.2 : 1));
      dummy.updateMatrix(); inst.setMatrixAt(n, dummy.matrix); col.set(p._c); inst.setColorAt(n, col); n++;
    }
    inst.count = n; inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    for (const q of sprites) {
      if (!q.on) continue;
      q.age += dt; const u = q.age / q.life;
      if (u >= 1) { q.on = false; q.s.visible = false; continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy *= 1 - 1.5 * dt; q.vx *= 1 - 1.8 * dt;
      q.s.position.set(q.x, q.y, q.z); const sz = q.size * (1 + q.grow * u); q.s.scale.set(sz, sz, 1);
      q.s.material.opacity = (q.op ?? 0.55) * (1 - u) * Math.min(1, u * 8 + 0.2);
    }
  };
  FX.dispose = () => { scene.remove(inst); };
  FX.inst = inst;
  return FX;
}

// ---- the boot's landing rigid body --------------------------------------------------------------------------------------------------------
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qrot = (q, v) => {
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
};
const qnorm = (q) => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };
export const qFromEuler = (x, y, z) => {   // XYZ order
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2), s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3];
};

/** A boot as a rigid body about its centre of mass. Position = the COM; the origin of the local frame is the rim centre (BOOT_COM below it). */
export class BootBody {
  constructor() { this.reset(); }
  reset() {
    this.p = [0, 0, 0]; this.v = [0, 0, 0]; this.q = [0, 0, 0, 1]; this.w = [0, 0, 0];
    this.asleep = false; this.hits = 0; this.lastImpact = 0; this.t = 0; this.impacts = [];
  }
  /** Lowest contact point height for a pose (to keep it above the ground in flight). */
  static lowest(com, q) {
    let low = 1e9;
    for (const c of CONTACTS) { const r = qrot(q, [c[0] - BOOT_COM[0], c[1] - BOOT_COM[1], c[2] - BOOT_COM[2]]); low = Math.min(low, com[1] + r[1]); }
    return low;
  }
  step(dt) {
    if (this.asleep) return;
    const h = 1 / 240, n = Math.max(1, Math.round(dt / h)), hh = dt / n;
    const k2 = 0.085 * 0.085 * 1.5, e = 0.2, mu = 0.75;     // radius of gyration squared (about 17 cm), restitution in mud, friction
    for (let s = 0; s < n; s++) {
      this.v[1] -= 9.81 * hh;
      this.p[0] += this.v[0] * hh; this.p[1] += this.v[1] * hh; this.p[2] += this.v[2] * hh;
      const wq = [this.w[0] * hh * 0.5, this.w[1] * hh * 0.5, this.w[2] * hh * 0.5, 0];
      const dq = qmul(wq, this.q);
      this.q = qnorm([this.q[0] + dq[0], this.q[1] + dq[1], this.q[2] + dq[2], this.q[3] + dq[3]]);
      let deepest = 0;
      for (let it = 0; it < 2; it++) for (const c of CONTACTS) {
        const r = qrot(this.q, [c[0] - BOOT_COM[0], c[1] - BOOT_COM[1], c[2] - BOOT_COM[2]]);
        const py = this.p[1] + r[1];
        if (py >= 0) continue;
        deepest = Math.min(deepest, py);
        // velocity of the point
        const vx = this.v[0] + (this.w[1] * r[2] - this.w[2] * r[1]);
        const vy = this.v[1] + (this.w[2] * r[0] - this.w[0] * r[2]);
        const vz = this.v[2] + (this.w[0] * r[1] - this.w[1] * r[0]);
        if (vy < 0) {
          // effective inverse mass along the normal (0,1,0): 1 + |r x n|^2 / k2   (mass = 1)
          const rxn = [r[1] * 0 - r[2] * 1, r[2] * 0 - r[0] * 0, r[0] * 1 - r[1] * 0];   // r x (0,1,0) = (-rz, 0, rx)
          const meff = 1 / (1 + (rxn[0] * rxn[0] + rxn[2] * rxn[2]) / k2);
          const rest = -vy > 1.2 ? e : 0.0;
          const j = -(1 + rest) * vy * meff;
          this.v[1] += j;
          // angular impulse: w += (r x J) / (m k2)
          this.w[0] += (r[1] * 0 - r[2] * j) / k2; this.w[2] += (r[0] * j - r[1] * 0) / k2;
          // friction on the tangential velocity
          const tx = vx, tz = vz, tl = Math.hypot(tx, tz);
          if (tl > 1e-5) {
            const jt = Math.min(mu * j, tl * meff * 0.8);
            const ux = -tx / tl, uz = -tz / tl;
            this.v[0] += ux * jt; this.v[2] += uz * jt;
            this.w[0] += (r[1] * uz * jt - r[2] * 0) / k2; this.w[1] += (r[2] * ux * jt - r[0] * uz * jt) / k2; this.w[2] += (r[0] * 0 - r[1] * ux * jt) / k2;
          }
          if (-vy > 0.8) { this.impacts.push({ x: this.p[0] + r[0], y: 0, z: this.p[2] + r[2], v: -vy, vx, vz, t: this.t }); this.hits++; }
        }
      }
      if (deepest < 0) this.p[1] += -deepest * 0.6;
      // mud drag and damping
      const damp = this.p[1] < 0.35 ? 0.9 : 0.999;
      this.w[0] *= damp ** hh * 1; this.w[1] *= damp ** hh; this.w[2] *= damp ** hh;
      if (this.p[1] < 0.3) { this.v[0] *= 1 - 0.8 * hh; this.v[2] *= 1 - 0.8 * hh; }
      this.t += hh;
    }
    const sp = Math.hypot(this.v[0], this.v[1], this.v[2]), wl = Math.hypot(this.w[0], this.w[1], this.w[2]);
    if (this.hits > 0 && sp < 0.06 && wl < 0.35) { this.asleep = true; this.v = [0, 0, 0]; this.w = [0, 0, 0]; }
  }
}

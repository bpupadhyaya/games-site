// Small verlet cloth for the langot (waist cloth): a front apron, a back panel and two knot tails hang from the belt, swing with the body, fall toward
// the head when the wrestler is upside down and are kept off the legs and trunk by capsule colliders. World space, metres. Presentation only.
import { THREE } from '../vendor3d/index.js';

const { Vector3, BufferGeometry, Float32BufferAttribute, Mesh } = THREE;

export class Cloth {
  /**
   * cols x rows grid; row 0 is pinned to `anchors` (cols Object3D / functions returning a world Vector3 into the target).
   * width/length in metres at rest.
   */
  constructor({ cols, rows, width, length, anchors, material, taper = 1, mass = 1 }) {
    this.cols = cols; this.rows = rows; this.anchors = anchors; this.n = cols * rows;
    this.p = new Float32Array(this.n * 3); this.o = new Float32Array(this.n * 3);
    this.dx = cols > 1 ? width / (cols - 1) : 0; this.dy = rows > 1 ? length / (rows - 1) : 0;
    this.taper = taper; this.mass = mass;
    this.cons = [];
    const id = (c, r) => r * cols + c;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const w = taper < 1 ? 1 - (1 - taper) * (r / Math.max(1, rows - 1)) : 1;
      if (c + 1 < cols) this.cons.push([id(c, r), id(c + 1, r), this.dx * w, 0.9]);
      if (r + 1 < rows) this.cons.push([id(c, r), id(c, r + 1), this.dy, 1]);
      if (c + 1 < cols && r + 1 < rows) { const d = Math.hypot(this.dx * w, this.dy); this.cons.push([id(c, r), id(c + 1, r + 1), d, 0.5], [id(c + 1, r), id(c, r + 1), d, 0.5]); }
    }
    const pos = new Float32Array(this.n * 3), uv = new Float32Array(this.n * 2), idx = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { uv[id(c, r) * 2] = cols > 1 ? c / (cols - 1) : 0.5; uv[id(c, r) * 2 + 1] = 1 - r / Math.max(1, rows - 1); }
    for (let r = 0; r + 1 < rows; r++) for (let c = 0; c + 1 < cols; c++) { const a = id(c, r), b = id(c + 1, r), d = id(c, r + 1), e = id(c + 1, r + 1); idx.push(a, d, b, b, d, e); }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    this.geo = g;
    this.mesh = new Mesh(g, material); this.mesh.frustumCulled = false; this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this._a = new Vector3(); this.ready = false;
  }

  _readAnchors(out) { for (let c = 0; c < this.cols; c++) { const a = this.anchors[c](this._a); out[c * 3] = a.x; out[c * 3 + 1] = a.y; out[c * 3 + 2] = a.z; } }

  reset(gravity) {
    const a = new Float32Array(this.cols * 3); this._readAnchors(a);
    const g = gravity.clone().normalize();
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const i = (r * this.cols + c) * 3;
      this.p[i] = a[c * 3] + g.x * this.dy * r; this.p[i + 1] = a[c * 3 + 1] + g.y * this.dy * r; this.p[i + 2] = a[c * 3 + 2] + g.z * this.dy * r;
    }
    this.o.set(this.p); this.ready = true;
  }

  /**
   * dt seconds, gravity Vector3 (m/s^2), colliders: [{ a: Vector3, b: Vector3, r }] capsules, wind: Vector3 acceleration (m/s^2).
   */
  step(dt, gravity, colliders, wind) {
    if (!this.ready) this.reset(gravity);
    const sub = dt > 1 / 90 ? 2 : 1, h = dt / sub;
    const anch = new Float32Array(this.cols * 3);
    const p = this.p, o = this.o, cols = this.cols;
    const d = new Vector3(), q = new Vector3(), ab = new Vector3(), ap = new Vector3();
    for (let s = 0; s < sub; s++) {
      this._readAnchors(anch);
      const damp = Math.pow(0.992, h * 60) ;
      for (let i = cols; i < this.n; i++) {
        const k = i * 3, r = Math.floor(i / cols), cc = i % cols, lw = (0.7 + 0.5 * (r / this.rows)) * (1 + 0.6 * Math.sin(cc * 2.1 + r * 0.9 + (this._t = (this._t || 0) + 0.00015)));        // lower rows are lighter-airy: a little more wind
        const vx = (p[k] - o[k]) * damp, vy = (p[k + 1] - o[k + 1]) * damp, vz = (p[k + 2] - o[k + 2]) * damp;
        o[k] = p[k]; o[k + 1] = p[k + 1]; o[k + 2] = p[k + 2];
        p[k] += vx + (gravity.x * this.mass + wind.x * lw) * h * h; p[k + 1] += vy + (gravity.y * this.mass + wind.y * lw) * h * h; p[k + 2] += vz + (gravity.z * this.mass + wind.z * lw) * h * h;
      }
      for (let c = 0; c < cols; c++) { o[c * 3] = p[c * 3]; o[c * 3 + 1] = p[c * 3 + 1]; o[c * 3 + 2] = p[c * 3 + 2]; p[c * 3] = anch[c * 3]; p[c * 3 + 1] = anch[c * 3 + 1]; p[c * 3 + 2] = anch[c * 3 + 2]; }
      for (let it = 0; it < 5; it++) {
        for (const [a, b, len, st] of this.cons) {
          const ia = a * 3, ib = b * 3;
          const x = p[ib] - p[ia], z = p[ib + 2] - p[ia + 2];
          const yy = p[ib + 1] - p[ia + 1];
          const dist = Math.hypot(x, yy, z) || 1e-6, diff = (dist - len) / dist * 0.5 * st;
          const wa = a < cols ? 0 : 1, wb = b < cols ? 0 : 1, ws = wa + wb || 1;
          const fa = (wa / ws) * 2, fb = (wb / ws) * 2;
          p[ia] += x * diff * fa; p[ia + 1] += yy * diff * fa; p[ia + 2] += z * diff * fa;
          p[ib] -= x * diff * fb; p[ib + 1] -= yy * diff * fb; p[ib + 2] -= z * diff * fb;
        }
        // body colliders
        for (let i = cols; i < this.n; i++) {
          const k = i * 3; q.set(p[k], p[k + 1], p[k + 2]);
          for (const cl of colliders) {
            ab.copy(cl.b).sub(cl.a); const l2 = ab.lengthSq() || 1e-6;
            const t = Math.max(0, Math.min(1, ap.copy(q).sub(cl.a).dot(ab) / l2));
            d.copy(cl.a).addScaledVector(ab, t);
            const dv = q.clone().sub(d), dl = dv.length();
            const rr = cl.r + 0.012;
            if (dl < rr) { if (dl < 1e-5) dv.set(0, 0, 1); else dv.divideScalar(dl); q.copy(d).addScaledVector(dv, rr); }
          }
          p[k] = q.x; p[k + 1] = q.y; p[k + 2] = q.z;
        }
      }
    }
    const pos = this.geo.attributes.position; pos.array.set(p); pos.needsUpdate = true;
    this.geo.computeVertexNormals(); this.geo.computeBoundingSphere();
  }
}

// Cloth for the dancer: a wrap skirt (ring of verlet chains with thigh collision) and ribbon tails (sash, headband). Presentation only.
// Anchors are Object3Ds parented to the skeleton at rest, so the cloth follows the body exactly; everything below the anchors is simulated
// with damped verlet chains in WORLD space (so the hem lags, swings and flares as the body moves, and billows in a gust).
import * as THREE from '../vendor3d/three.js';
import { clothTexture } from './fx.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function anchorOn(bone, worldPoint) {
  const o = new THREE.Object3D();
  o.position.copy(bone.worldToLocal(worldPoint.clone()));
  bone.add(o);
  return o;
}

class Chain {
  constructor(n, seg, drag = 0.965) { this.n = n; this.seg = seg; this.drag = drag; this.p = Array.from({ length: n }, () => V()); this.q = Array.from({ length: n }, () => V()); this.init = false; }
  reset(a) { for (let i = 0; i < this.n; i++) { this.p[i].copy(a); this.q[i].copy(a); this.p[i].y -= this.seg * i; this.q[i].y -= this.seg * i; } this.init = true; }
}

export class Cloth {
  /**
   * human: view3d Human (rest pose applied, root at the origin facing +z, upright). Colors: hex strings.
   */
  constructor(human, { wrapColor = '#ff6a4d', trimColor = '#ffd873', sashColor = '#ffd873', bandColor = '#ffd873' } = {}) {
    this.h = human;
    const b = human.bones;
    human._applyRest(); human.root.updateMatrixWorld(true);
    const pel = b.Bip01_Pelvis.getWorldPosition(V());
    const tex = clothTexture();
    this.mats = {
      wrap: new THREE.MeshStandardMaterial({ map: tex, color: wrapColor, roughness: 0.78, side: THREE.DoubleSide }),
      trim: new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.7, side: THREE.DoubleSide }),
      sash: new THREE.MeshStandardMaterial({ color: sashColor, roughness: 0.7, side: THREE.DoubleSide }),
      band: new THREE.MeshStandardMaterial({ color: bandColor, roughness: 0.7, side: THREE.DoubleSide }),
    };
    this.group = new THREE.Group(); this.group.frustumCulled = false;

    // ---- wrap skirt
    this.COLS = 18; this.ROWS = 5; this.LEN = 0.30;
    this.skirt = [];
    this.anch = [];
    for (let i = 0; i < this.COLS; i++) {
      const a = (i / this.COLS) * Math.PI * 2;
      const wp = pel.clone().add(V(Math.cos(a) * 0.225, 0.075, Math.sin(a) * 0.165));
      this.anch.push(anchorOn(b.Bip01_Pelvis, wp));
      const c = new Chain(this.ROWS, this.LEN / (this.ROWS - 1), 0.955); this.skirt.push(c);
    }
    const g = new THREE.BufferGeometry();
    const n = (this.COLS + 1) * this.ROWS;
    this.skPos = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2), idx = [];
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c <= this.COLS; c++) { uv[(r * (this.COLS + 1) + c) * 2] = c / this.COLS * 2; uv[(r * (this.COLS + 1) + c) * 2 + 1] = 1 - r / (this.ROWS - 1); }
    for (let r = 0; r < this.ROWS - 1; r++) for (let c = 0; c < this.COLS; c++) { const a = r * (this.COLS + 1) + c, d = a + this.COLS + 1; idx.push(a, d, a + 1, d, d + 1, a + 1); }
    g.setAttribute('position', new THREE.BufferAttribute(this.skPos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    this.skMesh = new THREE.Mesh(g, this.mats.wrap); this.skMesh.frustumCulled = false; this.skMesh.castShadow = true;
    this.group.add(this.skMesh);
    // a trim band at the waist
    this.waist = new THREE.Mesh(new THREE.TorusGeometry(1, 0.016, 6, 24), this.mats.trim); this.waist.scale.set(0.185, 0.135, 1); this.waist.rotation.x = Math.PI / 2;
    this.waistAnchor = anchorOn(b.Bip01_Pelvis, pel.clone().add(V(0, 0.085, 0)));
    // ---- sash tails (knot on the left hip)
    this.tails = [];
    for (const [k, off] of [[0, V(0.17, 0.07, -0.02)], [1, V(0.17, 0.05, 0.03)]]) {
      const anc = anchorOn(b.Bip01_Pelvis, pel.clone().add(off));
      this.tails.push({ anc, chain: new Chain(7, 0.045, 0.94), w: 0.045, mat: this.mats.sash, k });
    }
    // ---- headband tails
    const head = b.Bip01_Head, hp = head.getWorldPosition(V());
    for (const [k, off] of [[0, V(-0.02, 0.095, -0.098)], [1, V(0.025, 0.09, -0.1)]]) {
      const anc = anchorOn(head, hp.clone().add(off));
      this.tails.push({ anc, chain: new Chain(5, 0.05, 0.93), w: 0.014, mat: this.mats.band, k: 2 + k });
    }
    for (const t of this.tails) {
      const seg = t.chain.n - 1, ng = new THREE.BufferGeometry();
      t.pos = new Float32Array(t.chain.n * 2 * 3);
      const ix = [];
      for (let i = 0; i < seg; i++) { const a = i * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      ng.setAttribute('position', new THREE.BufferAttribute(t.pos, 3)); ng.setIndex(ix);
      t.mesh = new THREE.Mesh(ng, t.mat); t.mesh.frustumCulled = false; this.group.add(t.mesh);
    }
    this.legA = [b.Bip01_L_Thigh, b.Bip01_R_Thigh]; this.legB = [b.Bip01_L_Calf, b.Bip01_R_Calf];
    this.prevRoot = V(); this.vel = V();
    this._t = V(); this._a = V(); this._bb = V(); this._ab = V(); this.tint = {};
  }

  setColors({ wrap, trim, sash, band }) {
    if (wrap) this.mats.wrap.color.set(wrap);
    if (trim) { this.mats.trim.color.set(trim); }
    if (sash) this.mats.sash.color.set(sash);
    if (band) this.mats.band.color.set(band);
  }

  // push a point out of a capsule a-b with radius r
  _collide(p, a, b, r) {
    const ab = this._ab.copy(b).sub(a), l2 = ab.lengthSq() || 1e-6;
    let t = this._t.copy(p).sub(a).dot(ab) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const c = this._a.copy(a).addScaledVector(ab, t);
    const d = this._bb.copy(p).sub(c), dl = d.length();
    if (dl < r && dl > 1e-5) p.copy(c).addScaledVector(d, r / dl);
  }

  /** dt seconds; wind = world acceleration vector (m/s^2) for the gust; budget: 0 off, 1 full. */
  update(dt, wind = V()) {
    dt = Math.min(dt, 1 / 30);
    const h = this.h;
    h.root.updateMatrixWorld(true);
    const step = (ch, anchor, gravity, extra, rest) => {
      if (!ch.init) ch.reset(anchor);
      ch.p[0].copy(anchor); ch.q[0].copy(anchor);
      for (let i = 1; i < ch.n; i++) {
        const p = ch.p[i], q = ch.q[i];
        const vx = (p.x - q.x) * ch.drag, vy = (p.y - q.y) * ch.drag, vz = (p.z - q.z) * ch.drag;
        q.copy(p);
        p.x += vx + (extra.x) * dt * dt; p.y += vy - gravity * dt * dt + extra.y * dt * dt; p.z += vz + extra.z * dt * dt;
      }
      for (let it = 0; it < 2; it++) {
        for (let i = 1; i < ch.n; i++) {
          const a = ch.p[i - 1], b = ch.p[i];
          const d = this._t.copy(b).sub(a), l = d.length() || 1e-6;
          const k = (l - ch.seg * (rest || 1)) / l;
          if (i === 1) b.addScaledVector(d, -k); else { a.addScaledVector(d, k * 0.5); b.addScaledVector(d, -k * 0.5); }
        }
        ch.p[0].copy(anchor);
      }
    };
    const g = 9.0;
    // a teleport (new attempt, sprite pass): hang the cloth fresh instead of whipping it across the screen
    this.anch[0].getWorldPosition(this._a);
    if (this.skirt[0].init && this._a.distanceToSquared(this.skirt[0].p[0]) > 0.5) this.reset();
    const hips = [V(), V()], knees = [V(), V()];
    for (let i = 0; i < 2; i++) { this.legA[i].getWorldPosition(hips[i]); this.legB[i].getWorldPosition(knees[i]); }
    const ap = V();
    const ws = [];
    for (let c = 0; c < this.COLS; c++) {
      this.anch[c].getWorldPosition(ap);
      const ch = this.skirt[c];
      // a little outward flare from the waist so the hem opens like cloth with weight
      step(ch, ap.clone(), g, wind, 1.0);
      // the hem opens outward from the waist a little (cloth with weight), and ripples along the ring as it moves
      const cxz = Math.hypot(this.anch[c].position.x, this.anch[c].position.z) || 1;
      for (let r = 1; r < ch.n; r++) {
        const ex = Math.cos((c / this.COLS) * Math.PI * 2) * 0.0035 * r, ez = Math.sin((c / this.COLS) * Math.PI * 2) * 0.0035 * r;
        void cxz; ch.p[r].x += ex * (0.6 + 0.4 * Math.sin(c * 2.3 + r)); ch.p[r].z += ez * (0.6 + 0.4 * Math.sin(c * 2.3 + r));
        for (let L = 0; L < 2; L++) this._collide(ch.p[r], hips[L], knees[L], 0.125 + 0.016 * r);
        if (ch.p[r].y < 0.03) ch.p[r].y = 0.03;
      }
      ws.push(ch);
    }
    // neighbouring columns keep their spacing (the hem spreads rather than collapsing through the legs)
    for (let r = 1; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const a = ws[c].p[r], b = ws[(c + 1) % this.COLS].p[r];
        const d = this._t.copy(b).sub(a), l = d.length() || 1e-6;
        const want = 0.07 + 0.005 * r;
        if (l < want) { const k = (want - l) / l * 0.25; a.addScaledVector(d, -k); b.addScaledVector(d, k); }
        else if (l > want * 1.5) { const k = (l - want * 1.5) / l * 0.5; a.addScaledVector(d, k); b.addScaledVector(d, -k); }
      }
    }
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c <= this.COLS; c++) {
      const p = ws[c % this.COLS].p[r], o = (r * (this.COLS + 1) + c) * 3;
      this.skPos[o] = p.x; this.skPos[o + 1] = p.y; this.skPos[o + 2] = p.z;
    }
    this.skMesh.geometry.attributes.position.needsUpdate = true;
    this.skMesh.geometry.computeVertexNormals();
    // waist trim ring follows the pelvis anchor
    this.waistAnchor.getWorldPosition(this.waist.position); this.waistAnchor.getWorldQuaternion(this.waist.quaternion);
    this.waist.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)));
    // tails
    const side = V(), camSide = V(0, 0, 1);
    for (const t of this.tails) {
      t.anc.getWorldPosition(ap);
      step(t.chain, ap.clone(), 7.5, wind.clone().multiplyScalar(1.6), 1.0);
      for (let i = 0; i < t.chain.n; i++) {
        const p = t.chain.p[i], q = i < t.chain.n - 1 ? t.chain.p[i + 1] : p, pr = i > 0 ? t.chain.p[i - 1] : p;
        const tan = this._t.copy(q).sub(pr).normalize();
        side.crossVectors(tan, camSide); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize();
        const w = t.w * (1 - 0.35 * (i / (t.chain.n - 1)));
        t.pos[i * 6] = p.x - side.x * w; t.pos[i * 6 + 1] = p.y - side.y * w; t.pos[i * 6 + 2] = p.z - side.z * w;
        t.pos[i * 6 + 3] = p.x + side.x * w; t.pos[i * 6 + 4] = p.y + side.y * w; t.pos[i * 6 + 5] = p.z + side.z * w;
      }
      t.mesh.geometry.attributes.position.needsUpdate = true;
    }
  }

  /** after a teleport (round restart) drop the hanging state so the cloth does not whip across the screen */
  reset() { for (const c of this.skirt) c.init = false; for (const t of this.tails) t.chain.init = false; }
  dispose() { this.skMesh.geometry.dispose(); for (const t of this.tails) t.mesh.geometry.dispose(); }
}

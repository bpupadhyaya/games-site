// Mane, forelock and tail as strand cards (alpha-tested ribbons) on a lightweight verlet chain, simulated in the horse's own frame:
// the group's acceleration and turning arrive as pseudo-forces, so the hair lags, sways and whips on turns without any world coupling.
// Styles: 'loose' | 'long' | 'braided' | 'roached' (hogged). Quality: high = full cards + physics, medium = fewer cards, low = fewer cards, no physics.
import * as THREE from './three.js';

const STYLES = {
  loose:   { n: 64, len: [0.24, 0.44], width: 0.045, stiff: 0.22, grav: 0.55, drop: 0.09, upright: 0 },
  long:    { n: 72, len: [0.36, 0.58], width: 0.05, stiff: 0.15, grav: 0.7, drop: 0.10, upright: 0 },
  braided: { n: 24, len: [0.12, 0.16], width: 0.045, stiff: 0.7, grav: 0.2, drop: 0.045, upright: 0, braid: true },
  roached: { n: 44, len: [0.04, 0.065], width: 0.03, stiff: 1.0, grav: 0.0, drop: 0.0, upright: 1 },
};
let TEX = null;
function strandTexture() {
  if (TEX) return TEX;
  const W = 64, H = 128, d = new Uint8Array(W * H * 4);
  let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const col = Array.from({ length: W }, () => 0.55 + 0.45 * rnd());
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const half = 0.5 * (1 - 0.88 * Math.pow(v, 1.6));
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1) - 0.5;
      const edge = Math.abs(u) / Math.max(half, 0.015);
      const ragged = 0.05 * Math.sin(y * 0.5 + x * 0.9);
      const a = edge + ragged < 1 ? 255 : 0;
      const k = Math.round(255 * (0.7 + 0.3 * col[x]) * (1 - 0.25 * v));
      const i = (y * W + x) * 4; d[i] = k; d[i + 1] = k; d[i + 2] = k; d[i + 3] = a;
    }
  }
  TEX = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); TEX.needsUpdate = true;
  TEX.wrapS = TEX.wrapT = THREE.ClampToEdgeWrapping; TEX.magFilter = THREE.LinearFilter; TEX.minFilter = THREE.LinearFilter; TEX.generateMipmaps = false;
  return TEX;
}

const V3 = THREE.Vector3;
class Strand {
  constructor(bone, root, rest, o) {
    this.bone = bone; this.root = root; this.rest = rest;      // bone-local offsets (Vector3), rest[0] = root
    const n = rest.length;
    this.n = n; this.p = rest.map(() => new V3()); this.q = rest.map(() => new V3()); this.t = rest.map(() => new V3());
    this.len = []; for (let i = 1; i < n; i++) this.len.push(rest[i].distanceTo(rest[i - 1]));
    Object.assign(this, o);                                    // width, stiff, grav, normal (bone-local), tone
    this.init = false;
  }
}

export class HorseHair {
  constructor(horse, { style = 'loose', quality = 'high' } = {}) {
    this.horse = horse; this.quality = quality; this.style = style;
    this.group = new THREE.Group(); this.group.name = 'horseHair';
    this.strands = []; this.mesh = null; this.t = 0;
    this._m = new THREE.Matrix4(); this._inv = new THREE.Matrix4();
    this._crest = null;
    this.mat = new THREE.MeshStandardMaterial({ map: strandTexture(), alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.65, metalness: 0 });
    this._build();
  }
  setQuality(t) { this.quality = t; this._build(); }
  setStyle(s) { this.style = s; this._build(); }
  setColors(coat) { this.maneColor = new THREE.Color(coat.mane); this.tailColor = new THREE.Color(coat.mane); this._recolor(); }

  _crestPoints() {
    if (this._crest) return this._crest;
    const h = this.horse, body = h.meshes.find((m) => m.userData.cls === 'body');
    const pos = body.geometry.attributes.position;
    const bins = {}; const dz = 0.03;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (Math.abs(x) > 0.17 || z < 0.3 || z > 1.22 || y < 1.4 || y > 2.18) continue;
      const k = Math.round(z / dz);
      if (!bins[k] || y > bins[k].y) bins[k] = { y, z };
    }
    let pts = Object.values(bins).sort((a, b) => a.z - b.z);
    // quadratic least-squares fit through the upper envelope (the coarse mesh gives a noisy crest line)
    const fit = (P) => {
      const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], B = [0, 0, 0];
      for (const p of P) { const r = [1, p.z, p.z * p.z]; for (let i = 0; i < 3; i++) { B[i] += r[i] * p.y; for (let j = 0; j < 3; j++) A[i][j] += r[i] * r[j]; } }
      // solve 3x3 by Cramer
      const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
      const D = det(A); const out = [];
      for (let k = 0; k < 3; k++) { const M = A.map((row, i) => row.map((v, j) => (j === k ? B[i] : v))); out.push(det(M) / D); }
      return out;
    };
    if (pts.length > 5) {
      let c = fit(pts);
      for (let it = 0; it < 3; it++) { const keep = pts.filter((p) => p.y >= c[0] + c[1] * p.z + c[2] * p.z * p.z - 0.01); if (keep.length > 4) c = fit(keep); }
      pts = []; for (let z = 0.4; z <= 1.25; z += 0.05) pts.push({ z, y: c[0] + c[1] * z + c[2] * z * z });
    }
    this._crest = pts; return pts;
  }
  _crestAt(z) {
    const p = this._crestPoints();
    if (!p.length) return new V3(0, 1.8, z);
    let i = 0; while (i < p.length - 2 && p[i + 1].z < z) i++;
    const a = p[i], b = p[Math.min(p.length - 1, i + 1)], t = b.z === a.z ? 0 : Math.min(1, Math.max(0, (z - a.z) / (b.z - a.z)));
    return new V3(0, a.y + (b.y - a.y) * t, z);
  }

  _build() {
    const h = this.horse; const b = h.b; const R = h.rest;
    for (const s of this.strands) s.dead = true;
    this.strands = [];
    if (this.mesh) { this.group.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh = null; }
    const Q = { high: 1, medium: 0.62, low: 0.38 }[this.quality] || 1;
    const SEG = { high: 8, medium: 6, low: 4 }[this.quality] || 8;
    const st = STYLES[this.style] || STYLES.loose;
    const neckBones = [['Spine3', R['Spine3'].z], ['Neck1', R['Neck1'].z], ['Neck2', R['Neck2'].z], ['Neck3', R['Neck3'].z], ['Head', R['Head'].z]];
    const boneFor = (z) => { let name = 'Spine3'; for (const [n, bz] of neckBones) if (z >= bz - 0.0) name = n; return name; };
    const toLocal = (name, p) => p.clone().sub(R[name]);
    // ---- mane
    const n = Math.max(6, Math.round(st.n * Q));
    const z0 = 0.5, z1 = 1.2;
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), z = z1 - (z1 - z0) * u;
      const zj = z + (rnd() - 0.5) * 0.03;
      const c = this._crestAt(zj);
      const bn = boneFor(zj), bone = b[bn];
      const curlA = 0.012 + 0.03 * rnd(), curlP = rnd() * 6.28, offX = (rnd() - 0.5) * 0.02;
      const L = st.len[0] + (st.len[1] - st.len[0]) * Math.min(1, (0.35 + 0.35 * Math.sin(u * 3.1 + 0.4)) + 0.4 * rnd());
      const pts = [];
      for (let k = 0; k <= SEG; k++) {
        const t = k / SEG;
        if (st.upright) pts.push(new V3(0, c.y + 0.02 + 0.05 * t, z + 0.0));
        else pts.push(new V3(offX - 0.07 - (st.drop * 1.2 + 0.16) * Math.sqrt(t) - 0.03 * t - curlA * Math.sin(t * 5 + curlP) * t, c.y + 0.03 - L * t * 0.95, zj - 0.035 * t - curlA * 1.4 * Math.sin(t * 6 + curlP) * t));
      }
      const loc = pts.map((p) => toLocal(bn, p));
      const wd = st.width * (0.8 + 0.5 * rnd());
      this.strands.push(new Strand(bone, loc[0], loc, { kind: 'mane', width: wd, stiff: st.stiff, grav: st.grav, n0: new V3(1, 0, 0), braid: !!st.braid, seg: SEG }));
    }
    // ---- forelock (from the poll over the forehead)
    if (this.style !== 'roached') {
      const nf = Math.max(3, Math.round(9 * Q));
      for (let i = 0; i < nf; i++) {
        const sx = (i / Math.max(1, nf - 1) - 0.5) * 0.09;
        const root = new V3(sx, 2.17, 1.31);
        const pts = [];
        for (let k = 0; k <= SEG; k++) { const t = k / SEG; pts.push(new V3(sx * (1 + t), root.y - 0.02 - 0.2 * t, root.z + 0.06 * Math.sin(t * 2.4) + 0.03 * t)); }
        const loc = pts.map((p) => toLocal('Head', p));
        this.strands.push(new Strand(b['Head'], loc[0], loc, { kind: 'mane', width: 0.035, stiff: 0.25, grav: 0.5, n0: new V3(1, 0, 0), seg: SEG }));
      }
    }
    // ---- tail: a bundle of crossed strand cards, thick at the dock, converging then flaring at the tip
    {
      const nt = Math.max(10, Math.round(46 * Q));
      const root0 = R['Tail2'];
      for (let i = 0; i < nt; i++) {
        const a = rnd() * Math.PI, ang = rnd() * Math.PI * 2, rr = 0.05 * Math.sqrt(rnd());
        const ro = new V3(Math.cos(ang) * rr, Math.sin(ang) * rr * 0.6, Math.sin(ang) * rr * 0.8);
        const L = 0.7 + 0.32 * rnd(), flare = (rnd() - 0.5) * 0.16, wob = 0.015 + 0.03 * rnd(), ph = rnd() * 6.28;
        const SEGT = SEG + 2, pts = [];
        for (let k = 0; k <= SEGT; k++) {
          const t = k / SEGT;
          pts.push(new V3(root0.x + ro.x * (1 - 0.5 * t) + flare * t * t + wob * Math.sin(t * 5 + ph) * t, root0.y + ro.y - L * t * 0.98,
            root0.z - 0.06 + ro.z * (1 - 0.5 * t) - 0.17 * Math.sin(t * 1.4) + wob * Math.cos(t * 4 + ph) * t));
        }
        const loc = pts.map((p) => toLocal('Tail2', p));
        this.strands.push(new Strand(b['Tail2'], loc[0], loc, { kind: 'tail', width: 0.055 + 0.04 * rnd(), stiff: 0.1, grav: 1.0, n0: new V3(Math.cos(a), 0, Math.sin(a)), seg: SEGT }));
      }
    }
    // geometry
    let verts = 0; for (const s of this.strands) verts += s.n * 2;
    const geo = new THREE.BufferGeometry();
    this._pos = new Float32Array(verts * 3); this._nor = new Float32Array(verts * 3); this._col = new Float32Array(verts * 3);
    const uv = new Float32Array(verts * 2); const idx = [];
    let o = 0;
    for (const s of this.strands) {
      s.vo = o;
      for (let k = 0; k < s.n; k++) {
        const t = k / (s.n - 1);
        uv[(o + k * 2) * 2] = 0; uv[(o + k * 2) * 2 + 1] = 1 - t; uv[(o + k * 2 + 1) * 2] = 1; uv[(o + k * 2 + 1) * 2 + 1] = 1 - t;
        if (k < s.n - 1) { const a = o + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      o += s.n * 2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this._pos, 3).setUsage(35048));
    geo.setAttribute('normal', new THREE.BufferAttribute(this._nor, 3).setUsage(35048));
    geo.setAttribute('color', new THREE.BufferAttribute(this._col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.name = 'hair';
    this.group.add(this.mesh);
    if (this.maneColor) this._recolor();
    else { this.maneColor = new THREE.Color('#1b1310'); this.tailColor = this.maneColor.clone(); this._recolor(); }
    this.update(0, h);
  }
  _recolor() {
    if (!this.mesh) return;
    const c = new THREE.Color();
    for (const s of this.strands) {
      const base = s.kind === 'tail' ? this.tailColor : this.maneColor;
      for (let k = 0; k < s.n; k++) {
        const t = k / (s.n - 1);
        c.copy(base).multiplyScalar((0.7 + 0.5 * t) * (0.75 + 0.5 * ((s.vo * 0.618) % 1)));
        for (let j = 0; j < 2; j++) { const v = (s.vo + k * 2 + j) * 3; this._col[v] = c.r; this._col[v + 1] = c.g; this._col[v + 2] = c.b; }
      }
    }
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }

  update(dt, horse) {
    const h = this.horse; const root = h.root;
    this.t += dt;
    const physics = this.quality !== 'low' && dt > 0;
    const qInv = root.getWorldQuaternion(new THREE.Quaternion()).invert();
    const g = new V3(0, -9.8, 0).applyQuaternion(qInv);
    const acc = h.accelLocal;
    const inv = this._inv.copy(root.matrixWorld).invert();
    const M = this._m;
    const tmp = new V3(), tmp2 = new V3(), dir = new V3(), side = new V3(), nrm = new V3(), nl = new V3();
    const speed = h.v;
    const sub = physics ? Math.max(1, Math.min(3, Math.ceil(dt / 0.011))) : 1;
    const sdt = dt / sub;
    const lastBone = { b: null };
    for (const s of this.strands) {
      s.bone.updateMatrixWorld();
      M.multiplyMatrices(inv, s.bone.matrixWorld);                       // bone -> group-local (rest origin is bone's rest position: offsets are relative)
      // bone-local offsets are relative to the bone's REST position, the bone matrix already includes it: offset applies directly
      for (let i = 0; i < s.n; i++) s.t[i].copy(s.rest[i]).applyMatrix4(M);
      if (!s.init || !physics) { for (let i = 0; i < s.n; i++) { s.p[i].copy(s.t[i]); s.q[i].copy(s.t[i]); } s.init = true; if (!physics) continue; }
      for (let it = 0; it < sub; it++) {
        s.p[0].copy(s.t[0]); s.q[0].copy(s.t[0]);
        const sd2 = sdt * sdt;
        for (let i = 1; i < s.n; i++) {
          const f = i / (s.n - 1);
          const P = s.p[i], Qp = s.q[i];
          tmp.copy(P).sub(Qp).multiplyScalar(0.965 - 0.04 * f);
          Qp.copy(P);
          // forces: gravity (weighted), inertia of the horse's motion, a little wind swirl
          P.add(tmp);
          P.addScaledVector(g, s.grav * sd2 * 0.35 * f);
          P.addScaledVector(acc, -sd2 * 0.55 * Math.min(1, f * 1.4));
          const flutter = Math.sin(this.t * 7 + i * 0.7 + s.vo * 0.05) * 0.5 + Math.sin(this.t * 3.1 + s.vo * 0.11) * 0.5;
          P.z -= sd2 * (speed * 1.6) * f * (s.kind === 'tail' ? 1.0 : 0.6);
          P.x += sd2 * flutter * (0.6 + speed * 0.12) * f;
          // shape matching (stiffer near the root)
          const k = s.stiff * (1 - 0.75 * f);
          P.lerp(s.t[i], Math.min(1, k * (sdt * 60)));
        }
        for (let pass = 0; pass < 2; pass++) for (let i = 1; i < s.n; i++) {
          const a = s.p[i - 1], b = s.p[i];
          dir.copy(b).sub(a); const l = dir.length() || 1e-6;
          const diff = (l - s.len[i - 1]) / l;
          if (i === 1) b.addScaledVector(dir, -diff); else { a.addScaledVector(dir, diff * 0.5); b.addScaledVector(dir, -diff * 0.5); }
        }
        s.p[0].copy(s.t[0]);
      }
    }
    // ribbons
    const pos = this._pos, nor = this._nor;
    for (const s of this.strands) {
      s.bone.updateMatrixWorld();
      M.multiplyMatrices(inv, s.bone.matrixWorld);
      nl.copy(s.n0).transformDirection(M);
      for (let i = 0; i < s.n; i++) {
        const a = s.p[Math.max(0, i - 1)], b = s.p[Math.min(s.n - 1, i + 1)];
        dir.copy(b).sub(a).normalize();
        side.copy(dir).cross(nl);
        if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
        side.normalize();
        nrm.copy(side).cross(dir).normalize();
        let w = s.width * 0.5 * (1 - 0.15 * (i / (s.n - 1)));
        if (s.braid) w *= 0.7 + 0.3 * Math.abs(Math.sin(i * 2.4));
        const P = s.p[i], o = (s.vo + i * 2) * 3;
        pos[o] = P.x - side.x * w; pos[o + 1] = P.y - side.y * w; pos[o + 2] = P.z - side.z * w;
        pos[o + 3] = P.x + side.x * w; pos[o + 4] = P.y + side.y * w; pos[o + 5] = P.z + side.z * w;
        nor[o] = nrm.x; nor[o + 1] = nrm.y; nor[o + 2] = nrm.z; nor[o + 3] = nrm.x; nor[o + 4] = nrm.y; nor[o + 5] = nrm.z;
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.normal.needsUpdate = true;
  }
  dispose() { if (this.mesh) this.mesh.geometry.dispose(); this.mat.dispose(); }
}

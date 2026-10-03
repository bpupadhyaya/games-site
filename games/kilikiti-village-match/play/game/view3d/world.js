// The 3D set: ground, mown field, pitch, tall three-stump wickets, the boundary rope, palms and open huts around the edge, blob shadows,
// the highlight ring under the human's player, and the painted backdrop for the batter's-eye view.
// World frame (metres): sim (x, y, z) -> world (x, y, -z). The bowler is at -Z; the batter's-eye camera sits at +Z looking down -Z.
import { THREE } from '../vendor3d/index.js';
import { PITCH, FIELD, STUMP } from '../src/core.js';
import { CAMS } from '../src/camera.js';
import { BufferGeometry, Attr, Attr16 } from './props.js';

export const V3 = THREE.Vector3;
const Matrix4 = new THREE.Group().matrix.constructor;
const srgb = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

export function mergeGeos(list) {
  const pos = [], nor = [], col = [], idx = [];
  const m = new Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion();
  for (const it of list) {
    const g = it.geo;
    q.setFromEuler(e.set(...(it.rot || [0, 0, 0])));
    m.compose(new V3(...(it.pos || [0, 0, 0])), q, new V3(...(it.scale || [1, 1, 1])));
    const p = g.attributes.position, n = g.attributes.normal;
    const base = pos.length / 3;
    const v = new V3();
    const rotOnly = new Matrix4().makeRotationFromQuaternion(q);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix4(rotOnly).normalize(); nor.push(v.x, v.y, v.z);
      if (g.attributes.color) col.push(g.attributes.color.getX(i), g.attributes.color.getY(i), g.attributes.color.getZ(i)); else col.push(...(it.color || [1, 1, 1]));
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
    else for (let i = 0; i < p.count; i++) idx.push(base + i);
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new Attr(new Float32Array(pos), 3));
  out.setAttribute('normal', new Attr(new Float32Array(nor), 3));
  out.setAttribute('color', new Attr(new Float32Array(col), 3));
  out.setIndex(new Attr16(new Uint16Array(idx), 1));
  return out;
}

// ---- textures -------------------------------------------------------------------------------------------------------------
function grassTexture(doc, kind) {
  const c = doc.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  const pal = kind === 'mown' ? ['#6cb04a', '#5ea53f'] : ['#4f8f3a', '#478634'];
  g.fillStyle = pal[0]; g.fillRect(0, 0, 256, 256); g.fillStyle = pal[1]; g.fillRect(0, 256, 256, 256);
  const r = lcg(kind === 'mown' ? 5 : 9);
  const img = g.getImageData(0, 0, 256, 512), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 18; d[i] += n; d[i + 1] += n * 1.1; d[i + 2] += n * 0.6; }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 1400; i++) { const x = r() * 256, y = r() * 512; g.strokeStyle = r() < 0.5 ? 'rgba(30,70,20,0.16)' : 'rgba(200,235,120,0.14)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 4); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function pitchTexture(doc) {
  const c = doc.createElement('canvas'); c.width = 128; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512); grad.addColorStop(0, '#cfc2a6'); grad.addColorStop(0.5, '#bcae8e'); grad.addColorStop(1, '#cfc2a6');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 512);
  const r = lcg(7);
  const img = g.getImageData(0, 0, 128, 512), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.8; }
  g.putImageData(img, 0, 0);
  for (let k = 0; k < 50; k++) { const x = 10 + r() * 108, y = r() < 0.5 ? r() * 90 : 512 - r() * 90; g.fillStyle = `rgba(90,70,40,${0.03 + r() * 0.05})`; g.beginPath(); g.ellipse(x, y, 6 + r() * 10, 3 + r() * 6, r() * 3, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function blobTexture(doc) {
  const c = doc.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(12,24,8,0.6)'); gr.addColorStop(0.55, 'rgba(12,24,8,0.3)'); gr.addColorStop(1, 'rgba(12,24,8,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---- the world ---------------------------------------------------------------------------------------------------------------
export class World {
  constructor(stage, doc = globalThis.document) {
    this.stage = stage; this.doc = doc;
    this.group = new THREE.Group(); this.group.name = 'world';
    stage.scene.add(this.group);
    this.blobTex = blobTexture(doc);
    this._build();
  }

  _build() {
    const { doc } = this;
    const S = THREE;
    const L = PITCH;
    // the ground: a huge rough plane and the mown field inside the rope, ONE mesh (world-mapped UVs, vertex colours tint the rough part darker)
    const gt = grassTexture(doc, 'mown'); gt.repeat.set(1, 1);
    gt.anisotropy = Math.min(8, this.stage.renderer.capabilities.getMaxAnisotropy());
    const pos = [], uv = [], nor = [], col = [], idx = [];
    const rough = [0.74, 0.86, 0.72], mownC = [1, 1, 1];
    const GS = 450;
    for (const [x, z] of [[-GS, -GS + L / 2], [GS, -GS + L / 2], [GS, GS + L / 2], [-GS, GS + L / 2]]) { pos.push(x, 0, -z); uv.push(x / 7, z / 7); nor.push(0, 1, 0); col.push(...rough); }
    idx.push(0, 2, 1, 0, 3, 2);
    const N = 96, base = 4;
    pos.push(FIELD.cx, 0.003, -FIELD.cz); uv.push(FIELD.cx / 7, FIELD.cz / 7); nor.push(0, 1, 0); col.push(...mownC);
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2, x = FIELD.cx + Math.sin(a) * FIELD.ax, z = FIELD.cz + Math.cos(a) * FIELD.az;
      pos.push(x, 0.003, -z); uv.push(x / 7, z / 7); nor.push(0, 1, 0); col.push(...mownC);
      if (i > 0) idx.push(base, base + i + 1, base + i);
    }
    const mg = new BufferGeometry();
    mg.setAttribute('position', new Attr(new Float32Array(pos), 3)); mg.setAttribute('normal', new Attr(new Float32Array(nor), 3)); mg.setAttribute('uv', new Attr(new Float32Array(uv), 2)); mg.setAttribute('color', new Attr(new Float32Array(col), 3));
    const IdxCtor = Object.getPrototypeOf(Attr16.prototype).constructor;
    mg.setIndex(new IdxCtor(new Uint32Array(idx), 1));
    this.group.add(new S.Mesh(mg, new S.MeshStandardMaterial({ map: gt, vertexColors: true, roughness: 1, metalness: 0, side: 2 })));
    // pitch strip: vertex-coloured quads (no texture, so it merges into the single static mesh); a few worn patches for texture
    const pw = 3.0, z0 = -1.6, z1 = L + 2.0;
    const lines = [];
    const quad = (x0, za, x1, zb, y, cA, cB) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new Attr(new Float32Array([x0, y, -za, x1, y, -za, x1, y, -zb, x0, y, -zb]), 3));
      g.setAttribute('normal', new Attr(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
      g.setAttribute('color', new Attr(new Float32Array([...cA, ...cA, ...cB, ...cB]), 3));
      g.setIndex(new Attr16(new Uint16Array([0, 1, 2, 0, 2, 3]), 1));
      return { geo: g, pos: [0, 0, 0] };
    };
    const pc = [srgb('#f6ecd2'), srgb('#e6dabb'), srgb('#f6ecd2')];
    lines.push(quad(-pw / 2, z0, pw / 2, z0 + (z1 - z0) / 2, 0.006, pc[0], pc[1]), quad(-pw / 2, z0 + (z1 - z0) / 2, pw / 2, z1, 0.006, pc[1], pc[2]));
    const pr = lcg(7);
    for (let k = 0; k < 14; k++) { const cx = (pr() - 0.5) * 2.0, cz = pr() < 0.5 ? pr() * 3 : L - pr() * 3, w = 0.25 + pr() * 0.4, d = 0.3 + pr() * 0.6; lines.push(quad(cx - w, cz - d, cx + w, cz + d, 0.0075, srgb('#e0d3b2'), srgb('#e3d7b8'))); }
    // creases and the boundary rope
    const add = (xa, za, xb, zb, w = 0.05, col = srgb('#f4f1e8')) => {
      const cx = (xa + xb) / 2, cz = (za + zb) / 2, len = Math.hypot(xb - xa, zb - za), ang = Math.atan2(xb - xa, zb - za);
      lines.push({ geo: new S.BoxGeometry(w, 0.004, len), pos: [cx, 0.009, -cz], rot: [0, -ang, 0], color: col });
    };
    for (const z of [0.3, L - 0.3]) add(-1.5, z, 1.5, z);
    add(-1.5, 0.3, -1.5, -1.0); add(1.5, 0.3, 1.5, -1.0); add(-1.5, L - 0.3, -1.5, L + 1.0); add(1.5, L - 0.3, 1.5, L + 1.0);
    // rope: a bright band following the ellipse, with a short post every few metres
    const rp = [], ri = [], rn = [], rc = [];
    const RN = 160, wd = 0.34;
    for (let i = 0; i <= RN; i++) {
      const a = (i / RN) * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a);
      const x = FIELD.cx + sx * FIELD.ax, z = FIELD.cz + cz * FIELD.az;
      const nx = sx / FIELD.ax, nz = cz / FIELD.az, nl = Math.hypot(nx, nz);
      const ox = (nx / nl) * wd / 2, oz = (nz / nl) * wd / 2;
      rp.push(x - ox, 0.02, -(z - oz), x + ox, 0.02, -(z + oz)); rn.push(0, 1, 0, 0, 1, 0);
      const c = i % 8 < 4 ? srgb('#fffaf0') : srgb('#ff7a4d'); rc.push(...c, ...c);
      if (i > 0) { const b = (i - 1) * 2; ri.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    const rg = new BufferGeometry();
    rg.setAttribute('position', new Attr(new Float32Array(rp), 3)); rg.setAttribute('normal', new Attr(new Float32Array(rn), 3)); rg.setAttribute('color', new Attr(new Float32Array(rc), 3)); rg.setIndex(new Attr16(new Uint16Array(ri), 1));
    lines.push({ geo: rg, pos: [0, 0, 0] });
    this._lines = lines;
    // wickets: three tall stumps, no bails
    const stumps = [];
    const mk = () => {
      const parts = [];
      for (const k of [-1, 0, 1]) parts.push({ geo: new S.CylinderGeometry(0.02, 0.022, STUMP.h, 8), pos: [k * STUMP.spacing, STUMP.h / 2, 0], color: srgb('#f7efdc') });
      parts.push({ geo: new S.BoxGeometry(STUMP.spacing * 2 + 0.06, 0.03, 0.03), pos: [0, STUMP.h * 0.2, 0], color: srgb('#ff7a4d') });
      return mergeGeos(parts);
    };
    const wm = new S.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
    // both wickets are ONE dynamic mesh (one draw call): per stick the rest vertices are kept and re-posed only while the stumps fly apart
    const pieces = [];   // { w, k (stick 0..2, or 3 = the band), base: Float32Array, nbase: Float32Array, first, count }
    const wpos = [], wnor = [], wcol = [], widx = [];
    for (let w = 0; w < 2; w++) {
      for (let k = 0; k < 4; k++) {
        const g = k < 3 ? new S.CylinderGeometry(0.02, 0.022, STUMP.h, 8) : new S.BoxGeometry(STUMP.spacing * 2 + 0.06, 0.03, 0.03);
        const c = k < 3 ? srgb('#f7efdc') : srgb('#ff7a4d');
        const ox = k < 3 ? (k - 1) * STUMP.spacing : 0, oy = k < 3 ? STUMP.h / 2 : STUMP.h * 0.2;   // oy bakes the stick's height above its foot, so a broken stick turns about its foot
        const pa = g.attributes.position, na = g.attributes.normal, first = wpos.length / 3;
        const base = new Float32Array(pa.count * 3), nb = new Float32Array(pa.count * 3);
        for (let i = 0; i < pa.count; i++) { base.set([pa.getX(i), pa.getY(i) + oy, pa.getZ(i)], i * 3); nb.set([na.getX(i), na.getY(i), na.getZ(i)], i * 3); wpos.push(0, 0, 0); wnor.push(0, 1, 0); wcol.push(...c); }
        for (let i = 0; i < g.index.count; i++) widx.push(g.index.getX(i) + first);
        pieces.push({ w, k, base, nbase: nb, first, count: pa.count, ox, oy });
      }
    }
    const wg = new BufferGeometry();
    wg.setAttribute('position', new Attr(new Float32Array(wpos), 3)); wg.setAttribute('normal', new Attr(new Float32Array(wnor), 3)); wg.setAttribute('color', new Attr(new Float32Array(wcol), 3));
    wg.setIndex(new Attr16(new Uint16Array(widx), 1));
    const wmesh = new S.Mesh(wg, wm); wmesh.frustumCulled = false; this.group.add(wmesh);
    this.wk = { mesh: wmesh, pieces, last: [null, null] };
    this.setBroken(0, 0, true); this.setBroken(1, 0, true);
    this._scenery();
    this.group.add(new S.Mesh(mergeGeos(this._lines), new S.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: 2 })));   // markings, pitch, rope, palms, huts: ONE draw call
    // blob shadows: one dynamic mesh of quads (a single draw call)
    const NB = 28; this.blobN = NB;
    const bpos = new Float32Array(NB * 12), buv = new Float32Array(NB * 8), bidx = new Uint16Array(NB * 6), bnor = new Float32Array(NB * 12);
    for (let i = 0; i < NB; i++) { buv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8); bidx.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2], i * 6); for (let k = 0; k < 4; k++) bnor[i * 12 + k * 3 + 1] = 1; }
    const bg = new BufferGeometry();
    bg.setAttribute('position', new Attr(bpos, 3)); bg.setAttribute('normal', new Attr(bnor, 3)); bg.setAttribute('uv', new Attr(buv, 2)); bg.setIndex(new Attr16(bidx, 1));
    this.blobMesh = new S.Mesh(bg, new S.MeshStandardMaterial({ map: this.blobTex, transparent: true, depthWrite: false, roughness: 1 }));
    this.blobMesh.frustumCulled = false; this.blobMesh.renderOrder = 2;
    this.group.add(this.blobMesh);
  }

  // palms and open thatched huts outside the rope (merged: two draw calls)
  _scenery() {
    const S = THREE;
    const rnd = lcg(21);
    const parts = [], leaves = [];
    const trunkC = srgb('#7a5a3a'), trunkC2 = srgb('#8d6a45'), leafC = srgb('#2f8a45'), leafC2 = srgb('#3fa356'), leafC3 = srgb('#25703a');
    const palm = (x, z, h, lean, seed) => {
      const r = lcg(seed);
      const segs = 4, base = new V3(x, 0, -z);
      const dir = new V3(Math.cos(lean), 0, Math.sin(lean));
      let prev = base.clone();
      for (let k = 0; k < segs; k++) {
        const t1 = (k + 1) / segs;
        const p = new V3(base.x + dir.x * 0.9 * t1 * t1 * h * 0.18, h * t1, base.z + dir.z * 0.9 * t1 * t1 * h * 0.18);
        const mid = prev.clone().lerp(p, 0.5), len = prev.distanceTo(p);
        const axis = p.clone().sub(prev).normalize();
        const q = new S.Quaternion().setFromUnitVectors(new V3(0, 1, 0), axis);
        const e = new S.Euler().setFromQuaternion(q);
        parts.push({ geo: new S.CylinderGeometry(0.16 - 0.07 * t1, 0.16 - 0.07 * (k / segs) + 0.01, len, 5), pos: [mid.x, mid.y, mid.z], rot: [e.x, e.y, e.z], color: k % 2 ? trunkC : trunkC2 });
        prev = p;
      }
      // fronds: long drooping leaf blades from the crown
      const nF = 8;
      for (let k = 0; k < nF; k++) {
        const a = (k / nF) * Math.PI * 2 + r() * 0.5, up = 0.15 + r() * 0.35, L2 = 2.5 + r() * 0.7;
        const col = [leafC, leafC2, leafC3][k % 3];
        const tip = new V3(prev.x + Math.cos(a) * L2, prev.y + up * L2 - 0.9 * 0.5 * L2, prev.z + Math.sin(a) * L2);
        const midp = new V3(prev.x + Math.cos(a) * L2 * 0.5, prev.y + up * L2 * 0.9, prev.z + Math.sin(a) * L2 * 0.5);
        const side = new V3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(0.34);
        const v0 = prev.clone(), v1 = midp.clone().add(side), v2 = midp.clone().sub(side), v3 = tip;
        leaves.push([v0, v1, v2, col], [v1, v3, v2, col]);
      }
    };
    const hut = (x, z, rot, s) => {
      // open thatched hut: a low round platform, posts and a domed thatch roof
      parts.push({ geo: new S.CylinderGeometry(2.2 * s, 2.3 * s, 0.25, 14), pos: [x, 0.12, -z], color: srgb('#9a8a72') });
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; parts.push({ geo: new S.CylinderGeometry(0.07, 0.07, 1.9 * s, 6), pos: [x + Math.cos(a) * 1.9 * s, 0.25 + 0.95 * s, -z + Math.sin(a) * 1.9 * s], color: srgb('#6a4a30') }); }
      parts.push({ geo: new S.CylinderGeometry(0.15, 2.7 * s, 1.9 * s, 14, 1, true), pos: [x, 2.3 * s + 0.1, -z], color: srgb('#c9a24a') });
      parts.push({ geo: new S.CylinderGeometry(0.0, 0.5 * s, 0.35, 8), pos: [x, 3.3 * s + 0.1, -z], color: srgb('#a88434') });
      void rot;
    };
    // palms around the outside of the rope (clear of the sight line behind the bowler)
    const spots = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + 0.07;
      const rr = 1.14 + 0.16 * rnd();
      const x = FIELD.cx + Math.sin(a) * FIELD.ax * rr, z = FIELD.cz + Math.cos(a) * FIELD.az * rr;
      if (z < FIELD.cz - FIELD.az * 0.45) continue;   // none behind the batter: that side is next to the field camera
      spots.push([x, z, a]);
    }
    spots.forEach(([x, z, a], i) => palm(x, z, 5.5 + rnd() * 3.5, a + (rnd() - 0.5) * 1.2, 100 + i));
    // a few extra tall palms in the distance behind the bowler for the batter's-eye backdrop
    for (let i = 0; i < 10; i++) { const x = (i - 5) * 10 + (rnd() - 0.5) * 4, z = FIELD.cz + FIELD.az * 1.5 + rnd() * 10; palm(x, z, 7 + rnd() * 3, 1.0 + rnd(), 200 + i); }
    hut(FIELD.ax * 1.35, FIELD.cz + 6, 0, 1.0); hut(-FIELD.ax * 1.4, FIELD.cz - 3, 0, 1.1); hut(FIELD.ax * 1.25, FIELD.cz - 8, 0, 0.9);
    const lp = [], ln = [], lc = [], li = [];
    for (const [a, b, c, col] of leaves) {
      const n = new V3().subVectors(b, a).cross(new V3().subVectors(c, a)).normalize();
      const base = lp.length / 3;
      for (const p of [a, b, c]) { lp.push(p.x, p.y, p.z); ln.push(n.x, n.y, n.z); lc.push(...col); }
      li.push(base, base + 1, base + 2);
    }
    const lg = new BufferGeometry();
    lg.setAttribute('position', new Attr(new Float32Array(lp), 3)); lg.setAttribute('normal', new Attr(new Float32Array(ln), 3)); lg.setAttribute('color', new Attr(new Float32Array(lc), 3));
    lg.setIndex(new Attr16(new Uint16Array(li), 1));
    parts.push({ geo: lg, pos: [0, 0, 0] });
    for (const p of parts) this._lines.push(p);
  }

  /** Blob shadows: list of [x, z, radius] in WORLD coordinates. */
  setBlobs(list) {
    const p = this.blobMesh.geometry.attributes.position.array;
    const n = Math.min(list.length, this.blobN);
    for (let i = 0; i < this.blobN; i++) {
      const [x, z, r] = i < n ? list[i] : [0, 0, 0];
      const y = 0.014, sx = 0.3 * r, sz = 0.2 * r;
      p.set([x - r * 0.9 + sx, y, z - r * 0.6 + sz, x + r * 0.9 + sx, y, z - r * 0.6 + sz, x + r * 0.9 + sx, y, z + r * 0.6 + sz, x - r * 0.9 + sx, y, z + r * 0.6 + sz], i * 12);
    }
    this.blobMesh.geometry.attributes.position.needsUpdate = true;
  }

  /** The stumps fly apart: t in [0,1]; dir = +1 for the striker's end (they fly toward the camera side). */
  setBroken(i, t, force = false) {
    const W = this.wk;
    if (!force && W.last[i] === t) return;
    W.last[i] = t;
    const dir = i === 0 ? 1 : -1, wz = i === 0 ? 0 : -PITCH;
    const pa = W.mesh.geometry.attributes.position, na = W.mesh.geometry.attributes.normal;
    const m = new Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new V3(), rotOnly = new Matrix4();
    for (const pc of W.pieces) {
      if (pc.w !== i) continue;
      let px = pc.ox, py = 0, pz = 0, rx = 0, rz = 0, sc = 1;
      if (t > 0) {
        if (pc.k === 3) sc = 0.0001;   // the band goes with the unbroken wicket
        else {
          const k = pc.k, kk = (k - 1) * 0.5 + 0.15 * (k === 1 ? 1 : 0);
          px = (k - 1) * STUMP.spacing + t * kk; py = Math.max(0, t * 0.22 * (1 - t) * 2); pz = dir * t * (0.7 + 0.35 * k);
          rx = dir * t * (1.1 + 0.4 * k); rz = -t * ((k - 1) * 1.1 + 0.5) * 1.4;
        }
      }
      q.setFromEuler(e.set(rx, 0, rz));
      m.compose(v.set(px, py, pz + wz), q, new V3(sc, sc, sc)); rotOnly.makeRotationFromQuaternion(q);
      for (let n = 0; n < pc.count; n++) {
        v.set(pc.base[n * 3], pc.base[n * 3 + 1], pc.base[n * 3 + 2]).applyMatrix4(m); pa.setXYZ(pc.first + n, v.x, v.y, v.z);
        v.set(pc.nbase[n * 3], pc.nbase[n * 3 + 1], pc.nbase[n * 3 + 2]).applyMatrix4(rotOnly); na.setXYZ(pc.first + n, v.x, v.y, v.z);
      }
    }
    pa.needsUpdate = true; na.needsUpdate = true;
  }

  dispose() { this.group.removeFromParent(); }
}

// ---- fitted projection ----------------------------------------------------------------------------------------------------------
/** Sets the three camera to the fixed pinhole `cam` (camera.js) so that the 720x1280 virtual canvas maps through the kit's letterbox exactly. */
export function fitCamera(camera, cam, cssW, cssH, view = { w: 720, h: 1280 }) {
  const s = Math.min(cssW / view.w, cssH / view.h);
  const ox = (cssW - view.w * s) / 2, oy = (cssH - view.h * s) / 2;
  const F = cam.f * s, px0 = ox + cam.cx * s, py0 = oy + cam.cy * s;
  const near = 0.3, far = 700;
  const e = camera.projectionMatrix.elements;
  e[0] = 2 * F / cssW; e[4] = 0; e[8] = 1 - 2 * px0 / cssW; e[12] = 0;
  e[1] = 0; e[5] = 2 * F / cssH; e[9] = 2 * py0 / cssH - 1; e[13] = 0;
  e[2] = 0; e[6] = 0; e[10] = -(far + near) / (far - near); e[14] = -2 * far * near / (far - near);
  e[3] = 0; e[7] = 0; e[11] = -1; e[15] = 0;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  camera.position.set(cam.x, cam.y, -cam.z);
  camera.rotation.set(-cam.pitch, 0, 0);
  camera.updateMatrixWorld(true);
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  return { s, ox, oy, F, px0, py0 };
}

// ---- the painted backdrop of the batter's-eye view (screen space, drawn once per size) ----------------------------------------------------
export function makeBackdrop(doc, cssW, cssH, dpr, view = { w: 720, h: 1280 }) {
  const c = doc.createElement('canvas');
  c.width = Math.max(2, Math.round(cssW * dpr)); c.height = Math.max(2, Math.round(cssH * dpr));
  const g = c.getContext('2d');
  const s = Math.min(cssW / view.w, cssH / view.h) * dpr;
  const ox = (c.width - view.w * s) / 2, oy = (c.height - view.h * s) / 2;
  const hz = CAMS.bat.cy;
  const hazeCol = '#cfe6d6';
  // above the virtual rect and below the horizon the colours simply continue
  const topH = oy + (hz + 6) * s;
  const gr = g.createLinearGradient(0, 0, 0, topH);
  gr.addColorStop(0, '#3f8fd8'); gr.addColorStop(0.55, '#8fcdf0'); gr.addColorStop(1, '#e4f3ea');
  g.fillStyle = gr; g.fillRect(0, 0, c.width, topH);
  g.fillStyle = hazeCol; g.fillRect(0, topH - 1, c.width, c.height);
  g.save(); g.setTransform(s, 0, 0, s, ox, oy);
  // sun glow and clouds
  const sg = g.createRadialGradient(540, 130, 4, 540, 130, 260); sg.addColorStop(0, 'rgba(255,248,220,0.95)'); sg.addColorStop(0.2, 'rgba(255,240,200,0.45)'); sg.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = sg; g.fillRect(180, -130, 720, 520);
  const r = lcg(3);
  for (let i = 0; i < 7; i++) { const cx = 40 + i * 110 + r() * 40, cy = 90 + r() * 200, w = 90 + r() * 90; g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(cx, cy, w, 16 + r() * 8, 0, 0, 7); g.ellipse(cx + w * 0.4, cy - 10, w * 0.6, 14, 0, 0, 7); g.fill(); }
  // sea band, island hills and far palms along the horizon
  const sea = g.createLinearGradient(0, hz - 58, 0, hz + 6); sea.addColorStop(0, '#46b9c2'); sea.addColorStop(1, '#9fe0d0');
  g.fillStyle = sea; g.fillRect(-40, hz - 58, 800, 66);
  g.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 26; i++) g.fillRect(r() * 720, hz - 50 + r() * 50, 20 + r() * 40, 1.6);
  g.fillStyle = '#4d8c6a'; g.beginPath(); g.moveTo(-40, hz - 12); for (let x = -40; x <= 760; x += 20) g.lineTo(x, hz - 14 - 36 * Math.abs(Math.sin(x * 0.012 + 0.6)) - 14 * Math.abs(Math.sin(x * 0.04))); g.lineTo(760, hz - 8); g.lineTo(-40, hz - 8); g.closePath(); g.fill();
  g.fillStyle = '#2f7050'; g.beginPath(); g.moveTo(-40, hz - 8); for (let x = -40; x <= 760; x += 16) g.lineTo(x, hz - 10 - 16 * Math.abs(Math.sin(x * 0.03 + 2.1))); g.lineTo(760, hz - 4); g.lineTo(-40, hz - 4); g.closePath(); g.fill();
  g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Morabaraba 3D world: a board cut into a sandstone slab on the red earth of the veld at sundown. Everything is procedural (no bitmaps):
// the slab with incised lines, dished points and a painted Ndebele-style border; carved Nguni cattle (lyre horns, shoulder hump, patched
// hides) standing on round plinths; a burnished clay beer pot, kraal poles, rocks and dry grass; hills, acacias and a herd on the horizon.
// Units are centimetres, y up. The board is centred on the origin, u -> +x, v -> +z (v = +3 is the near side, toward the player).
import * as THREE from '../vendor3d/three.js';
import { POINT_UV, RULES } from '../src/morabaraba.js';

export const SP = 8;                 // one board unit (outer square is +-3 units)
export const HALF = 3 * SP + 6;      // slab half size
export const SLAB_H = 3.4;           // slab thickness; its top is y = 0, the ground is y = -SLAB_H
export const GROUND = -SLAB_H;
export const PEN_Z = HALF + 9.5;     // pen rows: centre distance of each pen from the board centre
export const pointXZ = (i) => ({ x: POINT_UV[i][0] * SP, z: POINT_UV[i][1] * SP });
export const SEGMENTS = (() => { const out = []; RULES.adj.forEach((a, i) => a.forEach((j) => { if (i < j) out.push([i, j]); })); return out; })();
// pen slot k (0..11) of the far ('top') or near ('bottom') pen: two rows of six on the ground
export function penSlot(which, k) {
  const near = which === 'bottom', col = k % 6, row = Math.floor(k / 6);
  return { x: (col - 2.5) * 8.6 * (near ? 1 : -1), y: GROUND, z: (near ? 1 : -1) * (HALF + 6.3 + row * 6.4) };
}

const rnd = (s) => { let x = s | 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; };
const mkCanvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true, rep = false) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

// merge non-indexed copies of geometries; each part may carry a colour function (position -> [r,g,b]) or a flat colour
export function mergeColored(parts) {
  const list = parts.map(([g, c]) => [g.index ? g.toNonIndexed() : g, c]);
  const n = list.reduce((a, [g]) => a + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0; const tmp = new THREE.Color();
  for (const [g, c] of list) {
    const p = g.attributes.position, k = p.count;
    pos.set(p.array, o * 3); if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    for (let i = 0; i < k; i++) {
      const v = typeof c === 'function' ? c(p.getX(i), p.getY(i), p.getZ(i)) : c;
      tmp.set(v); col[(o + i) * 3] = tmp.r; col[(o + i) * 3 + 1] = tmp.g; col[(o + i) * 3 + 2] = tmp.b;
    }
    o += k;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return m;
}

// ---------------------------------------------------------------- the cow: a carved Nguni figure on a round plinth, facing +x
export const COW = { len: 5.8, h: 5.3 };
const PAL = {
  1: { body: '#2b1a15', body2: '#3d261d', patch: '#e8d4ae', horn: '#f3e6c8', hornTip: '#9c8460', hoof: '#120806', muzzle: '#6a4436', eye: '#efe2c4', plinth: '#2a1810', plinthRim: '#b8863e' },
  2: { body: '#efe0bd', body2: '#d9c394', patch: '#9a4f2a', horn: '#3a2618', hornTip: '#1a0e08', hoof: '#3a2618', muzzle: '#c98e74', eye: '#1a0e08', plinth: '#d8c08c', plinthRim: '#7a4a24' },
};
function taperTube(points, r0, r1, seg = 20, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false), p = g.attributes.position;
  const frames = curve.computeFrenetFrames(seg, false);
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, c = curve.getPointAt(t), r = r0 + (r1 - r0) * t;
    for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; const v = new THREE.Vector3(p.getX(k), p.getY(k), p.getZ(k)).sub(c).multiplyScalar(r).add(c); p.setXYZ(k, v.x, v.y, v.z); }
  }
  void frames; g.computeVertexNormals();
  return g;
}
const ell = (rx, ry, rz, x, y, z, rotZ = 0, rotY = 0, ws = 28, hs = 18) => { const g = new THREE.SphereGeometry(1, ws, hs); g.scale(rx, ry, rz); if (rotZ) g.rotateZ(rotZ); if (rotY) g.rotateY(rotY); g.translate(x, y, z); return g; };
// a unit sphere reshaped by f(x, y, z) -> [x, y, z] (all parts of the cow are sculpted this way, so the surfaces stay smooth)
function sculpt(f, ws = 40, hs = 26) { const g = new THREE.SphereGeometry(1, ws, hs), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const v = f(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, v[0], v[1], v[2]); } g.computeVertexNormals(); return g; }
const gauss = (x, m, s) => Math.exp(-(((x - m) / s) ** 2));
export function cowGeometry(side, { plinth = true } = {}) {
  const P = PAL[side], parts = [];
  // Nguni hide: irregular patches from a few overlapping waves (the same pattern on every figure of a side, like a carver's painted set)
  const k = side === 1 ? 0 : 1.9;
  const patch = (x, y, z) => Math.sin(x * 1.9 + k) * Math.cos(y * 2.6 - 0.4 + k) + 0.55 * Math.sin(z * 3.1 + x * 1.2 + k * 2) + 0.35 * Math.cos(x * 4.3 - z * 2.2);
  const thr = side === 1 ? 0.78 : 0.62;
  const cP = new THREE.Color(P.patch), cB = new THREE.Color(P.body), cB2 = new THREE.Color(P.body2), out = new THREE.Color();
  const hide = (x, y, z) => { const f = Math.min(1, Math.max(0, (patch(x, y, z) - thr + 0.16) / 0.32)), m = f * f * (3 - 2 * f); out.copy(y > 3.3 ? cB2 : cB).lerp(cP, m); return out; };
  // plinth: a low turned disc with a painted rim
  const prof = [[0, 0], [2.2, 0], [2.38, 0.1], [2.42, 0.36], [2.26, 0.54], [2.0, 0.6], [0, 0.62]].map(([x, y]) => new THREE.Vector2(x, y));
  if (plinth) parts.push([new THREE.LatheGeometry(prof, 44), (x, y) => (y > 0.16 && y < 0.46 ? P.plinthRim : P.plinth)]);
  // torso: deep chest, level back with the Nguni shoulder hump, slimmer rump, a slight belly sag
  parts.push([sculpt((x, y, z) => {
    const u = x, hx = 0.95 + 0.16 * gauss(u, 0.25, 0.7), wx = 0.8 + 0.18 * gauss(u, 0.0, 0.8) - 0.08 * Math.max(0, u - 0.6);
    let Y = y * hx; if (y > 0) Y += 0.3 * gauss(u, 0.62, 0.17) * y; else Y -= 0.08 * gauss(u, -0.1, 0.5) * -y;
    return [u * 2.2, 3.0 + Y, z * wx];
  }, 72, 44), hide]);
  // neck: from the shoulders down and forward to the head
  parts.push([taperTube([[1.4, 3.3, 0], [1.9, 3.25, 0], [2.35, 3.05, 0]], 0.75, 0.5, 12, 16), hide]);
  // head: long face tapering to the muzzle, angled down
  parts.push([sculpt((x, y, z) => { const t = (x + 1) / 2, sh = 1 - 0.38 * t; const X = x * 0.95, Y = y * 0.56 * sh, Z = z * 0.48 * sh; const a = -0.8, c = Math.cos(a), s = Math.sin(a); return [2.72 + X * c - Y * s, 2.95 + X * s + Y * c, Z]; }, 28, 18), (x, y, z) => (x > 3.2 ? P.muzzle : hide(x, y, z))]);
  for (const s of [1, -1]) {
    // ears out to the side under the horns, eyes, lyre horns (out, up and in, tapering to a dark tip)
    parts.push([ell(0.42, 0.12, 0.2, 2.4, 3.3, 0.62 * s, 0.25, -0.5 * s, 14, 8), P.body2]);
    parts.push([ell(0.1, 0.09, 0.09, 2.82, 3.12, 0.36 * s, 0, 0, 10, 8), P.eye]);
    const h = taperTube([[2.42, 3.5, 0.22 * s], [2.36, 3.72, 0.95 * s], [2.45, 4.2, 1.5 * s], [2.62, 4.85, 1.42 * s], [2.8, 5.25, 1.0 * s]], 0.26, 0.06, 22, 10);
    parts.push([h, (x, y) => (y > 4.95 ? P.hornTip : P.horn)]);
  }
  // legs: tapered, with a knee (fore) or hock (hind), and dark hooves on the plinth
  for (const [lx, lz, fore] of [[1.25, 0.5, 1], [1.2, -0.5, 1], [-1.3, 0.52, 0], [-1.35, -0.52, 0]]) {
    const knee = fore ? [lx + 0.05, 1.55, lz * 1.02] : [lx - 0.18, 1.7, lz * 1.02];
    parts.push([taperTube([[lx, 2.75, lz * 0.85], knee, [lx, 0.82, lz * 1.05]], 0.42, 0.2, 10, 12), P.body]);
    const hoof = new THREE.CylinderGeometry(0.2, 0.26, 0.24, 12); hoof.translate(lx, 0.72, lz * 1.05); parts.push([hoof, P.hoof]);
  }
  // tail with a tassel
  parts.push([taperTube([[-2.1, 3.55, 0], [-2.38, 3.15, 0.06], [-2.44, 2.3, 0.1], [-2.36, 1.65, 0.1]], 0.12, 0.07, 14, 6), P.body]);
  parts.push([ell(0.17, 0.34, 0.17, -2.34, 1.46, 0.1, 0, 0, 10, 8), P.hoof]);
  const g = mergeColored(parts); g.computeBoundingSphere();
  return g;
}
export function cowMaterial() {
  return new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.5 });
}

// ---------------------------------------------------------------- textures
export function radialTex(rgb, a = 1, size = 128) {
  const c = mkCanvas(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.45, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return tex(c);
}
export function ringTex() {
  const s = 256, c = mkCanvas(s), x = c.getContext('2d');
  const g = x.createRadialGradient(s / 2, s / 2, s * 0.18, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0.95)'); g.addColorStop(0.68, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  const g2 = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.4); g2.addColorStop(0, 'rgba(255,255,255,0.35)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g2; x.fillRect(0, 0, s, s); return tex(c);
}
export function blobTex() {
  const s = 128, c = mkCanvas(s), x = c.getContext('2d'), g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.5, 'rgba(0,0,0,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s); return tex(c, false);
}
export function beamTex() {   // a soft bar along u, for the glowing mill lines
  const c = mkCanvas(64, 32), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 32); return tex(c);
}

// the slab top: sandstone, painted border, incised lines, dished points (colour + bump drawn together)
function slabTextures() {
  const N = 2048, k = N / (2 * HALF), col = mkCanvas(N), bmp = mkCanvas(N), c = col.getContext('2d'), b = bmp.getContext('2d'), R = rnd(17);
  const X = (u) => (u + HALF) * k, Z = (z) => (z + HALF) * k;
  // sandstone: warm gradient, strata, speckle
  const g = c.createLinearGradient(0, 0, N, N); g.addColorStop(0, '#c98a5a'); g.addColorStop(0.5, '#b8744a'); g.addColorStop(1, '#a5633c');
  c.fillStyle = g; c.fillRect(0, 0, N, N); b.fillStyle = '#9a9a9a'; b.fillRect(0, 0, N, N);
  for (let i = 0; i < 46; i++) { const y = R() * N, h = 6 + R() * 40; c.fillStyle = `rgba(${R() < 0.5 ? '255,214,170' : '120,52,28'},${0.05 + R() * 0.07})`; c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= N; x += 64) c.lineTo(x, y + Math.sin(x * 0.004 + i) * 18 + (R() - 0.5) * 6); c.lineTo(N, y + h); c.lineTo(0, y + h); c.fill(); }
  for (let i = 0; i < 26000; i++) { const x = R() * N, y = R() * N, l = R() < 0.5, s = 1 + R() * 3; c.fillStyle = l ? `rgba(255,226,190,${0.06 + R() * 0.14})` : `rgba(60,22,10,${0.06 + R() * 0.16})`; c.fillRect(x, y, s, s); b.fillStyle = l ? 'rgba(200,200,200,0.25)' : 'rgba(60,60,60,0.25)'; b.fillRect(x, y, s, s); }
  for (let i = 0; i < 60; i++) { const x = R() * N, y = R() * N, r = 4 + R() * 12; b.fillStyle = 'rgba(40,40,40,0.4)'; b.beginPath(); b.arc(x, y, r, 0, Math.PI * 2); b.fill(); c.fillStyle = 'rgba(70,28,12,0.18)'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
  // painted Ndebele-style border: a band of stepped chevrons and blocks outlined in black, all round the face
  const b0 = HALF - 4.6, b1 = HALF - 1.2, cols = ['#e2a22c', '#c4502a', '#2b8f8c', '#f1e2c2', '#3a5fa0'];
  const band = (ctx, isBump) => {
    ctx.save(); ctx.lineJoin = 'round';
    const inner = X(-b0), outer = X(-b1), sz = (b1 - b0) * k;
    // the band strip
    ctx.fillStyle = isBump ? '#b0b0b0' : '#f3e7cc';
    ctx.beginPath(); ctx.rect(outer, outer, N - 2 * outer, N - 2 * outer); ctx.rect(inner, inner, N - 2 * inner, N - 2 * inner); ctx.fill('evenodd');
    if (!isBump) {
      const cells = 14, len = N - 2 * outer, cw = len / cells;
      for (let side = 0; side < 4; side++) {
        ctx.save(); ctx.translate(N / 2, N / 2); ctx.rotate((side * Math.PI) / 2); ctx.translate(-N / 2, -N / 2);
        for (let i = 0; i < cells; i++) {
          const x0 = outer + i * cw, y0 = outer, cx = x0 + cw / 2, cl = cols[(i + side) % 5], c2 = cols[(i + side + 2) % 5];
          ctx.fillStyle = cl; ctx.strokeStyle = '#1b0f0a'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(x0 + cw * 0.08, y0 + sz * 0.88); ctx.lineTo(cx, y0 + sz * 0.14); ctx.lineTo(x0 + cw * 0.92, y0 + sz * 0.88); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(cx - cw * 0.17, y0 + sz * 0.88); ctx.lineTo(cx, y0 + sz * 0.5); ctx.lineTo(cx + cw * 0.17, y0 + sz * 0.88); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#1b0f0a'; ctx.fillRect(x0 - 2, y0 + sz * 0.1, 4, sz * 0.8);
        }
        ctx.restore();
      }
      ctx.strokeStyle = '#1b0f0a'; ctx.lineWidth = 8; ctx.strokeRect(outer, outer, N - 2 * outer, N - 2 * outer); ctx.strokeRect(inner, inner, N - 2 * inner, N - 2 * inner);
    }
    ctx.restore();
  };
  band(c, false); band(b, true);
  // weathering over the paint
  for (let i = 0; i < 5000; i++) { const x = R() * N, y = R() * N; c.fillStyle = `rgba(180,120,80,${R() * 0.18})`; c.fillRect(x, y, 2 + R() * 4, 1 + R() * 3); }
  // incised lines: lit lip (light comes from the far left), dark groove, deep core; bump: a channel
  const pts = POINT_UV.map(([u, v]) => ({ x: X(u * SP), y: Z(v * SP) }));
  const stroke = (ctx, style, w, dx, dy) => { ctx.strokeStyle = style; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); for (const [i, j] of SEGMENTS) { ctx.moveTo(pts[i].x + dx, pts[i].y + dy); ctx.lineTo(pts[j].x + dx, pts[j].y + dy); } ctx.stroke(); };
  stroke(c, 'rgba(255,214,170,0.55)', 0.95 * k, 0.12 * k, 0.12 * k); stroke(c, '#4a1d0e', 0.8 * k, 0, 0); stroke(c, '#26090377', 0.4 * k, -0.05 * k, -0.05 * k);
  stroke(b, '#505050', 1.1 * k, 0, 0); stroke(b, '#202020', 0.75 * k, 0, 0); stroke(b, '#000000', 0.35 * k, 0, 0);
  // dished points
  for (const p of pts) {
    const r = 1.55 * k;
    c.fillStyle = 'rgba(255,214,170,0.45)'; c.beginPath(); c.arc(p.x + 0.12 * k, p.y + 0.12 * k, r * 1.08, 0, Math.PI * 2); c.fill();
    const gg = c.createRadialGradient(p.x - r * 0.25, p.y - r * 0.25, r * 0.1, p.x, p.y, r); gg.addColorStop(0, '#6a2a14'); gg.addColorStop(0.75, '#3a1308'); gg.addColorStop(1, '#22080299');
    c.fillStyle = gg; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill();
    const gb = b.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 1.08); gb.addColorStop(0, '#000'); gb.addColorStop(0.8, '#3a3a3a'); gb.addColorStop(1, '#9a9a9a');
    b.fillStyle = gb; b.beginPath(); b.arc(p.x, p.y, r * 1.08, 0, Math.PI * 2); b.fill();
  }
  const map = tex(col), bump = tex(bmp, false);
  for (const t of [map, bump]) { t.repeat.set(1 / (2 * HALF), 1 / (2 * HALF)); t.offset.set(0.5, 0.5); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }
  return { map, bump };
}
function earthTex(seed, size = 512, base = ['#7d3622', '#6a2c1b'], speck = 9000) {
  const c = mkCanvas(size), x = c.getContext('2d'), R = rnd(seed);
  const g = x.createLinearGradient(0, 0, size, size); g.addColorStop(0, base[0]); g.addColorStop(1, base[1]); x.fillStyle = g; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 40; i++) { const px = R() * size, py = R() * size, r = 20 + R() * 70; const gg = x.createRadialGradient(px, py, 0, px, py, r); gg.addColorStop(0, `rgba(${R() < 0.5 ? '160,80,48' : '70,24,14'},0.25)`); gg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gg; x.fillRect(px - r, py - r, r * 2, r * 2); }
  for (let i = 0; i < speck; i++) { const px = R() * size, py = R() * size; x.fillStyle = R() < 0.5 ? `rgba(230,150,100,${0.06 + R() * 0.16})` : `rgba(30,8,4,${0.08 + R() * 0.18})`; x.fillRect(px, py, 1 + R() * 2, 1 + R() * 1.5); }
  for (let i = 0; i < 90; i++) { const px = R() * size, py = R() * size, r = 1.5 + R() * 4; x.fillStyle = 'rgba(25,8,4,0.35)'; x.beginPath(); x.ellipse(px + 1, py + 1.2, r, r * 0.7, 0, 0, 7); x.fill(); x.fillStyle = `rgba(${170 + R() * 60},${100 + R() * 40},${70 + R() * 30},0.8)`; x.beginPath(); x.ellipse(px, py, r, r * 0.7, 0, 0, 7); x.fill(); }
  return c;
}

// ---------------------------------------------------------------- the slab
export function buildSlab() {
  const grp = new THREE.Group(), { map, bump } = slabTextures();
  const shape = new THREE.Shape(), w = HALF - 0.9, r = 2.2;
  shape.moveTo(-w + r, -w); shape.lineTo(w - r, -w); shape.quadraticCurveTo(w, -w, w, -w + r); shape.lineTo(w, w - r); shape.quadraticCurveTo(w, w, w - r, w);
  shape.lineTo(-w + r, w); shape.quadraticCurveTo(-w, w, -w, w - r); shape.lineTo(-w, -w + r); shape.quadraticCurveTo(-w, -w, -w + r, -w);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: SLAB_H - 1.8, bevelEnabled: true, bevelThickness: 0.9, bevelSize: 0.9, bevelSegments: 5, curveSegments: 8 });
  geo.rotateX(-Math.PI / 2); geo.computeBoundingBox(); geo.translate(0, -geo.boundingBox.max.y, 0);
  const sideC = earthTex(5, 512, ['#a8653e', '#8a4a2a'], 14000), side = tex(sideC, true, true); side.repeat.set(0.05, 0.05);
  const top = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.6, roughness: 0.86, metalness: 0 });
  const sideM = new THREE.MeshStandardMaterial({ map: side, roughness: 0.92, color: 0xd8b8a0 });
  const m = new THREE.Mesh(geo, [top, sideM]); m.castShadow = true; m.receiveShadow = true; grp.add(m);
  grp.userData.top = top;
  return grp;
}

// ---------------------------------------------------------------- the veld: ground, sky, hills, acacias, kraal, pot, rocks, grass
export function buildWorld(scene) {
  const world = new THREE.Group(); scene.add(world);
  // ground
  const gt = tex(earthTex(77, 1024, ['#7d3622', '#5e2617'], 26000), true, true); gt.repeat.set(9, 9);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1400, 64), new THREE.MeshStandardMaterial({ map: gt, roughness: 0.97, color: 0xe0c2b0 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = GROUND; ground.receiveShadow = true; world.add(ground);
  // trampled, darker earth around the board where the players sit
  const pad = new THREE.Mesh(new THREE.CircleGeometry(78, 48), new THREE.MeshBasicMaterial({ map: radialTex('40,10,4', 0.5, 256), transparent: true, depthWrite: false }));
  pad.rotation.x = -Math.PI / 2; pad.position.y = GROUND + 0.03; pad.renderOrder = 1; world.add(pad);
  // sky dome: indigo zenith, rose band, orange horizon glowing toward the sun
  const sun = new THREE.Vector3(-0.55, 0.075, -0.83).normalize();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: sun } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vDir; uniform vec3 sunDir;
      void main(){ float h = clamp(vDir.y, -0.2, 1.0);
        vec3 zen = vec3(0.10,0.07,0.20), mid = vec3(0.42,0.15,0.27), hor = vec3(0.98,0.52,0.25), low = vec3(0.45,0.16,0.12);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.16, h)); c = mix(c, zen, smoothstep(0.12, 0.6, h)); if (h < 0.0) c = mix(hor, low, smoothstep(0.0, -0.08, h));
        float s = max(dot(normalize(vDir), sunDir), 0.0); c += vec3(1.0,0.62,0.30) * pow(s, 8.0) * 0.55 + vec3(1.0,0.85,0.55) * pow(s, 400.0) * 3.0;
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  sky.renderOrder = -1; world.add(sky);
  // hills: three rings of low ridges, darker and warmer as they come closer
  const ridge = (radius, height, seed, color, seg = 120) => {
    const R = rnd(seed), pos = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, hgt = height * (0.35 + 0.65 * Math.abs(Math.sin(a * 3 + seed) * 0.6 + Math.sin(a * 7.3 + seed * 2) * 0.3 + (R() - 0.5) * 0.2));
      const x = Math.cos(a) * radius, z = Math.sin(a) * radius; pos.push(x, GROUND - 2, z, x, GROUND + hgt, z);
      if (i < seg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: true })); world.add(m); return m;
  };
  ridge(1500, 150, 3, 0x8e3f52); ridge(1180, 95, 8, 0x6a2c46); ridge(900, 52, 21, 0x431b30);
  // a flat-topped kopje toward the sun, and acacias with flat crowns
  const kop = new THREE.Mesh(new THREE.CylinderGeometry(110, 190, 95, 9, 1), new THREE.MeshBasicMaterial({ color: 0x4f2038 })); kop.position.set(-520, GROUND + 40, -980); world.add(kop);
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x24120e, roughness: 1 }), crownM = new THREE.MeshStandardMaterial({ color: 0x1e1410, roughness: 1 });
  const acacia = (x, z, s, seed) => {
    const t = new THREE.Group(), R = rnd(seed);
    const tr = new THREE.CylinderGeometry(0.9, 1.6, 26, 7); tr.translate(0, 13, 0); const trunk = new THREE.Mesh(tr, trunkM); trunk.rotation.z = (R() - 0.5) * 0.25; t.add(trunk);
    for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6), crownM); c.scale.set(10 + R() * 9, 2.2 + R() * 1.6, 9 + R() * 7); c.position.set((R() - 0.5) * 22, 26 + R() * 4, (R() - 0.5) * 14); c.castShadow = true; t.add(c); }
    t.position.set(x, GROUND, z); t.scale.setScalar(s); t.rotation.y = R() * 6; world.add(t); return t;
  };
  acacia(520, -980, 9, 4); acacia(-700, -1250, 8, 9); acacia(1150, -650, 7, 12); acacia(-1300, -300, 8.5, 22);
  // kraal: a ring of rough poles behind the board
  const poleM = new THREE.MeshStandardMaterial({ color: 0x5a3a26, roughness: 0.95 }), R = rnd(31), polesG = [];
  for (let i = 0; i < 70; i++) {
    const a = Math.PI * (0.62 + (i / 70) * 0.76) + (R() - 0.5) * 0.01, rr = 520 + (R() - 0.5) * 14, h = 150 + R() * 60;
    const g = new THREE.CylinderGeometry(3.5 + R() * 1.5, 5 + R() * 2, h, 7); g.rotateZ((R() - 0.5) * 0.1); g.rotateX((R() - 0.5) * 0.1); g.translate(Math.cos(a) * rr * 1.1, GROUND + h / 2 - 2, -Math.abs(Math.sin(a) * rr) * 0.9 - 40); polesG.push(g);
  }
  const poles = new THREE.Mesh(mergeColored(polesG.map((g) => [g, '#ffffff'])), poleM); poles.castShadow = true; poles.receiveShadow = true; world.add(poles);
  const kraal = poles;
  // rocks
  const rockM = new THREE.MeshStandardMaterial({ color: 0x8a5a44, roughness: 0.9, flatShading: true });
  const rock = (x, z, s, seed) => { const g = new THREE.SphereGeometry(1, 8, 6), p = g.attributes.position, Rr = rnd(seed); for (let i = 0; i < p.count; i++) { const f = 0.78 + Rr() * 0.38; p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.62, p.getZ(i) * f); } g.computeVertexNormals(); const m = new THREE.Mesh(g, rockM); m.scale.setScalar(s); m.position.set(x, GROUND + s * 0.25, z); m.rotation.y = seed; m.castShadow = true; m.receiveShadow = true; world.add(m); return m; };
  rock(-HALF - 13, -HALF + 4, 4.2, 3); rock(-HALF - 8, -HALF - 6, 2.4, 5); rock(HALF + 16, HALF + 2, 3.2, 7); rock(HALF + 34, -HALF - 22, 6, 11); rock(-HALF - 40, HALF + 20, 5, 13);
  // dry grass tufts (instanced blades)
  const blade = new THREE.CylinderGeometry(0, 0.16, 1, 3, 1, true); blade.translate(0, 0.5, 0);
  const grassM = new THREE.MeshStandardMaterial({ color: 0xd9a65a, roughness: 0.9, side: THREE.DoubleSide });
  const tufts = [], Rg = rnd(57);
  for (let i = 0; i < 70; i++) { const a = Rg() * Math.PI * 2, r = HALF + 20 + Rg() * 110; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.abs(x) < HALF + 30 && Math.abs(z) < HALF + 26) continue; tufts.push([x, z, 0.8 + Rg() * 1.4]); }
  const grass = new THREE.InstancedMesh(blade, grassM, tufts.length * 9); let gi = 0; const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  for (const [x, z, s] of tufts) for (let k = 0; k < 9; k++) { e.set((Rg() - 0.5) * 0.9, Rg() * 6, (Rg() - 0.5) * 0.9); q.setFromEuler(e); sc.set(s, s * (3 + Rg() * 3), s); ps.set(x + (Rg() - 0.5) * 2 * s, GROUND, z + (Rg() - 0.5) * 2 * s); grass.setMatrixAt(gi++, mm.compose(ps, q, sc)); grass.setColorAt(gi - 1, new THREE.Color().setHSL(0.09 + Rg() * 0.03, 0.5, 0.42 + Rg() * 0.18)); }
  grass.count = gi; grass.castShadow = true; world.add(grass);
  // ukhamba: a burnished black clay beer pot with an incised band, beside the board
  const prof = [[0, 0], [3.2, 0.1], [6.4, 2], [7.6, 5.4], [7.1, 8.6], [5.2, 10.6], [4.3, 11.2], [4.5, 11.8], [4.1, 12]].map(([x, y]) => new THREE.Vector2(x, y));
  const potG = new THREE.LatheGeometry(prof, 40), pc = mkCanvas(512, 256), px = pc.getContext('2d');
  px.fillStyle = '#1a100c'; px.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 24; i++) { const x0 = i * (512 / 24); px.strokeStyle = 'rgba(200,150,110,0.55)'; px.lineWidth = 3; px.beginPath(); px.moveTo(x0, 96); px.lineTo(x0 + 10.7, 76); px.lineTo(x0 + 21.3, 96); px.stroke(); px.beginPath(); px.moveTo(x0, 112); px.lineTo(x0 + 10.7, 92); px.lineTo(x0 + 21.3, 112); px.stroke(); }
  const pot = new THREE.Mesh(potG, new THREE.MeshPhysicalMaterial({ map: tex(pc), roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.4, color: 0xffffff }));
  pot.castShadow = true; pot.receiveShadow = true; pot.position.set(HALF + 13, GROUND, -HALF + 2); pot.scale.setScalar(0.95); world.add(pot);
  // a calabash ladle and a small heap of river stones (the stones a board scratched in the ground would be played with)
  const cal = new THREE.Mesh(new THREE.SphereGeometry(3.2, 24, 16), new THREE.MeshStandardMaterial({ color: 0xc88a3c, roughness: 0.55 })); cal.scale.set(1, 0.8, 1); cal.position.set(-HALF - 6, GROUND + 2.4, HALF + 30); cal.castShadow = true; world.add(cal);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.0, 9, 10), cal.material); neck.rotation.z = 1.2; neck.position.set(-HALF - 11, GROUND + 4.4, HALF + 30); neck.castShadow = true; world.add(neck);
  const stoneM = new THREE.MeshStandardMaterial({ color: 0x8c7c70, roughness: 0.6 }), Rs = rnd(91);
  for (let i = 0; i < 9; i++) { const st = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), stoneM); st.scale.set(1 + Rs() * 0.5, 0.6, 0.9 + Rs() * 0.4); st.position.set(-HALF + 4 + Rs() * 8, GROUND + 0.5, HALF + 36 + Rs() * 6); st.castShadow = true; world.add(st); }
  return { world, sun, pot, ground, kraal };
}

// ---------------------------------------------------------------- lights: a low sun from the far left, sky and earth bounce, a warm fill
export function buildLights(scene, sunDir) {
  const hemi = new THREE.HemisphereLight(0x9a86c8, 0x6a2a18, 0.85); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb070, 3.6);
  sun.position.set(sunDir.x * 160, 70, sunDir.z * 160); sun.target.position.set(0, 0, 0); scene.add(sun, sun.target);
  const sc = sun.shadow.camera; sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 20; sc.far = 400;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  const fill = new THREE.DirectionalLight(0xffd6b0, 0.95); fill.position.set(50, 80, 120); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xc8a0ff, 0.5); rim.position.set(80, 40, -120); scene.add(rim);
  return { hemi, sun, fill, rim };
}

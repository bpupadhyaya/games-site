// Kintsugi 3D world (generated, nothing downloaded): a dark walnut bench seen from above, a charcoal hemp mending cloth with a gold-thread
// border (drawn by the 2D layer so it stays even) under the vessel, extruded ceramic shards (glazed top from the game's own baked art, raw clay sides) and a gold-seam decal.
import * as THREE from '../vendor3d/three.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const hash = (n) => { let h = Math.imul(Math.floor(n) ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const SHARD_T = 9;      // shard thickness in world units (the vessel is about 450 wide)

export function walnutTexture() {
  const N = 1024, c = mk(N, N), g = c.getContext('2d');
  g.fillStyle = '#3a271b'; g.fillRect(0, 0, N, N);
  const P = 4, pw = N / P;
  for (let p = 0; p < P; p++) {
    const tone = hash(p * 7 + 3);
    g.fillStyle = `rgba(${tone < 0.5 ? '120,78,44' : '20,10,4'},${0.16 + 0.1 * Math.abs(tone - 0.5)})`; g.fillRect(p * pw, 0, pw, N);
    for (let i = 0; i < 190; i++) {
      const x = p * pw + hash(i * 5 + p * 99) * pw, w = 0.6 + hash(i * 3 + p) * 2.2, a = 0.04 + hash(i + p * 13) * 0.12, wob = hash(i * 11 + p) * 8;
      g.strokeStyle = hash(i * 17 + p) < 0.6 ? `rgba(14,6,2,${a})` : `rgba(190,130,76,${a * 0.9})`; g.lineWidth = w;
      g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + wob, N * 0.3, x - wob, N * 0.66, x + wob * 0.4, N); g.stroke();
    }
    g.fillStyle = 'rgba(8,4,2,0.75)'; g.fillRect(p * pw, 0, 2.6, N);
    g.fillStyle = 'rgba(200,140,84,0.18)'; g.fillRect(p * pw + 2.6, 0, 1.4, N);
  }
  const t = new THREE.CanvasTexture(g.canvas); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

// Hemp mending cloth: warp and weft threads, a darker edge and a thin gold thread border. Tiles are stretched to the board rectangle.
export function clothTexture() {
  const N = 1024, c = mk(N, N), g = c.getContext('2d');
  g.fillStyle = '#16171f'; g.fillRect(0, 0, N, N);
  for (let i = 0; i < N; i += 3) {
    g.fillStyle = `rgba(${hash(i) < 0.5 ? '200,190,175' : '0,0,0'},${0.02 + hash(i + 5) * 0.035})`; g.fillRect(i, 0, 1.6, N);
    g.fillStyle = `rgba(${hash(i + 77) < 0.5 ? '200,190,175' : '0,0,0'},${0.02 + hash(i + 9) * 0.035})`; g.fillRect(0, i, N, 1.6);
  }
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(230,220,200,${0.03 + hash(i * 3) * 0.05})`; g.fillRect(hash(i * 3 + 1) * N, hash(i * 3 + 2) * N, 3 + hash(i) * 8, 1.2); }
  const v = g.createRadialGradient(N / 2, N / 2, N * 0.2, N / 2, N / 2, N * 0.75); v.addColorStop(0, 'rgba(255,220,160,0.10)'); v.addColorStop(1, 'rgba(0,0,0,0.38)'); g.fillStyle = v; g.fillRect(0, 0, N, N);
  const t = new THREE.CanvasTexture(g.canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function buildBench() {
  const grp = new THREE.Group();
  const wt = walnutTexture(); wt.repeat.set(3, 3);
  const bench = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.62, metalness: 0 }));
  bench.rotation.x = -Math.PI / 2; bench.position.y = -2; bench.receiveShadow = true; bench.renderOrder = -3;
  const ct = clothTexture();
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.95, metalness: 0 }));
  cloth.rotation.x = -Math.PI / 2; cloth.position.y = -0.6; cloth.receiveShadow = true; cloth.renderOrder = -2;
  grp.add(bench, cloth);
  grp.userData = { bench, cloth, dispose() { wt.dispose(); ct.dispose(); bench.geometry.dispose(); cloth.geometry.dispose(); bench.material.dispose(); cloth.material.dispose(); } };
  return grp;
}

// The true outline of a shard (cell polygon clipped by the vessel silhouette) is the opaque part of its baked art: marching squares on the
// alpha channel, longest loop, simplified. Returned in the shard's local coordinates (centroid at the origin, y down).
function outline(bake) {
  const W = bake.c.width, H = bake.c.height, id = bake.c.getContext('2d').getImageData(0, 0, W, H).data, st = 2;
  const gw = Math.ceil(W / st) + 3, gh = Math.ceil(H / st) + 3, f = new Uint8Array(gw * gh);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (id[(y * W + x) * 4 + 3] > 127) f[((y / st | 0) + 1) * gw + (x / st | 0) + 1] = 1;
  const segs = new Map(), key = (x, y) => x * 4096 + y, add = (ax, ay, bx, by) => { segs.set(key(ax, ay), [bx, by]); };
  // midpoints of cell edges in doubled coordinates: top (2x+1, 2y), right (2x+2, 2y+1), bottom (2x+1, 2y+2), left (2x, 2y+1)
  for (let y = 0; y < gh - 1; y++) for (let x = 0; x < gw - 1; x++) {
    const a = f[y * gw + x], b = f[y * gw + x + 1], c = f[(y + 1) * gw + x + 1], d = f[(y + 1) * gw + x], m = a | (b << 1) | (c << 2) | (d << 3);
    const T = [2 * x + 1, 2 * y], R = [2 * x + 2, 2 * y + 1], B = [2 * x + 1, 2 * y + 2], L = [2 * x, 2 * y + 1], e = (p, q) => add(p[0], p[1], q[0], q[1]);
    switch (m) { case 1: e(T, L); break; case 2: e(R, T); break; case 3: e(R, L); break; case 4: e(B, R); break; case 5: e(T, R); e(B, L); break; case 6: e(B, T); break; case 7: e(B, L); break;
      case 8: e(L, B); break; case 9: e(T, B); break; case 10: e(L, T); e(R, B); break; case 11: e(R, B); break; case 12: e(L, R); break; case 13: e(T, R); break; case 14: e(L, T); break; default: break; }
  }
  let best = [];
  const seen = new Set();
  for (const k0 of segs.keys()) {
    if (seen.has(k0)) continue;
    const loop = []; let k = k0;
    while (!seen.has(k) && segs.has(k)) { seen.add(k); loop.push([Math.floor(k / 4096), k % 4096]); const n = segs.get(k); k = key(n[0], n[1]); }
    if (loop.length > best.length) best = loop;
  }
  const KX = W / bake.w, KY = H / bake.h;
  return best.map(([x, y]) => [bake.x0 + ((x / 2 - 1) * st) / KX, bake.y0 + ((y / 2 - 1) * st) / KY]);
}
const simplify = (pts, eps) => {
  if (pts.length < 8) return pts;
  const dp = (i, j, out) => {
    let md = 0, mi = -1; const [ax, ay] = pts[i], [bx, by] = pts[j], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    for (let k = i + 1; k < j; k++) { const d = Math.abs((pts[k][0] - ax) * dy - (pts[k][1] - ay) * dx) / L; if (d > md) { md = d; mi = k; } }
    if (md > eps) { dp(i, mi, out); out.push(pts[mi]); dp(mi, j, out); }
  };
  const out = [pts[0]]; dp(0, pts.length - 1, out); out.push(pts[pts.length - 1]); return out;
};

// One shard: its true outline extruded upward with a chamfered edge, UVs into the baked art canvas.
export function shardGeometry(pc, bake) {
  let poly = simplify(outline(bake), 0.9);
  if (poly.length < 3) poly = pc.poly;
  const shape = new THREE.Shape(); poly.forEach(([x, y], k) => (k ? shape.lineTo(x, -y) : shape.moveTo(x, -y)));
  const bev = 2.2, g = new THREE.ExtrudeGeometry(shape, { depth: SHARD_T - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.9, bevelOffset: -bev * 0.9, bevelSegments: 2, curveSegments: 1, steps: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, bev, 0);   // shape (x, -py) -> world (x, up, py); the base rests on y = 0
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - bake.x0) / bake.w, 1 - (pos.getZ(i) - bake.y0) / bake.h);
  uv.needsUpdate = true; g.computeVertexNormals();
  return g;
}

export function bakeTexture(cv) {
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.flipY = true;
  return t;
}

// Gold decal for the assembled vessel: dark cracks under raised gold, painted in vessel space (world 1:1, scaled by `S`) and shown on a plane.
export function makeGoldDecal(V, S = 0.8) {
  const b = V.bounds, x0 = b.x0 - 40, y0 = b.y0 - 40, w = b.w + 80, h = b.h + 80;
  const cv = mk(Math.ceil(w * S), Math.ceil(h * S)), g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { cv, g, tex, x0, y0, w, h, S, sig: '' };
}

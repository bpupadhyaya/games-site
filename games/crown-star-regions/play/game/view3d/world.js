// Crown Fields 3D world: the enamel field board in its gilt frame on an ebony plinth, the crowns, the velvet table, the crown
// cushion and the region plaque. Pure construction (geometry + materials); the presenter places and animates it.
// Units are centimetres. The tile area is always S x S (a 7x7 board has 4.3 cm tiles, a 10x10 board 3 cm), centred on the origin.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';

const TAU = Math.PI * 2;
export const S = 30;                 // tile area side
export const FR = 2.2;               // gilt frame width
export const PLINTH = 1.3;           // ebony plinth height (frame and tile bed sit on it)
export const TOP = 2.05;             // tile top surface
export const FRAME_TOP = 2.75;       // top of the gilt frame
const BED = 1.62;                    // tile bed (tiles stand on it)

const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const texOf = (c, srgb = true, rep = null) => {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
};

// ------------------------------------------------------------------ colours (same scheme maths as palettes.js regionColor)
export function regionRGB(palette, id, n, lightness, out = new THREE.Color()) {
  const [h, s, baseL] = palette.pick(id, n);
  const l = Math.max(10, Math.min(90, baseL !== undefined ? baseL + (lightness - 40) : lightness + (palette.light ?? 0)));
  return out.setHSL(h / 360, s / 100, l / 100, THREE.SRGBColorSpace);
}

// ------------------------------------------------------------------ materials
export function makeMaterials() {
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xf7bd3c, metalness: 1, roughness: 0.2, clearcoat: 0.5, clearcoatRoughness: 0.12 });
  gold.envMapIntensity = 2.6;
  const frameGold = new THREE.MeshPhysicalMaterial({ color: 0xe8b64a, metalness: 1, roughness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.25, bumpScale: 0.6 });
  frameGold.bumpMap = texOf(chaseCanvas(512), false, [6, 6]);
  frameGold.envMapIntensity = 1.5;
  const inlay = new THREE.MeshStandardMaterial({ color: 0xe0ab3c, metalness: 1, roughness: 0.27 });
  inlay.envMapIntensity = 1.5;
  const pearl = new THREE.MeshPhysicalMaterial({ color: 0xfff6e6, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 1, sheenColor: new THREE.Color(0xffd9f0) });
  const ruby = new THREE.MeshPhysicalMaterial({ color: 0xd0123c, roughness: 0.08, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, emissive: 0x3a0010 });
  const sapphire = new THREE.MeshPhysicalMaterial({ color: 0x2d4fe0, roughness: 0.08, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, emissive: 0x060c3a });
  const velvet = new THREE.MeshPhysicalMaterial({ color: 0x40061a, roughness: 0.92, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xff6a8a) });
  const ebony = B.material('darkWood', { color: '#2a160c', color2: '#43271a', seed: 11, repeat: [1, 1] });
  const bed = new THREE.MeshStandardMaterial({ color: 0x140a06, roughness: 0.8 });
  const cushion = new THREE.MeshPhysicalMaterial({ color: 0x5a0a20, roughness: 0.9, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(0xd04a70) });
  cushion.bumpMap = texOf(quiltCanvas(256), false, [3, 1]); cushion.bumpScale = 1.2;
  const amethyst = new THREE.MeshPhysicalMaterial({ color: 0x8c4dff, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, emissive: 0x1a0640 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xfff0d6, roughness: 0.45, transparent: true });
  return { gold, frameGold, inlay, pearl, ruby, sapphire, velvet, ebony, bed, cushion, amethyst, cream };
}

// fine chased lines for the gilt frame (bump)
function chaseCanvas(size) {
  const c = cv(size), x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, size, size);
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.05 + r() * 0.08})`; x.fillRect(r() * size, r() * size, 1 + r() * 3, 1 + r() * 3); }
  x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 2;
  for (let k = 0; k < size; k += size / 8) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + size / 8, size); x.stroke(); }
  return c;
}
// quilted cushion top (bump)
function quiltCanvas(size) {
  const c = cv(size), x = c.getContext('2d');
  x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, size, size);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const cx = (i + 0.5) * size / 4, cy = (j + 0.5) * size / 4, rg = x.createRadialGradient(cx, cy, 1, cx, cy, size / 5.5);
    rg.addColorStop(0, '#d8d8d8'); rg.addColorStop(1, '#5a5a5a'); x.fillStyle = rg; x.fillRect(cx - size / 8, cy - size / 8, size / 4, size / 4);
  }
  return c;
}

// The table: royal velvet with a woven gold lattice (the 2D backdrop's brocade, now a cloth you can see the light move on).
export function clothTextures(c0, c1) {
  const size = 512, c = cv(size), x = c.getContext('2d'), b = cv(size), bx = b.getContext('2d');
  const g = x.createLinearGradient(0, 0, size, size); g.addColorStop(0, c0); g.addColorStop(1, c1);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, size, size);
  let s = 3; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 26000; i++) {                       // velvet pile
    const px = r() * size, py = r() * size, a = r() * 0.07;
    x.fillStyle = r() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 1.4})`; x.fillRect(px, py, 1.5, 1.5);
    bx.fillStyle = r() < 0.5 ? `rgba(255,255,255,${a * 2})` : `rgba(0,0,0,${a * 2})`; bx.fillRect(px, py, 1.5, 1.5);
  }
  const step = size / 4;                                  // brocade lattice with a stud at every crossing
  x.strokeStyle = 'rgba(255,214,120,0.10)'; x.lineWidth = 2; bx.strokeStyle = 'rgba(255,255,255,0.5)'; bx.lineWidth = 2;
  for (const ctx of [x, bx]) {
    ctx.beginPath();
    for (let k = -size; k <= size * 2; k += step) { ctx.moveTo(k, 0); ctx.lineTo(k + size, size); ctx.moveTo(k, 0); ctx.lineTo(k - size, size); }
    ctx.stroke();
  }
  for (let j = 0; j <= 8; j++) for (let i = 0; i <= 8; i++) {
    if ((i + j) % 2) continue;
    const px = i * step / 2, py = j * step / 2;
    for (const [ctx, col] of [[x, 'rgba(255,220,140,0.22)'], [bx, 'rgba(255,255,255,0.9)']]) {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(px, py - 9); ctx.lineTo(px + 9, py); ctx.lineTo(px, py + 9); ctx.lineTo(px - 9, py); ctx.closePath(); ctx.fill();
    }
  }
  return { map: texOf(c, true, [18, 18]), bump: texOf(b, false, [18, 18]) };
}

// Tile patterns (one per region id % 10, as in the flat art): a soft engraving in the enamel; strong for the colour-blind scheme.
const patCache = new Map();
export function patternTexture(kind, strong) {
  const key = `${kind}|${strong ? 1 : 0}`; if (patCache.has(key)) return patCache.get(key);
  const size = 128, c = cv(size), x = c.getContext('2d');
  x.fillStyle = strong ? '#ffffff' : '#e6e6e6'; x.fillRect(0, 0, size, size);
  const col = strong ? 'rgba(20,10,40,0.55)' : 'rgba(255,255,255,1)';
  x.strokeStyle = col; x.fillStyle = col; x.lineWidth = strong ? 5 : 3.5;
  const cs = size, step = cs / 4;
  x.beginPath();
  if (kind === 1) { for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { x.moveTo(cs * (0.2 + i * 0.3) + 6, cs * (0.2 + j * 0.3)); x.arc(cs * (0.2 + i * 0.3), cs * (0.2 + j * 0.3), 6, 0, TAU); } x.fill(); }
  else if (kind === 2 || kind === 4 || kind === 6) { for (let d = -cs; d < cs * 2; d += step) { if (kind !== 4) { x.moveTo(d, cs); x.lineTo(d + cs, 0); } if (kind !== 2) { x.moveTo(d, 0); x.lineTo(d + cs, cs); } } x.stroke(); }
  else if (kind === 3 || kind === 5) { for (let d = step / 2; d < cs; d += step) { if (kind === 3) { x.moveTo(0, d); x.lineTo(cs, d); } else { x.moveTo(d, 0); x.lineTo(d, cs); } } x.stroke(); }
  else if (kind === 7) { x.arc(cs / 2, cs / 2, cs * 0.3, 0, TAU); x.moveTo(cs / 2 + cs * 0.14, cs / 2); x.arc(cs / 2, cs / 2, cs * 0.14, 0, TAU); x.stroke(); }
  else if (kind === 8) { for (const k of [0.34, 0.17]) { x.moveTo(cs / 2, cs / 2 - cs * k); x.lineTo(cs / 2 + cs * k, cs / 2); x.lineTo(cs / 2, cs / 2 + cs * k); x.lineTo(cs / 2 - cs * k, cs / 2); x.closePath(); } x.stroke(); }
  else if (kind === 9) { for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const px = cs * (0.28 + i * 0.44), py = cs * (0.28 + j * 0.44), a = cs * 0.09; x.moveTo(px - a, py); x.lineTo(px + a, py); x.moveTo(px, py - a); x.lineTo(px, py + a); } x.stroke(); }
  const t = texOf(c); patCache.set(key, t); return t;
}

// ------------------------------------------------------------------ crown (unit size: band radius 1, height ~1.3)
export function crownGeometries() {
  const band = B.lathe([[0.86, 0], [1.0, 0], [1.08, 0.05], [1.08, 0.12], [1.04, 0.15], [1.04, 0.4], [1.09, 0.44], [1.09, 0.5], [1.0, 0.54], [0.86, 0.54], [0.86, 0]], 40);
  const parts = [{ geo: band }], pearls = [], ruby = [], saph = [];
  // the points: flat gilt plates with gently curved sides, standing on the band edge to edge (5 tall, 5 short)
  const plate = (w, h) => {
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2, 0); sh.quadraticCurveTo(-w * 0.12, h * 0.42, 0, h); sh.quadraticCurveTo(w * 0.12, h * 0.42, w / 2, 0); sh.lineTo(-w / 2, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 10 });
    g.translate(0, 0, -0.025); g.computeVertexNormals(); return g;
  };
  const tall = plate(0.66, 0.92), short = plate(0.66, 0.5);
  const one = new THREE.Vector3(1, 1, 1);
  const pearlG = new THREE.SphereGeometry(0.1, 16, 12), bead = new THREE.SphereGeometry(0.07, 12, 10), gem = new THREE.SphereGeometry(0.11, 16, 12);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU + Math.PI / 2, big = k % 2 === 0, h = big ? 0.92 : 0.5, r = 1.0;
    const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const lean = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), big ? 0.14 : 0.1);
    const qq = lean.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2 - a, 0)));
    const p = new THREE.Vector3(out.x * r, 0.48, out.z * r);
    parts.push({ geo: big ? tall : short, m: new THREE.Matrix4().compose(p, qq, one) });
    const tip = new THREE.Vector3(0, h + (big ? 0.07 : 0.05), 0).applyQuaternion(qq).add(p);
    (big ? pearls : parts).push({ geo: big ? pearlG : bead, m: new THREE.Matrix4().makeTranslation(tip.x, tip.y, tip.z) });
    const ga = a + Math.PI / 10;
    (k % 2 ? saph : ruby).push({ geo: gem, m: new THREE.Matrix4().makeTranslation(Math.cos(ga) * 1.06, 0.27, Math.sin(ga) * 1.06) });
  }
  // gem settings face outward: squash along the radius
  for (const list of [ruby, saph]) for (const g of list) {
    const pos = new THREE.Vector3().setFromMatrixPosition(g.m), a = Math.atan2(pos.z, pos.x);
    g.m = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0)), new THREE.Vector3(0.55, 1, 1));
  }
  // orb on top of the velvet cap
  // two gilt arches over the cap, meeting under the orb
  for (const ry of [0, Math.PI / 2]) {
    const arch = new THREE.TorusGeometry(0.92, 0.075, 8, 28, Math.PI);
    arch.scale(1, 0.62, 1); arch.rotateY(ry); arch.translate(0, 0.46, 0);
    parts.push({ geo: arch });
  }
  const orb = new THREE.SphereGeometry(0.16, 20, 14);
  parts.push({ geo: orb, m: new THREE.Matrix4().makeTranslation(0, 1.08, 0) });
  const cap = new THREE.SphereGeometry(0.9, 28, 14, 0, TAU, 0, Math.PI / 2); cap.scale(1, 0.5, 1); cap.translate(0, 0.3, 0);
  return { gold: B.mergeGeos(parts), pearl: B.mergeGeos(pearls), ruby: B.mergeGeos(ruby), sapphire: B.mergeGeos(saph), velvet: cap };
}

// ------------------------------------------------------------------ board
// The tile slab (shared by every tile; scaled per board size in x/z).
export function tileGeometry() { return B.slab(1, 1, 0.42, 0.09, 0.1, { bottom: false }); }

export function frameGeometry() {
  const o = S / 2 + FR, i = S / 2 + 0.25, r = 1.2;
  const shape = new THREE.Shape();
  shape.moveTo(-o + r, -o); shape.lineTo(o - r, -o); shape.quadraticCurveTo(o, -o, o, -o + r); shape.lineTo(o, o - r); shape.quadraticCurveTo(o, o, o - r, o);
  shape.lineTo(-o + r, o); shape.quadraticCurveTo(-o, o, -o, o - r); shape.lineTo(-o, -o + r); shape.quadraticCurveTo(-o, -o, -o + r, -o);
  const hole = new THREE.Path(); hole.moveTo(-i, -i); hole.lineTo(-i, i); hole.lineTo(i, i); hole.lineTo(i, -i); hole.lineTo(-i, -i);
  shape.holes.push(hole);
  const h = FRAME_TOP - PLINTH, bev = 0.45;
  const g = new THREE.ExtrudeGeometry(shape, { depth: h - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: 0.5, bevelSegments: 4, curveSegments: 8 });
  g.rotateX(-Math.PI / 2); g.translate(0, PLINTH + bev, 0); g.computeVertexNormals();
  // UVs for the chased bump: planar from x/z
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let k = 0; k < pos.count; k++) uv.setXY(k, pos.getX(k) / 12 + pos.getY(k) / 20, pos.getZ(k) / 12);
  return g;
}

// Raised gold inlay strips wherever two regions meet (one merged mesh per puzzle).
export function inlayGeometry(regions, n) {
  const cs = S / n, w = Math.max(0.22, cs * 0.075), parts = [], bar = B.roundedBox(1, 1, 1, 0.45, 2);
  const at = (x, z, sx, sz) => parts.push({ geo: bar, m: new THREE.Matrix4().compose(new THREE.Vector3(x, TOP + 0.02, z), new THREE.Quaternion(), new THREE.Vector3(sx, 0.26, sz)) });
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const i = r * n + c, x0 = -S / 2 + c * cs, z0 = -S / 2 + r * cs;
    if (c < n - 1 && regions[i] !== regions[i + 1]) at(x0 + cs, z0 + cs / 2, w, cs + w);
    if (r < n - 1 && regions[i] !== regions[i + n]) at(x0 + cs / 2, z0 + cs, cs + w, w);
  }
  return parts.length ? B.mergeGeos(parts) : new THREE.BufferGeometry();
}

// Static board pieces (plinth, bed, frame, corner studs).
export function buildBoardBase(mats) {
  const g = new THREE.Group();
  const pl = new THREE.Mesh(B.slab(S + 2 * FR + 2.4, S + 2 * FR + 2.4, PLINTH, 1.8, 0.35), mats.ebony);
  pl.castShadow = true; pl.receiveShadow = true; g.add(pl);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(S + 0.6, BED - PLINTH, S + 0.6), mats.bed);
  bed.position.y = (BED + PLINTH) / 2; bed.receiveShadow = true; g.add(bed);
  const fr = new THREE.Mesh(frameGeometry(), mats.frameGold); fr.castShadow = true; fr.receiveShadow = true; g.add(fr);
  const stud = B.lathe([[0, 0], [0.55, 0], [0.62, 0.12], [0.5, 0.42], [0.25, 0.6], [0, 0.64]], 24);
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const m = new THREE.Mesh(stud, mats.amethyst); m.position.set(u * (S / 2 + FR / 2 + 0.1), FRAME_TOP - 0.05, v * (S / 2 + FR / 2 + 0.1)); m.castShadow = true; g.add(m);
  }
  return g;
}

// The velvet cushion that holds the crowns still to be placed.
export function buildCushion(mats) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(B.roundedBox(26, 2.4, 6.2, 1.15, 6), mats.cushion);
  body.position.y = 1.2; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const tassel = B.lathe([[0, 0], [0.32, 0.05], [0.45, 0.5], [0.3, 1.0], [0.12, 1.2], [0.16, 1.45], [0, 1.6]], 16);
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const t = new THREE.Mesh(tassel, mats.inlay); t.position.set(u * 13.1, 0, v * 3.1); t.castShadow = true; g.add(t);
  }
  return g;
}

// The region plaque: a gilt bar with one enamel cabochon per region; a region's stone glows once it holds a crown.
export function cabochonGeometry() { return B.lathe([[0, 0], [0.62, 0], [0.66, 0.08], [0.58, 0.3], [0.38, 0.48], [0, 0.55]], 28); }
export function buildPlaque(mats) {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(B.slab(30, 3.4, 0.7, 1.2, 0.25), mats.frameGold);
  bar.castShadow = true; bar.receiveShadow = true; g.add(bar);
  return g;
}

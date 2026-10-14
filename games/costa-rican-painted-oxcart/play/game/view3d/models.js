// Sculpted models for the painted oxcart workshop: the wheel, the cart side panel / yoke board, paint jars, brush, rag.
// Pure geometry + materials; the presenter owns the scene. Everything is built from the same geometry data as the 2D art (src/geo.js).
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { HUB, RIM0, TAU } from '../src/geo.js';
import { PAINT } from '../src/art.js';

const hash = (n) => { let h = Math.imul(n + 1, 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; return (h >>> 0) / 4294967296; };
export const CELL_TOP_WHEEL = 0.17, CELL_TOP_GRID = 0.19;
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, repeat, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); } return t; };

// ---------------------------------------------------------------- materials (built once, shared)
const M = {};
const once = (k, f) => (M[k] ??= f());
// dry-brush streak bump: fine parallel strokes so painted segments read as brush work, not plastic
const streakBump = () => once('streak', () => {
  const c = cv(256), x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 150; i++) { const y = hash(i) * 256, a = 0.08 + hash(i + 400) * 0.22; x.strokeStyle = hash(i + 9) < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; x.lineWidth = 0.6 + hash(i + 77) * 1.8; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(80, y + (hash(i + 3) - 0.5) * 6, 170, y + (hash(i + 5) - 0.5) * 6, 256, y); x.stroke(); }
  return tex(c, [3, 3], false);
});
export const paintMat = (id) => once(`p:${id}`, () => new THREE.MeshPhysicalMaterial({ color: PAINT[id].base, roughness: 0.34, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.14, bumpMap: streakBump(), bumpScale: 0.35, envMapIntensity: 1.1 }));
export const petalMat = (id) => once(`l:${id}`, () => new THREE.MeshPhysicalMaterial({ color: PAINT[id].light, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, bumpMap: streakBump(), bumpScale: 0.25, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
export const bareMat = (i) => once(`b:${i % 3}`, () => B.material('wood', { color: ['#e0c79a', '#d6b985', '#e6cfa6'][i % 3], color2: ['#c9a874', '#bf9c68', '#d3b585'][i % 3], seed: 11 + (i % 3) * 7, repeat: [1.4, 1.4], roughness: 0.62 }));
export const timberMat = () => once('timber', () => B.material('darkWood', { color: '#6b4126', color2: '#8a5a34', seed: 4, repeat: [2.2, 2.2], roughness: 0.5 }));
export const darkMat = () => once('dark', () => new THREE.MeshStandardMaterial({ color: '#2a1608', roughness: 0.7 }));
export const brassMat = () => once('brass', () => new THREE.MeshStandardMaterial({ color: '#d9a93a', metalness: 0.9, roughness: 0.28, envMapIntensity: 1.6 }));
export const creamMat = () => once('cream', () => new THREE.MeshStandardMaterial({ color: '#fff3d6', roughness: 0.45 }));
export const glowMats = () => once('glow', () => ({
  hi: new THREE.MeshBasicMaterial({ color: 0xffd868, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  sel: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
  pop: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
}));

// ---------------------------------------------------------------- shapes
// Shape coordinates are (world x, world z). rotateX(+90deg) maps (x, y, depth) -> (x, -depth, y), so a z extrusion hangs below y = 0;
// the geometry is then lifted by its depth so the top face sits at y = depth.
const flat = (g, depth) => { g.rotateX(Math.PI / 2); g.translate(0, depth, 0); return g; };
function sectorShape(r0, r1, a0, a1) {
  const s = new THREE.Shape();
  s.moveTo(Math.cos(a0) * r1, Math.sin(a0) * r1);
  s.absarc(0, 0, r1, a0, a1, false);
  s.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0);
  s.absarc(0, 0, r0, a1, a0, true);
  s.closePath();
  return s;
}
const extrude = (shape, depth, bevel = 0.01, seg = 6) => flat(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: seg }), depth + bevel);
const lens = (r0, r1, am, half) => {
  const rm = (r0 + r1) / 2, k = rm / Math.cos(half), pt = (rad, an) => [Math.cos(an) * rad, Math.sin(an) * rad];
  const p0 = pt(r0, am), p1 = pt(r1, am), k1 = pt(k, am - half), k2 = pt(k, am + half), s = new THREE.Shape();
  s.moveTo(p0[0], p0[1]); s.quadraticCurveTo(k1[0], k1[1], p1[0], p1[1]); s.quadraticCurveTo(k2[0], k2[1], p0[0], p0[1]);
  return s;
};

const GAP = 0.012, BEV = 0.01, INS = GAP + BEV;
function cellShape(c) {
  if (c.shape === 'disc') { const s = new THREE.Shape(); s.absarc(0, 0, c.r1 - INS, 0, TAU, false); return s; }
  const da = INS / ((c.r0 + c.r1) / 2);
  return sectorShape(c.r0 + INS, c.r1 - INS, c.a0 + da, c.a1 - da);
}

// ---------------------------------------------------------------- the pieces
// Returns { group, cells: [{ id, orbit, mesh, petal, dot, glow, y0, mid }], top, half: [hx, hz], pegs(Set)->void }
export function buildPiece(P) {
  return P.kind === 'wheel' ? buildWheel(P) : buildGrid(P);
}
function mk(geo, mat, shadow = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; return m; }

function buildWheel(P) {
  const group = new THREE.Group(), cells = [], DEPTH = 0.042, Y0 = 0.075, T = 0.74;
  // timber disc under the paint, dark so the gaps between segments read as the painter's pinstripe
  const base = mk(new THREE.CylinderGeometry(RIM0 + 0.03, RIM0 + 0.03, 0.09, 72), darkMat()); base.position.y = 0.045; group.add(base);
  // the tyre: a rounded timber felloe ring
  const prof = [[RIM0, 0], [RIM0, 0.2], [RIM0 + 0.012, 0.226], [RIM0 + 0.05, 0.238], [0.985, 0.226], [1.0, 0.2], [1.0, 0.0]].map(([r, y]) => new THREE.Vector2(r, y * T));
  const tyre = mk(new THREE.LatheGeometry(prof, 96), timberMat()); group.add(tyre);
  // brass studs round the tyre
  const studs = Math.min(32, (P.geom.sectors || 12) * 2), sg = new THREE.SphereGeometry(0.021, 10, 7);
  const st = new THREE.InstancedMesh(sg, brassMat(), studs), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 0.62, 1);
  for (let i = 0; i < studs; i++) { const an = (i / studs) * TAU, rr = (RIM0 + 1.0) / 2 + 0.0; m4.compose(new THREE.Vector3(Math.cos(an) * rr, 0.234 * T, Math.sin(an) * rr), q, sc); st.setMatrixAt(i, m4); }
  st.castShadow = true; group.add(st);
  // segments
  const bare = [];
  for (const c of P.cells) {
    const geo = extrude(cellShape(c), DEPTH, BEV);
    const mesh = mk(geo, bareMat(c.id)); mesh.position.y = Y0; group.add(mesh);
    let petal = null, dot = null;
    if (c.shape === 'sector') {
      const am = (c.a0 + c.a1) / 2, dr = c.r1 - c.r0, half = ((c.a1 - c.a0) / 2) * 0.62;
      petal = new THREE.Mesh(extrude(lens(c.r0 + dr * 0.16, c.r1 - dr * 0.12, am, half), 0.004, 0), petalMat('red'));
      petal.position.y = Y0 + DEPTH + BEV + 0.001; petal.receiveShadow = true; petal.visible = false; group.add(petal);
      if (c.ring >= P.geom.rings - 1 || c.ring === 0) {
        dot = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.006, 10), creamMat());
        const rr = (c.r0 + c.r1) / 2; dot.position.set(Math.cos(am) * rr, Y0 + DEPTH + BEV + 0.006, Math.sin(am) * rr); dot.visible = false; group.add(dot);
      }
    }
    cells.push({ id: c.id, orbit: c.orbit, mesh, petal, dot, glow: null, y0: Y0, mid: c.mid, c });
    bare.push(c);
  }
  // brass hub cap with four bolts
  const cap = new THREE.LatheGeometry([[0, 0.205], [0.06, 0.205], [0.086, 0.222], [0.082, 0.245], [0.05, 0.27], [0.0, 0.282]].map(([r, y]) => new THREE.Vector2(r, 0.205 * T + (y - 0.205) * 0.9)), 40);
  const hub = mk(cap, brassMat()); group.add(hub);
  for (let i = 0; i < 4; i++) { const b = mk(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 8), darkMat(), false); const an = (i / 4) * TAU + 0.4; b.position.set(Math.cos(an) * 0.052, 0.2, Math.sin(an) * 0.052); group.add(b); }
  return { group, cells, top: Y0 + DEPTH + BEV, half: [1.02, 1.02], kind: 'wheel', y0: Y0, depth: DEPTH };
}

function buildGrid(P) {
  const g = P.geom, group = new THREE.Group(), cells = [], C = g.cols, Rr = g.rows, m = 0.34, yoke = g.kind === 'yoke';
  const W = C + 2 * m, H = Rr + 2 * m, Y0 = 0.1, DEPTH = 0.06;
  const board = mk(B.slab(W, H, 0.14, yoke ? 0.4 : 0.14, 0.05, { per: 6 }), timberMat()); group.add(board);
  // nails round the frame (every second column / row, as in the 2D art)
  const nailG = new THREE.SphereGeometry(0.045, 10, 7), nails = [];
  for (let i = 0; i <= C; i += 2) { nails.push([-C / 2 + i, -H / 2 + m / 2], [-C / 2 + i, H / 2 - m / 2]); }
  for (let j = 0; j <= Rr; j += 1) { nails.push([-W / 2 + m / 2, -Rr / 2 + j], [W / 2 - m / 2, -Rr / 2 + j]); }
  const ni = new THREE.InstancedMesh(nailG, brassMat(), nails.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 0.5, 1);
  nails.forEach(([x, z], i) => { m4.compose(new THREE.Vector3(x, 0.14, z), q, sc); ni.setMatrixAt(i, m4); }); ni.castShadow = true; group.add(ni);
  const sg = B.slab(0.9, 0.9, DEPTH, 0.07, 0.022, { per: 4 }), pg = B.slab(0.5, 0.5, 0.012, 0.14, 0.006, { per: 4 });
  for (const c of P.cells) {
    const x = c.x + 0.5 - C / 2, z = c.y + 0.5 - Rr / 2;
    const mesh = mk(sg, bareMat(c.id)); mesh.position.set(x, Y0, z); group.add(mesh);
    const petal = new THREE.Mesh(pg, petalMat('red')); petal.position.set(x, Y0 + DEPTH, z); petal.rotation.y = Math.PI / 4; petal.scale.set(1.1, 1, 1.1); petal.visible = false; petal.receiveShadow = true; group.add(petal);
    cells.push({ id: c.id, orbit: c.orbit, mesh, petal, dot: null, glow: null, y0: Y0, mid: c.mid, c, x, z });
  }
  return { group, cells, top: Y0 + DEPTH + 0.022, half: [W / 2, H / 2], kind: g.kind, y0: Y0, depth: DEPTH };
}

// flat additive glow plate for one cell (highlight / pop flash); created lazily
const glowGeos = new WeakMap();
export function glowFor(piece, cell) {
  if (cell.glow) return cell.glow;
  let geo;
  if (piece.kind === 'wheel') geo = flat(new THREE.ExtrudeGeometry(cellShape(cell.c), { depth: 0.002, bevelEnabled: false, curveSegments: 6 }), 0.002);
  else { geo = glowGeos.get(piece) ?? flat(new THREE.ExtrudeGeometry((() => { const s = new THREE.Shape(); const h = 0.45; s.moveTo(-h, -h); s.lineTo(h, -h); s.lineTo(h, h); s.lineTo(-h, h); s.closePath(); return s; })(), { depth: 0.002, bevelEnabled: false }), 0.002); glowGeos.set(piece, geo); }
  const m = new THREE.Mesh(geo, glowMats().hi); m.renderOrder = 3; m.visible = false;
  if (piece.kind !== 'wheel') m.position.set(cell.x, piece.top + 0.012, cell.z); else m.position.y = piece.top + 0.012;
  piece.group.add(m); cell.glow = m; return m;
}
// brass peg marking a segment the master painted
export function pegFor(piece, cell) {
  if (cell.peg) return cell.peg;
  const p = mk(new THREE.CylinderGeometry(0.02, 0.024, 0.03, 12), brassMat(), false);
  if (piece.kind === 'wheel') { const c = cell.c, am = (c.a0 + c.a1) / 2, rr = c.r0 + (c.r1 - c.r0) * 0.82; p.position.set(Math.cos(am) * rr, piece.top + 0.012, Math.sin(am) * rr); }
  else p.position.set(cell.x + 0.34, piece.top + 0.012, cell.z - 0.34);
  p.visible = false; piece.group.add(p); cell.peg = p; return p;
}

// ---------------------------------------------------------------- paint jar (unit: body radius 0.5, height 1; lid above)
export function buildJar() {
  const g = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.14, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false, envMapIntensity: 1.8 });
  const prof = [[0, 0], [0.36, 0], [0.47, 0.03], [0.5, 0.12], [0.5, 0.9], [0.47, 0.98], [0.4, 1.02]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), glass); body.renderOrder = 4;
  const paint = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 1, 32), paintMat('red')); paint.position.y = 0.5;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.13, 28), brassMat()); lid.position.y = 1.07;
  const lidTop = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.05, 28), brassMat()); lidTop.position.y = 1.16;
  g.add(paint, body, lid, lidTop);
  g.userData = { paint, body, lid, glass };
  return g;
}

// ---------------------------------------------------------------- brush + rag + stains (set dressing on the bench)
export function buildBrush(colour = '#d63a2a') {
  const g = new THREE.Group();
  const handle = mk(new THREE.CylinderGeometry(0.035, 0.05, 1.5, 12), B.material('wood', { color: '#b97a3a', color2: '#d49a52', repeat: [1, 3] }));
  handle.rotation.z = Math.PI / 2; handle.position.x = -0.2;
  const ferrule = mk(new THREE.CylinderGeometry(0.058, 0.05, 0.22, 14), new THREE.MeshStandardMaterial({ color: '#b8bcc4', metalness: 0.9, roughness: 0.3 }));
  ferrule.rotation.z = Math.PI / 2; ferrule.position.x = 0.66;
  const tuft = mk(new THREE.CylinderGeometry(0.0, 0.06, 0.34, 14), new THREE.MeshPhysicalMaterial({ color: colour, roughness: 0.55, clearcoat: 0.4 }));
  tuft.rotation.z = -Math.PI / 2; tuft.position.x = 0.94;
  g.add(handle, ferrule, tuft); g.children.forEach((c) => { c.position.y += 0.06; });
  return g;
}
export function buildRag() {
  const c = cv(128), x = c.getContext('2d'); x.fillStyle = '#c9a06a'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 6) { x.fillStyle = 'rgba(120,70,30,0.35)'; x.fillRect(i, 0, 3, 128); x.fillRect(0, i, 128, 3); }
  for (const [px, py, col] of [[30, 40, '#dc3a2c'], [80, 80, '#2168d4'], [60, 100, '#f8c623']]) { x.fillStyle = col; x.globalAlpha = 0.6; x.beginPath(); x.arc(px, py, 14, 0, TAU); x.fill(); }
  x.globalAlpha = 1;
  const m = new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.95 });
  const geo = new THREE.BoxGeometry(0.9, 0.05, 0.62, 12, 1, 8);
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.sin(p.getX(i) * 6) * 0.025 + Math.cos(p.getZ(i) * 7) * 0.02);
  geo.computeVertexNormals();
  return mk(geo, m);
}
// a puddle / drip of paint on the table: flat glossy blob
export function buildStain(colour, r = 0.12, seed = 1) {
  const s = new THREE.Shape(), n = 16;
  for (let i = 0; i <= n; i++) { const a = (i / n) * TAU, rr = r * (0.75 + hash(seed * 31 + (i % n)) * 0.5); (i ? s.lineTo : s.moveTo).call(s, Math.cos(a) * rr, Math.sin(a) * rr); }
  const m = new THREE.Mesh(flat(new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: false }), 0.006), new THREE.MeshPhysicalMaterial({ color: colour, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }));
  m.receiveShadow = true; return m;
}

// ---------------------------------------------------------------- the workbench top: planks with seams, grain and stains
export function plankTextures() {
  const S = 1024, c = cv(S), x = c.getContext('2d'), bump = cv(S), bx = bump.getContext('2d'), n = 5, ph = S / n;
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, S, S);
  const tones = [['#6a4224', '#8c5b30'], ['#5a371d', '#7a4c27'], ['#734827', '#96643a'], ['#60391d', '#82552d'], ['#6d4526', '#8f5f35']];
  for (let i = 0; i < n; i++) {
    const w = B.woodCanvas(256, tones[i][0], tones[i][1], 20 + i * 5, { lines: 70, knots: 1 });
    x.save(); x.beginPath(); x.rect(0, i * ph, S, ph); x.clip();
    for (let k = 0; k < 4; k++) { x.drawImage(w.map, k * 256, i * ph, 256, ph); bx.drawImage(w.bump, k * 256, i * ph, 256, ph); }
    x.restore();
    x.fillStyle = 'rgba(10,4,0,0.8)'; x.fillRect(0, i * ph, S, 3); bx.fillStyle = 'rgba(0,0,0,0.9)'; bx.fillRect(0, i * ph, S, 4);
    // butt joints
    const jx = 120 + ((i * 331) % 700); x.fillStyle = 'rgba(10,4,0,0.7)'; x.fillRect(jx, i * ph, 3, ph); bx.fillStyle = 'rgba(0,0,0,0.9)'; bx.fillRect(jx, i * ph, 4, ph);
  }
  // sawdust and scuffs
  for (let i = 0; i < 700; i++) { x.fillStyle = hash(i) < 0.5 ? 'rgba(255,230,180,0.07)' : 'rgba(0,0,0,0.1)'; x.fillRect(hash(i + 5) * S, hash(i + 9) * S, 1 + hash(i + 2) * 3, 1 + hash(i + 8) * 2); }
  return { map: tex(c, [6, 6]), bump: tex(bump, [6, 6], false) };
}
export const unitJarProfile = null;

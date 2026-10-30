// City gates and skylines for the nine cities, and the props of the road encounters. Built from lit primitives with procedural textures.
// Real details: Tang gate towers with grey tiled hipped roofs (Chang'an), rammed-earth forts (Dunhuang), ventilated brick grape-drying
// houses (Turpan), a lapis and turquoise tiled portal with a ribbed dome (Samarkand), the corrugated walls of Merv, a citadel on its hill
// (Rayy), the round city's green dome (Baghdad). No places of worship are shown.
import { THREE } from '../vendor3d/index.js';
import { brickTexture, tileTexture, roofTexture, clothTexture } from './tex.js';
import { mergeGeos } from './world.js';

const hash = (n) => { n = Math.imul(n ^ (n >>> 15), 0x85ebca6b); n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const M = new Map();
const std = (key, o) => { let m = M.get(key); if (!m) { m = new THREE.MeshStandardMaterial(o); M.set(key, m); } return m; };
const mud = (col, rammed) => std('mud' + col + rammed, { map: brickTexture(col, rammed), roughness: 0.95 });   // UVs are in metres / 5 (see box)
const tile = (a, b, rep = 3) => std('tile' + a + b + rep, { map: (() => { const t = tileTexture(a, b).clone(); t.needsUpdate = true; t.repeat.set(rep, rep); return t; })(), roughness: 0.35, metalness: 0.05 });
const roof = (col) => std('roof' + col, { map: roofTexture(col), roughness: 0.7 });
const plain = (col, r = 0.85, m = 0) => std('p' + col + r + m, { color: col, roughness: r, metalness: m });

function mesh(g, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; }
function boxGeo(w, h, d) {          // box with UVs in world metres / 5, so brick courses keep their real size on every wall
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / 5, uv.getY(k) * dims[f][1] / 5); }
  return g;
}
const box = (w, h, d, m, x, y, z) => mesh(boxGeo(w, h, d), m, x, y + h / 2, z);

// A wall run along X with crenels (merlons) on top.
function wall(group, x0, x1, h, d, m, z, crenel = 1) {
  const w = x1 - x0; group.add(box(w, h, d, m, (x0 + x1) / 2, 0, z));
  if (crenel) { const n = Math.floor(w / 1.6); for (let i = 0; i < n; i++) group.add(box(0.8, 0.8, d * 0.9, m, x0 + 0.8 + i * (w / n), h, z)); }
}
// A gate house: thick block with an arched passage (extruded).
function gateHouse(group, x, w, h, d, m, z, archW = 4, archH = 6) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.lineTo(-w / 2, 0);
  const hole = new THREE.Path(); hole.moveTo(-archW / 2, 0); hole.lineTo(-archW / 2, archH - archW / 2); hole.absarc(0, archH - archW / 2, archW / 2, Math.PI, 0, true); hole.lineTo(archW / 2, 0); hole.lineTo(-archW / 2, 0); s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.2, uv.getY(i) * 0.2);
  group.add(mesh(g, m, x, 0, z));
  group.add(mesh(new THREE.PlaneGeometry(archW, archH), plain('#1a120c', 1), x, archH / 2, z - d * 0.3));   // shadowed passage
}
// Tang hipped roof with upturned eaves: a lofted box whose corners lift.
function tangRoof(group, x, y, z, w, d, h, col = '#474c56') {
  const g = new THREE.BoxGeometry(w, h, d, 12, 1, 6); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let px = p.getX(i), py = p.getY(i), pz = p.getZ(i); const top = py > 0;
    if (top) { px *= 0.42; pz *= 0.18; }
    else { const ex = Math.abs(px) / (w / 2), ez = Math.abs(pz) / (d / 2); py += Math.pow(Math.max(ex, ez), 6) * h * 0.55; }
    p.setXYZ(i, px, py, pz);
  }
  g.computeVertexNormals(); const r = mesh(g, roof(col), x, y + h / 2, z); group.add(r);
  group.add(box(w * 0.44, 0.35, 0.35, plain('#2c2f36'), x, y + h, z));     // ridge
}
function dome(group, x, y, z, r, m, ribbed = false) {
  const pts = []; for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r * (1 + 0.12 * Math.sin(a * 2)), Math.sin(a) * r * 1.25)); } pts.push(new THREE.Vector2(0, r * 1.28));
  const g = new THREE.LatheGeometry(pts, ribbed ? 48 : 32);
  if (ribbed) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const ang = Math.atan2(p.getZ(i), p.getX(i)), k = 1 + 0.035 * Math.cos(ang * 24); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } g.computeVertexNormals(); }
  group.add(mesh(g, m, x, y, z));
  group.add(mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, r * 0.5, 32), mud('#d8c4a0', false, 3), x, y - r * 0.25, z));   // drum
}
// flat-roofed houses scattered behind a wall
function houses(group, n, x0, x1, z0, z1, cols, seed, hMin = 3, hMax = 6) {
  for (let i = 0; i < n; i++) {
    const w = 3 + hash(seed + i) * 4, d = 3 + hash(seed + i * 3) * 3, h = hMin + hash(seed + i * 7) * (hMax - hMin);
    const x = x0 + hash(seed + i * 11) * (x1 - x0), z = z0 + hash(seed + i * 13) * (z1 - z0);
    const m = mud(cols[i % cols.length], false, 1.5); group.add(box(w, h, d, m, x, 0, z)); group.add(box(w + 0.2, 0.4, d + 0.2, m, x, h, z));
    if (hash(seed + i * 17) > 0.6) group.add(box(0.9, 1.4, 0.05, plain('#2a1a10', 1), x, 0, z + d / 2 + 0.03));   // doorway
  }
}
function trees(group, kind, list) {
  for (const [x, z, s] of list) {
    if (kind === 'palm') {
      const t = new THREE.Group(); t.position.set(x, 0, z); t.scale.setScalar(s);
      t.add(mesh(new THREE.CylinderGeometry(0.14, 0.22, 6.5, 7), plain('#7a6248'), 0, 3.25, 0));
      for (let k = 0; k < 8; k++) { const f = mesh(new THREE.SphereGeometry(1, 8, 4), plain('#4f7a36'), 0, 6.4, 0); f.scale.set(1.8, 0.12, 0.35); f.rotation.y = k * 0.8; f.rotation.z = -0.35; f.position.x = Math.cos(k * 0.8) * 1.2; f.position.z = -Math.sin(k * 0.8) * 1.2; t.add(f); }
      group.add(t);
    } else { group.add(mesh(new THREE.CylinderGeometry(0.1, 0.16, 2.5, 6), plain('#5a4632'), x, 1.25 * s, z)); const c = mesh(new THREE.SphereGeometry(1, 10, 8), plain('#5f7c38'), x, 4.2 * s, z); c.scale.set(0.8 * s, 2.6 * s, 0.8 * s); group.add(c); }
  }
}

// Build the city for a skyline key. Origin: gate centre on the ground; the city spreads along X and back into -Z.
export function buildCity(key) {
  const g = new THREE.Group();
  const earth = mud('#c8a070', true, 6), earthDark = mud('#a88050', true, 6), brick = mud('#c9a57a', false, 6);
  if (key === 'tang') {          // Chang'an: rammed-earth wall, brick gate base, a two-storey timber gate tower with grey tiled roofs
    wall(g, -60, -7, 9, 5, earth, 0, 0); wall(g, 7, 60, 9, 5, earth, 0, 0);
    gateHouse(g, 0, 15, 10, 8, brick, 0, 4.5, 7);
    const red = plain('#8e2a1e', 0.7); for (const x of [-5.5, -2, 2, 5.5]) g.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 4.2, 10), red, x, 12.1, 2.6));
    g.add(box(13, 0.5, 6, plain('#6a4a32'), 0, 10, 0)); g.add(box(12, 3.4, 4.6, plain('#d8cdb8', 0.9), 0, 10.4, 0));
    tangRoof(g, 0, 13.8, 0, 17, 9, 2.6); g.add(box(10, 2, 4, plain('#d8cdb8', 0.9), 0, 16.2, 0)); tangRoof(g, 0, 17.6, 0, 13, 7, 2.4);
    for (const x of [-40, -25, 22, 41]) tangRoof(g, x, 8.5, -14 - hash(x) * 10, 9, 6, 2, '#565a62');
    trees(g, 'poplar', [[-14, 6, 1], [-20, 7, 0.9], [16, 6, 1.1], [24, 7, 0.9]]);
  } else if (key === 'river') {  // Lanzhou: on the Yellow River, low walls and tiled roofs
    wall(g, -50, -5, 6, 4, earth, 0); wall(g, 5, 50, 6, 4, earth, 0); gateHouse(g, 0, 10, 7.5, 6, brick, 0, 3.6, 5.5);
    g.add(box(8, 2.6, 4.5, plain('#d8cdb8', 0.9), 0, 7.5, 0)); tangRoof(g, 0, 10, 0, 11, 7, 2.2);
    for (let i = 0; i < 6; i++) tangRoof(g, -36 + i * 14, 6 + hash(i) * 3, -10 - hash(i + 4) * 14, 8, 5, 1.8, '#5a5e66');
    trees(g, 'poplar', [[-10, 5, 1], [12, 6, 1], [30, 5, 0.9]]);
  } else if (key === 'fort') {   // Dunhuang: a square rammed-earth fort with corner towers on the gravel
    wall(g, -36, -5, 8, 4, earth, 0); wall(g, 5, 36, 8, 4, earth, 0); gateHouse(g, 0, 10, 10, 6, earth, 0, 3.6, 6);
    for (const x of [-36, 36]) g.add(box(7, 11, 7, earthDark, x, 0, 0));
    wall(g, -36, 36, 8, 4, earth, -40); g.add(box(4, 8, 40, earth, -36, 0, -20)); g.add(box(4, 8, 40, earth, 36, 0, -20));
    houses(g, 8, -30, 30, -8, -34, ['#c4a074', '#b89466'], 21, 3, 5);
    trees(g, 'poplar', [[-44, 4, 1], [-48, 8, 1.1], [44, 6, 1]]);
  } else if (key === 'adobe') {  // Turpan: oasis town of flat roofs and ventilated grape-drying houses, poplars and vines
    houses(g, 14, -40, 40, 2, -26, ['#c9a26e', '#bd9662', '#d2ae7c'], 33, 3, 6);
    const vent = std('vent', { map: (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#c4986a'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#2a1a10'; for (let y = 6; y < 128; y += 16) for (let i = (y / 16 | 0) % 2 * 8 + 4; i < 128; i += 16) x.fillRect(i, y, 7, 7); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1.5); return t; })(), roughness: 0.95 });
    for (const [x, z] of [[-14, -4], [10, -8], [26, -2]]) g.add(box(7, 5, 5, vent, x, 0, z));
    gateHouse(g, 0, 9, 6.5, 5, mud('#c9a26e', false, 2), 4, 3.4, 5);
    trees(g, 'poplar', [[-30, 6, 1.1], [-24, 8, 1], [32, 7, 1.1], [38, 5, 0.9], [-6, -20, 1.2], [18, -24, 1.2]]);
  } else if (key === 'mountainTown') {   // Kashgar: mud-brick houses stacked up a slope under the Pamirs
    const slope = new THREE.Group(); g.add(slope);
    for (let r = 0; r < 4; r++) houses(slope, 7, -40, 40, -4 - r * 8, -10 - r * 8, ['#b8936a', '#c9a57a', '#a8845a'], 50 + r * 9, 3 + r * 2.2, 5 + r * 2.2);
    wall(g, -46, -5, 5, 3, earth, 4); wall(g, 5, 46, 5, 3, earth, 4); gateHouse(g, 0, 10, 8, 5, brick, 4, 3.6, 5.6);
    trees(g, 'poplar', [[-50, 8, 1], [50, 8, 1.1]]);
  } else if (key === 'sogdian') {  // Samarkand: lapis-tiled portal (pishtaq) with a turquoise ribbed dome, gardens
    wall(g, -55, -10, 7, 4, brick, 0); wall(g, 10, 55, 7, 4, brick, 0);
    gateHouse(g, 0, 18, 16, 4, tile('#1d4a8a', '#3fb3c4', 1.6), 0, 7, 11.5);
    g.add(box(18.6, 1.2, 4.4, plain('#e8d8b0', 0.6), 0, 15.6, 0));
    for (const x of [-9.6, 9.6]) g.add(mesh(new THREE.CylinderGeometry(1.1, 1.3, 17, 16), tile('#2a62a8', '#e8d8b0', 2), x, 8.5, 0.6));
    dome(g, 0, 14, -12, 6.5, std('dome', { color: '#36b0c0', roughness: 0.25, metalness: 0.1 }), true);
    houses(g, 10, -45, 45, -8, -30, ['#d2b48a', '#c9a57a'], 77, 4, 6);
    trees(g, 'poplar', [[-16, 6, 1.1], [-24, 8, 1], [18, 6, 1.1], [27, 7, 1], [40, 5, 1]]);
  } else if (key === 'merv') {  // Merv: massive walls with corrugated buttresses (as at the Kyz Kala keeps)
    const W = 70; g.add(box(W * 2, 11, 6, earth, 0, 0, 0));
    for (let x = -W + 2; x < W; x += 2.6) { if (Math.abs(x) < 6) continue; g.add(mesh(new THREE.CylinderGeometry(1.15, 1.35, 11, 10, 1, false, 0, Math.PI), earthDark, x, 5.5, 3)); }
    gateHouse(g, 0, 12, 13, 8, earth, 0, 4.4, 7.5);
    g.add(box(30, 14, 22, earthDark, 30, 0, -30));
    trees(g, 'scrub', []);
  } else if (key === 'hill') {  // Rayy: a citadel on its hill above the town
    const hill = mesh(new THREE.LatheGeometry([[0, 0], [38, 0], [30, 6], [16, 13], [0, 14]].map(([r, y]) => new THREE.Vector2(r, y)), 32), mud('#b89a72', true, 10), 10, 0, -40); hill.scale.z = 0.6; g.add(hill);
    const cit = new THREE.Group(); cit.position.y = 13; g.add(cit);
    wall(cit, -6, 26, 7, 3, earth, -36); cit.add(box(3, 7, 14, earth, -6, 0, -42)); cit.add(box(3, 7, 14, earth, 26, 0, -42));
    for (const x of [-6, 26]) cit.add(box(5, 10, 5, earthDark, x, 0, -36));
    houses(g, 12, -40, 40, 2, -16, ['#c8aa80', '#bca074'], 99, 3, 5); gateHouse(g, 0, 9, 7, 5, brick, 6, 3.4, 5.2);
    trees(g, 'palm', [[-30, 8, 1], [34, 8, 0.9]]);
  } else {                      // Baghdad, the round city: curved walls, gates and the green dome of the palace at the centre
    const ring = mesh(new THREE.CylinderGeometry(70, 70, 10, 96, 1, true, Math.PI * 0.82, Math.PI * 0.36), mud('#c9a876', false, 30), 0, 5, -70); g.add(ring);
    gateHouse(g, 0, 14, 13, 8, mud('#c9a876', false, 3), 0, 4.6, 8);
    g.add(box(14, 2, 8.4, mud('#c9a876', false, 3), 0, 13, 0)); dome(g, 0, 15, 0, 3.4, mud('#c9a876', false, 3));
    g.add(mesh(new THREE.CylinderGeometry(9, 9, 16, 24), mud('#d6bc8c', false, 6), 0, 8, -62)); dome(g, 0, 16.5, -62, 9, std('green', { color: '#2f8a5a', roughness: 0.3, metalness: 0.15 }));
    houses(g, 12, -55, 55, -14, -50, ['#d2b88a', '#c4a87a'], 123, 4, 7);
    trees(g, 'palm', [[-14, 6, 1], [-20, 4, 1.1], [16, 6, 1], [22, 3, 0.9], [-34, 5, 1], [36, 4, 1.1]]);
  }
  // the packed-earth approach road to the gate
  const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 46), std('road', { color: '#b89a72', roughness: 1, transparent: true, opacity: 0.85 })); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.04, 22); road.receiveShadow = true; g.add(road);
  g.traverse((o) => { if (o.isMesh && o !== road) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ---- encounter props ---------------------------------------------------------------------------------------------------------------
export function buildProps(props, opts = {}) {
  const g = new THREE.Group(), anim = [];
  const has = (p) => props.includes(p);
  if (has('tent')) {           // a felt yurt
    const t = new THREE.Group(); t.position.set(-9, 0, -6);
    t.add(mesh(new THREE.CylinderGeometry(3, 3, 2.2, 28), std('felt', { map: clothTexture('#e9dcc0', '#9a3a2a', 'felt'), roughness: 0.95 }), 0, 1.1, 0));
    t.add(mesh(new THREE.CylinderGeometry(0.5, 3.15, 1.5, 28), std('felt2', { color: '#ddd0b2', roughness: 0.95 }), 0, 2.95, 0));
    t.add(box(1.1, 1.6, 0.1, plain('#8a3a22'), 0, 0, 3)); g.add(t);
  }
  if (has('well')) { const w = new THREE.Group(); w.position.set(-8, 0, -2); w.add(mesh(new THREE.TorusGeometry(1.1, 0.35, 8, 20), mud('#a89070', false, 1), 0, 0.5, 0)); w.children[0].rotation.x = Math.PI / 2; w.add(mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.8, 20), mud('#a89070', false, 1), 0, 0.4, 0)); w.add(mesh(new THREE.CircleGeometry(0.85, 20), plain('#10161c', 0.2), 0, 0.82, 0)); w.children[2].rotation.x = -Math.PI / 2; for (const x of [-1, 1]) w.add(box(0.15, 2.6, 0.15, plain('#5a4028'), x, 0, 0)); w.add(box(2.4, 0.15, 0.15, plain('#5a4028'), 0, 2.6, 0)); g.add(w); }
  if (has('cairn')) for (let k = 0; k < 3; k++) { const x = -10 + k * 3.2, z = -3 - k; let y = 0; for (let i = 0; i < 6; i++) { const s = 0.7 - i * 0.09; const st = mesh(new THREE.SphereGeometry(s, 7, 5), plain('#8a7e70'), x + (hash(i + k * 9) - 0.5) * 0.2, y + s * 0.45, z); st.scale.y = 0.55; st.rotation.y = i; g.add(st); y += s * 0.85; } }
  if (has('market')) for (const [x, a, b] of [[-11, '#c8365e', '#e8b84a'], [11, '#2f66b8', '#e8dcc0']]) {
    const s = new THREE.Group(); s.position.set(x, 0, -5); for (const px of [-1.6, 1.6]) for (const pz of [-1, 1]) s.add(box(0.12, 2.6, 0.12, plain('#5a4028'), px, 0, pz));
    const aw = mesh(new THREE.BoxGeometry(3.8, 0.08, 2.8, 8, 1, 1), std('aw' + a, { map: clothTexture(a, b, 'silk'), roughness: 0.8, side: THREE.DoubleSide }), 0, 2.65, 0.2); aw.rotation.x = 0.12; s.add(aw);
    s.add(box(3.2, 0.9, 1.6, plain('#6a4a30'), 0, 0, 0)); for (let i = 0; i < 5; i++) s.add(mesh(new THREE.SphereGeometry(0.22, 8, 6), plain(['#c06a2a', '#e2a640', '#7a3a1a', '#d8c060', '#9a5030'][i]), -1.2 + i * 0.6, 1.0, 0)); g.add(s); anim.push((t) => { aw.rotation.x = 0.12 + Math.sin(t * 1.7 + x) * 0.03; });
  }
  if (has('workshop')) { const w = new THREE.Group(); w.position.set(9, 0, -7); w.add(box(7, 4, 5, mud('#c4a074', false, 2), 0, 0, 0)); w.add(box(7.4, 0.4, 5.4, mud('#c4a074', false, 2), 0, 4, 0)); w.add(box(1.4, 2, 0.05, plain('#1a100a'), -1.5, 0, 2.52)); const glow = mesh(new THREE.BoxGeometry(1.2, 0.8, 0.05), std('kiln', { color: '#ff8a30', emissive: '#ff6a10', emissiveIntensity: 2 }), 1.6, 0.6, 2.52); w.add(glow); const aw = mesh(new THREE.BoxGeometry(5, 0.06, 2), std('aw2', { map: clothTexture('#2f66b8', '#e8dcc0', 'silk'), roughness: 0.8 }), 0, 2.6, 3.3); aw.rotation.x = 0.25; w.add(aw); for (const x of [-2.4, 2.4]) w.add(box(0.1, 2.5, 0.1, plain('#5a4028'), x, 0, 4.2)); g.add(w); anim.push((t) => { glow.material.emissiveIntensity = 1.6 + 0.6 * Math.sin(t * 7) * Math.sin(t * 3.1); }); }
  if (has('fire')) {
    const f = new THREE.Group(); f.position.set(opts.fireX ?? 5, 0, 3.2);
    for (let i = 0; i < 6; i++) { const l = mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.1, 6), plain('#3a2414'), 0, 0.12, 0); l.rotation.z = Math.PI / 2; l.rotation.y = i; f.add(l); }
    for (let i = 0; i < 8; i++) { const st = mesh(new THREE.SphereGeometry(0.2, 6, 5), plain('#6a6058'), Math.cos(i * 0.785) * 0.75, 0.08, Math.sin(i * 0.785) * 0.75); f.add(st); }
    const flames = []; for (let i = 0; i < 4; i++) { const fl = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.3 - i * 0.05, 1.1 - i * 0.15, 8), new THREE.MeshBasicMaterial({ color: ['#ffb040', '#ff8a20', '#ffd070', '#ff6010'][i], transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); fl.position.set((i - 1.5) * 0.12, 0.6, (i % 2 - 0.5) * 0.15); f.add(fl); flames.push(fl); }
    const light = new THREE.PointLight('#ff9a40', 30, 14, 2); light.position.y = 1.2; f.add(light);
    g.add(f); anim.push((t) => { flames.forEach((fl, i) => { fl.scale.y = 0.8 + 0.35 * Math.sin(t * (9 + i * 2.3) + i) * Math.sin(t * 4.1 + i); fl.rotation.y = t * (1 + i); }); light.intensity = 26 + 8 * Math.sin(t * 13) * Math.sin(t * 5.3); });
  }
  if (has('boat') || has('rafts')) { const b = new THREE.Group(); b.position.set(-6, 0.3, -30); const hull = mesh(new THREE.CylinderGeometry(1.1, 1.1, 7, 16, 1, false, Math.PI / 2, Math.PI), plain('#6a4a30'), 0, 0.8, 0); hull.rotation.z = Math.PI / 2; hull.rotation.y = 0; b.add(hull); b.add(box(0.12, 4, 0.12, plain('#4a3020'), 0, 0.8, 0)); const sail = mesh(new THREE.PlaneGeometry(2.6, 3), std('sail', { color: '#efe4cc', side: THREE.DoubleSide, roughness: 0.9 }), 0.6, 3.2, 0); sail.rotation.y = 0.3; b.add(sail); g.add(b); anim.push((t) => { b.position.y = 0.3 + Math.sin(t * 1.2) * 0.06; b.rotation.z = Math.sin(t * 0.9) * 0.03; }); }
  if (has('gate')) { const c = buildCity(opts.gateKey ?? 'fort'); c.position.set(0, 0, -34); c.scale.setScalar(0.8); g.add(c); }
  if (has('wolves')) for (let i = 0; i < 3; i++) {
    const w = new THREE.Group(); w.position.set(-14 + i * 3.4, 0, -9 - i * 1.5); w.rotation.y = 0.4 - i * 0.3; const fur = plain('#4a4848', 0.95);
    const bd = mesh(new THREE.SphereGeometry(1, 12, 8), fur, 0, 0.75, 0); bd.scale.set(0.62, 0.28, 0.24); w.add(bd);
    const hd = mesh(new THREE.SphereGeometry(1, 10, 8), fur, 0.6, 0.92, 0); hd.scale.set(0.24, 0.17, 0.15); w.add(hd);
    const sn = mesh(new THREE.SphereGeometry(1, 8, 6), fur, 0.82, 0.86, 0); sn.scale.set(0.14, 0.07, 0.07); w.add(sn);
    for (const s of [-1, 1]) { w.add(mesh(new THREE.CylinderGeometry(0, 0.05, 0.14, 5), fur, 0.56, 1.1, s * 0.08)); const eye = mesh(new THREE.SphereGeometry(0.025, 6, 4), std('eye', { color: '#ffd060', emissive: '#ffb020', emissiveIntensity: 3 }), 0.77, 0.97, s * 0.07); w.add(eye); }
    for (const [x, z] of [[0.38, 0.12], [0.38, -0.12], [-0.4, 0.12], [-0.4, -0.12]]) { const l = mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.62, 6), fur, x, 0.31, z); w.add(l); }
    const tl = mesh(new THREE.CylinderGeometry(0.06, 0.03, 0.6, 6), fur, -0.78, 0.66, 0); tl.rotation.z = 1.1; w.add(tl);
    g.add(w); anim.push((t) => { hd.rotation.z = Math.sin(t * 0.8 + i) * 0.1; });
  }
  if (has('mirage')) { const m = new THREE.Mesh(new THREE.PlaneGeometry(400, 6), new THREE.MeshBasicMaterial({ color: '#cfe4f4', transparent: true, opacity: 0.55, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(0, 1.2, -120); g.add(m); anim.push((t) => { m.material.opacity = 0.4 + 0.15 * Math.sin(t * 0.7); m.scale.y = 1 + 0.2 * Math.sin(t * 0.5); });
    trees(g, 'palm', [[-30, -122, 1.4], [-24, -126, 1.2], [-18, -121, 1.3]]); }
  g.traverse((o) => { if (o.isMesh && !o.material.blending) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, update: (t) => anim.forEach((f) => f(t)) };
}

// Weather particles: blowing dust (storm), falling snow, drifting dust motes in the low sun. Points in a box around the focus.
export function makeParticles(n = 1400) {
  const pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = (hash(i) - 0.5) * 60; pos[i * 3 + 1] = hash(i + 7) * 14; pos[i * 3 + 2] = (hash(i + 13) - 0.5) * 40; seed[i] = hash(i + 21); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const m = new THREE.PointsMaterial({ size: 0.12, map: dot, color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.visible = false;
  const base = Float32Array.from(pos);
  return {
    points: pts,
    set(kind) { pts.visible = !!kind; if (kind === 'snow') { m.color.set('#ffffff'); m.size = 0.16; m.opacity = 0.95; } else if (kind === 'storm') { m.color.set('#e8c08a'); m.size = 0.35; m.opacity = 0.5; } else if (kind === 'motes') { m.color.set('#ffe0a0'); m.size = 0.05; m.opacity = 0.35; } this.kind = kind; },
    update(t, focus) {
      if (!pts.visible) return; const p = g.attributes.position.array, k = this.kind;
      for (let i = 0; i < n; i++) {
        const s = seed[i]; let x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
        if (k === 'snow') { y = ((y - t * (1 + s)) % 14 + 14) % 14; x += Math.sin(t * 0.7 + s * 30) * 0.8 - t * 1.5; }
        else if (k === 'storm') { x += t * (14 + s * 10); y = y * 0.5 + Math.sin(t * 2 + s * 20) * 0.6; }
        else { x += Math.sin(t * 0.2 + s * 40) * 2; y = 0.5 + (y * 0.4 + Math.sin(t * 0.3 + s * 10)) % 6; }
        p[i * 3] = focus.x + ((x % 60) + 90) % 60 - 30; p[i * 3 + 1] = y; p[i * 3 + 2] = focus.z + z;
      }
      g.attributes.position.needsUpdate = true;
    },
  };
}

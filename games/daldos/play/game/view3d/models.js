// Daldøs 3D models: the carved boat board, lacquered spatulas, the throwing stick and the lakeside siida (lavvu, birch, reindeer, fire).
// Pure construction (no sim state). The presenter positions everything from the simulation state each frame.
import { board3d as B, THREE } from '../vendor3d/index.js';

const TAU = Math.PI * 2;
export const DP = 1.04;                                  // row pitch (cells are 1 wide, 1.04 deep)
export const HL = 11, HW = 1.95;                         // hull length and half beam
export const Y = { floor: 0, hull: 0.36, deck: 0.46, rim: 0.54 };      // deck = the walking surface
export const cellXZ = (row, col) => ({ x: col - 3.5, z: (row - 1) * DP });
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, rep, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
const rnd = (s) => { let x = s >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; };
const cache = new Map();
const memo = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
export const clearModelCache = () => cache.clear();

export const SIDE3 = [
  { name: 'Red', col: '#bd2a16', hi: '#ff8a62', band: '#f2c35a', glow: '#ff8a62', handle: '#efe6cf' },
  { name: 'Blue', col: '#1d55b4', hi: '#74b4f2', band: '#f4efe0', glow: '#7fc0ff', handle: '#3a2c20' },
];
export const WOOD3 = {
  pine: { hull: ['#4a2c18', '#6e4426'], deck: ['#dcb67e', '#bb8d54'], pit: '#2a170b' },
  birch: { hull: ['#5c4a3a', '#7d6a54'], deck: ['#efe2c6', '#d3bf95'], pit: '#33261a' },
  tar: { hull: ['#120c08', '#2a1a10'], deck: ['#86613c', '#5a3c22'], pit: '#0c0603' },
};

// ---------------------------------------------------------------- textures
function weaveCanvas() {          // woven band in the traditional red / blue / yellow / green on cream, an isotropic diamond lattice
  const S = 256, c = cv(S), x = c.getContext('2d');
  x.fillStyle = '#efe3c4'; x.fillRect(0, 0, S, S);
  const cols = ['#c8321e', '#235ea8', '#e8b53a', '#2f7a4a'];
  const n = 8, u = S / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const cx = i * u + u / 2, cy = j * u + u / 2, k = (i + j) % 4;
    x.fillStyle = cols[k]; x.beginPath(); x.moveTo(cx, cy - u * 0.46); x.lineTo(cx + u * 0.46, cy); x.lineTo(cx, cy + u * 0.46); x.lineTo(cx - u * 0.46, cy); x.closePath(); x.fill();
    x.fillStyle = (k % 2) ? '#efe3c4' : '#1a1410'; x.beginPath(); x.moveTo(cx, cy - u * 0.2); x.lineTo(cx + u * 0.2, cy); x.lineTo(cx, cy + u * 0.2); x.lineTo(cx - u * 0.2, cy); x.closePath(); x.fill();
  }
  const r = rnd(5);
  for (let i = 0; i < 1800; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)'; x.fillRect(r() * S, r() * S, 1, 1 + r() * 3); }
  return c;
}
function waterLaneCanvas() {
  const W = 1024, H = 128, c = cv(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2f7f8c'); g.addColorStop(0.5, '#3f9aa0'); g.addColorStop(1, '#246b78'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const r = rnd(9);
  for (let k = 0; k < 7; k++) {
    x.strokeStyle = `rgba(230,250,245,${0.16 + r() * 0.2})`; x.lineWidth = 2 + r() * 2.5; x.beginPath();
    const y0 = 14 + k * 16 + r() * 6, ph = r() * 6;
    for (let i = 0; i <= 64; i++) { const px = (i / 64) * W, py = y0 + Math.sin(i * 0.55 + ph) * 5; if (i) x.lineTo(px, py); else x.moveTo(px, py); }
    x.stroke();
  }
  return c;
}
function hideCanvas() {          // reindeer hide: warm greys and creams, fur strokes
  const S = 512, c = cv(S), x = c.getContext('2d'), r = rnd(21);
  x.fillStyle = '#9a8268'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) { const gx = r() * S, gy = r() * S, rr = 40 + r() * 110, g = x.createRadialGradient(gx, gy, 0, gx, gy, rr); const l = r() < 0.5; g.addColorStop(0, l ? 'rgba(226,212,186,0.65)' : 'rgba(70,52,38,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(gx - rr, gy - rr, rr * 2, rr * 2); }
  x.lineCap = 'round';
  for (let i = 0; i < 2600; i++) { const px = r() * S, py = r() * S, a = -1.2 + r() * 0.5; x.strokeStyle = r() < 0.5 ? `rgba(240,228,205,${0.04 + r() * 0.08})` : `rgba(40,28,18,${0.05 + r() * 0.1})`; x.lineWidth = 1 + r() * 1.2; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * 10, py + Math.sin(a) * 10); x.stroke(); }
  return c;
}
function barkCanvas() {
  const W = 128, H = 512, c = cv(W, H), x = c.getContext('2d'), r = rnd(33);
  x.fillStyle = '#e9e4d6'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { const y = r() * H, w = 14 + r() * 70, px = r() * W; x.fillStyle = `rgba(30,26,22,${0.55 + r() * 0.4})`; x.beginPath(); x.ellipse(px, y, w / 2, 2 + r() * 4, 0, 0, TAU); x.fill(); }
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(120,110,95,${0.05 + r() * 0.1})`; x.fillRect(r() * W, r() * H, 1 + r() * 4, 1); }
  return c;
}
function lavvuCanvas() {
  const W = 512, H = 512, c = cv(W, H), x = c.getContext('2d'), r = rnd(41);
  x.fillStyle = '#7a6347'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? 'rgba(255,240,200,0.08)' : 'rgba(0,0,0,0.12)'; x.fillRect(i * W / 6, 0, W / 6, H); }
  x.strokeStyle = 'rgba(30,20,10,0.55)'; x.lineWidth = 3; for (let i = 0; i <= 6; i++) { x.beginPath(); x.moveTo(i * W / 6, 0); x.lineTo(i * W / 6, H); x.stroke(); }
  for (let i = 0; i < 3000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,240,210,0.07)' : 'rgba(20,10,0,0.1)'; x.fillRect(r() * W, r() * H, 1 + r() * 4, 1 + r() * 2); }
  // woven band around the tent, low
  const y0 = H * 0.72, bh = 46, cols = ['#c8321e', '#e8b53a', '#235ea8'];
  x.fillStyle = '#1a1410'; x.fillRect(0, y0 - 4, W, bh + 8);
  for (let i = 0; i < 32; i++) { x.fillStyle = cols[i % 3]; x.beginPath(); const px = i * W / 32; x.moveTo(px, y0 + bh / 2); x.lineTo(px + W / 64, y0); x.lineTo(px + W / 32, y0 + bh / 2); x.lineTo(px + W / 64, y0 + bh); x.closePath(); x.fill(); }
  return c;
}
function glowCanvas(rgb, S = 128) { const c = cv(S), x = c.getContext('2d'), g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); g.addColorStop(0, `rgba(${rgb},0.95)`); g.addColorStop(0.45, `rgba(${rgb},0.35)`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, S, S); return c; }
function ringCanvas(S = 256) { const c = cv(S), x = c.getContext('2d'), g = x.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S / 2); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.62, 'rgba(255,255,255,0.95)'); g.addColorStop(0.78, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); return c; }
export const textures = {
  weave: () => memo('t.weave', () => tex(weaveCanvas(), [0.62, 0.62])),
  lane: () => memo('t.lane', () => tex(waterLaneCanvas())),
  hide: () => memo('t.hide', () => tex(hideCanvas(), [1, 1])),
  bark: () => memo('t.bark', () => tex(barkCanvas(), [1, 2])),
  lavvu: () => memo('t.lavvu', () => tex(lavvuCanvas(), [1, 1])),
  ring: () => memo('t.ring', () => tex(ringCanvas())),
  glow: () => memo('t.glow', () => tex(glowCanvas('255,255,255'))),
  white: () => memo('t.white', () => tex(glowCanvas('255,255,255', 64))),
};

// ---------------------------------------------------------------- the boat board
function boatPts(L, hw, n = 56) {
  const top = [], bot = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = -L / 2 + L * t, u = Math.abs(2 * t - 1), h = hw * Math.pow(Math.max(0, 1 - Math.pow(u, 3.2)), 0.55);
    top.push([x, h]); if (i > 0 && i < n) bot.push([x, -h]);
  }
  return top.concat(bot.reverse());
}
const toShape = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s; };
// ExtrudeGeometry runs along +z with the outline in xy; lay it down so the outline is (x, z) and the depth goes up from y0.
function extrudeFlat(shape, depth, y0, bevel = 0.02, steps = 1) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 20, steps });
  g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); return g;
}
const mesh = (g, m, shadow = true) => { const o = new THREE.Mesh(g, m); o.castShadow = shadow; o.receiveShadow = true; return o; };

export function buildBoard(woodKey = 'pine') {
  const Wd = WOOD3[woodKey] || WOOD3.pine, group = new THREE.Group();
  const hullMat = B.material('darkWood', { color: Wd.hull[0], color2: Wd.hull[1], seed: 5, repeat: [3, 1], roughness: 0.55 });
  const deckMat = B.material('wood', { color: Wd.deck[0], color2: Wd.deck[1], seed: 11, repeat: [2.4, 1.1], roughness: 0.5 });
  const weaveMat = new THREE.MeshStandardMaterial({ map: textures.weave(), roughness: 0.85 });
  const bone = B.material('ivory', { color: '#efe6cf' });
  const gold = memo('m.gold', () => new THREE.MeshStandardMaterial({ color: '#e7b43c', roughness: 0.32, metalness: 0.85, emissive: '#5a3a06', emissiveIntensity: 0.35 }));

  const outer = boatPts(HL, HW), inner = boatPts(HL - 0.5, HW - 0.2);
  // hull body
  group.add(mesh(extrudeFlat(toShape(outer), Y.hull, 0, 0.05), hullMat));
  // woven gunwale ring: between the outline and the deck, a little proud of the deck
  const ring = toShape(outer), hole = new THREE.Path(); inner.forEach(([x, y], i) => (i ? hole.lineTo(x, y) : hole.moveTo(x, y))); hole.closePath(); ring.holes.push(hole);
  group.add(mesh(extrudeFlat(ring, Y.rim - Y.hull - 0.015, Y.hull, 0.015), weaveMat));
  // deck with the 24 pits cut through
  const deckShape = toShape(inner.map(([x, y]) => [x, y]));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) {
    const p = cellXZ(r, c), h = new THREE.Path(); h.absellipse(p.x, -p.z, 0.3, 0.33, 0, TAU, true); deckShape.holes.push(h);
  }
  group.add(mesh(extrudeFlat(deckShape, Y.deck - Y.hull - 0.016, Y.hull, 0.016), deckMat));
  // pit bottoms: dark, with a bone lip
  const pitMat = new THREE.MeshStandardMaterial({ color: Wd.pit, roughness: 0.95 });
  const pitGeo = new THREE.CircleGeometry(0.31, 24); pitGeo.rotateX(-Math.PI / 2);
  const lipGeo = new THREE.TorusGeometry(0.315, 0.026, 6, 28); lipGeo.rotateX(Math.PI / 2);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) {
    const p = cellXZ(r, c), pit = new THREE.Mesh(pitGeo, pitMat); pit.position.set(p.x, Y.hull + 0.004, p.z); pit.scale.set(0.97, 1, 1.07); pit.receiveShadow = true;
    const lip = new THREE.Mesh(lipGeo, bone); lip.position.set(p.x, Y.deck + 0.002, p.z); lip.scale.set(0.96, 1, 1.07); lip.castShadow = false;
    group.add(pit, lip);
  }
  // the shared lane: a water-painted inlay with the pits left open
  const laneW = 8.6, laneH = DP * 0.9, ls = new THREE.Shape();
  ls.moveTo(-laneW / 2, -laneH / 2); ls.lineTo(laneW / 2, -laneH / 2); ls.lineTo(laneW / 2, laneH / 2); ls.lineTo(-laneW / 2, laneH / 2); ls.closePath();
  for (let c = 0; c < 8; c++) { const p = cellXZ(1, c), h = new THREE.Path(); h.absellipse(p.x, 0, 0.34, 0.37, 0, TAU, true); ls.holes.push(h); }
  const lg = new THREE.ShapeGeometry(ls, 16); lg.rotateX(-Math.PI / 2); lg.translate(0, Y.deck + 0.003, 0);
  const lp = lg.attributes.position, lu = lg.attributes.uv;
  for (let i = 0; i < lp.count; i++) lu.setXY(i, lp.getX(i) / laneW + 0.5, lp.getZ(i) / laneH + 0.5);
  const laneMat = new THREE.MeshPhysicalMaterial({ map: textures.lane(), roughness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.1 });
  const lane = new THREE.Mesh(lg, laneMat); lane.receiveShadow = true; group.add(lane);
  // side-coloured edge stripes along each own row
  const stripeGeo = (cx, z) => { const g = new THREE.BoxGeometry(laneW - 0.4, 0.014, 0.1); g.translate(cx, Y.deck + 0.008, z); return g; };
  for (const [s, row] of [[0, 2], [1, 0]]) {
    const z = (row - 1) * DP + (row === 2 ? 1 : -1) * 0.5;
    group.add(mesh(stripeGeo(0, z), new THREE.MeshStandardMaterial({ color: SIDE3[s].col, roughness: 0.4 }), false));
  }
  // launch arrows and turn rings, in each side's colour
  for (const s of [0, 1]) {
    const lrow = s === 0 ? 2 : 0, dir = s === 0 ? 1 : -1, la = cellXZ(lrow, s === 0 ? 0 : 7), tu = cellXZ(lrow, s === 0 ? 7 : 0);
    const col = new THREE.MeshStandardMaterial({ color: SIDE3[s].band, roughness: 0.35, emissive: SIDE3[s].band, emissiveIntensity: 0.22 });
    const arrow = new THREE.Shape(); arrow.moveTo(0.16, 0); arrow.lineTo(-0.1, 0.17); arrow.lineTo(-0.1, -0.17); arrow.closePath();
    const ag = new THREE.ShapeGeometry(arrow); ag.rotateX(-Math.PI / 2);
    const am = new THREE.Mesh(ag, col); am.position.set(la.x - dir * 0.72, Y.deck + 0.012, la.z); am.rotation.y = dir > 0 ? 0 : Math.PI; group.add(am);
    const rg = new THREE.RingGeometry(0.36, 0.43, 40); rg.rotateX(-Math.PI / 2);
    const rm = new THREE.Mesh(rg, col); rm.position.set(tu.x, Y.deck + 0.012, tu.z); rm.scale.set(1, 1, 1.1); group.add(rm);
  }
  // carved prows: a swan-neck that curls back over the deck, with a bone ring and a gold knob
  for (const sg of [-1, 1]) {
    const pts = [[5.18, 0.4], [5.42, 0.78], [5.62, 1.3], [5.58, 1.86], [5.28, 2.16], [4.95, 2.08], [4.86, 1.78], [5.06, 1.62], [5.24, 1.76]]
      .map(([x, y]) => new THREE.Vector3(sg * x, y, 0));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const tube = mesh(new THREE.TubeGeometry(curve, 48, 0.1, 10, false), hullMat); group.add(tube);
    const knob = mesh(new THREE.SphereGeometry(0.15, 14, 10), gold); knob.position.copy(pts[pts.length - 1]); knob.position.y += 0.02; group.add(knob);
    for (const t of [0.22, 0.42]) { const p = curve.getPoint(t), band = mesh(new THREE.TorusGeometry(0.115, 0.03, 6, 16), weaveMat); band.position.copy(p); const tan = curve.getTangent(t); band.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan); group.add(band); }
    // a slim keel fin under the tip so the hull reads as a boat from the side
    const fin = mesh(new THREE.BoxGeometry(0.5, 0.14, 0.12), hullMat); fin.position.set(sg * 5.0, 0.12, 0); group.add(fin);
  }
  group.userData = { woodKey };
  return { group, deckY: Y.deck };
}

// ---------------------------------------------------------------- the spatula
// An upright lacquered paddle standing in its pit, face to the players. Unturned: painted band across the blade. Turned: bone inlay with a
// gold star. Both faces carry the same design so the piece reads from either side of the board.
export function makeSpatula(side, style = 'painted') {
  const S = SIDE3[side], g = new THREE.Group(), rig = new THREE.Group();
  const body = memo(`m.blade.${side}`, () => new THREE.MeshPhysicalMaterial({ color: S.col, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.55 }));
  const hnd = memo(`m.handle.${side}`, () => (side === 0 ? B.material('ivory', { color: S.handle }) : new THREE.MeshPhysicalMaterial({ color: '#33261d', roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 })));
  const borderM = memo('m.border', () => new THREE.MeshPhysicalMaterial({ color: '#3b2210', roughness: 0.34, clearcoat: 0.9, clearcoatRoughness: 0.12 }));
  const borderG = memo('g.border', () => { const gg = B.slab(0.66, 0.8, 0.1, 0.33, 0.035); gg.rotateX(Math.PI / 2); gg.translate(0, 0, -0.05); return gg; });
  const bladeG = memo('g.blade', () => { const gg = B.slab(0.5, 0.64, 0.15, 0.25, 0.05); gg.rotateX(Math.PI / 2); gg.translate(0, 0, -0.075); return gg; });
  const border = new THREE.Mesh(borderG, borderM); border.position.set(0, 0.56, 0); border.castShadow = true; border.receiveShadow = true; rig.add(border);
  const blade = new THREE.Mesh(bladeG, body); blade.position.set(0, 0.56, 0); blade.castShadow = true; blade.receiveShadow = true; rig.add(blade);
  const handleG = memo('g.handle', () => new THREE.CylinderGeometry(0.085, 0.11, 0.32, 12));
  const handle = new THREE.Mesh(handleG, hnd); handle.position.y = 0.16; handle.castShadow = true; rig.add(handle);
  const collar = new THREE.Mesh(memo('g.collar', () => new THREE.CylinderGeometry(0.13, 0.13, 0.05, 14)), memo('m.collar', () => new THREE.MeshStandardMaterial({ color: '#e0a830', roughness: 0.3, metalness: 0.8 })));
  collar.position.y = 0.2; rig.add(collar);
  const bandMat = memo(`m.band.${side}`, () => new THREE.MeshStandardMaterial({ color: S.band, roughness: 0.4 }));
  const dark = memo('m.dark', () => new THREE.MeshStandardMaterial({ color: '#2a170b', roughness: 0.7 }));
  const boneM = memo('m.bone', () => new THREE.MeshStandardMaterial({ color: '#f4ecd2', roughness: 0.45 }));
  const goldM = memo('m.gold2', () => new THREE.MeshStandardMaterial({ color: '#e0a830', roughness: 0.3, metalness: 0.8, emissive: '#6a4408', emissiveIntensity: 0.4 }));
  const plain = new THREE.Group(), inlay = new THREE.Group();
  for (const f of [1, -1]) {
    const z = f * 0.078, mk = (geo, mat, y, zz = z) => { const m = new THREE.Mesh(geo, mat); m.position.set(0, y, zz); if (f < 0) m.rotation.y = Math.PI; return m; };
    const bandG = memo('g.band', () => { const gg = B.slab(0.44, 0.14, 0.022, 0.04, 0.008); gg.rotateX(Math.PI / 2); return gg; });
    plain.add(mk(bandG, bandMat, 0.52));
    const notchG = memo('g.notch', () => { const gg = B.slab(0.2, 0.05, 0.02, 0.02, 0.006); gg.rotateX(Math.PI / 2); return gg; });
    plain.add(mk(notchG, dark, 0.74));
    const discG = memo('g.disc', () => { const gg = B.slab(0.34, 0.4, 0.024, 0.17, 0.008); gg.rotateX(Math.PI / 2); return gg; });
    inlay.add(mk(discG, boneM, 0.56));
    const starG = memo('g.star', () => { const gg = B.inlay(B.starPoints(8, 0.135, 0.055), 0.02); gg.rotateX(Math.PI / 2); return gg; });
    inlay.add(mk(starG, goldM, 0.56, z + f * 0.02));
    const ringG = memo('g.sring', () => new THREE.TorusGeometry(0.15, 0.012, 6, 32));
    const rr = mk(ringG, goldM, 0.56, z + f * 0.022); rr.scale.set(1, 1.2, 1); inlay.add(rr);
  }
  inlay.visible = false; rig.add(plain, inlay);
  if (style === 'carved') { const rr = new THREE.Mesh(memo('g.carve', () => new THREE.TorusGeometry(0.27, 0.012, 5, 36)), memo('m.carve', () => new THREE.MeshStandardMaterial({ color: '#fff4d0', roughness: 0.5 }))); rr.position.y = 0.56; rr.scale.set(0.9, 1.15, 1); rig.add(rr); }
  rig.rotation.x = 0;
  const shadow = B.contactShadow(0.5, 0.55); shadow.position.y = Y.deck + 0.006;
  g.add(rig);
  const api = {
    root: g, rig, shadow,
    setTurned(on) { plain.visible = !on; inlay.visible = !!on; },
  };
  g.userData = api;
  return api;
}

// ---------------------------------------------------------------- the throwing stick (length 1 along x)
export function makeStick() {
  const g = new THREE.Group();
  const wood = memo('m.stickwood', () => B.material('wood', { color: '#7a4a24', color2: '#b27a42', seed: 17, repeat: [3, 1], roughness: 0.35 }));
  const body = new THREE.Mesh(memo('g.stick', () => B.roundedBox(1, 0.17, 0.17, 0.045, 4)), wood); body.castShadow = true; body.receiveShadow = true; g.add(body);
  const goldM = memo('m.gold3', () => new THREE.MeshStandardMaterial({ color: '#ffd36a', roughness: 0.3, metalness: 0.7, emissive: '#7a4a08', emissiveIntensity: 0.5 }));
  const cut = memo('m.cut', () => new THREE.MeshStandardMaterial({ color: '#2a150a', roughness: 0.8 }));
  const nG = memo('g.nt', () => new THREE.BoxGeometry(0.03, 0.02, 0.1)), nI = memo('g.ni', () => new THREE.BoxGeometry(0.016, 0.024, 0.07));
  for (let k = 0; k < 4; k++) {
    const th = k * Math.PI / 2, f = new THREE.Group(); f.rotation.x = th;
    const n = k + 1, gap = 0.17, x0 = -(n - 1) * gap / 2;
    for (let i = 0; i < n; i++) {
      const a = new THREE.Mesh(nG, cut); a.position.set(x0 + i * gap, 0.088, 0);
      const b = new THREE.Mesh(nI, goldM); b.position.set(x0 + i * gap, 0.092, 0);
      f.add(a, b);
    }
    g.add(f);
  }
  const capM = memo('m.cap', () => B.material('ivory', { color: '#efe6cf' }));
  for (const sx of [-1, 1]) {
    const c = new THREE.Mesh(memo('g.cap', () => { const gg = new THREE.CylinderGeometry(0.105, 0.105, 0.05, 4); gg.rotateZ(Math.PI / 2); gg.rotateX(Math.PI / 4); return gg; }), capM); c.position.x = sx * 0.4; g.add(c);
    const w = new THREE.Mesh(memo('g.wband', () => new THREE.BoxGeometry(0.06, 0.182, 0.182)), new THREE.MeshStandardMaterial({ map: textures.weave(), roughness: 0.8 })); w.position.x = sx * 0.3; g.add(w);
  }
  return g;
}

// ---------------------------------------------------------------- the siida: platform, hide, lavvu, birch, reindeer, fire, pennants
export function buildPlatform() {
  const g = new THREE.Group();
  const plank = B.material('wood', { color: '#8d6a44', color2: '#6a4c2e', seed: 3, repeat: [9, 6], roughness: 0.8 });
  const deck = mesh(B.slab(46, 30, 0.2, 0.3, 0.04), plank); deck.position.set(0, -0.14, 9.5); g.add(deck);
  // reindeer hide the board lies on
  const s = new THREE.Shape(), P = (x, y) => [x, y];
  const outline = [P(-6.7, -1.2), P(-7.2, -2.4), P(-6.5, -3.3), P(-5.4, -2.7), P(-4.2, -3.9), P(-2.6, -3.3), P(0, -3.9), P(2.4, -3.2), P(4.4, -3.9), P(5.5, -2.8), P(6.6, -3.4), P(7.2, -2.3), P(6.6, -1.2), P(7.3, 0), P(6.7, 1.3), P(7.2, 2.4), P(6.4, 3.4), P(5.4, 2.8), P(4.2, 3.9), P(2.4, 3.2), P(0, 3.9), P(-2.4, 3.3), P(-4.3, 3.9), P(-5.5, 2.8), P(-6.5, 3.4), P(-7.2, 2.3), P(-6.6, 1.2), P(-7.3, 0)];
  const cr = new THREE.CatmullRomCurve3(outline.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'catmullrom', 0.5);
  cr.getPoints(120).forEach((p, i) => (i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y)));
  const hg = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.05, bevelSegments: 2, curveSegments: 4 });
  hg.rotateX(-Math.PI / 2);
  const hp = hg.attributes.position, hu = hg.attributes.uv;
  for (let i = 0; i < hp.count; i++) hu.setXY(i, hp.getX(i) / 14 + 0.5, hp.getZ(i) / 8 + 0.5);
  const hide = mesh(hg, new THREE.MeshStandardMaterial({ map: textures.hide(), roughness: 0.95, bumpMap: textures.hide(), bumpScale: 0.6 }));
  hide.position.y = 0.0; g.add(hide);
  return g;
}

export function makeBirch(seed = 1, h = 6) {
  const r = rnd(seed * 97 + 5), g = new THREE.Group();
  const barkM = memo('m.bark', () => new THREE.MeshStandardMaterial({ map: textures.bark(), roughness: 0.85 }));
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, h, 8), barkM); trunk.position.y = h / 2; trunk.castShadow = true; g.add(trunk);
  const leafM = memo('m.leaf', () => new THREE.MeshLambertMaterial({ color: '#b6a238' }));
  const leafM2 = memo('m.leaf2', () => new THREE.MeshLambertMaterial({ color: '#8f8a30' }));
  const geo = memo('g.leaf', () => new THREE.SphereGeometry(1, 10, 8));
  for (let i = 0; i < 12; i++) {
    const a = r() * TAU, rad = 0.3 + r() * 0.9, y = h * (0.5 + r() * 0.48), s = 0.32 + r() * 0.34;
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.045, rad * 1.5, 5), barkM); br.position.set(Math.cos(a) * rad * 0.35, y - 0.2, Math.sin(a) * rad * 0.35); br.rotation.z = Math.cos(a) * 0.9; br.rotation.x = -Math.sin(a) * 0.9; g.add(br);
    const lf = new THREE.Mesh(geo, i % 2 ? leafM : leafM2); lf.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad); lf.scale.set(s, s * 0.7, s); lf.castShadow = true; g.add(lf);
  }
  g.userData.sway = r() * TAU;
  return g;
}

export function makeLavvu() {
  const g = new THREE.Group(), H = 4.3, R = 3.1;
  const cloth = new THREE.MeshStandardMaterial({ map: textures.lavvu(), roughness: 0.95, side: THREE.DoubleSide });
  const cone = mesh(new THREE.CylinderGeometry(0.16, R, H, 24, 1, true), cloth); cone.position.y = H / 2; g.add(cone);
  const pole = memo('m.pole', () => new THREE.MeshStandardMaterial({ color: '#4a3220', roughness: 0.8 }));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU, p = mesh(new THREE.CylinderGeometry(0.035, 0.06, 1.7, 5), pole); p.position.set(Math.cos(a) * 0.12, H + 0.5, Math.sin(a) * 0.12);
    p.rotation.z = Math.cos(a) * 0.45; p.rotation.x = -Math.sin(a) * 0.45; g.add(p);
  }
  // the door: a dark opening lit from inside by the stove
  const door = new THREE.Mesh(new THREE.CircleGeometry(0.62, 18, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#ffb35a' }));
  door.scale.set(1, 1.7, 1); door.position.set(0, 0.0, R * 0.8 - 0.02); door.rotation.x = 0; door.position.z = R * (1 - 0.8 * 0.0) * 0.78;
  door.position.y = 0.02; g.add(door);
  g.userData.door = door;
  return g;
}

export function makeReindeer(seed = 1) {
  const r = rnd(seed * 31 + 7), g = new THREE.Group(), K = 0.9;
  const fur = memo('m.fur', () => new THREE.MeshStandardMaterial({ color: '#8a7563', roughness: 0.95 }));
  const pale = memo('m.pale', () => new THREE.MeshStandardMaterial({ color: '#d9cdb8', roughness: 0.95 }));
  const dark = memo('m.mu', () => new THREE.MeshStandardMaterial({ color: '#2b211b', roughness: 0.8 }));
  const horn = memo('m.horn', () => new THREE.MeshStandardMaterial({ color: '#cbb68f', roughness: 0.7 }));
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.85, 6, 12), fur); body.rotation.z = Math.PI / 2; body.position.set(0, 0.95 * K, 0); body.castShadow = true; g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 8), pale); belly.scale.set(1.5, 0.55, 0.8); belly.position.set(0.05, 0.72 * K, 0); g.add(belly);
  for (const [x, z] of [[-0.5, 0.18], [-0.5, -0.18], [0.5, 0.18], [0.5, -0.18]]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.04, 0.85 * K, 6), fur); l.position.set(x, 0.42 * K, z); l.castShadow = true; g.add(l);
    const hf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), dark); hf.position.set(x, 0.02, z); hf.scale.set(1.2, 0.6, 1); g.add(hf);
  }
  const neck = new THREE.Group(); neck.position.set(0.62, 1.12 * K, 0); g.add(neck);
  const nk = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.5, 5, 10), pale); nk.rotation.z = -0.9; nk.position.set(0.18, 0.15, 0); nk.castShadow = true; neck.add(nk);
  const head = new THREE.Group(); head.position.set(0.42, 0.34, 0); neck.add(head);
  const sk = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.26, 4, 8), fur); sk.rotation.z = -1.1; sk.position.set(0.1, -0.04, 0); head.add(sk);
  const mu = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), dark); mu.position.set(0.3, -0.13, 0); head.add(mu);
  for (const sgn of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.055, 0.22, 5), fur); ear.position.set(-0.02, 0.1, sgn * 0.1); ear.rotation.x = sgn * 1.0; ear.rotation.z = 0.4; head.add(ear);
    // antlers: a main beam sweeping back and up with tines
    const pts = [[0, 0.1, 0], [-0.1, 0.35, 0.08], [-0.28, 0.6, 0.16], [-0.38, 0.9, 0.2], [-0.3, 1.15, 0.2]].map(([x, y, z]) => new THREE.Vector3(x, y, z * sgn));
    const beam = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.026, 5, false), horn); beam.castShadow = true; head.add(beam);
    const cc = new THREE.CatmullRomCurve3(pts);
    for (const [t, dx, dy] of [[0.3, 0.2, 0.28], [0.55, 0.22, 0.3], [0.8, 0.16, 0.26]]) {
      const p0 = cc.getPoint(t);
      const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, 0.3, 4), horn); tine.position.set(p0.x + dx * 0.5, p0.y + dy * 0.5, p0.z); tine.rotation.z = -Math.atan2(dx, dy); head.add(tine);
    }
  }
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), pale); tail.position.set(-0.82, 1.05 * K, 0); g.add(tail);
  g.userData = { neck, head, ph: r() * TAU, tail };
  return g;
}

export function makePennants(n = 15, span = 12) {
  const g = new THREE.Group();
  const pole = memo('m.pole', () => new THREE.MeshStandardMaterial({ color: '#4a3220', roughness: 0.8 }));
  for (const sx of [-1, 1]) { const p = mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6), pole); p.position.set(sx * span / 2, 1.6, 0); g.add(p); }
  const cols = ['#c8321e', '#235ea8', '#e8b53a', '#2f7a4a', '#efe3c4'];
  const flags = [];
  const tri = memo('g.flag', () => { const s = new THREE.Shape(); s.moveTo(-0.22, 0); s.lineTo(0.22, 0); s.lineTo(0, -0.62); s.closePath(); return new THREE.ShapeGeometry(s); });
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), x = (u - 0.5) * span, y = 3.0 - Math.sin(u * Math.PI) * 0.55;
    const f = new THREE.Mesh(tri, new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.8, side: THREE.DoubleSide }));
    f.position.set(x, y, 0); f.castShadow = true; g.add(f); flags.push(f);
  }
  const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => { const u = i / 8; return new THREE.Vector3((u - 0.5) * span, 3.0 - Math.sin(u * Math.PI) * 0.55, 0); })), 20, 0.012, 4, false), pole);
  g.add(line);
  g.userData.flags = flags;
  return g;
}

export function makeFire() {
  const g = new THREE.Group();
  const log = memo('m.log', () => new THREE.MeshStandardMaterial({ color: '#4a2f1a', roughness: 0.9 }));
  for (let i = 0; i < 5; i++) { const l = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 6), log); const a = (i / 5) * TAU; l.position.set(Math.cos(a) * 0.22, 0.1, Math.sin(a) * 0.22); l.rotation.z = Math.PI / 2; l.rotation.y = -a; g.add(l); }
  const stoneM = memo('m.stone', () => new THREE.MeshStandardMaterial({ color: '#6c6a66', roughness: 0.95 }));
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, s = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), stoneM); s.position.set(Math.cos(a) * 0.62, 0.05, Math.sin(a) * 0.62); s.scale.set(1, 0.6, 1); g.add(s); }
  const flames = [];
  const fm = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  for (const [c, rr, h, o] of [['#ff6a1a', 0.26, 0.95, 0.75], ['#ffb02e', 0.19, 0.72, 0.85], ['#fff0a0', 0.1, 0.45, 0.9]]) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0, rr, h, 8, 1, true), fm(c, o)); f.position.y = 0.3 + h / 2; f.userData.h = h; g.add(f); flames.push(f);
  }
  const light = new THREE.PointLight(0xff8a30, 7, 15, 1.6); light.position.y = 0.9; g.add(light);
  g.userData = { flames, light };
  return g;
}

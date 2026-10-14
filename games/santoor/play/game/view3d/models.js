// Santoor 3D models and procedural materials, shared by the in-game presenter and the offline icon render.
// Local frame of the instrument: lx across the board (negative = the left mallet's half), ly from the wide end (0) to the narrow end (len), z up.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';

export { THREE, B };
export const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const BRIDGE_AT = 0.3;
export const NCOURSE = 8;
export const SIDE_COL = ['#ffb347', '#35d6c0'];
export const SIDE_HI = ['#fff0c4', '#d6fff6'];

export function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function rngOf(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function tex(c, o = {}) {
  const t = new THREE.CanvasTexture(c);
  if (o.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = o.aniso ?? 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  return t;
}
export function blobCanvas(rgb, a, size = 128, hard = 0.5) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(hard, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
}

// ---- textures ---------------------------------------------------------------------------------------------------------------------
/** Walnut: long fibres running along the canvas height, pores, a few darker figure bands. Returns { map, bump }. */
export function walnutCanvas(w = 512, h = 1024, seed = 17) {
  const c = cv(w, h), x = c.getContext('2d'), r = rngOf(seed), b = cv(w, h), bx = b.getContext('2d');
  const g = x.createLinearGradient(0, 0, w, 0);
  [[0, '#4a2a14'], [0.18, '#6b4226'], [0.38, '#8a5a32'], [0.5, '#9c6a3c'], [0.62, '#855530'], [0.82, '#64401f'], [1, '#432512']].forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g; x.fillRect(0, 0, w, h); bx.fillStyle = '#808080'; bx.fillRect(0, 0, w, h);
  for (let i = 0; i < 360; i++) {
    const px = r() * w, amp = 1 + r() * 7, ph = r() * TAU, fr = 0.002 + r() * 0.007, lw = 0.5 + r() * 2.4, dark = r() < 0.66, a = 0.05 + r() * 0.17;
    const col = dark ? `rgba(${28 + r() * 24 | 0},${14 + r() * 10 | 0},4,${a})` : `rgba(${200 + r() * 50 | 0},${150 + r() * 40 | 0},${96 + r() * 30 | 0},${a * 0.8})`;
    for (const [ctx, cc] of [[x, col], [bx, dark ? `rgba(0,0,0,${a * 1.5})` : `rgba(255,255,255,${a})`]]) {
      ctx.strokeStyle = cc; ctx.lineWidth = lw; ctx.beginPath();
      for (let s = 0; s <= h; s += 12) { const xx = px + Math.sin(s * fr + ph) * amp + Math.sin(s * fr * 2.9 + ph * 1.7) * amp * 0.35; s ? ctx.lineTo(xx, s) : ctx.moveTo(xx, s); }
      ctx.stroke();
    }
  }
  for (let i = 0; i < 1400; i++) { const px = r() * w, py = r() * h; x.fillStyle = `rgba(20,8,0,${0.1 + r() * 0.25})`; x.fillRect(px, py, 1, 2 + r() * 5); bx.fillStyle = 'rgba(0,0,0,0.3)'; bx.fillRect(px, py, 1, 2 + r() * 5); }
  for (let k = 0; k < 3; k++) {                       // darker figure bands across the grain
    const by = r() * h, bh = 30 + r() * 80, gg = x.createLinearGradient(0, by - bh, 0, by + bh); gg.addColorStop(0, 'rgba(30,14,4,0)'); gg.addColorStop(0.5, 'rgba(30,14,4,0.18)'); gg.addColorStop(1, 'rgba(30,14,4,0)');
    x.fillStyle = gg; x.fillRect(0, by - bh, w, bh * 2);
  }
  return { map: c, bump: b };
}
/** Dark rosewood for the bridges and the frame. */
export function rosewoodCanvas(size = 256, seed = 5) {
  const c = cv(size), x = c.getContext('2d'), r = rngOf(seed);
  x.fillStyle = '#2a140c'; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 120; i++) { const px = r() * size; x.strokeStyle = r() < 0.5 ? `rgba(90,42,22,${0.2 + r() * 0.3})` : `rgba(10,4,0,${0.3 + r() * 0.3})`; x.lineWidth = 0.6 + r() * 2; x.beginPath(); x.moveTo(px, 0); x.bezierCurveTo(px + r() * 12 - 6, size * 0.3, px + r() * 12 - 6, size * 0.6, px + r() * 8 - 4, size); x.stroke(); }
  return c;
}
/** Kashmiri-style carpet tile (seamless): crimson field, a lattice of boteh (paisley) in ivory / teal / gold with rosettes, wool noise. */
export function carpetCanvas(size = 1536, seed = 29) {
  const c = cv(size), x = c.getContext('2d'), r = rngOf(seed), b = cv(size), bx = b.getContext('2d');
  x.fillStyle = '#4e1519'; x.fillRect(0, 0, size, size);
  const gg = x.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.75); gg.addColorStop(0, 'rgba(120,36,36,0.35)'); gg.addColorStop(1, 'rgba(20,4,8,0.3)'); x.fillStyle = gg; x.fillRect(0, 0, size, size);
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, size, size);
  const N = 4, cell = size / N;
  const COLS = [['#e9dbb4', '#b89a5a'], ['#1f8077', '#0e4a48'], ['#d9a23c', '#8a5a14'], ['#e9dbb4', '#b89a5a']];
  const boteh = (g, cx, cy, s, ang, col, col2) => {
    g.save(); g.translate(cx, cy); g.rotate(ang); g.scale(s, s);
    g.beginPath(); g.moveTo(0, 0.5); g.bezierCurveTo(-0.36, 0.42, -0.4, -0.15, -0.05, -0.42); g.bezierCurveTo(0.08, -0.52, 0.2, -0.46, 0.2, -0.36);
    g.bezierCurveTo(0.12, -0.4, 0.02, -0.34, 0.02, -0.2); g.bezierCurveTo(0.38, -0.04, 0.34, 0.4, 0, 0.5); g.closePath();
    g.fillStyle = col; g.fill(); g.lineWidth = 0.035; g.strokeStyle = '#1a0608'; g.stroke();
    g.clip();
    g.strokeStyle = col2; g.lineWidth = 0.028;
    for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(0, 0.42); g.bezierCurveTo(-0.22 + k * 0.03, 0.3, -0.25 + k * 0.05, -0.12, -0.02 - k * 0.0, -0.36 + k * 0.06); g.stroke(); }
    g.fillStyle = '#7a1f22'; g.beginPath(); g.arc(0.02, 0.1, 0.07, 0, TAU); g.fill();
    g.fillStyle = '#e9dbb4'; g.beginPath(); g.arc(0.02, 0.1, 0.03, 0, TAU); g.fill();
    g.restore();
  };
  const rosette = (g, cx, cy, s, col) => {
    g.save(); g.translate(cx, cy);
    for (let k = 0; k < 8; k++) { g.rotate(TAU / 8); g.fillStyle = k % 2 ? col : '#c7882d'; g.beginPath(); g.ellipse(0, -s * 0.5, s * 0.18, s * 0.42, 0, 0, TAU); g.fill(); }
    g.fillStyle = '#1a0608'; g.beginPath(); g.arc(0, 0, s * 0.22, 0, TAU); g.fill(); g.fillStyle = '#e9dbb4'; g.beginPath(); g.arc(0, 0, s * 0.1, 0, TAU); g.fill();
    g.restore();
  };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const cx = (i + 0.5) * cell, cy = (j + 0.5) * cell, flip = (i + j) % 2 ? 1 : -1, k = (i + j * 2) % 4;
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {            // wrap so the tile is seamless
      boteh(x, cx + ox, cy + oy, cell * 0.82, flip * 0.5, COLS[k][0], COLS[k][1]);
      boteh(bx, cx + ox, cy + oy, cell * 0.82, flip * 0.5, '#b0b0b0', '#a0a0a0');
      rosette(x, cx + cell / 2 + ox, cy + cell / 2 + oy, cell * 0.2, '#1f8077');
    }
  }
  // woven wool: fine threads and noise
  for (let i = 0; i < size; i += 5) { x.fillStyle = 'rgba(0,0,0,0.07)'; x.fillRect(i, 0, 1.4, size); x.fillStyle = 'rgba(255,230,190,0.035)'; x.fillRect(0, i, size, 1.4); bx.fillStyle = 'rgba(255,255,255,0.22)'; bx.fillRect(i, 0, 2, size); bx.fillStyle = 'rgba(0,0,0,0.22)'; bx.fillRect(0, i, size, 2); }
  for (let i = 0; i < 26000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,230,190,0.06)' : 'rgba(0,0,0,0.12)'; x.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2); }
  // overall darkening so the pattern stays behind the instrument
  x.fillStyle = 'rgba(8,2,4,0.36)'; x.fillRect(0, 0, size, size);
  return { map: c, bump: b };
}
export function leatherCanvas(size = 256, base = '#0d2a31', seed = 9) {
  const c = cv(size), x = c.getContext('2d'), r = rngOf(seed);
  x.fillStyle = base; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) { x.fillStyle = r() < 0.5 ? 'rgba(160,230,230,0.05)' : 'rgba(0,0,0,0.14)'; x.fillRect(r() * size, r() * size, 1 + r() * 2.2, 1 + r() * 2.2); }
  return c;
}

// ---- shared materials ------------------------------------------------------------------------------------------------------------
export function makeMats() {
  const walnut = walnutCanvas(), rose = rosewoodCanvas(), carp = carpetCanvas(), leather = leatherCanvas();
  const wal = tex(walnut.map), walB = tex(walnut.bump, { srgb: false });
  wal.wrapS = wal.wrapT = THREE.RepeatWrapping; walB.wrapS = walB.wrapT = THREE.RepeatWrapping;
  const carMap = tex(carp.map, { repeat: [1, 1] }), carBump = tex(carp.bump, { srgb: false, repeat: [1, 1] });
  const leatherTex = tex(leather, { repeat: [3, 3] });
  const M = {
    walnutTex: wal, walnutBump: walB, carpetTex: carMap, carpetBump: carBump,
    lid: new THREE.MeshPhysicalMaterial({ map: wal, bumpMap: walB, bumpScale: 0.9, roughness: 0.46, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 0.55, color: '#c9a888' }),
    side: new THREE.MeshPhysicalMaterial({ color: '#8a6a52', map: wal, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
    rose: new THREE.MeshStandardMaterial({ map: tex(rose), roughness: 0.5, envMapIntensity: 0.7 }),
    brass: new THREE.MeshStandardMaterial({ color: '#e1b04e', metalness: 1, roughness: 0.28, envMapIntensity: 1.7 }),
    brassDeep: new THREE.MeshStandardMaterial({ color: '#b9852f', metalness: 1, roughness: 0.34, envMapIntensity: 1.4 }),
    steel: new THREE.MeshStandardMaterial({ color: '#eef3f6', metalness: 1, roughness: 0.22, envMapIntensity: 1.9 }),
    bone: new THREE.MeshPhysicalMaterial({ color: '#efe3c6', roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
    ebony: new THREE.MeshPhysicalMaterial({ color: '#2a170d', roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 0.4 }),
    carpet: new THREE.MeshStandardMaterial({ map: carMap, bumpMap: carBump, bumpScale: 1.2, roughness: 1, metalness: 0, envMapIntensity: 0.1, color: '#ffffff' }),
    leather: leatherTex,
  };
  return M;
}

// ---- the instrument -----------------------------------------------------------------------------------------------------------------
function trapPoints(half, len, e, rad, per = 6) {
  const a = half(0) + e, b = half(len) + e, y0 = -e, y1 = len + e, pts = [];
  const quad = (p0, p1, p2) => { for (let i = 1; i <= per; i++) { const t = i / per, u = 1 - t; pts.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]); } };
  pts.push([-a + rad, y0]); pts.push([a - rad, y0]);
  quad([a - rad, y0], [a, y0], [a - 0.05 * rad, y0 + rad * 0.9]);
  pts.push([b + 0.05 * rad, y1 - rad * 0.9]);
  quad([b + 0.05 * rad, y1 - rad * 0.9], [b, y1], [b - rad, y1]);
  pts.push([-b + rad, y1]);
  quad([-b + rad, y1], [-b, y1], [-b - 0.05 * rad, y1 - rad * 0.9]);
  pts.push([-a + 0.05 * rad, y0 + rad * 0.9]);
  quad([-a + 0.05 * rad, y0 + rad * 0.9], [-a, y0], [-a + rad, y0]);
  return pts;
}
const shapeOf = (pts) => new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])));

let glowTex = null;
function stripTexture() {
  if (glowTex) return glowTex;
  const c = cv(64, 128), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(255,200,110,0)'); g.addColorStop(0.5, 'rgba(255,226,160,1)'); g.addColorStop(1, 'rgba(255,200,110,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 128);
  const gx = x.createLinearGradient(0, 0, 64, 0); gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(0.15, 'rgba(0,0,0,1)'); gx.addColorStop(0.85, 'rgba(0,0,0,1)'); gx.addColorStop(1, 'rgba(0,0,0,0)');
  x.globalCompositeOperation = 'destination-in'; x.fillStyle = gx; x.fillRect(0, 0, 64, 128);
  glowTex = tex(c); return glowTex;
}

/**
 * Builds the santoor for an instrument geometry { hb, len, rh, m, half } (the same numbers layout.makeInst computes).
 * Returns { group, Hb, bridgeTop, update(ss, focus, hot), dispose() }.
 */
export function buildSantoor(p, M) {
  const { hb, len, rh, m, half } = p;
  const e = m * 0.9, rad = Math.max(10, m), Hb = clamp(hb * 0.1, 10, 36), bev = Math.min(4, Hb * 0.22);
  const group = new THREE.Group(), disposables = [];
  const geo = (g) => { disposables.push(g); return g; };

  // body: an extruded, bevelled trapezoid (lid = walnut, sides = darker walnut)
  const outline = trapPoints(half, len, e - bev * 0.8, rad);
  const bodyGeo = geo(new THREE.ExtrudeGeometry(shapeOf(outline), { depth: Hb - bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.8, bevelSegments: 4, curveSegments: 8 }));
  const W = 2 * (hb + e), Ltex = len + 2 * e;
  const lid = M.lid.clone(); lid.map = M.walnutTex.clone(); lid.bumpMap = M.walnutBump.clone();
  for (const t of [lid.map, lid.bumpMap]) { t.repeat.set(1 / W, 1 / Ltex); t.offset.set(0.5, e / Ltex); t.needsUpdate = true; }
  const sideMat = M.side.clone(); sideMat.map = M.walnutTex.clone(); sideMat.map.repeat.set(1 / 700, 1 / 90); sideMat.map.needsUpdate = true;
  disposables.push(lid, sideMat);
  const body = new THREE.Mesh(bodyGeo, [lid, sideMat]); body.castShadow = true; body.receiveShadow = true; group.add(body);

  // brass inlay line near the edge, ebony centre band with ivory diamonds
  const lineOuter = trapPoints(half, len, e - m * 0.34, rad * 0.8), lineInner = trapPoints(half, len, e - m * 0.34 - 2.6, rad * 0.7);
  const lineShape = shapeOf(lineOuter); lineShape.holes.push(new THREE.Path(lineInner.map((q) => new THREE.Vector2(q[0], q[1])).reverse()));
  const inlay = new THREE.Mesh(geo(new THREE.ExtrudeGeometry(lineShape, { depth: 0.8, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.4, bevelSegments: 1 })), M.brass);
  inlay.position.z = Hb - 0.2; inlay.receiveShadow = true; group.add(inlay);
  const bandPts = [[-half(0) * 0.28, 0], [half(0) * 0.28, 0], [half(len) * 0.28, len], [-half(len) * 0.28, len]];
  const band = new THREE.Mesh(geo(new THREE.ExtrudeGeometry(shapeOf(bandPts), { depth: 0.7, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.6, bevelSegments: 1 })), M.ebony);
  band.position.z = Hb - 0.1; band.receiveShadow = true; group.add(band);
  for (let c = 0; c < NCOURSE; c++) {
    const y = (c + 0.5) * rh, w = Math.min(rh * 0.18, half(y) * 0.1);
    const d = new THREE.Mesh(geo(new THREE.ExtrudeGeometry(shapeOf([[0, y - w * 1.6], [w, y], [0, y + w * 1.6], [-w, y]]), { depth: 0.9, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 1 })), c % 2 ? M.bone : M.brass);
    d.position.z = Hb + 0.6; d.castShadow = false; group.add(d);
  }

  // tuning and hitch pins: three per course on both slanted edges
  const pr = Math.max(3, m * 0.3), ph = pr * 1.9;
  const profile = [[0, 0], [pr * 1.15, 0], [pr * 1.15, ph * 0.22], [pr * 0.62, ph * 0.3], [pr * 0.55, ph * 0.72], [pr * 0.9, ph * 0.78], [pr * 0.92, ph * 0.95], [pr * 0.5, ph], [0, ph]].map(([r2, y]) => new THREE.Vector2(r2, y));
  const pinGeo = geo(new THREE.LatheGeometry(profile, 14)); pinGeo.rotateX(Math.PI / 2);
  const pins = new THREE.InstancedMesh(pinGeo, M.brassDeep, NCOURSE * 3 * 2); pins.castShadow = true; pins.receiveShadow = true;
  const gap = Math.min(rh * 0.15, 11), mtx = new THREE.Matrix4();
  let pi = 0;
  const pinX = (y) => half(y) + e * 0.32;
  for (let c = 0; c < NCOURSE; c++) for (let k = -1; k <= 1; k++) {
    const y = (c + 0.5) * rh + k * gap;
    for (const sgn of [-1, 1]) { mtx.makeTranslation(sgn * pinX(y), y, Hb); mtx.multiply(new THREE.Matrix4().makeRotationZ(((c * 3 + k) * 1.7) % TAU)); pins.setMatrixAt(pi++, mtx); }
  }
  pins.instanceMatrix.needsUpdate = true; group.add(pins);

  // bridges: rosewood blocks with a brass cap, two rows
  const wd = clamp(rh * 0.5, 14, 52), dd = clamp(rh * 0.15, 6, 16), hbr = clamp(rh * 0.14, 5, 16);
  const bridgeGeo = geo(B.roundedBox(dd, wd, hbr, dd * 0.32, 3)), capGeo = geo(B.roundedBox(dd * 0.4, wd - 5, 1.8, 0.6, 2));
  const caps = [];
  for (let c = 0; c < NCOURSE; c++) {
    const y = (c + 0.5) * rh, hy = half(y);
    for (const sgn of [-1, 1]) {
      const x = sgn * hy * BRIDGE_AT;
      const br = new THREE.Mesh(bridgeGeo, M.rose); br.position.set(x, y, Hb + hbr / 2); br.castShadow = true; br.receiveShadow = true; group.add(br);
      const mat = M.brass.clone(); disposables.push(mat); mat.emissive = new THREE.Color('#ffb347'); mat.emissiveIntensity = 0;
      const cap = new THREE.Mesh(capGeo, mat); cap.position.set(x, y, Hb + hbr + 0.3); cap.castShadow = true; group.add(cap); caps[c * 2 + (sgn > 0 ? 1 : 0)] = mat;
    }
  }
  const zTop = Hb + hbr + 1.2;

  // strings: 3 per course; pin -> over the left bridge -> across the band -> over the right bridge -> pin. Rings in the (ly, z) plane, so a
  // string is a ribbon of RAD points per sample; vibration only moves samples (lateral + a little vertical).
  const thin = clamp(rh * 0.04, 1.1, 2.4) * 0.8, RAD = 6, N1 = 10, N2 = 12, NP = N1 + N2 + N1;
  const ringC = [], ringS = [];
  for (let j = 0; j < RAD; j++) { ringC.push(Math.cos((j / RAD) * TAU)); ringS.push(Math.sin((j / RAD) * TAU)); }
  const strings = [];
  const idx = [];
  for (let s = 0; s < NP - 1; s++) for (let j = 0; j < RAD; j++) { const a = s * RAD + j, b2 = s * RAD + ((j + 1) % RAD), c2 = (s + 1) * RAD + j, d2 = (s + 1) * RAD + ((j + 1) % RAD); idx.push(a, c2, b2, b2, c2, d2); }
  const nor = new Float32Array(NP * RAD * 3);
  for (let s = 0; s < NP; s++) for (let j = 0; j < RAD; j++) { const o = (s * RAD + j) * 3; nor[o] = 0; nor[o + 1] = ringC[j]; nor[o + 2] = ringS[j]; }
  for (let c = 0; c < NCOURSE; c++) for (let k = -1; k <= 1; k++) {
    const y = (c + 0.5) * rh + k * gap, hy = half(y), bl = -hy * BRIDGE_AT, br = hy * BRIDGE_AT, xl = -pinX(y), xr = pinX(y);
    const zPin = Hb + ph * 0.55, zB = Hb + hbr + 1.6;
    const cx = new Float32Array(NP), cz = new Float32Array(NP), lat = new Float32Array(NP);
    for (let i = 0; i < N1; i++) { const t = i / N1; cx[i] = xl + (bl - xl) * t; cz[i] = zPin + (zB - zPin) * t; lat[i] = Math.sin(Math.PI * t); }
    for (let i = 0; i < N2; i++) { const t = i / (N2 - 1); cx[N1 + i] = bl + (br - bl) * t; cz[N1 + i] = zB; lat[N1 + i] = Math.sin(Math.PI * t); }
    for (let i = 0; i < N1; i++) { const t = (i + 1) / N1; cx[N1 + N2 + i] = br + (xr - br) * t; cz[N1 + N2 + i] = zB + (zPin - zB) * t; lat[N1 + N2 + i] = Math.sin(Math.PI * (1 - t)); }
    const g = new THREE.BufferGeometry(), pos = new Float32Array(NP * RAD * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(idx);
    disposables.push(g);
    const mesh = new THREE.Mesh(g, c >= 3 ? M.steel : M.brass); mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; group.add(mesh);
    const S = { c, k, y, g, cx, cz, lat, pos, mesh, was: true };
    strings.push(S); writeString(S, 0, 0, 0, 0, 0, 0, 0);
  }
  function writeString(S, vl, pl, vm, pm, vr, pr2, kk) {
    const { cx: X, cz: Z, lat, pos, y } = S;
    for (let i = 0; i < NP; i++) {
      const part = i < N1 ? 0 : i < N1 + N2 ? 1 : 2, v = part === 0 ? vl : part === 1 ? vm : vr, ph2 = part === 0 ? pl : part === 1 ? pm : pr2;
      const wave = v > 0.002 ? lat[i] * v * rh * 0.16 * Math.cos(ph2 + kk * 0.9) : 0;
      const wz = v > 0.002 ? lat[i] * v * rh * 0.045 * Math.sin(ph2 * 1.3 + kk) : 0;
      for (let j = 0; j < RAD; j++) { const o = (i * RAD + j) * 3; pos[o] = X[i]; pos[o + 1] = y + wave + ringC[j] * thin; pos[o + 2] = Z[i] + wz + ringS[j] * thin; }
    }
    S.g.attributes.position.needsUpdate = true;
  }

  // glow strips over the strings of each note (additive), one per half course
  const strip = stripTexture(), glows = [];
  const glowMats = [];
  for (let n = 0; n < NCOURSE * 2; n++) {
    const c = n >> 1, side = n & 1, y = (c + 0.5) * rh, hy = half(y), x0 = side ? hy * BRIDGE_AT : -pinX(y), x1 = side ? pinX(y) : -hy * BRIDGE_AT;
    const mat = new THREE.MeshBasicMaterial({ map: strip, color: SIDE_COL[side], transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    glowMats.push(mat);
    const mesh = new THREE.Mesh(geo(new THREE.PlaneGeometry(Math.abs(x1 - x0), gap * 2 + 22)), mat);
    mesh.position.set((x0 + x1) / 2, y, Hb + 1.4); mesh.renderOrder = 4; mesh.visible = false; group.add(mesh); glows.push(mesh);
  }

  function update(ss, focus, hot, t = 0) {
    for (const S of strings) {
      const a = ss?.[S.c * 2] ?? {}, b = ss?.[S.c * 2 + 1] ?? {};
      const vl = a.vib ?? 0, vr = b.vib ?? 0, vm = Math.max(vl, vr) * 0.35, active = vl > 0.01 || vr > 0.01;
      if (!active && !S.was) continue;
      S.was = active;
      writeString(S, active ? vl : 0, (a.ph ?? 0), active ? vm : 0, (a.ph ?? 0) + (b.ph ?? 0), active ? vr : 0, (b.ph ?? 0), S.k);
    }
    for (let n = 0; n < NCOURSE * 2; n++) {
      const g0 = ss?.[n]?.glow ?? 0, soft = focus && focus.has(n) ? 0.16 + 0.06 * Math.sin(t * 5) : 0, o = Math.min(1, 0.5 * g0 + soft + (focus ? 0 : 0));
      glows[n].visible = o > 0.01; glowMats[n].opacity = o;
      if (caps[n]) caps[n].emissiveIntensity = (hot && hot.has(n) ? 0.55 + 0.25 * Math.sin(t * 6) : 0) + g0 * 0.4;
    }
  }
  function dispose() { for (const d of disposables) d.dispose?.(); }
  return { group, Hb, bridgeTop: zTop, update, dispose, pinH: ph };
}

// ---- mallets: slim walnut shaft, slightly bent, with a small pale spoon-shaped head and a coloured band --------------------------
/** Local frame: the tip at the origin, the shaft runs along +x (200 units long at scale 1), z up. */
export function buildMallet(side, M) {
  const group = new THREE.Group(), L = 200, w = 9, RADL = 10, NS = 26;
  const pos = [], nor = [], idx = [], uvs = [];
  const bend = (s) => 12 * 2 * s * (1 - s) * (side === 0 ? -1 : 1) * 0.5;
  const pts = [];
  for (let i = 0; i < NS; i++) { const s = i / (NS - 1); pts.push([s * L, bend(s), 0, w * (0.34 + 0.2 * s)]); }
  for (let i = 0; i < NS; i++) {
    const [x, y, z, rr] = pts[i], j0 = pts[Math.max(0, i - 1)], j1 = pts[Math.min(NS - 1, i + 1)];
    let tx = j1[0] - j0[0], ty = j1[1] - j0[1]; const tl = Math.hypot(tx, ty); tx /= tl; ty /= tl;
    const nx = -ty, ny = tx;
    for (let j = 0; j < RADL; j++) {
      const a = (j / RADL) * TAU, c = Math.cos(a), s2 = Math.sin(a);
      pos.push(x + nx * c * rr, y + ny * c * rr, z + s2 * rr); nor.push(nx * c, ny * c, s2); uvs.push(0.2 + 0.6 * (j / RADL), i / (NS - 1));
    }
  }
  for (let i = 0; i < NS - 1; i++) for (let j = 0; j < RADL; j++) { const a = i * RADL + j, b = i * RADL + (j + 1) % RADL, c = (i + 1) * RADL + j, d = (i + 1) * RADL + (j + 1) % RADL; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx);
  const shaftMat = new THREE.MeshPhysicalMaterial({ map: M.walnutTex.clone(), color: '#e8c9a0', roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.15 });
  shaftMat.map.repeat.set(0.6, 0.5); shaftMat.map.needsUpdate = true;
  const shaft = new THREE.Mesh(g, shaftMat); shaft.castShadow = true; group.add(shaft);
  const hr = w * 1.45;
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshPhysicalMaterial({ color: '#f3dfb4', roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.12 }));
  head.scale.set(hr * 1.15, hr, hr * 0.55); head.position.set(-hr * 0.1, 0, hr * 0.1); head.castShadow = true; group.add(head);
  const bandMat = new THREE.MeshStandardMaterial({ color: SIDE_COL[side], emissive: SIDE_COL[side], emissiveIntensity: 0.35, roughness: 0.4 });
  const band = new THREE.Mesh(new THREE.TorusGeometry(w * 0.52, w * 0.2, 8, 20), bandMat); band.rotation.y = Math.PI / 2; band.position.set(hr * 1.9, bend(hr * 1.9 / L), 0); group.add(band);
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(hr * 7, hr * 7), new THREE.MeshBasicMaterial({ map: tex(blobCanvas('255,226,160', 0.9, 64)), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  gl.position.set(0, 0, hr * 0.9); gl.renderOrder = 6; group.add(gl);
  const headMat = head.material;
  for (const mt of [shaftMat, headMat, bandMat]) mt.transparent = true;
  group.userData = { glow: gl, shaftMat, bandMat, head, L, mats: [shaftMat, headMat, bandMat] };
  return group;
}

// ---- small props --------------------------------------------------------------------------------------------------------------------
/** A brass oil lamp (diya): lathe bowl on a foot with a spout, a cotton wick; returns the group and the flame's local position. */
export function buildLamp(M) {
  const g = new THREE.Group();
  const prof = [[0, 0], [10, 0], [12, 2], [9, 4], [10, 7], [15, 11], [22, 17], [24, 21], [21, 22], [17, 18], [10, 14], [0, 13]].map(([r, y]) => new THREE.Vector2(r, y));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), M.brass); bowl.rotation.x = Math.PI / 2; bowl.castShadow = true; bowl.receiveShadow = true; g.add(bowl);
  const oil = new THREE.Mesh(new THREE.CircleGeometry(16, 20), new THREE.MeshStandardMaterial({ color: '#7a4a10', roughness: 0.2, metalness: 0.2 })); oil.position.z = 17.5; g.add(oil);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 9, 8), new THREE.MeshStandardMaterial({ color: '#ece0c0', roughness: 0.9 })); wick.rotation.x = Math.PI / 2; wick.position.set(10, 0, 20); g.add(wick);
  return g;
}
/** A small marigold petal (slightly cupped), one geometry for the instanced petals. */
export function petalGeometry() {
  const s = new THREE.Shape(); s.moveTo(0, -0.5); s.bezierCurveTo(0.45, -0.3, 0.42, 0.35, 0, 0.5); s.bezierCurveTo(-0.42, 0.35, -0.45, -0.3, 0, -0.5);
  const g = new THREE.ShapeGeometry(s, 8), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, (p.getX(i) * p.getX(i)) * 0.7);
  g.computeVertexNormals(); return g;
}
/** A faceted extruded star for the result screen. */
export function starGeometry(size, filled = true) {
  const s = new THREE.Shape();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? size * 0.23 : size * 0.5; k ? s.lineTo(Math.cos(a) * rr, -Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, -Math.sin(a) * rr); }
  s.closePath();
  const dep = size * (filled ? 0.16 : 0.07), b = size * 0.05;
  const g = new THREE.ExtrudeGeometry(s, { depth: dep, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3 });
  g.translate(0, 0, b); return g;
}

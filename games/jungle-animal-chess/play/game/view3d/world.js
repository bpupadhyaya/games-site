// The 3D world for Jungle: a sunlit clearing, a carved teak board set into the moss with brass corners, a meadow of green baize with two real pools
// (stone-rimmed, animated water), dark trap pits and a little shrine for each den, and eight carved animals standing on lacquered team bases.
// Everything is procedural. Units: ONE WORLD UNIT = ONE BOARD CELL, y up. Board display row 0 (the top of the flat game) is far (-z), column 0 is left (-x).
import * as THREE from '../vendor3d/three.js';
import { SHAPES, outline, paintAnimal, W as AW, BOX } from '../src/animals.js';

export const COLS = 7, ROWS = 9, FRW = 0.5;
export const TOP = 0.46;                                  // top of the slab
export const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, rep = null, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
export const radialTex = (rgb, a = 1) => {
  const c = canvas(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
// terrain per display cell (same layout as rules.js, without importing it): 'w' water, 'r'/'b' trap of Red (bottom) / Blue (top), 'R'/'B' den
export const terrain = (c, r) => {
  if (r >= 3 && r <= 5 && [1, 2, 4, 5].includes(c)) return 'w';
  if (c === 3 && r === 8) return 'R'; if (c === 3 && r === 0) return 'B';
  if ((r === 8 && (c === 2 || c === 4)) || (r === 7 && c === 3)) return 'r';
  if ((r === 0 && (c === 2 || c === 4)) || (r === 1 && c === 3)) return 'b';
  return '';
};

// ---- wood: warm teak with grain, planks and knots --------------------------------------------------------------------------------------------
function woodFill(x, w, h, r, base, vertical = false) {
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, base[0]); g.addColorStop(0.5, base[1]); g.addColorStop(1, base[2]); x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < (vertical ? w : h) / 1.4; i++) {
    const p = r() * (vertical ? w : h), a = r();
    x.strokeStyle = a < 0.55 ? `rgba(40,18,6,${0.05 + r() * 0.12})` : `rgba(255,214,150,${0.04 + r() * 0.08})`; x.lineWidth = 0.6 + r() * 1.8;
    x.beginPath();
    if (vertical) { x.moveTo(p, 0); x.bezierCurveTo(p + (r() - 0.5) * 18, h * 0.3, p + (r() - 0.5) * 18, h * 0.7, p + (r() - 0.5) * 8, h); } else { x.moveTo(0, p); x.bezierCurveTo(w * 0.3, p + (r() - 0.5) * 18, w * 0.7, p + (r() - 0.5) * 18, w, p + (r() - 0.5) * 8); }
    x.stroke();
  }
}

// ---- the board top: frame, meadow, grid, pools, pits, den tiles. Returns { map } -----------------------------------------------------------------
function boardTexture(P) {
  const TW = COLS + 2 * FRW, TH = ROWS + 2 * FRW, w = Math.round(TW * P), h = Math.round(TH * P), f = FRW * P, r = lcg(31);
  const c = canvas(w, h), x = c.getContext('2d');
  woodFill(x, w, h, r, ['#7a4a22', '#6a3d1a', '#58300f']);
  // brass inlay line round the field and a darker bevel
  x.strokeStyle = 'rgba(20,8,0,0.55)'; x.lineWidth = Math.max(3, P * 0.05); x.strokeRect(f - P * 0.03, f - P * 0.03, COLS * P + P * 0.06, ROWS * P + P * 0.06);
  x.strokeStyle = '#d9a94a'; x.lineWidth = Math.max(2, P * 0.035); x.strokeRect(f - P * 0.1, f - P * 0.1, COLS * P + P * 0.2, ROWS * P + P * 0.2);
  x.strokeStyle = 'rgba(255,236,170,0.5)'; x.lineWidth = Math.max(1, P * 0.012); x.strokeRect(f - P * 0.115, f - P * 0.115, COLS * P + P * 0.23, ROWS * P + P * 0.23);
  // meadow: layered greens with blades
  x.save(); x.beginPath(); x.rect(f, f, COLS * P, ROWS * P); x.clip(); x.translate(f, f);
  const g = x.createLinearGradient(0, 0, COLS * P, ROWS * P); g.addColorStop(0, '#6fb94b'); g.addColorStop(0.5, '#5aa43d'); g.addColorStop(1, '#478d33'); x.fillStyle = g; x.fillRect(0, 0, COLS * P, ROWS * P);
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) if ((i + j) % 2) { x.fillStyle = 'rgba(10,60,10,0.09)'; x.fillRect(i * P, j * P, P, P); }
  for (let i = 0; i < COLS * ROWS * P * 0.6; i++) { const px = r() * COLS * P, py = r() * ROWS * P, hh = 3 + r() * P * 0.09; x.strokeStyle = r() < 0.5 ? `rgba(20,80,16,${0.18 + r() * 0.22})` : `rgba(190,235,120,${0.12 + r() * 0.2})`; x.lineWidth = 1 + r() * 1.4; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * hh * 0.7, py - hh); x.stroke(); }
  // clover and tiny flowers
  for (let i = 0; i < 70; i++) { const px = r() * COLS * P, py = r() * ROWS * P; x.fillStyle = ['rgba(255,245,200,0.85)', 'rgba(255,200,230,0.8)', 'rgba(255,230,120,0.85)'][i % 3]; x.beginPath(); x.arc(px, py, 1.6 + r() * 2.2, 0, 7); x.fill(); }
  // grid: soft dark channel + pale lip
  x.lineCap = 'round';
  for (const [col, lw, off] of [['rgba(12,50,14,0.55)', Math.max(2, P * 0.034), 0], ['rgba(230,250,190,0.30)', Math.max(1, P * 0.014), Math.max(1.4, P * 0.03)]]) {
    x.strokeStyle = col; x.lineWidth = lw; x.beginPath();
    for (let i = 0; i <= COLS; i++) { x.moveTo(i * P + off, 0); x.lineTo(i * P + off, ROWS * P); }
    for (let j = 0; j <= ROWS; j++) { x.moveTo(0, j * P + off); x.lineTo(COLS * P, j * P + off); }
    x.stroke();
  }
  // pools: sandy shore, then the water bed (the animated water plane lies over it)
  for (const c0 of [1, 4]) {
    const x0 = c0 * P, y0 = 3 * P, pw = 2 * P, ph = 3 * P;
    x.fillStyle = '#cdbd92'; x.beginPath(); x.roundRect(x0 - P * 0.06, y0 - P * 0.06, pw + P * 0.12, ph + P * 0.12, P * 0.2); x.fill();
    x.fillStyle = '#2d9fcf'; x.beginPath(); x.roundRect(x0 + P * 0.06, y0 + P * 0.06, pw - P * 0.12, ph - P * 0.12, P * 0.16); x.fill();
  }
  // traps and dens
  const tile = (cx, cy, kind) => {
    const R = kind === 'r' || kind === 'R', col = R ? '#e0493a' : '#4f8ee8', x0 = cx * P, y0 = cy * P;
    if (kind === 'r' || kind === 'b') {
      x.fillStyle = '#1f2a1c'; x.fillRect(x0 + P * 0.07, y0 + P * 0.07, P * 0.86, P * 0.86);
      x.strokeStyle = 'rgba(120,150,110,0.55)'; x.lineWidth = Math.max(1.5, P * 0.02); x.beginPath(); for (let k = 1; k < 5; k++) { x.moveTo(x0 + P * 0.07 + k * P * 0.172, y0 + P * 0.07); x.lineTo(x0 + P * 0.07 + k * P * 0.172, y0 + P * 0.93); x.moveTo(x0 + P * 0.07, y0 + P * 0.07 + k * P * 0.172); x.lineTo(x0 + P * 0.93, y0 + P * 0.07 + k * P * 0.172); } x.stroke();
      x.strokeStyle = col; x.lineWidth = Math.max(3, P * 0.06); x.strokeRect(x0 + P * 0.1, y0 + P * 0.1, P * 0.8, P * 0.8);
    } else {
      const gg = x.createRadialGradient(x0 + P / 2, y0 + P / 2, P * 0.05, x0 + P / 2, y0 + P / 2, P * 0.5); gg.addColorStop(0, R ? '#ffb09a' : '#a8cdff'); gg.addColorStop(1, col); x.fillStyle = gg; x.fillRect(x0 + P * 0.04, y0 + P * 0.04, P * 0.92, P * 0.92);
      x.strokeStyle = '#e8c15c'; x.lineWidth = Math.max(3, P * 0.05); x.strokeRect(x0 + P * 0.08, y0 + P * 0.08, P * 0.84, P * 0.84);
    }
  };
  for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) { const k = terrain(cc, rr); if (k && k !== 'w') tile(cc, rr, k); }
  x.restore();
  // brass corner studs on the frame
  for (const [sx, sy] of [[f * 0.5, f * 0.5], [w - f * 0.5, f * 0.5], [f * 0.5, h - f * 0.5], [w - f * 0.5, h - f * 0.5]]) {
    const gg = x.createRadialGradient(sx - 3, sy - 3, 1, sx, sy, f * 0.3); gg.addColorStop(0, '#fff2b0'); gg.addColorStop(0.5, '#d8a43c'); gg.addColorStop(1, '#7a521a'); x.fillStyle = gg; x.beginPath(); x.arc(sx, sy, f * 0.28, 0, 7); x.fill();
  }
  return tex(c);
}

function waterTexture() {
  const c = canvas(256, 256), x = c.getContext('2d'), r = lcg(9);
  const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, '#5fd0f0'); g.addColorStop(1, '#1f8fd0'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 46; i++) { const px = r() * 256, py = r() * 256, len = 18 + r() * 40; x.strokeStyle = `rgba(255,255,255,${0.1 + r() * 0.22})`; x.lineWidth = 1 + r() * 2; x.beginPath(); x.moveTo(px, py); x.bezierCurveTo(px + len * 0.3, py - 5, px + len * 0.7, py + 5, px + len, py); x.stroke(); if (px + len > 256) { x.beginPath(); x.moveTo(px - 256, py); x.bezierCurveTo(px - 256 + len * 0.3, py - 5, px - 256 + len * 0.7, py + 5, px - 256 + len, py); x.stroke(); } }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// ---- a carved den shrine --------------------------------------------------------------------------------------------------------------------
function buildShrine(col) {
  const g = new THREE.Group(), stone = new THREE.MeshStandardMaterial({ color: 0xcfc5ab, roughness: 0.85 }), team = new THREE.MeshStandardMaterial({ color: col, roughness: 0.45, metalness: 0.1 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0b455, roughness: 0.3, metalness: 0.8 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.1, 0.78), stone); base.position.y = 0.05; g.add(base);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 0.5), team); body.position.y = 0.23; g.add(body);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.02), new THREE.MeshStandardMaterial({ color: 0x180c06, roughness: 1 })); door.position.set(0, 0.2, 0.26); g.add(door);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.46, 0.26, 4), new THREE.MeshStandardMaterial({ color: new THREE.Color(col).multiplyScalar(0.75), roughness: 0.55 })); roof.rotation.y = Math.PI / 4; roof.position.y = 0.49; g.add(roof);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), gold); tip.position.y = 0.66; g.add(tip);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ---- the board -------------------------------------------------------------------------------------------------------------------------------
export function buildBoard(texSize) {
  const P = Math.floor(texSize / (ROWS + 2 * FRW + 0.5)), grp = new THREE.Group(), owned = [];
  const TW = COLS + 2 * FRW, TH = ROWS + 2 * FRW;
  const top = boardTexture(P); owned.push(top);
  const rw = canvas(512, 512); woodFill(rw.getContext('2d'), 512, 512, lcg(3), ['#6a3d1a', '#5a3112', '#4a260c']); const side = tex(rw, [2, 1]); owned.push(side);
  const sideMat = new THREE.MeshStandardMaterial({ map: side, roughness: 0.6 }), topMat = new THREE.MeshStandardMaterial({ map: top, roughness: 0.78 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(TW, TOP, TH), [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]); slab.position.y = TOP / 2; slab.castShadow = true; slab.receiveShadow = true; grp.add(slab);
  // brass edge bead round the top, and chunky feet shadows
  const brass = new THREE.MeshStandardMaterial({ color: 0xd9a94a, roughness: 0.3, metalness: 0.85 });
  for (const [sx, sz, w, d] of [[0, -TH / 2 + 0.03, TW, 0.06], [0, TH / 2 - 0.03, TW, 0.06], [-TW / 2 + 0.03, 0, 0.06, TH], [TW / 2 - 0.03, 0, 0.06, TH]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), brass); m.position.set(sx, TOP + 0.01, sz); m.castShadow = true; grp.add(m); }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.12, 20), brass); m.position.set(sx * (TW / 2 - 0.22), TOP + 0.04, sz * (TH / 2 - 0.22)); m.castShadow = true; grp.add(m); }
  // pools: sandy rim blocks + animated water
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd8c9a0, roughness: 0.9 });
  const wt = waterTexture(); owned.push(wt);
  const waterMat = new THREE.MeshStandardMaterial({ map: wt, color: 0xbfeaff, roughness: 0.12, metalness: 0.0, transparent: true, opacity: 0.8, emissive: 0x0b4a7a, emissiveIntensity: 0.25 });
  const waters = [];
  for (const c0 of [1, 4]) {
    const cx = c0 + 1 - COLS / 2, cz = 3 + 1.5 - ROWS / 2;
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.84, 2.84), waterMat.clone()); w.rotation.x = -Math.PI / 2; w.position.set(cx, TOP - 0.015, cz); w.material.map = wt.clone(); w.material.map.needsUpdate = true; w.material.map.repeat.set(1.2, 1.8); w.receiveShadow = true; waters.push(w); grp.add(w);
    for (const [dx, dz, ww, dd] of [[0, -1.5, 2.12, 0.14], [0, 1.5, 2.12, 0.14], [-1.0, 0, 0.14, 3.0], [1.0, 0, 0.14, 3.0]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(ww, 0.07, dd), rimMat); m.position.set(cx + dx, TOP + 0.02, cz + dz); m.castShadow = true; m.receiveShadow = true; grp.add(m); }
    // reeds on the rim
    for (let k = 0; k < 7; k++) { const rr = lcg(c0 * 7 + k), reed = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.018, 0.3 + rr() * 0.12, 5), new THREE.MeshStandardMaterial({ color: 0x4f7d2c, roughness: 0.8 })); reed.position.set(cx + (k % 2 ? 1.05 : -1.05), TOP + 0.17, cz - 1.3 + k * 0.44); reed.rotation.z = (rr() - 0.5) * 0.3; grp.add(reed); }
  }
  // shrines (display row 0 = Blue den, row 8 = Red den)
  const blue = buildShrine(0x3a78d8), red = buildShrine(0xd23a2c);
  blue.position.set(0, TOP, 0 + 0.5 - ROWS / 2); red.position.set(0, TOP, 8 + 0.5 - ROWS / 2); grp.add(blue, red);
  grp.userData.waters = waters;
  grp.userData.dispose = () => { owned.forEach((t) => t.dispose()); grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => { if (m.map && !owned.includes(m.map)) m.map.dispose(); m.dispose(); }); }); };
  return grp;
}

// ---- the clearing -----------------------------------------------------------------------------------------------------------------------------
function mossTexture() {
  const c = canvas(512, 512), x = c.getContext('2d'), r = lcg(77);
  const g = x.createLinearGradient(0, 0, 512, 512); g.addColorStop(0, '#2f5a2b'); g.addColorStop(0.5, '#264f26'); g.addColorStop(1, '#1d4120'); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2400; i++) { x.fillStyle = r() < 0.5 ? `rgba(120,190,80,${0.05 + r() * 0.12})` : `rgba(5,25,8,${0.08 + r() * 0.14})`; x.beginPath(); x.arc(r() * 512, r() * 512, 1 + r() * 4, 0, 7); x.fill(); }
  for (let i = 0; i < 14; i++) { x.fillStyle = `rgba(120,100,70,${0.06 + r() * 0.08})`; x.beginPath(); x.ellipse(r() * 512, r() * 512, 10 + r() * 22, 5 + r() * 9, r() * 3, 0, 7); x.fill(); }
  return tex(c, [10, 10]);
}
function leafTexture(h1, h2) {
  const c = canvas(128, 256), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, h1); g.addColorStop(0.5, h2); g.addColorStop(1, h1);
  x.fillStyle = g; x.fillRect(0, 0, 128, 256); x.strokeStyle = 'rgba(210,240,160,0.55)'; x.lineWidth = 3; x.beginPath(); x.moveTo(64, 4); x.lineTo(64, 252); x.stroke(); x.lineWidth = 1.4;
  for (let k = 0; k < 11; k++) { const y = 30 + k * 20; x.beginPath(); x.moveTo(64, y); x.lineTo(10 + (k % 2) * 4, y - 22); x.moveTo(64, y); x.lineTo(118 - (k % 2) * 4, y - 22); x.stroke(); }
  return tex(c);
}
export function buildRoom(scene) {
  const grp = new THREE.Group(); scene.add(grp);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(70, 48), new THREE.MeshStandardMaterial({ map: mossTexture(), roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; grp.add(ground);
  const r = lcg(5);
  // big leaves in a ring, rising and leaning out (double sided), several greens
  const leafShape = new THREE.Shape(); leafShape.moveTo(0, 0); leafShape.bezierCurveTo(0.9, 0.5, 0.9, 1.6, 0, 2.6); leafShape.bezierCurveTo(-0.9, 1.6, -0.9, 0.5, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 8); const uv = leafGeo.attributes.uv, pos = leafGeo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 1.8 + 0.5, pos.getY(i) / 2.6);
  const mats = [leafTexture('#1f5a24', '#3f8a35'), leafTexture('#2a6a2a', '#58a845'), leafTexture('#15481c', '#2e7a30')].map((t) => new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.7 }));
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + r() * 0.2, rad = 8.2 + r() * 5.5, s = 1.6 + r() * 1.8, m = new THREE.Mesh(leafGeo, mats[i % 3]);
    m.position.set(Math.sin(a) * rad, 0, Math.cos(a) * rad); m.rotation.order = 'YXZ'; m.rotation.y = a + Math.PI + (r() - 0.5) * 0.5; m.rotation.x = -(0.2 + r() * 0.5); m.scale.set(s, s * (1.1 + r() * 0.5), s); m.castShadow = false; grp.add(m);
  }
  // bamboo stalks with nodes at the back
  const bam = new THREE.MeshStandardMaterial({ color: 0x8aa83c, roughness: 0.55 }), node = new THREE.MeshStandardMaterial({ color: 0x5c7a22, roughness: 0.6 });
  for (let i = 0; i < 16; i++) {
    const x0 = -14 + i * 1.9 + (r() - 0.5), z0 = -12 - r() * 5, h = 12 + r() * 6, st = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, h, 8), bam); st.position.set(x0, h / 2, z0); st.castShadow = true; grp.add(st);
    for (let k = 1; k < 7; k++) { const n = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 8), node); n.position.set(x0, k * h / 7, z0); grp.add(n); }
  }
  // mossy rocks
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x58704f, roughness: 1, flatShading: true });
  for (let i = 0; i < 6; i++) { const a = r() * 6.28, rad = 9 + r() * 3, rk = new THREE.Mesh(new THREE.SphereGeometry(0.5 + r() * 0.8, 6, 4), rockMat); rk.position.set(Math.sin(a) * rad, 0.15, Math.cos(a) * rad); rk.scale.y = 0.55; rk.rotation.set(r() * 3, r() * 3, r() * 3); rk.castShadow = true; rk.receiveShadow = true; grp.add(rk); }
  // fireflies / pollen
  const N = 70, geo = new THREE.BufferGeometry(), arr = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { arr[i * 3] = (r() - 0.5) * 16; arr[i * 3 + 1] = 0.5 + r() * 5; arr[i * 3 + 2] = (r() - 0.5) * 16; }
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const flakes = new THREE.Points(geo, new THREE.PointsMaterial({ map: radialTex('255,245,170', 1), size: 0.22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xfff2a8, fog: false })); grp.add(flakes);
  // light shafts: faint additive planes slanting through the clearing
  const shaft = new THREE.MeshBasicMaterial({ map: radialTex('255,244,190', 0.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5, side: THREE.DoubleSide, fog: false });
  for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 15), shaft); p.position.set(-9 + i * 5.5, 5, -7 - (i % 2) * 3); p.rotation.z = 0.34; p.rotation.y = 0.2; grp.add(p); }
  return { group: grp, flakes };
}
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xdff2d0, 0x2a4a22, 0.8); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0c8, 2.5); sun.position.set(-6, 12, 8); sun.target.position.set(0, 0, 0); scene.add(sun, sun.target);
  sun.shadow.camera.left = -8; sun.shadow.camera.right = 8; sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9; sun.shadow.camera.near = 1; sun.shadow.camera.far = 40; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  const fill = new THREE.DirectionalLight(0x9fd0ff, 0.5); fill.position.set(7, 6, -6); scene.add(fill);
  const warm = new THREE.PointLight(0xffc070, 12, 12, 2); warm.position.set(0, 3, 6); scene.add(warm);
  return { hemi, sun, fill, warm };
}

// ---- pieces: a lacquered base disc and the carved animal standing on it ---------------------------------------------------------------------------
const BASE_H = 0.13;
export const PIECE_TOP = BASE_H;
export function makePieceKits() {
  const owned = [], geos = {}, mats = {};
  const baseGeo = (() => {
    const pts = [[0, 0], [0.4, 0], [0.43, 0.025], [0.43, 0.09], [0.4, 0.125], [0.37, BASE_H], [0, BASE_H]].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(pts, 40); owned.push(g); return g;
  })();
  const ringGeo = new THREE.TorusGeometry(0.405, 0.02, 8, 40); ringGeo.rotateX(Math.PI / 2); owned.push(ringGeo);
  const baseMat = { 1: new THREE.MeshStandardMaterial({ color: 0xc92c20, roughness: 0.28, metalness: 0.05 }), 2: new THREE.MeshStandardMaterial({ color: 0x2862cf, roughness: 0.28, metalness: 0.05 }) };
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xe0b455, roughness: 0.25, metalness: 0.9 });
  owned.push(baseMat[1], baseMat[2], goldMat);
  const animal = (rank) => {
    if (geos[rank]) return;
    const o = outline(SHAPES[rank], 6), sh = new THREE.Shape(o.map(([px, py]) => new THREE.Vector2(px, py)));
    const D = 15, g = new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: true, bevelThickness: 1.8, bevelSize: 1.4, bevelSegments: 2, curveSegments: 1 });
    const s = AW[rank] / BOX.w; g.translate(-50, 0, -D / 2); g.scale(s, s, s); g.computeVertexNormals(); geos[rank] = g; owned.push(g);
    const c = canvas(400, 336), x = c.getContext('2d'); x.setTransform(4, 0, 0, -4, 0, 336); paintAnimal(x, rank);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.repeat.set(1 / BOX.w, 1 / (BOX.h)); t.offset.set(0, 0); owned.push(t);
    mats[rank] = [new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 }), new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.7 })]; owned.push(mats[rank][0], mats[rank][1]);
  };
  const make = (rank, side) => {
    animal(rank);
    const g = new THREE.Group(), b = new THREE.Mesh(baseGeo, baseMat[side]); b.castShadow = true; b.receiveShadow = true; g.add(b);
    const rg = new THREE.Mesh(ringGeo, goldMat); rg.position.y = 0.075; g.add(rg);
    const a = new THREE.Mesh(geos[rank], mats[rank]); a.position.y = BASE_H - 0.01; a.rotation.y = side === 1 ? 0 : Math.PI; a.castShadow = true; g.add(a);
    g.userData.animal = a; g.userData.side = side;
    return g;
  };
  return { make, dispose() { owned.forEach((o) => o.dispose()); } };
}

// Shove Ha'penny 3D models: the slate-and-oak board, the pennies, the chalk slots and the pub around them (table, panelled wall,
// pendant lamp, horse brasses, dartboard, a pint, spare pennies and a stick of chalk). Everything is procedural (canvas textures and
// analytic geometry, no image files). Units are the sim's world units: 1 unit = 1 sim unit, a penny is R = 9 across 2R.
// Coordinates: three X = world x - XC, three Z = world y - YC (the board's centre is the origin), Y up from the table top.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { R, TW, BEDS, BED_H, NEAR_Y, FAR_EDGE, LINE, WX0, WX1, WY0, WY1 } from '../src/sim.js';

export const XC = TW / 2, YC = (WY0 + WY1) / 2;
export const FH = 10;            // top of the oak frame above the table
export const SH = 13.4;          // top of the slate
export const T = 2.1;            // penny thickness (real ratio ~0.09 of the diameter, drawn at most 1.3x for readability)
export const COIN_Y = SH + T / 2;
export const wx = (x) => x - XC;
export const wz = (y) => y - YC;
export const SLOT_Y = FH + 0.7;

const TAU = Math.PI * 2;
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const tex = (canvas, { repeat, srgb = true, flipY = true, aniso = 8 } = {}) => {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso; t.flipY = flipY;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
};
export { tex };

// ---------------------------------------------------------------- pennies
// Worn old pennies: copper rosette (side 0) and silver beads-and-star (side 1), a bump map for the engraving, a reeded edge.
function faceCanvases(side) {
  const S = 512, c = cv(S), x = c.getContext('2d'), b = cv(S), bx = b.getContext('2d'), r = rng(side ? 77 : 31), C = S / 2, RR = S * 0.485;
  const pal = side === 0 ? ['#e6a56a', '#b8692f', '#6e3512'] : ['#f4f7fa', '#bcc6d0', '#6f7c89'];
  const g = x.createRadialGradient(C * 0.82, C * 0.78, S * 0.04, C, C, RR);
  g.addColorStop(0, pal[0]); g.addColorStop(0.6, pal[1]); g.addColorStop(1, pal[2]);
  x.fillStyle = pal[2]; x.fillRect(0, 0, S, S);
  x.fillStyle = g; x.beginPath(); x.arc(C, C, RR, 0, TAU); x.fill();
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, S, S);
  const dark = side === 0 ? 'rgba(60,24,6,0.75)' : 'rgba(40,52,64,0.7)';
  const both = (fn) => { fn(x, dark, 1); fn(bx, 'rgba(255,255,255,0.9)', 1); };
  // raised rim and inner ring
  both((ctx, col) => { ctx.strokeStyle = col; ctx.lineWidth = S * 0.035; ctx.beginPath(); ctx.arc(C, C, RR * 0.93, 0, TAU); ctx.stroke(); });
  both((ctx, col) => { ctx.strokeStyle = col; ctx.lineWidth = S * 0.012; ctx.beginPath(); ctx.arc(C, C, RR * 0.8, 0, TAU); ctx.stroke(); });
  if (side === 0) {
    // rosette: eight petals around a boss, with a beaded collar
    both((ctx, col) => {
      ctx.strokeStyle = col; ctx.lineWidth = S * 0.02;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ctx.beginPath(); ctx.ellipse(C + Math.cos(a) * RR * 0.4, C + Math.sin(a) * RR * 0.4, RR * 0.27, RR * 0.115, a, 0, TAU); ctx.stroke();
      }
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(C, C, RR * 0.14, 0, TAU); ctx.fill();
      for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; ctx.beginPath(); ctx.arc(C + Math.cos(a) * RR * 0.7, C + Math.sin(a) * RR * 0.7, RR * 0.032, 0, TAU); ctx.fill(); }
    });
  } else {
    both((ctx, col) => {
      ctx.fillStyle = col; ctx.strokeStyle = col;
      for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; ctx.beginPath(); ctx.arc(C + Math.cos(a) * RR * 0.7, C + Math.sin(a) * RR * 0.7, RR * 0.04, 0, TAU); ctx.fill(); }
      ctx.lineWidth = S * 0.022; ctx.lineJoin = 'round'; ctx.beginPath();
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU - Math.PI / 2, rr = i % 2 ? RR * 0.22 : RR * 0.55; ctx.lineTo(C + Math.cos(a) * rr, C + Math.sin(a) * rr); }
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(C, C, RR * 0.1, 0, TAU); ctx.fill();
    });
  }
  // wear: fine scratches and dull patches, darker in the recesses
  for (let i = 0; i < 90; i++) {
    const px = C + (r() - 0.5) * RR * 1.8, py = C + (r() - 0.5) * RR * 1.8, l = 10 + r() * 50, a = r() * TAU;
    x.strokeStyle = r() < 0.5 ? 'rgba(255,240,220,0.16)' : 'rgba(30,14,4,0.18)'; x.lineWidth = 0.8 + r();
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
    bx.strokeStyle = 'rgba(0,0,0,0.25)'; bx.lineWidth = 0.8; bx.beginPath(); bx.moveTo(px, py); bx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); bx.stroke();
  }
  for (let i = 0; i < 2600; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.1)'; x.fillRect(r() * S, r() * S, 1 + r() * 2.5, 1 + r() * 2.5); }
  return { map: c, bump: b };
}
function edgeCanvases(side) {
  const c = cv(512, 32), x = c.getContext('2d'), b = cv(512, 32), bx = b.getContext('2d');
  const base = side === 0 ? '#8a4a1e' : '#8a95a1', hi = side === 0 ? '#d79a60' : '#e4eaf0';
  x.fillStyle = base; x.fillRect(0, 0, 512, 32); bx.fillStyle = '#808080'; bx.fillRect(0, 0, 512, 32);
  for (let i = 0; i < 96; i++) { const px = (i / 96) * 512; x.fillStyle = hi; x.fillRect(px, 0, 2.2, 32); bx.fillStyle = '#fff'; bx.fillRect(px, 0, 2.6, 32); bx.fillStyle = '#000'; bx.fillRect(px + 2.6, 0, 2.2, 32); }
  return { map: c, bump: b };
}
const coinMats = [];
export function coinMaterials(side) {
  if (coinMats[side]) return coinMats[side];
  const f = faceCanvases(side), e = edgeCanvases(side);
  const face = new THREE.MeshStandardMaterial({ map: tex(f.map), bumpMap: tex(f.bump, { srgb: false }), bumpScale: 1.6, metalness: side === 0 ? 0.88 : 0.92, roughness: side === 0 ? 0.36 : 0.3, envMapIntensity: 1.5 });
  const edge = new THREE.MeshStandardMaterial({ map: tex(e.map), bumpMap: tex(e.bump, { srgb: false }), bumpScale: 1.2, metalness: 0.9, roughness: 0.4, envMapIntensity: 1.3 });
  coinMats[side] = [edge, face, face];
  return coinMats[side];
}
let coinGeo = null;
export function makeCoin(side) {
  coinGeo = coinGeo || new THREE.CylinderGeometry(R, R, T, 56, 1);
  const m = new THREE.Mesh(coinGeo, coinMaterials(side));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
export const clearCoinMaterials = () => { coinMats.length = 0; };

// ---------------------------------------------------------------- the board
// bake: the existing 2D art (oak grain, chalk margins with slots, slate with numerals and brass lines), used as the colour map of the
// frame top and cropped for the slate. The geometry on top of it (raised slate, brass lines, binding) is real.
export function buildBoard(bake) {
  const g = new THREE.Group();
  const FW = WX1 - WX0, FD = WY1 - WY0, FX = (WX0 + WX1) / 2 - XC, FZ = (WY0 + WY1) / 2 - YC;
  // oak frame
  const frameGeo = B.slab(FW, FD, FH, 16, 4.5);
  const frameMat = new THREE.MeshPhysicalMaterial({ roughness: 0.52, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.35, envMapIntensity: 0.9 });
  if (bake) {
    const m = tex(bake, { flipY: false }), bm = tex(bake, { flipY: false, srgb: false });
    frameMat.map = m; frameMat.bumpMap = bm; frameMat.bumpScale = 1.4;
  } else frameMat.color.set('#6a3d1a');
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.position.set(FX, 0, FZ); frame.castShadow = true; frame.receiveShadow = true; g.add(frame);
  // slate: crop of the bake
  const SW = TW, SD = NEAR_Y - FAR_EDGE, SX = TW / 2 - XC, SZ = (FAR_EDGE + NEAR_Y) / 2 - YC;
  const slateMat = new THREE.MeshPhysicalMaterial({ roughness: 0.5, metalness: 0.05, clearcoat: 0.28, clearcoatRoughness: 0.3, envMapIntensity: 0.55, color: 0xffffff });
  if (bake) {
    const k = bake.width / FW, c = cv(Math.round(SW * k), Math.round(SD * k)), x = c.getContext('2d');
    x.drawImage(bake, (0 - WX0) * k, (FAR_EDGE - WY0) * k, SW * k, SD * k, 0, 0, c.width, c.height);
    // deeper, bluer polished slate: the baked grey is tinted and darkened (the lights add the sheen back)
    x.globalCompositeOperation = 'multiply'; x.fillStyle = '#7f93ad'; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'source-over';
    slateMat.map = tex(c, { flipY: false }); slateMat.bumpMap = tex(c, { flipY: false, srgb: false }); slateMat.bumpScale = 0.5;
  } else slateMat.color.set('#3a4651');
  const slate = new THREE.Mesh(B.slab(SW, SD, SH - FH + 1.2, 1.6, 1.0), slateMat);
  slate.position.set(SX, FH - 1.2, SZ); slate.castShadow = true; slate.receiveShadow = true; g.add(slate);
  // brass lines (inlaid, slightly proud), edge binding
  const brass = B.material('brass', { color: '#d9ae4a', color2: '#f3d27a', roughness: 0.24, envIntensity: 2.2 });
  const lineGeo = new THREE.BoxGeometry(SW, 0.9, LINE * 1.25);
  for (let j = 0; j <= BEDS; j++) {
    const m = new THREE.Mesh(lineGeo, brass); m.position.set(SX, SH + 0.25, wz(j * BED_H)); m.receiveShadow = true; g.add(m);
  }
  const bind = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, d), brass); m.position.set(x, SH - 0.2, z); m.castShadow = true; m.receiveShadow = true; g.add(m); };
  bind(SW + 3.6, 1.8, SX, wz(FAR_EDGE) - 0.9); bind(SW + 3.6, 1.8, SX, wz(NEAR_Y) + 0.9);
  bind(1.8, SD, SX - SW / 2 - 0.9, SZ); bind(1.8, SD, SX + SW / 2 + 0.9, SZ);
  // brass corner studs on the oak
  const stud = new THREE.CylinderGeometry(2.4, 2.4, 1.2, 14);
  for (const [sx, sz] of [[WX0 + 9, WY0 + 9], [WX1 - 9, WY0 + 9], [WX0 + 9, WY1 - 9], [WX1 - 9, WY1 - 9]]) {
    const m = new THREE.Mesh(stud, brass); m.position.set(wx(sx), FH + 0.4, wz(sz)); g.add(m);
  }
  return g;
}

// ---------------------------------------------------------------- props and room
const woodMat = (c0, c1, rep, seed, o = {}) => B.material('darkWood', { color: c0, color2: c1, repeat: rep, seed, ...o });

export function buildTable() {
  const g = new THREE.Group();
  // plank table: long boards running left-right, dark oak with beer rings
  const c = cv(1024), x = c.getContext('2d'), r = rng(12);
  const planks = 6, ph = 1024 / planks;
  for (let i = 0; i < planks; i++) {
    const k = 0.7 + r() * 0.5;
    const gr = x.createLinearGradient(0, i * ph, 0, (i + 1) * ph);
    gr.addColorStop(0, `rgb(${Math.round(70 * k)},${Math.round(40 * k)},${Math.round(20 * k)})`); gr.addColorStop(1, `rgb(${Math.round(50 * k)},${Math.round(28 * k)},${Math.round(13 * k)})`);
    x.fillStyle = gr; x.fillRect(0, i * ph, 1024, ph);
    for (let j = 0; j < 38; j++) { const y = i * ph + r() * ph; x.strokeStyle = r() < 0.6 ? 'rgba(20,8,2,0.35)' : 'rgba(255,200,140,0.10)'; x.lineWidth = 0.6 + r() * 1.6; x.beginPath(); x.moveTo(0, y); for (let s = 0; s <= 1024; s += 64) x.lineTo(s, y + Math.sin(s * 0.012 + j) * 3 + (r() - 0.5) * 2); x.stroke(); }
    x.fillStyle = 'rgba(0,0,0,0.65)'; x.fillRect(0, i * ph, 1024, 3);
  }
  for (let i = 0; i < 5; i++) { const px = r() * 1024, py = r() * 1024; x.strokeStyle = `rgba(20,8,0,${0.25 + r() * 0.25})`; x.lineWidth = 3 + r() * 4; x.beginPath(); x.arc(px, py, 40 + r() * 20, 0, TAU * 0.85); x.stroke(); }
  const map = tex(c, { repeat: [4, 4] });
  const bump = tex(c, { repeat: [4, 4], srgb: false });
  const mat = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.2, roughness: 0.5, metalness: 0, envMapIntensity: 0.7 });
  const table = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), mat);
  table.rotation.x = -Math.PI / 2; table.receiveShadow = true; g.add(table);
  return g;
}

export function buildWall() {
  const g = new THREE.Group();
  const WW = 2600, HH = 760, c = cv(2048, 600), x = c.getContext('2d'), r = rng(5);
  // upper wall: deep bottle-green flock paper; picture rail; lower: oak dado panelling
  const up = x.createLinearGradient(0, 0, 0, 380);
  up.addColorStop(0, '#0f1f17'); up.addColorStop(1, '#1d3a2a');
  x.fillStyle = up; x.fillRect(0, 0, 2048, 380);
  x.strokeStyle = 'rgba(190,160,70,0.10)'; x.lineWidth = 2;
  for (let yy = 20; yy < 380; yy += 60) for (let xx = (yy / 60 % 2) * 40; xx < 2048; xx += 80) { x.beginPath(); x.moveTo(xx, yy); x.quadraticCurveTo(xx + 14, yy + 16, xx, yy + 34); x.quadraticCurveTo(xx - 14, yy + 16, xx, yy); x.stroke(); }
  x.fillStyle = '#2a170a'; x.fillRect(0, 372, 2048, 16);
  x.fillStyle = 'rgba(255,200,120,0.25)'; x.fillRect(0, 372, 2048, 3);
  const pg = x.createLinearGradient(0, 388, 0, 600); pg.addColorStop(0, '#4a2a14'); pg.addColorStop(1, '#2b180a');
  x.fillStyle = pg; x.fillRect(0, 388, 2048, 212);
  for (let px = 20; px < 2048; px += 150) {
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(px, 408, 118, 170);
    x.strokeStyle = 'rgba(255,200,130,0.25)'; x.lineWidth = 3; x.strokeRect(px + 3, 411, 112, 164);
    for (let j = 0; j < 9; j++) { x.strokeStyle = `rgba(255,190,120,${0.04 + r() * 0.06})`; x.lineWidth = 1; const gx = px + 10 + r() * 98; x.beginPath(); x.moveTo(gx, 412); x.lineTo(gx + (r() - 0.5) * 6, 572); x.stroke(); }
  }
  const mat = new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.75, metalness: 0, envMapIntensity: 0.4 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(WW, HH * 0.78), mat);
  wall.position.set(0, HH * 0.78 / 2 - 4, 0); wall.receiveShadow = true; g.add(wall);
  // horse brasses on a leather strap
  const brass = B.material('brass', { color: '#c99a3a', color2: '#f3d27a', roughness: 0.28, envIntensity: 2.4 });
  const leather = new THREE.MeshStandardMaterial({ color: '#2a140a', roughness: 0.7 });
  const strapY = 292, sx0 = -520;
  const strap = new THREE.Mesh(new THREE.BoxGeometry(520, 11, 1.6), leather); strap.position.set(sx0 + 260, strapY, 4); g.add(strap);
  const defs = [['disc', 20], ['star', 21], ['ring', 20], ['moon', 21], ['disc', 20], ['star', 22]];
  defs.forEach(([kind, rad], i) => {
    const m = new THREE.Group(); m.position.set(sx0 + 40 + i * 88, strapY - 38 - (i % 2) * 6, 6);
    const loop = new THREE.Mesh(new THREE.TorusGeometry(5, 1.1, 8, 14), leather); loop.position.y = rad + 6; m.add(loop);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 2.6, 36), brass); body.rotation.x = Math.PI / 2; m.add(body);
    const rimR = new THREE.Mesh(new THREE.TorusGeometry(rad - 1, 1.5, 8, 36), brass); rimR.position.z = 1.4; m.add(rimR);
    if (kind === 'star') { const st = new THREE.Mesh(B.inlay(B.starPoints(8, rad * 0.78, rad * 0.35), 1.6), brass); st.rotation.x = Math.PI / 2; st.position.z = 1.8; m.add(st); }
    else if (kind === 'ring') { const t2 = new THREE.Mesh(new THREE.TorusGeometry(rad * 0.55, 1.4, 8, 28), brass); t2.position.z = 1.6; m.add(t2); const d = new THREE.Mesh(new THREE.SphereGeometry(rad * 0.22, 14, 10), brass); d.position.z = 2; m.add(d); }
    else if (kind === 'moon') { const t2 = new THREE.Mesh(new THREE.TorusGeometry(rad * 0.55, 2.6, 8, 24, Math.PI * 1.3), brass); t2.rotation.z = Math.PI * 0.35; t2.position.z = 1.6; m.add(t2); }
    else { const d = new THREE.Mesh(new THREE.SphereGeometry(rad * 0.4, 18, 12), brass); d.scale.z = 0.4; d.position.z = 1.8; m.add(d); }
    m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.add(m);
  });
  // dartboard
  const dc = cv(512), dx = dc.getContext('2d'), DC = 256;
  dx.fillStyle = '#10100e'; dx.beginPath(); dx.arc(DC, DC, 256, 0, TAU); dx.fill();
  for (let i = 0; i < 20; i++) {
    const a0 = (i / 20) * TAU - Math.PI / 2 - TAU / 40, a1 = a0 + TAU / 20, odd = i % 2;
    const ring = (r0, r1, col) => { dx.fillStyle = col; dx.beginPath(); dx.arc(DC, DC, r1, a0, a1); dx.arc(DC, DC, r0, a1, a0, true); dx.closePath(); dx.fill(); };
    ring(20, 190, odd ? '#efe3c0' : '#15150f'); ring(112, 124, odd ? '#2a8a45' : '#c4262b'); ring(180, 192, odd ? '#2a8a45' : '#c4262b');
  }
  dx.fillStyle = '#2a8a45'; dx.beginPath(); dx.arc(DC, DC, 24, 0, TAU); dx.fill(); dx.fillStyle = '#c4262b'; dx.beginPath(); dx.arc(DC, DC, 10, 0, TAU); dx.fill();
  dx.strokeStyle = 'rgba(200,200,200,0.55)'; dx.lineWidth = 1.2;
  for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU - Math.PI / 2 - TAU / 40; dx.beginPath(); dx.moveTo(DC + Math.cos(a) * 24, DC + Math.sin(a) * 24); dx.lineTo(DC + Math.cos(a) * 192, DC + Math.sin(a) * 192); dx.stroke(); }
  const dbMat = new THREE.MeshStandardMaterial({ map: tex(dc), roughness: 0.8 });
  const db = new THREE.Mesh(new THREE.CylinderGeometry(58, 58, 7, 40), [new THREE.MeshStandardMaterial({ color: '#241408', roughness: 0.7 }), dbMat, new THREE.MeshStandardMaterial({ color: '#241408' })]);
  db.rotation.x = Math.PI / 2; db.position.set(430, 270, 5); db.castShadow = true; g.add(db);
  const cab = new THREE.Mesh(B.slab(176, 176, 4, 10, 2), woodMat('#4a2a16', '#6b4126', [1, 1], 8)); cab.rotation.x = Math.PI / 2; cab.position.set(430, 270 + 88, 1.5); g.add(cab);
  return g;
}

// the pendant lamp: brass shade, glowing bulb; returns { group, light }
export function buildLamp() {
  const g = new THREE.Group();
  const brass = B.material('brass', { color: '#b88a2e', color2: '#e8c262', roughness: 0.3, envIntensity: 2 });
  const shade = new THREE.Mesh(B.lathe([[3, 0], [6, 2], [26, 6], [64, 26], [66, 28], [62, 29], [24, 9], [4, 4]], 40), brass);
  shade.material.side = THREE.DoubleSide; shade.castShadow = false; g.add(shade);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(60, 18, 22, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd9a0', side: THREE.BackSide, transparent: true, opacity: 0.9 }));
  inner.position.y = 15; g.add(inner);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(10, 18, 14), new THREE.MeshBasicMaterial({ color: '#fff4d0' }));
  bulb.position.y = 8; g.add(bulb);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 520, 6), new THREE.MeshStandardMaterial({ color: '#1a1008', roughness: 0.6 }));
  chain.position.y = 290; g.add(chain);
  // a soft glow sprite around the bulb (additive), so the lamp reads as a light source from the low hero camera
  const gc = cv(128), gx = gc.getContext('2d'), gg = gx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gg.addColorStop(0, 'rgba(255,225,160,0.95)'); gg.addColorStop(0.3, 'rgba(255,190,100,0.35)'); gg.addColorStop(1, 'rgba(255,170,80,0)');
  gx.fillStyle = gg; gx.fillRect(0, 0, 128, 128);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(gc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.scale.set(360, 360, 1); glow.position.y = 6; g.add(glow);
  return g;
}

// a pint of bitter: tulip glass, amber beer, cream head
export function buildPint() {
  const g = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: '#dff0f7', transparent: true, opacity: 0.22, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.2, depthWrite: false });
  const outer = [[0, 0], [14, 0], [15.5, 1.5], [15.8, 10], [18, 40], [21.5, 66], [22.5, 80], [21.2, 80], [20.4, 66], [17, 40], [14.8, 10], [0, 8]];
  const gl = new THREE.Mesh(B.lathe(outer, 40), glass); gl.material.side = THREE.DoubleSide; g.add(gl);
  const beerMat = new THREE.MeshPhysicalMaterial({ color: '#c46a12', emissive: '#7a3a06', emissiveIntensity: 0.55, roughness: 0.2, transmission: 0, clearcoat: 0.6 });
  const beer = new THREE.Mesh(B.lathe([[0, 9], [14.4, 9], [15.4, 12], [17.5, 40], [20.6, 66], [20.8, 70], [0, 70]], 40), beerMat); g.add(beer);
  const head = new THREE.Mesh(B.lathe([[0, 70], [20.8, 70], [21.3, 73], [20.6, 78.5], [14, 81.5], [0, 82.5]], 40), new THREE.MeshStandardMaterial({ color: '#f3e7c8', roughness: 0.85 }));
  g.add(head);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = o !== gl; } });
  return g;
}

export function buildSpares() {
  const g = new THREE.Group();
  // a little stack of spare pennies and a stick of chalk
  for (let i = 0; i < 5; i++) { const c = makeCoin(i % 2 ? 1 : 0); c.position.set(0, T / 2 + i * T * 1.02, 0); c.rotation.y = i * 0.7; g.add(c); }
  const chalk = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 38, 14), new THREE.MeshStandardMaterial({ color: '#f1efe6', roughness: 0.95 }));
  chalk.rotation.z = Math.PI / 2; chalk.rotation.y = 0.5; chalk.position.set(34, 3.2, 14); chalk.castShadow = true; g.add(chalk);
  const c2 = makeCoin(0); c2.position.set(-30, T / 2, 22); c2.rotation.y = 1.3; g.add(c2);
  return g;
}

export const CANVAS_HELP = { cv, rng };

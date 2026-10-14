// Sjoelen 3D models: the long beech sjoelbak with walnut rails, honey-wood arches under brass number plates, turned wooden discs,
// carved scoring beads, and the brown-cafe table around it (oak planks, Delft-blue cloth, tile wall, candle).
// Pure scene construction (no game state). World units: 1 sim unit = S = 0.05 (so a disc is 1.2 wide and 4.8 cm in the real world:
// 1 world unit = 4 cm). The playing surface is the plane y = 0; the board's long axis runs along z (arches at -z, player at +z).
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { TW, TL, D, BAR, NEAR, R, AW, PD, LANE_PITCH, START_Y } from '../src/sim.js';

export const S = 0.05;
export const ZC = (-D - BAR + TL + NEAR) / 2;                    // sim y at the board centre
export const WX = (x) => (x - TW / 2) * S;
export const WZ = (y) => (y - ZC) * S;
export const DISC_R = R * S, DISC_H = 0.3;
export const FLOOR_Y = -0.3;                                     // floor of the arch compartments
export const TABLE_Y = -0.62;
export const BOARD_HALF_X = (TW / 2 + 16) * S, BOARD_HALF_Z = (TL + NEAR + D + BAR) * S / 2;
const TAU = Math.PI * 2;
const rngOf = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const ctex = (c, o = {}) => { const t = new THREE.CanvasTexture(c); t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 8; if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); } return t; };
const std = (color, rough = 0.7, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
const cache = new Map();
const memo = (k, f) => { let v = cache.get(k); if (v === undefined) { v = f(); cache.set(k, v); } return v; };
export const clearModelCache = () => { for (const v of cache.values()) { if (v && v.dispose) v.dispose(); } cache.clear(); B.disposeMaterialCache(); };
const shadowed = (m, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; return m; };
const FONT = "'Dela Gothic One', 'Avenir Next', 'Trebuchet MS', system-ui, sans-serif";

export function softTex(rgb = '255,255,255', a = 1, size = 128) {
  return memo(`soft${rgb}${a}${size}`, () => {
    const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.45, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(0, 0, size, size); return ctex(c);
  });
}

// ---------------------------------------------------------------- materials
function woodTexture(c0, c1, seed, size = 512, o = {}) {
  return memo(`wood${c0}${c1}${seed}${size}`, () => {
    const w = B.woodCanvas(size, c0, c1, seed, o);
    return { map: ctex(w.map), bump: ctex(w.bump, { linear: true }) };
  });
}
export function woodMat(c0, c1, seed = 3, o = {}) {
  const t = woodTexture(c0, c1, seed, o.size || 512, o.grain);
  const m = new THREE.MeshPhysicalMaterial({ map: t.map, bumpMap: t.bump, bumpScale: o.bump ?? 0.5, roughness: o.rough ?? 0.5, metalness: 0, clearcoat: o.coat ?? 0.35, clearcoatRoughness: 0.28, envMapIntensity: 0.7 });
  if (o.repeat) { m.map = t.map.clone(); m.map.wrapS = m.map.wrapT = THREE.MirroredRepeatWrapping; m.map.repeat.set(o.repeat[0], o.repeat[1]); m.map.needsUpdate = true; m.bumpMap = t.bump.clone(); m.bumpMap.wrapS = m.bumpMap.wrapT = THREE.MirroredRepeatWrapping; m.bumpMap.repeat.set(o.repeat[0], o.repeat[1]); m.bumpMap.needsUpdate = true; }
  return m;
}
export const brassMat = () => memo('brass', () => new THREE.MeshStandardMaterial({ color: 0xd9b04a, roughness: 0.28, metalness: 1, envMapIntensity: 2.4 }));
const darkBrass = () => memo('brassD', () => new THREE.MeshStandardMaterial({ color: 0x9a7424, roughness: 0.4, metalness: 1, envMapIntensity: 1.6 }));

// ---------------------------------------------------------------- the playfield (beech, long grain, powder, start line, dark compartments)
function playfieldTexture() {
  return memo('pf', () => {
    const W = 640, H = 1792, c = cv(W, H), x = c.getContext('2d'), r = rngOf(77);
    const w = B.woodCanvas(1024, '#d3a566', '#eecb8e', 21, { lines: 300, knots: 2 });
    x.save(); x.translate(W / 2, H / 2); x.rotate(Math.PI / 2); x.drawImage(w.map, -H / 2, -W / 2, H, W); x.restore();
    // bands of lighter and darker boards (3 planks glued edge to edge)
    for (let i = 1; i < 4; i++) { x.fillStyle = 'rgba(90,50,14,0.16)'; x.fillRect(i * W / 4 - 1, 0, 2, H); x.fillStyle = 'rgba(255,248,225,0.2)'; x.fillRect(i * W / 4 + 1, 0, 1.5, H); }
    for (let i = 0; i < 4; i++) { x.fillStyle = `rgba(${i % 2 ? '170,110,48' : '255,245,214'},0.07)`; x.fillRect(i * W / 4, 0, W / 4, H); }
    // worn lane in the middle where discs slide: lighter, polished
    const wear = x.createLinearGradient(0, 0, W, 0); wear.addColorStop(0, 'rgba(255,255,255,0)'); wear.addColorStop(0.5, 'rgba(255,248,226,0.2)'); wear.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = wear; x.fillRect(0, 0, W, H);
    // the start line and the little tick marks
    const pxs = H / 500;                                              // texture px per sim unit (playfield is 500 long: -40..460)
    const ty = (y) => (y + D) * pxs;
    x.strokeStyle = 'rgba(110,60,18,0.45)'; x.lineWidth = 3; x.setLineDash([14, 12]); x.beginPath(); x.moveTo(8, ty(START_Y + R + 3)); x.lineTo(W - 8, ty(START_Y + R + 3)); x.stroke(); x.setLineDash([]);
    // fine sjoelen powder (talc): scattered pale specks and soft clouds, thicker near the player's end
    for (let i = 0; i < 2600; i++) { const px = r() * W, py = r() * H, a = 0.05 + r() * 0.18; x.fillStyle = `rgba(255,255,250,${a * (0.4 + py / H)})`; x.fillRect(px, py, 1 + r() * 1.6, 1 + r() * 1.6); }
    for (let i = 0; i < 26; i++) { const px = r() * W, py = H * (0.25 + r() * 0.75), rr = 20 + r() * 60, g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, 'rgba(255,255,248,0.12)'); g.addColorStop(1, 'rgba(255,255,248,0)'); x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
    // compartments: stained dark floors (y -40..0) between the posts
    for (let k = 0; k < 4; k++) {
      const x0 = k * LANE_PITCH * (W / TW), x1 = (k * LANE_PITCH + AW) * (W / TW), g = x.createLinearGradient(0, ty(-D), 0, ty(0));
      g.addColorStop(0, 'rgba(24,10,2,0.9)'); g.addColorStop(0.7, 'rgba(60,30,8,0.62)'); g.addColorStop(1, 'rgba(110,62,22,0.28)');
      x.fillStyle = g; x.fillRect(x0, ty(-D), x1 - x0, ty(0) - ty(-D));
    }
    // soft shade along the rails
    for (const [x0, dir] of [[0, 1], [W, -1]]) { const g = x.createLinearGradient(x0, 0, x0 + dir * 26, 0); g.addColorStop(0, 'rgba(50,22,4,0.5)'); g.addColorStop(1, 'rgba(50,22,4,0)'); x.fillStyle = g; x.fillRect(Math.min(x0, x0 + dir * 26), 0, 26, H); }
    const bc = cv(W, H), bx = bc.getContext('2d');
    bx.fillStyle = '#808080'; bx.fillRect(0, 0, W, H);
    bx.save(); bx.translate(W / 2, H / 2); bx.rotate(Math.PI / 2); bx.drawImage(w.bump, -H / 2, -W / 2, H, W); bx.restore();
    return { map: ctex(c), bump: ctex(bc, { linear: true }) };
  });
}

// ---------------------------------------------------------------- number plates (brass, carved numerals)
function plateTexture(n) {
  return memo(`plate${n}`, () => {
    const c = cv(256, 160), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 160); g.addColorStop(0, '#f6e3a0'); g.addColorStop(0.45, '#dcb556'); g.addColorStop(1, '#a98128');
    x.fillStyle = g; x.fillRect(0, 0, 256, 160);
    const r = rngOf(n * 31 + 5);
    for (let i = 0; i < 400; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(60,30,0,0.1)'; x.fillRect(r() * 256, r() * 160, 1 + r() * 30, 1); }
    x.strokeStyle = 'rgba(80,46,6,0.8)'; x.lineWidth = 5; x.strokeRect(10, 10, 236, 140);
    x.strokeStyle = 'rgba(255,244,200,0.6)'; x.lineWidth = 2; x.strokeRect(16, 16, 224, 128);
    x.font = `400 112px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(255,240,190,0.75)'; x.fillText(String(n), 128, 84);            // carved: light lip below-right, dark cut
    x.fillStyle = '#3a1f06'; x.fillText(String(n), 125, 79);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillText(String(n), 124, 78);
    const t = ctex(c); t.flipY = false; return t;
  });
}

// ---------------------------------------------------------------- discs
const SKINS = [
  { c0: '#f0d9a6', c1: '#f9ecc6', side: ['#e8cc92', '#f6e4b4'], dot: '#c9362a', ring: 'rgba(120,70,24,0.55)', seed: 11 },
  { c0: '#4a2a18', c1: '#6e4528', side: ['#3c2112', '#5a361e'], dot: '#e8bd48', ring: 'rgba(255,214,140,0.55)', seed: 12 },
];
function discTop(side) {
  return memo(`dtop${side}`, () => {
    const k = SKINS[side] || SKINS[0], N = 256, c = cv(N), x = c.getContext('2d');
    const w = B.woodCanvas(N, k.c0, k.c1, k.seed, { lines: 70, knots: 0 });
    x.save(); x.beginPath(); x.arc(N / 2, N / 2, N / 2, 0, TAU); x.clip(); x.drawImage(w.map, 0, 0, N, N); x.restore();
    // turned grooves (concentric) and the inlaid centre dot
    x.lineWidth = 2.4;
    for (const [rr, a] of [[0.88, 0.5], [0.66, 0.65], [0.44, 0.4]]) { x.strokeStyle = k.ring.replace(/[\d.]+\)$/, `${a})`); x.beginPath(); x.arc(N / 2, N / 2, rr * N / 2, 0, TAU); x.stroke(); }
    x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 1.2; x.beginPath(); x.arc(N / 2, N / 2, 0.66 * N / 2 + 3, 0, TAU); x.stroke();
    const g = x.createRadialGradient(N / 2 - 4, N / 2 - 4, 2, N / 2, N / 2, N * 0.12); g.addColorStop(0, '#fff'); g.addColorStop(0.2, k.dot); g.addColorStop(1, 'rgba(0,0,0,0.6)');
    x.fillStyle = g; x.beginPath(); x.arc(N / 2, N / 2, N * 0.115, 0, TAU); x.fill();
    return ctex(c);
  });
}
const discGeo = () => memo('discGeo', () => {
  const r = DISC_R, h = DISC_H;
  return B.lathe([[0, 0], [r * 0.9, 0], [r, 0.03], [r, h * 0.72], [r * 0.94, h * 0.95], [r * 0.86, h], [r * 0.85, h]], 44);
});
const discCapGeo = () => memo('discCap', () => { const g = new THREE.CircleGeometry(DISC_R * 0.85, 40); g.rotateX(-Math.PI / 2); g.translate(0, DISC_H + 0.0015, 0); return g; });
export const blobGeo = () => memo('blobGeo', () => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; });

/** One wooden disc: side 0 pale beech with a red inlay, side 1 dark walnut with a brass inlay. Origin on the table, top at DISC_H. */
export function makeDisc(side = 0) {
  const k = SKINS[side] || SKINS[0], g = new THREE.Group();
  const bodyMat = memo(`dbody${side}`, () => woodMat(k.side[0], k.side[1], k.seed + 20, { size: 256, bump: 0.6, coat: 0.5, rough: 0.42, repeat: [3, 1] }));
  const topMat = memo(`dtopm${side}`, () => new THREE.MeshPhysicalMaterial({ map: discTop(side), roughness: 0.38, clearcoat: 0.55, clearcoatRoughness: 0.25, envMapIntensity: 0.8 }));
  const body = shadowed(new THREE.Mesh(discGeo(), bodyMat));
  const cap = shadowed(new THREE.Mesh(discCapGeo(), topMat), false, true);
  g.add(body, cap);
  return g;
}

// ---------------------------------------------------------------- carved bead (scoring rack)
export function makeBead(side = 0) {
  return memo(`bead${side}`, () => {
    const prof = [[0, 0], [0.07, 0.005], [0.115, 0.05], [0.13, 0.12], [0.115, 0.19], [0.07, 0.235], [0, 0.24]].map(([r, y]) => [r, y - 0.12]);
    const geo = B.lathe(prof, 14); geo.rotateZ(Math.PI / 2); geo.scale(0.75, 1, 1);
    const mat = side === 0 ? std(0xf0dba8, 0.45, 0, { envMapIntensity: 0.8 }) : std(0x4c2c18, 0.4, 0, { envMapIntensity: 0.8 });
    return { geo, mat };
  });
}

// ---------------------------------------------------------------- board
export function buildBoard() {
  const g = new THREE.Group(), pf = playfieldTexture();
  const walnut = woodMat('#3c2312', '#5b361c', 5, { size: 512, bump: 0.7, coat: 0.5, rough: 0.46 });
  const railWood = woodMat('#3c2312', '#5b361c', 6, { size: 512, bump: 0.7, coat: 0.5, rough: 0.46, repeat: [6, 1] });
  const honey = woodMat('#c58a42', '#e0aa5e', 8, { size: 512, bump: 0.5, coat: 0.5 });
  const WXr = BOARD_HALF_X, ZL = BOARD_HALF_Z;
  const z0 = WZ(-D - BAR), z1 = WZ(TL + NEAR);                        // back, near
  // carcase under everything
  const body = shadowed(new THREE.Mesh(B.slab(WXr * 2, ZL * 2, 0.32, 0.34, 0.1), walnut)); body.position.set(0, FLOOR_Y - 0.32, 0); g.add(body);
  const under = shadowed(new THREE.Mesh(new THREE.BoxGeometry(TW * S, -FLOOR_Y, (TL + NEAR) * S), walnut)); under.position.set(0, FLOOR_Y / 2 - 0.006, WZ((TL + NEAR) / 2)); g.add(under);   // solid block under the playfield
  // playfield: beech, long grain (arch line y = 0 to the near end)
  const pw = TW * S, pz0 = WZ(0), pz1 = WZ(TL + NEAR - 8);
  const field = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshPhysicalMaterial({ map: pf.map, color: 0xe6d6bc, bumpMap: pf.bump, bumpScale: 0.5, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.3, envMapIntensity: 0.55 }));
  // texture covers y -40..460; use the part from 0..460 and the compartments separately
  const fg = new THREE.PlaneGeometry(pw, (TL + NEAR - 8) * S); fg.rotateX(-Math.PI / 2);
  { const uv = fg.attributes.uv, t0 = D / (TL + NEAR - 8 + D); for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (1 - t0)); }   // v: 0 = near end ... keep top part
  field.geometry = fg; field.position.set(0, 0, (pz0 + pz1) / 2); field.receiveShadow = true; g.add(field);
  // compartments floor (sunk)
  const cfg = new THREE.PlaneGeometry(pw, D * S); cfg.rotateX(-Math.PI / 2);
  { const uv = cfg.attributes.uv, t1 = D / (TL + NEAR - 8 + D); for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * t1 + (1 - t1)); }
  const floor = new THREE.Mesh(cfg, new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.8, map: pf.map })); floor.position.set(0, FLOOR_Y + 0.004, WZ(-D / 2)); floor.receiveShadow = true; g.add(floor);
  // rails (left/right) and near ledge, back board
  const railH = 0.62;
  for (const sgn of [-1, 1]) {
    const rail = shadowed(new THREE.Mesh(B.roundedBox(16 * S, railH + 0.36, (TL + NEAR + D) * S, 0.2, 4), railWood));
    rail.position.set(sgn * (TW / 2 + 8) * S, (railH - 0.36) / 2 - 0.0, WZ((TL + NEAR - D) / 2)); g.add(rail);
    const brass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, (TL + NEAR + D) * S * 0.998, 12), brassMat()); brass.rotation.x = Math.PI / 2; brass.position.set(sgn * (TW / 2 + 5.4) * S, railH - 0.2, rail.position.z); g.add(brass);
  }
  const near = shadowed(new THREE.Mesh(B.roundedBox((TW + 32) * S, 0.5, 8 * S + 0.1, 0.16, 4), walnut)); near.position.set(0, 0.2, WZ(TL + NEAR - 4)); g.add(near);
  const backH = 0.95;
  const back = shadowed(new THREE.Mesh(B.roundedBox((TW + 32) * S, backH + 0.36, BAR * S, 0.22, 4), walnut)); back.position.set(0, (backH - 0.36) / 2, WZ(-D - BAR / 2)); g.add(back);
  // a brass beading along the top of the back board and a lighter cap strip for the abacus rods
  const strip = shadowed(new THREE.Mesh(B.roundedBox(TW * S, 0.08, (BAR - 8) * S, 0.03, 3), honey)); strip.position.set(0, backH + 0.02, WZ(-D - BAR / 2)); g.add(strip);
  // the Delft-blue cloth runner the board stands on (turns with the board)
  const cloth = new THREE.Mesh(B.roundedBox(BOARD_HALF_X * 2 + 5.6, 0.07, BOARD_HALF_Z * 2 + 5.6, 0.03, 3),
    new THREE.MeshStandardMaterial({ map: clothTexture(), color: 0xc8c0b8, roughness: 0.95, envMapIntensity: 0.2 }));
  cloth.position.set(0, TABLE_Y + 0.035, 0); cloth.receiveShadow = true; g.add(cloth);
  // posts and arches
  for (let k = 0; k < 3; k++) {
    const x0 = (k + 1) * AW + k * PD, cx = WX(x0 + PD / 2), len = D * S;
    const post = shadowed(new THREE.Mesh(B.roundedBox(PD * S, 0.9, len, 0.09, 4), honey)); post.position.set(cx, FLOOR_Y + 0.45, WZ(-D / 2)); g.add(post);
    const cap = shadowed(new THREE.Mesh(new THREE.SphereGeometry(PD * S * 0.62, 18, 12), brassMat())); cap.scale.set(1, 0.7, 1); cap.position.set(cx, FLOOR_Y + 0.9, WZ(-1.0)); g.add(cap);
  }
  for (let k = 0; k < 4; k++) {
    const x0 = k * LANE_PITCH, ext0 = k === 0 ? 6 : 0, ext1 = k === 3 ? 6 : 0;
    const w = (AW + ext0 + ext1 + 6) * S, cx = WX(x0 + AW / 2 + (ext1 - ext0) / 2);
    const lintel = shadowed(new THREE.Mesh(B.roundedBox(w, 0.3, 0.62, 0.07, 4), honey)); lintel.position.set(cx, 0.52, WZ(-5.5)); g.add(lintel);
    // slanted brass number plate, leaning back toward the viewer
    const plate = new THREE.Mesh(B.slab(1.45, 0.82, 0.07, 0.07, 0.025), [brassMat()][0]);
    plate.material = new THREE.MeshStandardMaterial({ map: plateTexture([2, 3, 4, 1][k]), roughness: 0.3, metalness: 0.9, envMapIntensity: 1.9, emissive: 0x000000 });
    const pg = new THREE.Group(); pg.add(plate); pg.rotation.x = 0.5; pg.scale.setScalar(1.18); pg.name = `plate${k}`;
    plate.castShadow = true;
    const pivot = new THREE.Group(); pivot.name = `platepivot${k}`; pivot.position.set(WX(k * LANE_PITCH + AW / 2), 0.74, WZ(-4.2)); pivot.add(pg); g.add(pivot);
    // bolts
    for (const sx of [-0.6, 0.6]) { const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), darkBrass()); bolt.position.set(sx, 0.09, 0.0); pg.add(bolt); }
    // glow plane behind each compartment mouth (lit when a disc passes)
  }
  // scoring rack: a rod per arch with carved beads (sliding left to right as discs pass)
  const rods = [];
  for (let k = 0; k < 4; k++) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, AW * S - 0.1, 8), darkBrass()); rod.rotation.z = Math.PI / 2;
    rod.position.set(WX(k * LANE_PITCH + AW / 2), backH + 0.16, WZ(-D - BAR / 2)); g.add(rod); rods.push(rod);
    for (const sx of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), darkBrass()); post.position.set(rod.position.x + sx * (AW * S / 2 - 0.05), backH + 0.1, rod.position.z); g.add(post); }
  }
  g.userData.rodY = backH + 0.16; g.userData.rodZ = WZ(-D - BAR / 2);
  return g;
}

// ---------------------------------------------------------------- the cafe: oak table, Delft cloth, tile wall, candle
function tileTexture() {
  return memo('tiles', () => {
    const N = 6, T = 128, c = cv(N * T, 4 * T), x = c.getContext('2d'), r = rngOf(9);
    x.fillStyle = '#f2f0e6'; x.fillRect(0, 0, c.width, c.height);
    const blue = '#27499a', blueL = '#5d7fc9';
    const corner = (ox, oy, qx, qy) => { x.save(); x.translate(ox, oy); x.scale(qx, qy); x.strokeStyle = blue; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 22, 0, Math.PI / 2); x.stroke(); x.beginPath(); x.arc(0, 0, 12, 0, Math.PI / 2); x.stroke(); x.fillStyle = blue; x.beginPath(); x.moveTo(0, 0); x.lineTo(7, 0); x.lineTo(0, 7); x.fill(); x.restore(); };
    const motif = (cx, cy, kind) => {
      x.save(); x.translate(cx, cy); x.strokeStyle = blue; x.fillStyle = blue; x.lineWidth = 3.2; x.lineCap = 'round'; x.lineJoin = 'round';
      x.beginPath(); x.arc(0, 0, 46, 0, TAU); x.lineWidth = 2; x.stroke(); x.lineWidth = 3.2;
      if (kind === 0) { // windmill
        x.beginPath(); x.moveTo(-12, 30); x.lineTo(-7, -4); x.lineTo(7, -4); x.lineTo(12, 30); x.closePath(); x.fillStyle = blueL; x.fill(); x.stroke();
        for (let i = 0; i < 4; i++) { x.save(); x.translate(0, -8); x.rotate(i * Math.PI / 2 + 0.4); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -32); x.stroke(); x.strokeRect(2, -32, 9, 15); x.restore(); }
        x.fillStyle = blue; x.beginPath(); x.arc(0, -8, 4, 0, TAU); x.fill();
      } else if (kind === 1) { // tulip
        x.beginPath(); x.moveTo(0, 34); x.lineTo(0, -4); x.stroke();
        x.beginPath(); x.moveTo(-14, -10); x.quadraticCurveTo(-14, 10, 0, 10); x.quadraticCurveTo(14, 10, 14, -10); x.lineTo(7, -2); x.lineTo(0, -18); x.lineTo(-7, -2); x.closePath(); x.fillStyle = blueL; x.fill(); x.stroke();
        x.beginPath(); x.moveTo(0, 26); x.quadraticCurveTo(-18, 16, -22, 4); x.moveTo(0, 22); x.quadraticCurveTo(16, 14, 20, 2); x.stroke();
      } else if (kind === 2) { // ship
        x.beginPath(); x.moveTo(-26, 12); x.lineTo(26, 12); x.lineTo(16, 26); x.lineTo(-16, 26); x.closePath(); x.fillStyle = blue; x.fill();
        x.beginPath(); x.moveTo(0, 12); x.lineTo(0, -30); x.stroke();
        x.beginPath(); x.moveTo(3, -28); x.lineTo(24, 8); x.lineTo(3, 8); x.closePath(); x.fillStyle = blueL; x.fill(); x.stroke();
        x.beginPath(); x.moveTo(-3, -22); x.lineTo(-18, 8); x.lineTo(-3, 8); x.closePath(); x.fill(); x.stroke();
        x.beginPath(); x.moveTo(-30, 32); x.quadraticCurveTo(-15, 26, 0, 32); x.quadraticCurveTo(15, 38, 30, 32); x.stroke();
      } else if (kind === 3) { // bird on a branch
        x.beginPath(); x.ellipse(0, 4, 17, 11, -0.3, 0, TAU); x.fillStyle = blueL; x.fill(); x.stroke();
        x.beginPath(); x.arc(15, -8, 7, 0, TAU); x.fillStyle = blue; x.fill();
        x.beginPath(); x.moveTo(-14, 10); x.lineTo(-32, 22); x.lineTo(-20, 6); x.stroke();
        x.beginPath(); x.moveTo(-30, 28); x.lineTo(30, 20); x.stroke();
      } else { // flower
        for (let i = 0; i < 6; i++) { x.save(); x.rotate(i * TAU / 6); x.beginPath(); x.ellipse(0, -18, 8, 15, 0, 0, TAU); x.fillStyle = i % 2 ? blueL : blue; x.fill(); x.restore(); }
        x.fillStyle = '#f2f0e6'; x.beginPath(); x.arc(0, 0, 7, 0, TAU); x.fill(); x.stroke();
      }
      x.restore();
    };
    for (let j = 0; j < 4; j++) for (let i = 0; i < N; i++) {
      const ox = i * T, oy = j * T;
      motif(ox + T / 2, oy + T / 2, (i * 3 + j * 5 + Math.floor(r() * 2)) % 5);
      corner(ox, oy, 1, 1); corner(ox + T, oy, -1, 1); corner(ox, oy + T, 1, -1); corner(ox + T, oy + T, -1, -1);
      x.strokeStyle = 'rgba(40,40,60,0.28)'; x.lineWidth = 3; x.strokeRect(ox, oy, T, T);
    }
    return ctex(c, { repeat: [1, 1] });
  });
}
function clothTexture() {
  return memo('cloth', () => {
    const N = 512, c = cv(N), x = c.getContext('2d');
    x.fillStyle = '#f1ede0'; x.fillRect(0, 0, N, N);
    x.fillStyle = 'rgba(38,78,160,0.5)'; for (let i = 0; i < 8; i += 2) { x.fillRect(i * N / 8, 0, N / 8, N); }
    x.fillStyle = 'rgba(38,78,160,0.5)'; for (let j = 0; j < 8; j += 2) { x.fillRect(0, j * N / 8, N, N / 8); }
    for (let i = 0; i < N; i += 3) { x.fillStyle = 'rgba(255,255,255,0.1)'; x.fillRect(i, 0, 1, N); x.fillStyle = 'rgba(0,0,40,0.07)'; x.fillRect(0, i, N, 1); }
    return ctex(c, { repeat: [4, 7] });
  });
}
function flameTex() {
  return memo('flame', () => {
    const c = cv(64, 128), x = c.getContext('2d'), g = x.createRadialGradient(32, 84, 2, 32, 76, 40);
    g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.35, 'rgba(255,200,90,0.95)'); g.addColorStop(0.7, 'rgba(255,120,30,0.5)'); g.addColorStop(1, 'rgba(255,90,10,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(32, 6); x.quadraticCurveTo(58, 70, 32, 118); x.quadraticCurveTo(6, 70, 32, 6); x.fill(); return ctex(c);
  });
}

export function buildWorld({ fx = true } = {}) {
  const g = new THREE.Group(), upd = [];
  // oak table (planks run along x) and a woven Delft cloth runner under the board
  const oak = woodMat('#4c2c18', '#7a4c2a', 14, { size: 512, repeat: [4, 4], bump: 0.8, coat: 0.3, rough: 0.55 });
  const table = shadowed(new THREE.Mesh(new THREE.BoxGeometry(120, 0.5, 80), oak), false, true); table.position.set(0, TABLE_Y - 0.25, -4); g.add(table);
  // tile wall
  const tiles = tileTexture(); tiles.repeat.set(21, 3);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(140, 20), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.35, metalness: 0, envMapIntensity: 0.5 }));
  wall.position.set(0, 7, -34); g.add(wall);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(140, 3.2, 0.8), woodMat('#2c1a0e', '#4a2c18', 15, { size: 256, repeat: [18, 1] })); skirt.position.set(0, -1.5, -33.6); g.add(skirt);
  // brass candlestick with a flickering candle (lit scene dressing + a real warm light)
  const cs = new THREE.Group(); cs.position.set(BOARD_HALF_X + 3.4, TABLE_Y, -BOARD_HALF_Z * 0.3);
  const stick = shadowed(new THREE.Mesh(B.lathe([[0, 0], [0.7, 0], [0.74, 0.1], [0.4, 0.28], [0.18, 0.55], [0.3, 0.9], [0.14, 1.2], [0.2, 1.6], [0.5, 1.72], [0.46, 1.84], [0.1, 1.84]], 28), brassMat()), true, false);
  const candle = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 1.7, 16), std(0xf5ecd0, 0.6)), false, false); candle.position.y = 2.7;
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 4), std(0x201008)); wick.position.y = 3.6;
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); flame.scale.set(0.5, 1.0, 1); flame.position.y = 4.15;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex('255,190,100', 0.9, 128), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.8 })); halo.scale.setScalar(4.2); halo.position.y = 4.1;
  const light = new THREE.PointLight(0xffb060, 14, 16, 1.6); light.position.y = 4.2;
  cs.add(stick, candle, wick, flame, halo, light); g.add(cs);
  // pewter beer mug + a dish with extra discs, on the far side (only seen on wide screens)
  const mug = new THREE.Group(); mug.position.set(-BOARD_HALF_X - 3.6, TABLE_Y, -BOARD_HALF_Z * 0.15);
  const mugBody = shadowed(new THREE.Mesh(B.lathe([[0, 0], [0.95, 0], [1.0, 0.1], [1.05, 2.1], [1.0, 2.3], [0.92, 2.3], [0.9, 0.2], [0, 0.2]], 28), new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.32, metalness: 1, envMapIntensity: 1.8 })), true, false);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.11, 8, 16, Math.PI), mugBody.material); handle.rotation.z = -Math.PI / 2; handle.position.set(1.0, 1.2, 0);
  const foam = new THREE.Mesh(new THREE.SphereGeometry(0.88, 16, 10, 0, TAU, 0, Math.PI / 2), std(0xfff6dc, 0.9)); foam.scale.y = 0.4; foam.position.y = 2.3;
  mug.add(mugBody, handle, foam); g.add(mug);
  // pool of lamplight on the table (soft additive disc) and floating dust motes in the beam
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ map: softTex('255,200,120', 0.35, 256), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = TABLE_Y + 0.09; g.add(pool);
  let motes = null;
  if (fx) {
    const N = 60, pos = new Float32Array(N * 3), seed = [];
    for (let i = 0; i < N; i++) { seed.push([Math.random() * 20 - 10, Math.random() * 8 + 0.5, Math.random() * 30 - 15, Math.random() * TAU]); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    motes = new THREE.Points(geo, new THREE.PointsMaterial({ map: softTex('255,236,200', 0.9, 64), color: 0xffe2a8, size: 0.16, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false }));
    motes.frustumCulled = false; g.add(motes);
    upd.push((t) => { for (let i = 0; i < N; i++) { const s = seed[i]; pos[i * 3] = s[0] + Math.sin(t * 0.13 + s[3]) * 1.2; pos[i * 3 + 1] = s[1] + Math.sin(t * 0.21 + s[3] * 2) * 0.5; pos[i * 3 + 2] = s[2] + Math.cos(t * 0.1 + s[3]) * 1.0; } geo.attributes.position.needsUpdate = true; });
  }
  const flick = (t, calm) => {
    const f = calm ? 0 : Math.sin(t * 11.3) * 0.5 + Math.sin(t * 17.9 + 1.3) * 0.35 + Math.sin(t * 5.1) * 0.4;
    flame.scale.set(0.5 + f * 0.03, 1.0 + f * 0.1, 1); flame.position.x = f * 0.012; light.intensity = 14 + f * 1.6; halo.material.opacity = 0.78 + f * 0.05;
  };
  const setLayout = (rot) => {                       // props stand beside the board (portrait) or behind it (the board lies on its side)
    if (rot) { cs.position.set(BOARD_HALF_X * 1.5, TABLE_Y, -BOARD_HALF_X - 3.6); mug.position.set(-BOARD_HALF_X * 1.5, TABLE_Y, -BOARD_HALF_X - 3.4); }
    else { cs.position.set(BOARD_HALF_X + 3.4, TABLE_Y, -BOARD_HALF_Z * 0.3); mug.position.set(-BOARD_HALF_X - 3.6, TABLE_Y, -BOARD_HALF_Z * 0.15); }
  };
  return { group: g, warm: [light], setLayout, update(t, calm = false, vis = true) { flick(t, calm); if (vis && !calm) for (const u of upd) u(t); } };
}

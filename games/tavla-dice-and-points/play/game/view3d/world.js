// The 3D world of Tavla (procedural geometry + canvas-painted textures; no bitmaps shipped). Units are centimetres.
// A walnut tavla case: a raised frame and bar with a bone-and-turquoise mosaic band, two recessed playing fields with the
// stained veneer points (the same painting as the flat art, src/art.js), felt-lined bear-off trays at both ends and brass
// hinges and corner plates. It lies on a kilim on a coffeehouse table in afternoon window light, beside a copper cezve and a
// tulip glass of tea. CANONICAL board space (src/layout.js: 720 wide, the tall board) maps onto the table by wx()/wz().
import * as THREE from '../vendor3d/three.js';
import { slab, roundedBox, lathe, woodCanvas } from '../vendor3d/board3d.js';
import { LR, FRAME, IN, CH, TRAYC, pointGeom, SLOT, PLEN } from '../src/layout.js';
import { paintBoard } from '../src/art.js';
import { SETS } from '../src/sprites.js';

export const K = 0.05;                                   // cm per canonical unit: a checker (72 units) is 3.6 cm across
export const wx = (x) => (x - 360) * K, wz = (y) => (y - 782) * K;
export const cxOf = (X) => X / K + 360, cyOf = (Z) => Z / K + 782;
export const FH = 2.1, FY = 1.15, TY = 0.95;              // frame / bar top, field floor, tray floor
export const CR = 1.76, CT = 0.72;                        // checker radius and thickness
export const DIE = 1.55;                                  // die edge (cm); the doubling cube is 2.0
const TAU = Math.PI * 2;
const inR = (r, x, y, m = 0) => x >= r.x - m && x <= r.x + r.w + m && y >= r.y - m && y <= r.y + r.h + m;
// height of the surface a checker rests on at canonical (x, y)
export function baseAt(x, y) {
  if (x > CH.x0 - 6 && x < CH.x1 + 6 && y > IN.y0 - 4 && y < IN.y1 + 4) return FH;
  if (inR(TRAYC.me, x, y, 8) || inR(TRAYC.opp, x, y, 8)) return TY;
  if (y < IN.y0 - 6 || y > IN.y1 + 6 || x < IN.x0 - 6 || x > IN.x1 + 6) return FH;
  return FY;
}
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const cnv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export const tex = (c, srgb = true, rep = false) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

// ------------------------------------------------------------------ the board
// One painting of the whole board (the flat art's own paintBoard) is the colour of every top face: frame, bar and fields.
function boardTextures(scale) {
  const c = cnv(Math.round(LR.w * scale), Math.round(LR.h * scale)), x = c.getContext('2d');
  x.scale(scale, scale); x.translate(-LR.x, -LR.y); paintBoard(x);
  // relief: the veneer points stand a hair proud of the burl, the mosaic band and the bar stars are set in cuts
  const b = cnv(Math.round(LR.w * scale * 0.5), Math.round(LR.h * scale * 0.5)), y = b.getContext('2d');
  y.fillStyle = '#7a7a7a'; y.fillRect(0, 0, b.width, b.height); y.scale(scale * 0.5, scale * 0.5); y.translate(-LR.x, -LR.y);
  for (let i = 0; i < 24; i++) {
    const g = pointGeom(i), y0 = g.y - SLOT / 2 + 3, y1 = g.y + SLOT / 2 - 3, tx = g.edge + g.dir * PLEN;
    y.beginPath(); y.moveTo(g.edge, y0); y.lineTo(tx, g.y); y.lineTo(g.edge, y1); y.closePath(); y.fillStyle = '#9a9a9a'; y.fill(); y.strokeStyle = '#303030'; y.lineWidth = 2.2; y.stroke();
  }
  y.strokeStyle = '#3a3a3a'; y.lineWidth = 2.4; for (const ins of [11, 20, 4]) { y.beginPath(); y.roundRect(FRAME.x + ins, FRAME.y + ins, FRAME.w - 2 * ins, FRAME.h - 2 * ins, 10); y.stroke(); }
  return { map: tex(c), bump: tex(b, false) };
}
// canonical -> uv of the board painting
const uvOf = (xc, yc) => [(xc - LR.x) / LR.w, 1 - (yc - LR.y) / LR.h];

function rectPath(p, x, y, w, h, r = 0) {
  // a rectangle given in CANONICAL units, as a shape path in world (x, -z)
  const X0 = wx(x), X1 = wx(x + w), Z0 = -wz(y), Z1 = -wz(y + h);
  if (!r) { p.moveTo(X0, Z0); p.lineTo(X1, Z0); p.lineTo(X1, Z1); p.lineTo(X0, Z1); p.closePath(); return p; }
  const R = r * K;
  p.moveTo(X0 + R, Z0); p.lineTo(X1 - R, Z0); p.quadraticCurveTo(X1, Z0, X1, Z0 - R); p.lineTo(X1, Z1 + R); p.quadraticCurveTo(X1, Z1, X1 - R, Z1);
  p.lineTo(X0 + R, Z1); p.quadraticCurveTo(X0, Z1, X0, Z1 + R); p.lineTo(X0, Z0 - R); p.quadraticCurveTo(X0, Z0, X0 + R, Z0); p.closePath(); return p;
}
function extrudeWithHoles(outer, holes, h0, h1) {
  const sh = rectPath(new THREE.Shape(), ...outer);
  for (const hRect of holes) sh.holes.push(rectPath(new THREE.Path(), ...hRect));
  const geo = new THREE.ExtrudeGeometry(sh, { depth: h1 - h0 - 0.2, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.12, bevelSegments: 3, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, h0 + 0.1, 0);
  // top caps: uv from the board painting; sides keep the generator's world uv (wood grain)
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) if (n.getY(i) > 0.5) { const [u, v] = uvOf(cxOf(p.getX(i)), cyOf(p.getZ(i))); uv.setXY(i, u, v); } else uv.setXY(i, uv.getX(i) / 9, uv.getY(i) / 9);
  return geo;
}
export function buildBoard(texScale = 1.5) {
  const g = new THREE.Group();
  const T = boardTextures(texScale);
  const WC = woodCanvas(512, '#3e2114', '#6a3d22', 13, { lines: 160 });
  const side = new THREE.MeshPhysicalMaterial({ map: tex(WC.map, true, true), bumpMap: tex(WC.bump, false, true), bumpScale: 0.6, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  const top = new THREE.MeshPhysicalMaterial({ map: T.map, bumpMap: T.bump, bumpScale: 1.4, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.18 });
  const bottom = new THREE.MeshStandardMaterial({ color: 0x24120a, roughness: 0.8 });
  // the case: frame + bar, the two fields cut out
  const fieldL = [IN.x0, IN.y0, CH.x0 - IN.x0, IN.y1 - IN.y0], fieldR = [CH.x1, IN.y0, IN.x1 - CH.x1, IN.y1 - IN.y0];
  const caseGeo = extrudeWithHoles([FRAME.x, FRAME.y, FRAME.w, FRAME.h, 20], [fieldL, fieldR], 0, FH);
  const cs = new THREE.Mesh(caseGeo, [top, side]); cs.castShadow = true; cs.receiveShadow = true; g.add(cs);
  const floor = new THREE.Mesh(slab((FRAME.w - 30) * K, (FRAME.h - 30) * K, FY, 0.5, 0.02), bottom); floor.position.set(wx(360), 0, wz(FRAME.y + FRAME.h / 2)); floor.receiveShadow = true; g.add(floor);
  // the fields: the painted burl and veneer points
  for (const [x, y, w, h] of [fieldL, fieldR]) {
    const pg = new THREE.PlaneGeometry(w * K, h * K); pg.rotateX(-Math.PI / 2);
    const p = pg.attributes.position, uv = pg.attributes.uv;
    for (let i = 0; i < p.count; i++) { const [u, v] = uvOf(x + w / 2 + p.getX(i) / K, y + h / 2 + p.getZ(i) / K); uv.setXY(i, u, v); }
    const m = new THREE.Mesh(pg, top); m.position.set(wx(x + w / 2), FY + 0.005, wz(y + h / 2)); m.receiveShadow = true; g.add(m);
  }
  // the bear-off trays at both ends: a walnut rim and a burgundy felt bed
  const felt = new THREE.MeshStandardMaterial({ map: feltTex(), roughness: 1, color: 0xffffff });
  for (const R of [TRAYC.opp, TRAYC.me]) {
    const tg = extrudeWithHoles([R.x - 8, R.y - 8, R.w + 16, R.h + 16, 10], [[R.x, R.y, R.w, R.h]], 0, FH * 0.86);
    const tm = new THREE.Mesh(tg, [side, side]); tm.castShadow = true; tm.receiveShadow = true; g.add(tm);
    const bed = new THREE.Mesh(slab(R.w * K, R.h * K, TY, 0.3, 0.02), felt); bed.position.set(wx(R.x + R.w / 2), 0, wz(R.y + R.h / 2)); bed.receiveShadow = true; g.add(bed);
  }
  // brass: two hinges across the bar ends and four corner plates
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xd9a84a, metalness: 1, roughness: 0.28, clearcoat: 0.3 });
  for (const y of [FRAME.y + 2, FRAME.y + FRAME.h - 2]) {
    const hg = new THREE.Mesh(slab(88 * K, 1.0, 0.18, 0.2, 0.06), brass); hg.position.set(0, FH + 0.02, wz(y) + (y < 700 ? 0.45 : -0.45)); hg.castShadow = true; g.add(hg);
    const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 30 * K, 16), brass); kn.rotation.z = Math.PI / 2; kn.position.set(0, FH + 0.05, wz(y) + (y < 700 ? -0.12 : 0.12)); g.add(kn);
    for (const sx of [-1, 1]) { const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0x6b4a14, metalness: 1, roughness: 0.4 })); sc.position.set(sx * 32 * K, FH + 0.22, hg.position.z); g.add(sc); }
  }
  const cornerShape = new THREE.Shape(); cornerShape.moveTo(0, 0); cornerShape.lineTo(1.6, 0); cornerShape.quadraticCurveTo(0.6, -0.5, 0, -1.6); cornerShape.closePath();
  const cg = new THREE.ExtrudeGeometry(cornerShape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }); cg.rotateX(-Math.PI / 2);
  for (const [x, y, sx, sz] of [[FRAME.x, FRAME.y, 1, 1], [FRAME.x + FRAME.w, FRAME.y, -1, 1], [FRAME.x, FRAME.y + FRAME.h, 1, -1], [FRAME.x + FRAME.w, FRAME.y + FRAME.h, -1, -1]]) {
    const m = new THREE.Mesh(cg, brass); m.scale.set(sx, 1, sz); m.position.set(wx(x) + sx * 0.12, FH + 0.04, wz(y) + sz * 0.12); m.castShadow = true; g.add(m);
  }
  g.userData.dispose = () => { caseGeo.dispose(); T.map.dispose(); T.bump.dispose(); };
  return g;
}
function feltTex() {
  const c = cnv(256), x = c.getContext('2d'), r = lcg(41);
  x.fillStyle = '#5a1820'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,190,170,0.05)' : 'rgba(0,0,0,0.12)'; x.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1); }
  return tex(c, true, true);
}

// ------------------------------------------------------------------ checkers: turned boxwood / rosewood with a carved rosette
function capTex(p, S = 256) {
  const c = cnv(S), x = c.getContext('2d'), m = S / 2, r = S / 2, rnd = lcg(p.mid.length * 31 + p.inlay.charCodeAt(2));
  const g = x.createRadialGradient(m * 0.8, m * 0.75, 4, m, m, r); g.addColorStop(0, p.hi); g.addColorStop(0.65, p.mid); g.addColorStop(1, p.lo);
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let k = 0; k < 70; k++) { x.strokeStyle = `rgba(${rnd() < 0.5 ? '255,235,200' : '40,20,8'},${0.04 + rnd() * 0.06})`; x.lineWidth = 0.6 + rnd() * 1.2; x.beginPath(); const yy = rnd() * S; x.moveTo(0, yy); x.bezierCurveTo(S * 0.3, yy + (rnd() - 0.5) * 20, S * 0.7, yy + (rnd() - 0.5) * 20, S, yy + (rnd() - 0.5) * 10); x.stroke(); }
  x.strokeStyle = p.groove; x.lineWidth = S * 0.012; for (const k of [0.8, 0.64]) { x.beginPath(); x.arc(m, m, r * k, 0, TAU); x.stroke(); }
  x.save(); x.translate(m, m); x.fillStyle = p.inlay;
  for (let i = 0; i < 8; i++) { x.save(); x.rotate(i * TAU / 8); x.beginPath(); x.ellipse(0, -r * 0.3, r * 0.1, r * 0.17, 0, 0, TAU); x.fill(); x.restore(); }
  x.beginPath(); x.arc(0, 0, r * 0.1, 0, TAU); x.fill(); x.restore();
  return tex(c);
}
function capBump(S = 256) {
  const c = cnv(S), x = c.getContext('2d'), m = S / 2, r = S / 2;
  x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, S, S);
  x.strokeStyle = '#262626'; x.lineWidth = S * 0.018; for (const k of [0.8, 0.64]) { x.beginPath(); x.arc(m, m, r * k, 0, TAU); x.stroke(); }
  x.save(); x.translate(m, m); x.fillStyle = '#3a3a3a';
  for (let i = 0; i < 8; i++) { x.save(); x.rotate(i * TAU / 8); x.beginPath(); x.ellipse(0, -r * 0.3, r * 0.1, r * 0.17, 0, 0, TAU); x.fill(); x.restore(); }
  x.beginPath(); x.arc(0, 0, r * 0.1, 0, TAU); x.fill(); x.restore();
  return tex(c, false);
}
export function checkerKit() {
  // a turned checker: flat bottom, straight side with a lathe line, rounded top edge, a raised lip around the face
  const R = CR, H = CT;
  const prof = [[0, 0], [R * 0.93, 0], [R * 0.99, 0.05], [R, 0.14], [R, H * 0.42], [R * 0.985, H * 0.47], [R, H * 0.52], [R, H * 0.8], [R * 0.97, H * 0.94], [R * 0.9, H], [R * 0.86, H], [R * 0.84, H * 0.95]];
  const body = lathe(prof, 48);
  const cap = new THREE.CircleGeometry(R * 0.845, 48); cap.rotateX(-Math.PI / 2); cap.translate(0, H * 0.95, 0);
  const bump = capBump();
  const mats = {};
  for (const set of Object.keys(SETS)) mats[set] = SETS[set].map((p, s) => {
    const W = woodCanvas(256, p.lo, p.mid, 17 + s, { lines: 60 });
    return {
      body: new THREE.MeshPhysicalMaterial({ map: tex(W.map, true, true), roughness: s ? 0.3 : 0.38, clearcoat: s ? 0.9 : 0.6, clearcoatRoughness: 0.18, sheen: set === 'pearl' && !s ? 0.6 : 0, iridescence: set === 'pearl' && !s ? 0.35 : 0 }),
      top: new THREE.MeshPhysicalMaterial({ map: capTex(p), bumpMap: bump, bumpScale: 1.5, roughness: s ? 0.28 : 0.36, clearcoat: s ? 0.9 : 0.6, clearcoatRoughness: 0.16, iridescence: set === 'pearl' && !s ? 0.35 : 0 }),
    };
  });
  const make = () => { const g = new THREE.Group(), b = new THREE.Mesh(body), t = new THREE.Mesh(cap); b.castShadow = true; b.receiveShadow = true; t.receiveShadow = true; g.add(b, t); return g; };
  return { make, mats };
}

// ------------------------------------------------------------------ dice: rounded cubes with drilled pips; the doubling cube
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
// BoxGeometry groups: +x, -x, +y, -y, +z, -z. Opposite faces add to 7.
export const FACE_VAL = [3, 4, 1, 6, 2, 5];
const FACE_N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function faceTex(v, ivory, S = 256) {
  const c = cnv(S), x = c.getContext('2d'), b = cnv(S), y = b.getContext('2d');
  x.fillStyle = ivory ? '#ece0c2' : '#9c1f26'; x.fillRect(0, 0, S, S);
  const r = lcg(v * 7 + (ivory ? 1 : 2)); for (let i = 0; i < 1400; i++) { x.fillStyle = ivory ? `rgba(150,110,60,${r() * 0.05})` : `rgba(0,0,0,${r() * 0.08})`; x.fillRect(r() * S, r() * S, 2, 2); }
  y.fillStyle = '#a0a0a0'; y.fillRect(0, 0, S, S);
  const pr = (v === 1 ? 0.13 : 0.085) * S, sp = 0.25 * S;
  for (const [px, py] of PIPS[v]) {
    const X = S / 2 + px * sp, Y = S / 2 + py * sp;
    const g = x.createRadialGradient(X - pr * 0.25, Y - pr * 0.25, 1, X, Y, pr); const col = v === 1 ? '#b0141c' : ivory ? '#1d120b' : '#f4e7c6';
    g.addColorStop(0, v === 1 ? '#5a0508' : ivory ? '#000' : '#c9b78f'); g.addColorStop(1, col); x.fillStyle = g; x.beginPath(); x.arc(X, Y, pr, 0, TAU); x.fill();
    y.fillStyle = '#101010'; y.beginPath(); y.arc(X, Y, pr, 0, TAU); y.fill();
  }
  return { map: tex(c), bump: tex(b, false) };
}
function cubeTex(n, S = 256) {
  const c = cnv(S), x = c.getContext('2d');
  x.fillStyle = '#efe4c8'; x.fillRect(0, 0, S, S);
  x.strokeStyle = '#a07a2a'; x.lineWidth = S * 0.03; x.strokeRect(S * 0.1, S * 0.1, S * 0.8, S * 0.8);
  x.fillStyle = '#6b1219'; x.font = `700 ${n >= 10 ? S * 0.42 : S * 0.55}px "Cormorant Garamond", Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), S / 2, S * 0.54);
  return tex(c);
}
export function diceKit() {
  const geo = roundedBox(DIE, DIE, DIE, DIE * 0.13, 8);
  const sets = [true, false].map((ivory) => FACE_VAL.map((v) => { const T = faceTex(v, ivory); return new THREE.MeshPhysicalMaterial({ map: T.map, bumpMap: T.bump, bumpScale: 2, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.12 }); }));
  const make = (ivory = true) => { const m = new THREE.Mesh(geo, sets[ivory ? 0 : 1]); m.castShadow = true; m.receiveShadow = true; return m; };
  const CUBE = [2, 4, 8, 16, 32, 64], cubeGeo = roundedBox(2.0, 2.0, 2.0, 0.2, 8);
  const cubeMats = CUBE.map((n) => new THREE.MeshPhysicalMaterial({ map: cubeTex(n), roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.15 }));
  const makeCube = () => { const m = new THREE.Mesh(cubeGeo, cubeMats); m.castShadow = true; m.receiveShadow = true; return m; };
  const up = new THREE.Vector3(0, 1, 0);
  // the orientation that shows face value v on top, turned yaw about the vertical
  const restQ = (v, yaw = 0, faces = FACE_VAL) => {
    const k = faces.indexOf(v), n = new THREE.Vector3(...FACE_N[Math.max(0, k)]);
    return new THREE.Quaternion().setFromAxisAngle(up, yaw).multiply(new THREE.Quaternion().setFromUnitVectors(n, up));
  };
  return { make, makeCube, restQ, CUBE };
}

// ------------------------------------------------------------------ the coffeehouse: table, kilim, cezve, tea glass, tiled wall
function kilimTex() {
  const W = 512, H = 1024, c = cnv(W, H), x = c.getContext('2d'), r = lcg(23);
  x.fillStyle = '#5e2018'; x.fillRect(0, 0, W, H);
  const band = (y0, h, col) => { x.fillStyle = col; x.fillRect(0, y0, W, h); };
  // borders: indigo, ochre, ivory lines; a field of stepped medallions
  x.fillStyle = '#1f2b55'; x.fillRect(0, 0, 46, H); x.fillRect(W - 46, 0, 46, H);
  x.fillStyle = '#a9843a'; x.fillRect(46, 0, 8, H); x.fillRect(W - 54, 0, 8, H);
  for (let y = 0; y < H; y += 28) { x.fillStyle = (y / 28) % 2 ? '#cbbd9e' : '#a9843a'; x.beginPath(); x.moveTo(23, y); x.lineTo(37, y + 14); x.lineTo(23, y + 28); x.lineTo(9, y + 14); x.fill(); x.beginPath(); x.moveTo(W - 23, y); x.lineTo(W - 9, y + 14); x.lineTo(W - 23, y + 28); x.lineTo(W - 37, y + 14); x.fill(); }
  for (let k = 0; k < 4; k++) {
    const cy = 128 + k * 256, cx = W / 2;
    for (let s = 5; s >= 1; s--) { x.fillStyle = ['#cbbd9e', '#1c2546', '#a9843a', '#28564b', '#5e2018', '#cbbd9e'][s]; x.beginPath(); x.moveTo(cx, cy - s * 22); x.lineTo(cx + s * 30, cy); x.lineTo(cx, cy + s * 22); x.lineTo(cx - s * 30, cy); x.closePath(); x.fill(); }
    x.fillStyle = '#1f2b55'; for (const sx of [-1, 1]) { x.fillRect(cx + sx * 150 - 10, cy - 60, 20, 120); }
  }
  band(0, 3, '#efe2c4');
  for (let i = 0; i < 26000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,230,200,0.05)' : 'rgba(0,0,0,0.1)'; x.fillRect(r() * W, r() * H, 1, 2 + r() * 2); }      // the weave
  return tex(c);
}
function tilesTex() {
  const S = 512, c = cnv(S), x = c.getContext('2d');
  x.fillStyle = '#e9e4d8'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const cx = i * 128 + 64, cy = j * 128 + 64;
    x.strokeStyle = 'rgba(120,110,90,0.5)'; x.lineWidth = 3; x.strokeRect(i * 128, j * 128, 128, 128);
    x.fillStyle = '#1d4f8f'; for (let p = 0; p < 4; p++) { x.save(); x.translate(cx, cy); x.rotate(p * Math.PI / 2 + Math.PI / 4); x.beginPath(); x.ellipse(0, -30, 13, 30, 0, 0, TAU); x.fill(); x.restore(); }
    x.fillStyle = '#2f8a8a'; for (let p = 0; p < 4; p++) { x.save(); x.translate(cx, cy); x.rotate(p * Math.PI / 2); x.beginPath(); x.ellipse(0, -36, 7, 18, 0, 0, TAU); x.fill(); x.restore(); }
    x.fillStyle = '#b8352a'; x.beginPath(); x.arc(cx, cy, 10, 0, TAU); x.fill();
    x.fillStyle = '#1d4f8f'; for (const [a, b] of [[0, 0], [128, 0], [0, 128], [128, 128]]) { x.beginPath(); x.arc(i * 128 + a, j * 128 + b, 14, 0, TAU); x.fill(); }
  }
  return tex(c, true, true);
}
export function buildRoom(scene) {
  const g = new THREE.Group(); scene.add(g);
  const WC = woodCanvas(1024, '#3a1e0f', '#5a3219', 29, { lines: 200, knots: 2 });
  const wt = tex(WC.map, true, true), wb = tex(WC.bump, false, true); wt.repeat.set(2.5, 2.5); wb.repeat.set(2.5, 2.5);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), new THREE.MeshPhysicalMaterial({ map: wt, bumpMap: wb, bumpScale: 0.7, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4 }));
  table.rotation.x = -Math.PI / 2; table.position.y = -0.4; table.receiveShadow = true; g.add(table);
  const kil = new THREE.Mesh(new THREE.PlaneGeometry(56, 92), new THREE.MeshStandardMaterial({ map: kilimTex(), roughness: 0.95 }));
  kil.rotation.x = -Math.PI / 2; kil.rotation.z = -0.03; kil.position.set(0.5, -0.36, 0); kil.receiveShadow = true; g.add(kil);
  const tt = tilesTex(); tt.repeat.set(10, 4);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(500, 200), new THREE.MeshStandardMaterial({ map: tt, roughness: 0.4, emissive: 0xffffff, emissiveMap: tt, emissiveIntensity: 0.12, fog: false }));
  wall.position.set(0, 60, -150); g.add(wall);
  // copper cezve with a long brass handle
  const copper = new THREE.MeshPhysicalMaterial({ color: 0xc8683a, metalness: 1, roughness: 0.3, clearcoat: 0.2 });
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xd9a84a, metalness: 1, roughness: 0.3 });
  const cz = new THREE.Group();
  const czp = [[0, 0], [3.4, 0], [3.9, 0.6], [3.8, 3.2], [2.7, 6.2], [2.5, 7.0], [3.1, 7.6], [3.0, 7.7], [2.4, 7.1], [0, 7.1]];
  const pot = new THREE.Mesh(lathe(czp, 40), copper); pot.castShadow = true; pot.receiveShadow = true; cz.add(pot);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(2.45, 32), new THREE.MeshPhysicalMaterial({ color: 0x2a1408, roughness: 0.25, clearcoat: 1 })); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 6.6; cz.add(coffee);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 13, 12), brass); handle.rotation.z = Math.PI / 2 - 0.35; handle.position.set(9, 6.6, 0); handle.castShadow = true; cz.add(handle);
  cz.position.set(-30, -0.36, -30); cz.rotation.y = 0.5; g.add(cz);
  // tulip tea glass on a red-rimmed saucer, with a spoon; two sugar cubes
  const tea = new THREE.Group();
  const sau = new THREE.Mesh(lathe([[0, 0], [3.6, 0.05], [4.6, 0.5], [4.7, 0.62], [3.4, 0.25], [0, 0.25]], 40), new THREE.MeshPhysicalMaterial({ color: 0xf6f2ea, roughness: 0.18, clearcoat: 1 })); sau.receiveShadow = true; sau.castShadow = true; tea.add(sau);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(4.62, 0.09, 8, 48), new THREE.MeshStandardMaterial({ color: 0xb01e24, roughness: 0.4 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.6; tea.add(rim);
  const glp = [[0, 0.3], [1.9, 0.3], [2.1, 0.6], [2.6, 2.6], [1.85, 4.6], [2.0, 6.2], [2.45, 8.2], [2.35, 8.2], [1.9, 6.2], [1.75, 4.6], [2.5, 2.6], [2.0, 0.7], [0, 0.7]];
  const glass = new THREE.Mesh(lathe(glp, 48), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transmission: 0.95, thickness: 0.2, ior: 1.45, transparent: true, opacity: 0.35, clearcoat: 1 }));
  glass.renderOrder = 4; tea.add(glass);
  const liq = new THREE.Mesh(lathe([[0, 0.72], [1.95, 0.72], [2.45, 2.6], [1.78, 4.6], [1.9, 6.0], [0, 6.0]], 40), new THREE.MeshPhysicalMaterial({ color: 0x9b2e0c, roughness: 0.1, transmission: 0.35, thickness: 2, transparent: true, opacity: 0.88, emissive: 0x3a0c02, emissiveIntensity: 0.4 }));
  liq.renderOrder = 3; tea.add(liq);
  tea.position.set(31, -0.36, -24); g.add(tea);
  const sug = new THREE.MeshStandardMaterial({ color: 0xfbf8f0, roughness: 0.9 });
  for (const [x, z, r] of [[25, -17, 0.3], [26.6, -16.2, 1.1]]) { const s = new THREE.Mesh(roundedBox(1.3, 1.1, 1.3, 0.12, 2), sug); s.position.set(x, 0.2, z); s.rotation.y = r; s.castShadow = true; g.add(s); }
  return { group: g, tea, cezve: cz, glass };
}
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xfff0dc, 0x2a1a10, 0.5); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe2b8, 2.5);             // afternoon sun through the coffeehouse window (upper left)
  key.position.set(-40, 70, -26); key.castShadow = true;
  const sc = key.shadow.camera; sc.left = -50; sc.right = 50; sc.top = 50; sc.bottom = -50; sc.near = 10; sc.far = 220;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 3; key.shadow.mapSize.set(2048, 2048);
  scene.add(key); scene.add(key.target);
  const rim = new THREE.DirectionalLight(0xa8c4ff, 0.55); rim.position.set(40, 26, -50); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffe8d0, 0.35); fill.position.set(20, 40, 60); scene.add(fill);
  return { hemi, key, rim, fill };
}
export function radialTex(rgb, a = 1, S = 64) {
  const c = cnv(S), x = c.getContext('2d'), g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, S, S); return tex(c);
}
export function ringTex(S = 128) {
  const c = cnv(S), x = c.getContext('2d'), g = x.createRadialGradient(S / 2, S / 2, S * 0.23, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.6, 'rgba(255,255,255,0.15)'); g.addColorStop(0.78, 'rgba(255,255,255,1)'); g.addColorStop(0.9, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S); return tex(c);
}
// a glowing point triangle (the legal destinations): base along x = 0, apex at x = 1, unit half-height at the base
export function pointGlowGeo() {
  const sh = new THREE.Shape(); sh.moveTo(0, -1); sh.lineTo(1, 0); sh.lineTo(0, 1); sh.closePath();
  const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); return g;
}
export function triGlowTex(S = 256) {
  const c = cnv(S), x = c.getContext('2d');
  x.fillStyle = 'rgba(255,255,255,0.32)'; x.fillRect(0, 0, S, S);
  const g = x.createLinearGradient(0, 0, S, 0); g.addColorStop(0, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S);
  return tex(c);
}

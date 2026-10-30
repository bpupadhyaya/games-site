// The 3D world of Tavli (procedural geometry + canvas-painted textures; no bitmaps shipped). Units are centimetres.
// An olive-ash tavli case with a cobalt-and-cream lacquered field, a blue lacquered bar, terracotta felt bear-off trays and bronze
// corner pieces, with marble and wenge checkers and cobalt / cream enamel dice. It lies on a blue-and-white checked cloth on a marble
// kafeneio table, in island light from a shuttered window, beside an ouzo, a water glass, a coffee, worry beads and olives.
// BOARD space (src/layout.js: 720 wide, the tall board) maps onto the table by wx()/wz().
import * as THREE from '../vendor3d/three.js';
import { slab, roundedBox, lathe, woodCanvas } from '../vendor3d/board3d.js';
import { FRAME, IN, CH, TRAY, pointGeom, SLOT, PLEN } from '../src/layout.js';
import { meander } from '../src/art.js';
import { SETS } from '../src/sprites.js';

export const K = 0.05;                                   // cm per board unit: a checker (72 units) is 3.6 cm across
export const wx = (x) => (x - 360) * K, wz = (y) => (y - 782) * K;
export const cxOf = (X) => X / K + 360, cyOf = (Z) => Z / K + 782;
export const LR = { x: 8, y: 206, w: 704, h: 1152 };    // the whole case in board space
export const FH = 2.0, FY = 1.1, TY = 0.9;               // rim / bar top, field floor, tray floor
export const CR = 1.76, CT = 0.8;                        // checker radius, thickness
export const DIE = 1.6;
const TAU = Math.PI * 2;
export const PLANE_Y = FY + CT * 0.5;                    // the plane taps and labels are projected on
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const cnv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export const tex = (c, srgb = true, rep = false) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const inR = (r, x, y, m = 0) => x >= r.x - m && x <= r.x + r.w + m && y >= r.y - m && y <= r.y + r.h + m;
export function baseAt(x, y) {
  if (x > CH.x0 - 6 && x < CH.x1 + 6 && y > IN.y0 - 4 && y < IN.y1 + 4) return FH;
  if (inR(TRAY.me, x, y, 8) || inR(TRAY.opp, x, y, 8)) return TY;
  if (y < IN.y0 - 6 || y > IN.y1 + 6 || x < IN.x0 - 6 || x > IN.x1 + 6) return FH;
  return FY;
}
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); };
function grain(c, x, y, w, h, seed, n, a, dark = '40,22,6', light = '255,235,190') {
  const r = lcg(seed); c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  for (let i = 0; i < n; i++) { const px = x + r() * w, len = h * (0.4 + r()), py = y + (r() - 0.2) * h, wob = (r() - 0.5) * 8; c.strokeStyle = `rgba(${r() < 0.6 ? dark : light},${(a * (0.4 + r())).toFixed(3)})`; c.lineWidth = 0.6 + r() * 1.6; c.beginPath(); c.moveTo(px, py); c.bezierCurveTo(px + wob, py + len * 0.3, px - wob, py + len * 0.7, px + wob * 0.4, py + len); c.stroke(); }
  c.restore();
}

// ------------------------------------------------------------------ the board painting (colour of every top face)
function paintTop(c) {
  const lin = (x0, y0, x1, y1, st) => { const g = c.createLinearGradient(x0, y0, x1, y1); st.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
  c.fillStyle = lin(LR.x, LR.y, LR.x + LR.w, LR.y + LR.h, [[0, '#d4b57a'], [0.5, '#bf9c5c'], [1, '#a98847']]); c.fillRect(LR.x, LR.y, LR.w, LR.h);
  grain(c, LR.x, LR.y, LR.w, LR.h, 11, 260, 0.14);
  // painted blue rails and a gold meander round the frame
  const F = FRAME;
  c.strokeStyle = '#17508f'; c.lineWidth = 17; rr(c, F.x + 17, F.y + 17, F.w - 34, F.h - 34, 10); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 1.5; rr(c, F.x + 8.5, F.y + 8.5, F.w - 17, F.h - 17, 12); c.stroke(); rr(c, F.x + 25.5, F.y + 25.5, F.w - 51, F.h - 51, 8); c.stroke();
  const gold = { color: '#f1d98f', width: 1.5, shadow: false };
  meander(c, F.x + 20, F.y + 9.5, F.w - 40, 15, gold); meander(c, F.x + 20, F.y + F.h - 25, F.w - 40, 15, gold);
  meander(c, F.x + 9.5, F.y + 20, F.h - 40, 15, { ...gold, vertical: true }); meander(c, F.x + F.w - 25, F.y + 20, F.h - 40, 15, { ...gold, vertical: true });
  // the playing field: honey olive burl
  const iw = IN.x1 - IN.x0, ih = IN.y1 - IN.y0;
  c.fillStyle = lin(IN.x0, IN.y0, IN.x1, IN.y1, [[0, '#c9a763'], [0.5, '#b38f4f'], [1, '#98763a']]); c.fillRect(IN.x0, IN.y0, iw, ih);
  grain(c, IN.x0, IN.y0, iw, ih, 21, 150, 0.12);
  for (let i = 0; i < 24; i++) {
    const g = pointGeom(i), y0 = g.y - SLOT / 2 + 3, y1 = g.y + SLOT / 2 - 3, tx = g.edge + g.dir * PLEN, blue = i % 2 === 0;
    const path = (ins = 0) => { c.beginPath(); c.moveTo(g.edge, y0 + ins * 0.5); c.lineTo(tx - g.dir * ins * 2.2, g.y - 1.4); c.lineTo(tx - g.dir * ins * 2.2, g.y + 1.4); c.lineTo(g.edge, y1 - ins * 0.5); c.closePath(); };
    path(); c.fillStyle = blue ? lin(g.edge, 0, tx, 0, [[0, '#0f3d78'], [0.6, '#1d62ad'], [1, '#3b8bd0']]) : lin(g.edge, 0, tx, 0, [[0, '#d9cba6'], [0.6, '#f0e7cf'], [1, '#fbf6e6']]); c.fill();
    c.strokeStyle = 'rgba(18,10,4,0.65)'; c.lineWidth = 1.6; c.stroke();
    path(7); c.strokeStyle = blue ? 'rgba(241,217,143,0.85)' : 'rgba(23,80,143,0.8)'; c.lineWidth = 1.3; c.stroke();
    c.fillStyle = blue ? 'rgba(241,217,143,0.9)' : 'rgba(23,80,143,0.85)'; for (const f of [0.2, 0.36, 0.52]) { c.beginPath(); c.arc(g.edge + g.dir * PLEN * f, g.y, 2.8, 0, TAU); c.fill(); }
  }
  // the bar: deep blue lacquer with a gold meander
  c.fillStyle = lin(CH.x0, 0, CH.x1, 0, [[0, '#0b2c57'], [0.5, '#164a86'], [1, '#0b2c57']]); c.fillRect(CH.x0, IN.y0, CH.x1 - CH.x0, ih);
  for (const x of [CH.x0 + 5, CH.x1 - 5]) { c.strokeStyle = 'rgba(241,217,143,0.85)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, IN.y0 + 6); c.lineTo(x, IN.y1 - 6); c.stroke(); }
  meander(c, CH.cx - 11, IN.y0 + 90, ih - 180, 22, { vertical: true, color: '#f1d98f', width: 1.6, shadow: false });
  for (const yy of [IN.y0 + 46, IN.y1 - 46]) { c.fillStyle = '#f1e6c8'; c.beginPath(); c.arc(CH.cx, yy, 24, 0, TAU); c.fill(); c.strokeStyle = '#c9a24a'; c.lineWidth = 3; c.stroke(); c.fillStyle = '#17508f'; c.beginPath(); c.arc(CH.cx, yy, 14, 0, TAU); c.fill(); c.fillStyle = '#c96a3e'; c.beginPath(); c.arc(CH.cx, yy, 6, 0, TAU); c.fill(); }
  // bear-off trays: terracotta felt
  for (const T of [TRAY.opp, TRAY.me]) {
    c.fillStyle = lin(0, T.y, 0, T.y + T.h, [[0, '#6c2616'], [1, '#93381f']]); c.fillRect(T.x, T.y, T.w, T.h);
    const r = lcg(41); for (let i = 0; i < 1800; i++) { c.fillStyle = r() < 0.5 ? 'rgba(255,190,150,0.06)' : 'rgba(0,0,0,0.14)'; c.fillRect(T.x + r() * T.w, T.y + r() * T.h, 1.5, 1.5); }
  }
}
const uvOf = (xc, yc) => [(xc - LR.x) / LR.w, 1 - (yc - LR.y) / LR.h];
function rectPath(p, x, y, w, h, r = 0) {
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
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) if (n.getY(i) > 0.5) { const [u, v] = uvOf(cxOf(p.getX(i)), cyOf(p.getZ(i))); uv.setXY(i, u, v); } else uv.setXY(i, uv.getX(i) / 9, uv.getY(i) / 9);
  return geo;
}
export function buildBoard(texScale = 1.5) {
  const g = new THREE.Group();
  const c = cnv(Math.round(LR.w * texScale), Math.round(LR.h * texScale)), x = c.getContext('2d');
  x.scale(texScale, texScale); x.translate(-LR.x, -LR.y); paintTop(x);
  const map = tex(c);
  const WC = woodCanvas(512, '#a98847', '#cfae70', 13, { lines: 150 });
  const side = new THREE.MeshPhysicalMaterial({ map: tex(WC.map, true, true), bumpMap: tex(WC.bump, false, true), bumpScale: 0.5, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const top = new THREE.MeshPhysicalMaterial({ map, roughness: 0.34, clearcoat: 0.75, clearcoatRoughness: 0.16 });
  const bottom = new THREE.MeshStandardMaterial({ color: 0x8a6a35, roughness: 0.8 });
  const fieldL = [IN.x0, IN.y0, CH.x0 - IN.x0, IN.y1 - IN.y0], fieldR = [CH.x1, IN.y0, IN.x1 - CH.x1, IN.y1 - IN.y0];
  const trO = [TRAY.opp.x, TRAY.opp.y, TRAY.opp.w, TRAY.opp.h], trM = [TRAY.me.x, TRAY.me.y, TRAY.me.w, TRAY.me.h];
  const caseGeo = extrudeWithHoles([LR.x, LR.y, LR.w, LR.h, 22], [fieldL, fieldR, trO, trM], 0, FH);
  const cs = new THREE.Mesh(caseGeo, [top, side]); cs.castShadow = true; cs.receiveShadow = true; g.add(cs);
  const floor = new THREE.Mesh(slab((LR.w - 30) * K, (LR.h - 30) * K, FY, 0.5, 0.02), bottom); floor.position.set(0, 0, 0); floor.receiveShadow = true; g.add(floor);
  for (const [fx, fy, fw, fh] of [fieldL, fieldR]) {
    const pg = new THREE.PlaneGeometry(fw * K, fh * K); pg.rotateX(-Math.PI / 2);
    const p = pg.attributes.position, uv = pg.attributes.uv;
    for (let i = 0; i < p.count; i++) { const [u, v] = uvOf(fx + fw / 2 + p.getX(i) / K, fy + fh / 2 + p.getZ(i) / K); uv.setXY(i, u, v); }
    const m = new THREE.Mesh(pg, top); m.position.set(wx(fx + fw / 2), FY + 0.005, wz(fy + fh / 2)); m.receiveShadow = true; g.add(m);
  }
  for (const [tx, ty, tw, th] of [trO, trM]) {
    const pg = new THREE.PlaneGeometry(tw * K, th * K); pg.rotateX(-Math.PI / 2);
    const p = pg.attributes.position, uv = pg.attributes.uv;
    for (let i = 0; i < p.count; i++) { const [u, v] = uvOf(tx + tw / 2 + p.getX(i) / K, ty + th / 2 + p.getZ(i) / K); uv.setXY(i, u, v); }
    const m = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map, roughness: 1 })); m.position.set(wx(tx + tw / 2), TY, wz(ty + th / 2)); m.receiveShadow = true; g.add(m);
  }
  // bronze: a hinge across each end of the bar and four corner plates
  const bronze = new THREE.MeshPhysicalMaterial({ color: 0xcf9a45, metalness: 1, roughness: 0.3, clearcoat: 0.3 });
  for (const y of [FRAME.y + 4, FRAME.y + FRAME.h - 4]) {
    const hg = new THREE.Mesh(slab(88 * K, 1.0, 0.18, 0.2, 0.06), bronze); hg.position.set(0, FH + 0.02, wz(y) + (y < 700 ? 0.45 : -0.45)); hg.castShadow = true; g.add(hg);
  }
  const cornerShape = new THREE.Shape(); cornerShape.moveTo(0, 0); cornerShape.lineTo(1.6, 0); cornerShape.quadraticCurveTo(0.6, -0.5, 0, -1.6); cornerShape.closePath();
  const cg = new THREE.ExtrudeGeometry(cornerShape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }); cg.rotateX(-Math.PI / 2);
  for (const [x0, y0, sx, sz] of [[LR.x, LR.y, 1, 1], [LR.x + LR.w, LR.y, -1, 1], [LR.x, LR.y + LR.h, 1, -1], [LR.x + LR.w, LR.y + LR.h, -1, -1]]) {
    const m = new THREE.Mesh(cg, bronze); m.scale.set(sx, 1, sz); m.position.set(wx(x0) + sx * 0.12, FH + 0.04, wz(y0) + sz * 0.12); m.castShadow = true; g.add(m);
  }
  g.userData.dispose = () => { caseGeo.dispose(); map.dispose(); };
  return g;
}

// ------------------------------------------------------------------ checkers: marble discs with a carved Greek-key ring
function capTex(p, bump = false, S = 256) {
  const c = cnv(S), x = c.getContext('2d'), m = S / 2, r = S / 2, rnd = lcg(p.mid.length * 37 + p.ring.charCodeAt(1));
  if (bump) { x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, S, S); } else {
    const g = x.createRadialGradient(m * 0.8, m * 0.75, 4, m, m, r); g.addColorStop(0, p.hi); g.addColorStop(0.65, p.mid); g.addColorStop(1, p.lo); x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.strokeStyle = p.vein; for (let k = 0; k < 7; k++) { x.lineWidth = 1 + rnd() * 2; x.beginPath(); const y0 = rnd() * S; x.moveTo(0, y0); x.bezierCurveTo(S * 0.3, y0 + (rnd() - 0.5) * 90, S * 0.6, y0 + (rnd() - 0.5) * 90, S, y0 + (rnd() - 0.5) * 60); x.stroke(); }
  }
  const r1 = r * 0.5, r2 = r * 0.68, N = 24;
  x.strokeStyle = bump ? '#222' : p.ring; x.lineWidth = S * 0.022; x.lineJoin = 'miter'; x.beginPath();
  for (let i = 0; i < N; i++) { const a0 = (i / N) * TAU, a1 = ((i + 1) / N) * TAU, q = i % 2 ? r2 : r1, qn = i % 2 ? r1 : r2; if (i === 0) x.moveTo(m + Math.cos(a0) * q, m + Math.sin(a0) * q); x.arc(m, m, q, a0, a1); x.lineTo(m + Math.cos(a1) * qn, m + Math.sin(a1) * qn); }
  x.closePath(); x.stroke();
  x.strokeStyle = bump ? '#333' : p.groove; x.lineWidth = S * 0.012; for (const k of [0.86, 0.4]) { x.beginPath(); x.arc(m, m, r * k, 0, TAU); x.stroke(); }
  x.fillStyle = bump ? '#444' : p.ring; x.beginPath(); x.arc(m, m, r * 0.15, 0, TAU); x.fill();
  return tex(c, !bump);
}
export function checkerKit() {
  const R = CR, H = CT;
  const prof = [[0, 0], [R * 0.94, 0], [R * 0.99, 0.05], [R, 0.14], [R, H * 0.8], [R * 0.985, H * 0.94], [R * 0.93, H], [R * 0.9, H], [R * 0.88, H * 0.95]];
  const body = lathe(prof, 56);
  const cap = new THREE.CircleGeometry(R * 0.885, 56); cap.rotateX(-Math.PI / 2); cap.translate(0, H * 0.96, 0);
  const mats = {};
  for (const set of Object.keys(SETS)) mats[set] = SETS[set].map((p, s) => {
    const stone = set === 'marble' && s === 0;
    return {
      body: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(p.mid), roughness: stone ? 0.28 : 0.34, clearcoat: 0.85, clearcoatRoughness: 0.18, transmission: set === 'amber' && !s ? 0.25 : 0, thickness: 1 }),
      top: new THREE.MeshPhysicalMaterial({ map: capTex(p), bumpMap: capTex(p, true), bumpScale: 1.6, roughness: stone ? 0.26 : 0.3, clearcoat: 0.9, clearcoatRoughness: 0.14 }),
    };
  });
  const make = () => { const g = new THREE.Group(), b = new THREE.Mesh(body), t = new THREE.Mesh(cap); b.castShadow = true; b.receiveShadow = true; t.receiveShadow = true; g.add(b, t); return g; };
  return { make, mats };
}

// ------------------------------------------------------------------ dice: cobalt enamel (yours) and cream enamel (the rival's)
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
export const FACE_VAL = [3, 4, 1, 6, 2, 5];
const FACE_N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function faceTex(v, mine, S = 256) {
  const c = cnv(S), x = c.getContext('2d'), b = cnv(S), y = b.getContext('2d');
  const g = x.createLinearGradient(0, 0, S, S); if (mine) { g.addColorStop(0, '#2a6cc0'); g.addColorStop(1, '#13427f'); } else { g.addColorStop(0, '#fbf3dc'); g.addColorStop(1, '#e2d3ab'); }
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  y.fillStyle = '#a0a0a0'; y.fillRect(0, 0, S, S);
  const pr = (v === 1 ? 0.14 : 0.09) * S, sp = 0.25 * S;
  for (const [px, py] of PIPS[v]) {
    const X = S / 2 + px * sp, Y = S / 2 + py * sp, col = v === 1 ? '#c2412c' : mine ? '#fdf6e0' : '#10305c';
    x.fillStyle = col; x.beginPath(); x.arc(X, Y, pr, 0, TAU); x.fill();
    y.fillStyle = '#101010'; y.beginPath(); y.arc(X, Y, pr, 0, TAU); y.fill();
  }
  return { map: tex(c), bump: tex(b, false) };
}
export function diceKit() {
  const geo = roundedBox(DIE, DIE, DIE, DIE * 0.14, 8);
  const sets = [true, false].map((mine) => FACE_VAL.map((v) => { const T = faceTex(v, mine); return new THREE.MeshPhysicalMaterial({ map: T.map, bumpMap: T.bump, bumpScale: 1.6, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }); }));
  const make = (mine = true) => { const m = new THREE.Mesh(geo, sets[mine ? 0 : 1]); m.castShadow = true; m.receiveShadow = true; return m; };
  const up = new THREE.Vector3(0, 1, 0);
  const restQ = (v, yaw = 0) => { const k = FACE_VAL.indexOf(v), n = new THREE.Vector3(...FACE_N[Math.max(0, k)]); return new THREE.Quaternion().setFromAxisAngle(up, yaw).multiply(new THREE.Quaternion().setFromUnitVectors(n, up)); };
  return { make, restQ };
}

// ------------------------------------------------------------------ the kafeneio
function marbleTex() {
  const S = 512, c = cnv(S), x = c.getContext('2d'), r = lcg(5);
  x.fillStyle = '#e9e6dd'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 18; i++) { x.strokeStyle = `rgba(110,120,135,${0.05 + r() * 0.12})`; x.lineWidth = 0.8 + r() * 2.4; x.beginPath(); let px = r() * S, py = 0; x.moveTo(px, py); for (let k = 0; k < 8; k++) { px += (r() - 0.5) * 120; py += S / 8; x.lineTo(px, py); } x.stroke(); }
  for (let i = 0; i < 5000; i++) { x.fillStyle = `rgba(150,150,150,${r() * 0.05})`; x.fillRect(r() * S, r() * S, 2, 2); }
  return tex(c, true, true);
}
function clothTex() {
  const S = 512, c = cnv(S), x = c.getContext('2d'), n = 8, t = S / n;
  x.fillStyle = '#f7f3ea'; x.fillRect(0, 0, S, S);
  x.fillStyle = 'rgba(30,96,176,0.55)'; for (let i = 0; i < n; i += 2) { x.fillRect(i * t, 0, t, S); x.fillRect(0, i * t, S, t); }
  const r = lcg(9); for (let i = 0; i < 9000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,40,0.07)'; x.fillRect(r() * S, r() * S, 1, 2); }
  return tex(c, true, true);
}
function wallTex() {
  const W = 1024, H = 512, c = cnv(W, H), x = c.getContext('2d'), r = lcg(31);
  x.fillStyle = '#f1ede2'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 500; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(110,100,80,0.07)'; const s = 10 + r() * 50; x.beginPath(); x.ellipse(r() * W, r() * H, s, s * 0.5, r() * 3, 0, TAU); x.fill(); }
  x.fillStyle = '#1b56a5'; x.fillRect(0, H * 0.62, W, H * 0.38); x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, H * 0.62, W, 5);
  for (let i = 0; i < 400; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,40,0.1)'; const s = 8 + r() * 30; x.beginPath(); x.ellipse(r() * W, H * 0.62 + r() * H * 0.38, s, s * 0.4, r() * 3, 0, TAU); x.fill(); }
  return tex(c, true, true);
}
function seaTex() {
  const c = cnv(64, 256), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#7fb6ea'); g.addColorStop(0.5, '#cfe6fa'); g.addColorStop(0.58, '#e9f4fd'); g.addColorStop(0.6, '#2b78c4'); g.addColorStop(1, '#14529a'); x.fillStyle = g; x.fillRect(0, 0, 64, 256); return tex(c);
}
const phys = (o) => new THREE.MeshPhysicalMaterial(o);
export function buildRoom(scene) {
  const g = new THREE.Group(); scene.add(g);
  const mt = marbleTex(); mt.repeat.set(3, 3);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), phys({ map: mt, color: 0xb4bccb, roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
  table.rotation.x = -Math.PI / 2; table.position.y = -0.4; table.receiveShadow = true; g.add(table);
  const ct = clothTex(); ct.repeat.set(5, 8);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(64, 100), new THREE.MeshStandardMaterial({ map: ct, color: 0x9fb0cc, roughness: 0.95 }));
  cloth.rotation.x = -Math.PI / 2; cloth.rotation.z = 0.02; cloth.position.set(0, -0.36, 2); cloth.receiveShadow = true; g.add(cloth);
  // the wall: whitewash over a blue band, a window of sea light with open blue shutters
  const wt = wallTex(); wt.repeat.set(2, 1);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(520, 220), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.9, fog: false })); wall.position.set(0, 80, -150); g.add(wall);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(70, 90), new THREE.MeshBasicMaterial({ map: seaTex(), fog: false })); win.position.set(-60, 60, -149.4); g.add(win);
  const blue = new THREE.MeshStandardMaterial({ color: 0x1b56a5, roughness: 0.55 });
  for (const [x, w] of [[-60, 78], [-60, 4]]) { const fr = new THREE.Mesh(new THREE.BoxGeometry(w, 98, 2), blue); fr.position.set(x, 60, -149.8); if (w > 10) { fr.scale.set(1, 1, 0.5); } g.add(fr); }
  win.position.z = -148.6;
  for (const sx of [-1, 1]) { const sh = new THREE.Mesh(new THREE.BoxGeometry(34, 92, 2), blue); sh.position.set(-60 + sx * 52, 60, -146); sh.rotation.y = sx * 0.9; g.add(sh); }
  const sill = new THREE.Mesh(new THREE.BoxGeometry(80, 3, 10), new THREE.MeshStandardMaterial({ color: 0xf4f0e6, roughness: 0.8 })); sill.position.set(-60, 14, -146); g.add(sill);
  // a blue ladder-back kafeneio chair with a rush seat at the right of the table
  const chair = new THREE.Group(), rush = new THREE.MeshStandardMaterial({ color: 0xc9a561, roughness: 0.95 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(34, 3.5, 34), rush); seat.position.y = 22; chair.add(seat);
  for (const [lx, lz] of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.3, 22, 10), blue); l.position.set(lx, 11, lz); l.castShadow = true; chair.add(l); }
  for (const lx of [-15, 15]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 50, 10), blue); l.position.set(lx, 47, -15); l.castShadow = true; chair.add(l); }
  for (const y of [40, 52, 64]) { const sl = new THREE.Mesh(new THREE.BoxGeometry(30, 4, 1.6), blue); sl.position.set(0, y, -15); sl.castShadow = true; chair.add(sl); }
  chair.position.set(66, -0.4, -34); chair.rotation.y = -0.6; chair.scale.setScalar(0.9); g.add(chair);
  // ouzo with ice and a glass of water
  const glassM = phys({ color: 0xffffff, roughness: 0.04, transmission: 0.95, thickness: 0.2, ior: 1.45, transparent: true, opacity: 0.35, clearcoat: 1 });
  const mk = (prof, liq, liqColor, op, x, z) => {
    const t = new THREE.Group(); const gl = new THREE.Mesh(lathe(prof, 40), glassM); gl.renderOrder = 4; t.add(gl);
    const lq = new THREE.Mesh(lathe(liq, 36), phys({ color: liqColor, roughness: 0.15, transparent: true, opacity: op, transmission: 0.2, thickness: 2 })); lq.renderOrder = 3; t.add(lq);
    t.position.set(x, -0.36, z); g.add(t); return t;
  };
  mk([[0, 0.3], [2.4, 0.3], [2.6, 0.7], [3.1, 8.4], [3.0, 8.4], [2.45, 0.9], [0, 0.9]], [[0, 0.95], [2.45, 0.95], [3.0, 6.2], [0, 6.2]], 0xf2efe2, 0.9, 30, -20);
  const wat = mk([[0, 0.3], [2.2, 0.3], [2.5, 0.7], [2.9, 11], [2.8, 11], [2.35, 0.9], [0, 0.9]], [[0, 0.95], [2.35, 0.95], [2.8, 8.2], [0, 8.2]], 0xcfe6f6, 0.55, 37, -12);
  // Greek coffee: a white demitasse on a saucer
  const cup = new THREE.Group(), pg = phys({ color: 0xf8f6ef, roughness: 0.15, clearcoat: 1 });
  const sau = new THREE.Mesh(lathe([[0, 0], [4, 0.05], [5.2, 0.55], [5.3, 0.7], [3.9, 0.3], [0, 0.3]], 40), pg); sau.castShadow = true; sau.receiveShadow = true; cup.add(sau);
  const cp = new THREE.Mesh(lathe([[0, 0.3], [1.8, 0.3], [2.6, 1.2], [3.1, 4.4], [3.0, 4.4], [2.5, 1.3], [1.7, 0.5], [0, 0.5]], 40), pg); cp.castShadow = true; cup.add(cp);
  const cof = new THREE.Mesh(new THREE.CircleGeometry(2.95, 32), phys({ color: 0x2b170b, roughness: 0.2, clearcoat: 1 })); cof.rotation.x = -Math.PI / 2; cof.position.y = 3.9; cup.add(cof);
  const hd = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.3, 8, 20, Math.PI), pg); hd.position.set(3.6, 2.6, 0); hd.rotation.z = -Math.PI / 2; cup.add(hd);
  cup.position.set(-33, -0.36, 22); g.add(cup);
  // olives on a small plate and worry beads (komboloi)
  const plate = new THREE.Mesh(lathe([[0, 0], [4.2, 0.05], [5.6, 0.7], [5.7, 0.8], [4.0, 0.35], [0, 0.35]], 40), pg); plate.position.set(-34, -0.36, -14); plate.receiveShadow = true; plate.castShadow = true; g.add(plate);
  const ol = new THREE.MeshPhysicalMaterial({ color: 0x3a4a1e, roughness: 0.3, clearcoat: 0.8 }), ol2 = new THREE.MeshPhysicalMaterial({ color: 0x1e1a14, roughness: 0.3, clearcoat: 0.8 });
  [[-1.3, 0.6], [0.9, 1.4], [1.6, -0.9], [-0.4, -1.5], [0.2, 0.1]].forEach(([dx, dz], i) => { const o = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 10), i % 2 ? ol : ol2); o.scale.set(1.25, 0.9, 1); o.position.set(-34 + dx, 0.75, -14 + dz); o.rotation.y = i; o.castShadow = true; g.add(o); });
  const amber = phys({ color: 0xd9822a, roughness: 0.15, transmission: 0.3, thickness: 1, clearcoat: 1 });
  for (let i = 0; i < 22; i++) { const a = (i / 22) * TAU, b = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 10), amber); b.position.set(-32 + Math.cos(a) * 3.8, -0.36 + 0.7, 38 + Math.sin(a) * 3.0); b.castShadow = true; g.add(b); }
  return { group: g, cup, wat };
}
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xdcecff, 0x6a5a44, 0.45); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff0d2, 2.7);              // island sun through the shuttered window (upper left)
  key.position.set(-52, 66, -22); key.castShadow = true;
  const sc = key.shadow.camera; sc.left = -50; sc.right = 50; sc.top = 50; sc.bottom = -50; sc.near = 10; sc.far = 220;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 3; key.shadow.mapSize.set(2048, 2048);
  scene.add(key); scene.add(key.target);
  const rim = new THREE.DirectionalLight(0x9fc6ff, 0.6); rim.position.set(44, 24, -46); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xfff4e4, 0.4); fill.position.set(20, 40, 60); scene.add(fill);
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
export function pointGlowGeo() { const sh = new THREE.Shape(); sh.moveTo(0, -1); sh.lineTo(1, 0); sh.lineTo(0, 1); sh.closePath(); const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); return g; }
export function triGlowTex(S = 256) {
  const c = cnv(S), x = c.getContext('2d'); x.fillStyle = 'rgba(255,255,255,0.32)'; x.fillRect(0, 0, S, S);
  const g = x.createLinearGradient(0, 0, S, 0); g.addColorStop(0, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); return tex(c);
}

// Makruk 3D world (procedural, no image files). Units are centimetres. A Thai makruk board on a low teak table (tok) set on a
// woven reed mat (suea), in a teak house at dusk: plank floor, carved teak wall panels, a lattice window onto the evening sky and
// hanging brass lanterns. The board's border is black lacquer with gold-leaf flame-leaf work (lai rot nam); the pieces are turned,
// lacquered and gilded: Khun (crowned), Met, Khon, Ma (a carved horse head), Rua (a squat block) and Bia (cowrie shells, turned
// over when promoted). Shared by the presenter (play / menu) and the icon page.
import * as THREE from '../vendor3d/three.js';
import { board3d as B } from '../vendor3d/index.js';

export const C = 5.0;                                    // square size (a real makruk board: about 5 cm squares)
export const MAT_H = 0.5, TABLE_H = 14, TABLE_TOP = MAT_H + TABLE_H;
export const BODY = 3.6, TOP = TABLE_TOP + BODY;         // board top height above the floor
export const BX = 4 * C + 3.6;                           // half size of the (square) board top
export const TX = BX + 7, TZ = BX + 6;                   // half sizes of the table top
const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const ctex = (c, srgb = true, rep) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
export const LATIN = '"Cormorant Garamond", Georgia, "Times New Roman", serif';

// square index (0..63, a1 = 0) -> world point on the board top. The world is laid out as the screen shows it: x to the right,
// z toward the player at the bottom of the screen, so `flip` (Ruby at the bottom) only changes where a square is.
export const sqPos = (s, flip) => { let f = s & 7, r = s >> 3; if (flip) { f = 7 - f; r = 7 - r; } return { x: (f - 3.5) * C, z: (3.5 - r) * C }; };

// a pointed, double-curved flame leaf (kranok), drawn on a 2D context
function leaf(c, x, y, s, ang = 0) {
  c.save(); c.translate(x, y); c.rotate(ang); c.beginPath(); c.moveTo(0, 0);
  c.bezierCurveTo(s * 0.32, -s * 0.1, s * 0.34, -s * 0.5, s * 0.1, -s * 0.66);
  c.bezierCurveTo(s * 0.24, -s * 0.8, s * 0.06, -s * 0.93, 0, -s);
  c.bezierCurveTo(-s * 0.05, -s * 0.9, -s * 0.22, -s * 0.78, -s * 0.1, -s * 0.66);
  c.bezierCurveTo(-s * 0.32, -s * 0.5, -s * 0.32, -s * 0.12, 0, 0);
  c.closePath(); c.fill(); c.restore();
}
function grain(x, w, h, c0, c1, seed, { lines = 160, alpha = 0.16, dark = '60,34,12', vertical = false } = {}) {
  const r = lcg(seed), g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, c0); g.addColorStop(0.5, c1); g.addColorStop(1, c0);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.save(); if (vertical) { x.translate(w, 0); x.rotate(Math.PI / 2); [w, h] = [h, w]; }
  for (let i = 0; i < lines; i++) {
    const y = r() * h, a = alpha * (0.3 + r() * 0.7), amp = 1 + r() * 6, ph = r() * TAU, f = 1 + r() * 2.5;
    x.strokeStyle = `rgba(${dark},${a})`; x.lineWidth = 0.6 + r() * 2.2; x.beginPath();
    for (let k = 0; k <= 40; k++) { const px = (k / 40) * w, py = y + Math.sin(ph + (k / 40) * TAU * f) * amp; if (k) x.lineTo(px, py); else x.moveTo(px, py); }
    x.stroke();
  }
  x.restore();
}

// ---------------------------------------------------------------- the board top: theme = teak (default) | jade | indigo
const BOARD_THEMES = {
  teak: { field: ['#b9783a', '#cf8f4c'], dark: '70,34,10', line: 'rgba(36,16,4,0.92)', bumpLine: '#505050', lacq: '#120a07', gold: '#e9c063', label: '#f3d27c' },
  jade: { field: ['#0f3d36', '#145248'], dark: '0,0,0', line: '#e7c46c', bumpLine: '#b0b0b0', lacq: '#0b0f0c', gold: '#e9c063', label: '#f3d27c', lacquerField: true },
  indigo: { field: ['#18204d', '#202c66'], dark: '0,0,0', line: '#e2c779', bumpLine: '#b0b0b0', lacq: '#08091a', gold: '#e3c472', label: '#efd88e', lacquerField: true },
};
export function boardFace(theme = 'teak', flip = false, res = 1024) {
  const T = BOARD_THEMES[theme] || BOARD_THEMES.teak, W = res, m = cv(W), b = cv(W), x = m.getContext('2d'), y = b.getContext('2d');
  const k = W / (2 * BX), g0 = (BX - 4 * C) * k, gs = 8 * C * k;      // grid origin + size in pixels
  // border: black lacquer with a gold-leaf band of flame leaves (lai rot nam)
  x.fillStyle = T.lacq; x.fillRect(0, 0, W, W);
  const rr = lcg(13); for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255,220,170,${0.01 + rr() * 0.015})`; x.fillRect(rr() * W, rr() * W, 1 + rr() * 30, 1); }
  y.fillStyle = '#7a7a7a'; y.fillRect(0, 0, W, W);
  const band = g0 * 0.5, bx0 = g0 * 0.22;
  x.strokeStyle = T.gold; x.lineWidth = 0.18 * k; x.strokeRect(bx0, bx0, W - 2 * bx0, W - 2 * bx0); x.strokeRect(g0 - 0.55 * k, g0 - 0.55 * k, gs + 1.1 * k, gs + 1.1 * k);
  x.fillStyle = T.gold;
  const per = 22, step = (W - 2 * (bx0 + band * 0.5)) / per;
  for (let side = 0; side < 4; side++) {
    x.save(); x.translate(W / 2, W / 2); x.rotate(side * Math.PI / 2); x.translate(-W / 2, -W / 2);
    const cy = bx0 + band * 0.62;
    for (let i = 0; i <= per; i++) { const px = bx0 + band * 0.5 + i * step; leaf(x, px, cy + band * 0.12, band * 0.62, Math.PI / 2 * 0.35); leaf(x, px, cy + band * 0.12, band * 0.62, -Math.PI / 2 * 0.35); x.beginPath(); x.arc(px, cy + band * 0.2, band * 0.07, 0, TAU); x.fill(); }
    x.restore();
  }
  // corner rosettes
  for (const [cx, cz] of [[1, 1], [W - 1, 1], [1, W - 1], [W - 1, W - 1]]) { x.save(); x.translate(Math.abs(cx - band * 0.75), Math.abs(cz - band * 0.75)); for (let i = 0; i < 8; i++) leaf(x, 0, 0, band * 0.5, i * TAU / 8); x.restore(); }
  // the playing field
  if (T.lacquerField) {
    const g = x.createLinearGradient(0, g0, 0, g0 + gs); g.addColorStop(0, T.field[1]); g.addColorStop(1, T.field[0]); x.fillStyle = g; x.fillRect(g0, g0, gs, gs);
    const r2 = lcg(5); for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${0.008 + r2() * 0.01})`; x.fillRect(g0, g0 + r2() * gs, gs, 1 + r2() * 3); }
  } else {
    const fc = cv(Math.round(gs)), fx = fc.getContext('2d');
    grain(fx, fc.width, fc.height, T.field[0], T.field[1], 17, { lines: 260, alpha: 0.2, dark: T.dark, vertical: true });
    x.drawImage(fc, g0, g0);
    // two planks, a fine glue joint between them
    x.fillStyle = 'rgba(40,18,4,0.35)'; x.fillRect(g0 + gs * 0.5 - 1, g0, 2, gs);
  }
  // a soft polish: worn lighter near each player's side
  const wear = x.createRadialGradient(W / 2, W / 2, gs * 0.1, W / 2, W / 2, gs * 0.7); wear.addColorStop(0, 'rgba(255,230,180,0.06)'); wear.addColorStop(1, 'rgba(0,0,0,0.12)'); x.fillStyle = wear; x.fillRect(g0, g0, gs, gs);
  // incised grid (uncheckered): lines in the colour map and grooves in the bump map
  const lines = (ctx, col, wdt) => { ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.beginPath(); for (let i = 0; i <= 8; i++) { const p = g0 + i * C * k; ctx.moveTo(p, g0); ctx.lineTo(p, g0 + gs); ctx.moveTo(g0, p); ctx.lineTo(g0 + gs, p); } ctx.stroke(); };
  lines(x, T.line, 0.22 * k); lines(y, T.bumpLine, 0.3 * k);
  y.lineWidth = 0.6 * k; y.strokeStyle = '#4a4a4a'; y.strokeRect(g0, g0, gs, gs);
  // engraved coordinates in the inner border
  x.fillStyle = T.label; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `700 ${Math.round(1.25 * k)}px ${LATIN}`;
  for (let i = 0; i < 8; i++) {
    const file = String.fromCharCode(97 + (flip ? 7 - i : i)), rank = String(flip ? i + 1 : 8 - i);
    x.fillText(file, g0 + (i + 0.5) * C * k, g0 + gs + 0.95 * k);
    x.fillText(rank, g0 - 0.95 * k, g0 + (i + 0.5) * C * k);
  }
  return { map: ctex(m), bump: ctex(b, false) };
}

export function buildBoard(theme = 'teak', flip = false, res = 1024) {
  const grp = new THREE.Group(), face = boardFace(theme, flip, res);
  const topMat = new THREE.MeshPhysicalMaterial({ map: face.map, bumpMap: face.bump, bumpScale: 1.6, roughness: theme === 'teak' ? 0.5 : 0.3, clearcoat: theme === 'teak' ? 0.45 : 0.9, clearcoatRoughness: theme === 'teak' ? 0.35 : 0.12 });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(2 * BX - 0.5, 2 * BX - 0.5), topMat);
  top.rotation.x = -Math.PI / 2; top.position.y = TOP + 0.012; top.receiveShadow = true; grp.add(top);
  const lacq = B.material('lacquer', { color: '#140b08', color2: '#1f120c', seed: 3 });
  const body = new THREE.Mesh(B.slab(2 * BX, 2 * BX, BODY, 0.6, 0.35), lacq); body.position.y = TABLE_TOP; body.castShadow = true; body.receiveShadow = true; grp.add(body);
  // a thin gilded fillet around the apron
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xd8a948, metalness: 1, roughness: 0.3, clearcoat: 0.4 });
  const fil = new THREE.Mesh(B.slab(2 * BX + 0.1, 2 * BX + 0.1, 0.22, 0.65, 0.05), gold); fil.position.y = TABLE_TOP + BODY * 0.55; grp.add(fil);
  grp.userData.dispose = () => { face.map.dispose(); face.bump.dispose(); topMat.dispose(); };
  return grp;
}

// ---------------------------------------------------------------- pieces
export const KIND = { BIA: 1, MET: 2, KHON: 3, MA: 4, RUA: 5, KHUN: 6, NGAI: 7 };
// heights / base radii (cm) of the real thing, at C = 5
const PROFILES = {
  6: [[0, 0], [1.75, 0], [1.8, 0.25], [1.7, 0.55], [1.42, 0.7], [1.42, 0.7], [1.1, 0.95], [1.0, 1.6], [0.88, 2.35], [1.15, 2.55], [1.15, 2.55], [1.12, 2.75], [0.78, 2.85], [0.8, 3.15], [0.62, 3.55], [0.42, 3.95], [0.22, 4.35], [0.1, 4.65], [0, 4.85]],
  2: [[0, 0], [1.55, 0], [1.6, 0.22], [1.5, 0.5], [1.25, 0.62], [1.25, 0.62], [0.95, 0.85], [0.82, 1.5], [0.74, 2.0], [0.98, 2.2], [0.98, 2.2], [0.95, 2.36], [0.7, 2.45], [0.9, 2.75], [0.92, 3.0], [0.75, 3.25], [0.42, 3.42], [0.16, 3.55], [0.1, 3.75], [0, 3.85]],
  3: [[0, 0], [1.6, 0], [1.65, 0.24], [1.55, 0.52], [1.3, 0.65], [1.3, 0.65], [0.98, 0.9], [0.85, 1.5], [0.78, 1.95], [1.0, 2.12], [1.0, 2.12], [0.96, 2.28], [0.72, 2.36], [0.95, 2.7], [0.98, 3.0], [0.82, 3.35], [0.5, 3.75], [0.2, 4.05], [0, 4.15]],
  5: [[0, 0], [1.75, 0], [1.8, 0.25], [1.7, 0.55], [1.5, 0.66], [1.5, 0.66], [1.42, 0.8], [1.38, 2.05], [1.62, 2.2], [1.62, 2.2], [1.62, 2.55], [1.45, 2.65], [1.45, 2.65], [1.15, 2.72], [0, 2.75]],
  4: [[0, 0], [1.7, 0], [1.75, 0.25], [1.65, 0.55], [1.38, 0.68], [1.38, 0.68], [1.25, 0.82], [1.1, 1.05], [0, 1.08]],
};
const geoCache = new Map();
function horseHead() {
  // a carved horse head and neck in profile (facing +x), extruded and bevelled; sits on the Ma's turned base
  const s = new THREE.Shape(), k = 0.042;
  const P = (x, y) => [x * k, -y * k];
  const mv = (x, y) => s.moveTo(...P(x, y)), ln = (x, y) => s.lineTo(...P(x, y)), bz = (a, b, c, d, e, f) => s.bezierCurveTo(...P(a, b), ...P(c, d), ...P(e, f));
  mv(-26, -22); bz(-30, -44, -26, -66, -14, -80); ln(-13, -97); ln(-3, -85);
  bz(8, -90, 22, -78, 31, -60); bz(37, -52, 38, -44, 30, -40); bz(24, -39, 18, -43, 12, -47);
  bz(15, -38, 20, -30, 24, -22); ln(-26, -22);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.15, bevelEnabled: true, bevelThickness: 0.32, bevelSize: 0.22, bevelSegments: 5, curveSegments: 24 });
  g.translate(0, 0, -0.575); g.computeVertexNormals();
  // smooth the facets: average the normals of coincident vertices (extrude geometry is un-indexed, which reads as flat bands)
  const pos = g.attributes.position, nor = g.attributes.normal, acc = new Map(), key = (i) => `${Math.round(pos.getX(i) * 400)},${Math.round(pos.getY(i) * 400)},${Math.round(pos.getZ(i) * 400)}`;
  for (let i = 0; i < pos.count; i++) { const k = key(i), a = acc.get(k) || [0, 0, 0]; a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i); acc.set(k, a); }
  for (let i = 0; i < pos.count; i++) { const a = acc.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1; nor.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
  return g;
}
function cowrie(turned) {
  // an ellipsoid shell 2.7 x 2.0 cm, 1.15 cm high, flat underside; the top shows the toothed slit (Bia) or the domed back (Bia-ngai)
  const g = new THREE.SphereGeometry(1, 36, 18, 0, TAU, 0, Math.PI / 2);
  g.scale(1.38, turned ? 1.15 : 0.95, 1.0); g.computeVertexNormals();
  return g;
}
export function pieceGeo(t) {
  if (geoCache.has(t)) return geoCache.get(t);
  let out;
  if (t === 1 || t === 7) out = { body: cowrie(t === 7) };
  else {
    const body = B.lathe(PROFILES[t], 48);
    out = { body };
    if (t === 4) out.head = horseHead();
  }
  geoCache.set(t, out); return out;
}
export const height = (t) => (t === 1 ? 0.95 : t === 7 ? 1.15 : t === 4 ? 4.2 : PROFILES[t][PROFILES[t].length - 1][1]);

// materials: Gold = gilded wood (warm metal leaf over lacquer), Ruby = deep red lacquer; cowries keep their shell look, tinted
const matCache = new Map();
function shellTex(turned, gold) {
  const c = cv(256, 128), x = c.getContext('2d');
  // equirect-ish map over the dome: u around, v from rim (bottom) to the top (pole at v = 1 -> canvas y = 0)
  const g = x.createLinearGradient(0, 0, 0, 128);
  if (gold) { g.addColorStop(0, '#fff3cf'); g.addColorStop(0.5, '#f0cf82'); g.addColorStop(1, '#c48f35'); } else { g.addColorStop(0, '#ff8f7a'); g.addColorStop(0.5, '#c42a32'); g.addColorStop(1, '#6e0f1c'); }
  x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  const r = lcg(turned ? 7 : 3);
  for (let i = 0; i < 90; i++) { x.fillStyle = gold ? `rgba(150,96,30,${0.05 + r() * 0.12})` : `rgba(60,0,10,${0.05 + r() * 0.12})`; x.beginPath(); x.ellipse(r() * 256, r() * 110, 2 + r() * 5, 1 + r() * 3, 0, 0, TAU); x.fill(); }
  if (!turned) {
    // the toothed slit runs along the long axis (u = 0 and u = 0.5 meridians, near the pole)
    x.fillStyle = gold ? '#4a2c0a' : '#2a0510';
    for (const u of [0, 128, 256]) { x.beginPath(); x.ellipse(u, 0, 5, 64, 0, 0, TAU); x.fill(); }
    x.strokeStyle = gold ? '#fff2c8' : '#ffd0c0'; x.lineWidth = 1.6;
    for (const u of [0, 128, 256]) for (let v = 6; v < 58; v += 6) { x.beginPath(); x.moveTo(u - 5, v); x.lineTo(u + 5, v); x.stroke(); }
  } else {
    // the back: a gilt diamond inlay on the crown of the dome
    x.fillStyle = gold ? '#7a4b10' : '#f3cf75';
    x.fillRect(0, 0, 256, 7);
    for (const u of [32, 96, 160, 224]) { x.beginPath(); x.moveTo(u, 8); x.lineTo(u + 6, 22); x.lineTo(u, 36); x.lineTo(u - 6, 22); x.closePath(); x.fill(); }
  }
  return ctex(c);
}
export function pieceMats(side, t, alpha = 1) {
  const key = `${side}|${t}|${alpha < 1 ? 'a' : 'o'}`; if (matCache.has(key)) return matCache.get(key);
  const gold = side > 0, tr = alpha < 1;
  let body, trim;
  if (t === 1 || t === 7) {
    body = new THREE.MeshPhysicalMaterial({ map: shellTex(t === 7, gold), roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, metalness: gold ? 0.25 : 0, transparent: tr });
  } else if (gold) {
    body = new THREE.MeshPhysicalMaterial({ color: 0xe0ad4c, metalness: 0.78, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.25, transparent: tr });
  } else {
    body = new THREE.MeshPhysicalMaterial({ color: 0x8e0f1c, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.3, sheenColor: new THREE.Color(0xff6a5a), transparent: tr });
  }
  trim = gold ? new THREE.MeshPhysicalMaterial({ color: 0x5a2c0c, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.1, transparent: tr }) : new THREE.MeshPhysicalMaterial({ color: 0xe9bf5a, metalness: 1, roughness: 0.28, transparent: tr });
  const out = { body, trim }; matCache.set(key, out); return out;
}

// One piece = a Group with the turned body (+ the horse head / gilt bands). Built once per pool slot and re-dressed per frame.
export function makePieceSlot() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(pieceGeo(6).body, pieceMats(1, 6).body); body.castShadow = true; body.receiveShadow = true; g.add(body);
  const head = new THREE.Mesh(horseHead(), pieceMats(1, 4).body); head.castShadow = true; head.visible = false; g.add(head);
  // a gilt band (torus) at the collar of the lathe pieces
  const band = new THREE.Mesh(new THREE.TorusGeometry(1, 0.11, 8, 40), pieceMats(1, 6).trim); band.rotation.x = Math.PI / 2; band.castShadow = false; g.add(band);
  const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), pieceMats(1, 6).trim); g.add(jewel);
  g.userData = { body, head, band, jewel, key: '' };
  return g;
}
const BAND_AT = { 6: [2.55, 1.15], 2: [2.2, 0.98], 3: [2.12, 1.0], 5: [2.37, 1.64], 4: [0.68, 1.4] };
export function dressPiece(g, p, alpha = 1) {
  const t = Math.abs(p), side = p > 0 ? 1 : -1, key = `${p}|${alpha < 1 ? 1 : 0}`, u = g.userData;
  if (u.key !== key) {
    u.key = key;
    const geo = pieceGeo(t), M = pieceMats(side, t, alpha);
    u.body.geometry = geo.body; u.body.material = M.body;
    u.head.visible = t === 4; if (t === 4) { u.head.material = M.body; u.head.position.set(0, 0.13, 0); }
    const bd = BAND_AT[t]; u.band.visible = !!bd; u.band.material = M.trim; if (bd) { u.band.position.y = bd[0]; u.band.scale.set(bd[1] + 0.02, bd[1] + 0.02, 1); }
    u.jewel.visible = t === 6; u.jewel.material = M.trim; u.jewel.position.set(0, 2.75, -1.1);
  }
  if (alpha < 1) { const M = pieceMats(side, t, alpha); M.body.opacity = M.trim.opacity = alpha; }
}

// ---------------------------------------------------------------- the room
function planksCanvas(res = 1024) {
  const c = cv(res), x = c.getContext('2d'), r = lcg(77), n = 6, h = res / n;
  for (let i = 0; i < n; i++) {
    const pc = cv(res, Math.ceil(h)), px = pc.getContext('2d'), tone = r();
    grain(px, res, h, tone < 0.5 ? '#4a2a16' : '#55311a', tone < 0.5 ? '#5d3820' : '#663e22', 30 + i * 7, { lines: 70, alpha: 0.28, dark: '22,10,4' });
    x.drawImage(pc, 0, i * h);
    x.fillStyle = 'rgba(10,4,2,0.75)'; x.fillRect(0, i * h, res, 2.5);
    const j = r() * res; x.fillRect(j, i * h, 2.5, h);
  }
  return c;
}
function matCanvas(res = 512) {
  // suea: a woven reed mat, natural straw with dyed red / green / black bands and a lozenge border
  const c = cv(res), x = c.getContext('2d');
  x.fillStyle = '#c9a466'; x.fillRect(0, 0, res, res);
  for (let i = 0; i < res; i += 4) { x.fillStyle = i % 8 ? 'rgba(120,80,30,0.16)' : 'rgba(255,240,200,0.12)'; x.fillRect(0, i, res, 2); }
  for (let i = 0; i < res; i += 8) { x.fillStyle = 'rgba(90,60,20,0.08)'; x.fillRect(i, 0, 3, res); }
  const band = (y, h, col) => { x.fillStyle = col; x.fillRect(0, y, res, h); };
  band(18, 10, '#8c1c1c'); band(34, 6, '#1d4a33'); band(res - 28, 10, '#8c1c1c'); band(res - 40, 6, '#1d4a33');
  x.fillStyle = '#1b1410';
  for (let i = 0; i < res; i += 22) for (const y of [52, res - 62]) { x.beginPath(); x.moveTo(i, y); x.lineTo(i + 8, y + 6); x.lineTo(i, y + 12); x.lineTo(i - 8, y + 6); x.closePath(); x.fill(); }
  for (let i = 0; i < res; i += 4) { x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(i, 0, 1, res); }
  return c;
}
function wallCanvas(res = 512) {
  // carved teak panels: framed rectangles with a flame-leaf medallion in each
  const W = res * 2, H = res, c = cv(W, H), x = c.getContext('2d');
  grain(x, W, H, '#3b2112', '#4a2a17', 11, { lines: 120, alpha: 0.25, dark: '18,8,3', vertical: true });
  const n = 4, pw = W / n;
  for (let i = 0; i < n; i++) {
    const X = i * pw;
    x.fillStyle = 'rgba(0,0,0,0.38)'; x.fillRect(X + 14, 18, pw - 28, H - 36);
    x.fillStyle = 'rgba(255,200,140,0.07)'; x.fillRect(X + 18, 22, pw - 36, 3);
    x.save(); x.translate(X + pw / 2, H / 2); x.fillStyle = 'rgba(214,160,72,0.5)';
    for (let k = 0; k < 8; k++) leaf(x, 0, 0, H * 0.16, k * TAU / 8);
    x.fillStyle = 'rgba(214,160,72,0.35)'; for (let k = 0; k < 16; k++) leaf(x, 0, 0, H * 0.27, k * TAU / 16 + 0.2);
    x.restore();
  }
  return c;
}
function skyCanvas(res = 256) {
  const c = cv(res, res * 2), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, res * 2);
  g.addColorStop(0, '#1b2350'); g.addColorStop(0.45, '#4b3a6e'); g.addColorStop(0.75, '#d9764a'); g.addColorStop(1, '#ffc27a');
  x.fillStyle = g; x.fillRect(0, 0, res, res * 2);
  // palm silhouettes against the dusk
  x.fillStyle = '#120a12';
  const palm = (bx, by, h) => { x.fillRect(bx - 2, by - h, 4, h); x.save(); x.translate(bx, by - h); for (let k = 0; k < 7; k++) { x.save(); x.rotate(-1.2 + k * 0.4); x.beginPath(); x.ellipse(h * 0.18, 0, h * 0.2, 4, 0, 0, TAU); x.fill(); x.restore(); } x.restore(); };
  palm(res * 0.3, res * 2, res * 0.9); palm(res * 0.78, res * 2, res * 0.7);
  x.fillRect(0, res * 1.9, res, res * 0.1);
  return c;
}
function latticeCanvas(res = 256) {
  const c = cv(res, res * 2), x = c.getContext('2d'); x.fillStyle = '#24140a';
  const fr = res * 0.07; x.fillRect(0, 0, res, fr); x.fillRect(0, res * 2 - fr, res, fr); x.fillRect(0, 0, fr, res * 2); x.fillRect(res - fr, 0, fr, res * 2);
  // vertical balusters (luk krong) of a Thai window
  for (let i = 1; i < 7; i++) { const X = (i / 7) * res; x.fillRect(X - res * 0.022, 0, res * 0.044, res * 2); }
  x.fillRect(0, res * 0.95, res, res * 0.05);
  return c;
}
export function radialTex(rgb, a = 1, size = 128) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.4, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return ctex(c);
}

// a hanging brass lantern (tiered, pierced), with a warm glow sprite; returns the group and its glow material
function lantern(brass, glowMat, s = 1) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(B.lathe([[0, 0], [2.2, 0.4], [3.4, 2.2], [3.6, 5.5], [2.6, 8], [1.4, 9.2], [1.6, 10.2], [0.6, 11.5], [0.3, 13], [0, 13.2]].map(([r, y]) => [r * s, y * s]), 24), brass);
  body.castShadow = false; g.add(body);
  const core = new THREE.Mesh(new THREE.SphereGeometry(2.6 * s, 16, 10), new THREE.MeshBasicMaterial({ color: 0xffc070 })); core.position.y = 3.8 * s; core.scale.y = 1.25; g.add(core);
  const glow = new THREE.Sprite(glowMat); glow.scale.set(34 * s, 34 * s, 1); glow.position.y = 4 * s; g.add(glow);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 120, 6), new THREE.MeshBasicMaterial({ color: 0x1a0f08 })); cord.position.y = 13 * s + 60; g.add(cord);
  return g;
}

export function buildRoom(scene, { quality = 1 } = {}) {
  const grp = new THREE.Group(); scene.add(grp);
  const floorT = ctex(planksCanvas(quality ? 1024 : 512), true, [3, 3]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshPhysicalMaterial({ map: floorT, roughness: 0.48, clearcoat: 0.45, clearcoatRoughness: 0.3 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; grp.add(floor);
  // the woven mat under the table
  const mat = new THREE.Mesh(B.slab(150, 112, MAT_H, 1, 0.2), new THREE.MeshStandardMaterial({ map: ctex(matCanvas(quality ? 512 : 256), true, [1, 1]), roughness: 0.9 }));
  mat.receiveShadow = true; mat.rotation.y = 0.04; grp.add(mat);
  // the low teak table (tok): a thick top with a red-lacquer edge and four turned legs
  const teak = B.material('wood', { color: '#6a3a18', color2: '#8a4e22', seed: 21 });
  const tTop = new THREE.Mesh(B.slab(2 * TX, 2 * TZ, 3.2, 2.2, 0.8), teak); tTop.position.y = TABLE_TOP - 3.2; tTop.castShadow = true; tTop.receiveShadow = true; grp.add(tTop);
  const red = new THREE.MeshPhysicalMaterial({ color: 0x7a1010, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12 });
  const apron = new THREE.Mesh(B.slab(2 * TX - 3, 2 * TZ - 3, 4.2, 1.6, 0.3), red); apron.position.y = TABLE_TOP - 7.2; apron.castShadow = true; grp.add(apron);
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xd2a347, metalness: 1, roughness: 0.32 });
  const fillet = new THREE.Mesh(B.slab(2 * TX - 2.6, 2 * TZ - 2.6, 0.3, 1.7, 0.05), brass); fillet.position.y = TABLE_TOP - 3.5; grp.add(fillet);
  const legGeo = B.lathe([[0, 0], [1.9, 0], [2.2, 0.6], [1.6, 1.6], [1.3, 3.5], [1.8, 5.2], [1.4, 6.6], [1.5, TABLE_H - 7.2 - MAT_H], [0, TABLE_H - 7.2 - MAT_H]], 20);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = new THREE.Mesh(legGeo, teak); l.position.set(sx * (TX - 5), MAT_H, sz * (TZ - 5)); l.castShadow = true; grp.add(l); }
  // back wall: carved teak panels with a lattice window onto the dusk sky
  const wallT = ctex(wallCanvas(quality ? 512 : 256), true, [2, 1]);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallT, roughness: 0.75 });
  const wallZ = -150;
  const wallL = new THREE.Mesh(new THREE.PlaneGeometry(260, 200), wallMat); wallL.position.set(-200, 100, wallZ); grp.add(wallL);
  const wallR = wallL.clone(); wallR.position.x = 200; grp.add(wallR);
  const lintel = new THREE.Mesh(new THREE.PlaneGeometry(140, 70), wallMat); lintel.position.set(0, 165, wallZ); grp.add(lintel);
  const sill = new THREE.Mesh(new THREE.PlaneGeometry(140, 40), wallMat); sill.position.set(0, 20, wallZ); grp.add(sill);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(140, 280), new THREE.MeshBasicMaterial({ map: ctex(skyCanvas()), fog: false })); sky.position.set(0, 110, wallZ - 40); grp.add(sky);
  const lat = new THREE.Mesh(new THREE.PlaneGeometry(140, 90), new THREE.MeshBasicMaterial({ map: ctex(latticeCanvas()), transparent: true, alphaTest: 0.5 })); lat.position.set(0, 85, wallZ + 0.5); grp.add(lat);
  const postMat = B.material('darkWood', { color: '#21120a', color2: '#33200f', seed: 5 });
  for (const px of [-72, 72]) { const p = new THREE.Mesh(new THREE.BoxGeometry(10, 200, 10), postMat); p.position.set(px, 100, wallZ + 4); grp.add(p); }
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(500, 200), wallMat); w.position.set(sx * 230, 100, 60); w.rotation.y = -sx * Math.PI / 2; grp.add(w); }
  // hanging brass lanterns, glowing
  const glowMat = new THREE.SpriteMaterial({ map: radialTex('255,176,90', 0.95), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const lanterns = [];
  for (const [x, y, z, s] of [[-58, 88, -40, 1.1], [62, 96, -70, 1], [-120, 104, -110, 0.9], [130, 92, -20, 1.05], [10, 118, -125, 0.85]]) {
    const L = lantern(brass, glowMat, s); L.position.set(x, y, z); grp.add(L); lanterns.push(L);
  }
  // window light: a cool dusk glow behind the board
  const winGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('255,170,120', 0.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  winGlow.scale.set(260, 200, 1); winGlow.position.set(0, 70, wallZ + 2); grp.add(winGlow);
  return { group: grp, floorT, lanterns, glowMat };
}

// props on the table and the mat: a brass bowl (khan) of water with floating jasmine, a lidded lacquer box, a teacup
export function buildProps() {
  const grp = new THREE.Group();
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xd9aa4c, metalness: 1, roughness: 0.25, clearcoat: 0.3 });
  const bowl = new THREE.Group();
  const shell = new THREE.Mesh(B.lathe([[0, 0], [3.2, 0], [3.4, 0.5], [5.6, 2.4], [7.0, 5.0], [7.3, 6.1], [7.0, 6.2], [6.6, 5.0], [5.1, 2.6], [0, 1.3]], 48), brass);
  const foot = new THREE.Mesh(B.lathe([[0, 0], [3.6, 0], [3.8, 0.3], [3.0, 0.8], [2.6, 1.4], [0, 1.4]], 40), brass); shell.position.y = 1.2;
  const water = new THREE.Mesh(new THREE.CircleGeometry(6.6, 40), new THREE.MeshPhysicalMaterial({ color: 0x18303a, roughness: 0.04, metalness: 0.2, clearcoat: 1 })); water.rotation.x = -Math.PI / 2; water.position.y = 6.3;
  shell.castShadow = foot.castShadow = true; bowl.add(foot, shell, water);
  const petal = new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.6 });
  const r = lcg(9);
  for (let i = 0; i < 7; i++) { const f = new THREE.Group(); for (let k = 0; k < 5; k++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), petal); p.scale.set(1, 0.35, 0.55); p.position.set(Math.cos(k * TAU / 5) * 0.55, 0, Math.sin(k * TAU / 5) * 0.55); p.rotation.y = -k * TAU / 5; f.add(p); } const a = r() * TAU, d = r() * 4.6; f.position.set(Math.cos(a) * d, 6.45, Math.sin(a) * d); bowl.add(f); }
  grp.add(bowl);
  const box = new THREE.Group(), lq = new THREE.MeshPhysicalMaterial({ color: 0x150b07, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
  const base = new THREE.Mesh(B.slab(16, 10, 5, 1, 0.3), lq), lid = new THREE.Mesh(B.slab(16.6, 10.6, 1.4, 1.2, 0.4), lq), gb = new THREE.Mesh(B.slab(16.7, 10.7, 0.25, 1.25, 0.05), brass);
  lid.position.set(0, 5, 0); gb.position.y = 5.6; base.castShadow = lid.castShadow = true; box.add(base, lid, gb); grp.add(box);
  const cup = new THREE.Group(), cel = new THREE.MeshPhysicalMaterial({ color: 0xf2ece0, roughness: 0.15, clearcoat: 1 });
  const c1 = new THREE.Mesh(B.lathe([[0, 0], [1.6, 0], [1.8, 0.3], [2.8, 2.2], [3.2, 4.4], [3.0, 4.4], [2.6, 2.4], [0, 1.0]], 32), cel); c1.castShadow = true;
  const tea = new THREE.Mesh(new THREE.CircleGeometry(2.85, 24), new THREE.MeshStandardMaterial({ color: 0x8a4a12, roughness: 0.05 })); tea.rotation.x = -Math.PI / 2; tea.position.y = 3.7;
  cup.add(c1, tea); grp.add(cup);
  return { group: grp, bowl, box, cup };
}

export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x2a140a, 0.45); scene.add(hemi);
  // key: the big lantern up and to the left (warm), soft shadows
  const key = new THREE.DirectionalLight(0xffc888, 2.7); key.position.set(-70, 120, 40); key.target.position.set(0, TOP, 0);
  key.shadow.camera.left = -60; key.shadow.camera.right = 60; key.shadow.camera.top = 60; key.shadow.camera.bottom = -60; key.shadow.camera.near = 20; key.shadow.camera.far = 400;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4; scene.add(key, key.target);
  // rim: the dusk window behind the board (rose-orange), fill: cool evening from the room side
  const rim = new THREE.DirectionalLight(0xffa070, 1.3); rim.position.set(30, 50, -160); scene.add(rim);
  const fill = new THREE.DirectionalLight(0x9fb4ff, 0.35); fill.position.set(90, 60, 140); scene.add(fill);
  const lamp = new THREE.PointLight(0xffb060, 900, 260, 1.6); lamp.position.set(-58, 84, -40); scene.add(lamp);
  return { hemi, key, rim, fill, lamp };
}

// marker textures (white, tinted per use): soft glow, solid dot, ring, dashed ring, square cursor, cross, arrow shaft
export function markTextures() {
  const mk = (paint) => { const c = cv(128), x = c.getContext('2d'); paint(x); return ctex(c); };
  return {
    glow: mk((x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.45, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }),
    dot: mk((x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,1)'); g.addColorStop(0.42, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }),
    ring: mk((x) => { x.strokeStyle = '#fff'; x.lineWidth = 9; x.filter = 'blur(1.5px)'; x.beginPath(); x.arc(64, 64, 52, 0, TAU); x.stroke(); }),
    dash: mk((x) => { x.strokeStyle = '#fff'; x.lineWidth = 8; x.setLineDash([16, 12]); x.beginPath(); x.arc(64, 64, 52, 0, TAU); x.stroke(); }),
    square: mk((x) => { x.fillStyle = 'rgba(255,255,255,0.55)'; x.fillRect(4, 4, 120, 120); x.strokeStyle = '#fff'; x.lineWidth = 7; x.strokeRect(6, 6, 116, 116); }),
    fill: mk((x) => { x.fillStyle = '#fff'; x.fillRect(2, 2, 124, 124); }),
    cursor: mk((x) => { x.strokeStyle = '#fff'; x.lineWidth = 6; x.setLineDash([14, 10]); x.strokeRect(8, 8, 112, 112); }),
    cross: mk((x) => { x.strokeStyle = '#fff'; x.lineWidth = 12; x.lineCap = 'round'; x.beginPath(); x.moveTo(30, 30); x.lineTo(98, 98); x.moveTo(98, 30); x.lineTo(30, 98); x.stroke(); }),
  };
}

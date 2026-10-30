// The 3D world for Nine Men's Morris, all procedural (no bitmaps): a thick carved wood board (three nested squares cut into the face,
// brass-ringed sockets at the 24 points, a raised lip), turned wooden men, two carved trays for the men still to place, on a plank table
// in a candlelit tavern (stone wall, arch, brass candlesticks with flames, pewter tankards). Units are centimetres, y is up, the table
// top is y = 0 and the board top is y = TOP. Board point i sits at (u, v) = PT[i]: world x = u * SP, z = (v - 3) * SP (v = 0 is far).
import * as THREE from '../vendor3d/three.js';
import { lathe, roundedBox, mergeGeos } from '../vendor3d/board3d.js';
import { PT } from '../src/layout.js';

export const SP = 4.6;               // spacing between neighbouring points (cm): the outer square is 27.6 cm
export const HALF = 19.4;            // half the slab (38.8 cm square)
export const THICK = 3.0;
export const TOP = THICK;
export const MR = 1.7;               // man radius (3.4 cm across)
export const MH = 0.95;              // man height
export const TRAY_D = 5.8, TRAY_H = 1.7, TRAY_PITCH = 3.7, TRAY_GAP = 4.0;
export const TRAY_OFF = HALF + TRAY_GAP + TRAY_D / 2;      // distance of a tray's centre line from the board centre

const rnd = (s) => { let x = s | 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; };
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
export function radialTex(rgb = '255,255,255', a = 1) {
  const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c);
}

export const pointWorld = (i) => ({ x: PT[i][0] * SP, z: (PT[i][1] - 3) * SP });
// slot k (0..8) of a tray, for the tray kind 'h' (trays above and below the board) or 'v' (trays beside it); which = 'top' | 'bottom'
export function slotWorld(kind, which, k) {
  const a = (k - 4) * TRAY_PITCH, s = which === 'top' ? -1 : 1;
  return kind === 'h' ? { x: a, z: s * TRAY_OFF } : { x: s * TRAY_OFF, z: a };
}

// ------------------------------------------------------------------------------------------------ woods and men sets
export const WOOD3 = {
  oak: { face: ['#c9995a', '#a9773d'], lip: '#6d4322', grain: 'rgba(92,54,20,', pale: 'rgba(255,224,170,', groove: '#241206', rough: 0.52 },
  walnut: { face: ['#8d5d37', '#6d4426'], lip: '#3d2210', grain: 'rgba(30,14,4,', pale: 'rgba(230,170,120,', groove: '#120803', rough: 0.46 },
  ash: { face: ['#e6cf9f', '#cdb27c'], lip: '#9a7448', grain: 'rgba(130,96,52,', pale: 'rgba(255,246,222,', groove: '#3d2a14', rough: 0.55 },
};
export const SET3 = {
  boxwood: { a: '#ecd08e', b: '#4b2c19', ra: 0.42, rb: 0.36, ca: 0.25, cb: 0.55 },
  ivory: { a: '#f3ecd9', b: '#1b1a1f', ra: 0.3, rb: 0.2, ca: 0.45, cb: 0.9 },
};

// ------------------------------------------------------------------------------------------------ the board
function faceMaps(wd, size) {
  const W = size, k = W / (2 * HALF), px = (cm) => (cm + HALF) * k, K = WOOD3[wd] || WOOD3.oak, r = rnd(17);
  const c = canvas(W), x = c.getContext('2d'), b = canvas(W), y = b.getContext('2d'), ro = canvas(W), z = ro.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, W * 0.4); g.addColorStop(0, K.face[0]); g.addColorStop(1, K.face[1]); x.fillStyle = g; x.fillRect(0, 0, W, W);
  y.fillStyle = '#808080'; y.fillRect(0, 0, W, W); z.fillStyle = '#9a9a9a'; z.fillRect(0, 0, W, W);
  // plank-wide grain running along x, with the odd knot
  for (let i = 0; i < 520; i++) {
    const yy = r() * W, len = W * (0.15 + r() * 0.7), x0 = r() * W, amp = 2 + r() * 6, ph = r() * 6, a = 0.04 + r() * 0.13, lw = (0.5 + r() * 2.2) * (W / 1024);
    const col = r() < 0.7 ? K.grain : K.pale;
    for (const [cx, cv] of [[x, `${col}${a})`], [y, `rgba(${r() < 0.5 ? 40 : 200},${r() < 0.5 ? 40 : 200},${r() < 0.5 ? 40 : 200},${a * 0.8})`]]) {
      cx.strokeStyle = cv; cx.lineWidth = lw; cx.beginPath();
      for (let s = 0; s <= 10; s++) { const xx = x0 + (len * s) / 10, yv = yy + Math.sin(ph + s * 0.7) * amp; if (s) cx.lineTo(xx, yv); else cx.moveTo(xx, yv); }
      cx.stroke();
    }
  }
  for (let i = 0; i < 3; i++) { const kx = r() * W, ky = r() * W; for (let j = 5; j > 0; j--) { x.strokeStyle = `${K.grain}${0.05 + 0.03 * (6 - j)})`; x.lineWidth = 1.6 * (W / 1024); x.beginPath(); x.ellipse(kx, ky, 4 + j * 6, 2 + j * 3, 0, 0, 7); x.stroke(); } }
  // plank seams
  for (const sx of [-6.5, 6.5]) { const X = px(sx); x.fillStyle = 'rgba(20,8,0,0.55)'; x.fillRect(X - 1.2, 0, 2.4, W); y.fillStyle = '#303030'; y.fillRect(X - 1.6, 0, 3.2, W); }
  // the carved lines: a dark cut with a lit lower edge, in the colour map and the bump map
  const cut = (pts, closed, w = 0.5) => {
    const path = (cx, o = 0) => { cx.beginPath(); pts.forEach(([u, v], i) => { const X = px(u * SP) + o, Y = px(v * SP) + o; if (i) cx.lineTo(X, Y); else cx.moveTo(X, Y); }); if (closed) cx.closePath(); };
    x.lineJoin = 'round'; y.lineJoin = 'round';
    path(x, w * k * 0.32); x.strokeStyle = K.pale + '0.34)'; x.lineWidth = w * k * 0.9; x.stroke();
    path(x); x.strokeStyle = K.groove; x.lineWidth = w * k; x.stroke();
    path(x, -w * k * 0.1); x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = w * k * 0.4; x.stroke();
    path(y); y.strokeStyle = '#080808'; y.lineWidth = w * k * 1.1; y.stroke();
    path(z); z.strokeStyle = '#f0f0f0'; z.lineWidth = w * k; z.stroke();
  };
  for (const s of [3, 2, 1]) cut([[-s, -s], [s, -s], [s, s], [-s, s]], true);
  for (const [a, b2] of [[[0, -3], [0, -1]], [[0, 1], [0, 3]], [[-3, 0], [-1, 0]], [[1, 0], [3, 0]]]) cut([a, b2], false);
  // border band: two fine lines and a chip-carved row of triangles between them
  const bs = 3.58, bo = 3.98;
  cut([[-bs, -bs], [bs, -bs], [bs, bs], [-bs, bs]], true, 0.28); cut([[-bo, -bo], [bo, -bo], [bo, bo], [-bo, bo]], true, 0.28);
  const chip = (u, v, ang) => {
    const X = px(u * SP), Y = px(v * SP), s2 = 0.42 * SP * k;
    x.save(); x.translate(X, Y); x.rotate(ang); x.fillStyle = K.groove; x.beginPath(); x.moveTo(0, -s2 * 0.5); x.lineTo(s2 * 0.55, s2 * 0.5); x.lineTo(-s2 * 0.55, s2 * 0.5); x.closePath(); x.fill();
    x.strokeStyle = K.pale + '0.3)'; x.lineWidth = 1; x.stroke(); x.restore();
    y.save(); y.translate(X, Y); y.rotate(ang); y.fillStyle = '#101010'; y.beginPath(); y.moveTo(0, -s2 * 0.5); y.lineTo(s2 * 0.55, s2 * 0.5); y.lineTo(-s2 * 0.55, s2 * 0.5); y.closePath(); y.fill(); y.restore();
  };
  const mid = (bs + bo) / 2;
  for (let i = -3; i <= 3; i += 0.5) { chip(i, -mid, 0); chip(i, mid, Math.PI); chip(-mid, i, -Math.PI / 2); chip(mid, i, Math.PI / 2); }
  // the 24 sockets: a dark pit with a lit rim
  for (let i = 0; i < 24; i++) {
    const X = px(PT[i][0] * SP), Y = px((PT[i][1] - 3) * SP), R = 0.85 * k;
    const pg = x.createRadialGradient(X, Y, 1, X, Y, R); pg.addColorStop(0, 'rgba(8,3,0,0.95)'); pg.addColorStop(0.7, 'rgba(24,10,2,0.9)'); pg.addColorStop(1, 'rgba(24,10,2,0.2)');
    x.fillStyle = pg; x.beginPath(); x.arc(X, Y, R, 0, 7); x.fill();
    const bg = y.createRadialGradient(X, Y, 1, X, Y, R); bg.addColorStop(0, '#000'); bg.addColorStop(0.8, '#202020'); bg.addColorStop(1, '#808080'); y.fillStyle = bg; y.beginPath(); y.arc(X, Y, R, 0, 7); y.fill();
  }
  // a little wear: dark vignette toward the edges, pale scuffs
  const vg = x.createRadialGradient(W / 2, W / 2, W * 0.28, W / 2, W / 2, W * 0.72); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(34,14,2,0.38)'); x.fillStyle = vg; x.fillRect(0, 0, W, W);
  for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(255,236,200,${0.04 + r() * 0.07})`; x.lineWidth = 0.8; const X = r() * W, Y = r() * W; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + (r() - 0.5) * 60, Y + (r() - 0.5) * 20); x.stroke(); }
  return { map: tex(c), bump: tex(b, false), rough: tex(ro, false) };
}

export function buildBoard(wd, texSize = 1536) {
  const K = WOOD3[wd] || WOOD3.oak, g = new THREE.Group(), maps = faceMaps(wd, texSize);
  const lipMat = new THREE.MeshStandardMaterial({ color: K.lip, roughness: 0.5, metalness: 0.02 });
  const slab = new THREE.Mesh(roundedBox(HALF * 2, THICK, HALF * 2, 0.55, 6), lipMat); slab.position.y = THICK / 2; slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
  const faceMat = new THREE.MeshStandardMaterial({ map: maps.map, bumpMap: maps.bump, bumpScale: 1.6, roughnessMap: maps.rough, roughness: K.rough, metalness: 0.02 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry((HALF - 1.5) * 2, (HALF - 1.5) * 2), faceMat);
  // map covers the whole slab; the inset face plane takes the matching part (uv window)
  { const f = (HALF - 1.5) / HALF, uv = face.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + (uv.getX(i) - 0.5) * f, 0.5 + (uv.getY(i) - 0.5) * f); }
  face.rotation.x = -Math.PI / 2; face.position.y = TOP + 0.012; face.receiveShadow = true; g.add(face);
  // raised lip round the face (four bars) and a bevelled centre field: reads as a carved panel in a frame
  const lipH = 0.42, lw = 1.5, ll = HALF * 2;
  for (const [w, d, x, z] of [[ll, lw, 0, -(HALF - lw / 2)], [ll, lw, 0, HALF - lw / 2], [lw, ll - 2 * lw, -(HALF - lw / 2), 0], [lw, ll - 2 * lw, HALF - lw / 2, 0]]) {
    const m = new THREE.Mesh(roundedBox(w, lipH, d, 0.16, 3), lipMat); m.position.set(x, TOP + lipH / 2 - 0.02, z); m.castShadow = true; m.receiveShadow = true; g.add(m);
  }
  // brass rings round the sockets
  const ringG = new THREE.TorusGeometry(0.86, 0.1, 8, 28); ringG.rotateX(Math.PI / 2);
  const brass = new THREE.MeshStandardMaterial({ color: 0xd9a64a, metalness: 1, roughness: 0.3, envMapIntensity: 1.8 });
  const rings = new THREE.InstancedMesh(ringG, brass, 24), m4 = new THREE.Matrix4();
  for (let i = 0; i < 24; i++) { const p = pointWorld(i); rings.setMatrixAt(i, m4.makeTranslation(p.x, TOP + 0.06, p.z)); }
  rings.receiveShadow = true; g.add(rings);
  // brass corner studs on the lip
  const stud = new THREE.SphereGeometry(0.42, 12, 8); stud.scale(1, 0.55, 1);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const m = new THREE.Mesh(stud, brass); m.position.set(sx * (HALF - 0.9), TOP + lipH + 0.06, sz * (HALF - 0.9)); m.castShadow = true; g.add(m); }
  g.userData.dispose = () => { maps.map.dispose(); maps.bump.dispose(); maps.rough.dispose(); };
  return g;
}

// ------------------------------------------------------------------------------------------------ the men
export function manGeo() {
  // turned disc: chamfered foot, a waist, a bevelled top with two lathe rings and a shallow dish
  const R = MR, p = [[0, 0], [R - 0.28, 0], [R - 0.06, 0.06], [R, 0.22], [R, 0.58], [R - 0.08, 0.76], [R - 0.3, 0.88], [R - 0.34, MH - 0.02], [R - 0.5, MH], [R - 0.54, MH - 0.07], [R - 0.7, MH - 0.07], [R - 0.74, MH], [R - 0.9, MH], [R - 0.94, MH - 0.07], [R - 1.1, MH - 0.08], [0.45, MH - 0.16], [0, MH - 0.2]];
  return lathe(p, 56);
}
export function manMaterials(set) {
  const S = SET3[set] || SET3.boxwood;
  const mk = (col, rough, cc) => new THREE.MeshPhysicalMaterial({ color: new THREE.Color(col), roughness: rough, clearcoat: cc, clearcoatRoughness: 0.28, sheen: 0.3, sheenColor: new THREE.Color('#ffe9c0') });
  return { 0: mk(S.a, S.ra, S.ca), 1: mk(S.b, S.rb, S.cb) };
}
export function setManSet(m, set) {
  const S = SET3[set] || SET3.boxwood;
  m[0].color.set(S.a); m[0].roughness = S.ra; m[0].clearcoat = S.ca; m[1].color.set(S.b); m[1].roughness = S.rb; m[1].clearcoat = S.cb;
}

// ------------------------------------------------------------------------------------------------ trays
// A carved tray with nine round dishes. Built along local x (length), centred; the presenter rotates it for the 'v' arrangement.
export function buildTray(wd) {
  const K = WOOD3[wd] || WOOD3.oak, g = new THREE.Group(), len = 9 * TRAY_PITCH + 2.2;
  const wood = new THREE.MeshStandardMaterial({ color: K.lip, roughness: 0.5 });
  const body = new THREE.Mesh(roundedBox(len, TRAY_H, TRAY_D, 0.5, 5), wood); body.position.y = TRAY_H / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const brass = new THREE.MeshStandardMaterial({ color: 0xd9a64a, metalness: 1, roughness: 0.3, envMapIntensity: 1.8 });
  const inner = new THREE.MeshStandardMaterial({ color: new THREE.Color(K.groove).lerp(new THREE.Color('#000'), 0.1), roughness: 0.9 });
  const dishG = new THREE.CylinderGeometry(1.95, 1.95, 0.08, 36), ringG = new THREE.TorusGeometry(1.95, 0.08, 6, 36); ringG.rotateX(Math.PI / 2);
  for (let k = 0; k < 9; k++) {
    const x = (k - 4) * TRAY_PITCH;
    const d = new THREE.Mesh(dishG, inner); d.position.set(x, TRAY_H + 0.0, 0); d.receiveShadow = true; g.add(d);
    const r = new THREE.Mesh(ringG, brass); r.position.set(x, TRAY_H + 0.04, 0); g.add(r);
  }
  return g;
}

// ------------------------------------------------------------------------------------------------ the tavern
function plankTex() {
  const W = 1024, c = canvas(W), x = c.getContext('2d'), r = rnd(9), n = 6, pw = W / n;
  for (let i = 0; i < n; i++) {
    const l = 0.75 + r() * 0.4; x.fillStyle = `rgb(${Math.round(78 * l)},${Math.round(46 * l)},${Math.round(24 * l)})`; x.fillRect(i * pw, 0, pw, W);
    for (let k = 0; k < 60; k++) { x.strokeStyle = `rgba(${r() < 0.55 ? '24,10,2' : '170,116,70'},${0.05 + r() * 0.12})`; x.lineWidth = 1 + r() * 2.6; const xx = i * pw + r() * pw; x.beginPath(); x.moveTo(xx, 0); x.bezierCurveTo(xx + 6, W * 0.3, xx - 7, W * 0.6, xx + 2, W); x.stroke(); }
    x.fillStyle = 'rgba(8,3,0,0.8)'; x.fillRect(i * pw, 0, 3, W);
  }
  for (let j = 0; j < 14; j++) { x.fillStyle = 'rgba(0,0,0,0.12)'; x.beginPath(); x.ellipse(r() * W, r() * W, 20 + r() * 60, 8 + r() * 24, r() * 3, 0, 7); x.fill(); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function stoneTex() {
  const W = 1024, c = canvas(W, 512), x = c.getContext('2d'), r = rnd(5);
  x.fillStyle = '#2a2420'; x.fillRect(0, 0, W, 512);
  const rows = 8, rh = 512 / rows;
  for (let j = 0; j < rows; j++) {
    let X = -(r() * 120);
    while (X < W) {
      const bw = 110 + r() * 110, l = 0.7 + r() * 0.5, tint = r() < 0.3 ? [1.08, 0.98, 0.9] : [1, 1, 1];
      x.fillStyle = `rgb(${Math.round(78 * l * tint[0])},${Math.round(70 * l * tint[1])},${Math.round(64 * l * tint[2])})`; x.fillRect(X + 3, j * rh + 3, bw - 6, rh - 6);
      for (let k = 0; k < 14; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '20,16,12' : '150,136,120'},${0.06 + r() * 0.1})`; x.beginPath(); x.arc(X + r() * bw, j * rh + r() * rh, 2 + r() * 10, 0, 7); x.fill(); }
      X += bw;
    }
  }
  const t = tex(c); t.wrapS = THREE.RepeatWrapping; return t;
}

export function buildCandle() {
  const g = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: 0xcf9a45, metalness: 1, roughness: 0.28, envMapIntensity: 2 });
  const prof = [[0, 0], [4.6, 0], [4.8, 0.5], [4.2, 1.1], [2.4, 1.7], [1.2, 2.7], [1.0, 4.4], [1.9, 5.2], [1.1, 6.4], [0.9, 8.4], [1.7, 9.6], [1.2, 10.5], [3.0, 11.4], [3.3, 12.2], [0.2, 12.2]].map(([r, h]) => [r, h]);
  const stick = new THREE.Mesh(lathe(prof, 40), brass); stick.castShadow = true; stick.receiveShadow = true; g.add(stick);
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.45, 13, 24), new THREE.MeshStandardMaterial({ color: 0xf2e6c4, roughness: 0.6, emissive: 0x4a3410, emissiveIntensity: 0.25 }));
  wax.position.y = 12.2 + 6.5; wax.castShadow = true; g.add(wax);
  for (let i = 0; i < 3; i++) { const dr = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), wax.material); dr.scale.set(1, 2.4, 1); dr.position.set(Math.cos(i * 2.1) * 1.38, 24 - i * 1.7, Math.sin(i * 2.1) * 1.38); g.add(dr); }
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff1c0 })); flame.scale.set(0.75, 1.9, 0.75); flame.position.y = 26.2; g.add(flame);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('255,176,92', 0.65), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(30, 30, 1); halo.position.y = 26.4; g.add(halo);
  const light = new THREE.PointLight(0xffa050, 900, 260, 1.7); light.position.y = 27; g.add(light);
  g.userData = { flame, halo, light };
  return g;
}
export function buildTankard() {
  const g = new THREE.Group(), pewter = new THREE.MeshStandardMaterial({ color: 0xa9aaa6, metalness: 1, roughness: 0.38, envMapIntensity: 1.6 });
  const prof = [[0, 0], [4.4, 0], [4.5, 0.5], [4.1, 1], [3.9, 1.6], [3.7, 8], [3.9, 10], [4.2, 11.4], [4.3, 11.7], [3.5, 11.7], [3.4, 11.2], [0, 11.2]];
  const body = new THREE.Mesh(lathe(prof, 40), pewter); body.castShadow = true; body.receiveShadow = true; g.add(body);
  const foam = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 0.5, 24), new THREE.MeshStandardMaterial({ color: 0xe9d7a0, roughness: 0.85 })); foam.position.y = 10.8; g.add(foam);
  const h = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.45, 8, 20, Math.PI * 1.1), pewter); h.position.set(4.2, 6, 0); h.rotation.z = -Math.PI * 0.55; h.castShadow = true; g.add(h);
  return g;
}

export function buildTavern(scene) {
  const g = new THREE.Group();
  const pt = plankTex(); pt.repeat.set(2.2, 2.2);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.7, metalness: 0.02 }));
  table.rotation.x = -Math.PI / 2; table.receiveShadow = true; g.add(table);
  // back wall: stone with an arched niche, lit by the candles
  const st = stoneTex(); st.repeat.set(2.4, 1.4);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(420, 200), new THREE.MeshStandardMaterial({ map: st, roughness: 0.95 }));
  wall.position.set(0, 90, -150); g.add(wall);
  const arch = new THREE.Shape(); arch.moveTo(-34, 0); arch.lineTo(-34, 56); arch.absarc(0, 56, 34, Math.PI, 0, true); arch.lineTo(34, 0); arch.lineTo(-34, 0);
  const niche = new THREE.Mesh(new THREE.ShapeGeometry(arch, 24), new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 1 })); niche.position.set(0, 0, -149); g.add(niche);
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-40, 0), new THREE.Vector2(40, 0), new THREE.Vector2(40, 102), new THREE.Vector2(-40, 102)]), { depth: 3, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0x4a423a, roughness: 0.9 }));
  frame.geometry.dispose(); frame.visible = false;
  const ringG = new THREE.TorusGeometry(37, 3.4, 8, 40, Math.PI); const ring = new THREE.Mesh(ringG, new THREE.MeshStandardMaterial({ color: 0x5a5148, roughness: 0.9 })); ring.position.set(0, 56, -148); g.add(ring);
  for (const sx of [-1, 1]) { const col = new THREE.Mesh(new THREE.BoxGeometry(6.8, 56, 6.8), ring.material); col.position.set(sx * 37, 28, -147); g.add(col); }
  // a barrel to the right, a stool to the left (silhouettes in the dark)
  const barrelP = [[0, 0], [14, 0], [16, 8], [17, 20], [16, 32], [14, 40], [0, 40]];
  const barrel = new THREE.Mesh(lathe(barrelP, 28), new THREE.MeshStandardMaterial({ color: 0x4a2c16, roughness: 0.8 })); barrel.position.set(78, 0, -96); barrel.castShadow = true; g.add(barrel);
  for (const y of [8, 20, 32]) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(16.4 - Math.abs(y - 20) * 0.04, 0.6, 6, 28), new THREE.MeshStandardMaterial({ color: 0x2b2622, metalness: 0.8, roughness: 0.5 })); hoop.rotation.x = Math.PI / 2; hoop.position.set(78, y, -96); g.add(hoop); }
  const candles = [buildCandle(), buildCandle()];
  candles[0].position.set(-34, 0, -30); candles[1].position.set(36, 0, -34); candles.forEach((c) => g.add(c));
  const tk = [buildTankard(), buildTankard()]; tk[0].position.set(-36, 0, 32); tk[0].rotation.y = 0.5; tk[1].position.set(40, 0, 26); tk[1].rotation.y = -0.8; tk.forEach((t) => g.add(t));
  // dust motes drifting in the candle light
  const dp = new Float32Array(60 * 3), r = rnd(3);
  for (let i = 0; i < 60; i++) { dp[i * 3] = (r() - 0.5) * 120; dp[i * 3 + 1] = 4 + r() * 50; dp[i * 3 + 2] = (r() - 0.5) * 100; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ map: radialTex('255,224,170', 0.9), size: 0.9, transparent: true, depthWrite: false, opacity: 0.6, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  g.add(dust);
  g.userData = { candles, dust, base: dp.slice() };
  scene.add(g); return g;
}

export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0x7a6a58, 0x2a1a0e, 0.55); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffcf96, 2.3); sun.position.set(-40, 90, 50);
  sun.shadow.camera.left = -34; sun.shadow.camera.right = 34; sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34; sun.shadow.camera.near = 20; sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4;
  scene.add(sun); scene.add(sun.target);
  const rim = new THREE.DirectionalLight(0xffa860, 0.7); rim.position.set(60, 40, -120); scene.add(rim);
  return { hemi, sun, rim };
}

// Disc-flip 3D models: a walnut game tray with a baize mat and a brass cup, translucent winks and squidgers (acrylic, bone, horn),
// and a Victorian club-room still life (oil lamp, tea cup, tin of spare winks, books, wallpaper wall). Pure scene construction.
// Units: 1 = 1 cm. World (sim) units map at S = 0.06 cm per unit: a wink (radius 15) is 1.8 cm across, the mat 36 x 54 cm.
// The mat's world (x, y) is scene (X, Z) = ((x - 300) S, (y - 450) S); felt top is at FELT_Y.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { paintFeltCanvas } from '../src/art.js';

export const S = 0.06;
export const MW = 600 * S, MH = 900 * S, FRAME = 46 * S;
export const TRAY_H = 1.0, FELT_T = 0.25, FELT_Y = TRAY_H + FELT_T + 0.04;
export const POT_R = 32 * S, WINK_R = 15 * S, WINK_T = 0.3;
export const SQ_R = [25 * S, 33 * S, 43 * S];
const TAU = Math.PI * 2;
export const wx = (x) => (x - 300) * S;
export const wz = (y) => (y - 450) * S;

const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
export const canvasTex = (c, { srgb = true, repeat, aniso = 8 } = {}) => {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
};
export const blobCanvas = (rgb = '0,0,0', a = 0.6, size = 128) => {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.55, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
};
export const ringCanvas = (rgb = '255,255,255', size = 128, inner = 0.7) => {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, size * 0.5 * inner * 0.75, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(inner, `rgba(${rgb},0.95)`); g.addColorStop(Math.min(0.97, inner + 0.16), `rgba(${rgb},0.35)`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
};

// ------------------------------------------------------------------------------------------------ tray, mat, cup
const rrShape = (w, h, r) => {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
};
const withHole = (shape, r) => { const h = new THREE.Path(); h.absarc(0, 0, r, 0, TAU, true); shape.holes.push(h); return shape; };
// extruded rounded rect (optionally with the cup hole), rising from y0; UVs span the shape 0..1
function plate(w, h, rad, depth, bevel, hole, y0, segs = 5) {
  const sh = rrShape(w, h, rad); if (hole) withHole(sh, hole);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: segs });
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
  g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); g.computeVertexNormals();
  return g;
}

let feltTex = null;
export function buildTray(quality = 1) {
  const g = new THREE.Group();
  const TW = MW + 2 * FRAME, TH = MH + 2 * FRAME;
  // walnut tray (with the cup well cut through)
  const trayMat = B.material('darkWood', { color: '#4a2a17', color2: '#6b4026', repeat: [3, 4], seed: 5 });
  const tray = new THREE.Mesh(plate(TW, TH, 3.2, TRAY_H - 0.1, 0.1, POT_R + 0.02, 0), trayMat);
  tray.castShadow = true; tray.receiveShadow = true; g.add(tray);
  // brass inlay line round the mat
  const brassM = B.material('brass', { envIntensity: 1.6 });
  const strip = new THREE.Mesh(plate(MW + 1.0, MH + 1.0, 1.2, 0.18, 0.04, 0, TRAY_H - 0.1), brassM);
  // hollow the strip: a ring made from outer shape with the inner as a hole
  { const sh = rrShape(MW + 1.1, MH + 1.1, 1.25), hole = rrShape(MW, MH, 0.9); sh.holes.push(new THREE.Path(hole.getPoints(24)));
    const gg = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 6 });
    gg.rotateX(-Math.PI / 2); gg.translate(0, TRAY_H - 0.12, 0); strip.geometry.dispose(); strip.geometry = gg; }
  strip.castShadow = true; strip.receiveShadow = true; g.add(strip);
  // baize
  feltTex = canvasTex(paintFeltCanvas(quality > 0.6 ? 1.4 : 0.9));
  const fm = new THREE.MeshStandardMaterial({ map: feltTex, roughness: 1, metalness: 0, bumpMap: feltTex, bumpScale: 0.6 });
  const felt = new THREE.Mesh(plate(MW, MH, 0.9, FELT_T, 0.04, POT_R, TRAY_H), fm);
  felt.receiveShadow = true; felt.castShadow = false; g.add(felt);
  // the cup: a brass collar proud of the felt, a lined well below
  const collar = new THREE.Mesh(B.lathe([[POT_R + 0.02, -0.5], [POT_R + 0.02, 0.1], [POT_R + 0.1, 0.19], [POT_R + 0.3, 0.24], [POT_R + 0.52, 0.2], [POT_R + 0.6, 0.1], [POT_R + 0.6, -0.5]], 56), brassM);
  collar.position.y = FELT_Y - 0.04; collar.castShadow = true; collar.receiveShadow = true; g.add(collar);
  const wellM = new THREE.MeshStandardMaterial({ color: '#7a5418', metalness: 0.85, roughness: 0.45, side: THREE.DoubleSide });
  brassM.side = THREE.DoubleSide;
  const well = new THREE.Mesh(new THREE.CylinderGeometry(POT_R, POT_R - 0.05, FELT_Y - 0.02, 40, 1, true), wellM);
  well.position.y = (FELT_Y - 0.02) / 2 + 0.02; well.receiveShadow = true; g.add(well);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(POT_R, 40), new THREE.MeshStandardMaterial({ color: '#241408', roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.09; floor.receiveShadow = true; g.add(floor);
  // a soft rim glow ring used for a pot flash
  const flash = new THREE.Mesh(new THREE.RingGeometry(POT_R + 0.1, POT_R + 0.9, 48), new THREE.MeshBasicMaterial({ color: '#ffe9a0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  flash.rotation.x = -Math.PI / 2; flash.position.y = FELT_Y + 0.22; g.add(flash);
  g.userData = { flash, feltTex, dispose() { feltTex.dispose(); fm.dispose(); } };
  return g;
}

// ------------------------------------------------------------------------------------------------ winks and squidgers
export const WINK_COL = [[['#ffd065', '#f59a00'], ['#ff8a63', '#e03a1a']], [['#6fa8ff', '#1f58e0'], ['#5ee6cf', '#0f9f8c']]];
const winkProfile = () => {
  const R = WINK_R, T = WINK_T;
  return [[0, 0], [R * 0.78, 0], [R * 0.93, T * 0.08], [R * 1.0, T * 0.3], [R * 0.99, T * 0.62], [R * 0.92, T * 0.86], [R * 0.78, T * 0.97], [R * 0.58, T * 1.0], [R * 0.38, T * 0.94], [R * 0.2, T * 0.9], [0, T * 0.89]];
};
let winkGeo = null;
const winkMats = {};
function winkMat(side, tone, glass) {
  const k = `${side}${tone}${glass ? 'g' : 'o'}`; if (winkMats[k]) return winkMats[k];
  const [c0, c1] = WINK_COL[side][tone];
  // acrylic: saturated, glossy, a little light of its own so the colour glows through the dark felt (no transmission pass: cheap)
  const m = new THREE.MeshPhysicalMaterial({
    color: c1, roughness: 0.2, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.55,
    emissive: c0, emissiveIntensity: 0.5, ior: 1.46, specularIntensity: 0.6,
  });
  void glass; void c1;
  winkMats[k] = m; return m;
}
export function makeWink(side, tone, glass = true) {
  if (!winkGeo) winkGeo = B.lathe(winkProfile(), 40);
  const g = new THREE.Group(), body = new THREE.Mesh(winkGeo, winkMat(side, tone, glass));
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  const mk = new THREE.MeshStandardMaterial({ color: '#fff4d8', roughness: 0.35, metalness: 0.1, emissive: '#fff0c0', emissiveIntensity: 0.18 });
  const top = WINK_T * 0.895, R = WINK_R;
  if (side === 0) { const d = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.2, R * 0.22, 0.04, 20), mk); d.position.y = top + 0.012; g.add(d); }
  else { const r = new THREE.Mesh(new THREE.TorusGeometry(R * 0.25, R * 0.055, 8, 28), mk); r.rotation.x = Math.PI / 2; r.position.y = top + 0.016; g.add(r); }
  g.userData.body = body;
  return g;
}

const SQ_STYLE = [
  { color: '#f2e8cf', color2: '#cdbb92', name: 'bone', trans: 0.0 },     // Potter: bone
  { color: '#e3a62c', color2: '#8a4d06', name: 'horn', trans: 0.45 },    // Squidger: amber horn
  { color: '#4fa9c4', color2: '#12475e', name: 'smoke', trans: 0.5 },    // Bomber: smoky acrylic
];
const sqGeo = [];
export function makeSquidger(id) {
  const R = SQ_R[id], T = 0.46;
  if (!sqGeo[id]) sqGeo[id] = B.lathe([[0, 0], [R * 0.9, 0], [R * 0.97, T * 0.1], [R, T * 0.3], [R * 1.0, T * 0.6], [R * 0.95, T * 0.88], [R * 0.82, T], [R * 0.55, T * 1.12], [R * 0.25, T * 1.2], [0, T * 1.22]], 56);
  const st = SQ_STYLE[id];
  const m = new THREE.MeshPhysicalMaterial({
    color: st.color2, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.55, emissive: st.color, emissiveIntensity: 0.45, specularIntensity: 0.6,
  });
  const g = new THREE.Group(), body = new THREE.Mesh(sqGeo[id], m);
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  const groove = new THREE.Mesh(new THREE.TorusGeometry(R * 0.62, 0.035, 6, 40), new THREE.MeshStandardMaterial({ color: st.color2, roughness: 0.5 }));
  groove.rotation.x = Math.PI / 2; groove.position.y = T * 1.1; g.add(groove);
  return g;
}

// ------------------------------------------------------------------------------------------------ the room
function wallCanvas() {
  const w = 1024, h = 1024, c = cv(w, h), x = c.getContext('2d'), rnd = lcg(9);
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3a1218'); g.addColorStop(0.55, '#4e1a22'); g.addColorStop(1, '#2a0c10'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  // damask: repeated medallions on diagonal stripes
  x.strokeStyle = 'rgba(214,170,90,0.18)'; x.fillStyle = 'rgba(214,170,90,0.12)'; x.lineWidth = 3;
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const cx = (i + (j % 2) * 0.5) * 256 + 128, cy = j * 256 + 128;
    x.beginPath(); x.moveTo(cx, cy - 70); x.bezierCurveTo(cx + 60, cy - 30, cx + 60, cy + 30, cx, cy + 70); x.bezierCurveTo(cx - 60, cy + 30, cx - 60, cy - 30, cx, cy - 70); x.fill(); x.stroke();
    x.beginPath(); x.arc(cx, cy, 14, 0, TAU); x.fill();
  }
  for (let k = 0; k < 600; k++) { x.fillStyle = `rgba(0,0,0,${rnd() * 0.06})`; x.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 6, 2); }
  return c;
}
function lampGlassCanvas() {
  const c = cv(128, 256), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#fff3c8'); g.addColorStop(0.5, '#ffd88a'); g.addColorStop(1, '#ffb050'); x.fillStyle = g; x.fillRect(0, 0, 128, 256);
  return c;
}

export function buildRoom({ quality = 1 } = {}) {
  const g = new THREE.Group();
  // table: walnut boards running left-right
  const tt = B.woodCanvas(1024, '#5a3820', '#8a5a34', 11, { lines: 90, knots: 1 }).map;
  const table = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshPhysicalMaterial({ map: canvasTex(tt, { repeat: [4, 4] }), roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.35, color: '#a88a70' }));
  table.rotation.x = -Math.PI / 2; table.position.y = -0.02; table.receiveShadow = true; g.add(table);
  // lace runner under the tray: soft cream cloth
  const cloth = new THREE.Mesh(B.slab(60, 78, 0.06, 1.4, 0.03), B.material('cloth', { color: '#6b1620', color2: '#8a2230', repeat: [20, 26], size: 256 }));
  cloth.position.set(0, -0.0, 0); cloth.receiveShadow = true; g.add(cloth);
  const trim = new THREE.Mesh(B.slab(60.8, 78.8, 0.05, 1.6, 0.02), new THREE.MeshStandardMaterial({ color: '#c9a24c', roughness: 0.45, metalness: 0.7 }));
  trim.position.set(0, -0.015, 0); g.add(trim);
  cloth.position.y = 0; // the tray (1 cm) sits on the runner; shift the tray via the group in the presenter instead

  // wall
  const wallTex = canvasTex(wallCanvas(), { repeat: [5, 2.2] });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(220, 90), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9, color: '#a08080' }));
  wall.position.set(0, 44, -74); g.add(wall);
  const dado = new THREE.Mesh(new THREE.BoxGeometry(220, 22, 1.5), B.material('darkWood', { color: '#2c1810', color2: '#47291a', repeat: [10, 1], seed: 3 }));
  dado.position.set(0, 11, -73.2); dado.receiveShadow = true; g.add(dado);
  const rail = new THREE.Mesh(B.roundedBox(220, 1.6, 2.4, 0.4), B.material('brass', {})); rail.position.set(0, 22.6, -72.6); g.add(rail);
  // framed pictures glowing softly
  const frames = [];
  for (const [fx, fy, fw, fh, col] of [[-26, 46, 22, 28, '#6a8fa8'], [4, 50, 30, 20, '#a8885a'], [34, 44, 18, 26, '#7a9a72']]) {
    const f = new THREE.Mesh(B.roundedBox(fw + 3, fh + 3, 1.6, 0.5), new THREE.MeshStandardMaterial({ color: '#b08838', metalness: 0.8, roughness: 0.4 }));
    f.position.set(fx, fy, -72.4); g.add(f);
    const pc = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, emissive: col, emissiveIntensity: 0.12 }));
    pc.position.set(fx, fy, -71.5); g.add(pc); frames.push(pc);
  }

  // oil lamp (brass font, glass chimney, glowing flame) back-left on the table
  const lamp = new THREE.Group(); lamp.position.set(-40, 0, -60);
  const brass = B.material('brass', { envIntensity: 1.5 });
  lamp.add(B.piece([[0, 0], [5.4, 0], [5.8, 0.6], [5.0, 1.6], [2.4, 2.4], [1.6, 5], [2.4, 6.2], [4.8, 8.4], [5.2, 10.2], [3.8, 11.4], [0, 11.4]], brass));
  const chim = new THREE.Mesh(B.lathe([[1.9, 11.4], [3.0, 14], [2.6, 20], [2.0, 26], [2.2, 31], [2.0, 31.4]], 28), new THREE.MeshBasicMaterial({ map: canvasTex(lampGlassCanvas()), color: '#ffe2a0', transparent: true, opacity: 0.68, side: THREE.DoubleSide, toneMapped: false, fog: false }));
  lamp.add(chim);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(blobCanvas('255,214,130', 1, 128)), color: '#ffcf80', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  flame.position.y = 16; flame.scale.set(22, 34, 1); lamp.add(flame);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(blobCanvas('255,190,110', 0.9, 128)), color: '#ffb868', transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.position.y = 16; halo.scale.set(70, 70, 1); lamp.add(halo);
  g.add(lamp);
  const lampLight = new THREE.PointLight(0xffc27a, 260, 140, 1.6); lampLight.position.set(-34, 18, -50); g.add(lampLight);

  // tea cup + saucer, stack of books, tin of spare winks
  const china = new THREE.MeshPhysicalMaterial({ color: '#f1ece0', roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.1 });
  const tea = new THREE.Group(); tea.position.set(37, 0, -20); tea.rotation.y = 0.5;
  tea.add(B.piece([[0, 0], [4.2, 0], [6.4, 0.4], [7.2, 0.9], [4.6, 0.8], [3.2, 0.5], [0, 0.5]], china));
  const cup = B.piece([[0, 0.5], [1.6, 0.5], [2.8, 0.9], [3.5, 2.8], [3.8, 5.0], [3.6, 5.2], [3.4, 5.0], [3.0, 2.8], [2.4, 1.2], [0, 1.1]], china); cup.position.y = 0.2; tea.add(cup);
  const teaLiq = new THREE.Mesh(new THREE.CircleGeometry(3.2, 28), new THREE.MeshStandardMaterial({ color: '#3a1d0a', roughness: 0.15, metalness: 0.2 })); teaLiq.rotation.x = -Math.PI / 2; teaLiq.position.y = 4.4; tea.add(teaLiq);
  const hnd = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.3, 8, 18, Math.PI * 1.2), china); hnd.position.set(3.7, 3.2, 0); hnd.rotation.z = -Math.PI * 0.6; tea.add(hnd);
  g.add(tea);
  const books = new THREE.Group(); books.position.set(41, 0, -36); books.rotation.y = -0.35;
  [['#5a1a1a', 12, 2.4, 17], ['#1c3a2c', 11, 2.0, 16], ['#2a2a52', 12.4, 1.8, 17.4]].forEach(([c, w, h, d], i, arr) => {
    const bk = new THREE.Mesh(B.roundedBox(w, h, d, 0.25), new THREE.MeshStandardMaterial({ color: c, roughness: 0.65 }));
    bk.position.set(0.4 * i, arr.slice(0, i).reduce((a, b) => a + b[2], 0) + h / 2, 0); bk.rotation.y = 0.12 * i; bk.castShadow = true; bk.receiveShadow = true; books.add(bk);
    const pages = new THREE.Mesh(new THREE.BoxGeometry(w - 0.5, h - 0.5, d - 0.6), new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.9 })); pages.position.copy(bk.position); pages.position.x += 0.35; pages.rotation.y = bk.rotation.y; books.add(pages);
  });
  g.add(books);
  const tin = new THREE.Group(); tin.position.set(-37, 0, -8);
  tin.add(B.piece([[0, 0], [5.6, 0], [5.8, 0.3], [5.8, 3.6], [5.5, 3.9], [5.2, 3.9], [5.2, 3.7], [0, 3.7]], new THREE.MeshStandardMaterial({ color: '#9a1c1c', roughness: 0.4, metalness: 0.35 })));
  for (let i = 0; i < 7; i++) { const w = makeWink(i % 2, (i >> 1) % 2, false); const a = i * 2.3; w.position.set(Math.cos(a) * 2.6 * (i % 3) * 0.55, 3.7 + (i % 3) * 0.12, Math.sin(a) * 2.6 * (i % 3) * 0.55); w.rotation.set(0.08 * Math.sin(i), a, 0.08 * Math.cos(i)); tin.add(w); }
  g.add(tin);

  // dust motes in the lamp light
  const N = quality > 0.6 ? 90 : 40, pos = new Float32Array(N * 3), seed = lcg(77);
  for (let i = 0; i < N; i++) { pos[i * 3] = -50 + seed() * 70; pos[i * 3 + 1] = 2 + seed() * 40; pos[i * 3 + 2] = -50 + seed() * 50; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({ map: canvasTex(blobCanvas('255,226,170', 1, 64)), size: 0.5, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false }));
  dust.frustumCulled = false; g.add(dust);

  return {
    group: g, lamp, tin,
    update(t, calm, dt) {
      const fl = calm ? 0 : 0.5 * Math.sin(t * 7.1) * Math.sin(t * 2.3 + 1) + 0.3 * Math.sin(t * 13.3);
      flame.material.opacity = 0.9 + 0.08 * fl; flame.scale.set(22 + fl * 1.2, 34 + fl * 3, 1); halo.material.opacity = 0.38 + 0.04 * fl;
      lampLight.intensity = 260 * (1 + 0.05 * fl);
      if (!calm) {
        const a = pg.attributes.position;
        for (let i = 0; i < N; i++) { a.array[i * 3 + 1] += dt * (0.6 + (i % 5) * 0.25); a.array[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.8; if (a.array[i * 3 + 1] > 46) a.array[i * 3 + 1] = 2; }
        a.needsUpdate = true;
      }
      return fl;
    },
  };
}

// Amidakuji 3D models (pure construction, no game state). World units = the 2D layer's virtual units (x right, y UP, z toward the
// camera, the paper plane is z = 0), so geometry recorded by art.js lines up with the transparent 2D canvas on top.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';

const TAU = Math.PI * 2;
const hash = (n) => { const s = Math.sin(n * 127.1 + 3.7) * 43758.5453; return s - Math.floor(s); };
const col = (c) => new THREE.Color(c);
export const lampCol = (LAMP, i) => LAMP[((i % LAMP.length) + LAMP.length) % LAMP.length];

function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, { repeat, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
export const glowTexture = (() => { let t = null; return () => {
  if (t) return t;
  const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(0.6, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); t = tex(c); return t;
}; })();
export function ringTexture(inner = 0.62) {
  const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 64 * inner * 0.8, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(inner + 0.05, 'rgba(255,255,255,0.95)'); g.addColorStop(Math.min(0.98, inner + 0.2), 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c);
}

// ---- paper (washi) with long fibres, tinted by the look ---------------------------------------------------------------------------------
export function paperTexture(base, seed = 5) {
  const S = 1024, c = canvas(S), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, S, S);
  const b = canvas(S), bx = b.getContext('2d'); bx.fillStyle = '#808080'; bx.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) {
    const px = hash(i + seed) * S, py = hash(i * 1.7 + seed) * S, a = hash(i * 2.3 + seed) * TAU, l = 6 + hash(i * 3.1) * 26, light = hash(i * 5.3) < 0.5;
    x.strokeStyle = light ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'; x.lineWidth = 0.7 + hash(i * 7.7) * 1.1;
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + 3, py + Math.sin(a) * l * 0.5 - 3, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
    bx.strokeStyle = light ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.22)'; bx.lineWidth = 1; bx.beginPath(); bx.moveTo(px, py); bx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); bx.stroke();
  }
  for (let i = 0; i < 5000; i++) { x.fillStyle = hash(i) < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; x.fillRect(hash(i * 1.3) * S, hash(i * 2.9) * S, 2, 2); }
  return { map: tex(c, { repeat: [1, 1] }), bump: tex(b, { srgb: false, repeat: [1, 1] }) };
}

// ---- shoji wall: warm paper panels behind a kumiko lattice -------------------------------------------------------------------------
export function shojiTexture(paper, wood, cols = 6, rows = 4) {
  const S = 1024, c = canvas(S), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, paper); g.addColorStop(1, paper); x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) { x.fillStyle = hash(i) < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; x.fillRect(hash(i * 1.3) * S, hash(i * 2.9) * S, 2 + hash(i * 4) * 6, 1); }
  x.fillStyle = wood;
  const cw = S / cols, ch = S / rows, t = S * 0.014;
  for (let i = 0; i <= cols; i++) x.fillRect(i * cw - t / 2, 0, t, S);
  for (let j = 0; j <= rows; j++) x.fillRect(0, j * ch - t / 2, S, t);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {   // fine kumiko sub-lattice in each panel
    x.fillStyle = wood; x.globalAlpha = 0.55;
    for (let k = 1; k < 3; k++) { x.fillRect(i * cw + (cw * k) / 3 - t * 0.25, j * ch, t * 0.5, ch); }
    x.fillRect(i * cw, j * ch + ch * 0.5 - t * 0.25, cw, t * 0.5);
    x.globalAlpha = 1;
  }
  return tex(c);
}

// ---- lantern (chochin) ------------------------------------------------------------------------------------------------------------------
const lanternGeo = (() => { let g = null; return () => {
  if (g) return g;
  const N = 40, prof = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, y = -1.06 + 2.12 * u, bulge = Math.pow(Math.sin(Math.PI * u), 0.8);
    let r = 0.46 + 0.5 * bulge; r *= 1 - 0.04 * (0.5 - 0.5 * Math.cos(u * TAU * 7));   // seven bamboo ribs
    prof.push([r, y]);
  }
  g = B.lathe(prof, 40); return g;
}; })();
function lanternPaper(c) {   // vertical gradient with dark rib lines (u across, v along)
  const S = 256, cv = canvas(S), x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, c[2]); g.addColorStop(0.5, c[0]); g.addColorStop(1, c[2]);
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 1.5;
  for (let k = 0; k < 7; k++) { const y = ((k + 0.5) / 7) * S; x.beginPath(); x.moveTo(0, y); x.lineTo(S, y); x.stroke(); }
  for (let i = 0; i < 8; i++) { x.strokeStyle = 'rgba(255,255,255,0.10)'; x.beginPath(); x.moveTo((i / 8) * S, 0); x.lineTo((i / 8) * S, S); x.stroke(); }
  return tex(cv);
}
const capMat = () => B.material('lacquer', { color: '#1b0f0a', color2: '#1b0f0a', roughness: 0.25 });
export function makeLantern(LAMP, colorIdx) {
  const c = lampCol(LAMP, colorIdx), g = new THREE.Group(), pivot = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ map: lanternPaper(c), color: 0xffffff, emissive: col(c[1]), emissiveMap: null, emissiveIntensity: 0.55, roughness: 0.62, metalness: 0 });
  const body = new THREE.Mesh(lanternGeo(), bodyMat); body.castShadow = true;
  const cm = capMat();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.54, 0.2, 24), cm), bot = top.clone();
  top.position.y = 1.16; bot.position.y = -1.16; top.castShadow = bot.castShadow = true;
  const knob = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 8, 16), B.material('brass')); knob.position.y = 1.34;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), new THREE.MeshStandardMaterial({ color: 0x1b0f0a, roughness: 0.8 })); cord.name = 'cord';
  const tas = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xf3d27a, roughness: 0.5, metalness: 0.4 })); tas.position.y = -1.5; tas.castShadow = true;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: col(c[0]), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.scale.setScalar(4.6); halo.position.z = -0.2; halo.name = 'halo';
  pivot.add(body, top, bot, knob, cord, tas);
  g.add(halo, pivot); g.userData = { pivot, body, cord, halo, bodyMat, color: colorIdx };
  return g;
}

// ---- prize bowl: lacquer body, coloured band, gold rim, a heaped sweet ------------------------------------------------------------------
const bowlGeo = (() => { let g = null; return () => {
  if (g) return g;
  g = B.lathe([[0, -0.8], [0.44, -0.8], [0.46, -0.72], [0.58, -0.7], [0.62, -0.62], [0.86, -0.4], [1.0, -0.14], [1.05, 0], [1.0, 0], [0.9, -0.12], [0.5, -0.3], [0, -0.34]], 44);
  return g;
}; })();
const bandGeo = (() => { let g = null; return () => (g ??= B.lathe([[0.74, -0.52], [0.9, -0.36], [1.012, -0.2], [1.03, -0.12], [1.02, -0.12], [0.995, -0.22], [0.88, -0.38], [0.72, -0.5]], 44)); })();
export function makeBowl(LAMP, colorIdx) {
  const c = lampCol(LAMP, colorIdx), g = new THREE.Group();
  const body = new THREE.Mesh(bowlGeo(), new THREE.MeshPhysicalMaterial({ color: 0x2a0f0a, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2 }));
  body.castShadow = body.receiveShadow = true;
  const band = new THREE.Mesh(bandGeo(), new THREE.MeshPhysicalMaterial({ color: col(c[1]), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.045, 10, 48), B.material('brass')); rim.rotation.x = Math.PI / 2; rim.position.y = 0;
  const sweet = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 16), new THREE.MeshStandardMaterial({ color: col(c[0]), roughness: 0.55, emissive: col(c[1]), emissiveIntensity: 0.1 }));
  sweet.scale.set(1, 0.72, 1); sweet.position.y = -0.08; sweet.castShadow = true;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd45a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  glow.scale.setScalar(5); glow.position.set(0, 0.2, -0.3); glow.name = 'glow';
  g.add(body, band, rim, sweet, glow); g.userData = { band, sweet, glow, body, color: colorIdx };
  return g;
}

// ---- brush (rung drawing) ---------------------------------------------------------------------------------------------------------------
export function makeBrush() {
  const g = new THREE.Group();
  const h = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.6, 120, 12), B.material('lacquer', { color: '#7a1a12', color2: '#7a1a12' })); h.position.y = 62;
  const ferr = new THREE.Mesh(new THREE.CylinderGeometry(4, 3.2, 14, 12), B.material('brass')); ferr.position.y = 0;
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 4.2, 22, 12), new THREE.MeshStandardMaterial({ color: 0x120a08, roughness: 0.8 })); tip.position.y = -14;
  g.add(h, ferr, tip); g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---- the room: shoji wall with pillars, beam, a hanging andon behind -------------------------------------------------------------------
export function buildRoom(T, W, H) {
  const g = new THREE.Group(); g.name = 'room';
  const S = 1.9, ww = W * S, hh = H * S, z = -300;
  const dark = T.dark;
  const paper = dark ? (T.bg0 === '#4a1a14' ? '#9a6440' : '#5c679c') : '#fff6e2', wood = dark ? '#150d08' : '#4a2f1b';
  const shojiMap = shojiTexture(paper, wood, 7, 5);
  const wallMat = new THREE.MeshStandardMaterial({ map: shojiMap, emissive: col(paper), emissiveMap: shojiMap, emissiveIntensity: dark ? 0.2 : 0.28, roughness: 0.9 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), wallMat); wall.position.z = z; wall.receiveShadow = true; g.add(wall);
  // dark-wood pillars + beam closer to the camera (parallax)
  const woodM = B.material('darkWood', { repeat: [1, 6], size: 512 });
  const pw = Math.max(26, W * 0.055);
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(B.roundedBox(pw, hh * 0.9, pw * 0.9, pw * 0.14, 3), woodM); p.position.set(sx * (W * 0.5 + pw * 0.2), 0, -150); p.castShadow = true; p.receiveShadow = true; g.add(p);
  }
  const beam = new THREE.Mesh(B.roundedBox(W * 1.25, pw * 0.9, pw, pw * 0.14, 3), B.material('darkWood', { repeat: [6, 1], size: 512 })); beam.position.set(0, H * 0.5 - pw * 0.15, -150); beam.castShadow = true; g.add(beam);
  // tatami floor strip receding at the very bottom (lit grass-green mats)
  const tat = canvas(512, 256), x = tat.getContext('2d');
  x.fillStyle = dark ? '#6a6a3a' : '#c8c58a'; x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 1800; i++) { x.fillStyle = hash(i) < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'; x.fillRect(hash(i * 1.7) * 512, hash(i * 2.9) * 256, 1, 8); }
  x.fillStyle = '#1a1208'; x.fillRect(0, 126, 512, 4); x.fillRect(254, 0, 4, 126); x.fillRect(120, 130, 4, 126);
  const tt = tex(tat, { repeat: [3, 1] });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ww, 420), new THREE.MeshStandardMaterial({ map: tt, roughness: 0.95, color: dark ? 0x9a9a9a : 0xffffff }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -H * 0.5 - 4, -90); floor.receiveShadow = true; g.add(floor);
  g.userData = { wallMat };
  return g;
}

// ---- scroll (kakejiku): brocade border, washi paper, rollers with knobs -----------------------------------------------------------------
export function buildScroll(T, geo) {
  const g = new THREE.Group(), { xs, sp, tr, yTop, yBot } = geo;
  const x0 = xs[0] - sp * 0.62, x1 = xs[xs.length - 1] + sp * 0.62, w = x1 - x0, h = (yBot + tr * 0.12) - (yTop - tr * 0.5);
  const pm = paperTexture(T.dark ? mix(T.paper, '#ffffff', 0.04) : T.paper);
  const paperMat = new THREE.MeshStandardMaterial({ map: pm.map, bumpMap: pm.bump, bumpScale: 0.6, roughness: 0.92, emissive: col(T.paper), emissiveIntensity: T.dark ? 0.14 : 0.0 });
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(w, h), paperMat); paper.receiveShadow = true; paper.position.z = 0.2;
  const bw = Math.max(10, sp * 0.16);
  const brocade = new THREE.Mesh(B.roundedBox(w + bw * 2, h + bw * 2, 5, 3, 2), new THREE.MeshStandardMaterial({ color: col(mix(T.accent, '#000000', T.dark ? 0.55 : 0.35)), roughness: 0.7, metalness: 0.15 }));
  brocade.position.z = -2.6; brocade.receiveShadow = true; brocade.castShadow = true;
  const woodM = B.material('darkWood', { repeat: [4, 1], size: 512 });
  const rod = (yy) => {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(bw * 0.62, bw * 0.62, w + bw * 3, 20), woodM); r.rotation.z = Math.PI / 2; r.position.set(0, yy, 4); r.castShadow = true; r.receiveShadow = true; g.add(r);
    for (const sx of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(bw * 0.78, 16, 12), B.material('brass')); k.scale.x = 0.7; k.position.set(sx * (w + bw * 3) * 0.5, yy, 4); k.castShadow = true; g.add(k); }
  };
  g.add(brocade, paper);
  g.userData = { rodTop: (cy) => rod(cy) };
  const cy = -(yTop - tr * 0.5 + yBot + tr * 0.12) / 2;
  g.position.set((x0 + x1) / 2, cy, 0);
  rod(h / 2 + bw * 0.55); rod(-h / 2 - bw * 0.55);
  g.userData.size = { w, h, x0, x1, bw };
  return g;
}
export function mix(a, b, t) {
  const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const A = a[0] === '#' ? p(a) : a.slice(a.indexOf('(') + 1, a.indexOf(')')).split(',').slice(0, 3).map(Number), Bc = p(b);
  return '#' + A.map((v, i) => Math.round(v + (Bc[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

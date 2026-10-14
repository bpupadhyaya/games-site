// Bolas Criollas 3D models: the cancha (packed-earth ground painted from the live surface, wooden border), glossy resin bolas and
// the little mingo, palms, bunting, string lights and village houses. Everything is procedural (canvas textures + primitives).
// World axes: X = u along the cancha (0 throwing line .. 16 dead line), Z = v across (near board +Z), Y up, metres.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';

export const COURT = { len: 16, half: 1.5 };
const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, { srgb = true, repeat, aniso = 8, wrap = false } = {}) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap || repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso; t.needsUpdate = true;
  return t;
};
export const TEAM3 = [
  { base: '#12b3a7', deep: '#05544f', hi: '#a0fff3', mark: '#f2fffd' },
  { base: '#e23a5c', deep: '#5a0a22', hi: '#ffc4d0', mark: '#fff2f4' },
];

// ---------------------------------------------------------------- the ground
export const G_U0 = -2.6, G_U1 = 18.6, PPM = 112;   // texture covers u in [G_U0, G_U1], v in [-1.5, 1.5]
export function paintGround(surf, canvas, bumpCanvas) {
  const W = Math.round((G_U1 - G_U0) * PPM), H = Math.round(COURT.half * 2 * PPM);
  canvas.width = W; canvas.height = H; bumpCanvas.width = W; bumpCanvas.height = H;
  const c = canvas.getContext('2d'), b = bumpCanvas.getContext('2d'), r = lcg(4242);
  const X = (u) => (u - G_U0) * PPM, Y = (v) => (v + COURT.half) * PPM;
  // clay base, lighter toward the middle of the lane where it is trodden
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#a76c43'); g.addColorStop(0.5, '#c28a5d'); g.addColorStop(1, '#a96d44');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  b.fillStyle = '#808080'; b.fillRect(0, 0, W, H);
  // mottled earth: big soft blotches then fine grain
  for (let i = 0; i < 900; i++) {
    const x = r() * W, y = r() * H, rad = 6 + r() * 26, light = r() < 0.5;
    const gg = c.createRadialGradient(x, y, 0, x, y, rad);
    gg.addColorStop(0, light ? 'rgba(236,190,140,0.16)' : 'rgba(86,48,26,0.16)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gg; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 16000; i++) {
    const x = r() * W, y = r() * H, s = 0.8 + r() * 1.6, light = r() < 0.5;
    c.fillStyle = light ? `rgba(240,205,160,${0.2 + r() * 0.3})` : `rgba(70,38,20,${0.2 + r() * 0.3})`; c.fillRect(x, y, s * 1.5, s);
    b.fillStyle = light ? 'rgba(200,200,200,0.5)' : 'rgba(40,40,40,0.5)'; b.fillRect(x, y, s * 1.5, s);
  }
  // rake lines along the lane
  c.lineWidth = 1;
  for (let v = -1.45; v < 1.45; v += 0.11) {
    c.strokeStyle = `rgba(80,44,24,${0.05 + r() * 0.07})`; c.beginPath(); c.moveTo(X(G_U0), Y(v) + r() * 2); c.lineTo(X(G_U1), Y(v) + r() * 2); c.stroke();
    b.strokeStyle = 'rgba(60,60,60,0.35)'; b.beginPath(); c.moveTo(X(G_U0), Y(v)); b.moveTo(X(G_U0), Y(v)); b.lineTo(X(G_U1), Y(v)); b.stroke();
  }
  // patches: loose sand = dark, pitted; hard-packed = pale and smooth
  for (const p of surf.patches) {
    const cx = X(p.u), cy = Y(p.v), rx = p.ru * PPM, ry = p.rv * PPM, pr = lcg(Math.round(p.u * 91 + p.v * 53 + 7));
    c.save(); c.translate(cx, cy); c.scale(1, ry / rx);
    const pg = c.createRadialGradient(0, 0, rx * 0.1, 0, 0, rx);
    if (p.kind === 'loose') { pg.addColorStop(0, 'rgba(70,36,18,0.78)'); pg.addColorStop(0.65, 'rgba(84,46,24,0.55)'); pg.addColorStop(1, 'rgba(84,46,24,0)'); }
    else { pg.addColorStop(0, 'rgba(250,228,186,0.85)'); pg.addColorStop(0.65, 'rgba(244,214,166,0.55)'); pg.addColorStop(1, 'rgba(244,214,166,0)'); }
    c.fillStyle = pg; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill(); c.restore();
    b.save(); b.translate(cx, cy); b.scale(1, ry / rx);
    const bg = b.createRadialGradient(0, 0, 0, 0, 0, rx);
    bg.addColorStop(0, p.kind === 'loose' ? 'rgba(90,90,90,0.8)' : 'rgba(150,150,150,0.8)'); bg.addColorStop(1, 'rgba(128,128,128,0)');
    b.fillStyle = bg; b.beginPath(); b.arc(0, 0, rx, 0, TAU); b.fill(); b.restore();
    const n = Math.round(40 + rx * 0.45);
    for (let i = 0; i < n; i++) {
      const a = pr() * TAU, d = Math.sqrt(pr()) * 0.9, px = cx + Math.cos(a) * d * rx, py = cy + Math.sin(a) * d * ry, s = 1 + pr() * 2.6;
      if (p.kind === 'loose') {
        c.fillStyle = pr() < 0.7 ? 'rgba(40,20,10,0.38)' : 'rgba(170,120,80,0.4)'; c.beginPath(); c.arc(px, py, s * 0.7, 0, TAU); c.fill();
        b.fillStyle = 'rgba(30,30,30,0.6)'; b.beginPath(); b.arc(px, py, s, 0, TAU); b.fill();
      } else {
        c.fillStyle = 'rgba(255,248,226,0.65)'; c.fillRect(px, py, s * 2.4, 1.2);
      }
    }
  }
  // dark ambient-occlusion strips under the boards
  for (const v of [-COURT.half, COURT.half]) {
    const gg = c.createLinearGradient(0, Y(v), 0, Y(v) + (v < 0 ? 1 : -1) * 20);
    gg.addColorStop(0, 'rgba(30,14,6,0.55)'); gg.addColorStop(1, 'rgba(30,14,6,0)');
    c.fillStyle = gg; c.fillRect(X(G_U0), v < 0 ? Y(v) : Y(v) - 20, X(G_U1) - X(G_U0), 20);
  }
  // footprints at the throwing line
  const pr2 = lcg(909);
  for (let i = 0; i < 14; i++) {
    const u = -0.85 + pr2() * 1.7, v = (pr2() * 2 - 1) * 1.15, a = pr2() * 0.7 - 0.35;
    c.save(); c.translate(X(u), Y(v)); c.rotate(a);
    c.fillStyle = 'rgba(72,38,20,0.34)'; c.beginPath(); c.ellipse(0, 0, 0.13 * PPM, 0.055 * PPM, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,225,185,0.2)'; c.beginPath(); c.ellipse(-1.5, -1.5, 0.12 * PPM, 0.045 * PPM, 0, 0, TAU); c.fill();
    c.restore();
  }
  // painted marks: throwing line, mingo zone, dead line
  c.fillStyle = 'rgba(255,252,238,0.94)'; c.fillRect(X(-0.045), Y(-COURT.half), 0.09 * PPM, COURT.half * 2 * PPM);
  c.strokeStyle = 'rgba(18,170,160,0.85)'; c.lineWidth = 0.06 * PPM; c.setLineDash([0.28 * PPM, 0.22 * PPM]);
  for (const u of [8, 13]) { c.beginPath(); c.moveTo(X(u), Y(-COURT.half)); c.lineTo(X(u), Y(COURT.half)); c.stroke(); }
  c.setLineDash([]);
  c.fillStyle = 'rgba(18,170,160,0.1)'; c.fillRect(X(8), Y(-COURT.half), 5 * PPM, COURT.half * 2 * PPM);
  c.fillStyle = 'rgba(176,36,36,0.9)'; c.fillRect(X(COURT.len), Y(-COURT.half), 0.2 * PPM, COURT.half * 2 * PPM);
  // beyond the dead line the ground is only trodden dirt
  const gd = c.createLinearGradient(X(COURT.len + 0.2), 0, X(G_U1), 0); gd.addColorStop(0, 'rgba(60,34,20,0)'); gd.addColorStop(1, 'rgba(60,34,20,0.5)');
  c.fillStyle = gd; c.fillRect(X(COURT.len + 0.2), 0, X(G_U1) - X(COURT.len + 0.2), H);
}

export function buildGround(surf) {
  const canvas = cv(8, 8), bump = cv(8, 8);
  paintGround(surf, canvas, bump);
  const map = tex(canvas), bumpMap = tex(bump, { srgb: false });
  const mat = new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 1.4, roughness: 0.96, metalness: 0, envMapIntensity: 0.35 });
  const geo = new THREE.PlaneGeometry(G_U1 - G_U0, COURT.half * 2); geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat); m.position.set((G_U0 + G_U1) / 2, 0, 0); m.receiveShadow = true; m.name = 'cancha';
  m.userData = { canvas, bump, map, bumpMap, surf };
  return m;
}
export function repaintGround(mesh, surf) {
  const u = mesh.userData; if (u.surf === surf) return;
  paintGround(surf, u.canvas, u.bump); u.map.needsUpdate = true; u.bumpMap.needsUpdate = true; u.surf = surf;
}

// ---------------------------------------------------------------- the border: painted planks on posts
function plankTexture() {
  const c = cv(2048, 192), x = c.getContext('2d'), r = lcg(77);
  x.scale(2, 1.5);
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#c97a45'); g.addColorStop(1, '#8a4a26');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 128);
  for (let i = 0; i < 160; i++) { x.strokeStyle = `rgba(60,28,10,${0.06 + r() * 0.12})`; x.lineWidth = 1 + r() * 1.5; const y = r() * 128; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(300, y + (r() - 0.5) * 6, 700, y + (r() - 0.5) * 6, 1024, y + (r() - 0.5) * 4); x.stroke(); }
  for (let i = 0; i < 16; i++) {   // painted blocks every metre-ish: gold and teal
    const w = 1024 / 16;
    x.fillStyle = i % 4 === 1 ? 'rgba(18,170,160,0.92)' : i % 4 === 3 ? 'rgba(255,200,87,0.92)' : 'rgba(0,0,0,0)';
    x.fillRect(i * w + w * 0.2, 30, w * 0.6, 68);
    x.strokeStyle = 'rgba(40,16,6,0.55)'; x.lineWidth = 3; x.beginPath(); x.moveTo(i * w, 0); x.lineTo(i * w, 128); x.stroke();
  }
  x.fillStyle = 'rgba(255,224,170,0.5)'; x.fillRect(0, 0, 1024, 6);
  return tex(c);
}
export function buildBoards() {
  const g = new THREE.Group(), len = COURT.len + 3.0, h = 0.3, th = 0.1;
  const pt = plankTexture(); pt.wrapS = THREE.RepeatWrapping; pt.repeat.set(len / 16, 1); pt.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({ map: pt, roughness: 0.78, metalness: 0, envMapIntensity: 0.5 });
  const top = new THREE.MeshStandardMaterial({ color: '#e4b176', roughness: 0.6, envMapIntensity: 0.6 });
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(B.roundedBox(len, h, th, 0.025, 3), [mat, mat, top, mat, mat, mat]);
    m.geometry = B.roundedBox(len, h, th, 0.025, 3);
    m.material = mat;
    m.position.set(COURT.len / 2 - 0.2, h / 2, s * (COURT.half + th / 2)); m.castShadow = true; m.receiveShadow = true; g.add(m);
    const cap = new THREE.Mesh(B.roundedBox(len + 0.04, 0.035, th + 0.05, 0.015, 2), top);
    cap.position.set(m.position.x, h + 0.012, m.position.z); cap.castShadow = true; g.add(cap);
    if (s > 0) continue;
    for (let u = -1.2; u <= COURT.len + 1.4; u += 2) {   // posts behind the far board
      const p = new THREE.Mesh(B.roundedBox(0.12, h + 0.12, 0.12, 0.02, 2), top);
      p.position.set(u, (h + 0.12) / 2, s * (COURT.half + th + 0.04)); p.castShadow = true; g.add(p);
    }
  }
  return g;
}

// ---------------------------------------------------------------- the balls
function resinTexture(team, kind) {
  // marbled resin: a solid colour with slow swirls of lighter and deeper tone, and a painted marker
  const W = 512, H = 256, c = cv(W, H), x = c.getContext('2d'), r = lcg(kind === 'mingo' ? 5 : team ? 91 : 17);
  const T = kind === 'mingo' ? { base: '#f1e8cf', deep: '#b9a77e', hi: '#ffffff', mark: '#e9dcb8' } : TEAM3[team];
  x.fillStyle = T.base; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) {
    const y = r() * H, a = 0.12 + r() * 0.2, light = i % 2 === 0;
    x.strokeStyle = light ? T.hi : T.deep; x.globalAlpha = a; x.lineWidth = 6 + r() * 26;
    x.beginPath(); x.moveTo(-20, y);
    for (let k = 0; k <= 4; k++) x.bezierCurveTo(k * W / 4 + 30, y + (r() - 0.5) * 90, k * W / 4 + 70, y + (r() - 0.5) * 90, (k + 1) * W / 4, y + (r() - 0.5) * 60);
    x.stroke();
  }
  x.globalAlpha = 1;
  if (kind === 'ball') {
    x.fillStyle = T.mark;
    if (team === 0) { for (const u of [0.25, 0.75]) { x.beginPath(); x.ellipse(u * W, H / 2, 0.075 * W, 0.15 * H, 0, 0, TAU); x.fill(); } }        // two painted dots
    else { x.fillRect(0, H * 0.43, W, H * 0.14); }                                                                                            // an equator stripe
  }
  return tex(c);
}
const ballTex = new Map();
export function ballMaterial(team, kind) {
  const key = `${kind}${team}`;
  if (!ballTex.has(key)) ballTex.set(key, resinTexture(team, kind));
  const m = new THREE.MeshPhysicalMaterial({ map: ballTex.get(key), roughness: kind === 'mingo' ? 0.4 : 0.2, metalness: 0, clearcoat: kind === 'mingo' ? 0.4 : 1, clearcoatRoughness: 0.06, envMapIntensity: 1.5, sheen: 0 });
  return m;
}
const SPHERE = new THREE.SphereGeometry(1, 40, 28);
export function buildBall(team, kind, r) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(SPHERE, ballMaterial(team, kind));
  m.scale.setScalar(r); m.castShadow = true; m.receiveShadow = true;
  g.add(m); g.userData = { body: m, r };
  return g;
}

// ---------------------------------------------------------------- palms
function frondTexture() {
  const c = cv(128, 512), x = c.getContext('2d');
  x.clearRect(0, 0, 128, 512);
  x.strokeStyle = '#3d5a1a'; x.lineWidth = 5; x.beginPath(); x.moveTo(64, 512); x.lineTo(64, 10); x.stroke();
  for (let i = 0; i < 58; i++) {
    const y = 500 - i * 8.4, len = 56 * Math.sin(Math.PI * Math.min(1, (i + 4) / 62)) + 8, sh = 0.62 + 0.38 * (i / 58);
    for (const s of [-1, 1]) {
      const g = x.createLinearGradient(64, y, 64 + s * len, y - 38);
      g.addColorStop(0, '#2f5a1c'); g.addColorStop(1, `hsl(${92 + (i % 5) * 3},62%,${32 + 14 * sh}%)`);
      x.strokeStyle = g; x.lineWidth = 3.2;
      x.beginPath(); x.moveTo(64, y); x.quadraticCurveTo(64 + s * len * 0.5, y - 10, 64 + s * len, y - 38); x.stroke();
    }
  }
  return tex(c);
}
let frondTex = null, trunkTex = null;
export function buildPalm(h = 7, seed = 1, lean = 0.5) {
  const r = lcg(seed * 977 + 3), g = new THREE.Group();
  if (!trunkTex) {
    const c = cv(64, 256), x = c.getContext('2d'); x.fillStyle = '#8b7352'; x.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 40; i++) { x.fillStyle = i % 2 ? 'rgba(50,38,22,0.5)' : 'rgba(190,164,120,0.35)'; x.fillRect(0, i * 6.4, 64, 2.4); }
    for (let i = 0; i < 80; i++) { x.fillStyle = 'rgba(40,30,18,0.18)'; x.fillRect(r() * 64, 0, 1, 256); }
    trunkTex = tex(c, { wrap: true });
  }
  const trunkMat = new THREE.MeshStandardMaterial({ map: trunkTex, roughness: 0.92 });
  const N = 10, pts = [];
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push(new THREE.Vector3(lean * t * t * 2.2, h * t, Math.sin(t * 2.4 + seed) * 0.22 * t)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  for (let i = 0; i < N; i++) {
    const a = curve.getPoint(i / N), b = curve.getPoint((i + 1) / N), rad0 = 0.2 - 0.09 * (i / N), rad1 = 0.2 - 0.09 * ((i + 1) / N);
    const len = a.distanceTo(b), cyl = new THREE.Mesh(new THREE.CylinderGeometry(rad1, rad0, len, 10, 1), trunkMat);
    cyl.position.copy(a).add(b).multiplyScalar(0.5); cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    cyl.castShadow = true; g.add(cyl);
  }
  if (!frondTex) frondTex = frondTexture();
  const crown = new THREE.Group(); crown.position.copy(curve.getPoint(1)); g.add(crown);
  const fm = new THREE.MeshStandardMaterial({ map: frondTex, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.75, envMapIntensity: 0.6 });
  const fronds = [];
  const NF = 12;
  for (let i = 0; i < NF; i++) {
    const L = 3.0 + r() * 0.9, W = 1.25;
    const geo = new THREE.PlaneGeometry(W, L, 1, 10); geo.translate(0, L / 2, 0);
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) { const y = p.getY(k); p.setZ(k, -0.16 * y * y / L * 0.7); }
    geo.computeVertexNormals();
    const f = new THREE.Mesh(geo, fm); f.castShadow = true;
    const hold = new THREE.Group(); hold.rotation.y = (i / NF) * TAU + r() * 0.3;
    const lift = 0.35 + r() * 0.8;
    f.rotation.x = Math.PI / 2 - lift;   // lean the frond outward from vertical
    f.rotation.z = (r() - 0.5) * 0.25;
    hold.add(f); crown.add(hold);
    hold.userData = { ph: r() * TAU, amp: 0.04 + r() * 0.05, base: f.rotation.x, f };
    fronds.push(hold);
  }
  g.userData = { fronds, crown };
  return g;
}

// ---------------------------------------------------------------- bunting and string lights
export function buildBunting(p0, p1, n, sag, seed = 1) {
  const g = new THREE.Group(), r = lcg(seed);
  const cols = ['#12b3a7', '#e23a5c', '#ffc857', '#fff3dc', '#ff7a4d'];
  const pts = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector3(p0.x + (p1.x - p0.x) * t, p0.y + (p1.y - p0.y) * t - sag * 4 * t * (1 - t), p0.z + (p1.z - p0.z) * t)); }
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x2a1a30 })));
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.17, 0, 0, 0.17, 0, 0, 0, -0.4, 0], 3)); tri.computeVertexNormals();
  const flags = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, p = new THREE.Vector3(p0.x + (p1.x - p0.x) * t, p0.y + (p1.y - p0.y) * t - sag * 4 * t * (1 - t), p0.z + (p1.z - p0.z) * t);
    const m = new THREE.Mesh(tri, new THREE.MeshStandardMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, roughness: 0.8, emissive: cols[i % cols.length], emissiveIntensity: 0.18 }));
    m.position.copy(p); m.userData.ph = r() * TAU; g.add(m); flags.push(m);
  }
  g.userData.flags = flags;
  return g;
}
export function buildLightString(p0, p1, n, sag, glowTex, seed = 3) {
  const g = new THREE.Group(), bulbs = [];
  const geo = new THREE.SphereGeometry(0.045, 8, 6);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, p = new THREE.Vector3(p0.x + (p1.x - p0.x) * t, p0.y + (p1.y - p0.y) * t - sag * 4 * t * (1 - t), p0.z + (p1.z - p0.z) * t);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xfff0b0 })); m.position.copy(p); g.add(m);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffcf80, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.scale.setScalar(0.5); s.position.copy(p); g.add(s); bulbs.push({ s, ph: (seed * 7 + i * 2.3) % TAU });
  }
  g.userData.bulbs = bulbs;
  return g;
}

// ---------------------------------------------------------------- a village house (stucco, tiled roof, lit windows)
export function buildHouse(w, d, h, wall, roof, seed = 1) {
  const g = new THREE.Group(), r = lcg(seed + 11);
  const wm = new THREE.MeshStandardMaterial({ color: wall, roughness: 0.92 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wm); body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const rg = new THREE.CylinderGeometry(1, 1, w + 0.5, 3, 1); rg.rotateZ(Math.PI / 2);
  const rm = new THREE.MeshStandardMaterial({ color: roof, roughness: 0.8 });
  const rf = new THREE.Mesh(rg, rm); rf.scale.set(1, d * 0.62, d * 0.62); rf.position.y = h + d * 0.2; rf.rotation.x = Math.PI / 2; rf.rotation.set(0, 0, 0);
  rf.rotation.x = 0; rf.scale.set(1, 0.55 * d / 1.0, 0.62 * d); rf.rotation.set(0, 0, 0); g.add(rf);
  const win = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  const nW = Math.max(2, Math.round(w / 1.5));
  for (let i = 0; i < nW; i++) {
    const x = -w / 2 + (i + 0.5) * (w / nW);
    for (let fl = 0; fl < 2; fl++) {
      if (r() < 0.78) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.62), r() < 0.7 ? win : new THREE.MeshBasicMaterial({ color: 0x23304a })); m.position.set(x, 0.9 + fl * 1.6, d / 2 + 0.01); g.add(m); }
    }
  }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.15), new THREE.MeshStandardMaterial({ color: '#4a2a18' })); door.position.set(w * 0.3, 0.58, d / 2 + 0.012); g.add(door);
  return g;
}

export function softTexture(rgb = '255,255,255', a = 1, size = 128, ring = false) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, ring ? size * 0.3 : 0, size / 2, size / 2, size / 2);
  if (ring) { g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.62, `rgba(${rgb},${a})`); g.addColorStop(0.76, `rgba(${rgb},${a * 0.5})`); g.addColorStop(1, `rgba(${rgb},0)`); }
  else { g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`); }
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  return tex(c);
}

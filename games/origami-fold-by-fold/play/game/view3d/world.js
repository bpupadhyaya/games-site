// Origami 3D world: a pale hinoki desk, a sage folding mat with a ruler grid, and the paper textures (washi pattern + crease lines
// baked together so the folds stay printed on the paper). Everything is generated; nothing is downloaded.
import * as THREE from '../vendor3d/three.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const hash = (n) => { let h = Math.imul(Math.floor(n) ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function woodTexture() {
  const N = 1024, c = mk(N, N), g = c.getContext('2d');
  g.fillStyle = '#d9c298'; g.fillRect(0, 0, N, N);
  const P = 4, pw = N / P;
  for (let p = 0; p < P; p++) {
    const tone = hash(p * 7 + 3);
    g.fillStyle = `rgba(${tone < 0.5 ? '255,236,196' : '150,110,60'},${0.07 + 0.08 * Math.abs(tone - 0.5)})`; g.fillRect(p * pw, 0, pw, N);
    for (let i = 0; i < 150; i++) {
      const x = p * pw + hash(i * 5 + p * 99) * pw, w = 0.6 + hash(i * 3 + p) * 1.6, a = 0.03 + hash(i + p * 13) * 0.08, wob = hash(i * 11 + p) * 6;
      g.strokeStyle = hash(i * 17 + p) < 0.55 ? `rgba(120,84,44,${a})` : `rgba(255,244,214,${a * 1.2})`; g.lineWidth = w;
      g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + wob, N * 0.3, x - wob, N * 0.66, x + wob * 0.4, N); g.stroke();
    }
    g.fillStyle = 'rgba(70,46,22,0.5)'; g.fillRect(p * pw, 0, 2.2, N);
    g.fillStyle = 'rgba(255,248,230,0.25)'; g.fillRect(p * pw + 2.2, 0, 1.4, N);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

export function matTexture() {
  const N = 1024, c = mk(N, N), g = c.getContext('2d');
  g.fillStyle = '#5a7b64'; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${hash(i) < 0.5 ? '255,255,240' : '20,44,30'},0.06)`; g.fillRect(hash(i * 3 + 1) * N, hash(i * 3 + 2) * N, 2 + hash(i + 7) * 4, 1.2); }
  const u = N / 12;
  for (let i = 0; i <= 12; i++) {
    const major = i % 3 === 0;
    g.strokeStyle = major ? 'rgba(236,244,222,0.5)' : 'rgba(236,244,222,0.2)'; g.lineWidth = major ? 2.2 : 1.1;
    g.beginPath(); g.moveTo(i * u, 0); g.lineTo(i * u, N); g.stroke(); g.beginPath(); g.moveTo(0, i * u); g.lineTo(N, i * u); g.stroke();
  }
  g.strokeStyle = 'rgba(236,244,222,0.38)'; g.lineWidth = 1.4;
  for (let i = 0; i <= 12; i++) for (let j = 1; j < 4; j++) { const a = (i + j / 4) * u; g.beginPath(); g.moveTo(a, 0); g.lineTo(a, 14); g.moveTo(a, N); g.lineTo(a, N - 14); g.moveTo(0, a); g.lineTo(14, a); g.moveTo(N, a); g.lineTo(N - 14, a); g.stroke(); }
  g.lineWidth = 18; g.strokeStyle = 'rgba(28,52,38,0.7)'; g.strokeRect(0, 0, N, N);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function buildDesk() {
  const grp = new THREE.Group();
  const wt = woodTexture(); wt.repeat.set(10, 10);
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(48, 48), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.78, metalness: 0 }));
  desk.rotation.x = -Math.PI / 2; desk.position.y = -0.0025; desk.receiveShadow = true; desk.renderOrder = -3; desk.material.depthWrite = false;
  const mt = matTexture();
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: mt, roughness: 0.92, metalness: 0 }));
  mat.rotation.x = -Math.PI / 2; mat.position.y = -0.0012; mat.receiveShadow = true; mat.renderOrder = -2; mat.material.depthWrite = false;
  grp.add(desk, mat);
  grp.userData.dispose = () => { wt.dispose(); mt.dispose(); desk.geometry.dispose(); mat.geometry.dispose(); desk.material.dispose(); mat.material.dispose(); };
  return grp;
}

// ---- paper textures: pattern + creases baked in sheet space (u, v in -0.5..0.5) -------------------------------------------------------
export function bakePaperTexture(srcCanvas, creases, N) {
  const c = mk(N, N), g = c.getContext('2d');
  g.drawImage(srcCanvas, 0, 0, N, N);
  if (creases && creases.length) {
    g.setTransform(N, 0, 0, N, N / 2, N / 2); g.lineCap = 'round';
    const ln = (c1, dx, dy) => { g.beginPath(); g.moveTo(c1.p[0] + dx, c1.p[1] + dy); g.lineTo(c1.q[0] + dx, c1.q[1] + dy); g.stroke(); };
    for (const cr of creases) {
      const ddx = cr.q[0] - cr.p[0], ddy = cr.q[1] - cr.p[1], l = Math.hypot(ddx, ddy) || 1, nx = -ddy / l * 0.0022, ny = ddx / l * 0.0022;
      g.strokeStyle = 'rgba(60,40,25,0.10)'; g.lineWidth = 0.016; ln(cr, 0, 0);
      g.strokeStyle = 'rgba(60,40,25,0.40)'; g.lineWidth = 0.0042; ln(cr, 0, 0);
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.0028; ln(cr, nx, ny);
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

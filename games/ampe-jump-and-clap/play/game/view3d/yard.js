// The playground yard: packed earth with chalk marks, a low painted wall, a tree and a warm sky. A handful of draw calls, no shadow maps
// beyond the stage's own (blob shadows stand in on the low tier). Textures are drawn once from a seeded generator (no Math.random).
import { THREE } from '../vendor3d/index.js';

function lcg(seed) { let x = seed >>> 0; return () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296; }
function canvasTex(w, h, draw, repeat) {
  const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}
const plane = (w, h, mat, x, y, z, rx = -Math.PI / 2) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.rotation.x = rx; m.position.set(x, y, z); return m; };

export function buildYard(stage, { gapZ = 0.75 } = {}) {
  const g = new THREE.Group(); g.name = 'yard';
  // --- packed earth, tiled, with a few pebbles and soft patches
  const earth = canvasTex(512, 512, (c, w, h) => {
    const r = lcg(3);
    c.fillStyle = '#c98f58'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { c.globalAlpha = 0.08 + r() * 0.1; c.fillStyle = r() > 0.5 ? '#b27a46' : '#dba670'; c.beginPath(); c.ellipse(r() * w, r() * h, 8 + r() * 36, 5 + r() * 24, r() * 3, 0, 6.3); c.fill(); }
    c.globalAlpha = 1;
    for (let i = 0; i < 200; i++) { c.fillStyle = r() > 0.5 ? '#9c6a3c' : '#e9c18f'; c.globalAlpha = 0.5; c.beginPath(); c.arc(r() * w, r() * h, 1 + r() * 2.2, 0, 6.3); c.fill(); }
    c.globalAlpha = 1;
  }, [10, 10]);
  const ground = plane(60, 60, new THREE.MeshStandardMaterial({ map: earth, roughness: 1 }), 0, -0.002, 2);
  ground.receiveShadow = true; g.add(ground);
  // --- chalk marks: a circle, the two standing marks, a hopscotch strip and a sun doodle, on one alpha plane
  const SIZE = 7.2;
  const chalk = canvasTex(1024, 1024, (c, w, h) => {
    const r = lcg(9);
    c.clearRect(0, 0, w, h);
    const X = (x) => (x / SIZE + 0.5) * w, Z = (z) => (0.5 - z / SIZE) * h, S = w / SIZE;
    c.lineCap = 'round'; c.lineJoin = 'round';
    const rough = (fn) => { for (let k = 0; k < 3; k++) { c.globalAlpha = 0.5 + r() * 0.25; c.lineWidth = (0.035 + r() * 0.012) * S; fn(r() * 3 - 1.5); } c.globalAlpha = 1; };
    c.strokeStyle = '#fff6e4';
    rough((j) => { c.beginPath(); c.arc(X(0) + j, Z(0) + j, 2.5 * S, 0, 6.3); c.stroke(); });
    rough((j) => { c.beginPath(); c.moveTo(X(-2.5) + j, Z(0)); c.lineTo(X(2.5) + j, Z(0)); c.stroke(); });
    for (const sz of [-gapZ, gapZ]) {
      rough((j) => { c.strokeRect(X(-0.27) + j, Z(sz + 0.22) + j, 0.54 * S, 0.44 * S); });
    }
    // hopscotch squares to one side
    c.strokeStyle = '#ffe7b8';
    rough((j) => { for (let k = 0; k < 5; k++) c.strokeRect(X(2.9) + j, Z(-2.2 + k * 0.5 + 0.5) + j, 0.5 * S, 0.5 * S); });
    // a little sun
    c.strokeStyle = '#ffd98a';
    rough((j) => { c.beginPath(); c.arc(X(-2.85) + j, Z(1.6), 0.22 * S, 0, 6.3); c.stroke(); for (let k = 0; k < 10; k++) { const a = k * 0.628; c.moveTo(X(-2.85) + Math.cos(a) * 0.32 * S, Z(1.6) + Math.sin(a) * 0.32 * S); c.lineTo(X(-2.85) + Math.cos(a) * 0.46 * S, Z(1.6) + Math.sin(a) * 0.46 * S); } c.stroke(); });
  });
  const chalkMesh = plane(SIZE, SIZE, new THREE.MeshBasicMaterial({ map: chalk, transparent: true, depthWrite: false, opacity: 0.9 }), 0, 0.004, 0);
  g.add(chalkMesh);
  // --- the back wall: painted bands, a door, a window
  const wallTex = canvasTex(1024, 256, (c, w, h) => {
    const r = lcg(21);
    c.fillStyle = '#f0b970'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e07b4a'; c.fillRect(0, h * 0.62, w, h * 0.38);
    c.fillStyle = '#2e7f88'; c.fillRect(0, h * 0.58, w, h * 0.05);
    c.fillStyle = '#fff1d2'; c.fillRect(0, h * 0.0, w, h * 0.06);
    for (let i = 0; i < 400; i++) { c.globalAlpha = 0.05; c.fillStyle = r() > 0.5 ? '#000' : '#fff'; c.fillRect(r() * w, r() * h, 3 + r() * 40, 2 + r() * 8); }
    c.globalAlpha = 1;
    c.fillStyle = '#2b4a5c'; c.fillRect(w * 0.14, h * 0.2, w * 0.1, h * 0.8);
    c.fillStyle = '#3b6f86'; c.fillRect(w * 0.15, h * 0.24, w * 0.08, h * 0.42);
    c.fillStyle = '#243f4e'; c.fillRect(w * 0.62, h * 0.18, w * 0.16, h * 0.34);
    c.fillStyle = '#9fd3e0'; c.fillRect(w * 0.635, h * 0.22, w * 0.07, h * 0.26); c.fillRect(w * 0.705, h * 0.22, w * 0.07, h * 0.26);
    for (let i = 0; i < 9; i++) { c.fillStyle = ['#2e7f88', '#f4d35e', '#e07b4a', '#fff1d2'][i % 4]; c.fillRect(w * (0.3 + i * 0.03), h * 0.7, w * 0.02, h * 0.12); }
  });
  const wall = plane(16, 3.2, new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1 }), 0, 1.6, 6.6, 0);
  wall.rotation.y = Math.PI; g.add(wall);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(16.2, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: '#d9a066', roughness: 1 }));
  cap.position.set(0, 3.22, 6.55); g.add(cap);
  // --- a tree at the side: trunk and three soft canopy blobs
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 3.4, 8), new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 1 }));
  trunk.position.set(-9, 1.7, 2.0); g.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#4d9a52', roughness: 1 });
  for (const [x, y, z, rr] of [[-9, 4.0, 2.0, 1.5], [-8.1, 3.5, 2.3, 1.1], [-9.8, 3.6, 1.7, 1.15]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(rr, 14, 10), leafMat); m.position.set(x, y, z); g.add(m); }
  // --- a small bench and a bag on the near side (keeps the corner from feeling empty)
  const benchMat = new THREE.MeshStandardMaterial({ color: '#8b5a34', roughness: 1 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.4), benchMat); seat.position.set(3.7, 0.45, 2.8); g.add(seat);
  for (const dx of [-0.6, 0.6]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.45, 0.36), benchMat); leg.position.set(3.7 + dx, 0.225, 2.8); g.add(leg); }
  stage.add(g);
  return g;
}

export function skyTexture() {
  return canvasTex(8, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#6fb7e8'); gr.addColorStop(0.55, '#bfe3f2'); gr.addColorStop(1, '#ffe6b0');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  });
}

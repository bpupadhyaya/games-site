// The schoolyard: cool grey tarmac with painted lines and hopscotch, a warm brick wall with a mural and bunting, trees behind it.
// A handful of draw calls; textures are drawn once from a seeded generator (no Math.random).
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
const TAU = Math.PI * 2;

export function buildYard(stage) {
  const g = new THREE.Group(); g.name = 'yard';
  // --- tarmac: bluish grey, speckled
  const tar = canvasTex(512, 512, (c, w, h) => {
    const r = lcg(7);
    c.fillStyle = '#a9a39c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 320; i++) { c.globalAlpha = 0.07 + r() * 0.08; c.fillStyle = r() > 0.5 ? '#948e88' : '#bab4ac'; c.beginPath(); c.ellipse(r() * w, r() * h, 6 + r() * 30, 4 + r() * 20, r() * 3, 0, TAU); c.fill(); }
    c.globalAlpha = 0.5;
    for (let i = 0; i < 700; i++) { c.fillStyle = r() > 0.5 ? '#7d7771' : '#c9c3ba'; c.fillRect(r() * w, r() * h, 1.5, 1.5); }
    c.globalAlpha = 1;
  }, [9, 9]);
  const ground = plane(70, 70, new THREE.MeshStandardMaterial({ map: tar, roughness: 1 }), 0, -0.002, 6);
  ground.receiveShadow = true; g.add(ground);
  // --- painted lines: a white circle, a yellow line, coloured hopscotch squares, a rainbow arc on the ground
  const SIZE = 9;
  const paint = canvasTex(1024, 1024, (c, w, h) => {
    const r = lcg(11);
    c.clearRect(0, 0, w, h);
    const X = (x) => (x / SIZE + 0.5) * w, Z = (z) => (0.5 - z / SIZE) * h, S = w / SIZE;
    c.lineCap = 'round';
    const rough = (fn, a = 0.6) => { for (let k = 0; k < 2; k++) { c.globalAlpha = a + r() * 0.2; fn(r() * 2 - 1); } c.globalAlpha = 1; };
    c.lineWidth = 0.05 * S; c.strokeStyle = '#fff6e4';
    rough((j) => { c.beginPath(); c.arc(X(0) + j, Z(0.2) + j, 2.6 * S, 0, TAU); c.stroke(); });
    c.strokeStyle = '#ffe14f'; c.lineWidth = 0.05 * S;
    rough((j) => { c.beginPath(); c.moveTo(X(-4.4) + j, Z(2.4)); c.lineTo(X(4.4) + j, Z(2.4)); c.stroke(); });
    // hopscotch on the left (far from the camera side)
    const cols = ['#ff7aa8', '#6ee0d8', '#ffd23f', '#b266ff', '#ff9a2e'];
    for (let k = 0; k < 5; k++) {
      c.fillStyle = cols[k]; c.globalAlpha = 0.62;
      c.fillRect(X(-3.6 + 0.0) , Z(-0.6 + k * 0.62 + 0.62), 0.58 * S, 0.58 * S);
    }
    c.globalAlpha = 1;
    c.strokeStyle = '#fff6e4'; c.lineWidth = 0.035 * S;
    for (let k = 0; k < 5; k++) c.strokeRect(X(-3.6), Z(-0.6 + k * 0.62 + 0.62), 0.58 * S, 0.58 * S);
    // two standing marks for the holders
    c.strokeStyle = '#fff6e4'; c.lineWidth = 0.045 * S;
    for (const sx of [-1, 1]) rough((j) => { c.beginPath(); c.ellipse(X(sx * 1.25) + j, Z(0), 0.36 * S, 0.3 * S, 0, 0, TAU); c.stroke(); }, 0.5);
  });
  g.add(plane(SIZE, SIZE, new THREE.MeshBasicMaterial({ map: paint, transparent: true, depthWrite: false, opacity: 0.95 }), 0, 0.004, 0));
  // --- the school wall (low, so the street and the hills behind show): whitewash over a red-brown dado, painted rainbow, bunting, railings
  const WALL_Z = 6.6, WALL_W = 40, WALL_H = 1.5;
  const wallTex = canvasTex(2048, 128, (c, w, h) => {
    const r = lcg(31);
    c.fillStyle = '#f2ead9'; c.fillRect(0, 0, w, h);
    c.globalAlpha = 0.08; for (let i = 0; i < 300; i++) { c.fillStyle = r() > 0.5 ? '#5a4a3a' : '#fff'; c.fillRect(r() * w, r() * h * 0.7, 6 + r() * 40, 3 + r() * 9); } c.globalAlpha = 1;
    c.fillStyle = '#b5543a'; c.fillRect(0, h * 0.58, w, h * 0.42);               // brick dado
    c.strokeStyle = 'rgba(70,24,14,0.35)'; c.lineWidth = 1.5;
    const bh = h * 0.42 / 5, bw = bh * 2.6; c.beginPath();
    for (let y = h * 0.58 + bh, row = 0; y <= h; y += bh, row++) { c.moveTo(0, y); c.lineTo(w, y); for (let x = (row % 2) * bw * 0.5; x < w; x += bw) { c.moveTo(x, y); c.lineTo(x, y - bh); } }
    c.stroke();
    ['#ff5a5f', '#ffb938', '#ffe14f', '#4fd38a', '#4aa8ff'].forEach((col, i) => { c.strokeStyle = col; c.lineWidth = h * 0.045; c.beginPath(); c.arc(w * 0.3, h * 0.6, h * (0.46 - i * 0.07), Math.PI, 2 * Math.PI); c.stroke(); });
    c.fillStyle = '#ffe14f'; c.beginPath(); c.arc(w * 0.62, h * 0.3, h * 0.17, 0, TAU); c.fill();
    c.fillStyle = '#6e9f5a'; for (let i = 0; i < 18; i++) { const x = w * (0.72 + i * 0.012); c.fillRect(x, h * (0.45 - r() * 0.15), 5, h * 0.2); }
  });
  const wall = plane(WALL_W, WALL_H, new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1 }), 0, WALL_H / 2, WALL_Z, 0);
  wall.rotation.y = Math.PI; wall.receiveShadow = true; g.add(wall);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(WALL_W, 0.1, 0.4), new THREE.MeshStandardMaterial({ color: '#d9d2c4', roughness: 0.9 }));
  cap.position.set(0, WALL_H + 0.05, WALL_Z - 0.02); cap.castShadow = true; g.add(cap);
  // iron railings above the wall (instanced bars) and a rail
  const bars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 6), new THREE.MeshStandardMaterial({ color: '#2d3a3f', roughness: 0.5, metalness: 0.5 }), 150);
  const mt = new THREE.Matrix4(); for (let i = 0; i < 150; i++) { mt.makeTranslation(-WALL_W / 2 + i * (WALL_W / 150), WALL_H + 0.1 + 0.45, WALL_Z - 0.02); bars.setMatrixAt(i, mt); }
  g.add(bars);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(WALL_W, 0.035, 0.035), bars.material); rail.position.set(0, WALL_H + 1.0, WALL_Z - 0.02); g.add(rail);
  // bunting: a catenary of little flags across the yard behind the wall line
  const flagsG = new THREE.Group(); const fc = ['#ff4f8b', '#ffd23f', '#26c281', '#2f8cff', '#b266ff', '#ff9a2e'];
  const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.13, 0, 0, 0.13, 0, 0, 0, -0.3, 0], 3)); tri.computeVertexNormals();
  for (let i = 0; i < 60; i++) { const u = i / 59, x = -9 + u * 18, y = 3.6 - 0.55 * Math.sin(Math.PI * u) - 0.0; const m = new THREE.Mesh(tri, new THREE.MeshBasicMaterial({ color: fc[i % 6], side: THREE.DoubleSide })); m.position.set(x, y, 4.6); m.rotation.z = (u - 0.5) * 0.6 * Math.cos(Math.PI * u) * 0; flagsG.add(m); }
  flagsG.userData.sway = true; g.add(flagsG);
  const poleM = new THREE.MeshStandardMaterial({ color: '#cfd5da', roughness: 0.4, metalness: 0.6 });
  // schoolbags and a water bottle by the wall: the jumpers' things, real size
  const bag = (x, z, col, rot) => { const b = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.14), new THREE.MeshStandardMaterial({ color: col, roughness: 0.75 })); body.position.y = 0.19; body.castShadow = true; b.add(body); const flap = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.16, 0.15), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, transparent: false })); flap.position.y = 0.3; flap.material.color.set(col).multiplyScalar(0.8); b.add(flap); b.position.set(x, 0, z); b.rotation.y = rot; return b; };
  g.add(bag(-3.4, 5.3, '#e8523f', 0.5), bag(-3.0, 5.6, '#2f8cff', -0.3), bag(3.6, 5.2, '#ffcf3f', 2.8));
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 10), new THREE.MeshStandardMaterial({ color: '#4aa8ff', roughness: 0.3 })); bottle.position.set(-2.7, 0.11, 5.4); bottle.castShadow = true; g.add(bottle);
  // a flat-roofed school block and a planted row of trees behind the wall (the scenery kit gives the far hills)
  const blockTex = canvasTex(1024, 256, (c, w, h) => {
    c.fillStyle = '#efe6d2'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#c9423a'; c.fillRect(0, 0, w, h * 0.09);
    for (let i = 0; i < 14; i++) for (let j = 0; j < 3; j++) { c.fillStyle = '#5d7d93'; c.fillRect(30 + i * 70, 34 + j * 70, 46, 48); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(30 + i * 70, 34 + j * 70, 46, 14); }
  });
  const block = new THREE.Mesh(new THREE.BoxGeometry(34, 8.4, 4), new THREE.MeshStandardMaterial({ map: blockTex, roughness: 1 }));
  block.material.map.repeat.set(1, 1); block.position.set(0, 4.2, WALL_Z + 9); g.add(block);
  const leaf = new THREE.MeshLambertMaterial({ color: '#4fa86a' }), leaf2 = new THREE.MeshLambertMaterial({ color: '#3c9059' }), trunk = new THREE.MeshLambertMaterial({ color: '#6a4a33' });
  const r2 = lcg(5);
  for (let i = 0; i < 12; i++) { const x = -15 + i * 2.7 + r2() * 1.0, rr = 1.3 + r2() * 0.7, z = WALL_Z + 2.4 + r2() * 1.2;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 2.4, 6), trunk); t.position.set(x, 1.2, z); t.castShadow = true; g.add(t);
    const m = new THREE.Mesh(new THREE.SphereGeometry(rr, 14, 10), i % 2 ? leaf : leaf2); m.scale.y = 1.15; m.position.set(x, 2.6 + rr * 0.6, z); m.castShadow = true; g.add(m); }
  g.userData.flags = flagsG;
  stage.add(g);
  return g;
}

export function skyTexture() {
  return canvasTex(8, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#5cc4ff'); gr.addColorStop(0.7, '#cdeeff'); gr.addColorStop(1, '#eafaff');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  });
}

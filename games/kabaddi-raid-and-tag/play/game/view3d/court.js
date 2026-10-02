// The 3D court, built from six meshes: the hall floor, one mat plane (apron, mat, every line and the lobbies painted into one texture),
// and four stand walls (crowd and boards painted into one texture each). Presentation only (never read by the sim).
// World frame: x across (-5..5), z along (-6.5..6.5), team 0's half is z < 0.
const C = { W: 10, HALF: 6.5, BAULK: 3.75, BONUS: 4.75, LOBBY: 1 };

function canvasOf(w, h) { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; }
function lcg(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function matTexture(THREE) {
  const PX = 48, pad = 2.2, W = (C.W + pad * 2) * PX, H = (2 * C.HALF + pad * 2) * PX;
  const c = canvasOf(Math.round(W), Math.round(H)), g = c.getContext('2d');
  g.fillStyle = '#2e5b66'; g.fillRect(0, 0, W, H);                       // apron
  const X = (x) => (x + C.W / 2 + pad) * PX, Z = (z) => (z + C.HALF + pad) * PX;
  g.fillStyle = '#d4a86c'; g.fillRect(X(-C.W / 2), Z(-C.HALF), C.W * PX, 2 * C.HALF * PX);
  const rnd = lcg(5);
  for (let i = 0; i < 9000; i++) { const a = rnd(); g.fillStyle = a < 0.5 ? `rgba(0,0,0,${0.02 + a * 0.05})` : `rgba(255,255,255,${0.02 + (a - 0.5) * 0.05})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2); }
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(X(-C.W / 2), Z(-C.HALF), C.LOBBY * PX, 2 * C.HALF * PX); g.fillRect(X(C.W / 2 - C.LOBBY), Z(-C.HALF), C.LOBBY * PX, 2 * C.HALF * PX);
  const line = (x0, z0, x1, z1, w, col = '#f6f3ea') => { g.strokeStyle = col; g.lineWidth = w * PX; g.beginPath(); g.moveTo(X(x0), Z(z0)); g.lineTo(X(x1), Z(z1)); g.stroke(); };
  line(-C.W / 2, 0, C.W / 2, 0, 0.1);
  for (const sg of [1, -1]) { line(-C.W / 2, sg * C.HALF, C.W / 2, sg * C.HALF, 0.1); line(-C.W / 2, sg * C.BAULK, C.W / 2, sg * C.BAULK, 0.07); line(-C.W / 2, sg * C.BONUS, C.W / 2, sg * C.BONUS, 0.07, '#ffd36a'); }
  line(-C.W / 2, -C.HALF, -C.W / 2, C.HALF, 0.1); line(C.W / 2, -C.HALF, C.W / 2, C.HALF, 0.1);
  line(-C.W / 2 + C.LOBBY, -C.HALF, -C.W / 2 + C.LOBBY, C.HALF, 0.06); line(C.W / 2 - C.LOBBY, -C.HALF, C.W / 2 - C.LOBBY, C.HALF, 0.06);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { t, w: W / PX, h: H / PX };
}
function standTexture(THREE, seed) {
  const c = canvasOf(512, 128), g = c.getContext('2d');
  g.fillStyle = '#16303a'; g.fillRect(0, 0, 512, 128);
  const cols = ['#3a6bb8', '#b8483f', '#c99a3e', '#a9a595', '#3f7f5a', '#5f4a85', '#22404c', '#22404c', '#22404c', '#1d3640'], rnd = lcg(seed);
  for (let r = 0; r < 5; r++) { g.fillStyle = r % 2 ? '#1a3640' : '#143039'; g.fillRect(0, 40 + r * 18, 512, 18); }
  for (let i = 0; i < 1800; i++) { g.fillStyle = cols[Math.floor(rnd() * cols.length)]; g.globalAlpha = 0.35 + rnd() * 0.25; g.fillRect(Math.floor(rnd() * 256) * 2, 38 + Math.floor(rnd() * 45) * 2, 2, 2); }
  g.globalAlpha = 1;
  const bc = ['#2f6fd6', '#d8453a', '#f2b441', '#2f8f55'];
  g.fillStyle = '#24444f'; g.fillRect(0, 0, 512, 40);
  for (let i = 0; i < 8; i++) { g.fillStyle = bc[i % 4]; g.fillRect(i * 64 + 5, 8, 54, 24); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildCourt(THREE) {
  const root = new THREE.Group(); root.name = 'court';
  const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, ...o });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat({ color: 0x1b2a31, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.004; floor.receiveShadow = true; root.add(floor);
  const m = matTexture(THREE);
  const mt = new THREE.Mesh(new THREE.PlaneGeometry(m.w, m.h), mat({ map: m.t, roughness: 0.92 }));
  mt.rotation.x = -Math.PI / 2; mt.position.y = 0; mt.receiveShadow = true; root.add(mt);
  const ox = C.W / 2 + 2.6, oz = C.HALF + 2.6;
  const wall = (len, cx, cz, rotY, seed) => {
    const tex = standTexture(THREE, seed); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(len / 8, 1);
    const g = new THREE.Mesh(new THREE.BoxGeometry(len, 3.4, 0.4), mat({ map: tex }));
    g.position.set(cx, 1.7, cz); g.rotation.y = rotY; root.add(g);
  };
  wall(C.W + 5.2, 0, oz, 0, 3); wall(C.W + 5.2, 0, -oz, 0, 4); wall(2 * C.HALF + 5.2, ox, 0, Math.PI / 2, 5); wall(2 * C.HALF + 5.2, -ox, 0, Math.PI / 2, 6);
  return root;
}

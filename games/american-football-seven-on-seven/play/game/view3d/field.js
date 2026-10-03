// The 3D field: grass with painted lines and numbers, two end zones, goal posts, a low wall of stands. Static: nothing here ever moves, shakes or zooms.
// World frame (metres): the sim's x is mirrored (world x = -sim x) so that the screen's right is the sim's +x for a camera that looks along +z.
// The only moving parts are two thin line markers (the line of scrimmage and the first-down line), placed by the presenter between plays.
const YD = 0.9144;
const F = { W: 28, HALF: 14, LEN: 40, EZ: 6, TOTAL: 52 };

const canvasOf = (w, h) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };
const lcg = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

function grassTexture(THREE) {
  const PX = 22, pad = 4;                                   // pixels per yard, apron in yards
  const Wy = F.W + pad * 2, Hy = F.TOTAL + pad * 2;
  const c = canvasOf(Math.round(Wy * PX), Math.round(Hy * PX)), g = c.getContext('2d');
  const X = (x) => (x + F.HALF + pad) * PX, Z = (z) => (z + pad) * PX;        // canvas y grows with z; the texture is mirrored in x below so the picture reads right from the camera
  g.fillStyle = '#17321f'; g.fillRect(0, 0, c.width, c.height);
  // mown stripes
  for (let i = 0; i * 5 < F.LEN; i++) { g.fillStyle = i % 2 ? '#2c7a3c' : '#32883f'; g.fillRect(X(-F.HALF), Z(F.EZ + i * 5), F.W * PX, 5 * PX); }
  // grain
  const rnd = lcg(11);
  for (let i = 0; i < 26000; i++) { const a = rnd(); g.fillStyle = a < 0.5 ? `rgba(0,30,0,${0.03 + a * 0.06})` : `rgba(210,255,190,${0.025 + (a - 0.5) * 0.05})`; g.fillRect(X(-F.HALF) + rnd() * F.W * PX, Z(0) + rnd() * F.TOTAL * PX, 1 + rnd() * 2, 2 + rnd() * 5); }
  // end zones
  g.fillStyle = '#1d4a86'; g.fillRect(X(-F.HALF), Z(0), F.W * PX, F.EZ * PX);
  g.fillStyle = '#8a2b24'; g.fillRect(X(-F.HALF), Z(F.EZ + F.LEN), F.W * PX, F.EZ * PX);
  g.fillStyle = 'rgba(255,255,255,0.07)'; for (let i = 0; i < 6; i++) { g.fillRect(X(-F.HALF), Z(i), F.W * PX, PX * 0.5); g.fillRect(X(-F.HALF), Z(F.TOTAL - i - 1), F.W * PX, PX * 0.5); }
  // lines
  const line = (x0, z0, x1, z1, w, col = '#f5f3ea') => { g.strokeStyle = col; g.lineWidth = w * PX; g.beginPath(); g.moveTo(X(x0), Z(z0)); g.lineTo(X(x1), Z(z1)); g.stroke(); };
  const G0 = F.EZ, G1 = F.EZ + F.LEN;
  line(-F.HALF, G0, F.HALF, G0, 0.34); line(-F.HALF, G1, F.HALF, G1, 0.34);
  for (let y = 5; y < F.LEN; y += 5) line(-F.HALF, G0 + y, F.HALF, G0 + y, y % 10 === 0 ? 0.24 : 0.14);
  line(-F.HALF, 0, F.HALF, 0, 0.3); line(-F.HALF, F.TOTAL, F.HALF, F.TOTAL, 0.3);
  line(-F.HALF, 0, -F.HALF, F.TOTAL, 0.34); line(F.HALF, 0, F.HALF, F.TOTAL, 0.34);
  for (let y = 1; y < F.LEN; y++) for (const hx of [-3.4, 3.4]) line(hx - 0.32, G0 + y, hx + 0.32, G0 + y, 0.09);
  for (let y = 5; y < F.LEN; y += 5) for (const hx of [-F.HALF + 0.8, F.HALF - 0.8]) line(hx - 0.5, G0 + y, hx + 0.5, G0 + y, 0.1);
  // yard numbers, read from the user's end: 10 20 (half) 20 10 (shortened field: midfield is the 20)
  g.fillStyle = 'rgba(246,244,236,0.9)'; g.font = `800 ${Math.round(2.3 * PX)}px "Avenir Next Condensed","Arial Narrow",Arial,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const [y, t] of [[10, '10'], [20, '20'], [30, '10']]) for (const sx of [-1, 1]) { g.save(); g.translate(X(sx * 9.6), Z(G0 + y)); g.rotate(sx * Math.PI / 2); g.fillText(t, 0, 0); g.restore(); }
  const base = canvasOf(c.width, c.height); base.getContext('2d').drawImage(c, 0, 0);
  const redraw = (los, first) => {
    g.drawImage(base, 0, 0);
    const mark = (z, col) => { g.strokeStyle = col; g.lineWidth = 0.3 * PX; g.globalAlpha = 0.9; g.beginPath(); g.moveTo(X(-F.HALF), Z(z)); g.lineTo(X(F.HALF), Z(z)); g.stroke(); g.globalAlpha = 1; };
    if (first != null) mark(first, '#ffd24a');
    if (los != null) mark(los, '#4aa8ff');
    t.needsUpdate = true;
  };
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1;      // sim x grows to the right of the screen, world x to the left
  return { t, w: Wy, h: Hy, redraw };
}

function standTexture(THREE, seed) {
  const c = canvasOf(512, 128), g = c.getContext('2d');
  g.fillStyle = '#10201a'; g.fillRect(0, 0, 512, 128);
  const cols = ['#3a6bb8', '#b8483f', '#c99a3e', '#a9a595', '#3f7f5a', '#5f4a85', '#22404c', '#22404c', '#22404c', '#1d3640'], rnd = lcg(seed);
  for (let r = 0; r < 5; r++) { g.fillStyle = r % 2 ? '#162a30' : '#122329'; g.fillRect(0, 40 + r * 18, 512, 18); }
  for (let i = 0; i < 1800; i++) { g.fillStyle = cols[Math.floor(rnd() * cols.length)]; g.globalAlpha = 0.35 + rnd() * 0.25; g.fillRect(Math.floor(rnd() * 256) * 2, 38 + Math.floor(rnd() * 45) * 2, 2, 2); }
  g.globalAlpha = 1;
  const bc = ['#2f6fd6', '#d8453a', '#f2b441', '#2f8f55'];
  g.fillStyle = '#1a2c2e'; g.fillRect(0, 0, 512, 40);
  for (let i = 0; i < 8; i++) { g.fillStyle = bc[i % 4]; g.fillRect(i * 64 + 5, 8, 54, 24); }
  g.fillStyle = '#f2c230'; g.fillRect(496, 0, 16, 16);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildField(THREE) {
  const root = new THREE.Group(); root.name = 'field';
  const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, ...o });
  const tex = grassTexture(THREE);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(tex.w * YD, tex.h * YD), mat({ map: tex.t, roughness: 0.96 }));
  root.userData.setMarks = (losZ, firstZ) => tex.redraw(losZ, firstZ);
  plane.rotation.x = -Math.PI / 2; plane.position.set(0, 0, (F.TOTAL / 2) * YD); plane.receiveShadow = true; root.add(plane);
  // stands: four low walls painted with a crowd, merged into two meshes (the long pair and the short pair)
  const ox = (F.HALF + 6) * YD, z0 = -6 * YD, z1 = (F.TOTAL + 6) * YD, zc = (F.TOTAL / 2) * YD;
  const wallGeo = (len, cx, cz, rotY) => {
    const g = new THREE.BoxGeometry(len, 3.6, 0.5), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (len / 9));
    g.rotateY(rotY); g.translate(cx, 1.8, cz); return g;
  };
  const mergeUV = (geos) => {
    const pos = [], nor = [], uvs = [], idx = []; let base = 0;
    for (const g of geos) { const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uvs.push(u.getX(i), u.getY(i)); } for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base); base += p.count; }
    const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); m.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); m.setIndex(idx); return m;
  };
  const tx = standTexture(THREE, 3); tx.wrapS = THREE.RepeatWrapping;
  const lenL = 2 * ox + 1, lenS = z1 - z0;
  // goal posts: a yellow Y at the back of each end zone; their uvs point at a yellow block of the stands texture, so stands and posts are ONE mesh
  const pgeos = [];
  const post = (zGoal, dirOut) => {
    const z = zGoal + dirOut * 0.6;
    const add = (g, x, y, rz = 0) => { const q = g.clone(); if (rz) q.rotateZ(rz); q.translate(x, y, z); const uv = q.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.99, 0.97); pgeos.push(q); };
    add(new THREE.CylinderGeometry(0.09, 0.09, 3.0, 6), 0, 1.5); add(new THREE.CylinderGeometry(0.07, 0.07, 5.6, 6), 0, 3.0, Math.PI / 2);
    for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.06, 0.06, 5.6, 6), sx * 2.8, 5.8);
  };
  post(0, -1); post(F.TOTAL * YD, 1);
  root.add(new THREE.Mesh(mergeUV([wallGeo(lenL, 0, z0, 0), wallGeo(lenL, 0, z1, 0), wallGeo(lenS, ox, zc, Math.PI / 2), wallGeo(lenS, -ox, zc, Math.PI / 2), ...pgeos]), mat({ map: tx })));
  return root;
}

export function makeLineMarker(THREE, color) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(F.W * YD, 0.2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.02; m.renderOrder = 1; m.visible = false;
  return m;
}
export const FIELD3 = F;

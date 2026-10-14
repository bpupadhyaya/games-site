// The glima ring and its surroundings: a round mat that turns under the pair, a painted rim, stepped terraces with a small crowd, and
// one of three looks (Green Turf, Sports Hall, Winter Field). Everything is generated at load time (no image files).
const TAU = Math.PI * 2;
export const RING_R = 3.0;

const hash = (n) => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

function makeCanvas(n) { const c = document.createElement('canvas'); c.width = c.height = n; return c; }

// Ring surface textures, 1024 px = the ring diameter (6 m). Marks are large and high-contrast so the turning reads.
function ringTexture(kind) {
  const N = 1024, c = makeCanvas(N), g = c.getContext('2d'), R = N / 2;
  g.translate(R, R);
  if (kind === 'turf') {
    const gr = g.createRadialGradient(0, 0, 10, 0, 0, R); gr.addColorStop(0, '#6fb05a'); gr.addColorStop(1, '#4b8c42');
    g.fillStyle = gr; g.fillRect(-R, -R, N, N);
    g.fillStyle = 'rgba(255,255,255,0.07)'; for (let k = -8; k < 8; k += 2) g.fillRect(k * 64, -R, 64, N);
    // fine grass noise
    for (let i = 0; i < 9000; i++) { const a = hash(i) * TAU, r = Math.sqrt(hash(i + 7777)) * R; g.fillStyle = hash(i + 31) > 0.5 ? 'rgba(20,60,20,0.10)' : 'rgba(210,255,170,0.09)'; g.fillRect(Math.cos(a) * r, Math.sin(a) * r, 2, 5); }
  } else if (kind === 'hall') {
    g.fillStyle = '#c99a5b'; g.fillRect(-R, -R, N, N);
    for (let k = -9; k <= 9; k++) { g.fillStyle = k % 2 ? 'rgba(255,230,180,0.10)' : 'rgba(60,30,8,0.07)'; g.fillRect(k * 56 - 28, -R, 56, N); g.strokeStyle = 'rgba(70,40,14,0.42)'; g.lineWidth = 2; g.beginPath(); g.moveTo(k * 56 - 28, -R); g.lineTo(k * 56 - 28, R); g.stroke(); }
    for (let i = 0; i < 70; i++) { const x = (hash(i) - 0.5) * N, y = (hash(i + 99) - 0.5) * N; g.strokeStyle = 'rgba(80,45,15,0.18)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6, y + 30 + hash(i + 5) * 50); g.stroke(); }
  } else {
    const gr = g.createRadialGradient(0, 0, 10, 0, 0, R); gr.addColorStop(0, '#f2f6fb'); gr.addColorStop(1, '#d5e1ee');
    g.fillStyle = gr; g.fillRect(-R, -R, N, N);
    g.strokeStyle = 'rgba(90,120,165,0.26)'; g.lineWidth = 6;
    for (let k = 0; k < 16; k++) { const a = hash(k + 77) * TAU, r0 = 60 + hash(k) * 300; g.beginPath(); g.arc(Math.cos(a) * r0 * 0.5, Math.sin(a) * r0 * 0.5, 40 + hash(k + 9) * 110, a, a + 1.3); g.stroke(); }
    for (let i = 0; i < 6000; i++) { const a = hash(i) * TAU, r = Math.sqrt(hash(i + 4242)) * R; g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(Math.cos(a) * r, Math.sin(a) * r, 3, 3); }
  }
  // painted circles and the tick marks that turn with the mat
  const paint = kind === 'hall' ? ['#f4efe0', '#27466f'] : kind === 'snow' ? ['#27466f', '#b8452d'] : ['#f4efe0', '#b8452d'];
  g.lineWidth = 22; g.strokeStyle = paint[0]; g.beginPath(); g.arc(0, 0, R - 14, 0, TAU); g.stroke();
  g.lineWidth = 12; g.strokeStyle = paint[1]; g.beginPath(); g.arc(0, 0, R - 52, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 11;
  for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; g.beginPath(); g.moveTo(Math.cos(a) * (R - 150), Math.sin(a) * (R - 150)); g.lineTo(Math.cos(a) * (R - 100), Math.sin(a) * (R - 100)); g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 8; g.beginPath(); g.arc(0, 0, R * 0.68, 0, TAU); g.stroke();
  g.lineWidth = 8; for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; g.beginPath(); g.moveTo(Math.cos(a) * R * 0.64, Math.sin(a) * R * 0.64); g.lineTo(Math.cos(a) * R * 0.72, Math.sin(a) * R * 0.72); g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, R * 0.34, 0, TAU); g.stroke();
  return c;
}

function barrierTexture(kind) {
  const c = makeCanvas(1024), g = c.getContext('2d');
  const base = kind === 'hall' ? ['#1f3a5e', '#d9b45a'] : kind === 'snow' ? ['#27466f', '#e8eef6'] : ['#1c3f6e', '#f4efe0'];
  g.fillStyle = base[0]; g.fillRect(0, 0, 1024, 1024);
  for (let k = 0; k < 16; k++) { g.fillStyle = k % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)'; g.fillRect(k * 64, 0, 64, 1024); }
  g.fillStyle = base[1]; g.fillRect(0, 410, 1024, 36); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, 470, 1024, 8);
  return c;
}

function surroundTexture(kind) {
  const N = 512, c = makeCanvas(N), g = c.getContext('2d');
  if (kind === 'turf') { g.fillStyle = '#3d7235'; g.fillRect(0, 0, N, N); for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'; g.fillRect(0, k * 64, N, 64); } for (let i = 0; i < 6000; i++) { g.fillStyle = hash(i) > 0.5 ? 'rgba(10,50,10,0.12)' : 'rgba(200,255,160,0.09)'; g.fillRect(hash(i + 3) * N, hash(i + 11) * N, 2, 4); } }
  else if (kind === 'hall') { g.fillStyle = '#4a3320'; g.fillRect(0, 0, N, N); for (let k = 0; k < 16; k++) { g.fillStyle = k % 2 ? 'rgba(255,220,170,0.06)' : 'rgba(0,0,0,0.07)'; g.fillRect(k * 32, 0, 32, N); } }
  else { g.fillStyle = '#a9bccf'; g.fillRect(0, 0, N, N); for (let i = 0; i < 5000; i++) { g.fillStyle = 'rgba(255,255,255,0.30)'; g.fillRect(hash(i + 5) * N, hash(i + 13) * N, 3, 3); } }
  return c;
}

export function buildWorld(V3, stage, { quality = 'high' } = {}) {
  const { THREE } = V3;
  const root = new THREE.Group();
  const texCache = {};
  const tex = (key, canvasFn, repeat = 1) => {
    if (!texCache[key]) {
      const t = new THREE.CanvasTexture(canvasFn()); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, stage.renderer.capabilities.getMaxAnisotropy());
      if (repeat !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
      texCache[key] = t;
    }
    return texCache[key];
  };
  // ground beyond the terraces
  const groundMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; ground.receiveShadow = true; root.add(ground);
  // the mat
  const matMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
  const mat = new THREE.Mesh(new THREE.CircleGeometry(RING_R, 72), matMat); mat.rotation.x = -Math.PI / 2; mat.position.y = 0.004; mat.receiveShadow = true; root.add(mat);
  const matPivot = new THREE.Group(); // the mat is turned by yaw about the ring centre
  root.remove(mat); matPivot.add(mat); mat.rotation.set(-Math.PI / 2, 0, 0); root.add(matPivot);
  // a low rim (a rope roll) round the ring
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xf4efe0, roughness: 0.6 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(RING_R + 0.04, 0.045, 10, 72), rimMat); rim.rotation.x = Math.PI / 2; rim.position.y = 0.045; rim.castShadow = false; root.add(rim);
  // a low barrier (advertising-board height) round the ring and raked stands behind it with the spectators
  const STAND_IN = 4.5, STAND_OUT = 8.4, STAND_H = 2.1, ROWS = 4;
  const standMat = new THREE.MeshStandardMaterial({ color: 0x444a55, roughness: 0.9, side: THREE.DoubleSide });
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(STAND_OUT, STAND_IN, STAND_H, 64, 1, true), standMat); stand.position.y = 0.35 + STAND_H / 2; stand.receiveShadow = true; root.add(stand);
  const barrierMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.0, side: THREE.DoubleSide });
  const barrier = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 0.85, 72, 1, true), barrierMat); barrier.position.y = 0.425; barrier.castShadow = true; barrier.receiveShadow = true; root.add(barrier);
  const railMat = new THREE.MeshStandardMaterial({ color: 0xf4efe0, roughness: 0.5 });
  const rail = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.05, 8, 72), railMat); rail.rotation.x = Math.PI / 2; rail.position.y = 0.87; root.add(rail);
  const stepMat = standMat;
  // spectators: a flattened body sphere + a head sphere each, instanced, bobbing with the cheer
  const PER = [44, 52, 60, 68];
  const total = PER.reduce((a, b) => a + b, 0);
  const bodyGeo = new THREE.SphereGeometry(1, 12, 9), headGeo = new THREE.SphereGeometry(0.105, 10, 8);
  const bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ roughness: 0.85 }), total);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ roughness: 0.7 }), total);
  bodies.frustumCulled = false; heads.frustumCulled = false;
  root.add(bodies, heads);
  const crowd = [];
  { let n = 0; for (let r = 0; r < ROWS; r++) for (let k = 0; k < PER[r]; k++) { const rad = 5.05 + r * 0.95; crowd.push({ a: (k + (r % 2) * 0.5) / PER[r] * TAU, r, rad, y: 0.35 + (rad - STAND_IN) * (STAND_H / (STAND_OUT - STAND_IN)), h: hash(n * 17 + 3), i: n }); n++; } }
  const col = new THREE.Color(), mtx = new THREE.Matrix4(), qid = new THREE.Quaternion(), qy = new THREE.Quaternion(), vp = new THREE.Vector3(), vs = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  function paintCrowd(kind) {
    crowd.forEach((p) => {
      const hue = hash(p.i * 5 + 1);
      if (kind === 'snow') col.setHSL(hue, 0.26, 0.2 + 0.08 * hash(p.i + 4)); else if (kind === 'hall') col.setHSL(hue, 0.26, 0.14 + 0.06 * hash(p.i + 4)); else col.setHSL(hue, 0.28, 0.24 + 0.08 * hash(p.i + 4));
      bodies.setColorAt(p.i, col);
      const sk = [0xf0c19c, 0xe3a77f, 0xc88c66, 0x9a6743, 0xf3cdaa][Math.floor(hash(p.i * 3 + 9) * 5)];
      heads.setColorAt(p.i, col.set(sk));
    });
    bodies.instanceColor.needsUpdate = true; heads.instanceColor.needsUpdate = true;
  }
  function stepCrowd(t, cheer) {
    crowd.forEach((p) => {
      const bob = Math.max(0, Math.sin(t * (2.2 + p.h * 2.4) + p.h * 12)) * (0.015 + cheer * 0.11);
      const x = Math.sin(p.a) * p.rad, z = Math.cos(p.a) * p.rad;
      const sc = 0.74 + p.h * 0.14;
      qy.setFromAxisAngle(yAxis, p.a + Math.PI);
      mtx.compose(vp.set(x, p.y + 0.34 + bob, z), qy, vs.set(0.25 * sc, 0.24 * sc, 0.16 * sc)); bodies.setMatrixAt(p.i, mtx);
      mtx.compose(vp.set(x, p.y + 0.66 + bob * 1.1 * sc, z), qid, vs.set(sc, sc, sc)); heads.setMatrixAt(p.i, mtx);
    });
    bodies.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
  }
  // lanterns (snow) / lamps (hall): emissive spheres on thin poles round the terraces
  const lamps = new THREE.Group(); root.add(lamps);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 0.8 });
  const lampGlow = [];
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU + 0.1, rr = 6.6;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 2.4, 6), poleMat); pole.position.set(Math.sin(a) * rr, 2.6, Math.cos(a) * rr);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), lampMat); bulb.position.set(Math.sin(a) * rr, 3.7, Math.cos(a) * rr);
    lamps.add(pole, bulb); lampGlow.push(bulb);
  }
  // hall: a dark far wall
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(RING_R + 5.8, RING_R + 5.8, 6, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x2c2118, roughness: 0.95, side: THREE.BackSide }));
  wall.position.y = 3; root.add(wall);

  const LOOK = {
    turf: { light: 'day', ground: '#3d7235', crowd: 'turf', lamps: false, wall: false, sky: 0x9cc3e8, fog: 0xb9d3ea, fogFar: 70 },
    hall: { light: 'indoor', ground: '#4a3320', crowd: 'hall', lamps: true, wall: true, sky: 0x1d1a17, fog: 0x1d1a17, fogFar: 40 },
    snow: { light: 'evening', ground: '#a9bccf', crowd: 'snow', lamps: true, wall: false, sky: 0x8d9fbd, fog: 0xa6b4c9, fogFar: 60 },
  };
  let cur = null;
  function setRing(kind) {
    if (cur === kind) return;
    cur = kind;
    const L = LOOK[kind] || LOOK.turf;
    matMat.map = tex(`ring-${kind}`, () => ringTexture(kind)); matMat.needsUpdate = true;
    groundMat.map = tex(`sur-${kind}`, () => surroundTexture(kind), 12); groundMat.color.set(0xffffff); groundMat.needsUpdate = true;
    lamps.visible = L.lamps; wall.visible = L.wall;
    standMat.color.set(kind === 'snow' ? 0xdfe8f2 : kind === 'hall' ? 0x4a3322 : 0x4b5560);
    barrierMat.map = tex(`bar-${kind}`, () => barrierTexture(kind)); barrierMat.needsUpdate = true;
    rimMat.color.set(kind === 'hall' ? 0xf4efe0 : kind === 'snow' ? 0x27466f : 0xf4efe0);
    paintCrowd(kind);
    const base = { evening: { sky: 0x8d9fbd, fog: 0xa6b4c9, hemiSky: 0xcfdcff, hemiGround: 0x6a7288, hemi: 0.95, key: 0xffd9a8, keyI: 2.6, rim: 0x9db6ff, rimI: 1.0 } };
    stage.setLighting(L.light, base[L.light] || {});
    stage.setSky(L.sky, L.fog, { near: 9, far: L.fogFar });
    stage.invalidate();
  }
  function update(t, cheer, ang) {
    matPivot.rotation.y = ang;
    stepCrowd(t, cheer, ang);
  }
  return { root, setRing, update, mat, matPivot, get ring() { return cur; } };
}

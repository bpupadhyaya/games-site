// The set: a lacquered garden pavilion terrace at golden hour (polished board floor, red pillars with a tiled eave, a lattice balustrade, hanging paper
// lanterns, bamboo and pine, ink-wash hills in mist beyond). Presentation only; metres, +x towards the vase, +z towards the camera, y up.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { makePillar, makeLantern } from './models.js';

const TAU = Math.PI * 2;
const cvs = (w, h) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const ctex = (c, repeat) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };

export function boardsTexture() {
  const W = 1024, H = 1024, c = cvs(W, H), x = c.getContext('2d');
  const n = 12, bh = H / n;
  for (let i = 0; i < n; i++) {
    const base = 62 + hash(i) * 22;
    const g = x.createLinearGradient(0, i * bh, 0, (i + 1) * bh);
    g.addColorStop(0, `rgb(${base + 38},${base * 0.62 + 20},${base * 0.3 + 8})`); g.addColorStop(1, `rgb(${base + 22},${base * 0.55 + 14},${base * 0.26 + 6})`);
    x.fillStyle = g; x.fillRect(0, i * bh, W, bh);
    // grain streaks
    for (let k = 0; k < 90; k++) { x.fillStyle = `rgba(${hash(i * 90 + k) > 0.5 ? '20,8,2' : '255,200,140'},${0.04 + hash(k + i) * 0.07})`; x.fillRect(hash(k * 3 + i) * W, i * bh + hash(k + 11 + i) * bh, 40 + hash(k + 5) * 260, 1 + hash(k) * 1.6); }
    // butt joints
    x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(hash(i + 40) * W, i * bh, 3, bh);
    x.fillStyle = 'rgba(0,0,0,0.65)'; x.fillRect(0, i * bh, W, 3);
    x.fillStyle = 'rgba(255,210,150,0.12)'; x.fillRect(0, i * bh + 3, W, 2);
  }
  return ctex(c, true);
}

export function buildWorld(scene, { D = 2.4, quality = 'high', dusk = false } = {}) {
  const root = new THREE.Group(); root.name = 'world';
  scene.add(root);
  const anim = [];                                        // { fn(t, dt) }

  // ---- floor ------------------------------------------------------------------------------------------------------------------------
  const bt = boardsTexture(); bt.repeat.set(5, 1.5);
  const floorMat = new THREE.MeshPhysicalMaterial({ map: bt, roughness: 0.42, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.28, envMapIntensity: 0.9 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 9), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(1.2, 0, 0.9); floor.receiveShadow = true; root.add(floor);
  // a darker stone edge course along the back of the terrace and a step down into the garden
  const stone = new THREE.MeshStandardMaterial({ color: '#8c867a', roughness: 0.85 });
  const edge = new THREE.Mesh(new THREE.BoxGeometry(22, 0.28, 0.5), stone); edge.position.set(1.2, -0.14, -3.55); edge.receiveShadow = true; root.add(edge);

  // ---- pillars, eave beam, tiled roof edge --------------------------------------------------------------------------------------------
  const px = [-4.9, -1.9, 1.1, 4.1, 7.1];
  for (const x of px) { const p = makePillar(3.7, 0.17); p.position.set(x, 0, -2.4); root.add(p); }
  const lac = new THREE.MeshPhysicalMaterial({ color: '#8f2016', roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.25 });
  const gold = new THREE.MeshStandardMaterial({ color: '#d8a54a', metalness: 0.7, roughness: 0.38 });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(22, 0.34, 0.32), lac); beam.position.set(1.2, 3.55, -2.4); beam.castShadow = true; root.add(beam);
  const beam2 = new THREE.Mesh(new THREE.BoxGeometry(22, 0.16, 0.2), lac); beam2.position.set(1.2, 3.1, -2.4); root.add(beam2);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(22, 0.04, 0.34), gold); trim.position.set(1.2, 3.34, -2.4); root.add(trim);
  for (const x of px) { const gb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.34), gold); gb.position.set(x, 3.52, -2.4); root.add(gb); }
  // roof: a tiled slab with an upswept lip (ridged canvas), seen from below at the top of the screen
  const rc = cvs(512, 128), rx = rc.getContext('2d');
  rx.fillStyle = '#2d3a38'; rx.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 32; i++) { const g = rx.createLinearGradient(i * 16, 0, i * 16 + 16, 0); g.addColorStop(0, '#1b2624'); g.addColorStop(0.5, '#4b5f5a'); g.addColorStop(1, '#1b2624'); rx.fillStyle = g; rx.fillRect(i * 16, 0, 16, 128); }
  rx.fillStyle = 'rgba(0,0,0,0.45)'; for (let j = 0; j < 4; j++) rx.fillRect(0, j * 32 + 28, 512, 4);
  const rt = ctex(rc, true); rt.repeat.set(12, 1);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(22, 0.16, 2.8), new THREE.MeshStandardMaterial({ map: rt, roughness: 0.6, metalness: 0.1 }));
  roof.position.set(1.2, 4.35, -1.2); roof.rotation.x = 0.16; roof.castShadow = true; root.add(roof);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(22, 0.2, 0.16), new THREE.MeshStandardMaterial({ color: '#a8261a', roughness: 0.5 })); lip.position.set(1.2, 4.28, 0.15); lip.rotation.x = 0.16; root.add(lip);

  // ---- lattice balustrade -----------------------------------------------------------------------------------------------------------
  const rail = new THREE.Group();
  for (const y of [0.18, 0.62, 0.95]) { const r = new THREE.Mesh(new THREE.BoxGeometry(22, y > 0.9 ? 0.09 : 0.06, 0.09), lac); r.position.set(1.2, y, -2.15); r.castShadow = true; rail.add(r); }
  for (let x = -9.8; x < 12.2; x += 0.34) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.76, 0.05), lac); s.position.set(x, 0.56, -2.15); rail.add(s); }
  root.add(rail);

  // ---- lanterns ----------------------------------------------------------------------------------------------------------------------
  const lanterns = [];
  const lpos = [[-1.0, 2.35, -1.1], [1.7, 2.25, -1.6], [D * 1 + 1.9, 2.4, -1.1], [-3.4, 2.3, -1.5], [4.7, 2.3, -1.5]];
  lpos.forEach(([x, y, z], i) => {
    const l = makeLantern(i % 2 ? '#d8402a' : '#c9381f'); l.position.set(x, y, z);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 3.5 - y, 4), new THREE.MeshBasicMaterial({ color: '#17110d' })); cord.position.set(x, y + (3.5 - y) / 2 + 0.24, z);
    root.add(l, cord); lanterns.push({ l, x, y, z, ph: i * 1.7 });
    // glow sprite
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffa04a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    glow.scale.setScalar(1.7); l.add(glow);
  });
  anim.push((t) => { for (const L of lanterns) { const sw = Math.sin(t * 0.9 + L.ph) * 0.045 + Math.sin(t * 0.37 + L.ph * 2) * 0.03; L.l.rotation.z = sw; L.l.position.x = L.x + sw * 0.9; } });

  // ---- garden: bamboo clumps and a pine, then the shared photographic hills --------------------------------------------------------------
  const bamboo = new THREE.Group();
  const bmat = new THREE.MeshStandardMaterial({ color: '#4c8a4e', roughness: 0.6 });
  const leafT = leafTexture();
  const stalks = [];
  const clump = (cx, cz, n, hgt) => {
    for (let i = 0; i < n; i++) {
      const h = hgt * (0.8 + hash(i + cx) * 0.4), x = cx + (hash(i * 3 + cz) - 0.5) * 1.1, z = cz + (hash(i * 5 + cx) - 0.5) * 1.0;
      const st = new THREE.Group(); st.position.set(x, -0.3, z);
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, h, 8, 1), bmat); cyl.position.y = h / 2; st.add(cyl);
      for (let k = 1; k < 9; k++) { const nd = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.008, 4, 10), bmat); nd.rotation.x = Math.PI / 2; nd.position.y = (k / 9) * h; st.add(nd); }
      for (let k = 0; k < 5; k++) {
        const lf = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshBasicMaterial({ map: leafT, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, fog: true }));
        lf.position.set((hash(k + i) - 0.5) * 0.4, h * (0.7 + k * 0.06), 0); lf.rotation.set(0.2, hash(k + i * 7) * TAU, (hash(k + i * 3) - 0.5) * 0.8); st.add(lf);
      }
      bamboo.add(st); stalks.push({ st, ph: hash(i + cx) * TAU, h });
    }
  };
  clump(-3.6, -3.9, 9, 5.2); clump(-0.2, -5.2, 7, 4.6); clump(4.6, -4.4, 9, 5.4); clump(8.0, -4.8, 8, 4.8);
  root.add(bamboo);
  anim.push((t) => { for (const s of stalks) { s.st.rotation.z = Math.sin(t * 0.8 + s.ph) * 0.018 + Math.sin(t * 0.31 + s.ph * 2) * 0.012; } });
  // a gnarled pine behind the vase side
  const pine = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 0.9 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 4.2, 10), bark); trunk.position.y = 2; trunk.rotation.z = 0.08; pine.add(trunk);
  const needle = new THREE.MeshStandardMaterial({ color: '#25472f', roughness: 0.8 });
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.9 - i * 0.07, 14, 8), needle); b.scale.set(1.6, 0.4, 1.2); b.position.set(Math.sin(i * 2.1) * 0.7, 2.6 + i * 0.55, Math.cos(i * 1.7) * 0.4); pine.add(b); }
  pine.position.set(-5.4, -0.3, -5.5); root.add(pine);

  // far world: a jade lotus pond below the terrace and layered ink-wash ridges that fade into the mist
  const pond = new THREE.Mesh(new THREE.PlaneGeometry(160, 70), new THREE.MeshPhysicalMaterial({ color: '#3d625c', roughness: 0.1, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.3 }));
  pond.rotation.x = -Math.PI / 2; pond.position.set(2, -0.55, -38); root.add(pond);
  const leafMat = new THREE.MeshStandardMaterial({ map: lotusLeafTexture(), side: THREE.DoubleSide, roughness: 0.55, alphaTest: 0.4 });
  const NL = 70, leaves = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 20), leafMat, NL);
  const lm = new THREE.Matrix4(), lq = new THREE.Quaternion(), lp = new THREE.Vector3(), ls = new THREE.Vector3(), le = new THREE.Euler();
  for (let i = 0; i < NL; i++) {
    const sc = 0.5 + hash(i + 3) * 0.9;
    lp.set(-9 + hash(i) * 22, -0.53, -4.6 - hash(i + 9) * 9); le.set(-Math.PI / 2, 0, hash(i + 5) * TAU); lq.setFromEuler(le); ls.set(sc, sc, sc);
    lm.compose(lp, lq, ls); leaves.setMatrixAt(i, lm);
  }
  root.add(leaves);
  for (let i = 0; i < 9; i++) {
    const f = new THREE.Group();
    for (let k = 0; k < 8; k++) { const pt = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: k % 2 ? '#ffd1dc' : '#ffb3c6', roughness: 0.6, emissive: '#7a3a4a', emissiveIntensity: 0.25 })); pt.scale.set(0.5, 1.1, 0.25); pt.position.set(Math.cos(k * 0.785) * 0.1, 0.1, Math.sin(k * 0.785) * 0.1); pt.rotation.set(Math.sin(k * 0.785) * 0.5, 0, -Math.cos(k * 0.785) * 0.5); f.add(pt); }
    f.position.set(-8 + hash(i * 7 + 2) * 20, -0.5, -4.8 - hash(i * 5 + 1) * 8); root.add(f);
  }
  let scenery = null;
  const ridges = [[-24, '#8fa79a', 14, 0.7, 5], [-34, '#7b9a8c', 18, 0.8, 9], [-46, '#a7b8aa', 24, 0.55, 14]];
  ridges.forEach(([z, col, h, a, seed], k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(130, h), new THREE.MeshBasicMaterial({ map: ridgeTexture(col, seed, k), transparent: true, opacity: a, depthWrite: false, fog: false }));
    m.position.set(2, -0.9 + h / 2, z); root.add(m);
  });
  // a small pavilion roof far across the pond
  const far = new THREE.Group();
  const fm = new THREE.MeshBasicMaterial({ color: '#4d5f58', fog: false });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 1.2), fm); body.position.y = 0.4; far.add(body);
  const rf = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 1.9, 0.9, 4, 1), fm); rf.rotation.y = Math.PI / 4; rf.scale.set(1, 1, 0.55); rf.position.y = 1.2; far.add(rf);
  far.position.set(-7.5, -0.9, -17); root.add(far);

  // mist bands between the pavilion and the hills
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 5), new THREE.MeshBasicMaterial({ map: mistTexture(), transparent: true, opacity: 0.5 - i * 0.1, depthWrite: false, fog: false }));
    m.position.set(0, 0.6 + i * 0.5, -6.5 - i * 2.2); root.add(m);
  }
  if (!dusk) scene.background = skyTexture();
  return { root, update(t, dt, cam) { for (const f of anim) f(t, dt, cam); }, scenery, lanterns };
}

function ridgeTexture(col, seed, k) {
  const W = 1024, H = 256, c = cvs(W, H), x = c.getContext('2d');
  x.clearRect(0, 0, W, H);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, col); g.addColorStop(0.75, col); g.addColorStop(1, 'rgba(235,222,196,0.0)');
  x.fillStyle = g; x.beginPath(); x.moveTo(0, H);
  for (let i = 0; i <= W; i += 8) {
    const f = i / W, y = H * (0.42 - 0.2 * Math.sin(f * 6.1 + seed) - 0.12 * Math.sin(f * 15.3 + seed * 2.3) - 0.05 * Math.sin(f * 37 + seed) + 0.1 * k);
    x.lineTo(i, y);
  }
  x.lineTo(W, H); x.closePath(); x.fill();
  // mist band across the foot
  const m = x.createLinearGradient(0, H * 0.55, 0, H); m.addColorStop(0, 'rgba(240,226,200,0)'); m.addColorStop(1, 'rgba(240,226,200,0.9)');
  x.fillStyle = m; x.fillRect(0, H * 0.55, W, H * 0.45);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function lotusLeafTexture() {
  const c = cvs(128, 128), x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, '#6fae5a'); g.addColorStop(1, '#2f6a3a');
  x.fillStyle = g; x.beginPath(); x.moveTo(64, 64); x.arc(64, 64, 62, 0.25, TAU - 0.12); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(20,60,30,0.55)'; x.lineWidth = 1.4; for (let i = 0; i < 12; i++) { const a = 0.3 + i * 0.5; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.cos(a) * 60, 64 + Math.sin(a) * 60); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function skyTexture() {
  const c = cvs(4, 256), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#6f8aa0'); g.addColorStop(0.35, '#b9c2b0'); g.addColorStop(0.7, '#efd6a4'); g.addColorStop(1, '#f6e1b4');
  x.fillStyle = g; x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let _glow = null;
export function glowTex() {
  if (_glow) return _glow;
  const c = cvs(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); _glow = new THREE.CanvasTexture(c); _glow.colorSpace = THREE.SRGBColorSpace; return _glow;
}
function mistTexture() {
  const c = cvs(256, 64), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(250,236,210,0)'); g.addColorStop(0.5, 'rgba(250,236,210,0.8)'); g.addColorStop(1, 'rgba(250,236,210,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function leafTexture() {
  const c = cvs(128, 64), x = c.getContext('2d');
  for (let i = 0; i < 7; i++) {
    const a = -0.5 + i * 0.17; x.save(); x.translate(10, 32); x.rotate(a);
    x.fillStyle = i % 2 ? '#3d8a45' : '#2f7438'; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(50, -7, 116, 0); x.quadraticCurveTo(50, 7, 0, 0); x.fill(); x.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

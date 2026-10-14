// Static world around the course: palms, huts, drying nets and pulled-up pirogues on the beach, spectators on the sand, buoys and the
// start gate. World X = across the course (sea y), Z = -s (distance from the beach), Y up. Real sizes: palm 6-9 m, hut 3 m, buoy 0.9 m.
import { makeHull } from './hull.js';
const PALS = ['#d9453d', '#1fa39a', '#f0a81c', '#7c4dbb', '#3f9a4a', '#1b5fa8'];
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function frondTexture(THREE) {
  const c = cv(128, 256), x = c.getContext('2d'), r = rng(5);
  x.translate(64, 250); x.strokeStyle = '#2c6e32'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -240); x.stroke();
  for (let i = 0; i < 36; i++) {
    const y = -8 - i * 6.4, len = 58 * Math.sin((i + 1.5) / 38 * Math.PI) + 6;
    for (const sd of [-1, 1]) {
      const g = x.createLinearGradient(0, y, sd * len, y + 24); g.addColorStop(0, '#2f8a3f'); g.addColorStop(1, i % 2 ? '#52b04a' : '#3da34c');
      x.strokeStyle = g; x.lineWidth = 3.2;
      x.beginPath(); x.moveTo(0, y); x.quadraticCurveTo(sd * len * 0.55, y - 6, sd * len, y + 26 + r() * 8); x.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function palm(THREE, mats, seed) {
  const r = rng(seed), g = new THREE.Group();
  const H = 6 + r() * 3, lean = (r() - 0.5) * 1.1;
  const pts = []; for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push(new THREE.Vector3(Math.sin(u * 1.2) * lean * u, u * H, 0)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.2, 8), mats.trunk); trunk.castShadow = true; g.add(trunk);
  const top = pts[8];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + r() * 0.3;
    const f = new THREE.Mesh(mats.frondGeo, mats.frond); f.castShadow = true;
    f.position.copy(top); f.rotation.order = 'YXZ'; f.rotation.y = a; f.rotation.x = -0.35 - r() * 0.5;
    g.add(f);
  }
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mats.nut); nut.position.copy(top).add(new THREE.Vector3(0.1, -0.15, 0.1)); g.add(nut);
  g.userData.top = top; return g;
}
function hut(THREE, mats) {
  const g = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.9, 2.6), mats.wall); walls.position.y = 0.95; walls.castShadow = walls.receiveShadow = true; g.add(walls);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 2.7, 1.5, 4), mats.thatch); roof.rotation.y = Math.PI / 4; roof.scale.set(1.1, 1, 0.9); roof.position.y = 2.65; roof.castShadow = true; g.add(roof);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.3), new THREE.MeshStandardMaterial({ color: '#2a1a10' })); door.position.set(0, 0.65, 1.31); g.add(door);
  return g;
}
function net(THREE) {
  const c = cv(128, 128), x = c.getContext('2d'); x.clearRect(0, 0, 128, 128); x.strokeStyle = 'rgba(235,235,225,0.9)'; x.lineWidth = 1.4;
  for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16, 128); x.stroke(); x.beginPath(); x.moveTo(0, i * 16); x.lineTo(128, i * 16); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1.5);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.2), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 1 }));
  m.rotation.x = -Math.PI / 2 + 0.08; m.position.y = 0.12; return m;
}

export function buildWorld(THREE, scene, { quality = 'high' } = {}) {
  const root = new THREE.Group(); scene.add(root);
  const mats = {
    trunk: new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.95 }),
    frond: new THREE.MeshStandardMaterial({ map: frondTexture(THREE), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 }),
    nut: new THREE.MeshStandardMaterial({ color: '#5a3a1a', roughness: 0.9 }),
    wall: new THREE.MeshStandardMaterial({ color: '#c8a070', roughness: 0.95 }),
    thatch: new THREE.MeshStandardMaterial({ color: '#a9863f', roughness: 1 }),
  };
  // frond plane lies along +Z outward: rotate so its length is along +Z
  const frondGeo = new THREE.PlaneGeometry(2.6, 5.6); frondGeo.translate(0, 2.8, 0); frondGeo.rotateX(Math.PI / 2); frondGeo.rotateY(0);
  mats.frondGeo = frondGeo;
  const palms = new THREE.Group(); root.add(palms);
  const r = rng(77), nPalm = quality === 'low' ? 10 : 22;
  for (let i = 0; i < nPalm; i++) {
    const p = palm(THREE, mats, 100 + i), x = -70 + (i / (nPalm - 1)) * 140 + (r() - 0.5) * 5, z = 14 + r() * 24;
    p.position.set(x, 0, z); p.rotation.y = r() * 6.28; palms.add(p);
  }
  const huts = new THREE.Group(); root.add(huts);
  for (let i = 0; i < 6; i++) { const h = hut(THREE, mats); h.position.set(-62 + i * 24 + (r() - 0.5) * 8, 0, 20 + r() * 12); h.rotation.y = (r() - 0.5) * 0.7; huts.add(h); }
  const nets = new THREE.Group(); root.add(nets);
  for (let i = 0; i < 5; i++) { const n = net(THREE); n.position.set(-48 + i * 26 + r() * 6, 0, 9 + r() * 4); n.rotation.z = (r() - 0.5) * 0.5; nets.add(n); }
  // pulled-up pirogues resting on the sand
  const parked = [];
  for (let i = 0; i < 6; i++) {
    const hh = makeHull(THREE, { main: PALS[i % PALS.length], band: '#fff2d0', trim: '#183a4a', cap: '#fff' }, 40 + i);
    hh.group.position.set(-40 + i * 17 + (r() - 0.5) * 4, 0.1, 5.5 + r() * 2.5); hh.group.rotation.y = Math.PI / 2 + (r() - 0.5) * 0.35; hh.group.rotation.z = (r() - 0.5) * 0.12;
    root.add(hh.group); parked.push(hh);
  }
  // buoys and the start gate
  const buoys = [];
  const stripe = (() => { const c = cv(64, 64), x = c.getContext('2d'); x.fillStyle = '#fafafa'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#f26a21'; x.fillRect(0, 0, 32, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1); return t; })();
  for (let l = 0; l < 4; l++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 14), new THREE.MeshPhysicalMaterial({ map: stripe, roughness: 0.35, clearcoat: 0.6 })); body.scale.y = 0.9; body.castShadow = true; g.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 8, 24), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 })); ring.rotation.x = Math.PI / 2; ring.position.y = -0.05; g.add(ring);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 6), new THREE.MeshStandardMaterial({ color: '#e8e8e8' })); pole.position.y = 1.5; g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5, 6, 1), new THREE.MeshStandardMaterial({ color: '#f26a21', side: THREE.DoubleSide, roughness: 0.7 })); flag.position.set(0.45, 2.4, 0); g.add(flag);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.15, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide })); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.04; g.add(halo);
    root.add(g); buoys.push({ g, body, flag, halo });
  }
  const gates = [];
  for (let l = 0; l < 8; l++) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), new THREE.MeshStandardMaterial({ color: '#fff6e0' })); post.position.y = 0.8; g.add(post);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshStandardMaterial({ color: '#fff6e0', roughness: 0.4 })); b.position.y = 0.02; g.add(b);
    const pen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), new THREE.MeshStandardMaterial({ color: '#1b5fa8', side: THREE.DoubleSide })); pen.position.set(0.25, 1.45, 0); g.add(pen);
    root.add(g); gates.push({ g, pen });
  }
  return { root, palms, huts, nets, parked, buoys, gates };
}

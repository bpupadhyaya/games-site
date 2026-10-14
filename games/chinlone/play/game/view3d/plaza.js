// The village festival courtyard, the woven cane ball and the dancers' costume: all procedural, cheap meshes (instanced where
// repeated), three palettes. Setting: a Myanmar village festival ground at the edge of a teak-and-bamboo village (teak hall on a
// raised floor, stilt houses, coconut palms, festival bunting and paper lanterns, hazy hills). Secular, no shrines.
import { THREE } from '../vendor3d/index.js';
import { RING, N, dancerAngle } from '../src/sim.js';

export const YARDS3D = [
  { name: 'Village Green', light: 'day', lightExtra: { exposure: 1.0, hemi: 0.9 }, sky: '#bcd9ea', fog: '#d6e4e6', ground: '#c9a977', ground2: '#b08e5c', grass: '#6f9a4a', grass2: '#4f7e3a', stone: '#e3cf9f', inlay: '#a9391f', inlay2: '#1f6e66', wall: '#efe6cf', roof: '#7a2e1c', lanterns: false, bunting: true, hills: '#8fb0a8' },
  { name: 'Golden Hour', light: 'evening', lightExtra: { exposure: 1.0 }, sky: '#f2b884', fog: '#f1c9a2', ground: '#d6aa6c', ground2: '#b98a4c', grass: '#8a9a52', grass2: '#667a38', stone: '#efd6a4', inlay: '#a8431f', inlay2: '#c88a1e', wall: '#f6e2bd', roof: '#8a3318', lanterns: false, bunting: true, hills: '#c79a82' },
  { name: 'Lantern Night', light: 'night', lightExtra: { exposure: 1.1, hemi: 0.8, keyI: 2.1 }, sky: '#0f1b3a', fog: '#18284c', ground: '#6c6a6a', ground2: '#555458', grass: '#35603f', grass2: '#2a5035', stone: '#a5adc2', inlay: '#e08b3a', inlay2: '#4aa6a0', wall: '#a9b1c6', roof: '#4a2a2a', lanterns: true, bunting: true, hills: '#26365e' },
];

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}
const rngMaker = (seed) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });
const TAU = Math.PI * 2;

// a coconut palm: curved trunk and a crown of arched fronds, one merged geometry (instanced by the caller)
function palmGeometry() {
  const parts = [];
  const trunkPts = [];
  const H = 7.2;
  for (let i = 0; i <= 10; i++) { const t = i / 10; trunkPts.push(new THREE.Vector3(Math.sin(t * 1.6) * 0.5 * t, t * H, 0)); }
  const curve = new THREE.CatmullRomCurve3(trunkPts);
  const trunk = new THREE.TubeGeometry(curve, 14, 0.2, 7, false);
  const pos = trunk.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const yv = pos.getY(i), t = Math.max(0, Math.min(1, yv / H)), k = 1 - 0.38 * t, c = curve.getPoint(t);
    pos.setX(i, c.x + (pos.getX(i) - c.x) * k); pos.setZ(i, pos.getZ(i) * k);
  }
  const col = (g, hex) => { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const t0 = trunk.toNonIndexed(); t0.deleteAttribute('uv'); parts.push(col(t0, '#8a6a44'));
  const top = curve.getPoint(1);
  const nF = 11;
  for (let f = 0; f < nF; f++) {
    const ang = (f / nF) * TAU + (f % 2) * 0.25, len = 3.1 + (f % 3) * 0.35;
    const seg = 7, g = new THREE.BufferGeometry(), v = [], idx = [];
    for (let s = 0; s <= seg; s++) {
      const t = s / seg, r = t * len, w = 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.02, dy = Math.sin(t * 1.2) * 1.0 - t * t * 1.7;
      v.push(r, dy, -w, r, dy + 0.06, w);
    }
    for (let s = 0; s < seg; s++) { const a = s * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx);
    g.rotateY(ang); g.translate(top.x, top.y, 0);
    const ng = g.toNonIndexed(); ng.computeVertexNormals();
    parts.push(col(ng, f % 2 ? '#4f7e2e' : '#6a9a3a'));
  }
  const bunch = new THREE.SphereGeometry(0.2, 7, 5); bunch.translate(top.x, top.y - 0.2, 0);
  const b0 = bunch.toNonIndexed(); b0.deleteAttribute('uv'); parts.push(col(b0, '#6b4a22'));
  let n = 0; for (const p of parts) n += p.attributes.position.count;
  const P = new Float32Array(n * 3), Nn = new Float32Array(n * 3), Cc = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    if (!p.attributes.normal) p.computeVertexNormals();
    P.set(p.attributes.position.array, o * 3); Nn.set(p.attributes.normal.array, o * 3); Cc.set(p.attributes.color.array, o * 3); o += p.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); g.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
  return g;
}

// the teak hall: raised floor on posts, bamboo back wall, two-tier red roof with a ridge finial
function teakHall(y, w = 12, d = 5.4) {
  const g = new THREE.Group();
  const teak = std('#6e4424', { roughness: 0.7 }), dark = std('#4a2c14', { roughness: 0.7 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, d), teak); floor.position.y = 1.0; floor.receiveShadow = true; floor.castShadow = true; g.add(floor);
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.17, 0.2, 3.6, 8), dark, 14);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 7; i++) for (let j = 0; j < 2; j++) { m4.makeTranslation(-w / 2 + 0.5 + (i * (w - 1)) / 6, 1.8, (j ? 1 : -1) * (d / 2 - 0.4)); posts.setMatrixAt(i * 2 + j, m4); }
  posts.castShadow = true; g.add(posts);
  const stilts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.17, 1.0, 6), dark, 8);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { m4.makeTranslation(-w / 2 + 0.7 + (i * (w - 1.4)) / 3, 0.5, (j ? 1 : -1) * (d / 2 - 0.5)); stilts.setMatrixAt(i * 2 + j, m4); }
  g.add(stilts);
  const mat = canvasTex(128, 128, (c, ww, hh) => {
    c.fillStyle = '#c4a468'; c.fillRect(0, 0, ww, hh);
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { c.fillStyle = (i + j) % 2 ? '#a9894e' : '#d7bb82'; c.fillRect(i * 8, j * 8, 7, 7); }
  }, [6, 1]);
  const back = new THREE.Mesh(new THREE.BoxGeometry(w - 0.4, 2.4, 0.12), std('#ffffff', { map: mat })); back.position.set(0, 2.5, d / 2 - 0.25); back.castShadow = true; g.add(back);
  const roofMat = std(y.roof, { roughness: 0.75, side: THREE.DoubleSide });
  const hip = (rw, rd, rh, py) => {
    const geo = new THREE.CylinderGeometry(0.0001, 1, 1, 4, 1, true); geo.rotateY(Math.PI / 4);
    const m = new THREE.Mesh(geo, roofMat); m.scale.set(rw / 1.414, rh, rd / 1.414); m.position.y = py; m.castShadow = true; return m;
  };
  g.add(hip(w + 2.0, d + 1.8, 1.7, 4.65));
  g.add(hip(w * 0.6, d * 0.7, 1.3, 5.9));
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 5), std('#d9a43c', { metalness: 0.6, roughness: 0.4 })); ridge.position.y = 6.9; g.add(ridge);
  const fas = new THREE.Mesh(new THREE.BoxGeometry(w + 1.4, 0.18, 0.08), std('#c88a1e', { roughness: 0.55, metalness: 0.2 })); fas.position.set(0, 3.5, -d / 2 - 0.55); g.add(fas);
  return g;
}

// a stilt house: floor on posts, plank walls, thatch hip roof
function stiltHouse(s = 1) {
  const g = new THREE.Group();
  const teak = std('#7a5330', { roughness: 0.8 }), dark = std('#4a2c14');
  const post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.12, 1.6, 6), dark, 6);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { m4.makeTranslation(-1.9 + i * 1.9, 0.8, j ? 1.4 : -1.4); post.setMatrixAt(i * 2 + j, m4); }
  g.add(post);
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.2, 3.4), teak); body.position.y = 2.7; body.castShadow = true; g.add(body);
  const geo = new THREE.CylinderGeometry(0.0001, 1, 1, 4, 1, true); geo.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(geo, std('#8a6a34', { roughness: 1, side: THREE.DoubleSide })); roof.scale.set(3.9, 1.7, 3.0); roof.position.y = 4.65; roof.castShadow = true; g.add(roof);
  g.scale.setScalar(s);
  return g;
}

export function buildPlaza(stage, y) {
  const g = new THREE.Group(); g.name = 'plaza';
  const rnd = rngMaker(7);
  const anim = [];   // per-frame updaters (bunting and palm sway)
  g.userData.anim = anim;
  const earth = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = y.ground; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 3600; i++) { c.fillStyle = rnd() > 0.5 ? y.ground2 : 'rgba(255,255,255,0.08)'; c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 2); }
    for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(70,50,20,0.18)'; c.beginPath(); c.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 10, 3 + rnd() * 5, rnd() * 3, 0, TAU); c.fill(); }
  }, [14, 14]);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(70, 56), new THREE.MeshStandardMaterial({ map: earth, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.004; ground.receiveShadow = true; g.add(ground);
  const lawn = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = y.grass; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2800; i++) { c.fillStyle = rnd() > 0.5 ? y.grass2 : 'rgba(255,255,255,0.07)'; c.fillRect(rnd() * w, rnd() * h, 1.5 + rnd() * 2, 1 + rnd() * 3); }
  }, [26, 6]);
  const band = new THREE.Mesh(new THREE.RingGeometry(11, 70, 56, 1), new THREE.MeshStandardMaterial({ map: lawn, roughness: 1 }));
  band.rotation.x = -Math.PI / 2; band.position.y = 0.002; band.receiveShadow = true; g.add(band);

  // the inlaid dance circle: laid brick tiles, a lotus-petal star at the centre, six dancer marks
  const S = 1024, RAD = 3.3;
  const tex = canvasTex(S, S, (c, w, h) => {
    const cx = w / 2, cy = h / 2, k = w / (2 * RAD);
    c.fillStyle = y.stone; c.beginPath(); c.arc(cx, cy, RAD * k, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.arc(cx, cy, RAD * k, 0, TAU); c.clip();
    c.strokeStyle = 'rgba(90,60,30,0.22)'; c.lineWidth = 1.2;
    for (let yy = 0; yy < h; yy += 22) { c.beginPath(); c.moveTo(0, yy); c.lineTo(w, yy); c.stroke(); for (let xx = ((yy / 22) % 2) * 22; xx < w; xx += 44) { c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx, yy + 22); c.stroke(); } }
    const id = c.getImageData(0, 0, w, h);
    for (let i = 0; i < id.data.length; i += 4) { const n = (rnd() - 0.5) * 16; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
    c.putImageData(id, 0, 0);
    c.lineWidth = 0.16 * k; c.strokeStyle = y.inlay; c.beginPath(); c.arc(cx, cy, (RAD - 0.14) * k, 0, TAU); c.stroke();
    c.lineWidth = 0.05 * k; c.strokeStyle = y.inlay2; c.beginPath(); c.arc(cx, cy, (RAD - 0.36) * k, 0, TAU); c.stroke();
    c.lineWidth = 0.05 * k; c.strokeStyle = y.inlay; c.beginPath(); c.arc(cx, cy, (RAD - 0.48) * k, 0, TAU); c.stroke();
    for (let i = 0; i < 48; i++) { const a = (i / 48) * TAU, r = (RAD - 0.24) * k; c.fillStyle = i % 2 ? y.inlay2 : y.inlay; c.beginPath(); c.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.045 * k, 0, TAU); c.fill(); }
    c.lineWidth = 0.035 * k; c.strokeStyle = 'rgba(80,50,30,0.55)'; c.beginPath(); c.arc(cx, cy, RING * k, 0, TAU); c.stroke();
    for (let j = 0; j < N; j++) {
      const a = dancerAngle(j), px = cx + Math.sin(a) * RING * k, py = cy + Math.cos(a) * RING * k;
      c.fillStyle = j % 2 ? y.inlay2 : y.inlay; c.beginPath(); c.arc(px, py, 0.13 * k, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 0.025 * k; c.beginPath(); c.arc(px, py, 0.2 * k, 0, TAU); c.stroke();
    }
    c.translate(cx, cy);
    for (let i = 0; i < 12; i++) { c.rotate(Math.PI / 6); c.fillStyle = i % 2 ? y.inlay : y.inlay2; c.beginPath(); c.moveTo(0, -0.16 * k); c.lineTo(0.2 * k, -0.9 * k); c.lineTo(0, -1.15 * k); c.lineTo(-0.2 * k, -0.9 * k); c.closePath(); c.globalAlpha = 0.6; c.fill(); c.globalAlpha = 1; }
    c.restore();
  });
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(RAD, 72), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.01; plaza.receiveShadow = true;
  tex.flipY = true; tex.needsUpdate = true;
  g.add(plaza);
  const kerb = new THREE.Mesh(new THREE.TorusGeometry(RAD + 0.08, 0.09, 8, 96), std(y.stone, { roughness: 0.9 }));
  kerb.rotation.x = Math.PI / 2; kerb.position.y = 0.05; kerb.castShadow = true; kerb.receiveShadow = true; g.add(kerb);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), AY = new THREE.Vector3(0, 1, 0);
  // low whitewashed village wall behind (an arc open toward the camera)
  const wallN = 34, wall = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 1.5, 0.28), std(y.wall, { roughness: 0.95 }), wallN);
  const cap = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.14, 0.4), std(y.roof, { roughness: 0.8 }), wallN);
  for (let i = 0; i < wallN; i++) {
    const a = ((i / (wallN - 1)) - 0.5) * 2 * 2.3, r = 11.5;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    q.setFromAxisAngle(AY, a);
    m4.compose(new THREE.Vector3(x, 0.75, z), q, sc); wall.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, 1.57, z), q, sc); cap.setMatrixAt(i, m4);
  }
  wall.castShadow = true; wall.receiveShadow = true; g.add(wall); g.add(cap);

  const hall = teakHall(y); hall.position.set(0, 0, 17.5); g.add(hall);
  [[-13.5, 14, 0.5, 1.15], [14, 15, -0.6, 1.0], [-19, 4, 1.2, 1.2], [20, 3, -1.3, 1.1]].forEach(([x, z, r, s]) => { const h = stiltHouse(s); h.position.set(x, 0, z); h.rotation.y = r; g.add(h); });

  const palmN = 18, palms = new THREE.InstancedMesh(palmGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), palmN);
  const palmBase = [];
  for (let i = 0; i < palmN; i++) {
    const a = ((i + 0.5) / palmN - 0.5) * 2 * 2.6 + (rnd() - 0.5) * 0.15, r = 10.5 + rnd() * 8, s = 0.85 + rnd() * 0.55;
    palmBase.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, s, ry: rnd() * TAU });
  }
  const eul = new THREE.Euler();
  const setPalms = (t) => {
    for (let i = 0; i < palmN; i++) {
      const p = palmBase[i], sway = Math.sin(t * 0.9 + i * 1.7) * 0.025;
      eul.set(sway, p.ry, sway * 0.6); q.setFromEuler(eul);
      m4.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(p.s, p.s, p.s)); palms.setMatrixAt(i, m4);
    }
    palms.instanceMatrix.needsUpdate = true;
  };
  setPalms(0); palms.castShadow = true; palms.frustumCulled = false; g.add(palms);
  anim.push(setPalms);
  const crown = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), std(y.grass2, { roughness: 1 }), 24);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.3, 3, 6), std('#5b3f26', { roughness: 1 }), 24);
  for (let i = 0; i < 24; i++) {
    const a = ((i + 0.3) / 24 - 0.5) * 2 * 2.9, r = 19 + rnd() * 8, s = 2.6 + rnd() * 1.8;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    m4.makeScale(s, s * 0.85, s).setPosition(x, 3.5 + s * 0.4, z); crown.setMatrixAt(i, m4);
    m4.makeTranslation(x, 1.5, z); trunk.setMatrixAt(i, m4);
  }
  g.add(crown); g.add(trunk);
  const bush = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), std(y.grass2, { roughness: 1 }), 26);
  for (let i = 0; i < 26; i++) {
    const a = ((i + rnd()) / 26 - 0.5) * 2 * 2.5, r = 12.2 + rnd() * 1.4, s = 0.5 + rnd() * 0.7;
    m4.makeScale(s * 1.3, s * 0.8, s * 1.3).setPosition(Math.sin(a) * r, s * 0.35, Math.cos(a) * r); bush.setMatrixAt(i, m4);
  }
  g.add(bush);
  const hillMat = new THREE.MeshBasicMaterial({ color: y.hills, fog: true });
  for (let i = 0; i < 7; i++) {
    const a = ((i + 0.5) / 7 - 0.5) * 2 * 1.5, r = 62, hs = 9 + (i % 3) * 5;
    const hill = new THREE.Mesh(new THREE.CylinderGeometry(0, hs * 1.8, hs, 14), hillMat);
    hill.position.set(Math.sin(a) * r, hs / 2 - 0.5, Math.cos(a) * r); g.add(hill);
  }

  // festival bunting: two catenary strings of pennants across the back of the ring (flap in the breeze)
  if (y.bunting) {
    const cols = ['#d8372a', '#f2b632', '#2a9a7a', '#2f6fb8', '#e25d93', '#f4ede0'];
    const nP = 44, pen = new THREE.InstancedMesh(new THREE.CylinderGeometry(0, 0.17, 0.46, 3), new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }), nP);
    pen.frustumCulled = false;
    for (let i = 0; i < nP; i++) pen.setColorAt(i, new THREE.Color(cols[i % cols.length]));
    const strings = [{ a: [-9, 4.4, 5.5], b: [0, 5.0, 9.5], n: 22 }, { a: [0, 5.0, 9.5], b: [9, 4.4, 5.5], n: 22 }];
    const set = (t) => {
      let k = 0;
      for (const s of strings) for (let i = 0; i < s.n; i++) {
        const u = (i + 0.5) / s.n;
        const x = s.a[0] + (s.b[0] - s.a[0]) * u, z = s.a[2] + (s.b[2] - s.a[2]) * u, yy = s.a[1] + (s.b[1] - s.a[1]) * u - Math.sin(u * Math.PI) * 0.9;
        const flap = Math.sin(t * 2.1 + i * 0.9 + k) * 0.22;
        eul.set(Math.PI + flap * 0.4, 0, flap); q.setFromEuler(eul);
        m4.compose(new THREE.Vector3(x, yy - 0.2, z), q, sc); pen.setMatrixAt(k++, m4);
      }
      pen.instanceMatrix.needsUpdate = true;
    };
    set(0); g.add(pen); anim.push(set);
    const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-9, 4.4, 5.5), new THREE.Vector3(-4.5, 4.2, 7.6), new THREE.Vector3(0, 5.0, 9.5), new THREE.Vector3(4.5, 4.2, 7.6), new THREE.Vector3(9, 4.4, 5.5)]), 24, 0.012, 4), std('#5a4a30'));
    g.add(rope);
  }
  // paper lanterns on poles (glow at night, still pretty by day)
  {
    const nL = 10, lampMat = new THREE.MeshStandardMaterial({ color: '#ffb25a', emissive: new THREE.Color('#ff9a3a'), emissiveIntensity: y.lanterns ? 2.2 : 0.35, roughness: 0.6 });
    const lamp = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 12, 9), lampMat, nL);
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.04, 2.5, 6), std('#4a3018'), nL);
    for (let i = 0; i < nL; i++) {
      const a = ((i + 0.5) / nL - 0.5) * 2 * 2.2, r = 9.4 + (i % 2) * 0.9;
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      m4.makeScale(1, 1.25, 1).setPosition(x, 2.55, z); lamp.setMatrixAt(i, m4);
      m4.makeTranslation(x, 1.25, z); pole.setMatrixAt(i, m4);
    }
    g.add(lamp); g.add(pole);
  }
  stage.add(g);
  return g;
}

// ---- the cane ball ------------------------------------------------------------------------------------------------------
// Real size: a chinlone ball is about 12.5 cm across, woven from six rattan strips into twelve pentagonal openings. Shown at
// about 1.3x for readability (radius 0.082 m).
export const BALL_R = 0.082;
export function buildBall() {
  const grp = new THREE.Group();
  const inner = new THREE.Group();
  const cane = new THREE.MeshStandardMaterial({ color: '#d8a65c', roughness: 0.5, metalness: 0, emissive: new THREE.Color('#4a2c0a'), emissiveIntensity: 0.4 });
  const phi = (1 + Math.sqrt(5)) / 2;
  const axes = [[0, 1, phi], [0, 1, -phi], [1, phi, 0], [1, -phi, 0], [phi, 0, 1], [phi, 0, -1]];
  const up = new THREE.Vector3(0, 0, 1);
  axes.forEach((a, i) => {
    const n = new THREE.Vector3(...a).normalize();
    const geo = new THREE.TorusGeometry(BALL_R, BALL_R * 0.115, 7, 54);
    geo.scale(1, 1, 0.6);
    const m = new THREE.Mesh(geo, cane); m.quaternion.setFromUnitVectors(up, n);
    m.scale.setScalar(1 + (i % 2) * 0.012);
    m.castShadow = true; inner.add(m);
  });
  inner.add(new THREE.Mesh(new THREE.SphereGeometry(BALL_R * 0.93, 16, 12), new THREE.MeshBasicMaterial({ color: '#241408' })));
  grp.add(inner);
  const halo = canvasTex(64, 64, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,226,150,0.7)'); gr.addColorStop(1, 'rgba(255,200,100,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0.28 }));
  sp.scale.set(0.55, 0.55, 1); sp.renderOrder = 5; grp.add(sp);
  grp.userData.ball = inner; grp.userData.halo = sp;
  return grp;
}
export function buildShadowBlob() {
  const tex = canvasTex(64, 64, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.016; m.renderOrder = 2;
  return m;
}

// ---- costume: Myanmar festival dress on the shared athlete characters ---------------------------------------------------------
// Hitched longyi (pasoe / htamein tucked up above the knee, in a checked weave), a knotted waist sash with two swinging tails, a
// headband (men) or a jasmine spray (women). Built in the rest pose and attached to the skeleton, so the pose layer drives it.
const LONGYI = [
  { a: '#1f4f8a', b: '#e8d9a8', c: '#7a1f3d' }, { a: '#7a1f3d', b: '#f0dcc0', c: '#1f5f4a' }, { a: '#1f6f55', b: '#f2e6c0', c: '#a8431f' },
  { a: '#a8431f', b: '#f6e2b0', c: '#2a3f7a' }, { a: '#43366b', b: '#e8dcc0', c: '#c28a1f' }, { a: '#c28a1f', b: '#2a3f7a', c: '#7a1f3d' },
];
function checkTex(p) {
  return canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = p.a; c.fillRect(0, 0, w, h);
    c.fillStyle = p.b; for (let i = 0; i < 4; i++) { c.fillRect(i * 32 + 12, 0, 6, h); c.fillRect(0, i * 32 + 12, w, 6); }
    c.fillStyle = p.c; c.globalAlpha = 0.55; for (let i = 0; i < 4; i++) { c.fillRect(i * 32, 0, 5, h); c.fillRect(0, i * 32, w, 5); } c.globalAlpha = 1;
  }, [1, 2]);
}
const _q = new THREE.Quaternion();

export function dress(h, idx, female) {
  const b = h.bones, B = (n) => b[`Bip01_${n}`];
  h.root.updateMatrixWorld(true);
  const pal = LONGYI[idx % LONGYI.length], tex = checkTex(pal);
  const cloth = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, side: THREE.DoubleSide });
  const added = [];
  for (const s of (female ? [] : ['L', 'R'])) {
    const th = B(`${s}_Thigh`), ca = B(`${s}_Calf`);
    const a = th.getWorldPosition(new THREE.Vector3()), c = ca.getWorldPosition(new THREE.Vector3());
    const len = a.distanceTo(c), dir = c.clone().sub(a).normalize();
    const geo = new THREE.CylinderGeometry(female ? 0.152 : 0.124, female ? 0.128 : 0.098, len * 0.93 + 0.1, 14, 1, false);
    geo.translate(0, -len * 0.93 / 2 + 0.05, 0);
    const m = new THREE.Mesh(geo, cloth); m.castShadow = true;
    m.position.copy(a).add(new THREE.Vector3(0, 0.02, 0));
    _q.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir); m.quaternion.copy(_q);
    h.root.add(m); th.attach(m); added.push(m);
  }
  const pel = B('Pelvis').getWorldPosition(new THREE.Vector3());
  const roll = new THREE.TorusGeometry(1, 0.075, 8, 28); roll.rotateX(Math.PI / 2); roll.scale(0.15, 1.1, 0.108);
  const rm = new THREE.Mesh(roll, cloth); rm.position.set(0, pel.y + 0.0, 0.005); rm.castShadow = true; h.root.add(rm); B('Spine').attach(rm); added.push(rm);
  const sashMat = new THREE.MeshStandardMaterial({ color: '#f6f0de', roughness: 0.85 });
  const band = new THREE.TorusGeometry(1, 0.03, 6, 28); band.rotateX(Math.PI / 2); band.scale(0.158, 1.2, 0.116);
  const bm = new THREE.Mesh(band, sashMat); bm.position.set(0, pel.y + 0.07, 0.005); h.root.add(bm); B('Spine').attach(bm); added.push(bm);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), sashMat); knot.position.set(0.158, pel.y + 0.06, 0.04); h.root.add(knot); B('Spine').attach(knot); added.push(knot);
  const tails = [];
  for (let k = 0; k < 2; k++) {
    const geo = new THREE.PlaneGeometry(0.045, 0.3, 1, 5); geo.translate(0, -0.15, 0);
    const t = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: k ? pal.c : '#f6f0de', roughness: 0.85, side: THREE.DoubleSide }));
    t.position.set(0.158 + k * 0.012, pel.y + 0.05, 0.045 + k * 0.01); t.castShadow = true;
    h.root.add(t); B('Spine').attach(t); added.push(t); tails.push(t);
  }
  const head = B('Head').getWorldPosition(new THREE.Vector3());
  if (!female) {
    const hb = new THREE.TorusGeometry(1, 0.016, 6, 32); hb.rotateX(Math.PI / 2 - 0.12); hb.scale(0.083, 1, 0.098);
    const hm = new THREE.Mesh(hb, new THREE.MeshStandardMaterial({ color: '#f4efe0', roughness: 0.8 })); hm.position.set(0, head.y + 0.115, 0.004); h.root.add(hm); B('Head').attach(hm); added.push(hm);
  } else {
    const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 6, 5), new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 0.6, emissive: new THREE.Color('#403a30'), emissiveIntensity: 0.5 }), 9);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 9; i++) { const a = i * 0.7; m4.makeTranslation(-0.058 + Math.cos(a) * 0.022, head.y + 0.1 + Math.sin(a) * 0.022, -0.045 + (i % 3) * 0.016); fl.setMatrixAt(i, m4); }
    h.root.add(fl); B('Head').attach(fl); added.push(fl);
  }
  return { added, tails };
}

// ---- dust and cane-fleck puffs (contact physics) -----------------------------------------------------------------------------
export function buildPuffs(n = 24) {
  const tex = canvasTex(64, 64, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(236,214,170,0.85)'); gr.addColorStop(0.6, 'rgba(226,200,150,0.35)'); gr.addColorStop(1, 'rgba(220,190,140,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  const grp = new THREE.Group(); const list = [];
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false; grp.add(s); list.push({ s, t: 1, d: 1, vx: 0, vy: 0, vz: 0, r0: 0.1 });
  }
  let k = 0, seed = 11;
  const r = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  return {
    group: grp,
    emit(x, y, z, count = 3, size = 0.26, up = 0.5) {
      for (let c = 0; c < count; c++) {
        const p = list[k++ % n];
        p.t = 0; p.d = 0.55 + r() * 0.35; p.r0 = size * (0.6 + r() * 0.6);
        p.vx = (r() - 0.5) * 0.9; p.vz = (r() - 0.5) * 0.9; p.vy = up * (0.5 + r() * 0.8);
        p.s.position.set(x, y, z); p.s.visible = true;
      }
    },
    update(dt) {
      for (const p of list) {
        if (p.t >= p.d) { p.s.visible = false; continue; }
        p.t += dt; const u = Math.min(1, p.t / p.d);
        p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt * (1 - u); p.s.position.z += p.vz * dt;
        const sc = p.r0 * (1 + 2.2 * u); p.s.scale.set(sc, sc, 1); p.s.material.opacity = 0.7 * (1 - u) * Math.min(1, u * 8);
      }
    },
  };
}

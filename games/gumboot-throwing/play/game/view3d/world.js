// The village fair field: a mown lawn with a roped throwing lane (posts, sagging rope, chalk, distance boards with pennants, a measuring tape),
// the rubber mat and the throwing line, hay bales, bunting and a banner, marquees, a red barn and silo, the giant corrugated boot, a wind sock,
// a trestle table with cups, puddle and tufts; the scenery kit supplies the sky, hills and trees behind. World axes are the sim's:
// x downrange, y up, z across (+ towards the camera = the thrower's right). Everything here is presentation only.
import { LINE_X } from '../src/consts.js';
import { makeBoot } from './boot.js';

const TAU = Math.PI * 2;
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const rngOf = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export const LANE_LEN = 72;

// One look per time of day (index = the game's sky): scenery sky ids, light and fog.
export const LOOKS = [
  { name: 'morning mist', sky: 'sky-peach', tod: 'dawn', bd: 'bd-meadow-day', fog: 0xdfe9e2, fogN: 55, fogF: 240, hemiSky: 0xe9f0ff, hemiGround: 0x5f7a46, hemi: 0.95, key: 0xffe6c4, keyI: 2.7, keyPos: [-0.55, 0.5, 0.62], rim: 0xcfe0ff, rimI: 1.2, exposure: 1.0, grass: 0xdfeedd, env: 0.5, haze: 0.55 },
  { name: 'bright noon', sky: 'sky-clear', tod: 'day', bd: 'bd-meadow-day', fog: 0xcfe3f3, fogN: 70, fogF: 300, hemiSky: 0xcfe6ff, hemiGround: 0x5b7a3a, hemi: 0.9, key: 0xfff4de, keyI: 3.4, keyPos: [-0.35, 0.9, 0.42], rim: 0xbfd8ff, rimI: 1.1, exposure: 1.0, grass: 0xffffff, env: 0.65, haze: 0.2 },
  { name: 'golden afternoon', sky: 'sky-golden', tod: 'day', bd: 'bd-meadow-day', fog: 0xf0dcb4, fogN: 60, fogF: 270, hemiSky: 0xffe9c8, hemiGround: 0x6b7a3a, hemi: 0.85, key: 0xffd9a0, keyI: 3.5, keyPos: [-0.7, 0.55, 0.5], rim: 0xffc890, rimI: 1.3, exposure: 1.02, grass: 0xfff2c8, env: 0.6, haze: 0.3 },
  { name: 'sunset', sky: 'sky-dusk', tod: 'dusk', bd: 'bd-dusk-meadow', fog: 0xf0b898, fogN: 55, fogF: 250, hemiSky: 0xffa888, hemiGround: 0x3a3a2e, hemi: 0.75, key: 0xff9a58, keyI: 3.2, keyPos: [-0.85, 0.3, 0.45], rim: 0xff7a4a, rimI: 1.5, exposure: 1.0, grass: 0xe8c8a8, env: 0.4, haze: 0.45 },
  { name: 'floodlit evening', sky: 'sky-dusk', tod: 'night', bd: 'bd-dusk-meadow', fog: 0x1c2a52, fogN: 40, fogF: 200, hemiSky: 0x5c72b8, hemiGround: 0x1a2430, hemi: 0.8, key: 0xdfe8ff, keyI: 2.6, keyPos: [-0.4, 0.8, 0.5], rim: 0x7090ff, rimI: 1.2, exposure: 1.05, grass: 0x9fb4d0, env: 0.35, haze: 0.5 },
];

function makeLawnTexture(THREE, aniso) {
  const c = cv(512, 512), g = c.getContext('2d'), r = rngOf(11);
  // mown stripes run along the lane (horizontal bands in the texture: u = x, v = -z)
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#4f8a2e' : '#5c9a36'; g.fillRect(0, i * 64, 512, 64); }
  for (let i = 0; i < 40; i++) { const gr = g.createRadialGradient(r() * 512, r() * 512, 2, r() * 512, r() * 512, 40 + r() * 80); gr.addColorStop(0, 'rgba(140,160,60,0.18)'); gr.addColorStop(1, 'rgba(140,160,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512); }
  for (let i = 0; i < 9000; i++) {
    const x = r() * 512, y = r() * 512, l = 3 + r() * 7, a = -Math.PI / 2 + (r() - 0.5) * 1.0, k = r();
    g.strokeStyle = k > 0.66 ? 'rgba(190,225,110,0.34)' : k > 0.33 ? 'rgba(20,50,16,0.32)' : 'rgba(110,170,60,0.34)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let i = 0; i < 90; i++) { const x = r() * 512, y = r() * 512; g.fillStyle = r() > 0.5 ? 'rgba(255,240,150,0.5)' : 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(x, y, 0.8 + r() * 0.9, 0, TAU); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  return t;
}
function labelTexture(THREE, text, { w = 256, h = 160, bg = '#fbf6e8', fg = '#16233a', frame = '#7a5a34', font = '900 92px "Avenir Next", "Helvetica Neue", Arial, sans-serif' } = {}) {
  const c = cv(w, h), g = c.getContext('2d');
  g.fillStyle = frame; g.fillRect(0, 0, w, h);
  g.fillStyle = bg; g.fillRect(8, 8, w - 16, h - 16);
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 4, w - 36);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function bannerTexture(THREE) {
  const c = cv(1024, 192), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 192); gr.addColorStop(0, '#2c7a46'); gr.addColorStop(1, '#1d5a34');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 192);
  g.strokeStyle = '#f2c14e'; g.lineWidth = 8; g.strokeRect(10, 10, 1004, 172);
  g.fillStyle = '#fff6e4'; g.font = '900 96px "Avenir Next", "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('GUMBOOT THROW', 512, 92, 940);
  g.fillStyle = '#f2c14e'; g.font = '700 30px "Avenir Next", Arial, sans-serif'; g.fillText('FESTIVAL DISTANCE CONTEST', 512, 160, 900);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function stripedTexture(THREE, a, b, n = 8) {
  const c = cv(256, 64), g = c.getContext('2d');
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 256 / n, 0, 256 / n + 1, 64); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}
function softSprite(THREE) {
  const c = cv(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---- merged tube/rope helper: thin tubes along sagging catenaries between points, one geometry --------------------------------------------
function ropeGeometry(THREE, spans, r = 0.011, sag = 0.09, seg = 10) {
  const pos = [], nor = [], idx = []; let off = 0;
  const ring = 5;
  for (const [a, b] of spans) {
    const pts = [];
    for (let i = 0; i <= seg; i++) { const u = i / seg; pts.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - 4 * sag * u * (1 - u), a[2] + (b[2] - a[2]) * u]); }
    for (let i = 0; i <= seg; i++) {
      const p = pts[i], q = pts[Math.min(seg, i + 1)], o = pts[Math.max(0, i - 1)];
      let tx = q[0] - o[0], ty = q[1] - o[1], tz = q[2] - o[2]; const l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
      // two perpendiculars
      let ux = 0, uy = 1, uz = 0; if (Math.abs(ty) > 0.9) { ux = 1; uy = 0; }
      let vx = ty * uz - tz * uy, vy = tz * ux - tx * uz, vz = tx * uy - ty * ux; const vl = Math.hypot(vx, vy, vz) || 1; vx /= vl; vy /= vl; vz /= vl;
      const wx = vy * tz - vz * ty, wy = vz * tx - vx * tz, wz = vx * ty - vy * tx;
      for (let k = 0; k < ring; k++) {
        const al = (k / ring) * TAU, c = Math.cos(al), s = Math.sin(al);
        const nx = vx * c + wx * s, ny = vy * c + wy * s, nz = vz * c + wz * s;
        pos.push(p[0] + nx * r, p[1] + ny * r, p[2] + nz * r); nor.push(nx, ny, nz);
      }
    }
    for (let i = 0; i < seg; i++) for (let k = 0; k < ring; k++) {
      const a0 = off + i * ring + k, b0 = off + i * ring + (k + 1) % ring, c0 = a0 + ring, d0 = b0 + ring;
      idx.push(a0, b0, c0, b0, d0, c0);
    }
    off += (seg + 1) * ring;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  return g;
}

export function buildWorld({ V3, stage, quality = 'high' }) {
  const THREE = V3.THREE, B = V3.board3d;
  const scene = stage.scene, hi = quality === 'high', lo = quality === 'low';
  const group = new THREE.Group(); group.name = 'fair-field'; scene.add(group);
  const W = { group, look: -1, sector: 14, tick: [], THREE };
  const aniso = Math.min(8, stage.renderer.capabilities.getMaxAnisotropy ? stage.renderer.capabilities.getMaxAnisotropy() : 4);
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, metalness: 0, ...o });
  const add = (m, parent = group) => { parent.add(m); return m; };
  const shadowed = (m, cast = true, recv = true) => { m.castShadow = cast && !lo; m.receiveShadow = recv; return m; };
  const puff = softSprite(THREE); W.puff = puff;

  // ---- lawn -------------------------------------------------------------------------------------------------------------------------------
  const lawnTex = makeLawnTexture(THREE, aniso); lawnTex.repeat.set(30, 30);
  const lawnMat = new THREE.MeshStandardMaterial({ map: lawnTex, roughness: 1, metalness: 0, color: 0xffffff });
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(300, 40), lawnMat);
  lawn.rotation.x = -Math.PI / 2; lawn.position.set(40, 0, 0); lawn.receiveShadow = true; group.add(lawn);
  W.lawn = lawn; W.lawnMat = lawnMat;
  // worn turf around the mat and a mud patch where the thrower stands
  {
    const c = cv(256, 256), g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 8, 128, 128, 126);
    gr.addColorStop(0, 'rgba(78,56,34,0.85)'); gr.addColorStop(0.55, 'rgba(92,70,42,0.5)'); gr.addColorStop(1, 'rgba(92,70,42,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const r = rngOf(5); for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(${40 + r() * 40},${28 + r() * 20},18,${0.12 + r() * 0.25})`; g.beginPath(); g.arc(30 + r() * 196, 30 + r() * 196, 1 + r() * 4, 0, TAU); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const worn = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 4.2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    worn.rotation.x = -Math.PI / 2; worn.position.set(-0.5, 0.004, 0); worn.renderOrder = 1; group.add(worn);
  }
  // the mat and the throwing line
  {
    const mat = new THREE.Mesh(B.roundedBox(2.7, 0.03, 1.9, 0.012, 2), M(0x23272c, { roughness: 0.95 }));
    mat.position.set(-0.55, 0.015, 0); shadowed(mat, false, true); group.add(mat);
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.034, 3.1), M(0xfbfaf2, { roughness: 0.9 }));
    line.position.set(LINE_X, 0.017, 0); group.add(line);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.034, 0.06), M(0xf2f2ec, { roughness: 0.9 }));
    for (const s of [-1, 1]) { const e = edge.clone(); e.position.set(-0.5, 0.017, s * 1.55); group.add(e); }
  }

  // ---- the lane: chalk lines, posts, rope, boards, pennants (rebuilt when the sector changes) -----------------------------------------------
  const lane = new THREE.Group(); group.add(lane); W.lane = lane;
  const postGeo = new THREE.CylinderGeometry(0.035, 0.045, 1.0, 10); postGeo.translate(0, 0.5, 0);
  const bandGeo = new THREE.CylinderGeometry(0.047, 0.047, 0.16, 10); bandGeo.translate(0, 0.76, 0);
  const capGeo = new THREE.SphereGeometry(0.06, 12, 8); capGeo.translate(0, 1.02, 0);
  const boardTex = new Map();
  const bGeo = new THREE.BoxGeometry(1.2, 0.86, 0.05);
  const pennantGeo = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.26, 0, 0.5, -0.13, 0], 3)); g.setIndex([0, 1, 2]); g.computeVertexNormals(); return g; })();
  const PENN = [0xd8362f, 0xf2c14e, 0x2f6fb6, 0xf4efe3, 0x3a9b8e, 0xe98aa5];
  W.pennants = [];
  const ropeMat = M(0xf1e6cf, { roughness: 0.9 });
  const postMat = M(0xf2efe6, { roughness: 0.7 }), bandMat = M(0xc92f2a, { roughness: 0.6 }), capMat = M(0xc92f2a, { roughness: 0.5 });
  const boardMat = M(0x6b4a2a, { roughness: 0.8 });
  W.setSector = (deg) => {
    if (Math.abs(deg - W.sector) < 1e-3 && lane.children.length) return;
    W.sector = deg;
    while (lane.children.length) { const o = lane.children.pop(); if (o.geometry && o.userData.own) o.geometry.dispose(); }
    W.pennants.length = 0;
    const t = Math.tan(deg * Math.PI / 180);
    const xs = []; for (let x = 6; x <= LANE_LEN + 0.01; x += 4) xs.push(x);
    const edgeZ = (x) => x * t + 0.15;
    // chalk
    const L = LANE_LEN - LINE_X, ang = Math.atan(t), len = L / Math.cos(ang);
    for (const s of [-1, 1]) {
      const ch = new THREE.Mesh(new THREE.BoxGeometry(len, 0.012, 0.09), M(0xf8f7ee, { roughness: 1 }));
      ch.position.set(LINE_X + L / 2, 0.007, s * (LINE_X + L / 2) * t); ch.rotation.y = -s * ang; lane.add(ch);
    }
    // posts (instanced)
    const n = xs.length * 2;
    const posts = new THREE.InstancedMesh(postGeo, postMat, n), bands = new THREE.InstancedMesh(bandGeo, bandMat, n), caps = new THREE.InstancedMesh(capGeo, capMat, n);
    const o = new THREE.Object3D(); let i = 0; const tops = { '-1': [], '1': [] };
    for (const s of [-1, 1]) for (const x of xs) {
      o.position.set(x, 0, s * edgeZ(x)); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix();
      posts.setMatrixAt(i, o.matrix); bands.setMatrixAt(i, o.matrix); caps.setMatrixAt(i, o.matrix); i++;
      tops[s].push([x, 0.94, s * edgeZ(x)]);
    }
    for (const m of [posts, bands, caps]) { m.castShadow = !lo; m.receiveShadow = true; m.userData.own = false; lane.add(m); }
    // rope between posts (two rails: top and mid)
    for (const s of [-1, 1]) {
      const spans = []; const sp2 = [];
      for (let k = 0; k < tops[s].length - 1; k++) { spans.push([tops[s][k], tops[s][k + 1]]); sp2.push([[tops[s][k][0], 0.62, tops[s][k][2]], [tops[s][k + 1][0], 0.62, tops[s][k + 1][2]]]); }
      const rg = ropeGeometry(THREE, spans.concat(sp2), 0.012, 0.07, 8);
      const rm = new THREE.Mesh(rg, ropeMat); rm.castShadow = !lo; rm.userData.own = true; lane.add(rm);
    }
    // distance boards on tall posts on the FAR side, every 10 m, with the number facing the camera
    for (let m = 10; m <= 70; m += 10) {
      const x = LINE_X + m, z = -(x * t + 1.5);
      const key = String(m);
      let tx = boardTex.get(key); if (!tx) { tx = labelTexture(THREE, key); boardTex.set(key, tx); }
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 2.3, 8), boardMat); post.position.set(x, 1.15, z); post.castShadow = !lo; lane.add(post);
      const bd = new THREE.Mesh(bGeo, [boardMat, boardMat, boardMat, boardMat, new THREE.MeshStandardMaterial({ map: tx, roughness: 0.7 }), boardMat]);
      bd.position.set(x, 1.95, z + 0.04); bd.castShadow = !lo; lane.add(bd);
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.1), boardMat); top.position.set(x, 2.4, z + 0.04); lane.add(top);
    }
    // pennants on the far posts, cloth flutters with the wind
    tops['-1'].forEach((p, k) => {
      const m = new THREE.Mesh(pennantGeo, new THREE.MeshStandardMaterial({ color: PENN[k % PENN.length], roughness: 0.85, side: THREE.DoubleSide }));
      m.position.set(p[0], 1.55, p[2]); m.castShadow = false; lane.add(m); W.pennants.push({ m, ph: k * 0.9 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.6, 6), M(0xe8e4da)); pole.position.set(p[0], 1.25, p[2]); lane.add(pole);
    });
  };

  // measuring tape along the centre line (white cloth tape with black ticks and red every 5 m)
  {
    const c = cv(1024, 24), g = c.getContext('2d');
    g.fillStyle = '#fbf8ea'; g.fillRect(0, 0, 1024, 24);
    for (let i = 0; i <= 20; i++) { const x = i * 1024 / 20; g.fillStyle = i % 4 === 0 ? '#c92f2a' : '#222'; g.fillRect(x - 1.5, 0, 3, i % 4 === 0 ? 24 : 12); }
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; t.repeat.set(LANE_LEN / 5, 1);
    const tape = new THREE.Mesh(new THREE.PlaneGeometry(LANE_LEN - LINE_X, 0.07), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1 }));
    tape.rotation.x = -Math.PI / 2; tape.position.set(LINE_X + (LANE_LEN - LINE_X) / 2, 0.006, 0.0); group.add(tape);
    t.repeat.set((LANE_LEN - LINE_X) / 5, 1);
  }

  // ---- tufts, puddle -----------------------------------------------------------------------------------------------------------------------
  {
    const tg = new THREE.BufferGeometry();
    const tp = []; for (let b = 0; b < 5; b++) { const a = (b / 5) * Math.PI - 0.3, h = 0.13 + 0.05 * (b % 2); tp.push(Math.cos(a) * 0.012, 0, Math.sin(a) * 0.012, Math.cos(a) * 0.012 + 0.02, h, 0, Math.cos(a) * 0.012 - 0.01, 0, -Math.sin(a) * 0.012); }
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); tg.computeVertexNormals();
    const n = lo ? 160 : 420;
    const tuft = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ color: 0x5b9a34, roughness: 1, side: THREE.DoubleSide }), n);
    const o = new THREE.Object3D(), r = rngOf(3);
    for (let i = 0; i < n; i++) { o.position.set(-8 + r() * 90, 0, 1.6 + r() * 9 * r() * 1.5 + (r() < 0.2 ? -4 - r() * 6 : 0)); o.rotation.y = r() * TAU; const s = 0.8 + r() * 1.6; o.scale.set(s, s, s); o.updateMatrix(); tuft.setMatrixAt(i, o.matrix); }
    tuft.receiveShadow = true; group.add(tuft);

  }

  // ---- hay bales (round, wrapped; square stack), trestle table with cups ------------------------------------------------------------------
  {
    const wrap = M(0xe8e4d4, { roughness: 0.55 }), hay = M(0xd2b259, { roughness: 1 });
    const round = (x, y, z, ry, w = 1.2, r = 0.66, plastic = false) => {
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 28), plastic ? new THREE.MeshPhysicalMaterial({ color: 0x2f7a42, roughness: 0.25, clearcoat: 0.8 }) : hay);
      body.rotation.x = Math.PI / 2; body.castShadow = !lo; body.receiveShadow = true; g.add(body);
      if (!plastic) for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.TorusGeometry(r * 0.6, 0.012, 6, 28), M(0xb69a40)); d.position.z = s * (w / 2 + 0.002); g.add(d); }
      group.add(g);
    };
    round(-4.4, 0.66, -3.4, 0.3); round(-3.0, 0.66, -3.7, -0.2); round(-3.7, 1.86, -3.55, 0.1, 1.2, 0.66, true);
    round(9.5, 0.66, -6.5, 0.4, 1.2, 0.66, true); round(10.9, 0.66, -6.2, -0.1);
    const sq = (x, y, z, ry) => { const b = new THREE.Mesh(B.roundedBox(0.95, 0.46, 0.46, 0.04, 2), hay); b.position.set(x, y, z); b.rotation.y = ry; shadowed(b); group.add(b); };
    sq(14, 0.23, -5.5, 0.1); sq(14.95, 0.23, -5.45, -0.05); sq(14.5, 0.69, -5.5, 0.08);
    sq(-6.2, 0.23, 3.6, 0.5); sq(-5.2, 0.23, 4.2, 0.3);
    // trestle table: cloth, trophy cup, cups, a cash box
    const g = new THREE.Group(); g.position.set(-1.6, 0, -3.1); g.rotation.y = 0.25; group.add(g);
    const top = new THREE.Mesh(B.roundedBox(1.8, 0.05, 0.75, 0.01, 2), M(0xa8794a)); top.position.y = 0.76; shadowed(top); g.add(top);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.75), new THREE.MeshStandardMaterial({ color: 0xc23a30, roughness: 0.95 })); cloth.rotation.x = -Math.PI / 2; cloth.position.y = 0.787; g.add(cloth);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.76, 0.05), M(0x8b6a44)); l.position.set(sx * 0.8, 0.38, sz * 0.3); l.rotation.z = sx * 0.12; shadowed(l); g.add(l); }
    const gold = new THREE.MeshStandardMaterial({ color: 0xe0b23a, metalness: 0.95, roughness: 0.22, envMapIntensity: 1.6 });
    const cupProf = [[0.001, 0], [0.05, 0], [0.05, 0.015], [0.02, 0.03], [0.014, 0.09], [0.06, 0.15], [0.07, 0.2], [0.064, 0.2], [0.055, 0.15], [0.01, 0.09]];
    const cup = new THREE.Mesh(B.lathe(cupProf, 24), gold); cup.position.set(0.0, 0.79, 0); cup.scale.setScalar(1.25); cup.castShadow = !lo; g.add(cup);
    for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(B.lathe(cupProf, 16), k % 2 ? gold : M(0xc0c6cc, { metalness: 0.9, roughness: 0.3 })); c.scale.setScalar(0.6); c.position.set(-0.5 + k * 0.28, 0.79, 0.18); g.add(c); }
    W.table = g;
  }

  // ---- landmark sculpture: the giant corrugated boot ------------------------------------------------------------------------------------
  {
    const bootG = makeBoot(THREE, { colour: '#aab3ba', sole: '#59616a', mud: 0, seed: 3, scale: 15, corrugated: 1, metal: true });
    bootG.position.set(3.0, 5.6, -30); bootG.rotation.y = 0.0;
    bootG.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    group.add(bootG);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.3, 2.6), M(0x7a746a, { roughness: 0.9 })); plinth.position.set(3.0 + 0.3, 0.15, -30); group.add(plinth);
    W.giant = bootG;
  }

  // ---- marquees, barn, silo, banner, bunting ----------------------------------------------------------------------------------------------
  const marquee = (x, z, w, d, h, c1, c2, yaw = 0) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; group.add(g);
    const wall = M(0xf4f0e4, { roughness: 0.9 });
    for (const [px, pz, bw, bd] of [[0, -d / 2, w, 0.05], [-w / 2, 0, 0.05, d], [w / 2, 0, 0.05, d]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, h, bd), wall); m.position.set(px, h / 2, pz); shadowed(m); g.add(m); }
    // roof: pyramid with stripes
    const roofH = h * 0.55;
    const cone = new THREE.CylinderGeometry(0, Math.hypot(w, d) / 2 * 1.04, roofH, 4, 1, false); cone.rotateY(Math.PI / 4); cone.scale(w / Math.hypot(w, d) * 1.414, 1, d / Math.hypot(w, d) * 1.414);
    const tex = stripedTexture(THREE, c1, c2, 8);
    const roof = new THREE.Mesh(cone, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 })); roof.position.y = h + roofH / 2; shadowed(roof); g.add(roof);
    const valance = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, 0.35, 0.04), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 })); valance.position.set(0, h - 0.18, d / 2 + 0.02); g.add(valance);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), M(0x8b6a44)); pole.position.y = h + roofH + 0.55; g.add(pole);
    const fl = new THREE.Mesh(pennantGeo, new THREE.MeshStandardMaterial({ color: 0xd8362f, side: THREE.DoubleSide })); fl.position.set(0, h + roofH + 1.05, 0); fl.scale.setScalar(1.6); g.add(fl); W.pennants.push({ m: fl, ph: x });
    // dark interior and tables
    const inside = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.96, h * 0.96), M(0x2a2622, { roughness: 1 })); inside.position.set(0, h / 2, -d / 2 + 0.06); g.add(inside);
    return g;
  };
  W.marquees = [marquee(18, -24, 10, 6, 3.0, '#d8362f', '#f6eed8'), marquee(36, -27, 12, 6.5, 3.2, '#2f6fb6', '#f6eed8', 0.04), marquee(56, -26, 10, 6, 3.0, '#3a9b58', '#f6eed8', -0.03)];
  {   // barn and silo
    const g = new THREE.Group(); g.position.set(-17, 0, -36); g.rotation.y = 0.12; group.add(g);
    const red = M(0xa8322a, { roughness: 0.85 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 9), red); body.position.y = 3.5; shadowed(body); g.add(body);
    const roofShape = new THREE.Shape(); roofShape.moveTo(-7.4, 0); roofShape.lineTo(0, 4.2); roofShape.lineTo(7.4, 0); roofShape.closePath();
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 9.6, bevelEnabled: false }), M(0x4a4640, { roughness: 0.8 })); roof.position.set(0, 7, -4.8); shadowed(roof); g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(4, 4.6, 0.12), M(0xf1ece0)); door.position.set(0, 2.3, 4.55); g.add(door);
    const x1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 5.2, 0.14), red); x1.position.set(0, 2.3, 4.62); x1.rotation.z = 0.74; g.add(x1);
    const x2 = x1.clone(); x2.rotation.z = -0.74; g.add(x2);
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 11, 22), M(0xb8bcc0, { roughness: 0.55, metalness: 0.4 })); silo.position.set(9.4, 5.5, -0.6); shadowed(silo); g.add(silo);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.7, 22, 10, 0, TAU, 0, Math.PI / 2), M(0x8d9298, { roughness: 0.5, metalness: 0.5 })); dome.position.set(9.4, 11, -0.6); g.add(dome);
  }
  {   // banner between two poles
    const g = new THREE.Group(); g.position.set(5.2, 0, -5.6); group.add(g);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.7, 8), M(0x7a5a38)); p.position.set(s * 2.3, 1.85, 0); shadowed(p); g.add(p); }
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.82), new THREE.MeshStandardMaterial({ map: bannerTexture(THREE), roughness: 0.85, side: THREE.DoubleSide }));
    ban.position.set(0, 3.1, 0.02); ban.castShadow = !lo; g.add(ban); W.banner = ban;
  }
  {   // bunting: strings with flags between the banner poles, the table and marquees
    const cols = [0xd8362f, 0xf6eed8, 0x2f6fb4, 0xf0b52a, 0x3f9a58, 0xe98aa5];
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute([-0.13, 0, 0, 0.13, 0, 0, 0, -0.3, 0], 3)); fg.setIndex([0, 1, 2]); fg.computeVertexNormals();
    const strings = [[[2.9, 3.35, -5.6], [7.5, 3.35, -5.6], 0.35], [[7.5, 3.4, -5.6], [18, 3.6, -22], 0.5], [[-1.6, 2.8, -5], [2.9, 3.35, -5.6], 0.3], [[18, 3.2, -22], [36, 3.4, -24], 0.8], [[-9, 4.2, -30], [-2, 3.1, -7], 0.9]];
    const lines = [];
    W.flags = [];
    for (const [a, b, sag] of strings) {
      lines.push([a, b]);
      const n = Math.max(8, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.36));
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, p = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - 4 * sag * u * (1 - u), a[2] + (b[2] - a[2]) * u];
        const m = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: cols[(((i + Math.floor(a[0] + 20)) % cols.length) + cols.length) % cols.length], roughness: 0.85, side: THREE.DoubleSide }));
        m.position.set(p[0], p[1] - 0.01, p[2]); W.flags.push({ m, ph: i * 0.8 + a[0] }); group.add(m);
      }
    }
    // the strings themselves with sag (use rope geometry, 1 sag each)
    for (const [a, b, sag] of strings) { const g = ropeGeometry(THREE, [[a, b]], 0.008, sag, 14); const m = new THREE.Mesh(g, M(0x3a2e22)); group.add(m); }
  }
  // wind sock on a pole behind the mat
  {
    const g = new THREE.Group(); g.position.set(-2.8, 0, -2.2); group.add(g);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 3.6, 8), M(0xd9d9de, { metalness: 0.4, roughness: 0.5 })); pole.position.y = 1.8; shadowed(pole); g.add(pole);
    const sock = new THREE.Group(); sock.position.y = 3.5; g.add(sock);
    const segs = [];
    for (let k = 0; k < 5; k++) {
      const r0 = 0.17 - k * 0.026, r1 = 0.17 - (k + 1) * 0.026;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 0.26, 12, 1, true), new THREE.MeshStandardMaterial({ color: k % 2 ? 0xf4efe3 : 0xe8863a, roughness: 0.8, side: THREE.DoubleSide }));
      seg.geometry.translate(0, 0.13, 0); seg.rotation.z = -Math.PI / 2;
      const hold = new THREE.Group(); hold.add(seg);
      segs.push(hold); (k ? segs[k - 1] : sock).add(hold); hold.position.x = k ? 0.26 : 0;
    }
    W.sock = { root: sock, segs };
  }
  W.setWind = (wx, wz, t) => {
    const sp = Math.hypot(wx, wz), str = Math.min(1, sp / 7);
    // flags and pennants flutter, faster and flatter with more wind; they stream downwind (the wind's x comes from the left or right)
    const dir = Math.atan2(-wz, wx);
    const flap = (o, k) => { o.m.rotation.x = Math.sin(t * (2.2 + str * 4) + o.ph) * (0.12 + 0.3 * str); o.m.rotation.y = Math.sin(t * (1.5 + str * 3) + o.ph * 1.7) * (0.18 + 0.4 * str) + (k ? 0 : 0); };
    for (const o of W.flags) flap(o, 0);
    for (const o of W.pennants) { flap(o, 1); o.m.scale.x = wx >= 0 ? 1 : -1; }
    const s = W.sock; s.root.rotation.y = dir;
    const droop = (1 - Math.min(1, str * 1.4)) * 1.1;
    s.segs.forEach((h, k) => { h.rotation.z = -droop * (0.18 + k * 0.05) + Math.sin(t * 5 + k * 0.9) * 0.05 * (0.4 + str); h.rotation.y = Math.sin(t * 3.3 + k) * 0.06 * (0.3 + str); });
    if (W.banner) W.banner.rotation.y = Math.sin(t * 1.4) * 0.03 * (0.4 + str);
  };

  // ---- scenery kit: sky, far hills, trees, farmhouses (rebuilt per look) ----------------------------------------------------------------------
  let scenery = null;
  W.setLook = (idx) => {
    const L = LOOKS[idx] || LOOKS[1];
    if (W.look === idx) return;
    W.look = idx; W.cur = L;
    if (scenery) { scene.remove(scenery.group); try { scenery.dispose && scenery.dispose(); } catch { /* ignore */ } scenery = null; }
    try {
      scenery = V3.buildScenery({
        layers: [
          { t: 'sky', id: L.sky },
          { t: 'backdrop', id: L.bd, mix: ['bd-alpine-day'], seed: 3 },
          { t: 'band', id: 'band-hills-green', r: 120, h: 28, arc: [-175, -5] },
          { t: 'band', id: 'band-birch', r: 78, h: 15, arc: [-170, -10] },
          { t: 'cutouts', id: 'tr-broad-tree', count: 7, r: [36, 62], scale: [6, 10], seed: 11, sway: 0.6, arc: [-165, -15] },
          { t: 'cutouts', id: 'st-farmhouse', count: 2, r: [58, 72], arc: [-150, -30], scale: [12, 14], seed: 2 },
        ],
        timeOfDay: L.tod, quality: hi ? 'high' : 'medium', radius: 150, wind: 0.5, haze: L.haze,
      });
      scene.add(scenery.group);
      W.scenery = scenery;
    } catch (e) { console.warn('scenery failed', e); }
    lawnMat.color.set(L.grass);
    stage.setLighting('day', { sky: L.fog, fog: L.fog, hemiSky: L.hemiSky, hemiGround: L.hemiGround, hemi: L.hemi, key: L.key, keyI: L.keyI, rim: L.rim, rimI: L.rimI, exposure: L.exposure });
    stage.setSky(L.fog, L.fog, { near: L.fogN, far: L.fogF });
    scene.background = new THREE.Color(L.fog);
    scene.environmentIntensity = L.env;
    stage.invalidate();
  };
  W.update = (dt, camPos) => { if (scenery && scenery.update) scenery.update(dt, stage.camera); };
  W.dispose = () => { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); };
  return W;
}

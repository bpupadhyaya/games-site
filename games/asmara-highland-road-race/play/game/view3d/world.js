// The highland road as a real lit 3D place (presentation only: it reads the course and the camera, never the sim's private state).
//
// World metres: x along the road (x = sim distance - camera distance, so every object sits at its true spacing), y up, z toward the viewer.
// The road is 6.4 m wide, riders ride in lanes z in [-1.3, 1.3], the camera stands 9 m away and 2.6 m up. The whole group is turned about the
// focus rider by the road gradient. Everything is generated here (canvas textures, lathe-free simple solids): no new asset files.
import { TONES, hash } from '../src/art.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function canvas(w, h) { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export function createWorld(THREE, { quality = 'medium' } = {}) {
  const group = new THREE.Group();     // rotated by the gradient
  const root = new THREE.Group();      // add this to the scene
  root.add(group);
  const lowQ = quality === 'low';
  const state = { quality, landKey: '', tone: '' };

  // ---- textures -----------------------------------------------------------------------------------------------------------------
  const tex = (c, rx = 1, ry = 1, aniso = 6) => {
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    t.repeat.set(rx, ry); t.anisotropy = aniso; return t;
  };
  // asphalt tile: 10 m along the road x 6.4 m across; edge lines, a dashed centre line, polished tyre tracks, patches, cracks
  const asphalt = (() => {
    const W = 1024, H = 520, c = canvas(W, H), g = c.getContext('2d'), r = rng(11);
    g.fillStyle = '#5b6068'; g.fillRect(0, 0, W, H);
    const id = g.getImageData(0, 0, W, H), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 22; d[i] += n; d[i + 1] += n; d[i + 2] += n * 1.05; }
    g.putImageData(id, 0, 0);
    for (let i = 0; i < 2600; i++) { const l = r() > 0.55; g.fillStyle = l ? `rgba(255,255,255,${0.05 + r() * 0.16})` : `rgba(0,0,0,${0.08 + r() * 0.2})`; g.beginPath(); g.arc(r() * W, r() * H, 0.6 + r() * 1.8, 0, TAU); g.fill(); }
    // tyre tracks (darker, smoother) at z = -1.0 and +1.0 m
    for (const zc of [0.3, 0.7]) { const gg = g.createLinearGradient(0, (zc - 0.07) * H, 0, (zc + 0.07) * H); gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(0.5, 'rgba(10,10,14,0.30)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gg; g.fillRect(0, (zc - 0.07) * H, W, 0.14 * H); }
    // patches and cracks
    for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(30,32,40,${0.12 + r() * 0.1})`; g.fillRect(r() * W, 60 + r() * (H - 160), 60 + r() * 150, 30 + r() * 60); }
    g.strokeStyle = 'rgba(15,15,18,0.55)'; g.lineWidth = 1.6;
    for (let i = 0; i < 9; i++) { let x = r() * W, y = 40 + r() * (H - 80); g.beginPath(); g.moveTo(x, y); for (let q = 0; q < 6; q++) { x += 10 + r() * 30; y += (r() - 0.5) * 22; g.lineTo(x, y); } g.stroke(); }
    // lane lines: continuous edges, dashed centre (3 m dash in each 10 m)
    g.fillStyle = 'rgba(244,240,226,0.9)'; g.fillRect(0, H * 0.035, W, 9); g.fillRect(0, H * 0.965 - 9, W, 9);
    g.fillStyle = 'rgba(248,224,130,0.92)'; g.fillRect(0, H * 0.5 - 5, W * 0.3, 10);
    return c;
  })();
  const soil = (a, b, seed, stripes) => {
    const c = canvas(256, 256), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = a; g.fillRect(0, 0, 256, 256);
    const id = g.getImageData(0, 0, 256, 256), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 30; d[i] += n; d[i + 1] += n * 0.9; d[i + 2] += n * 0.7; }
    g.putImageData(id, 0, 0);
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${stripes ? '40,70,20' : '90,60,30'},${0.08 + r() * 0.14})`; g.beginPath(); g.ellipse(r() * 256, r() * 256, 4 + r() * 12, 2 + r() * 5, r() * 3, 0, TAU); g.fill(); }
    if (stripes) { for (let y = 0; y < 256; y += 32) { g.fillStyle = y % 64 ? 'rgba(255,230,150,0.18)' : 'rgba(40,80,30,0.2)'; g.fillRect(0, y, 256, 18); } }
    g.fillStyle = b; g.globalAlpha = 0.35; for (let i = 0; i < 70; i++) g.fillRect(r() * 256, r() * 256, 2 + r() * 5, 1 + r() * 2); g.globalAlpha = 1;
    return c;
  };
  const LANDTEX = {};
  const PAL = {
    farm: { base: '#b9a05a', patches: ['#8fa84a', '#c9b266', '#6f8f3e', '#a8894a', '#d2c07a', '#7aa04a'], line: 'rgba(60,45,20,0.35)' },
    terrace: { base: '#8f9a4e', patches: ['#6f9448', '#a2a65a', '#7e8a44', '#b0a05a', '#5e8a42'], line: 'rgba(80,70,50,0.55)' },
    valley: { base: '#6f9a48', patches: ['#5a8a3a', '#7aa84e', '#4e7a34', '#8fb35a'], line: 'rgba(40,70,30,0.25)' },
    forest: { base: '#4f7a3a', patches: ['#3d6a2e', '#5a8a42', '#2f5826', '#4a7436'], line: 'rgba(20,40,16,0.3)' },
    town: { base: '#b8a07a', patches: ['#a8905e', '#c8b088', '#9a8a5e', '#b8a870'], line: 'rgba(70,55,35,0.3)' },
    coast: { base: '#d6c08e', patches: ['#c9b27c', '#e0cc9c', '#b9a56e', '#a8b078'], line: 'rgba(110,90,60,0.25)' },
  };
  const landTex = (land) => {
    if (LANDTEX[land]) return LANDTEX[land];
    const P = PAL[land] || PAL.farm, c = canvas(512, 512), g = c.getContext('2d'), r = rng(land.length * 97 + land.charCodeAt(0));
    g.fillStyle = P.base; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 70; i++) {                    // patchwork of fields / thickets
      g.save(); g.translate(r() * 512, r() * 512); g.rotate((r() - 0.5) * 0.5);
      g.fillStyle = P.patches[Math.floor(r() * P.patches.length)]; g.globalAlpha = 0.55;
      const w = 50 + r() * 130, h = 24 + r() * 70; g.fillRect(-w / 2, -h / 2, w, h);
      g.globalAlpha = 0.5; g.strokeStyle = P.line; g.lineWidth = 2; g.strokeRect(-w / 2, -h / 2, w, h); g.globalAlpha = 1;
      if (land === 'farm' || land === 'terrace') { g.strokeStyle = 'rgba(40,30,10,0.18)'; g.lineWidth = 1; for (let q = -h / 2 + 5; q < h / 2; q += 6) { g.beginPath(); g.moveTo(-w / 2, q); g.lineTo(w / 2, q); g.stroke(); } }
      g.restore();
    }
    const id = g.getImageData(0, 0, 512, 512), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.8; }
    g.putImageData(id, 0, 0);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(30,50,20,${0.2 + r() * 0.3})`; g.beginPath(); g.arc(r() * 512, r() * 512, 1.5 + r() * 4, 0, TAU); g.fill(); }
    return (LANDTEX[land] = tex(c, 1, 1, 4));
  };
  const groundTex = tex(soil('#a6865a', '#6d5230', 21, false), 70, 100);
  const roadTex = tex(asphalt, 24, 1, 8);

  // ---- ground, road, kerbs --------------------------------------------------------------------------------------------------------
  const matBase = (o) => new THREE.MeshLambertMaterial(o);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 380), matBase({ map: groundTex }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.03, -170);
  group.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(260, 5.2), new THREE.MeshLambertMaterial({ map: roadTex }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.0, 0);
  group.add(road);
  // verge shoulders and the low kerb on each side (both lit boxes)
  const kerbMat = matBase({ color: 0xe8e2d2 });
  for (const sz of [-1, 1]) {
    const k = new THREE.Mesh(new THREE.BoxGeometry(260, 0.12, 0.28), kerbMat); k.position.set(0, 0.05, sz * 2.74); group.add(k);
  }
  // hillside behind the road: chunks of 60 m of a real height field (a smooth rise to the far ridges), each coloured and textured by the land of its
  // stretch: farm strips, stepped terraces, forest, town plaster. Rebuilt only when a chunk is handed to a new stretch of road.
  const CH = 60, HD = 230, NX = 8, NZ = 26, HS = [];
  const hillH = (d, sx, land) => {
    const base = 8.5 * (1 - Math.exp(-d / 70));
    const n = Math.sin(sx / 61 + d / 90) * 0.5 + Math.sin(sx / 23 - d / 41) * 0.22 + Math.sin(sx / 137 + 1.3) * 0.6;
    let h = base * (1 + 0.28 * n) + Math.max(0, d - 20) * 0.04 * n;
    if (land === 'terrace') h = Math.round(h / 1.6) * 1.6 + Math.min(1, h / 1.6 % 1) * 0.2;      // stepped terraces
    if (land === 'town') h *= 0.6;
    return Math.max(0, h) + 0.2;
  };
  const buildChunk = (m, ci, land) => {
    const g = m.geometry, p = g.attributes.position, c = g.attributes.color, uv = g.attributes.uv, mid = (ci + 0.5) * CH;
    let q = 0;
    for (let j = 0; j <= NZ; j++) {
      const d = Math.pow(1 - j / NZ, 1.7) * HD;
      for (let i = 0; i <= NX; i++, q++) {
        const lx = (i / NX - 0.5) * (CH + 0.5), sx = mid + lx;
        p.setXYZ(q, lx, d, hillH(d, sx, land)); uv.setXY(q, sx / 16, d / 16);
        const nn = 0.9 + 0.2 * hash(Math.floor(sx / 7) * 31 + j * 13 + ci);
        const strip = land === 'farm' ? (Math.floor(d / 6 + sx / 40) % 2 ? 1.0 : 0.82) : 1;
        c.setXYZ(q, nn * strip, nn * strip, nn * strip * 0.97);
      }
    }
    p.needsUpdate = true; c.needsUpdate = true; uv.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
    m.userData.ci = ci; m.userData.land = land;
  };
  for (let i = 0; i < 7; i++) {
    const g = new THREE.PlaneGeometry(CH + 0.5, HD, NX, NZ);
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array((NX + 1) * (NZ + 1) * 3).fill(1), 3));
    const m = new THREE.Mesh(g, matBase({ map: landTex('farm'), vertexColors: true }));
    m.rotation.x = -Math.PI / 2; m.position.set(0, 0, -3.2); m.userData.ci = -1e9;
    m.frustumCulled = false; group.add(m); HS.push(m);
  }

  // ---- far ridges (periodic height profile so one mesh slides by the camera distance modulo its period) ------------------------------
  const ridges = [];
  const mkRidge = (z, amp, seed, y0, period) => {
    const N = 90, W = period * 3, pos = [], col = [], idx = [];
    const rr = rng(seed), ph = [rr() * 6, rr() * 6, rr() * 6];
    const h = (x) => { const u = (x / period) * TAU; return amp * (0.55 + 0.3 * Math.sin(u + ph[0]) + 0.17 * Math.sin(2 * u + ph[1]) + 0.1 * Math.sin(5 * u + ph[2])); };
    for (let i = 0; i <= N; i++) { const x = -W / 2 + (i / N) * W; pos.push(x, y0, 0, x, y0 + h(x), 0); col.push(0, 0, 0, 1, 1, 1); if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, side: THREE.DoubleSide }));
    m.position.z = z; m.userData.period = period; m.renderOrder = -2;
    root.add(m); ridges.push(m); return m;
  };
  mkRidge(-330, 70, 5, -10, 400);
  mkRidge(-220, 46, 9, -8, 300);
  mkRidge(-140, 28, 14, -6, 220);

  // ---- trees (instanced; one merged geometry per species with vertex colours) ----------------------------------------------------------
  const merge = (parts) => {
    const pos = [], nor = [], col = [];
    for (const [geo, rgb] of parts) {
      const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals?.();
      const p = g.attributes.position.array, n = g.attributes.normal.array;
      for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
      for (let i = 0; i < p.length / 3; i++) col.push(rgb[0], rgb[1], rgb[2]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  };
  const ell = (rx, ry, rz, x, y, z, seg = 10, rings = 7) => { const g = new THREE.SphereGeometry(1, seg, rings); g.scale(rx, ry, rz); g.translate(x, y, z); return g; };
  const taper = (r0, r1, h, x = 0, y = 0, z = 0, seg = 7) => { const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1); g.translate(x, y + h / 2, z); return g; };
  const bend = (g, amt, h) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = clamp(p.getY(i) / h, 0, 1); p.setX(i, p.getX(i) + amt * t * t); } return g; };
  const SP = {};
  SP.euc = (() => {      // eucalyptus: tall pale peeling trunk, sparse blue-green crown in layered tufts
    const parts = [[bend(taper(0.26, 0.09, 11, 0, 0, 0, 8), 0.9, 11), [0.82, 0.76, 0.64]]];
    const f = [[0.1, 8.6, 0.2, 2.3, 1.5, 1.9], [1.3, 9.8, -0.4, 1.9, 1.3, 1.6], [-1.2, 7.6, 0.6, 2.0, 1.4, 1.7], [0.5, 10.8, 0.1, 1.5, 1.2, 1.3]];
    f.forEach((q, i) => parts.push([ell(q[3], q[4], q[5], q[0] + 0.9, q[1], q[2], 9, 6), i % 2 ? [0.3, 0.47, 0.32] : [0.36, 0.53, 0.36]]));
    return merge(parts);
  })();
  SP.acacia = (() => {   // umbrella acacia
    const parts = [[bend(taper(0.2, 0.1, 3.8, 0, 0, 0, 7), 0.5, 3.8), [0.32, 0.24, 0.18]]];
    parts.push([ell(4.2, 0.85, 3.4, 0.4, 4.4, 0, 12, 6), [0.5, 0.62, 0.3]]); parts.push([ell(2.6, 0.7, 2.2, -0.9, 4.9, 0.3, 10, 5), [0.58, 0.7, 0.34]]);
    return merge(parts);
  })();
  SP.cypress = (() => merge([[taper(0.14, 0.08, 1.0, 0, 0, 0, 5), [0.3, 0.22, 0.16]], [ell(0.75, 1.4, 0.75, 0, 1.7, 0, 9, 7), [0.16, 0.3, 0.17]], [ell(0.62, 1.3, 0.62, 0, 3.0, 0, 9, 7), [0.18, 0.33, 0.19]], [ell(0.42, 1.0, 0.42, 0, 4.1, 0, 8, 6), [0.2, 0.36, 0.2]]]))();
  SP.pear = (() => {     // prickly pear: clustered flat green pads with a few red fruit
    const parts = []; const r = rng(3);
    for (let i = 0; i < 9; i++) { const x = (r() - 0.5) * 1.6, y = 0.3 + r() * 1.0 + (i > 4 ? 0.5 : 0), g = ell(0.38 + r() * 0.12, 0.5 + r() * 0.16, 0.09, x, y, (r() - 0.5) * 0.4, 8, 6); g.rotateZ((r() - 0.5) * 1.2); parts.push([g, [0.2 + r() * 0.08, 0.4 + r() * 0.1, 0.18]]); }
    for (let i = 0; i < 4; i++) parts.push([ell(0.1, 0.12, 0.1, (r() - 0.5) * 1.6, 1.3 + r() * 0.9, 0.12, 6, 5), [0.8, 0.2, 0.18]]);
    return merge(parts);
  })();
  SP.palm = (() => {
    const parts = [[bend(taper(0.2, 0.13, 9, 0, 0, 0, 7), 1.2, 9), [0.58, 0.5, 0.4]]];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; const f = new THREE.CylinderGeometry(0, 0.28, 3.4, 5); f.rotateZ(-Math.PI / 2 + 0.5); f.translate(1.7, 0, 0); f.rotateY(a); f.translate(1.2, 9.2 - 0.0, 0); parts.push([f, [0.3, 0.5, 0.26]]); }
    return merge(parts);
  })();
  SP.bush = (() => { const r = rng(21), parts = []; for (let i = 0; i < 4; i++) parts.push([ell(0.8 + r() * 0.5, 0.55 + r() * 0.3, 0.8 + r() * 0.4, (r() - 0.5) * 1.3, 0.45, (r() - 0.5) * 1.1, 8, 6), [0.36 + r() * 0.16, 0.5 + r() * 0.14, 0.26]]); return merge(parts); })();
  SP.rock = (() => { const r = rng(5), parts = []; for (let i = 0; i < 3; i++) parts.push([ell(0.5 + r() * 0.5, 0.3 + r() * 0.3, 0.5 + r() * 0.4, (r() - 0.5) * 1.1, 0.2, (r() - 0.5) * 0.8, 6, 5), [0.42 + r() * 0.1, 0.38 + r() * 0.08, 0.32]]); return merge(parts); })();
  const SC = { euc: 0.5, cypress: 0.55, acacia: 0.7, palm: 0.65, rock: 0.3, bush: 0.8, pear: 0.4 };
  const treeMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const MAXTREE = lowQ ? 50 : 110;
  const species = {};
  for (const k of Object.keys(SP)) { const m = new THREE.InstancedMesh(SP[k], treeMat, MAXTREE); m.count = 0; m.frustumCulled = false; group.add(m); species[k] = m; }

  // ---- art-deco facades -------------------------------------------------------------------------------------------------------------
  const PASTEL = ['#efe2c2', '#e8b9a0', '#d9e3cf', '#f3d6b6', '#c7dde6', '#f0c9c0', '#e9d28a'];
  const facade = (seed) => {
    const r = rng(seed * 7 + 5), W = 320, H = 440, c = canvas(W, H), g = c.getContext('2d');
    const base = PASTEL[seed % PASTEL.length];
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    const id = g.getImageData(0, 0, W, H), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(id, 0, 0);
    // stain from the top, floor bands
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(60,40,20,0.22)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const floors = 3, fh = (H - 90) / floors, cols = 4 + (seed % 2);
    g.fillStyle = 'rgba(30,24,20,0.5)'; g.fillRect(0, 36, W, 6); g.fillRect(0, 44, W, 3);   // cornice
    for (let f = 0; f < floors; f++) {
      const y = 62 + f * fh;
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y + fh - 8, W, 8);               // balcony slab
      for (let q = 0; q < cols; q++) {
        const x = 18 + q * ((W - 36) / cols), w = (W - 36) / cols - 18;
        g.fillStyle = 'rgba(20,28,40,0.78)'; g.fillRect(x, y + 10, w, fh - 34);
        g.fillStyle = 'rgba(250,244,228,0.95)'; g.fillRect(x - 3, y + 6, w + 6, 5); g.fillRect(x - 3, y + fh - 26, w + 6, 4);
        g.fillStyle = 'rgba(200,150,90,0.55)'; g.fillRect(x + w * 0.5 - 1, y + 10, 2, fh - 34);
        if (r() > 0.6) { g.fillStyle = ['#2f6d5a', '#7a3b2e', '#355a8a'][Math.floor(r() * 3)]; g.fillRect(x, y + 10, w * 0.48, fh - 34); }
      }
    }
    // shop front: awnings and doors
    const y0 = 62 + floors * fh;
    g.fillStyle = 'rgba(30,24,18,0.55)'; g.fillRect(0, y0, W, H - y0);
    for (let q = 0; q < 3; q++) { const x = 14 + q * ((W - 28) / 3); g.fillStyle = ['#c9492f', '#2f6d5a', '#e8b923'][(q + seed) % 3]; g.fillRect(x, y0 + 4, (W - 28) / 3 - 10, 14); g.fillStyle = 'rgba(244,220,170,0.5)'; g.fillRect(x + 6, y0 + 22, (W - 28) / 3 - 22, H - y0 - 26); }
    return c;
  };
  const FAC = []; for (let i = 0; i < 6; i++) FAC.push(tex(facade(i), 1, 1, 4));
  const bldPool = [];
  const bGeo = new THREE.BoxGeometry(1, 1, 1); bGeo.translate(0, 0.5, 0);
  const roofMat = matBase({ color: 0xcfc7b5 });
  for (let i = 0; i < (lowQ ? 8 : 16); i++) {
    const m = new THREE.Mesh(bGeo, [0, 1, 2, 3, 4, 5].map((s) => (s === 2 || s === 3 ? roofMat : matBase({ map: FAC[i % FAC.length] }))));
    const par = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.07, 1.02), roofMat); par.position.set(0, 1.0, 0); m.add(par);
    m.visible = false; group.add(m); bldPool.push(m);
  }
  // tower: a tall square block with fins (a cinema tower) now and then
  // ---- walls, lamps, boards, arches -----------------------------------------------------------------------------------------------
  const stoneTex = (() => { const c = canvas(256, 64), g = c.getContext('2d'), r = rng(8); g.fillStyle = '#8f7a62'; g.fillRect(0, 0, 256, 64);
    for (let y = 0; y < 64; y += 16) for (let x = -((y / 16) % 2) * 20; x < 256; x += 40) { g.fillStyle = `rgb(${128 + r() * 36},${108 + r() * 30},${84 + r() * 24})`; g.fillRect(x + 1, y + 1, 38, 14); }
    return tex(c, 1, 1, 4); })();
  const wallGeo = new THREE.BoxGeometry(1, 1, 1); wallGeo.translate(0, 0.5, 0);
  const wallMat = matBase({ map: stoneTex });
  const WALLS = lowQ ? 12 : 24, walls = new THREE.InstancedMesh(wallGeo, wallMat, WALLS); walls.count = 0; walls.frustumCulled = false; group.add(walls);
  const lampGeo = merge([[taper(0.05, 0.035, 5.4, 0, 0, 0, 6), [0.16, 0.18, 0.2]], [ell(0.34, 0.1, 0.16, 0.34, 5.5, 0, 8, 5), [0.95, 0.9, 0.75]]]);
  const lamps = new THREE.InstancedMesh(lampGeo, treeMat, 14); lamps.count = 0; lamps.frustumCulled = false; group.add(lamps);
  const post = new THREE.BoxGeometry(0.08, 1, 0.08); post.translate(0, 0.5, 0);
  const label = (txt, w, h, bg, fg) => {
    const c = canvas(w, h), g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = '#2c2418'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = fg; g.font = `800 ${Math.round(h * 0.52)}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 2);
    return c;
  };
  const kmBoards = [0, 1, 2].map(() => {
    const cv = canvas(256, 100), t = tex(cv, 1, 1, 4); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.6), matBase({ map: t, side: THREE.DoubleSide }));
    const p = new THREE.Mesh(post, matBase({ color: 0x4a3a2a })); p.scale.y = 1.5; p.position.set(0, 0, 0); m.position.y = 1.7;
    const g = new THREE.Group(); g.add(p, m); g.visible = false; g.userData = { cv, t, txt: '' }; group.add(g); return g;
  });
  const setLabel = (b, txt) => {
    if (b.userData.txt === txt) return; b.userData.txt = txt;
    const g = b.userData.cv.getContext('2d'); const c = label(txt, 256, 100, '#f6f0dc', '#2c2418'); g.drawImage(c, 0, 0); b.userData.t.needsUpdate = true;
  };
  const chev = (() => { const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.08), matBase({ color: 0xf2b81c })); const p = new THREE.Mesh(post, matBase({ color: 0x4a3a2a })); p.scale.y = 1.2; p.position.y = -1.7; m.position.y = 1.7;
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.1), matBase({ color: 0x2a2008 })); a.position.set(0, 0.0, 0.05); a.rotation.z = 0.7; a.position.y = 0.12; m.add(a); const a2 = a.clone(); a2.position.y = -0.12; m.add(a2);
    const g = new THREE.Group(); g.add(m, p); return g; })();
  const hairpinSigns = [0, 1].map(() => { const g = chev.clone(true); g.visible = false; group.add(g); return g; });
  const archFor = (txt, col) => {
    const g = new THREE.Group();
    const post0 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.2, 0.5), matBase({ color: 0xd8d2c0 }));
    for (const z of [-3.2, 3.2]) { const p = post0.clone(); p.position.set(0, 3.6, z); g.add(p); }
    const bn = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 7.2), matBase({ color: col })); bn.position.y = 7.4; g.add(bn);
    const lc = label(txt, 512, 160, col, '#ffffff'); const t = tex(lc, 1, 1, 4); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 1.5), matBase({ map: t, side: THREE.DoubleSide })); sign.position.set(0.28, 7.4, 0); sign.rotation.y = Math.PI / 2; g.add(sign);
    const sign2 = sign.clone(); sign2.position.x = -0.28; g.add(sign2);
    g.visible = false; group.add(g); return g;
  };
  const startArch = archFor('START', 0x1f8a66), finishArch = archFor('FINISH', 0xc92a2f);
  const chequer = (() => { const c = canvas(64, 256), g = c.getContext('2d'); for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'; g.fillRect(j * 16, i * 16, 16, 16); } const t = tex(c, 1, 1, 4); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; })();
  const finishLine = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 5.2), matBase({ map: chequer })); finishLine.rotation.x = -Math.PI / 2; finishLine.position.y = 0.01; finishLine.visible = false; group.add(finishLine);
  const startLine = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 5.2), matBase({ color: 0xf6f2e6 })); startLine.rotation.x = -Math.PI / 2; startLine.position.y = 0.01; startLine.visible = false; group.add(startLine);
  // crowd barriers: metal fence panels along both edges near the start and finish
  const barGeo = merge([[new THREE.BoxGeometry(2.4, 0.06, 0.06).translate(0, 1.0, 0), [0.7, 0.72, 0.76]], [new THREE.BoxGeometry(2.4, 0.06, 0.06).translate(0, 0.55, 0), [0.7, 0.72, 0.76]],
    [new THREE.BoxGeometry(0.07, 1.05, 0.5).translate(-1.2, 0.52, 0), [0.62, 0.64, 0.68]], [new THREE.BoxGeometry(0.07, 1.05, 0.5).translate(1.2, 0.52, 0), [0.62, 0.64, 0.68]],
    [new THREE.BoxGeometry(2.3, 0.7, 0.03).translate(0, 0.62, 0), [0.88, 0.2, 0.16]]]);
  const BARS = lowQ ? 20 : 48, bars = new THREE.InstancedMesh(barGeo, treeMat, BARS); bars.count = 0; bars.frustumCulled = false; group.add(bars);
  // contact shadows: one soft blob under every bike
  const blobTex = (() => { const c = canvas(128, 64), g = c.getContext('2d'); const gr = g.createRadialGradient(64, 32, 2, 64, 32, 62); gr.addColorStop(0, 'rgba(0,0,0,0.62)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 64); return tex(c, 1, 1, 1); })();
  blobTex.wrapS = blobTex.wrapT = THREE.ClampToEdgeWrapping;
  const blobGeo = new THREE.PlaneGeometry(2.6, 0.95); blobGeo.rotateX(-Math.PI / 2);
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: false });
  const blobs = [];
  const blob = (i) => { if (!blobs[i]) { const m = new THREE.Mesh(blobGeo, blobMat); m.renderOrder = 2; group.add(m); blobs[i] = m; } return blobs[i]; };

  // ---- per-frame: place everything --------------------------------------------------------------------------------------------------
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler(), C = new THREE.Color();
  const tint = {};
  const setInst = (mesh, n, x, y, z, sx, sy, sz, ry, col) => { M.compose(P.set(x, y, z), Q.setFromEuler(E.set(0, ry, 0)), S.set(sx, sy, sz)); mesh.setMatrixAt(n, M); if (col) mesh.setColorAt?.(n, col); };

  function update(w) {
    // w: { camS, tilt, tone, course, blobs:[{x (s), z, on}], t }
    const { tone, course: Cs0 } = w, T = TONES[tone] || TONES.morning;
    // everything below is in VISUAL metres: sim distance * sw (so the ground scrolls at a believable speed under 10x race time)
    const sw = w.sw || 1, camS = w.camS * sw;
    const Cs = { index: Cs0.index, L: Cs0.L * sw, landAt: (v) => Cs0.landAt(v / sw), hairpins: Cs0.hairpins.map((h) => h * sw) };
    group.rotation.z = w.tilt;
    group.position.set(0, 0, 0);
    const winLo = camS - 70, winHi = camS + 90;
    // scrolling textures
    roadTex.offset.x = (camS / 10) % 1;
    groundTex.offset.x = (camS / 60) % 1;
    if (state.tone !== tone) {
      state.tone = tone;
      const gm = new THREE.Color(T.ground[0]);
      ground.material.color.copy(gm).multiplyScalar(1.15);
      road.material.color.setRGB(1, 1, 1);
      for (const m of HS) m.material.color.setRGB(1, 1, 1).lerp(new THREE.Color(T.mid[0]), 0.35);
      ridges.forEach((m, i) => {
        const col = new THREE.Color(i === 0 ? T.far[0] : i === 1 ? T.far[1] : T.mid[1]);
        const arr = m.geometry.attributes.color.array;
        for (let q = 0; q < arr.length; q += 6) { arr[q] = col.r * 0.7; arr[q + 1] = col.g * 0.74; arr[q + 2] = col.b * 0.8; arr[q + 3] = col.r; arr[q + 4] = col.g; arr[q + 5] = col.b; }
        m.geometry.attributes.color.needsUpdate = true;
      });
    }
    ridges.forEach((m, i) => { m.position.x = -((camS * 1.0) % m.userData.period); });
    // hillside chunks (chunk ci always lives in pool slot ci mod n, so slots are stable while the camera moves)
    const c0 = Math.floor(winLo / CH), cN = HS.length;
    for (let ci = c0; ci < c0 + cN; ci++) {
      const m = HS[((ci % cN) + cN) % cN], mid = (ci + 0.5) * CH;
      const land = Cs.landAt(clamp(mid, 0, Cs.L - 1));
      if (m.userData.ci !== ci || m.userData.land !== land) {
        buildChunk(m, ci, land);
        const tx = landTex(land); if (m.material.map !== tx) { m.material.map = tx; m.material.needsUpdate = true; }
      }
      m.visible = true; m.position.x = mid - camS;
    }
    // trees, buildings, walls, lamps by slot
    const cnt = { euc: 0, acacia: 0, cypress: 0, pear: 0, palm: 0, bush: 0, rock: 0 };
    let nWall = 0, nLamp = 0, nBld = 0, nBar = 0;
    const slot = 14, i0 = Math.floor(winLo / slot), i1 = Math.ceil(winHi / slot);
    for (let i = i0; i <= i1; i++) {
      const sx = i * slot + hash(i * 3 + 1) * 6, x = sx - camS;
      if (sx < -80 || sx > Cs.L + 120) continue;
      const land = Cs.landAt(clamp(sx, 0, Cs.L - 1)), h1 = hash(i * 7 + Cs.index * 101), h2 = hash(i * 11 + 5 + Cs.index * 31), h3 = hash(i * 13 + 9);
      const yAt = (zz) => (zz < -3.2 ? hillH(-zz - 3.2, sx + (zz % 7), land) - 0.12 : 0);
      const add = (sp, xx, zz, s0) => { const mesh = species[sp]; if (cnt[sp] >= MAXTREE) return; const s = s0 * (SC[sp] || 1); const g = 0.86 + h3 * 0.28; C.setRGB(g, g * (0.96 + h2 * 0.08), g * 0.95); setInst(mesh, cnt[sp]++, xx, yAt(zz), zz, s, s * (0.9 + h2 * 0.25), s, h1 * TAU, C); };
      if (land !== 'town') {
        for (let q = 0; q < 3; q++) { const hq = hash(i * 19 + q * 7 + 2); const dz = -(5 + hq * 55); add('bush', x + (hq - 0.5) * 10, dz, 0.8 + hash(i + q) * 1.3); }
        if (h2 > 0.55) add('rock', x + 2, -(5 + h3 * 16), 0.5 + h1 * 0.8);
      }
      if (land === 'town') {
        if (h1 > 0.12 && nBld < bldPool.length) { const b = bldPool[nBld++], w2 = 9 + h2 * 8, h = 8 + h1 * 7, v = (i * 5) % FAC.length;
          b.visible = true; b.scale.set(w2, h, 8); const zb = -7.4 - h3 * 2.5; b.position.set(x, hillH(-zb - 3.2, sx, land) - 0.4, zb); void v; }
        if (i % 2 === 0) add('palm', x + 3, 4.1, 0.9 + h2 * 0.3);
        if (i % 3 === 0 && nLamp < 14) { setInst(lamps, nLamp++, x + 1.5, 0, 3.1, 1, 1, 1, 0, null); }
      } else if (land === 'forest') {
        if (h1 > 0.15) add('euc', x, -9 - h2 * 8, 0.9 + h3 * 0.5);
        if (h2 > 0.45) add('euc', x + 4, -12 - h1 * 8, 0.8 + h3 * 0.5);
      } else if (land === 'coast') {
        if (h1 > 0.25) add('palm', x, -5.2 - h2 * 4, 0.9 + h3 * 0.4);
        if (h2 > 0.7) add('acacia', x + 3, -11, 0.8);
      } else if (land === 'valley') {
        if (h1 > 0.25) add('acacia', x, -6.5 - h2 * 7, 0.8 + h3 * 0.5);
        if (h2 > 0.55) add('euc', x + 3, -10 - h3 * 8, 0.8 + h1 * 0.4);
        if (h3 > 0.7) add('pear', x + 1, 3.7 + h1 * 1.0, 0.7 + h2 * 0.3);
      } else if (land === 'terrace') {
        if (h1 > 0.45) add('cypress', x, -8 - h2 * 6, 0.9 + h3 * 0.4);
        if (h2 > 0.5) add('pear', x + 2, 3.7 + h1 * 1.0, 0.7 + h3 * 0.3);
        if (h3 > 0.8) add('euc', x + 4, -9 - h1 * 6, 0.8 + h2 * 0.4);
      } else {             // farm
        if (h1 > 0.45) add('euc', x, -10 - h2 * 8, 0.8 + h3 * 0.5);
        if (h2 > 0.6) add('acacia', x + 2, -9 - h3 * 7, 0.7 + h1 * 0.5);
        if (h3 > 0.72) add('pear', x + 1, 3.7 + h1 * 1.0, 0.7 + h2 * 0.3);
      }
      if ((land === 'terrace' || land === 'farm' || land === 'valley') && hash(Math.floor(i / 6) * 7 + Cs.index) > 0.45 && nWall < WALLS) {
        const hh = hash(i * 3 + 1); C.setRGB(0.9 + hh * 0.2, 0.9 + hh * 0.15, 0.85 + hh * 0.1); setInst(walls, nWall++, x + 6, 0, -3.0, 9.2, 0.7 + hh * 0.5, 0.45, 0, C);
      }
    }
    for (const k of Object.keys(species)) { species[k].count = cnt[k]; species[k].instanceMatrix.needsUpdate = true; if (species[k].instanceColor) species[k].instanceColor.needsUpdate = true; }
    walls.count = nWall; walls.instanceMatrix.needsUpdate = true; if (walls.instanceColor) walls.instanceColor.needsUpdate = true;
    lamps.count = nLamp; lamps.instanceMatrix.needsUpdate = true;
    for (let i = nBld; i < bldPool.length; i++) bldPool[i].visible = false;
    // km boards every 500 m on the near verge
    let kb = 0;
    for (let km = Math.max(0, Math.ceil(winLo / (500 * sw))); km * 500 * sw <= winHi && km * 500 * sw <= Cs.L + 0.01 && kb < kmBoards.length; km++) {
      const b = kmBoards[kb++], s = km * 500, togo = (Cs.L - s) / 1000;
      b.visible = true; b.position.set(s - camS, 0, 3.4);
      setLabel(b, s >= Cs.L - 0.01 ? '0 km' : `${togo.toFixed(togo % 1 ? 1 : 0)} km`);
    }
    for (; kb < kmBoards.length; kb++) kmBoards[kb].visible = false;
    let hp = 0;
    for (const h of Cs.hairpins) { if (h < winLo || h > winHi || hp >= hairpinSigns.length) continue; const g = hairpinSigns[hp++]; g.visible = true; g.position.set(h - camS, 0, -3.2); }
    for (; hp < hairpinSigns.length; hp++) hairpinSigns[hp].visible = false;
    const vis = (s) => s > winLo - 10 && s < winHi + 10;
    startArch.visible = vis(0); startArch.position.set(0 - camS, 0, 0);
    finishArch.visible = vis(Cs.L); finishArch.position.set(Cs.L - camS, 0, 0);
    startLine.visible = vis(0); startLine.position.x = 0 - camS + 0.6;
    finishLine.visible = vis(Cs.L); finishLine.position.x = Cs.L - camS;
    // barriers
    const edgeBar = (a, b) => { for (let s = Math.max(a, Math.floor(winLo / 2.4) * 2.4); s < b && s < winHi; s += 2.4) { if (nBar + 2 > BARS) return; for (const z of [-3.1, 3.1]) { setInst(bars, nBar++, s - camS, 0, z, 1, 1, 1, 0, null); } } };
    edgeBar(-30, 90); edgeBar(Cs.L - 150, Cs.L + 40);
    bars.count = nBar; bars.instanceMatrix.needsUpdate = true;
    // contact shadows
    let bi = 0;
    for (const b of w.blobs || []) { const m = blob(bi++); m.visible = true; m.position.set(b.x + 0.05, 0.02, b.z); m.scale.set(1, 1, 1); m.material.opacity = 1; }
    for (; bi < blobs.length; bi++) blobs[bi].visible = false;
    const fog = T.haze.replace(/rgba?\(([^)]+)\)/, (s, v) => `rgb(${v.split(',').slice(0, 3).join(',')})`);
    return fog;
  }
  return { root, group, update, tex: { roadTex, groundTex } };
}

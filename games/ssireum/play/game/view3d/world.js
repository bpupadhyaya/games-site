// The ssireum world: a raked sand ring with a straw-rope rim, tiered seating of real 3D spectators (crowd3d: hanbok, durumagi, gat hats,
// children, elders; cheering / gasping staggered), Korean pines, lanterns, a tiled courtyard wall, the photographic scenery kit behind
// and kicked-up sand grains. Presentation only: it reads what the presenter hands it (pose events), never the sim.
//
// Units are metres. Origin = the middle of the ring, +y up. The camera (see wrestlers.js) looks from +x/+z, so the far side of the
// ring (where the crowd is seen behind the wrestlers) is the direction (-sin 36deg, -cos 36deg).
import { THREE, buildScenery, createCrowd3d, CULTURES } from '../vendor3d/index.js';

const TAU = Math.PI * 2;
const rng = (seed) => { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const canvas = (w, h = w) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };
const ctex = (c, { rep = null, srgb = true, aniso = 4 } = {}) => {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
};

export const RING_R = 4.5;               // the sand ring (radius, m): a real ssireum ring is 9 m across; the picture crops to the middle
const TIERS = 4, TIER_R0 = 7.0, TIER_W = 1.0;

// Korean hanbok palette for the spectators: pastel jeogori / chima, durumagi, plain linen; black horsehair hats (gat) are painted in below.
if (!CULTURES.korean_festival) {
  CULTURES.korean_festival = {
    skin: [['east', 8], ['fair', 1]], hair: [['black', 8], ['dkbrown', 1.5], ['grey', 1.2]],
    hats: [[0, 4], [2, 3.2], [1, 0.8], [8, 0.4]], womenHat: [[0, 8], [5, 0.6]],
    garment: [[2, 5], [1, 2.5], [0, 1]], womanGarment: [[3, 7], [1, 1.5]],
    top: ['#f3efe2', '#e8e1cc', '#7fa3bd', '#d0707a', '#93b890', '#e8c46a', '#a890c4', '#f3d6cf', '#5d86a8', '#c7566a', '#7aa07c', '#efe3bb'],
    bottom: ['#2a2d3a', '#d8cfb8', '#3b4a63', '#c25a68', '#52715a', '#e9dfc6'],
    scarf: 0.05, patterns: [[0, 6], [1, 1]], flag: ['#c8312f', '#2c5fb8', '#f3efe2'],
  };
}

// ------------------------------------------------------------------------------------------------ textures
function sandTexture() {
  const N = 1024, c = canvas(N), g = c.getContext('2d'), r = rng(31);
  const grd = g.createRadialGradient(N / 2, N / 2, N * 0.05, N / 2, N / 2, N / 2);
  grd.addColorStop(0, '#e6c993'); grd.addColorStop(0.7, '#dcbb82'); grd.addColorStop(1, '#c79f68');
  g.fillStyle = grd; g.fillRect(0, 0, N, N);
  // trodden, scuffed patches
  for (let i = 0; i < 90; i++) {
    const x = r() * N, y = r() * N, rad = 20 + r() * 70;
    const p = g.createRadialGradient(x, y, 1, x, y, rad); const dark = r() < 0.6;
    p.addColorStop(0, dark ? 'rgba(120,86,48,0.16)' : 'rgba(255,240,205,0.16)'); p.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = p; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // raked arcs near the edge and a few across the middle (a ring that has been groomed by hand before the bout)
  g.lineWidth = 1.6;
  for (let k = 0; k < 40; k++) {
    const rr = N * 0.5 * (0.52 + k * 0.011);
    g.strokeStyle = k % 2 ? 'rgba(110,78,42,0.22)' : 'rgba(255,244,214,0.20)';
    g.beginPath(); g.arc(N / 2, N / 2, rr, 0, TAU); g.stroke();
  }
  // grain
  const id = g.getImageData(0, 0, N, N), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 34; d[i] += n; d[i + 1] += n * 0.9; d[i + 2] += n * 0.75; }
  g.putImageData(id, 0, 0);
  for (let i = 0; i < 5200; i++) { g.fillStyle = r() < 0.5 ? 'rgba(90,62,34,0.35)' : 'rgba(255,248,226,0.45)'; g.fillRect(r() * N, r() * N, 1 + r() * 1.6, 1 + r() * 1.2); }
  return ctex(c, { aniso: 8 });
}
function grainBump() {
  const N = 256, c = canvas(N), g = c.getContext('2d'), r = rng(5);
  const id = g.createImageData(N, N);
  for (let i = 0; i < N * N; i++) { const v = 128 + (r() - 0.5) * 120; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
  g.putImageData(id, 0, 0);
  return ctex(c, { rep: [14, 14], srgb: false });
}
function ropeTexture() {
  const c = canvas(128, 32), g = c.getContext('2d');
  g.fillStyle = '#c9a85c'; g.fillRect(0, 0, 128, 32);
  g.strokeStyle = '#8a6a30'; g.lineWidth = 5;
  for (let x = -32; x < 160; x += 16) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 28, 0); g.stroke(); }
  g.strokeStyle = 'rgba(255,236,170,0.55)'; g.lineWidth = 2;
  for (let x = -32; x < 160; x += 16) { g.beginPath(); g.moveTo(x + 6, 32); g.lineTo(x + 34, 0); g.stroke(); }
  return ctex(c, { rep: [60, 1] });
}
function woodTexture() {
  const c = canvas(256, 128), g = c.getContext('2d'), r = rng(8);
  for (let i = 0; i < 4; i++) { const v = 100 + r() * 24; g.fillStyle = `rgb(${v + 54},${v + 20},${v - 18})`; g.fillRect(0, i * 32, 256, 31); g.fillStyle = 'rgba(30,14,4,0.6)'; g.fillRect(0, i * 32 + 31, 256, 1.5);
    g.strokeStyle = 'rgba(60,30,10,0.28)'; g.lineWidth = 1; for (let k = 0; k < 6; k++) { const y = i * 32 + 3 + r() * 25; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + r() * 4 - 2, 170, y + r() * 4 - 2, 256, y); g.stroke(); } }
  return ctex(c, { rep: [10, 1] });
}
function strawMatTexture() {
  const c = canvas(128, 128), g = c.getContext('2d'), r = rng(12);
  g.fillStyle = '#cdb273'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) { g.fillStyle = r() < 0.5 ? 'rgba(150,118,60,0.4)' : 'rgba(240,222,160,0.45)'; g.fillRect(r() * 128, r() * 128, 1 + r() * 2, 8 + r() * 22); }
  g.fillStyle = 'rgba(90,60,28,0.5)'; g.fillRect(0, 0, 128, 3); g.fillRect(0, 64, 128, 2);
  return ctex(c, { rep: [10, 2] });
}
function barkTexture() {
  const c = canvas(64, 128), g = c.getContext('2d'), r = rng(2);
  g.fillStyle = '#6b3f26'; g.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 60; i++) { g.fillStyle = r() < 0.5 ? 'rgba(40,18,8,0.55)' : 'rgba(176,96,60,0.45)'; g.fillRect(r() * 64, r() * 128, 1 + r() * 4, 10 + r() * 34); }
  return ctex(c, { rep: [1, 3] });
}
function needleTexture() {
  const c = canvas(128), g = c.getContext('2d'), r = rng(9);
  g.fillStyle = '#365c3a'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const x = r() * 128, y = r() * 128, a = r() * Math.PI; g.strokeStyle = r() < 0.5 ? 'rgba(18,48,26,0.8)' : 'rgba(110,160,86,0.65)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); g.stroke();
  }
  return ctex(c, { rep: [2, 2] });
}
function softDot(size = 64, col = '255,235,190') {
  const c = canvas(size), g = c.getContext('2d');
  const p = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  p.addColorStop(0, `rgba(${col},1)`); p.addColorStop(0.4, `rgba(${col},0.7)`); p.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = p; g.fillRect(0, 0, size, size);
  return ctex(c);
}
function roofTexture() {
  const c = canvas(256, 128), g = c.getContext('2d');
  g.fillStyle = '#3a3a40'; g.fillRect(0, 0, 256, 128);
  for (let x = 0; x < 256; x += 16) { g.fillStyle = (x / 16) % 2 ? '#2c2c33' : '#46464e'; g.fillRect(x, 0, 14, 128); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x + 14, 0, 2, 128); }
  for (let y = 0; y < 128; y += 16) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y, 256, 2); }
  return ctex(c, { rep: [10, 1] });
}
function plasterTexture() {
  const c = canvas(128), g = c.getContext('2d'), r = rng(44);
  g.fillStyle = '#e8dfcc'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 380; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '120,100,70' : '255,250,235'},${0.05 + r() * 0.12})`; g.fillRect(r() * 128, r() * 128, 2 + r() * 8, 2 + r() * 6); }
  return ctex(c, { rep: [14, 1] });
}

// ------------------------------------------------------------------------------------------------ geometry helpers
// An annulus sector from angle A0 to A1 (radians, x = r sin A, z = r cos A), radii r0..r1, from y0 up to y1.
function sector(r0, r1, A0, A1, y0, y1, seg = 48) {
  const s = new THREE.Shape();
  const P = (r, A) => [r * Math.sin(A), -r * Math.cos(A)];
  let [x, y] = P(r1, A0); s.moveTo(x, y);
  for (let i = 1; i <= seg; i++) { [x, y] = P(r1, A0 + (A1 - A0) * i / seg); s.lineTo(x, y); }
  for (let i = seg; i >= 0; i--) { [x, y] = P(r0, A0 + (A1 - A0) * i / seg); s.lineTo(x, y); }
  const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, steps: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
  return g;
}

// ------------------------------------------------------------------------------------------------ the pine
function makePine(seed, h = 5.2, mats) {
  const r = rng(seed), g = new THREE.Group();
  // a leaning, slightly twisted trunk
  const lean = (r() - 0.5) * 0.9, pts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector3(Math.sin(t * 2.6 + seed) * 0.18 + lean * t * t, h * t * 0.86, Math.cos(t * 2.1 + seed) * 0.12)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.TubeGeometry(curve, 24, 0.17, 8, false);
  // taper
  const pos = tube.attributes.position, n = 24 + 1;
  for (let i = 0; i < pos.count; i++) { const ring = Math.floor(i / 9), t = ring / (n - 1); const c = curve.getPoint(t); const k = 1 - 0.62 * t; pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * k, pos.getY(i), c.z + (pos.getZ(i) - c.z) * k); }
  tube.computeVertexNormals();
  const trunk = new THREE.Mesh(tube, mats.bark); trunk.castShadow = true; g.add(trunk);
  // flat, layered foliage pads (the umbrella silhouette of a Korean red pine)
  const pads = 6 + Math.floor(r() * 2);
  for (let i = 0; i < pads; i++) {
    const t = 0.38 + i / pads * 0.6, c = curve.getPoint(Math.min(1, t));
    const side = r() * TAU, off = 0.4 + r() * 1.1 * (1 - t * 0.5);
    const sz = 0.9 + r() * 0.9 + (1 - t) * 0.5;
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), mats.needle);
    m.scale.set(sz * 1.5, sz * 0.34, sz * 1.15); m.position.set(c.x + Math.cos(side) * off, c.y + 0.1 + r() * 0.3, c.z + Math.sin(side) * off);
    m.rotation.y = r() * TAU; m.rotation.z = (r() - 0.5) * 0.3; m.castShadow = true; g.add(m);
    // a bough from the trunk
    const bough = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.07, off + 0.2, 6), mats.bark);
    bough.position.set(c.x + Math.cos(side) * off * 0.5, c.y + 0.02, c.z + Math.sin(side) * off * 0.5);
    bough.rotation.z = Math.PI / 2; bough.rotation.y = -side; g.add(bough);
  }
  return g;
}

// ------------------------------------------------------------------------------------------------ lantern + pole
function makeLantern(color = '#e8573b') {
  const g = new THREE.Group();
  const glow = new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color('#ff9a3c'), emissiveIntensity: 1.6, roughness: 0.6, transparent: false });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 12), glow); body.scale.set(1, 1.25, 1); g.add(body);
  const cap = new THREE.MeshStandardMaterial({ color: '#2a1d14', roughness: 0.7 });
  for (const y of [0.27, -0.27]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12), cap); c.position.y = y; g.add(c); }
  // rib bands
  const ribM = new THREE.MeshBasicMaterial({ color: '#7a2a14' });
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.2 * Math.sin(Math.PI * (i + 1) / 5) * 1.0 + 0.02, 0.006, 4, 24), ribM); b.rotation.x = Math.PI / 2; b.position.y = (0.25 * 1.25) * Math.cos(Math.PI * (i + 1) / 5) * 1.0; g.add(b); }
  const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.03, 0.22, 6), new THREE.MeshStandardMaterial({ color: '#d8b04a' })); tassel.position.y = -0.42; g.add(tassel);
  g.userData.glow = glow;
  return g;
}

// ------------------------------------------------------------------------------------------------ the world
const RING_DEFS = {
  danoh: {
    light: 'day', tod: 'day',
    layers: [{ t: 'sky', id: 'sky-clear' }, { t: 'backdrop', id: 'bd-alpine-day' }, { t: 'band', id: 'band-hills-green', r: 70, h: 20 },
      { t: 'ground', id: 'gr-dirt', size: 120, repeat: 16 }],
    pines: [[120, 15, 8, 1], [175, 16, 9, 2], [215, 17, 8.5, 3], [262, 15, 8, 4], [310, 16.5, 9, 5], [345, 14.5, 7.5, 6]],
    lanterns: 0, wall: false, moon: false, banners: true,
  },
  moon: {
    light: 'night', tod: 'night',
    layers: [{ t: 'sky', id: 'sky-dusk' }, { t: 'backdrop', id: 'bd-alpine-snow' }, { t: 'band', id: 'band-hills-green', r: 70, h: 20 },
      { t: 'ground', id: 'gr-dirt', size: 120, repeat: 16 }],
    pines: [[130, 15, 8, 11], [200, 16.5, 9, 12], [270, 15.5, 8.5, 13], [335, 15, 8, 14]],
    lanterns: 8, wall: false, moon: true, banners: false,
  },
  court: {
    light: 'evening', tod: 'dusk',
    layers: [{ t: 'sky', id: 'sky-peach' }, { t: 'backdrop', id: 'bd-golden-ridges' }, { t: 'band', id: 'band-hills-green', r: 70, h: 20 },
      { t: 'ground', id: 'gr-cobble', size: 120, repeat: 40 }],
    pines: [[150, 17, 8, 21], [290, 17, 8.5, 22]],
    lanterns: 6, wall: true, moon: false, banners: false,
  },
};

/**
 * Build the world into `stage.scene`. Returns { update(dt, camera), setRing(id), kick(...), react(kind, o), setExcitement(v), setQuality(q), group, ready }.
 */
export function createWorld(stage, { quality = 'medium', base } = {}) {
  const scene = stage.scene;
  const root = new THREE.Group(); root.name = 'ssireum-world'; scene.add(root);
  const mats = {
    bark: new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 0.95 }),
    needle: new THREE.MeshStandardMaterial({ map: needleTexture(), roughness: 0.9, color: '#9ab88a' }),
  };
  const state = { ring: null, excite: 0.15, scenery: null, lanterns: [], flicker: [], crowd: null, kids: 0 };

  // ---- the sand ring (always there; the ring id restyles it) ----
  const sandTex = sandTexture();
  const sandMat = new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1, metalness: 0, bumpMap: grainBump(), bumpScale: 1.1 });
  const sand = new THREE.Mesh(new THREE.CircleGeometry(RING_R + 0.05, 96), sandMat);
  sand.rotation.x = -Math.PI / 2; sand.position.y = 0.004; sand.receiveShadow = true; root.add(sand);
  // raised lip of damp, packed sand and the straw rope laid on it
  const lipProfile = [[RING_R, 0.0], [RING_R + 0.03, 0.05], [RING_R + 0.12, 0.085], [RING_R + 0.28, 0.07], [RING_R + 0.5, 0.0]].map(([x, y]) => new THREE.Vector2(x, y));
  const lip = new THREE.Mesh(new THREE.LatheGeometry(lipProfile, 96), new THREE.MeshStandardMaterial({ color: '#c8a470', roughness: 1, bumpMap: sandMat.bumpMap, bumpScale: 1.2 }));
  lip.receiveShadow = true; lip.position.y = 0.003; root.add(lip);
  const rope = new THREE.Mesh(new THREE.TorusGeometry(RING_R + 0.08, 0.055, 10, 128), new THREE.MeshStandardMaterial({ map: ropeTexture(), roughness: 0.9 }));
  rope.rotation.x = Math.PI / 2; rope.position.y = 0.09; rope.castShadow = true; rope.receiveShadow = true; root.add(rope);
  // the outer ground disc where the crowd's feet go (the scenery ground is under everything)
  const apron = new THREE.Mesh(new THREE.RingGeometry(RING_R + 0.4, TIER_R0 + 0.1, 96), new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1, color: '#a58f6a' }));
  apron.rotation.x = -Math.PI / 2; apron.position.y = 0.012; apron.receiveShadow = true; root.add(apron);

  // ---- tiers of seating: planked fronts, straw mats on top ----
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.85 });
  const matMat = new THREE.MeshStandardMaterial({ map: strawMatTexture(), roughness: 1 });
  const A0 = (78 * Math.PI) / 180, A1 = (358 * Math.PI) / 180;           // the arc of the far side
  const tierTop = [];
  for (let i = 0; i < TIERS; i++) {
    const r0 = TIER_R0 + i * TIER_W, r1 = r0 + TIER_W, h = 0.05 + i * 0.3;
    const body = new THREE.Mesh(sector(r0, r1, A0, A1, 0, h, 64), [matMat, woodMat]); body.castShadow = true; body.receiveShadow = true; root.add(body);
    tierTop.push(h);
  }
  // end posts and a plank guard rail along the front of the first tier
  const postMat = new THREE.MeshStandardMaterial({ color: '#6a4426', roughness: 0.9 });
  for (const A of [A0, A1]) for (const [r, hh] of [[TIER_R0 - 0.1, 0.9], [TIER_R0 + TIERS * TIER_W - 0.1, 2.2]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, hh, 8), postMat); p.position.set(r * Math.sin(A), hh / 2, r * Math.cos(A)); p.castShadow = true; root.add(p);
  }

  // ---- people ----
  function buildCrowd() {
    const pts = [], r = rng(77);
    const dens = quality === 'low' ? 0.7 : 1;
    for (let i = 0; i < TIERS; i++) {
      const rr = TIER_R0 + i * TIER_W + TIER_W * 0.5, arc = A1 - A0, n = Math.round(arc * rr / 0.62 * dens);
      for (let k = 0; k < n; k++) {
        const A = A0 + 0.04 + (k + 0.15 + r() * 0.7) / n * (arc - 0.08);
        const rj = rr + (r() - 0.5) * 0.18;
        const x = rj * Math.sin(A), z = rj * Math.cos(A);
        pts.push({ x, y: tierTop[i], z, yaw: Math.atan2(-x, -z) + (r() - 0.5) * 0.5, seated: 1 });
      }
    }
    try {
      const crowd = createCrowd3d(stage, {
        points: pts, seed: 14, culture: 'korean_festival', quality: quality === 'low' ? 'low' : quality === 'high' ? 'high' : 'medium',
        excitement: 0.2, kids: 0.16, props: { flag: 0.0, phone: 0.0, child: 0.05 }, blobShadows: true,
      });
      // the gat: every brimmed hat is black horsehair
      const packBlack = 22 + 18 * 256 + 15 * 65536;
      for (const p of crowd.people) if (p.k[1] === 2) p.col1[0] = packBlack;
      crowd.invalidate();
      state.crowd = crowd;
    } catch (e) { console.warn('crowd3d failed', e); }
  }
  buildCrowd();

  // ---- ring-specific set dressing ----
  const dress = new THREE.Group(); root.add(dress);
  const dispose = (grp) => { grp.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); }); };
  function clearDress() { for (const c of [...dress.children]) { dress.remove(c); dispose(c); } state.lanterns = []; state.flicker = []; }
  function lightsOff() { for (const l of state.flicker) { l.parent && l.parent.remove(l); } }

  function setRing(id) {
    const def = RING_DEFS[id] || RING_DEFS.danoh;
    if (state.ring === id) return;
    state.ring = id;
    clearDress(); lightsOff();
    // scenery (sky, mountains, ground): replaced per ring
    if (state.scenery) { root.remove(state.scenery.group); state.scenery.dispose?.(); state.scenery = null; }
    try {
      const sc = buildScenery({ layers: def.layers, timeOfDay: def.tod, quality: quality === 'low' ? 'low' : 'medium', clouds: 0.5, wind: 0.5, seed: 6, base: base ? base + 'scenery/' : undefined });
      root.add(sc.group); state.scenery = sc;
      sc.ready.then(() => stage.invalidate()).catch((e) => console.warn('scenery failed', e));
    } catch (e) { console.warn('scenery unavailable', e); }
    // pines
    for (const [deg, rad, h, seed] of def.pines) { const A = deg * Math.PI / 180; const p = makePine(seed, h, mats); p.position.set(rad * Math.sin(A), 0, rad * Math.cos(A)); p.rotation.y = seed * 1.7; dress.add(p); }
    // lanterns on poles behind the crowd
    for (let i = 0; i < def.lanterns; i++) {
      const A = A0 + 0.2 + (A1 - A0 - 0.4) * (i + 0.5) / def.lanterns, r = TIER_R0 + TIERS * TIER_W + 0.5;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 3.4, 8), postMat); pole.position.set(r * Math.sin(A), 1.7, r * Math.cos(A)); pole.castShadow = true; dress.add(pole);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6), postMat); arm.rotation.z = Math.PI / 2; arm.position.set(pole.position.x - 0.3 * Math.cos(A), 3.35, pole.position.z + 0.3 * Math.sin(A)); arm.rotation.y = A; dress.add(arm);
      const lan = makeLantern(i % 2 ? '#e8573b' : '#ee7a3a'); lan.position.set(r * Math.sin(A) - 0.55 * Math.sin(A), 2.9, r * Math.cos(A) - 0.55 * Math.cos(A)); lan.userData.ph = i * 1.3; dress.add(lan); state.lanterns.push(lan);
    }
    if (def.lanterns && quality !== 'low') {
      for (const i of [1, 4]) {
        const l = new THREE.PointLight('#ffb15a', 2.4, 9, 1.6);
        const src = state.lanterns[Math.min(i, state.lanterns.length - 1)];
        if (src) { l.position.copy(src.position).add(new THREE.Vector3(0, -0.3, 0.2)); dress.add(l); state.flicker.push(l); }
      }
    }
    // festival bunting
    if (def.banners) {
      const cols = ['#c8312f', '#f3efe2', '#2c5fb8', '#e8c46a', '#3f7d5a'];
      const rr = TIER_R0 + TIERS * TIER_W + 0.9;
      for (let i = 0; i < 12; i++) {
        const A = A0 + 0.35 + (A1 - A0 - 0.7) * i / 11;
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 1.1), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.8, side: THREE.DoubleSide }));
        flag.position.set(rr * Math.sin(A), 3.1 - 0.15 * Math.sin(i * 1.7), rr * Math.cos(A)); flag.rotation.y = A + Math.PI / 2; flag.userData.sway = i * 0.9; dress.add(flag);
        if (i === 0 || i === 11) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 4.2, 8), postMat); pole.position.set(rr * Math.sin(A), 2.1, rr * Math.cos(A)); dress.add(pole); }
      }
      state.flags = dress.children.filter((c) => c.userData.sway !== undefined);
    } else state.flags = [];
    // the tiled courtyard wall (hanok): whitewashed plaster, dark tile cap with upswept eaves
    if (def.wall) {
      const rr = TIER_R0 + TIERS * TIER_W + 2.2, N = 36;
      const plaster = new THREE.MeshStandardMaterial({ map: plasterTexture(), roughness: 0.95 });
      const roof = new THREE.MeshStandardMaterial({ map: roofTexture(), roughness: 0.7 });
      for (let i = 0; i < N; i++) {
        const a0 = A0 - 0.2 + (A1 - A0 + 0.4) * i / N, a1 = A0 - 0.2 + (A1 - A0 + 0.4) * (i + 1) / N, am = (a0 + a1) / 2;
        const len = rr * (a1 - a0) * 1.02;
        const seg = new THREE.Group(); seg.position.set(rr * Math.sin(am), 0, rr * Math.cos(am)); seg.rotation.y = am;
        const w = new THREE.Mesh(new THREE.BoxGeometry(len, 2.6, 0.5), plaster); w.position.y = 1.3; seg.add(w);
        const beam = new THREE.Mesh(new THREE.BoxGeometry(len, 0.18, 0.62), postMat); beam.position.y = 2.65; seg.add(beam);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(len, 0.34, 1.25), roof); cap.position.y = 2.95; cap.rotation.x = 0; seg.add(cap);
        for (const s of [-1, 1]) { const eave = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.55), roof); eave.position.set(0, 2.88 + 0.05, s * 0.78); eave.rotation.x = s * 0.2; seg.add(eave); }
        const ridge = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, 0.2), new THREE.MeshStandardMaterial({ color: '#202026', roughness: 0.6 })); ridge.position.y = 3.2; seg.add(ridge);
        seg.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        dress.add(seg);
      }
    }
    if (def.moon) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(2.6, 28, 20), new THREE.MeshBasicMaterial({ color: '#fff4cf', fog: false }));
      m.position.set(-34, 36, -78); dress.add(m);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(128, '255,244,200'), transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
      halo.scale.set(26, 26, 1); halo.position.copy(m.position); dress.add(halo);
    }
    state.crowd && state.crowd.invalidate();
    stage.invalidate();
  }

  // ---- kicked-up sand grains ----
  const NP = 220;
  const pg = new THREE.BufferGeometry();
  const ppos = new Float32Array(NP * 3), pvel = new Float32Array(NP * 3), plife = new Float32Array(NP);
  for (let i = 0; i < NP; i++) ppos[i * 3 + 1] = -50;
  pg.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  const pmat = new THREE.PointsMaterial({ map: softDot(32, '236,208,150'), size: 0.075, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false, color: '#e6cd9a' });
  const grains = new THREE.Points(pg, pmat); grains.frustumCulled = false; root.add(grains);
  let pHead = 0;
  const rr2 = rng(901);
  function kick(x, z, n = 10, power = 1, dirX = 0, dirZ = 0) {
    for (let k = 0; k < n; k++) {
      const i = pHead; pHead = (pHead + 1) % NP;
      const a = rr2() * TAU, s = (0.4 + rr2() * 1.4) * power;
      ppos[i * 3] = x + (rr2() - 0.5) * 0.25; ppos[i * 3 + 1] = 0.03 + rr2() * 0.06; ppos[i * 3 + 2] = z + (rr2() - 0.5) * 0.25;
      pvel[i * 3] = Math.cos(a) * s * 0.7 + dirX * s * 0.9; pvel[i * 3 + 1] = (0.7 + rr2() * 1.4) * power; pvel[i * 3 + 2] = Math.sin(a) * s * 0.7 + dirZ * s * 0.9;
      plife[i] = 0.55 + rr2() * 0.55;
    }
    pg.attributes.position.needsUpdate = true;
  }

  let time = 0;
  function update(dt, camera) {
    time += dt;
    // grains: ballistic, settle on the sand
    for (let i = 0; i < NP; i++) {
      if (plife[i] <= 0) { ppos[i * 3 + 1] = -50; continue; }
      plife[i] -= dt;
      pvel[i * 3 + 1] -= 6.5 * dt;
      ppos[i * 3] += pvel[i * 3] * dt; ppos[i * 3 + 1] += pvel[i * 3 + 1] * dt; ppos[i * 3 + 2] += pvel[i * 3 + 2] * dt;
      pvel[i * 3] *= 0.985; pvel[i * 3 + 2] *= 0.985;
      if (ppos[i * 3 + 1] < 0.01) { ppos[i * 3 + 1] = 0.01; pvel[i * 3] *= 0.3; pvel[i * 3 + 1] = 0; pvel[i * 3 + 2] *= 0.3; }
    }
    pg.attributes.position.needsUpdate = true;
    for (const l of state.lanterns) { const f = 1.45 + 0.3 * Math.sin(time * 6.1 + l.userData.ph) + 0.15 * Math.sin(time * 13 + l.userData.ph * 3); l.userData.glow.emissiveIntensity = f; l.rotation.z = Math.sin(time * 1.1 + l.userData.ph) * 0.05; }
    state.flicker.forEach((l, i) => { l.intensity = 2.2 + 0.5 * Math.sin(time * 7 + i * 2) + 0.25 * Math.sin(time * 17 + i); });
    for (const f of state.flags || []) { f.rotation.x = Math.sin(time * 2.2 + f.userData.sway) * 0.25; f.rotation.z = Math.sin(time * 1.7 + f.userData.sway * 1.3) * 0.06; }
    if (state.scenery) state.scenery.update(dt, camera);
    if (state.crowd) state.crowd.update(dt, camera);
    stage.invalidate();
  }

  return {
    group: root, update, setRing, kick,
    react(kind, o) { state.crowd && state.crowd.react(kind, o); },
    setExcitement(v) { state.crowd && state.crowd.setExcitement(v); },
    setQuality(q) { if (state.crowd) state.crowd.setQuality(q === 'low' ? 'low' : 'medium'); },
    get crowd() { return state.crowd; },
    get scenery() { return state.scenery; },
    ready() { return state.scenery ? state.scenery.ready : Promise.resolve(); },
  };
}

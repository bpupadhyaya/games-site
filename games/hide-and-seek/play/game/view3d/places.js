// The three places as 3D sets: ground, the buildings and trees around, lamps, and the light of that hour. Spots (props.js) and the
// children are placed by world.js on top. All procedural; the photographic backdrop (sky, distant rows) comes from scenery3d.
import { THREE, B, mat, wood, darkWood, stoneM, clayM, clothM, canvasTex, put, box, rbox, cyl, sph, lathe, plane, tube, rock, clothPlane, rnd, rngSeed, TAU, clamp } from './kit.js';

// ---- lights of the hour ---------------------------------------------------------------------------------------------------
export const HOURS = [
  { name: 'dusk',      bg: '#e7a084', fog: '#d9907c', fogNear: 26, fogFar: 78, hemiSky: '#8e7cc4', hemiGround: '#6a4a3a', hemi: 0.95, key: '#ffb98a', keyI: 2.6, keyPos: [-9, 9, 6], rim: '#ff9ac8', rimI: 0.9, rimPos: [8, 6, -10], exposure: 0.95, env: 0.35, tod: 'dusk' },
  { name: 'afternoon', bg: '#cfe6ee', fog: '#e8efe0', fogNear: 30, fogFar: 90, hemiSky: '#cfe6ff', hemiGround: '#8a7a50', hemi: 1.05, key: '#fff0c8', keyI: 3.1, keyPos: [-7, 12, 7], rim: '#bfe2ff', rimI: 0.8, rimPos: [8, 6, -9], exposure: 1.0, env: 0.4, tod: 'day' },
  { name: 'evening',   bg: '#7f8ab8', fog: '#7a7fa8', fogNear: 22, fogFar: 70, hemiSky: '#6a7cc0', hemiGround: '#4a4258', hemi: 0.9, key: '#ffcf9a', keyI: 2.2, keyPos: [-8, 8, 7], rim: '#7aa0ff', rimI: 1.0, rimPos: [8, 5, -9], exposure: 0.95, env: 0.35, tod: 'dusk' },
];

// ---- helpers ----------------------------------------------------------------------------------------------------------------
function groundPatch(w, d, drawFn, repeat, y = 0.004, px = 1024) {
  const t = canvasTex(px, px, drawFn, { repeat, aniso: 8 });
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = y; mesh.receiveShadow = true;
  return mesh;
}
// soft edge: a radial alpha fade so the patch melts into the scenery ground
function fadeEdge(w, d, color = '#000') {
  const t = canvasTex(64, 64, (c, W, H) => {
    const g = c.createRadialGradient(W / 2, H / 2, W * 0.28, W / 2, H / 2, W * 0.72); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  });
  void color; return t;
}
function noiseSpecks(c, w, h, n, cols, size = 3, seed = 3) {
  rngSeed(seed);
  for (let i = 0; i < n; i++) { c.fillStyle = cols[i % cols.length]; c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * size, 1 + rnd() * size); }
}

// A building front on a box: plaster texture with windows, shutters, optional arched door; tiled hip roof.
function building({ w, h, d, x, z, plaster, roof, windows = 3, floors = 2, shutter = '#3a5a4a', lit = 0.55, seed = 1, door = true, balcony = false, ry = 0 }) {
  const g = new THREE.Group();
  const tex = canvasTex(512, 512, (c, W, H) => {
    rngSeed(seed * 31);
    c.fillStyle = plaster; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '60,40,30'},${0.03 + rnd() * 0.05})`; c.fillRect(rnd() * W, rnd() * H, 6 + rnd() * 40, 3 + rnd() * 20); }
    const fw = W / windows, fh = H / floors;
    for (let f = 0; f < floors; f++) for (let k = 0; k < windows; k++) {
      const cx = fw * (k + 0.5), cy = fh * (f + 0.5) - (f === floors - 1 && door ? -fh * 0.1 : 0), ww = fw * 0.34, hh = fh * 0.46;
      if (f === floors - 1 && door && k === Math.floor(windows / 2)) {
        c.fillStyle = '#2a1a12'; c.beginPath(); c.moveTo(cx - ww * 0.8, H); c.lineTo(cx - ww * 0.8, H - hh * 1.2); c.arc(cx, H - hh * 1.2, ww * 0.8, Math.PI, 0); c.lineTo(cx + ww * 0.8, H); c.fill();
        c.fillStyle = 'rgba(255,200,120,0.5)'; c.fillRect(cx - ww * 0.55, H - hh * 1.1, ww * 1.1, hh * 1.1); continue;
      }
      const on = rnd() < lit;
      c.fillStyle = on ? `rgba(255,${190 + (rnd() * 40) | 0},${110 + (rnd() * 40) | 0},1)` : 'rgba(40,36,56,0.92)';
      c.fillRect(cx - ww / 2, cy - hh / 2, ww, hh);
      c.fillStyle = 'rgba(20,10,0,0.55)'; c.fillRect(cx - 1.5, cy - hh / 2, 3, hh); c.fillRect(cx - ww / 2, cy - 1.5, ww, 3);
      c.fillStyle = shutter; c.fillRect(cx - ww / 2 - ww * 0.32, cy - hh / 2, ww * 0.3, hh); c.fillRect(cx + ww / 2 + ww * 0.02, cy - hh / 2, ww * 0.3, hh);
      c.fillStyle = 'rgba(240,230,210,0.9)'; c.fillRect(cx - ww / 2 - 4, cy + hh / 2, ww + 8, 6);
    }
  }, { aniso: 8 });
  const wallM = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
  const side = new THREE.MeshStandardMaterial({ color: plaster, roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, wallM, side]);
  body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
  // hip roof
  const rm = clayM(roof, roof, { seed: 5, repeat: [4, 2] });
  const rg = new THREE.CylinderGeometry(0, 1, 1, 4, 1); rg.rotateY(Math.PI / 4);
  const rf = new THREE.Mesh(rg, rm); rf.scale.set(w * 0.72 + 0.4, 2.2, d * 0.72 + 0.4); rf.position.y = h + 1.1; rf.castShadow = true; g.add(rf);
  put(g, rbox(w + 0.4, 0.18, d + 0.4, 0.04, mat('#d9cdb8', { rough: 0.9 })), 0, h + 0.02, 0);
  if (balcony) { put(g, box(w * 0.5, 0.1, 0.8, mat('#2a2a2e', { metal: 0.6 })), 0, h * 0.45, d / 2 + 0.4); put(g, box(w * 0.5, 0.5, 0.04, mat('#2a2a2e', { metal: 0.6 })), 0, h * 0.45 + 0.3, d / 2 + 0.8); }
  g.position.set(x, 0, z); g.rotation.y = ry;
  return g;
}

function bunting(x0, x1, y, z, colors, n = 14) {
  const g = new THREE.Group();
  const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([lerp(x0, x1, t), y - Math.sin(t * Math.PI) * 0.9, z]); }
  g.add(tube(pts, 0.012, mat('#3a3030', { rough: 1 }), 30, 4));
  const flags = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = lerp(x0, x1, t), yy = y - Math.sin(t * Math.PI) * 0.9;
    const m = clothPlane(0.34, 0.42, mat(colors[i % colors.length], { rough: 0.9, side: 1 }), { sx: 2, sy: 3 });
    m.position.set(x, yy, z); g.add(m); flags.push({ m, i });
  }
  g.userData.update = (t) => flags.forEach((f) => f.m.userData.sway(t, 0.06, f.i * 0.9, 2.6));
  return g;
}
const lerp = (a, b, t) => a + (b - a) * t;

function lampPost(x, z, hgt = 3.4, glow = '#ffcf8a') {
  const g = new THREE.Group(), iron = mat('#26262a', { metal: 0.85, rough: 0.4 });
  put(g, cyl(0.1, 0.15, 0.3, iron, 10), 0, 0.15, 0); put(g, cyl(0.045, 0.06, hgt, iron, 10), 0, hgt / 2, 0);
  put(g, rbox(0.34, 0.44, 0.34, 0.05, mat('#fff1c4', { emissive: glow, ei: 1.8, rough: 0.4 })), 0, hgt + 0.22, 0);
  put(g, cyl(0.0, 0.3, 0.18, iron, 4), 0, hgt + 0.56, 0);
  const l = new THREE.PointLight(glow, 0, 9, 2); l.position.set(0, hgt + 0.1, 0.3); g.add(l);
  g.position.set(x, 0, z); g.userData.light = l;
  return g;
}

function paperLantern(x, y, z, col = '#ff8a5a') {
  const g = new THREE.Group();
  put(g, new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), mat('#ffe6c0', { emissive: col, ei: 1.5, rough: 0.7 })), 0, 0, 0).scale.set(0.9, 1.15, 0.9);
  put(g, cyl(0.1, 0.1, 0.04, mat('#2a1a10'), 10), 0, 0.27, 0); put(g, cyl(0.1, 0.1, 0.04, mat('#2a1a10'), 10), 0, -0.27, 0);
  g.position.set(x, y, z);
  return g;
}

// the counting tree: a trunk with a flare and a crown (palm for the kampung)
function homeTree(kind) {
  const g = new THREE.Group();
  if (kind === 'palm') {
    const bark = mat('#7a6246', { rough: 0.95 });
    const pts = [[0, 0, 0], [0.1, 1.6, 0.0], [0.05, 3.2, 0.0], [-0.15, 4.6, 0.05]];
    put(g, tube(pts, 0.17, bark, 24, 8), 0, 0, 0);
    for (let k = 0; k < 14; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.18 - k * 0.004, 0.02, 5, 12), mat('#5a4630', { rough: 1 })); r.rotation.x = Math.PI / 2; r.position.set(0.1 * Math.sin(k * 0.3), 0.3 + k * 0.3, 0); g.add(r); }
    const crown = new THREE.Group(); crown.position.set(-0.15, 4.6, 0.05); g.add(crown);
    const fm = new THREE.MeshStandardMaterial({ color: '#3f8a34', roughness: 0.75, side: THREE.DoubleSide });
    const fronds = [];
    const fgeo = (() => {
      const nx = 10, pos = [], idx = [];
      for (let i = 0; i <= nx; i++) {
        const u = i / nx, x = u * 2.9, y = 0.55 * Math.sin(u * 2.2) - 0.85 * u * u, w = 0.5 * Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.08)) * (1 - 0.5 * u);
        pos.push(x, y, -w, x, y + 0.03, 0, x, y, w);
      }
      for (let i = 0; i < nx; i++) { const a0 = i * 3, a1 = (i + 1) * 3; idx.push(a0, a1, a0 + 1, a0 + 1, a1, a1 + 1, a0 + 1, a1 + 1, a0 + 2, a0 + 2, a1 + 1, a1 + 2); }
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals(); return gg;
    })();
    for (let i = 0; i < 10; i++) {
      const piv = new THREE.Group(); piv.rotation.y = (i / 10) * TAU + (i % 2) * 0.2;
      const m = new THREE.Mesh(fgeo, fm); m.rotation.z = 0.25 + (i % 3) * 0.12; m.castShadow = true; m.scale.setScalar(0.9 + (i % 3) * 0.1); piv.add(m); crown.add(piv); fronds.push({ m, b: m.rotation.z, i });
    }
    for (let i = 0; i < 4; i++) put(crown, sph(0.13, mat('#6a8a2a', { rough: 0.6 })), 0.18 * Math.cos(i * 1.6), -0.15, 0.18 * Math.sin(i * 1.6));
    g.userData.update = (t) => { crown.rotation.z = Math.sin(t * 0.8) * 0.02; fronds.forEach((f) => { f.m.rotation.z = f.b + Math.sin(t * 1.3 + f.i) * 0.05; }); };
    return g;
  }
  const bark = darkWood('#4a3828', '#6a5238', { seed: 91 });
  put(g, lathe([[0, 0], [0.5, 0], [0.4, 0.22], [0.27, 0.6], [0.24, 1.6], [0.28, 2.1], [0, 2.2]], bark, 16), 0, 0, 0);
  put(g, tube([[0, 1.8, 0], [-0.4, 2.4, 0.1], [-0.8, 2.9, 0.1]], 0.1, bark, 10, 6), 0, 0, 0);
  put(g, tube([[0, 1.9, 0], [0.4, 2.5, -0.1], [0.8, 3.0, 0]], 0.09, bark, 10, 6), 0, 0, 0);
  const crownCols = kind === 'plane' ? ['#3a6a2a', '#8cb24a'] : ['#5a7a2a', '#d8a83a'];
  const crown = new THREE.Group(); crown.position.set(0, 3.0, 0); g.add(crown);
  rngSeed(44);
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.62 + rnd() * 0.4, 12, 9), new THREE.MeshStandardMaterial({ color: new THREE.Color(crownCols[0]).lerp(new THREE.Color(crownCols[1]), rnd()), roughness: 0.9, flatShading: true }));
    m.position.set((rnd() - 0.5) * 2.2, rnd() * 1.0, (rnd() - 0.5) * 1.6); m.castShadow = true; crown.add(m);
  }
  g.userData.update = (t) => { crown.rotation.z = Math.sin(t * 0.7) * 0.012; };
  return g;
}

// the counting post: where the seeker stands with eyes covered (a thin lamp post or a timber pillar: it never hides a spot)
function homePost(kind) {
  const g = new THREE.Group();
  if (kind === 'lamp') {
    const iron = mat('#26262a', { metal: 0.85, rough: 0.4 });
    put(g, cyl(0.2, 0.26, 0.4, stoneM('#8c8578', '#b9b2a2', { seed: 2 }), 12), 0, 0.2, 0);
    put(g, cyl(0.07, 0.1, 3.0, iron, 10), 0, 1.9, 0);
    put(g, rbox(0.42, 0.52, 0.42, 0.06, mat('#fff1c4', { emissive: '#ffbf6a', ei: 1.8, rough: 0.4 })), 0, 3.5, 0);
    put(g, cyl(0.0, 0.36, 0.22, iron, 4), 0, 3.88, 0);
    // a bench beside it
    put(g, rbox(1.3, 0.08, 0.4, 0.02, wood('#8a5a34', '#b07a48')), 0.2, 0.5, 0.9);
    for (const x of [-0.4, 0.8]) put(g, box(0.07, 0.5, 0.36, mat('#26262a', { metal: 0.7 })), x, 0.25, 0.9);
    return g;
  }
  const dk = darkWood('#3a2412', '#563620', { seed: 33 });
  put(g, cyl(0.2, 0.22, 2.9, dk, 10), 0, 1.45, 0);
  put(g, stoneM('#8c8578', '#b9b2a2') && cyl(0.3, 0.34, 0.3, stoneM('#8c8578', '#b9b2a2', { seed: 6 }), 12), 0, 0.15, 0);
  put(g, box(0.9, 0.16, 0.26, dk), 0, 2.7, 0);
  put(g, new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), mat('#ffe6c0', { emissive: '#ff8a4a', ei: 1.4, rough: 0.7 })), 0.0, 2.3, 0.3).scale.set(0.9, 1.15, 0.9);
  return g;
}

// ---- piazza at dusk --------------------------------------------------------------------------------------------------------
function piazza(S) {
  const g = new THREE.Group(), tick = [];
  g.add(groundPatch(40, 26, (c, W, H) => {
    c.fillStyle = '#7d6c56'; c.fillRect(0, 0, W, H);
    rngSeed(3);
    const n = 20, s = W / n;
    const pal = ['#c4ad8c', '#b49c7c', '#cdb896', '#a78f70', '#bba386', '#9c8468'];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const o = (j % 2) * s * 0.5, jx = (rnd() - 0.5) * 3, jy = (rnd() - 0.5) * 3, col = pal[Math.floor(rnd() * pal.length)], rr = 6 + rnd() * 4;
      for (const dx of [-W, 0]) {
        c.fillStyle = col;
        c.beginPath(); c.roundRect(i * s + o + 2 + jx + dx, j * s + 2 + jy, s - 4, s - 4, rr); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(i * s + o + 6 + jx + dx, j * s + 4 + jy, s - 14, 3);
        c.fillStyle = 'rgba(0,0,0,0.08)'; c.fillRect(i * s + o + 6 + jx + dx, j * s + s - 7 + jy, s - 14, 3);
      }
    }
    noiseSpecks(c, W, H, 3000, ['rgba(60,40,30,0.22)', 'rgba(255,240,220,0.16)', 'rgba(90,110,50,0.18)'], 3);
  }, [5, 3.4], 0.01));
  // a pale paved ring near the fountain row and a worn path
  // buildings: a continuous row behind, side walls
  const cols = ['#d9a97c', '#c58a63', '#e3c497', '#b97f6a', '#d7b585'];
  let x = -26, i = 0;
  while (x < 26) {
    const w = 5.5 + (i % 3) * 1.1, h = 6.5 + ((i * 7) % 4) * 1.1;
    g.add(building({ w, h, d: 5, x: x + w / 2, z: -17 - ((i % 2) * 0.8), plaster: cols[i % cols.length], roof: i % 2 ? '#8e4a3c' : '#a35a42', windows: 3, floors: Math.round(h / 3.2), lit: 0.6, seed: i + 1, door: i % 3 === 0, balcony: i % 4 === 1 }));
    x += w + 0.1; i++;
  }
  for (const s of [-1, 1]) {
    let z = -8; let k = 0;
    while (z < 6) { const w = 5 + (k % 2); g.add(building({ w, h: 6 + (k % 3), d: 5, x: s * 18.5, z: z + w / 2 - 4, plaster: cols[(k + 2) % cols.length], roof: '#8e4a3c', windows: 3, floors: 2, lit: 0.55, seed: 40 + k, door: false, ry: s > 0 ? -Math.PI / 2 : Math.PI / 2 })); z += w + 0.1; k++; }
  }
  // bell tower
  const tower = new THREE.Group();
  put(tower, box(3.0, 14, 3.0, new THREE.MeshStandardMaterial({ color: '#c8a074', roughness: 0.95 })), 0, 7, 0);
  put(tower, box(3.4, 0.4, 3.4, mat('#d9cdb8')), 0, 14.2, 0);
  put(tower, box(1.4, 2.6, 1.4, mat('#2a1a14', { rough: 1 })), 0, 15.5, 0);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0, 2.4, 3.6, 4, 1), clayM('#7a3a2c', '#9a5238')); cone.rotation.y = Math.PI / 4; cone.position.y = 18.4; tower.add(cone);
  tower.position.set(12.5, 0, -20); g.add(tower);
  // lamp posts and bunting
  const lamps = [lampPost(-8.8, -4.2, 3.4), lampPost(8.6, -4.0, 3.4), lampPost(-7.0, 5.0, 3.1), lampPost(7.4, 5.2, 3.1)];
  lamps.forEach((l) => g.add(l));
  const b1 = bunting(-14, 14, 6.6, -6, ['#c8453a', '#2f6f8f', '#e5b94a', '#f3ead8']); g.add(b1); tick.push((t) => b1.userData.update(t));
  const b2 = bunting(-12, 12, 5.8, 2, ['#e5b94a', '#c8453a', '#4f8a3a', '#f3ead8'], 12); g.add(b2); tick.push((t) => b2.userData.update(t));
  // a few cafe tables at the edge for atmosphere
  for (const [tx, tz] of [[-10.5, 2.5], [10.2, 0.8]]) {
    put(g, cyl(0.45, 0.45, 0.04, mat('#f1ece0', { rough: 0.6 }), 16), tx, 0.78, tz); put(g, cyl(0.04, 0.04, 0.78, mat('#2a2a2e', { metal: 0.8 }), 8), tx, 0.39, tz);
    for (const a of [0.5, 2.4, 4.3]) put(g, rbox(0.4, 0.05, 0.4, 0.02, darkWood()), tx + Math.cos(a) * 0.8, 0.45, tz + Math.sin(a) * 0.8);
  }
  const home = homePost('lamp'); g.add(home);
  return { group: g, home, lamps, tick: (t, dt) => tick.forEach((f) => f(t, dt)), lanternsOn: (k) => lamps.forEach((l) => { l.userData.light.intensity = k * 8; }) };
}

// ---- kampung yard ----------------------------------------------------------------------------------------------------------
function kampung(S) {
  const g = new THREE.Group(), tick = [];
  g.add(groundPatch(40, 26, (c, W, H) => {
    c.fillStyle = '#c9a56e'; c.fillRect(0, 0, W, H);
    rngSeed(7);
    for (let i = 0; i < 160; i++) { const x = rnd() * W, y = rnd() * H, r = 12 + rnd() * 50; const gr = c.createRadialGradient(x, y, 1, x, y, r); const dk = rnd() < 0.5; gr.addColorStop(0, dk ? 'rgba(120,84,44,0.28)' : 'rgba(238,214,160,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); }
    noiseSpecks(c, W, H, 2400, ['rgba(90,64,34,0.35)', 'rgba(250,236,200,0.3)', 'rgba(110,130,60,0.3)'], 3);
    // sweep marks of a broom
    c.strokeStyle = 'rgba(120,90,50,0.18)'; c.lineWidth = 2;
    for (let k = 0; k < 40; k++) { c.beginPath(); const y = rnd() * H, x0 = rnd() * W; c.moveTo(x0, y); c.bezierCurveTo(x0 + 40, y + 12, x0 + 80, y - 12, x0 + 120, y + 6); c.stroke(); }
  }, [1, 1], 0.01));
  // grass fringe patches
  const grass = mat('#5a8a34', { rough: 1 });
  for (let i = 0; i < 34; i++) { rngSeed(i * 13 + 5); const side = i % 2 ? 1 : -1; const gx = side * (10 + rnd() * 8), gz = -9 + rnd() * 16; put(g, sph(0.6 + rnd() * 0.7, grass, 8, 6), gx, 0.05, gz).scale.set(1.4, 0.18, 1.0); }
  // stilt house at the back left, thatched
  const house = new THREE.Group();
  const w1 = wood('#a07a46', '#c8a064', { seed: 3, repeat: [3, 1] }), post = darkWood('#5a3a1e', '#7a5232');
  for (const [px, pz] of [[-2.4, -1.6], [2.4, -1.6], [-2.4, 1.6], [2.4, 1.6], [0, -1.6], [0, 1.6]]) put(house, box(0.2, 1.6, 0.2, post), px, 0.8, pz);
  put(house, box(5.4, 0.2, 3.8, w1), 0, 1.6, 0);
  put(house, box(5.0, 2.4, 3.4, mat('#c9aa6e', { rough: 0.95 })), 0, 2.9, 0);
  // woven wall texture lines
  for (let i = 1; i < 8; i++) put(house, box(5.02, 0.04, 3.42, mat('#8a6a3a', { rough: 1 })), 0, 1.8 + i * 0.3, 0);
  put(house, box(1.0, 1.7, 0.08, mat('#2a1a0e', { rough: 1 })), 0, 2.55, 1.72);
  const thatch = new THREE.Mesh(new THREE.CylinderGeometry(0, 1, 1, 4, 1), mat('#b58f4a', { rough: 1 })); thatch.rotation.y = Math.PI / 4; thatch.scale.set(4.6, 2.4, 3.4); thatch.position.y = 5.4; thatch.castShadow = true; house.add(thatch);
  // ladder
  for (const s of [-1, 1]) put(house, cyl(0.04, 0.04, 2.0, post, 6), 1.8 + s * 0.2, 0.8, 2.2).rotation.x = -0.45;
  house.position.set(-7.5, 0, -10); g.add(house);
  // a second hut at right, further away
  const hut2 = house.clone(); hut2.position.set(9.5, 0, -14); hut2.scale.setScalar(0.9); hut2.rotation.y = -0.4; g.add(hut2);
  // bamboo fence along the back
  const bam = mat('#b0a25a', { rough: 0.6 });
  for (let i = 0; i < 70; i++) { const x = -17 + i * 0.5; put(g, cyl(0.035, 0.035, 1.6 + (i % 3) * 0.1, bam, 6), x, 0.8, -7.0); }
  for (const y of [0.4, 1.0, 1.4]) { const b = put(g, cyl(0.03, 0.03, 36, bam, 6), 0, y, -6.95); b.rotation.z = Math.PI / 2; }
  // coconut palms
  const palms = [[-12.5, -4.5, 1.0], [13, -6, 1.15], [-15, 2, 0.9], [15.5, 3, 1.05]];
  palms.forEach(([px, pz, sc], i) => { const p = homeTree('palm'); p.position.set(px, 0, pz); p.scale.setScalar(sc); p.rotation.y = i; g.add(p); tick.push((t) => p.userData.update(t + i)); });
  // the counting palm (home)
  const home = homeTree('palm'); g.add(home); tick.push((t) => home.userData.update(t));
  // chickens, well and washing basin are skipped; a woven mat and some pots hint at life
  put(g, cyl(0.55, 0.55, 0.03, mat('#c4a050', { rough: 1 }), 18), 5.2, 0.02, 6.2);
  return { group: g, home, lamps: [], tick: (t, dt) => tick.forEach((f) => f(t, dt)), lanternsOn: () => {} };
}

// ---- town house garden at evening --------------------------------------------------------------------------------------------
function machiya(S) {
  const g = new THREE.Group(), tick = [];
  g.add(groundPatch(40, 26, (c, W, H) => {
    c.fillStyle = '#8a8374'; c.fillRect(0, 0, W, H);
    rngSeed(11);
    for (let i = 0; i < 1800; i++) { { const v = 96 + rnd() * 80 | 0; c.fillStyle = `rgba(${v},${v - 4},${v - 12},0.45)`; } const r = 2 + rnd() * 4; c.beginPath(); c.arc(rnd() * W, rnd() * H, r, 0, TAU); c.fill(); }
    // stone pavers in a staggered path
    for (let k = 0; k < 7; k++) { c.fillStyle = 'rgba(205,200,184,0.9)'; c.beginPath(); c.roundRect(W * 0.12 + k * W * 0.11, H * (0.42 + (k % 2) * 0.1), 62, 44, 12); c.fill(); }
  }, [1, 1], 0.01));
  // the town house across the back: dark timber frame, white plaster, glowing paper windows, tile roof with deep eaves
  const hw = 30, hh = 5.6, hd = 6, hz = -9.5;
  const tex = canvasTex(1024, 256, (c, W, H) => {
    c.fillStyle = '#e8dfc8'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#2a1a10';
    for (let i = 0; i <= 12; i++) c.fillRect(i * W / 12 - 4, 0, 8, H);
    c.fillRect(0, H * 0.46, W, 8); c.fillRect(0, 0, W, 8); c.fillRect(0, H - 8, W, 8);
    for (let i = 0; i < 12; i++) {
      const x = i * W / 12 + 14, ww = W / 12 - 28;
      // lower: lattice (koshi)
      c.fillStyle = 'rgba(60,40,22,0.95)'; c.fillRect(x, H * 0.52, ww, H * 0.42);
      c.fillStyle = 'rgba(255,190,110,0.55)'; c.fillRect(x + 4, H * 0.55, ww - 8, H * 0.36);
      c.fillStyle = 'rgba(40,24,12,0.95)'; for (let k = 1; k < 9; k++) c.fillRect(x + (ww / 9) * k, H * 0.52, 3, H * 0.42);
      // upper: shoji, some lit
      const on = (i * 7) % 5 < 3;
      c.fillStyle = on ? 'rgba(255,214,150,0.95)' : 'rgba(210,205,190,0.9)'; c.fillRect(x + 6, H * 0.1, ww - 12, H * 0.28);
      c.fillStyle = 'rgba(50,32,18,0.9)'; c.fillRect(x + ww / 2 - 1.5, H * 0.1, 3, H * 0.28); c.fillRect(x + 6, H * 0.24, ww - 12, 3);
    }
  }, { aniso: 8 });
  const wall = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), side = new THREE.MeshStandardMaterial({ color: '#d8cdb4', roughness: 1 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(hw, hh, hd), [side, side, side, side, wall, side]); body.position.set(0, hh / 2, hz); body.castShadow = true; body.receiveShadow = true; g.add(body);
  const tile = clayM('#3c3e4c', '#555868', { seed: 14, repeat: [12, 1] });
  const roofGeo = new THREE.BoxGeometry(hw + 3, 0.3, 4.4); const r1 = new THREE.Mesh(roofGeo, tile); r1.position.set(0, hh + 0.9, hz + 1.8); r1.rotation.x = 0.32; r1.castShadow = true; g.add(r1);
  const r2 = new THREE.Mesh(roofGeo, tile); r2.position.set(0, hh + 0.9, hz - 1.8); r2.rotation.x = -0.32; r2.castShadow = true; g.add(r2);
  put(g, box(hw + 3, 0.35, 0.5, tile), 0, hh + 1.7, hz);
  // eave over the lower floor
  const eave = new THREE.Mesh(new THREE.BoxGeometry(hw + 1.5, 0.18, 2.2), tile); eave.position.set(0, hh * 0.5 + 0.1, hz + hd / 2 + 0.9); eave.rotation.x = 0.1; eave.castShadow = true; g.add(eave);
  // side walls with a gate gap, low garden wall in front of the house
  const wl = mat('#d8cdb4', { rough: 1 }), cap = mat('#3c3e4c', { rough: 0.7 });
  for (const s of [-1, 1]) { put(g, box(10, 2.3, 0.3, wl), s * 14.5, 1.15, -4.5); put(g, box(10.4, 0.2, 0.5, cap), s * 14.5, 2.4, -4.5); }
  // paper lanterns hung along the eave, glowing
  const lants = [];
  for (let i = 0; i < 9; i++) { const l = paperLantern(-12 + i * 3, 2.9, hz + hd / 2 + 1.2, i % 3 === 0 ? '#ff6a4a' : '#ffae5a'); g.add(l); lants.push(l); }
  tick.push((t) => lants.forEach((l, i) => { l.rotation.z = Math.sin(t * 1.4 + i) * 0.05; }));
  const lamps = [lampPost(-8.4, -3.3, 2.6, '#ffb870'), lampPost(8.6, -3.2, 2.6, '#ffb870')];
  lamps.forEach((l) => g.add(l));
  const pl = new THREE.PointLight('#ffb070', 0, 14, 2); pl.position.set(0, 3, -5); g.add(pl);
  // the counting tree: a maple in autumn colours
  const home = homePost('pillar'); g.add(home);
  // far garden: a couple of pines and a stone basin
  put(g, lathe([[0, 0], [0.4, 0], [0.45, 0.35], [0.38, 0.38], [0.0, 0.3]], stoneM('#8c8578', '#b9b2a2', { seed: 7 }), 16), 10.5, 0, 3.5);
  put(g, cyl(0.04, 0.05, 0.6, mat('#a8864a', { rough: 0.7 }), 8), 10.1, 0.5, 3.5);
  return { group: g, home, lamps, tick: (t, dt) => tick.forEach((f) => f(t, dt)), lanternsOn: (k) => { lamps.forEach((l) => { l.userData.light.intensity = k * 6; }); pl.intensity = k * 12; } };
}

export const PLACE_BUILDERS = [piazza, kampung, machiya];
export const SCENERY = [
  { layers: [{ t: 'sky', id: 'sky-day' }, { t: 'backdrop', id: 'bd-mediterranean', mix: ['bd-canal'] }, { t: 'ground', id: 'gr-cobble', size: 120, repeat: 40, grade: 'warm' }], tod: 'dusk', culture: 'mediterranean' },
  { layers: [{ t: 'sky', id: 'sky-day' }, { t: 'backdrop', id: 'bd-rice' }, { t: 'ground', id: 'gr-paddy', size: 160, repeat: 26 }, { t: 'band', id: 'band-fields', r: 60, h: 10, arc: [-170, -10] },
    { t: 'cutouts', id: 'tr-broad-tree', count: 5, r: [30, 50], scale: [6, 9], seed: 13, sway: 0.8, arc: [-155, -25] }], tod: 'day' },
  { layers: [{ t: 'sky', id: 'sky-peach' }, { t: 'backdrop', id: 'bd-sakura' }, { t: 'ground', id: 'gr-cobble', size: 120, repeat: 40, grade: 'cool' },
    { t: 'cutouts', id: 'tr-broad-tree', count: 3, r: [28, 40], scale: [7, 10], seed: 12, sway: 0.5, arc: [-155, -25] }], tod: 'dusk' },
];

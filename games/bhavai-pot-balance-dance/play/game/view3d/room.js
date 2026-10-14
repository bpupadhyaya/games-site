// The courtyard of a Rajasthani haveli at dusk (and its dunes, lake terrace and fort variants): everything is procedural (canvas textures,
// extruded arches, instanced props), lit with a dusk key + rim + torch lights. Presentation only: setAct() retints it for each act and
// update() flickers lamps on the beat; nothing here is read back by the game.
import { THREE, board3d as B } from '../vendor3d/index.js';

const T = THREE;
const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function cv(w, h = w) { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function tex(canvas, { repeat, srgb = true, aniso = 8 } = {}) {
  const t = new T.CanvasTexture(canvas);
  if (srgb) t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const col = (c) => new T.Color(c);
const cone = (r, h, seg) => new T.CylinderGeometry(0.0001, r, h, seg);

// ---- textures --------------------------------------------------------------------------------------------------------------------------
// Sandstone flagstones with grout, soft colour drift and chips; one tile of the canvas is 3 m x 3 m (2 x 2 slabs).
function flagstoneTexture() {
  const S = 1024, c = cv(S), g = c.getContext('2d'), r = rng(31), b = cv(S), bg = b.getContext('2d');
  g.fillStyle = '#9a7a58'; g.fillRect(0, 0, S, S); bg.fillStyle = '#9a9a9a'; bg.fillRect(0, 0, S, S);
  const n = 2, w = S / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i * w, y = j * w, k = 0.9 + r() * 0.2;
    const gr = g.createLinearGradient(x, y, x + w, y + w);
    gr.addColorStop(0, `rgb(${Math.round(196 * k)},${Math.round(150 * k)},${Math.round(104 * k)})`); gr.addColorStop(1, `rgb(${Math.round(176 * k)},${Math.round(130 * k)},${Math.round(90 * k)})`);
    g.fillStyle = gr; g.fillRect(x + 3, y + 3, w - 6, w - 6);
    for (let q = 0; q < 2600; q++) { g.fillStyle = r() < 0.5 ? 'rgba(255,235,200,0.07)' : 'rgba(70,40,15,0.09)'; g.fillRect(x + r() * w, y + r() * w, 1 + r() * 3, 1 + r() * 3); }
    for (let q = 0; q < 5; q++) { g.strokeStyle = 'rgba(70,40,18,0.18)'; g.lineWidth = 1; g.beginPath(); let px = x + r() * w, py = y + r() * w; g.moveTo(px, py); for (let s = 0; s < 6; s++) { px += (r() - 0.5) * 60; py += (r() - 0.5) * 60; g.lineTo(px, py); } g.stroke(); }
  }
  g.fillStyle = 'rgba(54,34,18,0.85)';
  for (let i = 0; i <= n; i++) { g.fillRect(i * w - 3, 0, 6, S); g.fillRect(0, i * w - 3, S, 6); }
  bg.fillStyle = '#404040'; for (let i = 0; i <= n; i++) { bg.fillRect(i * w - 4, 0, 8, S); bg.fillRect(0, i * w - 4, S, 8); }
  return { map: tex(c, { repeat: [1, 1] }), bump: tex(b, { srgb: false, repeat: [1, 1] }) };
}

// A rangoli, drawn in light powder on the stone: concentric petal rings, a lotus at the centre and a dotted border.
function rangoliTexture(palette) {
  const S = 1024, c = cv(S), g = c.getContext('2d'), r = rng(77), m = S / 2;
  g.clearRect(0, 0, S, S);
  const dot = (x, y, rad, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); };
  const ring = (R, n, rad, cols) => { for (let i = 0; i < n; i++) { const a = (i / n) * TAU; dot(m + Math.cos(a) * R, m + Math.sin(a) * R, rad, cols[i % cols.length]); } };
  const petals = (R, n, len, wid, fill, stroke) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU; g.save(); g.translate(m, m); g.rotate(a);
      g.beginPath(); g.moveTo(R, 0); g.quadraticCurveTo(R + len * 0.5, -wid, R + len, 0); g.quadraticCurveTo(R + len * 0.5, wid, R, 0); g.closePath();
      g.fillStyle = fill; g.fill(); g.lineWidth = 3; g.strokeStyle = stroke; g.stroke(); g.restore();
    }
  };
  const [c1, c2, c3, c4] = palette;
  g.globalAlpha = 0.92;
  g.lineWidth = 6; g.strokeStyle = 'rgba(255,248,235,0.9)';
  for (const R of [m * 0.96, m * 0.88, m * 0.62, m * 0.34]) { g.beginPath(); g.arc(m, m, R, 0, TAU); g.stroke(); }
  ring(m * 0.92, 72, 5, ['#fff6e6', c1]);
  petals(m * 0.62, 24, m * 0.24, m * 0.075, c1, '#fff6e6');
  petals(m * 0.34, 16, m * 0.2, m * 0.07, c2, '#fff6e6');
  petals(m * 0.04, 12, m * 0.22, m * 0.08, c3, '#fff6e6');
  ring(m * 0.76, 48, 8, [c4, c1, c3]);
  ring(m * 0.5, 32, 6, ['#fff6e6', c2]);
  g.globalAlpha = 1;
  dot(m, m, m * 0.06, c4); dot(m, m, m * 0.03, '#fff6e6');
  // fine powder grain
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.25})`; g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
  g.globalCompositeOperation = 'source-over';
  return tex(c, { aniso: 8 });
}

function plasterTexture(base, trim) {
  const S = 512, c = cv(S), g = c.getContext('2d'), r = rng(5), b = cv(S), bg = b.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, S, S); bg.fillStyle = '#808080'; bg.fillRect(0, 0, S, S);
  for (let i = 0; i < 700; i++) { const x = r() * S, y = r() * S, rr = 6 + r() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, r() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  for (let i = 0; i < 6000; i++) { bg.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'; bg.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
  void trim;
  return { map: tex(c, { repeat: [1, 1] }), bump: tex(b, { srgb: false, repeat: [1, 1] }) };
}

function skyTexture(stops) {
  const c = cv(8, 256), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), s));
  g.fillStyle = gr; g.fillRect(0, 0, 8, 256);
  return tex(c, { aniso: 1 });
}

function frescoTexture(wall, trim) {
  const W = 256, H = 512, c = cv(W, H), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#201436'); gr.addColorStop(0.55, '#3a2150'); gr.addColorStop(1, '#5a2a44');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // painted dado and a niche arch with a warm lit doorway
  g.fillStyle = 'rgba(255,200,120,0.10)';
  for (let i = 0; i < 6; i++) g.fillRect(i * 44 + 6, 40, 3, H - 120);
  g.fillStyle = 'rgba(255,170,80,0.20)'; g.beginPath(); g.moveTo(70, H - 40); g.lineTo(70, 250); g.quadraticCurveTo(70, 160, 128, 140); g.quadraticCurveTo(186, 160, 186, 250); g.lineTo(186, H - 40); g.closePath(); g.fill();
  g.strokeStyle = trim; g.lineWidth = 4; g.stroke();
  const lg = g.createLinearGradient(0, 160, 0, H); lg.addColorStop(0, 'rgba(255,210,130,0.0)'); lg.addColorStop(1, 'rgba(255,190,100,0.42)');
  g.fillStyle = lg; g.fillRect(70, 160, 116, H - 200);
  // a row of tiny lamps along the shelf
  for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(255,214,130,0.9)'; g.beginPath(); g.arc(24 + i * 34, 118, 3, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,170,60,0.25)'; g.beginPath(); g.arc(24 + i * 34, 118, 9, 0, TAU); g.fill(); }
  g.fillStyle = wall; g.globalAlpha = 0.10; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  return tex(c, { aniso: 4 });
}

// ---- geometry helpers -------------------------------------------------------------------------------------------------------------
// A pointed, cusped arch outline (Mughal / Rajput): width w, spring height hs, rise hr; returns an array of [x, y] points, left foot to right foot.
function archPoints(w, hs, hr, n = 40) {
  const pts = [], hw = w / 2;
  pts.push([-hw, 0], [-hw, hs]);
  // cusped multifoil: five lobes along a pointed ogee
  const lobes = 5;
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = Math.PI * u;                        // 0..PI over the arch
    const x = -hw * Math.cos(a), base = Math.sin(a);
    const ogee = Math.pow(base, 0.78);
    const cusp = 1 - 0.035 * Math.abs(Math.sin(u * lobes * Math.PI));
    pts.push([x, hs + hr * ogee * cusp]);
  }
  pts.push([hw, hs], [hw, 0]);
  return pts;
}
const archShape = (w, hs, hr) => { const s = new T.Shape(); archPoints(w, hs, hr).forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s; };

// ---- the room -------------------------------------------------------------------------------------------------------------------------
export function buildRoom({ quality = 'medium' } = {}) {
  const scene = new T.Scene();
  const R = { scene, quality, flames: [], torches: [], bulbs: [], diyas: [], windows: [], variants: {}, t: 0 };
  const hi = quality !== 'low';

  // lights: key (sun low, warm), cool fill, rim from behind, hemisphere
  const rig = B.lightingRig(scene, 'duskOutdoor', { shadow: quality === 'high' ? 2048 : quality === 'medium' ? 1024 : 0, extent: 5.2, fog: false, target: [0, 1.4, 0] });
  R.rig = rig;
  rig.key.shadow.camera.far = 30; rig.key.shadow.camera.top = 7.5; rig.key.shadow.camera.bottom = -2.5; rig.key.shadow.bias = -0.0006;
  R.key = rig.key;

  // sky: a tall gradient card far behind, plus stars and a moon
  const sky = new T.Mesh(new T.PlaneGeometry(160, 90), new T.MeshBasicMaterial({ map: skyTexture(['#2a2a5a', '#7a4a7a', '#e8845a', '#ffc27a']), fog: false, depthWrite: false }));
  sky.position.set(0, 20, -60); sky.renderOrder = -10; scene.add(sky); R.sky = sky;
  const starGeo = new T.BufferGeometry(), sp = [], r0 = rng(4);
  for (let i = 0; i < 160; i++) sp.push((r0() - 0.5) * 90, 8 + r0() * 30, -55 + r0() * 2);
  starGeo.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
  R.stars = new T.Points(starGeo, new T.PointsMaterial({ color: 0xffffff, size: 0.28, transparent: true, opacity: 0.0, depthWrite: false, fog: false }));
  scene.add(R.stars);
  const moon = new T.Mesh(new T.CircleGeometry(2.2, 40), new T.MeshBasicMaterial({ color: 0xfff1d0, fog: false, transparent: true, opacity: 0 }));
  moon.position.set(11, 20, -54); scene.add(moon); R.moon = moon;
  const moonGlow = new T.Mesh(new T.CircleGeometry(7, 40), new T.MeshBasicMaterial({ map: glowTexture('255,235,190'), fog: false, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
  moonGlow.position.copy(moon.position); moonGlow.position.z -= 0.1; scene.add(moonGlow); R.moonGlow = moonGlow;

  // floor: flagstones + rangoli
  const fs = flagstoneTexture();
  fs.map.repeat.set(10, 7); fs.bump.repeat.set(10, 7);
  const floorMat = new T.MeshStandardMaterial({ map: fs.map, bumpMap: fs.bump, bumpScale: 1.4, roughness: 0.82, metalness: 0, envMapIntensity: 0.6 });
  const floor = new T.Mesh(new T.PlaneGeometry(30, 21), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 3.0); floor.receiveShadow = true; scene.add(floor); R.floor = floor; R.floorMat = floorMat;
  R.rangoliMat = new T.MeshBasicMaterial({ map: rangoliTexture(['#e8421a', '#ffb52e', '#d81b60', '#2aa6a0']), transparent: true, depthWrite: false, opacity: 0.88 });
  const rang = new T.Mesh(new T.PlaneGeometry(6.6, 6.6), R.rangoliMat);
  rang.rotation.x = -Math.PI / 2; rang.position.set(0, 0.006, 0.0); rang.renderOrder = 1; scene.add(rang); R.rangoli = rang;
  // a shallow stage plinth in front of the arcade
  const plinth = new T.Mesh(B.slab(20, 2.2, 0.28, 0.06, 0.04), B.material('stone', { color: '#caa77a', color2: '#e0c298', repeat: [6, 1], size: 512 }));
  plinth.position.set(0, 0, -3.9); plinth.castShadow = false; plinth.receiveShadow = true; scene.add(plinth);

  // ---- the haveli: back wall with five cusped bays ------------------------------------------------------------------------------
  const haveli = new T.Group(); scene.add(haveli); R.variants.haveli = haveli;
  const pl = plasterTexture('#e6d3b0');
  const wallMat = new T.MeshStandardMaterial({ map: pl.map, bumpMap: pl.bump, bumpScale: 1.2, roughness: 0.9, color: col('#2b6fb0') });
  R.wallMat = wallMat;
  pl.map.repeat.set(0.25, 0.25); pl.bump.repeat.set(0.25, 0.25);
  const BAYS = 7, BW = 3.3, WALL_Z = -5.2, WALL_H = 7.2;
  const x0 = -(BAYS - 1) * BW / 2;
  const wall = new T.Group(); haveli.add(wall);
  const frescoMat = new T.MeshBasicMaterial({ map: frescoTexture('#2b6fb0', '#ffd27a'), fog: true });
  const recessMat = new T.MeshStandardMaterial({ color: 0x20122a, roughness: 1 });
  for (let i = 0; i < BAYS; i++) {
    const cx = x0 + i * BW;
    const outer = new T.Shape(); outer.moveTo(cx - BW / 2, 0); outer.lineTo(cx + BW / 2, 0); outer.lineTo(cx + BW / 2, WALL_H); outer.lineTo(cx - BW / 2, WALL_H); outer.closePath();
    const hole = new T.Path();
    archPoints(2.15, 2.5, 1.5).forEach(([x, y], k) => (k ? hole.lineTo(cx + x, 0.25 + y) : hole.moveTo(cx + x, 0.25 + y))); hole.closePath();
    outer.holes.push(hole);
    const geo = new T.ExtrudeGeometry(outer, { depth: 0.55, bevelEnabled: false, curveSegments: 6 });
    const m = new T.Mesh(geo, wallMat); m.position.z = WALL_Z; m.receiveShadow = hi; m.castShadow = false; wall.add(m);
    // the room behind the arch: a dark recess with a painted back wall and a lit lamp
    const back = new T.Mesh(new T.PlaneGeometry(BW, 6.6), frescoMat); back.position.set(cx, 2.8, WALL_Z - 0.9); wall.add(back);
    const side = new T.Mesh(new T.PlaneGeometry(0.9, 4.2), recessMat); side.position.set(cx - 1.08, 2.4, WALL_Z - 0.45); side.rotation.y = Math.PI / 2; wall.add(side);
    const side2 = side.clone(); side2.position.x = cx + 1.08; side2.rotation.y = -Math.PI / 2; wall.add(side2);
    // gilded arch trim
    const trimPts = archPoints(2.15, 2.5, 1.5).map(([x, y]) => new T.Vector3(cx + x, 0.25 + y, WALL_Z + 0.58));
    const trim = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(trimPts.slice(1, -1)), 80, 0.045, 6, false), B.material('brass', { envIntensity: 1.4 }));
    wall.add(trim);
    // hanging lamp inside the arch
    const lamp = new T.Mesh(new T.SphereGeometry(0.15, 16, 12), new T.MeshBasicMaterial({ color: 0xffd9a0, fog: false }));
    lamp.position.set(cx, 3.15, WALL_Z + 0.2); wall.add(lamp); R.windows.push(lamp);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: glowTexture('255,190,100'), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.9 }));
    halo.scale.set(0.9, 0.9, 1); halo.position.copy(lamp.position); halo.position.z += 0.05; wall.add(halo); R.flames.push({ s: halo, base: 0.9, ph: i * 1.7 });
    // piers: carved pilasters between bays
    if (i < BAYS - 1) {
      const pil = new T.Mesh(new T.CylinderGeometry(0.11, 0.14, 4.2, 10), B.material('stone', { color: '#d8b98a', color2: '#ecd2a6', repeat: [1, 3], size: 256 }));
      pil.position.set(cx + BW / 2, 2.4, WALL_Z + 0.75); pil.castShadow = hi; wall.add(pil);
    }
  }
  // a painted frieze band and the scalloped parapet
  const band = new T.Mesh(new T.PlaneGeometry(BAYS * BW + 4, 0.42), new T.MeshBasicMaterial({ map: bandTexture(), fog: true }));
  band.position.set(0, 4.95, WALL_Z + 0.57); wall.add(band);
  const mer = new T.InstancedMesh(cone(0.22, 0.62, 4), new T.MeshStandardMaterial({ color: 0xe8d8b8, roughness: 0.9 }), 40);
  const mm = new T.Matrix4();
  for (let i = 0; i < 40; i++) { mm.compose(new T.Vector3(-(40 - 1) * 0.58 + i * 1.16, WALL_H + 0.28, WALL_Z + 0.25), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI / 4), new T.Vector3(1, 1, 1)); mer.setMatrixAt(i, mm); }
  wall.add(mer);
  // two jharokhas (carved bay windows) over the piers either side of the centre, each with a small dome
  for (const sx of [-1, 1]) {
    const jx = sx * BW * 1.5 + 0, g = new T.Group();
    const box = new T.Mesh(B.roundedBox(1.7, 1.3, 0.9, 0.08), new T.MeshStandardMaterial({ color: 0xcaa070, roughness: 0.8 }));
    box.position.set(0, 0, 0); g.add(box);
    const win = new T.Mesh(new T.ShapeGeometry(archShape(0.9, 0.35, 0.4)), new T.MeshBasicMaterial({ color: 0xffc57a }));
    win.position.set(0, -0.5, 0.46); g.add(win);
    const dome = new T.Mesh(new T.SphereGeometry(0.78, 24, 14, 0, TAU, 0, Math.PI / 2), B.material('brass', { color: '#d9a64a', color2: '#f3d27a', envIntensity: 1.2 }));
    dome.position.set(0, 0.72, 0); dome.scale.set(1, 0.85, 0.6); g.add(dome);
    const fin = new T.Mesh(cone(0.05, 0.28, 8), B.material('brass')); fin.position.set(0, 1.45, 0); g.add(fin);
    for (const px of [-0.75, 0.75]) { const c = new T.Mesh(new T.CylinderGeometry(0.06, 0.07, 0.7, 8), B.material('stone', { color: '#d8b98a', size: 128 })); c.position.set(px, 0.85 - 0.5, 0.35); g.add(c); }
    g.position.set(jx, 5.9, WALL_Z + 0.95); wall.add(g);
  }
  // string lights across the courtyard (they pulse on the beat)
  const bulbGeo = new T.SphereGeometry(0.07, 8, 6), cols = [0xffb52e, 0xff6f9c, 0x27c4c0, 0xffe08a];
  for (let line = 0; line < 3; line++) {
    const z = -3.2 + line * 0.0, y0 = 4.8 - line * 0.55, n = 26;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), x = lerp(-7.6, 7.6, u), y = y0 - 0.9 * Math.sin(Math.PI * u) - line * 0.1;
      const b = new T.Mesh(bulbGeo, new T.MeshBasicMaterial({ color: cols[(i + line) % 4], fog: false }));
      b.position.set(x, y, z - line * 0.35); scene.add(b);
      const hs = new T.Sprite(new T.SpriteMaterial({ map: glowTexture('255,200,120'), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.55, color: cols[(i + line) % 4] }));
      hs.scale.set(0.5, 0.5, 1); hs.position.copy(b.position); scene.add(hs);
      R.bulbs.push({ b, hs, i, line });
    }
    const wire = new T.Line(new T.BufferGeometry().setFromPoints(Array.from({ length: 30 }, (_, i) => { const u = i / 29; return new T.Vector3(lerp(-7.6, 7.6, u), y0 - 0.9 * Math.sin(Math.PI * u) - line * 0.1, z - line * 0.35); })), new T.LineBasicMaterial({ color: 0x2a1a10 }));
    scene.add(wire);
  }

  // ---- dunes (act 3): long soft ridges fading into haze, a low sun, a camel train and a lone khejri tree ---------------------------------
  const dunes = new T.Group(); scene.add(dunes); R.variants.dunes = dunes;
  const duneCols = ['#b8763a', '#c98a48', '#d9a05a', '#e8b878', '#f0c892'];
  for (let k = 0; k < 5; k++) {
    const shape = new T.Shape(); shape.moveTo(-60, -2);
    for (let i = 0; i <= 60; i++) { const x = -60 + i * 2; shape.lineTo(x, 1.4 + k * 1.6 + 1.7 * Math.sin(x * 0.09 + k * 1.9) + 0.8 * Math.sin(x * 0.23 + k * 0.7)); }
    shape.lineTo(60, -2); shape.closePath();
    const m = new T.Mesh(new T.ShapeGeometry(shape), new T.MeshBasicMaterial({ color: duneCols[k] }));
    m.position.set(0, -0.2, -8.5 - k * 7); dunes.add(m);
  }
  const sun = new T.Mesh(new T.CircleGeometry(3.4, 48), new T.MeshBasicMaterial({ color: 0xfff0c0, fog: false }));
  sun.position.set(-7, 9, -48); dunes.add(sun);
  const sunGlow = new T.Mesh(new T.CircleGeometry(16, 48), new T.MeshBasicMaterial({ map: glowTexture('255,210,140'), transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
  sunGlow.position.set(-7, 9, -47.5); dunes.add(sunGlow);
  {   // camel train on the second ridge: silhouettes from boxes and cylinders
    const camMat = new T.MeshBasicMaterial({ color: 0x4a2a18 });
    for (let c = 0; c < 4; c++) {
      const g = new T.Group();
      const body = new T.Mesh(new T.CapsuleGeometry(0.28, 0.9, 4, 8), camMat); body.rotation.z = Math.PI / 2; body.position.y = 1.3; g.add(body);
      const hump = new T.Mesh(new T.SphereGeometry(0.28, 8, 6), camMat); hump.position.set(0.0, 1.7, 0); g.add(hump);
      const neck = new T.Mesh(new T.CylinderGeometry(0.1, 0.14, 0.9, 6), camMat); neck.position.set(0.7, 1.75, 0); neck.rotation.z = -0.5; g.add(neck);
      const head = new T.Mesh(new T.SphereGeometry(0.15, 8, 6), camMat); head.position.set(1.0, 2.15, 0); head.scale.set(1.4, 0.8, 0.8); g.add(head);
      for (const lx of [-0.5, -0.25, 0.4, 0.62]) { const l = new T.Mesh(new T.CylinderGeometry(0.06, 0.05, 1.2, 5), camMat); l.position.set(lx, 0.65, 0); g.add(l); }
      g.position.set(-14 + c * 3.2, 1.2, -22); g.scale.setScalar(1.4); dunes.add(g);
    }
    const trunk = new T.Mesh(new T.CylinderGeometry(0.12, 0.2, 3.2, 6), new T.MeshBasicMaterial({ color: 0x3a2412 })); trunk.position.set(12, 1.5, -15); dunes.add(trunk);
    const crown = new T.Mesh(new T.SphereGeometry(2.2, 10, 8), new T.MeshBasicMaterial({ color: 0x5a6a2a })); crown.position.set(12, 4.2, -15); crown.scale.set(1.4, 0.7, 1); dunes.add(crown);
  }
  // ---- lake (act 4): water behind a marble balustrade, a far palace on an island ------------------------------------------------------
  const lake = new T.Group(); scene.add(lake); R.variants.lake = lake;
  const water = new T.Mesh(new T.PlaneGeometry(90, 40), new T.MeshStandardMaterial({ color: 0x4a86b8, roughness: 0.08, metalness: 0.6, envMapIntensity: 1.6 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, -0.35, -26); lake.add(water); R.water = water;
  const poleMat0 = B.material('brass');
  const rail = new T.Group();
  const balMat = B.material('ivory', { size: 256 });
  for (let i = 0; i < 28; i++) { const b = new T.Mesh(B.lathe([[0.001, 0], [0.08, 0], [0.1, 0.1], [0.07, 0.2], [0.095, 0.38], [0.05, 0.62], [0.001, 0.62]], 10), balMat); b.position.set(-8.1 + i * 0.6, 0.0, -4.4); rail.add(b); }
  const cap = new T.Mesh(new T.BoxGeometry(17, 0.1, 0.28), balMat); cap.position.set(0, 0.67, -4.4); rail.add(cap);
  lake.add(rail);
  for (const sx of [-1, 1]) {
    const col = new T.Mesh(new T.CylinderGeometry(0.2, 0.24, 3.6, 16), balMat); col.position.set(sx * 3.7, 1.8, -4.4); col.castShadow = hi; lake.add(col);
    const col2 = col.clone(); col2.position.x = sx * 5.2; lake.add(col2);
    const roof = new T.Mesh(new T.BoxGeometry(2.0, 0.22, 1.0), balMat); roof.position.set(sx * 4.45, 3.7, -4.4); lake.add(roof);
    const dome = new T.Mesh(new T.SphereGeometry(0.85, 24, 12, 0, TAU, 0, Math.PI / 2), balMat); dome.position.set(sx * 4.45, 3.8, -4.4); dome.scale.set(1.2, 1, 0.7); lake.add(dome);
    const fin = new T.Mesh(cone(0.06, 0.4, 8), poleMat0); fin.position.set(sx * 4.45, 4.85, -4.4); lake.add(fin);
  }
  const palace = new T.Group();
  for (let i = 0; i < 7; i++) { const w = 3 + (i % 3), h = 2.2 + ((i * 7) % 5) * 0.5; const b = new T.Mesh(new T.BoxGeometry(w, h, 1.5), new T.MeshStandardMaterial({ color: i % 2 ? 0xe9dcc0 : 0xf3ead2, roughness: 1 })); b.position.set(-12 + i * 4, h / 2 - 0.3, 0); palace.add(b); const d = new T.Mesh(new T.SphereGeometry(w * 0.32, 16, 10, 0, TAU, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: 0xf6efdc, roughness: 0.9 })); d.position.set(-12 + i * 4, h - 0.3, 0); palace.add(d); }
  palace.position.set(0, 0, -34); lake.add(palace);
  // ---- fort (act 7): sandstone ramparts with crenellations and a gate ------------------------------------------------------------------
  const fort = new T.Group(); scene.add(fort); R.variants.fort = fort;
  const blk = (() => { const c = cv(512, 512), g = c.getContext('2d'), r = rng(8); g.fillStyle = '#d6a468'; g.fillRect(0, 0, 512, 512);
    for (let j = 0; j < 8; j++) for (let i = -1; i < 5; i++) { const x = i * 128 + (j % 2) * 64, y = j * 64, k = 0.88 + r() * 0.24; g.fillStyle = `rgb(${Math.round(214 * k)},${Math.round(164 * k)},${Math.round(104 * k)})`; g.fillRect(x + 3, y + 3, 122, 58); }
    for (let i = 0; i < 4000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,230,190,0.08)' : 'rgba(60,30,10,0.1)'; g.fillRect(r() * 512, r() * 512, 2, 2); }
    return tex(c, { repeat: [10, 1.6] }); })();
  const stoneM = new T.MeshStandardMaterial({ map: blk, bumpScale: 1.5, roughness: 0.95, color: col('#ffffff') });
  R.fortMat = stoneM;
  const ramp = new T.Mesh(new T.BoxGeometry(46, 6.4, 1.6), stoneM); ramp.position.set(0, 3.2, -5.4); fort.add(ramp);
  for (let i = 0; i < 38; i++) { const m = new T.Mesh(new T.BoxGeometry(0.7, 0.8, 0.9), stoneM); m.position.set(-22 + i * 1.18, 6.8, -5.4); fort.add(m); }
  for (const sx of [-1, 1]) { const tw = new T.Mesh(new T.CylinderGeometry(1.7, 1.9, 9, 14), stoneM); tw.position.set(sx * 8.4, 4.5, -5.8); fort.add(tw); const cp = new T.Mesh(cone(2.0, 1.5, 14), new T.MeshStandardMaterial({ color: 0xb0753a, roughness: 0.9 })); cp.position.set(sx * 8.4, 9.7, -5.8); fort.add(cp); }
  const gate = new T.Mesh(new T.ShapeGeometry(archShape(3.4, 3.2, 1.8)), new T.MeshBasicMaterial({ color: 0x1a0f1a })); gate.position.set(0, 0, -4.55); fort.add(gate);

  // ---- torches (brass poles with flames and warm point lights) and diyas -------------------------------------------------------------
  const poleMat = B.material('brass', { envIntensity: 1.4 });
  for (const sx of [-1, 1]) {
    const g = new T.Group();
    const pole = new T.Mesh(B.lathe([[0.001, 0], [0.16, 0], [0.16, 0.06], [0.05, 0.12], [0.035, 0.5], [0.04, 1.6], [0.1, 1.72], [0.11, 1.9], [0.001, 1.9]], 14), poleMat); pole.castShadow = hi; g.add(pole);
    const bowl = new T.Mesh(B.lathe([[0.001, 1.74], [0.11, 1.8], [0.17, 1.98], [0.15, 2.02], [0.001, 1.9]], 14), poleMat); g.add(bowl);
    const fl = flame(0.55); fl.group.position.y = 2.18; g.add(fl.group);
    const lt = new T.PointLight(0xffa24a, 2.2, 9, 1.6); lt.position.set(0, 2.2, 0.5); g.add(lt);
    g.position.set(sx * 2.55, 0, -1.6); scene.add(g);
    R.torches.push({ light: lt, fl, sx });
  }
  // diyas along the front of the plinth and around the rangoli
  const diyaGeo = B.lathe([[0.001, 0], [0.06, 0], [0.09, 0.025], [0.1, 0.05], [0.07, 0.045], [0.001, 0.035]], 12);
  const diyaMat = B.material('clay', { color: '#c96a3a', color2: '#e08a52', size: 128 });
  const dp = [];
  for (let i = 0; i < 18; i++) { const a = Math.PI * 1.02 + (i / 17) * Math.PI * 0.96; dp.push([Math.cos(a) * 3.15, -Math.sin(a) * 1.6 + 0.2]); }
  for (let i = 0; i < 10; i++) dp.push([-6 + i * 1.33, -3.05]);
  for (const [x, z] of dp) {
    const d = new T.Mesh(diyaGeo, diyaMat); d.position.set(x, 0.0, z); d.castShadow = false; scene.add(d);
    const fl = flame(0.2); fl.group.position.set(x, 0.1, z); scene.add(fl.group); R.diyas.push(fl);
  }
  // rain and a wet sheen
  const rainN = hi ? 420 : 160, rp = new Float32Array(rainN * 6);
  R.rainSeed = []; for (let i = 0; i < rainN; i++) R.rainSeed.push([(r0() - 0.5) * 18, r0() * 8, -4 + r0() * 8, 6 + r0() * 3]);
  const rainGeo = new T.BufferGeometry(); rainGeo.setAttribute('position', new T.BufferAttribute(rp, 3));
  R.rain = new T.LineSegments(rainGeo, new T.LineBasicMaterial({ color: 0xcfe0f5, transparent: true, opacity: 0.4, depthWrite: false, fog: false }));
  R.rain.frustumCulled = false; R.rain.visible = false; scene.add(R.rain);
  R.dustN = 0;
  R.act = null;
  return R;
}

function bandTexture() {
  const c = cv(1024, 64), g = c.getContext('2d');
  g.fillStyle = '#7a1f2a'; g.fillRect(0, 0, 1024, 64);
  g.fillStyle = '#e8b64a'; g.fillRect(0, 4, 1024, 5); g.fillRect(0, 55, 1024, 5);
  for (let i = 0; i < 40; i++) { const x = 12 + i * 25.6; g.fillStyle = '#ffd27a'; g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 8, 18); g.lineTo(x + 16, 32); g.lineTo(x + 8, 46); g.closePath(); g.fill(); g.fillStyle = '#2aa6a0'; g.beginPath(); g.arc(x + 8, 32, 3, 0, TAU); g.fill(); }
  return tex(c, { aniso: 4 });
}

let _glow = {};
export function glowTexture(rgb = '255,200,120') {
  if (_glow[rgb]) return _glow[rgb];
  const c = cv(64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.3, `rgba(${rgb},0.5)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (_glow[rgb] = tex(c, { aniso: 1 }));
}
export function resetGlow() { _glow = {}; }

// A flame: a tapered additive card (facing the camera by being a sprite) plus a halo.
export function flame(size = 0.4) {
  const group = new T.Group();
  const core = new T.Sprite(new T.SpriteMaterial({ map: flameTexture(), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.95 }));
  core.scale.set(size * 0.55, size, 1); core.center.set(0.5, 0.15); group.add(core);
  const halo = new T.Sprite(new T.SpriteMaterial({ map: glowTexture('255,170,70'), transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.55 }));
  halo.scale.set(size * 2.6, size * 2.6, 1); halo.position.y = size * 0.35; group.add(halo);
  return { group, core, halo, size, ph: Math.random() * 6 };
}
let _flameTex = null;
function flameTexture() {
  if (_flameTex) return _flameTex;
  const c = cv(64, 128), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 86, 2, 32, 76, 52);
  gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.25, 'rgba(255,214,110,0.95)'); gr.addColorStop(0.6, 'rgba(255,120,30,0.55)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(52, 44, 58, 80, 32, 124); g.bezierCurveTo(6, 80, 12, 44, 32, 4); g.fill();
  return (_flameTex = tex(c, { aniso: 1 }));
}
export function resetFlame() { _flameTex = null; }

// ---- per-act look ---------------------------------------------------------------------------------------------------------------------
const SKY = {
  day: ['#3a5a9a', '#7aa8d8', '#e8c89a'],
};
export function setAct(R, act) {
  if (R.act === act) return;
  R.act = act;
  const look = act.look || 'haveli', night = !!act.night, rain = !!act.rain;
  for (const k of Object.keys(R.variants)) R.variants[k].visible = k === look;
  R.variants.haveli.visible = look === 'haveli';
  R.variants.lake.visible = look === 'lake';
  R.wallMat.color.set(act.wall?.[0] ?? '#2b6fb0');
  const sk = act.sky ?? ['#f6a45a', '#d9607a', '#5a3a7a'];
  R.sky.material.map.dispose();
  R.sky.material.map = skyTexture([...sk].reverse().concat(night ? [] : []));
  R.sky.material.needsUpdate = true;
  const bg = new T.Color(night ? '#0d1330' : sk[1]);
  R.scene.background = null;
  const fogCol = new T.Color(sk[1]).lerp(new T.Color(night ? '#0a1028' : '#f0b890'), 0.35);
  R.scene.fog = new T.Fog(fogCol.getHex(), look === 'dunes' ? 24 : 26, look === 'dunes' ? 70 : 78);
  void bg;
  const L = R.rig;
  L.key.color.set(night ? '#8fa8ff' : rain ? '#cfd8e8' : '#ffb070'); L.key.intensity = night ? 0.9 : rain ? 1.4 : 3.0;
  L.key.position.set(-6, night ? 8 : 5.2, 5);
  L.fill.color.set(night ? '#6a86d0' : '#7a96e0'); L.fill.intensity = night ? 0.18 : 0.7;
  L.rim.color.set(night ? '#8aa8ff' : '#ffc08a'); L.rim.intensity = night ? 1.1 : 1.9;
  L.hemi.color.set(night ? '#6f8cff' : rain ? '#b8c4d8' : '#ffc9a0'); L.hemi.groundColor.set(night ? '#1a2236' : '#4a3a38'); L.hemi.intensity = night ? 0.2 : 0.75;
  R.stars.material.opacity = night ? 0.9 : 0; R.moon.material.opacity = night ? 1 : 0; R.moonGlow.material.opacity = night ? 0.55 : 0;
  R.rain.visible = rain;
  R.floorMat.color.set(look === 'dunes' ? '#e8c890' : '#ffffff');
  R.floorMat.roughness = rain ? 0.28 : 0.82; R.floorMat.envMapIntensity = rain ? 1.5 : 0.6;
  R.rig.group.children.forEach(() => {});
  for (const t of R.torches) t.light.intensity = night ? 3.2 : 2.0;
  R.bulbsOn = act.id === 'market' || act.id === 'lamps' || act.id === 'finale' || act.id === 'courtyard' || act.id === 'monsoon';
  for (const b of R.bulbs) { b.b.visible = R.bulbsOn; b.hs.visible = R.bulbsOn; }
  R.festival = !!act.festival;
  R.rangoliMat.opacity = rain ? 0.55 : 0.9;
  R.scene.environmentIntensity = night ? 0.14 : 0.5;
  R.wallMat.color.set(night ? col(act.wall?.[0] ?? '#2b6fb0').multiplyScalar(0.55) : (act.wall?.[0] ?? '#2b6fb0'));
}

export function updateRoom(R, v, dt, clock) {
  R.t += dt;
  const pulse = clamp(v.pulse || 0, 0, 1);
  for (const f of R.flames) f.s.material.opacity = 0.75 + 0.2 * Math.sin(clock * 5 + f.ph) + 0.1 * pulse;
  for (const t of R.torches) {
    const w = 0.85 + 0.15 * Math.sin(clock * 11 + t.sx) + 0.08 * Math.sin(clock * 23 + 1.3 * t.sx);
    t.light.intensity = (R.act?.night ? 3.2 : 2.0) * w;
    flick(t.fl, clock, 1.0);
  }
  for (const d of R.diyas) flick(d, clock, 0.5);
  if (R.bulbsOn) for (const b of R.bulbs) {
    const k = 0.7 + 0.3 * Math.sin(clock * 2.4 + b.i * 0.6 + b.line) + pulse * 0.3;
    b.hs.material.opacity = clamp(0.35 + 0.45 * k, 0, 1);
    b.hs.scale.setScalar(0.42 + 0.14 * k);
  }
  if (R.rain.visible) {
    const p = R.rain.geometry.attributes.position, S = R.rainSeed;
    for (let i = 0; i < S.length; i++) {
      const s = S[i], y = ((s[1] - clock * s[3]) % 8 + 8) % 8, x = s[0] + (v.wind || 0) * y * 0.15;
      p.setXYZ(i * 2, x, y, s[2]); p.setXYZ(i * 2 + 1, x + 0.03 + (v.wind || 0) * 0.15, y + 0.5, s[2]);
    }
    p.needsUpdate = true;
  }
}
function flick(f, clock, k) {
  const s = f.size, w = 1 + 0.18 * Math.sin(clock * 13 + f.ph) + 0.1 * Math.sin(clock * 29 + f.ph * 2);
  f.core.scale.set(s * 0.55 * (1 - 0.06 * w * k), s * w, 1);
  f.core.material.rotation = 0.07 * Math.sin(clock * 7 + f.ph) * k;
  f.halo.material.opacity = 0.42 + 0.18 * (w - 1) * 3;
}

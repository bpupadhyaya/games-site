// The Kassena compound at golden hour: a rammed-earth facade (layered mud courses, spouts, parapet, handprints), a packed-earth
// courtyard with puddles that grow in the rain, a round mud-brick compound behind with thatch roofs, a granary, a hanging calabash,
// a chicken, drifting dust and cloud banks. Metres, ground at y = 0, the wall plane at z = 0, camera on +z.
import { THREE, board3d as B, buildScenery } from '../vendor3d/index.js';
import { hash, CELL, bandCanvas } from './wall.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const ctex = (c, rep, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 8; return t; };

// seamless blob drawing (draws at the 9 wrap offsets)
function wrapDraw(size, fn) { for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) fn(ox, oy); }

function mudTextures(size = 1024) {
  const a = cv(size), b = cv(size), r = a.getContext('2d'), s = b.getContext('2d');
  r.fillStyle = '#b9794a'; r.fillRect(0, 0, size, size); s.fillStyle = '#808080'; s.fillRect(0, 0, size, size);
  // rammed-earth courses: horizontal layers with a slightly different tone and a seam
  const courses = 6;
  for (let k = 0; k < courses; k++) {
    const y0 = (k / courses) * size, hh = size / courses, tone = hash(k, 3);
    r.fillStyle = tone < 0.5 ? 'rgba(255,214,160,0.07)' : 'rgba(80,40,14,0.08)'; r.fillRect(0, y0, size, hh);
    s.fillStyle = 'rgba(30,30,30,0.5)'; s.fillRect(0, y0, size, 3); s.fillStyle = 'rgba(230,230,230,0.4)'; s.fillRect(0, y0 + 4, size, 2);
    r.fillStyle = 'rgba(60,28,10,0.35)'; r.fillRect(0, y0, size, 3);
  }
  for (let i = 0; i < 90; i++) {
    const x = hash(i, 1) * size, y = hash(i, 2) * size, rad = size * (0.04 + hash(i, 3) * 0.16), light = hash(i, 4) < 0.5;
    wrapDraw(size, (ox, oy) => {
      const g = r.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad); g.addColorStop(0, light ? 'rgba(255,226,180,0.15)' : 'rgba(80,38,16,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      r.fillStyle = g; r.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      const g2 = s.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad); g2.addColorStop(0, light ? 'rgba(220,220,220,0.15)' : 'rgba(30,30,30,0.15)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
      s.fillStyle = g2; s.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    });
  }
  for (let i = 0; i < size * size / 55; i++) {
    const x = hash(i, 11) * size, y = hash(i, 12) * size, k = hash(i, 13), z = 1 + hash(i, 14) * 3;
    r.fillStyle = k < 0.4 ? `rgba(255,232,196,${0.08 + k * 0.3})` : k < 0.85 ? `rgba(70,32,12,${0.07 + (k - 0.4) * 0.35})` : 'rgba(140,100,60,0.5)';
    r.fillRect(x, y, z, z * (0.5 + hash(i, 15)));
    s.fillStyle = k < 0.5 ? 'rgba(230,230,230,0.3)' : 'rgba(30,30,30,0.3)'; s.fillRect(x, y, z, z);
  }
  // straw and pebbles
  for (let i = 0; i < 160; i++) {
    const x = hash(i, 21) * size, y = hash(i, 22) * size, ln = 6 + hash(i, 23) * 16, ang = hash(i, 24) * TAU;
    r.strokeStyle = 'rgba(214,180,110,0.55)'; r.lineWidth = 1.2; r.beginPath(); r.moveTo(x, y); r.lineTo(x + Math.cos(ang) * ln, y + Math.sin(ang) * ln); r.stroke();
    s.strokeStyle = 'rgba(210,210,210,0.5)'; s.beginPath(); s.moveTo(x, y); s.lineTo(x + Math.cos(ang) * ln, y + Math.sin(ang) * ln); s.stroke();
  }
  return { a, b };
}
function earthTextures(size = 1024) {
  const a = cv(size), b = cv(size), r = a.getContext('2d'), s = b.getContext('2d');
  r.fillStyle = '#a9754a'; r.fillRect(0, 0, size, size); s.fillStyle = '#808080'; s.fillRect(0, 0, size, size);
  for (let i = 0; i < 120; i++) {
    const x = hash(i, 5) * size, y = hash(i, 6) * size, len = 40 + hash(i, 7) * 140, ang = (hash(i, 8) - 0.5) * 0.5;
    r.strokeStyle = hash(i, 9) < 0.5 ? 'rgba(70,40,18,0.08)' : 'rgba(255,220,170,0.09)'; r.lineWidth = 1 + hash(i, 10) * 2;
    wrapDraw(size, (ox, oy) => { r.beginPath(); r.moveTo(x + ox, y + oy); r.quadraticCurveTo(x + ox + len * 0.5, y + oy + 12, x + ox + len, y + oy + len * ang); r.stroke(); });
  }
  for (let i = 0; i < size * size / 40; i++) {
    const x = hash(i, 31) * size, y = hash(i, 32) * size, k = hash(i, 33);
    r.fillStyle = k < 0.5 ? `rgba(60,34,16,${0.12 + k * 0.3})` : k < 0.9 ? `rgba(255,228,190,${0.08 + k * 0.2})` : 'rgba(118,104,90,0.6)';
    const z = 0.8 + hash(i, 34) * (k > 0.9 ? 3.4 : 1.8); r.fillRect(x, y, z, z);
    s.fillStyle = k < 0.5 ? 'rgba(40,40,40,0.35)' : 'rgba(225,225,225,0.35)'; s.fillRect(x, y, z, z);
  }
  return { a, b };
}
function thatchTexture() {
  const c = cv(256), x = c.getContext('2d');
  x.fillStyle = '#a58340'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1100; i++) {
    const px = hash(i, 3) * 256, py = hash(i, 4) * 256, l = 24 + hash(i, 5) * 80, k = hash(i, 6);
    x.strokeStyle = k < 0.5 ? `rgba(70,48,14,${0.25 + k * 0.4})` : `rgba(240,212,130,${0.2 + k * 0.3})`; x.lineWidth = 1 + hash(i, 7) * 1.5;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + (hash(i, 8) - 0.5) * 5, py + l); x.stroke();
  }
  for (let y = 0; y < 256; y += 64) { x.fillStyle = 'rgba(50,30,10,0.4)'; x.fillRect(0, y, 256, 3); }
  return c;
}
function gourdTexture() {
  const c = cv(128, 256), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#d9a64f'); g.addColorStop(1, '#a8741e'); x.fillStyle = g; x.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 400; i++) { x.fillStyle = hash(i, 1) < 0.5 ? 'rgba(255,230,160,0.2)' : 'rgba(80,44,8,0.2)'; x.fillRect(hash(i, 2) * 128, hash(i, 3) * 256, 2, 2); }
  // burnt geometric engraving band
  x.strokeStyle = 'rgba(60,28,6,0.8)'; x.lineWidth = 3; x.beginPath(); for (let i = 0; i <= 16; i++) x.lineTo(i * 8, 150 + (i % 2) * 16); x.stroke();
  return c;
}
function handprint(color) {
  const c = cv(128, 160), x = c.getContext('2d');
  x.fillStyle = color; x.beginPath(); x.ellipse(64, 104, 30, 34, 0, 0, TAU); x.fill();
  const fing = [[-34, 56, 10, 32, -0.4], [-17, 38, 9, 38, -0.12], [3, 33, 9, 40, 0.0], [22, 40, 9, 36, 0.14]];
  for (const [dx, y, w, l, a] of fing) { x.save(); x.translate(64 + dx, 80); x.rotate(a); x.beginPath(); x.ellipse(0, -l * 0.7, w, l, 0, 0, TAU); x.fill(); x.restore(); }
  x.save(); x.translate(34, 112); x.rotate(-1.0); x.beginPath(); x.ellipse(0, -14, 9, 24, 0, 0, TAU); x.fill(); x.restore();
  // rough, chalky edge
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 260; i++) { x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(hash(i, 4) * 128, hash(i, 5) * 160, 1.5 + hash(i, 6) * 2, 1.5 + hash(i, 7) * 2); }
  return c;
}

export function createWorld({ quality = 'high', camera = null } = {}) {
  const group = new THREE.Group(); group.name = 'world';
  const tick = [];
  const panelInfo = { W: 6, H: 4, y: 1.8 };
  let T = 0, storm = 0;

  // ---------------------------------------------------------------- sky + far savanna (shared scenery3d, clean presets)
  let scenery = null;
  try {
    scenery = buildScenery({ timeOfDay: 'day', season: 'summer', quality, wind: 0.5, clouds: 0.35, radius: 90, culture: 'african-savanna',
      layers: [{ t: 'sky', id: 'sky-day' }, { t: 'backdrop', id: 'bd-savanna', seed: 5 }, { t: 'ground', id: 'gr-red-earth', size: 160, tile: 5 },
        { t: 'cutouts', id: 'tr-acacia', count: 3, r: [24, 40], arc: [-160, -100], scale: [8, 11], seed: 3, sway: 0.5 }] });
    group.add(scenery.group);
    // the scenery ground is a plane at y = 0 that would cut through the courtyard; lower it a little
    scenery.group.position.y = -0.06;
  } catch (e) { console.warn('scenery3d unavailable', e); }

  // ---------------------------------------------------------------- the facade: rammed earth across the whole view
  const mud = mudTextures(quality === 'low' ? 512 : 1024);
  const mudMat = new THREE.MeshStandardMaterial({ map: ctex(mud.a, [1, 1]), bumpMap: ctex(mud.b, [1, 1], false), bumpScale: 3.0, roughness: 0.96, color: 0xffffff });
  mudMat.map.repeat.set(20, 14); mudMat.bumpMap.repeat.set(20, 14);
  const facade = new THREE.Mesh(new THREE.PlaneGeometry(60, 42), mudMat);
  facade.receiveShadow = true; facade.position.set(0, 21, -0.02); group.add(facade);

  // plinth: a rougher darker band at the base with the lime wash line above it
  const plinthMat = new THREE.MeshStandardMaterial({ map: mudMat.map, bumpMap: mudMat.bumpMap, bumpScale: 4.5, color: 0x8f6a52, roughness: 1 });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(60, 0.55, 0.22), plinthMat);
  plinth.position.set(0, 0.275, 0.07); plinth.castShadow = true; plinth.receiveShadow = true; group.add(plinth);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(60, 0.05, 0.26), new THREE.MeshStandardMaterial({ color: 0xe9d7b0, roughness: 0.9 }));
  lip.position.set(0, 0.575, 0.08); lip.receiveShadow = true; group.add(lip);

  // courtyard ground
  const earth = earthTextures(quality === 'low' ? 512 : 1024);
  const earthMat = new THREE.MeshStandardMaterial({ map: ctex(earth.a, [14, 9]), bumpMap: ctex(earth.b, [14, 9], false), bumpScale: 2.2, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), earthMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0.0, 19.9); ground.receiveShadow = true; group.add(ground);

  // puddles that grow while it rains (still water mirrors the sky)
  const puddleTex = (() => { const c = cv(128), x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 8, 64, 64, 62); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.7, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; })();
  const puddles = [];
  for (let k = 0; k < 6; k++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshPhysicalMaterial({ color: 0x4a3a30, roughness: 0.06, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.04, alphaMap: puddleTex, transparent: true, envMapIntensity: 1.6, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set((k - 2.5) * 1.5 + (hash(k, 5) - 0.5), 0.012, 1.1 + hash(k, 9) * 2.4); m.scale.set(0.5, 0.35, 1); m.receiveShadow = true;
    puddles.push({ m, size: 0.8 + hash(k, 3) * 0.9 }); group.add(m);
  }

  // handprints in lime and ochre: the women of the house leave them on the plaster
  const hpMats = [new THREE.MeshStandardMaterial({ map: (() => { const t = new THREE.CanvasTexture(handprint('#f1e9d3')); t.colorSpace = THREE.SRGBColorSpace; return t; })(), transparent: true, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    new THREE.MeshStandardMaterial({ map: (() => { const t = new THREE.CanvasTexture(handprint('#a8442a')); t.colorSpace = THREE.SRGBColorSpace; return t; })(), transparent: true, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })];
  const hands = [];
  for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.26), hpMats[k % 2]); m.receiveShadow = true; hands.push(m); group.add(m); }

  // ---------------------------------------------------------------- parapet, spouts, thatch eave (placed from the panel's size)
  const capMat = new THREE.MeshStandardMaterial({ map: mudMat.map, bumpMap: mudMat.bumpMap, bumpScale: 3.5, color: 0xd9b48a, roughness: 1 });
  const cap = new THREE.Mesh(new THREE.BoxGeometry(60, 0.42, 0.7), capMat); cap.castShadow = true; cap.receiveShadow = true; group.add(cap);
  // two painted friezes run along the facade above and below the panel, and rain stains streak down from the spouts
  const friezeTex = new THREE.CanvasTexture(bandCanvas(1024, 192, 11)); friezeTex.colorSpace = THREE.SRGBColorSpace; friezeTex.wrapS = THREE.RepeatWrapping; friezeTex.repeat.set(24, 1); friezeTex.anisotropy = 8;
  const friezeMat = new THREE.MeshStandardMaterial({ map: friezeTex, bumpMap: friezeTex, bumpScale: 1.2, roughness: 0.92 });
  const friezes = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(26, 0.3), friezeMat); m.receiveShadow = true; group.add(m); return m; });
  const stainTex = (() => { const c = cv(64, 256), x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(60,28,10,0.55)'); g.addColorStop(1, 'rgba(60,28,10,0)'); x.fillStyle = g; x.fillRect(16, 0, 32, 256);
    for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(60,28,10,0.12)'; x.fillRect(12 + hash(i, 1) * 40, hash(i, 2) * 200, 3, 30 + hash(i, 3) * 60); } return new THREE.CanvasTexture(c); })();
  const stains = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.6), new THREE.MeshBasicMaterial({ map: stainTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, fog: false })); group.add(m); return m; });
  const clayM = B.material('clay', { color: '#a35a38', color2: '#c98055', roughness: 0.85, size: 256 });
  const spouts = [];
  for (let k = 0; k < 3; k++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.62, 14, 1, true), clayM); m.rotation.x = Math.PI / 2 - 0.12; m.castShadow = true; m.material.side = THREE.DoubleSide; spouts.push(m); group.add(m);
  }
  // turrets on the parapet: the small flat-topped towers of a Tiebele house
  const turrets = [];
  for (let k = 0; k < 0; k++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.8, 18), capMat); m.castShadow = true; m.receiveShadow = true; turrets.push(m); group.add(m); }

  // ---------------------------------------------------------------- compound behind: round mud huts with thatch roofs and a granary
  const thatchMat = new THREE.MeshStandardMaterial({ map: ctex(thatchTexture(), [4, 2]), roughness: 1, side: THREE.DoubleSide });
  const hutWall = new THREE.MeshStandardMaterial({ map: mudMat.map, bumpMap: mudMat.bumpMap, bumpScale: 2.5, color: 0xe6b88c, roughness: 1 });
  function hut(x, z, s, rot, h = 1.5) {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.22, h, 32, 1, true), hutWall); wall.position.y = h / 2; wall.castShadow = true; wall.receiveShadow = true;
    const prof = [[0, 2.9], [0.12, 2.74], [0.45, 2.3], [0.95, 1.92], [1.5, 1.6], [1.86, 1.42], [1.95, 1.38]].map(([r, y]) => new THREE.Vector2(r, y + (h - 1.5)));
    const roof = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), thatchMat); roof.castShadow = true; roof.receiveShadow = true;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.85), new THREE.MeshBasicMaterial({ color: 0x24120a })); door.position.set(0, 0.43, 1.19);
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a1a })); fin.position.y = 2.95 + (h - 1.5);
    g.add(wall, roof, door, fin); g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = rot; group.add(g); return g;
  }
  const huts = [hut(-4.6, -4.4, 1.55, 0.3, 1.5), hut(4.4, -5.0, 1.7, -0.2, 1.5), hut(0.2, -8.4, 1.9, 0.1, 1.5), hut(-10.0, -8.0, 1.5, 0.6, 1.5), hut(10.6, -8.6, 1.6, -0.5, 1.5)];
  // granary: a pot-shaped mud bin on stones with a small thatch cap
  function granary(x, z, s) {
    const g = new THREE.Group();
    const prof = [[0.0, 0.4], [0.5, 0.4], [0.78, 0.7], [0.9, 1.2], [0.82, 1.75], [0.55, 2.05], [0.42, 2.12]].map(([r, y]) => new THREE.Vector2(r, y));
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), hutWall); body.castShadow = true; body.receiveShadow = true;
    const capPr = [[0.0, 3.0], [0.2, 2.9], [0.7, 2.5], [1.1, 2.22], [1.2, 2.16]].map(([r, y]) => new THREE.Vector2(r, y));
    const cp = new THREE.Mesh(new THREE.LatheGeometry(capPr, 28), thatchMat); cp.castShadow = true;
    const stoneM = B.material('stone', { color: '#6a6055', color2: '#a39787', size: 256, seed: 3 });
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU, st = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.4, 8), stoneM); st.position.set(Math.cos(a) * 0.5, 0.2, Math.sin(a) * 0.5); st.castShadow = true; g.add(st); }
    g.add(body, cp); g.position.set(x, 0, z); g.scale.setScalar(s); group.add(g); return g;
  }
  granary(-1.8, -3.0, 1.45); granary(7.4, -3.0, 1.25);

  // ---------------------------------------------------------------- hanging calabash on a peg, swinging a little in the wind
  const gourdMat = new THREE.MeshStandardMaterial({ map: (() => { const t = new THREE.CanvasTexture(gourdTexture()); t.colorSpace = THREE.SRGBColorSpace; return t; })(), roughness: 0.5, bumpMap: null });
  const gourd = new THREE.Group();
  const gprof = [[0.001, -0.17], [0.07, -0.16], [0.12, -0.1], [0.14, -0.02], [0.1, 0.05], [0.055, 0.1], [0.05, 0.16], [0.07, 0.24], [0.045, 0.31]].map(([r, y]) => new THREE.Vector2(r, y));
  const gm = new THREE.Mesh(new THREE.LatheGeometry(gprof, 24), gourdMat); gm.castShadow = true; gm.position.y = -0.34;
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.24, 6), new THREE.MeshStandardMaterial({ color: 0x6b5030, roughness: 1 })); rope.position.y = -0.1;
  const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 1 })); peg.rotation.x = Math.PI / 2; peg.position.z = 0.05;
  gourd.add(gm, rope); const gourdRoot = new THREE.Group(); gourdRoot.add(peg, gourd); gourd.position.z = 0.1; group.add(gourdRoot);

  // a chicken pecking at the foot of the wall (its feathers are the painter's brush)
  const chicken = (() => {
    const g = new THREE.Group();
    const bodyM = new THREE.MeshStandardMaterial({ color: 0xb98a58, roughness: 0.9 }), darkM = new THREE.MeshStandardMaterial({ color: 0x4a2c16, roughness: 0.9 }), redM = new THREE.MeshStandardMaterial({ color: 0xb5231a, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), bodyM); body.scale.set(1.3, 0.95, 0.9); body.position.y = 0.2;
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshStandardMaterial({ color: 0xd3a874, roughness: 0.9 })); chest.position.set(0.1, 0.19, 0);
    const neck = new THREE.Group(); neck.position.set(0.14, 0.26, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), bodyM); head.position.set(0.04, 0.08, 0);
    const beak = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.014, 0.045, 6), new THREE.MeshStandardMaterial({ color: 0xe0a028 })); beak.rotation.z = -Math.PI / 2; beak.position.set(0.1, 0.075, 0);
    const comb = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), redM); comb.scale.set(0.7, 1.3, 0.4); comb.position.set(0.04, 0.125, 0);
    const neckM = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.1, 8), bodyM); neckM.position.set(0.02, 0.03, 0); neckM.rotation.z = -0.25;
    neck.add(neckM, head, beak, comb);
    const tail = new THREE.Group(); tail.position.set(-0.13, 0.24, 0);
    for (let k = -2; k <= 2; k++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.03, 0.2, 5), k % 2 ? darkM : bodyM); f.rotation.z = 0.9 + Math.abs(k) * 0.08; f.rotation.x = k * 0.28; f.position.set(-0.03, 0.04, 0); tail.add(f); }
    const legM = new THREE.MeshStandardMaterial({ color: 0xd8b04a });
    for (const z of [-0.04, 0.04]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 5), legM); l.position.set(0.0, 0.06, z); g.add(l); }
    g.add(body, chest, neck, tail); g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.scale.setScalar(1.15); g.position.set(-2.4, 0.0, 2.0); g.rotation.y = 0.6;
    g.userData.neck = neck; return g;
  })();
  group.add(chicken);
  tick.push((dt, t) => { const peck = Math.max(0, Math.sin(t * 2.1)) ** 6; chicken.userData.neck.rotation.z = -peck * 0.9; chicken.position.y = 0; chicken.rotation.y = 0.6 + Math.sin(t * 0.3) * 0.12; });

  // ---------------------------------------------------------------- clouds (grey in the storm) and drifting dust motes
  const cloudTex = (() => { const c = cv(256, 128), x = c.getContext('2d'); for (let i = 0; i < 26; i++) { const px = 40 + hash(i, 1) * 176, py = 40 + hash(i, 2) * 50, r = 22 + hash(i, 3) * 34; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); } return new THREE.CanvasTexture(c); })();
  const clouds = [];
  for (let k = 0; k < 7; k++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), new THREE.MeshBasicMaterial({ map: cloudTex, color: 0xfff0d6, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
    m.position.set(-18 + k * 6 + hash(k, 3) * 3, 12 + hash(k, 4) * 6, -28); m.scale.set(16 + hash(k, 5) * 10, 16 + hash(k, 5) * 10, 1); clouds.push(m); group.add(m);
  }
  const N = quality === 'low' ? 30 : 80;
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = (hash(i, 1) - 0.5) * 9; pos[i * 3 + 1] = 0.3 + hash(i, 2) * 3.2; pos[i * 3 + 2] = 0.4 + hash(i, 3) * 3.5; vel[i * 3] = 0.03 + hash(i, 4) * 0.05; vel[i * 3 + 1] = 0.01 + hash(i, 5) * 0.03; vel[i * 3 + 2] = (hash(i, 6) - 0.5) * 0.03; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffe2a0, size: 0.035, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false }));
  dust.frustumCulled = false; group.add(dust);

  // leaf shadows: invisible casters between the sun and the wall, swaying (the living dapple of golden hour)
  const leafGroup = new THREE.Group();
  const leafG = new THREE.PlaneGeometry(0.2, 0.065); const leafM = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide });
  const leaves = [];
  for (let k = 0; k < 26; k++) {
    const l = new THREE.Mesh(leafG, leafM); l.castShadow = false; l.visible = false;
    const a = hash(k, 5) * 0.7 - 0.35, r = 0.4 + hash(k, 6) * 2.2, side = k % 2 ? 1 : -1;
    l.userData = { a, r, side, ph: hash(k, 7) * TAU, base: new THREE.Vector3((hash(k, 8) - 0.5) * 3.4, (hash(k, 10) - 0.5) * 2.6, (hash(k, 11) - 0.5) * 1.2) };
    leaves.push(l); leafGroup.add(l);
  }
  group.add(leafGroup);

  // ---------------------------------------------------------------- layout from the panel size
  function setPanel(W, H) {
    panelInfo.W = W; panelInfo.H = H;
    const pw = W * CELL, ph = H * CELL, y0 = 1.3, cy = y0 + ph / 2, top = y0 + ph;
    panelInfo.y = cy;
    const par = top + 1.0;
    cap.position.set(0, par, 0.12);
    facade.scale.y = par / 42; facade.position.y = par / 2;
    spouts.forEach((s, k) => { s.position.set(-pw * 0.62 + k * pw * 0.62, par - 0.32, 0.38); });
    stains.forEach((s, k) => { s.position.set(-pw * 0.62 + k * pw * 0.62, par - 0.32 - 0.8, 0.003); });
    friezes[0].position.set(0, top + 0.5, 0.004); friezes[1].position.set(0, 0.98, 0.004);
    turrets.forEach((t, k) => t.position.set(-pw * 0.95 + k * pw * 0.64, par + 0.6, -0.05));
    hands.forEach((h, k) => {
      const side = k % 2 ? 1 : -1;
      h.position.set(side * (pw / 2 + 0.55 + (k >> 1) * 0.28), y0 + 0.4 + hash(k, 8) * (ph * 0.8), 0.004); h.rotation.z = (hash(k, 9) - 0.5) * 0.7; h.scale.x = side;
    });
    gourdRoot.position.set(pw / 2 + 0.62, top - 0.2, 0.02);
    // the huts' roofs rise above the parapet
    ground.position.z = 19.9;
  }

  return {
    group, scenery, panelInfo, setPanel, leafGroup,
    set storm(v) { storm = clamp(v, 0, 1); },
    get storm() { return storm; },
    update(dt, cam, calm) {
      T += dt;
      for (const f of tick) f(dt, T);
      try { scenery && scenery.update(dt, cam); } catch { /* still loading */ }
      const wind = Math.sin(T * 0.8) * 0.5 + Math.sin(T * 1.9) * 0.3 + storm * Math.sin(T * 3.4) * 0.6;
      gourd.rotation.z = (calm ? 0 : wind * 0.06) + storm * 0.04; gourd.rotation.x = calm ? 0 : Math.sin(T * 1.3) * 0.02;
      for (const l of leaves) {
        const u = l.userData, s = Math.sin(T * 0.9 + u.ph) * 0.5;
        l.position.set(u.base.x + Math.sin(T * 0.6 + u.ph) * 0.25, u.base.y + Math.sin(T * 0.8 + u.ph * 2) * 0.12, u.base.z);
        l.rotation.set(s * 0.35, s * 0.3, u.a * 3 + u.side * 0.6 + s * 0.5 + wind * 0.12);
      }
      // puddles swell with the storm
      puddles.forEach((p, k) => { const s = p.size * (0.15 + storm * 1.0); p.m.scale.set(s * 1.5, s, 1); p.m.visible = storm > 0.03; });
      // clouds: warm and thin on a dry day, dark and heavy in the rain
      clouds.forEach((c, k) => {
        c.material.color.setRGB(1 - storm * 0.55, 0.94 - storm * 0.5, 0.84 - storm * 0.38); c.material.opacity = 0.42 + storm * 0.5;
        c.position.x += dt * (0.18 + 0.1 * (k % 3)); if (c.position.x > 24) c.position.x = -24;
      });
      if (!calm) {
        const a = pg.attributes.position.array;
        for (let i = 0; i < N; i++) { a[i * 3] += vel[i * 3] * dt; a[i * 3 + 1] += vel[i * 3 + 1] * dt; a[i * 3 + 2] += vel[i * 3 + 2] * dt; if (a[i * 3] > 4.5) a[i * 3] = -4.5; if (a[i * 3 + 1] > 3.6) a[i * 3 + 1] = 0.3; }
        pg.attributes.position.needsUpdate = true;
      }
      dust.material.opacity = 0.6 * (1 - storm * 0.8);
      const k = 1 - 0.3 * storm; mudMat.color.setRGB(k, k * 0.97, k * 0.93); mudMat.roughness = 0.96 - 0.25 * storm; friezeMat.color.setRGB(k, k, k);
    },
  };
}

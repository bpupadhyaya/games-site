// The lane: a wooden target board (vertical planks, painted rings, blue kill-shot dots), the throwing line with chalk marks, the cage, and
// the room around it for each of the four venues. Everything is presentation; the presenter feeds it the venue, the wind and the board slide.
// Units are metres. The throwing line is z = 0, the thrower faces -Z, the board face is the plane z = -D and looks back at +Z.
export const YC = 1.5;                     // board centre height (the bull is at 5 ft in the sport)
export const KM = 0.00086;                 // metres per board unit (the 1000-unit board is 0.86 m wide, the outer ring 0.76 m across)
export const DIST = [3.66, 4.76, 3.66, 7.32];   // lane length per venue: 12 ft, a step further back, 12 ft, the long hall (tm 1.0 / 1.3 / 1.0 / 2.0)
const TAU = Math.PI * 2;

export const THEME = [
  // 0 Pine Camp: bright shed, afternoon sun through the open side
  { name: 'pine', bg: 0x9fb8c6, fog: 0xc7d3d6, fogNear: 12, fogFar: 40, hemiSky: 0xfff0d6, hemiGround: 0x6b5238, hemi: 1.0, key: 0xffe3b3, keyI: 3.4, rim: 0xcfe0ff, rimI: 1.4, exposure: 1.05, env: 0.5,
    floor: ['#b79a6c', '#d2b88a'], wall: ['#8d6a3f', '#b08857'], lanterns: 0 },
  // 1 Cedar Lodge: log walls and lantern light
  { name: 'cedar', bg: 0x2a1a10, fog: 0x2a1a10, fogNear: 10, fogFar: 30, hemiSky: 0xffd2a0, hemiGround: 0x2a1a10, hemi: 0.55, key: 0xffc27a, keyI: 3.0, rim: 0xff9a55, rimI: 1.6, exposure: 1.08, env: 0.35,
    floor: ['#6a4526', '#8a5f36'], wall: ['#5b3a1f', '#7a5230'], lanterns: 4 },
  // 2 Open Yard: outdoor lane at dusk, pennants in the wind
  { name: 'yard', bg: 0x7b6a98, fog: 0xc9a1a0, fogNear: 14, fogFar: 50, hemiSky: 0xffc7a0, hemiGround: 0x3a3a2c, hemi: 0.75, key: 0xffa866, keyI: 3.3, rim: 0x9db4ff, rimI: 1.9, exposure: 1.05, env: 0.45,
    floor: ['#6d6a45', '#8a8458'], wall: ['#7a5a38', '#9a7448'], lanterns: 5 },
  // 3 Night League: hall under spotlights, board on a rail
  { name: 'night', bg: 0x070b18, fog: 0x0a1228, fogNear: 12, fogFar: 36, hemiSky: 0x7f98d8, hemiGround: 0x141a2a, hemi: 0.5, key: 0xdfe8ff, keyI: 2.4, rim: 0x6ee9d4, rimI: 2.2, exposure: 1.0, env: 0.3,
    floor: ['#2c313c', '#3b4250'], wall: ['#202634', '#2e3648'], lanterns: 0 },
];

const cvs = (w, h) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rnd = (seed) => { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// ---- the board face: five vertical planks, painted rings with raised paint edges, numerals, blue kill-shot dots ---------------------
const RING = [
  { r: 440, col: '#ecd9ae', n: '1' }, { r: 338, col: '#2d4c8c', n: '2' }, { r: 244, col: '#ecd9ae', n: '3' }, { r: 150, col: '#b02f1c', n: '4' }, { r: 64, col: '#f0b22a', n: '' },
];
export function paintBoard(size = 1024) {
  const map = cvs(size, size), bump = cvs(size, size);
  const g = map.getContext('2d'), b = bump.getContext('2d'), k = size / 1000, c = size / 2, R = rnd(41);
  const planks = [['#b98a54', '#cfa06a'], ['#a87a46', '#c18f58'], ['#c39560', '#d8ab76'], ['#b0834d', '#c99a62'], ['#bb8d58', '#d2a46e']];
  b.fillStyle = '#808080'; b.fillRect(0, 0, size, size);
  const pw = size / 5;
  planks.forEach((p, i) => {
    const x0 = i * pw, gr = g.createLinearGradient(x0, 0, x0 + pw, 0);
    gr.addColorStop(0, p[0]); gr.addColorStop(0.5, p[1]); gr.addColorStop(1, p[0]);
    g.fillStyle = gr; g.fillRect(x0, 0, pw, size);
    // grain: long thin darker and lighter streaks, slightly wavy
    for (let n = 0; n < 70; n++) {
      const x = x0 + R() * pw, w = 0.6 + R() * 1.6, a = 0.04 + R() * 0.1, dark = R() < 0.65, ph = R() * 6;
      g.strokeStyle = dark ? `rgba(60,34,12,${a})` : `rgba(255,230,180,${a * 0.8})`; g.lineWidth = w;
      g.beginPath();
      for (let y = 0; y <= size; y += 24) { const xx = x + Math.sin(y * 0.012 + ph) * 2.2; if (y === 0) g.moveTo(xx, y); else g.lineTo(xx, y); }
      g.stroke();
      b.strokeStyle = dark ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.1)'; b.lineWidth = w;
      b.beginPath(); b.moveTo(x, 0); b.lineTo(x, size); b.stroke();
    }
    // one or two knots per plank
    for (let n = 0; n < 1 + (R() < 0.5 ? 1 : 0); n++) {
      const kx = x0 + pw * (0.25 + R() * 0.5), ky = size * (0.1 + R() * 0.8), kr = 8 + R() * 10;
      for (let q = 3; q >= 1; q--) { g.fillStyle = `rgba(70,38,14,${0.16 * (4 - q)})`; g.beginPath(); g.ellipse(kx, ky, kr * q * 0.5, kr * q * 0.85, 0, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(40,20,8,0.7)'; g.beginPath(); g.ellipse(kx, ky, kr * 0.35, kr * 0.6, 0, 0, TAU); g.fill();
    }
    // seam between planks (dark groove) and the bolts
    g.fillStyle = 'rgba(30,16,6,0.85)'; g.fillRect(x0 - 1.5, 0, 3, size);
    b.fillStyle = '#2a2a2a'; b.fillRect(x0 - 3, 0, 6, size);
  });
  // paint: rings from the outside in; an uneven edge, worn by splinters and chips
  const ring = (r, col, bumpUp) => {
    g.fillStyle = col; g.globalAlpha = 0.93;
    g.beginPath(); g.arc(c, c, r * k, 0, TAU); g.fill();
    g.globalAlpha = 1;
    g.lineWidth = 2.4; g.strokeStyle = 'rgba(40,20,8,0.55)'; g.beginPath(); g.arc(c, c, r * k, 0, TAU); g.stroke();
    b.fillStyle = bumpUp ? '#9a9a9a' : '#8c8c8c'; b.beginPath(); b.arc(c, c, r * k, 0, TAU); b.fill();
    b.lineWidth = 3; b.strokeStyle = '#d0d0d0'; b.beginPath(); b.arc(c, c, r * k - 1, 0, TAU); b.stroke();
  };
  RING.forEach((r, i) => ring(r.r, r.col, i % 2 === 0));
  // wood shows through the paint a little: re-draw grain over the paint with low alpha
  g.globalCompositeOperation = 'multiply';
  for (let n = 0; n < 160; n++) { const x = R() * size; g.strokeStyle = `rgba(120,100,80,${0.05 + R() * 0.08})`; g.lineWidth = 0.6 + R() * 1.4; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (R() - 0.5) * 8, size); g.stroke(); }
  g.globalCompositeOperation = 'source-over';
  // numerals on the vertical axis of each ring band
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const bands = [[440, 338, '1', '#5a3a1a'], [338, 244, '2', '#e8ecf6'], [244, 150, '3', '#5a3a1a'], [150, 64, '4', '#f6e0c8']];
  for (const [r0, r1, t, col] of bands) {
    const rm = (r0 + r1) / 2;
    g.font = `800 ${Math.round(30 * k)}px 'Avenir Next Condensed', 'Arial Narrow', sans-serif`;
    g.fillStyle = col;
    for (const a of [-Math.PI / 2, Math.PI / 2, 0, Math.PI]) g.fillText(t, c + Math.cos(a) * rm * k, c + Math.sin(a) * rm * k + 1);
  }
  // the two blue kill-shot dots in the upper corners (worth 7)
  for (const sx of [-1, 1]) {
    const x = c + sx * 400 * k, y = c - 400 * k, r = 48 * k;
    g.fillStyle = '#f0e8d4'; g.beginPath(); g.arc(x, y, r * 1.22, 0, TAU); g.fill();
    g.fillStyle = '#1d56b8'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.lineWidth = 3; g.strokeStyle = '#0b2a66'; g.stroke();
    g.fillStyle = '#ffffff'; g.font = `800 ${Math.round(46 * k)}px 'Avenir Next Condensed', 'Arial Narrow', sans-serif`; g.fillText('7', x, y + 2);
    b.fillStyle = '#bbb'; b.beginPath(); b.arc(x, y, r * 1.22, 0, TAU); b.fill();
  }
  // old hatchet scars (dark short slits) and chalk dust
  for (let n = 0; n < 26; n++) {
    const a = R() * TAU, d = R() * 430 * k, x = c + Math.cos(a) * d, y = c + Math.sin(a) * d;
    g.save(); g.translate(x, y); g.rotate((R() - 0.5) * 0.5 + Math.PI / 2);
    g.fillStyle = `rgba(30,16,6,${0.35 + R() * 0.3})`; g.fillRect(-1.2, -9 - R() * 8, 2.4, 20 + R() * 12); g.restore();
  }
  // soft vignette of dirt toward the edges
  const vg = g.createRadialGradient(c, c, size * 0.3, c, c, size * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,24,10,0.35)');
  g.fillStyle = vg; g.fillRect(0, 0, size, size);
  return { map, bump };
}


// ---- procedural timber: boards, logs, floor planks, posts. One canvas each, repeated; never a wavy generic grain ------------------
const lerpHex = (a, b, t) => { const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16)); return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
export function timberCanvas(kind, c0, c1, seed = 1, size = 512) {
  const map = cvs(size, size), bump = cvs(size, size), g = map.getContext('2d'), b = bump.getContext('2d'), R = rnd(seed * 97 + 5);
  b.fillStyle = '#808080'; b.fillRect(0, 0, size, size);
  const grain = (x0, y0, w, h, dark) => {
    for (let n = 0; n < Math.max(6, w / 5); n++) {
      const x = x0 + R() * w, a = 0.05 + R() * 0.1, wd = 0.6 + R() * 1.4, ph = R() * 6;
      g.strokeStyle = R() < 0.65 ? `rgba(${dark},${a})` : `rgba(255,236,196,${a * 0.7})`; g.lineWidth = wd;
      g.beginPath(); for (let y = y0; y <= y0 + h; y += 16) { const xx = x + Math.sin(y * 0.02 + ph) * 1.4; y === y0 ? g.moveTo(xx, y) : g.lineTo(xx, y); } g.stroke();
    }
  };
  if (kind === 'boards' || kind === 'floor' || kind === 'post') {
    const n = kind === 'post' ? 1 : kind === 'floor' ? 5 : 8, bw = size / n;
    for (let i = 0; i < n; i++) {
      const t = R(), x0 = i * bw;
      const gr = g.createLinearGradient(x0, 0, x0 + bw, 0); const ca = lerpHex(c0, c1, t * 0.7), cb = lerpHex(c0, c1, 0.25 + t * 0.7);
      gr.addColorStop(0, ca); gr.addColorStop(0.5, cb); gr.addColorStop(1, ca);
      g.fillStyle = gr; g.fillRect(x0, 0, bw, size);
      grain(x0, 0, bw, size, '50,28,10');
      if (kind !== 'post') { g.fillStyle = 'rgba(20,10,4,0.75)'; g.fillRect(x0 - 1.5, 0, 3, size); b.fillStyle = '#242424'; b.fillRect(x0 - 3, 0, 6, size); }
      // butt joints on the floor
      if (kind === 'floor') { const y = R() * size; g.fillStyle = 'rgba(20,10,4,0.7)'; g.fillRect(x0, y, bw, 2.5); b.fillStyle = '#303030'; b.fillRect(x0, y - 1, bw, 5); }
    }
  } else if (kind === 'logs') {
    const rows = 8, rh = size / rows;
    for (let r = 0; r < rows; r++) {
      const y0 = r * rh, t = R(), base = lerpHex(c0, c1, 0.2 + t * 0.6);
      const gr = g.createLinearGradient(0, y0, 0, y0 + rh);
      gr.addColorStop(0, lerpHex(base, '#000000', 0.45)); gr.addColorStop(0.18, lerpHex(base, '#ffffff', 0.12)); gr.addColorStop(0.5, base); gr.addColorStop(1, lerpHex(base, '#000000', 0.55));
      g.fillStyle = gr; g.fillRect(0, y0, size, rh);
      for (let n = 0; n < 26; n++) { const y = y0 + rh * (0.12 + R() * 0.8), x = R() * size, l = 40 + R() * 160; g.strokeStyle = `rgba(30,14,4,${0.06 + R() * 0.12})`; g.lineWidth = 0.8 + R(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (R() - 0.5) * 3); g.stroke(); }
      b.fillStyle = '#303030'; b.fillRect(0, y0, size, 7); b.fillStyle = '#b0b0b0'; b.fillRect(0, y0 + rh * 0.3, size, rh * 0.35);
      if (R() < 0.6) { const kx = R() * size, ky = y0 + rh * 0.5; g.fillStyle = 'rgba(30,14,4,0.55)'; g.beginPath(); g.ellipse(kx, ky, 9 + R() * 8, 7, 0, 0, TAU); g.fill(); }
    }
  } else {
    g.fillStyle = c0; g.fillRect(0, 0, size, size);
  }
  return { map, bump };
}

// ---- small texture helpers --------------------------------------------------------------------------------------------------------
function glowTexture(THREE) {
  const c = cvs(64, 64), g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function chalkTexture(THREE) {
  const c = cvs(256, 256), g = c.getContext('2d'), R = rnd(9);
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 16; g.lineCap = 'round';
  g.beginPath(); g.moveTo(40, 40); g.lineTo(216, 216); g.moveTo(216, 40); g.lineTo(40, 216); g.stroke();
  const d = g.getImageData(0, 0, 256, 256);
  for (let i = 0; i < d.data.length; i += 4) if (d.data[i + 3] > 0) d.data[i + 3] *= 0.45 + R() * 0.55;
  g.putImageData(d, 0, 0);
  return new THREE.CanvasTexture(c);
}
function netTexture(THREE) {
  const c = cvs(128, 128), g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128); g.strokeStyle = 'rgba(190,196,206,0.75)'; g.lineWidth = 3;
  for (let i = -128; i < 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function buildWorld(V3, stage, { quality = 'high' } = {}) {
  const { THREE, board3d: B } = V3;
  const scene = stage.scene, hi = quality === 'high', lo = quality === 'low';
  const W = { THREE, quality, venue: -1, dist: DIST[0], YC, KM };
  const root = new THREE.Group(); scene.add(root);
  const glowTex = glowTexture(THREE);
  const timCache = new Map();
  const timber = (kind, c0, c1, seed, rx = 1, ry = 1, o = {}) => {
    const key = `${kind}|${c0}|${c1}|${seed}`;
    let e = timCache.get(key);
    if (!e) {
      const c = timberCanvas(kind, c0, c1, seed, 512);
      const map = new THREE.CanvasTexture(c.map); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4;
      const bump = new THREE.CanvasTexture(c.bump); bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
      e = { map, bump }; timCache.set(key, e);
    }
    const m = new THREE.MeshStandardMaterial({ map: e.map, bumpMap: e.bump, bumpScale: o.bump ?? 1.2, roughness: o.rough ?? 0.85, metalness: 0, envMapIntensity: 0.35, color: o.tint ?? 0xffffff });
    m.map = e.map.clone(); m.map.needsUpdate = true; m.map.repeat.set(rx, ry);
    m.bumpMap = e.bump.clone(); m.bumpMap.needsUpdate = true; m.bumpMap.repeat.set(rx, ry);
    return m;
  };
  const addGlow = (g, x, y, z, color, size, op = 0.8) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: op, fog: false }));
    s.position.set(x, y, z); s.scale.setScalar(size); g.add(s); return s;
  };

  // ---- the target board (a child group so it can slide on a rail and shudder when an axe bites) ------------------------------------
  const board = new THREE.Group(); root.add(board);
  const paint = paintBoard(1024);
  const mapTex = new THREE.CanvasTexture(paint.map); mapTex.colorSpace = THREE.SRGBColorSpace; mapTex.anisotropy = 4;
  const bumpTex = new THREE.CanvasTexture(paint.bump);
  const faceMat = new THREE.MeshStandardMaterial({ map: mapTex, bumpMap: bumpTex, bumpScale: 1.3, roughness: 0.82, metalness: 0, envMapIntensity: 0.4 });
  const BW = 1000 * KM;                       // face width
  const frameMat = timber('post', '#4a2b14', '#6a4222', 5, 1, 1, { bump: 0.6 });
  const body = new THREE.Mesh(B.roundedBox(BW + 0.16, BW + 0.16, 0.1, 0.02, 3), frameMat); body.castShadow = true; body.receiveShadow = true; body.position.set(0, 0, -0.05); board.add(body);
  const face = new THREE.Mesh(new THREE.BoxGeometry(BW, BW, 0.05), [frameMat, frameMat, frameMat, frameMat, faceMat, frameMat]);
  face.position.set(0, 0, 0.0); face.castShadow = true; face.receiveShadow = true; board.add(face);
  // corner bolts and the iron straps across the planks
  const iron = new THREE.MeshStandardMaterial({ color: 0x2c2c30, metalness: 0.8, roughness: 0.5 });
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.02, 10), iron); bolt.rotation.x = Math.PI / 2; bolt.position.set(sx * (BW / 2 + 0.04), sy * (BW / 2 + 0.04), 0.012); board.add(bolt);
  }
  // legs and the foot of the board
  const legGeo = new THREE.BoxGeometry(0.1, 1, 0.1);
  const legs = [-1, 1].map((sx) => { const m = new THREE.Mesh(legGeo, frameMat); m.castShadow = true; m.receiveShadow = true; board.add(m); m.userData.sx = sx; return m; });
  const scarMat = new THREE.MeshBasicMaterial({ color: 0x1a0d04, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const scarGeo = new THREE.PlaneGeometry(0.012, 0.075);
  const scars = [];
  W.addScar = (ux, uy, rot) => {
    const m = new THREE.Mesh(scarGeo, scarMat); m.position.set(ux * KM, -uy * KM, 0.0256); m.rotation.z = rot; board.add(m); scars.push(m);
    if (scars.length > 70) { const o = scars.shift(); board.remove(o); }
  };
  W.clearScars = () => { for (const m of scars) board.remove(m); scars.length = 0; };

  // ---- the rail trolley (Night League) ----------------------------------------------------------------------------------------------
  const rail = new THREE.Group(); root.add(rail);
  {
    const steel = new THREE.MeshStandardMaterial({ color: 0x8591a8, metalness: 0.85, roughness: 0.35 });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.1, 0.14), steel); beam.castShadow = true; rail.add(beam);
    const car = new THREE.Mesh(B.roundedBox(0.5, 0.18, 0.2, 0.03, 3), new THREE.MeshStandardMaterial({ color: 0x3f4a66, metalness: 0.6, roughness: 0.4 })); car.position.y = -0.12; car.castShadow = true; rail.add(car);
    W.railCar = car;
    for (const sx of [-0.36, 0.36]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), steel); ch.userData.sx = sx; rail.add(ch); }
  }

  // ---- the room (rebuilt per venue) -----------------------------------------------------------------------------------------------
  let roomG = null;
  const movers = [];                    // { obj, kind, a, b, c } small animated things (pennants, lantern flicker)
  let lights = [];
  function buildRoom(v, D) {
    if (roomG) { root.remove(roomG); roomG.traverse((o) => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); }); }
    movers.length = 0; for (const l of lights) scene.remove(l); lights = [];
    const th = THEME[v], g = new THREE.Group(); roomG = g; root.add(g);
    const wallM = v === 1 ? timber('logs', th.wall[0], th.wall[1], 7 + v, 3, 1.1, { bump: 1.6 }) : v === 3 ? timber('boards', '#252c3c', '#39425a', 7 + v, 5, 1, { bump: 0.5, rough: 0.55 }) : timber('boards', th.wall[0], th.wall[1], 7 + v, 5, 1);
    const darkM = timber('post', '#2c1a0c', '#4a2e16', 3, 1, 1, { bump: 0.6 });
    // floor
    const floorM = v === 2 ? timber('floor', '#6d6a45', '#8a8458', 21 + v, 8, 14, { rough: 1 }) : v === 3 ? timber('floor', '#2c313c', '#454d60', 21 + v, 5, 11, { rough: 0.5, bump: 0.6 }) : timber('floor', th.floor[0], th.floor[1], 21 + v, 3, 7, { rough: 0.75 });
    const wallZ = -D - 3.2, zf = 8, Lf = zf - wallZ;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(v === 2 ? 40 : 14, Lf), floorM); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (zf + wallZ) / 2); floor.receiveShadow = true; g.add(floor);
    // the throwing line, the foul strip and chalk X marks for the feet
    const lineM = new THREE.MeshBasicMaterial({ color: 0xf2eee0, transparent: true, opacity: 0.92 });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.07), lineM); line.rotation.x = -Math.PI / 2; line.position.set(0, 0.004, 0); g.add(line);
    const line2 = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.035), new THREE.MeshBasicMaterial({ color: 0xc8302a, transparent: true, opacity: 0.85 })); line2.rotation.x = -Math.PI / 2; line2.position.set(0, 0.004, -0.14); g.add(line2);
    const chalk = chalkTexture(THREE);
    for (const [x, z] of [[-0.55, 0.28], [0.55, 0.28], [-0.2, 0.55], [0.35, 0.5]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: chalk, transparent: true, depthWrite: false, opacity: 0.8 }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = (x * 7 + z * 3) % 1; m.position.set(x, 0.005, z); g.add(m);
    }
    // measuring marks every metre down the lane
    for (let z = 1; z < D; z++) { const t = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.012), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16 })); t.rotation.x = -Math.PI / 2; t.position.set(0, 0.004, -z); g.add(t); }

    // back wall and side walls
    if (v !== 2) {
      const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), wallM); back.position.set(0, 3, wallZ); back.receiveShadow = true; g.add(back);
      for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(Lf, 6), wallM); w.rotation.y = -sx * Math.PI / 2; w.position.set(sx * 4.4, 3, (zf + wallZ) / 2); w.receiveShadow = true; g.add(w); }
      // horizontal beams and posts
      for (const y of [0.9, 2.4, 3.9]) { const m = new THREE.Mesh(new THREE.BoxGeometry(14, 0.12, 0.1), darkM); m.position.set(0, y, wallZ + 0.06); g.add(m); }
      for (const x of [-4.2, -2.6, -1.2, 1.2, 2.6, 4.2]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 5, 0.12), darkM); m.position.set(x, 2.5, wallZ + 0.07); m.castShadow = true; g.add(m); }
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, Lf), new THREE.MeshStandardMaterial({ color: 0x1b130c, roughness: 1 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 4.6, (zf + wallZ) / 2); g.add(ceil);
      for (let z = 5; z > wallZ; z -= 1.6) { const m = new THREE.Mesh(new THREE.BoxGeometry(9, 0.2, 0.2), darkM); m.position.set(0, 4.5, z); m.castShadow = true; g.add(m); }
    } else {
      // open yard: a picket fence, a shed wall behind, trees as dark cones in the dusk
      const fenceM = timber('post', '#8d6a40', '#a98152', 17, 1, 1);
      for (let x = -7; x <= 7; x += 0.22) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.04), fenceM); p.position.set(x, 0.65, wallZ - 3); p.castShadow = true; g.add(p); }
      for (const y of [0.35, 0.95]) { const r = new THREE.Mesh(new THREE.BoxGeometry(15, 0.1, 0.06), fenceM); r.position.set(0, y, wallZ - 3.05); g.add(r); }
      const hill = new THREE.Mesh(new THREE.PlaneGeometry(60, 14), new THREE.MeshBasicMaterial({ color: 0x3a3358, fog: false })); hill.position.set(0, 7, wallZ - 22); g.add(hill);
      const treeM = new THREE.MeshStandardMaterial({ color: 0x1f2a24, roughness: 1 });
      for (let i = 0; i < 18; i++) {
        const x = -16 + i * 1.9 + Math.sin(i * 7.1) * 0.7, h = 3 + (Math.sin(i * 3.3) * 0.5 + 0.5) * 3.5, c = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.9 + h * 0.12, h, 7), treeM);
        c.position.set(x, h / 2, wallZ - 9 - (i % 3) * 2.2); c.castShadow = false; g.add(c);
      }
      // a low shed roof over the board end
      const roof = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.12, 2.0), darkM); roof.position.set(0, 2.85, -D - 0.2); roof.castShadow = true; g.add(roof);
      for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.9, 0.16), darkM); p.position.set(sx * 2.6, 1.45, -D + 0.6); p.castShadow = true; g.add(p); }
    }

    // the cage: posts and netting along both sides of the lane (a safety rule of the sport)
    const netT = netTexture(THREE); netT.repeat.set(Math.max(2, D * 0.9), 2);
    const netM = new THREE.MeshBasicMaterial({ map: netT, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.32, fog: true });
    const cageG = new THREE.Group(); g.add(cageG); W.cage = cageG;
    for (const sx of [-1, 1]) {
      const net = new THREE.Mesh(new THREE.PlaneGeometry(D + 0.5, 2.6), netM); net.rotation.y = Math.PI / 2; net.position.set(sx * 1.02, 1.3, -D / 2 + 0.1); cageG.add(net);
      for (let z = 0.2; z > -D - 0.1; z -= 1.3) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.7, 8), new THREE.MeshStandardMaterial({ color: 0x23262e, metalness: 0.6, roughness: 0.5 })); p.position.set(sx * 1.02, 1.35, z); p.castShadow = true; cageG.add(p); }
    }

    // lanterns and string lights
    lights = [];
    const lanMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffa63c, emissiveIntensity: 2.2, roughness: 0.6 });
    const nLan = th.lanterns;
    for (let i = 0; i < nLan; i++) {
      const x = nLan === 1 ? 0 : -2.8 + (5.6 * i) / (nLan - 1), z = -D * (0.35 + 0.65 * (i % 2)), y = v === 2 ? 2.6 : 3.4 - (i % 2) * 0.3;
      const gr = new THREE.Group(); gr.position.set(x, y, v === 2 ? -D * 0.2 - i * 0.2 : z);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), lanMat); gr.add(lamp);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.15, 0.1, 10), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 })); cap.position.y = 0.12; gr.add(cap);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.2, 4), new THREE.MeshBasicMaterial({ color: 0x111111 })); cord.position.y = 0.72; gr.add(cord);
      addGlow(gr, 0, 0, 0, 0xffb85a, 1.4, 0.7);
      g.add(gr); movers.push({ obj: gr, kind: 'sway', a: 0.04 + 0.01 * i, b: i * 1.3 });
    }
    if (v === 2) {
      // pennants on a string over the lane; they stream with the wind the sim is using
      const cols = [0xd8453a, 0xf0c04a, 0x2f8fd0, 0xf6f0de, 0x3aa87a];
      const strand = new THREE.Group(); g.add(strand);
      for (let i = 0; i < 14; i++) {
        const x = -2.6 + i * 0.4, m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.3), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, roughness: 0.8 }));
        m.geometry.translate(0, -0.15, 0); m.position.set(x, 3.0 - 0.1 * Math.sin((i / 13) * Math.PI), -D * 0.5 - 0.2); strand.add(m); movers.push({ obj: m, kind: 'pennant', a: 1, b: i * 0.7 });
      }
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 5.6, 4), new THREE.MeshBasicMaterial({ color: 0x1a1a1a })); cord.rotation.z = Math.PI / 2; cord.position.set(0, 3.0, -D * 0.5 - 0.2); strand.add(cord);
    }
    if (v === 3) {
      // spotlights over the lane, neon strips on the walls
      for (const x of [-1.4, 0, 1.4]) {
        const sp = new THREE.SpotLight(0xdfe8ff, 26, 16, 0.5, 0.6, 1.5); sp.position.set(x, 4.2, -D * 0.45); sp.target.position.set(0, YC, -D); scene.add(sp, sp.target); lights.push(sp, sp.target);
        const can = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.24, 12), new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: 0.7, roughness: 0.4 })); can.position.set(x, 4.3, -D * 0.45); g.add(can);
        addGlow(g, x, 4.15, -D * 0.45, 0xdfeaff, 0.9, 0.9);
      }
      for (const [col, y] of [[0x35c9b6, 3.0], [0x7d86d6, 2.7]]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: col, fog: false })); m.position.set(0, y, wallZ + 0.1); g.add(m);
        addGlow(g, -2.8, y, wallZ + 0.2, col, 1.2, 0.5); addGlow(g, 2.8, y, wallZ + 0.2, col, 1.2, 0.5);
      }
    }
    if (v === 0) {
      // daylight pouring in through a wide opening on the right: a soft light shaft
      const shaft = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 6), new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      shaft.position.set(2.2, 2.6, -D * 0.5); shaft.rotation.set(0, -0.5, 0.18); g.add(shaft);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.9), new THREE.MeshBasicMaterial({ color: 0xfff0c8, fog: false })); win.position.set(3.2, 2.2, wallZ + 0.04); g.add(win);
      for (const dx of [-0.65, 0.65]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.9, 0.06), darkM); m.position.set(3.2 + dx, 2.2, wallZ + 0.08); g.add(m); }
      // stacked logs and an axe-rack by the wall
      const logM = timber('post', '#8a6234', '#a97c46', 31, 1, 1);
      for (let r = 0; r < 3; r++) for (let c2 = 0; c2 < 4 - r; c2++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.3, 10), logM); m.rotation.z = Math.PI / 2; m.position.set(-3.1 + c2 * 0.26 + r * 0.13, 0.13 + r * 0.22, wallZ + 0.5); m.castShadow = true; g.add(m); }
    }
    // a bar counter with stools along the right wall (a few seated spectators sit on them in the crowd)
    if (v !== 2) {
      const bar = new THREE.Mesh(B.roundedBox(0.7, 1.05, 3.0, 0.03, 2), darkM); bar.position.set(3.35, 0.52, -D - 1.6); bar.castShadow = true; bar.receiveShadow = true; g.add(bar);
      const top = new THREE.Mesh(B.roundedBox(0.9, 0.06, 3.2, 0.02, 2), timber('post', '#7a4a24', '#9a6a38', 9, 1, 1)); top.position.set(3.3, 1.07, -D - 1.6); top.castShadow = true; g.add(top);
      for (let i = 0; i < 4; i++) {
        const st = new THREE.Group(); st.position.set(2.6, 0, -D - 1.6 - 1.1 + i * 0.75);
        const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 16), darkM); seat.position.y = 0.72; st.add(seat);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.7, 8), darkM); leg.position.y = 0.35; st.add(leg);
        g.add(st);
      }
      // bottles and mugs with a glint
      const glass = new THREE.MeshStandardMaterial({ color: 0x4a8a50, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.85 });
      for (let i = 0; i < 6; i++) { const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.22, 10), glass); b2.position.set(3.3 + (i % 2) * 0.15, 1.2, -D - 1.6 - 1.2 + i * 0.45); g.add(b2); }
    }
    // the floor stays dim far away; a soft blob under the board
    return g;
  }

  // legs and rail geometry follow the board height
  const placeBoard = (D) => {
    root.position.set(0, 0, 0);
    board.position.set(0, YC, -D);
    for (const l of legs) { l.scale.y = YC - 0.06; l.position.set(l.userData.sx * (BW / 2 + 0.04), -(YC - 0.06) / 2 + 0.0, -0.1); }
    rail.position.set(0, YC + 1.2, -D - 0.12);
    for (const c of rail.children) if (c.userData.sx !== undefined) { c.scale.y = 0.9; c.position.set(c.userData.sx, -0.55, 0.0); }
  };

  W.setVenue = (v) => {
    if (W.venue === v) return;
    W.venue = v; W.dist = DIST[v]; W.th = THEME[v];
    buildRoom(v, W.dist); placeBoard(W.dist);
    rail.visible = v === 3;
    for (const l of legs) l.visible = v !== 3;
    const th = THEME[v], L = stage.lights, R = stage.renderer;
    scene.background = new THREE.Color(th.bg); scene.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);
    L.hemi.color.set(th.hemiSky); L.hemi.groundColor.set(th.hemiGround); L.hemi.intensity = th.hemi;
    L.key.color.set(th.key); L.key.intensity = th.keyI; L.rim.color.set(th.rim); L.rim.intensity = th.rimI;
    R.toneMappingExposure = th.exposure; scene.environmentIntensity = th.env;
    stage.invalidate();
  };

  // each frame: the board slides on its rail (Night League), the lanterns sway, the pennants stream
  W.update = (t, { wind = 0, boardX = 0 } = {}) => {
    board.position.x = boardX * KM;
    rail.position.x = boardX * KM;
    if (W.railCar) W.railCar.position.x = 0;
    for (const m of movers) {
      if (m.kind === 'sway') { m.obj.rotation.z = Math.sin(t * 0.9 + m.b) * m.a; m.obj.rotation.x = Math.cos(t * 0.7 + m.b) * m.a * 0.6; }
      else if (m.kind === 'pennant') { const w = Math.max(-1, Math.min(1, wind / 90)); m.obj.rotation.z = -w * 0.9 + Math.sin(t * 6 + m.b) * (0.08 + Math.abs(w) * 0.25); m.obj.rotation.y = Math.sin(t * 3 + m.b) * 0.3; }
    }
  };
  W.board = board; W.face = face; W.root = root; W.addGlow = addGlow; W.glowTex = glowTex;
  void hi; void lo;
  return W;
}

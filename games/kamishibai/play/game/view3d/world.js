// The street corner at dusk: sky dome with first stars, packed-earth street, two rows of timber shopfronts with lit paper windows and noren,
// strings of paper lanterns across the road, a telephone pole with wires, far rooftops, and soft bokeh lights down the street.
// Metres; origin = the middle of the picture card on the storyteller's box; ground is at y = GY. Presentation only, nothing reads the sim.
import { THREE } from '../vendor3d/index.js';

export const GY = -1.12;          // ground height relative to the card centre (the box rides on a bicycle carrier at about 0.95 m)
const TAU = Math.PI * 2;
let seed = 11;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const reseed = (s) => { seed = s >>> 0; };

export function canvasTex(w, h, draw, { repeat = null, srgb = true, aniso = 4 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso;
  return t;
}
const mk = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };

// ---- sky ----------------------------------------------------------------------------------------------------------------------------
function skyTexture() {
  return canvasTex(1024, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#0e0c2a'); gr.addColorStop(0.28, '#231d52'); gr.addColorStop(0.5, '#5a3a7a'); gr.addColorStop(0.64, '#b0587a'); gr.addColorStop(0.76, '#ee8a64'); gr.addColorStop(0.86, '#ffc07a'); gr.addColorStop(1, '#ffd9a0');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    reseed(5);
    for (let i = 0; i < 190; i++) { const y = rnd() * h * 0.5, a = 0.25 + rnd() * 0.7 * (1 - y / (h * 0.5)); g.fillStyle = `rgba(255,248,226,${a})`; g.beginPath(); g.arc(rnd() * w, y, 0.5 + rnd() * 1.1, 0, TAU); g.fill(); }
    // long dusk clouds
    for (let i = 0; i < 9; i++) {
      const y = h * (0.52 + rnd() * 0.2), x = rnd() * w, L = 160 + rnd() * 260;
      const cg = g.createLinearGradient(x, 0, x + L, 0); cg.addColorStop(0, 'rgba(255,140,120,0)'); cg.addColorStop(0.5, `rgba(255,150,130,${0.14 + rnd() * 0.16})`); cg.addColorStop(1, 'rgba(255,140,120,0)');
      g.fillStyle = cg; g.beginPath(); g.ellipse(x + L / 2, y, L / 2, 5 + rnd() * 9, 0, 0, TAU); g.fill();
    }
    // moon
    const mx = w * 0.62, my = h * 0.2, mg = g.createRadialGradient(mx, my, 0, mx, my, 60); mg.addColorStop(0, 'rgba(255,248,220,0.9)'); mg.addColorStop(0.18, 'rgba(255,240,200,0.6)'); mg.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = mg; g.beginPath(); g.arc(mx, my, 60, 0, TAU); g.fill();
    g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(mx, my, 11, 0, TAU); g.fill();
  }, { aniso: 1 });
}

// ---- ground ---------------------------------------------------------------------------------------------------------------------------
function groundTexture() {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#4b3b34'; g.fillRect(0, 0, w, h);
    reseed(21);
    for (let i = 0; i < 2600; i++) { const x = rnd() * w, y = rnd() * h, r = 5 + rnd() * 12, v = 56 + rnd() * 54; g.fillStyle = `rgba(${v + 12},${v},${v - 6},${0.5 + rnd() * 0.4})`; g.beginPath(); g.ellipse(x, y, r, r * (0.6 + rnd() * 0.35), rnd() * 3, 0, TAU); g.fill(); g.strokeStyle = 'rgba(15,10,10,0.35)'; g.lineWidth = 1; g.stroke(); }
    for (let i = 0; i < 22; i++) { const x = rnd() * w, y = rnd() * h, r = 24 + rnd() * 60, pg = g.createRadialGradient(x, y, 0, x, y, r); pg.addColorStop(0, 'rgba(120,90,110,0.55)'); pg.addColorStop(1, 'rgba(120,90,110,0)'); g.fillStyle = pg; g.beginPath(); g.ellipse(x, y, r, r * 0.5, rnd() * 3, 0, TAU); g.fill(); }
    const id = g.getImageData(0, 0, w, h);
    for (let i = 0; i < id.data.length; i += 4) { const n = (rnd() - 0.5) * 18; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
    g.putImageData(id, 0, 0);
  }, { repeat: [16, 16], aniso: 6 });
}

// ---- shopfront facades ----------------------------------------------------------------------------------------------------------------
// One 512 x 512 picture per variant: timber lattice and boards below, plaster above with a lit paper window, a noren curtain, a tile eave.
// Returns { map, emissive } (the second only carries the lit parts, so the street glows without lighting everything).
function facade(variant) {
  const W = 512, H = 512;
  const mk2 = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const a = mk2(), e = mk2(), g = a.getContext('2d'), ge = e.getContext('2d');
  reseed(variant * 131 + 7);
  const plaster = ['#cdb995', '#b9a888', '#d6c6a4', '#bfae92'][variant % 4], timber = ['#4a3322', '#3b2a1e', '#553a26'][variant % 3];
  g.fillStyle = timber; g.fillRect(0, 0, W, H);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  // plaster band (upper) and boards (lower)
  g.fillStyle = plaster; g.fillRect(0, 70, W, 190);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,250,235' : '60,45,30'},${0.04 + rnd() * 0.08})`; g.fillRect(rnd() * W, 70 + rnd() * 190, 2 + rnd() * 6, 1 + rnd() * 3); }
  g.strokeStyle = timber; g.lineWidth = 8; g.strokeRect(4, 70, W - 8, 190);
  for (let x = 128; x < W; x += 128) { g.fillStyle = timber; g.fillRect(x - 5, 70, 10, 190); }
  // eave (tile roof edge)
  g.fillStyle = '#23262f'; g.fillRect(0, 0, W, 54);
  for (let x = 0; x < W; x += 16) { g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x, 0, 2, 54); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 8, 0, 2, 54); }
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 54, W, 16);
  // lit paper windows in the plaster (shoji grid)
  const wins = variant % 2 ? [[40, 100, 140, 130], [330, 100, 140, 130]] : [[170, 100, 170, 130]];
  for (const [x, y, w, h] of wins) {
    const warm = rnd() < 0.7 ? '#ffd48a' : '#ffe9b8';
    g.fillStyle = warm; g.fillRect(x, y, w, h); ge.fillStyle = warm; ge.fillRect(x, y, w, h);
    g.strokeStyle = '#3a2718'; ge.strokeStyle = '#000'; g.lineWidth = ge.lineWidth = 5; g.strokeRect(x, y, w, h); ge.strokeRect(x, y, w, h);
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x + (w * i) / 4, y); g.lineTo(x + (w * i) / 4, y + h); g.stroke(); ge.beginPath(); ge.moveTo(x + (w * i) / 4, y); ge.lineTo(x + (w * i) / 4, y + h); ge.stroke(); }
    for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(x, y + (h * i) / 3); g.lineTo(x + w, y + (h * i) / 3); g.stroke(); ge.beginPath(); ge.moveTo(x, y + (h * i) / 3); ge.lineTo(x + w, y + (h * i) / 3); ge.stroke(); }
    // a figure's shadow behind the paper, now and then
    if (rnd() < 0.5) { g.fillStyle = 'rgba(70,40,20,0.45)'; g.beginPath(); g.ellipse(x + w * 0.5, y + h * 0.5, 12, 17, 0, 0, TAU); g.fill(); g.fillRect(x + w * 0.5 - 20, y + h * 0.5 + 8, 40, h * 0.5); ge.fillStyle = 'rgba(0,0,0,0.5)'; ge.beginPath(); ge.ellipse(x + w * 0.5, y + h * 0.5, 12, 17, 0, 0, TAU); ge.fill(); }
  }
  // ground floor: sliding lattice doors
  g.fillStyle = '#2f2118'; g.fillRect(0, 262, W, 250);
  for (let d = 0; d < 4; d++) {
    const x = d * 128 + 6, w = 116, y = 276, h = 220;
    g.fillStyle = '#3d2a1c'; g.fillRect(x, y, w, h);
    g.strokeStyle = '#6b4a2e'; g.lineWidth = 3;
    for (let i = 0; i <= 5; i++) { g.beginPath(); g.moveTo(x + (w * i) / 5, y); g.lineTo(x + (w * i) / 5, y + h * 0.62); g.stroke(); }
    for (let j = 0; j <= 6; j++) { g.beginPath(); g.moveTo(x, y + (h * 0.62 * j) / 6); g.lineTo(x + w, y + (h * 0.62 * j) / 6); g.stroke(); }
    // warm glow through the lattice of one or two doors
    if ((d + variant) % 3 === 0) { g.fillStyle = 'rgba(255,200,120,0.5)'; g.fillRect(x + 3, y + 3, w - 6, h * 0.62 - 6); ge.fillStyle = 'rgba(255,190,100,0.55)'; ge.fillRect(x + 3, y + 3, w - 6, h * 0.62 - 6); }
    g.fillStyle = '#4a3322'; g.fillRect(x, y + h * 0.62, w, h * 0.38);
    for (let i = 1; i < 4; i++) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + (w * i) / 4, y + h * 0.62, 2, h * 0.38); }
  }
  // noren curtain over one door
  const nx = ((variant + 1) % 4) * 128 + 10;
  const nc = ['#27396a', '#6a2430', '#2a5a52'][variant % 3];
  g.fillStyle = nc; g.fillRect(nx, 262, 108, 92);
  for (let s = 0; s < 3; s++) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(nx + 36 * (s + 1) - 1, 262, 2, 92); }
  g.fillStyle = 'rgba(255,255,255,0.88)'; g.beginPath(); g.arc(nx + 54, 308, 17, 0, TAU); g.fill();
  g.fillStyle = nc; g.beginPath(); g.arc(nx + 54, 308, 9, 0, TAU); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 500, W, 12);
  const mapT = new THREE.CanvasTexture(a); mapT.colorSpace = THREE.SRGBColorSpace; mapT.anisotropy = 4;
  const emT = new THREE.CanvasTexture(e); emT.colorSpace = THREE.SRGBColorSpace;
  return { map: mapT, emissive: emT };
}

// ---- paper lantern (chochin): ribbed body, black caps; emissive so it glows without a light --------------------------------------------
let LANTERN_GEO = null;
function lanternParts() {
  if (LANTERN_GEO) return LANTERN_GEO;
  const prof = []; const H = 0.30, R = 0.095;
  for (let i = 0; i <= 14; i++) { const t = i / 14, y = -H / 2 + 0.03 + t * (H - 0.06), r = R * (0.62 + 0.38 * Math.sin(Math.PI * (0.08 + 0.84 * t))) ; prof.push(new THREE.Vector2(r, y)); }
  const body = new THREE.LatheGeometry(prof, 20);
  const cap = new THREE.CylinderGeometry(0.052, 0.058, 0.032, 14);
  const tex = canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = '#ffd9a8'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(150,60,30,0.55)'; g.lineWidth = 2;
    for (let y = 8; y < h; y += 17) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = 'rgba(190,40,30,0.0)'; g.fillRect(0, 0, w, h);
  }, { repeat: [3, 1], aniso: 2 });
  LANTERN_GEO = { body, cap, tex };
  return LANTERN_GEO;
}
export function makeLantern(color = '#ff9a3c', scale = 1) {
  const P = lanternParts();
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#ffe2b8', map: P.tex, emissive: new THREE.Color(color), emissiveMap: P.tex, emissiveIntensity: 1.5, roughness: 0.7, metalness: 0, side: THREE.DoubleSide });
  const body = new THREE.Mesh(P.body, mat);
  const capM = new THREE.MeshStandardMaterial({ color: '#1a1412', roughness: 0.5, metalness: 0.1 });
  const top = new THREE.Mesh(P.cap, capM); top.position.y = 0.15;
  const bot = new THREE.Mesh(P.cap, capM); bot.position.y = -0.15;
  const cord = mk(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 5), capM, 0, 0.225, 0);
  g.add(body, top, bot, cord);
  g.scale.setScalar(scale);
  g.userData.mat = mat; g.userData.body = body;
  return g;
}

function softDisc(rgb, a = 1) {
  return canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.35, `rgba(${rgb},${a * 0.55})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, w, w); }, { aniso: 1 });
}
function bokehDisc(rgb) {
  return canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, `rgba(${rgb},0.55)`); gr.addColorStop(0.78, `rgba(${rgb},0.7)`); gr.addColorStop(0.92, `rgba(${rgb},0.9)`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, w, w); }, { aniso: 1 });
}

// ---- the world ----------------------------------------------------------------------------------------------------------------------
export function buildWorld({ quality = 'high' } = {}) {
  const group = new THREE.Group(); group.name = 'world';
  const lanterns = [];       // { g, ph }
  const lights = [];         // { l, base, ph }
  const sprites = [];        // bokeh { s, base, ph }
  const q = quality;

  // sky
  const sky = mk(new THREE.SphereGeometry(80, 32, 16), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.rotation.y = Math.PI; sky.renderOrder = -10; sky.userData.follow = true;
  group.add(sky);

  // ground
  const gm = new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.9, metalness: 0.0 });
  const ground = mk(new THREE.PlaneGeometry(120, 120), gm, 0, GY, -30); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  group.add(ground);

  // street rows: left (x < 0) and right (x > 0), the picture faces the street
  const rows = new THREE.Group(); group.add(rows);
  const facs = [0, 1, 2, 3].map((v) => facade(v));
  const roofMat = new THREE.MeshStandardMaterial({ color: '#2a2d38', roughness: 0.6, metalness: 0.1 });
  const plain = new THREE.MeshStandardMaterial({ color: '#2b211c', roughness: 0.95 });
  reseed(91);
  let zc = 1.2;
  for (let i = 0; i < 9; i++) {
    const depth = 3.2 + rnd() * 1.8;
    for (const side of [-1, 1]) {
      const f = facs[(i + (side > 0 ? 2 : 0)) % 4];
      const h = 4.6 + rnd() * 1.4, w = 4.4;
      const x = side * (2.9 + w / 2), z = -zc - depth / 2 - (side > 0 ? 0.6 : 0);
      const face = new THREE.MeshStandardMaterial({ map: f.map, emissive: new THREE.Color('#ffffff'), emissiveMap: f.emissive, emissiveIntensity: 1.1, roughness: 0.85 });
      const mats = [plain, plain, plain, plain, plain, plain];
      mats[side < 0 ? 0 : 1] = face;
      const b = mk(new THREE.BoxGeometry(w, h, depth), mats, x, GY + h / 2, z);
      // map the facade across the length (z) of the building: BoxGeometry side faces use (z,y) uv already
      b.castShadow = false; b.receiveShadow = true;
      rows.add(b);
      // gabled tile roof: a triangular prism along z
      const roof = mk(new THREE.CylinderGeometry(w * 0.62, w * 0.62, depth + 0.5, 3, 1, false), roofMat, x, GY + h + 0.35, z);
      roof.rotation.set(-Math.PI / 2, 0, 0); roof.scale.set(1, 1, 0.34);
      rows.add(roof);
      // eave overhang toward the street
      const eave = mk(new THREE.BoxGeometry(0.9, 0.12, depth + 0.3), roofMat, x - side * (w / 2 + 0.28), GY + h * 0.58, z);
      rows.add(eave);
    }
    zc += depth;
  }
  // a dead end: a plastered wall with a gate glow at the far end of the street
  const end = mk(new THREE.PlaneGeometry(40, 14), new THREE.MeshBasicMaterial({ color: '#1a1530', fog: false }), 0, GY + 7, -zc - 4);
  group.add(end);

  // telephone pole + wires
  const poleMat = new THREE.MeshStandardMaterial({ color: '#3a3028', roughness: 0.9 });
  const mkPole = (x, z) => {
    const p = new THREE.Group();
    p.add(mk(new THREE.CylinderGeometry(0.07, 0.11, 7.4, 8), poleMat, 0, GY + 3.7, 0));
    p.add(mk(new THREE.BoxGeometry(1.5, 0.08, 0.08), poleMat, 0, GY + 6.6, 0));
    p.add(mk(new THREE.BoxGeometry(1.1, 0.07, 0.07), poleMat, 0, GY + 6.0, 0));
    for (const dx of [-0.6, -0.2, 0.2, 0.6]) p.add(mk(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 6), new THREE.MeshStandardMaterial({ color: '#cfc7b0', roughness: 0.4 }), dx, GY + 6.7, 0));
    p.position.set(x, 0, z);
    return p;
  };
  const poles = [mkPole(2.35, -3.2), mkPole(2.35, -16), mkPole(2.35, -30)];
  poles.forEach((p) => group.add(p));
  const wireMat = new THREE.LineBasicMaterial({ color: '#0d0c14' });
  for (let w = 0; w < 4; w++) {
    const dx = -0.6 + w * 0.4;
    for (let s = 0; s < 2; s++) {
      const pts = [], z0 = s === 0 ? -3.2 : -16, z1 = s === 0 ? -16 : -30;
      for (let i = 0; i <= 18; i++) { const t = i / 18; pts.push(new THREE.Vector3(2.35 + dx, GY + 6.7 - Math.sin(Math.PI * t) * 0.55, z0 + (z1 - z0) * t)); }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
    }
  }

  // lantern strings across the street (catenary), three of them; the nearest is above and in front of the box
  const stringZ = [-1.0, -4.2, -8.0, -13.0];
  reseed(4);
  stringZ.forEach((z, si) => {
    const n = si === 0 ? 5 : 7, y0 = GY + 3.15, span = 3.1;
    const pts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24, x = -span + 2 * span * t; pts.push(new THREE.Vector3(x, y0 - Math.sin(Math.PI * t) * 0.42, z)); }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#17121a' })));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = -span + 2 * span * t, y = y0 - Math.sin(Math.PI * t) * 0.42 - 0.2;
      const col = (i + si) % 4 === 0 ? '#ff6a3c' : '#ff9a3c';
      const L = makeLantern(col, 1.05 - si * 0.04);
      L.position.set(x, y, z);
      group.add(L);
      lanterns.push({ g: L, ph: rnd() * 6, base: 1.3 + rnd() * 0.4 });
    }
  });

  // real lights: warm lantern lights close to the box (cheap: three point lights, no shadows)
  const mkLight = (x, y, z, c, I, d) => { const l = new THREE.PointLight(c, I, d, 1.6); l.position.set(x, y, z); group.add(l); lights.push({ l, base: I, ph: rnd() * 6 }); return l; };
  mkLight(-1.2, GY + 2.6, 0.9, '#ffb060', 2.6, 8);
  mkLight(1.4, GY + 2.5, 0.6, '#ffa050', 2.2, 8);
  mkLight(0, GY + 2.2, -4, '#ff9a50', 1.8, 10);

  // bokeh: far lanterns and shop lights, big soft discs (a cheap depth-of-field)
  const discs = [bokehDisc('255,176,90'), bokehDisc('255,120,70'), bokehDisc('255,214,150'), bokehDisc('150,190,255')];
  const nb = q === 'low' ? 14 : 34;
  reseed(33);
  for (let i = 0; i < nb; i++) {
    const z = -6 - rnd() * 26, x = (rnd() - 0.5) * 7, y = GY + 0.5 + rnd() * 3.8, sz = 0.35 + rnd() * 0.9 * (1 + (-z - 6) / 24);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: discs[rnd() < 0.6 ? 0 : rnd() < 0.5 ? 1 : rnd() < 0.7 ? 2 : 3], transparent: true, opacity: 0.22 + rnd() * 0.25, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.position.set(x, y, z); s.scale.set(sz, sz, 1); s.renderOrder = 1;
    group.add(s); sprites.push({ s, base: s.material.opacity, ph: rnd() * 6 });
  }

  // a warm pool of light on the street in front of the box
  const pool = mk(new THREE.PlaneGeometry(5.5, 5.5), new THREE.MeshBasicMaterial({ map: softDisc('255,176,90', 0.55), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 0, GY + 0.01, 0.4);
  pool.rotation.x = -Math.PI / 2; pool.renderOrder = 1;
  group.add(pool);

  // cherry blossom petals / paper scraps drifting in the lantern light are done as particles by the presenter
  return {
    group, lanterns, lights, sprites, sky,
    update(t, dt, wind = 0.4) {
      for (const L of lanterns) {
        L.g.rotation.z = Math.sin(t * 0.9 + L.ph) * 0.045 * (0.5 + wind);
        L.g.rotation.x = Math.sin(t * 0.7 + L.ph * 1.7) * 0.03 * (0.5 + wind);
        const f = 0.9 + 0.1 * Math.sin(t * 9 + L.ph * 3) * Math.sin(t * 3.1 + L.ph);
        L.g.userData.mat.emissiveIntensity = L.base * f;
      }
      for (const l of lights) l.l.intensity = l.base * (0.92 + 0.08 * Math.sin(t * 7.3 + l.ph) + 0.04 * Math.sin(t * 13 + l.ph * 2));
      for (const b of sprites) b.s.material.opacity = b.base * (0.85 + 0.15 * Math.sin(t * 1.3 + b.ph));
    },
    dispose() { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); },
  };
}

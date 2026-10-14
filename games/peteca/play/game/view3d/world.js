// The beach court world: scenery3d backdrop, a raked sand (or paved) court with tape lines, the net with posts and a rippling mesh,
// palms, umbrellas, lamps and the small furniture of a Brazilian beach. Pure presentation: nothing here reads or writes the simulation.
// World axes: x = court length (sim x - 6), y up, z = towards the camera. The net is at x = 0, the court spans x -6..6 and z -3..3.
import { THREE, buildScenery } from '../vendor3d/index.js';

const HALF_L = 6, HALF_W = 3;
let seedv = 17;
const rnd = () => (seedv = (seedv * 1664525 + 1013904223) >>> 0) / 4294967296;
const reseed = (s) => { seedv = s >>> 0; };
const mk = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
const lamb = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o });
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });

function canvasTex(w, h, draw, { repeat = null, aniso = 8, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso;
  return t;
}

// ---- courts (the three the player can unlock) -------------------------------------------------------------------------------------
export const COURT_STYLE = [
  { id: 0, tod: 'day', sand: ['#efcf8e', '#d9b070'], line: '#fffdf3', key: '#fff1d6', keyI: 2.5, hemiSky: '#cfe6ff', hemiGround: '#d9bd8a', hemi: 0.8, rim: '#bfe0ff', rimI: 1.1, exposure: 0.95 },
  { id: 1, tod: 'dawn', stone: true, sand: ['#d9d0bc', '#b9ae94'], line: '#ffffff', key: '#ffe9c4', keyI: 3.0, hemiSky: '#e8dcc6', hemiGround: '#a89c80', hemi: 1.0, rim: '#ffd9a8', rimI: 1.2, exposure: 1.02 },
  { id: 2, tod: 'dusk', sand: ['#d6a98a', '#a8786e'], line: '#fff0de', key: '#ffad6a', keyI: 3.0, hemiSky: '#9a7aa6', hemiGround: '#6e4a52', hemi: 0.9, rim: '#7fb0ff', rimI: 1.5, exposure: 1.08 },
];

// ---- procedural props --------------------------------------------------------------------------------------------------------------
function frondTexture() {
  return canvasTex(256, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#3f8a3a'; g.fillRect(0, h * 0.47, w, h * 0.06);
    for (let i = 0; i < 46; i++) {
      const x = 6 + (i / 46) * (w - 20), L = h * 0.5 * (1 - Math.pow(i / 46, 2.2) * 0.8);
      g.strokeStyle = i % 2 ? '#2f7a30' : '#3f9a3a'; g.lineWidth = 2.4;
      for (const sgn of [-1, 1]) { g.beginPath(); g.moveTo(x, h / 2); g.quadraticCurveTo(x + 7, h / 2 + sgn * L * 0.55, x + 20, h / 2 + sgn * L); g.stroke(); }
    }
  }, { aniso: 4 });
}
let FROND_MAT = null;
export function makePalm(h = 6, lean = 0.35, seed = 1) {
  const g = new THREE.Group();
  reseed(seed * 977);
  // trunk: a tapered, curved tube with ring marks
  const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector3(Math.sin(t * 1.5) * lean * h * 0.25, t * h, 0)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tg = new THREE.TubeGeometry(curve, 24, 0.17, 8, false);
  const pos = tg.attributes.position, col = [];
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), r = 0.8 + 0.2 * Math.sin(y * 9); const k = 0.5 * r; col.push(0.46 * k + 0.2, 0.36 * k + 0.16, 0.26 * k + 0.1); }
  tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const trunk = mk(tg, new THREE.MeshLambertMaterial({ vertexColors: true })); g.add(trunk);
  // crown of fronds
  if (!FROND_MAT) FROND_MAT = new THREE.MeshLambertMaterial({ map: frondTexture(), alphaTest: 0.35, side: THREE.DoubleSide, color: '#ffffff' });
  const crown = new THREE.Group(); const top = pts[pts.length - 1];
  crown.position.copy(top); g.add(crown);
  const n = 11;
  for (let i = 0; i < n; i++) {
    const L = 2.3 + rnd() * 0.5, seg = 8;
    const gp = [], uv = [], idx = [];
    for (let s = 0; s <= seg; s++) {
      const t = s / seg, x = t * L, y = Math.sin(t * 2.2) * 0.65 - t * t * 0.9, w = 0.5 * (1 - t * 0.55);
      gp.push(x, y, -w, x, y, w); uv.push(t, 0, t, 1);
      if (s < seg) { const a = s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); fg.setIndex(idx); fg.computeVertexNormals();
    const f = mk(fg, FROND_MAT); f.rotation.y = (i / n) * Math.PI * 2 + rnd() * 0.3; f.rotation.z = 0.2 + rnd() * 0.5; f.userData.ph = rnd() * 6;
    crown.add(f);
  }
  // coconuts
  const nutM = lamb('#5a4020');
  for (let i = 0; i < 4; i++) { const nu = mk(new THREE.SphereGeometry(0.1, 8, 6), nutM, Math.cos(i * 1.6) * 0.18, -0.12, Math.sin(i * 1.6) * 0.18); crown.add(nu); }
  g.userData.crown = crown;
  g.userData.sway = (t, wind) => { crown.rotation.z = Math.sin(t * 0.8 + seed) * 0.025 * (0.6 + wind); crown.rotation.x = Math.sin(t * 0.63 + seed * 2) * 0.02; crown.children.forEach((f) => { if (f.userData.ph !== undefined) f.rotation.x = Math.sin(t * 1.7 + f.userData.ph) * 0.05 * (0.6 + wind); }); };
  return g;
}

export function makeUmbrella(c1 = '#e8392c', c2 = '#ffffff', tilt = 0.12, r = 1.15) {
  const g = new THREE.Group();
  const seg = 12, cols = [];
  const geo = new THREE.CylinderGeometry(0.03, r, 0.42, seg, 1, true);
  geo.translate(0, 2.1, 0);
  const pos = geo.attributes.position; const cc = new THREE.Color();
  // stripes by angle
  for (let i = 0; i < pos.count; i++) { const a = Math.atan2(pos.getZ(i), pos.getX(i)); const s = Math.floor(((a + Math.PI) / (Math.PI * 2)) * seg + 0.001) % 2; cc.set(s ? c2 : c1); cols.push(cc.r, cc.g, cc.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const canopy = mk(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  const pole = mk(new THREE.CylinderGeometry(0.022, 0.026, 2.25, 6), lamb('#d8d4cc'), 0, 1.12, 0);
  const tip = mk(new THREE.SphereGeometry(0.045, 8, 6), lamb('#c9c4ba'), 0, 2.33, 0);
  g.add(canopy, pole, tip); g.rotation.z = tilt;
  return g;
}

export function makeBench(len = 1.6, c = '#8a5a34') {
  const g = new THREE.Group(); const m = lamb(c), d = lamb('#3c2a1a');
  g.add(mk(new THREE.BoxGeometry(len, 0.05, 0.42), m, 0, 0.45, 0));
  g.add(mk(new THREE.BoxGeometry(len, 0.4, 0.05), m, 0, 0.75, -0.2));
  for (const sx of [-1, 1]) g.add(mk(new THREE.BoxGeometry(0.06, 0.45, 0.4), d, sx * (len / 2 - 0.1), 0.22, 0));
  return g;
}

export function makeLamp(h = 3.4, warm = '#ffd9a0') {
  const g = new THREE.Group();
  g.add(mk(new THREE.CylinderGeometry(0.045, 0.06, h, 8), lamb('#2c3036'), 0, h / 2, 0));
  g.add(mk(new THREE.CylinderGeometry(0.18, 0.12, 0.08, 10), lamb('#2c3036'), 0, h, 0));
  const bulb = mk(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshBasicMaterial({ color: warm }), 0, h + 0.14, 0);
  g.add(bulb);
  g.userData.bulb = bulb;
  return g;
}

export function makeLifeguardTower() {
  const g = new THREE.Group(); const wood = lamb('#e9e2d2'), red = lamb('#d8402e'), post = lamb('#b88f5a');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mk(new THREE.BoxGeometry(0.12, 2.0, 0.12), post, sx * 0.7, 1.0, sz * 0.7));
  g.add(mk(new THREE.BoxGeometry(1.7, 0.1, 1.7), wood, 0, 2.0, 0));
  g.add(mk(new THREE.BoxGeometry(1.5, 1.0, 1.5), wood, 0, 2.6, 0));
  g.add(mk(new THREE.BoxGeometry(1.9, 0.12, 1.9), red, 0, 3.15, 0));
  g.add(mk(new THREE.BoxGeometry(0.5, 0.45, 0.02), lamb('#79c4e8'), 0, 2.7, 0.76));
  const step = mk(new THREE.BoxGeometry(0.5, 0.04, 0.3), wood, 0.2, 0.3, 1.0); step.rotation.x = 0.5; g.add(step);
  g.add(mk(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 5), lamb('#ccc'), -0.6, 3.8, -0.6));
  const flag = mk(new THREE.PlaneGeometry(0.5, 0.32), new THREE.MeshLambertMaterial({ color: '#f0b000', side: THREE.DoubleSide }), -0.35, 4.2, -0.6); g.add(flag);
  g.userData.flag = flag;
  return g;
}

export function makeSurfboard(c = '#2fa6c9') {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.5, 12, 10); geo.scale(0.26, 1, 0.05);
  const m = mk(geo, lamb(c), 0, 1.0, 0); g.add(m);
  const st = mk(new THREE.BoxGeometry(0.02, 1.6, 0.02), lamb('#fff'), 0, 1.0, 0.04); g.add(st);
  g.rotation.z = 0.08;
  return g;
}

export function makeCooler(c = '#d8402e') {
  const g = new THREE.Group();
  g.add(mk(new THREE.BoxGeometry(0.6, 0.34, 0.36), lamb(c), 0, 0.17, 0));
  g.add(mk(new THREE.BoxGeometry(0.62, 0.06, 0.38), lamb('#f2f2ee'), 0, 0.37, 0));
  return g;
}
export function makeTowel(c = '#2fa6c9', c2 = '#fff') {
  const t = canvasTex(64, 64, (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); g.fillStyle = c2; for (let i = 0; i < 4; i++) g.fillRect(0, 8 + i * 14, w, 6); }, { aniso: 2 });
  const m = mk(new THREE.PlaneGeometry(0.9, 1.7), new THREE.MeshLambertMaterial({ map: t })); m.rotation.x = -Math.PI / 2; m.position.y = 0.012;
  return m;
}

export function makeChair(c = '#2fa6c9') {
  const g = new THREE.Group(); const m = lamb(c);
  const seat = mk(new THREE.BoxGeometry(0.5, 0.05, 0.5), m, 0, 0.3, 0.05);
  const back = mk(new THREE.BoxGeometry(0.5, 0.55, 0.05), m, 0, 0.58, -0.22); back.rotation.x = -0.28;
  g.add(seat, back);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mk(new THREE.BoxGeometry(0.04, 0.3, 0.04), lamb('#ddd'), sx * 0.22, 0.15, sz * 0.2));
  return g;
}

const haloTex = () => canvasTex(64, 64, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}, { aniso: 1 });
let HALO = null;
export function halo(color, size) {
  if (!HALO) HALO = haloTex();
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: HALO, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.set(size, size, 1); return s;
}


// ---- sky: a clean gradient dome, a sun glow, soft clouds drifting, kites and gulls (the photo sky of scenery3d is not used) ----------------------
function skyDome(style) {
  const top = style.tod === 'dusk' ? ['#1d2a66', '#4a4a92', '#c9708a', '#ffc58e'] : style.tod === 'dawn' ? ['#4a86c8', '#7fb2dc', '#c8d8e0', '#fff0d8'] : ['#1f5fc0', '#2f84dc', '#58aaec', '#dff1fb'];
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, top[0]); gr.addColorStop(0.6, top[1]); gr.addColorStop(0.84, top[2]); gr.addColorStop(1, top[3]);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const dome = mk(new THREE.SphereGeometry(420, 24, 16), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.renderOrder = -10; dome.name = 'sky';
  // the sphere's v runs pole to pole: put the horizon (v = 0.5) at the bottom of the gradient
  const uv = dome.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, Math.max(0, Math.min(1, (uv.getY(i) - 0.5) * 2)));
  return dome;
}
function cloudTexture(seed) {
  reseed(seed);
  return canvasTex(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      const x = w * (0.18 + rnd() * 0.64), y = h * (0.45 + (rnd() - 0.5) * 0.25), r = h * (0.18 + rnd() * 0.22);
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const gr2 = g.createLinearGradient(0, h * 0.5, 0, h); gr2.addColorStop(0, 'rgba(120,150,190,0)'); gr2.addColorStop(1, 'rgba(120,150,190,0.35)');
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr2; g.fillRect(0, 0, w, h);
  }, { aniso: 1 });
}
export function makeKite(c1, c2) {
  const g = new THREE.Group();
  const sh = new THREE.Shape(); sh.moveTo(0, 0.55); sh.lineTo(0.38, 0); sh.lineTo(0, -0.7); sh.lineTo(-0.38, 0); sh.closePath();
  const geo = new THREE.ShapeGeometry(sh);
  const cols = []; const pos = geo.attributes.position; const cc = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { cc.set(pos.getX(i) > 0 ? c1 : c2); cols.push(cc.r, cc.g, cc.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.add(mk(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })));
  // tail: a string of little bows
  const tail = new THREE.Group(); tail.position.y = -0.7; g.add(tail);
  for (let i = 0; i < 7; i++) { const b = mk(new THREE.PlaneGeometry(0.16, 0.08), new THREE.MeshBasicMaterial({ color: i % 2 ? c1 : '#ffffff', side: THREE.DoubleSide, fog: false }), 0, -0.22 - i * 0.28, 0); tail.add(b); }
  g.userData.tail = tail;
  return g;
}


// ---- the horizon: hazy granite domes and green headlands (a Rio-like silhouette), painted procedurally --------------------------------------
function horizon(style, urban) {
  const w = 2048, h = 256;
  const tex = canvasTex(w, h, (g) => {
    reseed(7);
    g.clearRect(0, 0, w, h);
    const hz = style.tod === 'dusk' ? ['#6a5a8a', '#8a6a86'] : style.tod === 'dawn' ? ['#8fb0c8', '#a8c0c8'] : ['#6f9fb8', '#86b0b8'];
    const layer = (col, base, amp, seedv, domes) => {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) {
        let y = base - amp * (0.5 + 0.5 * Math.sin(x * 0.006 + seedv) * Math.cos(x * 0.0023 + seedv * 2)) - amp * 0.3 * Math.sin(x * 0.021 + seedv * 3);
        for (const d of domes) { const dx = (x - d[0]) / d[1]; if (Math.abs(dx) < 1) y = Math.min(y, base - d[2] * Math.pow(1 - dx * dx, 0.55)); }
        g.lineTo(x, y);
      }
      g.lineTo(w, h); g.closePath(); g.fill();
    };
    layer(hz[0], 205, 38, 1, urban ? [[620, 170, 105], [1240, 120, 70], [1500, 200, 60]] : [[700, 220, 70]]);
    layer(hz[1], 225, 22, 4, []);
    layer(style.tod === 'dusk' ? '#4a3f5e' : '#5e8f78', 240, 14, 9, []);
    // sea haze at the foot
    const gr = g.createLinearGradient(0, h * 0.7, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.55)');
    g.fillStyle = gr; g.fillRect(0, h * 0.7, w, h * 0.3);
  }, { aniso: 4 });
  const geo = new THREE.CylinderGeometry(330, 330, 70, 48, 1, true, Math.PI - 1.35, 2.7);
  const m = mk(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.position.y = 28; m.renderOrder = -5;
  return m;
}

// ---- the court ------------------------------------------------------------------------------------------------------------------------
function courtTexture(style, quality) {
  const W = quality === 'low' ? 1024 : 2048, H = Math.round(W * 0.625);          // 28 x 17.5 m
  const PX = W / 28;
  return canvasTex(W, H, (g, w, h) => {
    reseed(404);
    // base: groomed sand, lighter in the middle, feathering to transparent at the edges
    const gr = g.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, w * 0.5);
    gr.addColorStop(0, style.sand[0]); gr.addColorStop(0.6, style.sand[0]); gr.addColorStop(1, style.sand[1]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (style.stone) {
      // paving: 0.55 m slabs in a running bond with grout lines and wear
      const T = 0.55 * PX;
      for (let r = 0; r * T < h + T; r++) for (let c = -1; c * T < w + T; c++) {
        const x = c * T + (r % 2 ? T / 2 : 0), y = r * T, v = 0.88 + rnd() * 0.16;
        g.fillStyle = `rgba(${Math.round(222 * v)},${Math.round(212 * v)},${Math.round(190 * v)},0.9)`; g.fillRect(x + 1, y + 1, T - 2, T - 2);
      }
      g.strokeStyle = 'rgba(60,52,40,0.35)'; g.lineWidth = 2;
      for (let r = 0; r * T < h + T; r++) { g.beginPath(); g.moveTo(0, r * T); g.lineTo(w, r * T); g.stroke(); }
    } else {
      // rake marks along the court and fine grain
      for (let i = 0; i < 160; i++) {
        const y = rnd() * h; g.strokeStyle = `rgba(${rnd() < 0.5 ? '120,86,40' : '255,248,220'},${0.05 + rnd() * 0.07})`; g.lineWidth = 1 + rnd() * 2.5;
        g.beginPath(); g.moveTo(rnd() * w * 0.2, y); g.bezierCurveTo(w * 0.3, y + (rnd() - 0.5) * 6, w * 0.7, y + (rnd() - 0.5) * 6, w * (0.8 + rnd() * 0.2), y + (rnd() - 0.5) * 4); g.stroke();
      }
      for (let i = 0; i < 26000; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(110,80,40,0.16)' : 'rgba(255,250,230,0.2)'; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${200 + rnd() * 40},${190 + rnd() * 40},${170 + rnd() * 40},0.7)`; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 1.5 + rnd() * 3, 1 + rnd() * 2, rnd() * 3, 0, 7); g.fill(); }
    }
    // court tape: 8 cm bands with a faint contact shadow on the sand
    const cx = w / 2, cy = h / 2, lw = 0.09 * PX;
    const rect = (x0, y0, x1, y1) => { g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); };
    const L = HALF_L * PX, Wd = HALF_W * PX;
    g.save();
    g.strokeStyle = 'rgba(40,28,14,0.28)'; g.lineWidth = lw * 1.8; g.lineJoin = 'round';
    rect(cx - L, cy - Wd, cx + L, cy + Wd); g.stroke();
    g.beginPath(); g.moveTo(cx, cy - Wd); g.lineTo(cx, cy + Wd); g.stroke();
    g.strokeStyle = style.line; g.lineWidth = lw;
    rect(cx - L, cy - Wd, cx + L, cy + Wd); g.stroke();
    g.beginPath(); g.moveTo(cx, cy - Wd); g.lineTo(cx, cy + Wd); g.stroke();
    // attack zones, 3 m either side of the net, thinner and dashed
    g.lineWidth = lw * 0.6; g.setLineDash([lw * 3, lw * 2.4]);
    for (const sx of [-3, 3]) { g.beginPath(); g.moveTo(cx + sx * PX, cy - Wd); g.lineTo(cx + sx * PX, cy + Wd); g.stroke(); }
    g.restore();
    // edge feather so the groomed patch melts into the beach
    g.globalCompositeOperation = 'destination-in';
    const m = g.createRadialGradient(cx, cy, h * 0.30, cx, cy, h * 0.5);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.translate(cx, cy); g.scale(w / h * 0.92, 1); g.translate(-cx, -cy);
    g.fillStyle = m; g.fillRect(0, 0, w, h); g.restore();
    g.globalCompositeOperation = 'source-over';
  });
}

function netTexture() {
  return canvasTex(256, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(245,245,238,0.92)'; g.lineWidth = 1.6;
    for (let x = 0; x <= w; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }, { aniso: 4 });
}

export function buildWorld({ courtId = 0, quality = 'high', wind = 0.6 } = {}) {
  const style = COURT_STYLE[courtId] || COURT_STYLE[0];
  const group = new THREE.Group(); group.name = 'world';
  const W = { group, style, tickers: [], palms: [], flagMeshes: [], lampBulbs: [], scenery: null, net: null };

  // ---- scenery photo layers
  const sceneryOpts = { timeOfDay: style.tod, quality, clouds: 1, wind, radius: 130 };
  try {
    const beachLayers = [
      { t: 'water', id: 'gr-sea', x: 0, z: -120, w: 400, d: 210, shimmer: 1 },
      { t: 'ground', id: 'gr-sand', size: 70, repeat: 18, z: 16, shape: 'plane', depth: 70 },
    ];
    if (courtId === 0) W.scenery = buildScenery({ layers: beachLayers, culture: 'mediterranean', ...sceneryOpts });
    else if (courtId === 1) W.scenery = null;
    else W.scenery = buildScenery({ layers: beachLayers, culture: 'mediterranean', ...sceneryOpts });
    if (W.scenery) group.add(W.scenery.group);
  } catch (e) { console.warn('scenery failed', e); }

  if (courtId === 1) {
    // a city park: grass all around the paved square, hedges, a fountain
    const gt = canvasTex(512, 512, (g, w, h) => { reseed(5); g.fillStyle = '#6fa04a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(40,90,30,0.25)' : 'rgba(190,230,120,0.22)'; g.fillRect(rnd() * w, rnd() * h, 2, 3 + rnd() * 3); } for (let i = 0; i < 160; i++) { g.fillStyle = ['#fff', '#ffd23c', '#ff8aa8'][i % 3]; g.fillRect(rnd() * w, rnd() * h, 3, 3); } }, { repeat: [40, 40], aniso: 8 });
    const gm = new THREE.Mesh(new THREE.CircleGeometry(300, 40), new THREE.MeshLambertMaterial({ map: gt })); gm.rotation.x = -Math.PI / 2; gm.position.y = -0.01; group.add(gm);
    // paved apron round the court
    const ap = mk(new THREE.PlaneGeometry(36, 24), new THREE.MeshLambertMaterial({ color: '#cfc6b0' })); ap.rotation.x = -Math.PI / 2; ap.position.y = 0.002; group.add(ap);
    const hedgeM = lamb('#2f7a36');
    for (const z of [-8.5, 8.5]) for (let i = 0; i < 6; i++) { const hx = -15 + i * 6; if (z > 0) continue; const hd = mk(new THREE.BoxGeometry(5.2, 1.0, 0.9), hedgeM, hx, 0.5, z); group.add(hd); }
    const fountain = new THREE.Group();
    fountain.add(mk(new THREE.CylinderGeometry(1.6, 1.75, 0.5, 24), lamb('#bdb6a6'), 0, 0.25, 0));
    fountain.add(mk(new THREE.CylinderGeometry(1.45, 1.45, 0.52, 24), new THREE.MeshLambertMaterial({ color: '#58b8d8' }), 0, 0.27, 0));
    fountain.add(mk(new THREE.CylinderGeometry(0.2, 0.3, 1.3, 12), lamb('#cfc8b6'), 0, 0.9, 0));
    fountain.add(mk(new THREE.CylinderGeometry(0.7, 0.2, 0.2, 14), lamb('#cfc8b6'), 0, 1.5, 0));
    fountain.position.set(-1.5, 0, -12); group.add(fountain);
    reseed(33);
    for (const [x, z, r] of [[-17, -16, 1.9], [16, -17, 2.0], [-8, -24, 2.4], [9, -26, 2.2], [0, -33, 3.0], [-26, -21, 2.6], [27, -23, 2.6], [-34, -30, 3.2], [35, -32, 3.0]]) {
      const t = new THREE.Group();
      t.add(mk(new THREE.CylinderGeometry(0.22, 0.32, 2.6, 8), lamb('#6a4a2a'), 0, 1.3, 0));
      const crown = mk(new THREE.SphereGeometry(r, 10, 8), lamb('#3f8a3a'), 0, 2.6 + r * 0.8, 0); t.add(crown);
      t.add(mk(new THREE.SphereGeometry(r * 0.7, 8, 6), lamb('#4f9a44'), r * 0.7, 2.4 + r * 0.9, r * 0.2));
      t.position.set(x, 0, z); group.add(t);
    }
  }
  // ---- sky
  const dome = skyDome(style); group.add(dome); W.dome = dome;
  const hzn = horizon(style, courtId !== 1); group.add(hzn);
  W.clouds = [];
  reseed(91);
  for (let i = 0; i < 9; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(i + 3), transparent: true, depthWrite: false, fog: false, color: style.tod === 'dusk' ? '#ffc9a8' : '#ffffff', opacity: 0.9 }));
    const a = (-0.95 + rnd() * 1.9) * 1.0, R = 260 + rnd() * 80;
    sp.position.set(Math.sin(a) * R, 22 + rnd() * 46, -Math.cos(a) * R);
    sp.scale.set(110 + rnd() * 90, 46 + rnd() * 30, 1); sp.userData.v = 0.5 + rnd();
    group.add(sp); W.clouds.push(sp);
  }
  W.kites = [];
  for (const [x, y, z, c1, c2] of [[-8, 9, -40, '#e8392c', '#ffd23c'], [6, 12.5, -58, '#2a62d9', '#ffffff'], [14, 7, -34, '#1fb6a4', '#ff8a2b']]) {
    const k = makeKite(c1, c2); k.position.set(x, y, z); k.scale.setScalar(1.7); k.userData.base = [x, y, z]; k.userData.ph = x; group.add(k); W.kites.push(k);
  }
  W.gulls = [];
  for (let i = 0; i < 4; i++) {
    const gl = new THREE.Group();
    const wing = (sg) => { const m = mk(new THREE.PlaneGeometry(0.9, 0.18), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, fog: false }), sg * 0.45, 0, 0); return m; };
    const l = wing(-1), r = wing(1); gl.add(l, r); gl.userData = { l, r, a: i * 1.7, R: 30 + i * 6, y: 14 + i * 3 };
    group.add(gl); W.gulls.push(gl);
  }

  // ---- court mat (receives shadows)
  const cm = new THREE.MeshLambertMaterial({ map: courtTexture(style, quality), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mat = mk(new THREE.PlaneGeometry(28, 17.5), cm); mat.rotation.x = -Math.PI / 2; mat.position.y = 0.006; mat.receiveShadow = true; mat.renderOrder = 1;
  group.add(mat);
  W.mat = mat;

  // ---- net: posts, tape, a mesh that ripples when the peteca touches it
  const net = new THREE.Group(); net.name = 'net'; group.add(net);
  const postM = std('#caa86a', { roughness: 0.7 }), capM = std('#2a2f38');
  for (const sz of [-1, 1]) {
    const p = mk(new THREE.CylinderGeometry(0.045, 0.055, 2.55, 10), postM, 0, 1.275, sz * 3.35); p.castShadow = true; net.add(p);
    net.add(mk(new THREE.SphereGeometry(0.06, 10, 8), capM, 0, 2.58, sz * 3.35));
    const sb = mk(new THREE.CylinderGeometry(0.28, 0.34, 0.2, 12), lamb('#e0c58a'), 0, 0.1, sz * 3.35); net.add(sb);
  }
  const nW = 6.7, nH = 0.95, nSeg = [28, 6];
  const ng = new THREE.PlaneGeometry(nW, nH, nSeg[0], nSeg[1]); ng.rotateY(Math.PI / 2);
  const nm = new THREE.MeshLambertMaterial({ map: netTexture(), transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, depthWrite: false });
  nm.map.repeat.set(10, 1.6); nm.map.wrapS = nm.map.wrapT = THREE.RepeatWrapping;
  const netMesh = mk(ng, nm, 0, 2.15 - nH / 2 - 0.05, 0); netMesh.renderOrder = 3; net.add(netMesh);
  const top = mk(new THREE.BoxGeometry(0.05, 0.09, nW), lamb('#fbfaf2'), 0, 2.15, 0); net.add(top);
  const bot = mk(new THREE.BoxGeometry(0.02, 0.025, nW), lamb('#e8e4d6'), 0, 2.15 - nH - 0.04, 0); net.add(bot);
  for (const sz of [-1, 1]) net.add(mk(new THREE.BoxGeometry(0.03, 1.1, 0.03), lamb('#e8392c'), 0, 2.15 - 0.45, sz * 3.3));
  const basePos = ng.attributes.position.array.slice();
  const ripple = { amp: 0, ph: 0, z: 0 };
  W.net = {
    group: net, mesh: netMesh,
    hit(strength = 1, z = 0) { ripple.amp = Math.min(0.12, 0.05 + 0.05 * strength); ripple.ph = 0; ripple.z = z; },
    update(t, dt) {
      const p = ng.attributes.position;
      ripple.ph += dt; ripple.amp *= Math.exp(-dt * 2.6);
      const sag = 0.035;
      for (let i = 0; i < p.count; i++) {
        const z = basePos[i * 3 + 2], y = basePos[i * 3 + 1], hv = (y + nH / 2) / nH;           // 1 at the tape
        const along = z / (nW / 2);
        const s = -sag * (1 - along * along) * hv;
        const wave = ripple.amp * Math.sin(ripple.ph * 22 - Math.abs(z - ripple.z) * 3.2) * Math.exp(-Math.abs(z - ripple.z) * 0.5) * (0.35 + 0.65 * (1 - hv));
        const w = Math.sin(t * 1.1 + z * 0.9) * 0.006 * (0.5 + wind);
        p.setX(i, basePos[i * 3] + wave + w); p.setY(i, y + s);
      }
      p.needsUpdate = true;
    },
  };

  // ---- props per court
  const place = (obj, x, z, ry = 0, y = 0) => { obj.position.set(x, y, z); obj.rotation.y += ry; group.add(obj); return obj; };
  if (courtId === 0) {
    const pa = [[-10.5, -4.5, 1], [-14, -8, 2], [10.8, -5.5, 3], [15, -9, 4]];
    for (const [x, z, s] of pa) { const p = makePalm(5.6 + s * 0.35, 0.3 * (x < 0 ? -1 : 1), s); place(p, x, z); W.palms.push(p); }
    place(makeUmbrella('#e8392c', '#ffffff', 0.14), -8.4, -5.0); place(makeUmbrella('#2a62d9', '#ffffff', -0.1), 8.8, -5.6); place(makeUmbrella('#f4c534', '#ffffff', 0.08), -2.6, -7.2);
    place(makeChair('#2fa6c9'), -8.6, -4.6, 0.3); place(makeChair('#e8392c'), -7.9, -4.5, -0.2); place(makeCooler('#d8402e'), -9.2, -4.2, 0.4);
    place(makeTowel('#f4a42b', '#ffffff'), 8.2, -4.8, 0.2); place(makeTowel('#2fa6c9', '#ffffff'), 9.4, -4.4, -0.3);
    const lg = makeLifeguardTower(); place(lg, 18, -11, -0.4); W.flagMeshes.push(lg.userData.flag);
    place(makeSurfboard('#2fa6c9'), -11.8, -3.2); place(makeSurfboard('#f4a42b'), -12.3, -3.0, 0.3); place(makeSurfboard('#e8392c'), -11.3, -3.4, -0.2);
  } else if (courtId === 1) {
    for (const [x, z] of [[-9.5, -4.4], [9.5, -4.4]]) place(makeBench(1.9), x, z);
    for (const [x, z] of [[-6.6, -4.8], [6.6, -4.8], [-11.5, -3], [11.5, -3]]) { const l = makeLamp(3.6); place(l, x, z); W.lampBulbs.push(l.userData.bulb); }
    const palmA = [[-13, -7, 5], [13, -7.5, 6]];
    for (const [x, z, s] of palmA) { const p = makePalm(6.2, 0.2 * (x < 0 ? -1 : 1), s); place(p, x, z); W.palms.push(p); }
    // planters with flowers
    for (const [x, z] of [[-4.5, -4.6], [4.5, -4.6], [0, -5.2]]) {
      const g = new THREE.Group(); g.add(mk(new THREE.CylinderGeometry(0.5, 0.42, 0.5, 14), lamb('#b0653c'), 0, 0.25, 0));
      for (let i = 0; i < 16; i++) { const a = rnd() * 6.28, r = rnd() * 0.38; g.add(mk(new THREE.SphereGeometry(0.1 + rnd() * 0.06, 6, 5), lamb(['#ff5f8a', '#ffd23c', '#ff8a2b', '#fff'][i % 4]), Math.cos(a) * r, 0.55 + rnd() * 0.15, Math.sin(a) * r)); }
      g.add(mk(new THREE.SphereGeometry(0.46, 10, 8), lamb('#2f7a3a'), 0, 0.58, 0));
      place(g, x, z);
    }
    place(makeUmbrella('#a05bd8', '#ffffff', 0.1), 8.2, -5.8); place(makeUmbrella('#1fb6a4', '#ffffff', -0.1), -8.2, -5.6);
  } else {
    // dusk: tiki torches, lamps with glow, festoon lights, a lifeguard tower in silhouette
    for (const [x, z] of [[-7.2, -3.8], [7.2, -3.8], [-7.2, 3.8], [7.2, 3.8]]) {
      const l = makeLamp(3.0, '#ffcf8a'); place(l, x, z); W.lampBulbs.push(l.userData.bulb);
      const hl = halo('#ffb867', 4.2); hl.position.set(x, 3.1, z); group.add(hl); W.lampBulbs.push(hl);
    }
    const pts = []; const ya = 3.3;
    const bulbs = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14, x = -7.2 + t * 14.4, y = ya - Math.sin(t * Math.PI) * 0.45; pts.push(new THREE.Vector3(x, y, -3.8)); }
    const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#222' })); group.add(wire);
    for (const p of pts) { const b = mk(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffe3a0' }), p.x, p.y - 0.06, p.z); group.add(b); bulbs.push(b); }
    const pa = [[-10.5, -4.5, 1], [10.8, -5.5, 3], [-14, -8, 2]];
    for (const [x, z, s] of pa) { const p = makePalm(5.6 + s * 0.3, 0.3 * (x < 0 ? -1 : 1), s); place(p, x, z); W.palms.push(p); }
    place(makeUmbrella('#e8392c', '#fff3e0', 0.12), -8.6, -5.2); place(makeUmbrella('#2a62d9', '#fff3e0', -0.1), 8.8, -5.6);
    const lg = makeLifeguardTower(); place(lg, 18, -11, -0.4); W.flagMeshes.push(lg.userData.flag);
    for (const [x, z] of [[-9.4, -3.6], [9.6, -3.4]]) { const t = new THREE.Group(); t.add(mk(new THREE.CylinderGeometry(0.03, 0.04, 1.6, 6), lamb('#6a4a2a'), 0, 0.8, 0)); const f = halo('#ff9b3a', 0.9); f.position.y = 1.75; t.add(f); W.lampBulbs.push(f); place(t, x, z); }
  }
  // a soft, large contact-less ground tint under the props is already in the scenery; keep the group light
  W.update = (t, dt, windV = wind) => {
    W.net.update(t, dt);
    for (const c of W.clouds) { c.position.x += c.userData.v * dt * 0.8; if (c.position.x > 340) c.position.x = -340; }
    for (const k of W.kites) { const b = k.userData.base, p = k.userData.ph; k.position.set(b[0] + Math.sin(t * 0.4 + p) * 1.6, b[1] + Math.sin(t * 0.7 + p * 2) * 0.9, b[2]); k.rotation.z = Math.sin(t * 0.9 + p) * 0.25; k.userData.tail.rotation.z = Math.sin(t * 2.2 + p) * 0.35; }
    for (const g of W.gulls) { const u = g.userData; u.a += dt * 0.12; g.position.set(Math.sin(u.a) * u.R, u.y + Math.sin(u.a * 5) * 0.8, -20 - Math.cos(u.a) * 12); const f = Math.sin(t * 7 + u.a * 3) * 0.5; u.l.rotation.z = f; u.r.rotation.z = -f; g.rotation.y = Math.cos(u.a) > 0 ? 0 : Math.PI; }
    for (const p of W.palms) p.userData.sway(t, windV);
    for (const f of W.flagMeshes) f.rotation.y = Math.sin(t * 3 + 1) * 0.35 * (0.5 + windV);
    if (W.scenery) W.scenery.setWind?.(0.4 + windV * 0.6);
    for (const b of W.lampBulbs) if (b.isSprite) b.material.opacity = 0.85 + Math.sin(t * 9 + b.position.x) * 0.1 + Math.sin(t * 23 + b.position.z) * 0.05;
  };
  return W;
}

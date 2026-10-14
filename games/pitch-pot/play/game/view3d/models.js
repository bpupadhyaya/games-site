// Pitch Pot 3D models (presentation only): the bronze touhu vase with a believable interior and ear tubes, bamboo arrows with feather fletching,
// a woven rush mat, lacquered pillars, paper lanterns. World units are METRES; the sim's centimetres are divided by 100 by the presenter.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { VASE_PROFILE, WALL, FLOOR_IN, RIM_Y, EAR, ARROW } from '../src/sim.js';

const TAU = Math.PI * 2;
const cvs = (w, h) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true, repeat = false) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const CM = 0.01;

// ---------------------------------------------------------------- the vase ------------------------------------------------------------------------------
// One closed lathe profile: foot -> outer wall -> lip -> inner wall -> floor of the cavity. Resampled by arc length so that texture v is proportional to
// distance along the profile and the engraved bands land where the sim's heights say.
function vaseProfile() {
  const P = VASE_PROFILE, pts = [];
  pts.push([0, 0]);
  // outer wall with a softened foot
  pts.push([P[0][1] - 0.5, 0]);
  for (const [y, r] of P) pts.push([r, y]);
  const top = P[P.length - 1];
  // rolled lip
  pts.push([top[1] + 0.25, RIM_Y + 0.15], [top[1] - 0.05, RIM_Y + 0.38], [top[1] - WALL + 0.1, RIM_Y + 0.3], [top[1] - WALL, RIM_Y]);
  // inner wall back down to the cavity floor
  for (let i = P.length - 1; i >= 0; i--) { const [y, r] = P[i]; if (y < FLOOR_IN) continue; pts.push([r - WALL, y]); }
  pts.push([P[0][1] - WALL - 0.5, FLOOR_IN]);
  pts.push([0, FLOOR_IN]);
  return pts;
}
function resample(pts, n) {
  const seg = [0];
  for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = seg[seg.length - 1], out = [];
  for (let k = 0; k < n; k++) {
    const s = (k / (n - 1)) * total; let i = 1; while (i < seg.length - 1 && seg[i] < s) i++;
    const f = (s - seg[i - 1]) / Math.max(1e-9, seg[i] - seg[i - 1]);
    out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]);
  }
  return { out, seg, total };
}
// canvas row (0 = top of texture = v 1) for a height y on the OUTER wall
function vaseV(pts, seg, total) {
  const outerEnd = 2 + VASE_PROFILE.length;       // pts[0..outerEnd-1] are the foot and the outer wall
  return (y) => {
    for (let i = 2; i < outerEnd; i++) {
      const y0 = pts[i - 1][1], y1 = pts[i][1];
      if (y <= y1 || i === outerEnd - 1) { const f = Math.max(0, Math.min(1, (y - y0) / Math.max(1e-6, y1 - y0))); return (seg[i - 1] + (seg[i] - seg[i - 1]) * f) / total; }
    }
    return 1;
  };
}
function vaseMaps() {
  const pts = vaseProfile(), { seg, total } = resample(pts, 4), vOf = vaseV(pts, seg, total);
  const W = 1024, H = 1024, col = cvs(W, H), bmp = cvs(W, H), rgh = cvs(W, H);
  const c = col.getContext('2d'), b = bmp.getContext('2d'), r = rgh.getContext('2d');
  const row = (y) => (1 - vOf(y)) * H;                     // canvas y for a vase height
  // base: warm bronze, darker toward the foot and under the lip, soft vertical sheen bands
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#6b4a1b'); g.addColorStop(0.18, '#a07a38'); g.addColorStop(0.5, '#c79a4f'); g.addColorStop(0.8, '#b58a40'); g.addColorStop(1, '#74531f');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  b.fillStyle = '#808080'; b.fillRect(0, 0, W, H);
  r.fillStyle = '#6a6a6a'; r.fillRect(0, 0, W, H);
  // casting grain
  for (let i = 0; i < 2400; i++) {
    const x = hash(i) * W, y = hash(i + 7) * H, s = 2 + hash(i + 3) * 6, a = 0.05 + hash(i + 9) * 0.09;
    c.fillStyle = `rgba(${hash(i + 2) > 0.5 ? '255,236,170' : '40,24,6'},${a})`; c.fillRect(x, y, s, s * 0.6);
  }
  // horizontal engraved ridges
  const ridge = (y, w, depth = 1) => {
    const yy = row(y);
    c.fillStyle = 'rgba(40,24,6,0.7)'; c.fillRect(0, yy - w / 2, W, w);
    c.fillStyle = 'rgba(255,238,180,0.55)'; c.fillRect(0, yy + w / 2, W, Math.max(1, w * 0.5));
    b.fillStyle = depth > 0 ? '#2a2a2a' : '#e0e0e0'; b.fillRect(0, yy - w / 2, W, w);
  };
  [3.6, 8.6, 20.4, 26.6, 30.6, 37.4, 40.6].forEach((y, i) => ridge(y, i % 2 ? 4 : 7));
  // lei-wen (thunder pattern) meander band on the belly, 16 repeats
  const meander = (y0, y1, n) => {
    const top = row(y1), bot = row(y0), h = bot - top, cell = W / n;
    c.fillStyle = 'rgba(30,18,4,0.75)'; c.fillRect(0, top, W, h);
    b.fillStyle = '#505050'; b.fillRect(0, top, W, h);
    for (let k = 0; k < n; k++) {
      const x = k * cell;
      c.strokeStyle = '#e9c57a'; c.lineWidth = Math.max(2, h * 0.11); c.lineCap = 'square';
      b.strokeStyle = '#d8d8d8'; b.lineWidth = Math.max(2, h * 0.11);
      for (const ctx of [c, b]) {
        ctx.beginPath();
        ctx.moveTo(x + cell * 0.1, top + h * 0.82); ctx.lineTo(x + cell * 0.1, top + h * 0.18); ctx.lineTo(x + cell * 0.9, top + h * 0.18); ctx.lineTo(x + cell * 0.9, top + h * 0.82);
        ctx.lineTo(x + cell * 0.32, top + h * 0.82); ctx.lineTo(x + cell * 0.32, top + h * 0.42); ctx.lineTo(x + cell * 0.68, top + h * 0.42); ctx.lineTo(x + cell * 0.68, top + h * 0.6);
        ctx.stroke();
      }
    }
  };
  meander(11.2, 17.2, 18);
  // shoulder: hanging lappets
  { const top = row(25.4), bot = row(20.8), n = 14, cell = W / n;
    for (let k = 0; k < n; k++) {
      const x = k * cell + cell / 2;
      c.fillStyle = 'rgba(30,18,4,0.55)'; c.beginPath(); c.moveTo(x - cell * 0.4, top); c.lineTo(x + cell * 0.4, top); c.lineTo(x, bot); c.closePath(); c.fill();
      c.strokeStyle = '#f0d594'; c.lineWidth = 3; c.stroke();
      b.fillStyle = '#4a4a4a'; b.beginPath(); b.moveTo(x - cell * 0.4, top); b.lineTo(x + cell * 0.4, top); b.lineTo(x, bot); b.closePath(); b.fill();
    }
  }
  // neck: bamboo-node rings and a row of studs
  for (const y of [28.6, 31.4, 34.2]) { ridge(y, 5); }
  for (let k = 0; k < 36; k++) { const x = (k + 0.5) * (W / 36), yy = row(39); c.fillStyle = '#f3d98d'; c.beginPath(); c.arc(x, yy, 4, 0, TAU); c.fill(); b.fillStyle = '#f0f0f0'; b.beginPath(); b.arc(x, yy, 4, 0, TAU); b.fill(); }
  // four rosette medallions around the belly (front-facing whichever way the vase is turned)
  for (let k = 0; k < 4; k++) {
    const x = (k + 0.5) * (W / 4), yy = row(6.4);
    c.fillStyle = 'rgba(30,18,4,0.65)'; c.beginPath(); c.arc(x, yy, 30, 0, TAU); c.fill();
    c.strokeStyle = '#f2d890'; c.lineWidth = 4; c.stroke();
    c.strokeStyle = '#e9c57a'; c.lineWidth = 3;
    for (let p = 0; p < 8; p++) { const a2 = (p / 8) * TAU; c.beginPath(); c.ellipse(x + Math.cos(a2) * 12, yy + Math.sin(a2) * 12, 8, 4, a2, 0, TAU); c.stroke(); }
    c.fillStyle = '#f3d98d'; c.beginPath(); c.arc(x, yy, 6, 0, TAU); c.fill();
    b.fillStyle = '#b0b0b0'; b.beginPath(); b.arc(x, yy, 30, 0, TAU); b.fill();
  }
  // patina: verdigris bloom collecting in the hollows (foot, neck base, under the lip)
  for (const [y, a, rad] of [[1.6, 0.5, 120], [6, 0.18, 70], [27.5, 0.38, 90], [33, 0.2, 60], [41, 0.22, 60], [18, 0.12, 80]]) {
    for (let i = 0; i < 70; i++) {
      const x = hash(i * 3 + y) * W, yy = row(y) + (hash(i * 5 + y) - 0.5) * rad, s = 8 + hash(i + y) * 30;
      const gr = c.createRadialGradient(x, yy, 0, x, yy, s);
      gr.addColorStop(0, `rgba(70,150,125,${a})`); gr.addColorStop(1, 'rgba(70,150,125,0)');
      c.fillStyle = gr; c.fillRect(x - s, yy - s, s * 2, s * 2);
      r.fillStyle = `rgba(230,230,230,${a * 0.5})`; r.fillRect(x - s * 0.5, yy - s * 0.5, s, s);
    }
  }
  return { color: tex(col), bump: tex(bmp, false), rough: tex(rgh, false), pts };
}

export function makeVase() {
  const g = new THREE.Group(), m = vaseMaps();
  const prof = resample(m.pts, 150).out;
  const geo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * CM, y * CM)), 72);
  const mat = new THREE.MeshPhysicalMaterial({ map: m.color, bumpMap: m.bump, bumpScale: 1.4, roughnessMap: m.rough, roughness: 0.42, metalness: 0.88, clearcoat: 0.25, clearcoatRoughness: 0.35, envMapIntensity: 2.0, emissive: '#3a2108', emissiveIntensity: 0.55, side: THREE.DoubleSide });
  const body = new THREE.Mesh(geo, mat); body.castShadow = true; body.receiveShadow = true; g.add(body);
  // ear tubes: open at the top, closed at the bottom, a gold lip, and a bracket to the neck
  const earMat = new THREE.MeshPhysicalMaterial({ color: '#c79a4f', metalness: 0.9, roughness: 0.34, envMapIntensity: 1.6, side: THREE.DoubleSide });
  const goldMat = new THREE.MeshPhysicalMaterial({ color: '#f1d27c', metalness: 1, roughness: 0.22, envMapIntensity: 1.8 });
  const earX = (EAR.outer + 4.5) / 2, rOut = (EAR.outer - 4.5) / 2 + 0.18, rIn = rOut - 0.34, h = EAR.yTop - EAR.yLow;
  const tube = new THREE.LatheGeometry([[0, 0], [rOut - 0.1, 0], [rOut, 0.2], [rOut, h], [rOut - 0.04, h + 0.12], [rIn + 0.04, h + 0.12], [rIn, h], [rIn, 0.5], [0, 0.5]].map(([r, y]) => new THREE.Vector2(r * CM, y * CM)), 28);
  for (const sg of [-1, 1]) {
    const t = new THREE.Mesh(tube, earMat); t.position.set(sg * earX * CM, EAR.yLow * CM, 0); t.castShadow = true; t.receiveShadow = true; g.add(t);
    const ring = new THREE.Mesh(new THREE.TorusGeometry((rOut - 0.1) * CM, 0.2 * CM, 10, 28), goldMat); ring.rotation.x = Math.PI / 2; ring.position.set(sg * earX * CM, (EAR.yTop + 0.12) * CM, 0); g.add(ring);
    const br = new THREE.Mesh(new THREE.BoxGeometry(2.2 * CM, 1.4 * CM, 2.6 * CM), earMat); br.position.set(sg * (4.9) * CM, (EAR.yLow + 1.0) * CM, 0); g.add(br);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.75 * CM, 12, 8), goldMat); ball.position.set(sg * earX * CM, (EAR.yLow - 0.3) * CM, 0); g.add(ball);
  }
  // a dark, deep cavity read: a soft black disc a little below the rim hides the lathe's unlit interior seam and sells depth
  const shade = new THREE.Mesh(new THREE.CircleGeometry(3.3 * CM, 24), new THREE.MeshBasicMaterial({ color: '#050302', transparent: true, opacity: 0.55, depthWrite: false }));
  shade.rotation.x = -Math.PI / 2; shade.position.y = (RIM_Y - 3.2) * CM; g.add(shade);
  g.userData.interiorShade = shade;
  return g;
}

// ---------------------------------------------------------------- arrows ------------------------------------------------------------------------------
const feather = (() => {
  let t = null;
  return () => {
    if (t) return t;
    const c = cvs(128, 64), x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 64);
    x.strokeStyle = 'rgba(0,0,0,0.28)'; x.lineWidth = 1.2;
    for (let i = 0; i < 28; i++) { x.beginPath(); x.moveTo(i * 4.6, 64); x.lineTo(i * 4.6 + 14, 6); x.stroke(); }
    x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(0, 30, 128, 3);
    t = tex(c); return t;
  };
})();
const bambooTex = (() => {
  let t = null;
  return () => {
    if (t) return t;
    const c = cvs(256, 32), x = c.getContext('2d');
    x.fillStyle = '#e4bb6a'; x.fillRect(0, 0, 256, 32);
    for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(110,70,20,${0.05 + hash(i) * 0.12})`; x.fillRect(hash(i + 1) * 256, hash(i + 5) * 32, 6 + hash(i) * 40, 1); }
    x.fillStyle = 'rgba(90,50,12,0.75)'; x.fillRect(150, 0, 6, 32); x.fillRect(90, 0, 4, 32);
    t = tex(c); return t;
  };
})();
// side colours: 0 red, 1 jade (mirrors art.js TEAM)
export const TEAM3 = [{ main: '#d9422b', dark: '#7a1c10', light: '#ff9d84' }, { main: '#2fae8c', dark: '#145a47', light: '#9be8cf' }];
const shaftMat = () => new THREE.MeshStandardMaterial({ map: bambooTex(), roughness: 0.55, metalness: 0 });
const ironMat = new THREE.MeshStandardMaterial({ color: '#2a2724', metalness: 0.9, roughness: 0.35 });
const fletchCache = new Map();
function fletchMat(color) { if (!fletchCache.has(color)) fletchCache.set(color, new THREE.MeshStandardMaterial({ map: feather(), color, roughness: 0.8, side: THREE.DoubleSide })); return fletchCache.get(color); }
export function makeArrow(side = 0) {
  const g = new THREE.Group(), L = ARROW.L * CM, hl = L / 2, r = ARROW.r * CM * 1.25, tm = TEAM3[side] || TEAM3[0];
  const shaftLen = L - 0.032;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.03, shaftLen, 10, 1), shaftMat());
  shaft.rotation.z = -Math.PI / 2; shaft.position.x = -hl + shaftLen / 2; shaft.castShadow = true; g.add(shaft);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0004, r * 1.55, 0.04, 10), ironMat);
  tip.rotation.z = -Math.PI / 2; tip.position.x = hl - 0.02; tip.castShadow = true; g.add(tip);
  const sock = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.45, r * 1.2, 0.016, 10), ironMat); sock.rotation.z = -Math.PI / 2; sock.position.x = hl - 0.045; g.add(sock);
  const nock = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.2, r * 1.2, 0.012, 10), new THREE.MeshStandardMaterial({ color: '#2b1b0c', roughness: 0.6 })); nock.rotation.z = -Math.PI / 2; nock.position.x = -hl - 0.003; g.add(nock);
  // team band and three feathers (a little tall, like a touhu arrow's fletching)
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.32, r * 1.32, 0.028, 12), new THREE.MeshStandardMaterial({ color: tm.main, roughness: 0.5 }));
  band.rotation.z = -Math.PI / 2; band.position.x = -hl + 0.105; g.add(band);
  const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(0.07, 0); shape.quadraticCurveTo(0.08, 0.01, 0.073, 0.024); shape.lineTo(0.014, 0.021); shape.quadraticCurveTo(0.004, 0.015, 0, 0);
  const fgeo = new THREE.ShapeGeometry(shape, 6);
  const uv = fgeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, fgeo.attributes.position.getX(i) * 11, fgeo.attributes.position.getY(i) * 30);
  const fmat = fletchMat(tm.main);
  for (let k = 0; k < 3; k++) {
    const f = new THREE.Mesh(fgeo, fmat); f.castShadow = true; f.userData.fletch = true;
    f.rotation.set((k / 3) * TAU + 0.5, 0, 0); f.position.set(-hl + 0.006, 0, 0); f.translateY(r * 0.9); g.add(f);
  }
  band.userData.team = true;
  g.userData = { side, r, hl };
  return g;
}
export function setArrowSide(a, side) {
  const tm = TEAM3[side] || TEAM3[0];
  a.traverse((o) => { if (o.userData && o.userData.team) o.material.color.set(tm.main); if (o.userData && o.userData.fletch) o.material = fletchMat(tm.main); });
  a.userData.side = side;
}
// ---------------------------------------------------------------- set dressing ----------------------------------------------------------------------
export function makeMat(w = 0.62, d = 0.52) {
  const c = cvs(512, 512), x = c.getContext('2d');
  x.fillStyle = '#d9c284'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 64; i++) { x.fillStyle = i % 2 ? 'rgba(255,240,190,0.55)' : 'rgba(120,90,40,0.35)'; x.fillRect(0, i * 8, 512, 4); }
  for (let i = 0; i < 64; i++) { x.fillStyle = 'rgba(90,60,20,0.16)'; x.fillRect(i * 8 + (i % 3), 0, 3, 512); }
  x.strokeStyle = '#a3261a'; x.lineWidth = 34; x.strokeRect(0, 0, 512, 512);
  x.strokeStyle = '#d8a54a'; x.lineWidth = 5; x.strokeRect(24, 24, 464, 464);
  const t = tex(c);
  const m = new THREE.Mesh(B.slab(w, d, 0.014, 0.012, 0.006), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
  m.receiveShadow = true; m.castShadow = true;
  return m;
}
export function makeLantern(color = '#c9381f') {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), new THREE.MeshStandardMaterial({ color, emissive: '#ff7a2a', emissiveIntensity: 1.1, roughness: 0.6 }));
  body.scale.set(1, 1.18, 1); g.add(body);
  const gold = new THREE.MeshStandardMaterial({ color: '#d8a54a', metalness: 0.8, roughness: 0.35 });
  for (const sy of [1, -1]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16), gold); cap.position.y = sy * 0.255; g.add(cap); }
  const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.22, 8), new THREE.MeshStandardMaterial({ color: '#b72d1c' })); tassel.position.y = -0.4; g.add(tassel);
  for (let i = 0; i < 6; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.004, 4, 28), gold); rib.rotation.y = i * Math.PI / 6; rib.scale.set(1, 1.18, 1); g.add(rib); }
  return g;
}
export function makePillar(h = 3.6, r = 0.18) {
  const g = new THREE.Group();
  const lac = new THREE.MeshPhysicalMaterial({ color: '#a8261a', roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.2, metalness: 0.0 });
  const gold = new THREE.MeshStandardMaterial({ color: '#d8a54a', metalness: 0.75, roughness: 0.35 });
  const col = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, h, 24), lac); col.position.y = h / 2; col.castShadow = true; col.receiveShadow = true; g.add(col);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.35, r * 1.5, 0.22, 24), new THREE.MeshStandardMaterial({ color: '#7e7a72', roughness: 0.85 })); base.position.y = 0.11; base.receiveShadow = true; g.add(base);
  for (const y of [h - 0.35, 0.65]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.04, r * 1.04, 0.07, 24), gold); band.position.y = y; g.add(band); }
  return g;
}

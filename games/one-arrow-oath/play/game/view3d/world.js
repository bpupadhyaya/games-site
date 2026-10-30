// One Arrow Oath 3D world: everything procedural (no image files). A night plateau of wind-towers under a big moon, faceted element
// constructs with brass gimbals, and the Oathkeeper's spirit bow floating over a carved stone platform.
// Units: the camera sits at the origin looking down -Z. Items (constructs, bows) are built in a local frame where 1 = their design radius.
import * as THREE from '../vendor3d/three.js';
import { ELEMENT_COLOR } from '../src/ui/theme.js';

export const TAU = Math.PI * 2;
export const lcg = (seed) => { let a = seed >>> 0; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; };
export const GOLD = 0xe2bd72, GOLD_L = 0xfbe6ae, NAVY = 0x151a45;
const canvasTex = (w, h, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
export function radialTex(rgb, a = 1, size = 128) {
  return canvasTex(size, size, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.35, `rgba(${rgb},${a * 0.32})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, w, w); });
}
export const hexToRgb = (hex) => { const n = typeof hex === 'string' ? parseInt(hex.slice(1), 16) : hex; return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };
export const elCol = (el) => new THREE.Color(ELEMENT_COLOR[el] ?? '#e2bd72');

// ---------------------------------------------------------------- materials
export function makeMats() {
  const stone = canvasTex(512, 512, (x, w) => {
    const r = lcg(7); x.fillStyle = '#222a5e'; x.fillRect(0, 0, w, w);
    for (let i = 0; i < 4200; i++) { const v = 24 + r() * 52; x.fillStyle = `rgba(${v},${v + 8},${v + 62},${0.12 + r() * 0.16})`; x.fillRect(r() * w, r() * w, 1 + r() * 3, 1 + r() * 3); }
    x.strokeStyle = 'rgba(8,10,40,0.45)'; x.lineWidth = 1.4;
    for (let i = 0; i < 16; i++) { x.beginPath(); let px = r() * w, py = r() * w; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (r() - 0.5) * 90; py += (r() - 0.5) * 90; x.lineTo(px, py); } x.stroke(); }
  });
  stone.wrapS = stone.wrapT = THREE.RepeatWrapping;
  return {
    stone: new THREE.MeshStandardMaterial({ color: 0x8e9ae6, map: stone, roughness: 0.62, metalness: 0.18 }),
    stoneDark: new THREE.MeshStandardMaterial({ color: 0x1d2350, roughness: 0.7, metalness: 0.15 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xe0ae55, roughness: 0.26, metalness: 1, envMapIntensity: 1.3 }),
    brassDark: new THREE.MeshStandardMaterial({ color: 0x8a6428, roughness: 0.4, metalness: 0.95 }),
    glow: new THREE.MeshBasicMaterial({ color: GOLD_L, fog: false }),
    tower: new THREE.MeshStandardMaterial({ color: 0x1a2058, roughness: 0.6, metalness: 0.25 }),
    window: new THREE.MeshBasicMaterial({ color: 0xffd68c, fog: false }),
  };
}

// ---------------------------------------------------------------- sky, moon, stars, nebula, land
export function buildSky() {
  const g = new THREE.Group();
  const grad = canvasTex(8, 512, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); [[0, '#02030c'], [0.2, '#05071a'], [0.34, '#0b0f30'], [0.44, '#1d1a54'], [0.5, '#4a3270'], [0.56, '#2a1c52'], [1, '#0a0820']].forEach(([a, c]) => gr.addColorStop(a, c)); x.fillStyle = gr; x.fillRect(0, 0, w, h); });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16, 0, TAU, 0.2, Math.PI * 0.62), new THREE.MeshBasicMaterial({ map: grad, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.rotation.x = 0; dome.renderOrder = -10; g.add(dome);
  // nebulae: big soft additive blobs
  const rnd = lcg(11);
  for (const [az, el, s, rgb] of [[-0.25, 0.32, 520, '90,63,184'], [0.3, 0.2, 460, '31,109,143'], [0.05, 0.55, 380, '122,47,124'], [-0.1, 0.12, 600, '42,79,176']]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s * 0.7), new THREE.MeshBasicMaterial({ map: radialTex(rgb, 0.36, 128), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    m.position.set(Math.sin(az) * 780, Math.sin(el) * 780, -Math.cos(az) * 780 * Math.cos(el)); m.lookAt(0, 0, 0); m.renderOrder = -9; g.add(m);
  }
  void rnd;
  return g;
}
export function buildStars(count = 360) {
  const r = lcg(5), pos = new Float32Array(count * 3), ph = new Float32Array(count), sz = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const az = (r() - 0.5) * 2.6, el = 0.04 + Math.pow(r(), 0.7) * 0.95, R = 850;
    pos[i * 3] = Math.sin(az) * Math.cos(el) * R; pos[i * 3 + 1] = Math.sin(el) * R; pos[i * 3 + 2] = -Math.cos(az) * Math.cos(el) * R;
    ph[i] = r() * TAU; sz[i] = r() < 0.07 ? 4.2 : 1.4 + r() * 1.5;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('ph', new THREE.BufferAttribute(ph, 1)); geo.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { t: { value: 0 }, px: { value: 2 } },
    vertexShader: 'attribute float ph; attribute float sz; uniform float t; uniform float px; varying float a; void main(){ a = 0.35 + 0.65 * (0.5 + 0.5 * sin(t * (0.6 + ph * 0.25) + ph * 6.0)); gl_PointSize = sz * px; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying float a; void main(){ vec2 d = gl_PointCoord - 0.5; float f = smoothstep(0.5, 0.0, length(d)); gl_FragColor = vec4(vec3(0.85, 0.9, 1.0), a * f); }',
  });
  const p = new THREE.Points(geo, mat); p.frustumCulled = false; p.renderOrder = -8; return p;
}
export function buildMoon() {
  const tex = canvasTex(512, 512, (x, w) => {
    const g = x.createRadialGradient(w * 0.4, w * 0.38, w * 0.05, w / 2, w / 2, w / 2); g.addColorStop(0, '#fff7e2'); g.addColorStop(0.7, '#ecd9ad'); g.addColorStop(1, '#bba577'); x.fillStyle = g; x.fillRect(0, 0, w, w);
    const r = lcg(3);
    for (let i = 0; i < 16; i++) { const cx = r() * w, cy = r() * w, cr = 10 + r() * r() * 70, gg = x.createRadialGradient(cx - cr * 0.2, cy - cr * 0.2, cr * 0.2, cx, cy, cr); gg.addColorStop(0, 'rgba(120,98,60,0.05)'); gg.addColorStop(0.85, 'rgba(120,98,60,0.30)'); gg.addColorStop(1, 'rgba(255,248,225,0.18)'); x.fillStyle = gg; x.beginPath(); x.arc(cx, cy, cr, 0, TAU); x.fill(); }
    for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(110,90,60,${r() * 0.07})`; x.fillRect(r() * w, r() * w, 2, 2); }
  });
  const grp = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ map: tex, fog: false })); disc.renderOrder = -7; grp.add(disc);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: radialTex('255,238,200', 0.5, 256), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); halo.position.z = -0.01; halo.renderOrder = -7; grp.add(halo);
  return grp;
}

function ridgeGeo(rng, W, base, rough, step, bottom) {
  const pts = []; let y = base;
  for (let x = -W; x <= W; x += step) { y += (rng() - 0.5) * 2 * rough; y = Math.max(base - rough * 3, Math.min(base + rough * 2, y)); pts.push([x, y]); }
  const s = new THREE.Shape(); s.moveTo(-W, bottom); for (const [x, y] of pts) s.lineTo(x, y); s.lineTo(W, bottom); s.closePath();
  return { geo: new THREE.ShapeGeometry(s), pts };
}
// Three ridgelines far to near with a warm rim line and haze between, and a row of wind-towers on the middle one.
export function buildLand(mats) {
  const g = new THREE.Group(), r = lcg(21);
  const layers = [{ z: -560, base: 38, rough: 7, step: 24, col: 0x2a2a6a, rim: 0.28 }, { z: -420, base: 20, rough: 6, step: 20, col: 0x1a1b52, rim: 0.36 }, { z: -300, base: 4, rough: 4, step: 16, col: 0x0c0e2c, rim: 0.44 }];
  const hazeTex = canvasTex(4, 128, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(150,120,220,0)'); gr.addColorStop(0.55, 'rgba(150,120,220,0.5)'); gr.addColorStop(1, 'rgba(150,120,220,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); });
  layers.forEach((L, i) => {
    const { geo, pts } = ridgeGeo(r, 900, L.base, L.rough, L.step, -400);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: L.col, fog: false })); m.position.z = L.z; m.renderOrder = -6 + i; g.add(m);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(([x, y]) => new THREE.Vector3(x, y, 0.5))), new THREE.LineBasicMaterial({ color: 0xf0cd8c, transparent: true, opacity: L.rim, fog: false }));
    line.position.z = L.z; line.renderOrder = -5 + i; g.add(line);
    const haze = new THREE.Mesh(new THREE.PlaneGeometry(1800, 90), new THREE.MeshBasicMaterial({ map: hazeTex, transparent: true, depthWrite: false, opacity: 0.34 - i * 0.08, fog: false })); haze.position.set(0, L.base + 4, L.z + 2); haze.renderOrder = -5 + i; g.add(haze);
    L.pts = pts; L.step = L.step;
  });
  // horizon glow
  const glowT = radialTex('226,150,120', 0.5, 256);
  const hg = new THREE.Mesh(new THREE.PlaneGeometry(1500, 260), new THREE.MeshBasicMaterial({ map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.55 })); hg.position.set(0, 30, -580); hg.renderOrder = -6; g.add(hg);
  g.userData.horizon = hg;
  // wind towers
  const towers = [];
  const prof = [[0, 0], [4.4, 0], [3.9, 6], [2.6, 34], [1.9, 56], [2.3, 58], [0, 58]].map(([x, y]) => new THREE.Vector2(x, y));
  const tgeo = new THREE.LatheGeometry(prof, 8);
  for (let i = 0; i < 7; i++) {
    const t = new THREE.Group(), h = 40 + r() * 26, s = h / 58;
    const body = new THREE.Mesh(tgeo, mats.tower); body.scale.setScalar(s); t.add(body);
    for (let k = 1; k <= 4; k++) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.4), mats.window); w.position.set(0, k * h / 5.2, 3.1 * (1 - k * 0.12) * s + 0.2); t.add(w); }
    const band = new THREE.Mesh(new THREE.TorusGeometry(2.45 * s, 0.35, 6, 16), mats.brass); band.rotation.x = Math.PI / 2; band.position.y = h * 0.93; t.add(band);
    const hub = new THREE.Group(); hub.position.set(0, h * 0.98, 2.4 * s);
    hub.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), mats.brass));
    for (let k = 0; k < 3; k++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.9, 15, 0.18), mats.brass); bl.position.y = 7.6; const arm = new THREE.Group(); arm.rotation.z = k * TAU / 3; arm.add(bl); hub.add(arm); }
    t.add(hub); t.userData = { hub, ph: r() * TAU, h, i }; towers.push(t); g.add(t);
  }
  g.userData.towers = towers; g.userData.layers = layers;
  return g;
}

// ---------------------------------------------------------------- floating motes (drift up)
export function buildMotes(count = 40) {
  const r = lcg(9), pos = new Float32Array(count * 3), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { col: { value: new THREE.Color(GOLD) }, px: { value: 2 } },
    vertexShader: 'uniform float px; void main(){ gl_PointSize = 5.0 * px; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 col; void main(){ float f = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(col, f * 0.7); }',
  });
  const p = new THREE.Points(geo, mat); p.frustumCulled = false; p.renderOrder = 5;
  p.userData = { r, count, seed: Array.from({ length: count }, () => ({ x: r(), z: r(), ph: r(), sp: 0.018 + r() * 0.04, sw: 0.4 + r() })) };
  return p;
}

// ---------------------------------------------------------------- the platform and the spirit bow
export function buildPlatform(mats) {
  const g = new THREE.Group();
  // worked disc: rounded rim, brass band, inlaid rings
  const prof = [[0, -0.16], [0.62, -0.17], [0.8, -0.1], [0.86, 0], [0.86, 0.06], [0.82, 0.1], [0.7, 0.11], [0, 0.11]].map(([x, y]) => new THREE.Vector2(x, y));
  const disc = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), mats.stone); g.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.855, 0.028, 8, 64), mats.brass); rim.rotation.x = Math.PI / 2; rim.position.y = 0.035; g.add(rim);
  for (const [rad, w] of [[0.66, 0.018], [0.44, 0.014], [0.22, 0.012]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(rad, w, 6, 64), mats.glow.clone()); t.material.color.setHex(GOLD); t.rotation.x = Math.PI / 2; t.position.y = 0.112; g.add(t); }
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12, m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.1), mats.brass); m.position.set(Math.cos(a) * 0.76, 0.115, Math.sin(a) * 0.76); m.rotation.y = -a; g.add(m); }
  const star = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 8), mats.brass); star.position.y = 0.116; g.add(star);
  return g;
}

export function buildCrystal(mats) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.17, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xe2a040, emissiveIntensity: 0.7, roughness: 0.15, metalness: 0.6, flatShading: true })); c.rotation.x = Math.PI; g.add(c);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.016, 6, 24), mats.brass); ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; g.add(ring);
  return g;
}

// A bow lying across the arrow: the arrow points up (+y), the bow is gripped at the origin and its limbs sweep toward the archer (-y),
// string chord between the tips, nock drawn down by `pull` (0 braced .. 1 full draw).
export function buildBow(mats, tint = null) {
  const g = new THREE.Group(), brass = tint ? new THREE.MeshStandardMaterial({ color: tint, roughness: 0.3, metalness: 0.9 }) : mats.brass;
  const wood = new THREE.MeshStandardMaterial({ color: tint ? 0x2c2354 : 0x3a1f10, roughness: 0.38, metalness: 0.15 });
  const limbs = new THREE.Mesh(new THREE.BufferGeometry(), wood); g.add(limbs);
  const tips = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), brass); g.add(m); return m; });
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.24, 12), brass); grip.rotation.z = Math.PI / 2; g.add(grip);
  [-0.07, 0, 0.07].forEach((x) => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.01, 5, 14), mats.brassDark); w.rotation.y = Math.PI / 2; w.position.x = x; g.add(w); });
  const strMat = new THREE.MeshBasicMaterial({ color: tint ? 0xe6dcff : 0xfff0c8, fog: false });
  const strings = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1, 5), strMat); g.add(m); return m; });
  // arrow
  const arrow = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 8), new THREE.MeshStandardMaterial({ color: tint ? 0xcfc4ff : 0xffe7b0, emissive: tint ? 0x6a58c8 : 0xe0a040, emissiveIntensity: 0.9, roughness: 0.3 })); shaft.position.y = 0.5; arrow.add(shaft);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.07, 0.3, 4), brass); head.position.y = 1.15; arrow.add(head);
  const fgeo = new THREE.PlaneGeometry(0.07, 0.22); fgeo.translate(0.04, 0, 0);
  const fmat = new THREE.MeshStandardMaterial({ color: tint ? 0x8a78e0 : 0xc23a4a, emissive: tint ? 0x4a3aa0 : 0x701820, emissiveIntensity: 0.6, side: THREE.DoubleSide, roughness: 0.6 });
  for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(fgeo, fmat); f.position.y = 0.12; f.rotation.y = i * TAU / 3; arrow.add(f); }
  const aglow = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.2), new THREE.MeshBasicMaterial({ map: radialTex(tint ? '185,166,255' : '255,214,140', 0.55, 128), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); aglow.position.y = 0.55; arrow.add(aglow);
  g.add(arrow);
  let lastPull = -1;
  g.userData.setPull = (pull) => {
    const p = Math.round(pull * 30) / 30; if (p === lastPull) return; lastPull = p;
    const flex = 0.18 * p, tipX = 0.62 - flex * 0.9, tipY = -0.55 - flex * 0.5, nockY = -0.55 - 0.15 - p * 0.62;
    const pts = []; for (let i = 0; i <= 14; i++) { const u = i / 14 * 2 - 1; pts.push(new THREE.Vector3(u * tipX, (u * u) * tipY - 0.0, 0)); }
    limbs.geometry.dispose(); limbs.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 36, 0.058, 8);
    tips[0].position.set(-tipX, tipY, 0); tips[1].position.set(tipX, tipY, 0);
    const seg = (m, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy); m.position.set((ax + bx) / 2, (ay + by) / 2, 0); m.scale.set(1, L, 1); m.rotation.z = Math.atan2(-dx, dy); };
    seg(strings[0], -tipX, tipY, 0, nockY); seg(strings[1], tipX, tipY, 0, nockY);
    arrow.position.y = nockY + 0.02;
  };
  g.userData.setPull(0);
  g.userData.glow = aglow;
  return g;
}

// ---------------------------------------------------------------- faceted constructs
function lathe(profile, n) { return new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), n); }
const SHAPES = {
  tri: () => lathe([[0, -1.18], [1.05, 0.15], [0, 1.0]], 3),
  diamond: () => lathe([[0, -1.2], [1.0, 0], [0, 1.2]], 4),
  kite: () => lathe([[0, -1.55], [0.8, -0.1], [0, 1.0]], 4),
  hex: () => lathe([[0, -1.0], [0.5, -0.8], [1.0, -0.2], [1.0, 0.25], [0.55, 0.85], [0, 1.05]], 6),
  bolt: () => lathe([[0, -1.15], [0.55, -0.35], [1.05, 0.1], [0.45, 0.5], [0, 1.0]], 5),
  sun: () => lathe([[0, -1.0], [0.55, -0.62], [0.92, -0.3], [1.0, 0], [0.92, 0.3], [0.55, 0.62], [0, 1.0]], 10),
  wave: () => lathe([[0, -0.85], [0.78, -0.4], [1.0, 0], [0.78, 0.4], [0, 0.85]], 8),
  colossus: () => lathe([[0, -1.15], [0.62, -0.85], [0.86, -0.5], [0.86, 0.5], [0.62, 0.85], [0, 1.15]], 4),
  lure: () => lathe([[0, -1.1], [0.75, 0], [0, 1.1]], 4),
  boss_lure: () => lathe([[0, -1.35], [0.62, -0.5], [0.95, 0], [0.62, 0.6], [0, 1.2]], 8),
};
const geoCache = new Map();
const shapeGeo = (shape) => {
  let g = geoCache.get(shape);
  if (!g) {
    g = (SHAPES[shape] ?? SHAPES.hex)();
    // a vertical light-to-dark gradient in vertex colours gives every facet its own value (the facets themselves are flat-shaded)
    const p = g.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const v = 0.5 + 0.9 * Math.min(1, Math.max(0, (p.getY(i) + 1.5) / 2.7)); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); geoCache.set(shape, g);
  }
  return g;
};

// A construct: crystal + lens eye (the 2D layer draws the element glyph over it) + brass gimbals + element arcs. Returns { group, update(o) }.
export function buildConstruct(mats, o) {
  const col = o.decoy ? new THREE.Color(GOLD) : elCol(o.element);
  const group = new THREE.Group(), spin = new THREE.Group(); group.add(spin);
  const gemMat = new THREE.MeshPhysicalMaterial({ color: col.clone().multiplyScalar(0.34), emissive: col.clone().multiplyScalar(0.14), emissiveIntensity: 1, roughness: 0.2, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.08, flatShading: true, envMapIntensity: 0.9, vertexColors: true });
  const gem = new THREE.Mesh(shapeGeo(o.shape), gemMat); spin.add(gem);
  // dark facet edges: a slightly bigger back-face shell would be costly; the physical material already reads faceted
  const lens = new THREE.Group(); lens.position.z = 1.15; lens.renderOrder = 3; group.add(lens);
  const eye = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), new THREE.MeshBasicMaterial({ color: 0x080b24, fog: false })); eye.position.z = 0.02; lens.add(eye);
  const eyeGlow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), new THREE.MeshBasicMaterial({ map: radialTex(hexToRgb('#' + col.getHexString()), 0.6, 64), transparent: true, depthWrite: false, fog: false })); eyeGlow.position.z = 0.03; lens.add(eyeGlow);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.045, 8, 40), mats.brass); bezel.position.z = 0.04; lens.add(bezel);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.455, 0.012, 6, 40), new THREE.MeshBasicMaterial({ color: col, fog: false })); ring.position.z = 0.05; lens.add(ring);
  for (const m of [eye, eyeGlow, ring, bezel]) { m.renderOrder = 3; m.material = m.material.clone(); m.material.depthTest = false; }
  // gimbals
  const g1 = new THREE.Mesh(new THREE.TorusGeometry(1.34, 0.022, 6, 72), mats.brass); group.add(g1);
  const g2 = new THREE.Mesh(new THREE.TorusGeometry(1.34, 0.014, 6, 72), mats.brassDark); group.add(g2);
  const arcs = [];
  for (let i = 0; i < 3; i++) { const a = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.05, 6, 24, 0.55), new THREE.MeshBasicMaterial({ color: col, fog: false })); group.add(a); arcs.push(a); }
  const act = o.act ?? 1;
  if (act >= 2) { const t = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.014, 5, 72), new THREE.MeshBasicMaterial({ color: 0xb9a6ff, fog: false })); group.add(t); }
  if (act >= 3) { const t = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.014, 5, 72), new THREE.MeshBasicMaterial({ color: 0xff5470, fog: false })); group.add(t); }
  const orb = [];
  const nOrb = o.boss ? 8 : o.elite ? 4 : 0;
  for (let i = 0; i < nOrb; i++) { const m = new THREE.Mesh(lathe([[0, -1], [1, 0], [0, 1]], 4).scale(o.boss ? 0.11 : 0.09, o.boss ? 0.11 : 0.09, o.boss ? 0.11 : 0.09), mats.brass); group.add(m); orb.push(m); }
  const aura = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), new THREE.MeshBasicMaterial({ map: radialTex(hexToRgb('#' + col.getHexString()), 0.7, 128), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); aura.position.z = -0.6; group.add(aura);
  if (o.shape === 'sun') for (let i = 0; i < 10; i++) { const a = i * TAU / 10, m = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.07, 0.34, 4), mats.brass); m.position.set(Math.cos(a) * 1.22, Math.sin(a) * 1.22, 0); m.rotation.z = a - Math.PI / 2; spin.add(m); }
  const sx = o.shape === 'kite' ? 0.8 : o.shape === 'boss_lure' ? 0.82 : 1, sy = o.shape === 'kite' ? 1.2 : o.shape === 'boss_lure' ? 1.22 : 1;
  gem.scale.set(sx, sy, sx);
  return {
    group, gemMat, col,
    update(t, id, flash) {
      spin.rotation.y = t * 0.5 + id * 1.7; spin.rotation.x = Math.sin(t * 0.7 + id) * 0.18; spin.rotation.z = Math.sin(t * 0.5 + id * 2) * 0.08;
      g1.rotation.set(Math.PI / 2 - 0.5, 0, t * 0.12); g2.rotation.set(Math.PI / 2 - 0.5 + 0.9, 0.5, -t * 0.09);
      arcs.forEach((a, i) => { a.rotation.z = -t * 0.35 + i * TAU / 3; });
      orb.forEach((m, i) => { const a = t * 0.3 + i * TAU / orb.length, rr = 1.9; m.position.set(Math.cos(a) * rr, Math.sin(a) * rr * 0.7, 0.2); m.rotation.set(t, a, 0); });
      gemMat.emissiveIntensity = 1 + flash * 5; gemMat.emissive.copy(col).multiplyScalar(0.14 + flash * 0.8);
    },
  };
}

// The Answering Storm: three broken rings around a small white core, spokes that flicker with its Strength.
export function buildStorm(mats) {
  const col = elCol('storm'), group = new THREE.Group();
  const rings = [[1.0, 200, 0.55, 0.05], [0.76, 250, -0.85, 0.04], [0.52, 300, 1.25, 0.03]].map(([k, deg, sp, w], i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(k, w, 8, 48, deg * Math.PI / 180), new THREE.MeshBasicMaterial({ color: i === 2 ? 0xffffff : col, fog: false })); m.userData = { sp, i }; group.add(m); return m; });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })); group.add(core);
  const spokes = Array.from({ length: 12 }, () => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.8, 0.03), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })); group.add(m); return m; });
  const aura = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: radialTex(hexToRgb('#' + col.getHexString()), 0.8, 128), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); aura.position.z = -0.5; group.add(aura);
  return {
    group, col, gemMat: null,
    update(t, id, flash, o) {
      const grow = 1 + Math.min(o.strength ?? 0, 24) * 0.022; group.scale.setScalar(grow);
      rings.forEach((m) => { m.rotation.z = t * m.userData.sp + m.userData.i * 2.1; m.rotation.x = Math.sin(t * 0.5 + m.userData.i) * 0.5; m.rotation.y = Math.cos(t * 0.4 + m.userData.i) * 0.5; });
      const n = Math.min(12, Math.floor((o.strength ?? 0) / 2));
      spokes.forEach((s, i) => { const on = i < n && Math.sin(t * 17 + i * 5.3) > -0.35; s.visible = on; if (on) { const a = i * TAU / Math.max(n, 1) + t * 0.2; s.position.set(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0); s.rotation.z = a - Math.PI / 2; } });
      core.scale.setScalar(1 + flash * 0.6);
    },
  };
}

// A floating rock with a glowing crystal and a brass lantern post: depth and scale cues at the edges of the night.
export function buildIslet(mats, seed = 1) {
  const r = lcg(seed), g = new THREE.Group();
  const prof = [[0, -1.5 - r() * 0.5], [0.3, -1.0], [0.62 + r() * 0.1, -0.55], [0.95, -0.15], [1.05, 0.05], [0.92, 0.16], [0, 0.2]];
  const rock = new THREE.Mesh(lathe(prof, 7), new THREE.MeshStandardMaterial({ color: 0x242a66, roughness: 0.8, metalness: 0.1, flatShading: true })); rock.rotation.y = r() * 3; g.add(rock);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.95, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0x1b2054, roughness: 0.9 })); cap.position.y = 0.2; g.add(cap);
  const crystal = new THREE.Mesh(lathe([[0, -0.1], [0.14, 0.15], [0.1, 0.55], [0, 0.8]], 5), new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xe2a040, emissiveIntensity: 0.9, roughness: 0.2, flatShading: true })); crystal.position.set(0.25, 0.26, 0.1); g.add(crystal);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.8, 6), mats.brassDark); post.position.set(-0.4, 0.62, -0.1); g.add(post);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), mats.window); lamp.position.set(-0.4, 1.05, -0.1); g.add(lamp);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: radialTex('255,200,120', 0.7, 64), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); glow.position.set(-0.4, 1.05, 0); g.add(glow);
  const glow2 = glow.clone(); glow2.position.set(0.25, 0.8, 0.1); glow2.scale.setScalar(0.8); g.add(glow2);
  g.userData = { crystal, ph: r() * TAU, rock };
  return g;
}

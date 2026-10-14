// Yote 3D models: the sand-bed board in a carved frame, river pebbles with weight, the village-courtyard set at golden hour.
// All procedural (canvas textures + analytic geometry). Cell = 1 world unit; board centred on the origin, x across, z toward the camera.
import { THREE, board3d as B } from '../vendor3d/index.js';

export const FR = 0.52;              // frame margin (cells), same as layout.js FRAME
export const BED_Y = 0.42, RIM_Y = 0.5, PIT_BOTTOM = 0.2, PEBBLE_Y = 0.42;
const TAU = Math.PI * 2;
const rngOf = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export const tex = (canvas, { repeat, srgb = true, aniso = 8 } = {}) => {
  const t = new THREE.CanvasTexture(canvas); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
};

// ------------------------------------------------------------------------------------------------ palettes (same names as the 2D art)
export const BOARDS3 = {
  laterite: { sand: ['#e8b074', '#d29458', '#b87a42'], pit: '#8a6038', frame: '#9a5530', frame2: '#6b3820', stud: '#f6ead0', mat: ['#1a2f5c', '#0f1f40'] },
  dune:     { sand: ['#f4e2b6', '#e6cb92', '#d1ad70'], pit: '#a08450', frame: '#8a6540', frame2: '#5c4028', stud: '#fbf1d6', mat: ['#1d2c4a', '#101d36'] },
  rose:     { sand: ['#eec4b2', '#dba48f', '#c28a76'], pit: '#8a5a50', frame: '#7a3868', frame2: '#4a1f40', stud: '#f9e9e0', mat: ['#2b1a44', '#190e2e'] },
};
export const STONES = {
  river: { 1: { base: '#2a3d86', hi: '#6f86c4', vein: 'rgba(190,205,255,0.55)', mark: '#d9e2ff', rough: 0.28 }, 2: { base: '#e6d6b2', hi: '#fff6df', vein: 'rgba(120,84,40,0.55)', mark: '#25428c', rough: 0.3 } },
  clay: { 1: { base: '#b9502a', hi: '#f09068', vein: 'rgba(255,200,160,0.4)', mark: '#ffe4bf', rough: 0.55 }, 2: { base: '#efe7d2', hi: '#ffffff', vein: 'rgba(120,100,70,0.38)', mark: '#8c3a1c', rough: 0.5 } },
};

// ------------------------------------------------------------------------------------------------ textures
function sandCanvas(pal, wC, hC, seed) {
  const PX = 96, w = Math.ceil(wC * PX), h = Math.ceil(hC * PX), c = cv(w, h), x = c.getContext('2d'), r = rngOf(seed);
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, pal.sand[0]); g.addColorStop(0.55, pal.sand[1]); g.addColorStop(1, pal.sand[2]);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  // raked ripples: soft waves with a dark and a light edge each
  for (let y = 8; y < h; y += 15) {
    const ph = r() * 6, amp = 2 + r() * 3;
    for (const [dy, col, lw] of [[0, 'rgba(90,50,20,0.18)', 2.2], [3.4, 'rgba(255,246,222,0.26)', 1.6]]) {
      x.strokeStyle = col; x.lineWidth = lw; x.beginPath();
      for (let X = 0; X <= w; X += 8) { const yy = y + dy + Math.sin(X * 0.04 + ph) * amp; X ? x.lineTo(X, yy) : x.moveTo(X, yy); }
      x.stroke();
    }
  }
  for (let k = 0; k < w * h / 70; k++) { const a = 0.05 + r() * 0.14; x.fillStyle = r() < 0.5 ? `rgba(90,50,20,${a})` : `rgba(255,248,230,${a * 1.2})`; x.fillRect(r() * w, r() * h, 1 + r() * 1.6, 1 + r() * 1.6); }
  return c;
}
function stoneCanvas(p, seed) {
  const S = 256, c = cv(S), x = c.getContext('2d'), r = rngOf(seed);
  const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, p.hi); g.addColorStop(0.5, p.base); g.addColorStop(1, p.base);
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  // everything wraps horizontally (the sphere's UV seam must not show)
  for (let i = 0; i < 36; i++) {
    const px = r() * S, py = r() * S, rr = 12 + r() * 46, lt = r() < 0.5;
    for (const ox of [-S, 0, S]) { const gr = x.createRadialGradient(px + ox, py, 0, px + ox, py, rr); gr.addColorStop(0, lt ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.13)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(px + ox - rr, py - rr, rr * 2, rr * 2); }
  }
  x.strokeStyle = p.vein; x.lineWidth = 2.2;
  for (let v = 0; v < 3; v++) {
    const y0 = S * 0.32 + r() * (S * 0.36), A = 6 + r() * 12, k = 1 + Math.floor(r() * 2), ph = r() * 6.28;
    x.beginPath(); for (let X = 0; X <= S; X += 4) { const Y = y0 + A * Math.sin((X / S) * 6.2832 * k + ph); X ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke();
  }
  for (let k = 0; k < 1500; k++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.16)'; x.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
  return c;
}
function groundCanvas() {
  const S = 512, c = cv(S), x = c.getContext('2d'), r = rngOf(77);
  x.fillStyle = '#9a6c40'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) { const px = r() * S, py = r() * S, rr = 18 + r() * 70, gr = x.createRadialGradient(px, py, 0, px, py, rr); const lt = r() < 0.5; gr.addColorStop(0, lt ? 'rgba(255,214,150,0.16)' : 'rgba(90,50,24,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  for (let k = 0; k < 5000; k++) { x.fillStyle = r() < 0.5 ? 'rgba(255,230,180,0.2)' : 'rgba(70,36,16,0.22)'; x.fillRect(r() * S, r() * S, 1 + r() * 2.5, 1 + r() * 2.5); }
  return c;
}
function skyCanvas() {
  const W = 8, H = 512, c = cv(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H);        // zenith (top) -> horizon (centre) -> below
  g.addColorStop(0, '#1f2d66'); g.addColorStop(0.25, '#4a4a8e'); g.addColorStop(0.38, '#b8587a'); g.addColorStop(0.45, '#ff8a4a'); g.addColorStop(0.485, '#ffb347'); g.addColorStop(0.5, '#ffd27a');
  g.addColorStop(0.52, '#e6a15c'); g.addColorStop(1, '#a8622c');
  x.fillStyle = g; x.fillRect(0, 0, W, H); return c;
}
function matCanvas(pal, wC, hC) {
  const PX = 72, w = Math.ceil(wC * PX), h = Math.ceil(hC * PX), c = cv(w, h), x = c.getContext('2d'), r = rngOf(5);
  const g = x.createLinearGradient(0, 0, w * 0.4, h); g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.lineWidth = 1; for (let X = 0; X < w; X += 4) { x.strokeStyle = `rgba(190,210,255,${0.02 + r() * 0.035})`; x.beginPath(); x.moveTo(X + 0.5, 0); x.lineTo(X + 0.5, h); x.stroke(); }
  const ink = 'rgba(244,228,190,0.5)', band = 56;
  x.lineCap = 'round'; x.lineJoin = 'round';
  const drawBand = (cy, kind) => {
    x.strokeStyle = ink; x.fillStyle = ink; x.lineWidth = 3;
    x.fillRect(0, cy - band * 0.5, w, 2.5); x.fillRect(0, cy + band * 0.5, w, 2.5);
    for (let X = 18; X < w; X += 36) {
      if (kind === 0) { x.beginPath(); x.moveTo(X - 7, cy); x.lineTo(X + 7, cy); x.moveTo(X, cy - 7); x.lineTo(X, cy + 7); x.stroke(); }
      else if (kind === 1) { x.beginPath(); x.moveTo(X - 14, cy + 10); x.lineTo(X, cy - 10); x.lineTo(X + 14, cy + 10); x.stroke(); }
      else { x.beginPath(); x.moveTo(X, cy - 12); x.lineTo(X + 12, cy); x.lineTo(X, cy + 12); x.lineTo(X - 12, cy); x.closePath(); x.stroke(); x.beginPath(); x.arc(X, cy, 2.6, 0, TAU); x.fill(); }
    }
  };
  let k = 0; for (let y = band; y < h - band * 0.6; y += band * 1.9) drawBand(y, k++ % 3);
  x.strokeStyle = 'rgba(244,228,190,0.55)'; x.lineWidth = 6; x.strokeRect(10, 10, w - 20, h - 20);   // woven border
  x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 3; x.strokeRect(20, 20, w - 40, h - 40);
  return c;
}
export function radialCanvas(rgb, a, size = 128, hard = 0.5) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(hard, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
}
export function ringCanvas(rgb, size = 128, inner = 0.7) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, size * 0.5 * inner * 0.8, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(inner + 0.04, `rgba(${rgb},0.95)`); g.addColorStop(Math.min(0.98, inner + 0.18), `rgba(${rgb},0.4)`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
}

// ------------------------------------------------------------------------------------------------ geometry helpers
const rrShape = (w, d, r) => {
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2; r = Math.min(r, w / 2, d / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false); s.lineTo(x + w, y + d - r); s.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + d); s.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false); s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
};
const holePath = (cx, cy, r) => { const p = new THREE.Path(); p.absarc(cx, cy, r, 0, TAU, true); return p; };
// extruded shape standing on y = y0, thickness depth along +y
function ext(shape, depth, y0, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, depth - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 18 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0 + bevel, 0); return g;
}

// A river pebble: a flattened ellipsoid with a little hand-made irregularity and a flatter underside. variant 0..2.
function pebbleGeo(variant) {
  const g = new THREE.SphereGeometry(1, 30, 22), p = g.attributes.position, r = rngOf(31 + variant * 17);
  const f1 = 1 + r() * 2, f2 = 1 + r() * 2, p1 = r() * TAU, p2 = r() * TAU;
  const sx = [0.4, 0.38, 0.41][variant], sy = [0.23, 0.25, 0.22][variant], sz = [0.36, 0.39, 0.35][variant];
  const nr = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x), bump = 1 + 0.035 * Math.sin(a * f1 + p1) + 0.02 * Math.sin(a * f2 * 2 + p2) + 0.02 * y;
    // analytic normals of the stretched ellipsoid (computeVertexNormals would leave a lighting seam where the UV seam duplicates vertices)
    const nx = nr.getX(i) / sx, ny = nr.getY(i) / (y < 0 ? sy * 0.55 : sy), nz = nr.getZ(i) / sz, nl = Math.hypot(nx, ny, nz) || 1;
    nr.setXYZ(i, nx / nl, ny / nl, nz / nl);
    if (y < 0) y *= 0.55;                        // flatter underside: sits in the pit like a real stone
    p.setXYZ(i, x * sx * bump, y * sy, z * sz * bump);
  }
  return g;
}

// ------------------------------------------------------------------------------------------------ materials (cached)
const matCache = new Map();
const cached = (k, fn) => { let m = matCache.get(k); if (!m) { m = fn(); matCache.set(k, m); } return m; };
export function stoneMats(style, side, ghost = false) {
  const st = (STONES[style] || STONES.river)[side === 2 ? 2 : 1];
  return cached(`stone|${style}|${side}|${ghost}`, () => {
    const m = new THREE.MeshPhysicalMaterial({ map: tex(stoneCanvas(st, side * 7 + (style === 'clay' ? 3 : 0)), { aniso: 4 }), roughness: st.rough, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.18 });
    m.envMapIntensity = 1.1;
    if (ghost) { m.transparent = true; m.opacity = 0.5; m.depthWrite = false; m.emissive = new THREE.Color(side === 2 ? '#fff0c0' : '#6f86ff'); m.emissiveIntensity = 0.35; }
    return m;
  });
}
const markMat = (style, side) => cached(`mark|${style}|${side}`, () => new THREE.MeshStandardMaterial({ color: (STONES[style] || STONES.river)[side === 2 ? 2 : 1].mark, roughness: 0.5, metalness: 0.3 }));

// ------------------------------------------------------------------------------------------------ pebble model
const geoCache = [];
export function makePebble(style, side, variant = 0, ghost = false) {
  if (!geoCache[variant]) geoCache[variant] = pebbleGeo(variant);
  const grp = new THREE.Group(), body = new THREE.Mesh(geoCache[variant], stoneMats(style, side, ghost));
  body.castShadow = !ghost; body.receiveShadow = true; body.position.y = 0.13;
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), markMat(style, side)); dot.scale.set(1, 0.4, 1); dot.position.set(0.05, 0.13 + 0.205, 0.03);
  grp.add(body); if (!ghost) grp.add(dot);
  grp.userData = { body, dot };
  return grp;
}

// ------------------------------------------------------------------------------------------------ the board
export function buildBoard(kind, sc, sr) {
  const pal = BOARDS3[kind] || BOARDS3.laterite, grp = new THREE.Group();
  const W = sc + 2 * FR, D = sr + 2 * FR, bw = sc + 0.14, bd = sr + 0.14;
  // base slab (carved dark wood) + frame ring + sand bed with 30 scooped pits
  const woodMat = B.material('wood', { color: pal.frame, color2: pal.frame2, repeat: [0.5, 0.5], seed: 12, roughness: 0.5 });
  const baseMat = B.material('darkWood', { color: pal.frame2, color2: pal.frame, repeat: [0.4, 0.4], seed: 3 });
  const base = new THREE.Mesh(B.slab(W + 0.06, D + 0.06, 0.16, 0.34, 0.07), baseMat); base.castShadow = true; base.receiveShadow = true; grp.add(base);
  const ring = rrShape(W, D, 0.3); ring.holes.push(rrShape(bw, bd, 0.16));
  const frame = new THREE.Mesh(ext(ring, RIM_Y - 0.16, 0.16, 0.035), woodMat); frame.castShadow = true; frame.receiveShadow = true; grp.add(frame);
  // brass inlay line around the frame top
  const line = rrShape(W - 0.2, D - 0.2, 0.22); line.holes.push(rrShape(W - 0.27, D - 0.27, 0.18));
  const brass = new THREE.Mesh(ext(line, 0.02, RIM_Y - 0.004), B.material('brass')); brass.receiveShadow = true; grp.add(brass);
  // sand bed
  const bedShape = rrShape(bw, bd, 0.16);
  for (let i = 0; i < sc; i++) for (let j = 0; j < sr; j++) bedShape.holes.push(holePath(i + 0.5 - sc / 2, -(j + 0.5 - sr / 2), 0.43));
  const bedGeo = ext(bedShape, BED_Y - 0.16, 0.16, 0);
  // top-face UVs span the bed exactly (extrude uses x,y of the shape: map to 0..1)
  const bedTex = tex(sandCanvas(pal, bw, bd, sc * 13 + sr), { aniso: 8 }); bedTex.wrapS = bedTex.wrapT = THREE.ClampToEdgeWrapping;
  const uv = bedGeo.attributes.uv, pos = bedGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / bw + 0.5, pos.getZ(i) / bd + 0.5);
  const sandMat = new THREE.MeshStandardMaterial({ map: bedTex, roughness: 0.95, metalness: 0 });
  const bed = new THREE.Mesh(bedGeo, sandMat); bed.receiveShadow = true; bed.castShadow = true; grp.add(bed);
  // pit bowls: one merged geometry, vertex-darkened toward the rim wall so each pit reads as scooped
  const prof = [[0.0, PIT_BOTTOM], [0.15, PIT_BOTTOM + 0.006], [0.27, PIT_BOTTOM + 0.04], [0.36, PIT_BOTTOM + 0.1], [0.41, PIT_BOTTOM + 0.17], [0.435, BED_Y + 0.002]];
  const bowl = B.lathe(prof, 30), parts = [];
  for (let i = 0; i < sc; i++) for (let j = 0; j < sr; j++) parts.push({ geo: bowl, m: new THREE.Matrix4().makeTranslation(i + 0.5 - sc / 2, 0, j + 0.5 - sr / 2) });
  const bowls = B.mergeGeos(parts), cols = [], bp = bowls.attributes.position, col = new THREE.Color(pal.pit);
  for (let i = 0; i < bp.count; i++) { const y = bp.getY(i), t = Math.max(0, Math.min(1, (y - PIT_BOTTOM) / (BED_Y - PIT_BOTTOM))); const k = 0.55 + 0.45 * t * t; cols.push(col.r * k, col.g * k, col.b * k); }
  bowls.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const bowlMesh = new THREE.Mesh(bowls, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
  bowlMesh.receiveShadow = true; grp.add(bowlMesh);
  // cowrie-white studs set into the frame, one per half cell along each side
  const studs = [], mid = FR / 2 + 0.02, pad = 0.0;
  for (let k = 0; k < sc * 2; k++) { const t = (k + 0.5) * 0.5 - sc / 2; studs.push([t, -(sr / 2 + mid), 0], [t, sr / 2 + mid, 0]); }
  for (let k = 0; k < sr * 2; k++) { const t = (k + 0.5) * 0.5 - sr / 2; studs.push([-(sc / 2 + mid), t, Math.PI / 2], [sc / 2 + mid, t, Math.PI / 2]); }
  const sg = new THREE.SphereGeometry(1, 14, 10), im = new THREE.InstancedMesh(sg, new THREE.MeshPhysicalMaterial({ color: pal.stud, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 }), studs.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(0.115, 0.05, 0.075), pv = new THREE.Vector3();
  studs.forEach((s, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -s[2]); pv.set(s[0], RIM_Y + 0.01, s[1]); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); });
  im.castShadow = true; im.receiveShadow = true; grp.add(im);
  grp.userData = { W, D, sc, sr, kind, dispose() { grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); bedTex.dispose(); } };
  return grp;
}

// ------------------------------------------------------------------------------------------------ the courtyard set
export function buildCourtyard() {
  const g = new THREE.Group(), fore = new THREE.Group(), r = rngOf(4); fore.name = 'fore';
  // ground (packed earth), a big plane that fades into the haze
  const gt = tex(groundCanvas(), { repeat: [40, 40] });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.MeshStandardMaterial({ map: gt, roughness: 1, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.002; ground.receiveShadow = true; g.add(ground);
  // sky dome
  const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 16), new THREE.MeshBasicMaterial({ map: tex(skyCanvas(), { srgb: true }), side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10; g.add(sky);
  // a low sun disc and halo in the camera-far direction (key light comes from the left-front)
  const sunTex = tex(radialCanvas('255,226,160', 1, 256, 0.25));
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sun.position.set(-16, 8, -70); sun.lookAt(0, 4, 0); g.add(sun);
  // huts: mud-brick drum, thatched cone, a dark doorway
  const mud = B.material('clay', { color: '#b4683f', color2: '#d38b5c', repeat: [3, 1], seed: 8 });
  const thatch = cached('thatch', () => { const c = cv(256, 128), x = c.getContext('2d'), rr = rngOf(3); x.fillStyle = '#9b7438'; x.fillRect(0, 0, 256, 128); for (let i = 0; i < 700; i++) { x.strokeStyle = rr() < 0.5 ? 'rgba(255,225,150,0.35)' : 'rgba(60,35,10,0.4)'; x.lineWidth = 1; const X = rr() * 256; x.beginPath(); x.moveTo(X, 0); x.lineTo(X + (rr() - 0.5) * 10, 128); x.stroke(); } const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 1); return new THREE.MeshStandardMaterial({ map: t, roughness: 1 }); });
  const door = new THREE.MeshBasicMaterial({ color: 0x1b0d06 });
  const hut = (x, z, s, ry) => {
    const h = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.8, 1.9, 22), mud); wall.position.y = 0.95; wall.castShadow = true; wall.receiveShadow = true;
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 2.45, 2.0, 22), thatch); roof.position.y = 1.9 + 1.0; roof.castShadow = true;
    const drm = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.25), door); drm.position.set(0, 0.64, 1.77); h.add(wall, roof);
    h.position.set(x, 0, z); h.scale.setScalar(s); h.rotation.y = ry; return h;
  };
  g.add(hut(-11, -17, 1.0, 0.5), hut(6.5, -20, 1.15, -0.4), hut(16, -14, 0.9, -0.9), hut(-21, -12, 0.95, 0.9), hut(-3.5, -29, 1.3, 0.1));
  // a low mud wall with a rounded top behind the board
  for (let i = 0; i < 9; i++) { const w = new THREE.Mesh(B.roundedBox(2.4, 1.1, 0.8, 0.18), mud); w.position.set(-12 + i * 2.35, 0.55, -9.2 - Math.sin(i * 0.7) * 0.15); w.castShadow = true; w.receiveShadow = true; g.add(w); }
  // baobab: bulbous trunk, spreading branches, flat dark crown with a warm rim from the sun
  const bao = new THREE.Group(), barkM = new THREE.MeshStandardMaterial({ color: '#7d5a40', roughness: 0.95 });
  const trunk = new THREE.Mesh(B.lathe([[0, 0], [1.1, 0], [1.25, 0.8], [1.45, 2.2], [1.2, 4.2], [0.9, 5.6], [0.7, 6.4], [0, 6.4]], 18), barkM); trunk.castShadow = true; bao.add(trunk);
  const leafM = new THREE.MeshStandardMaterial({ color: '#4b5a2a', roughness: 1 });
  for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU, br = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.22, 2.4, 6), barkM); br.position.set(Math.cos(a) * 1.0, 6.7, Math.sin(a) * 1.0); br.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); bao.add(br); const cr = new THREE.Mesh(new THREE.SphereGeometry(1.2 + r() * 0.5, 10, 8), leafM); cr.position.set(Math.cos(a) * 2.2, 7.6, Math.sin(a) * 2.2); cr.scale.y = 0.55; bao.add(cr); }
  const top = new THREE.Mesh(new THREE.SphereGeometry(2.0, 12, 8), leafM); top.position.y = 7.9; top.scale.y = 0.55; bao.add(top);
  bao.position.set(19, 0, -20); bao.scale.setScalar(1.4); g.add(bao);
  // foreground props (inside the camera's reach on the title screen): clay pots, a calabash of spare pebbles
  const potM = B.material('clay', { color: '#a8502c', color2: '#d17a4a', repeat: [2, 1], seed: 21, roughness: 0.8 });
  const pot = (x, z, s) => { const p = new THREE.Mesh(B.lathe([[0, 0], [0.34, 0], [0.5, 0.18], [0.62, 0.5], [0.5, 0.86], [0.3, 1.0], [0.34, 1.12], [0.26, 1.12], [0, 1.0]], 24), potM); p.position.set(x, 0, z); p.scale.setScalar(s); p.castShadow = true; p.receiveShadow = true; return p; };
  fore.add(pot(-4.6, -1.2, 1.0), pot(-5.5, 0.2, 0.7), pot(5.2, -1.6, 0.85));
  const cal = new THREE.Mesh(B.lathe([[0, 0.02], [0.42, 0.04], [0.62, 0.2], [0.7, 0.42], [0.66, 0.5], [0.6, 0.46], [0.54, 0.24], [0.3, 0.12], [0, 0.1]], 24), B.material('wood', { color: '#8a5a2a', color2: '#b88048', seed: 14 }));
  cal.position.set(5.1, 0, 2.6); cal.castShadow = true; cal.receiveShadow = true; fore.add(cal);
  for (let k = 0; k < 6; k++) { const m = makePebble('river', k % 2 ? 2 : 1, k % 3); m.position.set(5.1 + (r() - 0.5) * 0.7, 0.18, 2.6 + (r() - 0.5) * 0.7); m.scale.setScalar(0.8); fore.add(m); }
  for (let k = 0; k < 9; k++) { const m = makePebble('river', k % 2 ? 2 : 1, k % 3); m.position.set(-3.6 + r() * 2.2, 0, 4 + r() * 1.5); m.rotation.y = r() * TAU; m.scale.setScalar(0.55 + r() * 0.3); fore.add(m); }
  g.add(fore);
  return { group: g, fore, sky, sun };
}

// The woven mud-cloth mat the board sits on (W, D in cells incl. margin)
export function buildMat(kind, W, D) {
  const pal = (BOARDS3[kind] || BOARDS3.laterite).mat, mw = W + 2.4, md = D + 2.4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(mw, md), new THREE.MeshStandardMaterial({ map: tex(matCanvas(pal, mw, md), { aniso: 8 }), roughness: 1 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.receiveShadow = true; return m;
}

// Dust motes drifting in the low sun
export function buildMotes(n = 60) {
  const pos = new Float32Array(n * 3), seed = rngOf(9), base = [];
  for (let i = 0; i < n; i++) { const p = [(seed() - 0.5) * 16, 0.4 + seed() * 5, (seed() - 0.5) * 10]; base.push({ p, s: 0.15 + seed() * 0.3, ph: seed() * TAU }); pos.set(p, i * 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffe2a8, size: 0.08, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  pts.frustumCulled = false;
  pts.userData.update = (t) => { for (let i = 0; i < n; i++) { const b = base[i]; pos[i * 3] = b.p[0] + Math.sin(t * b.s + b.ph) * 0.8; pos[i * 3 + 1] = b.p[1] + Math.sin(t * b.s * 0.7 + b.ph) * 0.35; pos[i * 3 + 2] = b.p[2] + Math.cos(t * b.s * 0.8 + b.ph) * 0.6; } geo.attributes.position.needsUpdate = true; };
  return pts;
}

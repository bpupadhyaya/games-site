// Songo 3D world (units: centimetres; one canonical board-canvas unit = K cm). A carved camwood (or ebony) sowing board, seven houses a side
// and a long store trough for each player, lying on an indigo resist-dyed cloth on a woven raffia mat, by the light of a clay oil lamp.
// Evening in a forest-edge house: deep green dark, one warm pool of light on the board. Everything is procedural (canvas textures +
// analytic geometry): no image files. Shared by the presenter and the icon page.
import * as THREE from '../vendor3d/three.js';

export const K = 0.1;                                // cm per canonical board unit
export const THICK = 3.6, FOOT = 0.9;                // board slab thickness and the foot lip under it
export const TOPY = FOOT + THICK;                    // height of the carved top face
export const PIT_D = 2.5;                            // house depth
export const TRAY_D = 2.1;                           // trough depth
export const SEED_R = 1.1;
const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
export const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (cv, srgb, aniso = 8) => { const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; };

// canonical board point -> world (x, z), the frame's centre is the origin
export const toWorld = (geo, cx, cy) => ({ x: (cx - geo.mid.x) * K, z: (cy - geo.mid.y) * K });
export const toCanon = (geo, x, z) => ({ cx: x / K + geo.mid.x, cy: z / K + geo.mid.y });

export const WOODS3 = {
  camwood: { face: ['#8f4226', '#a85030', '#7d371f'], edge: ['#4d2112', '#5f2a17', '#3c180d'], grain: [46, 14, 6], pit: ['#2a0f07', '#5a2614'], inlay: '#e0a63a', rough: 0.4 },
  ebony: { face: ['#4a382c', '#5b4636', '#3c2d22'], edge: ['#241a12', '#2e2218', '#1a120c'], grain: [14, 10, 6], pit: ['#0e0805', '#2c1d12'], inlay: '#d9a43e', rough: 0.34 },
};

// ---------------------------------------------------------------- the carved top (colour + bump) painted in canonical units
function paintTop(geo, wood, W) {
  const B = WOODS3[wood] || WOODS3.camwood, fr = geo.frame, u = W / fr.w, H = Math.round(fr.h * u), r = lcg(31 + (geo.long ? 7 : 0));
  const col = canvas(W, H), c = col.getContext('2d'), bump = canvas(W, H), b = bump.getContext('2d');
  for (const x of [c, b]) { x.scale(u, u); x.translate(-fr.x, -fr.y); }
  const grad = (cols, x0, y0, x1, y1) => { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, cols[0]); g.addColorStop(0.5, cols[1]); g.addColorStop(1, cols[2]); return g; };
  c.fillStyle = grad(B.face, fr.x, fr.y, fr.x + fr.w, fr.y + fr.h); c.fillRect(fr.x - 4, fr.y - 4, fr.w + 8, fr.h + 8);
  b.fillStyle = 'rgb(128,128,128)'; b.fillRect(fr.x - 4, fr.y - 4, fr.w + 8, fr.h + 8);
  // grain along the length
  const [gr, gg, gb] = B.grain;
  for (let k = 0; k < 520; k++) {
    const y0 = fr.y + r() * fr.h, amp = 1 + r() * 5, ph = r() * 6, len = (0.25 + r() * 0.75) * fr.w, x0 = fr.x + r() * (fr.w - len), a = 0.05 + r() * 0.2;
    c.strokeStyle = r() < 0.72 ? `rgba(${gr},${gg},${gb},${a})` : `rgba(255,205,160,${0.03 + r() * 0.07})`; c.lineWidth = 0.5 + r() * 1.8;
    b.strokeStyle = r() < 0.5 ? 'rgba(96,96,96,0.3)' : 'rgba(166,166,166,0.2)'; b.lineWidth = c.lineWidth * 0.8;
    c.beginPath(); b.beginPath();
    for (let x = 0; x <= len; x += 20) { const y = y0 + Math.sin(x / 90 + ph) * amp + Math.sin(x / 31 + ph * 2) * 0.8; if (x) { c.lineTo(x0 + x, y); b.lineTo(x0 + x, y); } else { c.moveTo(x0 + x, y); b.moveTo(x0 + x, y); } }
    c.stroke(); b.stroke();
  }
  // carved border: two incised lines with a ring of teeth between them
  const inset = (d) => ({ x: fr.x + d, y: fr.y + d, w: fr.w - 2 * d, h: fr.h - 2 * d });
  const line = (d, lw, rad) => { const q = inset(d); for (const x of [c, b]) { x.strokeStyle = x === c ? 'rgba(12,4,0,0.72)' : 'rgb(40,40,40)'; x.lineWidth = lw; x.beginPath(); x.roundRect(q.x, q.y, q.w, q.h, rad); x.stroke(); } };
  line(11, 2.4, 22); line(33, 2.4, 14);
  const teeth = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.round(len / 14), a = Math.atan2(y1 - y0, x1 - x0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      for (const ctx of [c, b]) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-len / n / 2, 4.6); ctx.lineTo(0, -4.6); ctx.lineTo(len / n / 2, 4.6); ctx.closePath();
        if (ctx === c) { ctx.fillStyle = i % 2 ? 'rgba(14,5,0,0.6)' : B.inlay; ctx.globalAlpha = i % 2 ? 1 : 0.92; ctx.fill(); } else { ctx.fillStyle = i % 2 ? 'rgb(52,52,52)' : 'rgb(190,190,190)'; ctx.fill(); }
        ctx.restore();
      }
    }
  };
  { const q = inset(22); teeth(q.x + 14, q.y, q.x + q.w - 14, q.y); teeth(q.x + 14, q.y + q.h, q.x + q.w - 14, q.y + q.h); teeth(q.x, q.y + 14, q.x, q.y + q.h - 14); teeth(q.x + q.w, q.y + 14, q.x + q.w, q.y + q.h - 14); }
  // the sowing arrows and the centre rule
  const arrows = geo.arrows || [];
  for (const { y, dir, x0, x1 } of arrows) {
    const n = 9, st = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      const x = x0 + st * (i + 0.5); c.save(); c.translate(x, y); c.scale(dir, 1);
      c.strokeStyle = 'rgba(16,6,0,0.62)'; c.lineWidth = 3.4; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(-7, -10); c.lineTo(7, 0); c.lineTo(-7, 10); c.stroke();
      b.save(); b.translate(x, y); b.scale(dir, 1); b.strokeStyle = 'rgb(36,36,36)'; b.lineWidth = 3.6; b.lineCap = 'round'; b.lineJoin = 'round'; b.beginPath(); b.moveTo(-7, -10); b.lineTo(7, 0); b.lineTo(-7, 10); b.stroke(); b.restore();
      c.restore();
    }
  }
  if (geo.rule) { const R_ = geo.rule; for (const ctx of [c, b]) { ctx.strokeStyle = ctx === c ? B.inlay : 'rgb(170,170,170)'; ctx.globalAlpha = ctx === c ? 0.85 : 1; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(R_.x0, R_.y); ctx.lineTo(R_.x1, R_.y); ctx.stroke(); ctx.globalAlpha = 1; } }
  // worn halos round every house and inlaid rings; the two sides in different inlay tints
  for (let i = 0; i < 14; i++) {
    const P = geo.pit(i), R0 = geo.pitR, own = i < 7;
    const g = c.createRadialGradient(P.x, P.y, R0 * 0.9, P.x, P.y, R0 * 1.55); g.addColorStop(0, 'rgba(14,5,0,0.55)'); g.addColorStop(0.6, 'rgba(20,8,2,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(P.x, P.y, R0 * 1.55, 0, TAU); c.fill();
    c.strokeStyle = own ? '#f2c25a' : '#7fd0c4'; c.globalAlpha = 0.65; c.lineWidth = 2.4; c.beginPath(); c.arc(P.x, P.y, R0 * 1.22, 0, TAU); c.stroke(); c.globalAlpha = 1;
    b.strokeStyle = 'rgb(60,60,60)'; b.lineWidth = 3; b.beginPath(); b.arc(P.x, P.y, R0 * 1.22, 0, TAU); b.stroke();
  }
  for (const p of [0, 1]) {
    const T = geo.tray[p], g = c.createLinearGradient(T.x, T.y, T.x, T.y + T.h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.strokeStyle = p === 0 ? '#f2c25a' : '#7fd0c4'; c.globalAlpha = 0.6; c.lineWidth = 2.4; c.beginPath(); c.roundRect(T.x - 9, T.y - 9, T.w + 18, T.h + 18, Math.min(T.w, T.h) * 0.4 + 9); c.stroke(); c.globalAlpha = 1;
  }
  // warm sheen of the lamp
  const sh = c.createRadialGradient(fr.x + fr.w * 0.32, fr.y + fr.h * 0.25, 10, fr.x + fr.w * 0.5, fr.y + fr.h * 0.5, fr.w * 0.62); sh.addColorStop(0, 'rgba(255,225,180,0.10)'); sh.addColorStop(1, 'rgba(255,225,180,0)'); c.fillStyle = sh; c.fillRect(fr.x, fr.y, fr.w, fr.h);
  return { map: tex(col, true), bump: tex(bump, false) };
}

const rrShape = (hx, hz, rad) => {
  const s = new THREE.Shape(), r = Math.min(rad, hx, hz);
  s.moveTo(-hx + r, -hz); s.lineTo(hx - r, -hz); s.quadraticCurveTo(hx, -hz, hx, -hz + r); s.lineTo(hx, hz - r); s.quadraticCurveTo(hx, hz, hx - r, hz); s.lineTo(-hx + r, hz); s.quadraticCurveTo(-hx, hz, -hx, hz - r); s.lineTo(-hx, -hz + r); s.quadraticCurveTo(-hx, -hz, -hx + r, -hz);
  return s;
};

// Build the board for one geometry (tall or long) and wood. Group origin = board centre, y = 0 is the floor under it.
export function buildBoard(geo, wood = 'camwood', texW = 2048) {
  const g = new THREE.Group(), B = WOODS3[wood] || WOODS3.camwood, fr = geo.frame, hx = fr.w * K / 2, hz = fr.h * K / 2;
  const bt = 0.28, depth = THICK - 2 * bt;
  const shape = rrShape(hx - bt, hz - bt, 3.4);
  for (let i = 0; i < 14; i++) { const P = toWorld(geo, geo.pit(i).x, geo.pit(i).y), h = new THREE.Path(); h.absarc(P.x, -P.z, geo.pitR * K, 0, TAU, true); shape.holes.push(h); }
  for (const p of [0, 1]) {
    const T = geo.tray[p], C = toWorld(geo, T.x + T.w / 2, T.y + T.h / 2), ths = rrShape(T.w * K / 2, T.h * K / 2, Math.min(T.w, T.h) * K * 0.42);
    const pts = ths.getPoints(10).map((q) => new THREE.Vector2(q.x + C.x, q.y - C.z)); shape.holes.push(new THREE.Path(pts.reverse()));
  }
  const eg = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: bt, bevelSegments: 3, curveSegments: 20 });
  eg.rotateX(-Math.PI / 2); eg.translate(0, FOOT + bt, 0);
  // uv of the carved top: the whole frame maps onto the painted texture
  const pos = eg.attributes.position, uv = eg.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + hx) / (2 * hx), 1 - (pos.getZ(i) + hz) / (2 * hz));
  const t = paintTop(geo, wood, texW);
  const topMat = new THREE.MeshPhysicalMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 1.4, roughness: B.rough, metalness: 0, clearcoat: 0.28, clearcoatRoughness: 0.45, envMapIntensity: 0.5 });
  const sideC = canvas(256), sx = sideC.getContext('2d'), rr_ = lcg(8), sg = sx.createLinearGradient(0, 0, 0, 256); sg.addColorStop(0, B.edge[1]); sg.addColorStop(1, B.edge[2]); sx.fillStyle = sg; sx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 110; i++) { sx.strokeStyle = rr_() < 0.7 ? 'rgba(10,4,0,0.35)' : 'rgba(255,200,140,0.10)'; sx.lineWidth = 0.6 + rr_() * 1.8; const yy = rr_() * 256; sx.beginPath(); sx.moveTo(0, yy); for (let xx = 0; xx <= 256; xx += 16) sx.lineTo(xx, yy + Math.sin(xx / 30 + i) * 2); sx.stroke(); }
  const st = new THREE.CanvasTexture(sideC); st.wrapS = st.wrapT = THREE.RepeatWrapping; st.repeat.set(0.1, 0.1); st.colorSpace = THREE.SRGBColorSpace;
  const sideMat = new THREE.MeshStandardMaterial({ map: st, roughness: 0.55, envMapIntensity: 0.4 });
  const slab = new THREE.Mesh(eg, [topMat, sideMat]); slab.castShadow = true; slab.receiveShadow = true; g.add(slab);
  // the foot lip (a darker, slightly smaller rounded block)
  const lip = new THREE.ExtrudeGeometry(rrShape(hx - 1.1, hz - 1.1, 3), { depth: FOOT + 0.05, bevelEnabled: false, curveSegments: 14 }); lip.rotateX(-Math.PI / 2);
  const lipM = new THREE.Mesh(lip, new THREE.MeshStandardMaterial({ color: new THREE.Color(B.edge[2]).multiplyScalar(0.8), roughness: 0.7 })); lipM.castShadow = true; lipM.receiveShadow = true; g.add(lipM);
  // houses: burnished bowls (vertex-coloured, darker toward the bottom)
  const prof = [], N = 14; for (let i = 0; i <= N; i++) { const uu = i / N; prof.push(new THREE.Vector2(Math.max(0.001, uu * geo.pitR * K * 1.002), TOPY - PIT_D * Math.pow(1 - uu * uu, 0.85) - 0.02)); }
  const bowl = new THREE.LatheGeometry(prof, 36), cs = [], c0 = new THREE.Color(B.pit[0]), c1 = new THREE.Color(B.pit[1]), tmp = new THREE.Color();
  for (let i = 0; i < bowl.attributes.position.count; i++) { const y = bowl.attributes.position.getY(i), f = 1 - (TOPY - y) / PIT_D; tmp.copy(c0).lerp(c1, Math.min(1, Math.max(0, f * f))); cs.push(tmp.r, tmp.g, tmp.b); }
  bowl.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
  const bowlMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, envMapIntensity: 0.6, side: THREE.DoubleSide });
  for (let i = 0; i < 14; i++) { const P = toWorld(geo, geo.pit(i).x, geo.pit(i).y), m = new THREE.Mesh(bowl, bowlMat); m.position.set(P.x, 0, P.z); m.receiveShadow = true; g.add(m); }
  // troughs: a darker floor
  for (const p of [0, 1]) {
    const T = geo.tray[p], C = toWorld(geo, T.x + T.w / 2, T.y + T.h / 2);
    const fl = new THREE.ExtrudeGeometry(rrShape(T.w * K / 2 + 0.1, T.h * K / 2 + 0.1, Math.min(T.w, T.h) * K * 0.42), { depth: 0.4, bevelEnabled: false, curveSegments: 10 }); fl.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(fl, new THREE.MeshStandardMaterial({ color: new THREE.Color(B.pit[1]).multiplyScalar(0.8), roughness: 0.42 })); m.position.set(C.x, TOPY - TRAY_D - 0.4, C.z); m.receiveShadow = true; g.add(m);
  }
  // brass studs at the corners
  const brass = new THREE.MeshStandardMaterial({ color: 0xdcae48, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.3 }), stud = new THREE.SphereGeometry(1, 14, 10), sm = new THREE.InstancedMesh(stud, brass, 4), m4 = new THREE.Matrix4();
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b2], i) => sm.setMatrixAt(i, m4.compose(new THREE.Vector3(a * (hx - 2.4), TOPY + 0.04, b2 * (hz - 2.4)), new THREE.Quaternion(), new THREE.Vector3(0.62, 0.3, 0.62))));
  sm.castShadow = true; g.add(sm);
  g.userData.dispose = () => { eg.dispose(); topMat.dispose(); t.map.dispose(); t.bump.dispose(); st.dispose(); };
  return g;
}

// ---------------------------------------------------------------- seeds: river stones, palm kernels, trade beads
export const SEEDSETS3 = {
  stones: { tints: ['#6b6962', '#7d7568', '#57554e', '#8a8272'], rough: 0.55, clear: 0.25, shape: [1.1, 0.78, 0.94], noise: 0.07 },
  nuts: { tints: ['#5a3418', '#6a3f1d', '#4a2a12', '#7a4b24'], rough: 0.4, clear: 0.4, shape: [1.18, 0.82, 0.86], noise: 0.04 },
  glass: { tints: ['#2a58c8', '#c4402f', '#e6a43a', '#e8e2d0'], rough: 0.12, clear: 1, shape: [1.0, 0.92, 1.0], noise: 0.0 },
};
export function seedKit(set) {
  const S = SEEDSETS3[set] || SEEDSETS3.stones, geo = new THREE.SphereGeometry(1, 22, 16), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + (Math.sin(x * 3.1 + z * 2.3) * Math.cos(y * 2.7 + x * 1.9) + Math.sin(z * 4.3 - y * 3.1) * 0.5) * S.noise;
    p.setXYZ(i, x * SEED_R * S.shape[0] * k, y * SEED_R * S.shape[1] * k, z * SEED_R * S.shape[2] * k);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: S.rough, clearcoat: S.clear, clearcoatRoughness: 0.18, envMapIntensity: set === 'glass' ? 1.3 : 0.7 });
  const tints = S.tints.map((h) => new THREE.Color(h));
  return { geo, mat, tint: (v) => tints[v % tints.length] };
}
// resting place of seed k in house `key`, in cm from the house centre (stable: adding a seed never moves the others)
const LAYERS = [[0, 0, 0], ...Array.from({ length: 6 }, (_, i) => [2.3, i * TAU / 6, 0]), ...Array.from({ length: 9 }, (_, i) => [3.35, i * TAU / 9 + 0.3, 0.15]), ...Array.from({ length: 5 }, (_, i) => [1.3, i * TAU / 5 + 0.5, 1.65]), ...Array.from({ length: 7 }, (_, i) => [2.8, i * TAU / 7 + 0.2, 1.85]), ...Array.from({ length: 3 }, (_, i) => [0.9, i * TAU / 3, 3.0])];
export function seedSlot(key, k, pitR = 4) {
  let rad, a, lift;
  if (k < LAYERS.length) { [rad, a, lift] = LAYERS[k]; a += key * 1.3; }
  else { const j = k - LAYERS.length; rad = 0.7 + ((j * 7) % 5) * 0.45; a = j * 2.3999 + key; lift = 3.0 + Math.floor(j / 6) * 0.9; }
  rad *= pitR / 4;
  const jx = (hash(key, k * 3 + 1) - 0.5) * 0.22, jz = (hash(key, k * 3 + 2) - 0.5) * 0.22;
  const x = Math.cos(a) * rad + jx, z = Math.sin(a) * rad + jz, uu = Math.min(1, Math.hypot(x, z) / pitR);
  return { x, z, y: TOPY - PIT_D * Math.pow(1 - uu * uu, 0.85) + SEED_R * 0.78 + lift, rot: hash(key, k) * TAU, tx: (hash(key, k + 40) - 0.5) * 1.1, tz: (hash(key, k + 80) - 0.5) * 1.1, v: Math.floor(hash(key + 3, k) * 4) };
}

// ---------------------------------------------------------------- the setting: indigo cloth, raffia mat, oil lamp, calabash, leaves
function paintCloth(W, H) {
  const c = canvas(W, H), x = c.getContext('2d'), r = lcg(19);
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1b2a66'); g.addColorStop(1, '#0f1842'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 2600; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '120,150,255' : '0,0,20'},${0.04 + r() * 0.06})`; x.fillRect(r() * W, r() * H, 1 + r() * 7, 1); }
  // resist-dyed diamonds in a grid, with nested outlines
  const u = Math.round(W / 18);
  x.lineJoin = 'miter';
  for (let gy = u / 2; gy < H; gy += u) for (let gx = u / 2; gx < W; gx += u) {
    const off = Math.round(gy / u) % 2 ? u / 2 : 0, cx = gx + off - u / 2 * 0, cy = gy;
    for (let n = 0; n < 3; n++) { const rr = u * 0.42 * (1 - n * 0.3); x.strokeStyle = n === 1 ? '#e0a63a' : 'rgba(240,244,255,0.9)'; x.lineWidth = Math.max(1.5, u * 0.04); x.beginPath(); x.moveTo(cx, cy - rr); x.lineTo(cx + rr, cy); x.lineTo(cx, cy + rr); x.lineTo(cx - rr, cy); x.closePath(); x.stroke(); }
    x.fillStyle = '#f4f7ff'; x.beginPath(); x.arc(cx, cy, u * 0.05, 0, TAU); x.fill();
  }
  x.strokeStyle = '#e0a63a'; x.lineWidth = u * 0.09; x.strokeRect(u * 0.18, u * 0.18, W - u * 0.36, H - u * 0.36);
  x.strokeStyle = 'rgba(244,247,255,0.8)'; x.lineWidth = u * 0.03; x.strokeRect(u * 0.34, u * 0.34, W - u * 0.68, H - u * 0.68);
  return tex(c, true, 8);
}
function paintRaffia(S_) {
  const c = canvas(S_), x = c.getContext('2d'), r = lcg(5);
  x.fillStyle = '#1b3a22'; x.fillRect(0, 0, S_, S_);
  const w = 14;
  for (let row = 0; row < S_ / w; row++) for (let col = 0; col < S_ / w; col++) {
    const over = (row + col) % 2, v = 0.7 + r() * 0.5, px = col * w, py = row * w;
    x.fillStyle = `rgb(${Math.round(34 * v)},${Math.round(80 * v)},${Math.round(44 * v)})`;
    if (over) x.fillRect(px, py + 1, w, w - 2); else x.fillRect(px + 1, py, w - 2, w);
    x.fillStyle = `rgba(190,230,150,${0.05 + r() * 0.1})`; if (over) x.fillRect(px, py + 2, w, 1.2); else x.fillRect(px + 2, py, 1.2, w);
    x.fillStyle = 'rgba(0,10,0,0.4)'; if (over) x.fillRect(px, py + w - 2, w, 1.5); else x.fillRect(px + w - 2, py, 1.5, w);
  }
  const t = tex(c, true, 8); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
export const glowTex = (rgb = '255,255,255', a = 1, inner = 0) => {
  const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 64 * inner, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${inner ? 0 : a})`); if (inner) g.addColorStop(Math.min(0.95, inner + 0.12), `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};
function paintLeaf() {
  const c = canvas(512, 128), x = c.getContext('2d'), r = lcg(3);
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#2d6a35'); g.addColorStop(0.5, '#1d4f2a'); g.addColorStop(1, '#133a1f'); x.fillStyle = g; x.fillRect(0, 0, 512, 128);
  x.strokeStyle = 'rgba(170,230,140,0.55)'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 64); x.lineTo(512, 64); x.stroke();
  for (let i = 0; i < 70; i++) { const px = i * 7.4, dir = i % 2 ? 1 : -1; x.strokeStyle = `rgba(150,215,120,${0.16 + r() * 0.12})`; x.lineWidth = 1.2; x.beginPath(); x.moveTo(px, 64); x.lineTo(px + 30, 64 + dir * 62); x.stroke(); }
  return tex(c, true, 4);
}
function lamp() {
  const grp = new THREE.Group(), clay = new THREE.MeshStandardMaterial({ color: 0x4a2a1a, roughness: 0.6, envMapIntensity: 0.5 });
  const prof = [[0.01, 0], [2.6, 0], [3.8, 0.7], [4.4, 1.9], [3.9, 3.0], [2.6, 3.5], [3.2, 3.9], [3.0, 4.2], [1.6, 3.9], [0.01, 3.8]].map(([a, b]) => new THREE.Vector2(a, b));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), clay); body.castShadow = true; body.receiveShadow = true; grp.add(body);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.2, 3.2, 12), clay); spout.position.set(4.3, 3.2, 0); spout.rotation.z = -1.0; grp.add(spout);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.1, 0.28, 8, 36), new THREE.MeshStandardMaterial({ color: 0xc98b3b, roughness: 0.5, metalness: 0.5 })); ring.rotation.x = Math.PI / 2; ring.position.y = 1.9; grp.add(ring);
  return grp;
}
function calabash() {
  const grp = new THREE.Group();
  const prof = []; for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI * 0.5; prof.push(new THREE.Vector2(Math.max(0.01, Math.sin(a) * 6.2), 6.2 - Math.cos(a) * 6.2)); }
  prof.push(new THREE.Vector2(6.0, 6.2), new THREE.Vector2(5.5, 6.2));
  const m = new THREE.MeshStandardMaterial({ color: 0xa8702f, roughness: 0.55, side: THREE.DoubleSide, envMapIntensity: 0.5 });
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 36), m); body.scale.set(1, 0.78, 1); body.castShadow = true; body.receiveShadow = true; grp.add(body);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(6.05, 0.3, 8, 36), new THREE.MeshStandardMaterial({ color: 0x3a1f0d, roughness: 0.6 })); rim.rotation.x = Math.PI / 2; rim.position.y = 4.85; grp.add(rim);
  return grp;
}

export function buildSetting(scene, geo, { quality = 1 } = {}) {
  const g = new THREE.Group(); scene.add(g);
  const fr = geo.frame, hx = fr.w * K / 2, hz = fr.h * K / 2;
  // woven raffia mat, falling away into the dark
  const rt = paintRaffia(512); rt.repeat.set(26, 26);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshStandardMaterial({ map: rt, roughness: 0.96, color: 0x6f806a, envMapIntensity: 0.2 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.4; floor.receiveShadow = true; g.add(floor);
  // a pool of light: the room falls away into the dark toward the edges of the view
  { const pc = canvas(256), px = pc.getContext('2d'), gr = px.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(3,8,5,0)'); gr.addColorStop(0.3, 'rgba(3,8,5,0)'); gr.addColorStop(0.62, 'rgba(3,8,5,0.62)'); gr.addColorStop(0.85, 'rgba(3,8,5,0.99)'); gr.addColorStop(1, 'rgba(3,8,5,1)'); px.fillStyle = gr; px.fillRect(0, 0, 256, 256);
    const pt = new THREE.CanvasTexture(pc); pt.colorSpace = THREE.SRGBColorSpace; const pool = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), new THREE.MeshBasicMaterial({ map: pt, transparent: true, depthWrite: false, fog: false })); pool.rotation.x = -Math.PI / 2; pool.position.y = -0.2; pool.renderOrder = 0; g.add(pool); }
  // the indigo cloth under the board
  const cw = 2 * hx + 17, ch = 2 * hz + 17, ct = paintCloth(Math.round(1024), Math.round(1024 * ch / cw));
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch, 24, 12), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.92, envMapIntensity: 0.3 }));
  const cp = cloth.geometry.attributes.position; for (let i = 0; i < cp.count; i++) { const px = cp.getX(i), py = cp.getY(i), e = Math.max(0, 1 - Math.hypot(px / (cw / 2), py / (ch / 2))); cp.setZ(i, 0.1 + Math.sin(px * 0.35) * Math.cos(py * 0.3) * 0.08 * (1 - Math.min(1, e * 3))); }
  cloth.geometry.computeVertexNormals(); cloth.rotation.x = -Math.PI / 2; cloth.position.y = -0.05; cloth.receiveShadow = true; g.add(cloth);
  // props at the back: oil lamp left, calabash right, a few broad leaves
  const lp = lamp(); lp.position.set(-hx * 0.62 - 6, 0, -hz - 11.5); lp.rotation.y = 0.4; g.add(lp);
  const lampPos = new THREE.Vector3(lp.position.x + 4.6, 5.2, lp.position.z);
  const cb = calabash(); cb.position.set(hx * 0.66 + 5, 0, -hz - 13); g.add(cb);
  const cseeds = []; const sk = seedKit('nuts'), cm = new THREE.InstancedMesh(sk.geo, sk.mat, 14); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 14; i++) { const a = i * 2.4, rr = 0.7 + (i % 3) * 1.15, y = 1.6 + (i > 8 ? 1.4 : 0); e.set(hash(i, 1) * 3, hash(i, 2) * 6, hash(i, 3) * 3); q.setFromEuler(e); cm.setMatrixAt(i, m4.compose(new THREE.Vector3(cb.position.x + Math.cos(a) * rr, y + 0.9, cb.position.z + Math.sin(a) * rr), q, new THREE.Vector3(1, 1, 1))); cm.setColorAt(i, sk.tint(i)); cseeds.push(i); }
  cm.castShadow = true; g.add(cm);
  const leafT = paintLeaf();
  const leaf = (x, z, ry, len, rise) => {
    const geoL = new THREE.PlaneGeometry(len, len * 0.3, 14, 2), p = geoL.attributes.position;
    for (let i = 0; i < p.count; i++) { const px = p.getX(i) / len + 0.5, py = p.getY(i); p.setZ(i, Math.pow(px, 1.6) * rise * -1 + py * 0.25); p.setY(i, py * (1 - Math.pow(px, 3) * 0.55)); }
    geoL.computeVertexNormals();
    const m = new THREE.Mesh(geoL, new THREE.MeshStandardMaterial({ map: leafT, roughness: 0.7, side: THREE.DoubleSide, envMapIntensity: 0.3 })); m.position.set(x, 3.4, z); m.rotation.set(-Math.PI / 2 + 0.5, ry, 0); m.rotation.order = 'YXZ'; m.castShadow = quality > 0; g.add(m);
  };
  leaf(-hx - 14, -hz - 4, 1.2, 46, 14); leaf(hx + 15, -hz - 8, -1.35, 50, 15);
  // lamp flame: an additive sprite + a warm point light
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('255,214,150', 1), color: 0xffc27a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false })); flame.scale.set(7, 9, 1); flame.position.copy(lampPos).add(new THREE.Vector3(0, 0.6, 0)); g.add(flame);
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('255,255,235', 1), color: 0xfff0c8, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false })); core.scale.set(1.6, 2.6, 1); core.position.copy(lampPos); g.add(core);
  const pl = new THREE.PointLight(0xffa850, 900, 0, 2); pl.position.copy(lampPos).add(new THREE.Vector3(0, 3, 6)); g.add(pl);
  // a few drifting sparks of warm dust
  const N = 36, pg = new THREE.BufferGeometry(), pa = new Float32Array(N * 3), sd = new Float32Array(N), r = lcg(77); for (let i = 0; i < N; i++) sd[i] = r();
  pg.setAttribute('position', new THREE.BufferAttribute(pa, 3));
  const motes = new THREE.Points(pg, new THREE.PointsMaterial({ size: 1.5, map: glowTex('255,214,150', 0.9), transparent: true, depthWrite: false, opacity: 0.55, blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: true })); motes.frustumCulled = false; g.add(motes);
  return { group: g, flame, core, pl, lampPos, motes, seeds: sd, hx, hz };
}

// warm lamp-light key from the front-left, deep blue-green sky fill, a copper rim from behind
export function buildLights(scene, hx = 34, hz = 34) {
  const sun = new THREE.DirectionalLight(0xffd9a6, 2.5); sun.position.set(-55, 100, 70); sun.target.position.set(0, 0, 0);
  const ext = Math.max(hx, hz) + 14; Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 30, far: 320 }); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
  const hemi = new THREE.HemisphereLight(0x4a6d82, 0x2b1a10, 0.5);
  const fill = new THREE.DirectionalLight(0x8fb4d8, 0.35); fill.position.set(70, 50, 100);
  const rim = new THREE.DirectionalLight(0xff9a56, 1.1); rim.position.set(30, 40, -120);
  scene.add(sun, sun.target, hemi, fill, rim);
  return { sun, hemi, fill, rim };
}

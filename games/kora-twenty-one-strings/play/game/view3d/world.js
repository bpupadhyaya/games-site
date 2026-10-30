// Kora 3D world: the instrument and the courtyard it is played in. Units are centimetres. Pure scene building (no game state):
// the presenter (presenter.js) and the icon page (icon.js) both build from here.
//
// Instrument space: the cowhide face lies in the plane y = 0 (normal +y), the bridge stands on it along the x axis at z = 0,
// the neck runs away along -z, the iron tail ring sits at the near rim (+z). Strings are lines from the bridge notches (y = H)
// to leather rings on the neck; their exact positions come from outside (the play page maps them onto the 2D lanes).
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { STRING_COUNT, handOf } from '../src/music.js';
import { drawBackdrop } from '../src/art.js';

const TAU = Math.PI * 2;
const mkRand = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const texOf = (c, srgb = true, rep = null) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };

// ---------------------------------------------------------------------------------------------------- textures (procedural, cached)
const cache = new Map();
const once = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
export function clearWorldCache() { for (const v of cache.values()) for (const t of [].concat(v)) t?.dispose?.(); cache.clear(); B.disposeMaterialCache(); }

// The cowhide face: shaved hide, cream to honey, darker where it wraps the rim, faint fibres and a few natural darker patches.
function hideCanvas(size = 1024) {
  const c = cv(size), g = c.getContext('2d'), R = mkRand(19), m = size / 2;
  const base = g.createRadialGradient(m * 0.8, m * 0.75, size * 0.05, m, m, m);
  base.addColorStop(0, '#f3e2bb'); base.addColorStop(0.55, '#e2c590'); base.addColorStop(0.86, '#c49a5c'); base.addColorStop(1, '#7a4f25');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 9; i++) {                                                     // soft natural patches of the hide
    const x = m + (R() - 0.5) * size * 0.8, y = m + (R() - 0.5) * size * 0.8, r = size * (0.04 + R() * 0.1);
    const pg = g.createRadialGradient(x, y, 0, x, y, r); pg.addColorStop(0, `rgba(150,96,46,${0.12 + R() * 0.12})`); pg.addColorStop(1, 'rgba(150,96,46,0)');
    g.fillStyle = pg; g.beginPath(); g.ellipse(x, y, r * (1 + R()), r, R() * 3, 0, TAU); g.fill();
  }
  g.lineCap = 'round';
  for (let i = 0; i < 2600; i++) {                                                  // fibres
    const x = R() * size, y = R() * size, a = R() * 0.6 - 0.3 + Math.PI * 0.25, l = 3 + R() * 14;
    g.strokeStyle = R() > 0.5 ? `rgba(255,246,222,${0.05 + R() * 0.08})` : `rgba(110,70,30,${0.04 + R() * 0.07})`; g.lineWidth = 0.6 + R() * 0.9;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let i = 0; i < 9; i++) {                                                     // long creases where the hide was stretched
    const x0 = m + (R() - 0.5) * size * 0.7, y0 = m + (R() - 0.5) * size * 0.7;
    g.strokeStyle = 'rgba(120,80,40,0.12)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x0, y0);
    g.quadraticCurveTo(x0 + (R() - 0.5) * 200, y0 + (R() - 0.5) * 100, x0 + (R() - 0.5) * 340, y0 + (R() - 0.5) * 140); g.stroke();
  }
  // pinched pleats at the rim where the hide is pulled over the gourd and nailed
  for (let i = 0; i < 64; i++) { const a = i / 64 * TAU; g.strokeStyle = 'rgba(90,52,20,0.22)'; g.lineWidth = 2; g.beginPath(); g.moveTo(m + Math.cos(a) * m * 0.9, m + Math.sin(a) * m * 0.9); g.lineTo(m + Math.cos(a) * m, m + Math.sin(a) * m); g.stroke(); }
  return c;
}
// The gourd shell: amber varnish over mottled growth patterns, with fine longitudinal ribs.
function gourdCanvas(w = 1024, h = 512) {
  const c = cv(w, h), g = c.getContext('2d'), R = mkRand(5);
  const base = g.createLinearGradient(0, 0, 0, h); base.addColorStop(0, '#d48a3c'); base.addColorStop(0.45, '#b06326'); base.addColorStop(1, '#5e2a0c');
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const x = R() * w, y = R() * h, r = 6 + R() * 40;
    g.fillStyle = R() > 0.5 ? `rgba(255,190,110,${0.04 + R() * 0.07})` : `rgba(70,28,8,${0.05 + R() * 0.09})`;
    g.beginPath(); g.ellipse(x, y, r * 1.8, r, 0, 0, TAU); g.fill();
  }
  for (let i = 0; i < 90; i++) { const x = R() * w; g.strokeStyle = `rgba(60,22,6,${0.05 + R() * 0.08})`; g.lineWidth = 1 + R() * 2; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 10, h * 0.3, x - 10, h * 0.6, x + (R() - 0.5) * 20, h); g.stroke(); }
  return c;
}
// A plaited palm-leaf mat with dyed bands (the instrument rests on it), and a bump map from the same weave.
function matCanvas(size = 1024) {
  const c = cv(size), g = c.getContext('2d'), R = mkRand(41), n = 96, s = size / n;
  const band = (j) => { const k = j % 48; return k === 20 || k === 21 ? '#7a2a1c' : k === 23 ? '#2a2420' : null; };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const over = (i + j) % 2 === 0, col = band(over ? i : j) || (over ? '#b48a52' : '#a07a46');
    g.fillStyle = col; g.fillRect(i * s, j * s, s, s);
    const gr = over ? g.createLinearGradient(i * s, 0, i * s + s, 0) : g.createLinearGradient(0, j * s, 0, j * s + s);
    gr.addColorStop(0, 'rgba(0,0,0,0.28)'); gr.addColorStop(0.5, 'rgba(255,240,210,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = gr; g.fillRect(i * s, j * s, s, s);
    g.fillStyle = `rgba(${R() > 0.5 ? '255,235,200' : '40,20,6'},${R() * 0.06})`; g.fillRect(i * s, j * s, s, s);
  }
  return c;
}
// Laterite courtyard floor: red earth, swept.
function earthCanvas(size = 512) {
  const c = cv(size), g = c.getContext('2d'), R = mkRand(3);
  g.fillStyle = '#5a2a1a'; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 4000; i++) { g.fillStyle = R() > 0.5 ? `rgba(160,84,48,${R() * 0.25})` : `rgba(40,14,6,${R() * 0.25})`; g.fillRect(R() * size, R() * size, 1 + R() * 3, 1 + R() * 3); }
  for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(30,10,4,0.12)'; g.lineWidth = 1; g.beginPath(); const y = R() * size; g.moveTo(0, y); g.bezierCurveTo(size * 0.3, y + 20, size * 0.6, y - 20, size, y + (R() - 0.5) * 30); g.stroke(); }
  return c;
}
export const materials = () => once('mats', () => {
  const hide = hideCanvas(), gourd = gourdCanvas(), mat = matCanvas(), earth = earthCanvas();
  const m = {
    skin: new THREE.MeshStandardMaterial({ map: texOf(hide), bumpMap: texOf(hide, false), bumpScale: 0.6, roughness: 0.72, metalness: 0, side: THREE.DoubleSide }),
    gourd: new THREE.MeshPhysicalMaterial({ map: texOf(gourd), roughness: 0.42, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.22 }),
    gourdIn: new THREE.MeshStandardMaterial({ color: 0x2a1206, roughness: 0.95, side: THREE.BackSide }),
    neck: B.material('darkWood', { seed: 11 }),
    bridge: B.material('darkWood', { color: '#5a2e14', color2: '#7d4522', seed: 7 }),
    post: B.material('wood', { color: '#9a5a2c', color2: '#c4864c', seed: 9 }),
    brass: B.material('brass'),
    leather: new THREE.MeshStandardMaterial({ color: 0x6a3418, roughness: 0.8, metalness: 0 }),
    leatherDark: new THREE.MeshStandardMaterial({ color: 0x3c1c0c, roughness: 0.85 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x2c2a28, roughness: 0.5, metalness: 0.85 }),
    hole: new THREE.MeshBasicMaterial({ color: 0x0a0402 }),
    string: new THREE.MeshStandardMaterial({ color: 0xfff4dc, roughness: 0.35, metalness: 0, emissive: 0x3a2a14, emissiveIntensity: 0.6 }),
    stringGlow: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
    mat: new THREE.MeshStandardMaterial({ map: texOf(mat, true, [2, 2]), bumpMap: texOf(mat, false, [2, 2]), bumpScale: 1.0, roughness: 0.92 }),
    earth: new THREE.MeshStandardMaterial({ map: texOf(earth, true, [5, 5]), roughness: 1 }),
  };
  return m;
});

// ---------------------------------------------------------------------------------------------------- the calabash (unit radius; scale by R)
// A half gourd (rim at y = 0, bowl below), the hide face (slightly domed), the rim fold, two rows of brass tacks and a sound hole.
export function calabash() {
  const M = materials(), g = new THREE.Group();
  const prof = [];
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI / 2; prof.push(new THREE.Vector2(Math.max(0.001, Math.cos(a) * 1.0), -Math.sin(a) * 0.86)); }
  prof.reverse();                                                                 // from the bottom pole to the rim
  const shell = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), M.gourd); shell.castShadow = true; shell.receiveShadow = true; g.add(shell);
  const inner = new THREE.Mesh(new THREE.LatheGeometry(prof.map((v) => new THREE.Vector2(v.x * 0.97, v.y * 0.97)), 48), M.gourdIn); g.add(inner);
  // the face: a gentle dome, planar UVs
  const fp = []; for (let i = 0; i <= 16; i++) { const r = i / 16 * 0.985; fp.push(new THREE.Vector2(Math.max(0.0001, r), 0.022 * (1 - r * r))); }
  const fg = new THREE.LatheGeometry(fp, 96), pos = fg.attributes.position, uv = fg.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) * 0.5 + 0.5, 0.5 - pos.getZ(i) * 0.5);
  const face = new THREE.Mesh(fg, M.skin); face.receiveShadow = true; face.castShadow = false; g.add(face);
  // the hide folds over the rim: a leather-coloured torus lip
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.99, 0.025, 10, 120), M.leather); lip.rotation.x = Math.PI / 2; lip.castShadow = true; g.add(lip);
  // brass tacks: an outer ring, an inner staggered ring and small diamonds of four at the quarters
  const tg = new THREE.SphereGeometry(1, 12, 6, 0, TAU, 0, Math.PI / 2); tg.scale(0.018, 0.012, 0.018);
  const spots = [];
  for (let i = 0; i < 72; i++) { const a = i / 72 * TAU; spots.push([Math.cos(a) * 0.935, Math.sin(a) * 0.935]); }
  for (let i = 0; i < 36; i++) { const a = (i + 0.5) / 36 * TAU; spots.push([Math.cos(a) * 0.885, Math.sin(a) * 0.885]); }
  for (let q = 0; q < 8; q++) { const a = (q + 0.5) / 8 * TAU, r = 0.8; for (const [dr, da] of [[0, 0], [-0.04, 0], [-0.02, 0.025], [-0.02, -0.025]]) spots.push([Math.cos(a + da) * (r + dr), Math.sin(a + da) * (r + dr)]); }
  const tacks = new THREE.InstancedMesh(tg, M.brass, spots.length), mx = new THREE.Matrix4();
  spots.forEach(([x, z], i) => { const y = 0.022 * (1 - (x * x + z * z)) + 0.001; mx.makeTranslation(x, y, z); tacks.setMatrixAt(i, mx); });
  tacks.castShadow = false; g.add(tacks);
  // the sound hole in the side of the shell, facing the player's right
  const ha = -0.5, hp = 0.55, hr = 0.11, hx = Math.cos(ha) * Math.cos(hp) * 1.0, hz = Math.sin(ha) * Math.cos(hp) * 1.0, hy = -Math.sin(hp) * 0.86;
  const nrm = new THREE.Vector3(hx, hy / 0.86 * 1.16, hz).normalize();
  const hole = new THREE.Mesh(new THREE.CircleGeometry(hr, 32), M.hole); hole.position.set(hx * 1.003, hy * 1.003, hz * 1.003); hole.lookAt(hole.position.clone().add(nrm)); g.add(hole);
  const hl = new THREE.Mesh(new THREE.TorusGeometry(hr, 0.012, 8, 40), M.gourd); hl.position.copy(hole.position); hl.lookAt(hl.position.clone().add(nrm)); g.add(hl);
  return g;
}

// ---------------------------------------------------------------------------------------------------- the whole instrument
// spec: { R: calabash radius, H: bridge height, bx[21]: bridge x of each string, far: { z, k } where strings reach the lanes' far end
//         (string i passes x = bx[i] * k at z), neckZ: where the strings end on the neck (negative), neckY: neck height at its end }
// Returns { group, setSpec(spec), setAmps(amps, t, dim[]), strings: endpoints for the presenter }.
export function kora() {
  const M = materials(), root = new THREE.Group();
  const cal = calabash(); root.add(cal);
  const bridge = new THREE.Group(); root.add(bridge);
  const neckG = new THREE.Group(); root.add(neckG);
  const posts = new THREE.Group(); root.add(posts);
  // strings: a unit cylinder along +y, instanced; the main run (bridge -> neck), the tail run (bridge -> tail ring) and the glow run
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); cyl.translate(0, 0.5, 0);
  const run = new THREE.InstancedMesh(cyl, M.string, STRING_COUNT); run.castShadow = true;
  const tail = new THREE.InstancedMesh(cyl, M.string, STRING_COUNT); tail.castShadow = true;
  const glow = new THREE.InstancedMesh(cyl, M.stringGlow, STRING_COUNT); glow.frustumCulled = false; run.frustumCulled = false; tail.frustumCulled = false;
  for (let i = 0; i < STRING_COUNT; i++) glow.setColorAt(i, new THREE.Color(0));
  root.add(run, tail, glow);
  const rings = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.32, 8, 20), M.leather, STRING_COUNT); rings.castShadow = true; root.add(rings);
  const tailRing = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.32, 8, 24), M.iron); root.add(tailRing);
  const ends = Array.from({ length: STRING_COUNT }, () => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0.1 }));
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  const seg = (mesh, i, a, b, r) => { _d.subVectors(b, a); const len = _d.length() || 0.001; _q.setFromUnitVectors(_up, _d.multiplyScalar(1 / len)); _s.set(r, len, r); _m.compose(a, _q, _s); mesh.setMatrixAt(i, _m); };
  let spec = null, tailPt = new THREE.Vector3();
  const disposeGroup = (gr) => { while (gr.children.length) { const o = gr.children.pop(); o.geometry?.dispose?.(); } };

  function setSpec(s) {
    spec = s; const { R, H } = s, bx = s.bx;
    cal.scale.setScalar(R);
    const x0 = Math.min(...bx), x1 = Math.max(...bx), span = x1 - x0;
    // ---- bridge: a carved upright plank on two feet; a notch for every string, the two rows at two heights
    disposeGroup(bridge);
    const bw = span + Math.max(3, H * 0.3), th = Math.max(1.4, H * 0.14);
    const sh = new THREE.Shape();
    const foot = Math.min(bw * 0.18, 6), arch = H * 0.36;
    sh.moveTo(-bw / 2, 0); sh.lineTo(-bw / 2 + foot, 0); sh.quadraticCurveTo(0, arch * 1.1, bw / 2 - foot, 0); sh.lineTo(bw / 2, 0);
    sh.lineTo(bw / 2 - 0.4, H * 0.86); sh.quadraticCurveTo(bw / 2 - 0.6, H + 0.4, bw / 2 - 2, H + 0.3); sh.lineTo(-bw / 2 + 2, H + 0.3); sh.quadraticCurveTo(-bw / 2 + 0.6, H + 0.4, -bw / 2 + 0.4, H * 0.86); sh.closePath();
    const pg = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 2, curveSegments: 16 }); pg.translate(0, 0, -th / 2);
    const plank = new THREE.Mesh(pg, M.bridge); plank.castShadow = true; plank.receiveShadow = true; bridge.add(plank);
    const ng = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < STRING_COUNT; i++) {                                         // dark notches; odd strings sit a little lower (the second row)
      const n = new THREE.Mesh(ng, M.leatherDark), low = i % 2 === 1 ? 0.45 : 0;
      n.scale.set(Math.min(0.5, span / 60), 0.9 + low, th + 0.7); n.position.set(bx[i], H - 0.1 - low * 0.5, 0); bridge.add(n);
    }
    const bs = B.contactShadow(bw * 0.5, 0.55); bs.scale.set(1, 0.14, 1); bs.position.set(0, 0.05, th * 0.6); bridge.add(bs);
    // ---- neck: comes out of the far rim, rises under the strings and runs on, leather rings where strings are tied
    disposeGroup(neckG);
    const nr = s.neckR ?? Math.max(2.2, R * 0.075), nz = s.neckZ, ny = H - nr - 0.25;
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -R * 0.45, -R * 0.45), new THREE.Vector3(0, -R * 0.08, -R * 1.0), new THREE.Vector3(0, ny * 0.6, -R * 1.0 + (nz + R) * 0.35), new THREE.Vector3(0, ny, -R + (nz + R) * 0.7), new THREE.Vector3(0, ny, nz - 18)]);
    const neck = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, nr, 14, false), M.neck); neck.castShadow = true; neck.receiveShadow = true; neckG.add(neck);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(nr * 1.05, 14, 10), M.leatherDark); cap.position.set(0, ny, nz - 18); neckG.add(cap);
    // ---- the two hand posts, through the hide either side of the bridge, running parallel to the neck
    disposeGroup(posts);
    const px = Math.max(Math.abs(x0), Math.abs(x1)) + Math.max(2.5, H * 0.35), pr = Math.max(1.1, R * 0.04);
    for (const sx of [-1, 1]) {
      const a = new THREE.Vector3(sx * px, 0, R * 0.32), b = new THREE.Vector3(sx * px * 0.96, H * 1.25, -R * 0.62);
      const geo = new THREE.CylinderGeometry(pr * 0.85, pr, a.distanceTo(b), 12); geo.translate(0, a.distanceTo(b) / 2, 0);
      const p = new THREE.Mesh(geo, M.post); p.position.copy(a); p.quaternion.setFromUnitVectors(_up, b.clone().sub(a).normalize()); p.castShadow = true; posts.add(p);
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(pr * 1.12, pr * 1.12, a.distanceTo(b) * 0.22, 12), M.leather); wrap.position.copy(a.clone().lerp(b, 0.62)); wrap.quaternion.copy(p.quaternion); posts.add(wrap);
    }
    // ---- strings
    tailPt.set(0, -R * 0.12, R * 1.04); tailRing.position.copy(tailPt); tailRing.scale.setScalar(Math.max(0.8, R / 26));
    const fz = s.far.z, k = s.far.k, zc = fz / (1 - k);                                // all strings meet (x = 0) at z = zc
    for (let i = 0; i < STRING_COUNT; i++) {
      const e = ends[i], thick = (s.thick ?? 0.16) * (1.45 - 0.9 * i / (STRING_COUNT - 1));
      e.a.set(bx[i], H, 0);
      const zEnd = zc * (0.8 + 0.17 * Math.abs(bx[i]) / Math.max(1e-6, Math.max(Math.abs(x0), Math.abs(x1))));
      // string i ends where it is tied on the neck: staggered along the neck, bass strings highest
      const ze = s.ringZ ? s.ringZ(i) : zEnd, x = bx[i] * (1 - ze / zc);
      e.b.set(x, H, ze); e.r = thick;
      seg(run, i, e.a, e.b, thick); seg(tail, i, tailPt, e.a, thick * 0.9);
      const ry = ny, side = i % 2 === 0 ? -1 : 1;
      _m.compose(new THREE.Vector3(0, ry, ze + side * 0.3), new THREE.Quaternion(), new THREE.Vector3(nr * 1.1, nr * 1.1, nr * 1.1)); rings.setMatrixAt(i, _m);
    }
    run.instanceMatrix.needsUpdate = true; tail.instanceMatrix.needsUpdate = true; rings.instanceMatrix.needsUpdate = true;
    setAmps(new Array(STRING_COUNT).fill(0), 0);
  }
  // amps[i] 0..1 how much string i sounds; dim[i] 0..1 how bright it reads (strings you do not play are dimmer)
  const _c = new THREE.Color(), L = new THREE.Color(0xffb347), Rr = new THREE.Color(0x5fd6c8);
  function setAmps(amps, t, dim = null) {
    if (!spec) return;
    for (let i = 0; i < STRING_COUNT; i++) {
      const e = ends[i], a = amps[i] || 0, d = dim ? dim[i] : 1;
      const wob = a > 0.01 ? 1 + a * 2.2 * (0.6 + 0.4 * Math.sin(t * 90 + i * 1.7)) : 1;
      seg(run, i, e.a, e.b, e.r * wob * (0.75 + 0.25 * d));
      seg(glow, i, e.a, e.b, e.r * (a > 0.01 ? 1.6 + a * 2.6 : 0.0001));
      _c.copy(handOf(i) === 'L' ? L : Rr).multiplyScalar(a > 0.01 ? 0.55 * a * (0.4 + 0.6 * d) : 0); glow.setColorAt(i, _c);
    }
    run.instanceMatrix.needsUpdate = true; glow.instanceMatrix.needsUpdate = true; glow.instanceColor.needsUpdate = true;
  }
  return { group: root, setSpec, setAmps, ends, get spec() { return spec; }, calabash: cal, bridge };
}

// A natural, upright-concert spec for the hero instrument (title, result, icon): 21 strings over a narrower bridge.
export function heroSpec(R = 26) {
  const H = R * 0.7, span = R * 0.42, bx = [];
  for (let i = 0; i < STRING_COUNT; i++) bx.push(-span / 2 + span * (i / (STRING_COUNT - 1)));
  const nz = -R * 3.7;
  return { R, H, bx, far: { z: -R * 2.4, k: 0.3 }, neckZ: nz, neckR: R * 0.075, thick: 0.13, ringZ: (i) => -R * 1.7 - (R * 1.85) * ((i % 2 ? (i - 1) / 2 / 9 : i / 2 / 10)) };
}

// ---------------------------------------------------------------------------------------------------- the courtyard
// Floor (laterite with the woven mat), a painted far backdrop (dusk sky, compound wall, baobab), string lamps and fireflies.
export function courtyard() {
  const M = materials(), g = new THREE.Group();
  const earth = new THREE.Mesh(new THREE.CircleGeometry(392, 64), M.earth); earth.rotation.x = -Math.PI / 2; earth.receiveShadow = true; g.add(earth);
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(170, 120), M.mat); mat.rotation.x = -Math.PI / 2; mat.position.y = 0.3; mat.receiveShadow = true; g.add(mat);
  // the painted backdrop on a wide curved screen (no lighting: it is the evening itself)
  const bc = once('backdrop', () => { const c = cv(2048, 1024), x = c.getContext('2d'); drawBackdrop(x, 2048, 1024, 0, 0, { noLamps: true, noFlies: true }); return texOf(c); });
  const back = new THREE.Mesh(new THREE.CylinderGeometry(390, 390, 700, 64, 1, true, Math.PI * 0.55, Math.PI * 0.9), new THREE.MeshBasicMaterial({ map: bc, side: THREE.BackSide, fog: true, depthWrite: false, toneMapped: false, color: 0xb0a0a4 }));
  back.position.y = 330; back.renderOrder = -10; g.add(back);
  // lamps on a sagging line across the courtyard (warm bulbs, a soft halo each)
  const halo = once('halo', () => { const c = cv(64), x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,226,170,1)'); gr.addColorStop(0.25, 'rgba(255,170,80,0.5)'); gr.addColorStop(1, 'rgba(255,140,50,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return texOf(c); });
  const lamps = new THREE.Group(), bulbs = [];
  const bulbG = new THREE.SphereGeometry(1.6, 10, 8), bulbM = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const N = 15, pts = [];
  for (let i = 0; i <= 60; i++) { const u = i / 60, x = -300 + 600 * u; pts.push(new THREE.Vector3(x, 150 - Math.sin(u * Math.PI) * 34, -190 + Math.sin(u * Math.PI) * 30)); }
  const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x2a140c })); lamps.add(wire);
  for (let i = 0; i < N; i++) {
    const p = pts[Math.round((i + 0.5) / N * 60)], b = new THREE.Mesh(bulbG, bulbM); b.position.copy(p).add(new THREE.Vector3(0, -4, 0)); lamps.add(b);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.position.copy(b.position); sp.scale.setScalar(34); lamps.add(sp); bulbs.push(sp);
  }
  g.add(lamps);
  // a warm glow on the wall behind the instrument (the lamp-light pooling), gives the upright kora a clear silhouette
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0xff9a50, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  aura.position.set(0, 95, -160); aura.scale.set(420, 330, 1); g.add(aura);
  // fireflies drifting low over the courtyard
  const FN = 46, fpos = new Float32Array(FN * 3), fgeo = new THREE.BufferGeometry(); fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  const flies = new THREE.Points(fgeo, new THREE.PointsMaterial({ map: halo, size: 5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xd8ff9a, fog: false })); flies.frustumCulled = false; g.add(flies);
  const fr = mkRand(9), fs = Array.from({ length: FN }, () => [fr() * 400 - 200, 15 + fr() * 120, -200 + fr() * 220, fr() * 10]);
  function update(t) {
    bulbs.forEach((s, i) => { const a = 0.75 + 0.18 * Math.sin(t * 2.1 + i * 1.9); s.material.opacity = a; s.scale.setScalar(30 + 6 * a); });
    for (let i = 0; i < FN; i++) { const f = fs[i]; fpos[i * 3] = f[0] + Math.sin(t * 0.35 + f[3] * 2.1) * 30; fpos[i * 3 + 1] = f[1] + Math.cos(t * 0.3 + f[3]) * 14; fpos[i * 3 + 2] = f[2] + Math.sin(t * 0.25 + f[3] * 3) * 20; }
    fgeo.attributes.position.needsUpdate = true;
    flies.material.opacity = 0.75;
  }
  return { group: g, mat, earth, back, lamps, flies, aura, update };
}

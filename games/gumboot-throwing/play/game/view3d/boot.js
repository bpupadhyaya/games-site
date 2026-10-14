// The gumboot: a real welly, about 36 cm tall and 30 cm long, drawn as a lofted rubber upper (elliptical sections swept along a spine from the
// rim, down the shaft, round the ankle and out to the toe), a rolled rim with pull tabs, a black tread sole with a heel block and lugs, mud
// caked up from the sole (vertex colours) and a few clods. Local axes: origin = middle of the rim, shaft along -Y, toe towards +X, +Z = the
// side the camera sees. REAL SIZE: shaft 0.33 m above the ankle, foot 0.30 m long, about 0.9 kg (the sim's boot carries that weight).
export const BOOT_COM = [0.03, -0.185, 0];     // centre of mass relative to the rim centre (the sim's boot position is this point)
export const BOOT_RIM_R = 0.078;               // rim radius (m): the hand grips the rim edge on the +Z side

const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const vnoise = (a, b) => { const ia = Math.floor(a), ib = Math.floor(b), fa = a - ia, fb = b - ib, s = (t) => t * t * (3 - 2 * t);
  const h = (i, j) => hash(i * 57 + j * 131 + 7); const u = s(fa), v = s(fb);
  return (h(ia, ib) * (1 - u) + h(ia + 1, ib) * u) * (1 - v) + (h(ia, ib + 1) * (1 - u) + h(ia + 1, ib + 1) * u) * v; };

// Spine: [x, y, depth (in-plane thickness), width (z thickness)], from the rim to the toe tip. The sections are swept along it.
const SPINE = [
  [0.000, 0.000, 0.168, 0.158],
  [0.000, -0.045, 0.152, 0.144],
  [0.001, -0.110, 0.134, 0.126],
  [0.003, -0.165, 0.124, 0.118],
  [0.008, -0.205, 0.120, 0.116],
  [0.024, -0.238, 0.112, 0.116],
  [0.058, -0.256, 0.108, 0.118],
  [0.098, -0.260, 0.100, 0.118],
  [0.148, -0.264, 0.092, 0.114],
  [0.200, -0.269, 0.082, 0.106],
  [0.250, -0.277, 0.066, 0.092],
  [0.283, -0.288, 0.044, 0.064],
  [0.296, -0.302, 0.014, 0.026],
];

function catmull(pts, n) {   // centripetal-ish Catmull-Rom through the spine control points, n samples per segment
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push(p1.map((_, c) => 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

/** Build the parts. Returns { upper, rimTube, inner, sole, lugs, tabs: [..], clods } geometries ready for meshes (THREE passed in). */
export function buildBootGeometry(THREE, { mud = 0.5, seed = 1, colour = '#3f7a3a', corrugated = 0, segs = 28, footOnly = false } = {}) {
  let sp = catmull(SPINE, 6);
  if (footOnly) sp = sp.filter((p) => p[1] <= -0.2);
  const n = sp.length, A = segs;
  const base = new THREE.Color(colour), mudC = new THREE.Color('#4b3522'), mudDry = new THREE.Color('#7a6445'), dark = new THREE.Color(colour).multiplyScalar(0.55);
  const pos = [], col = [], idx = [];
  const frame = [];
  for (let i = 0; i < n; i++) {
    const a = sp[Math.max(0, i - 1)], b = sp[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    frame.push([-ty, tx]);
  }
  for (let i = 0; i < n; i++) {
    const [x, y, d, w] = sp[i], [nx, ny] = frame[i];
    const u = i / (n - 1);
    // the tip closes like a rounded cap
    const cap = u > 0.985 ? 0.0 : 1;
    const ring = corrugated ? 1 + corrugated * 0.04 * Math.sin(u * 60) : 1;
    for (let j = 0; j <= A; j++) {
      const al = (j / A) * Math.PI * 2, c = Math.cos(al), s = Math.sin(al);
      // slight bulge on the instep and a flatter back of the calf
      const dd = d * 0.5 * ring * (c > 0 ? 1 : 0.94), ww = w * 0.5 * ring * cap;
      const px = x + nx * dd * c * cap, py = y + ny * dd * c * cap, pz = ww * s;
      pos.push(px, py, pz);
      // mud: heavier near the sole and toe, patchy up the shaft, a dry paler splash on the far side
      const h = Math.max(0, -0.0 - py) / 0.34;                       // 0 at the rim, 1 at the sole
      const nz = vnoise(px * 38 + seed, py * 38 + pz * 21);
      const k = Math.max(0, Math.min(1, (h - (0.9 - 0.4 * mud)) * 5 + (nz - 0.5) * 1.4 * (0.3 + mud)));
      const spl = vnoise(px * 16 + 11 + seed, py * 16 + pz * 9);
      const c3 = base.clone().multiplyScalar(0.92 + 0.12 * vnoise(px * 9, py * 9));
      if (u > 0.55 && spl > 0.66 - mud * 0.2) c3.lerp(mudDry, 0.35 * Math.min(1, h * 2.2));
      c3.lerp(mudC, k * 0.92);
      if (u < 0.04) c3.lerp(dark, 0.0);
      col.push(c3.r, c3.g, c3.b);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < A; j++) {
    const a = i * (A + 1) + j, b = a + 1, c = a + A + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const upper = new THREE.BufferGeometry();
  upper.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  upper.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  upper.setIndex(idx); upper.computeVertexNormals();

  // inside of the shaft: a dark liner a little way down (open rim reads as a hole)
  const innerPts = [], innerCol = [], innerIdx = [];
  const liner = sp.filter((p) => p[1] > -0.2);
  const ln = liner.length, la = 24;
  for (let i = 0; i < ln; i++) {
    const [x, y, d, w] = liner[i]; const sc = 0.93 - 0.0 * i;
    for (let j = 0; j <= la; j++) { const al = (j / la) * Math.PI * 2; innerPts.push(x + Math.cos(al) * d * 0.5 * sc, y, Math.sin(al) * w * 0.5 * sc); const k = 0.1 + 0.0 * i; innerCol.push(0.04 + k * 0.1, 0.05 + k * 0.1, 0.04 + k * 0.1); }
  }
  for (let i = 0; i < ln - 1; i++) for (let j = 0; j < la; j++) { const a = i * (la + 1) + j, b = a + 1, c = a + la + 1, d = c + 1; innerIdx.push(a, b, c, b, d, c); }
  const inner = new THREE.BufferGeometry();
  inner.setAttribute('position', new THREE.Float32BufferAttribute(innerPts, 3)); inner.setAttribute('color', new THREE.Float32BufferAttribute(innerCol, 3));
  inner.setIndex(innerIdx); inner.computeVertexNormals();

  // rolled rim
  const rim = new THREE.TorusGeometry(1, 0.045, 10, 36); rim.scale(0.084, 0.079, 1); rim.rotateX(Math.PI / 2); rim.translate(0, 0.0, 0);
  const rimTube = rim;

  // sole: footprint extruded, bevelled; heel block under the back
  const sh = new THREE.Shape();
  const half = (x) => (x < 0.02 ? 0.056 + 0.0 : x < 0.2 ? 0.058 + 0.004 * (x - 0.02) / 0.18 : Math.max(0.006, Math.sqrt(Math.max(0, 1 - ((x - 0.2) / 0.104) ** 2)) * 0.062));
  const xs = []; for (let k = 0; k <= 26; k++) xs.push(-0.05 + (0.304 + 0.05) * k / 26);
  sh.moveTo(xs[0], 0);
  for (const x of xs) sh.lineTo(x, half(x));
  for (let k = xs.length - 1; k >= 0; k--) sh.lineTo(xs[k], -half(xs[k]));
  const sole = new THREE.ExtrudeGeometry(sh, { depth: 0.026, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 6 });
  sole.rotateX(Math.PI / 2); { const pa = sole.getAttribute('position'); for (let v = 0; v < pa.count; v++) { const x = pa.getX(v); if (x > 0.14) pa.setY(v, pa.getY(v) + 0.016 * ((x - 0.14) / 0.16) ** 2); } sole.computeVertexNormals(); }
  sole.translate(0, -0.308, 0);     // shape x,y -> x,z; extrusion goes down
  // the sole geometry: footprint y -> z. After rotateX(PI/2), shape +y maps to +z and depth maps to -y... then centre
  sole.translate(0, 0.0, 0);
  const soleCol = []; const sp2 = sole.getAttribute('position');
  for (let i = 0; i < sp2.count; i++) soleCol.push(1, 1, 1);
  sole.setAttribute('color', new THREE.Float32BufferAttribute(soleCol, 3));
  // heel block
  const heel = new THREE.BoxGeometry(0.07, 0.014, 0.104); heel.translate(-0.008, -0.347, 0);
  // tread lugs on the underside
  const lugs = [];
  
  // pull tabs
  const tabs = [];
  for (const s of [-1, 1]) { const g = new THREE.BoxGeometry(0.04, 0.05, 0.012); g.translate(0, 0.012, s * 0.083); tabs.push(g); }
  // mud clods
  const clods = [];
  const nClods = Math.round(2 + 6 * mud);
  for (let k = 0; k < nClods; k++) {
    const t = hash(seed * 31 + k * 7.3), a = hash(seed * 17 + k * 3.1) * Math.PI * 2;
    const i = Math.min(n - 1, Math.floor((0.52 + t * 0.46) * (n - 1))), p = sp[i];
    const g = new THREE.SphereGeometry(0.006 + hash(k + seed) * 0.009, 6, 4);
    { const pa = g.getAttribute('position'); for (let v = 0; v < pa.count; v++) { const j = 0.75 + 0.5 * hash(k * 13 + v + seed); pa.setXYZ(v, pa.getX(v) * j, pa.getY(v) * j, pa.getZ(v) * j); } }
    g.scale(1.3, 0.8, 1); g.translate(p[0] + Math.cos(a) * p[2] * 0.5, p[1] + (hash(k * 5 + seed) - 0.5) * 0.02, Math.sin(a) * p[3] * 0.5);
    clods.push(g);
  }
  return { upper, inner, rimTube, sole, heel, lugs, tabs, clods, spine: sp };
}

/** A ready THREE.Group: the boot with its materials. colour/soleColour from the game's BOOTS. */
export function makeBoot(THREE, { colour = '#3f7a3a', sole = '#1f2a1c', mud = 0.5, seed = 1, scale = 1, corrugated = 0, metal = false, footOnly = false } = {}) {
  const g = buildBootGeometry(THREE, { mud, seed, colour, corrugated, footOnly });
  const root = new THREE.Group();
  const rubber = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: metal ? 0.42 : 0.32, metalness: metal ? 0.75 : 0.0, clearcoat: metal ? 0.1 : 0.55, clearcoatRoughness: 0.28, side: THREE.FrontSide });
  const upper = new THREE.Mesh(g.upper, rubber); upper.castShadow = true; upper.receiveShadow = true; root.add(upper);
  const inner = new THREE.Mesh(g.inner, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })); if (!footOnly) root.add(inner);
  const rimM = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(colour).multiplyScalar(1.05), roughness: 0.28, clearcoat: 0.5, metalness: metal ? 0.75 : 0 });
  const rim = new THREE.Mesh(g.rimTube, rimM); rim.castShadow = true; if (!footOnly) root.add(rim);
  const soleM = new THREE.MeshStandardMaterial({ color: sole, roughness: 0.72 });
  const soleMesh = new THREE.Mesh(g.sole, soleM); soleMesh.castShadow = true; if (!footOnly) root.add(soleMesh);
  const heel = new THREE.Mesh(g.heel, soleM); heel.castShadow = true; if (!footOnly) root.add(heel);
  for (const l of g.lugs) { const m = new THREE.Mesh(l, new THREE.MeshStandardMaterial({ color: new THREE.Color(sole).multiplyScalar(0.8), roughness: 0.9 })); root.add(m); }
  if (!footOnly) for (const t of g.tabs) { const m = new THREE.Mesh(t, rimM); m.castShadow = true; root.add(m); }
  const mudM = new THREE.MeshStandardMaterial({ color: 0x4a3623, roughness: 1 });
  for (const c of g.clods) { const m = new THREE.Mesh(c, mudM); root.add(m); }
  root.scale.setScalar(scale);
  root.userData.parts = { upper, rubber };
  return root;
}

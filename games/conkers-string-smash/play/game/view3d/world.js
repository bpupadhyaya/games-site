// Conkers 3D world: everything procedural (canvas textures, analytic geometry; no image files). Used by presenter.js (the live
// scene) and icon.js (the store icon). Units are metres; the duel hangs in the plane z = 0, +y is up, the ground is y = 0.
//   conker      a horse chestnut: glossy mahogany shell with wavy growth grain, the pale matte hilum (the "pale patch" of the
//               rules), a drilled hole and the knot of the string under it; cracks are painted in as damage grows.
//   mitten      a knitted wool mitten (fist) with a ribbed cuff and a coat sleeve: the hands stay real and simple (no fingers to
//               go wrong); the string is wrapped twice round the knuckles and leaves the fist at the bottom.
//   park        a golden-hour English park seen through a long lens: soft painted backdrop (sky, canopies, trunks), a lawn of
//               fallen leaves, spiky husks on the ground, bokeh and falling horse-chestnut leaves.
import * as THREE from '../vendor3d/three.js';

const T = THREE, TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const rng = (seed) => { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true, rep = false) => { const t = new T.CanvasTexture(c); if (srgb) t.colorSpace = T.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t; };

// smooth value noise on a 2D lattice (periodic in x with period px when given)
function noise2(seed, px = 0) {
  const r = rng(seed), N = 64, g = new Float32Array(N * N);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const at = (x, y) => g[(((y % N) + N) % N) * N + (((x % N) + N) % N)];
  return (x, y) => {
    if (px) x = ((x % px) + px) % px;
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const x1 = px ? (xi + 1) % px : xi + 1;
    const a = at(xi, yi), b = at(x1, yi), c = at(xi, yi + 1), d = at(x1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

// ---------------------------------------------------------------------------------------------------------------- conker
export const PATCH_R = 0.52;     // angular radius of the pale patch (rad)
let CW = 512, CH = 256;
// The shell as an equirectangular map. The pale patch is centred at u = 0.5, v = 0.5 (local +X of the sphere); the grain runs in
// wavy contour lines round it, the way a real conker's growth lines circle its hilum.
function conkerBase(seed) {
  const n1 = noise2(seed * 3 + 1, 12), n2 = noise2(seed * 7 + 5, 24), r = rng(seed);
  const col = new Uint8ClampedArray(CW * CH * 4), rough = new Uint8ClampedArray(CW * CH * 4);
  const hue = r(), dark = 0.85 + r() * 0.25;
  const base = [[0.36, 0.145, 0.058]];
  const freq = 16 + r() * 6, ph = r() * 6;
  for (let y = 0; y < CH; y++) {
    const v = (y + 0.5) / CH, th = v * Math.PI, st = Math.sin(th), ct = Math.cos(th);
    for (let x = 0; x < CW; x++) {
      const u = (x + 0.5) / CW, phi = u * TAU;
      // three.js sphere: x = -cos(phi) sin(th), y = cos(th), z = sin(phi) sin(th); the patch centre is +X
      const px = -Math.cos(phi) * st, py = ct, pz = Math.sin(phi) * st;
      const d = Math.acos(clamp(px, -1, 1));                                  // angle from the patch centre
      const w1 = n1(u * 12, v * 6), w2 = n2(u * 24, v * 12);
      const wob = (w1 - 0.5) * 0.5 + (w2 - 0.5) * 0.12 + Math.atan2(pz, py) * 0.04;
      const rim = PATCH_R * (1 + (n1(u * 12 + 3, v * 6 + 7) - 0.5) * 0.35);
      const i = (y * CW + x) * 4;
      // shell: smooth mahogany with soft broad bands and a few fine darker growth lines (no zebra stripes)
      const gr = Math.sin((d + wob) * freq + ph), g2 = Math.sin((d + wob * 1.7) * freq * 2.3 + ph * 2), fine = 0.5 + 0.5 * g2;
      let k = 0.92 + 0.07 * gr + (w2 - 0.5) * 0.12 + (w1 - 0.5) * 0.14;
      if (fine > 0.95) k *= 0.9;
      const c = base[0], m = k * dark * (1 - Math.max(0, 1 - Math.abs(d - rim) / 0.1) * 0.3);   // darker just round the patch
      let R0 = c[0] * 255 * m * (1 + hue * 0.12), G0 = c[1] * 255 * m, B0 = c[2] * 255 * m * (1 - hue * 0.2), ro = 60 + (1 - fine) * 25;
      // the hilum: matte, buff, fibrous speckle, shading down toward its rim; blended over a soft edge (no stair-steps)
      const pa = clamp((rim - d) / 0.035 + 0.5, 0, 1);
      if (pa > 0) {
        const f = Math.min(1, d / rim), sp = 1 - Math.max(0, n2(u * 24 * 6, v * 12 * 6) - 0.55) * 0.35 - (n1(u * 90, v * 45) - 0.5) * 0.08, e = 1 - Math.pow(f, 3) * 0.32;
        R0 += (186 * e * sp - R0) * pa; G0 += (146 * e * sp - G0) * pa; B0 += (96 * e * sp - B0) * pa; ro += (205 - ro) * pa;
      }
      col[i] = clamp(R0, 0, 255); col[i + 1] = clamp(G0, 0, 255); col[i + 2] = clamp(B0, 0, 255);
      rough[i] = rough[i + 1] = rough[i + 2] = ro;
      col[i + 3] = rough[i + 3] = 255;
    }
  }
  return { col, rough };
}
// crack paths in map pixels: start near the impact side (the patch hemisphere) and wander across it
function crackPaths(seed, n, CW, CH) {
  const r = rng(seed * 31 + 9), out = [], q = CW / 384;
  for (let c = 0; c < n; c++) {
    let x = CW * (0.5 + (r() - 0.5) * 0.5), y = CH * (0.5 + (r() - 0.5) * 0.6), a = r() * TAU;
    const pts = [[x, y]], segs = 6 + Math.floor(r() * 6);
    for (let s = 0; s < segs; s++) { a += (r() - 0.5) * 1.3; const st = (6 + r() * 10) * q; x += Math.cos(a) * st; y += Math.sin(a) * st * 0.7; pts.push([x, y]); if (r() < 0.25) out.push({ pts: [[x, y], [x + Math.cos(a + 1.2) * st, y + Math.sin(a + 1.2) * st * 0.6]], w: 0.6 }); }
    out.push({ pts, w: 1 });
  }
  return out;
}
const CRACK_LEVELS = [0.08, 0.3, 0.5, 0.75, 0.92];
export const crackLevel = (dmg) => CRACK_LEVELS.reduce((k, t) => (dmg > t ? k + 1 : k), 0);

export function makeConker(seed = 3, res = 512) {
  CW = res; CH = res / 2;
  const MW = CW, MH = CH;
  const { col, rough } = conkerBase(seed);
  const cc = canvas(MW, MH), cx = cc.getContext('2d'), img = new ImageData(col, MW, MH);
  cx.putImageData(img, 0, 0);
  const rc = canvas(MW, MH); rc.getContext('2d').putImageData(new ImageData(rough, MW, MH), 0, 0);
  const map = tex(cc), rmap = tex(rc, false);
  const geo = new T.SphereGeometry(1, 64, 40);
  // a real conker is a little flattened and lumpy: squash along z, a soft flat face on the far side, low-frequency bumps
  const p = geo.attributes.position, nz = noise2(seed * 13 + 2, 0);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + (nz(x * 1.6 + 4, y * 1.6 + z * 1.3 + 4) - 0.5) * 0.07;
    x *= k; y *= k * 0.97; z *= k * 0.93;
    if (x < -0.55) x = -0.55 + (x + 0.55) * 0.55;                             // the flat face opposite the hilum
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  const mat = new T.MeshPhysicalMaterial({ map, roughnessMap: rmap, roughness: 1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0, envMapIntensity: 0.8 });
  const mesh = new T.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = false;
  // the drilled hole (a dark dimple) and the knot under the conker: positioned by the presenter along the string
  const hole = new T.Mesh(new T.CircleGeometry(0.16, 20), new T.MeshBasicMaterial({ color: 0x140603 }));
  const knot = new T.Group();
  const twine = twineMaterial();
  const kg = new T.SphereGeometry(0.06, 12, 8);
  for (const [x, y, z] of [[0, 0, 0], [0.05, -0.03, 0.02], [-0.04, -0.035, -0.02], [0.01, -0.07, 0.01]]) { const k1 = new T.Mesh(kg, twine); k1.position.set(x, y, z); k1.scale.set(1, 0.8, 1); knot.add(k1); }
  const tail = new T.Mesh(new T.CylinderGeometry(0.03, 0.02, 0.32, 8).translate(0, -0.16, 0), twine); tail.rotation.z = 0.35; knot.add(tail);
  let level = -1;
  const setDamage = (dmg) => {
    const lv = crackLevel(dmg);
    if (lv === level) return; level = lv;
    cx.putImageData(img, 0, 0);
    if (lv > 0) {
      const n = [0, 1, 2, 3, 5, 7][lv];
      cx.lineCap = 'round'; cx.lineJoin = 'round';
      for (const c of crackPaths(seed, n, MW, MH)) {
        const draw = (style, w, dx, dy) => { cx.strokeStyle = style; cx.lineWidth = w; cx.beginPath(); c.pts.forEach((q, j) => (j ? cx.lineTo(q[0] + dx, q[1] + dy) : cx.moveTo(q[0] + dx, q[1] + dy))); cx.stroke(); };
        draw('rgba(255,214,150,0.55)', (1.6 + lv * 0.35) * c.w * MW / 384, 0.9, 0.9);                 // the pale flesh showing at the lip of the crack
        draw('rgba(16,4,0,0.95)', (1.1 + lv * 0.3) * c.w * MW / 384, 0, 0);
      }
    }
    map.needsUpdate = true;
  };
  setDamage(0);
  return { mesh, hole, knot, mat, setDamage, seed };
}

// ---------------------------------------------------------------------------------------------------------------- string
let _twine = null;
export function twineMaterial() {
  if (_twine) return _twine;
  const c = canvas(64, 256), x = c.getContext('2d');
  x.fillStyle = '#d9c9a0'; x.fillRect(0, 0, 64, 256);
  for (let i = -8; i < 40; i++) { x.strokeStyle = i % 2 ? 'rgba(120,96,56,0.55)' : 'rgba(255,248,220,0.5)'; x.lineWidth = 5; x.beginPath(); x.moveTo(0, i * 9); x.lineTo(64, i * 9 + 22); x.stroke(); }
  const t = tex(c, true, true); t.repeat.set(1, 6);
  _twine = new T.MeshStandardMaterial({ map: t, roughness: 0.85, metalness: 0, envMapIntensity: 0.4 });
  return _twine;
}
// unit cylinder along +Y from y = 0 to 1, scaled per frame between two points
export function makeString(radius = 0.0042) {
  const g = new T.CylinderGeometry(radius, radius, 1, 10, 1, false).translate(0, 0.5, 0);
  const m = new T.Mesh(g, twineMaterial()); m.castShadow = true; m.frustumCulled = false;
  return m;
}
const _a = new T.Vector3(), _b = new T.Vector3(), _up = new T.Vector3(0, 1, 0);
export function setString(mesh, from, to) {
  _a.subVectors(to, from); const len = _a.length();
  mesh.position.copy(from); mesh.quaternion.setFromUnitVectors(_up, _a.normalize()); mesh.scale.set(1, Math.max(1e-4, len), 1);
}

// ---------------------------------------------------------------------------------------------------------------- mitten + sleeve
function knitTexture(base, dark, light, seed) {
  const W = 128, H = 128, c = canvas(W, H), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = base; x.fillRect(0, 0, W, H);
  // stockinette: columns of V stitches
  const cw = 8, rh = 8;
  for (let j = 0; j < H / rh + 1; j++) for (let i = 0; i < W / cw; i++) {
    const cx0 = i * cw, cy0 = j * rh, jit = (r() - 0.5) * 0.15;
    for (const s of [-1, 1]) {
      const g = x.createLinearGradient(cx0 + cw / 2, cy0, cx0 + cw / 2 + s * cw / 2, cy0 + rh);
      g.addColorStop(0, light); g.addColorStop(0.6, base); g.addColorStop(1, dark);
      x.fillStyle = g; x.globalAlpha = 0.9 + jit;
      x.beginPath(); x.ellipse(cx0 + cw / 2 + s * cw * 0.22, cy0 + rh * 0.55, cw * 0.27, rh * 0.62, s * 0.55, 0, TAU); x.fill();
    }
  }
  x.globalAlpha = 1;
  return c;
}
function bumpFrom(c) {
  const b = canvas(c.width, c.height), x = b.getContext('2d');
  x.filter = 'grayscale(1)'; x.drawImage(c, 0, 0);
  return b;
}
export function makeMitten({ wool = '#2f6f6a', woolDark = '#173a37', woolLight = '#5ea59c', sleeve = '#2c3446', cuff = '#e9dfc4', seed = 1 } = {}) {
  const group = new T.Group();
  const kc = knitTexture(wool, woolDark, woolLight, seed);
  const kt = tex(kc, true, true); kt.repeat.set(3, 3);
  const kb = tex(bumpFrom(kc), false, true); kb.repeat.set(3, 3);
  const woolMat = new T.MeshStandardMaterial({ map: kt, bumpMap: kb, bumpScale: 2.2, roughness: 0.95, metalness: 0, envMapIntensity: 0.35, sheen: 1 });
  // the fist: a rounded block, knuckles toward local +X, the wrist toward -X, thumb on top (+Y); string leaves at the bottom
  const fistGeo = new T.SphereGeometry(1, 40, 28);
  const p = fistGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    x *= 0.062; y *= 0.05; z *= 0.042;
    if (x > 0.02) x = 0.02 + (x - 0.02) * 0.8;                                 // a flatter knuckle front
    if (y < -0.02) y = -0.02 + (y + 0.02) * 0.85;
    x += Math.max(0, -y) * 0.12;                                                  // the curled fingers bulge forward at the bottom
    p.setXYZ(i, x, y, z);
  }
  fistGeo.computeVertexNormals();
  const fist = new T.Mesh(fistGeo, woolMat); fist.castShadow = true;
  group.add(fist);
  const thumbGeo = new T.CapsuleGeometry(0.019, 0.04, 8, 16); thumbGeo.rotateZ(Math.PI / 2);
  const thumb = new T.Mesh(thumbGeo, woolMat); thumb.position.set(0.016, 0.044, 0.022); thumb.rotation.set(0.2, -0.45, -0.2); thumb.castShadow = true;
  group.add(thumb);
  // ribbed cuff + coat sleeve running back toward the elbow (local -X)
  const rc = canvas(64, 16), rx = rc.getContext('2d'); rx.fillStyle = woolDark; rx.fillRect(0, 0, 64, 16);
  for (let i = 0; i < 16; i++) { const g = rx.createLinearGradient(i * 4, 0, i * 4 + 4, 0); g.addColorStop(0, woolDark); g.addColorStop(0.5, wool); g.addColorStop(1, woolDark); rx.fillStyle = g; rx.fillRect(i * 4, 0, 4, 16); }
  const rt = tex(rc, true, true); rt.repeat.set(3, 1);
  const cuffGeo = new T.CylinderGeometry(0.04, 0.036, 0.06, 32, 1, true); cuffGeo.rotateZ(Math.PI / 2);
  const cuffM = new T.Mesh(cuffGeo, new T.MeshStandardMaterial({ map: rt, bumpMap: rt, bumpScale: 1.5, roughness: 0.95, side: T.DoubleSide, envMapIntensity: 0.3 }));
  cuffM.position.set(-0.072, 0.004, 0); group.add(cuffM);
  // the coat sleeve: a waxed cotton / tweed tube with a turned-back cuff band
  const sc = canvas(128, 128), sx = sc.getContext('2d'), r = rng(seed + 40);
  sx.fillStyle = sleeve; sx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) { sx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; sx.fillRect(r() * 128, r() * 128, 1 + r() * 3, 1); }
  for (let i = 0; i < 128; i += 4) { sx.fillStyle = 'rgba(0,0,0,0.06)'; sx.fillRect(0, i, 128, 1); }
  const st = tex(sc, true, true); st.repeat.set(3, 4);
  const sleeveMat = new T.MeshStandardMaterial({ map: st, bumpMap: st, bumpScale: 0.8, roughness: 0.88, envMapIntensity: 0.3 });
  const SL = 1.8;
  const sleeveGeo = new T.CylinderGeometry(0.075, 0.047, SL, 28, 10, false); sleeveGeo.rotateZ(Math.PI / 2);
  // soft folds near the cuff
  const sp = sleeveGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i), a = Math.atan2(z, y), f = 1 + Math.sin(a * 5 + x * 30) * 0.03 * clamp((x + SL / 2) / SL, 0.2, 1); sp.setXYZ(i, x, y * f, z * f); }
  sleeveGeo.computeVertexNormals();
  const sleeveM = new T.Mesh(sleeveGeo, sleeveMat); sleeveM.position.set(-0.1 - SL / 2, 0.006, 0); sleeveM.castShadow = true; group.add(sleeveM);
  const band = new T.Mesh(new T.TorusGeometry(0.048, 0.008, 10, 32), new T.MeshStandardMaterial({ color: cuff, roughness: 0.8 })); band.rotation.y = Math.PI / 2; band.position.set(-0.102, 0.006, 0); group.add(band);
  // the string wrapped twice round the knuckles
  const tw = twineMaterial();
  for (let k = 0; k < 2; k++) { const w = new T.Mesh(new T.TorusGeometry(1, 0.075, 8, 40), tw); w.scale.set(0.042, 0.049, 0.045); w.rotation.set(0, Math.PI / 2, 0.08 + k * 0.08); w.position.set(0.006 + k * 0.017, -0.004, 0); group.add(w); }
  group.userData = { fist, woolMat, sleeveMat, grip: new T.Vector3(0.012, -0.046, 0) };   // where the string leaves the fist (local)
  return group;
}

// ---------------------------------------------------------------------------------------------------------------- the park
// Out-of-focus look: a real canvas blur where the WebView has one, else down-scale and come back up in halving steps (smooth, no blocks).
function soften(c, k) {
  const W = c.width, H = c.height, o = canvas(W, H), ox = o.getContext('2d');
  if (typeof ox.filter === 'string') { ox.filter = `blur(${Math.max(1, Math.round(W / (k * 55)))}px)`; ox.drawImage(c, 0, 0); if (ox.filter !== 'none') { ox.filter = 'none'; return o; } }
  let cur = c, w = W, h = H;
  while (w > W / k) { w = Math.max(2, Math.round(w / 2)); h = Math.max(2, Math.round(h / 2)); const t = canvas(w, h); t.getContext('2d').drawImage(cur, 0, 0, w, h); cur = t; }
  while (w < W) { w = Math.min(W, w * 2); h = Math.min(H, h * 2); const t = canvas(w, h), tx = t.getContext('2d'); tx.imageSmoothingQuality = 'high'; tx.drawImage(cur, 0, 0, w, h); cur = t; }
  return cur;
}
// The background is painted the way a long lens sees it: soft, warm and out of focus (painted small, magnified by the GPU).
function paintBackdrop(seed = 2) {
  const W = 512, H = 256, c = canvas(W, H), x = c.getContext('2d'), r = rng(seed);
  const sky = x.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#2f3d36'); sky.addColorStop(0.22, '#6d6a48'); sky.addColorStop(0.42, '#c9a466'); sky.addColorStop(0.5, '#e6c27e'); sky.addColorStop(0.6, '#8a6a34'); sky.addColorStop(1, '#3a2a12');
  x.fillStyle = sky; x.fillRect(0, 0, W, H);
  // low sun glow
  const sun = x.createRadialGradient(W * 0.36, H * 0.44, 2, W * 0.36, H * 0.44, H * 0.55); sun.addColorStop(0, 'rgba(255,240,190,0.95)'); sun.addColorStop(0.3, 'rgba(255,214,130,0.45)'); sun.addColorStop(1, 'rgba(255,200,120,0)');
  x.fillStyle = sun; x.fillRect(0, 0, W, H);
  // far tree line: rounded canopies in amber, rust and olive
  const cols = ['#7b3a16', '#a2531f', '#5d5a24', '#3f4a22', '#c07a2e', '#8a6a2a', '#6a2a10'];
  for (let i = 0; i < 70; i++) { const cx0 = r() * W, cy0 = H * (0.36 + r() * 0.16), rr = 10 + r() * 26; x.globalAlpha = 0.55 + r() * 0.35; x.fillStyle = cols[i % cols.length]; x.beginPath(); x.arc(cx0, cy0, rr, 0, TAU); x.fill(); }
  x.globalAlpha = 1;
  // trunks in the middle distance
  for (let i = 0; i < 14; i++) { const tx = r() * W, tw = 3 + r() * 6; x.fillStyle = `rgba(48,28,14,${0.55 + r() * 0.35})`; x.fillRect(tx, H * 0.3, tw, H * 0.22); }
  // the lawn, warm in the low light, with a haze line where it meets the trees
  const lawn = x.createLinearGradient(0, H * 0.54, 0, H); lawn.addColorStop(0, '#d6ad6c'); lawn.addColorStop(0.25, '#a07a3a'); lawn.addColorStop(1, '#4a3618');
  x.fillStyle = lawn; x.fillRect(0, H * 0.555, W, H * 0.45);
  const haze = x.createLinearGradient(0, H * 0.36, 0, H * 0.62); haze.addColorStop(0, 'rgba(214,173,108,0)'); haze.addColorStop(0.55, 'rgba(214,173,108,1)'); haze.addColorStop(0.62, 'rgba(214,173,108,1)'); haze.addColorStop(1, 'rgba(214,173,108,0)');
  x.fillStyle = haze; x.fillRect(0, H * 0.36, W, H * 0.26);
  // blur by drawing small and back up (works on every WebView; ctx.filter does not)
  return soften(c, 3);
}
// near canopies and trunks that frame the shot (soft, darker): an alpha layer
function paintFrameLayer(seed = 5) {
  const W = 512, H = 256, c = canvas(W, H), x = c.getContext('2d'), r = rng(seed);
  // two big horse chestnut trunks at the edges
  const G = H * 0.565;   // where the lawn meets these trunks (9 m away, lens 0.62 m up)
  for (const [tx, tw] of [[W * 0.1, 30], [W * 0.88, 36], [W * 0.63, 11], [W * 0.33, 8]]) {
    const g = x.createLinearGradient(tx - tw / 2, 0, tx + tw / 2, 0); g.addColorStop(0, '#20120a'); g.addColorStop(0.45, '#4a2e1a'); g.addColorStop(0.7, '#3a2213'); g.addColorStop(1, '#1a0e07');
    x.fillStyle = g; x.beginPath(); x.moveTo(tx - tw * 0.75, G); x.bezierCurveTo(tx - tw * 0.4, G * 0.8, tx - tw * 0.6, G * 0.5, tx - tw * 0.3, H * 0.15); x.lineTo(tx + tw * 0.3, H * 0.15); x.bezierCurveTo(tx + tw * 0.55, G * 0.5, tx + tw * 0.4, G * 0.8, tx + tw * 0.75, G); x.fill();
  }
  // canopy overhead
  const cols = ['#5a2a10', '#7a3a18', '#3d3a18', '#a0521e', '#2e2a12', '#c4782c'];
  for (let i = 0; i < 110; i++) { const cx0 = r() * W, cy0 = H * (0.12 + r() * 0.2), rr = 10 + r() * 24; x.globalAlpha = 0.55 + r() * 0.45; x.fillStyle = cols[i % cols.length]; x.beginPath(); x.arc(cx0, cy0, rr, 0, TAU); x.fill(); }
  x.globalAlpha = 1;
  return soften(c, 3);
}
function paintLeafLitter(seed = 9) {
  const W = 256, c = canvas(W, W), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = '#5e4a24'; x.fillRect(0, 0, W, W);
  for (let i = 0; i < 2600; i++) { x.fillStyle = r() < 0.5 ? 'rgba(98,110,40,0.5)' : 'rgba(60,46,20,0.5)'; x.fillRect(r() * W, r() * W, 1 + r() * 2, 3 + r() * 5); }
  const cols = ['#c8641e', '#e09a32', '#a33c16', '#d9b043', '#8a5a26', '#b87a2c', '#7a2e12'];
  for (let i = 0; i < 260; i++) {
    const lx = r() * W, ly = r() * W, s = 3 + r() * 7, a = r() * TAU;
    x.save(); x.translate(lx, ly); x.rotate(a); x.fillStyle = cols[Math.floor(r() * cols.length)]; x.globalAlpha = 0.45 + r() * 0.3;
    x.beginPath(); x.ellipse(0, 0, s, s * 0.42, 0, 0, TAU); x.fill();
    x.restore();
  }
  const sm = canvas(W / 2, W / 2); sm.getContext('2d').drawImage(c, 0, 0, W / 2, W / 2);
  const o = canvas(W, W); o.getContext('2d').drawImage(sm, 0, 0, W, W);
  return o;
}
// one horse chestnut leaf: five to seven leaflets fanned from one point (palmate), autumn colours
export function leafCanvas(hueIdx = 0) {
  const S = 128, c = canvas(S, S), x = c.getContext('2d');
  const pal = [['#e3a03a', '#b4621e'], ['#d36a22', '#8f3412'], ['#c9b047', '#7e7a26'], ['#b8471c', '#6e220c']][hueIdx % 4];
  x.translate(S / 2, S * 0.78);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.42, len = S * (0.42 - Math.abs(i - 3) * 0.055);
    x.save(); x.rotate(a + Math.PI / 2);
    const g = x.createLinearGradient(0, 0, 0, -len); g.addColorStop(0, pal[1]); g.addColorStop(1, pal[0]);
    x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(len * 0.22, -len * 0.3, len * 0.18, -len * 0.85, 0, -len); x.bezierCurveTo(-len * 0.18, -len * 0.85, -len * 0.22, -len * 0.3, 0, 0); x.fill();
    x.strokeStyle = 'rgba(90,40,10,0.55)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -len * 0.95); x.stroke();
    x.restore();
  }
  x.strokeStyle = pal[1]; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, S * 0.2); x.stroke();
  return c;
}
export function radialTex(rgb = '255,236,190', a = 1, S = 64) {
  const c = canvas(S, S), x = c.getContext('2d'), g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.55, `rgba(${rgb},${a * 0.5})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, S, S); return tex(c);
}
// a bokeh disc: flat, slightly brighter rim (how an out-of-focus highlight looks through a lens)
function bokehTex(S = 64) {
  const c = canvas(S, S), x = c.getContext('2d'), g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.78, 'rgba(255,255,255,0.7)'); g.addColorStop(0.9, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S); return tex(c);
}

// a spiky green husk, split open, with a fresh conker showing (lies on the lawn)
export function makeHusk(seed = 1) {
  const g = new T.Group(), r = rng(seed);
  const shellMat = new T.MeshStandardMaterial({ color: '#6f8a2a', roughness: 0.7, envMapIntensity: 0.4 });
  const innerMat = new T.MeshStandardMaterial({ color: '#efe6c4', roughness: 0.6 });
  const half = (flip) => {
    const h = new T.Group();
    const s = new T.Mesh(new T.SphereGeometry(1, 24, 14, 0, TAU, 0, Math.PI * 0.55), shellMat); s.castShadow = true; h.add(s);
    const i = new T.Mesh(new T.SphereGeometry(0.93, 20, 12, 0, TAU, 0, Math.PI * 0.5), innerMat); i.material.side = T.BackSide; h.add(i);
    const sp = new T.CylinderGeometry(0, 0.06, 0.38, 5); sp.translate(0, 0.19, 0);
    for (let k = 0; k < 26; k++) {
      const a = r() * TAU, b = r() * Math.PI * 0.5, m = new T.Mesh(sp, shellMat);
      const n = new T.Vector3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a));
      m.position.copy(n.clone().multiplyScalar(0.95)); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), n); h.add(m);
    }
    if (flip) h.rotation.z = Math.PI;
    return h;
  };
  const a = half(false), b = half(true);
  a.rotation.set(-0.9, 0, 0.5); a.position.set(-0.35, 0.1, -0.2);
  b.rotation.set(Math.PI + 0.6, 0, -0.3); b.position.set(0.5, 0.2, 0.1);
  g.add(a, b);
  return g;
}

export function buildPark(scene, { quality = 'high' } = {}) {
  const g = new T.Group(); scene.add(g);
  // far backdrop and a nearer framing layer (both camera-facing planes, painted soft)
  const bdMat = new T.MeshBasicMaterial({ map: tex(paintBackdrop(2)), fog: false, depthWrite: false });
  const backdrop = new T.Mesh(new T.PlaneGeometry(1, 1), bdMat); backdrop.renderOrder = -10; g.add(backdrop);
  const frMat = new T.MeshBasicMaterial({ map: tex(paintFrameLayer(5)), transparent: true, fog: false, depthWrite: true, alphaTest: 0.05, opacity: 0.92 });
  const frame = new T.Mesh(new T.PlaneGeometry(1, 1), frMat); frame.renderOrder = -9; g.add(frame);
  // the lawn under the duel, receding into haze
  const lt = tex(paintLeafLitter(9), true, true); lt.repeat.set(14, 28);
  const lawnMat = new T.MeshStandardMaterial({ map: lt, roughness: 0.95, metalness: 0, envMapIntensity: 0.2 });
  const lawn = new T.Mesh(new T.PlaneGeometry(60, 120), lawnMat); lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, 0, -52); lawn.receiveShadow = true; g.add(lawn);
  // husks lying on the lawn just behind the duel
  const husks = [];
  for (const [x, z, s, ry, sd] of [[-0.55, -0.9, 0.05, 0.4, 1], [0.75, -1.6, 0.05, 2.1, 2], [0.15, -2.6, 0.048, 1.2, 3]]) {
    const h = makeHusk(sd); h.scale.setScalar(s); h.position.set(x, s * 0.75, z); h.rotation.y = ry; g.add(h); husks.push(h);
  }
  // loose conkers on the lawn (one beside each husk)
  const loose = [];
  for (const [x, z, sd] of [[-0.47, -0.84, 11], [0.86, -1.5, 12]]) { const c = makeConker(sd); c.mesh.scale.setScalar(0.034); c.mesh.position.set(x, 0.03, z); c.mesh.rotation.set(0.4, sd, 0.2); g.add(c.mesh); loose.push(c); }
  // bokeh discs between the duel and the backdrop
  const bk = bokehTex(), bokeh = [];
  const r = rng(77);
  for (let i = 0; i < (quality === 'low' ? 6 : 12); i++) {
    const m = new T.Sprite(new T.SpriteMaterial({ map: bk, color: new T.Color().setHSL(0.09 + r() * 0.05, 0.85, 0.6 + r() * 0.2), transparent: true, opacity: 0.05 + r() * 0.12, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    m.userData = { u: r(), v: r(), d: 8 + r() * 12, s: 0.3 + r() * 0.5, ph: r() * TAU };
    m.renderOrder = -8; g.add(m); bokeh.push(m);
  }
  // falling horse chestnut leaves (some close to the lens, soft and big; most behind the duel)
  const leafTex = [0, 1, 2, 3].map((k) => tex(leafCanvas(k)));
  const leafGeo = new T.PlaneGeometry(1, 1);
  const lp = leafGeo.attributes.position; for (let i = 0; i < lp.count; i++) { const x = lp.getX(i), y = lp.getY(i); lp.setZ(i, (x * x) * 0.35 - y * 0.08); } leafGeo.computeVertexNormals();
  const leaves = [];
  for (let i = 0; i < (quality === 'low' ? 8 : 16); i++) {
    const near = i % 5 === 0;
    const m = new T.Mesh(leafGeo, new T.MeshStandardMaterial({ map: leafTex[i % 4], transparent: true, alphaTest: near ? 0 : 0.35, side: T.DoubleSide, roughness: 0.8, depthWrite: !near, opacity: near ? 0.55 : 1 }));
    m.userData = { x0: (r() - 0.5) * 3, z: near ? 0.35 + r() * 0.3 : -0.4 - r() * 2.5, y0: r() * 3, sp: 0.12 + r() * 0.12, sw: 0.2 + r() * 0.3, ph: r() * TAU, rs: 0.8 + r() * 1.6, size: near ? 0.16 : 0.1 + r() * 0.05 };
    m.scale.setScalar(m.userData.size); m.castShadow = !near; g.add(m); leaves.push(m);
  }
  // a soft lens vignette, glued in front of the camera
  const vc = canvas(256, 256), vx = vc.getContext('2d'), vg = vx.createRadialGradient(128, 128, 60, 128, 128, 182);
  vg.addColorStop(0, 'rgba(20,10,4,0)'); vg.addColorStop(0.6, 'rgba(20,10,4,0.18)'); vg.addColorStop(1, 'rgba(20,10,4,0.62)'); vx.fillStyle = vg; vx.fillRect(0, 0, 256, 256);
  const vignette = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: tex(vc), transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
  vignette.renderOrder = 50; vignette.frustumCulled = false; g.add(vignette);
  return {
    group: g, backdrop, frame, vignette, lawn, husks, loose, bokeh, leaves,
    // keep the camera-facing layers filling the view; t = seconds (game clock)
    update(t, cam) {
      const fill = (m, dist, k) => {
        const h = 2 * dist * Math.tan((cam.fov * Math.PI) / 360) * k, w = h * 2;
        m.position.set(cam.position.x * 0.85, cam.position.y, cam.position.z - dist); m.scale.set(w, h, 1);
      };
      fill(backdrop, 34, 2.4);
      { // the vignette covers the visible view (the view offset shifts it; follow it)
        const d = 0.3, vh = 2 * d * Math.tan((cam.fov * Math.PI) / 360), off = cam.view && cam.view.enabled ? -cam.view.offsetY / cam.view.fullHeight * vh : 0;
        vignette.position.copy(cam.position); vignette.quaternion.copy(cam.quaternion); vignette.translateZ(-d); vignette.translateY(off);
        vignette.scale.set(vh * cam.aspect * 1.06, vh * 1.06, 1);
      }
      fill(frame, 9, 2.4);
      for (const b of bokeh) {
        const u = b.userData, h = 2 * u.d * Math.tan((cam.fov * Math.PI) / 360);
        b.position.set(cam.position.x + (u.u - 0.5) * h * cam.aspect * 1.2 + Math.sin(t * 0.07 + u.ph) * 0.2, cam.position.y + (u.v - 0.35) * h * 0.9 + Math.sin(t * 0.05 + u.ph) * 0.1, cam.position.z - u.d - 2);
        b.scale.setScalar(u.s * (1 + 0.06 * Math.sin(t * 0.5 + u.ph)));
      }
      for (const m of leaves) {
        const u = m.userData, H = 3.2, y = ((u.y0 - t * u.sp) % H + H) % H;
        m.position.set(cam.position.x + u.x0 + Math.sin(t * 0.6 + u.ph) * u.sw, y - 0.3, u.z);
        m.rotation.set(Math.sin(t * u.rs + u.ph) * 0.9, t * 0.4 + u.ph, Math.cos(t * u.rs * 0.8 + u.ph) * 0.7);
      }
    },
  };
}

export function buildLights(scene) {
  const hemi = new T.HemisphereLight(0xffe2b0, 0x4a3218, 0.55); scene.add(hemi);
  // low golden sun from behind-left (rim on the conkers) and a warm key from the front-left
  const key = new T.DirectionalLight(0xffe0b0, 2.1); key.position.set(-2.2, 2.6, 3.2); scene.add(key); scene.add(key.target);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); const sc = key.shadow.camera; sc.left = -2; sc.right = 2; sc.top = 2; sc.bottom = -2; sc.near = 0.5; sc.far = 12; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  const rim = new T.DirectionalLight(0xffc070, 3.2); rim.position.set(2.5, 1.6, -3.5); scene.add(rim); scene.add(rim.target);
  const fill = new T.DirectionalLight(0xa8c4ff, 0.35); fill.position.set(3, 0.5, 2); scene.add(fill);
  const flash = new T.PointLight(0xfff0d0, 0, 1.2, 2); scene.add(flash);
  return { hemi, key, rim, fill, flash };
}

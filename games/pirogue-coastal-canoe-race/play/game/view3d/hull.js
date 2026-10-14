// The dugout pirogue: a sculpted hull (outer painted skin, adzed inner surface, flat gunwale rim, bow and stern caps), thwarts, and the
// single-blade paddle. Units are metres, hull local frame: bow at -Z, stern at +Z, +Y up from the waterline, +X to the right of the crew.
// Real dimensions (sim HULL): 7.0 m long, 1.15 m beam at the widest point. Freeboard about 0.30 m.
export const HULL_L = 3.5, HULL_B = 0.575;

const bowW = (t) => HULL_B * Math.pow(Math.max(0, 1 - Math.pow(-t, 2.15)), 0.62);               // t in [-1, 0]
const sternW = (t) => HULL_B * (0.5 + 0.5 * Math.pow(Math.max(0, 1 - Math.pow(t, 3.4)), 0.72));  // t in [0, 1]
const halfW = (t) => (t < 0 ? bowW(t) : sternW(t));
const sheer = (t) => (t < 0 ? 0.3 + 0.3 * Math.pow(-t, 3) : 0.3 + 0.17 * Math.pow(t, 3));
const draft = (t) => (t < 0 ? 0.1 + 0.5 * (1 - Math.pow(-t, 2.1)) : 0.1 + 0.5 * (1 - Math.pow(t, 2.6)));

function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// painted skin: u across the hull (0 left gunwale .. 1 right gunwale), v along it (0 bow .. 1 stern)
function paintTex(THREE, pal, seed) {
  const W = 256, H = 512, c = cv(W, H), x = c.getContext('2d'), r = rng(seed);
  const band = (a, b, col) => { x.fillStyle = col; x.fillRect(a * W, 0, (b - a) * W, H); };
  band(0, 1, pal.main);
  band(0, 0.13, pal.trim); band(0.87, 1, pal.trim);
  band(0.41, 0.59, pal.band);
  band(0.13, 0.15, 'rgba(20,12,6,0.55)'); band(0.85, 0.87, 'rgba(20,12,6,0.55)');
  // adzed wood showing through: fine long grain, a few scuffs and a worn waterline
  for (let i = 0; i < 520; i++) {
    const px = r() * W, py = r() * H, len = 20 + r() * 90;
    x.strokeStyle = r() < 0.5 ? 'rgba(255,240,210,0.06)' : 'rgba(30,14,4,0.09)'; x.lineWidth = 0.6 + r() * 1.4;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 4, py + len); x.stroke();
  }
  for (let i = 0; i < 26; i++) { x.fillStyle = 'rgba(40,24,10,0.2)'; x.beginPath(); x.ellipse(r() * W, r() * H, 2 + r() * 8, 1 + r() * 3, 0, 0, 6.3); x.fill(); }
  // bow cap and a painted chevron, stern band
  x.fillStyle = pal.band; x.beginPath(); x.moveTo(0, 0); x.lineTo(W, 0); x.lineTo(W, 56); x.lineTo(W / 2, 96); x.lineTo(0, 56); x.closePath(); x.fill();
  x.fillStyle = pal.trim; x.fillRect(0, H - 54, W, 14);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function woodTex(THREE, seed) {
  const W = 128, H = 256, c = cv(W, H), x = c.getContext('2d'), r = rng(seed);
  const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#5c3a22'); g.addColorStop(0.5, '#7a4e2c'); g.addColorStop(1, '#5a3820'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 400; i++) { x.strokeStyle = r() < 0.5 ? 'rgba(255,210,150,0.1)' : 'rgba(20,8,0,0.16)'; x.lineWidth = 0.5 + r(); const px = r() * W, py = r() * H; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 6, py + 10 + r() * 50); x.stroke(); }
  for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(30,14,4,0.25)'; x.beginPath(); x.ellipse(r() * W, r() * H, 3 + r() * 6, 1 + r() * 2, 0, 0, 6.3); x.fill(); }   // adze scoops
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

const NS = 40, NP = 16;   // stations along the hull, points across the section
function section(t, k, sc = 1, drop = 0) {
  // k in [0,1] across: -90 .. +90 degrees of the U
  const ph = (k - 0.5) * Math.PI, w = halfW(t) * sc, yg = sheer(t), dd = draft(t) * sc;
  return [w * Math.sin(ph), yg - dd * Math.cos(ph) - drop];
}
function gridGeo(THREE, fn, ns, np, flip) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= ns; i++) for (let j = 0; j <= np; j++) { const [x, y, z, u, v] = fn(i / ns, j / np); pos.push(x, y, z); uv.push(u, v); }
  for (let i = 0; i < ns; i++) for (let j = 0; j < np; j++) {
    const a = i * (np + 1) + j, b = a + 1, c = a + np + 1, d = c + 1;
    if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

let SHARED = null;
export function hullGeometries(THREE) {
  if (SHARED) return SHARED;
  const zOf = (a) => (a * 2 - 1) * HULL_L;
  const tOf = (a) => a * 2 - 1;
  const outer = gridGeo(THREE, (a, k) => { const t = tOf(a), [x, y] = section(t, k); return [x, y, zOf(a), k, 1 - a]; }, NS, NP, false);
  const inner = gridGeo(THREE, (a, k) => { const t = tOf(a), [x, y] = section(t, k, 0.84); return [x, y + 0.0, zOf(a), k * 1.2, a * 3]; }, NS, NP, true);
  // gunwale rim: flat strip between the outer and inner edge on both sides
  const rim = (side) => gridGeo(THREE, (a, k) => {
    const t = tOf(a), [xo] = section(t, side > 0 ? 1 : 0), [xi] = section(t, side > 0 ? 1 : 0, 0.84), y = sheer(t) + 0.012;
    return [xo + (xi - xo) * k, y, zOf(a), k, a * 3];
  }, NS, 2, side > 0);
  // transom (flat stern) and floor line are closed by the inner/outer meeting at the rim; add a stern cap disc
  const cap = new THREE.CircleGeometry(1, 20);
  SHARED = { outer, inner, rimL: rim(-1), rimR: rim(1), cap };
  return SHARED;
}

// A complete hull group. pal: { main, band, trim, cap }. Returns { group, wake, dispose }.
export function makeHull(THREE, pal, seed = 1) {
  const G = hullGeometries(THREE);
  const group = new THREE.Group();
  const skin = new THREE.MeshPhysicalMaterial({ map: paintTex(THREE, pal, seed), side: THREE.DoubleSide, roughness: 0.52, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.35 });
  const wood = new THREE.MeshStandardMaterial({ map: woodTex(THREE, seed + 7), roughness: 0.82, side: THREE.DoubleSide });
  const rimM = new THREE.MeshStandardMaterial({ map: woodTex(THREE, seed + 3), color: '#d9b784', roughness: 0.6, side: THREE.DoubleSide });
  const outer = new THREE.Mesh(G.outer, skin); outer.castShadow = true; outer.receiveShadow = true;
  const innerM = new THREE.MeshPhysicalMaterial({ map: skin.map, color: '#cfc0b0', side: THREE.DoubleSide, roughness: 0.7 });
  const inner = new THREE.Mesh(G.inner, innerM); inner.receiveShadow = true; inner.castShadow = false;
  const rl = new THREE.Mesh(G.rimL, rimM), rr = new THREE.Mesh(G.rimR, rimM);
  rl.castShadow = rr.castShadow = true;
  // stern transom plate
  const tp = new THREE.Mesh(G.cap, skin); tp.scale.set(HULL_B * 0.52, 0.34, 1); tp.position.set(0, 0.0, HULL_L + 0.001); tp.visible = false;
  group.add(outer, inner, rl, rr);
  // thwarts: low wooden seats across the hull, two paddlers sit behind each other
  const thw = new THREE.MeshStandardMaterial({ map: woodTex(THREE, seed + 11), color: '#e8c796', roughness: 0.65 });
  const seats = [];
  for (const z of [-1.15, 1.25]) {
    const w = halfW(z / HULL_L) * 0.84;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w * 2 + 0.06, 0.05, 0.3), thw); m.position.set(0, 0.04, z + 0.24); m.castShadow = true; m.receiveShadow = true; group.add(m); seats.push(m);
  }
  // a bailer and a coil of rope lying in the bottom, the small things that make it a working boat
  const bailer = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.075, 0.12, 14, 1, true), new THREE.MeshStandardMaterial({ color: '#e8e0d0', roughness: 0.7, side: THREE.DoubleSide }));
  bailer.position.set(0.17, -0.06, 0.18); bailer.rotation.z = 0.5; group.add(bailer);
  const rope = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 8, 18), new THREE.MeshStandardMaterial({ color: '#d8c9a0', roughness: 0.9 }));
  rope.rotation.x = Math.PI / 2; rope.position.set(-0.15, -0.14, 2.35); group.add(rope);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 5.6), new THREE.MeshStandardMaterial({ color: '#3aa6c8', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.8 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0.02, 0.1); water.visible = false; group.add(water);
  return { group, water, skin, innerM, dispose() { skin.map.dispose(); wood.map.dispose(); rimM.map.dispose(); thw.map.dispose(); skin.dispose(); wood.dispose(); rimM.dispose(); thw.dispose(); } };
}

// Single-blade paddle with a T-grip. Origin = blade tip, +Y along the shaft, total length 1.45 m, blade 0.18 x 0.58 m.
export function makePaddle(THREE, colour = '#f0a81c') {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#c99a5a', roughness: 0.6 });
  const paint = new THREE.MeshPhysicalMaterial({ color: colour, roughness: 0.45, clearcoat: 0.5 });
  const sh = new THREE.Shape();
  sh.moveTo(0, 0); sh.bezierCurveTo(0.085, 0.04, 0.095, 0.3, 0.05, 0.56); sh.lineTo(-0.05, 0.56); sh.bezierCurveTo(-0.095, 0.3, -0.085, 0.04, 0, 0);
  const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1, curveSegments: 10 });
  bg.translate(0, 0, -0.011);
  const blade = new THREE.Mesh(bg, paint); blade.castShadow = true; g.add(blade);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.023, 0.95, 10), wood); shaft.position.y = 0.55 + 0.475 - 0.1; shaft.castShadow = true; g.add(shaft);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.17, 10), wood); grip.rotation.z = Math.PI / 2; grip.position.y = 1.44; grip.castShadow = true; g.add(grip);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), wood); knob.position.y = 1.43; g.add(knob);
  return g;
}
export { halfW, sheer };

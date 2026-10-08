// The dragon boat: a lofted hull with painted scales and gold trim, a carved dragon head and tail, thwarts, a lacquered drum,
// the steering sweep oar and paddles. Built from primitives (no external art). Local axes: +Z is the bow, +X the boat's left,
// y = 0 is the waterline.
import { THREE } from '../vendor3d/index.js';

const T = THREE;
const doc = globalThis.document;
export const BOAT_HALF = 6.2;
export const ROWS = 10;
export const rowZ = (k) => -3.45 + k * 0.84;
export const SEAT_Y = 0.3;
export const FLOOR_Y = -0.1;

const halfWidth = (s) => 0.075 + 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.88)), 0.5);
const gunwaleY = (s) => 0.4 + 1.0 * Math.pow(s, 8) + 0.6 * Math.pow(1 - s, 7);
const keelY = (s) => -0.3 + 0.52 * Math.pow(s, 4) + 0.5 * Math.pow(1 - s, 4);

export function hullTexture(hue, accent) {
  const c = doc.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  const base = `hsl(${hue},68%,40%)`, lt = `hsl(${hue},70%,50%)`, dk = `hsl(${hue},72%,28%)`;
  g.fillStyle = base; g.fillRect(0, 0, 512, 256);
  // the scaled band, rows of overlapping arcs
  for (let row = 0; row < 9; row++) {
    for (let x = -20; x < 540; x += 42) {
      const cx = x + (row % 2 ? 21 : 0), cy = 44 + row * 18;
      g.beginPath(); g.arc(cx, cy, 21, 0, Math.PI); g.fillStyle = row % 2 ? lt : base; g.fill(); g.lineWidth = 2.2; g.strokeStyle = dk; g.stroke();
      g.beginPath(); g.arc(cx, cy + 1, 12, 0.15, Math.PI - 0.15); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1.5; g.stroke();
    }
  }
  const mirror = (y0, y1, fill) => { g.fillStyle = fill; g.fillRect(0, y0, 512, y1 - y0); g.fillRect(0, 256 - y1, 512, y1 - y0); };
  mirror(0, 26, accent);                       // gold gunwale band
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 26, 512, 3); g.fillRect(0, 256 - 29, 512, 3);
  mirror(26, 31, dk);
  // waterline stripe on the keel side (centre of v)
  const gr = g.createLinearGradient(0, 100, 0, 156); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(10,20,30,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 100, 512, 56);
  // wave lacquer shine
  const sh = g.createLinearGradient(0, 0, 512, 0); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.08)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(0, 0, 512, 256);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = T.RepeatWrapping; t.anisotropy = 4; return t;
}

function hullGeometry() {
  const NS = 36, NA = 14, pos = [], uv = [], idx = [];
  for (let i = 0; i <= NS; i++) {
    const s = i / NS, z = -BOAT_HALF + 2 * BOAT_HALF * s, hw = halfWidth(s), top = gunwaleY(s), bot = keelY(s);
    for (let j = 0; j <= NA; j++) {
      const f = Math.PI * (j / NA), x = -hw * Math.cos(f), y = top - (top - bot) * Math.pow(Math.sin(f), 0.72);
      pos.push(x, y, z); uv.push(z / 3.2, j / NA);
    }
  }
  for (let i = 0; i < NS; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

const sphere = (r, mat, sx = 1, sy = 1, sz = 1, seg = 12) => { const m = new T.Mesh(new T.SphereGeometry(r, seg, Math.max(6, seg - 4)), mat); m.scale.set(sx, sy, sz); return m; };
const tube = (pts, r, mat, seg = 24, rad = 8) => new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...p))), seg, r, rad, false), mat);
const cone = (r, h, mat, seg = 8) => new T.Mesh(new T.CylinderGeometry(0, r, h, seg), mat);

export function makeDragonHead(hue, mats) {
  const g = new T.Group();
  const { gold, body, white, dark, red } = mats;
  g.add(tube([[0, 0.5, 5.75], [0, 1.0, 6.05], [0, 1.65, 6.3], [0, 2.05, 6.65], [0, 2.1, 6.95]], 0.15, body, 26, 10));
  const head = new T.Group(); head.position.set(0, 2.15, 7.0); head.rotation.x = 0.06;
  const skull = sphere(0.27, body, 1, 0.9, 1.15); skull.position.set(0, 0, 0); head.add(skull);
  const snout = sphere(0.22, body, 0.95, 0.72, 1.45); snout.position.set(0, -0.02, 0.38); head.add(snout);
  const lip = sphere(0.2, gold, 0.95, 0.35, 1.5); lip.position.set(0, -0.15, 0.4); head.add(lip);
  const jaw = sphere(0.18, body, 0.9, 0.3, 1.5); jaw.position.set(0, -0.3, 0.32); jaw.rotation.x = 0.16; head.add(jaw);
  const tongue = sphere(0.1, red, 0.8, 0.25, 1.6); tongue.position.set(0, -0.23, 0.36); head.add(tongue);
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) { const t = cone(0.028, 0.12, white, 6); t.rotation.x = Math.PI; t.position.set(sx * 0.13, -0.2, 0.18 + i * 0.1); head.add(t); }
  for (const sx of [-1, 1]) {
    const eyeWhite = sphere(0.075, white, 1, 1, 1, 12); eyeWhite.position.set(sx * 0.2, 0.1, 0.18); head.add(eyeWhite);
    const pupil = sphere(0.045, dark, 1, 1, 1, 10); pupil.position.set(sx * 0.255, 0.1, 0.22); head.add(pupil);
    const brow = sphere(0.09, gold, 1.2, 0.5, 1.6); brow.position.set(sx * 0.2, 0.2, 0.2); brow.rotation.z = sx * -0.35; head.add(brow);
    const nostril = sphere(0.032, dark, 1, 1, 1, 8); nostril.position.set(sx * 0.07, 0.05, 0.85); head.add(nostril);
    head.add(Object.assign(tube([[sx * 0.14, 0.24, -0.02], [sx * 0.28, 0.5, -0.2], [sx * 0.34, 0.82, -0.5], [sx * 0.3, 1.0, -0.82]], 0.035, gold, 12, 6), {}));
    const ear = cone(0.07, 0.24, body, 6); ear.rotation.x = -1.2; ear.rotation.z = sx * 0.5; ear.position.set(sx * 0.27, 0.12, -0.18); head.add(ear);
    const whisk = tube([[sx * 0.1, -0.2, 0.7], [sx * 0.4, -0.34, 0.55], [sx * 0.7, -0.62, 0.15], [sx * 0.66, -0.9, -0.2]], 0.014, white, 14, 5); head.add(whisk);
  }
  const beard = cone(0.08, 0.38, gold, 6); beard.position.set(0, -0.5, 0.18); head.add(beard);
  g.add(head);
  // mane down the neck: gold flame-like cones
  for (let k = 0; k < 7; k++) { const t = k / 6, c = cone(0.1, 0.34, k % 2 ? gold : red, 6); c.position.set(0, 0.72 + t * 1.3 - 0.0, 5.85 + t * 0.85 + (t > 0.7 ? 0.0 : -0.1)); c.rotation.x = -0.9; g.add(c); }
  return g;
}
function makeTail(mats) {
  const g = new T.Group();
  g.add(tube([[0, 0.55, -5.85], [0, 0.85, -6.4], [0, 1.45, -6.75], [0, 2.0, -6.5], [0, 2.3, -6.0], [0, 2.25, -5.65]], 0.085, mats.body, 24, 8));
  for (let k = 0; k < 7; k++) { const t = k / 6, p = [0, 0.9 + t * 1.2, -6.45 - Math.sin(t * 2.6) * 0.3 + t * 0.7]; const f = cone(0.1, 0.4, k % 2 ? mats.gold : mats.red, 5); f.scale.x = 0.3; f.position.set(p[0], p[1], p[2]); f.rotation.x = 0.4 + t; g.add(f); }
  return g;
}

// Paddles are drawn as two instanced meshes per boat (wooden shaft + grip, painted blade): 2 draw calls for the whole crew.
function mergeGeos(parts) {
  const pos = [], nor = [], uv = [];
  for (const { geo, m } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(m);
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    if (g.attributes.uv) uv.push(...g.attributes.uv.array); else for (let i = 0; i < g.attributes.position.count; i++) uv.push(0, 0);
  }
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); out.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  return out;
}
const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(1, 1, 1));
export const PADDLE_LEN = 1.15;
export function makePaddleSet(mats, n) {
  const shaft = mergeGeos([
    { geo: new T.CylinderGeometry(0.017, 0.02, 1.15, 7), m: M4(0, 0.575, 0) },
    { geo: new T.CylinderGeometry(0.02, 0.02, 0.2, 7), m: M4(0, 1.15, 0, 0, 0, Math.PI / 2) },
    { geo: new T.BoxGeometry(0.03, 0.56, 0.03), m: M4(0, -0.18, 0) },
  ]);
  const blade = mergeGeos([
    { geo: new T.BoxGeometry(0.19, 0.5, 0.022), m: M4(0, -0.2, 0) },
    { geo: new T.CylinderGeometry(0.095, 0.095, 0.022, 12, 1, false, 0, Math.PI), m: M4(0, -0.45, 0, Math.PI / 2, 0, Math.PI) },
  ]);
  const wood = new T.InstancedMesh(shaft, mats.wood, n), paint = new T.InstancedMesh(blade, mats.paddle, n);
  for (const im of [wood, paint]) { im.frustumCulled = false; im.castShadow = true; im.instanceMatrix.setUsage(T.DynamicDrawUsage ?? 35048); }
  const zero = new T.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < n; i++) { wood.setMatrixAt(i, zero); paint.setMatrixAt(i, zero); }
  const m = new T.Matrix4(), one = new T.Vector3(1, 1, 1);
  return { wood, paint, set(i, pos, quat) { m.compose(pos, quat, one); wood.setMatrixAt(i, m); paint.setMatrixAt(i, m); wood.instanceMatrix.needsUpdate = true; paint.instanceMatrix.needsUpdate = true; } };
}

// Merge the static pieces of a boat by material: a boat is a few dozen meshes while building and ~10 draw calls once merged.
function mergeStatic(root, keep) {
  root.updateMatrixWorld(true);
  const inside = (o) => { for (let p = o; p; p = p.parent) if (keep.includes(p)) return true; return false; };
  const groups = new Map(), list = [];
  root.traverse((o) => { if (o.isMesh && !inside(o)) list.push(o); });
  for (const m of list) { if (!groups.has(m.material)) groups.set(m.material, []); groups.get(m.material).push(m); }
  for (const [mat, ms] of groups) {
    if (ms.length < 2) continue;
    const merged = new T.Mesh(mergeGeos(ms.map((m) => ({ geo: m.geometry, m: m.matrixWorld }))), mat);
    merged.castShadow = true; merged.receiveShadow = true;
    for (const m of ms) m.parent.remove(m);
    root.add(merged);
  }
}

// Merge a small group's direct child meshes by material (the drum: 25 meshes become 4 draw calls).
function mergeLocal(group) {
  group.updateMatrixWorld(true);
  const by = new Map();
  for (const c of [...group.children]) if (c.isMesh) { c.updateMatrix(); if (!by.has(c.material)) by.set(c.material, []); by.get(c.material).push(c); }
  for (const [mat, ms] of by) {
    if (ms.length < 2) continue;
    const mesh = new T.Mesh(mergeGeos(ms.map((m) => ({ geo: m.geometry, m: m.matrix }))), mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    for (const m of ms) group.remove(m);
    group.add(mesh);
  }
}

export function makeBoat(hue, opts = {}) {
  const root = new T.Group();
  const accent = opts.accent ?? '#e2b13c';
  const hull = new T.MeshStandardMaterial({ map: hullTexture(hue, accent), roughness: 0.38, metalness: 0.05, side: T.DoubleSide, envMapIntensity: 0.9 });
  const body = new T.MeshStandardMaterial({ color: new T.Color().setHSL(hue / 360, 0.72, 0.36), roughness: 0.4, metalness: 0.05 });
  const mats = {
    gold: new T.MeshStandardMaterial({ color: 0xe2b13c, roughness: 0.3, metalness: 0.6 }), body, white: new T.MeshStandardMaterial({ color: 0xf6f2e8, roughness: 0.5 }),
    dark: new T.MeshStandardMaterial({ color: 0x111418, roughness: 0.4 }), red: new T.MeshStandardMaterial({ color: 0xc8282a, roughness: 0.5 }),
    wood: new T.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.7 }), paddle: new T.MeshStandardMaterial({ color: new T.Color().setHSL(hue / 360, 0.75, 0.5), roughness: 0.5 }),
    deck: new T.MeshStandardMaterial({ color: 0xb98a58, roughness: 0.8 }), lacquer: new T.MeshStandardMaterial({ color: 0xb21f24, roughness: 0.28, metalness: 0.05 }),
  };
  const h = new T.Mesh(hullGeometry(), hull); h.castShadow = true; h.receiveShadow = true; root.add(h);
  // floor boards and the long keel-line inside
  const floor = new T.Mesh(new T.BoxGeometry(0.78, 0.04, 11.2), mats.deck); floor.position.set(0, FLOOR_Y - 0.02, 0); floor.receiveShadow = true; root.add(floor);
  // gunwale rails
  for (const sd of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 28; i++) { const s = i / 28; pts.push([sd * (halfWidth(s) + 0.01), gunwaleY(s) + 0.02, -BOAT_HALF + 2 * BOAT_HALF * s]); }
    const rail = tube(pts, 0.035, mats.gold, 40, 6); root.add(rail);
  }
  // thwarts
  for (let k = 0; k < ROWS; k++) {
    const z = rowZ(k), s = (z + BOAT_HALF) / (2 * BOAT_HALF), hw = halfWidth(s);
    const bench = new T.Mesh(new T.BoxGeometry(hw * 2 + 0.06, 0.055, 0.3), mats.deck); bench.position.set(0, SEAT_Y, z); bench.castShadow = true; root.add(bench);
  }
  // bow and stern details
  root.add(makeDragonHead(hue, mats)); root.add(makeTail(mats));
  const stem = new T.Mesh(new T.BoxGeometry(0.1, 0.9, 0.24), mats.gold); stem.position.set(0, 0.8, 6.05); stem.rotation.x = -0.35; root.add(stem);
  // drummer's seat and platform and the drum
  const plat = new T.Mesh(new T.BoxGeometry(0.9, 0.06, 1.1), mats.deck); plat.position.set(0, 0.28, 5.2); root.add(plat);
  const stool = new T.Mesh(new T.CylinderGeometry(0.2, 0.22, 0.14, 12), mats.wood); stool.position.set(0, 0.42, 5.3); root.add(stool);
  const drum = new T.Group(); drum.position.set(0, 0.88, 4.45); drum.rotation.x = -0.55;
  const dbody = new T.Mesh(new T.CylinderGeometry(0.34, 0.34, 0.5, 28), mats.lacquer); dbody.rotation.z = 0; drum.add(dbody);
  const skin = new T.Mesh(new T.CylinderGeometry(0.325, 0.325, 0.52, 28), new T.MeshStandardMaterial({ color: 0xf0e4c8, roughness: 0.6 })); skin.scale.set(1, 1, 1);
  const skinTop = new T.Mesh(new T.CylinderGeometry(0.31, 0.31, 0.02, 28), new T.MeshStandardMaterial({ color: 0xf0e4c8, roughness: 0.55 })); skinTop.position.y = 0.26; drum.add(skinTop);
  for (const y of [-0.26, 0.26]) { const band = new T.Mesh(new T.CylinderGeometry(0.352, 0.352, 0.045, 28), mats.gold); band.position.y = y; drum.add(band); }
  for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; const stud = sphere(0.018, mats.gold, 1, 1, 1, 6); stud.position.set(Math.cos(a) * 0.352, 0.2, Math.sin(a) * 0.352); drum.add(stud); }
  mergeLocal(drum);
  drum.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  root.add(drum);
  const stand = new T.Mesh(new T.BoxGeometry(0.1, 0.55, 0.1), mats.wood); stand.position.set(0, 0.5, 4.6); root.add(stand);
  // the steering sweep oar: pivots at the stern post
  const oar = new T.Group(); oar.position.set(0.5, 1.0, -5.55);
  const oarPole = new T.Mesh(new T.CylinderGeometry(0.022, 0.034, 4.2, 8), mats.wood); oarPole.rotation.x = Math.PI / 2 + 0.2; oarPole.position.set(0, -0.28, -1.0); oar.add(oarPole);
  const oarBlade = new T.Mesh(new T.BoxGeometry(0.26, 0.04, 0.8), mats.paddle); oarBlade.position.set(0, -0.78, -3.0); oarBlade.rotation.x = 0.2; oar.add(oarBlade);
  const post = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 0.9, 8), mats.wood); post.position.set(0, -0.35, 0); oar.add(post);
  root.add(oar);
  const stplat = new T.Mesh(new T.BoxGeometry(0.9, 0.06, 0.9), mats.deck); stplat.position.set(0, 0.2, -5.0); root.add(stplat);
  mergeStatic(root, [oar, drum]);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, oar, drum, mats, accent, hullMat: hull, hue };
}

// Give an existing boat another crew's colours (new race): hull paint, dragon, paddles. The shirts are set by the crew.
export function restyleBoat(boat, hue) {
  if (boat.hue === hue) return;
  boat.hue = hue;
  boat.hullMat.map?.dispose?.(); boat.hullMat.map = hullTexture(hue, boat.accent); boat.hullMat.needsUpdate = true;
  boat.mats.body.color.setHSL(hue / 360, 0.72, 0.36); boat.mats.paddle.color.setHSL(hue / 360, 0.75, 0.5);
}

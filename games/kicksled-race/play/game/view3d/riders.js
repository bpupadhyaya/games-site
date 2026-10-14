// Real 3D riders on a real 3D kicksled (presentation only: it reads the numbers the 2D scene already has for a racer and never writes back).
//
// The shared view3d layer supplies the person (athlete_m / athlete_f), the stage and the IK; this file dresses them for winter (the body texture is
// repainted on a private canvas copy: sleeves, gloves, trousers, boots), builds the sled and the knit hat and scarf, and authors the pose on the
// skeleton: one foot on the runner, the other kicking on the snow, both hands on the handle bar. Each racer is rendered in turn into one small
// off-screen WebGL canvas and composited by the 2D scene (src/art.js drawRider calls globalThis.__rider3d.draw()).
import { createStage, loadHuman, Clip, CLIP_BONES, semanticRot, THREE } from '../vendor3d/index.js';

const { Vector3, Quaternion, Euler } = THREE;
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const bi = (n) => CLIP_BONES.indexOf(`Bip01_${n}`);

// The picture region in sled space (metres): x forward from the rider's rear footplate, y up from the snow.
export const REGION = { x0: -1.4, y0: -0.12, w: 3.1, h: 2.4 };
const CAM = { dist: 16, yaw: 13 * D2R, pitch: 5 * D2R };
const MAX_POOL = 7;

const FEMALE = new Set(['Aino', 'Maja', 'Elsa', 'Sigrid', 'Kaisa']);
const LOOKS = {
  You: { skin: 'light', hair: 'brown' }, ghost: { skin: 'light', hair: 'grey' },
  Aino: { skin: 'light', hair: 'blond' }, Olle: { skin: 'tan', hair: 'black' }, Maja: { skin: 'light', hair: 'ginger' },
  Mikko: { skin: 'light', hair: 'blond' }, Elsa: { skin: 'light', hair: 'brown' }, Lars: { skin: 'tan', hair: 'brown' },
  Sigrid: { skin: 'light', hair: 'blond' }, Henrik: { skin: 'tan', hair: 'black' }, Kaisa: { skin: 'light', hair: 'black' },
};
const DARK = '#1d252f';

// ---------------------------------------------------------------------------------------------------------------------------------
// Winter clothes by repainting the body texture. Every triangle of the skinned body is classed by the bone that moves it most (arm, hand, leg, foot);
// those pixels become light cloth (with the fold shading of the original) and are routed to the kit's top / bottoms / socks tint channels, so
// setKit() colours them. The shared vendored textures stay untouched (a canvas copy per person).
function dress(human) {
  const N = 1024;
  const cls = (name) => (/_(UpperArm|Forearm)$/.test(name) ? 1 : /_(Hand|Finger)/.test(name) ? 3 : /_(Thigh|Calf)$/.test(name) ? 2 : /_(Foot|Toe)/.test(name) ? 3 : /(Clavicle|Spine\d?|Pelvis)$/.test(name) ? 4 : 0);
  const cv = () => { const c = globalThis.document.createElement('canvas'); c.width = c.height = N; return c; };
  const bodyMats = human.mats.filter((m) => m.userData.kind === 'body' && m.map && m.userData.tint);
  if (!bodyMats.length) return;
  const layers = [null, cv(), cv(), cv(), cv()];       // 1 sleeves (top channel), 2 trousers (bottoms channel), 3 gloves + boots (socks channel)
  const gs = layers.map((c) => (c ? c.getContext('2d') : null));
  for (const g of gs) if (g) { g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = 2.2; g.lineJoin = 'round'; }
  human.root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((m) => bodyMats.includes(m))) return;
    const geo = o.geometry, ix = geo.index, uv = geo.attributes.uv, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    if (!ix || !uv || !si || !sw) return;
    const bones = o.skeleton.bones;
    const vc = new Uint8Array(uv.count);
    for (let v = 0; v < uv.count; v++) {
      const acc = [0, 0, 0, 0, 0];
      for (let k = 0; k < 4; k++) acc[cls(bones[si.getComponent(v, k)].name)] += sw.getComponent(v, k);
      let best = 0; for (let c = 1; c < 5; c++) if (acc[c] > acc[best]) best = c;
      vc[v] = acc[best] > 0.5 ? best : 0;
    }
    const a = ix.array;
    for (let t = 0; t < a.length; t += 3) {
      const c0 = vc[a[t]], c1 = vc[a[t + 1]], c2 = vc[a[t + 2]];
      const nz = [c0, c1, c2].filter((x) => x).sort();
      const c = c0 === c1 || c0 === c2 ? c0 : c1 === c2 ? c1 : nz.length ? nz[0] : 0;     // a triangle that straddles three classes goes to the lowest (arm first)
      if (!c) continue;
      const g = gs[c];
      g.beginPath();
      g.moveTo(uv.getX(a[t]) * N, uv.getY(a[t]) * N); g.lineTo(uv.getX(a[t + 1]) * N, uv.getY(a[t + 1]) * N); g.lineTo(uv.getX(a[t + 2]) * N, uv.getY(a[t + 2]) * N);
      g.closePath(); g.fill(); g.stroke();
    }
  });
  const read = (img) => { const c = cv(); const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, N, N); return { c, g, d: g.getImageData(0, 0, N, N) }; };
  const texOf = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; return t; };
  const L = layers.map((c, i) => (c ? gs[i].getImageData(0, 0, N, N).data : null));
  for (const m of bodyMats) {
    const u = m.userData.tint;
    const A = read(m.map.image), M = read(u.tMask.value.image), K = read(u.tSkin.value.image);
    const a = A.d.data, mk = M.d.data, sk = K.d.data;
    for (let i = 0; i < a.length; i += 4) {
      let c = 0;
      for (let k = 1; k < 4; k++) if (L[k][i + 3] > 110) { c = k; break; }
      if (!c && L[4][i + 3] > 110 && sk[i] > 90) c = 1;             // bare skin on the shoulders and back: the jacket
      if (!c) continue;
      const lum = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
      // soft cloth shading from the original's folds and muscle shadow, kept inside a narrow band so the kit colour reads clean
      const g = clamp(226 + (lum - 150) * 0.3, 170, 250);
      a[i] = g; a[i + 1] = g; a[i + 2] = g; a[i + 3] = 255;
      sk[i] = 0; mk[i] = 0; mk[i + 1] = 0; mk[i + 2] = 0;
      if (c === 1) mk[i] = 255; else if (c === 2) mk[i + 1] = 255; else mk[i + 2] = 255;
    }
    A.g.putImageData(A.d, 0, 0); M.g.putImageData(M.d, 0, 0); K.g.putImageData(K.d, 0, 0);
    m.map = texOf(A.c, true); u.tMask.value = texOf(M.c, false); u.tSkin.value = texOf(K.c, false);
    m.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
const stdMat = (color, rough = 0.7, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
const tubeOf = (pts, r, m, seg = 24, rad = 8) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new Vector3(p[0], p[1], p[2]))), seg, r, rad, false), m);
const boxOf = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };

// A box with rounded edges (every vertex of a subdivided box is pulled onto the rounded surface).
function roundedBox(w, h, d, r, mat, seg = 6) {
  const geo = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const pos = geo.attributes.position, hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, v = new Vector3(), c = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    c.set(clamp(v.x, -hx, hx), clamp(v.y, -hy, hy), clamp(v.z, -hz, hz));
    v.sub(c); if (v.lengthSq() > 1e-12) v.normalize().multiplyScalar(r);
    pos.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

// The kicksled: two steel runners with curled tips, wooden footplates at the back where the rider stands, a slatted seat with a cushion, and
// the two curved handle posts with a cross bar and rubber grips that reach back to the rider. x forward, y up, z toward the camera.
function buildSled(cushionHex) {
  const g = new THREE.Group();
  const steel = stdMat('#aeb9c4', 0.28, 0.85), darkSteel = stdMat('#56616c', 0.4, 0.8);
  const wood = stdMat('#a8692f', 0.72), woodDark = stdMat('#7c4a1f', 0.75), woodLight = stdMat('#c58a47', 0.7);
  const cushion = stdMat(cushionHex, 0.85), grip = stdMat('#1b1f24', 0.9);
  const ZS = 0.2;
  for (const z of [-ZS, ZS]) {
    // runner blade: a flat steel strip, curled up at the front
    g.add(tubeOf([[-1.05, 0.03, z], [-0.4, 0.028, z], [0.5, 0.028, z], [1.0, 0.032, z], [1.17, 0.07, z], [1.27, 0.17, z], [1.3, 0.3, z]], 0.02, steel, 40, 8));
    // footplate on top of the runner at the rear, with two uprights
    g.add(boxOf(0.86, 0.028, 0.105, wood, -0.6, 0.118, z));
    g.add(boxOf(0.86, 0.012, 0.012, woodDark, -0.6, 0.134, z - 0.034));
    g.add(boxOf(0.86, 0.012, 0.012, woodDark, -0.6, 0.134, z + 0.034));
    for (const x of [-0.95, -0.3]) g.add(boxOf(0.04, 0.09, 0.05, woodDark, x, 0.072, z));
    // seat posts and the stringer under the seat
    for (const x of [0.36, 0.98]) g.add(boxOf(0.045, 0.37, 0.04, wood, x, 0.225, z));
    g.add(boxOf(1.0, 0.04, 0.05, woodDark, 0.68, 0.07, z));
    g.add(boxOf(0.7, 0.03, 0.03, woodDark, 0.67, 0.16, z));
  }
  // seat slats, a plump cushion and a padded back
  for (let i = 0; i < 5; i++) g.add(boxOf(0.1, 0.028, 0.5, wood, 0.37 + i * 0.145, 0.43, 0));
  const pillow = roundedBox(0.68, 0.085, 0.44, 0.04, cushion); pillow.position.set(0.7, 0.485, 0); g.add(pillow);
  const pad = roundedBox(0.07, 0.26, 0.4, 0.03, cushion); pad.position.set(0.385, 0.66, 0); pad.rotation.z = -0.12; g.add(pad);
  for (let i = 0; i < 3; i++) g.add(boxOf(0.035, 0.07, 0.46, wood, 0.33, 0.52 + i * 0.09, 0));
  for (const z of [-0.2, 0.2]) g.add(boxOf(0.04, 0.3, 0.04, woodDark, 0.33, 0.6, z));
  // handle posts: curved from the seat back up and back toward the rider, with grips
  for (const z of [-ZS * 0.92, ZS * 0.92]) {
    g.add(tubeOf([[0.32, 0.43, z], [0.31, 0.7, z], [0.25, 0.9, z], [0.12, 1.0, z], [0.04, 1.03, z]], 0.02, woodLight, 20, 8));
  }
  g.add(tubeOf([[0.04, 1.03, -ZS * 0.92], [0.04, 1.03, ZS * 0.92]], 0.019, darkSteel, 4, 8));
  for (const z of [-0.13, 0.13]) { const gp = new THREE.Mesh(new THREE.CylinderGeometry(0.0235, 0.0235, 0.14, 12), grip); gp.rotation.x = Math.PI / 2; gp.position.set(0.04, 1.03, z * 1.05); g.add(gp); }
  // a small steel brace between the posts and the seat
  g.add(tubeOf([[0.32, 0.5, -ZS], [0.32, 0.5, ZS]], 0.012, darkSteel, 4, 6));
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

// A knit hat (dome, folded band, pom) on the head bone, sized from the skinned head extents.
function addHat(human, hex) {
  const head = human.bones.Bip01_Head;
  const f = human.boneFrame('Head');
  const m4 = new THREE.Matrix4().makeBasis(f.left.clone().normalize(), f.up.clone().normalize(), f.fwd.clone().normalize());
  const q = new Quaternion().setFromRotationMatrix(m4);
  const box = human.headBox;
  const c = box ? box.getCenter(new Vector3()) : new Vector3(0.07, 0, 0);
  const upExt = box ? Math.max(box.max.dot(f.up), box.min.dot(f.up)) : 0.2;
  const top = c.clone().addScaledVector(f.up, upExt - c.dot(f.up));
  const g = new THREE.Group();
  g.quaternion.copy(q);
  const R = 0.118;
  g.position.copy(top).addScaledVector(f.up, -0.02).addScaledVector(f.fwd, -0.02);
  const knit = stdMat(hex, 0.95), band = stdMat('#f4f6f8', 0.95);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), knit); dome.scale.set(1.02, 0.86, 1.1); g.add(dome);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.035, R * 1.04, 0.05, 28, 1, true), band); cuff.scale.set(1.02, 1, 1.1); cuff.position.y = -R * 0.38; g.add(cuff);
  const rimT = new THREE.Mesh(new THREE.TorusGeometry(R * 1.03, 0.012, 8, 28), band); rimT.rotation.x = Math.PI / 2; rimT.scale.set(1.02, 1.1, 1); rimT.position.y = -R * 0.38 + 0.024; g.add(rimT);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 10), band); pom.position.y = R * 0.98; g.add(pom);
  head.add(g);
  return { g, knit };
}

// A scarf: a wrapped collar on the neck bone and a tapered ribbon tail that streams back with the speed (rebuilt every frame in sled space).
function addScarf(human, scene, hexA, hexB) {
  const neck = human.bones.Bip01_Neck;
  human._applyRest(); human.root.updateMatrixWorld(true);
  const q = neck.getWorldQuaternion(new Quaternion()).invert();       // world axes expressed in the neck bone's frame (rest pose)
  const ringM = stdMat(hexA, 0.95);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.038, 12, 24), ringM);
  ring.rotation.x = Math.PI / 2; ring.scale.set(1, 1.25, 0.95); ring.position.set(0, 0.015, 0.012);
  const holder = new THREE.Group(); holder.quaternion.copy(q); holder.add(ring);
  neck.add(holder);
  const N = 9;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 2 * 3), 3));
  const col = new Float32Array((N + 1) * 2 * 3);
  const ca = new THREE.Color(hexA), cb = new THREE.Color(hexB);
  for (let i = 0; i <= N; i++) { const c = (Math.floor(i / 2) % 2 ? cb : ca); for (let k = 0; k < 2; k++) { col[(i * 2 + k) * 3] = c.r; col[(i * 2 + k) * 3 + 1] = c.g; col[(i * 2 + k) * 3 + 2] = c.b; } }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const idx = [];
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { mesh, geo, N, holder };
}

// ---------------------------------------------------------------------------------------------------------------------------------
class Rider {
  constructor(human, who, opts) {
    this.h = human; this.who = who;
    this.clip = new Clip({ name: 'pose', frames: 1, dur: 1 / 30, fps: 30, loop: true, quats: new Float32Array(CLIP_BONES.length * 4), pelvis: new Float32Array(3), grounded: false, fingers: 'relaxed' });
    human.addClip(this.clip);
    human.groundClamp = 'off'; human.footPlanting = false;
    this.restQ = new Float32Array(human.restPose.q);
    this.e = new Euler(); this.qa = new Quaternion(); this.qb = new Quaternion();
    this.ph = human.pelvisHeight;
    human.play(this.clip, { fade: 0 });
    this.yaw = Math.PI / 2;
    this.sled = opts.noSled ? null : buildSled(opts.cushion);
    this.hat = addHat(human, opts.hat);
    this.used = 0;
    // smoothed state (presentation only)
    this.s = { t: null, kf: 0.1, ku: 0, tuck: 0, lean: 0, ready: 0 };
  }
  writePose(offs, pel) {
    const q = this.clip.quats;
    q.set(this.restQ);
    for (const n in offs) {
      const i = bi(n); if (i < 0) continue;
      const r = semanticRot(`Bip01_${n}`, offs[n]);
      this.qa.set(q[i * 4], q[i * 4 + 1], q[i * 4 + 2], q[i * 4 + 3]);
      this.qb.setFromEuler(this.e.set(r[0] * D2R, r[1] * D2R, r[2] * D2R, 'XYZ'));
      this.qa.multiply(this.qb);
      q[i * 4] = this.qa.x; q[i * 4 + 1] = this.qa.y; q[i * 4 + 2] = this.qa.z; q[i * 4 + 3] = this.qa.w;
    }
    this.clip.pelvis[0] = pel[0] / this.ph; this.clip.pelvis[1] = pel[1] / this.ph; this.clip.pelvis[2] = pel[2] / this.ph;
  }
  dispose(scene) {
    scene.remove(this.h.root); if (this.sled) scene.remove(this.sled); if (this.scarf) scene.remove(this.scarf.mesh);
    this.h.root.traverse((o) => { if (o.isMesh) { o.geometry && o.geometry.dispose && o.geometry.dispose(); } });
    for (const m of this.h.mats || []) { for (const k of ['map']) if (m[k] && m[k].dispose) m[k].dispose(); const u = m.userData.tint; if (u) for (const t of [u.tMask, u.tSkin]) if (t && t.value && t.value.dispose) t.value.dispose(); }
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
export async function createRiders({ quality = 'medium', base } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  const stage = createStage({ canvas, container: globalThis.document.body, quality, dprCap: 1, transparent: true, shadows: false, lighting: 'day', fov: 10 });
  if (!stage.supported) return null;
  stage.setSky(null, null);
  const cam = stage.camera;
  cam.near = 1; cam.far = 80;
  const api = { stage, quality, ok: true, lost: false, fitted: { w: 0, h: 0 }, pool: new Map(), loading: new Map(), clock: 0, failures: 0, bad: new Set(), specs: new Map(), specLoading: new Set() };
  stage.onContextLost(() => { api.lost = true; });
  stage.onContextRestored(() => { api.lost = false; fitted.key = ''; });
  const renderer = stage.renderer;
  const up = new Vector3(0, 1, 0);
  const v = new Vector3(), v2 = new Vector3(), qy = new Quaternion();

  const LIGHT_TUNE = { day: { hemi: 0.62, keyI: 2.7, rimI: 1.6 }, evening: { hemi: 0.7, keyI: 2.4, rimI: 1.3 }, night: { hemi: 0.75, keyI: 1.9, rimI: 1.2 } };
  let curLight = '';
  const setLight = (name) => { const n = LIGHT_TUNE[name] ? name : 'day'; if (n === curLight) return; curLight = n; stage.setLighting(n, LIGHT_TUNE[n]); stage.setSky(null, null); };
  setLight('day');

  // near-orthographic camera that maps the metre rectangle `reg` (x0, y0, w, h; the sled origin / the spectator's feet at 0,0) onto the canvas
  function frameCamera(reg, devW, devH, camSet = CAM) {
    renderer.setPixelRatio(1); renderer.setSize(devW, devH, false);
    cam.aspect = devW / devH;
    const D = camSet.dist;
    cam.fov = 2 * Math.atan(reg.h / 2 / D) / D2R;
    const tgt = new Vector3(reg.x0 + reg.w / 2, reg.y0 + reg.h / 2, 0);
    cam.position.set(tgt.x + D * Math.sin(camSet.yaw) * Math.cos(camSet.pitch), tgt.y + D * Math.sin(camSet.pitch), tgt.z + D * Math.cos(camSet.yaw) * Math.cos(camSet.pitch));
    cam.lookAt(tgt);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    // shift the projection so the world origin lands exactly on its row / column of the picture (the sled's ground contact)
    const p = new Vector3(0, 0, 0).project(cam);
    const wantX = 2 * (0 - reg.x0) / reg.w - 1, wantY = 2 * (0 - reg.y0) / reg.h - 1;
    const e = cam.projectionMatrix.elements;
    e[8] -= (wantX - p.x); e[9] -= (wantY - p.y);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }
  const fitted = { key: '' };
  function render(reg, devW, devH, camSet) {
    const key = `${reg.x0},${reg.y0},${reg.w},${reg.h},${devW},${devH},${camSet ? camSet.yaw : ''}`;
    if (fitted.key !== key || renderer.domElement.width !== devW) { frameCamera(reg, devW, devH, camSet); fitted.key = key; }
    stage.render();
    return renderer.domElement;
  }

  // ---- creation (lazy, one person per racer name) ----
  async function make(who, o) {
    const fem = FEMALE.has(who);
    const look = LOOKS[who] || LOOKS.You;
    const jacket = o.jacket || '#2a8fd6';
    const human = await loadHuman({ character: fem ? 'athlete_f' : 'athlete_m', base, kit: { top: jacket, bottoms: '#27323f', socks: DARK }, skin: look.skin, hair: look.hair });
    dress(human);
    human.setKit({ top: jacket, bottoms: '#27323f', socks: DARK });
    const r = new Rider(human, who, { hat: o.hat || '#d33b2f', cushion: who === 'You' ? '#d6423a' : jacket });
    r.scarf = addScarf(human, stage.scene, '#d33b2f', '#ffd36a');
    stage.add(human); stage.scene.add(r.sled);
    r.fem = fem;
    human.root.visible = false; r.sled.visible = false; r.scarf.mesh.visible = false;
    return r;
  }
  function get(who, o) {
    let r = api.pool.get(who);
    if (r) return r;
    if (!api.loading.has(who) && !api.bad.has(who)) {
      const pr = make(who, o).then((rr) => {
        api.pool.set(who, rr); api.loading.delete(who);
        while (api.pool.size > MAX_POOL) {          // evict the person drawn longest ago
          let old = null; for (const [k, x] of api.pool) if (k !== who && (!old || x.used < old[1].used)) old = [k, x];
          if (!old) break; old[1].dispose(stage.scene); api.pool.delete(old[0]);
        }
      }).catch((e) => { api.loading.delete(who); api.bad.add(who); api.failures++; console.warn('3D rider failed to load', who, String((e && e.stack) || e)); });
      api.loading.set(who, pr);
    }
    return null;
  }

  const hideAll = () => {
    for (const x of api.pool.values()) { x.h.root.visible = false; x.sled.visible = false; x.scarf.mesh.visible = false; }
    for (const x of api.specs.values()) x.h.root.visible = false;
  };

  // ---- the pose of one rider from the 2D scene's numbers ----
  const grip = { curl: [[0.7, 0.8, 0.4], [1.0, 1.25, 0.8], [1.05, 1.3, 0.85], [1.1, 1.35, 0.9], [1.1, 1.35, 0.9]], spread: [0, 0, 0, 0, 0] };
  const easeIO = (x) => sstep(x);
  const HANDLE = { x: 0.04, y: 1.03, z: 0.13 };

  function pose(r, o, dt) {
    const S = r.s, h = r.h;
    const tuckT = clamp(o.tuckT ?? (o.tuck ? 1 : 0), 0, 1);
    const k = 1 - Math.exp(-dt / 0.07);
    S.tuck = dt > 0 ? lerp(S.tuck, tuckT, k) : tuckT;
    const tuck = sstep(S.tuck);
    const p = clamp(o.p ?? 1, 0, 1), push = clamp(o.push ?? 0, 0, 1);
    const sp = clamp((o.v ?? 0) / 9, 0, 1);
    // kicking (right) foot, character space: forward f, up u
    let kf, ku;
    if (p < 0.3) { const q = easeIO(p / 0.3); kf = lerp(0.2, -0.62, q); ku = 0; }
    else { const q = easeIO((p - 0.3) / 0.7); kf = lerp(-0.62, 0.22, q); ku = Math.sin(Math.PI * q) * 0.28 + 0.16 * q; }
    if (tuck > 0.5) { kf = lerp(kf, -0.12, 0.8); ku = lerp(ku, 0.12, 0.9); }   // both feet on the footplates when crouched
    if (S.t !== null && dt > 0) { const kk = 1 - Math.exp(-dt / 0.045); S.kf = lerp(S.kf, kf, kk); S.ku = lerp(S.ku, ku, kk); } else { S.kf = kf; S.ku = ku; }
    const lean = Math.sin(Math.PI * Math.min(1, push));
    const breath = Math.sin((o.t || 0) * 2.3) * 0.004 * (1 - tuck);
    const bob = (o.v > 0.5 ? Math.sin((o.t || 0) * 5.3) * 0.006 : 0);
    // pelvis (relative to the ground point between the feet: left, up, forward)
    const pelU = lerp(0.935, 0.7, tuck) - 0.035 * lean * (1 - tuck) + breath + bob - 0.02 * (1 - sstep(p)) * (1 - tuck);
    const pelF = lerp(0.0, 0.11, tuck) + 0.07 * lean * (1 - tuck) + 0.03 * (1 - tuck);
    const pelL = 0.06;
    const flex = lerp(22, 52, tuck) + 12 * lean * (1 - tuck);
    const headFlex = -flex * 0.62 + 4 + tuck * 10;
    const crouch = clamp((0.935 - pelU) / 0.25, 0, 1.2);
    const offs = {
      Pelvis: { flex: flex * 0.2, side: -3 }, Spine: { flex: flex * 0.28 }, Spine1: { flex: flex * 0.28 }, Spine2: { flex: flex * 0.24 },
      Neck: { flex: headFlex * 0.55 }, Head: { flex: headFlex * 0.45 },
      R_Thigh: { flex: 28 + 55 * crouch, abduct: 6 }, L_Thigh: { flex: 30 + 55 * crouch, abduct: 6 },
      R_Calf: { flex: 34 + 70 * crouch }, L_Calf: { flex: 38 + 70 * crouch },
      R_UpperArm: { flex: 30, abduct: 14 }, L_UpperArm: { flex: 30, abduct: 14 },
      R_Forearm: { flex: 40 }, L_Forearm: { flex: 40 },
    };
    // the whole rider stands on the footplates (x = rootX in sled space)
    const rootX = -0.5;
    h.root.position.set(rootX, 0, 0);
    h.root.rotation.y = r.yaw; h.facing = r.yaw;
    r.writePose(offs, [pelL, pelU - 0.895, pelF]);
    const toWorld = (l, u, f, out) => out.set(l, u, f).applyAxisAngle(up, r.yaw).add(h.root.position);
    const foot = (side, l, u, f) => {
      toWorld(l, u + h._ankleRest, f, v);
      qy.setFromAxisAngle(up, r.yaw);
      const fq = qy.clone().multiply(h._restQ[`${side}_Foot`]);
      h.setReachFoot(side, v, 1, fq);
    };
    // left foot on the left footplate, right foot kicking on the snow beside the runner
    foot('L', 0.2, 0.128, -0.02);
    if (tuck > 0.5) foot('R', -0.2, 0.128, S.kf);
    else foot('R', -0.3, S.ku, S.kf);
    // hands on the bar
    h.setReach('L', null); h.setReach('R', null);
    h.update(1 / 60);
    const sh = (side) => h.bones[`Bip01_${side}_UpperArm`].getWorldPosition(new Vector3());
    for (const side of ['L', 'R']) {
      const z = side === 'R' ? HANDLE.z : -HANDLE.z;
      const target = new Vector3(HANDLE.x, HANDLE.y - 0.02 * tuck, z);
      const s0 = sh(side);
      const pole = new Vector3((s0.x + target.x) / 2 - 0.35, (s0.y + target.y) / 2 - 0.05, (z > 0 ? 1 : -1) * 0.5);
      h.setReach(side, target, { weight: 1, pole });
      h.setFingers(side, grip);
    }
    h.update(0);
    S.t = o.t ?? 0;
  }

  // scarf ribbon in sled space from the neck bone
  function scarf(r, o) {
    const sc = r.scarf, pos = sc.geo.attributes.position, h = r.h;
    const neck = h.bones.Bip01_Neck.getWorldPosition(v);
    const sp = clamp((o.v ?? 0) / 9, 0, 1), len = 0.32 + sp * 0.5, t = o.t || 0;
    const root = new Vector3().copy(neck); root.x -= 0.07; root.y -= 0.01;
    for (let i = 0; i <= sc.N; i++) {
      const s = i / sc.N;
      const x = root.x - s * len;
      const y = root.y - (1 - sp) * 0.5 * s * s * (0.9) + Math.sin(t * 9 - s * 6) * 0.04 * s * (0.4 + sp);
      const w = lerp(0.055, 0.03, s);
      const z = root.z + Math.sin(t * 7 - s * 5) * 0.012 * s;
      pos.setXYZ(i * 2, x, y + w, z); pos.setXYZ(i * 2 + 1, x, y - w, z);
    }
    pos.needsUpdate = true;
  }

  // ---- the public draw: ctx is in the rider's local frame (origin = ground contact, x forward, y down), o.s px per metre ----
  const cost = { ema: 0, n: 0, low: false };
  api.draw = function (ctx, o, u, custom) {
    if (api.lost || stage.contextLost) return false;
    const who = o.who || 'You';
    const r = get(who, o);
    api.clock++;
    if (!r) return !api.bad.has(who);      // loading: nothing yet (the 2D rider returns when loading fails)
    const t0 = globalThis.performance.now();
    r.used = api.clock;
    const m = ctx.getTransform();
    const ppu = Math.hypot(m.a, m.b);
    const reg = (custom && custom.region) || REGION;
    const devW = clamp(Math.round(reg.w * u * ppu), 96, (custom && custom.maxW) || 1000), devH = Math.round(devW * reg.h / reg.w);
    setLight(o.light || 'day');
    // colours follow the racer (jacket, hat)
    if (o.jacket && r.jacket !== o.jacket) { r.jacket = o.jacket; r.h.setKit({ top: o.jacket }); }
    if (o.hat && r.hatHex !== o.hat) { r.hatHex = o.hat; r.hat.knit.color.set(o.hat); }
    hideAll();
    r.h.root.visible = true; r.sled.visible = true; r.scarf.mesh.visible = true;
    let dt = r.s.t === null ? 0 : (o.t || 0) - r.s.t;
    if (!(dt >= 0 && dt < 0.25)) dt = 0;
    pose(r, o, dt);
    scarf(r, o);
    const cvs = render(reg, devW, devH, custom && custom.cam);
    ctx.drawImage(cvs, reg.x0 * u, -(reg.y0 + reg.h) * u, reg.w * u, reg.h * u);
    const ms = globalThis.performance.now() - t0;
    cost.ema = cost.n ? cost.ema * 0.95 + ms * 0.05 : ms; cost.n++;
    if (!cost.low && cost.n > 120 && cost.ema > 6 && api.quality !== 'low') { cost.low = true; api.quality = 'low'; stage.setQuality('low'); }
    void v2;
    return true;
  };

  // ---- spectators: two people (a man and a woman) re-coloured and re-posed per call, so a crowd of twelve is twelve small renders ----
  const SPEC_REGION = { x0: -0.9, y0: -0.05, w: 1.8, h: 2.35 };
  const SPEC_CAM = { dist: 16, yaw: -16 * D2R, pitch: 4 * D2R };
  function spec(fem) {
    const key = fem ? 'f' : 'm';
    let r = api.specs.get(key);
    if (r) return r;
    if (!api.specLoading.has(key) && !api.bad.has('spec' + key)) {
      api.specLoading.add(key);
      loadHuman({ character: fem ? 'athlete_f' : 'athlete_m', base, kit: { top: '#d6423a', bottoms: '#27323f', socks: DARK }, skin: fem ? 'light' : 'tan', hair: fem ? 'brown' : 'black' })
        .then((human) => {
          dress(human);
          const rr = new Rider(human, 'spec' + key, { hat: '#d33b2f', noSled: true });
          stage.add(human); human.root.visible = false;
          api.specs.set(key, rr); api.specLoading.delete(key);
        }).catch((e) => { api.specLoading.delete(key); api.bad.add('spec' + key); console.warn('3D spectator failed to load', String((e && e.stack) || e)); });
    }
    return null;
  }
  // o: { s px per metre, k variety index, t seconds, coat, hat, skin, hair, fem, wave }; ctx origin is the spectator's feet
  api.drawSpectator = function (ctx, o) {
    if (api.lost || stage.contextLost) return false;
    const r = spec(!!o.fem);
    if (!r) return !api.bad.has('spec' + (o.fem ? 'f' : 'm'));
    const m = ctx.getTransform(), u = o.s, ppu = Math.hypot(m.a, m.b);
    const devW = clamp(Math.round(SPEC_REGION.w * u * ppu), 48, 480), devH = Math.round(devW * SPEC_REGION.h / SPEC_REGION.w);
    hideAll();
    const h = r.h;
    h.setKit({ top: o.coat, bottoms: o.trousers || '#2c3947' });
    if (r.hatHex !== o.hat) { r.hatHex = o.hat; r.hat.knit.color.set(o.hat); }
    if (o.skin && r.skin !== o.skin) { r.skin = o.skin; h.setSkin(o.skin); }
    if (o.hair && r.hair !== o.hair) { r.hair = o.hair; h.setHair(o.hair); }
    h.root.visible = true;
    const t = o.t || 0, wv = Math.sin(t * 5.2 + o.k * 2.3), bob = Math.abs(Math.sin(t * 3.4 + o.k * 1.7));
    h.root.position.set(0, 0, 0);
    r.yaw = (o.dir > 0 ? Math.PI / 2 : -Math.PI / 2) - 0.2;
    h.root.rotation.y = r.yaw; h.facing = r.yaw;
    const hop = bob * 0.05;
    r.writePose({
      Pelvis: { flex: 4 }, Spine: { flex: -2 + (o.wave ? 3 * wv : 0), side: o.wave ? -4 : 0 }, Neck: { flex: -4 }, Head: { flex: -2 },
      L_Thigh: { flex: 6 + hop * 120, abduct: 3 }, R_Thigh: { flex: 6 + hop * 120, abduct: 3 }, L_Calf: { flex: 8 + hop * 200 }, R_Calf: { flex: 8 + hop * 200 },
      L_UpperArm: { flex: 10, abduct: 12 }, L_Forearm: { flex: 38 }, R_UpperArm: { flex: 10, abduct: 12 }, R_Forearm: { flex: 38 },
    }, [0, -hop * 0.5, 0]);
    h.setReachFoot('L', null); h.setReachFoot('R', null);
    h.setReach('L', null); h.setReach('R', null);
    h.update(1 / 60);
    if (o.wave) {
      const sx = new Vector3(0, 0, 0);
      const hand = new Vector3(0.0, 1.95 + 0.07 * wv, 0.18).applyAxisAngle(up, r.yaw).add(h.root.position);
      void sx;
      h.setReach('R', hand, { weight: 1, pole: new Vector3(0, 1.4, 0.6).applyAxisAngle(up, r.yaw) });
      h.setFingers('R', 'open');
    }
    h.update(0);
    const cvs = render(SPEC_REGION, devW, devH, SPEC_CAM);
    ctx.drawImage(cvs, SPEC_REGION.x0 * u, -(SPEC_REGION.y0 + SPEC_REGION.h) * u, SPEC_REGION.w * u, SPEC_REGION.h * u);
    return true;
  };
  api.preload = (who, o = {}) => { get(who, o); spec(false); spec(true); };
  return api;
}

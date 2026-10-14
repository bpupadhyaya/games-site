// Castells in 3D: real people (platform/view3d athletes) standing on each other's shoulders, a pinya around the foot of the tower.
// Presentation only: src/view.js hands over the list of people (position, tilt, pose, strain, fade) that the 2D figures use; the simulation
// is never touched. The result is drawn into an off-screen WebGL canvas and composited by the 2D picture, so the square, the HUD, the pops and
// the ghosts stay 2D. No WebGL2 / a failed load / a lost context: view.js paints its improved 2D figures instead (?fig=2d forces them).
//
// Weight and strain: every casteller crouches a little under the load of the tier (base most), more when "weak", trembles in the wobble;
// the tower tilts with the sim's lean and each person leans back against it; hands are locked on the neighbours' shoulders; the pinya
// presses its raised hands on the base. A fall is a soft dissolve (people fade while they sag), never a clip through the ground.
import { createStage, loadHuman, Clip, CLIP_BONES, semanticRot, createCrowd3d, THREE } from '../vendor3d/index.js';
import { SKIN, HAIR, PLAZAS } from '../src/art.js';
import { createPlaza } from './plaza3d.js';

const { Vector3, Quaternion, Euler, Matrix4 } = THREE;
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const bi = (n) => CLIP_BONES.indexOf(`Bip01_${n}`);
const UP = new Vector3(0, 1, 0);

const FEMALE = new Set(['Marta', 'Núria', 'Laia', 'Mireia', 'Jana', 'Anna', 'Júlia', 'Clara', 'Carla', 'Berta', 'Neus', 'Queralt', 'Maria', 'Eva', 'Gemma', 'Sílvia', 'Mia', 'Aina', 'Noa', 'Ona', 'Abril']);
const LIGHT = ['evening', 'day', 'night', 'evening'];
const LIGHT_TUNE = { day: { hemi: 0.62, keyI: 2.4, rimI: 1.2 }, evening: { hemi: 0.7, keyI: 2.2, rimI: 1.0 }, night: { hemi: 0.75, keyI: 1.7, rimI: 1.1 } };
const TROUSERS = '#f3f0e6', SHOES = '#e8e1cf', FAIXA = '#15141a';

// one person: a Human, a one-frame pose clip rewritten every frame, a faixa (black sash) and a helmet for the children
class Casteller {
  constructor(human, char, folk = false) {
    this.h = human; this.char = char; this.key = null; this.lookKey = ''; this.idle = 0;
    this.clip = new Clip({ name: 'pose', frames: 1, dur: 1 / 30, fps: 30, loop: true, quats: new Float32Array(CLIP_BONES.length * 4), pelvis: new Float32Array(3), grounded: false, fingers: 'relaxed' });
    human.addClip(this.clip);
    human.groundClamp = 'off'; human.footPlanting = false; human.cheapLight = false;
    this.restQ = new Float32Array(human.restPose.q);
    this.e = new Euler(); this.qa = new Quaternion(); this.qb = new Quaternion();
    this.ph = human.pelvisHeight;
    human.play(this.clip, { fade: 0 });
    human.root.visible = false;
    this.extra = [];
    this.folk = !!folk;
    this.faixa = makeFaixa(human, char === 'athlete_f' ? 0.92 : 1, this.extra, this.folk ? '#b3231f' : FAIXA);
    this.helmet = this.folk ? { visible: false, userData: { band: { color: new THREE.Color() } } } : makeHelmet(human, this.extra);
    this.cap = this.folk ? makeBarretina(human, this.extra) : null;
    this.mocador = makeMocador(human, this.extra, this.folk ? '#2f6a9a' : '#c4553a');
    this.fingerKey = '';
    this.mats = [];
    human.root.traverse((o) => { if (o.isMesh && o.material) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (!this.mats.includes(m)) this.mats.push(m); });
    this.alpha = 1;
    this.head = human.bones.Bip01_Head;
    this.kidHead = false;
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
  setAlpha(a) {
    if (Math.abs(a - this.alpha) < 0.004) return;
    this.alpha = a;
    const solid = a > 0.995;
    for (const m of this.mats) { m.transparent = !solid; m.opacity = a; m.depthWrite = solid; }
  }
}

// the faixa: the black sash every casteller winds round the waist, parented to the spine so it follows every pose
function makeFaixa(human, k, extra, color = FAIXA) {
  human._applyRest(); human.root.updateMatrixWorld(true);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, side: THREE.DoubleSide });
  const wp = (n) => human.bones[`Bip01_${n}`].getWorldPosition(new Vector3());
  const pel = wp('Pelvis'), sp = wp('Spine');
  const y = lerp(pel.y, sp.y, 0.5) + 0.03;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.13, 32, 1, true), mat);
  band.scale.set(0.178 * k, 1, 0.128 * k);
  const fold = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 32), mat);
  fold.rotation.x = Math.PI / 2; fold.scale.set(0.18 * k, 0.13 * k, 1); fold.position.y = 0.062;
  const g = new THREE.Group(); g.add(band); g.add(fold);
  const b = human.bones.Bip01_Spine;
  const inv = b.getWorldQuaternion(new Quaternion()).invert();
  g.quaternion.copy(inv);
  g.position.copy(new Vector3(pel.x, y, pel.z).sub(b.getWorldPosition(new Vector3())).applyQuaternion(inv));
  b.add(g);
  extra.push(mat);
  return g;
}

// the children's white helmet (a crash hat with a coloured band) on the head bone
function makeHelmet(human, extra) {
  human._applyRest(); human.root.updateMatrixWorld(true);
  const mat = new THREE.MeshStandardMaterial({ color: '#f4f2ec', roughness: 0.45, metalness: 0.0 });
  const band = new THREE.MeshStandardMaterial({ color: '#2e9a5f', roughness: 0.5, metalness: 0 });
  const g = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), mat);
  dome.scale.set(1.02, 0.98, 1.1);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.122, 0.011, 8, 28), band);
  rim.rotation.x = Math.PI / 2; rim.scale.set(1.04, 1.12, 1); rim.position.y = 0.008;
  const strapL = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6), mat); strapL.position.set(0.11, -0.055, 0.02); strapL.rotation.z = -0.15;
  const strapR = strapL.clone(); strapR.position.x = -0.11; strapR.rotation.z = 0.15;
  g.add(dome, rim, strapL, strapR);
  const head = human.bones.Bip01_Head;
  const hp = head.getWorldPosition(new Vector3());
  const top = human.bones.Bip01_Neck ? human.bones.Bip01_Neck.getWorldPosition(new Vector3()) : hp;
  void top;
  const inv = head.getWorldQuaternion(new Quaternion()).invert();
  g.quaternion.copy(inv);
  g.position.copy(new Vector3(hp.x, hp.y + 0.115, hp.z + 0.012).sub(hp).applyQuaternion(inv));
  head.add(g);
  g.visible = false;
  g.userData.band = band;
  extra.push(mat, band);
  return g;
}

// the neckerchief (mocador): a collar band with a small knot, parented to the neck bone
function makeMocador(human, extra, color = '#c4553a') {
  human._applyRest(); human.root.updateMatrixWorld(true);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, side: THREE.DoubleSide });
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.078, 0.05, 18, 1, true), mat);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), mat); knot.position.set(0, -0.012, 0.074);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.038, 0.1, 4), mat); tail.position.set(0, -0.075, 0.07); tail.scale.set(1, 1, 0.3);
  g.add(band, knot, tail);
  const neck = human.bones.Bip01_Neck || human.bones.Bip01_Head;
  const np = neck.getWorldPosition(new Vector3());
  const inv = neck.getWorldQuaternion(new Quaternion()).invert();
  g.quaternion.copy(inv);
  g.position.copy(new Vector3(np.x, np.y + 0.035, np.z + 0.002).sub(np).applyQuaternion(inv));
  neck.add(g);
  extra.push(mat);
  return { g, mat };
}
// the barretina: the red Catalan cap, a soft bag that falls to one side, with a dark band
function makeBarretina(human, extra) {
  human._applyRest(); human.root.updateMatrixWorld(true);
  const mat = new THREE.MeshStandardMaterial({ color: '#b3231f', roughness: 0.7, metalness: 0 });
  const bandM = new THREE.MeshStandardMaterial({ color: '#2a1820', roughness: 0.8, metalness: 0 });
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.123, 0.07, 22), bandM);
  const bag = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 12), mat); bag.scale.set(0.95, 1.7, 1.15); bag.position.set(0.0, 0.09, -0.01); bag.rotation.z = 0.0;
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), mat); tail.scale.set(0.8, 1.5, 0.9); tail.position.set(0.085, 0.14, -0.03); tail.rotation.z = -0.5;
  bag.position.y = 0.12; bag.scale.set(0.9, 1.0, 1.1);
  g.add(band, bag, tail);
  const head = human.bones.Bip01_Head;
  const hp = head.getWorldPosition(new Vector3());
  const inv = head.getWorldQuaternion(new Quaternion()).invert();
  g.quaternion.copy(inv);
  g.position.copy(new Vector3(hp.x, hp.y + 0.1, hp.z + 0.006).sub(hp).applyQuaternion(inv));
  head.add(g);
  extra.push(mat, bandM);
  return g;
}
// a gralla (Catalan shawm): a dark conical wooden body with brass rings, a flaring bell and a reed
function makeGralla() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#2e1a10', roughness: 0.5, metalness: 0.0 });
  const brass = new THREE.MeshStandardMaterial({ color: '#c9a24a', roughness: 0.35, metalness: 0.8 });
  const prof = [[0.012, 0], [0.017, 0.12], [0.026, 0.3], [0.034, 0.5], [0.065, 0.58], [0.09, 0.62]];
  const pts = prof.map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), wood); body.material.side = THREE.DoubleSide;
  const ring = (y, r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.018, 12), brass); m.position.y = y; return m; };
  const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.07, 6), brass); reed.position.y = -0.03;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 12), brass); disc.position.y = 0.0;
  g.add(body, ring(0.3, 0.029), ring(0.5, 0.037), ring(0.56, 0.058), reed, disc);
  return g;
}

// ---- sleeves: the athlete wears a tank top, a castellers' shirt has sleeves. Repainted ONCE per character (shared canvas copies). ----
const SLEEVES = {
  athlete_m: [[0, 490, 308, 800], [716, 490, 1024, 800]],
  athlete_f: [[62, 250, 436, 548], [586, 250, 960, 548]],
};
const shared = {};
function sleeveTextures(char, human) {
  if (shared[char]) return shared[char];
  const N = 1024;
  const m = human.mats.find((x) => x.userData.kind === 'body' && x.map && x.userData.tint);
  if (!m) return (shared[char] = null);
  const u = m.userData.tint;
  const cv = () => { const c = globalThis.document.createElement('canvas'); c.width = c.height = N; return c; };
  const read = (img) => { const c = cv(); const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, N, N); return { c, g, d: g.getImageData(0, 0, N, N) }; };
  const A = read(m.map.image), M = read(u.tMask.value.image), K = read(u.tSkin.value.image);
  const a = A.d.data, mk = M.d.data, sk = K.d.data;
  for (const [x0, y0, x1, y1] of SLEEVES[char]) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * N + x) * 4;
      // keep the soft light/dark of the old texels as cloth folds, on a light shirt grey
      const L = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
      const v = clamp(206 + (L - 150) * 0.35, 150, 240);
      a[i] = v; a[i + 1] = v; a[i + 2] = v; a[i + 3] = 255;
      mk[i] = 255; mk[i + 1] = 0; mk[i + 2] = 0; sk[i] = 0;
    }
  }
  A.g.putImageData(A.d, 0, 0); M.g.putImageData(M.d, 0, 0); K.g.putImageData(K.d, 0, 0);
  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; return t; };
  return (shared[char] = { map: tex(A.c, true), mask: tex(M.c, false), skin: tex(K.c, false) });
}
function dress(human, char) {
  const sh = sleeveTextures(char, human);
  if (!sh) return;
  for (const m of human.mats) {
    if (m.userData.kind !== 'body' || !m.userData.tint) continue;
    m.map = sh.map; m.userData.tint.tMask.value = sh.mask; m.userData.tint.tSkin.value = sh.skin; m.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
export async function createCastells3D({ quality = 'medium', poolSize = 30 } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  const stage = createStage({ canvas, container: globalThis.document.body, quality, dprCap: 1, transparent: true, shadows: false, lighting: 'evening', fov: 10 });
  if (!stage.supported) return null;
  stage.setSky(null, null);
  const renderer = stage.renderer, cam = stage.camera;
  cam.near = 1; cam.far = 220;
  // the placa: facades, town hall, bell tower, bunting, floor (view3d/plaza3d.js); visible only when the picture owns the whole square
  const plaza = createPlaza({ quality });
  stage.scene.add(plaza.root);
  stage.scene.add(cam); cam.add(plaza.camAttached);
  plaza.setVisible(false);
  let plazaIdx = -1, envOn = false, crowd = null;
  const buildCrowd = () => {
    try {
      crowd = createCrowd3d(stage, {
        free: { area: [-20, -5.6, 20, -2.4], y: 0, count: quality === 'low' ? 48 : 120, walkers: 0.06, walkDir: [1, 0, 0], walkLength: 6, face: [0, 1.7, 8] },
        count: quality === 'low' ? 48 : 120, seed: 29, culture: ['mediterranean', 'european_village'], quality: quality === 'low' ? 'low' : 'medium',
        props: { flag: 0.05, phone: 0.07, child: 0.06 }, flagColors: ['#c4553a', '#f2ead6', '#2f6fc0', '#dd9a22'], excitement: 0.25,
      });
    } catch (e) { console.warn('castells3d: spectators unavailable', e); crowd = null; }
  };
  buildCrowd();
  if (crowd && crowd.group) crowd.group.visible = false;

  const free = { athlete_m: [], athlete_f: [] };
  const all = [];
  let loading = 0, shoulderY = 1.46;
  const load = async (char) => {
    loading++;
    try {
      const h = await loadHuman({ character: char, lod: 1, kit: { top: '#ffffff', bottoms: TROUSERS, socks: TROUSERS, shoes: SHOES }, skin: SKIN[1], hair: 'black' });
      dress(h, char);
      const c = new Casteller(h, char);
      stage.add(h);
      if (char === 'athlete_m' && all.length === 0) shoulderY = h.bones.Bip01_L_UpperArm.getWorldPosition(new Vector3()).y;
      all.push(c); free[char].push(c);
    } catch (e) { console.warn('castells3d: could not load a person', e); }
    loading--;
  };
  // first batch before the first frame (so the tower is complete at once), the rest of the pool in the background
  const first = Math.min(12, poolSize);
  await Promise.all([...Array(first)].flatMap(() => [load('athlete_m'), load('athlete_f')]));
  if (!all.length) return null;
  (async () => { for (let i = first; i < poolSize; i++) { await load('athlete_m'); await load('athlete_f'); } })();

  // ---- the band: three gralla players and a drummer in folk dress (white shirt, black trousers, red faixa, barretina, neckerchief) ----
  const band = [];
  const loadBand = async () => {
    const parts = [{ x: 3.35, z: -0.55, yaw: -0.55, kind: 'gralla', seed: 1 }, { x: 4.05, z: -0.15, yaw: -0.7, kind: 'gralla', seed: 2 }, { x: 4.75, z: -0.6, yaw: -0.8, kind: 'gralla', seed: 3 }, { x: -3.7, z: -0.4, yaw: 0.65, kind: 'tabal', seed: 4 }];
    for (const pt of parts) {
      try {
        const h = await loadHuman({ character: 'athlete_m', lod: 1, kit: { top: '#fbfaf5', bottoms: '#17151a', socks: '#17151a', shoes: '#2a1f18' }, skin: SKIN[pt.seed % 3], hair: 'black' });
        dress(h, 'athlete_m');
        const c = new Casteller(h, 'athlete_m', true);
        c.part = pt; c.idleSeed = pt.seed * 1.7;
        const prop = pt.kind === 'gralla' ? makeGralla() : (() => {
          const gp = new THREE.Group();
          const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 24), new THREE.MeshStandardMaterial({ color: '#7a2a1c', roughness: 0.55 }));
          const skinM = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.02, 24), new THREE.MeshStandardMaterial({ color: '#f1e8d0', roughness: 0.6 }));
          skinM.position.y = 0.16; gp.add(shell, skinM); return gp;
        })();
        c.prop = prop;
        if (pt.kind === 'gralla') { prop.position.set(0, 1.5, 0.15); prop.rotation.x = 2.2; } else { prop.position.set(0, 0.98, 0.32); prop.rotation.x = 1.45; }
        h.root.add(prop);
        h.root.visible = false; prop.visible = false;
        stage.add(h);
        band.push(c);
      } catch (e) { console.warn('castells3d: band member failed', e); }
    }
  };
  loadBand();
  const LP = [
    { hemiSky: '#f6c9b2', hemiGround: '#5d4c52', hemi: 0.85, key: '#ffd8a4', keyI: 2.8, rim: '#a8bcff', rimI: 1.3, exp: 1.05 },
    { hemiSky: '#d2e8ff', hemiGround: '#8a8070', hemi: 0.95, key: '#fff0d2', keyI: 3.0, rim: '#ffffff', rimI: 0.9, exp: 1.05 },
    { hemiSky: '#7a84d4', hemiGround: '#2a2a44', hemi: 0.75, key: '#a9b8ff', keyI: 1.6, rim: '#ffb26a', rimI: 1.5, exp: 1.15 },
    { hemiSky: '#ffbfc8', hemiGround: '#5a4050', hemi: 0.85, key: '#ffcb94', keyI: 2.7, rim: '#c8a0ff', rimI: 1.3, exp: 1.05 },
  ];
  const applyLight = (i) => {
    const p = LP[i] || LP[0], L = stage.lights;
    L.hemi.color.set(p.hemiSky); L.hemi.groundColor.set(p.hemiGround); L.hemi.intensity = p.hemi;
    L.key.color.set(p.key); L.key.intensity = p.keyI; L.key.position.set(-7, 11, 13);
    L.rim.color.set(p.rim); L.rim.intensity = p.rimI;
    renderer.toneMappingExposure = p.exp;
    stage.scene.fog = null; stage.scene.background = null;
  };
  let lightKey = '';
  const used = new Map();           // key -> Casteller
  let lastT = null, lastFrame = 0;
  const cost = { ema: 0, n: 0, low: false };
  const api = { ok: true, pending: false, lost: false, quality, stage, all, free };
  stage.onContextLost(() => { api.lost = true; });
  stage.onContextRestored(() => { api.lost = false; });

  const root0 = new Vector3();
  const V = new Vector3(), V2 = new Vector3(), QY = new Quaternion(), QZ = new Quaternion(), QR = new Quaternion(), INV = new Matrix4();

  function acquire(key, it) {
    const hit = used.get(key);
    if (hit) { hit.group = it.group || ''; return hit; }
    const female = FEMALE.has(it.person.name);
    const want = female ? 'athlete_f' : 'athlete_m';
    const c = free[want].pop() || free[want === 'athlete_f' ? 'athlete_m' : 'athlete_f'].pop();
    if (!c) return null;
    c.key = key; c.lookKey = ''; c.idleSeed = hash(key.length * 7.3 + (it.person.id || 0));
    c.group = it.group || '';
    used.set(key, c);
    return c;
  }
  function release(c) { used.delete(c.key); c.key = null; c.h.root.visible = false; c.setAlpha(1); c.h.setReach('L', null); c.h.setReach('R', null); free[c.char].push(c); }

  function look(c, it, white) {
    const p = it.person, sh = it.o.shirt;
    const key = `${p.skin}.${p.hairCol}.${p.hair}.${sh.id}.${white ? 1 : 0}.${p.kid ? 1 : 0}`;
    if (c.lookKey === key) return;
    c.lookKey = key;
    c.h.setKit({ top: white ? '#fbfaf5' : sh.c, bottoms: TROUSERS, socks: TROUSERS, shoes: SHOES });
    c.h.setSkin(SKIN[p.skin % 5]);
    c.h.setHair(HAIR[p.hairCol % 6]);
    c.helmet.visible = !!p.kid;
    c.helmet.userData.band.color.set(sh.c);
    if (c.mocador) c.mocador.mat.color.set(white ? '#d8b24a' : sh.l || '#c4553a');
    // children: a child's head is larger against the body
    if (c.head) c.head.scale.setScalar(p.kid ? 1.16 : 1);
  }

  // ---- camera: near-orthographic, a little above and in front, anchored so the floor point under the tower lands on (cx, gy) ----
  const CAM = { dist: 30, yaw: 6 * D2R, pitch: 7 * D2R };
  let fitKey = '';
  function frame(devW, devH, rect, scene, pxM) {
    const key = `${devW}x${devH}|${rect.x},${rect.y},${rect.w},${rect.h}|${scene.cx},${scene.gy}|${pxM.toFixed(3)}`;
    if (renderer.domElement.width !== devW || renderer.domElement.height !== devH) renderer.setSize(devW, devH, false);
    if (fitKey === key) return;
    fitKey = key;
    cam.aspect = devW / devH;
    const hM = rect.h / pxM, D = CAM.dist;
    cam.fov = 2 * Math.atan(hM / 2 / D) / D2R;
    const cxM = (rect.x + rect.w / 2 - scene.cx) / pxM, cyM = (scene.gy - (rect.y + rect.h / 2)) / pxM;
    const tgt = new Vector3(cxM, cyM, 0);
    cam.position.set(tgt.x + D * Math.sin(CAM.yaw) * Math.cos(CAM.pitch), tgt.y + D * Math.sin(CAM.pitch), tgt.z + D * Math.cos(CAM.yaw) * Math.cos(CAM.pitch));
    cam.lookAt(tgt);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    const p = new Vector3(0, 0, 0).project(cam);
    const wantX = 2 * (scene.cx - rect.x) / rect.w - 1, wantY = 1 - 2 * (scene.gy - rect.y) / rect.h;
    const e = cam.projectionMatrix.elements;
    e[8] -= (wantX - p.x); e[9] -= (wantY - p.y);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }

  // ---- poses ---------------------------------------------------------------------------------------------------------------
  const FING = { grip: { curl: [[0.6, 0.7, 0.4], [0.9, 1.1, 0.7], [0.95, 1.15, 0.75], [1.0, 1.2, 0.8], [1.0, 1.2, 0.8]], spread: [0, 0, 0, 0, 0] } };

  // everything about one body for this frame, in character space (metres, scaled by the root)
  function solve(c, it, ctx) {
    const o = it.o, t = ctx.t, kind = it.kind;
    const strain = o.strain || 0, fall = it.fall || 0;
    const ph = o.ph || 0;
    const tremble = strain > 0 ? Math.sin(t * 36 + c.idleSeed * 20) * strain : 0;
    const breath = Math.sin(t * 1.9 + c.idleSeed * 9);
    const S = { crouch: 0.03, flex: 3, side: 0, twist: 0, head: 0, headSide: 0, pelL: 0, pelF: 0, feet: null, hands: null, fingers: 'relaxed', yaw: 0, roll: 0, z: 0, lift: 0, pose: o.pose, ph };
    const load = it.load === undefined ? 0.5 : it.load;
    const pose = o.pose || 'hold';
    if (kind === 'tier' || (kind === 'kid' && !it.wait && !it.climbing)) {
      S.crouch = 0.03 + 0.12 * load + 0.07 * strain + (pose === 'brace' ? 0.04 : 0) + 0.006 * breath + 0.012 * Math.abs(tremble);
      S.flex = 4 + 12 * load + 5 * strain; S.head = pose === 'brace' ? 8 : 0; S.headSide = tremble * 3;
      S.pelL = tremble * 0.01 + clamp(ctx.lean, -1, 1) * 0.015;
      S.yaw = (hash(it.person.id * 3.7) - 0.5) * 0.32;
      S.feet = { l: 0.165, f: 0.0, spread: 0.16 };
      if (pose === 'cheer') S.cheer = 1;
    } else if (kind === 'pinya') {
      const push = pose === 'push' ? 1 : 0;
      S.crouch = 0.07 + 0.05 * push + 0.01 * breath;
      S.flex = 6 + 10 * push; S.head = -6 - 4 * push;
      S.feet = { l: 0.2, f: 0.14, spread: 0.2, stagger: true };
    } else if (it.wait) {
      S.crouch = 0.03 + 0.006 * breath; S.flex = 2; S.head = -4;
      S.feet = { l: 0.13, f: 0.0, spread: 0.13 };
    } else {                      // climbing
      S.crouch = 0.1; S.flex = 14; S.head = -8;
      S.feet = { l: 0.14, f: 0.0, spread: 0.14 };
    }
    // falling: knees buckle, arms fly out; the fade does the rest
    if (fall > 0) {
      const f = sstep(fall);
      S.crouch += 0.16 * f; S.flex += 20 * f; S.head -= 18 * f; S.side += 0; S.fallArms = f;
    }
    return S;
  }

  function offsets(c, S) {
    const o = {};
    const th = Math.acos(clamp(1 - S.crouch / 0.9, 0.5, 1)) / D2R;
    const fl = S.flex;
    o.Pelvis = { flex: fl * 0.2, side: S.side * 0.2, twist: S.twist * 0.15 };
    o.Spine = { flex: fl * 0.27, side: S.side * 0.3, twist: S.twist * 0.3 };
    o.Spine1 = { flex: fl * 0.27, side: S.side * 0.3, twist: S.twist * 0.3 };
    o.Spine2 = { flex: fl * 0.26, side: S.side * 0.2, twist: S.twist * 0.25 };
    o.Neck = { flex: -fl * 0.4 + S.head * 0.5, side: S.headSide * 0.5 };
    o.Head = { flex: -fl * 0.35 + S.head * 0.5, side: S.headSide * 0.5 };
    o.R_Thigh = { flex: th, abduct: 6 }; o.L_Thigh = { flex: th, abduct: 6 };
    o.R_Calf = { flex: th * 1.9 }; o.L_Calf = { flex: th * 1.9 };
    return o;
  }

  // draws everything; returns false when the 3D picture cannot be shown
  api.draw = function (ctx, scene) {
    if (api.lost || stage.contextLost) return false;
    const t0 = globalThis.performance.now();
    const { items, cam: cc, rect } = scene;
    const m = ctx.getTransform();
    const pxPerUnit = Math.hypot(m.a, m.b);
    let sc = Math.min(pxPerUnit, 1100 / rect.w, Math.sqrt(1.15e6 / (rect.w * rect.h)));
    if (api.quality === 'low') sc = Math.min(sc, 0.8e3 / rect.w, Math.sqrt(0.7e6 / (rect.w * rect.h)));
    const devW = Math.max(120, Math.round(rect.w * sc)), devH = Math.max(120, Math.round(rect.h * sc));
    const pxM = 0.82 * cc.s / shoulderY;                   // design px per metre: one tier = one shoulder height
    const t = scene.t;
    const dt = lastT === null ? 0 : clamp(t - lastT, 0, 0.1); lastT = t;
    frame(devW, devH, rect, { cx: cc.cx, gy: cc.gy }, pxM);
    const env = !!scene.env;
    if (env !== envOn) { envOn = env; plaza.setVisible(env); if (crowd) crowd.group.visible = env; }
    if (env) api.plazaNow = clamp(scene.plaza | 0, 0, 3);
    const pIdx = api.plazaNow || 0;
    if (String(pIdx) !== lightKey) {
      lightKey = String(pIdx);
      stage.setLighting(LIGHT[pIdx] || 'evening', LIGHT_TUNE[LIGHT[pIdx] || 'evening']); stage.setSky(null, null);
      applyLight(pIdx);
    }
    if (env && plazaIdx !== pIdx) { plazaIdx = pIdx; plaza.setPlaza(pIdx, PLAZAS[pIdx] || PLAZAS[0]); }
    if (env) {
      plaza.update(dt, scene.t);
      if (crowd) { crowd.setExcitement(clamp(0.2 + 0.7 * Math.abs(scene.lean || 0) + (scene.cheer ? 0.4 : 0), 0, 1)); crowd.update(dt); if (scene.cheer && !cost.cheered) { crowd.react('cheer', { intensity: 1 }); cost.cheered = true; } if (!scene.cheer) cost.cheered = false; if (scene.falling && !cost.fell) { crowd.react('gasp', { intensity: 1 }); cost.fell = true; } if (!scene.falling) cost.fell = false; }
    }
    let blobN = 0;
    const bridge = scene.M, T = scene.T, group = scene.group || 'play';
    for (const it of items) it.group = group;
    // pass 0: who is on stage this frame; crouch of each column (the tier above stands lower by it)
    const frameEntries = [];
    const grid = new Map();
    const crouchAt = new Map();           // "k" -> mean crouch of the tier
    const seen = new Set();
    for (const it of items) {
      const c = acquire(it.key, it);
      if (!c) continue;
      seen.add(it.key);
      const white = it.kind === 'pinya' && hash(it.i * 4.7 + 1.3) < 0.55;
      look(c, it, white);
      if (it.kind === 'tier') it.load = clamp(1 - it.k / Math.max(1, T - 1), 0, 1);
      if (it.kind === 'kid' && it.k !== undefined) it.load = 0.1;
      const S = solve(c, it, { t, lean: scene.lean });
      frameEntries.push({ it, c, S });
      if (it.k !== undefined) { grid.set(`${it.k}:${it.j}`, frameEntries[frameEntries.length - 1]); }
    }
    // crouch totals per tier (mean over its people) -> drop of the tiers above
    const tierSum = {};
    for (const e of frameEntries) if (e.it.k !== undefined && !e.it.climbing && !e.it.wait) { const k = e.it.k; (tierSum[k] = tierSum[k] || { s: 0, n: 0 }); tierSum[k].s += e.S.crouch * (e.it.person.kid ? 0.72 : 1); tierSum[k].n++; }
    const drop = (k) => { let d = 0; for (let i = 0; i < k; i++) if (tierSum[i]) d += tierSum[i].s / tierSum[i].n; return d; };
    const nowMs = globalThis.performance.now();
    for (const key of seen) used.get(key).seenAt = nowMs;
    for (const [key, c] of [...used]) if (!seen.has(key) && ((c.group === group) || nowMs - (c.seenAt || 0) > 500)) release(c);

    for (const [key, c] of used) if (!seen.has(key)) c.h.root.visible = false;     // other lists of the same frame (menu art, attract) are not part of this picture
    // pass 1: root transforms (needed before the hands look for their neighbours' shoulders)
    const pinyaLayout = (it) => {
      const half = (cc.N * cc.colW) / 2 / pxM, rx = half + 0.62, rz = 0.78;
      const nf = Math.min(it.count, Math.max(4, Math.round(2 * rx / 0.5)));
      if (it.i < nf) {                       // front arc, faces the tower
        const x = -rx + (it.i + 0.5) * (2 * rx / nf);
        const z = 0.34 + rz * Math.sqrt(Math.max(0, 1 - (x / rx) * (x / rx))) * 0.78;
        return { x, z };
      }
      const k = it.i - nf, nb = Math.max(1, it.count - nf);
      const x = (-0.85 + 1.7 * ((k + 0.5) / nb)) * rx;
      return { x, z: -0.42 - 0.2 * hash(it.i * 3.3) };
    };
    for (const e of frameEntries) {
      const { it, c, S } = e, h = c.h, root = h.root, o = it.o;
      let X = (it.x - cc.cx) / pxM, Y = (cc.gy - it.y) / pxM, Z = 0, yaw = S.yaw, kidScale = 1;
            let alpha = o.alpha == null ? 1 : o.alpha;
      if (it.kind === 'pinya') {
        const pl = pinyaLayout(it);
        // ring position, plus the sim's wobble of the crowd (the 2D list carries it as a pixel offset)
        X = pl.x + (it.wob || 0) / pxM; Z = pl.z; Y = 0;
        yaw = Math.atan2(-X, -(Z - 0.05)) + (hash(it.i * 9.1) - 0.5) * 0.35;
        alpha = 1;
      } else {
        if (it.kind === 'kid' && !it.wait) {
          // children are smaller than the tiers below: stack them by their own shoulder height instead of the adults' tier pitch
          const lv = it.up !== undefined ? it.up : it.k;
          const kidSh = shoulderY * 0.73;
          const Hm = lv <= T ? lv * shoulderY : T * shoulderY + Math.min(lv - T, 1) * kidSh + clamp(lv - T - 1, 0, 1) * kidSh * 0.95;
          Y += Hm - lv * shoulderY;
        }
        Y -= it.k !== undefined && !it.climbing && !it.wait ? drop(it.k) : 0;
        if (it.kind === 'tier') { Z = (it.n > 2 ? -0.06 * (1 - Math.pow((it.j / (it.n - 1)) * 2 - 1, 2)) : 0); }
        if (it.wait) { Z = 1.05 + 0.1 * hash((it.person.id || 0) * 2.9); yaw = -0.25 + 0.5 * hash((it.person.id || 0) * 1.7); }
        if (it.kind === 'kid' && it.climbing) {
          // up the back of the tower on its side, a hand-width in front of the people
          const sd = it.side || (it.role === 0 ? -1 : 1);
          Z = 0.34; yaw = Math.PI - sd * 0.5;
          S.facingTower = true;
        }
        if (it.kind === 'kid' && !it.wait && !it.climbing) {
          // at the crown the children turn to the square
          yaw = (it.role === 3 ? 0 : (it.role === 2 ? 0.1 : (it.role === 0 ? 0.35 : -0.35)));
          if (it.role === 0 || it.role === 1) yaw = (it.role === 0 ? 0.3 : -0.3);
        }
        // dissolve: fade with the fall
        alpha *= 1 - sstep(((it.fall || 0) - 0.25) / 0.65);
        kidScale = 1;
      }
      // quality tiers: the pinya (small, partly hidden) drops to the one-draw-call light mesh on weak devices; the tower keeps the medium mesh
      const wantLod = api.quality === 'low' && it.kind === 'pinya' ? 2 : 1;
      if (c.lodNow !== wantLod && h.lodSets && h.lodSets.ready) { try { h.setLOD(wantLod); c.lodNow = wantLod; } catch (e) { c.lodNow = wantLod; } }
      const base = it.person.kid ? it.person.h : 1 + (it.person.h - 1) * 0.35;
      const sca = base * kidScale;
      root.scale.setScalar(sca);
      root.position.set(X, Y, Z);
      const rollA = -clamp(o.rot || 0, -0.75, 0.75);
      QY.setFromAxisAngle(UP, yaw); QZ.setFromAxisAngle(new Vector3(0, 0, 1), it.kind === 'pinya' ? 0 : rollA);
      root.quaternion.copy(QZ).multiply(QY);
      root.visible = alpha > 0.015;
      c.setAlpha(alpha);
      S.roll = rollA; S.alpha = alpha; S.X = X; S.Y = Y; S.Z = Z; S.sca = sca;
      // lean back against the tilt of the tower: the head stays over the feet (half of the tilt)
      S.side = -rollA / D2R * 0.45 * (it.kind === 'pinya' ? 0 : 1);
      // soft contact shadow on the flagstones under everyone who stands on the floor
      if (env && Y < 0.5 && alpha > 0.05) {
        const b = plaza.blob(blobN++); b.visible = true;
        b.position.set(X, 0.015, Z + 0.02); const r = (it.kind === 'pinya' ? 0.95 : 0.8) * sca * (it.person.kid ? 0.8 : 1);
        b.scale.set(r * 1.25, 1, r); b.material.opacity = 0.5 * alpha;
      }
      // faixa and helmet are children of the bones: nothing to do
    }
    for (let i = blobN; i < plaza.blobs.length; i++) plaza.blobs[i].visible = false;
    // the tower's long shadow across the square, away from the low evening light
    if (env && T) {
      const tall = (scene.M || 7) * shoulderY * 0.8, sh = plaza.shadowTower;
      sh.visible = true;
      sh.position.set((scene.shadowX || 0) + tall * 0.18, 0.012, -0.5 - tall * 0.12);
      sh.scale.set(tall * 0.42, 1, tall * 0.2); sh.rotation.y = 0.35;
    } else plaza.shadowTower.visible = false;
    // the band
    for (const c of band) {
      const show = env && !!c.part;
      c.h.root.visible = show; if (c.prop) c.prop.visible = show;
      if (!show) continue;
      const pt = c.part, tt = scene.t;
      const bx = (scene.bandX || 0) + (pt.x > 0 ? pt.x : pt.x), by = 0, bz = pt.z;
      const sway = Math.sin(tt * 1.3 + c.idleSeed) * 0.012, breath = Math.sin(tt * 1.7 + c.idleSeed * 3);
      c.h.root.position.set(bx, by, bz);
      QY.setFromAxisAngle(UP, pt.yaw + Math.sin(tt * 0.5 + c.idleSeed) * 0.06);
      c.h.root.quaternion.copy(QY);
      c.h.root.scale.setScalar(pt.seed === 2 ? 0.97 : 1.0);
      c.setAlpha(1);
      c.h.root.updateMatrixWorld(true);
      const offs = { Spine: { flex: -3 + breath * 0.8 }, Spine1: { flex: -3 }, Neck: { flex: -10 }, Head: { flex: -8 }, R_Thigh: { flex: 4 }, L_Thigh: { flex: 4 }, R_Calf: { flex: 8 }, L_Calf: { flex: 8 } };
      c.writePose(offs, [sway, -0.045 + breath * 0.004, 0]);
      for (const side of ['L', 'R']) {
        root0.set(0, 0, 0);
        const sx = side === 'L' ? 0.14 : -0.14;
        c.h.root.localToWorld(V.set(sx, c.h._ankleRest, 0.0));
        const fq = new Quaternion().copy(c.h.root.quaternion).multiply(c.h._restQ[`${side}_Foot`]);
        c.h.setReachFoot(side, V, 1, fq);
      }
      if (pt.kind === 'gralla') {
        const bob = Math.sin(tt * 3.1 + c.idleSeed * 5) * 0.012;
        c.prop.position.set(0, 1.5 + bob, 0.15);
        const f = Math.sin(tt * 9 + c.idleSeed * 11);
        c.h.root.localToWorld(V.set(0.035, 1.40 + bob, 0.31)); c.h.setReach('R', V, { weight: 1 });
        c.h.root.localToWorld(V.set(-0.02, 1.29 + bob + f * 0.002, 0.45)); c.h.setReach('L', V, { weight: 1 });
      } else {
        const hit = Math.max(0, Math.sin(tt * 6.4 + c.idleSeed));
        c.h.root.localToWorld(V.set(-0.2, 1.0 + 0.02 + hit * 0.16, 0.34)); c.h.setReach('R', V, { weight: 1 });
        c.h.root.localToWorld(V.set(0.2, 1.0 + 0.02 + (1 - hit) * 0.1, 0.34)); c.h.setReach('L', V, { weight: 1 });
      }
      c.h.setFingers('L', 'grip' in FING ? FING.grip : 'relaxed'); c.h.setFingers('R', FING.grip);
      c.h.update(dt);
    }
    for (const e of frameEntries) e.c.h.root.updateMatrixWorld(true);

    // pass 2: poses, feet on the shoulders below, hands on the neighbours
    const lerpAt = (a, b, k) => a + (b - a) * k;
    const doFrame = api.quality === 'low' ? (lastFrame++ & 1) === 0 : true;
    for (const e of frameEntries) {
      const { it, c, S } = e, h = c.h, root = h.root, o = it.o;
      if (it.kind === 'pinya' && !doFrame && c.posed) continue;
      const sc2 = S.sca;
      const offs = offsets(c, S);
      const ph = o.ph || 0;
      const feet = { L: { x: S.feet.spread, y: 0, z: S.feet.f }, R: { x: -S.feet.spread, y: 0, z: S.feet.f } };
      const hands = { L: null, R: null };
      const pel = [S.pelL, -S.crouch, S.pelF];
      const kind = it.kind;
      if (kind === 'kid' && it.climbing) {
        // climbing: legs and arms alternate, the body leans into the people
        const a = Math.sin(ph * 2), b = Math.sin(ph * 2 + Math.PI);
        feet.L = { x: 0.13, y: Math.max(0, a) * 0.3, z: 0.12 * Math.max(0, a) };
        feet.R = { x: -0.13, y: Math.max(0, b) * 0.3, z: 0.12 * Math.max(0, b) };
        hands.L = [0.2, 1.35 + 0.22 * Math.max(0, b), 0.36];
        hands.R = [-0.2, 1.35 + 0.22 * Math.max(0, a), 0.36];
        offs.Spine = { flex: 10 }; offs.Spine1 = { flex: 8 };
        S.fingers = 'fist';
      } else if (kind === 'pinya') {
        const push = o.pose === 'push';
        const lift = 0.1 * Math.sin(ph * 0.0 + c.idleSeed * 7 + o.t * 2.3);
        hands.L = [0.2, 1.38 + lift * 0.4, 0.44 + (push ? 0.1 : 0)];
        hands.R = [-0.2, 1.4 - lift * 0.4, 0.44 + (push ? 0.1 : 0)];
        if (hash(it.i * 2.1) < 0.4) { hands.L = [0.18, 1.72, 0.3]; }      // one hand reaches high: the crowd calls
        S.fingers = 'open';
        feet.L.z = 0.16; feet.R.z = -0.1;
      } else if (it.wait) {
        hands.L = [0.24, 0.84, 0.08]; hands.R = [-0.24, 0.84, 0.08];
      } else if (S.cheer || (kind === 'kid' && o.pose === 'cheer')) {
        // the enxaneta's aleta: one arm straight up, the other braced on the acotxador
        const w = Math.sin(o.t * 9) * 0.05;
        hands.R = [-0.12 + w, 2.1, 0.08]; hands.L = [0.22, 1.0, 0.12];
        S.fingers = 'open';
      } else if (S.fallArms) {
        const f = S.fallArms;
        hands.L = [0.55, lerp(1.25, 1.9, f), 0.1]; hands.R = [-0.55, lerp(1.25, 1.8, f), 0.1];
        S.fingers = 'open';
      } else {
        // locked on the neighbours' shoulders (either side), the free hand on its own hip
        const nbL = grid.get(`${it.k}:${it.j + 1}`), nbR = grid.get(`${it.k}:${it.j - 1}`);
        const tgt = (nb, side) => {
          if (!nb || it.k === undefined) return null;
          const nr = nb.c.h.root;
          // which shoulder of the neighbour is closest: the one on my side
          V.set(root.position.x, 0, 0); nr.worldToLocal(V);
          const sx = V.x >= 0 ? 0.19 : -0.19;
          return nr.localToWorld(V2.set(sx, shoulderY + 0.04, 0.06)).clone();
        };
        // which of my hands goes to which neighbour: by the side in my own frame
        const place = (nb) => {
          if (!nb) return null;
          const p = tgt(nb); if (!p) return null;
          root.updateMatrixWorld(true);
          const loc = root.worldToLocal(p.clone());
          return { p, side: loc.x >= 0 ? 'L' : 'R' };
        };
        const a = place(nbL), b = place(nbR);
        for (const r of [a, b]) if (r) hands[r.side] = { world: r.p };
        if (!hands.L) hands.L = [0.24, 0.98, 0.12];
        if (!hands.R) hands.R = [-0.24, 0.98, 0.12];
        S.fingers = 'grip';
        if (it.person.kid) { S.fingers = 'grip'; }
      }
      c.writePose(offs, pel);
      // feet (ankle targets)
      const fq = new Quaternion();
      const rootQ = root.quaternion;
      for (const side of ['L', 'R']) {
        const f = feet[side];
        root.localToWorld(V.set(f.x, (f.y || 0) + h._ankleRest, f.z));
        const rq = h._restQ[`${side}_Foot`];
        fq.copy(rootQ).multiply(rq);
        h.setReachFoot(side, V, 1, fq);
      }
      for (const side of ['L', 'R']) {
        const hd = hands[side];
        if (!hd) { h.setReach(side, null); continue; }
        if (Array.isArray(hd)) root.localToWorld(V.set(hd[0], hd[1], hd[2]));
        else V.copy(hd.world);
        h.setReach(side, V, { weight: 1 });
        h.setFingers(side, S.fingers === 'grip' ? FING.grip : S.fingers);
      }
      h.update(it.kind === 'pinya' && !doFrame ? 0 : dt);
      c.posed = true;
    }
    api.dbg = { kinds: items.reduce((a, i) => { a[i.kind] = (a[i.kind] || 0) + 1; return a; }, {}), shown: frameEntries.length, pxM, fov: cam.fov, devW, devH, rect, shoulderY, pr: renderer.getPixelRatio(), cw: renderer.domElement.width, s: cc.s, gy: cc.gy };
    stage.render();
    ctx.drawImage(renderer.domElement, rect.x, rect.y, rect.w, rect.h);
    if (env) {          // a soft vignette keeps the eye on the tower and seats the picture under the HUD
      const vg = ctx.createRadialGradient(rect.x + rect.w / 2, rect.y + rect.h * 0.55, Math.min(rect.w, rect.h) * 0.35, rect.x + rect.w / 2, rect.y + rect.h * 0.55, Math.max(rect.w, rect.h) * 0.8);
      vg.addColorStop(0, 'rgba(10,8,24,0)'); vg.addColorStop(1, 'rgba(10,8,24,0.42)');
      ctx.fillStyle = vg; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    const ms = globalThis.performance.now() - t0;
    cost.ema = cost.n ? cost.ema * 0.95 + ms * 0.05 : ms; cost.n++;
    api.lastMs = cost.ema;
    if (!cost.low && cost.n > 120 && cost.ema > 14 && api.quality !== 'low') {
      cost.low = true; api.quality = 'low'; stage.setQuality('low');
      for (const c of all) if (c.h.lodSets && c.h.lodSets.ready) { /* tower stays medium; far pinya goes light below */ }
    }
    void bridge; void T; void lerpAt; void INV; void QR;
    return true;
  };
  return api;
}

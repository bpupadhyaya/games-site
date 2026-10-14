// Real 3D porters (presentation only: reads what the sim decided, never writes back).
//
// One factory builds a person (view3d athlete_m / athlete_f) dressed as a hill porter, with a woven doko on the back, the namlo
// (forehead strap) running from the basket rim round the brow, and the tokma (T-stick) in the near hand.
//
// FRAME ORDER (the "prop in hand" rule): 1) advance the human once (stage/mixers), 2) read the posed bones and aim the hands (IK reach),
// 3) advance by 0 s so the IK is applied, 4) ONLY THEN place the doko, the strap and the stick from the posed bones. Nothing is ever
// posed after the props were placed, so the grip point is on the hand bone by construction (see gripError()).
//
// LOCOMOTION: the walk cycle runs at (displayed ground speed / clip speed); displayed ground speed is the distance the figure's
// position really changed this frame (never the sim's flags). A stopped figure breathes (idle), a moving one cycles its legs at
// cadence = speed / stride, so the leg phase always matches the distance covered.
import { loadHuman, buildClip, THREE, board3d as B } from '../vendor3d/index.js';
import { LOADS } from '../src/porter.js';
import { weaveTexture, burlapTexture, stripeTexture, clamp, lerp, TAU, hash } from './art.js';

const { Vector3, Quaternion } = THREE;
const WALK_CLIP_SPEED = 1.4, WALK_CLIP_DUR = 1.0667;          // library 'walk': 1.4 m/s, one cycle in 1.0667 s (1.49 m of ground)
const GAIT_K = 1.1;    // measured: the library walk's stance foot moves back at 1.1 x (clip speed x scale); this makes planted feet stand still
export const STEP_M = 0.745;                                   // metres of ground per footfall of the library walk at scale 1
const _X = new Vector3(1, 0, 0), _Z = new Vector3(0, 0, 1), _Y = new Vector3(0, 1, 0), _v = new Vector3(), _t = new Vector3(), _b = new Vector3(), _up = new Vector3(0, 1, 0);

const mat = (c, rough = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0, ...extra });

// ---- goods -------------------------------------------------------------------------------------------------------------------
// Real sizes (m): rice sack 34 x 22 x 20 cm, orange 7 cm (x1.15), book 27 x 20 cm, slate 34 x 24 cm.
function goodMesh(kind, seed = 0) {
  const L = LOADS[kind] ?? LOADS.sacks, g = new THREE.Group(), r = (k) => hash(seed * 31 + k);
  const sack = (w, h, d, col, tie, tex) => {
    const m = new THREE.Mesh(B.roundedBox(w, h, d, Math.min(w, h, d) * 0.32, 4), mat(col, 0.95, tex ? { map: tex } : {}));
    m.castShadow = true; g.add(m);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.3, w * 0.3, 0.022, 14), mat(tie, 0.7));
    band.position.y = h * 0.42; g.add(band);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.1, w * 0.24, h * 0.26, 10), mat(col, 0.95, tex ? { map: tex } : {}));
    top.position.y = h * 0.5 + h * 0.08; g.add(top);
  };
  void L;
  if (kind === 'oranges') {
    const og = new THREE.SphereGeometry(0.04, 10, 8);
    for (let i = 0; i < 7; i++) {
      const o = new THREE.Mesh(og, mat(i % 3 ? '#f08a1c' : '#ffa832', 0.55)); o.castShadow = true;
      const a = i * 2.4, rr = i === 0 ? 0 : 0.062;
      o.position.set(Math.cos(a) * rr, (i === 0 ? 0.05 : 0) + (i > 4 ? 0.06 : 0), Math.sin(a) * rr); g.add(o);
    }
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), mat('#3f8a35', 0.7)); leaf.scale.set(1.8, 0.35, 1); leaf.position.set(0.02, 0.1, 0); g.add(leaf);
  } else if (kind === 'veg') {
    for (let i = 0; i < 6; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat(i % 2 ? '#8fcf5a' : '#58a83a', 0.75));
      l.scale.set(0.8, 1.15, 0.8); l.position.set(Math.cos(i * 1.1) * 0.07, 0.04 + (i % 3) * 0.05, Math.sin(i * 1.1) * 0.06); l.castShadow = true; g.add(l);
    }
    const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 10), mat('#2f6a22', 0.8)); tie.position.y = -0.02; g.add(tie);
  } else if (kind === 'books') {
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(B.roundedBox(0.27, 0.06, 0.2, 0.012, 3), mat(['#5d6b88', '#3a4260', '#7a5a3a'][i], 0.8));
      b.position.y = -0.06 + i * 0.062; b.rotation.y = (r(i) - 0.5) * 0.4; b.castShadow = true; g.add(b);
    }
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.22), mat('#d9b35a', 0.5)); band.position.y = 0.0; g.add(band);
  } else if (kind === 'slates') {
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.028, 0.24), mat(i % 2 ? '#7d8795' : '#566070', 0.8));
      s.position.y = -0.06 + i * 0.03; s.rotation.y = (r(i + 3) - 0.5) * 0.35; s.castShadow = true; g.add(s);
    }
  } else if (kind === 'blankets') {
    const m = new THREE.Mesh(B.roundedBox(0.36, 0.2, 0.28, 0.06, 4), mat('#ffffff', 0.95, { map: stripeTexture() })); m.castShadow = true; g.add(m);
  } else if (kind === 'salt') {
    sack(0.24, 0.32, 0.17, '#f1eee6', '#b0432f', burlapTexture('#ece7d8'));
  } else if (kind === 'millet') {
    sack(0.34, 0.24, 0.22, '#c99b4a', '#5a3a1a', burlapTexture('#c9a45a'));
  } else sack(0.34, 0.24, 0.22, '#e6d8b0', '#8a5a2b', burlapTexture('#e0cf9f'));
  return g;
}
// Slots in the doko's own frame: x = toward the porter's front, y = up the basket's axis, z = sideways (m)
const DS = 1.32;   // basket scale: ~0.94 m tall, 0.7 m across the mouth (photos: rim above the head)
const SLOTS = [].concat([[0.02, 0.68, -0.09], [0.02, 0.68, 0.09], [-0.07, 0.72, 0.0], [0.1, 0.72, 0.0], [0.0, 0.82, -0.07], [0.0, 0.84, 0.08], [-0.05, 0.92, 0.0], [0.07, 0.96, 0.0]]).map(([a, b, c]) => [a * DS, b * DS * 0.9, c * DS]);
export const SLOT_COUNT = SLOTS.length;
export const slotLocal = (i) => SLOTS[i % SLOTS.length];

// namlo lugs in the doko's frame: lower third of the wall that faces the porter's back, 40 degrees either side of centre
const LUGL = [0.055, 0.075, 0.125], LUG = LUGL.map((v) => v * DS);
// ---- the doko (woven basket): 60 cm tall, 53 cm across the mouth, 22 cm base -----------------------------------------------------
function strawTexture() {
  const cv = globalThis.document.createElement('canvas'); cv.width = 256; cv.height = 256; const g = cv.getContext('2d');
  g.fillStyle = '#a2835a'; g.fillRect(0, 0, 256, 256);   // dark gaps between strips
  const cols = ['#d6c095', '#cdb386', '#c4a87a', '#dcc79c', '#bfa273'];
  const W = 44;                                          // strip width: ~4 cm at repeat 2.2 round the basket
  for (let k = 0; k < 2; k++) for (let i = -8; i < 16; i++) for (let j = 0; j < 12; j++) {
    const over = (i + j + k) % 2 === 0; if (!over) continue;
    g.save(); g.translate(i * W, j * W); g.fillStyle = cols[(i * 7 + j * 3 + k * 5 + 99) % 5];
    g.beginPath(); if (k) { g.moveTo(0, W - 4); g.lineTo(W * 2 - 4, -4); g.lineTo(W * 2, 0); g.lineTo(4, W) } else { g.moveTo(0, 4); g.lineTo(W * 2 - 4, W * 2 + 0); g.lineTo(W * 2, W * 2 - 4); g.lineTo(4, 0) }
    g.fill(); g.restore();
  }
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(60,36,10,${Math.random() * 0.18})`; g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 5, 1); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2.2); t.anisotropy = 4; return t;
}
function makeDoko() {
  const g = new THREE.Group();
  const HT = 1.18;
  const prof = [[0.0001, 0], [0.11, 0], [0.135, 0.02], [0.17, 0.16], [0.215, 0.34], [0.255, 0.5], [0.268, 0.585], [0.258, 0.6]].map(([r, y]) => [r, y * HT]);
  const body = new THREE.Mesh(B.lathe(prof, 36), mat('#ffffff', 0.95, { map: strawTexture(), bumpMap: strawTexture(), bumpScale: 3.5, side: THREE.DoubleSide }));
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  const inner = new THREE.Mesh(B.lathe(prof.map(([r, y]) => [r * 0.93, y]), 24), mat('#6a4514', 0.95, { side: THREE.BackSide }));
  g.add(inner);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.262, 0.036, 10, 40), mat('#a0794a', 0.8, { bumpMap: weaveTexture(), bumpScale: 1.5 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.6 * HT; rim.castShadow = true; g.add(rim);
  const rim2 = new THREE.Mesh(new THREE.TorusGeometry(0.248, 0.012, 8, 40), mat('#5a3a14', 0.8)); rim2.rotation.x = Math.PI / 2; rim2.position.y = 0.585 * HT; g.add(rim2);
  // the two namlo lugs: twisted-cane loops on the back-facing wall, low (lower third). Local frame: x toward the porter, z sideways.
  for (const sgn of [-1, 1]) {
    const lg = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0085, 8, 16), mat('#3a2410', 0.7)); lg.position.set(LUGL[0], LUGL[1], LUGL[2] * sgn);
    lg.lookAt(LUGL[0] * 3, LUGL[1], LUGL[2] * 3 * sgn); lg.castShadow = true; g.add(lg);
  }
  // vertical stiffening canes up the wall
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, y0 = 0.02, y1 = 0.6 * HT; const cn = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, y1 - y0, 5), mat('#6a4210', 0.8)); const r0 = 0.14 + (0.26 - 0.14) * 0.5 + 0.004; cn.position.set(Math.cos(a) * r0, (y0 + y1) / 2, Math.sin(a) * r0); cn.rotation.z = Math.cos(a) * -0.19; cn.rotation.x = Math.sin(a) * 0.19; g.add(cn); }
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.02, 20), mat('#6a4414', 0.85)); bottom.position.y = 0.0; g.add(bottom);
  g.scale.setScalar(DS);
  return g;
}
// ---- tokma: 1 m shaft, 30 cm crossbar --------------------------------------------------------------------------------------------
function makeTokma() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.02, 1, 10), mat('#7a5628', 0.7)); shaft.castShadow = true;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.3, 10), mat('#8a6030', 0.65)); bar.castShadow = true;
  g.add(shaft, bar); g.userData = { shaft, bar };
  return g;
}
// ---- a swept tube through points (the namlo flap and its two ropes): positions rewritten every frame --------------------------------------
// Cross-section is an ellipse (rn across the normal, rb along the binormal): the flap is wide and thin, the rope round. Twisted rope and
// woven flap get their pattern from the UVs (u along the length, v around).
function twistTexture(base, dark, light) {
  if (!globalThis.document) return null;
  const c = globalThis.document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 64);
  for (let i = -4; i < 12; i++) {
    g.fillStyle = dark; g.beginPath(); g.moveTo(i * 8, 0); g.lineTo(i * 8 + 4, 0); g.lineTo(i * 8 + 36, 64); g.lineTo(i * 8 + 32, 64); g.fill();
    g.fillStyle = light; g.beginPath(); g.moveTo(i * 8 + 4, 0); g.lineTo(i * 8 + 6, 0); g.lineTo(i * 8 + 38, 64); g.lineTo(i * 8 + 36, 64); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function flapTexture(color) {
  if (!globalThis.document) return null;
  const c = globalThis.document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 128; i += 6) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(i, 0, 2, 64); }
  for (let j = 0; j < 64; j += 8) { g.fillStyle = 'rgba(255,230,170,0.16)'; g.fillRect(0, j, 128, 2); }
  g.fillStyle = 'rgba(255,214,140,0.85)'; g.fillRect(0, 6, 128, 4); g.fillRect(0, 54, 128, 4);   // woven edge bands
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const TSEG = 10;
function makeTube(n, map, { rn = 0.012, rb = 0.012, uRep = 12, ref = 'y', rough = 0.9, taper = false } = {}) {
  const geo = new THREE.BufferGeometry();
  const nv = n * (TSEG + 1);
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = [];
  for (let i = 0; i < n; i++) for (let k = 0; k <= TSEG; k++) {
    uv[(i * (TSEG + 1) + k) * 2] = i / (n - 1) * uRep; uv[(i * (TSEG + 1) + k) * 2 + 1] = k / TSEG;
    if (i < n - 1 && k < TSEG) { const a = i * (TSEG + 1) + k, b2 = a + TSEG + 1; idx.push(a, a + 1, b2, a + 1, b2 + 1, b2); }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, map, roughness: rough, bumpMap: map, bumpScale: 1.2, side: THREE.DoubleSide }));
  m.frustumCulled = false; m.castShadow = true;
  m.userData = { n, pos, nor, rn, rb, taper, ref: ref === 'z' ? _Z : _Y };
  return m;
}
const _N = new Vector3(), _B = new Vector3();
function setTube(m, pts, scaleN = 1, scaleB = 1) {
  const { n, pos, nor, rn: rn0, rb: rb0, taper, ref } = m.userData, a = m.geometry.attributes.position, an = m.geometry.attributes.normal;
  for (let i = 0; i < n; i++) {
    const p = pts[i], tp = taper ? 0.45 + 0.55 * Math.sin(Math.PI * i / (n - 1)) : 1, rn = rn0, rb = rb0 * tp;
    _t.copy(pts[Math.min(n - 1, i + 1)]).sub(pts[Math.max(0, i - 1)]).normalize();
    _N.crossVectors(_t, ref); if (_N.lengthSq() < 1e-6) _N.set(0, 0, 1); _N.normalize();
    _B.crossVectors(_t, _N).normalize();
    for (let k = 0; k <= TSEG; k++) {
      const ang = k / TSEG * TAU, c = Math.cos(ang), s = Math.sin(ang), o = (i * (TSEG + 1) + k) * 3;
      pos[o] = p.x + _N.x * c * rn * scaleN + _B.x * s * rb * scaleB; pos[o + 1] = p.y + _N.y * c * rn * scaleN + _B.y * s * rb * scaleB; pos[o + 2] = p.z + _N.z * c * rn * scaleN + _B.z * s * rb * scaleB;
      const nx = _N.x * c / (rn * scaleN) + _B.x * s / (rb * scaleB), ny = _N.y * c / (rn * scaleN) + _B.y * s / (rb * scaleB), nz = _N.z * c / (rn * scaleN) + _B.z * s / (rb * scaleB);
      const l = Math.hypot(nx, ny, nz) || 1; nor[o] = nx / l; nor[o + 1] = ny / l; nor[o + 2] = nz / l;
    }
  }
  a.needsUpdate = true; an.needsUpdate = true;
  m.geometry.computeBoundingSphere?.();
}
const catmull = (pts, n) => new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5).getPoints(n - 1);

// ---- the figure ----------------------------------------------------------------------------------------------------------------------
export async function createFigure(stage, opts = {}) {
  const {
    character = 'athlete_m', scale = 0.93, kit = { top: '#7a2438', bottoms: '#6b5642', socks: '#3a2c20' }, skin = 'tan', hair = 'black',
    loadKind = 'sacks', items = 5, base, lod, carry = true, trouser = '#6a5a46', topiBand = '#26324a', strapColor = '#ece3cc',
  } = opts;
  const h = await loadHuman({ character, base, scale, kit, skin, hair, lod });
  h.groundClamp = 'off'; h.footPlanting = false;
  stage.add(h);   // NOT tracked: this file advances the human itself, once per frame, before posing the props (FRAME ORDER)
  h.addLayer('lean', { mask: 'spine', additive: true });
  const leanClip = buildClip(h, {
    name: 'carry_lean', duration: 1, base: 'rest',
    keys: [{ t: 0 }, { t: 1, pose: { Spine: { flex: 22 }, Spine1: { flex: 22 }, Spine2: { flex: 12 }, Neck: { flex: -12 }, Head: { flex: 8 } }, ease: 'linear' }],
  });
  h.addClip(leanClip);
  const leanTr = h.play(leanClip, { layer: 'lean', fade: 0, loop: false, speed: 0 });
  h.addLayer('breath', { mask: 'spine', additive: true });
  const breathClip = buildClip(h, {
    name: 'breath_cycle', duration: 1, base: 'rest',
    keys: [{ t: 0 }, { t: 0.4, pose: { Spine2: { flex: -3.2 }, Neck: { flex: 1.6 } }, ease: 'inOut' }, { t: 1 }],
  });
  h.addClip(breathClip);
  const breathTr = h.play(breathClip, { layer: 'breath', fade: 0, loop: true, speed: 0.4 });
  h.play('idle', { fade: 0, loop: true });
  h.setFingers('R', 'fist'); h.setFingers('L', 'open');
  const YAW = Math.PI / 2;
  h.root.rotation.y = YAW; h.facing = YAW;
  const sc = scale;

  // ---- clothes the athlete model lacks: work trousers, canvas shoes, a dhaka topi, a waist cloth -----------------------------
  const lungiTex = (() => { const cv = globalThis.document.createElement('canvas'); cv.width = 128; cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = '#2f6a3c'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 32) for (let x = 0; x < 128; x += 32) { g.fillStyle = '#b3342b'; g.beginPath(); g.ellipse(x + 16, y + 16, 7, 11, 0.5, 0, TAU); g.fill(); g.fillStyle = '#e8c24a'; g.fillRect(x + 14, y + 8, 4, 16); }
    g.fillStyle = '#e8c24a'; g.fillRect(0, 0, 128, 4);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t; })();
  const trouserM = mat('#ffffff', 0.92, { map: lungiTex }), shoeM = mat('#2f2823', 0.7);
  const tube = (rt, rb, m) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, 1, 16, 1, false), m);
  const legs = ['L', 'R'].map(() => ({ thigh: tube(0.118 * sc, 0.088 * sc, trouserM), calf: tube(0.088 * sc, 0.064 * sc, trouserM), knee: new THREE.Mesh(new THREE.SphereGeometry(0.09 * sc, 12, 9), trouserM), shoe: new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 9), shoeM), cuff: tube(0.056 * sc, 0.06 * sc, mat('#4f4334')) }));
  const topiTex = (() => {
    const cv = globalThis.document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d');
    g.fillStyle = topiBand; g.fillRect(0, 0, 256, 64);
    const cols = ['#e8c24a', '#d8503a', '#f1ede0', '#4aa3c9'];
    for (let i = 0; i < 16; i++) { const x = i * 16; g.fillStyle = cols[i % 4]; g.beginPath(); g.moveTo(x + 8, 10); g.lineTo(x + 14, 32); g.lineTo(x + 8, 54); g.lineTo(x + 2, 32); g.closePath(); g.fill(); g.fillStyle = topiBand; g.fillRect(x + 7, 28, 2, 8); }
    g.fillStyle = '#e8c24a'; g.fillRect(0, 0, 256, 6); g.fillRect(0, 58, 256, 6);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
  })();
  const topi = new THREE.Group();
  {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * sc, 0.094 * sc, 0.115 * sc, 28, 1, true), mat('#ffffff', 0.85, { map: topiTex, side: THREE.DoubleSide }));
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * sc, 0.1 * sc, 0.004, 28), mat(topiBand, 0.85));
    crown.position.y = 0.0575 * sc; topi.add(band, crown);
  }
  // waist cloth (patuka): a band round the hips; the tail hangs from the near hip and swings
  const patuka = new THREE.Group();
  const patTail = new THREE.Group();
  {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.17 * sc, 0.17 * sc, 0.1 * sc, 22, 1, true), mat('#c9a24a', 0.85, { side: THREE.DoubleSide }));
    const tailGeo = new THREE.PlaneGeometry(0.07 * sc, 0.24 * sc, 1, 1); tailGeo.translate(0, -0.12 * sc, 0);
    const tail = new THREE.Mesh(tailGeo, mat('#a8452f', 0.9, { side: THREE.DoubleSide }));
    patTail.position.set(0.02 * sc, -0.04 * sc, 0.17 * sc); patTail.add(tail);
    patuka.add(band, patTail);
  }
  const hip = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), trouserM); hip.scale.set(0.2 * sc, 0.16 * sc, 0.18 * sc);
  const clothes = [topi, patuka, hip, ...legs.flatMap((l) => [l.thigh, l.calf, l.knee, l.shoe, l.cuff])];
  for (const o of clothes) { o.frustumCulled = false; o.traverse?.((c) => { if (c.isMesh) c.castShadow = true; }); stage.add(o); }

  // ---- load ---------------------------------------------------------------------------------------------------------------------
  const dokoG = new THREE.Group(), goodsG = new THREE.Group();
  let strap = null, tokma = null;
  if (carry) {
    dokoG.add(makeDoko(), goodsG);
    { // split firewood poking out the top (photo: maroon-sweater carrier)
      const lg = new THREE.Group(), lm = [mat('#d9b27a', 0.85), mat('#b98a52', 0.9), mat('#7a5a3a', 0.9)];
      lg.scale.setScalar(DS);
      for (let i = 0; i < 16; i++) {
        const l = new THREE.Mesh(B.roundedBox(0.07 + hash(i) * 0.04, 0.5 + hash(i + 9) * 0.3, 0.045 + hash(i + 3) * 0.03, 0.008, 2), lm[i % 3]);
        const a = i / 16 * TAU * 2.3, rr = 0.05 + (i % 3) * 0.06;
        l.position.set(Math.cos(a) * rr, 0.72 + hash(i + 5) * 0.1, Math.sin(a) * rr);
        l.rotation.set(Math.sin(a) * 0.45, a, -Math.cos(a) * 0.45 - 0.1); l.castShadow = true; lg.add(l);
      }
      dokoG.add(lg); dokoG.userData.logs = lg;
    }
    const pad = new THREE.Mesh(B.roundedBox(0.3, 0.26, 0.07, 0.03, 3), mat('#b8452f', 0.95)); pad.position.set(0.12, 0.2, 0); pad.rotation.z = 0.1; dokoG.add(pad);
    stage.add(dokoG);
    strap = new THREE.Group();
    strap.userData = {
      flap: makeTube(24, flapTexture(strapColor), { rn: 0.01, rb: 0.07, uRep: 3, ref: 'y', rough: 0.95, taper: true }),
      ropeN: makeTube(28, twistTexture('#e8d6a2', '#6a5226', '#fff1c8'), { rn: 0.021, rb: 0.021, uRep: 14, ref: 'z', rough: 0.8 }),
      ropeF: makeTube(28, twistTexture('#e8d6a2', '#6a5226', '#fff1c8'), { rn: 0.021, rb: 0.021, uRep: 14, ref: 'z', rough: 0.8 }),
      knotN: new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), mat('#6a5028', 0.8)), knotF: new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), mat('#6a5028', 0.8)),
    };
    for (const o of Object.values(strap.userData)) strap.add(o);
    stage.add(strap);
    tokma = makeTokma(); stage.add(tokma);
  }
  let goods = [], goodsKey = '';
  function setLoad(kind, n) {
    const key = `${kind}|${n}`; if (key === goodsKey) return; goodsKey = key;
    for (const g of goods) { goodsG.remove(g); g.traverse?.((o) => { if (o.geometry) o.geometry.dispose?.(); }); }
    goods = [];
    for (let i = 0; i < Math.min(n, SLOTS.length); i++) {
      const m = goodMesh(kind, i + 1), s = SLOTS[i];
      m.position.set(s[0], s[1], s[2]); m.rotation.set((hash(i * 3) - 0.5) * 0.3, (hash(i * 5 + 1) - 0.5) * 1.2, (hash(i * 7 + 2) - 0.5) * 0.25);
      goodsG.add(m); goods.push(m);
    }
    if (dokoG.userData.logs) dokoG.userData.logs.visible = kind === 'sacks' || kind === 'millet' || kind === 'salt';
    stage.invalidate?.();
  }
  setLoad(loadKind, items);

  // ---- per-frame --------------------------------------------------------------------------------------------------------------
  const wp = (n) => h.bones[`Bip01_${n}`].getWorldPosition(new Vector3());
  const st = { cyc: 0, lastX: null, speed: 0, clip: 'idle', leanAmt: 0.5, stepCount: 0, restS: 0 };
  const headBox = h.headBox;
  const api = {
    h, root: h.root, st, dokoG, tokma, strap, goodsG,
    walkSpeedRef: WALK_CLIP_SPEED * sc / GAIT_K,
    stride: WALK_CLIP_SPEED * WALK_CLIP_DUR * sc / GAIT_K,        // metres of ground per walk cycle at this figure's scale
    setLoad, footEvents: [], hands: null, moving: false, walkAmt: 0,
  };
  function seg(m, a, b) { _v.copy(b).sub(a); const L = _v.length() || 1e-3; m.position.copy(a).addScaledVector(_v, 0.5); m.quaternion.setFromUnitVectors(_Y, _v.divideScalar(L)); m.scale.set(1, L, 1); }
  let fdGlobal = 1;
  const dress = (tl) => {
    for (const [i, side] of ['L', 'R'].entries()) {
      const L = legs[i], th = wp(`${side}_Thigh`), ca = wp(`${side}_Calf`), ft = wp(`${side}_Foot`), to = wp(`${side}_Toe0`);
      _t.copy(ca).sub(th); const up = th.clone().addScaledVector(_t, -0.16);
      seg(L.thigh, up, ca); L.knee.position.copy(ca);
      seg(L.calf, ca, ft);
      const dirDown = ft.clone().sub(ca).normalize();
      seg(L.cuff, ft.clone().addScaledVector(dirDown, -0.055 * sc), ft.clone().addScaledVector(dirDown, 0.01));
      const f2 = to.clone().sub(ft); const fl = f2.length() || 0.1; f2.divideScalar(fl);
      L.shoe.position.copy(ft).addScaledVector(f2, 0.075 * sc).add(new Vector3(0, -0.035 * sc, 0));
      L.shoe.quaternion.setFromUnitVectors(new Vector3(1, 0, 0), new Vector3(f2.x, f2.y * 0.6, f2.z).normalize());
      L.shoe.scale.set(0.31 * sc, 0.11 * sc, 0.12 * sc);
    }
    const hd = wp('Head');
    topi.position.set(hd.x + 0.006, hd.y + 0.14 * sc, hd.z);
    topi.quaternion.setFromAxisAngle(new Vector3(0, 0, 1), 0.16);
    const pe = wp('Pelvis');
    hip.position.set(pe.x, pe.y - 0.02 * sc, pe.z); hip.rotation.z = -tl * fdGlobal;
    patuka.position.set(pe.x, pe.y + 0.05 * sc, pe.z);
    patuka.rotation.set(0, 0, -tl * fdGlobal);
  };

  /**
   * S: { x, y, z, rest 0..1 (propped on the tokma), breath 0..1, lean (rad), load (rad, doko angle), stumble 0..1, halt (bool), t (clock), gust, snap }
   * dt: seconds (0 re-applies the pose without advancing).
   */
  api.update = (dt, S) => {
    const { x, y, z = 0, rest = 0, breath = 1, lean = 0, load = 0, stumble = 0, halt = false, t = 0, gust = 0 } = S;
    const fd = S.fd ?? 1;                                  // +1: walks toward +x, -1: toward -x
    const sideN = fd > 0 ? 'R' : 'L', sideF = fd > 0 ? 'L' : 'R';
    // 1) displayed ground speed from the actual position change
    if (st.lastX !== null && dt > 1e-4) { const v = (x - st.lastX) / dt; st.speed += (v - st.speed) * Math.min(1, dt * 16); }
    if (S.snap) st.speed = 0;
    st.lastX = x;
    const moving = Math.abs(st.speed) > 0.14;
    const want = moving ? 'walk' : (rest > 0.5 || halt ? 'idle_relaxed' : 'idle');
    if (want !== st.clip) { h.play(want, { fade: S.snap ? 0 : 0.3, loop: true, speed: 1 }); st.clip = want; }
    const cur = h.layers.base.current;
    const heavy = 1 - breath;
    if (cur) cur.speed = st.clip === 'walk' ? clamp(Math.abs(st.speed) / api.walkSpeedRef, 0.12, 2.1) : clamp(0.8 + heavy * 0.6, 0.6, 1.4);
    if (moving) st.cyc += Math.abs(st.speed) * dt / api.stride;
    st.restS += (rest - st.restS) * Math.min(1, (dt || 0.016) * 10);
    // 2) body lean under the load: more on a climb, more when out of breath, hunched when gasping; a stumble shakes it
    const rise = Math.sin(t * (3.0 + 5 * heavy)) * (0.02 + 0.06 * heavy) * (rest > 0.4 ? 1 : 0.35);
    const tired = heavy * 0.14 + (halt ? 0.18 : 0);
    const amt = clamp(0.46 + clamp(lean, 0, 0.9) * 0.55 + tired + rise + stumble * 0.22 * Math.sin(t * 26) + gust * 0.06, 0, 1);
    st.leanAmt += (amt - st.leanAmt) * Math.min(1, (dt || 0.016) * 14);
    leanTr.time = st.leanAmt * leanClip.dur;
    breathTr.speed = 0.28 + heavy * 0.95 + (halt ? 0.5 : 0);
    api.breathDepth = 0.45 + heavy * 1.1 + (halt ? 0.5 : 0);
    h.root.rotation.y = fd * YAW; h.facing = fd * YAW;
    h.root.position.set(x, y, z);
    h.lookAt(null);
    h.update(dt);
    h.root.updateMatrixWorld(true);

    // 3) aim the hands at where the stick and the strap are (from the posed body), re-apply IK with a zero step
    const pel = wp('Pelvis'), neck = wp('Neck'), head = wp('Head');
    _t.copy(neck).sub(pel); const tl = Math.atan2(_t.x * fd, _t.y);
    const ca = Math.cos(tl), sa = Math.sin(tl);
    const phaseW = st.cyc * TAU;
    let fx = head.x + fd * 0.09 * sc, fy = head.y + 0.05 * sc, hcx = head.x;
    if (headBox) {
      const e = h.bones.Bip01_Head.matrixWorld; let minY = Infinity, maxY = -Infinity, maxX = -Infinity, minX = Infinity;
      for (const bx of [headBox.min.x, headBox.max.x]) for (const by of [headBox.min.y, headBox.max.y]) for (const bz of [headBox.min.z, headBox.max.z]) {
        const p = _v.set(bx, by, bz).applyMatrix4(e); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); maxX = Math.max(maxX, p.x); minX = Math.min(minX, p.x);
      }
      fx = fd > 0 ? maxX - 0.012 : minX + 0.012; fy = minY + (maxY - minY) * 0.72; hcx = (minX + maxX) / 2;
    }
    const sideZ = 0.085 * sc;
    const r = st.restS;
    const tilt = load * 1.15 + tl * 0.55 + (r > 0.5 ? -0.04 : 0);
    const dx = Math.sin(tilt), dy = Math.cos(tilt), fdx = dy, fdy = -dx;
    const piv = new Vector3(pel.x + fd * (sa * 0.14 * sc - ca * 0.29 * sc), pel.y + ca * 0.14 * sc + sa * 0.2 * sc + 0.04, pel.z);
    const walkAmt = moving ? clamp(Math.abs(st.speed) / api.walkSpeedRef, 0, 1.3) : 0;
    const sw = Math.sin(phaseW) * walkAmt;
    const gasp = clamp(r * (heavy * 2.0 + (halt ? 1 : 0)), 0, 1);
    // doko + namlo geometry, from the posed body, BEFORE the hands reach (the far hand holds the rope):
    // basket on the back, ropes run from the flap ends past the shoulders DOWN to two lugs on the basket's lower back-facing wall
    let ropeGrip = new Vector3(hcx, fy - 0.2, head.z - 0.2), flapPts = null, ropePts = null;
    if (carry) {
      const bob = Math.sin(phaseW * 2) * 0.012 * walkAmt;
      dokoG.position.set(piv.x, piv.y + bob, piv.z);
      dokoG.rotation.set(0, fd > 0 ? 0 : Math.PI, 0); dokoG.rotateZ(-tilt + Math.sin(phaseW) * 0.02 * walkAmt);
      dokoG.updateMatrixWorld(true);
      const lA = dokoG.localToWorld(new Vector3(LUG[0], LUG[1], LUG[2])), lB = dokoG.localToWorld(new Vector3(LUG[0], LUG[1], -LUG[2]));
      const lugs = lA.z >= lB.z ? [lA, lB] : [lB, lA];
      const sN = new Vector3(hcx - fd * 0.005, fy, head.z + sideZ), sF = new Vector3(hcx - fd * 0.005, fy, head.z - sideZ);
      const front = new Vector3(fx + fd * 0.012, fy - 0.005, head.z);
      const tight = clamp(st.leanAmt * 0.8 + walkAmt * 0.15, 0, 1);
      const slack = (1 - tight) * 0.045 + r * 0.03, creak = walkAmt * Math.sin(phaseW * 2) * 0.006;
      const cheek = (p, sd) => p.clone().add(new Vector3(-fd * 0.018, 0, sd * 0.012));
      flapPts = catmull([cheek(sN, 1).add(new Vector3(0, 0, 0.012)), sN.clone().lerp(front, 0.55).add(new Vector3(fd * 0.004, 0, 0.004)), front, sF.clone().lerp(front, 0.55).add(new Vector3(fd * 0.004, 0, -0.004)), cheek(sF, -1).add(new Vector3(0, 0, -0.012))], 24);
      ropePts = [0, 1].map((i) => {
        const sd = i ? -1 : 1, lug = lugs[i], e = flapPts[i ? 23 : 0];
        const a2 = new Vector3(e.x - fd * 0.03, e.y - 0.07, e.z + sd * 0.03);             // drops beside the ear/cheek
        const m = a2.clone().lerp(lug, 0.5); m.z += sd * 0.03; m.y -= slack + creak;       // clears the shoulder, sags a little
        const sh = new Vector3(a2.x - fd * 0.08, a2.y - 0.12, a2.z + sd * 0.07);       // over the shoulder
        const out = lug.clone().lerp(sh, 0.5); out.z += sd * 0.05;                       // rides the outside of the basket wall
        const tail = new Vector3(lug.x - fd * 0.005, lug.y - 0.13, lug.z + sd * 0.03);   // loose end hangs from the lug
        return catmull([e, a2, sh, out, lug.clone().add(new Vector3(0, 0, sd * 0.012)), tail], 28);
      });
      ropeGrip = flapPts[23].clone().add(new Vector3(-fd * 0.03, 0.03, -0.06));
    }
    // near hand: crossbar of the tokma at hip height ahead of the body; resting: on the thigh, gasping: on the knee
    const holdR = new Vector3(pel.x + fd * (0.27 * sc * ca + sw * 0.12), pel.y + 0.0, pel.z + 0.2 * sc);
    const thighR = new Vector3(pel.x + fd * 0.12 * sc, pel.y - 0.2 * sc, pel.z + 0.17 * sc);
    const kR = wp(`${sideN}_Calf`), kneeR = new Vector3(kR.x + fd * 0.02, kR.y + 0.08, kR.z + 0.07);
    const handNear = holdR.clone().lerp(thighR, r * 0.8).lerp(kneeR, gasp);
    // far hand: holds the far rope a hand-span below the flap (placed from the rope curve computed above)
    const hipL = new Vector3(pel.x + fd * 0.1 * sc, pel.y + 0.1 * sc, pel.z - 0.19 * sc);
    const kL = wp(`${sideF}_Calf`), kneeL = new Vector3(kL.x + fd * 0.02, kL.y + 0.08, kL.z - 0.07);
    const handFar = ropeGrip.clone().lerp(hipL, r * 0.15).lerp(kneeL, gasp);
    h.setReach(sideN, handNear, { weight: 1, pole: new Vector3(pel.x - fd * 0.25, pel.y - 0.1, pel.z + 0.95) });
    h.setReach(sideF, handFar, { weight: 1, pole: new Vector3(pel.x - fd * 0.3, pel.y + 0.1, pel.z - 0.95) });
    h.update(0);
    h.root.updateMatrixWorld(true);

    // 4) props, from the final posed bones
    const hR = wp(`${sideN}_Hand`), hL = wp(`${sideF}_Hand`);
    api.hands = { R: hR, L: hL };
    api.reachErr = { near: hR.distanceTo(handNear), far: hL.distanceTo(handFar) };
    if (carry) {
      // tokma: walking = crossbar in the near hand, shaft planted a little ahead; resting = crossbar under the basket's base, shaft straight down behind
      const gy = y;
      const grip = hR.clone();
      const hh = Math.max(0.25, grip.y - gy), Ls = 0.98 * sc;
      const tipWalk = new Vector3(grip.x + fd * Math.sqrt(Math.max(0.0004, Ls * Ls - hh * hh)), gy, grip.z);
      const barRest = new Vector3(piv.x - fd * 0.02, piv.y - 0.03, piv.z);
      const tipRest = new Vector3(barRest.x - fd * 0.02, gy, barRest.z);
      const k = clamp((r - 0.35) / 0.4, 0, 1), kk = k * k * (3 - 2 * k);
      const barPos = grip.clone().lerp(barRest, kk), tip = tipWalk.clone().lerp(tipRest, kk);
      const dir = tip.clone().sub(barPos), L = Math.max(0.3, dir.length());
      const g = tokma.userData;
      g.shaft.position.copy(barPos).addScaledVector(dir, 0.5); g.shaft.quaternion.setFromUnitVectors(_Y, dir.clone().normalize()); g.shaft.scale.set(1, L, 1);
      g.bar.position.copy(barPos); g.bar.rotation.set(Math.PI / 2, 0, 0);
      const U = strap.userData;
      setTube(U.flap, flapPts, 1, 1 + Math.sin(phaseW * 2) * 0.03 * walkAmt);
      setTube(U.ropeN, ropePts[0]); setTube(U.ropeF, ropePts[1]);
      U.knotN.position.copy(ropePts[0][0]); U.knotF.position.copy(ropePts[1][0]);
      api.strapPts = flapPts;
    }
    fdGlobal = fd; dress(tl);
    patTail.rotation.x = clamp(-st.speed * 0.1, -0.35, 0.35) + Math.sin(t * 2.2) * 0.04;
    patTail.rotation.z = Math.sin(phaseW) * 0.14 * walkAmt;
    // footfalls: one event per step of the cycle (dust, sound); positions of the foot that just landed
    api.footEvents.length = 0;
    const steps = Math.floor(st.cyc * 2 + 0.25);
    if (steps !== st.stepCount) {
      if (moving && steps > st.stepCount) { const side = steps % 2 ? 'R' : 'L'; const f = wp(`${side}_Foot`); api.footEvents.push({ side, x: f.x, y: f.y, z: f.z, speed: st.speed }); }
      st.stepCount = steps;
    }
    api.pelvis = pel; api.head = head; api.torsoLean = tl; api.tilt = tilt; api.moving = moving; api.walkAmt = walkAmt; api.dokoPivot = piv;
    api.forehead = new Vector3(fx, fy, head.z);
    return api;
  };

  api.makeGood = goodMesh;
  api.setVisible = (v) => { h.root.visible = v; for (const o of clothes) o.visible = v; dokoG.visible = v; if (strap) strap.visible = v; if (tokma) tokma.visible = v; };
  api.dispose = () => { stage.remove(h); for (const o of [...clothes, dokoG, strap, tokma]) if (o) stage.remove(o); };
  /** distance from the right-hand bone to the stick's crossbar while it is carried (verification: < 2 cm) */
  api.gripError = () => {
    if (!carry || !api.hands) return 0;
    const bar = tokma.userData.bar.position, hr = api.hands.R;
    return Math.hypot(bar.x - hr.x, bar.y - hr.y, bar.z - hr.z);
  };
  return api;
}

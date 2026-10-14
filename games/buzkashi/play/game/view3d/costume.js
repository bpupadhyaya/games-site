// Period costume for a buzkashi chapandaz, built on the bones of a view3d athlete: a quilted striped chapan (long coat) with wide sleeves and
// skirt panels that hang from the thighs and flap with the gallop, a silk sash, tall black riding boots, and a head dress (turban of wound
// cloth, karakul fur cap or tall fur kalpak). Also the leather sack. Presentation only.
import { THREE } from '../vendor3d/index.js';

const { Vector3, Quaternion, Group, Mesh, MeshStandardMaterial, CylinderGeometry, SphereGeometry, TorusGeometry, BoxGeometry, PlaneGeometry, CanvasTexture,
  SRGBColorSpace, RepeatWrapping, DoubleSide, Color, Matrix4, TubeGeometry, CatmullRomCurve3, LatheGeometry, Vector2 } = THREE;
const Yax = new Vector3(0, 1, 0);
const rngOf = (seed) => { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// ------------------------------------------------------------------------------------------------------------------ cloth textures
const texCache = new Map();
function canvasTex(w, h, draw, key) {
  if (texCache.has(key)) return texCache.get(key);
  const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; t.anisotropy = 4;
  if (key.startsWith('chapan')) t.repeat.set(4, 3);
  texCache.set(key, t);
  return t;
}
// chapan: quilted cloth with vertical ikat-like bands (the pale and dark stripes of the real silk) and a diamond quilting grid
export function chapanTexture(base, accent, dark) {
  return canvasTex(128, 128, (g, w, h) => {
    const rnd = rngOf(11);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const bands = [[0, 0.07, accent], [0.07, 0.12, dark], [0.12, 0.5, base], [0.5, 0.55, dark], [0.55, 0.62, accent], [0.62, 0.67, dark], [0.67, 1, base]];
    for (const [a, b, col] of bands) { g.fillStyle = col; g.fillRect(a * w, 0, (b - a) * w, h); }
    // ikat feathering at the band edges
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${0.04 + rnd() * 0.06})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1); }
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1;
    for (let k = -h; k < w + h; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + h, h); g.stroke(); g.beginPath(); g.moveTo(k + h, 0); g.lineTo(k, h); g.stroke(); }
  }, `chapan:${base}:${accent}:${dark}`);
}
function furTexture(base) {
  return canvasTex(128, 64, (g, w, h) => {
    const rnd = rngOf(5);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { const v = rnd(); g.strokeStyle = v > 0.5 ? 'rgba(255,240,220,0.22)' : 'rgba(0,0,0,0.3)'; g.lineWidth = 1; const x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 4, y + 3 + rnd() * 5); g.stroke(); }
    // karakul curls
    for (let i = 0; i < 120; i++) { g.strokeStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(rnd() * w, rnd() * h, 2 + rnd() * 2, 0, 5); g.stroke(); }
  }, `fur:${base}`);
}
function silkTexture(col, col2) {
  return canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    g.strokeStyle = col2; g.lineWidth = 3; for (let x = 0; x < w; x += 9) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; for (let y = 0; y < h; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }, `silk:${col}:${col2}`);
}

function tubeOn(bone, child, rParent, rChild, mat, { overlap = 0, from = 0, to = 1, seg = 18, open = true } = {}) {
  const dir = child.position.clone(); const len = dir.length(); dir.normalize();
  const L = len * (to - from) + overlap;
  const mesh = new Mesh(new CylinderGeometry(rChild, rParent, L, seg, 1, open), mat);
  mesh.quaternion.setFromUnitVectors(Yax, dir);
  mesh.position.copy(dir).multiplyScalar(len * (from + to) / 2);
  mesh.castShadow = true;
  bone.add(mesh);
  return mesh;
}

// ------------------------------------------------------------------------------------------------------------------------ the rider
/**
 * Dress `human` (a loaded view3d athlete_m). look: { kit (coat colour), trim (sash / trim colour), accent (stripe colour), cap: 'turban'|'karakul'|'kalpak',
 * boot, trousers }. Returns handles used by setLook() and the per-frame cloth motion.
 */
export function dressRider(human, look, variant = 0) {
  const C = (h) => new Color(h);
  // the feet are drawn bare by the model: drop every triangle on the foot bones (the boots replace them)
  human.root.traverse((o) => {
    if (!o.isSkinnedMesh || o.geometry.userData.barefoot) return;
    const geo = o.geometry, ix = geo.index, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    if (!ix || !si) return;
    const foot = new Set(o.skeleton.bones.map((bn, i) => (/_(Foot|Toe0)$/.test(bn.name) ? i : -1)).filter((i) => i >= 0));
    const w = new Float32Array(geo.attributes.position.count);
    for (let i = 0; i < w.length; i++) for (let k = 0; k < 4; k++) if (foot.has(si.getComponent(i, k))) w[i] += sw.getComponent(i, k);
    const a2 = ix.array;
    for (let t = 0; t < a2.length; t += 3) if (w[a2[t]] > 0.5 || w[a2[t + 1]] > 0.5 || w[a2[t + 2]] > 0.5) { a2[t + 1] = a2[t]; a2[t + 2] = a2[t]; }
    ix.needsUpdate = true; geo.userData.barefoot = true;
  });
  const chapanMat = () => new MeshStandardMaterial({ map: chapanTexture(look.kit, look.accent, look.dark), roughness: 0.78, side: DoubleSide });
  const mats = { chapan: [], trim: [], boot: new MeshStandardMaterial({ color: look.boot || 0x1c120c, roughness: 0.42, metalness: 0.05 }), trousers: new MeshStandardMaterial({ color: look.trousers || 0x2a2f45, roughness: 0.9 }) };
  const sleeveM = chapanMat(); mats.chapan.push(sleeveM);
  const skirtM = chapanMat(); mats.chapan.push(skirtM);
  const trimM = new MeshStandardMaterial({ map: silkTexture(look.trim, look.accent), roughness: 0.5, side: DoubleSide }); mats.trim.push(trimM);
  const h = { mats, panels: [], sleeves: [] };
  for (const s of ['L', 'R']) {
    const b = (n) => human.bones[`Bip01_${s}_${n}`];
    const up = b('UpperArm'), fo = b('Forearm'), ha = b('Hand'), th = b('Thigh'), ca = b('Calf'), ft = b('Foot'), to = b('Toe0');
    if (!up || !fo || !ha || !th || !ca || !ft) continue;
    // sleeves: wide, falling past the wrist, with a silk cuff
    tubeOn(up, fo, 0.082, 0.07, sleeveM, { overlap: 0.04, from: -0.08 });
    const fm = tubeOn(fo, ha, 0.07, 0.056, sleeveM, { overlap: 0.02, to: 1.12 });
    const cuff = new Mesh(new CylinderGeometry(0.052, 0.054, 0.045, 16, 1, true), trimM);
    cuff.quaternion.setFromUnitVectors(Yax, ha.position.clone().normalize()); cuff.position.copy(ha.position).multiplyScalar(0.1); fo.add(cuff);
    const cap = new Mesh(new SphereGeometry(0.086, 16, 12), sleeveM); cap.position.set(0, 0.01, 0); up.add(cap);
    // trousers and boots
    tubeOn(th, ca, 0.104, 0.078, mats.trousers, { overlap: 0, open: false });
    tubeOn(ca, ft, 0.074, 0.058, mats.trousers, { overlap: 0, from: 0, to: 0.5 });
    const knee = new Mesh(new SphereGeometry(0.079, 14, 10), mats.trousers); ca.add(knee);
    tubeOn(ca, ft, 0.082, 0.062, mats.boot, { overlap: 0, from: 0.22, to: 1.0 });
    const cuffB = new Mesh(new CylinderGeometry(0.088, 0.082, 0.05, 16, 1, true), mats.boot); cuffB.quaternion.setFromUnitVectors(Yax, ft.position.clone().normalize()); cuffB.position.copy(ft.position).multiplyScalar(0.22);
    ca.add(cuffB);
    if (to) {
      const foot = new Mesh(new SphereGeometry(0.062, 14, 10), mats.boot); ft.add(foot);
      tubeOn(ft, to, 0.062, 0.05, mats.boot, { overlap: 0.07 });
      const toe = new Mesh(new SphereGeometry(0.05, 12, 8), mats.boot); toe.position.copy(to.position).multiplyScalar(1.15); ft.add(toe);
    }
    h.sleeves.push(fm);
  }
  // the body of the chapan: an open waistcoat panel front and back (the shirt texture shows the quilting) plus a high collar and the sash
  const pelvis = human.bones.Bip01_Pelvis;
  const sp = human.bones.Bip01_Spine1, neck = human.bones.Bip01_Neck;
  const sash = new Mesh(new TorusGeometry(0.168, 0.034, 10, 28), trimM);
  const rq = pelvis.getWorldQuaternion(new Quaternion()).invert();
  human.root.updateMatrixWorld(true);
  const f = { up: new Vector3(0, 1, 0).applyQuaternion(rq), fwd: new Vector3(0, 0, 1).applyQuaternion(rq), left: new Vector3(1, 0, 0).applyQuaternion(rq) };
  const basis = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(f.left, f.up, f.fwd));
  const waist = new Group(); waist.quaternion.copy(basis);
  sash.rotation.x = Math.PI / 2; sash.position.set(0, 0.075, 0.01); sash.scale.set(1.0, 0.8, 1.0); waist.add(sash);
  const sashTail = new Mesh(new PlaneGeometry(0.1, 0.34, 1, 5), trimM); sashTail.position.set(0.15, -0.1, 0.12); sashTail.rotation.y = 0.6; waist.add(sashTail);
  // the skirts of the chapan: two halves hinged at the waist that fall over the thighs and lift and trail with the gallop
  h.halves = [];
  for (const side of [1, -1]) {
    const piv = new Group(); piv.position.set(0, 0.05, 0);
    const half = new Mesh(new CylinderGeometry(0.18, 0.3, 0.52, 20, 3, true, side > 0 ? 0.1 : Math.PI + 0.1, Math.PI - 0.2), skirtM);
    half.position.y = -0.26; half.scale.set(1, 1, 0.9); half.castShadow = true; piv.add(half);
    const hemT = new Mesh(new TorusGeometry(0.3, 0.012, 6, 20, Math.PI - 0.2), trimM); hemT.rotation.x = Math.PI / 2; hemT.rotation.z = side > 0 ? 0.1 - Math.PI / 2 : Math.PI + 0.1 - Math.PI / 2;
    hemT.position.y = -0.52; hemT.scale.set(1, 0.9, 1); piv.add(hemT);
    waist.add(piv); h.halves.push({ pivot: piv, side });
  }
  pelvis.add(waist);
  h.waist = waist; h.sashTail = sashTail;
  // collar
  if (neck) { const col = new Mesh(new TorusGeometry(0.085, 0.026, 8, 18), trimM); col.rotation.x = Math.PI / 2; col.position.set(0.0, 0.0, 0); neck.add(col); h.collar = col; }
  // head dress
  h.cap = addHeadDress(human, look, variant, h);
  h.skinUser = null;
  return h;
}

function headFrame(human) {
  const f = human.boneFrame('Head');
  const m = new Matrix4().makeBasis(f.left.clone().normalize(), f.up.clone().normalize(), f.fwd.clone().normalize());
  const q = new Quaternion().setFromRotationMatrix(m);
  const box = human.headBox;
  const c = box ? box.getCenter(new Vector3()) : new Vector3(0.07, 0, 0);
  const upExt = box ? Math.max(box.max.dot(f.up), box.min.dot(f.up)) : 0.2;
  const topPt = c.clone().addScaledVector(f.up, upExt - c.dot(f.up));
  return { q, f, topPt };
}

function addHeadDress(human, look, variant, h) {
  const { q, f, topPt } = headFrame(human);
  const g = new Group(); g.quaternion.copy(q);
  g.position.copy(topPt).addScaledVector(f.up, -0.075);
  const kind = look.cap || 'karakul';
  const trimC = new Color(look.trim);
  if (kind === 'turban') {
    // wound cloth: three overlapping tori and a dome, a loose tail falling behind
    const cloth = new MeshStandardMaterial({ map: silkTexture(look.turban || '#efe6d2', look.accent), roughness: 0.8 });
    h.mats.turban = cloth;
    const dome = new Mesh(new SphereGeometry(0.108, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), cloth); dome.position.y = 0.03; dome.scale.y = 0.85; g.add(dome);
    for (let i = 0; i < 3; i++) {
      const t = new Mesh(new TorusGeometry(0.104 - i * 0.004, 0.032, 10, 26), cloth);
      t.rotation.x = Math.PI / 2 + (i - 1) * 0.12; t.rotation.y = (i - 1) * 0.07; t.position.y = 0.01 + i * 0.035; g.add(t);
    }
    const tail = new Mesh(new PlaneGeometry(0.09, 0.3, 1, 4), cloth); tail.material = cloth.clone(); tail.material.side = DoubleSide; tail.position.set(-0.08, -0.08, -0.1); tail.rotation.set(0.15, 0.5, 0.1); g.add(tail);
    h.turbanTail = tail;
  } else if (kind === 'kalpak') {
    // tall fur kalpak with a flat cloth crown
    const fur = new MeshStandardMaterial({ map: furTexture('#2a1d14'), roughness: 1 });
    const crownM = new MeshStandardMaterial({ color: trimC, roughness: 0.7 });
    h.mats.fur = fur; h.mats.crown = crownM;
    const prof = [[0.112, -0.02], [0.118, 0.04], [0.12, 0.1], [0.112, 0.15], [0.1, 0.17]].map(([r, y]) => new Vector2(r, y));
    const body = new Mesh(new LatheGeometry(prof, 22), fur); body.material.side = DoubleSide; g.add(body);
    const top = new Mesh(new CylinderGeometry(0.1, 0.1, 0.012, 20), crownM); top.position.y = 0.172; g.add(top);
  } else {
    // karakul: a low, rounded fur cap with a turned-up band
    const fur = new MeshStandardMaterial({ map: furTexture('#34261b'), roughness: 1 });
    const crownM = new MeshStandardMaterial({ color: trimC, roughness: 0.7 });
    h.mats.fur = fur; h.mats.crown = crownM;
    const band = new Mesh(new CylinderGeometry(0.112, 0.12, 0.085, 22, 1, true), fur); band.material.side = DoubleSide; band.position.y = 0.035; g.add(band);
    const rimT = new Mesh(new TorusGeometry(0.115, 0.026, 8, 24), fur); rimT.rotation.x = Math.PI / 2; rimT.position.y = -0.006; g.add(rimT);
    const rimU = new Mesh(new TorusGeometry(0.104, 0.022, 8, 24), fur); rimU.rotation.x = Math.PI / 2; rimU.position.y = 0.08; g.add(rimU);
    const crown = new Mesh(new SphereGeometry(0.102, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), crownM); crown.position.y = 0.075; crown.scale.y = 0.58; g.add(crown);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  human.bones.Bip01_Head.add(g);
  return g;
}

/** Recolour a dressed rider (team colours) without rebuilding it. */
export function recolour(h, look) {
  for (const m of h.mats.chapan) { m.map = chapanTexture(look.kit, look.accent, look.dark); m.needsUpdate = true; }
  for (const m of h.mats.trim) { m.map = silkTexture(look.trim, look.accent); m.needsUpdate = true; }
  if (h.mats.crown) h.mats.crown.color.set(look.trim);
}

// ----------------------------------------------------------------------------------------------------------------------- the sack
// A stuffed, stitched leather dummy in the shape of a calf (barrel, four stubby legs, a sewn neck stump), about 0.95 m long. It stands in for the
// carcass of the real sport: no head, no blood, nothing alive. Long axis along local Z.
let leatherTex = null;
function leatherTexture() {
  if (leatherTex) return leatherTex;
  const c = globalThis.document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#b0804f'); gr.addColorStop(0.5, '#8d5f36'); gr.addColorStop(1, '#684422');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  const rnd = rngOf(7);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? '50,28,12' : '230,190,140'},${0.04 + rnd() * 0.08})`; g.beginPath(); g.arc(rnd() * 256, rnd() * 128, 1 + rnd() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 60; i++) { g.strokeStyle = 'rgba(30,14,6,0.25)'; g.beginPath(); const x = rnd() * 256, y = rnd() * 128; g.moveTo(x, y); g.lineTo(x + rnd() * 30 - 15, y + rnd() * 10 - 5); g.stroke(); }
  g.strokeStyle = 'rgba(30,14,6,0.85)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 64); g.lineTo(256, 64); g.stroke();
  g.strokeStyle = 'rgba(244,222,176,0.9)'; g.lineWidth = 2;
  for (let x = 4; x < 256; x += 10) { g.beginPath(); g.moveTo(x, 56); g.lineTo(x + 5, 72); g.moveTo(x + 5, 56); g.lineTo(x, 72); g.stroke(); }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = RepeatWrapping; t.anisotropy = 4;
  leatherTex = t;
  return t;
}
export function makeSack() {
  const mat = new MeshStandardMaterial({ map: leatherTexture(), roughness: 0.82, bumpMap: leatherTexture(), bumpScale: 0.6 });
  const g = new Group();
  const chest = new Mesh(new SphereGeometry(0.5, 24, 16), mat); chest.scale.set(0.46, 0.44, 0.62); chest.position.set(0, 0.02, 0.2); g.add(chest);
  const haunch = new Mesh(new SphereGeometry(0.5, 24, 16), mat); haunch.scale.set(0.42, 0.4, 0.56); haunch.position.set(0, 0, -0.22); g.add(haunch);
  const belly = new Mesh(new SphereGeometry(0.5, 16, 10), mat); belly.scale.set(0.4, 0.36, 0.7); belly.position.set(0, -0.02, 0); g.add(belly);
  const legGeo = new CylinderGeometry(0.05, 0.066, 0.4, 10); legGeo.translate(0, -0.2, 0);
  const hoofM = new MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.7 });
  const legs = [];
  for (const [x, z, sx, rz] of [[0.14, 0.34, 1, 0.3], [-0.14, 0.34, -1, 0.3], [0.13, -0.38, 1, -0.45], [-0.13, -0.38, -1, -0.45]]) {
    const leg = new Mesh(legGeo, mat); leg.position.set(x, -0.12, z); leg.rotation.set(rz, 0, sx * 0.22); g.add(leg); legs.push(leg);
    const tip = new Mesh(new SphereGeometry(0.055, 10, 8), hoofM); tip.position.set(0, -0.41, 0); tip.scale.set(0.9, 1.0, 1.25); leg.add(tip);
  }
  const neck = new Mesh(new CylinderGeometry(0.11, 0.17, 0.26, 14), mat); neck.rotation.x = Math.PI / 2 + 0.25; neck.position.set(0, 0.1, 0.58); g.add(neck);
  const stitch = new Mesh(new TorusGeometry(0.105, 0.014, 6, 16), new MeshStandardMaterial({ color: 0xf0dcb0, roughness: 0.8 })); stitch.position.set(0, 0.07, 0.7); stitch.rotation.x = 0.25; g.add(stitch);
  const loop = new Mesh(new TorusGeometry(0.075, 0.016, 6, 14), new MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.9 })); loop.position.set(0.0, 0.2, 0.3); loop.rotation.y = Math.PI / 2; g.add(loop);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  g.userData.legs = legs;
  return g;
}
export { tubeOn };

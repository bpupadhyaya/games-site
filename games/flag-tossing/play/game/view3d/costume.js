// Costumes for the 3D people: period doublet and parti-coloured hose painted onto a private copy of the body texture, plus belt, dagged
// tabard, cap and feather as meshes parented to the bones. Shared by the flag bearers and the musicians.
import { THREE } from '../vendor3d/index.js';

const { Vector3, Quaternion } = THREE;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const BODY_M = 1.804;                // the athlete's height in metres; the 2D bearer is H design units tall (head top at about 100)
export const COSTUMES = [
  { tab: '#2557a7', trim: '#f2c14e', hoseL: '#c0262f', hoseR: '#f8f1e0', sleeve: '#c0262f', hat: '#c0262f' },
  { tab: '#c0262f', trim: '#f8f1e0', hoseL: '#2557a7', hoseR: '#f2c14e', sleeve: '#2557a7', hat: '#2557a7' },
  { tab: '#2f8a5b', trim: '#f2c14e', hoseL: '#f2c14e', hoseR: '#5b2a86', sleeve: '#f2c14e', hat: '#5b2a86' },
];
export const LOOKS = [{ skin: 'tan', hair: 'black' }, { skin: 'light', hair: 'brown' }, { skin: 'brown', hair: 'black' }];

// The layer's shader lifts any painted colour darker than this luminance (see dressBody), so the matching 3D parts use the same colour.
const SKIN_LUM = 0.3023 * 0.55;
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const srgb = (v) => { v = clamp(v, 0, 1); return Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); };
function lifted(hex) {
  const [r, g, b] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)].map(lin);
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b, k = l < SKIN_LUM ? clamp(SKIN_LUM / Math.max(l, 0.004), 1, 12) : 1;
  return '#' + [r, g, b].map((v) => srgb(v * k).toString(16).padStart(2, '0')).join('');
}
const hex3 = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ---------------------------------------------------------------------------------------------------------------------------------
// Costume: repaint a private copy of the body texture (the shared textures stay untouched) and clear the tint masks where painted.
export const TONES = { light: [1.04, 1.0, 0.97], tan: [0.9, 0.78, 0.68], brown: [0.68, 0.52, 0.42] };
export function dressBody(human, c, tone = null) {
  const N = 1024;
  const cv = () => { const e = globalThis.document.createElement('canvas'); e.width = e.height = N; return e; };
  const read = (img) => { const e = cv(); const g = e.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, N, N); return { e, g, d: g.getImageData(0, 0, N, N) }; };
  if (tone && TONES[tone]) {
    for (const m of human.mats) {
      if (m.userData.kind !== 'head' || !m.map || !m.userData.tint) continue;
      const img = m.map.image, W = img.width || 1024, Hh = img.height || 1024;
      const e = globalThis.document.createElement('canvas'); e.width = W; e.height = Hh;
      const g = e.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, W, Hh);
      const d = g.getImageData(0, 0, W, Hh), px = d.data, mc = globalThis.document.createElement('canvas'); mc.width = W; mc.height = Hh;
      const mg = mc.getContext('2d', { willReadFrequently: true }); mg.drawImage(m.userData.tint.tMask.value.image, 0, 0, W, Hh);
      const md = mg.getImageData(0, 0, W, Hh).data, tm = TONES[tone];
      for (let i = 0; i < px.length; i += 4) if (md[i] < 100) { px[i] *= tm[0]; px[i + 1] *= tm[1]; px[i + 2] *= tm[2]; }
      g.putImageData(d, 0, 0);
      const t = new THREE.CanvasTexture(e); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; m.map = t; m.needsUpdate = true;
    }
  }
  for (const m of human.mats) {
    if (m.userData.kind !== 'body' || !m.map || !m.userData.tint) continue;
    const u = m.userData.tint;
    const A = read(m.map.image), M = read(u.tMask.value.image), K = read(u.tSkin.value.image);
    const a = A.d.data, mk = M.d.data, sk = K.d.data;
    const sk0 = sk.slice();                       // the base figure's skin texels (before any paint)
    const tm = tone && TONES[tone];
    if (tm) for (let i = 0; i < a.length; i += 4) if (sk[i] > 128) { a[i] = Math.min(255, a[i] * tm[0]); a[i + 1] = Math.min(255, a[i + 1] * tm[1]); a[i + 2] = Math.min(255, a[i + 2] * tm[2]); }
    // The layer's shader turns near-black cloth texels into light cloth ("hem paint"): marking the painted texels as skin (with the skin recolour left
    // off, see createBearers) keeps their colour; the skin lift only brightens very dark colours a little.
    const paint = (x0, y0, x1, y1, hex, ref, test, floor = 0.55) => {
      const [r, g, b] = hex3(hex);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * N + x) * 4;
        if (test && !test(i, x, y)) continue;
        const L = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
        const sh = clamp(L / ref, floor, 1.12);
        a[i] = clamp(r * sh, 0, 255); a[i + 1] = clamp(g * sh, 0, 255); a[i + 2] = clamp(b * sh, 0, 255); a[i + 3] = 255;
        mk[i] = 0; mk[i + 1] = 0; mk[i + 2] = 0; sk[i] = 255;
      }
    };
    // doublet: the whole torso panel
    paint(325, 30, 700, 880, c.tab, 215, (i) => mk[i] > 100 || (a[i] > 150 && a[i + 1] > 150 && a[i + 2] > 150), 0.62);
    // sleeves: the arm strips, down to the wrist
    paint(318, 285, 448, 560, c.sleeve, 150, null, 0.5);
    paint(578, 285, 708, 560, c.sleeve, 150, null, 0.5);
    paint(318, 285, 448, 400, c.tab, 150, null, 0.5);            // shoulder rolls in the doublet colour
    paint(578, 285, 708, 400, c.tab, 150, null, 0.5);
    // parti-coloured hose: the two leg columns (breeches, thigh, calf), boots at the bottom
    paint(0, 0, 316, 862, c.hoseL, 170, null, 0.6);
    paint(712, 0, 1024, 862, c.hoseR, 170, null, 0.6);
    paint(222, 858, 430, 1024, '#1b0f08', 150, null, 0.7);
    paint(594, 858, 812, 1024, '#1b0f08', 150, null, 0.7);
    // the bare arms of the base figure (upper arm + forearm, down to the wrist) sit in the lower outer blocks of the atlas: both sleeves in the sleeve
    // colour (the hose paint used to reach them, so one arm wore the white hose colour and looked like a plaster cast)
    paint(0, 478, 414, 872, c.sleeve, 170, (i) => sk0[i] > 128, 0.6);
    paint(610, 478, 1024, 872, c.sleeve, 170, (i) => sk0[i] > 128, 0.6);
    A.g.putImageData(A.d, 0, 0); M.g.putImageData(M.d, 0, 0); K.g.putImageData(K.d, 0, 0);
    const tex = (e, srgb) => { const t = new THREE.CanvasTexture(e); t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; return t; };
    m.map = tex(A.e, true); u.tMask.value = tex(M.e, false); u.tSkin.value = tex(K.e, false);
    m.needsUpdate = true;
  }
}

// Parent a mesh to a bone, keeping its world placement at the rest pose.
export function attach(human, boneName, obj, worldPos) {
  const b = human.bones[`Bip01_${boneName}`];
  const inv = b.getWorldQuaternion(new Quaternion()).invert();
  obj.quaternion.copy(inv);
  obj.position.copy(worldPos.clone().sub(b.getWorldPosition(new Vector3())).applyQuaternion(inv));
  b.add(obj);
}

// A feather as a bent ribbon (two-sided), not a tube.
function featherMesh(color) {
  const pts = [new Vector3(0, 0, 0), new Vector3(0.05, 0.07, 0.02), new Vector3(0.11, 0.12, 0.0), new Vector3(0.17, 0.12, -0.03), new Vector3(0.21, 0.07, -0.06)];
  const curve = new THREE.CatmullRomCurve3(pts);
  const N = 14, pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, p = curve.getPoint(u), t = curve.getTangent(u);
    const w = 0.026 * Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.08)) + 0.004;
    const n = new Vector3(-t.y, t.x, 0).normalize();
    pos.push(p.x - n.x * w, p.y - n.y * w, p.z - n.z * w + 0.0, p.x + n.x * w, p.y + n.y * w, p.z + n.z * w + 0.012);
    if (i < N) { const a0 = i * 2; idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide }));
}

// Period details in the costume colours: belt, short dagged peplum, puffed slashed sleeves, a standing collar, a beret with a feather.
export function addCostumeMeshes(human, c) {
  human._applyRest(); human.root.updateMatrixWorld(true);
  const wp = (n) => human.bones[`Bip01_${n}`].getWorldPosition(new Vector3());
  const std = (hex, rough = 0.7, o = {}) => new THREE.MeshStandardMaterial({ color: lifted(hex), roughness: rough, metalness: 0, side: THREE.DoubleSide, ...o });
  const pel = wp('Pelvis'), sp = wp('Spine'), hd = wp('Head');
  const waistY = pel.y + (sp.y - pel.y) * 0.55 + 0.045;
  const parts = [];
  // belt with a brass buckle
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.055, 36, 1, true), std(c.trim, 0.4));
  belt.scale.set(0.192, 1, 0.142);
  attach(human, 'Spine', belt, new Vector3(pel.x, waistY, pel.z));
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.062, 0.012), new THREE.MeshStandardMaterial({ color: 0xf0c050, metalness: 0.85, roughness: 0.28 }));
  attach(human, 'Spine', buckle, new Vector3(pel.x, waistY, pel.z + 0.145));
  // peplum: a short flared skirt of the doublet with rounded tabs at the hem
  const H = 0.2, seg = 48, TABS = 12;
  const g = new THREE.CylinderGeometry(0.168, 0.205, H, seg, 1, true);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 0) {
    const a = (Math.atan2(pos.getZ(i), pos.getX(i)) / (Math.PI * 2) + 1) % 1, f = (a * TABS) % 1;
    pos.setY(i, -H / 2 - 0.05 * Math.sin(Math.PI * f));
  }
  g.computeVertexNormals();
  const skirt = new THREE.Mesh(g, std(c.tab, 0.75));
  skirt.scale.set(1, 1, 0.8);
  attach(human, 'Pelvis', skirt, new Vector3(pel.x, waistY - H / 2 + 0.02, pel.z - 0.004));
  parts.push(belt, buckle, skirt);
  // puffed upper sleeves, slashed with the second colour
  for (const side of ['L', 'R']) {
    const ua = wp(`${side}_UpperArm`), fa = wp(`${side}_Forearm`);
    const mid = ua.clone().lerp(fa, 0.42);
    const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), std(c.sleeve, 0.8));
    puff.scale.set(0.105, 0.072, 0.072); puff.name = 'puff';
    attach(human, `${side}_UpperArm`, puff, mid);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.03, 16, 1, true), std(c.trim, 0.5));
    cuff.rotation.z = Math.PI / 2;
    const cw = ua.clone().lerp(fa, 0.88);
    attach(human, `${side}_UpperArm`, cuff, cw);
    parts.push(puff, cuff);
  }
  // leather boots over the trainers: a shaft to mid-calf with a turned cuff, and a rounded toe cap
  const bootMat = std('#2b180c', 0.55), cuffMat = std('#6b4423', 0.6);
  for (const side of ['L', 'R']) {
    const ca = wp(`${side}_Calf`), ft = wp(`${side}_Foot`);
    const shaftLen = ca.distanceTo(ft) * 0.78;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.052, shaftLen, 18, 1, true), bootMat);
    attach(human, `${side}_Calf`, shaft, ft.clone().lerp(ca, 0.4).add(new Vector3(0, 0.0, 0)));
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.07, 0.05, 18, 1, true), cuffMat);
    attach(human, `${side}_Calf`, cuff, ft.clone().lerp(ca, 0.4).add(new Vector3(0, shaftLen / 2 - 0.02, 0)));
    const toe = wp(`${side}_Toe0`);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), bootMat);
    cap.scale.set(0.05, 0.042, 0.115);
    attach(human, `${side}_Foot`, cap, ft.clone().lerp(toe, 0.62).add(new Vector3(0, 0.0, 0.0)));
    parts.push(shaft, cuff, cap);
  }
  // standing collar
  const sp2 = wp('Spine2'), nk = wp('Neck');
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.078, 0.045, 24, 1, true), std(c.trim, 0.5));
  attach(human, 'Spine2', collar, new Vector3(nk.x, nk.y - 0.018, nk.z));
  void sp2;
  parts.push(collar);
  // beret: a flattened dome with a band, tilted; a curved feather
  const cap = new THREE.Group();
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.135, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), std(c.hat, 0.85));
  crown.scale.set(1.12, 0.6, 1.12);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.116, 0.014, 8, 36), std(c.trim, 0.45));
  band.rotation.x = Math.PI / 2; band.position.y = 0.0;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.12, 0.028, 32), std(c.hat, 0.8));
  brim.position.y = 0.006;
  cap.add(crown, band, brim);
  const fe = featherMesh(0xf8f1e0); fe.position.set(0.1, 0.04, -0.02); fe.rotation.set(0.1, 0.6, -0.1); fe.scale.setScalar(1.15); cap.add(fe);
  cap.rotation.z = -0.16; cap.rotation.x = -0.07;
  const capHolder = new THREE.Group(); capHolder.add(cap);
  attach(human, 'Head', capHolder, new Vector3(hd.x, hd.y + 0.15, hd.z - 0.012));
  parts.push(cap);
  return parts;
}

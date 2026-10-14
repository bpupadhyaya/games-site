// A child's head built from primitives (the shared athletes only have adult heads): a smooth skull with cheeks and a small chin,
// big eyes with iris and highlight, brows, nose, ears, a smile, blush and hair. It replaces the athlete's head mesh (which is hidden)
// and rides on the Head bone, so every clip, look-at and idle motion drives it. Units are the bone's local metres (pre root-scale).
import { THREE, mat } from './kit.js';

const TAU = Math.PI * 2;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function skull(a, b, c) {
  const g = new THREE.SphereGeometry(1, 36, 26), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let nx = p.getX(i), ny = p.getY(i), nz = p.getZ(i);
    const front = Math.max(0, nz);
    const jaw = sstep(0.05, -0.95, ny);
    let x = nx * a * (1 - 0.30 * jaw), y = ny * b, z = nz * c * (1 - 0.14 * jaw);
    // cheeks: soft bulge on the front, either side of the nose, below the eyes
    const ch = Math.exp(-(((ny + 0.28) / 0.34) ** 2)) * Math.exp(-(((Math.abs(nx) - 0.52) / 0.3) ** 2)) * front;
    x *= 1 + 0.07 * ch; z *= 1 + 0.045 * ch;
    // forehead roundness and a small chin
    z += 0.016 * Math.exp(-(((ny - 0.45) / 0.3) ** 2)) * front;
    z += 0.012 * Math.exp(-(((ny + 0.82) / 0.16) ** 2)) * front * (1 - Math.abs(nx));
    // flatter back of the head, slight
    if (nz < 0) z *= 0.96;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

export function buildKidHead(look, o = {}) {
  const A = 0.108, Bh = 0.135, C = 0.118;
  const skin = new THREE.Color(look.skin);
  const skinM = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.58, metalness: 0, emissive: skin.clone().multiplyScalar(0.07) });
  const skinD = new THREE.MeshStandardMaterial({ color: skin.clone().multiplyScalar(0.8), roughness: 0.6 });
  const g = new THREE.Group();
  const add = (m, x, y, z, sx = 1, sy = 1, sz = 1) => { m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = false; g.add(m); return m; };
  const head = new THREE.Mesh(skull(A, Bh, C), skinM); head.castShadow = true; g.add(head);
  // neck (the athlete's neck belongs to the head mesh, which is hidden)
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.062, 0.1, 14), skinD), 0, -0.112, -0.004);
  // ears
  for (const s of [-1, 1]) {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), skinM), s * (A - 0.002), -0.005, -0.004, 0.42, 1.05, 0.8);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), skinD), s * (A + 0.0035), -0.005, 0.0, 0.3, 0.9, 0.6);
  }
  // nose
  add(new THREE.Mesh(new THREE.SphereGeometry(0.0205, 14, 10), skinM), 0, -0.026, C - 0.004, 1.0, 0.92, 1.1);
  for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.SphereGeometry(0.0055, 8, 6), mat('#3a1c14', { rough: 0.9 })), s * 0.0078, -0.037, C + 0.012, 1, 0.7, 0.6);
  // eyes: sclera, iris, pupil, a catch-light; they sit in the head so lids are suggested by a skin-coloured brow ridge
  const iris = new THREE.Color(look.iris || '#3a2414');
  const eyeGroup = new THREE.Group(); g.add(eyeGroup);
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(s * 0.047, 0.015, C - 0.026);
    const sc = new THREE.Mesh(new THREE.SphereGeometry(0.0275, 16, 12), new THREE.MeshStandardMaterial({ color: '#f6f2ea', roughness: 0.25 }));
    const ir = new THREE.Mesh(new THREE.SphereGeometry(0.0172, 14, 10), new THREE.MeshStandardMaterial({ color: iris, roughness: 0.3 })); ir.position.z = 0.0228; ir.scale.z = 0.38;
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.0088, 10, 8), new THREE.MeshStandardMaterial({ color: '#07070a', roughness: 0.2 })); pu.position.z = 0.0262; pu.scale.z = 0.3;
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.0046, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' })); hl.position.set(0.0075, 0.0085, 0.0292);
    e.add(sc, ir, pu, hl);
    // upper lid: a skin cap that closes the top of the eyeball a little (and lowers for a blink)
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0292, 16, 10, 0, TAU, 0, Math.PI * 0.27), skinM); lid.rotation.x = 0.15; lid.position.z = 0.0;
    e.add(lid);
    eyeGroup.add(e); eyes.push({ e, lid, ir, pu, hl });
  }
  // brows
  const hairC = new THREE.Color(look.hair);
  const hairM = new THREE.MeshStandardMaterial({ color: hairC, roughness: 0.5, metalness: 0.05 });
  for (const s of [-1, 1]) {
    const br = new THREE.Mesh(new THREE.CapsuleGeometry(0.0062, 0.036, 4, 8), new THREE.MeshStandardMaterial({ color: hairC.clone().multiplyScalar(0.75), roughness: 0.7 }));
    br.rotation.z = Math.PI / 2 + s * 0.14; br.position.set(s * 0.048, 0.056, C - 0.021); br.rotation.y = s * 0.35; g.add(br);
  }
  // smile: an arc of lip colour, a little teeth line for cheering
  const lip = new THREE.Color(look.skin).lerp(new THREE.Color('#b8433a'), 0.55);
  const arc = Math.PI * 0.62;
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.0062, 6, 20, arc), new THREE.MeshStandardMaterial({ color: lip, roughness: 0.45 }));
  mouth.rotation.z = -Math.PI / 2 - arc / 2; mouth.position.set(0, -0.052, C - 0.014); mouth.scale.set(1, 0.7, 1); g.add(mouth);
  // blush
  for (const s of [-1, 1]) {
    const bl = new THREE.Mesh(new THREE.CircleGeometry(0.028, 16), new THREE.MeshBasicMaterial({ color: '#ff6f6a', transparent: true, opacity: 0.2, depthWrite: false }));
    bl.position.set(s * 0.076, -0.03, C - 0.036); bl.rotation.y = s * 0.7; g.add(bl);
  }
  // hair
  const hair = new THREE.Group(); g.add(hair);
  const style = o.hair || 'short';
  const cap = (th, scale, tilt, y = 0.0) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18, 0, TAU, 0, th), hairM);
    m.scale.set(A * scale[0], Bh * scale[1], C * scale[2]); m.rotation.x = tilt; m.position.y = y; m.castShadow = true; return m;
  };
  if (style !== 'beanie' && style !== 'none') {
    hair.add(cap(Math.PI * 0.47, [1.06, 1.05, 1.06], -0.12, 0.0));
    const nape = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), hairM); nape.scale.set(A * 0.98, Bh * 0.62, C * 0.66); nape.position.set(0, -0.012, -0.05); hair.add(nape);
    if (style === 'pigtails' || style === 'pony' || style === 'bun') {
      // fuller hair at the back for girls
      const back = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), hairM); back.scale.set(A * 1.03, Bh * 0.72, C * 0.7); back.position.set(0, -0.02, -0.035); hair.add(back);
      // a centre parting line and side fringe swept over the forehead
      const fr = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10, 0, TAU, 0, Math.PI * 0.5), hairM); fr.scale.set(0.085, 0.02, 0.03); fr.rotation.x = -0.1; fr.position.set(0.0, 0.084, C - 0.012); hair.add(fr);
    } else {
      // boys: a tuft of fringe
      const fr = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.1, 4, 8), hairM); fr.rotation.z = Math.PI / 2 + 0.08; fr.position.set(0.006, 0.086, C - 0.014); hair.add(fr);
    }
  }
  g.scale.setScalar(o.scale || 1.32);
  g.userData = { eyes, mouth, head, hair, A, Bh, C, skinM };
  return g;
}

// hide the athlete's own head mesh (every LOD shares the tinted materials, so setting the material invisible hides them all)
export function hideAdultHead(h) {
  h.root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const list = [].concat(o.material);
    for (const m of list) if (m.userData && m.userData.kind === 'head') m.visible = false;
  });
}

// The hunter's arm in the first person: a quilted crimson coat sleeve with gold trim, a fox-fur cuff made of individual fur cards, a thick
// stitched leather gauntlet (cuff flare, palm, curled fingers, thumb) and the leather jess with a brass swivel. Real scale (forearm ~0.28 m,
// glove ~0.2 m). Arm local frame: origin at the wrist, +Z toward the fingers, +Y up, +X to the left.
import { loft } from './eagle3d.js';
import { featherCanvas, leatherCanvas, quiltCanvas, furCanvas } from './textures.js';

const lerp = (a, b, t) => a + (b - a) * t;
const hex = (c, T) => { const k = new T.Color(c); return [k.r, k.g, k.b]; };
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function createArm(T) {
  const root = new T.Group(); root.name = 'arm';
  const rep = (c, rx, ry) => { const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; };
  const quilt = rep(quiltCanvas(256, 6), 3, 4);
  const leatherT = rep(leatherCanvas(9, 256), 2, 2);
  const furT = rep(furCanvas(8, 256, 0), 2, 1);
  const sleeveMat = new T.MeshStandardMaterial({ vertexColors: true, map: quilt, roughness: 0.82, metalness: 0 });
  const leatherMat = new T.MeshStandardMaterial({ vertexColors: true, map: leatherT, roughness: 0.55, metalness: 0.02 });
  const furBase = new T.MeshStandardMaterial({ vertexColors: true, map: furT, roughness: 1, metalness: 0 });
  const furCardTex = new T.CanvasTexture(featherCanvas('nape', 12)); furCardTex.colorSpace = T.SRGBColorSpace;
  const gold = new T.MeshStandardMaterial({ color: 0xd9ac45, roughness: 0.35, metalness: 0.75 });
  const brass = new T.MeshStandardMaterial({ color: 0xc89a3a, roughness: 0.3, metalness: 0.85 });
  const strap = new T.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.6, map: leatherT });
  const thread = new T.MeshStandardMaterial({ color: 0xe9d8ae, roughness: 0.8 });

  const CRIM = hex(0x7e1d2a, T), CRIM2 = hex(0xa22a36, T), LEA = hex(0x8f5d2b, T), LEA2 = hex(0xc08a4c, T), LEA3 = hex(0x4e2f14, T), CREAM = hex(0xefe3cb, T), SIL = hex(0x9c9a98, T);
  // sleeve: padded, slightly gathered, ends under the fur cuff
  const sleeveSecs = [], N = 14;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), z = lerp(-2.6, -0.075, Math.pow(t, 0.7));
    const r = lerp(0.12, 0.066, Math.pow(t, 0.8)) * (1 + 0.04 * Math.sin(i * 2.1));
    sleeveSecs.push({ z, y: 0, rx: r * 1.02, ry: r * 0.96 });
  }
  const sleeve = new T.Mesh(loft(T, sleeveSecs, 28, (u, a) => {
    const lit = 0.5 + 0.5 * Math.cos(a - 0.6);
    return mix3(CRIM, CRIM2, lit * 0.55 + 0.1 * Math.sin(u * 14 + a * 3));
  }, [3, 3]), sleeveMat);
  sleeve.castShadow = true; sleeve.receiveShadow = true; root.add(sleeve);
  // gold braid bands round the sleeve
  for (const zb of [-0.2, -0.26]) {
    const r = lerp(0.1, 0.066, Math.pow((zb + 0.95) / 0.875, 0.8)) * 1.04;
    const ring = new T.Mesh(new T.TorusGeometry(r, 0.0065, 8, 40), gold); ring.position.z = zb; root.add(ring);
  }
  // fur cuff: a thick silver-fox ring with fur cards around it, two rows
  const cuff = new T.Mesh(loft(T, [
    { z: -0.185, y: 0, rx: 0.076, ry: 0.074 }, { z: -0.15, y: 0, rx: 0.097, ry: 0.095 }, { z: -0.1, y: 0, rx: 0.1, ry: 0.098 }, { z: -0.062, y: 0, rx: 0.09, ry: 0.088 },
  ], 28, (u, a) => mix3(CREAM, SIL, 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(a * 3 + u * 5))), [4, 1]), furBase);
  cuff.castShadow = true; root.add(cuff);
  const NF = 520, fg = new T.PlaneGeometry(0.024, 0.052, 1, 3); fg.translate(0, 0.026, 0);
  const furCards = new T.InstancedMesh(fg, new T.MeshStandardMaterial({ map: furCardTex, alphaTest: 0.4, side: T.DoubleSide, roughness: 1, color: 0xf3ead6 }), NF);
  const o = new T.Object3D(), col = new T.Color();
  for (let i = 0; i < NF; i++) {
    const row = i % 4, a = (i * 2.399) % (Math.PI * 2), z = [-0.18, -0.14, -0.1, -0.066][row] + ((i * 17) % 7) * 0.002, r = [0.082, 0.098, 0.1, 0.09][row];
    o.position.set(Math.sin(a) * r, Math.cos(a) * r, z);
    const dir = new T.Vector3(Math.sin(a) * 0.22, Math.cos(a) * 0.22, row < 2 ? -0.95 : 0.95).normalize();
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
    o.rotateY(((i * 53) % 10) / 10 * 3.0);
    o.scale.setScalar(0.85 + ((i * 29) % 9) / 16);
    o.updateMatrix(); furCards.setMatrixAt(i, o.matrix);
    col.setRGB(...mix3(mix3(CREAM, SIL, 0.35), hex(0x6f6860, T), ((i * 7) % 5) / 8)); furCards.setColorAt(i, col);
  }
  furCards.instanceMatrix.needsUpdate = true; furCards.castShadow = true; root.add(furCards);

  // gauntlet: flared cuff over the sleeve end, back of the hand, curled fingers
  const gSecs = [
    { z: -0.16, y: 0, rx: 0.075, ry: 0.072 }, { z: -0.1, y: 0, rx: 0.082, ry: 0.078 }, { z: -0.03, y: 0.002, rx: 0.072, ry: 0.066 },
    { z: 0.03, y: 0.006, rx: 0.062, ry: 0.052 }, { z: 0.09, y: 0.012, rx: 0.058, ry: 0.044 }, { z: 0.14, y: 0.006, rx: 0.052, ry: 0.04 },
    { z: 0.18, y: -0.012, rx: 0.042, ry: 0.034 }, { z: 0.205, y: -0.034, rx: 0.026, ry: 0.024 },
  ];
  const glove = new T.Mesh(loft(T, gSecs, 24, (u, a) => {
    const top = 0.5 + 0.5 * Math.cos(a);
    let c = mix3(LEA3, LEA, 0.4 + 0.6 * top);
    c = mix3(c, LEA2, top * 0.5 * Math.max(0, 1 - Math.abs(u - 0.55) * 3));
    return c;
  }, [3, 2]), leatherMat);
  glove.castShadow = true; glove.receiveShadow = true; root.add(glove);
  // thumb: a capsule along the left side, tucked
  const thumb = new T.Mesh(new T.CapsuleGeometry(0.02, 0.07, 6, 10), leatherMat);
  thumb.material = leatherMat; thumb.position.set(0.06, 0.0, 0.045); thumb.rotation.set(Math.PI / 2 - 0.35, 0, -0.35); thumb.castShadow = true; root.add(thumb);
  // finger seams (four dark grooves across the knuckles) and a stitched seam down the back of the cuff
  const grooveMat = new T.MeshBasicMaterial({ color: 0x2a1708 });
  for (let k = -1; k <= 1; k++) {
    const gr = new T.Mesh(new T.BoxGeometry(0.0035, 0.004, 0.075), grooveMat);
    gr.position.set(k * 0.019 - 0.004, 0.047, 0.15); gr.rotation.x = 0.0; root.add(gr);
  }
  const stitchN = 36, sg = new T.BoxGeometry(0.012, 0.003, 0.0035);
  const stitches = new T.InstancedMesh(sg, thread, stitchN * 2);
  for (let i = 0; i < stitchN; i++) {
    const z = -0.16 + (i / (stitchN - 1)) * 0.3;
    for (const side of [0, 1]) {
      const s = lerp(0.075, 0.062, (z + 0.16) / 0.3);
      o.position.set(side ? 0.0 : 0.0, 0, z); o.rotation.set(0, 0, 0);
      const a = side ? 0.0 : Math.PI; // top and bottom of the cuff
      o.position.set(0, Math.cos(a) * (s * 0.98 + 0.003), z);
      o.scale.set(1, 1, 1); o.updateMatrix(); stitches.setMatrixAt(i * 2 + side, o.matrix);
    }
  }
  stitches.visible = false; root.add(stitches);
  // the cuff edge: a ring of stitches
  const edge = new T.InstancedMesh(new T.BoxGeometry(0.004, 0.009, 0.003), thread, 40);
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2, r = 0.0805;
    o.position.set(Math.sin(a) * r, Math.cos(a) * r, -0.1 + 0.0); o.rotation.set(0, 0, -a); o.updateMatrix(); edge.setMatrixAt(i, o.matrix);
  }
  edge.visible = false;
  // jess: two thin straps from the bird's feet round the fist, with a brass swivel
  const jessGroup = new T.Group(); root.add(jessGroup);
  const swivel = new T.Mesh(new T.TorusGeometry(0.012, 0.0035, 8, 16), brass); swivel.position.set(0.035, 0.05, 0.08); swivel.rotation.set(0.6, 0.4, 0); jessGroup.add(swivel);
  const curve = new T.CatmullRomCurve3([new T.Vector3(0.035, 0.05, 0.08), new T.Vector3(0.06, 0.02, 0.1), new T.Vector3(0.05, -0.04, 0.14), new T.Vector3(-0.02, -0.06, 0.16), new T.Vector3(-0.055, -0.01, 0.12), new T.Vector3(-0.04, 0.04, 0.09)]);
  const jess = new T.Mesh(new T.TubeGeometry(curve, 30, 0.0035, 6, false), strap); jess.castShadow = true; jessGroup.add(jess);
  const curve2 = new T.CatmullRomCurve3([new T.Vector3(0.035, 0.05, 0.08), new T.Vector3(0.02, 0.07, 0.04), new T.Vector3(-0.01, 0.075, 0.0), new T.Vector3(-0.05, 0.06, -0.04)]);
  const leash = new T.Mesh(new T.TubeGeometry(curve2, 20, 0.0032, 6, false), strap); jessGroup.add(leash);

  // where a perched bird's toes meet the glove: on the knuckle ridge
  const perch = { x: 0.0, y: 0.062, z: 0.07 };
  return {
    root, perch,
    setPose({ t = 0, dip = 0, raise = 0 } = {}) {
      root.position.y = dip * -0.035 + raise * 0.02;
      root.rotation.x = Math.sin(t * 1.4) * 0.006 + dip * 0.04;
      root.rotation.z = Math.sin(t * 0.9 + 1) * 0.005;
    },
  };
}

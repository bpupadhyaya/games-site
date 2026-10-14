// The poi: a red plastic ring with a sheet of washi stretched across it, and a short bamboo-coloured handle. The paper soaks (goes
// translucent and blue-grey, sags into a bowl under its own wet weight and the fish), wears (fibres, cracks from the rim, ragged
// holes) and shows the load of a scoop by sagging deeper. Local frame: ring centre at the origin, +z = toward the player.
import * as THREE from '../vendor3d/three.js';
import { TAU, hash, drawPaper, mk } from './tex.js';
import { POI_R } from '../src/sim.js';

export const POI_RM = POI_R * 0.001;   // 0.074 m
export function createPoi() {
  const g = new THREE.Group();
  const R = POI_RM;
  const ringMat = new THREE.MeshPhysicalMaterial({ color: 0xd8301f, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, metalness: 0 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.0034, 10, 56), ringMat);
  ring.rotation.x = Math.PI / 2; ring.castShadow = true; g.add(ring);
  // inner white lip that the paper is glued to
  const lip = new THREE.Mesh(new THREE.TorusGeometry(R - 0.0042, 0.0016, 8, 56), new THREE.MeshStandardMaterial({ color: 0xf1ead8, roughness: 0.7 }));
  lip.rotation.x = Math.PI / 2; g.add(lip);
  // handle: a flat bamboo-coloured stick from the ring toward the player, with a small ferrule
  const hmat = new THREE.MeshStandardMaterial({ color: 0xd9bd84, roughness: 0.55, metalness: 0 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0062, 0.17, 10), hmat);
  handle.rotation.x = Math.PI / 2; handle.position.set(0, 0.0012, R + 0.085); handle.castShadow = true; g.add(handle);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.02, 12), ringMat);
  cap.rotation.x = Math.PI / 2; cap.position.set(0, 0.0012, R + 0.012); g.add(cap);
  // paper: a disc grid whose height field is the sag
  const NR = 7, NA = 40;
  const pos = new Float32Array((NR * NA + 1) * 3), uv = new Float32Array((NR * NA + 1) * 2), idx = [];
  uv[0] = uv[1] = 0.5;
  for (let r = 0; r < NR; r++) for (let a = 0; a < NA; a++) {
    const n = 1 + r * NA + a, rr = (r + 1) / NR, ang = (a / NA) * TAU;
    uv[n * 2] = 0.5 + Math.cos(ang) * rr * 0.5; uv[n * 2 + 1] = 0.5 - Math.sin(ang) * rr * 0.5;
  }
  for (let a = 0; a < NA; a++) idx.push(0, 1 + a, 1 + ((a + 1) % NA));
  for (let r = 0; r < NR - 1; r++) for (let a = 0; a < NA; a++) {
    const a0 = 1 + r * NA + a, a1 = 1 + r * NA + ((a + 1) % NA), b0 = a0 + NA, b1 = a1 + NA;
    idx.push(a0, b0, a1, a1, b0, b1);
  }
  const geo = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(pos, 3); attr.setUsage(35048);
  geo.setAttribute('position', attr); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
  const cv = mk(256, 256); drawPaper(cv, 1, 0, 1);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const paperMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, roughness: 0.78, metalness: 0, opacity: 0.94, depthWrite: false });
  const paper = new THREE.Mesh(geo, paperMat); paper.renderOrder = 3; paper.frustumCulled = false; paper.castShadow = false; g.add(paper);

  const st = { paper: 1, wet: 0, seed: 1, sag: 0, drawn: { p: -1, w: -1, s: -1 }, t: 0 };
  function setSag(sag, wet, tm) {
    st.sag = sag;
    pos[0] = 0; pos[1] = -sag; pos[2] = 0;
    const R2 = R - 0.0045;
    for (let r = 0; r < NR; r++) for (let a = 0; a < NA; a++) {
      const n = (1 + r * NA + a) * 3, rr = (r + 1) / NR, ang = (a / NA) * TAU;
      // paraboloid sag + soft wrinkles that grow with wetness
      const wr = Math.sin(ang * 5 + rr * 4 + tm * 0.8) * 0.0009 * wet * rr + Math.sin(ang * 3 - rr * 6) * 0.0006 * wet * rr;
      pos[n] = Math.cos(ang) * R2 * rr; pos[n + 1] = -sag * (1 - rr * rr) + wr; pos[n + 2] = Math.sin(ang) * R2 * rr;
    }
    attr.needsUpdate = true; geo.computeVertexNormals();
  }
  setSag(0.002, 0, 0);
  return {
    group: g, ring, paper, paperMat,
    // paper 1..0, wet 0..1, load 0..1+ (weight of the fish on it), seed: which sheet
    set(paperV, wet, load, seed, tm) {
      const sag = 0.0015 + 0.006 * wet + 0.03 * Math.min(1, load) + 0.004 * (1 - paperV);
      setSag(sag, wet, tm);
      const q = (v, n) => Math.round(v * n) / n;
      if (q(paperV, 24) !== st.drawn.p || q(wet, 16) !== st.drawn.w || seed !== st.drawn.s) {
        st.drawn = { p: q(paperV, 24), w: q(wet, 16), s: seed };
        drawPaper(cv, paperV, wet, seed + 1); tex.needsUpdate = true;
      }
      paperMat.opacity = 0.96 - 0.38 * wet - 0.12 * (1 - paperV);
    },
    dispose() { geo.dispose(); tex.dispose(); paperMat.dispose(); },
  };
}
export { hash };

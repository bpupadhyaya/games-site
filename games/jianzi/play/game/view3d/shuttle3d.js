// The jianzi shuttle at real scale: a brass coin base (about 4 cm across) with a lead-and-rubber sleeve and a fan of goose feathers
// (about 6.5 cm). Drawn at 1.25 x real size (the stated maximum for readability). Feathers flutter on their own phases, the plume
// closes up and trails the coin while it travels fast, and the whole thing spins slowly about its axis as it falls (the quills are
// set at a slight twist, which is why a real shuttle turns in the air). The simulation owns the position and tumble angle.
import { SHUTTLES } from '../src/art.js';

export const REAL = { coinDia: 0.042, plume: 0.065, scale: 1.25 };

const TAU = Math.PI * 2;
const NF = 7;                       // feathers in the fan

function featherGeometry(THREE, L, W, color0, color1, tip) {
  const rows = 9;
  const pos = [], col = [], idx = [];
  const c0 = new THREE.Color(color0), c1 = new THREE.Color(color1), ct = new THREE.Color(tip);
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    const w = W * (0.35 + 0.65 * Math.sin(Math.PI * Math.pow(t, 0.7)) * (1 - 0.25 * t)) * (t < 0.04 ? 0.2 : 1);
    const y = t * L, curl = 0.18 * w;           // the vane curls a little toward the viewer side
    pos.push(-w, y, curl, 0, y, 0, w, y, curl);
    const c = t < 0.6 ? c0.clone().lerp(c1, t / 0.6) : c1.clone().lerp(ct, (t - 0.6) / 0.4);
    // the rachis (centre) is a little lighter and the vane edges a little darker
    const m = c.clone().multiplyScalar(0.88), cc = c.clone().lerp(new THREE.Color('#ffffff'), 0.18);
    col.push(m.r, m.g, m.b, cc.r, cc.g, cc.b, m.r, m.g, m.b);
  }
  for (let r = 0; r < rows; r++) {
    const a = r * 3;
    idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function createShuttle(THREE) {
  const root = new THREE.Group(); root.name = 'jianzi-shuttle';
  const spin = new THREE.Group(); root.add(spin);               // turns about the shuttle's own axis
  const body = new THREE.Group(); spin.add(body);
  const S = REAL.scale;
  // coin base: brass disc with a square hole, a rim, and a lead/rubber sleeve that holds the quills
  const brass = new THREE.MeshStandardMaterial({ color: '#c9973f', roughness: 0.32, metalness: 0.85 });
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(REAL.coinDia / 2, REAL.coinDia / 2, 0.006, 28), brass); coin.position.y = 0.003; body.add(coin);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(REAL.coinDia / 2 - 0.001, 0.0022, 6, 28), brass); rim.rotation.x = Math.PI / 2; rim.position.y = 0.006; body.add(rim);
  const holeM = new THREE.MeshStandardMaterial({ color: '#241608', roughness: 0.9 });
  const hole = new THREE.Mesh(new THREE.BoxGeometry(0.0095, 0.0068, 0.0095), holeM); hole.position.y = 0.0032; body.add(hole);
  const sleeveM = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.6 });
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0105, 0.02, 14), sleeveM); sleeve.position.y = 0.016; body.add(sleeve);
  // the coin's underside gets a second, darker disc so the base reads as a lump of metal, not paper
  const under = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.008, 18), new THREE.MeshStandardMaterial({ color: '#8c6a2c', roughness: 0.5, metalness: 0.7 })); under.position.y = -0.003; body.add(under);

  const feathers = [];
  let design = -1;
  const featherMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, side: THREE.DoubleSide, transparent: false });
  function rebuild(i) {
    design = i;
    const d = SHUTTLES[i] || SHUTTLES[0];
    feathers.forEach((f) => { body.remove(f.pivot); f.mesh.geometry.dispose(); });
    feathers.length = 0;
    for (let k = 0; k < NF; k++) {
      const col = d.mix ? d.mix[k % d.mix.length] : d.f[0];
      const g = featherGeometry(THREE, REAL.plume * (0.94 + 0.12 * ((k * 37) % 5) / 4), 0.0105, d.mix ? col : d.f[1], col, d.tip);
      const mesh = new THREE.Mesh(g, featherMat);
      const pivot = new THREE.Group();
      const az = (k / NF) * TAU;
      pivot.position.y = 0.024;
      pivot.rotation.set(0, az, 0);
      const tilt = new THREE.Group(); tilt.add(mesh); pivot.add(tilt);
      // the blade's width runs tangentially; tilt.rotation.x leans it outward
      mesh.rotation.y = 0.28;     // quill twist
      body.add(pivot);
      feathers.push({ pivot, tilt, mesh, k, ph: k * 1.7 + 0.4 });
    }
    sleeveM.color.set(d.coin === '#b9833e' ? '#c0392b' : d.tip);
    brass.color.set(d.coin);
  }
  rebuild(0);
  root.scale.setScalar(S);

  const out = { root, get design() { return design; } };
  const st = { spin: 0, wob: 0 };
  /** sh = the simulation's shuttle { x, y, z, vx, vy, vz, ang, av }, t = game seconds, dt = frame dt. */
  out.update = (sh, t, dt, designIdx) => {
    if (designIdx !== design && designIdx != null) rebuild(designIdx);
    root.position.set(sh.x, Math.max(0.0, sh.y) + 0.0, -sh.z);
    const speed = Math.hypot(sh.vx || 0, sh.vy || 0, sh.vz || 0);
    const k = Math.min(1, speed / 6);                        // 0 hanging in air, 1 just kicked
    // tumble angle from the sim (feathers trail away from the direction of travel); 2D rotate(+a) is clockwise, so -a about +z
    root.rotation.set(0, 0, -sh.ang);
    st.spin += dt * (0.9 + 5.5 * Math.min(1, Math.abs(sh.vy || 0) / 2.2) + 7 * k);
    spin.rotation.y = st.spin;
    // a small precession wobble about the axis, stronger right after the kick
    st.wob += dt * (6 + 10 * k);
    body.rotation.set(0.05 * Math.sin(st.wob) * (0.4 + k), 0, 0.05 * Math.cos(st.wob * 0.8) * (0.4 + k));
    // feathers: the plume spreads in slow air and closes up when it travels fast; every quill flutters on its own phase
    const open = 0.5 - 0.28 * k;                               // radians from the axis
    for (const f of feathers) {
      const fl = Math.sin(t * (13 + 2 * f.k) + f.ph) * (0.035 + 0.12 * k) + Math.sin(t * 5.1 + f.ph * 2) * 0.03;
      f.tilt.rotation.x = open + fl;
      f.tilt.rotation.z = Math.sin(t * 9 + f.ph) * 0.05 * (0.4 + k);
    }
  };
  out.dispose = () => { feathers.forEach((f) => f.mesh.geometry.dispose()); };
  return out;
}

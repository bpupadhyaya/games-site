// Tractor Pull 3D: the four rigs, the sled and the driver as real lit 3D models (presentation only, reads numbers).
// Local frame of a rig: +x forward (right on screen), +y up, +z towards the camera, rear axle at x = 0. Units are the 2D art's units
// (the rig group is scaled by the look's size factor so the sizes on screen match the 2D layout the HUD was built for).
import { THREE, board3d as B } from '../vendor3d/index.js';

const { Group, Mesh, Shape, ExtrudeGeometry, LatheGeometry, CylinderGeometry, BoxGeometry, SphereGeometry, CapsuleGeometry, TorusGeometry,
  MeshStandardMaterial: MS, MeshPhysicalMaterial: MP, MeshBasicMaterial: MB, InstancedMesh, Object3D, Vector3, Quaternion, Euler, Matrix4, CanvasTexture } = THREE;
const TAU = Math.PI * 2;
const V = (x, y, z) => new Vector3(x, y, z);

// ---- shared textures ---------------------------------------------------------------------------------------------------------------
const hazardTex = (() => {
  let t = null;
  return () => {
    if (t) return t;
    const c = globalThis.document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#3a414b'; g.fillRect(0, 0, 256, 128);
    // brushed steel plates with bolts
    for (let i = 0; i < 4; i++) { g.fillStyle = `rgba(255,255,255,${0.05 + i * 0.015})`; g.fillRect(6, 6 + i * 20, 244, 16); }
    g.fillStyle = '#1a1a1a'; g.fillRect(0, 88, 256, 40);
    for (let i = -2; i < 20; i++) { g.fillStyle = i % 2 ? '#f5c518' : '#171717'; g.beginPath(); g.moveTo(i * 24, 128); g.lineTo(i * 24 + 24, 128); g.lineTo(i * 24 + 44, 88); g.lineTo(i * 24 + 20, 88); g.fill(); }
    g.fillStyle = '#aab2bb'; for (let i = 0; i < 8; i++) for (const y of [10, 66]) { g.beginPath(); g.arc(16 + i * 32, y, 3, 0, TAU); g.fill(); }
    t = new CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  };
})();

const mats = (look) => ({
  paint: new MP({ color: look.body, metalness: 0.3, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.14 }),
  paintDark: new MS({ color: look.dark, metalness: 0.35, roughness: 0.5 }),
  trim: new MS({ color: look.trim, metalness: 0.1, roughness: 0.5 }),
  steel: new MS({ color: '#8a929b', metalness: 0.85, roughness: 0.42 }),
  steelDark: new MS({ color: '#3b4048', metalness: 0.8, roughness: 0.5 }),
  chrome: new MS({ color: '#f0f3f6', metalness: 1, roughness: 0.1 }),
  rubber: new MS({ color: '#16120f', roughness: 0.92 }),
  rim: new MS({ color: look.rim, metalness: 0.75, roughness: 0.32 }),
  black: new MS({ color: '#14161a', roughness: 0.7, metalness: 0.3 }),
  glass: new MP({ color: '#a9d6ea', metalness: 0, roughness: 0.04, transparent: true, opacity: 0.36, depthWrite: false }),
  lamp: new MB({ color: '#fff4c4' }),
  skin: new MS({ color: '#d9a982', roughness: 0.7 }),
  suit: new MS({ color: '#b83a26', roughness: 0.8 }),
  suitDark: new MS({ color: '#7e2417', roughness: 0.8 }),
  glove: new MS({ color: '#1b1b1d', roughness: 0.6 }),
  visor: new MP({ color: '#0e1722', metalness: 0.6, roughness: 0.08, clearcoat: 1 }),
});
const cast = (o, on = true) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = on; m.receiveShadow = true; } }); return o; };

// ---- tyres and wheels ---------------------------------------------------------------------------------------------------------------
function tyre(R, w, m, { slick = false, lugs = 22 } = {}) {
  const g = new Group();
  const pts = [[0.56, -0.5], [0.8, -0.5], [0.92, -0.46], [0.97, -0.34], [0.985, -0.16], [0.985, 0.16], [0.97, 0.34], [0.92, 0.46], [0.8, 0.5], [0.56, 0.5]]
    .map(([r, y]) => new THREE.Vector2(r * R, y * w));
  const carcass = new Mesh(new LatheGeometry(pts, 48), m.rubber); carcass.rotation.x = Math.PI / 2; g.add(carcass);
  // sidewall ring highlight (raised lettering band)
  const ring = new Mesh(new TorusGeometry(R * 0.8, w * 0.03, 6, 48), new MS({ color: '#2a2521', roughness: 0.8 }));
  const ring2 = ring.clone(); ring.position.z = w * 0.5; ring2.position.z = -w * 0.5; g.add(ring, ring2);
  if (!slick) {
    const lh = R * 0.15, lw = R * 0.2, n = lugs;
    const geo = new BoxGeometry(lh, lw, w * 0.56);
    const inst = new InstancedMesh(geo, m.rubber, n * 2);
    const o = new Object3D(); let k = 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      for (const s of [-1, 1]) {
        o.position.set(Math.cos(a) * R * 0.985, Math.sin(a) * R * 0.985, s * w * 0.25);
        o.rotation.set(s * 0.5, 0, a); o.rotation.order = 'ZXY';
        o.updateMatrix(); inst.setMatrixAt(k++, o.matrix);
      }
    }
    inst.castShadow = true; g.add(inst);
  } else {
    // slick: shallow grooves
    for (let i = -2; i <= 2; i++) { const t = new Mesh(new TorusGeometry(R * 0.985, w * 0.018, 5, 56), m.black); t.position.z = i * w * 0.17; g.add(t); }
  }
  // dished steel rim
  const rp = [[0.0, 0.3], [0.16, 0.3], [0.22, 0.22], [0.48, 0.3], [0.58, 0.4], [0.6, 0.0], [0.58, -0.4], [0.48, -0.3], [0.22, -0.22], [0.16, -0.3], [0.0, -0.3]].map(([r, y]) => new THREE.Vector2(r * R, y * w));
  const rim = new Mesh(new LatheGeometry(rp, 36), m.rim); rim.rotation.x = Math.PI / 2; g.add(rim);
  // bolt circle + hub cap (the cap carries the rig colour so the spin reads)
  const bolt = new InstancedMesh(new CylinderGeometry(R * 0.035, R * 0.035, w * 0.08, 8), m.steelDark, 8);
  const o2 = new Object3D();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; o2.position.set(Math.cos(a) * R * 0.36, Math.sin(a) * R * 0.36, w * 0.34); o2.rotation.set(Math.PI / 2, 0, 0); o2.updateMatrix(); bolt.setMatrixAt(i, o2.matrix); }
  g.add(bolt);
  const cap = new Mesh(new SphereGeometry(R * 0.17, 20, 12, 0, TAU, 0, Math.PI / 2), m.paint); cap.rotation.x = Math.PI / 2; cap.position.z = w * 0.3; g.add(cap);
  const capB = cap.clone(); capB.rotation.x = -Math.PI / 2; capB.position.z = -w * 0.3; g.add(capB);
  // two offset marks on the rim so the spin is visible
  const mark = new Mesh(new BoxGeometry(R * 0.2, R * 0.05, w * 0.05), m.black); mark.position.set(R * 0.44, 0, w * 0.37); g.add(mark);
  return g;
}

// ---- 2-bone IK for the driver (positions only; limb lengths are constant so the capsules never stretch) ---------------------------
function ik(A, C, l1, l2, pole) {
  const d = C.clone().sub(A); let len = d.length();
  const max = (l1 + l2) * 0.999; if (len > max) { d.multiplyScalar(max / len); len = max; }
  const dir = d.clone().normalize();
  const a = (l1 * l1 - l2 * l2 + len * len) / (2 * len), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const B2 = A.clone().add(dir.clone().multiplyScalar(a)).add(p.multiplyScalar(h));
  return { B: B2, C: A.clone().add(d) };
}
const Y = V(0, 1, 0);
function limbMesh(r, len, mat) {
  const m = new Mesh(new CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 4, 10), mat); m.castShadow = true; return m;
}
function placeLimb(mesh, a, b) {
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Y, b.clone().sub(a).normalize());
}

// ---- the rig ---------------------------------------------------------------------------------------------------------------------------
export function buildRig(look) {
  const m = mats(look);
  const root = new Group();            // placed at the rear axle's ground point, scaled by look.s
  const body = new Group();            // pitched about the rear axle (nose lift)
  root.add(body);
  const Rr = look.rr, Rf = look.fr, wb = look.hood + 0.35;
  const hoodTop = Rr * 0.9 + 0.35, hoodBot = Rf * 0.75 + 0.15;
  const rearW = look.slick ? 0.62 : 0.5, frontW = 0.3;
  const wheels = [];                   // groups spun by the sim's wheel angle
  const rearZ = look.slick ? 0.72 : 0.62;

  // rear tyres (near and far side, and duals on the heavy rig)
  const addRear = (z, R, w) => { const t = tyre(R, w, m, { slick: look.slick, lugs: 24 }); t.position.set(0, Rr, z); body.add(t); wheels.push({ g: t, k: 1 }); };
  addRear(rearZ, Rr, rearW); addRear(-rearZ, Rr, rearW);
  if (look.dual) { addRear(rearZ + rearW * 0.95, Rr, rearW); addRear(-rearZ - rearW * 0.95, Rr, rearW); }
  // rear axle
  const axle = new Mesh(new CylinderGeometry(0.1, 0.1, rearZ * 2 + 0.2, 14), m.steelDark); axle.rotation.x = Math.PI / 2; axle.position.set(0, Rr, 0); body.add(axle);
  // front tyres
  const fz = 0.58;
  for (const z of [fz, -fz]) { const t = tyre(Rf, frontW, m, { slick: false, lugs: 16 }); t.position.set(wb + 0.2, Rf, z); body.add(t); wheels.push({ g: t, k: 0.9 }); }
  const faxle = new Mesh(new CylinderGeometry(0.07, 0.07, fz * 2, 12), m.steelDark); faxle.rotation.x = Math.PI / 2; faxle.position.set(wb + 0.2, Rf, 0); body.add(faxle);

  // engine block + chassis rail (visible below the hood)
  const blk = new Mesh(B.roundedBox(wb + 0.3, hoodBot - 0.1, 0.62, 0.05, 3), m.steelDark); blk.position.set((wb + 0.3) / 2 + 0.05, (hoodBot - 0.1) / 2 + 0.12, 0); body.add(blk);
  const rail = new Mesh(new BoxGeometry(wb + 0.4, 0.1, 0.9), m.black); rail.position.set((wb + 0.4) / 2 - 0.05, 0.2, 0); body.add(rail);

  // hood: extruded side profile with a bevel
  const sh = new Shape();
  sh.moveTo(0.3, hoodBot - 0.05); sh.lineTo(0.3, hoodTop + 0.35); sh.lineTo(wb - 0.35, hoodTop + 0.28);
  sh.quadraticCurveTo(wb + 0.35, hoodTop + 0.2, wb + 0.4, hoodTop - 0.35); sh.lineTo(wb + 0.42, hoodBot - 0.05); sh.closePath();
  const hg = new ExtrudeGeometry(sh, { depth: 0.66, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 4, curveSegments: 14 });
  hg.translate(0, 0, -0.33);
  const hood = new Mesh(hg, m.paint); body.add(hood);
  // stripe band, side vents, lamps, grille
  const stripe = new Mesh(new BoxGeometry(wb + 0.05, 0.1, 0.9), m.trim); stripe.position.set(0.3 + (wb + 0.05) / 2, hoodTop - 0.02, 0); body.add(stripe);
  for (const z of [0.425, -0.425]) for (let i = 0; i < 5; i++) { const v = new Mesh(new BoxGeometry(0.05, 0.3, 0.02), m.black); v.position.set(0.7 + i * 0.12, hoodTop + 0.14, z); body.add(v); }
  const grille = new Mesh(new BoxGeometry(0.05, 0.5, 0.56), m.black); grille.position.set(wb + 0.5, hoodBot + 0.25, 0); body.add(grille);
  for (let i = 0; i < 4; i++) { const sl = new Mesh(new BoxGeometry(0.06, 0.04, 0.6), m.chrome); sl.position.set(wb + 0.53, hoodBot + 0.08 + i * 0.12, 0); body.add(sl); }
  const lamps = [];
  for (const z of [0.3, -0.3]) { const l = new Mesh(new SphereGeometry(0.1, 14, 10), m.lamp); l.position.set(wb + 0.4, hoodTop - 0.2, z); l.scale.set(0.6, 1, 1); body.add(l); lamps.push(l); }
  if (look.s > 0.8) { const wt = new Mesh(B.roundedBox(0.3, 0.55, 0.64, 0.04, 3), m.steel); wt.position.set(wb + 0.7, hoodBot + 0.28, 0); body.add(wt); }

  // fenders over the rear tyres
  const fend = (z, wdt) => {
    const s2 = new Shape(); const Ro = Rr * 1.13, Ri = Rr * 1.07;
    s2.absarc(0, 0, Ro, 0.05, Math.PI * 0.97, false); s2.absarc(0, 0, Ri, Math.PI * 0.97, 0.05, true);
    const g = new ExtrudeGeometry(s2, { depth: wdt, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 28 });
    const f = new Mesh(g, m.paint); f.position.set(0, Rr, z - wdt / 2); body.add(f);
  };
  fend(rearZ, rearW + 0.14); fend(-rearZ, rearW + 0.14);

  // exhaust stacks (chrome pipes with an open, slightly flared top)
  const stackTops = [];
  for (let i = 0; i < look.stacks; i++) {
    const sx = wb - 0.5 - i * 0.28, sh2 = 1.65 + (look.slick ? 0.35 : 0.6) + i * 0.05, topY = hoodTop + sh2 * 0.62 + (look.slick ? 0.35 : 0.2);
    const baseY = hoodTop + 0.25, len = topY - baseY;
    const pipe = new Mesh(new CylinderGeometry(0.075, 0.07, len, 14), m.chrome); pipe.position.set(sx, baseY + len / 2, (i % 2 ? -0.12 : 0.12)); body.add(pipe);
    const flare = new Mesh(new CylinderGeometry(0.105, 0.075, 0.12, 14, 1, true), m.chrome); flare.position.set(sx, topY, pipe.position.z); body.add(flare);
    stackTops.push(V(sx, topY + 0.05, pipe.position.z));
  }
  // pulling-class blower scoop on the slick rig
  if (look.slick) {
    const blower = new Mesh(B.roundedBox(0.7, 0.34, 0.5, 0.08, 4), m.chrome); blower.position.set(wb * 0.55 + 0.2, hoodTop + 0.55, 0); body.add(blower);
    const scoop = new Mesh(new CylinderGeometry(0.17, 0.19, 0.42, 20, 1, true), m.black); scoop.position.set(wb * 0.55 + 0.2, hoodTop + 0.92, 0); body.add(scoop);
    // wheelie bars
    for (const z of [0.45, -0.45]) {
      const bar = new Mesh(new BoxGeometry(1.3, 0.06, 0.06), m.chrome); bar.position.set(-1.3, 0.62, z); bar.rotation.z = 0.35; body.add(bar);
      const wh = new Mesh(new CylinderGeometry(0.14, 0.14, 0.1, 14), m.rubber); wh.rotation.x = Math.PI / 2; wh.position.set(-1.88, 0.22, z); body.add(wh);
    }
  }

  // cab or roll cage
  const hxD = look.cab ? 0.0 : 0.12;
  const seatY = look.cab ? hoodTop + 0.34 : 2 * Rr - 0.16;
  if (look.cab) {
    const cabBase = hoodTop - 0.05;
    for (const [x, z] of [[-0.6, 0.45], [-0.6, -0.45], [0.62, 0.45], [0.62, -0.45]]) { const p = new Mesh(new BoxGeometry(0.07, 1.5, 0.07), m.paintDark); p.position.set(x, cabBase + 0.75, z); body.add(p); }
    const roof = new Mesh(B.roundedBox(1.6, 0.14, 1.08, 0.05, 3), m.paint); roof.position.set(0.0, cabBase + 1.52, 0); body.add(roof);
    const floor = new Mesh(new BoxGeometry(1.3, 0.08, 0.9), m.paintDark); floor.position.set(0, cabBase + 0.04, 0); body.add(floor);
    const gl = new Mesh(new BoxGeometry(1.24, 1.34, 0.9), m.glass); gl.position.set(0, cabBase + 0.78, 0); body.add(gl);
    for (const x of [-0.55, 0.55]) { const lt = new Mesh(new SphereGeometry(0.07, 10, 8), m.lamp); lt.position.set(x, cabBase + 1.62, 0.3); body.add(lt); lamps.push(lt); }
  } else {
    // roll bar (dark paint) and a seat
    for (const z of [0.3, -0.3]) { const p = new Mesh(new CylinderGeometry(0.04, 0.04, 1.15, 10), m.paintDark); p.position.set(-0.32, seatY + 0.6, z); body.add(p); }
    const top = new Mesh(new BoxGeometry(0.1, 0.07, 0.68), m.paintDark); top.position.set(-0.32, seatY + 1.18, 0); body.add(top);
  }
  const seat = new Mesh(B.roundedBox(0.5, 0.14, 0.5, 0.05, 3), m.black); seat.position.set(hxD - 0.1, seatY - 0.1, 0); body.add(seat);
  const back = new Mesh(B.roundedBox(0.1, 0.5, 0.46, 0.04, 3), m.black); back.position.set(hxD - 0.38, seatY + 0.2, 0); back.rotation.z = -0.12; body.add(back);

  // drawbar + hitch
  const bar = new Mesh(new BoxGeometry(1.6, 0.14, 0.22), m.steelDark); bar.position.set(-0.7, 0.55, 0); body.add(bar);
  const pin = new Mesh(new CylinderGeometry(0.07, 0.07, 0.3, 12), new MS({ color: '#cfa04a', metalness: 0.8, roughness: 0.3 })); pin.position.set(-1.4, 0.55, 0); body.add(pin);

  // steering wheel
  const sw = new Mesh(new TorusGeometry(0.17, 0.025, 8, 20), m.black); sw.position.set(hxD + 0.46, seatY + 0.62, 0); sw.rotation.y = Math.PI / 2; sw.rotation.x = 0.0; body.add(sw);
  sw.rotation.set(0, Math.PI / 2, 0); sw.rotation.z = 0.0;
  const sc = new Mesh(new CylinderGeometry(0.025, 0.025, 0.55, 8), m.black); sc.position.set(hxD + 0.58, seatY + 0.4, 0); sc.rotation.z = 0.7; body.add(sc);

  // ---- the driver: helmet with a visor, coveralls, gloves; hands stay on the wheel, the torso rocks with the pull
  const dr = new Group(); body.add(dr);
  const pelvis = V(hxD - 0.14, seatY + 0.1, 0);
  const torsoLen = 0.52;
  const torso = new Group(); torso.position.copy(pelvis); dr.add(torso);
  const chest = new Mesh(B.roundedBox(0.3, torsoLen + 0.12, 0.42, 0.1, 4), m.suit); chest.position.set(0, torsoLen / 2, 0); torso.add(chest);
  const neck = new Mesh(new CylinderGeometry(0.06, 0.07, 0.1, 10), m.skin); neck.position.set(0, torsoLen + 0.08, 0); torso.add(neck);
  const head = new Group(); head.position.set(0.02, torsoLen + 0.22, 0); torso.add(head);
  const face = new Mesh(new SphereGeometry(0.115, 18, 14), m.skin); head.add(face);
  const shell = new Mesh(new SphereGeometry(0.155, 22, 16, 0, TAU, 0, Math.PI * 0.68), m.paint); shell.position.y = 0.01; shell.rotation.y = 0; head.add(shell);
  const vis = new Mesh(new BoxGeometry(0.1, 0.075, 0.2), m.visor); vis.position.set(0.1, 0.02, 0); head.add(vis);
  const chin = new Mesh(new BoxGeometry(0.12, 0.06, 0.2), m.paintDark); chin.position.set(0.07, -0.1, 0); head.add(chin);
  const arms = [], legs = [];
  const SH = (z) => V(0.0, torsoLen - 0.06, z * 0.9);
  for (const z of [0.2, -0.2]) {
    const up = limbMesh(0.055, 0.29, m.suit), lo = limbMesh(0.05, 0.27, m.suit), hand = new Mesh(new SphereGeometry(0.058, 12, 10), m.glove);
    dr.add(up, lo, hand); arms.push({ up, lo, hand, z, l1: 0.29, l2: 0.27 });
  }
  for (const z of [0.12, -0.12]) {
    const th = limbMesh(0.085, 0.43, m.suitDark), sn = limbMesh(0.065, 0.42, m.suitDark), shoe = new Mesh(B.roundedBox(0.24, 0.1, 0.12, 0.03, 2), m.black);
    dr.add(th, sn, shoe); legs.push({ th, sn, shoe, z, l1: 0.43, l2: 0.42 });
  }
  const wheelGrip = (z) => V(hxD + 0.46, seatY + 0.62 + (z > 0 ? 0.1 : -0.1) * 0, z > 0 ? 0.15 : -0.15);
  const tmpQ = new Quaternion(), tmpV = new Vector3();
  const poseDriver = (lean, bob) => {
    torso.rotation.z = -lean;            // lean > 0 pitches the torso back
    torso.position.set(pelvis.x, pelvis.y + bob, pelvis.z);
    head.rotation.z = lean * 0.4 - bob * 3;
    torso.updateMatrix();
    for (const a of arms) {
      const s = SH(a.z).applyMatrix4(torso.matrix);
      const hand = wheelGrip(a.z), r = ik(s, hand, a.l1, a.l2, V(0.1, -1, a.z * 3));
      placeLimb(a.up, s, r.B); placeLimb(a.lo, r.B, r.C); a.hand.position.copy(r.C);
    }
    for (const l of legs) {
      const hip = V(pelvis.x + 0.03, pelvis.y + 0.02 + bob * 0.3, l.z), foot = V(hxD + 0.5, seatY - 0.34 - (look.cab ? 0.05 : 0.02), l.z * 1.3);
      const r = ik(hip, foot, l.l1, l.l2, V(0.05, 1, 0));
      placeLimb(l.th, hip, r.B); placeLimb(l.sn, r.B, r.C); l.shoe.position.set(r.C.x + 0.07, r.C.y - 0.03, r.C.z);
    }
  };
  poseDriver(0, 0);
  cast(root);
  for (const l of lamps) l.castShadow = false;

  // exposed anchors (rig-local) for effects
  return {
    root, body, wheels, stackTops, lamps, hoodTop, rearZ, Rr, Rf, wb, driver: { pose: poseDriver },
    // p: pull state; t: world clock; returns nothing; applies spin, nose lift, bounce and the driver's motion
    update(p, t, dt, ground) {
      const lift = Math.max(0, p.lift) * 0.2;
      const run = p.phase === 'run';
      const bounce = (run ? Math.sin(t * (14 + p.v * 3)) * 0.012 * Math.min(1, p.v) : Math.sin(t * 30) * 0.004) * (0.7 + 0.5 * (p.rpm || 0));
      // the whole rig pitches about the rear axle's contact patch
      body.rotation.z = lift; body.position.y = bounce;
      for (const w of wheels) w.g.rotation.z = -p.wheel * w.k;
      // tyres squash a little under load (rear), wider footprint when digging
      const sq = 1 - 0.035 * Math.min(1, p.dig || 0) - 0.02 * Math.min(1, p.thr || 0);
      for (let i = 0; i < wheels.length - 2; i++) wheels[i].g.scale.set(1, sq, 1);
      const lean = 0.05 + Math.min(0.5, (p.thr || 0) * 0.16 + Math.max(0, p.lift) * 0.55 + (p.shiftT > 0 ? 0.06 : 0));
      const bob = Math.sin(t * 22) * 0.008 * (0.5 + (p.rpm || 0)) + (p.lift > 0.05 ? 0.012 * p.lift : 0);
      poseDriver(lean, bob);
      // lamps glow at dusk and night
      for (const l of lamps) l.material.color.set(ground && ground.lamp ? '#fffbe0' : '#ece6c0');
      void dt;
    },
  };
}

// ---- the sled ----------------------------------------------------------------------------------------------------------------------------
export function buildSled() {
  const g = new Group();
  const len = 6.2;
  const steel = new MS({ color: '#a2abb5', metalness: 0.85, roughness: 0.38 });
  const dark = new MS({ color: '#4a525c', metalness: 0.8, roughness: 0.5 });
  const rubber = new MS({ color: '#15110e', roughness: 0.9 });
  const beam = new Mesh(B.roundedBox(len, 0.5, 1.6, 0.05, 3), steel); beam.position.set(-len / 2, 0.7, 0); g.add(beam);
  for (const z of [0.55, -0.55]) { const r = new Mesh(new BoxGeometry(len - 0.6, 0.1, 0.12), dark); r.position.set(-len / 2 - 0.1, 1.0, z); g.add(r); }
  // front pan (skid plate)
  const sh = new Shape(); sh.moveTo(0, 0.95); sh.lineTo(0.35, 0.5); sh.lineTo(0.45, 0.05); sh.lineTo(-1.8, 0.05); sh.lineTo(-1.8, 0.45); sh.closePath();
  const pg = new ExtrudeGeometry(sh, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 }); pg.translate(0, 0, -0.75);
  const pan = new Mesh(pg, dark); g.add(pan);
  // rear wheels (two pairs)
  for (const wx of [-len + 0.9, -len + 1.8]) for (const z of [0.78, -0.78]) {
    const t = new Mesh(new CylinderGeometry(0.38, 0.38, 0.28, 24), rubber); t.rotation.x = Math.PI / 2; t.position.set(wx, 0.38, z); g.add(t);
    const h = new Mesh(new CylinderGeometry(0.17, 0.17, 0.3, 16), steel); h.rotation.x = Math.PI / 2; h.position.set(wx, 0.38, z); g.add(h);
  }
  // sliding weight box with hazard band
  const tex = hazardTex();
  const boxMat = new MS({ color: '#ffffff', map: tex, metalness: 0.6, roughness: 0.5 });
  const wbx = new Mesh(B.roundedBox(1.5, 1.1, 1.45, 0.05, 3), boxMat); wbx.position.set(0, 1.0 + 0.55, 0);
  const box = new Group(); box.add(wbx);
  for (let i = 0; i < 3; i++) { const pl = new Mesh(new BoxGeometry(1.3, 0.06, 1.2), steel); pl.position.set(0, 1.0 + 1.1 + 0.03 + i * 0.07, 0); box.add(pl); }
  g.add(box);
  cast(g);
  // the weight box slides forward with the pull (u 0..1)
  const slide = (u) => { box.position.x = -len + 0.35 + (len - 0.35 - 1.5 - 1.3) * u + 0.75; };
  slide(0);
  return { root: g, slide, len, front: 0 };
}

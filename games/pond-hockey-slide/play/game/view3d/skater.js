// Pond Hockey Slide: the six skaters and the puck as lit 3D solids (game-owned, procedural). Local frame: +x forward, +y up, +z the
// skater's right side in plan (the sim's local y). The 2D art's proportions are kept (shoulders 52 wide, mittens on the stick).
import * as THREE from '../vendor3d/three.js';
import { LOOKS } from '../src/art.js';
import { R_PUCK } from '../src/sim.js';
import { cvs, tex } from './rink.js';

const UP = new THREE.Vector3(0, 1, 0), A = new THREE.Vector3(), B = new THREE.Vector3(), D = new THREE.Vector3();
const quilt = (() => { let t = null; return () => t || (t = tex(cvs(64, 64, (g, w) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, w); g.fillStyle = '#c8c8c8'; for (let y = 0; y < w; y += 16) g.fillRect(0, y, w, 7); }), { repeat: [1, 3], srgb: false })); })();
const knit = (() => { let t = null; return () => t || (t = tex(cvs(64, 64, (g, w) => { g.fillStyle = '#909090'; g.fillRect(0, 0, w, w); g.fillStyle = '#d0d0d0'; for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 4, w); }), { repeat: [6, 2], srgb: false })); })();
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
const mesh = (g, m, shadow = true) => { const o = new THREE.Mesh(g, m); o.castShadow = shadow; o.receiveShadow = true; return o; };
const sph = (r, seg = 16) => new THREE.SphereGeometry(r, seg, Math.max(8, seg >> 1));

// a cylinder between two points (re-aimed each frame by setLimb)
function limb(r, mat) { const m = mesh(new THREE.CylinderGeometry(r, r, 1, 10), mat); m.userData.r = r; return m; }
function setLimb(m, a, b) {
  A.set(...a); B.set(...b); D.copy(B).sub(A); const len = Math.max(0.001, D.length());
  m.position.copy(A).addScaledVector(D, 0.5); m.scale.set(1, len, 1); m.quaternion.setFromUnitVectors(UP, D.normalize());
}

export function makeSkater(look, idx = 0) {
  const sc = look.build * 1.12, root = new THREE.Group(), body = new THREE.Group(); body.scale.setScalar(sc); root.add(body);
  const jacket = std(look.jacket[0], { roughness: 0.55, bumpMap: quilt(), bumpScale: 1.6 }), jacketD = std(look.jacket[1], { roughness: 0.6 });
  const pants = std(look.pants, { roughness: 0.7 }), skin = std(look.skin, { roughness: 0.55 }), hair = std(look.hair, { roughness: 0.8 });
  const toque = std(look.toque, { roughness: 0.9, bumpMap: knit(), bumpScale: 1.4 }), band = std(look.band, { roughness: 0.85 }), scarfM = std(look.scarf, { roughness: 0.9, bumpMap: knit(), bumpScale: 1 });
  const boot = std('#241e1b', { roughness: 0.45 }), steel = std('#d6dee6', { roughness: 0.22, metalness: 1 }), mitt = std('#2f3a47', { roughness: 0.8 });
  const wood = std('#7a5330', { roughness: 0.55 }), tape = std('#eeeeea', { roughness: 0.7 }), blade = std('#1d2128', { roughness: 0.5 });
  const feet = [], legs = [];
  for (const sz of [-8.5, 8.5]) {
    const f = new THREE.Group(); f.position.z = sz;
    const bt = mesh(new THREE.CapsuleGeometry(5.6, 18, 6, 12), boot); bt.rotation.z = Math.PI / 2; bt.position.set(4, 11, 0); bt.scale.set(1, 1, 1.0); f.add(bt);
    const bl = mesh(new THREE.BoxGeometry(44, 5, 1.6), steel); bl.position.set(2, 2.5, 0); f.add(bl);
    const hold = mesh(new THREE.BoxGeometry(30, 3, 3), steel); hold.position.set(2, 5.2, 0); f.add(hold);
    body.add(f); feet.push(f);
    const lg = limb(6.2, pants); body.add(lg); legs.push([lg, sz]);
  }
  const hips = new THREE.Group(); body.add(hips);
  const torso = mesh(sph(1, 20), jacket); torso.scale.set(13.5, 21, 26); torso.position.set(0, 50, 0); hips.add(torso);
  const shoulders = mesh(new THREE.CapsuleGeometry(8, 30, 6, 12), jacket); shoulders.rotation.x = Math.PI / 2; shoulders.position.set(0, 62, 0); hips.add(shoulders);
  const waist = mesh(new THREE.CylinderGeometry(12.5, 11, 8, 18), jacketD); waist.scale.set(1, 1, 2); waist.position.set(0, 36, 0); hips.add(waist);
  const head = new THREE.Group(); hips.add(head); head.position.set(3, 77, 0);
  const skull = mesh(sph(10.6), skin); skull.scale.set(0.98, 1.04, 0.96); head.add(skull);
  const nose = mesh(sph(2.5, 10), skin); nose.position.set(10.4, -1, 0); head.add(nose);
  for (const z of [-4.2, 4.2]) { const ey = mesh(sph(1.2, 8), std('#1a1412')); ey.position.set(9.2, 2.2, z); head.add(ey); const ear = mesh(sph(2.6, 8), skin); ear.position.set(-0.5, -0.5, z * 2.35); head.add(ear); }
  const back = mesh(sph(10.9), hair); back.scale.set(0.9, 1.0, 1.0); back.position.set(-3, 0.6, 0); head.add(back);
  if (look.long) { const lh = mesh(new THREE.CapsuleGeometry(5.4, 12, 6, 10), hair); lh.position.set(-10, -7, 0); lh.scale.set(0.9, 1, 1.5); head.add(lh); }
  const cap = mesh(new THREE.SphereGeometry(12.6, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), toque); cap.position.set(-0.5, 1.8, 0); cap.rotation.z = -0.1; head.add(cap);
  const cuff = mesh(new THREE.TorusGeometry(11.6, 2.9, 10, 28), band); cuff.rotation.x = Math.PI / 2; cuff.rotation.y = 0; cuff.position.set(-0.4, 3.2, 0); cuff.rotation.z = -0.1; head.add(cuff);
  const pom = mesh(sph(4.2, 12), band); pom.position.set(-2.4, 14.4, 0); head.add(pom);
  const scarf = mesh(new THREE.TorusGeometry(9.2, 4.2, 10, 24), scarfM); scarf.rotation.x = Math.PI / 2; scarf.position.set(-0.5, 65.5, 0); hips.add(scarf);
  const tail = mesh(new THREE.BoxGeometry(18, 2.4, 7), scarfM); tail.geometry.translate(-9, 0, 0); tail.position.set(-9, 62, 3.5); hips.add(tail);
  // arms, mittens and the stick are re-aimed every frame from the sim's swing
  const armA = [limb(4.8, jacket), limb(4.8, jacket)], armB = [limb(4.6, jacketD), limb(4.6, jacketD)], hands = [mesh(sph(5.2), mitt), mesh(sph(5.2), mitt)], joints = [mesh(sph(5), jacket), mesh(sph(5), jacket)];
  for (const o of [...armA, ...armB, ...hands, ...joints]) body.add(o);
  const shaft = limb(1.9, wood), bl2 = mesh(new THREE.BoxGeometry(3.4, 8, 15), blade), tp = mesh(new THREE.BoxGeometry(3.6, 8.2, 8), tape); body.add(shaft, bl2); bl2.add(tp); tp.position.z = 2;
  const ring = null;
  let lastLeg = 0;

  function update(b, t) {
    const gl = b.glide || 0, sw = b.swing || 0, hit = b.hit || 0, bob = Math.sin(t * 9 + b.idx * 2) * gl, idle = Math.sin(t * 2 + b.idx * 1.7) * (1 - gl), lean = gl * 3 + hit * 2;
    root.position.set(b.x, 0, b.y); root.rotation.y = -b.face;
    feet[0].position.x = -bob * 3; feet[1].position.x = bob * 3;
    legs.forEach(([lg, sz], i) => setLimb(lg, [feet[i].position.x * 0.5, 14, sz], [lean * 0.2, 40, sz * 0.9]));
    hips.position.x = lean * 0.4; hips.rotation.z = -(gl * 0.1 + hit * 0.06); hips.rotation.x = Math.sin(t * 7 + b.idx) * 0.03 * gl;
    head.position.y = 77 + idle * 0.5; head.rotation.y = Math.sin(t * 1.3 + b.idx) * 0.12 * (1 - gl);
    const wob = Math.sin(t * 8 + b.idx) * 4 * gl;
    tail.rotation.y = 0.15 + wob * 0.04; tail.rotation.z = gl * 0.35 + Math.sin(t * 6 + b.idx) * 0.12 * gl; tail.scale.x = 1 + gl * 0.9;
    const sa = -0.12 - sw * 1.15 + idle * 0.03 + hit * 0.35, ux = Math.cos(sa), uy = Math.sin(sa);
    const P = (p, q) => [25 + lean + ux * p - uy * q, -2 + uy * p + ux * q];   // a point in the stick frame, in plan
    const hand0 = [25 + lean, -2], hand1 = [hand0[0] - ux * 14 + 1, hand0[1] - uy * 14 + 7];
    const hs = [hand0, hand1], sh = [[1 + lean * 0.4, -21], [1 + lean * 0.4, 21]];
    for (let i = 0; i < 2; i++) {
      const h = hs[i], s = sh[i], ey = i ? 1 : -1, ex = (s[0] + h[0]) / 2 + 4, ez = (s[1] + h[1]) / 2 + ey * 4, hy = 44 + i * 2;
      setLimb(armA[i], [s[0], 60, s[1]], [ex, 52, ez]); setLimb(armB[i], [ex, 52, ez], [h[0] - 2, hy, h[1]]);
      joints[i].position.set(ex, 52, ez); hands[i].position.set(h[0], hy, h[1]);
    }
    const a0 = P(-20, 0), a1 = P(40, 3), a2 = P(42, 17);
    setLimb(shaft, [a0[0], 47, a0[1]], [a1[0], 3.5, a1[1]]);
    bl2.position.set((a1[0] + a2[0]) / 2, 4.2, (a1[1] + a2[1]) / 2); bl2.rotation.y = -Math.atan2(a2[1] - a1[1], a2[0] - a1[0]) + Math.PI / 2;
    void lastLeg;
  }
  return { root, update, ring };
}

export function makePuck() {
  const pts = [[0, 7.2], [10.5, 7.2], [12.6, 6.2], [13, 4.4], [13, 2.4], [12.4, 0.8], [10.8, 0], [0, 0]].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, 36), m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x14181e, roughness: 0.42, metalness: 0.25 }));
  m.castShadow = true; m.receiveShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R_PUCK - 3.2, 0.7, 6, 32), new THREE.MeshBasicMaterial({ color: 0x8a97a8 })); rim.rotation.x = Math.PI / 2; rim.position.y = 7.25; m.add(rim);
  const g2 = new THREE.Group(); g2.add(m);
  return { root: g2, update(b) { g2.position.set(b.x, 0.2, b.y); m.rotation.y += Math.hypot(b.vx, b.vy) * 0.0004; } };
}

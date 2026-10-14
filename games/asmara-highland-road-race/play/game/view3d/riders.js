// Real 3D road cyclists for the highland race picture (presentation only: reads the rider fields of the sim, never writes back).
//
// platform/view3d supplies the person (athlete_m), the stage and the IK; this file builds the road bike from simple solids (tubes, a carbon
// frame, wheels with spokes, cranks that really turn) and authors the riding posture on the skeleton: sit-bones on the saddle, back flexed
// over the hoods or the drops, head up, knees tracking, feet clipped onto pedals that follow the cadence, and the dancing out-of-the-saddle
// attack with the bike rocking under the rider. Everything is drawn into an off-screen WebGL canvas and composited by src/view.js.
import { createStage, loadHuman, Clip, CLIP_BONES, semanticRot, THREE } from '../vendor3d/index.js';
import { createWorld } from './world.js';

const { Vector3, Quaternion, Euler, Matrix4 } = THREE;
const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const bi = (n) => CLIP_BONES.indexOf(`Bip01_${n}`);
const UP = new Vector3(0, 1, 0), RIGHT = new Vector3(1, 0, 0);

// ---- the bicycle (metres; x = left of the rider, y up, z forward; origin on the ground under the bottom bracket) ----------------------------
const BIKE = {
  R: 0.335,                                   // wheel radius (700c with a 28 mm tyre)
  bb: [0, 0.27, 0], rear: [0, 0.335, -0.425], front: [0, 0.335, 0.60],
  seatTube: [0, 0.75, -0.205], post: [0, 0.80, -0.232], headTop: [0, 0.78, 0.405], headBot: [0, 0.625, 0.447],
  crank: 0.172, qHalf: 0.083,                 // crank length, half of the pedal-to-pedal width
  barC: [0, 0.84, 0.485], hoodHand: [0.205, 0.872, 0.535], dropHand: [0.215, 0.79, 0.585],
};

const V = (a, s = 1) => new Vector3(a[0] * s, a[1], a[2]);
const tmpM = new Matrix4(), tmpQ = new Quaternion();

function cylBetween(p0, p1, r0, r1 = r0, seg = 8) {
  const d = p1.clone().sub(p0), len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false);   // CylinderGeometry: radiusTop, radiusBottom
  tmpQ.setFromUnitVectors(UP, d.normalize());
  tmpM.compose(p0.clone().add(p1).multiplyScalar(0.5), tmpQ, new Vector3(1, 1, 1));
  g.applyMatrix4(tmpM);
  return g;
}

// merge static pieces into ONE geometry with a vertex colour per piece (multiplied by the material colour: frame parts are white, parts that
// do not take the team colour are dark)
class Merger {
  constructor() { this.pos = []; this.nor = []; this.col = []; }
  add(geo, rgb) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { this.pos.push(p[i]); this.nor.push(n[i]); }
    for (let i = 0; i < p.length / 3; i++) this.col.push(rgb[0], rgb[1], rgb[2]);
    geo.dispose();
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    return g;
  }
}

let SHARED = null;
function sharedBike() {
  if (SHARED) return SHARED;
  const m = new Merger(), mp = new Merger();
  const W = [1, 1, 1], K = [0.045, 0.045, 0.05], S = [0.55, 0.57, 0.6], T = [0.07, 0.07, 0.08];
  const B = BIKE;
  const add0 = m.add.bind(m);
  m.add = (g, c) => (c === W ? add0(g, c) : mp.add(g, c));
  const tube = (a, b, r, col, r1) => m.add(cylBetween(V(a), V(b), r, r1 ?? r, 10), col);
  const bb = V(B.bb), rear = V(B.rear), front = V(B.front);
  const stT = V(B.seatTube), hT = V(B.headTop), hB = V(B.headBot);
  const topTubeSeat = new Vector3(0, 0.74, -0.195);
  // main triangle (frame colour)
  m.add(cylBetween(bb, stT, 0.017, 0.017, 10), W);                                              // seat tube
  m.add(cylBetween(topTubeSeat, new Vector3(0, 0.76, 0.405), 0.016, 0.019, 10), W);            // top tube
  m.add(cylBetween(bb.clone().add(new Vector3(0, 0.01, 0.02)), hB.clone().add(new Vector3(0, 0.03, 0)), 0.021, 0.025, 10), W);   // down tube
  m.add(cylBetween(hB, hT, 0.024, 0.024, 12), W);                                               // head tube
  for (const s of [-1, 1]) {
    m.add(cylBetween(bb.clone().add(new Vector3(s * 0.025, 0, 0)), rear.clone().add(new Vector3(s * 0.058, 0, 0)), 0.0125, 0.01, 8), W);       // chainstays
    m.add(cylBetween(topTubeSeat.clone().add(new Vector3(0, -0.02, 0)), rear.clone().add(new Vector3(s * 0.058, 0, 0)), 0.009, 0.009, 8), W);  // seatstays
    m.add(cylBetween(hB.clone().add(new Vector3(0, -0.02, 0.0)), front.clone().add(new Vector3(s * 0.05, 0, 0)), 0.0125, 0.0095, 8), W);       // fork blades
  }
  // black parts
  m.add(cylBetween(stT, V(B.post), 0.0155, 0.0155, 8), K);                                       // seat post
  const saddle = new THREE.SphereGeometry(1, 16, 10); saddle.scale(0.066, 0.03, 0.15); saddle.translate(0, 0.835, -0.232 + 0.01);
  m.add(saddle, K);
  const nose = new THREE.SphereGeometry(1, 12, 8); nose.scale(0.03, 0.022, 0.07); nose.translate(0, 0.835, -0.232 + 0.15); m.add(nose, K);
  m.add(cylBetween(hT, new Vector3(0, 0.838, 0.478), 0.014, 0.014, 8), K);                       // stem
  // handlebar: a drop bar as a smooth tube per side
  for (const s of [-1, 1]) {
    const pts = [[0, 0.84, 0.482], [0.1 * s, 0.84, 0.484], [0.195 * s, 0.841, 0.492], [0.215 * s, 0.84, 0.528], [0.222 * s, 0.821, 0.575], [0.222 * s, 0.78, 0.6], [0.212 * s, 0.735, 0.575], [0.205 * s, 0.727, 0.535]].map((p) => new Vector3(p[0], p[1], p[2]));
    m.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.0115, 8, false), K);
    // brake lever hood (a rubber hood on the front of the bar top)
    const hood = new THREE.CapsuleGeometry(0.0235, 0.075, 4, 10); hood.rotateX(Math.PI / 2 - 0.45); hood.scale(1.0, 1.2, 1); hood.translate(0.212 * s, 0.84, 0.56);
    m.add(hood, [0.09, 0.09, 0.1]);
    m.add(cylBetween(new Vector3(0.222 * s, 0.795, 0.595), new Vector3(0.222 * s, 0.715, 0.62), 0.005, 0.005, 6), S);   // brake lever
  }
  // drivetrain: chainring, cassette, chain, rear derailleur
  const ring = new THREE.TorusGeometry(0.088, 0.0075, 6, 36); ring.rotateY(Math.PI / 2); ring.translate(-0.045, 0.27, 0); m.add(ring, S);
  const spider = new THREE.CylinderGeometry(0.05, 0.05, 0.006, 5); spider.rotateZ(Math.PI / 2); spider.translate(-0.045, 0.27, 0); m.add(spider, K);
  const cass = new THREE.CylinderGeometry(0.052, 0.052, 0.04, 20); cass.rotateZ(Math.PI / 2); cass.translate(-0.04, 0.335, -0.425); m.add(cass, S);
  m.add(cylBetween(new Vector3(-0.045, 0.27 + 0.095, 0), new Vector3(-0.04, 0.335 + 0.052, -0.425), 0.0045, 0.0045, 4), T);
  m.add(cylBetween(new Vector3(-0.045, 0.27 - 0.095, 0), new Vector3(-0.04, 0.335 - 0.052, -0.425), 0.0045, 0.0045, 4), T);
  const der = new THREE.BoxGeometry(0.03, 0.09, 0.04); der.translate(-0.06, 0.27, -0.405); m.add(der, T);
  // wheels: tyre + rim (static: they are rotationally symmetric; only the spokes turn)
  for (const c of [rear, front]) {
    const tyre = new THREE.TorusGeometry(B.R - 0.0155, 0.0155, 10, 56); tyre.rotateY(Math.PI / 2); tyre.translate(c.x, c.y, c.z); m.add(tyre, [0.035, 0.035, 0.04]);
    const rim = new THREE.TorusGeometry(B.R - 0.034, 0.011, 8, 56); rim.rotateY(Math.PI / 2); rim.scale(1.6, 1, 1); rim.translate(c.x, c.y, c.z); m.add(rim, [0.62, 0.64, 0.68]);
    const hub = new THREE.CylinderGeometry(0.014, 0.014, 0.1, 10); hub.rotateZ(Math.PI / 2); hub.translate(c.x, c.y, c.z); m.add(hub, S);
  }
  // bottle in the cage on the seat tube
  const bot = new THREE.CylinderGeometry(0.03, 0.03, 0.17, 12); bot.translate(0, 0.5, -0.11); m.add(bot, [0.9, 0.9, 0.92]);
  const bcap = new THREE.CylinderGeometry(0.014, 0.02, 0.03, 8); bcap.translate(0, 0.6, -0.11); m.add(bcap, T);
  SHARED = { geo: m.build(), parts: mp.build() };
  // spoke disc texture (silver spokes, alpha elsewhere)
  const cv = globalThis.document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d'); g.clearRect(0, 0, 256, 256);
  g.translate(128, 128); g.strokeStyle = 'rgba(210,214,222,0.95)'; g.lineWidth = 2.1;
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2, tw = i % 2 ? 0.1 : -0.1; g.beginPath(); g.moveTo(Math.cos(a + tw) * 12, Math.sin(a + tw) * 12); g.lineTo(Math.cos(a) * 118, Math.sin(a) * 118); g.stroke(); }
  g.fillStyle = 'rgba(60,64,72,1)'; g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  SHARED.tex = tex;
  SHARED.disc = new THREE.CircleGeometry(B.R - 0.03, 40);
  SHARED.crankArm = (() => { const g2 = new THREE.BoxGeometry(0.014, BIKE.crank, 0.024); g2.translate(0, BIKE.crank / 2, 0); return g2; })();
  SHARED.pedal = new THREE.BoxGeometry(0.075, 0.016, 0.095);
  return SHARED;
}

class Bike {
  constructor(frameHex) {
    const S = sharedBike();
    this.group = new THREE.Group();
    this.frameMat = new THREE.MeshStandardMaterial({ color: frameHex, roughness: 0.3, metalness: 0.3, vertexColors: true });
    this.group.add(new THREE.Mesh(S.geo, this.frameMat));
    this.group.add(new THREE.Mesh(S.parts, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.5, vertexColors: true })));
    const spokeMat = new THREE.MeshBasicMaterial({ map: S.tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, color: 0xbfc4cc });
    this.spokeMat = spokeMat;
    this.blurMat = new THREE.MeshBasicMaterial({ color: 0x9aa0aa, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
    this.wheels = [BIKE.rear, BIKE.front].map((c) => {
      const spin = new THREE.Group(); spin.position.set(c[0], c[1], c[2]);
      const d = new THREE.Mesh(S.disc, spokeMat); d.rotation.y = Math.PI / 2; spin.add(d);
      const bd = new THREE.Mesh(S.disc, this.blurMat); bd.rotation.y = Math.PI / 2; bd.position.x = 0.002; spin.add(bd);
      this.group.add(spin); return spin;
    });
    const metal = new THREE.MeshStandardMaterial({ color: 0x8b9099, roughness: 0.4, metalness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.6, metalness: 0.2 });
    // race number plate on the seat tube (both sides)
    this.numCv = globalThis.document.createElement('canvas'); this.numCv.width = 128; this.numCv.height = 96;
    this.numTex = new THREE.CanvasTexture(this.numCv); this.numTex.colorSpace = THREE.SRGBColorSpace; this.num = -1;
    const plateMat = new THREE.MeshBasicMaterial({ map: this.numTex, side: THREE.FrontSide });
    for (const sgn of [-1, 1]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.056), plateMat);
      pl.position.set(sgn * 0.022, 0.63, -0.13); pl.rotation.set(0, sgn * Math.PI / 2, 0); pl.rotation.x = 0.0; this.group.add(pl);
    }
    this.cranks = [-1, 1].map((s) => {          // s = -1: the avatar's right side (right of the rider = -x)
      const cg = new THREE.Group(); cg.position.set(s * BIKE.qHalf * 0.82, BIKE.bb[1], 0);
      cg.add(new THREE.Mesh(S.crankArm, metal));
      const ped = new THREE.Group(); ped.position.set(s * BIKE.qHalf * 0.18, BIKE.crank, 0); ped.add(new THREE.Mesh(S.pedal, dark)); cg.add(ped);
      cg.userData.ped = ped; this.group.add(cg); return cg;
    });
  }
}

// ---- one rider ----------------------------------------------------------------------------------------------------------------------------
Bike.prototype.setBlur = function (b) { this.spokeMat.opacity = 1 - 0.75 * b; this.blurMat.opacity = 0.28 * b; };
Bike.prototype.setNumber = function (n) {
  if (this.num === n) return; this.num = n;
  const g = this.numCv.getContext('2d');
  g.fillStyle = '#f7f4ea'; g.fillRect(0, 0, 128, 96); g.strokeStyle = '#1b1b1f'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 90);
  g.fillStyle = '#111'; g.font = '900 62px system-ui,Arial,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 52);
  this.numTex.needsUpdate = true;
};

class Rider {
  constructor(human, idx) {
    this.h = human; this.idx = idx;
    this.clip = new Clip({ name: 'pose', frames: 1, dur: 1 / 30, fps: 30, loop: true, quats: new Float32Array(CLIP_BONES.length * 4), pelvis: new Float32Array(3), grounded: false, fingers: 'relaxed' });
    human.addClip(this.clip);
    human.groundClamp = 'off'; human.footPlanting = false;
    this.restQ = new Float32Array(human.restPose.q);
    this.e = new Euler(); this.qa = new Quaternion(); this.qb = new Quaternion();
    this.ph = human.pelvisHeight;
    human.play(this.clip, { fade: 0 });
    this.bike = new Bike('#222831');
    this.low = 0; this.stand = 0; this.lastLook = '';
    this.root = human.root;
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
}

// ---- a spectator (roadside crowd): the same person model standing, clapping or cheering --------------------------------------------------
class Spectator {
  constructor(human, idx) {
    this.h = human; this.idx = idx;
    this.clip = new Clip({ name: 'pose', frames: 1, dur: 1 / 30, fps: 30, loop: true, quats: new Float32Array(CLIP_BONES.length * 4), pelvis: new Float32Array(3), grounded: false, fingers: 'relaxed' });
    human.addClip(this.clip);
    human.groundClamp = 'off'; human.footPlanting = false;
    this.restQ = new Float32Array(human.restPose.q);
    this.e = new Euler(); this.qa = new Quaternion(); this.qb = new Quaternion();
    this.ph = human.pelvisHeight;
    human.play(this.clip, { fade: 0 });
    this.lastLook = '';
  }
  writePose(offs, pel) { Rider.prototype.writePose.call(this, offs, pel); }
}

// ---- cycling helmet and glasses on the head bone ------------------------------------------------------------------------------------------
const basis = (human, boneName) => { const f = human.boneFrame(boneName); const m = new Matrix4().makeBasis(f.left.normalize(), f.up.normalize(), f.fwd.normalize()); return { q: new Quaternion().setFromRotationMatrix(m), f }; };
function addCyclingHelmet(human, hex) {
  const head = human.bones.Bip01_Head;
  const { q, f } = basis(human, 'Head');
  const box = human.headBox;
  const c = box ? box.getCenter(new Vector3()) : new Vector3(0.07, 0, 0);
  const upExt = box ? Math.max(box.max.dot(f.up), box.min.dot(f.up)) : 0.2;
  const fwdExt = box ? Math.max(box.max.dot(f.fwd), box.min.dot(f.fwd)) : 0.1;
  const topPt = c.clone().addScaledVector(f.up, upExt - c.dot(f.up));
  const g = new THREE.Group(); g.quaternion.copy(q);
  const shell = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.3, metalness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0f1115, roughness: 0.55, metalness: 0.1 });
  const R = 0.118;
  g.position.copy(topPt).addScaledVector(f.up, -R * 0.44).addScaledVector(f.fwd, -0.03);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), shell); dome.scale.set(1.04, 0.92, 1.3);
  g.add(dome);
  // vents: dark slots along the shell
  for (const s of [-1, 0, 1]) {
    const v = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.13, 3, 6), dark); v.rotation.x = Math.PI / 2; v.position.set(s * 0.05, R * 0.9 * (s ? 0.93 : 1.0) + 0.002, -0.005); v.scale.set(1, 0.6, 1); g.add(v);
  }
  // brow edge and chin strap
  const brow = new THREE.Mesh(new THREE.TorusGeometry(R * 1.0, 0.0045, 6, 36, Math.PI * 1.1), dark); brow.rotation.x = Math.PI / 2; brow.rotation.z = Math.PI * 0.95; brow.scale.set(1.04, 1.3, 1); brow.position.y = -R * 0.18; g.add(brow);
  head.add(g);
  // glasses: dark wraparound lens + thin arms, at eye level
  const eyeUp = c.clone().addScaledVector(f.up, 0.012).addScaledVector(f.fwd, fwdExt - c.dot(f.fwd) - 0.006);
  const gg = new THREE.Group(); gg.quaternion.copy(q); gg.position.copy(eyeUp);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.034, 20, 1, true, -Math.PI * 0.43, Math.PI * 0.86), new THREE.MeshStandardMaterial({ color: 0x151a24, roughness: 0.15, metalness: 0.5, side: THREE.DoubleSide }));
  lens.scale.set(1.0, 1, 0.9); lens.rotation.y = Math.PI; gg.add(lens);
  head.add(gg);
  return [shell];
}

// Cycling kit: the shipped athlete wears long shorts and a tank top. This repaints the SHARED body textures once, in place (before any LOD mesh is
// baked from them): the jersey gets short sleeves (the top tint mask is extended over the upper arms and the armholes). The shipped long black
// shorts stay as they are.
function cyclingKit(h0) {
  const N = 1024, clamp255 = (v) => Math.max(0, Math.min(255, v));
  const mk = () => { const c = globalThis.document.createElement('canvas'); c.width = c.height = N; return c; };
  const read = (img) => { const c = mk(); const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, N, N); return { c, g, d: g.getImageData(0, 0, N, N) }; };
  for (const m of h0.mats) {
    if (m.userData.kind !== 'body' || !m.map || !m.userData.tint) continue;
    const u = m.userData.tint;
    const A = read(m.map.image), M = read(u.tMask.value.image), K = read(u.tSkin.value.image);
    const a = A.d.data, mk2 = M.d.data, sk = K.d.data;
    // the shipped shorts stay (black, loose, knee length): shortening them in the texture leaves skin-coloured cloth that reads as a skirt
    // short sleeves: the upper arm (skin mask) becomes jersey (top tint)
    const sleeve = (x0, x1) => {
      for (let y = 470; y < 612; y++) for (let x = x0; x < x1; x++) {
        const i = (y * N + x) * 4;
        if (sk[i] < 40) continue;
        const L = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
        const sh = Math.max(0.78, Math.min(1.04, L / 190));
        a[i] = a[i + 1] = a[i + 2] = clamp255(222 * sh);
        mk2[i] = 255; mk2[i + 1] = 0; mk2[i + 2] = 0; sk[i] = 0;
      }
    };
    sleeve(0, 316); sleeve(708, 1024);
    // armhole crescents of the torso map (shoulder / armpit skin) belong to the jersey too
    for (const [x0, x1] of [[326, 450], [574, 700]]) for (let y = 286; y < 630; y++) for (let x = x0; x < x1; x++) {
      const i = (y * N + x) * 4;
      if (sk[i] < 40) continue;
      const L = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2], sh = Math.max(0.78, Math.min(1.04, L / 190));
      a[i] = a[i + 1] = a[i + 2] = clamp255(222 * sh); mk2[i] = 255; mk2[i + 1] = 0; mk2[i + 2] = 0; sk[i] = 0;
    }
    A.g.putImageData(A.d, 0, 0); M.g.putImageData(M.d, 0, 0); K.g.putImageData(K.d, 0, 0);
    m.map.image = A.c; m.map.needsUpdate = true;
    u.tMask.value.image = M.c; u.tMask.value.needsUpdate = true;
    u.tSkin.value.image = K.c; u.tSkin.value.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------
export async function createRiders({ quality = 'medium', max = 18, crowd = 14, base } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  const stage = createStage({ canvas, container: globalThis.document.body, quality, dprCap: 1, transparent: true, shadows: false, lighting: 'day', fov: 8 });
  if (!stage.supported) return null;
  stage.setSky(null, null);
  const spec = { character: 'athlete_m', base, kit: { top: '#ff8b1f', bottoms: '#15171d', socks: '#f4f4f4' }, skin: '#8a5a3c', hair: 'black', lod: 'auto' };
  cyclingKit(await loadHuman({ ...spec, lod: undefined }));      // repaint the shared textures first; every person below (and its LOD meshes) is built from them
  const humans = [];
  for (let i = 0; i < max; i++) humans.push(await loadHuman(spec));      // sequential: one decode at a time keeps the memory peak low
  const riders = humans.map((h, i) => new Rider(h, i));
  // roadside crowd: a mix of both shipped characters (she wears long trousers), loaded after the riders so the race can start first
  const specs = [];
  const nSpec = Math.min(14, Math.max(0, crowd));
  for (let i = 0; i < nSpec; i++) {
    const h = await loadHuman({ ...spec, character: i % 3 === 2 ? 'athlete_m' : 'athlete_f', kit: { top: '#e9eef2', bottoms: '#2a2f3a', socks: '#f2f2f0' }, skin: '#8a5a3c', hair: 'black', lod: 'auto' });
    specs.push(new Spectator(h, i));
  }
  for (const r of riders) {
    r.helm = addCyclingHelmet(r.h, '#fff4dc');
    stage.add(r.h); stage.track(r.h); stage.add(r.bike.group);
    r.h.root.visible = false; r.bike.group.visible = false;
  }
  for (const sp of specs) { stage.add(sp.h); stage.track(sp.h); sp.h.root.visible = false; }
  const api = { stage, riders, specs, quality, fitted: { w: 0, h: 0 }, ok: true, lost: false };
  stage.onContextLost(() => { api.lost = true; });
  stage.onContextRestored(() => { api.lost = false; api.fitted.w = 0; });
  return Object.assign(api, makeApi(api));
}

function makeApi(api) {
  const { stage, riders, specs } = api;
  const cam = stage.camera, renderer = stage.renderer;
  const DIST = 70;
  const v = new Vector3(), v2 = new Vector3();
  const qYaw = new Quaternion(), qTilt = new Quaternion(), qRoll = new Quaternion(), qBase = new Quaternion(), qBike = new Quaternion(), qf = new Quaternion(), qp = new Quaternion();
  const mBike = new Matrix4(), mRoot = new Matrix4();
  const cx = { v: 0 };

  function frameCamera(devW, devH, wM, hM) {
    renderer.setPixelRatio(1); renderer.setSize(devW, devH, false);
    cam.aspect = devW / devH;
    cam.fov = 2 * Math.atan(hM / 2 / DIST) / D2R;
    cam.near = 5; cam.far = 200;
    cam.position.set(0, 0, DIST); cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    void wM;
  }

  // analytic two-bone solve in the sagittal plane: hip (z, y), ankle (z, y) -> thigh angle and knee flexion in degrees
  function leg2(hz, hy, az, ay, t, s) {
    let dz = az - hz, dy = ay - hy, d = Math.hypot(dz, dy);
    const dMax = (t + s) * 0.995, dMin = Math.abs(t - s) + 0.02;
    d = clamp(d, dMin, dMax);
    const sc = d / Math.hypot(dz, dy); dz *= sc; dy *= sc;
    const a = (t * t + d * d - s * s) / (2 * t * d);
    const alpha = Math.acos(clamp(a, -1, 1));
    const base = Math.atan2(dz, -dy);                    // angle of hip->ankle from straight down, forward positive
    const th = base + alpha;                             // knee in front
    const kz = hz + Math.sin(th) * t, ky = hy - Math.cos(th) * t;
    const sh = Math.atan2(az - kz, -(ay - ky));
    return { th: th / D2R, knee: (th - sh) / D2R };
  }

  // pose one rider: it = { x, y (px), z (depth rank), tilt, phase, spin, pose, jersey, trim, helmet, skin, frame, look (0..1 head turn), effort (0..1), sweat (0..1) }
  // pl (optional, the 3D world path): { pos: Vector3 (in the parent group), yaw, parentM: Matrix4 (parent world), parentQ: Quaternion }
  const qG = new Quaternion(), mW = new Matrix4(), IDM = new Matrix4();
  function poseOne(r, it, t, dt, k, rc, pl) {
    const h = r.h;
    // posture blend (presentation smoothing, deterministic for a given dt sequence)
    const wl = it.pose === 1 ? 1 : 0, ws = it.pose === 2 ? 1 : 0;
    let kk = 1 - Math.exp(-dt * 5);
    if (!r.seen) { r.seen = true; kk = 1; }
    r.low += (wl - r.low) * kk; r.stand += (ws - r.stand) * kk;
    const low = r.low, stand = r.stand;
    const a = it.phase;                                     // crank angle (0 = right crank at the top)
    const sw = Math.sin(a);
    let pos, yaw;
    if (pl) { pos = pl.pos; yaw = pl.yaw; }
    else {
      const wx = (it.x - (rc.x + rc.w / 2)) / k, wy = -(it.y - (rc.y + rc.h / 2)) / k, wz = (it.z || 0) * 0.55;
      pos = new Vector3(wx, wy, wz);
      yaw = Math.PI / 2 - (it.yawOff ?? 0.42);              // the bike points to +X on screen, turned a little towards the viewer
    }
    qYaw.setFromAxisAngle(UP, yaw); qTilt.setFromAxisAngle(new Vector3(0, 0, 1), it.tilt || 0);
    qBase.copy(qTilt).multiply(qYaw);
    const rockA = stand * 0.15 * sw;                         // the bike rocks under a rider out of the saddle
    qRoll.setFromAxisAngle(new Vector3(0, 0, 1), rockA);
    qBike.copy(qBase).multiply(qRoll);
    h.root.position.copy(pos); h.root.quaternion.copy(qBase); h.facing = yaw;
    r.bike.group.position.copy(pos); r.bike.group.quaternion.copy(qBike);
    mRoot.compose(pos, qBase, new Vector3(1, 1, 1));
    mBike.compose(pos, qBike, new Vector3(1, 1, 1));
    if (pl) { mW.copy(pl.parentM).multiply(mBike); qG.copy(pl.parentQ); } else { mW.copy(mBike); qG.identity(); }
    // bike parts
    r.bike.wheels[0].rotation.x = it.spin; r.bike.wheels[1].rotation.x = it.spin;
    r.bike.cranks[0].rotation.x = a; r.bike.cranks[0].userData.ped.rotation.x = -a;          // right (avatar) crank = index 0 (x < 0)
    r.bike.cranks[1].rotation.x = a + Math.PI; r.bike.cranks[1].userData.ped.rotation.x = -(a + Math.PI);
    // rider body (character space = bike space; the bike rocks about the ground point, the pelvis follows partly)
    const effort = it.effort ?? 0;
    const breath = Math.sin(t * (2.1 + effort * 2.2) + r.idx);
    const dance = stand * (0.07 + 0.025 * Math.abs(sw));
    const pelU = lerp(0.9, 0.89, low) - 0.012 + dance + breath * 0.002;
    const pelF = -0.235 + 0.01 + lerp(0, 0.015, low) + stand * (api.tune.standF ?? 0.2) + low * 0.01;
    const pelL = -Math.sin(rockA) * 0.3 * stand + Math.sin(a + 0.4) * 0.006 * (1 - stand);
    const flex = lerp(lerp(34, 52, low), api.tune.standFlex ?? 28, stand) * (api.tune.flexMul ?? 2.25) + breath * 0.8 * (1 + effort);
    const look = it.look || 0;
    const headUp = -(flex * 0.82) + 4 + low * 7;
    const sideLean = -Math.sin(rockA) * 60 * stand + Math.sin(a + 0.4) * 1.6 * (1 - stand);
    const off = {};
    off.Pelvis = { flex: flex * 0.34, side: sideLean * 0.2 };
    off.Spine = { flex: flex * 0.22, side: sideLean * 0.3, twist: sw * 2 * stand + Math.sin(a) * 1.2 * (1 - stand) };
    off.Spine1 = { flex: flex * 0.22, side: sideLean * 0.3 };
    off.Spine2 = { flex: flex * 0.22, side: sideLean * 0.2 };
    // looking back over the near shoulder: the head and neck turn, the face comes round to the camera
    off.Neck = { flex: headUp * 0.6 + breath * 0.8 * (0.6 + effort) + look * 4, twist: look * (api.tune.lookTw ?? 38), side: look * 4 };
    off.Head = { flex: headUp * 0.4 - look * 6, twist: look * (api.tune.lookTw ?? 38) * 0.7 };
    off.R_Clavicle = { flex: 0 }; off.L_Clavicle = { flex: 0 };
    // legs: pedals
    const bbY = BIKE.bb[1], cr = BIKE.crank;
    const sides = [['R', -1, 0], ['L', 1, Math.PI]];
    const hipY = pelU, hipZ = pelF;
    for (const [side, sg, off0] of sides) {
      const ang = a + off0;
      // pedal spindle in bike space (a bike rocking about z carries the pedals)
      const pz = BIKE.bb[2] + cr * Math.sin(ang), py = bbY + cr * Math.cos(ang), px = sg * (BIKE.qHalf * 0.82 + BIKE.qHalf * 0.18);
      // ankle sits above and behind the ball of the foot on the spindle; the heel drops through the downstroke (ankling)
      const heel = -0.012 + 0.016 * Math.cos(ang - 0.6);
      const az = pz - 0.105, ay = py + 0.108 + heel;
      v.set(px, ay, az).applyMatrix4(mW);
      const pitch = (-4 + 12 * Math.sin(ang - 0.5) * 0.5 - 9 * Math.cos(ang)) * D2R;       // toes drop on the downstroke, heel drop at the top
      qp.setFromAxisAngle(RIGHT, -pitch);
      qf.copy(qG).multiply(qBike).multiply(r.footRest[side]).multiply(qp);
      h.setReachFoot(side, api.tune.noIK ? null : v, 1, qf);
      const sol = leg2(hipZ, hipY, az, ay, r.thigh, r.shin);
      // the pelvis tilt carries the thigh backwards, so the hip angle needs it added back; the twist keeps the knee over the foot
      off[`${side}_Thigh`] = { flex: (api.tune.thS ?? 1) * (sol.th + off.Pelvis.flex + (api.tune.thB ?? 0)), abduct: api.tune.abd ?? 6, twist: (api.tune.tw ?? 11) * (side === 'R' ? -1 : 1) };
      off[`${side}_Calf`] = { flex: (api.tune.knS ?? 1) * sol.knee };
    }
    r.writePose(off, [pelL, pelU - r.ph, pelF]);
    // hands on the hoods (upright / seated) or the drops (low in the draft)
    const grip = it.pose === 1 ? BIKE.dropHand : BIKE.hoodHand;
    for (const [side, sg] of [['R', -1], ['L', 1]]) {
      v.set(sg * grip[0], grip[1], grip[2]).applyMatrix4(mW);
      v2.set(sg * 0.46, pelU + 0.22, pelF + 0.16).applyMatrix4(mW);     // elbow pole: out to the side
      h.setReach(side, v, { weight: 1, pole: v2 });
      h.setFingers(side, GRIP);
    }
  }

  // one spectator: it = { x, y, z, face (radians, 0 = towards the viewer, + = towards the riders), mood 0 stand / 1 clap / 2 wave / 3 cheer, phase, scale, top, bottoms, skin, hair }
  function poseSpec(sp, it, t, k, rc, pl) {
    const h = sp.h;
    let wx, wy, wz, yaw;
    if (pl) { wx = pl.pos.x; wy = pl.pos.y; wz = pl.pos.z; yaw = it.face ?? 0; }
    else { wx = (it.x - (rc.x + rc.w / 2)) / k; wy = -(it.y - (rc.y + rc.h / 2)) / k; wz = it.z || 0; yaw = it.face ?? 0.5; }
    h.root.position.set(wx, wy, wz); h.root.rotation.set(0, yaw, 0); h.facing = yaw;
    h.root.scale.setScalar(it.scale || 1);
    const ph = it.phase || 0, m = it.mood || 0;
    const bob = m ? Math.abs(Math.sin(t * 5 + ph)) * 0.015 : Math.sin(t * 1.6 + ph) * 0.004;
    const off = {};
    off.Spine = { flex: -3 + Math.sin(t * 1.3 + ph) * 2 }; off.Spine1 = { flex: -2 }; off.Neck = { flex: -4 }; off.Head = { flex: -4, twist: Math.sin(t * 0.8 + ph) * 8 };
    off.R_Thigh = { flex: 2, abduct: 3 }; off.L_Thigh = { flex: 2, abduct: 3 };
    // relaxed arms: the shipped rest pose is an A-pose, so bring the arms in towards the body and bend the elbows a little
    if (m === 0 || m === 2) { off.L_UpperArm = { abduct: -32 + Math.sin(t * 0.9 + ph) * 2, flex: 4, twist: 0 }; off.L_Forearm = { flex: 16 }; }
    if (m === 0 || m === 1) { off.R_UpperArm = { abduct: -32 + Math.sin(t * 0.9 + ph + 1) * 2, flex: 4 }; off.R_Forearm = { flex: 16 }; }
    sp.writePose(off, [0, bob, 0]);
    h.root.updateMatrix();
    const S = it.scale || 1;
    const W = (l, u, f) => { v.set(l * S, u * S, f * S).applyMatrix4(h.root.matrix); if (pl) v.applyMatrix4(pl.parentM); return v.clone(); };
    const sw = Math.sin(t * 7 + ph);
    h.setReach('L', null); h.setReach('R', null);
    if (m === 1) {            // clapping in front of the chest
      const gap = 0.05 + 0.09 * Math.max(0, Math.sin(t * 8 + ph));
      h.setReach('R', W(-gap, 1.3, 0.3)); h.setReach('L', W(gap, 1.3, 0.3));
      h.setFingers('R', 'flat'); h.setFingers('L', 'flat');
    } else if (m === 2) {     // one arm waving high
      h.setReach('R', W(-0.34 + 0.08 * sw, 1.88, 0.06), { pole: W(-0.55, 1.35, -0.1) });
      h.setFingers('R', 'open');
    } else if (m === 3) {     // both arms up
      h.setReach('R', W(-0.3 + 0.05 * sw, 1.92, 0.05), { pole: W(-0.5, 1.4, -0.1) }); h.setReach('L', W(0.3 - 0.05 * sw, 1.9 + 0.03 * sw, 0.05), { pole: W(0.5, 1.4, -0.1) });
      h.setFingers('R', 'open'); h.setFingers('L', 'open');
    }
  }

  const GRIP = { curl: [[0.5, 0.6, 0.4], [0.95, 1.2, 0.8], [1.0, 1.25, 0.85], [1.05, 1.3, 0.9], [1.05, 1.3, 0.9]], spread: [0, 0, 0, 0, 0] };

  const LIGHT = { dawn: 'evening', morning: 'day', noon: 'day', dusk: 'evening' };
  const TUNE = { day: { hemi: 0.62, keyI: 2.7, rimI: 1.3 }, evening: { hemi: 0.7, keyI: 2.3, rimI: 1.1 } };
  let curLight = '', lastT = null, lodNow = -1;
  const cost = { ema: 0, n: 0 };
  api.tune = {};
  const colorCache = new Map();
  const col = (hex) => { let c = colorCache.get(hex); if (!c) { c = new THREE.Color(hex); colorCache.set(hex, c); } return c; };

  api.setTone = (tone) => {
    const n = LIGHT[tone] || 'day';
    if (n === curLight) return; curLight = n;
    stage.setLighting(n, TUNE[n]); stage.setSky(null, null);
  };

  /** Draw the riders of `items` into the 2D picture region rc. Returns the set of item ids that were drawn in 3D (the rest are drawn by the caller). */
  api.draw = function (ctx, rc, items, k, t, tone) {
    if (api.lost || stage.contextLost) return null;
    const t0 = globalThis.performance.now();
    const m = ctx.getTransform();
    const pxPerUnit = Math.hypot(m.a, m.b);
    const devW = clamp(Math.round(rc.w * pxPerUnit), 160, 1100), devH = Math.max(80, Math.round(devW * rc.h / rc.w));
    api.setTone(tone);
    const dt = lastT === null ? 0 : clamp(t - lastT, 0, 0.1); lastT = t;
    const heightPx = 1.8 * k * (devW / rc.w);
    const lod = heightPx < 105 ? 2 : heightPx < 240 ? 1 : 0;
    const drawn = new Set();
    for (const r of riders) { r.h.root.visible = false; r.bike.group.visible = false; }
    for (const sp of specs) sp.h.root.visible = false;
    items.forEach((it) => {
      if (it.spec) {
        const sp = specs[it.id];
        if (!sp) return;
        sp.h.root.visible = true;
        if (it.lookKey !== sp.lastLook) { sp.lastLook = it.lookKey; sp.h.setKit({ top: it.top, bottoms: it.bottoms, socks: '#f2f2f0' }); sp.h.setSkin(it.skin); sp.h.setHair(it.hair); }
        if (sp.lod !== lod) { sp.lod = lod; sp.h.setLOD(lod); }
        poseSpec(sp, it, t, k, rc);
        drawn.add('s' + it.id);
        return;
      }
      const r = riders[it.id];
      if (!r) return;
      r.h.root.visible = true; r.bike.group.visible = true;
      if (it.lookKey !== r.lastLook) {
        r.lastLook = it.lookKey;
        r.h.setKit({ top: it.jersey, bottoms: it.shorts || '#14161c', socks: '#f2f2f0', shoes: '#f3f3f0', trim: it.trim });
        r.h.setSkin(it.skin);
        r.helm[0].color.set(it.helmet);
        r.bike.frameMat.color.copy(col(it.frame));
      }
      if (r.lod !== lod) { r.lod = lod; r.h.setLOD(lod); }
      poseOne(r, it, t, dt, k, rc);
      drawn.add(it.id);
    });
    for (const r of riders) if (r.h.root.visible) r.h.update(dt);
    for (const sp of specs) if (sp.h.root.visible) sp.h.update(dt);
    // second pass: hands and feet were targeted with the pre-update skeleton; settle again with zero time
    for (const r of riders) if (r.h.root.visible) r.h.update(0);
    for (const sp of specs) if (sp.h.root.visible) sp.h.update(0);
    if (api.fitted.w !== devW || api.fitted.h !== devH || api.fitted.k !== k || api.fitted.rw !== rc.w) {
      frameCamera(devW, devH, rc.w / k, rc.h / k); api.fitted = { w: devW, h: devH, k, rw: rc.w };
    }
    stage.render();
    ctx.drawImage(renderer.domElement, rc.x, rc.y, rc.w, rc.h);
    const ms = globalThis.performance.now() - t0;
    cost.ema = cost.n ? cost.ema * 0.95 + ms * 0.05 : ms; cost.n++;
    if (cost.n > 90 && cost.ema > 14 && api.quality !== 'low') { api.quality = 'low'; stage.setQuality('low'); }
    return drawn;
  };

  // ======================================================================================================================================
  // The 3D world path: the whole road picture (road, hillside, trees, houses, boards, arches, crowd) and the riders in ONE lit scene seen by
  // a real perspective camera. W = { k (px per metre at the road centre), fx, yG (screen point of the focus rider's ground contact), camS, tilt,
  //   tone, course, riders: [{ id, s, lane, pose, effort, sweat, look, ... }], specs: [{ id, s, z, face, mood, ... }] }
  // ======================================================================================================================================
  const world = createWorld(THREE, { quality: api.quality });
  stage.scene.add(world.root); world.root.visible = false;
  const wgroup = world.group;
  const sweatMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0115, 6, 5), new THREE.MeshBasicMaterial({ color: 0xe6f3ff, transparent: true, opacity: 0.9, fog: false }), riders.length * 4);
  sweatMesh.frustumCulled = false; sweatMesh.count = 0; wgroup.add(sweatMesh);
  const DC = 11, HC = 2.0;
  const pm = new Matrix4(), pq = new Quaternion(), sm = new Matrix4(), sp3 = new Vector3(), sq = new Quaternion(), ssc = new Vector3(1, 1, 1);
  const fogCol = new THREE.Color();
  let inWorld = false;

  function toScene() {
    if (!inWorld) return;
    inWorld = false; world.root.visible = false;
    for (const r of riders) { stage.scene.add(r.h.root); stage.scene.add(r.bike.group); }
    for (const sp of specs) stage.scene.add(sp.h.root);
    stage.scene.fog = null; api.fitted.w = 0;
  }
  function toWorld() {
    if (inWorld) return;
    inWorld = true; world.root.visible = true;
    for (const r of riders) { wgroup.add(r.h.root); wgroup.add(r.bike.group); }
    for (const sp of specs) wgroup.add(sp.h.root);
    api.fitted.w = 0;
  }
  const origDraw = api.draw;
  api.draw = function (...a) { toScene(); return origDraw.apply(this, a); };

  const smooth01 = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  api.drawWorld = function (ctx, rc, W) {
    if (api.lost || stage.contextLost) return null;
    const t0 = globalThis.performance.now();
    toWorld();
    const m = ctx.getTransform();
    const pxPerUnit = Math.hypot(m.a, m.b);
    const scale = api.renderScale ?? 1;
    const devW = clamp(Math.round(rc.w * pxPerUnit * scale), 160, 1400), devH = Math.max(80, Math.round(devW * rc.h / rc.w));
    api.setTone(W.tone);
    const t = W.t, dt = world.lastT === undefined ? 0 : clamp(t - world.lastT, 0, 0.1); world.lastT = t;
    // camera: a pinhole at DC metres from the road, HC up, pitched so the focus rider's ground point lands on screen row yG
    const f = W.k * DC, xc = rc.x + rc.w / 2, yc = rc.y + rc.h / 2;
    const theta = Math.atan(HC / DC), pitch = theta - Math.atan((W.yG - yc) / f);
    const camX = -(W.fx - xc) * DC / f;
    renderer.setPixelRatio(1); renderer.setSize(devW, devH, false);
    cam.aspect = rc.w / rc.h; cam.fov = 2 * Math.atan(rc.h / 2 / f) / D2R; cam.near = 1; cam.far = 700;
    cam.position.set(camX, HC, DC); cam.rotation.set(-pitch, 0, 0, 'XYZ'); cam.updateProjectionMatrix();
    // gait pre-pass: the wheel turns with the ground that scrolls past (visual speed = sim speed x race clock x scene scale, true 700c radius),
    // the cranks follow through the gear the rider picks to hold a natural cadence; positions and lanes glide (never snap)
    const simRate = W.simRate || 0;
    for (const it of W.riders) {
      const r = riders[it.id]; if (!r) continue;
      const g = r.gait || (r.gait = { wheel: (it.id * 1.7) % TAU, crank: (it.id * 2.3) % TAU, gear: 2.2, lane: it.lane, xs: it.xr, vis: 0, blur: 0 });
      const kx = 1 - Math.exp(-dt * 9);
      g.xs += (it.xr - g.xs) * kx;
      g.dl = (it.lane - g.lane) * (1 - Math.exp(-dt * 2.6)); g.lane += g.dl;
      const vis = (it.v || 0) * simRate * W.sw;
      g.vis += (vis - g.vis) * (1 - Math.exp(-dt * 8));
      const dW = g.vis * dt / BIKE.R;
      g.wheel = (g.wheel + dW) % (TAU * 64);
      const cadT = 80 + 22 * (it.effort ?? 0.3) - (W.tilt > 0.05 ? 6 : 0);
      const gT = clamp((g.vis / BIKE.R) * 60 / TAU / cadT, 0.9, 4.2);
      g.gear += (gT - g.gear) * (1 - Math.exp(-dt * 1.2));
      g.crank = (g.crank + dW / g.gear) % (TAU * 64);
      g.rate = dt > 0 ? dW / dt : 0;
    }
    const fogHex = world.update({ camS: W.camS, sw: W.sw, tilt: W.tilt, tone: W.tone, course: W.course, blobs: W.riders.map((it) => ({ x: riders[it.id].gait.xs, z: riders[it.id].gait.lane })) });
    fogCol.set(fogHex); if (!stage.scene.fog) stage.scene.fog = new THREE.Fog(fogCol, 30, 300); else stage.scene.fog.color.copy(fogCol);
    wgroup.updateMatrixWorld(true);
    pm.copy(wgroup.matrixWorld); pq.setFromRotationMatrix(pm);
    cam.updateMatrixWorld(true);
    const heightPx = 1.75 * W.k * (devW / rc.w);
    const lod = heightPx < 80 ? 2 : heightPx < 200 ? 1 : 0;
    for (const r of riders) { r.h.root.visible = false; r.bike.group.visible = false; }
    for (const sp of specs) sp.h.root.visible = false;
    const drawn = new Set();
    for (const it of W.riders) {
      const r = riders[it.id]; if (!r) continue;
      r.h.root.visible = true; r.bike.group.visible = true;
      if (it.lookKey !== r.lastLook) {
        r.lastLook = it.lookKey;
        r.h.setKit({ top: it.jersey, bottoms: it.shorts || '#14161c', socks: '#f2f2f0', shoes: '#f3f3f0', trim: it.trim });
        r.h.setSkin(it.skin);
        r.helm[0].color.set(it.helmet);
        r.bike.frameMat.color.copy(col(it.frame));
      }
      r.bike.setNumber(it.num ?? it.id + 1);
      if (r.lod !== lod) { r.lod = lod; r.h.setLOD(lod); }
      const g = r.gait;
      const laneVel = dt > 0 ? g.dl / dt : 0;
      // head turn schedule: a quick look back over the shoulder every so often (and when asked)
      const period = 15 + 11 * ((it.id * 0.618) % 1), ph = ((t + it.id * 3.7) % period);
      const lookEnv = it.pose === 0 ? smooth01(ph / 0.45) * (1 - smooth01((ph - 1.1) / 0.5)) : 0;
      const sweatK = it.sweat ?? 0;
      const item = { phase: g.crank, spin: g.wheel, pose: it.pose, tilt: 0, effort: it.effort ?? 0.3, look: Math.max(lookEnv, it.lookBack ?? 0) };
      const pos = new Vector3(g.xs, 0, g.lane);
      // fast wheels read as a soft disc, not a strobing spoke pattern
      const bl = clamp((g.rate - 10) / 14, 0, 0.85);
      r.bike.setBlur(bl);
      poseOne(r, item, t, dt, W.k, rc, { pos, yaw: Math.PI / 2 - clamp(laneVel * 0.18, -0.25, 0.25), parentM: pm, parentQ: pq });
      r.sweat = sweatK;
      drawn.add(it.id);
    }
    for (const it of W.specs) {
      const sp = specs[it.id]; if (!sp) continue;
      sp.h.root.visible = true;
      if (it.lookKey !== sp.lastLook) { sp.lastLook = it.lookKey; sp.h.setKit({ top: it.top, bottoms: it.bottoms, socks: '#f2f2f0' }); sp.h.setSkin(it.skin); sp.h.setHair(it.hair); }
      if (sp.lod !== lod) { sp.lod = lod; sp.h.setLOD(lod); }
      poseSpec(sp, it, t, W.k, rc, { pos: new Vector3(it.s - W.camS * W.sw, 0, it.z), parentM: pm });
      drawn.add('s' + it.id);
    }
    for (const r of riders) if (r.h.root.visible) r.h.update(dt);
    for (const sp of specs) if (sp.h.root.visible) sp.h.update(dt);
    for (const r of riders) if (r.h.root.visible) r.h.update(0);
    for (const sp of specs) if (sp.h.root.visible) sp.h.update(0);
    // sweat drops fly back from the face of hard-working riders
    let n = 0;
    for (const r of riders) {
      if (!r.h.root.visible || !(r.sweat > 0.2)) continue;
      const head = r.h.bones.Bip01_Head; head.updateWorldMatrix(true, false);
      sp3.setFromMatrixPosition(head.matrixWorld); wgroup.worldToLocal(sp3);
      for (let i = 0; i < 4; i++) {
        const u = (t * (0.9 + 0.5 * r.sweat) + i * 0.25 + r.idx * 0.137) % 1;
        const x = sp3.x + 0.1 - u * 0.5 * (0.5 + r.gait.vis * 0.05), y = sp3.y - 0.06 - 9.81 * 0.5 * (u * 0.6) * (u * 0.6) - u * 0.04, z = sp3.z + 0.07 + (((r.idx * 7 + i * 3) % 5) - 2) * 0.02;
        sm.compose(sp3.set(x, y, z), sq.identity(), ssc.setScalar(1 - u * 0.5)); sweatMesh.setMatrixAt(n++, sm);
      }
    }
    sweatMesh.count = n; sweatMesh.instanceMatrix.needsUpdate = true;
    stage.render();
    ctx.drawImage(renderer.domElement, rc.x, rc.y, rc.w, rc.h);
    // projection helper for the 2D overlay (tags, gap labels): point in metres relative to the camera distance (x), height y, lane z
    const proj = (xm, ym, zm) => {
      sp3.set(xm, ym, zm).applyMatrix4(pm).project(cam);
      return { x: rc.x + (sp3.x + 1) / 2 * rc.w, y: rc.y + (1 - sp3.y) / 2 * rc.h };
    };
    const horizonY = yc - f * Math.tan(pitch);
    const ms = globalThis.performance.now() - t0;
    cost.ema = cost.n ? cost.ema * 0.95 + ms * 0.05 : ms; cost.n++;
    if (cost.n > 90 && cost.ema > 14 && api.quality !== 'low') { api.quality = 'low'; stage.setQuality('low'); }
    if (cost.n > 150 && cost.ema > 20 && (api.renderScale ?? 1) > 0.7) { api.renderScale = Math.max(0.7, (api.renderScale ?? 1) - 0.15); cost.n = 60; }
    return { drawn, project: proj, horizonY, scale: W.k };
  };

  // dev/measurement: joint positions (bike frame, metres) of every visible rider, plus the gait state
  api.snapshot = () => {
    const out = [], inv = new Matrix4();
    for (const r of riders) {
      if (!r.h.root.visible) continue;
      r.h.root.updateMatrixWorld(true); inv.copy(r.bike.group.matrixWorld).invert();
      const P = (n) => r.h.bones['Bip01_' + n].getWorldPosition(new Vector3()).applyMatrix4(inv).toArray().map((q) => +q.toFixed(4));
      const g = r.gait || {};
      const wp = r.h.root.getWorldPosition(new Vector3());
      out.push({ id: r.idx, wx: +wp.x.toFixed(4), wz: +wp.z.toFixed(4), wheel: g.wheel, crank: g.crank, gear: g.gear, lane: g.lane,
        j: { hipR: P('R_Thigh'), kneeR: P('R_Calf'), ankR: P('R_Foot'), hipL: P('L_Thigh'), kneeL: P('L_Calf'), ankL: P('L_Foot'), head: P('Head'), pel: P('Pelvis'), handR: P('R_Hand'), handL: P('L_Hand'), elbR: P('R_Forearm'), elbL: P('L_Forearm'), sh: P('R_UpperArm') } });
    }
    return out;
  };

  // body proportions measured once from the rest pose
  const r0 = riders[0];
  const wp = (n) => r0.h.bones[`Bip01_${n}`].getWorldPosition(new Vector3());
  r0.h._applyRest(); r0.h.root.updateMatrixWorld(true);
  const thigh = wp('R_Thigh').distanceTo(wp('R_Calf')), shin = wp('R_Calf').distanceTo(wp('R_Foot'));
  for (const r of riders) {
    r.thigh = thigh; r.shin = shin; r.legLen = thigh + shin;
    r.footRest = { R: r.h._restQ.R_Foot.clone(), L: r.h._restQ.L_Foot.clone() };
  }
  api.setTone('morning');
  api.measure = { thigh, shin, pelvis: r0.ph, ankleRest: r0.h._ankleRest };
  return {};
}

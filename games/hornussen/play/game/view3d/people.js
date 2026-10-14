// The people of the meadow, posed from the simulation state. Nothing here advances on its own clock: every pose is a pure function of
// (phase, tension, time since release, time since the throw), so the picture is identical in a screenshot, a replay and a live frame.
//
//   StrikerRig: a real athlete skeleton. Stands left and behind the Bock, right hand at the butt of the Träf and left hand 40 cm up the
//               rod. Wind-up swings the rod back over the right shoulder (the body turns away and leans back, the rod bows with the
//               tension); the strike drives the hips through, whips the rod over the shoulder down onto the puck on the Bock (the rod
//               tip lags behind the hands, then straightens exactly at contact) and follows through across the body.
//   FielderRig: an athlete holding a Schindel (a board on a pole) at his side, watching the puck; when tapped he side-steps, swings the
//               board up and throws it; the board flies to the height the puck will pass, hangs, then drops and sticks in the turf and
//               he picks it up again.
import { THREE } from '../vendor3d/index.js';
import { Actor } from './actor.js';
import { WHIP_T, BOARD, upWindow } from '../src/rules.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };   // quintic: zero velocity AND zero acceleration at both ends
const easeOut = (x) => { x = clamp(x, 0, 1); return 1 - (1 - x) * (1 - x); };
const DEG = Math.PI / 180;

// ---- the rod -------------------------------------------------------------------------------------------------------------------------
export const ROD_SEG = 18, ROD_SIDES = 6;
export function makeRod() {
  const n = (ROD_SEG + 1) * ROD_SIDES;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const idx = [];
  for (let i = 0; i < ROD_SEG; i++) for (let k = 0; k < ROD_SIDES; k++) {
    const a = i * ROD_SIDES + k, b = i * ROD_SIDES + (k + 1) % ROD_SIDES, c = a + ROD_SIDES, d = b + ROD_SIDES;
    idx.push(a, c, b, b, c, d);
  }
  geo.setIndex(idx);
  const mat = new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.42, metalness: 0.05 });   // ash rod, oiled walnut brown
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.castShadow = true;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.28, 10), new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 0.6 }));
  head.castShadow = true;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x4a2f18, roughness: 0.9 }));
  const g = new THREE.Group(); g.add(mesh, head, grip);
  const tmp = V(), t = V(), s = V(), u = V(), up = V(0, 1, 0), alt = V(1, 0, 0);
  g.userData.update = (pts, rBase = 0.032, rTip = 0.016) => {
    const pos = geo.attributes.position.array;
    for (let i = 0; i <= ROD_SEG; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(ROD_SEG, i + 1)];
      t.copy(b).sub(a).normalize();
      s.copy(t).cross(Math.abs(t.y) > 0.9 ? alt : up).normalize(); u.copy(s).cross(t).normalize();
      const r = lerp(rBase, rTip, i / ROD_SEG);
      for (let k = 0; k < ROD_SIDES; k++) {
        const ang = (k / ROD_SIDES) * Math.PI * 2, cs = Math.cos(ang) * r, sn = Math.sin(ang) * r;
        tmp.copy(pts[i]).addScaledVector(s, cs).addScaledVector(u, sn);
        const o = (i * ROD_SIDES + k) * 3; pos[o] = tmp.x; pos[o + 1] = tmp.y; pos[o + 2] = tmp.z;
      }
    }
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
    // weighted head: the last stretch of the rod
    const e = pts[ROD_SEG], p = pts[ROD_SEG - 1];
    t.copy(e).sub(p).normalize();
    head.position.copy(e).addScaledVector(t, -0.08); head.quaternion.setFromUnitVectors(up, t);
    // leather grip on the butt
    const b0 = pts[0], b1 = pts[1]; t.copy(b1).sub(b0).normalize();
    grip.position.copy(b0).addScaledVector(t, 0.3); grip.quaternion.setFromUnitVectors(up, t);
  };
  return g;
}

// ---- the board (Schindel) on its pole --------------------------------------------------------------------------------------------------
export const BOARD_W = 2.6, BOARD_H = 1.3, POLE_L = 2.1;
let boardTex = null;
function boardTexture() {
  if (boardTex) return boardTex;
  const c = globalThis.document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#d9a35a'; g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? 'rgba(120,70,20,0.18)' : 'rgba(255,235,180,0.18)'; g.fillRect(0, i * 25.6, 256, 25.6); g.fillStyle = 'rgba(70,35,10,0.6)'; g.fillRect(0, i * 25.6, 256, 2.5); }
  for (let i = 0; i < 120; i++) { g.fillStyle = 'rgba(80,45,15,0.18)'; g.fillRect((i * 53) % 256, (i * 29) % 128, 18 + (i % 7) * 6, 1); }
  g.strokeStyle = '#6b4423'; g.lineWidth = 12; g.strokeRect(6, 6, 244, 116);
  g.fillStyle = '#d93a2b'; g.fillRect(8, 8, 24, 112 - 4);   // a painted red end stripe: plain and visible from the far end
  boardTex = new THREE.CanvasTexture(c); boardTex.colorSpace = THREE.SRGBColorSpace; boardTex.anisotropy = 4;
  return boardTex;
}
export function makeBoard() {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W, BOARD_H, 0.07), new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.8 }));
  plate.castShadow = true; g.add(plate);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, POLE_L, 8), new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.85 }));
  pole.position.y = -BOARD_H / 2 - POLE_L / 2 + 0.2; pole.castShadow = true; g.add(pole);
  const brace = new THREE.Mesh(new THREE.BoxGeometry(0.1, BOARD_H * 1.0, 0.1), new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.85 }));
  brace.position.set(0, 0, 0.06); g.add(brace);
  g.userData.grip = -BOARD_H / 2 - 0.2 - 0.65;   // grip height on the pole, local y
  return g;
}

// ---- the puck (Nouss), its glow, tracer and shadow -------------------------------------------------------------------------------------
export function makePuck(root) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.0275, 0.0275, 0.024, 20), new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.45 }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0275, 0.005, 8, 24), new THREE.MeshStandardMaterial({ color: 0xff7a1c, roughness: 0.4, emissive: 0x552200 }));
  rim.rotation.x = Math.PI / 2;
  g.add(disc, rim); g.castShadow = true; root.add(g);
  const mk = (size, op) => { const c = globalThis.document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, `rgba(255,236,170,${op})`); gr.addColorStop(0.45, `rgba(255,170,60,${op * 0.55})`); gr.addColorStop(1, 'rgba(255,150,40,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; void size; return t; };
  const glowTex = mk(1, 1);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.renderOrder = 20; root.add(glow);
  const trail = [];
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false }));
    s.renderOrder = 19; s.visible = false; root.add(s); trail.push(s);
  }
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: 0x0a1e08, transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  sh.rotation.x = -Math.PI / 2; root.add(sh);
  return { group: g, glow, trail, shadow: sh };
}

// ---- kit -----------------------------------------------------------------------------------------------------------------------------------
export const SKINS = ['tan', 'light', 'brown', 'peach'];
export const HAIRS = ['brown', 'black', 'blond', 'ginger', 'brown', 'grey'];

// ---- the striker -----------------------------------------------------------------------------------------------------------------------
// The stance (world metres). The Bock is at the origin, the puck sits on it at (0, 0.7, 0).
export const STAND = { x: -1.55, z: -2.75 };
export const SEAT = V(0, 0.7, 0);
const IDLE = { h: [0.30, 1.00, 0.42], a: 24, b: 0.40, yaw: 0.30, twist: 0, bend: 5, shift: 0, drop: 0.03 };
const BACK = { h: [0.34, 1.50, -0.02], a: 128, b: 0.30, yaw: -0.38, twist: -26, bend: -7, shift: -0.14, drop: -0.02 };
const MID = { h: [0.14, 1.92, 0.24], a: 88, b: 0.36, yaw: 0.12, twist: -4, bend: 6, shift: 0.02, drop: 0.0 };
const CONTACT = { h: [-0.18, 1.2, 0.56], a: -12, b: 0.40, yaw: 0.78, twist: 24, bend: 26, shift: 0.22, drop: 0.12 };
const FOLLOW = { h: [-0.52, 1.5, 0.42], a: 38, b: 0.95, yaw: 0.98, twist: 32, bend: 14, shift: 0.3, drop: 0.05 };
const mix = (A, B, u) => ({ h: [lerp(A.h[0], B.h[0], u), lerp(A.h[1], B.h[1], u), lerp(A.h[2], B.h[2], u)], a: lerp(A.a, B.a, u), b: lerp(A.b, B.b, u), yaw: lerp(A.yaw, B.yaw, u), twist: lerp(A.twist, B.twist, u), bend: lerp(A.bend, B.bend, u), shift: lerp(A.shift, B.shift, u), drop: lerp(A.drop, B.drop, u) });

export class StrikerRig {
  constructor(human) {
    this.h = human; this.a = new Actor(human);
    this.stand = this.a.pelvisRest.y - 0.05;
    this.rod = makeRod();
    this.pts = Array.from({ length: ROD_SEG + 1 }, () => V());
    this.hand = V(); this.left = V(); this.out = { head: V() }; this.xz = { x: STAND.x, z: STAND.z };
    // the rod's length is whatever puts its tip exactly on the puck at the moment of contact (computed from the contact pose)
    const hc = this.handWorld(CONTACT);
    this.Lr = hc.distanceTo(SEAT);
    const d = SEAT.clone().sub(hc);
    this.contact = { a: Math.asin(d.y / this.Lr), b: Math.atan2(d.x, d.z) };
    // feet: planted for the whole swing (front foot toward the Bock, rear foot behind and to the right)
    const f0 = V(Math.sin(IDLE.yaw), 0, Math.cos(IDLE.yaw)), r0 = V(-Math.cos(IDLE.yaw), 0, Math.sin(IDLE.yaw));
    const base = V(STAND.x, 0, STAND.z);
    this.footL = base.clone().addScaledVector(f0, 0.34).addScaledVector(r0, -0.2);
    this.footR = base.clone().addScaledVector(f0, -0.28).addScaledVector(r0, 0.22);
  }
  pelvisXZ(P) { const f = V(Math.sin(P.yaw), 0, Math.cos(P.yaw)); return V(STAND.x + f.x * P.shift, 0, STAND.z + f.z * P.shift); }
  handWorld(P) {
    const f = V(Math.sin(P.yaw), 0, Math.cos(P.yaw)), r = V(-Math.cos(P.yaw), 0, Math.sin(P.yaw)), o = this.pelvisXZ(P);
    return V(o.x + r.x * P.h[0] + f.x * P.h[2], P.h[1], o.z + r.z * P.h[0] + f.z * P.h[2]);
  }
  // the pose at `tau` seconds from the release (negative = still holding: `w` is the wind-up amount 0..1)
  poseAt(tau, w, k0) {
    if (tau == null) return mix(IDLE, BACK, smooth(w));
    const B = mix(IDLE, BACK, smooth(k0));
    const C = { ...CONTACT, a: this.contact ? this.contact.a / DEG : CONTACT.a, b: this.contact ? this.contact.b : CONTACT.b };
    if (tau <= 0) return B;
    if (tau < WHIP_T) {
      const s = tau / WHIP_T, u = Math.pow(s, 1.55);
      // hands and rod: one C1 Hermite path B -> MID -> C (velocity continuous at MID, arriving at contact at full speed)
      const herm = (x0, x1, m0, m1, v) => (2 * v * v * v - 3 * v * v + 1) * x0 + (v * v * v - 2 * v * v + v) * 0.5 * m0 + (-2 * v * v * v + 3 * v * v) * x1 + (v * v * v - v * v) * 0.5 * m1;
      const hk = (b, m, c) => { const vm = (c - b) * 1.25, vc = (c - m) * 2.0; return u < 0.5 ? herm(b, m, 0, vm, u / 0.5) : herm(m, c, vm, vc, (u - 0.5) / 0.5); };
      const arms = { ...B, h: [hk(B.h[0], MID.h[0], C.h[0]), hk(B.h[1], MID.h[1], C.h[1]), hk(B.h[2], MID.h[2], C.h[2])], a: hk(B.a, MID.a, C.a), b: hk(B.b, MID.b, C.b) };
      // the trunk (hips lead, then shoulders) eases into the contact pose with zero velocity: only the hands and rod arrive at full speed
      const bu = smooth(Math.pow(s, 0.85)), body = mix(B, C, bu);
      return { ...arms, yaw: body.yaw, twist: lerp(B.twist, C.twist, smooth(clamp((s - 0.05) / 0.95, 0, 1))), bend: body.bend, shift: body.shift, drop: body.drop };
    }
    const f = tau - WHIP_T;
    // follow-through: a cubic Hermite that leaves the contact pose with exactly the velocity the whip arrives with (no velocity snap at
    // the moment the rod meets the puck), then glides to the follow pose and back to the stance
    const Tf = 0.35, s = clamp(f / Tf, 0, 1), h00 = 2 * s * s * s - 3 * s * s + 1, h10 = s * s * s - 2 * s * s + s, h01 = -2 * s * s * s + 3 * s * s;
    const WV = 15.5 * Tf;                 // contact velocity of the whip in pose units per (pose delta) over the follow window
    const hz = (c, m, fo) => h00 * c + h10 * WV * (c - m) + h01 * fo;
    const hb = (c, m, fo) => h00 * c + h01 * fo;           // trunk: arrives at rest
    const F = { h: [hz(C.h[0], MID.h[0], FOLLOW.h[0]), hz(C.h[1], MID.h[1], FOLLOW.h[1]), hz(C.h[2], MID.h[2], FOLLOW.h[2])], a: hz(C.a, MID.a, FOLLOW.a), b: hz(C.b, MID.b, FOLLOW.b), yaw: hb(C.yaw, MID.yaw, FOLLOW.yaw), twist: hb(C.twist, MID.twist, FOLLOW.twist), bend: hb(C.bend, MID.bend, FOLLOW.bend), shift: hb(C.shift, MID.shift, FOLLOW.shift), drop: hb(C.drop, MID.drop, FOLLOW.drop) };
    return mix(F, IDLE, smooth((f - 0.45) / 1.0));
  }
  // rod direction (elevation a, azimuth b in radians from +z toward +x)
  static dirOf(a, b, out) { const ca = Math.cos(a); return out.set(Math.sin(b) * ca, Math.sin(a), Math.cos(b) * ca); }
  // env: { w, tau, k0, tgt: Vector3 (what he looks at), team, dt, rest }
  step(env) {
    const h = this.h, a = this.a;
    const P = this.poseAt(env.tau, env.w, env.k0);
    const handW = this.handWorld(P);
    // a hint of tremble at full tension
    if (env.tau == null && env.w > 0.82) { handW.x += Math.sin(env.t * 53) * 0.006; handW.y += Math.cos(env.t * 47) * 0.005; }
    // rod: each segment follows the pose a little later than the hands (the tip lags while the hands accelerate, then rings after contact)
    const tau = env.tau;
    const strike = tau != null && tau > 0 && tau < WHIP_T;
    const lagAmp = tau == null ? 0 : strike ? 0.085 * Math.sin(Math.PI * clamp(tau / WHIP_T, 0, 1)) ** 0.8 : tau >= WHIP_T ? 0 : 0;
    const bow = (tau == null ? 0.55 * smooth(env.w) : clamp(this.bowAfter(tau, env.k0), -0.8, 0.8));
    const d0 = V(), hp = this.pts[0].copy(handW);
    const dh = StrikerRig.dirOf(P.a * DEG, P.b, V());
    hp.addScaledVector(dh, -0.18);                // the butt end of the rod sticks out behind the hand
    const segL = (this.Lr + 0.18) / ROD_SEG;
    const side = V(Math.cos(P.b), 0, -Math.sin(P.b));
    let cur = hp.clone();
    for (let i = 1; i <= ROD_SEG; i++) {
      const s = (i - 0.5) / ROD_SEG;
      let pa = P.a, pb = P.b;
      if (tau != null && lagAmp > 0) { const Q = this.poseAt(tau - lagAmp * Math.pow(s, 1.25), env.w, env.k0); pa = Q.a; pb = Q.b; }
      else if (tau != null && tau >= WHIP_T) {
        const f = tau - WHIP_T, ring = 0.16 * Math.exp(-f * 6) * Math.sin(f * 34) * s * s;
        pa = P.a - ring / DEG * 6; pb = P.b + 0;
      }
      const dirv = StrikerRig.dirOf(pa * DEG, pb, d0);
      // bow: curve the rod toward the direction it is about to move (down and forward) in proportion to the load
      const down = V(0, -1, 0).addScaledVector(dirv, V(0, -1, 0).dot(dirv) * -1).normalize();
      dirv.addScaledVector(down, bow * 0.22 * (0.2 + s * 1.3)).normalize();
      cur.addScaledVector(dirv, segL);
      this.pts[i].copy(cur);
    }
    void side;
    this.rod.userData.update(this.pts, 0.032 * (env.rodK || 1), 0.016 * (env.rodK || 1));
    // left hand: 42 cm up the rod from the right hand
    const dd = this.pts[3].clone().sub(this.pts[0]).normalize();
    this.left.copy(handW).addScaledVector(dd, 0.42);
    // the body
    const yaw = P.yaw, o = this.pelvisXZ(P);
    const pel = V(o.x, this.stand - P.drop - 0.03, o.z);
    this.xz.x = o.x; this.xz.z = o.z;
    const f = V(Math.sin(yaw), 0, Math.cos(yaw));
    const r = V(-Math.cos(yaw), 0, Math.sin(yaw));
    // weight transfer: the front foot steps into the swing, the rear heel rolls up as the weight comes over the front leg, then both settle back
    const sw = tau == null || tau <= 0 ? 0 : tau < WHIP_T ? smooth(tau / WHIP_T) : 1, rec = tau != null && tau > WHIP_T ? 1 - smooth((tau - WHIP_T - 0.7) / 0.9) : 1;
    const stepK = sw * rec, strideL = 0.17 * stepK, strideR = 0.07 * stepK, heel = 0.07 * stepK;
    h.setPosition(0, 0, 0); h.setFacing(0); h.update(env.dt || 0);
    const Pz = {
      pelvis: pel, yaw, groundY: 0,
      torso: { bend: P.bend, side: 0, twist: P.twist },
      pelvisTilt: { bend: 0, side: 0, twist: 0 },
      legs: {
        L: { p: [this.footL.x + f.x * strideL, 0.075 + a.groundAnkle - 0.04, this.footL.z + f.z * strideL], f: 'w', w: 1, pole: [f.x, 0.1, f.z], pf: 'w', aim: { n: [0, 1, 0], face: 'sole', fwd: [f.x, 0, f.z], w: 0 } },
        R: { p: [this.footR.x + f.x * strideR, 0.075 + a.groundAnkle - 0.04 + heel, this.footR.z + f.z * strideR], f: 'w', w: 1, pole: [f.x, 0.1, f.z], pf: 'w', aim: { n: [0, 1, 0], face: 'sole', fwd: [f.x, 0, f.z], w: 0 } },
      },
      arms: {
        R: { p: [handW.x, handW.y, handW.z], f: 'w', w: 1, pole: [r.x * 0.9 - f.x * 0.3, -0.5, r.z * 0.9 - f.z * 0.3], pf: 'w' },
        L: { p: [this.left.x, this.left.y, this.left.z], f: 'w', w: 1, pole: [-r.x * 0.7 - f.x * 0.2, -0.6, -r.z * 0.7 - f.z * 0.2], pf: 'w' },
      },
      look: env.tgt ? { target: env.tgt, w: 0.9 } : null,
    };
    a.apply(Pz, env.dt || 0);
    h.setFingers('L', 'fist'); h.setFingers('R', 'fist');
    h.bonePosition('Head', this.out.head);
    // the real right hand is where the rod starts (keeps the rod in the hand even when the target was a little out of reach)
    h.bonePosition('R_Hand', this.hand);
    this.last = P;
  }
  bowAfter(tau, k0) { return tau <= 0 ? 0.55 * smooth(k0) : tau < WHIP_T ? 0.55 * smooth(k0) * (1 - tau / WHIP_T) + 0.35 * Math.sin(Math.PI * tau / WHIP_T) : -0.3 * Math.exp(-(tau - WHIP_T) * 8) * Math.cos((tau - WHIP_T) * 26); }
}

// ---- a fielder ---------------------------------------------------------------------------------------------------------------------------------
export class FielderRig {
  constructor(human, f, idx, k = 1) {
    this.h = human; this.a = new Actor(human); this.f = f; this.idx = idx; this.k = k;
    this.stand = this.a.pelvisRest.y - 0.04 * k;
    this.board = makeBoard();
    this.sx = 0; this.sxPrev = 0;
    this.pelvis = V(); this.hand = V();
    this.grip = this.board.userData.grip;
    this.ph = idx * 1.37;
  }
  // The board's world centre for a throw q at `tau` seconds after the tap (q null / tau null = carried). Plate centre height when the
  // pole stands upright in the turf, or is held at the hip, is the same: pole tip at the ground.
  boardAt(f, q, tau, level) {
    const k = this.k, upB = upWindow(level)[1], fall = 0.55;
    const cy = 0.95 * k - this.grip;                                      // plate centre when carried / planted
    const carried = V(f.x + 0.5 * k, cy, f.z - 0.2 * k);
    if (!q || tau == null || tau < 0) return { c: carried, stage: 'carry', rot: 0 };
    const peak = clamp(q.peak, 2.6, BOARD.reach), tx = f.x + q.sx;
    if (tau < 0.3) {
      const u = easeOut(tau / 0.3);
      return { c: V(lerp(carried.x, tx, u), lerp(cy, peak, u), f.z), stage: 'throw', rot: -0.35 * (1 - u), u: tau / 0.3 };
    }
    if (tau < upB) return { c: V(tx, peak + 0.12 * Math.sin((tau - 0.3) * 9), f.z), stage: 'up', rot: Math.sin(tau * 5) * 0.06 };
    if (tau < upB + fall) {
      const u = (tau - upB) / fall;
      return { c: V(tx, lerp(peak, cy, u * u), f.z), stage: 'fall', rot: 0.5 * u * Math.sin(u * 8) * (1 - u), u };
    }
    const t2 = tau - upB - fall;
    if (t2 < 0.35) return { c: V(tx, cy, f.z), stage: 'planted', rot: 0.05 * Math.exp(-t2 * 9) * Math.sin(t2 * 40), t2 };
    const u = smooth((t2 - 0.35) / 0.5);
    if (u >= 1) return { c: carried, stage: 'carry', rot: 0 };
    return { c: V(lerp(tx, carried.x, u), cy, f.z), stage: 'pickup', rot: 0, u };
  }
  // env: { dt, t, q (throw), tau, level, puck: Vector3|null, scale, face (yaw) , stop: bool }
  step(env) {
    const h = this.h, a = this.a, f = this.f, k = this.k;
    const yaw = Math.PI;                                  // facing the Bock
    const B = this.boardAt(f, env.q, env.tau, env.level);
    // sidestep with the throw
    const tgtSx = env.q && env.tau != null && env.tau >= 0 && env.tau < 1.9 ? clamp(env.q.sx, -1.6, 1.6) : 0;
    const stepU = env.q && env.tau != null ? smooth(env.tau / 0.3) : 0;
    const back = env.q && env.tau != null ? 1 - smooth((env.tau - 1.4) / 0.6) : 0;
    this.sx = tgtSx * stepU * back;
    const root = V(f.x + this.sx, 0, f.z);
    const idle = Math.sin(env.t * 1.5 + this.ph) * 0.012;
    // arms
    const stage = B.stage;
    let hr, hl = null, lean = 0, twist = 0, bendT = 3;
    const grip = V(f.x + 0.5 * k, 0.95 * k, f.z - 0.2 * k);
    if (stage === 'carry') hr = grip.clone();
    else if (stage === 'throw') {
      const u = B.u;
      // wind under the board, then the arm drives up and forward
      const back = V(f.x + 0.45 * k, 0.55 * k, f.z + 0.35 * k), up = V(root.x + 0.2 * k, 2.25 * k, f.z - 0.35 * k);
      hr = u < 0.35 ? grip.clone().lerp(back, smooth(u / 0.35)) : back.clone().lerp(up, easeOut((u - 0.35) / 0.65));
      bendT = u < 0.35 ? 18 * u / 0.35 : lerp(18, -14, smooth((u - 0.35) / 0.65)); twist = u < 0.35 ? 10 : -10;
    } else if (stage === 'up' || stage === 'fall') {
      hr = V(root.x + 0.15 * k, 2.3 * k, f.z - 0.2 * k); hl = V(root.x - 0.2 * k, 2.15 * k, f.z - 0.2 * k); bendT = -14;
      if (stage === 'fall') { const u = B.u; hr.y = lerp(2.3 * k, 1.1 * k, smooth(u)); hl = null; bendT = lerp(-14, 3, smooth(u)); }
    } else if (stage === 'planted') hr = V(B.c.x + 0.3 * k, 1.0 * k, f.z - 0.1 * k);
    else hr = V(B.c.x, B.c.y + this.grip, B.c.z);   // pickup: the hand follows the pole back up
    const look = env.puck || null;
    h.setPosition(0, 0, 0); h.setFacing(0); h.update(env.dt || 0);
    // legs: a small footstep controller. A foot stays planted until the body has moved more than a step length away, then it steps
    // across over 0.16 s with a lift (a real side-shuffle: cadence follows the distance travelled, stationary = both feet down).
    const fs = this.feet || (this.feet = { x: [root.x + 0.14, root.x - 0.14], st: [null, null], next: 0 });
    const want = [root.x + 0.14, root.x - 0.14], dtt = env.dt || 0;
    if (!dtt) { fs.x[0] = want[0]; fs.x[1] = want[1]; fs.st = [null, null]; }
    for (let i = 0; i < 2; i++) {
      const s = fs.st[i];
      if (s) { s.u += dtt / 0.16; if (s.u >= 1) { fs.x[i] = s.to; fs.st[i] = null; } }
    }
    if (!fs.st[0] && !fs.st[1]) {
      const e0 = Math.abs(want[0] - fs.x[0]), e1 = Math.abs(want[1] - fs.x[1]);
      if (Math.max(e0, e1) > 0.2) { const i = e0 >= e1 ? 0 : 1; fs.st[i] = { from: fs.x[i], to: want[i] + Math.sign(want[i] - fs.x[i]) * 0.1, u: 0 }; }
    }
    const footAt = (i) => { const s = fs.st[i]; if (!s) return { x: fs.x[i], y: 0 }; const u = smooth(s.u); return { x: lerp(s.from, s.to, u), y: 0.1 * Math.sin(Math.PI * clamp(s.u, 0, 1)) }; };
    const fL = footAt(0), fR = footAt(1);
    const lift = 0;
    const pel = V(root.x, this.stand - 0.03 + idle - (stage === 'throw' ? 0.06 : 0), root.z);
    const P = {
      pelvis: pel, yaw, groundY: 0,
      torso: { bend: bendT, side: lean, twist },
      pelvisTilt: { bend: 0, side: 0, twist: 0 },
      legs: {
        L: { p: [fL.x, 0.075 + a.groundAnkle - 0.04 + fL.y + lift, root.z], f: 'w', w: 1, pole: [0, 0.1, -1], pf: 'w', aim: { n: [0, 1, 0], face: 'sole', fwd: [0, 0, -1], w: 0 } },
        R: { p: [fR.x, 0.075 + a.groundAnkle - 0.04 + fR.y, root.z], f: 'w', w: 1, pole: [0, 0.1, -1], pf: 'w', aim: { n: [0, 1, 0], face: 'sole', fwd: [0, 0, -1], w: 0 } },
      },
      arms: { R: { p: [hr.x, hr.y, hr.z], f: 'w', w: 1, pole: [0.8, -0.4, 0.3], pf: 'w' }, L: hl ? { p: [hl.x, hl.y, hl.z], f: 'w', w: 1, pole: [-0.8, -0.2, 0.3], pf: 'w' } : null },
      look: look ? { target: look, w: 0.85 } : { target: V(f.x, 1.5, f.z - 30), w: 0.5 },
    };
    // the arms are posed in the unscaled body; a scaled human scales its own limbs, so targets are expressed relative to the root
    a.apply(P, env.dt || 0);
    h.setFingers('R', 'fist');
    // the board sits on the pole where the hand is while carried, thrown / planted otherwise
    const b = this.board;
    if (B.stage === 'carry' || B.stage === 'pickup' || B.stage === 'planted') { /* position from the timeline */ }
    b.position.copy(B.c); b.rotation.set(0, 0, B.rot || 0);
    if (env.recoil) { b.position.z += env.recoil * 0.35; b.rotation.x = -0.18 * env.recoil; }
    this.stage = stage; this.board.userData.stage = stage;
    return B;
  }
}

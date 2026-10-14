// People: the thrower (one looping clip indexed by the swing angle, the right hand placed by IK on the boot's rim), the judge with the tape
// reel, and the farm-fair clothes (jeans, check shirt, cap, tall green wellies on the thrower's own feet).
import { ARM_R, PIVOT_Y } from '../src/consts.js';
import { BOOT_COM, makeBoot } from './boot.js';

const TAU = Math.PI * 2;
export const FIST_Z = 0.082;
export const SHOULDER_Z = -0.075;               // the shoulder sits behind the swing plane so the arm swings clear of the leg                   // the fist sits this far outside the boot's wall (towards the camera)
const D2R = Math.PI / 180;

/** World position of the rim centre and the fist target for the boot hanging from the shoulder circle at angle phi (sim axes, z = 0 plane). */
export function holdPoints(phi, theta = phi, out = {}) {
  const s = Math.sin(phi), c = Math.cos(phi), st = Math.sin(theta), ct = Math.cos(theta);
  const px = ARM_R * s, py = PIVOT_Y - ARM_R * c;
  const rx = BOOT_COM[0] * ct - BOOT_COM[1] * st, ry = BOOT_COM[0] * st + BOOT_COM[1] * ct;     // R(theta) * COM
  out.rim = [px - rx, py - ry, 0];
  out.fist = [px - rx, py - ry, FIST_Z];
  out.r = [st, -ct];                                // shaft direction, rim -> sole
  return out;
}

const SUB = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const LEN = (a) => Math.hypot(a[0], a[1], a[2]);

export class Thrower {
  /** h: a loaded athlete (root at the origin facing +X). Builds the clip with the body shifting under the arm so the hand always reaches the rim. */
  constructor(V3, h) {
    this.V3 = V3; this.h = h;
    const { THREE } = V3;
    this.THREE = THREE;
    const sc = (h.info && h.info.height ? h.info.height / 1.74 : 1) * (h.scale || 1);
    this.sc = sc;
    h.setFacing(Math.PI / 2);
    h.setPosition(0, 0, 0);
    // neutral pose measurement: stance clip with no shift
    const probe = this._build(0, null);
    h.addClip(probe); h.play(probe.name, { fade: 0, loop: false });
    const tr = h.current; tr.speed = 0; tr.time = 0;
    h.update(0.001);
    const v = new THREE.Vector3();
    const S = h.bonePosition('R_UpperArm', v).clone(), E = h.bonePosition('R_Forearm', new THREE.Vector3()).clone(), Hd = h.bonePosition('R_Hand', new THREE.Vector3()).clone();
    this.armLen = S.distanceTo(E) + E.distanceTo(Hd);
    this.S0 = [S.x, S.y, S.z];
    // the shoulder should be at (0, PIVOT_Y, FIST_Z): the root moves in x and z; the pelvis dips (knees bend) to reach the height
    this.dip = Math.max(0, S.y - PIVOT_Y);
    this.rootOff = [-S.x, 0, SHOULDER_Z - S.z];
    // the keys: for every angle, how far the body must lean/shift so the wrist is within 93% of the arm length
    const N = 36, shift = [];
    for (let k = 0; k <= N; k++) {
      const phi = (k / N) * TAU, hp = holdPoints(phi);
      const wrist = [hp.fist[0] - hp.r[0] * 0.07, hp.fist[1] - hp.r[1] * 0.07, hp.fist[2]];
      const sh = [0, PIVOT_Y, SHOULDER_Z];                                  // where the shoulder is when the body is neutral (after dip and root shift)
      const d = SUB(wrist, sh), L = LEN(d), need = Math.max(0, L - 0.97 * this.armLen);
      shift.push(need > 0 ? [d[0] / L * need, d[1] / L * need] : [0, 0]);
    }
    this.shift = shift;
    const clip = this._build(this.dip, shift);
    h.addClip(clip); this.clipName = clip.name;
    h.play(clip.name, { fade: 0, loop: false });
    const t2 = h.current; t2.speed = 0; t2.time = 0;
    h.setPosition(this.rootOff[0], 0, this.rootOff[2]);
    h.update(0.001);
    this.clip = clip;
  }

  _build(dip, shift) {
    const { buildClip } = this.V3, h = this.h, sc = this.sc;
    const N = 36, keys = [], ikR = [], ikRp = [];
    const S = (a) => a.map((v) => v * sc);
    for (let k = 0; k <= N; k++) {
      const u = k / N, p = u * TAU, s = Math.sin(p), c = Math.cos(p);
      const sh = shift ? shift[k] : [0, 0];
      keys.push({ t: u, ease: 'linear', pose: {
        Pelvis: { pos: [0, -dip - 0.022 * c + sh[1] * 0.5, sh[0] * 0.8 + 0.02 * s], twist: -6 * s - 4, side: 2 * s },
        Spine: { flex: 7 + 7 * s + 3 * Math.max(0, c), twist: -10 + 11 * s, side: -3 * s },
        Spine1: { flex: 0 }, Spine2: { flex: 0 },
        Neck: { flex: -6 - 4 * s, twist: -4 * s }, Head: { flex: -3, twist: 3 },
        R_UpperArm: { flex: 0 }, R_Forearm: { flex: 8 },
        L_UpperArm: { flex: -26 * s + 4, abduct: 16 + 8 * c }, L_Forearm: { flex: 20 + 8 * Math.abs(s) },
        R_Thigh: { flex: 12 + 6 * c + 3 * s, abduct: 4 }, R_Calf: { flex: 16 + 8 * c },
        L_Thigh: { flex: 20 + 5 * c, abduct: 3 }, L_Calf: { flex: 24 + 8 * c },
      } });
      ikR.push({ t: u, pos: [0, 0, 0] }); ikRp.push({ t: u, pos: [0, 0, 0] });
    }
    // feet planted: staggered stance, the left foot forward (+x char = left)
    const FR = S([-0.19, 0.06, -0.2]), FL = S([0.17, 0.06, 0.2]);
    return buildClip(h, {
      name: shift ? 'wind-cycle' : 'wind-probe', duration: 1, fps: 60, base: { clip: 'idle_relaxed', time: 0 }, loop: true, grounded: true,
      fingers: 'relaxed', keys,
      ik: {
        R_Foot: { keys: [{ t: 0, pos: FR }], pole: [{ t: 0, pos: S([-0.25, 0.5, 0.8]) }] },
        L_Foot: { keys: [{ t: 0, pos: FL }], pole: [{ t: 0, pos: S([0.22, 0.5, 0.9]) }] },
      },
    });
  }

  /** Scrub the cycle to swing angle phi (radians, any range). */
  scrub(phi) {
    const u = ((phi / TAU) % 1 + 1) % 1;
    const tr = this.h.current;
    if (tr && tr.clip && tr.clip.name === this.clipName) { tr.speed = 0; tr.warp = null; tr.time = u * tr.clip.dur; }
  }
}

// ---- clothes -----------------------------------------------------------------------------------------------------------------------------
export function dressThrower(V3, h, { jeans = 0x2e4a74, wellie = 0x2f6b36, cap = 0xd8cfae } = {}) {
  const { THREE, addWhites, addCap } = V3;
  const mat = (c, r = 0.8, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const parts = [];
  try { parts.push(addWhites(h, { color: jeans })); } catch (e) { /* athlete_f already wears trousers */ }
  try { parts.push(addCap(h, { color: cap })); } catch (e) { /* ignore */ }
  // wellies: the same sculpted boot as the one that flies, worn on each foot. Placed every frame from the ankle and toe bones (sole on the
  // ground, toe along the foot, pitch with the heel lift) by update(), so it never depends on the bone's own axes.
  const clampP = (v) => Math.max(-0.5, Math.min(0.7, v));
  // shirt: a thin plaid + fold-shaded overlay on the torso (multiplies the flat kit colour with cloth lines, side shading and creases)
  try {
    const sp = h.bones.Bip01_Spine1, sp0 = h.bones.Bip01_Spine, nk = h.bones.Bip01_Neck;
    if (false && sp && nk && sp0) {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const g = cv.getContext('2d');
      g.clearRect(0, 0, 256, 256);
      g.fillStyle = 'rgba(70,0,0,0.30)'; for (let i = 0; i < 8; i++) g.fillRect(i * 32 + 6, 0, 14, 256);
      for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(70,0,0,0.30)'; g.fillRect(0, i * 32 + 6, 256, 14); }
      g.fillStyle = 'rgba(255,230,200,0.16)'; for (let i = 0; i < 8; i++) g.fillRect(i * 32 + 24, 0, 3, 256);
      for (let i = 0; i < 6; i++) { const y = 30 + i * 38; const gr = g.createLinearGradient(0, y, 0, y + 22); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, y, 256, 22); }
      const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 1.4); tex.colorSpace = THREE.SRGBColorSpace;
      const pa = sp.getWorldPosition(new THREE.Vector3()), pn = nk.getWorldPosition(new THREE.Vector3());
      const len = pa.distanceTo(pn) * 1.25, Hs = h.info.height ? h.info.height / 1.8 : 1;
      const geo = new THREE.CylinderGeometry(0.152 * Hs, 0.14 * Hs, len, 28, 4, true); geo.scale(1.0, 1, 0.68);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.FrontSide }));
      const dl = nk.getWorldPosition(new THREE.Vector3()).sub(sp.getWorldPosition(new THREE.Vector3())).applyQuaternion(sp.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dl);
      m.position.copy(dl).multiplyScalar(len * 0.22);
      sp.add(m); parts.push({ remove() { sp.remove(m); } });
    }
  } catch (e) { /* optional */ }
  const wellies = [];
  const H = h.info.height ? h.info.height / 1.8 : 1;
  for (const side of ['L', 'R']) {
    const foot = h.bones[`Bip01_${side}_Foot`], toe = h.bones[`Bip01_${side}_Toe0`];
    if (!foot || !toe) continue;
    const w = makeBoot(THREE, { colour: '#2f6b36', sole: '#141b16', mud: 0.55, seed: side === 'L' ? 11 : 12, scale: 1, footOnly: true });
    const calf = h.bones[`Bip01_${side}_Calf`];
    if (calf) {
      const dir = foot.position.clone(), len = dir.length(); dir.normalize();
      const rub = new THREE.MeshPhysicalMaterial({ color: 0x2f6b36, roughness: 0.34, clearcoat: 0.5, clearcoatRoughness: 0.3, side: THREE.DoubleSide });
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.068 * H, 0.056 * H, len * 0.72, 22, 1, true), rub);
      sh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); sh.position.copy(dir).multiplyScalar(len * 0.64); sh.castShadow = true; calf.add(sh);
      const rm = new THREE.Mesh(new THREE.TorusGeometry(0.068 * H, 0.008, 8, 24), rub); rm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir); rm.position.copy(dir).multiplyScalar(len * 0.28); rm.castShadow = true; calf.add(rm);
      parts.push({ remove() { calf.remove(sh); calf.remove(rm); } });
    }
    w.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    h.root.parent.add(w);
    wellies.push({ w, foot, toe });
  }
  const A = new THREE.Vector3(), T = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), off = new THREE.Vector3();
  const ax = new THREE.Vector3(0, 1, 0), az = new THREE.Vector3(0, 0, 1);
  const k = h.scale || 1;
  const update = () => {
    for (const e of wellies) {
      e.foot.getWorldPosition(A); e.toe.getWorldPosition(T);
      const dx = T.x - A.x, dz = T.z - A.z, dy = T.y - A.y;
      const yaw = Math.atan2(-dz, dx), hor = Math.hypot(dx, dz), pitch = Math.atan2(dy, Math.max(0.02, hor));
      q1.setFromAxisAngle(ax, yaw); q2.setFromAxisAngle(az, clampP(pitch - 0.0));
      e.w.quaternion.copy(q1).multiply(q2);
      off.set(0.02 * k, -0.27 * k, 0).applyQuaternion(e.w.quaternion);
      e.w.position.copy(A).sub(off);
      e.w.scale.setScalar(k);
    }
  };
  update();
  parts.push({ remove() { wellies.forEach((e) => e.w.parent && e.w.parent.remove(e.w)); } });
  return { parts, update, remove() { parts.forEach((p) => p.remove && p.remove()); } };
}

// The people of the boat: skinned athletes dressed as a Gulf pearling crew (long robes and head cloths for the captain, singer, cook and merchant; wrap cloths and bare chests for the
// divers), and the clips for singing, clapping, stirring, steering, hauling, breathing and swimming. Presentation only.
import { buildClip, loadHuman, THREE } from '../vendor3d/index.js';
import { mergeInto, hex } from './world.js';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const CLIPS = new WeakSet();
const TAU = Math.PI * 2;
export function addSeaClips(h) {
  if (CLIPS.has(h)) return; CLIPS.add(h);
  const make = (spec) => { h.addClip(buildClip(h, { group: 'sea', ...spec })); };
  const loopOf = (name, dur, N, f, o = {}) => { const keys = []; const drop = name.startsWith('sea_') ? -58 : 0; for (let i = 0; i <= N; i++) { const pose = f(i / N); if (drop) for (const b of ['L_UpperArm', 'R_UpperArm']) { const q = pose[b] || {}; pose[b] = { ...q, abduct: (q.abduct || 0) + drop }; } keys.push({ t: (i / N) * dur, pose, ease: 'linear' }); } make({ name, duration: dur, loop: true, base: 'rest', keys, fingers: 'relaxed', ...o }); };
  const sw = (ph, a) => a * Math.sin(TAU * ph);
  // relaxed standing, a slow sway
  loopOf('sea_idle', 3.6, 12, (p) => ({ Pelvis: { pos: [0, -0.005, 0], side: sw(p, 1.0) }, Spine1: { side: sw(p, 1.2), flex: 1.5 }, Neck: { flex: 2 }, Head: { twist: sw(p + 0.2, 4) }, L_UpperArm: { flex: 3, abduct: 6 }, R_UpperArm: { flex: 3, abduct: 6 }, L_Forearm: { flex: 12 }, R_Forearm: { flex: 12 } }));
  // the singer: head lifted, one hand cupped to the ear, the other open, swaying with the verse
  loopOf('sea_sing', 3.2, 16, (p) => ({ Pelvis: { side: sw(p, 2.2), pos: [0.01 * Math.sin(TAU * p), -0.01, 0] }, Spine1: { side: sw(p, 3), flex: -3 }, Neck: { flex: -8 }, Head: { flex: -10, twist: sw(p, 6) },
    R_UpperArm: { flex: 22, abduct: 128 }, R_Forearm: { flex: 128 }, L_UpperArm: { flex: 16 + sw(p, 10), abduct: 34 }, L_Forearm: { flex: 36 + sw(p, 8) } }), { fingers: 'open' });
  // clapping on the beat (period 0.55 s, the song's beat)
  loopOf('sea_clap', 0.55, 8, (p) => { const c = 0.5 + 0.5 * Math.cos(TAU * p); return { Pelvis: { pos: [0, -0.012 - 0.012 * c, 0] }, Spine1: { flex: 2 + 2 * c }, Head: { flex: -2 }, L_UpperArm: { flex: 46, abduct: 10 + 14 * c }, R_UpperArm: { flex: 46, abduct: 10 + 14 * c }, L_Forearm: { flex: 92 - 8 * c }, R_Forearm: { flex: 92 - 8 * c } }; }, { fingers: 'open' });
  // the cook, stirring: leaning to the pot, a circling forearm
  loopOf('sea_stir', 1.4, 14, (p) => ({ Pelvis: { pos: [0, -0.02, 0], side: sw(p, 1.5) }, Spine1: { flex: 12, twist: sw(p, 3) }, Neck: { flex: 6 }, R_UpperArm: { flex: 38 + sw(p, 8), abduct: 8 }, R_Forearm: { flex: 74 + sw(p + 0.25, 12) }, L_UpperArm: { flex: 30, abduct: 12 }, L_Forearm: { flex: 70 } }));
  // the captain at the tiller: feet apart, one hand forward, looking along the sail
  loopOf('sea_steer', 4.0, 12, (p) => ({ Pelvis: { side: sw(p, 1) }, L_Thigh: { abduct: 5 }, R_Thigh: { abduct: 5 }, Spine1: { twist: -4, flex: 2 }, Head: { twist: 10 + sw(p, 3), flex: -3 }, R_UpperArm: { flex: 34, abduct: 12 }, R_Forearm: { flex: 52 }, L_UpperArm: { flex: 6, abduct: 8 }, L_Forearm: { flex: 20 } }));
  // standing at the rail, breathing in: a slow lift of the chest and shoulders, arms loose, chin up
  loopOf('sea_breathe', 3.2, 16, (p) => { const b = 0.5 - 0.5 * Math.cos(TAU * p); return { Spine1: { flex: -2 - 3 * b }, Spine2: { flex: -2 * b }, Neck: { flex: -4 * b }, Head: { flex: -3 - 5 * b }, L_UpperArm: { flex: 4 - 3 * b, abduct: 8 + 10 * b }, R_UpperArm: { flex: 4 - 3 * b, abduct: 8 + 10 * b }, L_Forearm: { flex: 14 }, R_Forearm: { flex: 14 } }; });
  // hauling a rope hand over hand, leaning back (the hands themselves are placed by the presenter on the rope)
  loopOf('sea_haul', 1.2, 12, (p) => ({ Pelvis: { pos: [0, -0.05, 0.0], flex: 6 }, L_Thigh: { flex: 14, abduct: 12 }, R_Thigh: { flex: 14, abduct: 12 }, L_Calf: { flex: 22 }, R_Calf: { flex: 22 }, Spine1: { flex: -10 - sw(p, 3), twist: sw(p, 5) }, Head: { flex: 4 } }));
  // holding a rope at the rail and watching it, ready to haul
  loopOf('sea_hold', 3.0, 12, (p) => ({ Pelvis: { pos: [0, -0.03, 0] }, L_Thigh: { flex: 10, abduct: 10 }, R_Thigh: { flex: 10, abduct: 10 }, L_Calf: { flex: 14 }, R_Calf: { flex: 14 }, Spine1: { flex: 8 }, Neck: { flex: 12 }, Head: { flex: 10 + sw(p, 2) } }));
  // ---- seated poses (the pelvis drops to the deck; the presenter turns the ground clamp off for these) ----
  const sitBase = (p, extra = {}) => ({ Pelvis: { pos: [0, -0.8, 0.0], side: extra.side || 0 }, L_Thigh: { flex: 88, abduct: 5 }, R_Thigh: { flex: 88, abduct: 5 }, L_Calf: { flex: 4 }, R_Calf: { flex: 4 } });
  const cross = (p) => ({ Pelvis: { pos: [0, -0.82, 0.02] }, L_Thigh: { flex: 62, abduct: 48, twist: 24 }, R_Thigh: { flex: 62, abduct: 48, twist: -24 }, L_Calf: { flex: 132 }, R_Calf: { flex: 132 } });
  // sitting on the deck, legs crossed, resting: a slow breath, hands on the knees
  loopOf('sea_sit', 4.0, 12, (p) => ({ ...cross(p), Spine1: { flex: 6 + sw(p, 1.2) }, Spine2: { flex: 3 }, Neck: { flex: 4 }, Head: { twist: sw(p, 5), flex: 2 }, L_UpperArm: { flex: 22, abduct: 14 }, R_UpperArm: { flex: 22, abduct: 14 }, L_Forearm: { flex: 70 }, R_Forearm: { flex: 70 } }));
  // crossed legs, clapping on the beat
  loopOf('sea_sit_clap', 0.55, 8, (p) => { const c = 0.5 + 0.5 * Math.cos(TAU * p); return { ...cross(p), Spine1: { flex: 4 + 2 * c }, Neck: { flex: 3 }, L_UpperArm: { flex: 46, abduct: 10 + 14 * c }, R_UpperArm: { flex: 46, abduct: 10 + 14 * c }, L_Forearm: { flex: 92 - 8 * c }, R_Forearm: { flex: 92 - 8 * c } }; }, { fingers: 'open' });
  // crossed legs, singing: head up, one hand cupped to the ear
  loopOf('sea_sit_sing', 3.2, 16, (p) => ({ ...cross(p), Spine1: { flex: -2 + sw(p, 2), side: sw(p, 2) }, Neck: { flex: -8 }, Head: { flex: -9, twist: sw(p, 5) }, R_UpperArm: { flex: 22, abduct: 128 }, R_Forearm: { flex: 128 }, L_UpperArm: { flex: 24 + sw(p, 8), abduct: 18 }, L_Forearm: { flex: 66 } }), { fingers: 'open' });
  // the cook sitting at his pot, stirring
  loopOf('sea_sit_stir', 1.4, 14, (p) => ({ ...cross(p), Spine1: { flex: 14, twist: sw(p, 3) }, Neck: { flex: 8 }, R_UpperArm: { flex: 42 + sw(p, 8), abduct: 8 }, R_Forearm: { flex: 70 + sw(p + 0.25, 12) }, L_UpperArm: { flex: 30, abduct: 12 }, L_Forearm: { flex: 70 } }));
  // rowing on the deck, legs out in front: reach, pull, lean back, recover (the presenter puts an oar in the hands)
  loopOf('sea_row', 2.2, 16, (p) => { const c = 0.5 - 0.5 * Math.cos(TAU * p); return { Pelvis: { pos: [0, -0.8, 0] }, L_Thigh: { flex: 86, abduct: 6 }, R_Thigh: { flex: 86, abduct: 6 }, L_Calf: { flex: 6 }, R_Calf: { flex: 6 }, Spine1: { flex: 22 - 40 * c }, Spine2: { flex: 6 - 10 * c }, Neck: { flex: 8 + 10 * c }, Head: { flex: -4 }, L_UpperArm: { flex: 70 - 28 * c, abduct: 8 }, R_UpperArm: { flex: 70 - 28 * c, abduct: 8 }, L_Forearm: { flex: 4 + 96 * c }, R_Forearm: { flex: 4 + 96 * c } }; });
  // underwater: ride the stone down (feet first, hands on the rope above), swim along the bed, pick shells bent over, be hauled up
  loopOf('dv_sink', 3.0, 12, (p) => ({ Pelvis: { pos: [0, 0, 0] }, L_Thigh: { flex: 4, abduct: 3 }, R_Thigh: { flex: 4, abduct: 3 }, L_Calf: { flex: 10 + sw(p, 4) }, R_Calf: { flex: 10 - sw(p, 4) }, Spine1: { flex: 3 }, Head: { flex: -6 }, L_UpperArm: { flex: 150, abduct: 8 }, R_UpperArm: { flex: 150, abduct: 8 }, L_Forearm: { flex: 24 }, R_Forearm: { flex: 24 } }));
  loopOf('dv_swim', 1.0, 16, (p) => ({ Pelvis: { pos: [0, 0, 0] }, L_Thigh: { flex: 8 + sw(p, 24) }, R_Thigh: { flex: 8 - sw(p, 24) }, L_Calf: { flex: 26 + sw(p + 0.25, 22) }, R_Calf: { flex: 26 - sw(p + 0.25, 22) }, Spine1: { flex: -6 + sw(p, 2) }, Neck: { flex: -8 }, Head: { flex: -12 }, L_UpperArm: { flex: 170, abduct: 14 }, R_UpperArm: { flex: 170, abduct: 14 }, L_Forearm: { flex: 8 }, R_Forearm: { flex: 8 } }));
  loopOf('dv_pick', 1.6, 16, (p) => { const g = 0.5 - 0.5 * Math.cos(TAU * p); return { Pelvis: { pos: [0, 0, 0] }, L_Thigh: { flex: 18 + sw(p, 5) }, R_Thigh: { flex: 24 - sw(p, 5) }, L_Calf: { flex: 44 }, R_Calf: { flex: 50 }, Spine1: { flex: 6 }, Neck: { flex: -18 }, Head: { flex: -16 }, L_UpperArm: { flex: 60 + 20 * g, abduct: 8 }, R_UpperArm: { flex: 72 + 14 * g, abduct: 8 }, L_Forearm: { flex: 28 + 40 * g }, R_Forearm: { flex: 20 + 50 * g } }; }, { fingers: 'open' });
  loopOf('dv_rise', 2.4, 12, (p) => ({ Pelvis: { pos: [0, 0, 0] }, L_Thigh: { flex: 6, abduct: 5 }, R_Thigh: { flex: 3, abduct: 5 }, L_Calf: { flex: 26 + sw(p, 6) }, R_Calf: { flex: 34 - sw(p, 6) }, Spine1: { flex: -4 }, Head: { flex: -10 }, L_UpperArm: { flex: 155, abduct: 10 }, R_UpperArm: { flex: 155, abduct: 10 }, L_Forearm: { flex: 20 + sw(p, 4) }, R_Forearm: { flex: 20 - sw(p, 4) } }));
}

// ---- clothes --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const cvs = (w, h) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };
const clothCache = new Map();
function cloth(color, stripe) {
  const key = `${color}|${stripe}`; if (clothCache.has(key)) return clothCache.get(key);
  const c = cvs(128, 128), g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 128, 128);
  g.globalAlpha = 0.07; for (let i = 0; i < 128; i += 2) { g.fillStyle = i % 4 ? '#000' : '#fff'; g.fillRect(0, i, 128, 1); }
  g.globalAlpha = 1; if (stripe) { g.fillStyle = stripe; for (let x = 12; x < 128; x += 42) g.fillRect(x, 0, 4, 128); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; clothCache.set(key, t); return t;
}
// The robe is a tube that follows the legs: each frame its rings are placed along a path waist -> knees -> feet (all read from the skeleton), so it hangs when the person stands, lies over the thighs when
// they sit, and swings with a stride. Ring planes are perpendicular to the path, so a sitting robe has a vertical cross-section over the lap.
const RING = 16, SEG = 28;
function robeTube(kind, tex) {
  const n = RING * SEG, pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
  for (let r = 0; r < RING; r++) for (let s = 0; s < SEG; s++) { uv[(r * SEG + s) * 2] = s / SEG * 2; uv[(r * SEG + s) * 2 + 1] = r / (RING - 1) * 1.5; }
  for (let r = 0; r < RING - 1; r++) for (let s = 0; s < SEG; s++) { const a = r * SEG + s, b = r * SEG + (s + 1) % SEG, c = a + SEG, d = b + SEG; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, side: THREE.DoubleSide })); mesh.castShadow = true; mesh.frustumCulled = false;
  mesh.userData.tube = { kind, pos, g }; return mesh;
}
export function makeThawb(color) { return robeTube('thawb', cloth(color, null)); }
export function makeWrap(color, stripe) { return robeTube('wrap', cloth(color, stripe)); }   // the diver's wrap cloth: waist to knee
const _p0 = V(), _b1 = V(), _T = V(), _S = V(), _U = V(), _C = V();
const bone = (h, n, o) => { h.bonePosition(n, _b1); return [(_b1.x - _p0.x) * o.cs - (_b1.z - _p0.z) * o.sn, _b1.y - _p0.y, (_b1.x - _p0.x) * o.sn + (_b1.z - _p0.z) * o.cs]; };
const mid = (A, B, y = 0) => [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + y, (A[2] + B[2]) / 2];
function shapeRobe(a, t) {
  const m = a.robe, { kind, pos, g } = m.userData.tube, h = a.h, yaw = h.root.rotation.y, o = { cs: Math.cos(yaw), sn: Math.sin(yaw) };
  h.bonePosition('Pelvis', _p0);
  const kn = mid(bone(h, 'L_Calf', o), bone(h, 'R_Calf', o)), ft = mid(bone(h, 'L_Foot', o), bone(h, 'R_Foot', o), 0.07), kl = bone(h, 'L_Calf', o), kr = bone(h, 'R_Calf', o), fl = bone(h, 'L_Foot', o), fr = bone(h, 'R_Foot', o);
  const spread = Math.min(0.45, Math.abs(kl[0] - kr[0]) * 0.5 + Math.abs(fl[0] - fr[0]) * 0.2);
  // control points of the tube: [position, half-width across the body, half-depth]
  let ctl;
  if (kind === 'thawb') {
    const nk = bone(h, 'Neck', o), s2 = bone(h, 'Spine2', o), s1 = bone(h, 'Spine1', o);
    ctl = [[[nk[0], nk[1] - 0.03, nk[2]], 0.09, 0.09], [[s2[0], s2[1] + 0.07, s2[2]], 0.225, 0.175], [[s1[0], s1[1], s1[2]], 0.195, 0.16], [[0, 0.0, 0], 0.2, 0.16], [kn, 0.2 + spread * 0.5, 0.165], [ft, 0.235 + spread * 0.8, 0.2]];
    if (Math.hypot(kn[0], kn[2]) > 0.22) {   // seated: the robe lies over the lap and pools on the floor in front of the knees
      const fy = Math.min(bone(h, 'L_Foot', o)[1], bone(h, 'R_Foot', o)[1]) - 0.02, hz = kn[2] >= 0 ? 0.08 : -0.08;
      ctl = ctl.slice(0, 4).concat([[[kn[0] * 0.55, kn[1] + 0.06, kn[2] * 0.55], 0.21 + spread * 0.5, 0.18], [[kn[0], kn[1] + 0.02, kn[2]], 0.24 + spread * 0.9, 0.2], [[kn[0], fy, kn[2] + hz], 0.3 + spread * 1.0, 0.27]]);
    }
  } else {
    const s1 = bone(h, 'Spine1', o);
    ctl = [[[s1[0] * 0.3, 0.12, s1[2] * 0.3], 0.165, 0.12], [[0, 0.0, 0], 0.18, 0.135], [[kn[0] * 0.5, kn[1] * 0.5, kn[2] * 0.5], 0.19 + spread * 0.3, 0.15], [[kn[0], kn[1] + 0.03, kn[2]], 0.205 + spread * 0.5, 0.165]];
  }
  const at = (k, out) => { const f = k * (ctl.length - 1), i = Math.min(ctl.length - 2, Math.floor(f)), u = f - i, A = ctl[i], B = ctl[i + 1]; for (let c = 0; c < 3; c++) out.p[c] = A[0][c] + (B[0][c] - A[0][c]) * u; out.rx = A[1] + (B[1] - A[1]) * u; out.rz = A[2] + (B[2] - A[2]) * u; return out; };
  const P = { p: [0, 0, 0], rx: 0, rz: 0 }, Q = { p: [0, 0, 0], rx: 0, rz: 0 }, R0 = { p: [0, 0, 0], rx: 0, rz: 0 };
  for (let r = 0; r < RING; r++) {
    const k = r / (RING - 1); at(k, P); at(Math.min(1, k + 0.04), Q); at(Math.max(0, k - 0.04), R0);
    _T.set(Q.p[0] - R0.p[0], Q.p[1] - R0.p[1], Q.p[2] - R0.p[2]).normalize(); _S.set(1, 0, 0); _U.crossVectors(_T, _S).normalize(); _S.crossVectors(_U, _T).normalize();
    const skirt = kind === 'thawb' ? Math.max(0, (k - 0.55) / 0.45) : Math.max(0, (k - 0.4) / 0.6);
    for (let s = 0; s < SEG; s++) {
      const a2 = (s / SEG) * TAU, fold = 1 + 0.035 * skirt * Math.sin(a2 * 7 + 0.5 + 0.6 * Math.sin(t * 1.1 + k * 2.5 + a2)), sway = 0.014 * skirt * skirt * Math.sin(t * 1.6 + a2 * 2);
      const rx = P.rx * fold, rz = P.rz * fold + sway, ca = Math.cos(a2), sa = Math.sin(a2);
      _C.set(P.p[0] + _S.x * ca * rx + _U.x * sa * rz, P.p[1] + _S.y * ca * rx + _U.y * sa * rz, P.p[2] + _S.z * ca * rx + _U.z * sa * rz);
      const q = (r * SEG + s) * 3; pos[q] = _C.x * o.cs + _C.z * o.sn; pos[q + 1] = _C.y; pos[q + 2] = -_C.x * o.sn + _C.z * o.cs;
    }
  }
  g.attributes.position.needsUpdate = true; g.computeVertexNormals();
}
export function makeSleeves(color) {
  const g = new THREE.CylinderGeometry(1, 0.82, 1, 14, 1, true); g.translate(0, 0.5, 0);
  const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }), 4);
  const c = new THREE.Color(color); [c, c, c, c].forEach((cc, i) => m.setColorAt(i, cc)); m.frustumCulled = false; return m;
}
const _up = V(0, 1, 0), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _a = V(), _b = V(), _c = V(), _d = V(), _s = V();
export function updateSleeves(a) {
  const m = a.sleeves; if (!m || !m.visible) return; const h = a.h, sc = h.scale || 1;
  const put = (i, p0, p1, r) => { _d.copy(p1).sub(p0); const len = _d.length(); if (len < 1e-4) return; _d.multiplyScalar(1 / len); _q.setFromUnitVectors(_up, _d); _s.set(r, len, r); _m.compose(p0, _q, _s); m.setMatrixAt(i, _m); };
  for (const [k, side] of [[0, 'L'], [2, 'R']]) {
    const arm = h.arms[side]; arm.upper.getWorldPosition(_a); arm.mid.getWorldPosition(_b); arm.end.getWorldPosition(_c);
    put(k, V().copy(_a), V().copy(_b), 0.068 * sc); put(k + 1, V().copy(_b), V().copy(_c), 0.058 * sc);
  }
  m.instanceMatrix.needsUpdate = true;
}
export function makeHeadcloth(color = '#f6f2e8') {
  const grp = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 10, 0, TAU, 0, Math.PI * 0.62), mat); cap.position.set(0, 0.045, 0); cap.scale.set(1, 0.95, 1.08); cap.castShadow = true; grp.add(cap);
  const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.34, 14, 1, true, Math.PI * 0.45, Math.PI * 1.1), mat); drape.position.set(0, -0.1, -0.04); grp.add(drape);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.011, 6, 22), new THREE.MeshStandardMaterial({ color: 0x1b1714, roughness: 0.7 })); band.rotation.x = Math.PI / 2; band.position.set(0, 0.04, 0); grp.add(band);
  return grp;
}

// ---- people --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const BARE = { clay: '#b48765', wood: '#a97a47', tan: '#c8936a', brown: '#8c5a3c', deep: '#583826' };
export async function createPerson(spec) {
  const bare = spec.dress === 'bare';
  const skinHex = BARE[spec.skin] || spec.skin;
  const kit = bare ? { top: spec.vest || skinHex, bottoms: spec.wrap || '#e9e2d0', socks: skinHex, shoes: skinHex } : { top: spec.robe || '#f6f1e6', bottoms: spec.robe || '#f6f1e6', socks: spec.robe || '#f6f1e6', shoes: '#6a4a2a' };
  const h = await loadHuman({ character: 'athlete_m', kit, skin: spec.skin, hair: spec.hair || 'black', quality: spec.quality || 'high', castShadow: true });
  addSeaClips(h);
  h.groundClamp = 'auto'; h.turnRate = 0; h.root.rotation.order = 'YXZ';
  const a = { h, spec, bare, tmp: { d: V() }, name: spec.name, clip: '' };
  if (bare) { a.robe = makeWrap(spec.wrap || '#e9e2d0', spec.stripe || '#2d6a8a'); } else { a.robe = makeThawb(spec.robe || '#f6f1e6', 1.0); a.sleeves = makeSleeves(spec.robe || '#f6f1e6'); a.cloth = makeHeadcloth(spec.cloth || '#f6f2e8'); }
  return a;
}
// per-frame: the robe follows the pelvis, the sleeves follow the arms, the head cloth follows the head
export function followPerson(a, vis = true) {
  const h = a.h; h.root.visible = vis;
  if (a.robe) { a.robe.visible = vis; if (vis) { const p = h.bonePosition('Pelvis', a.tmp.d); a.robe.position.set(p.x, p.y + 0.02, p.z); a.robe.rotation.set(0, 0, 0); shapeRobe(a, a.tmpT = (a.tmpT || 0) + 0.016); } }
  if (a.sleeves) { a.sleeves.visible = vis; if (vis) updateSleeves(a); }
  if (a.cloth) { a.cloth.visible = vis; if (vis) { const p = h.bonePosition('Head', a.tmp.d); a.cloth.position.set(p.x, p.y + 0.15, p.z); a.cloth.rotation.set(0, h.root.rotation.y, 0); } }
}
export const playClip = (a, name, o = {}) => {
  if (/^sea_(sit|row)/.test(name)) { a.h.groundClamp = 'off'; a.sat = true; } else if (a.sat) { a.h.groundClamp = 'auto'; a.sat = false; }
  if (a.clip !== name) { a.h.play(name, { fade: o.fade ?? 0.3, loop: o.loop, startTime: o.startTime }); a.clip = name; }
};
void mergeInto; void hex;

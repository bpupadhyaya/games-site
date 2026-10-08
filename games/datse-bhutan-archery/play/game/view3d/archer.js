// One archer: a skinned athlete, the clips for the stance, the draw and the dance, and the per-frame pose that puts the bow hand and the string hand where the
// simulation says the bow is. Presentation only.
import { buildClip, loadHuman, THREE } from '../vendor3d/index.js';
import { makeBow, makeArrow } from './gear.js';
import { mergeInto } from './world.js';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const CLIPS = new WeakSet();
export function addArcheryClips(h) {
  if (CLIPS.has(h)) return; CLIPS.add(h);
  const make = (spec) => { h.addClip(buildClip(h, { group: 'archery', ...spec })); };
  const loop = (name, dur, a, b, o = {}) => make({ name, duration: dur, loop: true, base: 'rest', keys: [{ t: 0, pose: a }, { t: dur / 2, pose: b, ease: 'inOut' }, { t: dur, pose: a, ease: 'inOut' }], ...o });
  // side-on shooting stance: feet apart along the line to the board, knees soft, head turned to look down the range
  const st = (k) => ({
    Pelvis: { pos: [0, -0.03 - 0.004 * k, 0] }, L_Thigh: { flex: 3, abduct: 10 }, R_Thigh: { flex: 3, abduct: 10 }, L_Calf: { flex: 6 }, R_Calf: { flex: 6 },
    Spine: { flex: 2 + k * 0.5, twist: -4 }, Spine1: { flex: 1 }, Neck: { twist: 38, flex: 2 }, Head: { twist: 32, flex: -2 },
  });
  loop('ar_stance', 3.0, st(0), st(1));
  // ready and watching: relaxed, face down the range
  const rd = (k) => ({ Pelvis: { pos: [0, -0.01, 0], side: 1.2 * k }, L_Thigh: { abduct: 3 }, R_Thigh: { abduct: 3 }, Spine1: { flex: 1.5, twist: 2 * k }, Neck: { flex: 3 }, Head: { twist: 3 * k }, L_UpperArm: { flex: 2, abduct: 4 }, R_UpperArm: { flex: 2, abduct: 4 }, L_Forearm: { flex: 8 + 2 * k }, R_Forearm: { flex: 8 + 2 * k } });
  loop('ar_ready', 3.4, rd(0), rd(1));
  // dances, all of the body: (a) a rocking side step with both arms swinging out and in, (b) a bouncing hop with both arms thrown up in a V,
  // (c) knee lifts with the arms waving up and down in turn, (d) a turning step with claps in front of the chest
  const TAU = Math.PI * 2;
  const loopOf = (name, dur, N, f, fingers = 'open') => { const keys = []; for (let i = 0; i <= N; i++) keys.push({ t: (i / N) * dur, pose: f(i / N), ease: 'linear' }); make({ name, duration: dur, loop: true, base: 'rest', keys, fingers, grounded: false }); };
  loopOf('dz_a', 2.4, 20, (ph) => { const s = Math.sin(TAU * ph), c = Math.cos(TAU * ph), d = Math.cos(2 * TAU * ph), r = Math.max(0, s), l = Math.max(0, -s); return {
    Pelvis: { pos: [0.08 * s, -0.07 - 0.04 * (0.5 - 0.5 * d), 0], side: 8 * s, twist: -6 * s, flex: 3 },
    L_Thigh: { flex: 6 + 22 * r, abduct: 10 + 14 * r }, R_Thigh: { flex: 6 + 22 * l, abduct: 10 + 14 * l }, L_Calf: { flex: 20 + 38 * r }, R_Calf: { flex: 20 + 38 * l },
    Spine1: { side: -7 * s, twist: 9 * s, flex: 4 }, Neck: { side: 4 * s }, Head: { side: 6 * s, flex: -2 },
    L_UpperArm: { flex: 48 + 18 * c, abduct: 60 + 28 * s }, R_UpperArm: { flex: 48 + 18 * c, abduct: 60 - 28 * s }, L_Forearm: { flex: 66 - 26 * c }, R_Forearm: { flex: 66 - 26 * c } }; });
  loopOf('dz_b', 2.0, 20, (ph) => { const s = Math.sin(2 * TAU * ph), c = Math.cos(TAU * ph), a2 = Math.abs(s); return {
    Pelvis: { pos: [0.04 * c, -0.07 + 0.09 * a2, 0], side: 5 * c },
    L_Thigh: { flex: 12 + 18 * a2, abduct: 12 }, R_Thigh: { flex: 12 + 18 * a2, abduct: 12 }, L_Calf: { flex: 22 + 26 * a2 }, R_Calf: { flex: 22 + 26 * a2 },
    Spine1: { flex: -4 - 4 * a2, side: 5 * c }, Head: { flex: -8, side: 6 * c },
    L_UpperArm: { flex: 14, abduct: 140 + 18 * s }, R_UpperArm: { flex: 14, abduct: 140 - 18 * s }, L_Forearm: { flex: 26 + 18 * s }, R_Forearm: { flex: 26 - 18 * s } }; });
  loopOf('dz_c', 2.2, 20, (ph) => { const s = Math.sin(TAU * ph), c2 = Math.cos(2 * TAU * ph), r = Math.max(0, s), l = Math.max(0, -s); return {
    Pelvis: { pos: [0.05 * s, -0.07 - 0.03 * (0.5 - 0.5 * c2), 0], side: 6 * s },
    L_Thigh: { flex: 8 + 40 * r, abduct: 10 }, R_Thigh: { flex: 8 + 40 * l, abduct: 10 }, L_Calf: { flex: 16 + 60 * r }, R_Calf: { flex: 16 + 60 * l },
    Spine1: { side: -6 * s, twist: 12 * s }, Head: { side: 7 * s, flex: -3 },
    L_UpperArm: { flex: 16, abduct: 100 + 52 * s }, R_UpperArm: { flex: 16, abduct: 100 - 52 * s }, L_Forearm: { flex: 30 + 24 * r }, R_Forearm: { flex: 30 + 24 * l } }; });
  loopOf('dz_d', 2.0, 20, (ph) => { const s = Math.sin(TAU * ph), cl = Math.max(0, Math.cos(4 * TAU * ph)), a2 = Math.abs(Math.sin(2 * TAU * ph)); return {
    Pelvis: { pos: [0, -0.06 + 0.05 * a2, 0], twist: 22 * s, side: 4 * s },
    L_Thigh: { flex: 14 + 10 * a2, abduct: 11 }, R_Thigh: { flex: 14 + 10 * a2, abduct: 11 }, L_Calf: { flex: 24 + 16 * a2 }, R_Calf: { flex: 24 + 16 * a2 },
    Spine1: { twist: -14 * s, flex: 5 }, Head: { twist: 8 * s, flex: -3 },
    L_UpperArm: { flex: 62 - 12 * cl, abduct: 14 - 10 * cl }, R_UpperArm: { flex: 62 - 12 * cl, abduct: 14 - 10 * cl }, L_Forearm: { flex: 82 - 10 * cl }, R_Forearm: { flex: 82 - 10 * cl } }; }, 'open');
  // a small bow of thanks after a good shot, and a head-shake after a miss
  make({ name: 'ar_nod', duration: 1.4, base: 'rest', keys: [{ t: 0, pose: {} }, { t: 0.45, pose: { Spine1: { flex: 14 }, Neck: { flex: 8 }, R_UpperArm: { flex: 10 }, L_UpperArm: { flex: 10 } }, ease: 'inOut' }, { t: 1.4, pose: {}, ease: 'inOut' }] });
  make({ name: 'ar_shrug', duration: 1.8, base: 'rest', keys: [{ t: 0, pose: {} }, { t: 0.4, pose: { Head: { twist: -18 }, Neck: { flex: 6 }, Spine1: { flex: 4 }, L_UpperArm: { abduct: 14, flex: 8 }, R_UpperArm: { abduct: 14, flex: 8 }, L_Forearm: { flex: 40 }, R_Forearm: { flex: 40 } }, ease: 'out' }, { t: 0.9, pose: { Head: { twist: 18 } }, ease: 'inOut' }, { t: 1.8, pose: {}, ease: 'inOut' }] });
}

// ---- the robe: a knee-length wrapped gho for men, an ankle-length kira for women, in the team's woven colours, with a belt -----------------------------------
const cvs = (w, h) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };
const weaveCache = new Map();
function weave(top, trim, kind) {
  const key = `${top}|${trim}|${kind}`; if (weaveCache.has(key)) return weaveCache.get(key);
  const c = cvs(128, 128), g = c.getContext('2d'); g.fillStyle = top; g.fillRect(0, 0, 128, 128);
  g.globalAlpha = 0.9; g.fillStyle = trim;
  if (kind === 'm') { for (let x = 0; x < 128; x += 32) g.fillRect(x + 6, 0, 3, 128); for (let y = 0; y < 128; y += 32) g.fillRect(0, y + 6, 128, 3); g.globalAlpha = 0.35; g.fillStyle = '#000'; for (let x = 0; x < 128; x += 32) g.fillRect(x + 16, 0, 10, 128); }
  else { for (let y = 0; y < 128; y += 16) { g.fillRect(0, y + 2, 128, 2); if ((y / 16) % 2) { g.globalAlpha = 0.5; for (let x = 0; x < 128; x += 16) g.fillRect(x + 4, y + 5, 8, 6); g.globalAlpha = 0.9; } } }
  g.globalAlpha = 1; g.fillStyle = '#fff'; g.fillRect(120, 120, 8, 8);
  g.globalAlpha = 0.12; for (let i = 0; i < 400; i++) { g.fillStyle = i % 2 ? '#fff' : '#000'; g.fillRect(Math.random() * 0 + (i * 37) % 128, (i * 53) % 128, 1, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; weaveCache.set(key, t); return t;
}
function pleated(rTop, rBot, len, seg, rows, open = true) {
  // a skirt with soft vertical folds: the radius wobbles with the angle and grows towards the hem
  const g = new THREE.CylinderGeometry(rTop, rBot, len, seg, rows, open), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(z, x), k = (len / 2 - y) / len, r = Math.hypot(x, z), w = 1 + 0.045 * k * Math.sin(a * 10 + 0.6) + 0.12 * k * k; p.setXYZ(i, x * w, y, z * w * (1 + 0.04 * k)); void r; }
  g.computeVertexNormals(); return g;
}
export function makeRobe(spec) {
  const g = spec.g === 'f' ? 'f' : 'm', top = spec.kit.top, trim = spec.kit.trim || '#f2c14e';
  const len = g === 'm' ? 0.56 : 0.98, rTop = g === 'm' ? 0.185 : 0.2, rBot = g === 'm' ? 0.225 : 0.25;
  const tex = weave(top, trim, g); tex.repeat.set(1, 1);
  // skirt, belt, hem band and the pouch of the wrap: ONE mesh. The weave repeats by uv scaling, solid parts point at a white texel and take their colour from the vertices.
  const col = (c) => { const k = new THREE.Color(c); return [k.r, k.g, k.b]; };
  const parts = [], I = new THREE.Matrix4();
  const sk = pleated(rTop, rBot, len, 28, 6); { const uv = sk.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * (g === 'm' ? 2 : 3)); }
  const mk = (geo, x, y, z, sx, sy, sz, c) => { const m = new THREE.Matrix4(); m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.97, 0.03); return { geo, matrix: m, color: col(c) }; };
  parts.push({ geo: sk, matrix: new THREE.Matrix4().makeTranslation(0, -len / 2 + 0.1, 0), color: [1, 1, 1] });
  parts.push(mk(new THREE.CylinderGeometry(rTop + 0.012, rTop + 0.012, 0.07, 20), 0, 0.115, 0, 1, 1, 1, trim), mk(new THREE.CylinderGeometry(rBot * 1.14, rBot * 1.15, 0.05, 24, 1, true), 0, -len + 0.1 + 0.025, 0, 1, 1, 1, trim));
  if (g === 'm') parts.push(mk(new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.15, 0.015, 1.0, 0.45, 0.8, top));
  void I;
  const mesh = new THREE.Mesh(mergeInto(THREE, parts), new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }));
  const grp = new THREE.Group(); grp.add(mesh); mesh.castShadow = !!spec.shadow;
  return grp;
}
// Sleeves: one instanced mesh per archer (upper arm and forearm of both arms in the team colour, a trim cuff at each wrist), re-aimed from the bones every frame.
export function makeSleeves(spec) {
  const g = new THREE.CylinderGeometry(1, 0.86, 1, 8, 1, true); g.translate(0, 0.5, 0);
  const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide }), 6);
  const top = new THREE.Color(spec.kit.top), trim = new THREE.Color(spec.kit.trim || '#f4f1e6');
  [top, top, top, top, trim, trim].forEach((c, i) => m.setColorAt(i, c));
  m.frustumCulled = false; m.castShadow = false; return m;
}
const _up = V(0, 1, 0), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _a = V(), _b = V(), _c = V(), _d = V(), _s = V();
export function updateSleeves(a) {
  const m = a.sleeves; if (!m) return; const h = a.h, sc = h.scale || 1;
  const put = (i, p0, p1, r, back = 0) => { _d.copy(p1).sub(p0); const len = _d.length(); if (len < 1e-4) return; _d.multiplyScalar(1 / len); if (back) p0 = _c.copy(p1).addScaledVector(_d, -back); _q.setFromUnitVectors(_up, _d); _s.set(r, back ? back : len, r); _m.compose(p0, _q, _s); m.setMatrixAt(i, _m); };
  for (const [k, side] of [[0, 'L'], [2, 'R']]) {
    const arm = h.arms[side]; arm.upper.getWorldPosition(_a); arm.mid.getWorldPosition(_b); arm.end.getWorldPosition(_c);
    const sh = V().copy(_a), el = V().copy(_b), wr = V().copy(_c);
    put(k, sh, el, 0.054 * sc); put(k + 1, el, wr, 0.046 * sc); put(4 + k / 2, el, wr, 0.05 * sc, 0.075 * sc);
  }
  m.instanceMatrix.needsUpdate = true;
}
export function followRobe(h, r) { const p = h.bonePosition('Pelvis', V()); r.position.set(p.x, p.y + 0.02, p.z); r.rotation.y = h.root.rotation.y; }
export function updateRobe(a) {
  const r = a.robe; if (!r) return; const h = a.h;
  const p = h.bonePosition('Pelvis', a.tmp.d); r.position.set(p.x, p.y + 0.02, p.z); r.rotation.y = h.root.rotation.y;
}

export async function createArcher(spec) {
  const h = await loadHuman({ character: spec.g === 'f' ? 'athlete_f' : 'athlete_m', kit: spec.kit, skin: spec.skin, hair: spec.hair || 'black', quality: spec.quality || 'high', castShadow: true });
  addArcheryClips(h);
  h.groundClamp = 'auto'; h.turnRate = 0;
  const bow = makeBow(THREE), arrow = makeArrow(THREE);
  bow.visible = false; arrow.visible = false;
  const robe = makeRobe({ ...spec, shadow: true }); robe.visible = true; const sleeves = makeSleeves(spec);
  const a = { h, bow, arrow, robe, sleeves, spec, tmp: { a: V(), b: V(), c: V(), d: V(), e: V(), f: V() }, mode: 'ready' };
  return a;
}

// Put the archer's hands where the bow is. F = unit vector to the board, p = draw fraction (0 at the brace, 1 at full draw), pull = extra pull-back after the release (m).
export function poseShooter(a, F, p, { sway = null, pull = 0, up = 0, lower = 0 } = {}) {
  const h = a.h, t = a.tmp, R = t.f.set(-F.z * 0 + F.z * -1 * 0, 0, 0);
  // right of the shooter, looking along F with chest facing right: R = F rotated by -90 deg about Y
  R.set(-F.z, 0, F.x).negate();
  const lsh = h.bonePosition('L_UpperArm', t.a), rsh = h.bonePosition('R_UpperArm', t.b);
  const mid = t.c.copy(lsh).add(rsh).multiplyScalar(0.5);
  const sc = h.scale || 1;
  const bowHand = V().copy(mid).addScaledVector(F, 0.19 * sc + 0.58 * sc); bowHand.y = lsh.y + 0.01 * sc + (sway ? sway.dy : 0) + up;
  if (sway) bowHand.addScaledVector(R, sway.dr);
  const nockRest = V().copy(bowHand).addScaledVector(F, -0.17);
  const anchor = V().copy(mid).addScaledVector(F, 0.03 * sc).addScaledVector(R, 0.05 * sc); anchor.y = lsh.y + 0.1 * sc;
  const hand = V().copy(nockRest).lerp(anchor, p); hand.addScaledVector(F, -pull);
  const lPole = V().copy(lsh).addScaledVector(F, 0.3).addScaledVector(R, 0.0); lPole.y -= 0.35;
  const rPole = V().copy(rsh).addScaledVector(F, -0.7).addScaledVector(R, 0.0); rPole.y += 0.05;
  if (lower > 0) {
    const hipL = h.bonePosition('L_Thigh', V()), hipR = h.bonePosition('R_Thigh', V());
    const carryL = V().copy(hipL).addScaledVector(F, 0.1).addScaledVector(R, 0.18); carryL.y -= 0.12;
    const carryR = V().copy(hipR).addScaledVector(F, 0.0).addScaledVector(R, 0.12); carryR.y -= 0.1;
    bowHand.lerp(carryL, lower); hand.lerp(carryR, lower);
    lPole.lerp(V().copy(hipL).addScaledVector(F, -0.2).addScaledVector(R, 0.3), lower); rPole.lerp(V().copy(hipR).addScaledVector(F, -0.4), lower);
  }
  h.setReach('L', bowHand, { weight: 1, pole: lPole });
  h.setReach('R', hand, { weight: 1, pole: rPole });
  h.setFingers('L', 'fist'); h.setFingers('R', 'pinch');
  // bow: grip at the bow hand, string side towards the shooter
  const bow = a.bow; bow.visible = true;
  bow.position.copy(bowHand).addScaledVector(F, 0.0); bow.position.y -= 0.0;
  bow.rotation.set(0, F.z > 0 ? Math.PI : 0, 0);
  bow.rotateZ(0.04); if (lower > 0) bow.rotateX(-0.35 * lower); if (pull > 0) bow.rotateX(-pull * 1.7);
  bow.updateMatrixWorld(true);
  // nock point of the string, in bow-local space
  const nockLocal = bow.worldToLocal(hand.clone());
  bow.userData.setNock(nockLocal);
  const ar = a.arrow; ar.visible = true;
  ar.position.copy(hand); ar.lookAt(V().copy(hand).add(F).setY(hand.y + 0.012)); ar.visible = lower < 0.4;
  a.nock = hand; a.bowHand = bowHand;
  return { hand, bowHand };
}
export function putAway(a) { a.bow.visible = false; a.arrow.visible = false; a.h.setReach('L', null); a.h.setReach('R', null); a.h.setFingers('L', 'relaxed'); a.h.setFingers('R', 'relaxed'); }

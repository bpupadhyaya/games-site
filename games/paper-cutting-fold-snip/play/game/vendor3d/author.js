// Clip authoring: pose-to-pose keyframes over named bones (+ IK targets for hands/feet).
// Game agents use this to build sport clips (a batting stroke, a kabaddi raid, a takraw kick) on top of the base library.
//
//   const swing = buildClip(human, {
//     name: 'drive', duration: 1.1, base: 'ready_stance',        // base: clip name | Clip | 'rest'
//     keys: [
//       { t: 0.0 },                                              // base pose
//       { t: 0.4, pose: { Spine1: { rot: [0, -35, 0] }, R_UpperArm: { rot: [20, 0, -30] } }, ease: 'inOut' },
//       { t: 0.7, pose: { Spine1: { rot: [0, 40, 0] },  Pelvis: { pos: [0, -0.04, 0.06] } }, ease: 'out' },
//     ],
//     ik: { R_Hand: [{ t: 0, pos: [0.25, 1.0, 0.35] }, { t: 0.7, pos: [-0.1, 0.9, 0.9], ease: 'out' }] },   // character space, metres
//     events: { contact: 0.7 }, fingers: 'batGrip',
//   });
//   human.addClip(swing); human.play('drive');
//
// Pose rule: bone offsets are Euler degrees (XYZ, bone-local) post-multiplied onto the base pose;
// a bone missing from a key keeps the previous key's offset (the first key defaults to no offset). Pelvis `pos` is a metre offset.
import * as THREE from './three.js';
import { Clip, NB, ease as EASE, sampleClip, makePose } from './animation.js';
import { CLIP_BONES } from './clipcodec.js';

const D2R = Math.PI / 180;
const boneIndex = (n) => { const i = CLIP_BONES.indexOf(n.startsWith('Bip01_') ? n : `Bip01_${n}`); if (i < 0) throw new Error(`view3d/author: unknown bone "${n}". Use e.g. Spine1, R_UpperArm, L_Calf (see CLIP_BONES).`); return i; };
// Semantic pose fields (degrees), mapped to the bone's local Euler axes (measured on the shipped rig; see docs/AUTHORING.md):
//   spine/pelvis/neck/head: twist (+ = turn to the avatar's LEFT), side (+ = lean to the avatar's left), flex (+ = forward)
//   UpperArm: flex (+ = raise forward), abduct (+ = out to the side), twist;  Forearm: flex (+ = bend the elbow), twist
//   Thigh: flex (+ = knee forward), abduct (+ = out to the side), twist;  Calf: flex (+ = bend the knee)
//   Clavicle / Hand / Foot / Toe0: raw `rot` only
export function semanticRot(bone, p) {
  const n = bone.replace('Bip01_', '');
  const side = n[0] === 'L' ? 1 : n[0] === 'R' ? -1 : 0;   // +1 left, -1 right
  const r = p.rot ? [...p.rot] : [0, 0, 0];
  const f = p.flex || 0, ab = p.abduct || 0, tw = p.twist || 0, sd = p.side || 0;
  if (/^(Pelvis|Spine\d?|Neck|Head)$/.test(n)) { r[0] += tw; r[1] += -sd; r[2] += f; }
  else if (/UpperArm$/.test(n)) { r[0] += tw; r[1] += -side * ab; r[2] += -f; }
  else if (/Forearm$/.test(n)) { r[0] += tw; r[2] += -f; }
  else if (/Thigh$/.test(n)) { r[0] += tw; r[1] += side * ab; r[2] += f; }
  else if (/Calf$/.test(n)) { r[2] += -f; }
  return r;
}
const easeFn = (e) => (typeof e === 'function' ? e : EASE[e || 'inOut'] || EASE.inOut);

// Trunk smoothing: a skinned torso tears when adjacent spine bones are twisted/bent very differently. The semantic offsets given for Spine, Spine1 and
// Spine2 are summed and spread EVENLY over the three bones (the sum, hence the pose of the shoulders, is unchanged; the relative angle between neighbours is a third).
// Set `smoothTrunk: false` in the spec to keep the literal per-bone values.
function smoothTrunk(spec) {
  if (spec.smoothTrunk === false) return spec;
  const keys = spec.keys.map((k) => {
    if (!k.pose) return k;
    const names = ['Spine', 'Spine1', 'Spine2'];
    if (!names.some((n) => k.pose[n])) return k;
    const sum = { twist: 0, flex: 0, side: 0 };
    for (const n of names) { const p = k.pose[n]; if (!p) continue; sum.twist += p.twist || 0; sum.flex += p.flex || 0; sum.side += p.side || 0; }
    const pose = { ...k.pose };
    for (const n of names) pose[n] = { ...(k.pose[n] || {}), twist: sum.twist / 3, flex: sum.flex / 3, side: sum.side / 3 };
    return { ...k, pose };
  });
  return { ...spec, keys };
}

export function buildClip(human, spec) {
  spec = smoothTrunk(spec);
  const fps = spec.fps || 30;
  const inheritClip = spec.inherit && typeof spec.base === 'string' ? human.getClip(spec.base) : null;   // loops: keep the base clip's length, speed and foot events
  const dur = inheritClip ? inheritClip.dur : spec.duration;
  const frames = Math.round(dur * fps) + 1;
  const keys = [...spec.keys].sort((a, b) => a.t - b.t);
  if (!keys.length) throw new Error('view3d/author: keys required');
  // base source
  let base = spec.base ?? 'rest';
  const baseClip = base === 'rest' ? null : typeof base === 'string' ? human.getClip(base) : base.frames ? base : human.getClip(base.clip);
  const baseTime = (t) => (base && base.time !== undefined ? base.time : t);
  // resolve carried-forward offsets per bone per key
  const names = new Set();
  for (const k of keys) for (const n in k.pose || {}) names.add(n);
  const offs = keys.map(() => ({}));
  for (const n of names) {
    let cur = { rot: [0, 0, 0], pos: [0, 0, 0] };
    keys.forEach((k, i) => { const p = k.pose && k.pose[n]; if (p) cur = { rot: semanticRot(n, p), pos: p.pos || cur.pos }; offs[i][n] = cur; });
  }
  const quats = new Float32Array(frames * NB * 4);
  const pelvis = new Float32Array(frames * 3);
  const P = makePose(), e = new THREE.Euler(0, 0, 0, 'XYZ'), qo = new THREE.Quaternion(), qb = new THREE.Quaternion();
  const ph = human.pelvisHeight;
  for (let f = 0; f < frames; f++) {
    const t = Math.min(dur, f / fps);
    if (baseClip) sampleClip(baseClip, baseTime(t), P.q, P.p); else { P.q.set(human.restPose.q); P.p.fill(0); }
    // segment
    let i1 = keys.findIndex((k) => k.t >= t); if (i1 < 0) i1 = keys.length - 1;
    const i0 = Math.max(0, i1 - 1);
    const a = keys[i0], b = keys[i1];
    const x = i1 === i0 || b.t === a.t ? 1 : Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
    const w = easeFn(b.ease)(x);
    for (const n of names) {
      const A = offs[i0][n], B = offs[i1][n];
      const rx = (A.rot[0] + (B.rot[0] - A.rot[0]) * w) * D2R, ry = (A.rot[1] + (B.rot[1] - A.rot[1]) * w) * D2R, rz = (A.rot[2] + (B.rot[2] - A.rot[2]) * w) * D2R;
      const bi = boneIndex(n);
      if (rx || ry || rz) {
        qb.set(P.q[bi * 4], P.q[bi * 4 + 1], P.q[bi * 4 + 2], P.q[bi * 4 + 3]);
        qo.setFromEuler(e.set(rx, ry, rz, 'XYZ'));
        qb.multiply(qo);
        P.q[bi * 4] = qb.x; P.q[bi * 4 + 1] = qb.y; P.q[bi * 4 + 2] = qb.z; P.q[bi * 4 + 3] = qb.w;
      }
      if (bi === 0) for (let j = 0; j < 3; j++) P.p[j] += (A.pos[j] + (B.pos[j] - A.pos[j]) * w) / ph;
    }
    quats.set(P.q, f * NB * 4);
    pelvis.set(P.p, f * 3);
  }
  // ik: { R_Hand: [keys] } or { R_Hand: { keys:[{t,pos,ease}], pole:[{t,pos}] (elbow/knee direction hint, character space), weight:[{t,v}] } }
  const ik = spec.ik ? Object.entries(spec.ik).map(([bone, def]) => {
    const d = Array.isArray(def) ? { keys: def } : def;
    return {
      bone, side: bone[0], kind: /Hand/.test(bone) ? 'hand' : 'foot', space: spec.ikSpace || 'character', weight: spec.ikWeight ?? 1,
      keys: d.keys.map((k) => ({ t: k.t, pos: k.pos, target: k.target, off: k.off, ease: k.ease ? easeFn(k.ease) : null })).sort((a, b) => a.t - b.t),
      poleKeys: d.pole ? d.pole.map((k) => ({ t: k.t, pos: k.pos })).sort((a, b) => a.t - b.t) : null,
      weightKeys: d.weight ? [...d.weight].sort((a, b) => a.t - b.t) : null,
    };
  }) : null;
  return new Clip({
    name: spec.name || 'authored', frames, dur: (frames - 1) / fps, fps, loop: inheritClip ? inheritClip.loop : !!spec.loop, quats, pelvis, events: inheritClip ? { ...inheritClip.events, ...(spec.events || {}) } : spec.events || {}, speed: inheritClip ? inheritClip.speed : spec.speed || 0,
    group: spec.group || 'authored', fingers: spec.fingers || (baseClip && baseClip.fingers) || 'relaxed', fingerHands: spec.fingerHands || null, grounded: spec.grounded, ik, source: 'authored',
    propTrack: spec.prop ? spec.prop.map((k) => ({ ...k, ease: k.ease ? easeFn(k.ease) : null })).sort((x, y) => x.t - y.t) : null,
  });
}

/** Convenience: one IK target keyframer for a hand/foot without any bone offsets. */
export function ikClip(human, { name, duration, base = 'rest', ik, ...rest }) {
  return buildClip(human, { name, duration, base, keys: [{ t: 0 }], ik, ...rest });
}

export { EASE as ease };

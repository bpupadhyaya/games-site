// Compact clip codec shared by the offline baker (Node: encodeClips) and the runtime (decodeClips).
// Dependency-free ES module. Format: see docs/FORMATS.md (+ the notes in docs/CLIPS.md).
export const CLIP_BONES = [
  'Bip01_Pelvis', 'Bip01_Spine', 'Bip01_Spine1', 'Bip01_Spine2', 'Bip01_Neck', 'Bip01_Head',
  'Bip01_L_Clavicle', 'Bip01_L_UpperArm', 'Bip01_L_Forearm', 'Bip01_L_Hand',
  'Bip01_R_Clavicle', 'Bip01_R_UpperArm', 'Bip01_R_Forearm', 'Bip01_R_Hand',
  'Bip01_L_Thigh', 'Bip01_L_Calf', 'Bip01_L_Foot', 'Bip01_L_Toe0',
  'Bip01_R_Thigh', 'Bip01_R_Calf', 'Bip01_R_Foot', 'Bip01_R_Toe0',
];
export const NB = CLIP_BONES.length;
export const POS_UNIT = 1 / 4096; // pelvis delta unit, as a fraction of the character's pelvisHeight
export const YAW_UNIT = 1 / 2048; // optional yaw curve unit, radians

// jsonObj = parsed <set>.json, buf = ArrayBuffer of <set>.bin
// -> { name: { frames, dur, loop, speed, travel, events, fingers, group, source, note,
//              quats: Float32Array(frames*NB*4)  (x,y,z,w per bone, CLIP_BONES order, local rotation),
//              pelvis: Float32Array(frames*3)    (delta from rest pelvis in units of pelvisHeight; world axes, +Z forward),
//              yaw: Float32Array(frames) | null  (radians the ROOT must turn; only turn clips) } }
export function decodeClips(jsonObj, buf) {
  const out = {};
  for (const [name, c] of Object.entries(jsonObj.clips)) {
    const n = c.frames;
    const qi = new Int16Array(buf, c.q, n * NB * 4);
    const quats = new Float32Array(n * NB * 4);
    for (let f = 0; f < n; f++) {
      for (let b = 0; b < NB; b++) {
        const o = (f * NB + b) * 4;
        let x = qi[o] / 32767, y = qi[o + 1] / 32767, z = qi[o + 2] / 32767, w = qi[o + 3] / 32767;
        const l = 1 / (Math.hypot(x, y, z, w) || 1);
        quats[o] = x * l; quats[o + 1] = y * l; quats[o + 2] = z * l; quats[o + 3] = w * l;
      }
    }
    const pi = new Int16Array(buf, c.p, n * 3);
    const pelvis = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) pelvis[i] = pi[i] * (jsonObj.posUnit ?? POS_UNIT);
    let yaw = null;
    if (c.y !== undefined) {
      const yi = new Int16Array(buf, c.y, n);
      yaw = new Float32Array(n);
      for (let i = 0; i < n; i++) yaw[i] = yi[i] * (jsonObj.yawUnit ?? YAW_UNIT);
    }
    const { q, p, y, ...meta } = c;
    out[name] = { ...meta, name, quats, pelvis, yaw };
  }
  return out;
}

// Node-side: clips = { name: { dur, loop, meta..., quats: Float32Array(frames*NB*4), pelvis: Float32Array(frames*3) in
// pelvisHeight units, yaw?: Float32Array } } -> { json, bin: Uint8Array }
export function encodeClips(clips, extra = {}) {
  const parts = [];
  let off = 0;
  const json = { version: 1, fps: 30, bones: CLIP_BONES, posUnit: POS_UNIT, yawUnit: YAW_UNIT, ...extra, clips: {} };
  const push = (arr) => { parts.push(arr); const at = off; off += arr.byteLength; return at; };
  for (const [name, c] of Object.entries(clips)) {
    const n = c.quats.length / (NB * 4);
    const qi = new Int16Array(c.quats.length);
    for (let i = 0; i < qi.length; i++) qi[i] = Math.max(-32767, Math.min(32767, Math.round(c.quats[i] * 32767)));
    const pi = new Int16Array(n * 3);
    for (let i = 0; i < pi.length; i++) pi[i] = Math.max(-32767, Math.min(32767, Math.round(c.pelvis[i] / POS_UNIT)));
    const { quats, pelvis, yaw, ...meta } = c;
    const entry = { frames: n, ...meta, q: push(qi), p: push(pi) };
    if (yaw) {
      const yi = new Int16Array(n);
      for (let i = 0; i < n; i++) yi[i] = Math.max(-32767, Math.min(32767, Math.round(yaw[i] / YAW_UNIT)));
      entry.y = push(yi);
    }
    json.clips[name] = entry;
  }
  const bin = new Uint8Array(off);
  let at = 0;
  for (const p of parts) { bin.set(new Uint8Array(p.buffer, p.byteOffset, p.byteLength), at); at += p.byteLength; }
  return { json, bin };
}

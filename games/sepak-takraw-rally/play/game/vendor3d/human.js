// Human: a skinned Rocketbox athlete with clip playback, procedural fingers, grips for props,
// look-at, foot planting and ground clamp. Deterministic: advances only by update(dt).
import * as THREE from './three.js';
import { decodeClips, CLIP_BONES } from './clipcodec.js';
import { Clip, Layer, NB, MASKS, makePose, copyPose, sampleClip } from './animation.js';
import { buildLodSet, makeLightMaterial, LOD_NAMES, LOD_POLICY, screenHeightPx, pickLod } from './lod.js';
import { FingerRig, WristLimiter, LookAt, solveTwoBone, FINGER_POSES, blendFingerPose } from './rig.js';

export const SKIN_TONES = { original: null, light: null, tan: '#c8936a', brown: '#8c5a3c', deep: '#583826' };
export const HAIR_COLORS = { original: null, black: '#1b1714', brown: '#4a3220', blond: '#c7a468', ginger: '#9c4a26', grey: '#9a9a9a', white: '#e4e1da' };

const HERE = new URL('.', import.meta.url);
const cache = new Map();
function cached(key, make) { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); }
// NOTE: the iOS shell serves arcforge:// through WKURLSchemeHandler, where fetch() reports status 0 / ok false even on success: only treat >= 400 as failure.
const fetchJson = (u) => fetch(u).then((r) => { if (r.status >= 400) throw new Error(`view3d: ${u} -> ${r.status}`); return r.json(); });
const fetchBuf = (u) => fetch(u).then((r) => { if (r.status >= 400) throw new Error(`view3d: ${u} -> ${r.status}`); return r.arrayBuffer(); });

let _gltfLoader = null;
function gltfLoader() {
  if (!_gltfLoader) { _gltfLoader = new THREE.GLTFLoader(); _gltfLoader.setMeshoptDecoder(THREE.MeshoptDecoder); }
  return _gltfLoader;
}
const textureLoader = () => new THREE.TextureLoader();

const asColor = (c) => (c && c.isColor ? c.clone() : new THREE.Color(c));

/** Default base for assets: ../assets3d/ next to vendor3d/ (web/assets3d). */
export function defaultAssetBase() { return new URL('../assets3d/', HERE).href; }

export async function loadClips(setOrUrl = 'base', base = defaultAssetBase()) {
  const name = String(setOrUrl).replace(/\.json$/, '');
  return cached(`clips:${base}${name}`, async () => {
    const [json, buf] = await Promise.all([fetchJson(`${base}clips/${name}.json`), fetchBuf(`${base}clips/${name}.bin`)]);
    const raw = decodeClips(json, buf);
    const out = {};
    for (const k in raw) out[k] = new Clip({ ...raw[k], name: k });
    Object.defineProperty(out, '__meta', { value: { bip01RestQ: json.bip01RestQ || [-0.5, -0.5, -0.5, 0.5] }, enumerable: false });
    return out;
  });
}

function shaderTint(mat, kind, u) {
  mat.userData.tint = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    const head = kind === 'head';
    if (!head) sh.vertexShader = `varying float vBy; varying float vBx;\n${sh.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\n vBy = position.y; vBx = abs(position.x);');
    sh.fragmentShader = `uniform sampler2D tMask; uniform sampler2D tSkin; uniform vec3 uTop; uniform vec3 uBottoms; uniform vec3 uSocks; uniform vec3 uSkin; uniform float uSkinK; uniform float uSkinLum; uniform vec3 uHair; uniform float uHairK; uniform float uHairLum; float gFloor = 0.0; ${head ? '' : 'varying float vBy; varying float vBx;'}\n${sh.fragmentShader}`.replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec3 m = texture2D(tMask, vMapUv).rgb;
        vec3 c = diffuseColor.rgb;
        ${head
    ? 'c = mix(c, uHair * clamp(pow(dot(c, vec3(0.2126, 0.7152, 0.0722)) / uHairLum, 0.65), 0.25, 2.6), m.r * uHairK); float skin = m.g;'
    : 'vec3 b0 = c; float cm = clamp(m.r + m.g + m.b, 0.0, 1.0); b0 *= mix(1.0, clamp(0.58 / max(dot(b0, vec3(0.2126, 0.7152, 0.0722)), 0.02), 1.0, 8.0), cm); c = mix(c, b0 * uTop, m.r); c = mix(c, b0 * uBottoms, m.g); c = mix(c, b0 * uSocks, m.b); float skin = texture2D(tSkin, vMapUv).r;'}
        ${head ? '' : 'if (skin < 0.5 && cm < 0.5 && vBy > 0.3 && vBx < 0.22 && dot(c, vec3(0.2126, 0.7152, 0.0722)) < 0.14) c = vec3(0.72) * (vBy > 1.0 ? uTop : uBottoms);   // near-black texels above the knee are hem/seam paint, never real detail'}
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        ${head ? '' : 'if (skin > 0.5) { float fl = 0.55 * uSkinLum; if (l < fl) { c *= clamp(fl / max(l, 0.004), 1.0, 12.0); l = dot(c, vec3(0.2126, 0.7152, 0.0722)); } }   // skin under hems / in joints is painted near-black: lift it'}
        c = mix(c, uSkin * clamp(l / uSkinLum, 0.0, 2.4), skin * uSkinK);
        diffuseColor.rgb = c;
        gFloor = ${head ? '0.0' : '0.4'};
      }`).replace('#include <opaque_fragment>', `#include <opaque_fragment>
      gl_FragColor.rgb = max(gl_FragColor.rgb, diffuseColor.rgb * gFloor);   // cloth never goes black (inner layers, faces turned from the light)
      if (!gl_FrontFacing) gl_FragColor.rgb = diffuseColor.rgb * 0.62;   // inside of cloth hems: flat, matching colour (never black)`);
  };
  mat.customProgramCacheKey = () => `view3d-${kind}`;
}

export class Human {
  constructor(o) {
    Object.assign(this, o); // root, model, bones, info, clips, mats, skinned, rest
    this.layers = { base: new Layer('base', { mask: 'all' }) };
    this.layerList = [this.layers.base];
    this._pose = makePose();
    this._listeners = {};
    this.groundY = 0;
    this.groundClamp = 'auto'; // 'auto' | 'off' | 'feet'
    this.footPlanting = true;
    this.maxFootDrag = 0.3; // metres before a planted foot is re-placed (a step)
    this.facing = 0;
    this._yawTarget = 0;
    this.turnRate = 0; // rad/s; 0 = instant
    this.autoMove = false; // advance root by clip.speed * playback speed along facing
    this.props = [];
    this._reach = { L: null, R: null }; this._reachFoot = { L: null, R: null };
    this._propTarget = null;
    this._targets = {};
    this.comfortTilt = 1;   // 0 disables the wrist-comfort tilt of gripped props
    this.timeScale = 1;
    this._pending = null;
    this._ankleRest = 0.08;
    this.updated = true;
    this._setup();
  }

  _setup() {
    const b = this.bones;
    this.pelvis = b.Bip01_Pelvis;
    this.pelvisRest = this.pelvis.position.clone();
    // clips store the pelvis rotation relative to the source rig's Bip01 (which has a rest rotation); our GLB root is identity
    {
      const bq = (this.clips.__meta && this.clips.__meta.bip01RestQ) || [-0.5, -0.5, -0.5, 0.5];
      const par = this.pelvis.parent.getWorldQuaternion(new THREE.Quaternion());
      this.pelvisPre = par.invert().multiply(new THREE.Quaternion(bq[0], bq[1], bq[2], bq[3]));
    }
    this.pelvisHeight = this.info.pelvisHeight || this.pelvis.getWorldPosition(new THREE.Vector3()).y;
    this.restPose = makePose();
    CLIP_BONES.forEach((n, i) => { const q = b[n].quaternion.clone(); if (i === 0) q.premultiply(this.pelvisPre.clone().invert()); this.restPose.q.set([q.x, q.y, q.z, q.w], i * 4); });
    this.model.updateMatrixWorld(true);
    this._captureRest();
    this.fingers = { L: new FingerRig(b, 'L'), R: new FingerRig(b, 'R') };
    this.wrists = { L: new WristLimiter(b, 'L'), R: new WristLimiter(b, 'R') };
    this.look = new LookAt(b, () => this.root);
    this._ankleRest = Math.max(0.04, Math.min(0.15, b.Bip01_L_Foot.getWorldPosition(new THREE.Vector3()).y));
    this._bones22 = CLIP_BONES.map((n) => b[n]);
    this.legs = ['L', 'R'].map((s) => ({ side: s, thigh: b[`Bip01_${s}_Thigh`], calf: b[`Bip01_${s}_Calf`], foot: b[`Bip01_${s}_Foot`], toe: b[`Bip01_${s}_Toe0`], lock: new THREE.Vector3(), planted: false, w: 0, ankleY: 0 }));
    this.arms = { L: { upper: b.Bip01_L_UpperArm, mid: b.Bip01_L_Forearm, end: b.Bip01_L_Hand }, R: { upper: b.Bip01_R_UpperArm, mid: b.Bip01_R_Forearm, end: b.Bip01_R_Hand } };
    this._fingerPose = { L: 'relaxed', R: 'relaxed' };
    this._fingerAuto = { L: true, R: true };
    this._applyRest();
  }

  // rest-pose frames used by equipment: world up / forward expressed in a bone's local space, and the head's skinned extents
  _captureRest() {
    this._restQ = {};
    for (const n of ['Head', 'L_Calf', 'R_Calf', 'L_Thigh', 'R_Thigh', 'L_Foot', 'R_Foot', 'L_Hand', 'R_Hand', 'Spine2']) this._restQ[n] = this.bones[`Bip01_${n}`].getWorldQuaternion(new THREE.Quaternion());
    const mesh = this.model.getObjectByProperty('isSkinnedMesh', true);
    const sk = mesh && mesh.skeleton;
    this.headBox = null;
    if (sk) {
      const hi = sk.bones.indexOf(this.bones.Bip01_Head);
      const pos = mesh.geometry.attributes.position, si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
      const box = new THREE.Box3(); const v = new THREE.Vector3(); const m = new THREE.Matrix4().multiplyMatrices(sk.boneInverses[hi], mesh.bindMatrix);
      for (let i = 0; i < pos.count; i++) {
        let w = 0; for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === hi) w += sw.getComponent(i, k);
        if (w > 0.9) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m));
      }
      if (!box.isEmpty()) this.headBox = box;
    }
  }

  /** World up / forward / left of the avatar in the local space of a bone (rest pose). */
  boneFrame(name) {
    const q = this._restQ[name].clone().invert();
    return { up: new THREE.Vector3(0, 1, 0).applyQuaternion(q), fwd: new THREE.Vector3(0, 0, 1).applyQuaternion(q), left: new THREE.Vector3(1, 0, 0).applyQuaternion(q) };
  }

  _applyRest() { this._writePose(this.restPose, true); }

  // ------------------------------------------------------------ transform
  setPosition(x, y, z) { this.root.position.set(x, y ?? this.root.position.y, z ?? this.root.position.z); return this; }

  get position() { return this.root.position; }

  /** Yaw in radians: 0 faces +Z, +PI/2 faces +X. */
  setFacing(angle, { snap = true } = {}) {
    this._yawTarget = angle;
    if (snap || !this.turnRate) { this.facing = angle; this.root.rotation.y = angle; }
    return this;
  }

  /** Face towards a ground point (x,z) or direction; returns the yaw. */
  faceToward(x, z, { snap = true } = {}) {
    const dx = x - this.root.position.x, dz = z - this.root.position.z;
    if (dx * dx + dz * dz < 1e-8) return this._yawTarget;
    const a = Math.atan2(dx, dz);
    this.setFacing(a, { snap });
    return a;
  }

  faceDirection(dx, dz, opts) { if (dx * dx + dz * dz < 1e-10) return this._yawTarget; const a = Math.atan2(dx, dz); this.setFacing(a, opts); return a; }

  get forward() { return new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing)); }

  // ------------------------------------------------------------ clips
  getClip(c) {
    if (c && c.frames) return c;
    const clip = this.clips[c];
    if (!clip) throw new Error(`view3d: unknown clip "${c}". Available: ${Object.keys(this.clips).join(', ')}`);
    return clip;
  }

  hasClip(n) { return !!this.clips[n]; }

  addClip(clip, name) { this.clips[name || clip.name] = clip; return clip; }

  /** Play a clip on the base layer (or opts.layer). opts: {fade, speed, loop, startTime, startPhase, onDone, layer} */
  play(clip, opts = {}) {
    const c = this.getClip(clip);
    if (this._turn && c !== this._turn.clip && (!opts.layer || opts.layer === 'base')) { this._turn = null; this.facing = this.root.rotation.y; this._yawTarget = this.facing; }
    const layer = this._layer(opts.layer);
    const tr = layer.play(c, opts);
    if (!opts.layer || opts.layer === 'base') this._applyClipFingers(c);
    this.updated = true;
    return tr;
  }

  crossfade(clip, duration = 0.25, opts = {}) { return this.play(clip, { ...opts, fade: duration }); }

  /** Switch only if `clip` isn't already the current base clip (handy for per-tick state-driven presenters). */
  ensure(clip, opts = {}) {
    const c = this.getClip(clip);
    const cur = (opts.layer ? this._layer(opts.layer) : this.layers.base).current;
    if (cur && cur.clip === c && cur.target > 0) return cur;
    return this.play(c, opts);
  }

  get current() { return this.layers.base.current; }

  setSpeed(s) { const t = this.layers.base.current; if (t) t.speed = s; }

  _layer(name) {
    if (!name || name === 'base') return this.layers.base;
    if (!this.layers[name]) throw new Error(`view3d: no layer "${name}"; create it with human.addLayer(name, {mask, additive})`);
    return this.layers[name];
  }

  /** Create an overlay layer: mask = 'upper'|'arms'|'armL'|'armR'|'legs'|'head'|'spine'|bone-name array|Float32Array; additive = play clip as a delta from its frame 0. */
  addLayer(name, { mask = 'upper', additive = false, weight = 1 } = {}) {
    const m = Array.isArray(mask) ? MASKS.fromBones(mask) : mask;
    const l = new Layer(name, { mask: m, additive, weight });
    this.layers[name] = l; this.layerList.push(l);
    return l;
  }

  /**
   * Retime the current base clip so that its `event` ('contact', 'release', ...) happens exactly `eta` seconds from now
   * (the simulation owns contact; the animation adapts). Call again whenever the ETA changes. Rate is clamped to
   * [minRate,maxRate]; if the clip is already past the event nothing happens. Returns false if it cannot be honoured.
   */
  timeWarpTo(event, eta, { minRate = 0.4, maxRate = 3.2, onEvent } = {}) {
    const tr = this.layers.base.current;
    if (!tr) return false;
    const et = typeof event === 'number' ? event : tr.clip.events[event];
    if (et === undefined || tr.time > et + 1e-4) return false;
    tr.warp = { clipTime: et, eta: Math.max(0, eta), min: minRate, max: maxRate, cb: onEvent || null };
    return true;
  }

  /**
   * Start a one-shot so its `event` lands `eta` seconds from now (skips into the clip when eta is short, waits in the
   * current pose when eta is long), then continues at normal speed. Returns the {startTime, delay} it chose.
   */
  playTimed(clip, event, eta, { fade = 0.15, minRate = 0.5, maxRate = 2.6, speed = 1, onEvent, frameDt = 0, ...rest } = {}) {
    // frameDt: pass the dt that update() is about to apply in the same frame (the frame in which you call this). The clip then
    // starts one dt "early" so the event pose is rendered exactly eta seconds after the call's frame.
    const c = this.getClip(clip);
    const et = typeof event === 'number' ? event : c.events[event];
    if (et === undefined) { this.play(c, { fade, speed, ...rest }); return { startTime: 0, delay: 0 }; }
    let startTime = 0, delay = 0;
    if (eta * maxRate < et) startTime = Math.max(0, et - eta * maxRate);
    startTime -= frameDt; eta += frameDt;
    const lead = et - startTime;
    if (eta > lead / minRate) delay = eta - lead / minRate;
    const start = () => {
      this.play(c, { fade, speed, startTime, loop: false, ...rest });
      this.timeWarpTo(et, Math.max(0.001, eta - delay), { minRate, maxRate, onEvent });
    };
    if (delay > 0.001) this._pending = { at: delay, fn: start }; else start();
    return { startTime, delay };
  }

  /**
   * Turn on the spot by `delta` radians (+ = left/counter-clockwise from above) using a 90/180 degree turn clip whose
   * yaw curve is scaled to the exact angle; the facing is updated when it finishes. Returns the clip name or null.
   */
  turn(delta, { fade = 0.15, then = 'idle' } = {}) {
    const d = Math.atan2(Math.sin(delta), Math.cos(delta));
    if (Math.abs(d) < 0.12) { this.setFacing(this.facing + d); return null; }
    const name = Math.abs(d) > 2.36 ? (d > 0 ? 'turn_left_180' : 'turn_right_180') : (d > 0 ? 'turn_left' : 'turn_right');
    const clip = this.clips[name];
    if (!clip || !clip.yaw) { this.setFacing(this.facing + d); return null; }
    const last = clip.yaw[clip.frames - 1] || 1;
    const start = this.facing;
    this._turn = { start, clip, scale: d / last };
    this.play(clip, { fade, onDone: () => { this._turn = null; this.facing = start + d; this._yawTarget = this.facing; this.root.rotation.y = this.facing; if (then) this.play(then, { fade: 0.2 }); } });
    return name;
  }

  /** Smooth locomotion: pass the ground speed (m/s); picks idle/walk/jog/sprint, matches foot speed to the ground, phase-aligns crossfades. */
  locomote(speed, { fade = 0.25, set: names = null } = {}) {
    // names: optional clip substitutions, e.g. { jog: 'run_ball_jog', sprint: 'run_ball_sprint' } (a bowler's run-up with the ball in hand)
    const nm = (k) => (names && names[k]) || k;
    const key = names ? JSON.stringify(names) : '';
    const set = (this._locoSets ||= {})[key] || (this._locoSets[key] = [
      { name: nm('idle'), v: 0 }, { name: nm('walk'), v: this.clips[nm('walk')] ? this.clips[nm('walk')].speed || 1.4 : 1.4 }, { name: nm('jog'), v: this.clips[nm('jog')] ? this.clips[nm('jog')].speed || 4 : 4 }, { name: nm('sprint'), v: this.clips[nm('sprint')] ? this.clips[nm('sprint')].speed || 7 : 7 },
    ].filter((s) => this.clips[s.name]));
    let pick = set[0];
    for (const s of set) { if (speed >= s.v * 0.55 || s.v === 0) pick = s; }
    if (speed < 0.12) pick = set[0];
    const cur = this.layers.base.current;
    if (!cur || cur.clip.name !== pick.name || cur.target === 0) {
      const opts = { fade, loop: true };
      if (cur && cur.clip.loop && cur.clip.events.footL !== undefined && this.clips[pick.name].events.footL !== undefined && pick.name !== 'idle') {
        const a = cur.clip, b = this.clips[pick.name];
        const ph = (((cur.time - a.events.footL) / a.dur) % 1 + 1) % 1;
        opts.startTime = ((b.events.footL + ph * b.dur) % b.dur);
      }
      this.play(pick.name, opts);
    }
    const t = this.layers.base.current;
    t.speed = pick.v > 0 ? Math.min(1.8, Math.max(0.5, speed / pick.v)) : 1;
    return pick.name;
  }

  _fire(name, clip, tr) { (this._evq ||= []).push([name, clip, tr.time]); }

  _flushEvents() { const q = this._evq; if (!q || !q.length) return; this._evq = []; for (const [name, clip, time] of q) this._dispatch(name, clip, time); }

  _dispatch(name, clip, time) { const tr = { time }; const l = this._listeners[name]; if (l) for (const f of l) f({ name, clip: clip.name, human: this, time: tr.time }); const a = this._listeners['*']; if (a) for (const f of a) f({ name, clip: clip.name, human: this, time: tr.time }); }

  on(event, fn) { (this._listeners[event] ||= []).push(fn); return () => { this._listeners[event] = this._listeners[event].filter((f) => f !== fn); }; }

  // ------------------------------------------------------------ fingers
  /** pose: name from FINGER_POSES, or {curl:[[3]x5], spread:[5]}. Auto fingers (from clip hints) are overridden until setFingers(side,'auto'). */
  setFingers(side, pose, { rate = 12 } = {}) {
    for (const s of side === 'both' ? ['L', 'R'] : [side]) {
      if (pose === 'auto' || pose == null) { this._fingerAuto[s] = true; this._fingerPose[s] = this._clipFingerHint || 'relaxed'; } else { this._fingerAuto[s] = false; this._fingerPose[s] = pose; }
      this.fingers[s].rate = rate;
    }
  }

  _applyClipFingers(clip) { this._clipFingerHint = clip.fingers || 'relaxed'; for (const s of ['L', 'R']) if (this._fingerAuto[s]) this._fingerPose[s] = (clip.fingerHands && clip.fingerHands[s]) || this._clipFingerHint; }

  // ------------------------------------------------------------ look at
  /** Aim head/neck at a world point (Vector3 or {x,y,z}); null releases. */
  lookAt(target, { weight = 1, maxYaw, maxPitch } = {}) {
    this.look.target = target ? new THREE.Vector3(target.x, target.y, target.z) : null;
    this.look.weight = weight;
    if (maxYaw !== undefined) this.look.maxYaw = maxYaw;
    if (maxPitch !== undefined) this.look.maxPitch = maxPitch;
  }

  // ------------------------------------------------------------ props / grips
  /**
   * Attach an Object3D to a hand. grip: 'bat' | 'ball' | 'racket' | 'stick' or {pos:[x,y,z], quat:[x,y,z,w]} in hand space.
   * Prop convention: the prop's +Y is its long axis from butt (origin) to tip; units metres. `slide` moves the grip point along the prop.
   * Also sets the fingers to the matching pose (batGrip/ballGrip). Returns the prop.
   */
  attach(prop, side = 'R', grip = 'bat', { slide, fingers } = {}) {
    const hand = typeof side === 'string' && side.length === 1 ? this.bones[`Bip01_${side}_Hand`] : this.bones[side];
    const s = side.length === 1 ? side : (side.includes('_L_') ? 'L' : 'R');
    const fr = this.fingers[s];
    this.detach(prop);
    const g = typeof grip === 'string' ? gripFrame(fr, grip, slide) : { pos: new THREE.Vector3(...grip.pos), quat: new THREE.Quaternion(...(grip.quat || [0, 0, 0, 1])), pose: grip.pose };
    prop.position.copy(g.pos); prop.quaternion.copy(g.quat);
    hand.add(prop);
    this.props.push({ prop, hand, side: s, grip: typeof grip === 'string' ? grip : 'custom', slide });
    const fp = fingers || g.pose;
    if (fp) this.setFingers(s, fp);
    this.updated = true;
    return prop;
  }

  detach(prop, { fingers = 'auto' } = {}) {
    const i = this.props.findIndex((p) => p.prop === prop);
    if (i < 0) return;
    const p = this.props[i];
    p.hand.remove(prop);
    this.props.splice(i, 1);
    if (this._hold && this._hold.prop === prop) this._hold = null;
    if (fingers) this.setFingers(p.side, fingers);
  }

  /** Named world-space targets referenced by authored clips (e.g. the bat track's `sweet: 'contact'` key). */
  setTarget(name, point) { if (point) (this._targets[name] ||= new THREE.Vector3()).set(point.x, point.y, point.z); else delete this._targets[name]; }

  /**
   * Presenter-driven hand reach: put the hand of `side` at a WORLD point (ball release point, catch point), blended by weight.
   * Call every frame (weight 0 / point null releases). The elbow keeps its animated bend unless `pole` (world point) is given.
   */
  setReach(side, point, { weight = 1, pole = null } = {}) {
    if (!point || weight <= 0) { this._reach[side] = null; return; }
    this._reach[side] = { p: new THREE.Vector3(point.x, point.y, point.z), weight, pole: pole ? new THREE.Vector3(pole.x, pole.y, pole.z) : null };
  }

  /** Put the ANKLE of `side` at a world point (optionally also orienting the foot with a world quaternion), blended by weight; null releases. Pair with contact.solveFootBall. */
  setReachFoot(side, ankle, weight = 1, quat = null) {
    if (!ankle || weight <= 0) { this._reachFoot[side] = null; return; }
    this._reachFoot[side] = { p: new THREE.Vector3(ankle.x, ankle.y, ankle.z), weight, quat: quat ? quat.clone() : null };
  }

  /**
   * Make a point on an attached prop (`local`, in prop space, e.g. the bat's sweet spot [0,0.56,0]) meet a world point
   * (the ball) by moving the gripping hand, blended by weight (ramp it up to 1 at contact). Call every frame; null clears.
   * The sim owns where contact happens; this only makes the picture agree with it.
   */
  setPropTarget(prop, local, point, { weight = 1 } = {}) {
    const p = this.props.find((x) => x.prop === prop);
    if (!p || !point || weight <= 0) { this._propTarget = null; return; }
    this._propTarget = { prop, side: p.side, local: new THREE.Vector3(local[0], local[1], local[2]), point: new THREE.Vector3(point.x, point.y, point.z), weight };
  }

  /**
   * Second hand on an already attached prop (two-handed bat/club): the second arm is solved with IK so the hand sits
   * on the handle `gap` metres above the first hand, with matching grip orientation.
   */
  holdTwoHanded(prop, side = 'L', { gap = 0.1, weight = 1, pole = null } = {}) {
    const p = this.props.find((x) => x.prop === prop);
    if (!p) throw new Error('view3d: attach(prop, "R", "bat") before holdTwoHanded');
    const fr = this.fingers[side];
    const g = (p.slide ?? 0.19) + gap;
    this._hold = { prop, side, gap, weight, pole, frames: [gripFrame(fr, 'bat', g, 1), gripFrame(fr, 'bat', g, -1)] };
    this.setFingers(side, 'batGrip');
  }

  releaseSecondHand() { if (this._hold) { this.setFingers(this._hold.side, 'auto'); this._hold = null; } }

  // ------------------------------------------------------------ level of detail
  /** level: 0|'full', 1|'medium', 2|'light'. Same skeleton/clips/tint at every level. Light = 1 mesh, 1 material, ~12% of the triangles. */
  setLOD(level) {
    const lv = typeof level === 'string' ? Math.max(0, LOD_NAMES.indexOf(level)) : Math.max(0, Math.min(2, level | 0));
    if (!this.lodSets || lv === this.lod) return this;
    if (lv > 0 && !this.lodSets.ready) throw new Error('view3d: this human was loaded without LOD meshes (loadHuman({ lod: true }) or any lod option builds them)');
    this.lod = lv;
    for (let i = 0; i < 3; i++) for (const m of this.lodSets[LOD_NAMES[i]]) m.visible = i === lv;
    this.updated = true;
    return this;
  }

  get lodName() { return LOD_NAMES[this.lod || 0]; }

  /** Pick the level from the person's size on screen (call per frame, or let stage.setAutoLOD do it). Returns the level. */
  autoLOD(camera, viewportHeight, policy = this.lodPolicy || LOD_POLICY.high) {
    if (!this.lodSets || !this.lodSets.ready) return 0;
    const lv = pickLod(screenHeightPx(this, camera, viewportHeight), policy, this.lod || 0);
    this.setLOD(lv);
    return lv;
  }

  /** Quality tier: 'low' never uses the full level and drops real shadows for this human; 'medium'/'high' trade the size thresholds. */
  setQuality(tier) {
    this.tier = tier;
    this.lodPolicy = LOD_POLICY[tier] || LOD_POLICY.high;
    const shadow = tier !== 'low';
    this.root.traverse((o) => { if (o.isSkinnedMesh) o.castShadow = shadow; });
    if (tier === 'low' && this.lodSets && this.lodSets.ready && (this.lod || 0) === 0) this.setLOD(1);
    return this;
  }

  // ------------------------------------------------------------ appearance
  setKit({ top, bottoms, socks } = {}) {
    for (const m of this.mats) {
      const u = m.userData.tint; if (!u) continue;
      const ref = this.info.clothRef || 0.8;
      if (top !== undefined) u.uTop.value.copy(asColor(top)).multiplyScalar(1 / ref);
      if (bottoms !== undefined) u.uBottoms.value.copy(asColor(bottoms)).multiplyScalar(1 / ref);
      if (socks !== undefined) u.uSocks.value.copy(asColor(socks)).multiplyScalar(1 / ref);
    }
  }

  setSkin(tone) {
    const hex = SKIN_TONES[tone] !== undefined ? SKIN_TONES[tone] : tone;
    for (const m of this.mats) {
      const u = m.userData.tint; if (!u) continue;
      u.uSkinK.value = hex ? 1 : 0;
      if (hex) u.uSkin.value.copy(asColor(hex));
    }
  }

  setHair(color) {
    const hex = HAIR_COLORS[color] !== undefined ? HAIR_COLORS[color] : color;
    for (const m of this.mats) {
      const u = m.userData.tint; if (!u || (m.userData.kind !== 'head' && m.userData.kind !== 'light')) continue;
      u.uHairK.value = hex ? 1 : 0;
      if (hex) u.uHair.value.copy(asColor(hex));
    }
  }

  // ------------------------------------------------------------ queries
  bonePosition(name, out = new THREE.Vector3()) { const b = this.bones[name.startsWith('Bip01') ? name : `Bip01_${name}`]; this.root.updateMatrixWorld(); return b.getWorldPosition(out); }

  handPosition(side = 'R', out) { return this.bonePosition(`${side}_Hand`, out); }

  // ------------------------------------------------------------ update
  /** Advance by dt seconds. Returns true (the pose may have changed). */
  update(dt) {
    dt *= this.timeScale;
    if (this._pending) { this._pending.at -= dt; if (this._pending.at <= 0) { const f = this._pending.fn; this._pending = null; f(); } }
    // facing
    if (this.turnRate > 0 && this.facing !== this._yawTarget) {
      let d = this._yawTarget - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const s = this.turnRate * dt;
      this.facing = Math.abs(d) <= s ? this._yawTarget : this.facing + Math.sign(d) * s;
      this.root.rotation.y = this.facing;
    }
    for (const l of this.layerList) l.update(dt, this);
    // turn clips carry their body yaw as a curve: the root follows it so the feet turn with the body
    if (this._turn) {
      const tt = this._turn, tr = this.layers.base.current;
      if (tr && tr.clip === tt.clip) {
        const f = Math.min(tt.clip.frames - 1, Math.max(0, tr.time * tt.clip.fps));
        const i0 = Math.floor(f), i1 = Math.min(tt.clip.frames - 1, i0 + 1), w = f - i0;
        const y = (tt.clip.yaw[i0] + (tt.clip.yaw[i1] - tt.clip.yaw[i0]) * w) * tt.scale;
        this.root.rotation.y = tt.start + y;
      }
    }
    // root motion (presenter-free demo mode)
    if (this.autoMove) {
      const tr = this.layers.base.current;
      if (tr && !tr.clip.loop && tr.clip.travel && tr.clip.travel[1] && !tr.finished) {
        const v = (tr.clip.travel[1] / tr.clip.dur) * tr.speed;
        this.root.position.x += Math.sin(this.facing) * v * dt;
        this.root.position.z += Math.cos(this.facing) * v * dt;
      } else if (tr && tr.clip.speed > 0) {
        const v = tr.clip.speed * tr.speed;
        this.root.position.x += Math.sin(this.facing) * v * dt;
        this.root.position.z += Math.cos(this.facing) * v * dt;
      }
    }
    // pose
    const pose = this._pose;
    copyPose(pose, this.restPose);
    for (const l of this.layerList) l.evaluate(pose);
    this._writePose(pose, false);
    this._post(dt);
    this._flushEvents();          // events fire AFTER the pose of their frame exists, so listeners can measure it
    return true;
  }

  _writePose(pose, rest) {
    const q = pose.q;
    for (let i = 0; i < NB; i++) this._bones22[i].quaternion.set(q[i * 4], q[i * 4 + 1], q[i * 4 + 2], q[i * 4 + 3]);
    this.pelvis.quaternion.premultiply(this.pelvisPre);
    const h = this.pelvisHeight;
    this.pelvis.position.set(this.pelvisRest.x + pose.p[0] * h, this.pelvisRest.y + pose.p[1] * h, this.pelvisRest.z + pose.p[2] * h);
    if (rest) { this.root.updateMatrixWorld(true); }
  }

  _post(dt) {
    const root = this.root;
    root.updateMatrixWorld(true);
    // 1) fingers + wrists (local-only, cheap); the light level skips them (invisible at that size)
    for (const s of ['L', 'R']) {   // fingers and wrist limits run at every level (a light-level hand without them is a flat board)
      const f = this.fingers[s];
      if (f.ok) {
        const p = this._fingerPose[s];
        f.setTarget(typeof p === 'string' ? (FINGER_POSES[p] || FINGER_POSES.relaxed) : p);
        f.step(dt, f.rate || 12);
        f.apply();
      }
      this.wrists[s].apply();
    }
    // 2) ground clamp
    this._groundClamp(dt);
    // 2b) look at: turns neck/head (and a little of the upper spine) BEFORE the IK passes, so hands, bat and ball still land where the sim says
    if (!(this.lod === 2 && this.cheapLight !== false)) this.look.apply(dt);
    // 3) authored IK tracks from the current clip
    this._clipIK();
    // 4) foot planting
    if (this.footPlanting && !(this.lod === 2 && this.cheapLight !== false)) this._footPlant(dt);
    // 5) second hand on a prop
    if (this._hold) this._twoHand();
    root.updateMatrixWorld(true);
  }

  _groundClamp(dt) {
    if (this._airborne) { this.model.position.y = 0; return; }
    const cur = this.layers.base.current;
    const mode = this.groundClamp;
    if (mode === 'off' || !cur) { this.model.position.y = 0; return; }
    const v = new THREE.Vector3();
    let minAnkle = Infinity, minToe = Infinity;
    const rootY = this.root.position.y + this.groundY;
    for (const leg of this.legs) {
      leg.foot.getWorldPosition(v); minAnkle = Math.min(minAnkle, v.y - rootY - this.model.position.y);
      leg.toe.getWorldPosition(v); minToe = Math.min(minToe, v.y - rootY - this.model.position.y);
    }
    const feetMode = mode === 'feet' || (mode === 'auto' && cur.clip.grounded);
    // lift when anything penetrates; when grounded, also lower when hovering (small, smoothed)
    let want = Math.max(0, this._ankleRest - minAnkle, 0.012 - minToe);
    if (feetMode) want = Math.max(-0.10, Math.min(0.16, this._ankleRest - minAnkle));
    const k = Math.min(1, dt * 14);
    this.model.position.y += (want - this.model.position.y) * k;
    this.root.updateMatrixWorld(true);
  }

  _clipIK() {
    const tr = this.layers.base.current;
    const clip = tr && tr.clip;
    const v = new THREE.Vector3();
    const pole = new THREE.Vector3();
    if (clip && clip.ik) {
      for (const t of clip.ik) {
        const [side, kind] = t.side ? [t.side, t.kind] : [t.bone[0], t.bone.endsWith('Hand') ? 'hand' : 'foot'];
        const w = (t.weight ?? 1) * (t.weightKeys ? evalScalar(t.weightKeys, tr.time) : 1);
        if (w <= 0.001) continue;
        const target = evalKeys(t.keys, tr.time, clip.dur, this);
        v.set(target[0], target[1], target[2]);
        if (t.space !== 'world' && !target.worldResolved) v.applyMatrix4(this.root.matrixWorld);
        const chain = kind === 'hand' ? this.arms[side] : { upper: this.legs[side === 'L' ? 0 : 1].thigh, mid: this.legs[side === 'L' ? 0 : 1].calf, end: this.legs[side === 'L' ? 0 : 1].foot };
        let p = null;
        if (t.poleKeys) { const pk = evalKeys(t.poleKeys, tr.time, clip.dur); pole.set(pk[0], pk[1], pk[2]); if (t.space !== 'world') pole.applyMatrix4(this.root.matrixWorld); p = pole; }
        const keepQ = kind === 'foot' ? chain.end.getWorldQuaternion(new THREE.Quaternion()) : null;
        solveTwoBone(chain.upper, chain.mid, chain.end, v, { weight: w, pole: p });
        if (keepQ) setWorldQuat(chain.end, keepQ);   // hands keep their local wrist relation (no twisted wrists)
      }
    }
    // presenter-driven reach (world space): ball catches, release points
    for (const side of ['L', 'R']) {
      const r = this._reach[side];
      if (!r || r.weight <= 0.001) continue;
      const a = this.arms[side];
      solveTwoBone(a.upper, a.mid, a.end, r.p, { weight: r.weight, pole: r.pole });
    }
    // authored prop (bat) pose track: grip point + direction + roll in character space, solved with arm IK
    if (clip && clip.propTrack) this._propTrack(tr.time, clip);
    for (const side of ['L', 'R']) {
      const r = this._reachFoot[side]; if (!r || r.weight <= 0.001) continue;
      const leg = this.legs[side === 'L' ? 0 : 1];
      solveTwoBone(leg.thigh, leg.calf, leg.foot, r.p, { weight: r.weight });
      if (r.quat) { const cur = leg.foot.getWorldQuaternion(new THREE.Quaternion()); setWorldQuat(leg.foot, cur.slerp(r.quat, r.weight)); }
    }
    // prop sweet-spot target: shift the gripping hand so a point on the prop meets a world point
    if (this._propTarget) {
      const pt = this._propTarget;
      const a = this.arms[pt.side];
      const cur = new THREE.Vector3(), hp = new THREE.Vector3();
      for (let it = 0; it < 3; it++) {
        this.root.updateMatrixWorld(true);
        pt.prop.updateWorldMatrix(true, false);
        cur.copy(pt.local).applyMatrix4(pt.prop.matrixWorld);
        a.end.getWorldPosition(hp);
        const d = pt.point.clone().sub(cur);
        if (d.length() < 0.002) break;
        solveTwoBone(a.upper, a.mid, a.end, hp.add(d.multiplyScalar(1)), { weight: pt.weight });
      }
    }
  }

  _propTrack(time, clip) {
    const pr = this.props.find((p) => p.grip !== 'ball' && p.prop);   // the primary-hand prop (right- or left-handed)
    if (!pr) return;
    const side = pr.side;
    const keys = clip.propTrack;
    const sweetLen = pr.prop.userData.sweet ?? 0.56, slide = pr.slide ?? 0.19;
    const inv = this.root.matrixWorld.clone().invert();
    const resolve = (k, out) => {
      const d = new THREE.Vector3(...k.dir).normalize();
      let grip;
      if (k.sweet) {
        const sw = k.sweet === 'contact' ? (this._targets.contact ? this._targets.contact.clone().applyMatrix4(inv) : new THREE.Vector3(0.6, 0.5, 0.0)) : new THREE.Vector3(...k.sweet);
        grip = sw.addScaledVector(d, -(sweetLen - slide));
      } else grip = new THREE.Vector3(...k.grip);
      out.grip = grip; out.dir = d; out.roll = k.roll || 0;
      return out;
    };
    let i1 = keys.findIndex((k) => k.t >= time); if (i1 < 0) i1 = keys.length - 1;
    const i0 = Math.max(0, i1 - 1);
    const a = resolve(keys[i0], {}), b = resolve(keys[i1], {});
    let x = i1 === i0 || keys[i1].t === keys[i0].t ? 1 : Math.min(1, Math.max(0, (time - keys[i0].t) / (keys[i1].t - keys[i0].t)));
    const e = keys[i1].ease ? keys[i1].ease(x) : x * x * (3 - 2 * x);
    const grip = a.grip.clone().lerp(b.grip, e);
    const dir = a.dir.clone().lerp(b.dir, e).normalize();
    const roll = a.roll + (b.roll - a.roll) * e;
    // prop frame in world; roll about the handle AND a small tilt of the handle direction (<= ~14 deg) are chosen so the wrist stays natural
    const gq = pr.prop.quaternion, gp = pr.prop.position;
    const Q0 = new THREE.Quaternion().setFromUnitVectors(_upY, dir);
    const rq = this.root.getWorldQuaternion(new THREE.Quaternion());
    const arm = this.arms[side];
    const tiltQ = (rx, rz) => new THREE.Quaternion().setFromEuler(new THREE.Euler(rx * Math.PI / 180, 0, rz * Math.PI / 180));
    const handFor = (rollDeg, tl) => {
      const Q = tl.clone().multiply(Q0).multiply(new THREE.Quaternion().setFromAxisAngle(_upY, rollDeg * Math.PI / 180));
      const handQ = Q.clone().multiply(gq.clone().invert());
      // the tilt pivots about the sweet spot (so contact points stay exact), not about the hand
      const Ls = sweetLen - slide, dirT = dir.clone().applyQuaternion(tl);
      const gripT = grip.clone().addScaledVector(dir, Ls).addScaledVector(dirT, -Ls);
      const origin = gripT.addScaledVector(dirT, -slide);
      const handPos = origin.sub(gp.clone().applyQuaternion(handQ)).applyMatrix4(this.root.matrixWorld);
      return { handQ: rq.clone().multiply(handQ), handPos };
    };
    const auto = !(typeof keys[i1].roll === 'number' && typeof keys[i0].roll === 'number');
    let rollDeg = roll;
    const tl0 = this._autoTilt || (this._autoTilt = { rx: 0, rz: 0 });
    let tl = tiltQ(tl0.rx, tl0.rz);
    if (auto) {
      const h0 = handFor(this._autoRoll ?? 0, tl);
      solveTwoBone(arm.upper, arm.mid, arm.end, h0.handPos, { weight: 1 });
      arm.mid.updateWorldMatrix(true, false);
      const fq = arm.mid.getWorldQuaternion(new THREE.Quaternion()).invert();
      const prev = this._autoRoll ?? 0;
      let best = null;
      const cands = this.comfortTilt === 0 ? [[0, 0]] : [[0, 0], [-12, 0], [12, 0], [0, -12], [0, 12], [-9, -9], [9, 9], [-9, 9], [9, -9]];
      for (const [rx, rz] of cands) {
        const tq = tiltQ(rx, rz);
        const tiltPen = 0.9 * (Math.hypot(rx, rz) * Math.PI / 180);
        for (let r = -180; r < 180; r += 10) {
          const rel = fq.clone().multiply(handFor(r, tq).handQ);
          const m = this.wrists[side].measureRel(rel);
          const dr = Math.abs(((r - prev + 540) % 360) - 180);
          const rem = Math.max(0, m.twist - Math.min(1.6, m.twist * 0.8));
          const cost = m.swing + 1.2 * rem + 0.12 * m.twist + 0.12 * (dr / 180) + tiltPen;
          if (!best || cost < best.cost) best = { cost, r, rx, rz };
        }
      }
      const dd = ((best.r - prev + 540) % 360) - 180;
      this._autoRoll = prev + Math.max(-70, Math.min(70, dd));
      rollDeg = this._autoRoll;
      tl0.rx += Math.max(-3, Math.min(3, best.rx - tl0.rx)); tl0.rz += Math.max(-3, Math.min(3, best.rz - tl0.rz));
      tl = tiltQ(tl0.rx, tl0.rz);
    }
    const hf = handFor(rollDeg, tl);
    solveTwoBone(arm.upper, arm.mid, arm.end, hf.handPos, { weight: 1 });
    this._setHandWorld(side, hf.handQ);
  }

  /**
   * Orient a hand in world space the way a real arm does: most of the pronation/supination comes from the FOREARM rolling about its long
   * axis, the wrist only takes the remainder (candy-wrapper wrists otherwise). Used for gripped props.
   */
  _setHandWorld(side, q) {
    const arm = this.arms[side], w = this.wrists[side];
    const axis = w.axis;
    arm.mid.updateWorldMatrix(true, false);
    const fq = arm.mid.getWorldQuaternion(new THREE.Quaternion());
    const rel = fq.invert().multiply(q);                  // desired hand in forearm space
    const d = w.rest.clone().invert().multiply(rel);      // relative to the rest wrist relation
    if (d.w < 0) { d.x *= -1; d.y *= -1; d.z *= -1; d.w *= -1; }
    const theta = 2 * Math.atan2(d.x * axis.x + d.y * axis.y + d.z * axis.z, d.w);
    const f = Math.max(-1.6, Math.min(1.6, theta * 0.8));
    arm.mid.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, f));
    arm.mid.updateWorldMatrix(false, true);
    setWorldQuat(arm.end, q);
  }

  _footPlant(dt) {
    if (this._airborne) return;
    const cur = this.layers.base.current;
    const clip = cur && cur.clip;
    if (!clip || !clip.grounded) { for (const leg of this.legs) { leg.planted = false; leg.w = 0; } return; }
    const info = contactInfo(this, clip);
    const v = new THREE.Vector3();
    const rootY = this.root.position.y + this.groundY;
    this.legs.forEach((leg, i) => {
      const flags = info.flags[i];
      const frame = Math.min(clip.frames - 1, Math.max(0, Math.round((clip.loop ? ((cur.time % clip.dur) + clip.dur) % clip.dur : cur.time) * clip.fps)));
      const contact = flags[frame] === 1;
      leg.foot.getWorldPosition(v);
      if (contact && !leg.planted) { leg.planted = true; leg.lock.copy(v); leg.lock.y = rootY + this._ankleRest; }
      if (!contact && leg.planted) leg.planted = false;
      leg.w += ((leg.planted ? 1 : 0) - leg.w) * Math.min(1, dt * (leg.planted ? 18 : 12));
      if (leg.w < 0.02) return;
      // dragged too far from where the animation wants the foot: take a step (re-plant) instead of stretching the leg
      if (Math.hypot(v.x - leg.lock.x, v.z - leg.lock.z) > this.maxFootDrag) { leg.lock.set(v.x, rootY + this._ankleRest, v.z); }
      const keepQ = leg.foot.getWorldQuaternion(new THREE.Quaternion());
      const target = leg.lock.clone();
      target.y = rootY + this._ankleRest;
      solveTwoBone(leg.thigh, leg.calf, leg.foot, target, { weight: leg.w });
      // keep the foot orientation it had in the animation, blended flat on the ground
      const flat = keepQ.clone();
      setWorldQuat(leg.foot, flat);
    });
  }

  _twoHand() {
    const h = this._hold;
    const prop = h.prop;
    prop.updateWorldMatrix(true, false);
    const arm = this.arms[h.side];
    const wr = this.wrists[h.side];
    const pq = new THREE.Quaternion().setFromRotationMatrix(prop.matrixWorld);
    const ppos = new THREE.Vector3().setFromMatrixPosition(prop.matrixWorld);
    const animQ = arm.end.getWorldQuaternion(new THREE.Quaternion());
    // candidates: handle direction (+-) x roll about the handle; pick the most natural wrist (forearm space), with continuity
    const cand = (fr, r) => {
      const rollQ = new THREE.Quaternion().setFromAxisAngle(_up, r);
      const rq = pq.clone().multiply(rollQ);
      const hq = rq.clone().multiply(fr.quat.clone().invert());
      const target = fr.pos.clone().applyQuaternion(fr.quat.clone().invert()).negate().applyQuaternion(rq).add(ppos);
      return { hq, target };
    };
    const prev = this._holdPrev || { fi: 0, r: 0 };
    // high front elbow: the second arm bends with its elbow up and out (character space), like a batter's front arm
    const sgn = h.side === 'L' ? 1 : -1;
    const poleW = (h.pole ? new THREE.Vector3(...h.pole) : new THREE.Vector3(0.55 * sgn, 1.45, 0.25)).applyMatrix4(this.root.matrixWorld);
    let c0 = cand(h.frames[prev.fi], prev.r);
    solveTwoBone(arm.upper, arm.mid, arm.end, c0.target, { weight: h.weight, pole: poleW });
    arm.mid.updateWorldMatrix(true, false);
    const fq = arm.mid.getWorldQuaternion(new THREE.Quaternion()).invert();
    let best = null;
    for (let fi = 0; fi < h.frames.length; fi++) {
      for (let i = 0; i < 24; i++) {
        const r = (i / 24) * Math.PI * 2;
        const cc = cand(h.frames[fi], r);
        const m = wr.measureRel(fq.clone().multiply(cc.hq));
        const rem = Math.max(0, m.twist - Math.min(1.6, m.twist * 0.8));
        let dr = Math.abs(r - prev.r); dr = Math.min(dr, Math.PI * 2 - dr);
        if (dr > 1.3 && fi === prev.fi) continue;                       // the second hand follows the handle: no sudden roll flips
        const cost = m.swing + 1.2 * rem + 0.12 * m.twist + 0.3 * (dr / Math.PI) + (fi === prev.fi ? 0 : 0.9);
        if (!best || cost < best.cost) best = { cost, fi, r, cc };
      }
    }
    this._holdPrev = { fi: best.fi, r: best.r };
    solveTwoBone(arm.upper, arm.mid, arm.end, best.cc.target, { weight: h.weight, pole: poleW });
    this._setHandWorld(h.side, animQ.clone().slerp(best.cc.hq, h.weight));
  }

  dispose() {
    this.root.removeFromParent();
    for (const m of this.mats) m.dispose();
  }
}

const _t = new THREE.Vector3();
const _upY = new THREE.Vector3(0, 1, 0);
function setWorldQuat(bone, q) {
  bone.parent.updateWorldMatrix(true, false);
  const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  bone.quaternion.copy(pq.multiply(q));
  bone.updateWorldMatrix(false, true);
}

function evalScalar(keys, t) {
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 1; i < keys.length; i++) if (t <= keys[i].t) { const a = keys[i - 1], b = keys[i]; const x = (t - a.t) / Math.max(1e-6, b.t - a.t); return a.v + (b.v - a.v) * x * x * (3 - 2 * x); }
  return keys[keys.length - 1].v;
}

function keyPos(k, human) {
  if (k.target) {
    const w = human._targets[k.target];
    const o = k.off || [0, 0, 0];
    if (!w) return k.pos || o;      // named target not set: use the key's own fallback position
    const c = w.clone().applyMatrix4(human.root.matrixWorld.clone().invert());
    return [c.x + o[0], c.y + o[1], c.z + o[2]];
  }
  return k.pos;
}

function evalKeys(keys, t, dur, human) {
  if (human) keys = keys.map((k) => (k.target ? { ...k, pos: keyPos(k, human) } : k));
  if (t <= keys[0].t) return keys[0].pos;
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1], b = keys[i];
      let x = (t - a.t) / Math.max(1e-6, b.t - a.t);
      const e = b.ease ? b.ease(x) : x * x * (3 - 2 * x);
      return [a.pos[0] + (b.pos[0] - a.pos[0]) * e, a.pos[1] + (b.pos[1] - a.pos[1]) * e, a.pos[2] + (b.pos[2] - a.pos[2]) * e];
    }
  }
  return keys[keys.length - 1].pos;
}

// ---- foot contact precompute: per clip, per frame, is each ankle on the ground? (cached per clip + body)
function contactInfo(h, clip) {
  const key = `_contacts_${h.info.id}`;
  if (clip[key]) return clip[key];
  const v = new THREE.Vector3();
  const savedQ = h._bones22.map((b) => b.quaternion.clone());
  const savedP = h.pelvis.position.clone();
  const ys = [new Float32Array(clip.frames), new Float32Array(clip.frames)];
  const p = makePose();
  const my = h.model.position.y; h.model.position.y = 0;
  const savedRoot = h.root.position.clone(), savedRot = h.root.rotation.y;
  h.root.position.set(0, 0, 0); h.root.rotation.y = 0;
  for (let f = 0; f < clip.frames; f++) {
    const o = f * NB * 4;
    p.q.set(clip.quats.subarray(o, o + NB * 4)); p.p.set(clip.pelvis.subarray(f * 3, f * 3 + 3));
    h._writePose(p, true);
    h.legs.forEach((leg, i) => { leg.foot.getWorldPosition(v); ys[i][f] = v.y; });
  }
  let lo = Infinity;
  for (const a of ys) for (const y of a) lo = Math.min(lo, y);
  const thr = lo + 0.045;
  const flags = ys.map((a) => Uint8Array.from(a, (y) => (y <= thr ? 1 : 0)));
  // drop one-frame blips and pure-airborne clips
  const maxReach = h.legs[0].thigh.position.length() * 0 + legLength(h);
  const info = { flags, lo, maxReach };
  clip[key] = info;
  // restore
  h._bones22.forEach((b, i) => b.quaternion.copy(savedQ[i]));
  h.pelvis.position.copy(savedP);
  h.model.position.y = my; h.root.position.copy(savedRoot); h.root.rotation.y = savedRot;
  h.root.updateMatrixWorld(true);
  return info;
}

function legLength(h) {
  const leg = h.legs[0];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  h.root.updateMatrixWorld(true);
  leg.thigh.getWorldPosition(a); leg.calf.getWorldPosition(b); leg.foot.getWorldPosition(c);
  return a.distanceTo(b) + b.distanceTo(c);
}

// ---- grip frames, in hand space (metres): where the prop origin sits and how it is rotated
const _up = new THREE.Vector3(0, 1, 0);
function gripFrame(fr, kind, slide, sign = 1) {
  if (!fr || !fr.ok) return { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), pose: 'relaxed' };
  const palmC = fr.knuckle.clone().multiplyScalar(0.55).addScaledVector(fr.palmDir, 0.012);
  if (kind === 'ball') {
    return { pos: fr.knuckle.clone().multiplyScalar(0.45).addScaledVector(fr.palmDir, 0.038 + 0.0), quat: new THREE.Quaternion(), pose: 'ballGrip' };
  }
  // long handle held in a hammer grip: the handle runs across the palm (index -> little finger), blade past the thumb side
  const axis = fr.across.clone().normalize().multiplyScalar(-sign);
  const q = new THREE.Quaternion().setFromUnitVectors(_up, axis);
  const g = slide !== undefined ? slide : 0.19;
  const pos = palmC.clone().addScaledVector(axis, -g);
  return { pos, quat: q, pose: 'batGrip' };
}

// ------------------------------------------------------------ loading
/**
 * Load a character. spec: { character: 'athlete_m', base?: url, clips?: 'base' | clip map, kit?: {top,bottoms,socks},
 * skin?: tone name | '#hex', hair?: name | '#hex', castShadow?: true }
 */
export async function loadHuman(spec = {}) {
  const base = spec.base || defaultAssetBase();
  const id = spec.character || 'athlete_m';
  const info = await cached(`char:${base}${id}`, () => fetchJson(`${base}characters/${id}.json`));
  const [gltf, clipSet, bodyMask, headMask, bodySkin] = await Promise.all([
    cached(`glb:${base}${id}`, async () => gltfLoader().parseAsync(await fetchBuf(`${base}characters/${info.glb}`), `${base}characters/`)),
    typeof spec.clips === 'object' && spec.clips ? spec.clips : loadClips(spec.clips || 'base', base),
    cached(`tex:${base}${info.bodyMask}`, () => textureLoader().loadAsync(`${base}characters/${info.bodyMask}`)),
    cached(`tex:${base}${info.headMask}`, () => textureLoader().loadAsync(`${base}characters/${info.headMask}`)),
    cached(`tex:${base}${info.bodySkinMask}`, () => textureLoader().loadAsync(`${base}characters/${info.bodySkinMask}`)),
  ]);
  for (const t of [bodyMask, headMask, bodySkin]) { t.colorSpace = THREE.NoColorSpace; t.flipY = false; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; }
  if (spec.smoothTorso !== false) smoothTorsoWeights(gltf.scene);
  const wantLod = spec.lod !== undefined || spec.quality !== undefined || spec.lodReady;
  let lodSet = null;
  if (wantLod) {
    lodSet = await cached(`lod:${base}${id}`, async () => {
      const src = []; const albedo = {};
      gltf.scene.traverse((o) => { if (o.isSkinnedMesh) { const mt = Array.isArray(o.material) ? o.material[0] : o.material; const kind = /head/i.test(mt.name) ? 'head' : 'body'; src.push({ mesh: o, kind }); albedo[kind] = mt.map; } });
      return buildLodSet(src, { albedo, bodyMask, bodySkin, headMask });
    });
  }
  const model = clone(gltf.scene);
  const bones = {};
  model.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const mats = [];
  const clothRef = info.clothRef || 0.8; // albedo compensation 1/clothRef = 1.25 (matches the baked cloth grey)
  model.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.frustumCulled = false;
    o.castShadow = spec.castShadow !== false;
    o.receiveShadow = true;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const out = list.map((src) => {
      const kind = /head/i.test(src.name) ? 'head' : 'body';
      const m = new THREE.MeshStandardMaterial({ map: src.map, roughness: 0.78, metalness: 0, envMapIntensity: 0.8, name: kind, side: kind === 'body' ? THREE.DoubleSide : THREE.FrontSide });   // double-sided cloth: the inside of the shorts/shirt hems shows when a leg or arm is raised
      if (m.map) m.map.anisotropy = 4;
      const u = {
        tMask: { value: kind === 'head' ? headMask : bodyMask }, tSkin: { value: bodySkin },
        uTop: { value: new THREE.Color(1, 1, 1) }, uBottoms: { value: new THREE.Color(1, 1, 1) }, uSocks: { value: new THREE.Color(1, 1, 1) },
        uSkin: { value: new THREE.Color(1, 1, 1) }, uSkinK: { value: 0 }, uSkinLum: { value: (typeof info.skinLum === 'number' ? info.skinLum : info.skinLum && info.skinLum[kind]) || 0.3 },
        uHair: { value: new THREE.Color(1, 1, 1) }, uHairK: { value: 0 }, uHairLum: { value: info.hairLum || 0.12 },
      };
      shaderTint(m, kind, u);
      m.userData.kind = kind;
      mats.push(m);
      return m;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
  });
  // LOD meshes: bound to the SAME skeleton as the full meshes; medium shares their tinted materials, light has its own one-material mesh
  const lodSets = { full: [], medium: [], light: [], ready: false };
  if (lodSet) {
    const fulls = []; model.traverse((o) => { if (o.isSkinnedMesh) fulls.push(o); });
    fulls.forEach((o, i) => {
      lodSets.full.push(o);
      const med = new THREE.SkinnedMesh(lodSet.medium[i].geo, o.material);
      med.bind(o.skeleton, o.bindMatrix); med.frustumCulled = false; med.castShadow = o.castShadow; med.receiveShadow = true; med.visible = false;
      o.parent.add(med); lodSets.medium.push(med);
    });
    const lu = {
      uTop: { value: new THREE.Color(1, 1, 1) }, uBottoms: { value: new THREE.Color(1, 1, 1) }, uSocks: { value: new THREE.Color(1, 1, 1) },
      uSkin: { value: new THREE.Color(1, 1, 1) }, uSkinK: { value: 0 }, uSkinLum: { value: typeof info.skinLum === 'number' ? info.skinLum : 0.3 },
      uHair: { value: new THREE.Color(1, 1, 1) }, uHairK: { value: 0 }, uHairLum: { value: info.hairLum || 0.12 },
    };
    const lm = makeLightMaterial(lu); mats.push(lm);
    const light = new THREE.SkinnedMesh(lodSet.light, lm);
    light.bind(fulls[0].skeleton, fulls[0].bindMatrix); light.frustumCulled = false; light.castShadow = fulls[0].castShadow; light.receiveShadow = true; light.visible = false;
    fulls[0].parent.add(light); lodSets.light.push(light);
    lodSets.ready = true; lodSets.stats = lodSet.stats;
  }
  const root = new THREE.Group();
  root.name = `human:${id}`;
  root.add(model);
  const h = new Human({ root, model, bones, info: { ...info, clothRef }, clips: Object.defineProperty({ ...clipSet }, '__meta', { value: clipSet.__meta, enumerable: false }), mats, lodSets, lod: 0 });
  const kit = spec.kit || info.kit || {};
  h.setKit(kit);
  if (spec.skin) h.setSkin(spec.skin);
  if (spec.hair) h.setHair(spec.hair);
  if (spec.quality) h.setQuality(spec.quality);
  if (spec.lod !== undefined && spec.lod !== 'auto') h.setLOD(spec.lod);
  if (spec.lod === 'auto') h.lodAuto = true;
  if (h.clips.idle) h.play('idle', { fade: 0 });
  h.update(0);
  return h;
}

// The Rocketbox torso is skinned with sharp weight steps between Pelvis, Spine, Spine1 and Spine2; twisting or bending the trunk then stretches (tears) the
// vest/shirt triangles at those steps (worst on the female). Smooth the weights of the pure-torso vertices over their neighbours once per loaded model.
function smoothTorsoWeights(scene) {
  scene.traverse((o) => {
    if (!o.isSkinnedMesh || o.geometry.userData.torsoSmoothed) return;
    const geo = o.geometry, sk = o.skeleton;
    const spine = new Set(['Bip01_Pelvis', 'Bip01_Spine', 'Bip01_Spine1', 'Bip01_Spine2'].map((n) => sk.bones.findIndex((b) => b.name === n)).filter((i) => i >= 0));
    if (!geo.index || spine.size < 4) return;
    const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, n = geo.attributes.position.count;
    const dense = new Array(n); const torso = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const m = new Map(); let inSpine = 0;
      for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w <= 0) continue; const b = si.getComponent(i, k); m.set(b, (m.get(b) || 0) + w); if (spine.has(b)) inSpine += w; }
      dense[i] = m; torso[i] = inSpine > 0.97 ? 1 : 0;
    }
    const nb = Array.from({ length: n }, () => new Set());
    const ix = geo.index.array;
    for (let t = 0; t < ix.length; t += 3) for (let e = 0; e < 3; e++) { const a = ix[t + e], b = ix[t + (e + 1) % 3]; nb[a].add(b); nb[b].add(a); }
    // welded duplicates (same position) must keep identical weights: group by position
    const key = (i) => { const p = geo.attributes.position; return `${Math.round(p.getX(i) * 4000)},${Math.round(p.getY(i) * 4000)},${Math.round(p.getZ(i) * 4000)}`; };
    const groups = new Map(); for (let i = 0; i < n; i++) { if (!torso[i]) continue; const k = key(i); (groups.get(k) || groups.set(k, []).get(k)).push(i); }
    let cur = dense;
    for (let pass = 0; pass < 10; pass++) {
      const next = cur.slice();
      for (let i = 0; i < n; i++) {
        if (!torso[i]) continue;
        const acc = new Map(); let cnt = 0;
        for (const j of nb[i]) { if (!torso[j]) continue; for (const [b, w] of cur[j]) acc.set(b, (acc.get(b) || 0) + w); cnt++; }
        if (!cnt) continue;
        const m = new Map();
        for (const [b, w] of cur[i]) m.set(b, (m.get(b) || 0) + w * 0.45);
        for (const [b, w] of acc) m.set(b, (m.get(b) || 0) + (w / cnt) * 0.55);
        next[i] = m;
      }
      for (const g of groups.values()) { if (g.length < 2) continue; const m = new Map(); for (const i of g) for (const [b, w] of next[i]) m.set(b, (m.get(b) || 0) + w / g.length); for (const i of g) next[i] = m; }
      cur = next;
    }
    for (let i = 0; i < n; i++) {
      if (!torso[i]) continue;
      const top = [...cur[i].entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const tot = top.reduce((a, [, w]) => a + w, 0) || 1;
      for (let k = 0; k < 4; k++) { const e = top[k]; si.setComponent(i, k, e ? e[0] : 0); sw.setComponent(i, k, e ? e[1] / tot : 0); }
    }
    si.needsUpdate = true; sw.needsUpdate = true;
    geo.userData.torsoSmoothed = true;
  });
}

function clone(scene) {
  const c = THREE.SkeletonUtils.clone(scene);
  return c;
}

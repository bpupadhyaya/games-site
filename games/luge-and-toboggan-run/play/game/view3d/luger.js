// The luge rider and the sled in real 3D (presentation only: it reads the run state and a camera-space placement from the 2D picture and never
// writes back).
//
// The shared view3d layer supplies the person (athlete_m), the stage and the IK; this file dresses him in a speed suit and helmet, builds the
// sled (steel runners with curled tips, moulded pod, cross bridges, start handles, foot bows) and poses him: seated and gripping the handles
// for the start pulls, then lying back, feet first, shoulders and calves steering. The result is rendered into an off-screen WebGL canvas with
// the SAME perspective as the 2D chute and composited by drawWorld() at the sled's place.
import { createStage, loadHuman, Clip, CLIP_BONES, semanticRot, THREE } from '../vendor3d/index.js';

const { Vector3, Quaternion, Euler } = THREE;
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const bi = (n) => CLIP_BONES.indexOf(`Bip01_${n}`);

// Sled frame (metres): +Z forward, +Y up, +X the rider's left; the origin is on the ice under the middle of the pod.
const POD_Y = 0.2;                          // top of the pod's seat
const HANDLE = { l: 0.30, y: 0.34, z: 0.24 };      // start handles (each side), where the hands are while seated
const STRAP = { l: 0.235, y: 0.30, z: -0.12 };     // grab straps at the hips while lying
const LIE_P = [0, 0.325, -0.16];           // pelvis joint when lying (sled frame)
const SIT_P = [0, 0.345, -0.27];           // pelvis joint when seated at the back of the pod

// ---------------------------------------------------------------------------------------------------------------------------------
// Dress the shipped athlete in a speed suit: the limbs' skin is repainted into the suit colour (a canvas copy: the shared vendored textures
// stay untouched) and the shorts / sock masks are extended so the whole body carries the suit colours. Trainers become dark boots.
function suitUp(human) {
  const N = 1024;
  const cv = () => { const c = globalThis.document.createElement('canvas'); c.width = c.height = N; return c; };
  const read = (img) => { const c = cv(); const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, N, N); return { c, g, d: g.getImageData(0, 0, N, N) }; };
  for (const m of human.mats) {
    if (m.userData.kind !== 'body' || !m.map || !m.userData.tint) continue;
    const u = m.userData.tint;
    const A = read(m.map.image), M = read(u.tMask.value.image), K = read(u.tSkin.value.image);
    const a = A.d.data, mk = M.d.data, sk = K.d.data;
    // the fabric tone of the shipped shirt (mean of the torso panel), so sleeves and legs match it exactly
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 60; y < 280; y += 3) for (let x = 360; x < 660; x += 3) { const i = (y * N + x) * 4; if (mk[i] > 200) { r += a[i]; g += a[i + 1]; b += a[i + 2]; n++; } }
    r /= Math.max(1, n); g /= Math.max(1, n); b /= Math.max(1, n);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      if (sk[i] > 90 || mk[i + 1] > 90) {
        // skin of arms and legs and the shorts -> the suit (top colour channel) in the torso's own fabric tone
        const sh = 0.94 + 0.06 * Math.sin(x * 0.07 + y * 0.05);
        a[i] = r * sh; a[i + 1] = g * sh; a[i + 2] = b * sh; a[i + 3] = 255;
        mk[i] = 255; mk[i + 1] = 0; mk[i + 2] = 0; sk[i] = 0;
      }
    }
    // trainers -> slim dark racing boots (the shoe panels of the texture, keeping their shading)
    for (const [x0, x1] of [[225, 400], [630, 805]]) for (let y = 868; y < N; y++) for (let x = x0; x < x1; x++) {
      const i = (y * N + x) * 4;
      const L = (0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2]) / 255;
      const v = 18 + 70 * L * L;
      a[i] = v; a[i + 1] = v * 1.03; a[i + 2] = v * 1.12; mk[i] = 0; mk[i + 1] = 0; mk[i + 2] = 0; sk[i] = 0;
    }
    A.g.putImageData(A.d, 0, 0); M.g.putImageData(M.d, 0, 0); K.g.putImageData(K.d, 0, 0);
    const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; return t; };
    m.map = tex(A.c, true); u.tMask.value = tex(M.c, false); u.tSkin.value = tex(K.c, false);
    m.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0, ...o });

function makeSled(tone) {
  const g = new THREE.Group();
  const body = mat(tone.pod, { roughness: 0.28, metalness: 0.15 });
  const bodyDark = mat(tone.podDark, { roughness: 0.35, metalness: 0.1 });
  const steel = mat('#c9d2dc', { roughness: 0.28, metalness: 0.55 });
  const steelDark = mat('#5d6773', { roughness: 0.35, metalness: 0.5 });
  const grip = mat('#16191f', { roughness: 0.8 });
  const add = (geo, m, p, r, s) => { const o = new THREE.Mesh(geo, m); if (p) o.position.set(...p); if (r) o.rotation.set(...r); if (s) o.scale.set(...s); g.add(o); return o; };

  // the pod: a long moulded shell (capsule along Z) with a darker seat well, a centre stripe and a nose cone
  const capZ = (len, w, h, m, p) => { const geo = new THREE.CapsuleGeometry(0.5, len, 10, 28); geo.rotateX(Math.PI / 2); const o = add(geo, m, p, null, [w, h, 1]); return o; };
  capZ(0.85, 0.44, 0.15, body, [0, POD_Y - 0.08, 0.1]);                        // shell: 1.35 m long
  add(new THREE.BoxGeometry(0.045, 0.01, 1.0), mat(tone.stripe, { roughness: 0.3 }), [0, POD_Y - 0.002, 0.32], null, null);

  // runners: two steel blades, curled up at the tip (the foot bows), joined by cross bridges
  for (const sx of [-1, 1]) {
    const pts = [[-0.62, 0.025], [-0.3, 0.02], [0.2, 0.02], [0.62, 0.035], [0.86, 0.1], [0.98, 0.22], [1.0, 0.34]].map(([z, y]) => new Vector3(sx * 0.215, y, z));
    const curve = new THREE.CatmullRomCurve3(pts);
    add(new THREE.TubeGeometry(curve, 40, 0.022, 8, false), steel, null);
    // the blade's flat bottom edge (dark steel strip)
    const bp = pts.map((p) => new Vector3(p.x, Math.max(0.0, p.y - 0.02), p.z));
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bp), 40, 0.012, 6, false), steelDark, null);
    // bridges rising from the runner to the pod
    for (const z of [-0.45, 0.45]) {
      add(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 8), steelDark, [sx * 0.205, 0.115, z], [0, 0, sx * -0.12]);
    }
    // foot bow: the rider's heels hook behind the curled tip, the calves press the bows to steer
    const bow = new THREE.CatmullRomCurve3([new Vector3(sx * 0.215, 0.34, 1.0), new Vector3(sx * 0.17, 0.3, 0.96), new Vector3(sx * 0.1, 0.22, 0.86)]);
    add(new THREE.TubeGeometry(bow, 12, 0.015, 6, false), steel, null);
    // start handle (a short grip on a post at each side of the cockpit)
    add(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 8), steelDark, [sx * 0.265, POD_Y + 0.05, HANDLE.z], [0, 0, 0]);
    add(new THREE.CylinderGeometry(0.022, 0.022, 0.13, 10), grip, [sx * 0.285, HANDLE.y - 0.0, HANDLE.z], [Math.PI / 2, 0, 0]);
    // hip strap
    add(new THREE.BoxGeometry(0.02, 0.014, 0.2), grip, [sx * STRAP.l, POD_Y + 0.04, STRAP.z], null, null);
  }
  // front and rear cross rails
  add(new THREE.CylinderGeometry(0.016, 0.016, 0.45, 8), steel, [0, 0.03, 0.78], [0, 0, Math.PI / 2]);
  add(new THREE.CylinderGeometry(0.016, 0.016, 0.45, 8), steel, [0, 0.03, -0.6], [0, 0, Math.PI / 2]);
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8), steelDark, [0, 0.31, 0.99], [0, 0, Math.PI / 2]);
  return g;
}

// helmet: an aerodynamic shell, a darker visor, a stripe; authored in character space (x left, y up, z forward) at the rest pose
function makeHelmet(human, tone) {
  human._applyRest(); human.root.updateMatrixWorld(true);
  const hb = human.bones.Bip01_Head;
  const world = hb.getWorldPosition(new Vector3());
  const inv = hb.getWorldQuaternion(new Quaternion()).invert();
  const shell = mat(tone.helmet, { roughness: 0.18, metalness: 0.2 });
  const visor = mat('#0e1620', { roughness: 0.08, metalness: 0.6 });
  const stripeM = mat(tone.helmetStripe, { roughness: 0.3 });
  const g = new THREE.Group();
  const s = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), shell); s.scale.set(0.132, 0.152, 0.176); s.position.set(0, 0.1, -0.025); g.add(s);
  const chin = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), shell); chin.scale.set(0.1, 0.07, 0.09); chin.position.set(0, 0.0, 0.05); g.add(chin);
  const vs = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), visor); vs.scale.set(0.118, 0.075, 0.12); vs.position.set(0, 0.1, 0.04); vs.rotation.x = -0.2; g.add(vs);
  // a short aero tail on the back of the shell and a dark vent line each side of the stripe
  const tail = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), shell); tail.scale.set(0.05, 0.05, 0.05); tail.position.set(0, 0.04, -0.17); tail.visible = false; g.add(tail);
  for (const sx of [-1, 1]) { const vt = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), visor); vt.scale.set(0.004, 0.06, 0.08); vt.position.set(sx * 0.052, 0.14, -0.06); vt.rotation.x = -0.3; g.add(vt); }
  const st = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), stripeM); st.scale.set(0.022, 0.158, 0.18); st.position.set(0, 0.1, -0.025); st.rotation.x = Math.PI * 0.5 - Math.PI * 0.5; g.add(st);
  g.position.copy(world).add(new Vector3(0, 0.0, 0)); 
  g.quaternion.copy(inv);
  g.position.copy(new Vector3(0, 0, 0));
  // position in the bone's local frame from the world offset (character space)
  const off = new Vector3(0, 0.0, 0.0).applyQuaternion(inv);
  g.position.copy(off);
  hb.add(g);
  // suit collar around the neck (hides the bare skin between the helmet and the suit)
  const nb = human.bones.Bip01_Neck;
  const nw = nb.getWorldPosition(new Vector3());
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.074, 0.1, 18), mat(tone.suit, { roughness: 0.55 }));
  const ninv = nb.getWorldQuaternion(new Quaternion()).invert();
  col.quaternion.copy(ninv);
  col.position.copy(new Vector3(0, 0.03, 0.0).applyQuaternion(ninv));
  nb.add(col);
  return g;
}

// ---------------------------------------------------------------------------------------------------------------------------------
class Rider {
  constructor(human) {
    this.h = human;
    this.clip = new Clip({ name: 'pose', frames: 1, dur: 1 / 30, fps: 30, loop: true, quats: new Float32Array(CLIP_BONES.length * 4), pelvis: new Float32Array(3), grounded: false, fingers: 'relaxed' });
    human.addClip(this.clip);
    human.groundClamp = 'off'; human.footPlanting = false;
    this.restQ = new Float32Array(human.restPose.q);
    this.e = new Euler(); this.qa = new Quaternion(); this.qb = new Quaternion();
    this.ph = human.pelvisHeight;
    human.play(this.clip, { fade: 0 });
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

// the ghost of your best run: the same sled and a simple lying figure, one translucent blue
function makeGhost() {
  const g = new THREE.Group();
  const inner = new THREE.Group(); inner.rotation.y = Math.PI; g.add(inner);
  const sled = makeSled(TONES.ghost); inner.add(sled);
  const m = mat('#9fcaf2', { roughness: 0.5 });
  const add = (geo, p, r, sc) => { const o = new THREE.Mesh(geo, m); o.position.set(...p); if (r) o.rotation.set(...r); if (sc) o.scale.set(...sc); inner.add(o); };
  const cap = (len, rad) => new THREE.CapsuleGeometry(rad, len, 6, 14);
  add(cap(0.36, 0.15), [0, 0.31, -0.34], [Math.PI / 2, 0, 0], [1.25, 1, 0.8]);                  // torso
  add(new THREE.SphereGeometry(0.13, 16, 12), [0, 0.34, -0.74], null, [1, 0.95, 1.15]);          // helmet
  for (const sx of [-1, 1]) {
    add(cap(0.72, 0.07), [sx * 0.085, 0.31, 0.38], [Math.PI / 2, 0, 0]);                           // legs
    add(cap(0.4, 0.055), [sx * 0.22, 0.3, -0.25], [Math.PI / 2, 0, 0]);                            // arms
  }
  g.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.5; o.material.depthWrite = false; } });
  return g;
}

const TONES = {
  you: { pod: '#d8342a', podDark: '#7d1c16', stripe: '#f6f2ea', helmet: '#f2f4f7', helmetStripe: '#d8342a', suit: '#1c3f8c', suitTrim: '#f2b92e' },
  ghost: { pod: '#7db8ee', podDark: '#4a7fb8', stripe: '#ffffff', helmet: '#dff0ff', helmetStripe: '#7db8ee', suit: '#8fbdea', suitTrim: '#ffffff' },
};

export async function createLuger({ quality = 'medium', base, stage: shared = null } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  const stage = shared || createStage({ canvas, container: globalThis.document.body, quality, dprCap: 1, transparent: true, shadows: false, lighting: 'day' });
  if (!stage.supported) return null;
  if (!shared) stage.setSky(null, null);
  const human = await loadHuman({ character: 'athlete_m', base, kit: { top: TONES.you.suit, bottoms: TONES.you.suit, socks: '#15181e' }, skin: '#d9a47c', hair: 'black' });
  suitUp(human);
  const rider = new Rider(human);
  const helmet = makeHelmet(human, TONES.you);
  const sled = makeSled(TONES.you);
  const ghostRig = makeGhost(); ghostRig.visible = false; stage.scene.add(ghostRig);
  const rig = new THREE.Group();         // sled frame; the whole rig is placed in the scene by draw()
  const inner = new THREE.Group();       // flips the sled's +Z (forward) onto the scene's -Z (away from the camera)
  inner.rotation.y = Math.PI;
  rig.add(inner); inner.add(sled);
  stage.add(human); stage.scene.add(rig);
  inner.add(human.root);
  stage.track(human);
  const cam = stage.camera;
  if (!shared) cam.near = 0.3, cam.far = 120;
  const api = { stage, human, rider, rig, ghostRig, quality, helmet, ok: true, lost: false, size: { w: 0, h: 0 }, shared: !!shared };
  stage.onContextLost(() => { api.lost = true; });
  stage.onContextRestored(() => { api.lost = false; api.size.w = 0; });
  if (!shared) { stage.setLighting('day', { hemi: 0.75, keyI: 2.6, rimI: 1.3 }); stage.setSky(null, null); }
  return Object.assign(api, makeApi(api));
}

function makeApi(api) {
  const { stage, human, rider, rig, ghostRig } = api;
  const renderer = stage.renderer, cam = stage.camera;
  const up = new Vector3(0, 1, 0);
  const v = new Vector3(), tmpQ = new Quaternion();
  let lastT = null;
  const cost = { ema: 0, n: 0, low: false };
  const uSpring = { x: NaN, v: 0 };

  // pose of the rider for state s = { lie, u, pull: {side, p}, hit, brake } -> sets the one-frame clip, root and arm reach targets
  function pose(s, t) {
    const lie = clamp(s.lie, 0, 1), sit = 1 - lie;
    const u = clamp(s.u || 0, -1, 1);
    const pull = s.pull ? s.pull.p : 0, pside = s.pull ? s.pull.side : 0;
    const breath = Math.sin(t * 2.4);
    const off = {};
    // spine: seated he leans forward over the handles and heaves back on each pull; lying he is long and flat, shoulders shifting with the lean
    const fwd = sit * (14 + 16 * pull) + lie * 2;
    off.Pelvis = { flex: fwd * 0.2 };
    off.Spine = { flex: fwd * 0.25, side: -u * 5 * lie, twist: pside * pull * 6 * sit };
    off.Spine1 = { flex: fwd * 0.3, side: -u * 4 * lie, twist: pside * pull * 8 * sit };
    off.Spine2 = { flex: fwd * 0.25, side: -u * 3 * lie };
    off.Neck = { flex: lie * 20 + sit * -4, side: -u * 4 * lie };
    off.Head = { flex: lie * 10 + sit * -8, side: u * 3 * lie };
    // legs: seated they run forward on the pod; lying straight, toes together, calves leaning on the bows (steering pressure by the lean)
    const th = 90 * sit;
    off.L_Thigh = { flex: th + 1, abduct: 3 };
    off.R_Thigh = { flex: th + 1, abduct: 3 };
    off.L_Calf = { flex: 2 };
    off.R_Calf = { flex: 2 };
    // arms: seated they reach the handles (IK finishes it); lying they rest along the body on the straps
    off.L_UpperArm = { flex: 8, abduct: 8 }; off.R_UpperArm = { flex: 8, abduct: 8 };
    off.L_Forearm = { flex: 22 }; off.R_Forearm = { flex: 22 };
    // pelvis in the sled frame, root rotated about it: 0 = upright (seated), -90 degrees = lying on the back
    const P = [lerp(SIT_P[0], LIE_P[0], lie), lerp(SIT_P[1], LIE_P[1], lie) + breath * 0.002 * lie, lerp(SIT_P[2], LIE_P[2], lie) + 0.03 * pull * sit];
    const rot = -90 * lie * D2R;
    human.root.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), rot);
    const ph = rider.ph;
    // the clip's own pelvis offset stays 0; the root carries the pelvis to P
    v.set(0, ph, 0).applyQuaternion(human.root.quaternion);
    human.root.position.set(P[0] - v.x, P[1] - v.y, P[2] - v.z);
    rider.writePose(off, [0, 0, 0]);
    return { P, lie, sit };
  }

  function placeHands(s, ps) {
    const lie = ps.lie, sit = ps.sit;
    const pull = s.pull ? s.pull.p : 0, pside = s.pull ? s.pull.side : 0;
    rig.updateMatrixWorld(true);
    for (const side of ['L', 'R']) {
      const sg = side === 'L' ? 1 : -1;
      const hnd = [sg * HANDLE.l, HANDLE.y + 0.01, HANDLE.z];
      const str = [sg * STRAP.l, STRAP.y, STRAP.z + 0.02];
      // the hand on the pulling side drives back a little on the stroke
      const dz = pside === sg ? -0.06 * pull : 0;
      const p = [lerp(hnd[0], str[0], lie), lerp(hnd[1], str[1], lie), lerp(hnd[2] + dz, str[2], lie)];
      v.set(p[0], p[1], p[2]);
      // sled frame -> world (inner flips z)
      inner_toWorld(v);
      human.setReach(side, v.clone(), { weight: 1 });
      human.setFingers(side, 'fist');
    }
  }
  const innerObj = () => rig.children[0];
  const inner_toWorld = (p) => innerObj().localToWorld(p);

  // rider state from the run: seated on the handles until the last pull, then lying back; sits up after the line
  const stroke = { t0: -9, side: 1, n: 0 };
  let seenEv = 0;
  const STROKE = 0.4;
  function riderState(r, t) {
    const evs = r.ev || [];
    let top = 0;
    for (const e of evs) top = Math.max(top, e.id);
    if (top < seenEv) seenEv = 0;
    for (const e of evs) if (e.id > seenEv && e.type === 'pull') { stroke.t0 = t; stroke.side = (stroke.n++ % 2) ? -1 : 1; }
    seenEv = Math.max(seenEv, top);
    let lie;
    if (r.lie !== undefined) lie = r.lie;
    else if (r.ph === 'ready') lie = 0;
    else if (r.ph === 'push') lie = sstep((r.pt - 2.45) / 0.6);
    else if (r.ph === 'run') lie = 1;
    else if (r.ph === 'finish') lie = 1 - sstep((r.pt - 0.5) / 0.9);
    else lie = 0;
    const x = (t - stroke.t0) / STROKE;
    const p = x >= 0 && x <= 1 ? Math.sin(Math.PI * x) : 0;
    return { lie, u: r.u || 0, pull: p > 0 ? { side: stroke.side, p } : null, v: r.v || 0 };
  }

  function frameCamera(devW, devH, o) {
    renderer.setPixelRatio(1); renderer.setSize(devW, devH, false);
    cam.aspect = devW / devH;
    const [x0, y0, w, h] = o.rect;
    // the 2D picture's pinhole: focal F (units per metre at depth 1), principal point (cx, hy), zero pitch. Window = rect.
    cam.position.set(0, 0, 0); cam.rotation.set(0, 0, 0); cam.updateMatrixWorld(true);
    const near = cam.near, far = cam.far;
    const e = cam.projectionMatrix.elements;
    e[0] = 2 * o.F / w; e[5] = 2 * o.F / h;
    e[8] = -(2 * (o.cx - x0) / w - 1); e[9] = (1 - 2 * (o.hy - y0) / h) * -1 * -1;
    e[10] = -(far + near) / (far - near); e[14] = -2 * far * near / (far - near); e[11] = -1; e[15] = 0;
    // y: ndc_y = 1 - 2 (screen_y - y0) / h with screen_y = hy - F Y / Z   ->   ndc_y = e5 * Y/Z - e9 * (z_v/Z)... see derivation in the notes
    e[9] = -(1 - 2 * (o.hy - y0) / h);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }

  api.draw = function (ctx, o) {
    if (api.lost || stage.contextLost) return false;
    const t0 = globalThis.performance.now();
    const m = ctx.getTransform();
    const pxPerUnit = Math.hypot(m.a, m.b);
    const [x0, y0, w, h] = o.rect;
    const devW = clamp(Math.round(w * pxPerUnit), 96, 640), devH = clamp(Math.round(h * pxPerUnit), 96, 640);
    if (api.size.w !== devW || api.size.h !== devH || true) { frameCamera(devW, devH, o); api.size.w = devW; api.size.h = devH; }
    rig.visible = !o.ghost; ghostRig.visible = !!o.ghost;
    placeRig(o);
    renderer.render(stage.scene, cam);
    ctx.drawImage(renderer.domElement, x0, y0, w, h);
    // frame-cost guard: if the 3D picture stays expensive, drop to the cheap tier once
    const ms = globalThis.performance.now() - t0;
    cost.ema = cost.n ? cost.ema * 0.95 + ms * 0.05 : ms; cost.n++;
    if (!cost.low && cost.n > 90 && cost.ema > 11 && api.quality !== 'low') { cost.low = true; api.quality = 'low'; stage.setQuality('low'); }
    return true;
  };

  // Place and pose the sled (or its ghost) in the scene without rendering: the shared world scene calls this and renders itself.
  // o: { X, Y, Z (scene z = -Z), heading, pitch, roll, scale, ghost, rider, t }
  function placeRig(o) {
    const t = o.t || 0;
    const dt = lastT === null ? 0 : clamp(t - lastT, 0, 0.1); lastT = t;
    const tgt = o.ghost ? ghostRig : rig;
    // place the rig: scene x = X, y = Y, z = -Z; heading about Y, nose pitch about X, roll about Z
    tgt.position.set(o.X, o.Y, -o.Z);
    tgt.rotation.order = 'YXZ';
    tgt.rotation.set(o.pitch || 0, -(o.heading || 0), -(o.roll || 0));
    tgt.scale.setScalar(o.scale || 1);
    tgt.visible = true;
    if (!o.ghost) {
      const rs = riderState(o.rider, t);
      // the lean is an input value that can step between sim ticks: a critically damped spring turns it into a smooth body motion
      const w = 13, tgt2 = clamp(rs.u, -1, 1), h = Math.min(dt, 0.05);
      if (!isFinite(uSpring.x)) { uSpring.x = tgt2; uSpring.v = 0; }
      for (let k = 0; k < 3; k++) { const hh = h / 3; uSpring.v += (w * w * (tgt2 - uSpring.x) - 2 * w * uSpring.v) * hh; uSpring.x += uSpring.v * hh; }
      rs.u = uSpring.x;
      const ps = pose(rs, t);
      rig.updateMatrixWorld(true);
      human.update(dt);
      placeHands(rs, ps);
      human.update(0);
    }
  }
  api.placeRig = placeRig;
  api.hide = () => { rig.visible = false; ghostRig.visible = false; };
  return api;
}

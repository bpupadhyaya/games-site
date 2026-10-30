// The toy: a lit 3D bamboo copter (shaft with nodes, hub, thin translucent blades, motion-blur disc) and the two real hands that
// rub it. Presenter-only: it reads numbers handed in by the presenter and never touches the simulation.
// Units: the rotor span is 1.0. The hands (real metres, modelled in handmesh.js) live in a group scaled by 5 (a real copter is about 0.2 m).
import * as THREE from '../vendor3d/three.js';
import { ROTORS } from '../src/sim.js';
import { createHandPair } from './hands.js';
import { tex, bladeCanvas, bambooCanvas, canvas } from './mats.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const HAND_SCALE = 5;                 // metres -> toy units (0.2 m span)
export const SHAFT_LEN = 0.95;
export const COPTER_SCALE = 1.4;      // the toy is drawn this much larger than the hands' natural size so the rotor reads
const HANDS_Y = -0.84;                // toy units, where the palms meet the shaft (finger tips stay clear of the rotor)

// A blade is a thin, curved, twisted leaf lying along +x (root at x = r0, tip at x = R), pitched about its own axis.
function bladeGeometry(R, hw, pitch, camber, r0 = 0.07) {
  const N = 16, A = 7, pos = [], uv = [], col = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = r0 + (R - r0) * t, k = Math.pow(Math.sin(Math.PI * (i + 0.7) / (N + 1.6)), 0.78), w = hw * k;
    const th = pitch * (1 - 0.45 * t);
    for (let j = 0; j <= A; j++) {
      const v = (j / A) * 2 - 1, z = v * w, y = camber * (1 - v * v) * w + Math.sin(t * Math.PI) * 0.012 * R;
      const c = Math.cos(th), s = Math.sin(th);
      pos.push(u, y * c + z * s, z * c - y * s);
      uv.push(t, j / A);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < A; j++) { const a = i * (A + 1) + j, b = a + A + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function hexLerp(c0, c1, k) { return new THREE.Color(c0).lerp(new THREE.Color(c1), k); }

const KIND = ['bamboo', 'paper', 'jade', 'feather', 'paper', 'paper'];

function buildRotor(idx) {
  const ro = ROTORS[idx], [c0, c1, c2] = ro.col, n = ro.blades, R = 0.5;
  const g = new THREE.Group();
  const hw = Math.max(0.05, ro.wide) * R * (n === 1 ? 1.15 : 1.0) * 1.0;
  const kind = KIND[idx];
  const tx = tex(bladeCanvas(kind, 11 + idx), { wrap: false });
  const tint = hexLerp(c1, c0, 0.45);
  const phys = idx === 2;
  const mk = () => {
    const m = phys
      ? new THREE.MeshPhysicalMaterial({ color: tint, map: tx, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, side: THREE.DoubleSide, transparent: true, opacity: 0.93, envMapIntensity: 1.1 })
      : new THREE.MeshStandardMaterial({ color: tint, map: tx, roughness: kind === 'bamboo' ? 0.55 : 0.85, metalness: 0, side: THREE.DoubleSide, transparent: kind !== 'bamboo', opacity: kind === 'bamboo' ? 1 : 0.94, envMapIntensity: 0.6 });
    m.emissive = new THREE.Color(c1).multiplyScalar(0.35); m.emissiveIntensity = 0.25;
    return m;
  };
  const geo = bladeGeometry(R, hw, 0.34, 0.16 + ro.wide * 0.4);
  const blades = [], angles = [];
  for (let i = 0; i < n; i++) angles.push(n === 4 ? (i % 2) * Math.PI / 2 + Math.floor(i / 2) * Math.PI : (i * TAU) / n);
  const spin = new THREE.Group(); g.add(spin);
  for (const a of angles) {
    const m = new THREE.Mesh(geo, mk()); m.rotation.y = -a; m.userData.base = -a; spin.add(m); blades.push(m);
    // a darker rim line (edge binding) so thin blades read at small sizes
    const rim = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c2, wireframe: false, transparent: true, opacity: 0, side: THREE.DoubleSide }));
    rim.visible = false; m.add(rim);
  }
  // ghost blades (motion blur) and a streak disc
  const ghosts = [];
  const gm = new THREE.MeshBasicMaterial({ color: c0, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false });
  for (let k = 1; k <= 3; k++) for (const a of angles) { const m = new THREE.Mesh(geo, gm.clone()); m.userData = { base: -a, k }; spin.add(m); ghosts.push(m); }
  const discMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uC0: { value: new THREE.Color(c0) }, uC1: { value: new THREE.Color(c1) }, uA: { value: 0 }, uRot: { value: 0 }, uN: { value: n } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vP; uniform vec3 uC0; uniform vec3 uC1; uniform float uA; uniform float uRot; uniform float uN;
      void main(){ float r = length(vP) / 0.5; if (r > 1.0) discard; float a = atan(vP.y, vP.x) + uRot;
        float s = 0.55 + 0.45 * sin(a * uN * 2.0) * sin(a * uN * 2.0 + r * 3.0);
        float rim = smoothstep(0.82, 1.0, r) * 0.7;
        vec3 c = mix(uC1, uC0, r);
        gl_FragColor = vec4(c, uA * (0.28 + 0.5 * s * (1.0 - r * 0.4) + rim) * smoothstep(0.02, 0.2, r)); }`,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.5, 56).rotateX(-Math.PI / 2), discMat);
  disc.position.y = 0.012; g.add(disc);
  if (idx === 5) {   // maple: a counterweight bead opposite the single wing
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), new THREE.MeshStandardMaterial({ color: '#b3822f', roughness: 0.4, metalness: 0.5 }));
    bead.position.set(-0.2, 0, 0); spin.add(bead); g.userData.bead = bead;
  }
  g.userData = { ...g.userData, spin, blades, ghosts, disc, discMat, n, angles, ro };
  return g;
}

export async function createToy({ skin = 'tan' } = {}) {
  const root = new THREE.Group();            // toy space; hub at the origin
  const tiltG = new THREE.Group(); tiltG.scale.setScalar(COPTER_SCALE); root.add(tiltG);   // lean + wobble about the hub
  // shaft: bamboo culm with nodes
  const shaftTex = tex(bambooCanvas(128, ['#cfae5c', '#8d6a22'], 5, true), { repeat: [1, 3] });
  const shaftMat = new THREE.MeshStandardMaterial({ map: shaftTex, roughness: 0.5, metalness: 0.02, envMapIntensity: 0.7 });
  const shaftG = new THREE.Group(); tiltG.add(shaftG);
  const SR = 0.026;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(SR, SR * 1.04, SHAFT_LEN, 20, 1, false), shaftMat);
  shaft.position.y = -SHAFT_LEN / 2; shaftG.add(shaft);
  for (const t of [0.34, 0.7]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(SR * 1.02, SR * 0.34, 8, 20), shaftMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = -SHAFT_LEN * t; shaftG.add(ring);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(SR * 1.05, SR * 0.1, 6, 20), new THREE.MeshStandardMaterial({ color: '#4a3410', roughness: 0.8 }));
    lip.rotation.x = Math.PI / 2; lip.position.y = -SHAFT_LEN * t - SR * 0.28; shaftG.add(lip);
  }
  const endCap = new THREE.Mesh(new THREE.SphereGeometry(SR * 1.05, 12, 8, 0, TAU, Math.PI / 2, Math.PI / 2), shaftMat);
  endCap.position.y = -SHAFT_LEN; shaftG.add(endCap);
  // hub
  const hubMat = new THREE.MeshStandardMaterial({ color: '#c9962f', metalness: 0.75, roughness: 0.32, envMapIntensity: 1.1 });
  const hub = new THREE.Mesh(new THREE.LatheGeometry([[0, 0.05], [0.04, 0.047], [0.058, 0.02], [0.062, -0.005], [0.05, -0.03], [0.034, -0.045], [0, -0.05]].map(([x, y]) => new THREE.Vector2(x, y)), 24), hubMat);
  tiltG.add(hub);
  const rotors = ROTORS.map((_, i) => { const r = buildRotor(i); r.visible = false; tiltG.add(r); return r; });
  let cur = 0; rotors[0].visible = true;

  // hands: real metres inside handsRoot (scaled to toy units); the palms hold the stick where it is SR * COPTER_SCALE thick
  const handsRoot = new THREE.Group(); handsRoot.scale.setScalar(HAND_SCALE); root.add(handsRoot);
  const pair = await createHandPair({ skin, shaftR: (SR * COPTER_SCALE) / HAND_SCALE });
  handsRoot.add(pair.object);
  const hs = HANDS_Y / HAND_SCALE;    // palm height on the stick in metres (toy y / scale)

  const api = {
    root, tiltG, shaftG, handsRoot, pair, rotors,
    setRotor(i) { if (i === cur) return; rotors[cur].visible = false; cur = i; rotors[cur].visible = true; },
    /**
     * p: { rotor, rev, s (0..1.25), tilt (rad), wob (rad, precession amplitude), wobPh, rub (-1..1), press (0..1), hands (0..1 visible),
     *      release (0..1 fingers open + hands part), grip(0..1), t }
     */
    pose(p, dt) {
      api.setRotor(p.rotor);
      const R = rotors[cur], u = R.userData, fast = clamp((p.s - 0.12) / 0.5, 0, 1);
      u.spin.rotation.y = p.rev;   // blades spin about the hub axis
      u.blades.forEach((b) => { b.material.opacity = (cur === 2 ? 0.93 : cur === 0 ? 1 : 0.94) * (1 - 0.35 * fast); });
      u.ghosts.forEach((gm) => { gm.rotation.y = gm.userData.base + gm.userData.k * 0.34 * fast; gm.material.opacity = 0.13 * fast; gm.visible = fast > 0.02; });
      u.discMat.uniforms.uA.value = fast * (0.1 + 0.16 * clamp(p.s, 0, 1.2));
      u.discMat.uniforms.uRot.value = p.rev * 0.0;
      u.disc.visible = fast > 0.02;
      // lean + precession wobble of the whole toy about the hub
      const tx = p.tilt * 0.5 + p.wob * Math.cos(p.wobPh) + (p.roll || 0), tz = p.wob * Math.sin(p.wobPh);
      tiltG.rotation.set(tz, 0, tx, 'XYZ');
      // hands
      const on = p.hands > 0.002;
      handsRoot.visible = on;
      if (on) {
        const rel = clamp(p.release, 0, 1);
        // the hands hold the stick, so they lean and wobble with it (until they let go)
        handsRoot.rotation.set(tz * (1 - rel), 0, tx * (1 - rel), 'XYZ');
        pair.pose({ rub: p.rub, press: p.press, release: rel, y: hs }, dt || 1 / 60);
      } else pair.reset();
    },
    dispose() { pair.dispose(); },
  };
  api.HANDS_Y = HANDS_Y; api.SHAFT_LEN = SHAFT_LEN;
  void canvas;
  return api;
}

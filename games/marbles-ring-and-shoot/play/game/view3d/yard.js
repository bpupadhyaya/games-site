// The schoolyard scene for Marbles: Ring and Shoot (game-owned, presentation only).
// World: 1 unit = 100 sim units; sim (x, y) -> (X = x / 100, Z = y / 100), Y up. Everything is procedural (canvas textures,
// analytic geometry), built in small slices so the first frames stay smooth.
import * as THREE from '../vendor3d/three.js';
import { RR, RA, RT, R_T, R_S } from '../src/sim.js';

export const U = 0.01;                    // sim units -> world units
export const SUN = new THREE.Vector3(-0.52, 0.78, -0.36).normalize();   // late-afternoon sun from the upper left (screen)
const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
export const cvs = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
export const tex = (c, { srgb = true, repeat = null, aniso = 8 } = {}) => {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
};

// ------------------------------------------------------------------------------------------------ marble palettes (match the 2D art)
export const SIDE3 = [{ core: '#1766c8', deep: '#0a2c66', rib: '#f4fbff', tint: '#9fd2ff' }, { core: '#e2501c', deep: '#7a1c0a', rib: '#fff2d8', tint: '#ffc6a0' }];
export const CLAY3 = [['#e0925a', '#8a4422'], ['#d4b268', '#7a5a22'], ['#b86a48', '#5a2a18'], ['#9fa862', '#4a5826'], ['#d27c78', '#7a2c32']];
export const GLASS3 = [
  { core: '#37b4ea', a: '#f2fbff', b: '#1458b4' }, { core: '#46d08a', a: '#f2ffd8', b: '#14804e' }, { core: '#b268ea', a: '#ffe6ff', b: '#54269a' },
  { core: '#ffb040', a: '#fff3c8', b: '#c2501a' }, { core: '#ff6c98', a: '#ffe8f0', b: '#9c1c48' },
];

// ------------------------------------------------------------------------------------------------ environment (reflections)
// A sky dome with the sun, a tree line and the green yard: what a glass marble really mirrors outdoors.
export function envScene() {
  const s = new THREE.Scene();
  const c = cvs(512, 256, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h * 0.5); sky.addColorStop(0, '#5f8fd0'); sky.addColorStop(0.7, '#bcd6ee'); sky.addColorStop(1, '#f4e6c8');
    g.fillStyle = sky; g.fillRect(0, 0, w, h * 0.5);
    const gr = g.createLinearGradient(0, h * 0.5, 0, h); gr.addColorStop(0, '#5f7a3a'); gr.addColorStop(1, '#2c4420');
    g.fillStyle = gr; g.fillRect(0, h * 0.5, w, h * 0.5);
    const r = lcg(5); g.fillStyle = '#2f4a2a';
    for (let i = 0; i < 26; i++) { const x = r() * w, rw = 20 + r() * 40, rh = 18 + r() * 34; g.beginPath(); g.ellipse(x, h * 0.5 - rh * 0.4, rw, rh, 0, 0, TAU); g.fill(); }
    g.fillStyle = '#c9b9a0'; g.fillRect(w * 0.62, h * 0.38, w * 0.2, h * 0.12);           // the school building
    g.fillStyle = '#9a3a2a'; g.fillRect(w * 0.62, h * 0.36, w * 0.2, h * 0.025);
    const sun = g.createRadialGradient(w * 0.13, h * 0.2, 0, w * 0.13, h * 0.2, 40); sun.addColorStop(0, 'rgba(255,250,230,1)'); sun.addColorStop(0.25, 'rgba(255,236,190,0.9)'); sun.addColorStop(1, 'rgba(255,236,190,0)');
    g.fillStyle = sun; g.fillRect(0, 0, w, h);
  });
  const t = tex(c); t.mapping = THREE.EquirectangularReflectionMapping;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide }));
  s.add(dome);
  return s;
}

// ------------------------------------------------------------------------------------------------ ground textures
const EXT = (RA + 70) * U;                // half size of the dirt texture square
function dirtTextures(q) {
  const N = q === 'low' ? 1024 : 2048, r = lcg(11), k = N / (2 * EXT), C = N / 2;
  const P = (x, y) => [C + x * U * k, C + y * U * k];
  const map = cvs(N, N, (g) => {
    // packed schoolyard dirt: warm sand, darker trodden band near the shooting line, lighter swept centre
    g.fillStyle = '#b48a58'; g.fillRect(0, 0, N, N);
    const base = g.createRadialGradient(C, C, 0, C, C, RA * U * k);
    base.addColorStop(0, '#d9b98a'); base.addColorStop(0.55, '#cfac78'); base.addColorStop(0.8, '#bf9862'); base.addColorStop(0.97, '#a87f4e'); base.addColorStop(1, 'rgba(110,80,48,0)');
    g.fillStyle = base; g.fillRect(0, 0, N, N);
    for (let i = 0; i < 160; i++) {            // mottling
      const [x, y] = P((r() - 0.5) * 2 * RA, (r() - 0.5) * 2 * RA), rad = (10 + r() * 60) * U * k;
      const m = g.createRadialGradient(x, y, 0, x, y, rad); m.addColorStop(0, r() < 0.5 ? 'rgba(255,236,196,0.16)' : 'rgba(90,60,30,0.14)'); m.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = m; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < N * 30; i++) {         // grit
      const x = r() * N, y = r() * N, s = r() < 0.92 ? 1 + r() * 1.6 : 2 + r() * 3.5, v = r();
      g.fillStyle = v < 0.45 ? `rgba(255,240,210,${0.18 + r() * 0.3})` : v < 0.9 ? `rgba(70,46,22,${0.16 + r() * 0.3})` : `rgba(150,140,130,${0.5 + r() * 0.4})`;
      g.fillRect(x, y, s, s * (0.6 + r() * 0.6));
    }
    g.lineCap = 'round';
    for (let i = 0; i < 60; i++) {             // scuffs from knees and shoes
      const a = r() * TAU, rr = (RR + 20 + r() * (RA - RR - 30)), [x, y] = P(Math.cos(a) * rr, Math.sin(a) * rr), L = (10 + r() * 30) * U * k, d = a + Math.PI / 2 + (r() - 0.5);
      g.strokeStyle = `rgba(90,62,32,${0.12 + r() * 0.12})`; g.lineWidth = (2 + r() * 5) * U * k * 0.5;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(d) * L * 0.5 + (r() - 0.5) * L * 0.4, y + Math.sin(d) * L * 0.5, x + Math.cos(d) * L, y + Math.sin(d) * L); g.stroke();
    }
    // sneaker prints by the shooting line (where kids knuckle down)
    for (let i = 0; i < 9; i++) {
      const a = r() * TAU, rr = RT + 26 + r() * 30, [x, y] = P(Math.cos(a) * rr, Math.sin(a) * rr);
      g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2 + (r() - 0.5) * 0.6); g.fillStyle = 'rgba(96,66,36,0.16)';
      const sw = 9 * U * k, sl = 26 * U * k; g.beginPath(); g.ellipse(0, -sl * 0.18, sw, sl * 0.36, 0, 0, TAU); g.ellipse(0, sl * 0.3, sw * 0.8, sl * 0.2, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(70,46,24,0.14)'; g.lineWidth = 1.2; for (let t = -3; t <= 3; t++) { g.beginPath(); g.moveTo(-sw * 0.8, t * sl * 0.08 - sl * 0.18); g.lineTo(sw * 0.8, t * sl * 0.08 - sl * 0.18); g.stroke(); }
      g.restore();
    }
    // the ring, scratched with a stick: a dark groove with loose crumbs thrown up on both sides
    const ring = (rad, wid, col, jit) => { g.strokeStyle = col; g.lineWidth = wid * U * k; g.beginPath(); for (let i = 0; i <= 360; i++) { const a = (i / 360) * TAU, rr = rad + Math.sin(a * 7 + 1) * jit + Math.sin(a * 17) * jit * 0.4, [x, y] = P(Math.cos(a) * rr, Math.sin(a) * rr); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); };
    ring(RR, 13, 'rgba(255,240,205,0.35)', 1.2);
    ring(RR, 6.5, 'rgba(84,54,26,0.9)', 1.2);
    ring(RR - 0.5, 2.5, 'rgba(48,28,12,0.85)', 1.2);
    for (let i = 0; i < 900; i++) { const a = r() * TAU, rr = RR + (r() < 0.5 ? -1 : 1) * (5 + r() * 9), [x, y] = P(Math.cos(a) * rr, Math.sin(a) * rr); g.fillStyle = `rgba(${r() < 0.5 ? '120,84,46' : '236,214,170'},${0.4 + r() * 0.4})`; g.fillRect(x, y, 2 + r() * 3, 2 + r() * 3); }
    // the shooting line: a fainter dashed lag line dragged with a heel
    g.setLineDash([10 * U * k, 7 * U * k]); ring(RT, 4.5, 'rgba(96,64,32,0.5)', 0.8); g.setLineDash([]);
  });
  const bump = cvs(N / 2, N / 2, (g, n) => {
    const kk = n / (2 * EXT), c = n / 2; g.fillStyle = '#808080'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < n * 14; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'; g.fillRect(r() * n, r() * n, 1 + r() * 2, 1 + r() * 2); }
    g.lineWidth = 7 * U * kk; g.strokeStyle = 'rgba(0,0,0,0.9)'; g.beginPath(); g.arc(c, c, RR * U * kk, 0, TAU); g.stroke();
    g.lineWidth = 2 * U * kk; g.strokeStyle = 'rgba(255,255,255,0.6)'; for (const d of [-8, 8]) { g.beginPath(); g.arc(c, c, (RR + d) * U * kk, 0, TAU); g.stroke(); }
  });
  return { map: tex(map, { aniso: 8 }), bump: tex(bump, { srgb: false }) };
}
function grassTexture() {
  const r = lcg(31);
  const c = cvs(512, 512, (g, n) => {
    g.fillStyle = '#466c2e'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 80; i++) { const x = r() * n, y = r() * n, rad = 30 + r() * 80, m = g.createRadialGradient(x, y, 0, x, y, rad); m.addColorStop(0, r() < 0.5 ? 'rgba(120,160,70,0.35)' : 'rgba(30,58,26,0.35)'); m.addColorStop(1, 'rgba(0,0,0,0)'); for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) { g.fillStyle = m; g.save(); g.translate(dx, dy); g.fillRect(x - rad, y - rad, rad * 2, rad * 2); g.restore(); } }
    g.lineCap = 'round';
    for (let i = 0; i < 9000; i++) { const x = r() * n, y = r() * n, l = 4 + r() * 9, a = r() * TAU; g.strokeStyle = r() < 0.5 ? `rgba(170,210,110,${0.15 + r() * 0.25})` : `rgba(20,44,18,${0.2 + r() * 0.25})`; g.lineWidth = 1 + r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  });
  return tex(c, { repeat: [14, 14] });
}
function shadeTexture() {    // dappled shade of a schoolyard tree (alpha only), tiles
  const r = lcg(77);
  return tex(cvs(512, 512, (g, n) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, n, n);
    g.filter = 'blur(9px)';
    for (let i = 0; i < 70; i++) { const x = r() * n, y = r() * n, rw = 20 + r() * 60, rh = 14 + r() * 40; g.fillStyle = `rgba(255,255,255,${0.5 + r() * 0.5})`; for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) { g.beginPath(); g.ellipse(x + dx, y + dy, rw, rh, r() * TAU, 0, TAU); g.fill(); } }
    g.filter = 'none';
  }), { srgb: false, repeat: [1, 1] });
}
export const glowTexture = () => tex(cvs(128, 128, (g, w) => { const m = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); m.addColorStop(0, 'rgba(255,255,255,1)'); m.addColorStop(0.35, 'rgba(255,255,255,0.5)'); m.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = m; g.fillRect(0, 0, w, w); }));
export const blobTexture = () => tex(cvs(128, 128, (g, w) => { const m = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(0.4, 'rgba(0,0,0,0.6)'); m.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = m; g.fillRect(0, 0, w, w); }));

// ------------------------------------------------------------------------------------------------ the yard
// Returns { root, update(dt, time), shade, lineGlow }. `nap` yields between slices.
export async function buildYard(q, nap = async () => {}) {
  const root = new THREE.Group(); root.name = 'yard';
  // grass all around
  const grassMat = new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.95, color: 0xffffff });
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(60, 64), grassMat); lawn.rotation.x = -Math.PI / 2; lawn.position.y = -0.012; lawn.receiveShadow = true; root.add(lawn);
  await nap();
  // the dirt patch: a very low dome (the playground ring is swept slightly higher in the middle), with a ragged worn edge into the grass
  const T = dirtTextures(q);
  const dirtMat = new THREE.MeshStandardMaterial({ map: T.map, bumpMap: T.bump, bumpScale: 1.2, roughness: 0.96, metalness: 0, transparent: false });
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(EXT * 2, EXT * 2, 1, 1), dirtMat); dirt.rotation.x = -Math.PI / 2; dirt.receiveShadow = true;
  // trim the square to a ragged disc with an alpha edge
  const edge = cvs(512, 512, (g, n) => { const r = lcg(3); g.fillStyle = '#000'; g.fillRect(0, 0, n, n); g.translate(n / 2, n / 2); const R = (RA + 30) * U / (2 * EXT) * n; g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i <= 200; i++) { const a = (i / 200) * TAU, rr = R + Math.sin(a * 9) * 3 + Math.sin(a * 23 + 2) * 2 + (r() - 0.5) * 3; i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.filter = 'blur(2px)'; g.fill(); });
  dirtMat.alphaMap = tex(edge, { srgb: false }); dirtMat.alphaTest = 0.5;
  root.add(dirt);
  await nap();
  // stones bedded around the edge of the dirt (the boundary of the arena), instanced, lit
  const stoneGeo = new THREE.SphereGeometry(1, 10, 8);
  { const p = stoneGeo.attributes.position, r = lcg(9); for (let i = 0; i < p.count; i++) { const k = 0.82 + r() * 0.3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } stoneGeo.computeVertexNormals(); }
  const nStones = 150, stones = new THREE.InstancedMesh(stoneGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0 }), nStones);
  { const r = lcg(21), m = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    for (let i = 0; i < nStones; i++) {
      const a = (i / nStones) * TAU + (r() - 0.5) * 0.03, rr = (RA + 14 + (r() - 0.5) * 12) * U, s = (4 + r() * 6) * U;
      e.set(r() * 3, r() * 3, r() * 3); qq.setFromEuler(e);
      m.compose(new THREE.Vector3(Math.cos(a) * rr, s * 0.25, Math.sin(a) * rr), qq, new THREE.Vector3(s * (1 + r() * 0.5), s * 0.62, s));
      stones.setMatrixAt(i, m); const v = r(); col.setRGB(0.62 + v * 0.3, 0.58 + v * 0.28, 0.52 + v * 0.26); stones.setColorAt(i, col);
    } }
  stones.castShadow = true; stones.receiveShadow = true; root.add(stones);
  await nap();
  // grass blades: tufts all around the dirt (a real lawn has height; they lean in the off-axis view and sway in the breeze)
  const tuft = { time: { value: 0 } };
  let blades = null;
  if (q !== 'low') {
    const n = q === 'high' ? 9000 : 5000;
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.12, 0.55, 0, -0.12, 0.55, 0, 0, 1, 0], 3));
    bg.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0.4, 1, 0, 0.4, 1, 0, 0.4, 1, 0, 0.4, 1, 0, 0.4, 1], 3));
    bg.setIndex([0, 1, 2, 0, 2, 3, 3, 2, 4]);
    const bm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide });
    bm.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = tuft.time;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); float k = position.y * position.y;
          float sw = sin(uTime * 1.7 + wp.x * 1.3 + wp.z * 0.9) * 0.6 + sin(uTime * 3.1 + wp.x * 2.7) * 0.25;
          transformed.x += sw * 0.09 * k; transformed.z += sw * 0.05 * k; }`);
    };
    blades = new THREE.InstancedMesh(bg, bm, n);
    const r = lcg(41), m = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    let i = 0;
    while (i < n) {
      // denser close to the dirt, thinning outwards; clumps
      const a = r() * TAU, rr = (RA + 30) * U + Math.pow(r(), 1.6) * 7.5, cx = Math.cos(a) * rr, cz = Math.sin(a) * rr;
      const clump = 4 + Math.floor(r() * 8);
      for (let j = 0; j < clump && i < n; j++, i++) {
        const x = cx + (r() - 0.5) * 0.22, z = cz + (r() - 0.5) * 0.22, h = 0.16 + r() * 0.26 + (rr > 5 ? 0.12 : 0), w = 0.02 + r() * 0.018;
        e.set((r() - 0.5) * 0.7, r() * TAU, (r() - 0.5) * 0.7); qq.setFromEuler(e);
        m.compose(new THREE.Vector3(x, -0.01, z), qq, new THREE.Vector3(w, h, w)); blades.setMatrixAt(i, m);
        const v = r(), dry = r() < 0.12; col.setRGB(dry ? 0.6 + v * 0.2 : 0.22 + v * 0.22, dry ? 0.55 + v * 0.15 : 0.42 + v * 0.25, dry ? 0.28 : 0.12 + v * 0.1); blades.setColorAt(i, col);
      }
    }
    blades.receiveShadow = true; blades.castShadow = false; blades.frustumCulled = false; root.add(blades);
    await nap();
  }
  // fallen leaves and twigs on the grass, a chalk-dusted stick (what drew the ring), a cloth marble pouch
  const leafGeo = new THREE.BufferGeometry();
  { const P = [], I = []; const seg = 6; for (let i = 0; i <= seg; i++) { const t = i / seg, wv = Math.sin(t * Math.PI) * 0.42, y = Math.sin(t * Math.PI) * 0.06; P.push(-wv, y + 0.02 * Math.abs(wv), t - 0.5, 0, y + 0.04, t - 0.5, wv, y + 0.02 * Math.abs(wv), t - 0.5); if (i) { const b = (i - 1) * 3, c = i * 3; I.push(b, c, b + 1, c, c + 1, b + 1, b + 1, c + 1, b + 2, c + 1, c + 2, b + 2); } } leafGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); leafGeo.setIndex(I); leafGeo.computeVertexNormals(); }
  const nLeaves = 34, leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, side: THREE.DoubleSide }), nLeaves);
  { const r = lcg(55), m = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    for (let i = 0; i < nLeaves; i++) {
      const a = r() * TAU, rr = (RA + 60) * U + r() * 5 + (i < 6 ? -2.2 : 0), s = 0.12 + r() * 0.08;
      e.set((r() - 0.5) * 0.4, r() * TAU, (r() - 0.5) * 0.3); qq.setFromEuler(e);
      m.compose(new THREE.Vector3(Math.cos(a) * rr, 0.012, Math.sin(a) * rr), qq, new THREE.Vector3(s, s, s * 1.6)); leaves.setMatrixAt(i, m);
      const v = r(); col.setRGB(0.42 + v * 0.3, 0.24 + v * 0.2, 0.07 + v * 0.05); leaves.setColorAt(i, col);
    } }
  leaves.castShadow = true; leaves.receiveShadow = true; root.add(leaves);
  const props = new THREE.Group(); root.add(props);
  { // the stick that scratched the ring, lying by the edge (upper right)
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0x7a5232, roughness: 0.9 }));
    stick.rotation.z = Math.PI / 2; stick.rotation.y = 0.5; stick.position.set(4.3, 0.045, -3.0); stick.castShadow = true; stick.receiveShadow = true; props.add(stick);
    const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.7, 6), stick.material); twig.rotation.z = Math.PI / 2; twig.rotation.y = -0.3; twig.position.set(4.6, 0.04, -2.85); twig.castShadow = true; props.add(twig);
    // the cloth pouch of spare marbles, drawstring open (lower left)
    const pouch = new THREE.Group(); pouch.position.set(-4.35, 0, 3.05); pouch.rotation.y = 0.6; props.add(pouch);
    const clothC = cvs(256, 256, (g, n) => { g.fillStyle = '#7a2f2a'; g.fillRect(0, 0, n, n); for (let i = 0; i < n; i += 4) { g.fillStyle = 'rgba(255,220,180,0.12)'; g.fillRect(i, 0, 2, n); g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(0, i, n, 2); } g.fillStyle = 'rgba(240,200,120,0.55)'; for (let y = 30; y < n; y += 60) for (let x = 0; x < n; x += 36) { g.beginPath(); g.arc(x + (y / 60 % 2) * 18, y, 7, 0, TAU); g.fill(); } });
    const clothMat = new THREE.MeshStandardMaterial({ map: tex(clothC), roughness: 0.95 });
    const body = new THREE.Mesh(new THREE.LatheGeometry([[0.01, 0], [0.42, 0.04], [0.56, 0.2], [0.5, 0.42], [0.36, 0.56], [0.3, 0.62], [0.38, 0.72], [0.33, 0.76]].map(([x, y]) => new THREE.Vector2(x, y)), 28), clothMat);
    body.scale.set(1, 0.8, 1); body.castShadow = true; body.receiveShadow = true; pouch.add(body);
    const cord = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.022, 6, 28), new THREE.MeshStandardMaterial({ color: 0xe6d3a0, roughness: 0.9 })); cord.rotation.x = Math.PI / 2; cord.position.y = 0.5; pouch.add(cord);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), cord.material); tail.rotation.z = 1.3; tail.position.set(0.5, 0.08, 0.1); tail.castShadow = true; pouch.add(tail);
  }
  await nap();
  // dappled tree shade drifting slowly over the grass and the edge of the dirt
  const shadeMat = new THREE.MeshBasicMaterial({ color: 0x0d1608, transparent: true, opacity: 0.32, alphaMap: shadeTexture(), depthWrite: false });
  shadeMat.alphaMap.repeat.set(2.2, 2.2);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), shadeMat); shade.rotation.x = -Math.PI / 2; shade.position.set(-6, 0.03, -6); shade.renderOrder = 2;
  const shadeMask = cvs(256, 256, (g, n) => { const m = g.createRadialGradient(n * 0.25, n * 0.25, 0, n * 0.25, n * 0.25, n * 0.62); m.addColorStop(0, 'rgba(255,255,255,1)'); m.addColorStop(0.55, 'rgba(255,255,255,0.75)'); m.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = m; g.fillRect(0, 0, n, n); });
  shadeMat.onBeforeCompile = (sh) => { sh.uniforms.uMask = { value: tex(shadeMask, { srgb: false }) }; sh.fragmentShader = 'uniform sampler2D uMask;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\n diffuseColor.a *= texture2D(uMask, vAlphaMapUv / 2.2).r;'); };
  root.add(shade);
  // the shooting line glow (when a shooter is "in hand": tap the line to place it)
  const lineGlow = new THREE.Mesh(new THREE.RingGeometry((RT - 9) * U, (RT + 9) * U, 128), new THREE.MeshBasicMaterial({ color: 0x5ab4ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  lineGlow.rotation.x = -Math.PI / 2; lineGlow.position.y = 0.006; lineGlow.renderOrder = 3; root.add(lineGlow);
  // roll tracks: each rolling marble presses a faint line into the loose dirt; cleared when a new ring is set up
  const TN = 1024, trail = cvs(TN, TN, () => {}), tg = trail.getContext('2d'), trailTex = tex(trail, { aniso: 4 });
  const trailMat = new THREE.MeshBasicMaterial({ map: trailTex, transparent: true, depthWrite: false, opacity: 1 });
  const trailMesh = new THREE.Mesh(new THREE.PlaneGeometry(EXT * 2, EXT * 2), trailMat); trailMesh.rotation.x = -Math.PI / 2; trailMesh.position.y = 0.003; trailMesh.renderOrder = 1; root.add(trailMesh);
  let trailDirty = false;
  const tk = TN / (2 * EXT * 100);   // canvas px per sim unit
  return {
    root, lineGlow, shade, blades,
    track(x0, y0, x1, y1, r) {
      if (Math.hypot(x1, y1) > RA + 10) return;
      const ax = TN / 2 + x0 * tk, ay = TN / 2 + y0 * tk, bx = TN / 2 + x1 * tk, by = TN / 2 + y1 * tk;
      tg.lineCap = 'round'; tg.strokeStyle = 'rgba(92,60,28,0.10)'; tg.lineWidth = r * tk * 0.9; tg.beginPath(); tg.moveTo(ax, ay); tg.lineTo(bx, by); tg.stroke();
      tg.strokeStyle = 'rgba(70,44,18,0.16)'; tg.lineWidth = r * tk * 0.28; tg.stroke();
      trailDirty = true;
    },
    scuff(x, y, v) {
      const cx = TN / 2 + x * tk, cy = TN / 2 + y * tk, rad = (10 + Math.min(1, v / 600) * 16) * tk, m = tg.createRadialGradient(cx, cy, 0, cx, cy, rad);
      m.addColorStop(0, 'rgba(240,220,180,0.22)'); m.addColorStop(1, 'rgba(240,220,180,0)'); tg.fillStyle = m; tg.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); trailDirty = true;
    },
    clearTracks() { tg.clearRect(0, 0, TN, TN); trailDirty = true; },
    update(dt, time) { if (trailDirty) { trailTex.needsUpdate = true; trailDirty = false; } tuft.time.value = time; shadeMat.alphaMap.offset.set(Math.sin(time * 0.21) * 0.012, Math.cos(time * 0.17) * 0.01); },
  };
}

// ------------------------------------------------------------------------------------------------ marbles
const sphereGeo = new Map();
const sphere = (r, seg = 48) => { const k = `${r}|${seg}`; if (!sphereGeo.has(k)) sphereGeo.set(k, new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7))); return sphereGeo.get(k); };
// the cat's-eye: thin twisted vanes through the centre of a glass marble
function vaneGeometry(r, n = 4) {
  const parts = [], segU = 10, segV = 12;
  for (let k = 0; k < n; k++) {
    const P = [], I = [], base = (k / n) * Math.PI;
    for (let j = 0; j <= segV; j++) {
      const v = j / segV - 0.5, y = v * 1.7 * r, tw = base + v * 2.2, half = Math.sqrt(Math.max(0, 1 - (y / r) ** 2)) * r * 0.86;
      for (let i = 0; i <= segU; i++) { const u = (i / segU - 0.5) * 2 * half; P.push(Math.cos(tw) * u, y, Math.sin(tw) * u); }
    }
    for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) { const a = j * (segU + 1) + i, b = a + segU + 1; I.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); parts.push(g);
  }
  return parts;
}
const vaneCache = new Map();
function speckle(c0, c1, seed) {
  const r = lcg(seed);
  return tex(cvs(256, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, c1); gr.addColorStop(0.3, c0); gr.addColorStop(0.7, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const x = r() * w, y = 10 + r() * (h - 20), rad = 8 + r() * 18, m = g.createRadialGradient(x, y, 0, x, y, rad); m.addColorStop(0, `rgba(${r() < 0.5 ? '255,236,200' : '70,30,10'},0.25)`); m.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = m; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    for (let i = 0; i < 260; i++) { g.fillStyle = r() < 0.55 ? 'rgba(255,240,200,0.55)' : 'rgba(50,22,8,0.55)'; const s = 1 + r() * 2.4, y = 22 + r() * (h - 44); g.beginPath(); g.ellipse(r() * w, y, s / Math.max(0.35, Math.sin((y / h) * Math.PI)), s, 0, 0, TAU); g.fill(); }
  }));
}
function stripes(cols, seed, n = 6) {
  const r = lcg(seed);
  return tex(cvs(256, 128, (g, w, h) => {
    g.fillStyle = cols[0]; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) { const x = (i / n) * w + r() * 8, ww = w / n * (0.35 + r() * 0.25); g.fillStyle = cols[1 + (i % (cols.length - 1))]; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + ww * 0.8, h * 0.3, x - ww * 0.4, h * 0.7, x + ww * 0.3, h); g.lineTo(x + ww * 1.2, h); g.bezierCurveTo(x + ww * 0.4, h * 0.7, x + ww * 1.6, h * 0.3, x + ww, 0); g.fill(); }
  }));
}
const matCache = new Map();
function cached(key, make) { if (!matCache.has(key)) matCache.set(key, make()); return matCache.get(key); }
// A marble mesh group for a sim ball. Glass: clear shell (+ transmission on capable tiers) around coloured cat's-eye vanes.
export function makeMarble(b, tier) {
  const r = b.r * U, g = new THREE.Group(), trans = tier !== 'low';
  const shell = (tint) => cached(`shell|${tint}|${trans}`, () => {
    const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(tint), roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, ior: 1.52, specularIntensity: 1, envMapIntensity: 1.6 });
    if (trans) { m.transmission = 1; m.thickness = 0.25; m.attenuationColor = new THREE.Color(tint); m.attenuationDistance = 2.5; }
    else { m.transparent = true; m.opacity = 0.38; m.depthWrite = false; }
    return m;
  });
  if (b.kind === 'clay') {
    const C = CLAY3[b.variant % 5];
    const mat = cached(`clay|${b.variant}`, () => new THREE.MeshStandardMaterial({ map: speckle(C[0], C[1], 7 + b.variant), roughness: 0.78, metalness: 0, envMapIntensity: 0.6 }));
    const m = new THREE.Mesh(sphere(r), mat); m.castShadow = true; m.receiveShadow = true; g.add(m);
    g.userData.glass = false;
  } else if (b.kind === 'king') {
    const mat = cached('king', () => new THREE.MeshPhysicalMaterial({ map: stripes(['#d99a1c', '#ffe48a', '#9a5a0a', '#f6c240'], 3, 7), roughness: 0.16, metalness: 0.72, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.5 }));
    const m = new THREE.Mesh(sphere(r, 56), mat); m.castShadow = true; m.receiveShadow = true; g.add(m);
    g.userData.glass = false;
  } else {
    const shooter = b.kind === 'shooter', S = shooter ? SIDE3[b.side] : null, G = shooter ? null : GLASS3[b.variant % 5];
    const vkey = `${r}`; if (!vaneCache.has(vkey)) vaneCache.set(vkey, vaneGeometry(r * 0.96, 4));
    const vcols = shooter ? [S.rib, S.core, S.rib, S.deep] : [G.core, G.b, G.core, G.a];
    vaneCache.get(vkey).forEach((geo, i) => {
      const mat = cached(`vane|${vcols[i]}`, () => new THREE.MeshStandardMaterial({ color: new THREE.Color(vcols[i]), roughness: 0.35, metalness: 0, side: THREE.DoubleSide, emissive: new THREE.Color(vcols[i]), emissiveIntensity: 0.12 }));
      const v = new THREE.Mesh(geo, mat); v.castShadow = false; g.add(v);
    });
    if (shooter) { const core = new THREE.Mesh(sphere(r * 0.42, 24), cached(`core|${b.side}`, () => new THREE.MeshStandardMaterial({ color: new THREE.Color(S.core), roughness: 0.3 }))); g.add(core); }
    const m = new THREE.Mesh(sphere(r, 56), shell(shooter ? S.tint : G.a)); m.castShadow = true; m.receiveShadow = false; m.renderOrder = 4; g.add(m);
    g.userData.glass = true; g.userData.tint = shooter ? S.core : G.core;
  }
  return g;
}
export { RR, RA, RT, R_T, R_S };

// The lit bocce garden (game-owned 3D art): crushed-shell court with walnut side boards and brass studs, the back board,
// a lawn with mown stripes and blades, a stucco loggia wall with arches and terracotta coping, lemon trees in terracotta pots,
// cypresses and hills beyond, a golden-hour sky dome and three spans of string lights. Everything is procedural (canvas
// textures and analytic geometry), so it costs no asset bytes.
//
// World axes: three (X, Y, Z) = sim (x, z, -y). The sim court runs from y = 0 (thrower) to y = COURT.L (back board).
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { COURT, HALF } from '../src/sim.js';
import { FLOORS } from '../src/art.js';

export const TAU = Math.PI * 2;
export const W3 = (x, y, z = 0) => new THREE.Vector3(x, z, -y);
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function cvs(w, h, paint) { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); return c; }
export function tex(c, { repeat, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const css = (c, k = 1, a = 1) => `rgba(${Math.min(255, Math.round(c[0] * k))},${Math.min(255, Math.round(c[1] * k))},${Math.min(255, Math.round(c[2] * k))},${a})`;
export function glowTexture(inner = 'rgba(255,240,200,1)', mid = 'rgba(255,200,110,0.35)') {
  return tex(cvs(128, 128, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, inner); r.addColorStop(0.22, mid); r.addColorStop(1, 'rgba(255,190,100,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); }));
}

// ---- the sky: a gradient dome with a low warm sun (also feeds the reflections in the balls) -----------------------------------
export const SUN_DIR = new THREE.Vector3(-0.36, 0.56, 0.75).normalize();
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sun: { value: SUN_DIR.clone() }, zen: { value: new THREE.Color('#4f86c6') }, hor: { value: new THREE.Color('#f7d9a6') }, gnd: { value: new THREE.Color('#5d7a3c') } },
    vertexShader: 'varying vec3 vd; void main(){ vd = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 sun; uniform vec3 zen; uniform vec3 hor; uniform vec3 gnd; varying vec3 vd;
      void main(){ float h = vd.y; vec3 c = mix(hor, zen, smoothstep(0.0, 0.55, h));
        c = mix(c, gnd, smoothstep(0.0, -0.08, h));
        float s = max(0.0, dot(normalize(vd), sun));
        c += vec3(1.0, 0.78, 0.45) * (pow(s, 6.0) * 0.55 + pow(s, 400.0) * 6.0);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}
// a tiny scene for PMREM: sky dome + a green ground + the bright sun, so the glossy balls mirror a real garden at dusk
export function envScene() {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMaterial()));
  const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({ color: 0x5a7c3a })); g.rotation.x = -Math.PI / 2; g.position.y = -1.2; s.add(g);
  const court = new THREE.Mesh(new THREE.PlaneGeometry(4, 30), new THREE.MeshBasicMaterial({ color: 0xd8c6a0 })); court.rotation.x = -Math.PI / 2; court.position.y = -1.1; s.add(court);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(2.5, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 7, 4.5) })); sun.position.copy(SUN_DIR).multiplyScalar(40); s.add(sun);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 6), new THREE.MeshBasicMaterial({ color: 0xc48d5a, side: THREE.DoubleSide })); wall.position.set(0, 1.5, -25); s.add(wall);
  return s;
}

// fast speckle: blends small rectangles straight into the pixels (thousands of fillRect calls stall slow phones)
function splatter(g, W, H, n, pick) {
  const im = g.getImageData(0, 0, W, H), d = im.data;
  for (let i = 0; i < n; i++) {
    const f = pick(i); if (!f) continue;
    const x0 = Math.floor(f.x), y0 = Math.floor(f.y), w = Math.max(1, Math.round(f.w)), h = Math.max(1, Math.round(f.h)), a = f.a, c = f.c;
    for (let y = y0; y < y0 + h; y++) {
      if (y < 0 || y >= H) continue;
      for (let x = x0; x < x0 + w; x++) {
        const xx = ((x % W) + W) % W, k = (y * W + xx) * 4;
        d[k] += (c[0] - d[k]) * a; d[k + 1] += (c[1] - d[k + 1]) * a; d[k + 2] += (c[2] - d[k + 2]) * a;
      }
    }
  }
  g.putImageData(im, 0, 0);
}

// ---- court floor: crushed shell / clay / lawn / sand, raked, with the painted lines -------------------------------------------
const floorCache = new Map();
export function floorMaps(pal) {
  if (floorCache.has(pal)) return floorCache.get(pal);
  const P = FLOORS[pal] ?? FLOORS.shell, TW = 512, TH = 2048, r = rng(0x5eed + pal.length * 31);
  const vy = (y) => TH - (y / COURT.L) * TH;       // canvas v grows towards the thrower (texture is flipped onto the plane)
  const bumpC = cvs(TW, TH, (g) => { g.fillStyle = '#808080'; g.fillRect(0, 0, TW, TH); });
  const bg = bumpC.getContext('2d');
  const map = cvs(TW, TH, (g) => {
    g.fillStyle = css(P.base); g.fillRect(0, 0, TW, TH);
    for (let i = 0; i < 140; i++) {
      const x = r() * TW, y = r() * TH, rr = 30 + r() * 110, gr = g.createRadialGradient(x, y, 0, x, y, rr), dark = r() < 0.5;
      gr.addColorStop(0, css(dark ? P.dark : P.fleck, 1, 0.2)); gr.addColorStop(1, css(dark ? P.dark : P.fleck, 1, 0));
      g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    // crushed shell: angular flecks, bright and dark, with matching relief in the bump map
    const fl = [];
    for (let i = 0; i < 46000; i++) {
      const d = r() < 0.5, sz = 0.8 + r() * (pal === 'lawn' ? 1.4 : 2.6);
      fl.push({ x: r() * TW, y: r() * TH, w: sz, h: sz * (0.6 + r() * 0.8), d, c: d ? P.speck : P.fleck, a: d ? 0.18 + r() * 0.3 : 0.25 + r() * 0.45, b: r() });
    }
    splatter(g, TW, TH, fl.length, (i) => fl[i]);
    splatter(bg, TW, TH, fl.length, (i) => (i % 2 ? null : { x: fl[i].x, y: fl[i].y, w: fl[i].w, h: fl[i].w, c: fl[i].d ? [0, 0, 0] : [255, 255, 255], a: fl[i].d ? 0.25 + fl[i].b * 0.3 : 0.3 + fl[i].b * 0.4 }));
    // rake lines along the court
    for (let i = 0; i < 70; i++) {
      const x = r() * TW, a = 0.04 + r() * 0.05;
      g.strokeStyle = css(P.dark, 1, a); g.lineWidth = 1 + r() * 1.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 14, TH); g.stroke();
      bg.strokeStyle = `rgba(0,0,0,${a * 2})`; bg.lineWidth = 1.5; bg.beginPath(); bg.moveTo(x, 0); bg.lineTo(x + (r() - 0.5) * 14, TH); bg.stroke();
    }
    // throwing area a touch darker (scuffed), then the painted lines
    g.fillStyle = 'rgba(40,30,18,0.09)'; g.fillRect(0, vy(COURT.foul), TW, TH - vy(COURT.foul));
    g.fillStyle = P.line;
    g.globalAlpha = 0.9; g.fillRect(0, vy(COURT.foul) - 5, TW, 10);
    g.globalAlpha = 0.7; g.fillRect(0, vy(COURT.center) - 3.5, TW, 7);
    g.globalAlpha = 0.5; g.fillRect(TW / 2 - 2.5, vy(COURT.center) - 22, 5, 44); g.fillRect(TW / 2 - 2.5, vy(COURT.foul) - 24, 5, 48);
    g.globalAlpha = 1;
    // the boards keep the sun off the edges: a little damp shade along both sides
    const e = g.createLinearGradient(0, 0, TW, 0);
    e.addColorStop(0, 'rgba(30,18,8,0.26)'); e.addColorStop(0.06, 'rgba(30,18,8,0.06)'); e.addColorStop(0.12, 'rgba(30,18,8,0)');
    e.addColorStop(0.88, 'rgba(30,18,8,0)'); e.addColorStop(0.94, 'rgba(30,18,8,0.06)'); e.addColorStop(1, 'rgba(30,18,8,0.26)');
    g.fillStyle = e; g.fillRect(0, 0, TW, TH);
  });
  const out = { map: tex(map, { aniso: 16 }), bump: tex(bumpC, { srgb: false, aniso: 16 }) };
  floorCache.set(pal, out);
  return out;
}

function grassMap() {
  const T = 512, r = rng(77);
  const map = cvs(T, T, (g) => {
    g.fillStyle = '#5d9a43'; g.fillRect(0, 0, T, T);
    g.fillStyle = 'rgba(255,255,240,0.06)'; g.fillRect(0, 0, T, T / 2);           // mown stripes: half the tile is lighter
    splatter(g, T, T, 22000, () => { const dk = r() < 0.6; return { x: r() * T, y: r() * T, w: 1, h: 2 + r() * 5, c: dk ? [30 + r() * 30, 80 + r() * 50, 22 + r() * 25] : [160 + r() * 60, 200 + r() * 40, 110 + r() * 40], a: dk ? 0.3 + r() * 0.35 : 0.18 + r() * 0.2 }; });
    for (let i = 0; i < 60; i++) { const x = r() * T, y = r() * T, rr = 20 + r() * 60, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(${r() < 0.5 ? '30,60,20' : '200,220,120'},0.12)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr); }
  });
  return tex(map, { repeat: [40, 40], aniso: 16 });
}

function stuccoMaps() {
  const T = 512, r = rng(19);
  const bump = cvs(T, T, (g) => { g.fillStyle = '#808080'; g.fillRect(0, 0, T, T); splatter(g, T, T, 26000, () => ({ x: r() * T, y: r() * T, w: 1 + r() * 3, h: 1 + r() * 2, c: r() < 0.5 ? [255, 255, 255] : [0, 0, 0], a: 0.25 })); });
  const map = cvs(T, T, (g) => {
    g.fillStyle = '#e2b47c'; g.fillRect(0, 0, T, T);
    for (let i = 0; i < 90; i++) { const x = r() * T, y = r() * T, rr = 20 + r() * 80, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, r() < 0.5 ? 'rgba(255,236,200,0.2)' : 'rgba(150,90,50,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr); }
    splatter(g, T, T, 9000, () => ({ x: r() * T, y: r() * T, w: 1 + r() * 2, h: 1 + r() * 2, c: r() < 0.5 ? [255, 240, 210] : [120, 74, 40], a: 0.05 + r() * 0.08 }));
  });
  return { map: tex(map, { repeat: [1, 1] }), bump: tex(bump, { srgb: false, repeat: [1, 1] }) };
}

// a slender lathe: profile [[r, y]...]
const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

const clamp01 = (v) => Math.max(0, Math.min(1, v));
function leafyBall(radius, seed) {
  // a lumpy crown: a sphere displaced by position-based noise (so the UV seam never tears), shaded leaf greens per vertex
  const g = new THREE.SphereGeometry(radius, 36, 26), p = g.attributes.position, cols = [];
  const c = new THREE.Color(), hsh = (x, y, z) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 13.3) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i), n = v.clone().normalize();
    const q = (a) => Math.round(a * 1000) / 1000, h = hsh(q(n.x), q(n.y), q(n.z));
    // big lobes + leaf clumps: clumps poke out, the gaps between them sink into shade
    const lobe = Math.sin(n.x * 4 + seed) * 0.07 + Math.sin(n.y * 5 + seed * 0.3) * 0.06 + Math.sin(n.z * 3.6 + seed * 0.7) * 0.05;
    const clump = 0.6 * Math.sin(n.x * 13 + n.z * 5 + seed) * Math.sin(n.y * 11 + n.x * 4 + 1.3) * Math.sin(n.z * 15 + seed * 0.5) + 0.4 * (h - 0.5);
    const k = 1 + lobe + clump * 0.06 + (h - 0.5) * 0.05;
    v.multiplyScalar(k * (n.y < -0.3 ? 0.9 : 1)); p.setXYZ(i, v.x, v.y, v.z);
    const ao = clamp01(0.55 + clump * 0.9 + lobe * 2.5), lit = (0.55 + 0.45 * Math.max(0, n.y * 0.6 + n.x * 0.4)) * ao;
    const yel = clump > 0.5 ? 0.05 : 0;
    c.setRGB((0.13 + h * 0.06 + yel) * lit, (0.34 + h * 0.12 + yel) * lit, (0.09 + h * 0.04) * lit); cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

// ---- the whole garden ---------------------------------------------------------------------------------------------------------
export async function buildGarden(tierName = 'high', nap = async () => {}) {
  // built in slices (`nap` yields to the browser between them) so the title never freezes while the court is made
  const root = new THREE.Group();
  const near = new THREE.Group();          // things on the camera side of the court: hidden in the side (landscape) view
  root.add(near);
  const sway = [];                          // { obj, ph, amp } swaying foliage
  const glows = [];                         // string light glows (flicker)
  const L = COURT.L;

  // sky dome + far hills ring
  const sky = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 16), skyMaterial()); sky.renderOrder = -10; root.add(sky);
  const hillTex = tex(cvs(2048, 256, (g, w, h) => {
    const r = rng(5);
    const band = (base, amp, col, f) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 8) g.lineTo(x, base - Math.sin(x * f + r() * 0.02) * amp - Math.sin(x * f * 2.7 + 1) * amp * 0.4 - r() * 2); g.lineTo(w, h); g.fill(); };
    band(120, 34, 'rgba(176,160,196,0.85)', 0.006);
    band(158, 26, 'rgba(132,140,150,0.9)', 0.011);
    band(196, 16, 'rgba(92,118,82,0.95)', 0.017);
    g.fillStyle = 'rgba(70,100,60,1)'; g.fillRect(0, 214, w, 42);
  }), { srgb: true });
  hillTex.wrapS = THREE.RepeatWrapping; hillTex.repeat.set(3, 1);
  const hills = new THREE.Mesh(new THREE.CylinderGeometry(110, 110, 22, 64, 1, true), new THREE.MeshBasicMaterial({ map: hillTex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  hills.position.set(0, 6, -9); hills.renderOrder = -9; root.add(hills);

  await nap();
  // lawn
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ map: grassMap(), roughness: 1, metalness: 0, color: 0xd8e8c8 }));
  lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, -0.004, -L / 2); lawn.receiveShadow = true; root.add(lawn);

  await nap();
  // grass blades near the court (one instanced draw)
  {
    const blade = new THREE.BufferGeometry();
    blade.setAttribute('position', new THREE.Float32BufferAttribute([-0.012, 0, 0, 0.012, 0, 0, 0.002, 0.11, 0.01], 3));
    blade.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0.6, 0.8, 0, 0.6, 0.8, 0, 0.8, 0.6], 3));
    const n = tierName === 'low' ? 1800 : 5200, r = rng(11);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
    const inst = new THREE.InstancedMesh(blade, mat, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), c = new THREE.Color();
    let k = 0;
    while (k < n) {
      const x = (r() - 0.5) * 18, y = -6 + r() * (L + 9);
      if (Math.abs(x) < HALF + 0.24 && y > -0.4 && y < L + 0.3) continue;
      q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.5, r() * TAU, (r() - 0.5) * 0.5));
      const sc = 0.6 + r() * 0.9; s.set(sc, sc * (0.7 + r() * 0.8), sc);
      m.compose(new THREE.Vector3(x, 0, -y), q, s); inst.setMatrixAt(k, m);
      c.setRGB(0.12 + r() * 0.2, 0.32 + r() * 0.25, 0.08 + r() * 0.08); inst.setColorAt(k, c); k++;
    }
    inst.receiveShadow = true; root.add(inst);
  }

  await nap();
  // the court floor (texture set per surface by setSurface)
  const floorMat = new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0, bumpScale: 1.2, color: 0xfff1dc });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF, L + 0.02), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -L / 2); floor.receiveShadow = true; root.add(floor);
  function setSurface(pal) { const f = floorMaps(pal); floorMat.map = f.map; floorMat.bumpMap = f.bump; floorMat.needsUpdate = true; }
  setSurface('shell');

  await nap();
  // walnut side boards with a varnished cap and brass studs
  const boardMat = B.material('darkWood', { color: '#5a3318', color2: '#7a4a26', repeat: [8, 1], seed: 21 });
  const capMat = B.material('wood', { color: '#b77a40', color2: '#dba468', repeat: [10, 1], seed: 8 });
  capMat.roughness = 0.32; capMat.envMapIntensity = 1.2;
  const T = 0.17, H = COURT.railH;
  for (const sg of [-1, 1]) {
    const g = new THREE.Mesh(B.roundedBox(T, H - 0.03, L + 2 * T, 0.02, 2), boardMat);
    g.position.set(sg * (HALF + T / 2), (H - 0.03) / 2, -L / 2); g.castShadow = true; g.receiveShadow = true;
    const cap = new THREE.Mesh(B.roundedBox(T + 0.03, 0.045, L + 2 * T + 0.03, 0.018, 3), capMat);
    cap.position.set(sg * (HALF + T / 2), H - 0.02, -L / 2); cap.castShadow = true; cap.receiveShadow = true;
    (sg > 0 ? near : root).add(g, cap);
  }
  // end boards: the back board (taller) and the low board behind the thrower
  {
    const back = new THREE.Mesh(B.roundedBox(2 * HALF + 2 * T, COURT.wallH, T, 0.02, 2), boardMat);
    back.position.set(0, COURT.wallH / 2, -(L + T / 2)); back.castShadow = true; back.receiveShadow = true;
    const bcap = new THREE.Mesh(B.roundedBox(2 * HALF + 2 * T + 0.03, 0.045, T + 0.04, 0.018, 3), capMat);
    bcap.position.set(0, COURT.wallH + 0.01, -(L + T / 2)); bcap.castShadow = true;
    const front = new THREE.Mesh(B.roundedBox(2 * HALF + 2 * T, H - 0.03, T, 0.02, 2), boardMat);
    front.position.set(0, (H - 0.03) / 2, T / 2); front.castShadow = true; front.receiveShadow = true;
    root.add(back, bcap); near.add(front);
  }
  {
    const brass = B.material('brass'); brass.envMapIntensity = 2.2;
    const stud = new THREE.SphereGeometry(0.016, 10, 6, 0, TAU, 0, Math.PI / 2);
    const ys = []; for (let y = 1; y < L; y += 2) ys.push(y);
    for (const sg of [-1, 1]) {
      const inst = new THREE.InstancedMesh(stud, brass, ys.length), m = new THREE.Matrix4();
      ys.forEach((y, i) => { m.makeTranslation(sg * (HALF + T / 2), H + 0.003, -y); inst.setMatrixAt(i, m); });
      (sg > 0 ? near : root).add(inst);
    }
  }

  await nap();
  // the stucco loggia: back wall (beyond the back board) and the far side wall, with arches and terracotta coping
  const st = stuccoMaps();
  const stucco = new THREE.MeshStandardMaterial({ map: st.map, bumpMap: st.bump, bumpScale: 0.8, roughness: 0.95 });
  const terra = B.material('clay', { color: '#a9502c', color2: '#c4683c', seed: 3 });
  const shade = new THREE.MeshStandardMaterial({ color: 0x5a3a2c, roughness: 1 });
  const wallH = 3.1;
  function archWall(len, archW = 1.5, step = 3.0) {
    const s = new THREE.Shape(); s.moveTo(-len / 2, 0); s.lineTo(len / 2, 0); s.lineTo(len / 2, wallH); s.lineTo(-len / 2, wallH); s.lineTo(-len / 2, 0);
    const n = Math.floor(len / step);
    for (let i = 0; i < n; i++) {
      const cx = -len / 2 + step * (i + 0.5), h = new THREE.Path(), a = archW / 2, top = 2.15;
      h.moveTo(cx - a, 0.35); h.lineTo(cx + a, 0.35); h.lineTo(cx + a, top - a); h.absarc(cx, top - a, a, 0, Math.PI, false); h.lineTo(cx - a, 0.35);
      s.holes.push(h);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 10 });
    // uv in metres -> one stucco tile per 2.5 m
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.5, uv.getY(i) / 2.5);
    const grp = new THREE.Group();
    const wall = new THREE.Mesh(g, stucco); wall.castShadow = true; wall.receiveShadow = true; grp.add(wall);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(len, wallH), shade); back.position.set(0, wallH / 2, -1.4); grp.add(back);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.4), new THREE.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.01, -0.7); grp.add(floor);
    const cop = new THREE.Mesh(B.roundedBox(len + 0.2, 0.16, 0.62, 0.03, 2), terra); cop.position.set(0, wallH + 0.08, 0.2); cop.castShadow = true; grp.add(cop);
    const base = new THREE.Mesh(new THREE.BoxGeometry(len, 0.35, 0.44), new THREE.MeshStandardMaterial({ color: 0xb08a68, roughness: 0.9 })); base.position.set(0, 0.175, 0.2); base.receiveShadow = true; grp.add(base);
    return grp;
  }
  const backWall = archWall(44); backWall.position.set(-2, 0, -(L + 3.2)); root.add(backWall);
  const sideWall = archWall(40); sideWall.rotation.y = Math.PI / 2; sideWall.position.set(-(HALF + 5.2), 0, -(L / 2) + 4); root.add(sideWall);

  await nap();
  // terracotta pots with lemon trees along the court (near side hidden in the side view). All trees are instanced: pots, soil,
  // trunks, three crown shapes and their lemons, so the whole grove costs a handful of draw calls; the crowns sway.
  const potGeo = lathe([[0, 0], [0.2, 0], [0.24, 0.05], [0.27, 0.42], [0.31, 0.45], [0.31, 0.5], [0.26, 0.5], [0.24, 0.47], [0, 0.47]], 24);
  const potMat = B.material('clay', { color: '#a24b28', color2: '#c96a3e', seed: 12 });
  const soilGeo = new THREE.CircleGeometry(0.25, 16); soilGeo.rotateX(-Math.PI / 2); soilGeo.translate(0, 0.46, 0);
  const trunkGeo = new THREE.CylinderGeometry(0.03, 0.045, 0.7, 7); trunkGeo.translate(0, 0.8, 0);
  const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 });
  const lemonGeo = new THREE.SphereGeometry(0.045, 10, 8); lemonGeo.scale(1, 1.25, 1);
  const lemonMat = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.45 });
  const r = rng(41);
  const crowns = [0, 1, 2].map((v) => {
    const lem = []; const nl = 11 + v;
    for (let i = 0; i < nl; i++) { const th = r() * TAU, ph = 0.25 + r() * 1.45, rad = 0.47 + r() * 0.05; lem.push(new THREE.Vector3(Math.cos(th) * Math.sin(ph) * rad, Math.cos(ph) * rad * 0.9 - 0.05, Math.sin(th) * Math.sin(ph) * rad)); }
    return { geo: leafyBall(0.42 + v * 0.02, 3 + v * 7), lem };
  });
  const spots = [];
  for (let y = 1.6; y < L; y += 2.6) { spots.push({ x: -(HALF + 1.55), y, near: false }); spots.push({ x: HALF + 1.55, y, near: true }); }
  for (let x = -7.5; x <= 7.5; x += 3) if (Math.abs(x) > HALF + 0.6) spots.push({ x, y: L + 1.6, near: false });
  spots.forEach((t) => { t.v = Math.floor(r() * 3); t.ph = r() * TAU; t.amp = 0.02 + r() * 0.015; t.rot = r() * TAU; });
  const n = spots.length, mk = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = true; m.receiveShadow = true; root.add(m); return m; };
  const pots = mk(potGeo, potMat), soils = mk(soilGeo, new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 1 })), trunks = mk(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.9 }));
  const leafI = crowns.map((c, v) => { const m = new THREE.InstancedMesh(c.geo, leafMat, Math.max(1, spots.filter((t) => t.v === v).length)); m.castShadow = true; m.receiveShadow = true; root.add(m); return m; });
  const lemI = crowns.map((c, v) => { const m = new THREE.InstancedMesh(lemonGeo, lemonMat, Math.max(1, spots.filter((t) => t.v === v).length * c.lem.length)); m.castShadow = true; root.add(m); return m; });
  const M = new THREE.Matrix4(), Mc = new THREE.Matrix4(), Ml = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1), S0 = new THREE.Vector3(0, 0, 0);
  function poseTrees(clock, hideNear) {
    const cnt = [0, 0, 0];
    spots.forEach((t, i) => {
      const sc = hideNear && t.near ? S0 : S1;
      M.compose(V.set(t.x, 0, -t.y), Q.setFromEuler(E.set(0, t.rot, 0)), sc);
      pots.setMatrixAt(i, M); soils.setMatrixAt(i, M); trunks.setMatrixAt(i, M);
      Mc.compose(V.set(t.x, 1.32, -t.y), Q.setFromEuler(E.set(Math.sin(clock * 0.7 + t.ph * 1.3) * t.amp * 0.6, t.rot, Math.sin(clock * 0.9 + t.ph) * t.amp)), sc);
      const v = t.v, j = cnt[v]++;
      leafI[v].setMatrixAt(j, Mc);
      crowns[v].lem.forEach((p, k) => { Ml.makeTranslation(p.x, p.y, p.z).premultiply(Mc); lemI[v].setMatrixAt(j * crowns[v].lem.length + k, Ml); });
    });
    for (const m of [pots, soils, trunks, ...leafI, ...lemI]) m.instanceMatrix.needsUpdate = true;
  }
  poseTrees(0, false);
  sway.push({ pose: poseTrees });

  await nap();
  // cypresses beyond the walls
  {
    const r2 = rng(88), cyp = lathe([[0, 0], [0.38, 0.3], [0.62, 1.4], [0.6, 3.0], [0.46, 4.6], [0.26, 5.8], [0.05, 6.6], [0, 6.7]], 14);
    const cmat = new THREE.MeshStandardMaterial({ color: 0x1f4a2a, roughness: 0.9 });
    const spots = [];
    for (let i = 0; i < 9; i++) spots.push([-16 + i * 4 + r2() * 1.5, L + 6.5 + r2() * 3]);
    for (let i = 0; i < 8; i++) spots.push([-(HALF + 8.5 + r2() * 3), -6 + i * 3.6 + r2()]);
    const inst = new THREE.InstancedMesh(cyp, cmat, spots.length), m = new THREE.Matrix4(), q = new THREE.Quaternion();
    spots.forEach(([x, y], i) => { const s = 0.8 + r2() * 0.5; m.compose(new THREE.Vector3(x, 0, -y), q, new THREE.Vector3(s, s * (0.9 + r2() * 0.4), s)); inst.setMatrixAt(i, m); });
    inst.castShadow = true; root.add(inst);
  }

  await nap();
  // string lights: posts, sagging wires and warm bulbs (three spans across the court); bulbs instanced, glows one point cloud
  {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.8 });
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x1e1610 });
    const X = HALF + 1.7, Z = 3.1, spans = [L + 0.4, 13, 6], per = 11;
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.1, 1.8) }), spans.length * per);
    const gpos = new Float32Array(spans.length * per * 3), gcol = new Float32Array(spans.length * per * 3);
    const m = new THREE.Matrix4(), bulbS = []; let k = 0;
    for (const y of spans) {
      for (const sg of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, Z + 0.1, 8), postMat); p.position.set(sg * X, (Z + 0.1) / 2, -y); p.castShadow = true;
        (sg > 0 ? near : root).add(p);
      }
      const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector3(-X + 2 * X * t, Z - 0.42 * Math.sin(Math.PI * t), -y)); }
      root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.006, 4, false), wireMat));
      for (let i = 1; i <= per; i++) {
        const t = i / (per + 1), x = -X + 2 * X * t, z = Z - 0.42 * Math.sin(Math.PI * t) - 0.06;
        m.makeTranslation(x, z, -y); bulbs.setMatrixAt(k, m);
        gpos[k * 3] = x; gpos[k * 3 + 1] = z; gpos[k * 3 + 2] = -y; k++;
      }
    }
    root.add(bulbs);
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gpos, 3)); gg.setAttribute('color', new THREE.BufferAttribute(gcol, 3));
    const glowPts = new THREE.Points(gg, new THREE.PointsMaterial({ size: 0.42, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: true }));
    glowPts.frustumCulled = false; root.add(glowPts);
    glows.push({ pose(clock, cam) { for (let i = 0; i < k; i++) { const dc = cam ? Math.hypot(gpos[i * 3] - cam.x, gpos[i * 3 + 1] - cam.y, gpos[i * 3 + 2] - cam.z) : 99; const a = (0.62 + 0.18 * Math.sin(clock * 2.3 + i * 1.7) * Math.sin(clock * 0.9 + i * 0.85)) * Math.min(1, Math.max(0, (dc - 4.5) / 3)); const sc = dc < 4.5 ? 0 : 1; if (sc !== (bulbS[i] ?? 1)) { bulbS[i] = sc; m.makeScale(sc, sc, sc).setPosition(gpos[i * 3], gpos[i * 3 + 1], gpos[i * 3 + 2]); bulbs.setMatrixAt(i, m); bulbs.instanceMatrix.needsUpdate = true; } gcol[i * 3] = a; gcol[i * 3 + 1] = a * 0.85; gcol[i * 3 + 2] = a * 0.62; } gg.attributes.color.needsUpdate = true; } });
  }

  return { root, near, sway, glows, setSurface, floor };
}

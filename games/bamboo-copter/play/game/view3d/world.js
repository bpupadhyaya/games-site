// The sky world as real 3D layers: a shaded sky, terraced ridges with aerial haze, a lit terrain mesh that follows the flight's
// ground profile exactly at z = 0 (the simulation's plane), bamboo, houses, water, lanterns, ring targets, thermals, leaves.
// World units are the simulation's metres: x along the wind, y up, z toward the camera. Presenter-only (reads cond / ws).
import * as THREE from '../vendor3d/three.js';
import { PALS } from '../src/art.js';
import { groundAt, SCENES, clamp } from '../src/sim.js';
import { hash, tex, blobCanvas, cloudCanvas, bambooCanvas, canvas, leafShape } from './mats.js';

const TAU = Math.PI * 2;
const smooth = (t) => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };
const mix = (a, b, k) => a + (b - a) * k;
const col = (c) => new THREE.Color(c);
const fbm = (x, s) => 0.5 * Math.sin(x * 0.011 + s) + 0.3 * Math.sin(x * 0.027 + s * 2.1) + 0.2 * Math.sin(x * 0.061 + s * 3.7);

// light rigs per landscape: key colour / intensity, direction toward the light (x to the right, y up, z toward camera), hemisphere
export const RIGS = [
  { key: '#ffd7a0', ki: 3.0, dir: [0.75, 0.38, 0.55], sky: '#cfe3ff', gnd: '#5d7a42', hi: 0.9, env: 0.5, fog: [0.9, 0.5] },    // dawn
  { key: '#fff6df', ki: 2.5, dir: [-0.45, 0.88, 0.5], sky: '#dcecff', gnd: '#6f8f4a', hi: 1.0, env: 0.6, fog: [0.8, 0.5] },    // noon
  { key: '#ffa866', ki: 3.0, dir: [-0.8, 0.28, 0.5], sky: '#ffcfa6', gnd: '#5a4458', hi: 0.8, env: 0.45, fog: [1.0, 0.55] },  // dusk
  { key: '#a9c3ff', ki: 1.7, dir: [0.55, 0.62, 0.55], sky: '#6e88c8', gnd: '#1c2b4a', hi: 0.7, env: 0.35, fog: [1.2, 0.7] },  // night
];

function merge(parts) {   // [{ geo, matrix? }] -> one non-indexed geometry (position, normal, uv)
  let n = 0; const gs = parts.map((p) => { const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone(); if (p.m) g.applyMatrix4(p.m); n += g.attributes.position.count; return g; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of gs) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

// ---- sky ------------------------------------------------------------------------------------------------------------------
export function createSky() {
  const mat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: {
      uTop: { value: col('#000') }, uMid: { value: col('#000') }, uBot: { value: col('#000') }, uHaze: { value: col('#fff') },
      uSun: { value: new THREE.Vector2(0.5, 0.5) }, uSunR: { value: 0.05 }, uSunC: { value: col('#fff') }, uNight: { value: 0 },
      uRes: { value: new THREE.Vector2(720, 700) }, uT: { value: 0 }, uHorizon: { value: 0.7 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.999, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot; uniform vec3 uHaze; uniform vec2 uSun; uniform float uSunR; uniform vec3 uSunC;
      uniform float uNight; uniform vec2 uRes; uniform float uT; uniform float uHorizon;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        float y = 1.0 - vUv.y;   // 0 top .. 1 bottom
        vec3 c = mix(uTop, uMid, smoothstep(0.0, 0.55, y)); c = mix(c, uBot, smoothstep(0.5, 1.0, y));
        // aerial haze band hugging the horizon
        float hz = exp(-pow((y - uHorizon) * 5.0, 2.0)); c = mix(c, uHaze, hz * 0.55);
        vec2 p = (vUv - uSun) * vec2(uRes.x / uRes.y, 1.0);
        float d = length(p);
        c += uSunC * (0.55 * exp(-d * 5.5 / max(uSunR * 6.0, 0.01)) + 0.18 * exp(-d * 1.8 / max(uSunR * 6.0, 0.01)));
        float disc = smoothstep(uSunR, uSunR * 0.93, d);
        vec3 sunCol = uSunC;
        if (uNight > 0.5) { float cut = smoothstep(uSunR * 0.92, uSunR * 0.86, length(p - vec2(uSunR * 0.4, uSunR * 0.2))); disc *= 1.0 - cut * 0.92;
          vec2 cell = vUv * uRes / 5.0; vec2 g = floor(cell); vec2 f2 = fract(cell) - 0.5 - (vec2(h21(g + 7.0), h21(g + 11.0)) - 0.5) * 0.5; float s = step(0.986, h21(g)) * smoothstep(0.32, 0.0, length(f2)) * (0.55 + 0.45 * sin(uT * 2.0 + h21(g + 3.0) * 20.0)); c += vec3(0.9, 0.95, 1.0) * s * (1.0 - hz) * smoothstep(0.0, 0.2, 0.75 - y); }
        c = mix(c, sunCol, disc);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false; mesh.renderOrder = -10;
  const scene = new THREE.Scene(); scene.add(mesh);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    scene, cam, mat,
    setScene(i, aspect) {
      const p = PALS[i], u = mat.uniforms;
      u.uTop.value.set(p.sky[0]); u.uMid.value.set(p.sky[1]); u.uBot.value.set(p.sky[2]);
      u.uHaze.value.set(`rgb(${p.haze})`); u.uSunC.value.set(`rgb(${p.sun.c})`);
      u.uNight.value = p.night ? 1 : 0;
      u.uSun.value.set(p.sun.x, 1 - (p.sun.y * 0.8 + 0.06));
      u.uSunR.value = (p.sun.r / 720) * 0.9 * (p.night ? 1.0 : 1.1);
      void aspect;
    },
  };
}

// ---- ridges: shaded mountain ranges ------------------------------------------------------------------------------------------
function buildRidge(pal, seed, zBase, depth, amp, step, rowsN, colHi, colLo, kind) {
  const X0 = -1800, X1 = 1800, cols = Math.ceil((X1 - X0) / step) + 1, rows = rowsN;
  const pos = new Float32Array(cols * rows * 3), colr = new Float32Array(cols * rows * 3), idx = [];
  const hi = col(colHi), lo = col(colLo), c = new THREE.Color();
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1), z = zBase - t * depth;
    for (let i = 0; i < cols; i++) {
      const x = X0 + i * step;
      let h = amp * (0.55 + 0.45 * fbm(x * (kind === 'near' ? 1.3 : 1.0) + seed * 40, seed));
      h *= 1 - t * 0.35 + 0.3 * Math.sin(t * 3 + x * 0.003);          // ridged depth variation
      h = Math.max(0, h) * (t < 0.1 ? 0.6 + 6 * t : 1);
      const k = (r * cols + i) * 3;
      pos[k] = x; pos[k + 1] = h - 4; pos[k + 2] = z;
      c.copy(lo).lerp(hi, clamp(h / (amp * 0.95), 0, 1) * 0.8 + 0.1 * (hash(i * 7 + r) - 0.5));
      colr[k] = c.r; colr[k + 1] = c.g; colr[k + 2] = c.b;
    }
  }
  for (let r = 0; r < rows - 1; r++) for (let i = 0; i < cols - 1; i++) { const a = r * cols + i, b = a + cols; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3)); g.setIndex(idx); g.computeVertexNormals();
  void pal;
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: false }));
}

// ---- the whole world -----------------------------------------------------------------------------------------------------------
export function createWorld({ quality = 1 } = {}) {
  const group = new THREE.Group();
  const scenic = new THREE.Group(), dynamic = new THREE.Group(); group.add(scenic, dynamic);
  const lights = {
    hemi: new THREE.HemisphereLight(0xffffff, 0x445533, 0.9),
    key: new THREE.DirectionalLight(0xffffff, 3),
    fill: new THREE.DirectionalLight(0x9fb8ff, 0.35),
  };
  group.add(lights.hemi, lights.key, lights.fill, lights.key.target);

  // soft shared textures
  const T = {
    cloud: [1, 2, 3].map((s) => tex(cloudCanvas(s), { wrap: false })),
    glow: tex(blobCanvas('255,214,120', 0.95, 128), { wrap: false }),
    shadow: tex(blobCanvas('0,0,0', 0.7, 128), { wrap: false }),
    spark: tex(blobCanvas('255,240,180', 1, 64), { wrap: false }),
  };

  let sceneIdx = -1, built = null, condKey = null, cnd = null;
  const sceneGroups = new Map();      // scene index -> { group, ridges..., clouds[] }
  const state = { clouds: [], water: null, waterMats: [] };

  // clouds
  function buildClouds(i) {
    const g = new THREE.Group(), p = PALS[i], clouds = [];
    const n = 7;
    for (let k = 0; k < n; k++) {
      const m = new THREE.MeshBasicMaterial({ map: T.cloud[k % 3], transparent: true, depthWrite: false, fog: false, opacity: p.night ? 0.32 : 0.82, color: p.night ? 0x9fb4e8 : 0xffffff });
      const w = 380 + hash(k * 5 + i) * 520, mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.31), m);
      const z = -620 - hash(k * 11 + 3) * 560, y = 130 + hash(k * 13 + 1) * 330 + (z * -0.12);
      mesh.position.set(0, y, z); mesh.userData = { x0: (hash(k * 17 + 2) - 0.5) * 2400, spd: 2.5 + hash(k) * 4 };
      g.add(mesh); clouds.push(mesh);
    }
    return { group: g, clouds };
  }

  function buildScene(i) {
    const p = PALS[i], rig = RIGS[i], g = new THREE.Group();
    const R = [
      buildRidge(p, i + 1, -820, 200, 130, 24, 6, p.ridge[0], p.ridge[0], 'far'),
      buildRidge(p, i + 2, -520, 160, 84, 18, 6, p.ridge[1], new THREE.Color(p.ridge[1]).lerp(col(p.ridge[0]), 0.4), 'mid'),
      buildRidge(p, i + 3, -300, 120, 48, 12, 6, p.ridge[2], new THREE.Color(p.ridge[2]).lerp(col(p.ridge[1]), 0.35), 'near'),
    ];
    R.forEach((r) => g.add(r));
    const cl = buildClouds(i); g.add(cl.group);
    scenic.add(g); g.visible = false;
    void rig;
    return { group: g, clouds: cl.clouds, ridges: R };
  }

  // ---- terrain from the conditions of one flight ----
  const ZROWS = [640, 480, 380, 330, 290, 250, 210, 175, 145, 120, 98, 80, 64, 50, 38, 28, 20, 14, 9, 5, 2.5, 1, 0, -1, -2.5, -5, -9, -14, -20, -28, -38, -50, -64, -80, -100, -125, -155, -190, -230, -280];
  function terrainHeight(c, sc, x, z) {
    const kind = SCENES[sc].kind;
    if (kind === 'lake') {
      // water everywhere; shores only far away
      const far = Math.max(0, (-z - 200) * 0.06) * (0.6 + 0.4 * fbm(x, 3)) + (z > 40 ? (z - 40) * 0.05 : 0) * (0.5 + 0.5 * fbm(x, 1));
      return far - 0.5;
    }
    if (kind === 'roofs') {
      const street = 0.4 + 0.2 * Math.sin(x * 0.3);
      return street - (z > 6 ? 0 : 0);
    }
    const wob = z * 0.17 * smooth(Math.abs(z) / 7) + (z < 0 ? Math.sin(z * 0.04) * 6 * smooth(-z / 30) : 0);
    let h = groundAt(c, x + wob);
    if (z < -40) h = mix(h, 2 + 5 * (0.5 + 0.5 * fbm(x * 0.5, 5)) + (kind === 'terrace' ? 6 : 0), smooth((-z - 40) / 160));
    if (z > 30) h = mix(h, h * 0.8, smooth((z - 30) / 60));
    for (const t of c.targets) {
      const rz = t.hw + 4, rx = t.hw + 4, r = Math.hypot((x - t.x) / rx, z / rz);
      if (r < 1.35) h = mix(h, t.g, smooth((1.35 - r) / 0.5));
    }
    return h;
  }

  function buildTerrain(c, sc) {
    const kind = SCENES[sc].kind, pal = PALS[sc];
    const step = kind === 'terrace' ? 1.25 : kind === 'grove' ? 2.0 : 3.0;
    const X0 = -520, X1 = 520, cols = Math.floor((X1 - X0) / step) + 1, rows = ZROWS.length;
    const pos = new Float32Array(cols * rows * 3), colr = new Float32Array(cols * rows * 3), idx = [];
    const gTop = col(pal.ground[0]), gMid = col(pal.ground[1]), gDeep = col(pal.ground[2]), tmp = new THREE.Color();
    const hts = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      const z = ZROWS[r];
      for (let i = 0; i < cols; i++) {
        const x = X0 + i * step;
        let h = terrainHeight(c, sc, x, z);
        if (Math.abs(z) > 2.5 && kind === 'terrace') h = (terrainHeight(c, sc, x - step, z) + 2 * h + terrainHeight(c, sc, x + step, z)) / 4;
        hts[r * cols + i] = h;
        const k = (r * cols + i) * 3; pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
      }
    }
    for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
      const h = hts[r * cols + i], z = ZROWS[r], x = X0 + i * step;
      const hl = hts[r * cols + Math.max(0, i - 1)], hr = hts[r * cols + Math.min(cols - 1, i + 1)];
      const slope = Math.abs(hr - hl) / (2 * step);
      const n = 0.5 + 0.5 * Math.sin(x * 0.21 + z * 0.13) * Math.sin(x * 0.07 - z * 0.19) + 0.25 * (hash(i * 31 + r * 17) - 0.5);
      tmp.copy(gMid).lerp(gTop, clamp(0.55 + 0.4 * (n - 0.5) - slope * 0.6, 0, 1));
      if (kind === 'terrace') { const lvl = Math.floor((h + 4) / 3.4); tmp.lerp(col(lvl % 3 === 0 ? '#c4c85a' : lvl % 3 === 1 ? '#7fae3d' : '#a4c24c'), 0.45 * (1 - slope * 2)); if (slope > 0.3) tmp.lerp(col('#7a5a36'), 0.55); }
      if (kind === 'roofs') tmp.copy(gDeep).lerp(col('#7a6a5c'), 0.5 + 0.3 * n);
      if (kind === 'lake') tmp.copy(gDeep).lerp(gMid, 0.3 + 0.4 * n);
      const fade = smooth((-z - 60) / 220); tmp.lerp(gDeep, fade * 0.25);
      tmp.lerp(gDeep, smooth((z - 10) / 170) * 0.62);
      const k = (r * cols + i) * 3; colr[k] = tmp.r; colr[k + 1] = tmp.g; colr[k + 2] = tmp.b;
    }
    for (let r = 0; r < rows - 1; r++) for (let i = 0; i < cols - 1; i++) { const a = r * cols + i, b = a + cols; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(colr, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 }));
    mesh.frustumCulled = false;
    return { mesh, hts, cols, rows, step, X0 };
  }

  // flat water patches (flooded paddies on the terraced hills)
  function buildPaddies(T_, sc) {
    const { hts, cols, rows, step, X0 } = T_, quads = [];
    for (let r = 2; r < rows - 6; r++) for (let i = 1; i < cols - 1; i++) {
      const a = hts[r * cols + i], b = hts[r * cols + i + 1], c2 = hts[(r + 1) * cols + i], d = hts[(r + 1) * cols + i + 1];
      if (Math.abs(a - b) < 0.015 && Math.abs(a - c2) < 0.015 && Math.abs(a - d) < 0.015 && (Math.floor(i / 6) + r) % 2 === 0) {
        const x = X0 + i * step, z0 = ZROWS[r], z1 = ZROWS[r + 1];
        quads.push(x, a + 0.05, z0, x + step, a + 0.05, z0, x, a + 0.05, z1, x + step, a + 0.05, z1);
      }
    }
    if (!quads.length) return null;
    const n = quads.length / 12, pos = new Float32Array(quads), idx = [];
    for (let q = 0; q < n; q++) { const o = q * 4; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    void sc;
    return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#bfe0f4', roughness: 0.06, metalness: 0.0, transparent: true, opacity: 0.66, envMapIntensity: 1.6 }));
  }

  // bamboo stalks: tapered culms with nodes, leaf fans on top
  function stalkGeometry() {
    const parts = [], H = 40, seg = 12, r0 = 0.3;
    for (let k = 0; k < seg; k++) {
      const y0 = (k / seg) * H, y1 = ((k + 1) / seg) * H - 0.12, ra = r0 * (1 - 0.4 * (k / seg)), rb = r0 * (1 - 0.4 * ((k + 1) / seg));
      const g = new THREE.CylinderGeometry(rb, ra, y1 - y0, 8, 1); g.translate(0, (y0 + y1) / 2, 0); parts.push({ geo: g });
      const ring = new THREE.CylinderGeometry(rb * 1.2, rb * 1.2, 0.2, 8, 1); ring.translate(0, y1 + 0.04, 0); parts.push({ geo: ring });
    }
    for (let k = 0; k < 9; k++) {
      const l = new THREE.PlaneGeometry(3.4, 0.5, 1, 1); l.translate(1.7, 0, 0);
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.15 + (k % 3) * 0.25, k * 0.7, -0.5 - (k % 2) * 0.35)); m.setPosition(0, H - 1.5 - (k % 4) * 1.1, 0);
      parts.push({ geo: l, m });
    }
    return merge(parts);
  }
  let stalkGeo = null;
  function buildGrove(c) {
    stalkGeo = stalkGeo || stalkGeometry();
    const n = Math.round(130 * quality), fg = Math.round(10 * quality);
    const mat = new THREE.MeshStandardMaterial({ map: tex(bambooCanvas(64, ['#8dbb5a', '#4f8838'], 9), { repeat: [1, 8] }), roughness: 0.7, side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(stalkGeo, mat, n + fg);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), cc = new THREE.Color();
    for (let i = 0; i < n + fg; i++) {
      const f = i >= n, k = i + c.hseed * 0.37;
      const x = (hash(k * 3 + 1) - 0.5) * 900, z = f ? 12 + hash(k * 7) * 34 : -3 - Math.pow(hash(k * 7 + 2), 1.6) * 150;
      const g0 = terrainHeight(c, 0, x, z), sc2 = 0.7 + hash(k * 5 + 3) * 0.9;
      e.set((hash(k * 11) - 0.5) * 0.07, hash(k * 13) * 6.28, (hash(k * 17) - 0.5) * 0.07); q.setFromEuler(e);
      s.set(sc2, sc2, sc2); p.set(x, g0 - 0.5, z);
      m.compose(p, q, s); mesh.setMatrixAt(i, m);
      cc.setHSL(0.24 + hash(k * 23) * 0.06, 0.45, 0.4 + hash(k * 29) * 0.22); mesh.setColorAt(i, cc);
    }
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  // houses with gabled roofs and lit windows
  function buildHouses(c) {
    const parts = [], roofParts = [], winPos = [];
    const first = Math.floor((-520 + 1000) / 20), last = Math.floor((520 + 1000) / 20);
    for (let row = 0; row < 4; row++) {
      for (let cell = first; cell <= last; cell++) {
        const x0 = cell * 20 - 1000, probe = groundAt(c, x0 + 10 + (row ? 0 : 0));
        const xm = x0 + 10;
        if (row === 0 && !(probe > 2.4)) continue;                 // z = 0 plane: exactly the simulation's houses
        if (row > 0 && hash(cell * 5 + row * 31 + c.hseed) < 0.34) continue;
        const hh = row === 0 ? groundAt(c, x0 + 3.01) : 3.2 + 4.5 * hash(cell * 13 + row * 7 + c.hseed);
        const z = [0, -24, -50, -84][row] + (row ? (hash(cell + row) - 0.5) * 8 : 0), dep = row === 0 ? 12 : 14;
        const w = 14, wall = new THREE.BoxGeometry(w, hh, dep); wall.translate(xm, hh / 2, z);
        parts.push({ geo: wall });
        // gable roof (prism) with overhang
        const sh = new THREE.Shape(); sh.moveTo(-w / 2 - 1.2, 0); sh.lineTo(w / 2 + 1.2, 0); sh.lineTo(0, 1.9 + 0.4); sh.closePath();
        const roof = new THREE.ExtrudeGeometry(sh, { depth: dep + 2.2, bevelEnabled: false }); roof.translate(xm, hh - 0.1, z - dep / 2 - 1.1);
        roofParts.push({ geo: roof });
        if (row < 2 && hash(cell * 3 + c.hseed + row) > 0.35) winPos.push([xm - 3, hh * 0.55, z + dep / 2 + 0.05], [xm + 3, hh * 0.55, z + dep / 2 + 0.05]);
      }
    }
    const walls = new THREE.Mesh(merge(parts), new THREE.MeshStandardMaterial({ color: '#d9c7a6', roughness: 0.9 }));
    const roofs = new THREE.Mesh(merge(roofParts), new THREE.MeshStandardMaterial({ color: '#a2472c', roughness: 0.75 }));
    const g = new THREE.Group(); g.add(walls, roofs);
    if (winPos.length) {
      const w = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.6, 2.1), new THREE.MeshBasicMaterial({ color: '#ffd27a', fog: false }), winPos.length);
      const m = new THREE.Matrix4();
      winPos.forEach((p, i) => { m.makeTranslation(p[0], p[1], p[2]); w.setMatrixAt(i, m); });
      w.frustumCulled = false; g.add(w);
    }
    g.traverse((o) => { o.frustumCulled = false; });
    return g;
  }

  // water for the lake: sheen toward the horizon, moon glints, ripples
  function buildLake(sc) {
    const p = PALS[sc];
    const m2 = new THREE.ShaderMaterial({
      uniforms: {
        uDeep: { value: col('#0b1c3e') }, uSky: { value: col(p.sky[2]) }, uMoonX: { value: 0 }, uT: { value: 0 }, uFogC: { value: col(p.haze ? `rgb(${p.haze})` : '#fff') },
        uFogN: { value: 300 }, uFogF: { value: 1500 },
      },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `varying vec3 vW; uniform vec3 uDeep; uniform vec3 uSky; uniform float uMoonX; uniform float uT; uniform vec3 uFogC; uniform float uFogN; uniform float uFogF;
        void main(){
          vec3 V = normalize(cameraPosition - vW); float f = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
          vec3 c = mix(uDeep, uSky, clamp(f * 1.15, 0.0, 1.0));
          float rip = sin(vW.x * 0.9 + uT * 1.3 + sin(vW.z * 0.31) * 2.0) * sin(vW.z * 0.55 - uT * 0.9 + vW.x * 0.05);
          c += 0.05 * rip * f;
          float dx = (vW.x - uMoonX); float col = exp(-dx * dx / max(60.0, 60.0 + (-vW.z) * 0.9)) * (0.4 + 0.6 * smoothstep(0.2, 0.9, rip * 0.5 + 0.5));
          c += vec3(0.78, 0.86, 1.0) * col * f * 1.4;
          float d = distance(cameraPosition, vW); float fg = clamp((d - uFogN) / (uFogF - uFogN), 0.0, 1.0);
          gl_FragColor = vec4(mix(c, uFogC, fg), 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2600, 1800).rotateX(-Math.PI / 2), m2);
    mesh.position.set(0, 0, -700); mesh.frustumCulled = false;
    return { mesh, mat: m2 };
  }

  // lantern: lathe paper body, gold caps, tassel, glow
  const lanternProto = (() => {
    const g = new THREE.Group();
    const prof = [[0.001, 1.05], [0.42, 1.0], [0.82, 0.58], [0.98, 0.0], [0.82, -0.58], [0.42, -1.0], [0.001, -1.05]].map(([x, y]) => new THREE.Vector2(x, y));
    const paper = new THREE.MeshStandardMaterial({ color: '#d4402a', emissive: '#ff6a2c', emissiveIntensity: 1.15, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), paper); g.add(body);
    for (const y of [-0.95, 0.95]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.14, 16), new THREE.MeshStandardMaterial({ color: '#e8b84a', metalness: 0.8, roughness: 0.35 })); cap.position.y = y; g.add(cap); }
    for (const a of [0, 1, 2, 3]) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.97 - 0.05, 0.018, 4, 24), new THREE.MeshStandardMaterial({ color: '#a8281a', roughness: 0.6 })); rib.rotation.y = a * Math.PI / 4; rib.rotation.x = 0; g.add(rib); }
    const tassel = new THREE.Group(); tassel.position.y = -1.05;
    for (let k = 0; k < 5; k++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 1.0, 5), new THREE.MeshStandardMaterial({ color: '#e8b84a', roughness: 0.5 })); s.position.set((k - 2) * 0.09, -0.5, 0); tassel.add(s); }
    g.add(tassel); g.userData.tassel = tassel;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: '#ffc870', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.8 }));
    glow.scale.set(5.5, 5.5, 1); g.add(glow); g.userData.glow = glow;
    return g;
  })();

  // pennant + ring targets
  function buildTargets(c, sc) {
    const g = new THREE.Group(), lake = sc === 3;
    c.targets.forEach((t, i) => {
      const tg = new THREE.Group(); tg.position.set(t.x, t.g, 0);
      const rings = [[1, lake ? '#bfe6c0' : '#fff6e0'], [0.5, '#e04b3a'], [0.2, '#ffd23c']];
      rings.forEach(([k, cc], j) => {
        const d = new THREE.Mesh(new THREE.CylinderGeometry(t.hw * k, t.hw * k, 0.16, 48), new THREE.MeshStandardMaterial({ color: cc, roughness: 0.55, emissive: cc, emissiveIntensity: 0.12 }));
        d.position.y = 0.12 + j * 0.13; d.receiveShadow = false; tg.add(d);
      });
      const rim = new THREE.Mesh(new THREE.TorusGeometry(t.hw, 0.16, 6, 56), new THREE.MeshStandardMaterial({ color: '#7a5a2a', roughness: 0.6 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.18; tg.add(rim);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 8), new THREE.MeshStandardMaterial({ color: '#6b4a2a', roughness: 0.8 })); pole.position.set(t.hw + 0.5, 3.5, 0); tg.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.2, 8, 1), new THREE.MeshStandardMaterial({ color: i === 0 ? '#ffd23c' : '#e8503c', side: THREE.DoubleSide, roughness: 0.8, emissive: '#601000', emissiveIntensity: 0.2 }));
      flag.position.set(t.hw + 0.5 + 1.8, 6.0, 0); flag.userData.base = flag.geometry.attributes.position.array.slice(); tg.add(flag);
      tg.userData.flag = flag;
      g.add(tg);
    });
    return g;
  }

  // thermals: rising shimmer columns
  function buildThermals(c, sc) {
    const g = new THREE.Group();
    c.thermals.forEach((th) => {
      const gr = groundAt(c, th.x), top = th.top;
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        uniforms: { uT: { value: 0 }, uC: { value: col(sc === 3 ? '#a9c0ff' : '#fff4c8') }, uH: { value: top - gr } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `varying vec2 vUv; uniform float uT; uniform vec3 uC; uniform float uH;
          void main(){ float x = abs(vUv.x - 0.5) * 2.0; float side = 1.0 - smoothstep(0.0, 1.0, x); float vert = (1.0 - vUv.y);
            float st = 0.0; for (int k = 0; k < 5; k++) { float fk = float(k); float xs = (fk - 2.0) * 0.32 + sin(vUv.y * 9.0 + uT * 1.4 + fk) * 0.07; float d = abs((vUv.x - 0.5) * 2.0 - xs);
              float run = fract(vUv.y * 1.6 - uT * (0.14 + 0.03 * fk) + fk * 0.19); st += smoothstep(0.045, 0.0, d) * smoothstep(0.0, 0.2, run) * smoothstep(0.55, 0.2, run); }
            float a = (0.10 * side + 0.7 * st * side) * smoothstep(0.0, 0.12, vUv.y) * vert;
            gl_FragColor = vec4(uC, a); }`,
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(th.w * 2.2, top - gr), mat);
      m.position.set(th.x, gr + (top - gr) / 2, -3); g.add(m);
    });
    return g;
  }

  // leaves + sparks (instanced)
  const MAXL = Math.round(48 * quality), MAXS = 80;
  const leafMesh = new THREE.InstancedMesh(leafShape(), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7, side: THREE.DoubleSide }), MAXL);
  leafMesh.frustumCulled = false; leafMesh.count = 0; dynamic.add(leafMesh);
  const sparkMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: T.spark, color: '#ffe6a0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), MAXS);
  sparkMesh.frustumCulled = false; sparkMesh.count = 0; dynamic.add(sparkMesh);
  const copterShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: T.shadow, transparent: true, depthWrite: false, fog: false, opacity: 0.8 }));
  copterShadow.renderOrder = 3; dynamic.add(copterShadow);

  let ter = null, terrainMesh = null, extra = null, lanterns = [], lakeObj = null, targetsG = null, thermalG = null;
  const lanternGroup = new THREE.Group(); dynamic.add(lanternGroup);

  function clearCond() {
    for (const o of [terrainMesh, extra, targetsG, thermalG]) if (o) { o.removeFromParent(); o.traverse?.((x) => { if (x.geometry) x.geometry.dispose(); }); }
    terrainMesh = extra = targetsG = thermalG = null;
    lanternGroup.clear(); lanterns = [];
    if (lakeObj) { lakeObj.mesh.removeFromParent(); lakeObj.mesh.geometry.dispose(); lakeObj.mat.dispose(); lakeObj = null; }
  }

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

  return {
    group, lights, state, sky: null,
    setScene(i) {
      if (i === sceneIdx) return;
      sceneIdx = i;
      if (!sceneGroups.has(i)) sceneGroups.set(i, buildScene(i));
      for (const [k, v] of sceneGroups) v.group.visible = k === i;
      built = sceneGroups.get(i);
      const rig = RIGS[i];
      lights.hemi.color.set(rig.sky); lights.hemi.groundColor.set(rig.gnd); lights.hemi.intensity = rig.hi;
      lights.key.color.set(rig.key); lights.key.intensity = rig.ki;
      lights.key.position.set(rig.dir[0] * 200, rig.dir[1] * 200, rig.dir[2] * 200);
      lights.fill.position.set(-rig.dir[0] * 100, 40, 120); lights.fill.intensity = i === 3 ? 0.5 : 0.3;
      condKey = null;
    },
    setCond(c) {
      if (!c || c === cnd) return;
      cnd = c; clearCond();
      const sc = c.scene, kind = SCENES[sc].kind;
      ter = buildTerrain(c, sc); terrainMesh = ter.mesh; scenic.add(terrainMesh);
      extra = new THREE.Group(); scenic.add(extra);
      if (kind === 'grove') extra.add(buildGrove(c));
      if (kind === 'roofs') extra.add(buildHouses(c));
      if (kind === 'terrace') { const w = buildPaddies(ter, sc); if (w) extra.add(w); }
      if (kind === 'lake') { lakeObj = buildLake(sc); extra.add(lakeObj.mesh); }
      targetsG = buildTargets(c, sc); scenic.add(targetsG);
      thermalG = buildThermals(c, sc); scenic.add(thermalG);
      c.lanterns.forEach((l, i) => { const o = lanternProto.clone(true); o.userData = { ...lanternProto.userData, glow: o.children.find((k) => k.isSprite), tassel: o.children.find((k) => k.isGroup) }; o.scale.setScalar(1.6); o.position.set(l.x, l.y, 0); o.userData.i = i; lanternGroup.add(o); lanterns.push(o); });
    },
    /** per frame: t = seconds; ws = world state (cam, f, parts); camX/camY = camera centre; sunX = world x of the sun/moon on screen */
    update(t, ws, cam) {
      if (!built) return;
      // clouds drift with the wind
      const wdir = ws.cond ? Math.sign(ws.cond.wind) || 1 : 1;
      for (const m of built.clouds) {
        const span = 3000, x = ((m.userData.x0 + t * m.userData.spd * wdir) % span + span) % span - span / 2;
        m.position.x = cam.x + x * 0.9;
      }
      for (let i = 0; i < lanterns.length; i++) {
        const o = lanterns[i], l = ws.cond.lanterns[i], got = ws.f && ws.f.got_idx.indexOf(i) >= 0;
        o.visible = !got;
        o.position.y = l.y + Math.sin(t * 1.7 + i * 1.3) * 0.45;
        o.rotation.z = Math.sin(t * 1.3 + i) * 0.07;
        const tas = o.userData.tassel; if (tas) tas.rotation.z = Math.sin(t * 2.1 + i * 0.7) * 0.25;
        const gl = o.userData.glow; if (gl) gl.material.opacity = 0.65 + 0.2 * Math.sin(t * 5.3 + i * 2.1) + 0.1 * Math.sin(t * 11.0 + i);
      }
      if (targetsG) targetsG.children.forEach((tg) => {
        const f = tg.userData.flag; if (!f) return;
        const a = f.geometry.attributes.position, b = f.userData.base;
        for (let k = 0; k < a.count; k++) { const x = b[k * 3] + 1.8; a.array[k * 3 + 2] = Math.sin(x * 1.6 - t * 6) * 0.38 * (x / 3.6) + Math.sin(x * 0.7 - t * 2.4) * 0.12; }
        a.needsUpdate = true; f.geometry.computeVertexNormals();
      });
      if (thermalG) thermalG.children.forEach((m) => { m.material.uniforms.uT.value = t; });
      if (lakeObj) { lakeObj.mat.uniforms.uT.value = t; lakeObj.mat.uniforms.uMoonX.value = cam.sunX ?? cam.x; }
      // leaves
      let nl = 0, ns = 0;
      for (const q of ws.parts) {
        if (q.spark) {
          if (ns >= MAXS) continue;
          _p.set(q.x, q.y, 2); const sz = (0.35 + q.r * 0.35) * Math.max(0.2, q.life); _s.set(sz, sz, sz);
          _m.compose(_p, _q.identity(), _s); sparkMesh.setMatrixAt(ns++, _m); continue;
        }
        if (nl >= MAXL) continue;
        const z = (((q.ph * 7.31) % 1) - 0.35) * 46;
        _e.set(Math.sin(q.t * 2.6 + q.ph) * 0.9, Math.sin(q.t * 1.7 + q.ph * 2) * 0.8, q.a); _q.setFromEuler(_e);
        _p.set(q.x, q.y, z); const sz = 0.55 + q.r * 0.45; _s.set(sz * 0.5, sz, sz);
        _m.compose(_p, _q, _s); leafMesh.setMatrixAt(nl, _m); _c.set(q.col); leafMesh.setColorAt(nl, _c); nl++;
      }
      leafMesh.count = nl; sparkMesh.count = ns; leafMesh.instanceMatrix.needsUpdate = true; sparkMesh.instanceMatrix.needsUpdate = true;
      if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
      // contact shadow of the copter on the ground (z = 0 plane)
      const f = ws.f;
      if (f && ws.cond) {
        const gnd = groundAt(ws.cond, f.x), hgt = Math.max(0, f.y - gnd), k = clamp(1 - hgt / 60, 0.2, 1);
        copterShadow.visible = true; copterShadow.position.set(f.x, gnd + 0.12, 0);
        const sc = 9 * (0.6 + 0.4 * k); copterShadow.scale.set(sc * 2.2, 1, sc * 1.2); copterShadow.material.opacity = 0.7 * k;
      } else copterShadow.visible = false;
    },
  };
}

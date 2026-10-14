// The tent pegging parade ground as a real lit 3D scene (view3d stage): sky and hills (scenery kit), a raked sand lane with chalk edges, hoof prints,
// distance boards, bunting poles, covered stands with a crowd3d audience, the peg gate, the peg itself (a real ~11 cm wooden block on a chalk mat),
// a horse3d horse with a costumed view3d rider, the lance with flex, the aim ring, hoof dust, clods and ribbons.
// Presentation only: render() reads the run state every frame and never writes to it. The scene is drawn into its own canvas and blitted behind the
// 2D HUD by scene.js; with no WebGL2 (or after a lost context) the game falls back to the painted 2D lane.
//
// World frame: +Z along the lane, +Y up, +X is the rider's LEFT (three.js looking down +Z). Sim x (+ = rider's right) is therefore X3 = -x.
import { createStage, buildScenery, createCrowd3d, loadHorse, loadHuman, FINGER_POSES, palmPoint, handQuat, addGloves, buildClip, THREE } from '../vendor3d/index.js';
import { dressRider } from './costume.js';
import { LANE_LEN, SIDE } from '../src/consts.js';
import { tipPos } from '../src/scene.js';

const { Vector3, Quaternion, Euler, Matrix4, Group, Mesh, MeshStandardMaterial, MeshLambertMaterial, MeshBasicMaterial, BoxGeometry, CylinderGeometry, SphereGeometry,
  PlaneGeometry, TorusGeometry, CircleGeometry, RingGeometry, ConeGeometry, BufferGeometry, Float32BufferAttribute, CanvasTexture, SRGBColorSpace, RepeatWrapping,
  ClampToEdgeWrapping, DoubleSide, InstancedMesh, Object3D, Color, Sprite, SpriteMaterial, AdditiveBlending, PerspectiveCamera, LineSegments, LineBasicMaterial,
  Fog, LatheGeometry, Vector2 } = THREE;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const hash = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const sm = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
const wrapA = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
function cv(w, h = w) { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, rep = [1, 1], aniso = 4) { const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = aniso; return t; }
// critically damped follow (state kept on `o`)
function spring(o, key, target, w, dt) {
  const x = o[key] ?? target, v = o[key + 'V'] ?? 0;
  if (!(dt > 0)) return x;
  const e = Math.exp(-w * dt), d = x - target;
  const nx = target + (d + (v + w * d) * dt) * e;
  o[key + 'V'] = (v - w * (v + w * d) * dt) * e; o[key] = nx;
  return nx;
}

// ---- looks: one per time of day (index = SKIES in scene.js) ----------------------------------------------------------------------------
const LOOKS = [
  { name: 'morning', sky: 'sky-clear', bd: 'bd-rice', band: 'band-fields', tod: 'day', light: 'day', key: 0xfff1da, keyI: 1.9, hemi: 0.55, sand: '#c9a672', fog: 0xcfe0ee, exp: 1.0, night: 0, houses: true, zen: '#4f8fd8' },
  { name: 'noon', sky: 'sky-day', bd: 'bd-steppe', band: 'band-snow-ridge', tod: 'day', light: 'day', key: 0xfff8ec, keyI: 2.0, hemi: 0.55, sand: '#cdaa76', fog: 0xcfe3f3, exp: 1.0, night: 0, zen: '#2f6fc4' },
  { name: 'afternoon', sky: 'sky-golden', bd: 'bd-desert', band: null, tod: 'day', light: 'evening', key: 0xffd39a, keyI: 1.9, hemi: 0.5, sand: '#cfa874', fog: 0xf0d6aa, exp: 1.0, night: 0, zen: '#4a74b8' },
  { name: 'evening', sky: 'sky-rose', bd: 'bd-desert', band: null, tod: 'dusk', light: 'evening', key: 0xffb27a, keyI: 1.8, hemi: 0.5, sand: '#c79e6e', fog: 0xe9b79a, exp: 1.0, night: 0.15, zen: '#3b3f7a' },
  { name: 'floodlit', sky: 'sky-dusk', bd: 'bd-steppe', band: null, tod: 'night', light: 'night', key: 0xfff0d2, keyI: 1.7, hemi: 0.55, sand: '#a98c64', fog: 0x16213f, exp: 1.1, night: 1, zen: '#0a1030' },
];
const PEG_SIZE = 0.11;                 // a tent peg is a ~10 cm wooden block (enlarged 1.1x for readability)
const CLOTH = ['#d6453d', '#f2c14e', '#2f6fb6', '#f4efe3', '#3a9b8e', '#e98aa5'];

export async function createLane3d({ quality = 'medium', base, sceneryBase, host: hostEl } = {}) {
  const doc = globalThis.document;
  const host = hostEl || doc.createElement('div');
  if (!hostEl) { host.style.cssText = 'position:fixed;left:-10000px;top:0;width:8px;height:8px;overflow:hidden;pointer-events:none;visibility:hidden'; doc.body.appendChild(host); }
  const canvas = doc.createElement('canvas');
  canvas.style.cssText = 'position:absolute;left:0;top:0;width:8px;height:8px;display:block';
  host.appendChild(canvas);
  const stage = createStage({ canvas, container: host, quality, dprCap: 2, shadows: true, lighting: 'day', fov: 60, shadowSize: 11, preserveDrawingBuffer: false });
  if (!stage.supported) { host.remove(); return null; }
  const { scene, renderer } = stage;
  const cam = new PerspectiveCamera(60, 1, 0.06, 420);
  stage.lights.key.shadow.camera.far = 90; stage.lights.key.shadow.camera.near = 1;
  stage._shadowOffset.set(-9, 16, -10);
  const L = { tier: quality, pxsCap: 2, ok: true, lost: false, canvas, stage, camera: cam, quality, ready: false, look: -1, host, time: 0, cost: { ema: 0, n: 0 }, sized: '' };
  stage.onContextLost(() => { L.lost = true; });
  stage.onContextRestored(() => { L.lost = false; L.sized = ''; applyLookLights(L.look); });
  const U = { time: { value: 0 } };

  // wind for cloth: vertices carry `flut` (0 where the cloth is held, 1 at the free edge)
  const windify = (mat, k = 1) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = U.time;
      sh.vertexShader = 'uniform float uTime;\nattribute float flut;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        `vec3 transformed = vec3(position);
         float w1 = sin(uTime * 2.7 + position.z * 0.55 + position.y * 1.3) * 0.5 + 0.5;
         float w2 = sin(uTime * 4.1 + position.z * 1.1) * 0.5 + 0.5;
         transformed.x += flut * (w1 * 0.5 + w2 * 0.25 - 0.25) * ${(0.28 * k).toFixed(2)};
         transformed.y += flut * w2 * 0.04 * ${k.toFixed(2)};`);
    };
    return mat;
  };

  // ------------------------------------------------------------------------------------------------------------------------------ lane
  const lanes = [];
  function laneTexture(look) {
    const c = cv(256, 512), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 256, 0);
    gr.addColorStop(0, '#c8a876'); gr.addColorStop(0.5, look.sand); gr.addColorStop(1, '#bf9d6c');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 2600; i++) { const v = hash(i * 3.1); g.fillStyle = v > 0.5 ? `rgba(255,240,205,${0.05 + v * 0.1})` : `rgba(60,38,18,${0.05 + v * 0.1})`; g.fillRect(hash(i + 7) * 256, hash(i + 13) * 512, 1 + hash(i) * 2.6, 1 + hash(i + 3) * 2); }
    // raked furrows along the lane
    g.strokeStyle = 'rgba(70,46,22,0.16)'; g.lineWidth = 1.2;
    for (let i = 0; i < 26; i++) { const x = 8 + hash(i + 40) * 240; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 4, 160, x - 5, 340, x + 2, 512); g.stroke(); }
    // chalk edges, a little dusty
    for (const x of [10, 246]) {
      g.fillStyle = 'rgba(255,255,255,0.92)'; g.fillRect(x - 3, 0, 6, 512);
      for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + hash(i + x) * 0.25})`; g.fillRect(x - 6 + hash(i * 2 + x) * 12, hash(i + 19) * 512, 1.5, 3); }
    }
    return tex(c, [1, 1]);
  }
  function bumpTexture() {
    const c = cv(128, 256), g = c.getContext('2d');
    g.fillStyle = '#808080'; g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 1500; i++) { const v = hash(i) > 0.5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},0.25)`; g.fillRect(hash(i + 5) * 128, hash(i + 11) * 256, 1 + hash(i + 2) * 3, 1 + hash(i + 8) * 3); }
    const t = tex(c, [1, 1]); return t;
  }
  const LANE_HALF = 2.9, LANE_Z0 = -14, LANE_Z1 = LANE_LEN + 70;
  const laneMat = new MeshStandardMaterial({ roughness: 1, metalness: 0, bumpScale: 1.2 });
  const laneMesh = new Mesh(new PlaneGeometry(LANE_HALF * 2, LANE_Z1 - LANE_Z0), laneMat);
  laneMesh.rotation.x = -Math.PI / 2; laneMesh.position.set(0, 0.012, (LANE_Z0 + LANE_Z1) / 2); laneMesh.receiveShadow = true;
  scene.add(laneMesh);
  // soft verge: the lane's edge blends into the grass
  const vergeTex = (() => { const c = cv(64, 4), g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(70,52,30,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 4); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; })();
  const verge = new Mesh(new PlaneGeometry(LANE_HALF * 2 + 3.4, LANE_Z1 - LANE_Z0), new MeshBasicMaterial({ map: vergeTex, transparent: true, depthWrite: false, fog: true }));
  verge.rotation.x = -Math.PI / 2; verge.position.set(0, 0.006, (LANE_Z0 + LANE_Z1) / 2); scene.add(verge);
  // start and end lines
  const lineMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  for (const z of [0, LANE_LEN]) { const m = new Mesh(new PlaneGeometry(LANE_HALF * 2 - 0.2, 0.34), lineMat); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.02, z + 0.17); scene.add(m); }
  // hoof prints (instanced dark ovals along the track)
  {
    const N = 90, im = new InstancedMesh(new CircleGeometry(1, 10), new MeshBasicMaterial({ color: 0x4a3420, transparent: true, opacity: 0.34, depthWrite: false }), N);
    const d = new Object3D();
    for (let k = 0; k < N; k++) {
      const z = 1 + k * (LANE_LEN + 20) / N + hash(k) * 0.6, x = (hash(k + 17) - 0.5) * 1.6 + (k % 2 ? 0.45 : -0.45);
      d.position.set(x, 0.024, z); d.rotation.set(-Math.PI / 2, 0, (hash(k + 3) - 0.5) * 0.4); d.scale.set(0.11, 0.16, 1); d.updateMatrix(); im.setMatrixAt(k, d.matrix);
    }
    scene.add(im);
  }

  // ------------------------------------------------------------------------------------------------------------------------------ fence, boards, poles, bunting
  const fenceRight = [];       // the rider's-right fence is hidden while the replay camera stands outside it
  {
    // white rail fence both sides with posts every 4 m
    const railM = new MeshStandardMaterial({ color: 0xf1ece0, roughness: 0.7 });
    const NP = Math.ceil((LANE_LEN + 60) / 4);
    const d = new Object3D();
    for (const sx of [-1, 1]) {
      const posts = new InstancedMesh(new BoxGeometry(0.1, 1.1, 0.1), railM, NP);
      for (let k = 0; k < NP; k++) { d.position.set(sx * 3.5, 0.55, -8 + k * 4); d.rotation.set(0, 0, 0); d.updateMatrix(); posts.setMatrixAt(k, d.matrix); }
      posts.castShadow = true; scene.add(posts);
      if (sx < 0) fenceRight.push(posts);
      for (const y of [0.45, 0.95]) { const r = new Mesh(new BoxGeometry(0.05, 0.06, LANE_LEN + 60), railM); r.position.set(sx * 3.5, y, -8 + (LANE_LEN + 60) / 2); scene.add(r); if (sx < 0) fenceRight.push(r); }
    }
  }
  // distance boards: white boards on posts with the metres painted on
  for (let z = 10; z <= LANE_LEN + 10; z += 10) {
    const c = cv(128, 64), g = c.getContext('2d');
    g.fillStyle = '#fdfaf0'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#d6453d'; g.fillRect(0, 0, 128, 9);
    g.fillStyle = '#23304a'; g.font = '800 40px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(z), 64, 38);
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 125, 61);
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
    const grp = new Group();
    const board = new Mesh(new BoxGeometry(0.62, 0.34, 0.035), new MeshBasicMaterial({ map: t, fog: true })); board.position.y = 1.35; grp.add(board);
    const back = new Mesh(new BoxGeometry(0.64, 0.36, 0.03), new MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.8 })); back.position.set(0, 1.35, 0.03); grp.add(back);
    const post = new Mesh(new CylinderGeometry(0.03, 0.035, 1.3, 8), new MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.8 })); post.position.y = 0.65; grp.add(post);
    grp.position.set(3.3, 0, z); grp.rotation.y = Math.PI / 2 + 0.25; scene.add(grp);
  }
  // bunting poles and flags (one merged mesh, wind in the vertex shader)
  const buntingTop = [];
  {
    const poleM = new MeshStandardMaterial({ color: 0x6a5238, roughness: 0.75 });
    const pos = [], col = [], fl = [];
    const poleZ = []; for (let z = 4; z <= LANE_LEN + 28; z += 12) poleZ.push(z);
    const poles = new InstancedMesh(new CylinderGeometry(0.045, 0.06, 3.4, 8), poleM, poleZ.length * 2);
    const d = new Object3D(); let n = 0;
    for (const sx of [-1, 1]) {
      for (let k = 0; k < poleZ.length; k++) {
        d.position.set(sx * 4.6, 1.7, poleZ[k]); d.updateMatrix(); poles.setMatrixAt(n++, d.matrix);
        if (k === poleZ.length - 1) continue;
        const z0 = poleZ[k], z1 = poleZ[k + 1], NF = 8;
        for (let f = 0; f < NF; f++) {
          const u = (f + 0.5) / NF, z = lerp(z0, z1, u), y = 3.35 - Math.sin(u * Math.PI) * 0.5;
          const c = new Color(CLOTH[(k * 3 + f + (sx > 0 ? 2 : 0)) % CLOTH.length]);
          const w = 0.34, h = 0.46, x = sx * 4.6;
          pos.push(x, y, z - w / 2, x, y, z + w / 2, x, y - h, z); fl.push(0, 0, 1);
          for (let q = 0; q < 3; q++) col.push(c.r, c.g, c.b);
        }
      }
    }
    poles.castShadow = true; scene.add(poles);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new Float32BufferAttribute(col, 3)); geo.setAttribute('flut', new Float32BufferAttribute(fl, 1));
    geo.computeVertexNormals();
    const flags = new Mesh(geo, windify(new MeshLambertMaterial({ vertexColors: true, side: DoubleSide }), 1));
    flags.frustumCulled = false; scene.add(flags);
    // the strings
    const lp = [];
    for (const sx of [-1, 1]) for (let k = 0; k < poleZ.length - 1; k++) {
      const z0 = poleZ[k], z1 = poleZ[k + 1];
      for (let s = 0; s < 8; s++) { const a = s / 8, b = (s + 1) / 8; lp.push(sx * 4.6, 3.35 - Math.sin(a * Math.PI) * 0.5, lerp(z0, z1, a), sx * 4.6, 3.35 - Math.sin(b * Math.PI) * 0.5, lerp(z0, z1, b)); }
    }
    const lg = new BufferGeometry(); lg.setAttribute('position', new Float32BufferAttribute(lp, 3));
    scene.add(new LineSegments(lg, new LineBasicMaterial({ color: 0x2a2018 })));
  }

  // ------------------------------------------------------------------------------------------------------------------------------ stands
  const standMats = { wood: new MeshStandardMaterial({ color: 0x8a6a46, roughness: 0.85 }), dark: new MeshStandardMaterial({ color: 0x4e3b28, roughness: 0.9 }), post: new MeshStandardMaterial({ color: 0xe9e1cf, roughness: 0.6 }) };
  const canopyTex = (alt) => {
    const c = cv(64, 8), g = c.getContext('2d');
    for (let i = 0; i < 8; i++) { g.fillStyle = (i + alt) % 2 ? '#2f7a86' : '#e8dcc0'; g.fillRect(i * 8, 0, 8, 8); }
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(1, 1); t.magFilter = THREE.NearestFilter; return t;
  };
  const crowdStands = [];
  const SEG = 22, ROWS = 3, ROWD = 0.9, RISE = 0.42, STAND_X = 7.2;
  const PER_ROW = quality === 'low' ? 11 : quality === 'high' ? 24 : 17;
  for (const side of [1, -1]) {                      // side +1 = X3 positive = the rider's LEFT
    for (let i = 0, z = -2; z < LANE_LEN + 16; z += SEG, i++) {
      const xf = side * STAND_X;
      const grp = new Group(); grp.position.set(xf, 0, z + SEG / 2);
      for (let r = 0; r < ROWS; r++) {
        const h = (r + 1) * RISE;
        const step = new Mesh(new BoxGeometry(ROWD, h, SEG - 0.4), standMats.wood); step.position.set(side * (r * ROWD), h / 2, 0); step.receiveShadow = true; step.castShadow = true; grp.add(step);
        const bench = new Mesh(new BoxGeometry(0.34, 0.06, SEG - 0.6), standMats.dark); bench.position.set(side * (r * ROWD + 0.32), h + 0.4, 0); grp.add(bench);
      }
      const front = new Mesh(new BoxGeometry(0.08, 0.5, SEG - 0.4), new MeshStandardMaterial({ color: 0xd6453d, roughness: 0.6 })); front.position.set(-side * 0.46, 0.25, 0); grp.add(front);
      // canopy
      const ct = canopyTex(i % 2); ct.repeat.set((SEG - 0.4) / 3, 1);
      const canopy = new Mesh(new PlaneGeometry(SEG - 0.4, ROWS * ROWD + 1.8), new MeshLambertMaterial({ map: (() => { const t = ct.clone(); t.needsUpdate = true; t.rotation = Math.PI / 2; return t; })(), side: DoubleSide }));
      canopy.rotation.set(-Math.PI / 2, 0, Math.PI / 2); canopy.rotation.order = 'YXZ';
      canopy.rotation.set(0, Math.PI / 2, 0); canopy.rotateX(-Math.PI / 2 + side * 0.12 * 0);
      canopy.position.set(side * ((ROWS - 1) * ROWD * 0.5 + 0.2), 3.7, 0); grp.add(canopy);
      for (const dz of [-SEG / 2 + 0.5, 0, SEG / 2 - 0.5]) {
        for (const dx of [-0.5, (ROWS - 1) * ROWD + 0.9]) { const p = new Mesh(new CylinderGeometry(0.06, 0.06, 3.7, 8), standMats.post); p.position.set(side * dx, 1.85, dz); p.castShadow = true; grp.add(p); }
      }
      scene.add(grp);
      crowdStands.push({ center: [xf + side * 0.1, 0, z + SEG / 2], yaw: side > 0 ? -Math.PI / 2 : Math.PI / 2, rows: ROWS, perRow: PER_ROW, width: SEG - 1.4, rise: RISE, rowDepth: ROWD, focus: [0, 1.4, z + SEG / 2 + 6], fill: 0.82, standing: 0.12 });
    }
  }

  // ------------------------------------------------------------------------------------------------------------------------------ the peg gate, the peg, ring
  const gate = new Group(); scene.add(gate);
  {
    const poleM = new MeshStandardMaterial({ color: 0xe9e1cf, roughness: 0.55 }), red = new MeshStandardMaterial({ color: 0xd6453d, roughness: 0.55 });
    for (const x of [-3.0, 3.0]) {
      const p = new Mesh(new CylinderGeometry(0.06, 0.07, 4.8, 10), poleM); p.position.set(x, 2.4, 0); p.castShadow = true; gate.add(p);
      for (let k = 0; k < 8; k += 2) { const b = new Mesh(new CylinderGeometry(0.066, 0.076, 4.8 / 8, 10), red); b.position.set(x, 4.8 / 8 * (k + 0.5), 0); gate.add(b); }
      const ball = new Mesh(new SphereGeometry(0.1, 12, 8), new MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.35, metalness: 0.6 })); ball.position.set(x, 4.9, 0); gate.add(ball);
    }
    // banner: teal to gold plain cloth, hanging a little below the top, waving
    const c = cv(256, 48), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, '#2b7f8c'); gr.addColorStop(0.5, '#3da3a8'); gr.addColorStop(1, '#f2c14e');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 48); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(0, 0, 256, 4); g.fillRect(0, 44, 256, 4);
    const bt = new CanvasTexture(c); bt.colorSpace = SRGBColorSpace;
    const bg = new PlaneGeometry(6.0, 0.62, 12, 3); bg.rotateY(Math.PI / 2 * 0);
    const flut = []; const pa = bg.attributes.position;
    for (let i = 0; i < pa.count; i++) flut.push(1 - (pa.getY(i) + 0.31) / 0.62 * 0.5 + 0.0);
    bg.setAttribute('flut', new Float32BufferAttribute(flut, 1));
    // the cloth's z axis is the string direction in the wind shader, so lay the banner across X and wave along it
    const bm = windify(new MeshLambertMaterial({ map: bt, side: DoubleSide }), 0.6);
    const banner = new Mesh(bg, bm); banner.position.set(0, 4.25, 0); banner.frustumCulled = false; gate.add(banner); gate.userData.banner = banner;
  }
  // the peg: a short square block of seasoned wood standing in a chalk mat
  const peg = new Group(); scene.add(peg);
  const pegMat = new MeshStandardMaterial({ color: 0xb9854a, roughness: 0.7 });
  const pegBody = new Mesh(new BoxGeometry(PEG_SIZE, PEG_SIZE * 1.25, PEG_SIZE), pegMat); pegBody.castShadow = true; peg.add(pegBody);
  const pegTop = new Mesh(new BoxGeometry(PEG_SIZE * 1.02, 0.012, PEG_SIZE * 1.02), new MeshStandardMaterial({ color: 0xe8c58a, roughness: 0.6 })); pegTop.position.y = PEG_SIZE * 0.625; peg.add(pegTop);
  const pegBand = new Mesh(new BoxGeometry(PEG_SIZE * 1.04, 0.02, PEG_SIZE * 1.04), new MeshStandardMaterial({ color: 0xd6453d, roughness: 0.6 })); pegBand.position.y = PEG_SIZE * 0.3; peg.add(pegBand);
  const mat = new Mesh(new CircleGeometry(0.75, 40), new MeshBasicMaterial({ map: (() => { const c = cv(128), g = c.getContext('2d'); g.fillStyle = 'rgba(255,255,255,0.78)'; g.beginPath(); g.arc(64, 64, 62, 0, TAU); g.fill(); g.strokeStyle = 'rgba(214,69,61,0.95)'; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 58, 0, TAU); g.stroke(); g.strokeStyle = 'rgba(214,69,61,0.8)'; g.lineWidth = 3; g.beginPath(); g.arc(64, 64, 34, 0, TAU); g.stroke(); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; })(), transparent: true, depthWrite: false }));
  mat.rotation.x = -Math.PI / 2; mat.position.y = 0.03; scene.add(mat);
  const hole = new Mesh(new CircleGeometry(0.14, 16), new MeshBasicMaterial({ color: 0x2a1c10, transparent: true, opacity: 0.85, depthWrite: false })); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.04; hole.visible = false; scene.add(hole);
  // marker flag on a cane beside the mat so the target reads at 60 m
  const marker = new Group(); scene.add(marker);
  {
    const cane = new Mesh(new CylinderGeometry(0.014, 0.018, 1.5, 6), new MeshStandardMaterial({ color: 0xb9854a, roughness: 0.6 })); cane.position.y = 0.75; marker.add(cane);
    const fg = new BufferGeometry(); fg.setAttribute('position', new Float32BufferAttribute([0, 1.46, 0, 0, 1.12, 0, 0, 1.29, 0.5], 3)); fg.setAttribute('flut', new Float32BufferAttribute([0, 0, 1], 1)); fg.computeVertexNormals();
    const flag = new Mesh(fg, windify(new MeshLambertMaterial({ color: 0xd6453d, side: DoubleSide }), 0.8)); flag.frustumCulled = false; marker.add(flag);
  }
  // aim ring on the ground (glowing inlay)
  const ring = new Group(); scene.add(ring);
  const ringMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, blending: AdditiveBlending, fog: false });
  {
    const t = new Mesh(new TorusGeometry(0.34, 0.032, 8, 40), ringMat); t.rotation.x = Math.PI / 2; ring.add(t);
    for (const s of [-1, 1]) { const tick = new Mesh(new BoxGeometry(0.5, 0.012, 0.045), ringMat); tick.position.x = s * 0.74; ring.add(tick); }
    const halo = new Mesh(new CircleGeometry(0.4, 32), new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false, blending: AdditiveBlending, fog: false })); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.002; ring.add(halo);
  }
  ring.visible = false;

  // ------------------------------------------------------------------------------------------------------------------------------ crowd
  L.crowd = null;
  try {
    L.crowd = createCrowd3d(stage, { stands: crowdStands, seed: 23, culture: 'south_asian', quality, cold: false, props: { flag: 0.07, phone: 0.1, child: 0.06 }, excitement: 0.25, viewportHeight: 800, camera: cam });
  } catch (e) { console.warn('crowd3d unavailable', e && e.message); }

  // ------------------------------------------------------------------------------------------------------------------------------ horse + rider
  const COATS = ['bay', 'chestnut', 'grey', 'darkbay', 'palomino'];
  const horse = await loadHorse({ coat: 'bay', mane: 'loose', tack: 'english', quality: quality === 'low' ? 'low' : 'high', base });
  const human = await loadHuman({ character: 'athlete_m', base, kit: { top: '#17315a', bottoms: '#1d2540', socks: '#1c120c' }, skin: '#c48a60', hair: 'black' });
  const rig = new Group(); rig.name = 'rider3'; scene.add(rig);
  rig.add(horse.root); rig.add(human.root);
  const LOOK = { kit: '#17315a', trim: '#e0b64a', accent: '#e0b64a', dark: '#0c1a33', cap: 'turban', turban: '#f1e8d0', boot: 0x1c120c, trousers: 0xe9e2cf };
  const dress = dressRider(human, LOOK, 0);
  // the shared horse's neck and head are single-sided as posed; seen from above (the saddle) they must draw from both sides
  for (const m of horse.meshes) { m.material.side = DoubleSide; m.material.needsUpdate = true; }
  // the model's poll is open between the ears: a forelock tuft closes it
  const tuftMat = new MeshStandardMaterial({ color: 0x1a0f08, roughness: 0.9 });
  const tuft = new Mesh(new SphereGeometry(1, 14, 10), tuftMat); tuft.scale.set(0.07, 0.04, 0.085); tuft.position.set(0, 0.062, 0.0); horse.b.Head.add(tuft);
  const fore = new Mesh(new SphereGeometry(1, 12, 8), tuftMat); fore.scale.set(0.05, 0.075, 0.03); fore.position.set(0, 0.0, 0.14); fore.rotation.x = 0.5; horse.b.Head.add(fore);
  horse.setTack('english', { blanket: '#1f8a96', trim: '#f2d08c' });
  // seat clips: the shared ones do not close their 2 s loop (the torso steps forward a few centimetres at every wrap), so they are authored here
  // with the same poses and full keys at both ends; horse3d uses clips of these names when they exist
  for (const [i, nm] of ['ride_english', 'ride_fast_english', 'ride_deep_english'].entries()) {
    const lean = [0, 8, 18][i], th = 66, ca = 86, ab = 22;
    const legs = { L_Thigh: { flex: th, abduct: ab }, R_Thigh: { flex: th, abduct: ab }, L_Calf: { flex: ca }, R_Calf: { flex: ca } };
    const base = { ...legs, Pelvis: { flex: 4 + lean * 0.4 }, Spine: { flex: 2 + lean * 0.3 }, Spine1: { flex: 2 + lean * 0.3 }, Spine2: { flex: 2 + lean * 0.3 }, Neck: { flex: -4 - lean * 0.2 }, Head: { flex: -3 } };
    const mid = { ...base, Spine1: { flex: 3.5 + lean * 0.3 } };
    human.addClip(buildClip(human, { name: nm, duration: 2, loop: true, base: 'rest', grounded: false, fingers: 'relaxed',
      keys: [{ t: 0, pose: base }, { t: 1, pose: mid, ease: 'inOut' }, { t: 2, pose: base, ease: 'inOut' }] }));
  }
  horse.attachRider(human, { style: 'english', hat: false });
  addGloves(human, { color: 0x6b4527, trim: 0x3a2412 });
  human.setFingers('L', 'fist');
  const body = { human, horse };

  // two stewards in regimental dress stand beside the peg gate with a red flag each (they move to the gate of every run)
  const stewards = [];
  for (const [k, sx] of [[0, -1], [1, 1]]) {
    try {
      const h = await loadHuman({ character: 'athlete_m', base, kit: { top: '#f1ecdf', bottoms: '#f1ecdf', socks: '#1c120c' }, skin: ['#b87f58', '#caa07a'][k], hair: 'black' });
      dressRider(h, { kit: '#f1ecdf', trim: '#d6453d', accent: '#c9a24a', dark: '#b8ae98', cap: 'turban', turban: '#c8342a', boot: 0x1c120c, trousers: 0xf1ecdf }, 3 + k);
      h.root.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;      // face the lane
      scene.add(h.root);
      h.play('idle');
      const pole = new Group();
      const cane = new Mesh(new CylinderGeometry(0.012, 0.014, 1.7, 6), new MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.6 })); cane.position.set(0, 0.55, 0); pole.add(cane);
      const fg = new BufferGeometry(); fg.setAttribute('position', new Float32BufferAttribute([0, 1.4, 0, 0, 0.98, 0, 0.5, 1.19, 0], 3)); fg.setAttribute('flut', new Float32BufferAttribute([0, 0, 1], 1)); fg.computeVertexNormals();
      pole.add(new Mesh(fg, windify(new MeshLambertMaterial({ color: 0xd6453d, side: DoubleSide }), 1.1)));
      h.bones.Bip01_R_Hand.add(pole); pole.rotation.set(0, 0, -0.1);
      stewards.push({ h, sx });
    } catch (e) { console.warn('steward unavailable', e && e.message); }
  }

  // hide the rider's own head when seen from inside it
  const headMeshes = [];
  human.root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const geo = o.geometry, ix = geo.index, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    if (!ix || !si) return;
    const head = new Set(o.skeleton.bones.map((bn, i) => (/_(Head|HeadNub)$/.test(bn.name) ? i : -1)).filter((i) => i >= 0));
    if (!head.size) return;
    const w = new Float32Array(geo.attributes.position.count); let any = false;
    for (let i = 0; i < w.length; i++) for (let k = 0; k < 4; k++) if (head.has(si.getComponent(i, k))) { w[i] += sw.getComponent(i, k); }
    const orig = ix.array.slice(), degen = ix.array.slice();
    for (let t = 0; t < degen.length; t += 3) if (w[degen[t]] > 0.5 || w[degen[t + 1]] > 0.5 || w[degen[t + 2]] > 0.5) { degen[t + 1] = degen[t]; degen[t + 2] = degen[t]; any = true; }
    if (any) headMeshes.push({ ix, orig, degen });
  });
  let headHidden = null;
  const hideHead = (on) => {
    if (headHidden === on) return; headHidden = on;
    for (const h of headMeshes) { h.ix.array.set(on ? h.degen : h.orig); h.ix.needsUpdate = true; }
    dress.cap.visible = !on;
  };
  hideHead(true);

  // grip: fingers wrapped round the lance, like hand3d.gripCylinder
  const FIST = FINGER_POSES.fist, REL = FINGER_POSES.relaxed, OPEN = FINGER_POSES.open;
  const gripPose = (() => {
    const p = { thumb: 0.5, index: 0.72, middle: 0.74, ring: 0.76, pinky: 0.78, spread: 0, thumbOut: 0.1 };
    const names = ['thumb', 'index', 'middle', 'ring', 'pinky'];
    const curl = names.map((n, f) => FIST.curl[f].map((c, k) => lerp(f === 0 ? OPEN.curl[0][k] : REL.curl[f][k], c, p[n])));
    return { curl, spread: names.map(() => 0) };
  })();
  const grip = { on: false, wrist: new Vector3(), quat: new Quaternion(), pole: new Vector3(), set: false, lw: new Vector3(), lq: new Quaternion(), lp: new Vector3() };
  const baseUpdate = human.update.bind(human);
  const invRoot = new Matrix4(), lLocal = new Vector3();
  human.update = (dt) => {
    if (grip.on) {
      human.setReach('R', grip.wrist, { weight: 1, pole: grip.pole, quat: grip.quat }); human.setFingers('R', gripPose, { rate: 1000 });
      human.setReach('L', grip.lw, { weight: 1, pole: grip.lp, quat: grip.lq }); human.setFingers('L', 'fist', { rate: 1000 });
      // the reins end in the left fist
      if (horse.tack && horse.tack.handTargets) { invRoot.copy(horse.root.matrixWorld).invert(); horse.tack.handTargets.L = lLocal.copy(grip.lw).applyMatrix4(invRoot).clone(); }
    }
    return baseUpdate(dt);
  };

  // ------------------------------------------------------------------------------------------------------------------------------ lance
  const lance = new Group(); scene.add(lance);
  const bamboo = (() => {
    const c = cv(32, 256), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 32, 0); gr.addColorStop(0, '#9a6d33'); gr.addColorStop(0.4, '#d9ad62'); gr.addColorStop(1, '#8a5f2a');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 256);
    for (let y = 0; y < 256; y += 40) { g.fillStyle = 'rgba(60,34,10,0.75)'; g.fillRect(0, y, 32, 3); g.fillStyle = 'rgba(255,230,170,0.35)'; g.fillRect(0, y + 3, 32, 2); }
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(70,40,12,${hash(i) * 0.18})`; g.fillRect(hash(i + 1) * 32, hash(i + 2) * 256, 1, 8 + hash(i) * 20); }
    return tex(c, [1, 1]);
  })();
  const shaftMat = new MeshStandardMaterial({ map: bamboo, roughness: 0.5 });
  const NSEG = 12;
  const shaftSegs = [];
  for (let i = 0; i < NSEG; i++) { const m = new Mesh(new CylinderGeometry(1, 1, 1, 10, 1, true), shaftMat); m.castShadow = true; lance.add(m); shaftSegs.push(m); }
  const steelMat = new MeshStandardMaterial({ color: 0xcfd6df, roughness: 0.25, metalness: 0.85 });
  const spearPts = [[0, 0], [0.018, 0.0], [0.02, 0.03], [0.028, 0.1], [0.02, 0.2], [0.0, 0.3]].map(([r, y]) => new Vector2(r, y));
  const spear = new Mesh(new LatheGeometry(spearPts, 14), steelMat); spear.castShadow = true; lance.add(spear);
  const collar = new Mesh(new CylinderGeometry(0.022, 0.02, 0.07, 12), new MeshStandardMaterial({ color: 0x8a6a2a, roughness: 0.35, metalness: 0.7 })); lance.add(collar);
  const gripWrap = new Mesh(new CylinderGeometry(0.019, 0.019, 0.22, 12), new MeshStandardMaterial({ color: 0x4b2c17, roughness: 0.75 })); lance.add(gripWrap);
  const pennonG = (() => {
    const g = new PlaneGeometry(0.42, 0.13, 8, 1); g.translate(0.21, 0, 0);
    const fl = []; const pa = g.attributes.position; for (let i = 0; i < pa.count; i++) fl.push(clamp(pa.getX(i) / 0.42, 0, 1));
    g.setAttribute('flut', new Float32BufferAttribute(fl, 1)); return g;
  })();
  const pennonMat = new MeshLambertMaterial({ color: 0xd6453d, side: DoubleSide });
  pennonMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time; sh.uniforms.uSpeed = lanceSpeed;
    sh.vertexShader = 'uniform float uTime;\nuniform float uSpeed;\nattribute float flut;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `vec3 transformed = vec3(position);
       transformed.y += flut * sin(uTime * (10.0 + uSpeed) - position.x * 18.0) * 0.035 * (0.4 + uSpeed * 0.06);
       transformed.z += flut * sin(uTime * (13.0 + uSpeed) - position.x * 14.0 + 1.3) * 0.03 * (0.4 + uSpeed * 0.06);`);
  };
  const lanceSpeed = { value: 8 };
  const pennon = new Mesh(pennonG, pennonMat); pennon.frustumCulled = false; lance.add(pennon);
  const buttCap = new Mesh(new SphereGeometry(0.03, 10, 8), new MeshStandardMaterial({ color: 0x8a6a2a, roughness: 0.4, metalness: 0.6 })); lance.add(buttCap);
  lance.traverse((n) => { n.frustumCulled = false; });
  const lanceState = { flex: 0, flexV: 0, prevY: null, prevVy: 0 };

  // ------------------------------------------------------------------------------------------------------------------------------ dust, clods, ribbons
  const dustTex = (() => { const c = cv(64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(226,204,160,0.85)'); gr.addColorStop(0.6, 'rgba(226,204,160,0.35)'); gr.addColorStop(1, 'rgba(226,204,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; })();
  const DUST = 90, dust = [];
  for (let i = 0; i < DUST; i++) {
    const sp = new Sprite(new SpriteMaterial({ map: dustTex, transparent: true, depthWrite: false, opacity: 0, fog: true }));
    sp.visible = false; scene.add(sp); dust.push({ sp, life: 0, max: 1, vx: 0, vy: 0, vz: 0, s0: 0.3, s1: 0.9, a: 0.6 });
  }
  let dustI = 0;
  const puff = (x, y, z, vx, vy, vz, s0, s1, life, a = 0.6, tint = null) => {
    const d = dust[dustI++ % DUST]; d.life = 0; d.max = life; d.vx = vx; d.vy = vy; d.vz = vz; d.s0 = s0; d.s1 = s1; d.a = a;
    d.sp.position.set(x, y, z); d.sp.visible = true; d.sp.material.color.set(tint || 0xffffff); d.sp.scale.setScalar(s0);
  };
  const CLODS = 18;
  const clodM = new InstancedMesh(new BoxGeometry(1, 0.7, 0.8), new MeshStandardMaterial({ color: 0x5a3f26, roughness: 1 }), CLODS);
  clodM.castShadow = true; clodM.frustumCulled = false; clodM.count = CLODS; scene.add(clodM);
  const clods = Array.from({ length: CLODS }, () => ({ x: 0, y: -5, z: 0, vx: 0, vy: 0, vz: 0, s: 0.03, rx: 0, ry: 0, wx: 0, wy: 0, life: 0 }));
  const dummy = new Object3D();
  const RIB = 28, ribbons = [], ribbonMesh = new InstancedMesh(new PlaneGeometry(0.09, 0.04), new MeshBasicMaterial({ side: DoubleSide, vertexColors: false }), RIB);
  ribbonMesh.frustumCulled = false; scene.add(ribbonMesh);
  for (let i = 0; i < RIB; i++) { ribbons.push({ x: 0, y: -5, z: 0, vx: 0, vy: 0, vz: 0, r: 0, w: 0, life: 0, max: 1 }); ribbonMesh.setColorAt(i, new Color(CLOTH[i % CLOTH.length])); }
  ribbonMesh.instanceColor.needsUpdate = true;

  horse.on('hoof', (e) => {
    if (e.speed < 4.5) return;
    const bone = horse.b[`${e.front ? 'FrontHoof' : 'BackHoof'}.${e.side}`];
    if (!bone) return;
    const p = bone.getWorldPosition(new Vector3());
    const k = clamp(e.speed / 14, 0.3, 1);
    puff(p.x, 0.05, p.z - 0.1, (hash(dustI) - 0.5) * 0.6, 0.5 + hash(dustI + 1) * 0.5, -e.speed * 0.12, 0.2, 0.8 + k * 0.5, 0.9, 0.5 * k, 0xe0c9a0);
    // a clod kicked back now and then
    if (hash(dustI * 7) > 0.55) { const c = clods.find((q) => q.life <= 0); if (c) { c.x = p.x; c.y = 0.06; c.z = p.z; c.vx = (hash(dustI + 5) - 0.5) * 1.6; c.vy = 1.6 + hash(dustI + 6) * 1.6; c.vz = -e.speed * 0.35; c.s = 0.02 + hash(dustI + 9) * 0.025; c.life = 1.4; c.wx = hash(dustI) * 14; c.wy = hash(dustI + 3) * 14; } }
  });

  // ------------------------------------------------------------------------------------------------------------------------------ looks
  const cache = new Map();
  let building = -1;
  function applyLookLights(i) {
    const lk = LOOKS[i] || LOOKS[1];
    stage.setLighting(lk.light, { key: lk.key, keyI: lk.keyI, hemi: lk.hemi, exposure: lk.exp, fog: lk.fog, sky: lk.fog });
    if (scene.fog) { scene.fog.near = 55; scene.fog.far = 300; }
    laneMat.map = laneTexture(lk); laneMat.map.repeat.set(1, (LANE_Z1 - LANE_Z0) / 12); laneMat.bumpMap = bumpTexture(); laneMat.bumpMap.repeat.set(1, (LANE_Z1 - LANE_Z0) / 6);
    laneMat.color.set(lk.night ? 0x8a93b8 : 0xffffff); laneMat.needsUpdate = true;
  }
  function setLook(i) {
    if (i === L.look) return;
    L.look = i;
    applyLookLights(i);
    const lk = LOOKS[i];
    tuneSky(lk);
    for (const [k, v] of cache) v.group.visible = k === i;
    horse.setCoat({ coat: COATS[i % COATS.length], blaze: i % 2 === 0 ? 'blaze' : undefined });
    tuftMat.color.set(horse.coat && typeof horse.coat.mane === 'string' ? horse.coat.mane : [0x1a0f08, 0x2a140a, 0xcfcac2, 0x120a06, 0xe8d8b0][i % 5]);
    if (cache.has(i) || building === i) return;
    building = i;
    const layers = [{ t: 'sky', id: lk.sky }, { t: 'backdrop', id: lk.bd }];
    if (lk.band) layers.push({ t: 'band', id: lk.band, r: 95, h: lk.band === 'band-snow-ridge' ? 11 : 14, y: 1, arc: lk.band === 'band-snow-ridge' ? [-170, 170] : undefined });
    layers.push({ t: 'ground', id: 'gr-dry-grass', size: 520, tile: 5 });
    layers.push({ t: 'cutouts', id: 'tr-broad-tree', count: 12, r: [52, 96], scale: [9, 13], seed: 5, sway: 0.5 });
    if (lk.houses) layers.push({ t: 'cutouts', id: 'st-thatch-stilt-house', count: 4, r: [60, 80], scale: [8, 10], seed: 2 });
    const sc = buildScenery({ layers, timeOfDay: lk.tod, quality: quality === 'low' ? 'low' : 'medium', base: sceneryBase, seed: i + 1 });
    sc.group.visible = false; sc.group.rotation.y = Math.PI; scene.add(sc.group);
    cache.set(i, sc);
    sc.ready.then(() => { building = -1; if (L.look === i) { for (const [k, v] of cache) v.group.visible = k === i; } }).catch((e) => { building = -1; console.warn('scenery failed', e && e.message); sc.group.visible = true; });
    // keep memory modest: at most two looks in memory
    if (cache.size > 2) for (const [k, v] of cache) if (k !== i && cache.size > 2) { scene.remove(v.group); v.dispose?.(); cache.delete(k); }
  }

  // the sky photo's top is dark and flat at a phone's tall field of view: a clean zenith gradient dome (transparent towards the horizon) sits over it
  const dome = (() => {
    const g = new THREE.SphereGeometry(120, 32, 16, 0, TAU, 0, Math.PI / 2);
    const pa = g.attributes.position, col = new Float32Array(pa.count * 4);
    for (let i = 0; i < pa.count; i++) {
      const el = Math.asin(clamp(pa.getY(i) / 120, 0, 1));          // elevation, radians
      const a = sm((el - 0.1) / (0.56 - 0.1));
      col[i * 4 + 3] = a;
    }
    const m = new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false, toneMapped: false, side: THREE.BackSide });
    // vertex colours carry alpha in w; colour itself comes from the material colour (set per look) through white vertex rgb
    for (let i = 0; i < pa.count; i++) { col[i * 4] = 1; col[i * 4 + 1] = 1; col[i * 4 + 2] = 1; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    const mesh = new Mesh(g, m); mesh.renderOrder = -12; mesh.frustumCulled = false; scene.add(mesh);
    return mesh;
  })();
  function tuneSky(lk) { dome.material.color.set(lk.zen); }

  // ------------------------------------------------------------------------------------------------------------------------------ per-frame
  const V = { a: new Vector3(), b: new Vector3(), c: new Vector3(), d: new Vector3(), e: new Vector3(), f: new Vector3(), q: new Quaternion(), m: new Matrix4() };
  const st = {
    lastT: null, lastRunId: null, lastEv: -1, lastS: null, headRelX: 0, headRelZ: 0, speed: 0, px: null, pz: null, yaw: 0, yawV: 0, camPos: new Vector3(0, 2.3, 0), camQ: new Quaternion(),
    replay: 0, replayV: 0, pegFly: null, contactAt: -1, outcome: null, latV: 0, prevX3: null, hero: 0, roll: 0, pitch: 0, bobY: 0,
  };
  const zFwd = new Vector3(0, 0, 1), up = new Vector3(0, 1, 0);
  const jumpish = (f) => !!f;
  const between = (mesh, a, b, r0, r1) => {   // a tapered cylinder spanning a -> b (radius r0 at a, r1 at b)
    V.d.subVectors(b, a); const len = V.d.length() || 1e-4; V.d.divideScalar(len);
    mesh.position.addVectors(a, b).multiplyScalar(0.5); mesh.quaternion.setFromUnitVectors(up, V.d);
    mesh.scale.set(1, len, 1);
    return len;
  };

  /**
   * o: { W, H, cx, hor, F, k, pxs, look, s (run state or null), time, guide, mark:{z,x}, predict, pegZ, pegX, cam:'saddle'|'hero', replay: bool, heroT }
   * Returns true when the canvas holds a picture to blit over the full W x H.
   */
  L.render = (o) => {
    if (L.lost || stage.contextLost) return false;
    if (globalThis.__laneFree) { o = { ...o, cam: 'free', free: globalThis.__laneFree, heroY: o.H * (globalThis.__laneFree.y ?? 0.5) }; }
    const t0 = globalThis.performance ? performance.now() : 0;
    const s = o.s, W = o.W, H = o.H;
    const w = Math.max(64, Math.round(W * o.pxs)), h = Math.max(64, Math.round(H * o.pxs));
    if (canvas.width !== w || canvas.height !== h) { renderer.setPixelRatio(1); renderer.setSize(w, h, false); }
    setLook(clamp(o.look | 0, 0, LOOKS.length - 1));
    const lk = LOOKS[L.look] || LOOKS[1];

    // ---- time: the sim clock if it is running, real time while waiting at the line
    let dt = st.lastT === null ? 0 : o.time - st.lastT; st.lastT = o.time;
    if (!(dt >= 0) || dt > 0.25) dt = dt > 0.25 ? 1 / 30 : 0;
    const fresh = st.lastS !== s;
    if (fresh) { st.lastEv = s ? s.evId - 1 : -1; st.pegFly = null; st.outcome = null; st.px = null; st.contactAt = -1; st.replay = 0; st.replayV = 0; }
    st.lastS = s;
    const waiting = !s || s.phase === 'ready';
    const simAdv = s && s.phase !== 'ready' ? (s.t !== st.prevSimT) : false;
    st.prevSimT = s ? s.t : null;
    const animDt = waiting ? dt : (simAdv ? dt : 0);
    L.time += dt; U.time.value = L.time;
    const nowMs = globalThis.performance ? performance.now() : 0;
    const rdt = st.lastNow ? clamp((nowMs - st.lastNow) / 1000, 0, 0.05) : 0; st.lastNow = nowMs;

    // ---- where the rider's head is in the world (sim frame -> three.js frame: X3 = -x)
    const camSimX = s ? s.x - SIDE : (o.cam === 'hero' ? 0 : 0);
    // the sim's slow motion after a strike and its start-up change the speed in one tick; the displayed rider follows the sim through a velocity
    // low-pass plus a position correction, so the camera and the gait ease through those changes (the ring, the peg and the point stay on the sim)
    const zSim = (s ? s.z : 0) + 0.3, xSim = -(s ? s.x - SIDE : 0);
    if (st.zd === undefined || fresh || Math.abs(zSim - st.zd) > 6) { st.zd = zSim; st.vd = 0; st.xd = xSim; st.prevZs = zSim; st.prevXs = xSim; st.xdV = 0; }
    {
      const stepT = Math.max(dt, 1e-3);
      const vs = animDt > 0 ? (zSim - st.prevZs) / Math.max(animDt, 1e-3) : 0;
      st.prevZs = zSim;
      if (animDt > 0) {
        const aLP = 1 - Math.exp(-animDt / 0.14);
        st.vd += (vs - st.vd) * aLP;
        st.zd += st.vd * animDt + (zSim - st.zd) * (1 - Math.exp(-animDt * 5));
      } else { st.zd = zSim; st.vd = vs; }
      void stepT;
    }
    st.xd = xSim;
    const X3c = st.xd, Zc = st.zd;
    // speed from the displacement of the displayed rider (so legs move exactly as fast as the rider travels)
    if (st.px === null) { st.px = X3c; st.pz = Zc; st.speed = 0; st.yaw = 0; st.yawV = 0; }
    if (animDt > 0) {
      const mvx = (X3c - st.px) / animDt, mvz = (Zc - st.pz) / animDt;
      const sp = Math.hypot(mvx, mvz);
      st.speed += (sp - st.speed) * Math.min(1, animDt * 12);
      // facing follows the heading of the motion through a critically damped spring
      const hd = sp > 1.5 ? Math.atan2(mvx, mvz) : 0;
      const err = wrapA(hd - st.yaw), wn = 10;
      st.yawV += (wn * wn * err - 2 * wn * st.yawV) * animDt; st.yaw += st.yawV * animDt;
      st.latV += ((mvx - (st.lastMvx || 0)) / animDt - st.latV) * Math.min(1, animDt * 8); st.lastMvx = mvx;
    } else if (waiting) { st.speed *= 0.85; }
    st.px = X3c; st.pz = Zc;
    const hr = st.headRel || (st.headRel = new Vector3());
    const jump0 = st.rootX === undefined;
    // place the horse so the rider's head sits on the sim position (one frame behind: headRel is measured after the update)
    st.hrS = st.hrS || hr.clone();
    horse.root.position.set(X3c - st.hrS.x, 0, Zc - st.hrS.z);
    horse.root.rotation.y = st.yaw;
    // the gait runs at exactly the speed the rider is travelling over the ground (no acceleration limit of its own): planted feet cannot slide
    horse.drive(st.speed, clamp(st.yawV, -3.5, 3.5));
    if (!jump0) horse.v = st.speed;
    // the lance point (sim) and the carry pose when there is no run
    let tip;
    if (s) { const tp = tipPos(s); tip = new Vector3(-tp.x, tp.y, tp.z); }
    else if (o.cam === 'hero') tip = new Vector3(X3c - 0.7, 4.1 + Math.sin(L.time * 0.9) * 0.04, Zc + 1.5);   // parade carry: the lance upright
    else tip = new Vector3(X3c - 0.95, 1.2, Zc + 4.2);
    // lance grip target (from the head of the previous pass) so the right arm reaches for it inside the rider's update
    const camRight = V.a.set(-1, 0, 0), camDown = V.b.set(0, -1, 0);
    const setGrip = (hp) => {
      const S0 = new Vector3(hp.x - 0.25, hp.y - 0.42, hp.z + 0.4);
      const dir0 = new Vector3().subVectors(tip, S0).normalize();
      // the hand's orientation follows the lance direction through a short low-pass (the point drops 1.2 m in 0.3 s at the release)
      if (!st.dirS) st.dirS = dir0.clone(); else st.dirS.lerp(dir0, st.dirLP ?? 1).normalize();
      const dir = st.dirS;
      // palm on top of the shaft, fingers wrapping round it (hand3d.gripCylinder maths)
      const R = 0.019, fromV = new Vector3(0.25, 1, 0).normalize();
      const z = fromV.clone().addScaledVector(dir, -fromV.dot(dir)).normalize();
      const palmN = z.clone().negate();
      const fdir = new Vector3().crossVectors(z, dir).normalize();
      grip.wrist.copy(S0).addScaledVector(z, R + 0.022).addScaledVector(fdir, -0.035);
      grip.quat.copy(handQuat(human, 'R', palmN, fdir));
      grip.pole.copy(S0).addScaledVector(camRight, -0.28).addScaledVector(camDown, 0.4).addScaledVector(zFwd, -0.45);
      // left fist on the reins: low in front of the withers, thumb up, knuckles forward
      const LW = new Vector3(hp.x + 0.14, hp.y - 0.44, hp.z + 0.4);
      grip.lw.copy(LW);
      grip.lq.copy(handQuat(human, 'L', new Vector3(-1, 0.1, 0), new Vector3(0, -0.35, 1)));
      grip.lp.copy(LW).addScaledVector(camRight, 0.35).addScaledVector(camDown, 0.3).addScaledVector(zFwd, -0.45);
      grip.on = true;
    };
    st.dirLP = jumpish(fresh) ? 1 : 1 - Math.exp(-Math.max(dt, 1 / 120) / 0.07);
    setGrip(st.camPos);
    // ---- advance the horse and the rider (this runs human.update with the grip override), THEN read the posed bones.
    // A frozen sim (pause, Think) freezes the pose; when the rider was put somewhere new (a restart, a jump) it is brought along in a few tiny passes.
    const moved = st.rootX === undefined || Math.abs(horse.root.position.x - st.rootX) + Math.abs(horse.root.position.z - st.rootZ) > 1e-4;
    const headNow = () => { horse.root.updateMatrixWorld(true); human.root.updateMatrixWorld(true); return human.bones.Bip01_Head.getWorldPosition(V.c); };
    let stepped = false;
    const jump = st.rootX === undefined || Math.hypot(horse.root.position.x - st.rootX, horse.root.position.z - st.rootZ) > 1.2;
    if (jump) {   // put somewhere new: forget the motion history so hair, tack and gait do not see a fling
      horse.v = 0; horse.target.v = 0; horse.sm.vv = 0; horse._first = true; horse._prevVel.set(0, 0, 0); horse.sm.accel = 0;
      st.speed = 0; st.yawV = 0;
    }
    if (animDt > 0 && !jump) {
      // the sim rocks the rider sideways: planted feet must stay put on the ground, so each leg in stance is shifted against the body's sideways motion
      if (st.rpx !== undefined) {
        const dx = horse.root.position.x - st.rpx, dz = horse.root.position.z - st.rpz, cy = Math.cos(st.yaw), sy = Math.sin(st.yaw);
        const lx = dx * cy - dz * sy;
        if (Math.abs(lx) < 0.6) for (const Lg of horse.legs) if (Lg.stance) Lg.cx = (Lg.cx || 0) - lx;
      }
      horse.update(animDt); stepped = true;
    }
    if (!stepped && (moved || fresh || jump)) {
      for (let i = 0; i < 4; i++) {
        horse.update(jump ? 1 / 60 : 1 / 480);
        const h0 = headNow();
        hr.set(h0.x - horse.root.position.x, 0, h0.z - horse.root.position.z);
        st.hrS.copy(hr);
        horse.root.position.set(X3c - hr.x, 0, Zc - hr.z);
        setGrip(new Vector3(X3c, h0.y + 0.09, Zc + 0.1));
      }
      horse.update(1 / 480); stepped = true;
    }
    st.rootX = horse.root.position.x; st.rootZ = horse.root.position.z; st.rpx = st.rootX; st.rpz = st.rootZ;
    const hw = headNow();
    if (stepped) {
      hr.set(hw.x - horse.root.position.x, 0, hw.z - horse.root.position.z);
      // the placement offset follows slowly: the head keeps its natural bob and sway, the horse keeps a steady speed over the ground
      st.hrS.lerp(hr, jump ? 1 : 1 - Math.exp(-(animDt || 0.01) * 1.2));
    }
    const eye = new Vector3(hw.x, hw.y + 0.09, hw.z + 0.1);

    // ---- camera. Saddle: the rider's eyes, held level (a rider's head stays steady while the horse moves under it)
    st.bobY = spring(st, 'bobYs', eye.y, 40, animDt || 1e-4);
    const sway = spring(st, 'rollS', clamp(-st.latV * 0.0035, -0.05, 0.05), 6, dt || 1e-4);
    const sh = s ? s.shake : 0;
    const shk = sh > 0 ? Math.sin(L.time * 61) * 0.012 * sh : 0;
    st.camPos.set(eye.x, eye.y, eye.z);
    let camPos = V.e.set(eye.x + shk, eye.y + Math.cos(L.time * 53) * 0.008 * sh, eye.z);
    let yawC = st.yaw * 0.35, pitchC = 0, rollC = sway;
    let lookAt = null;
    // replay: a third-person cut after the contact (cut in/out through a critically damped blend)
    const wantReplay = !!(o.replay && s && s.outcome && s.phase === 'after' && s.t - s.contactT > 0.05 && s.t - s.contactT < 1.35 && o.cam !== 'hero');
    spring(st, 'replay', wantReplay ? 1 : 0, 9, rdt || 1e-4);
    const rp = clamp(st.replay, 0, 1);
    L.dbg = { wantReplay, dt, rp, replayOpt: o.replay, cam: o.cam, phase: s && s.phase, out: s && s.outcome };
    if (rp > 0.002) {
      const ch = human.bonePosition('Spine2', V.f);
      const rc = new Vector3(ch.x - 6.3, 1.4, ch.z + 2.2);
      const ta = new Vector3(ch.x - 0.5, 2.0, ch.z + 1.2);
      camPos = new Vector3().lerpVectors(eye, rc, sm(rp));
      lookAt = ta.clone();
    }
    let heroCamUsed = false;
    let Fuse = o.F;
    if (rp > 0.002) Fuse = lerp(o.F, o.F * 1.65, sm(rp));
    if (o.cam === 'hero') {
      // slow drift round the horse and rider in front of the stands: a three-quarter view from the lance side, framed to fill the hero window
      Fuse = o.F * 1.7;
      const hh = o.heroH || H * 0.3, dist = clamp(3.3 * Fuse / (0.92 * hh), 4.5, 6.4);
      const a = -0.62 + Math.sin(L.time * 0.16) * 0.14, tx = X3c - 0.1, tz = Zc + 0.15;
      camPos = new Vector3(tx + Math.sin(a) * dist, 1.55 + Math.sin(L.time * 0.21) * 0.07, tz + Math.cos(a) * dist);
      lookAt = new Vector3(tx, 1.85, tz);
      heroCamUsed = true;
    }
    if (o.cam === 'free' && o.free) { camPos = new Vector3(...o.free.pos); lookAt = new Vector3(...o.free.at); heroCamUsed = true; }
    hideHead(!(heroCamUsed || rp > 0.02));
    for (const f of fenceRight) f.visible = !(rp > 0.05);
    if (gate.userData.banner) gate.userData.banner.visible = !(rp > 0.05);
    cam.aspect = W / H;
    cam.fov = 2 * Math.atan(H / (2 * Fuse)) * 180 / Math.PI;
    if (o.cam === 'free' && o.free && o.free.fov) cam.fov = o.free.fov;
    cam.updateProjectionMatrix();
    const hor = o.cam === 'hero' || o.cam === 'free' ? (o.heroY ?? H * 0.5) : lerp(o.hor, H * 0.58, sm(rp));
    cam.projectionMatrix.elements[9] = 2 * hor / H - 1;
    cam.projectionMatrix.elements[8] = o.cam === 'hero' || o.cam === 'free' ? 1 - 2 * (o.heroX ?? W / 2) / W : 0;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    cam.position.copy(camPos);
    if (lookAt) {
      cam.up.set(0, 1, 0); cam.lookAt(lookAt);
      if (rp > 0.002 && !heroCamUsed) {
        // blend from the saddle orientation to the replay look-at (slerp so the cut is a glide)
        const qr = cam.quaternion.clone();
        const qs = new Quaternion().setFromEuler(new Euler(0, Math.PI, 0)).multiply(new Quaternion().setFromEuler(new Euler(pitchC, yawC, 0, 'YXZ')));
        cam.quaternion.copy(qs).slerp(qr, sm(rp));
      }
    } else {
      cam.quaternion.setFromEuler(new Euler(0, Math.PI, 0)).multiply(new Quaternion().setFromEuler(new Euler(pitchC, yawC, rollC, 'YXZ')));
    }
    cam.updateMatrixWorld(true);
    st.camQ.copy(cam.quaternion);

    // ---- lance: fixed to the palm, pointing at the sim's point, with flex
    {
      human.root.updateMatrixWorld(true);
      const palm = palmPoint(human, 'R');
      // the shaft passes through the palm; the point is the sim's point
      const G = V.f.copy(palm);
      const d2 = new Vector3().subVectors(tip, G).normalize();
      // vertical acceleration of the hand drives a lag in the tip (cantilever bend), bounded to a few centimetres
      const vy = st.prevY === null ? 0 : (G.y - lanceState.prevY) / Math.max(dt, 1e-3);
      const ay = lanceState.prevVy === undefined ? 0 : (vy - lanceState.prevVy) / Math.max(dt, 1e-3);
      lanceState.prevY = G.y; lanceState.prevVy = vy; st.prevY = G.y;
      if (dt > 0) {
        const target = clamp(-ay * 0.0016, -0.07, 0.07);
        const w = 22, e = Math.exp(-w * dt * 0.5);
        lanceState.flexV += (-(w * w) * (lanceState.flex - target) - 2 * 0.28 * w * lanceState.flexV) * Math.min(dt, 0.033);
        lanceState.flex += lanceState.flexV * Math.min(dt, 0.033);
        void e;
      }
      if (s && s.phase === 'after' && s.contactT >= 0) { const u = s.t - s.contactT; if (u > 0 && u < 0.05) lanceState.flexV += (s.outcome === 'lift' ? 1.6 : 0.8) * 0.5; }
      const butt = 0.95;
      const A = new Vector3().copy(G).addScaledVector(d2, -butt);
      const P = (u) => {        // point on the shaft, u = 0 butt .. 1 point; bend grows with the square of the distance past the hand
        const p = new Vector3().lerpVectors(A, tip, u);
        const past = Math.max(0, (u * (butt + G.distanceTo(tip)) - butt)) / Math.max(0.5, G.distanceTo(tip));
        const grounded = s && s.phase === 'drop' ? 0.2 : 1;
        p.y += lanceState.flex * past * past * grounded;
        return p;
      };
      const total = butt + G.distanceTo(tip);
      for (let i = 0; i < NSEG; i++) {
        const u0 = i / NSEG * 0.93, u1 = (i + 1) / NSEG * 0.93;
        const a = P(u0), b = P(u1);
        const len = between(shaftSegs[i], a, b);
        const r0 = lerp(0.021, 0.0125, u0 / 0.93), r1 = lerp(0.021, 0.0125, u1 / 0.93);
        shaftSegs[i].scale.set(r0 * 0.5 + r1 * 0.5, len, r0 * 0.5 + r1 * 0.5);
        shaftSegs[i].material.map.repeat.set(1, total / NSEG / 0.32);
      }
      const sp0 = P(0.93), tipP = P(1);
      const sd = new Vector3().subVectors(tipP, sp0).normalize();
      spear.position.copy(sp0); spear.quaternion.setFromUnitVectors(up, sd); spear.scale.setScalar(1.15);
      collar.position.copy(sp0); collar.quaternion.copy(spear.quaternion);
      gripWrap.position.copy(G); gripWrap.quaternion.setFromUnitVectors(up, d2);
      buttCap.position.copy(A);
      // pennon under the point, streaming back
      const pp = P(0.86);
      pennon.position.copy(pp); V.m.lookAt(new Vector3(), d2.clone().negate(), up); pennon.quaternion.setFromRotationMatrix(V.m);
      pennon.rotateY(Math.PI / 2); pennon.rotateZ(Math.PI / 2 * 0);
      lanceSpeed.value = s ? s.v : 0;
    }

    // ---- peg, ring, mat, marker, gate
    const pegZ = o.pegZ || 56, pegX3 = -(o.pegX || 0);
    gate.position.set(0, 0, pegZ - 0.5); gate.visible = !!s || o.cam === 'hero' ? true : true;
    mat.position.set(pegX3, 0.03, pegZ);
    for (const w of stewards) { w.h.root.position.set(w.sx * 4.1, 0, pegZ + (w.sx > 0 ? 1.6 : -1.2)); w.h.update(dt || 1 / 60); }
    marker.position.set(pegX3 + 1.15, 0, pegZ + 0.3); marker.rotation.y = 0.3;
    {
      const u = s && s.outcome ? s.t - s.contactT : -1;
      let shown = true, px = pegX3, py = PEG_SIZE * 0.625, pz = pegZ, rot = 0, rotZ = 0;
      if (s && s.outcome && s.phase === 'after' && u >= 0) {
        if (s.outcome === 'lift') {
          // the peg rides the lance point, spearing it through the middle, spinning slowly
          const sp = lance.children.length ? spear.position : null;
          if (sp) { px = tip.x; py = Math.max(0.05, tip.y + 0.06); pz = tip.z; rot = u * 3.2; rotZ = 0.35; }
          hole.visible = true; hole.position.set(pegX3, 0.04, pegZ);
        } else if (s.outcome === 'strike') {
          const pg = s.peg, g = 9.8, uu = Math.min(u, 1.4);
          py = Math.max(PEG_SIZE * 0.55, 0.1 + pg.vy * u - 0.5 * g * u * u); pz = pegZ + pg.vz * uu; px = pegX3 - pg.vx * uu * 0.5;
          rot = u * pg.spin * 0.4; rotZ = u * pg.spin * 0.25;
          hole.visible = true; hole.position.set(pegX3, 0.04, pegZ);
        }
      } else hole.visible = false;
      peg.visible = shown; peg.position.set(px, py, pz); peg.rotation.set(rotZ, rot, rotZ * 0.5);
      // the contact: a puff, a clod and ribbons, once per run
      if (s && s.outcome && s.contactT >= 0 && st.contactAt !== s.contactT) {
        st.contactAt = s.contactT;
        const ox = pegX3, oz = pegZ;
        const lift = s.outcome === 'lift', miss = s.outcome === 'miss';
        for (let i = 0; i < (miss ? 5 : 9); i++) {
          const a = hash(i + 5) * TAU, r = 0.15 + hash(i + 9) * 0.35;
          puff(ox + Math.cos(a) * r * 0.5, 0.08, oz + Math.sin(a) * r * 0.5, Math.cos(a) * (0.5 + hash(i) * 0.9), 0.5 + hash(i + 2) * 0.9, Math.sin(a) * 0.6 - 1.0, 0.18, miss ? 0.55 : 0.9, 1.1, miss ? 0.5 : 0.7, 0xe3cfa6);
        }
        if (!miss) for (let i = 0; i < 8; i++) {
          const c = clods.find((q) => q.life <= 0); if (!c) break;
          c.x = ox; c.y = 0.05; c.z = oz; c.vx = (hash(i + 11) - 0.5) * 2.4; c.vy = 2.2 + hash(i + 12) * 2.4; c.vz = 1.2 + hash(i + 13) * 3.0 - (lift ? 0 : 0); c.s = 0.018 + hash(i + 14) * 0.03; c.life = 1.5; c.wx = (hash(i) - 0.5) * 20; c.wy = (hash(i + 1) - 0.5) * 20;
        }
        if (s.perfect) for (let i = 0; i < RIB; i++) {
          const r = ribbons[i]; r.x = tip.x; r.y = tip.y + 0.2; r.z = tip.z; const a = hash(i + 30) * TAU;
          r.vx = Math.cos(a) * (0.8 + hash(i + 31) * 2.2); r.vy = 3.4 + hash(i + 32) * 3; r.vz = Math.sin(a) * (0.8 + hash(i + 33) * 2.2) + (s.v || 0) * 0.6; r.life = 0; r.max = 1.7 + hash(i + 34) * 0.6; r.r = hash(i) * TAU; r.w = (hash(i + 2) - 0.5) * 18;
        }
        if (L.crowd) {
          if (lift) L.crowd.react(s.perfect ? 'ovation' : 'cheer', { origin: [tip.x, 0, tip.z], radius: 70, intensity: s.perfect ? 1 : 0.8 });
          else if (s.outcome === 'strike') L.crowd.react('wave', { origin: [tip.x, 0, tip.z], radius: 60, intensity: 0.6 });
          else L.crowd.react('groan', { origin: [tip.x, 0, tip.z], radius: 60, intensity: 0.7 });
        }
      }
      // ring
      const showRing = s && o.guide <= 1 && (s.phase === 'ride' || s.phase === 'ready' || s.phase === 'drop');
      ring.visible = !!showRing;
      if (showRing) {
        let rz, rx;
        if (s.phase === 'drop') { rz = s.zcP; rx = s.xcP; } else { rz = o.mark.z; rx = o.mark.x; }
        ring.position.set(-rx, 0.05, rz);
        const col = o.guide === 0 ? (o.predict === 'lift' ? 0x6dff9a : o.predict === 'strike' ? 0xffd45a : 0xffffff) : 0xffffff;
        ringMat.color.setHex(col);
        const pulse = 1 + Math.sin(L.time * 6) * 0.04;
        ring.scale.set(pulse, 1, pulse);
      }
    }

    // ---- particles
    for (const d of dust) {
      if (d.life >= d.max && !d.sp.visible) continue;
      d.life += dt;
      if (d.life >= d.max) { d.sp.visible = false; continue; }
      const k = d.life / d.max;
      d.sp.position.x += d.vx * dt; d.sp.position.y += d.vy * dt * (1 - k); d.sp.position.z += d.vz * dt;
      d.sp.scale.setScalar(lerp(d.s0, d.s1, k));
      d.sp.material.opacity = d.a * (1 - k) * (k < 0.1 ? k / 0.1 : 1);
    }
    clods.forEach((c, i) => {
      if (c.life > 0) {
        c.life -= dt; c.vy -= 9.8 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
        if (c.y < 0.02) { c.y = 0.02; c.vy *= -0.25; c.vx *= 0.5; c.vz *= 0.5; }
        c.rx += c.wx * dt; c.ry += c.wy * dt;
        dummy.position.set(c.x, c.y, c.z); dummy.rotation.set(c.rx, c.ry, 0); dummy.scale.setScalar(c.s); dummy.updateMatrix(); clodM.setMatrixAt(i, dummy.matrix);
      } else { dummy.position.set(0, -9, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix(); clodM.setMatrixAt(i, dummy.matrix); }
    });
    clodM.instanceMatrix.needsUpdate = true;
    ribbons.forEach((r, i) => {
      if (r.life < r.max) {
        r.life += dt; r.vy -= 5.2 * dt; r.vx *= 1 - 0.8 * dt; r.vz *= 1 - 0.4 * dt; r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt; r.r += r.w * dt;
        if (r.y < 0.02) { r.y = 0.02; r.vy = 0; r.vx = 0; r.vz = 0; r.w = 0; }
        dummy.position.set(r.x, r.y, r.z); dummy.rotation.set(r.r, r.r * 0.7, r.r * 0.3); dummy.scale.setScalar(clamp((r.max - r.life) * 2.5, 0, 1)); dummy.updateMatrix(); ribbonMesh.setMatrixAt(i, dummy.matrix);
      } else { dummy.position.set(0, -9, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix(); ribbonMesh.setMatrixAt(i, dummy.matrix); }
    });
    ribbonMesh.instanceMatrix.needsUpdate = true;

    // ---- crowd (audience reacts on contact) and the scenery
    if (L.crowd) { L.crowd.setExcitement(clamp(0.25 + (s && s.outcome === 'lift' ? 0.5 : 0), 0, 1)); L.crowd.update(dt); }
    const sc = cache.get(L.look); if (sc) sc.update(dt, { position: { x: -cam.position.x, y: cam.position.y, z: -cam.position.z } });   // the scenery group is turned half a circle so its seam sits behind us
    stage.setShadowTarget(horse.root.position.x, 0, horse.root.position.z + 2);
    dome.position.set(cam.position.x, cam.position.y, cam.position.z);
    renderer.render(scene, cam);
    L.ready = true;
    if (t0) {
      const ms = performance.now() - t0; L.cost.ema = L.cost.n ? L.cost.ema * 0.93 + ms * 0.07 : ms; L.cost.n++;
    }
    // quality tiers: a device that cannot hold ~30 fps drops to the low tier (no shadows, fewer people, simpler hair, 1x pixels), and a device that
    // still cannot keeps the painted lane instead
    if (rdt > 0 && !(s && s.phase === 'ready' && false)) {
      st.fEma = st.fEma ? st.fEma * 0.96 + rdt * 0.04 : rdt; st.fN = (st.fN || 0) + 1;
      if (st.fN > 150 && st.fEma > 0.036 && L.tier !== 'low') { L.tier = 'low'; try { stage.setQuality('low'); L.crowd && L.crowd.setQuality('low'); horse.setQuality('low'); } catch { /* keep going */ } L.pxsCap = 1; st.fN = 0; st.fEma = 0.016; }
      else if (st.fN > 240 && st.fEma > 0.06 && L.tier === 'low') { L.lost = true; }
    }
    return true;
  };

  // screen position (in the 2D layout's virtual units) of a sim world point; used by the HUD for the distance label
  L.project = (x, y, z, W, H) => {
    const v = new Vector3(-x, y, z).project(cam);
    if (v.z > 1 || v.z < -1) return null;
    return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, sc: 1, d: z };
  };
  L.grip = grip; L.st = st; L.gate = gate; L.marker = marker; L.horse = horse; L.human = human; L.dress = dress; L.scene = scene; L.setLook = setLook; L.LOOKS = LOOKS;
  return L;
}

// The 3D world: sky, displaced animated water (waves, wakes, foam, fast-stream streaks), river banks with trees and a cheering
// crowd, lane buoy lines, start and finish gantries, flotsam, spray. Pure presentation: it only READS the state the game publishes.
// Units are metres, the same as the simulation (x across the river, z down the course).
import { THREE } from '../vendor3d/index.js';

const T = THREE;
const doc = globalThis.document;
const mk = (w, h) => { const c = doc.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, { repeat = false, aniso = 4, srgb = true } = {}) => {
  const t = new T.CanvasTexture(c);
  if (srgb) t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
  return t;
};
let seed = 20241008;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const rr = (a, b) => a + (b - a) * rand();

// ---- themes (times of day) ----------------------------------------------------------------------------------------
const LOOK = {
  day: { top: '#3f8fd8', mid: '#9fd0ee', hor: '#e9f3f6', sun: [0.55, 0.62, -0.55], sunCol: 0xfff1d0, sunI: 1.9, hemiSky: 0xbfe0ff, hemiGnd: 0x4a6a40, hemiI: 0.5, fog: 0xcfe6f2, fogN: 90, fogF: 380, expo: 1.0, env: 0.6, stars: 0, lights: 0 },
  evening: { top: '#3b3f86', mid: '#e58a62', hor: '#ffd29a', sun: [-0.6, 0.22, -0.7], sunCol: 0xffb070, sunI: 1.7, hemiSky: 0xffb890, hemiGnd: 0x3a3a50, hemiI: 0.45, fog: 0xe8b08a, fogN: 70, fogF: 340, expo: 1.0, env: 0.55, stars: 0.15, lights: 0.6 },
  night: { top: '#06102a', mid: '#162e5c', hor: '#3a5a92', sun: [0.4, 0.5, -0.6], sunCol: 0xa8c0ff, sunI: 1.5, hemiSky: 0x7f9ae0, hemiGnd: 0x2a3a4a, hemiI: 0.95, fog: 0x1e3560, fogN: 60, fogF: 320, expo: 1.2, env: 0.8, stars: 1, lights: 1 },
};

function skyTexture(look) {
  const [c, g] = mk(8, 512);
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, look.top); gr.addColorStop(0.46, look.mid); gr.addColorStop(0.5, look.hor); gr.addColorStop(0.54, look.mid); gr.addColorStop(1, look.top);
  g.fillStyle = gr; g.fillRect(0, 0, 8, 512);
  return tex(c, { srgb: true });
}
function backdropTexture(kind, look) {
  const [c, g] = mk(2048, 256);
  g.clearRect(0, 0, 2048, 256);
  const night = kind === 'night', eve = kind === 'evening';
  const far = night ? '#0c1830' : eve ? '#6a5a7c' : '#8fb0c4', near = night ? '#08111f' : eve ? '#4a4660' : '#6f9a88';
  // far hills
  g.fillStyle = far; g.beginPath(); g.moveTo(0, 256);
  for (let x = 0; x <= 2048; x += 16) g.lineTo(x, 150 - 40 * Math.sin(x * 0.0047 + 1) - 22 * Math.sin(x * 0.013) - 12 * Math.sin(x * 0.04 + 2));
  g.lineTo(2048, 256); g.fill();
  // near hills
  g.fillStyle = near; g.beginPath(); g.moveTo(0, 256);
  for (let x = 0; x <= 2048; x += 12) g.lineTo(x, 190 - 26 * Math.sin(x * 0.0062 + 3) - 12 * Math.sin(x * 0.021));
  g.lineTo(2048, 256); g.fill();
  // roof-line skyline with pagoda tiers
  g.fillStyle = night ? '#050a14' : eve ? '#2d2840' : '#4f6a66';
  for (let i = 0; i < 26; i++) {
    const x = rr(0, 2048), w = rr(26, 70), h = rr(24, 60), y = 236 - h;
    g.fillRect(x, y, w, h + 30);
    if (rand() < 0.4) { for (let t = 0; t < 3; t++) { const tw = w * (1.25 - t * 0.28); g.beginPath(); g.moveTo(x + w / 2 - tw / 2 - 5, y - t * 14 + 2); g.quadraticCurveTo(x + w / 2, y - t * 14 - 12, x + w / 2 + tw / 2 + 5, y - t * 14 + 2); g.lineTo(x + w / 2 + tw / 2, y - t * 14 + 7); g.lineTo(x + w / 2 - tw / 2, y - t * 14 + 7); g.fill(); } }
    if (night || eve) { for (let k = 0; k < 7; k++) { g.fillStyle = `rgba(255,${200 + rr(0, 40)},${120 + rr(0, 60)},${0.5 + rr(0, 0.5)})`; g.fillRect(x + rr(3, w - 6), y + rr(6, h + 20), 3, 4); } g.fillStyle = night ? '#050a14' : '#2d2840'; }
  }
  return tex(c);
}
function starsTexture() {
  const [c, g] = mk(1024, 512);
  for (let i = 0; i < 520; i++) { const a = rr(0.3, 1); g.fillStyle = `rgba(255,255,255,${a})`; const s = rand() < 0.1 ? 2.2 : 1.2; g.fillRect(rr(0, 1024), rr(0, 250), s, s); }
  return tex(c);
}
function glowTexture() {
  const [c, g] = mk(64, 64);
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,0.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return tex(c);
}
function bannerTexture(text, a, b, fg = '#fff', w = 1024, h = 160) {
  const [c, g] = mk(w, h);
  const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, a); gr.addColorStop(1, b);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,225,140,0.95)'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = fg; g.font = `800 ${h * 0.62}px "Barlow Condensed", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h * 0.54);
  return tex(c);
}
function checkerTexture() {
  const [c, g] = mk(512, 64);
  for (let x = 0; x < 32; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#101820' : '#f4f6f8'; g.fillRect(x * 16, y * 16, 16, 16); }
  return tex(c, { repeat: true });
}
function personTexture() {
  const [c, g] = mk(64, 128);
  g.clearRect(0, 0, 64, 128);
  g.fillStyle = '#fff'; g.beginPath(); g.ellipse(32, 24, 12, 14, 0, 0, 6.3); g.fill();
  g.beginPath(); g.moveTo(10, 128); g.quadraticCurveTo(8, 50, 32, 42); g.quadraticCurveTo(56, 50, 54, 128); g.fill();
  return tex(c);
}

// ---- water --------------------------------------------------------------------------------------------------------
function makeWater(look, themeWater) {
  const geo = new T.PlaneGeometry(260, 420, 130, 260); geo.rotateX(-Math.PI / 2);
  const mat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.12, metalness: 0.0, envMapIntensity: 0.5 });
  const U = {
    uTime: { value: 0 }, uBoats: { value: [new T.Vector4(0, 0, 0, 0), new T.Vector4(0, 0, 0, 0), new T.Vector4(0, 0, 0, 0), new T.Vector4(0, 0, 0, 0)] },
    uStreams: { value: Array.from({ length: 6 }, () => new T.Vector4(0, -9999, 0, 0)) },
    uDeep: { value: new T.Color().setRGB(themeWater[0] * 0.55, themeWater[1] * 0.55, themeWater[2] * 0.6) },
    uShallow: { value: new T.Color().setRGB(themeWater[0] * 1.5, themeWater[1] * 1.45, themeWater[2] * 1.3) },
    uFoam: { value: new T.Color(0xf4fbff) }, uLaneX: { value: 0 },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    const WAVES = `
      uniform float uTime;
      varying vec3 vWorld;
      void addW(vec2 p, vec2 d, float k, float a, float sp, inout float h, inout vec2 g){ float ph = dot(p, d) * k + uTime * sp; h += a * sin(ph); g += a * k * cos(ph) * d; }
      void waveField(vec2 p, out float h, out vec2 g){
        h = 0.0; g = vec2(0.0);
        addW(p, normalize(vec2(0.3, 1.0)), 0.55, 0.055, 1.3, h, g);
        addW(p, normalize(vec2(-0.5, 1.0)), 0.9, 0.035, 1.9, h, g);
        addW(p, normalize(vec2(0.9, 0.4)), 1.7, 0.016, 2.6, h, g);
        addW(p, normalize(vec2(-0.8, 0.5)), 2.9, 0.009, 3.4, h, g);
        addW(p, normalize(vec2(0.1, 1.0)), 0.28, 0.07, 0.8, h, g);
      }`;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + WAVES)
      .replace('#include <beginnormal_vertex>', `vec3 wp0 = (modelMatrix * vec4(position, 1.0)).xyz; float hh; vec2 gg; waveField(wp0.xz, hh, gg);
        vec3 objectNormal = normalize(vec3(-gg.x, 1.0, -gg.y));
        #ifdef USE_TANGENT
        vec3 objectTangent = vec3(tangent.xyz);
        #endif`)
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position); transformed.y += hh; vWorld = vec3(wp0.x, hh, wp0.z);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
      uniform float uTime; uniform vec4 uBoats[4]; uniform vec4 uStreams[6]; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam;
      varying vec3 vWorld;
      float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash21(i), hash21(i + vec2(1,0)), f.x), mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), f.x), f.y); }
      float wakeOf(vec2 p, vec4 b){
        vec2 d = p - b.xy; float c = cos(b.z), s = sin(b.z);
        vec2 fwd = vec2(s, c), rgt = vec2(c, -s);
        float al = dot(d, fwd), ac = dot(d, rgt);
        float v = clamp(b.w / 7.0, 0.0, 1.6);
        float n = vnoise(p * 1.6 + vec2(0.0, -uTime * 0.6)) * 0.7 + vnoise(p * 4.1 + uTime * 0.3) * 0.3;
        float hull = smoothstep(7.2, 6.0, abs(al)) * smoothstep(1.5, 0.75, abs(ac)) * 0.55;
        float back = -al - 5.8;
        float trail = step(0.0, back) * exp(-back / (16.0 + 12.0 * v)) * smoothstep(1.5 + 0.12 * back, 0.1, abs(ac)) * smoothstep(0.2, 0.7, n + 0.25) * v;
        float wedge = step(0.0, -al + 4.0) * exp(-(-al + 4.0) / (30.0 + 20.0 * v)) * smoothstep(0.55, 0.0, abs(abs(ac) - (0.9 + 0.2 * (-al + 4.0)))) * smoothstep(0.3, 0.8, n) * 0.55 * v;
        float bow = smoothstep(2.0, 0.0, abs(al - 7.0)) * smoothstep(1.7, 0.2, abs(ac)) * 0.7 * v * smoothstep(0.35, 0.75, n + 0.2);
        return clamp(hull * (0.5 + 0.5 * n) + trail + wedge + bow, 0.0, 1.0);
      }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec2 q = vWorld.xz * 2.2; float n1 = vnoise(q + vec2(uTime * 0.7, 0.0)), n2 = vnoise(q * 1.9 - vec2(0.0, uTime * 0.9)); normal = normalize(normal + 0.09 * vec3(n1 - 0.5, 0.0, n2 - 0.5)); }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.55, clamp(foam, 0.0, 1.0));`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float foam = 0.0;
        for (int i = 0; i < 4; i++) { if (uBoats[i].w > -0.5) foam = max(foam, wakeOf(vWorld.xz, uBoats[i])); }
        float streak = 0.0;
        for (int i = 0; i < 6; i++) {
          vec4 st = uStreams[i];
          float inside = smoothstep(st.w * 0.5, st.w * 0.5 - 1.4, abs(vWorld.x - st.x)) * smoothstep(st.y - 1.0, st.y + 6.0, vWorld.z) * smoothstep(st.z + 1.0, st.z - 6.0, vWorld.z);
          float line = smoothstep(0.84, 1.0, sin(vWorld.x * 2.9 + sin(vWorld.z * 0.17) * 1.6)) * (0.45 + 0.55 * sin(vWorld.z * 0.95 - uTime * 7.0));
          float soft = 0.22 + 0.18 * vnoise(vec2(vWorld.x * 0.8, vWorld.z * 0.25 - uTime * 2.2));
          streak = max(streak, inside * (line * 0.9 + soft));
        }
        float depthMix = 0.5 + 0.5 * vnoise(vWorld.xz * 0.22 + vec2(uTime * 0.03, 0.0));
        vec3 wcol = mix(uDeep, uShallow, depthMix * 0.55 + 0.1 * vnoise(vWorld.xz * 1.3 + uTime * 0.2));
        wcol = mix(wcol, uFoam, clamp(foam, 0.0, 1.0) * 0.92);
        wcol += vec3(0.35, 0.55, 0.62) * streak * 0.55;
        diffuseColor.rgb = wcol;`);
  };
  const mesh = new T.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.receiveShadow = false;
  return { mesh, U, mat };
}

// ---- the arena ------------------------------------------------------------------------------------------------------
export function buildArena(renderer, quality, course) {
  const kind = course.time || 'day';
  const look = LOOK[kind];
  const scene = new T.Scene();
  scene.fog = new T.Fog(look.fog, look.fogN, look.fogF);
  scene.background = new T.Color(look.fog);
  const A = { scene, look, course, kind, len: course.len, parts: [], rings: [], dyn: [] };
  const hiQ = quality !== 'low';

  // sky dome + environment lighting from the same gradient
  const skyTex = skyTexture(look);
  const skyMat = new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, fog: false, depthWrite: false });
  const sky = new T.Mesh(new T.SphereGeometry(900, 24, 16), skyMat); sky.renderOrder = -10; scene.add(sky);
  A.sky = sky;
  const glowT = glowTexture();
  const sunDir = new T.Vector3(...look.sun).normalize();
  const sunSprite = new T.Sprite(new T.SpriteMaterial({ map: glowT, color: look.sunCol, fog: false, depthWrite: false, blending: T.AdditiveBlending, transparent: true, opacity: kind === 'night' ? 0.55 : 0.9 }));
  sunSprite.scale.set(kind === 'day' ? 160 : 220, kind === 'day' ? 160 : 220, 1); sunSprite.position.copy(sunDir).multiplyScalar(820); scene.add(sunSprite);
  A.sun = sunSprite;
  if (look.stars) {
    const st = new T.Mesh(new T.SphereGeometry(880, 16, 12), new T.MeshBasicMaterial({ map: starsTexture(), side: T.BackSide, transparent: true, opacity: look.stars, fog: false, depthWrite: false }));
    st.renderOrder = -9; scene.add(st);
  }
  {
    const envScene = new T.Scene();
    envScene.add(new T.Mesh(new T.SphereGeometry(50, 24, 16), new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide })));
    const sun = new T.Mesh(new T.SphereGeometry(5, 12, 8), new T.MeshBasicMaterial({ color: new T.Color(look.sunCol).multiplyScalar(kind === 'night' ? 3 : 8) }));
    sun.position.copy(sunDir).multiplyScalar(42); envScene.add(sun);
    const pm = new T.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(envScene, 0.015).texture;
    scene.environmentIntensity = look.env;
    pm.dispose();
  }
  // distant hills and skyline ring
  const ringTex = backdropTexture(kind, look);
  const ring = new T.Mesh(new T.CylinderGeometry(560, 560, 130, 48, 1, true), new T.MeshBasicMaterial({ map: ringTex, side: T.BackSide, transparent: true, fog: false, depthWrite: false }));
  ring.position.y = 44; ring.renderOrder = -8; scene.add(ring); A.ring = ring;

  // lights
  const hemi = new T.HemisphereLight(look.hemiSky, look.hemiGnd, look.hemiI); scene.add(hemi);
  const sun = new T.DirectionalLight(look.sunCol, look.sunI);
  sun.position.copy(sunDir).multiplyScalar(60);
  if (quality !== 'low') {
    sun.castShadow = true; const s = quality === 'high' ? 2048 : 1024;
    sun.shadow.mapSize.set(s, s); const c = sun.shadow.camera; c.left = -15; c.right = 15; c.top = 15; c.bottom = -15; c.near = 1; c.far = 140; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  }
  scene.add(sun); scene.add(sun.target); A.dirLight = sun; A.sunDir = sunDir;

  // water
  const water = makeWater(look, course.water);
  scene.add(water.mesh); A.water = water;

  // river bed far below (hides the clear edge of the water plane) and the banks
  const bankMat = new T.MeshStandardMaterial({ color: course.bank, roughness: 0.95, metalness: 0 });
  const len = course.len, mid = len / 2, span = len + 520;
  for (const sd of [-1, 1]) {
    const b = new T.Mesh(new T.BoxGeometry(80, 3.2, span), bankMat); b.position.set(sd * (14.2 + 40), -1.6 + 0.35, mid); b.receiveShadow = false; scene.add(b);
    // a stone/timber kerb along the water
    const kerb = new T.Mesh(new T.BoxGeometry(0.9, 1.0, span), new T.MeshStandardMaterial({ color: kind === 'night' ? 0x3a3f4a : 0x8f8b80, roughness: 0.85 })); kerb.position.set(sd * 14.3, -0.12, mid); scene.add(kerb);
  }
  const farWater = new T.Mesh(new T.PlaneGeometry(1600, 1600), new T.MeshBasicMaterial({ color: new T.Color(course.water[0] * 0.9, course.water[1] * 0.9, course.water[2] * 0.9), fog: true })); farWater.rotation.x = -Math.PI / 2; farWater.position.set(0, -0.5, mid); scene.add(farWater);

  // trees
  {
    const trunk = new T.CylinderGeometry(0.16, 0.24, 2.4, 6), crown = new T.SphereGeometry(1.6, 8, 6);
    const n = hiQ ? 220 : 120;
    const tm = new T.InstancedMesh(trunk, new T.MeshStandardMaterial({ color: 0x5b4330, roughness: 0.9 }), n);
    const cm = new T.InstancedMesh(crown, new T.MeshStandardMaterial({ color: kind === 'night' ? 0x1d3a2a : kind === 'evening' ? 0x4b6a3a : 0x3f8a3c, roughness: 0.85 }), n);
    const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), pos = new T.Vector3();
    for (let i = 0; i < n; i++) {
      const sd = i % 2 ? 1 : -1, x = sd * rr(17, 36), z = rr(-120, len + 160), s = rr(0.8, 1.6);
      pos.set(x, 1.0 * s, z); sc.set(s, s, s); m4.compose(pos, q, sc); tm.setMatrixAt(i, m4);
      pos.set(x, 3.1 * s, z); sc.set(s * rr(1, 1.5), s * rr(0.9, 1.3), s * rr(1, 1.5)); m4.compose(pos, q, sc); cm.setMatrixAt(i, m4);
    }
    scene.add(tm); scene.add(cm);
  }
  // lane buoy lines
  {
    const spacing = 8, per = Math.ceil((len + 40) / spacing);
    const lines = [-10, -5, 0, 5, 10];
    const geo = new T.SphereGeometry(0.2, 10, 8);
    const mats = [new T.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.4 }), new T.MeshStandardMaterial({ color: 0xe03a2e, roughness: 0.4 })];
    const white = new T.InstancedMesh(geo, mats[0], lines.length * per), red = new T.InstancedMesh(geo, mats[1], lines.length * per);
    const m4 = new T.Matrix4(); let iw = 0, ir = 0;
    lines.forEach((x) => { for (let k = 0; k < per; k++) { const z = -20 + k * spacing; m4.makeTranslation(x, 0.02, z); if (k % 4 === 0) red.setMatrixAt(ir++, m4); else white.setMatrixAt(iw++, m4); } });
    white.count = iw; red.count = ir; scene.add(white); scene.add(red);
    // ropes: thin dark line under the buoys
    for (const x of lines) { const rope = new T.Mesh(new T.BoxGeometry(0.04, 0.03, len + 40), new T.MeshBasicMaterial({ color: 0x20303a })); rope.position.set(x, 0.0, len / 2 - 0); scene.add(rope); }
  }

  // start and finish gantries, distance flags
  {
    const post = new T.MeshStandardMaterial({ color: 0xd9a233, roughness: 0.45, metalness: 0.4 });
    const makeGantry = (z, text, a, b) => {
      const g = new T.Group();
      for (const sx of [-1, 1]) { const p = new T.Mesh(new T.CylinderGeometry(0.22, 0.28, 8, 10), post); p.position.set(sx * 14.8, 3.7, 0); g.add(p); const ball = new T.Mesh(new T.SphereGeometry(0.4, 10, 8), new T.MeshStandardMaterial({ color: 0xc8282a, roughness: 0.4 })); ball.position.set(sx * 14.8, 7.9, 0); g.add(ball); }
      const beam = new T.Mesh(new T.BoxGeometry(30, 0.5, 0.5), post); beam.position.set(0, 7.5, 0); g.add(beam);
      const tx = bannerTexture(text, a, b), bm = new T.MeshBasicMaterial({ map: tx });
      for (const ry of [0, Math.PI]) { const ban = new T.Mesh(new T.PlaneGeometry(26, 2.6), bm); ban.rotation.y = ry; ban.position.set(0, 6.0, ry ? 0.02 : -0.02); g.add(ban); }
      g.position.z = z; scene.add(g); return g;
    };
    makeGantry(0, 'START', '#b3202a', '#e0653a');
    const fin = makeGantry(len, 'FINISH', '#101820', '#2b3a4c');
    // checkered line on the water
    const ct = checkerTexture(); ct.repeat.set(1, 1);
    const line = new T.Mesh(new T.PlaneGeometry(24.6, 1.2), new T.MeshBasicMaterial({ map: ct, transparent: true, opacity: 0.9 })); line.rotation.x = -Math.PI / 2; line.position.set(0, 0.06, len); scene.add(line);
    const sline = new T.Mesh(new T.PlaneGeometry(24.6, 0.5), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })); sline.rotation.x = -Math.PI / 2; sline.position.set(0, 0.06, 0); scene.add(sline);
    // distance flags every 100 m on both banks
    const flagGeo = new T.PlaneGeometry(1.7, 1.0), poleGeo = new T.CylinderGeometry(0.05, 0.05, 4, 6);
    for (let d = 100; d < len; d += 100) for (const sd of [-1, 1]) {
      const pole = new T.Mesh(poleGeo, post); pole.position.set(sd * 13.4, 2, d); scene.add(pole);
      const fl = new T.Mesh(flagGeo, new T.MeshBasicMaterial({ map: bannerTexture(`${d}`, '#1b4fa0', '#2d78d0', '#fff', 256, 150), side: T.DoubleSide })); fl.position.set(sd * 13.4 - sd * 0.9, 3.4, d); fl.rotation.y = Math.PI / 2; scene.add(fl);
    }
    // bunting along both banks: strings of little triangles
    const buntCols = [0xe03a2e, 0xf5c542, 0x2d78d0, 0xf4f4f0, 0x3fae5a];
    const tri = new T.BufferGeometry(); tri.setAttribute('position', new T.Float32BufferAttribute([-0.22, 0, 0, 0.22, 0, 0, 0, -0.5, 0], 3)); tri.computeVertexNormals();
    const nb = Math.ceil(len / 3.2) + 20;
    for (const sd of [-1, 1]) {
      const im = new T.InstancedMesh(tri, new T.MeshBasicMaterial({ side: T.DoubleSide, vertexColors: false, color: 0xffffff }), nb);
      const m4 = new T.Matrix4(), col = new T.Color();
      for (let k = 0; k < nb; k++) { const z = -30 + k * 3.2, sag = Math.sin(((k % 6) / 6) * Math.PI) * 0.6; m4.makeTranslation(sd * 13.2, 5.1 - sag, z); im.setMatrixAt(k, m4); col.setHex(buntCols[k % buntCols.length]); im.setColorAt(k, col); }
      scene.add(im);
      { const zs = []; for (let z = -30; z < len + 60; z += 19.2) zs.push(z); const mast = new T.InstancedMesh(new T.CylinderGeometry(0.07, 0.09, 5.6, 6), new T.MeshStandardMaterial({ color: 0x6b4b30, roughness: 0.8 }), zs.length); const mm = new T.Matrix4(); zs.forEach((z, k) => { mm.makeTranslation(sd * 13.2, 2.6, z); mast.setMatrixAt(k, mm); }); scene.add(mast); }
      const rope = new T.Mesh(new T.BoxGeometry(0.03, 0.03, len + 90), new T.MeshBasicMaterial({ color: 0x2a2a2a })); rope.position.set(sd * 13.2, 5.15, len / 2 + 15); scene.add(rope);
    }
  }

  // the crowd on the banks: instanced figures with a bobbing shader; lanterns on evening and night rivers
  {
    const n = hiQ ? 700 : 360;
    const pt = personTexture();
    const geo = new T.PlaneGeometry(0.6, 1.2);
    const mat = new T.MeshLambertMaterial({ map: pt, transparent: true, alphaTest: 0.4, side: T.DoubleSide });
    const U = { uT: { value: 0 } };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = U.uT;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;').replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph = instanceMatrix[3].x * 3.7 + instanceMatrix[3].z * 1.9;
        transformed.y += abs(sin(uT * (3.0 + fract(ph) * 3.0) + ph)) * 0.22 * (0.4 + fract(ph * 7.0));
        transformed.x += sin(uT * 2.0 + ph) * 0.04;`);
    };
    const im = new T.InstancedMesh(geo, mat, n);
    const m4 = new T.Matrix4(), col = new T.Color(), pos = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3();
    const pal = [0xe8553f, 0xf5c542, 0x2d78d0, 0xf4f4f0, 0x3fae5a, 0xd04a9a, 0xff8a2a, 0x8a5cd6];
    for (let i = 0; i < n; i++) {
      const sd = i % 2 ? 1 : -1, row = Math.floor(rand() * 4), x = sd * (15.6 + row * 1.3 + rr(0, 0.7)), z = rr(-40, len + 60), s = rr(0.9, 1.25);
      pos.set(x, 0.55 + row * 0.18 + 0.6 * s, z); q.setFromAxisAngle(new T.Vector3(0, 1, 0), sd > 0 ? -Math.PI / 2 : Math.PI / 2); sc.set(s, s, 1); m4.compose(pos, q, sc); im.setMatrixAt(i, m4);
      col.setHex(pal[Math.floor(rand() * pal.length)]); col.multiplyScalar(kind === 'night' ? 0.45 : 0.9); im.setColorAt(i, col);
    }
    scene.add(im); A.crowdU = U;
    if (look.lights) {
      const nl = 90, gl = new T.SphereGeometry(0.28, 8, 6);
      const lm = new T.InstancedMesh(gl, new T.MeshBasicMaterial({ color: 0xffb454 }), nl), halo = new T.InstancedMesh(new T.PlaneGeometry(2.2, 2.2), new T.MeshBasicMaterial({ map: glowT, color: 0xffa040, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.7 }), nl);
      const hq = new T.Quaternion();
      for (let i = 0; i < nl; i++) {
        const sd = i % 2 ? 1 : -1, x = sd * rr(13.0, 15.0), z = rr(-20, len + 40), y = rr(3.2, 5.0);
        m4.makeTranslation(x, y, z); lm.setMatrixAt(i, m4); halo.setMatrixAt(i, m4);
      }
      scene.add(lm); scene.add(halo);
    }
  }

  // flotsam (logs, lotus mats, buoys): one mesh per item, placed from the course description
  A.flotsam = [];
  for (const f of course.flotsam) {
    let m;
    if (f.kind === 'log') { m = new T.Mesh(new T.CylinderGeometry(0.28, 0.3, 2.6, 10), new T.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.9 })); m.rotation.z = Math.PI / 2; m.rotation.y = rr(-0.6, 0.6); const g = new T.Group(); g.add(m); m = g; }
    else if (f.kind === 'mat') { const g = new T.Group(); for (let k = 0; k < 7; k++) { const pad = new T.Mesh(new T.CircleGeometry(rr(0.5, 0.8), 14), new T.MeshStandardMaterial({ color: 0x3f9a4a, roughness: 0.7, side: T.DoubleSide })); pad.rotation.x = -Math.PI / 2; pad.position.set(rr(-1, 1), 0.03 + k * 0.002, rr(-1, 1)); g.add(pad); } const fl = new T.Mesh(new T.SphereGeometry(0.2, 8, 6), new T.MeshStandardMaterial({ color: 0xf2a0c0, roughness: 0.5 })); fl.position.set(0.1, 0.18, 0); g.add(fl); m = g; }
    else { const g = new T.Group(); const body = new T.Mesh(new T.CylinderGeometry(0.4, 0.5, 0.9, 12), new T.MeshStandardMaterial({ color: 0xe8661e, roughness: 0.5 })); body.position.y = 0.3; g.add(body); const band = new T.Mesh(new T.CylinderGeometry(0.43, 0.46, 0.2, 12), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })); band.position.y = 0.3; g.add(band); const top = new T.Mesh(new T.SphereGeometry(0.25, 8, 6), new T.MeshStandardMaterial({ color: 0xffd23a })); top.position.y = 0.85; g.add(top); m = g; }
    m.position.set(f.x, 0.0, f.z); m.userData.f = f; m.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    scene.add(m); A.flotsam.push(m);
  }

  // spray: pooled sprites
  const sprMat = new T.SpriteMaterial({ map: glowT, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0.9 });
  for (let i = 0; i < 160; i++) { const s = new T.Sprite(sprMat.clone()); s.visible = false; scene.add(s); A.parts.push({ s, life: 0, max: 1, v: new T.Vector3(), size: 0.2, a0: 0.9, g: 0, drag: 1, grow: 0 }); }
  // rings on the water for splashes and bumps
  const rg = new T.RingGeometry(0.5, 0.62, 28);
  for (let i = 0; i < 14; i++) { const m = new T.Mesh(rg, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide })); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); A.rings.push({ m, life: 0, max: 0.6, big: 1 }); }
  A.glowT = glowT;
  return A;
}

export function updateArena(A, { t, cam, boats, streams, me, dtReal, paused }) {
  const U = A.water.U;
  if (!paused) { U.uTime.value += dtReal; if (A.crowdU) A.crowdU.uT.value += dtReal; }
  // the water plane follows the camera (snapped, so the waves stay put in world space)
  const cx = Math.round(cam.position.x / 2) * 2, cz = Math.round(cam.position.z / 2) * 2;
  A.water.mesh.position.set(cx, 0, cz + 110);
  for (let i = 0; i < 4; i++) {
    const b = boats[i], v = U.uBoats.value[i];
    if (b) v.set(b.x, b.z, b.yaw, b.v); else v.set(0, 0, 0, -1);
  }
  const near = streams.filter((s) => s.z1 > me.z - 40 && s.z0 < me.z + 140).slice(0, 6);
  for (let i = 0; i < 6; i++) { const s = near[i]; U.uStreams.value[i].set(s ? s.x : 0, s ? s.z0 : -9999, s ? s.z1 : -9999, s ? s.w : 0); }
  A.ring.position.x = cam.position.x; A.ring.position.z = cam.position.z;
  A.sky.position.copy(cam.position); A.sun.position.copy(A.sunDir).multiplyScalar(820).add(cam.position);
  // keep the sun's shadow box on the player's boat
  A.dirLight.target.position.set(me.x, 0, me.z);
  A.dirLight.position.set(me.x + A.sunDir.x * 60, A.sunDir.y * 60, me.z + A.sunDir.z * 60);
  A.dirLight.target.updateMatrixWorld();
}

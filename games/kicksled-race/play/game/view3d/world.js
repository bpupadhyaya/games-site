// The lit 3D world behind the race (presentation only: it reads camX / theme / time from the 2D scene and never writes back).
//
// One small off-screen WebGL canvas renders the band from the top of the picture down to just below the horizon: a photographic sky and
// panorama from the shared scenery kit (view3d scenery3d), a snow ridge band, then OUR OWN lit 3D mid-ground: snow-laden pines (three tiers,
// real lighting, fog depth) and gabled houses with lit windows, plus an aurora on the lake course. The camera slides along the course, so the
// pines and houses parallax correctly and the panorama turns slowly behind them. src/scene.js composites the canvas with drawImage and keeps its
// flat 2D backdrop as the fallback (no WebGL2, load failure, lost context, ?fig=2d).
import { buildScenery, THREE } from '../vendor3d/index.js';

const {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, InstancedMesh, Matrix4, Color, Fog, HemisphereLight, DirectionalLight,
  CylinderGeometry, BoxGeometry, MeshStandardMaterial, MeshBasicMaterial, PlaneGeometry, CanvasTexture, SRGBColorSpace, DoubleSide,
  AdditiveBlending, Object3D, Vector3, Quaternion, Euler,
} = THREE;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hashf = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// per course theme: scenery layers + light
const LOOKS = {
  town: { tod: 'day', sky: 'sky-clear', back: 'bd-snow-village', haze: '#d6e4f0', sun: '#fff1d6', sunI: 2.4, amb: '#b9cde0', ambI: 1.1, pine: '#3d7468', houses: 0.7, sunDir: [-30, 40, -20] },
  lake: { tod: 'dusk', sky: 'sky-dusk', back: 'bd-alpine-snow', haze: '#8d8fc4', sun: '#ffb78a', sunI: 2.0, amb: '#8c88c0', ambI: 0.95, pine: '#34627a', houses: 0.18, aurora: true, sunDir: [40, 14, -30] },
  forest: { tod: 'day', sky: 'sky-overcast', back: 'bd-snow-village', haze: '#c9d6df', sun: '#f4f6f8', sunI: 1.7, amb: '#c4d2de', ambI: 1.25, pine: '#32655c', houses: 0, dense: true, sunDir: [10, 38, -30] },
  harbour: { tod: 'dusk', sky: 'sky-peach', back: 'bd-nordic-village', haze: '#e8c3a8', sun: '#ffc48a', sunI: 2.3, amb: '#a9a0c0', ambI: 1.0, pine: '#46687a', houses: 0.5, sunDir: [-36, 16, -26] },
};

function windowTexture(lit) {
  const c = globalThis.document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) {
    const on = hashf(r * 7 + q * 3 + lit) < 0.6;
    g.fillStyle = on ? '#ffd27a' : '#46566e'; g.fillRect(12 + q * 40, 14 + r * 38, 22, 26);
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(10 + q * 40, 40 + r * 38, 26, 3);
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}
function emissiveTexture() {
  const c = globalThis.document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) {
    if (hashf(r * 7 + q * 3 + 1) < 0.6) { g.fillStyle = '#ffb347'; g.fillRect(12 + q * 40, 14 + r * 38, 22, 26); }
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}
function auroraTexture() {
  const c = globalThis.document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  for (let k = 0; k < 3; k++) {
    const grad = g.createLinearGradient(0, 0, 0, 128);
    const col = k === 1 ? '130,200,255' : '110,255,190';
    grad.addColorStop(0, `rgba(${col},0)`); grad.addColorStop(0.55, `rgba(${col},${0.34 - k * 0.06})`); grad.addColorStop(1, 'rgba(190,120,255,0)');
    g.fillStyle = grad; g.beginPath(); g.moveTo(0, 0);
    for (let i = 0; i <= 64; i++) g.lineTo(i * 8, 30 + k * 12 + Math.sin(i * 0.55 + k * 1.7) * 14 + Math.sin(i * 0.21 + k) * 9);
    for (let i = 64; i >= 0; i--) g.lineTo(i * 8, 100 + k * 8 + Math.sin(i * 0.55 + k * 1.7) * 14);
    g.closePath(); g.fill();
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}

export async function createWorld({ quality = 'medium', base } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  let renderer;
  try { renderer = new WebGLRenderer({ canvas, antialias: quality !== 'low', alpha: false, powerPreference: 'high-performance' }); } catch { return null; }
  const gl = renderer.getContext();
  if (!gl) return null;
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = SRGBColorSpace;
  const api = { canvas, ok: true, lost: false, ready: false, themes: new Map(), cur: null, size: { w: 0, h: 0 } };
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); api.lost = true; });
  canvas.addEventListener('webglcontextrestored', () => { api.lost = false; });

  const camera = new PerspectiveCamera(40, 1, 0.5, 400);
  const dens = quality === 'low' ? 0.55 : quality === 'high' ? 1 : 0.8;

  // geometry shared by all themes
  const tierGeo = new CylinderGeometry(0, 1, 1, 9, 1, false);       // unit cone, apex up, base radius 1, height 1 (centre at 0)
  const trunkGeo = new CylinderGeometry(0.1, 0.14, 1, 6);
  const boxGeo = new BoxGeometry(1, 1, 1);
  const prismGeo = new CylinderGeometry(1, 1, 1, 3, 1, false);      // triangular prism (roof): rotate so the ridge runs along x
  prismGeo.rotateZ(Math.PI / 2);                                    // axis along x
  prismGeo.rotateX(-Math.PI / 2);                                   // one vertex up, ridge along x
  const dummy = new Object3D();

  async function build(themeId) {
    const look = LOOKS[themeId] || LOOKS.town;
    const scene = new Scene();
    scene.fog = new Fog(new Color(look.haze), 38, 150);
    const sc = buildScenery({
      layers: [
        { t: 'sky', id: look.sky },
        { t: 'backdrop', id: look.back },
        { t: 'band', id: 'band-snow-pines', r: 90, h: 24 },
        { t: 'band', id: 'band-snow-ridge', r: 70, h: 14, arc: [60, 300] },
      ],
      timeOfDay: look.tod, season: 'winter', quality, radius: 130, base: base ? base + 'scenery/' : undefined, clouds: 0.6,
    });
    scene.add(sc.group);
    const hemi = new HemisphereLight(new Color(look.amb), new Color('#cfd9e6'), look.ambI);
    const sun = new DirectionalLight(new Color(look.sun), look.sunI);
    sun.position.set(...look.sunDir);
    scene.add(hemi, sun);

    // pines: three stacked cones, each with a white cap cone (snow load) and a trunk; instanced, recycled along the course
    const rows = [
      { z: -26, sp: look.dense ? 4 : 7, h: [4.5, 7], zJit: 5, tint: 0 },
      { z: -44, sp: look.dense ? 3.4 : 5.5, h: [6, 9.5], zJit: 8, tint: 0.08 },
      { z: -68, sp: look.dense ? 3 : 4.5, h: [8, 13], zJit: 10, tint: 0.16 },
    ];
    const NP = Math.round(170 * dens);
    const pineMat = new MeshStandardMaterial({ color: new Color(look.pine), roughness: 0.9, metalness: 0, flatShading: true });
    const snowMat = new MeshStandardMaterial({ color: new Color('#f4f8ff'), roughness: 0.85, metalness: 0, flatShading: true, emissive: new Color('#9fb2d2'), emissiveIntensity: 0.45 });
    const trunkMat = new MeshStandardMaterial({ color: new Color('#4a3524'), roughness: 1 });
    const group = new Group(); scene.add(group);
    const pineSets = rows.map((row, ri) => {
      const mk = (geo, mat) => { const m = new InstancedMesh(geo, mat, NP); m.frustumCulled = false; group.add(m); return m; };
      const tiers = [0, 1, 2].map(() => ({ g: mk(tierGeo, pineMat), s: mk(tierGeo, snowMat) }));
      return { row, ri, tiers, trunk: mk(trunkGeo, trunkMat), n: NP };
    });

    // houses: box + gable prism + snow cap + lit windows
    const NH = look.houses > 0 ? Math.round(20 * dens) : 0;
    let houseSet = null;
    if (NH) {
      const wallMats = ['#c8503c', '#e0a93c', '#4f86a8', '#8a5a3c', '#b8473a', '#d9c7a0'].map((c) => new MeshStandardMaterial({ color: new Color(c), roughness: 0.85, map: windowTexture(1), emissiveMap: emissiveTexture(), emissive: new Color('#ffffff'), emissiveIntensity: look.tod === 'dusk' ? 1.1 : 0.55 }));
      const roofMat = new MeshStandardMaterial({ color: new Color('#3d4256'), roughness: 0.9 });
      const capMat = new MeshStandardMaterial({ color: new Color('#f4f8ff'), roughness: 0.8, emissive: new Color('#25304a'), emissiveIntensity: 0.25 });
      houseSet = { walls: wallMats.map((m) => { const im = new InstancedMesh(boxGeo, m, NH); im.frustumCulled = false; group.add(im); return { im, n: 0 }; }), roof: new InstancedMesh(prismGeo, roofMat, NH), cap: new InstancedMesh(prismGeo, capMat, NH), n: NH };
      group.add(houseSet.roof, houseSet.cap); houseSet.roof.frustumCulled = false; houseSet.cap.frustumCulled = false;
    }
    let aurora = null;
    if (look.aurora) {
      const tex = auroraTexture();
      aurora = new Mesh(new PlaneGeometry(260, 60), new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, fog: false, side: DoubleSide }));
      aurora.position.set(0, 60, -118); scene.add(aurora);
      aurora.userData.tex = tex;
    }
    // a soft sun / moon glow
    let glow = null;
    if (look.tod === 'dusk') {
      const c = globalThis.document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,238,200,0.95)'); gr.addColorStop(0.25, 'rgba(255,190,140,0.45)'); gr.addColorStop(1, 'rgba(255,170,120,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      glow = new Mesh(new PlaneGeometry(70, 70), new MeshBasicMaterial({ map: new CanvasTexture(c), transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false }));
      glow.position.set(look.sunDir[0] * 2.6, look.sunDir[1] * 2.2 + 6, -110); scene.add(glow);
    }
    await sc.ready;
    return { look, scene, sc, sun, pineSets, houseSet, aurora, glow, group, t: 0 };
  }

  // lay out the recycled pines / houses for the camera x position (metres of the 3D world)
  const M = new Matrix4(), Q = new Quaternion(), E = new Euler(), P = new Vector3(), S = new Vector3();
  function layout(th, cx) {
    const { look } = th;
    for (const ps of th.pineSets) {
      const { row } = ps;
      const span = 170;                                              // lateral range covered each side of the camera
      const i0 = Math.floor((cx - span) / row.sp);
      let n = 0;
      for (let i = i0; n < ps.n && i * row.sp < cx + span; i++) {
        const r1 = hashf(i * 3.1 + ps.ri * 17), r2 = hashf(i * 5.7 + ps.ri * 11), r3 = hashf(i * 9.3 + ps.ri * 5);
        if (look.houses && ps.ri === 0 && hashf(i * 13.7) < 0.35) continue;      // gaps where a house stands
        const h = row.h[0] + (row.h[1] - row.h[0]) * r1, w = h * (0.30 + 0.07 * r2);
        const x = i * row.sp + (r3 - 0.5) * row.sp * 0.8, z = row.z - r2 * row.zJit;
        // three tiers, each narrower and higher
        for (let t = 0; t < 3; t++) {
          const th0 = h * (0.34 + 0.05 * (1 - t / 2)), ww = w * (1 - t * 0.27), y = h * 0.24 + t * h * 0.27 + th0 / 2;
          P.set(x, y, z); S.set(ww, th0, ww); Q.setFromEuler(E.set(0, r1 * 6, 0)); M.compose(P, Q, S);
          ps.tiers[t].g.setMatrixAt(n, M);
          // snow cap: same apex, upper 62 %
          const ch = th0 * 0.62, cw = ww * 0.62 * 1.04;
          P.set(x, y + (th0 - ch) / 2 + th0 * 0.012, z); S.set(cw, ch * 1.01, cw); M.compose(P, Q, S);
          ps.tiers[t].s.setMatrixAt(n, M);
        }
        P.set(x, h * 0.12, z); S.set(w * 0.5, h * 0.24, w * 0.5); Q.identity(); M.compose(P, Q, S); ps.trunk.setMatrixAt(n, M);
        n++;
      }
      for (const t of ps.tiers) { t.g.count = n; t.s.count = n; t.g.instanceMatrix.needsUpdate = true; t.s.instanceMatrix.needsUpdate = true; }
      ps.trunk.count = n; ps.trunk.instanceMatrix.needsUpdate = true;
    }
    if (th.houseSet) {
      const hs = th.houseSet, sp = 22;
      const i0 = Math.floor((cx - 170) / sp);
      const counts = hs.walls.map(() => 0);
      let n = 0;
      for (let i = i0; n < hs.n && i * sp < cx + 170; i++) {
        if (hashf(i * 7.7) > look.houses * 1.4) continue;
        const w = 4.5 + hashf(i * 2.3) * 3, h = 3.8 + hashf(i * 4.1) * 2.6, d = 4.5 + hashf(i) * 1.6;
        const x = i * sp + hashf(i * 8.9) * 8 - 4, z = -38 - hashf(i * 3.3) * 10;
        const k = Math.floor(hashf(i * 6.1) * hs.walls.length);
        P.set(x, h / 2, z); S.set(w, h, d); Q.identity(); M.compose(P, Q, S); hs.walls[k].im.setMatrixAt(counts[k]++, M);
        // gable roof (prism: ridge along x, base width 1.732 * scale.z, ridge height 1.5 * scale.y)
        const sy = d * 0.42, sz = d * 0.62;
        P.set(x, h + sy * 0.5, z); S.set(w * 1.1, sy, sz); Q.identity(); M.compose(P, Q, S); hs.roof.setMatrixAt(n, M);
        P.set(x, h + sy * 0.5 + sy * 0.05, z); S.set(w * 1.13, sy * 1.02, sz * 0.94); M.compose(P, Q, S); hs.cap.setMatrixAt(n, M);
        n++;
      }
      hs.walls.forEach((w, k) => { w.im.count = counts[k]; w.im.instanceMatrix.needsUpdate = true; });
      hs.roof.count = n; hs.cap.count = n; hs.roof.instanceMatrix.needsUpdate = true; hs.cap.instanceMatrix.needsUpdate = true;
    }
  }

  const loading = new Map();
  api.prepare = (themeId) => {
    if (api.themes.has(themeId)) return Promise.resolve(api.themes.get(themeId));
    if (!loading.has(themeId)) {
      loading.set(themeId, build(themeId).then((th) => { api.themes.set(themeId, th); return th; }).catch((e) => { console.warn('3D world unavailable for', themeId, e); api.failed = true; return null; }));
    }
    return loading.get(themeId);
  };

  // Draw the world into rect R of ctx: from R.y down to row `horizon` (+ a little below, hidden by the ridge). camX: course metres.
  api.draw = (ctx, R, themeId, camX, horizon, t, s) => {
    if (api.lost || api.failed) return false;
    const th = api.themes.get(themeId);
    if (!th) { api.prepare(themeId); return false; }
    const bandH = Math.max(40, Math.round(horizon - R.y + 24));
    const W = Math.max(64, Math.round(R.w)), H = bandH;
    const k = quality === 'low' ? 0.75 : 1;
    const dw = Math.round(W * k), dh = Math.round(H * k);
    if (api.size.w !== dw || api.size.h !== dh) { renderer.setSize(dw, dh, false); api.size.w = dw; api.size.h = dh; }
    // focal length in px (of the W x H picture): about 14 px of picture per metre of scale at a 1 m / 1 m distance, so a 12 m pine at 40 m stands 0.3 * 12 * s tall
    const f = 14 * s;
    const fullH = 2 * (horizon - R.y);                                  // camera at pitch 0: the horizon is the centre of the full frame
    camera.fov = 2 * Math.atan(fullH / 2 / f) * 180 / Math.PI;
    camera.aspect = W / fullH;
    camera.setViewOffset(W, fullH, 0, 0, W, H);
    camera.near = 0.5; camera.far = 400;
    const cx = camX * 0.55;                                              // the mid-ground slides a little slower than the track
    camera.position.set(cx, 1.7, 0);
    camera.rotation.set(0, 0, 0);
    // the panorama behind the trees turns slowly with the course (the camera keeps facing the track)
    { const a = camX * 0.0011; for (const c of th.sc.group.children) c.rotation.y = a; }   // each layer turns about its own centre (they follow the camera)
    camera.updateProjectionMatrix();
    if (th.lastCx === undefined || Math.abs(cx - th.lastCx) > 40) { layout(th, cx); th.lastCx = cx; }      // instances live in world space: re-lay only when the +-120 m window needs shifting
    th.sc.update(0.016, camera);
    th.sun.position.set(cx + th.look.sunDir[0], th.look.sunDir[1], th.look.sunDir[2]);
    if (th.aurora) { th.aurora.position.x = cx; th.aurora.userData.tex.offset.x = t * 0.006; }
    if (th.glow) th.glow.position.x = cx + th.look.sunDir[0] * 2.6;
    renderer.render(th.scene, camera);
    ctx.drawImage(canvas, R.x, R.y, W, H);
    return true;
  };
  api.dispose = () => { try { renderer.dispose(); } catch {} };
  return api;
}

// The 3D hillside: sky and light that follow the season and the weather, the terraced terrain, mud beds, mirror water, rice clumps, wooden sluices with water that
// really runs through them, the canal and the spring, forest, far ridges, the growing village, mist and rain. It READS the simulation state and never writes back.
import { makeTerrain, buildTerrainGeometry, noise, BED, BUND } from './terrain.js';
import { PW, PD, STEP, HW, HD, plotPos, plotX, plotZ, tierY, canalZ, canalY, SPRING, gatePos } from '../src/geom.js';
import { gateList } from '../src/levels.js';
import { CROP } from '../src/farm.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rnd = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const hexRGB = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
const mixRGB = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function canvasTex(THREE, w, h, draw, repeat) {
  const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}

// how the day looks in each season; rows: sky top, sky horizon, fog, sun colour, sun intensity, hemisphere sky, hemisphere ground, hemisphere intensity, exposure, mist amount
const LOOKS = [
  { top: 0x6f8fcf, hor: 0xf3d6c0, fog: 0xe9d7cd, sun: 0xffc99a, sunI: 2.6, hs: 0xb9c6ee, hg: 0x5d5646, hi: 0.95, exp: 1.0, mist: 0.9, glow: 0.8 },   // soak: dawn
  { top: 0x3f86dd, hor: 0xcfe6f2, fog: 0xd6e8ee, sun: 0xfff0d0, sunI: 3.2, hs: 0xcfe2ff, hg: 0x5f6a45, hi: 1.0, exp: 1.0, mist: 0.35, glow: 0.45 }, // plant: fresh morning
  { top: 0x2b78d8, hor: 0xbfe0f0, fog: 0xcde6ee, sun: 0xfff4dc, sunI: 3.5, hs: 0xd2e6ff, hg: 0x5a6f3b, hi: 1.05, exp: 1.02, mist: 0.18, glow: 0.35 }, // grow: bright
  { top: 0x5f86c4, hor: 0xffd9a0, fog: 0xf0d9b4, sun: 0xffb36a, sunI: 3.1, hs: 0xe6d3b8, hg: 0x6c5a38, hi: 0.95, exp: 1.04, mist: 0.4, glow: 0.9 },  // golden: late sun
];
const WX = {
  clear: { dark: 0, rain: 0, haze: 0 }, rain: { dark: 0.4, rain: 0.8, haze: 0.2 }, storm: { dark: 0.7, rain: 1, haze: 0.3 }, dry: { dark: -0.1, rain: 0, haze: 0.55 },
};

export function buildWorld(V3, stage, opts = {}) {
  const { THREE } = V3;
  const W = { root: new THREE.Group(), level: null, T: null, gates: [], plots: [], U: { time: { value: 0 } }, look: null, ready: false, houses: 0 };
  const doc = globalThis.document;
  stage.add(W.root);
  const rngSky = rnd(77);
  const std = (c, r = 0.9, m = 0, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...o });
  const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });

  // ---- sky dome, glow, clouds ----------------------------------------------------------------------------------------------------
  const skyCanvas = doc.createElement('canvas'); skyCanvas.width = 4; skyCanvas.height = 256;
  const skyTex = new THREE.CanvasTexture(skyCanvas); skyTex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.renderOrder = -10; W.root.add(dome);
  const paintSky = (top, hor, hazeCol) => {
    const g = skyCanvas.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    const c = (v) => `rgb(${Math.round(v[0] * 255)},${Math.round(v[1] * 255)},${Math.round(v[2] * 255)})`;
    gr.addColorStop(0, c(top)); gr.addColorStop(0.42, c(mixRGB(top, hor, 0.55))); gr.addColorStop(0.52, c(hor)); gr.addColorStop(0.6, c(mixRGB(hor, hazeCol, 0.5))); gr.addColorStop(1, c(hazeCol));
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256); skyTex.needsUpdate = true;
  };
  const glowTex = canvasTex(THREE, 128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,240,210,0.55)'); gr.addColorStop(1, 'rgba(255,230,190,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.7 }));
  sunGlow.scale.set(520, 520, 1); sunGlow.renderOrder = -9; W.root.add(sunGlow);
  const cloudTex = canvasTex(THREE, 256, 128, (g, w, h) => { for (let i = 0; i < 16; i++) { const x = w * (0.18 + 0.64 * rngSky()), y = h * (0.35 + 0.3 * rngSky()), r = h * (0.22 + 0.28 * rngSky()); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); } });
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.85 }));
    const a = -Math.PI * (0.1 + 0.8 * rngSky()), d = 700 + rngSky() * 120;
    m.position.set(Math.cos(a) * d * 1.1, 160 + rngSky() * 180, Math.sin(a) * d); m.scale.set(380 + rngSky() * 340, 120 + rngSky() * 80, 1); m.renderOrder = -8;
    W.root.add(m); clouds.push(m);
  }

  // ---- environment (the sky the water mirrors) -----------------------------------------------------------------------------------
  const pm = new THREE.PMREMGenerator(stage.renderer);
  let envKey = '', envTex = null;
  function setEnv(look, wx) {
    const key = `${look.idx}|${wx.dark.toFixed(1)}`;
    if (key === envKey) return; envKey = key;
    const sc = new THREE.Scene();
    const cv = doc.createElement('canvas'); cv.width = 4; cv.height = 128; const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
    const dk = (v) => mixRGB(v, [0.28, 0.3, 0.36], clamp(wx.dark, 0, 0.8));
    const top = dk(hexRGB(look.top)), hor = dk(hexRGB(look.hor));
    const c = (v) => `rgb(${Math.round(v[0] * 255)},${Math.round(v[1] * 255)},${Math.round(v[2] * 255)})`;
    gr.addColorStop(0, c(top)); gr.addColorStop(0.5, c(hor)); gr.addColorStop(1, c(mixRGB(hor, [0.2, 0.25, 0.15], 0.6)));
    g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const sph = new THREE.Mesh(new THREE.SphereGeometry(50, 16, 12), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide }));
    sc.add(sph);
    const sunBlob = new THREE.Mesh(new THREE.SphereGeometry(9, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    sunBlob.position.set(-10, 30, -34); sc.add(sunBlob);
    const rt = pm.fromScene(sc, 0.02);
    if (envTex) envTex.dispose();
    envTex = rt.texture; stage.scene.environment = envTex; stage.scene.environmentIntensity = 0.22; W.envTex = envTex; for (const m of waterMats) m.envMap = envTex;
    t.dispose(); sph.geometry.dispose();
  }

  // ---- shared textures -----------------------------------------------------------------------------------------------------------
  const detail = canvasTex(THREE, 256, 256, (g, w, h) => {
    const r = rnd(5); g.fillStyle = '#d4d4d4'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5200; i++) { const v = 120 + r() * 135; g.fillStyle = `rgba(${v},${v},${v},0.38)`; g.fillRect(r() * w, r() * h, 1 + r() * 2.2, 1 + r() * 2.2); }
  }, true);
  const rippleNormal = (() => {
    const w = 128, h = 128, c = doc.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), img = g.createImageData(w, h);
    const H = (x, y) => Math.sin(x * 0.35 + Math.sin(y * 0.21) * 2) * 0.5 + Math.sin(y * 0.4 + Math.cos(x * 0.27) * 2) * 0.5 + Math.sin((x + y) * 0.17) * 0.3;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * 0.5, dy = (H(x, y + 1) - H(x, y - 1)) * 0.5, l = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4; img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.4, 1.1); return t;
  })();
  const streakTex = canvasTex(THREE, 32, 128, (g, w, h) => {
    const r = rnd(9); g.clearRect(0, 0, w, h);
    for (let i = 0; i < 22; i++) { const x = r() * w, y = r() * h, len = 18 + r() * 40; const gr = g.createLinearGradient(0, y, 0, y + len); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${0.35 + r() * 0.5})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x, y, 1.5 + r() * 2.5, len); }
  }, true);
  const softTex = canvasTex(THREE, 64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });

  // ---- lights ----------------------------------------------------------------------------------------------------------------------
  const key = stage.lights.key, hemi = stage.lights.hemi, rim = stage.lights.rim;
  key.shadow.camera.left = -34; key.shadow.camera.right = 34; key.shadow.camera.top = 34; key.shadow.camera.bottom = -34; key.shadow.camera.near = 1; key.shadow.camera.far = 140; key.shadow.camera.updateProjectionMatrix();
  stage._shadowOffset.set(-34, 30, 20);
  rim.intensity = 0.55;

  // ---- level-dependent pieces -----------------------------------------------------------------------------------------------------
  let levelGroup = null;
  const disposeGroup = (grp) => { grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); }); };

  const waterMats = [];
  const gm4 = new THREE.Matrix4();
  function makeWaterMat() {
    const m = new THREE.MeshStandardMaterial({ color: 0x58b4cc, roughness: 0.03, metalness: 0.92, transparent: true, opacity: 0.78, normalMap: rippleNormal, envMapIntensity: 1.8 });
    m.normalScale.set(0.1, 0.1);
    if (W.envTex) m.envMap = W.envTex;
    waterMats.push(m); return m;
  }

  W.setLevel = (lv) => {
    if (levelGroup) { W.root.remove(levelGroup); disposeGroup(levelGroup); }
    waterMats.length = 0;
    levelGroup = new THREE.Group(); W.root.add(levelGroup);
    W.level = lv; W.chapter = lv.chapter;
    const T = makeTerrain(lv); W.T = T;
    const R = lv.R, C = lv.C;
    // terrain
    const tg = buildTerrainGeometry(THREE, T, lv.chapter);
    const tm = new THREE.Mesh(tg, std(0xffffff, 0.96, 0, { vertexColors: true, map: detail }));
    tm.receiveShadow = true; tm.castShadow = true; levelGroup.add(tm);
    // plots: mud bed, water, rice
    W.plots = [];
    const bedGeo = new THREE.PlaneGeometry(2 * HW - 0.8, 2 * HD - 0.55); bedGeo.rotateX(-Math.PI / 2);
    const clumpGeo = (() => {
      const pos = [], col = [], nb = 5;
      for (let b = 0; b < nb; b++) {
        const a = (b / nb) * Math.PI * 2 + 0.4, dx = Math.cos(a), dz = Math.sin(a), lean = 0.22 + 0.1 * (b % 2);
        const px = -dz, pz = dx, w0 = 0.032;
        const seg = [[0, 0, w0], [0.5, lean * 0.5, w0 * 0.7], [1, lean * 1.5, 0.004]];
        for (let s = 0; s < seg.length - 1; s++) {
          const [y0, o0, ww0] = seg[s], [y1, o1, ww1] = seg[s + 1];
          const v = (y, o, ww, sgn) => [dx * o * 0.5 + px * ww * sgn, y, dz * o * 0.5 + pz * ww * sgn];
          const a0 = v(y0, o0, ww0, -1), a1 = v(y0, o0, ww0, 1), b0 = v(y1, o1, ww1, -1), b1 = v(y1, o1, ww1, 1);
          pos.push(...a0, ...a1, ...b0, ...a1, ...b1, ...b0);
          const c0 = 0.55 + 0.45 * y0, c1 = 0.55 + 0.45 * y1;
          col.push(c0, c0, c0, c0, c0, c0, c1, c1, c1, c0, c0, c0, c1, c1, c1, c1, c1, c1);
        }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
    })();
    const cropMat = lam(0xffffff, { vertexColors: true, side: THREE.DoubleSide });
    cropMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = W.U.time;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph = uTime * 1.8 + instanceMatrix[3].x * 0.8 + instanceMatrix[3].z * 0.6;
        transformed.x += sin(ph) * 0.09 * position.y * position.y;
        transformed.z += cos(ph * 0.8 + 1.0) * 0.05 * position.y * position.y;`);
    };
    cropMat.customProgramCacheKey = () => 'rice-sway';
    W._clump = { clumpGeo, cropMat };
    const NX = 12, NZ = 9;
    for (let i = 0; i < R * C; i++) {
      const p = plotPos(lv, i), bedY = p.y + BED;
      const bed = new THREE.Mesh(bedGeo, std(0x6b5238, 0.55)); bed.position.set(p.x, bedY + 0.012, p.z - 0.275); bed.receiveShadow = true; levelGroup.add(bed);
      const wm = makeWaterMat();
      const water = new THREE.Mesh(bedGeo, wm); water.position.set(p.x, bedY + 0.05, p.z - 0.275); water.receiveShadow = false; water.visible = false; water.renderOrder = 2; levelGroup.add(water);
      const rice = new THREE.InstancedMesh(clumpGeo, cropMat, NX * NZ); rice.castShadow = false; rice.receiveShadow = false; rice.frustumCulled = false;
      const r = rnd(1000 + i * 31);
      const clumps = [];
      for (let zi = 0; zi < NZ; zi++) for (let xi = 0; xi < NX; xi++) {
        clumps.push({ x: p.x - HW + 0.65 + (xi / (NX - 1)) * (2 * HW - 1.3) + (r() - 0.5) * 0.12, z: p.z - HD + 0.5 + (zi / (NZ - 1)) * (2 * HD - 1.35) + (r() - 0.5) * 0.12, s: 0.8 + r() * 0.4, rot: r() * 6.3 });
      }
      levelGroup.add(rice);
      W.plots.push({ i, p, bedY, bed, water, wm, rice, clumps, sig: '', waterLevel: 0.15, spotTone: 0 });
    }
    // decor fields around the playable ones: water / crop quads that follow the season
    buildStones(lv, T, levelGroup);
    W.decor = buildDecor(lv, T, levelGroup);
    // gates, canal, spring
    W.gates = buildGates(lv, T, levelGroup);
    buildCanalAndSpring(lv, T, levelGroup);
    buildForest(lv, T, levelGroup);
    W.ridges = buildRidges(lv, T, levelGroup);
    W.village = buildVillage(lv, T, levelGroup);
    W.mist = buildMist(lv, T, levelGroup);
    W.ready = true;
  };

  // decor: the terraces outside the playable area, as mirror water or rice that follows the season
  const DEC_N = 36;
  function buildDecor(lv, T, grp) {
    const quads = [];
    const kMax = T.kValley - 1;
    for (let k = 0; k <= kMax; k++) for (let cc = -4; cc < lv.C + 4; cc++) {
      if (k < lv.R && cc >= 0 && cc < lv.C) continue;
      const x = (cc - (lv.C - 1) / 2) * PW, zBase = T.zc0 + k * PD + HD;
      const ax = Math.abs(x); const warp = ((m) => m * (3.4 * Math.sin(ax * 0.13 + (x < 0 ? 1.3 : 0.2)) + 1.2 * Math.sin(ax * 0.31 + 1)))(ss(T.halfX + 0.4, T.halfX + 9, ax));
      const z = zBase + warp - 0.275;
      if (Math.abs(x - T.xP) < 3.2) continue;
      const y = T.y0 - k * STEP + BED;
      quads.push({ x, z, y, k, cc });
    }
    const geo = new THREE.PlaneGeometry(2 * HW - 0.8, 2 * HD - 0.55); geo.rotateX(-Math.PI / 2);
    const wmat = makeWaterMat(); wmat.opacity = 0.9;
    const waterMesh = new THREE.InstancedMesh(geo, wmat, quads.length);
    const cropMesh = new THREE.InstancedMesh(W._clump.clumpGeo, W._clump.cropMat, quads.length * DEC_N);
    waterMesh.frustumCulled = false; cropMesh.frustumCulled = false; waterMesh.renderOrder = 2;
    const q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), col = new THREE.Color(), e = new THREE.Euler();
    const r = rnd(2026);
    quads.forEach((d, i) => {
      d.r = noise(d.x * 0.7, d.k * 3.1);
      pos.set(d.x, d.y + 0.05, d.z); m4.compose(pos, q, sc); waterMesh.setMatrixAt(i, m4);
      d.cl = [];
      for (let j = 0; j < DEC_N; j++) d.cl.push({ x: d.x - HW + 0.7 + r() * (2 * HW - 1.4), z: d.z - HD + 0.55 + r() * (2 * HD - 1.4), rot: r() * 6.3, s: 0.8 + r() * 0.4, v: r() });
    });
    cropMesh.count = quads.length * DEC_N;
    grp.add(waterMesh, cropMesh);
    return { quads, waterMesh, cropMesh, m4, q, q0: new THREE.Quaternion(), pos, sc, col, e, season: -1 };
  }

  // stacked stones on the walls (Cordillera) and sparse rocks and tufts on the earth walls (Bali)
  function buildStones(lv, T, grp) {
    const bali = lv.chapter === 1, r = rnd(515 + lv.seed);
    const geo = new THREE.SphereGeometry(1, 5, 3);
    const mat = std(0xffffff, 0.95, 0, { flatShading: true });
    const spots = [];
    const x0 = -T.halfX - 12, x1 = T.halfX + 12;
    for (let k = 0; k < T.kValley; k++) {
      const stepX = bali ? 1.9 : 0.62, rows = bali ? 2 : 4;
      for (let x = x0; x < x1; x += stepX) for (let j = 0; j < rows; j++) {
        const t = (j + 0.5 + (r() - 0.5) * 0.6) / rows, xx = x + (r() - 0.5) * stepX * 0.8 + (j % 2) * stepX * 0.5;
        const ax = Math.abs(xx), warp = ss(T.halfX + 0.4, T.halfX + 9, ax) * (3.4 * Math.sin(ax * 0.13 + (xx < 0 ? 1.3 : 0.2)) + 1.2 * Math.sin(ax * 0.31 + 1));
        const z = T.zc0 + k * PD + 2 * HD + t * (PD - 2 * HD) + warp;
        const f = T.field(xx, z);
        if (f.kind !== 2) continue;
        if (Math.abs(xx - T.xP) < 1.4) continue;
        spots.push({ x: xx, y: f.h, z, s: (bali ? 0.13 : 0.26) + r() * (bali ? 0.1 : 0.16), c: r() });
      }
    }
    const inst = new THREE.InstancedMesh(geo, mat, spots.length);
    inst.castShadow = false; inst.receiveShadow = true; inst.frustumCulled = false;
    const q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), p = new THREE.Vector3(), sc = new THREE.Vector3(), e = new THREE.Euler(), col = new THREE.Color();
    const A = bali ? [0.5, 0.4, 0.28] : [0.5, 0.45, 0.38], B = bali ? [0.34, 0.28, 0.18] : [0.27, 0.25, 0.21];
    spots.forEach((s2, i) => {
      e.set(r() * 6, r() * 6, r() * 6); q.setFromEuler(e); p.set(s2.x, s2.y + 0.04, s2.z + 0.06); sc.set(s2.s * 1.35, s2.s * 0.85, s2.s * 0.9); m4.compose(p, q, sc); inst.setMatrixAt(i, m4);
      const c = mixRGB(B, A, s2.c); inst.setColorAt(i, col.setRGB(c[0], c[1], c[2]));
    });
    inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    grp.add(inst);
  }

  // wooden sluices: posts and beam merged into ONE static mesh for the whole hillside, planks as two instanced meshes, all water ribbons in ONE mesh
  function buildGates(lv, T, grp) {
    const lin = (a) => a.map((c) => c ** 2.2), wood = lin([0.54, 0.35, 0.19]), dark = lin([0.36, 0.23, 0.125]), stone = lin([0.55, 0.53, 0.48]);
    const out = [], parts = [], ribParts = [];
    const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    const boxGeo = new THREE.BoxGeometry(1, 1, 1), plankGeoX = new THREE.BoxGeometry(0.8, 0.34, 0.07), plankGeoZ = new THREE.BoxGeometry(0.07, 0.34, 0.8);
    const addBox = (base, w, h, d, col, x, y, z, rz = 0) => {
      m4.compose(new THREE.Vector3(base.x + x, base.y + y, base.z + z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rz), new THREE.Vector3(w, h, d));
      parts.push({ geo: boxGeo, matrix: m4.clone(), color: col });
    };
    const ribbon = (a, b, w) => {
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, len = Math.hypot(dx, dy, dz) || 1;
      const dir = new THREE.Vector3(dx / len, dy / len, dz / len), quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
      m4.compose(new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2), quat, new THREE.Vector3(1, len, 1));
      ribParts.push({ geo: new THREE.PlaneGeometry(w, 1), matrix: m4.clone(), color: [0, 0, 0] });
      return ribParts.length - 1;
    };
    const planks = { x: [], z: [] };
    for (const g of gateList(lv)) {
      const blocked = lv.blocked.includes(g.id);
      const gp = gatePos(lv, g), entry = { g, plank: null, rib: -1, open: 0, blocked };
      let base;
      if (g.kind === 'f') base = { x: gp.x, y: canalY(lv) - 0.3, z: gp.z - 0.35 };
      else if (g.kind === 'd') base = { x: gp.x, y: tierY(lv, g.r) + BED + 0.17, z: gp.z - 0.1 };
      else base = { x: gp.x, y: tierY(lv, g.r) + BED + 0.2, z: gp.z + 0.15 };
      entry.base = base;
      const across = g.kind === 's' ? 'z' : 'x';
      if (blocked) {
        for (let k = 0; k < 6; k++) addBox(base, 0.35, 0.2, 0.32, stone, (k % 3 - 1) * 0.3 * (across === 'x' ? 1 : 0), 0.1 + Math.floor(k / 3) * 0.2, (k % 3 - 1) * 0.3 * (across === 'z' ? 1 : 0));
      } else if (across === 'x') {
        addBox(base, 0.12, 0.62, 0.14, wood, -0.46, 0.31, 0); addBox(base, 0.12, 0.62, 0.14, wood, 0.46, 0.31, 0); addBox(base, 1.08, 0.08, 0.16, dark, 0, 0.64, 0);
        addBox(base, 0.18, 0.18, 0.05, dark, 0, 0.76, 0, 0.5);
        entry.plank = { kind: 'x', i: planks.x.length }; planks.x.push(entry);
      } else {
        addBox(base, 0.14, 0.62, 0.12, wood, 0, 0.31, -0.46); addBox(base, 0.14, 0.62, 0.12, wood, 0, 0.31, 0.46); addBox(base, 0.16, 0.08, 1.08, dark, 0, 0.64, 0);
        entry.plank = { kind: 'z', i: planks.z.length }; planks.z.push(entry);
      }
      if (!blocked) {
        if (g.kind === 'd') {
          const topY = tierY(lv, g.r) + BED + 0.2, z0 = plotZ(lv, g.r) + HD - 0.25;
          const lowY = g.r < lv.R - 1 ? tierY(lv, g.r + 1) + BED + 0.35 : tierY(lv, g.r) - 2 * STEP, z1 = z0 + 1.35;
          entry.rib = ribbon({ x: gp.x, y: topY + 0.02, z: z0 }, { x: gp.x, y: lowY, z: z1 }, 0.7);
          entry.splash = { x: gp.x, y: lowY, z: z1 };
        } else if (g.kind === 'f') {
          entry.rib = ribbon({ x: gp.x, y: canalY(lv) - 0.2, z: gp.z - 0.1 }, { x: gp.x, y: tierY(lv, 0) + BED + 0.3, z: plotZ(lv, 0) - HD + 0.25 }, 0.7);
          entry.splash = { x: gp.x, y: tierY(lv, 0) + BED + 0.3, z: plotZ(lv, 0) - HD + 0.45 };
        } else {
          entry.rib = ribbon({ x: gp.x - 0.9, y: base.y + 0.28, z: gp.z }, { x: gp.x + 0.9, y: base.y + 0.28, z: gp.z }, 0.6);
        }
      }
      out.push(entry);
    }
    const sm = new THREE.Mesh(mergeColored(THREE, parts), std(0xffffff, 0.8, 0, { vertexColors: true })); sm.castShadow = true; sm.receiveShadow = true; grp.add(sm);
    const plankMat = std(0x8a5a30, 0.8);
    for (const kind of ['x', 'z']) {
      const list = planks[kind]; if (!list.length) continue;
      const im = new THREE.InstancedMesh(kind === 'x' ? plankGeoX : plankGeoZ, plankMat, list.length); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
      list.forEach((e, i) => { e.im = im; e.ii = i; });
      grp.add(im);
    }
    let ribMesh = null;
    if (ribParts.length) {
      ribMesh = new THREE.Mesh(mergeColored(THREE, ribParts), new THREE.MeshBasicMaterial({ map: streakTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      ribMesh.frustumCulled = false; ribMesh.renderOrder = 3; grp.add(ribMesh);
    }
    out.ribMesh = ribMesh; out.ribN = ribParts.length;
    return out;
  }

  function buildCanalAndSpring(lv, T, grp) {
    const half = (lv.C * PW) / 2 + 1.2, zc = canalZ(lv), y = canalY(lv);
    const stone = std(0x8a8578, 0.95);
    const trough = new THREE.Mesh(new THREE.BoxGeometry(2 * half, 0.28, 0.2), stone); trough.position.set(0, y - 0.1, zc - 0.5); trough.castShadow = true; grp.add(trough);
    const trough2 = new THREE.Mesh(new THREE.BoxGeometry(2 * half, 0.28, 0.2), stone); trough2.position.set(0, y - 0.1, zc + 0.5); trough2.castShadow = true; grp.add(trough2);
    const cw = makeWaterMat(); cw.opacity = 0.92;
    const canal = new THREE.Mesh(new THREE.PlaneGeometry(2 * half, 0.78), cw); canal.rotation.x = -Math.PI / 2; canal.position.set(0, y - 0.12, zc); canal.renderOrder = 2; grp.add(canal);
    const flowTex = streakTex.clone(); flowTex.needsUpdate = true; flowTex.repeat.set(half * 0.8, 0.5); flowTex.wrapS = flowTex.wrapT = THREE.RepeatWrapping;
    const flow = new THREE.Mesh(new THREE.PlaneGeometry(2 * half, 0.7), new THREE.MeshBasicMaterial({ map: flowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5, color: 0xcdf5ff })); flow.rotation.x = -Math.PI / 2; flow.rotation.z = Math.PI / 2; flow.position.set(0, y - 0.1, zc); grp.add(flow);
    W.canal = { flow, flowTex, half, y, zc };
    // the spring: a rock with a spout
    const sp = SPRING(lv), rockGeo = new THREE.SphereGeometry(1, 8, 6);
    const r = rnd(33);
    { const rp = [], rm = new THREE.Matrix4(), rc = hexRGB(0x7b776b).map((c) => c ** 2.2);
      for (let i = 0; i < 9; i++) { const rad = 0.5 + r() * 0.7; rm.compose(new THREE.Vector3(sp.x + (r() - 0.5) * 3.4, sp.y - 0.7 + r() * 1.0, sp.z - 0.4 - r() * 1.3), new THREE.Quaternion(), new THREE.Vector3(rad, rad * 0.7, rad)); rp.push({ geo: rockGeo, matrix: rm.clone(), color: rc }); }
      const rk = new THREE.Mesh(mergeColored(THREE, rp), std(0xffffff, 0.95, 0, { vertexColors: true })); rk.castShadow = true; rk.receiveShadow = true; grp.add(rk); }
    const bam = std(0x9a8a4a, 0.8);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.5, 10), bam); spout.rotation.x = Math.PI / 2 - 0.25; spout.position.set(sp.x, sp.y, sp.z + 0.1); spout.castShadow = true; grp.add(spout);
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1), new THREE.MeshBasicMaterial({ map: streakTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8, color: 0xcdf5ff, side: THREE.DoubleSide }));
    const a = { x: sp.x, y: sp.y - 0.05, z: sp.z + 0.8 }, b = { x: sp.x, y: y - 0.1, z: zc - 0.1 }, len = Math.hypot(b.y - a.y, b.z - a.z);
    fall.position.set(0, (a.y + b.y) / 2, (a.z + b.z) / 2); fall.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, (b.y - a.y) / len, (b.z - a.z) / len)); fall.scale.set(1, len, 1); grp.add(fall);
    W.spring = { fall, pos: sp };
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.7, 14), cw); pool.rotation.x = -Math.PI / 2; pool.position.set(sp.x, sp.y - 0.12, sp.z + 0.1); grp.add(pool);
  }

  // trees on the slope behind and on the flanks: pines in the Cordillera, coconut palms in Bali
  function buildForest(lv, T, grp) {
    const r = rnd(4242 + lv.seed), n = 260, bali = lv.chapter === 1;
    const trunkGeo = new THREE.CylinderGeometry(bali ? 0.1 : 0.14, bali ? 0.16 : 0.2, 1, 6); trunkGeo.translate(0, 0.5, 0);
    const crownGeo = (() => {
      if (!bali) {
        const g1 = new THREE.CylinderGeometry(0, 1.15, 1.9, 9), g2 = new THREE.CylinderGeometry(0, 0.9, 1.6, 9), g3 = new THREE.CylinderGeometry(0, 0.62, 1.3, 9);
        g1.translate(0, 1.0, 0); g2.translate(0, 2.0, 0); g3.translate(0, 2.9, 0);
        return mergeGeos(THREE, [g1, g2, g3]);
      }
      const pos = [], nf = 9;
      for (let f = 0; f < nf; f++) {
        const a = (f / nf) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx, L = 2.4;
        let prev = null;
        for (let s = 0; s <= 5; s++) {
          const t = s / 5, h = 0.35 + Math.sin(t * 1.6) * 0.55 - t * t * 1.3, w = 0.36 * (1 - t * 0.85), o = t * L;
          const L1 = [dx * o + px * w, h, dz * o + pz * w], R1 = [dx * o - px * w, h, dz * o - pz * w];
          if (prev) pos.push(...prev[0], ...prev[1], ...L1, ...prev[1], ...R1, ...L1);
          prev = [L1, R1];
        }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
    })();
    const trunks = new THREE.InstancedMesh(trunkGeo, std(bali ? 0x8a7352 : 0x6a4a2e, 0.9), n), crowns = new THREE.InstancedMesh(crownGeo, std(bali ? 0x4f8f2e : 0x2f5d33, 0.85, 0, { side: THREE.DoubleSide }), n);
    trunks.castShadow = crowns.castShadow = true; trunks.receiveShadow = crowns.receiveShadow = true; trunks.frustumCulled = crowns.frustumCulled = false;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
    let k = 0, guard = 0;
    while (k < n && guard++ < 4000) {
      const x = (r() - 0.5) * (T.halfX * 2 + 56) - 4, z = T.zc0 + (r() - 0.62) * 120;
      const inPlay = Math.abs(x) < T.halfX + 4.5 && z > T.zc0 - 7 && z < T.zc0 + (lv.R + 0.7) * PD;
      const sl = z < T.zc0 - 7;
      const onSide = Math.abs(x) > T.halfX + 5.5 && z > T.zc0 - 4 && z < T.zFront;
      if (inPlay || (!sl && !onSide)) continue;
      if (onSide && r() < 0.62) continue;
      if (Math.abs(x - T.xP) < 3.5) continue;
      if (onSide && T.field(x, z).kind !== 1 && T.field(x, z).kind !== 3) continue;
      const h = T.height(x, z);
      const sz = (bali ? 5.0 : 3.1) * (0.8 + r() * 0.7);
      e.set((r() - 0.5) * (bali ? 0.28 : 0.06), r() * 6.28, (r() - 0.5) * (bali ? 0.28 : 0.06)); q.setFromEuler(e);
      p.set(x, h - 0.1, z); s.set(sz * 0.3, sz * (bali ? 1.1 : 0.7), sz * 0.3); m4.compose(p, q, s); trunks.setMatrixAt(k, m4);
      p.set(x, h - 0.1 + (bali ? sz * 1.05 : sz * 0.4), z); s.set(sz * 0.45, sz * 0.45, sz * 0.45); m4.compose(p, q, s); crowns.setMatrixAt(k, m4);
      k++;
    }
    trunks.count = crowns.count = k;
    grp.add(trunks, crowns);
  }

  // layered far ridges
  function buildRidges(lv, T, grp) {
    const out = [];
    const layers = [{ z: T.zc0 - 190, h: 75, c: 0x5a7f5a, f: 0.55 }, { z: T.zc0 - 340, h: 130, c: 0x6f8f9a, f: 0.7 }, { z: T.zc0 - 560, h: 190, c: 0x8aa3b5, f: 0.82 }];
    for (const L of layers) {
      const nx = 90, pos = [], col = [], idx = [], r = rnd(L.z | 0);
      const base = hexRGB(L.c);
      for (let i = 0; i <= nx; i++) {
        const x = -520 + (i / nx) * 1040, hh = L.h * (0.35 + 0.65 * noise(x * 0.012 + L.z * 0.01, 3.3)) + L.h * 0.25 * Math.sin(x * 0.007 + L.z);
        pos.push(x, -20, L.z, x, hh, L.z); const v = 0.85 + 0.25 * r(); col.push(...base.map((c) => c * v * 0.75), ...base.map((c) => c * v));
      }
      for (let i = 0; i < nx; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })); grp.add(m); out.push(m);
    }
    return out;
  }

  // the village on the left ridge, one more house per two stars
  function buildVillage(lv, T, grp) {
    const bali = lv.chapter === 1, n = 12;
    const bodyGeo = new THREE.BoxGeometry(1.7, 1.1, 1.5); bodyGeo.translate(0, 0.55, 0);
    const roofGeo = new THREE.CylinderGeometry(0, bali ? 1.5 : 1.4, bali ? 1.0 : 1.5, 4); roofGeo.rotateY(Math.PI / 4); roofGeo.translate(0, bali ? 1.55 : 1.85, 0);
    const legs = bali ? null : (() => { const g = new THREE.CylinderGeometry(0.07, 0.07, 0.9, 5); return g; })();
    const wallC = hexRGB(bali ? 0xb89868 : 0x9a7a4a).map((c) => c ** 2.2), roofC = hexRGB(bali ? 0x7b3f26 : 0xc2a25a).map((c) => c ** 2.2);
    const houseMat = std(0xffffff, 0.9, 0, { vertexColors: true }), I4 = new THREE.Matrix4(), winGeo = new THREE.PlaneGeometry(0.3, 0.3);
    const houses = [];
    const r = rnd(808);
    for (let i = 0; i < n; i++) {
      const col = i % 4, row = Math.floor(i / 4);
      const x = -T.halfX - 10 - col * 3.4 - (row % 2) * 1.2, z = T.zc0 + 1.5 + row * 5.0 + (r() - 0.5) * 1.2;
      const y = T.height(x, z);
      const g = new THREE.Group(); g.position.set(x, y + (bali ? 0 : 0.8), z); g.rotation.y = (r() - 0.5) * 0.7;
      const hp = [{ geo: bodyGeo, matrix: I4, color: wallC }, { geo: roofGeo, matrix: I4, color: roofC }];
      if (!bali) for (const [ox, oz] of [[-0.7, -0.6], [0.7, -0.6], [-0.7, 0.6], [0.7, 0.6]]) hp.push({ geo: legs, matrix: new THREE.Matrix4().makeTranslation(ox, -0.4, oz), color: [0.1, 0.045, 0.012] });
      hp.push({ geo: winGeo, matrix: new THREE.Matrix4().makeTranslation(0, 0.6, 0.76), color: [1, 0.7, 0.26] });
      const hm = new THREE.Mesh(mergeColored(THREE, hp), houseMat); hm.castShadow = true; hm.receiveShadow = true; g.add(hm);
      g.visible = false; grp.add(g); houses.push(g);
    }
    return { houses };
  }

  function buildMist(lv, T, grp) {
    const out = [], r = rnd(99);
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, transparent: true, depthWrite: false, opacity: 0, color: 0xffffff, fog: false }));
      const x = (r() - 0.5) * 120, z = T.zFront - 18 + (r() - 0.5) * 60, y = T.yValley + 3 + r() * 14;
      m.position.set(x, y, z); m.scale.set(60 + r() * 50, 14 + r() * 10, 1); m.userData = { x0: x, sp: 0.2 + r() * 0.5, ph: r() * 6 };
      grp.add(m); out.push(m);
    }
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, transparent: true, depthWrite: false, opacity: 0, color: 0xffffff, fog: false }));
      const x = (r() - 0.5) * 70, z = T.zc0 - 14 - r() * 30, y = T.y0 + 3 + r() * 9;
      m.position.set(x, y, z); m.scale.set(48 + r() * 40, 11 + r() * 8, 1); m.userData = { x0: x, sp: 0.15 + r() * 0.3, ph: r() * 6, high: true };
      grp.add(m); out.push(m);
    }
    return out;
  }

  // ---- rain ----------------------------------------------------------------------------------------------------------------------
  const RAIN = 700;
  const rainPos = new Float32Array(RAIN * 6), rainSeed = [];
  { const r = rnd(5); for (let i = 0; i < RAIN; i++) rainSeed.push([r() - 0.5, r(), r() - 0.5]); }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xcfe3f3, transparent: true, opacity: 0.0, depthWrite: false, fog: false }));
  rain.frustumCulled = false; rain.renderOrder = 5; W.root.add(rain);

  // ---- per-frame update ------------------------------------------------------------------------------------------------------------
  const cur = { top: hexRGB(LOOKS[1].top), hor: hexRGB(LOOKS[1].hor), fog: hexRGB(LOOKS[1].fog), sun: hexRGB(LOOKS[1].sun), sunI: 3.2, hs: hexRGB(LOOKS[1].hs), hg: hexRGB(LOOKS[1].hg), hi: 1, exp: 1, mist: 0.3, glow: 0.4, dark: 0, rain: 0, haze: 0 };
  let lightningT = 0, skyDirty = 0;
  const tmpC = new THREE.Color();
  W.applyLook = (seasonIdx, weatherKind, dt, snap) => {
    const L = LOOKS[clamp(seasonIdx, 0, 3)], wx = WX[weatherKind] || WX.clear;
    const k = snap ? 1 : 1 - Math.exp(-dt / 0.9);
    for (const key2 of ['top', 'hor', 'fog', 'sun', 'hs', 'hg']) { cur[key2] = mixRGB(cur[key2], hexRGB(L[key2]), k); }
    for (const key2 of ['sunI', 'hi', 'exp', 'mist', 'glow']) cur[key2] = lerp(cur[key2], L[key2], k);
    cur.dark = lerp(cur.dark, wx.dark, k); cur.rain = lerp(cur.rain, wx.rain, k); cur.haze = lerp(cur.haze, wx.haze, k);
    const dk = clamp(cur.dark, -0.2, 0.85), gray = [0.34, 0.37, 0.42];
    const top = mixRGB(cur.top, gray, clamp(dk, 0, 1)), hor = mixRGB(mixRGB(cur.hor, [0.95, 0.86, 0.6], clamp(cur.haze, 0, 1) * 0.6), mixRGB(gray, [0.6, 0.62, 0.66], 0.4), clamp(dk, 0, 1));
    skyDirty += 1;
    if (skyDirty % 4 === 0 || snap) paintSky(top, hor, mixRGB(hor, cur.fog, 0.6));
    key.color.setRGB(...cur.sun); key.intensity = cur.sunI * 0.6 * (1 - clamp(dk, 0, 0.85) * 0.85);
    hemi.color.setRGB(...mixRGB(cur.hs, gray, clamp(dk, 0, 1))); hemi.groundColor.setRGB(...cur.hg); hemi.intensity = cur.hi * (1 - clamp(dk, 0, 1) * 0.35) * 0.62;
    stage.renderer.toneMappingExposure = cur.exp * (1 - clamp(dk, 0, 1) * 0.1);
    const fogC = mixRGB(hor, cur.fog, 0.6);
    if (stage.scene.fog) stage.scene.fog.color.setRGB(...fogC);
    sunGlow.material.opacity = cur.glow * (1 - clamp(dk, 0, 1)) * 0.9; sunGlow.material.color.setRGB(...cur.sun);
    for (const c of clouds) { c.material.opacity = 0.7 + 0.3 * clamp(dk, 0, 1); c.material.color.setRGB(...mixRGB([1, 1, 1], [0.45, 0.48, 0.55], clamp(dk, 0, 1))); }
    setEnv({ ...L, idx: seasonIdx }, { dark: clamp(dk, 0, 0.8) });
    return fogC;
  };

  W.update = (G, dt, tReal, camera, vf) => {
    if (!W.ready) return;
    const f = vf || (G.farm && G.farm.f);
    W.U.time.value = tReal;
    const lv = W.level;
    // sky follows the camera, sun glow sits in the sky ahead of the camera
    dome.position.copy(camera.position);
    sunGlow.position.set(camera.position.x - 260, camera.position.y + 200, camera.position.z - 640);
    clouds.forEach((c, i) => { c.position.x += dt * (1.2 + (i % 3) * 0.6); if (c.position.x > 900) c.position.x = -900; });
    // water textures flow
    rippleNormal.offset.x = (tReal * 0.012) % 1; rippleNormal.offset.y = (tReal * 0.007) % 1;
    streakTex.offset.y = -(tReal * 1.6) % 1;
    if (W.canal) W.canal.flowTex.offset.x = -(tReal * 0.8) % 1;
    // plots
    const spring = f ? f.springNow : 0;
    const feeds = f ? f.feed.filter((x) => x === 1).length : 0;
    if (W.spring) W.spring.fall.material.opacity = f ? 0.55 + 0.35 * clamp(spring / 3, 0, 1) : 0.6;
    if (f) updatePlots(f, dt, tReal);
    // gates
    {
      const rc = W.gates.ribMesh ? W.gates.ribMesh.geometry.attributes.color : null; let dirtyR = false, dirtyP = false;
      for (const e of W.gates) {
        const st = f ? (e.g.kind === 'f' ? f.feed[e.g.c] : e.g.kind === 'd' ? f.down[e.g.r * lv.C + e.g.c] : f.side[e.g.r * (lv.C - 1) + e.g.c]) : 0;
        if (e.blocked || !e.plank) continue;
        const target = st === 1 ? 1 : 0, prev = e.open;
        e.open = lerp(e.open, target, 1 - Math.exp(-dt / 0.12));
        if (Math.abs(e.open - prev) > 1e-4 || e.dirty !== false) {
          const b = e.base; gm4.makeTranslation(b.x, b.y + 0.18 + 0.4 * e.open, b.z); e.im.setMatrixAt(e.ii, gm4); e.im.instanceMatrix.needsUpdate = true; e.dirty = false; dirtyP = true;
        }
        const flow = f ? (e.g.kind === 'f' ? f.flows.f[e.g.id] : e.g.kind === 'd' ? f.flows.d[e.g.id] : Math.abs(f.flows.s[e.g.id] || 0)) || 0 : 0;
        if (rc && e.rib >= 0) {
          const o = clamp(flow * 0.9, 0, 0.9) * (st === 1 ? 1 : 0), v = o > 0.02 ? o : 0;
          if (Math.abs((e.ribV || 0) - v) > 0.003) { e.ribV = v; for (let k = e.rib * 4; k < e.rib * 4 + 4; k++) rc.setXYZ(k, v * 0.75, v * 0.93, v); dirtyR = true; }
        }
      }
      void dirtyP; if (dirtyR) rc.needsUpdate = true;
    }
    void feeds;
    // decor
    updateDecor(G, f);
    // village
    const hs = G.houses || 1;
    if (W.village) W.village.houses.forEach((h, i) => { h.visible = i < hs; });
    // mist
    const mistAmt = cur.mist * (1 + cur.haze * 0.5);
    for (const m of W.mist || []) { m.material.opacity = mistAmt * (m.userData.high ? 0.22 : 0.3); m.position.x = m.userData.x0 + Math.sin(tReal * 0.04 * m.userData.sp + m.userData.ph) * 14; }
    // rain
    const rr = clamp(cur.rain, 0, 1);
    rain.material.opacity = rr * 0.42; rain.visible = rr > 0.03;
    if (rain.visible) {
      const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
      const slant = 0.12;
      for (let i = 0; i < RAIN; i++) {
        const s = rainSeed[i], t = ((s[1] + tReal * (G.paused ? 0 : 0.9 + (i % 5) * 0.06)) % 1);
        const x = cx + (s[0]) * 70 + (0.5 - t) * 8 * slant, z = cz - 26 + (s[2]) * 70 - 10, y = cy - 8 + (1 - t) * 40;
        const o = i * 6; rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z; rainPos[o + 3] = x - slant * 0.9; rainPos[o + 4] = y - 0.9; rainPos[o + 5] = z;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    if (f && f.weather.kind === 'storm') { lightningT -= dt; if (lightningT < -3.5 - (tReal * 7 % 4)) lightningT = 0.18; }
    else lightningT = 0;
    if (lightningT > 0) { key.intensity += 4 * lightningT * 5; hemi.intensity += 0.9; }
  };

  function updatePlots(f, dt, tReal) {
    for (const P of W.plots) {
      const p = f.plots[P.i];
      // water level: eased towards the simulation
      P.waterLevel = lerp(P.waterLevel, p.w, 1 - Math.exp(-dt / 0.18));
      const lvl = P.waterLevel;
      P.water.visible = lvl > 0.06;
      P.water.position.y = P.bedY + 0.03 + 0.118 * lvl;
      P.wm.opacity = clamp(0.42 + lvl * 0.12, 0.42, 0.85);
      const murk = clamp(p.soil, 0, 1);
      P.bed.material.color.setRGB(...mixRGB(hexRGB(0x93774f), hexRGB(0x3b2e22), murk));
      P.bed.material.roughness = lerp(0.95, 0.42, murk);
      // rice
      const sig = `${p.crop}|${Math.round(p.prog * 20)}|${Math.round(p.gold * 10)}|${Math.round(p.h * 10)}`;
      if (sig !== P.sig) { P.sig = sig; paintRice(P, p); }
    }
  }
  const rcol = new THREE.Color(), rm4 = new THREE.Matrix4(), rq = new THREE.Quaternion(), rp = new THREE.Vector3(), rs = new THREE.Vector3(), re = new THREE.Euler();
  function paintRice(P, p) {
    let sy = 0, c = [0.4, 0.7, 0.3];
    if (p.crop === CROP.SEEDLING) { sy = 0.16 + 0.5 * p.prog; c = mixRGB([0.58, 0.82, 0.38], [0.36, 0.7, 0.3], p.prog * 2); }
    else if (p.crop === CROP.GROWING) { sy = 0.34 + 0.55 * p.prog; c = mixRGB([0.36, 0.7, 0.3], [0.28, 0.6, 0.22], p.prog); }
    else if (p.crop === CROP.GOLD) { sy = 0.95; c = mixRGB([0.3, 0.62, 0.24], [0.93, 0.74, 0.22], clamp(0.25 + 0.75 * p.gold, 0, 1)); }
    else if (p.crop === CROP.DONE) { sy = 0.09; c = [0.72, 0.62, 0.36]; }
    else if (p.crop === CROP.LOST) { sy = 0.2; c = [0.45, 0.36, 0.2]; }
    const sick = clamp(1 - p.h, 0, 1);
    c = mixRGB(c, [0.7, 0.62, 0.22], sick * 0.7);
    P.rice.visible = sy > 0;
    if (!P.rice.visible) return;
    P.clumps.forEach((cl, i) => {
      re.set(0, cl.rot, 0); rq.setFromEuler(re); rp.set(cl.x, P.bedY + 0.02, cl.z); const hh = sy * cl.s * 0.9, ww = 1.5 * (0.85 + sy * 0.4); rs.set(ww, hh, ww);
      rm4.compose(rp, rq, rs); P.rice.setMatrixAt(i, rm4); P.rice.setColorAt(i, rcol.setRGB(c[0] * (0.88 + 0.24 * ((i * 37) % 7) / 7), c[1] * (0.9 + 0.2 * ((i * 17) % 5) / 5), c[2]));
    });
    P.rice.instanceMatrix.needsUpdate = true; if (P.rice.instanceColor) P.rice.instanceColor.needsUpdate = true;
  }

  function updateDecor(G, f) {
    const D = W.decor; if (!D) return;
    const season = f ? Math.min(3, f.season) : 1;
    const key2 = `${season}`;
    if (D.key === key2) return; D.key = key2;
    D.quads.forEach((d, i) => {
      const flooded = season === 0 ? d.r < 0.86 : season === 1 ? d.r < 0.32 : season === 2 ? d.r < 0.1 : d.r < 0.04;
      D.pos.set(d.x, d.y + 0.05, d.z); D.sc.set(flooded ? 1 : 0.0001, 1, flooded ? 1 : 0.0001); D.m4.compose(D.pos, D.q0, D.sc); D.waterMesh.setMatrixAt(i, D.m4);
      const base = season === 0 ? [0.56, 0.5, 0.3] : season === 1 ? mixRGB([0.5, 0.78, 0.3], [0.38, 0.68, 0.26], d.r) : season === 2 ? mixRGB([0.24, 0.6, 0.22], [0.34, 0.68, 0.25], d.r) : mixRGB([0.9, 0.72, 0.24], [0.8, 0.62, 0.2], d.r);
      const hgt = season === 0 ? 0 : season === 1 ? 0.28 : season === 2 ? 0.78 : 0.95;
      d.cl.forEach((c, j) => {
        const on = !flooded && hgt > 0;
        D.e.set(0, c.rot, 0); D.q.setFromEuler(D.e); D.pos.set(c.x, d.y + 0.02, c.z);
        const hh = on ? hgt * c.s * 0.9 : 0.0001, ww = on ? 1.5 * (0.85 + hgt * 0.4) : 0.0001;
        D.sc.set(ww, hh, ww); D.m4.compose(D.pos, D.q, D.sc); D.cropMesh.setMatrixAt(i * DEC_N + j, D.m4);
        D.cropMesh.setColorAt(i * DEC_N + j, D.col.setRGB(base[0] * (0.88 + 0.24 * c.v), base[1] * (0.9 + 0.2 * c.v), base[2]));
      });
    });
    D.waterMesh.instanceMatrix.needsUpdate = true; D.cropMesh.instanceMatrix.needsUpdate = true; if (D.cropMesh.instanceColor) D.cropMesh.instanceColor.needsUpdate = true;
  }
  void BUND; void plotX; void lerp;
  return W;
}

// merge simple geometries (same attributes) into one
function mergeGeos(THREE, geos) {
  const pos = [], nor = [], idx = [];
  let off = 0;
  for (const g of geos) {
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
    const ix = g.index ? g.index.array : null;
    if (ix) for (let i = 0; i < ix.length; i++) idx.push(ix[i] + off); else for (let i = 0; i < p.length / 3; i++) idx.push(i + off);
    off += p.length / 3;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setIndex(idx);
  return out;
}

// merge {geo, matrix, color} parts into one geometry with position, normal, uv and a vertex colour (so a whole set of props is ONE draw call)
function mergeColored(THREE, parts) {
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  let off = 0;
  for (const { geo, matrix, color } of parts) {
    const p = geo.attributes.position, n = geo.attributes.normal, u = geo.attributes.uv;
    nm.getNormalMatrix(matrix);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
      uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); col.push(color[0], color[1], color[2]);
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) idx.push(geo.index.getX(i) + off); else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); out.setIndex(idx);
  return out;
}

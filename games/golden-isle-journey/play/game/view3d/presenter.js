// The lit 3D layer behind the shadow-theatre screen (game-owned). It only READS the per-frame record in src/v3.js
// (what the painted sky / sun / stars / sea / island calls would have drawn, in screen fractions) and renders the same
// composition for real: a shader sky with a sun corona and stars, a perspective ocean with moving swells, Fresnel sky
// reflection and a sun-glitter path, and the golden city of Lanka as lit 3D towers on its island, reflected in the sea.
// The puppets, hills, HUD and menus stay on the transparent kit canvas on top. Without WebGL2 nothing is created.
import { v3 } from '../src/v3.js';

const LIB = '../vendor3d/index.js';

const SKY_GLSL = /* glsl */`
uniform vec3 uStops[4]; uniform float uY0, uY1;
uniform vec3 uStopsB[4]; uniform float uMixB, uY0B, uY1B;
vec3 grad(vec3 s[4], float u) {
  u = clamp(u, 0.0, 1.0) * 3.0;
  if (u < 1.0) return mix(s[0], s[1], smoothstep(0.0, 1.0, u));
  if (u < 2.0) return mix(s[1], s[2], smoothstep(0.0, 1.0, u - 1.0));
  return mix(s[2], s[3], smoothstep(0.0, 1.0, u - 2.0));
}
vec3 skyAt(float v) {   // v: screen fraction from the top
  vec3 a = grad(uStops, (v - uY0) / max(1e-4, uY1 - uY0));
  vec3 b = grad(uStopsB, (v - uY0B) / max(1e-4, uY1B - uY0B));
  return mix(a, b, uMixB);
}
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
`;

export async function createPresenter({ kitCanvas, getGame }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('3D layer unavailable; painted backdrops stay', e); return null; }
  const { THREE, webglSupported } = V3;
  if (webglSupported && !webglSupported()) return null;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;opacity:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch (e) { canvas.remove(); return null; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  let tier = 2;                                   // 2 = DPR up to 2, 1 = DPR 1.25, 0 = DPR 1 + calmer sea
  const dprFor = () => Math.min(window.devicePixelRatio || 1, tier === 2 ? 2 : tier === 1 ? 1.25 : 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 6000);
  const CAM_H = 7;

  // ---------------- sky (screen-space quad drawn first) ----------------
  const stops = () => [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()];
  const U = {
    uStops: { value: stops() }, uY0: { value: 0 }, uY1: { value: 1 },
    uStopsB: { value: stops() }, uMixB: { value: 0 }, uY0B: { value: 0 }, uY1B: { value: 1 },
    uSun: { value: new THREE.Vector3(0.6, 0.55, 0.05) }, uSunCol: { value: new THREE.Color(1, 0.85, 0.6) }, uSunA: { value: 0 },
    uStars: { value: new THREE.Vector3(0, 0, 0.6) }, uTime: { value: 0 }, uAspect: { value: 0.5 }, uHorizon: { value: 0.62 }, uSeaOn: { value: 0 },
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: U, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }',
    fragmentShader: SKY_GLSL + /* glsl */`
      uniform vec3 uSun; uniform vec3 uSunCol; uniform float uSunA; uniform vec3 uStars; uniform float uTime, uAspect, uHorizon, uSeaOn;
      varying vec2 vUv;
      void main() {
        float v = 1.0 - vUv.y; vec2 p = vec2(vUv.x * uAspect, v);
        vec3 c = skyAt(v);
        // high cirrus streaks catching the low sun (slow drift)
        float wisp = fbm(vec2(p.x * 2.2 + uTime * 0.004, p.y * 9.0));
        float band = smoothstep(0.52, 0.8, wisp) * smoothstep(0.02, 0.3, v) * (1.0 - smoothstep(uHorizon - 0.02, uHorizon + 0.01, v) * uSeaOn);
        vec2 sp = vec2(uSun.x * uAspect, uSun.y);
        float d = length(p - sp);
        c = mix(c, mix(c, uSunCol, 0.55) * 1.25, band * 0.32);
        if (uStars.x > 0.001) {
          vec2 g = floor(gl_FragCoord.xy / 3.0); float h = hash12(g);
          float tw = 0.6 + 0.4 * sin(uTime * (1.0 + h * 3.0) + h * 40.0);
          float sm = step(0.9965, h) * (1.0 - smoothstep(uStars.y, uStars.z, v)) * uStars.x * tw;
          c += vec3(1.0, 0.95, 0.85) * sm * 0.9;
        }
        if (uSunA > 0.001) {
          float r = max(uSun.z, 0.004);
          float disk = 1.0 - smoothstep(r * 0.92, r * 1.04, d);
          float corona = exp(-d / min(r * 1.4, 0.05)) * 0.9 + exp(-d / min(r * 5.0, 0.12)) * 0.4 + exp(-d / min(r * 16.0, 0.3)) * 0.18;
          float haze = exp(-abs(v - min(uSun.y + r, uHorizon)) * 26.0) * exp(-abs(p.x - sp.x) * 1.8) * 0.35;
          c += uSunCol * (corona + haze) * uSunA;
          float limb = sqrt(max(0.0, 1.0 - (d * d) / (r * r)));
          c = mix(c, mix(uSunCol * 1.1, vec3(1.0, 0.97, 0.86) * 1.5, 0.35 + 0.65 * limb), disk * uSunA);
          float ang = atan(p.y - sp.y, p.x - sp.x);
          float ray = pow(0.5 + 0.5 * sin(ang * 9.0 + uTime * 0.05) * sin(ang * 5.0 - uTime * 0.03), 3.0);
          c += uSunCol * ray * exp(-d / min(r * 9.0, 0.25)) * 0.16 * uSunA;
        }
        c += (hash12(gl_FragCoord.xy + uTime) - 0.5) / 255.0;   // dither: no banding in the long gradients
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const skyQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat);
  skyQuad.frustumCulled = false; skyQuad.renderOrder = -10;
  scene.add(skyQuad);

  // ---------------- ocean ----------------
  const OU = {
    ...U,
    uDeep: { value: new THREE.Color('#141032') }, uNear: { value: new THREE.Color('#0b0a24') }, uCrest: { value: new THREE.Color(1, 0.8, 0.6) },
    uSunDir: { value: new THREE.Vector3(0, 0.1, -1) }, uCam: { value: new THREE.Vector3() }, uTanHalf: { value: 0.32 },
    uIsle: { value: new THREE.Vector4(0, 0, -1500, 0) }, uIsleCol: { value: new THREE.Color(1, 0.75, 0.4) }, uScroll: { value: 0 }, uDetail: { value: 1 },
  };
  const seaMat = new THREE.ShaderMaterial({
    uniforms: OU, toneMapped: false,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: SKY_GLSL + /* glsl */`
      uniform vec3 uDeep, uNear, uCrest, uSunDir, uCam, uSunCol; uniform float uSunA, uTime, uHorizon, uTanHalf, uScroll, uDetail;
      uniform vec4 uIsle; uniform vec3 uIsleCol;
      varying vec3 vW;
      vec3 waveN(vec2 p, float dist) {
        vec2 g = vec2(0.0);
        for (int i = 0; i < 6; i++) {
          float fi = float(i);
          float a = fi * 2.399 + 0.4;
          vec2 dir = vec2(cos(a), sin(a));
          float k = 0.05 * pow(1.62, fi), sp = sqrt(9.8 * k);
          float ph = dot(dir, p) * k + uTime * sp + fi * 1.7;
          float amp = 0.5 / (1.0 + fi * 0.8);
          float fade = 1.0 - smoothstep(25.0 / k, 120.0 / k, dist);
          g += dir * cos(ph) * amp * k * mix(1.0, fade, uDetail);
        }
        return normalize(vec3(-g.x, 1.0, -g.y));
      }
      void main() {
        vec3 V = vW - uCam; float dist = length(V); V /= dist;
        vec2 p = vW.xz + vec2(uScroll, 0.0);
        vec3 n = waveN(p, dist);
        n = normalize(mix(n, vec3(0.0, 1.0, 0.0), smoothstep(300.0, 3000.0, dist) * 0.8));
        vec3 R = reflect(V, n); R.y = abs(R.y);
        float vr = uHorizon - (R.y / max(0.05, length(R.xz))) * 0.5 / uTanHalf;
        vec3 refl = skyAt(vr);
        float fres = 0.02 + 0.98 * pow(1.0 - max(0.0, dot(n, -V)), 5.0);
        float depthMix = smoothstep(30.0, 900.0, dist);
        vec3 water = mix(uNear, uDeep, depthMix);
        vec3 c = mix(water, refl * 0.72, clamp(fres, 0.0, 0.85));
        float sd = max(0.0, dot(R, uSunDir));
        float glit = pow(sd, 1400.0) * 5.0 + pow(sd, 220.0) * 0.45 + pow(sd, 40.0) * 0.05;
        c += uSunCol * glit * uSunA * step(0.0, uSunDir.y + 0.02);
        if (uIsle.w > 0.001) {
          vec3 L = normalize(uIsle.xyz - vW);
          float id = max(0.0, dot(R, L));
          c += uIsleCol * (pow(id, 260.0) * 2.4 + pow(id, 36.0) * 0.3) * uIsle.w;
        }
        c += uCrest * (1.0 - smoothstep(0.86, 0.98, n.y)) * 0.05 * (1.0 - depthMix);
        c = mix(c, skyAt(uHorizon - 0.004) * 0.92, smoothstep(600.0, 3600.0, dist));
        c += (hash12(gl_FragCoord.xy + uTime) - 0.5) / 255.0;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000, 1, 1), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.frustumCulled = false; sea.renderOrder = -5;
  scene.add(sea);

  // ---------------- lights + environment (gold reflects the chapter's own sky) ----------------
  const sunLight = new THREE.DirectionalLight(0xffd0a0, 3.2); scene.add(sunLight); scene.add(sunLight.target);
  const hemi = new THREE.HemisphereLight(0x8a6aa8, 0x1a1030, 0.9); scene.add(hemi);
  // a warm fill from the viewer's side: the lamp behind the screen, so the city's faces read as gold, not silhouette
  const fill = new THREE.DirectionalLight(0xffc890, 1.5); fill.position.set(200, 400, 1500); scene.add(fill); scene.add(fill.target); fill.target.position.set(0, 0, -1500);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envKey = '', envRT = null;
  function buildEnv(stopsArr, sunCol) {
    const key = stopsArr.map((c) => c.getHexString()).join('') + sunCol.getHexString();
    if (key === envKey) return; envKey = key;
    const es = new THREE.Scene();
    const g = new THREE.SphereGeometry(50, 32, 16), pos = g.attributes.position, cols = [];
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 50, u = Math.min(1, Math.max(0, 1 - y)) * 0.98;      // zenith -> stop 0, horizon -> stop 3
      const k = Math.min(2.999, u * 3), i0 = Math.floor(k), c = stopsArr[i0].clone().lerp(stopsArr[i0 + 1], k - i0);
      if (y < -0.05) c.multiplyScalar(0.3);
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    es.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const sunM = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 8), new THREE.MeshBasicMaterial({ color: sunCol.clone().multiplyScalar(12) }));
    sunM.position.set(0, 5, -42); es.add(sunM);
    const old = envRT; envRT = pmrem.fromScene(es, 0.02); scene.environment = envRT.texture; if (old) old.dispose();
    g.dispose();
  }

  // ---------------- the golden island ----------------
  const isle = buildIsland(THREE);
  scene.add(isle.group);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex(THREE), color: 0xffb860, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
  halo.renderOrder = -4; scene.add(halo);

  // ---------------- per-frame ----------------
  const setStops = (arr, list) => { for (let i = 0; i < 4; i++) arr[i].set(list[Math.min(i, list.length - 1)]).convertSRGBToLinear(); };
  const rgbCol = (s, out) => { const [r, g, b] = String(s).split(',').map(Number); return out.setRGB(r / 255, g / 255, b / 255).convertSRGBToLinear(); };
  const white = new THREE.Color(1, 1, 1);
  let shownMix = -1, lastNow = performance.now(), slow = 0, lost = false, W = 0, H = 0, frames = 0;

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    const dpr = dprFor();
    if (w === W && h === H && renderer.getPixelRatio() === dpr) return;
    W = w; H = h; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
  }

  function frame() {
    const now = performance.now(), wall = Math.min(0.1, (now - lastNow) / 1000); lastNow = now;
    if (lost) return;
    const r = v3.rec, has = !!(r && r.sky);
    // the 2D stand-ins fade out at the same rate the 3D layer fades in (no pop); a frame without a sky hides the layer
    if (v3.ready && has && frames > 1) v3.mix = Math.min(1, v3.mix + wall / 0.45);
    const target = has ? v3.mix : 0;
    if (target !== shownMix) { shownMix = target; canvas.style.opacity = String(shownMix); }
    if (!has) return;
    frames++;
    resize();
    if (wall > 0.034) slow++; else slow = Math.max(0, slow - 0.25);
    if (slow > 45 && tier > 0) { tier--; slow = 0; W = 0; resize(); OU.uDetail.value = tier === 0 ? 0 : 1; }

    const aspect = W / Math.max(1, H), st = getGame()?.getState?.(), t = r.sea ? r.sea.t : (st?.t ?? 0);
    U.uAspect.value = aspect; U.uTime.value = t;
    setStops(U.uStops.value, r.sky.stops); U.uY0.value = r.sky.y0; U.uY1.value = r.sky.y1;
    if (r.sky2) { setStops(U.uStopsB.value, r.sky2.stops); U.uMixB.value = r.sky2.a; U.uY0B.value = r.sky2.y0; U.uY1B.value = r.sky2.y1; } else U.uMixB.value = 0;
    if (r.sun) { U.uSun.value.set(r.sun.x, r.sun.y, r.sun.r); rgbCol(r.sun.rgb, U.uSunCol.value); U.uSunA.value = r.sun.a; } else U.uSunA.value = 0;
    if (r.stars) U.uStars.value.set(r.stars.a, r.stars.y0, r.stars.y1); else U.uStars.value.set(0, 0, 1);

    // camera: level, at mast height, horizon pinned to the painted horizon line
    const hz = r.sea ? r.sea.y : (r.island ? r.island.y : 0.62);
    U.uHorizon.value = hz; U.uSeaOn.value = r.sea ? 1 : 0;
    const fov = 36, th = Math.tan((fov * Math.PI) / 360);
    camera.fov = fov; camera.aspect = aspect; camera.updateProjectionMatrix();
    camera.projectionMatrix.elements[9] = -(1 - 2 * hz); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.position.set(0, CAM_H + Math.sin(t * 0.37) * 0.25, 0); camera.rotation.set(0, 0, 0); camera.updateMatrixWorld();
    OU.uCam.value.copy(camera.position); OU.uTanHalf.value = th;
    sea.visible = !!r.sea;
    if (r.sea) {
      const cs = r.sea.colors; OU.uDeep.value.set(cs[0]).convertSRGBToLinear(); OU.uNear.value.set(cs[cs.length - 1]).convertSRGBToLinear();
      rgbCol(r.sea.crest, OU.uCrest.value); OU.uScroll.value = r.sea.scroll * 60;
    }
    // sun direction from its screen position (the ray through that pixel)
    const sx = (U.uSun.value.x - 0.5) * 2 * aspect * th, sy = (hz - U.uSun.value.y) * 2 * th;
    OU.uSunDir.value.set(sx, sy, -1).normalize();
    sunLight.position.set(sx * 1000, Math.max(80, sy * 1000 + 120), -1500 + 1000); sunLight.target.position.set(0, 0, -1500);
    sunLight.color.copy(U.uSunCol.value); sunLight.intensity = 2.2 + 1.6 * U.uSunA.value;
    hemi.color.copy(U.uStops.value[1]).lerp(white, 0.2); hemi.groundColor.copy(OU.uNear.value);
    buildEnv(U.uStops.value, U.uSunCol.value);

    // the island: base centre on the recorded screen point, width as recorded (both in screen-height fractions)
    if (r.island && r.island.glow > 0.01) {
      const D = 1500, wW = r.island.w * 2 * D * th, x = (r.island.x - 0.5) * 2 * aspect * D * th, y = (hz - r.island.y) * 2 * D * th;
      isle.group.visible = true; halo.visible = true;
      isle.group.position.set(x, y, -D); isle.group.scale.setScalar(wW);
      isle.update(t, r.island.glow);
      OU.uIsle.value.set(x, y + wW * 0.12, -D, 0.6 * r.island.glow);
      halo.position.set(x, y + wW * 0.14, -D - 60); halo.scale.set(wW * 1.7, wW * 0.75, 1); halo.material.opacity = 0.38 * r.island.glow;
    } else { isle.group.visible = false; halo.visible = false; OU.uIsle.value.w = 0; }
    renderer.render(scene, camera);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.ready = false; v3.mix = 0; shownMix = 0; canvas.style.opacity = '0'; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; envKey = ''; W = 0; frames = 0; v3.ready = true; });

  resize();
  v3.ready = true;
  return { frame, renderer, scene, camera, canvas, island: isle, setTier: (k) => { tier = k; W = 0; } };
}

function radialTex(THREE) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Lanka: a rocky island rising from the sea, terraced walls, and tiered golden towers (stepped like the painted city), finials,
// lamp-lit windows. Unit width = 1 (scaled by the presenter). Deterministic layout.
function buildIsland(THREE) {
  const group = new THREE.Group();
  const h = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const rock = new THREE.MeshStandardMaterial({ color: 0x4a2c40, roughness: 0.9, metalness: 0.0 });
  const green = new THREE.MeshStandardMaterial({ color: 0x2c4a34, roughness: 0.95 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc56a, roughness: 0.3, metalness: 1.0, envMapIntensity: 1.5 });
  const goldDark = new THREE.MeshStandardMaterial({ color: 0xe6ad62, roughness: 0.38, metalness: 0.95, envMapIntensity: 1.3 });
  const wallM = new THREE.MeshStandardMaterial({ color: 0xc89a68, roughness: 0.7, metalness: 0.1 });
  const lampM = new THREE.MeshBasicMaterial({ color: 0xffc070, toneMapped: false });

  const body = new THREE.SphereGeometry(0.5, 72, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
    const k = 1 + 0.07 * Math.sin(a * 5 + 1) + 0.04 * Math.sin(a * 11);
    p.setXYZ(i, x * k, y * 0.3 * (0.9 + 0.2 * Math.sin(a * 3)), z * k * 0.55);
  }
  body.computeVertexNormals();
  const bodyM = new THREE.Mesh(body, rock); bodyM.position.y = -0.015; group.add(bodyM);
  const shore = new THREE.Mesh(new THREE.CylinderGeometry(0.51, 0.54, 0.016, 56, 1), green); shore.scale.z = 0.55; group.add(shore);

  const m = new THREE.Matrix4();
  const rings = [[0.4, 0.045, 0.035], [0.28, 0.1, 0.04]];
  rings.forEach(([rad, y, hh], ri) => {
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.05, hh, 48, 1, true), wallM); wall.scale.z = 0.5; wall.position.y = y + hh / 2; group.add(wall);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(rad * 1.0, rad * 1.0, 0.006, 48), goldDark); cap.scale.z = 0.5; cap.position.y = y + hh; group.add(cap);
    const n = Math.round(rad * 120), inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.011, 0.011, 0.011), wallM, n);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; m.makeTranslation(Math.cos(a) * rad, y + hh + 0.008, Math.sin(a) * rad * 0.5); inst.setMatrixAt(i, m); }
    group.add(inst);
    const wn = Math.round(rad * 46), win = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.007, 0.012), lampM, wn);
    let k = 0; for (let i = 0; i < wn; i++) { const a = Math.PI * (0.12 + 0.76 * (i / wn)); if (h(i + ri * 31) < 0.35) continue; m.makeTranslation(Math.cos(a) * rad * 1.012, y + hh * 0.45, Math.sin(a) * rad * 0.512); win.setMatrixAt(k++, m); }
    win.count = k; group.add(win);
  });

  const spots = [[0, 0.14, 0.0, 1.0], [-0.12, 0.14, 0.05, 0.72], [0.13, 0.14, 0.04, 0.76], [-0.24, 0.08, 0.08, 0.52], [0.25, 0.08, 0.07, 0.55],
    [-0.06, 0.14, -0.07, 0.64], [0.07, 0.14, -0.06, 0.6], [-0.34, 0.05, 0.1, 0.36], [0.35, 0.05, 0.09, 0.38], [0.0, 0.1, 0.12, 0.42], [-0.18, 0.1, -0.06, 0.46], [0.19, 0.1, -0.05, 0.48]];
  const tierGeo = new THREE.CylinderGeometry(0.72, 1, 1, 4, 1); tierGeo.rotateY(Math.PI / 4);
  const rimGeo = new THREE.BoxGeometry(1, 1, 1);
  spots.forEach(([x, y, z, s], idx) => {
    const tw = new THREE.Group(); tw.position.set(x, y, z);
    let w = 0.085 * s, yy = 0.04 * s; const tiers = 3 + Math.floor(h(idx * 3) * 2);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w * 1.3, 0.04 * s, w * 1.3), wallM); plinth.position.y = 0.02 * s; tw.add(plinth);
    const lit = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.45, 0.026 * s), lampM); lit.position.set(0, 0.02 * s, w * 0.66); tw.add(lit);
    for (let j = 0; j < tiers; j++) {
      const th = (0.03 + h(idx + j * 7) * 0.012) * s;
      const tier = new THREE.Mesh(tierGeo, j % 2 ? goldDark : gold); tier.scale.set(w, th, w); tier.position.y = yy + th / 2; tw.add(tier);
      const rim = new THREE.Mesh(rimGeo, gold); rim.scale.set(w * 1.48, 0.006 * s, w * 1.48); rim.position.y = yy + 0.003 * s; tw.add(rim);
      yy += th; w *= 0.74;
    }
    const fin = new THREE.Mesh(new THREE.CylinderGeometry(0.0, w * 0.5, 0.035 * s, 8), gold); fin.position.y = yy + 0.0175 * s; tw.add(fin);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.007 * s + 0.002, 10, 8), gold); orb.position.y = yy + 0.038 * s; tw.add(orb);
    group.add(tw);
  });
  group.traverse((o) => { o.frustumCulled = false; });
  return {
    group,
    update(t, glow) { lampM.color.setRGB(1, 0.72, 0.4).multiplyScalar(1.4 + 0.6 * glow + 0.12 * Math.sin(t * 3.1)); },
  };
}

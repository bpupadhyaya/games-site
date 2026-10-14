// Golden-hour sky dome + a real shaded sea (analytic wave normals, fresnel sky reflection, sun glitter, shore shallows and surf
// from a baked shore map) + ship wake ribbon + spray. Presentation only: it reads numbers the presenter hands in.
// The wave function in JS (`seaHeight`) matches the shader's wave set so hulls can ride the swell.
import { THREE } from '../vendor3d/index.js';
import { TAU, clamp, canvas, texOf, hash1 } from './util.js';

const { ShaderMaterial, Mesh, PlaneGeometry, SphereGeometry, Color, Vector3, Vector2, BackSide, DoubleSide, BufferGeometry, Float32BufferAttribute,
  Points, PointsMaterial, AdditiveBlending, MeshBasicMaterial, CanvasTexture, SRGBColorSpace } = THREE;

// ---- waves (shared with GLSL) --------------------------------------------------------------------------------------------------------
// [dirX, dirZ, wavelength, amplitude, speed]
export const WAVES = [
  [0.82, 0.57, 17.0, 0.34, 1.9],
  [-0.4, 0.92, 9.5, 0.2, 1.6],
  [0.95, -0.3, 5.4, 0.1, 2.2],
  [-0.7, -0.7, 3.1, 0.05, 2.6],
];
export function seaHeight(x, z, t, k = 1) {
  let h = 0;
  for (const [dx, dz, wl, a, sp] of WAVES) { const f = TAU / wl; h += Math.sin((dx * x + dz * z) * f + t * sp) * a * k; }
  return h;
}
export function seaSlope(x, z, t, k = 1) {
  let sx = 0, sz = 0;
  for (const [dx, dz, wl, a, sp] of WAVES) { const f = TAU / wl, c = Math.cos((dx * x + dz * z) * f + t * sp) * a * f * k; sx += dx * c; sz += dz * c; }
  return [sx, sz];
}

export const SUN_DIR = new Vector3(-0.52, 0.3, -0.8).normalize();

const SKY_GLSL = `
uniform vec3 uSunDir, uSunCol, uHorizon, uMid, uZenith;
vec3 skyColor(vec3 d){
  float h = clamp(d.y, -0.05, 1.0);
  vec3 c = mix(uHorizon, uMid, smoothstep(0.0, 0.2, h));
  c = mix(c, uZenith, smoothstep(0.16, 0.85, h));
  float sd = max(dot(normalize(d), uSunDir), 0.0);
  c += uSunCol * (pow(sd, 5.0) * 0.28 + pow(sd, 40.0) * 0.55);
  return c;
}`;

const NOISE_GLSL = `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return s; }
`;

const UNI = () => ({
  uSunDir: { value: SUN_DIR.clone() }, uSunCol: { value: new Color('#ffb066') },
  uHorizon: { value: new Color('#f6c58f') }, uMid: { value: new Color('#e69a78') }, uZenith: { value: new Color('#3b6f98') },
});

export function createSky() {
  const uni = { ...UNI(), uTime: { value: 0 }, uCloud: { value: 0.55 } };
  const mat = new ShaderMaterial({
    uniforms: uni, side: BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.9999; }`,
    fragmentShader: `${SKY_GLSL}${NOISE_GLSL}
      uniform float uTime, uCloud; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        vec3 c = skyColor(d);
        float sd = max(dot(d, uSunDir), 0.0);
        c += vec3(1.0, 0.97, 0.88) * smoothstep(0.99935, 0.99975, sd) * 4.0;
        // clouds: two drifting bands, lit warm on the sun side
        if (d.y > 0.01) {
          vec2 q = d.xz / (d.y + 0.22) * 1.25 + vec2(uTime * 0.004, uTime * 0.0015);
          float n = fbm(q * 1.6), n2 = fbm(q * 3.4 + 7.0);
          float cm = smoothstep(0.5, 0.78, n * 0.75 + n2 * 0.35) * smoothstep(0.0, 0.18, d.y) * (1.0 - smoothstep(0.55, 0.95, d.y) * 0.7) * uCloud;
          float rim = clamp((fbm(q * 1.6 + uSunDir.xz * 0.12) - n) * 5.0, 0.0, 1.0);
          vec3 cc = mix(vec3(0.62, 0.45, 0.45), uSunCol * 1.15, 0.35 + 0.65 * (rim + smoothstep(0.7, 1.0, sd) * 0.6));
          c = mix(c, cc, clamp(cm, 0.0, 0.92));
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new Mesh(new SphereGeometry(900, 32, 20), mat);
  mesh.renderOrder = -10; mesh.frustumCulled = false;
  return { mesh, uni };
}

// ---- shore map: where is land / shallow, baked once from the island outlines ------------------------------------------------------------
export const SHORE = { x0: -30, z0: -30, size: 160 };
export function islandRadius(rad, seed, th) { return rad * (1 + 0.22 * Math.sin(th * 2 + seed * 1.7) + 0.14 * Math.sin(th * 3 + seed * 3.1) + 0.08 * Math.sin(th * 5 + seed * 0.7)); }
export function bakeShore(islands) {
  const N = 512, c = canvas(N), x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, N, N);
  const px = (w) => (w / SHORE.size) * N;
  x.globalCompositeOperation = 'lighter';
  for (const isl of islands) {
    const levels = [[2.35, 0.07], [2.0, 0.09], [1.7, 0.11], [1.45, 0.13], [1.25, 0.16], [1.1, 0.2]];
    for (const [k, a] of levels) {
      x.fillStyle = `rgba(255,255,255,${a})`; x.beginPath();
      for (let i = 0; i <= 48; i++) { const th = (i % 48) / 48 * TAU, rr = islandRadius(isl.R, isl.seed, th) * k, X = px(isl.x - SHORE.x0 + Math.cos(th) * rr), Y = px(isl.z - SHORE.z0 + Math.sin(th) * rr * 0.82); i ? x.lineTo(X, Y) : x.moveTo(X, Y); }
      x.fill();
    }
  }
  x.globalCompositeOperation = 'source-over';
  const t = new CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}

export function createSea(shoreTex) {
  const uni = {
    ...UNI(), uTime: { value: 0 }, uShore: { value: shoreTex },
    uShoreRect: { value: new Vector3(SHORE.x0, SHORE.z0, SHORE.size) },
    uDeep: { value: new Color('#06617a') }, uMidW: { value: new Color('#12a0ab') }, uShallow: { value: new Color('#5fe6cf') }, uSand: { value: new Color('#d6f7da') },
    uWaves: { value: WAVES.map((w) => new THREE.Vector4(w[0], w[1], TAU / w[2], w[3])) },
    uSpeeds: { value: WAVES.map((w) => w[4]) },
    uFogK: { value: 0.0011 }, uCalm: { value: 0 }, uChop: { value: 1 },
  };
  const mat = new ShaderMaterial({
    uniforms: uni, fog: false,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${SKY_GLSL}${NOISE_GLSL}
      uniform float uTime, uFogK, uCalm, uChop; uniform sampler2D uShore; uniform vec3 uShoreRect;
      uniform vec3 uDeep, uMidW, uShallow, uSand; uniform vec4 uWaves[4]; uniform float uSpeeds[4];
      varying vec3 vW;
      void main(){
        vec3 toCam = cameraPosition - vW; float dist = length(toCam); vec3 V = toCam / dist;
        vec2 p = vW.xz;
        float sx = 0.0, sz = 0.0;
        for (int i = 0; i < 4; i++) {
          vec4 w = uWaves[i];
          float c = cos(dot(w.xy, p) * w.z + uTime * uSpeeds[i]) * w.w * w.z;
          sx += w.x * c; sz += w.y * c;
        }
        // fine ripples (fade with distance to avoid shimmer)
        float far = 1.0 / (1.0 + dist * 0.012);
        vec2 q = p * 0.9 + vec2(uTime * 0.18, -uTime * 0.11);
        float r1 = vn(q * 1.7) - 0.5, r2 = vn(q * 3.3 + 9.0) - 0.5;
        float rx = (vn(q * 2.1 + vec2(3.0, 1.0)) - 0.5) * 0.5, rz = (vn(q * 2.1 + vec2(11.0, 5.0)) - 0.5) * 0.5;
        sx = sx * (1.0 - uCalm * 0.7) + (rx + r1 * 0.2) * 0.55 * far * uChop;
        sz = sz * (1.0 - uCalm * 0.7) + (rz + r2 * 0.2) * 0.55 * far * uChop;
        vec3 n = normalize(vec3(-sx, 1.0, -sz));
        // shore: shallow factor 0 (open sea) .. 1 (beach)
        vec2 suv = (p - uShoreRect.xy) / uShoreRect.z;
        float sh = 0.0;
        if (suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0) sh = texture2D(uShore, suv).r;
        sh = clamp(sh + (fbm(p * 0.35 + uTime * 0.03) - 0.5) * 0.08 * step(0.02, sh), 0.0, 1.0);
        vec3 base = mix(uDeep, uMidW, smoothstep(0.0, 0.35, sh));
        base = mix(base, uShallow, smoothstep(0.3, 0.78, sh));
        base = mix(base, uSand, smoothstep(0.78, 1.0, sh) * 0.85);
        // light scattered in the crests
        float crest = clamp(sx * 0.0 + (n.x * uSunDir.x + n.z * uSunDir.z) * -0.8, 0.0, 1.0);
        base += uShallow * 0.12 * crest * (1.0 - sh);
        vec3 R = reflect(-V, n); R.y = abs(R.y);
        float F = 0.03 + 0.97 * pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 5.0);
        vec3 refl = skyColor(R);
        vec3 c = mix(base, refl, clamp(F * (0.9 - sh * 0.35), 0.0, 0.95));
        c += skyColor(vec3(0.0, 1.0, 0.0)) * 0.1 * (1.0 - sh);
        // sun glitter
        float sd = max(dot(R, uSunDir), 0.0);
        float sparkle = 0.55 + 0.9 * vn(p * 2.8 + uTime * 0.9);
        c += uSunCol * (pow(sd, 380.0) * 14.0 * sparkle + pow(sd, 36.0) * 0.28);
        // surf: foam where the water gets very shallow, breaking in lines
        float band = smoothstep(0.62, 0.9, sh) * (1.0 - smoothstep(0.93, 1.0, sh));
        float lines = 0.5 + 0.5 * sin((sh * 46.0) - uTime * 1.3 + fbm(p * 0.7) * 5.0);
        float foam = band * smoothstep(0.35, 0.95, lines) * (0.55 + 0.45 * fbm(p * 1.4 + uTime * 0.2));
        foam += smoothstep(0.86, 0.97, sh) * (1.0 - smoothstep(0.97, 1.0, sh)) * 0.7;
        c = mix(c, vec3(1.0, 0.98, 0.92), clamp(foam, 0.0, 0.92) * 0.9);
        // whitecaps on the steepest wave tops
        float cap = smoothstep(0.34, 0.6, length(vec2(sx, sz))) * (1.0 - sh) * far * 0.5;
        c = mix(c, vec3(1.0), cap * (0.5 + 0.5 * vn(p * 3.0 + uTime)));
        // haze to the horizon
        float f = 1.0 - exp(-dist * uFogK * (1.0 + max(0.0, 0.4 - V.y) * 3.0));
        c = mix(c, uHorizon * 1.04, clamp(f, 0.0, 1.0));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new Mesh(new PlaneGeometry(2400, 2400, 1, 1), mat);
  mesh.rotation.x = -Math.PI / 2; mesh.frustumCulled = false; mesh.renderOrder = -5;
  return { mesh, uni };
}

// ---- wake: a ribbon of foam trailing the hull, widening and fading with age ------------------------------------------------------------
let foamTex = null;
function foamTexture() {
  if (foamTex) return foamTex;
  const W = 128, H = 128, c = canvas(W, H), x = c.getContext('2d');
  const id = x.createImageData(W, H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const u = i / (W - 1), v = j / (H - 1);
    const edge = Math.pow(Math.sin(Math.PI * v), 1.2);
    let n = 0, a = 0.5, f = 7;
    for (let o = 0; o < 4; o++) { n += a * (hash1(Math.floor(u * f) * 7.1 + Math.floor(v * f) * 3.3 + o * 5) * 0.6 + 0.4 * (Math.sin(u * f * 3 + o) * 0.5 + 0.5)); a *= 0.5; f *= 2; }
    const val = clamp((n - 0.35) * 1.8, 0, 1) * edge;
    const k = (j * W + i) * 4; id.data[k] = 255; id.data[k + 1] = 255; id.data[k + 2] = 255; id.data[k + 3] = Math.round(255 * val);
  }
  x.putImageData(id, 0, 0);
  foamTex = texOf(c, { srgb: true }); foamTex.wrapS = THREE.RepeatWrapping; return foamTex;
}
export function createWake(maxN = 70) {
  const g = new BufferGeometry();
  const pos = new Float32Array(maxN * 2 * 3), uv = new Float32Array(maxN * 2 * 2), alpha = new Float32Array(maxN * 2), idx = [];
  for (let i = 0; i < maxN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2)); g.setAttribute('aAlpha', new Float32BufferAttribute(alpha, 1)); g.setIndex(idx);
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false, side: DoubleSide, uniforms: { uMap: { value: foamTexture() } },
    vertexShader: `attribute float aAlpha; varying float vA; varying vec2 vUv; void main(){ vA = aAlpha; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D uMap; varying float vA; varying vec2 vUv; void main(){ vec4 t = texture2D(uMap, vUv); gl_FragColor = vec4(vec3(1.0, 0.99, 0.96), t.a * vA);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const mesh = new Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = -3;
  const pts = [];                       // {x,z,t,w}
  let sinceDrop = 0, lastX = null, lastZ = null, travelled = 0;
  return {
    mesh,
    reset() { pts.length = 0; lastX = null; sinceDrop = 0; travelled = 0; g.setDrawRange(0, 0); },
    // x,z: stern position; heading (rad, world: forward = (cos h, sin h) in x,z); speed 0..1 strength; width: hull beam
    update(dt, t, x, z, heading, speed, width) {
      if (lastX !== null) travelled += Math.hypot(x - lastX, z - lastZ);
      lastX = x; lastZ = z;
      sinceDrop += dt;
      if (speed > 0.05 && travelled > 0.55) { pts.unshift({ x, z, t, w: width * (0.7 + 0.3 * speed), s: speed }); travelled = 0; }
      while (pts.length > maxN || (pts.length && t - pts[pts.length - 1].t > 5.5)) pts.pop();
      const n = Math.min(pts.length, maxN);
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[Math.min(i + 1, n - 1)], pr = pts[Math.max(i - 1, 0)];
        let dx = pr.x - q.x, dz = pr.z - q.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        const age = (t - p.t), w = p.w * (0.55 + age * 0.55), a = clamp(1 - age / 5.2, 0, 1) * p.s * 0.75;
        const nx = -dz, nz = dx, k = i * 2;
        const P = g.attributes.position.array, U = g.attributes.uv.array, A = g.attributes.aAlpha.array;
        P[k * 3] = p.x + nx * w; P[k * 3 + 1] = 0.09; P[k * 3 + 2] = p.z + nz * w;
        P[k * 3 + 3] = p.x - nx * w; P[k * 3 + 4] = 0.09; P[k * 3 + 5] = p.z - nz * w;
        U[k * 2] = i * 0.5; U[k * 2 + 1] = 0; U[k * 2 + 2] = i * 0.5; U[k * 2 + 3] = 1;
        A[k] = a; A[k + 1] = a;
      }
      g.setDrawRange(0, Math.max(0, (n - 1) * 6));
      g.attributes.position.needsUpdate = true; g.attributes.uv.needsUpdate = true; g.attributes.aAlpha.needsUpdate = true;
    },
  };
}

// ---- spray / smoke / birds: simple additive point sprites ------------------------------------------------------------------------------
export function createPoints(n, size, color = 0xffffff, opacity = 0.7) {
  const g = new BufferGeometry(); const pos = new Float32Array(n * 3); g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  const c = canvas(64), x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const m = new PointsMaterial({ size, map: texOf(c, {}), color, transparent: true, opacity, depthWrite: false, sizeAttenuation: true, blending: AdditiveBlending });
  const pts = new Points(g, m); pts.frustumCulled = false;
  return pts;
}
void Vector2; void MeshBasicMaterial; void SRGBColorSpace;

// The lake: sky dome, shaded water with wavelets, swell and ripple rings, a pebble beach, reeds, ducks, far hills and pines, mist.
// Everything here is presentation only; the presenter feeds it the pond, the wind and the ripple list from the game state.
const TAU = Math.PI * 2;

// Time-of-day looks, one per pond (Mirror Pond dawn, Breezy Lake noon, Rolling Bay sunset, Moonlit Tarn night).
const rgb = (h) => h;
export const TOD = [
  { name: 'dawn', top: 0x5d7fb4, mid: 0xe7a3a6, hor: 0xffd8ae, sun: [-0.30, 0.15, 0.94], sunCol: 0xffcf94, fog: 0xf1c9ae, dens: 0.0062, deep: 0x1c3a58, shallow: 0x73a0a2,
    hemiSky: 0xffcdb8, hemiGround: 0x3d4a5a, hemi: 0.95, key: 0xffc58c, keyI: 3.2, rim: 0xffa070, rimI: 1.9, exposure: 0.98, cloud: 0.5, stars: 0, mist: 0.55, mistCol: 0xffe2cc, env: 0.5 },
  { name: 'noon', top: 0x2d74cc, mid: 0x7db7ee, hor: 0xd4eaff, sun: [-0.34, 0.60, 0.72], sunCol: 0xfff3da, fog: 0xcde4f6, dens: 0.0036, deep: 0x0f4d7a, shallow: 0x58acba,
    hemiSky: 0xc4dcff, hemiGround: 0x6d7a5c, hemi: 1.0, key: 0xfff0d6, keyI: 3.8, rim: 0xbfd8ff, rimI: 1.2, exposure: 1.0, cloud: 0.8, stars: 0, mist: 0.0, mistCol: 0xf2f8ff, env: 0.65 },
  { name: 'sunset', top: 0x232a5e, mid: 0x8a5a88, hor: 0xf2a868, sun: [-0.12, 0.09, 0.99], sunCol: 0xffbd72, fog: 0xee9870, dens: 0.0052, deep: 0x1a2956, shallow: 0x6e5a80,
    hemiSky: 0xff9d7c, hemiGround: 0x2a2640, hemi: 0.85, key: 0xff9a52, keyI: 3.4, rim: 0xff7c4a, rimI: 1.8, exposure: 0.98, cloud: 0.6, stars: 0, mist: 0.2, mistCol: 0xffc4a0, env: 0.45 },
  { name: 'night', top: 0x030717, mid: 0x0f1f4a, hor: 0x30477c, sun: [-0.32, 0.34, 0.88], sunCol: 0xcfdfff, fog: 0x1a2850, dens: 0.0042, deep: 0x040a1e, shallow: 0x1a2c52,
    hemiSky: 0x4a62a8, hemiGround: 0x10141c, hemi: 0.75, key: 0xb2c8ff, keyI: 2.0, rim: 0x7090ff, rimI: 1.3, exposure: 1.05, cloud: 0.25, stars: 1, mist: 0.18, mistCol: 0x8aa0d8, env: 0.3 },
];

// ---- the land: one height function shared by the beach mesh, the pebbles, the figure and the water shader ------------------------
export function shoreZ(x) { return -0.55 + 0.7 * Math.sin(x * 0.31 + 0.6) + 0.35 * Math.sin(x * 0.83 + 2.0); }
export function landH(x, z) {
  const h1 = (shoreZ(x) - z) * 0.055 + Math.max(0, shoreZ(x) - z - 5) * 0.05;
  const h2 = (-x - 10.0 - 0.2 * z) * 0.09;
  const h3 = (x - 24.0 + 0.1 * z) * 0.07;
  return Math.max(-3, Math.min(2.2, Math.max(h1, h2, h3)));
}
const LAND_GLSL = `
float shoreZ(float x) { return -0.55 + 0.7 * sin(x * 0.31 + 0.6) + 0.35 * sin(x * 0.83 + 2.0); }
float landH(vec2 p) {
  float h1 = (shoreZ(p.x) - p.y) * 0.055 + max(0.0, shoreZ(p.x) - p.y - 5.0) * 0.05;
  float h2 = (-p.x - 10.0 - 0.2 * p.y) * 0.09;
  float h3 = (p.x - 24.0 + 0.1 * p.y) * 0.07;
  return clamp(max(h1, max(h2, h3)), -3.0, 2.2);
}`;

const SKY_GLSL = `
uniform vec3 uTop, uMid, uHor, uSunDir, uSunCol;
uniform float uCloud, uStars, uTime;
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
vec3 skyCol(vec3 d, float detail) {
  float h = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.2, h));
  c = mix(c, uTop, smoothstep(0.16, 0.9, h));
  float s = max(dot(d, uSunDir), 0.0);
  c += uSunCol * (pow(s, 5.0) * 0.20 + pow(s, 48.0) * 0.45 + pow(s, 1400.0) * 7.0);
  if (d.y > 0.0 && detail > 0.5) {
    vec2 uv = d.xz / (d.y + 0.16) * 0.8 + vec2(uTime * 0.0035, 0.0);
    float cl = fbm(uv * 1.5);
    cl = smoothstep(0.50, 0.86, cl) * uCloud * smoothstep(0.0, 0.16, d.y);
    vec3 cc = mix(uMid * 1.05 + 0.12, uSunCol * 0.9 + 0.25, pow(s, 3.0) * 0.7);
    c = mix(c, cc, cl * 0.75);
  }
  if (uStars > 0.0 && d.y > 0.02 && detail > 0.5) {
    vec2 q = d.xz / (d.y + 0.2) * 70.0;
    float st = step(0.9965, hash21(floor(q))) * (0.4 + 0.6 * hash21(floor(q) + 3.1));
    c += vec3(0.9, 0.95, 1.0) * st * uStars * smoothstep(0.02, 0.3, d.y);
  }
  return c;
}`;

const FOG_GLSL = `
uniform vec3 uFogCol; uniform float uFogDens;
vec3 applyFog(vec3 c, float dist) { float f = 1.0 - exp(-uFogDens * uFogDens * dist * dist); return mix(c, uFogCol, clamp(f, 0.0, 1.0)); }`;

export function buildWorld(V3, stage, { quality = 'high' } = {}) {
  const THREE = V3.THREE;
  const scene = stage.scene;
  const hi = quality === 'high', lo = quality === 'low';
  const W = { THREE, quality, tod: 0, group: new THREE.Group() };
  scene.add(W.group);
  const clk = { t: 0 };

  // shared uniforms (sky + fog + time) used by every custom shader
  const U = {
    uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 0.3, 1).normalize() }, uSunCol: { value: new THREE.Color() },
    uCloud: { value: 0.5 }, uStars: { value: 0 }, uTime: { value: 0 },
    uFogCol: { value: new THREE.Color() }, uFogDens: { value: 0.005 },
  };

  // ---- sky dome ---------------------------------------------------------------------------------------------------------------------
  const skyMat = new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.9999; }',
    fragmentShader: `${SKY_GLSL}
      varying vec3 vDir;
      void main() {
        gl_FragColor = vec4(skyCol(normalize(vDir), 1.0), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 40, 20), skyMat);
  sky.renderOrder = -100; sky.frustumCulled = false;
  W.group.add(sky);

  // ---- water ------------------------------------------------------------------------------------------------------------------------
  const NR = 24;
  const rip = Array.from({ length: NR }, () => new THREE.Vector4(0, 0, 0, 0));
  const WU = {
    ...U,
    uDeep: { value: new THREE.Color() }, uShallow: { value: new THREE.Color() },
    uChop: { value: 1 }, uWindDir: { value: new THREE.Vector2(0.2, 1) }, uWindK: { value: 1 },
    uSwellAmp: { value: 0 }, uSwellLam: { value: 8 }, uSwellC: { value: 1 }, uSwellPh: { value: 0 },
    uRip: { value: rip },
  };
  const waterMat = new THREE.ShaderMaterial({
    uniforms: WU, transparent: true, depthWrite: true, fog: false,
    vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `${SKY_GLSL}${FOG_GLSL}${LAND_GLSL}
      uniform vec3 uDeep, uShallow;
      uniform float uChop, uWindK, uSwellAmp, uSwellLam, uSwellC, uSwellPh;
      uniform vec2 uWindDir;
      uniform vec4 uRip[${NR}];
      varying vec3 vW;
      vec2 wavelets(vec2 p, float dist) {
        float fade = 1.0 - smoothstep(30.0, 150.0, dist);
        vec2 d0 = normalize(uWindDir);
        vec2 d1 = vec2(d0.x * 0.8 - d0.y * 0.6, d0.x * 0.6 + d0.y * 0.8);
        vec2 d2 = vec2(d0.x * 0.8 + d0.y * 0.6, -d0.x * 0.6 + d0.y * 0.8);
        float a = (0.010 + 0.011 * uChop) * uWindK * fade;
        vec2 g = vec2(0.0);
        g += d0 * a * 1.00 * cos(dot(d0, p) * 11.0 - uTime * 2.1);
        g += d1 * a * 0.80 * cos(dot(d1, p) * 17.0 - uTime * 2.7 + 1.3);
        g += d2 * a * 0.70 * cos(dot(d2, p) * 7.0 - uTime * 1.7 + 4.1);
        g += d0 * a * 0.55 * cos(dot(d0, p) * 31.0 - uTime * 3.6 + 2.2);
        g += d1 * a * 0.40 * cos(dot(d1, p) * 47.0 - uTime * 4.2 + 0.7);
        // micro ripples: gradient of value noise
        vec2 q = p * 9.0 + d0 * uTime * 0.8; float e = 0.07;
        float n0 = vnoise(q), nx = vnoise(q + vec2(e, 0.0)), nz = vnoise(q + vec2(0.0, e));
        g += vec2(nx - n0, nz - n0) / e * 0.0075 * (0.4 + uChop * 0.5) * fade;
        return g;
      }
      void main() {
        vec2 p = vW.xz;
        vec3 toCam = cameraPosition - vW;
        float dist = length(toCam);
        vec3 V = toCam / dist;
        vec2 g = wavelets(p, dist);
        // swell: slope of a long wave travelling away from the thrower
        if (uSwellAmp > 0.0) {
          float arg = 6.2831853 * ((p.y - uSwellC) / uSwellLam) + p.x * 0.07;
          g.y += tan(radians(uSwellAmp * cos(arg)));
        }
        // ripple rings from the skips
        float shine = 0.0;
        for (int i = 0; i < ${NR}; i++) {
          vec4 r = uRip[i];
          if (r.w <= 0.0) continue;
          vec2 dv = p - r.xy; float rr = length(dv);
          float age = r.z; float R0 = r.w * 1.8 * (0.16 + age * 0.55);
          if (rr > R0 + 0.6) continue;
          float life = clamp(1.0 - age / 3.2, 0.0, 1.0);
          vec2 dirn = dv / (rr + 1e-4);
          for (int k = 0; k < 3; k++) {
            float R = R0 * (1.0 - float(k) * 0.27);
            float w = 0.03 + 0.045 * R;
            float x = (rr - R) / w;
            float e = exp(-x * x);
            float amp = life * life * (0.95 - 0.22 * float(k)) * 0.5 / (1.0 + 0.6 * R);
            g += dirn * (-2.0 * x * e) * amp;
            shine += e * amp * 1.3 * (0.6 + 0.4 * cos(x * 3.0));
          }
        }
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        float cv = max(dot(n, V), 0.0);
        float fres = 0.03 + 0.97 * pow(1.0 - cv, 5.0);
        vec3 R = reflect(-V, n); R.y = max(R.y, 0.015);
        vec3 refl = skyCol(normalize(R), 0.0);
        // a cheap cloud / sun reflection that still has detail
        if (R.y > 0.0) refl = mix(refl, skyCol(normalize(R), 1.0), 0.6);
        float depth = max(0.0, -landH(p));
        vec3 body = mix(uShallow, uDeep, 1.0 - exp(-depth * 1.1));
        body *= 0.55 + 0.5 * clamp(dot(n, uSunDir) * 0.5 + 0.5, 0.0, 1.0) + 0.25;
        vec3 col = mix(body, refl, clamp(fres * 0.9 + 0.04, 0.0, 1.0));
        col += mix(vec3(1.0), uSunCol, 0.45) * shine * (0.55 + 0.6 * (1.0 - uChop * 0.1));
        // soft foam where the water meets the beach
        float foam = (1.0 - smoothstep(0.0, 0.06, depth)) * (0.55 + 0.45 * sin(p.x * 3.1 + uTime * 0.9));
        col = mix(col, vec3(0.93, 0.95, 0.95), foam * 0.45);
        float alpha = mix(0.35, 0.97, smoothstep(0.0, 0.10, depth));
        col = applyFog(col, dist);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, 1, 1), waterMat);
  water.rotation.x = -Math.PI / 2; water.renderOrder = 2; water.frustumCulled = false;
  W.group.add(water);

  // lake bed: a dark floor under the water so the see-through shallows never show the sky
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, 1, 1), new THREE.MeshBasicMaterial({ color: 0x0a1c2c, fog: false }));
  bed.rotation.x = -Math.PI / 2; bed.position.y = -3.2; bed.renderOrder = -50; bed.frustumCulled = false;
  W.group.add(bed);

  // ---- beach (heightfield) ----------------------------------------------------------------------------------------------------------
  const texPebbles = (() => {
    const c = globalThis.document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#7d766a'; g.fillRect(0, 0, 512, 512);
    let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const pal = ['#b9ad98', '#8e8678', '#a39a8a', '#6f6a62', '#c9bfa8', '#7d766b', '#d4c9b0', '#5f5a54', '#a89377'];
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * 512, y = rnd() * 512, r = 3 + rnd() * 9;
      g.fillStyle = pal[(rnd() * pal.length) | 0]; g.globalAlpha = 0.9;
      g.beginPath(); g.ellipse(x, y, r, r * (0.55 + rnd() * 0.35), rnd() * 3, 0, TAU); g.fill();
      g.globalAlpha = 0.35; g.fillStyle = '#000'; g.beginPath(); g.ellipse(x + 1, y + 1.5, r, r * 0.6, 0.4, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4; return t;
  })();
  const beachPart = (x0, x1, z0, z1, step, order) => {
    const nx = Math.round((x1 - x0) / step), nz = Math.round((z1 - z0) / step);
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, uv = geo.attributes.uv, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + (x0 + x1) / 2, z = pos.getZ(i) + (z0 + z1) / 2;
      const h = landH(x, z) + 0.02 * Math.sin(x * 4.1 + z * 2.3) * Math.sin(z * 3.7);
      pos.setXYZ(i, x, h, z);
      uv.setXY(i, x * 0.75, z * 0.75);
      const wet = Math.max(0, Math.min(1, 1 - (h + 0.05) / 0.22));
      const dry = 0.88 + 0.12 * Math.sin(x * 0.7) * Math.sin(z * 0.6);
      const grass = Math.max(0, Math.min(1, (h - 0.55) / 0.5));
      col[i * 3] = (1 - wet * 0.45) * dry * (1 - grass * 0.45); col[i * 3 + 1] = (1 - wet * 0.42) * dry * (1 - grass * 0.12); col[i * 3 + 2] = (1 - wet * 0.38) * dry * (1 - grass * 0.55);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: texPebbles, vertexColors: true, roughness: 0.9, metalness: 0, color: 0xb9b3a8 });
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true; m.renderOrder = order;
    W.group.add(m);
    return m;
  };
  // a fine patch around the thrower (a smooth waterline) inside a coarse land that reaches the far banks
  W.beach = beachPart(-13, 15, -13, 9, hi ? 0.1 : 0.16, -10);
  {
    // the coarse land leaves a hole where the fine patch sits by drawing four slabs around it
    const slabs = [[-34, 38, -16, -13], [-34, 38, 9, 60], [-34, -13, -13, 9], [15, 38, -13, 9]];
    for (const [a, b, c, d] of slabs) beachPart(a, b, c, d, hi ? 0.6 : 0.9, -10);
  }

  // ---- pebbles and rocks on the beach ---------------------------------------------------------------------------------------------------
  {
    const n = lo ? 160 : hi ? 900 : 480;
    const geo = new THREE.SphereGeometry(1, 10, 7);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0 });
    const im = new THREE.InstancedMesh(geo, mat, n);
    let seed = 99; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    const pal = [0x9d9482, 0x7c776d, 0x6b665e, 0xa89d86, 0x8a8174, 0x938872, 0x56534e, 0x9c917c];
    for (let i = 0; i < n; i++) {
      let x, z;
      const zone = rnd();
      if (zone < 0.75) { x = -7 + rnd() * 16; z = -8 + rnd() * 8.4; } else { x = -12 + rnd() * 36; z = -12 + rnd() * 13; }
      const sh = shoreZ(x);
      if (z > sh + 0.35) z = sh - rnd() * 3.5;
      const r = (rnd() < 0.012 ? 0.04 + rnd() * 0.04 : 0.012 + rnd() * rnd() * 0.04);
      const h = landH(x, z);
      p.set(x, h + r * 0.28, z); e.set(rnd() * 0.5, rnd() * TAU, rnd() * 0.5); q.setFromEuler(e); s.set(r * (1 + rnd() * 0.4), r * (0.35 + rnd() * 0.3), r * (0.8 + rnd() * 0.4));
      m.compose(p, q, s); im.setMatrixAt(i, m);
      c.setHex(pal[(rnd() * pal.length) | 0]).multiplyScalar(0.8 + rnd() * 0.3); im.setColorAt(i, c);
    }
    im.castShadow = false; im.receiveShadow = true; im.renderOrder = -9;
    W.group.add(im);
    W.pebbles = im;
  }

  // ---- reeds on the left bank and by the rocks (sway with the wind) ------------------------------------------------------------------------------
  const reedU = { uWind: { value: 0.5 }, uT: { value: 0 } };
  {
    const geo = new THREE.PlaneGeometry(0.05, 1, 1, 5);
    geo.translate(0, 0.5, 0);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 - 0.85 * y)); }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0x6f8a3c, roughness: 0.9, side: THREE.DoubleSide, vertexColors: false });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = reedU.uWind; sh.uniforms.uT = reedU.uT;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind; uniform float uT;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float bend = position.y * position.y;
          transformed.x += sin(uT * (1.1 + uWind * 0.5) + ip.x * 1.7 + ip.z * 0.9) * bend * (0.07 + 0.16 * uWind);
          transformed.z += sin(uT * (0.8 + uWind * 0.4) + ip.z * 1.3) * bend * (0.04 + 0.1 * uWind);`);
    };
    const n = lo ? 200 : hi ? 1300 : 700;
    const im = new THREE.InstancedMesh(geo, mat, n);
    let seed = 5; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p3 = new THREE.Vector3(), c = new THREE.Color();
    const cols = [0x5f7d33, 0x7a9440, 0x8da24e, 0x4d6a2c, 0x9aa35a];
    for (let i = 0; i < n; i++) {
      // clumps along the left bank and a few by the right shore
      const clump = (i / 9) | 0, ch = ((clump * 2654435761) >>> 0) / 4294967296, ch2 = ((clump * 40503 + 7) >>> 0) % 1000 / 1000;
      let cx, cz;
      if (ch < 0.8) { cz = 3 + ch2 * 38; cx = -8.3 - 0.2 * cz * 0.0 - (ch * 3.5) + Math.sin(cz * 0.4) * 0.8 - 0.1 * cz * 0.2; }
      else { cx = 6 + ch2 * 10; cz = 4 + ch * 30; }
      const x = cx + (rnd() - 0.5) * 1.1, z = cz + (rnd() - 0.5) * 1.1;
      const h = landH(x, z);
      const len = 0.9 + rnd() * 1.2;
      p3.set(x, Math.min(h, 0.05) - 0.05, z); e.set((rnd() - 0.5) * 0.25, rnd() * TAU, (rnd() - 0.5) * 0.25); q.setFromEuler(e); s.set(1, len, 1);
      m.compose(p3, q, s); im.setMatrixAt(i, m);
      c.setHex(cols[(rnd() * cols.length) | 0]).multiplyScalar(0.7 + rnd() * 0.4); im.setColorAt(i, c);
    }
    im.frustumCulled = false; im.renderOrder = -5;
    W.group.add(im);
    W.reeds = im;
  }

  // ---- far hills (layered silhouettes) and pines --------------------------------------------------------------------------------------------
  const hills = [];
  {
    const layers = [{ d: 520, h: 70, c: 0.82, seed: 1.3 }, { d: 380, h: 48, c: 0.62, seed: 4.1 }, { d: 270, h: 30, c: 0.42, seed: 7.7 }, { d: 190, h: 16, c: 0.25, seed: 2.2 }];
    for (const L of layers) {
      const n = 90, pos = [], idx = [];
      for (let i = 0; i <= n; i++) {
        const a = -1.45 + (2.9 * i) / n;
        const hh = L.h * (0.45 + 0.3 * Math.sin(a * 3.1 + L.seed) + 0.25 * Math.sin(a * 7.3 + L.seed * 2) + 0.12 * Math.sin(a * 17 + L.seed * 3));
        const x = Math.sin(a) * L.d, z = Math.cos(a) * L.d;
        pos.push(x, -2, z, x, Math.max(2, hh), z);
      }
      for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
      const mat = new THREE.ShaderMaterial({
        uniforms: { ...U, uShade: { value: L.c } }, side: THREE.DoubleSide, fog: false,
        vertexShader: 'varying vec3 vW; varying float vH; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vH = position.y; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: `${FOG_GLSL} uniform float uShade; uniform vec3 uHor, uTop, uSunCol; varying vec3 vW; varying float vH;
          void main() {
            float d = length(vW - cameraPosition);
            vec3 base = mix(uHor * 0.55, uTop * 0.45, 0.35) * (0.55 + 0.3 * uShade);
            base = mix(base, uHor, uShade * 0.55);
            base *= 0.75 + 0.25 * clamp(vH / 50.0, 0.0, 1.0);
            gl_FragColor = vec4(applyFog(base, d * 0.5), 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      });
      const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = -80;
      W.group.add(mesh); hills.push(mesh);
    }
  }
  {
    // pines: stacked cones, instanced, along the left bank and the far shore
    const n = lo ? 90 : hi ? 420 : 240;
    const g1 = new THREE.CylinderGeometry(0.0, 1.0, 1.9, 7, 1); g1.translate(0, 1.6, 0);
    const g2 = new THREE.CylinderGeometry(0.0, 0.8, 1.6, 7, 1); g2.translate(0, 2.7, 0);
    const g3 = new THREE.CylinderGeometry(0.0, 0.55, 1.3, 7, 1); g3.translate(0, 3.7, 0);
    const trunk = new THREE.CylinderGeometry(0.08, 0.12, 1.1, 5); trunk.translate(0, 0.55, 0);
    const merged = V3.board3d.mergeGeos ? V3.board3d.mergeGeos([g1, g2, g3, trunk].map((geo) => ({ geo }))) : g1;
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a6a4a, roughness: 0.95, flatShading: true });
    const im = new THREE.InstancedMesh(merged, mat, n);
    let seed = 31; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      let x, z;
      const w = rnd();
      if (w < 0.45) { z = 12 + rnd() * 70; x = -(17 + 0.25 * z) - rnd() * 18; }       // left bank
      else if (w < 0.75) { x = -90 + rnd() * 180; z = 118 + rnd() * 20; }              // far shore
      else { z = 14 + rnd() * 60; x = 25 + 0.1 * z + rnd() * 16; }                      // right bank
      const sc = 1.1 + rnd() * 1.8;
      p.set(x, Math.max(0, landH(x, z)) - 0.1, z); e.set(0, rnd() * TAU, 0); q.setFromEuler(e); s.set(sc * (0.8 + rnd() * 0.4), sc, sc * (0.8 + rnd() * 0.4));
      m.compose(p, q, s); im.setMatrixAt(i, m);
      c.setHex(0x587a52).offsetHSL((rnd() - 0.5) * 0.05, 0, (rnd() - 0.5) * 0.08); im.setColorAt(i, c);
    }
    im.frustumCulled = false; im.renderOrder = -4;
    W.group.add(im);
    W.pines = im;
    // the far shore land strip so the pines stand on something
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(500, 60), new THREE.MeshStandardMaterial({ color: 0x25382b, roughness: 1 }));
    strip.rotation.x = -Math.PI / 2; strip.position.set(0, 0.4, 135); strip.renderOrder = -60;
    W.group.add(strip);
  }

  // ---- mist: soft drifting layers close above the water ---------------------------------------------------------------------------------------
  const mistTex = (() => {
    const c = globalThis.document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); const id = g.createImageData(256, 256);
    let seed = 3; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const base = new Float32Array(16 * 16); for (let i = 0; i < base.length; i++) base[i] = rnd();
    const sm = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi; const a = (i, j) => base[((j & 15) * 16) + (i & 15)];
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return (a(xi, yi) * (1 - u) + a(xi + 1, yi) * u) * (1 - v) + (a(xi, yi + 1) * (1 - u) + a(xi + 1, yi + 1) * u) * v; };
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      let v = 0.5 * sm(x / 16, y / 16) + 0.3 * sm(x / 8, y / 8) + 0.2 * sm(x / 4, y / 4);
      v = Math.max(0, (v - 0.35) * 1.8);
      const i = (y * 256 + x) * 4; id.data[i] = id.data[i + 1] = id.data[i + 2] = 255; id.data[i + 3] = Math.min(255, v * 255);
    }
    g.putImageData(id, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(7, 7); return t;
  })();
  const mists = [];
  if (!lo) {
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshBasicMaterial({ map: mistTex.clone(), transparent: true, opacity: 0.2, depthWrite: false, fog: false, color: 0xffffff }));
      m.material.map.needsUpdate = true; m.material.map.wrapS = m.material.map.wrapT = THREE.RepeatWrapping; m.material.map.repeat.set(6 + i, 6 + i);
      m.rotation.x = -Math.PI / 2; m.position.set(0, 0.12 + i * 0.55, 90); m.renderOrder = 5 + i; m.frustumCulled = false;
      W.group.add(m); mists.push(m);
    }
  }

  // ---- ducks ------------------------------------------------------------------------------------------------------------------------------------
  const ducks = [];
  {
    const bodyM = new THREE.MeshStandardMaterial({ color: 0x8a7a64, roughness: 0.8 });
    const headM = new THREE.MeshStandardMaterial({ color: 0x1f5a3c, roughness: 0.6 });
    const beakM = new THREE.MeshStandardMaterial({ color: 0xe0b020, roughness: 0.6 });
    const whiteM = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.8 });
    const mk = () => {
      const g = new THREE.Group(); const inner = new THREE.Group(); g.add(inner);
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), bodyM); body.scale.set(0.9, 0.62, 1.55); body.position.set(0, 0.05, 0); inner.add(body);
      const chest = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshStandardMaterial({ color: 0x6b4a3a, roughness: 0.8 })); chest.position.set(0, 0.07, 0.12); chest.scale.set(1, 0.9, 1); inner.add(chest);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.14, 8), headM); neck.position.set(0, 0.17, 0.2); neck.rotation.x = 0.25; inner.add(neck);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 12), whiteM); ring.position.set(0, 0.12, 0.185); ring.rotation.x = Math.PI / 2 - 0.2; inner.add(ring);
      const head = new THREE.Group(); head.position.set(0, 0.25, 0.23);
      const hm = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), headM); head.add(hm);
      const beak = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.016, 0.085), beakM); beak.position.set(0, -0.012, 0.075); head.add(beak);
      inner.add(head);
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.05, 0.14, 6), bodyM); tail.position.set(0, 0.1, -0.24); tail.rotation.x = -1.2; inner.add(tail);
      g.userData = { inner, head };
      return g;
    };
    const spots = [[-5.2, 15.0, 0.4], [-4.3, 16.2, 0.9], [-6.1, 17.1, 0.1], [8.5, 24, 2.0], [9.4, 22.8, 1.6]];
    for (const s of spots) { const d = mk(); d.position.set(s[0], 0, s[1]); d.rotation.y = s[2]; d.scale.setScalar(1.1); W.group.add(d); ducks.push({ g: d, x: s[0], z: s[1], yaw: s[2], ph: s[0] * 1.7 }); }
  }

  // ---- lighting / look per time of day ---------------------------------------------------------------------------------------------------------
  W.setTod = (i) => {
    const T = TOD[i % TOD.length]; W.tod = i;
    U.uTop.value.set(T.top); U.uMid.value.set(T.mid); U.uHor.value.set(T.hor);
    U.uSunDir.value.set(...T.sun).normalize(); U.uSunCol.value.set(T.sunCol);
    U.uCloud.value = T.cloud; U.uStars.value = T.stars;
    U.uFogCol.value.set(T.fog); U.uFogDens.value = T.dens;
    WU.uDeep.value.set(T.deep); WU.uShallow.value.set(T.shallow);
    stage.setLighting('day', { sky: T.fog, fog: null, hemiSky: T.hemiSky, hemiGround: T.hemiGround, hemi: T.hemi, key: T.key, keyI: T.keyI, rim: T.rim, rimI: T.rimI, exposure: T.exposure });
    stage.renderer.toneMappingExposure = T.exposure;
    scene.background = null;
    scene.fog = new THREE.FogExp2(T.fog, T.dens);
    if (scene.environment) scene.environmentIntensity = T.env;
    for (const m of mists) { m.material.color.set(T.mistCol); m.userData.base = T.mist * (0.55 - 0.1 * mists.indexOf(m)); m.visible = T.mist > 0.01; }
    const sd = new THREE.Vector3(...T.sun).normalize();
    stage._shadowOffset.set(-sd.x * 10 - 0, Math.max(6, sd.y * 14 + 5), -sd.z * 10 - 3.5);
    // the key light comes from the sun side (ahead) at dawn/sunset: keep it from the front-right so the thrower is rim-lit but readable
    stage._shadowOffset.set(sd.x * 9 + 2.5, 5 + sd.y * 8, 6 + sd.z * 4 - 2);
    stage.lights.rim.color.set(T.rim);
  };

  // ---- per frame ---------------------------------------------------------------------------------------------------------------------------------------
  W.update = (wall, o) => {
    clk.t += wall;
    U.uTime.value = clk.t; reedU.uT.value = clk.t;
    const cp = o.camPos;
    sky.position.copy(cp);
    water.position.set(Math.round(cp.x / 10) * 10, 0, Math.round(cp.z / 10) * 10);
    bed.position.x = water.position.x; bed.position.z = water.position.z;
    mists.forEach((m, i) => {
      m.position.x = Math.round(cp.x / 20) * 20; m.position.z = Math.round(cp.z / 20) * 20 + 40;
      m.material.map.offset.set(clk.t * (0.0016 + 0.0008 * i), clk.t * 0.0007);
      m.material.opacity = (m.userData.base || 0) * (0.85 + 0.15 * Math.sin(clk.t * 0.2 + i));
    });
    ducks.forEach((d, i) => {
      const ph = clk.t * 0.7 + d.ph, u = d.g.userData;
      d.g.position.x = d.x + Math.sin(clk.t * 0.05 + i) * 0.7;
      d.g.position.y = 0.0 + Math.sin(ph) * 0.012;
      u.inner.rotation.z = Math.sin(ph * 0.8) * 0.04; u.inner.rotation.x = Math.sin(ph * 1.3) * 0.03;
      const dip = Math.max(0, Math.sin(clk.t * 0.23 + i * 2.1)) ** 6;
      u.head.rotation.x = 0.1 + dip * 0.9; u.head.rotation.y = Math.sin(clk.t * 0.4 + i) * 0.5;
    });
  };
  W.uniforms = { sky: U, water: WU, reed: reedU, rip };
  W.setPond = (pondIdx, pond, cond, windSign) => {
    WU.uChop.value = pond.chop;
    WU.uSwellAmp.value = pond.swell; WU.uSwellLam.value = pond.lambda;
    const w = cond ? cond.wind : 0;
    WU.uWindDir.value.set(0.18 * Math.sign(w || 1), w >= 0 ? 1 : -1).normalize();
    WU.uWindK.value = 0.55 + Math.min(1.0, Math.abs(w) / 4) * 0.9 + (pond.gust ? 0.25 : 0);
    reedU.uWind.value = Math.min(1, Math.abs(w) / 4);
  };
  return W;
}

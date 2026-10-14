// The Niger at golden hour as a real 3D scene: sky dome (gradient, sun, clouds, stars), a reflective rippling water shader, banks with reeds,
// palms, a mud-brick village and a mosque on the far shore, a distant fisher in a pirogue, birds, drifting foam.
// Coordinates: three.js X = -(sim x), Y up, Z = sim z (away from the camera). Everything is generated from fixed seeds; no image files.
const rnd = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const SKY_GLSL = `
uniform vec3 uTop, uMid, uHor, uSunCol, uSunDir;
vec3 skyBase(vec3 d){
  float h = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.30, h));
  c = mix(c, uTop, smoothstep(0.18, 0.85, h));
  float s = max(dot(d, uSunDir), 0.0);
  c += uSunCol * (pow(s, 6.0) * 0.12 + pow(s, 48.0) * 0.28);
  return c;
}`;

const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; }`;
const SKY_FS = `
uniform float uTime, uNight, uSunR;
varying vec3 vDir;
${SKY_GLSL}
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<4;i++){ s += a*noise(p); p = p*2.03 + 7.1; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  vec3 c = skyBase(d);
  float sd = dot(d, uSunDir);
  c += uSunCol * smoothstep(1.0 - (1.0 - uSunR) * 1.7, uSunR, sd) * 1.3;
  // clouds: a flat deck seen in perspective, lit warm on the sun side
  if (d.y > 0.01) {
    vec2 p = d.xz / (d.y + 0.12) * 0.9 + vec2(uTime * 0.004, 0.0);
    float n = fbm(p * 1.3);
    float cl = smoothstep(0.50, 0.78, n) * smoothstep(0.0, 0.25, d.y);
    float lit = pow(max(sd, 0.0), 3.0);
    vec3 cc = mix(uMid * 0.82 + uHor * 0.25, uSunCol * 1.05 + uHor * 0.2, lit * 0.8 + 0.1);
    cc = mix(cc, uTop * 0.7, (1.0 - lit) * 0.35);
    c = mix(c, cc, cl * (0.62 + 0.3 * lit));
  }
  if (uNight > 0.5 && d.y > 0.05) {
    vec2 q = floor(d.xz / (d.y + 0.2) * 70.0);
    float st = step(0.987, hash(q)) * smoothstep(0.08, 0.4, d.y);
    c += vec3(st) * (0.5 + 0.5 * sin(uTime * 2.0 + hash(q + 3.0) * 20.0));
  }
  gl_FragColor = vec4(c, 1.0);
}`;

const WATER_VS = `
varying vec3 vPos;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vPos = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WATER_FS = `
uniform float uTime;
uniform vec3 uDeep, uShallow, uGlint, uFoam;
uniform vec2 uCur;
uniform vec4 uRip[14];
uniform float uVis;
varying vec3 vPos;
${SKY_GLSL}
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec3 V = cameraPosition - vPos;
  float dist = length(V); V /= dist;
  vec2 p = vPos.xz - uCur * uTime * 0.6;
  p += vec2(noise(p * 0.35 + 3.0), noise(p * 0.35 + 9.0)) * 2.4 - 1.2;      // warp so the wave trains never line up into a lattice
  float far = smoothstep(6.0, 70.0, dist);
  // layered travelling waves -> slope
  vec2 g = vec2(0.0);
  g += vec2( 0.8,  0.6) * cos(dot(p, vec2( 0.8,  0.6)) * 2.3 + uTime * 1.3) * 0.045;
  g += vec2(-0.5,  0.85) * cos(dot(p, vec2(-0.5, 0.85)) * 3.7 - uTime * 1.7) * 0.030;
  g += vec2( 0.95,-0.3) * cos(dot(p, vec2(0.95, -0.3)) * 6.1 + uTime * 2.3) * 0.016;
  float nz = noise(p * 1.7 + uTime * 0.12) - 0.5;
  g += vec2(nz, noise(p.yx * 1.9 - uTime * 0.1) - 0.5) * 0.05;
  g *= mix(1.0, 0.22, far);
  float rimGlow = 0.0, foam = 0.0;
  for (int i = 0; i < 14; i++) {
    vec4 r = uRip[i];
    if (r.w > 0.001) {
      vec2 dv = vPos.xz - r.xy; float d = length(dv) + 1e-4;
      float age = r.z;
      float R0 = r.w * 1.7 * (0.16 + age * 0.55);
      float life = clamp(1.0 - age / 3.2, 0.0, 1.0); life *= life;
      for (int k = 0; k < 3; k++) {
        float R = R0 * (1.0 - float(k) * 0.27);
        float e = (d - R) / (0.07 + 0.05 * R);
        float prof = exp(-e * e) * life * (0.9 - float(k) * 0.22);
        g += (dv / d) * prof * 0.55 * cos((d - R) * 14.0);
        rimGlow += prof;
      }
      foam += exp(-d * d / (0.25 + 0.12 * R0 * R0)) * life * smoothstep(0.0, 0.2, age) * (1.0 - smoothstep(0.2, 1.0, age)) * r.w;
    }
  }
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  float cosv = clamp(dot(N, V), 0.0, 1.0);
  float F = 0.17 + 0.83 * pow(1.0 - cosv, 3.0);
  vec3 Rv = reflect(-V, N); Rv.y = abs(Rv.y);
  vec3 Rs = normalize(vec3(Rv.x, Rv.y * 0.35, Rv.z));
  vec3 sky = skyBase(Rs) * 1.2;
  // the water body: deeper and darker straight down, a lighter green-brown at a slant
  vec3 body = mix(uDeep, uShallow, smoothstep(0.1, 0.9, 1.0 - cosv * 0.6));
  body = mix(body, uHor * 0.65, 0.22) * (0.78 + 0.22 * uVis) * 1.25;
  vec3 col = mix(body, sky, clamp(F * 1.15, 0.0, 1.0));
  // sun glitter, broken by the ripples
  float s = max(dot(Rv, uSunDir), 0.0);
  float gl = pow(s, 380.0) * 5.0 + pow(s, 55.0) * 0.5;
  col += uSunCol * gl;
  // glints on small crests
  col += uGlint * pow(max(0.0, noise(p * 7.0 + uTime * 0.7) - 0.7) * 3.3, 2.0) * 0.18 * smoothstep(0.0, 0.7, F);
  col += uGlint * rimGlow * 0.3;
  col = mix(col, uFoam, clamp(foam * 0.7, 0.0, 0.8));
  // haze toward the horizon
  col = mix(col, uHor, smoothstep(40.0, 260.0, dist) * 0.55);
  float a = clamp(0.40 + 0.40 * F + 0.18 * smoothstep(0.0, 1.0, dist / 120.0) + foam * 0.4, 0.0, 0.98);
  gl_FragColor = vec4(col, a);
}`;

function canvasTex(THREE, w, h, draw, opt = {}) {
  const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (opt.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}

export function buildWorld(THREE, scene, { quality = 'medium' } = {}) {
  const R = rnd(20261014);
  const root = new THREE.Group(); root.name = 'bozo-world';
  const out = { root, uniforms: null, palms: [], birds: [], foam: null, flecks: null };
  const hi = quality === 'high', lo = quality === 'low';

  // ---- shared sky uniforms ----
  const U = {
    uTop: { value: new THREE.Color('#4d5f9c') }, uMid: { value: new THREE.Color('#e79aa6') }, uHor: { value: new THREE.Color('#ffd9b0') },
    uSunCol: { value: new THREE.Color('#ffecbe') }, uSunDir: { value: new THREE.Vector3(0, 0.1, 1).normalize() },
    uTime: { value: 0 }, uNight: { value: 0 }, uSunR: { value: 0.9995 },
    uDeep: { value: new THREE.Color('#1f3f3c') }, uShallow: { value: new THREE.Color('#6f948c') }, uGlint: { value: new THREE.Color('#ffecd2') }, uFoam: { value: new THREE.Color('#f0e8d6') },
    uCur: { value: new THREE.Vector2(0.3, 0) }, uVis: { value: 1 },
    uRip: { value: Array.from({ length: 14 }, () => new THREE.Vector4(0, 0, 0, 0)) },
  };
  out.uniforms = U;

  // ---- sky dome ----
  const skyMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 16), skyMat);
  sky.renderOrder = -10; sky.frustumCulled = false; root.add(sky); out.sky = sky;

  // ---- water ----
  const waterMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: WATER_VS, fragmentShader: WATER_FS, transparent: true, depthWrite: false });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(700, 700, 1, 1), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.set(0, 0, 300); water.renderOrder = 5; water.frustumCulled = false;
  out.water = water;
  const bedMat = new THREE.MeshBasicMaterial({ color: '#1f3f3c', fog: false });
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), bedMat);
  bed.rotation.x = -Math.PI / 2; bed.position.set(0, -7, 300); out.bedMat = bedMat;

  // ---- everything that is reflected lives in `refl` (a mirrored clone is made below) ----
  const refl = new THREE.Group(); out.refl = refl;
  const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const mats = {
    mud: lam('#c2a176'), mudDark: lam('#9c7e58'), door: lam('#3a2616'), roof: lam('#8c6c46'),
    trunk: lam('#6a5236'), leaf: new THREE.MeshLambertMaterial({ color: '#4f7a3a', side: THREE.DoubleSide, alphaTest: 0.4 }),
  };
  out.mats = mats;
  const groundTex = canvasTex(THREE, 128, 128, (g, w, h) => {
    g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, w, h);
    const img = g.getImageData(0, 0, w, h); let s = 17;
    for (let i = 0; i < img.data.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; const n = ((s >>> 24) - 128) * 0.28; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${i % 2 ? '255,255,230' : '40,40,30'},0.1)`; g.fillRect(R() * w, R() * h, 2 + R() * 14, 1 + R() * 3); }
  }, { repeat: true });
  groundTex.repeat.set(24, 80);
  const groundMat = new THREE.MeshLambertMaterial({ color: '#6a6a58', map: groundTex });
  out.groundMat = groundMat;

  // banks: a strip per side from the water's edge out, gently rising, with a wavy edge
  const edgeX = (z, side) => side * (12.5 + 1.6 * Math.sin(z * 0.19 + (side > 0 ? 2 : 0)) + 1.0 * Math.sin(z * 0.047 + 1.3));
  out.edgeX = edgeX;
  for (const side of [-1, 1]) {
    const zs = []; for (let z = -8; z <= 240; z += 4) zs.push(z);
    const offs = [-0.4, 0.4, 1.6, 4, 12, 40, 160];
    const pos = [], uv = [], idx = [];
    zs.forEach((z, i) => offs.forEach((o, j) => {
      const e = edgeX(z, side), x = e + side * o;
      const hgt = o < 0 ? -0.35 : Math.min(1.1, 0.04 + o * 0.22) + 0.35 * Math.sin(z * 0.31 + o * 0.7) * Math.min(1, o / 6);
      pos.push(-x, hgt, z); uv.push(j * 0.25, i * 0.3);
    }));
    for (let i = 0; i < zs.length - 1; i++) for (let j = 0; j < offs.length - 1; j++) {
      const a = i * offs.length + j, b = a + 1, c = a + offs.length, d = c + 1;
      if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, groundMat); m.receiveShadow = false; refl.add(m);
  }
  // the land across the water at the far end of the reach
  {
    const geo = new THREE.PlaneGeometry(900, 120, 1, 1); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, groundMat); m.position.set(0, 0.7, 238); refl.add(m);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(900, 1.4, 1), groundMat); lip.position.set(0, 0.0, 178); refl.add(lip);
  }

  // ---- mud-brick houses and mosques (Sudano-Sahelian: parapets, toron beams) ----
  const spike = new THREE.CylinderGeometry(0.06, 0.09, 0.7, 5); spike.rotateZ(Math.PI / 2);
  const house = (rng, w, d, h) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.mud); body.position.y = h / 2; g.add(body);
    const par = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.35, d + 0.2), mats.mudDark); par.position.y = h + 0.1; g.add(par);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.6), mats.mud); c.position.set(sx * w / 2, h + 0.4, sz * d / 2); g.add(c); }
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.08), mats.door); door.position.set((rng() - 0.5) * w * 0.5, 0.75, -d / 2 - 0.02); g.add(door);
    for (let i = 0; i < 3; i++) { const w2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.08), mats.door); w2.position.set(-w / 2 + (i + 0.6) * w / 3.2, h * 0.7, -d / 2 - 0.02); g.add(w2); }
    return g;
  };
  const mosque = (s) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(9 * s, 6 * s, 7 * s), mats.mud); body.position.y = 3 * s; g.add(body);
    for (let i = 0; i < 4; i++) {
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.9 * s, 1.35 * s, (9 + (i % 2) * 3) * s, 8), mats.mud);
      tw.position.set((-3.4 + i * 2.27) * s, (6 + (9 + (i % 2) * 3) * 0.5) * s * 0.7 + 1.5 * s, -2.6 * s); g.add(tw);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.55 * s, 8, 6), mats.mudDark); top.position.set(tw.position.x, tw.position.y + (9 + (i % 2) * 3) * 0.5 * s + 0.4 * s, tw.position.z); g.add(top);
      for (let k = 0; k < 5; k++) for (const sx of [-1, 1]) { const sp = new THREE.Mesh(spike, mats.trunk); sp.position.set(tw.position.x + sx * 1.15 * s, tw.position.y - 3.5 * s + k * 1.7 * s, tw.position.z); sp.scale.setScalar(s); g.add(sp); }
    }
    return g;
  };
  const vil = new THREE.Group();
  for (const side of [-1, 1]) {
    const n = hi ? 16 : 11;
    for (let i = 0; i < n; i++) {
      const z = 28 + i * (12 + R() * 7) + R() * 5;
      if (z > 195) break;
      const x = edgeX(z, side) + side * (3 + R() * 9 + (i % 3) * 3.5);
      const h = house(R, 4 + R() * 3.5, 4 + R() * 3, 2.8 + R() * 2.4);
      h.position.set(-x, 0.5, z); h.rotation.y = (R() - 0.5) * 0.4 + (side > 0 ? 0.35 : -0.35); vil.add(h);
    }
  }
  // the far shore at the end of the reach: a row of houses, two mosques
  for (let i = 0; i < (hi ? 26 : 16); i++) {
    const x = -120 + i * 9.5 + R() * 5, z = 186 + R() * 14;
    const h = house(R, 5 + R() * 5, 5 + R() * 4, 3 + R() * 3.5); h.position.set(x, 0.9, z); h.rotation.y = (R() - 0.5) * 0.3; vil.add(h);
  }
  for (const [x, z, s] of [[-26, 150, 1.35], [38, 120, 1.15], [-4, 192, 1.8]]) { const m = mosque(s); m.position.set(x, 0.6, z); m.rotation.y = 0.15 * Math.sign(x || 1); vil.add(m); }
  refl.add(vil);

  // ---- palms and acacia-like trees ----
  const frondTex = canvasTex(THREE, 128, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, 2); g.stroke();
    for (let i = 0; i < 30; i++) { const y = h - 6 - i * (h - 12) / 30, l = (w / 2 - 2) * Math.min(1, 1.5 * (1 - i / 34)); g.fillStyle = i % 2 ? '#ffffff' : '#e8ffe0'; g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 - l, y - 14); g.lineTo(w / 2 - l + 5, y - 4); g.closePath(); g.fill(); g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 + l, y - 14); g.lineTo(w / 2 + l - 5, y - 4); g.closePath(); g.fill(); }
  });
  const frondGeo = new THREE.PlaneGeometry(1.5, 4.4, 1, 8); frondGeo.translate(0, 2.2, 0);
  { const p = frondGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, -0.06 * y * y); } frondGeo.computeVertexNormals(); }
  const frondMat = new THREE.MeshLambertMaterial({ map: frondTex, color: '#6f9a4a', side: THREE.DoubleSide, alphaTest: 0.35 });
  out.frondMat = frondMat;
  const palm = (h, lean) => {
    const g = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, h, 7, 4), mats.trunk); tr.position.y = h / 2; tr.rotation.z = lean; g.add(tr);
    const top = new THREE.Group(); top.position.set(-Math.sin(lean) * h * 0.5, h * 0.98, 0);
    const fr = []; const nf = 9;
    for (let i = 0; i < nf; i++) { const f = new THREE.Mesh(frondGeo, frondMat); const a = (i / nf) * Math.PI * 2 + R() * 0.3; f.rotation.set(0, a, 0); const tilt = new THREE.Group(); tilt.rotation.set(0.95 + R() * 0.45, a, 0); tilt.add(f); f.rotation.set(0, 0, 0); top.add(tilt); fr.push(tilt); }
    g.add(top); g.userData.fr = fr; g.userData.ph = R() * 6;
    return g;
  };
  const nPalm = hi ? 26 : lo ? 10 : 18;
  for (let i = 0; i < nPalm; i++) {
    const side = i % 2 ? 1 : -1, z = 14 + (i / nPalm) * 170 + R() * 6;
    const x = edgeX(z, side) + side * (1.2 + R() * 10);
    const p = palm(6 + R() * 5, (R() - 0.5) * 0.18); p.position.set(-x, 0.45, z); p.scale.setScalar(1 + z / 120); refl.add(p); out.palms.push(p);
  }
  // low bushes / mangrove clumps along the water
  const bushGeo = new THREE.SphereGeometry(1, 7, 5);
  const bushMat = lam('#4a6a36'); out.bushMat = bushMat;
  for (let i = 0; i < (lo ? 16 : 34); i++) {
    const side = i % 2 ? 1 : -1, z = 8 + R() * 190, x = edgeX(z, side) + side * (0.2 + R() * 3);
    const b = new THREE.Mesh(bushGeo, bushMat); b.scale.set(1 + R() * 1.4, 0.7 + R() * 0.8, 1 + R() * 1.2); b.position.set(-x, 0.5, z); refl.add(b);
  }

  // ---- reeds: crossed cards with wind sway in the vertex shader ----
  const reedTex = canvasTex(THREE, 64, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) { const x0 = 6 + i * 6 + R() * 3, lean = (R() - 0.5) * 16; g.strokeStyle = i % 3 ? '#6d8a45' : '#8aa35a'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x0, h); g.quadraticCurveTo(x0 + lean * 0.3, h * 0.45, x0 + lean, 6 + R() * 18); g.stroke(); }
  });
  const reedGeo = new THREE.PlaneGeometry(1.1, 1.6, 1, 4); reedGeo.translate(0, 0.8, 0);
  const reedGeo2 = reedGeo.clone(); reedGeo2.rotateY(Math.PI / 2);
  const reedMat = new THREE.MeshLambertMaterial({ map: reedTex, side: THREE.DoubleSide, alphaTest: 0.4, color: '#9ab870' });
  reedMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTimeR = U.uTime;
    sh.vertexShader = 'uniform float uTimeR;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float sw = pow(position.y / 1.6, 1.6);
      #ifdef USE_INSTANCING
      float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.45;
      #else
      float ph = 0.0;
      #endif
      transformed.x += sin(uTimeR * 1.6 + ph) * 0.11 * sw; transformed.z += cos(uTimeR * 1.2 + ph * 1.3) * 0.06 * sw;`);
  };
  out.reedMat = reedMat;
  const nReed = hi ? 340 : lo ? 110 : 220;
  for (const geo of [reedGeo, reedGeo2]) {
    const im = new THREE.InstancedMesh(geo, reedMat, nReed); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (let i = 0; i < nReed; i++) {
      const side = R() < 0.5 ? -1 : 1, z = 3 + Math.pow(R(), 1.5) * 185, x = edgeX(z, side) - side * R() * 1.2;
      const s = 0.8 + R() * 1.1 + z / 160;
      e.set(0, R() * 6.28, 0); q.setFromEuler(e); v.set(-x, -0.1, z); sc.set(s, s * (0.9 + R() * 0.7), s);
      m4.compose(v, q, sc); im.setMatrixAt(i, m4);
    }
    refl.add(im);
  }
  // reeds close to the near-left and near-right of the camera so the water has a foreground edge
  scene.add(root);
  root.add(bed, water);
  root.add(refl);
  const mirror = refl.clone(true); mirror.scale.y = -1; root.add(mirror); out.mirror = mirror;

  // ---- a distant pirogue with a standing fisher (not mirrored: it is far away) ----
  {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 8), lam('#4a3220')); hull.position.y = 0.0; g.add(hull);
    const tint = lam('#d8c9a0'); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.2, 8), lam('#315a8a')); body.position.set(0, 1.0, -0.5); g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), lam('#5a3a28')); head.position.set(0, 1.78, -0.5); g.add(head);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.42, 0.18, 12), tint); hat.position.set(0, 1.95, -0.5); g.add(hat);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 5), lam('#315a8a')); arm.position.set(0.4, 1.3, -0.1); arm.rotation.z = -0.9; arm.rotation.x = 0.5; g.add(arm);
    g.position.set(-9, 0.0, 62); g.rotation.y = 0.18; out.farBoat = g; root.add(g);
    const g2 = g.clone(true); g2.position.set(11, 0, 104); g2.rotation.y = -0.1; out.farBoat2 = g2; root.add(g2);
  }

  // ---- birds ----
  {
    const wing = new THREE.PlaneGeometry(0.9, 0.22); wing.translate(0.45, 0, 0);
    const bm = new THREE.MeshBasicMaterial({ color: '#f4efe4', side: THREE.DoubleSide, fog: false });
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Group(); const w1 = new THREE.Mesh(wing, bm), w2 = new THREE.Mesh(wing, bm); w2.scale.x = -1; b.add(w1, w2);
      b.userData = { w1, w2, a: R() * 6.28, rr: 40 + R() * 80, hh: 14 + R() * 18, sp: 0.04 + R() * 0.05, z0: 70 + R() * 60, ph: R() * 6 };
      b.scale.setScalar(1.6); root.add(b); out.birds.push(b);
    }
    out.birdMat = bm;
  }

  // ---- drifting foam flecks and leaves ----
  {
    const n = 46, pos = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const tex = canvasTex(THREE, 32, 32, (g, w, h) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const pm = new THREE.PointsMaterial({ size: 0.22, map: tex, transparent: true, depthWrite: false, opacity: 0.6, color: '#f0e8d6' });
    const pts = new THREE.Points(geo, pm); pts.frustumCulled = false; pts.renderOrder = 6; root.add(pts);
    out.flecks = { pts, pos, n, seeds: Array.from({ length: n }, () => [R(), R()]) };
  }

  // ---- per frame ----
  out.step = (t, dt, cur) => {
    U.uTime.value = t;
    for (const p of out.palms) { const ph = p.userData.ph; p.userData.fr.forEach((f, i) => { f.rotation.z = Math.sin(t * 0.9 + ph + i * 0.7) * 0.05; }); }
    out.birds.forEach((b, i) => {
      const d = b.userData, a = d.a + t * d.sp * (i % 2 ? 1 : -1);
      b.position.set(Math.cos(a) * d.rr, d.hh + Math.sin(t * 0.6 + d.ph) * 1.2, d.z0 + Math.sin(a) * d.rr * 0.5);
      b.rotation.y = -a + (i % 2 ? Math.PI : 0) + Math.PI / 2;
      const fl = Math.sin(t * 7 + d.ph) * 0.6; d.w1.rotation.z = fl; d.w2.rotation.z = -fl;
    });
    if (out.farBoat) { out.farBoat.position.y = Math.sin(t * 0.9) * 0.02; out.farBoat.rotation.z = Math.sin(t * 0.7) * 0.02; out.farBoat2.position.y = Math.sin(t * 0.8 + 1) * 0.02; }
    const f = out.flecks, cx = -cur.x, cz = cur.z;
    for (let i = 0; i < f.n; i++) {
      const [a, b] = f.seeds[i], z = 6 + 30 * a, span = 0.34 * (z + 3) * 2.2;
      const x = (((b * span + cx * t * 0.7) % span) + span) % span - span / 2;
      f.pos[i * 3] = x; f.pos[i * 3 + 1] = 0.03; f.pos[i * 3 + 2] = z + Math.sin(t * 0.4 + i) * 0.15 + ((cz * t * 0.3) % 1);
    }
    f.pts.geometry.attributes.position.needsUpdate = true;
  };
  return out;
}

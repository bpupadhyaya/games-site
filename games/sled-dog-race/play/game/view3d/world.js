// The trail world for one leg: terrain strip with the packed trail, rough-ice glaze, pines, ridges, signs, arches, the checkpoint cabin,
// sky dome (sun, stars, aurora) and falling snow. Everything is a function of the leg spec (pure data from the sim), so the picture is
// reproducible. World axes: x along the trail (metres, the sim's x), y up (elevation exaggerated by VX), z toward the camera.
import { THREE } from '../vendor3d/index.js';
import { elev, slopeAt, windowOf } from '../src/sim.js';
import { LOOKS } from '../src/scene.js';

export const VX = 1.7;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const hash = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const col = (c) => new THREE.Color(c);
const cvs = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

export const groundY = (L, x) => elev(L, clamp(x, -40, L.len + 60)) * VX;
// the full height field: the trail itself follows the sim's elevation exactly; banks and drifts rise away from it
export function terrainY(L, x, z) {
  const base = groundY(L, x), a = Math.abs(z);
  const n = Math.sin(x * 0.11 + z * 0.37) * 0.5 + Math.sin(x * 0.047 - z * 0.21 + 2) * 0.5 + Math.sin(x * 0.23 + z * 0.13) * 0.25;
  const side = sstep(1.8, 7, a);
  const behind = z < 0 ? 1 : 0.35;
  return base + n * (0.12 + 0.7 * side) * behind * sstep(1.2, 3, a) + (z < 0 ? side * 0.6 + sstep(8, 40, a) * 3.2 * (0.6 + 0.4 * Math.sin(x * 0.02 + z * 0.05)) : 0);
}

function bannerTex(text, bg, fg = '#fff', w = 512, h = 128) {
  const c = cvs(w, h), x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#fff' : '#161b28'; x.fillRect(i * (w / 16), 0, w / 16, h * 0.1); x.fillRect(i * (w / 16), h * 0.9, w / 16, h * 0.1); }
  x.fillStyle = fg; x.font = `900 ${h * 0.5}px "Avenir Next","Arial Black",system-ui,sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = 6; x.shadowOffsetY = 3;
  x.fillText(text, w / 2, h * 0.53);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function signTex(label, dir, w = 256, h = 256) {
  const c = cvs(w, h), x = c.getContext('2d');
  x.fillStyle = '#f4ede0'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#3a2a1c'; x.lineWidth = 10; x.strokeRect(5, 5, w - 10, h - 10);
  x.fillStyle = dir === 'R' ? '#2a8f5a' : '#c8452a'; x.beginPath();
  const s = dir === 'R' ? 1 : -1;
  x.moveTo(w / 2 - s * 70, h * 0.4); x.lineTo(w / 2 + s * 20, h * 0.4); x.lineTo(w / 2 + s * 20, h * 0.26); x.lineTo(w / 2 + s * 80, h * 0.5); x.lineTo(w / 2 + s * 20, h * 0.74); x.lineTo(w / 2 + s * 20, h * 0.6); x.lineTo(w / 2 - s * 70, h * 0.6); x.closePath(); x.fill();
  x.fillStyle = '#1a2233'; x.font = `900 ${h * 0.2}px "Avenir Next","Arial Black",system-ui,sans-serif`; x.textAlign = 'center'; x.fillText(label, w / 2, h * 0.93);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function softTex(rgb, a = 1) {
  const c = cvs(64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.45, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---- pine: tiers of needles with snow on top of each, vertex coloured
let PINE = null;
function pineGeometry() {
  if (PINE) return PINE;
  const parts = [];
  const add = (geo, y, c) => { geo.translate(0, y, 0); parts.push({ geo, c }); };
  add(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 6), 0.6, '#4a3424');
  const tiers = [[1.5, 1.9, 1.0], [1.2, 1.7, 2.0], [0.95, 1.5, 3.0], [0.7, 1.3, 3.9], [0.45, 1.1, 4.7]];
  for (const [r, h, y] of tiers) {
    add(new THREE.CylinderGeometry(0, r, h, 8, 1, true), y + h * 0.5, '#1f4d44');
    add(new THREE.CylinderGeometry(0, r * 0.78, h * 0.62, 8, 1, true), y + h * 0.5 + h * 0.2 + 0.06, '#f2f7ff');
  }
  const pos = [], nor = [], colr = [], idx = []; let off = 0; const c = new THREE.Color();
  for (const { geo, c: hex } of parts) {
    const g = geo.index ? geo : geo; const p = g.attributes.position, n = g.attributes.normal; c.set(hex);
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); colr.push(c.r, c.g, c.b); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); g.setIndex(idx);
  PINE = g; return g;
}

// ---- snow particles (GPU wrap-around): positions are a pure function of time and the camera
const SNOW_VS = `
uniform float uTime; uniform vec3 uCam; uniform vec3 uBox; uniform vec2 uFall; uniform float uSize; uniform float uPx;
attribute vec3 aSeed; varying float vA;
void main(){
  vec3 p = aSeed*uBox;
  p.y -= uFall.x*uTime*(0.7+aSeed.z*0.6); p.x += uFall.y*uTime*(0.6+aSeed.x*0.8) + sin(uTime*0.8+aSeed.x*40.0)*0.4;
  p = mod(p, uBox) - uBox*0.5; p += uCam;
  vec4 mv = modelViewMatrix*vec4(p,1.0);
  gl_Position = projectionMatrix*mv;
  float d = max(0.5,-mv.z);
  gl_PointSize = clamp(uSize*uPx/d, 1.0, 14.0);
  vA = clamp(1.4 - d/uBox.z*1.6, 0.0, 1.0);
}`;
const SNOW_FS = `varying float vA; void main(){ vec2 q=gl_PointCoord-0.5; float a=smoothstep(0.5,0.1,length(q)); gl_FragColor=vec4(1.0,1.0,1.0,a*vA*0.9); }`;

const SKY_VS = `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const SKY_FS = `
uniform vec3 c0; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform vec3 sunDir; uniform vec3 sunCol; uniform float uTime; uniform float uAur; uniform float uStars;
varying vec3 vP;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
void main(){
  vec3 d = normalize(vP); float y = d.y;
  vec3 c = y < 0.0 ? c3 : mix(c3, c2, smoothstep(0.0, 0.18, y)); c = mix(c, c1, smoothstep(0.12, 0.5, y)); c = mix(c, c0, smoothstep(0.45, 1.0, y));
  float s = max(0.0, dot(d, normalize(sunDir)));
  c += sunCol * (pow(s, 600.0)*3.0 + pow(s, 24.0)*0.35 + pow(s, 5.0)*0.12);
  if (uStars > 0.0) {
    vec2 g = d.xz/(abs(d.y)+0.3)*60.0; float st = step(0.985, h(floor(g))) * smoothstep(0.05,0.3,y);
    st *= 0.5+0.5*sin(uTime*2.0+h(floor(g))*40.0);
    c += vec3(st)*uStars;
  }
  if (uAur > 0.0 && y > 0.02) {
    float u = d.x*3.2 + n(vec2(d.x*4.0, uTime*0.05))*1.2;
    float band = 0.0;
    for (int i=0;i<3;i++){ float fi=float(i); float yy = 0.16+fi*0.13 + 0.05*sin(u*2.0+uTime*0.3+fi*2.0) + 0.04*sin(u*5.0-uTime*0.45+fi);
      float w = exp(-pow((y-yy)*9.0,2.0)); float ray = 0.6+0.4*n(vec2(u*14.0+fi*7.0, uTime*0.2)); band += w*ray*(0.7-fi*0.15); }
    vec3 ac = mix(vec3(0.15,1.0,0.65), vec3(0.55,0.35,1.0), smoothstep(0.2,0.55,y));
    c += ac*band*uAur*0.8;
  }
  gl_FragColor = vec4(c, 1.0);
}`;

function snowBump() {
  const c = cvs(256), x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
  let sd = 7; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  for (let i = 0; i < 260; i++) { const px = rnd() * 256, py = rnd() * 256, r = 6 + rnd() * 26, g = x.createRadialGradient(px, py, 0, px, py, r); const v = rnd() < 0.5 ? 255 : 0; g.addColorStop(0, `rgba(${v},${v},${v},0.16)`); g.addColorStop(1, `rgba(${v},${v},${v},0)`); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
  for (let i = 0; i < 2600; i++) { const v = rnd() < 0.5 ? 255 : 20; x.fillStyle = `rgba(${v},${v},${v},0.22)`; x.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
export function buildWorld({ quality = 'high' } = {}) {
  const group = new THREE.Group(); group.name = 'world';
  const leg = new THREE.Group(); group.add(leg);
  const W = { group, leg, L: null, signs: [], look: -1, quality, signMats: [], smoke: null, cabin: null };

  // ---- sky dome follows the camera
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { c0: { value: col('#4f98dc') }, c1: { value: col('#8fc6f0') }, c2: { value: col('#d6eefc') }, c3: { value: col('#f2faff') }, sunDir: { value: new THREE.Vector3(-0.5, 0.3, -0.8) }, sunCol: { value: col('#fff6c8') }, uTime: { value: 0 }, uAur: { value: 0 }, uStars: { value: 0 } },
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 14), skyMat); sky.frustumCulled = false; sky.renderOrder = -10; group.add(sky);
  W.sky = sky; W.skyMat = skyMat;

  // ---- snowfall
  const NS = quality === 'low' ? 700 : 1600;
  const seeds = new Float32Array(NS * 3); for (let i = 0; i < NS * 3; i++) seeds[i] = hash(i * 1.37 + 5);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3), 3)); sg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  const snowMat = new THREE.ShaderMaterial({ vertexShader: SNOW_VS, fragmentShader: SNOW_FS, transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(46, 22, 46) }, uFall: { value: new THREE.Vector2(1.2, 0.6) }, uSize: { value: 0.07 }, uPx: { value: 900 } } });
  const snow = new THREE.Points(sg, snowMat); snow.frustumCulled = false; snow.renderOrder = 20; group.add(snow);
  W.snow = snow; W.snowMat = snowMat;
  const setSnowCount = (n) => { sg.setDrawRange(0, Math.min(NS, n)); };
  W.setSnowCount = setSnowCount;

  // ---- sun glow + moon disc sprite
  const glowTex = softTex('255,236,190', 0.9);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sun.scale.set(260, 260, 1); sun.renderOrder = -9; group.add(sun); W.sun = sun;

  // ---- shared materials
  const M = {
    snow: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, envMapIntensity: 0.5, bumpMap: snowBump(), bumpScale: 1.4 }),
    trail: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    ice: new THREE.MeshPhysicalMaterial({ color: '#9bd6ff', roughness: 0.1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, transparent: true, opacity: 0.88, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    pine: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide }),
    wood: new THREE.MeshStandardMaterial({ color: '#7a5230', roughness: 0.8 }),
    logs: new THREE.MeshStandardMaterial({ color: '#8f6238', roughness: 0.85 }),
    roof: new THREE.MeshStandardMaterial({ color: '#eef4fb', roughness: 0.9 }),
    win: new THREE.MeshStandardMaterial({ color: '#ffd877', emissive: '#ffb84a', emissiveIntensity: 1.4, roughness: 0.4 }),
    flag: new THREE.MeshStandardMaterial({ color: '#ff7a2a', roughness: 0.7, side: THREE.DoubleSide }),
    straw: new THREE.MeshStandardMaterial({ color: '#d9b25a', roughness: 0.95 }),
    rock: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, flatShading: true }),
  };
  W.M = M;
  W.smokeTex = softTex('255,255,255', 0.8);

  // ---- per-leg content --------------------------------------------------------------------------------------------------------------
  function clearLeg() {
    while (leg.children.length) {
      const o = leg.children.pop();
      o.traverse((c) => { if (c.geometry && !c.geometry.userData?.keep) c.geometry.dispose?.(); if (c.material && c.material.map && c.material.userData?.own) c.material.map.dispose(); });
    }
    W.signs = []; W.cabin = null; W.smoke = null;
  }
  W.setLeg = (L, lookIdx, cfg = {}) => {
    clearLeg(); W.L = L;
    const K = LOOKS[lookIdx] || LOOKS[1];
    const x0 = -90, x1 = L.len + 130;
    const stepX = quality === 'low' ? 3 : 2;
    const ZS = [-70, -46, -30, -19, -12, -8, -5.5, -3.8, -2.6, -1.6, -0.8, 0, 0.8, 1.6, 2.6, 3.8, 5.5, 8, 12, 18, 30, 52, 80, 130];
    const nx = Math.ceil((x1 - x0) / stepX) + 1, nz = ZS.length;
    const pos = new Float32Array(nx * nz * 3), colr = new Float32Array(nx * nz * 3), idx = [];
    const c = new THREE.Color(), cool = col('#f4f8ff'), a0 = col(K.snow[0]).lerp(cool, 0.35), a1 = col(K.snow[1]).lerp(cool, 0.3), a2 = col(K.snow[2]).lerp(cool, 0.2), sh = col(K.shade).lerp(cool, 0.2);
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * stepX;
      for (let j = 0; j < nz; j++) {
        const z = ZS[j], y = terrainY(L, x, z), k = (i * nz + j) * 3;
        pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
        // lit snow on the sun side, blue shade in the dips, trail band packed and darker
        const dip = clamp((groundY(L, x) - y) * 0.6 + 0.5, 0, 1);
        const far = sstep(2, 40, -z);
        c.copy(a0).lerp(a1, 0.3 + 0.4 * (1 - dip)).lerp(a2, far * 0.5 + sstep(5, 20, z) * 0.25);
        const tw = Math.sin(x * 0.31 + z * 1.7) * 0.5 + 0.5; c.lerp(sh, 0.12 * tw);
        colr[k] = c.r; colr[k + 1] = c.g; colr[k + 2] = c.b;
      }
    }
    for (let i = 0; i < nx - 1; i++) for (let j = 0; j < nz - 1; j++) {
      const a = i * nz + j, b = a + 1, d = a + nz, e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
    const tg = new THREE.BufferGeometry();
    const uvs = new Float32Array(nx * nz * 2); for (let i = 0; i < nx * nz; i++) { uvs[i * 2] = pos[i * 3] * 0.09; uvs[i * 2 + 1] = pos[i * 3 + 2] * 0.09; }
    tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setAttribute('color', new THREE.BufferAttribute(colr, 3)); tg.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); tg.setIndex(idx); tg.computeVertexNormals();
    const terrain = new THREE.Mesh(tg, M.snow); terrain.receiveShadow = true; terrain.frustumCulled = false; leg.add(terrain);

    // the packed trail with two runner grooves, a little above the snow
    const TX = Math.ceil((x1 - x0) / 1.5), TZ = [-1.0, -0.62, -0.42, -0.3, -0.18, 0, 0.18, 0.3, 0.42, 0.62, 1.0];
    const tp = [], tc = [], ti = [];
    const packed = col(K.snow[1]).lerp(sh, 0.35), groove = col(K.shade).lerp(col('#10204a'), 0.25);
    for (let i = 0; i <= TX; i++) {
      const x = x0 + i * 1.5;
      TZ.forEach((z) => {
        tp.push(x, terrainY(L, x, z) + 0.02, z);
        const g = (Math.abs(Math.abs(z) - 0.3) < 0.07) ? 1 : 0, edge = Math.abs(z) > 0.8 ? 0.6 : 0;
        c.copy(packed).lerp(groove, g * 0.7).lerp(a0, edge);
        tc.push(c.r, c.g, c.b);
      });
    }
    for (let i = 0; i < TX; i++) for (let j = 0; j < TZ.length - 1; j++) { const a = i * TZ.length + j, d = a + TZ.length; ti.push(a, a + 1, d, a + 1, d + 1, d); }
    const trg = new THREE.BufferGeometry();
    trg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); trg.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3)); trg.setIndex(ti); trg.computeVertexNormals();
    const trail = new THREE.Mesh(trg, M.trail); trail.receiveShadow = true; trail.frustumCulled = false; leg.add(trail);

    // rough ice: glossy blue glaze with cracks
    for (const [a, b] of L.rough) {
      const rp = [], ri = [], n = Math.max(2, Math.ceil((b - a) / 1.5));
      for (let i = 0; i <= n; i++) { const x = a + (b - a) * i / n; for (const z of [-1.35, 0, 1.35]) rp.push(x, terrainY(L, x, z) + 0.05, z * (0.85 + 0.15 * Math.sin(x * 0.4))); }
      for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) { const q = i * 3 + j; ri.push(q, q + 1, q + 3, q + 1, q + 4, q + 3); }
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rg.setIndex(ri); rg.computeVertexNormals();
      const mesh = new THREE.Mesh(rg, M.ice); mesh.receiveShadow = true; leg.add(mesh);
      // frost ridges across it
      for (let x = Math.ceil(a / 5) * 5; x < b; x += 5) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 1.8), new THREE.MeshStandardMaterial({ color: '#e8f6ff', roughness: 0.3 }));
        r.position.set(x, terrainY(L, x, 0) + 0.07, 0); r.rotation.y = 0.5 + hash(x) * 0.5; leg.add(r);
      }
    }

    // ---- ridges: three layers of mountains with snow caps, in the haze
    const ridge = (u, s) => 0.5 * Math.sin(u + s) + 0.3 * Math.sin(u * 2.3 + s * 2) + 0.2 * Math.sin(u * 5.1 + s * 3);
    [[K.far, -420, 150, 0.0042, 1.1], [K.mid, -300, 110, 0.0065, 2.4], [K.near, -190, 76, 0.0095, 4.0]].forEach(([cc, z, amp, fr, seed], li) => {
      const NXr = 150, xa = -260, xb = L.len + 420, rp = [], rc = [], ri = [], cr = col(cc), snowc = col('#f4f8ff');
      for (let i = 0; i <= NXr; i++) {
        const x = xa + (xb - xa) * i / NXr, h = amp * (0.35 + 0.9 * Math.abs(ridge(x * fr * 3.4, seed)));
        const top = h + 4;
        rp.push(x, -20, z, x, top * 0.55, z, x, top, z);
        const t0 = col(cc).lerp(col('#10204a'), 0.35), t1 = cr, t2 = cr.clone().lerp(snowc, h > amp * 0.55 ? 0.8 : 0.2);
        rc.push(t0.r, t0.g, t0.b, t1.r, t1.g, t1.b, t2.r, t2.g, t2.b);
      }
      for (let i = 0; i < NXr; i++) for (let j = 0; j < 2; j++) { const q = i * 3 + j; ri.push(q, q + 3, q + 1, q + 1, q + 3, q + 4); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3)); g.setIndex(ri); g.computeVertexNormals();
      const m = new THREE.Mesh(g, M.rock); m.frustumCulled = false; leg.add(m);
      void li;
    });

    // ---- pines: two rows behind the trail plus a few framing the near side far from the team
    const geo = pineGeometry(); geo.userData.keep = true;
    const trees = [];
    const place = (x, z, s, rot) => trees.push([x, terrainY(L, x, z) - 0.15, z, s, rot]);
    const nrows = quality === 'low' ? 2 : 4;
    for (let r = 0; r < nrows; r++) {
      const zz = [-6.5, -11, -17, -26][r], gap = [7, 6.5, 6, 5.5][r] * (quality === 'low' ? 1.5 : 1);
      for (let x = x0 + hash(r) * gap; x < x1; x += gap) {
        const h = hash(x * 0.37 + r * 11 + L.idx * 3);
        if (h < 0.18) continue;
        place(x + (h - 0.5) * 3, zz - h * 3, (0.5 + hash(x + r) * 0.45) * (1 + r * 0.12), h * TAU);
      }
    }
    // near-side trees only at the far ends of the course and well in front of the camera path (never between camera and team)
    for (let x = x0; x < x1; x += 31) { const h = hash(x * 0.2 + 77); if (h > 0.5 && (x < -22 || x > L.len + 35)) place(x, 9 + h * 6, 0.7 + h * 0.5, h * TAU); }
    const inst = new THREE.InstancedMesh(geo, M.pine, trees.length); inst.castShadow = true; inst.receiveShadow = false; inst.frustumCulled = false;
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    trees.forEach(([x, y, z, s, r], i) => { q.setFromEuler(e.set(0, r, 0)); mtx.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s * (0.9 + hash(i) * 0.3), s)); inst.setMatrixAt(i, mtx); });
    leg.add(inst);

    // ---- stakes along the trail (orange reflector flags)
    const stakeG = new THREE.CylinderGeometry(0.02, 0.025, 1.5, 6), flagG = new THREE.BoxGeometry(0.28, 0.12, 0.01);
    const sx = [];
    for (let x = 0; x <= L.len + 20; x += 30) sx.push(x);
    const stakes = new THREE.InstancedMesh(stakeG, M.wood, sx.length), flags = new THREE.InstancedMesh(flagG, M.flag, sx.length);
    sx.forEach((x, i) => { const y = terrainY(L, x, -1.9); mtx.makeTranslation(x, y + 0.75, -1.9); stakes.setMatrixAt(i, mtx); mtx.makeTranslation(x + 0.15, y + 1.38, -1.9); flags.setMatrixAt(i, mtx); });
    stakes.castShadow = true; leg.add(stakes, flags);

    // ---- junction signs + the side trails
    L.jx.forEach((j) => {
      const g = new THREE.Group(), post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 8), M.wood); post.position.y = 1.2; post.castShadow = true;
      const tex = signTex(j.dir === 'R' ? 'GEE' : 'HAW', j.dir);
      const bm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: '#ffd54a', emissiveIntensity: 0, emissiveMap: tex });
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 0.07), bm); board.position.set(0, 2.55, 0); board.castShadow = true;
      g.add(post, board);
      const zs = j.dir === 'R' ? 1.9 : -1.9;
      g.position.set(j.x, terrainY(L, j.x, zs), zs); leg.add(g);
      W.signs.push({ j, mat: bm, board });
      // side trail leaving the main trail toward the marked way
      const sp = [], si = [], n = 10, sd = j.dir === 'R' ? 1 : -1;
      for (let i = 0; i <= n; i++) {
        const u = i / n, x = j.x + u * 22, z = sd * (0.2 + u * u * 16);
        for (const w of [-0.55, 0.55]) sp.push(x, terrainY(L, x, z + w * 0.5) + 0.03, z + w * 0.5);
      }
      for (let i = 0; i < n; i++) { const q0 = i * 2; si.push(q0, q0 + 1, q0 + 2, q0 + 1, q0 + 3, q0 + 2); }
      const sgm = new THREE.BufferGeometry(); sgm.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sgm.setIndex(si); sgm.computeVertexNormals();
      const sm = new THREE.Mesh(sgm, new THREE.MeshStandardMaterial({ color: col(K.snow[1]).lerp(sh, 0.35), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      sm.receiveShadow = true; leg.add(sm);
    });

    // ---- steep warning signs
    for (const [a] of L.steep) {
      const X = a - 36; if (X < x0) continue;
      const g = new THREE.Group(), post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.0, 6), M.wood); post.position.y = 1.0;
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.05), new THREE.MeshStandardMaterial({ color: '#ffd23a', roughness: 0.5 })); d.rotation.z = Math.PI / 4; d.position.y = 2.35;
      const tri = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 3), new THREE.MeshStandardMaterial({ color: '#23262e', roughness: 0.6 })); tri.rotation.x = Math.PI / 2; tri.rotation.y = Math.PI; tri.position.set(0, 2.33, 0.04); tri.rotation.z = Math.PI;
      g.add(post, d, tri); g.position.set(X, terrainY(L, X, -2.2), -2.2); post.castShadow = d.castShadow = true; leg.add(g);
    }

    // ---- start / finish / checkpoint gantries
    const gantry = (X, label, colr, big = true) => {
      const g = new THREE.Group();
      const tex = bannerTex(label, colr);
      const board = new THREE.Mesh(new THREE.BoxGeometry(7.6, 1.5, 0.12), [M.wood, M.wood, M.wood, M.wood, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 })]);
      board.position.set(0, 4.8, 0); board.castShadow = true; g.add(board);
      for (const dx of [-3.4, 3.4]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5.4, 8), M.wood); p.position.set(dx, 2.7, 0); p.castShadow = true; g.add(p); }
      // pennants
      const pen = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.22, 0.9, 3), new THREE.MeshStandardMaterial({ color: colr, roughness: 0.6 })); pen.rotation.z = -Math.PI / 2; pen.position.set(3.4, 5.9, 0); g.add(pen);
      g.position.set(X, terrainY(L, X, -3.6), -3.6);
      if (big) leg.add(g);
      // the line across the trail
      for (let i = 0; i < 8; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.42), new THREE.MeshStandardMaterial({ color: i % 2 ? '#fff' : '#161b28', roughness: 0.6 }));
        m.position.set(X, terrainY(L, X, 0) + 0.035, -1.68 + i * 0.48); leg.add(m);
      }
      return g;
    };
    const isLast = cfg.isLast !== false && L.idx >= 0 ? cfg.isLast : true;
    if (L.idx === 0) gantry(0, 'START', '#2a6fb5');
    if (isLast) gantry(L.len, 'FINISH', '#c8452a');
    else {
      gantry(L.len, 'CHECKPOINT', '#2a9d8f');
      // cabin with a lit window and a smoking chimney
      const Xc = L.len + 15.5, cab = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.2, 4.2), M.logs); body.position.y = 1.6; body.castShadow = true; body.receiveShadow = true;
      for (let k = 0; k < 7; k++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 6.5, 8), M.logs); lg.rotation.z = Math.PI / 2; lg.position.set(0, 0.25 + k * 0.45, 2.15); lg.castShadow = true; cab.add(lg); }
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 3.9, 2.3, 4, 1), M.roof); roof.rotation.y = Math.PI / 4; roof.scale.set(1.05, 1, 0.72); roof.position.y = 4.3; roof.castShadow = true;
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6), new THREE.MeshStandardMaterial({ color: '#6a6f7a', roughness: 0.9 })); ch.position.set(1.6, 5.2, -0.4); ch.castShadow = true;
      cab.add(body, roof, ch);
      for (const dx of [-1.9, 1.5]) { const w = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.12), M.win); w.position.set(dx, 2.0, 2.18); cab.add(w); }
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 0.12), M.wood); door.position.set(-0.2, 0.95, 2.18); cab.add(door);
      const lamp = new THREE.PointLight('#ffb84a', 8, 14, 1.8); lamp.position.set(0, 2.4, 3.2); cab.add(lamp); W.cabinLight = lamp;
      cab.position.set(Xc, terrainY(L, Xc, -6.5), -6.5); leg.add(cab); W.cabin = cab;
      // straw for the team
      for (let k = 0; k < 4; k++) for (const o of [0, 0.7]) {
        const X = L.len + 3.5 + k * 3.6 + o, b = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 1.7, 10), M.straw); b.rotation.z = Math.PI / 2; b.position.set(X, terrainY(L, X, -0.2 + o * 0.3) + 0.2, -0.2 + o * 0.5); b.receiveShadow = true; leg.add(b);
      }
    }
    W.spectators = { start: L.idx === 0, end: true };
    void K; void cfg; void slopeAt; void windowOf; void lerp;
  };

  // ---- look: sky colours, lights, fog (called when the look or weather changes)
  W.applyLook = (lookIdx, weather, rig) => {
    const K = LOOKS[lookIdx] || LOOKS[1];
    const u = skyMat.uniforms;
    u.c0.value.set(K.sky[0]); u.c1.value.set(K.sky[1]); u.c2.value.set(K.sky[2]); u.c3.value.set(K.sky[3]);
    const night = lookIdx === 3, dusk = lookIdx === 2, dawn = lookIdx === 0;
    u.uAur.value = night ? 1 : 0; u.uStars.value = night ? 0.9 : dusk ? 0.2 : 0;
    const el = night ? 0.45 : dusk ? 0.1 : dawn ? 0.16 : 0.5;
    const az = night ? 0.5 : dusk ? -0.8 : dawn ? 0.75 : -0.35;
    u.sunDir.value.set(Math.sin(az), el, -Math.cos(az)).normalize();
    u.sunCol.value.set(night ? '#cfd8ff' : K.sun[0]);
    const D = u.sunDir.value;
    W.sun.position.copy(D).multiplyScalar(700); W.sun.material.color.set(night ? '#a8c0ff' : dusk ? '#ff9a6a' : dawn ? '#ffc08a' : '#fff0c0'); W.sun.scale.setScalar(night ? 180 : 320);
    const wx = { clear: [70, 520], snow: [32, 200], whiteout: [8, 62] }[weather || 'clear'];
    const fogC = col(K.fog);
    if (rig) {
      rig.scene.fog = new THREE.Fog(fogC, wx[0], wx[1]);
      rig.scene.background = col(K.sky[3]);
      const keyC = night ? '#9fb4ff' : dusk ? '#ff9a68' : dawn ? '#ffb48c' : '#fff1d2';
      rig.key.color.set(keyC); rig.key.intensity = night ? 1.9 : dusk ? 2.2 : dawn ? 2.0 : 2.7;
      rig.hemi.color.set(night ? '#5a78c8' : dusk ? '#c8a0d8' : dawn ? '#d8b4d8' : '#cfe4ff'); rig.hemi.groundColor.set(night ? '#1a2848' : '#9fb4d0'); rig.hemi.intensity = night ? 0.95 : 0.5;
      rig.rim.color.set(night ? '#5affd0' : dusk ? '#ff7aa8' : '#fff8e0'); rig.rim.intensity = night ? 1.6 : 1.0;
      rig.exposure = night ? 1.3 : 0.92;
      rig.keyDir.set(night ? 6 : dusk ? 9 : dawn ? 10 : -7, night ? 12 : dusk ? 6 : dawn ? 7 : 11, 9);
    }
    const heavy = weather === 'whiteout' ? 1 : weather === 'snow' ? 0.55 : 0.07;
    W.setSnowCount(Math.round(NS * heavy));
    snowMat.uniforms.uFall.value.set(heavy > 0.8 ? 5.5 : 1.6 + heavy, heavy > 0.8 ? 7 : 0.8 + heavy);
    snowMat.uniforms.uSize.value = heavy > 0.8 ? 0.11 : 0.075;
    W.look = lookIdx; W.weather = weather;
  };
  return W;
}

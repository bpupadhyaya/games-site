// The landscape: sky dome (time of day), lit heightfield terrain with the caravan road, far ranges with snow, instanced flora and rocks.
// Terrain is evaluated in WORLD coordinates and re-sampled when the camera moves a grid step, so the road is endless and seamless.
import { THREE } from '../vendor3d/index.js';
import { groundTexture } from './tex.js';

const hash = (n) => { n = Math.imul(n ^ (n >>> 15), 0x85ebca6b); n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const h2 = (x, z, s) => hash((Math.imul(x | 0, 73856093) ^ Math.imul(z | 0, 19349663) ^ Math.imul(s | 0, 83492791)) >>> 0);
function vnoise(x, z, s) { const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); const a = h2(xi, zi, s), b = h2(xi + 1, zi, s), c = h2(xi, zi + 1, s), d = h2(xi + 1, zi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const fbm = (x, z, s) => vnoise(x, z, s) * 0.55 + vnoise(x * 2.1, z * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, z * 4.3, s + 13) * 0.15;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Biomes: ground colours (lit / shade / road), relief (m), dune crests, flora, far range kind.
export const BIOMES = {
  loess:   { lit: '#d2ab70', shade: '#8f6a40', road: '#c9a878', relief: 3.5, dunes: 0, flora: 'poplar', density: 0.22, far: 'hills', farCol: '#a88a78', snow: 0, tex: 'gravel', terrace: 1 },
  gobi:    { lit: '#a99073', shade: '#5f4c3c', road: '#b8a084', relief: 2.2, dunes: 0, flora: 'scrub', density: 0.3, far: 'peaks', farCol: '#8a86a0', snow: 0.62, tex: 'gravel' },
  dunes:   { lit: '#efc68a', shade: '#a8693e', road: '#e2bd88', relief: 1.2, dunes: 7, flora: 'scrub', density: 0.06, far: 'dunes', farCol: '#d6a77a', snow: 0, tex: 'sand' },
  snow:    { lit: '#eef2f8', shade: '#7c8aa6', road: '#9a8a78', relief: 5, dunes: 0, flora: 'pine', density: 0.12, far: 'peaks', farCol: '#b9c8e2', snow: 0.3, tex: 'gravel' },
  valley:  { lit: '#a3a868', shade: '#5c6a3c', road: '#b8a070', relief: 3, dunes: 0, flora: 'poplar', density: 0.3, far: 'peaks', farCol: '#8ea0b8', snow: 0.58, tex: 'grass' },
  karakum: { lit: '#c9ab72', shade: '#80673c', road: '#c8b080', relief: 1.2, dunes: 3.5, flora: 'scrub', density: 0.2, far: 'dunes', farCol: '#b49a80', snow: 0, tex: 'sand' },
  plain:   { lit: '#c6b26c', shade: '#7f6e3a', road: '#c8b48a', relief: 1.4, dunes: 0, flora: 'palm', density: 0.12, far: 'hills', farCol: '#a9998a', snow: 0, tex: 'grass' },
  tigris:  { lit: '#c2ad72', shade: '#7f6c3e', road: '#c9b48a', relief: 0.8, dunes: 0, flora: 'palm', density: 0.2, far: 'hills', farCol: '#b4a48e', snow: 0, tex: 'grass', river: 1 },
};
// Sky and light per time of day (matches the 2D palette in src/paint.js SKY).
export const SKIES = {
  dawn:  { top: '#4d5f9e', mid: '#e58f8c', hor: '#ffd9a2', sun: [0.55, 0.12, -1], sunCol: '#ffd2a0', sunI: 2.4, hemi: ['#b9b4d8', '#6a5040', 0.9], fog: '#e8b898', exp: 1.0 },
  day:   { top: '#2f78c0', mid: '#8dc0e6', hor: '#f5e8c8', sun: [-0.5, 0.75, 0.45], sunCol: '#fff4e0', sunI: 3.0, hemi: ['#bcd8f0', '#8a7050', 1.1], fog: '#e9dfc8', exp: 1.0 },
  dusk:  { top: '#2c2f66', mid: '#b4527f', hor: '#ffae62', sun: [0.6, 0.1, -1], sunCol: '#ffb070', sunI: 2.8, hemi: ['#9a7ab8', '#5a3a30', 0.75], fog: '#e8946a', exp: 1.05 },
  night: { top: '#050a22', mid: '#14224f', hor: '#3a4c80', sun: [0.4, 0.6, -0.6], sunCol: '#9fb4ff', sunI: 0.7, hemi: ['#3a4a80', '#151020', 0.45], fog: '#26345e', exp: 1.1 },
};

const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const SKY_FS = `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night; uniform float stars; varying vec3 vDir;
float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
void main(){ vec3 d = normalize(vDir); float y = d.y;
  vec3 c = y > 0.18 ? mix(mid, top, smoothstep(0.18, 0.75, y)) : mix(hor, mid, smoothstep(-0.02, 0.18, y));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  c += sunCol * (pow(s, 900.0) * 6.0 * (1.0 - night * 0.6) + pow(s, 24.0) * 0.45 + pow(s, 4.0) * 0.12);
  if (stars > 0.0 && y > 0.05) { vec3 q = floor(d * 380.0); float r = h(q); c += vec3(0.9,0.92,1.0) * step(0.9975, r) * stars * smoothstep(0.05, 0.3, y); }
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

export function createWorld(scene, renderer) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, night: { value: 0 }, stars: { value: 0 } } }));
  sky.scale.setScalar(1500); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
  scene.fog = new THREE.Fog('#e9dfc8', 60, 700);
  const sun = new THREE.DirectionalLight('#ffffff', 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 18, bottom: -18, near: 1, far: 200 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight('#ffffff', '#806040', 1); scene.add(hemi);
  const rim = new THREE.DirectionalLight('#ffe0b0', 0.6); scene.add(rim, rim.target);

  // ---- terrain ----------------------------------------------------------------------------------------------------------------------
  const W = 340, D0 = 26, D1 = -190, NX = 150, NZ = 90;      // x span, z from +26 (in front of the camera) to -190
  const tg = new THREE.PlaneGeometry(W, D0 - D1, NX, NZ); tg.rotateX(-Math.PI / 2); tg.translate(0, 0, (D0 + D1) / 2);
  const base = Float32Array.from(tg.attributes.position.array);
  tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(base.length), 3));
  const tmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, map: groundTexture('sand') });
  const terrain = new THREE.Mesh(tg, tmat); terrain.receiveShadow = true; scene.add(terrain);
  // far ranges: a coarse lit heightfield from the end of the terrain to the horizon (ridged noise, snow above the snow line)
  const FZ0 = D1 + 6, FZ1 = -1100, FX = 2400;
  const fg = new THREE.PlaneGeometry(FX, FZ0 - FZ1, 160, 48); fg.rotateX(-Math.PI / 2); fg.translate(0, 0, (FZ0 + FZ1) / 2);
  { const p = fg.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i), u = (FZ0 - z) / (FZ0 - FZ1); p.setZ(i, FZ0 - Math.pow(u, 1.6) * (FZ0 - FZ1)); } }
  const fbase = Float32Array.from(fg.attributes.position.array);
  fg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(fbase.length), 3));
  const farMesh = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: false })); farMesh.receiveShadow = false; scene.add(farMesh);
  // river (Tigris plain and river events)
  const river = new THREE.Mesh(new THREE.PlaneGeometry(1200, 22, 1, 1), new THREE.MeshPhysicalMaterial({ color: '#3f7a9a', roughness: 0.12, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.92 }));
  river.rotation.x = -Math.PI / 2; river.position.set(0, 0.25, -34); river.visible = false; river.receiveShadow = true; scene.add(river);

  // ---- flora (instanced) -----------------------------------------------------------------------------------------------------------
  const MAXF = 360, dummy = new THREE.Object3D();
  const leaf = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
  const poplarG = new THREE.SphereGeometry(1, 10, 8); poplarG.scale(0.55, 2.4, 0.55); poplarG.translate(0, 3.2, 0);
  const trunkG = new THREE.CylinderGeometry(0.08, 0.14, 2.2, 6); trunkG.translate(0, 1.1, 0);
  const pineG = new THREE.CylinderGeometry(0, 1.3, 4.2, 9, 3); pineG.translate(0, 3.1, 0);
  const scrubG = new THREE.SphereGeometry(1, 8, 6); scrubG.scale(0.6, 0.35, 0.6); scrubG.translate(0, 0.2, 0);
  const rockG = new THREE.SphereGeometry(1, 7, 5); { const p = rockG.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.8 + hash(i) * 0.4), p.getY(i) * (0.55 + hash(i + 9) * 0.3), p.getZ(i) * (0.8 + hash(i + 3) * 0.4)); rockG.computeVertexNormals(); }
  const palmTrunkG = new THREE.CylinderGeometry(0.12, 0.2, 6, 7, 6); palmTrunkG.translate(0, 3, 0); { const p = palmTrunkG.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 0.03 * y * y); } palmTrunkG.computeVertexNormals(); }
  const frondG = (() => { const gs = []; for (let k = 0; k < 9; k++) { const g = new THREE.PlaneGeometry(3.2, 0.55, 6, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 1.6; p.setXYZ(i, x, -0.12 * x * x + 0.35 * x, p.getY(i) * (1 - x / 3.6)); } g.rotateY(k * Math.PI * 2 / 9 + 0.2); g.translate(1.08, 6, 0); gs.push(g); } return mergeGeos(gs); })();
  const F = {
    poplar: [new THREE.InstancedMesh(poplarG, leaf('#5d7a38'), MAXF), new THREE.InstancedMesh(trunkG, leaf('#5a4632'), MAXF)],
    pine: [new THREE.InstancedMesh(pineG, leaf('#2a4a3a'), MAXF), new THREE.InstancedMesh(trunkG, leaf('#4a3a2a'), MAXF)],
    palm: [new THREE.InstancedMesh(frondG, Object.assign(leaf('#4f7a36'), { side: THREE.DoubleSide }), MAXF), new THREE.InstancedMesh(palmTrunkG, leaf('#7a6248'), MAXF)],
    scrub: [new THREE.InstancedMesh(scrubG, leaf('#7d7a44'), MAXF)],
    rock: [new THREE.InstancedMesh(rockG, leaf('#8a7a66'), MAXF)],
  };
  for (const arr of Object.values(F)) for (const m of arr) { m.castShadow = true; m.receiveShadow = true; m.count = 0; m.frustumCulled = false; scene.add(m); }

  let B = BIOMES.dunes, seed = 3, cx0 = null, biomeKey = '', roadZ = 0, flat = [];
  // Height at a world point: the road band (|z - roadZ| < 3) is packed flat; relief and dune crests grow away from it; the far half rises.
  function height(x, z) {
    const dz = Math.abs(z - roadZ), away = smooth(3, 14, dz);
    let h = (fbm(x * 0.03, z * 0.03, seed) - 0.45) * B.relief * 2 * (0.3 + away);
    if (B.dunes) { const u = x * 0.045 + z * 0.012 + fbm(x * 0.01, z * 0.02, seed + 5) * 3; const crest = 1 - Math.abs(Math.sin(u)); h += B.dunes * crest * crest * away * (0.5 + 0.5 * fbm(x * 0.02, z * 0.02, seed + 2)); }
    if (B.terrace && z < -30) h += Math.floor((fbm(x * 0.01, z * 0.01, seed + 4) * 12 + (-z - 30) * 0.06)) * 1.6;
    h += smooth(-40, -170, z) * 18 * fbm(x * 0.008, z * 0.01, seed + 9);
    for (const f of flat) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r) h *= smooth(f.r * 0.6, f.r, d); }
    if (B.river && z < -24 && z > -44) h = Math.min(h, -0.5);
    return h;
  }
  const cLit = new THREE.Color(), cShade = new THREE.Color(), cRoad = new THREE.Color(), cSnow = new THREE.Color('#f4f7fc'), tmp = new THREE.Color();
  function rebuild(cx) {
    const pos = tg.attributes.position, col = tg.attributes.color;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3] + cx, z = base[i * 3 + 2], y = height(x, z); pos.setY(i, y); pos.setX(i, x);
    }
    tg.computeVertexNormals();
    const nrm = tg.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i), ny = nrm.getY(i), dz = Math.abs(z - roadZ);
      tmp.copy(cShade).lerp(cLit, Math.min(1, Math.max(0, (ny - 0.55) / 0.45) * 0.7 + 0.3 * fbm(x * 0.05, z * 0.05, seed + 1)));
      if (dz < 3.2) tmp.lerp(cRoad, (1 - smooth(1.6, 3.2, dz)) * (0.75 + 0.25 * vnoise(x * 0.8, z * 2, 4)));
      if (B.snow && y > 3 && B.snow < 0.5) tmp.lerp(cSnow, smooth(3, 6, y));
      col.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    pos.needsUpdate = true; col.needsUpdate = true; tg.computeBoundingSphere();
    // far ranges
    { const p = fg.attributes.position, c = fg.attributes.color, fc = new THREE.Color(B.farCol), sh = new THREE.Color(B.shade), amp = B.far === 'peaks' ? 150 : B.far === 'dunes' ? 30 : 60;
      for (let i = 0; i < p.count; i++) {
        const x = fbase[i * 3] + cx, z = fbase[i * 3 + 2], u = Math.min(1, (FZ0 - z) / 900);
        let r = 0, a = 1, f = 0.0035; for (let o = 0; o < 4; o++) { const nn = vnoise(x * f, z * f, seed + 40 + o); r += a * (B.far === 'dunes' ? nn : 1 - Math.abs(2 * nn - 1)) ; a *= 0.5; f *= 2.1; }
        const hgt = (B.far === 'peaks' ? Math.pow(r / 1.9, 2.4) * 2.2 : r / 1.9) * amp * smooth(0.12, 0.6, u) + height(x, FZ0) * (1 - smooth(0, 0.2, u));
        p.setX(i, x); p.setY(i, hgt);
      }
      fg.computeVertexNormals(); const nn = fg.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i), ny = nn.getY(i);
        tmp.copy(sh).lerp(fc, 0.35 + 0.65 * Math.max(0, Math.min(1, (ny - 0.5) * 2)));
        if (B.far === 'peaks' && y > amp * B.snow && ny > 0.5) tmp.lerp(cSnow, Math.min(0.9, (y - amp * B.snow) / (amp * 0.15)));
        c.setXYZ(i, tmp.r, tmp.g, tmp.b);
      }
      p.needsUpdate = true; c.needsUpdate = true; fg.computeBoundingSphere(); }
    // flora: one candidate per 7 m cell, away from the road and from flattened spots
    const lists = { poplar: [], pine: [], palm: [], scrub: [], rock: [] };
    const step = 7;
    for (let gx = Math.floor((cx - W / 2) / step); gx < (cx + W / 2) / step; gx++) for (let gz = Math.floor(D1 / step); gz < D0 / step; gz++) {
      const r = h2(gx, gz, seed + 31); const x = (gx + h2(gx, gz, 5)) * step, z = (gz + h2(gx, gz, 6)) * step; const dz = Math.abs(z - roadZ);
      if (dz < 4.5 || (B.river && z < -22 && z > -46)) continue; if (flat.some((f) => Math.hypot(x - f.x, z - f.z) < f.r)) continue;
      const near = z > -70 ? 1 : 0.35;
      if (r < B.density * near) lists[B.flora].push([x, z, 0.75 + h2(gx, gz, 8) * 0.6]);
      else if (r > 0.94 - (B.flora === 'scrub' ? 0.05 : 0)) lists.rock.push([x, z, 0.4 + h2(gx, gz, 9) * 1.2]);
    }
    for (const [k, arr] of Object.entries(F)) {
      const L = lists[k].slice(0, MAXF);
      for (const m of arr) { L.forEach(([x, z, s], i) => { dummy.position.set(x, height(x, z) - 0.05, z); dummy.rotation.set(0, h2(i, k.length, 3) * 6.28, 0); dummy.scale.setScalar(s); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }); m.count = L.length; m.instanceMatrix.needsUpdate = true; }
    }
  }
  let SK = SKIES.day;
  const world = {
    sky, sun, hemi, rim, terrain, river, height,
    setBiome(key, timeKey, s, opts = {}) {
      const k = `${key}|${timeKey}|${s}|${JSON.stringify(opts.flat ?? [])}|${opts.roadZ ?? 0}`;
      if (k === biomeKey) return false;
      biomeKey = k; B = BIOMES[key] ?? BIOMES.dunes; seed = s; flat = opts.flat ?? []; roadZ = opts.roadZ ?? 0; SK = SKIES[timeKey] ?? SKIES.day;
      cLit.set(B.lit); cShade.set(B.shade); cRoad.set(B.road);
      tmat.map = groundTexture(B.tex); tmat.map.repeat.set(W / 7, (D0 - D1) / 7); tmat.needsUpdate = true;
      const U = sky.material.uniforms; U.top.value.set(SK.top); U.mid.value.set(SK.mid); U.hor.value.set(SK.hor); U.sunCol.value.set(SK.sunCol); U.night.value = timeKey === 'night' ? 1 : 0; U.stars.value = timeKey === 'night' ? 1 : 0;
      U.sunDir.value.set(...SK.sun).normalize();
      sun.color.set(SK.sunCol); sun.intensity = SK.sunI; hemi.color.set(SK.hemi[0]); hemi.groundColor.set(SK.hemi[1]); hemi.intensity = SK.hemi[2];
      rim.color.set(SK.sunCol); rim.intensity = timeKey === 'day' ? 0.5 : 1.4;
      scene.fog.color.set(SK.fog); scene.fog.near = 60; scene.fog.far = timeKey === 'night' ? 420 : 900;
      renderer.toneMappingExposure = SK.exp;
      river.visible = !!B.river || !!opts.river; river.position.z = B.river ? -34 : (opts.riverZ ?? -34);
      for (const arr of Object.values(F)) for (const m of arr) m.count = 0;
      F.poplar[0].material.color.set(key === 'valley' ? '#5f8a3a' : '#6d7f3c');
      cx0 = null; return true;
    },
    // keep the terrain under the camera; light follows the caravan
    follow(cx, focus) {
      const snap = Math.round(cx / 14) * 14;
      if (snap !== cx0) { cx0 = snap; rebuild(snap); }
      const d = new THREE.Vector3(...SK.sun).normalize();
      sun.position.set(focus.x + d.x * 80, focus.y + Math.max(0.25, d.y) * 80, focus.z + d.z * 80); sun.target.position.copy(focus);
      rim.position.set(focus.x - d.x * 50, 30, focus.z - d.z * 50 + 40); rim.target.position.copy(focus);
      sky.position.set(cx, 0, 0);
    },
    reset() { biomeKey = ''; cx0 = null; },
    sunDir: () => new THREE.Vector3(...SK.sun).normalize(),
  };
  return world;
}

// merge simple non-indexed/indexed geometries (position + normal + uv)
export function mergeGeos(list) {
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
  for (const g of geos) { g.computeVertexNormals(); pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return out;
}

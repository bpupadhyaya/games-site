// The steppe as a real 3D place: a golden-hour sky dome with cirrus and a low sun, drifted snow with wind-carved relief and long shadows,
// layered snow-capped ranges, felt yurts with smoke, dry grass tufts that sway, the den, wind-blown spindrift and falling flakes.
// Presentation only. World frame (metres, 1 sim metre = C m): +Z away from the rider, +Y up, +X to the LEFT of the screen (sim x = -X / C).
import { snowCanvas, snowBumpCanvas, tuftCanvas, feltCanvas, yurtBandCanvas, rngOf, cv } from './textures.js';

export const C = 0.4;                                    // presentation scale of the hunting ground (see src/cam3d.js)
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// smooth value noise (deterministic, no state)
const hash2 = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
const noise2 = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
};
const fbm = (x, y, o = 4) => { let a = 0.5, s = 0, f = 1; for (let i = 0; i < o; i++) { s += a * noise2(x * f, y * f); f *= 2.03; a *= 0.5; } return s; };
export const terrainH = (x, z) => {
  // wind-formed drifts: broad swells with long sastrugi ridges running along the wind, higher toward the far country
  const far = sstep(30, 260, z);
  const swell = 2.3 * (fbm(x * 0.017 + 3.1, z * 0.013 + 1.7, 3) - 0.5);
  const ridge = 0.28 * Math.sin(x * 0.11 + 2.0 * fbm(x * 0.03, z * 0.05 + 4, 2)) * (0.4 + 0.6 * noise2(x * 0.02, z * 0.02));
  return swell * (0.55 + 0.7 * far) + ridge + 0.1 * (noise2(x * 0.35, z * 0.3) - 0.5) + far * 1.6 * fbm(x * 0.012, z * 0.01 + 9, 2);
};

// where the snow is thin and the dry steppe shows through (0..1); drives ground colour and where tufts grow
export const patchAt = (x, z) => sstep(0.58, 0.78, fbm(x * 0.045 + 11, z * 0.04 + 5, 3)) * (0.55 + 0.45 * sstep(0.3, 0.6, noise2(x * 0.2, z * 0.2)));
export const LOOKS = [
  // Gentle: clear, warm; Open steppe: a little hazier; Blizzard: low sun lost in cloud, heavy fog, driving snow
  { name: 'Gentle', zen: 0x1f4c8f, mid: 0x6a97cf, hor: 0xffc78d, ground: 0xecd0b0, sun: 0xffe2a8, sunI: 2.7, fog: 0xf1d5b4, fogD: 0.0028, cloud: 0.8, hemi: 0.75, snow: 0.35, ambCol: 0xcfe0ff, gnd: 0xfff1de },
  { name: 'Open steppe', zen: 0x224a86, mid: 0x6e97c8, hor: 0xf7c690, ground: 0xe6cfb4, sun: 0xffddaa, sunI: 2.6, fog: 0xeccfb2, fogD: 0.0036, cloud: 1.0, hemi: 0.72, snow: 0.6, ambCol: 0xc8d9f5, gnd: 0xf6ead7 },
  { name: 'Blizzard', zen: 0x6d7f98, mid: 0xa4b1c4, hor: 0xd8d4cf, ground: 0xcfd0d2, sun: 0xf3e5d0, sunI: 1.2, fog: 0xcdd3da, fogD: 0.011, cloud: 1.0, hemi: 1.1, snow: 3.2, ambCol: 0xc4cedb, gnd: 0xe6e8ec },
];

function skyMaterial(T) {
  return new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: {
      uSun: { value: new T.Vector3(0, 0.3, 1) }, uZen: { value: new T.Color() }, uMid: { value: new T.Color() }, uHor: { value: new T.Color() }, uGround: { value: new T.Color() },
      uSunCol: { value: new T.Color() }, uTime: { value: 0 }, uCloud: { value: 1 }, uWind: { value: new T.Vector2(1, 0) },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `
      varying vec3 vDir; uniform vec3 uSun, uZen, uMid, uHor, uGround, uSunCol; uniform float uTime, uCloud; uniform vec2 uWind;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<5;i++){ s += a*n(p); p = p*2.03 + 17.1; a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir); float e = d.y, te = clamp(e, 0.0, 1.0);
        vec3 col = mix(uHor, uMid, smoothstep(0.0, 0.2, te));
        col = mix(col, uZen, smoothstep(0.14, 0.8, te));
        if (e < 0.0) col = mix(uHor, uGround, clamp(-e * 8.0, 0.0, 1.0));
        float s = max(dot(d, uSun), 0.0);
        col += uSunCol * (0.30 * pow(s, 5.0) + 0.75 * pow(s, 36.0) + 2.6 * pow(s, 1200.0));
        if (e > 0.0) {
          vec2 p = d.xz / (e + 0.10) * vec2(0.8, 1.7) + uWind * uTime * 0.0045;
          float a = fbm(p * 1.25), b = fbm(p * 3.9 + 7.0);
          float cl = smoothstep(0.5, 0.86, a * 0.72 + b * 0.34) * smoothstep(0.012, 0.22, e) * uCloud;
          vec3 cc = mix(vec3(0.99, 0.93, 0.9), uSunCol + vec3(0.25, 0.18, 0.1), pow(s, 2.5) * 0.85);
          cc = mix(cc * 0.62 + uMid * 0.32, cc, smoothstep(0.15, 0.6, b));
          col = mix(col, cc, cl * 0.88);
        }
        col = pow(col, vec3(1.0 / 2.2));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// The mountain country: a lit heightfield in polar coordinates round the viewer (ridged noise, snow above a ragged line and on gentle
// slopes, rock below, aerial haze with distance). Angles are measured from +Z (0 = straight ahead); X is mirrored like the rest of the world.
function mountainGeometry(T, { A = 2.3, R0 = 380, R1 = 1700, cols = 380, rows = 64, seed = 1.7, hMax = 330, hazeCol, rock, rock2, snowCol }) {
  const pos = [], col = [], idx = [];
  const rockC = new T.Color(rock), rock2C = new T.Color(rock2), snowC = new T.Color(snowCol), hazeC = new T.Color(hazeCol);
  const H = new Float32Array((cols + 1) * (rows + 1));
  const rr = (j) => R0 + (R1 - R0) * Math.pow(j / rows, 1.55);
  for (let i = 0; i <= cols; i++) {
    const a = -A + (2 * A * i) / cols;
    for (let j = 0; j <= rows; j++) {
      const r = rr(j), x = -Math.sin(a) * r, z = Math.cos(a) * r;
      const u = x / 380 + seed, v = z / 380;
      const env = 0.35 + 0.65 * sstep(0.35, 0.75, fbm(a * 1.35 + seed * 1.3, 0.5, 3));
      const rid = (p, q) => { const n = 1 - Math.abs(2 * fbm(p, q, 5) - 1); return Math.pow(n, 2.2); };
      let h = 0.24 * r * env * (0.1 + 0.9 * rid(u * 0.95, v * 0.95)) * (0.62 + 0.55 * rid(u * 2.4 + 9, v * 2.4 + 4)) + 0.022 * r * rid(u * 6, v * 6);
      h *= sstep(R0 - 60, R0 + 220, r);
      H[i * (rows + 1) + j] = h;
      pos.push(x, h - 2, z);
    }
  }
  for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) {
    const k = i * (rows + 1) + j, h = H[k], r = rr(j), a = -A + (2 * A * i) / cols;
    const hi = H[Math.min(cols, i + 1) * (rows + 1) + j] - H[Math.max(0, i - 1) * (rows + 1) + j];
    const hj = H[i * (rows + 1) + Math.min(rows, j + 1)] - H[i * (rows + 1) + Math.max(0, j - 1)];
    const dA = (2 * A * 2 / cols) * r, dR = Math.max(1, rr(Math.min(rows, j + 1)) - rr(Math.max(0, j - 1)));
    const slope = Math.hypot(hi / dA, hj / dR);
    const hn = h / hMax;
    const rag = fbm(a * 30 + j * 0.2, seed * 3 + r * 0.01, 3) - 0.5;
    const sn = sstep(0.3 + rag * 0.3, 0.42 + rag * 0.3, hn + 0.2 * (1 - sstep(0.35, 1.0, slope)) - 0.16 * sstep(0.5, 1.2, slope));
    const base = rockC.clone().lerp(rock2C, fbm(a * 12 + j * 0.15, seed + 3));
    const c = base.lerp(snowC, sn);
    c.multiplyScalar(0.72 + 0.4 * hn);
    c.lerp(hazeC, clamp(1 - Math.exp(-(r - 300) / 1100), 0, 0.85) * (0.8 - 0.25 * hn));
    col.push(c.r, c.g, c.b);
  }
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const k = i * (rows + 1) + j, k2 = (i + 1) * (rows + 1) + j;
    idx.push(k, k2, k + 1, k + 1, k2, k2 + 1);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function makeYurt(T, mats, seed) {
  const g = new T.Group();
  const r = 3.0, wallH = 1.5;
  const wall = new T.Mesh(new T.CylinderGeometry(r, r, wallH, 28, 1, true), mats.wall); wall.position.y = wallH / 2; wall.castShadow = true; wall.receiveShadow = true; g.add(wall);
  const roof = new T.Mesh(new T.CylinderGeometry(0.75, r * 1.04, 1.45, 28, 1, true), mats.roof); roof.position.y = wallH + 0.7; roof.castShadow = true; roof.receiveShadow = true; g.add(roof);
  const crown = new T.Mesh(new T.CylinderGeometry(0.78, 0.78, 0.06, 20), mats.dark); crown.position.y = wallH + 1.45; g.add(crown);
  const ring = new T.Mesh(new T.CylinderGeometry(0.34, 0.34, 0.1, 16), mats.dark); ring.position.y = wallH + 1.52; g.add(ring);
  // the patterned felt band around the wall top and the ropes that hold the cover
  const band = new T.Mesh(new T.CylinderGeometry(r * 1.002, r * 1.002, 0.22, 28, 1, true), mats.band); band.position.y = wallH - 0.13; g.add(band);
  for (const y of [0.35, wallH + 0.25]) {
    const rope = new T.Mesh(new T.TorusGeometry(r * (y < wallH ? 1.006 : 0.96 + 0.06 * (1 - (y - wallH) / 1.4)), 0.025, 6, 40), mats.rope);
    rope.rotation.x = Math.PI / 2; rope.position.y = y; g.add(rope);
  }
  const door = new T.Mesh(new T.BoxGeometry(0.95, 1.25, 0.1), mats.door); door.position.set(0, 0.64, r * 0.99); g.add(door);
  const lintel = new T.Mesh(new T.BoxGeometry(1.15, 0.12, 0.14), mats.rope); lintel.position.set(0, 1.32, r * 0.99); g.add(lintel);
  g.rotation.y = seed * 6.28;
  return g;
}

export function createWorld(T, { quality = 'medium' } = {}) {
  const group = new T.Group(); group.name = 'steppe-world';
  const Q = { low: { tufts: 500, flakes: 260, drift: 90, shadows: false, mount: 160 }, medium: { tufts: 1800, flakes: 520, drift: 200, shadows: true, mount: 240 }, high: { tufts: 3200, flakes: 800, drift: 320, shadows: true, mount: 300 } }[quality] || null;
  const q = Q || { tufts: 1800, flakes: 520, drift: 200, mount: 240 };
  const W = { group, look: LOOKS[1], q, time: 0, wind: { x: 0, z: 0 }, parts: {} };

  // ---- sky
  const skyMat = skyMaterial(T);
  const sky = new T.Mesh(new T.SphereGeometry(900, 32, 20), skyMat); sky.renderOrder = -10; sky.frustumCulled = false; group.add(sky);
  const sunDir = new T.Vector3(-0.33, 0.19, 0.92).normalize();   // ahead and to the right of the rider (sim +x is -X here)
  skyMat.uniforms.uSun.value.copy(sunDir);
  W.sunDir = sunDir;

  // ---- terrain: drifted snow with wind ripples; hollows pick up blue shade, crests the warm sun
  const SZ = 2600, SEG = 240;
  const tg = new T.PlaneGeometry(SZ, SZ, SEG, SEG); tg.rotateX(-Math.PI / 2);
  const tp = tg.attributes.position, tcol = new Float32Array(tp.count * 3);
  const white = new T.Color(0xffffff), blue = new T.Color(0xa9c0e6), warm = new T.Color(0xffedcc);
  const sunN = new T.Vector3(-0.33, 0.19, 0.92).normalize();
  const straw = new T.Color(0xb59a6a);
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i) + SZ * 0.2;
    tp.setZ(i, z);
    const h = terrainH(x, z); tp.setY(i, h);
    const e = 1.5, gx = (terrainH(x + e, z) - terrainH(x - e, z)) / (2 * e), gz = (terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e);
    const nrm = new T.Vector3(-gx, 1, -gz).normalize(), lit = clamp(nrm.dot(sunN) * 1.5, 0, 1);
    const sh = clamp(0.35 + lit * 0.5 + (h * 0.12) + (noise2(x * 0.05, z * 0.05) - 0.5) * 0.25, 0, 1);
    const c = blue.clone().lerp(white, sstep(0.12, 0.6, sh)).lerp(warm, sstep(0.55, 1.0, sh) * 0.55);
    // wind-scoured patches where the dry steppe shows through the snow
    const pm = patchAt(x, z); if (pm > 0) c.lerp(straw, pm * 0.62).multiplyScalar(1 - pm * 0.12);
    tcol[i * 3] = c.r; tcol[i * 3 + 1] = c.g; tcol[i * 3 + 2] = c.b;
  }
  tg.setAttribute('color', new T.BufferAttribute(tcol, 3));
  const uvA = tg.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setXY(i, tp.getX(i) / 9, tp.getZ(i) / 9);
  tg.computeVertexNormals();
  const snowT = new T.CanvasTexture(snowCanvas(7, 512)); snowT.wrapS = snowT.wrapT = T.RepeatWrapping; snowT.colorSpace = T.SRGBColorSpace; snowT.anisotropy = 8;
  const bumpT = new T.CanvasTexture(snowBumpCanvas(8, 512)); bumpT.wrapS = bumpT.wrapT = T.RepeatWrapping; bumpT.anisotropy = 8;
  const ground = new T.Mesh(tg, new T.MeshStandardMaterial({ vertexColors: true, map: snowT, bumpMap: bumpT, bumpScale: 2.2, roughness: 0.92, metalness: 0 }));
  ground.receiveShadow = true; group.add(ground); W.parts.ground = ground;

  // ---- mountains (lit heightfield) and a far plain under them
  {
    const geo = mountainGeometry(T, { cols: q.mount * 1.3 | 0, rows: 60, seed: 1.7, hazeCol: 0xf0d6b8, rock: 0x66728c, rock2: 0x867a78, snowCol: 0xfffaf2 });
    const m = new T.Mesh(geo, new T.MeshLambertMaterial({ vertexColors: true, fog: false })); m.frustumCulled = false; group.add(m);
    W.parts.mountains = m;
    const far = new T.Mesh(new T.CircleGeometry(4200, 40), new T.MeshBasicMaterial({ color: 0xf1ddc3, fog: false })); far.rotation.x = -Math.PI / 2; far.position.y = -3; group.add(far);
  }

  // ---- yurts
  const feltT = new T.CanvasTexture(feltCanvas(11, 256)); feltT.wrapS = feltT.wrapT = T.RepeatWrapping; feltT.repeat.set(5, 1); feltT.colorSpace = T.SRGBColorSpace;
  const feltRoof = feltT.clone(); feltRoof.repeat.set(4, 2); feltRoof.needsUpdate = true;
  const bandT = new T.CanvasTexture(yurtBandCanvas('#b5322c', '#1b4d8c')); bandT.wrapS = T.RepeatWrapping; bandT.repeat.set(3, 1); bandT.colorSpace = T.SRGBColorSpace;
  const ymats = {
    wall: new T.MeshStandardMaterial({ map: feltT, color: 0xf4eee0, roughness: 1, side: T.DoubleSide }),
    roof: new T.MeshStandardMaterial({ map: feltRoof, color: 0xeee6d4, roughness: 1, side: T.DoubleSide }),
    band: new T.MeshStandardMaterial({ map: bandT, roughness: 0.9, side: T.DoubleSide }),
    dark: new T.MeshStandardMaterial({ color: 0x3a2a1f, roughness: 0.9 }),
    rope: new T.MeshStandardMaterial({ color: 0x5b4630, roughness: 0.9 }),
    door: new T.MeshStandardMaterial({ color: 0x8a3b24, roughness: 0.8 }),
  };
  const yurts = [], smokeSrc = [];
  const spots = [[-26, 38, 0.1], [-34, 52, 0.4], [30, 44, 0.8], [38, 60, 0.3], [-52, 86, 0.6], [58, 92, 0.2], [8, 110, 0.9], [-14, 128, 0.5], [70, 130, 0.75], [-80, 120, 0.15]];
  spots.forEach(([x, z, s], i) => {
    const y = makeYurt(T, ymats, s); y.position.set(x, terrainH(x, z) - 0.05, z); const k = i > 3 ? 1.0 : 0.95; y.scale.setScalar(k);
    group.add(y); yurts.push(y); smokeSrc.push([x, terrainH(x, z) + 2.9 * k, z]);
  });
  // a few haystacks / felt bundles and a sledge beside the nearest yurts
  const hay = new T.MeshStandardMaterial({ color: 0xc9a96a, roughness: 1 });
  for (const [x, z] of [[-22, 34], [27, 40], [-30, 49], [-48, 83]]) {
    const m = new T.Mesh(new T.SphereGeometry(1.1, 12, 8), hay); m.scale.set(1.3, 0.8, 1.0); m.position.set(x, terrainH(x, z) + 0.45, z); m.castShadow = true; group.add(m);
  }
  W.parts.yurts = yurts;

  // ---- dry steppe grass tufts: crossed cards with wind sway
  const tuftT = new T.CanvasTexture(tuftCanvas(4, 128, 128)); tuftT.colorSpace = T.SRGBColorSpace; tuftT.anisotropy = 4;
  const tg2 = new T.PlaneGeometry(0.5, 0.36, 1, 3); tg2.translate(0, 0.18, 0);
  const tg3 = tg2.clone(); tg3.rotateY(Math.PI / 2);
  const merged = new T.BufferGeometry();
  { const a = tg2.attributes, b = tg3.attributes, n = a.position.count;
    const pos = new Float32Array(n * 6), nor = new Float32Array(n * 6), uv = new Float32Array(n * 4);
    pos.set(a.position.array, 0); pos.set(b.position.array, n * 3); nor.set(a.normal.array, 0); nor.set(b.normal.array, n * 3); uv.set(a.uv.array, 0); uv.set(b.uv.array, n * 2);
    merged.setAttribute('position', new T.BufferAttribute(pos, 3)); merged.setAttribute('normal', new T.BufferAttribute(nor, 3)); merged.setAttribute('uv', new T.BufferAttribute(uv, 2));
    const ia = tg2.index.array, ib = tg3.index.array, idx = new Uint16Array(ia.length * 2);
    idx.set(ia, 0); for (let i = 0; i < ib.length; i++) idx[ia.length + i] = ib[i] + n;
    merged.setIndex(new T.BufferAttribute(idx, 1)); }
  const timeU = { value: 0 }, windU = { value: new T.Vector2(0.4, 0) };
  const tuftMat = new T.MeshStandardMaterial({ map: tuftT, alphaTest: 0.35, side: T.DoubleSide, roughness: 1, color: 0xffffff });
  tuftMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU; sh.uniforms.uWind = windU;
    sh.vertexShader = 'uniform float uTime; uniform vec2 uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      vec3 transformed = vec3(position);
      float hgt = clamp(position.y / 0.36, 0.0, 1.0);
      vec4 wp0 = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float ph = wp0.x * 0.7 + wp0.z * 0.45;
      float sway = (sin(uTime * 2.1 + ph) * 0.5 + sin(uTime * 3.7 + ph * 1.7) * 0.25) * (0.12 + length(uWind) * 0.22) * hgt * hgt;
      transformed.x += sway + uWind.x * 0.1 * hgt * hgt;
      transformed.z += sway * 0.4 + uWind.y * 0.1 * hgt * hgt;`);
  };
  const tufts = new T.InstancedMesh(merged, tuftMat, q.tufts);
  { const o = new T.Object3D(), r = rngOf(77), c = new T.Color();
    let n = 0, guard = 0;
    while (n < q.tufts && guard++ < q.tufts * 40) {
      const dz = Math.pow(r(), 1.5) * 190 - 8, dx = (r() - 0.5) * (46 + dz * 0.95), pm = patchAt(dx, dz);
      if (r() > 0.08 + pm * 1.1) continue;                    // clustered in the scoured patches, a few strays on the snow
      o.position.set(dx, terrainH(dx, dz) - 0.03, dz);
      o.rotation.set(0, r() * 6.28, 0); const s = 0.6 + r() * 1.0; o.scale.set(s, s * (0.7 + r() * 0.6), s);
      o.updateMatrix(); tufts.setMatrixAt(n, o.matrix);
      c.setHSL(0.12 + r() * 0.03, 0.12 + r() * 0.12, 0.88 + r() * 0.12); tufts.setColorAt(n, c); n++;
    }
    tufts.count = n;
    tufts.instanceMatrix.needsUpdate = true; if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true; }
  tufts.frustumCulled = false; tufts.receiveShadow = false; group.add(tufts);

  // ---- particles: falling flakes around the camera, ground spindrift, yurt smoke
  const dotCanvas = cv(64); { const g = dotCanvas.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
  const dotT = new T.CanvasTexture(dotCanvas);
  const mkPoints = (n, size, opacity, color = 0xffffff) => {
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3));
    const p = new T.Points(geo, new T.PointsMaterial({ map: dotT, size, sizeAttenuation: true, transparent: true, opacity, depthWrite: false, color, fog: true }));
    p.frustumCulled = false; group.add(p); return p;
  };
  const flakes = mkPoints(q.flakes, 0.16, 0.85);
  const drift = mkPoints(q.drift, 0.28, 0.5, 0xfff4e4);
  const smoke = mkPoints(spots.length * 7, 1.6, 0.34, 0xe9e4dc);
  const fr = rngOf(5);
  const fl = []; for (let i = 0; i < q.flakes; i++) fl.push({ x: (fr() - 0.5) * 70, y: fr() * 24, z: (fr() - 0.2) * 90, v: 0.5 + fr(), ph: fr() * 6.28 });
  const dr = []; for (let i = 0; i < q.drift; i++) dr.push({ x: (fr() - 0.5) * 80, z: (fr() - 0.1) * 120, y: fr() * 0.7, v: 0.6 + fr() * 0.8, ph: fr() * 6.28 });

  // ---- the den (hole, earth mound, scattered earth and tracks)
  const den = new T.Group();
  const mound = new T.Mesh(new T.SphereGeometry(1.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: 0xe9eef7, roughness: 1 })); mound.scale.set(1.3, 0.34, 1.0); mound.castShadow = true; mound.receiveShadow = true; den.add(mound);
  const earth = new T.Mesh(new T.CircleGeometry(1.25, 24), new T.MeshStandardMaterial({ color: 0x6a5342, roughness: 1 })); earth.rotation.x = -Math.PI / 2; earth.position.set(0.15, 0.02, 0.8); earth.scale.set(1.3, 1, 0.9); den.add(earth);
  const hole = new T.Mesh(new T.CircleGeometry(0.46, 20), new T.MeshBasicMaterial({ color: 0x07090d })); hole.rotation.x = -Math.PI / 2; hole.position.set(0.15, 0.06, 0.8); hole.scale.set(1.2, 1, 0.8); den.add(hole);
  group.add(den); W.parts.den = den;

  // ---- soft cloud puff sprites for the strike (snow burst) and a short ring marker pool
  const puffC = cv(128); { const g = puffC.getContext('2d'); for (let i = 0; i < 9; i++) { const x = 64 + (hash2(i, 1) - 0.5) * 50, y = 64 + (hash2(i, 2) - 0.5) * 40, r = 20 + hash2(i, 3) * 22, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); } }
  const puffT = new T.CanvasTexture(puffC);
  const puffs = [];
  for (let i = 0; i < 26; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: puffT, transparent: true, depthWrite: false, opacity: 0, color: 0xffffff })); s.visible = false; group.add(s); puffs.push({ s, t: 9, life: 1, vx: 0, vy: 0, vz: 0, size: 1 }); }
  W.puff = (x, y, z, n = 14, power = 1) => {
    let k = 0;
    for (const p of puffs) {
      if (p.t < p.life || k >= n) continue;
      const a = hash2(k, x) * 6.283, sp = (1.2 + hash2(k, z) * 2.4) * power;
      p.t = 0; p.life = 0.8 + hash2(k, 7) * 0.8; p.size = 0.7 + hash2(k, 3) * 1.1;
      p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp; p.vy = 0.8 + hash2(k, 9) * 2.2 * power;
      p.s.position.set(x, y, z); p.s.visible = true; k++;
    }
  };

  // ---- per-frame
  W.setLook = (idx) => {
    const L = LOOKS[clamp(idx | 0, 0, LOOKS.length - 1)];
    W.look = L;
    const u = skyMat.uniforms;
    u.uZen.value.set(L.zen); u.uMid.value.set(L.mid); u.uHor.value.set(L.hor); u.uGround.value.set(L.ground); u.uSunCol.value.set(L.sun); u.uCloud.value = L.cloud;
    return L;
  };
  W.setLook(1);
  const tmpC = new T.Vector3();
  W.update = (dt, camera, wind) => {
    W.time += dt; timeU.value = W.time;
    W.wind.x = wind.x; W.wind.z = wind.z;
    // wind in world axes: sim +x is -X
    const wx = -wind.x * C, wz = wind.z * C;
    windU.value.set(wx * 0.12, wz * 0.12);
    skyMat.uniforms.uTime.value = W.time; skyMat.uniforms.uWind.value.set(wx * 0.4 + 0.5, wz * 0.4);
    sky.position.copy(camera.position);
    const cx = camera.position.x, cz = camera.position.z;
    // flakes: a box around the camera that wraps
    {
      const p = flakes.geometry.attributes.position.array, sp = W.look.snow;
      flakes.material.opacity = clamp(0.35 + sp * 0.4, 0.2, 0.95);
      const n = Math.min(fl.length, Math.round(fl.length * clamp(sp / 1.0 + 0.2, 0.2, 1)));
      for (let i = 0; i < fl.length; i++) {
        const f = fl[i];
        f.y -= dt * (0.9 + 1.2 * f.v);
        f.x += dt * (wx * 0.8 + Math.sin(W.time * 0.7 + f.ph) * 0.25); f.z += dt * (wz * 0.8);
        if (f.y < 0) { f.y += 24; }
        if (f.x - (cx % 70) > 35) f.x -= 70; if (f.x - (cx % 70) < -35) f.x += 70;
        if (f.z - cz > 70) f.z -= 90; if (f.z - cz < -20) f.z += 90;
        const vis = i < n;
        p[i * 3] = vis ? f.x : 0; p[i * 3 + 1] = vis ? f.y : -50; p[i * 3 + 2] = f.z;
      }
      flakes.geometry.attributes.position.needsUpdate = true;
    }
    {
      const p = drift.geometry.attributes.position.array, sp = Math.hypot(wx, wz);
      drift.material.opacity = clamp(0.15 + sp * 0.12 + W.look.snow * 0.1, 0.1, 0.8);
      for (let i = 0; i < dr.length; i++) {
        const d = dr[i];
        d.x += dt * (wx * (1.4 + d.v) + 0.4); d.z += dt * (wz * (1.4 + d.v));
        if (d.x > 40) d.x -= 80; if (d.x < -40) d.x += 80; if (d.z > 130) d.z -= 120; if (d.z < -10) d.z += 120;
        const gx = d.x, gz = d.z, h = terrainH(gx, gz) + 0.06 + 0.25 * d.y * (0.5 + 0.5 * Math.sin(W.time * 2 + d.ph));
        p[i * 3] = gx; p[i * 3 + 1] = h; p[i * 3 + 2] = gz;
      }
      drift.geometry.attributes.position.needsUpdate = true;
    }
    {
      const p = smoke.geometry.attributes.position.array;
      let k = 0;
      smokeSrc.forEach((s, yi) => {
        for (let i = 0; i < 7; i++) {
          const u = ((W.time * 0.11 + i / 7 + yi * 0.173) % 1);
          p[k++] = s[0] + (wx * 3 + 0.6) * u * 5 + Math.sin(u * 7 + yi) * 0.25 * u;
          p[k++] = s[1] + u * 7.5;
          p[k++] = s[2] + wz * u * 6 + Math.cos(u * 5 + i) * 0.2 * u;
        }
      });
      smoke.geometry.attributes.position.needsUpdate = true;
      smoke.material.size = 1.4;
    }
    for (const p of puffs) {
      if (p.t >= p.life) { p.s.visible = false; continue; }
      p.t += dt; const k = clamp(p.t / p.life, 0, 1);
      p.s.position.x += p.vx * dt * (1 - k); p.s.position.z += p.vz * dt * (1 - k); p.s.position.y += p.vy * dt * (1 - k * 0.8);
      p.s.scale.setScalar(p.size * (0.5 + 1.4 * Math.sqrt(k)));
      p.s.material.opacity = 0.9 * (1 - k) * (1 - k);
    }
    void tmpC;
  };
  W.fog = (scene) => { scene.fog = new T.FogExp2(W.look.fog, W.look.fogD); };
  return W;
}

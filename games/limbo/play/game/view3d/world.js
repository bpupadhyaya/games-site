// The beach at dusk, as real 3D: sky dome with the setting sun, glittering sea, rippled sand, sculpted palms, tiki torches, string lights,
// steel pans. Pure scene building; the presenter animates what has `update` / userData hooks. Units are metres, +y up, the dancer walks along +x,
// the camera looks from +z towards -z, the sea is at -z.
import * as THREE from '../vendor3d/three.js';
import { glowTexture, flameTexture, sandTextures, frondTexture, barkTexture, bambooTexture, rngOf, hash, clamp } from './fx.js';

export const SHORE_Z = -9.5;     // the waterline
export const SUN_DIR = new THREE.Vector3(0.28, 0.055, -1).normalize();

// ------------------------------------------------------------------------------------------------ sky
export function buildSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: SUN_DIR.clone() }, uTime: { value: 0 }, uDim: { value: 1 } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      varying vec3 vD; uniform vec3 uSun; uniform float uTime; uniform float uDim;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec3 d = normalize(vD);
        float y = clamp(d.y, -0.05, 1.0);
        vec3 zen = vec3(0.03, 0.02, 0.12);
        vec3 mid = vec3(0.30, 0.10, 0.36);
        vec3 rose = vec3(0.82, 0.24, 0.40);
        vec3 org = vec3(1.0, 0.46, 0.22);
        vec3 gold = vec3(1.0, 0.78, 0.40);
        float t = pow(y, 0.55);
        vec3 c = mix(gold, org, smoothstep(0.0, 0.05, y));
        c = mix(c, rose, smoothstep(0.03, 0.12, y));
        c = mix(c, mid, smoothstep(0.09, 0.24, y));
        c = mix(c, zen, smoothstep(0.2, 0.5, y));
        float sd = max(dot(d, normalize(uSun)), 0.0);
        c += vec3(1.0, 0.55, 0.22) * pow(sd, 14.0) * 0.5 + vec3(1.0, 0.8, 0.5) * pow(sd, 90.0) * 0.9;
        float disc = smoothstep(0.9988, 0.9994, sd);
        c = mix(c, vec3(1.0, 0.93, 0.72), disc);
        // thin clouds lit from below
        vec2 uv = d.xz / max(0.12, d.y + 0.18) * 1.1 + vec2(uTime * 0.004, 0.0);
        float cl = n2(uv * vec2(1.6, 4.2)) * 0.6 + n2(uv * vec2(3.7, 9.0)) * 0.4;
        float band = smoothstep(0.02, 0.07, y) * (1.0 - smoothstep(0.14, 0.34, y));
        float cm = smoothstep(0.52, 0.78, cl) * band;
        c = mix(c, mix(rose * 1.15, org * 1.1, smoothstep(0.0, 0.2, y + sd * 0.2)), cm * 0.65);
        c *= 1.0 - cm * 0.12 * smoothstep(0.0, 0.3, y);
        // stars high up
        float st = step(0.9965, h21(floor(d.xz / max(0.2, d.y) * 140.0))) * smoothstep(0.42, 0.8, y);
        c += vec3(1.0, 0.95, 0.85) * st * (0.6 + 0.4 * sin(uTime * 2.0 + d.x * 90.0));
        gl_FragColor = vec4(c * uDim, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(300, 40, 20), mat);
  m.renderOrder = -20; m.frustumCulled = false;
  return m;
}

// ------------------------------------------------------------------------------------------------ sea
export function buildSea() {
  const mat = new THREE.ShaderMaterial({
    transparent: false, fog: false,
    uniforms: { uSun: { value: SUN_DIR.clone() }, uTime: { value: 0 }, uShore: { value: SHORE_Z }, uDim: { value: 1 } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `
      varying vec3 vW; uniform vec3 uSun; uniform float uTime; uniform float uShore; uniform float uDim;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec3 V = normalize(vW - cameraPosition);
        float dist = length(vW.xz - cameraPosition.xz);
        vec2 p = vW.xz * vec2(0.55, 1.4);
        float w = n2(p * 0.9 + vec2(uTime * 0.07, uTime * 0.12)) + n2(p * 2.1 - vec2(uTime * 0.11, uTime * 0.05)) * 0.5 + n2(p * 5.3 + vec2(uTime * 0.2)) * 0.25;
        vec3 N = normalize(vec3((w - 0.88) * 0.34 * (1.0 / (1.0 + dist * 0.015)), 1.0, (n2(p * 1.7 + 7.0 + uTime * 0.09) - 0.5) * 0.28 / (1.0 + dist * 0.012)));
        vec3 R = reflect(V, N);
        vec3 S = normalize(uSun);
        float spec = pow(max(dot(R, S), 0.0), 220.0) * 4.0 + pow(max(dot(R, S), 0.0), 26.0) * 0.55;
        float fres = pow(1.0 - clamp(dot(-V, N), 0.0, 1.0), 3.0);
        vec3 deep = vec3(0.045, 0.085, 0.20);
        vec3 shallow = vec3(0.20, 0.30, 0.42);
        vec3 refl = mix(vec3(0.74, 0.30, 0.38), vec3(1.0, 0.62, 0.30), smoothstep(0.0, 0.5, dot(R, S) * 0.5 + 0.5));
        float k = clamp(dist / 90.0, 0.0, 1.0);
        vec3 c = mix(shallow, deep, smoothstep(0.0, 0.5, (uShore - vW.z) * -0.1 + 0.2 + k));
        c = mix(c, refl, clamp(0.28 + fres * 0.9 + k * 0.35, 0.0, 0.95));
        c += vec3(1.0, 0.72, 0.38) * spec * (0.55 + 0.45 * n2(p * 11.0 + uTime * 0.6));
        // foam line at the shore, washing in and out
        float sh = uShore + sin(uTime * 0.55) * 0.35 + n2(vec2(vW.x * 0.6, uTime * 0.2)) * 0.6;
        float foam = smoothstep(0.7, 0.0, abs(vW.z - sh) * 1.0) * step(vW.z, sh + 0.05);
        foam *= 0.55 + 0.45 * n2(vec2(vW.x * 2.2, vW.z * 3.0 + uTime));
        c = mix(c, vec3(1.0, 0.93, 0.88), clamp(foam, 0.0, 0.85));
        // horizon haze
        c = mix(c, vec3(1.0, 0.62, 0.34), smoothstep(80.0, 260.0, dist) * 0.65);
        gl_FragColor = vec4(c * uDim, 1.0);
      }`,
  });
  const g = new THREE.PlaneGeometry(700, 360); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(0, -0.12, SHORE_Z - 170 + 4); m.renderOrder = -15; m.frustumCulled = false;
  return m;
}

// ------------------------------------------------------------------------------------------------ sand
export function buildSand(maxAniso = 8) {
  const { map, bump } = sandTextures();
  map.anisotropy = bump.anisotropy = maxAniso;
  const mat = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.2, roughness: 1, metalness: 0, color: 0xffe6c4 });
  const geo = new THREE.PlaneGeometry(60, 34, 1, 1); geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(0, 0, SHORE_Z + 17 - 0.4); m.receiveShadow = true; m.renderOrder = -10;
  // wet sand: a darker, glossier band along the waterline fading into the dry sand
  const c = globalThis.document.createElement('canvas'); c.width = 4; c.height = 128;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(70,40,48,0.88)'); gr.addColorStop(0.55, 'rgba(110,64,56,0.5)'); gr.addColorStop(1, 'rgba(120,70,50,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
  const wt = new THREE.CanvasTexture(c);
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(60, 5.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: wt, transparent: true, depthWrite: false }));
  wet.position.set(0, 0.01, SHORE_Z + 2.4); wet.renderOrder = -9;
  const grp = new THREE.Group(); grp.add(m, wet);
  return grp;
}

// ------------------------------------------------------------------------------------------------ palms
let FROND_TEX = null, BARK_TEX = null;
export function buildPalm({ height = 6, lean = 0.5, seed = 1, frondLen = 2.3, fronds = 11 } = {}) {
  const R = rngOf(seed * 97 + 3);
  FROND_TEX ||= frondTexture(); BARK_TEX ||= barkTexture();
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * 0.25 * height * 0.35, height * 0.5, 0.15), new THREE.Vector3(lean * height * 0.28, height, 0)]);
  const SEG = 14, RAD = 10;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG, p = curve.getPoint(t), tan = curve.getTangent(t);
    const side = new THREE.Vector3(0, 0, 1), up = new THREE.Vector3().crossVectors(tan, side).normalize();
    const r = (0.2 - 0.09 * t) * (1 + 0.1 * Math.sin(t * 60) * (1 - t * 0.5)) * (i === 0 ? 1.6 : 1);
    for (let j = 0; j <= RAD; j++) {
      const a = (j / RAD) * Math.PI * 2;
      const o = side.clone().multiplyScalar(Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r);
      pos.push(p.x + o.x, p.y + o.y, p.z + o.z); uv.push(j / RAD, t * 3.2);
    }
  }
  for (let i = 0; i < SEG; i++) for (let j = 0; j < RAD; j++) { const a = i * (RAD + 1) + j, b = a + RAD + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); tg.setIndex(idx); tg.computeVertexNormals();
  BARK_TEX.wrapS = BARK_TEX.wrapT = THREE.RepeatWrapping;
  const trunk = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ map: BARK_TEX, roughness: 0.95, color: 0xd8c4a8 }));
  g.add(trunk);
  // crown
  const top = curve.getPoint(1);
  const fpos = [], fuv = [], fidx = [], fsway = [], fcol = [];
  const SEGF = 8;
  for (let f = 0; f < fronds; f++) {
    const ang = (f / fronds) * Math.PI * 2 + R() * 0.4, len = frondLen * (0.82 + R() * 0.36);
    const up0 = 0.5 + R() * 0.45, droop = 1.0 + R() * 0.7, wid = 0.42 * (len / frondLen);
    const base = fpos.length / 3;
    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    for (let i = 0; i <= SEGF; i++) {
      const t = i / SEGF;
      const out = len * t, h = up0 * len * Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.5 - droop * len * t * t * 0.55;
      const c = new THREE.Vector3(top.x + dir.x * out, top.y + 0.1 + h, top.z + dir.z * out);
      const sd = new THREE.Vector3(-dir.z, 0, dir.x);
      const w = wid * Math.sin(Math.PI * (0.1 + 0.8 * t)) * 0.9 + 0.03;
      const tilt = 0.5;                                        // fronds are V-shaped in section
      for (const s of [-1, 1]) {
        fpos.push(c.x + sd.x * w * s, c.y + Math.abs(w) * tilt * 0.35, c.z + sd.z * w * s);
        fuv.push(0.5 + 0.5 * s, 1 - t); fsway.push(t); fcol.push(1, 1, 1);
      }
    }
    for (let i = 0; i < SEGF; i++) { const a = base + i * 2; fidx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2));
  fg.setAttribute('aSway', new THREE.Float32BufferAttribute(fsway, 1)); fg.setIndex(fidx); fg.computeVertexNormals();
  const uTime = { value: 0 }, uWind = { value: 0.5 };
  const fm = new THREE.MeshStandardMaterial({ map: FROND_TEX, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, color: 0xd9ffc0, emissive: 0x0a1405 });
  fm.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime; sh.uniforms.uWind = uWind; sh.uniforms.uPh = { value: seed * 1.7 };
    sh.vertexShader = `attribute float aSway; uniform float uTime; uniform float uWind; uniform float uPh;\n${sh.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
      float sw = aSway * aSway;
      transformed.y += sin(uTime * 1.7 + position.x * 0.9 + uPh) * 0.09 * sw * (0.4 + uWind);
      transformed.x += sin(uTime * 1.1 + position.z * 0.7 + uPh * 1.3) * 0.07 * sw * (0.4 + uWind);
      transformed.z += cos(uTime * 1.3 + position.x * 0.6 + uPh) * 0.06 * sw * (0.4 + uWind);`);
  };
  fm.customProgramCacheKey = () => 'limbo-frond';
  const crown = new THREE.Mesh(fg, fm); crown.userData.uTime = uTime; crown.userData.uWind = uWind;
  g.add(crown);
  // coconuts
  const cocoGeo = new THREE.SphereGeometry(0.11, 10, 8), cocoMat = new THREE.MeshStandardMaterial({ color: 0x4a3a1c, roughness: 0.8 });
  for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(cocoGeo, cocoMat); const a = i * 1.6 + R(); c.position.set(top.x + Math.cos(a) * 0.17, top.y - 0.12 - (i % 2) * 0.06, top.z + Math.sin(a) * 0.17); g.add(c); }
  g.userData.crown = crown; g.userData.top = top.clone();
  trunk.castShadow = true;
  return g;
}

// ------------------------------------------------------------------------------------------------ steel pan
// A single-tenor-style pan: barrel with a sunken playing surface of note ovals, on a three-legged stand. Returns { group, top } (top = y of the playing face).
export function buildSteelPan({ radius = 0.29, color = 0xd9d2c4 } = {}) {
  const g = new THREE.Group();
  const prof = [[0.0, 0.0], [radius * 0.82, 0.0], [radius * 0.98, 0.02], [radius, 0.1], [radius, 0.24], [radius * 0.99, 0.255], [radius * 0.9, 0.262], [radius * 0.62, 0.232], [radius * 0.3, 0.215], [0, 0.21]];
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 40), new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.32, side: THREE.DoubleSide }));
  body.castShadow = true; g.add(body);
  // note ovals
  const noteMat = new THREE.MeshStandardMaterial({ color: 0xf0e6d6, metalness: 0.9, roughness: 0.22 });
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x3a2a24 });
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3, rr = i < 6 ? radius * 0.68 : radius * 0.4;
    const aa = i < 6 ? a : a * 1.3 + 1.0;
    const ox = Math.cos(aa) * rr, oz = Math.sin(aa) * rr;
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.13, radius * 0.152, 18), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.set(ox, 0.236 + (rr < radius * 0.5 ? -0.01 : 0), oz); ring.scale.set(1, 1.35, 1); ring.rotation.z = aa; g.add(ring);
    const note = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.128, 16), noteMat); note.rotation.x = -Math.PI / 2; note.position.set(ox, 0.237 + (rr < radius * 0.5 ? -0.01 : 0), oz); note.scale.set(1, 1.35, 1); note.rotation.z = aa; g.add(note);
  }
  // stand
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.6, roughness: 0.5 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.8, 6), legMat);
    leg.position.set(Math.cos(a) * radius * 0.7, -0.38 + 0.0, Math.sin(a) * radius * 0.7); leg.rotation.set(Math.sin(a) * 0.17, 0, -Math.cos(a) * 0.17);
    leg.position.y = -0.4; g.add(leg);
  }
  g.userData.faceY = 0.24; g.userData.radius = radius;
  return g;
}

// ------------------------------------------------------------------------------------------------ tiki torch
// A bamboo pole with a flame. Returns { group, flame: Sprite, flame2: Sprite, halo: Sprite, tip: Vector3 } for the presenter to flicker.
export function buildTorch({ height = 1.75, seed = 1, flameTex, glowTex, light = false } = {}) {
  const g = new THREE.Group();
  const bam = bambooTexture(5);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, height, 10), new THREE.MeshStandardMaterial({ map: bam, roughness: 0.6 }));
  pole.position.y = height / 2 - 0.12; pole.castShadow = true; g.add(pole);
  // a tin cup with a wick wrapped in cloth
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.045, 0.11, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a2e28, metalness: 0.7, roughness: 0.5, side: THREE.DoubleSide }));
  cup.position.y = height - 0.12 + 0.02; g.add(cup);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.07, 10), new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 1 }));
  wick.position.y = height - 0.12 + 0.07; g.add(wick);
  const tipY = height - 0.12 + 0.12;
  const mk = (map, color, sx, sy, add = true) => {
    const m = new THREE.SpriteMaterial({ map, color, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false });
    const s = new THREE.Sprite(m); s.scale.set(sx, sy, 1); return s;
  };
  const flame = mk(flameTex, 0xffffff, 0.26, 0.5); flame.center.set(0.5, 0.1); flame.position.y = tipY; g.add(flame);
  const flame2 = mk(flameTex, 0xffb060, 0.2, 0.38); flame2.center.set(0.5, 0.1); flame2.position.y = tipY; g.add(flame2);
  const halo = mk(glowTex, 0xff9a40, 1.7, 1.7); halo.position.y = tipY + 0.2; halo.material.opacity = 0.55; g.add(halo);
  let pl = null;
  if (light) { pl = new THREE.PointLight(0xff9a48, 5.5, 8, 1.6); pl.position.y = tipY + 0.2; g.add(pl); }
  return { group: g, flame, flame2, halo, light: pl, tipY, seed, base: pl ? pl.intensity : 0 };
}

// ------------------------------------------------------------------------------------------------ string lights
export function buildStringLights(points, { sag = 0.35, bulbs = 14, glowTex } = {}) {
  const g = new THREE.Group();
  const colors = [0xffd873, 0xff6a4d, 0x4de0d0, 0xff8fc2, 0xfff2c2, 0x9b8cff];
  const geo = new THREE.SphereGeometry(0.045, 8, 6);
  const n = (points.length - 1) * bulbs;
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
  const halos = [];
  const m4 = new THREE.Matrix4(), c = new THREE.Color();
  let k = 0;
  const wire = [];
  for (let s = 0; s < points.length - 1; s++) {
    const a = points[s], b = points[s + 1];
    for (let i = 0; i <= bulbs; i++) {
      const t = i / bulbs, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * sag;
      wire.push(new THREE.Vector3(x, y, z));
      if (i < bulbs && k < n) {
        m4.makeTranslation(x, y - 0.04, z); inst.setMatrixAt(k, m4);
        c.setHex(colors[(k * 5 + s) % colors.length]); inst.setColorAt(k, c);
        halos.push({ x, y: y - 0.04, z, col: colors[(k * 5 + s) % colors.length] });
        k++;
      }
    }
  }
  inst.count = k; inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  g.add(inst);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(wire), new THREE.LineBasicMaterial({ color: 0x15101c }));
  g.add(line);
  // soft glow for each bulb in one Points object
  if (glowTex) {
    const pos = new Float32Array(halos.length * 3), col = new Float32Array(halos.length * 3);
    halos.forEach((h, i) => { pos.set([h.x, h.y, h.z], i * 3); c.setHex(h.col); col.set([c.r, c.g, c.b], i * 3); });
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ map: glowTex, size: 0.55, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8, fog: false }));
    pts.renderOrder = 22; g.add(pts);
  }
  return g;
}

export { glowTexture, flameTexture, hash, clamp };

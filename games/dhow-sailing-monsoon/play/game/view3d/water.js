// Real 3D water: a patch that follows the camera, Gerstner waves in the vertex shader (wind driven), fresnel reflection of the live sky,
// sun glitter, crest foam, a drawn wake texture and distance fog to the horizon.
import { SKY_GLSL } from './sky.js';
import { clamp, lerp, DEG, canvasTex } from './util3.js';

const OFFS = [0, 24, -31, 58], SHARE = [0.5, 0.28, 0.14, 0.08], LEN = [34, 17, 8.8, 4.3];

export function createWater(THREE, scene, quality, skyUniforms) {
  const half = 900, seg = quality === 'low' ? 96 : quality === 'medium' ? 128 : 160;
  const geo = new THREE.PlaneGeometry(half * 2, half * 2, seg, seg); geo.rotateX(-Math.PI / 2);
  const wakeCanvas = globalThis.document.createElement('canvas'); wakeCanvas.width = wakeCanvas.height = 256;
  const wakeTex = new THREE.CanvasTexture(wakeCanvas); wakeTex.flipY = false; wakeTex.minFilter = THREE.LinearFilter; wakeTex.magFilter = THREE.LinearFilter; wakeTex.generateMipmaps = false;
  const U = {
    uTime: { value: 0 }, uAmp: { value: 0.6 }, uLen: { value: 1 }, uDir: { value: new THREE.Vector3(0, 0, -1) }, uFoamT: { value: 0.8 }, uHalf: { value: half },
    uDeep: { value: new THREE.Color('#06344a') }, uShallow: { value: new THREE.Color('#1f8f9a') }, uLight: { value: 1 }, uFogNear: { value: 160 }, uFogFar: { value: 1700 }, uFogCol: { value: new THREE.Color('#9fd0f0') },
    uWake: { value: wakeTex }, uWakeO: { value: new THREE.Vector3() }, uWakeS: { value: 160 }, uChop: { value: 0.5 },
    uShoal: { value: new THREE.Vector4(0, 0, 0, 0) },
  };
  Object.assign(U, skyUniforms);
  const mat = new THREE.MeshBasicMaterial({ fog: false });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
uniform float uTime; uniform float uAmp; uniform float uLen; uniform vec3 uDir; uniform float uHalf; uniform float uChop;
varying vec3 vWP; varying vec3 vN; varying float vCrest;
const vec4 W0 = vec4(${[0, 1, 2, 3].map((i) => `${(SHARE[i]).toFixed(3)}`).join(', ')});
void gw(vec2 p, float ang, float len, float share, inout vec3 disp, inout vec3 n, inout float crest){
  float c0 = cos(ang), s0 = sin(ang); vec2 d = vec2(uDir.x*c0 - uDir.z*s0, uDir.x*s0 + uDir.z*c0);
  float k = 6.2831853/(len*uLen), a = uAmp*share, w = sqrt(9.8*k), ph = k*dot(d,p) - w*uTime;
  float s = sin(ph), c = cos(ph), q = uChop;
  disp += vec3(q*a*d.x*c, a*s, q*a*d.y*c);
  n.x -= d.x*k*a*c; n.z -= d.y*k*a*c; n.y -= q*k*a*s;
  crest += s*share;
}`).replace('#include <begin_vertex>', `
vec2 q0 = position.xz / uHalf; vec2 pw = q0*uHalf*(0.22 + 0.78*abs(q0));
vec3 wpos = (modelMatrix * vec4(pw.x, 0.0, pw.y, 1.0)).xyz;
vec3 disp = vec3(0.0); vec3 nn = vec3(0.0, 1.0, 0.0); float crest = 0.0;
${OFFS.map((o, i) => `gw(wpos.xz, ${(o * DEG).toFixed(4)}, ${LEN[i].toFixed(2)}, ${SHARE[i].toFixed(3)}, disp, nn, crest);`).join('\n')}
vec3 transformed = vec3(pw.x + disp.x, disp.y, pw.y + disp.z);
vWP = wpos + disp; vN = normalize(nn); vCrest = crest;
`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; uniform float uLight; uniform float uFogNear; uniform float uFogFar; uniform vec3 uFogCol;
uniform sampler2D uWake; uniform vec3 uWakeO; uniform float uWakeS; uniform float uFoamT; uniform vec4 uShoal;
varying vec3 vWP; varying vec3 vN; varying float vCrest;
${SKY_GLSL}
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
`).replace('#include <opaque_fragment>', `
vec2 wp = vWP.xz;
vec3 N = normalize(vN + vec3((vn(wp*0.9 + uTime*0.35) - 0.5)*0.22, 0.0, (vn(wp*1.1 - uTime*0.3 + 17.0) - 0.5)*0.22));
vec3 V = normalize(cameraPosition - vWP);
float ndv = max(dot(N, V), 0.0);
float fres = 0.025 + 0.975*pow(1.0 - ndv, 5.0);
vec3 R = reflect(-V, N); R.y = abs(R.y);
vec3 refl = skyColor(R);
float sss = pow(max(dot(normalize(vec3(uSunDir.x, 0.15, uSunDir.z)), -V), 0.0), 3.0) * clamp(vCrest*1.6 + 0.35, 0.0, 1.0);
vec3 base = mix(uDeep, uShallow, clamp(0.28 + 0.5*vCrest + 0.5*ndv*0.3, 0.0, 1.0)) * uLight + uShallow * sss * 0.55 * uLight;
// shoal water over a reef: pale turquoise
float sh = 0.0;
vec3 col = mix(base, refl, clamp(fres*1.05, 0.0, 1.0));
float glit = pow(max(dot(R, uSunDir), 0.0), 600.0) * 7.0 + pow(max(dot(R, uSunDir), 0.0), 60.0) * 0.5;
col += uSunCol * glit * (1.0 - uStorm*0.85);
float foam = smoothstep(uFoamT, uFoamT + 0.16, vCrest) * (0.55 + 0.45*vn(wp*2.3 + uTime*0.4));
vec2 wuv = (wp - uWakeO.xz) / uWakeS + 0.5;
float wk = 0.0;
if (wuv.x > 0.0 && wuv.x < 1.0 && wuv.y > 0.0 && wuv.y < 1.0) wk = texture2D(uWake, wuv).a * (0.6 + 0.4*vn(wp*3.1 + uTime*0.6));
vec3 foamCol = mix(vec3(0.82, 0.9, 0.95), uHorizon, 0.25) * (0.4 + 0.6*uLight);
col = mix(col, foamCol, clamp(foam*0.8 + wk*0.9, 0.0, 1.0));
float dist = length(cameraPosition - vWP);
float fogK = smoothstep(uFogNear, uFogFar, dist);
col = mix(col, uFogCol, fogK);
gl_FragColor = vec4(col, 1.0);
`);
  };
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = -1;
  scene.add(mesh);

  const dirV = new THREE.Vector3();
  const wake = [];
  const g = wakeCanvas.getContext('2d');
  let wakeClock = 0, wakeDraw = 0, spawn = 0;
  const api = {
    mesh, uniforms: U,
    // waves travel toward (windFrom + 180); `wind` in m/s
    setSea({ windFrom, wind, storm = 0, light = 1, deep, shallow, fog, fogFar }) {
      const toward = (windFrom + 180) * DEG;
      dirV.set(Math.sin(toward), 0, -Math.cos(toward));
      U.uDir.value.copy(dirV);
      const target = clamp(0.1 + 0.07 * wind + storm * 0.25, 0.1, 1.5);
      U.uAmp.value += (target - U.uAmp.value) * 0.04;
      U.uLen.value = 0.8 + 0.035 * wind; U.uFoamT.value = clamp(1.02 - 0.025 * wind - storm * 0.12, 0.62, 0.98); U.uChop.value = 0.35 + 0.35 * clamp(wind / 14, 0, 1);
      U.uLight.value = light;
      if (deep) U.uDeep.value.copy(deep); if (shallow) U.uShallow.value.copy(shallow); if (fog) U.uFogCol.value.copy(fog); if (fogFar) U.uFogFar.value = fogFar;
    },
    // height of the sea at a world point (vertical only; the shader's horizontal chop is ignored)
    height(x, z, t) {
      let h = 0;
      const A = U.uAmp.value, L = U.uLen.value;
      for (let i = 0; i < 4; i++) {
        const a = OFFS[i] * DEG, c0 = Math.cos(a), s0 = Math.sin(a), dx = dirV.x * c0 - dirV.z * s0, dz = dirV.x * s0 + dirV.z * c0;
        const k = Math.PI * 2 / (LEN[i] * L), w = Math.sqrt(9.8 * k);
        h += A * SHARE[i] * Math.sin(k * (dx * x + dz * z) - w * t);
      }
      return h;
    },
    update(dt, t, camPos, ship) {
      U.uTime.value = t;
      mesh.position.set(Math.round(camPos.x / 4) * 4, 0, Math.round(camPos.z / 4) * 4);
      // wake: drop foam points behind the hull (the ship object reports world position, heading, speed)
      wakeClock += dt; spawn += dt;
      for (const w of wake) w.age += dt;
      while (wake.length && wake[0].age > 6) wake.shift();
      if (ship && ship.speed > 0.4 && spawn > 0.1) {
        spawn = 0;
        const fx = Math.sin(ship.heading * DEG), fz = -Math.cos(ship.heading * DEG), rx = fz * -1, rz = fx;
        wake.push({ x: ship.x - fx * 6.8, z: ship.z - fz * 6.8, age: 0, s: clamp(ship.speed / 8, 0.15, 0.7), r: 0.9 });
        for (const sgn of [-1, 1]) wake.push({ x: ship.x + fx * 5.2 + rx * sgn * 1.2, z: ship.z + fz * 5.2 + rz * sgn * 1.2, age: 0, s: clamp(ship.speed / 10, 0.1, 0.6), r: 0.7 });
      }
      wakeDraw += dt;
      if (wakeDraw > 0.04 && ship) {
        wakeDraw = 0;
        const ox = Math.round(ship.x), oz = Math.round(ship.z), S = U.uWakeS.value, px = 256 / S;
        U.uWakeO.value.set(ox, 0, oz);
        g.clearRect(0, 0, 256, 256);
        for (const w of wake) {
          const x = (w.x - ox + S / 2) * px, y = (w.z - oz + S / 2) * px, r = (w.r + w.age * 0.38) * px, a = clamp((1 - w.age / 6) * w.s, 0, 1);
          if (x < -r || y < -r || x > 256 + r || y > 256 + r) continue;
          const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        wakeTex.needsUpdate = true;
      }
    },
  };
  void lerp; void canvasTex;
  return api;
}

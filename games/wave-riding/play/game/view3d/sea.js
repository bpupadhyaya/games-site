// The sea in real 3D (presentation only: it reads the same camera/state art.js uses and never writes back).
//
// One WebGL scene in screen pixels (orthographic): the sky + far sea + headland, the wave face as a lit mesh (depth gradient, light through the thin
// top, sky reflection, wind ripples and streaks, a real curling lip with thickness and a tube cavity), the whitewater as a lit foam height field,
// the channel water in front, gulls and a dolphin, and soft spray / lip particles. Everything is placed with the 2D camera maths so the gates,
// the line and the rider stay exactly where the game logic expects them. The result is composited by view.js; the 2D art stays the fallback.
import { THREE } from '../vendor3d/index.js';
import { hollowAt } from '../src/sim.js';
import { foamH, CURL_W } from '../src/art.js';

const { ShaderMaterial, BufferGeometry, BufferAttribute, Mesh, Points, Scene, OrthographicCamera, WebGLRenderer, Color, Vector2, Vector3 } = THREE;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const LIN = THREE.LinearSRGBColorSpace;   // keep display-space values: the shaders write sRGB directly
const rgbOf = (str) => str.split(',').map((n) => +n / 255);

const GLSL_COMMON = `
precision highp float;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return s; }
float fbm3(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * vn(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return s; }
`;

// -----------------------------------------------------------------------------------------------------------------------------------------
const SKY_FRAG = `${GLSL_COMMON}
uniform vec2 uRes; uniform float uHh, uTime, uScroll, uSc, uMoon, uWideSun;
uniform vec3 uSky0, uSky1, uSky2, uFar0, uFar1, uHaze, uSunC;
uniform vec2 uSun; uniform float uSunR;
varying vec2 vPx;
void main(){
  vec2 p = vPx; float Hh = uHh;
  vec3 c;
  if (p.y < Hh) {
    float g = clamp(p.y / Hh, 0.0, 1.0);
    c = mix(uSky0, uSky1, smoothstep(0.0, 0.62, g)); c = mix(c, uSky2, smoothstep(0.55, 1.0, g));
    // stars at night
    if (uMoon > 0.5) {
      vec2 cell = floor(p / (9.0 * uSc)); float hs = h21(cell);
      float tw = 0.5 + 0.5 * sin(uTime * 1.7 + hs * 40.0);
      float star = step(0.965, hs) * smoothstep(0.35, 0.0, length(fract(p / (9.0 * uSc)) - 0.5) * 2.0 + 0.0) * (0.35 + 0.65 * tw);
      c += vec3(star) * (1.0 - g * 0.8);
    }
    // sun / moon glow and disc
    float ds = length(p - uSun);
    float glow = exp(-ds / (uSunR * 0.09)) * 0.45 + exp(-ds / (uSunR * 0.4)) * 0.16;
    c += uSunC * glow * (uMoon > 0.5 ? 0.35 : 1.0);
    float disc = 1.0 - smoothstep(uSc * 27.0, uSc * 31.0, ds * (uMoon > 0.5 ? 1.15 : 1.0));
    c = mix(c, uMoon > 0.5 ? vec3(0.95, 0.97, 1.0) : vec3(1.0, 0.99, 0.93), disc);
    // drifting clouds, rim lit on the sun side
    vec2 cp = vec2(p.x * 0.0042 / uSc - uScroll * 0.0011 + 3.0, p.y * 0.016 / uSc);
    float cl = fbm(cp * vec2(1.0, 2.3));
    float band = smoothstep(0.02, 0.2, g) * (1.0 - smoothstep(0.62, 0.95, g));
    float cm = smoothstep(0.5, 0.78, cl) * band;
    vec2 toSun = normalize(uSun - p) * 0.05;
    float cl2 = fbm((cp + vec2(toSun.x, toSun.y * 2.0)) * vec2(1.0, 2.3));
    float rim = clamp((cl2 - cl) * 6.0, 0.0, 1.0);
    vec3 cc = mix(uHaze * 0.85 + uSky1 * 0.2, uSunC, rim * 0.8 + 0.1);
    c = mix(c, cc, cm * (uMoon > 0.5 ? 0.25 : 0.7));
    // far land: two ridges, the near one darker, haze on the far one
    float rx = p.x / uSc + uScroll * 0.05;
    float ridge1 = (14.0 + 26.0 * fbm3(vec2(rx * 0.006, 1.3)) + 18.0 * smoothstep(0.35, 1.0, p.x / uRes.x) * (0.4 + fbm3(vec2(rx * 0.01, 4.1)))) * uSc;
    float ridge2 = (6.0 + 14.0 * fbm3(vec2(rx * 0.011 + 9.0, 2.2)) + 8.0 * smoothstep(0.5, 1.0, p.x / uRes.x)) * uSc;
    vec3 land1 = mix(uFar1, uHaze, 0.45) * 0.9, land2 = uFar1 * 0.7 + uSky1 * 0.12;
    c = mix(c, land1, smoothstep(1.2, 0.0, (Hh - p.y) - ridge1) * 0.0 + step(Hh - ridge1, p.y) * 0.85);
    c = mix(c, land2, step(Hh - ridge2, p.y) * 0.9);
    // horizon haze
    c = mix(c, uHaze, smoothstep(0.78, 1.0, g) * 0.35);
  } else {
    float d = p.y - Hh;
    float z = 1.0 / (d / uSc + 6.0);                         // perspective: far sea (small z... near horizon) compresses
    float tN = clamp(d / max(1.0, uRes.y - Hh), 0.0, 1.0);
    c = mix(uFar0, uFar1, smoothstep(0.0, 0.5, tN));
    // swell lines receding to the horizon
    float lines = vn(vec2(p.x / uSc * z * 2.2 + uScroll * 0.02 * z * 30.0, z * 55.0 + uTime * 0.4));
    float sw = smoothstep(0.58, 0.9, lines);
    c = mix(c, mix(c, vec3(1.0), 0.5), sw * 0.35 * (1.0 - tN * 0.5));
    // sun glitter path: sparkles in a column below the sun
    float colw = (0.03 + tN * 0.22) * uRes.x;
    float gl = exp(-pow((p.x - uSun.x) / colw, 2.0));
    vec2 cell = vec2(floor(p.x / (2.2 * uSc)), floor(d / (1.6 * uSc) * (1.0 + 4.0 * z * uSc)));
    float sp = step(0.8, h21(cell + floor(uTime * 3.0 + h21(cell) * 6.0)));
    c += uSunC * gl * sp * 1.1 * (uMoon > 0.5 ? 0.5 : 1.0);
    c += uSunC * gl * 0.14 * (1.0 - tN);
    // reflection of the sun glow near the horizon
    c = mix(c, uHaze, smoothstep(0.25, 0.0, tN) * 0.55);
  }
  gl_FragColor = vec4(c, 1.0);
}`;

const FACE_VERT = `
attribute vec3 aInfo;  // v (0 base .. 1 top), s (metres along the wave), hollow
attribute vec3 aInfo2; // far (0 near .. 1 far), sc (metres ahead of the curl), slope of the crest
varying vec3 vInfo; varying vec3 vInfo2; varying vec2 vPx;
void main(){ vInfo = aInfo; vInfo2 = aInfo2; vPx = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const FACE_FRAG = `${GLSL_COMMON}
uniform float uTime, uSc, uMoon, uHh, uScroll, uPocket;
uniform vec2 uRes, uSun;
uniform vec3 uFace0, uFace1, uFace2, uFace3, uSky0, uSky2, uHaze, uSunC, uFoam0, uFoam1, uFar0, uL;
varying vec3 vInfo; varying vec3 vInfo2; varying vec2 vPx;
void main(){
  float v = vInfo.x, s = vInfo.y, hol = vInfo.z, far = vInfo2.x, slope = vInfo2.z;
  // depth gradient: thin and bright at the top, deep at the base
  vec3 c = mix(uFace3, uFace2, smoothstep(0.0, 0.34, v));
  c = mix(c, uFace1, smoothstep(0.3, 0.7, v));
  c = mix(c, uFace0, smoothstep(0.66, 1.0, v));
  // water drawn up the face: long streaks along the wave, rising, plus fine ripples
  float st = fbm(vec2(s * 0.10, v * 9.0 - uTime * 0.25 + s * 0.012));
  float st2 = fbm(vec2(s * 0.42 + 4.0, v * 3.0 - uTime * 0.5));
  float rip = fbm3(vec2(s * 0.9 + uTime * 0.2, v * 22.0 - uTime * 0.7));
  // surface normal: steep near the top (thin, near vertical), bumped by the streaks
  float ph = mix(0.5, 1.28, smoothstep(0.0, 0.95, v));
  vec3 n = normalize(vec3((st2 - 0.5) * 0.7 + (rip - 0.5) * 0.35 - slope * 1.2 * smoothstep(0.3, 1.0, v), sin(ph) + (st - 0.5) * 0.9, cos(ph) + 0.15));
  vec3 V = vec3(0.0, 0.25, 1.0); V = normalize(V);
  vec3 L = normalize(uL);
  float dif = clamp(dot(n, L), 0.0, 1.0);
  vec3 H = normalize(L + V);
  float spec = pow(clamp(dot(n, H), 0.0, 1.0), 70.0);
  float sky = clamp(n.y, 0.0, 1.0);
  // reflect the sky: fresnel grows toward the base where the face is shallow
  float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
  vec3 skyCol = mix(uSky2, uSky0, 0.35) + uSunC * 0.12;
  c = mix(c, skyCol, clamp(fres * 0.55 * (1.0 - smoothstep(0.2, 0.7, v)) + 0.05, 0.0, 0.5));
  // soft lighting from the sun side and a cool ambient on the dark side
  c *= 0.72 + 0.5 * dif;
  c += uSunC * spec * 0.55;
  // light shining through the thin upper face (stronger when the sun is behind the wave)
  float thin = smoothstep(0.45, 1.0, v);
  vec3 sss = mix(uFace0 * 1.15, uSunC, 0.55);
  float shaft = 0.5 + 0.5 * sin(s * 0.17 - uTime * 0.7 + st * 6.0);
  c += sss * thin * thin * (0.26 + 0.09 * shaft);
  // the darker bands where water is drawn up the face
  c *= 0.9 + 0.2 * st;
  // glints on the ripples
  float gl = smoothstep(0.74, 0.9, rip * 0.7 + st2 * 0.5) * smoothstep(0.1, 0.9, v);
  c += uSunC * gl * 0.35;
  // foam: the lip line at the top, wind lines, and thin lacy streaks that run down the face
  float lipN = fbm3(vec2(s * 0.5 + uTime * 0.5, v * 4.0));
  float lipFoam = smoothstep(0.9 - lipN * 0.07, 0.99, v);
  float lace = smoothstep(0.68, 0.78, fbm(vec2(s * 0.28, v * 5.5 - uTime * 0.15)) + (v - 0.5) * 0.35) * smoothstep(0.55, 0.9, v) * 0.32;
  c = mix(c, mix(uFoam1, uFoam0, 0.6), clamp(lipFoam * 0.95 + lace, 0.0, 1.0));
  // hollow stretch: the face goes deep teal and the interior glows through the wall
  vec3 tube = mix(vec3(0.0, 0.16, 0.26), uFace2 * 0.6, 0.35 + 0.4 * v);
  c = mix(c, tube, hol * smoothstep(0.0, 0.35, v) * 0.7 * (1.0 - far * 0.6));
  c += uSunC * hol * thin * 0.18;
  // the crest rolls over: a bright rounded roll at the top and the shadow it casts on the face below (the overhang)
  float roll = smoothstep(0.86, 0.97, v) * (1.0 - smoothstep(0.985, 1.0, v));
  c += mix(uFace0, uSunC, 0.5) * roll * 0.28;
  float under = smoothstep(0.62, 0.8, v) * (1.0 - smoothstep(0.82, 0.93, v));
  c *= 1.0 - under * (0.2 + 0.25 * hol);
  // distance haze toward the far end
  c = mix(c, uHaze, far * 0.32);
  gl_FragColor = vec4(c, 1.0);
}`;

const CHAN_FRAG = `${GLSL_COMMON}
uniform float uTime, uSc, uScroll;
uniform vec2 uRes, uSun;
uniform vec3 uFace2, uFace3, uDeep, uSky0, uSky2, uHaze, uSunC, uL;
varying vec3 vInfo; varying vec3 vInfo2; varying vec2 vPx;
void main(){
  // vInfo.x: 0 at the base of the wave .. 1 at the bottom of the screen
  float d = vInfo.x, s = vInfo.y;
  vec3 c = mix(uFace3, uDeep, smoothstep(0.0, 0.5, d));
  c = mix(c, uDeep * 0.7, smoothstep(0.4, 1.0, d));
  float r1 = fbm(vec2(s * 0.12, d * 14.0 - uTime * 0.2));
  float r2 = fbm3(vec2(s * 0.5 + uTime * 0.3, d * 30.0));
  vec3 n = normalize(vec3((r2 - 0.5) * 0.6, 1.0, (r1 - 0.5) * 0.7 + 0.4));
  vec3 V = normalize(vec3(0.0, 0.35, 1.0)), L = normalize(uL);
  float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 2.5);
  vec3 skyCol = mix(uSky2, uSky0, 0.4);
  c = mix(c, skyCol, clamp(fres * 0.7, 0.0, 0.6) * (1.0 - smoothstep(0.0, 0.9, d) * 0.4));
  float spec = pow(clamp(dot(n, normalize(L + V)), 0.0, 1.0), 90.0);
  c += uSunC * spec * 0.5;
  // light from the face spilling onto the water close to the base, and caustic lines
  c += uFace2 * 0.25 * (1.0 - smoothstep(0.0, 0.25, d));
  float ca = smoothstep(0.62, 0.8, fbm(vec2(s * 0.3 + uTime * 0.1, d * 18.0 + r1))) * 0.18 * (1.0 - d);
  c += vec3(ca);
  // foam left by the wave on the water near the base
  float fo = smoothstep(0.66, 0.8, fbm(vec2(s * 0.18, d * 9.0 + 3.0)) - d * 0.8) * (1.0 - smoothstep(0.0, 0.35, d)) * 0.55;
  c = mix(c, vec3(0.92, 0.97, 1.0), fo);
  gl_FragColor = vec4(c, 1.0);
}`;

const FOAM_FRAG = `${GLSL_COMMON}
uniform float uTime, uSc, uScroll;
uniform vec3 uFoam0, uFoam1, uFoam2, uSunC, uHaze, uFace2, uL; uniform float uEdge;
varying vec3 vInfo; varying vec3 vInfo2; varying vec2 vPx;
// vInfo.x: height above the base in px (0 at the bottom), vInfo.y: world s, vInfo.z: foam height at this column (px)
void main(){
  float hpx = vInfo.x, s = vInfo.y, H = max(8.0, vInfo.z);
  vec2 q = vec2(s * 0.07, hpx / (60.0 * uSc));
  float t = uTime * 0.1;
  float big = fbm3(q * 0.8 + vec2(-t, t * 0.5));
  // billows: rounded lumps from a ridged cellular-looking noise
  vec2 w = q * 2.2 + vec2(-t * 1.5, 3.0);
  float b1 = 1.0 - abs(2.0 * vn(w) - 1.0);
  float b2 = 1.0 - abs(2.0 * vn(w * 2.1 + 5.0) - 1.0);
  float lump = b1 * 0.65 + b2 * 0.35;
  float hgt = big * 0.55 + lump * 0.45;
  float edge = H * (0.74 + 0.55 * hgt) + (lump - 0.5) * 26.0 * uSc;
  float a = smoothstep(edge + 3.0 * uSc, edge - 4.0 * uSc, hpx);
  a *= smoothstep(uEdge + 34.0 * uSc, uEdge - 6.0 * uSc, vPx.x + (lump - 0.5) * 60.0 * uSc);
  if (a <= 0.003) discard;
  float hx = dFdx(hgt) * 38.0, hy = dFdy(hgt) * 38.0;
  vec3 n = normalize(vec3(-hx, hy + 0.5, 0.7));
  vec3 L = normalize(uL + vec3(0.0, 0.2, 0.5));
  float dif = clamp(dot(n, L) * 0.5 + 0.55, 0.0, 1.0);
  float ao = 0.55 + 0.45 * smoothstep(0.15, 0.85, hgt);
  vec3 shade = mix(uFoam2 * 0.85, uFace2 * 0.55 + vec3(0.45), 0.35);
  vec3 c = mix(shade, uFoam0, smoothstep(0.1, 0.75, dif * ao));
  // water showing through low in the mass and bluish thin edges
  float low = 1.0 - smoothstep(0.0, 0.28, hpx / H);
  c = mix(c, uFace2 * 0.7 + vec3(0.3), low * 0.22);
  // warm light on the sun side
  c += uSunC * 0.08 * dif;
  float bot = smoothstep(-4.0 * uSc, 16.0 * uSc, hpx);
  gl_FragColor = vec4(c, a * mix(0.0, 1.0, bot * 0.8 + 0.2));
}`;

const LIP_FRAG = `${GLSL_COMMON}
uniform float uTime, uSc;
uniform vec3 uFace0, uFace1, uFace2, uFoam0, uSunC, uL;
varying vec3 vInfo; varying vec3 vInfo2; varying vec2 vPx;
// vInfo.x: across (0 outer edge .. 1 inner), vInfo.y: along (0 at the crest .. 1 at the tip), vInfo.z: hollow
void main(){
  float w = vInfo.x, a = vInfo.y, hol = vInfo.z;
  // a tube: the shading follows a half cylinder across the sheet
  float cs = sqrt(max(0.0, 1.0 - pow(w * 2.0 - 1.0, 2.0)));
  vec3 n = normalize(vec3((w - 0.5) * 1.6, 0.5 + 0.6 * cs, 0.3 + 0.8 * cs));
  vec3 L = normalize(uL);
  float dif = clamp(dot(n, L) * 0.6 + 0.5, 0.0, 1.0);
  vec3 c = mix(uFace2, uFace1, smoothstep(0.0, 0.5, 1.0 - w));
  c = mix(c, uFace0, smoothstep(0.55, 1.0, cs) * 0.7);
  c *= 0.75 + 0.4 * dif;
  // the sun comes through the thin lip
  float thin = (1.0 - w) * (0.5 + 0.5 * hol);
  c += mix(uFace0, uSunC, 0.5) * 0.35 * thin;
  float rn = fbm3(vec2(a * 9.0 - uTime * 0.6, w * 6.0));
  c += vec3(0.04) * (rn - 0.5);
  // white rim along the outer edge and a frothy tip
  float rim = smoothstep(0.2, 0.0, w) * (0.85 + 0.15 * rn);
  float tip = smoothstep(0.7, 1.0, a) * smoothstep(0.35, 0.6, rn + 0.2);
  c = mix(c, uFoam0, clamp(rim + tip * 0.9, 0.0, 1.0));
  float alpha = smoothstep(1.0, 0.86, w) * smoothstep(0.0, 0.04, a) * 0.98;
  gl_FragColor = vec4(c, alpha);
}`;

const CAV_FRAG = `${GLSL_COMMON}
uniform float uTime, uSc, uHol;
uniform vec2 uC, uR;
uniform vec3 uFace0, uFace2, uSunC;
varying vec3 vInfo; varying vec3 vInfo2; varying vec2 vPx;
void main(){
  vec2 d = (vPx - uC) / uR;
  float r = length(d);
  if (r > 1.0) discard;
  float depth = 1.0 - r;
  vec3 dark = vec3(0.0, 0.07, 0.14), mid = uFace2 * 0.5;
  vec3 c = mix(mid, dark, smoothstep(0.0, 0.8, depth));
  // the light at the end of the tube, and a green glow from the top of the wall
  c += uFace0 * 0.35 * smoothstep(0.45, 0.0, length(d - vec2(0.15, -0.1)));
  c += uSunC * 0.25 * smoothstep(0.35, 0.0, length(d - vec2(0.25, 0.05)));
  float ca = smoothstep(0.65, 0.85, fbm(vPx * 0.05 / uSc + vec2(uTime * 0.3, 0.0)));
  c += uFace0 * ca * 0.12 * depth;
  gl_FragColor = vec4(c, smoothstep(1.0, 0.45, r) * uHol * 0.92);
}`;

const PART_VERT = `
attribute float aSize; attribute float aAlpha; attribute vec3 aTint;
varying float vA; varying vec3 vT;
void main(){ vA = aAlpha; vT = aTint; gl_PointSize = aSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PART_FRAG = `precision highp float; varying float vA; varying vec3 vT;
void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard;
  float a = smoothstep(1.0, 0.25, r); float sh = 0.85 + 0.15 * (0.5 - d.y);
  gl_FragColor = vec4(vT * sh, a * vA); }`;

const GRADE_FRAG = `precision highp float; uniform vec2 uRes; uniform float uAmt, uTube; varying vec2 vPx;
void main(){ vec2 q = vPx / uRes - 0.5; float v = smoothstep(0.35, 0.95, length(q * vec2(1.0, 0.85)));
  float a = v * (0.34 + 0.25 * uAmt) + uTube * smoothstep(0.1, 0.8, length(q)) * 0.3;
  gl_FragColor = vec4(0.0, 0.03, 0.09, a); }`;

const QUAD_VERT = `varying vec2 vPx; varying vec3 vInfo; varying vec3 vInfo2; attribute vec3 aInfo; attribute vec3 aInfo2;
void main(){ vPx = position.xy; vInfo = aInfo; vInfo2 = aInfo2; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// -----------------------------------------------------------------------------------------------------------------------------------------
export function createSea({ quality = 'medium' } = {}) {
  let renderer;
  const canvas = globalThis.document.createElement('canvas');
  try { renderer = new WebGLRenderer({ canvas, antialias: quality !== 'low', alpha: false, powerPreference: 'high-performance' }); } catch { return null; }
  if (!renderer.capabilities.isWebGL2) return null;
  renderer.setClearColor(0x06204a, 1);
  const api = { ok: true, lost: false, quality, canvas, renderer, ms: 0, drops: 0 };
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); api.lost = true; });
  canvas.addEventListener('webglcontextrestored', () => { api.lost = false; api.sizeKey = ''; });

  const scene = new Scene();
  const camera = new OrthographicCamera(0, 100, 0, 100, -100, 100);
  const U = {                       // shared uniforms
    uEdge: { value: 0 },
    uRes: { value: new Vector2(100, 100) }, uHh: { value: 100 }, uTime: { value: 0 }, uScroll: { value: 0 }, uSc: { value: 1 }, uMoon: { value: 0 },
    uSky0: { value: new Color() }, uSky1: { value: new Color() }, uSky2: { value: new Color() }, uFar0: { value: new Color() }, uFar1: { value: new Color() },
    uHaze: { value: new Color() }, uSunC: { value: new Color() }, uSun: { value: new Vector2() }, uSunR: { value: 100 },
    uFace0: { value: new Color() }, uFace1: { value: new Color() }, uFace2: { value: new Color() }, uFace3: { value: new Color() }, uDeep: { value: new Color() },
    uFoam0: { value: new Color() }, uFoam1: { value: new Color() }, uFoam2: { value: new Color() }, uL: { value: new Vector3(0, 0.5, -0.5) }, uPocket: { value: 0 },
    uWideSun: { value: 0 },
  };
  const mat = (frag, vert, extra = {}) => new ShaderMaterial({ uniforms: U, vertexShader: vert || QUAD_VERT, fragmentShader: frag, depthTest: false, depthWrite: false, side: THREE.DoubleSide, ...extra });

  // ---- sky quad
  const quad = new BufferGeometry();
  quad.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));
  quad.setAttribute('aInfo', new BufferAttribute(new Float32Array(12), 3));
  quad.setAttribute('aInfo2', new BufferAttribute(new Float32Array(12), 3));
  quad.setIndex([0, 1, 2, 0, 2, 3]);
  const sky = new Mesh(quad, mat(SKY_FRAG)); sky.frustumCulled = false; sky.renderOrder = 0; scene.add(sky);

  // ---- grids along the screen: face, channel, foam
  const MAXC = 220, ROWS = 14;
  const grid = (rows, frag, order, transparent = false) => {
    const g = new BufferGeometry();
    const n = (MAXC + 1) * (rows + 1);
    g.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aInfo', new BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aInfo2', new BufferAttribute(new Float32Array(n * 3), 3));
    const idx = [];
    for (let i = 0; i < MAXC; i++) for (let j = 0; j < rows; j++) { const a = i * (rows + 1) + j, b = a + 1, c = a + rows + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    g.setIndex(idx); g.setDrawRange(0, 0);
    const m = new Mesh(g, mat(frag, null, { transparent })); m.frustumCulled = false; m.renderOrder = order; scene.add(m);
    return { g, m, rows };
  };
  const chan = grid(6, CHAN_FRAG, 1);
  const face = grid(ROWS, FACE_FRAG, 2);
  const foam = grid(8, FOAM_FRAG, 5, true);

  // ---- lip (crescent) and tube cavity
  const LIPN = 26, LIPJ = 6;
  const lipG = new BufferGeometry();
  lipG.setAttribute('position', new BufferAttribute(new Float32Array((LIPN + 1) * (LIPJ + 1) * 3), 3));
  lipG.setAttribute('aInfo', new BufferAttribute(new Float32Array((LIPN + 1) * (LIPJ + 1) * 3), 3));
  lipG.setAttribute('aInfo2', new BufferAttribute(new Float32Array((LIPN + 1) * (LIPJ + 1) * 3), 3));
  { const idx = []; for (let i = 0; i < LIPN; i++) for (let j = 0; j < LIPJ; j++) { const a = i * (LIPJ + 1) + j, b = a + 1, c = a + LIPJ + 1, d = c + 1; idx.push(a, b, c, b, d, c); } lipG.setIndex(idx); }
  const lip = new Mesh(lipG, mat(LIP_FRAG, null, { transparent: true })); lip.frustumCulled = false; lip.renderOrder = 4; scene.add(lip);
  const cavU = { uC: { value: new Vector2() }, uR: { value: new Vector2(10, 10) }, uHol: { value: 0 } };
  const cavG = new BufferGeometry();
  cavG.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));
  cavG.setAttribute('aInfo', new BufferAttribute(new Float32Array(12), 3));
  cavG.setAttribute('aInfo2', new BufferAttribute(new Float32Array(12), 3));
  cavG.setIndex([0, 1, 2, 0, 2, 3]);
  const cav = new Mesh(cavG, new ShaderMaterial({ uniforms: { ...U, ...cavU }, vertexShader: QUAD_VERT, fragmentShader: CAV_FRAG, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
  cav.frustumCulled = false; cav.renderOrder = 3; scene.add(cav);

  // ---- particles (spray, mist, droplets)
  const NP = quality === 'low' ? 260 : 520;
  const pg = new BufferGeometry();
  const pPos = new Float32Array(NP * 3), pSize = new Float32Array(NP), pAlpha = new Float32Array(NP), pTint = new Float32Array(NP * 3);
  pg.setAttribute('position', new BufferAttribute(pPos, 3)); pg.setAttribute('aSize', new BufferAttribute(pSize, 1));
  pg.setAttribute('aAlpha', new BufferAttribute(pAlpha, 1)); pg.setAttribute('aTint', new BufferAttribute(pTint, 3));
  const parts = new Points(pg, new ShaderMaterial({ vertexShader: PART_VERT, fragmentShader: PART_FRAG, transparent: true, depthTest: false, depthWrite: false }));
  parts.frustumCulled = false; parts.renderOrder = 6; scene.add(parts);

  // ---- birds and the dolphin (flat silhouettes, rendered between the sky and the wave)
  const BIRDS = 5, BV = 10;
  const bg = new BufferGeometry();
  bg.setAttribute('position', new BufferAttribute(new Float32Array(BIRDS * BV * 3), 3));
  { const idx = []; for (let i = 0; i < BIRDS; i++) for (let k = 0; k < 4; k++) { const a = i * BV + k, b = a + 1, c = a + 5, d = c + 1; idx.push(a, b, c, b, d, c); } bg.setIndex(idx); }
  const birdMat = new ShaderMaterial({ vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'precision highp float; uniform vec3 uC; void main(){ gl_FragColor = vec4(uC, 0.9); }', uniforms: { uC: { value: new Color().setStyle('#2a2438', LIN) } }, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  const birds = new Mesh(bg, birdMat); birds.frustumCulled = false; birds.renderOrder = 1.5; scene.add(birds);

  const dolG = new BufferGeometry();
  const DOLN = 14;
  dolG.setAttribute('position', new BufferAttribute(new Float32Array((DOLN + 1) * 2 * 3), 3));
  { const idx = []; for (let i = 0; i < DOLN; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } dolG.setIndex(idx); }
  const dolMat = new ShaderMaterial({ vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'precision highp float; varying vec2 vP; uniform vec3 uC; void main(){ gl_FragColor = vec4(uC, 1.0); }', uniforms: { uC: { value: new Color().setStyle('#3b5878', LIN) } }, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  const dolphin = new Mesh(dolG, dolMat); dolphin.frustumCulled = false; dolphin.renderOrder = 1.6; scene.add(dolphin);

  // ---- grade (vignette)
  const gradeG = new BufferGeometry();
  gradeG.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));
  gradeG.setIndex([0, 1, 2, 0, 2, 3]);
  const gradeU = { uRes: U.uRes, uAmt: { value: 0.4 }, uTube: { value: 0 } };
  const grade = new Mesh(gradeG, new ShaderMaterial({ uniforms: gradeU, vertexShader: 'varying vec2 vPx; void main(){ vPx = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: GRADE_FRAG, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
  grade.frustumCulled = false; grade.renderOrder = 9; scene.add(grade);

  const setQuad = (g, x0, y0, x1, y1) => { g.attributes.position.array.set([x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0]); g.attributes.position.needsUpdate = true; };

  // ---- per frame ---------------------------------------------------------------------------------------------------------------------
  const cols = [];
  let pi = 0;
  const emit = (x, y, size, alpha, r, g, b) => { if (pi >= NP) return; const k = pi++; pPos[k * 3] = x; pPos[k * 3 + 1] = y; pPos[k * 3 + 2] = 0; pSize[k] = size; pAlpha[k] = alpha; pTint[k * 3] = r; pTint[k * 3 + 1] = g; pTint[k * 3 + 2] = b; };

  // cam: art.js makeCam result; pal: PALS entry; o: { rx, ry, mode, speed, carve, tube, wiped, dev } device scale for the canvas
  api.render = function render(cam, pal, ws, t, o = {}) {
    if (api.lost) return false;
    const t0 = globalThis.performance.now();
    const { W, H, sc, r, wave } = cam;
    const dpr = o.dpr || 1;
    const px = clamp(Math.min(dpr, api.quality === 'low' ? 1 : 1.75), 1, 2);
    const cap = api.quality === 'low' ? 0.55e6 : 1.5e6;
    let k = px; if (W * H * k * k > cap) k = Math.sqrt(cap / (W * H));
    const dw = Math.max(32, Math.round(W * k)), dh = Math.max(32, Math.round(H * k));
    const key = `${dw}x${dh}`;
    if (api.sizeKey !== key) { api.sizeKey = key; renderer.setPixelRatio(1); renderer.setSize(dw, dh, false); }
    camera.left = 0; camera.right = W; camera.top = 0; camera.bottom = H; camera.updateProjectionMatrix();
    U.uRes.value.set(W, H); U.uHh.value = cam.Hh; U.uTime.value = t; U.uScroll.value = r.s; U.uSc.value = sc; U.uMoon.value = pal.moon ? 1 : 0;
    const c3 = (u, hex) => u.value.setStyle(hex, LIN);
    c3(U.uSky0, pal.sky[0]); c3(U.uSky1, pal.sky[1]); c3(U.uSky2, pal.sky[2]); c3(U.uFar0, pal.far[0]); c3(U.uFar1, pal.far[1]);
    c3(U.uFace0, pal.face[0]); c3(U.uFace1, pal.face[1]); c3(U.uFace2, pal.face[2]); c3(U.uFace3, pal.face[3]); c3(U.uDeep, pal.deep);
    c3(U.uFoam0, pal.foam[0]); c3(U.uFoam1, pal.foam[1]); c3(U.uFoam2, pal.foam[2]);
    { const h = rgbOf(pal.haze), s = rgbOf(pal.sun.c); U.uHaze.value.setRGB(h[0], h[1], h[2]); U.uSunC.value.setRGB(s[0], s[1], s[2]); }
    const sx = W * pal.sun.x, sy = cam.Hh * pal.sun.y;
    U.uSun.value.set(sx, sy); U.uSunR.value = Math.max(W, cam.Hh) * pal.sun.r;
    U.uL.value.set((pal.sun.x - 0.5) * 1.3, 0.25 + 0.9 * (1 - pal.sun.y), pal.sun.y > 0.5 ? -0.55 : 0.2);

    setQuad(quad, 0, 0, W, H);
    quad.attributes.aInfo.needsUpdate = false;

    // columns
    const step = Math.max(3, W / 150);
    const nC = Math.min(MAXC, Math.ceil((W + 2 * step) / step));
    const F0 = cam.F0;
    const yB0 = cam.yB0;
    const xcur = cam.xc, uc = -r.d, kC = cam.k(uc), ybc = cam.yB(uc), fhC = cam.fh(uc);
    const edge = xcur - 4 * cam.ppm * kC;
    U.uEdge.value = edge;
    const fp = face.g.attributes.position.array, fi = face.g.attributes.aInfo.array, fj = face.g.attributes.aInfo2.array;
    const cp = chan.g.attributes.position.array, ci = chan.g.attributes.aInfo.array, cj = chan.g.attributes.aInfo2.array;
    const op = foam.g.attributes.position.array, oi = foam.g.attributes.aInfo.array, oj = foam.g.attributes.aInfo2.array;
    for (let i = 0; i < nC; i++) {
      const x = -step + i * step;
      const u = cam.uOf(x), yb = cam.yB(u), fh = cam.fh(u), scd = u + r.d, s = r.s + u, kk = cam.k(u);
      const lift = scd > -4 && scd < 50 ? F0 * kk * 0.05 * Math.exp(-Math.pow((scd - 10) / 14, 2)) : 0;
      let top = yb - fh - lift;
      let fh2 = foamH(cam, u);
      { const dx = x - edge; const pl = fhC * 0.62 * Math.exp(-Math.pow(dx < 0 ? dx / (80 * sc) : dx / (30 * sc), 2)); fh2 = Math.max(fh2, pl); }
      if (scd < 0) { const q = clamp(-scd / CURL_W, 0, 1), e = 1 - (1 - q) * (1 - q); top = mix(top, Math.max(yb - fh2, yb - fh), e); }
      const hol = hollowAt(wave, s);
      const far = sm(0.45, 1.0, x / W) * 0.9;
      const slope = i > 0 ? clamp((top - cols[i - 1].top) / step, -2, 2) : 0;
      cols[i] = { x, yb, top, s, hol, far, scd, fh2, kk };
      // face rows
      for (let j = 0; j <= ROWS; j++) {
        const v = j / ROWS, n = (i * (ROWS + 1) + j);
        const yy = mix(yb + 8, top, v);
        fp[n * 3] = x; fp[n * 3 + 1] = yy; fp[n * 3 + 2] = 0;
        fi[n * 3] = j === 0 ? 0 : clamp((yb - yy) / Math.max(1, yb - top), 0, 1); fi[n * 3 + 1] = s; fi[n * 3 + 2] = hol;
        fj[n * 3] = far; fj[n * 3 + 1] = scd; fj[n * 3 + 2] = slope;
      }
      // channel rows (below the base)
      for (let j = 0; j <= 6; j++) {
        const d = j / 6, n = i * 7 + j;
        const yy = mix(yb + 6, H + 6, d * d * 0.7 + d * 0.3);
        cp[n * 3] = x; cp[n * 3 + 1] = yy; cp[n * 3 + 2] = 0;
        ci[n * 3] = clamp((yy - yb) / Math.max(1, H - yb), 0, 1); ci[n * 3 + 1] = s; ci[n * 3 + 2] = 0;
        cj[n * 3] = far; cj[n * 3 + 1] = scd; cj[n * 3 + 2] = 0;
      }
      // foam rows: only where the whitewater lives (x < edge + a little); rows span from base up to foam height * 1.45
      for (let j = 0; j <= 8; j++) {
        const f = j / 8, n = i * 9 + j;
        const bottom = yb + 14 * sc * kk, hTop = Math.max(10, fh2 * 1.55);
        const yy = mix(bottom, yb - hTop, f);
        op[n * 3] = x; op[n * 3 + 1] = yy; op[n * 3 + 2] = 0;
        oi[n * 3] = Math.max(0, bottom - yy - 14 * sc * kk); oi[n * 3 + 1] = s; oi[n * 3 + 2] = fh2;
        oj[n * 3] = far; oj[n * 3 + 1] = scd; oj[n * 3 + 2] = fh2;
      }
    }
    for (const gr of [face, chan, foam]) {
      gr.g.attributes.position.needsUpdate = true; gr.g.attributes.aInfo.needsUpdate = true; gr.g.attributes.aInfo2.needsUpdate = true;
    }
    // draw ranges: face = all columns (the curl region already collapses to foam height), foam = columns left of the edge
    face.g.setDrawRange(0, (nC - 1) * ROWS * 6);
    chan.g.setDrawRange(0, (nC - 1) * 6 * 6);
    let nFoam = 0;
    for (let i = 0; i < nC; i++) if (cols[i].x <= edge + 45 * sc) nFoam = i + 1;
    foam.g.setDrawRange(0, Math.max(0, (Math.min(nC, nFoam) - 1)) * 8 * 6);
    foam.m.visible = nFoam > 1;

    // ---- the lip (crescent) at the curl, on hollow waves a long deep hook over the tube
    const hc = hollowAt(wave, r.s - r.d);
    const Dh = fhC * (0.16 + 0.5 * hc), Lh = (2.5 + 9 * hc) * cam.ppm * kC, th = fhC * (0.05 + 0.09 * hc);
    const xp = xcur + 1.5 * cam.ppm * kC, yp = ybc - fhC * 0.985;
    const S = [xp + 0.4 * Lh, yp], T = [xp - 0.95 * Lh, yp + Dh];
    const O1 = [xp - 0.25 * Lh, yp - 0.14 * Dh], O2 = [xp - 1.05 * Lh, yp + 0.15 * Dh];
    const S2 = [S[0] + 0.1 * Lh, yp + 0.4 * th], I1 = [xp + 0.05 * Lh, yp + th * 1.4], I2 = [xp - 0.75 * Lh, yp + th * 1.2 + 0.4 * Dh];
    const bez = (p0, p1, p2, p3, uu) => { const m = 1 - uu; return [m * m * m * p0[0] + 3 * m * m * uu * p1[0] + 3 * m * uu * uu * p2[0] + uu * uu * uu * p3[0], m * m * m * p0[1] + 3 * m * m * uu * p1[1] + 3 * m * uu * uu * p2[1] + uu * uu * uu * p3[1]]; };
    const lp = lipG.attributes.position.array, li = lipG.attributes.aInfo.array;
    for (let i = 0; i <= LIPN; i++) {
      const a = i / LIPN, po = bez(S, O1, O2, T, a), pi2 = bez(S2, I1, I2, T, a);
      for (let j = 0; j <= LIPJ; j++) {
        const w = j / LIPJ, n = i * (LIPJ + 1) + j;
        lp[n * 3] = mix(po[0], pi2[0], w); lp[n * 3 + 1] = mix(po[1], pi2[1], w); lp[n * 3 + 2] = 0;
        li[n * 3] = w; li[n * 3 + 1] = a; li[n * 3 + 2] = hc;
      }
    }
    lipG.attributes.position.needsUpdate = true; lipG.attributes.aInfo.needsUpdate = true;
    // tube cavity
    const ccx = xcur + 8 * cam.ppm * kC, ccy = ybc - fhC * 0.4, crx = (6 + 7 * hc) * cam.ppm * kC, cry = fhC * 0.5;
    cavU.uC.value.set(ccx, ccy); cavU.uR.value.set(crx, cry); cavU.uHol.value = hc > 0.04 ? hc : 0;
    setQuad(cavG, ccx - crx, ccy - cry, ccx + crx, ccy + cry);
    cav.visible = hc > 0.04;

    // ---- particles
    pi = 0;
    const fr = rgbOf(pal.haze);
    const fw = new Color().setStyle(pal.foam[0], LIN);
    const wob = (a) => Math.sin(a * 12.9898) * 0.5 + 0.5;
    // 1) spray where the lip lands and a plume off the foam
    const nSp = api.quality === 'low' ? 40 : 90;
    for (let i = 0; i < nSp; i++) {
      const ph = (t * (0.7 + 0.5 * hash(i)) + hash(i + 3.1) * 7) % 1, ang = -Math.PI * (0.05 + 0.9 * hash(i + 9.7));
      const sp = (40 + 70 * hash(i + 1.3)) * sc * kC;
      const x = edge - 20 * sc + Math.cos(ang) * ph * sp * 1.1, y = ybc - fhC * 0.35 + Math.sin(ang) * ph * sp * 1.5 + ph * ph * 70 * sc;
      emit(x, y, (3 + 5 * hash(i + 5)) * sc * kC * (1 - 0.4 * ph) * 1.6, (1 - ph) * 0.9, fw.r, fw.g, fw.b);
    }
    // 2) wind-blown spray off the crest, backlit
    const nCr = api.quality === 'low' ? 40 : 110;
    for (let i = 0; i < nCr; i++) {
      const xs = hash(i * 1.7 + 0.3) * W;
      const c = cols[clamp(Math.round((xs + step) / step), 0, nC - 1)];
      if (!c || c.scd < 2) continue;
      const ph = (t * (0.5 + 0.7 * hash(i + 2)) + hash(i + 0.5) * 5) % 1;
      const x = c.x - ph * 22 * sc * c.kk, y = c.top - 4 * sc - ph * (18 + 34 * hash(i + 8)) * sc * c.kk;
      emit(x, y, (2 + 3 * hash(i + 4)) * sc * c.kk * 1.7, (1 - ph) * 0.8 * (0.4 + 0.6 * sm(0.3, 0.9, hash(i + 11))), 1, 1, 1);
    }
    // 3) mist rising from the whitewater
    const nMi = api.quality === 'low' ? 20 : 50;
    for (let i = 0; i < nMi; i++) {
      const ph = (t * 0.25 + hash(i + 6) * 3) % 1;
      const x = hash(i * 0.9 + 2) * Math.max(10, edge);
      const u = cam.uOf(x), k2 = cam.k(u), yy = cam.yB(u) - foamH(cam, u) * (0.7 + ph * 0.9);
      emit(x + Math.sin(t + i) * 6 * sc, yy, (14 + 14 * hash(i)) * sc * k2, 0.28 * (1 - ph), fr[0], fr[1], fr[2]);
    }
    // 3b) big soft billows along the top of the whitewater and up the curl: they give the mass volume
    { const nb = api.quality === 'low' ? 10 : 20;
      for (let i = 0; i < nb; i++) {
        const f = i / nb;
        let x, y;
        if (i % 3 === 2) { const q = (i / 3) % 1; x = edge - (6 + 18 * q) * sc + Math.sin(t * 0.9 + i) * 6 * sc; y = ybc - fhC * (0.18 + 0.5 * f) + Math.sin(t * 1.3 + i * 2) * 5 * sc; }
        else { x = f * Math.max(40, edge - 8 * sc); const u2 = cam.uOf(x); y = cam.yB(u2) - foamH(cam, u2) * (0.9 + 0.25 * Math.sin(t * 0.8 + i)); }
        const u3 = cam.uOf(x), k3 = cam.k(u3), rr = (30 + 22 * hash(i + 2)) * sc * k3;
        emit(x, y, rr * 2.2, 0.55, fw.r, fw.g, fw.b);
      }
    }
    // 4) the board's spray: a fan off the rail behind the rider, thrown up and back as the board carves
    const rx = o.rx, ry = o.ry;
    if (rx !== undefined && o.mode === 'ride') {
      const sp = clamp(o.speed ?? 0.6, 0, 1.4), carve = clamp(Math.abs(o.carve ?? 0), 0, 1.5);
      const nB = api.quality === 'low' ? 30 : 90;
      for (let i = 0; i < nB; i++) {
        const ph = (t * (1.2 + 1.2 * hash(i + 21)) + hash(i + 40) * 5) % 1;
        const ang = Math.PI * (0.62 + 0.3 * hash(i + 3)), v0 = (60 + 120 * hash(i + 8)) * (0.5 + 0.8 * sp + 0.6 * carve) * sc;
        const x = rx - 12 * sc + Math.cos(ang) * v0 * ph - ph * 90 * sc * sp, y = ry + 2 * sc - Math.sin(ang) * v0 * ph * 0.8 + 140 * sc * ph * ph;
        emit(x, y, (2.5 + 4 * hash(i + 17)) * sc * (1 - 0.5 * ph) * 1.5, (1 - ph) * 0.85, 1, 1, 1);
      }
    }
    // 5) water droplets thrown by a wipeout or a landing
    if (o.burst) {
      const nD = 70, b = o.burst;
      for (let i = 0; i < nD; i++) {
        const ph = clamp(b.t / 1.2, 0, 1);
        if (ph >= 1) break;
        const ang = hash(i + 50) * Math.PI * 2, v0 = (60 + 180 * hash(i + 60)) * sc;
        const x = b.x + Math.cos(ang) * v0 * ph, y = b.y + Math.sin(ang) * v0 * ph * 0.8 + 260 * sc * ph * ph - 40 * sc * ph;
        emit(x, y, (2 + 4 * hash(i + 70)) * sc * 1.6, (1 - ph) * 0.9, 1, 1, 1);
      }
    }
    for (let i = pi; i < NP; i++) { pAlpha[i] = 0; pSize[i] = 0; }
    pg.attributes.position.needsUpdate = true; pg.attributes.aSize.needsUpdate = true; pg.attributes.aAlpha.needsUpdate = true; pg.attributes.aTint.needsUpdate = true;
    // point sizes are in device pixels
    const psz = pSize; for (let i = 0; i < pi; i++) psz[i] *= k;

    // ---- birds and the dolphin
    const bp = bg.attributes.position.array;
    const showBirds = !pal.moon;
    for (let i = 0; i < BIRDS; i++) {
      const sp = 8 + 6 * hash(i), x0 = hash(i + 100) * W * 1.4, x = ((x0 + t * sp * sc * 1.6 - r.s * 0.4 * sc) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2;
      const y = cam.Hh * (0.28 + 0.4 * hash(i + 200)) + Math.sin(t * 0.7 + i) * 8 * sc;
      const sz = (14 + 9 * hash(i + 300)) * sc, fl = Math.sin(t * (4.5 + 2 * hash(i)) + i * 2.0), th = sz * 0.09;
      // an 'M' gull: tip, bend, body, bend, tip; the wings beat up and down
      const px = [-1, -0.5, 0, 0.5, 1], py = [0.35 * fl, -0.22 + 0.2 * fl, 0.0, -0.22 + 0.2 * fl, 0.35 * fl];
      for (let k = 0; k < 5; k++) {
        const n = i * BV + k;
        bp[n * 3] = x + px[k] * sz; bp[n * 3 + 1] = y - py[k] * sz; bp[n * 3 + 2] = 0;
        const m = n + 5;
        bp[m * 3] = x + px[k] * sz; bp[m * 3 + 1] = y - py[k] * sz + th * (k === 0 || k === 4 ? 0.2 : 1.6); bp[m * 3 + 2] = 0;
      }
    }
    bg.attributes.position.needsUpdate = true; birds.visible = showBirds && !o.noBirds;
    // dolphin: arcs out of the open sea every ~28 s on the daylight beaches (a leaping silhouette with a splash)
    const dp = pal.moon ? -1 : (t % 28) / 28;
    const dolOn = dp >= 0 && dp < 0.09;
    dolphin.visible = dolOn;
    if (dolOn) {
      const a = dp / 0.09;
      const x0 = W * (0.52 + 0.16 * Math.sin(Math.floor(t / 28) * 3.7)), len = 70 * sc, hgt = 34 * sc;
      const cx = x0 + a * 120 * sc - 60 * sc, base = cam.Hh + 10 * sc;
      const dpos = dolG.attributes.position.array;
      for (let i = 0; i <= DOLN; i++) {
        const u = i / DOLN, bx = (u - 0.5) * len;
        // body along an arc, tilting with the leap
        const arc = -Math.sin(a * Math.PI) * hgt, slope = -Math.cos(a * Math.PI) * hgt * Math.PI / 120 / sc;
        const wdt = (Math.sin(u * Math.PI) * 0.9 + 0.1) * 7.5 * sc * (u > 0.82 ? 0.5 : 1);
        const yc = base + arc + slope * bx * 0.5 + (u > 0.9 ? -6 * sc * (u - 0.9) * 10 * 0 : 0);
        dpos[i * 6] = cx + bx; dpos[i * 6 + 1] = yc - wdt; dpos[i * 6 + 2] = 0;
        dpos[i * 6 + 3] = cx + bx; dpos[i * 6 + 4] = yc + wdt * 0.8; dpos[i * 6 + 5] = 0;
      }
      dolG.attributes.position.needsUpdate = true;
      dolMat.uniforms.uC.value.setStyle(pal.far[1], LIN).multiplyScalar(0.55);
    }
    // grade
    setQuad(gradeG, 0, 0, W, H);
    gradeU.uAmt.value = pal.moon ? 0.9 : 0.4;
    gradeU.uTube.value = clamp(o.tube || 0, 0, 1);

    renderer.setViewport(0, 0, dw, dh);
    renderer.render(scene, camera);
    api.ms = api.ms ? api.ms * 0.95 + (globalThis.performance.now() - t0) * 0.05 : globalThis.performance.now() - t0;
    if (api.ms > 9 && api.quality !== 'low' && (api.n = (api.n || 0) + 1) > 90) { api.quality = 'low'; api.sizeKey = ''; }
    return true;
  };
  return api;
}

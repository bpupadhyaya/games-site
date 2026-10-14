// The sea and the beach as ONE ground shader in sea coordinates (s = distance from the beach, y = across the course). World X = y, Z = -s.
// Swells are the sim's own crests (positions at the race clock): an asymmetric height field gives real normals, so the face goes dark and
// the back slope catches the sun; breaking crests get a whitewater sheet. Deep colour follows distance from the beach like the 2D art.
export const MAXW = 14;

const VERT = `
varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

const FRAG = `
precision highp float;
#define NW ${MAXW}
varying vec3 vW;
uniform vec4 uW[NW];        // c, h, skew, phase
uniform float uBrk[NW];
uniform float uT, uD, uMineY, uCurAmp, uP1, uP2;
uniform vec3 uSun, uCam, uFogCol;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1,0)), f.x), mix(h21(i + vec2(0,1)), h21(i + vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ return 0.5 * vn(p) + 0.25 * vn(p * 2.03 + 7.1) + 0.125 * vn(p * 4.1 + 3.7); }
vec3 ramp(float t){
  vec3 a = vec3(0.560,0.902,0.831), b = vec3(0.298,0.784,0.765), c = vec3(0.118,0.612,0.722), d = vec3(0.070,0.439,0.624), e = vec3(0.039,0.290,0.486);
  if (t < 0.12) return mix(a, b, t / 0.12);
  if (t < 0.27) return mix(b, c, (t - 0.12) / 0.15);
  if (t < 0.5) return mix(c, d, (t - 0.27) / 0.23);
  return mix(d, e, clamp((t - 0.5) / 0.5, 0.0, 1.0));
}
void main(){
  float s = -vW.z, y = vW.x;
  float H = 0.0, dHs = 0.0, dHy = 0.0, foam = 0.0, sheet = 0.0, back = 0.0;
  for (int i = 0; i < NW; i++) {
    vec4 w = uW[i]; if (w.y < 0.001) continue;
    float wob = (0.5 + 0.25 * w.y), q = 0.26 * y + w.w + uT * 0.3;
    float xc = w.x + w.z * y + wob * sin(q);
    float dxc = w.z + wob * 0.26 * cos(q);
    float x = s - xc;
    float sf = 0.9 + 1.5 * w.y, sb = 2.4 + 3.2 * w.y;
    float sg = x < 0.0 ? sf : sb;
    float g = exp(-0.5 * x * x / (sg * sg));
    float amp = 0.62 * w.y;
    float dg = -x / (sg * sg) * g;
    H += amp * g; dHs += amp * dg; dHy += amp * dg * (-dxc);
    float cr = exp(-x * x / (0.5 + 0.25 * w.y));
    foam += cr * (0.55 + 0.35 * min(1.0, w.y));
    float br = uBrk[i];
    if (br > 0.0) {
      float L = 5.0 + 6.0 * w.y;
      float m = smoothstep(0.4, -0.2, x) * smoothstep(-L, -L * 0.25, x);
      float nz = fbm(vec2(y * 0.55, s * 0.42 - uT * 0.5) + w.w);
      sheet += br * m * smoothstep(0.38, 0.72, nz + 0.25 * (1.0 + x / L));
      foam += br * cr * 0.5;
    } else {
      back += exp(-pow((x + 1.1 + 0.6 * w.y) / 0.5, 2.0)) * 0.25;
    }
  }
  vec2 cp = vec2(y, s);
  float e = 0.35;
  vec2 a0 = vec2(uT * 0.10, uT * 0.23), a1 = vec2(-uT * 0.17, uT * 0.31);
  float c0 = fbm(cp * 0.8 + a0);
  float cx = fbm((cp + vec2(e, 0.0)) * 0.8 + a0) - c0;
  float cy = fbm((cp + vec2(0.0, e)) * 0.8 + a0) - c0;
  float c1 = fbm(cp * 2.1 + a1);
  float c1x = fbm((cp + vec2(e, 0.0)) * 2.1 + a1) - c1;
  float c1y = fbm((cp + vec2(0.0, e)) * 2.1 + a1) - c1;
  // world x = y ; world z = -s
  vec3 N = normalize(vec3(-(dHy + (cx + 0.6 * c1x) * 0.35), 1.0, (dHs - (cy + 0.6 * c1y) * 0.35)));
  float t = clamp((s + 6.0) / (uD + 46.0), 0.0, 1.0);
  vec3 col = ramp(t);
  vec3 V = normalize(uCam - vW);
  vec3 Ld = normalize(uSun);
  float dif = clamp(dot(N, Ld) * 0.5 + 0.55, 0.0, 1.2);
  col *= mix(0.62, 1.12, dif);
  float hs = smoothstep(0.0, 0.9, H);
  col = mix(col, col * vec3(0.38, 0.62, 0.9), clamp(-dHs * 2.6, 0.0, 0.85));
  col = mix(col, col * vec3(1.15, 1.12, 1.0) + vec3(0.05, 0.1, 0.08), clamp(dHs * 1.8, 0.0, 0.5));
  col += vec3(0.05, 0.28, 0.26) * hs * clamp(dHs * 1.4, 0.0, 1.0);
  vec3 Hh = normalize(Ld + V);
  float sp = pow(max(dot(N, Hh), 0.0), 260.0) * 0.9;
  col += vec3(1.0, 0.95, 0.82) * sp;
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col = mix(col, vec3(0.62, 0.86, 0.95), fres * 0.35);
  float spk = smoothstep(0.58, 0.8, vn(cp * vec2(3.2, 5.0) + uT * 0.2));
  float f = clamp(foam * (0.75 + 0.5 * spk) + sheet * 0.95, 0.0, 1.0);
  col = mix(col, vec3(0.97, 1.0, 0.99), f);
  col += vec3(0.5, 0.8, 0.8) * back * 0.35;
  float lane = 0.0;
  for (int l = 0; l < 4; l++) {
    float ly = (l == 0) ? -10.5 : (l == 1) ? -3.5 : (l == 2) ? 3.5 : 10.5;
    float on = step(abs(ly - uMineY), 0.1);
    float line = smoothstep(0.1, 0.03, abs(y - ly)) * step(fract(s / 2.0), 0.45);
    lane = max(lane, line * (on > 0.5 ? 0.55 : 0.2));
  }
  lane *= step(0.0, s) * step(s, uD);
  col = mix(col, vec3(1.0), lane * (1.0 - f));
  float cur = uCurAmp * (0.62 * sin(0.05 * s + uP1) + 0.38 * sin(0.13 * s + uP2));
  float st = smoothstep(0.72, 0.9, vn(vec2(y * 1.7, (s - uT * cur * 2.0) * 0.16)));
  col = mix(col, vec3(1.0), st * min(1.0, abs(cur)) * 0.25 * step(0.0, s));
  if (s < 3.0) {
    float edge = 0.2 + 0.7 * sin(y * 0.5 + uT * 0.9) + 0.4 * sin(y * 1.3 - uT * 0.7);
    float sandMix = smoothstep(edge + 0.6, edge - 0.5, s);
    vec3 sand = mix(vec3(0.945, 0.851, 0.643), vec3(0.722, 0.58, 0.376), smoothstep(-1.0, -70.0, s));
    sand *= 0.88 + 0.22 * fbm(vec2(y, s) * 0.35) + 0.05 * (vn(vec2(y, s) * 9.0) - 0.5);
    float wet = smoothstep(2.4, -1.4, s - edge);
    sand = mix(sand, sand * vec3(0.68, 0.62, 0.55), wet * 0.8);
    vec3 b = mix(col, sand, sandMix);
    float fo = exp(-pow((s - edge - 0.6) / 0.7, 2.0)) * (0.65 + 0.35 * vn(vec2(y * 0.9, uT * 0.5)));
    b = mix(b, vec3(1.0), clamp(fo, 0.0, 0.95));
    col = b;
  }
  float dist = length(uCam - vW);
  col = mix(col, uFogCol, smoothstep(90.0, 260.0, dist) * 0.8);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function makeWater(THREE) {
  const uniforms = {
    uW: { value: Array.from({ length: MAXW }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uBrk: { value: new Array(MAXW).fill(0) },
    uT: { value: 0 }, uD: { value: 104 }, uMineY: { value: 3.5 }, uCurAmp: { value: 0.2 }, uP1: { value: 0 }, uP2: { value: 0 },
    uSun: { value: new THREE.Vector3(-0.45, 0.62, -0.5) }, uCam: { value: new THREE.Vector3() }, uFogCol: { value: new THREE.Color('#a9d8e2') },
  };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(900, 900, 1, 1), mat);
  mesh.rotation.x = -Math.PI / 2; mesh.frustumCulled = false;
  return { mesh, uniforms };
}

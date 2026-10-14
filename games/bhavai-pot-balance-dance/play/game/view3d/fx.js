// Particles for the courtyard: marigold petals thrown on good steps, clay dust and spark puffs when a pot breaks, drifting embers.
// One Points object, per-vertex colour / size / alpha, soft round sprites; simulated with the presentation clock only.
import { THREE } from '../vendor3d/index.js';

const T = THREE;
const N = 360;

export function createFx(scene) {
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N);
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new T.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new T.BufferAttribute(size, 1));
  geo.setAttribute('aAlpha', new T.BufferAttribute(alpha, 1));
  const mat = new T.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uPx: { value: 600 } },
    vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aAlpha; varying vec3 vC; varying float vA; uniform float uPx;
      void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = max(1.0, aSize * uPx / max(0.1, -mv.z)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; float a = smoothstep(1.0, 0.55, r) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC, a); }`,
  });
  const pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 9; scene.add(pts);
  const P = [];
  const api = {
    points: pts, setScale(camera, h) { mat.uniforms.uPx.value = (h * 0.5) / Math.tan((camera.fov * Math.PI) / 360); },
    spawn(p) { if (P.length < N) P.push(p); },
    puff(at, n, colors, speed = 1, sizeM = 0.3) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, s = (0.3 + Math.random()) * speed, c = new T.Color(colors[i % colors.length]);
        api.spawn({ x: at.x, y: at.y, z: at.z, vx: Math.cos(a) * s, vy: 0.3 + Math.random() * s * 0.8, vz: Math.sin(a) * s * 0.7, g: -0.6, drag: 1.6, life: 0.5 + Math.random() * 0.7, age: 0, r: c.r, g_: c.g, b: c.b, size: sizeM * (0.6 + Math.random() * 0.7), grow: 1.8, a0: 0.55 });
      }
    },
    petals(at, n, colors, power = 1) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, s = (0.6 + Math.random() * 1.2) * power, c = new T.Color(colors[i % colors.length]);
        api.spawn({ x: at.x, y: at.y, z: at.z, vx: Math.cos(a) * s * 0.9, vy: 1.4 + Math.random() * 1.8 * power, vz: Math.sin(a) * s * 0.5 + 0.2, g: -2.6, drag: 0.8, life: 0.9 + Math.random() * 0.9, age: 0, r: c.r, g_: c.g, b: c.b, size: 0.05 + Math.random() * 0.045, grow: 1, a0: 1, flutter: Math.random() * 6 });
      }
    },
    sparks(at, n, power = 1) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, s = (1 + Math.random() * 2) * power;
        api.spawn({ x: at.x, y: at.y, z: at.z, vx: Math.cos(a) * s, vy: 1 + Math.random() * 2.2, vz: Math.sin(a) * s * 0.5, g: -6, drag: 0.4, life: 0.35 + Math.random() * 0.4, age: 0, r: 1, g_: 0.82, b: 0.35, size: 0.045, grow: 0.6, a0: 1 });
      }
    },
    event() {},
    update(dt) {
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i]; p.age += dt;
        if (p.age >= p.life) { P.splice(i, 1); continue; }
        p.vy += p.g * dt; const d = Math.exp(-p.drag * dt); p.vx *= d; p.vz *= d; if (p.vy > 0 || p.g > -3) p.vy *= Math.exp(-0.2 * dt);
        if (p.flutter !== undefined) { p.vx += Math.sin(p.age * 9 + p.flutter) * 0.9 * dt; p.vz += Math.cos(p.age * 7 + p.flutter) * 0.5 * dt; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.01) { p.y = 0.01; p.vy = 0; p.vx *= 0.5; p.vz *= 0.5; }
      }
      for (let i = 0; i < N; i++) {
        const p = P[i];
        if (!p) { alpha[i] = 0; size[i] = 0; continue; }
        const u = p.age / p.life;
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        col[i * 3] = p.r; col[i * 3 + 1] = p.g_; col[i * 3 + 2] = p.b;
        size[i] = p.size * (1 + (p.grow - 1) * u); alpha[i] = p.a0 * (1 - u * u);
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.aColor.needsUpdate = true; geo.attributes.aSize.needsUpdate = true; geo.attributes.aAlpha.needsUpdate = true;
    },
  };
  return api;
}

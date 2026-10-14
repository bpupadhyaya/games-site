// Atmosphere and secondary motion for the zurkhaneh: dust that rises from the clay when feet stamp and clubs clash, motes drifting in the
// oculus shaft, the lang (waist cloth) of each athlete, the bell's chime ring. Presentation only.
import { THREE } from '../vendor3d/index.js';
const T = THREE;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function softSprite() {
  const c = globalThis.document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

// ---- dust ---------------------------------------------------------------------------------------------------------------------------
export function createDust(scene, { quality = 'high', floorR = 2.5 } = {}) {
  const N = quality === 'low' ? 90 : 220, M = quality === 'low' ? 24 : 60;     // puffs + ambient motes
  const geo = new T.BufferGeometry();
  const pos = new Float32Array((N + M) * 3), col = new Float32Array((N + M) * 3);
  geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
  const mat = new T.PointsMaterial({ size: 0.34, map: softSprite(), vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true });
  const pts = new T.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  const P = [];                                                              // puff particles: x y z vx vy vz life max
  for (let i = 0; i < N; i++) P.push({ x: 0, y: -9, z: 0, vx: 0, vy: 0, vz: 0, l: 0, m: 1 });
  const mote = []; let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < M; i++) mote.push({ a: rnd() * 6.28, r: Math.sqrt(rnd()) * floorR * 0.85, y: rnd() * 3.4, s: 0.05 + rnd() * 0.08, ph: rnd() * 6 });
  let head = 0;
  return {
    pts,
    puff(x, z, n = 6, power = 1) {
      for (let k = 0; k < n; k++) {
        const p = P[head]; head = (head + 1) % N;
        const a = Math.random() * 6.283, sp = (0.25 + Math.random() * 0.55) * power;
        p.x = x + Math.cos(a) * 0.12; p.z = z + Math.sin(a) * 0.12; p.y = 0.04 + Math.random() * 0.06;
        p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp; p.vy = 0.25 + Math.random() * 0.45; p.l = p.m = 0.9 + Math.random() * 0.8;
      }
    },
    update(dt, clock, calm) {
      for (let i = 0; i < N; i++) {
        const p = P[i];
        if (p.l > 0) { p.l -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= 1 - 2.2 * dt; p.vz *= 1 - 2.2 * dt; p.vy *= 1 - 1.2 * dt; }
        const k = p.l > 0 ? Math.sin(clamp(p.l / p.m, 0, 1) * Math.PI) * 0.34 * (calm ? 0.5 : 1) : 0;
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.l > 0 ? p.y : -9; pos[i * 3 + 2] = p.z;
        col[i * 3] = 0.78 * k; col[i * 3 + 1] = 0.6 * k; col[i * 3 + 2] = 0.4 * k;
      }
      for (let j = 0; j < M; j++) {
        const m = mote[j], i = N + j, a = m.a + clock * m.s * 0.3;
        const y = (m.y + clock * m.s * 0.5) % 3.6;
        pos[i * 3] = Math.cos(a) * m.r; pos[i * 3 + 1] = 0.3 + y; pos[i * 3 + 2] = Math.sin(a) * m.r;
        const tw = (0.5 + 0.5 * Math.sin(clock * 1.3 + m.ph)) * Math.sin((y / 3.6) * Math.PI) * 0.22;
        col[i * 3] = 1 * tw; col[i * 3 + 1] = 0.86 * tw; col[i * 3 + 2] = 0.55 * tw;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    },
  };
}

// ---- the lang: a waist cloth that flares when the athlete spins, drags on a stomp and breathes --------------------------------------
const SEG = 24, RING = 7;
export function createLang(scene, stripes) {
  const geo = new T.BufferGeometry();
  const pos = new Float32Array((RING + 1) * (SEG + 1) * 3), uv = new Float32Array((RING + 1) * (SEG + 1) * 2), idx = [];
  for (let j = 0; j <= RING; j++) for (let i = 0; i <= SEG; i++) { uv[(j * (SEG + 1) + i) * 2] = i / SEG; uv[(j * (SEG + 1) + i) * 2 + 1] = 1 - j / RING; }
  for (let j = 0; j < RING; j++) for (let i = 0; i < SEG; i++) { const a = j * (SEG + 1) + i, b = a + SEG + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setIndex(idx);
  const c = globalThis.document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = stripes[0]; g.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 8; i++) { g.fillStyle = stripes[1]; g.fillRect(i * 16 + 3, 0, 5, 64); g.fillStyle = stripes[2] || stripes[1]; g.fillRect(i * 16 + 10, 0, 2, 64); }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 128, 4); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 60, 128, 4);
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.wrapS = T.RepeatWrapping; tex.anisotropy = 4;
  const mesh = new T.Mesh(geo, new T.MeshStandardMaterial({ map: tex, roughness: 0.85, side: T.DoubleSide }));
  mesh.frustumCulled = false; mesh.castShadow = true; scene.add(mesh);
  return { mesh, geo, pos, ox: 0, oz: 0, vx: 0, vz: 0, lastYaw: null, flare: 0, lastY: null, drop: 0 };
}

// c: world position of the waist, yaw: athlete facing, spin speed (rad/s), t: clock
export function updateLang(L, cx, cy, cz, yaw, dt, t, phase = 0) {
  const d = Math.max(dt, 1 / 120);
  let w = 0; if (L.lastYaw !== null) { let dy = yaw - L.lastYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); w = dy / d; } L.lastYaw = yaw;
  let dropv = 0; if (L.lastY !== null) dropv = (cy - L.lastY) / d; L.lastY = cy;
  const target = clamp(Math.abs(w) / 7, 0, 1);
  L.flare += (target - L.flare) * Math.min(1, d * 7);
  L.drop += (clamp(-dropv * 0.25, -0.3, 0.6) - L.drop) * Math.min(1, d * 14);
  const top = cy + 0.07, len = 0.46;
  for (let j = 0; j <= RING; j++) {
    const k = j / RING, ease = k * k;
    const r = 0.215 + k * 0.075 + 0.014 * Math.sin(0) + (L.flare * 0.34 + Math.max(0, L.drop) * 0.12 + 0.012 * Math.sin(t * 2 + phase)) * ease * 1.15;
    const y = top - len * k * (1 - L.flare * 0.38 * k) - L.drop * 0.05 * k;
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2, wob = 1 + (0.045 * L.flare + 0.012) * Math.sin(a * 5 - t * 7 * (1 + L.flare) + phase) * k;
      const rr = r * wob * (1 + 0.035 * k * Math.sin(a * 7 + phase)), ang = a + yaw;
      const o = (j * (SEG + 1) + i) * 3;
      L.pos[o] = cx + Math.sin(ang) * rr; L.pos[o + 1] = y; L.pos[o + 2] = cz + Math.cos(ang) * rr;
    }
  }
  L.geo.attributes.position.needsUpdate = true; L.geo.computeVertexNormals();
}

// ---- a chime ring from the bell --------------------------------------------------------------------------------------------------
export function createChime(scene) {
  const m = new T.Mesh(new T.RingGeometry(0.9, 1.0, 40), new T.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
  m.rotation.x = -Math.PI / 2; scene.add(m);
  return { m, k: 0, trigger(x, y, z) { this.k = 1; m.position.set(x, y, z); }, update(dt) { this.k = Math.max(0, this.k - dt * 1.6); m.visible = this.k > 0.01; const s = 0.15 + (1 - this.k) * 0.9; m.scale.set(s, s, s); m.material.opacity = this.k * 0.7; } };
}

// Presentation-only effects: dust puffs where a foot lands (pooled billboards, seeded jitter, no Math.random).
import { THREE } from '../vendor3d/index.js';

function puffTexture() {
  const c = globalThis.document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(236,228,214,0.95)'); gr.addColorStop(0.5, 'rgba(226,216,200,0.45)'); gr.addColorStop(1, 'rgba(220,210,195,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createDust(group, N = 28) {
  const tex = puffTexture(), geo = new THREE.PlaneGeometry(1, 1);
  const pool = [];
  for (let i = 0; i < N; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, fog: false }));
    m.visible = false; m.renderOrder = 5; group.add(m);
    pool.push({ m, age: 9, life: 1, vx: 0, vy: 0, vz: 0, s0: 0.1, s1: 0.3, a: 0 });
  }
  let seed = 12345, next = 0;
  const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  return {
    // x,z: ground position; k: strength 0..1 (a bounce is small, a big step or a stumble is larger)
    burst(x, z, k = 0.5) {
      const n = 3 + Math.round(4 * k);
      for (let i = 0; i < n; i++) {
        const p = pool[next++ % N], a = rnd() * Math.PI * 2;
        p.age = 0; p.life = 0.5 + 0.35 * rnd(); p.m.visible = true;
        p.vx = Math.cos(a) * (0.25 + 0.5 * rnd()) * (0.5 + k); p.vz = Math.sin(a) * (0.25 + 0.5 * rnd()) * (0.5 + k); p.vy = 0.12 + 0.2 * rnd();
        p.s0 = 0.06 + 0.04 * rnd(); p.s1 = 0.2 + 0.2 * k + 0.1 * rnd(); p.a = 0.28 + 0.22 * k;
        p.m.position.set(x + p.vx * 0.05, 0.03, z + p.vz * 0.05);
      }
    },
    update(dt, camera) {
      for (const p of pool) {
        if (!p.m.visible) continue;
        p.age += dt;
        if (p.age >= p.life) { p.m.visible = false; continue; }
        const u = p.age / p.life, e = 1 - Math.pow(1 - u, 2);
        p.m.position.x += p.vx * dt * (1 - u); p.m.position.z += p.vz * dt * (1 - u); p.m.position.y += p.vy * dt * (1 - u);
        p.m.scale.setScalar(p.s0 + (p.s1 - p.s0) * e);
        p.m.material.opacity = p.a * (1 - u) * Math.min(1, u * 12);
        p.m.quaternion.copy(camera.quaternion);
      }
    },
    clear() { for (const p of pool) { p.m.visible = false; p.age = 9; } },
  };
}

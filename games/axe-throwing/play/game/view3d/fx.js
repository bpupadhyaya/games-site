// Wood chips, splinters and a puff of sawdust where a blade bites. Chips are small tapered slivers (one instanced mesh, ballistic with a
// floor bounce); every number comes from the event's seed so a replay shows the same spray.
const GRAV = -9.8;

export function makeFx(THREE, parent, { quality = 'high', glowTex = null } = {}) {
  const N = quality === 'low' ? 36 : 90;
  const geo = new THREE.BoxGeometry(1, 0.18, 0.34);
  const mat = new THREE.MeshStandardMaterial({ color: 0xd9ae72, roughness: 0.8, metalness: 0 });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.frustumCulled = false; mesh.castShadow = false; mesh.count = N;
  const col = new THREE.Color();
  const tones = [0xe8c58a, 0xc9965a, 0xf2dcaa, 0xb98550, 0xdcb678];
  const P = Array.from({ length: N }, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0, t: 0, max: 1, s: 0.02 }));
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), PO = new THREE.Vector3(), SC = new THREE.Vector3();
  for (let i = 0; i < N; i++) { M.makeScale(0, 0, 0); mesh.setMatrixAt(i, M); mesh.setColorAt(i, col.setHex(tones[i % tones.length])); }
  parent.add(mesh);
  let seed = 7;
  const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let cursor = 0;

  // puffs: soft sprites that grow and fade
  const puffs = [];
  const sprMat = (c) => new THREE.SpriteMaterial({ map: glowTex, color: c, transparent: true, depthWrite: false, opacity: 0, fog: true });
  for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(sprMat(0xe9d6b0)); s.visible = false; parent.add(s); puffs.push({ s, t: 0, max: 0.7, on: false, x: 0, y: 0, z: 0, size: 0.2, vy: 0.2 }); }
  let pc = 0;

  return {
    burst(x, y, z, n, power = 1, seedIn = 1) {
      seed = (seedIn * 2654435761) | 0;
      for (let i = 0; i < n; i++) {
        const p = P[cursor]; cursor = (cursor + 1) % N;
        const a = rnd() * Math.PI * 2, sp = (0.5 + rnd() * 1.6) * power;
        p.on = true; p.x = x + (rnd() - 0.5) * 0.04; p.y = y + (rnd() - 0.5) * 0.04; p.z = z + 0.02;
        p.vx = Math.cos(a) * sp * 0.8; p.vy = Math.sin(a) * sp * 0.6 + 0.5 * power; p.vz = (0.5 + rnd() * 1.8) * power;
        p.rx = rnd() * 6; p.ry = rnd() * 6; p.rz = rnd() * 6; p.wx = (rnd() - 0.5) * 22; p.wy = (rnd() - 0.5) * 22; p.wz = (rnd() - 0.5) * 22;
        p.t = 0; p.max = 0.7 + rnd() * 0.7; p.s = 0.012 + rnd() * 0.022;
      }
      const q = puffs[pc]; pc = (pc + 1) % puffs.length;
      q.on = true; q.t = 0; q.max = 0.8; q.x = x; q.y = y; q.z = z + 0.05; q.size = 0.16 + 0.1 * power; q.s.visible = true;
    },
    update(dt, floorY = 0.0, tint = 0xe9d6b0) {
      for (let i = 0; i < N; i++) {
        const p = P[i];
        if (!p.on) continue;
        p.t += dt;
        if (p.t >= p.max) { p.on = false; M.makeScale(0, 0, 0); mesh.setMatrixAt(i, M); continue; }
        p.vy += GRAV * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < floorY + 0.01) { p.y = floorY + 0.01; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; p.wx *= 0.5; p.wy *= 0.5; p.wz *= 0.5; }
        p.rx += p.wx * dt; p.ry += p.wy * dt; p.rz += p.wz * dt;
        E.set(p.rx, p.ry, p.rz); Q.setFromEuler(E);
        const k = 1 - Math.max(0, (p.t - p.max * 0.75) / (p.max * 0.25));
        PO.set(p.x, p.y, p.z); SC.set(p.s * 2.6 * k, p.s * k, p.s * k);
        M.compose(PO, Q, SC); mesh.setMatrixAt(i, M);
      }
      mesh.instanceMatrix.needsUpdate = true;
      for (const q of puffs) {
        if (!q.on) continue;
        q.t += dt;
        if (q.t >= q.max) { q.on = false; q.s.visible = false; continue; }
        const u = q.t / q.max;
        q.s.position.set(q.x, q.y + u * 0.12, q.z + u * 0.1);
        q.s.scale.setScalar(q.size * (0.6 + u * 1.5)); q.s.material.opacity = 0.5 * (1 - u) * (1 - u); q.s.material.color.setHex(tint);
      }
    },
    clear() { for (const p of P) p.on = false; for (const q of puffs) { q.on = false; q.s.visible = false; } M.makeScale(0, 0, 0); for (let i = 0; i < N; i++) mesh.setMatrixAt(i, M); mesh.instanceMatrix.needsUpdate = true; },
  };
}

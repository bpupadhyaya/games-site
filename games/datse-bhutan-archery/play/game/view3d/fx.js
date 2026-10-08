// Atmosphere and reactions: wind motes in the air, dust where an arrow lands, falling petals over a celebration, and the people watching along the range.
const lcg = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const cv = (w, h) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };
const soft = (THREE, inner, outer) => { const c = cv(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

export function createFx(THREE, stage) {
  const rand = lcg(2024), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E3 = new THREE.Euler(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), C3 = new THREE.Color();
  // ---- motes: tiny bright specks that drift with the wind around the camera, so the wind is visible in the near picture ------------------------------------------------------------
  const NM = 60, moteData = [];
  const moteTex = soft(THREE, 'rgba(255,250,225,0.95)', 'rgba(255,250,225,0)');
  const motes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: moteTex, transparent: true, depthWrite: false, opacity: 0.55 }), NM);
  for (let i = 0; i < NM; i++) moteData.push({ ox: rand(), oy: rand(), oz: rand(), ph: rand() * 6.28 });
  motes.frustumCulled = false; stage.add(motes);
  // ---- dust puffs ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const dustTex = soft(THREE, 'rgba(190,160,110,0.85)', 'rgba(190,160,110,0)');
  const dusts = Array.from({ length: 14 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; s.userData = { t: 9, big: 1 }; stage.add(s); return s; });
  let dustN = 0;
  const dust = (x, y, z, big = 1) => { const d = dusts[dustN++ % dusts.length]; d.position.set(x, y, z); d.userData = { t: 0, big }; d.visible = true; };
  // ---- petals: orange, white and red petals falling slowly over a celebration -----------------------------------------------------------------------------------------------------------------
  const NP = 90, petalGeo = new THREE.PlaneGeometry(0.1, 0.07), petals = new THREE.InstancedMesh(petalGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: true }), NP);
  const pcols = ['#f08a1c', '#ffd24a', '#f6f1e3', '#c42a1d', '#f08a1c'];
  const pdata = Array.from({ length: NP }, (_, i) => ({ x: 0, y: -5, z: 0, vx: 0, vy: 0, vz: 0, ph: rand() * 6.28, r: rand() * 6.28, alive: false })); pdata.forEach((p, i) => petals.setColorAt(i, C3.set(pcols[i % pcols.length])));
  petals.frustumCulled = false; petals.visible = false; stage.add(petals);
  let petalT = 0;
  const burstPetals = (cx, cz, towardX = 0, towardZ = 0) => { petalT = 6; pdata.forEach((p, i) => { p.x = cx + (rand() - 0.5) * 7; p.z = cz + (rand() - 0.5) * 5; p.y = 3 + rand() * 5; p.vx = (rand() - 0.5) * 0.6 + towardX; p.vz = (rand() - 0.5) * 0.6 + towardZ; p.vy = -0.5 - rand() * 0.6; p.alive = true; }); petals.visible = true; };
  let cheer = { until: -1, z: 0 };
  const cheerAt = (t, z, dur = 3.2) => { cheer = { until: t + dur, z }; };
  const cheering = (t, z) => t < cheer.until && Math.abs(z - cheer.z) < 40;

  function update(dt, t, wind, camPos, groundH, camQ) {
    // motes: one instanced draw, every quad faces the camera
    moteData.forEach((u, i) => {
      u.ox += (wind.x * 0.07 + 0.01 * Math.sin(t * 0.7 + u.ph)) * dt / 12; u.oz += (wind.z * 0.07 + 0.01 * Math.cos(t * 0.6 + u.ph)) * dt / 12; u.oy += 0.006 * Math.sin(t * 0.9 + u.ph) * dt;
      u.ox -= Math.floor(u.ox); u.oz -= Math.floor(u.oz); u.oy -= Math.floor(u.oy);
      const x = camPos.x + (u.ox - 0.5) * 26, y = 0.25 + u.oy * 5.5, z = camPos.z + (u.oz - 0.5) * 36;
      const d = Math.hypot(x - camPos.x, z - camPos.z); P3.set(x, y, z); S3.setScalar((0.035 + d * 0.0035) * Math.min(1, d / 3)); M4.compose(P3, camQ || Q.identity(), S3); motes.setMatrixAt(i, M4);
    });
    motes.instanceMatrix.needsUpdate = true;
    for (const d of dusts) { const u = d.userData; if (u.t > 1.1) { d.visible = false; continue; } u.t += dt; const k = u.t / 1.1; d.scale.setScalar((0.25 + 1.6 * k) * u.big); d.material.opacity = 0.7 * (1 - k) * (1 - k); d.position.y += dt * 0.5; }
    if (petalT > 0) {
      petalT -= dt;
      pdata.forEach((p, i) => { if (!p.alive) return; p.x += (p.vx + Math.sin(t * 1.6 + p.ph) * 0.5 + wind.x * 0.1) * dt; p.z += (p.vz + Math.cos(t * 1.3 + p.ph) * 0.5 + wind.z * 0.1) * dt; p.y += p.vy * dt; if (p.y < 0.03) { p.y = 0.03; p.vy = 0; p.vx *= 0.3; p.vz *= 0.3; }
        E3.set(t * 2 + p.r, t * 1.5 + p.ph, p.r); Q.setFromEuler(E3); P3.set(p.x, p.y, p.z); S3.setScalar(p.y <= 0.04 && petalT < 1 ? Math.max(0, petalT) : 1); M4.compose(P3, Q, S3); petals.setMatrixAt(i, M4); });
      petals.instanceMatrix.needsUpdate = true; if (petalT <= 0) petals.visible = false;
    }
  }
  return { update, dust, burstPetals, cheerAt, cheering, petals, motes };
}

// The sea floor and the water column: sand ripples, rocks, coral, weed, oyster beds, light shafts, caustics, bubbles and fish. Presentation only; built once with fixed seeds.
import { lcg, sm, mix, fbm, mergeInto, mat4, hex, soft } from './world.js';

const canvasOf = (w, h) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };
const TAU = Math.PI * 2;

function causticTexture(THREE) {
  const N = 256, c = canvasOf(N, N), g = c.getContext('2d'), img = g.createImageData(N, N), r = lcg(404), pts = [];
  for (let i = 0; i < 26; i++) pts.push([r() * N, r() * N]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let d1 = 1e9, d2 = 1e9;
    for (const [px, py] of pts) for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { const d = Math.hypot(x - px - ox, y - py - oy); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    const e = Math.max(0, 1 - (d2 - d1) / 12), v = Math.pow(e, 2.4) * 255, k = (y * N + x) * 4;
    img.data[k] = v; img.data[k + 1] = v; img.data[k + 2] = v; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function shaftTexture(THREE) {
  const c = canvasOf(64, 256), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(255,255,230,0.95)'); gr.addColorStop(0.5, 'rgba(255,255,230,0.35)'); gr.addColorStop(1, 'rgba(255,255,230,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = h; g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const col3 = (THREE, c, k = 1) => { const q = hex(THREE, c); return [q[0] * k, q[1] * k, q[2] * k]; };

export function buildUnder(THREE, tier) {
  const root = new THREE.Group(), rand = lcg(913);
  const floor = new THREE.Group(); root.add(floor);       // positioned at y = -depth
  // ---- the floor: ripples and low dunes in warm sand ---------------------------------------------------------------------------------------------------------------
  const W = 70, D = 46, NX = tier === 'low' ? 60 : 110, NZ = tier === 'low' ? 36 : 70;
  const pos = new Float32Array((NX + 1) * (NZ + 1) * 3), col = new Float32Array((NX + 1) * (NZ + 1) * 3), idx = [];
  const sand = new THREE.Color('#d9bf8e'), dark = new THREE.Color('#b19366'), pale = new THREE.Color('#ecd9ab'), c = new THREE.Color();
  const floorH = (x, z) => 0.5 * (fbm(x * 0.07 + 3, z * 0.07, 3) - 0.5) + 0.05 * Math.sin(x * 2.1 + 3 * fbm(x * 0.2, z * 0.2, 2) * 6 + z * 0.4) + 0.025 * Math.sin(z * 3.3 + x * 0.6);
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const x = (i / NX - 0.5) * W, z = (j / NZ - 0.62) * D, k = (j * (NX + 1) + i) * 3, h = floorH(x, z);
    pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
    c.copy(sand).lerp(dark, sm(0.35, 0.75, fbm(x * 0.2, z * 0.2, 3))).lerp(pale, 0.5 * sm(0.55, 0.8, fbm(x * 0.5 + 9, z * 0.5, 2)) + 0.4 * (Math.sin(x * 2.1 + z * 0.4) * 0.5 + 0.5) * 0.15);
    col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
  }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, cc = a + NX + 1, d = cc + 1; idx.push(a, cc, b, b, cc, d); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); fg.setAttribute('color', new THREE.BufferAttribute(col, 3)); fg.setIndex(idx); fg.computeVertexNormals();
  const floorMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const floorMesh = new THREE.Mesh(fg, floorMat); floorMesh.receiveShadow = true; floor.add(floorMesh);
  // ---- rocks, coral and weed, merged into a few meshes ------------------------------------------------------------------------------------------------------------------------------------
  const rocks = [], coral = [], weeds = [];
  const place = (n, f) => { for (let i = 0, t = 0; i < n && t < n * 8; t++) { const x = (rand() - 0.5) * W * 0.9, z = (rand() - 0.7) * D * 0.7; if (Math.abs(z) < 2.4 && Math.abs(x) < 11) continue; f(x, z, floorH(x, z), i); i++; } };
  place(tier === 'low' ? 18 : 34, (x, z, y) => { const s = 0.4 + rand() * 1.6; const g = new THREE.SphereGeometry(1, 8, 6); const p = g.attributes.position; for (let q = 0; q < p.count; q++) { const f = 1 + 0.28 * Math.sin(q * 12.9898) * Math.cos(q * 4.1); p.setXYZ(q, p.getX(q) * f, p.getY(q) * f * 0.7, p.getZ(q) * f); } g.computeVertexNormals(); const k = 0.55 + rand() * 0.25; rocks.push({ geo: g, matrix: mat4(THREE, x, y + s * 0.12, z, s * 1.3, s * 0.8, s, rand() * 6), color: [0.42 * k + 0.08, 0.4 * k + 0.07, 0.36 * k + 0.05] }); });
  const CORALS = ['#e86a5a', '#f0a14a', '#c0508a', '#8a5ac0', '#f3d27a', '#e9e2d0'];
  place(tier === 'low' ? 24 : 60, (x, z, y, i) => {
    const colr = col3(THREE, CORALS[i % CORALS.length]), br = 3 + Math.floor(rand() * 4), s = 0.6 + rand() * 1.1;
    for (let b = 0; b < br; b++) { const a = (b / br) * TAU + rand(), tilt = 0.25 + rand() * 0.5, h = (0.5 + rand() * 0.9) * s; const g = new THREE.CylinderGeometry(0.035 * s, 0.1 * s, h, 6, 1); g.translate(0, h / 2, 0); coral.push({ geo: g, matrix: mat4(THREE, x, y - 0.05, z, 1, 1, 1, a, tilt, 0), color: colr }); const g2 = new THREE.SphereGeometry(0.075 * s, 6, 5); coral.push({ geo: g2, matrix: mat4(THREE, x + Math.sin(a) * Math.sin(tilt) * h, y - 0.05 + Math.cos(tilt) * h, z + Math.cos(a) * Math.sin(tilt) * h, 1, 1, 1), color: colr.map((v) => Math.min(1, v * 1.2)) }); }
  });
  place(tier === 'low' ? 40 : 110, (x, z, y) => { const n = 3 + Math.floor(rand() * 3), k = 0.8 + rand() * 0.5; for (let b = 0; b < n; b++) { const g = new THREE.BoxGeometry(0.06, 1, 0.01); g.translate(0, 0.5, 0); weeds.push({ geo: g, matrix: mat4(THREE, x + (rand() - 0.5) * 0.3, y, z + (rand() - 0.5) * 0.3, 1, (0.5 + rand() * 0.9) * k, 1, rand() * 6, (rand() - 0.5) * 0.3, 0), color: col3(THREE, rand() > 0.5 ? '#3f9a5a' : '#6aae4a', 0.9 + rand() * 0.3) }); } });
  const solid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const rockM = new THREE.Mesh(mergeInto(THREE, rocks), solid); rockM.castShadow = true; floor.add(rockM);
  floor.add(new THREE.Mesh(mergeInto(THREE, coral), solid));
  floor.add(new THREE.Mesh(mergeInto(THREE, weeds), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide })));
  // ---- the oyster beds (rebuilt per dive) -------------------------------------------------------------------------------------------------------------------------------------------------
  const beds = new THREE.Group(); floor.add(beds); let bedMeshes = [];
  const shellGeo = (old) => {
    const lower = new THREE.SphereGeometry(0.23, 12, 8), up = new THREE.SphereGeometry(0.23, 12, 8, 0, TAU, 0, Math.PI / 2), parts = [];
    const outer = old ? col3(THREE, '#b9ac8c') : col3(THREE, '#5a5a48'), inner = col3(THREE, '#e8e2ee'), ridge = old ? col3(THREE, '#cfc3a4') : col3(THREE, '#6d6c56');
    parts.push({ geo: lower, matrix: mat4(THREE, 0, 0.06, 0, 1, 0.34, 0.84), color: outer });
    parts.push({ geo: new THREE.SphereGeometry(0.17, 10, 6), matrix: mat4(THREE, 0, 0.12, 0, 1, 0.12, 0.8), color: inner });
    parts.push({ geo: up, matrix: mat4(THREE, 0, 0.14, 0, 1, 0.3, 0.84, 0, 0.12, 0), color: ridge });
    if (old) for (let i = 0; i < 6; i++) parts.push({ geo: new THREE.SphereGeometry(0.03 + 0.02 * rand(), 5, 4), matrix: mat4(THREE, (rand() - 0.5) * 0.3, 0.2 + rand() * 0.04, (rand() - 0.5) * 0.2), color: col3(THREE, '#efe8d4') });
    return mergeInto(THREE, parts);
  };
  const geoNew = shellGeo(false), geoOld = shellGeo(true), shellMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
  const glintTex = soft(THREE, 'rgba(255,248,210,0.95)', 'rgba(255,240,170,0)', 64);
  function setBeds(list) {
    for (const m of bedMeshes) beds.remove(m.g);
    bedMeshes = (list || []).map((b) => {
      const g = new THREE.Group(), shells = [], zr = ((b.id * 37) % 7 - 3) * 0.2;
      for (let k = 0; k < b.n; k++) { const m = new THREE.Mesh(b.old ? geoOld : geoNew, shellMat); const a = (k / b.n) * TAU + b.id; m.position.set(Math.cos(a) * 0.3 * (b.n > 1 ? 1 : 0), floorH(b.x, zr) , Math.sin(a) * 0.26 * (b.n > 1 ? 1 : 0)); m.rotation.y = a * 1.7 + b.id; m.scale.setScalar(b.old ? 1.2 : 1); m.castShadow = true; g.add(m); shells.push(m); }
      g.position.set(b.x, 0, zr);
      let glint = null; if (b.old) { glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); glint.scale.set(1.4, 1.4, 1); glint.position.y = floorH(b.x, zr) + 0.3; g.add(glint); }
      beds.add(g); return { g, shells, glint, b };
    });
  }
  function syncBeds(list, t) {
    bedMeshes.forEach((m, i) => { const b = list[i]; if (!b) return; m.shells.forEach((s, k) => { s.visible = k < b.left; }); if (m.glint) { m.glint.visible = b.left > 0; m.glint.material.opacity = 0.55 + 0.35 * Math.sin(t * 3 + i); } });
  }
  // ---- the water column: light shafts, caustics, floating specks ------------------------------------------------------------------------------------------------------------------------
  const shaftTex = shaftTexture(THREE), shafts = [];
  const NSH = tier === 'low' ? 4 : 8;
  for (let i = 0; i < NSH; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(3 + rand() * 3, 1), new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); m.userData = { x: (i / NSH - 0.5) * 30 + (rand() - 0.5) * 3, z: -4 - rand() * 7, ph: rand() * TAU, tilt: 0.2 + rand() * 0.18 }; root.add(m); shafts.push(m); }
  const caus = causticTexture(THREE), cmat = () => new THREE.MeshBasicMaterial({ map: caus.clone(), color: 0xbfffe8, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  for (const m of []) void m;
  const c1 = new THREE.Mesh(new THREE.PlaneGeometry(W, D), cmat()), c2 = new THREE.Mesh(new THREE.PlaneGeometry(W, D), cmat());
  for (const cm of [c1, c2]) { cm.material.map.needsUpdate = true; cm.material.map.wrapS = cm.material.map.wrapT = THREE.RepeatWrapping; cm.material.map.repeat.set(13, 9); cm.rotation.x = -Math.PI / 2; cm.position.set(0, 0.1, -D * 0.12); floor.add(cm); }
  c2.material.opacity = 0.12; c2.position.y = 0.12;
  const NB = tier === 'low' ? 24 : 48, bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xe8fffb, transparent: true, opacity: 0.55, depthWrite: false }), NB);
  bubbles.frustumCulled = false; root.add(bubbles);
  const NSP = tier === 'low' ? 30 : 80, specks = new THREE.InstancedMesh(new THREE.SphereGeometry(0.025, 4, 3), new THREE.MeshBasicMaterial({ color: 0xdffff2, transparent: true, opacity: 0.5, depthWrite: false }), NSP); specks.frustumCulled = false; root.add(specks);
  const sdata = Array.from({ length: NSP }, () => ({ x: (rand() - 0.5) * 24, y: rand(), z: -8 + rand() * 12, p: rand() * TAU }));
  // fish: two schools
  const fishes = [], fishGeo = new THREE.SphereGeometry(1, 8, 6);
  const mkSchool = (n, color, rad, cx, cz, y0, sp) => { const m = new THREE.InstancedMesh(fishGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 }), n); m.frustumCulled = false; root.add(m); fishes.push({ m, n, rad, cx, cz, y0, sp, ph: Array.from({ length: n }, () => rand() * TAU) }); };
  mkSchool(tier === 'low' ? 6 : 14, 0xd9e6ea, 7, 4, -9, 0.55, 0.35); mkSchool(tier === 'low' ? 4 : 8, 0xf2c84a, 5, -7, -7, 0.3, 0.45);
  // ---- the ropes: the descent rope and the lifeline ---------------------------------------------------------------------------------------------------------------------------------------
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xe6d6a2, roughness: 0.9 }), ropeG = new THREE.CylinderGeometry(0.028, 0.028, 1, 5); ropeG.translate(0, 0.5, 0);
  const descent = new THREE.Mesh(ropeG, ropeMat), stone = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: 0x808684, roughness: 0.95 })); stone.scale.y = 0.8; root.add(descent, stone);
  const NL = 14, life = new THREE.InstancedMesh(ropeG, ropeMat, NL); life.frustumCulled = false; root.add(life);
  const hullMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.9 })); hullMesh.visible = false; root.add(hullMesh);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), A = new THREE.Vector3(), B = new THREE.Vector3(), Dv = new THREE.Vector3(), E = new THREE.Euler();
  let depthNow = 0;
  function setDepth(d, mood) {
    depthNow = d; floor.position.y = -d;
    const deepK = sm(5, 18, d);
    floorMat.color.setRGB(1 - 0.35 * deepK, 1 - 0.18 * deepK, 1 - 0.05 * deepK);
    const hh = d + 3; for (const m of shafts) { m.scale.y = hh; m.position.y = -hh / 2 + 0.2; m.userData.hh = hh; }
    void mood;
  }
  const seg = (i, a, b, r) => { Dv.subVectors(b, a); const len = Dv.length() || 1e-3; Q.setFromUnitVectors(UP, Dv.multiplyScalar(1 / len)); S.set(r / 0.028, len, r / 0.028); M4.compose(a, Q, S); life.setMatrixAt(i, M4); };
  // update: t = animation clock; dv = { x, y (depth, positive down), head: Vector3 (world), waist: Vector3, slack 0..1, phase }
  function update(t, dt, dv, camPos) {
    for (const [i, m] of shafts.entries()) { const u = m.userData; m.position.x = u.x + Math.sin(t * 0.2 + u.ph) * 1.2; m.position.z = u.z; m.rotation.set(0, 0, u.tilt + 0.05 * Math.sin(t * 0.3 + u.ph)); m.material.opacity = 0.12 + 0.07 * (0.5 + 0.5 * Math.sin(t * 0.7 + i)); m.lookAt(camPos.x, m.position.y, camPos.z); m.rotateZ(u.tilt); }
    c1.material.map.offset.set(t * 0.012, t * 0.008); c2.material.map.offset.set(-t * 0.009, t * 0.011);
    // bubbles streaming from the diver's mouth
    for (let i = 0; i < NB; i++) { const age = ((t * 0.5 + i / NB) % 1), y = dv.head.y + age * (3.5 + 3 * ((i * 7) % 3) / 3), x = dv.head.x + Math.sin(t * 2 + i * 1.7) * 0.12 * (0.4 + age * 2), z = dv.head.z + Math.cos(t * 1.6 + i * 2.3) * 0.08;
      const r = (0.03 + 0.05 * ((i * 13) % 5) / 5) * (0.6 + age), vis = dv.on && y < -0.05 ? 1 : 0; P.set(x, y, z); S.setScalar(r * vis); Q.identity(); M4.compose(P, Q, S); bubbles.setMatrixAt(i, M4); }
    bubbles.instanceMatrix.needsUpdate = true;
    sdata.forEach((s, i) => { const x = s.x + Math.sin(t * 0.2 + s.p) * 0.6, y = -depthNow + 0.4 + ((s.y + t * 0.012 * (1 + (i % 3))) % 1) * (depthNow - 0.3), z = s.z + Math.cos(t * 0.17 + s.p) * 0.5; P.set(x, y, z); S.setScalar(1 + 0.6 * Math.sin(t + i)); M4.compose(P, Q, S); specks.setMatrixAt(i, M4); });
    specks.instanceMatrix.needsUpdate = true;
    for (const f of fishes) {
      for (let i = 0; i < f.n; i++) { const a = t * f.sp * 0.5 + f.ph[i] * 0.18 + i * 0.07, rr = f.rad + Math.sin(f.ph[i] + t * 0.3) * 1.2, x = f.cx + Math.cos(a) * rr, z = f.cz + Math.sin(a) * rr * 0.5, y = -depthNow + f.y0 * depthNow * 0.5 + 1.2 + Math.sin(t * 0.7 + f.ph[i]) * 0.3 + (i % 3) * 0.2;
        E.set(0, -a + Math.PI, 0.1 * Math.sin(t * 6 + f.ph[i]), 'YXZ'); Q.setFromEuler(E); P.set(x, y, z); S.set(0.32, 0.11, 0.07); M4.compose(P, Q, S); f.m.setMatrixAt(i, M4); }
      f.m.instanceMatrix.needsUpdate = true;
    }
    // the ropes
    const top = A.set(0, 0.35, 0.02), stoneY = dv.stoneY;
    descent.position.set(0, stoneY, 0); descent.scale.set(1, 0.35 - stoneY, 1); stone.position.set(0, stoneY - 0.1, 0);
    const wst = dv.waist, topL = B.set(0.12, 0.35, 0.03);
    for (let i = 0; i < NL; i++) { const u0 = i / NL, u1 = (i + 1) / NL, sag = dv.slack * Math.min(2.2, depthNow * 0.2 + 0.4);
      const p0 = new THREE.Vector3().lerpVectors(topL, wst, u0), p1 = new THREE.Vector3().lerpVectors(topL, wst, u1);
      p0.y -= sag * 4 * u0 * (1 - u0) * (1 - u0); p1.y -= sag * 4 * u1 * (1 - u1) * (1 - u1); p0.x += dv.slack * 0.6 * Math.sin(Math.PI * u0); p1.x += dv.slack * 0.6 * Math.sin(Math.PI * u1); seg(i, p0, p1, 0.026); }
    life.instanceMatrix.needsUpdate = true;
    syncBeds(dv.beds || [], t); void top;
  }
  return { root, floor, setBeds, setDepth, update, hullMesh, floorH, floorMat };
}

// The log pond in 3D: water with moving ripples and foam, the spinning log (bark, paint spirals, end grain), a bank with trees, reeds, a
// small crowd on a landing stage, hills and a sky per venue. World: metres, x along the log (player at -x, rival at +x), y up, the camera
// looks along -z from +z. Everything here is display only; the presenter calls update() with the sim state.
export const U = 190;                    // scene units (sim art space) per metre
export const LOG_R = 0.31, LOG_LEN = 3.75, LOG_CY = 0.05;
export const TOP = LOG_CY + LOG_R;       // y of the top of the log

const TAU = Math.PI * 2;
const clampU = (u) => Math.min(1, Math.max(0, u));
const hash = (i) => { let h = Math.imul(i | 0, 2654435761) ^ 0x9e3779b9; h = Math.imul(h ^ (h >>> 15), 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296; };

function canvasTex(THREE, w, h, draw, { repeat = null, srgb = true, aniso = 8 } = {}) {
  const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso;
  return t;
}

// per-venue look: sky gradient, water colours, light preset, fog, which bank props to show
export const LOOKS3D = [
  { key: 'pond', sky: ['#6f90c8', '#f3b9a2', '#ffe3bd'], water: ['#5fb0c8', '#1f6f8e'], fog: 0xf0cdb0, fogNear: 14, fogFar: 62, light: 'evening', hemi: 0.95, keyI: 2.9, keyCol: 0xffd2a0, sun: [-6, 7, 9], exposure: 1.02, hills: ['#8fa0b6', '#5f7d70'], foliage: ['#3c5d45', '#4a6f50', '#35523f'] },
  { key: 'river', sky: ['#3f93df', '#8ec9f2', '#e2f3fb'], water: ['#4fa5c4', '#1f6482'], fog: 0xd3e8f2, fogNear: 16, fogFar: 70, light: 'day', hemi: 1.0, keyI: 3.1, keyCol: 0xfff3dc, sun: [4, 11, 8], exposure: 1.0, hills: ['#86a2b8', '#4f7a62'], foliage: ['#2f6a3c', '#3c7a46', '#2a5a35'] },
  { key: 'lake', sky: ['#1e1b4d', '#7a3d78', '#f39a5e'], water: ['#7a5a98', '#1b2050'], fog: 0x9a6a86, fogNear: 12, fogFar: 56, light: 'evening', hemi: 0.62, keyI: 2.0, keyCol: 0xffb77a, sun: [10, 4, 6], exposure: 1.0, hills: ['#52406e', '#2f2a56'], foliage: ['#242a4a', '#2c2e54', '#1c2240'] },
  { key: 'rapids', sky: ['#59636f', '#8b97a3', '#c2ccd3'], water: ['#6d8d99', '#27424e'], fog: 0xa9b6bd, fogNear: 9, fogFar: 46, light: 'day', hemi: 0.95, keyI: 1.7, keyCol: 0xe8f2f8, sun: [0, 10, 7], exposure: 0.98, hills: ['#7d8c94', '#44594f'], foliage: ['#2c4638', '#35523f', '#26402f'] },
];

export function buildScene(stage, THREE, opts = {}) {
  const quality = opts.quality || 'high';
  const scene = stage.scene;
  const root = new THREE.Group(); scene.add(root);
  const low = quality === 'low';
  const aniso = low ? 2 : 8;

  // ---- sky (a gradient behind everything; rebuilt per venue) --------------------------------------------------------------------------------
  const skyTex = {};
  const skyFor = (L) => skyTex[L.key] || (skyTex[L.key] = canvasTex(THREE, 8, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, L.sky[0]); gr.addColorStop(0.5, L.sky[1]); gr.addColorStop(0.95, L.sky[2]); gr.addColorStop(1, L.sky[2]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }));

  // ---- water: a lit plane with a tileable ripple texture that slides, a second layer of glints, foam around the log -------------------------
  const rippleTex = (seed, bright) => canvasTex(THREE, 512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.lineCap = 'round';
    if (!bright) { // broad soft swells so the water is never one flat tone
      for (let i = 0; i < 46; i++) {
        const x = hash(i * 11 + 5) * w, y = hash(i * 11 + 6) * h, r = 40 + hash(i * 11 + 7) * 90, d = hash(i * 11 + 8) > 0.5;
        for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
          const gr = g.createRadialGradient(x + ox, y + oy, 2, x + ox, y + oy, r);
          gr.addColorStop(0, d ? 'rgba(0,25,45,0.20)' : 'rgba(210,240,255,0.20)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
        }
      }
    }
    for (let i = 0; i < (bright ? 260 : 190); i++) {
      const x = hash(i * 7 + seed) * w, y = hash(i * 7 + 1 + seed) * h, len = 18 + hash(i * 7 + 2 + seed) * 70, a = 0.05 + hash(i * 7 + 3 + seed) * 0.16;
      g.strokeStyle = bright ? `rgba(255,255,255,${a * 1.3})` : `rgba(6,30,50,${a * 0.9})`; g.lineWidth = 1 + hash(i * 7 + 4 + seed) * 2.6;
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
        g.beginPath(); g.moveTo(x + ox - len / 2, y + oy); g.quadraticCurveTo(x + ox, y + oy - 2 - hash(i + seed) * 3, x + ox + len / 2, y + oy); g.stroke();
      }
    }
  }, { repeat: [14, 10], aniso });
  const waterGeo = new THREE.PlaneGeometry(260, 160);
  const waterMat = new THREE.MeshStandardMaterial({ color: '#4a8aa8', roughness: 0.34, metalness: 0.0, map: rippleTex(1, false), emissive: '#3a7090', emissiveIntensity: 0.55 });
  const water = new THREE.Mesh(waterGeo, waterMat); water.rotation.x = -Math.PI / 2; water.position.set(0, 0, -50); water.receiveShadow = true; root.add(water);
  const glintTex = rippleTex(77, true);
  const glint = new THREE.Mesh(waterGeo, new THREE.MeshBasicMaterial({ map: glintTex, transparent: true, depthWrite: false, opacity: 0.8, fog: true }));
  glint.rotation.x = -Math.PI / 2; glint.position.set(0, 0.004, -50); root.add(glint);
  // a soft sheen band: reflected sky light on the water, brighter toward the horizon (fake fresnel)
  const sheenTex = canvasTex(THREE, 8, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const sheen = new THREE.Mesh(new THREE.PlaneGeometry(260, 60), new THREE.MeshBasicMaterial({ map: sheenTex, transparent: true, depthWrite: false, opacity: 0.55, color: '#ffffff' }));
  sheen.rotation.x = -Math.PI / 2; sheen.position.set(0, 0.006, -26); root.add(sheen);

  // foam collar on the waterline of the log + the shadow of the log on the water
  const foamTex = canvasTex(THREE, 512, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    g.clearRect(0, 0, w, h);
    g.save(); g.translate(0, 0);
    for (let i = 0; i < 520; i++) {
      const u = hash(i * 5), v = hash(i * 5 + 1), r = 2 + hash(i * 5 + 2) * 6;
      const x = w * (0.04 + u * 0.92), cy = h / 2, dy = (v - 0.5) * h * 0.78 * (0.35 + 0.65 * Math.sin(Math.PI * u));
      g.fillStyle = `rgba(255,255,255,${0.14 + hash(i * 5 + 3) * 0.4})`; g.beginPath(); g.ellipse(x, cy + dy, r * 1.6, r, 0, 0, TAU); g.fill();
    }
    g.restore(); void gr;
  });
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(LOG_LEN + 0.7, 1.05), new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, depthWrite: false, opacity: 0.85 }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.012, 0); root.add(foam);
  const shadowTex = canvasTex(THREE, 128, 64, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(0,10,20,0.55)'); r.addColorStop(1, 'rgba(0,10,20,0)'); g.setTransform(1, 0, 0, 0.5, 0, h / 4); g.fillStyle = r; g.fillRect(0, 0, w, h * 2); });
  const logShadow = new THREE.Mesh(new THREE.PlaneGeometry(LOG_LEN + 1.2, 1.5), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  logShadow.rotation.x = -Math.PI / 2; logShadow.position.set(0.1, 0.008, 0.12); root.add(logShadow);

  // ---- the log ---------------------------------------------------------------------------------------------------------------------------
  const barkTex = canvasTex(THREE, 512, 1024, (g, w, h) => {
    // u (horizontal) runs round the log, v (vertical) along it. Warm bark with long grooves, then two paint spirals.
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#9a6a38'); gr.addColorStop(0.5, '#b88448'); gr.addColorStop(1, '#9a6a38');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = hash(i * 3) * w, len = 140 + hash(i * 3 + 1) * 520, y = hash(i * 3 + 2) * h, a = 0.18 + hash(i) * 0.3;
      g.strokeStyle = `rgba(48,26,10,${a})`; g.lineWidth = 1.5 + hash(i + 9) * 4;
      for (const oy of [-h, 0, h]) { g.beginPath(); g.moveTo(x, y + oy); g.bezierCurveTo(x + 4, y + oy + len * 0.3, x - 5, y + oy + len * 0.7, x + 2, y + oy + len); g.stroke(); }
    }
    for (let i = 0; i < 1100; i++) { g.fillStyle = `rgba(${hash(i) > 0.5 ? '255,226,170' : '40,20,6'},${0.05 + hash(i + 4) * 0.12})`; g.fillRect(hash(i * 2 + 1) * w, hash(i * 2 + 3) * h, 2 + hash(i) * 5, 3 + hash(i + 7) * 14); }
    // spiral stripes: a band that crosses the whole circumference while it travels `pitch` px along the log
    const band = (off, col, bw) => {
      g.fillStyle = col;
      const pitch = h * 0.5;
      for (let k = -1; k <= 1; k++) {
        g.beginPath();
        g.moveTo(0, off + k * h * 1 - 0); g.lineTo(w, off + k * h * 1 + pitch); g.lineTo(w, off + k * h * 1 + pitch + bw); g.lineTo(0, off + k * h * 1 + bw); g.closePath(); g.fill();
        g.beginPath();
        g.moveTo(0, off + k * h * 1 - pitch); g.lineTo(w, off + k * h * 1); g.lineTo(w, off + k * h * 1 + bw); g.lineTo(0, off + k * h * 1 - pitch + bw); g.closePath(); g.fill();
      }
    };
    band(40, 'rgba(244,232,206,0.96)', 70); band(h * 0.25 + 40 + 20, 'rgba(188,44,36,0.96)', 70);
    band(h * 0.5 + 40, 'rgba(244,232,206,0.96)', 70); band(h * 0.75 + 60, 'rgba(188,44,36,0.96)', 70);
  }, { repeat: [1, 1], aniso });
  barkTex.wrapS = barkTex.wrapT = THREE.RepeatWrapping;
  const logGeo = new THREE.CylinderGeometry(LOG_R, LOG_R, LOG_LEN, 56, 1, true);
  logGeo.rotateZ(Math.PI / 2);                    // axis along x
  const logMat = new THREE.MeshStandardMaterial({ map: barkTex, roughness: 0.78, metalness: 0.0 });
  const logGroup = new THREE.Group(); logGroup.position.set(0, LOG_CY, 0); root.add(logGroup);
  const logBody = new THREE.Mesh(logGeo, logMat); logBody.castShadow = true; logBody.receiveShadow = true; logGroup.add(logBody);
  const grainTex = canvasTex(THREE, 256, 256, (g, w, h) => {
    g.fillStyle = '#e3bf86'; g.fillRect(0, 0, w, h);
    for (let r = 120; r > 4; r -= 7 + (r % 3)) { g.strokeStyle = `rgba(110,70,30,${0.25 + 0.2 * hash(r)})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(w / 2 + (hash(r) - 0.5) * 6, h / 2 + (hash(r + 3) - 0.5) * 6, r, r * 0.97, 0, 0, TAU); g.stroke(); }
    g.strokeStyle = 'rgba(80,40,10,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w * 0.9, h * 0.35); g.stroke();
    g.fillStyle = 'rgba(90,50,20,0.55)'; g.beginPath(); g.arc(w / 2, h / 2, 5, 0, TAU); g.fill();
  });
  const capMat = new THREE.MeshStandardMaterial({ map: grainTex, roughness: 0.85 });
  for (const sgn of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(LOG_R * 0.995, 40), capMat);
    cap.position.x = sgn * LOG_LEN / 2; cap.rotation.y = sgn * Math.PI / 2; logGroup.add(cap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(LOG_R * 0.99, 0.012, 8, 40), new THREE.MeshStandardMaterial({ color: '#6a4422', roughness: 0.9 }));
    ring.position.x = sgn * LOG_LEN / 2; ring.rotation.y = Math.PI / 2; logGroup.add(ring);
  }
  // wet band: where the log is in the water it is darker
  const wetMat = new THREE.MeshBasicMaterial({ color: '#2a1608', transparent: true, opacity: 0.0 });
  void wetMat;

  // ---- bank (far side of the pond): ground strip, reeds, trees, a landing stage with spectators ----------------------------------------
  const bankGroup = new THREE.Group(); root.add(bankGroup);
  const bankMat = new THREE.MeshStandardMaterial({ color: '#3d5a38', roughness: 1 });
  const bank = new THREE.Mesh(new THREE.BoxGeometry(260, 1.2, 14), bankMat); bank.position.set(0, -0.35, -22); bank.receiveShadow = true; bankGroup.add(bank);
  const bankTop = new THREE.Mesh(new THREE.PlaneGeometry(260, 30), new THREE.MeshStandardMaterial({ color: '#3f6a3a', roughness: 1 }));
  bankTop.rotation.x = -Math.PI / 2; bankTop.position.set(0, 0.26, -36); bankGroup.add(bankTop);
  const bankMats = [bankMat, bankTop.material];

  const treeGeoms = {
    pine: new THREE.CylinderGeometry(0, 1.0, 3.8, 9),
    round: new THREE.SphereGeometry(1.2, 10, 8),
    trunk: new THREE.CylinderGeometry(0.12, 0.17, 1.6, 6),
  };
  const treeMats = [];
  const MAXT = 70;
  const trunks = new THREE.InstancedMesh(treeGeoms.trunk, new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 1 }), MAXT);
  const crowns = new THREE.InstancedMesh(treeGeoms.pine, new THREE.MeshStandardMaterial({ roughness: 0.95 }), MAXT);
  const crowns2 = new THREE.InstancedMesh(treeGeoms.pine, new THREE.MeshStandardMaterial({ roughness: 0.95 }), MAXT);
  const rounds = new THREE.InstancedMesh(treeGeoms.round, new THREE.MeshStandardMaterial({ roughness: 0.95 }), MAXT);
  for (const m of [trunks, crowns, crowns2, rounds]) { m.frustumCulled = false; bankGroup.add(m); }
  treeMats.push(crowns.material, crowns2.material, rounds.material);
  const trees = [];
  for (let i = 0; i < MAXT; i++) {
    const x = -48 + i * 1.45 + (hash(i) - 0.5) * 1.2, row = i % 3;
    trees.push({ x: x * 0.75, z: -19 - row * 5.5 - hash(i + 3) * 2.5, s: 0.55 + hash(i + 8) * 0.7, pine: hash(i + 15) > 0.42, k: Math.floor(hash(i + 21) * 3) });
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  function placeTrees(L) {
    trees.forEach((t, i) => {
      const base = 0.26 + 0.0;
      _m.compose(_p.set(t.x, base + 0.8 * t.s, t.z), _q.identity(), _s.set(t.s, t.s, t.s)); trunks.setMatrixAt(i, _m);
      if (t.pine) {
        _m.compose(_p.set(t.x, base + 1.9 * t.s + 1.0 * t.s, t.z), _q.identity(), _s.set(1.15 * t.s, 1.0 * t.s, 1.15 * t.s)); crowns.setMatrixAt(i, _m);
        _m.compose(_p.set(t.x, base + 3.3 * t.s + 1.0 * t.s, t.z), _q.identity(), _s.set(0.8 * t.s, 0.8 * t.s, 0.8 * t.s)); crowns2.setMatrixAt(i, _m);
        _m.compose(_p.set(t.x, -9, t.z), _q.identity(), _s.set(0.001, 0.001, 0.001)); rounds.setMatrixAt(i, _m);
      } else {
        _m.compose(_p.set(t.x, base + 2.4 * t.s, t.z), _q.identity(), _s.set(1.2 * t.s, 1.05 * t.s, 1.2 * t.s)); rounds.setMatrixAt(i, _m);
        _m.compose(_p.set(t.x, -9, t.z), _q.identity(), _s.set(0.001, 0.001, 0.001)); crowns.setMatrixAt(i, _m); crowns2.setMatrixAt(i, _m);
      }
      const c = L.foliage[t.k];
      _c.set(c).multiplyScalar(0.8 + 0.4 * hash(i * 3)); crowns.setColorAt(i, _c); crowns2.setColorAt(i, _c); rounds.setColorAt(i, _c);
    });
    for (const m of [trunks, crowns, crowns2, rounds]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }

  // hills (billboards far behind)
  const hillTex = (col, seed, amp) => canvasTex(THREE, 1024, 256, (g, w, h) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) { const y = h * 0.55 - amp * h * (0.5 * Math.sin(x * 0.006 + seed) + 0.3 * Math.sin(x * 0.017 + seed * 2.3) + 0.2 * Math.sin(x * 0.041 + seed * 4)); g.lineTo(x, y); }
    g.lineTo(w, h); g.closePath(); g.fill();
  });
  const hills = [];
  for (let k = 0; k < 2; k++) {
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(400, 50 - k * 14), mat);
    m.position.set(0, 14 - k * 3, -105 + k * 40); root.add(m); hills.push(m);
  }

  // reeds along the near edge of the far bank
  const reedGeo = new THREE.CylinderGeometry(0, 0.035, 1.2, 4);
  const reeds = new THREE.InstancedMesh(reedGeo, new THREE.MeshStandardMaterial({ color: '#5f7a3a', roughness: 1 }), 220);
  for (let i = 0; i < 220; i++) {
    const x = -34 + i * 0.31 + hash(i) * 0.3, z = -14.6 + hash(i + 4) * 1.4, h = 0.7 + hash(i + 9) * 1.1;
    _m.compose(_p.set(x, 0.1 + h * 0.4, z), _q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (hash(i + 2) - 0.5) * 0.4), _s.set(1, h, 1)); reeds.setMatrixAt(i, _m);
  }
  reeds.frustumCulled = false; bankGroup.add(reeds);

  // landing stage (dock): planks on posts, with a spectator group; position fixed so framing is stable
  const dock = new THREE.Group(); dock.position.set(0, 0, -9.5); root.add(dock);
  const plankMat = new THREE.MeshStandardMaterial({ color: '#8c6a43', roughness: 0.95 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(9, 0.14, 2.6), plankMat); deck.position.set(0, 0.42, 0); deck.receiveShadow = true; dock.add(deck);
  for (let i = 0; i < 12; i++) { const ln = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.145, 2.6), new THREE.MeshStandardMaterial({ color: '#4a3622' })); ln.position.set(-4.4 + i * 0.8, 0.42, 0); dock.add(ln); }
  const postGeo = new THREE.CylinderGeometry(0.1, 0.12, 1.4, 8), postMat = new THREE.MeshStandardMaterial({ color: '#5a4630', roughness: 1 });
  for (const px of [-4.3, -1.5, 1.5, 4.3]) for (const pz of [-1.2, 1.2]) { const p = new THREE.Mesh(postGeo, postMat); p.position.set(px, -0.1, pz); dock.add(p); }
  // rail
  const rail = new THREE.Mesh(new THREE.BoxGeometry(9, 0.06, 0.06), postMat); rail.position.set(0, 1.0, 1.22); dock.add(rail);
  for (const px of [-4.4, -2.2, 0, 2.2, 4.4]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.6, 0.07), postMat); p.position.set(px, 0.75, 1.22); dock.add(p); }

  // spectators: the shared crowd3d (real 3D people, instanced, face/hair/clothes variety, idle + reactions) standing on the landing stage
  // and along the bank behind it
  let crowd3d = null;
  if (opts.createCrowd3d) {
    try {
      crowd3d = opts.createCrowd3d(stage, {
        stands: [
          { center: [0, 0.49, -9.0], yaw: 0, rows: 2, perRow: 11, width: 8.0, rise: 0, rowDepth: 0.78, standing: 1, fill: 0.9, focus: [0, 0.6, 0] },
          { center: [-1.2, 0.5, -12.8], yaw: 0, rows: 3, perRow: 14, width: 13, rise: 0.3, rowDepth: 0.8, standing: 1, fill: 0.62, focus: [0, 0.6, 0] },
        ],
        seed: 11, culture: ['american_rural', 'european_village', 'nordic'], quality: opts.quality || 'medium', excitement: 0.25, props: { phone: 0.08, child: 0.1 },
      });
    } catch (e) { console.warn('crowd3d unavailable', e); crowd3d = null; }
  }
  function updateCrowd(dt, excite) {
    if (!crowd3d) return;
    crowd3d.setExcitement(Math.min(1, excite));
    crowd3d.update(dt);
  }

  // floating debris: bark chips, leaves and sawdust drifting past on the water (foreground life; the log sheds bark as it spins)
  const DEB_N = 54;
  const debGeo = new THREE.CircleGeometry(0.5, 7); debGeo.rotateX(-Math.PI / 2);
  const debris = new THREE.InstancedMesh(debGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }), DEB_N);
  debris.frustumCulled = false; debris.receiveShadow = false; root.add(debris);
  const DEBC = ['#6a4a2a', '#7a5632', '#5a3c22', '#8a6a3a', '#5f7a2e', '#8a8a34', '#b0873a', '#4f6a28'];
  const deb = [];
  for (let i = 0; i < DEB_N; i++) {
    const d = { x0: (hash(i * 9 + 1) - 0.5) * 2, z0: -5 + hash(i * 9 + 2) * 22, sz: 0.1 + hash(i * 9 + 3) * 0.2, ph: hash(i * 9 + 4) * TAU, rot: hash(i * 9 + 5) * TAU, sp: 0.05 + hash(i * 9 + 6) * 0.1, el: 0.6 + hash(i * 9 + 7) * 0.6 };
    deb.push(d); debris.setColorAt(i, _c.set(DEBC[Math.floor(hash(i * 9 + 8) * DEBC.length)]));
  }
  debris.instanceColor.needsUpdate = true;
  const _dq = new THREE.Quaternion(), _dy = new THREE.Vector3(0, 1, 0);
  function updateDebris(t, spin) {
    for (let i = 0; i < DEB_N; i++) {
      const d = deb[i];
      const z = ((d.z0 + t * d.sp * (1 + spin * 1.5) + 5) % 22) - 5;         // drifts toward the camera, faster when the log churns the water
      const half = 2.0 * (1 - Math.max(z, 0) / 30) * 1.0 + 0.3;
      const x = d.x0 * half + Math.sin(t * 0.35 + d.ph) * 0.12;
      const y = 0.012 + Math.sin(t * 1.7 + d.ph) * 0.008;
      _dq.setFromAxisAngle(_dy, d.rot + Math.sin(t * 0.4 + d.ph) * 0.5);
      _m.compose(_p.set(x, y, z), _dq, _s.set(d.sz * 0.85, 1, d.sz * d.el * 0.85));
      debris.setMatrixAt(i, _m);
    }
    debris.instanceMatrix.needsUpdate = true;
  }

  // ---- venue props -----------------------------------------------------------------------------------------------------------------------
  // pond: a mill with a wheel; river: boulders; lake: strings of lanterns on posts; rapids: rain and rocks
  const props = { pond: new THREE.Group(), river: new THREE.Group(), lake: new THREE.Group(), rapids: new THREE.Group() };
  for (const g of Object.values(props)) { g.visible = false; root.add(g); }
  {
    const wall = new THREE.MeshStandardMaterial({ color: '#8a6a52', roughness: 0.95 }), roof = new THREE.MeshStandardMaterial({ color: '#4a3028', roughness: 0.9 });
    const g = props.pond;
    const body = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.2, 3.6), wall); body.position.set(-9, 2.3, -17.5); g.add(body);
    const r1 = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.16, 4.4), roof); r1.rotation.z = 0.5; r1.position.set(-10.9, 5.1, -17.5); g.add(r1);
    const r2 = r1.clone(); r2.rotation.z = -0.5; r2.position.x = -7.1; g.add(r2);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.1), new THREE.MeshBasicMaterial({ color: '#ffd68a' })); win.position.set(-9, 2.6, -15.65); g.add(win);
    const wheel = new THREE.Group(); wheel.position.set(-5.6, 2.2, -16.4);
    const rimm = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.1, 6, 24), new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 1 })); wheel.add(rimm);
    for (let k = 0; k < 8; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.1, 0.12), new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 1 })); sp.rotation.z = k * Math.PI / 8; wheel.add(sp); }
    g.add(wheel); g.userData.wheel = wheel;
  }
  {
    const g = props.river;
    for (let k = 0; k < 9; k++) {
      const r = 0.7 + hash(k + 40) * 1.1;
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshStandardMaterial({ color: k % 2 ? '#7b8a90' : '#68777e', roughness: 1 }));
      b.scale.set(1.3, 0.62, 1); b.position.set(-30 + k * 7.5 + hash(k) * 2, 0.0, -14.6 - hash(k + 3) * 1.5); g.add(b);
    }
  }
  const lanternGlow = [];
  {
    const g = props.lake;
    const pole = new THREE.MeshStandardMaterial({ color: '#2a2030', roughness: 1 });
    const post = (x) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5.6, 6), pole); p.position.set(x, 2.8, -13.5); g.add(p); };
    const xs = [-14, -5, 5, 14]; xs.forEach(post);
    const glowTex = canvasTex(THREE, 64, 64, (c, w, h) => { const r = c.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,220,140,0.95)'); r.addColorStop(0.35, 'rgba(255,170,80,0.5)'); r.addColorStop(1, 'rgba(255,140,50,0)'); c.fillStyle = r; c.fillRect(0, 0, w, h); });
    for (let s = 0; s < xs.length - 1; s++) {
      const a = xs[s], b = xs[s + 1];
      const pts = []; for (let k = 0; k <= 16; k++) { const u = k / 16; pts.push(new THREE.Vector3(a + (b - a) * u, 5.4 - Math.sin(Math.PI * u) * 0.9, -13.5)); }
      const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.018, 4), new THREE.MeshBasicMaterial({ color: '#1a1424' })); g.add(rope);
      for (let k = 1; k < 8; k++) {
        const u = k / 8, x = a + (b - a) * u, y = 5.4 - Math.sin(Math.PI * u) * 0.9 - 0.25;
        const lan = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: k % 2 ? '#ffb347' : '#ff7a59' })); lan.scale.set(0.8, 1.05, 0.8); lan.position.set(x, y, -13.5); g.add(lan);
        const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); gl.scale.set(2.0, 2.0, 1); gl.position.set(x, y, -13.4); g.add(gl); lanternGlow.push(gl);
      }
    }
  }
  const rain = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#dcebf5', transparent: true, opacity: 0.45, fog: false }));
  const RAIN_N = low ? 160 : 420;
  rain.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIN_N * 6), 3));
  rain.frustumCulled = false; rain.visible = false; root.add(rain);
  {
    const g = props.rapids;
    for (let k = 0; k < 7; k++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.5 + hash(k + 70) * 0.55, 9, 7), new THREE.MeshStandardMaterial({ color: '#59666c', roughness: 1 }));
      b.scale.set(1.2, 0.7, 1); b.position.set(-4.6 + k * 1.5 + (hash(k + 80) - 0.5) * 0.8, 0.0, 1.9 + hash(k + 90) * 2.6 - (k > 3 ? 7.5 : 0)); b.castShadow = true; g.add(b);
    }
  }

  // ---- state ------------------------------------------------------------------------------------------------------------------------------
  let cur = -1;
  function setVenue(i) {
    if (i === cur) return; cur = i;
    const L = LOOKS3D[i];
    scene.background = skyFor(L);
    scene.fog = new THREE.Fog(L.fog, L.fogNear, L.fogFar);
    waterMat.color.set(L.water[0]); waterMat.emissive.set(L.water[0]).lerp(new THREE.Color(L.sky[1]), 0.12); waterMat.emissiveIntensity = L.key === 'lake' ? 0.5 : L.key === 'rapids' ? 0.5 : 0.62;
    glint.material.opacity = L.key === 'lake' ? 0.5 : L.key === 'rapids' ? 0.9 : 0.75;
    sheen.material.color.set(L.key === 'lake' ? '#ffb784' : L.key === 'rapids' ? '#d8e6ee' : '#ffffff');
    sheen.material.opacity = L.key === 'lake' ? 0.5 : 0.55;
    bankMats[0].color.set(L.key === 'lake' ? '#2a2c4a' : L.key === 'rapids' ? '#35503c' : '#3d5a38');
    bankMats[1].color.set(L.key === 'lake' ? '#2b3050' : L.key === 'rapids' ? '#3a583f' : '#46783f');
    hills.forEach((m, k) => { m.material.map = hillTex(L.hills[k], 3 + k * 5 + i, 0.5 + k * 0.1); m.material.needsUpdate = true; });
    placeTrees(L);
    Object.keys(props).forEach((k) => { props[k].visible = k === L.key; });
    rain.visible = L.key === 'rapids';
    stage.setLighting(L.light, { hemi: L.hemi, keyI: L.keyI, key: L.keyCol, exposure: L.exposure, sky: new THREE.Color(L.sky[2]).getHex(), fog: L.fog });
    scene.fog = new THREE.Fog(L.fog, L.fogNear, L.fogFar);
    scene.background = skyFor(L);
    stage._shadowOffset = new THREE.Vector3(L.sun[0], L.sun[1], L.sun[2]);
    // dusk: spectators in the dark
    stage.invalidate();
  }

  const _rain = rain.geometry.attributes.position;
  function update(t, w) {
    // slide the ripples; faster water when the log spins fast
    const sp = Math.min(1, Math.abs(w ? w.v : 0));
    waterMat.map.offset.set(t * 0.012, t * 0.007 + 0.0);
    glintTex.offset.set(-t * 0.02 - sp * 0.0, t * 0.012);
    updateDebris(t, sp);
    foam.material.opacity = 0.55 + 0.35 * sp;
    foam.scale.set(1 + 0.012 * Math.sin(t * 3), 1 + 0.06 * Math.sin(t * 2.1 + 1) + 0.12 * sp, 1);
    if (props.pond.visible && props.pond.userData.wheel) props.pond.userData.wheel.rotation.z = -t * 0.5;
    if (props.lake.visible) lanternGlow.forEach((s, k) => { const f = 0.9 + 0.1 * Math.sin(t * 2.6 + k * 1.7); s.scale.set(2.0 * f, 2.0 * f, 1); });
    if (rain.visible) {
      for (let i = 0; i < RAIN_N; i++) {
        const sx = -14 + hash(i * 3) * 28, sz = -16 + hash(i * 3 + 1) * 30, fall = (hash(i * 3 + 2) + t * (1.4 + hash(i) * 0.6)) % 1;
        const y = 9 - fall * 9.4;
        _rain.setXYZ(i * 2, sx, y, sz); _rain.setXYZ(i * 2 + 1, sx - 0.1, y - 0.55, sz);
      }
      _rain.needsUpdate = true;
    }
  }

  return { root, logGroup, foam, setVenue, update, updateCrowd, water, dock, get crowd() { return crowd3d; }, trees: [trunks, crowns, crowns2, rounds], reeds, hills, dispose() { root.removeFromParent(); } };
}

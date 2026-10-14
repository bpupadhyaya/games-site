// The stone (real size: radius 2.6 - 4.4 cm, 1-3 cm thick) and the water effects: splash crowns, spray, foam streaks, bubbles.
// Effects are pure functions of a ripple's age (ws.t - ripple.t0), so they pause with the game and replay identically.
const TAU = Math.PI * 2;
export const STONE_VIS = 1.3;      // the stone is drawn at most this much larger than life (readability)

const hash = (n) => { let x = Math.imul(n | 0, 0x45d9f3b); x ^= x >>> 16; x = Math.imul(x, 0x45d9f3b); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

// ---- the stone ------------------------------------------------------------------------------------------------------------------
export function makeStones(THREE, STONES) {
  const speck = (col, seed) => {
    const c = globalThis.document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = col[1]; g.fillRect(0, 0, 128, 128);
    const grd = g.createRadialGradient(64, 56, 6, 64, 64, 90); grd.addColorStop(0, col[0]); grd.addColorStop(1, col[2]); g.fillStyle = grd; g.globalAlpha = 0.85; g.fillRect(0, 0, 128, 128); g.globalAlpha = 1;
    for (let i = 0; i < 260; i++) { g.fillStyle = hash(seed * 997 + i) < 0.5 ? col[2] : col[0]; g.globalAlpha = 0.18 + hash(seed * 31 + i * 7) * 0.25; g.fillRect(hash(seed + i * 3) * 128, hash(seed * 5 + i * 11) * 128, 1 + hash(i) * 3, 1 + hash(i + 9) * 2); }
    // a thin vein across some stones
    g.globalAlpha = 0.35; g.strokeStyle = col[0]; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 30 + hash(seed) * 70); g.bezierCurveTo(40, 20 + hash(seed + 1) * 90, 80, 100, 128, 50 + hash(seed + 2) * 50); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  return STONES.map((st, i) => {
    const R = st.r, T = R * (0.18 + 0.5 * (1 - st.flat));       // half thickness
    const pts = [[0, T * 0.95], [R * 0.45, T], [R * 0.8, T * 0.78], [R * 0.96, T * 0.34], [R, 0], [R * 0.96, -T * 0.34], [R * 0.78, -T * 0.8], [R * 0.4, -T * 0.98], [0, -T * 0.92]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const geo = new THREE.LatheGeometry(pts, 40);
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k), y = p.getY(k), z = p.getZ(k), a = Math.atan2(z, x);
      const wob = 1 + 0.07 * Math.sin(a * 2 + i) + 0.035 * Math.sin(a * 3 + i * 2.1);   // not a perfect disc
      p.setXYZ(k, x * wob * 1.06, y, z * wob * 0.9);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: speck(st.col, i + 1), roughness: i === 4 ? 0.35 : 0.72, metalness: 0, envMapIntensity: 0.6 });
    return { geo, mat, R, T };
  });
}

// ---- droplets, crowns, foam ------------------------------------------------------------------------------------------------------
export function makeFx(THREE, parent, { quality = 'high' } = {}) {
  const lo = quality === 'low';
  const disc = (() => {
    const c = globalThis.document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 2, 32, 32, 30); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.5, 'rgba(255,255,255,0.7)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
  })();
  const ringTex = (() => {
    const c = globalThis.document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const r = g.createRadialGradient(64, 64, 8, 64, 64, 62); r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(0.55, 'rgba(255,255,255,0.45)'); r.addColorStop(0.85, 'rgba(255,255,255,0.12)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();

  // spray: points with a soft white disc
  const MAXP = 420;
  const pg = new THREE.BufferGeometry();
  const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3);
  pg.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  pg.setDrawRange(0, 0);
  const pm = new THREE.PointsMaterial({ size: 0.022, map: disc, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, opacity: 0.95 });
  const points = new THREE.Points(pg, pm); points.frustumCulled = false; points.renderOrder = 8;
  parent.add(points);

  // crowns: a ragged ring wall that rises and collapses
  const NC = lo ? 4 : 9;
  const crownGeo = (() => {
    const N = 34, pos = [], idx = [], alpha = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU, spike = i % 2 === 0 ? 0.75 + 0.35 * hash(i + 5) : 0.3 + 0.2 * hash(i);
      pos.push(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55);                  // base ring, narrower
      pos.push(Math.cos(a) * 1.0, spike, Math.sin(a) * 1.0);                // lip, flared
    }
    for (let i = 0; i < N; i++) { const j = (i + 1) % N; const a = i * 2, b = i * 2 + 1, c = j * 2, d = j * 2 + 1; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); void alpha; return g;
  })();
  const crowns = [];
  for (let i = 0; i < NC; i++) {
    const m = new THREE.Mesh(crownGeo, new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.visible = false; m.renderOrder = 7; m.frustumCulled = false; parent.add(m); crowns.push(m);
  }
  // foam streaks (the stone's skid) and rings of froth
  const NF = lo ? 8 : 20;
  const foams = [];
  for (let i = 0; i < NF; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, opacity: 0, depthWrite: false, fog: false, color: 0xffffff }));
    m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 6; m.frustumCulled = false; parent.add(m); foams.push(m);
  }

  const tint = new THREE.Color();
  // ripples: [{ x, z, age, size, kind: 'skip' | 'sink' }], light: tint colour for the spray
  function update(list, light) {
    let np = 0, nc = 0, nf = 0;
    tint.set(light || 0xffffff);
    const add = (x, y, z, k) => { if (np >= MAXP) return; pPos[np * 3] = x; pPos[np * 3 + 1] = y; pPos[np * 3 + 2] = z; pCol[np * 3] = tint.r * k; pCol[np * 3 + 1] = tint.g * k; pCol[np * 3 + 2] = tint.b * k; np++; };
    for (const r of list) {
      const a = r.age, big = r.size, id = Math.round(r.z * 1000);
      const sink = r.kind === 'sink';
      // crown: rises 0..0.14 s, collapses by 0.45 s
      const cl = sink ? 0.7 : 0.45;
      if (a >= 0 && a < cl && nc < NC) {
        const u = a / cl, rise = Math.sin(Math.min(1, u * 1.15) * Math.PI) ** 0.7;
        const s = 0.035 + big * 0.045, m = crowns[nc++];
        m.visible = true; m.position.set(r.x, 0.0, r.z);
        const R = s * (0.7 + 1.6 * Math.sqrt(u)), Hh = s * (sink ? 2.6 : 2.0) * rise;
        m.scale.set(R, Math.max(0.001, Hh), R * (sink ? 1 : 0.8));
        m.rotation.y = hash(id) * TAU;
        m.material.opacity = 0.34 * (1 - u) ** 0.9 * (0.4 + 0.4 * Math.min(1, big));
      }
      // foam: a skid streak along the throw, and a bloom of froth
      if (a >= 0 && a < 1.5 && nf < NF) {
        const u = a / 1.5, m = foams[nf++];
        m.visible = true; m.position.set(r.x, 0.004, r.z + (sink ? 0 : 0.12));
        const L = (sink ? 0.5 : 0.35 + 0.25 * big) * (0.6 + 0.9 * Math.sqrt(u)), Wd = (sink ? 0.5 : 0.14 + 0.1 * big) * (0.6 + 1.1 * Math.sqrt(u));
        m.scale.set(Wd, L, 1); m.material.opacity = 0.7 * (1 - u) ** 1.4;
      }
      // spray droplets: ballistic, each from the ring, a few up the centre
      const n = lo ? 10 : sink ? 30 : 16;
      if (a >= 0 && a < 1.0) {
        for (let k = 0; k < n; k++) {
          const h1 = hash(id * 17 + k * 5 + 1), h2 = hash(id * 13 + k * 3 + 2), h3 = hash(id * 7 + k * 11 + 3);
          const ang = h1 * TAU, v = (0.35 + h2 * 0.9) * (0.5 + big * 0.55), up = (0.9 + h3 * 1.7) * (0.55 + big * 0.5);
          const jet = k % 5 === 0;     // the centre jet
          const t = a - (jet ? 0.0 : 0.012 * (k % 4));
          if (t < 0) continue;
          const hx = Math.cos(ang) * v * (jet ? 0.12 : 0.55), hz = Math.sin(ang) * v * (jet ? 0.12 : 0.55) + (jet ? 0.25 : 0.4);
          const y = up * t - 0.5 * 9.8 * t * t * 0.9;
          if (y < 0) continue;
          add(r.x + hx * t, y, r.z + hz * t, 1.0);
        }
      }
      // bubbles after a plop: rise and burst
      if (sink && a > 0.1 && a < 1.8) {
        for (let k = 0; k < 6; k++) { const h = hash(id + k * 19); const t = a - 0.1 - k * 0.12; if (t < 0 || t > 0.7) continue; add(r.x + (h - 0.5) * 0.35, 0.004 + 0.002 * k, r.z + (hash(id + k) - 0.5) * 0.35, 0.8); }
      }
    }
    for (let i = nc; i < NC; i++) crowns[i].visible = false;
    for (let i = nf; i < NF; i++) foams[i].visible = false;
    pg.setDrawRange(0, np);
    pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true;
  }
  return { update, points, crowns, foams };
}

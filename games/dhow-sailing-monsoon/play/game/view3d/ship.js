// The dhow: a lofted wooden hull with a raised stern, a leaning mast, a long slanted yard and a lateen sail that billows, flogs, stalls and
// is dipped round the mast from the sim's numbers. Plus rigging, rudder, cargo, water barrels, a lantern and real crew figures.
import { clamp, lerp, smooth, DEG, rng, canvasTex } from './util3.js';

const Z_STERN = 7.4, Z_BOW = -7.9, LENGTH = Z_STERN - Z_BOW;
const smoothstep = (a, b, x) => smooth((x - a) / (b - a));
function prof(s) {
  const top = 1.55 + 0.95 * Math.pow(Math.max(0, 1 - s / 0.26), 1.6) + 1.7 * Math.pow(smoothstep(0.72, 1.0, s), 1.4) - 0.12 * Math.sin(Math.PI * s);
  let w = s < 0.38 ? 2.05 * lerp(0.8, 1, smooth(s / 0.38)) : 2.05 * (1 - Math.pow((s - 0.38) / 0.62, 2.3));
  w = Math.max(w, 0.035);
  const b = Math.pow(smoothstep(0.6, 1.0, s), 1.3);
  const keel = lerp(-1.15 + 0.45 * Math.max(0, 1 - s / 0.2), top - 0.45, b);
  return { top, w, keel, deck: top - 0.6 };
}
export const zOf = (s) => lerp(Z_STERN, Z_BOW, s);
export const sOf = (z) => (Z_STERN - z) / LENGTH;
export const deckY = (z) => prof(clamp(sOf(z), 0, 1)).deck;

// sail corners in rig space (origin = mast foot on the deck)
const T = [0, 2.0, -5.6], P = [0, 11.0, 6.4], C = [0, 1.7, 6.0];
const MAST_Z = -1.8;

function plankTexture(THREE, kind) {
  return canvasTex(THREE, 512, 256, (g, w, h) => {
    const R = rng(kind === 'deck' ? 7 : 3);
    const base = kind === 'deck' ? [176, 140, 96] : [122, 82, 50];
    const rows = kind === 'deck' ? 10 : 8, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -R() * 120;
      while (x < w) {
        const len = (kind === 'deck' ? 200 : 380) + R() * 260, k = 0.86 + R() * 0.22;
        g.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`; g.fillRect(x, r * rh, len, rh);
        for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(40,22,10,${0.05 + R() * 0.1})`; g.lineWidth = 1; const yy = r * rh + R() * rh; g.beginPath(); g.moveTo(x + R() * len, yy); g.lineTo(x + R() * len, yy + (R() - 0.5) * 3); g.stroke(); }
        g.fillStyle = 'rgba(30,16,8,0.4)'; g.fillRect(x, r * rh, 2, rh);
        x += len;
      }
      g.fillStyle = 'rgba(25,12,6,0.6)'; g.fillRect(0, r * rh, w, 2);
      if (kind !== 'deck') { g.fillStyle = 'rgba(235,220,190,0.55)'; for (let sx = 6; sx < w; sx += 22) { g.fillRect(sx, r * rh + 2, 2, 2); g.fillRect(sx, r * rh + rh - 4, 2, 2); } }
    }
  }, { repeat: true });
}
function sailTexture(THREE) {
  return canvasTex(THREE, 256, 256, (g, w, h) => {
    const R = rng(11);
    g.fillStyle = '#efe4cb'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '120,100,70' : '255,250,235'},${0.04 + R() * 0.08})`; g.fillRect(R() * w, R() * h, 1 + R() * 2, 1); }
    for (let x = 0; x <= w; x += 32) { g.fillStyle = 'rgba(110,90,60,0.28)'; g.fillRect(x, 0, 2, h); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 2, 0, 1, h); }
    g.fillStyle = 'rgba(150,100,60,0.22)'; for (const y of [h * 0.5, h * 0.76]) { g.fillRect(0, y, w, 3); }
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(170,125,70,0)'); gr.addColorStop(0.7, 'rgba(170,125,70,0)'); gr.addColorStop(1, 'rgba(160,110,60,0.28)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

function hullGeometry(THREE) {
  const N = 40, M = 9;
  const pos = [], uv = [], col = [], idx = [];
  const rows = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N, p = prof(s), z = zOf(s), row = [];
    for (let j = -M; j <= M; j++) {
      const sgn = Math.sign(j) || 1, u = Math.abs(j) / M;
      const x = sgn * p.w * Math.pow(Math.sin(u * Math.PI / 2), 0.7) * (1 + 0.07 * Math.pow(u, 3));
      const y = p.keel + (p.top - p.keel) * Math.pow(u, 1.25);
      pos.push(x, y, z); uv.push(s * 7, (j + M) / (2 * M) * 2.4);
      const paint = y < -0.15 ? [0.42, 0.2, 0.14] : y > p.top - 0.34 ? [0.95, 0.9, 0.78] : y > p.top - 0.5 ? [0.13, 0.36, 0.42] : [1, 0.96, 0.9];
      col.push(...paint);
      row.push(pos.length / 3 - 1);
    }
    rows.push(row);
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < 2 * M; j++) {
    const a = rows[i][j], b = rows[i][j + 1], c = rows[i + 1][j], d = rows[i + 1][j + 1];
    idx.push(a, c, b, b, c, d);
  }
  // transom (stern closure)
  const sr = rows[0]; const cI = pos.length / 3;
  const p0 = prof(0); pos.push(0, (p0.keel + p0.top) / 2, Z_STERN); uv.push(0.5, 0.5); col.push(0.9, 0.8, 0.65);
  for (let j = 0; j < 2 * M; j++) idx.push(cI, sr[j + 1], sr[j]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function deckGeometry(THREE) {
  const N = 40, K = 6, pos = [], uv = [], idx = [], rows = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N, p = prof(s), z = zOf(s), row = [], hw = Math.max(0.02, p.w - 0.14);
    for (let k = 0; k <= K; k++) { const x = -hw + (2 * hw * k) / K; pos.push(x, p.deck, z); uv.push(s * 5, k / K * 1.5); row.push(pos.length / 3 - 1); }
    rows.push(row);
  }
  for (let i = 0; i < N; i++) for (let k = 0; k < K; k++) { const a = rows[i][k], b = rows[i][k + 1], c = rows[i + 1][k], d = rows[i + 1][k + 1]; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function rimGeometry(THREE) {
  // gunwale cap and the inner bulwark wall on both sides
  const N = 40, pos = [], uv = [], idx = [];
  for (const sgn of [-1, 1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= N; i++) {
      const s = i / N, p = prof(s), z = zOf(s), xo = sgn * p.w * (1 + 0.07), xi = sgn * Math.max(0.01, p.w - 0.14);
      pos.push(xo, p.top, z, xi, p.top, z, xi, p.deck, z); uv.push(s * 7, 0, s * 7, 0.15, s * 7, 0.4);
    }
    for (let i = 0; i < N; i++) for (let k = 0; k < 2; k++) {
      const a = base + i * 3 + k, b = base + i * 3 + k + 1, c = base + (i + 1) * 3 + k, d = base + (i + 1) * 3 + k + 1;
      if (sgn > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

const SHARED = {};
function shared(THREE) {
  if (SHARED.hull) return SHARED;
  const wood = plankTexture(THREE, 'hull'), deck = plankTexture(THREE, 'deck');
  wood.repeat.set(1, 1); deck.repeat.set(1, 1);
  SHARED.hull = hullGeometry(THREE); SHARED.deck = deckGeometry(THREE); SHARED.rim = rimGeometry(THREE);
  SHARED.hullMat = new THREE.MeshStandardMaterial({ map: wood, vertexColors: true, roughness: 0.78, metalness: 0, side: THREE.DoubleSide });
  SHARED.deckMat = new THREE.MeshStandardMaterial({ map: deck, roughness: 0.88, metalness: 0 });
  SHARED.rimMat = new THREE.MeshStandardMaterial({ map: wood, color: '#caa171', roughness: 0.75, side: THREE.DoubleSide });
  SHARED.dark = new THREE.MeshStandardMaterial({ color: '#4b3020', roughness: 0.8 });
  SHARED.light = new THREE.MeshStandardMaterial({ color: '#b78c5a', roughness: 0.8 });
  SHARED.rope = new THREE.MeshStandardMaterial({ color: '#6c5434', roughness: 0.95 });
  SHARED.sailMat = new THREE.MeshStandardMaterial({ map: sailTexture(THREE), side: THREE.DoubleSide, roughness: 0.95, metalness: 0, emissive: '#3a2a18', emissiveIntensity: 0.0 });
  return SHARED;
}

export function createShip(THREE, { quality = 'high', small = false } = {}) {
  const S = shared(THREE);
  const root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt);
  const cast = (m, c = true, r = true) => { m.castShadow = c && quality !== 'low'; m.receiveShadow = r; return m; };
  tilt.add(cast(new THREE.Mesh(S.hull, S.hullMat)), cast(new THREE.Mesh(S.deck, S.deckMat)), cast(new THREE.Mesh(S.rim, S.rimMat)));
  const box = (w, h, d, mat, x, y, z) => { const m = cast(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)); m.position.set(x, y, z); tilt.add(m); return m; };
  const cyl = (r0, r1, h, mat, x, y, z, seg = 10) => { const m = cast(new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat)); m.position.set(x, y, z); tilt.add(m); return m; };
  const rope = (a, b, r = 0.03) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 5), S.rope); setRope(m, a, b); tilt.add(m); return m; };
  const up = new THREE.Vector3(0, 1, 0), tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
  function setRope(m, a, b) {
    tmpV.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = tmpV.length() || 0.001; m.scale.set(1, len, 1);
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); tmpQ.setFromUnitVectors(up, tmpV.normalize()); m.quaternion.copy(tmpQ);
  }
  // stem post (curved) and a carved stern post
  { // the stem: a post that follows the hull's lower edge up to the bow and curls forward above it
    const pts = [0.5, 0.62, 0.74, 0.85, 0.93, 1.0].map((q) => { const p = prof(q); return new THREE.Vector3(0, p.keel + 0.05, zOf(q)); });
    const pt = prof(1.0); pts.push(new THREE.Vector3(0, pt.top + 0.25, Z_BOW - 0.45), new THREE.Vector3(0, pt.top + 0.7, Z_BOW - 0.7));
    tilt.add(cast(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.16, 7), S.dark)));
    const sp0 = prof(0), sp1 = prof(0.12);
    const sterns = [new THREE.Vector3(0, sp0.keel + 0.2, Z_STERN + 0.05), new THREE.Vector3(0, sp1.top * 0.5, Z_STERN + 0.12), new THREE.Vector3(0, sp0.top - 0.05, Z_STERN + 0.2), new THREE.Vector3(0, sp0.top + 0.5, Z_STERN + 0.1)];
    tilt.add(cast(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sterns), 12, 0.15, 7), S.dark)));
  }
  // poop (raised stern) rail and the rudder
  const pd = prof(0.06).deck;
  for (const sgn of [-1, 1]) for (let k = 0; k < 4; k++) { const z = 6.9 - k * 0.95; cyl(0.04, 0.04, 0.7, S.dark, sgn * (prof(sOf(z)).w - 0.12), prof(sOf(z)).deck + 0.35, z, 5); }
  box(2.9, 0.1, 0.1, S.dark, 0, pd + 0.72, 7.25);
  const rudder = new THREE.Group(); rudder.position.set(0, 0, Z_STERN + 0.1);
  const blade = cast(new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 0.95), S.dark)); blade.position.set(0, -0.2, 0.45); rudder.add(blade);
  const tiller = cast(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.9), S.light)); tiller.position.set(0, 1.9, -0.7); rudder.add(tiller);
  tilt.add(rudder);
  // mast, shrouds, stays
  const mastBase = [0, deckY(MAST_Z), MAST_Z];
  const rig = new THREE.Group(); rig.position.set(...mastBase); rig.rotation.x = -0.1; tilt.add(rig);
  const mast = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 9.4, 10), S.dark)); mast.position.set(0, 4.7, 0); rig.add(mast);
  const yardDir = new THREE.Vector3(T[0] - P[0], T[1] - P[1], T[2] - P[2]), yardLen = yardDir.length() + 1.2;
  const yard = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.11, yardLen, 8), S.light));
  yard.position.set((T[0] + P[0]) / 2, (T[1] + P[1]) / 2, (T[2] + P[2]) / 2); yard.quaternion.setFromUnitVectors(up, new THREE.Vector3(P[0] - T[0], P[1] - T[1], P[2] - T[2]).normalize());
  const yardGroup = new THREE.Group(); yardGroup.add(yard); rig.add(yardGroup);
  // sail mesh: barycentric lattice over T, P, C
  const n = quality === 'low' ? 10 : 16, vid = {}, spos = [], suv = [], sidx = [], bary = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j + i <= n; j++) { vid[`${i},${j}`] = spos.length / 3; const a = i / n, c = j / n, b = 1 - a - c; bary.push([b, a, c]); spos.push(0, 0, 0); suv.push(a + 0.5 * c, c); }
  for (let i = 0; i < n; i++) for (let j = 0; j + i < n; j++) {
    sidx.push(vid[`${i},${j}`], vid[`${i + 1},${j}`], vid[`${i},${j + 1}`]);
    if (j + i + 1 < n) sidx.push(vid[`${i + 1},${j}`], vid[`${i + 1},${j + 1}`], vid[`${i},${j + 1}`]);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(spos, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(suv, 2)); sg.setIndex(sidx);
  const sail = cast(new THREE.Mesh(sg, S.sailMat), true, true); sail.frustumCulled = false; yardGroup.add(sail);
  const sp = sg.attributes.position;
  // reef points / battens drawn as a dark line along the foot
  rope([-0.0, 9.2, 0], [0, 7.5, -0.4], 0.02);
  const sheet = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5), S.rope); tilt.add(sheet);
  // stays and shrouds
  const top = [0, 9.3, 0].map((v, i) => v + mastBase[i]);
  rope(top, [0, prof(0.95).top + 0.5, -8.2]); rope(top, [0, prof(0.04).top + 0.4, 7.2]);
  for (const sgn of [-1, 1]) for (const dz of [-0.7, 0.7]) rope([top[0], top[1] - 2.2, top[2]], [sgn * (prof(sOf(MAST_Z + dz)).w + 0.05), prof(sOf(MAST_Z + dz)).top, MAST_Z + dz], 0.025);
  // cargo bales / jars, water barrels
  const cargo = new THREE.Group(); tilt.add(cargo);
  const bales = [];
  const baleGeo = new THREE.BoxGeometry(0.95, 0.6, 0.72), jarGeo = new THREE.CylinderGeometry(0.3, 0.24, 0.72, 10), polesGeo = new THREE.CylinderGeometry(0.07, 0.07, 3.4, 6);
  const Rb = rng(21);
  const slots = [];
  for (let layer = 0; layer < 2; layer++) for (let k = 0; k < 8; k++) for (const sgn of [-1, 1]) {
    const z = -4.7 + k * 1.0 + (k > 3 ? 1.6 : 0) + (Rb() - 0.5) * 0.1; if (z > 3.8) continue;
    const w = prof(sOf(z)).w - 0.55; slots.push({ x: sgn * Math.max(0.4, w * 0.62), y: prof(sOf(z)).deck + 0.3 + layer * 0.6, z, r: (Rb() - 0.5) * 0.3 });
  }
  const baleMat = new THREE.MeshStandardMaterial({ color: '#c7a56f', roughness: 0.95 }), jarMat = new THREE.MeshStandardMaterial({ color: '#b5693d', roughness: 0.9 }), poleMat = new THREE.MeshStandardMaterial({ color: '#9a6b3d', roughness: 0.9 });
  const baleMats = [];
  slots.forEach((s2, i) => { const jar = i % 5 === 3, mat = jar ? jarMat : baleMat.clone(); if (!jar) baleMats.push(mat); const m = cast(new THREE.Mesh(jar ? jarGeo : baleGeo, mat)); m.position.set(s2.x, s2.y + (jar ? 0.06 : 0), s2.z); m.rotation.y = s2.r; cargo.add(m); bales.push(m); });
  const poles = new THREE.Group(); for (let i = 0; i < 9; i++) { const m = cast(new THREE.Mesh(polesGeo, poleMat)); m.rotation.x = Math.PI / 2; m.position.set(((i % 3) - 1) * 0.18, 0.95 + Math.floor(i / 3) * 0.17, 0); poles.add(m); } poles.position.set(0, 0, -2.6); cargo.add(poles);
  const barrels = [];
  for (let i = 0; i < 6; i++) { const m = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.7, 10), S.light)); const z = 5.6 + (i % 3) * 0.5 - 0.5, side = i < 3 ? -1 : 1; m.position.set(side * 1.15, prof(sOf(z)).deck + 0.35, z); tilt.add(m); barrels.push(m); }
  // lantern (night light)
  const lantern = { intensity: 0 };
  const lampM = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd391' })); lampM.position.set(0, pd + 1.5, 6.8); tilt.add(lampM);
  if (!SHARED.glowTex) SHARED.glowTex = canvasTex(THREE, 64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,214,150,0.9)'); gr.addColorStop(0.3, 'rgba(255,190,110,0.35)'); gr.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const lampG = new THREE.Sprite(new THREE.SpriteMaterial({ map: SHARED.glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); lampG.scale.set(3.2, 3.2, 1); lampG.position.copy(lampM.position); tilt.add(lampG);

  if (small) { root.scale.setScalar(0.62); }

  const humans = [];
  const A = {
    root, tilt, rig, humans, sail, rudder, lantern, lampM, mastBase,
    async addCrew(V3, stage, spec) {
      const { loadHuman } = V3;
      for (const c of spec) {
        const h = await loadHuman({ character: 'athlete_m', kit: { top: c.top, bottoms: c.bottoms, socks: c.socks || c.bottoms }, skin: c.skin, hair: c.hair, castShadow: quality !== 'low' });
        tilt.add(h.root); stage.track(h);
        h.groundClamp = 'off'; h.footPlanting = false;
        h.setPosition(c.x, deckY(c.z), c.z); h.setFacing(c.yaw ?? Math.PI); h.play(c.clip || 'idle');
        h.userData = c; humans.push(h);
      }
    },
    crewClip(i, name) { const h = humans[i]; if (h && h.userData.clip !== name) { h.userData.clip = name; h.crossfade ? h.crossfade(name, 0.35) : h.play(name); } },
    // st: { side, ang (sheet degrees), flap, stall, eff, dipP (0..1 or -1), reef, heel, wind m/s, cargo (0..1), tint, water (0..1), t, helm (-1..1), poles }
    update(dt, st) {
      const t = st.t;
      let psi;
      let lift = 0;
      if (st.dipP >= 0) { const s = -1 + 2 * smooth(st.dipP); psi = st.side * st.ang * s; lift = Math.sin(st.dipP * Math.PI) * 0.35; }
      else psi = st.side * st.ang;
      yardGroup.rotation.y = psi * DEG; yardGroup.rotation.x = lift;
      const flap = st.dipP >= 0 ? 1 : st.flap, stall = st.stall;
      const full = clamp(st.eff, 0, 1) * (1 - 0.35 * stall) * (1 - 0.5 * flap);
      const amp = (0.25 + 1.55 * full) * (0.6 + 0.4 * clamp(st.wind / 8, 0.2, 1.4));
      const reef = st.reef;
      for (let v = 0; v < bary.length; v++) {
        const [wT, wP, wC] = bary[v];
        let x = T[0] * wT + P[0] * wP + C[0] * wC, y = T[1] * wT + P[1] * wP + C[1] * wC, z = T[2] * wT + P[2] * wP + C[2] * wC;
        // shorten the sail toward the yard line as it is reefed
        const k = 0.45 * reef * wC;
        const yl = T[1] + (P[1] - T[1]) * (wP / Math.max(0.0001, wP + wT)), zl = T[2] + (P[2] - T[2]) * (wP / Math.max(0.0001, wP + wT));
        y = lerp(y, yl, k); z = lerp(z, zl, k);
        const belly = 2.7 * wC * (1 - wC) * (0.4 + 0.9 * (wP + wT * 0.5)) * 1.9;
        const flog = Math.sin(t * 13 + wC * 9 + wP * 7) * 0.5 + Math.sin(t * 7.3 + wP * 11 + wT * 5) * 0.5;
        const rip = Math.sin(t * 2.1 + wP * 6 + wC * 3) * 0.04 + stall * Math.sin(t * 5 + wC * 14) * 0.05;
        const bx = st.side * (belly * amp * 0.62 + flap * flog * (0.15 + 1.1 * wC) * 0.55) + rip;
        sp.setXYZ(v, x + bx, y, z);
      }
      sp.needsUpdate = true; sg.computeVertexNormals();
      S.sailMat.emissiveIntensity = clamp(st.sunBack || 0, 0, 0.5);
      // sheet rope from the clew to the stern rail
      const cl = new THREE.Vector3(C[0] + st.side * amp * 0, C[1], C[2]); yardGroup.localToWorld(cl); rig.parent.worldToLocal(cl);
      setRope(sheet, [cl.x, cl.y, cl.z], [st.side * 1.3 * 0.7, pd + 0.8, 6.2]);
      // hull attitude: roll with the heel and the sea, pitch with the sea
      tilt.rotation.z = -(st.heel + (st.roll || 0)) * DEG; tilt.rotation.x = (st.pitch || 0) * DEG;
      rudder.rotation.y = -(st.helm || 0) * 0.5; tiller.rotation.y = (st.helm || 0) * 0.3;
      // cargo and barrels
      const nShow = Math.round(bales.length * clamp(st.cargo, 0, 1));
      bales.forEach((m, i) => { m.visible = i < nShow; });
      if (st.tint && A._tint !== st.tint) { A._tint = st.tint; for (const mm of baleMats) mm.color.set(st.tint); }
      poles.visible = !!st.poles && st.cargo > 0.05;
      const nb = Math.ceil(clamp(st.water, 0, 1) * barrels.length - 0.001); barrels.forEach((m, i) => { m.visible = i < nb; });
      lantern.intensity = st.lamp; lampM.visible = st.lamp > 0.05; lampG.material.opacity = clamp(st.lamp, 0, 1) * (0.8 + 0.2 * Math.sin(t * 9));
    },
  };
  return A;
}

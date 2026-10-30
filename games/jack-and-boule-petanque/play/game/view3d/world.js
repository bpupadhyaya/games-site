// Procedural 3D world for Jack and Boule: a gravel pitch (texture baked from the terrain), timber borders, a stone wall closing the lane,
// the village / harbour / lavender / olive backdrop, plane trees, a sling frame, steel boules with engraved grooves and a lacquered jack.
// World coordinates follow the sim: x across the lane, y down the lane (away from the thrower), z up. Three.js space is (x, z, -y).
import * as THREE from '../vendor3d/three.js';
import { heightAt } from '../src/sim.js';
import { PAL, palOf } from '../src/art.js';

export const R_B = 6.5, R_J = 2.8, HALF = 100, WALL_Y = 668;
const TAU = Math.PI * 2;
const lcg = (seed) => { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const rgb = (a, k = 1) => `rgb(${a.map((v) => Math.max(0, Math.min(255, Math.round(v * k)))).join(',')})`;
export const W3 = (x, y, z) => new THREE.Vector3(x, z, -y);

const canvasTex = (w, h, paint, o = {}) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (o.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  return t;
};
export const radialTex = (rgbs = '0,0,0', a = 1) => canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, `rgba(${rgbs},${a})`); g.addColorStop(0.55, `rgba(${rgbs},${a * 0.45})`); g.addColorStop(1, `rgba(${rgbs},0)`); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });

// ---------------------------------------------------------------- ground: macro colour map + slope shading baked from the terrain
const GX0 = -420, GX1 = 420, GY0 = -160, GY1 = WALL_Y + 8;   // the textured ground rectangle (world units)
export function buildGround(T, size = 1536) {
  const P = palOf(T), rnd = lcg(T.seed ^ 0x51ed);
  const W = size, H = Math.round(size * (GY1 - GY0) / (GX1 - GX0));
  const sx = W / (GX1 - GX0), sy = H / (GY1 - GY0);
  const X = (x) => (x - GX0) * sx, Y = (y) => (GY1 - y) * sy;   // texture v up = world y increasing; flipY handled by Y()
  const map = canvasTex(W, H, (c) => {
    // verge
    c.fillStyle = rgb(P.verge); c.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(${rnd() < 0.5 ? '70,86,40' : '170,160,96'},${0.1 + rnd() * 0.18})`; const r = 3 + rnd() * 9; c.beginPath(); c.arc(rnd() * W, rnd() * H, r, 0, TAU); c.fill(); }
    // the packed lane
    const lx0 = X(-HALF), lx1 = X(HALF);
    c.fillStyle = rgb(P.base, 0.86); c.fillRect(lx0, 0, lx1 - lx0, H);
    for (let i = 0; i < 160; i++) { const g = c.createRadialGradient(0, 0, 0, 0, 0, 1); c.save(); c.translate(lx0 + rnd() * (lx1 - lx0), rnd() * H); const r = 40 + rnd() * 110; c.scale(r, r * (0.5 + rnd() * 0.8)); g.addColorStop(0, `rgba(${rnd() < 0.5 ? '255,236,196' : '96,70,44'},${0.05 + rnd() * 0.07})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 1, 0, TAU); c.fill(); c.restore(); }
    // patches: loose sand and packed clay
    for (const q of T.patches) {
      c.save(); c.translate(X(q.x), Y(q.y)); c.scale(q.rx * sx, q.ry * sy);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      const col = (q.k === 0 ? P.sand : P.clay).map((v) => v * (q.k === 0 ? 0.8 : 0.95)); g.addColorStop(0, `rgba(${col.join(',')},0.6)`); g.addColorStop(0.7, `rgba(${col.join(',')},0.34)`); g.addColorStop(1, `rgba(${col.join(',')},0)`);
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, 1, 0, TAU); c.fill(); c.restore();
    }
    // hill shading from the terrain bumps (light from upper left)
    for (const b of T.bumps) {
      c.save(); c.translate(X(b[0]), Y(b[1])); const r = b[2] * 1.7; c.scale(r * sx, r * sy);
      const g = c.createRadialGradient(-0.25, 0.25, 0, 0, 0, 1); const hi = b[3] > 0;
      g.addColorStop(0, hi ? 'rgba(255,238,200,0.14)' : 'rgba(60,40,20,0.18)'); g.addColorStop(0.6, hi ? 'rgba(60,40,20,0.1)' : 'rgba(255,238,200,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, 1, 0, TAU); c.fill(); c.restore();
    }
    // gravel grain + pebbles
    const n = Math.round(W * H / 380);
    for (let i = 0; i < n; i++) {
      const x = lx0 + rnd() * (lx1 - lx0), y = rnd() * H, v = rnd();
      c.fillStyle = v < 0.45 ? `rgba(255,244,214,${0.1 + rnd() * 0.18})` : v < 0.9 ? `rgba(80,58,36,${0.1 + rnd() * 0.2})` : `rgba(${P.clay.join(',')},0.5)`;
      const r = 0.5 + rnd() * 1.6; c.fillRect(x, y, r * 1.5, r);
    }
    // the throwing circle and its edge
    c.strokeStyle = 'rgba(255,246,226,0.5)'; c.lineWidth = 2.5; c.beginPath(); c.ellipse(X(0), Y(0), 7.5 * sx, 7.5 * sy, 0, 0, TAU); c.stroke();
    for (const q of T.stones) { c.fillStyle = 'rgba(96,86,74,0.95)'; c.beginPath(); c.ellipse(X(q.x), Y(q.y), q.r * sx * 1.4, q.r * sy * 1.4, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.ellipse(X(q.x) - 1, Y(q.y) - 1, q.r * sx * 0.7, q.r * sy * 0.6, 0, 0, TAU); c.fill(); }
  });
  // bump map: terrain relief plus fine grit
  const bw = 512, bh = Math.round(bw * (GY1 - GY0) / (GX1 - GX0));
  const bump = canvasTex(bw, bh, (c) => {
    const img = c.createImageData(bw, bh), d = img.data, r2 = lcg(T.seed ^ 0x9e37);
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
      const x = GX0 + (i / bw) * (GX1 - GX0), y = GY1 - (j / bh) * (GY1 - GY0);
      const v = 128 + Math.max(-90, Math.min(90, heightAt(T, x, y) * 11)) + (r2() - 0.5) * 22;
      const k = (j * bw + i) * 4; d[k] = d[k + 1] = d[k + 2] = v; d[k + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }, { srgb: false });
  const mat = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.1, roughness: 0.96, metalness: 0 });
  const g = new THREE.PlaneGeometry(GX1 - GX0, GY1 - GY0); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.position.set((GX0 + GX1) / 2, 0, -(GY0 + GY1) / 2); m.receiveShadow = true;
  m.userData.dispose = () => { map.dispose(); bump.dispose(); g.dispose(); mat.dispose(); };
  return m;
}

// ---------------------------------------------------------------- the lane borders: timber boards with a lit edge
function plankTex(col) {
  return canvasTex(256, 64, (c, w, h) => {
    c.fillStyle = col; c.fillRect(0, 0, w, h); const r = lcg(7);
    for (let i = 0; i < 80; i++) { c.fillStyle = `rgba(${r() < 0.5 ? '40,24,10' : '255,230,180'},${0.05 + r() * 0.12})`; c.fillRect(0, r() * h, w, 1 + r() * 2); }
    for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(30,16,6,0.35)'; c.fillRect(i * 44 + r() * 10, 0, 2, h); }
  }, { repeat: [6, 1] });
}
export function buildBorders(P) {
  const g = new THREE.Group(), tex = plankTex(P.plank);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0 });
  const y0 = -70, len = WALL_Y - y0;
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(5, 7, len), mat);
    b.position.set(s * (HALF + 3.5), 3.5, -(y0 + WALL_Y) / 2); b.castShadow = true; b.receiveShadow = true; g.add(b);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.2, len), new THREE.MeshStandardMaterial({ color: 0xd9b27a, roughness: 0.55 })); cap.position.set(s * (HALF + 3.5), 7.4, b.position.z); g.add(cap);
    // stakes
    for (let y = -40; y < WALL_Y; y += 90) { const st = new THREE.Mesh(new THREE.BoxGeometry(6, 11, 4), mat); st.position.set(s * (HALF + 3.5), 5, -y); st.castShadow = true; g.add(st); }
  }
  return g;
}

// ---------------------------------------------------------------- the sling frame (two posts; the bands are drawn by the 2D layer)
export function buildSling() {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0xb88a58, roughness: 0.62, metalness: 0.05 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.7 });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.8, 41, 14), mat); p.position.set(s * 30, 20.5, 4); p.castShadow = true; g.add(p);
    const top = new THREE.Mesh(new THREE.SphereGeometry(3.6, 14, 10), mat); top.position.set(s * 30, 41.5, 4); g.add(top);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.9, 8, 18), dark); ring.rotation.x = Math.PI / 2; ring.position.set(s * 30, 39, 4); g.add(ring);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 3, 16), dark); foot.position.set(s * 30, 1.5, 4); foot.castShadow = true; g.add(foot);
  }
  return g;
}

// ---------------------------------------------------------------- steel boules and the jack
export const TEAMS = [
  { color: 0x9db8ec, groove: 0x16327a, ring: 0x2d5ab4 },
  { color: 0xe69a62, groove: 0x6a1a0a, ring: 0xa84a1c },
];
export function makeBoule(team, env) {
  const T = TEAMS[team], g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(R_B, 40, 28), new THREE.MeshStandardMaterial({ color: T.color, metalness: 1, roughness: 0.2, envMapIntensity: 1.35 }));
  body.castShadow = true; g.add(body);
  const gm = new THREE.MeshStandardMaterial({ color: T.groove, metalness: 0.4, roughness: 0.45 });
  // engraved grooves: thin rings around two axes (they spin with the ball, so a rolling boule reads as rolling)
  for (const [rx, ry, off] of [[0, 0, 0], [Math.PI / 2, 0, 0], [0.5, 0.9, 0]]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(R_B * 0.99, 0.2, 8, 64), gm); t.rotation.set(rx, ry, 0); g.add(t);
  }
  const cap = new THREE.Mesh(new THREE.SphereGeometry(R_B * 1.003, 24, 12, 0, TAU, 0, 0.36), new THREE.MeshStandardMaterial({ color: T.ring, metalness: 0.5, roughness: 0.35 })); g.add(cap);
  g.userData = { body, rollQ: new THREE.Quaternion() };
  return g;
}
export function makeJack() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.SphereGeometry(R_J, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0xd8321c, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12 }));
  m.castShadow = true; g.add(m); g.userData = { body: m, rollQ: new THREE.Quaternion() };
  return g;
}

// ---------------------------------------------------------------- backdrop
const WALLS = ['#f0dcb2', '#e6c995', '#f4e6c8', '#dcb98c', '#c8a780'];
const ROOFS = ['#b25a34', '#a64a2a', '#c4663c', '#8e4a30'];
function stoneTex() {
  return canvasTex(512, 128, (c, w, h) => {
    const r = lcg(3); c.fillStyle = '#c6ad82'; c.fillRect(0, 0, w, h);
    for (let row = 0; row < 4; row++) for (let x = -((row * 37) % 60); x < w; x += 60 + r() * 30) { const ww = 52 + r() * 24; c.fillStyle = `rgba(${120 + r() * 40},${96 + r() * 30},${64 + r() * 24},0.42)`; c.fillRect(x + 1.5, row * 32 + 1.5, ww - 3, 29); }
    c.fillStyle = 'rgba(60,40,20,0.28)'; for (let row = 0; row <= 4; row++) c.fillRect(0, row * 32 - 1, w, 2);
  }, { repeat: [14, 1] });
}
function house(rnd, w, h, d, wallCol, roofCol) {
  const g = new THREE.Group();
  const win = canvasTex(64, 64, (c) => { c.fillStyle = wallCol; c.fillRect(0, 0, 64, 64); c.fillStyle = '#3a6f95'; c.fillRect(20, 14, 16, 26); c.fillStyle = '#6b4a2a'; c.fillRect(14, 12, 4, 30); c.fillRect(38, 12, 4, 30); }, { repeat: [Math.max(1, Math.round(w / 22)), Math.max(1, Math.round(h / 28))] });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: win, roughness: 0.9 })); body.position.y = h / 2; body.castShadow = true; g.add(body);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, Math.max(w, d) * 0.78, h * 0.42, 4), new THREE.MeshStandardMaterial({ color: roofCol, roughness: 0.8 }));
  roof.rotation.y = Math.PI / 4; roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d)); roof.position.y = h + h * 0.21; roof.castShadow = true; g.add(roof);
  return g;
}
function planeTree(rnd, scale = 1) {
  const g = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: 0xb9ab92, roughness: 0.95 });
  const h = (170 + rnd() * 60) * scale;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(6 * scale, 9 * scale, h, 10), bark); trunk.position.y = h / 2; trunk.castShadow = true; g.add(trunk);
  const cols = [0x3b6224, 0x47702b, 0x2f5420, 0x52802f];
  for (let i = 0; i < 7; i++) {
    const s = (34 + rnd() * 26) * scale; const m = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), new THREE.MeshStandardMaterial({ color: cols[i % 4], roughness: 0.9, flatShading: true }));
    m.position.set((rnd() - 0.5) * 84 * scale, h + (rnd() - 0.2) * 40 * scale, (rnd() - 0.5) * 64 * scale); m.scale.y = 0.8; g.add(m);
  }
  return g;
}
function oliveTree(rnd) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(5, 9, 46, 8), new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 1 })); trunk.position.y = 23; trunk.rotation.z = (rnd() - 0.5) * 0.3; trunk.castShadow = true; g.add(trunk);
  for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(24 + rnd() * 14, 8, 6), new THREE.MeshStandardMaterial({ color: 0x8a9a6a, roughness: 0.9, flatShading: true })); m.position.set((rnd() - 0.5) * 50, 58 + rnd() * 18, (rnd() - 0.5) * 40); m.scale.y = 0.65; g.add(m); }
  return g;
}
export function buildBackdrop(T) {
  const P = palOf(T), rnd = lcg(T.seed ^ 0x77aa), g = new THREE.Group();
  // sky dome
  const sky = canvasTex(8, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, P.skyA); gr.addColorStop(0.55, P.skyB); gr.addColorStop(1, P.skyB); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5200, 24, 16, 0, TAU, 0, Math.PI / 2 + 0.12), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.renderOrder = -2; g.add(dome);
  // distant hills
  for (let i = 0; i < 6; i++) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(500 + rnd() * 500, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(rgb(P.hill, 1 - i * 0.02)), fog: true }));
    h.scale.y = 0.26 + rnd() * 0.14; h.position.set((i - 2.5) * 900 + rnd() * 300, -60, -(2300 + rnd() * 500)); g.add(h);
  }
  // ground beyond the textured rectangle (verge colour, so the horizon never shows a seam)
  const far = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: new THREE.Color(rgb(P.verge, 0.9)), roughness: 1 }));
  far.position.set(0, -0.6, -3000); far.receiveShadow = true; g.add(far);
  // the stone wall that closes the lane
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2600, 40, 16), new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: 0.92 }));
  wall.position.set(0, 20, -(WALL_Y + 8)); wall.castShadow = true; wall.receiveShadow = true; g.add(wall);
  const coping = new THREE.Mesh(new THREE.BoxGeometry(2600, 3, 20), new THREE.MeshStandardMaterial({ color: 0xf2e4c0, roughness: 0.7 })); coping.position.set(0, 41.5, -(WALL_Y + 8)); g.add(coping);
  const pal = T.pal;
  if (pal === 'port') {
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 1500).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3f86b8, roughness: 0.18, metalness: 0.15 }));
    sea.position.set(0, 1, -(WALL_Y + 780)); g.add(sea);
    for (let i = 0; i < 6; i++) {
      const bx = -600 + i * 250 + rnd() * 80, bz = -(WALL_Y + 150 + rnd() * 400);
      const hull = new THREE.Mesh(new THREE.BoxGeometry(60, 12, 20), new THREE.MeshStandardMaterial({ color: [0xe9e2d0, 0x3e6ea6, 0xb44a30][i % 3], roughness: 0.6 })); hull.position.set(bx, 6, bz); hull.castShadow = true; g.add(hull);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 90, 6), new THREE.MeshStandardMaterial({ color: 0xcfc6b0 })); mast.position.set(bx, 55, bz); g.add(mast);
    }
    for (let i = 0; i < 12; i++) { const hw = 36 + rnd() * 30, hh = 40 + rnd() * 46; const hs = house(rnd, hw, hh, 40, WALLS[i % 5], ROOFS[i % 4]); hs.position.set(-700 + i * 120 + rnd() * 40, 0, -(WALL_Y + 1200 + rnd() * 80)); g.add(hs); }
  } else if (pal === 'colline') {
    for (let i = 0; i < 12; i++) {
      const row = new THREE.Mesh(new THREE.BoxGeometry(2400, 9, 14), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x7d5aa0 : 0x9a74c2, roughness: 0.9 })); row.position.set(0, 4.5 + i * 0.6, -(WALL_Y + 40 + i * 34)); g.add(row);
    }
    const fh = house(rnd, 120, 66, 70, '#ead6aa', '#c2663c'); fh.position.set(220, 0, -(WALL_Y + 520)); g.add(fh);
    for (let i = 0; i < 5; i++) { const cy = new THREE.Mesh(new THREE.CylinderGeometry(0, 10, 120, 8), new THREE.MeshStandardMaterial({ color: 0x28401f })); cy.position.set(-500 + i * 240 + rnd() * 60, 60, -(WALL_Y + 300 + rnd() * 200)); g.add(cy); }
  } else {
    const n = pal === 'village' ? 22 : 10;
    for (let i = 0; i < n; i++) {
      const hw = 34 + rnd() * 34, hh = 38 + rnd() * 46, hs = house(rnd, hw, hh, 36 + rnd() * 20, WALLS[Math.floor(rnd() * 5)], ROOFS[Math.floor(rnd() * 4)]);
      hs.position.set(-720 + i * (1440 / n) + (rnd() - 0.5) * 26, 0, -(WALL_Y + 70 + rnd() * 160 + (i % 3) * 60)); g.add(hs);
    }
    if (pal === 'village') {
      const tw = new THREE.Mesh(new THREE.BoxGeometry(26, 150, 26), new THREE.MeshStandardMaterial({ color: 0xe9d5a8, roughness: 0.9 })); tw.position.set(120, 75, -(WALL_Y + 230)); tw.castShadow = true; g.add(tw);
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0, 21, 36, 4), new THREE.MeshStandardMaterial({ color: 0xb0522e })); tr.rotation.y = Math.PI / 4; tr.position.set(120, 168, -(WALL_Y + 230)); g.add(tr);
    }
    for (let i = 0; i < 5; i++) { const cy = new THREE.Mesh(new THREE.CylinderGeometry(0, 11, 130, 8), new THREE.MeshStandardMaterial({ color: 0x263e28 })); cy.position.set(-560 + i * 270 + rnd() * 70, 65, -(WALL_Y + 160 + rnd() * 140)); g.add(cy); }
  }
  // trees along the lane: plane trees (village / oliviers), olives (oliviers, colline), none at the port
  const place = (mk, x, y, s) => { const t = mk(rnd, s); t.position.set(x, 0, -y); t.rotation.y = rnd() * TAU; g.add(t); };
  if (pal === 'village') for (const [x, y] of [[-150, 70], [150, 230], [-160, 420], [155, 610], [-290, 250], [300, 450]]) place(planeTree, x, y, 1);
  else if (pal === 'oliviers') { for (const [x, y] of [[-170, 140], [175, 330], [-165, 520], [250, 600], [-290, 360]]) place(oliveTree, x, y, 1); for (const [x, y] of [[170, 70], [-300, 600]]) place(planeTree, x, y, 0.9); }
  else if (pal === 'colline') for (const [x, y] of [[-190, 120], [190, 420], [-200, 600]]) place(oliveTree, x, y, 1);
  return g;
}

// ---------------------------------------------------------------- lights
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xbcd2f4, 0x6a5034, 0.5); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe6b8, 3.1); sun.position.set(-260, 420, 160); sun.target.position.set(0, 0, -300);
  sun.shadow.camera.left = -190; sun.shadow.camera.right = 190; sun.shadow.camera.top = 560; sun.shadow.camera.bottom = -330; sun.shadow.camera.near = 50; sun.shadow.camera.far = 1500;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6; scene.add(sun, sun.target);
  return { hemi, sun };
}
export { PAL };

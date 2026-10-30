// The 3D world of Ken and Ball: a turned-wood ken, a red lacquer ball and a cord, in a moonlit garden seen from an engawa (wooden
// veranda): raked gravel, a stone lantern with a glowing paper box, bamboo, mountains and the moon. Units = the sim's world units
// (the toy is 720 wide); three.js y is UP, so a sim (x, y) becomes (x, -y). The camera is frontal (see presenter.js), so the toy's
// plane z = 0 maps 1:1 onto the 2D layer's world and every tap/drag still lands where it looks.
import * as THREE from '../vendor3d/three.js';
import { CUPS, R as BALL_R } from '../src/phys.js';

export const FLOOR = 1088;           // the deck top (sim y), where the ball's shadow lies
export const HORIZON = 300;          // sim y of the camera = the horizon line
export const CAM_D = 1100;           // camera distance from the toy plane
const GROUND = FLOOR + 90;           // the garden lies a step below the deck
const DECK_EDGE = -330;              // z of the back edge of the deck
const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, repeat = null, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); } return t; };

export function radialTex(rgb, a = 1, hard = 0) {
  const c = cv(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, hard * 60, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.35})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c);
}

// ---- textures --------------------------------------------------------------------------------
// Beech grain for turned parts: streaks run along v (the length of a lathe), colour varies round the circumference (u).
function woodTex(base = [236, 206, 150], seed = 3) {
  const c = cv(256, 256), x = c.getContext('2d'), r = lcg(seed);
  x.fillStyle = `rgb(${base})`; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    const px = r() * 256, w = 1 + r() * 5, d = r() * 0.3;
    x.fillStyle = `rgba(${Math.round(base[0] * 0.55)},${Math.round(base[1] * 0.42)},${Math.round(base[2] * 0.3)},${0.05 + d * 0.5})`;
    x.beginPath(); x.moveTo(px, 0);
    for (let y = 0; y <= 256; y += 32) x.lineTo(px + Math.sin(y * 0.03 + i) * 3 + w, y);
    for (let y = 256; y >= 0; y -= 32) x.lineTo(px + Math.sin(y * 0.03 + i) * 3, y);
    x.fill();
  }
  return tex(c);
}
function deckTex() {
  const c = cv(1024, 512), x = c.getContext('2d'), r = lcg(21), n = 6, bh = 512 / n;
  for (let b = 0; b < n; b++) {
    const t = 0.78 + r() * 0.3, y0 = b * bh;
    x.fillStyle = `rgb(${Math.round(112 * t)},${Math.round(78 * t)},${Math.round(52 * t)})`; x.fillRect(0, y0, 1024, bh);
    for (let i = 0; i < 46; i++) { const yy = y0 + 3 + r() * (bh - 6); x.strokeStyle = `rgba(${r() < 0.5 ? '40,22,12' : '170,126,86'},${0.05 + r() * 0.12})`; x.lineWidth = 0.8 + r() * 1.6; x.beginPath(); x.moveTo(r() * 300 - 100, yy); x.bezierCurveTo(300, yy + r() * 6 - 3, 700, yy + r() * 6 - 3, 1124, yy + r() * 8 - 4); x.stroke(); }
    const sx = r() * 1024; x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(sx, y0, 3, bh);       // butt joint
    x.fillStyle = 'rgba(8,4,2,0.85)'; x.fillRect(0, y0, 1024, 4);                                // gap between boards
    x.fillStyle = 'rgba(255,214,170,0.14)'; x.fillRect(0, y0 + 4, 1024, 2);
  }
  return tex(c, [7.5, 3.6]);
}
function gravelTex() {
  const c = cv(1024, 256), x = c.getContext('2d'), r = lcg(8);
  x.fillStyle = '#6a7088'; x.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '210,214,232' : '40,44,64'},${0.05 + r() * 0.13})`; x.fillRect(r() * 1024, r() * 256, 1 + r() * 2.5, 1 + r() * 2.5); }
  for (let i = 0; i < 16; i++) { const y = i * 16 + 8; x.strokeStyle = 'rgba(30,34,56,0.4)'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(340, y + 2, 680, y - 2, 1024, y); x.stroke(); x.strokeStyle = 'rgba(226,230,250,0.14)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, y + 4); x.bezierCurveTo(340, y + 6, 680, y + 2, 1024, y + 4); x.stroke(); }
  return tex(c, [14, 50]);
}
function skyTex() {
  const c = cv(4, 512), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 512);
  [[0, '#070b24'], [0.3, '#131c4a'], [0.58, '#2c3a82'], [0.76, '#6a5a9c'], [0.88, '#d68a86'], [0.94, '#f0b08a'], [1, '#f6c8a0']].forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g; x.fillRect(0, 0, 4, 512); return tex(c);
}
function moonTex() {
  const c = cv(512, 512), x = c.getContext('2d');
  let g = x.createRadialGradient(256, 256, 40, 256, 256, 256); g.addColorStop(0, 'rgba(255,236,200,0.55)'); g.addColorStop(0.35, 'rgba(255,214,170,0.16)'); g.addColorStop(1, 'rgba(255,214,170,0)'); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  g = x.createRadialGradient(236, 232, 10, 256, 256, 100); g.addColorStop(0, '#fffaf0'); g.addColorStop(0.8, '#f4e2bc'); g.addColorStop(1, '#e6cb9a'); x.fillStyle = g; x.beginPath(); x.arc(256, 256, 98, 0, TAU); x.fill();
  x.fillStyle = 'rgba(190,160,120,0.24)'; [[-34, -10, 24], [28, 30, 17], [10, -40, 13], [-8, 48, 10], [48, -22, 8]].forEach(([dx, dy, rr]) => { x.beginPath(); x.arc(256 + dx, 256 + dy, rr, 0, TAU); x.fill(); });
  return tex(c);
}
function leafTex() {
  const c = cv(256, 256), x = c.getContext('2d'), r = lcg(5);
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.6, len = 70 + r() * 80, w = 7 + r() * 5, ox = 128, oy = 230;
    x.save(); x.translate(ox, oy); x.rotate(a + Math.PI / 2); x.fillStyle = r() < 0.5 ? '#16352f' : '#1d4538';
    x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(w, -len * 0.5, 0, -len); x.quadraticCurveTo(-w, -len * 0.5, 0, 0); x.fill(); x.restore();
  }
  return tex(c);
}

// ---- the ken ---------------------------------------------------------------------------------
const lathe = (pts, seg = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
function cupGeo(Ro) {
  const Ri = Ro - 6;
  return lathe([[0.01, -36], [Ro * 0.34, -33.5], [Ro * 0.66, -24], [Ro * 0.9, -9], [Ro, 4], [Ro, 12], [Ro - 1.8, 13.4], [Ri + 1.6, 13.4], [Ri, 12], [Ri * 0.96, 4], [Ri * 0.8, -1], [Ri * 0.45, -3.6], [0.01, -4.2]], 36);
}
export const TINT = { big: 0x3f78e0, small: 0x2fb592, spike: 0xf0bd3c, base: 0x9a67d8 };

export function buildKen() {
  const g = new THREE.Group();
  const wood = new THREE.MeshPhysicalMaterial({ map: woodTex(), roughness: 0.46, clearcoat: 0.55, clearcoatRoughness: 0.28, side: THREE.DoubleSide });
  const woodDark = new THREE.MeshStandardMaterial({ map: woodTex([196, 150, 98], 9), roughness: 0.5 });
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0xc8301f, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 });
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  // handle (kenpo): slightly waisted, ken-local y 4..194
  mesh(lathe([[0.01, -2], [9, -3], [11, -10], [10.4, -60], [9.8, -110], [10.8, -150], [11.6, -186], [9, -194.5], [0.01, -196]], 32), wood);
  mesh(new THREE.CylinderGeometry(11.7, 11.7, 9, 32), lacquer, 0, -132.5, 0);
  mesh(new THREE.CylinderGeometry(11.5, 11.5, 3, 32), woodDark, 0, -143.5, 0);
  // spike (ken-saki): tapered tip, cut hole shows at the top
  mesh(lathe([[0.01, 63], [2.4, 62], [3.6, 57], [5.4, 28], [8.6, 4], [9.6, -3], [0.01, -3]], 24), wood);
  const spikeRing = new THREE.Mesh(new THREE.TorusGeometry(10, 1.6, 8, 28), lacquer); spikeRing.rotation.x = Math.PI / 2; spikeRing.position.y = 0; g.add(spikeRing);
  // crossbar: a rounded beam through both cups
  const bar = new THREE.Mesh(new THREE.CapsuleGeometry(8.6, 227, 6, 16), wood); bar.rotation.z = Math.PI / 2; bar.position.set(-6, -5, 0); bar.castShadow = bar.receiveShadow = true; g.add(bar);
  // cups
  const glows = {};
  const cup = (key, c, Ro, flip = false) => {
    const m = mesh(cupGeo(Ro), wood, c.x, flip ? -182 : 0, 0);
    if (flip) m.scale.y = -1;
    const ringMat = new THREE.MeshPhysicalMaterial({ color: TINT[key], roughness: 0.28, clearcoat: 1, emissive: TINT[key], emissiveIntensity: 0.0 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(Ro * 0.9, 2.6, 8, 40), ringMat); ring.rotation.x = Math.PI / 2; ring.position.set(c.x, flip ? -182 + 6 * 1 : -7, 0); ring.castShadow = true; g.add(ring);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(Ro + 5, 3.2, 8, 48), new THREE.MeshBasicMaterial({ color: TINT[key], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.rotation.x = Math.PI / 2; halo.position.set(c.x, flip ? -194 : 12, 0); g.add(halo);
    glows[key] = { halo, ringMat };
  };
  cup('big', CUPS.big, CUPS.big.w / 2 + 6); cup('small', CUPS.small, CUPS.small.w / 2 + 6); cup('base', CUPS.base, CUPS.base.w / 2 + 5, true);
  { const halo = new THREE.Mesh(new THREE.TorusGeometry(15, 3, 8, 40), new THREE.MeshBasicMaterial({ color: TINT.spike, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); halo.rotation.x = Math.PI / 2; halo.position.y = 62; g.add(halo); glows.spike = { halo, ringMat: null }; }
  // string eye
  const eye = new THREE.Mesh(new THREE.TorusGeometry(3.4, 1.1, 6, 16), woodDark); eye.position.set(0, -5, 12); g.add(eye);
  g.userData.glows = glows;
  return g;
}

// ---- the ball (tama): red lacquer sphere with the hole in +x, gold bands ------------------------
export function buildBall() {
  const g = new THREE.Group(), r = BALL_R;
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0xcf3320, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide });
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xe9b64f, roughness: 0.3, metalness: 0.7, clearcoat: 0.5 });
  const geo = new THREE.SphereGeometry(r, 48, 32, 0, TAU, 0.34, Math.PI - 0.34); geo.rotateZ(-Math.PI / 2);   // pole (and the hole) towards +x
  const body = new THREE.Mesh(geo, lacquer); body.castShadow = body.receiveShadow = true; g.add(body);
  const hole = new THREE.Mesh(new THREE.SphereGeometry(r * 0.94, 24, 16, 0, TAU, 0, 0.44), new THREE.MeshStandardMaterial({ color: 0x1a0805, roughness: 0.9, side: THREE.BackSide })); hole.rotation.z = -Math.PI / 2; g.add(hole);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(r * Math.sin(0.34), 1.3, 8, 28), gold); lip.rotation.y = Math.PI / 2; lip.position.x = r * Math.cos(0.34); g.add(lip);
  for (const [px, k, tb] of [[0.18, 1, 1.2], [-0.42, 1, 0.9]]) { const rr = r * Math.sqrt(1 - px * px) + 0.25, t = new THREE.Mesh(new THREE.TorusGeometry(rr * k, tb, 8, 56), gold); t.rotation.y = Math.PI / 2; t.position.x = r * px; g.add(t); }
  return g;
}

// ---- the cord: a tube updated in place from the sim's rope nodes ----------------------------------
export function buildCord(segs = 44, radial = 6) {
  const pos = new Float32Array((segs + 1) * radial * 3), nor = new Float32Array(pos.length), idx = [];
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) { const a = i * radial + j, b = i * radial + (j + 1) % radial, c = (i + 1) * radial + j, d = (i + 1) * radial + (j + 1) % radial; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xefe3c6, roughness: 0.85 })); mesh.castShadow = true; mesh.frustumCulled = false;
  const pts = Array.from({ length: 15 }, () => new THREE.Vector3());
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const T = new THREE.Vector3();
  mesh.userData.update = (rp) => {
    for (let i = 0; i < 15; i++) pts[i].set(rp.x[i], -rp.y[i], 0);
    for (let i = 0; i <= segs; i++) {
      const u = i / segs, p = curve.getPoint(u); curve.getTangent(u, T);
      const nx = -T.y, ny = T.x;
      for (let j = 0; j < radial; j++) {
        const a = (j / radial) * TAU, c = Math.cos(a), s = Math.sin(a), o = (i * radial + j) * 3;
        const vx = nx * c, vy = ny * c, vz = s;
        nor[o] = vx; nor[o + 1] = vy; nor[o + 2] = vz;
        pos[o] = p.x + vx * 1.9; pos[o + 1] = p.y + vy * 1.9; pos[o + 2] = p.z + vz * 1.9;
      }
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true;
  };
  return mesh;
}

// ---- the garden --------------------------------------------------------------------------------
// Edge groups follow the left and right edges of the screen (so wide windows still have bamboo at the sides): the presenter moves
// them every frame. `far(xs, z)` places something at depth z so it appears at screen x = xs on the toy plane.
export function buildGarden(tier) {
  const root = new THREE.Group(), r = lcg(17);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(40000, 3400), new THREE.MeshBasicMaterial({ map: skyTex(), fog: false, depthWrite: false })); sky.position.set(0, -HORIZON + 1500, -9000); sky.renderOrder = -10; root.add(sky);
  // stars
  { const n = 260, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { p[i * 3] = (r() - 0.5) * 17000; p[i * 3 + 1] = -HORIZON + 700 + r() * 5200; p[i * 3 + 2] = -8800; } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff4d8, size: 5, map: radialTex('255,244,216', 1, 0.1), sizeAttenuation: false, transparent: true, opacity: 0.85, fog: false, depthWrite: false })); root.add(pts); }
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: moonTex(), transparent: true, fog: false, depthWrite: false })); moon.renderOrder = -9; root.add(moon);
  // mountains: two ridges
  const ridge = (z, col, amp, seed, w = 16000) => {
    const rr = lcg(seed), sh = new THREE.Shape(), steps = 80; sh.moveTo(-w / 2, -880);
    let ph = rr() * 6;
    for (let i = 0; i <= steps; i++) { const x = -w / 2 + (w * i) / steps; sh.lineTo(x, amp * (0.55 + 0.45 * Math.sin(ph + i * 0.21)) + amp * 0.5 * Math.sin(ph * 1.7 + i * 0.57) * (0.6 + 0.4 * rr())); }
    sh.lineTo(w / 2, -880); sh.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: col })); m.position.set(0, -HORIZON, z); root.add(m); return m;
  };
  ridge(-9000, 0x6a5f9a, 1300, 3, 40000); ridge(-7200, 0x52498a, 1000, 7, 34000); ridge(-5200, 0x3a3478, 700, 11, 28000);
  // ground: raked gravel, and the deck
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40000, 20000), new THREE.MeshStandardMaterial({ map: gravelTex(), roughness: 0.95, color: 0xb8bcd8 })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -GROUND, DECK_EDGE - 10000 + 40); ground.receiveShadow = true; root.add(ground);
  const dk = deckTex();
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(9000, 1800), new THREE.MeshStandardMaterial({ map: dk, roughness: 0.55, bumpMap: dk, bumpScale: 1.4 })); deck.rotation.x = -Math.PI / 2; deck.position.set(0, -FLOOR, DECK_EDGE + 900); deck.receiveShadow = true; root.add(deck);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(9000, GROUND - FLOOR + 18, 16), new THREE.MeshStandardMaterial({ map: woodTex([150, 108, 70], 4), roughness: 0.6 })); edge.position.set(0, -(FLOOR + GROUND) / 2 - 6, DECK_EDGE - 6); edge.receiveShadow = true; edge.castShadow = true; root.add(edge);
  // stepping stones leading away from the deck
  for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(70 - i * 5, 76 - i * 5, 22, 12), new THREE.MeshStandardMaterial({ color: 0x7c8096, roughness: 0.9 })); s.position.set(-30 + Math.sin(i * 1.7) * 90, -GROUND + 8, DECK_EDGE - 150 - i * 210); s.scale.z = 0.7; s.receiveShadow = true; s.castShadow = true; root.add(s); }
  // bamboo (edge groups)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x244a40, roughness: 0.55 }), ringMat = new THREE.MeshStandardMaterial({ color: 0x1a3830, roughness: 0.6 });
  const leaves = leafTex(), leafMat = new THREE.MeshBasicMaterial({ map: leaves, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, fog: true });
  const trunks = [];
  const edgeGroup = (side) => {
    const eg = new THREE.Group(), n = tier === 2 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const z = -420 - r() * 900, rad = 14 + r() * 12, h = 2600, off = 4 + i * 46 * (0.6 + r() * 0.6) + (side < 0 ? 0 : 14), lean = (r() - 0.5) * 0.04;
      const tr = new THREE.Group(); tr.position.set(0, -GROUND, z); tr.rotation.z = lean; trunks.push({ g: tr, off, z, side });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.86, rad, h, 14), trunkMat); trunk.position.y = h / 2; tr.add(trunk);
      for (let y = 160; y < h; y += 230 + r() * 40) { const nd = new THREE.Mesh(new THREE.TorusGeometry(rad * 0.93, 3, 6, 14), ringMat); nd.rotation.x = Math.PI / 2; nd.position.y = y; tr.add(nd); }
      const nl = tier === 2 ? 2 : 5;
      for (let k = 0; k < nl; k++) { const lf = new THREE.Mesh(new THREE.PlaneGeometry(250, 250), leafMat); lf.position.set((r() - 0.5) * 120, 900 + k * 300 + r() * 140, (r() - 0.5) * 60); lf.rotation.z = (r() - 0.5) * 1.1; lf.scale.x = r() < 0.5 ? -1 : 1; tr.add(lf); }
      eg.add(tr);
    }
    return eg;
  };
  const left = edgeGroup(-1), right = edgeGroup(1); root.add(left, right);
  // stone lantern with a glowing paper box
  const lan = new THREE.Group(), stone = new THREE.MeshStandardMaterial({ color: 0x6f7390, roughness: 0.92 });
  const part = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true; lan.add(m); return m; };
  part(new THREE.CylinderGeometry(46, 54, 22, 6), stone, 11); part(new THREE.CylinderGeometry(15, 19, 120, 10), stone, 82); part(new THREE.CylinderGeometry(40, 28, 16, 6), stone, 150);
  const paper = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xff9a3c, emissiveIntensity: 1.7, roughness: 0.9 });
  const box = part(new THREE.BoxGeometry(46, 52, 46), paper, 184);
  for (const [bx, bz, w, d] of [[0, 25, 54, 6], [0, -25, 54, 6], [25, 0, 6, 54], [-25, 0, 6, 54]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, 60, d), stone); f.position.set(bx, 184, bz); f.visible = false; lan.add(f); }
  part(new THREE.CylinderGeometry(2, 72, 46, 6), stone, 232); part(new THREE.SphereGeometry(11, 14, 10), stone, 262);
  const lanLight = new THREE.PointLight(0xffa24a, 480000, 0, 2); lanLight.position.set(0, 190, 70); lan.add(lanLight);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(330, 330), new THREE.MeshBasicMaterial({ map: radialTex('255,176,90', 0.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); halo.position.set(0, 190, 40); lan.add(halo);
  lan.position.set(0, -GROUND, -560); root.add(lan);
  // paper lantern (andon) on the deck, warm pool of light
  const and = new THREE.Group();
  const wd = new THREE.MeshStandardMaterial({ map: woodTex([120, 82, 52], 6), roughness: 0.6 });
  for (const [x, z] of [[-26, -26], [26, -26], [-26, 26], [26, 26]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(6, 110, 6), wd); p.position.set(x, 55, z); p.castShadow = true; and.add(p); }
  const shade = new THREE.Mesh(new THREE.BoxGeometry(50, 96, 50), new THREE.MeshStandardMaterial({ color: 0xffe6bf, emissive: 0xffa040, emissiveIntensity: 1.5, roughness: 0.9 })); shade.position.y = 55; and.add(shade);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(70, 8, 70), wd); cap.position.y = 112; and.add(cap);
  const andLight = new THREE.PointLight(0xffb060, 90000, 0, 2); andLight.position.set(0, 60, 40); and.add(andLight);
  const andHalo = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshBasicMaterial({ map: radialTex('255,184,100', 0.7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); andHalo.position.set(0, 60, 45); and.add(andHalo);
  and.position.set(0, -FLOOR, -180); root.add(and);
  return { trunks, root, sky, moon, left, right, lan, and, lanLight, andLight, halo, andHalo, paper, shade };
}

// place something at depth z so that it appears at screen (xs, ys) of the toy plane
export const far = (cx, cy, xs, ys, z) => { const k = (CAM_D - z) / CAM_D; return [cx + (xs - cx) * k, cy + (ys - cy) * k]; };

export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0x6b7fc0, 0x2a1c18, 0.7); scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xbac8ff, 2.3); moon.position.set(-520, 900, 800); moon.target.position.set(360, -640, 0);
  const sc = moon.shadow.camera; sc.left = -760; sc.right = 760; sc.top = 700; sc.bottom = -700; sc.near = 200; sc.far = 3200;
  moon.shadow.bias = -0.0004; moon.shadow.normalBias = 1.2; moon.shadow.radius = 5;
  scene.add(moon, moon.target);
  const warm = new THREE.DirectionalLight(0xffb070, 0.9); warm.position.set(700, 200, 500); warm.target.position.set(360, -640, 0); scene.add(warm, warm.target);
  return { hemi, moon, warm };
}

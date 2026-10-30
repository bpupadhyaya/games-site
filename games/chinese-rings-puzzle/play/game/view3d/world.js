// Chinese Rings 3D world: a scholar's desk under a warm lamp (rosewood top, a carved lattice window glowing behind, a celadon cup, a jade bi
// disc, a lacquer box) and the puzzle itself: a red-lacquer base, steel posts, the bar with its handle, loop end and tassel, and real metal
// tori. Units are centimetres; the puzzle is built from the same geometry the 2D art uses (art.js sceneGeom), 1 scene unit = S cm, so a
// ring's column in 3D is exactly its column in 2D. Procedural textures only (no bitmaps shipped).
import * as THREE from '../vendor3d/three.js';
import { sceneGeom } from '../src/art.js';

export const S = 0.03;                    // cm per 2D scene unit (4 rings: ring 5 cm across, puzzle 17.5 cm long; 9 rings: 25.7 cm)
export const TUBE = 0.14;
const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const canvasTex = (w, h, draw, srgb = true) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
};

// ------------------------------------------------------------------------------------------------ materials
export const RING_FINISH = {
  steel: { color: 0xdfe4ec, rough: 0.16, metal: 1, glow: 0xd8e4f6 },
  brass: { color: 0xe8b65c, rough: 0.2, metal: 1, glow: 0xf6c86e },
  iron: { color: 0x4a4d55, rough: 0.42, metal: 0.9, glow: 0xaab4c8 },
};
export function ringMaterial(fin) {
  const f = RING_FINISH[fin] || RING_FINISH.steel;
  return new THREE.MeshPhysicalMaterial({ color: f.color, metalness: f.metal, roughness: f.rough, envMapIntensity: 1.6, clearcoat: fin === 'iron' ? 0.3 : 0, clearcoatRoughness: 0.3, emissive: 0x000000 });
}
let shared = null;
function mats() {
  if (shared) return shared;
  const lacquerTex = canvasTex(512, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#b02a1c'); g.addColorStop(1, '#8a1d13'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    const rnd = lcg(5); x.lineWidth = 1;
    for (let i = 0; i < 140; i++) { x.strokeStyle = `rgba(${rnd() < 0.5 ? '60,8,4' : '220,90,60'},${0.04 + rnd() * 0.05})`; const y = rnd() * h; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(w * 0.3, y + rnd() * 8 - 4, w * 0.7, y + rnd() * 8 - 4, w, y + rnd() * 6 - 3); x.stroke(); }
  });
  shared = {
    lacquer: new THREE.MeshPhysicalMaterial({ map: lacquerTex, color: 0xe4b0a8, roughness: 0.5, clearcoat: 0.8, clearcoatRoughness: 0.16, envMapIntensity: 0.14 }),
    lacquerDark: new THREE.MeshPhysicalMaterial({ color: 0x2a0806, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.12 }),
    handle: new THREE.MeshPhysicalMaterial({ color: 0xc8301f, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xe0ac4a, metalness: 1, roughness: 0.26, envMapIntensity: 1.4 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xd4d9e2, metalness: 1, roughness: 0.2, envMapIntensity: 1.6 }),
    hole: new THREE.MeshStandardMaterial({ color: 0x120403, roughness: 0.9 }),
    silk: new THREE.MeshStandardMaterial({ color: 0xc22a1f, roughness: 0.75 }),
    celadon: new THREE.MeshPhysicalMaterial({ color: 0x9ec4ab, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.3 }),
    celadonIn: new THREE.MeshPhysicalMaterial({ color: 0xb6d4bf, roughness: 0.1, clearcoat: 1, side: THREE.DoubleSide }),
    tea: new THREE.MeshPhysicalMaterial({ color: 0x6a4a12, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.92 }),
    jade: new THREE.MeshPhysicalMaterial({ color: 0x3f8f68, roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.1, emissive: 0x0b2a1c, emissiveIntensity: 1, sheen: 0.4, sheenColor: 0x9fe8c4 }),
  };
  return shared;
}
export function clearMaterialCache() { shared = null; }

// ------------------------------------------------------------------------------------------------ the desk and the room
export function desk() {
  const g = new THREE.Group();
  const rnd = lcg(21);
  const draw = (x, w, h, bump) => {
    if (!bump) { const bg = x.createLinearGradient(0, 0, w, 0); bg.addColorStop(0, '#3b170e'); bg.addColorStop(0.5, '#4a1d10'); bg.addColorStop(1, '#361309'); x.fillStyle = bg; } else x.fillStyle = '#808080';
    x.fillRect(0, 0, w, h);
    const r2 = lcg(bump ? 21 : 21);
    for (let i = 0; i < 260; i++) {                                    // rosewood grain: long wavy streaks along x, a few dark pores
      const y0 = r2() * h, amp = 2 + r2() * 9, ph = r2() * TAU, dark = r2() < 0.6, a = 0.05 + r2() * 0.12;
      x.strokeStyle = bump ? (dark ? `rgba(40,40,40,${a * 1.6})` : `rgba(200,200,200,${a})`) : dark ? `rgba(20,5,2,${a * 1.6})` : `rgba(140,62,32,${a})`;
      x.lineWidth = 0.6 + r2() * 2.4; x.beginPath();
      for (let xx = 0; xx <= w; xx += 16) { const yy = y0 + Math.sin(xx / w * TAU * (1 + (i % 3)) + ph) * amp; xx ? x.lineTo(xx, yy) : x.moveTo(xx, yy); }
      x.stroke();
    }
    for (let i = 0; i < 900; i++) { x.fillStyle = bump ? 'rgba(30,30,30,0.5)' : 'rgba(15,4,1,0.35)'; x.fillRect(r2() * w, r2() * h, 1 + r2() * 3, 1); }
  };
  const map = canvasTex(1024, 512, (x, w, h) => draw(x, w, h, false)); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(3, 3);
  const bump = canvasTex(1024, 512, (x, w, h) => draw(x, w, h, true), false); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(3, 3);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(240, 160), new THREE.MeshPhysicalMaterial({ map, bumpMap: bump, bumpScale: 0.6, roughness: 0.82, clearcoat: 0.18, clearcoatRoughness: 0.5, color: 0xc89c84, envMapIntensity: 0.05 }));
  top.rotation.x = -Math.PI / 2; top.position.z = -30; top.receiveShadow = true; g.add(top);
  // the desk's front edge with a soft rounded lip (seen on tall phone screens below the puzzle)
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 240, 16, 1), new THREE.MeshPhysicalMaterial({ color: 0x3a150b, roughness: 0.4, clearcoat: 0.6 }));
  lip.rotation.z = Math.PI / 2; lip.position.set(0, -1.2, 50); g.add(lip);
  // the carved lattice window far behind: warm paper glowing through a dark wooden lattice
  const win = canvasTex(1024, 512, (x, w, h) => {
    const pg = x.createRadialGradient(w * 0.45, h * 0.42, 20, w * 0.5, h * 0.5, w * 0.6); pg.addColorStop(0, '#ffd9a0'); pg.addColorStop(0.5, '#d08848'); pg.addColorStop(1, '#4a2012');
    x.fillStyle = pg; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(26,8,5,0.92)'; x.lineCap = 'square';
    const cell = 64; x.lineWidth = 7;
    for (let X = 0; X <= w; X += cell) { x.beginPath(); x.moveTo(X, 0); x.lineTo(X, h); x.stroke(); }
    for (let Y = 0; Y <= h; Y += cell) { x.beginPath(); x.moveTo(0, Y); x.lineTo(w, Y); x.stroke(); }
    x.lineWidth = 3;                                                       // a small key fret inside each cell
    for (let X = 0; X < w; X += cell) for (let Y = 0; Y < h; Y += cell) { const c = cell; x.beginPath(); x.moveTo(X + c * 0.28, Y + c * 0.72); x.lineTo(X + c * 0.28, Y + c * 0.28); x.lineTo(X + c * 0.72, Y + c * 0.28); x.lineTo(X + c * 0.72, Y + c * 0.55); x.lineTo(X + c * 0.5, Y + c * 0.55); x.stroke(); }
    x.lineWidth = 30; x.strokeStyle = '#1a0805'; x.strokeRect(0, 0, w, h);
    x.filter = 'blur(3px)'; x.drawImage(x.canvas, 0, 0); x.filter = 'none';
  });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(84, 42), new THREE.MeshBasicMaterial({ map: win, color: 0x4e3a32, fog: true }));
  wall.position.set(-12, 16, -70); g.add(wall);
  const wallDark = new THREE.Mesh(new THREE.PlaneGeometry(600, 300), new THREE.MeshStandardMaterial({ color: 0x1c0b08, roughness: 1 }));
  wallDark.position.set(0, 60, -71); g.add(wallDark);
  void rnd;
  return g;
}

export function props() {
  const m = mats(), g = new THREE.Group();
  // celadon tea cup with tea, on the back right
  const cupPts = []; for (let i = 0; i <= 14; i++) { const u = i / 14; cupPts.push(new THREE.Vector2(1.7 + 2.0 * Math.pow(u, 0.8) + (u > 0.95 ? 0.08 : 0), u * 4.2)); }
  const cup = new THREE.Mesh(new THREE.LatheGeometry(cupPts, 40), m.celadon); cup.castShadow = true; cup.receiveShadow = true;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.6, 0.5, 40), m.celadon); foot.position.y = 0.25; foot.castShadow = true;
  const inner = new THREE.Mesh(new THREE.LatheGeometry(cupPts.map((p) => new THREE.Vector2(Math.max(0.01, p.x - 0.22), p.y + 0.15)), 40), m.celadonIn);
  const tea = new THREE.Mesh(new THREE.CircleGeometry(3.15, 40), m.tea); tea.rotation.x = -Math.PI / 2; tea.position.y = 3.0;
  const cupG = new THREE.Group(); cupG.add(cup, foot, inner, tea); cupG.position.set(44, 0, -26); g.add(cupG);
  // a jade bi disc lying flat, front left
  const biPts = [[1.1, 0], [3.2, 0], [3.35, 0.25], [3.2, 0.5], [1.1, 0.5], [0.95, 0.25]].map(([a, b]) => new THREE.Vector2(a, b)); biPts.push(biPts[0].clone());
  const bi = new THREE.Mesh(new THREE.LatheGeometry(biPts, 64), m.jade); bi.castShadow = true; bi.receiveShadow = true; bi.position.set(-34, 0.01, 2); g.add(bi);
  // a small red lacquer box with a brass clasp, back left
  const box = new THREE.Mesh(new THREE.BoxGeometry(9, 3.2, 6.5), m.lacquerDark); box.position.set(-38, 1.6, -30); box.rotation.y = 0.35; box.castShadow = true; box.receiveShadow = true;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(9.3, 0.6, 6.8), m.handle); lid.position.set(0, 1.9, 0); box.add(lid);
  const clasp = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.2), m.brass); clasp.position.set(0, 1.1, 3.42); box.add(clasp);
  g.add(box);
  return g;
}

// ------------------------------------------------------------------------------------------------ the puzzle
const numberTex = new Map();
function plaqueTex(k) {
  if (numberTex.has(k)) return numberTex.get(k);
  const t = canvasTex(128, 128, (x) => {
    const g = x.createRadialGradient(48, 44, 6, 64, 64, 62); g.addColorStop(0, '#fff2c0'); g.addColorStop(0.6, '#e3ad46'); g.addColorStop(1, '#8a5c12');
    x.fillStyle = g; x.beginPath(); x.arc(64, 64, 62, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(70,40,4,0.8)'; x.lineWidth = 5; x.beginPath(); x.arc(64, 64, 52, 0, TAU); x.stroke();
    x.fillStyle = '#3a1d02'; x.font = '700 70px "Cinzel", Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(k), 64, 70);
  });
  numberTex.set(k, t); return t;
}
export function clearNumberTex() { for (const t of numberTex.values()) t.dispose(); numberTex.clear(); }

const glowTex = (() => { let t = null; return () => t || (t = canvasTex(128, 128, (x) => {
  const g = x.createRadialGradient(64, 64, 20, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.62, 'rgba(255,255,255,0.9)'); g.addColorStop(0.78, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
})); })();

// Rounded-rectangle loop (the closed end of the bar) as a tube path in the x/z plane.
function loopCurve(x0, x1, hz) {
  const pts = [], r = hz, n = 10;
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + i / n * Math.PI; pts.push(new THREE.Vector3(x1 - r + Math.cos(a) * r, 0, Math.sin(a) * r)); }
  for (let i = 0; i <= n; i++) { const a = Math.PI / 2 + i / n * Math.PI; pts.push(new THREE.Vector3(x0 + r + Math.cos(a) * r, 0, Math.sin(a) * r)); }
  return new THREE.CatmullRomCurve3(pts, true);
}

// n rings, finish: returns { group, G, X, Y, rings[{pivot, mesh, glow, stem}], tassel, baseD }
export function buildPuzzle(n, finish) {
  const m = mats(), G = sceneGeom(n), g = new THREE.Group();
  const X = (gx) => (gx - G.W / 2) * S, BH = G.baseH * S, Y = (gy) => (G.baseTop - gy) * S + BH;
  const D = Math.max(3.4, G.R * S * 1.7);                                   // base depth (front to back)
  // base: a bevelled lacquer block on a dark plinth, brass inlay along the top edge
  const w = (G.W - 16) * S, shape = new THREE.Shape(), r0 = 0.5, hw = w / 2, hd = D / 2;
  shape.moveTo(-hw + r0, -hd); shape.lineTo(hw - r0, -hd); shape.quadraticCurveTo(hw, -hd, hw, -hd + r0); shape.lineTo(hw, hd - r0); shape.quadraticCurveTo(hw, hd, hw - r0, hd);
  shape.lineTo(-hw + r0, hd); shape.quadraticCurveTo(-hw, hd, -hw, hd - r0); shape.lineTo(-hw, -hd + r0); shape.quadraticCurveTo(-hw, -hd, -hw + r0, -hd);
  const bev = 0.16, bg = new THREE.ExtrudeGeometry(shape, { depth: BH - 0.45 - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 6 });
  bg.rotateX(-Math.PI / 2); bg.translate(0, 0.45 + bev, 0);
  const base = new THREE.Mesh(bg, m.lacquer); base.castShadow = true; base.receiveShadow = true; g.add(base);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.45, D + 0.5), m.lacquerDark); plinth.position.y = 0.225; plinth.castShadow = true; plinth.receiveShadow = true; g.add(plinth);
  const inlay = new THREE.Mesh(new THREE.BoxGeometry(w - 0.8, 0.06, 0.07), m.brass); inlay.position.set(0, BH - 0.32, hd + bev + 0.005); g.add(inlay);
  const baseCx = 0;
  // the bar, the handle and the loop end
  const barR = Math.max(0.16, G.B * S), bx0 = X(30), bx1 = X(G.W - 20), by = Y(G.barY);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(barR, barR, bx1 - bx0 - 1.2, 20), m.steel); bar.rotation.z = Math.PI / 2; bar.position.set((bx0 + bx1) / 2 - 0.6, by, 0); bar.castShadow = true; g.add(bar);
  const loop = new THREE.Mesh(new THREE.TubeGeometry(loopCurve(X(G.W - 64), bx1 + 0.2, Math.max(0.42, G.B * S * 2.1)), 60, barR * 0.85, 12, true), m.steel); loop.position.y = by; loop.castShadow = true; g.add(loop);
  const hx0 = X(18), hx1 = X(18 + G.HL - 12), hr = barR * 2.5;
  const hpts = []; for (let i = 0; i <= 16; i++) { const u = i / 16; hpts.push(new THREE.Vector2(hr * (u < 0.08 ? Math.sin(u / 0.08 * Math.PI / 2) * 0.9 + 0.1 : u > 0.92 ? 0.75 + 0.25 * Math.cos((u - 0.92) / 0.08 * Math.PI / 2) : 1 - 0.06 * Math.sin(u * Math.PI)), u * (hx1 - hx0))); }
  const hgeo = new THREE.LatheGeometry(hpts, 28); hgeo.rotateZ(-Math.PI / 2); hgeo.translate(hx0, 0, 0);
  const handle = new THREE.Mesh(hgeo, m.handle); handle.position.y = by; handle.castShadow = true; g.add(handle);
  for (const f of [0.22, 0.78]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(hr * 1.06, hr * 1.06, 0.22, 28), m.brass); band.rotation.z = Math.PI / 2; band.position.set(hx0 + (hx1 - hx0) * f, by, 0); g.add(band); }
  // tassel: a knot bead and silk strands hanging from the handle end; the presenter sways the pivot
  const tassel = new THREE.Group(); tassel.position.set(hx0 + 0.25, by - hr * 0.9, 0);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), m.brass); knot.position.y = -0.2; tassel.add(knot);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.4, 16), m.silk); cap.position.y = -0.55; tassel.add(cap);
  const rs = lcg(9);
  for (let i = 0; i < 18; i++) { const L = 1.3 + rs() * 0.25, s = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.02, L, 5), m.silk), a = rs() * TAU, rr = 0.06 + rs() * 0.13; s.position.set(Math.cos(a) * rr, -0.72 - L / 2, Math.sin(a) * rr); s.rotation.set(Math.sin(a) * 0.06, 0, Math.cos(a) * 0.06); s.castShadow = true; tassel.add(s); }
  g.add(tassel);
  // rings, posts, base holes and number plaques
  const ringGeo = new THREE.TorusGeometry(G.R * S, G.T * S, 24, 72), glowGeo = new THREE.PlaneGeometry(G.R * S * 3.0, G.R * S * 3.0);
  const stemGeo = new THREE.CylinderGeometry(0.055, 0.055, 1, 8); stemGeo.translate(0, -0.5, 0);
  const rings = [];
  for (let i = 0; i < n; i++) {
    const x = X(G.ringX(i)), pivot = new THREE.Group(); pivot.position.set(x, by, 0);
    const mat = ringMaterial(finish), mesh = new THREE.Mesh(ringGeo, mat); mesh.rotation.y = Math.PI / 2; mesh.castShadow = true; mesh.receiveShadow = true; pivot.add(mesh);
    const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    glow.rotation.y = Math.PI / 2; glow.renderOrder = 2; pivot.add(glow);
    const stem = new THREE.Mesh(stemGeo, m.steel); stem.position.set(x, 0, 0); stem.castShadow = true; g.add(stem);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16), m.hole); hole.position.set(x, BH + 0.006, 0); g.add(hole);
    const grommet = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 20), m.brass); grommet.rotation.x = Math.PI / 2; grommet.position.set(x, BH + 0.01, 0); g.add(grommet);
    const pr = Math.min(0.5, G.p * S * 0.2), plq = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, 0.08, 32), m.brass); plq.rotation.x = Math.PI / 2; plq.position.set(x, BH * 0.52, hd + bev + 0.04); g.add(plq);
    const face = new THREE.Mesh(new THREE.CircleGeometry(pr * 0.98, 32), new THREE.MeshStandardMaterial({ map: plaqueTex(i + 1), metalness: 0.75, roughness: 0.32 })); face.position.set(x, BH * 0.52, hd + bev + 0.085); g.add(face);
    g.add(pivot);
    rings.push({ pivot, mesh, glow, stem, x });
  }
  void baseCx;
  return { group: g, G, X, Y, rings, tassel, D: D + 2 * bev, BH, n, finish, yOn: by, yOff: Y(G.yOff), w };
}
export function disposePuzzle(P) {
  P.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  for (const r of P.rings) { r.mesh.material.dispose(); r.glow.material.dispose(); }
}

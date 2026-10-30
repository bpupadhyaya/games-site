// Durak 3D world: procedural textures and turned geometry for the dacha veranda table (no image files).
// World units are centimetres, the tabletop is y = 0. Everything here is pure construction; the presenter places and animates it.
import * as THREE from '../vendor3d/three.js';

export const TAU = Math.PI * 2;
export function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function texOf(c, { srgb = true, repeat = null, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
export function lathe(pts, seg = 48) { return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg); }

// ---------------------------------------------------------------------------------------------------- textures
// scrubbed pine boards, grain running along x; one tile = 4 boards (the tile is 44 cm square)
export function pineTexture() {
  const S = 1024, c = cv(S), x = c.getContext('2d'), r = rng(21), bh = S / 4;
  const tones = ['#98652f', '#8c5b29', '#a4713a', '#835425'];
  for (let b = 0; b < 4; b++) {
    const y0 = b * bh, g = x.createLinearGradient(0, y0, S, y0 + bh * 0.4); g.addColorStop(0, tones[b]); g.addColorStop(0.5, tones[(b + 1) % 4]); g.addColorStop(1, tones[b]);
    x.fillStyle = g; x.fillRect(0, y0, S, bh);
    for (let i = 0; i < 60; i++) {
      const y = y0 + 4 + r() * (bh - 8), amp = 1 + r() * 4, ph = r() * TAU, fr = 0.004 + r() * 0.012, a = 0.05 + r() * 0.16, d = r() < 0.65;
      x.strokeStyle = d ? `rgba(92,52,22,${a})` : `rgba(235,200,150,${a * 0.8})`; x.lineWidth = 0.7 + r() * 1.8; x.beginPath();
      for (let s = 0; s <= S; s += 8) { const yy = y + Math.sin(s * fr + ph) * amp; s ? x.lineTo(s, yy) : x.moveTo(s, yy); }
      x.stroke();
    }
    if (r() < 0.9) { const kx = 80 + r() * (S - 160), ky = y0 + bh * (0.3 + r() * 0.4); for (let k = 3; k > 0; k--) { x.strokeStyle = `rgba(92,52,22,${0.16 + 0.08 * k})`; x.lineWidth = 1.4; x.beginPath(); x.ellipse(kx, ky, 8 * k + 4, 4 * k + 2, 0, 0, TAU); x.stroke(); } }
    x.fillStyle = 'rgba(60,32,12,0.75)'; x.fillRect(0, y0 + bh - 2.5, S, 2.5);               // the gap between boards
    x.fillStyle = 'rgba(255,230,190,0.18)'; x.fillRect(0, y0 + 1, S, 1.5);
  }
  for (let i = 0; i < 8000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)'; x.fillRect(r() * S, r() * S, 2, 1); }
  return c;
}
// painted floor boards of the veranda (deep brick red, worn), one tile = 6 boards
export function floorTexture() {
  const S = 512, c = cv(S), x = c.getContext('2d'), r = rng(5), bh = S / 6;
  for (let b = 0; b < 6; b++) {
    const y0 = b * bh, l = 38 + r() * 12; x.fillStyle = `hsl(10, ${42 + r() * 8}%, ${l * 0.7}%)`; x.fillRect(0, y0, S, bh);
    for (let i = 0; i < 14; i++) { x.strokeStyle = `rgba(30,8,4,${0.05 + r() * 0.1})`; x.lineWidth = 1 + r() * 1.5; x.beginPath(); const y = y0 + r() * bh; x.moveTo(0, y); x.bezierCurveTo(S * 0.3, y + (r() - 0.5) * 5, S * 0.7, y + (r() - 0.5) * 5, S, y); x.stroke(); }
    x.fillStyle = 'rgba(15,4,2,0.8)'; x.fillRect(0, y0 + bh - 2, S, 2); x.fillRect(r() * S, y0, 2, bh);
  }
  for (let i = 0; i < 2500; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,220,180,0.05)' : 'rgba(0,0,0,0.08)'; x.fillRect(r() * S, r() * S, 3, 2); }
  return c;
}
// the table mat: sage linen with a cream band, two rows of red cross-stitch and a stitched flower at each corner.
// aw x ah is the mat's aspect, so the stitches stay square whatever the screen
export function matTexture(aw, ah) {
  const W = 1024, H = Math.max(256, Math.min(1500, Math.round(W * ah / aw))), c = cv(W, H), x = c.getContext('2d'), r = rng(9);
  const g = x.createRadialGradient(W / 2, H / 2, W * 0.05, W / 2, H / 2, Math.max(W, H) * 0.7); g.addColorStop(0, '#7f8f69'); g.addColorStop(0.7, '#6c7c58'); g.addColorStop(1, '#5a6a49');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.lineWidth = 1; for (let i = 0; i < H; i += 3) { x.strokeStyle = r() < 0.5 ? 'rgba(255,255,230,0.05)' : 'rgba(20,30,10,0.06)'; x.beginPath(); x.moveTo(0, i + 0.5); x.lineTo(W, i + 0.5); x.stroke(); }
  for (let i = 0; i < W; i += 3) { x.strokeStyle = r() < 0.5 ? 'rgba(255,255,230,0.04)' : 'rgba(20,30,10,0.05)'; x.beginPath(); x.moveTo(i + 0.5, 0); x.lineTo(i + 0.5, H); x.stroke(); }
  for (let i = 0; i < 40000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'; x.fillRect(r() * W, r() * H, 1.5, 1); }
  // border: a cream band with a red stitched band inside it
  const m = 14, bw = 56;
  x.fillStyle = '#efe4c8'; x.fillRect(m, m, W - 2 * m, bw); x.fillRect(m, H - m - bw, W - 2 * m, bw); x.fillRect(m, m, bw, H - 2 * m); x.fillRect(W - m - bw, m, bw, H - 2 * m);
  x.strokeStyle = 'rgba(70,50,20,0.55)'; x.lineWidth = 2; x.strokeRect(m, m, W - 2 * m, H - 2 * m); x.strokeRect(m + bw, m + bw, W - 2 * m - 2 * bw, H - 2 * m - 2 * bw);
  const st = 9, cross = (cx, cy, col) => { x.strokeStyle = col; x.lineWidth = 3; x.beginPath(); x.moveTo(cx - st / 2, cy - st / 2); x.lineTo(cx + st / 2, cy + st / 2); x.moveTo(cx + st / 2, cy - st / 2); x.lineTo(cx - st / 2, cy + st / 2); x.stroke(); };
  const rowX = (y, off) => { for (let px = m + bw * 0.5; px < W - m - bw * 0.4; px += st + 2) { const k = Math.round((px - m) / (st + 2)); if ((k + off) % 4 !== 3) cross(px, y, k % 8 < 4 ? '#b3262c' : '#a02026'); } };
  const rowY = (xx, off) => { for (let py = m + bw * 0.5; py < H - m - bw * 0.4; py += st + 2) { const k = Math.round((py - m) / (st + 2)); if ((k + off) % 4 !== 3) cross(xx, py, k % 8 < 4 ? '#b3262c' : '#a02026'); } };
  rowX(m + bw * 0.5, 0); rowX(H - m - bw * 0.5, 0); rowY(m + bw * 0.5, 1); rowY(W - m - bw * 0.5, 1);
  x.strokeStyle = 'rgba(40,60,120,0.7)'; x.lineWidth = 2.5; x.setLineDash([9, 7]);
  x.strokeRect(m + bw * 0.5 - 12, m + bw * 0.5 - 12, W - 2 * m - bw + 24, H - 2 * m - bw + 24); x.setLineDash([]);
  for (const [cx, cy] of [[m + bw + 40, m + bw + 40], [W - m - bw - 40, m + bw + 40], [m + bw + 40, H - m - bw - 40], [W - m - bw - 40, H - m - bw - 40]]) {
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; x.fillStyle = '#e9dcc0'; x.beginPath(); x.ellipse(cx + Math.cos(a) * 17, cy + Math.sin(a) * 17, 11, 6, a, 0, TAU); x.fill(); x.strokeStyle = 'rgba(60,40,20,0.5)'; x.lineWidth = 1.5; x.stroke(); }
    x.fillStyle = '#b3262c'; x.beginPath(); x.arc(cx, cy, 8, 0, TAU); x.fill();
  }
  return c;
}
// a shaft of window light on the planks: four soft panes, skewed
export function windowLightTexture() {
  const W = 512, H = 512, c = cv(W, H), x = c.getContext('2d');
  x.save(); x.translate(W / 2, H / 2); x.transform(1, 0, -0.35, 1, 0, 0); x.translate(-W / 2, -H / 2);
  for (const [px, py] of [[60, 60], [270, 60], [60, 270], [270, 270]]) { x.fillStyle = 'rgba(255,240,200,0.9)'; x.beginPath(); x.roundRect(px, py, 180, 180, 10); x.fill(); }
  x.restore();
  const t = cv(W), y = t.getContext('2d'); y.filter = 'blur(14px)'; y.drawImage(c, 0, 0);
  return t;
}
export function radialTex(rgb, a = 1, inner = 0) {
  const c = cv(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 64 * inner, 64, 64, 64);
  if (inner) { g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.15, `rgba(${rgb},${a})`); } else g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.5, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return texOf(c);
}
// soft rounded-rect shadow for a card lying on the table (slightly bigger than the card)
export function cardShadowTex() {
  const c = cv(128, 160), x = c.getContext('2d');
  for (let i = 0; i < 12; i++) { const k = i * 1.6; x.fillStyle = 'rgba(0,0,0,0.075)'; x.beginPath(); x.roundRect(22 + k, 24 + k, 84 - 2 * k, 112 - 2 * k, 10 + k); x.fill(); }
  return texOf(c);
}

// ---------------------------------------------------------------------------------------------------- geometry
// a card of w x h (any unit) with rounded corners, lying face up on y = 0; the top edge points to -z
export function cardGeometry(w, h, r) {
  const s = new THREE.Shape(), x0 = -w / 2, y0 = -h / 2;
  s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r); s.lineTo(x0 + w, y0 + h - r);
  s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h); s.lineTo(x0 + r, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
  s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  const g = new THREE.ShapeGeometry(s, 6), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - x0) / w, (p.getY(i) - y0) / h);
  g.rotateX(-Math.PI / 2);
  return g;
}

// ---------------------------------------------------------------------------------------------------- the dacha props
const brass = () => new THREE.MeshStandardMaterial({ color: 0xd9a645, roughness: 0.26, metalness: 1 });
const darkBrass = () => new THREE.MeshStandardMaterial({ color: 0x9b6d22, roughness: 0.38, metalness: 1 });
const porcelain = () => new THREE.MeshPhysicalMaterial({ color: 0xf7f3ea, roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.12 });
const cobalt = () => new THREE.MeshPhysicalMaterial({ color: 0x1f4aa8, roughness: 0.3, clearcoat: 0.8 });

// a brass samovar with a blue-and-white zavarnik (teapot) on top: about 55 cm tall, built at 1.3x real size like the cards
export function makeSamovar() {
  const g = new THREE.Group(), B = brass(), D = darkBrass();
  const body = new THREE.Mesh(lathe([[0.01, 0], [9.5, 0], [10.2, 0.8], [8.6, 2.2], [7, 3.2], [6.4, 6], [8.2, 8.6], [11.6, 12.5], [14.4, 17.5], [15.4, 22.5], [14.8, 28], [12.6, 32.5], [9.6, 35.4], [8.4, 36.8], [8.6, 37.6], [7.4, 38.4], [0.01, 38.4]], 56), B);
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  for (const [y, r] of [[2.4, 8.4], [20.5, 15.45], [26, 15], [36.9, 8.5]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.38, 8, 56), D); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); }
  const lid = new THREE.Mesh(lathe([[0.01, 38.4], [7.2, 38.6], [6.6, 40.4], [4.4, 41.8], [2.4, 42.6], [2.2, 44], [0.01, 44.2]], 36), B); lid.castShadow = true; g.add(lid);
  // the teapot on top
  const pot = new THREE.Group(); pot.position.y = 44;
  const pb = new THREE.Mesh(lathe([[0.01, 0], [4.2, 0], [5.6, 2.4], [6.1, 5.4], [5.2, 8.2], [3.4, 9.6], [0.01, 10]], 36), porcelain()); pb.castShadow = true; pot.add(pb);
  const pl = new THREE.Mesh(lathe([[3.4, 9.6], [3.2, 11], [1.8, 11.8], [0.01, 12]], 24), porcelain()); pl.castShadow = true; pot.add(pl);
  for (const y of [1.4, 6.8]) { const b = new THREE.Mesh(new THREE.TorusGeometry(y < 3 ? 4.7 : 5.5, 0.22, 6, 40), cobalt()); b.rotation.x = Math.PI / 2; b.position.y = y; pot.add(b); }
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.2, 6, 10), porcelain()); sp.position.set(7, 5.6, 0); sp.rotation.z = -1.0; sp.castShadow = true; pot.add(sp);
  const hd = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.5, 8, 18, Math.PI * 1.1), porcelain()); hd.position.set(-5.6, 6, 0); hd.rotation.z = Math.PI / 2 + 0.55; pot.add(hd);
  const kn = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), cobalt()); kn.position.y = 12.4; pot.add(kn);
  g.add(pot);
  // tap and side handles, chimney is under the teapot
  const tap = new THREE.Group(); tap.position.set(14.5, 13.5, 0);
  const t1 = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 5.4, 14), B); t1.rotation.z = Math.PI / 2; t1.position.x = 2.6; t1.castShadow = true; tap.add(t1);
  const t2 = new THREE.Mesh(new THREE.SphereGeometry(1.7, 14, 10), D); t2.position.set(5.2, -0.2, 0); tap.add(t2);
  const t3 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3.6, 8), B); t3.position.set(3.2, 1.8, 0); tap.add(t3);
  g.add(tap);
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.7, 8, 20, Math.PI), D); h.position.set(s * 15.1, 27.5, 0); h.rotation.set(0, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2); h.castShadow = true; g.add(h); }
  return g;
}
// a tea glass in a brass podstakannik (the pierced holder with a handle) with strong tea and a sugar lump: 11 cm tall
export function makeTeaGlass() {
  const g = new THREE.Group();
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xf2f6f8, roughness: 0.04, transparent: true, opacity: 0.3, clearcoat: 1, clearcoatRoughness: 0.03, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6 });
  const teaMat = new THREE.MeshPhysicalMaterial({ color: 0x7a2208, roughness: 0.12, transparent: true, opacity: 0.95, emissive: 0x6a1a00, emissiveIntensity: 0.6, clearcoat: 1 });
  const glassPts = [[0.01, 0.5], [2.6, 0.5], [2.8, 1], [3.2, 6], [3.5, 10.8], [3.38, 10.8], [3.08, 6], [2.7, 1.2], [0.01, 1.2]];
  const glass = new THREE.Mesh(lathe(glassPts, 40), glassMat); glass.renderOrder = 5; g.add(glass);
  const tea = new THREE.Mesh(lathe([[0.01, 1.3], [2.6, 1.4], [3.0, 6], [3.3, 9.2], [0.01, 9.2]], 40), teaMat); tea.renderOrder = 4; tea.castShadow = true; g.add(tea);
  const hold = new THREE.Mesh(lathe([[2.95, 0.3], [3.35, 0.4], [3.55, 4.6], [3.9, 6.4], [3.82, 6.5], [3.5, 4.7], [3.3, 0.7]], 40), brass()); hold.castShadow = true; g.add(hold);
  const foot = new THREE.Mesh(lathe([[0.01, 0], [3.6, 0], [3.9, 0.3], [3.4, 0.6], [0.01, 0.6]], 40), brass()); foot.castShadow = true; g.add(foot);
  for (const y of [1.6, 4.4]) { const b = new THREE.Mesh(new THREE.TorusGeometry(3.45 + (y > 3 ? 0.1 : 0), 0.14, 6, 40), darkBrass()); b.rotation.x = Math.PI / 2; b.position.y = y; g.add(b); }
  const h = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.3, 8, 20, Math.PI * 1.05), brass()); h.position.set(3.7, 3.8, 0); h.rotation.z = -Math.PI / 2 - 0.55; h.castShadow = true; g.add(h);
  const lump = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 1.5), new THREE.MeshStandardMaterial({ color: 0xfbf7ee, roughness: 0.9 })); lump.position.set(-0.4, 9.6, 0.3); lump.rotation.set(0.3, 0.5, 0.2); lump.castShadow = true; g.add(lump);
  return g;
}
// a glass dish of cherry jam with a spoon
export function makeJam() {
  const g = new THREE.Group();
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xf2f6f8, roughness: 0.04, transparent: true, opacity: 0.35, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.5 });
  const bowl = new THREE.Mesh(lathe([[0.01, 0.2], [3.4, 0.2], [4.8, 1.8], [6.2, 4.2], [6.1, 4.3], [4.7, 2], [3.3, 0.5], [0.01, 0.5]], 40), glassMat); bowl.renderOrder = 5; g.add(bowl);
  const jam = new THREE.Mesh(new THREE.CylinderGeometry(5.1, 3.6, 2.6, 36), new THREE.MeshPhysicalMaterial({ color: 0x6d0a18, roughness: 0.12, clearcoat: 1, emissive: 0x2a0004, emissiveIntensity: 0.6 })); jam.position.y = 1.9; jam.castShadow = true; g.add(jam);
  for (const [x, z] of [[-1.4, 0.8], [1.2, -1.2], [0.6, 1.6]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 8), new THREE.MeshPhysicalMaterial({ color: 0x8c0f22, roughness: 0.1, clearcoat: 1 })); b.position.set(x, 3.3, z); g.add(b); }
  const sp = new THREE.Group();
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 11, 8), brass()); sh.rotation.z = Math.PI / 2; sp.add(sh);
  const sb = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 10), brass()); sb.scale.set(1.2, 0.35, 1); sb.position.x = 5.4; sp.add(sb);
  sp.position.set(-2, 4.4, 2); sp.rotation.set(0.25, 0.5, 0.35); sp.traverse((o) => { o.castShadow = true; }); g.add(sp);
  return g;
}
// sushki: a plate of small dry bread rings
export function makeSushki() {
  const g = new THREE.Group(), r = rng(7);
  const plate = new THREE.Mesh(lathe([[0.01, 0], [6.2, 0], [8.6, 1.1], [9, 1.5], [8.7, 1.5], [6.1, 0.5], [0.01, 0.5]], 40), porcelain()); plate.castShadow = true; plate.receiveShadow = true; g.add(plate);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.18, 6, 48), cobalt()); rim.rotation.x = Math.PI / 2; rim.position.y = 1.35; g.add(rim);
  const ring = new THREE.MeshStandardMaterial({ color: 0xd9b27a, roughness: 0.85 });
  const spots = [[-3.4, 0, 0.2], [3.4, 0.4, 0], [0, 0, -3.6], [0.3, 0, 3.6], [0, 1.4, 0], [-2, 1.2, 2.4], [2.2, 1.2, -2]];
  spots.forEach(([x, y, z], i) => { const t = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.78, 10, 24), ring); t.rotation.x = Math.PI / 2 + (r() - 0.5) * 0.12; t.rotation.z = r() * TAU; t.position.set(x, 1.0 + y, z); t.castShadow = true; g.add(t); });
  return g;
}
// turned pine leg
export function legGeometry(h) { return lathe([[0.01, -h], [2.6, -h], [2.8, -h + 3], [2.0, -h + 9], [1.9, -34], [3.4, -28], [2.3, -22], [3.0, -14], [3.2, -8], [0.01, -8]], 20); }

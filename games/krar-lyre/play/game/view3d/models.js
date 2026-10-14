// Krar Lyre 3D models: the real instrument (bowl of carved wood, laced rawhide face with a painted rim and brass tacks, two bowed arms, a crossbar with
// six leather-and-cloth tuning wraps, a bridge and tailpiece, six gut strings), a woven mat to stand it on, and a layered highland dawn behind it.
// Everything is built in VIRTUAL units (1 unit = 1 layout unit, x right, y UP = -virtual y), so the lyre lines up with the 2D rings and hit tests.
import * as THREE from '../vendor3d/three.js';
import { paintBowl } from '../src/art.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const WRAPS = ['#e8b23a', '#2fa58a', '#c8553d', '#4f8fe0', '#e7864a', '#9b6fd0'];
const mkRand = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

// ---------------------------------------------------------------- canvas textures (cached)
const texCache = new Map();
function canvasTex(key, w, h, paint, { repeat = null, srgb = true } = {}) {
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  texCache.set(key, t);
  return t;
}
export const clearTexCache = () => texCache.clear();

const hideTex = () => canvasTex('hide', 1012, 1012, (g) => {
  paintBowl(g, 486, 486);
  // 3D shading belongs to the lights; this only adds age: darker toward the laced edge, a few stains and a worn centre where the fingers pluck
  const c = 506, R = mkRand(31), ev = g.createRadialGradient(c, c, 120, c, c, 410);
  ev.addColorStop(0, 'rgba(70,34,10,0)'); ev.addColorStop(0.7, 'rgba(70,34,10,0.12)'); ev.addColorStop(1, 'rgba(60,28,8,0.5)');
  g.save(); g.beginPath(); g.ellipse(c, c, 408, 408, 0, 0, TAU); g.clip(); g.fillStyle = ev; g.fillRect(0, 0, 1012, 1012);
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(110,64,24,${0.05 + R() * 0.08})`; g.beginPath(); g.ellipse(c + (R() - 0.5) * 640, c + (R() - 0.5) * 640, 20 + R() * 70, 10 + R() * 40, R() * 3, 0, TAU); g.fill(); }
  g.restore();
});
const hideBump = () => canvasTex('hidebump', 512, 512, (g, w, h) => {
  const R = mkRand(5); g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 700; i++) { const v = 90 + R() * 80; g.fillStyle = `rgba(${v},${v},${v},0.28)`; g.beginPath(); g.ellipse(R() * w, R() * h, 3 + R() * 26, 1 + R() * 8, R() * 3, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(40,40,40,0.5)'; g.lineWidth = 2;
  for (let i = 0; i < 26; i++) { g.beginPath(); let x = R() * w, y = R() * h; g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (R() - 0.5) * 60; y += (R() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
}, { srgb: false });
const woodTex = (seed = 1, light = '#c98a52', dark = '#5a2c12') => canvasTex(`wood${seed}${light}`, 512, 512, (g, w, h) => {
  const R = mkRand(seed * 97 + 3), gr = g.createLinearGradient(0, 0, w, 0);
  gr.addColorStop(0, dark); gr.addColorStop(0.35, light); gr.addColorStop(0.65, light); gr.addColorStop(1, dark);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) { const x = R() * w, a = 0.05 + R() * 0.16; g.strokeStyle = `rgba(30,12,4,${a})`; g.lineWidth = 0.6 + R() * 2.2; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (R() - 0.5) * 30, h * 0.3, x + (R() - 0.5) * 30, h * 0.7, x + (R() - 0.5) * 12, h); g.stroke(); }
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(255,220,170,${0.04 + R() * 0.07})`; g.lineWidth = 1; const x = R() * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (R() - 0.5) * 18, h); g.stroke(); }
}, {});
const cordTex = (col) => canvasTex('cord' + col, 128, 128, (g, w, h) => {
  g.fillStyle = col; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 8) { g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(0, y, w, 2.5); g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(0, y + 3, w, 1.5); }
});
const matTex = () => canvasTex('mat', 1024, 512, (g, w, h) => {
  g.save(); g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.49, h * 0.49, 0, 0, TAU); g.clip();
  g.fillStyle = '#2b1a0e'; g.fillRect(0, 0, w, h);
  const cols = ['#e8b23a', '#c8553d', '#2fa58a', '#f4e6c4'];
  for (let band = 0; band < 8; band++) {
    const y0 = band * h / 8;
    g.fillStyle = band % 2 ? '#3a2210' : '#2c1a0c'; g.fillRect(0, y0, w, h / 8);
    for (let x = 0, i = 0; x < w + 40; x += 40, i++) { g.fillStyle = cols[(i + band) % 4]; g.beginPath(); g.moveTo(x, y0 + h / 8 - 6); g.lineTo(x + 20, y0 + 6); g.lineTo(x + 40, y0 + h / 8 - 6); g.closePath(); g.globalAlpha = 0.62; g.fill(); g.globalAlpha = 1; }
  }
  const R = mkRand(11); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
  for (let i = 0; i < 400; i++) { const x = R() * w, y = R() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18, y + (R() - 0.5) * 6); g.stroke(); }
  const ed = g.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.5); ed.addColorStop(0.55, 'rgba(8,24,20,0)'); ed.addColorStop(1, 'rgba(8,24,20,0.85)');
  g.fillStyle = ed; g.fillRect(0, 0, w, h);
  g.restore();
});
const softDot = () => canvasTex('dot', 64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
export { softDot };

// ---------------------------------------------------------------- helpers
const M = {
  wood: null, woodDark: null, brass: null, leather: null, gut: null, hide: null, mat: null,
};
export function buildMaterials() {
  M.wood = new THREE.MeshPhysicalMaterial({ map: woodTex(1, '#b9743e', '#4a220d'), roughness: 0.5, metalness: 0.02, clearcoat: 0.55, clearcoatRoughness: 0.32 });
  M.woodDark = new THREE.MeshPhysicalMaterial({ map: woodTex(2, '#7a3d1a', '#2a1208'), roughness: 0.46, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  M.brass = new THREE.MeshStandardMaterial({ color: '#e0b04a', metalness: 0.95, roughness: 0.28 });
  M.leather = new THREE.MeshStandardMaterial({ color: '#6a3a1c', roughness: 0.8 });
  M.gut = new THREE.MeshStandardMaterial({ color: '#fff2d6', roughness: 0.38, metalness: 0.15, emissive: '#ffb347', emissiveIntensity: 0 });
  M.hide = new THREE.MeshStandardMaterial({ map: hideTex(), bumpMap: hideBump(), bumpScale: 2.2, roughness: 0.8, metalness: 0, color: '#e6d8bc', alphaTest: 0.5, emissive: '#ff9a30', emissiveIntensity: 0, side: THREE.DoubleSide });
  M.mat = new THREE.MeshStandardMaterial({ map: matTex(), roughness: 0.95, transparent: true, alphaTest: 0.02 });
  return M;
}

// A bar (cylinder) between two points.
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function barBetween(p0, p1, r, mat, seg = 8) {
  _d.copy(p1).sub(p0);
  const len = _d.length(), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg, 1), mat);
  m.position.copy(p0).addScaledVector(_d, 0.5);
  m.quaternion.setFromUnitVectors(_up, _d.normalize());
  return m;
}
// A tapered tube along a polyline of points; radius(t) in 0..1. Elliptical cross-section a (in-plane) and b (depth).
function taperTube(points, radiusFn, depthK = 1, radial = 14) {
  const n = points.length, pos = [], idx = [];
  for (let i = 0; i < n; i++) {
    const p = points[i], q = points[Math.min(n - 1, i + 1)], o = points[Math.max(0, i - 1)];
    const T = new THREE.Vector3().subVectors(q, o).normalize();
    const Z = new THREE.Vector3(0, 0, 1), N = new THREE.Vector3().crossVectors(T, Z).normalize();
    const r = radiusFn(i / (n - 1));
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      pos.push(p.x + N.x * Math.cos(a) * r, p.y + N.y * Math.cos(a) * r, p.z + Math.sin(a) * r * depthK);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  const uv = []; for (let i = 0; i < n; i++) for (let j = 0; j <= radial; j++) uv.push(j / radial, i / (n - 1) * 2);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const bez = (p0, p1, p2, n) => { const out = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push(new THREE.Vector3(u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y, u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z)); } return out; };

// ---------------------------------------------------------------- the lyre
// G: geometry from layout.lyreFor (virtual units). World position of a virtual point (vx, vy) is (vx, -vy).
export function buildLyre(G, mats = M) {
  const root = new THREE.Group(), rx = G.rx, ry = G.ry, armW = Math.max(14, rx * 0.12);
  const phi = Math.acos(clamp(ry / rx, 0.3, 1)), cph = Math.cos(phi), sph = Math.sin(phi);
  const out = { root, strings: [], tails: [], tassels: [], hideMat: mats.hide, wrapMeshes: [], bowl: null };

  // ---- bowl: a round carved bowl tilted back by phi so its face is the ellipse the 2D layout expects
  const bowl = new THREE.Group(); bowl.position.set(G.cx, -G.bowlCy, 0); bowl.rotation.x = -phi; root.add(bowl); out.bowl = bowl;
  const prof = [];
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * (Math.PI / 2); prof.push(new THREE.Vector2(Math.max(0.0001, Math.pow(Math.cos(a), 0.82)) * rx * 1.015, -Math.sin(a) * rx * 0.92)); }
  const bg = new THREE.LatheGeometry(prof, 56); bg.rotateX(Math.PI / 2);
  const wall = new THREE.Mesh(bg, mats.wood); wall.castShadow = true; wall.receiveShadow = true; bowl.add(wall);
  // dome-shaped hide face
  const faceG = new THREE.PlaneGeometry(1012 / 486 * rx * 0.994, 1012 / 486 * rx * 0.994, 44, 44), fp = faceG.attributes.position;
  for (let i = 0; i < fp.count; i++) { const x = fp.getX(i) / rx, y = fp.getY(i) / rx, r2 = x * x + y * y; fp.setZ(i, 0.045 * rx * Math.max(0, 1 - r2 / 0.72) + 0.012 * rx); }
  faceG.computeVertexNormals();
  const face = new THREE.Mesh(faceG, mats.hide); face.receiveShadow = true; face.castShadow = false; bowl.add(face);
  // raised wooden rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(rx * 0.995, rx * 0.05, 14, 72), mats.woodDark); rim.position.z = rx * 0.008; rim.castShadow = true; bowl.add(rim);
  // brass tacks on the face
  const tackR = Math.max(2.4, rx * 0.013), tacks = new THREE.InstancedMesh(new THREE.SphereGeometry(tackR, 8, 6), mats.brass, 30), dm = new THREE.Object3D();
  for (let i = 0; i < 30; i++) { const a = (i / 30) * TAU; dm.position.set(Math.cos(a) * rx * 0.815, Math.sin(a) * rx * 0.815, rx * 0.028); dm.updateMatrix(); tacks.setMatrixAt(i, dm.matrix); }
  tacks.castShadow = true; bowl.add(tacks);
  // rawhide lacing: thongs running from the rim down the wall
  const lace = new THREE.InstancedMesh(new THREE.BoxGeometry(rx * 0.014, rx * 0.04, rx * 0.34), mats.leather, 36);
  for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU + 0.04; dm.position.set(Math.cos(a) * rx * 0.985, Math.sin(a) * rx * 0.985, -rx * 0.17); dm.rotation.set(0, 0, a); dm.updateMatrix(); lace.setMatrixAt(i, dm.matrix); }
  dm.rotation.set(0, 0, 0); lace.castShadow = true; bowl.add(lace);

  // hide surface point under a virtual (vx, vy): local to the bowl and in root space
  const localHide = (vx, vy, lift = 0) => {
    const up = G.bowlCy - vy, yl = up / cph, xl = vx - G.cx;
    const r2 = (xl * xl + yl * yl) / (rx * rx), zl = 0.045 * rx * Math.max(0, 1 - r2 / 0.72) + 0.012 * rx + lift;
    return new THREE.Vector3(xl, yl, zl);
  };
  const onHide = (vx, vy, lift = 0) => localHide(vx, vy, lift).applyEuler(bowl.rotation).add(bowl.position);
  out.onHide = onHide;

  // ---- bridge + tailpiece lying on the hide (children of the bowl so they tilt with it)
  const bxL = G.xs[0] - 22, bxR = G.xs[5] + 22, bh = Math.max(12, armW * 0.8);
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(bh * 0.34, bh * 0.34, bxR - bxL, 12), mats.woodDark); bridge.rotation.z = Math.PI / 2;
  bridge.position.copy(localHide((bxL + bxR) / 2, G.bridgeY, bh * 0.34)); bridge.castShadow = true; bridge.receiveShadow = true; bowl.add(bridge);
  const bridgeTop = (i) => onHide(G.xs[i], G.bridgeY, bh * 0.66);
  const tailW = bxR - bxL + 10;
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(bh * 0.22, bh * 0.22, tailW * 0.7, 10), mats.woodDark); tail.rotation.z = Math.PI / 2;
  tail.position.copy(localHide(G.cx, G.tailY, bh * 0.2)); tail.castShadow = true; bowl.add(tail);
  // tail strings (static)
  for (let i = 0; i < 6; i++) {
    const tx = G.cx + (G.xs[i] - G.cx) * 0.55, p0 = onHide(tx, G.tailY, bh * 0.35), p1 = bridgeTop(i);
    const m = barBetween(p0, p1, Math.max(1.1, rx * 0.0055), mats.gut, 6); root.add(m); out.tails.push(m);
  }

  // ---- arms: from the bowl's sides up to the crossbar
  const barH = Math.max(18, armW * 1.15), barZ = -rx * 0.05;
  for (const s of [-1, 1]) {
    const p0 = new THREE.Vector3(G.cx + s * rx * 0.9, -(G.bowlCy - ry * 0.25), onHide(G.cx + s * rx * 0.9, G.bowlCy - ry * 0.25).z);
    const p2 = new THREE.Vector3(G.cx + s * G.halfTop, -G.barY, barZ), p1 = new THREE.Vector3(G.cx + s * rx * 1.04, -((G.bowlCy - ry * 0.25 + G.barY) / 2 + 20), (p0.z + barZ) / 2 + rx * 0.05);
    const pts = bez(p0, p1, p2, 28);
    const arm = new THREE.Mesh(taperTube(pts, (t) => armW * (0.64 - 0.2 * t + 0.07 * Math.sin(t * Math.PI * 3)), 0.95), mats.wood);
    arm.castShadow = true; arm.receiveShadow = true; root.add(arm);
    for (const f of [0.1, 0.5, 0.9]) {            // brass collars along the arm
      const i = Math.round(f * (pts.length - 1)), tg = new THREE.Vector3().subVectors(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(armW * (0.66 - 0.2 * f), armW * 0.07, 8, 20), mats.brass);
      ring.position.copy(pts[i]); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg); ring.castShadow = true; root.add(ring);
    }
    // carved knob where the arm meets the bar
    const knob = new THREE.Mesh(new THREE.SphereGeometry(armW * 0.58, 14, 10), mats.woodDark); knob.position.copy(p2); knob.castShadow = true; root.add(knob);
  }
  // ---- crossbar
  const bx0 = G.cx - G.halfTop, bx1 = G.cx + G.halfTop;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(barH * 0.46, barH * 0.46, bx1 - bx0, 18), mats.wood);
  bar.rotation.z = Math.PI / 2; bar.position.set(G.cx, -G.barY, barZ); bar.castShadow = true; bar.receiveShadow = true; root.add(bar);
  for (const sgn of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(barH * 0.5, barH * 0.5, barH * 0.2, 18), mats.brass); cap.rotation.z = Math.PI / 2; cap.position.set(G.cx + sgn * (G.halfTop + armW * 0.5), -G.barY, barZ); cap.castShadow = true; root.add(cap); }
  // tuning wraps: a leather-and-cloth collar round the bar for each string, with a tail of cord
  for (let i = 0; i < 6; i++) {
    const ww = Math.max(14, barH * 0.82);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(barH * 0.66, barH * 0.66, ww, 18), new THREE.MeshStandardMaterial({ map: cordTex(WRAPS[i]), roughness: 0.78 }));
    collar.rotation.z = Math.PI / 2; collar.position.set(G.xt[i], -G.barY, barZ); collar.castShadow = true; root.add(collar); out.wrapMeshes.push(collar);
    // the tail: a short ribbon that sways (6 segments)
    const rg = new THREE.PlaneGeometry(Math.max(3.2, barH * 0.16), barH * 1.3, 1, 6); rg.translate(0, -barH * 0.65, 0);
    const rb = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: WRAPS[i], roughness: 0.7, side: THREE.DoubleSide }));
    rb.position.set(G.xt[i], -G.barY - barH * 0.5, barZ + barH * 0.68); rb.userData.base = Float32Array.from(rg.attributes.position.array); root.add(rb); out.tassels.push(rb);
  }

  // ---- strings: bridge -> collar. 17 rings x 6 sides, updated each frame while sounding.
  for (let i = 0; i < 6; i++) {
    const thick = Math.max(2.2, rx * 0.012) * (1.3 - 0.5 * i / 5) * 0.68;
    const p0 = bridgeTop(i), p1 = new THREE.Vector3(G.xt[i], -G.barY - barH * 0.05, barZ + barH * 0.68);
    const g = new THREE.CylinderGeometry(1, 1, 1, 6, 16, true);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#fff4dc', roughness: 0.36, metalness: 0.2, emissive: '#ffb040', emissiveIntensity: 0.06 }));
    m.frustumCulled = false; m.castShadow = true; root.add(m);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: softDot(), color: '#ffd47a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.frustumCulled = false; root.add(halo);
    const st = { m, halo, p0, p1, thick, amp: 0, dirty: true };
    out.strings.push(st); writeString(st, 0, 0);
  }
  return out;
}

const _t = new THREE.Vector3(), _n = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1);
function writeString(st, amp, t) {
  const { m, p0, p1, thick } = st, pos = m.geometry.attributes.position, seg = 16, rad = 6;
  _t.subVectors(p1, p0); const len = _t.length() || 1; _t.divideScalar(len);
  _n.set(-_t.y, _t.x, 0).normalize();
  const r = thick * (1 + 0.5 * amp);
  for (let j = 0; j <= seg; j++) {
    const u = j / seg, off = Math.sin(u * Math.PI) * Math.sin(t * 90 + st.p0.x * 0.37 + u * 6) * 7 * amp;
    const cx = p0.x + (p1.x - p0.x) * u + _n.x * off, cy = p0.y + (p1.y - p0.y) * u + _n.y * off, cz = p0.z + (p1.z - p0.z) * u + Math.sin(t * 75 + u * 5) * 3 * amp;
    for (let i = 0; i <= rad; i++) {
      const a = (i / rad) * TAU, c = Math.cos(a) * r, s = Math.sin(a) * r;
      // cylinder vertices are laid out (j rows from +y to -y); row 0 is the top, so write the rows reversed
      const row = seg - j, k = row * (rad + 1) + i;
      pos.setXYZ(k, cx + _n.x * c, cy + _n.y * c, cz + s);
    }
  }
  pos.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere();
  const h = st.halo; h.position.set((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2 + 2);
  h.scale.set(thick * 7, len * 1.02, 1); h.rotation.z = Math.atan2(_t.y, _t.x) - Math.PI / 2;
}

// Per-frame: o = the drawLyre options (vib[1..6], glow, damp, dimStrings, t).
export function updateLyre(out, o, t) {
  const vib = o.vib ?? [], dim = o.dimStrings ?? [];
  for (let i = 0; i < 6; i++) {
    const st = out.strings[i], amp = vib[i + 1] ?? 0, quiet = dim.includes && dim.includes(i + 1);
    const on = amp > 0.02;
    if (on || st.amp > 0.001 || st.dirty) writeString(st, on ? amp : 0, t);
    st.amp = on ? amp : 0; st.dirty = false;
    st.m.material.emissiveIntensity = 0.06 + amp * 1.6;
    st.m.material.opacity = 1; st.m.material.transparent = false;
    st.m.material.color.setScalar(quiet ? 0.45 : 1).multiply(_col.set('#fff4dc'));
    st.halo.material.opacity = Math.min(0.7, amp * 0.55);
  }
  const glow = Math.max(o.glow ?? 0, o.damp ?? 0);
  out.hideMat.emissiveIntensity = glow * 0.22;
  out.hideMat.emissive.set(o.damp > 0.01 ? '#ecd7a6' : '#ff9a30');
  for (let i = 0; i < out.tassels.length; i++) {
    const rb = out.tassels[i], base = rb.userData.base, p = rb.geometry.attributes.position, sway = Math.sin(t * 1.1 + i * 1.3) * 2.5 + (vib[i + 1] ?? 0) * 3 * Math.sin(t * 60 + i);
    for (let k = 0; k < p.count; k++) { const y = base[k * 3 + 1], f = Math.min(1, -y / (rb.geometry.parameters.height || 1)); p.setX(k, base[k * 3] + sway * f * f * 1.4); }
    p.needsUpdate = true;
  }
}
const _col = new THREE.Color();

// ---------------------------------------------------------------- environment
// Layers painted once per aspect (sky + sun, three ridges of highland, a flat-topped acacia and a round thatched hut). Each layer is a quad at its own
// depth so the camera drift gives parallax; mist banks and fireflies move on their own.
function paintSky(g, w, h) {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#071f28'); sky.addColorStop(0.3, '#0f4a4e'); sky.addColorStop(0.52, '#3d8a73'); sky.addColorStop(0.64, '#e8b86a'); sky.addColorStop(0.7, '#ffcf7a'); sky.addColorStop(1, '#16382f');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  const R = mkRand(4242);
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,250,225,${0.15 + R() * 0.5})`; g.beginPath(); g.arc(R() * w, R() * h * 0.36, 0.6 + R() * 1.3, 0, TAU); g.fill(); }
  const hy = h * 0.64, sx = w * 0.7, sr = Math.min(w, h) * 0.1;
  const halo = g.createRadialGradient(sx, hy, sr * 0.3, sx, hy, Math.max(w, h) * 0.65);
  halo.addColorStop(0, 'rgba(255,236,170,0.95)'); halo.addColorStop(0.18, 'rgba(255,196,96,0.42)'); halo.addColorStop(1, 'rgba(255,170,80,0)');
  g.fillStyle = halo; g.fillRect(0, 0, w, h);
  const disc = g.createRadialGradient(sx, hy, 2, sx, hy, sr); disc.addColorStop(0, '#fffdf0'); disc.addColorStop(1, '#ffd878');
  g.fillStyle = disc; g.beginPath(); g.arc(sx, hy, sr, 0, TAU); g.fill();
  // thin cloud streaks lit from below
  for (let i = 0; i < 7; i++) { const y = h * (0.34 + R() * 0.24), x = R() * w, ww = w * (0.18 + R() * 0.3); const cg = g.createLinearGradient(x, y, x + ww, y); cg.addColorStop(0, 'rgba(255,190,120,0)'); cg.addColorStop(0.5, `rgba(255,205,140,${0.18 + R() * 0.2})`); cg.addColorStop(1, 'rgba(255,190,120,0)'); g.fillStyle = cg; g.beginPath(); g.ellipse(x + ww / 2, y, ww / 2, 5 + R() * 7, 0, 0, TAU); g.fill(); }
}
function paintRidge(g, w, h, base, amp, col, seed, step, deco) {
  const rr = mkRand(seed); g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
  const ys = []; for (let x = 0; x <= w + step; x += step) { const y = base + (rr() - 0.5) * amp + Math.sin(x * 0.006 + seed) * amp * 0.5; ys.push(y); g.lineTo(x, y); }
  g.lineTo(w + step, h); g.closePath(); g.fill();
  if (deco) deco(g, w, ys, step);
}
export function buildBackdrop() {
  const scene = new THREE.Scene(), layers = [];
  const group = new THREE.Group(); scene.add(group);
  const add = (name, z, paint, depth, par) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
    m.renderOrder = layers.length; group.add(m); layers.push({ name, m, paint, par, texW: 0, texH: 0, tex: null, z }); return m;
  };
  add('sky', 0, (g, w, h) => paintSky(g, w, h), 0, 0);
  add('far', 1, (g, w, h) => paintRidge(g, w, h, h * 0.64 - 6, 46, 'rgba(78,150,124,0.82)', 3, 38), 0, 6);
  add('mid', 2, (g, w, h) => paintRidge(g, w, h, h * 0.64 + 26, 52, 'rgba(40,112,96,0.94)', 8, 34, (g2, ww, ys, step) => {
    // acacia on the right
    const tx = ww * 0.86, ty = ys[Math.round(tx / step)] ?? h * 0.7;
    g2.fillStyle = 'rgba(8,34,28,0.96)'; g2.strokeStyle = 'rgba(8,34,28,0.96)'; g2.lineWidth = 6; g2.lineCap = 'round';
    g2.beginPath(); g2.moveTo(tx, ty + 8); g2.quadraticCurveTo(tx - 6, ty - 22, tx - 2, ty - 52); g2.stroke();
    g2.beginPath(); g2.ellipse(tx, ty - 62, 70, 17, 0, 0, TAU); g2.fill(); g2.beginPath(); g2.ellipse(tx - 30, ty - 52, 36, 12, 0, 0, TAU); g2.fill();
  }), 0, 14);
  add('near', 3, (g, w, h) => paintRidge(g, w, h, h * 0.64 + 66, 42, 'rgba(14,62,54,0.98)', 15, 30, (g2, ww, ys, step) => {
    const hx = ww * 0.15, hy = ys[Math.round(hx / step)] ?? h * 0.74;   // thatched round hut
    g2.fillStyle = 'rgba(5,24,20,0.98)';
    g2.beginPath(); g2.moveTo(hx - 44, hy + 6); g2.lineTo(hx - 44, hy - 22); g2.lineTo(hx, hy - 70); g2.lineTo(hx + 44, hy - 22); g2.lineTo(hx + 44, hy + 6); g2.closePath(); g2.fill();
    g2.fillStyle = 'rgba(255,196,96,0.75)'; g2.beginPath(); g2.roundRect(hx - 7, hy - 18, 14, 24, 5); g2.fill();   // a lit doorway
  }), 0, 26);
  // soft mist banks, drifting
  const mist = [];
  const dot = softDot();
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: dot, color: '#ffe0a8', transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false }));
    m.renderOrder = 20 + i; group.add(m); mist.push(m);
  }
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#03130f', transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }));
  scrim.renderOrder = 50; group.add(scrim);
  // fireflies / dust motes
  const N = 28, pos = new Float32Array(N * 3), pts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: dot, color: '#ffe9a8', size: 14, sizeAttenuation: false, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false }));
  pts.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pts.frustumCulled = false; pts.renderOrder = 30; group.add(pts);

  let curW = 0, curH = 0;
  function layout(w, h) {
    if (Math.round(w) === curW && Math.round(h) === curH) return;
    curW = Math.round(w); curH = Math.round(h);
    // paint at a size that keeps the sun round: 1.0 texel per ~1.5 units
    const tw = clamp(Math.round(w * 0.9), 256, 1024), th = clamp(Math.round(h * 0.9), 256, 1400);
    for (const L of layers) {
      const c = document.createElement('canvas'); c.width = tw; c.height = th; L.paint(c.getContext('2d'), tw, th);
      if (L.tex) L.tex.dispose();
      L.tex = new THREE.CanvasTexture(c); L.tex.colorSpace = THREE.SRGBColorSpace; L.m.material.map = L.tex; L.m.material.needsUpdate = true;
      const over = L.par * 2 + 8;   // margin for the parallax drift
      L.m.scale.set(w + over * 2, h + over * 2, 1); L.m.position.set(w / 2, -h / 2, -2000 + L.z);
    }
    scrim.scale.set(w * 2, h * 2, 1); scrim.position.set(w / 2, -h / 2, -1000);
    mist.forEach((m, i) => { m.scale.set(w * 1.2, h * 0.16, 1); });
  }
  function update(t, w, h, o = {}) {
    layout(w, h);
    const dx = Math.sin(t * 0.07) * 1, dy = Math.cos(t * 0.05) * 0.5;
    layers.forEach((L) => { L.m.position.x = w / 2 + dx * L.par; L.m.position.y = -h / 2 + dy * L.par * 0.5; });
    const sunPulse = 1 + (o.pulse ?? 0) * 0.04;
    layers[0].m.scale.set((w + 8 * 2) * sunPulse, (h + 8 * 2) * sunPulse, 1);
    mist.forEach((m, i) => { m.position.set(((t * (4 + i * 2) + i * w * 0.37) % (w * 1.6)) - w * 0.3, -h * (0.55 + i * 0.07) + Math.sin(t * 0.2 + i) * 8, -1500 + i); m.material.opacity = 0.1 + 0.05 * Math.sin(t * 0.3 + i * 2); });
    scrim.material.opacity = clamp(o.dim ?? 0, 0, 0.9);
    const p = pts.geometry.attributes.position;
    for (let i = 0; i < N; i++) {
      p.setXYZ(i, ((i * 173.7 + t * (6 + (i % 4) * 3)) % (w + 40)) - 20, -(h * (0.1 + 0.62 * ((i * 0.31) % 1)) + Math.sin(t * 0.6 + i * 1.7) * 14), -900);
    }
    p.needsUpdate = true; pts.material.opacity = 0.55 + 0.25 * Math.sin(t * 1.3);
  }
  return { scene, update };
}

// ---------------------------------------------------------------- the woven mat the lyre stands on
export function buildMat(G, mats = M) {
  const g = new THREE.Group();
  const w = G.rx * 3.1, h = G.rx * 1.35;
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 1), mats.mat);
  mat.rotation.x = -1.18; mat.position.set(G.cx, -(G.botY - G.ry * 0.05), -G.rx * 0.5); mat.receiveShadow = true;
  g.add(mat);
  // a soft contact shadow under the bowl (the bowl is a real mesh but the mat is far behind it; this grounds it)
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(G.rx * 2.6, G.ry * 0.9), new THREE.MeshBasicMaterial({ map: softDot(), color: '#000', transparent: true, opacity: 0.55, depthWrite: false }));
  sh.position.set(G.cx + G.rx * 0.08, -(G.botY - G.ry * 0.02), -G.rx * 0.35); g.add(sh);
  return g;
}
